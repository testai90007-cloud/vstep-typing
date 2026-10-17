'use client';

// Writing mock test: /writing/de-thi/[id]
// Three states: mode-picker → doing (practice | mock) → result.
// Mock mode mirrors the real VSTEP writing exam: sticky exam bar with a
// prominent countdown, per-task tabs, suggested-time hints, live word
// counters, confirm-before-submit, auto-submit at 0:00 and a beforeunload
// guard so work isn't lost.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { loadWritingTest, type WritingTest } from '@/lib/writing-tests';
import { getAiSettings } from '@/lib/aiKey';
import { useIsDark } from '@/components/useIsDark';
import {
  buildTask1ScorePrompt,
  buildTask2ScorePrompt,
  type WritingScore,
} from '@/lib/writing-score-prompts';
import CountUp from '@/components/CountUp';
import LatticeLoader from '@/components/LatticeLoader';

const MIN_WORDS_1 = 120;
const MIN_WORDS_2 = 250;

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function fmtClock(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} giây`;
  return s === 0 ? `${m} phút` : `${m} phút ${s} giây`;
}

type Stage = 'pick' | 'doing' | 'result';
type Mode = 'practice' | 'mock';

/**
 * PromptCard — renders a test prompt like the reference exam UI:
 * intro, an optional lead-in line, then a left-bordered quote block holding
 * the email/notes body plus bullet questions/instructions, then the
 * requirement. Part 2 (essay) renders background paragraphs with the
 * "Discuss…" instruction emphasized.
 */
function PromptCard({ part, taskNo }: { part: WritingTest['part1']; taskNo: 1 | 2 }) {
  const lines = part.prompt;
  const intro = lines[0] ?? '';

  let leadIn: string | undefined;
  let body: string[] = [];
  let bullets: string[] = [];
  let taskLine: string | undefined;

  if (taskNo === 1) {
    const rest = lines.slice(1);
    leadIn = rest.find((l) => /read (part of|the notes)|include the following/i.test(l));
    const others = rest.filter((l) => l !== leadIn);
    // The 5000-test bank's Task 1 prompt is positional:
    // [intro, situation, (Write-line)?, bullet…]. The Write-line
    // ("Write a letter/email to …" / "In your letter, you should:")
    // separates the situation from the instruction bullets; without it,
    // everything after the situation is a bullet.
    const writeIdx = others.findIndex((l) =>
      /^write (an? (letter|email|formal)|the letter)|^in your (letter|email), you should/i.test(l)
    );
    if (writeIdx >= 0) {
      body = others.slice(0, writeIdx + 1);
      bullets = others.slice(writeIdx + 1);
    } else if (others.length > 1) {
      body = others.slice(0, 1);
      bullets = others.slice(1);
    } else {
      body = others;
    }
  } else {
    const rest = lines.slice(1);
    // The task instruction is the LAST line of a Part 2 prompt. Search from
    // the end so a background paragraph that happens to start with a
    // question word never shadows it. It matches the instruction in most
    // Part 2 prompts; statement-only questions (no question word) fall back
    // to rendering as a background paragraph.
    const TASK_LINE_RE = /^(discuss|do you agree|do you think|in your opinion|analyze|give your opinion|suggest|write|explain|to what extent|what|how|why|should)/i;
    let taskLineIdx = -1;
    for (let i = rest.length - 1; i >= 0; i--) {
      if (TASK_LINE_RE.test(rest[i].trimStart())) {
        taskLineIdx = i;
        break;
      }
    }
    taskLine = taskLineIdx >= 0 ? rest[taskLineIdx] : undefined;
    body = taskLineIdx >= 0 ? rest.filter((_, i) => i !== taskLineIdx) : rest;
  }

  return (
    <div className="prompt-card">
      <div className="prompt-head">
        <span className="chip">Task {taskNo}</span>
        <strong>{part.type}</strong>
        {part.level && <span className="chip">{part.level}</span>}
      </div>
      {part.vi && <p className="prompt-vi">{part.vi}</p>}
      {intro && <p className="prompt-intro">{intro}</p>}
      {leadIn && <p className="prompt-leadin">{leadIn}</p>}
      {taskNo === 1 ? (
        <blockquote className="prompt-quote">
          {body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {bullets.length > 0 && (
            <ul>
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </blockquote>
      ) : (
        <>
          {body.map((p, i) => (
            <p key={i} className="prompt-bg">{p}</p>
          ))}
          {taskLine && <p className="prompt-taskline">{taskLine}</p>}
        </>
      )}
      <p className="prompt-req">{part.requirement}</p>
    </div>
  );
}

type PartScoreStatus = 'idle' | 'scoring' | 'done' | 'error' | 'skipped' | 'nokey';
interface PartScore {
  status: PartScoreStatus;
  data: WritingScore | null;
  raw: string;
  error: string;
}
const freshPartScore = (): PartScore => ({ status: 'idle', data: null, raw: '', error: '' });

function fmtScore(v: number): string {
  return String(Math.round(v * 10) / 10).replace('.', ',');
}

async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function scoreColor(v: number): string {
  if (v >= 8) return 'var(--correct)';
  if (v >= 6.5) return 'var(--accent-strong)';
  if (v >= 5) return 'var(--warn)';
  return 'var(--wrong)';
}

/** One score card: PART 1 — EMAIL/LETTER / PART 2 — ESSAY with the big score. */
function ScoreCard({
  part, state, onRetry,
}: {
  part: 1 | 2;
  state: PartScore;
  onRetry: () => void;
}) {
  return (
    <div className="card-soft score-card">
      <div className="score-card-label">PART {part} — {part === 1 ? 'EMAIL/LETTER' : 'ESSAY'}</div>
      <div className="score-card-body">
        {state.status === 'scoring' && (
          <LatticeLoader status="working" label="AI đang chấm" showTimer fontSize={13} />
        )}
        {state.status === 'done' && state.data && (
          <>
            <div className="score-num" style={{ color: scoreColor(state.data.overall_score) }}>
              <CountUp to={Math.round(state.data.overall_score * 10) / 10} locales="vi-VN" duration={1.4} /><small>/10</small>
            </div>
            {state.data.overall_score === 0 ? (
              <span className="chip danger">Lạc đề — 0 điểm</span>
            ) : (
              state.data.current_level && (
                <span className="chip">Trình độ: {state.data.current_level}</span>
              )
            )}
          </>
        )}
        {state.status === 'done' && !state.data && (
          <span className="chip">Đã chấm</span>
        )}
        {state.status === 'skipped' && (
          <span className="score-card-hint">Chưa có bài viết</span>
        )}
        {state.status === 'nokey' && (
          <span className="score-card-hint">Chưa có API key</span>
        )}
        {state.status === 'error' && (
          <>
            <span className="score-card-err">{state.error}</span>
            <button className="btn" onClick={onRetry}>Thử chấm lại</button>
          </>
        )}
      </div>
    </div>
  );
}

/** Per-criterion breakdown with mistake details — redesigned for readability. */
function ScoreDetail({ part, data, testTitle, onCopyPrompt, copied }: { part: 1 | 2; data: WritingScore; testTitle: string; onCopyPrompt: () => void; copied: boolean }) {
  return (
    <section className="detail-card" aria-label={`Chi tiết Task ${part}`}>
      <header className="detail-head">
        <div>
          <div className="detail-kicker">NHẬN XÉT CỦA AI · TASK {part} · {testTitle.toUpperCase()}</div>
          <div className="detail-head-row">
            {data.current_level && (
              <span className="chip">Trình độ: {data.current_level}</span>
            )}
            {data.overall_score === 0 && (
              <span className="chip danger">Lạc đề — 0 điểm</span>
            )}
            <button className="btn sm copy-btn" onClick={onCopyPrompt} title="Sao chép prompt chấm để hỏi thêm AI khác">
              {copied ? 'Đã sao chép ✓' : 'Sao chép prompt chấm'}
            </button>
          </div>
        </div>
        <div className="detail-overall" style={{ color: scoreColor(data.overall_score) }}>
          <CountUp to={Math.round(data.overall_score * 10) / 10} locales="vi-VN" duration={1.4} /><small>/10</small>
        </div>
      </header>
      {data.level_feedback && (
        <p className="detail-lead">{data.level_feedback}</p>
      )}

      <ol className="crit-list">
        {data.criteria.map((c, i) => (
          <li key={c.key || i} className="crit-item">
            <div className="crit-top">
              <span className="crit-num">{i + 1}</span>
              <strong className="crit-name">{c.name_vi}</strong>
              <span className="crit-score" style={{ color: scoreColor(c.score) }}>
                <CountUp to={c.score} locales="vi-VN" duration={1} delay={i * 0.08} />
              </span>
            </div>
            <div className="criterion-bar">
              <div style={{ width: `${Math.min(100, c.score * 10)}%`, background: scoreColor(c.score) }} />
            </div>
            {c.comment && <p className="crit-comment">{c.comment}</p>}
            {c.mistakes.length > 0 && (
              <div className="mistake-box">
                <div className="mistake-box-title">Lỗi cần chú ý</div>
                <ul>
                  {c.mistakes.map((m, j) => (
                    <li key={j}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>

      {data.strengths.length > 0 && (
        <div className="fb-section">
          <div className="fb-heading"><span className="fb-ico good">✓</span> Điểm mạnh</div>
          <ul className="fb-list">
            {data.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      {data.improvements.length > 0 && (
        <div className="fb-section">
          <div className="fb-heading"><span className="fb-ico warn">→</span> Cần cải thiện</div>
          <ul className="fb-list">
            {data.improvements.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      {data.corrections.length > 0 && (
        <div className="fb-section">
          <div className="fb-heading"><span className="fb-ico fix">✎</span> Sửa lỗi chi tiết</div>
          <div className="corr-list">
            {data.corrections.map((c, i) => (
              <div key={i} className="corr-card">
                {c.original && (
                  <div className="corr-row">
                    <span className="corr-label bad">Câu của bạn</span>
                    <p className="corr-orig">{c.original}</p>
                  </div>
                )}
                {c.corrected && (
                  <div className="corr-row">
                    <span className="corr-label good">Câu sửa</span>
                    <p className="corr-fixed">{c.corrected}</p>
                  </div>
                )}
                {c.explanation && (
                  <div className="corr-row">
                    <span className="corr-label why">Vì sao</span>
                    <p className="corr-why">{c.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.revised_version && (
        <div className="fb-section">
          <div className="fb-heading"><span className="fb-ico doc">📝</span> Bản viết lại gợi ý</div>
          <div className="revised-box">{data.revised_version}</div>
        </div>
      )}
    </section>
  );
}


/**
 * AI scoring for the two writing tasks. Both parts are scored in parallel,
 * revealing each part's score card as soon as it arrives.
 */
function AiScoring({ test, text1, text2, onRedo, getSavedId, isAnonymous }: { test: WritingTest; text1: string; text2: string; onRedo: () => void; getSavedId: () => number | null; isAnonymous: boolean }) {
  const [parts, setParts] = useState<[PartScore, PartScore]>([freshPartScore(), freshPartScore()]);
  const [detailTab, setDetailTab] = useState<1 | 2>(1);
  const [essaySubTab, setEssaySubTab] = useState<'essay' | 'prompt'>('essay');
  const [copied, setCopied] = useState(false);
  const [essayCopied, setEssayCopied] = useState(false);
  const [started, setStarted] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'unknown' | 'nokey' | 'haskey'>('unknown');
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const essayCopiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Aborts the in-flight scoring fetches when the user cancels. */
  const abortRef = useRef<AbortController | null>(null);
  /** Persist state of the AI score (attached to the submit row via its id). */
  const [aiSaveState, setAiSaveState] = useState<'idle' | 'saving' | 'saved' | 'skipped' | 'error'>('idle');
  const savedScoreKeyRef = useRef<string | null>(null);
  const lastScoresRef = useRef<{ p1: number; p2: number; total: number } | null>(null);

  const setPart = (idx: 0 | 1, patch: Partial<PartScore>) =>
    setParts((prev) => {
      const next: [PartScore, PartScore] = [{ ...prev[0] }, { ...prev[1] }];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });

  async function scoreOne(part: 1 | 2, essay: string) {
    const idx = (part - 1) as 0 | 1;
    if (essay.trim().length < 20) {
      setPart(idx, { status: 'skipped' });
      return;
    }
    setPart(idx, { status: 'scoring', error: '' });
    const ai = getAiSettings();
    try {
      const p = part === 1 ? test.part1 : test.part2;
      const res = await fetch('/api/writing/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current?.signal,
        body: JSON.stringify({
          provider: ai.provider,
          apiKey: ai.apiKey,
          part,
          testTitle: test.title,
          prompt: p.prompt,
          requirement: p.requirement,
          essay,
        }),
      });
      const text = await res.text();
      let data: { score?: WritingScore | null; raw?: string; error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Máy chủ chấm điểm đang bận. Đợi ít phút rồi bấm "Thử chấm lại".');
      }
      if (!res.ok) throw new Error(data.error || 'Chấm bài thất bại.');
      setPart(idx, { status: 'done', data: data.score ?? null, raw: data.raw || '' });
    } catch (e) {
      // Cancelled by the user — back to idle, not an error.
      if (e instanceof Error && e.name === 'AbortError') {
        setPart(idx, { status: 'idle', error: '' });
        return;
      }
      setPart(idx, { status: 'error', error: e instanceof Error ? e.message : 'Chấm bài thất bại. Hãy thử lại.' });
    }
  }

  const retryOne = (part: 1 | 2) => scoreOne(part, part === 1 ? text1 : text2);

  /** Rebuild the exact scoring prompt sent to the model, for the copy button. */
  function buildPromptFor(part: 1 | 2): string {
    const p = part === 1 ? test.part1 : test.part2;
    const args = {
      testTitle: test.title,
      taskText: p.prompt.join('\n'),
      instructions: p.requirement,
      essay: part === 1 ? text1 : text2,
    };
    return part === 1 ? buildTask1ScorePrompt(args) : buildTask2ScorePrompt(args);
  }

  async function handleCopyPrompt() {
    const ok = await copyText(buildPromptFor(detailTab));
    setCopied(ok);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyEssay() {
    const ok = await copyText(detailTab === 1 ? text1 : text2);
    setEssayCopied(ok);
    if (essayCopiedTimer.current) clearTimeout(essayCopiedTimer.current);
    essayCopiedTimer.current = setTimeout(() => setEssayCopied(false), 2000);
  }

  const startAll = () => {
    abortRef.current = new AbortController();
    setStarted(true);
    setParts([freshPartScore(), freshPartScore()]);
    setAiSaveState('idle');
    savedScoreKeyRef.current = null;
    // score both parts in parallel — each reveals its card as soon as it arrives
    void Promise.all([scoreOne(1, text1), scoreOne(2, text2)]);
  };

  /** Stop a running scoring pass and return to the pre-start state. */
  const cancelAll = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStarted(false);
    setParts([freshPartScore(), freshPartScore()]);
    setAiSaveState('idle');
    savedScoreKeyRef.current = null;
  };

  // On mount, only check whether a key exists — scoring starts when the
  // user presses "Chấm điểm AI", so they can read the result first.
  useEffect(() => {
    if (!getAiSettings().apiKey) {
      setKeyStatus('nokey');
      setParts([
        { ...freshPartScore(), status: 'nokey' },
        { ...freshPartScore(), status: 'nokey' },
      ]);
      return;
    }
    setKeyStatus('haskey');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finished = parts.every((p) => ['done', 'error', 'skipped'].includes(p.status));
  const hasKey = parts.some((p) => p.status !== 'nokey');

  const s1 = parts[0].status === 'done' ? parts[0].data : null;
  const s2 = parts[1].status === 'done' ? parts[1].data : null;
  const bothDone = !!s1 && !!s2;
  const total = bothDone ? Math.round(((s1!.overall_score + s2!.overall_score * 2) / 3) * 10) / 10 : 0;

  /**
   * Attach the AI scores to the row created at submit time. Waits briefly
   * for the parent's save to return its row id; reports honestly and offers
   * a retry instead of claiming success on failure.
   */
  const saveAiScore = useCallback(async (p1: number, p2: number, totalScore: number) => {
    lastScoresRef.current = { p1, p2, total: totalScore };
    // When we are certain the user is anonymous, the submit-time save never
    // produced a row id — skip the 15×1s poll and report 'skipped' at once.
    if (isAnonymous) {
      setAiSaveState('skipped');
      return;
    }
    let id: number | null = null;
    for (let i = 0; i < 15; i++) {
      id = getSavedId();
      if (id) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!id) {
      // The submit-time save failed (parent already toasted) — this is a
      // save failure with retry, NOT "not logged in".
      setAiSaveState('error');
      return;
    }
    setAiSaveState('saving');
    try {
      const res = await fetch('/api/writing/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, aiScore: totalScore, aiPart1: p1, aiPart2: p2 }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setAiSaveState('skipped');
        return;
      }
      if (res.ok && data?.saved !== false) {
        setAiSaveState('saved');
        return;
      }
      setAiSaveState('error');
    } catch {
      setAiSaveState('error');
    }
  }, [getSavedId, isAnonymous]);

  // Save once per distinct score set (re-scoring with new scores updates).
  useEffect(() => {
    if (!bothDone || !s1 || !s2) return;
    const key = `${s1.overall_score}|${s2.overall_score}`;
    if (savedScoreKeyRef.current === key) return;
    savedScoreKeyRef.current = key;
    saveAiScore(s1.overall_score, s2.overall_score, total);
  }, [bothDone, s1, s2, total, saveAiScore]);

  const retryAiSave = () => {
    const last = lastScoresRef.current;
    if (last) saveAiScore(last.p1, last.p2, last.total);
  };
  const activeState = parts[detailTab - 1];
  const activeEssay = detailTab === 1 ? text1 : text2;
  const activePart = detailTab === 1 ? test.part1 : test.part2;
  const activeMin = detailTab === 1 ? MIN_WORDS_1 : MIN_WORDS_2;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        <span className="icon-badge sm">
          <SparklesIcon width={18} height={18} strokeWidth={1.6} />
        </span>
        Chấm điểm AI
      </h2>

      {!started && keyStatus === 'haskey' && (
        <div className="card-soft" style={{ padding: '14px 16px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.65 }}>
            AI sẽ chấm cả 2 Task theo thang điểm 0–10. Bấm nút bên dưới khi bạn sẵn sàng.
          </p>
          <button className="btn primary" onClick={startAll}>
            Chấm điểm AI
          </button>
        </div>
      )}

      {started && (
        <>
          <div className="score-cards">
            <ScoreCard part={1} state={parts[0]} onRetry={() => retryOne(1)} />
            <ScoreCard part={2} state={parts[1]} onRetry={() => retryOne(2)} />
          </div>
          {!finished && (
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={cancelAll}>
                Hủy chấm
              </button>
            </div>
          )}
        </>
      )}

      {bothDone && (
        <>
        <div className="card-soft total-card">
          <div className="total-label">ĐIỂM WRITING TỔNG</div>
          <div className="total-num" style={{ color: scoreColor(total) }}>
            <CountUp to={total} locales="vi-VN" duration={1.6} />
          </div>
          <div className="total-formula">Công thức: (Part 1 + Part 2 × 2) / 3</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '10px 0 0' }}>
            {aiSaveState === 'saved' && 'Đã lưu điểm AI vào tiến bộ của bạn.'}
            {aiSaveState === 'saving' && 'Đang lưu điểm…'}
            {aiSaveState === 'skipped' && 'Đăng nhập bằng Google để lưu điểm AI.'}
            {aiSaveState === 'error' && (
              <>
                Lưu điểm thất bại.{' '}
                <button
                  type="button"
                  onClick={retryAiSave}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    fontWeight: 700,
                    color: 'var(--accent-strong)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Thử lưu lại
                </button>
              </>
            )}
          </p>
        </div>
        </>
      )}

      {finished && hasKey && (
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={startAll}>
            Chấm lại
          </button>
          <button className="btn" onClick={onRedo}>
            Làm lại
          </button>
          <Link href="/writing" className="btn">
            Quay về
          </Link>
        </div>
      )}

      {parts[0].status === 'nokey' && (
        <div className="card-soft" style={{ marginTop: 12, padding: '14px 16px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.65 }}>
            Cần API key để AI chấm điểm Writing. Key bạn đã lưu ở trang Cài đặt sẽ được dùng ở đây.
          </p>
          <Link href="/settings" className="btn" style={{ marginTop: 10 }}>
            Mở Cài đặt
          </Link>
        </div>
      )}

      {finished && hasKey && (
        <div className="tips-block">
          <h3 className="tips-title">Gợi ý cho bạn</h3>
          <div className="tips-grid">
            <div className="card-soft tip-card">
              <span className="tip-ico">
                <ClockIcon width={18} height={18} />
              </span>
              <p>
                Bài làm đã được lưu trong <Link href="/history">Lịch sử làm bài</Link>.
              </p>
            </div>
            <div className="card-soft tip-card">
              <span className="tip-ico">
                <SparklesIcon width={18} height={18} />
              </span>
              <p>
                Nhận xét còn chung chung? Ấn <strong>Sao chép prompt chấm</strong> rồi hỏi thêm ChatGPT, Gemini, Claude…
              </p>
            </div>
            <div className="card-soft tip-card">
              <span className="tip-ico">
                <ChartBarIcon width={18} height={18} />
              </span>
              <p>
                Làm thêm đề khác để theo dõi tiến bộ ở <Link href="/progress">trang Tiến độ</Link>.
              </p>
            </div>
          </div>
        </div>
      )}

      {(s1 || s2) && (
        <div className="work-detail">
          <h3 className="tips-title" style={{ marginBottom: 10 }}>
            Chi tiết bài làm
          </h3>
          <div className="part-tabs" role="tablist" aria-label="Chọn Task">
            {([1, 2] as const).map((part) => {
              const d = part === 1 ? s1 : s2;
              const active = detailTab === part;
              return (
                <button
                  key={part}
                  role="tab"
                  aria-selected={active}
                  className={active ? 'active' : ''}
                  onClick={() => {
                    setDetailTab(part);
                    setEssaySubTab('essay');
                  }}
                >
                  {d && (
                    <span className="tab-score" style={{ color: active ? 'var(--bg)' : scoreColor(d.overall_score) }}>
                      {fmtScore(d.overall_score)}
                    </span>
                  )}
                  Part {part}
                  {part === 2 && <span className="tab-mult">×2</span>}
                </button>
              );
            })}
          </div>

          <div className="work-cols">
            <div className="card essay-card">
              <div className="essay-head">
                <strong>Bài làm của bạn</strong>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <button className="btn sm" onClick={handleCopyEssay} disabled={!activeEssay}>
                    {essayCopied ? 'Đã sao chép ✓' : 'Sao chép bài làm'}
                  </button>
                  <WordCounter words={wordCount(activeEssay)} min={activeMin} />
                </span>
              </div>
              <div className="mini-tabs">
                <button className={essaySubTab === 'essay' ? 'active' : ''} onClick={() => setEssaySubTab('essay')}>
                  Bài làm
                </button>
                <button className={essaySubTab === 'prompt' ? 'active' : ''} onClick={() => setEssaySubTab('prompt')}>
                  Đề bài
                </button>
              </div>
              <div className="essay-body">
                {essaySubTab === 'essay' ? (
                  activeEssay ? (
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{activeEssay}</p>
                  ) : (
                    <p className="score-card-hint">Chưa có bài viết.</p>
                  )
                ) : (
                  <PromptCard part={activePart} taskNo={detailTab} />
                )}
              </div>
            </div>

            <div>
              {activeState.status === 'done' && activeState.data ? (
                <ScoreDetail
                  part={detailTab}
                  data={activeState.data}
                  testTitle={test.title}
                  onCopyPrompt={handleCopyPrompt}
                  copied={copied}
                />
              ) : activeState.status === 'done' && activeState.raw ? (
                <div className="card-soft" style={{ padding: '16px 18px' }}>
                  <strong style={{ fontSize: '0.92rem' }}>Nhận xét Task {detailTab}</strong>
                  <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.75, marginTop: 8 }}>
                    {activeState.raw}
                  </p>
                </div>
              ) : (
                <div className="card-soft" style={{ padding: '16px 18px' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
                    {activeState.status === 'error' ? activeState.error : 'Task này chưa được chấm.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <p style={{ color: 'var(--faint)', fontSize: '0.78rem', margin: '12px 0 0', lineHeight: 1.6 }}>
        Điểm AI chỉ mang tính tham khảo.
      </p>
    </div>
  );
}


function WordCounter({ words, min }: { words: number; min: number }) {
  const ok = words >= min;
  return (
    <span className={`wc${ok ? ' ok' : ''}`} title={ok ? 'Đã đạt số từ tối thiểu' : `Tối thiểu ${min} từ`}>
      {ok && <CheckCircleIcon width={14} height={14} />}
      Số từ: {words} / {min} từ
    </span>
  );
}

/** Max essay size accepted by the scoring endpoint (~2000 words). */
const MAX_ESSAY_CHARS = 12000;

/** One task editor: prompt card + "Bài viết của bạn" + big textarea + word count. */
function TaskEditor({
  part,
  taskNo,
  value,
  onChange,
  textareaId,
}: {
  part: WritingTest['part1'];
  taskNo: 1 | 2;
  value: string;
  onChange: (v: string) => void;
  textareaId: string;
}) {
  const words = wordCount(value);
  const min = taskNo === 1 ? MIN_WORDS_1 : MIN_WORDS_2;
  const chars = value.length;
  const nearCap = chars >= MAX_ESSAY_CHARS * 0.8;
  const atCap = chars >= MAX_ESSAY_CHARS;
  return (
    <>
      <PromptCard part={part} taskNo={taskNo} />
      <p className="write-label">
        <label htmlFor={textareaId}>Bài viết của bạn:</label>
      </p>
      <textarea
        id={textareaId}
        className="ta write-big"
        placeholder="Bắt đầu viết bài ở đây…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        maxLength={MAX_ESSAY_CHARS}
      />
      <div className="write-meta">
        <WordCounter words={words} min={min} />
        <span
         
          style={{
            fontSize: '0.82rem',
            fontWeight: nearCap ? 700 : 400,
            color: atCap ? 'var(--wrong)' : nearCap ? 'var(--warn)' : 'var(--muted)',
          }}
        >
          {chars.toLocaleString('vi-VN')} / {MAX_ESSAY_CHARS.toLocaleString('vi-VN')} ký tự
          {atCap && ' — đã đạt giới hạn'}
        </span>
      </div>
    </>
  );
}

/** Sticky bottom bar with the Part 1 / Part 2 switcher. */
function TaskBottomBar({ tab, setTab }: { tab: 1 | 2; setTab: (t: 1 | 2) => void }) {
  return (
    <div className="task-bottombar">
      <div className="seg" role="tablist" aria-label="Chuyển task">
        <button role="tab" aria-selected={tab === 1} className={tab === 1 ? 'active' : ''} onClick={() => setTab(1)}>
          Part 1
        </button>
        <button role="tab" aria-selected={tab === 2} className={tab === 2 ? 'active' : ''} onClick={() => setTab(2)}>
          Part 2
        </button>
      </div>
    </div>
  );
}

export default function WritingTestPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  // The 5000-test bank is loaded on demand (one ~88 KB chunk per test),
  // not bundled into the page. undefined = loading, null = not found.
  const [test, setTest] = useState<WritingTest | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setTest(undefined);
    loadWritingTest(id).then((t) => {
      if (!cancelled) setTest(t ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  const { data: session, status: sessionStatus } = useSession();
  // theme: same site-wide toggle as the typing page (html[data-theme] + localStorage 'vstep_theme')
  const dark = useIsDark();
  function toggleDark() {
    const next = !dark;
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try {
      localStorage.setItem('vstep_theme', next ? 'dark' : 'light');
    } catch {
      /* private mode */
    }
  }

  const [stage, setStage] = useState<Stage>('pick');
  const [mode, setMode] = useState<Mode>('practice');
  const [tab, setTab] = useState<1 | 2>(1);
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [expired, setExpired] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [result, setResult] = useState<{ durationSec: number; w1: number; w2: number; auto: boolean; t1Sec?: number; t2Sec?: number } | null>(null);

  const timerRef = useRef<{ start: number; total: number } | null>(null);
  const startStamp = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);
  /** Row id returned by /api/writing/save — used to attach AI scores later. */
  const savedIdRef = useRef<number | null>(null);
  /** Confirm-modal focus management: "Nộp bài" opener + "Viết tiếp" button. */
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);
  const continueBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevConfirmingRef = useRef(false);
  /** Per-task time tracking (mock mode): accumulated seconds per Task. */
  const taskTimeRef = useRef<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const taskStartRef = useRef<{ task: 1 | 2; at: number } | null>(null);

  function accumulateTaskTime() {
    const s = taskStartRef.current;
    if (!s) return;
    taskTimeRef.current[s.task] += (Date.now() - s.at) / 1000;
    taskStartRef.current = null;
  }

  /**
   * Part switcher: tracks per-task time in mock mode and moves focus to
   * the newly active textarea — but only on fine pointers, so switching
   * tabs on a phone doesn't pop the keyboard unexpectedly.
   */
  function switchTab(t: 1 | 2) {
    if (t === tab) return;
    if (stage === 'doing' && mode === 'mock') {
      accumulateTaskTime();
      taskStartRef.current = { task: t, at: Date.now() };
    }
    setTab(t);
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
      const prefix = mode === 'mock' ? 'm' : 't';
      setTimeout(() => {
        document.getElementById(`${prefix}${t}`)?.focus();
      }, 0);
    }
  }

  const totalSec = (test?.timeMin ?? 60) * 60;
  const words1 = wordCount(text1);
  const words2 = wordCount(text2);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }

  // --- countdown (mock mode) -------------------------------------------------
  useEffect(() => {
    if (stage !== 'doing' || mode !== 'mock') return;
    timerRef.current = { start: Date.now(), total: totalSec };
    startStamp.current = Date.now();
    setTimeLeft(totalSec);
    const idInt = setInterval(() => {
      const t = timerRef.current;
      if (!t) return;
      const left = Math.max(0, t.total - Math.floor((Date.now() - t.start) / 1000));
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(idInt);
        timerRef.current = null;
        setExpired(true);
      }
    }, 500);
    return () => clearInterval(idInt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, mode]);

  // --- elapsed time (practice mode): the chip shows time spent -----------
  useEffect(() => {
    if (stage !== 'doing' || mode !== 'practice') return;
    const idInt = setInterval(() => {
      if (startStamp.current) {
        setElapsedSec(Math.round((Date.now() - startStamp.current) / 1000));
      }
    }, 500);
    return () => clearInterval(idInt);
  }, [stage, mode]);

  // --- confirm modal: Escape closes, focus moves in and back out ----------
  useEffect(() => {
    if (confirming) {
      prevConfirmingRef.current = true;
      const t = setTimeout(() => continueBtnRef.current?.focus(), 0);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setConfirming(false);
      };
      window.addEventListener('keydown', onKey);
      return () => {
        clearTimeout(t);
        window.removeEventListener('keydown', onKey);
      };
    }
    if (prevConfirmingRef.current) {
      prevConfirmingRef.current = false;
      // Return focus to "Nộp bài" — only if it's still mounted (the
      // confirm-submit path unmounts it by moving to the result stage).
      const btn = submitBtnRef.current;
      if (btn && document.contains(btn)) btn.focus();
    }
  }, [confirming]);

  // --- beforeunload guard while a test is in progress (mock OR practice) -----
  useEffect(() => {
    if (stage !== 'doing') return;
    if (!text1.trim() && !text2.trim()) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [stage, text1, text2]);

  // --- draft autosave (localStorage): survives refresh / accidental navigation
  const DRAFT_KEY = `vstep_draft_writing_dethi_${id}`;
  const [draftInfo, setDraftInfo] = useState<{ savedAt: number } | null>(null);

  // On mount: check for an unfinished draft (metadata only — restore is the
  // user's choice via the banner, never automatic).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { text1?: string; text2?: string; savedAt?: number };
        if ((d.text1 || '').trim() !== '' || (d.text2 || '').trim() !== '') {
          setDraftInfo({ savedAt: d.savedAt || 0 });
        }
      }
    } catch {
      /* corrupted draft — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Autosave (debounced) while writing. Never overwrites a good draft with
  // empty content.
  useEffect(() => {
    if (stage !== 'doing') return;
    const timer = setTimeout(() => {
      try {
        if (!text1.trim() && !text2.trim()) return;
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          text1, text2, tab, mode, savedAt: Date.now(),
        }));
      } catch {
        /* private mode / quota — the test itself still works */
      }
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, text1, text2, tab, mode]);

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { text1?: string; text2?: string; tab?: number; mode?: string };
      setText1(d.text1 || '');
      setText2(d.text2 || '');
      setTab(d.tab === 2 ? 2 : 1);
      setMode(d.mode === 'mock' ? 'mock' : 'practice');
      // Per-task clock restarts with the draft (the mock countdown itself
      // also restarts at 60:00 — disclosed in the toast below).
      taskTimeRef.current = { 1: 0, 2: 0 };
      taskStartRef.current = d.mode === 'mock'
        ? { task: d.tab === 2 ? 2 : 1, at: Date.now() }
        : null;
      if (d.mode !== 'mock' && !startStamp.current) startStamp.current = Date.now();
      finishedRef.current = false;
      setExpired(false);
      setAutoSubmitted(false);
      setConfirming(false);
      setResult(null);
      setStage('doing');
      setDraftInfo(null);
      showToast(
        d.mode === 'mock'
          ? 'Đã khôi phục bản nháp. Đồng hồ thi thử đã đặt lại 60:00.'
          : 'Đã khôi phục bản nháp.',
      );
      window.scrollTo({ top: 0 });
    } catch {
      /* corrupted draft — ignore */
    }
  }

  function discardDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDraftInfo(null);
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDraftInfo(null);
  }

  async function saveResult(durationSec: number) {
    if (!test) return;
    savedIdRef.current = null;
    setSaveFailed(false);
    try {
      const res = await fetch('/api/writing/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: test.id,
          mode,
          accuracy: null,
          durationSec,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        showToast('Đăng nhập bằng Google để lưu tiến bộ nhé!');
        return;
      }
      if (data && data.saved === false && data.reason === 'no-database') {
        showToast('Chưa kết nối database — bài làm vẫn được chấm tại chỗ.');
        return;
      }
      if (!res.ok || (data && data.saved === false)) {
        // Transient failure for a logged-in user — surface a retry
        // instead of silently dropping the result.
        setSaveFailed(true);
        return;
      }
      if (data && typeof data.id === 'number') {
        savedIdRef.current = data.id;
      }
    } catch {
      /* offline / db down — surface a retry instead of staying silent */
      setSaveFailed(true);
    }
  }

  /** Stable getter for the submit row id, so AiScoring can attach AI scores to it. */
  const getSavedId = useCallback(() => savedIdRef.current, []);

  function finish(auto: boolean) {
    if (finishedRef.current || !test) return;
    finishedRef.current = true;
    timerRef.current = null;
    accumulateTaskTime();
    const dur = startStamp.current ? Math.round((Date.now() - startStamp.current) / 1000) : 0;
    setResult({
      durationSec: dur,
      w1: wordCount(text1),
      w2: wordCount(text2),
      auto,
      t1Sec: Math.round(taskTimeRef.current[1]),
      t2Sec: Math.round(taskTimeRef.current[2]),
    });
    setAutoSubmitted(auto);
    setConfirming(false);
    setStage('result');
    clearDraft();
    saveResult(dur);
    showToast(auto ? 'Hết giờ! Bài đã được tự động nộp.' : 'Đã nộp bài!');
  }

  // auto-submit when the countdown hits zero
  useEffect(() => {
    if (expired && stage === 'doing' && mode === 'mock') finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, stage, mode]);

  function startMode(m: Mode) {
    finishedRef.current = false;
    setExpired(false);
    setAutoSubmitted(false);
    setConfirming(false);
    setSaveFailed(false);
    setElapsedSec(0);
    setText1('');
    setText2('');
    setTab(1);
    setResult(null);
    setMode(m);
    // Fresh per-task clock for a new mock attempt.
    taskTimeRef.current = { 1: 0, 2: 0 };
    taskStartRef.current = m === 'mock' ? { task: 1, at: Date.now() } : null;
    if (m === 'practice') {
      startStamp.current = Date.now();
    }
    setStage('doing');
    window.scrollTo({ top: 0 });
  }

  function retry() {
    savedIdRef.current = null;
    setStage('pick');
    setResult(null);
    window.scrollTo({ top: 0 });
  }

  if (test === undefined) {
    return (
      <main className="page">
        <div className="nav-top">
          <Link href="/writing" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Luyện Writing
          </Link>
        </div>
        <p>Đang tải đề…</p>
      </main>
    );
  }

  if (!test) {
    return (
      <main className="page">
        <div className="nav-top">
          <Link href="/writing" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Luyện Writing
          </Link>
        </div>
        <div className="card empty" style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px' }}>Không tìm thấy đề</p>
          <p className="lead" style={{ margin: '0 0 16px' }}>
            Đề thi bạn tìm không tồn tại hoặc đã bị gỡ.
          </p>
          <Link href="/writing" className="btn primary">
            <ArrowLeftIcon width={16} height={16} />
            Chọn đề khác
          </Link>
        </div>
      </main>
    );
  }

  const danger = mode === 'mock' && stage === 'doing' && timeLeft <= 5 * 60 && timeLeft > 0;
  const elapsedFrac = totalSec > 0 ? Math.min(1, (totalSec - timeLeft) / totalSec) : 0;

  return (
    <main className="page">
      <div className="nav-top">
        <Link
          href="/writing"
          className="back"
          onClick={(e) => {
            // In-app guard: beforeunload doesn't cover client-side nav.
            // Draft autosave already keeps the work — this only stops the
            // user being surprised by the visible text vanishing.
            if (
              stage === 'doing' &&
              (text1.trim() || text2.trim()) &&
              !window.confirm('Bài làm đang dở — bản nháp đã tự lưu. Bạn muốn thoát chứ?')
            ) {
              e.preventDefault();
            }
          }}
        >
          <ArrowLeftIcon width={16} height={16} />
          {stage === 'doing' ? 'Thoát · bản nháp tự lưu' : 'Chọn đề khác'}
        </Link>
        <button
          className="icon-btn"
          onClick={toggleDark}
          title={dark ? 'Chế độ sáng' : 'Chế độ tối'}
          aria-label={dark ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          {dark ? <SunIcon width={19} height={19} /> : <MoonIcon width={19} height={19} />}
        </button>
      </div>

      {/* ============================ MODE PICKER ============================ */}
      {stage === 'pick' && (
        <>
          <h1 className="brand" style={{ fontSize: '2rem' }}>
            {test.title} <span className="hl">· Writing</span>
          </h1>
          <p className="lead">
            Task 1 · Thư / Email (tối thiểu 120 từ) + Task 2 · Bài luận (tối thiểu 250 từ) — {test.timeMin} phút như thi thật.
          </p>

          <div className="mode-cards">
            <button className="card lift mode-card" onClick={() => startMode('practice')}>
              <span className="icon-badge">
                <BookOpenIcon width={24} height={24} strokeWidth={1.6} />
              </span>
              <strong>Luyện tập</strong>
              <span className="chip">Không giới hạn thời gian</span>
              <p>Thoải mái đọc đề, viết từ từ, sửa bài kỹ càng. Phù hợp khi mới làm quen dạng đề.</p>
            </button>
            <button className="card lift mode-card" onClick={() => startMode('mock')}>
              <span className="icon-badge">
                <FlagIcon width={24} height={24} strokeWidth={1.6} />
              </span>
              <strong>Thi thử</strong>
              <span className="chip accent">Đúng {test.timeMin} phút như thi thật</span>
              <p>
                Task 1 gợi ý 20 phút, Task 2 gợi ý 40 phút. Hết giờ tự động nộp bài — rèn đúng áp lực phòng thi.
              </p>
            </button>
          </div>

          {draftInfo && (
            <div
              className="card-soft"
              style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}
            >
              <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                Có bản nháp chưa hoàn thành
                {draftInfo.savedAt > 0 && (
                  <> (lưu lúc {new Date(draftInfo.savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})</>
                )}
                .
              </span>
              <button className="btn sm primary" onClick={restoreDraft}>
                Khôi phục bản nháp
              </button>
              <button className="btn sm" onClick={discardDraft}>
                Xóa bản nháp
              </button>
            </div>
          )}
        </>
      )}

      {/* ============================ DOING ============================ */}
            {stage === 'doing' && mode === 'practice' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="brand" style={{ fontSize: '1.7rem', margin: 0 }}>
              {test.title} <span className="hl">· Luyện tập</span>
            </h1>
            <span className="chip" style={{ marginLeft: 'auto' }}>
              <ClockIcon width={13} height={13} />
              Không giới hạn · đã làm <span>{fmtClock(elapsedSec)}</span>
            </span>
          </div>

          <div style={{ marginTop: 18 }}>
            {tab === 1 ? (
              <TaskEditor part={test.part1} taskNo={1} value={text1} onChange={setText1} textareaId="t1" />
            ) : (
              <TaskEditor part={test.part2} taskNo={2} value={text2} onChange={setText2} textareaId="t2" />
            )}
          </div>

          <div className="btn-row" style={{ marginTop: 20 }}>
            <button
              className="btn primary"
              onClick={() => {
                const dur = startStamp.current ? Math.round((Date.now() - startStamp.current) / 1000) : 0;
                setResult({ durationSec: dur, w1: words1, w2: words2, auto: false });
                setStage('result');
                clearDraft();
                saveResult(dur);
                showToast(session?.user ? 'Đã lưu bài!' : 'Xong! Đăng nhập để lưu tiến bộ nhé.');
                window.scrollTo({ top: 0 });
              }}
            >
              <CheckCircleIcon width={16} height={16} />
              Hoàn thành &amp; lưu bài
            </button>
          </div>

          <TaskBottomBar tab={tab} setTab={switchTab} />
        </>
      )}

      {stage === 'doing' && mode === 'mock' && (
        <>
          {/* sticky exam bar */}
          <div className="exam-topbar">
            <div className="exam-topbar-inner">
              <div className="exam-topbar-left">
                <strong>{test.title}</strong>
                <span className="chip">Task {tab} · gợi ý {tab === 1 ? '20' : '40'} phút</span>
              </div>
              <div className="exam-topbar-right">
                <div className={`countdown${danger ? ' danger' : ''}`} aria-label="Thời gian còn lại">
                  <ClockIcon width={18} height={18} />
                  {fmtClock(timeLeft)}
                </div>
                <button ref={submitBtnRef} className="btn primary" onClick={() => setConfirming(true)}>
                  <FlagIcon width={15} height={15} />
                  Nộp bài
                </button>
              </div>
            </div>
            <div className="time-progress">
              <div style={{ width: `${Math.round(elapsedFrac * 100)}%` }} />
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            {tab === 1 ? (
              <TaskEditor part={test.part1} taskNo={1} value={text1} onChange={setText1} textareaId="m1" />
            ) : (
              <TaskEditor part={test.part2} taskNo={2} value={text2} onChange={setText2} textareaId="m2" />
            )}
          </div>

          <TaskBottomBar tab={tab} setTab={switchTab} />

          {confirming && (
            <div className="modal-overlay" onClick={() => setConfirming(false)}>
              <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Xác nhận nộp bài">
                <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px' }}>Nộp bài thi thử?</p>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 18px', lineHeight: 1.65 }}>
                  Task 1: {words1} từ · Task 2: {words2} từ · còn <span>{fmtClock(timeLeft)}</span>. Bạn chắc chắn muốn nộp bài?
                </p>
                <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                  <button ref={continueBtnRef} className="btn" onClick={() => setConfirming(false)}>
                    Viết tiếp
                  </button>
                  <button className="btn primary" onClick={() => finish(false)}>
                    Nộp bài
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

{/* ============================ RESULT ============================ */}
      {stage === 'result' && result && (
        <>
          <h1 className="brand" style={{ fontSize: '1.7rem' }}>
            {test.title} <span className="hl">· Kết quả</span>
          </h1>
          {result.auto && (
            <div className="card-soft" style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', borderColor: 'var(--wrong)' }}>
              <ExclamationTriangleIcon width={20} height={20} style={{ color: 'var(--wrong)', flexShrink: 0 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>Hết giờ! Bài đã được tự động nộp.</p>
            </div>
          )}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="metric-grid" style={{ marginTop: 0 }}>
              <div className="metric">
                <strong>{fmtDur(result.durationSec)}</strong>
                <span>{mode === 'mock' ? `Hoàn thành trong ${fmtDur(result.durationSec)}` : 'Thời gian làm bài'}</span>
              </div>
              <div className="metric">
                <strong style={{ color: result.w1 >= MIN_WORDS_1 ? 'var(--correct)' : 'var(--wrong)' }}>
                  {result.w1} từ {result.w1 >= MIN_WORDS_1 ? '✓' : '!'}
                </strong>
                <span>Task 1 · tối thiểu {MIN_WORDS_1} từ</span>
              </div>
              <div className="metric">
                <strong style={{ color: result.w2 >= MIN_WORDS_2 ? 'var(--correct)' : 'var(--wrong)' }}>
                  {result.w2} từ {result.w2 >= MIN_WORDS_2 ? '✓' : '!'}
                </strong>
                <span>Task 2 · tối thiểu {MIN_WORDS_2} từ</span>
              </div>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '14px 0 0', lineHeight: 1.65 }}>
              Chế độ: {mode === 'mock' ? 'Thi thử' : 'Luyện tập'} · Kéo xuống dưới để xem AI chấm điểm
              chi tiết từng Task.
            </p>
            {mode === 'mock' && result.t1Sec != null && result.t2Sec != null && (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '8px 0 0', lineHeight: 1.65 }}>
                Thời gian từng Task — Task 1: <span>{fmtClock(result.t1Sec)}</span> · Task 2: <span>{fmtClock(result.t2Sec)}</span>
              </p>
            )}
            {saveFailed && session?.user && (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                Lưu kết quả thất bại — kiểm tra mạng rồi thử lại.
                <button className="btn sm" onClick={() => saveResult(result.durationSec)}>
                  Thử lưu lại
                </button>
              </p>
            )}
          </div>
          <AiScoring test={test} text1={text1} text2={text2} onRedo={retry} getSavedId={getSavedId} isAnonymous={sessionStatus === 'unauthenticated'} />
        </>
      )}

      <div className={`toast${toast ? ' show' : ''}`} role="status">
        {toast}
      </div>
    </main>
  );
}

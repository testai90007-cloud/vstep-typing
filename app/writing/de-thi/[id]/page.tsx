'use client';

// Writing mock test: /writing/de-thi/[id]
// Three states: mode-picker → doing (practice | mock) → result.
// Mock mode mirrors the real VSTEP writing exam: sticky exam bar with a
// prominent countdown, per-task tabs, suggested-time hints, live word
// counters, confirm-before-submit, auto-submit at 0:00 and a beforeunload
// guard so work isn't lost.

import { useEffect, useMemo, useRef, useState } from 'react';
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
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { WRITING_TESTS, type WritingTest } from '@/lib/writing-tests';
import { getAiSettings } from '@/lib/aiKey';
import {
  buildTask1ScorePrompt,
  buildTask2ScorePrompt,
  type WritingScore,
} from '@/lib/writing-score-prompts';

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

const IMPERATIVES = [
  'Tell', 'Say', 'Suggest', 'Ask', 'Recommend', 'Explain', 'Give',
  'Share', 'Describe', 'Include', 'Write',
];

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
    bullets = others.filter(
      (l) => l.trimEnd().endsWith('?') || IMPERATIVES.some((v) => l.startsWith(v + ' '))
    );
    body = others.filter((l) => !bullets.includes(l));
  } else {
    const rest = lines.slice(1);
    taskLine = rest.find((l) => /^discuss/i.test(l.trimStart()));
    body = rest.filter((l) => l !== taskLine);
  }

  return (
    <div className="prompt-card">
      <div className="prompt-head">
        <span className="chip">Task {taskNo}</span>
        <strong>{part.type}</strong>
      </div>
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
          <>
            <span className="spinner" aria-hidden />
            <span className="score-card-hint">Đang chấm…</span>
          </>
        )}
        {state.status === 'done' && state.data && (
          <>
            <div className="score-num" style={{ color: scoreColor(state.data.overall_score) }}>
              {fmtScore(state.data.overall_score)}<small>/10</small>
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
              {copied ? 'Đã sao chép ✓' : 'Sao chép prompt'}
            </button>
          </div>
        </div>
        <div className="detail-overall" style={{ color: scoreColor(data.overall_score) }}>
          {fmtScore(data.overall_score)}<small>/10</small>
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
                {String(c.score).replace('.', ',')}
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
 * AI scoring for the two writing tasks. Scores Task 1 first, then Task 2,
 * revealing each part's score card as soon as it arrives.
 */
function AiScoring({ test, text1, text2, onRedo }: { test: WritingTest; text1: string; text2: string; onRedo: () => void }) {
  const [parts, setParts] = useState<[PartScore, PartScore]>([freshPartScore(), freshPartScore()]);
  const [detailTab, setDetailTab] = useState<1 | 2>(1);
  const [essaySubTab, setEssaySubTab] = useState<'essay' | 'prompt'>('essay');
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const startAll = () => {
    setParts([freshPartScore(), freshPartScore()]);
    (async () => {
      await scoreOne(1, text1);
      await scoreOne(2, text2);
    })();
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!getAiSettings().apiKey) {
      setParts([
        { ...freshPartScore(), status: 'nokey' },
        { ...freshPartScore(), status: 'nokey' },
      ]);
      return;
    }
    startAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finished = parts.every((p) => ['done', 'error', 'skipped'].includes(p.status));
  const hasKey = parts.some((p) => p.status !== 'nokey');

  const s1 = parts[0].status === 'done' ? parts[0].data : null;
  const s2 = parts[1].status === 'done' ? parts[1].data : null;
  const bothDone = !!s1 && !!s2;
  const total = bothDone ? Math.round(((s1!.overall_score + s2!.overall_score * 2) / 3) * 10) / 10 : 0;
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

      <div className="score-cards">
        <ScoreCard part={1} state={parts[0]} onRetry={() => retryOne(1)} />
        <ScoreCard part={2} state={parts[1]} onRetry={() => retryOne(2)} />
      </div>

      {bothDone && (
        <div className="card-soft total-card">
          <div className="total-label">ĐIỂM WRITING TỔNG</div>
          <div className="total-num" style={{ color: scoreColor(total) }}>{fmtScore(total)}</div>
          <div className="total-formula">Công thức: (Part 1 + Part 2 × 2) / 3</div>
        </div>
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
                Nhận xét còn chung chung? Ấn <strong>Sao chép prompt</strong> rồi hỏi thêm ChatGPT, Gemini, Claude…
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
                    <span className="tab-score" style={{ color: active ? '#fff' : scoreColor(d.overall_score) }}>
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
                <WordCounter words={wordCount(activeEssay)} min={activeMin} />
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
        Điểm AI chỉ mang tính tham khảo theo prompt chấm bạn đã cung cấp.
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
      />
      <div className="write-meta">
        <WordCounter words={words} min={min} />
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
  const test = useMemo(() => WRITING_TESTS.find((t) => t.id === id), [id]);
  const { data: session } = useSession();

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
  const [result, setResult] = useState<{ durationSec: number; w1: number; w2: number; auto: boolean } | null>(null);

  const timerRef = useRef<{ start: number; total: number } | null>(null);
  const startStamp = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

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

  // --- beforeunload guard while a mock test is in progress --------------------
  useEffect(() => {
    if (stage !== 'doing' || mode !== 'mock') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [stage, mode]);

  async function saveResult(durationSec: number) {
    if (!test) return;
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
      }
    } catch {
      /* offline / db down — the test itself still works */
    }
  }

  function finish(auto: boolean) {
    if (finishedRef.current || !test) return;
    finishedRef.current = true;
    timerRef.current = null;
    const dur = startStamp.current ? Math.round((Date.now() - startStamp.current) / 1000) : 0;
    setResult({ durationSec: dur, w1: wordCount(text1), w2: wordCount(text2), auto });
    setAutoSubmitted(auto);
    setConfirming(false);
    setStage('result');
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
    setText1('');
    setText2('');
    setTab(1);
    setResult(null);
    setMode(m);
    if (m === 'practice') {
      startStamp.current = Date.now();
    }
    setStage('doing');
    window.scrollTo({ top: 0 });
  }

  function retry() {
    setStage('pick');
    setResult(null);
    window.scrollTo({ top: 0 });
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
        <Link href="/writing" className="back">
          <ArrowLeftIcon width={16} height={16} />
          {stage === 'doing' ? 'Thoát (bài làm sẽ mất)' : 'Chọn đề khác'}
        </Link>
      </div>

      {/* ============================ MODE PICKER ============================ */}
      {stage === 'pick' && (
        <>
          <h1 className="brand" style={{ fontSize: '2rem' }}>
            {test.title} <span className="hl">· Writing</span>
          </h1>
          <p className="lead">
            Task 1 · Informal Email (tối thiểu 120 từ) + Task 2 · Essay (tối thiểu 250 từ) — {test.timeMin} phút như thi thật.
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
              Không giới hạn thời gian
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
                saveResult(dur);
                showToast(session?.user ? 'Đã lưu bài!' : 'Xong! Đăng nhập để lưu tiến bộ nhé.');
                window.scrollTo({ top: 0 });
              }}
            >
              <CheckCircleIcon width={16} height={16} />
              Lưu bài
            </button>
          </div>

          <TaskBottomBar tab={tab} setTab={setTab} />
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
                <button className="btn primary" onClick={() => setConfirming(true)}>
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

          <TaskBottomBar tab={tab} setTab={setTab} />

          {confirming && (
            <div className="modal-overlay" onClick={() => setConfirming(false)}>
              <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Xác nhận nộp bài">
                <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px' }}>Nộp bài thi thử?</p>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 18px', lineHeight: 1.65 }}>
                  Task 1: {words1} từ · Task 2: {words2} từ · còn {fmtClock(timeLeft)}. Bạn chắc chắn muốn nộp bài?
                </p>
                <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setConfirming(false)}>
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
          </div>
          <AiScoring test={test} text1={text1} text2={text2} onRedo={retry} />
        </>
      )}

      <div className={`toast${toast ? ' show' : ''}`} role="status">
        {toast}
      </div>
    </main>
  );
}

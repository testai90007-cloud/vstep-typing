'use client';

// Reading test player: /reading/[id]
// Flow: read 4 passages → answer 40 A/B/C/D → 60-min timer → submit →
// auto-score → review with correct answers.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { READING_TESTS } from '@/lib/reading-tests';

const LETTERS = ['A', 'B', 'C', 'D'];
const TOTAL_MIN = 60;

function fmtTime(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ReadingPlayerPage() {
  const params = useParams();
  const test = useMemo(
    () => READING_TESTS.find((t) => t.id === params.id),
    [params.id]
  );

  const [part, setPart] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(TOTAL_MIN * 60);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<'pick' | 'practice' | 'mock'>('pick');
  /** practice mode: parts whose answers were checked immediately */
  const [checkedParts, setCheckedParts] = useState<Record<number, boolean>>({});
  const submittedRef = useRef(false);
  const { data: session } = useSession();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'skipped' | 'error'>('idle');
  // Set when the user picks a mode (practice/mock) — NOT on mount, so idle
  // time on the mode-picker screen never inflates the recorded duration.
  const startRef = useRef<number | null>(null);
  /** Unfinished attempt found in storage — shown AFTER the user picks a
   * mode, never before (no prompt blocking the mode picker). */
  const [pendingDraft, setPendingDraft] = useState<{
    answers: Record<number, number>;
    mode?: string;
    part?: number;
  } | null>(null);
  /** Whether the resume card was answered: 'restored' | 'dismissed' | null. */
  const [resumeHandled, setResumeHandled] = useState<'restored' | 'dismissed' | null>(null);
  /** One-shot notice after a draft restore (discloses the mock clock reset). */
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  /** Inline submit confirmation when questions are unanswered (no confirm()). */
  const [submitConfirm, setSubmitConfirm] = useState(false);
  /** Question palette in the sticky bar — collapsed by default on narrow screens. */
  const [paletteOpen, setPaletteOpen] = useState(true);

  // Question counts derived from the data — no hardcoded 4×10 / 40.
  const partOffsets = useMemo(() => {
    const offs: number[] = [];
    let acc = 0;
    for (const p of test?.parts ?? []) {
      offs.push(acc);
      acc += p.questions.length;
    }
    return offs;
  }, [test]);
  const total = useMemo(
    () => (test?.parts ?? []).reduce((a, p) => a + p.questions.length, 0),
    [test]
  );
  /** Global question number (1-based) from part index + question index. */
  const qNum = (partIdx: number, qIdx: number) => (partOffsets[partIdx] ?? 0) + qIdx + 1;
  /** Part index that contains global question number `num` (1-based). */
  const partOf = (num: number) => {
    let idx = 0;
    for (let i = 0; i < partOffsets.length; i++) {
      if (partOffsets[i] <= num - 1) idx = i;
      else break;
    }
    return idx;
  };
  const answeredCount = Object.keys(answers).length;

  const draftKey = test ? `vstep_reading_draft_${test.id}` : null;

  const doSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    window.scrollTo({ top: 0 });
  }, []);

  /** Pick a mode AND start the duration clock (mode-picker time excluded). */
  const pickMode = (m: 'practice' | 'mock') => {
    setMode(m);
    startRef.current = Date.now();
  };

  // Autosave: persist answers + mode + part to localStorage while the
  // attempt is live, so a refresh/close doesn't lose up to 60 min of work.
  // Suppressed while the resume card is unanswered, and while a dismissed
  // draft is still intact with no fresh answers yet — otherwise autosave
  // would silently overwrite the kept draft with empty answers.
  useEffect(() => {
    if (!test || !draftKey || submitted || mode === 'pick') return;
    if (pendingDraft && resumeHandled == null) return;
    if (
      pendingDraft &&
      resumeHandled === 'dismissed' &&
      Object.keys(answers).length === 0
    )
      return;
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ answers, mode, part, savedAt: Date.now() })
      );
    } catch {
      /* storage full/blocked — the attempt continues in memory */
    }
  }, [test, draftKey, submitted, mode, answers, part, pendingDraft, resumeHandled]);

  // Palette: collapsed by default on narrow screens (the full 40-button
  // palette would otherwise eat ~1/3 of the viewport).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const apply = () => setPaletteOpen(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // On mount: load any unfinished attempt into state. The resume card is
  // rendered only after the user picks a mode — never as a blocking prompt
  // before the mode picker, and never deleting the draft on dismiss.
  useEffect(() => {
    setPendingDraft(null);
    setResumeHandled(null);
    setRestoreNotice(null);
    setSubmitConfirm(false);
    if (!test || !draftKey) return;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(draftKey);
    } catch {
      /* ignore */
    }
    if (!raw) return;
    let draft: { answers?: Record<number, number>; mode?: string; part?: number } | null = null;
    try {
      draft = JSON.parse(raw);
    } catch {
      /* corrupt draft — drop it */
    }
    if (!draft || !draft.answers || Object.keys(draft.answers).length === 0) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      return;
    }
    setPendingDraft({ ...draft, answers: draft.answers ?? {} });
    // Runs once per test id — draftKey covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // A submitted attempt is done — its draft must never come back.
  useEffect(() => {
    if (submitted && draftKey) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
  }, [submitted, draftKey]);

  /** Reset everything and go back to the mode picker (same test). */
  const handleRetake = () => {
    submittedRef.current = false;
    setSubmitted(false);
    setAnswers({});
    setCheckedParts({});
    setTimeLeft(TOTAL_MIN * 60);
    setSaveState('idle');
    setPart(0);
    setPendingDraft(null);
    setResumeHandled(null);
    setRestoreNotice(null);
    setSubmitConfirm(false);
    startRef.current = null;
    setMode('pick');
    if (draftKey) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (!test || submitted || mode !== 'mock') return;
    if (timeLeft <= 0) {
      doSubmit();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, submitted, test, doSubmit, mode]);

  const handleSubmit = () => {
    const missing = total - answeredCount;
    if (missing > 0 && !submitConfirm) {
      // Show the inline confirmation card instead of window.confirm().
      setSubmitConfirm(true);
      return;
    }
    setSubmitConfirm(false);
    doSubmit();
  };

  /** Resume the kept draft: restore answers + part, keep the mode the user
   * just picked. The mock clock is NOT restored — it restarts at 60:00, and
   * the notice says so. */
  const handleResumeDraft = () => {
    if (!pendingDraft) return;
    setAnswers(pendingDraft.answers);
    if (typeof pendingDraft.part === 'number') setPart(pendingDraft.part);
    setResumeHandled('restored');
    setPendingDraft(null);
    setRestoreNotice(
      mode === 'mock'
        ? 'Đã khôi phục bản nháp. Đồng hồ thi thử đã đặt lại 60:00.'
        : 'Đã khôi phục bản nháp.'
    );
  };

  /** Explicit restart: the ONLY path that deletes the draft. */
  const handleRestartFresh = () => {
    if (draftKey) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
    setPendingDraft(null);
    setResumeHandled('dismissed');
    setAnswers({});
    setPart(0);
  };

  /** Dismiss the resume card — the draft stays in storage untouched. */
  const handleDismissResume = () => {
    setResumeHandled('dismissed');
  };

  /** Practice mode: redo a checked part — clear its answers and un-check it. */
  const handleRetryPart = () => {
    const partQuestions = test?.parts[part]?.questions ?? [];
    setAnswers((a) => {
      const next = { ...a };
      partQuestions.forEach((_, qi) => {
        delete next[qNum(part, qi)];
      });
      return next;
    });
    setCheckedParts((c) => ({ ...c, [part]: false }));
  };

  // Persist the result. The server response is checked honestly: only an
  // actual OK + saved:true counts as "saved". A 401 means the login didn't
  // reach the server (skipped); anything else is a real failure with retry.
  const doSave = useCallback(async () => {
    if (!test) return;
    if (!session?.user) {
      setSaveState('skipped');
      return;
    }
    setSaveState('saving');
    let score = 0;
    test.parts.forEach((p, pi) => {
      p.questions.forEach((q, qi) => {
        if (answers[qNum(pi, qi)] === q.answer) score += 1;
      });
    });
    const durationSec = startRef.current
      ? Math.round((Date.now() - startRef.current) / 1000)
      : 0;
    try {
      const res = await fetch('/api/reading/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: test.id,
          score,
          total,
          durationSec,
          answers,
          mode,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setSaveState('skipped');
        return;
      }
      if (res.ok && data?.saved !== false) {
        setSaveState('saved');
        return;
      }
      setSaveState('error');
    } catch {
      setSaveState('error');
    }
  }, [test, session, answers, total, mode]);

  // Save result once after submit (logged-in users only).
  useEffect(() => {
    if (!submitted || !test || saveState !== 'idle') return;
    doSave();
  }, [submitted, test, saveState, doSave]);

  const scrollToQ = (num: number) => {
    document.getElementById(`rq-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const paletteButtons = (className: string, style?: React.CSSProperties) => (
    <div className={className} style={style}>
      {Array.from({ length: total }, (_, i) => i + 1).map((num) => {
        const done = answers[num] != null;
        // jump to the right part when clicking a question from another part
        const targetPart = partOf(num);
        return (
          <button
            key={num}
            className={`palette-btn${done ? ' done' : ''}`}
            title={`Câu ${num}${done ? ' (đã trả lời)' : ''}`}
            onClick={() => {
              if (!submitted && targetPart !== part) setPart(targetPart);
              // wait a tick for the part to render before scrolling
              setTimeout(() => scrollToQ(num), 60);
            }}
          >
            {num}
          </button>
        );
      })}
    </div>
  );

  if (!test) {
    return (
      <main className="page">
        <div className="nav-top">
          <Link href="/reading" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Danh sách đề
          </Link>
        </div>
        <p>Không tìm thấy đề này.</p>
      </main>
    );
  }

  // ------------------------------ REVIEW ------------------------------
  if (submitted) {
    let score = 0;
    const perPart: { correct: number; total: number }[] = [];
    test.parts.forEach((p, pi) => {
      let c = 0;
      p.questions.forEach((q, qi) => {
        if (answers[qNum(pi, qi)] === q.answer) c += 1;
      });
      perPart.push({ correct: c, total: p.questions.length });
      score += c;
    });
    const pct = Math.round((score / total) * 100);

    return (
      <main className="page">
        <div className="nav-top">
          <Link href="/reading" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Danh sách đề
          </Link>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <span className="icon-badge" style={{ margin: '0 auto 10px' }}>
            <CheckCircleIcon width={26} height={26} />
          </span>
          <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Kết quả · {test.title}
          </p>
          <p style={{ margin: 0, fontSize: '2.6rem', fontWeight: 800 }}>
            {score}
            <span style={{ color: 'var(--muted)', fontSize: '1.4rem' }}>/{total}</span>
          </p>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}><span>{pct}%</span> câu đúng</p>
          <div style={{ maxWidth: 340, margin: '18px auto 0', textAlign: 'left' }}>
            {perPart.map((p, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span>Part {i + 1}</span>
                  <span style={{ color: 'var(--muted)' }}>
                    {p.correct}/{p.total}
                  </span>
                </div>
                <div className="score-bar">
                  <div style={{ width: `${(p.correct / p.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="btn primary" onClick={handleRetake}>
              Làm lại đề này
            </button>
            <Link href="/reading" className="btn" style={{ textDecoration: 'none' }}>
              Đề khác
            </Link>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '14px 0 0' }}>
            {saveState === 'saved' && 'Đã lưu vào tiến bộ của bạn.'}
            {saveState === 'saving' && 'Đang lưu…'}
            {saveState === 'skipped' && 'Đăng nhập bằng Google để lưu kết quả.'}
            {saveState === 'error' && (
              <>
                Lưu thất bại.{' '}
                <button
                  type="button"
                  onClick={doSave}
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

        <h2 className="section-title">Xem lại bài làm</h2>
        {test.parts.map((p, pi) => (
          <section key={pi} style={{ marginTop: 18 }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.05rem' }}>
              Part {pi + 1} · {p.title}
            </h3>
            <div className="read-split" style={{ marginTop: 10 }}>
              <div className="card read-passage">
                {p.paragraphs.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
              <div>
                {p.questions.map((q, qi) => {
                  const num = qNum(pi, qi);
                  const chosen = answers[num];
                  const correct = chosen === q.answer;
                  return (
                    <div key={qi} className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
                      <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                        <span style={{ color: 'var(--muted)' }}>{num}.</span>
                        <span style={{ flex: 1 }}>{q.q}</span>
                        <span
                          className="chip"
                          style={
                            correct
                              ? { background: 'var(--correct-soft)', color: 'var(--correct)' }
                              : { background: 'var(--wrong-soft)', color: 'var(--wrong)' }
                          }
                        >
                          {correct ? (
                            <>
                              <CheckCircleIcon width={12} height={12} /> Đúng
                            </>
                          ) : (
                            <>
                              <XCircleIcon width={12} height={12} /> Sai
                            </>
                          )}
                        </span>
                      </p>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {q.options.map((opt, oi) => {
                          const isAnswer = oi === q.answer;
                          const isChosen = oi === chosen;
                          const cls = `opt-card${isAnswer ? ' correct' : ''}${!isAnswer && isChosen ? ' wrong-pick' : ''}`;
                          return (
                            <div key={oi} className={cls} style={{ cursor: 'default' }}>
                              <span className="letter">{LETTERS[oi]}</span>
                              <span>{opt}</span>
                              {isAnswer && (
                                <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--correct)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <CheckIcon width={13} height={13} />
                                  đáp án đúng
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </main>
    );
  }

  // ------------------------------ MODE PICKER ------------------------------
  if (mode === 'pick') {
    return (
      <main className="page">
        <div className="nav-top">
          <Link href="/reading" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Danh sách đề
          </Link>
        </div>
        <h1 className="brand" style={{ fontSize: '1.9rem' }}>
          {test.title} <span className="hl">· Reading</span>
        </h1>
        <p className="lead">
          {test.parts.length} bài đọc · {total} câu hỏi · {TOTAL_MIN} phút như thi thật.
        </p>
        {pendingDraft && (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 8 }}>
            Có bài đang làm dở ({Object.keys(pendingDraft.answers).length} câu đã trả lời) —
            chọn chế độ rồi quyết định tiếp tục hay bắt đầu lại.
          </p>
        )}
        <div className="mode-cards">
          <button className="card lift mode-card" onClick={() => pickMode('practice')}>
            <span className="icon-badge">
              <BookOpenIcon width={24} height={24} strokeWidth={1.6} />
            </span>
            <strong>Luyện tập</strong>
            <span className="chip">Đọc từng bài thoải mái</span>
            <p>
              Trả lời từng Part rồi bấm Kiểm tra để xem đúng/sai ngay. Không giới hạn
              thời gian, đọc kỹ từng đoạn văn.
            </p>
          </button>
          <button className="card lift mode-card" onClick={() => pickMode('mock')}>
            <span className="icon-badge">
              <FlagIcon width={24} height={24} strokeWidth={1.6} />
            </span>
            <strong>Thi thử</strong>
            <span className="chip accent">Đúng {TOTAL_MIN} phút như thi thật</span>
            <p>
              Làm cả {test.parts.length} bài một mạch, hết giờ tự động nộp — không xem đáp án trước khi
              nộp bài.
            </p>
          </button>
        </div>
      </main>
    );
  }

  // ------------------------------ DOING ------------------------------
  const active = test.parts[part];
  const partChecked = mode === 'practice' && !!checkedParts[part];

  return (
    <main className="page">
      <div className="sticky-player-bar">
        <div className="nav-top" style={{ marginBottom: 8 }}>
          <Link href="/reading" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Danh sách đề
          </Link>
          {mode === 'mock' && (
            <span className={`timer-pill${timeLeft < 300 ? ' danger' : ''}`}>
              <ClockIcon width={17} height={17} />
              {fmtTime(timeLeft)}
            </span>
          )}
          {mode === 'practice' && (
            <span className="chip">Luyện tập</span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: '1.1rem', fontWeight: 800 }}>{test.title}</strong>
          <button
            className="btn"
            onClick={() => setPaletteOpen((o) => !o)}
            aria-expanded={paletteOpen}
            aria-label={paletteOpen ? 'Ẩn bảng câu hỏi' : 'Hiện bảng câu hỏi'}
          >
            {paletteOpen ? 'Ẩn bảng câu hỏi' : 'Hiện bảng câu hỏi'}
          </button>
          <button className="btn primary" onClick={handleSubmit}>
            <CheckIcon width={16} height={16} />
            {mode === 'mock' ? <>Nộp bài (<span>{answeredCount}/{total}</span>)</> : <>Hoàn thành (<span>{answeredCount}/{total}</span>)</>}
          </button>
        </div>
        {paletteOpen && (
          <div id="reading-palette">{paletteButtons('palette palette-inbar', { marginTop: 10 })}</div>
        )}
      </div>

      {/* Resume card — shown only after a mode is picked, never before. */}
      {pendingDraft && resumeHandled == null && (
        <div className="card" role="dialog" aria-label="Khôi phục bản nháp" style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>
            Có bài đang làm dở. Tiếp tục bài đang làm dở?
          </p>
          <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Bản nháp gồm {Object.keys(pendingDraft.answers).length} câu đã trả lời.
          </p>
          <div className="btn-row">
            <button className="btn primary" onClick={handleResumeDraft}>
              Tiếp tục bản nháp
            </button>
            <button className="btn" onClick={handleRestartFresh}>
              Bắt đầu lại (xóa bản nháp)
            </button>
            <button className="btn" onClick={handleDismissResume}>
              Để sau
            </button>
          </div>
        </div>
      )}
      {restoreNotice && (
        <p
          role="status"
          className="card-soft"
          style={{
            marginTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            fontSize: '0.9rem',
          }}
        >
          <span>{restoreNotice}</span>
          <button
            type="button"
            onClick={() => setRestoreNotice(null)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              fontWeight: 700,
              color: 'inherit',
              cursor: 'pointer',
              textDecoration: 'underline',
              flexShrink: 0,
            }}
          >
            Đóng
          </button>
        </p>
      )}
      {submitConfirm && (
        <div className="card" role="dialog" aria-label="Xác nhận nộp bài" style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 14px' }}>
            Bạn còn {total - answeredCount} câu chưa trả lời.{' '}
            {mode === 'mock' ? 'Nộp bài' : 'Hoàn thành'} ngay?
          </p>
          <div className="btn-row">
            <button
              className="btn primary"
              onClick={() => {
                setSubmitConfirm(false);
                doSubmit();
              }}
            >
              {mode === 'mock' ? 'Nộp bài' : 'Hoàn thành'}
            </button>
            <button className="btn" onClick={() => setSubmitConfirm(false)}>
              Tiếp tục làm
            </button>
          </div>
        </div>
      )}

      <div className="listen-layout">
        <div className="listen-main">
          <div className="seg" role="tablist" aria-label="Chọn bài đọc">
            {test.parts.map((p, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={part === i}
                className={part === i ? 'active' : ''}
                onClick={() => setPart(i)}
              >
                <BookOpenIcon width={16} height={16} />
                Part {i + 1}
              </button>
            ))}
          </div>

          <div className="read-split" style={{ marginTop: 14 }}>
            <div className="card read-passage">
              <h2 style={{ margin: '0 0 12px', fontSize: '1.15rem', fontWeight: 800 }}>
                {active.title}
              </h2>
              {active.paragraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            <div>
              {active.questions.map((q, qi) => {
                const num = qNum(part, qi);
                const chosen = answers[num];
                const correct = chosen === q.answer;
                return (
                  <div key={num} id={`rq-${num}`} className="card" style={{ marginBottom: 10, padding: '14px 16px', scrollMarginTop: 320 }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                      <span style={{ color: 'var(--accent-strong)', flexShrink: 0 }}>{num}.</span>
                      <span style={{ flex: 1 }}>{q.q}</span>
                      {partChecked && (
                        <span
                          className="chip"
                          style={correct
                            ? { background: 'var(--correct-soft)', color: 'var(--correct)' }
                            : { background: 'var(--wrong-soft)', color: 'var(--wrong)' }}
                        >
                          {correct
                            ? <><CheckCircleIcon width={12} height={12} /> Đúng</>
                            : <><XCircleIcon width={12} height={12} /> Sai</>}
                        </span>
                      )}
                    </p>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {q.options.map((opt, oi) => {
                        if (partChecked) {
                          const isAnswer = oi === q.answer;
                          const isChosen = oi === chosen;
                          const cls = `opt-card${isAnswer ? ' correct' : ''}${!isAnswer && isChosen ? ' wrong-pick' : ''}`;
                          return (
                            <div key={oi} className={cls} style={{ cursor: 'default' }}>
                              <span className="letter">{LETTERS[oi]}</span>
                              <span>{opt}</span>
                              {isAnswer && (
                                <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--correct)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <CheckIcon width={13} height={13} />
                                  đáp án đúng
                                </span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <button
                            key={oi}
                            className={`opt-card${chosen === oi ? ' selected' : ''}`}
                            onClick={() => setAnswers((a) => ({ ...a, [num]: oi }))}
                          >
                            <span className="letter">{LETTERS[oi]}</span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {mode === 'practice' && !partChecked && (
                <button
                  className="btn"
                  style={{ marginTop: 4 }}
                  onClick={() => setCheckedParts((c) => ({ ...c, [part]: true }))}
                >
                  <CheckIcon width={16} height={16} />
                  Kiểm tra Part {part + 1}
                </button>
              )}
              {mode === 'practice' && partChecked && (
                <button className="btn" style={{ marginTop: 4 }} onClick={handleRetryPart}>
                  Làm lại phần này
                </button>
              )}
            </div>
          </div>
        </div>
        <aside className="listen-side">
          <div className="card">
            <div className="listen-side-head">
              <strong>Câu hỏi</strong>
              <span><span>{answeredCount}/{total}</span> đã trả lời</span>
            </div>
            {paletteButtons('palette palette-vertical')}
            <button className="btn primary" onClick={handleSubmit} style={{ width: '100%', marginTop: 14 }}>
              <CheckIcon width={16} height={16} />
              {mode === 'mock' ? 'Nộp bài' : 'Hoàn thành'}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

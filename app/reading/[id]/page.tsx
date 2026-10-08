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

/** Global question number (1-40) from part index + question index. */
const qNum = (partIdx: number, qIdx: number) => partIdx * 10 + qIdx + 1;

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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'skipped'>('idle');
  const startRef = useRef(Date.now());

  const total = 40;
  const answeredCount = Object.keys(answers).length;

  const doSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    window.scrollTo({ top: 0 });
  }, []);

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
    if (missing > 0) {
      const ok = window.confirm(`Bạn còn ${missing} câu chưa trả lời. Nộp bài ngay?`);
      if (!ok) return;
    }
    doSubmit();
  };

  // Save result once after submit (logged-in users only).
  useEffect(() => {
    if (!submitted || !test || saveState !== 'idle') return;
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
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    fetch('/api/reading/save', {
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
    })
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('skipped'));
  }, [submitted, test, session, saveState, answers, total, mode]);

  const scrollToQ = (num: number) => {
    document.getElementById(`rq-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const paletteButtons = (className: string, style?: React.CSSProperties) => (
    <div className={className} style={style}>
      {Array.from({ length: total }, (_, i) => i + 1).map((num) => {
        const done = answers[num] != null;
        // jump to the right part when clicking a question from another part
        const targetPart = Math.floor((num - 1) / 10);
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
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>{pct}% câu đúng</p>
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
            <Link href="/reading" className="btn" style={{ textDecoration: 'none' }}>
              Đề khác
            </Link>
          </div>
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
          4 bài đọc · {total} câu hỏi · {TOTAL_MIN} phút như thi thật.
        </p>
        <div className="mode-cards">
          <button className="card lift mode-card" onClick={() => setMode('practice')}>
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
          <button className="card lift mode-card" onClick={() => setMode('mock')}>
            <span className="icon-badge">
              <FlagIcon width={24} height={24} strokeWidth={1.6} />
            </span>
            <strong>Thi thử</strong>
            <span className="chip accent">Đúng {TOTAL_MIN} phút như thi thật</span>
            <p>
              Làm cả 4 bài một mạch, hết giờ tự động nộp — không xem đáp án trước khi
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
      <div
        style={{
          position: 'sticky',
          top: 57,
          zIndex: 20,
          background: 'var(--bg)',
          padding: '10px 0',
          borderBottom: '1px solid var(--line)',
          marginBottom: 18,
        }}
      >
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
          <button className="btn primary" onClick={handleSubmit}>
            <CheckIcon width={16} height={16} />
            {mode === 'mock' ? `Nộp bài (${answeredCount}/${total})` : `Hoàn thành (${answeredCount}/${total})`}
          </button>
        </div>
        {paletteButtons('palette palette-inbar', { marginTop: 10 })}
      </div>

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
                  <div key={num} id={`rq-${num}`} className="card" style={{ marginBottom: 10, padding: '14px 16px', scrollMarginTop: 210 }}>
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
            </div>
          </div>
        </div>
        <aside className="listen-side">
          <div className="card">
            <div className="listen-side-head">
              <strong>Câu hỏi</strong>
              <span>{answeredCount}/{total} đã trả lời</span>
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

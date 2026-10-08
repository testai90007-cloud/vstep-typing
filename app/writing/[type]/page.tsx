'use client';

// Practice screen: /writing/[type]
// Features ported from the original page + new ones:
//  - Scope "Từng phần" (section-by-section) vs "Toàn bài" (whole essay)
//  - "Đếm ngược toàn bài" countdown (6-12 min): starts on first keystroke,
//    keeps running across sections/retries, stops only when everything is done
//  - "Tự nhớ" from-memory mode (hold "Xem gợi ý" to peek)
//  - Error-word drill: words mistyped during the session become a drill list
//  - "Chế độ thi thử" exam mode: whole essay, hidden reference, auto-submit
//  - Dark mode toggle, "Xem ví dụ điền sẵn" filled example
//  - On completion: POST result to /api/writing/save

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  MoonIcon,
  SunIcon,
  ArrowPathIcon,
  LightBulbIcon,
  ClockIcon,
  CheckIcon,
  CheckCircleIcon,
  FlagIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  ChevronRightIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { TEMPLATES, getTemplate, wholeText, type WritingTemplate } from '@/lib/templates';
import { getExample } from '@/lib/examples';

type Scope = 'whole' | 'sections';
type Mode = 'follow' | 'memory';

// --- small helpers -----------------------------------------------------------

function stripWord(w: string): string {
  return w.replace(/^[^A-Za-zÀ-ỹ0-9…]+|[^A-Za-zÀ-ỹ0-9…]+$/g, '');
}

/** Target word containing char position `pos` (used for the error-word drill). */
function wordAt(text: string, pos: number): string {
  let s = pos;
  let e = pos;
  while (s > 0 && !/\s/.test(text[s - 1])) s--;
  while (e < text.length && !/\s/.test(text[e])) e++;
  return stripWord(text.slice(s, e));
}

/** Render [PLACEHOLDERS] with the highlight style. */
function renderRich(text: string) {
  return text.split(/(\[[^\]]+\])/g).map((p, i) =>
    /^\[[^\]]+\]$/.test(p) ? (
      <span key={i} className="placeholder">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

interface Analysis {
  accuracy: number;
  progress: number;
  firstError: number;
  over: boolean;
  isDone: boolean;
}

function analyze(typed: string, target: string): Analysis {
  const compared = Math.min(typed.length, target.length);
  let correct = 0;
  let firstError = -1;
  for (let i = 0; i < compared; i++) {
    if (typed[i] === target[i]) correct++;
    else if (firstError === -1) firstError = i;
  }
  return {
    accuracy: typed.length ? Math.round((correct / typed.length) * 100) : 100,
    progress: Math.min(100, Math.round((typed.length / target.length) * 100)),
    firstError,
    over: typed.length > target.length,
    isDone: typed === target && target.length > 0,
  };
}

// --- component ---------------------------------------------------------------

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();
  const typeId = Array.isArray(params.type) ? params.type[0] : params.type;
  const template: WritingTemplate | undefined = getTemplate(typeId || '');
  const example = getExample(typeId || '');

  const [scope, setScope] = useState<Scope>('whole');
  const [mode, setMode] = useState<Mode>('follow');
  const [exam, setExam] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [sectionTexts, setSectionTexts] = useState<string[]>([]);
  const [wholeTyped, setWholeTyped] = useState('');
  const [durationMin, setDurationMin] = useState(8);
  const [timeLeft, setTimeLeft] = useState(8 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [expired, setExpired] = useState(false);
  const [completed, setCompleted] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [errorWords, setErrorWords] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState('');
  const [dbNote, setDbNote] = useState(false);
  const [finalStats, setFinalStats] = useState({ accuracy: 0, durationSec: 0, words: 0 });
  // error-word drill
  const [drillList, setDrillList] = useState<string[]>([]);
  const [drillIdx, setDrillIdx] = useState(0);
  const [drillInput, setDrillInput] = useState('');
  const [drillDone, setDrillDone] = useState(false);

  const timerRef = useRef<{ start: number; total: number } | null>(null);
  const startStamp = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const errorWordsRef = useRef<string[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitRef = useRef<() => void>(() => {});

  errorWordsRef.current = errorWords;

  const nSections = template?.sections.length || 0;
  const wholeTarget = template ? wholeText(template) : '';

  // init per-template state
  useEffect(() => {
    if (!template) return;
    setSectionTexts(new Array(template.sections.length).fill(''));
    setCompleted(new Array(template.sections.length).fill(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId]);

  // dark mode
  useEffect(() => {
    const s = localStorage.getItem('vstep-theme');
    if (s === 'dark' || s === 'light') setDark(s === 'dark');
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('vstep-theme', dark ? 'dark' : 'light');
  }, [dark]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }

  // --- timer -----------------------------------------------------------------
  function resetTimer(totalMin: number) {
    timerRef.current = null;
    startStamp.current = null;
    setTimerActive(false);
    setExpired(false);
    setTimeLeft(totalMin * 60);
  }

  function ensureTimerStarted() {
    if (timerRef.current || expired || finishedRef.current) return;
    timerRef.current = { start: Date.now(), total: durationMin * 60 };
    startStamp.current = Date.now();
    setTimerActive(true);
  }

  useEffect(() => {
    if (!timerActive) return;
    const id = setInterval(() => {
      const t = timerRef.current;
      if (!t) return;
      const left = Math.max(0, t.total - Math.floor((Date.now() - t.start) / 1000));
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(id);
        timerRef.current = null;
        setTimerActive(false);
        setExpired(true);
      }
    }, 500);
    return () => clearInterval(id);
  }, [timerActive]);

  // --- targets & typing --------------------------------------------------------
  function currentTarget(): string {
    if (!template) return '';
    return scope === 'whole' ? wholeTarget : template.sections[sectionIdx].text;
  }
  function currentTyped(): string {
    return scope === 'whole' ? wholeTyped : sectionTexts[sectionIdx] || '';
  }

  function collectErrorWord(typed: string, target: string) {
    const a = analyze(typed, target);
    if (a.firstError !== -1) {
      const w = wordAt(target, a.firstError);
      if (w && !errorWordsRef.current.includes(w)) {
        setErrorWords((prev) => [...prev, w]);
      }
    }
    return a;
  }

  function handleInput(value: string) {
    if (finishedRef.current) return;
    ensureTimerStarted();
    const target = currentTarget();
    if (scope === 'whole') setWholeTyped(value);
    else {
      setSectionTexts((prev) => {
        const n = [...prev];
        n[sectionIdx] = value;
        return n;
      });
    }
    collectErrorWord(value, target);
  }

  // completion detection
  useEffect(() => {
    if (!template || finishedRef.current) return;
    if (scope === 'whole') {
      if (wholeTyped === wholeTarget && wholeTyped.length > 0) doFinish();
    } else {
      const done = template.sections.map((s, i) => sectionTexts[i] === s.text);
      setCompleted(done);
      if (done.length > 0 && done.every(Boolean)) doFinish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wholeTyped, sectionTexts, scope, template]);

  async function saveResult(accuracy: number, durationSec: number) {
    try {
      const res = await fetch('/api/writing/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template?.id,
          mode: exam ? 'exam' : scope,
          accuracy,
          durationSec,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        showToast('Đăng nhập bằng Google để lưu tiến bộ nhé!');
        return;
      }
      if (data && data.saved === false && data.reason === 'no-database') setDbNote(true);
    } catch {
      /* offline / db down — practice still works */
    }
  }

  function doFinish(overrideTyped?: string, overrideTarget?: string) {
    if (finishedRef.current || !template) return;
    finishedRef.current = true;
    timerRef.current = null;
    setTimerActive(false);
    const target = overrideTarget ?? currentTarget();
    const typed = overrideTyped ?? currentTyped();
    const a = analyze(typed, target);
    const dur = startStamp.current ? Math.round((Date.now() - startStamp.current) / 1000) : 0;
    setFinalStats({
      accuracy: a.accuracy,
      durationSec: dur,
      words: typed.split(/\s+/).filter(Boolean).length,
    });
    setDrillList(errorWordsRef.current);
    setDrillIdx(0);
    setDrillInput('');
    setDrillDone(errorWordsRef.current.length === 0);
    setFinished(true);
    setCompleted(template.sections.map(() => true));
    saveResult(a.accuracy, dur);
    showToast(exam ? 'Đã nộp bài thi thử!' : 'Hoàn thành — rất tốt!');
  }
  submitRef.current = () => doFinish();

  // exam auto-submit on expiry
  useEffect(() => {
    if (expired && exam && !finishedRef.current) submitRef.current();
    else if (expired && !exam) showToast('Hết giờ! Bạn vẫn có thể gõ tiếp.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  // --- actions -----------------------------------------------------------------
  function fullReset(keepScope: Scope) {
    if (!template) return;
    timerRef.current = null;
    startStamp.current = null;
    finishedRef.current = false;
    setWholeTyped('');
    setSectionTexts(new Array(template.sections.length).fill(''));
    setCompleted(new Array(template.sections.length).fill(false));
    setSectionIdx(0);
    setScope(keepScope);
    setErrorWords([]);
    setFinished(false);
    setDrillList([]);
    setDrillIdx(0);
    setDrillInput('');
    setDrillDone(false);
    setDbNote(false);
    resetTimer(durationMin);
  }

  function retryCurrent() {
    if (scope === 'whole') setWholeTyped('');
    else {
      setSectionTexts((prev) => {
        const n = [...prev];
        n[sectionIdx] = '';
        return n;
      });
      setCompleted((prev) => {
        const n = [...prev];
        n[sectionIdx] = false;
        return n;
      });
    }
    // note: the countdown keeps running across retries (by design)
  }

  function changeScope(s: Scope) {
    if (s === scope) return;
    fullReset(s);
    showToast(s === 'whole' ? 'Đã chuyển sang gõ toàn bài' : 'Đã chuyển sang luyện từng phần');
  }

  function changeDuration(min: number) {
    setDurationMin(min);
    // mirror the original page: resetting the clock to the new duration
    timerRef.current = null;
    startStamp.current = null;
    setTimerActive(false);
    setExpired(false);
    setTimeLeft(min * 60);
    showToast(`Đã đặt ${min} phút cho toàn bài`);
  }

  function toggleExam() {
    if (!exam) {
      setExam(true);
      setMode('follow');
      setShowExample(false);
      setScope('whole');
      setTimeout(() => fullReset('whole'), 0);
      showToast('Chế độ thi thử: gõ toàn bài, không xem mẫu. Hết giờ sẽ tự nộp bài.');
    } else {
      setExam(false);
      setTimeout(() => fullReset('whole'), 0);
    }
  }

  function checkDrill() {
    if (drillInput.trim() === drillList[drillIdx]) {
      const next = drillIdx + 1;
      setDrillInput('');
      if (next >= drillList.length) {
        setDrillDone(true);
        showToast('Xong bài luyện từ!');
      } else {
        setDrillIdx(next);
      }
    }
  }

  // --- render ------------------------------------------------------------------
  if (!template) {
    return (
      <main className="page-narrow">
        <div className="nav-top">
          <Link href="/writing" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Chọn bài khác
          </Link>
        </div>
        <div className="card">
          <p>Không tìm thấy bài luyện này.</p>
        </div>
      </main>
    );
  }

  const target = currentTarget();
  const typed = currentTyped();
  const a = analyze(typed, target);
  const examHidden = exam && !finished;
  const memHidden = mode === 'memory' && !revealed && !finished;
  const ex = showExample ? example : undefined;

  const liveMessage = !typed.length
    ? 'Bắt đầu từ câu đầu tiên'
    : a.isDone
      ? 'Hoàn thành chính xác'
      : a.firstError !== -1
        ? `Kiểm tra lại ký tự thứ ${a.firstError + 1}`
        : a.over
          ? 'Bạn đã gõ thừa ký tự'
          : 'Đúng đến đây — tiếp tục nhé';

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/writing" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Chọn bài khác
        </Link>
        <button
          className="icon-btn"
          onClick={() => setDark(!dark)}
          title={dark ? 'Chế độ sáng' : 'Chế độ tối'}
          aria-label={dark ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          {dark ? <SunIcon width={19} height={19} /> : <MoonIcon width={19} height={19} />}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* template bar */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px',
            borderBottom: '1px solid var(--line)', flexWrap: 'wrap',
          }}
        >
          <label htmlFor="tpl" style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <PencilIcon width={15} height={15} />
            Bài luyện
          </label>
          <select
            id="tpl"
            className="select"
            style={{ flex: '1 1 240px', width: 'auto' }}
            value={template.id}
            onChange={(e) => router.push(`/writing/${e.target.value}`)}
          >
            <optgroup label="Writing Task 2">
              {TEMPLATES.filter((t) => t.group === 'task2').map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </optgroup>
            <optgroup label="Writing Task 1 · Letter / Email">
              {TEMPLATES.filter((t) => t.group === 'task1').map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </optgroup>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 700 }}>Phạm vi</span>
            <div className="seg" role="group" aria-label="Chọn phạm vi luyện">
              <button className={scope === 'whole' ? 'active' : ''} onClick={() => changeScope('whole')} disabled={exam}>
                Toàn bài
              </button>
              <button className={scope === 'sections' ? 'active' : ''} onClick={() => changeScope('sections')} disabled={exam}>
                Từng phần
              </button>
            </div>
          </div>
        </div>

        {/* toolbar */}
        <div
          style={{
            display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between',
            padding: '15px 18px', borderBottom: '1px solid var(--line)',
            background: 'var(--paper-soft)', flexWrap: 'wrap',
          }}
        >
          <div className="seg" role="group" aria-label="Chế độ luyện">
            <button className={mode === 'follow' ? 'active' : ''} onClick={() => setMode('follow')} disabled={exam}>
              <PencilSquareIcon width={15} height={15} />
              Gõ theo mẫu
            </button>
            <button className={mode === 'memory' ? 'active' : ''} onClick={() => setMode('memory')} disabled={exam}>
              <LightBulbIcon width={15} height={15} />
              Tự nhớ
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={`btn${exam ? ' primary' : ''}`} onClick={toggleExam}>
              <FlagIcon width={16} height={16} />
              {exam ? 'Thoát thi thử' : 'Chế độ thi thử'}
            </button>
            <button className={`btn${showExample ? ' primary' : ''}`} onClick={() => setShowExample(!showExample)} disabled={exam}>
              <DocumentTextIcon width={16} height={16} />
              {showExample ? 'Ẩn ví dụ' : 'Xem ví dụ điền sẵn'}
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600 }}>
              <ClockIcon width={16} height={16} />
              Đếm ngược toàn bài
              <select className="select" style={{ width: 'auto' }} value={durationMin}
                onChange={(e) => changeDuration(Number(e.target.value))}>
                {[6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>{m} phút</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* work area */}
        <div style={{ padding: 'clamp(20px,4vw,38px)' }}>
          {!finished ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--accent-strong)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  {exam && <span className="chip"><FlagIcon width={12} height={12} /> Thi thử</span>}
                  {scope === 'whole' ? `Toàn bài · ${template.title}` : `Đoạn ${sectionIdx + 1} · ${template.sections[sectionIdx].name}`}
                  {ex ? ' · Ví dụ điền sẵn' : ''}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>
                  {scope === 'whole' ? `${nSections} đoạn` : `${sectionIdx + 1} / ${nSections}`}
                </span>
              </div>

              <div className="type-cols">
                <div>
                  <div className="work-col-head">
                    <span>Mẫu để gõ theo</span>
                  </div>
                  <div className="card-soft" style={{ minHeight: 300 }}>
                {examHidden ? (
                  <p className="reference" style={{ color: 'var(--muted)', fontSize: '1rem' }}>
                    Chế độ thi thử — mẫu được ẩn. Hãy gõ toàn bài từ trí nhớ trong thời gian đếm ngược.
                  </p>
                ) : ex ? (
                  <>
                    <span className="section-label">{ex.topicLabel} (nội dung mẫu, không cần gõ theo)</span>
                    {scope === 'whole' ? (
                      ex.sections.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < ex.sections.length - 1 ? 18 : 0 }}>
                          <span className="section-label">Đoạn {i + 1} · {template.sections[i].name}</span>
                          <p className="reference">{s}</p>
                        </div>
                      ))
                    ) : (
                      <p className="reference">{ex.sections[sectionIdx]}</p>
                    )}
                  </>
                ) : (
                  <p className={`reference${memHidden ? ' memory-hidden' : ''}`}>
                    {scope === 'whole'
                      ? template.sections.map((s, i) => (
                          <span key={i}>
                            <span className="section-label">Đoạn {i + 1} · {s.name}</span>
                            {renderRich(s.text)}
                            {i < template.sections.length - 1 && '\n\n'}
                          </span>
                        ))
                      : renderRich(template.sections[sectionIdx].text)}
                  </p>
                )}
                {memHidden && (
                  <p style={{ color: 'var(--faint)', fontSize: '0.84rem', marginTop: 10 }}>
                    Nhấn giữ nút “Xem gợi ý” bên dưới để hiện mẫu.
                  </p>
                )}
                  </div>
                </div>
                <div>
                  <div className="work-col-head">
                    <label htmlFor="ta">Phần bạn gõ</label>
                    <span className="work-live">
                      {a.isDone && <CheckCircleIcon width={15} height={15} style={{ color: 'var(--correct)' }} />}
                      {liveMessage}
                    </span>
                  </div>
                  <textarea
                    id="ta"
                    style={{ minHeight: 300 }}
                className={`ta${a.firstError !== -1 || a.over ? ' has-error' : ''}${a.isDone ? ' done' : ''}`}
                spellCheck={false} autoComplete="off" autoCapitalize="off"
                placeholder={scope === 'whole' ? 'Gõ toàn bộ bài tại đây…' : 'Bắt đầu gõ tại đây…'}
                value={typed}
                onChange={(e) => handleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (scope === 'sections' && e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    setSectionIdx((sectionIdx + 1) % nSections);
                  }
                }}
              />
                </div>
              </div>

              <div className="metric-grid">
                <div className="metric"><strong>{a.accuracy}%</strong><span>Độ chính xác</span></div>
                <div className="metric"><strong>{a.progress}%</strong><span>Tiến độ</span></div>
                <div className="metric">
                  <strong style={{ color: expired ? 'var(--wrong)' : undefined, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <ClockIcon width={20} height={20} />
                    {fmt(timeLeft)}
                  </strong>
                  <span>Đếm ngược toàn bài · bắt đầu khi gõ{expired ? ' · hết giờ' : ''}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
                <div className="btn-row">
                  <button className="btn" onClick={retryCurrent}>
                    <ArrowPathIcon width={16} height={16} />
                    {scope === 'whole' ? 'Làm lại toàn bài' : 'Làm lại đoạn'}
                  </button>
                  {mode === 'memory' && !exam && (
                    <button
                      className="btn"
                      onMouseDown={() => setRevealed(true)}
                      onMouseUp={() => setRevealed(false)}
                      onMouseLeave={() => setRevealed(false)}
                      onTouchStart={() => setRevealed(true)}
                      onTouchEnd={() => setRevealed(false)}
                    >
                      <LightBulbIcon width={16} height={16} />
                      Xem gợi ý
                    </button>
                  )}
                </div>
                <div className="btn-row">
                  {scope === 'sections' && (
                    <button className="btn" onClick={() => setSectionIdx((sectionIdx + 1) % nSections)}>
                      {sectionIdx === nSections - 1 ? 'Quay về đoạn đầu' : 'Đoạn tiếp theo'}
                      <ChevronRightIcon width={16} height={16} />
                    </button>
                  )}
                  {exam && (
                    <button className="btn primary" onClick={() => submitRef.current()}>
                      <CheckIcon width={16} height={16} />
                      Nộp bài
                    </button>
                  )}
                </div>
              </div>

              {/* section navigator */}
              <div style={{ marginTop: 26 }}>
                <strong style={{ fontSize: '0.9rem' }}>Cấu trúc bài</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {template.sections.map((s, i) => (
                    <button
                      key={i}
                      className="btn"
                      style={{
                        borderColor: completed[i] ? 'var(--correct)' : undefined,
                        opacity: scope === 'sections' && i === sectionIdx ? 1 : 0.85,
                      }}
                      onClick={() => { if (scope === 'sections') setSectionIdx(i); }}
                      disabled={scope !== 'sections'}
                      title={scope === 'sections' ? `Luyện đoạn ${i + 1}` : s.name}
                    >
                      {i + 1}. {s.name}
                      {completed[i] && <CheckIcon width={15} height={15} style={{ color: 'var(--correct)' }} />}
                    </button>
                  ))}
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 12 }}>
                  Gõ chậm và đúng trước. Khi đạt 95% trở lên, hãy chuyển sang <strong>Tự nhớ</strong>.
                  Các phần in màu là chỗ cần thay nội dung theo đề bài.
                </p>
              </div>
            </>
          ) : (
            /* ---- finish panel ---- */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span className="icon-badge">
                  <CheckCircleIcon width={24} height={24} />
                </span>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
                  {exam ? 'Kết quả thi thử' : 'Hoàn thành!'}
                </h2>
              </div>
              <p style={{ color: 'var(--muted)', margin: '0 0 18px' }}>
                {template.title} · {exam ? 'chế độ thi thử' : scope === 'whole' ? 'gõ toàn bài' : 'gõ từng phần'}
              </p>
              <div className="metric-grid" style={{ marginTop: 0 }}>
                <div className="metric"><strong>{finalStats.accuracy}%</strong><span>Độ chính xác</span></div>
                <div className="metric"><strong>{fmt(finalStats.durationSec)}</strong><span>Thời gian gõ</span></div>
                <div className="metric"><strong>{finalStats.words}</strong><span>Số từ đã gõ</span></div>
              </div>
              {dbNote && (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  Chưa lưu được kết quả (thiếu DATABASE_URL) — bài luyện vẫn hoàn thành bình thường.
                </p>
              )}

              {/* error-word drill */}
              {drillList.length > 0 && !drillDone && (
                <div className="card-soft" style={{ marginTop: 22 }}>
                  <strong>Luyện từ hay gõ sai ({drillIdx + 1}/{drillList.length})</strong>
                  <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                    Gõ lại đúng từng từ bạn đã gõ sai trong bài:
                  </p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: '8px 0' }}>
                    {drillList[drillIdx]}
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      className="input"
                      value={drillInput}
                      onChange={(e) => setDrillInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && checkDrill()}
                      placeholder="Gõ lại từ này…"
                      autoComplete="off" spellCheck={false}
                    />
                    <button className="btn primary" onClick={checkDrill}>
                      <CheckIcon width={16} height={16} />
                      Kiểm tra
                    </button>
                  </div>
                </div>
              )}
              {drillList.length > 0 && drillDone && (
                <p style={{ color: 'var(--correct)', fontWeight: 700, marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleIcon width={18} height={18} />
                  Đã luyện xong {drillList.length} từ hay sai — tốt lắm!
                </p>
              )}
              {drillList.length === 0 && (
                <p style={{ color: 'var(--correct)', fontWeight: 700, marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleIcon width={18} height={18} />
                  Không có từ nào gõ sai — hoàn hảo!
                </p>
              )}

              <div className="btn-row" style={{ marginTop: 24 }}>
                <button className="btn primary" onClick={() => fullReset(scope)}>
                  <ArrowPathIcon width={16} height={16} />
                  Luyện lại
                </button>
                <Link href="/writing" className="btn" style={{ textDecoration: 'none' }}>Chọn bài khác</Link>
                <Link href="/progress" className="btn" style={{ textDecoration: 'none' }}>Xem tiến bộ</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </main>
  );
}

'use client';

// Reading test player: /reading/[id]
// Flow: read 4 passages → answer 40 A/B/C/D → 60-min timer → submit →
// auto-score → review with correct answers.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
  SparklesIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { loadReadingTest, type ReadingTest } from '@/lib/reading-tests';
import { getAiSettings } from '@/lib/aiKey';
import type { ReadingAnalysis, TextSpan } from '@/lib/reading-analyze-prompts';
import { getEvidenceSpans } from '@/lib/reading-analyze-prompts';

const LETTERS = ['A', 'B', 'C', 'D'];
const TOTAL_MIN = 60;

function fmtTime(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---- bold the word/phrase a question refers to, inside the passage ----
// Questions like: The word "habituation" in paragraph 5 is closest in meaning to...
// or: What does "scaffolding" mean?  -> bold that term in the passage so the
// reader can find it. Only the first occurrence per term per paragraph is bolded.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function paragraphContains(paragraph: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(paragraph);
}

function extractTermRef(q: string): { term: string; para: number | null } | null {
  let m = q.match(/["“]([^"”]+)["”]\s+in\s+paragraph\s+(\d+)/i);
  if (m) return { term: m[1].trim(), para: parseInt(m[2], 10) };
  m = q.match(/the\s+(?:word|phrase)\s+["“]([^"”]+)["”][^"]*?paragraph\s+(\d+)/i);
  if (m) return { term: m[1].trim(), para: parseInt(m[2], 10) };
  m = q.match(/the\s+(?:word|phrase)\s+([A-Za-z][A-Za-z'-]{1,30})\s+in\s+paragraph\s+(\d+)/i);
  if (m) return { term: m[1].trim(), para: parseInt(m[2], 10) };
  m = q.match(/["“]([^"”]{2,40})["”]/);
  if (m) return { term: m[1].trim(), para: null };
  return null;
}

/** Render a paragraph with bold referenced terms + <mark> evidence highlights. */
function renderRichParagraph(
  text: string,
  boldTerms: string[],
  evidenceSpans: TextSpan[],
): ReactNode {
  const boldSpans: TextSpan[] = [];
  for (const term of boldTerms) {
    const m = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').exec(text);
    if (m) boldSpans.push({ start: m.index, end: m.index + m[0].length });
  }
  const points = new Set<number>([0, text.length]);
  for (const s of [...boldSpans, ...evidenceSpans]) {
    points.add(s.start);
    points.add(s.end);
  }
  const sorted = Array.from(points).sort((a, b) => a - b);
  const nodes: ReactNode[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start >= end) continue;
    const seg = text.slice(start, end);
    const isBold = boldSpans.some((s) => start >= s.start && end <= s.end);
    const isEvidence = evidenceSpans.some((s) => start >= s.start && end <= s.end);
    let node: ReactNode = seg;
    if (isBold) node = <strong>{node}</strong>;
    if (isEvidence) node = <mark>{node}</mark>;
    nodes.push(<span key={i}>{node}</span>);
  }
  return nodes;
}

function renderPassageParagraphs(
  part: {
    paragraphs: string[];
    questions: { q: string }[];
  },
  evidenceSpans?: Map<number, TextSpan[]>,
): ReactNode {
  const termsByPara = new Map<number, string[]>();
  const push = (idx: number, term: string) => {
    const list = termsByPara.get(idx) ?? [];
    if (!list.includes(term)) list.push(term);
    termsByPara.set(idx, list);
  };
  const uniqueElsewhere = (term: string): number | null => {
    const hits = part.paragraphs
      .map((p, i) => (paragraphContains(p, term) ? i : -1))
      .filter((i) => i >= 0);
    return hits.length === 1 ? hits[0] : null;
  };
  for (const qq of part.questions) {
    const ref = extractTermRef(qq.q);
    if (!ref) continue;
    if (ref.para != null) {
      const idx = ref.para - 1;
      if (idx >= 0 && idx < part.paragraphs.length && paragraphContains(part.paragraphs[idx], ref.term)) {
        push(idx, ref.term);
      } else {
        // Stated paragraph doesn't contain the term (data off-by-one);
        // bold it only if it occurs in exactly one other paragraph.
        const other = uniqueElsewhere(ref.term);
        if (other != null) push(other, ref.term);
      }
    } else {
      const other = uniqueElsewhere(ref.term);
      if (other != null) push(other, ref.term);
    }
  }
  return part.paragraphs.map((para, i) => (
    <p key={i}>{renderRichParagraph(para, termsByPara.get(i) ?? [], evidenceSpans?.get(i) ?? [])}</p>
  ));
}

export default function ReadingPlayerPage() {
  const params = useParams();
  // The 1000-test bank is loaded on demand (one ~100 KB chunk per test),
  // not bundled into the page. undefined = loading, null = not found.
  const [test, setTest] = useState<ReadingTest | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setTest(undefined);
    loadReadingTest(params.id as string).then((t) => {
      if (!cancelled) setTest(t ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const [part, setPart] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(TOTAL_MIN * 60);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<'pick' | 'practice' | 'mock'>('pick');

  // ---- AI analysis (mock review only) ----
  const [analysisMode, setAnalysisMode] = useState<'single' | 'bulk' | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, ReadingAnalysis>>({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [analyzeError, setAnalyzeError] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState<{
    running: boolean;
    done: number;
    total: number;
    note: string | null;
  }>({ running: false, done: 0, total: 0, note: null });
  const [evidenceHighlight, setEvidenceHighlight] = useState<{
    part: number;
    q: number;
  } | null>(null);
  const bulkStopRef = useRef(false);
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
  // ---- AI analysis helpers ----
  const analysisKey = (pi: number, qi: number) => `${pi}-${qi}`;

  /** Evidence spans for the currently highlighted question of one part. */
  const reviewEvidenceSpans = (pi: number): Map<number, TextSpan[]> => {
    if (!test || evidenceHighlight?.part !== pi) return new Map();
    const a = analysis[analysisKey(pi, evidenceHighlight.q)];
    if (!a) return new Map();
    return getEvidenceSpans(test.parts[pi].paragraphs, a.evidence);
  };

  /** Toggle evidence highlight for a question; scrolls its passage into view. */
  const toggleEvidenceHighlight = (pi: number, qi: number) => {
    if (evidenceHighlight?.part === pi && evidenceHighlight?.q === qi) {
      setEvidenceHighlight(null);
      return;
    }
    setEvidenceHighlight({ part: pi, q: qi });
    window.setTimeout(() => {
      document
        .getElementById(`review-passage-${pi}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  /** Analyze one question via /api/reading/analyze. */
  const analyzeQuestion = async (
    pi: number,
    qi: number,
  ): Promise<{ ok: boolean; error?: string; retryAfterMs?: number }> => {
    if (!test) return { ok: false, error: 'Không tìm thấy đề.' };
    const key = analysisKey(pi, qi);
    if (analysis[key]) return { ok: true };
    if (analyzing[key]) return { ok: false, error: 'Đang phân tích câu này.' };
    const q = test.parts[pi].questions[qi];
    const chosen = answers[qNum(pi, qi)];
    const ai = getAiSettings();
    setAnalyzing((prev) => ({ ...prev, [key]: true }));
    setAnalyzeError((prev) => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch('/api/reading/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: ai.provider,
          apiKey: ai.apiKey,
          passage: test.parts[pi].paragraphs.join('\n\n'),
          question: q.q,
          options: q.options,
          userAnswer: chosen === undefined ? null : chosen,
          correctAnswer: q.answer,
        }),
      });
      const text = await res.text();
      let data: { analysis?: ReadingAnalysis; error?: string; retryAfterMs?: number } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Máy chủ phân tích đang bận. Thử lại sau.');
      }
      if (!res.ok) {
        // Surface the server's message (a 429 now says "wait", not "check key")
        // and pass the wait time through so the bulk run can pause + retry.
        const msg = data.error || 'Phân tích thất bại.';
        setAnalyzeError((prev) => ({ ...prev, [key]: msg }));
        return { ok: false, error: msg, retryAfterMs: data.retryAfterMs };
      }
      if (!data.analysis) throw new Error('AI không trả về kết quả phân tích.');
      setAnalysis((prev) => ({ ...prev, [key]: data.analysis as ReadingAnalysis }));
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Phân tích thất bại.';
      setAnalyzeError((prev) => ({ ...prev, [key]: msg }));
      return { ok: false, error: msg };
    } finally {
      setAnalyzing((prev) => ({ ...prev, [key]: false }));
    }
  };

  /** Analyze all questions one by one, with progress + stop. Skips analyzed ones.
   * A 429 (Gemini free-tier per-minute quota) pauses the run: it waits out
   * the server's retry-after (up to 3 pauses per run, interruptible with
   * Dừng) and retries the same question, instead of dying on question 2
   * and making the user hammer "Tiếp tục" into the same rate limit. */
  const analyzeAll = async () => {
    if (!test) return;
    bulkStopRef.current = false;
    const keys: [number, number][] = [];
    test.parts.forEach((p, pi) => {
      p.questions.forEach((_q, qi) => {
        if (!analysis[analysisKey(pi, qi)]) keys.push([pi, qi]);
      });
    });
    const already = total - keys.length;
    setBulk({ running: true, done: already, total, note: null });
    let waitsUsed = 0;
    for (let idx = 0; idx < keys.length; idx++) {
      if (bulkStopRef.current) {
        setBulk((prev) => ({ ...prev, running: false, note: 'Đã dừng.' }));
        return;
      }
      const [pi, qi] = keys[idx];
      const result = await analyzeQuestion(pi, qi);
      if (result.ok) {
        setBulk((prev) => ({ ...prev, done: prev.done + 1 }));
      } else if (result.retryAfterMs && waitsUsed < 3) {
        waitsUsed += 1;
        const waitSec = Math.min(Math.max(Math.ceil(result.retryAfterMs / 1000), 5), 60);
        setBulk((prev) => ({
          ...prev,
          note: `Chạm giới hạn tốc độ Gemini — tự động tiếp tục sau ~${waitSec} giây (lần ${waitsUsed}/3). Bấm Dừng để dừng hẳn.`,
        }));
        // Interruptible wait: sleep in 500ms slices so Dừng reacts at once.
        let stopped = false;
        for (let waited = 0; waited < waitSec * 1000; waited += 500) {
          if (bulkStopRef.current) {
            stopped = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        if (stopped) {
          setBulk((prev) => ({ ...prev, running: false, note: 'Đã dừng.' }));
          return;
        }
        idx -= 1; // retry the same question after the pause
        continue;
      } else {
        // Stop the bulk run so a bad key / real failure doesn't burn all 40 calls.
        setBulk((prev) => ({
          ...prev,
          running: false,
          note: `Dừng ở câu ${qNum(pi, qi)}.${result.error ? ` ${result.error}` : ''} Bấm “Tiếp tục” để phân tích tiếp.`,
        }));
        return;
      }
      // Gentle pacing between questions so a burst doesn't trip the
      // per-minute quota on the very first questions.
      if (idx < keys.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    setBulk((prev) => ({ ...prev, running: false, note: null }));
  };

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
    setAnalysisMode(null);
    setAnalysis({});
    setAnalyzing({});
    setAnalyzeError({});
    setBulk({ running: false, done: 0, total: 0, note: null });
    setEvidenceHighlight(null);
    bulkStopRef.current = true;
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

  if (test === undefined) {
    return (
      <main className="page reading-player">
        <div className="nav-top">
          <Link href="/reading" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Danh sách đề
          </Link>
        </div>
        <p>Đang tải đề…</p>
      </main>
    );
  }

  if (!test) {
    return (
      <main className="page reading-player">
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
      <main className="page reading-player">
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

        {mode === 'mock' && (
          <div className="card" style={{ marginTop: 18 }}>
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <SparklesIcon width={18} height={18} />
              Phân tích với AI
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'var(--muted)' }}>
              Giải thích vì sao đáp án đúng là đúng, vì sao lựa chọn của bạn sai, kèm bằng chứng highlight trong đoạn văn.
            </p>
            {analysisMode === null && (
              <>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setAnalysisMode('bulk');
                      void analyzeAll();
                    }}
                  >
                    Phân tích toàn bộ
                  </button>
                  <button className="btn" onClick={() => setAnalysisMode('single')}>
                    Phân tích từng câu
                  </button>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                  Phân tích toàn bộ chạy lần lượt cả 40 câu nên đợi lâu (vài phút) — bạn có thể bấm Dừng giữa chừng. Phân tích từng câu thì chỉ phân tích câu bạn chọn.
                </p>
              </>
            )}
            {analysisMode === 'single' && (
              <p style={{ margin: '10px 0 0', fontSize: '0.88rem' }}>
                Đang ở chế độ phân tích từng câu — bấm nút “Phân tích với AI” ở từng câu hỏi.{' '}
                <button
                  type="button"
                  onClick={() => setAnalysisMode(null)}
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
                  Đổi lựa chọn
                </button>
              </p>
            )}
            {analysisMode === 'bulk' && (
              <div style={{ marginTop: 12 }}>
                {bulk.running ? (
                  <>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                      Đang phân tích câu {Math.min(bulk.done + 1, bulk.total)}/{bulk.total}…
                    </p>
                    <div className="score-bar" style={{ marginTop: 8 }}>
                      <div style={{ width: `${bulk.total ? (bulk.done / bulk.total) * 100 : 0}%` }} />
                    </div>
                    <button
                      className="btn"
                      style={{ marginTop: 10 }}
                      onClick={() => {
                        bulkStopRef.current = true;
                      }}
                    >
                      Dừng
                    </button>
                  </>
                ) : bulk.done >= bulk.total && bulk.total > 0 ? (
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    Đã phân tích xong {bulk.done}/{bulk.total} câu. Bấm vào từng câu để xem giải thích và highlight bằng chứng trong đoạn văn.
                  </p>
                ) : (
                  <>
                    {bulk.note && <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>{bulk.note}</p>}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn primary" onClick={() => void analyzeAll()}>
                        Tiếp tục phân tích
                      </button>
                      <button className="btn" onClick={() => setAnalysisMode('single')}>
                        Chuyển sang phân tích từng câu
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <h2 className="section-title">Xem lại bài làm</h2>
        {test.parts.map((p, pi) => (
          <section key={pi} style={{ marginTop: 18 }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.05rem' }}>
              Part {pi + 1} · {p.title}
            </h3>
            <div className="read-split" style={{ marginTop: 10 }}>
              <div className="card read-passage" id={`review-passage-${pi}`}>
                {renderPassageParagraphs(p, reviewEvidenceSpans(pi))}
              </div>
              <div>
                {p.questions.map((q, qi) => {
                  const num = qNum(pi, qi);
                  const chosen = answers[num];
                  const correct = chosen === q.answer;
                  const aKey = analysisKey(pi, qi);
                  const a = analysis[aKey];
                  const isHighlighted =
                    evidenceHighlight?.part === pi && evidenceHighlight?.q === qi;
                  return (
                    <div
                      key={qi}
                      className="card"
                      style={{
                        marginBottom: 10,
                        padding: '14px 16px',
                        cursor: a ? 'pointer' : undefined,
                        boxShadow: isHighlighted
                          ? '0 0 0 2px rgba(245, 158, 11, 0.7)'
                          : undefined,
                      }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        if (a) toggleEvidenceHighlight(pi, qi);
                      }}
                      title={a ? 'Bấm để highlight bằng chứng trong đoạn văn' : undefined}
                    >
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
                      {mode === 'mock' && analysisMode === 'single' && !a && (
                        <div style={{ marginTop: 10 }}>
                          <button
                            className="btn"
                            onClick={() => void analyzeQuestion(pi, qi)}
                            disabled={!!analyzing[aKey]}
                          >
                            <SparklesIcon width={15} height={15} />
                            {analyzing[aKey] ? 'Đang phân tích…' : 'Phân tích với AI'}
                          </button>
                          {analyzeError[aKey] && (
                            <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--wrong)' }}>
                              {analyzeError[aKey]}{' '}
                              <button
                                type="button"
                                onClick={() => void analyzeQuestion(pi, qi)}
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
                                Thử lại
                              </button>
                            </p>
                          )}
                        </div>
                      )}
                      {a && (
                        <div
                          style={{
                            marginTop: 12,
                            borderTop: '1px solid var(--border)',
                            paddingTop: 10,
                            fontSize: '0.9rem',
                            lineHeight: 1.65,
                          }}
                        >
                          <p style={{ margin: '0 0 6px' }}>
                            <strong>Vì sao đáp án đúng là đúng:</strong> {a.whyCorrect}
                          </p>
                          {a.whyUserWrong && (
                            <p style={{ margin: '0 0 6px' }}>
                              <strong>Vì sao lựa chọn của bạn sai:</strong> {a.whyUserWrong}
                            </p>
                          )}
                          <p style={{ margin: '0 0 6px' }}>
                            <strong>Mẹo:</strong> {a.tip}
                          </p>
                          {a.evidence.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <strong>Bằng chứng trong đoạn:</strong>
                              <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--muted)' }}>
                                {a.evidence.map((ev, i) => (
                                  <li key={i} style={{ marginBottom: 2 }}>“{ev}”</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                            {isHighlighted
                              ? 'Đang highlight bằng chứng trong đoạn văn — bấm vào câu để tắt.'
                              : 'Bấm vào câu hỏi để highlight bằng chứng trong đoạn văn.'}
                          </p>
                        </div>
                      )}
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
      <main className="page reading-player">
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
    <main className="page reading-player">
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
        <div className="modal-overlay" onClick={() => setSubmitConfirm(false)}>
          <div
            className="card modal"
            role="dialog"
            aria-label="Xác nhận nộp bài"
            onClick={(e) => e.stopPropagation()}
          >
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
        </div>
      )}

      <div>
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
              {renderPassageParagraphs(active)}
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
    </main>
  );
}

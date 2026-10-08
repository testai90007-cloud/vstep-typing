'use client';

// Speaking mock-test flow: Part 1 → 2 → 3 in sequence with real exam timing.
// Each part auto-starts prep, auto-starts recording when prep ends, and
// auto-stops at the talk limit. No going back, no retries — like the real exam.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  MicrophoneIcon,
} from '@heroicons/react/24/outline';
import { AuthedRecorder, type ScoreResult } from './SpeakingRecorder';
import SpeakingPartBlock from './SpeakingPartBlock';
import { SPEAKING_TIMING } from '@/lib/speaking';
import type { SpeakingTest } from '@/lib/speaking-tests';

const PART_NAMES = {
  1: 'Social Interaction',
  2: 'Solution Discussion',
  3: 'Topic Development',
} as const;

/** Whole-exam countdown: 3' + 4' + 5' = 12 minutes. */
const EXAM_TOTAL_SEC = 180 + 240 + 300;

function fmt(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function buildPrompt(n: 1 | 2 | 3, test: SpeakingTest): string {
  if (n === 1)
    return `Part 1 questions:\n${test.part1.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
  if (n === 2)
    return (
      `Situation: ${test.part2.situation}\nOptions:\n` +
      test.part2.options.map((o, i) => `${i + 1}. ${o}`).join('\n')
    );
  return (
    `Topic: ${test.part3.topic}\nMind-map: ${test.part3.points.join(' / ')}\nFollow-up questions:\n` +
    test.part3.followUps.map((q, i) => `${i + 1}. ${q}`).join('\n')
  );
}

export default function SpeakingMockFlow({ test }: { test: SpeakingTest }) {
  const [step, setStep] = useState<'intro' | 1 | 2 | 3 | 'done'>('intro');
  const [micError, setMicError] = useState('');
  const [scores, setScores] = useState<(ScoreResult | null)[]>([]);
  const [partDone, setPartDone] = useState(false);
  /** per-part total countdown (3' / 4' / 5') + whole-exam countdown (12') */
  const [partLeft, setPartLeft] = useState(180);
  const [totalLeft, setTotalLeft] = useState(EXAM_TOTAL_SEC);

  // Reset the per-part countdown whenever a new part starts.
  useEffect(() => {
    if (step === 1 || step === 2 || step === 3) {
      setPartLeft(SPEAKING_TIMING[`part${step}` as 'part1' | 'part2' | 'part3'].total);
    }
  }, [step]);

  // Tick both countdowns while a part is actively running
  // (paused on the intro, the summary, and the break between parts).
  useEffect(() => {
    if (step !== 1 && step !== 2 && step !== 3) return;
    if (partDone) return;
    if (partLeft <= 0 && totalLeft <= 0) return;
    const id = setTimeout(() => {
      setPartLeft((p) => Math.max(0, p - 1));
      setTotalLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [step, partDone, partLeft, totalLeft]);

  // Warn before leaving mid-exam.
  useEffect(() => {
    if (step === 'intro' || step === 'done') return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [step]);

  async function begin() {
    setMicError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {
      setMicError(
        'Không truy cập được micro. Hãy cho phép trình duyệt dùng micro rồi bấm bắt đầu lại.'
      );
      return;
    }
    setStep(1);
  }

  function next() {
    if (step === 1) {
      setPartDone(false);
      setStep(2);
    } else if (step === 2) {
      setPartDone(false);
      setStep(3);
    } else if (step === 3) {
      setStep('done');
    }
  }

  function restart() {
    setScores([]);
    setPartDone(false);
    setPartLeft(180);
    setTotalLeft(EXAM_TOTAL_SEC);
    setStep('intro');
  }

  // ------------------------------ INTRO ------------------------------
  if (step === 'intro') {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <span className="icon-badge" style={{ marginBottom: 12 }}>
          <FlagIcon width={24} height={24} />
        </span>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: 800 }}>
          Thi thử Speaking — {test.title}
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.7, margin: '0 0 14px' }}>
          Mô phỏng đúng quy trình thi thật, liên tục 3 parts (~12 phút):
        </p>
        <ol className="q-list" style={{ marginTop: 0 }}>
          <li>
            <strong>Part 1 · {PART_NAMES[1]}</strong> — 3 phút, trả lời ngay, không có thời
            gian chuẩn bị.
          </li>
          <li>
            <strong>Part 2 · {PART_NAMES[2]}</strong> — 1 phút chuẩn bị + 3 phút nói.
          </li>
          <li>
            <strong>Part 3 · {PART_NAMES[3]}</strong> — 1 phút chuẩn bị + 4 phút nói.
          </li>
        </ol>
        <div className="card-soft" style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <ExclamationTriangleIcon width={18} height={18} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent-strong)' }} />
          <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.65 }}>
            Hết giờ chuẩn bị sẽ <strong>tự động ghi âm</strong>, hết giờ nói sẽ{' '}
            <strong>tự động dừng và chấm điểm</strong>. Không quay lại part trước, không ghi
            âm lại. Điểm chi tiết hiện sau khi xong cả 3 parts.
          </p>
        </div>
        {micError && (
          <p style={{ color: 'var(--wrong)', fontSize: '0.9rem', margin: '12px 0 0' }}>{micError}</p>
        )}
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={begin} style={{ fontSize: '1rem', padding: '12px 26px' }}>
            <MicrophoneIcon width={18} height={18} />
            Bắt đầu thi thử
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------ SUMMARY ------------------------------
  if (step === 'done') {
    const valid = scores.filter((s): s is ScoreResult => !!s);
    const overall =
      valid.length > 0
        ? valid.reduce((a, s) => a + s.overall, 0) / valid.length
        : null;
    return (
      <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
        <span className="icon-badge" style={{ margin: '0 auto 10px' }}>
          <CheckCircleIcon width={26} height={26} />
        </span>
        <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          Kết quả thi thử · {test.title}
        </p>
        <p style={{ margin: 0, fontSize: '2.6rem', fontWeight: 800 }}>
          {overall != null ? overall.toFixed(1) : '—'}
          <span style={{ color: 'var(--muted)', fontSize: '1.4rem' }}>/10</span>
        </p>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>
          Trung bình 3 parts · kết quả từng part đã lưu vào Tiến độ
        </p>
        <div style={{ maxWidth: 340, margin: '18px auto 0', textAlign: 'left' }}>
          {([1, 2, 3] as const).map((n) => {
            const s = scores[n - 1];
            return (
              <div key={n} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span>
                    Part {n} · {PART_NAMES[n]}
                  </span>
                  <strong>{s ? s.overall.toFixed(1) : '—'}</strong>
                </div>
                <div className="score-bar">
                  <div style={{ width: s ? `${s.overall * 10}%` : '0%' }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: 18 }}>
          <button className="btn" onClick={restart}>
            Thi thử lại
          </button>
          <Link href="/speaking" className="btn" style={{ textDecoration: 'none' }}>
            Đề khác
          </Link>
          <Link href="/progress" className="btn" style={{ textDecoration: 'none' }}>
            Xem tiến bộ
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------ PART STEPS ------------------------------
  const n = step;
  const timing = SPEAKING_TIMING[`part${n}` as 'part1' | 'part2' | 'part3'];

  return (
    <>
      <div className="exam-topbar">
        <div className="exam-topbar-inner">
          <div className="exam-topbar-left">
            <strong>Thi thử · Part {n}/3</strong>
            <span className="chip">{PART_NAMES[n]}</span>
          </div>
          <div className="exam-topbar-right">
            <span
              className={`timer-pill${partLeft <= 30 ? ' danger' : ''}`}
              title="Thời gian còn lại của part này"
            >
              <ClockIcon width={15} height={15} />
              Part {fmt(partLeft)}
            </span>
            <span
              className={`timer-pill${totalLeft <= 60 ? ' danger' : ''}`}
              title="Thời gian còn lại của cả bài thi"
            >
              <FlagIcon width={15} height={15} />
              Tổng {fmt(totalLeft)}
            </span>
          </div>
        </div>
      </div>

      <div className="seg" style={{ marginTop: 20 }} aria-label="Tiến trình thi thử">
        {([1, 2, 3] as const).map((p) => (
          <button
            key={p}
            className={p === n ? 'active' : ''}
            disabled
            style={{ cursor: 'default', opacity: p < n ? 0.7 : 1 }}
          >
            Part {p}
            {p < n && ' ✓'}
          </button>
        ))}
      </div>

      <SpeakingPartBlock
        part={n}
        test={test}
        recorder={
          <AuthedRecorder
            key={`mock-${test.id}-${n}`}
            part={n}
            promptText={buildPrompt(n, test)}
            prepSec={timing.prep}
            talkSec={timing.talk}
            prepLabel={timing.label}
            examMode
            sessionMode="mock"
            onPartFinished={(r) => {
              setScores((s) => {
                const next = [...s];
                next[n - 1] = r;
                return next;
              });
              setPartDone(true);
            }}
          />
        }
      />

      {partDone && (
        <div className="card" style={{ marginTop: 14, textAlign: 'center' }}>
          <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: '0.9rem' }}>
            {n < 3
              ? `Xong Part ${n}. Nghỉ một chút rồi sang Part ${n + 1} nhé.`
              : 'Xong Part 3 — xem kết quả tổng nào.'}
          </p>
          <button className="btn primary" onClick={next} style={{ fontSize: '1rem', padding: '12px 26px' }}>
            {n < 3 ? (
              <>
                Tiếp tục Part {n + 1}
                <ArrowRightIcon width={17} height={17} />
              </>
            ) : (
              <>
                Xem kết quả
                <ArrowRightIcon width={17} height={17} />
              </>
            )}
          </button>
        </div>
      )}

      <div className="nav-top" style={{ marginTop: 18 }}>
        <Link href="/speaking" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Bỏ thi (kết quả các part đã xong vẫn được lưu)
        </Link>
      </div>
    </>
  );
}

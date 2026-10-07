'use client';

// Pure presentational dashboard for /progress: hero metrics strip, 4 skill
// cards with trend sparklines, 16-week heatmap, tabbed history.
// Rendered by app/progress/page.tsx (real data) and can be reused by previews.

import { useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  FireIcon,
  MicrophoneIcon,
  PencilSquareIcon,
  SpeakerWaveIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { getTemplate } from '@/lib/templates';
import { WRITING_TESTS } from '@/lib/writing-tests';
import { READING_TESTS } from '@/lib/reading-tests';

function writingTitle(templateId: string | null): string {
  if (!templateId) return '—';
  const tpl = getTemplate(templateId);
  if (tpl) return tpl.title;
  const test = WRITING_TESTS.find((t) => t.id === templateId);
  if (test) return `${test.title} · Đề thi`;
  return templateId;
}

function readingTitle(testId: string | null): string {
  if (!testId) return '—';
  const test = READING_TESTS.find((t) => t.id === testId);
  return test ? test.title : testId;
}

export interface WritingSession {
  template_id: string;
  mode: string;
  accuracy: number;
  duration_sec: number;
  created_at: string;
}

export interface SpeakingSession {
  part: number;
  prompt: string;
  transcript: string;
  scores: Record<string, number>;
  overall: number;
  feedback: string;
  created_at: string;
}

export interface ListeningSession {
  test_id: string;
  score: number;
  total: number;
  duration_sec: number;
  created_at: string;
}

export interface ReadingSession {
  test_id: string;
  score: number;
  total: number;
  duration_sec: number;
  created_at: string;
}

/* ---------------- date helpers (local timezone) ---------------- */

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "Hôm nay" / "Hôm qua" / "N ngày trước" / dd/mm */
function relDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const diff = Math.round((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86400000);
  if (diff <= 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  if (diff < 7) return `${diff} ngày trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

/**
 * Consecutive-day streak: counts back from today; if today has no session yet,
 * the streak may start from yesterday. A gap day ends the streak (returns 0
 * when neither today nor yesterday has activity).
 */
function computeStreak(activeDays: Set<string>): number {
  const today = startOfDay(new Date());
  let cursor = today;
  if (!activeDays.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - 86400000);
    if (!activeDays.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

/** "45 phút" / "2 giờ 15 phút" */
function fmtTotal(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h === 0) return `${m} phút`;
  return `${h} giờ ${m} phút`;
}

const MODE_LABEL: Record<string, string> = {
  whole: 'Toàn bài',
  sections: 'Từng phần',
  exam: 'Thi thử',
  practice: 'Đề thi · Luyện tập',
  mock: 'Đề thi · Thi thử',
};

const SCORE_LABEL: Record<string, string> = {
  grammar: 'Ngữ pháp',
  vocabulary: 'Từ vựng',
  pronunciation: 'Phát âm',
  fluency: 'Trôi chảy',
  discourse_management: 'Mạch lạc',
};

/* ---------------- sparkline: mini SVG trend of recent sessions ---------------- */

function Sparkline({ values }: { values: number[] }) {
  const gid = useId();
  const W = 132;
  const H = 40;
  const P = 4;
  if (values.length === 0) {
    return <div className="spark-empty">Chưa có dữ liệu</div>;
  }
  const clamp = (v: number) => Math.min(10, Math.max(0, v));
  const pts = values.map((v, i) => {
    const x = P + (i * (W - 2 * P)) / Math.max(1, values.length - 1);
    const y = H - P - (clamp(v) / 10) * (H - 2 * P);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts[pts.length - 1].split(',').map(Number);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--accent-strong)', stopOpacity: 0.28 }} />
          <stop offset="100%" style={{ stopColor: 'var(--accent-strong)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <polygon
        points={`${P},${H - P} ${pts.join(' ')} ${W - P},${H - P}`}
        fill={`url(#${gid})`}
      />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--ink)" />
    </svg>
  );
}

type HistTab = 'writing' | 'speaking' | 'listening' | 'reading';


/* ---------------- dashboard view (pure; also used by the QA preview) ---------------- */

export interface DashboardData {
  writing: WritingSession[];
  speaking: SpeakingSession[];
  listening: ListeningSession[];
  reading: ReadingSession[];
}


/* ---------------- history building blocks ---------------- */

function HistItem({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`hist-item${open ? ' open' : ''}`}>
      <button
        type="button"
        className="hist-summary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="hist-summary-main">{summary}</span>
        <ChevronDownIcon width={17} height={17} className="hist-chev" />
      </button>
      {open && <div className="hist-detail">{children}</div>}
    </div>
  );
}

function ScoreBar({ pct }: { pct: number }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div className="scorebar" role="img" aria-label={`${Math.round(w)}%`}>
      <i style={{ width: `${w}%` }} />
    </div>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="hist-kv">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

/** Expandable detail for a listening/reading session (score out of `total`). */
function TestDetail({
  score,
  total,
  unit,
  durationSec,
  createdAt,
  retakeHref,
  retakeLabel,
}: {
  score: number;
  total: number;
  unit: string;
  durationSec?: number | null;
  createdAt: string;
  retakeHref: string;
  retakeLabel: string;
}) {
  const pct = total > 0 ? (score / total) * 100 : 0;
  const wrong = Math.max(0, (total || 0) - (score || 0));
  return (
    <>
      <div className="hist-scorehead">
        <b>
          {score}
          <span>/{total}</span>
        </b>
        <span>
          {Math.round(pct)}% số câu đúng · {unit}
        </span>
      </div>
      <div>
        <div
          className="ci-bar"
          role="img"
          aria-label={`${score} câu đúng, ${wrong} câu sai`}
        >
          <i className="ok" style={{ width: `${pct}%` }} />
          <i className="no" style={{ width: `${100 - pct}%` }} />
        </div>
        <div className="ci-legend">
          <span>
            <i className="dot ok" />
            {score} câu đúng
          </span>
          <span>
            <i className="dot no" />
            {wrong} câu sai
          </span>
        </div>
      </div>
      <KV k="Thời lượng" v={durationSec != null ? fmtDur(durationSec) : '–'} />
      <KV k="Thời gian" v={fmtDate(createdAt)} />
      <Link className="hist-cta" href={retakeHref}>
        {retakeLabel}
        <ChevronRightIcon width={14} height={14} />
      </Link>
    </>
  );
}

export function DashboardView({
  data,
  targetLevel,
  noDb,
  userName,
  userInitial,
  userImage,
}: {
  data: DashboardData;
  targetLevel: { id: string; threshold: number };
  noDb: boolean;
  userName: string;
  userInitial: string;
  userImage?: string | null;
}) {
  const { writing, speaking, listening, reading } = data;

  const totalSessions = writing.length + speaking.length + listening.length + reading.length;
  // Note: speaking sessions don't record duration, so they contribute 0 here.
  const totalSec =
    writing.reduce((a, s) => a + (s.duration_sec || 0), 0) +
    listening.reduce((a, s) => a + (s.duration_sec || 0), 0) +
    reading.reduce((a, s) => a + (s.duration_sec || 0), 0);

  const activeDays = new Set<string>();
  const perDay = new Map<string, number>();
  for (const s of [...writing, ...speaking, ...listening, ...reading]) {
    const d = new Date(s.created_at);
    if (isNaN(d.getTime())) continue;
    const k = dayKey(d);
    activeDays.add(k);
    perDay.set(k, (perDay.get(k) || 0) + 1);
  }
  const streak = computeStreak(activeDays);
  const weekAgo = Date.now() - 7 * 86400000;
  const weekCount = [...writing, ...speaking, ...listening, ...reading].filter(
    (s) => new Date(s.created_at).getTime() >= weekAgo
  ).length;

  // Writing accuracy average: only typing-practice sessions carry an
  // accuracy; free-writing mock tests save null and must not pollute the avg.
  const writingScored = writing.filter((s) => s.accuracy != null);
  const avgAcc =
    writingScored.length > 0
      ? writingScored.reduce((a, s) => a + (s.accuracy as number), 0) / writingScored.length
      : 0;
  const avgSpeaking =
    speaking.length > 0
      ? speaking.reduce((a, s) => a + (s.overall || 0), 0) / speaking.length
      : 0;
  // Listening average scaled to /35 so demo tests (fewer questions) stay comparable
  const avgListening35 =
    listening.length > 0
      ? (listening.reduce((a, s) => a + (s.total > 0 ? s.score / s.total : 0), 0) /
          listening.length) *
        35
      : 0;
  const avgReading40 =
    reading.length > 0
      ? (reading.reduce((a, s) => a + (s.total > 0 ? s.score / s.total : 0), 0) /
          reading.length) *
        40
      : 0;

  /** newest-first → oldest-first, last 15, on the 0–10 scale */
  const spark = (vals: number[]) => vals.slice(0, 15).reverse();

  const skills: {
    id: HistTab;
    href: string;
    title: string;
    Icon: typeof BookOpenIcon;
    count: number;
    headline: string;
    headlineLabel: string;
    best: string;
    values: number[];
    avg10: number | null;
    last: string;
  }[] = [
    {
      id: 'writing',
      href: '/writing',
      title: 'Luyện Viết',
      Icon: PencilSquareIcon,
      count: writing.length,
      headline: writingScored.length > 0 ? `${Math.round(avgAcc)}%` : '—',
      headlineLabel: 'độ chính xác TB',
      best:
        writingScored.length > 0
          ? `${Math.round(Math.max(...writingScored.map((s) => s.accuracy as number)))}%`
          : '—',
      values: spark(writingScored.map((s) => (s.accuracy as number) / 10)),
      avg10: writingScored.length > 0 ? avgAcc / 10 : null,
      last: writing.length > 0 ? `Gần nhất: ${relDay(writing[0].created_at)}` : 'Chưa luyện buổi nào',
    },
    {
      id: 'speaking',
      href: '/speaking',
      title: 'Luyện Nói',
      Icon: MicrophoneIcon,
      count: speaking.length,
      headline: speaking.length > 0 ? avgSpeaking.toFixed(1) : '—',
      headlineLabel: 'điểm TB / 10',
      best:
        speaking.length > 0
          ? Math.max(...speaking.map((s) => s.overall || 0)).toFixed(1)
          : '—',
      values: spark(speaking.map((s) => s.overall || 0)),
      avg10: speaking.length > 0 ? avgSpeaking : null,
      last: speaking.length > 0 ? `Gần nhất: ${relDay(speaking[0].created_at)}` : 'Chưa luyện buổi nào',
    },
    {
      id: 'listening',
      href: '/listening',
      title: 'Luyện Nghe',
      Icon: SpeakerWaveIcon,
      count: listening.length,
      headline: listening.length > 0 ? avgListening35.toFixed(1) : '—',
      headlineLabel: 'điểm TB / 35',
      best:
        listening.length > 0
          ? (
              Math.max(...listening.map((s) => (s.total > 0 ? s.score / s.total : 0))) * 35
            ).toFixed(1)
          : '—',
      values: spark(listening.map((s) => (s.total > 0 ? (s.score / s.total) * 10 : 0))),
      avg10: listening.length > 0 ? (avgListening35 / 35) * 10 : null,
      last: listening.length > 0 ? `Gần nhất: ${relDay(listening[0].created_at)}` : 'Chưa luyện buổi nào',
    },
    {
      id: 'reading',
      href: '/reading',
      title: 'Luyện Đọc',
      Icon: BookOpenIcon,
      count: reading.length,
      headline: reading.length > 0 ? avgReading40.toFixed(1) : '—',
      headlineLabel: 'điểm TB / 40',
      best:
        reading.length > 0
          ? (
              Math.max(...reading.map((s) => (s.total > 0 ? s.score / s.total : 0))) * 40
            ).toFixed(1)
          : '—',
      values: spark(reading.map((s) => (s.total > 0 ? (s.score / s.total) * 10 : 0))),
      avg10: reading.length > 0 ? (avgReading40 / 40) * 10 : null,
      last: reading.length > 0 ? `Gần nhất: ${relDay(reading[0].created_at)}` : 'Chưa luyện buổi nào',
    },
  ];

  /* 16-week activity heatmap: 16 columns of Mon–Sun weeks, rows ordered T2..CN */
  const HEAT_WEEKS = 24;
  const heatToday = startOfDay(new Date());
  const heatThisMonday = new Date(
    heatToday.getTime() - (((heatToday.getDay() + 6) % 7) * 86400000)
  );
  const heatCols: { date: Date; key: string; count: number; future: boolean }[][] = [];
  for (let w = HEAT_WEEKS - 1; w >= 0; w--) {
    const colStart = new Date(heatThisMonday.getTime() - w * 7 * 86400000);
    heatCols.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(colStart.getTime() + i * 86400000);
        const key = dayKey(date);
        return {
          date,
          key,
          count: perDay.get(key) || 0,
          future: date.getTime() > heatToday.getTime(),
        };
      })
    );
  }
  const heatTotal = heatCols
    .flat()
    .filter((c) => !c.future)
    .reduce((a, c) => a + c.count, 0);
  const heatLevel = (count: number) =>
    count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : 3;
  const heatMonthLabel = (w: number) => {
    const m = heatCols[w][0].date.getMonth();
    if (w === 0 || heatCols[w - 1][0].date.getMonth() !== m) return `Th${m + 1}`;
    return '';
  };
  const heatTip = (c: { date: Date; count: number; future: boolean }) =>
    c.future
      ? undefined
      : `${c.date.getDate()} thg ${c.date.getMonth() + 1}: ${
          c.count === 0 ? 'chưa luyện' : `${c.count} buổi luyện`
        }`;
  const ROW_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];







  const heroMetrics = [
    { Icon: BookOpenIcon, value: String(totalSessions), label: 'Tổng buổi luyện' },
    { Icon: FireIcon, value: String(streak), label: 'Ngày học liên tiếp' },
    { Icon: ClockIcon, value: fmtTotal(totalSec), label: 'Tổng thời gian luyện' },
    { Icon: StarIcon, value: String(weekCount), label: 'Buổi luyện tuần này' },
  ];

  const tabs: { id: HistTab; label: string; count: number }[] = [
    { id: 'writing', label: 'Viết', count: writing.length },
    { id: 'speaking', label: 'Nói', count: speaking.length },
    { id: 'listening', label: 'Nghe', count: listening.length },
    { id: 'reading', label: 'Đọc', count: reading.length },
  ];

  const [tab, setTab] = useState<HistTab>('writing');

  return (
    <>
      <div className="prog-top">
        <h1 className="brand" style={{ fontSize: '2.2rem', margin: 0 }}>
          Tiến độ <span className="hl">học tập</span>
        </h1>
        <div className="user-chip">
          {userImage ? (
            <img src={userImage} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="user-chip-fallback" aria-hidden>
              {userInitial}
            </span>
          )}
          <span>{userName}</span>
        </div>
      </div>

      {noDb && (
        <p className="card-soft" style={{ fontSize: '0.9rem', marginTop: 12 }}>
          Chưa kết nối database (thiếu DATABASE_URL) nên chưa có dữ liệu lưu trữ.
        </p>
      )}

          {totalSessions === 0 ? (
            <div className="card empty" style={{ marginTop: 18 }}>
              <span className="icon-badge">
                <ChartBarIcon width={24} height={24} />
              </span>
              <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px' }}>
                Bắt đầu hành trình của bạn
              </p>
              <p className="lead" style={{ margin: '0 auto 16px' }}>
                Chưa có buổi luyện nào được lưu. Mỗi bài làm xong sẽ hiện ở đây cùng thống kê
                tiến độ của bạn.
              </p>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <Link className="btn primary" href="/writing">
                  <PencilSquareIcon width={16} height={16} />
                  Luyện Viết
                </Link>
                <Link className="btn" href="/speaking">
                  <MicrophoneIcon width={16} height={16} />
                  Luyện Nói
                </Link>
                <Link className="btn" href="/listening">
                  <SpeakerWaveIcon width={16} height={16} />
                  Luyện Nghe
                </Link>
                <Link className="btn" href="/reading">
                  <BookOpenIcon width={16} height={16} />
                  Luyện Đọc
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* ---- hero metrics strip ---- */}
              <div className="hero-strip">
                {heroMetrics.map(({ Icon, value, label }) => (
                  <div key={label} className="hero-metric">
                    <span className="icon-badge sm">
                      <Icon width={19} height={19} strokeWidth={1.8} />
                    </span>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {/* ---- skills ---- */}
              <div className="sec-head">
                <h2 className="section-title" style={{ margin: 0 }}>
                  <span className="icon-badge sm">
                    <StarIcon width={18} height={18} strokeWidth={1.8} />
                  </span>
                  Kỹ năng
                </h2>
                <Link href="/ho-so-nang-luc" className="sec-link">
                  Hồ sơ năng lực
                  <ChevronRightIcon width={15} height={15} />
                </Link>
              </div>
              <div className="psk-grid">
                {skills.map(
                  ({
                    id,
                    href,
                    title,
                    Icon,
                    count,
                    headline,
                    headlineLabel,
                    best,
                    values,
                    avg10,
                    last,
                  }) => (
                    <Link key={id} href={href} className="psk-card">
                      <div className="psk-top">
                        <span className="psk-name">
                          <span className="icon-badge sm">
                            <Icon width={19} height={19} strokeWidth={1.8} />
                          </span>
                          {title}
                        </span>
                        <span className="psk-count">
                          {count} buổi
                        </span>
                      </div>
                      <div className="psk-main">
                        <div className="psk-headline">
                          <b>{headline}</b>
                          <i>{headlineLabel}</i>
                        </div>
                        <Sparkline values={values} />
                      </div>
                      <div className="psk-meta">
                        <span>
                          Tốt nhất <b>{best}</b>
                        </span>
                        <span>{last}</span>
                      </div>
                      <div className="psk-progress">
                        <div className="psk-progress-top">
                          <span>Mục tiêu {targetLevel.id}</span>
                          <b>
                            {avg10 != null
                              ? `${avg10.toFixed(1)} / ${targetLevel.threshold.toFixed(1)}`
                              : 'Chưa có dữ liệu'}
                          </b>
                        </div>
                        <div className="psk-track">
                          <div
                            className="psk-fill"
                            style={{
                              width: `${
                                avg10 != null
                                  ? Math.min(100, (avg10 / targetLevel.threshold) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </Link>
                  )
                )}
              </div>

              {/* ---- activity heatmap ---- */}
              <div className="sec-head">
                <h2 className="section-title" style={{ margin: 0 }}>
                  <span className="icon-badge sm">
                    <CalendarDaysIcon width={18} height={18} strokeWidth={1.8} />
                  </span>
                  Hoạt động
                </h2>
                <span className="sec-note">
                  {heatTotal === 0
                    ? '24 tuần qua chưa luyện buổi nào'
                    : `${heatTotal} buổi · TB ${(heatTotal / HEAT_WEEKS).toFixed(1)} buổi/tuần · 24 tuần qua`}
                </span>
              </div>
              <div className="card-soft">
                <div className="heat-scroll">
                  <div className="heat-months" aria-hidden="true">
                    <span className="heat-corner" />
                    {heatCols.map((_, w) => (
                      <span key={w} className="heat-month">
                        {heatMonthLabel(w)}
                      </span>
                    ))}
                  </div>
                  <div
                    className="heat-grid"
                    role="img"
                    aria-label={`Biểu đồ hoạt động 24 tuần qua, tổng ${heatTotal} buổi luyện`}
                  >
                    <div className="heat-rowlabels" aria-hidden="true">
                      {ROW_LABELS.map((l, i) => (
                        <span key={l}>{i % 2 === 0 ? l : ''}</span>
                      ))}
                    </div>
                    {heatCols.map((days, w) => (
                      <div key={w} className="heat-col">
                        {days.map((c) => (
                          <div
                            key={c.key}
                            className={`heat-cell l${heatLevel(c.count)}${
                              c.future ? ' future' : ''
                            }`}
                            title={heatTip(c)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="heat-legend" aria-hidden="true">
                    <span>Ít</span>
                    {[0, 1, 2, 3].map((l) => (
                      <span key={l} className={`heat-cell l${l}`} />
                    ))}
                    <span>Nhiều</span>
                  </div>
                </div>
              </div>

              {/* ---- history tabs ---- */}
              <div className="sec-head">
                <h2 className="section-title" style={{ margin: 0 }}>
                  <span className="icon-badge sm">
                    <ClockIcon width={18} height={18} strokeWidth={1.8} />
                  </span>
                  Lịch sử luyện tập
                </h2>
              </div>
              <div className="seg hist-tabs" role="tablist" aria-label="Lịch sử theo kỹ năng">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    className={tab === t.id ? 'active' : ''}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                    <span className="tab-count">{t.count}</span>
                  </button>
                ))}
              </div>

              {tab === 'writing' &&
                (writing.length === 0 ? (
                  <p style={{ color: 'var(--muted)' }}>
                    Chưa có bài nào. <Link href="/writing">Luyện ngay</Link>.
                  </p>
                ) : (
                  <div className="hist-list">
                    {writing.map((s, i) => {
                      const isTest = !!s.template_id && s.template_id.startsWith('de-');
                      return (
                        <HistItem
                          key={i}
                          summary={
                            <>
                              <span className="hist-date">{fmtDate(s.created_at)}</span>
                              <span className="hist-title">{writingTitle(s.template_id)}</span>
                              <span className="hist-tag">{MODE_LABEL[s.mode] || s.mode}</span>
                              <span className="hist-score">
                                {s.accuracy != null ? `${Math.round(s.accuracy)}%` : '–'}
                              </span>
                            </>
                          }
                        >
                          <KV k="Bài luyện" v={writingTitle(s.template_id)} />
                          <KV k="Chế độ" v={MODE_LABEL[s.mode] || s.mode} />
                          {s.accuracy != null && (
                            <div className="hist-kv">
                              <span>Độ chính xác</span>
                              <span className="hist-barwrap">
                                <ScoreBar pct={s.accuracy} />
                                <b>{Math.round(s.accuracy)}%</b>
                              </span>
                            </div>
                          )}
                          <KV
                            k="Thời lượng"
                            v={s.duration_sec != null ? fmtDur(s.duration_sec) : '–'}
                          />
                          <KV k="Thời gian" v={fmtDate(s.created_at)} />
                          <Link
                            className="hist-cta"
                            href={isTest ? `/writing/de-thi/${s.template_id}` : '/writing'}
                          >
                            Luyện lại
                            <ChevronRightIcon width={14} height={14} />
                          </Link>
                        </HistItem>
                      );
                    })}
                  </div>
                ))}

              {tab === 'speaking' &&
                (speaking.length === 0 ? (
                  <p style={{ color: 'var(--muted)' }}>
                    Chưa có lượt nào. <Link href="/speaking">Luyện ngay</Link>.
                  </p>
                ) : (
                  <div className="hist-list">
                    {speaking.map((s, i) => (
                      <HistItem
                        key={i}
                        summary={
                          <>
                            <span className="hist-date">{fmtDate(s.created_at)}</span>
                            <span className="hist-title">Part {s.part}</span>
                            <span className="hist-score big">
                              {Number(s.overall).toFixed(1)}
                              <i>/ 10</i>
                            </span>
                          </>
                        }
                      >
                        <div className="hist-scorehead">
                          <b>{Number(s.overall).toFixed(1)}</b>
                          <span>/ 10 · Part {s.part} · {fmtDate(s.created_at)}</span>
                        </div>
                        {s.scores && (
                          <div className="crit-list">
                            {Object.keys(SCORE_LABEL).map((k) => (
                              <div className="crit-row" key={k}>
                                <span>{SCORE_LABEL[k]}</span>
                                <ScoreBar pct={Number(s.scores[k] ?? 0) * 10} />
                                <b>{Number(s.scores[k] ?? 0).toFixed(1)}</b>
                              </div>
                            ))}
                          </div>
                        )}
                        {s.transcript && (
                          <div className="hist-block">
                            <span className="hist-block-title">Bài nói của bạn</span>
                            <p className="hist-transcript">{s.transcript}</p>
                          </div>
                        )}
                        {s.feedback && (
                          <div className="hist-block">
                            <span className="hist-block-title">Nhận xét của AI</span>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{s.feedback}</p>
                          </div>
                        )}
                        <Link className="hist-cta" href="/speaking">
                          Luyện tiếp
                          <ChevronRightIcon width={14} height={14} />
                        </Link>
                      </HistItem>
                    ))}
                  </div>
                ))}

              {tab === 'listening' &&
                (listening.length === 0 ? (
                  <p style={{ color: 'var(--muted)' }}>
                    Chưa có bài nào. <Link href="/listening">Luyện ngay</Link>.
                  </p>
                ) : (
                  <div className="hist-list">
                    {listening.map((s, i) => (
                      <HistItem
                        key={i}
                        summary={
                          <>
                            <span className="hist-date">{fmtDate(s.created_at)}</span>
                            <span className="hist-title">{s.test_id}</span>
                            <span className="hist-score">
                              {s.score}/{s.total}
                              <i>
                                {s.total > 0 ? Math.round((s.score / s.total) * 100) : 0}%
                              </i>
                            </span>
                          </>
                        }
                      >
                        <TestDetail
                          score={s.score}
                          total={s.total}
                          unit="trắc nghiệm Nghe"
                          durationSec={s.duration_sec}
                          createdAt={s.created_at}
                          retakeHref={`/listening/${s.test_id}`}
                          retakeLabel="Làm lại đề này"
                        />
                      </HistItem>
                    ))}
                  </div>
                ))}

              {tab === 'reading' &&
                (reading.length === 0 ? (
                  <p style={{ color: 'var(--muted)' }}>
                    Chưa có bài nào. <Link href="/reading">Luyện ngay</Link>.
                  </p>
                ) : (
                  <div className="hist-list">
                    {reading.map((s, i) => (
                      <HistItem
                        key={i}
                        summary={
                          <>
                            <span className="hist-date">{fmtDate(s.created_at)}</span>
                            <span className="hist-title">{readingTitle(s.test_id)}</span>
                            <span className="hist-score">
                              {s.score}/{s.total}
                              <i>
                                {s.total > 0 ? Math.round((s.score / s.total) * 100) : 0}%
                              </i>
                            </span>
                          </>
                        }
                      >
                        <TestDetail
                          score={s.score}
                          total={s.total}
                          unit="trắc nghiệm Đọc"
                          durationSec={s.duration_sec}
                          createdAt={s.created_at}
                          retakeHref={`/reading/${s.test_id}`}
                          retakeLabel="Làm lại đề này"
                        />
                      </HistItem>
                    ))}
                  </div>
                ))}
            </>
          )}
    </>
  );
}

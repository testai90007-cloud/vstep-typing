'use client';

// Hồ sơ năng lực: /ho-so-nang-luc
// Average score per skill (0–10 scale) plotted against the user's target
// CEFR level threshold on a hand-built SVG radar chart, so weak skills
// stand out at a glance. All copy and visuals are original.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  SpeakerWaveIcon,
  MicrophoneIcon,
  PencilSquareIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import type {
  ListeningSession,
  ReadingSession,
  SpeakingSession,
  WritingSession,
} from '@/components/ProgressDashboard';
import VocabXpBar from '@/components/VocabXpBar';
import VocabFramePicker from '@/components/VocabFramePicker';
import type { VocabStats } from '@/lib/vocab-gamification';
import { fetchServerState, loadLocalStats } from '@/lib/vocab-client';

type Level = 'B1' | 'B2' | 'C1';

const LEVELS: { id: Level; threshold: number }[] = [
  { id: 'B1', threshold: 4.0 },
  { id: 'B2', threshold: 6.0 },
  { id: 'C1', threshold: 8.0 },
];

const LEVEL_STORAGE_KEY = 'vstep_target_level';

interface SkillStat {
  id: 'listen' | 'read' | 'speak' | 'write';
  name: string;
  href: string;
  avg: number | null; // 0–10, null when no scored sessions
  count: number;
  /** Writing only: AI essay score average (ai_score sessions). Never mixed
   * with typing accuracy — they measure different things. */
  aiAvg?: number | null;
  /** Writing only: typing accuracy average (accuracy sessions), 0–100. */
  accAvg?: number | null;
}

function mean(xs: number[]): number | null {
  const valid = xs.filter((x) => typeof x === 'number' && !isNaN(x));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function fmtGap(gap: number): string {
  const v = round1(Math.abs(gap)).toFixed(1);
  return gap >= 0 ? `+${v}` : `−${v}`;
}

/** Projected VSTEP level from a 0–10 mean score. */
function projectedLevel(score: number): string {
  if (score >= 8) return 'C1';
  if (score >= 6) return 'B2';
  if (score >= 4) return 'B1';
  return 'dưới B1';
}

/* ------------------------------ radar chart ------------------------------ */

function RadarChart({
  skills,
  threshold,
  level,
}: {
  skills: SkillStat[];
  threshold: number;
  level: Level;
}) {
  const W = 440;
  const H = 400;
  const cx = 220;
  const cy = 190;
  const R = 118;
  // 4 axes, clockwise from top: Nghe (top), Đọc (right), Nói (bottom), Viết (left)
  const ANGLES = [-90, 0, 90, 180];
  const LABEL_D = R + 54; // generous gap so labels never touch the chart

  const polar = (i: number, v: number): [number, number] => {
    const a = (ANGLES[i] * Math.PI) / 180;
    const r = (R * Math.max(0, Math.min(10, v))) / 10;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (vals: number[]) => vals.map((v, i) => polar(i, v).join(',')).join(' ');
  const labelPos = (i: number): [number, number] => {
    const a = (ANGLES[i] * Math.PI) / 180;
    return [cx + LABEL_D * Math.cos(a), cy + LABEL_D * Math.sin(a)];
  };

  const hasData = skills.some((s) => s.avg != null);
  const userVals = skills.map((s) => s.avg ?? 0);
  const targetVals = [threshold, threshold, threshold, threshold];
  const aria =
    `Biểu đồ radar 4 kỹ năng. ` +
    skills.map((s) => `${s.name}: ${s.avg != null ? s.avg.toFixed(1) : 'chưa có dữ liệu'}`).join(', ') +
    `. Ngưỡng mục tiêu ${level}: ${threshold.toFixed(1)}.`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={aria}
        style={{ width: '100%', maxWidth: 460, height: 'auto', display: 'block', margin: '0 auto' }}
      >
        <defs>
          <linearGradient id="radarUserFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.32 }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.06 }} />
          </linearGradient>
        </defs>
        {/* grid rings — hairline, very subtle */}
        {[2, 4, 6, 8, 10].map((t) => (
          <polygon
            key={t}
            points={poly([t, t, t])}
            fill="none"
            stroke="var(--line)"
            strokeWidth={t === 10 ? 1.4 : 1}
            opacity={t === 10 ? 0.7 : 0.4}
          />
        ))}
        {/* spokes */}
        {[0, 1, 2, 3].map((i) => {
          const [x, y] = polar(i, 10);
          return (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} opacity={0.4} />
          );
        })}
        {/* target threshold polygon (dashed neutral gray) */}
        <polygon
          points={poly(targetVals)}
          fill="none"
          stroke="var(--faint)"
          strokeWidth={2}
          strokeDasharray="6 6"
          strokeLinejoin="round"
        />
        {/* user average polygon */}
        {hasData ? (
          <polygon
            points={poly(userVals)}
            fill="url(#radarUserFill)"
            stroke="var(--accent-strong)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <polygon
            points={poly(userVals)}
            fill="none"
            stroke="var(--faint)"
            strokeWidth={2}
            strokeDasharray="6 5"
            strokeLinejoin="round"
            opacity={0.6}
          />
        )}
        {userVals.map((v, i) => {
          const [x, y] = polar(i, v);
          return hasData ? (
            <circle key={i} cx={x} cy={y} r={5} fill="var(--accent-strong)" stroke="var(--paper)" strokeWidth={2} />
          ) : (
            <circle key={i} cx={x} cy={y} r={4} fill="var(--paper)" stroke="var(--faint)" strokeWidth={1.5} opacity={0.6} />
          );
        })}
        {/* axis labels — skill name only, kept well clear of the chart */}
        {skills.map((s, i) => {
          const [x, y] = labelPos(i);
          // top → middle, right → start, bottom → middle, left → end
          const anchor = i === 0 || i === 2 ? 'middle' : i === 1 ? 'start' : 'end';
          return (
            <text
              key={s.id}
              x={x}
              y={y}
              textAnchor={anchor}
              fontSize={13.5}
              fontWeight={700}
              fill={s.avg != null ? 'var(--ink)' : 'var(--faint)'}
            >
              {s.name}
            </text>
          );
        })}
      </svg>
      <div
        style={{
          display: 'flex',
          gap: 26,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginTop: 18,
          fontSize: '0.85rem',
          color: 'var(--muted)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: 'var(--accent)',
              opacity: 0.5,
              border: '2px solid var(--accent-strong)',
            }}
          />
          Điểm trung bình của bạn
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 24,
              height: 0,
              borderTop: '2.5px dashed var(--faint)',
            }}
          />
          Ngưỡng {level} ({threshold.toFixed(1)})
        </span>
      </div>
    </div>
  );
}

/* ------------------------- vocabulary frames ------------------------- */

/** "Khung của bạn": XP bar + frame picker. Server stats when signed in,
 * localStorage fallback for guests. Shown outside the login gate below. */
function VocabSection() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<VocabStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session?.user) {
        if (!cancelled) setStats(loadLocalStats());
        return;
      }
      const server = await fetchServerState();
      if (!cancelled) setStats(server ? server.stats : loadLocalStats());
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Khung của bạn
      </h2>
      {!stats ? (
        <p style={{ color: 'var(--muted)', margin: 0 }}>Đang tải…</p>
      ) : (
        <>
          <VocabXpBar stats={stats} />
          <div style={{ marginTop: 18 }}>
            <VocabFramePicker
              stats={stats}
              onSelect={(frameId) =>
                setStats((s) => (s ? { ...s, activeFrame: frameId } : s))
              }
            />
          </div>
          <p style={{ margin: '14px 0 0', fontSize: '0.82rem', color: 'var(--faint)', lineHeight: 1.6 }}>
            Khung chỉ để trang trí quanh avatar, không ảnh hưởng điểm số hay gameplay. Mở khóa
            khung mới bằng cách lên cấp, giữ chuỗi ngày học hoặc chinh phục C1.
          </p>
        </>
      )}
    </div>
  );
}

/* --------------------------------- page --------------------------------- */

export default function CompetencyPage() {
  const { data: session, status } = useSession();
  const [level, setLevel] = useState<Level>('B2');
  const [writing, setWriting] = useState<WritingSession[]>([]);
  const [speaking, setSpeaking] = useState<SpeakingSession[]>([]);
  const [listening, setListening] = useState<ListeningSession[]>([]);
  const [reading, setReading] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LEVEL_STORAGE_KEY);
      if (raw === 'B1' || raw === 'B2' || raw === 'C1') setLevel(raw);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      setLoading(false);
      return;
    }
    setLoadError(false);
    // Fetch ALL pages (limit/offset loop) — the API defaults to 100, but the
    // averages below are over "tất cả buổi luyện", so a bare fetch would
    // silently drop older sessions.
    const fetchAll = async (url: string) => {
      const all: never[] = [];
      const LIMIT = 100;
      let offset = 0;
      for (;;) {
        const res = await fetch(`${url}?limit=${LIMIT}&offset=${offset}`);
        const data = await res.json();
        const sessions = (data?.sessions || []) as never[];
        all.push(...sessions);
        const total = typeof data?.total === 'number' ? data.total : sessions.length;
        offset += sessions.length;
        if (sessions.length === 0 || offset >= total) break;
      }
      return all;
    };
    Promise.all([
      fetchAll('/api/writing/history'),
      fetchAll('/api/speaking/history'),
      fetchAll('/api/listening/history'),
      fetchAll('/api/reading/history'),
    ])
      .then(([w, s, l, rd]) => {
        setWriting(w as WritingSession[]);
        setSpeaking(s as SpeakingSession[]);
        setListening(l as ListeningSession[]);
        setReading(rd as ReadingSession[]);
      })
      .catch(() => {
        // A failed fetch must NOT look like "no data" — surface an error.
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [status, session, retryKey]);

  function pickLevel(l: Level) {
    setLevel(l);
    try {
      window.localStorage.setItem(LEVEL_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }

  const threshold = LEVELS.find((l) => l.id === level)!.threshold;

  // Scale every skill to the 0–10 VSTEP scale; ignore sessions without a score.
  const listenAvg = mean(
    listening.filter((s) => s.total > 0 && s.score != null).map((s) => (s.score / s.total) * 10)
  );
  const readAvg = mean(
    reading.filter((s) => s.total > 0 && s.score != null).map((s) => (s.score / s.total) * 10)
  );
  const speakAvg = mean(speaking.filter((s) => s.overall != null).map((s) => Number(s.overall)));
  // Writing is TWO separate metrics — AI essay score (writing quality, 0–10)
  // and typing accuracy (keystroke fidelity, 0–100). They are never averaged
  // together: a 95% typing accuracy is not a 9.5 essay.
  const writeAiAvg = mean(
    writing.filter((s) => s.ai_score != null).map((s) => Number(s.ai_score))
  );
  const writeAccAvg = mean(
    writing.filter((s) => s.accuracy != null).map((s) => Number(s.accuracy))
  );
  // The radar shows the AI essay score — the actual Writing ability. Typing
  // accuracy is displayed separately in the Writing card.
  const writeAvg = writeAiAvg;
  // Count uses the SAME session set as the Writing metrics' union: every
  // session that contributed to either number.
  const writeCount = writing.filter((s) => s.ai_score != null || s.accuracy != null).length;

  const skills: SkillStat[] = [
    {
      id: 'listen',
      name: 'Nghe',
      href: '/listening',
      avg: listenAvg != null ? round1(listenAvg) : null,
      count: listening.filter((s) => s.total > 0 && s.score != null).length,
    },
    {
      id: 'read',
      name: 'Đọc',
      href: '/reading',
      avg: readAvg != null ? round1(readAvg) : null,
      count: reading.filter((s) => s.total > 0 && s.score != null).length,
    },
    {
      id: 'speak',
      name: 'Nói',
      href: '/speaking',
      avg: speakAvg != null ? round1(speakAvg) : null,
      count: speaking.filter((s) => s.overall != null).length,
    },
    {
      id: 'write',
      name: 'Viết',
      href: '/writing',
      avg: writeAvg != null ? round1(writeAvg) : null,
      count: writeCount,
      aiAvg: writeAiAvg != null ? round1(writeAiAvg) : null,
      accAvg: writeAccAvg != null ? round1(writeAccAvg) : null,
    },
  ];

  const icons = {
    listen: SpeakerWaveIcon,
    read: BookOpenIcon,
    speak: MicrophoneIcon,
    write: PencilSquareIcon,
  };

  const withData = skills.filter((s) => s.avg != null);
  const totalSessions = skills.reduce((a, s) => a + s.count, 0);
  const overall = withData.length > 0 ? round1(withData.reduce((a, s) => a + (s.avg as number), 0) / withData.length) : null;
  const below = skills.filter((s) => s.avg != null && (s.avg as number) < threshold);
  // Writing with typing data but no AI-scored essay is not "missing" — it has
  // a typing-accuracy metric, just no essay score yet.
  const missing = skills.filter(
    (s) => s.avg == null && !(s.id === 'write' && s.accAvg != null)
  );
  const allMet = withData.length === 4 && below.length === 0;

  function verdict(): string {
    // No exam-style score yet (e.g. typing-only user): the card must still
    // say something meaningful, never render empty.
    if (overall == null) {
      return 'Chưa có bài thi thử nào được chấm điểm để đánh giá tổng thể — hãy làm 1 đề thi thử để nhận đánh giá.';
    }
    const proj = projectedLevel(overall);
    if (allMet) {
      const next = level === 'B1' ? 'B2' : level === 'B2' ? 'C1' : null;
      return (
        `Cả 4 kỹ năng đều đã đạt ngưỡng ${level} — điểm trung bình ${overall.toFixed(1)}/10. ` +
        (next ? `Thử thách tiếp theo: hướng tới ${next}!` : 'Giữ vững phong độ nhé!')
      );
    }
    const gap = round1(threshold - overall);
    const weakList = below
      .map((s) => `${s.name} (${fmtGap((s.avg as number) - threshold)})`)
      .join(', ');
    let v =
      `Điểm trung bình ${withData.length === 4 ? '4 kỹ năng' : `${withData.length} kỹ năng có dữ liệu`}: ` +
      `${overall.toFixed(1)}/10 — đang ở ngưỡng ${proj}. ` +
      `Để chạm mục tiêu ${level}, bạn còn thiếu khoảng ${gap.toFixed(1)} điểm; ` +
      `${weakList} đang cần cố gắng nhất.`;
    if (missing.length > 0) {
      v += ` Chưa có dữ liệu ${missing.map((s) => s.name).join(', ')} — luyện thêm để hồ sơ đầy đủ hơn.`;
    }
    return v;
  }

  return (
    <main className="page-med">
      <div className="nav-top">
        <Link href="/progress" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Tiến độ
        </Link>
      </div>
      <p className="page-eyebrow">06 — Hồ sơ</p>
      <h1 className="page-title">Hồ sơ năng lực</h1>
      <p className="page-sub">
        Tổng hợp điểm trung bình từng kỹ năng qua tất cả buổi luyện, đặt cạnh ngưỡng
        điểm mục tiêu — để bạn thấy rõ kỹ năng nào đang vững, kỹ năng nào cần đầu tư thêm.
      </p>

      {loading ? (
        <p style={{ color: 'var(--muted)', marginTop: 18 }}>Đang tải…</p>
      ) : loadError ? (
        <div className="card empty" style={{ marginTop: 18 }}>
          <span className="icon-badge">
            <ExclamationTriangleIcon width={24} height={24} />
          </span>
          <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px' }}>
            Không tải được dữ liệu, thử lại
          </p>
          <p className="lead" style={{ margin: '0 auto 16px' }}>
            Không kết nối được tới máy chủ hoặc dữ liệu chưa đọc được. Dữ liệu
            của bạn vẫn còn nguyên — chỉ là lần tải này bị lỗi.
          </p>
          <button
            className="btn primary"
            onClick={() => {
              setLoading(true);
              setLoadError(false);
              setRetryKey((k) => k + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      ) : !session?.user ? (
        <div className="card empty" style={{ marginTop: 18 }}>
          <span className="icon-badge">
            <IdentificationIcon width={24} height={24} />
          </span>
          <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px' }}>
            Hồ sơ năng lực của riêng bạn
          </p>
          <p className="lead" style={{ margin: '0 auto 16px' }}>
            Đăng nhập bằng Google để xem điểm trung bình từng kỹ năng và so sánh với
            mục tiêu B1/B2/C1 của bạn.
          </p>
          <button className="btn primary" onClick={() => signIn('google')}>
            Đăng nhập bằng Google
          </button>
        </div>
      ) : totalSessions === 0 ? (
        <div className="card empty" style={{ marginTop: 18 }}>
          <span className="icon-badge">
            <ChartBarIcon width={24} height={24} />
          </span>
          <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px' }}>
            Chưa có dữ liệu để vẽ hồ sơ
          </p>
          <p className="lead" style={{ margin: '0 auto 16px' }}>
            Hãy luyện ít nhất một buổi ở bất kỳ kỹ năng nào — điểm số sẽ hiện lên
            biểu đồ ngay sau khi bạn nộp bài.
          </p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link className="btn primary" href="/listening">
              <SpeakerWaveIcon width={16} height={16} />
              Luyện Nghe
            </Link>
            <Link className="btn" href="/reading">
              <BookOpenIcon width={16} height={16} />
              Luyện Đọc
            </Link>
            <Link className="btn" href="/speaking">
              <MicrophoneIcon width={16} height={16} />
              Luyện Nói
            </Link>
            <Link className="btn" href="/writing">
              <PencilSquareIcon width={16} height={16} />
              Luyện Viết
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ---- target level selector ---- */}
          <div className="card" style={{ marginTop: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong style={{ fontSize: '1rem' }}>Mục tiêu của bạn</strong>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                  Ngưỡng {level}: <strong style={{ color: 'var(--accent-strong)' }}>{threshold.toFixed(1)}/10</strong> mỗi kỹ năng
                </p>
              </div>
              <div className="btn-row" role="group" aria-label="Chọn trình độ mục tiêu">
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    className={`btn${level === l.id ? ' primary' : ''}`}
                    style={{ padding: '8px 22px' }}
                    onClick={() => pickLevel(l.id)}
                    aria-pressed={level === l.id}
                  >
                    {l.id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ---- radar chart ---- */}
          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Biểu đồ năng lực
            </h2>
            <RadarChart skills={skills} threshold={threshold} level={level} />
          </div>

          {/* ---- verdict ---- */}
          <div
            className="card-soft"
            style={{
              marginTop: 14,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              borderLeft: '4px solid var(--accent)',
            }}
          >
            <span className="icon-badge sm" style={{ flexShrink: 0 }}>
              <ChartBarIcon width={18} height={18} />
            </span>
            <p style={{ margin: 0, lineHeight: 1.7, fontSize: '0.95rem' }}>{verdict()}</p>
          </div>

          {/* ---- per-skill detail cards ---- */}
          <h2 className="section-title">Chi tiết từng kỹ năng</h2>
          <div className="skill-grid">
            {skills.map((s) => {
              const Icon = icons[s.id];
              const met = s.avg != null && s.avg >= threshold;
              return (
                <div key={s.id} className="card" style={{ margin: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      rowGap: 8,
                      marginBottom: 16,
                    }}
                  >
                    <span className="icon-badge sm">
                      <Icon width={19} height={19} strokeWidth={1.8} />
                    </span>
                    <strong style={{ fontSize: '1.05rem' }}>Kỹ năng {s.name}</strong>
                    <span style={{ marginLeft: 'auto' }}>
                      {s.id === 'write' && s.avg == null && s.accAvg != null ? (
                        <span className="chip muted">Chưa có điểm AI</span>
                      ) : s.avg == null ? (
                        <span className="chip muted">Chưa có dữ liệu</span>
                      ) : met ? (
                        <span className="chip ok">
                          <CheckCircleIcon width={13} height={13} />
                          Đạt mục tiêu
                        </span>
                      ) : (
                        <span className="chip warn">
                          <ExclamationTriangleIcon width={13} height={13} />
                          Cần cố gắng
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '2rem',
                        fontWeight: 800,
                        color: 'var(--ink)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {s.avg != null ? s.avg.toFixed(1) : '—'}
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>/ 10</span>
                    <span style={{ color: 'var(--faint)', fontSize: '0.82rem', marginLeft: 'auto' }}>
                      {s.count} buổi luyện
                    </span>
                  </div>
                  {s.id === 'write' && s.accAvg != null && (
                    <p style={{ margin: '10px 0 0', fontSize: '0.88rem', color: 'var(--muted)' }}>
                      Độ chính xác gõ:{' '}
                      <strong style={{ color: 'var(--ink)' }}>{s.accAvg.toFixed(0)}%</strong>
                      <span style={{ color: 'var(--faint)' }}> — chỉ số luyện gõ, không phải điểm Viết</span>
                    </p>
                  )}
                  {s.id === 'write' && s.avg == null && s.accAvg != null && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: 'var(--faint)', lineHeight: 1.6 }}>
                      Chưa có bài Writing được chấm AI — làm một đề thi để có điểm Viết thật.
                    </p>
                  )}
                  {/* progress bar with target-threshold tick */}
                  <div style={{ marginTop: 16 }}>
                    <div
                      style={{
                        position: 'relative',
                        height: 7,
                        borderRadius: 999,
                        background: 'var(--paper-soft)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      {s.avg != null && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${Math.min(100, (s.avg / 10) * 100)}%`,
                            borderRadius: 999,
                            background: 'var(--accent)',
                          }}
                        />
                      )}
                      <div
                        title={`Ngưỡng ${level}: ${threshold.toFixed(1)}`}
                        style={{
                          position: 'absolute',
                          left: `${threshold * 10}%`,
                          top: -4,
                          bottom: -4,
                          width: 2,
                          marginLeft: -1,
                          borderRadius: 2,
                          background: 'var(--ink)',
                          opacity: 0.6,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        marginTop: 6,
                        height: 16,
                        fontSize: '0.72rem',
                        color: 'var(--faint)',
                      }}
                    >
                      <span style={{ position: 'absolute', left: 0 }}>0</span>
                      <span
                        style={{
                          position: 'absolute',
                          left: `${threshold * 10}%`,
                          transform: 'translateX(-50%)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ngưỡng {level} · {threshold.toFixed(1)}
                      </span>
                      <span style={{ position: 'absolute', right: 0 }}>10</span>
                    </div>
                  </div>
                  {s.avg != null && (
                    <p
                      style={{
                        margin: '12px 0 0',
                        fontSize: '0.88rem',
                        color: met ? 'var(--accent-strong)' : 'var(--muted)',
                        fontWeight: 600,
                      }}
                    >
                      {met
                        ? `Vượt ngưỡng ${level} ${fmtGap(s.avg - threshold)} điểm`
                        : `Còn thiếu ${fmtGap(s.avg - threshold).slice(1)} điểm nữa để chạm ${level}`}
                    </p>
                  )}
                  {s.id === 'write' && (
                    <p style={{ margin: '12px 0 0', fontSize: '0.78rem', color: 'var(--faint)', lineHeight: 1.6 }}>
                      * Điểm Viết là điểm AI chấm bài thi (Task 1 + Task 2). Độ chính xác gõ là
                      chỉ số riêng khi luyện gõ template — hai số không trộn vào nhau.
                    </p>
                  )}
                  <Link
                    href={s.href}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 16,
                      fontSize: '0.88rem',
                      fontWeight: 600,
                    }}
                  >
                    Luyện thêm {s.name.toLowerCase()}
                    <ArrowRightIcon width={14} height={14} />
                  </Link>
                </div>
              );
            })}
          </div>

          <p style={{ color: 'var(--faint)', fontSize: '0.78rem', marginTop: 18, lineHeight: 1.7 }}>
            Điểm trung bình là trung bình cộng của tất cả buổi luyện đã lưu. Thang điểm VSTEP
            mỗi kỹ năng là 0–10; trình độ chung thường lấy theo điểm trung bình các kỹ năng.
          </p>
        </>
      )}
      {/* Vocabulary section: always shown (server stats when signed in,
          localStorage fallback for guests). Streak lives only here, in the
          vocab hub and in the profile — never on the homepage. */}
      {!loading && !loadError && <VocabSection />}
    </main>
  );
}

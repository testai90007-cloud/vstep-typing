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
  SpeakerWaveIcon,
  MicrophoneIcon,
  PencilSquareIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';

type Level = 'B1' | 'B2' | 'C1';

const LEVELS: { id: Level; threshold: number }[] = [
  { id: 'B1', threshold: 4.0 },
  { id: 'B2', threshold: 6.0 },
  { id: 'C1', threshold: 8.0 },
];

const LEVEL_STORAGE_KEY = 'vstep_target_level';

interface WritingSession {
  accuracy: number;
  created_at: string;
}
interface SpeakingSession {
  overall: number;
  created_at: string;
}
interface ListeningSession {
  score: number;
  total: number;
  created_at: string;
}

interface SkillStat {
  id: 'listen' | 'speak' | 'write';
  name: string;
  href: string;
  avg: number | null; // 0–10, null when no scored sessions
  count: number;
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
  const ANGLES = [-90, 30, 150]; // Nghe (top), Nói (bottom-right), Viết (bottom-left)
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
  const targetVals = [threshold, threshold, threshold];
  const aria =
    `Biểu đồ radar 3 kỹ năng. ` +
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
        {[0, 1, 2].map((i) => {
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
          const anchor = i === 0 ? 'middle' : i === 1 ? 'start' : 'end';
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

/* --------------------------------- page --------------------------------- */

export default function CompetencyPage() {
  const { data: session, status } = useSession();
  const [level, setLevel] = useState<Level>('B2');
  const [writing, setWriting] = useState<WritingSession[]>([]);
  const [speaking, setSpeaking] = useState<SpeakingSession[]>([]);
  const [listening, setListening] = useState<ListeningSession[]>([]);
  const [loading, setLoading] = useState(true);

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
    Promise.all([
      fetch('/api/writing/history').then((r) => r.json()),
      fetch('/api/speaking/history').then((r) => r.json()),
      fetch('/api/listening/history').then((r) => r.json()),
    ])
      .then(([w, s, l]) => {
        setWriting(w.sessions || []);
        setSpeaking(s.sessions || []);
        setListening(l.sessions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, session]);

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
  const speakAvg = mean(speaking.filter((s) => s.overall != null).map((s) => Number(s.overall)));
  const writeAvg = mean(writing.filter((s) => s.accuracy != null).map((s) => Number(s.accuracy) / 10));

  const skills: SkillStat[] = [
    {
      id: 'listen',
      name: 'Nghe',
      href: '/listening',
      avg: listenAvg != null ? round1(listenAvg) : null,
      count: listening.filter((s) => s.total > 0 && s.score != null).length,
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
      count: writing.filter((s) => s.accuracy != null).length,
    },
  ];

  const icons = {
    listen: SpeakerWaveIcon,
    speak: MicrophoneIcon,
    write: PencilSquareIcon,
  };

  const withData = skills.filter((s) => s.avg != null);
  const totalSessions = skills.reduce((a, s) => a + s.count, 0);
  const overall = withData.length > 0 ? round1(withData.reduce((a, s) => a + (s.avg as number), 0) / withData.length) : null;
  const below = skills.filter((s) => s.avg != null && (s.avg as number) < threshold);
  const missing = skills.filter((s) => s.avg == null);
  const allMet = withData.length === 3 && below.length === 0;

  function verdict(): string {
    if (overall == null) return '';
    const proj = projectedLevel(overall);
    if (allMet) {
      const next = level === 'B1' ? 'B2' : level === 'B2' ? 'C1' : null;
      return (
        `Cả 3 kỹ năng đều đã đạt ngưỡng ${level} — điểm trung bình ${overall.toFixed(1)}/10. ` +
        (next ? `Thử thách tiếp theo: hướng tới ${next}!` : 'Giữ vững phong độ nhé!')
      );
    }
    const gap = round1(threshold - overall);
    const weakList = below
      .map((s) => `${s.name} (${fmtGap((s.avg as number) - threshold)})`)
      .join(', ');
    let v =
      `Điểm trung bình ${withData.length === 3 ? '3 kỹ năng' : `${withData.length} kỹ năng có dữ liệu`}: ` +
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
                      {s.avg == null ? (
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
                      * Điểm Viết ở đây là độ chính xác khi gõ theo template — chưa phải điểm bài thi Writing thật.
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
    </main>
  );
}

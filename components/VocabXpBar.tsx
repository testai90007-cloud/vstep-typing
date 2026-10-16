'use client';

// VocabXpBar — learner level + XP progress + streak for the Vocabulary
// section. Shows: rank name + Lv, XP progress bar to the next level, and
// the study streak (flame icon only, no other emoji). No decorative
// animation. Streak is shown ONLY inside the Vocabulary area (hub /
// profile / progress) — never on the homepage.

import { useEffect, useState } from 'react';
import { LEVELS, levelForXp, type VocabStats } from '@/lib/vocab-gamification';
import { loadLocalStats } from '@/lib/vocab-client';

export default function VocabXpBar({ stats: statsProp }: { stats?: VocabStats }) {
  const [localStats, setLocalStats] = useState<VocabStats | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (statsProp) return;
    try {
      const s = loadLocalStats();
      if (s) setLocalStats(s);
      else setLoadFailed(true);
    } catch {
      setLoadFailed(true);
    }
  }, [statsProp]);

  const stats = statsProp ?? localStats;

  if (!stats) {
    return loadFailed ? (
      <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
        Không tải được điểm XP — thử tải lại trang.
      </p>
    ) : (
      <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }} aria-busy="true">
        Đang tải điểm XP…
      </p>
    );
  }

  const level = levelForXp(stats.xp);
  const cur = LEVELS[level - 1] ?? LEVELS[0];
  // LEVELS is 0-indexed, so LEVELS[level] is the NEXT level; undefined at max.
  const next = LEVELS[level];
  const atMax = !next;
  const pct = atMax
    ? 100
    : Math.min(100, Math.max(0, ((stats.xp - cur.xp) / (next.xp - cur.xp)) * 100));

  return (
    <div className="vx-bar" aria-label={`Cấp bậc từ vựng: ${cur.name}, cấp ${level}`}>
      <div className="vx-bar-top">
        <strong>
          Lv {level} · {cur.name}
        </strong>
        <span className="vx-streak" title="Chuỗi ngày học từ vựng liên tiếp">
          🔥 {stats.streak} ngày
        </span>
      </div>
      <div
        className="vx-track"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={atMax ? 'Đã đạt cấp tối đa' : `Tiến độ lên cấp ${level + 1}`}
      >
        <div className="vx-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="vx-xp">
        {atMax ? (
          <>
            Đã đạt cấp tối đa · {stats.xp.toLocaleString('vi-VN')} XP
          </>
        ) : (
          <>
            {stats.xp.toLocaleString('vi-VN')} / {next.xp.toLocaleString('vi-VN')} XP · còn{' '}
            {(next.xp - stats.xp).toLocaleString('vi-VN')} XP lên Lv {level + 1} · {next.name}
          </>
        )}
      </p>
      <style jsx>{`
        .vx-bar {
          min-width: 0;
        }
        .vx-bar-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .vx-streak {
          color: var(--muted);
          font-size: 0.88rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .vx-track {
          height: 8px;
          border-radius: 999px;
          background: var(--paper-soft);
          border: 1px solid var(--line);
          overflow: hidden;
          margin-top: 10px;
        }
        .vx-fill {
          height: 100%;
          border-radius: 999px;
          background: var(--accent);
        }
        .vx-xp {
          margin: 8px 0 0;
          font-size: 0.82rem;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}

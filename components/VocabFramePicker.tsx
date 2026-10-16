'use client';

// VocabFramePicker — grid of unlockable avatar frames for the Vocabulary
// section. Frames are cosmetic only (border + faint tint, no glow) and
// never affect gameplay or scores. Selecting an unlocked frame persists
// via POST /api/vocab/progress { action: 'setFrame', frameId }; when the
// API is unavailable it falls back to localStorage. The parent owns the
// in-memory stats and syncs via onSelect — it must NOT re-POST.

import { useState } from 'react';
import { UserIcon } from '@heroicons/react/24/outline';
import { FRAMES, type Frame, type VocabStats } from '@/lib/vocab-gamification';
import { saveLocalStats } from '@/lib/vocab-client';

/** Border colors for the 8 frames. Only used for frame borders/tints. */
export const FRAME_COLORS: Record<string, string> = {
  wood: '#8b5a2b',
  bronze: '#b87333',
  silver: '#c0c0c0',
  gold: '#ffd700',
  platinum: '#e5e4e2',
  diamond: '#b9f2ff',
  fire: '#ff6b35',
  crown: '#ffd700',
};

/** Avatar circle wrapped in a frame border. Styling is inline so the
 * class `vocab-frame-<id>` can be used anywhere without globals.css. */
export function FrameAvatar({
  frameId,
  size = 48,
  children,
}: {
  frameId: string;
  size?: number;
  children?: React.ReactNode;
}) {
  const color = FRAME_COLORS[frameId] ?? 'var(--line)';
  const bg = color.startsWith('#') ? `${color}14` : 'var(--paper-soft)';
  return (
    <span
      className={`vocab-frame-${frameId}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `3px solid ${color}`,
        backgroundColor: bg,
        color: 'var(--muted)',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {children ?? <UserIcon width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} />}
    </span>
  );
}

function unlockLabel(frame: Frame): string {
  if (frame.unlock === 'level') return `Đạt Lv ${frame.value}`;
  if (frame.unlock === 'streak') return `Chuỗi ${frame.value} ngày`;
  return 'Chinh phục C1';
}

export default function VocabFramePicker({
  stats,
  onSelect,
}: {
  stats: VocabStats;
  onSelect: (frameId: string) => void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const unlocked = new Set(stats.framesUnlocked);

  async function pick(frame: Frame) {
    if (!unlocked.has(frame.id) || frame.id === stats.activeFrame || savingId) return;
    setSavingId(frame.id);
    try {
      const res = await fetch('/api/vocab/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setFrame', frameId: frame.id }),
      });
      if (!res.ok) throw new Error(`setFrame ${res.status}`);
    } catch {
      // API not deployed / signed out: keep the choice locally.
      saveLocalStats({ ...stats, activeFrame: frame.id });
    } finally {
      setSavingId(null);
    }
    onSelect(frame.id);
  }

  return (
    <div>
      <div className="vf-grid" role="group" aria-label="Chọn khung avatar">
        {FRAMES.map((frame) => {
          const isUnlocked = unlocked.has(frame.id);
          const isActive = stats.activeFrame === frame.id;
          const isSaving = savingId === frame.id;
          return (
            <button
              key={frame.id}
              type="button"
              className="vf-cell"
              disabled={!isUnlocked || isSaving || isActive}
              aria-pressed={isActive}
              aria-label={
                isActive
                  ? `${frame.name} — đang dùng`
                  : isUnlocked
                    ? `Dùng ${frame.name}`
                    : `${frame.name} — chưa mở: ${unlockLabel(frame)}`
              }
              onClick={() => pick(frame)}
            >
              <FrameAvatar frameId={frame.id} size={56} />
              <strong className="vf-name">{frame.name}</strong>
              {isActive ? (
                <span className="chip ok">Đang dùng</span>
              ) : isSaving ? (
                <span className="vf-sub">Đang lưu…</span>
              ) : isUnlocked ? (
                <span className="vf-sub">Dùng khung này</span>
              ) : (
                <span className="vf-sub">{unlockLabel(frame)}</span>
              )}
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .vf-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
          gap: 12px;
        }
        .vf-cell {
          appearance: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          padding: 14px 8px;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          color: var(--ink);
          cursor: pointer;
          font: inherit;
          text-align: center;
        }
        .vf-cell:hover {
          border-color: var(--faint);
        }
        .vf-cell[aria-pressed='true'] {
          border: 2px solid var(--ink);
        }
        .vf-cell:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .vf-cell:disabled:hover {
          border-color: var(--line);
        }
        .vf-name {
          font-size: 0.88rem;
          line-height: 1.3;
        }
        .vf-sub {
          font-size: 0.78rem;
          color: var(--muted);
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

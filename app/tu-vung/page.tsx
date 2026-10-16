'use client';

// Từ vựng — hub: /tu-vung

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import {
  VOCAB_LEVELS,
  VOCAB_COUNTS,
  getVocabLevel,
  searchVocab,
  type VocabLevel,
} from '@/lib/vocab';
import { loadLocalProgress, loadLocalStats, type VocabProgressMap } from '@/lib/vocab-client';
import { type VocabStats } from '@/lib/vocab-gamification';
import VocabXpBar from '@/components/VocabXpBar';
import VocabGameCards from '@/components/games/VocabGameCards';


export default function VocabHubPage() {
  const [progress, setProgress] = useState<VocabProgressMap>({});
  const [stats, setStats] = useState<VocabStats | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    try {
      setProgress(loadLocalProgress());
    } catch {
      /* localStorage không đọc được — coi như chưa có tiến độ */
    }
    try {
      setStats(loadLocalStats());
    } catch {
      /* không có thống kê — thanh XP hiện 0 XP */
    }
  }, []);

  const perLevel = useMemo(() => {
    const out: Record<string, { mastered: number; learning: number }> = {};
    for (const lvl of VOCAB_LEVELS) out[lvl] = { mastered: 0, learning: 0 };
    for (const [word, entry] of Object.entries(progress)) {
      const lvl = getVocabLevel(word);
      if (!lvl || !out[lvl]) continue;
      if (entry.status === 'mastered') out[lvl].mastered += 1;
      else if (entry.status === 'learning') out[lvl].learning += 1;
    }
    return out;
  }, [progress]);

  // Cấp độ đang học dở = cấp độ có nhiều từ "Đang học" nhất; chưa có thì A1.
  const continueLevel: VocabLevel = useMemo(() => {
    let best: VocabLevel = 'A1';
    let bestCount = 0;
    for (const lvl of VOCAB_LEVELS) {
      const c = perLevel[lvl]?.learning ?? 0;
      if (c > bestCount) {
        bestCount = c;
        best = lvl;
      }
    }
    return best;
  }, [perLevel]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    try {
      return searchVocab(q, 8);
    } catch {
      return [];
    }
  }, [query]);

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <p className="page-eyebrow">Từ vựng</p>
      <h1 className="page-title">Học từ vựng</h1>
      <p className="page-sub">
        8.842 từ chia theo cấp độ A1–C1. Tra nghĩa, nghe phát âm, xem gốc từ, chơi game và
        tích điểm để lên cấp.
      </p>

      <VocabXpBar stats={stats ?? undefined} />

      <div className="btn-row" style={{ marginTop: 20 }}>
        <Link
          href={`/tu-vung/choi?game=flashcards&level=${continueLevel}`}
          className="btn primary"
        >
          Học tiếp — {continueLevel}
        </Link>
        <Link href="/tu-vung/choi?game=flashcards&review=1" className="btn">
          Ôn tập
        </Link>
      </div>

      <div style={{ marginTop: 26 }}>
        <label htmlFor="vocab-search" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Tìm từ
        </label>
        <input
          id="vocab-search"
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nhập từ tiếng Anh, ví dụ: democracy"
          aria-label="Tìm từ vựng"
          autoComplete="off"
          style={{ marginTop: 8, width: '100%' }}
        />
        {query.trim() ? (
          <div aria-live="polite" style={{ marginTop: 10 }}>
            {results.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                Không tìm thấy từ nào cho “{query.trim()}”.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {results.map(({ word: w, level: lvl }) => (
                  <li key={w} style={{ borderBottom: '1px solid var(--line)' }}>
                    <Link
                      href={`/tu-vung/tu/${encodeURIComponent(w)}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '12px 4px',
                        textDecoration: 'none',
                        color: 'var(--ink)',
                        minHeight: 44,
                        alignItems: 'center',
                      }}
                    >
                      <span>{w}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{lvl}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <h2 style={{ fontSize: '1.15rem', margin: '32px 0 14px' }}>Chọn cấp độ</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {VOCAB_LEVELS.map((lvl) => {
          const total = VOCAB_COUNTS[lvl] ?? 0;
          const mastered = perLevel[lvl]?.mastered ?? 0;
          const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
          return (
            <Link
              key={lvl}
              href={`/tu-vung/${lvl}`}
              className="card-soft"
              style={{ padding: 16, textDecoration: 'none', color: 'var(--ink)', display: 'block' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: '1.4rem' }}>{lvl}</strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{total} từ</span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: '0.88rem', color: 'var(--muted)' }}>
                Đã thuộc {mastered} / {total} ({pct}%)
              </p>
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Tiến độ đã thuộc cấp ${lvl}`}
                style={{
                  marginTop: 10,
                  height: 8,
                  borderRadius: 999,
                  background: 'var(--paper-soft)',
                  border: '1px solid var(--line)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    borderRadius: 999,
                  }}
                />
              </div>
            </Link>
          );
        })}
      </div>

      <VocabGameCards level={continueLevel} />
    </main>
  );
}

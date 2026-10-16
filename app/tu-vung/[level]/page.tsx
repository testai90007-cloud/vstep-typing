'use client';

// Danh sách từ theo cấp độ: /tu-vung/[level]?filter=...&page=...

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams, notFound } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { VOCAB_LEVELS, VOCAB_COUNTS, getVocabWords, type VocabLevel } from '@/lib/vocab';
import { loadLocalProgress, type VocabProgressMap } from '@/lib/vocab-client';

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'new', label: 'Mới' },
  { key: 'learning', label: 'Đang học' },
  { key: 'mastered', label: 'Đã thuộc' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

const PAGE_SIZE = 100;

function statusOf(progress: VocabProgressMap, word: string): 'new' | 'learning' | 'mastered' {
  return progress[word]?.status ?? 'new';
}

function LevelList() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [progress, setProgress] = useState<VocabProgressMap>({});

  const rawLevel = params.level;
  const levelParam = Array.isArray(rawLevel) ? rawLevel[0] : rawLevel;
  if (!VOCAB_LEVELS.includes(levelParam as VocabLevel)) {
    notFound();
  }
  const level = levelParam as VocabLevel;

  useEffect(() => {
    try {
      setProgress(loadLocalProgress());
    } catch {
      /* localStorage không đọc được — coi như chưa có tiến độ */
    }
  }, []);

  const words = useMemo(() => {
    try {
      return getVocabWords(level);
    } catch {
      return [];
    }
  }, [level]);

  const filterParam = searchParams.get('filter');
  const filter: FilterKey = FILTERS.some((f) => f.key === filterParam)
    ? (filterParam as FilterKey)
    : 'all';

  const filtered = useMemo(() => {
    if (filter === 'all') return words;
    return words.filter((w) => statusOf(progress, w) === filter);
  }, [words, progress, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const parsedPage = parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(parsedPage) ? Math.min(Math.max(1, parsedPage), totalPages) : 1;
  const pageWords = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goTo = (f: FilterKey, p: number) => {
    router.push(`${pathname}?filter=${f}&page=${p}`);
  };

  const total = VOCAB_COUNTS[level] ?? words.length;

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/tu-vung" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Từ vựng
        </Link>
      </div>
      <p className="page-eyebrow">Từ vựng — {level}</p>
      <h1 className="page-title">Từ vựng {level}</h1>
      <p className="page-sub">
        {total} từ, sắp xếp A–Z. Bấm vào từ để xem nghĩa, phát âm, gốc từ và từ đồng /
        trái nghĩa.
      </p>

      <div className="btn-row" style={{ marginBottom: 20 }}>
        <Link href={`/tu-vung/choi?game=flashcards&level=${level}`} className="btn primary">
          Chơi game với cấp độ này
        </Link>
      </div>

      <div className="seg-tabs" role="tablist" aria-label="Lọc theo trạng thái học">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => goTo(f.key, 1)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p aria-live="polite" style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '12px 0 0' }}>
        {filtered.length} từ
        {filter !== 'all' ? ` — ${FILTERS.find((f) => f.key === filter)?.label}` : ''}
        {` · Trang ${page} / ${totalPages}`}
      </p>

      {pageWords.length === 0 ? (
        <p style={{ marginTop: 24, color: 'var(--muted)' }}>
          {filter === 'all'
            ? 'Cấp độ này chưa có từ nào.'
            : 'Chưa có từ nào ở trạng thái này. Hãy học thêm để từ xuất hiện ở đây.'}
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: '16px 0 0',
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 8,
          }}
        >
          {pageWords.map((w) => {
            const st = statusOf(progress, w);
            const dotColor =
              st === 'mastered'
                ? 'var(--correct)'
                : st === 'learning'
                  ? 'var(--warn)'
                  : 'var(--faint)';
            const label = st === 'mastered' ? 'Đã thuộc' : st === 'learning' ? 'Đang học' : 'Mới';
            return (
              <li key={w}>
                <Link
                  href={`/tu-vung/tu/${encodeURIComponent(w)}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    textDecoration: 'none',
                    color: 'var(--ink)',
                    minHeight: 44,
                    background: 'var(--paper)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: dotColor,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--muted)', flexShrink: 0 }}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Phân trang"
          style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 24, flexWrap: 'wrap' }}
        >
          <Link
            href={`?filter=${filter}&page=${page - 1}`}
            aria-disabled={page <= 1}
            className="btn"
            style={page <= 1 ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
          >
            Trang trước
          </Link>
          <span style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
            Trang {page} / {totalPages}
          </span>
          <Link
            href={`?filter=${filter}&page=${page + 1}`}
            aria-disabled={page >= totalPages}
            className="btn"
            style={page >= totalPages ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
          >
            Trang sau
          </Link>
        </nav>
      ) : null}
    </main>
  );
}

export default function VocabLevelPage() {
  return (
    <Suspense fallback={<main className="page"><p aria-live="polite">Đang tải danh sách từ…</p></main>}>
      <LevelList />
    </Suspense>
  );
}

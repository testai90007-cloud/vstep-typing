'use client';

// Personal learning dashboard: /progress — data fetching + auth shell.
// The dashboard UI itself lives in components/ProgressDashboard.tsx.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { ArrowLeftIcon, ChartBarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { DashboardView } from '@/components/ProgressDashboard';
import VocabXpBar from '@/components/VocabXpBar';
import type { VocabStats } from '@/lib/vocab-gamification';
import { fetchServerState, loadLocalProgress, loadLocalStats } from '@/lib/vocab-client';
import type {
  HistoryTotals,
  ListeningSession,
  ReadingSession,
  SpeakingSession,
  WritingSession,
} from '@/components/ProgressDashboard';

/* --------------------------- vocabulary section --------------------------- */

/** "Từ vựng" on /progress: mastered count / 8.842, XP, rank, streak.
 * Server stats when signed in, localStorage fallback for guests. */
function VocabSection() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<VocabStats | null>(null);
  const [mastered, setMastered] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session?.user) {
        if (cancelled) return;
        setStats(loadLocalStats());
        const local = loadLocalProgress();
        setMastered(Object.values(local).filter((e) => e.status === 'mastered').length);
        return;
      }
      const server = await fetchServerState();
      if (cancelled) return;
      if (server) {
        setStats(server.stats);
        setMastered(Object.values(server.progress).filter((e) => e.status === 'mastered').length);
      } else {
        setStats(loadLocalStats());
        const local = loadLocalProgress();
        setMastered(Object.values(local).filter((e) => e.status === 'mastered').length);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Từ vựng
      </h2>
      {!stats ? (
        <p style={{ color: 'var(--muted)', margin: 0 }}>Đang tải…</p>
      ) : (
        <>
          {mastered != null && (
            <p style={{ margin: '0 0 14px', fontSize: '0.95rem' }}>
              Từ đã thuộc:{' '}
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                {mastered.toLocaleString('vi-VN')}
              </strong>{' '}
              / 8.842
            </p>
          )}
          <VocabXpBar stats={stats} />
          <Link href="/tu-vung" className="btn" style={{ marginTop: 14 }}>
            Học từ vựng
          </Link>
        </>
      )}
    </div>
  );
}

export default function ProgressPage() {

  const { data: session, status } = useSession();
  const [writing, setWriting] = useState<WritingSession[]>([]);
  const [speaking, setSpeaking] = useState<SpeakingSession[]>([]);
  const [listening, setListening] = useState<ListeningSession[]>([]);
  const [reading, setReading] = useState<ReadingSession[]>([]);
  const [noDb, setNoDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [totals, setTotals] = useState<HistoryTotals>({
    writing: null,
    speaking: null,
    listening: null,
    reading: null,
  });
  const [loadingMore, setLoadingMore] = useState<
    Partial<Record<'writing' | 'speaking' | 'listening' | 'reading', boolean>>
  >({});
  // Target level for the skill progress bars (visual only; shared with /ho-so-nang-luc).
  const [targetLevel, setTargetLevel] = useState({ id: 'B2', threshold: 6.0 });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('vstep_target_level');
      const found = [
        { id: 'B1', threshold: 4.0 },
        { id: 'B2', threshold: 6.0 },
        { id: 'C1', threshold: 8.0 },
      ].find((l) => l.id === raw);
      if (found) setTargetLevel(found);
    } catch {
      /* localStorage unavailable — keep default B2 */
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      setLoading(false);
      return;
    }
    setLoadError(false);
    Promise.all([
      fetch('/api/writing/history?limit=100&offset=0').then((r) => r.json()),
      fetch('/api/speaking/history?limit=100&offset=0').then((r) => r.json()),
      fetch('/api/listening/history?limit=100&offset=0').then((r) => r.json()),
      fetch('/api/reading/history?limit=100&offset=0').then((r) => r.json()),
    ])
      .then(([w, s, l, rd]) => {
        setWriting(w.sessions || []);
        setSpeaking(s.sessions || []);
        setListening(l.sessions || []);
        setReading(rd.sessions || []);
        setTotals({
          writing: typeof w.total === 'number' ? w.total : null,
          speaking: typeof s.total === 'number' ? s.total : null,
          listening: typeof l.total === 'number' ? l.total : null,
          reading: typeof rd.total === 'number' ? rd.total : null,
        });
        if (
          w.reason === 'no-database' ||
          s.reason === 'no-database' ||
          l.reason === 'no-database' ||
          rd.reason === 'no-database'
        )
          setNoDb(true);
      })
      .catch(() => {
        // A failed fetch must NOT look like "no sessions" — surface an error.
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [status, session, retryKey]);

  // Load the next page (100) for one skill and append it, deduped by id.
  const loadMore = useCallback(
    async (skill: 'writing' | 'speaking' | 'listening' | 'reading') => {
      const current = { writing, speaking, listening, reading }[skill];
      setLoadingMore((m) => ({ ...m, [skill]: true }));
      try {
        const res = await fetch(`/api/${skill}/history?limit=100&offset=${current.length}`);
        const data = await res.json().catch(() => null);
        const incoming = (data?.sessions || []) as { id: number }[];
        const seen = new Set(current.map((s) => s.id));
        const fresh = incoming.filter((s) => !seen.has(s.id));
        if (skill === 'writing') setWriting((prev) => [...prev, ...(fresh as WritingSession[])]);
        else if (skill === 'speaking')
          setSpeaking((prev) => [...prev, ...(fresh as SpeakingSession[])]);
        else if (skill === 'listening')
          setListening((prev) => [...prev, ...(fresh as ListeningSession[])]);
        else setReading((prev) => [...prev, ...(fresh as ReadingSession[])]);
        if (typeof data?.total === 'number') {
          setTotals((t) => ({ ...t, [skill]: data.total as number }));
        }
      } catch {
        /* keep existing data; the button stays available for retry */
      } finally {
        setLoadingMore((m) => ({ ...m, [skill]: false }));
      }
    },
    [writing, speaking, listening, reading]
  );

  const userName = session?.user?.name || session?.user?.email || 'Bạn';
  const userInitial = (session?.user?.name || session?.user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>

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
            <ChartBarIcon width={24} height={24} />
          </span>
          <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px' }}>
            Theo dõi tiến độ của riêng bạn
          </p>
          <p className="lead" style={{ margin: '0 auto 16px' }}>
            Đăng nhập bằng Google để xem thống kê học tập: số buổi luyện, chuỗi ngày học liên tiếp
            và lịch sử chi tiết từng kỹ năng.
          </p>
          <button className="btn primary" onClick={() => signIn('google')}>
            Đăng nhập bằng Google
          </button>
          <p style={{ color: 'var(--faint)', fontSize: '0.8rem', margin: '14px 0 0' }}>
            Dữ liệu lưu theo tài khoản nên đổi máy hay trình duyệt vẫn còn nguyên.
          </p>
        </div>
      ) : (
        <DashboardView
          data={{ writing, speaking, listening, reading }}
          targetLevel={targetLevel}
          noDb={noDb}
          userName={userName}
          userInitial={userInitial}
          userImage={session.user.image}
          totals={totals}
          onLoadMore={loadMore}
          loadingMore={loadingMore}
        />
      )}
      {/* Vocabulary section: always shown once the page itself loaded
          (server stats when signed in, localStorage fallback for guests).
          Streak lives only here, in the vocab hub and in the profile —
          never on the homepage. */}
      {!loading && !loadError && <VocabSection />}
    </main>
  );
}

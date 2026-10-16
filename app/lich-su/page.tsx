'use client';

// Lịch sử làm bài: /lich-su — searchable, filterable, sortable table of every
// saved session across the 4 skills, with row detail and delete.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { ArrowLeftIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import HistoryTable, { type SkillId } from '@/components/HistoryTable';
import type {
  HistoryTotals,
  ListeningSession,
  ReadingSession,
  SpeakingSession,
  WritingSession,
} from '@/components/ProgressDashboard';

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const [writing, setWriting] = useState<WritingSession[]>([]);
  const [speaking, setSpeaking] = useState<SpeakingSession[]>([]);
  const [listening, setListening] = useState<ListeningSession[]>([]);
  const [reading, setReading] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [totals, setTotals] = useState<HistoryTotals>({
    writing: null,
    speaking: null,
    listening: null,
    reading: null,
  });
  const [loadingMore, setLoadingMore] = useState(false);

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
      })
      .catch(() => {
        // A failed fetch must NOT look like "no sessions" — surface an error.
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [status, session, retryKey]);

  // Load the next page (100) for every skill that still has more sessions.
  const loadMoreAll = useCallback(async () => {
    const current = { writing, speaking, listening, reading };
    setLoadingMore(true);
    try {
      await Promise.all(
        (['writing', 'speaking', 'listening', 'reading'] as const).map(async (skill) => {
          const total = totals[skill];
          if (total == null || current[skill].length >= total) return;
          try {
            const res = await fetch(
              `/api/${skill}/history?limit=100&offset=${current[skill].length}`
            );
            const data = await res.json().catch(() => null);
            const incoming = (data?.sessions || []) as { id: number }[];
            const seen = new Set(current[skill].map((s) => s.id));
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
            /* keep existing data for this skill; the button stays for retry */
          }
        })
      );
    } finally {
      setLoadingMore(false);
    }
  }, [writing, speaking, listening, reading, totals]);

  const handleDelete = useCallback(async (skill: SkillId, id: number) => {
    try {
      const res = await fetch('/api/history/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill, id }),
      });
      if (!res.ok) return false;
      if (skill === 'writing') setWriting((a) => a.filter((s) => s.id !== id));
      else if (skill === 'speaking') setSpeaking((a) => a.filter((s) => s.id !== id));
      else if (skill === 'listening') setListening((a) => a.filter((s) => s.id !== id));
      else setReading((a) => a.filter((s) => s.id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/progress" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Tiến độ
        </Link>
      </div>
      <p className="page-eyebrow">08 — Lịch sử</p>
      <h1 className="page-title">Lịch sử làm bài</h1>
      <p className="lead">
        Toàn bộ các lần lưu bài làm của bạn ở cả 4 kỹ năng — tìm kiếm, lọc, sắp xếp
        và xóa những bản không cần thiết để dọn dẹp dữ liệu.
      </p>

      {loading ? (
        <p style={{ color: 'var(--muted)', marginTop: 18 }}>Đang tải…</p>
      ) : loadError ? (
        <div className="card empty" style={{ marginTop: 18, textAlign: 'center' }}>
          <span className="icon-badge" style={{ margin: '0 auto 12px' }}>
            <ExclamationTriangleIcon width={24} height={24} />
          </span>
          <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px' }}>
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
        <div className="card empty" style={{ marginTop: 18, textAlign: 'center' }}>
          <span className="icon-badge" style={{ margin: '0 auto 12px' }}>
            <ClockIcon width={24} height={24} />
          </span>
          <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px' }}>
            Đăng nhập để xem lịch sử
          </p>
          <p className="lead" style={{ margin: '0 auto 16px' }}>
            Lịch sử làm bài được lưu theo tài khoản Google của bạn.
          </p>
          <button className="btn primary" onClick={() => signIn('google')}>
            Đăng nhập bằng Google
          </button>
        </div>
      ) : (
        <HistoryTable
          data={{ writing, speaking, listening, reading }}
          onDelete={handleDelete}
          totals={totals}
          onLoadMore={loadMoreAll}
          loadingMore={loadingMore}
        />
      )}
    </main>
  );
}

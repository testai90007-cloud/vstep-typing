'use client';

// Personal learning dashboard: /progress — data fetching + auth shell.
// The dashboard UI itself lives in components/ProgressDashboard.tsx.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { ArrowLeftIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { DashboardView } from '@/components/ProgressDashboard';
import type {
  ListeningSession,
  ReadingSession,
  SpeakingSession,
  WritingSession,
} from '@/components/ProgressDashboard';

export default function ProgressPage() {

  const { data: session, status } = useSession();
  const [writing, setWriting] = useState<WritingSession[]>([]);
  const [speaking, setSpeaking] = useState<SpeakingSession[]>([]);
  const [listening, setListening] = useState<ListeningSession[]>([]);
  const [reading, setReading] = useState<ReadingSession[]>([]);
  const [noDb, setNoDb] = useState(false);
  const [loading, setLoading] = useState(true);
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
    Promise.all([
      fetch('/api/writing/history').then((r) => r.json()),
      fetch('/api/speaking/history').then((r) => r.json()),
      fetch('/api/listening/history').then((r) => r.json()),
      fetch('/api/reading/history').then((r) => r.json()),
    ])
      .then(([w, s, l, rd]) => {
        setWriting(w.sessions || []);
        setSpeaking(s.sessions || []);
        setListening(l.sessions || []);
        setReading(rd.sessions || []);
        if (
          w.reason === 'no-database' ||
          s.reason === 'no-database' ||
          l.reason === 'no-database' ||
          rd.reason === 'no-database'
        )
          setNoDb(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, session]);

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
        />
      )}
    </main>
  );
}

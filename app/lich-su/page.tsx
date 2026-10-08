'use client';

// Lịch sử làm bài: /lich-su — searchable, filterable, sortable table of every
// saved session across the 4 skills, with row detail and delete.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { ArrowLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import HistoryTable, { type SkillId } from '@/components/HistoryTable';
import type {
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
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, session]);

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
        />
      )}
    </main>
  );
}

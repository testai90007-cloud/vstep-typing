'use client';

// Listening test list: /listening

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeftIcon,
  SpeakerWaveIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import { LISTENING_TESTS } from '@/lib/listening';
import ExamFormatCard from '@/components/ExamFormatCard';
import TestRangePanel, { useTestRangeFilter } from '@/components/TestRangePanel';

interface ListeningSession {
  test_id: string;
  score: number;
  total: number;
  created_at: string;
}

export default function ListeningListPage() {
  const { data: session } = useSession();
  const [best, setBest] = useState<Record<string, number>>({});
  const { rangeKey, setRangeKey, active, visible, nums } = useTestRangeFilter(LISTENING_TESTS);
  const gridRef = useRef<HTMLDivElement>(null);
  const handleSelect = (key: string | null) => {
    setRangeKey(key);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/listening/history')
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, number> = {};
        for (const s of (d.sessions || []) as ListeningSession[]) {
          if (s.total > 0) {
            const pct = Math.round((s.score / s.total) * 100);
            if (map[s.test_id] == null || pct > map[s.test_id]) map[s.test_id] = pct;
          }
        }
        setBest(map);
      })
      .catch(() => {});
  }, [session]);

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <p className="page-eyebrow">03 — Luyện Nghe</p>
      <h1 className="page-title">Chọn đề nghe</h1>
      <p className="page-sub">Nghe từng đoạn, chọn đáp án A/B/C/D — có bấm giờ, chấm điểm tự động và xem lại transcript sau khi nộp bài.</p>

      <ExamFormatCard
        icon={SpeakerWaveIcon}
        stats={[
          { value: '~40 phút', label: 'tổng thời gian' },
          { value: '35 câu', label: 'trắc nghiệm A/B/C/D' },
          { value: '1 lần', label: 'mỗi đoạn audio' },
        ]}
        parts={[
          { name: 'Part 1 · Thông báo ngắn', minutes: 10, time: '≈10\'', items: '8 câu' },
          { name: 'Part 2 · Hội thoại', minutes: 15, time: '≈15\'', items: '12 câu' },
          { name: 'Part 3 · Bài nói / Bài giảng', minutes: 15, time: '≈15\'', items: '15 câu' },
        ]}
        rules={[
          'Mỗi audio chỉ nghe 1 lần',
          'Đọc trước câu hỏi khi chờ audio',
          'Không bỏ trống — đoán cũng chọn',
        ]}
      />

      <h2 className="section-title" style={{ marginTop: 26 }}>
        <span className="icon-badge sm">
          <SpeakerWaveIcon width={18} height={18} strokeWidth={1.6} />
        </span>
        Danh sách đề
      </h2>
      <p className="lead" style={{ margin: '-4px 0 14px', fontSize: '0.9rem' }}>
        56 đề thi thử — mỗi đề 35 câu, đúng 40 phút như thi thật. Đề demo để làm quen
        giao diện trước.
      </p>
      <div className="test-grid" ref={gridRef} style={{ scrollMarginTop: 90 }}>
        {active && (
          <p className="range-note" style={{ gridColumn: '1 / -1' }}>
            Đang hiện đề {active.label} ({visible.length} đề) ·{' '}
            <button type="button" onClick={() => setRangeKey(null)}>Hiện tất cả</button>
          </p>
        )}
        {visible.map((t) => (
          <Link key={t.id} href={`/listening/${t.id}`} className="test-cell">
            <strong>
              {t.demo ? 'Demo' : (<><span className="de-word">Đề</span>{t.title.replace(/^Đề\s+/, '')}</>)}
              {t.demo && (
                <span className="chip" style={{ marginLeft: 6, fontSize: '0.62rem' }}>
                  LÀM QUEN
                </span>
              )}
            </strong>
            {best[t.id] != null && (
              <span className="cell-score">
                <TrophyIcon width={12} height={12} />
                {best[t.id]}%
              </span>
            )}
          </Link>
        ))}
      </div>

      <TestRangePanel
        nums={nums}
        total={LISTENING_TESTS.length}
        activeKey={rangeKey}
        onSelect={handleSelect}
      />
    </main>
  );
}

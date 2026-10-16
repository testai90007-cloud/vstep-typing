'use client';

// Reading test list: /reading

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeftIcon, BookOpenIcon, TrophyIcon } from '@heroicons/react/24/outline';
import ExamFormatCard from '@/components/ExamFormatCard';
import { TestSearchBar, type SearchItem } from '@/components/TestSearchBar';
// The grid + search only need id/num/title — use the generated title map
// (~29 KB), not the full ~7 MB question bank.
import { READING_TITLE_LIST } from '@/lib/test-titles';

interface ReadingSession {
  test_id: string;
  score: number;
  total: number;
  created_at: string;
}

export default function ReadingListPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [best, setBest] = useState<Record<string, number>>({});

  // Best score per test (parity with /listening): fetch once, best % wins.
  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/reading/history')
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, number> = {};
        for (const s of (d.sessions || []) as ReadingSession[]) {
          if (s.total > 0) {
            const pct = Math.round((s.score / s.total) * 100);
            if (map[s.test_id] == null || pct > map[s.test_id]) map[s.test_id] = pct;
          }
        }
        setBest(map);
      })
      .catch(() => {});
  }, [session]);

  const searchItems: SearchItem[] = [...READING_TITLE_LIST].sort((a, b) => b.num - a.num);

  const openTest = (item: SearchItem) => {
    router.push(`/reading/${item.id}`);
  };

  const openRandom = () => {
    const t = searchItems[Math.floor(Math.random() * searchItems.length)];
    router.push(`/reading/${t.id}`);
  };

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <p className="page-eyebrow">04 — Luyện Đọc</p>
      <h1 className="page-title">Chọn đề đọc</h1>
      <p className="page-sub">Đọc 4 bài đọc, trả lời 40 câu trắc nghiệm A/B/C/D — bấm giờ 60 phút như thi thật, chấm điểm tự động và xem lại đáp án sau khi nộp bài.</p>

      <ExamFormatCard
        icon={BookOpenIcon}
        stats={[
          { value: '60 phút', label: 'tổng thời gian' },
          { value: '40 câu', label: 'trắc nghiệm A/B/C/D' },
          { value: '4', label: 'bài đọc' },
        ]}
        parts={[
          { name: 'Bài đọc 1', minutes: 15, time: '≈15\'', items: '10 câu' },
          { name: 'Bài đọc 2', minutes: 15, time: '≈15\'', items: '10 câu' },
          { name: 'Bài đọc 3', minutes: 15, time: '≈15\'', items: '10 câu' },
          { name: 'Bài đọc 4', minutes: 15, time: '≈15\'', items: '10 câu' },
        ]}
        rules={[
          'Đọc câu hỏi trước, đọc bài sau',
          'Từ vựng: đoán theo ngữ cảnh',
          'Không bỏ trống — đoán cũng chọn',
        ]}
      />

      <h2 className="section-title" style={{ marginTop: 26 }}>
        <span className="icon-badge sm">
          <BookOpenIcon width={18} height={18} strokeWidth={1.6} />
        </span>
        Danh sách đề
      </h2>
      <p className="lead" style={{ margin: '-4px 0 14px', fontSize: '0.9rem' }}>
        200 đề thi thử — mỗi đề gồm 4 bài đọc × 10 câu hỏi, đúng 60 phút như thi thật.
        Gõ số đề để tìm nhanh, hoặc chọn một đề bên dưới.
      </p>
      <TestSearchBar
        items={searchItems}
        placeholder="Tìm đề… (gõ số, vd 29)"
        onSelect={openTest}
        onRandom={openRandom}
      />
      <div className="test-grid" style={{ marginTop: 16 }}>
        {searchItems.map((t) => (
          <Link key={t.id} href={`/reading/${t.id}`} className="test-cell">
            <strong>{t.title.replace(/^Đề\s+/, '')}</strong>
            {best[t.id] != null && (
              <span className="cell-score">
                <TrophyIcon width={12} height={12} />
                {best[t.id]}%
              </span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}

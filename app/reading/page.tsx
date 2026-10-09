'use client';

// Reading test list: /reading

import { useRef } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import ExamFormatCard from '@/components/ExamFormatCard';
import { READING_TESTS } from '@/lib/reading-tests';
import TestRangePanel, { useTestRangeFilter } from '@/components/TestRangePanel';

export default function ReadingListPage() {
  const { rangeKey, setRangeKey, active, visible, nums } = useTestRangeFilter(READING_TESTS);
  const gridRef = useRef<HTMLDivElement>(null);
  const handleSelect = (key: string | null) => {
    setRangeKey(key);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      </p>
      <div className="test-grid" ref={gridRef} style={{ scrollMarginTop: 90 }}>
        {active && (
          <p className="range-note" style={{ gridColumn: '1 / -1' }}>
            Đang hiện đề {active.label} ({visible.length} đề) ·{' '}
            <button type="button" onClick={() => setRangeKey(null)}>Hiện tất cả</button>
          </p>
        )}
        {visible.map((t) => (
          <Link key={t.id} href={`/reading/${t.id}`} className="test-cell">
            <strong><span className="de-word">Đề</span>{t.title.replace(/^Đề\s+/, '')}</strong>
          </Link>
        ))}
      </div>

      <TestRangePanel
        nums={nums}
        total={READING_TESTS.length}
        activeKey={rangeKey}
        onSelect={handleSelect}
      />
    </main>
  );
}

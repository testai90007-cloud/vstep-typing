'use client';

// Reading test list: /reading

import Link from 'next/link';
import { ArrowLeftIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import ExamFormatCard from '@/components/ExamFormatCard';
import { READING_TESTS } from '@/lib/reading-tests';

export default function ReadingListPage() {
  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <h1 className="brand" style={{ fontSize: '2.2rem' }}>
        Luyện <span className="hl">Reading</span>
      </h1>
      <p className="lead">
        Đọc 4 bài đọc, trả lời 40 câu trắc nghiệm A/B/C/D — bấm giờ 60 phút như thi
        thật, chấm điểm tự động và xem lại đáp án sau khi nộp bài.
      </p>

      <ExamFormatCard
        icon={BookOpenIcon}
        stats={[
          { value: '60 phút', label: 'tổng thời gian' },
          { value: '40 câu', label: 'trắc nghiệm A/B/C/D' },
          { value: '4 bài', label: 'bài đọc' },
        ]}
        parts={[
          {
            name: 'Part 1 · Bài đọc 1',
            time: '≈ 15 phút',
            items: '10 câu',
            desc: 'Đọc bài đọc đầu tiên và trả lời 10 câu hỏi trắc nghiệm A/B/C/D.',
          },
          {
            name: 'Part 2 · Bài đọc 2',
            time: '≈ 15 phút',
            items: '10 câu',
            desc: 'Đọc bài đọc thứ hai và trả lời 10 câu hỏi trắc nghiệm A/B/C/D.',
          },
          {
            name: 'Part 3 · Bài đọc 3',
            time: '≈ 15 phút',
            items: '10 câu',
            desc: 'Đọc bài đọc thứ ba và trả lời 10 câu hỏi trắc nghiệm A/B/C/D.',
          },
          {
            name: 'Part 4 · Bài đọc 4',
            time: '≈ 15 phút',
            items: '10 câu',
            desc: 'Đọc bài đọc cuối cùng và trả lời 10 câu hỏi trắc nghiệm A/B/C/D.',
          },
        ]}
        rules={[
          'Đọc lướt câu hỏi trước khi đọc kỹ bài đọc để định vị thông tin nhanh.',
          'Với câu từ vựng (closest in meaning), đọc kỹ ngữ cảnh quanh từ được hỏi.',
          'Không bỏ trống câu nào — đoán cũng phải chọn một đáp án.',
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
      <div className="test-grid">
        {READING_TESTS.map((t) => (
          <Link key={t.id} href={`/reading/${t.id}`} className="test-cell">
            <strong>{t.title}</strong>
          </Link>
        ))}
      </div>
    </main>
  );
}

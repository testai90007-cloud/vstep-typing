'use client';

import Link from 'next/link';
import { ArrowLeftIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import ExamFormatCard from '@/components/ExamFormatCard';
import { SPEAKING_TESTS } from '@/lib/speaking-tests';

export default function SpeakingPage() {
  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <p className="page-eyebrow">02 — Luyện Nói</p>
      <h1 className="page-title">Chọn đề nói</h1>
      <p className="page-sub full">Đúng format thi thật: 12 phút, 3 parts. Ghi âm từng part, AI chấm theo 5 tiêu chí chính thức của VSTEP (thang 0–10). <Link href="/settings">Cài đặt AI key</Link> để dùng key của riêng bạn.</p>

      <ExamFormatCard
        icon={MicrophoneIcon}
        stats={[
          { value: '~12 phút', label: 'tổng thời gian' },
          { value: '3 parts', label: 'thi nói' },
          { value: '0–10', label: 'thang điểm' },
        ]}
        parts={[
          { name: 'Part 1 · Giao tiếp xã hội', minutes: 3, time: "3'", items: '6 câu hỏi' },
          { name: 'Part 2 · Thảo luận giải pháp', minutes: 4, time: "1'+3'", items: '1 tình huống' },
          { name: 'Part 3 · Phát triển chủ đề', minutes: 5, time: "1'+4'", items: '1 chủ đề' },
        ]}
        rules={[
          "1' chuẩn bị: chỉ lập dàn ý",
          'Nói đủ giờ, đúng trọng tâm',
          'Part 3: theo mind-map + câu hỏi gợi ý',
        ]}
      />

      <h2 className="section-title" style={{ marginTop: 28 }}>
        <span className="icon-badge sm">
          <MicrophoneIcon width={18} height={18} strokeWidth={1.6} />
        </span>
        Danh sách đề
      </h2>
      <p className="lead full" style={{ margin: '-4px 0 14px', fontSize: '0.9rem' }}>
        302 đề thi thử — mỗi đề gồm đủ Part 1 (6 câu hỏi), Part 2 (tình huống + 3 lựa
        chọn) và Part 3 (chủ đề + mind-map + câu hỏi mở rộng), đúng 12 phút như thi thật.
      </p>
      <div className="test-grid">
        {SPEAKING_TESTS.map((t) => (
          <Link key={t.id} href={`/speaking/de-thi/${t.id}`} className="test-cell">
            <strong>{t.title}</strong>
          </Link>
        ))}
      </div>
    </main>
  );
}

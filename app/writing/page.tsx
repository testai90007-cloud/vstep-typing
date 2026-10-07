'use client';

import Link from 'next/link';
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { TEMPLATES } from '@/lib/templates';
import { WRITING_TESTS } from '@/lib/writing-tests';
import ExamFormatCard from '@/components/ExamFormatCard';

export default function WritingIndexPage() {
  const task2 = TEMPLATES.filter((t) => t.group === 'task2');
  const task1 = TEMPLATES.filter((t) => t.group === 'task1');

  const renderGroup = (
    title: string,
    Icon: typeof PencilSquareIcon,
    items: typeof task2
  ) => (
    <>
      <h2 className="section-title">
        <span className="icon-badge sm">
          <Icon width={18} height={18} strokeWidth={1.6} />
        </span>
        {title}
      </h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((t) => (
          <Link
            key={t.id}
            href={`/writing/${t.id}`}
            className="card lift"
            style={{ textDecoration: 'none', color: 'inherit', padding: '18px 20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: '1rem' }}>{t.title}</strong>
                <div style={{ color: 'var(--muted)', fontSize: '0.84rem', marginTop: 4 }}>
                  {t.sections.length} phần · {t.sections.map((s) => s.name).join(' → ')}
                </div>
              </div>
              <ChevronRightIcon width={20} height={20} style={{ color: 'var(--faint)', flexShrink: 0 }} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <h1 className="brand" style={{ fontSize: '2.2rem' }}>
        Luyện <span className="hl">Writing</span>
      </h1>
      <p className="lead">Chọn dạng bài để luyện gõ. Mỗi bài có chế độ từng phần, toàn bài và thi thử.</p>

      <ExamFormatCard
        icon={PencilSquareIcon}
        stats={[
          { value: '60 phút', label: 'tổng thời gian' },
          { value: '2 bài', label: 'Task 1 + Task 2' },
          { value: '0–10', label: 'thang điểm' },
        ]}
        parts={[
          {
            name: 'Task 1 · Thư / Email',
            time: '20 phút',
            items: '≥ 120 từ',
            desc: 'Viết thư/email theo tình huống: thân mật, trang trọng, bán trang trọng hoặc trả lời câu hỏi.',
          },
          {
            name: 'Task 2 · Bài luận',
            time: '40 phút',
            items: '≥ 250 từ',
            desc: 'Bài luận 5 dạng: Discussion, Agree/Disagree, Advantages–Disadvantages, Causes–Effects, Causes–Solutions.',
          },
        ]}
        rules={[
          'Viết đủ số từ tối thiểu của mỗi task (~120 từ Task 1, ~250 từ Task 2).',
          'Phân bổ thời gian đúng 20/40 phút — Task 2 gấp đôi điểm nên ưu tiên thời gian.',
          'Điểm chấm theo: hoàn thành yêu cầu đề, bố cục, từ vựng, ngữ pháp.',
        ]}
      />

      <h2 className="section-title">
        <span className="icon-badge sm">
          <DocumentTextIcon width={18} height={18} strokeWidth={1.6} />
        </span>
        Danh sách đề
      </h2>
      <p className="lead" style={{ margin: '-4px 0 14px', fontSize: '0.9rem' }}>
        Chọn một đề bên dưới để bắt đầu — mỗi đề gồm Task 1 (thư/email) và Task 2
        (bài luận), đúng 60 phút như thi thật.
      </p>
      <div className="test-grid">
        {WRITING_TESTS.map((t) => (
          <Link
            key={t.id}
            href={`/writing/de-thi/${t.id}`}
            className="test-cell"
          >
            <strong>{t.title}</strong>
          </Link>
        ))}
      </div>

      {renderGroup('Task 2 · Bài luận', PencilSquareIcon, task2)}
      {renderGroup('Task 1 · Thư / Email', EnvelopeIcon, task1)}
    </main>
  );
}

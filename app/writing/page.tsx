'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import BlurText from '@/components/BlurText';
import { FoldedCard } from '@/components/FoldedCard';
import { SpellBadge } from '@/components/SpellBadge';
import { SwapText } from '@/components/SwapText';
import { TestSearchBar, type SearchItem } from '@/components/TestSearchBar';
import FluidTabs from '@/components/FluidTabs';
import { TEMPLATES } from '@/lib/templates';
import { WRITING_TESTS } from '@/lib/writing-tests';
import ExamFormatCard from '@/components/ExamFormatCard';

type TplTab = 'task2' | 'task1';

export default function WritingIndexPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TplTab>('task2');
  const task2 = TEMPLATES.filter((t) => t.group === 'task2');
  const task1 = TEMPLATES.filter((t) => t.group === 'task1');
  const shown = tab === 'task2' ? task2 : task1;

  const searchItems: SearchItem[] = WRITING_TESTS.map((t) => ({
    id: t.id,
    num: t.num,
    title: t.title,
  }));

  const openTest = (item: SearchItem) => {
    router.push(`/writing/de-thi/${item.id}`);
  };

  const openRandom = () => {
    const t = WRITING_TESTS[Math.floor(Math.random() * WRITING_TESTS.length)];
    router.push(`/writing/de-thi/${t.id}`);
  };

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <p className="page-eyebrow">01 — Luyện Viết</p>
      <h1 className="page-title">
        <BlurText text="Chọn đề viết" delay={110} animateBy="words" />
      </h1>
      <p className="page-sub">
        Task 1: thư/email ≥ 120 từ. Task 2: bài luận ≥ 250 từ. Thi thử 60 phút,
        tự động nộp khi hết giờ.
      </p>

      <ExamFormatCard
        icon={PencilSquareIcon}
        stats={[
          { value: '60 phút', label: 'tổng thời gian' },
          { value: '2 bài', label: 'Task 1 + Task 2' },
          { value: '0–10', label: 'thang điểm' },
        ]}
        parts={[
          { name: 'Task 1 · Thư / Email', minutes: 20, time: "20'", items: '≥ 120 từ' },
          { name: 'Task 2 · Bài luận', minutes: 40, time: "40'", items: '≥ 250 từ' },
        ]}
        rules={[
          'Đủ ~120 từ Task 1, ~250 từ Task 2',
          "Chia giờ 20'/40' — Task 2 gấp đôi điểm",
          'Chấm: đúng đề, bố cục, từ vựng, ngữ pháp',
        ]}
      />

      <div className="sec-head">
        <h2 className="section-title" style={{ margin: 0 }}>
          <span className="icon-badge sm">
            <DocumentTextIcon width={18} height={18} strokeWidth={1.6} />
          </span>
          Danh sách đề
        </h2>
        <SpellBadge variant="neutral">300 đề</SpellBadge>
      </div>
      <p className="lead" style={{ margin: '-4px 0 14px', fontSize: '0.9rem' }}>
        Gõ số đề để tìm nhanh, hoặc chọn một đề bên dưới — mỗi đề gồm Task 1
        (thư/email) và Task 2 (bài luận), đúng 60 phút như thi thật.
      </p>
      <TestSearchBar
        items={searchItems}
        placeholder="Tìm đề… (gõ số, vd 29)"
        onSelect={openTest}
        onRandom={openRandom}
      />
      <div className="test-grid" style={{ marginTop: 16 }}>
        {WRITING_TESTS.map((t) => (
          <Link
            key={t.id}
            href={`/writing/de-thi/${t.id}`}
            className="test-cell"
          >
            <strong>
              <span className="de-word">Đề</span>
              {t.title.replace(/^Đề\s+/, '')}
            </strong>
          </Link>
        ))}
      </div>

      <div className="sec-head">
        <h2 className="section-title" style={{ margin: 0 }}>
          <span className="icon-badge sm">
            <PencilSquareIcon width={18} height={18} strokeWidth={1.6} />
          </span>
          Mẫu viết
        </h2>
      </div>
      <p className="lead" style={{ margin: '-4px 0 4px', fontSize: '0.9rem' }}>
        Khung bài mẫu cho từng dạng đề — di chuột lên thẻ để xem các phần.
      </p>
      <FluidTabs
        tabs={[
          {
            id: 'task2',
            label: (
              <>
                Task 2 · Bài luận <span className="tab-count">{task2.length}</span>
              </>
            ),
          },
          {
            id: 'task1',
            label: (
              <>
                Task 1 · Thư / Email <span className="tab-count">{task1.length}</span>
              </>
            ),
          },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as TplTab)}
        ariaLabel="Mẫu viết theo Task"
      />
      <div className="tpl-grid">
        {shown.map((t) => (
          <FoldedCard key={t.id} href={`/writing/${t.id}`} className="tpl-card">
            <SpellBadge variant="violet">
              {tab === 'task2' ? 'Task 2' : 'Task 1'} · {t.sections.length} phần
            </SpellBadge>
            <SwapText
              className="tpl-swap"
              initialText={t.title}
              finalText={`${t.sections.length} phần · ${t.sections.map((s) => s.name).join(' → ')}`}
              initialTextClassName="tpl-title"
              finalTextClassName="tpl-sections"
            />
            {/* static fallback for touch / narrow screens */}
            <span className="tpl-static">
              <strong className="tpl-title">{t.title}</strong>
              <span className="tpl-sections">
                {t.sections.length} phần · {t.sections.map((s) => s.name).join(' → ')}
              </span>
            </span>
          </FoldedCard>
        ))}
      </div>
    </main>
  );
}

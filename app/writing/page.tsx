'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  TrophyIcon,
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

interface WritingSession {
  template_id: string;
  ai_score: number | null;
  accuracy: number | null;
}

export default function WritingIndexPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [tab, setTab] = useState<TplTab>('task2');
  const task2 = TEMPLATES.filter((t) => t.group === 'task2');
  const task1 = TEMPLATES.filter((t) => t.group === 'task1');
  const shown = tab === 'task2' ? task2 : task1;

  // Best score per test (same convention as HistoryTable: AI score "x.x/10"
  // when present, else typing accuracy "xx%"). Parity with the Listening list.
  const [best, setBest] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/writing/history')
      .then((r) => r.json())
      .then((d) => {
        const aiBest: Record<string, number> = {};
        const accBest: Record<string, number> = {};
        for (const s of (d.sessions || []) as WritingSession[]) {
          const id = s.template_id;
          if (s.ai_score != null) {
            const v = Number(s.ai_score);
            if (Number.isFinite(v) && (aiBest[id] == null || v > aiBest[id])) aiBest[id] = v;
          }
          if (s.accuracy != null) {
            const v = Number(s.accuracy);
            if (Number.isFinite(v) && (accBest[id] == null || v > accBest[id])) accBest[id] = v;
          }
        }
        const map: Record<string, string> = {};
        for (const id of Object.keys(aiBest)) {
          map[id] = `${aiBest[id].toFixed(1)}/10`;
        }
        for (const id of Object.keys(accBest)) {
          if (map[id] == null) map[id] = `${Math.round(accBest[id])}%`;
        }
        setBest(map);
      })
      .catch(() => {});
  }, [session]);

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
        Task 1: thư/email tối thiểu 120 từ. Task 2: bài luận tối thiểu 250 từ. Thi thử 60 phút,
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
          { name: 'Task 1 · Thư / Email', minutes: 20, time: "20'", items: 'tối thiểu 120 từ' },
          { name: 'Task 2 · Bài luận', minutes: 40, time: "40'", items: 'tối thiểu 250 từ' },
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
        <SpellBadge variant="neutral">{WRITING_TESTS.length} đề</SpellBadge>
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
              <span>{t.title.replace(/^Đề\s+/, '')}</span>
            </strong>
            {best[t.id] != null && (
              <span className="cell-score">
                <TrophyIcon width={12} height={12} />
                {best[t.id]}
              </span>
            )}
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
        Khung bài mẫu cho từng dạng đề — di chuột hoặc bấm vào thẻ để xem các phần.
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

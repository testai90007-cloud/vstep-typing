'use client';

// Speaking test: /speaking/de-thi/[id]
// Two modes: practice (free part tabs, retries, detailed per-part scores) and
// mock (sequential Part 1 → 2 → 3 with real exam timing, auto-advance).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  FlagIcon,
  LightBulbIcon,
  PresentationChartBarIcon,
} from '@heroicons/react/24/outline';
import { AuthedRecorder } from '@/components/SpeakingRecorder';
import SpeakingPartBlock from '@/components/SpeakingPartBlock';
import SpeakingMockFlow from '@/components/SpeakingMockFlow';
import { SPEAKING_TESTS } from '@/lib/speaking-tests';
import { SPEAKING_TIMING } from '@/lib/speaking';

type Mode = 'pick' | 'practice' | 'mock';

const PART_TABS = [
  { n: 1 as const, label: 'Part 1', sub: 'Social Interaction · 3 phút', Icon: ChatBubbleOvalLeftEllipsisIcon },
  { n: 2 as const, label: 'Part 2', sub: 'Solution Discussion · 4 phút', Icon: LightBulbIcon },
  { n: 3 as const, label: 'Part 3', sub: 'Topic Development · 5 phút', Icon: PresentationChartBarIcon },
];

export default function SpeakingTestPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const test = useMemo(() => SPEAKING_TESTS.find((t) => t.id === id), [id]);
  const [mode, setMode] = useState<Mode>('pick');
  const [tab, setTab] = useState<1 | 2 | 3>(1);

  if (!test) {
    return (
      <main className="page">
        <div className="nav-top">
          <Link href="/speaking" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Luyện Speaking
          </Link>
        </div>
        <div className="card empty" style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px' }}>Không tìm thấy đề</p>
          <Link href="/speaking" className="btn primary">
            Chọn đề khác
          </Link>
        </div>
      </main>
    );
  }

  const prompts = {
    1: `Part 1 questions:\n${test.part1.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
    2:
      `Situation: ${test.part2.situation}\nOptions:\n` +
      test.part2.options.map((o, i) => `${i + 1}. ${o}`).join('\n'),
    3:
      `Topic: ${test.part3.topic}\nMind-map: ${test.part3.points.join(' / ')}\nFollow-up questions:\n` +
      test.part3.followUps.map((q, i) => `${i + 1}. ${q}`).join('\n'),
  } as const;

  const timingKey = { 1: 'part1', 2: 'part2', 3: 'part3' } as const;

  const recorderFor = (n: 1 | 2 | 3) => {
    const t = SPEAKING_TIMING[timingKey[n]];
    return (
      <AuthedRecorder
        key={`t-${test.id}-${n}`}
        part={n}
        promptText={prompts[n]}
        prepSec={t.prep}
        talkSec={t.talk}
        prepLabel={t.label}
        sessionMode="practice"
      />
    );
  };

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/speaking" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Danh sách đề
        </Link>
      </div>
      <h1 className="brand" style={{ fontSize: '1.9rem' }}>
        {test.title} <span className="hl">· Speaking</span>
      </h1>

      {mode === 'pick' && (
        <>
          <p className="lead">
            Thi thử đủ 3 parts như thi thật — ghi âm từng part, AI chấm theo 5 tiêu
            chí chính thức của VSTEP.
          </p>
          <div className="mode-cards">
            <button className="card lift mode-card" onClick={() => setMode('practice')}>
              <span className="icon-badge">
                <BookOpenIcon width={24} height={24} strokeWidth={1.6} />
              </span>
              <strong>Luyện tập</strong>
              <span className="chip">Tự do từng part</span>
              <p>
                Chuyển part thoải mái, ghi âm lại bao nhiêu lần cũng được, xem điểm
                chi tiết từng part ngay sau khi chấm.
              </p>
            </button>
            <button className="card lift mode-card" onClick={() => setMode('mock')}>
              <span className="icon-badge">
                <FlagIcon width={24} height={24} strokeWidth={1.6} />
              </span>
              <strong>Thi thử</strong>
              <span className="chip accent">Đúng quy trình thi thật</span>
              <p>
                Part 1 → 2 → 3 liên tục (~12 phút). Hết giờ chuẩn bị tự động ghi âm,
                hết giờ nói tự động dừng — không quay lại, không làm lại.
              </p>
            </button>
          </div>
        </>
      )}

      {mode === 'practice' && (
        <>
          <div className="seg" style={{ marginTop: 20 }} role="tablist" aria-label="Chọn part">
            {PART_TABS.map(({ n, label, Icon }) => (
              <button
                key={n}
                role="tab"
                aria-selected={tab === n}
                className={tab === n ? 'active' : ''}
                onClick={() => setTab(n)}
              >
                <Icon width={16} height={16} />
                {label}
              </button>
            ))}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '10px 0 0' }}>
            {PART_TABS[tab - 1].sub} <span className="hl">· Luyện tập</span>
          </p>
          <SpeakingPartBlock part={tab} test={test} recorder={recorderFor(tab)} />
        </>
      )}

      {mode === 'mock' && <SpeakingMockFlow test={test} />}
    </main>
  );
}

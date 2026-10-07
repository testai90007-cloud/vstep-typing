'use client';

// Speaking mock test: /speaking/de-thi/[id]
// One full test (Part 1 + Part 2 + Part 3) with real VSTEP timing per part.
// Each part shows its prompt and an AuthedRecorder for recording + AI scoring.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeftIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ClockIcon,
  LightBulbIcon,
  PresentationChartBarIcon,
} from '@heroicons/react/24/outline';
import { AuthedRecorder } from '@/components/SpeakingRecorder';
import { SPEAKING_TESTS } from '@/lib/speaking-tests';
import { SPEAKING_TIMING } from '@/lib/speaking';

const PART_TABS = [
  { n: 1 as const, label: 'Part 1', sub: 'Social Interaction · 3 phút', Icon: ChatBubbleOvalLeftEllipsisIcon },
  { n: 2 as const, label: 'Part 2', sub: 'Solution Discussion · 4 phút', Icon: LightBulbIcon },
  { n: 3 as const, label: 'Part 3', sub: 'Topic Development · 5 phút', Icon: PresentationChartBarIcon },
];

export default function SpeakingTestPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const test = useMemo(() => SPEAKING_TESTS.find((t) => t.id === id), [id]);
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

  const p1Prompt = `Part 1 questions:\n${test.part1.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
  const p2Prompt =
    `Situation: ${test.part2.situation}\nOptions:\n` +
    test.part2.options.map((o, i) => `${i + 1}. ${o}`).join('\n');
  const p3Prompt =
    `Topic: ${test.part3.topic}\nMind-map: ${test.part3.points.join(' / ')}\nFollow-up questions:\n` +
    test.part3.followUps.map((q, i) => `${i + 1}. ${q}`).join('\n');

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
      <p className="lead">
        Thi thử đủ 3 parts như thi thật — ghi âm từng part, AI chấm theo 5 tiêu chí
        chính thức của VSTEP.
      </p>

      <div className="seg" style={{ marginTop: 20 }} role="tablist" aria-label="Chọn part">
        {PART_TABS.map(({ n, label, sub, Icon }) => (
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
        {PART_TABS[tab - 1].sub}
      </p>

      {tab === 1 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>
            Part 1 · Social Interaction
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <ClockIcon width={15} height={15} />
            3 phút · trả lời 6 câu hỏi · không có thời gian chuẩn bị
          </p>
          <div className="speak-layout">
            <div>
              <ol className="q-list" style={{ marginTop: 0 }}>
                {test.part1.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
            <div className="speak-side">
              <AuthedRecorder
                key={`t-${test.id}-1`}
                part={1}
                promptText={p1Prompt}
                prepSec={SPEAKING_TIMING.part1.prep}
                talkSec={SPEAKING_TIMING.part1.talk}
                prepLabel={SPEAKING_TIMING.part1.label}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 2 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>
            Part 2 · Solution Discussion
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <ClockIcon width={15} height={15} />
            1 phút chuẩn bị + 3 phút nói · chọn 1 trong 3 giải pháp và bảo vệ lựa chọn của bạn
          </p>
          <div className="speak-layout">
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.92rem', margin: '0 0 8px' }}>Tình huống:</p>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 10px' }}>
                {test.part2.situation}
              </p>
              <p style={{ fontWeight: 700, fontSize: '0.92rem', margin: '0 0 8px' }}>Các lựa chọn:</p>
              <ol className="q-list" style={{ marginTop: 0 }}>
                {test.part2.options.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ol>
            </div>
            <div className="speak-side">
              <AuthedRecorder
                key={`t-${test.id}-2`}
                part={2}
                promptText={p2Prompt}
                prepSec={SPEAKING_TIMING.part2.prep}
                talkSec={SPEAKING_TIMING.part2.talk}
                prepLabel={SPEAKING_TIMING.part2.label}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 3 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>
            Part 3 · Topic Development
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <ClockIcon width={15} height={15} />
            1 phút chuẩn bị + 4 phút nói · triển khai chủ đề theo mind-map, sau đó tự trả
            lời câu hỏi mở rộng
          </p>
          <div className="speak-layout">
            <div>
              <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 12px' }}>
                {test.part3.topic}
              </p>
              <div className="mindmap">
                {test.part3.points.map((p, i) => (
                  <span key={i}>{p}</span>
                ))}
              </div>
              <strong style={{ fontSize: '0.9rem' }}>
                Câu hỏi mở rộng (tự luyện thêm sau bài nói chính):
              </strong>
              <ol className="q-list">
                {test.part3.followUps.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
            <div className="speak-side">
              <AuthedRecorder
                key={`t-${test.id}-3`}
                part={3}
                promptText={p3Prompt}
                prepSec={SPEAKING_TIMING.part3.prep}
                talkSec={SPEAKING_TIMING.part3.talk}
                prepLabel={SPEAKING_TIMING.part3.label}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

'use client';

// Speaking practice: /speaking
// Real VSTEP timing — Part 1: 3 min talk (no prep), Part 2: 1 min prep + 3 min
// talk, Part 3: 1 min prep + 4 min talk. Records with MediaRecorder, uploads
// to /api/speaking/score, shows per-part AI scores against the 5 official
// VSTEP criteria (0-10 each, overall = mean rounded to 0.5).

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  MicrophoneIcon,
  ClockIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  LightBulbIcon,
  PresentationChartBarIcon,
} from '@heroicons/react/24/outline';
import ExamFormatCard from '@/components/ExamFormatCard';
import { AuthedRecorder } from '@/components/SpeakingRecorder';
import {
  PART1_SETS,
  PART2_SITUATIONS,
  PART3_TOPICS,
  SPEAKING_TIMING,
} from '@/lib/speaking';
import { SPEAKING_TESTS } from '@/lib/speaking-tests';


const PART_TABS = [
  { n: 1 as const, label: 'Part 1', Icon: ChatBubbleOvalLeftEllipsisIcon },
  { n: 2 as const, label: 'Part 2', Icon: LightBulbIcon },
  { n: 3 as const, label: 'Part 3', Icon: PresentationChartBarIcon },
];

export default function SpeakingPage() {
  const [tab, setTab] = useState<1 | 2 | 3>(1);
  const [p1Set, setP1Set] = useState(PART1_SETS[0].id);
  const [p2Id, setP2Id] = useState(PART2_SITUATIONS[0].id);
  const [p3Id, setP3Id] = useState(PART3_TOPICS[0].id);

  const s1 = PART1_SETS.find((s) => s.id === p1Set)!;
  const s2 = PART2_SITUATIONS.find((s) => s.id === p2Id)!;
  const s3 = PART3_TOPICS.find((s) => s.id === p3Id)!;

  const p1Prompt = `${s1.label}\n${s1.topics.map((t) => `${t.title}:\n${t.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`).join('\n\n')}`;
  const p2Prompt = `Situation: ${s2.situation}\nOptions:\n${s2.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
  const p3Prompt = `Topic: ${s3.topic}\nMind-map: ${s3.points.join(' / ')}\nFollow-up questions:\n${s3.followUps.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <h1 className="brand" style={{ fontSize: '2.2rem' }}>
        Luyện <span className="hl">Speaking</span>
      </h1>
      <p className="lead">
        Đúng format thi thật: 12 phút, 3 parts. Ghi âm từng part, AI chấm theo 5 tiêu chí
        chính thức của VSTEP (thang 0–10).{' '}
        <Link href="/settings">Cài đặt AI key</Link> để dùng key của riêng bạn.
      </p>

      <ExamFormatCard
        icon={MicrophoneIcon}
        stats={[
          { value: '~12 phút', label: 'tổng thời gian' },
          { value: '3 parts', label: 'thi nói' },
          { value: '0–10', label: 'thang điểm' },
        ]}
        parts={[
          {
            name: 'Part 1 · Social Interaction',
            time: '3 phút',
            items: '6 câu hỏi',
            desc: 'Trả lời câu hỏi về 2 chủ đề quen thuộc trong đời sống, không có thời gian chuẩn bị.',
          },
          {
            name: 'Part 2 · Solution Discussion',
            time: "1' chuẩn bị + 3' nói",
            items: '1 tình huống',
            desc: 'Chọn 1 trong 3 giải pháp cho một tình huống và bảo vệ lựa chọn của mình.',
          },
          {
            name: 'Part 3 · Topic Development',
            time: "1' chuẩn bị + 4' nói",
            items: '1 chủ đề',
            desc: 'Phát triển chủ đề theo mind-map gợi ý, rồi trả lời câu hỏi mở rộng.',
          },
        ]}
        rules={[
          'Part 2 và 3 có đúng 1 phút chuẩn bị — dùng để lập dàn ý, không viết câu hoàn chỉnh.',
          'Nói đủ thời gian mỗi part, trả lời đúng trọng tâm câu hỏi.',
          'Trình bày rõ ràng, mạch lạc; tận dụng mind-map và câu hỏi gợi ý của Part 3.',
        ]}
      />

      <div className="seg" style={{ marginTop: 20 }} role="tablist" aria-label="Chọn part">
        {PART_TABS.map(({ n, label, Icon }) => (
          <button key={n} role="tab" aria-selected={tab === n} className={tab === n ? 'active' : ''} onClick={() => setTab(n)}>
            <Icon width={16} height={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === 1 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>Part 1 · Social Interaction</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <ClockIcon width={15} height={15} />
            3 phút · trả lời 6 câu hỏi về 2 chủ đề quen thuộc · không có thời gian chuẩn bị
          </p>
          <div className="field">
            <label htmlFor="p1set">Chọn bộ câu hỏi</label>
            <select id="p1set" className="select" value={p1Set} onChange={(e) => setP1Set(e.target.value)}>
              {PART1_SETS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="speak-layout">
            <div>
          {s1.topics.map((t, i) => (
            <div key={i} style={{ marginTop: i === 0 ? 0 : 14 }}>
              <strong style={{ fontSize: '0.92rem' }}>{t.title}</strong>
              <ol className="q-list">
                {t.questions.map((q, j) => (
                  <li key={j}>{q}</li>
                ))}
              </ol>
            </div>
          ))}
            </div>
            <div className="speak-side">
          <AuthedRecorder
            key={`1-${p1Set}`}
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
          <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>Part 2 · Solution Discussion</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <ClockIcon width={15} height={15} />
            1 phút chuẩn bị + 3 phút nói · chọn 1 trong 3 giải pháp và bảo vệ lựa chọn của bạn
          </p>
          <div className="field">
            <label htmlFor="p2sel">Chọn tình huống</label>
            <select id="p2sel" className="select" value={p2Id} onChange={(e) => setP2Id(e.target.value)}>
              {PART2_SITUATIONS.map((s, i) => (
                <option key={s.id} value={s.id}>Tình huống {i + 1}</option>
              ))}
            </select>
          </div>
          <div className="speak-layout">
            <div>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 10px' }}>{s2.situation}</p>
              <ol className="q-list" style={{ marginTop: 0 }}>
                {s2.options.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ol>
            </div>
            <div className="speak-side">
              <AuthedRecorder
                key={`2-${p2Id}`}
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
          <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>Part 3 · Topic Development</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <ClockIcon width={15} height={15} />
            1 phút chuẩn bị + 4 phút nói · triển khai chủ đề theo mind-map, sau đó tự trả lời
            câu hỏi mở rộng
          </p>
          <div className="field">
            <label htmlFor="p3sel">Chọn chủ đề</label>
            <select id="p3sel" className="select" value={p3Id} onChange={(e) => setP3Id(e.target.value)}>
              {PART3_TOPICS.map((t) => (
                <option key={t.id} value={t.id}>{t.topic}</option>
              ))}
            </select>
          </div>
          <div className="speak-layout">
            <div>
              <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 12px' }}>{s3.topic}</p>
              <div className="mindmap">
                {s3.points.map((p, i) => (
                  <span key={i}>{p}</span>
                ))}
              </div>
              <strong style={{ fontSize: '0.9rem' }}>Câu hỏi mở rộng (tự luyện thêm sau bài nói chính):</strong>
              <ol className="q-list">
                {s3.followUps.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
            <div className="speak-side">
              <AuthedRecorder
                key={`3-${p3Id}`}
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

      <h2 className="section-title" style={{ marginTop: 28 }}>
        <span className="icon-badge sm">
          <MicrophoneIcon width={18} height={18} strokeWidth={1.6} />
        </span>
        Danh sách đề
      </h2>
      <p className="lead" style={{ margin: '-4px 0 14px', fontSize: '0.9rem' }}>
        300 đề thi thử — mỗi đề gồm đủ Part 1 (6 câu hỏi), Part 2 (tình huống + 3 lựa
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

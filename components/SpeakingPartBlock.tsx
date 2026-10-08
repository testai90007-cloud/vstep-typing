'use client';

// One speaking part card: header + prompt on the left, recorder slot on the
// right. Shared by practice tabs and the mock-test flow.

import type { ReactNode } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import SpeakingMindmap from './SpeakingMindmap';
import type { SpeakingTest } from '@/lib/speaking-tests';

const TITLES = {
  1: 'Part 1 · Social Interaction',
  2: 'Part 2 · Solution Discussion',
  3: 'Part 3 · Topic Development',
} as const;

const SUBS = {
  1: '3 phút · trả lời 6 câu hỏi · không có thời gian chuẩn bị',
  2: '1 phút chuẩn bị + 3 phút nói · chọn 1 trong 3 giải pháp và bảo vệ lựa chọn của bạn',
  3: '1 phút chuẩn bị + 4 phút nói · triển khai chủ đề theo mind-map, sau đó tự trả lời câu hỏi mở rộng',
} as const;

export default function SpeakingPartBlock({
  part,
  test,
  recorder,
}: {
  part: 1 | 2 | 3;
  test: SpeakingTest;
  recorder: ReactNode;
}) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>
        {TITLES[part]}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
        <ClockIcon width={15} height={15} />
        {SUBS[part]}
      </p>
      <div className="speak-layout">
        <div>
          {part === 1 && (
            <ol className="q-list" style={{ marginTop: 0 }}>
              {test.part1.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          )}
          {part === 2 && (
            <>
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
            </>
          )}
          {part === 3 && (
            <SpeakingMindmap
              topic={test.part3.topic}
              points={test.part3.points}
              followUps={test.part3.followUps}
            />
          )}
        </div>
        <div className="speak-side">{recorder}</div>
      </div>
    </div>
  );
}

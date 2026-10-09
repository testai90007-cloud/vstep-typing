'use client';

// TEMPORARY QA preview — DELETE before production deploy.

import { DashboardView } from '@/components/ProgressDashboard';

const iso = (daysAgo: number, h = 9, m = 5) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const writing = [
  { id: 1, template_id: 'de-300', mode: 'mock', accuracy: 78, duration_sec: 3540, created_at: iso(1, 20, 12), ai_score: 7.5, ai_part1: 7.0, ai_part2: 8.0 },
  { id: 2, template_id: 'de-299', mode: 'mock', accuracy: 82, duration_sec: 3420, created_at: iso(3, 19, 40), ai_score: 8.0, ai_part1: 7.5, ai_part2: 8.5 },
  { id: 3, template_id: 'de-298', mode: 'practice', accuracy: 71, duration_sec: 1800, created_at: iso(4, 8, 15), ai_score: null, ai_part1: null, ai_part2: null },
  { id: 4, template_id: 'de-297', mode: 'mock', accuracy: 85, duration_sec: 3600, created_at: iso(8, 20, 5), ai_score: 8.5, ai_part1: 8.0, ai_part2: 9.0 },
  { id: 5, template_id: 'de-296', mode: 'practice', accuracy: 74, duration_sec: 1500, created_at: iso(10, 7, 50), ai_score: null, ai_part1: null, ai_part2: null },
  { id: 6, template_id: 'de-295', mode: 'mock', accuracy: 80, duration_sec: 3480, created_at: iso(15, 19, 30), ai_score: 7.0, ai_part1: 6.5, ai_part2: 7.5 },
];

const speaking = [
  { id: 1, part: 2, prompt: 'Describe a memorable trip', transcript: 'I want to talk about my trip to Da Lat last year...', scores: { grammar: 7, vocabulary: 7.5, pronunciation: 6.5, fluency: 7, discourse_management: 7 }, overall: 7.0, feedback: 'Phát âm khá.', mode: 'practice', created_at: iso(0, 21, 5) },
  { id: 2, part: 1, prompt: 'Hometown', transcript: 'I come from a small town near Hue...', scores: { grammar: 6.5, vocabulary: 6, pronunciation: 6, fluency: 6.5, discourse_management: 6 }, overall: 6.2, feedback: 'Câu trả lời hơi ngắn.', mode: 'practice', created_at: iso(2, 18, 44) },
  { id: 3, part: 3, prompt: 'Education', transcript: 'In my opinion, online learning...', scores: { grammar: 7.5, vocabulary: 8, pronunciation: 7, fluency: 7.5, discourse_management: 8 }, overall: 7.6, feedback: 'Lập luận tốt.', mode: 'mock', created_at: iso(6, 20, 15) },
];

const listening = [
  { id: 1, test_id: 'ls-56', score: 28, total: 35, duration_sec: 2400, mode: 'mock', created_at: iso(1, 10, 20) },
  { id: 2, test_id: 'ls-55', score: 30, total: 35, duration_sec: 2380, created_at: iso(3, 10, 5) },
  { id: 3, test_id: 'ls-54', score: 25, total: 35, duration_sec: 2410, created_at: iso(5, 9, 45) },
  { id: 4, test_id: 'ls-53', score: 31, total: 35, duration_sec: 2350, created_at: iso(8, 10, 12) },
];

const reading = [
  { id: 1, test_id: 'rd-200', score: 32, total: 40, duration_sec: 3300, mode: 'mock', created_at: iso(2, 15, 40) },
  { id: 2, test_id: 'rd-199', score: 35, total: 40, duration_sec: 3200, mode: 'mock', created_at: iso(4, 15, 10) },
  { id: 3, test_id: 'rd-198', score: 29, total: 40, duration_sec: 3400, mode: 'mock', created_at: iso(7, 14, 55) },
];

export default function PreviewProgressPage() {
  return (
    <main className="page">
      <p style={{ color: 'var(--faint)', fontSize: '0.8rem' }}>
        QA preview (mock data) — xóa trước khi deploy production.
      </p>
      <DashboardView
        data={{ writing, speaking, listening, reading }}
        targetLevel={{ id: 'B2', threshold: 6.0 }}
        noDb={false}
        userName="Bạn QA"
        userInitial="B"
      />
    </main>
  );
}

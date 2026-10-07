'use client';

// Listening test list: /listening

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeftIcon,
  SpeakerWaveIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import { LISTENING_TESTS } from '@/lib/listening';
import ExamFormatCard from '@/components/ExamFormatCard';

interface ListeningSession {
  test_id: string;
  score: number;
  total: number;
  created_at: string;
}

export default function ListeningListPage() {
  const { data: session } = useSession();
  const [best, setBest] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/listening/history')
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, number> = {};
        for (const s of (d.sessions || []) as ListeningSession[]) {
          if (s.total > 0) {
            const pct = Math.round((s.score / s.total) * 100);
            if (map[s.test_id] == null || pct > map[s.test_id]) map[s.test_id] = pct;
          }
        }
        setBest(map);
      })
      .catch(() => {});
  }, [session]);

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <h1 className="brand" style={{ fontSize: '2.2rem' }}>
        Luyện <span className="hl">Listening</span>
      </h1>
      <p className="lead">
        Nghe từng đoạn, chọn đáp án A/B/C/D — có bấm giờ, chấm điểm tự động và xem
        lại transcript sau khi nộp bài.
      </p>

      <ExamFormatCard
        icon={SpeakerWaveIcon}
        stats={[
          { value: '~40 phút', label: 'tổng thời gian' },
          { value: '35 câu', label: 'trắc nghiệm A/B/C/D' },
          { value: '1 lần', label: 'mỗi đoạn audio' },
        ]}
        parts={[
          {
            name: 'Part 1 · Thông báo ngắn',
            time: '≈ 10 phút',
            items: '8 câu',
            desc: 'Nghe 8 đoạn thông báo, hướng dẫn hoặc trao đổi ngắn — mỗi đoạn 1 câu hỏi.',
          },
          {
            name: 'Part 2 · Hội thoại',
            time: '≈ 15 phút',
            items: '12 câu',
            desc: 'Nghe 3 đoạn hội thoại dài về chủ đề quen thuộc — mỗi đoạn 4 câu hỏi.',
          },
          {
            name: 'Part 3 · Bài nói / Bài giảng',
            time: '≈ 15 phút',
            items: '15 câu',
            desc: 'Nghe 3 bài nói, bài giảng hoặc thuyết trình — mỗi bài 5 câu hỏi.',
          },
        ]}
        rules={[
          'Mỗi đoạn audio chỉ được nghe ĐÚNG 1 lần trong phòng thi.',
          'Tranh thủ đọc trước câu hỏi và đáp án khi audio chưa phát.',
          'Không bỏ trống câu nào — đoán cũng phải chọn một đáp án.',
        ]}
      />

      <h2 className="section-title" style={{ marginTop: 26 }}>
        <span className="icon-badge sm">
          <SpeakerWaveIcon width={18} height={18} strokeWidth={1.6} />
        </span>
        Danh sách đề
      </h2>
      <p className="lead" style={{ margin: '-4px 0 14px', fontSize: '0.9rem' }}>
        56 đề thi thử — mỗi đề 35 câu, đúng 40 phút như thi thật. Đề demo để làm quen
        giao diện trước.
      </p>
      <div className="test-grid">
        {LISTENING_TESTS.map((t) => (
          <Link key={t.id} href={`/listening/${t.id}`} className="test-cell">
            <strong>
              {t.demo ? 'Demo' : t.title}
              {t.demo && (
                <span className="chip" style={{ marginLeft: 6, fontSize: '0.62rem' }}>
                  LÀM QUEN
                </span>
              )}
            </strong>
            {best[t.id] != null && (
              <span className="cell-score">
                <TrophyIcon width={12} height={12} />
                {best[t.id]}%
              </span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}

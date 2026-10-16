'use client';

// Thẻ chọn game Từ vựng — 6 game, mỗi thẻ có hình minh họa riêng.
// Dùng ở hub (/tu-vung) và màn hình bắt đầu của /tu-vung/choi.

import Link from 'next/link';
import type { VocabLevel } from '@/lib/vocab';

export type VocabGameId = 'flashcards' | 'meaning' | 'listening' | 'fill' | 'matching' | 'synant';

const CARDS: {
  game: VocabGameId;
  title: string;
  desc: string;
  image: string;
  alt: string;
}[] = [
  {
    game: 'flashcards',
    title: 'Thẻ ghi nhớ',
    desc: 'Lật thẻ để xem nghĩa, tự đánh giá Đã nhớ hay Chưa nhớ.',
    image: '/vocab-games/flashcards.webp',
    alt: 'Minh họa chồng thẻ ghi nhớ',
  },
  {
    game: 'meaning',
    title: 'Chọn nghĩa đúng',
    desc: 'Đọc từ, chọn nghĩa đúng trong 4 đáp án.',
    image: '/vocab-games/meaning.webp',
    alt: 'Minh họa sách mở với dấu hỏi',
  },
  {
    game: 'listening',
    title: 'Nghe → chọn từ',
    desc: 'Nghe phát âm, chọn từ bạn nghe được.',
    image: '/vocab-games/listening.webp',
    alt: 'Minh họa tai nghe với sóng âm',
  },
  {
    game: 'fill',
    title: 'Điền từ vào câu',
    desc: 'Điền từ còn thiếu vào câu ví dụ.',
    image: '/vocab-games/fill.webp',
    alt: 'Minh họa bút chì điền vào chỗ trống',
  },
  {
    game: 'matching',
    title: 'Nối từ – nghĩa',
    desc: 'Nối mỗi từ với nghĩa đúng của nó.',
    image: '/vocab-games/matching.webp',
    alt: 'Minh họa hai cột ô nối với nhau',
  },
  {
    game: 'synant',
    title: 'Đồng nghĩa – Trái nghĩa',
    desc: 'Chọn từ đồng nghĩa hoặc trái nghĩa theo yêu cầu.',
    image: '/vocab-games/synant.webp',
    alt: 'Minh họa hai mũi tên ngược chiều',
  },
];

interface Props {
  level: VocabLevel;
  count?: number;
  review?: boolean;
  currentGame?: VocabGameId | null;
  heading?: string;
}

export default function VocabGameCards({
  level,
  count = 10,
  review = false,
  currentGame = null,
  heading = 'Trò chơi',
}: Props) {
  return (
    <section aria-label={heading}>
      <h2 style={{ fontSize: '1.15rem', margin: '32px 0 14px' }}>{heading}</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {CARDS.map((c) => {
          const active = currentGame === c.game;
          return (
            <Link
              key={c.game}
              href={`/tu-vung/choi?game=${c.game}&level=${level}&count=${count}${review ? '&review=1' : ''}`}
              className="card-soft"
              aria-current={active ? 'true' : undefined}
              style={{
                padding: 12,
                textDecoration: 'none',
                color: 'var(--ink)',
                display: 'block',
                border: active ? '2px solid var(--accent)' : undefined,
              }}
            >
              <div
                style={{
                  aspectRatio: '16 / 10',
                  background: 'var(--paper-soft)',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <img
                  src={c.image}
                  alt={c.alt}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              </div>
              <strong style={{ display: 'block', marginTop: 12, fontSize: '1rem' }}>{c.title}</strong>
              <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                {c.desc}
              </p>
              <span
                style={{
                  display: 'block',
                  marginTop: 10,
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: active ? 'var(--accent)' : 'var(--ink)',
                }}
              >
                {active ? 'Đang chọn' : 'Chơi ngay →'}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

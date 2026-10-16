'use client';

// Home: hero with DarkVeil animated background + FlowingMenu (4 skills,
// click goes straight to the skill page) + CircuitBoard utilities.

import Link from 'next/link';
import FlowingMenu, { type FlowingMenuItem } from '@/components/FlowingMenu';
import DarkVeil from '@/components/DarkVeil';
import CircuitBoard from '@/components/CircuitBoard';
import { useIsDark } from '@/components/useIsDark';
import { ArrowUpRightIcon, LanguageIcon } from '@heroicons/react/24/outline';

const MENU_ITEMS: FlowingMenuItem[] = [
  { link: '/writing', text: 'Luyện Viết', image: '/images/writing.jpg' },
  { link: '/speaking', text: 'Luyện Nói', image: '/images/speaking.jpg' },
  { link: '/listening', text: 'Luyện Nghe', image: '/images/listening.jpg' },
  { link: '/reading', text: 'Luyện Đọc', image: '/images/reading.jpg' },
];

export default function HomePage() {
  const isDark = useIsDark();

  return (
    <>
      {/* Full-page animated background (fixed viewport layer behind everything). */}
      <div className="veil-page" aria-hidden="true">
        <DarkVeil
          lightMode={!isDark}
          speed={0.5}
          noiseIntensity={0.05}
          warpAmount={0.3}
          resolutionScale={0.75}
        />
      </div>
      <main className="page page-home">
      <section className="hero">
        <div className="hero-content">
          <span className="pill-badge">
            <span className="dot grad-dot" aria-hidden="true" />
            858 đề thi thử · 4 kỹ năng VSTEP
          </span>
          <h1 className="brand">
            Luyện thi VSTEP,
            <br />
            <span className="grad-text">gọn và chính xác.</span>
          </h1>
          <p className="lead">Bấm vào một kỹ năng để vào luyện ngay.</p>
        </div>
      </section>

      <div style={{ height: 'min(58vh, 540px)', minHeight: 380, position: 'relative', margin: '18px 0 8px' }}>
        <FlowingMenu items={MENU_ITEMS} speed={18} />
      </div>

      <div style={{ marginTop: 40 }}>
        <CircuitBoard />
      </div>

      {/* 5th skill card: Vocabulary. Kept separate from the FlowingMenu hero
          above (hero untouched) and styled like the site's cards. */}
      <div style={{ marginTop: 16 }}>
        <Link href="/tu-vung" className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="icon-badge">
              <LanguageIcon width={19} height={19} strokeWidth={1.8} />
            </span>
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: '1.05rem' }}>Từ vựng</strong>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>
                8.842 từ · A1–C1 — học từ vựng theo cấp độ, tra gốc từ, chơi game ghi nhớ.
              </p>
            </div>
            <ArrowUpRightIcon width={18} height={18} style={{ marginLeft: 'auto' }} />
          </div>
        </Link>
      </div>
      </main>
    </>
  );
}

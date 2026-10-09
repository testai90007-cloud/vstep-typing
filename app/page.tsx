'use client';

// Home: hero with DarkVeil animated background + FlowingMenu (4 skills,
// click goes straight to the skill page) + CircuitBoard utilities.

import FlowingMenu, { type FlowingMenuItem } from '@/components/FlowingMenu';
import DarkVeil from '@/components/DarkVeil';
import CircuitBoard from '@/components/CircuitBoard';
import { useIsDark } from '@/components/useIsDark';

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
      </main>
    </>
  );
}

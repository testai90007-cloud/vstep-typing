'use client';

// Home: hero with DarkVeil animated background + FlowingMenu (4 skills,
// click goes straight to the skill page) + utilities.

import Link from 'next/link';import {
  ChartBarIcon,
  IdentificationIcon,
  Cog6ToothIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import FlowingMenu, { type FlowingMenuItem } from '@/components/FlowingMenu';
import DarkVeil from '@/components/DarkVeil';
import { useIsDark } from '@/components/useIsDark';

const MENU_ITEMS: FlowingMenuItem[] = [
  { link: '/writing', text: 'Luyện Viết', image: '/images/writing.jpg' },
  { link: '/speaking', text: 'Luyện Nói', image: '/images/speaking.jpg' },
  { link: '/listening', text: 'Luyện Nghe', image: '/images/listening.jpg' },
  { link: '/reading', text: 'Luyện Đọc', image: '/images/reading.jpg' },
];

const TOOLS = [
  {
    href: '/progress',
    title: 'Tiến độ học tập',
    desc: 'Chuỗi ngày học liên tiếp, thống kê từng kỹ năng và lịch sử chi tiết.',
    Icon: ChartBarIcon,
  },
  {
    href: '/ho-so-nang-luc',
    title: 'Hồ sơ năng lực',
    desc: 'Điểm trung bình từng kỹ năng đặt cạnh ngưỡng mục tiêu B1/B2/C1 của bạn.',
    Icon: IdentificationIcon,
  },
  {
    href: '/settings',
    title: 'Cài đặt AI',
    desc: 'Thêm API key của riêng bạn (Gemini miễn phí) để AI chấm bài.',
    Icon: Cog6ToothIcon,
  },
];

export default function HomePage() {
  const isDark = useIsDark();

  return (
    <main className="page">
      <section className="hero hero-veil">
        <div className="veil-bg" aria-hidden="true">
          <DarkVeil
            lightMode={!isDark}
            speed={0.5}
            noiseIntensity={0.05}
            warpAmount={0.3}
            resolutionScale={0.75}
          />
        </div>
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

      <h2 className="section-title" style={{ marginTop: 40 }}>
        Tiện ích
      </h2>
      <div className="feature-grid">
        {TOOLS.map(({ href, title, desc, Icon }) => (
          <Link key={href} href={href} className="feature-card">
            <span className="icon-badge">
              <Icon width={20} height={20} strokeWidth={1.8} />
            </span>
            <strong>{title}</strong>
            <p>{desc}</p>
            <span className="go">
              Mở
              <ArrowRightIcon width={15} height={15} />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}

'use client';

// Home: slim hero + FlowingSkills centerpiece + utilities.

import Link from 'next/link';
import {
  ChartBarIcon,
  IdentificationIcon,
  Cog6ToothIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import FlowingSkills from '@/components/FlowingSkills';

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
  return (
    <main className="page">
      <section className="hero hero-clean" style={{ paddingBottom: 8 }}>
        <span className="pill-badge">
          <span className="dot grad-dot" aria-hidden="true" />
          858 đề thi thử · 4 kỹ năng VSTEP
        </span>
        <h1 className="brand">
          Luyện thi VSTEP,
          <br />
          <span className="grad-text">gọn và chính xác.</span>
        </h1>
        <p className="lead">
          Chọn một kỹ năng bên dưới để xem cấu trúc đề và bắt đầu luyện.
        </p>
      </section>

      <FlowingSkills />

      <h2 className="section-title" style={{ marginTop: 44 }}>
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

'use client';

// Home: hero + 4 skill rows + utilities (auth lives in the global header).

import Link from 'next/link';
import {
  ChartBarIcon,
  IdentificationIcon,
  Cog6ToothIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const SKILLS = [
  {
    href: '/writing',
    title: 'Luyện Viết',
    count: '300 đề',
    desc: 'Task 1 + Task 2 · đúng 60 phút như thi thật · AI chấm điểm từng part',
  },
  {
    href: '/speaking',
    title: 'Luyện Nói',
    count: '302 đề',
    desc: 'Đủ 3 parts · ghi âm từng part · AI chấm theo 5 tiêu chí VSTEP',
  },
  {
    href: '/listening',
    title: 'Luyện Nghe',
    count: '56 đề',
    desc: '35 câu mỗi đề · bấm giờ 40 phút · xem lại transcript sau khi nộp',
  },
  {
    href: '/reading',
    title: 'Luyện Đọc',
    count: '200 đề',
    desc: '4 bài đọc × 10 câu mỗi đề · bấm giờ 60 phút · chấm điểm tự động',
  },
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
  return (
    <main className="page">
      <section className="hero hero-clean">
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
          Đề mẫu đúng định dạng, thi thử bấm giờ nghiêm ngặt và phản hồi chi
          tiết bằng tiếng Việt cho cả 4 kỹ năng.
        </p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <a href="#skills" className="btn primary">
            Bắt đầu luyện
            <ArrowRightIcon width={16} height={16} />
          </a>
          <Link href="/progress" className="btn">
            Xem tiến độ
          </Link>
        </div>
        <div className="mini-badges" aria-hidden="true">
          <span>AI chấm Viết &amp; Nói</span>
          <span>60&apos; thi thử</span>
          <span>Chấm 5 tiêu chí</span>
        </div>
      </section>

      <div className="stat-band" aria-label="Số liệu tổng quan">
        <div>
          <b>858</b>
          <span>Đề thi mẫu</span>
        </div>
        <div>
          <b>4</b>
          <span>Kỹ năng</span>
        </div>
        <div>
          <b>60&apos;</b>
          <span>Thi thử Viết/Đọc</span>
        </div>
        <div>
          <b>100%</b>
          <span>Miễn phí</span>
        </div>
      </div>

      <div id="skills" className="sec-head" style={{ scrollMarginTop: 90 }}>
        <p className="eyebrow">Kỹ năng</p>
        <h2>Chọn kỹ năng muốn luyện</h2>
      </div>
      <div className="skill-rows">
        {SKILLS.map(({ href, title, count, desc }, i) => (
          <Link key={href} href={href} className="skill-row">
            <span className="idx">{String(i + 1).padStart(2, '0')}</span>
            <span className="txt">
              <strong>{title}</strong>
              <span className="desc">{desc}</span>
            </span>
            <span className="count-go">
              {count}
              <ArrowRightIcon width={18} height={18} className="arr" />
            </span>
          </Link>
        ))}
      </div>

      <h2 className="section-title" style={{ marginTop: 34 }}>
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

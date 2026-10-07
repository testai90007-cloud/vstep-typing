'use client';

// Home: hero + 4 skill rows + utilities (auth lives in the global header).

import Link from 'next/link';
import {
  PencilSquareIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  BookOpenIcon,
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
    Icon: PencilSquareIcon,
  },
  {
    href: '/speaking',
    title: 'Luyện Nói',
    count: '300 đề',
    desc: 'Đủ 3 parts · ghi âm từng part · AI chấm theo 5 tiêu chí VSTEP',
    Icon: MicrophoneIcon,
  },
  {
    href: '/listening',
    title: 'Luyện Nghe',
    count: '56 đề',
    desc: '35 câu mỗi đề · bấm giờ 40 phút · xem lại transcript sau khi nộp',
    Icon: SpeakerWaveIcon,
  },
  {
    href: '/reading',
    title: 'Luyện Đọc',
    count: '200 đề',
    desc: '4 bài đọc × 10 câu mỗi đề · bấm giờ 60 phút · chấm điểm tự động',
    Icon: BookOpenIcon,
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
          <span className="dot" aria-hidden="true" />
          856 đề thi thử · 4 kỹ năng VSTEP
        </span>
        <h1 className="brand">
          Luyện VSTEP <span className="grad">vui hơn</span>
          <br />
          mỗi ngày
        </h1>
        <p className="lead">
          Trọn bộ đề thi thử đúng format thi thật cho cả 4 kỹ năng — làm đề, bấm
          giờ, chấm điểm và lưu tiến độ theo tài khoản Google của bạn.
        </p>
        <div className="btn-row">
          <a href="#skills" className="btn primary">
            Chọn kỹ năng
            <ArrowRightIcon width={16} height={16} />
          </a>
          <Link href="/progress" className="btn">
            <ChartBarIcon width={18} height={18} />
            Xem tiến độ
          </Link>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <b>856</b>
            <span>đề thi thử</span>
          </div>
          <div className="hero-stat">
            <b>4</b>
            <span>kỹ năng VSTEP</span>
          </div>
          <div className="hero-stat">
            <b>AI</b>
            <span>chấm điểm Viết &amp; Nói</span>
          </div>
        </div>
      </section>

      <div id="skills" className="sec-head" style={{ scrollMarginTop: 90 }}>
        <p className="eyebrow">Bắt đầu từ đây</p>
        <h2>Chọn kỹ năng muốn luyện</h2>
      </div>
      <div className="skill-rows">
        {SKILLS.map(({ href, title, count, desc, Icon }, i) => (
          <Link key={href} href={href} className="skill-row">
            <span className="idx">{String(i + 1).padStart(2, '0')}</span>
            <span className="icon-badge">
              <Icon width={20} height={20} strokeWidth={1.8} />
            </span>
            <span className="txt">
              <strong>
                {title}
                <span className="n">{count}</span>
              </strong>
              <span className="desc">{desc}</span>
            </span>
            <ArrowRightIcon width={20} height={20} className="arr" />
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

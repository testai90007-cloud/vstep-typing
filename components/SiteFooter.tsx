// Minimal footer, Vercel-style: muted, one hairline, tiny link columns.
// Static server component — no client JS needed.

import Link from 'next/link';

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Luyện tập',
    links: [
      { href: '/writing', label: 'Luyện Viết' },
      { href: '/speaking', label: 'Luyện Nói' },
      { href: '/listening', label: 'Luyện Nghe' },
      { href: '/reading', label: 'Luyện Đọc' },
    ],
  },
  {
    title: 'Tài khoản',
    links: [
      { href: '/progress', label: 'Tiến độ học tập' },
      { href: '/ho-so-nang-luc', label: 'Hồ sơ năng lực' },
      { href: '/settings', label: 'Cài đặt AI' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="logo-mark" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 16 16">
                <path d="M8 1.5 L15 14.5 H1 Z" fill="currentColor" />
              </svg>
            </span>
            <p>Luyện VSTEP — công cụ ôn thi VSTEP miễn phí, lưu tiến độ theo tài khoản Google của bạn.</p>
          </div>
          {COLS.map((col) => (
            <nav key={col.title} className="footer-col" aria-label={col.title}>
              <h4>{col.title}</h4>
              {col.links.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 Luyện VSTEP</span>
          <span>VSTEP · B1–C1</span>
        </div>
      </div>
    </footer>
  );
}

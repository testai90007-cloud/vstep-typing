'use client';

// Global site header: original logo mark (graduation cap + app name),
// main navigation with Heroicons, Google sign-in state.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import ThemeToggle from '@/components/ThemeToggle';
import {
  PencilSquareIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  BookOpenIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

const NAV = [
  { href: '/writing', label: 'Luyện Viết', Icon: PencilSquareIcon },
  { href: '/speaking', label: 'Luyện Nói', Icon: MicrophoneIcon },
  { href: '/listening', label: 'Luyện Nghe', Icon: SpeakerWaveIcon },
  { href: '/reading', label: 'Luyện Đọc', Icon: BookOpenIcon },
  { href: '/progress', label: 'Tiến độ', Icon: ChartBarIcon },
  { href: '/settings', label: 'Cài đặt AI', Icon: Cog6ToothIcon },
];

// Bottom tab bar for touch screens: the 4 skills + progress as large tap
// targets. Rendered always; CSS shows it only on narrow viewports.
const MOBILE_NAV = [
  { href: '/writing', label: 'Viết', Icon: PencilSquareIcon },
  { href: '/speaking', label: 'Nói', Icon: MicrophoneIcon },
  { href: '/listening', label: 'Nghe', Icon: SpeakerWaveIcon },
  { href: '/reading', label: 'Đọc', Icon: BookOpenIcon },
  { href: '/progress', label: 'Tiến độ', Icon: ChartBarIcon },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.5 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.5 0 10.2 0 12s.5 3.5 1.4 5.2l3.8-2.8z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.8l3.8 2.9c.9-2.9 3.6-5 6.8-5z"
      />
    </svg>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  // The home page has its own skill navigation — hide the nav links there
  // to avoid duplication, keeping only the logo and sign-in.
  const hideNav = pathname === '/';

  return (
    <>
      <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="logo" aria-label="Luyện VSTEP — trang chủ">
          <span className="logo-mark" aria-hidden="true" />
          <span className="logo-text">Luyện VSTEP</span>
        </Link>

        {!hideNav && (
          <nav className="site-nav" aria-label="Điều hướng chính">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link key={href} href={href} className={active ? 'active' : ''} title={label}>
                  <Icon width={16} height={16} strokeWidth={active ? 2.2 : 1.8} />
                  <span className="nav-label">{label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <div className="header-user">
          <ThemeToggle />
          <Link
            href="/settings"
            className="icon-btn mobile-only"
            title="Cài đặt AI"
            aria-label="Cài đặt AI"
          >
            <Cog6ToothIcon width={18} height={18} />
          </Link>
          {status === 'loading' ? null : session?.user ? (
            <>
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="header-avatar"
                  referrerPolicy="no-referrer"
                />
              )}
              <button
                className="icon-btn"
                onClick={() => signOut()}
                title="Đăng xuất"
                aria-label="Đăng xuất"
              >
                <ArrowRightOnRectangleIcon width={18} height={18} />
              </button>
            </>
          ) : (
            <button
              className="btn primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              onClick={() => signIn('google')}
            >
              <GoogleIcon />
              Đăng nhập
            </button>
          )}
        </div>
      </div>
      </header>

      {/* bottom tab bar — touch-friendly skill switching on narrow screens.
          Sibling of the header (not inside it): the header's backdrop-filter
          would trap a position:fixed descendant. */}
      <nav className="mobile-nav" aria-label="Điều hướng kỹ năng">
        {MOBILE_NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} className={active ? 'active' : ''}>
              <span className="mnav-icon">
                <Icon width={22} height={22} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

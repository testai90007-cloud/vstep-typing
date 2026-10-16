'use client';

// NavDock — floating skill dock shown on inner pages INSTEAD of the top
// nav bar (the homepage keeps SiteHeader). React Bits Dock with macOS-style
// magnification; items navigate between the skill pages.

import { usePathname, useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import {
  PencilSquareIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  BookOpenIcon,
  LanguageIcon,
  ChartBarIcon,
  ClockIcon,
  IdentificationIcon,
  Cog6ToothIcon,
  MoonIcon,
  SunIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

import Dock, { type DockItem } from '@/components/Dock';
import { useIsDark } from '@/components/useIsDark';
import { flipThemeAnimated } from '@/components/ui/animated-theme-toggler';

const iconProps = { width: 22, height: 22 } as const;

export default function NavDock() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isDark = useIsDark();

  const go = (href: string) => () => router.push(href);
  // "You are here" state: a section is active on its own page and subpages
  // (e.g. /writing/de-thi/12 still highlights Luyện Viết).
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const authItem: DockItem | null =
    status === 'loading'
      ? null
      : session?.user
        ? {
            label: 'Đăng xuất',
            icon: session.user.image ? (
              <img
                src={session.user.image}
                alt=""
                className="dock-avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <ArrowRightOnRectangleIcon {...iconProps} />
            ),
            onClick: () => signOut(),
          }
        : {
            label: 'Đăng nhập',
            icon: <ArrowRightOnRectangleIcon {...iconProps} />,
            onClick: () => signIn('google'),
          };

  const items: DockItem[] = [
    { label: 'Luyện Viết', icon: <PencilSquareIcon {...iconProps} />, onClick: go('/writing'), active: isActive('/writing') },
    { label: 'Luyện Nói', icon: <MicrophoneIcon {...iconProps} />, onClick: go('/speaking'), active: isActive('/speaking') },
    { label: 'Luyện Nghe', icon: <SpeakerWaveIcon {...iconProps} />, onClick: go('/listening'), active: isActive('/listening') },
    { label: 'Luyện Đọc', icon: <BookOpenIcon {...iconProps} />, onClick: go('/reading'), active: isActive('/reading') },
    { label: 'Từ vựng', icon: <LanguageIcon {...iconProps} />, onClick: go('/tu-vung'), active: isActive('/tu-vung') },
    { separator: true },
    { label: 'Tiến độ', icon: <ChartBarIcon {...iconProps} />, onClick: go('/progress'), active: isActive('/progress') },
    { label: 'Lịch sử', icon: <ClockIcon {...iconProps} />, onClick: go('/lich-su'), active: isActive('/lich-su') },
    { label: 'Hồ sơ năng lực', icon: <IdentificationIcon {...iconProps} />, onClick: go('/ho-so-nang-luc'), active: isActive('/ho-so-nang-luc') },
    { label: 'Cài đặt AI', icon: <Cog6ToothIcon {...iconProps} />, onClick: go('/settings'), active: isActive('/settings') },
    { separator: true },
    {
      label: isDark ? 'Giao diện sáng' : 'Giao diện tối',
      icon: isDark ? <SunIcon {...iconProps} /> : <MoonIcon {...iconProps} />,
      onClick: e => {
        const r = e.currentTarget.getBoundingClientRect();
        flipThemeAnimated(r.left + r.width / 2, r.top + r.height / 2);
      },
    },
    ...(authItem ? [authItem] : []),
  ];

  return <Dock items={items} theme={isDark ? 'dark' : 'light'} className="nav-dock" />;
}

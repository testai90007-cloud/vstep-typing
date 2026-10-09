'use client';

// HomeDock — floating skill dock shown on the homepage INSTEAD of the top
// nav bar (other pages keep SiteHeader). React Bits Dock with macOS-style
// magnification; items navigate to the skill pages.

import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import {
  PencilSquareIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  BookOpenIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  MoonIcon,
  SunIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

import Dock, { type DockItem } from '@/components/Dock';
import { useIsDark } from '@/components/useIsDark';
import { flipThemeAnimated } from '@/components/ui/animated-theme-toggler';

const iconProps = { width: 22, height: 22 } as const;

export default function HomeDock() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isDark = useIsDark();

  const go = (href: string) => () => router.push(href);

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
    { label: 'Luyện Viết', icon: <PencilSquareIcon {...iconProps} />, onClick: go('/writing') },
    { label: 'Luyện Nói', icon: <MicrophoneIcon {...iconProps} />, onClick: go('/speaking') },
    { label: 'Luyện Nghe', icon: <SpeakerWaveIcon {...iconProps} />, onClick: go('/listening') },
    { label: 'Luyện Đọc', icon: <BookOpenIcon {...iconProps} />, onClick: go('/reading') },
    { separator: true },
    { label: 'Tiến độ', icon: <ChartBarIcon {...iconProps} />, onClick: go('/progress') },
    { label: 'Cài đặt AI', icon: <Cog6ToothIcon {...iconProps} />, onClick: go('/settings') },
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

  return <Dock items={items} theme={isDark ? 'dark' : 'light'} className="home-dock" />;
}

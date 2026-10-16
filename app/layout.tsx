import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import { MotionConfig } from 'motion/react';
import './globals.css';
import Providers from '@/components/Providers';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-jb',
});

export const metadata: Metadata = {
  title: 'Luyện VSTEP — Writing, Speaking, Listening, Reading',
  description:
    'Luyện 4 kỹ năng VSTEP theo đúng format thi thật: gõ template Writing, luyện nói Speaking, luyện nghe Listening và luyện đọc Reading.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* Apply the saved theme before first paint to avoid a flash. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('vstep_theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`}
        </Script>
      </head>
      <body className={jetbrainsMono.variable}>
        <Providers>
          <a href="#main-content" className="skip-link">
            Bỏ qua tới nội dung
          </a>
          <MotionConfig reducedMotion="user">
            <SiteHeader />
            <div id="main-content" tabIndex={-1}>
              {children}
            </div>
            <SiteFooter />
          </MotionConfig>
        </Providers>
      </body>
    </html>
  );
}

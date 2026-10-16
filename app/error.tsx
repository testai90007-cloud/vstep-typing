'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary (app/error.tsx): catches render errors inside
 * a route segment and shows a friendly Vietnamese message + retry, instead
 * of Next.js's default error page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <main className="page page-narrow">
      <p className="page-eyebrow">Đã có lỗi xảy ra</p>
      <h1 className="page-title">Trang này gặp sự cố</h1>
      <p className="page-sub">
        Đừng lo — bài làm đã lưu của bạn vẫn còn. Thử tải lại trang, hoặc quay về trang chủ.
      </p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => reset()}>
          Thử lại
        </button>
        <a className="btn btn-soft" href="/">
          Về trang chủ
        </a>
      </div>
    </main>
  );
}

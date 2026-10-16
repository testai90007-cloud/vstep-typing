'use client';

/**
 * Root error boundary (app/global-error.tsx): last resort when even the
 * root layout fails. Must render its own <html>/<body> because the layout
 * itself is what broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body>
        <main style={{ maxWidth: 640, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>Ứng dụng gặp sự cố</h1>
          <p style={{ opacity: 0.75, marginBottom: 24 }}>
            Đã có lỗi nghiêm trọng. Thử tải lại trang — nếu vẫn lỗi, quay lại sau ít phút.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: '10px 20px', borderRadius: 999, border: '1px solid currentColor', cursor: 'pointer' }}
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}

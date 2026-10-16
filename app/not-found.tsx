/**
 * 404 page (app/not-found.tsx): shown for unknown routes.
 */
export default function NotFound() {
  return (
    <main className="page page-narrow">
      <p className="page-eyebrow">404</p>
      <h1 className="page-title">Không tìm thấy trang</h1>
      <p className="page-sub">
        Đường dẫn này không tồn tại hoặc đã được dời đi. Quay về trang chủ để tiếp tục luyện tập.
      </p>
      <div className="btn-row">
        <a className="btn" href="/">
          Về trang chủ
        </a>
      </div>
    </main>
  );
}

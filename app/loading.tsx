/**
 * Loading state (app/loading.tsx): shown while a route segment loads.
 */
export default function Loading() {
  return (
    <main className="page page-narrow">
      <p className="page-sub" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="spinner" aria-hidden="true" />
        Đang tải…
      </p>
    </main>
  );
}

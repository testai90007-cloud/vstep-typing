'use client';
import LatticeLoader from '@/components/LatticeLoader';

export default function LatticeCheckPage() {
  return (
    <main className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <LatticeLoader status="working" label="AI đang chấm" showTimer fontSize={13} />
    </main>
  );
}

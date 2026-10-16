import VocabWordDetail from '@/components/VocabWordDetail';

// Trang chi tiết từ — server component mỏng, render client component dùng chung.
export default function VocabWordPage({ params }: { params: { word: string } }) {
  const word = decodeURIComponent(params.word);
  return <VocabWordDetail word={word} />;
}

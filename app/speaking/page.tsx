'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeftIcon, MicrophoneIcon, TrophyIcon } from '@heroicons/react/24/outline';
import ExamFormatCard from '@/components/ExamFormatCard';
import { TestSearchBar, type SearchItem } from '@/components/TestSearchBar';
import { SPEAKING_TESTS } from '@/lib/speaking-tests';

interface SpeakingSession {
  part: number;
  prompt: string;
  overall: number;
}

/**
 * Map a saved session back to its test via the test's full identity triple —
 * Part 1 = all questions, Part 2 = situation + options, Part 3 = topic +
 * points + follow-ups. A session is attributed only when its part content
 * matches exactly ONE test; if two tests share the same part content the
 * session is ambiguous and gets no badge, rather than a wrong one.
 */
function buildPartFingerprint(part: number, prompt: string): string | null {
  if (part === 1) {
    const m = prompt.match(/^Part 1 questions:\n([\s\S]+)$/m);
    return m ? `1:${m[1].trim()}` : null;
  }
  if (part === 2) {
    const m = prompt.match(/^Situation: ([\s\S]+)$/m);
    return m ? `2:${m[1].trim()}` : null;
  }
  if (part === 3) {
    const m = prompt.match(/^Topic: ([\s\S]+)$/m);
    return m ? `3:${m[1].trim()}` : null;
  }
  return null;
}

function testIdForSession(
  s: SpeakingSession,
  byFingerprint: Map<string, string[]>
): string | undefined {
  const fp = buildPartFingerprint(s.part, s.prompt);
  if (!fp) return undefined;
  const ids = byFingerprint.get(fp);
  return ids && ids.length === 1 ? ids[0] : undefined;
}

export default function SpeakingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  /** best per-test overall (0–10), keyed by test id */
  const [best, setBest] = useState<Record<string, number>>({});

  // Part 1 question counts come from the data — most tests have 6, a few
  // have 7, so the format card shows the real range, not a hardcoded "6".
  const part1Counts = useMemo(() => SPEAKING_TESTS.map((t) => t.part1.length), []);
  const part1Min = Math.min(...part1Counts);
  const part1Max = Math.max(...part1Counts);
  const part1Label =
    part1Min === part1Max ? `${part1Min} câu hỏi` : `${part1Min}–${part1Max} câu hỏi`;

  const lookups = useMemo(() => {
    const byFingerprint = new Map<string, string[]>();
    const add = (fp: string, id: string) => {
      const list = byFingerprint.get(fp) ?? [];
      if (!list.includes(id)) list.push(id);
      byFingerprint.set(fp, list);
    };
    for (const t of SPEAKING_TESTS) {
      // Fingerprints mirror the exact prompt text stored with each session
      // (see buildPartFingerprint): numbered questions / situation + options /
      // topic + mind-map + follow-ups.
      add(`1:${t.part1.map((q, i) => `${i + 1}. ${q}`).join('\n')}`, t.id);
      add(
        `2:${t.part2.situation}\nOptions:\n${t.part2.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
        t.id
      );
      add(
        `3:${t.part3.topic}\nMind-map: ${t.part3.points.join(' / ')}\nFollow-up questions:\n${t.part3.followUps.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
        t.id
      );
    }
    return { byFingerprint };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/speaking/history')
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, number> = {};
        for (const s of (d.sessions || []) as SpeakingSession[]) {
          const testId = testIdForSession(s, lookups.byFingerprint);
          if (!testId || s.overall == null) continue;
          const v = Math.round((s.overall || 0) * 10) / 10;
          if (map[testId] == null || v > map[testId]) map[testId] = v;
        }
        setBest(map);
      })
      .catch(() => {});
  }, [session, lookups]);

  const searchItems: SearchItem[] = SPEAKING_TESTS.map((t) => ({
    id: t.id,
    num: t.num,
    title: t.title,
  }));

  const openTest = (item: SearchItem) => {
    router.push(`/speaking/de-thi/${item.id}`);
  };

  const openRandom = () => {
    const t = SPEAKING_TESTS[Math.floor(Math.random() * SPEAKING_TESTS.length)];
    router.push(`/speaking/de-thi/${t.id}`);
  };

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <p className="page-eyebrow">02 — Luyện Nói</p>
      <h1 className="page-title">Chọn đề nói</h1>
      <p className="page-sub full">Đúng format thi thật: 12 phút, 3 phần. Ghi âm từng part, AI chấm theo 5 tiêu chí chính thức của VSTEP (thang 0–10). <Link href="/settings">Cài đặt AI key</Link> để dùng key của riêng bạn.</p>

      <ExamFormatCard
        icon={MicrophoneIcon}
        stats={[
          { value: '~12 phút', label: 'tổng thời gian' },
          { value: '3 phần', label: 'thi nói' },
          { value: '0–10', label: 'thang điểm' },
        ]}
        parts={[
          { name: 'Part 1 · Giao tiếp xã hội', minutes: 3, time: "3'", items: part1Label },
          { name: 'Part 2 · Thảo luận giải pháp', minutes: 4, time: "1'+3'", items: '1 tình huống' },
          { name: 'Part 3 · Phát triển chủ đề', minutes: 5, time: "1'+4'", items: '1 chủ đề' },
        ]}
        rules={[
          "1' chuẩn bị: chỉ lập dàn ý",
          'Nói đủ giờ, đúng trọng tâm',
          'Part 3: theo mind-map + câu hỏi gợi ý',
        ]}
      />

      <h2 className="section-title" style={{ marginTop: 28 }}>
        <span className="icon-badge sm">
          <MicrophoneIcon width={18} height={18} strokeWidth={1.6} />
        </span>
        Danh sách đề
      </h2>
      <p className="lead full" style={{ margin: '-4px 0 14px', fontSize: '0.9rem' }}>
        302 đề thi thử — mỗi đề gồm đủ Part 1 ({part1Label}), Part 2 (tình huống + 3 lựa
        chọn) và Part 3 (chủ đề + mind-map + câu hỏi mở rộng), đúng 12 phút như thi thật.
      </p>
      <TestSearchBar
        items={searchItems}
        placeholder="Tìm đề nói…"
        onSelect={openTest}
        onRandom={openRandom}
      />
      <div className="test-grid">
        {SPEAKING_TESTS.map((t) => (
          <Link key={t.id} href={`/speaking/de-thi/${t.id}`} className="test-cell">
            <strong><span className="de-word">Đề</span>{t.title.replace(/^Đề\s+/, '')}</strong>
            {best[t.id] != null && (
              <span className="cell-score">
                <TrophyIcon width={12} height={12} />
                {best[t.id]}/10
              </span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}

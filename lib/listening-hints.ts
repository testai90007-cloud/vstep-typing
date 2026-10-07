// Shared listening part hints (separate module to avoid a circular import:
// the data chunks need these values while lib/listening.ts is still loading).

export const HINTS: Record<number, string> = {
  1: 'Nghe các đoạn ngắn (thông báo, hướng dẫn, hội thoại ngắn). Mỗi đoạn có 1 câu hỏi.',
  2: 'Nghe các đoạn hội thoại dài. Mỗi đoạn có 4 câu hỏi.',
  3: 'Nghe các bài nói / bài giảng. Mỗi bài có 5 câu hỏi.',
};

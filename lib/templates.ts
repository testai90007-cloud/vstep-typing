// ---------------------------------------------------------------------------
// Template data — ported from the original typing-practice page.
// Spelling "dilema" → "dilemma" (Dạng 1 conclusion) corrected 2026-10-07
// with the owner's explicit approval; keep other source wording verbatim.
// ---------------------------------------------------------------------------

export interface TemplateSection {
  /** Vietnamese section name, e.g. "Mở bài" */
  name: string;
  /** Full template text. [BRACKETS] are placeholders to fill in the exam. */
  text: string;
}

export interface WritingTemplate {
  id: string;
  group: 'task2' | 'task1';
  /** Display title, e.g. "Task 2 · Dạng 1 · Discussion" */
  title: string;
  sections: TemplateSection[];
}

export const TEMPLATES: WritingTemplate[] = [
  {
    id: 'task2-dang1',
    group: 'task2',
    title: 'Task 2 · Dạng 1 · Discussion',
    sections: [
      {
        name: 'Mở bài',
        text: 'In recent years, [CHỦ ĐỀ] has become a broad issue to the general public. Some people believe that [QUAN ĐIỂM 1]. However, others think that [QUAN ĐIỂM 2]. In my opinion, I agree with the former/ latter idea. Discussed below are several reasons supporting my perspective.',
      },
      {
        name: 'Quan điểm 1',
        text: 'First and foremost, people should recognize that [QUAN ĐIỂM 1]. A very important point to consider is [LÝ DO 1]. This means that [GIẢI THÍCH 1]. To illustrate this point, I would like to mention that [VÍ DỤ 1]. Another point I would like to make is that [LÝ DO 2]. This is because of the fact that [GIẢI THÍCH 2]. For example, [VÍ DỤ 2].',
      },
      {
        name: 'Quan điểm 2',
        text: 'On the other hand, there are several arguments in support of the idea that [QUAN ĐIỂM 2]. It is also convincing to realise that [LÝ DO 1]. This means that [GIẢI THÍCH]. A specific example of this is that [VÍ DỤ].',
      },
      {
        name: 'Kết luận',
        text: 'In conclusion, the above mentioned facts have created a dilemma when people evaluate the impact of this issue, and it is still a controversial issue. As far as I am concerned, I put more highlight on the idea that [………]. People should have further consideration on this issue.',
      },
    ],
  },
  {
    id: 'task2-dang2',
    group: 'task2',
    title: 'Task 2 · Dạng 2 · Agree–Disagree',
    sections: [
      {
        name: 'Mở bài',
        text: 'In recent years, [CHỦ ĐỀ] has become a broad issue to the general public. Some people believe that [QUAN ĐIỂM]. In my opinion, I partly agree with this idea. Discussed below are several in favor of my perspectives.',
      },
      {
        name: 'Ý kiến đồng ý',
        text: 'First and foremost, people should recognize that [QUAN ĐIỂM]. A very important point to consider is that [LÝ DO 1]. This means that [GIẢI THÍCH 1]. To illustrate this point, I would like to mention that [VÍ DỤ 1]. Another point I would like to make is that [LÝ DO 2]. This is because of the fact that [GIẢI THÍCH 2]. For example, [VÍ DỤ 2].',
      },
      {
        name: 'Ý kiến phản đối',
        text: 'On the other hand, there are several arguments against the statement that [QUAN ĐIỂM]. In fact, people have this opinion because [LÝ DO KHÔNG ĐỒNG Ý]. This means that [GIẢI THÍCH]. This can be shown by the example that [VÍ DỤ].',
      },
      {
        name: 'Kết luận',
        text: 'In conclusion, the above-mentioned facts have created a dilemma when people evaluate the impact of this issue, and it is still a controversial issue. As far as I am concerned, it could have both positive and negative impacts. People should have further consideration on this issue.',
      },
    ],
  },
  {
    id: 'task2-dang3',
    group: 'task2',
    title: 'Task 2 · Dạng 3 · Advantages–Disadvantages',
    sections: [
      {
        name: 'Mở bài',
        text: 'In recent years, [CHỦ ĐỀ] has become a broad issue to the general public. Some people believe that [QUAN ĐIỂM/CHỦ ĐỀ] has many advantages. However, others think that it could also have some negative effects. In my opinion, its cons could never overshadow its pros. Discussed below are several benefits as well as drawbacks of this issue.',
      },
      {
        name: 'Thuận lợi',
        text: 'First and foremost, people should recognize that there are many advantages of [CHỦ ĐỀ]. A very important point to consider is that [THUẬN LỢI 1]. This means that [GIẢI THÍCH 1]. To illustrate this point, I would like to mention that [VÍ DỤ 1]. Another point I would like to make is that [THUẬN LỢI 2]. This because of the fact that [GIẢI THÍCH 2]. For example, [VÍ DỤ 2].',
      },
      {
        name: 'Bất lợi',
        text: 'On the other hand, in addition to the important advantages of this problem, it has some disadvantages. In fact, people have this opinion because [BẤT LỢI]. This means that [GIẢI THÍCH]. This can be shown by the example that [VÍ DỤ].',
      },
      {
        name: 'Kết luận',
        text: 'In conclusion, the above-mentioned facts have outlined the benefits as well as the drawbacks of this issue. Its advantages should be taken into account. People should take advantage of the pros and minimize the cons of this issue.',
      },
    ],
  },
  {
    id: 'task2-dang4',
    group: 'task2',
    title: 'Task 2 · Dạng 4 · Causes–Effects',
    sections: [
      {
        name: 'Mở bài',
        text: 'In recent years, [CHỦ ĐỀ] has become a broad issue to the general public. Some people believe that [QUAN ĐIỂM]. Although noticeable, the impact of this issue has not been realised by many residents. Discussed below are several causes as well as effects of this issue.',
      },
      {
        name: 'Nguyên nhân',
        text: 'First and foremost, people should recognize that there are several main reasons supporting the idea that [QUAN ĐIỂM]. A very important point to consider is that [NGUYÊN NHÂN 1]. This means that [GIẢI THÍCH 1]. To illustrate this point, I would like to mention that [VÍ DỤ 1]. Another point I would like to make is that [NGUYÊN NHÂN 2]. This because of the fact that [GIẢI THÍCH 2]. For example, [VÍ DỤ 2].',
      },
      {
        name: 'Hệ quả',
        text: 'Besides, there are many serious effects of this issue. One primary effect would be that [HẬU QUẢ 1]. In addition, [HẬU QUẢ 2].',
      },
      {
        name: 'Kết luận',
        text: 'In conclusion, the above-mentioned facts have outlined the reasons as well as the measures of this issue. Its causes and effects should be taken into account. People should have further consideration on this issue.',
      },
    ],
  },
  {
    id: 'task2-dang5',
    group: 'task2',
    title: 'Task 2 · Dạng 5 · Causes–Solutions',
    sections: [
      {
        name: 'Mở bài',
        text: 'In recent years, [CHỦ ĐỀ] has become a broad issue to the general public. Some people believe that [QUAN ĐIỂM]. Although noticeable, the impact of this issue has not been realised by many residents. Discussed below are several causes as well as solutions of this issue.',
      },
      {
        name: 'Nguyên nhân',
        text: 'First and foremost, people should recognize that there are several main reasons supporting the idea that [QUAN ĐIỂM]. A very important point to consider is [NGUYÊN NHÂN 1]. This means that [GIẢI THÍCH 1]. To illustrate this point, I would like to mention that [VÍ DỤ 1]. Another point I would like to make is that [NGUYÊN NHÂN 2]. This because of the fact that [GIẢI THÍCH 2]. For example, [VÍ DỤ 2].',
      },
      {
        name: 'Giải pháp',
        text: 'In order to resolve such problems, people should take some concerted measures. One primary solution would be that [GIẢI PHÁP 1]. In addition, [GIẢI PHÁP 2]. However, education is the main way to tackle this issue. People need to be aware of the effects so that they can avoid this problem.',
      },
      {
        name: 'Kết luận',
        text: 'In conclusion, the above-mentioned facts have outlined the reasons as well as the measures of this issue. The presented suggestions would be very good steps towards solving them. People should have further consideration on this issue.',
      },
    ],
  },
  {
    id: 'task1-than-mat',
    group: 'task1',
    title: 'Task 1 · Thư thân mật',
    sections: [
      { name: 'Lời chào', text: 'Dear [TÊN],' },
      {
        name: 'Mở đầu thư',
        text: 'Thanks for your letter/email. I am writing to [MỤC ĐÍCH VIẾT THƯ].',
      },
      {
        name: 'Nội dung chính',
        text: 'With regard to [TRẢ LỜI CÂU HỎI 1]. As for [TRẢ LỜI CÂU HỎI 2]. Finally, [TRẢ LỜI CÂU HỎI 3].',
      },
      { name: 'Kết thư', text: 'See you soon.' },
      { name: 'Lời chào cuối', text: 'Best wishes,\n[TÊN]' },
    ],
  },
  {
    id: 'task1-trang-trong',
    group: 'task1',
    title: 'Task 1 · Thư trang trọng',
    sections: [
      { name: 'Lời chào', text: 'Dear Mr./Mrs [TÊN],' },
      {
        name: 'Mở đầu thư',
        text: 'It’s my pleasure to get your email. I am writing to reply to your letter/email about [CHỦ ĐỀ].',
      },
      {
        name: 'Nội dung chính',
        text: 'With regard to [TRẢ LỜI CÂU HỎI 1]. As for [TRẢ LỜI CÂU HỎI 2]. Finally, [TRẢ LỜI CÂU HỎI 3].',
      },
      { name: 'Kết thư', text: 'I look forward to hearing from you.' },
      { name: 'Lời chào cuối', text: 'Best regards,\n[TÊN]' },
    ],
  },
  {
    id: 'task1-nua-trang-trong',
    group: 'task1',
    title: 'Task 1 · Thư nửa trang trọng',
    sections: [
      { name: 'Lời chào', text: 'Dear Mr./Mrs [TÊN],' },
      {
        name: 'Mở đầu thư',
        text: 'Thank you very much for your letter/email. I am writing to reply to your letter/email about [CHỦ ĐỀ].',
      },
      {
        name: 'Nội dung chính',
        text: 'With regard to [TRẢ LỜI CÂU HỎI 1]. As for [TRẢ LỜI CÂU HỎI 2]. Finally, [TRẢ LỜI CÂU HỎI 3].',
      },
      { name: 'Kết thư', text: 'I look forward to hearing from you.' },
      { name: 'Lời chào cuối', text: 'Best regards,\n[TÊN]' },
    ],
  },
  {
    id: 'task1-vstep',
    group: 'task1',
    title: 'Task 1 · Dạng đề thường thi VSTEP',
    sections: [
      { name: 'Lời chào', text: 'Dear [TÊN],' },
      {
        name: 'Mở đầu thư',
        text: 'I was very happy when I received your letter/email. How have you been these days? I hope everything is going smoothly with your job. I am writing in response to your questions.',
      },
      {
        name: 'Trả lời 3 câu hỏi',
        text: 'With regard to [TRẢ LỜI CÂU HỎI 1]. As for [TRẢ LỜI CÂU HỎI 2]. Finally, [TRẢ LỜI CÂU HỎI 3].',
      },
      {
        name: 'Kết thư',
        text: 'I am looking forward to receiving your response at your earliest convenience.',
      },
      { name: 'Lời chào cuối', text: 'Best wishes,\n[HỌ VÀ TÊN]' },
    ],
  },
];

export function getTemplate(id: string): WritingTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Whole-article target text (sections joined by a blank line), like the source page. */
export function wholeText(t: WritingTemplate): string {
  return t.sections.map((s) => s.text).join('\n\n');
}

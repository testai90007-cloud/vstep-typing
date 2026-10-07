// ---------------------------------------------------------------------------
// "Xem ví dụ điền sẵn" — sample filled-in versions of each template.
// These are ORIGINAL sample content written for this app (not from the
// source page). Each example mirrors its template section-by-section so
// learners can see how the placeholders get filled in a real exam.
// ---------------------------------------------------------------------------

export interface FilledExample {
  /** Matches a WritingTemplate id in lib/templates.ts */
  templateId: string;
  /** Short label of the sample topic, shown above the example */
  topicLabel: string;
  /** One filled text per template section, in the same order */
  sections: string[];
}

export const EXAMPLES: FilledExample[] = [
  {
    templateId: 'task2-dang1',
    topicLabel: 'Chủ đề mẫu: trẻ em dùng điện thoại thông minh',
    sections: [
      'In recent years, the use of smartphones among children has become a broad issue to the general public. Some people believe that smartphones bring many benefits to children. However, others think that they do more harm than good. In my opinion, I agree with the latter idea. Discussed below are several reasons supporting my perspective.',
      'First and foremost, people should recognize that they do more harm than good. A very important point to consider is easy access to learning resources. This means that children can look up information and study online anytime. To illustrate this point, I would like to mention that many students use educational apps to improve their English. Another point I would like to make is that smartphones help children stay connected with their family. This is because of the fact that parents can contact their children easily when they are away from home. For example, a short video call can reassure worried parents.',
      'On the other hand, there are several arguments in support of the idea that they do more harm than good. It is also convincing to realise that children may become addicted to games and social media. This means that they spend less time studying and talking with their family. A specific example of this is that many teenagers stay up late playing games on their phones.',
      'In conclusion, the above mentioned facts have created a dilemma when people evaluate the impact of this issue, and it is still a controversial issue. As far as I am concerned, I put more highlight on the idea that parents should control how their children use smartphones. People should have further consideration on this issue.',
    ],
  },
  {
    templateId: 'task2-dang2',
    topicLabel: 'Chủ đề mẫu: làm việc tại nhà',
    sections: [
      'In recent years, working from home has become a broad issue to the general public. Some people believe that working from home is more effective than working in the office. In my opinion, I partly agree with this idea. Discussed below are several in favor of my perspectives.',
      'First and foremost, people should recognize that working from home is more effective than working in the office. A very important point to consider is that employees can save a lot of commuting time. This means that they have more time for work and rest. To illustrate this point, I would like to mention that many office workers in big cities spend two hours commuting every day. Another point I would like to make is that people feel more comfortable in their own space. This is because of the fact that they can arrange their working environment as they like. For example, some people work better with music in the background.',
      'On the other hand, there are several arguments against the statement that working from home is more effective than working in the office. In fact, people have this opinion because face-to-face communication is limited. This means that teamwork and quick discussions become more difficult. This can be shown by the example that many creative ideas come from casual conversations in the office.',
      'In conclusion, the above-mentioned facts have created a dilemma when people evaluate the impact of this issue, and it is still a controversial issue. As far as I am concerned, it could have both positive and negative impacts. People should have further consideration on this issue.',
    ],
  },
  {
    templateId: 'task2-dang3',
    topicLabel: 'Chủ đề mẫu: mua sắm trực tuyến',
    sections: [
      'In recent years, online shopping has become a broad issue to the general public. Some people believe that online shopping has many advantages. However, others think that it could also have some negative effects. In my opinion, its cons could never overshadow its pros. Discussed below are several benefits as well as drawbacks of this issue.',
      'First and foremost, people should recognize that there are many advantages of online shopping. A very important point to consider is that customers can buy products at lower prices. This means that they can compare prices from many sellers easily. To illustrate this point, I would like to mention that the same pair of shoes is often cheaper online than in physical stores. Another point I would like to make is that online shopping saves a lot of time. This because of the fact that people do not need to travel to the shops. For example, busy parents can order groceries on their phones in a few minutes.',
      'On the other hand, in addition to the important advantages of this problem, it has some disadvantages. In fact, people have this opinion because customers cannot check the quality of products before buying. This means that they may receive items different from the pictures. This can be shown by the example that many people complain about clothes that do not fit after ordering online.',
      'In conclusion, the above-mentioned facts have outlined the benefits as well as the drawbacks of this issue. Its advantages should be taken into account. People should take advantage of the pros and minimize the cons of this issue.',
    ],
  },
  {
    templateId: 'task2-dang4',
    topicLabel: 'Chủ đề mẫu: ô nhiễm không khí ở thành phố lớn',
    sections: [
      'In recent years, air pollution in big cities has become a broad issue to the general public. Some people believe that air pollution is getting more serious every year. Although noticeable, the impact of this issue has not been realised by many residents. Discussed below are several causes as well as effects of this issue.',
      'First and foremost, people should recognize that there are several main reasons supporting the idea that air pollution is getting more serious every year. A very important point to consider is that the number of private vehicles is increasing rapidly. This means that more exhaust fumes are released into the air. To illustrate this point, I would like to mention that traffic jams in Hanoi often last for hours during rush hour. Another point I would like to make is that many factories do not treat their waste properly. This because of the fact that installing treatment systems is expensive. For example, several industrial zones have been fined for discharging untreated smoke.',
      'Besides, there are many serious effects of this issue. One primary effect would be that people suffer from more respiratory diseases. In addition, the polluted air reduces the quality of life and working productivity of city residents.',
      'In conclusion, the above-mentioned facts have outlined the reasons as well as the measures of this issue. Its causes and effects should be taken into account. People should have further consideration on this issue.',
    ],
  },
  {
    templateId: 'task2-dang5',
    topicLabel: 'Chủ đề mẫu: kẹt xe',
    sections: [
      'In recent years, traffic congestion has become a broad issue to the general public. Some people believe that traffic jams are becoming unbearable in big cities. Although noticeable, the impact of this issue has not been realised by many residents. Discussed below are several causes as well as solutions of this issue.',
      'First and foremost, people should recognize that there are several main reasons supporting the idea that traffic jams are becoming unbearable in big cities. A very important point to consider is the rapid growth of private vehicles. This means that the roads cannot handle the increasing traffic volume. To illustrate this point, I would like to mention that the number of motorbikes in Ho Chi Minh City has doubled in the last ten years. Another point I would like to make is that public transport is not convenient enough. This because of the fact that buses are often late and overcrowded. For example, many commuters prefer riding their own motorbikes rather than waiting for a bus.',
      'In order to resolve such problems, people should take some concerted measures. One primary solution would be that the government should invest more in public transport systems. In addition, stricter regulations on private vehicles in city centers should be applied. However, education is the main way to tackle this issue. People need to be aware of the effects so that they can avoid this problem.',
      'In conclusion, the above-mentioned facts have outlined the reasons as well as the measures of this issue. The presented suggestions would be very good steps towards solving them. People should have further consideration on this issue.',
    ],
  },
  {
    templateId: 'task1-than-mat',
    topicLabel: 'Tình huống mẫu: hỏi bạn về khóa học tiếng Anh',
    sections: [
      'Dear Lan,',
      'Thanks for your letter/email. I am writing to ask for some advice about learning English.',
      'With regard to your question about which English center I should choose, I am considering the one near my office. As for the course fee, I heard it is quite reasonable. Finally, the evening schedule fits my working hours perfectly.',
      'See you soon.',
      'Best wishes,\nMinh',
    ],
  },
  {
    templateId: 'task1-trang-trong',
    topicLabel: 'Tình huống mẫu: trả lời thư mời phỏng vấn',
    sections: [
      'Dear Mr. Smith,',
      'It’s my pleasure to get your email. I am writing to reply to your letter/email about the job interview invitation.',
      'With regard to the interview time, I am available on Friday morning. As for the required documents, I have prepared my CV and certificates. Finally, I would like to know the exact address of your office.',
      'I look forward to hearing from you.',
      'Best regards,\nNguyen Van A',
    ],
  },
  {
    templateId: 'task1-nua-trang-trong',
    topicLabel: 'Tình huống mẫu: trả lời thầy/cô về đăng ký khóa học',
    sections: [
      'Dear Mrs. Hoa,',
      'Thank you very much for your letter/email. I am writing to reply to your letter/email about the English course registration.',
      'With regard to the course level, I would like to join the intermediate class. As for the starting date, next Monday works well for me. Finally, I want to confirm the classroom location.',
      'I look forward to hearing from you.',
      'Best regards,\nTran Thi B',
    ],
  },
  {
    templateId: 'task1-vstep',
    topicLabel: 'Tình huống mẫu: trả lời 3 câu hỏi của bạn về căn hộ mới',
    sections: [
      'Dear Hung,',
      'I was very happy when I received your letter/email. How have you been these days? I hope everything is going smoothly with your job. I am writing in response to your questions.',
      'With regard to your first question about my new apartment, it is small but comfortable. As for the neighborhood, it is quiet and friendly. Finally, the rent is affordable for me.',
      'I am looking forward to receiving your response at your earliest convenience.',
      'Best wishes,\nPham Van C',
    ],
  },
];

export function getExample(templateId: string): FilledExample | undefined {
  return EXAMPLES.find((e) => e.templateId === templateId);
}

// Speaking tests 2 → 1 (bổ sung từ file VSTEP_Owl_Speaking_01_02_bo_sung.docx).
import type { SpeakingTest } from '../speaking-tests';

export const DATA_06: SpeakingTest[] = [
  { id: "sp-2", num: 2, title: "Đề 2",
    part1: ["How often do you check your email?", "What do you usually use email for?", "Do you think email is still an important way of communication nowadays?", "Do you exercise regularly?", "What type of physical activity do you enjoy the most?", "How do you usually make time for exercise in your daily schedule?"],
    part2: { situation: "Your company is planning an annual company trip for all employees. Choose the best option and explain your reasons.", options: ["A trip to a riverside area", "A trip to a theme park", "A camping trip in the countryside"] },
    part3: { topic: "The key factors that make a training workshop successful", points: ["Clear objectives and well-structured content", "Qualified and engaging trainers", "Interactive activities and participant engagement"], followUps: ["What do you think makes a training workshop successful?", "How can a company measure whether a workshop has achieved its goals?", "If a company has a limited budget, what aspects of a workshop could be downsized without affecting its quality?"] } },
  { id: "sp-1", num: 1, title: "Đề 1",
    part1: ["Do you often take breaks during work or study?", "What do you usually do during your breaks?", "How important do you think breaks are for productivity?", "Do you prefer indoor or outdoor activities?", "What do you usually do in your office during your free time?", "Do you think a comfortable workplace affects how well you perform?"],
    part2: { situation: "Your family is choosing an elementary school for your younger sister. Choose the best option and explain your reasons.", options: ["A private school", "An international school", "A public school"] },
    part3: { topic: "The benefits of investment in the arts", points: ["Improving individual skills and creativity", "Contributing to cultural growth and preservation", "Boosting economic development through creative industries"], followUps: ["How can governments encourage more investment in the arts?", "Do you think art education should be compulsory in schools?", "What role do the arts play in shaping a country's international image?"] } },
];

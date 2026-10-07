// ---------------------------------------------------------------------------
// 200 VSTEP Reading tests (Đề 001 → Đề 200), parsed from the user-uploaded docx.
// VSTEP format: 4 passages x 10 questions = 40 questions, 60 minutes.
// ---------------------------------------------------------------------------

export interface ReadingQuestion {
  q: string;
  options: string[]; // 4 options, A/B/C/D
  answer: number; // index of the correct option (0-3)
}

export interface ReadingPassage {
  title: string;
  paragraphs: string[];
  questions: ReadingQuestion[]; // 10
}

export interface ReadingTest {
  id: string; // 'rd-001'
  num: number; // 1
  title: string; // 'Đề 001'
  timeMin: number; // 60
  parts: ReadingPassage[]; // 4
}

import { DATA_01 as R_DATA_01 } from './reading-tests/data-01';
import { DATA_02 as R_DATA_02 } from './reading-tests/data-02';
import { DATA_03 as R_DATA_03 } from './reading-tests/data-03';
import { DATA_04 as R_DATA_04 } from './reading-tests/data-04';
import { DATA_05 as R_DATA_05 } from './reading-tests/data-05';
import { DATA_06 as R_DATA_06 } from './reading-tests/data-06';
import { DATA_07 as R_DATA_07 } from './reading-tests/data-07';
import { DATA_08 as R_DATA_08 } from './reading-tests/data-08';
import { DATA_09 as R_DATA_09 } from './reading-tests/data-09';
import { DATA_10 as R_DATA_10 } from './reading-tests/data-10';
import { DATA_11 as R_DATA_11 } from './reading-tests/data-11';
import { DATA_12 as R_DATA_12 } from './reading-tests/data-12';
import { DATA_13 as R_DATA_13 } from './reading-tests/data-13';
import { DATA_14 as R_DATA_14 } from './reading-tests/data-14';
import { DATA_15 as R_DATA_15 } from './reading-tests/data-15';
import { DATA_16 as R_DATA_16 } from './reading-tests/data-16';
import { DATA_17 as R_DATA_17 } from './reading-tests/data-17';
import { DATA_18 as R_DATA_18 } from './reading-tests/data-18';
import { DATA_19 as R_DATA_19 } from './reading-tests/data-19';
import { DATA_20 as R_DATA_20 } from './reading-tests/data-20';
import { DATA_21 as R_DATA_21 } from './reading-tests/data-21';
import { DATA_22 as R_DATA_22 } from './reading-tests/data-22';
import { DATA_23 as R_DATA_23 } from './reading-tests/data-23';
import { DATA_24 as R_DATA_24 } from './reading-tests/data-24';
import { DATA_25 as R_DATA_25 } from './reading-tests/data-25';
import { DATA_26 as R_DATA_26 } from './reading-tests/data-26';
import { DATA_27 as R_DATA_27 } from './reading-tests/data-27';
import { DATA_28 as R_DATA_28 } from './reading-tests/data-28';
import { DATA_29 as R_DATA_29 } from './reading-tests/data-29';
import { DATA_30 as R_DATA_30 } from './reading-tests/data-30';
import { DATA_31 as R_DATA_31 } from './reading-tests/data-31';
import { DATA_32 as R_DATA_32 } from './reading-tests/data-32';
import { DATA_33 as R_DATA_33 } from './reading-tests/data-33';
import { DATA_34 as R_DATA_34 } from './reading-tests/data-34';
import { DATA_35 as R_DATA_35 } from './reading-tests/data-35';
import { DATA_36 as R_DATA_36 } from './reading-tests/data-36';
import { DATA_37 as R_DATA_37 } from './reading-tests/data-37';
import { DATA_38 as R_DATA_38 } from './reading-tests/data-38';
import { DATA_39 as R_DATA_39 } from './reading-tests/data-39';
import { DATA_40 as R_DATA_40 } from './reading-tests/data-40';
import { DATA_41 as R_DATA_41 } from './reading-tests/data-41';
import { DATA_42 as R_DATA_42 } from './reading-tests/data-42';
import { DATA_43 as R_DATA_43 } from './reading-tests/data-43';
import { DATA_44 as R_DATA_44 } from './reading-tests/data-44';
import { DATA_45 as R_DATA_45 } from './reading-tests/data-45';
import { DATA_46 as R_DATA_46 } from './reading-tests/data-46';
import { DATA_47 as R_DATA_47 } from './reading-tests/data-47';
import { DATA_48 as R_DATA_48 } from './reading-tests/data-48';
import { DATA_49 as R_DATA_49 } from './reading-tests/data-49';
import { DATA_50 as R_DATA_50 } from './reading-tests/data-50';
import { DATA_51 as R_DATA_51 } from './reading-tests/data-51';
import { DATA_52 as R_DATA_52 } from './reading-tests/data-52';
import { DATA_53 as R_DATA_53 } from './reading-tests/data-53';
import { DATA_54 as R_DATA_54 } from './reading-tests/data-54';
import { DATA_55 as R_DATA_55 } from './reading-tests/data-55';
import { DATA_56 as R_DATA_56 } from './reading-tests/data-56';
import { DATA_57 as R_DATA_57 } from './reading-tests/data-57';
import { DATA_58 as R_DATA_58 } from './reading-tests/data-58';
import { DATA_59 as R_DATA_59 } from './reading-tests/data-59';
import { DATA_60 as R_DATA_60 } from './reading-tests/data-60';
import { DATA_61 as R_DATA_61 } from './reading-tests/data-61';
import { DATA_62 as R_DATA_62 } from './reading-tests/data-62';
import { DATA_63 as R_DATA_63 } from './reading-tests/data-63';
import { DATA_64 as R_DATA_64 } from './reading-tests/data-64';
import { DATA_65 as R_DATA_65 } from './reading-tests/data-65';
import { DATA_66 as R_DATA_66 } from './reading-tests/data-66';
import { DATA_67 as R_DATA_67 } from './reading-tests/data-67';
import { DATA_68 as R_DATA_68 } from './reading-tests/data-68';
import { DATA_69 as R_DATA_69 } from './reading-tests/data-69';
import { DATA_70 as R_DATA_70 } from './reading-tests/data-70';
import { DATA_71 as R_DATA_71 } from './reading-tests/data-71';
import { DATA_72 as R_DATA_72 } from './reading-tests/data-72';
import { DATA_73 as R_DATA_73 } from './reading-tests/data-73';
import { DATA_74 as R_DATA_74 } from './reading-tests/data-74';
import { DATA_75 as R_DATA_75 } from './reading-tests/data-75';
import { DATA_76 as R_DATA_76 } from './reading-tests/data-76';
import { DATA_77 as R_DATA_77 } from './reading-tests/data-77';
import { DATA_78 as R_DATA_78 } from './reading-tests/data-78';
import { DATA_79 as R_DATA_79 } from './reading-tests/data-79';
import { DATA_80 as R_DATA_80 } from './reading-tests/data-80';
import { DATA_81 as R_DATA_81 } from './reading-tests/data-81';
import { DATA_82 as R_DATA_82 } from './reading-tests/data-82';
import { DATA_83 as R_DATA_83 } from './reading-tests/data-83';
import { DATA_84 as R_DATA_84 } from './reading-tests/data-84';
import { DATA_85 as R_DATA_85 } from './reading-tests/data-85';
import { DATA_86 as R_DATA_86 } from './reading-tests/data-86';
import { DATA_87 as R_DATA_87 } from './reading-tests/data-87';
import { DATA_88 as R_DATA_88 } from './reading-tests/data-88';
import { DATA_89 as R_DATA_89 } from './reading-tests/data-89';
import { DATA_90 as R_DATA_90 } from './reading-tests/data-90';
import { DATA_91 as R_DATA_91 } from './reading-tests/data-91';
import { DATA_92 as R_DATA_92 } from './reading-tests/data-92';
import { DATA_93 as R_DATA_93 } from './reading-tests/data-93';
import { DATA_94 as R_DATA_94 } from './reading-tests/data-94';
import { DATA_95 as R_DATA_95 } from './reading-tests/data-95';
import { DATA_96 as R_DATA_96 } from './reading-tests/data-96';
import { DATA_97 as R_DATA_97 } from './reading-tests/data-97';
import { DATA_98 as R_DATA_98 } from './reading-tests/data-98';
import { DATA_99 as R_DATA_99 } from './reading-tests/data-99';

export const READING_TESTS: ReadingTest[] = [
  ...R_DATA_01,
  ...R_DATA_02,
  ...R_DATA_03,
  ...R_DATA_04,
  ...R_DATA_05,
  ...R_DATA_06,
  ...R_DATA_07,
  ...R_DATA_08,
  ...R_DATA_09,
  ...R_DATA_10,
  ...R_DATA_11,
  ...R_DATA_12,
  ...R_DATA_13,
  ...R_DATA_14,
  ...R_DATA_15,
  ...R_DATA_16,
  ...R_DATA_17,
  ...R_DATA_18,
  ...R_DATA_19,
  ...R_DATA_20,
  ...R_DATA_21,
  ...R_DATA_22,
  ...R_DATA_23,
  ...R_DATA_24,
  ...R_DATA_25,
  ...R_DATA_26,
  ...R_DATA_27,
  ...R_DATA_28,
  ...R_DATA_29,
  ...R_DATA_30,
  ...R_DATA_31,
  ...R_DATA_32,
  ...R_DATA_33,
  ...R_DATA_34,
  ...R_DATA_35,
  ...R_DATA_36,
  ...R_DATA_37,
  ...R_DATA_38,
  ...R_DATA_39,
  ...R_DATA_40,
  ...R_DATA_41,
  ...R_DATA_42,
  ...R_DATA_43,
  ...R_DATA_44,
  ...R_DATA_45,
  ...R_DATA_46,
  ...R_DATA_47,
  ...R_DATA_48,
  ...R_DATA_49,
  ...R_DATA_50,
  ...R_DATA_51,
  ...R_DATA_52,
  ...R_DATA_53,
  ...R_DATA_54,
  ...R_DATA_55,
  ...R_DATA_56,
  ...R_DATA_57,
  ...R_DATA_58,
  ...R_DATA_59,
  ...R_DATA_60,
  ...R_DATA_61,
  ...R_DATA_62,
  ...R_DATA_63,
  ...R_DATA_64,
  ...R_DATA_65,
  ...R_DATA_66,
  ...R_DATA_67,
  ...R_DATA_68,
  ...R_DATA_69,
  ...R_DATA_70,
  ...R_DATA_71,
  ...R_DATA_72,
  ...R_DATA_73,
  ...R_DATA_74,
  ...R_DATA_75,
  ...R_DATA_76,
  ...R_DATA_77,
  ...R_DATA_78,
  ...R_DATA_79,
  ...R_DATA_80,
  ...R_DATA_81,
  ...R_DATA_82,
  ...R_DATA_83,
  ...R_DATA_84,
  ...R_DATA_85,
  ...R_DATA_86,
  ...R_DATA_87,
  ...R_DATA_88,
  ...R_DATA_89,
  ...R_DATA_90,
  ...R_DATA_91,
  ...R_DATA_92,
  ...R_DATA_93,
  ...R_DATA_94,
  ...R_DATA_95,
  ...R_DATA_96,
  ...R_DATA_97,
  ...R_DATA_98,
  ...R_DATA_99
].sort((a, b) => a.num - b.num);

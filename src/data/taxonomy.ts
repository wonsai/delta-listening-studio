import { QuestionFormatType, VocabLevelId } from '../types/assessment';

export interface DirectiveItem {
  value: string;
  en: string;
  description: string;
}

export interface SkillItem {
  value: string;
  mode: 'ib' | 'std';
  directive: string;
  stdSuffix: string; // 예: "01-01"
  description: string;
  defaultOptionLang: 'en' | 'ko'; // 기출문제 분석 기준 객관식 기본 보기 언어
  optionStyleHintEn: string;      // 영어 보기 출제 시 기출 표준 선지 형식 지침
  optionStyleHintKo: string;      // 한국어 보기 출제 시 기출 표준 선지 형식 지침
}

export interface TopicItem {
  value: string;
  description: string;
  subtopics: { value: string; description: string }[];
}

export interface SubjectInfo {
  schoolLevel: '고' | '중';
  grades: string[];
  subject: string;
  category?: string; // 예: "공통과목", "일반선택", "진로선택", "융합선택"
  codePrefix: string; // 예: "10공영1-01", "12영Ⅰ-01", "9영01"
}

export interface AchievementStandardItem {
  code: string;
  text: string;
  directive: string;
  recommendedSkillIb: string;
  recommendedSkillStd: string;
}

// 학년별 선택 가능 과목 정의 (고1: 공통영어1·2만 표시 / 고2·3: 공통영어1·2를 제외한 모든 선택과목 가능)
export const SUBJECT_OPTIONS: SubjectInfo[] = [
  // 고등학교 1학년 전용 (공통과목)
  { schoolLevel: '고', grades: ['1학년'], subject: '공통영어1', category: '공통과목', codePrefix: '10공영1-01' },
  { schoolLevel: '고', grades: ['1학년'], subject: '공통영어2', category: '공통과목', codePrefix: '10공영2-01' },

  // 고등학교 2·3학년 전용 (일반선택 · 진로선택 · 융합선택 전체)
  { schoolLevel: '고', grades: ['2학년', '3학년'], subject: '영어Ⅰ', category: '일반선택', codePrefix: '12영Ⅰ-01' },
  { schoolLevel: '고', grades: ['2학년', '3학년'], subject: '영어Ⅱ', category: '일반선택', codePrefix: '12영Ⅱ-01' },
  { schoolLevel: '고', grades: ['2학년', '3학년'], subject: '영어 독해와 작문', category: '일반선택', codePrefix: '12영독-01' },
  { schoolLevel: '고', grades: ['2학년', '3학년'], subject: '심화 영어', category: '진로선택', codePrefix: '12심영-01' },
  { schoolLevel: '고', grades: ['2학년', '3학년'], subject: '심화 영어 독해와 작문', category: '진로선택', codePrefix: '12심독-01' },
  { schoolLevel: '고', grades: ['2학년', '3학년'], subject: '영어 발표와 토론', category: '진로선택', codePrefix: '12영발-01' },
  { schoolLevel: '고', grades: ['2학년', '3학년'], subject: '직무 영어', category: '진로선택', codePrefix: '12직영-01' },
  { schoolLevel: '고', grades: ['2학년', '3학년'], subject: '실생활 영어 회화', category: '융합선택', codePrefix: '12실영-01' },
  { schoolLevel: '고', grades: ['2학년', '3학년'], subject: '미디어 영어', category: '융합선택', codePrefix: '12미영-01' },
  { schoolLevel: '고', grades: ['2학년', '3학년'], subject: '세계 문화와 영어', category: '융합선택', codePrefix: '12세영-01' },

  // 중학교
  { schoolLevel: '중', grades: ['1학년', '2학년', '3학년'], subject: '중학교 영어', category: '공통', codePrefix: '9영01' },
];

export function getSubjectsForSchoolAndGrade(
  schoolLevel: '고' | '중',
  grade: string
): SubjectInfo[] {
  const matched = SUBJECT_OPTIONS.filter(
    (s) => s.schoolLevel === schoolLevel && s.grades.includes(grade)
  );
  return matched.length > 0
    ? matched
    : SUBJECT_OPTIONS.filter((s) => s.schoolLevel === schoolLevel);
}

export const EVAL_PURPOSES = [
  '정기시험 혹은 수행평가(서술형/서답형)',
  '정기시험(선택형)',
  '정기시험(선택형 + 서답형 혼합)',
  '수행평가(듣기·과정중심 활동지)',
  '학교 자체 영어듣기능력평가(100% 객관식)',
];

// 고등학교 대구미래역량교육과정 영어 Ⅱ-5. 수행 지시어 정의 (DELTA BankSetup.gs 원본 반영)
export const DIRECTIVES: DirectiveItem[] = [
  {
    value: '파악',
    en: 'identify',
    description: '여러 가능성 중에서 하나의 답을 구하다. 다른 것과 구별되는 사실이나 특징을 인식하고 간략히 진술하다.',
  },
  {
    value: '분석',
    en: 'analyze',
    description: '말이나 글을 구성요소로 나누고 구성요소 사이의 관계나 기능을 체계적으로 검토하여 구조를 끌어내거나 의미를 밝혀내다.',
  },
  {
    value: '추론',
    en: 'infer',
    description: '겉으로 드러나지 않은 정보를 글이나 말의 단서를 통해 짐작하거나 판단하다.',
  },
  {
    value: '요약',
    en: 'summarize',
    description: '말이나 글의 핵심 내용을 짧고 간결하게 정리하다.',
  },
  {
    value: '설명',
    en: 'explain',
    description: '정보, 생각, 감정, 주장 등을 이유·방법 중심으로 체계적으로 조직하여 전달하다.',
  },
  {
    value: '조직',
    en: 'organize',
    description: '정보나 생각을 적절하거나 체계적인 순서로 만들다. 텍스트에 구조를 부여하다.',
  },
  {
    value: '묘사',
    en: 'describe',
    description: '정보, 생각, 감정, 주장 등을 세부 사항 중심으로 체계적으로 조직하여 전달하다.',
  },
  {
    value: '제시',
    en: 'present',
    description: '말이나 글, 혹은 시각적 자료를 활용해 체계적으로 조직하여 청중이나 독자에게 전달하다.',
  },
  {
    value: '상호작용',
    en: 'interact',
    description: '두 사람 이상이 의미를 주고받으며 상대방의 반응에 따라 표현을 조정하며 함께 의미를 구성하다.',
  },
  {
    value: '활용',
    en: 'use',
    description: '지식이나 기능을 새로운 상황이나 과제에 적절히 적용하여 문제를 해결하거나 의미를 구성하다.',
  },
];

// 대구형(IB·사고력 중심) 듣기 문항 유형 15종 (기출·모델 예시 분석 기반 객관식 기본 보기 언어 매핑 포함)
export const IB_SKILLS: SkillItem[] = [
  {
    value: '세부 정보 파악',
    mode: 'ib',
    directive: '파악',
    stdSuffix: '01',
    description: '말이나 글에 포함된 세부 정보(일시, 장소, 방법, 조건 등)를 파악한다.',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '담화·대화의 세부 사실 진위 여부를 판단할 수 있는 완결된 영어 평서문(또는 수치·시간 질문일 경우 숫자·단위 오름차순 표기) 5개',
    optionStyleHintKo: '담화·대화의 세부 사실과 일치/불일치 여부를 판단할 수 있는 자연스러운 우리말 평서문(수치 질문일 경우 숫자·단위 표기) 5개',
  },
  {
    value: '주제·요지 파악',
    mode: 'ib',
    directive: '파악',
    stdSuffix: '02',
    description: '말이나 글의 핵심 주제나 화자의 요지·주장을 파악한다.',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '수능·IB 주제·제목 유형 스타일의 병렬 구조 영어 명사구 또는 화자의 주장 영어 문장 5개',
    optionStyleHintKo: '화자의 의견·요지를 담은 우리말 완결 문장("~해야 한다.") 또는 핵심 주제 우리말 명사구 5개 (자료집 예시 2 표준)',
  },
  {
    value: '심정·의도 파악',
    mode: 'ib',
    directive: '추론',
    stdSuffix: '03',
    description: '말이나 글의 분위기나 화자·인물의 심정 및 궁극적 의도(목적)를 파악·추론한다.',
    defaultOptionLang: 'en',
    optionStyleHintEn: '화자의 심정·어조를 나타내는 영어 형용사(예: relieved, excited, nervous / 또는 worried → grateful 변화쌍) 또는 발화 의도를 나타내는 "To + 동사원형..." 영어 구문 5개',
    optionStyleHintKo: '화자의 심정·태도 어구 또는 발화 목적("~하려고") 우리말 선택지 5개',
  },
  {
    value: '논리적 관계 파악',
    mode: 'ib',
    directive: '추론',
    stdSuffix: '04',
    description: '말이나 글에 나타난 일이나 사건의 인과·선후·비교 등 논리적 관계를 추론한다.',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '원인·이유·인과관계를 나타내는 병렬 구조 영어 진술문("Because ...", "Due to ..." 등) 5개',
    optionStyleHintKo: '인과관계(이유·원인)를 나타내는 "~해서 / ~때문에" 어미가 통일된 우리말 선택지 5개 (자료집 예시 4 표준)',
  },
  {
    value: '함축적 의미 추론',
    mode: 'ib',
    directive: '추론',
    stdSuffix: '05',
    description: '말이나 글에 포함된 표현이나 맥락의 함축적 의미를 추론한다.',
    defaultOptionLang: 'en',
    optionStyleHintEn: '수능 21번 및 IB 기출 표준에 맞춘 화자의 특정 발언의 맥락적·함축적 의미를 풀어쓴 병렬 구조 영어 절/어구 5개',
    optionStyleHintKo: '특정 표현의 맥락상 함축적 의미를 풀어쓴 우리말 선택지 5개',
  },
  {
    value: '전개·구조 파악',
    mode: 'ib',
    directive: '파악',
    stdSuffix: '06',
    description: '말이나 글의 전개 방식이나 담화 구조를 파악한다.',
    defaultOptionLang: 'en',
    optionStyleHintEn: 'IB 기출 표준에 따라 담화 전개 흐름을 화살표(→)로 구조화한 영어 명사구 흐름 5개 (예: Problem → causes → practical solutions)',
    optionStyleHintKo: '담화의 전개 방식이나 흐름을 화살표(→) 등으로 정리한 우리말 선택지 5개',
  },
  {
    value: '이해 전략 활용',
    mode: 'ib',
    directive: '활용',
    stdSuffix: '07',
    description: '노트테이킹·핵심어 메모·예측 등 듣기 이해 전략을 적용한다.',
    defaultOptionLang: 'en',
    optionStyleHintEn: '노트테이킹 요약 메모 빈칸이나 수치·조건 계산 결과에 들어갈 영어 핵심 어구·숫자 표기 5개',
    optionStyleHintKo: '노트테이킹 메모 항목 또는 핵심 정리 우리말 선택지 5개',
  },
  {
    value: '관점·의견 분석',
    mode: 'ib',
    directive: '분석',
    stdSuffix: '08',
    description: '말이나 글에 나타난 다양한 관점이나 의견을 분석한다.',
    defaultOptionLang: 'en',
    optionStyleHintEn: '두 화자 또는 담화 내 다양한 관점·입장 차이를 분석한 병렬 구조 영어 평서문 5개',
    optionStyleHintKo: '화자 간 관점·입장 차이를 분석한 우리말 평서문 5개',
  },
  {
    value: '비판적 이해',
    mode: 'ib',
    directive: '분석',
    stdSuffix: '07',
    description: '다양한 매체의 말이나 글을 타당성·신뢰성 관점에서 비판적으로 이해한다.',
    defaultOptionLang: 'en',
    optionStyleHintEn: '담화의 논거 타당성, 사실(Fact)과 의견(Opinion) 구분, 출처 신뢰성 등을 평가하는 영어 진술문 5개',
    optionStyleHintKo: '담화의 논거 타당성·신뢰성·사실과 의견 구분을 평가하는 우리말 진술문 5개',
  },
  {
    value: '핵심 내용 요약',
    mode: 'ib',
    directive: '요약',
    stdSuffix: '02',
    description: '들은 담화·대화의 핵심 내용을 안내문·요약문 빈칸으로 간결하게 정리한다.',
    defaultOptionLang: 'en',
    optionStyleHintEn: 'stimulusBody에 (A), (B) 빈칸이 포함된 1~2문장 영어 요약 상자를 제시하고, options는 "(A) 단어 — (B) 단어" 형태의 영어 핵심어 쌍 5개로 구성',
    optionStyleHintKo: '담화·대화의 핵심 내용을 한 문장으로 압축한 우리말 요약문 5개',
  },
  {
    value: '정보 조직',
    mode: 'ib',
    directive: '조직',
    stdSuffix: '06',
    description: '들은 정보를 절차·순서·분류표에 맞게 체계적으로 조직한다.',
    defaultOptionLang: 'ko',
    optionStyleHintEn: 'stimulusBody의 분류표·절차표에 들어갈 영어 항목 또는 "(A) - (B) - (C)" 순서 영어 선택지 5개',
    optionStyleHintKo: '절차·순서·분류표에 맞게 정보를 조직한 우리말 선택지 5개',
  },
  {
    value: '듣고 설명하기',
    mode: 'ib',
    directive: '설명',
    stdSuffix: '04',
    description: '들은 내용의 이유·원인·방법을 우리말 또는 영어로 구체적으로 설명한다.',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '이유·원인·방법을 구체적으로 설명하는 병렬 구조 영어 문장 5개',
    optionStyleHintKo: '이유·원인·방법을 구체적으로 설명하는 우리말 문장 5개',
  },
  {
    value: '듣고 응답하기',
    mode: 'ib',
    directive: '상호작용',
    stdSuffix: '05',
    description: '화자의 마지막 질문이나 요청에 맥락에 맞는 응답을 작성한다.',
    defaultOptionLang: 'en',
    optionStyleHintEn: '대화 마지막 발화 직후 이어질 상대방의 자연스러운 구어체 영어 응답 문장 5개 (대본은 반드시 응답 직전 상대방의 말에서 종료)',
    optionStyleHintKo: '대화 마지막 말에 이어질 자연스러운 우리말 응답 5개',
  },
  {
    value: '듣고 묘사하기',
    mode: 'ib',
    directive: '묘사',
    stdSuffix: '01',
    description: '들은 대상(사물·인물·행사)의 세부 특징을 중심으로 묘사한다.',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '대상의 외형·특징·세부 상태를 묘사한 영어 어구/문장 5개',
    optionStyleHintKo: '대상의 세부 특징을 정확히 묘사한 우리말 선택지 5개',
  },
  {
    value: '듣고 제시하기',
    mode: 'ib',
    directive: '제시',
    stdSuffix: '02',
    description: '들은 정보를 재구성하여 제3자에게 전달할 안내문 형태로 제시한다.',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '들은 정보를 바탕으로 제3자에게 전달할 영어 안내·권고 문장 5개',
    optionStyleHintKo: '들은 정보를 재구성하여 전달할 우리말 안내 선택지 5개',
  },
];

// 기존 영어듣기 유형(전국 시도교육청 공동 주관 / 수능형 100% 5지선다) 15종 (기출문제 전수 분석 기반 기본 보기 언어 적용)
export const STD_SKILLS: SkillItem[] = [
  {
    value: '목적',
    mode: 'std',
    directive: '파악',
    stdSuffix: '03',
    description: '담화를 듣고 화자가 말하려는 목적 고르기',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '"To announce ...", "To request ...", "To promote ..." 등 To부정사구 병렬 구조 영어 선택지 5개',
    optionStyleHintKo: '"~을 안내하려고", "~을 요청하려고", "~을 홍보하려고" 등 "~하려고" 어미로 통일된 기출 표준 우리말 선택지 5개',
  },
  {
    value: '의견',
    mode: 'std',
    directive: '파악',
    stdSuffix: '02',
    description: '대화를 듣고 남/여의 의견·주장으로 가장 적절한 것 고르기',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '화자의 주장을 담은 완결된 영어 평서문 5개 (예: Students should ..., Regular exercise helps ...)',
    optionStyleHintKo: '"~해야 한다.", "~하는 것이 필요하다." 등 당위·주장형 어미로 통일된 기출 표준 우리말 완결 문장 5개',
  },
  {
    value: '관계',
    mode: 'std',
    directive: '추론',
    stdSuffix: '05',
    description: '대화를 듣고 두 사람의 관계를 추론하여 고르기',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '"doctor – patient", "librarian – student" 등 영어 직업·역할 대칭 명사쌍 5개',
    optionStyleHintKo: '"의사 – 환자", "도서관 사서 – 학생" 등 두 사람의 관계를 "A – B" 형태로 제시한 기출 표준 우리말 명사쌍 5개',
  },
  {
    value: '할일',
    mode: 'std',
    directive: '파악',
    stdSuffix: '01',
    description: '대화 직후 남/여가 할 일 또는 부탁한 일 고르기',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '"print out the handouts", "check the sound system" 등 동사원형구 병렬 영어 선택지 5개',
    optionStyleHintKo: '"발표 자료 인쇄하기", "강당 좌석 확인하기" 등 "~하기" 명사형으로 통일된 기출 표준 우리말 선택지 5개',
  },
  {
    value: '이유',
    mode: 'std',
    directive: '추론',
    stdSuffix: '04',
    description: '특정 행동을 하거나 하지 못하는 이유(인과관계) 고르기',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '"Because ..." 또는 "To + 동사원형 ..." 등 이유를 나타내는 병렬 구조 영어 선택지 5개',
    optionStyleHintKo: '"~해야 해서", "~이 고장 나서" 등 인과 어미("~해서/~때문에")로 통일된 기출 표준 우리말 선택지 5개',
  },
  {
    value: '숫자',
    mode: 'std',
    directive: '파악',
    stdSuffix: '01',
    description: '지불할 금액, 시각, 수량 등 수치·할인 계산 정보 파악하기',
    defaultOptionLang: 'en',
    optionStyleHintEn: '지불 금액·시각·수량 등 숫자·통화기호·단위 표기 5개를 작은 값부터 오름차순으로 배열 (예: $18, $24, $27, $30, $36 또는 2:00 p.m., 2:30 p.m. 등 — 긴 문장 금지)',
    optionStyleHintKo: '금액·시각·수량 숫자 표기 5개를 오름차순으로 배열 (예: 15,000원, 18,000원, 20,000원 또는 $18~$36)',
  },
  {
    value: '언급안됨',
    mode: 'std',
    directive: '파악',
    stdSuffix: '01',
    description: '행사·프로그램 등에 관해 언급되지 않은 세부 항목 고르기',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '"registration fee", "event date", "location", "prize", "schedule" 등 간결한 영어 명사구 항목 5개',
    optionStyleHintKo: '"개최 일시", "장소", "참가비", "신청 방법", "기념품" 등 간결한 기출 표준 우리말 명사구 항목 5개',
  },
  {
    value: '내용일치',
    mode: 'std',
    directive: '파악',
    stdSuffix: '01',
    description: '담화·안내 방송의 내용과 일치하거나 일치하지 않는 것 고르기',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '담화·안내 방송의 세부 사실과 일치/불일치 여부를 판단할 수 있는 완결된 영어 평서문 5개',
    optionStyleHintKo: '담화·안내 방송의 세부 사실과 일치/불일치 여부를 판단할 수 있는 기출 표준 우리말 평서문("~한다/~이다") 5개',
  },
  {
    value: '주제',
    mode: 'std',
    directive: '파악',
    stdSuffix: '02',
    description: '강연·담화의 주제나 화제로 가장 적절한 것 고르기',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '수능·내신 주제 유형 스타일의 병렬 구조 영어 명사구 5개 (예: ways to prevent ..., benefits of ...)',
    optionStyleHintKo: '담화·강연의 중심 주제를 압축한 기출 표준 우리말 명사구 5개',
  },
  {
    value: '응답',
    mode: 'std',
    directive: '추론',
    stdSuffix: '05',
    description: '대화의 마지막 말에 대한 상대방의 가장 적절한 응답 고르기',
    defaultOptionLang: 'en',
    optionStyleHintEn: '전국 영어듣기능력평가 기출 표준에 따라 대화 마지막 말에 이어질 상대방의 자연스러운 영어 구어체 응답 문장 5개 (대본은 반드시 응답 직전 상대방의 말에서 끝나야 함)',
    optionStyleHintKo: '대화 마지막 말에 이어질 상대방의 자연스러운 우리말 응답 문장 5개',
  },
  {
    value: '심정',
    mode: 'std',
    directive: '추론',
    stdSuffix: '03',
    description: '화자의 심정이나 태도 변화로 가장 적절한 것 고르기',
    defaultOptionLang: 'en',
    optionStyleHintEn: '전국 영어듣기능력평가·수능 기출 표준에 따라 영어 감정·태도 형용사 단일어 5개(예: relieved, excited, nervous, disappointed, bored) 또는 심경 변화 쌍 5개(예: worried → relieved)',
    optionStyleHintKo: '화자의 심정이나 심경 변화를 나타내는 우리말 어구 5개',
  },
  {
    value: '장소',
    mode: 'std',
    directive: '추론',
    stdSuffix: '05',
    description: '대화가 이루어지고 있는 장소·상황 추론하기',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '"post office", "veterinary clinic", "airport check-in counter" 등 영어 장소 명사구 5개',
    optionStyleHintKo: '"우체국", "동물병원", "도서관 대출 창구" 등 간결한 기출 표준 우리말 장소 명사구 5개',
  },
  {
    value: '도표',
    mode: 'std',
    directive: '파악',
    stdSuffix: '01',
    description: '표·조건표(가격, 시간, 옵션 등)를 보며 조건에 맞는 항목 고르기',
    defaultOptionLang: 'en',
    optionStyleHintEn: '기출 도표 유형 표준에 따라 stimulusTitle·stimulusBody에 (A)~(E) 5개 후보 모델과 4개 조건 열(Price, Time, Feature 등)을 갖춘 영문 표를 작성하고, options는 ["(A)", "(B)", "(C)", "(D)", "(E)"]로 구성',
    optionStyleHintKo: 'stimulusTitle·stimulusBody에 조건표를 제시하고 5개 항목 선택지로 구성',
  },
  {
    value: '상황',
    mode: 'std',
    directive: '추론',
    stdSuffix: '05',
    description: '상황 설명을 듣고 화자가 상대방에게 할 말로 가장 적절한 것 고르기',
    defaultOptionLang: 'en',
    optionStyleHintEn: '전국 영어듣기능력평가 상황 설명 기출 표준에 따라 단독 화자가 상황을 영어로 설명한 뒤 "In this situation, what would [인물 A] most likely say to [인물 B]?"로 대본을 끝맺고, options는 인물 A가 할 자연스러운 영어 발화 문장 5개로 구성',
    optionStyleHintKo: '상황 설명 후 화자가 상대방에게 할 적절한 우리말 발화 문장 5개',
  },
  {
    value: '복합(주제+언급안됨)',
    mode: 'std',
    directive: '파악',
    stdSuffix: '02',
    description: '긴 강연 담화를 듣고 주제 및 언급되지 않은 것 파악하기',
    defaultOptionLang: 'ko',
    optionStyleHintEn: '강연의 핵심 주제 영어 명사구 또는 언급되지 않은 세부 항목 영어 명사구 5개',
    optionStyleHintKo: '강연의 핵심 주제 우리말 명사구 또는 언급되지 않은 세부 항목 우리말 명사구 5개',
  },
];

export function getDefaultEnglishOptionSkills(mode?: 'ib' | 'std'): string[] {
  const pool =
    mode === 'ib'
      ? IB_SKILLS
      : mode === 'std'
      ? STD_SKILLS
      : [...IB_SKILLS, ...STD_SKILLS];
  return pool.filter((s) => s.defaultOptionLang === 'en').map((s) => s.value);
}

// 과목별 성취기준 생성 헬퍼 (대구미래역량교육과정 및 2022 개정 영어과 교육과정 완벽 매핑)
export function getAchievementStandardsForSubject(subjectName: string): AchievementStandardItem[] {
  if (subjectName === '공통영어1') {
    return [
      { code: '[10공영1-01-01]', text: '[10공영1-01-01] 말이나 글에 포함된 세부 정보를 파악한다.', directive: '파악', recommendedSkillIb: '세부 정보 파악', recommendedSkillStd: '내용일치' },
      { code: '[10공영1-01-02]', text: '[10공영1-01-02] 말이나 글의 주제나 요지를 파악한다.', directive: '파악', recommendedSkillIb: '주제·요지 파악', recommendedSkillStd: '의견' },
      { code: '[10공영1-01-03]', text: '[10공영1-01-03] 말이나 글의 분위기나 화자나 인물의 심정 및 의도를 파악한다.', directive: '파악', recommendedSkillIb: '심정·의도 파악', recommendedSkillStd: '목적' },
      { code: '[10공영1-01-04]', text: '[10공영1-01-04] 말이나 글에 나타난 일이나 사건의 논리적 관계를 파악한다.', directive: '파악', recommendedSkillIb: '논리적 관계 파악', recommendedSkillStd: '이유' },
      { code: '[10공영1-01-05]', text: '[10공영1-01-05] 말이나 글에 포함된 표현의 함축적 의미를 추론한다.', directive: '추론', recommendedSkillIb: '함축적 의미 추론', recommendedSkillStd: '응답' },
      { code: '[10공영1-01-06]', text: '[10공영1-01-06] 말이나 글의 전개 방식이나 구조를 파악한다.', directive: '파악', recommendedSkillIb: '전개·구조 파악', recommendedSkillStd: '도표' },
      { code: '[10공영1-01-07]', text: '[10공영1-01-07] 말이나 글의 이해를 위한 적절한 전략을 적용한다.', directive: '활용', recommendedSkillIb: '이해 전략 활용', recommendedSkillStd: '숫자' },
      { code: '[10공영1-01-08]', text: '[10공영1-01-08] 말이나 글에 나타난 다양한 관점이나 의견을 포용적인 태도로 분석한다.', directive: '분석', recommendedSkillIb: '관점·의견 분석', recommendedSkillStd: '의견' },
    ];
  }
  if (subjectName === '공통영어2') {
    return [
      { code: '[10공영2-01-01]', text: '[10공영2-01-01] 말이나 글에 포함된 세부 정보를 파악한다.', directive: '파악', recommendedSkillIb: '세부 정보 파악', recommendedSkillStd: '언급안됨' },
      { code: '[10공영2-01-02]', text: '[10공영2-01-02] 말이나 글의 주제나 요지를 파악한다.', directive: '파악', recommendedSkillIb: '주제·요지 파악', recommendedSkillStd: '의견' },
      { code: '[10공영2-01-03]', text: '[10공영2-01-03] 말이나 글의 분위기나 화자나 인물의 심정 및 의도를 파악한다.', directive: '파악', recommendedSkillIb: '심정·의도 파악', recommendedSkillStd: '심정' },
      { code: '[10공영2-01-04]', text: '[10공영2-01-04] 말이나 글에 나타난 일이나 사건의 논리적 관계를 파악한다.', directive: '파악', recommendedSkillIb: '논리적 관계 파악', recommendedSkillStd: '이유' },
      { code: '[10공영2-01-05]', text: '[10공영2-01-05] 말이나 글에 포함된 표현의 함축적 의미를 추론한다.', directive: '추론', recommendedSkillIb: '함축적 의미 추론', recommendedSkillStd: '상황' },
      { code: '[10공영2-01-06]', text: '[10공영2-01-06] 말이나 글의 전개 방식이나 구조를 파악한다.', directive: '파악', recommendedSkillIb: '전개·구조 파악', recommendedSkillStd: '도표' },
      { code: '[10공영2-01-07]', text: '[10공영2-01-07] 다양한 매체의 말이나 글을 비판적으로 이해한다.', directive: '분석', recommendedSkillIb: '비판적 이해', recommendedSkillStd: '내용일치' },
    ];
  }
  if (subjectName === '영어Ⅰ') {
    return [
      { code: '[12영Ⅰ-01-01]', text: '[12영Ⅰ-01-01] 말이나 글에 포함된 세부 정보를 파악한다.', directive: '파악', recommendedSkillIb: '세부 정보 파악', recommendedSkillStd: '내용일치' },
      { code: '[12영Ⅰ-01-02]', text: '[12영Ⅰ-01-02] 말이나 글의 주제나 요지를 파악한다.', directive: '파악', recommendedSkillIb: '주제·요지 파악', recommendedSkillStd: '주제' },
      { code: '[12영Ⅰ-01-03]', text: '[12영Ⅰ-01-03] 화자나 필자의 심정이나 의도를 추론한다.', directive: '추론', recommendedSkillIb: '심정·의도 파악', recommendedSkillStd: '목적' },
      { code: '[12영Ⅰ-01-04]', text: '[12영Ⅰ-01-04] 말이나 글에서 일이나 사건의 논리적 관계를 추론한다.', directive: '추론', recommendedSkillIb: '논리적 관계 파악', recommendedSkillStd: '이유' },
      { code: '[12영Ⅰ-01-05]', text: '[12영Ⅰ-01-05] 말이나 글의 함축적 의미를 추론한다.', directive: '추론', recommendedSkillIb: '함축적 의미 추론', recommendedSkillStd: '응답' },
      { code: '[12영Ⅰ-01-06]', text: '[12영Ⅰ-01-06] 다양한 관점의 말이나 글을 비판적으로 이해한다.', directive: '분석', recommendedSkillIb: '관점·의견 분석', recommendedSkillStd: '의견' },
    ];
  }
  if (subjectName === '영어Ⅱ') {
    return [
      { code: '[12영Ⅱ-01-01]', text: '[12영Ⅱ-01-01] 말이나 글에 포함된 세부 정보를 파악한다.', directive: '파악', recommendedSkillIb: '세부 정보 파악', recommendedSkillStd: '언급안됨' },
      { code: '[12영Ⅱ-01-02]', text: '[12영Ⅱ-01-02] 말이나 글의 주제나 요지를 추론한다.', directive: '추론', recommendedSkillIb: '주제·요지 파악', recommendedSkillStd: '주제' },
      { code: '[12영Ⅱ-01-03]', text: '[12영Ⅱ-01-03] 화자나 필자의 심정, 태도, 의도를 추론한다.', directive: '추론', recommendedSkillIb: '심정·의도 파악', recommendedSkillStd: '목적' },
      { code: '[12영Ⅱ-01-04]', text: '[12영Ⅱ-01-04] 말이나 글에서 일이나 사건의 논리적 관계를 추론한다.', directive: '추론', recommendedSkillIb: '논리적 관계 파악', recommendedSkillStd: '이유' },
      { code: '[12영Ⅱ-01-05]', text: '[12영Ⅱ-01-05] 말이나 글의 맥락을 통해 함축적 의미를 추론한다.', directive: '추론', recommendedSkillIb: '함축적 의미 추론', recommendedSkillStd: '상황' },
      { code: '[12영Ⅱ-01-06]', text: '[12영Ⅱ-01-06] 다양한 매체와 주제의 말이나 글을 분석하고 비판적으로 평가한다.', directive: '분석', recommendedSkillIb: '비판적 이해', recommendedSkillStd: '의견' },
    ];
  }
  if (subjectName === '중학교 영어') {
    return [
      { code: '[9영01-01]', text: '[9영01-01] 어구와 문장을 듣고 연음이나 축약된 소리를 식별한다.', directive: '파악', recommendedSkillIb: '세부 정보 파악', recommendedSkillStd: '할일' },
      { code: '[9영01-02]', text: '[9영01-02] 일상생활 관련 대상이나 친숙한 일반적 주제에 관한 말이나 대화를 듣고 세부 정보를 파악한다.', directive: '파악', recommendedSkillIb: '세부 정보 파악', recommendedSkillStd: '숫자' },
      { code: '[9영01-03]', text: '[9영01-03] 친숙한 일반적 주제에 관한 말이나 대화를 듣고 줄거리, 주제, 요지를 파악한다.', directive: '파악', recommendedSkillIb: '주제·요지 파악', recommendedSkillStd: '의견' },
      { code: '[9영01-04]', text: '[9영01-04] 일상생활이나 친숙한 주제에 관한 말이나 대화를 듣고 화자의 심정이나 태도를 추론한다.', directive: '추론', recommendedSkillIb: '심정·의도 파악', recommendedSkillStd: '심정' },
      { code: '[9영01-05]', text: '[9영01-05] 일상생활이나 친숙한 주제에 관한 말이나 대화를 듣고 일이나 사건의 순서, 전후 관계, 원인과 결과를 추론한다.', directive: '추론', recommendedSkillIb: '논리적 관계 파악', recommendedSkillStd: '이유' },
      { code: '[9영01-06]', text: '[9영01-06] 일상생활이나 친숙한 주제에 관한 말이나 대화를 듣고 화자의 의도나 말의 목적을 추론한다.', directive: '추론', recommendedSkillIb: '심정·의도 파악', recommendedSkillStd: '목적' },
    ];
  }
  const subjMeta = SUBJECT_OPTIONS.find((s) => s.subject === subjectName);
  const prefix = subjMeta?.codePrefix || '12선택-01';
  return [
    { code: `[${prefix}-01]`, text: `[${prefix}-01] 다양한 주제의 담화나 대화를 듣고 세부 정보를 파악한다.`, directive: '파악', recommendedSkillIb: '세부 정보 파악', recommendedSkillStd: '내용일치' },
    { code: `[${prefix}-02]`, text: `[${prefix}-02] 다양한 주제의 담화나 대화를 듣고 중심 내용과 요지를 파악한다.`, directive: '파악', recommendedSkillIb: '주제·요지 파악', recommendedSkillStd: '주제' },
    { code: `[${prefix}-03]`, text: `[${prefix}-03] 담화나 대화를 듣고 화자의 심정, 태도 및 의도를 추론한다.`, directive: '추론', recommendedSkillIb: '심정·의도 파악', recommendedSkillStd: '목적' },
    { code: `[${prefix}-04]`, text: `[${prefix}-04] 담화나 대화에 나타난 일이나 사건의 논리적 관계를 추론한다.`, directive: '추론', recommendedSkillIb: '논리적 관계 파악', recommendedSkillStd: '이유' },
    { code: `[${prefix}-05]`, text: `[${prefix}-05] 담화나 대화의 맥락을 바탕으로 함축적 의미를 추론하고 핵심 내용을 요약한다.`, directive: '요약', recommendedSkillIb: '핵심 내용 요약', recommendedSkillStd: '응답' },
    { code: `[${prefix}-06]`, text: `[${prefix}-06] 다양한 매체와 관점의 담화·대화를 분석하고 비판적으로 이해한다.`, directive: '분석', recommendedSkillIb: '관점·의견 분석', recommendedSkillStd: '의견' },
  ];
}

// [별표 1] 소재 9대 범주 및 35개 소범주 (대구미래역량교육과정 원문)
export const TOPICS: TopicItem[] = [
  {
    value: '학교생활',
    description: '학교 행사, 동아리, 수행평가, 교우 관계, 진로·진학 등 학교 일상',
    subtopics: [
      { value: '학교 활동', description: '교내 특강, 축제, 동아리, 학사 일정 및 학교 행사' },
      { value: '교우 관계', description: '친구 간 협력, 조별 과제, 학교생활 소통' },
      { value: '진로·진학', description: '멘토링, 진로 탐색, 대학·직업 체험' },
    ],
  },
  {
    value: '개인생활',
    description: '취미·여행·운동·쇼핑 등 여가 선용, 개인 건강 관리, 개인 일상',
    subtopics: [
      { value: '여가 선용', description: '취미, 오락, 여행, 운동, 쇼핑 등 여가 활동' },
      { value: '건강 관리', description: '보건, 위생, 수면, 영양, 운동 습관' },
      { value: '개인 일상', description: '일정 관리, 관심사, 생활 습관' },
    ],
  },
  {
    value: '사회생활',
    description: '봉사·근로·직업 윤리, 온·오프라인 대인 관계, 지역사회 행사',
    subtopics: [
      { value: '대인 관계', description: '음성 메시지, 소셜 미디어 소통, 약속 조정' },
      { value: '사회적 행사', description: '지역 도서관·박물관 프로그램, 지역 축제, 캠페인' },
      { value: '근로', description: '아르바이트, 인턴십, 직업 윤리' },
    ],
  },
  {
    value: '생태전환',
    description: '기후변화와 생태계 문제, 친환경 실천, 다회용기·자원 순환',
    subtopics: [
      { value: '생태전환 실천', description: '다회용 컵 공유, 플라스틱 감축, 업사이클링, 에너지 절약' },
      { value: '기후변화·생태계 문제', description: '탄소 발자국, 기후 위기, 생물 다양성 보전' },
      { value: '생태계와 인간', description: '자연환경과 생태 윤리, 지속가능 발전' },
    ],
  },
  {
    value: '디지털·인공지능',
    description: 'AI·디지털 기술 활용, 온라인 협업, 디지털 안전 및 미디어 윤리',
    subtopics: [
      { value: '디지털 기술 활용', description: '생성형 AI, 스마트 학습 도구, 앱 활용' },
      { value: '디지털 안전·윤리', description: '알고리즘 편향, 개인정보 보호, 딥페이크·저작권 윤리' },
      { value: '디지털 의사소통·협력', description: '온라인 플랫폼 협업 및 정보 공유' },
      { value: '정보 처리·생성', description: '데이터 분석, 디지털 콘텐츠 제작' },
    ],
  },
  {
    value: '민주시민',
    description: '봉사·배려·책임감, 미디어 리터러시, 합리적 소비 및 사회 현안',
    subtopics: [
      { value: '사회 현안', description: '합리적 소비, 행동경제학(희소성 효과), 청소년·인구 현안' },
      { value: '인성', description: '지역사회 봉사, 공중도덕, 배려와 협력' },
      { value: '미디어 리터러시·비판적 사고', description: '광고·뉴스 비평, 팩트체크, 민주적 의사 결정' },
      { value: '민주시민·세계시민 의식', description: '인권, 글로벌 에티켓, 공정 무역' },
      { value: '공동체 참여', description: '학생 자치, 지역 공동체 문제 해결' },
    ],
  },
  {
    value: '가정생활',
    description: '의복·명절·음식·주거, 가족 행사 및 가사 분담',
    subtopics: [
      { value: '가정 일상', description: '가족 행사 준비, 집안일 분담, 주말 계획' },
      { value: '의식주', description: '요리, 식습관, 주거 환경 정리' },
    ],
  },
  {
    value: '문화',
    description: '우리 문화 소개, 세대·문화권 간 관습 차이, 예술·스포츠 교류',
    subtopics: [
      { value: '우리 문화 소개', description: '한식, 전통문화, K-컬처 체험 안내' },
      { value: '문화권의 관습·가치', description: '세계 각국의 생활 양식과 의사소통 예절' },
      { value: '세계 문화의 일상', description: '세계 축제, 예술, 건축, 여행지' },
      { value: '세대·성별 문화 차이', description: '세대 간 소통과 공감' },
      { value: '언어·문화 차이', description: '비언어적 표현 및 문화적 맥락 차이' },
      { value: '문화 간 교류·협력', description: '국제 교류 프로그램, 교환학생 활동' },
    ],
  },
  {
    value: '일반교양',
    description: '안전 교육, 자연·과학 원리, 경제·심리·인문·예술 교양',
    subtopics: [
      { value: '교양 지식', description: '행동경제학, 심리 효과, 생활 과학, 우주·해양' },
      { value: '안전', description: '생활 안전, 실험실·재난·교통 안전 수칙' },
      { value: '학문적 소양', description: '인문학, 사회 과학, 자연 과학 강연' },
      { value: '자연 현상', description: '동식물 생태, 계절과 기상 현상' },
      { value: '언어·문학·예술', description: '전시회, 음악회, 창작 활동' },
      { value: '애국·평화·통일', description: '역사 유산 보존 및 평화 교육' },
    ],
  },
];

// 문항 형식 옵션 (대구형 vs 기존형)
export interface QuestionFormatMeta {
  id: QuestionFormatType;
  label: string;
  shortBadge: string;
  isConstructed: boolean;
  description: string;
  pdfRef: string;
}

export const QUESTION_FORMATS: QuestionFormatMeta[] = [
  {
    id: 'gap_poster',
    label: '서답형 · 안내문/포스터 빈칸 완성형',
    shortBadge: '포스터 빈칸(영어)',
    isConstructed: true,
    description: '안내 방송·담화를 듣고 포스터/공지문의 빈칸 (1)~(3)에 핵심 영어 어구를 작성 (노트테이킹·세부정보)',
    pdfRef: '업로드 자료집 예시 1 모델',
  },
  {
    id: 'short_kr',
    label: '서답형 · 우리말 의도/이유/핵심 서술형',
    shortBadge: '우리말 서술형',
    isConstructed: true,
    description: '음성 메시지·대화를 듣고 화자의 구체적 의도(요청 사항)와 이유·근거를 우리말로 서술',
    pdfRef: '업로드 자료집 예시 3 모델',
  },
  {
    id: 'short_en',
    label: '서답형 · 영어 단답/핵심 요약형',
    shortBadge: '영어 단답·요약',
    isConstructed: true,
    description: '들은 내용을 바탕으로 질문에 대한 핵심 답안이나 요약 문장을 영어로 작성',
    pdfRef: '대구형 IB 단답 모델',
  },
  {
    id: 'tf_justify',
    label: '서답형 · 진위(T/F) 판별 및 근거 서술형',
    shortBadge: 'T/F + 근거(IB)',
    isConstructed: true,
    description: '진술문의 참/거짓 여부를 판별하고 담화 속 근거를 함께 작성하는 IB형 문항',
    pdfRef: '대구형 IB 추론 모델',
  },
  {
    id: 'mcq_5',
    label: '선택형 · 5지선다 객관식 (①~⑤)',
    shortBadge: '5지선다 선택형',
    isConstructed: false,
    description: '요지·의견·인과관계 추론·세부정보 등 5개 선택지 중 정답을 고르는 객관식 문항',
    pdfRef: '업로드 자료집 예시 2·4 / 기존형',
  },
];

// 어휘 수준 정의
export interface VocabLevelMeta {
  id: VocabLevelId;
  label: string;
  shortLabel: string;
  wordPoolDesc: string;
  cefr: string;
  promptGuide: string;
}

export const VOCAB_LEVELS: VocabLevelMeta[] = [
  {
    id: 'mid_basic',
    label: '중학교 기본 어휘 수준 (교육과정 기본 1,200~1,500단어)',
    shortLabel: '중학교 기본 (CEFR A2)',
    wordPoolDesc: '1,200~1,500단어 내외',
    cefr: 'CEFR A2',
    promptGuide: '2022 개정 교육과정 중학교 기본 어휘(약 1,200~1,500단어, CEFR A2) 범위 내의 친숙하고 평이한 어휘와 짧은 문장 구조를 사용하세요.',
  },
  {
    id: 'high1_common',
    label: '고1 공통영어 수준 (교육과정 1,800~2,000단어)',
    shortLabel: '고1 공통영어 (CEFR B1)',
    wordPoolDesc: '1,800~2,000단어 내외',
    cefr: 'CEFR B1',
    promptGuide: '고등학교 공통영어1·2 수준(교육과정 약 1,800~2,000단어, CEFR B1)의 자연스러운 구어체 어휘를 사용하고 지나치게 현학적인 전문용어는 피하세요.',
  },
  {
    id: 'high2_general',
    label: '고2 일반선택(영어Ⅰ·Ⅱ) 수준 (2,300~2,500단어)',
    shortLabel: '고2 영어Ⅰ·Ⅱ (CEFR B1+~B2)',
    wordPoolDesc: '2,300~2,500단어 내외',
    cefr: 'CEFR B1+~B2',
    promptGuide: '고등학교 2학년 영어Ⅰ·Ⅱ 수준(약 2,300~2,500단어, CEFR B1+~B2)의 어휘와 논리적 연결어, 교양·사회 소재 어휘를 적절히 포함하세요.',
  },
  {
    id: 'high3_advanced',
    label: '고3 심화·수능 영어듣기 수준 (3,000단어 내외)',
    shortLabel: '고3 심화·수능 (CEFR B2)',
    wordPoolDesc: '3,000단어 내외',
    cefr: 'CEFR B2',
    promptGuide: '고3 심화 영어 및 대학수학능력시험 영어듣기 수준(약 3,000단어 내외, CEFR B2)의 학술·교양 어휘와 패러프레이징(재진술)을 적극 활용하세요.',
  },
];

// 담화·대화 텍스트 유형
export const TEXT_TYPES = [
  { id: '대화문', label: '대화문 (남·여 2인 대화)', desc: '학생 간, 교사-학생, 일상·학교 상황 대화' },
  { id: '담화문(안내 방송)', label: '담화문 (안내 방송·공지)', desc: '교내 방송, 행사·시설 이용 안내' },
  { id: '담화문(음성 메시지)', label: '담화문 (음성 메시지·전화)', desc: '일정 변경 요청, 문의, 용건 전달 메시지' },
  { id: '담화문(강연·발표)', label: '담화문 (수업·특강·발표)', desc: '과학·심리·환경·문화 주제 미니 특강 및 학생 발표' },
  { id: '인터뷰', label: '인터뷰 (대담)', desc: '전문가·동아리 부장·졸업생 인터뷰 대화' },
  { id: '토론·의견 교환', label: '토론 · 의견 교환', desc: '교내 정책·환경·디지털 이슈에 대한 두 관점 비교' },
];

// [별표 2] 주요 의사소통 기능 대표 항목 (DELTA 91항목 중 듣기 출제 빈출 핵심 태그 + 전체 지원)
export const EXPRESSION_GROUPS: { group: string; items: string[] }[] = [
  {
    group: 'Ⅰ. 정보 전달·요구',
    items: [
      '개인 정보 제공하기',
      '시간 말하기',
      '장소 묘사하기',
      '사물 묘사하기',
      '습관과 일과 묘사하기',
      '경험이나 사건 묘사하기',
      '수정하기',
      '질문하고 답하기',
      '(정체) 확인하기와 상술하기',
    ],
  },
  {
    group: 'Ⅱ. 태도·의견·설득',
    items: [
      '제안·권유하기',
      '도움 제안이나 요청하기',
      '(도움) 제안·권유·요청에 답하기',
      '의견 묻거나 표현하기',
      '동의하기',
      '이의 제기하거나 부인하기',
      '의도 표현하기',
      '의무 표현하기',
      '가능성 정도 표현하기',
      '선호 표현하기',
      '만족이나 불만족 표현하기',
      '유감이나 동정 표현하기',
      '걱정·두려움 표현하기',
      '충고하거나 구하기',
      '허락 요청하고 답하기',
      '행동이나 방향 지시하기',
      '경고하기',
    ],
  },
  {
    group: 'Ⅲ. 사교 및 담화 구성',
    items: [
      '주의 끌기',
      '주제 소개하기',
      '예시 들기',
      '강조하기',
      '정의하기',
      '요약하기',
      '사과하고 수용하기',
      '감사 표현하고 답하기',
      '축하·칭찬하기',
      '격려하기',
      '확인 요청하기',
      '설명 요청하기',
    ],
  },
];

// [별표 4] 의사소통에 필요한 언어 형식 40범주 (DELTA 원본 40개 중 핵심 구문 라벨)
export const STRUCTURE_ITEMS: { id: string; ko: string; example: string }[] = [
  { id: 'To-Infinitive', ko: 'to부정사', example: 'sign up to join / decided to move' },
  { id: 'Gerunds', ko: '동명사', example: 'find it annoying to carry / instead of canceling' },
  { id: 'Passive Voice', ko: '수동태', example: 'was scheduled to take place / were moved to' },
  { id: 'Relative Clauses', ko: '관계절 (관계대명사·부사)', example: 'Mina Park, who is scheduled for next Saturday' },
  { id: 'Postmodification', ko: '분사 후치 수식', example: 'graduates working in IT / a message saying...' },
  { id: 'Real Conditionals', ko: '조건문 (if / unless / in case)', example: 'If students can borrow a clean cup, everyone will...' },
  { id: 'Unreal Conditionals', ko: '가정법', example: 'If I had known earlier, I would have...' },
  { id: 'Subordinating Conjunctions', ko: '종속접속사 (since, although, while)', example: 'since so many students showed interest' },
  { id: 'Perfectives', ko: '완료형 (현재·과거완료)', example: 'nothing has changed / have been waiting' },
  { id: 'Modals', ko: '조동사 (should, must, would, might)', example: 'our snack bar should introduce...' },
  { id: 'Causative Verbs / Sensory Perception Verbs', ko: '사역·지각동사', example: 'made me buy / saw people lining up' },
  { id: 'Comparatives', ko: '비교급 강조', example: 'much more convenient than bringing tumblers' },
  { id: 'Superlatives', ko: '최상급', example: 'the most effective way to reduce waste' },
  { id: 'Anticipatory It', ko: '가주어·가목적어 it', example: 'would it be possible to switch... / find it annoying to...' },
  { id: 'Adverbial Participles', ko: '분사구문', example: 'Looking at the poster, I realized...' },
  { id: 'Reports of Questions and Commands', ko: '간접의문문·명령 전달', example: 'how does that work / asked us to submit' },
  { id: 'Focus / Emphasis', ko: '강조 구문 (It-분열문, 강조 do)', example: 'It was convenience that made the difference.' },
  { id: 'Appositives', ko: '동격 절·구', example: 'the idea that students can share cups' },
];

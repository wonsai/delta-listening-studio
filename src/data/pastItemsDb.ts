import {
  AssessmentMode,
  DifficultyLevel,
  QuestionFormatType,
  VocabLevelId,
} from '../types/assessment';

/**
 * 기출문항 레퍼런스 DB 스키마
 * - 시도교육청 영어듣기능력평가, 수능/모의평가, 대구형(IB) 우수 문항 등을
 *   구조화하여 저장하고, AI 출제 시 동적 Few-shot(스타일·어휘·발문 레퍼런스)으로 활용합니다.
 * - 소재·내용을 복제하지 않고 자연스러운 구어체, 발문 형식, 오답 설계, 적정 난이도 감각을 학습시키는 용도입니다.
 */
export interface PastExamReference {
  id: string;
  source: string;              // 예: "2025년 제2회 고1 영어듣기능력평가 3번"
  year?: number;
  mode: AssessmentMode;
  schoolLevel: '고' | '중';
  grade?: string;
  questionFormat: QuestionFormatType;
  skill: string;               // 예: "목적", "의견", "세부 정보 파악", "응답"
  textType: string;            // 예: "대화문", "담화문(안내 방송)"
  difficulty: DifficultyLevel;
  vocabLevelId: VocabLevelId;
  transcript: string;
  questionPrompt: string;
  stimulusTitle?: string;
  stimulusBody?: string;
  options?: string[];
  correctChoice?: number;
  modelAnswer?: string;
  styleNote?: string;          // 출제 시 참고할 핵심 스타일 포인트
}

/**
 * 기출문항 레퍼런스 DB (교사가 기출문제를 제공하면 이곳에 구조화하여 누적 등록합니다)
 * 현재는 자연스러운 원어민 구어체·듣기 전용 발문 패턴을 보여주는 기본 레퍼런스가 포함되어 있으며,
 * 실제 기출문제 파일(PDF/HWPX/TXT/JSON)을 제공받으면 즉시 대량 확장할 수 있습니다.
 */
export const PAST_ITEMS_DB: PastExamReference[] = [
  {
    id: 'ref-spoken-dialogue-01',
    source: 'DELTA 구어체 기준 샘플 (고1 대화문·의견)',
    mode: 'std',
    schoolLevel: '고',
    grade: '1학년',
    questionFormat: 'mcq_5',
    skill: '의견',
    textType: '대화문',
    difficulty: '중',
    vocabLevelId: 'high1_common',
    transcript: `M: Hey, Emma. Did you see the weather forecast for this weekend?
W: Yeah, it's supposed to rain on Saturday. Are we still going to have the school flea market outside?
M: The student council is thinking about canceling it altogether.
W: Really? That's a shame. So many students spent weeks getting their items ready.
M: I know, right? What else can we do, though?
W: I think we should just move it into the school gym instead of canceling it.
M: Hmm, is the gym big enough for all the booths?
W: Sure! We can set up tables along the walls and leave plenty of room in the middle.
M: That actually sounds like a great plan. Let's talk to Mr. Park right after lunch.`,
    questionPrompt: '대화를 듣고, 여자의 의견으로 가장 적절한 것을 고르시오.',
    options: [
      '우천 시 교내 벼룩시장을 취소하지 말고 체육관에서 열어야 한다.',
      '벼룩시장 준비 기간을 다음 주까지 일주일 연장해야 한다.',
      '학생회 주관 행사는 실내 시설을 우선적으로 예약해야 한다.',
      '부스 수를 줄여 운동장 천막 아래에서 행사를 진행해야 한다.',
      '날씨 변화에 대비해 야외 행사 안내문을 미리 공지해야 한다.',
    ],
    correctChoice: 1,
    styleNote:
      '일상 구어체(weather forecast, supposed to, That’s a shame, move it into the gym) 사용. 직역·전문어 없이 1회 청취로 즉각 이해 가능.',
  },
  {
    id: 'ref-spoken-notice-01',
    source: 'DELTA 구어체 기준 샘플 (고1 안내방송·포스터 빈칸)',
    mode: 'ib',
    schoolLevel: '고',
    grade: '1학년',
    questionFormat: 'gap_poster',
    skill: '세부 정보 파악',
    textType: '담화문(안내 방송)',
    difficulty: '중',
    vocabLevelId: 'high1_common',
    transcript: `W: Good afternoon, everyone. This is Ms. Lee from the school library. Next Thursday is our annual Book Swap Day! If you have any books at home that you've already read, bring them to the library between Monday and Wednesday. For every book you bring, you'll get one ticket. Then, on Thursday afternoon, you can use your tickets to pick out new books at the student lounge on the second floor. Please remember that textbooks and comic books are not accepted. Come join us and find your next favorite read!`,
    questionPrompt:
      '다음 교내 안내 방송을 듣고, ‘Book Swap Day’ 안내문의 빈칸 (1)~(3)에 들어갈 알맞은 말을 영어로 쓰시오. (각 빈칸당 1~2단어)',
    stimulusTitle: '[Annual Book Swap Day]',
    stimulusBody: `• Drop-off Period: Monday to (   1   ) at the school library
• Event Place: (   2   ) on the second floor
• Not Accepted: Textbooks and (   3   )`,
    modelAnswer: '(1) Wednesday\n(2) student lounge\n(3) comic books',
    styleNote:
      '대본을 보지 않고 음성만 듣고 노트테이킹 가능한 핵심 단어(Wednesday, student lounge, comic books)만 빈칸으로 출제.',
  },
];

export interface ReferenceSlotQuery {
  mode: AssessmentMode;
  schoolLevel: '고' | '중';
  format: QuestionFormatType;
  skill: string;
  textType: string;
  difficulty: DifficultyLevel;
  vocabLevelId: VocabLevelId;
}

/**
 * 출제 슬롯 조건에 가장 유사한 기출 레퍼런스를 점수 기반으로 선별합니다.
 * (기출 DB가 확장될수록 슬롯별 맞춤형 Few-shot 품질이 자동으로 높아집니다.)
 */
export function selectReferenceExamples(
  queries: ReferenceSlotQuery[],
  maxExamples = 2
): PastExamReference[] {
  if (PAST_ITEMS_DB.length === 0 || queries.length === 0) return [];

  const scored = PAST_ITEMS_DB.map((ref) => {
    let bestScore = 0;
    for (const q of queries) {
      let s = 0;
      if (ref.questionFormat === q.format) s += 4;
      if (ref.skill === q.skill) s += 4;
      if (ref.schoolLevel === q.schoolLevel) s += 2;
      if (ref.mode === q.mode) s += 2;
      if (ref.textType === q.textType) s += 2;
      if (ref.vocabLevelId === q.vocabLevelId) s += 1.5;
      if (ref.difficulty === q.difficulty) s += 1;
      if (s > bestScore) bestScore = s;
    }
    return { ref, score: bestScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((entry) => entry.score >= 3)
    .slice(0, maxExamples)
    .map((entry) => entry.ref);
}

/**
 * 프롬프트에 삽입할 기출 스타일 레퍼런스 블록을 생성합니다.
 */
export function formatReferenceExamplesForPrompt(
  refs: PastExamReference[]
): string {
  if (refs.length === 0) return '';

  const blocks = refs.map((r, idx) => {
    const bodyLines = [
      `[참고 스타일 예시 ${idx + 1}: ${r.source} | 형식=${r.questionFormat} | 유형=${r.skill} | 난이도=${r.difficulty}]`,
      `발문 예시: ${r.questionPrompt}`,
      `구어체 대본 톤 예시:\n${r.transcript}`,
    ];
    if (r.stimulusBody) {
      bodyLines.push(`안내문/상자 예시: ${r.stimulusTitle || ''}\n${r.stimulusBody}`);
    }
    if (r.styleNote) {
      bodyLines.push(`핵심 참고 포인트: ${r.styleNote}`);
    }
    return bodyLines.join('\n');
  });

  return `\n[참고: 자연스러운 구어체·듣기 전용 발문 레퍼런스 (소재·내용은 절대 복제하지 말고 어휘 수준, 구어 톤, 발문 형식만 참고하세요)]\n${blocks.join('\n---\n')}\n`;
}

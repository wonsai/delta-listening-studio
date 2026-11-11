export type AssessmentMode = 'ib' | 'std';
export type IbStructureMode = 'single' | 'multi'; // 1지문 1문항(PDF 모델 표준) vs 1지문 다문항(IB Paper 2형)
export type SchoolLevel = '고' | '중';
export type DifficultyLevel = '하' | '중' | '상';
export type DistributionMode = 'auto' | 'counts';

export type QuestionFormatType =
  | 'gap_poster'   // 서답형: 안내문·포스터·메모 빈칸 완성형 (PDF 예시 1)
  | 'short_kr'     // 서답형: 우리말 서술형 - 의도·이유·핵심 내용 (PDF 예시 3)
  | 'short_en'     // 서답형: 영어 단답·요약형
  | 'tf_justify'   // 서답형: 참/거짓(T/F) 판별 및 근거 서술 (IB형)
  | 'mcq_5';       // 선택형: 5지선다 객관식 (PDF 예시 2, 4 및 기존형 100%)

export type VocabLevelId =
  | 'mid_basic'       // 중학교 기본 어휘 (1,200~1,500단어 / CEFR A2)
  | 'high1_common'    // 고1 공통영어 수준 (1,800~2,000단어 / CEFR B1)
  | 'high2_general'   // 고2 영어I·II 수준 (2,300~2,500단어 / CEFR B1+~B2)
  | 'high3_advanced'; // 고3 심화·수능 수준 (3,000단어 내외 / CEFR B2)

export interface OperationGuide {
  method: string;    // 운영 방법
  benefits: string;  // 장점 및 기대효과
  cautions: string;  // 운영 시 유의사항
}

export interface RubricRow {
  id: string;
  scoreLabel: string; // 예: "3점", "2점", "1점", "0점"
  criteria: string;   // 세부 채점 기준
}

export interface SubQuestionItem {
  id: string;
  subNo: number;
  format: QuestionFormatType;
  directive: string;
  skill: string;
  questionPrompt: string;
  stimulusTitle?: string;
  stimulusBody?: string;
  options: string[];
  correctChoice: number; // 1~5
  modelAnswer: string;
  totalMarks: number;
  rubricRows: RubricRow[];
  explanation: string;
}

export interface ListeningItem {
  id: string;
  itemNo: number;
  mode: AssessmentMode;
  questionFormat: QuestionFormatType;

  // 가. 평가 운영 및 적용 방안 (문서 포함 토글 가능)
  includeOperationGuide: boolean;
  operationGuide: OperationGuide;

  // 나. 예시 문항 자료 메타데이터 (업로드 PDF 기본 항목 + DELTA 확장 항목)
  gradeSubject: string;          // 학년 / 과목 (예: "1학년 / 공통영어1")
  evalMethod: string;            // 평가 방법 (예: "정기시험 혹은 수행평가(서술형/서답형)")
  achievementStandard: string;   // 성취기준 (예: "[10공영1-01-01] 말이나 글에 포함된 세부 정보를 파악한다.")
  directive: string;             // 수행지시어 (예: "파악", "추론", "분석" 등 10대 지시어)
  skill: string;                 // 문항 유형 태그 (예: "세부 정보 파악", "목적", "의견" 등)
  topic: string;                 // [별표 1] 소재 대범주
  subtopic: string;              // [별표 1] 소재 소범주
  expressions: string[];         // [별표 2] 의사소통 기능
  structures: string[];          // [별표 4] 언어 형식(구문)
  vocabLevelId: VocabLevelId;    // 어휘 수준 코드
  vocabLevelLabel: string;       // 어휘 수준 표시명
  targetWordCount: number;       // 목표 어휘(단어) 개수
  keyVocab: string;              // 핵심 포함 어휘 (쉼표 구분)
  difficulty: DifficultyLevel;   // 난이도 (하/중/상)
  taskDescription: string;       // 평가 과제 및 문항 구성
  materialType: string;          // 듣기 자료 유형 (예: "담화문(안내 방송)_학교생활/일상(학교행사)")
  source: string;                // 듣기 자료 출처 (예: "자체 제작(AI 생성)")

  // 듣기 자료(텍스트)
  transcript: string;            // 화자 구분 대본 (W:, M:, N:)
  koreanTranslation: string;     // 교사 참고용 우리말 해석

  // 문항지, 활동지 또는 수행 과제 안내문
  questionPrompt: string;        // 발문
  stimulusTitle: string;         // 포스터/안내문 박스 제목 (예: "[2026 Career Mentoring Day Notice]")
  stimulusBody: string;          // 포스터/빈칸 박스 또는 하위 소문항 양식 (예: "(1) 남자의 의도:\n(2) 이유:")
  options: string[];             // 선택형일 때 ①~⑤ 선택지 5개

  // 채점 기준
  isConstructedResponse: boolean; // true = 서답형(4열 채점기준표), false = 선택형(정답 + 해설)
  correctChoice: number;          // 선택형 정답 번호 (1~5)
  modelAnswer: string;            // 서답형 모범답안
  totalMarks: number;             // 배점
  rubricRows: RubricRow[];        // 서답형 세부 채점 기준 행
  explanation: string;            // 정답 근거 및 해설

  // 1지문 다문항(IB 복합형)일 때 추가 소문항 (선택)
  subQuestions?: SubQuestionItem[];

  // 생성된 원어민 음성(런타임 상태)
  audioUrl?: string;
  audioBlob?: Blob;
  audioExt?: '.mp3' | '.wav';
  audioSizeBytes?: number;
  audioEngineLabel?: string;
}

export interface GenerationParams {
  // Step 1
  mode: AssessmentMode;
  ibStructureMode: IbStructureMode;
  schoolLevel: SchoolLevel;
  grade: string;                 // "1학년", "2학년", "3학년"
  subject: string;               // "공통영어1", "공통영어2", "영어Ⅰ", "영어Ⅱ" 등
  evalPurpose: string;           // "정기시험 혹은 수행평가(서술형/서답형)" 등
  assessmentTitle: string;       // 문서 제목 (예: "2026학년도 1학기 대구형 영어듣기 평가 출제 원안")
  schoolName: string;            // 학교명 (학생용 시험지 인쇄용, 예: "대구서부고등학교")

  // Step 2
  itemCount: number;             // 출제 문항(지문) 수
  questionFormatMode: DistributionMode; // 'auto'(허용 형식 균형 배분) | 'counts'(문항 수별 직접 지정)
  questionFormats: QuestionFormatType[]; // 대구형에서 허용할 문항 형식들 (auto 모드용)
  questionFormatCounts: Partial<Record<QuestionFormatType, number>>; // 문항 형식별 출제 개수 (counts 모드용)
  selectedStandards: string[];   // 선택된 성취기준 코드/문구 목록 (빈 배열이면 과목 성취기준 자동 배정)
  selectedSkills: string[];      // 선택된 문항 유형(skill) 목록 (빈 배열이면 성취기준 맞춤 자동 배정)
  selectedDirective: string;     // 지정 수행지시어 (빈 문자열이면 성취기준/유형에 맞춰 자동 배정)
  selectedTopics: string[];      // [별표 1] 소재 대범주 (복수 선택 가능, 빈 배열이면 자동 다양화)
  selectedSubtopic: string;      // [별표 1] 소범주 (선택)
  customTopicDetail: string;     // 교사 직접 입력 구체적 상황/주제
  textTypeMode: DistributionMode;// 'auto'(문항 수에 맞춰 담화/대화 자동 배분) | 'counts'(유형별 문항 수 직접 지정)
  textTypes: string[];           // 담화/대화 유형 목록 (하위 호환 및 참조용)
  textTypeCounts: Record<string, number>; // 담화/대화 유형별 출제 개수 (counts 모드용)
  targetWordCount: number;       // 지문당 목표 어휘(단어) 수 (예: 120)
  vocabLevelId: VocabLevelId;    // 어휘 수준
  requiredWords: string;         // 반드시 포함할 목표 어휘
  difficulty: DifficultyLevel;   // 난이도 (하/중/상)
  selectedExpressions: string[]; // [별표 2] 의사소통 기능
  selectedStructures: string[];  // [별표 4] 언어 형식(구문)
  includeOperationGuide: boolean;// 가. 평가 운영 및 적용 방안 자동 생성 포함 여부
  extraInstructions: string;     // 추가 출제 요청 사항
}

export type TtsEngineType = 'gemini' | 'browser';

export interface TtsConfig {
  engine: TtsEngineType;
  speed: number;          // 0.75 ~ 1.25
  pauseLine: number;      // 문장 간 쉼(초)
  pausePara: number;      // 빈 줄/화자 전환 추가 쉼(초)
  includeChime: boolean;  // 문항 시작 시 듣기평가 차임벨 삽입
  includeKoreanIntro: boolean; // 문항 번호 안내 멘트 포함 여부
  gapBetweenItemsSec: number;  // 합본 MP3 제작 시 문항 간 풀이 대기 시간(초)
  geminiVoices: {
    M: string;
    W: string;
    N: string;
  };
  browserVoices: {
    M: string;
    W: string;
    N: string;
  };
}

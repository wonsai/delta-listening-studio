import { DifficultyLevel, ListeningItem, VocabLevelId } from '../types/assessment';
import { countTranscriptWords, detectSpeakers, parseScript } from './wordUtils';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationCategory =
  | 'listening_validity' // 듣기 평가 타당도 (읽기 문형 혼입 등)
  | 'spoken_register'    // 어색한 직역 / 비구어체 표현
  | 'vocab_difficulty'   // 난이도 대비 과도한 어휘·문장 길이
  | 'structure';         // 화자 태그, 보기 누락/중복, 채점기준 일치 등

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  category: ValidationCategory;
  title: string;
  detail: string;
  matchedText?: string;
  suggestion?: string;
  autoFixHint?: string;
}

export interface FlaggedVocabItem {
  word: string;
  reason: string;
  suggestion?: string;
  severity: 'warning' | 'error';
}

export interface ItemValidationReport {
  status: 'pass' | 'warning' | 'error';
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
  flaggedVocab: FlaggedVocabItem[];
  metrics: {
    wordCount: number;
    sentenceCount: number;
    avgSentenceWords: number;
    maxSentenceWords: number;
    speakerCount: number;
  };
}

// 1) 듣기 평가인데 읽기 문형으로 변질된 금지 표현 패턴
const READING_LEAK_PATTERNS: Array<{
  regex: RegExp;
  label: string;
  suggestion: string;
}> = [
  {
    regex: /대본(을|을\s*보고|에서|의\s*내용을\s*참고|에\s*나온|에\s*제시된)/g,
    label: '‘대본을 보고 / 대본에서’ 표현 혼입',
    suggestion: '학생에게 대본은 제공되지 않습니다. ‘대화를 듣고 / 안내 방송을 듣고 / 들은 내용을 바탕으로’로 고치세요.',
  },
  {
    regex: /(지문을?\s*(보고|읽고|참고)|지문에서\s*(찾아|골라|옮겨|그대로))/g,
    label: '‘지문을 보고/읽고 / 지문에서 찾아’ 표현 혼입',
    suggestion: '듣기 평가에는 지문이 제시되지 않습니다. ‘대화를 듣고 / 담화를 듣고’로 수정하세요.',
  },
  {
    regex: /(윗글|위\s*글|다음\s*글을?\s*읽|본문(을|에서)|밑줄\s*친)/g,
    label: '읽기 평가 전용 표현(윗글/다음 글/본문/밑줄 친)',
    suggestion: '듣기 평가 발문(‘대화를 듣고’, ‘담화를 듣고’, ‘음성 메시지를 듣고’)으로 변경하세요.',
  },
  {
    regex: /(찾아\s*(쓰시오|적으시오|기재하시오)|그대로\s*(옮겨\s*쓰|베껴\s*쓰))/g,
    label: '‘찾아 쓰시오 / 그대로 옮겨 쓰시오’ (읽기·발췌형 지시)',
    suggestion: '학생이 귀로 듣고 핵심 정보를 작성하도록 ‘들은 내용을 바탕으로 ~을(를) 쓰시오’ 형태로 바꾸세요.',
  },
  {
    regex: /\b(read\s+the\s+(transcript|script|dialogue|passage|text)|from\s+the\s+(transcript|script|passage)|in\s+the\s+(transcript|script|passage)|above\s+passage|underlined\s+(word|phrase|sentence))\b/gi,
    label: '영문 읽기 문형 표현(Read/From the transcript·passage)',
    suggestion: 'Use listening instructions such as "Listen to the dialogue/announcement and..." instead.',
  },
];

// 2) 한국어 직역(Translationese) 및 일상 듣기 대화에 어색한 과도한 문어체/전문어 사전
interface AwkwardExpressionRule {
  regex: RegExp;
  display: string;
  replacement: string;
  reason: string;
  minAllowedLevel?: VocabLevelId; // 이 수준 이상(high3_advanced 등)의 강연이면 허용 가능
}

const AWKWARD_SPOKEN_RULES: AwkwardExpressionRule[] = [
  {
    regex: /\bmeteorological\s+(center|agency|administration|office|station|service)\b/gi,
    display: 'meteorological center/agency',
    replacement: 'weather forecast / weather service',
    reason: '‘기상청’의 부자연스러운 직역입니다. 일상 영어 대화에서는 weather forecast/service를 씁니다.',
  },
  {
    regex: /\bmeteorological\b/gi,
    display: 'meteorological',
    replacement: 'weather',
    reason: '일상 듣기 대화에 과도하게 전문적인 학술어입니다.',
  },
  {
    regex: /\becological\s+transition\b/gi,
    display: 'ecological transition',
    replacement: 'going green / eco-friendly change',
    reason: '교육과정 용어 ‘생태전환’의 직역입니다. 구어체에서는 eco-friendly habits/change가 자연스럽습니다.',
  },
  {
    regex: /\bdemocratic\s+citizenship\b/gi,
    display: 'democratic citizenship',
    replacement: 'being a responsible citizen',
    reason: '교육과정 영역명 ‘민주시민’의 직역입니다.',
  },
  {
    regex: /\binclement\s+weather\b/gi,
    display: 'inclement weather',
    replacement: 'bad weather / heavy rain',
    reason: '격식체 공문서 표현으로 중·고등 듣기 대화에 부적합합니다.',
  },
  {
    regex: /\bprecipitation\b/gi,
    display: 'precipitation',
    replacement: 'rain / snow',
    reason: '일상 구어에서는 rain/snow로 말하는 것이 자연스럽습니다.',
  },
  {
    regex: /\butilize\b/gi,
    display: 'utilize',
    replacement: 'use',
    reason: '구어체 대화에서는 use가 훨씬 자연스럽습니다.',
  },
  {
    regex: /\bcommence\b/gi,
    display: 'commence',
    replacement: 'start / begin',
    reason: '격식 문어체 표현입니다. 구어에서는 start/begin을 사용하세요.',
  },
  {
    regex: /\brectify\b/gi,
    display: 'rectify',
    replacement: 'fix / correct',
    reason: '저빈도 격식어입니다. fix 또는 correct로 바꾸세요.',
  },
  {
    regex: /\bameliorate\b/gi,
    display: 'ameliorate',
    replacement: 'improve / make better',
    reason: '대학원/학술 수준의 문어 어휘입니다.',
  },
  {
    regex: /\balleviate\b/gi,
    display: 'alleviate',
    replacement: 'reduce / ease',
    reason: '듣기 난이도 대비 과도한 격식어입니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bdisseminate\b/gi,
    display: 'disseminate',
    replacement: 'share / spread',
    reason: '학술·행정 문어체 단어입니다.',
  },
  {
    regex: /\bendeavor\b/gi,
    display: 'endeavor',
    replacement: 'try / effort',
    reason: '구어체에는 어색한 문어체 어휘입니다.',
  },
  {
    regex: /\bsubsequently\b/gi,
    display: 'subsequently',
    replacement: 'then / later / after that',
    reason: '구어체 연결어로 부자연스럽습니다.',
  },
  {
    regex: /\bfurthermore\b/gi,
    display: 'furthermore',
    replacement: 'also / plus / besides',
    reason: '에세이 문어체 접속부사입니다. 대화·안내문에서는 also/plus가 자연스럽습니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bmoreover\b/gi,
    display: 'moreover',
    replacement: 'also / besides / what’s more',
    reason: '에세이 문어체 접속부사입니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bnevertheless\b/gi,
    display: 'nevertheless',
    replacement: 'still / even so',
    reason: '문어체 접속부사입니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bconsequently\b/gi,
    display: 'consequently',
    replacement: 'so / as a result',
    reason: '문어체 접속부사입니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bnotwithstanding\b/gi,
    display: 'notwithstanding',
    replacement: 'despite / even with',
    reason: '법률·공문서 수준의 어휘입니다.',
  },
  {
    regex: /\bexacerbate\b/gi,
    display: 'exacerbate',
    replacement: 'make worse',
    reason: '듣기 평가에 과도하게 어려운 저빈도 어휘입니다.',
  },
  {
    regex: /\bdeteriorate\b/gi,
    display: 'deteriorate',
    replacement: 'get worse',
    reason: '구어에서는 get worse가 자연스럽습니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bdetrimental\b/gi,
    display: 'detrimental',
    replacement: 'harmful / bad for',
    reason: '학술 문어체 형용사입니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bindispensable\b/gi,
    display: 'indispensable',
    replacement: 'essential / really needed',
    reason: '듣기 청취 부담이 큰 고난도 어휘입니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bunprecedented\b/gi,
    display: 'unprecedented',
    replacement: 'never seen before / record-breaking',
    reason: '뉴스·학술 문어체 어휘입니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bmitigate\b/gi,
    display: 'mitigate',
    replacement: 'reduce / lower',
    reason: '정책 보고서용 문어체 동사입니다.',
  },
  {
    regex: /\bproliferate\b/gi,
    display: 'proliferate',
    replacement: 'grow quickly / spread',
    reason: '저빈도 학술어입니다.',
  },
  {
    regex: /\bubiquitous\b/gi,
    display: 'ubiquitous',
    replacement: 'everywhere / very common',
    reason: '저빈도 학술어입니다.',
  },
  {
    regex: /\bpredominantly\b/gi,
    display: 'predominantly',
    replacement: 'mostly / mainly',
    reason: '구어체에서는 mostly/mainly가 자연스럽습니다.',
  },
  {
    regex: /\bsimultaneously\b/gi,
    display: 'simultaneously',
    replacement: 'at the same time',
    reason: '귀로 들을 때 at the same time이 훨씬 자연스럽습니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\brefrain\s+from\b/gi,
    display: 'refrain from',
    replacement: 'avoid / please do not',
    reason: '공문서 투의 격식 표현입니다.',
    minAllowedLevel: 'high2_general',
  },
  {
    regex: /\bprior\s+to\b/gi,
    display: 'prior to',
    replacement: 'before',
    reason: '구어에서는 before가 훨씬 자연스럽습니다.',
    minAllowedLevel: 'high2_general',
  },
  {
    regex: /\brelocate\b/gi,
    display: 'relocate',
    replacement: 'move',
    reason: '일상 대화/학교 안내에서는 move가 자연스럽습니다.',
    minAllowedLevel: 'high2_general',
  },
  {
    regex: /\bfacilitate\b/gi,
    display: 'facilitate',
    replacement: 'help / support / make easier',
    reason: '행정·학술 문어체 동사입니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bcomprehensive\b/gi,
    display: 'comprehensive',
    replacement: 'complete / full / detailed',
    reason: '구어체에서는 complete/detailed가 더 자연스럽습니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bsubstantial\b/gi,
    display: 'substantial',
    replacement: 'large / big / major',
    reason: '구어체에서는 big/major가 자연스럽습니다.',
    minAllowedLevel: 'high3_advanced',
  },
  {
    regex: /\bapproximate(ly)?\b/gi,
    display: 'approximately',
    replacement: 'about / around',
    reason: '일상 대화에서는 about/around가 자연스럽습니다.',
    minAllowedLevel: 'high2_general',
  },
];

// 일상·학교 듣기에서 자주 쓰이는 4음절+ 안전 어휘 화이트리스트 (오탐 방지)
const SAFE_COMMON_LONG_WORDS = new Set([
  'information', 'university', 'environment', 'community', 'auditorium',
  'registration', 'presentation', 'temperature', 'opportunity', 'activity',
  'activities', 'technology', 'photography', 'competition', 'celebration',
  'documentary', 'electricity', 'experience', 'experiences', 'immediately',
  'especially', 'actually', 'originally', 'definitely', 'naturally',
  'generally', 'usually', 'probably', 'personally', 'unfortunately',
  'international', 'traditional', 'educational', 'professional', 'environmental',
  'comfortable', 'understandable', 'unbelievable', 'reasonable', 'available',
  'advertisement', 'recommendation', 'communication', 'transportation',
  'reservation', 'destination', 'imagination', 'conversation', 'explanation',
  'preparation', 'organization', 'participation', 'responsibility', 'personality',
  'cafeteria', 'gymnasium', 'graduation', 'exhibition', 'ceremony',
  'elementary', 'secondary', 'secretary', 'anniversary', 'dictionary',
  'documentaries', 'refrigerator', 'neighborhood', 'everybody', 'everything',
  'supermarket', 'congratulations', 'appreciate', 'participate', 'communicate',
  'investigate', 'certificate', 'alternative', 'cooperative', 'interesting',
  'wonderfully', 'successfully', 'convenient', 'convenience', 'necessarily',
  'automatically', 'occasionally', 'regularly', 'seriously', 'carefully',
  'absolutely', 'completely', 'effectively', 'specifically', 'independently',
  'application', 'association', 'celebrating', 'volunteering', 'encouraging',
  'storytelling', 'mentoring', 'recycling', 'reusable', 'overestimate',
  'psychological', 'economics', 'behavioral', 'sustainability', 'sustainable',
  'vegetarian', 'material', 'materials', 'electronic', 'electronics',
  'delivery', 'category', 'memory', 'history', 'library', 'january',
  'february', 'november', 'december', 'saturday', 'wednesday', 'thursday',
  'tomorrow', 'yesterday', 'afternoon', 'basketball', 'volleyball',
  'photograph', 'photographs', 'headphones', 'microphone', 'smartphone',
  'newsletter', 'membership', 'scholarship', 'internship', 'leadership',
  'friendship', 'workshop', 'workshops', 'assignment', 'assignments',
  'appointment', 'department', 'apartment', 'government', 'management',
  'improvement', 'development', 'equipment', 'entertainment', 'tournament',
  'performance', 'attendance', 'conference', 'difference', 'preference',
  'reference', 'audience', 'accident', 'incident', 'president', 'resident',
  'student', 'students', 'counselor', 'volunteer', 'volunteers', 'customer',
  'customers', 'passenger', 'passengers', 'character', 'characters',
  'schedule', 'scheduled', 'calendar', 'computer', 'internet', 'website',
  'online', 'digital', 'hospital', 'festival', 'principal', 'musical',
  'personal', 'national', 'regional', 'original', 'physical', 'cultural',
  'practical', 'typical', 'local', 'global', 'social', 'special',
  'official', 'essential', 'potential', 'financial', 'commercial', 'industrial',
]);

function estimateSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length <= 3) return 1;
  const trimmed = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const vowelGroups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, vowelGroups ? vowelGroups.length : 1);
}

function vocabLevelRank(id: VocabLevelId): number {
  switch (id) {
    case 'mid_basic':
      return 1;
    case 'high1_common':
      return 2;
    case 'high2_general':
      return 3;
    case 'high3_advanced':
      return 4;
    default:
      return 2;
  }
}

function hasKorean(text: string): boolean {
  return /[가-힣]/.test(text);
}

function hasEnglishLetters(text: string): boolean {
  return /[A-Za-z]{2,}/.test(text);
}

/**
 * 단일 문항에 대해 즉시(0ms, API 호출 없음) 듣기 타당도·구어체·어휘 난이도·구조 무결성을 검증합니다.
 */
export function validateListeningItem(
  item: ListeningItem,
  expectedWordCount?: number
): ItemValidationReport {
  const issues: ValidationIssue[] = [];
  const flaggedVocab: FlaggedVocabItem[] = [];
  const seenFlagged = new Set<string>();

  const segs = parseScript(item.transcript, 0, 0);
  const bodyText = segs.map((s) => s.text).join(' ').trim();
  const wordCount = countTranscriptWords(item.transcript);
  const speakers = detectSpeakers(item.transcript);

  const sentences = bodyText
    ? bodyText
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => /[A-Za-z0-9]/.test(s))
    : [];
  const sentenceWordCounts = sentences.map(
    (s) => (s.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length
  );
  const sentenceCount = sentenceWordCounts.length;
  const avgSentenceWords =
    sentenceCount > 0
      ? Math.round(
          (sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceCount) * 10
        ) / 10
      : 0;
  const maxSentenceWords =
    sentenceWordCounts.length > 0 ? Math.max(...sentenceWordCounts) : 0;

  // -------------------------------------------------------------------------
  // 1. 듣기 타당도 검사 (읽기 문형 혼입 치명 오류)
  // -------------------------------------------------------------------------
  const studentVisibleFields = [
    { name: '발문', text: item.questionPrompt || '' },
    { name: '안내문/상자 제목', text: item.stimulusTitle || '' },
    { name: '안내문/상자 본문', text: item.stimulusBody || '' },
    ...(!item.isConstructedResponse
      ? (item.options || []).map((opt, idx) => ({
          name: `선택지 ${idx + 1}번`,
          text: opt || '',
        }))
      : []),
  ];

  for (const field of studentVisibleFields) {
    if (!field.text.trim()) continue;
    for (const rule of READING_LEAK_PATTERNS) {
      rule.regex.lastIndex = 0;
      const match = rule.regex.exec(field.text);
      if (match) {
        issues.push({
          id: `read-leak-${field.name}-${match[0]}`,
          severity: 'error',
          category: 'listening_validity',
          title: `[듣기 타당도 오류] ${field.name}에 ${rule.label}`,
          detail: `감지된 문구: "${match[0]}" — ${rule.suggestion}`,
          matchedText: match[0],
          suggestion: rule.suggestion,
          autoFixHint: `${field.name}에서 읽기 평가 표현("${match[0]}")을 완전히 제거하고, 대본 없이 음성만 듣고 풀 수 있는 듣기 평가 표현으로 수정해 주세요.`,
        });
      }
    }
  }

  // 발문에 듣기 지시어가 전혀 없는 경우 경고
  const promptText = (item.questionPrompt || '').trim();
  if (
    promptText &&
    !/(듣고|들려|방송|대화|담화|메시지|안내|강연|인터뷰|listen|hear|recording|audio|announcement|dialogue|conversation|message)/i.test(
      promptText
    )
  ) {
    issues.push({
      id: 'missing-listening-cue',
      severity: 'warning',
      category: 'listening_validity',
      title: '발문에 듣기 평가 지시 표현 누락',
      detail: '발문에 "대화를 듣고", "안내 방송을 듣고", "Listen to..." 등 청취 지시어가 보이지 않습니다.',
      suggestion: '학생용 시험지에서 듣기 문항임이 분명히 드러나도록 "대화를 듣고, ..." 형태로 시작하세요.',
      autoFixHint: '발문을 듣기 평가 표준 표현("대화를 듣고, ..." 또는 "다음 안내 방송을 듣고, ...")으로 다듬어 주세요.',
    });
  }

  // -------------------------------------------------------------------------
  // 2. 어색한 직역 / 비구어체 표현 감지
  // -------------------------------------------------------------------------
  const currentRank = vocabLevelRank(item.vocabLevelId);
  if (bodyText) {
    for (const rule of AWKWARD_SPOKEN_RULES) {
      if (
        rule.minAllowedLevel &&
        currentRank >= vocabLevelRank(rule.minAllowedLevel) &&
        item.difficulty === '상'
      ) {
        continue;
      }
      rule.regex.lastIndex = 0;
      const m = rule.regex.exec(bodyText);
      if (m) {
        const matched = m[0];
        const key = matched.toLowerCase();
        if (!seenFlagged.has(key)) {
          seenFlagged.add(key);
          flaggedVocab.push({
            word: matched,
            reason: rule.reason,
            suggestion: rule.replacement,
            severity: 'error',
          });
        }
        issues.push({
          id: `awkward-${key}`,
          severity: 'warning',
          category: 'spoken_register',
          title: `비구어체/직역 의심 표현: "${matched}"`,
          detail: `${rule.reason} (추천 대체: ${rule.replacement})`,
          matchedText: matched,
          suggestion: rule.replacement,
          autoFixHint: `대본의 부자연스러운 표현 "${matched}"을(를) 원어민 일상 구어 표현("${rule.replacement}")으로 자연스럽게 교체하고 해석·해설도 맞춰 주세요.`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. 난이도 대비 과도한 장음절 저빈도 어휘 & 긴 문장 감지
  // -------------------------------------------------------------------------
  if (bodyText) {
    const hardWordLimitRank =
      item.difficulty === '하'
        ? Math.max(1, currentRank - 1)
        : item.difficulty === '상'
        ? currentRank + 1
        : currentRank;

    // 4음절 이상이면서 일상 화이트리스트에 없고 고유명사(문두 제외 대문자)도 아닌 단어 탐지
    const rawTokens = bodyText.match(/\b[A-Za-z]{9,}\b/g) || [];
    const hardCandidates: string[] = [];

    for (const tok of rawTokens) {
      const lower = tok.toLowerCase();
      if (SAFE_COMMON_LONG_WORDS.has(lower)) continue;
      if (seenFlagged.has(lower)) continue;
      const syl = estimateSyllables(lower);
      // 난이도 하/중(high1 이하)은 4음절 이상, 상/high2 이상은 5음절 이상 또는 13글자 이상
      const isHard =
        hardWordLimitRank <= 2
          ? syl >= 4 || lower.length >= 12
          : syl >= 5 || lower.length >= 14;
      if (isHard) {
        seenFlagged.add(lower);
        hardCandidates.push(tok);
        flaggedVocab.push({
          word: tok,
          reason: `듣기 1회 청취 시 부담이 큰 장음절/저빈도 의심 어휘 (${syl}음절)`,
          suggestion: '더 친숙한 일상 구어 어휘로 교체 검토',
          severity: 'warning',
        });
      }
    }

    if (hardCandidates.length > 0) {
      issues.push({
        id: 'hard-vocab-cluster',
        severity: 'warning',
        category: 'vocab_difficulty',
        title: `듣기 난이도 초과 의심 어휘 ${hardCandidates.length}개 감지`,
        detail: `감지 어휘: ${hardCandidates.slice(0, 6).join(', ')} — 현재 설정(${item.vocabLevelLabel} / 난이도 ${item.difficulty})에서 귀로 듣고 바로 이해하기 어려울 수 있습니다.`,
        matchedText: hardCandidates.slice(0, 6).join(', '),
        suggestion: '보다 친숙한 구어체 기본 어휘로 풀어서 표현하는 것을 권장합니다.',
        autoFixHint: `대본에서 듣기에 다소 어려운 어휘(${hardCandidates.slice(0, 6).join(', ')})를 현재 수준(${item.vocabLevelLabel}, 난이도 ${item.difficulty})에 맞는 자연스러운 일상 구어 어휘로 쉽게 바꿔 주세요.`,
      });
    }

    // 한 문장 길이 과다 경고 (순간 청취 인지부하)
    const maxAllowedSentenceLen =
      item.difficulty === '하'
        ? 18
        : item.difficulty === '중'
        ? 24
        : 30;
    if (maxSentenceWords > maxAllowedSentenceLen) {
      issues.push({
        id: 'long-sentence',
        severity: 'warning',
        category: 'vocab_difficulty',
        title: `호흡이 지나치게 긴 문장 포함 (최대 ${maxSentenceWords}단어)`,
        detail: `난이도 '${item.difficulty}' 기준 한 문장 ${maxAllowedSentenceLen}단어 이하가 청취에 적합합니다. 문장을 두 개로 나누면 듣기 자연스러움이 크게 높아집니다.`,
        suggestion: '긴 복문을 2개의 짧은 구어체 문장으로 분리하세요.',
        autoFixHint: `대본에서 ${maxAllowedSentenceLen}단어를 넘는 긴 문장을 자연스러운 구어 호흡에 맞게 짧은 두 문장으로 나누어 주세요.`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. 구조 및 무결성 검사
  // -------------------------------------------------------------------------
  if (!item.transcript.trim()) {
    issues.push({
      id: 'empty-transcript',
      severity: 'error',
      category: 'structure',
      title: '영어 듣기 대본이 비어 있습니다',
      detail: '음원 생성과 문항 구성을 위해 화자 표기(W:, M:)를 포함한 영어 대본을 입력해 주세요.',
    });
  } else {
    // 화자 표기 누락 검사
    if (speakers.includes('D')) {
      issues.push({
        id: 'missing-speaker-tag',
        severity: 'warning',
        category: 'structure',
        title: '화자 기호(W:, M:)가 누락된 발화 줄이 있습니다',
        detail: '대본의 모든 발화 줄은 "W: " 또는 "M: "로 시작해야 TTS 음성이 정확히 화자별로 분리됩니다.',
        autoFixHint: '대본의 모든 발화 줄 앞에 정확한 화자 기호(W: 또는 M:)를 붙여 주세요.',
      });
    }

    // 대화문인데 화자가 1명뿐인 경우
    if (
      /(대화문|인터뷰|토론)/.test(item.materialType || '') &&
      speakers.filter((s) => s !== 'D').length < 2
    ) {
      issues.push({
        id: 'dialogue-single-speaker',
        severity: 'error',
        category: 'structure',
        title: '대화형 자료인데 화자가 1명만 감지되었습니다',
        detail: `듣기 자료 유형이 "${item.materialType}"이지만 감지된 화자가 [${speakers.join(', ') || '없음'}]뿐입니다. W:와 M: 두 화자가 번갈아 말하도록 구성하세요.`,
        autoFixHint: '두 화자(W:와 M:)가 자연스럽게 대화를 주고받는 형식으로 대본을 수정해 주세요.',
      });
    }

    // 목표 단어 수 큰 이탈 (±25%)
    const targetRef = expectedWordCount || item.targetWordCount;
    if (targetRef >= 50 && Math.abs(wordCount - targetRef) > Math.max(25, targetRef * 0.25)) {
      issues.push({
        id: 'word-count-drift',
        severity: 'warning',
        category: 'structure',
        title: `목표 어휘 수와 차이 큼 (현재 ${wordCount}단어 / 목표 약 ${targetRef}단어)`,
        detail: '지문 길이가 너무 짧거나 길면 시험 시간 배분과 난이도가 달라집니다.',
        autoFixHint: `대본 분량을 약 ${targetRef}단어 내외(±10%)로 조절해 주세요.`,
      });
    }
  }

  if (!promptText) {
    issues.push({
      id: 'empty-prompt',
      severity: 'error',
      category: 'structure',
      title: '문항 발문이 비어 있습니다',
      detail: '학생에게 제시할 발문을 입력해 주세요.',
    });
  }

  if (!item.isConstructedResponse) {
    const isIb3 = item.questionFormat === 'ib_mcq_3';
    const expectedCount = isIb3 ? 3 : 5;
    const labelName = isIb3 ? 'IB 3지선다' : '5지선다';
    const rangeText = isIb3 ? 'A~C' : '①~⑤';
    const opts = (item.options || []).slice(0, expectedCount).map((o) => (o || '').trim());
    const filledCount = opts.filter(Boolean).length;
    if (filledCount < expectedCount) {
      issues.push({
        id: 'mcq-missing-options',
        severity: 'error',
        category: 'structure',
        title: `${labelName} 선택지 부족 (${filledCount}/${expectedCount}개 입력됨)`,
        detail: `${rangeText} ${expectedCount}개 선택지가 모두 채워져 있어야 합니다.`,
        autoFixHint: `비어 있는 선택지를 채워 ${expectedCount}개 선택지 모두 완성해 주세요.`,
      });
    } else {
      // 중복 선택지 검사
      const normalizedOpts = opts.map((o) => o.toLowerCase().replace(/\s+/g, ' '));
      if (new Set(normalizedOpts).size < expectedCount) {
        issues.push({
          id: 'mcq-duplicate-options',
          severity: 'error',
          category: 'structure',
          title: '중복된 선택지가 있습니다',
          detail: `${expectedCount}개 선택지는 서로 명확히 구별되는 내용이어야 합니다.`,
          autoFixHint: '중복된 선택지를 서로 구별되는 매력적인 오답으로 수정해 주세요.',
        });
      }

      // 선택지 언어 혼용 검사 (한국어 보기와 영어 보기가 섞인 경우)
      const koCount = opts.filter((o) => hasKorean(o)).length;
      const enOnlyCount = opts.filter((o) => !hasKorean(o) && hasEnglishLetters(o)).length;
      if (koCount > 0 && enOnlyCount > 0) {
        issues.push({
          id: 'mcq-mixed-language',
          severity: 'warning',
          category: 'structure',
          title: '선택지 언어 혼용 감지 (한국어·영어 섞임)',
          detail: `한국어 선택지 ${koCount}개와 영어 선택지 ${enOnlyCount}개가 섞여 있습니다. ${expectedCount}개 선택지의 언어와 문장 구조를 통일하세요.`,
          autoFixHint: `${expectedCount}개 선택지 전체를 하나의 언어(기출 기준 영어 또는 한국어)와 병렬 구조로 통일해 주세요.`,
        });
      }
    }

    if (
      item.correctChoice < 1 ||
      item.correctChoice > expectedCount ||
      !opts[item.correctChoice - 1]
    ) {
      issues.push({
        id: 'mcq-invalid-answer',
        severity: 'error',
        category: 'structure',
        title: '선택형 정답 번호가 유효하지 않습니다',
        detail: isIb3
          ? 'A~C 중 내용이 채워진 선택지를 정답으로 지정해 주세요.'
          : '1~5번 중 내용이 채워진 선택지를 정답으로 지정해 주세요.',
      });
    }
  } else {
    // 서답형 검사
    if (!item.modelAnswer.trim()) {
      issues.push({
        id: 'cr-empty-model-answer',
        severity: 'error',
        category: 'structure',
        title: '서답형 모범답안이 비어 있습니다',
        detail: '채점 기준표의 모범답안을 입력해 주세요.',
      });
    }

    if (
      item.questionFormat === 'gap_poster' &&
      !/(?:\(\s*[1-3]\s*\)|_{3,})/.test(item.stimulusBody || '')
    ) {
      issues.push({
        id: 'gap-poster-no-blanks',
        severity: 'warning',
        category: 'structure',
        title: '포스터 빈칸 완성형인데 안내문 상자에 빈칸 표기가 없습니다',
        detail: '안내문 본문에 (   1   ), (   2   ) 형태의 빈칸을 넣어 주세요.',
        autoFixHint: '포스터/안내문 상자(stimulusBody)에 (   1   ), (   2   ) 형태의 명확한 빈칸을 구성해 주세요.',
      });
    }

    if (item.rubricRows.length === 0) {
      issues.push({
        id: 'cr-empty-rubric',
        severity: 'warning',
        category: 'structure',
        title: '서답형 세부 채점 기준표가 비어 있습니다',
        detail: '부분점수 기준을 포함한 채점 기준 행을 추가해 주세요.',
      });
    } else {
      const numericScores = item.rubricRows
        .map((r) => {
          const m = String(r.scoreLabel || '').match(/\d+/);
          return m ? Number(m[0]) : NaN;
        })
        .filter((n) => !Number.isNaN(n));
      if (numericScores.length > 0) {
        const maxRubric = Math.max(...numericScores);
        if (maxRubric !== item.totalMarks) {
          issues.push({
            id: 'rubric-score-mismatch',
            severity: 'warning',
            category: 'structure',
            title: `배점(${item.totalMarks}점)과 채점 기준 최고점(${maxRubric}점) 불일치`,
            detail: '문항 배점과 채점 기준표 최고 점수가 일치하도록 맞춰 주세요.',
            autoFixHint: `채점 기준표의 최고 배점을 문항 총 배점(${item.totalMarks}점)과 일치하도록 조정해 주세요.`,
          });
        }
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const status: 'pass' | 'warning' | 'error' =
    errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'pass';

  return {
    status,
    errorCount,
    warningCount,
    issues,
    flaggedVocab,
    metrics: {
      wordCount,
      sentenceCount,
      avgSentenceWords,
      maxSentenceWords,
      speakerCount: speakers.filter((s) => s !== 'D').length,
    },
  };
}

/**
 * 검수 리포트에서 감지된 문제점들을 AI 원클릭 교정 지시문으로 변환합니다.
 */
export function buildAutoFixPromptFromReport(
  report: ItemValidationReport,
  difficulty: DifficultyLevel,
  vocabLevelLabel: string
): string {
  const hints = report.issues
    .map((i) => i.autoFixHint || `${i.title}: ${i.detail}`)
    .filter(Boolean);

  if (hints.length === 0) {
    return `현재 문항의 대본을 원어민이 일상에서 실제 말하듯 더욱 자연스러운 구어체로 다듬고(${vocabLevelLabel}, 난이도 ${difficulty}), 학생이 대본 없이 음성만 듣고 풀기에 논리적 모순이나 부자연스러운 어휘가 없는지 정밀 검수하여 완성도를 높여 주세요.`;
  }

  return `다음 자동 검수에서 발견된 문제점들을 모두 정확히 교정하고, 전체 대본·발문·보기/모범답안·해설·우리말 해석의 일관성을 맞춰 주세요:\n${hints
    .map((h, idx) => `${idx + 1}. ${h}`)
    .join('\n')}`;
}

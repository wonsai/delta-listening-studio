import {
  GenerationParams,
  ListeningItem,
  QuestionFormatType,
  RubricRow,
} from '../types/assessment';
import {
  AchievementStandardItem,
  DIRECTIVES,
  IB_SKILLS,
  QUESTION_FORMATS,
  STD_SKILLS,
  TEXT_TYPES,
  VOCAB_LEVELS,
  getAchievementStandardsForSubject,
  getDefaultEnglishOptionSkills,
  getListeningPrimaryStandardsForSubject,
  getSubjectInfo,
} from '../data/taxonomy';
import { DEFAULT_OPERATION_GUIDE } from '../data/sampleItems';
import { countTranscriptWords } from './wordUtils';

const STORAGE_KEY = 'delta_authoring_gemini_key';

export function getSavedApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export const FIXED_GEMINI_MODEL = 'gemini-3.8-flash';

async function callGeminiJson(
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: Record<string, unknown>,
  onStatus?: (msg: string) => void
): Promise<unknown> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error('Gemini API 키가 입력되지 않았습니다. 우측 상단 [API 키 설정]에서 키를 입력해 주세요.');
  }

  onStatus?.(`AI 출제 엔진(${FIXED_GEMINI_MODEL})에서 문항을 설계하고 있습니다...`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    FIXED_GEMINI_MODEL
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      thinkingConfig: {
        thinkingLevel: 'LOW',
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    const json = await res.json();
    const parts: Array<{ text?: string; thought?: boolean }> =
      json?.candidates?.[0]?.content?.parts || [];
    const rawText = parts
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text || '')
      .join('');

    if (!rawText.trim()) {
      throw new Error('AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.');
    }

    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    return JSON.parse(cleaned);
  }

  let errDetail = `HTTP ${res.status}`;
  try {
    const errJson = await res.json();
    errDetail = errJson?.error?.message || errDetail;
  } catch {
    // ignore JSON parse error on error body
  }

  if (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(errDetail)) {
    throw new Error('유효하지 않은 Gemini API 키입니다. 우측 상단 [API 키 설정]에서 키를 다시 확인해 주세요.');
  }
  if (res.status === 429) {
    throw new Error(
      `Gemini API 요청 한도(Quota)를 초과했습니다. 잠시 후 다시 시도해 주세요. (${FIXED_GEMINI_MODEL}: ${errDetail})`
    );
  }
  if (res.status === 503) {
    throw new Error(
      `현재 Gemini 서버 요청이 일시적으로 집중되고 있습니다. 몇 초 후 다시 시도해 주세요. (${FIXED_GEMINI_MODEL})`
    );
  }

  throw new Error(`Gemini API 호출에 실패했습니다 [${FIXED_GEMINI_MODEL}]: ${errDetail}`);
}

export async function testGeminiApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const key = apiKey.trim();
  if (!key) return { ok: false, message: 'API 키를 입력해 주세요.' };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        FIXED_GEMINI_MODEL
      )}?key=${encodeURIComponent(key)}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        message: err?.error?.message || `연결 실패 (HTTP ${res.status})`,
      };
    }
    return {
      ok: true,
      message: `정상 연결됨 (고정 출제 모델: ${FIXED_GEMINI_MODEL} 준비 완료)`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : '네트워크 오류가 발생했습니다.',
    };
  }
}

const ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questionFormat: {
      type: 'STRING',
      description: 'gap_poster | short_kr | short_en | tf_justify | mcq_5 중 하나',
    },
    operationMethod: { type: 'STRING' },
    operationBenefits: { type: 'STRING' },
    operationCautions: { type: 'STRING' },
    achievementStandard: {
      type: 'STRING',
      description: '예: [10공영1-01-01] 말이나 글에 포함된 세부 정보를 파악한다.',
    },
    directive: {
      type: 'STRING',
      description: '대구미래역량교육과정 10대 수행지시어(파악, 분석, 조직, 제시, 묘사, 설명, 요약, 상호작용, 추론, 활용) 중 하나',
    },
    skill: { type: 'STRING' },
    topic: { type: 'STRING' },
    subtopic: { type: 'STRING' },
    expressions: { type: 'ARRAY', items: { type: 'STRING' } },
    structures: { type: 'ARRAY', items: { type: 'STRING' } },
    keyVocab: {
      type: 'STRING',
      description: '대본에 실제 사용된 핵심 어휘 4~6개 (쉼표 구분)',
    },
    taskDescription: {
      type: 'STRING',
      description: '평가 과제 및 문항 구성 한 줄 요약 (예: 교내 진로 멘토링 특강 안내 방송을 듣고, 세부 정보의 빈칸을 완성하는 서답형 1문항)',
    },
    materialType: {
      type: 'STRING',
      description: '듣기 자료 유형_소재범주(세부주제) (예: 담화문(안내 방송)_학교생활/일상(학교행사))',
    },
    transcript: {
      type: 'STRING',
      description: '화자 구분(W:, M:)이 명확한 자연스러운 구어체 영어 듣기 대본. 줄바꿈으로 발화 구분.',
    },
    koreanTranslation: {
      type: 'STRING',
      description: '듣기 대본의 자연스러운 우리말 해석 (여:, 남: 표기)',
    },
    questionPrompt: {
      type: 'STRING',
      description: '학생에게 제시할 발문 ("문항:" 접두어 제외 본문만, 설계표에 지정된 발문 언어 한국어/영어 준수)',
    },
    stimulusTitle: {
      type: 'STRING',
      description: '포스터/안내문/메모/도표/요약문 상자 제목 (예: "[2026 Career Mentoring Day Notice]"). 상자가 불필요하면 빈 문자열 ""',
    },
    stimulusBody: {
      type: 'STRING',
      description: '포스터 빈칸 내용, 서술형 소문항 양식, 또는 객관식 도표((A)~(E) 비교표)·요약문((A),(B) 빈칸 상자) 본문. 불필요하면 빈 문자열 ""',
    },
    options: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: '선택형(mcq_5)일 때 5개의 선택지 텍스트(번호 기호 ①~⑤ 제외, 설계표에 지정된 영어/한국어 보기 언어 및 병렬 구조 엄수). 서답형이면 빈 배열 []',
    },
    isConstructedResponse: { type: 'BOOLEAN' },
    correctChoice: {
      type: 'INTEGER',
      description: '선택형일 때 정답 번호 (1~5). 서답형이면 1',
    },
    modelAnswer: {
      type: 'STRING',
      description: '서답형일 때 모범답안 (예: "(1) (school) auditorium\\n(2) (school) website\\n(3) one[a] question")',
    },
    totalMarks: {
      type: 'INTEGER',
      description: '문항 총 배점 (예: 서답형 3~4점, 선택형 2~3점)',
    },
    rubricRows: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          scoreLabel: { type: 'STRING', description: '예: "3점", "2점", "1점", "0점"' },
          criteria: { type: 'STRING', description: '구체적이고 명확한 세부 채점 기준' },
        },
        required: ['scoreLabel', 'criteria'],
      },
    },
    explanation: {
      type: 'STRING',
      description: '대본 내 정답 단서 문장을 인용한 명확한 출제 의도 및 해설',
    },
  },
  required: [
    'questionFormat',
    'achievementStandard',
    'directive',
    'skill',
    'topic',
    'subtopic',
    'expressions',
    'structures',
    'keyVocab',
    'taskDescription',
    'materialType',
    'transcript',
    'koreanTranslation',
    'questionPrompt',
    'stimulusTitle',
    'stimulusBody',
    'options',
    'isConstructedResponse',
    'correctChoice',
    'modelAnswer',
    'totalMarks',
    'rubricRows',
    'explanation',
  ],
};

function canonicalizeAchievementStandard(
  rawStd: string,
  subjectName: string,
  fallbackText: string
): string {
  const trimmed = rawStd.trim();
  const subjectStandards = getAchievementStandardsForSubject(subjectName);
  if (!trimmed) {
    return fallbackText || subjectStandards[0]?.text || '';
  }
  const exact = subjectStandards.find((s) => s.text === trimmed);
  if (exact) return exact.text;

  // 코드 부분 추출 후 하이픈 오기(예: [12영독-01-01] -> [12영독01-01])까지 정규화하여 교육과정 원문으로 보정
  const codeMatch = trimmed.match(/^\[([^\]]+)\]/);
  if (codeMatch) {
    const rawCode = `[${codeMatch[1].trim()}]`;
    const compactRaw = rawCode.replace(/-/g, '');
    const byCode = subjectStandards.find(
      (s) => s.code === rawCode || s.code.replace(/-/g, '') === compactRaw
    );
    if (byCode) return byCode.text;
  }

  return trimmed;
}

function normalizeGeneratedItem(
  raw: Record<string, unknown>,
  idx: number,
  params: GenerationParams,
  plannedStandardText?: string
): ListeningItem {
  const vocabMeta =
    VOCAB_LEVELS.find((v) => v.id === params.vocabLevelId) || VOCAB_LEVELS[1];

  const rawFmt = String(raw.questionFormat || '') as QuestionFormatType;
  const validFormats: QuestionFormatType[] = [
    'gap_poster',
    'short_kr',
    'short_en',
    'tf_justify',
    'mcq_5',
  ];
  const questionFormat: QuestionFormatType =
    params.mode === 'std'
      ? 'mcq_5'
      : validFormats.includes(rawFmt)
      ? rawFmt
      : params.questionFormats[idx % Math.max(1, params.questionFormats.length)] || 'gap_poster';

  const isConstructed = questionFormat !== 'mcq_5';

  const rawOptions = Array.isArray(raw.options)
    ? raw.options.map((o) => String(o || '').replace(/^[①②③④⑤1-5][.)\s]+/, '').trim())
    : [];
  while (rawOptions.length < 5) rawOptions.push('');

  const rawRubrics = Array.isArray(raw.rubricRows) ? raw.rubricRows : [];
  const rubricRows: RubricRow[] = isConstructed
    ? rawRubrics.length > 0
      ? rawRubrics.map((r: { scoreLabel?: string; criteria?: string }, rIdx: number) => ({
          id: `rub-${Date.now()}-${idx}-${rIdx}`,
          scoreLabel: String(r.scoreLabel || `${Math.max(0, rawRubrics.length - 1 - rIdx)}점`),
          criteria: String(r.criteria || ''),
        }))
      : [
          { id: `rub-${Date.now()}-${idx}-0`, scoreLabel: '3점', criteria: '핵심 요소를 모두 정확하게 작성한 경우' },
          { id: `rub-${Date.now()}-${idx}-1`, scoreLabel: '2점', criteria: '핵심 요소 중 일부만 정확하게 작성한 경우' },
          { id: `rub-${Date.now()}-${idx}-2`, scoreLabel: '1점', criteria: '표면적 정보만 부분적으로 작성한 경우' },
          { id: `rub-${Date.now()}-${idx}-3`, scoreLabel: '0점', criteria: '오답이거나 답안을 작성하지 않은 경우' },
        ]
    : [];

  const transcript = String(raw.transcript || '').trim();
  const actualWords = countTranscriptWords(transcript);

  return {
    id: `item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    itemNo: idx + 1,
    mode: params.mode,
    questionFormat,
    includeOperationGuide: idx === 0 ? params.includeOperationGuide : false,
    operationGuide: {
      method: String(raw.operationMethod || DEFAULT_OPERATION_GUIDE.method),
      benefits: String(raw.operationBenefits || DEFAULT_OPERATION_GUIDE.benefits),
      cautions: String(raw.operationCautions || DEFAULT_OPERATION_GUIDE.cautions),
    },
    gradeSubject: `${params.grade} / ${params.subject}`,
    evalMethod: isConstructed
      ? params.evalPurpose.includes('서답') || params.evalPurpose.includes('수행')
        ? params.evalPurpose
        : '정기시험 혹은 수행평가(서술형/서답형)'
      : params.mode === 'std'
      ? '학교 영어듣기능력평가(5지선다 객관식)'
      : '정기시험(선택형)',
    achievementStandard: canonicalizeAchievementStandard(
      String(raw.achievementStandard || ''),
      params.subject,
      plannedStandardText ||
        params.selectedStandards[0] ||
        getListeningPrimaryStandardsForSubject(params.subject)[0]?.text ||
        ''
    ),
    directive: String(raw.directive || params.selectedDirective || '파악'),
    skill: String(raw.skill || params.selectedSkills[0] || (params.mode === 'ib' ? '세부 정보 파악' : '목적')),
    topic: String(raw.topic || params.selectedTopics[0] || '학교생활'),
    subtopic: String(raw.subtopic || params.selectedSubtopic || '학교 활동'),
    expressions: Array.isArray(raw.expressions)
      ? raw.expressions.map(String)
      : params.selectedExpressions.slice(0, 3),
    structures: Array.isArray(raw.structures)
      ? raw.structures.map(String)
      : params.selectedStructures.slice(0, 2),
    vocabLevelId: params.vocabLevelId,
    vocabLevelLabel: vocabMeta.shortLabel,
    targetWordCount: actualWords || params.targetWordCount,
    keyVocab: String(raw.keyVocab || params.requiredWords || ''),
    difficulty: params.difficulty,
    taskDescription: String(raw.taskDescription || ''),
    materialType: String(raw.materialType || ''),
    source: '자체 제작(AI 생성)',
    transcript,
    koreanTranslation: String(raw.koreanTranslation || ''),
    questionPrompt: String(raw.questionPrompt || '').replace(/^문항\s*[:：]\s*/, '').trim(),
    stimulusTitle: String(raw.stimulusTitle || '').trim(),
    stimulusBody: String(raw.stimulusBody || '').trim(),
    options: rawOptions.slice(0, 5),
    isConstructedResponse: isConstructed,
    correctChoice: Math.min(5, Math.max(1, Number(raw.correctChoice) || 1)),
    modelAnswer: String(raw.modelAnswer || '').trim(),
    totalMarks: Number(raw.totalMarks) || (isConstructed ? 3 : 2),
    rubricRows,
    explanation: String(raw.explanation || '').trim(),
  };
}

interface ItemSlotSpec {
  itemNo: number;
  format: QuestionFormatType;
  standardText: string;
  skill: string;
  directive: string;
  textType: string;
  mcqOptionLang: 'en' | 'ko';
  mcqOptionStyleHint: string;
  mcqPromptLang: 'ko' | 'en';
}

function buildItemSlotPlan(params: GenerationParams): ItemSlotSpec[] {
  const count = Math.max(1, params.itemCount);
  const allSubjectStandards = getAchievementStandardsForSubject(params.subject);
  const primarySubjectStandards = getListeningPrimaryStandardsForSubject(
    params.subject
  );
  const activeStandards: AchievementStandardItem[] =
    params.selectedStandards.length > 0
      ? allSubjectStandards.filter((s) =>
          params.selectedStandards.includes(s.text)
        )
      : primarySubjectStandards;
  const fallbackStandards =
    activeStandards.length > 0 ? activeStandards : primarySubjectStandards;

  // 1) 문항 형식 슬롯 배열 구성
  const formatSlots: QuestionFormatType[] = [];
  if (params.mode === 'std') {
    for (let i = 0; i < count; i++) formatSlots.push('mcq_5');
  } else if (params.questionFormatMode === 'counts' && params.questionFormatCounts) {
    for (const fmtMeta of QUESTION_FORMATS) {
      const n = Number(params.questionFormatCounts[fmtMeta.id] || 0);
      for (let k = 0; k < n && formatSlots.length < count; k++) {
        formatSlots.push(fmtMeta.id);
      }
    }
    const fallbackPool: QuestionFormatType[] =
      params.questionFormats.length > 0
        ? params.questionFormats
        : ['gap_poster', 'short_kr', 'mcq_5'];
    let fIdx = 0;
    while (formatSlots.length < count) {
      formatSlots.push(fallbackPool[fIdx % fallbackPool.length]);
      fIdx++;
    }
  } else {
    const pool: QuestionFormatType[] =
      params.questionFormats.length > 0
        ? params.questionFormats
        : ['gap_poster', 'short_kr', 'mcq_5'];
    for (let i = 0; i < count; i++) {
      formatSlots.push(pool[i % pool.length]);
    }
  }

  // 정기고사 원안 표준 순서(선택형 → 단답형 → 서술형)에 맞춰 슬롯 정렬
  const formatPriority: Record<QuestionFormatType, number> = {
    mcq_5: 0,
    gap_poster: 1,
    short_en: 2,
    short_kr: 3,
    tf_justify: 4,
  };
  formatSlots.sort((a, b) => formatPriority[a] - formatPriority[b]);

  // 2) 성취기준 및 성취기준 맞춤 평가기능(skill) · 수행지시어 매칭
  const allModeSkills = params.mode === 'ib' ? IB_SKILLS : STD_SKILLS;
  const usedAutoSkills = new Set<string>();

  const preliminarySlots = Array.from({ length: count }, (_, i) => {
    const stdItem = fallbackStandards[i % fallbackStandards.length];
    const standardText =
      stdItem?.text ||
      params.selectedStandards[i % Math.max(1, params.selectedStandards.length)] ||
      '';

    let skill: string;
    if (params.selectedSkills.length > 0) {
      skill = params.selectedSkills[i % params.selectedSkills.length];
    } else {
      // 자동 배정: 해당 문항 성취기준에 직결되는 추천 기능을 우선 배정하되, 다문항 시 중복 최소화
      const primaryRec =
        params.mode === 'ib'
          ? stdItem?.recommendedSkillIb || '세부 정보 파악'
          : stdItem?.recommendedSkillStd || '목적';

      if (!usedAutoSkills.has(primaryRec)) {
        skill = primaryRec;
      } else {
        const sameDirAlt = allModeSkills.find(
          (sk) =>
            !usedAutoSkills.has(sk.value) &&
            sk.directive === (stdItem?.directive || '파악')
        );
        const anyAlt = allModeSkills.find((sk) => !usedAutoSkills.has(sk.value));
        skill = sameDirAlt?.value || anyAlt?.value || primaryRec;
      }
      usedAutoSkills.add(skill);
    }

    const matchedSkillMeta = allModeSkills.find((s) => s.value === skill);
    const directive =
      params.selectedDirective ||
      matchedSkillMeta?.directive ||
      stdItem?.directive ||
      '파악';

    return {
      format: formatSlots[i],
      standardText,
      skill,
      matchedSkillMeta,
      directive,
    };
  });

  // 3) 담화·대화 유형 슬롯 배열 구성 (문항 수 및 문항 유형 특성 연동)
  const autoTextCycle = [
    '대화문',
    '담화문(안내 방송)',
    '대화문',
    '담화문(음성 메시지)',
    '대화문',
    '담화문(강연·발표)',
    '인터뷰',
    '토론·의견 교환',
  ];

  const dialogueRequiredSkills = new Set([
    '응답',
    '듣고 응답하기',
    '관계',
    '할일',
    '도표',
    '의견',
  ]);
  const monologuePreferredSkills = new Set([
    '목적',
    '복합(주제+언급안됨)',
  ]);

  const textSlots: string[] = new Array(count).fill('');
  if (params.textTypeMode === 'counts' && params.textTypeCounts) {
    const remainingCounts: Record<string, number> = { ...params.textTypeCounts };

    // 포스터 빈칸 완성형(gap_poster)이 있고 안내방송/강연이 지정되어 있다면 우선 매칭하여 자연스러움 극대화
    for (let i = 0; i < count; i++) {
      if (formatSlots[i] === 'gap_poster') {
        if ((remainingCounts['담화문(안내 방송)'] || 0) > 0) {
          textSlots[i] = '담화문(안내 방송)';
          remainingCounts['담화문(안내 방송)']--;
        } else if ((remainingCounts['담화문(강연·발표)'] || 0) > 0) {
          textSlots[i] = '담화문(강연·발표)';
          remainingCounts['담화문(강연·발표)']--;
        }
      } else if (
        dialogueRequiredSkills.has(preliminarySlots[i].skill) &&
        (remainingCounts['대화문'] || 0) > 0
      ) {
        textSlots[i] = '대화문';
        remainingCounts['대화문']--;
      }
    }

    const flatRest: string[] = [];
    for (const tt of TEXT_TYPES) {
      const c = Number(remainingCounts[tt.id] || 0);
      for (let k = 0; k < c; k++) flatRest.push(tt.id);
    }

    let rIdx = 0;
    let autoIdx = 0;
    for (let i = 0; i < count; i++) {
      if (!textSlots[i]) {
        if (rIdx < flatRest.length) {
          textSlots[i] = flatRest[rIdx++];
        } else {
          textSlots[i] = autoTextCycle[autoIdx++ % autoTextCycle.length];
        }
      }
    }
  } else {
    // 자동 균형 배정: 문항 형식·평가 기능 특성과 인덱스에 맞춰 대화문·담화문이 어색하지 않게 배정
    let autoIdx = 0;
    for (let i = 0; i < count; i++) {
      const fmt = formatSlots[i];
      const sk = preliminarySlots[i].skill;
      if (sk === '상황') {
        textSlots[i] = '담화문(상황 설명)';
      } else if (dialogueRequiredSkills.has(sk)) {
        textSlots[i] = '대화문';
      } else if (fmt === 'gap_poster' || monologuePreferredSkills.has(sk)) {
        textSlots[i] = i % 2 === 0 ? '담화문(안내 방송)' : '담화문(강연·발표)';
      } else if (fmt === 'short_kr' && i % 2 === 1) {
        textSlots[i] = '담화문(음성 메시지)';
      } else {
        let candidate = autoTextCycle[autoIdx++ % autoTextCycle.length];
        if (i > 0 && candidate === textSlots[i - 1] && count > 1) {
          candidate = autoTextCycle[autoIdx++ % autoTextCycle.length];
        }
        textSlots[i] = candidate;
      }
    }
  }

  // 4) 객관식 보기(①~⑤) 언어 및 발문 언어 결정 (기출 유형별 매핑 반영)
  const optionMode = params.mcqOptionLanguage || 'auto';
  const promptMode = params.mcqPromptLanguage || 'ko';
  const englishSkillSet = new Set(
    params.mcqEnglishSkills || getDefaultEnglishOptionSkills()
  );

  return preliminarySlots.map((p, i) => {
    const mcqOptionLang: 'en' | 'ko' =
      optionMode === 'en'
        ? 'en'
        : optionMode === 'ko'
        ? 'ko'
        : p.matchedSkillMeta
        ? englishSkillSet.has(p.matchedSkillMeta.value)
          ? 'en'
          : 'ko'
        : 'ko';

    const mcqOptionStyleHint = p.matchedSkillMeta
      ? mcqOptionLang === 'en'
        ? p.matchedSkillMeta.optionStyleHintEn
        : p.matchedSkillMeta.optionStyleHintKo
      : mcqOptionLang === 'en'
      ? '문법 구조와 길이가 균일한 자연스러운 영어(English) 선택지 5개'
      : '어미와 수준이 균일한 자연스러운 한국어 선택지 5개';

    return {
      itemNo: i + 1,
      format: p.format,
      standardText: p.standardText,
      skill: p.skill,
      directive: p.directive,
      textType: textSlots[i],
      mcqOptionLang,
      mcqOptionStyleHint,
      mcqPromptLang: promptMode,
    };
  });
}

export async function generateListeningItems(
  apiKey: string,
  params: GenerationParams,
  onStatus?: (msg: string) => void
): Promise<ListeningItem[]> {
  const vocabMeta =
    VOCAB_LEVELS.find((v) => v.id === params.vocabLevelId) || VOCAB_LEVELS[1];
  const subjectMeta = getSubjectInfo(params.subject);

  const slotPlan = buildItemSlotPlan(params);

  const uniqueFormats = Array.from(new Set(slotPlan.map((s) => s.format)));
  const formatDescriptions = uniqueFormats
    .map((fid) => {
      const f = QUESTION_FORMATS.find((q) => q.id === fid);
      return f ? `- ${f.id} (${f.label}): ${f.description}` : `- ${fid}`;
    })
    .join('\n');

  const slotBlueprintLines = slotPlan
    .map((slot) => {
      const fmtLabel =
        QUESTION_FORMATS.find((f) => f.id === slot.format)?.shortBadge ||
        slot.format;
      const ttLabel =
        TEXT_TYPES.find((t) => t.id === slot.textType)?.label || slot.textType;
      const mcqSpec =
        slot.format === 'mcq_5'
          ? ` | 발문언어=[${
              slot.mcqPromptLang === 'en' ? '영어(English) 발문' : '한국어 발문'
            }] | 보기(①~⑤)언어=[${
              slot.mcqOptionLang === 'en'
                ? '반드시 영어(English·숫자·기호) 보기'
                : '반드시 한국어 보기'
            } — 형식: ${slot.mcqOptionStyleHint}]`
          : '';
      return `  * ${slot.itemNo}번 문항: 문항형식=[${slot.format} (${fmtLabel})] | 담화·대화유형=[${ttLabel}] | 성취기준=[${slot.standardText}] | 평가기능=${
        params.selectedSkills.length === 0
          ? `[성취기준 맞춤 자동선택 — 추천: ${slot.skill}]`
          : `[${slot.skill}]`
      } | 수행지시어=[${slot.directive}]${mcqSpec}`;
    })
    .join('\n');

  const allModeSkills = params.mode === 'ib' ? IB_SKILLS : STD_SKILLS;
  const activeEnSkillSet = new Set(
    params.mcqEnglishSkills || getDefaultEnglishOptionSkills()
  );
  const modeEnSkillNames = allModeSkills
    .filter((s) => activeEnSkillSet.has(s.value))
    .map((s) => s.value);
  const modeKoSkillNames = allModeSkills
    .filter((s) => !activeEnSkillSet.has(s.value))
    .map((s) => s.value);
  const mcqOptionPolicySummary =
    (params.mcqOptionLanguage || 'auto') === 'en'
      ? '모든 객관식(mcq_5) 문항의 ①~⑤ 선택지를 반드시 영어(English)로 통일하여 작성 (선택지에 한글 혼용 금지)'
      : (params.mcqOptionLanguage || 'auto') === 'ko'
      ? '모든 객관식(mcq_5) 문항의 ①~⑤ 선택지를 반드시 한국어로 통일하여 작성'
      : `기출 유형별 자동 적용 — 영어(숫자·기호) 보기 유형[${
          modeEnSkillNames.join(', ') || '없음'
        }]은 반드시 영어(또는 숫자·도표 기호) 선택지 5개로 작성하고, 한국어 보기 유형[${
          modeKoSkillNames.join(', ') || '없음'
        }]은 반드시 한국어 선택지 5개로 작성`;

  const directiveGuide = params.selectedDirective
    ? `반드시 지정된 수행지시어 「${params.selectedDirective}」(${
        DIRECTIVES.find((d) => d.value === params.selectedDirective)?.description || ''
      })의 사고 과정이 드러나도록 설계하세요.`
    : `각 문항의 성취기준과 평가 기능에 부합하는 대구미래역량교육과정 10대 수행지시어(파악, 분석, 조직, 제시, 묘사, 설명, 요약, 상호작용, 추론, 활용)를 정확히 배정하세요.`;

  const systemInstruction = `당신은 대한민국 대구광역시교육청 '중등 영어듣기 현장지원단' 및 'DELTA(대구형 영어듣기 교수·평가 플랫폼)' 수석 출제위원입니다.
교사가 설정한 평가 유형, 학년/과목, 성취기준, 수행지시어, 소재, 어휘 수준 및 목표 어휘 수에 맞추어 학교 정기고사 및 수행평가에 즉시 투입할 수 있는 최고 품질의 영어듣기 평가 문항 원안을 출제합니다.

[핵심 출제 원칙]
1. 화자 표기 및 담화·대화 유형 엄수:
   - 영어 대본(transcript)의 모든 발화 줄은 반드시 "W: " (여자) 또는 "M: " (남자)로 시작해야 합니다.
   - 각 문항에 지정된 [담화·대화유형]을 엄격히 따르세요:
     * 대화문 / 인터뷰 / 토론·의견 교환: M과 W 두 화자가 자연스럽게 6~10턴 주고받는 구어체 대화로 작성합니다.
     * 담화문(안내 방송) / 담화문(음성 메시지) / 담화문(강연·발표): 단독 화자(W: 또는 M: 중 1명, 문항 간 성별 교차)의 완결된 담화문으로 작성합니다.
2. 어휘 수 및 어휘 수준 엄수 (2022 개정 영어과 교육과정 [별표 3] 반영):
   - 각 문항 대본(transcript)의 영어 단어 수는 화자 기호(W:, M:)를 제외하고 목표 단어 수인 **약 ${params.targetWordCount}단어 (허용 범위: ${Math.max(45, Math.round(params.targetWordCount * 0.88))}~${Math.round(params.targetWordCount * 1.12)}단어)**를 정확히 맞추세요.
   - 어휘 수준: ${vocabMeta.label}${
     subjectMeta
       ? ` (현재 선택 과목 「${subjectMeta.subject}」 [별표 3] 권장 어휘 수: ${subjectMeta.vocabWords.toLocaleString()}단어 이내)`
       : ''
   } — ${vocabMeta.promptGuide}
   - 성취기준 표기: 각 문항의 achievementStandard 필드는 반드시 설계표에 지정된 2022 개정 교육과정 성취기준 원문([코드] 문장)을 글자 하나 바꾸지 않고 그대로 기재하세요.
3. 문항 형식별 필수 구성요소(자료집 표준 서식 준수):
   - gap_poster (안내문·포스터 빈칸 완성형):
     * stimulusTitle에 "[2026 ... Notice]" 등 제목 작성
     * stimulusBody에 Date, Place, How to Sign Up 등 항목과 "(   1   )", "(   2   )", "(   3   )" 형태의 빈칸 2~3개 구성 (단순 받아쓰기가 아니라 대본의 정보 전환/재구성이 일어나도록 패러프레이징 활용)
     * modelAnswer에 "(1) ...\\n(2) ...\\n(3) ..." 작성 및 관사·복수형 허용 범위 병기
     * rubricRows에 3점/2점/1점/0점의 4단계 세부 채점 기준 작성 (핵심 의미 전달 중심, 경미한 철자 오류 허용 여부 명시)
   - short_kr (우리말 의도·이유·핵심 서술형):
     * stimulusBody에 "(1) 화자의 의도(요청 사항):\\n(2) 요청하게 된 이유:" 등 구체적 답안 작성 틀 제시
     * modelAnswer에 각 소항목별 명확한 우리말 모범답안 제시
     * rubricRows에 4점/2점/1점/0점(또는 3점/2점/1점/0점) 다단계 부분점수 채점 기준표 작성
   - short_en (영어 단답·요약형) / tf_justify (T/F 판별 및 근거 서술형):
     * stimulusBody에 요약문 틀 또는 T/F 진술문과 근거 작성란 제시 + 다단계 채점 기준표 작성
   - mcq_5 (5지선다 선택형):
     * 각 문항의 설계표에 명시된 [발문언어]와 [보기(①~⑤)언어] 및 유형별 형식을 100% 엄수하여 options 배열에 5개의 선택지를 작성하세요 (앞에 ①~⑤ 기호는 붙이지 마세요).
     * [반드시 영어(English·숫자·기호) 보기]로 지정된 문항은 options 배열의 5개 선택지를 반드시 영어(숫자 유형은 금액·시각 표기, 도표 유형은 "(A)"~"(E)")로만 작성하며, 선택지 안에 한글 설명을 절대 섞지 마세요.
     * [반드시 한국어 보기]로 지정된 문항은 options 배열의 5개 선택지를 어미와 문장 구조가 균일한 자연스러운 한국어로 작성하세요.
     * 유형별 필수 대본·문항지 구조 규칙:
       - 「응답」 / 「듣고 응답하기」: 대본(transcript)은 두 화자(M, W)의 대화 중 응답 직전 상대방의 마지막 발화에서 끝나야 하며(정답 응답을 대본에 미리 포함하지 말 것), options에 이어질 자연스러운 응답 5개를 제시하세요.
       - 「상황」: 단독 화자(W: 또는 M:)가 두 인물의 상황을 영어로 설명하고 마지막 문장을 반드시 "In this situation, what would [인물 A] most likely say to [인물 B]?"로 끝맺은 뒤, options에 인물 A의 발화 5개를 제시하세요.
       - 「도표」: stimulusTitle과 stimulusBody에 (A)~(E) 5개 후보 항목과 4개 조건 열을 갖춘 영문 표를 작성하고, options는 ["(A)", "(B)", "(C)", "(D)", "(E)"]로 구성하세요.
       - 「핵심 내용 요약」(영어 보기 객관식): stimulusTitle·stimulusBody에 (A), (B) 빈칸이 있는 1~2문장 영어 요약문을 제시하고 options는 "(A) 단어 — (B) 단어" 쌍 5개로 구성하세요.
     * 정기고사 선지 배열 원칙: 5개 선택지는 문법적 병렬 구조를 유지하고, 선택지 길이에 따라 짧은 것에서 긴 순서로 배열하되 숫자·시각·도표 등 논리적 순서가 있는 경우 오름차순으로 배열하세요.
     * 정답이 대본의 특정 문장 하나만 들으면 너무 쉽게 풀리지 않도록 맥락적 단서와 패러프레이징을 활용하고, 오답 매력도를 높이세요.
4. 무결성 검증:
   - 발문(questionPrompt), 대본(transcript), 선택지(options)/모범답안(modelAnswer), 정답 번호(correctChoice), 해설(explanation) 간에 단 하나의 논리적 모순도 없어야 합니다!`;

  const userPrompt = `다음 출제 사양과 **문항별 배정 설계표**에 맞추어 서로 소재와 상황이 겹치지 않는 완성도 높은 영어듣기 문항 **총 ${params.itemCount}문항**을 출제해 주세요.

- 평가 체제: ${
    params.mode === 'ib'
      ? '대구형 영어듣기 평가 (IB·사고력·과정중심 서답형 및 핵심역량 선택형)'
      : '기존 영어듣기능력평가 유형 (전국 시도교육청 공동 주관 스타일 100% 5지선다 객관식)'
  }
- 학교급 / 학년 / 과목: ${params.schoolLevel}등학교 ${params.grade} / ${params.subject}
- 평가 목적: ${params.evalPurpose}
- 문항 형식 상세 지침:
${formatDescriptions}
- [필수 준수] 1번~${params.itemCount}번 문항별 배정 설계표:
${slotBlueprintLines}
- 객관식(5지선다) 보기 및 발문 언어 원칙: ${mcqOptionPolicySummary} / 발문 언어: ${
    (params.mcqPromptLanguage || 'ko') === 'en'
      ? '영어(English) 발문'
      : '한국어 발문 (기출·정기고사 표준)'
  }
- 평가 기능(문항 유형) 배정 원칙: ${
    params.selectedSkills.length === 0
      ? '교사가 [성취기준 맞춤 자동 배정]을 선택했습니다. 각 문항에 배정된 성취기준을 가장 타당하게 평가할 수 있는 평가 기능(skill)을 설계표의 추천 유형을 참고하여 정확히 선택해 출제하세요.'
      : `교사가 지정한 유형(${params.selectedSkills.join(', ')})을 설계표 순서에 맞추어 정확히 출제하세요.`
  }
- 수행지시어 지침: ${directiveGuide}
- 소재 대범주([별표 1]): ${params.selectedTopics.length ? params.selectedTopics.join(', ') : '학교생활, 생태전환(환경), 사회생활, 개인생활, 일반교양 등 문항별로 서로 다른 실생활 밀착 소재 자동 배정'}
${params.selectedSubtopic ? `- 세부 소범주: ${params.selectedSubtopic}` : ''}
${params.customTopicDetail ? `- 교사 지정 구체적 상황/주제: ${params.customTopicDetail}` : ''}
- 대본 목표 단어 수: 지문당 약 ${params.targetWordCount}단어
- 어휘 수준: ${vocabMeta.label}
${params.requiredWords.trim() ? `- 반드시 대본에 자연스럽게 포함할 필수 어휘: ${params.requiredWords}` : ''}
- 목표 난이도: ${params.difficulty}
${params.selectedExpressions.length ? `- 반영할 [별표 2] 의사소통 기능: ${params.selectedExpressions.join(', ')}` : ''}
${params.selectedStructures.length ? `- 반영할 [별표 4] 언어 형식(구문): ${params.selectedStructures.join(', ')}` : ''}
${params.extraInstructions.trim() ? `- 교사 추가 요청사항: ${params.extraInstructions}` : ''}

반드시 JSON 스키마의 items 배열 안에 정확히 ${params.itemCount}개의 문항 객체를 순서대로 담아 반환하세요.`;

  const batchSchema = {
    type: 'OBJECT',
    properties: {
      items: {
        type: 'ARRAY',
        items: ITEM_SCHEMA,
      },
    },
    required: ['items'],
  };

  const parsed = (await callGeminiJson(
    apiKey,
    systemInstruction,
    userPrompt,
    batchSchema,
    onStatus
  )) as { items?: Record<string, unknown>[] };

  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
  if (rawItems.length === 0) {
    throw new Error('생성된 문항 데이터가 없습니다. 파라미터를 확인하고 다시 시도해 주세요.');
  }

  return rawItems.map((raw, idx) => {
    const slot = slotPlan[idx];
    const enrichedRaw: Record<string, unknown> = {
      ...raw,
      questionFormat: raw.questionFormat || slot?.format,
      achievementStandard: raw.achievementStandard || slot?.standardText,
      skill: raw.skill || slot?.skill,
      directive: raw.directive || slot?.directive,
      materialType: raw.materialType || slot?.textType,
    };
    return normalizeGeneratedItem(enrichedRaw, idx, params, slot?.standardText);
  });
}

export async function refineSingleItem(
  apiKey: string,
  currentItem: ListeningItem,
  instruction: string,
  params: GenerationParams,
  onStatus?: (msg: string) => void
): Promise<ListeningItem> {
  const allSkills = [...IB_SKILLS, ...STD_SKILLS];
  const matchedSkill = allSkills.find((s) => s.value === currentItem.skill);
  const englishSkillSet = new Set(
    params.mcqEnglishSkills || getDefaultEnglishOptionSkills()
  );
  const defaultMcqOptLang: 'en' | 'ko' =
    (params.mcqOptionLanguage || 'auto') === 'en'
      ? 'en'
      : (params.mcqOptionLanguage || 'auto') === 'ko'
      ? 'ko'
      : matchedSkill
      ? englishSkillSet.has(matchedSkill.value)
        ? 'en'
        : 'ko'
      : 'ko';

  const systemInstruction = `당신은 대구광역시교육청 중등 영어듣기 출제 전문 AI 보조교사입니다.
교사가 현재 편집 중인 문항 데이터(JSON)를 바탕으로 교사의 수정 요청사항을 정확히 반영하여 개선된 단일 문항 JSON을 반환하세요.
대본(transcript) 수정 시 반드시 화자 표기(W:, M:)를 유지하고, 발문·모범답안·선택지·채점기준·해설·우리말 해석이 수정된 대본과 완벽히 일치하도록 함께 업데이트하세요.
5지선다 선택형(mcq_5)의 경우 교사가 별도로 언어를 지정하지 않았다면 현재 선택지 언어(또는 유형 기본값: ${
    defaultMcqOptLang === 'en' ? '영어 보기' : '한국어 보기'
  })와 병렬 구조, 길이순(또는 논리적 오름차순) 배열 원칙을 유지하세요.`;

  const userPrompt = `[현재 문항 데이터]
${JSON.stringify(
  {
    questionFormat: currentItem.questionFormat,
    gradeSubject: currentItem.gradeSubject,
    achievementStandard: currentItem.achievementStandard,
    directive: currentItem.directive,
    skill: currentItem.skill,
    topic: currentItem.topic,
    subtopic: currentItem.subtopic,
    vocabLevelLabel: currentItem.vocabLevelLabel,
    targetWordCount: currentItem.targetWordCount,
    keyVocab: currentItem.keyVocab,
    taskDescription: currentItem.taskDescription,
    materialType: currentItem.materialType,
    transcript: currentItem.transcript,
    koreanTranslation: currentItem.koreanTranslation,
    questionPrompt: currentItem.questionPrompt,
    stimulusTitle: currentItem.stimulusTitle,
    stimulusBody: currentItem.stimulusBody,
    options: currentItem.options,
    isConstructedResponse: currentItem.isConstructedResponse,
    correctChoice: currentItem.correctChoice,
    modelAnswer: currentItem.modelAnswer,
    totalMarks: currentItem.totalMarks,
    rubricRows: currentItem.rubricRows,
    explanation: currentItem.explanation,
  },
  null,
  2
)}

[교사 수정/재출제 요청사항]
${instruction || '동일한 성취기준과 형식을 유지하되 새로운 상황과 대본으로 재출제해 주세요.'}`;

  const raw = (await callGeminiJson(
    apiKey,
    systemInstruction,
    userPrompt,
    ITEM_SCHEMA,
    onStatus
  )) as Record<string, unknown>;

  const normalized = normalizeGeneratedItem(
    raw,
    currentItem.itemNo - 1,
    params,
    currentItem.achievementStandard
  );
  return {
    ...normalized,
    id: currentItem.id,
    itemNo: currentItem.itemNo,
    includeOperationGuide: currentItem.includeOperationGuide,
    operationGuide: currentItem.operationGuide,
  };
}

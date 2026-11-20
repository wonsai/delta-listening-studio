import {
  DifficultyLevel,
  GenerationParams,
  ListeningItem,
  QuestionFormatType,
  RubricRow,
  VocabLevelId,
} from '../types/assessment';
import {
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
import {
  formatReferenceExamplesForPrompt,
  selectReferenceExamples,
} from '../data/pastItemsDb';
import { DEFAULT_OPERATION_GUIDE } from '../data/sampleItems';
import {
  ItemValidationReport,
  buildAutoFixPromptFromReport,
  validateListeningItem,
} from './itemValidator';
import { buildItemSlotPlan } from './slotPlanner';
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

const GEMINI_MODEL_PRIORITY = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3-flash',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
];

let cachedWorkingModel: string | null = null;
let cachedDiscoveredKey = '';
let cachedDiscoveredModels: string[] | null = null;

async function discoverAvailableModels(
  apiKey: string,
  externalSignal?: AbortSignal
): Promise<string[]> {
  if (cachedDiscoveredModels && cachedDiscoveredKey === apiKey) {
    return cachedDiscoveredModels;
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(
        apiKey
      )}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);

    if (!res.ok) {
      return GEMINI_MODEL_PRIORITY;
    }
    const json = (await res.json()) as {
      models?: Array<{
        name?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    const rawList = Array.isArray(json?.models) ? json.models : [];
    const usable = rawList
      .filter((m) => {
        const methods = m.supportedGenerationMethods || [];
        if (!methods.includes('generateContent')) return false;
        const id = String(m.name || '').replace(/^models\//, '');
        if (!/^gemini-/i.test(id)) return false;
        if (
          /tts|image|embedding|live|audio|robotics|computer-use|aqa|veo|imagen|gemma|learnlm|vision|exp-0827/i.test(
            id
          )
        ) {
          return false;
        }
        return true;
      })
      .map((m) => String(m.name || '').replace(/^models\//, ''));

    if (usable.length === 0) {
      return GEMINI_MODEL_PRIORITY;
    }

    const usableSet = new Set(usable);
    const ordered: string[] = [];

    // 1) 우선순위 리스트 중 실제 계정에 존재하는 모델 우선 배치
    for (const pref of GEMINI_MODEL_PRIORITY) {
      if (usableSet.has(pref)) {
        ordered.push(pref);
        usableSet.delete(pref);
      }
    }
    // 2) 나머지 Flash 계열 모델 추가 (버전 내림차순)
    const remainingFlash = Array.from(usableSet)
      .filter((id) => /flash/i.test(id))
      .sort()
      .reverse();
    for (const id of remainingFlash) {
      ordered.push(id);
      usableSet.delete(id);
    }
    // 3) 혹시 Flash가 없을 경우 Pro 계열도 예비로 포함
    if (ordered.length === 0) {
      ordered.push(...Array.from(usableSet).slice(0, 3));
    }

    cachedDiscoveredKey = apiKey;
    cachedDiscoveredModels = ordered;
    return ordered;
  } catch {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
    return GEMINI_MODEL_PRIORITY;
  }
}

async function getOrderedModelCandidates(
  apiKey: string,
  externalSignal?: AbortSignal
): Promise<string[]> {
  const discovered = await discoverAvailableModels(apiKey, externalSignal);
  if (!cachedWorkingModel || !discovered.includes(cachedWorkingModel)) {
    return discovered;
  }
  return [
    cachedWorkingModel,
    ...discovered.filter((m) => m !== cachedWorkingModel),
  ];
}

function buildThinkingConfigForModel(
  model: string,
  useThinking: boolean
): Record<string, unknown> | undefined {
  if (!useThinking) return undefined;
  // Gemini 3.x / 4.x: 구조화 JSON(responseSchema) 대량 생성 시 LOW가 속도와 품질 균형이 최적
  if (/^gemini-(?:3|4)/.test(model)) {
    return { thinkingLevel: 'LOW' };
  }
  // Gemini 2.5: thinkingLevel 대신 thinkingBudget 사용 (0으로 지연 최소화)
  if (/^gemini-2\.5/.test(model)) {
    return { thinkingBudget: 0 };
  }
  return undefined;
}

function parseGeminiJsonText(rawText: string): unknown {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error(
      'AI 응답 JSON 형식이 완전하지 않습니다. 문항 수를 줄이거나 잠시 후 다시 시도해 주세요.'
    );
  }
}

async function callSingleGeminiModel(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: Record<string, unknown>,
  useThinking: boolean,
  externalSignal?: AbortSignal
): Promise<
  | { ok: true; data: unknown }
  | {
      ok: false;
      status: number;
      detail: string;
      isInvalidKey?: boolean;
      isTruncated?: boolean;
      isUserAborted?: boolean;
    }
> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    responseSchema,
    maxOutputTokens: 16384,
  };
  const thinkingConfig = buildThinkingConfigForModel(model, useThinking);
  if (thinkingConfig) {
    generationConfig.thinkingConfig = thinkingConfig;
  }

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
    generationConfig,
  };

  if (externalSignal?.aborted) {
    return {
      ok: false,
      status: 499,
      detail: '사용자가 출제를 중지했습니다.',
      isUserAborted: true,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 45000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
    if (externalSignal?.aborted) {
      return {
        ok: false,
        status: 499,
        detail: '사용자가 출제를 중지했습니다.',
        isUserAborted: true,
      };
    }
    if (timedOut || (err instanceof DOMException && err.name === 'AbortError')) {
      return {
        ok: false,
        status: 408,
        detail: `${model} 응답이 45초를 초과하여 시간 초과되었습니다.`,
      };
    }
    return {
      ok: false,
      status: 0,
      detail: err instanceof Error ? err.message : '네트워크 연결에 실패했습니다.',
    };
  }
  clearTimeout(timeoutId);
  externalSignal?.removeEventListener('abort', onExternalAbort);

  if (res.ok) {
    const json = await res.json();
    const candidate = json?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const parts: Array<{ text?: string; thought?: boolean }> =
      candidate?.content?.parts || [];
    const rawText = parts
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text || '')
      .join('');

    if (!rawText.trim()) {
      return {
        ok: false,
        status: 500,
        detail:
          finishReason && finishReason !== 'STOP'
            ? `AI 응답이 중단되었습니다 (사유: ${finishReason}).`
            : 'AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.',
      };
    }

    try {
      const parsed = parseGeminiJsonText(rawText);
      return { ok: true, data: parsed };
    } catch (parseErr) {
      return {
        ok: false,
        status: 500,
        isTruncated: finishReason === 'MAX_TOKENS',
        detail:
          finishReason === 'MAX_TOKENS'
            ? '생성 분량이 길어 응답이 중간에 잘렸습니다. 출제 문항 수를 줄여 다시 시도해 주세요.'
            : parseErr instanceof Error
            ? parseErr.message
            : 'AI 응답을 해석하지 못했습니다.',
      };
    }
  }

  let errDetail = `HTTP ${res.status}`;
  try {
    const errJson = await res.json();
    errDetail = errJson?.error?.message || errDetail;
  } catch {
    // ignore JSON parse error on error body
  }

  const isInvalidKey =
    (res.status === 400 || res.status === 403) &&
    /API key not valid|API_KEY_INVALID|API key expired|PERMISSION_DENIED/i.test(errDetail);

  return {
    ok: false,
    status: res.status,
    detail: errDetail,
    isInvalidKey,
  };
}

async function callGeminiJson(
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: Record<string, unknown>,
  onStatus?: (msg: string) => void,
  externalSignal?: AbortSignal
): Promise<unknown> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error('Gemini API 키가 입력되지 않았습니다. 우측 상단 [API 키 설정]에서 키를 입력해 주세요.');
  }

  onStatus?.('사용 가능한 최신 Gemini 출제 모델을 확인하는 중...');
  const candidates = await getOrderedModelCandidates(key, externalSignal);
  const errors: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    onStatus?.(
      i === 0
        ? `AI 출제 엔진(${model})에서 문항을 설계하고 있습니다...`
        : `${candidates[i - 1]} 지연/불가 → 대체 엔진(${model})으로 전환하여 출제 중...`
    );

    let attempt = await callSingleGeminiModel(
      key,
      model,
      systemInstruction,
      userPrompt,
      responseSchema,
      true,
      externalSignal
    );

    if (!attempt.ok && attempt.isUserAborted) {
      throw new Error('AI 자동 출제가 취소되었습니다.');
    }

    // thinkingConfig / thinkingLevel 미지원 400 오류 시 thinkingConfig 제외 후 동일 모델 즉시 재시도
    if (
      !attempt.ok &&
      attempt.status === 400 &&
      !attempt.isInvalidKey &&
      /thinking|budget|level|unknown name/i.test(attempt.detail)
    ) {
      attempt = await callSingleGeminiModel(
        key,
        model,
        systemInstruction,
        userPrompt,
        responseSchema,
        false,
        externalSignal
      );
      if (!attempt.ok && attempt.isUserAborted) {
        throw new Error('AI 자동 출제가 취소되었습니다.');
      }
    }

    if (attempt.ok) {
      cachedWorkingModel = model;
      return attempt.data;
    }

    if (attempt.isInvalidKey) {
      throw new Error(
        '유효하지 않거나 만료된 Gemini API 키입니다. 우측 상단 [API 키 설정]에서 키를 다시 확인해 주세요.'
      );
    }

    if (attempt.isTruncated) {
      throw new Error(attempt.detail);
    }

    errors.push(`${model}: ${attempt.detail}`);

    // 404(모델 미지원), 408(시간 초과), 429(한도 초과), 503(과부하), 400/500 시 다음 모델로 자동 폴백
    const canFallback =
      attempt.status === 404 ||
      attempt.status === 408 ||
      attempt.status === 429 ||
      attempt.status === 503 ||
      attempt.status === 400 ||
      attempt.status === 500;

    if (!canFallback) {
      throw new Error(`Gemini API 호출에 실패했습니다 [${model}]: ${attempt.detail}`);
    }
  }

  const lastError = errors[errors.length - 1] || '알 수 없는 오류';
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(errors.join(' '))) {
    throw new Error(
      `Gemini API 요청 한도(Quota)를 초과했습니다. 잠시 후 다시 시도해 주세요. (${lastError})`
    );
  }
  throw new Error(`Gemini API 호출에 실패했습니다: ${lastError}`);
}

export async function testGeminiApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const key = apiKey.trim();
  if (!key) return { ok: false, message: 'API 키를 입력해 주세요.' };
  try {
    let lastErr = '';
    const candidates = await getOrderedModelCandidates(key);
    for (const model of candidates) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}?key=${encodeURIComponent(key)}`
      );
      if (res.ok) {
        cachedWorkingModel = model;
        return {
          ok: true,
          message: `정상 연결됨 (출제 모델: ${model} 준비 완료)`,
        };
      }
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${res.status}`;
      if (res.status === 400 || res.status === 403) {
        return {
          ok: false,
          message: msg,
        };
      }
      lastErr = `${model}: ${msg}`;
    }
    return {
      ok: false,
      message: lastErr || '사용 가능한 Gemini 출제 모델을 찾지 못했습니다.',
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
      description: 'ib_mcq_3 | gap_poster | ib_multi_true | short_en | ib_speaker_match | ib_match_info | tf_justify | ib_order | short_kr | mcq_5 중 하나',
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
      description: '포스터/안내문/메모/도표/체크표/진술문/요약문 상자 제목 (예: "[2026 Career Mentoring Day Notice]"). 상자가 불필요하면 빈 문자열 ""',
    },
    stimulusBody: {
      type: 'STRING',
      description: '포스터·노트 빈칸([–1–]~[–3–]), 참인 진술 복수선택(A~E/A~J), 화자 매칭 표, 순서 배열 항목, 서술형 소문항 양식, 또는 객관식 도표((A)~(E) 비교표) 본문. 불필요하면 빈 문자열 ""',
    },
    options: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: '선택형일 때 선택지 텍스트 배열 (ib_mcq_3이면 3개 A/B/C 텍스트, mcq_5이면 5개 ①~⑤ 텍스트 — 앞에 A./B./C. 또는 ①~⑤ 기호 제외, 설계표에 지정된 보기 언어 및 병렬 구조 엄수). 서답형이면 빈 배열 []',
    },
    isConstructedResponse: { type: 'BOOLEAN' },
    correctChoice: {
      type: 'INTEGER',
      description: '선택형일 때 정답 번호 (ib_mcq_3이면 1~3 [1=A, 2=B, 3=C], mcq_5이면 1~5). 서답형이면 1',
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

  // 코드 부분 추출 후 하이픈 오기(예: [12직영-01-01] -> [12직영01-01])까지 정규화하여 교육과정 원문으로 보정
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
    'ib_mcq_3',
    'gap_poster',
    'ib_multi_true',
    'short_en',
    'ib_speaker_match',
    'ib_match_info',
    'tf_justify',
    'ib_order',
    'short_kr',
    'mcq_5',
  ];
  const questionFormat: QuestionFormatType =
    params.mode === 'std'
      ? 'mcq_5'
      : validFormats.includes(rawFmt)
      ? rawFmt
      : params.questionFormats[idx % Math.max(1, params.questionFormats.length)] || 'ib_mcq_3';

  const isConstructed = questionFormat !== 'mcq_5' && questionFormat !== 'ib_mcq_3';
  const optionCount = questionFormat === 'ib_mcq_3' ? 3 : 5;

  const rawOptions = Array.isArray(raw.options)
    ? raw.options.map((o) =>
        String(o || '')
          .replace(/^(?:[①②③④⑤1-5]|[A-Ea-e])[.)\s]+/, '')
          .trim()
      )
    : [];
  while (rawOptions.length < optionCount) rawOptions.push('');

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
      ? '수능형 영어듣기평가(5지선다 객관식)'
      : questionFormat === 'ib_mcq_3'
      ? '대구형(IB) 영어듣기 평가(3지선다 선택형)'
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
    options: rawOptions.slice(0, optionCount),
    isConstructedResponse: isConstructed,
    correctChoice: Math.min(optionCount, Math.max(1, Number(raw.correctChoice) || 1)),
    modelAnswer: String(raw.modelAnswer || '').trim(),
    totalMarks: Number(raw.totalMarks) || (isConstructed ? 3 : 2),
    rubricRows,
    explanation: String(raw.explanation || '').trim(),
  };
}

export async function generateListeningItems(
  apiKey: string,
  params: GenerationParams,
  onStatus?: (msg: string) => void,
  signal?: AbortSignal
): Promise<ListeningItem[]> {
  const vocabMeta =
    VOCAB_LEVELS.find((v) => v.id === params.vocabLevelId) || VOCAB_LEVELS[1];
  const subjectMeta = getSubjectInfo(params.subject);

  const slotPlan = buildItemSlotPlan(params);

  const buildBlueprintLines = (slots: typeof slotPlan) =>
    slots
      .map((slot) => {
        const fmtLabel =
          QUESTION_FORMATS.find((f) => f.id === slot.format)?.shortBadge ||
          slot.format;
        const ttLabel =
          TEXT_TYPES.find((t) => t.id === slot.textType)?.label || slot.textType;
        const stdMeta =
          params.mode === 'std'
            ? STD_SKILLS.find((s) => s.value === slot.skill)
            : undefined;
        const skillTag = stdMeta
          ? `[수능 ${stdMeta.csatNo} ${stdMeta.label || stdMeta.value}${
              stdMeta.csatPart === '간접 말하기' ? ' · 간접 말하기' : ''
            }]`
          : params.selectedSkills.length === 0
          ? `[성취기준 맞춤 자동선택 — 추천: ${slot.skill}]`
          : `[${slot.skill}]`;
        const isMcq = slot.format === 'mcq_5' || slot.format === 'ib_mcq_3';
        const choiceTag =
          slot.format === 'ib_mcq_3' ? '보기(A~C 3지선다)' : '보기(①~⑤ 5지선다)';
        const mcqSpec = isMcq
          ? ` | 발문언어=[${
              slot.mcqPromptLang === 'en' ? '영어(English) 발문' : '한국어 발문'
            }] | ${choiceTag}언어=[${
              slot.mcqOptionLang === 'en'
                ? '반드시 영어(English·숫자·기호) 보기'
                : '반드시 한국어 보기'
            } — 형식: ${slot.mcqOptionStyleHint}]`
          : '';
        return `  * ${slot.itemNo}번 문항: 문항형식=[${slot.format} (${fmtLabel})] | 담화·대화유형=[${ttLabel}] | 성취기준=[${slot.standardText}] | 평가기능=${skillTag} | 수행지시어=[${slot.directive}]${mcqSpec}`;
      })
      .join('\n');

  const allModeSkills = params.mode === 'ib' ? IB_SKILLS : STD_SKILLS;
  const activeEnSkillSet = new Set(
    params.mcqEnglishSkills || getDefaultEnglishOptionSkills()
  );
  const modeEnSkillNames = allModeSkills
    .filter((s) => activeEnSkillSet.has(s.value))
    .map((s) => (s.csatNo ? `${s.csatNo} ${s.label || s.value}` : s.value));
  const modeKoSkillNames = allModeSkills
    .filter((s) => !activeEnSkillSet.has(s.value))
    .map((s) => (s.csatNo ? `${s.csatNo} ${s.label || s.value}` : s.value));
  const mcqOptionPolicySummary =
    (params.mcqOptionLanguage || 'auto') === 'en'
      ? '모든 객관식(mcq_5 / ib_mcq_3) 문항의 선택지를 반드시 영어(English)로 통일하여 작성 (선택지에 한글 혼용 금지)'
      : (params.mcqOptionLanguage || 'auto') === 'ko'
      ? '모든 객관식(mcq_5 / ib_mcq_3) 문항의 선택지를 반드시 한국어로 통일하여 작성'
      : `기출 유형별 자동 적용 — IB 3지선다(ib_mcq_3)는 기본 영어 A/B/C 보기, 5지선다(mcq_5) 중 영어(숫자·기호) 보기 유형[${
          modeEnSkillNames.join(', ') || '없음'
        }]은 반드시 영어(또는 숫자·도표 기호) 선택지로 작성하고, 한국어 보기 유형[${
          modeKoSkillNames.join(', ') || '없음'
        }]은 반드시 한국어 선택지로 작성`;

  const directiveGuide = params.selectedDirective
    ? `반드시 지정된 수행지시어 「${params.selectedDirective}」(${
        DIRECTIVES.find((d) => d.value === params.selectedDirective)?.description || ''
      })의 사고 과정이 드러나도록 설계하세요.`
    : `각 문항의 성취기준과 평가 기능에 부합하는 대구미래역량교육과정 10대 수행지시어(파악, 분석, 조직, 제시, 묘사, 설명, 요약, 상호작용, 추론, 활용)를 정확히 배정하세요.`;

  const difficultyGuide = buildDifficultyListeningGuide(
    params.difficulty,
    params.vocabLevelId
  );

  const selectedRefs = selectReferenceExamples(
    slotPlan.map((s) => ({
      mode: params.mode,
      schoolLevel: params.schoolLevel,
      format: s.format,
      skill: s.skill,
      textType: s.textType,
      difficulty: params.difficulty,
      vocabLevelId: params.vocabLevelId,
    })),
    2
  );
  const referenceBlock = formatReferenceExamplesForPrompt(selectedRefs);

  const systemInstruction = `당신은 대한민국 대구광역시교육청 'DELTA(대구형 영어듣기 교수·평가 플랫폼)' 수석 출제위원이자, IB DP English B Paper 2 · 대학수학능력시험 영어 듣기 출제 전문가 및 원어민 영어듣기 대본 감수자입니다.
교사가 설정한 평가 유형, 학년/과목, 성취기준, 수행지시어, 소재, 어휘 수준 및 목표 어휘 수에 맞추어 학교 정기고사 및 수행평가에 즉시 투입할 수 있는 최고 품질의 영어듣기 평가 문항 원안을 출제합니다.

[절대 준수 원칙 A · 원어민 자연 구어체(Natural Spoken English) & 직역 금지]
- 영어 대본(transcript)은 읽기 지문이 아니라, 실제 영어권 원어민이 일상·학교·방송에서 **소리 내어 말하는 구어체**로 작성합니다.
- 한국어 교육과정 용어·기관명·추상 개념을 문어체 영어로 직역(Translationese)하지 마세요:
  * ❌ meteorological center / agency (기상청 직역) → ✅ weather forecast / weather service / the news
  * ❌ ecological transition (생태전환 직역) → ✅ going green / eco-friendly habits / protecting the environment
  * ❌ democratic citizenship (민주시민 직역) → ✅ being a responsible citizen / following community rules
  * ❌ inclement weather / precipitation → ✅ bad weather / heavy rain
  * ❌ 일상 대화 속 문어체·라틴어계 저빈도 어휘(utilize, commence, relocate, rectify, alleviate, ameliorate, disseminate, refrain from, prior to, subsequently, furthermore, moreover, exacerbate, detrimental, ubiquitous 등) → ✅ 일상 구어(use, start, move, fix, reduce, improve, share, avoid, before, then, also, make worse, harmful, everywhere)
- 대화문(대화문·인터뷰·토론)에서는 축약형(I'm, don't, we've, it's, won't)과 자연스러운 구어 반응(Really?, Sounds great!, Wait a minute, Actually, That makes sense 등)을 적극 사용하세요.
- 난이도 조절은 '듣기에 지나치게 어려운 전문 용어'로 하지 말고, 맥락 추론·패러프레이징·오답 설계로 조절하세요.

[절대 준수 원칙 B · 듣기 평가 전용(Audio-Only) 타당도 — 읽기 문형 금지]
- 시험 현장에서 **학생에게는 영어 대본(transcript)이 절대 인쇄·제공되지 않습니다.** 학생은 오직 **음성만 1~2회 듣고** 문제를 풉니다.
- 따라서 학생이 보게 되는 **발문(questionPrompt), 안내문/포스터(stimulusTitle·stimulusBody), 선택지(options)** 어디에도 읽기 평가 표현을 절대 쓰지 마세요:
  * ❌ 절대 금지 표현: "대본을 보고", "대본에서 찾아 쓰시오", "대본의 내용을 참고하여", "지문을 보고/읽고", "지문에서 찾아", "윗글", "다음 글을 읽고", "본문에서", "밑줄 친", "그대로 옮겨 쓰시오", "Read the transcript/script/dialogue/passage", "Find in the script"
  * ✅ 올바른 표현: "대화를 듣고, ...", "다음 안내 방송을 듣고, ...", "다음 음성 메시지를 듣고, ...", "들은 내용을 바탕으로 ...", "Listen to the dialogue/announcement and ..."
- 서답형 문항(ib_multi_true, ib_speaker_match, ib_match_info, gap_poster, short_en, tf_justify, ib_order, short_kr)은 학생이 귀로 듣고 노트테이킹·기억할 수 있는 핵심 정보(날짜, 장소, 행동, 의도, 이유, 관점 등)만 물어야 하며, 철자가 지나치게 까다로운 저빈도 고유명사나 긴 원문 문장 그대로 받아쓰기를 요구하지 마세요.

[핵심 출제 원칙]
1. 화자 표기 및 담화·대화 유형 엄수:
   - 영어 대본(transcript)의 모든 발화 줄은 반드시 "W: " (여자) 또는 "M: " (남자)로 시작해야 합니다.
   - 각 문항에 지정된 [담화·대화유형]을 엄격히 따르세요:
     * 대화문 / 인터뷰 / 토론·의견 교환: M과 W 두 화자가 자연스럽게 6~10턴 주고받는 구어체 대화로 작성합니다 (수능 11~12번 짧은응답은 3~4턴, 13~14번 긴응답은 7~10턴).
     * 담화문(안내 방송) / 담화문(음성 메시지) / 담화문(강연·발표) / 담화문(상황 설명): 단독 화자(W: 또는 M: 중 1명, 문항 간 성별 교차)의 완결된 담화문으로 작성합니다.
2. 어휘 수·어휘 수준 및 난이도 기준 엄수 (2022 개정 영어과 교육과정 [별표 3] 반영):
   - 각 문항 대본(transcript)의 영어 단어 수는 화자 기호(W:, M:)를 제외하고 목표 단어 수인 **약 ${params.targetWordCount}단어 (허용 범위: ${Math.max(45, Math.round(params.targetWordCount * 0.88))}~${Math.round(params.targetWordCount * 1.12)}단어)**를 정확히 맞추세요.
   - 어휘 수준: ${vocabMeta.label}${
     subjectMeta
       ? ` (현재 선택 과목 「${subjectMeta.subject}」 [별표 3] 권장 어휘 수: ${subjectMeta.vocabWords.toLocaleString()}단어 이내)`
       : ''
   } — ${vocabMeta.promptGuide}
   - 난이도 세부 지침(${params.difficulty}): ${difficultyGuide}
   - 성취기준 표기: 각 문항의 achievementStandard 필드는 반드시 설계표에 지정된 2022 개정 교육과정 성취기준 원문([코드] 문장)을 글자 하나 바꾸지 않고 그대로 기재하세요.
3. 문항 형식별 필수 구성요소 (IB DP English B Paper 2 기출 공식 규격 · IB 확장 서답형 · 수능 영어 듣기 1~17번 공식 규격 준수):
   [A. IB DP English B Paper 2 Listening 공식 기출 핵심 유형 6종]
   - ib_mcq_3 (IB 3지선다 선택형 — Choose the correct answer):
     * IB Paper 2 표준에 따라 options 배열에 **정확히 3개의 선택지**(A, B, C에 해당, 앞에 A./B./C. 기호는 붙이지 말 것)를 작성하고 correctChoice는 1~3(1=A, 2=B, 3=C)으로 지정하세요.
     * questionPrompt는 "Choose the correct answer." 안내와 함께 간결한 질문 또는 문장 완성형 줄기(예: "The speaker explains that the new schedule...")를 제시하세요.
     * 3개 선지는 문법적 병렬 구조와 유사한 길이를 유지하며, 단순 어휘 일치가 아닌 패러프레이징·화자 태도·함축 추론을 평가하도록 오답 매력도를 높이세요.
   - gap_poster (IB 노트·표·안내문 빈칸 완성형 — Complete the gaps, ≤3 words):
     * questionPrompt에 IB 3단어 제한 규칙("Complete the following gaps. Use no more than three words for each gap." 또는 한국어 병기)을 명시하세요.
     * stimulusTitle에 "[2026 ... Notice / Notes]" 등 제목을 쓰고, stimulusBody에 항목별 메모·안내문·요약표와 "[–1–]", "[–2–]", "[–3–]" 형태의 빈칸 3개를 구성하세요 (학생이 귀로 듣고 노트테이킹 가능한 친숙한 영어 어구로 정답 설계, 패러프레이징 활용).
     * modelAnswer에 IB Markscheme 표기법으로 선택 허용 단어는 괄호(), 대체 정답은 슬래시(/)로 병기하세요 (예: "(1) (school) auditorium / main hall\\n(2) (online) form\\n(3) bring one question").
     * rubricRows에 3점/2점/1점/0점의 4단계 세부 채점 기준 작성 (최고 점수는 totalMarks와 일치, 3단어 초과 시 오답 처리, 의미 전달을 해치지 않는 경미한 철자 오류 허용 여부 명시).
   - ib_multi_true (IB 참인 진술 복수 선택형 — Choose the true statements):
     * questionPrompt에 "Choose the two [또는 four] true statements."(또는 한국어 병기)를 명확히 지시하세요.
     * stimulusTitle에 "[True Statements]" 등 제목을 쓰고, stimulusBody에 A.~E.(참 2개) 또는 A.~H.(참 4개)의 영문 진술문 목록을 "[  ] A. ..." 형태로 제시하세요.
     * modelAnswer에 정답 알파벳만 명확히 기재(예: "B, D" 또는 "A, C, E, G")하고, rubricRows에 맞춘 개수당 1점 기준의 부분점수 채점 기준표(최고 점수는 totalMarks와 일치, 초과 선택 감점 유의사항 포함)를 작성하세요.
   - short_en (IB 영어 단답형 — Answer the following questions):
     * questionPrompt에 "Answer the following questions."(또는 한국어 병기)를 쓰고, stimulusBody에 2~3개의 구체적 Wh-질문("(1) ...?\\n(2) ...?")을 제시하세요.
     * modelAnswer에 각 소문항별 IB Markscheme 스타일 모범답안(Target / Accept / Do not accept 및 괄호 허용 어구 병기)을 작성하고, rubricRows에 다단계 채점 기준표(최고 점수는 totalMarks와 일치, 의미를 해치지 않는 경미한 철자·문법 오류 허용 및 핵심 수식어 누락 불허 명시)를 작성하세요.
   - ib_speaker_match (IB 화자·관점 매칭 체크표 — Whose opinion?):
     * 반드시 두 화자(M, W — 대본에 이름 또는 역할 명시)가 의견·관점·경험을 나누는 대화·인터뷰·토론으로 대본을 작성하세요.
     * questionPrompt에 "Tick [✓] one correct option for each statement." 등 지시문을 쓰고, stimulusTitle에 "[Whose opinion is it?]" 등 제목을 작성하세요.
     * stimulusBody에 3~4개 진술문과 열 구분 표(예: "Statement | Speaker A (M) | Speaker B (W) | Both"와 각 행)를 제시하세요.
     * modelAnswer에 각 번호별 정답 화자(예: "(1) Speaker A  (2) Both  (3) Speaker B")를 기재하고 rubricRows에 항목당 1점 채점 기준표(최고 점수는 totalMarks와 일치)를 작성하세요.
   - ib_match_info (IB 정보·문장 연결 매칭형 — Matching with extra distractors):
     * questionPrompt에 "Match each item/first half (1–4) with the correct description/ending (A–F). There are two extra options you do not need."(또는 한국어 병기)를 명확히 지시하세요.
     * stimulusTitle에 "[Match the Information / Sentence Halves]" 등 제목을 쓰고, stimulusBody에 좌측 항목 (1)~(4)와 우측 보기 A.~F.(정답 4개 + 여분 오답 2개)를 깔끔하게 구분하여 제시하세요.
     * modelAnswer에 각 번호별 정답 알파벳(예: "(1) C  (2) A  (3) F  (4) D")을 명확히 기재하고, rubricRows에 항목당 1점 기준의 부분점수 채점 기준표(최고 점수는 totalMarks와 일치)를 작성하세요.
   [B. IB 확장 · 대구형 사고력 서답 유형 3종]
   - tf_justify (진위(T/F) 판별 및 근거 서술형):
     * stimulusTitle에 "[True / False & Justification]" 등 제목을 쓰고, stimulusBody에 2~3개의 진술문과 "(True / False) — Justification:" 작성란을 제시하세요.
     * modelAnswer에 각 문항의 T/F 판정과 대본 기반 핵심 근거(Justification)를 함께 제시하고, rubricRows에 판정+근거 결합 채점 기준표(최고 점수는 totalMarks와 일치, 판정만 맞고 근거가 틀린 경우 부분/0점 기준 명시)를 작성하세요.
   - ib_order (사건·절차 순서 배열형 — Put the events/steps in order):
     * stimulusTitle에 "[Order the Events / Steps]" 등 제목을 쓰고, stimulusBody에 대본 속 사건·절차 4~5개를 무작위 순서로 섞어 "(A) ...\\n(B) ...\\n(C) ...\\n(D) ..." 형태로 제시하세요.
     * modelAnswer에 올바른 순서(예: "(C) → (A) → (D) → (B)")를 제시하고, rubricRows에 부분점수 채점 기준표(최고 점수는 totalMarks와 일치)를 작성하세요.
   - short_kr (대구형 우리말 의도·이유·함축 서술형):
     * stimulusBody에 "(1) 화자의 의도(요청 사항):\\n(2) 요청하게 된 이유:" 등 구체적 우리말 답안 작성 틀을 제시하세요.
     * modelAnswer에 각 소항목별 명확한 우리말 모범답안을 제시하고, rubricRows에 4점/2점/1점/0점(또는 3점/2점/1점/0점) 다단계 부분점수 채점 기준표(최고 점수는 totalMarks와 일치)를 작성하세요.
   [C. 기존 영어듣기 유형 — 대학수학능력시험(수능) 영어 듣기 1~17번 5지선다]
   - mcq_5 (5지선다 선택형):
     * 각 문항의 설계표에 명시된 [발문언어]와 [보기(①~⑤)언어] 및 수능 유형별 형식을 100% 엄수하여 options 배열에 5개의 선택지를 작성하세요 (앞에 ①~⑤ 기호는 붙이지 마세요).
     * [반드시 영어(English·숫자·기호) 보기]로 지정된 문항은 options 배열의 5개 선택지를 반드시 영어(숫자 유형은 금액 표기, 도표 유형은 "(A)"~"(E)")로만 작성하며 한글 설명을 절대 섞지 마세요.
     * [반드시 한국어 보기]로 지정된 문항은 options 배열의 5개 선택지를 어미와 문장 구조가 균일한 자연스러운 한국어로 작성하세요.
     * 수능 1~17번 유형별 필수 대본·문항지 구조 규칙:
       - 「1번 목적 / 3번 요지 / 9번 내용일치」: 단독 화자 담화문. 1번은 "~하려고", 3번은 완결된 주장 평서문, 9번은 세부 사실 평서문 5개.
       - 「2번 의견 / 5번 할일 / 7번 이유 / 8번 언급안됨」: M과 W의 자연스러운 대화문. 5번은 "~하기", 7번은 "~해서", 8번은 간결한 명사구 5개.
       - 「6번 숫자(지불할 금액)」: 단가·수량·할인율(예: 10% off / membership discount)이 결합된 대화문. options는 작은 금액부터 오름차순 5개(예: "$36", "$40", "$45", "$48", "$54")이며 산술 계산이 100% 정확해야 함!
       - 「10번 도표」: stimulusTitle과 stimulusBody에 (A)~(E) 5개 후보 모델과 4개 조건 열을 갖춘 영문 표를 작성하고, 두 화자가 조건을 하나씩 소거해 유일한 1개를 선택하는 대화를 작성하며 options는 ["(A)", "(B)", "(C)", "(D)", "(E)"]로 구성하세요.
       - 「11~12번 짧은응답」: M과 W의 3~4턴 짧은 대화로, 반드시 응답 직전 상대방의 마지막 발화에서 대본을 종료(정답 응답을 대본에 포함 금지)하고 options에 영어 구어체 응답 5개 제시.
       - 「13~14번 긴응답」: M과 W의 7~10턴 긴 대화로, 역시 응답 직전 상대방의 마지막 발화에서 대본을 종료하고 맥락을 종합한 영어 응답 5개 제시.
       - 「15번 상황」: 단독 화자(W: 또는 M:)가 두 인물의 상황을 영어로 설명하고 마지막 문장을 반드시 "In this situation, what would [인물 A] most likely say to [인물 B]?"로 끝맺은 뒤, options에 인물 A의 영어 발화 5개 제시.
       - 「16~17번 복합(주제+언급안됨)」: 단독 화자의 비교적 긴 강연·설명 담화. options에 영어 주제 명사구 5개(16번형) 또는 언급되지 않은 영어 항목 명사 5개(17번형) 제시.
     * 정기고사 선지 배열 원칙: 5개 선택지는 문법적 병렬 구조를 유지하고, 선택지 길이에 따라 짧은 것에서 긴 순서로 배열하되 숫자·금액·도표 등 논리적 순서가 있는 경우 오름차순으로 배열하세요.
     * 정답이 대본의 특정 문장 하나만 들으면 너무 쉽게 풀리지 않도록 맥락적 단서와 패러프레이징을 활용하고, 오답 매력도를 높이세요.
4. 제출 전 자가 무결성 검증(반드시 내부적으로 점검 후 출력):
   - 모든 문항의 발문·상자에 "대본/지문/윗글/읽고/찾아 쓰시오/transcript/passage"가 단 한 번도 들어가지 않았는가?
   - 원어민이 소리 내어 읽었을 때 어색한 직역 용어나 난이도 대비 지나치게 어려운 문어체 단어가 없는가?
   - 발문(questionPrompt), 대본(transcript), 선택지(options)/모범답안(modelAnswer), 정답 번호(correctChoice), 채점기준 최고점(rubricRows vs totalMarks), 해설(explanation) 간에 논리적 모순이 없는가?`;

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

  // 대량 문항 한 번에 호출 시 응답 지연(타임아웃)을 방지하기 위해 2문항 단위로 분할 병렬 생성
  const CHUNK_SIZE = 2;
  const chunks: Array<{ startIdx: number; slots: typeof slotPlan }> = [];
  for (let start = 0; start < slotPlan.length; start += CHUNK_SIZE) {
    chunks.push({
      startIdx: start,
      slots: slotPlan.slice(start, start + CHUNK_SIZE),
    });
  }

  const autoTopicBuckets = [
    '학교생활, 개인생활(여가·건강)',
    '생태전환(환경), 사회생활(지역사회·봉사)',
    '문화(세계 문화·예술), 일반교양(생활 과학·안전)',
    '가정생활, 민주시민(사회 현안·디지털)',
    '진로·직업, 여가·여행',
  ];

  const buildChunkPrompt = (
    chunkSlots: typeof slotPlan,
    chunkIdx: number
  ): string => {
    const chunkUniqueFormats = Array.from(new Set(chunkSlots.map((s) => s.format)));
    const chunkFormatDescriptions = chunkUniqueFormats
      .map((fid) => {
        const f = QUESTION_FORMATS.find((q) => q.id === fid);
        return f ? `- ${f.id} (${f.label}): ${f.description}` : `- ${fid}`;
      })
      .join('\n');
    const chunkBlueprintLines = buildBlueprintLines(chunkSlots);
    const topicDirective = params.selectedTopics.length
      ? params.selectedTopics.join(', ')
      : `${autoTopicBuckets[chunkIdx % autoTopicBuckets.length]} 중심으로 문항 간 소재가 겹치지 않게 다양하게 배정`;

    return `다음 출제 사양과 **문항별 배정 설계표**에 맞추어 서로 소재와 상황이 겹치지 않는 완성도 높은 영어듣기 문항 **정확히 ${chunkSlots.length}문항**을 출제해 주세요.

- 평가 체제: ${
      params.mode === 'ib'
        ? '대구형(IB) 영어듣기 평가 (IB DP English B Paper 2 공식 기출 6유형 + IB 확장·대구형 서답 3유형)'
        : '기존 영어듣기 평가 (대학수학능력시험 영어 듣기 1~17번 공식 유형 · 100% 5지선다 객관식)'
    }
- 학교급 / 학년 / 과목: ${params.schoolLevel}등학교 ${params.grade} / ${params.subject}
- 평가 목적: ${params.evalPurpose}
- 문항 형식 상세 지침:
${chunkFormatDescriptions}
- [필수 준수] 문항별 배정 설계표:
${chunkBlueprintLines}
- 객관식 보기 및 발문 언어 원칙: ${mcqOptionPolicySummary} / 발문 언어: ${
      (params.mcqPromptLanguage || 'ko') === 'en'
        ? '영어(English) 발문'
        : '한국어 발문 (기출·정기고사 표준)'
    }
- 평가 기능(문항 유형) 배정 원칙: ${
      params.mode === 'std'
        ? params.stdTypeMode === 'counts'
          ? '교사가 수능 유형별 문항 개수를 직접 지정했습니다. 설계표에 배정된 수능 문항 번호별 유형과 대본·보기 규격을 정확히 준수하세요.'
          : params.selectedSkills.length === 0
          ? '교사가 수능 유형 자동 균형 배정을 선택했습니다. 설계표에 배정된 수능 1~17번 유형 순서와 규격을 정확히 준수하세요.'
          : `교사가 선택한 수능 유형(${params.selectedSkills.join(', ')})을 설계표 순서에 맞추어 정확히 출제하세요.`
        : params.selectedSkills.length === 0
        ? '교사가 [성취기준 맞춤 자동 배정]을 선택했습니다. 각 문항에 배정된 성취기준과 대구형(IB) 문항 형식에 가장 타당한 평가 기능(skill)을 설계표의 추천 유형을 참고하여 정확히 출제하세요.'
        : `교사가 지정한 유형(${params.selectedSkills.join(', ')})을 설계표 순서에 맞추어 정확히 출제하세요.`
    }
- 수행지시어 지침: ${directiveGuide}
- 소재 대범주([별표 1]): ${topicDirective}
${params.selectedSubtopic ? `- 세부 소범주: ${params.selectedSubtopic}` : ''}
${params.customTopicDetail ? `- 교사 지정 구체적 상황/주제: ${params.customTopicDetail}` : ''}
- 대본 목표 단어 수: 지문당 약 ${params.targetWordCount}단어
- 어휘 수준: ${vocabMeta.label}
${params.requiredWords.trim() ? `- 반드시 대본에 자연스럽게 포함할 필수 어휘: ${params.requiredWords}` : ''}
- 목표 난이도: ${params.difficulty} (${difficultyGuide})
${params.selectedExpressions.length ? `- 반영할 [별표 2] 의사소통 기능: ${params.selectedExpressions.join(', ')}` : ''}
${params.selectedStructures.length ? `- 반영할 [별표 4] 언어 형식(구문): ${params.selectedStructures.join(', ')}` : ''}
${params.extraInstructions.trim() ? `- 교사 추가 요청사항: ${params.extraInstructions}` : ''}
${referenceBlock}
반드시 JSON 스키마의 items 배열 안에 정확히 ${chunkSlots.length}개의 문항 객체를 순서대로 담아 반환하세요.`;
  };

  let completedCount = 0;
  const totalCount = slotPlan.length;
  const resultsBySlot = new Array<ListeningItem | null>(totalCount).fill(null);

  const runChunk = async (chunkIdx: number) => {
    const chunk = chunks[chunkIdx];
    const rangeLabel =
      chunk.slots.length === 1
        ? `${chunk.slots[0].itemNo}번`
        : `${chunk.slots[0].itemNo}~${chunk.slots[chunk.slots.length - 1].itemNo}번`;

    const parsed = (await callGeminiJson(
      apiKey,
      systemInstruction,
      buildChunkPrompt(chunk.slots, chunkIdx),
      batchSchema,
      (msg) => {
        if (chunks.length === 1) {
          onStatus?.(msg);
        } else {
          onStatus?.(
            `[${completedCount}/${totalCount}문항 완료] ${rangeLabel} 문항 생성 중 · ${msg}`
          );
        }
      },
      signal
    )) as { items?: Record<string, unknown>[] };

    const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
    if (rawItems.length === 0) {
      throw new Error(
        `${rangeLabel} 문항 생성 결과가 비어 있습니다. 다시 시도해 주세요.`
      );
    }

    chunk.slots.forEach((slot, localIdx) => {
      const raw = rawItems[localIdx];
      if (!raw) return;
      const globalIdx = chunk.startIdx + localIdx;
      const enrichedRaw: Record<string, unknown> = {
        ...raw,
        questionFormat: raw.questionFormat || slot.format,
        achievementStandard: raw.achievementStandard || slot.standardText,
        skill: raw.skill || slot.skill,
        directive: raw.directive || slot.directive,
        materialType: raw.materialType || slot.textType,
      };
      resultsBySlot[globalIdx] = normalizeGeneratedItem(
        enrichedRaw,
        globalIdx,
        params,
        slot.standardText
      );
    });

    completedCount += chunk.slots.length;
    if (chunks.length > 1) {
      onStatus?.(
        completedCount >= totalCount
          ? `총 ${totalCount}문항 생성 완료! 자동 타당도 점검 중...`
          : `${completedCount} / ${totalCount}문항 완성! 나머지 문항을 마무리하고 있습니다...`
      );
    }
  };

  // 최대 2개 청크씩 병렬 실행하여 4문항 기준 10~20초 내 고속 출제
  if (chunks.length > 1) {
    onStatus?.(
      `총 ${totalCount}문항을 ${chunks.length}개 묶음으로 분할해 고속 출제하고 있습니다...`
    );
  }
  const CONCURRENCY = 2;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const wave = chunks.slice(i, i + CONCURRENCY);
    await Promise.all(wave.map((_, offset) => runChunk(i + offset)));
  }

  const finalItems = resultsBySlot.filter(
    (it): it is ListeningItem => it !== null
  );
  if (finalItems.length === 0) {
    throw new Error('생성된 문항 데이터가 없습니다. 파라미터를 확인하고 다시 시도해 주세요.');
  }
  return finalItems;
}

function buildDifficultyListeningGuide(
  difficulty: DifficultyLevel,
  vocabLevelId: VocabLevelId
): string {
  const isMid = vocabLevelId === 'mid_basic';
  if (difficulty === '하') {
    return isMid
      ? '초빈출 일상 구어(CEFR A2)만 사용. 한 문장 평균 8~11단어(최대 15단어), 단순 시제·명확한 정보 제시, 방해 정보 최소화.'
      : '학생이 1회 청취로 부담 없이 이해할 수 있는 일상 구어(CEFR A2+~B1 초입). 한 문장 평균 9~13단어(최대 17단어), 명확한 단서와 평이한 구문 위주.';
  }
  if (difficulty === '상') {
    return isMid
      ? '중학 기본 어휘 범위(CEFR A2+~B1 초입)를 유지하되, 조건 변경·화자 의도 추론·패러프레이징으로 사고력 난이도를 높이세요. 생소한 전문 용어로 어렵게 만들지 마세요.'
      : '고등·수능 수준 구어체(CEFR B1+~B2). 한 문장 평균 13~18단어, 대화 맥락 추론·정보 전환(패러프레이징)·매력적인 오답으로 변별력을 확보하되, 부자연스러운 학술 직역어는 피하세요.';
  }
  // 기본 '중'
  return isMid
    ? '중학교 교과서·실생활 구어체(CEFR A2). 한 문장 평균 9~13단어(최대 18단어), 일상적 표현만 사용하고 문어체·전문어는 배제.'
    : '표준 학교 정기고사 듣기 난이도(CEFR B1). 귀로 1회 듣고 즉각 이해할 수 있는 자연스러운 일상 구어 어휘만 사용하고, 한 문장 평균 11~15단어(최대 22단어)를 유지하세요. 저빈도 문어·전문어는 절대 사용하지 마세요.';
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
    currentItem.questionFormat === 'ib_mcq_3'
      ? (params.mcqOptionLanguage || 'auto') === 'ko'
        ? 'ko'
        : 'en'
      : (params.mcqOptionLanguage || 'auto') === 'en'
      ? 'en'
      : (params.mcqOptionLanguage || 'auto') === 'ko'
      ? 'ko'
      : matchedSkill
      ? englishSkillSet.has(matchedSkill.value)
        ? 'en'
        : 'ko'
      : 'ko';
  const difficultyGuide = buildDifficultyListeningGuide(
    currentItem.difficulty,
    currentItem.vocabLevelId
  );

  const systemInstruction = `당신은 대구광역시교육청 중등 영어듣기 출제 전문 AI 보조교사이자 원어민 구어체 감수자입니다.
교사가 현재 편집 중인 문항 데이터(JSON)를 바탕으로 교사의 수정 요청사항을 정확히 반영하여 개선된 단일 문항 JSON을 반환하세요.
[필수 준수 원칙]
1. 원어민 자연 구어체: 한국어 직역(예: meteorological center, ecological transition 등)과 일상 대화에 어색한 문어체/전문어(utilize, commence, relocate, rectify 등)를 피하고 원어민이 실제 말하는 쉬운 구어 표현으로 작성하세요.
   - 현재 난이도 기준(${currentItem.difficulty} / ${currentItem.vocabLevelLabel}): ${difficultyGuide}
2. 듣기 평가 전용(Audio-Only) 타당도: 학생에게는 대본이 제공되지 않습니다. 발문·상자·보기에 "대본을 보고", "대본에서 찾아", "지문에서", "윗글", "읽고", "transcript/passage" 같은 읽기 표현을 절대 사용하지 마세요.
3. 일관성 유지: 대본(transcript) 수정 시 화자 표기(W:, M:)를 유지하고, 발문·모범답안·선택지·채점기준(최고점=totalMarks)·해설·우리말 해석이 수정된 대본과 완벽히 일치하도록 함께 업데이트하세요.
4. 선택형 문항(ib_mcq_3은 3개 A/B/C 선택지 및 correctChoice 1~3, mcq_5는 5개 ①~⑤ 선택지 및 correctChoice 1~5)의 경우 교사가 별도로 언어를 지정하지 않았다면 현재 선택지 언어(또는 유형 기본값: ${
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

/**
 * 2차 원어민 구어체·듣기 타당도 정밀 검수 및 자동 교정
 * - 자동 검수기(itemValidator)가 찾은 문제점 + 원어민 시선에서의 어색한 표현·난이도 초과 어휘·정답 논리 오류를 한 번에 교정합니다.
 */
export async function auditAndFixListeningItem(
  apiKey: string,
  currentItem: ListeningItem,
  params: GenerationParams,
  existingReport?: ItemValidationReport,
  onStatus?: (msg: string) => void
): Promise<ListeningItem> {
  const report =
    existingReport || validateListeningItem(currentItem, params.targetWordCount);
  const autoFixBrief = buildAutoFixPromptFromReport(
    report,
    currentItem.difficulty,
    currentItem.vocabLevelLabel
  );

  const auditInstruction = `[원어민 구어체 · 듣기 타당도 정밀 검수 및 자동 교정]
1. 아래 자동 검수 지적 사항을 빠짐없이 해결하세요:
${autoFixBrief}

2. 추가 정밀 검수 항목 (지적 사항이 없더라도 반드시 확인 후 개선):
- 대본(transcript) 전체를 원어민이 소리 내어 말하는 시선으로 점검하고, 한국어 직역 표현(예: meteorological center → weather forecast, ecological transition → eco-friendly habits 등)이나 듣기에 부자연스러운 문어체·고난도 어휘를 현재 수준(${currentItem.vocabLevelLabel}, 난이도 ${currentItem.difficulty})에 맞는 일상 구어체로 다듬으세요.
- 학생은 대본을 보지 않고 오직 음성만 듣는다는 전제로, 발문·안내문 상자·선택지에 읽기 문형 표현("대본을 보고/찾아", "지문에서", "윗글", "읽고" 등)이 단 하나도 없도록 교정하세요.
- 대본의 정답 근거와 선택지(또는 모범답안·세부 채점기준·해설·우리말 해석)가 100% 논리적으로 일치하고 복수 정답 여지가 없도록 검증·보완하세요.
- 기존 문항의 성취기준, 문항 형식(${currentItem.questionFormat}), 소재 방향은 최대한 유지하면서 품질만 끌어올리세요.`;

  onStatus?.(`${currentItem.itemNo}번 문항 원어민 구어체·타당도 정밀 검수 중...`);
  return refineSingleItem(apiKey, currentItem, auditInstruction, params, onStatus);
}

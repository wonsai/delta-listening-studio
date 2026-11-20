import React, { useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  BookMarked,
  Sliders,
  MessageSquareText,
  Layers,
  ChevronDown,
  ChevronUp,
  Loader2,
  Edit3,
  Compass,
  Minus,
  Plus,
  Wand2,
  RotateCcw,
  Zap,
  Settings2,
  AlertCircle,
  KeyRound,
  Square,
} from 'lucide-react';
import {
  DifficultyLevel,
  DistributionMode,
  GenerationParams,
  McqOptionLanguageMode,
  McqPromptLanguageMode,
  VocabLevelId,
} from '../types/assessment';
import {
  DIRECTIVES,
  EXPRESSION_GROUPS,
  IB_SKILLS,
  STD_SKILLS,
  STRUCTURE_ITEMS,
  TEXT_TYPES,
  TOPICS,
  VOCAB_LEVELS,
  getAchievementStandardsForSubject,
  getDefaultEnglishOptionSkills,
  getListeningPrimaryStandardsForSubject,
  getSubjectInfo,
} from '../data/taxonomy';
import { QuestionDistributionPanel } from './QuestionDistributionPanel';

interface Step2Props {
  params: GenerationParams;
  onChangeParams: (patch: Partial<GenerationParams>) => void;
  onBack: () => void;
  onGenerate: () => void;
  onCancelGenerate?: () => void;
  onSkipToEditor: () => void;
  generating: boolean;
  generateElapsedSec?: number;
  statusMessage: string;
  generateError?: string | null;
  hasApiKey?: boolean;
  onOpenApiKeyModal?: () => void;
}

function sumCounts(map: Record<string, number | undefined>): number {
  return Object.values(map).reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
}

function clampCountsToMax<K extends string>(
  counts: Partial<Record<K, number>>,
  maxTotal: number
): Partial<Record<K, number>> {
  const next: Partial<Record<K, number>> = { ...counts };
  let total = sumCounts(next as Record<string, number | undefined>);
  if (total <= maxTotal) return next;

  const keys = Object.keys(next).reverse() as K[];
  for (const k of keys) {
    if (total <= maxTotal) break;
    const cur = Number(next[k] || 0);
    if (cur > 0) {
      const dec = Math.min(cur, total - maxTotal);
      const updated = cur - dec;
      if (updated <= 0) {
        delete next[k];
      } else {
        next[k] = updated;
      }
      total -= dec;
    }
  }
  return next;
}

function buildRecommendedTextCounts(total: number): Record<string, number> {
  // 문항 수에 맞춰 대화문과 담화문(안내방송·음성메시지·강연 등)을 현실적인 시험 비율로 배분
  const order = [
    '대화문',
    '담화문(안내 방송)',
    '대화문',
    '담화문(음성 메시지)',
    '대화문',
    '담화문(강연·발표)',
    '인터뷰',
    '대화문',
    '담화문(안내 방송)',
    '토론·의견 교환',
  ];
  const res: Record<string, number> = {};
  for (let i = 0; i < total; i++) {
    const key = order[i % order.length];
    res[key] = (res[key] || 0) + 1;
  }
  return res;
}

export const Step2Parameters: React.FC<Step2Props> = ({
  params,
  onChangeParams,
  onBack,
  onGenerate,
  onCancelGenerate,
  onSkipToEditor,
  generating,
  generateElapsedSec = 0,
  statusMessage,
  generateError,
  hasApiKey = true,
  onOpenApiKeyModal,
}) => {
  const [setupMode, setSetupMode] = useState<'simple' | 'detailed'>('simple');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stdDomainTab, setStdDomainTab] = useState<'first' | 'second' | 'all'>('first');
  const [activePresetId, setActivePresetId] = useState<string>('');

  const standards = getAchievementStandardsForSubject(params.subject);
  const primaryStandards = getListeningPrimaryStandardsForSubject(params.subject);
  const subjectMeta = getSubjectInfo(params.subject);
  const availableDomains = Array.from(new Set(standards.map((s) => s.domain)));
  const visibleStandards =
    availableDomains.length <= 1 || stdDomainTab === 'all'
      ? standards
      : stdDomainTab === 'second' && availableDomains[1]
      ? standards.filter((s) => s.domain === availableDomains[1])
      : standards.filter((s) => s.domain === availableDomains[0]);
  const skillsList = params.mode === 'ib' ? IB_SKILLS : STD_SKILLS;
  const activeDirectiveMeta = DIRECTIVES.find(
    (d) => d.value === params.selectedDirective
  );

  const toggleArrayItem = <T extends string>(
    arr: T[],
    val: T,
    minOne = false
  ): T[] => {
    if (arr.includes(val)) {
      if (minOne && arr.length <= 1) return arr;
      return arr.filter((x) => x !== val);
    }
    return [...arr, val];
  };

  // 문항 수 변경 시 수량 지정 맵도 최대 문항 수를 넘지 않도록 자동 연동
  const handleItemCountChange = (newCount: number) => {
    const clampedFmt = clampCountsToMax(
      params.questionFormatCounts || {},
      newCount
    );
    const clampedStd = clampCountsToMax(
      params.stdTypeCounts || {},
      newCount
    ) as Record<string, number>;
    const clampedTxt = clampCountsToMax(
      params.textTypeCounts || {},
      newCount
    ) as Record<string, number>;

    onChangeParams({
      itemCount: newCount,
      questionFormatCounts: clampedFmt,
      stdTypeCounts: clampedStd,
      textTypeCounts: clampedTxt,
    });
  };

  // 대구형(IB) / 기존형(수능) 배정 수량 집계 (요약 표시용)
  const formatAllocated = sumCounts(
    (params.questionFormatCounts || {}) as Record<string, number | undefined>
  );
  const formatRemaining = Math.max(0, params.itemCount - formatAllocated);
  const stdAllocated = sumCounts(params.stdTypeCounts || {});

  // 담화·대화 유형 수량 증감
  const textAllocated = sumCounts(params.textTypeCounts || {});
  const textRemaining = Math.max(0, params.itemCount - textAllocated);

  const handleAdjustTextTypeCount = (typeId: string, delta: number) => {
    const currentMap = { ...(params.textTypeCounts || {}) };
    const curVal = Number(currentMap[typeId] || 0);
    if (delta > 0 && textAllocated >= params.itemCount) return;
    const nextVal = Math.max(0, curVal + delta);
    if (nextVal === 0) {
      delete currentMap[typeId];
    } else {
      currentMap[typeId] = nextVal;
    }
    onChangeParams({ textTypeCounts: currentMap });
  };

  const handleSwitchTextTypeMode = (mode: DistributionMode) => {
    if (mode === 'counts' && sumCounts(params.textTypeCounts || {}) === 0) {
      onChangeParams({
        textTypeMode: 'counts',
        textTypeCounts: buildRecommendedTextCounts(params.itemCount),
      });
    } else {
      onChangeParams({ textTypeMode: mode });
    }
  };

  // 객관식(5지선다 또는 IB 3지선다) 포함 여부 및 기출 유형별 보기 언어 설정 헬퍼
  const hasMcqSelected =
    params.mode === 'std' ||
    (params.questionFormatMode === 'counts'
      ? Number(params.questionFormatCounts?.mcq_5 || 0) > 0 ||
        Number(params.questionFormatCounts?.ib_mcq_3 || 0) > 0 ||
        (formatRemaining > 0 &&
          (params.questionFormats.includes('mcq_5') ||
            params.questionFormats.includes('ib_mcq_3')))
      : params.questionFormats.includes('mcq_5') ||
        params.questionFormats.includes('ib_mcq_3'));

  const mcqOptionLanguage: McqOptionLanguageMode =
    params.mcqOptionLanguage || 'auto';
  const mcqPromptLanguage: McqPromptLanguageMode =
    params.mcqPromptLanguage || 'ko';
  const activeEnglishSkillSet = new Set(
    params.mcqEnglishSkills || getDefaultEnglishOptionSkills()
  );
  const currentModeDefaultEnSkills = getDefaultEnglishOptionSkills(params.mode);
  const currentModeEnSkills = skillsList.filter((s) =>
    activeEnglishSkillSet.has(s.value)
  );
  const currentModeKoSkills = skillsList.filter(
    (s) => !activeEnglishSkillSet.has(s.value)
  );
  const isAutoMappingCustomized =
    currentModeEnSkills.length !== currentModeDefaultEnSkills.length ||
    currentModeEnSkills.some(
      (s) => !currentModeDefaultEnSkills.includes(s.value)
    );

  const isSkillEnglishOption = (skillValue: string): boolean => {
    if (mcqOptionLanguage === 'en') return true;
    if (mcqOptionLanguage === 'ko') return false;
    return activeEnglishSkillSet.has(skillValue);
  };

  const handleToggleSkillEnglishOption = (skillValue: string) => {
    const currentList =
      params.mcqEnglishSkills || getDefaultEnglishOptionSkills();
    const nextList = currentList.includes(skillValue)
      ? currentList.filter((v) => v !== skillValue)
      : [...currentList, skillValue];
    onChangeParams({ mcqEnglishSkills: nextList });
  };

  const handleResetModeOptionDefaults = () => {
    const currentModeNames = new Set(skillsList.map((s) => s.value));
    const otherModeKept = (
      params.mcqEnglishSkills || getDefaultEnglishOptionSkills()
    ).filter((v) => !currentModeNames.has(v));
    onChangeParams({
      mcqEnglishSkills: [...otherModeKept, ...currentModeDefaultEnSkills],
    });
  };

  // 성취기준 기반 자동 매칭 평가기능 미리보기 목록
  const targetStandardsForPreview =
    params.selectedStandards.length > 0
      ? standards.filter((s) => params.selectedStandards.includes(s.text))
      : primaryStandards;

  const autoMatchedSkillPreview = Array.from(
    new Set(
      targetStandardsForPreview.map((s) =>
        params.mode === 'ib' ? s.recommendedSkillIb : s.recommendedSkillStd
      )
    )
  );

  // 선택된 대범주에 속하는 소범주 목록
  const matchingSubtopics = TOPICS.filter((t) =>
    params.selectedTopics.includes(t.value)
  ).flatMap((t) =>
    t.subtopics.map((sub) => ({ ...sub, parentTopic: t.value }))
  );

  // 예상 재생 시간 안내 (약 140 WPM + 턴간 쉼)
  const estSeconds = Math.round((params.targetWordCount / 140) * 60 + 6);

  // 간편 출제 원클릭 프리셋 목록
  const quickPresets: Array<{
    id: string;
    title: string;
    badge: string;
    desc: string;
    patch: Partial<GenerationParams>;
  }> =
    params.mode === 'ib'
      ? [
          {
            id: 'ib_paper2_core',
            title: 'IB Paper 2 기출 핵심 (추천)',
            badge: '4문항 · 중',
            desc: 'IB 3지선다 1 + 노트·표 빈칸(≤3단어) 1 + 참인 진술 1 + 화자 매칭 1',
            patch: {
              itemCount: 4,
              difficulty: '중',
              targetWordCount: 115,
              questionFormatMode: 'counts',
              questionFormats: [
                'ib_mcq_3',
                'gap_poster',
                'ib_multi_true',
                'ib_speaker_match',
              ],
              questionFormatCounts: {
                ib_mcq_3: 1,
                gap_poster: 1,
                ib_multi_true: 1,
                ib_speaker_match: 1,
              },
              textTypeMode: 'auto',
              selectedStandards: [],
              selectedSkills: [],
            },
          },
          {
            id: 'ib_perf',
            title: 'IB 빈칸·단답 수행평가',
            badge: '4문항 · 중',
            desc: '노트·표 빈칸(≤3단어) 1 + 영어 단답형 1 + 정보·문장 매칭 1 + T/F 근거 1',
            patch: {
              itemCount: 4,
              difficulty: '중',
              targetWordCount: 115,
              questionFormatMode: 'counts',
              questionFormats: ['gap_poster', 'short_en', 'ib_match_info', 'tf_justify'],
              questionFormatCounts: {
                gap_poster: 1,
                short_en: 1,
                ib_match_info: 1,
                tf_justify: 1,
              },
              textTypeMode: 'auto',
              selectedStandards: [],
              selectedSkills: [],
            },
          },
          {
            id: 'ib_daegu_hybrid',
            title: 'IB 기출 + 우리말 서술 혼합',
            badge: '4문항 · 중',
            desc: 'IB 3지선다 1 + 노트·표 빈칸 1 + 참인 진술 1 + 우리말 의도·이유 서술 1',
            patch: {
              itemCount: 4,
              difficulty: '중',
              targetWordCount: 115,
              questionFormatMode: 'counts',
              questionFormats: ['ib_mcq_3', 'gap_poster', 'ib_multi_true', 'short_kr'],
              questionFormatCounts: {
                ib_mcq_3: 1,
                gap_poster: 1,
                ib_multi_true: 1,
                short_kr: 1,
              },
              textTypeMode: 'auto',
              selectedStandards: [],
              selectedSkills: [],
            },
          },
          {
            id: 'ib_deep',
            title: 'IB HL 심화 매칭·추론 세트',
            badge: '4문항 · 상',
            desc: '화자·관점 매칭 1 + 정보·문장 매칭 1 + 영어 단답 1 + T/F 근거 1 (~140단어)',
            patch: {
              itemCount: 4,
              difficulty: '상',
              targetWordCount: 140,
              questionFormatMode: 'counts',
              questionFormats: [
                'ib_speaker_match',
                'ib_match_info',
                'short_en',
                'tf_justify',
              ],
              questionFormatCounts: {
                ib_speaker_match: 1,
                ib_match_info: 1,
                short_en: 1,
                tf_justify: 1,
              },
              textTypeMode: 'auto',
              selectedStandards: [],
              selectedSkills: [],
            },
          },
        ]
      : [
          {
            id: 'std_csat_core',
            title: '수능 핵심 5문항 (추천)',
            badge: '5문항 · 중',
            desc: '1번 목적 · 2번 의견 · 6번 금액 · 10번 도표 · 13~14번 긴 응답 (영/한 보기 자동)',
            patch: {
              itemCount: 5,
              difficulty: '중',
              targetWordCount: 115,
              mcqOptionLanguage: 'auto',
              stdTypeMode: 'counts',
              stdTypeCounts: {
                목적: 1,
                의견: 1,
                숫자: 1,
                도표: 1,
                긴응답: 1,
              },
              selectedSkills: ['목적', '의견', '숫자', '도표', '긴응답'],
              textTypeMode: 'auto',
              selectedStandards: [],
            },
          },
          {
            id: 'std_csat_speaking',
            title: '수능 간접 말하기 집중',
            badge: '5문항 · 중',
            desc: '11~12번 짧은 응답(2) · 13~14번 긴 응답(2) · 15번 상황(1) — 영어 보기',
            patch: {
              itemCount: 5,
              difficulty: '중',
              targetWordCount: 115,
              mcqOptionLanguage: 'auto',
              stdTypeMode: 'counts',
              stdTypeCounts: { 짧은응답: 2, 긴응답: 2, 상황: 1 },
              selectedSkills: ['짧은응답', '긴응답', '상황'],
              textTypeMode: 'auto',
              selectedStandards: [],
            },
          },
          {
            id: 'std_csat_detail',
            title: '수능 세부정보 · 담화 집중',
            badge: '5문항 · 중',
            desc: '3번 요지 · 5번 할 일 · 7번 이유 · 8번 언급안됨 · 9번 내용일치',
            patch: {
              itemCount: 5,
              difficulty: '중',
              targetWordCount: 110,
              mcqOptionLanguage: 'auto',
              stdTypeMode: 'counts',
              stdTypeCounts: { 요지: 1, 할일: 1, 이유: 1, 언급안됨: 1, 내용일치: 1 },
              selectedSkills: ['요지', '할일', '이유', '언급안됨', '내용일치'],
              textTypeMode: 'auto',
              selectedStandards: [],
            },
          },
          {
            id: 'std_csat_mock',
            title: '수능 실전 모의 미니세트',
            badge: '8문항 · 상',
            desc: '1번~17번 전 영역 균형 배분 (목적·의견·금액·도표·응답·상황·16~17번 복합)',
            patch: {
              itemCount: 8,
              difficulty: '상',
              targetWordCount: 130,
              mcqOptionLanguage: 'auto',
              stdTypeMode: 'counts',
              stdTypeCounts: {
                목적: 1,
                의견: 1,
                숫자: 1,
                도표: 1,
                짧은응답: 1,
                긴응답: 1,
                상황: 1,
                '복합(주제+언급안됨)': 1,
              },
              selectedSkills: [
                '목적',
                '의견',
                '숫자',
                '도표',
                '짧은응답',
                '긴응답',
                '상황',
                '복합(주제+언급안됨)',
              ],
              textTypeMode: 'auto',
              selectedStandards: [],
            },
          },
        ];

  const applyQuickPreset = (preset: (typeof quickPresets)[number]) => {
    setActivePresetId(preset.id);
    onChangeParams(preset.patch);
  };

  return (
    <div className="space-y-6">
      {/* 상단 요약 헤더 + 간편/상세 모드 전환 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#357DC7] uppercase tracking-wider mb-1">
              <Sliders className="w-4 h-4" />
              STEP 2 OF 4 · 출제 조건 설정
            </div>
            <h1 className="text-2xl font-extrabold text-[#09396A]">
              {setupMode === 'simple'
                ? params.mode === 'ib'
                  ? '대구형(IB) 문항 유형과 핵심 조건을 선택하세요'
                  : '수능 영어 듣기 유형(1~17번)과 핵심 조건을 선택하세요'
                : '성취기준 · 어휘 수준 · 문항별 세부 조건을 조정하세요'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              현재 선택:{' '}
              <span className="font-bold text-[#09396A]">
                {params.mode === 'ib'
                  ? '대구형(IB Paper 2 · DELTA 서답/선택형)'
                  : '기존형(수능 영어 듣기 1~17번 · 5지선다)'}
              </span>{' '}
              ·{' '}
              <span className="font-bold text-slate-800">
                {params.schoolLevel}등학교 {params.grade} ({params.subject})
              </span>
              {subjectMeta && (
                <span className="text-xs text-slate-500 ml-1.5">
                  · 2022 개정 [{subjectMeta.category}] · 권장 어휘{' '}
                  {subjectMeta.vocabWords.toLocaleString()}단어 이내
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            1단계로 이전
          </button>
        </div>

        {/* 간편 출제 vs 상세 설정 탭 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
            <button
              type="button"
              onClick={() => setSetupMode('simple')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold transition ${
                setupMode === 'simple'
                  ? 'bg-[#09396A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              간편 출제 모드 (추천 · 빠른 출제)
            </button>
            <button
              type="button"
              onClick={() => setSetupMode('detailed')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold transition ${
                setupMode === 'detailed'
                  ? 'bg-[#09396A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              상세 교육과정 설정 (유형별 개수 · 성취기준 · 별표2/4)
            </button>
          </div>
          <span className="text-[11px] text-slate-500">
            {setupMode === 'simple'
              ? '성취기준·담화유형은 과목에 맞춰 자동 최적화되며, 원어민 구어체·듣기 타당도 원칙이 자동 적용됩니다.'
              : '유형별 문항 개수 지정, 성취기준, 수행지시어, 객관식 보기 언어, 의사소통 기능/구문을 직접 세밀하게 제어합니다.'}
          </span>
        </div>
      </div>

      {/* ================================================================= */}
      {/* ⚡ 간편 출제 모드 (기본 화면)                                      */}
      {/* ================================================================= */}
      {setupMode === 'simple' && (
        <div className="space-y-5">
          {/* 원클릭 추천 프리셋 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-[#357DC7]" />
                <h2 className="text-base font-extrabold text-slate-900">
                  {params.mode === 'ib'
                    ? '대구형(IB) 원클릭 추천 세트'
                    : '수능 영어 듣기 원클릭 추천 세트'}
                </h2>
              </div>
              <span className="text-[11px] font-bold text-[#357DC7] bg-[#EAF2FB] px-2.5 py-1 rounded-full">
                원어민 일상 구어체 · 듣기 전용 타당도 자동 검증
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {quickPresets.map((preset) => {
                const isSelected = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyQuickPreset(preset)}
                    className={`text-left p-4 rounded-xl border-2 transition ${
                      isSelected
                        ? 'border-[#09396A] bg-[#F4F8FD] shadow-xs'
                        : 'border-slate-200 bg-white hover:border-[#357DC7]/60 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-extrabold text-[#09396A]">
                        {preset.title}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF2FB] text-[#09396A] shrink-0">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {preset.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 핵심 4항목 빠른 조정 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#09396A]" />
              핵심 출제 조건 (4가지만 확인하면 바로 출제할 수 있습니다)
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 1) 문항 수 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800">
                    ① 출제 문항 수
                  </label>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#09396A] text-white text-xs font-extrabold">
                    총 {params.itemCount}문항
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={params.itemCount}
                    onChange={(e) => {
                      setActivePresetId('');
                      handleItemCountChange(Number(e.target.value));
                    }}
                    className="flex-1 accent-[#09396A]"
                  />
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setActivePresetId('');
                        handleItemCountChange(n);
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                        params.itemCount === n
                          ? 'bg-[#09396A] text-white border-[#09396A]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {n}문항
                    </button>
                  ))}
                </div>
              </div>

              {/* 2) 난이도 & 대본 길이 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800">
                    ② 듣기 난이도 및 지문 길이
                  </label>
                  <span className="text-[11px] font-bold text-[#357DC7]">
                    약 {params.targetWordCount}단어 (재생 약 {estSeconds}초)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        lv: '하' as DifficultyLevel,
                        sub: '초빈출 쉬운 구어',
                      },
                      {
                        lv: '중' as DifficultyLevel,
                        sub: '표준 일상 구어',
                      },
                      {
                        lv: '상' as DifficultyLevel,
                        sub: '추론·재진술 심화',
                      },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.lv}
                      type="button"
                      onClick={() => {
                        setActivePresetId('');
                        onChangeParams({ difficulty: d.lv });
                      }}
                      className={`p-2 rounded-xl border text-center transition ${
                        params.difficulty === d.lv
                          ? 'bg-[#09396A] text-white border-[#09396A]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-extrabold">난이도 {d.lv}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          params.difficulty === d.lv
                            ? 'text-blue-100'
                            : 'text-slate-500'
                        }`}
                      >
                        {d.sub}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600 shrink-0 mr-1">
                    지문 분량:
                  </span>
                  {[
                    { label: '짧게 (90단어)', w: 90 },
                    { label: '표준 (115단어)', w: 115 },
                    { label: '길게 (145단어)', w: 145 },
                  ].map((len) => (
                    <button
                      key={len.w}
                      type="button"
                      onClick={() => {
                        setActivePresetId('');
                        onChangeParams({ targetWordCount: len.w });
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                        Math.abs(params.targetWordCount - len.w) <= 10
                          ? 'bg-[#EAF2FB] text-[#09396A] border-[#357DC7]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {len.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3) 대구형(IB 기출 유형) 또는 기존형(수능 1~17번 연계) 문항 배분 방식 (N문항 연동) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-200/80">
                  <span className="text-xs font-extrabold text-[#09396A]">
                    ③ 문항 형식 · 유형 배분 방식 ({params.itemCount}문항 실시간 연동)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSetupMode('detailed')}
                    className="text-[11px] font-bold text-[#357DC7] hover:underline"
                  >
                    성취기준 · 보기 언어 세부 설정 →
                  </button>
                </div>

                <QuestionDistributionPanel
                  params={params}
                  onChangeParams={onChangeParams}
                  onClearPreset={() => setActivePresetId('')}
                  showMcqLanguageBar={params.mode === 'std'}
                />
              </div>

              {/* 4) 소재·주제 선택 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800">
                    ④ 소재 · 주제 (선택 사항)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {params.selectedTopics.length === 0
                      ? '자동 다양화 (권장)'
                      : `${params.selectedTopics.length}개 선택됨`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeParams({ selectedTopics: [] })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                      params.selectedTopics.length === 0
                        ? 'bg-[#09396A] text-white border-[#09396A]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    전체 자동 다양화
                  </button>
                  {TOPICS.map((t) => {
                    const active = params.selectedTopics.includes(t.value);
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() =>
                          onChangeParams({
                            selectedTopics: toggleArrayItem(
                              params.selectedTopics,
                              t.value
                            ),
                          })
                        }
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                          active
                            ? 'bg-[#357DC7] text-white border-[#357DC7]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t.value}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={params.customTopicDetail}
                  onChange={(e) =>
                    onChangeParams({ customTopicDetail: e.target.value })
                  }
                  placeholder="원하는 구체적 상황/주제가 있으면 1줄로 입력 (예: 학교 축제 부스 운영, 도서관 이용 안내)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#357DC7]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <span>
                특정 성취기준, 평가 기능(15종), 수행지시어, 필수 어휘, [별표 2·4] 문법 구문까지 세밀하게 지정하고 싶으신가요?
              </span>
              <button
                type="button"
                onClick={() => setSetupMode('detailed')}
                className="inline-flex items-center gap-1 font-extrabold text-[#357DC7] hover:text-[#09396A] underline underline-offset-2"
              >
                <Settings2 className="w-3.5 h-3.5" />
                상세 교육과정 설정 열기 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 🎛️ 상세 교육과정 설정 모드 (기존 모든 세부 옵션 완벽 보존)           */}
      {/* ================================================================= */}
      {setupMode === 'detailed' && (
      <>
      {/* 1. 문항 수 및 문항 세부 형식 (문항 수 연동 지원) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#09396A]" />
            <h2 className="text-base font-extrabold text-slate-900">
              1. 출제 문항 수 및 문항 형식 구성
            </h2>
          </div>
          <span className="text-xs font-bold text-[#357DC7] bg-[#EAF2FB] px-3 py-1 rounded-full">
            총 출제 문항: {params.itemCount}문항 (아래 담화 유형·형식 배분과 자동 연동)
          </span>
        </div>

        <div className="space-y-5">
          {/* 문항 수 */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  자동 출제할 총 문항 수
                </label>
                <span className="px-2.5 py-0.5 rounded-lg bg-[#09396A] text-white text-xs font-extrabold">
                  총 {params.itemCount}문항
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={params.itemCount}
                onChange={(e) => handleItemCountChange(Number(e.target.value))}
                className="w-full accent-[#09396A]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 lg:w-80 shrink-0">
              {[1, 2, 3, 4, 5, 8, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleItemCountChange(n)}
                  className={`flex-1 min-w-[44px] py-1.5 rounded-lg text-xs font-bold border transition ${
                    params.itemCount === n
                      ? 'bg-[#09396A] text-white border-[#09396A]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {n}문항
                </button>
              ))}
            </div>
          </div>

          {/* 문항 유형 / 형식 배분 방식 (N문항 연동 · 대구형 IB 기출 / 기존형 수능 연계) */}
          <div className="rounded-xl bg-slate-50/70 border border-slate-200/90 p-4">
            <QuestionDistributionPanel
              params={params}
              onChangeParams={onChangeParams}
              onClearPreset={() => setActivePresetId('')}
            />
          </div>
        </div>

        {/* 객관식 보기(①~⑤ / A~C) 및 발문 언어 설정 패널 */}
        {hasMcqSelected ? (
          <div className="pt-4 border-t border-slate-200/90 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-[#09396A] text-white">
                  객관식 보기 설정
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {params.mode === 'std'
                    ? '수능 5지선다 선택지(①~⑤) 및 발문 언어 옵션'
                    : '선택형(IB 3지선다 A~C · 5지선다 ①~⑤) 보기 및 발문 언어 옵션'}
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                기출문제 분석 기반 유형별 영어·한국어 보기 기본값 적용됨
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 보기(선택지) 언어 모드 선택 */}
              <div className="lg:col-span-8 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  ①~⑤ 보기(선택지) 언어 설정
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        id: 'auto' as McqOptionLanguageMode,
                        badge: '추천 · 기본',
                        title: '✨ 기출 유형별 자동',
                        desc:
                          params.mode === 'std'
                            ? '응답·상황·심정·숫자·도표는 영어(숫자·기호) 보기, 목적·의견·이유 등은 한국어 보기'
                            : '응답·심정·함축의미·구조·요약·비판분석 등은 영어 보기, 요지·이유 등은 한국어 보기',
                      },
                      {
                        id: 'en' as McqOptionLanguageMode,
                        badge: 'EN 통일',
                        title: '🅰️ 전체 영어 보기',
                        desc: '모든 객관식 문항의 ①~⑤ 선택지를 영어로 출제 (고교 내신 변별력·IB 스타일)',
                      },
                      {
                        id: 'ko' as McqOptionLanguageMode,
                        badge: 'KO 통일',
                        title: '가 전체 한국어 보기',
                        desc: '모든 객관식 문항의 ①~⑤ 선택지를 자연스러운 한국어로 통일 출제',
                      },
                    ] as const
                  ).map((opt) => {
                    const active = mcqOptionLanguage === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onChangeParams({ mcqOptionLanguage: opt.id })
                        }
                        className={`text-left p-3 rounded-xl border transition flex flex-col justify-between ${
                          active
                            ? 'bg-[#F4F8FD] border-[#09396A] ring-1 ring-[#09396A]'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-extrabold text-slate-900">
                              {opt.title}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                active
                                  ? 'bg-[#09396A] text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            {opt.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 객관식 발문(질문) 언어 선택 */}
              <div className="lg:col-span-4 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  객관식 발문(질문) 언어 설정
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      {
                        id: 'ko' as McqPromptLanguageMode,
                        title: '한국어 발문 (기출·정기고사 표준)',
                        desc: '예: 대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오.',
                      },
                      {
                        id: 'en' as McqPromptLanguageMode,
                        title: '영어 발문 (IB 원문 스타일)',
                        desc: '예: What is the speaker mainly talking about?',
                      },
                    ] as const
                  ).map((pm) => {
                    const active = mcqPromptLanguage === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() =>
                          onChangeParams({ mcqPromptLanguage: pm.id })
                        }
                        className={`text-left px-3 py-2.5 rounded-xl border transition ${
                          active
                            ? 'bg-[#F4F8FD] border-[#09396A] ring-1 ring-[#09396A]'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-extrabold text-slate-900">
                          {pm.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {pm.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 기출 유형별 자동 모드일 때: 유형별 EN / KO 현황 표시 및 원클릭 개별 조정 */}
            {mcqOptionLanguage === 'auto' && (
              <div className="rounded-xl bg-slate-50/90 border border-slate-200 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800">
                    유형별 보기 언어 세부 매핑{' '}
                    <span className="font-normal text-slate-500">
                      (칩을 클릭하면 특정 유형만 영어 보기 ↔ 한국어 보기로 자유롭게 전환할 수 있습니다)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#09396A]">
                      영어·숫자 보기 {currentModeEnSkills.length}개 · 한국어 보기{' '}
                      {currentModeKoSkills.length}개
                    </span>
                    {isAutoMappingCustomized && (
                      <button
                        type="button"
                        onClick={handleResetModeOptionDefaults}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-[#357DC7] bg-white border border-[#357DC7]/40 hover:bg-[#EAF2FB] transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        기출 기본값 복원
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 영어 보기 그룹 */}
                  <div className="bg-white rounded-xl border border-blue-200/90 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-[#09396A]">
                        🅰️ 영어(또는 숫자·도표 기호) 보기로 출제되는 유형
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        클릭 시 한국어로 변경
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentModeEnSkills.length === 0 ? (
                        <span className="text-[11px] text-slate-400">
                          선택된 영어 보기 유형이 없습니다.
                        </span>
                      ) : (
                        currentModeEnSkills.map((sk) => {
                          const highlighted = params.selectedSkills.includes(
                            sk.value
                          );
                          return (
                            <button
                              key={sk.value}
                              type="button"
                              title={`${sk.description}\n보기 형식: ${sk.optionStyleHintEn}`}
                              onClick={() =>
                                handleToggleSkillEnglishOption(sk.value)
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                                highlighted
                                  ? 'bg-[#09396A] text-white border-[#09396A]'
                                  : 'bg-[#EAF2FB] text-[#09396A] border-[#357DC7]/50 hover:bg-blue-100'
                              }`}
                            >
                              <span
                                className={`text-[9px] px-1 rounded font-extrabold ${
                                  highlighted
                                    ? 'bg-white/20 text-white'
                                    : 'bg-[#09396A] text-white'
                                }`}
                              >
                                EN
                              </span>
                              {sk.csatNo ? `${sk.csatNo} ${sk.label || sk.value}` : sk.value}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 한국어 보기 그룹 */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-slate-700">
                        가 한국어 보기로 출제되는 유형
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        클릭 시 영어 보기로 변경
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentModeKoSkills.length === 0 ? (
                        <span className="text-[11px] text-slate-400">
                          모든 유형이 영어 보기로 설정되어 있습니다.
                        </span>
                      ) : (
                        currentModeKoSkills.map((sk) => {
                          const highlighted = params.selectedSkills.includes(
                            sk.value
                          );
                          return (
                            <button
                              key={sk.value}
                              type="button"
                              title={`${sk.description}\n보기 형식: ${sk.optionStyleHintKo}`}
                              onClick={() =>
                                handleToggleSkillEnglishOption(sk.value)
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                                highlighted
                                  ? 'bg-slate-800 text-white border-slate-800 font-bold'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span
                                className={`text-[9px] px-1 rounded font-extrabold ${
                                  highlighted
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                KO
                              </span>
                              {sk.csatNo ? `${sk.csatNo} ${sk.label || sk.value}` : sk.value}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            현재 서답형 문항 형식만 선택되어 있어 객관식(5지선다) 보기 언어 설정은 생략됩니다. 5지선다 선택형 추가 시 보기 언어 옵션이 활성화됩니다.
          </div>
        )}
      </div>

      {/* 2. 어휘 개수 · 어휘 수준 · 필수 어휘 · 난이도 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-5 h-5 text-[#09396A]" />
          <h2 className="text-base font-extrabold text-slate-900">
            2. 어휘 개수(대본 길이) · 어휘 수준 · 난이도 설정
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 대본 목표 어휘 개수 */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                지문당 목표 영어 어휘(단어) 수
              </label>
              <span className="text-xs font-extrabold text-[#09396A] bg-[#EAF2FB] px-2.5 py-0.5 rounded-full">
                약 {params.targetWordCount}단어 · 예상 듣기 약 {estSeconds}초
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={220}
              step={5}
              value={params.targetWordCount}
              onChange={(e) =>
                onChangeParams({ targetWordCount: Number(e.target.value) })
              }
              className="w-full accent-[#09396A]"
            />
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {[
                { w: 80, label: '80단어 (짧음)' },
                { w: 120, label: '120단어 (표준)' },
                { w: 145, label: '145단어 (중장문)' },
                { w: 175, label: '175단어 (심화)' },
              ].map((preset) => (
                <button
                  key={preset.w}
                  type="button"
                  onClick={() => onChangeParams({ targetWordCount: preset.w })}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition ${
                    params.targetWordCount === preset.w
                      ? 'bg-[#09396A] text-white border-[#09396A]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                반드시 포함할 핵심 목표 어휘{' '}
                <span className="text-slate-400 font-normal">
                  (선택 · 쉼표로 구분)
                </span>
              </label>
              <input
                type="text"
                value={params.requiredWords}
                onChange={(e) =>
                  onChangeParams({ requiredWords: e.target.value })
                }
                placeholder="예: venue, auditorium, register, reusable (비워 두면 주제에 맞게 자동 선정)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#357DC7]"
              />
            </div>
          </div>

          {/* 어휘 수준 및 난이도 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                어휘 수준 선택 (교육과정 권장 어휘 풀 기준)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VOCAB_LEVELS.map((vl) => (
                  <button
                    key={vl.id}
                    type="button"
                    onClick={() =>
                      onChangeParams({ vocabLevelId: vl.id as VocabLevelId })
                    }
                    className={`text-left p-2.5 rounded-xl border transition ${
                      params.vocabLevelId === vl.id
                        ? 'bg-[#F4F8FD] border-[#09396A] ring-1 ring-[#09396A]'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">
                        {vl.shortLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      어휘 풀: {vl.wordPoolDesc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                문항 체감 난이도 (추론 깊이 및 패러프레이징 수준)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { lv: '하', desc: '명시적 단서 · 평이한 속도/구문' },
                    { lv: '중', desc: '적절한 재진술(패러프레이징) 포함' },
                    { lv: '상', desc: '복합 단서 추론 · 매력적 오답 강화' },
                  ] as { lv: DifficultyLevel; desc: string }[]
                ).map((d) => (
                  <button
                    key={d.lv}
                    type="button"
                    onClick={() => onChangeParams({ difficulty: d.lv })}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      params.difficulty === d.lv
                        ? 'bg-[#09396A] text-white border-[#09396A]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-extrabold">난이도 {d.lv}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        params.difficulty === d.lv
                          ? 'text-blue-100'
                          : 'text-slate-500'
                      }`}
                    >
                      {d.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 성취기준 · DELTA 수행지시어 · 평가 기능(자동 배정 포함) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-[#09396A]" />
            <h2 className="text-base font-extrabold text-slate-900">
              3. 2022 개정 교육과정 성취기준 및 DELTA 수행지시어 · 평가 기능(문항 유형)
            </h2>
          </div>
          <span className="text-[11px] font-bold text-[#09396A] bg-[#EAF2FB] px-2.5 py-0.5 rounded-full">
            교육부 고시 제2022-33호 [별책 14] 원문 적용
          </span>
        </div>

        {/* 성취기준 선택 */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold text-slate-700">
                「{params.subject}」 과목 성취기준 선택
              </label>
              {availableDomains.length > 1 && (
                <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setStdDomainTab('first')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      stdDomainTab === 'first'
                        ? 'bg-white text-[#09396A] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    (1) {availableDomains[0]} 영역 (
                    {standards.filter((s) => s.domain === availableDomains[0]).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStdDomainTab('second')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      stdDomainTab === 'second'
                        ? 'bg-white text-[#09396A] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    (2) {availableDomains[1]} 영역 (
                    {standards.filter((s) => s.domain === availableDomains[1]).length})
                    {standards.some(
                      (s) =>
                        s.domain === availableDomains[1] &&
                        params.selectedStandards.includes(s.text)
                    ) && (
                      <span className="ml-1 px-1 rounded bg-[#09396A] text-white text-[9px]">
                        선택됨
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStdDomainTab('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      stdDomainTab === 'all'
                        ? 'bg-white text-[#09396A] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    전체 ({standards.length})
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {params.selectedStandards.length > 0 && (
                <span className="text-[11px] font-bold text-[#357DC7]">
                  직접 선택: {params.selectedStandards.length}개
                </span>
              )}
              <button
                type="button"
                onClick={() => onChangeParams({ selectedStandards: [] })}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                  params.selectedStandards.length === 0
                    ? 'bg-[#09396A] text-white border-[#09396A]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                ✨ 자동 배정 (듣기 적합 성취기준 골고루)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleStandards.map((std) => {
              const checked = params.selectedStandards.includes(std.text);
              const recSkill =
                params.mode === 'ib'
                  ? std.recommendedSkillIb
                  : std.recommendedSkillStd;
              return (
                <button
                  key={std.code}
                  type="button"
                  onClick={() =>
                    onChangeParams({
                      selectedStandards: toggleArrayItem(
                        params.selectedStandards,
                        std.text
                      ),
                    })
                  }
                  className={`text-left px-3.5 py-2.5 rounded-xl border text-xs transition flex items-start gap-2.5 ${
                    checked
                      ? 'bg-[#F4F8FD] border-[#357DC7] text-[#09396A] font-bold'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="mt-0.5 accent-[#09396A]"
                  />
                  <div className="flex-1">
                    <span>{std.text}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-block px-1.5 py-0.2 rounded bg-[#09396A]/10 text-[10px] text-[#09396A] font-bold">
                        {std.domain}
                      </span>
                      <span className="inline-block px-1.5 py-0.2 rounded bg-slate-200/80 text-[10px] text-slate-700 font-semibold">
                        지시어: {std.directive}
                      </span>
                      <span className="inline-block px-1.5 py-0.2 rounded bg-blue-100/80 text-[10px] text-[#09396A] font-semibold">
                        추천 기능: {recSkill}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* DELTA 수행지시어 10종 */}
        <div className="pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 mb-2">
            DELTA 수행지시어 지정 (대구미래역량교육과정 영어 Ⅱ-5 수행 지시어 10종)
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onChangeParams({ selectedDirective: '' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                params.selectedDirective === ''
                  ? 'bg-[#09396A] text-white border-[#09396A]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              ✨ 자동 배정 (성취기준 연동)
            </button>
            {DIRECTIVES.map((dir) => (
              <button
                key={dir.value}
                type="button"
                onClick={() => onChangeParams({ selectedDirective: dir.value })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  params.selectedDirective === dir.value
                    ? 'bg-[#357DC7] text-white border-[#357DC7]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {dir.value}{' '}
                <span className="opacity-75 font-normal text-[11px]">
                  ({dir.en})
                </span>
              </button>
            ))}
          </div>
          {activeDirectiveMeta && (
            <div className="mt-2.5 p-3 rounded-xl bg-[#EAF2FB]/70 border border-[#357DC7]/30 text-xs text-[#09396A]">
              <b>
                [{activeDirectiveMeta.value} · {activeDirectiveMeta.en}]
              </b>{' '}
              {activeDirectiveMeta.description}
            </div>
          )}
        </div>

        {/* 세부 평가 기능(skill) 태그 + 성취기준 맞춤 자동 배정 */}
        <div className="pt-4 border-t border-slate-100">
          {params.mode === 'std' ? (
            <div className="p-3.5 rounded-xl bg-[#F4F8FD] border border-blue-200/80 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-extrabold text-[#09396A]">
                  [수능 영어 듣기 유형 연동]
                </span>{' '}
                기존 영어듣기 모드에서는 위 <b>1번 섹션</b>에서 설정한 수능 듣기 유형(
                {params.stdTypeMode === 'counts'
                  ? `개수 지정 ${stdAllocated}/${params.itemCount}문항`
                  : params.selectedSkills.length > 0
                  ? params.selectedSkills
                      .map((v) => {
                        const meta = STD_SKILLS.find((s) => s.value === v);
                        return meta?.csatNo
                          ? `${meta.csatNo} ${meta.label || v}`
                          : v;
                      })
                      .join(', ')
                  : '수능 1~17번 자동 균형 배정'}
                )이 그대로 출제에 반영됩니다.
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  측정할 듣기 인지 기능 (IB 평가 기능){' '}
                  <span className="text-slate-400 font-normal">
                    (자동 배정 시 선택된 성취기준에 가장 적합한 인지 기능으로 자동 연결)
                  </span>
                </label>
                {params.selectedSkills.length > 0 && (
                  <span className="text-[11px] font-bold text-[#357DC7]">
                    직접 선택됨: {params.selectedSkills.length}개 기능
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeParams({ selectedSkills: [] })}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition ${
                    params.selectedSkills.length === 0
                      ? 'bg-[#09396A] text-white border-[#09396A] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  ✨ 자동 배정 (성취기준 맞춤)
                </button>

                {skillsList.map((sk) => {
                  const active = params.selectedSkills.includes(sk.value);
                  const optIsEn = isSkillEnglishOption(sk.value);
                  return (
                    <button
                      key={sk.value}
                      type="button"
                      title={sk.description}
                      onClick={() =>
                        onChangeParams({
                          selectedSkills: toggleArrayItem(
                            params.selectedSkills,
                            sk.value
                          ),
                        })
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                        active
                          ? 'bg-[#EAF2FB] text-[#09396A] border-[#357DC7] font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{sk.value}</span>
                      {hasMcqSelected && (
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-extrabold ${
                            optIsEn
                              ? 'bg-blue-100 text-[#09396A]'
                              : 'bg-slate-200/80 text-slate-600'
                          }`}
                        >
                          {optIsEn ? 'EN보기' : 'KO보기'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {params.selectedSkills.length === 0 && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#F4F8FD] border border-blue-200/70 text-xs text-slate-700">
                  <span className="font-bold text-[#09396A]">
                    [성취기준 맞춤 자동 배정 활성화]
                  </span>{' '}
                  총 <b>{params.itemCount}문항</b> 각각의 성취기준에 맞추어 AI가 최적의 듣기 인지 기능(예:{' '}
                  <span className="font-semibold text-[#09396A]">
                    {autoMatchedSkillPreview.join(', ')}
                  </span>{' '}
                  등)을 중복 없이 자동 연결하여 출제합니다.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 4. 소재([별표 1]) 및 문항 수 연동 담화/대화 유형 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-[#09396A]" />
          <h2 className="text-base font-extrabold text-slate-900">
            4. 주제 · 소재([별표 1] 9대 범주) 및 듣기 자료 담화/대화 유형
          </h2>
        </div>

        {/* 소재 대범주 */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            소재 대범주 선택{' '}
            <span className="text-slate-400 font-normal">
              (복수 선택 시 {params.itemCount}문항에 나누어 반영)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                onChangeParams({ selectedTopics: [], selectedSubtopic: '' })
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                params.selectedTopics.length === 0
                  ? 'bg-[#09396A] text-white border-[#09396A]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              ✨ 자동 배정 (다양한 실생활 소재)
            </button>
            {TOPICS.map((tp) => {
              const selected = params.selectedTopics.includes(tp.value);
              return (
                <button
                  key={tp.value}
                  type="button"
                  title={tp.description}
                  onClick={() =>
                    onChangeParams({
                      selectedTopics: toggleArrayItem(
                        params.selectedTopics,
                        tp.value
                      ),
                    })
                  }
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                    selected
                      ? 'bg-[#357DC7] text-white border-[#357DC7]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tp.value}
                </button>
              );
            })}
          </div>
        </div>

        {matchingSubtopics.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              세부 소범주 지정{' '}
              <span className="text-slate-400 font-normal">(선택)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onChangeParams({ selectedSubtopic: '' })}
                className={`px-2.5 py-1 rounded-lg text-xs border ${
                  !params.selectedSubtopic
                    ? 'bg-[#EAF2FB] text-[#09396A] border-[#357DC7] font-bold'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                자동 선택
              </button>
              {matchingSubtopics.map((sub) => (
                <button
                  key={`${sub.parentTopic}-${sub.value}`}
                  type="button"
                  onClick={() => onChangeParams({ selectedSubtopic: sub.value })}
                  className={`px-2.5 py-1 rounded-lg text-xs border ${
                    params.selectedSubtopic === sub.value
                      ? 'bg-[#EAF2FB] text-[#09396A] border-[#357DC7] font-bold'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {sub.value}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 듣기 자료 담화/대화 유형 (문항 수 연동 & 자동 배정) */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                듣기 자료 담화 / 대화 유형 배분 (총 {params.itemCount}문항 연동)
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                여러 문항 출제 시 특정 유형으로만 쏠리지 않도록 자동 균형 배정하거나, 문항 수({params.itemCount}문항)에 맞춰 유형별 개수를 직접 지정할 수 있습니다.
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
              <button
                type="button"
                onClick={() => handleSwitchTextTypeMode('auto')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  params.textTypeMode !== 'counts'
                    ? 'bg-[#09396A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ✨ 자동 균형 배정
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTextTypeMode('counts')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  params.textTypeMode === 'counts'
                    ? 'bg-[#09396A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                문항 수별 개수 지정 ({textAllocated}/{params.itemCount}문항)
              </button>
            </div>
          </div>

          {params.textTypeMode !== 'counts' ? (
            <div className="p-4 rounded-xl bg-[#F4F8FD] border border-blue-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-700 leading-relaxed">
                <span className="font-extrabold text-[#09396A]">
                  [AI 자동 균형 배정]
                </span>{' '}
                총 <b>{params.itemCount}문항</b>의 성취기준과 문항 형식(예: 포스터 빈칸 → 안내 방송, 의도·이유 → 음성 메시지·2인 대화, 요지·관점 → 발표·인터뷰 등)에 맞춰{' '}
                <b>대화문과 담화문을 최적의 비율로 섞어</b> 자동 출제합니다.
              </div>
              <button
                type="button"
                onClick={() => handleSwitchTextTypeMode('counts')}
                className="px-3 py-1.5 rounded-lg bg-white border border-blue-300 text-xs font-bold text-[#09396A] hover:bg-blue-50 shrink-0"
              >
                직접 개수 조정하기 →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 배분 상태 바 */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-extrabold ${
                      textRemaining === 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {textAllocated} / {params.itemCount}문항 지정됨
                  </span>
                  <span className="text-slate-600">
                    {textRemaining === 0
                      ? `총 ${params.itemCount}문항의 담화·대화 유형 배분이 완료되었습니다.`
                      : `나머지 ${textRemaining}문항은 문항 특성에 맞춰 AI가 자동 배정합니다.`}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeParams({
                        textTypeCounts: buildRecommendedTextCounts(
                          params.itemCount
                        ),
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#357DC7] hover:underline"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    {params.itemCount}문항 추천 비율 채우기
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeParams({ textTypeCounts: {} })}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    초기화
                  </button>
                </div>
              </div>

              {/* 6개 담화/대화 유형별 스테퍼 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {TEXT_TYPES.map((tt) => {
                  const cnt = Number(params.textTypeCounts?.[tt.id] || 0);
                  return (
                    <div
                      key={tt.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                        cnt > 0
                          ? 'bg-[#F4F8FD] border-[#09396A] shadow-2xs'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900">
                          {tt.label}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {tt.desc}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdjustTextTypeCount(tt.id, -1)}
                          disabled={cnt <= 0}
                          className="w-7 h-7 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-35"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className={`w-12 text-center text-xs font-extrabold ${
                            cnt > 0 ? 'text-[#09396A]' : 'text-slate-400'
                          }`}
                        >
                          {cnt}문항
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustTextTypeCount(tt.id, 1)}
                          disabled={textAllocated >= params.itemCount}
                          className="w-7 h-7 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-35"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 구체적 상황 직접 입력 */}
        <div className="pt-3 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            구체적 상황/소재 직접 지정{' '}
            <span className="text-slate-400 font-normal">(선택)</span>
          </label>
          <input
            type="text"
            value={params.customTopicDetail}
            onChange={(e) =>
              onChangeParams({ customTopicDetail: e.target.value })
            }
            placeholder="예: 교내 도서관 야간 개방 안내, 동아리 부스 운영 회의, 다회용 컵 대여 등"
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#357DC7]"
          />
        </div>
      </div>

      {/* 5. 선택 확장 설정: [별표 2] 의사소통 기능 & [별표 4] 언어 형식(구문) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
        >
          <div>
            <span className="text-sm font-extrabold text-slate-800">
              선택 세부 설정: [별표 2] 의사소통 기능 · [별표 4] 언어 형식(구문) · 운영 방안 표
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              교과서 단원 핵심 표현이나 목표 문법 구문, 추가 프롬프트 지시사항을 지정할 때 펼쳐 주세요.
            </p>
          </div>
          {showAdvanced ? (
            <ChevronUp className="w-5 h-5 text-slate-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-500" />
          )}
        </button>

        {showAdvanced && (
          <div className="px-6 pb-6 pt-2 border-t border-slate-100 space-y-5">
            {/* 의사소통 기능 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                [별표 2] 의사소통 기능 선택
              </label>
              <div className="space-y-2.5">
                {EXPRESSION_GROUPS.map((grp) => (
                  <div key={grp.group}>
                    <div className="text-[11px] font-bold text-slate-500 mb-1">
                      {grp.group}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {grp.items.map((exp) => {
                        const sel = params.selectedExpressions.includes(exp);
                        return (
                          <button
                            key={exp}
                            type="button"
                            onClick={() =>
                              onChangeParams({
                                selectedExpressions: toggleArrayItem(
                                  params.selectedExpressions,
                                  exp
                                ),
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                              sel
                                ? 'bg-[#09396A] text-white border-[#09396A] font-semibold'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {exp}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 언어 형식(구문) */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                [별표 4] 핵심 언어 형식(구문) 선택
              </label>
              <div className="flex flex-wrap gap-1.5">
                {STRUCTURE_ITEMS.map((stItem) => {
                  const sel = params.selectedStructures.includes(stItem.id);
                  return (
                    <button
                      key={stItem.id}
                      type="button"
                      title={stItem.example}
                      onClick={() =>
                        onChangeParams({
                          selectedStructures: toggleArrayItem(
                            params.selectedStructures,
                            stItem.id
                          ),
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                        sel
                          ? 'bg-[#357DC7] text-white border-[#357DC7] font-semibold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {stItem.ko}{' '}
                      <span className="opacity-75">({stItem.id})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 운영 방안 포함 여부 & 추가 지시사항 */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.includeOperationGuide}
                  onChange={(e) =>
                    onChangeParams({ includeOperationGuide: e.target.checked })
                  }
                  className="mt-1 accent-[#09396A]"
                />
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    ‘가. 평가 운영 및 적용 방안’ 표 포함
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    교사용 문항 명세서 상단의 운영 방법 · 기대효과 · 채점 유의사항 표를 원안지에 함께 포함합니다.
                  </div>
                </div>
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  교사 추가 요청사항 (프롬프트)
                </label>
                <textarea
                  rows={2}
                  value={params.extraInstructions}
                  onChange={(e) =>
                    onChangeParams({ extraInstructions: e.target.value })
                  }
                  placeholder="예: 1번 문항은 숫자 할인 계산을 포함하고, 2번 문항은 환경 동아리 캠페인 포스터로 출제해 주세요."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#357DC7]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* 하단 액션 바 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        {generateError && !generating && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-800">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-bold leading-relaxed break-words">
                {generateError}
              </span>
            </div>
            {onOpenApiKeyModal && /API 키|API_KEY|만료/i.test(generateError) && (
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold shrink-0 transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                API 키 설정 열기
              </button>
            )}
          </div>
        )}

        {!hasApiKey && !generateError && !generating && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
            <span className="font-semibold">
              AI 자동 출제를 사용하려면 Gemini API 키가 필요합니다. (키 없이도 <b>직접 문항 출제 및 편집하기</b>로 바로 작성할 수 있습니다)
            </span>
            {onOpenApiKeyModal && (
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                API 키 입력하기
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {generating ? (
            <div className="flex items-center gap-2.5 text-sm font-bold text-[#09396A] min-w-0">
              <Loader2 className="w-5 h-5 animate-spin text-[#357DC7] shrink-0" />
              <div className="min-w-0">
                <div className="truncate">
                  {statusMessage || 'AI가 출제 원안을 작성하고 있습니다...'}
                </div>
                <div className="text-[11px] font-semibold text-slate-500">
                  경과 {generateElapsedSec}초 · 2문항 단위 병렬 고속 출제 중
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-800">
                출제 준비 완료: {params.grade} {params.subject} · 총{' '}
                {params.itemCount}문항
              </div>
              <div className="text-[11px] text-slate-500">
                {params.mode === 'std' ? (
                  <>
                    수능 유형:{' '}
                    {params.stdTypeMode === 'counts'
                      ? `개수 지정 (${stdAllocated}/${params.itemCount})`
                      : params.selectedSkills.length === 0
                      ? '수능 1~17번 자동 균형 배정'
                      : `${params.selectedSkills.length}개 유형 선택`}
                  </>
                ) : (
                  <>
                    IB 유형:{' '}
                    {params.questionFormatMode === 'counts'
                      ? `개수 지정 (${formatAllocated}/${params.itemCount})`
                      : `${params.questionFormats.length}종 자동 균형 배정`}
                  </>
                )}{' '}
                · 담화유형:{' '}
                {params.textTypeMode === 'counts'
                  ? `유형별 수량 지정 (${textAllocated}/${params.itemCount})`
                  : '문항별 자동 균형 배정'}
                {hasMcqSelected && (
                  <>
                    {' '}
                    · 객관식 보기:{' '}
                    {mcqOptionLanguage === 'en'
                      ? '전체 영어 보기'
                      : mcqOptionLanguage === 'ko'
                      ? '전체 한국어 보기'
                      : '기출 유형별 자동(EN/KO)'}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {generating && onCancelGenerate ? (
            <button
              type="button"
              onClick={onCancelGenerate}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-extrabold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              생성 중지
            </button>
          ) : (
            <button
              type="button"
              disabled={generating}
              onClick={onSkipToEditor}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50"
            >
              <Edit3 className="w-4 h-4" />
              직접 문항 출제 및 편집하기
            </button>
          )}

          <button
            type="button"
            disabled={generating}
            onClick={onGenerate}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r from-[#09396A] to-[#357DC7] hover:opacity-95 shadow-md transition disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating
              ? `AI 문항 자동 출제 중... (${generateElapsedSec}초)`
              : `✨ AI 문항 자동 출제하기 (${params.itemCount}문항)`}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

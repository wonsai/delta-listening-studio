import React, { useMemo } from 'react';
import {
  Check,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Wand2,
  ListOrdered,
  BookOpenCheck,
} from 'lucide-react';
import {
  DistributionMode,
  GenerationParams,
  McqOptionLanguageMode,
  QuestionFormatType,
} from '../types/assessment';
import {
  CSAT_CATEGORIES,
  QUESTION_FORMATS,
  STD_SKILLS,
  getDefaultEnglishOptionSkills,
} from '../data/taxonomy';
import {
  CsatDistributionPresetId,
  IB_ALL_FORMATS,
  IB_PAPER2_CORE_FORMATS,
  IbDistributionPresetId,
  buildCsatDistributionCounts,
  buildIbDistributionCounts,
  buildItemSlotPlan,
} from '../services/slotPlanner';

interface QuestionDistributionPanelProps {
  params: GenerationParams;
  onChangeParams: (patch: Partial<GenerationParams>) => void;
  onClearPreset?: () => void;
  showMcqLanguageBar?: boolean;
}

function sumCounts(map: Record<string, number | undefined>): number {
  return Object.values(map).reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
}

const IB_QUICK_SETS: Array<{
  id: IbDistributionPresetId;
  label: string;
  hint: string;
}> = [
  {
    id: 'ib_paper2_balanced',
    label: 'IB Paper 2 기출 균형',
    hint: '3지선다 · 빈칸(≤3단어) · 참인진술 · 화자/정보매칭 · 단답',
  },
  {
    id: 'ib_constructed_focus',
    label: 'IB 서답·노트테이킹 집중',
    hint: '빈칸 완성 · 영어 단답 · 정보 매칭 · T/F+근거',
  },
  {
    id: 'ib_dialogue_inference',
    label: 'IB 대화·토론 추론형',
    hint: '화자 매칭 · 참인 진술 · 3지선다 · T/F+근거',
  },
  {
    id: 'ib_daegu_hybrid',
    label: 'IB + 우리말 서술 혼합',
    hint: 'IB Paper 2 핵심 유형 + 대구형 우리말 서술 결합',
  },
];

const CSAT_QUICK_SETS: Array<{
  id: CsatDistributionPresetId;
  label: string;
  hint: string;
}> = [
  {
    id: 'csat_balanced',
    label: '수능 4대 영역 균형',
    hint: '대의(1~3) · 세부정보(5~10) · 간접말하기(11~15) · 복합(16~17)',
  },
  {
    id: 'csat_gist_detail',
    label: '대의 · 세부정보 (1~10번)',
    hint: '목적 · 의견 · 요지 · 할일 · 금액 · 이유 · 언급안됨 · 일치 · 도표',
  },
  {
    id: 'csat_indirect_speaking',
    label: '간접 말하기 집중 (11~15번)',
    hint: '짧은 응답 · 긴 응답 · 상황 설명 (영어 보기 중심)',
  },
  {
    id: 'csat_high_diff',
    label: '고난도 변별력 (6·10·13~17번)',
    hint: '금액 계산 · 도표 · 긴 응답 · 상황 설명 · 16~17번 복합 담화',
  },
];

export const QuestionDistributionPanel: React.FC<QuestionDistributionPanelProps> = ({
  params,
  onChangeParams,
  onClearPreset,
  showMcqLanguageBar = false,
}) => {
  const slotPreview = useMemo(() => buildItemSlotPlan(params), [params]);

  const activeEnglishSkillSet = useMemo(
    () => new Set(params.mcqEnglishSkills || getDefaultEnglishOptionSkills()),
    [params.mcqEnglishSkills]
  );

  const isSkillEnglishOption = (skillValue: string): boolean => {
    const mode = params.mcqOptionLanguage || 'auto';
    if (mode === 'en') return true;
    if (mode === 'ko') return false;
    return activeEnglishSkillSet.has(skillValue);
  };

  // 대구형(IB) 상태 계산
  const ibPaper2Formats = useMemo(
    () => IB_ALL_FORMATS.filter((f) => f.group === 'ib_paper2'),
    []
  );
  const ibExtensionFormats = useMemo(
    () => IB_ALL_FORMATS.filter((f) => f.group === 'daegu_ib'),
    []
  );

  const ibAllocated = sumCounts(
    (params.questionFormatCounts || {}) as Record<string, number | undefined>
  );
  const ibRemaining = Math.max(0, params.itemCount - ibAllocated);
  const ibSelectedFormats: QuestionFormatType[] = params.questionFormats.filter(
    (f) => f !== 'mcq_5'
  );

  const ibMcqSlotCount = slotPreview.filter((s) => s.format === 'ib_mcq_3').length;
  const ibConstructedSlotCount = slotPreview.length - ibMcqSlotCount;
  const ibPaper2SlotCount = slotPreview.filter((s) =>
    IB_PAPER2_CORE_FORMATS.includes(s.format)
  ).length;

  // 기존형(수능) 상태 계산
  const stdAllocated = sumCounts(params.stdTypeCounts || {});
  const stdRemaining = Math.max(0, params.itemCount - stdAllocated);

  const stdSpeakingSlotCount = slotPreview.filter(
    (s) => STD_SKILLS.find((sk) => sk.value === s.skill)?.csatPart === '간접 말하기'
  ).length;
  const stdListeningSlotCount = slotPreview.length - stdSpeakingSlotCount;
  const stdEnOptCount = slotPreview.filter((s) => s.mcqOptionLang === 'en').length;
  const stdKoOptCount = slotPreview.length - stdEnOptCount;

  // 핸들러: 대구형(IB)
  const handleToggleIbFormat = (fmtId: QuestionFormatType) => {
    onClearPreset?.();
    const cur = ibSelectedFormats.length > 0 ? ibSelectedFormats : IB_PAPER2_CORE_FORMATS;
    let next: QuestionFormatType[];
    if (cur.includes(fmtId)) {
      if (cur.length <= 1) return;
      next = cur.filter((x) => x !== fmtId);
    } else {
      next = [...cur, fmtId];
    }
    onChangeParams({
      questionFormatMode: 'auto',
      questionFormats: next,
    });
  };

  const handleAdjustIbCount = (fmtId: QuestionFormatType, delta: number) => {
    onClearPreset?.();
    const currentMap = { ...(params.questionFormatCounts || {}) };
    // 기존에 mcq_5가 남아있다면 정리
    delete currentMap.mcq_5;
    const curVal = Number(currentMap[fmtId] || 0);
    const currentTotal = sumCounts(currentMap as Record<string, number | undefined>);
    if (delta > 0 && currentTotal >= params.itemCount) return;
    const nextVal = Math.max(0, curVal + delta);
    if (nextVal === 0) {
      delete currentMap[fmtId];
    } else {
      currentMap[fmtId] = nextVal;
    }
    onChangeParams({
      questionFormatMode: 'counts',
      questionFormatCounts: currentMap,
    });
  };

  const handleSwitchIbMode = (mode: DistributionMode) => {
    onClearPreset?.();
    if (mode === 'counts' && ibAllocated === 0) {
      onChangeParams({
        questionFormatMode: 'counts',
        questionFormatCounts: buildIbDistributionCounts(
          'ib_paper2_balanced',
          params.itemCount
        ),
      });
    } else {
      onChangeParams({ questionFormatMode: mode });
    }
  };

  const handleApplyIbQuickSet = (presetId: IbDistributionPresetId) => {
    onClearPreset?.();
    const counts = buildIbDistributionCounts(presetId, params.itemCount);
    const usedFormats = Object.keys(counts) as QuestionFormatType[];
    onChangeParams({
      questionFormatMode: 'counts',
      questionFormats: usedFormats,
      questionFormatCounts: counts,
    });
  };

  // 핸들러: 기존형(수능)
  const handleToggleCsatSkill = (skillVal: string) => {
    onClearPreset?.();
    const next = params.selectedSkills.includes(skillVal)
      ? params.selectedSkills.filter((v) => v !== skillVal)
      : [...params.selectedSkills, skillVal];
    onChangeParams({
      stdTypeMode: 'auto',
      selectedSkills: next,
    });
  };

  const handleAdjustCsatCount = (skillVal: string, delta: number) => {
    onClearPreset?.();
    const currentMap = { ...(params.stdTypeCounts || {}) };
    const curVal = Number(currentMap[skillVal] || 0);
    const currentTotal = sumCounts(currentMap);
    if (delta > 0 && currentTotal >= params.itemCount) return;
    const nextVal = Math.max(0, curVal + delta);
    if (nextVal === 0) {
      delete currentMap[skillVal];
    } else {
      currentMap[skillVal] = nextVal;
    }
    onChangeParams({
      stdTypeMode: 'counts',
      stdTypeCounts: currentMap,
    });
  };

  const handleSwitchCsatMode = (mode: DistributionMode) => {
    onClearPreset?.();
    if (mode === 'counts' && stdAllocated === 0) {
      onChangeParams({
        stdTypeMode: 'counts',
        stdTypeCounts: buildCsatDistributionCounts('csat_balanced', params.itemCount),
      });
    } else {
      onChangeParams({ stdTypeMode: mode });
    }
  };

  const handleApplyCsatQuickSet = (presetId: CsatDistributionPresetId) => {
    onClearPreset?.();
    const counts = buildCsatDistributionCounts(presetId, params.itemCount);
    onChangeParams({
      stdTypeMode: 'counts',
      stdTypeCounts: counts,
      selectedSkills: Object.keys(counts),
    });
  };

  // =========================================================================
  // 1) 기존 영어듣기 유형 (수능 문제 연계)
  // =========================================================================
  if (params.mode === 'std') {
    const isCounts = params.stdTypeMode === 'counts';
    const allocPct = Math.min(100, Math.round((stdAllocated / Math.max(1, params.itemCount)) * 100));

    return (
      <div className="space-y-4">
        {/* 상단 헤더 & 자동/개수지정 전환 */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-800 text-white">
                수능 1~17번 연계
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                기존형(수능 연계) 문항 유형 배분 방식 ({params.itemCount}문항 연동 · 5지선다)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              대학수학능력시험 영어 듣기 공식 4대 영역(대의 파악 · 세부 정보 · 간접 말하기 · 복합 이해)에 맞춰 배분하며, 출제 시 수능 번호순(1번→17번)으로 자동 정렬됩니다.
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleSwitchCsatMode('auto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                !isCounts
                  ? 'bg-[#09396A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✨ 수능 자동 균형
            </button>
            <button
              type="button"
              onClick={() => handleSwitchCsatMode('counts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                isCounts
                  ? 'bg-[#09396A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              유형별 개수 지정 ({stdAllocated}/{params.itemCount})
            </button>
          </div>
        </div>

        {/* 수능 영역별 원클릭 배분 바 + 요약 지표 */}
        <div className="rounded-xl bg-[#F4F8FD] border border-blue-200/80 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#09396A] mr-1">
                <Wand2 className="w-3.5 h-3.5 text-[#357DC7]" />
                {params.itemCount}문항 수능 배분 채우기:
              </span>
              {CSAT_QUICK_SETS.map((qs) => (
                <button
                  key={qs.id}
                  type="button"
                  title={qs.hint}
                  onClick={() => handleApplyCsatQuickSet(qs.id)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-[#09396A] border border-blue-200 hover:bg-blue-50 hover:border-[#357DC7] transition"
                >
                  {qs.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!isCounts && params.selectedSkills.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearPreset?.();
                    onChangeParams({ selectedSkills: [] });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#357DC7] hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  전체 자동 배정 ({params.selectedSkills.length}개 해제)
                </button>
              )}
              {isCounts && stdAllocated > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearPreset?.();
                    onChangeParams({ stdTypeCounts: {} });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                >
                  <RotateCcw className="w-3 h-3" />
                  개수 초기화
                </button>
              )}
            </div>
          </div>

          {/* 구성 요약 & 진행 바 */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-blue-200/60 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-bold text-slate-700">
                순수 듣기 {stdListeningSlotCount} · 간접 말하기 {stdSpeakingSlotCount}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-bold text-slate-700">
                KO보기 {stdKoOptCount} · EN/숫자보기 {stdEnOptCount}
              </span>
              {isCounts && (
                <span
                  className={`px-2 py-0.5 rounded-full font-extrabold ${
                    stdRemaining === 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {stdRemaining === 0
                    ? `${params.itemCount}/${params.itemCount}문항 배정 완료`
                    : `${stdAllocated}/${params.itemCount}문항 지정 (잔여 ${stdRemaining}문항 자동)`}
                </span>
              )}
            </div>

            {isCounts && (
              <div className="w-28 h-2 rounded-full bg-blue-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    stdRemaining === 0 ? 'bg-emerald-500' : 'bg-[#357DC7]'
                  }`}
                  style={{ width: `${allocPct}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* 수능 4대 영역별 유형 카드 */}
        <div className="space-y-3">
          {CSAT_CATEGORIES.map((cat, catIdx) => {
            const catSkills = STD_SKILLS.filter((s) => s.csatCategory === cat.id);
            const catSelectedCount = isCounts
              ? catSkills.reduce(
                  (acc, s) => acc + Number(params.stdTypeCounts?.[s.value] || 0),
                  0
                )
              : catSkills.filter((s) => params.selectedSkills.includes(s.value)).length;

            return (
              <div
                key={cat.id}
                className="rounded-xl border border-slate-200/90 bg-white p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#EAF2FB] text-[#09396A] text-[10px] font-extrabold flex items-center justify-center">
                      {catIdx + 1}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900">
                      {cat.id}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      수능 {cat.rangeLabel}
                    </span>
                    <span className="hidden sm:inline text-[11px] text-slate-400">
                      · {cat.description}
                    </span>
                  </div>
                  {catSelectedCount > 0 && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#09396A] text-white">
                      {isCounts ? `${catSelectedCount}문항 배정` : `${catSelectedCount}유형 선택`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {catSkills.map((sk) => {
                    const optIsEn = isSkillEnglishOption(sk.value);
                    const cnt = Number(params.stdTypeCounts?.[sk.value] || 0);
                    const selected = !isCounts && params.selectedSkills.includes(sk.value);

                    if (!isCounts) {
                      return (
                        <button
                          key={sk.value}
                          type="button"
                          onClick={() => handleToggleCsatSkill(sk.value)}
                          title={sk.description}
                          className={`text-left p-2.5 rounded-xl border transition ${
                            selected
                              ? 'bg-[#F4F8FD] border-[#09396A] ring-1 ring-[#09396A]'
                              : 'bg-slate-50/50 border-slate-200 hover:bg-white hover:border-[#357DC7]/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold shrink-0 ${
                                  selected
                                    ? 'bg-[#09396A] text-white'
                                    : 'bg-slate-800 text-white'
                                }`}
                              >
                                {sk.csatNo}
                              </span>
                              <span className="text-xs font-extrabold text-slate-900 truncate">
                                {sk.label || sk.value}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold ${
                                  optIsEn
                                    ? 'bg-blue-100 text-[#09396A]'
                                    : 'bg-slate-200/80 text-slate-600'
                                }`}
                              >
                                {optIsEn ? 'EN보기' : 'KO보기'}
                              </span>
                              {selected && (
                                <Check className="w-3.5 h-3.5 text-[#09396A]" />
                              )}
                            </div>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-slate-500">
                            <span className="truncate">{sk.csatTextType}</span>
                            <span className="shrink-0 font-semibold text-slate-400">
                              {sk.csatMarks}
                            </span>
                          </div>
                        </button>
                      );
                    }

                    return (
                      <div
                        key={sk.value}
                        title={sk.description}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                          cnt > 0
                            ? 'bg-[#F4F8FD] border-[#09396A] shadow-2xs'
                            : 'bg-slate-50/40 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-slate-800 text-white shrink-0">
                              {sk.csatNo}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900 truncate">
                              {sk.label || sk.value}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                            {sk.csatTextType} · {optIsEn ? 'EN/숫자 보기' : 'KO 보기'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAdjustCsatCount(sk.value, -1)}
                            disabled={cnt <= 0}
                            className="w-6 h-6 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-35"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span
                            className={`w-8 text-center text-xs font-extrabold ${
                              cnt > 0 ? 'text-[#09396A]' : 'text-slate-400'
                            }`}
                          >
                            {cnt}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustCsatCount(sk.value, 1)}
                            disabled={stdAllocated >= params.itemCount}
                            className="w-6 h-6 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-35"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 간편 모드일 때 보기 언어 빠른 전환 바 */}
        {showMcqLanguageBar && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200">
            <span className="text-[11px] font-bold text-slate-600">
              객관식 보기(①~⑤) 언어:
            </span>
            {(
              [
                { mode: 'auto' as McqOptionLanguageMode, label: '수능 기출 기준 자동 (영/한)' },
                { mode: 'ko' as McqOptionLanguageMode, label: '전체 한국어' },
                { mode: 'en' as McqOptionLanguageMode, label: '전체 영어' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => onChangeParams({ mcqOptionLanguage: opt.mode })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                  (params.mcqOptionLanguage || 'auto') === opt.mode
                    ? 'bg-[#EAF2FB] text-[#09396A] border-[#357DC7]'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* 실시간 수능 출제 순서 미리보기 (N문항 연동) */}
        <div className="rounded-xl bg-slate-900 text-white p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <ListOrdered className="w-4 h-4 text-sky-300" />
              실시간 수능 연계 출제 설계표 ({params.itemCount}문항 연동 미리보기)
            </div>
            <span className="text-[10px] text-slate-300">
              ※ 수능 4번(그림 내용 일치) 제외 · 1번→17번 공식 순서 자동 정렬
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {slotPreview.map((slot) => {
              const skMeta = STD_SKILLS.find((s) => s.value === slot.skill);
              return (
                <div
                  key={slot.itemNo}
                  className="rounded-lg bg-white/10 border border-white/15 px-2.5 py-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-extrabold text-sky-300">
                      {slot.itemNo}번 문항
                    </span>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-white/20 text-white">
                      수능 {skMeta?.csatNo || '-'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {skMeta?.label || slot.skill}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-300">
                    <span className="truncate">{slot.textType}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold shrink-0 ${
                        slot.mcqOptionLang === 'en'
                          ? 'bg-sky-500/30 text-sky-100'
                          : 'bg-slate-600/70 text-slate-100'
                      }`}
                    >
                      {slot.mcqOptionLang === 'en' ? 'EN보기' : 'KO보기'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2) 대구형 영어듣기 평가 (IB 기출문제 유형 반영)
  // =========================================================================
  const isIbCounts = params.questionFormatMode === 'counts';
  const ibAllocPct = Math.min(
    100,
    Math.round((ibAllocated / Math.max(1, params.itemCount)) * 100)
  );
  const paper2Pct = Math.round(
    (ibPaper2SlotCount / Math.max(1, slotPreview.length)) * 100
  );

  const renderIbFormatGroup = (
    title: string,
    subtitle: string,
    accent: 'navy' | 'emerald',
    formats: typeof IB_ALL_FORMATS
  ) => (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              accent === 'navy' ? 'bg-[#09396A]' : 'bg-emerald-600'
            }`}
          />
          <span
            className={`text-xs font-extrabold ${
              accent === 'navy' ? 'text-[#09396A]' : 'text-emerald-800'
            }`}
          >
            {title}
          </span>
          <span className="hidden sm:inline text-[11px] text-slate-400">
            · {subtitle}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {formats.map((fmt) => {
          const cnt = Number(params.questionFormatCounts?.[fmt.id] || 0);
          const selected = !isIbCounts && ibSelectedFormats.includes(fmt.id);

          if (!isIbCounts) {
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => handleToggleIbFormat(fmt.id)}
                className={`text-left p-3 rounded-xl border transition flex flex-col justify-between gap-1.5 ${
                  selected
                    ? accent === 'navy'
                      ? 'bg-[#F4F8FD] border-[#09396A] ring-1 ring-[#09396A]'
                      : 'bg-emerald-50/60 border-emerald-700 ring-1 ring-emerald-700'
                    : 'bg-slate-50/40 border-slate-200 hover:bg-white hover:border-[#357DC7]/60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-xs font-extrabold text-slate-900 leading-snug">
                      {fmt.label}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        fmt.isConstructed
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-[#09396A]'
                      }`}
                    >
                      {fmt.isConstructed ? '서답형' : '3지선다'}
                    </span>
                  </div>
                  {fmt.ibTaskInstruction && (
                    <div className="text-[10px] font-mono text-[#357DC7] truncate">
                      “{fmt.ibTaskInstruction}”
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                    {fmt.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 text-[10px] text-slate-500">
                  <span>{fmt.ibTextPairing || fmt.pdfRef}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-[#09396A]">
                    {fmt.typicalMarks}
                    {selected && <Check className="w-3.5 h-3.5 text-[#09396A]" />}
                  </span>
                </div>
              </button>
            );
          }

          return (
            <div
              key={fmt.id}
              className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition ${
                cnt > 0
                  ? accent === 'navy'
                    ? 'bg-[#F4F8FD] border-[#09396A] shadow-2xs'
                    : 'bg-emerald-50/60 border-emerald-700 shadow-2xs'
                  : 'bg-slate-50/40 border-slate-200'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-extrabold text-slate-900 truncate">
                    {fmt.label}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                      fmt.isConstructed
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-[#09396A]'
                    }`}
                  >
                    {fmt.isConstructed ? '서답형' : '3지선다'}
                  </span>
                </div>
                {fmt.ibTaskInstruction && (
                  <div className="text-[10px] font-mono text-[#357DC7] truncate">
                    “{fmt.ibTaskInstruction}”
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                <span className="text-[10px] text-slate-500 truncate">
                  {fmt.pdfRef} · {fmt.typicalMarks}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAdjustIbCount(fmt.id, -1)}
                    disabled={cnt <= 0}
                    className="w-6 h-6 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-35"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span
                    className={`w-10 text-center text-xs font-extrabold ${
                      cnt > 0 ? 'text-[#09396A]' : 'text-slate-400'
                    }`}
                  >
                    {cnt}문항
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustIbCount(fmt.id, 1)}
                    disabled={ibAllocated >= params.itemCount}
                    className="w-6 h-6 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-35"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 상단 헤더 & 자동/개수지정 전환 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#09396A] text-white">
              IB Paper 2 기출 반영
            </span>
            <h3 className="text-sm font-extrabold text-slate-900">
              대구형(IB 기출 유형) 문항 형식 배분 방식 ({params.itemCount}문항 연동)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            IB DP English B Paper 2 Listening 공식 기출 6유형(3지선다 · 3단어 빈칸 · 참인 진술 · 영어 단답 · 화자 매칭 · 정보/문장 매칭)과 IB 확장 사고력 서답 3유형을 문항 수에 맞춰 정교하게 배분합니다.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleSwitchIbMode('auto')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              !isIbCounts
                ? 'bg-[#09396A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ✨ IB 자동 균형
          </button>
          <button
            type="button"
            onClick={() => handleSwitchIbMode('counts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              isIbCounts
                ? 'bg-[#09396A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            유형별 개수 지정 ({ibAllocated}/{params.itemCount})
          </button>
        </div>
      </div>

      {/* IB 기출 배분 원클릭 채우기 바 + 구성 요약 */}
      <div className="rounded-xl bg-[#F4F8FD] border border-blue-200/80 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#09396A] mr-1">
              <Sparkles className="w-3.5 h-3.5 text-[#357DC7]" />
              {params.itemCount}문항 IB 배분 채우기:
            </span>
            {IB_QUICK_SETS.map((qs) => (
              <button
                key={qs.id}
                type="button"
                title={qs.hint}
                onClick={() => handleApplyIbQuickSet(qs.id)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-[#09396A] border border-blue-200 hover:bg-blue-50 hover:border-[#357DC7] transition"
              >
                {qs.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isIbCounts ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClearPreset?.();
                    onChangeParams({ questionFormats: IB_PAPER2_CORE_FORMATS });
                  }}
                  className="text-[11px] font-bold text-[#357DC7] hover:underline"
                >
                  Paper 2 6종만
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearPreset?.();
                    onChangeParams({
                      questionFormats: IB_ALL_FORMATS.map((f) => f.id),
                    });
                  }}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                >
                  전체 9종
                </button>
              </>
            ) : (
              ibAllocated > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearPreset?.();
                    onChangeParams({ questionFormatCounts: {} });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                >
                  <RotateCcw className="w-3 h-3" />
                  개수 초기화
                </button>
              )
            )}
          </div>
        </div>

        {/* 구성 요약 & 배정 진행 바 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-blue-200/60 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-bold text-slate-700">
              IB 3지선다 {ibMcqSlotCount} · 서답형 {ibConstructedSlotCount}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-bold text-[#09396A]">
              IB Paper 2 기출 비중 {paper2Pct}% ({ibPaper2SlotCount}/{slotPreview.length})
            </span>
            {isIbCounts && (
              <span
                className={`px-2 py-0.5 rounded-full font-extrabold ${
                  ibRemaining === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {ibRemaining === 0
                  ? `${params.itemCount}/${params.itemCount}문항 배정 완료`
                  : `${ibAllocated}/${params.itemCount}문항 지정 (잔여 ${ibRemaining}문항 자동)`}
              </span>
            )}
          </div>

          {isIbCounts && (
            <div className="w-28 h-2 rounded-full bg-blue-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  ibRemaining === 0 ? 'bg-emerald-500' : 'bg-[#357DC7]'
                }`}
                style={{ width: `${ibAllocPct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 그룹 1: IB DP English B Paper 2 공식 기출 유형 (6종) */}
      {renderIbFormatGroup(
        'IB DP English B Paper 2 공식 기출 유형 (6종)',
        '실제 IB Listening 기출 지시문 및 Accept/Reject Markscheme 기준 적용',
        'navy',
        ibPaper2Formats
      )}

      {/* 그룹 2: IB 확장 · 대구형 사고력 서답 유형 (3종) */}
      {renderIbFormatGroup(
        'IB 확장 · 대구형 사고력 서답 유형 (3종)',
        'IB MYP·DP 근거 판별 / 순서 조직 및 대구형 우리말 서술 연계',
        'emerald',
        ibExtensionFormats
      )}

      {/* 실시간 IB 출제 설계표 미리보기 (N문항 연동) */}
      <div className="rounded-xl bg-[#09396A] text-white p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold">
            <BookOpenCheck className="w-4 h-4 text-sky-300" />
            실시간 대구형(IB) 문항 배정 설계표 ({params.itemCount}문항 연동 미리보기)
          </div>
          <span className="text-[10px] text-blue-200">
            IB Markscheme(허용/불허·부분점수) 및 수행지시어 자동 연계
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {slotPreview.map((slot) => {
            const fmtMeta = QUESTION_FORMATS.find((f) => f.id === slot.format);
            const isPaper2 = IB_PAPER2_CORE_FORMATS.includes(slot.format);
            return (
              <div
                key={slot.itemNo}
                className="rounded-lg bg-white/10 border border-white/15 px-2.5 py-2 space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-extrabold text-sky-200">
                    {slot.itemNo}번 문항
                  </span>
                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                      isPaper2
                        ? 'bg-sky-400/25 text-sky-100'
                        : 'bg-emerald-400/25 text-emerald-100'
                    }`}
                  >
                    {isPaper2 ? 'Paper 2' : 'IB 확장'}
                  </span>
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {fmtMeta?.shortBadge || slot.format}
                </div>
                <div className="flex items-center justify-between gap-1 text-[10px] text-blue-100/90">
                  <span className="truncate">{slot.textType}</span>
                  <span className="shrink-0 text-sky-200 font-semibold">
                    {slot.skill}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

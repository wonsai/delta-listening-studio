import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Volume2,
  CheckCircle2,
  PlusCircle,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Wand2,
} from 'lucide-react';
import {
  DifficultyLevel,
  GenerationParams,
  ListeningItem,
  QuestionFormatType,
  RubricRow,
} from '../types/assessment';
import {
  DIRECTIVES,
  IB_SKILLS,
  QUESTION_FORMATS,
  STD_SKILLS,
  VOCAB_LEVELS,
  getAchievementStandardsForSubject,
  getSubjectInfo,
} from '../data/taxonomy';
import { DEFAULT_OPERATION_GUIDE } from '../data/sampleItems';
import {
  ItemValidationReport,
  validateListeningItem,
} from '../services/itemValidator';
import {
  countTranscriptWords,
  detectSpeakers,
  estimateDurationSec,
  formatDuration,
} from '../services/wordUtils';

interface Step3Props {
  items: ListeningItem[];
  params: GenerationParams;
  activeIndex: number;
  onSelectIndex: (idx: number) => void;
  onUpdateItem: (id: string, patch: Partial<ListeningItem>) => void;
  onAddItem: () => void;
  onDuplicateItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onMoveItem: (index: number, dir: -1 | 1) => void;
  onRefineItem: (item: ListeningItem, instruction: string) => Promise<void>;
  onAuditItem: (item: ListeningItem) => Promise<void>;
  onAuditAllItems: (onlyFlagged?: boolean) => Promise<void>;
  refiningId: string | null;
  auditingAll: boolean;
  auditProgressText: string;
  onBack: () => void;
  onNext: () => void;
}

const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤'];

export const Step3Editor: React.FC<Step3Props> = ({
  items,
  params,
  activeIndex,
  onSelectIndex,
  onUpdateItem,
  onAddItem,
  onDuplicateItem,
  onDeleteItem,
  onMoveItem,
  onRefineItem,
  onAuditItem,
  onAuditAllItems,
  refiningId,
  auditingAll,
  auditProgressText,
  onBack,
  onNext,
}) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [showMetadata, setShowMetadata] = useState(false);
  const [showStudentPreview, setShowStudentPreview] = useState(false);

  // 모든 문항에 대한 실시간 자동 타당도·구어체 검수 리포트
  const reportsById = useMemo(() => {
    const map: Record<string, ItemValidationReport> = {};
    for (const it of items) {
      map[it.id] = validateListeningItem(it, params.targetWordCount);
    }
    return map;
  }, [items, params.targetWordCount]);

  const summaryCounts = useMemo(() => {
    let pass = 0;
    let warn = 0;
    let err = 0;
    for (const it of items) {
      const rep = reportsById[it.id];
      if (!rep || rep.status === 'pass') pass++;
      else if (rep.status === 'error') err++;
      else warn++;
    }
    return { pass, warn, err, flagged: warn + err };
  }, [items, reportsById]);

  const item = items[activeIndex] || items[0];

  if (!item) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4">
        <p className="text-base font-bold text-slate-700">
          현재 출제된 문항이 없습니다.
        </p>
        <p className="text-xs text-slate-500">
          직접 문항을 출제하여 편집하거나, 2단계에서 AI로 문항을 자동 출제할 수 있습니다.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onAddItem}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
          >
            + 직접 문항 출제하기
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#09396A] hover:bg-[#0c4b8a] text-white transition"
          >
            2단계에서 AI 자동 출제하기
          </button>
        </div>
      </div>
    );
  }

  const currentReport =
    reportsById[item.id] || validateListeningItem(item, params.targetWordCount);
  const wordCount = countTranscriptWords(item.transcript);
  const estSec = estimateDurationSec(item.transcript, 1.0);
  const speakers = detectSpeakers(item.transcript);
  const parsedItemSubject = item.gradeSubject.includes('/')
    ? item.gradeSubject.split('/')[1].trim()
    : '';
  const activeItemSubject =
    (parsedItemSubject && getSubjectInfo(parsedItemSubject)?.subject) ||
    params.subject;
  const subjectStandards = getAchievementStandardsForSubject(activeItemSubject);
  const standardDomains = Array.from(
    new Set(subjectStandards.map((s) => s.domain))
  );
  const skillsPool = item.mode === 'ib' ? IB_SKILLS : STD_SKILLS;
  const isRefining = refiningId === item.id;
  const busyAny = Boolean(refiningId) || auditingAll;

  const stdCodeOnly =
    item.achievementStandard.match(/^\[[^\]]+\]/)?.[0] || '성취기준';

  const isIb3Choice = item.questionFormat === 'ib_mcq_3';
  const choiceIndices = isIb3Choice ? [0, 1, 2] : [0, 1, 2, 3, 4];
  const choiceMarkers = isIb3Choice ? ['A.', 'B.', 'C.'] : CIRCLED_NUMS;

  const handleFormatChange = (fmt: QuestionFormatType) => {
    const isConstructed = fmt !== 'mcq_5' && fmt !== 'ib_mcq_3';
    const nextRubric: RubricRow[] =
      isConstructed && item.rubricRows.length === 0
        ? [
            {
              id: `r-${Date.now()}-1`,
              scoreLabel: '3점',
              criteria: '핵심 요소를 모두 정확하게 작성한 경우',
            },
            {
              id: `r-${Date.now()}-2`,
              scoreLabel: '2점',
              criteria: '핵심 요소 중 일부만 정확하게 작성한 경우',
            },
            {
              id: `r-${Date.now()}-3`,
              scoreLabel: '1점',
              criteria: '표면적인 정보 일부만 작성한 경우',
            },
            {
              id: `r-${Date.now()}-4`,
              scoreLabel: '0점',
              criteria: '오답이거나 답안을 작성하지 않은 경우',
            },
          ]
        : item.rubricRows;

    const nextOptions =
      fmt === 'ib_mcq_3'
        ? [0, 1, 2].map((i) => item.options[i] || '')
        : fmt === 'mcq_5'
        ? [0, 1, 2, 3, 4].map((i) => item.options[i] || '')
        : item.options;

    onUpdateItem(item.id, {
      questionFormat: fmt,
      isConstructedResponse: isConstructed,
      options: nextOptions,
      correctChoice:
        fmt === 'ib_mcq_3'
          ? Math.min(3, Math.max(1, item.correctChoice || 1))
          : Math.min(5, Math.max(1, item.correctChoice || 1)),
      rubricRows: nextRubric,
      evalMethod: isConstructed
        ? '정기시험 혹은 수행평가(서술형/서답형)'
        : fmt === 'ib_mcq_3'
        ? '대구형(IB) 영어듣기 평가(3지선다 선택형)'
        : '정기시험(선택형)',
    });
  };

  const handleRubricChange = (
    rowId: string,
    field: 'scoreLabel' | 'criteria',
    val: string
  ) => {
    const updated = item.rubricRows.map((r) =>
      r.id === rowId ? { ...r, [field]: val } : r
    );
    onUpdateItem(item.id, { rubricRows: updated });
  };

  const handleAddRubricRow = () => {
    const newRow: RubricRow = {
      id: `rub-${Date.now()}`,
      scoreLabel: '0점',
      criteria: '세부 채점 기준을 입력하세요.',
    };
    onUpdateItem(item.id, { rubricRows: [...item.rubricRows, newRow] });
  };

  const handleDeleteRubricRow = (rowId: string) => {
    if (item.rubricRows.length <= 1) return;
    onUpdateItem(item.id, {
      rubricRows: item.rubricRows.filter((r) => r.id !== rowId),
    });
  };

  const triggerQuickRefine = async (presetText: string) => {
    await onRefineItem(item, presetText);
    setAiPrompt('');
  };

  return (
    <div className="space-y-5">
      {/* 상단 안내 & 네비게이션 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold text-[#357DC7] uppercase tracking-wider">
            STEP 3 OF 4 · 자동 타당도 검수 및 출제 원안 편집
          </div>
          <h1 className="text-xl font-extrabold text-[#09396A] mt-0.5">
            자동 검수 리포트로 오류를 확인하고 핵심 문항만 빠르게 다듬으세요
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            읽기 문형 오류·어색한 직역 어휘·난이도 초과 문장을 실시간으로 감지합니다. 수정된 내용은 음원(MP3)과 한글(HWPX)에 즉시 반영됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            출제 조건 설정
          </button>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-[#09396A] hover:bg-[#0c4b8a] shadow-xs transition"
          >
            4단계: 원어민 음성(MP3) · HWPX 출력
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 좌측 문항 목록 사이드바 */}
        <aside
          style={{ top: 'var(--header-offset, 9rem)' }}
          className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs lg:sticky transition-[top] duration-200 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700">
              문항 목록 ({items.length}문항)
            </span>
            <button
              type="button"
              onClick={onAddItem}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#EAF2FB] text-[#09396A] hover:bg-blue-100 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              문항 추가
            </button>
          </div>

          {/* 전체 문항 자동 검수 요약 및 일괄 교정 버튼 */}
          <div
            className={`p-3 rounded-xl border text-xs space-y-2 ${
              summaryCounts.err > 0
                ? 'bg-rose-50/70 border-rose-200'
                : summaryCounts.warn > 0
                ? 'bg-amber-50/70 border-amber-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between font-extrabold">
              <span className="inline-flex items-center gap-1 text-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-[#09396A]" />
                자동 타당도 점검
              </span>
              <span
                className={`text-[11px] ${
                  summaryCounts.err > 0
                    ? 'text-rose-700'
                    : summaryCounts.warn > 0
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {summaryCounts.flagged === 0
                  ? `전체 통과 (${summaryCounts.pass})`
                  : `오류 ${summaryCounts.err} · 주의 ${summaryCounts.warn}`}
              </span>
            </div>

            {auditingAll ? (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#09396A]">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>{auditProgressText || '일괄 검수 진행 중...'}</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={busyAny}
                onClick={() =>
                  onAuditAllItems(summaryCounts.flagged > 0)
                }
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold text-white bg-[#09396A] hover:bg-[#0c4b8a] transition disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5" />
                {summaryCounts.flagged > 0
                  ? `문제 문항 ${summaryCounts.flagged}개 일괄 AI 교정`
                  : '전체 문항 AI 원어민 정밀 검수'}
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
            {items.map((it, idx) => {
              const active = idx === activeIndex;
              const wc = countTranscriptWords(it.transcript);
              const rep = reportsById[it.id];
              const fmtBadge =
                QUESTION_FORMATS.find((f) => f.id === it.questionFormat)
                  ?.shortBadge || (it.isConstructedResponse ? '서답형' : '선택형');

              return (
                <div
                  key={it.id}
                  onClick={() => onSelectIndex(idx)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    active
                      ? 'bg-[#09396A] text-white border-[#09396A] shadow-xs'
                      : 'bg-slate-50/70 text-slate-800 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold">
                        문항 {it.itemNo}
                      </span>
                      {rep && rep.status === 'pass' && (
                        <span
                          title="자동 타당도 점검 통과"
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                            active
                              ? 'bg-emerald-400/25 text-emerald-200'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          정상
                        </span>
                      )}
                      {rep && rep.status === 'warning' && (
                        <span
                          title={`주의 ${rep.warningCount}건`}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                            active
                              ? 'bg-amber-400/30 text-amber-200'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          주의 {rep.warningCount}
                        </span>
                      )}
                      {rep && rep.status === 'error' && (
                        <span
                          title={`오류 ${rep.errorCount}건`}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                            active
                              ? 'bg-rose-400/35 text-rose-100'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          오류 {rep.errorCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {it.audioBlob && (
                        <span
                          title="원어민 음성 생성 완료"
                          className="inline-flex items-center"
                        >
                          <Volume2
                            className={`w-3.5 h-3.5 ${
                              active ? 'text-emerald-300' : 'text-emerald-600'
                            }`}
                          />
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          active
                            ? 'bg-white/20 text-white'
                            : it.isConstructedResponse
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {fmtBadge}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`text-[11px] mt-1 truncate ${
                      active ? 'text-blue-100' : 'text-slate-600'
                    }`}
                  >
                    [{it.directive}] {it.skill}
                  </div>

                  <div
                    className={`text-[10px] mt-1 flex items-center justify-between ${
                      active ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    <span>
                      {wc}단어 · {it.totalMarks}점
                    </span>
                    <div
                      className="flex items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onMoveItem(idx, -1)}
                        className="p-0.5 rounded hover:bg-black/10 disabled:opacity-30"
                        title="위로 이동"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1}
                        onClick={() => onMoveItem(idx, 1)}
                        className="p-0.5 rounded hover:bg-black/10 disabled:opacity-30"
                        title="아래로 이동"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateItem(it.id)}
                        className="p-0.5 rounded hover:bg-black/10"
                        title="문항 복제"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(it.id)}
                        className="p-0.5 rounded hover:bg-rose-500/20 text-rose-400"
                        title="문항 삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* 우측 메인 검토 & 편집 영역 */}
        <div className="lg:col-span-9 space-y-4">
          {/* 1) 현재 문항 자동 타당도·구어체 검수 리포트 패널 */}
          <div
            className={`rounded-2xl border p-4 shadow-xs space-y-3 ${
              currentReport.status === 'error'
                ? 'bg-rose-50/70 border-rose-300'
                : currentReport.status === 'warning'
                ? 'bg-amber-50/60 border-amber-300'
                : 'bg-emerald-50/60 border-emerald-300'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {currentReport.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                ) : currentReport.status === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    {item.itemNo}번 문항 자동 타당도·구어체 검수 결과:{' '}
                    {currentReport.status === 'pass'
                      ? '통과 (읽기 문형 오류 및 부자연스러운 직역 어휘 미감지)'
                      : `오류 ${currentReport.errorCount}건 · 주의 ${currentReport.warningCount}건 감지`}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    총 {currentReport.metrics.wordCount}단어 ({formatDuration(estSec)}) · 평균 문장{' '}
                    {currentReport.metrics.avgSentenceWords}단어 (최장{' '}
                    {currentReport.metrics.maxSentenceWords}단어) · 감지 화자{' '}
                    {speakers.length ? speakers.join(', ') : '없음'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStudentPreview((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    showStudentPreview
                      ? 'bg-[#09396A] text-white border-[#09396A]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {showStudentPreview ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  {showStudentPreview
                    ? '학생 시점 미리보기 닫기'
                    : '학생 시점 미리보기 (대본 숨김)'}
                </button>

                <button
                  type="button"
                  disabled={busyAny}
                  onClick={() => onAuditItem(item)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-[#09396A] to-[#357DC7] hover:opacity-95 shadow-xs transition disabled:opacity-50"
                >
                  {isRefining ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  {isRefining
                    ? 'AI 검수·교정 중...'
                    : currentReport.status === 'pass'
                    ? 'AI 원어민 구어체 정밀 감수'
                    : 'AI 원어민·타당도 자동 교정'}
                </button>
              </div>
            </div>

            {/* 의심 어휘/직역 칩 하이라이트 */}
            {currentReport.flaggedVocab.length > 0 && (
              <div className="bg-white/90 rounded-xl p-3 border border-amber-200/80 space-y-1.5">
                <div className="text-[11px] font-extrabold text-amber-900">
                  구어체 부적합 · 듣기 난이도 초과 의심 어휘 (클릭하면 해당 어휘만 쉬운 일상 구어로 교체 요청)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentReport.flaggedVocab.map((fv) => (
                    <button
                      key={fv.word}
                      type="button"
                      disabled={busyAny}
                      onClick={() =>
                        triggerQuickRefine(
                          `대본에서 "${fv.word}" 표현이 듣기 수준에 비해 어색하거나 어렵습니다. ${
                            fv.suggestion
                              ? `"${fv.suggestion}" 같은 `
                              : ''
                          }자연스러운 원어민 일상 구어 표현으로 교체하고 해석·해설도 맞춰 주세요.`
                        )
                      }
                      title={fv.reason}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition hover:scale-[1.01] disabled:opacity-50 ${
                        fv.severity === 'error'
                          ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                          : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      <span>{fv.word}</span>
                      {fv.suggestion && (
                        <span className="text-[10px] font-normal opacity-80">
                          → {fv.suggestion}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 세부 지적 사항 리스트 */}
            {currentReport.issues.length > 0 && (
              <ul className="space-y-1.5">
                {currentReport.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className={`flex items-start gap-2 text-xs p-2.5 rounded-xl bg-white/90 border ${
                      issue.severity === 'error'
                        ? 'border-rose-200 text-rose-900'
                        : 'border-amber-200 text-amber-950'
                    }`}
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 mt-0.5 ${
                        issue.severity === 'error'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {issue.severity === 'error' ? '오류' : '주의'}
                    </span>
                    <div className="space-y-0.5 leading-relaxed">
                      <div className="font-bold">{issue.title}</div>
                      <div className="text-[11px] text-slate-600">
                        {issue.detail}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 학생 시점 시험지 미리보기 (대본 없이 학생이 보게 될 화면 그대로 점검) */}
          {showStudentPreview && (
            <div className="bg-white rounded-2xl border-2 border-[#09396A] p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#09396A] text-white text-xs font-extrabold">
                    학생 시점 미리보기 (대본 숨김)
                  </span>
                  <span className="text-xs text-slate-600">
                    실제 시험지에서 학생은 <b>음성만 듣고 아래 내용만 보고</b> 문제를 풉니다.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStudentPreview(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  닫기 ✕
                </button>
              </div>

              <div className="max-w-2xl mx-auto p-5 rounded-xl border border-slate-300 bg-[#FFFEFC] space-y-4 font-serif">
                <div className="text-sm font-bold text-slate-900 leading-relaxed">
                  {item.itemNo}. {item.questionPrompt || '(발문이 비어 있습니다)'}{' '}
                  <span className="text-xs font-normal text-slate-600">
                    [{item.totalMarks}점]
                  </span>
                </div>

                {(item.stimulusTitle || item.stimulusBody) && (
                  <div className="border border-slate-800 p-4 rounded bg-white space-y-2">
                    {item.stimulusTitle && (
                      <div className="text-xs font-bold text-center text-slate-900">
                        {item.stimulusTitle}
                      </div>
                    )}
                    {item.stimulusBody && (
                      <pre className="text-xs whitespace-pre-wrap leading-relaxed font-sans text-slate-800">
                        {item.stimulusBody}
                      </pre>
                    )}
                  </div>
                )}

                {!item.isConstructedResponse ? (
                  <ol className="space-y-1.5 text-xs text-slate-900 pl-1">
                    {choiceIndices.map((oIdx) => (
                      <li key={oIdx} className="leading-relaxed">
                        {choiceMarkers[oIdx]} {item.options[oIdx] || '(비어 있음)'}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="border-t border-dashed border-slate-300 pt-3 text-[11px] text-slate-500 font-sans">
                    [서답형 답안 작성란 — 학생은 대본을 볼 수 없으므로 위 안내와 음성만으로 답안을 작성할 수 있는지 확인하세요]
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2) AI 단일 문항 다듬기 / 재출제 바 */}
          <div className="bg-gradient-to-r from-[#F4F8FD] to-indigo-50/60 rounded-2xl border border-[#357DC7]/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#09396A]">
                <Sparkles className="w-4 h-4 text-[#357DC7]" />
                AI 문항 부분 수정 / 재출제 도우미 (현재 문항 {item.itemNo}번)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '원어민 일상 구어체로 다듬고 어려운 단어 쉽게 교체해줘',
                  '읽기식 표현 제거하고 듣기 평가 발문으로 교정해줘',
                  '대본 분량을 약 110단어로 조절해줘',
                  ...(!item.isConstructedResponse
                    ? [
                        '선택지(①~⑤)를 기출 스타일 영어 보기로 변환해줘',
                        '선택지(①~⑤)를 자연스러운 한국어 보기로 변환해줘',
                        '포스터 빈칸 완성형 서답형으로 변환해줘',
                      ]
                    : [
                        '5지선다 객관식(영어 보기)으로 변환해줘',
                        '5지선다 객관식(한국어 보기)으로 변환해줘',
                      ]),
                  '다른 소재의 새 대화로 재출제해줘',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={busyAny}
                    onClick={() => triggerQuickRefine(chip)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white text-[#09396A] border border-[#357DC7]/30 hover:bg-[#EAF2FB] transition disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && aiPrompt.trim() && !busyAny) {
                    triggerQuickRefine(aiPrompt);
                  }
                }}
                placeholder="예: 여자의 의견을 다회용 텀블러 대여 대신 음료 가격 할인 제도로 바꾸고 채점기준도 맞춰줘"
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#357DC7]"
              />
              <button
                type="button"
                disabled={busyAny || !aiPrompt.trim()}
                onClick={() => triggerQuickRefine(aiPrompt)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-[#357DC7] hover:bg-[#2868ad] disabled:opacity-50 shrink-0"
              >
                {isRefining ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {isRefining ? 'AI 반영 중...' : 'AI 수정 반영'}
              </button>
            </div>
          </div>

          {/* 3) 핵심 문항 편집 시트 (대본 → 발문·보기 → 모범답안·채점기준 우선 배치!) */}
          <div className="bg-white rounded-2xl border border-slate-300 p-5 sm:p-7 shadow-sm space-y-5">
            {/* 상단 1줄 핵심 컨트롤 바 (형식 · 난이도 · 배점 · 메타데이터 토글) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-[#09396A]">
                  {item.itemNo}번 문항 핵심 편집
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {stdCodeOnly} · {item.directive} / {item.skill}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={item.questionFormat}
                  onChange={(e) =>
                    handleFormatChange(e.target.value as QuestionFormatType)
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-[#09396A] bg-[#F4F8FD]"
                  title="문항 형식 전환"
                >
                  {QUESTION_FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1 text-xs">
                  <span className="font-bold text-slate-500">난이도:</span>
                  <select
                    value={item.difficulty}
                    onChange={(e) =>
                      onUpdateItem(item.id, {
                        difficulty: e.target.value as DifficultyLevel,
                      })
                    }
                    className="px-2 py-1 rounded border border-slate-300 text-xs font-bold"
                  >
                    <option value="하">하</option>
                    <option value="중">중</option>
                    <option value="상">상</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <span className="font-bold text-slate-500">배점:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={item.totalMarks}
                    onChange={(e) =>
                      onUpdateItem(item.id, {
                        totalMarks: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="w-12 px-1.5 py-1 text-center font-bold rounded border border-slate-300"
                  />
                  <span className="text-slate-600">점</span>
                </div>
              </div>
            </div>

            {/* 핵심 편집 표: ① 듣기 대본 → ② 문항지(발문/포스터/선택지) → ③ 채점기준·해설 */}
            <table className="spec-table">
              <tbody>
                {/* ── 듣기 자료(텍스트) ── */}
                <tr>
                  <td colSpan={2} className="section-banner">
                    ① 듣기 자료 (영어 대본 및 우리말 해석)
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>
                        줄 앞에 <b>W:</b> (여자), <b>M:</b> (남자), <b>N:</b> (안내)로 화자를 구분하면 원어민 음성이 화자별로 분리 합성됩니다.
                      </span>
                      <span className="font-bold text-[#09396A]">
                        화자: {speakers.length ? speakers.join(', ') : '없음'} · 총 {wordCount}단어 ({formatDuration(estSec)})
                      </span>
                    </div>

                    <textarea
                      rows={8}
                      value={item.transcript}
                      onChange={(e) =>
                        onUpdateItem(item.id, {
                          transcript: e.target.value,
                          targetWordCount: countTranscriptWords(e.target.value),
                        })
                      }
                      placeholder={`예:\nW: Hi, Minsu. Are you ready for tomorrow's English presentation?\nM: Almost, but I'm still checking the slides in the computer room.`}
                      className="w-full p-3 rounded-xl border border-slate-300 text-sm leading-relaxed font-serif text-slate-900 focus:border-[#357DC7] focus:ring-2 focus:ring-[#357DC7]/20 focus:outline-none resize-y"
                    />

                    {/* 우리말 해석 (교사용 참고) */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <div className="text-xs font-bold text-slate-600 mb-1">
                        교사용 우리말 해석 (원안지·해설지 출력 시 선택 포함 가능)
                      </div>
                      <textarea
                        rows={4}
                        value={item.koreanTranslation}
                        onChange={(e) =>
                          onUpdateItem(item.id, {
                            koreanTranslation: e.target.value,
                          })
                        }
                        placeholder="듣기 대본의 우리말 해석..."
                        className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs leading-relaxed text-slate-700 focus:border-[#357DC7] focus:outline-none resize-y"
                      />
                    </div>
                  </td>
                </tr>

                {/* ── 문항지, 활동지 또는 수행 과제 안내문 ── */}
                <tr>
                  <td colSpan={2} className="section-banner">
                    ② 문항지 (학생에게 제시되는 발문 · 안내문/포스터 · 선택지)
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="space-y-4">
                    {/* 발문 */}
                    <div>
                      <label className="block text-xs font-bold text-[#09396A] mb-1">
                        문항 발문 (학생은 대본 없이 음성만 듣고 이 발문을 봅니다)
                      </label>
                      <textarea
                        rows={2}
                        value={item.questionPrompt}
                        onChange={(e) =>
                          onUpdateItem(item.id, {
                            questionPrompt: e.target.value,
                          })
                        }
                        placeholder={
                          item.isConstructedResponse
                            ? '예: 대화를 듣고, 남자가 현재 컴퓨터실에 있는 이유를 우리말로 쓰시오.'
                            : '예: 대화를 듣고, 남자가 하고 있는 일로 가장 적절한 것을 고르시오.'
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-[#357DC7] focus:outline-none resize-y"
                      />
                    </div>

                    {/* 포스터/안내문 상자 또는 서술형 하위 문항 양식 */}
                    <div className="border-2 border-slate-700 rounded-lg p-4 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500">
                          안내문·포스터 빈칸 상자 또는 서답형 소문항 틀 (비워 두면 출력 시 생략됨)
                        </span>
                      </div>
                      <input
                        type="text"
                        value={item.stimulusTitle}
                        onChange={(e) =>
                          onUpdateItem(item.id, {
                            stimulusTitle: e.target.value,
                          })
                        }
                        placeholder="상자 제목 (예: [2026 Career Mentoring Day Notice] - 필요 시 입력)"
                        className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-bold text-center"
                      />
                      <textarea
                        rows={5}
                        value={item.stimulusBody}
                        onChange={(e) =>
                          onUpdateItem(item.id, {
                            stimulusBody: e.target.value,
                          })
                        }
                        placeholder={`예시 1 (포스터 빈칸):\nDate: Next Friday\nPlace: Moved from the library to the (   1   )\n\n예시 2 (우리말 서술 틀):\n(1) 남자의 의도(요청 사항):\n(2) 요청하게 된 이유:`}
                        className="w-full p-2.5 rounded border border-slate-300 bg-white text-xs leading-relaxed font-mono focus:border-[#357DC7] focus:outline-none resize-y"
                      />
                    </div>

                    {/* 선택지 편집 (선택형일 때 표시: IB 3지선다 A/B/C 또는 5지선다 ①~⑤) */}
                    {!item.isConstructedResponse && (
                      <div className="space-y-2 pt-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="block text-xs font-bold text-slate-700">
                            {isIb3Choice
                              ? 'IB 3지선다 선택지 (A·B·C) 및 정답 지정 (라디오 버튼 클릭으로 정답 선택)'
                              : '5지선다 선택지 및 정답 지정 (라디오 버튼 클릭으로 정답 선택)'}
                          </label>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busyAny}
                              onClick={() =>
                                triggerQuickRefine(
                                  isIb3Choice
                                    ? '현재 문항의 대본과 발문·정답 논리는 그대로 유지하되, A/B/C 선택지(options) 3개를 IB Paper 2 표준 병렬 구조의 자연스러운 영어(English) 보기로 변환해 주세요.'
                                    : '현재 문항의 대본과 발문·정답 논리는 그대로 유지하되, ①~⑤ 선택지(options) 5개를 해당 문항 유형의 기출 표준 병렬 구조와 길이순 배열 원칙에 맞는 자연스러운 영어(English) 보기로 변환해 주세요.'
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#EAF2FB] text-[#09396A] border border-[#357DC7]/40 hover:bg-blue-100 transition disabled:opacity-50"
                            >
                              <Sparkles className="w-3 h-3 text-[#357DC7]" />
                              보기를 영어로 변환
                            </button>
                            <button
                              type="button"
                              disabled={busyAny}
                              onClick={() =>
                                triggerQuickRefine(
                                  isIb3Choice
                                    ? '현재 문항의 대본과 발문·정답 논리는 그대로 유지하되, A/B/C 선택지(options) 3개를 어미와 문장 구조가 균일한 자연스러운 한국어 보기로 변환해 주세요.'
                                    : '현재 문항의 대본과 발문·정답 논리는 그대로 유지하되, ①~⑤ 선택지(options) 5개를 어미와 문장 구조가 균일한 자연스러운 한국어 보기로 변환해 주세요.'
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 transition disabled:opacity-50"
                            >
                              <Sparkles className="w-3 h-3 text-slate-500" />
                              보기를 한국어로 변환
                            </button>
                          </div>
                        </div>
                        {choiceIndices.map((oIdx) => {
                          const choiceNum = oIdx + 1;
                          const isCorrect = item.correctChoice === choiceNum;
                          return (
                            <div
                              key={choiceNum}
                              className={`flex items-center gap-2.5 p-2 rounded-xl border ${
                                isCorrect
                                  ? 'bg-emerald-50/70 border-emerald-400'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct-${item.id}`}
                                checked={isCorrect}
                                onChange={() =>
                                  onUpdateItem(item.id, {
                                    correctChoice: choiceNum,
                                  })
                                }
                                className="accent-emerald-600 w-4 h-4 cursor-pointer"
                                title="정답으로 지정"
                              />
                              <span className="text-sm font-extrabold text-slate-700 w-5">
                                {choiceMarkers[oIdx]}
                              </span>
                              <input
                                type="text"
                                value={item.options[oIdx] || ''}
                                onChange={(e) => {
                                  const nextOpts = [...item.options];
                                  while (nextOpts.length < choiceIndices.length)
                                    nextOpts.push('');
                                  nextOpts[oIdx] = e.target.value;
                                  onUpdateItem(item.id, { options: nextOpts });
                                }}
                                placeholder={
                                  isIb3Choice
                                    ? `${choiceMarkers[oIdx]} 선택지 내용을 입력하세요`
                                    : `${choiceNum}번 선택지 내용을 입력하세요`
                                }
                                className="flex-1 px-2.5 py-1 rounded border border-transparent hover:border-slate-200 focus:border-[#357DC7] bg-white text-xs focus:outline-none"
                              />
                              {isCorrect && (
                                <span className="text-[11px] font-extrabold text-emerald-700 px-2 py-0.5 rounded bg-emerald-100">
                                  정답
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>

                {/* ── 채점 기준 ── */}
                <tr>
                  <td colSpan={2} className="section-banner">
                    ③{' '}
                    {item.isConstructedResponse
                      ? '모범답안 · 세부 채점 기준 및 해설'
                      : '정답 및 출제 근거 해설'}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="space-y-3">
                    {item.isConstructedResponse ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-slate-400 text-xs">
                            <thead>
                              <tr className="bg-slate-200/80 text-slate-900 font-bold">
                                <th className="border border-slate-400 p-2 w-16 text-center">
                                  문항 번호
                                </th>
                                <th className="border border-slate-400 p-2 w-60 text-center">
                                  모범답안
                                </th>
                                <th className="border border-slate-400 p-2 text-center">
                                  세부 채점 기준
                                </th>
                                <th className="border border-slate-400 p-2 w-24 text-center">
                                  배점
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.rubricRows.map((rr, rIdx) => (
                                <tr key={rr.id}>
                                  {rIdx === 0 && (
                                    <>
                                      <td
                                        rowSpan={item.rubricRows.length}
                                        className="border border-slate-400 p-2 text-center font-extrabold text-sm bg-white align-middle"
                                      >
                                        {item.itemNo}
                                      </td>
                                      <td
                                        rowSpan={item.rubricRows.length}
                                        className="border border-slate-400 p-2 bg-white align-middle"
                                      >
                                        <textarea
                                          rows={Math.max(
                                            4,
                                            item.rubricRows.length * 2
                                          )}
                                          value={item.modelAnswer}
                                          onChange={(e) =>
                                            onUpdateItem(item.id, {
                                              modelAnswer: e.target.value,
                                            })
                                          }
                                          placeholder="(1) 모범답안..."
                                          className="w-full p-1.5 text-xs leading-relaxed rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none resize-y"
                                        />
                                      </td>
                                    </>
                                  )}
                                  <td className="border border-slate-400 p-2 bg-white">
                                    <textarea
                                      rows={2}
                                      value={rr.criteria}
                                      onChange={(e) =>
                                        handleRubricChange(
                                          rr.id,
                                          'criteria',
                                          e.target.value
                                        )
                                      }
                                      placeholder="세부 채점 기준을 입력하세요."
                                      className="w-full p-1.5 text-xs rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none resize-y"
                                    />
                                  </td>
                                  <td className="border border-slate-400 p-2 bg-white text-center align-middle">
                                    <div className="flex items-center justify-center gap-1">
                                      <input
                                        type="text"
                                        value={rr.scoreLabel}
                                        onChange={(e) =>
                                          handleRubricChange(
                                            rr.id,
                                            'scoreLabel',
                                            e.target.value
                                          )
                                        }
                                        className="w-14 p-1 text-center font-bold text-xs rounded border border-slate-300"
                                      />
                                      {item.rubricRows.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteRubricRow(rr.id)
                                          }
                                          className="p-1 text-slate-400 hover:text-rose-600"
                                          title="이 채점 기준 행 삭제"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleAddRubricRow}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-[#09396A] bg-[#EAF2FB] hover:bg-blue-100 transition"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            채점 기준 단계(행) 추가
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-sm font-extrabold text-emerald-900">
                          {isIb3Choice
                            ? `정답: ${['A', 'B', 'C'][item.correctChoice - 1] || 'A'}`
                            : `정답: ${item.correctChoice}번 (${CIRCLED_NUMS[item.correctChoice - 1]})`}
                        </span>
                        <span className="text-xs text-emerald-700">
                          (위 선택지 라디오 버튼에서 변경 가능)
                        </span>
                      </div>
                    )}

                    {/* 출제 근거 및 해설 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        출제 의도 및 정답 근거 해설
                      </label>
                      <textarea
                        rows={2}
                        value={item.explanation}
                        onChange={(e) =>
                          onUpdateItem(item.id, { explanation: e.target.value })
                        }
                        placeholder="대본 속 정답 단서 및 오답 분석 해설..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs leading-relaxed text-slate-700 focus:border-[#357DC7] focus:outline-none resize-y"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 4) 접기/펼치기: 교육과정 행정 메타데이터 & 가. 평가 운영 방안 */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMetadata((v) => !v)}
                className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100/80 transition text-left"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-extrabold text-slate-800">
                    출제 명세 · 교육과정 메타데이터 및 ‘가. 평가 운영 방안’ 편집{' '}
                    <span className="text-[11px] font-semibold text-slate-500">
                      (HWPX 교사용 원안지 명세표에 자동 반영)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {item.gradeSubject} · {stdCodeOnly} · {item.vocabLevelLabel} ·{' '}
                    {item.materialType || '듣기 자료'}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#357DC7]">
                  {showMetadata ? (
                    <>
                      접기 <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      세부 명세 펼치기 <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </span>
              </button>

              {showMetadata && (
                <div className="p-4 sm:p-5 bg-white border-t border-slate-200 space-y-5">
                  {/* 가. 평가 운영 및 적용 방안 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        가. 평가 운영 및 적용 방안
                      </h3>
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.includeOperationGuide}
                          onChange={(e) =>
                            onUpdateItem(item.id, {
                              includeOperationGuide: e.target.checked,
                              operationGuide: item.operationGuide || {
                                ...DEFAULT_OPERATION_GUIDE,
                              },
                            })
                          }
                          className="accent-[#09396A]"
                        />
                        HWPX 원안지에 이 표 포함하기
                      </label>
                    </div>

                    {item.includeOperationGuide && (
                      <table className="spec-table">
                        <tbody>
                          <tr>
                            <th>운영 방법</th>
                            <td>
                              <textarea
                                rows={3}
                                value={item.operationGuide.method}
                                onChange={(e) =>
                                  onUpdateItem(item.id, {
                                    operationGuide: {
                                      ...item.operationGuide,
                                      method: e.target.value,
                                    },
                                  })
                                }
                                className="w-full text-xs leading-relaxed p-1.5 rounded border border-transparent hover:border-slate-200 focus:border-[#357DC7] focus:outline-none resize-y"
                              />
                            </td>
                          </tr>
                          <tr>
                            <th>장점 및 기대효과</th>
                            <td>
                              <textarea
                                rows={2}
                                value={item.operationGuide.benefits}
                                onChange={(e) =>
                                  onUpdateItem(item.id, {
                                    operationGuide: {
                                      ...item.operationGuide,
                                      benefits: e.target.value,
                                    },
                                  })
                                }
                                className="w-full text-xs leading-relaxed p-1.5 rounded border border-transparent hover:border-slate-200 focus:border-[#357DC7] focus:outline-none resize-y"
                              />
                            </td>
                          </tr>
                          <tr>
                            <th>운영 시 유의사항</th>
                            <td>
                              <textarea
                                rows={2}
                                value={item.operationGuide.cautions}
                                onChange={(e) =>
                                  onUpdateItem(item.id, {
                                    operationGuide: {
                                      ...item.operationGuide,
                                      cautions: e.target.value,
                                    },
                                  })
                                }
                                className="w-full text-xs leading-relaxed p-1.5 rounded border border-transparent hover:border-slate-200 focus:border-[#357DC7] focus:outline-none resize-y"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* 나. 교육과정 명세 항목 */}
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 mb-2">
                      나. 문항 자료 세부 명세표
                    </h3>
                    <table className="spec-table">
                      <tbody>
                        <tr>
                          <th>학년 / 과목</th>
                          <td>
                            <input
                              type="text"
                              value={item.gradeSubject}
                              onChange={(e) =>
                                onUpdateItem(item.id, {
                                  gradeSubject: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs font-semibold rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                            />
                          </td>
                        </tr>
                        <tr>
                          <th>평가 방법</th>
                          <td>
                            <input
                              type="text"
                              value={item.evalMethod}
                              onChange={(e) =>
                                onUpdateItem(item.id, {
                                  evalMethod: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                            />
                          </td>
                        </tr>
                        <tr>
                          <th>성취기준</th>
                          <td className="space-y-1.5">
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  const matched = subjectStandards.find(
                                    (s) => s.text === e.target.value
                                  );
                                  onUpdateItem(item.id, {
                                    achievementStandard: e.target.value,
                                    ...(matched
                                      ? { directive: matched.directive }
                                      : {}),
                                  });
                                }
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-slate-200 bg-slate-50 text-slate-600"
                            >
                              <option value="">
                                ▼ 2022 개정 「{activeItemSubject}」 성취기준 목록에서 빠른 선택
                              </option>
                              {standardDomains.length > 1
                                ? standardDomains.map((dom) => (
                                    <optgroup key={dom} label={`[${dom} 영역]`}>
                                      {subjectStandards
                                        .filter((s) => s.domain === dom)
                                        .map((s) => (
                                          <option key={s.code} value={s.text}>
                                            {s.text}
                                          </option>
                                        ))}
                                    </optgroup>
                                  ))
                                : subjectStandards.map((s) => (
                                    <option key={s.code} value={s.text}>
                                      {s.text}
                                    </option>
                                  ))}
                            </select>
                            <input
                              type="text"
                              value={item.achievementStandard}
                              onChange={(e) =>
                                onUpdateItem(item.id, {
                                  achievementStandard: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs font-semibold text-slate-900 rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                            />
                          </td>
                        </tr>
                        <tr>
                          <th>수행지시어 / 기능</th>
                          <td>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] font-bold text-slate-500">
                                  지시어:
                                </span>
                                <select
                                  value={item.directive}
                                  onChange={(e) =>
                                    onUpdateItem(item.id, {
                                      directive: e.target.value,
                                    })
                                  }
                                  className="px-2 py-1 rounded border border-slate-300 text-xs font-bold text-[#09396A] bg-[#EAF2FB]"
                                >
                                  {DIRECTIVES.map((d) => (
                                    <option key={d.value} value={d.value}>
                                      {d.value} ({d.en})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] font-bold text-slate-500">
                                  평가기능:
                                </span>
                                <input
                                  type="text"
                                  list={`skills-list-${item.id}`}
                                  value={item.skill}
                                  onChange={(e) =>
                                    onUpdateItem(item.id, {
                                      skill: e.target.value,
                                    })
                                  }
                                  className="px-2 py-1 rounded border border-slate-300 text-xs font-semibold w-40"
                                />
                                <datalist id={`skills-list-${item.id}`}>
                                  {skillsPool.map((sk) => (
                                    <option key={sk.value} value={sk.value} />
                                  ))}
                                </datalist>
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <th>어휘 수준 / 핵심 어휘</th>
                          <td className="space-y-2">
                            <select
                              value={item.vocabLevelLabel}
                              onChange={(e) =>
                                onUpdateItem(item.id, {
                                  vocabLevelLabel: e.target.value,
                                })
                              }
                              className="px-2 py-1 rounded border border-slate-300 text-xs font-semibold"
                            >
                              {VOCAB_LEVELS.map((v) => (
                                <option key={v.id} value={v.shortLabel}>
                                  {v.shortLabel} ({v.wordPoolDesc})
                                </option>
                              ))}
                              {!VOCAB_LEVELS.some(
                                (v) => v.shortLabel === item.vocabLevelLabel
                              ) && (
                                <option value={item.vocabLevelLabel}>
                                  {item.vocabLevelLabel}
                                </option>
                              )}
                            </select>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-500 shrink-0">
                                핵심 포함 어휘:
                              </span>
                              <input
                                type="text"
                                value={item.keyVocab}
                                onChange={(e) =>
                                  onUpdateItem(item.id, {
                                    keyVocab: e.target.value,
                                  })
                                }
                                placeholder="예: venue, auditorium, register"
                                className="flex-1 px-2 py-1 text-xs rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                              />
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <th>의사소통 기능 / 구문</th>
                          <td>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500 shrink-0">
                                  기능:
                                </span>
                                <input
                                  type="text"
                                  value={item.expressions.join(', ')}
                                  onChange={(e) =>
                                    onUpdateItem(item.id, {
                                      expressions: e.target.value
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  placeholder="예: 제안·권유하기, 시간 말하기"
                                  className="w-full px-2 py-1 text-xs rounded border border-slate-200"
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500 shrink-0">
                                  구문:
                                </span>
                                <input
                                  type="text"
                                  value={item.structures.join(', ')}
                                  onChange={(e) =>
                                    onUpdateItem(item.id, {
                                      structures: e.target.value
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  placeholder="예: Passive Voice, Real Conditionals"
                                  className="w-full px-2 py-1 text-xs rounded border border-slate-200"
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <th>평가 과제 및 문항 구성</th>
                          <td>
                            <textarea
                              rows={2}
                              value={item.taskDescription}
                              onChange={(e) =>
                                onUpdateItem(item.id, {
                                  taskDescription: e.target.value,
                                })
                              }
                              placeholder="예: 담화 또는 대화를 듣고 핵심 정보를 파악하여 서술하는 서답형 1문항"
                              className="w-full px-2 py-1 text-xs rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none resize-y"
                            />
                          </td>
                        </tr>
                        <tr>
                          <th>듣기 자료 유형</th>
                          <td>
                            <input
                              type="text"
                              value={item.materialType}
                              onChange={(e) =>
                                onUpdateItem(item.id, {
                                  materialType: e.target.value,
                                })
                              }
                              placeholder="예: 담화문(안내 방송)_학교생활/일상(학교행사)"
                              className="w-full px-2 py-1 text-xs rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                            />
                          </td>
                        </tr>
                        <tr>
                          <th>듣기 자료 출처</th>
                          <td>
                            <input
                              type="text"
                              value={item.source}
                              onChange={(e) =>
                                onUpdateItem(item.id, {
                                  source: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs text-slate-700 rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 하단 스텝 이동 바 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              이전: 출제 조건 설정
            </button>
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-extrabold text-white bg-[#09396A] hover:bg-[#0c4b8a] shadow-sm"
            >
              다음 단계: 원어민 음성(MP3) 생성 및 한글(HWPX) 다운로드
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
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
  refiningId: string | null;
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
  refiningId,
  onBack,
  onNext,
}) => {
  const [aiPrompt, setAiPrompt] = useState('');

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

  const handleFormatChange = (fmt: QuestionFormatType) => {
    const isConstructed = fmt !== 'mcq_5';
    const nextRubric: RubricRow[] =
      isConstructed && item.rubricRows.length === 0
        ? [
            { id: `r-${Date.now()}-1`, scoreLabel: '3점', criteria: '핵심 요소를 모두 정확하게 작성한 경우' },
            { id: `r-${Date.now()}-2`, scoreLabel: '2점', criteria: '핵심 요소 중 일부만 정확하게 작성한 경우' },
            { id: `r-${Date.now()}-3`, scoreLabel: '1점', criteria: '표면적인 정보 일부만 작성한 경우' },
            { id: `r-${Date.now()}-4`, scoreLabel: '0점', criteria: '오답이거나 답안을 작성하지 않은 경우' },
          ]
        : item.rubricRows;

    onUpdateItem(item.id, {
      questionFormat: fmt,
      isConstructedResponse: isConstructed,
      rubricRows: nextRubric,
      evalMethod: isConstructed
        ? '정기시험 혹은 수행평가(서술형/서답형)'
        : '정기시험(선택형)',
    });
  };

  const handleRubricChange = (rowId: string, field: 'scoreLabel' | 'criteria', val: string) => {
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
            STEP 3 OF 4 · 출제 원안 확인 및 실시간 편집
          </div>
          <h1 className="text-xl font-extrabold text-[#09396A] mt-0.5">
            현장지원단 표준 서식 위에서 모든 항목을 자유롭게 수정하세요
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            대본을 수정하면 <b>실제 영어 어휘 수</b>와 <b>예상 재생 시간</b>이 자동으로 다시 계산되며, 수정된 내용 그대로 음원(MP3)과 한글(HWPX) 파일에 반영됩니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            파라미터 설정
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

          <div className="space-y-2 max-h-[calc(100vh-9rem)] overflow-y-auto pr-1">
            {items.map((it, idx) => {
              const active = idx === activeIndex;
              const wc = countTranscriptWords(it.transcript);
              const fmtBadge =
                QUESTION_FORMATS.find((f) => f.id === it.questionFormat)?.shortBadge ||
                (it.isConstructedResponse ? '서답형' : '선택형');

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
                    <span className="text-xs font-extrabold">
                      문항 {it.itemNo}
                    </span>
                    <div className="flex items-center gap-1">
                      {it.audioBlob && (
                        <span title="원어민 음성 생성 완료" className="inline-flex items-center">
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
                    <span>{wc}단어 · {it.totalMarks}점</span>
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

        {/* 우측 메인 공식 서식 편집기 */}
        <div className="lg:col-span-9 space-y-5">
          {/* AI 단일 문항 다듬기 / 재출제 바 */}
          <div className="bg-gradient-to-r from-[#F4F8FD] to-indigo-50/60 rounded-2xl border border-[#357DC7]/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#09396A]">
                <Sparkles className="w-4 h-4 text-[#357DC7]" />
                AI 문항 부분 수정 / 재출제 도우미 (현재 문항 {item.itemNo}번)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '어휘를 조금 더 쉽게 낮춰줘',
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
                    disabled={isRefining}
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
                  if (e.key === 'Enter' && aiPrompt.trim() && !isRefining) {
                    triggerQuickRefine(aiPrompt);
                  }
                }}
                placeholder="예: 여자의 의견을 다회용 텀블러 대여 대신 음료 가격 할인 제도로 바꾸고 채점기준도 맞춰줘"
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#357DC7]"
              />
              <button
                type="button"
                disabled={isRefining || !aiPrompt.trim()}
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

          {/* 공식 원안 서식 시트 (PDF 1:1 대응 인라인 에디터) */}
          <div className="bg-white rounded-2xl border border-slate-300 p-6 sm:p-8 shadow-sm space-y-6">
            {/* 가. 평가 운영 및 적용 방안 토글 및 표 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  가. 평가 운영 및 적용 방안
                </h2>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.includeOperationGuide}
                    onChange={(e) =>
                      onUpdateItem(item.id, {
                        includeOperationGuide: e.target.checked,
                        operationGuide: item.operationGuide || { ...DEFAULT_OPERATION_GUIDE },
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

            {/* 나. 문항 자료 명세표 */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <h2 className="text-base font-extrabold text-slate-900">
                  나. 문항 자료 ({item.itemNo}번 문항)
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">문항 형식 전환:</span>
                  <select
                    value={item.questionFormat}
                    onChange={(e) =>
                      handleFormatChange(e.target.value as QuestionFormatType)
                    }
                    className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-bold text-[#09396A] bg-[#F4F8FD]"
                  >
                    {QUESTION_FORMATS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <table className="spec-table">
                <tbody>
                  {/* 학년 / 과목 */}
                  <tr>
                    <th>학년 / 과목</th>
                    <td>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="text"
                          value={item.gradeSubject}
                          onChange={(e) =>
                            onUpdateItem(item.id, { gradeSubject: e.target.value })
                          }
                          className="flex-1 min-w-[180px] px-2 py-1 text-xs font-semibold rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                        />
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-bold text-slate-600">배점:</span>
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
                            className="w-14 px-2 py-1 text-center font-bold rounded border border-slate-300"
                          />
                          <span className="text-slate-600">점</span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* 평가 방법 */}
                  <tr>
                    <th>평가 방법</th>
                    <td>
                      <input
                        type="text"
                        value={item.evalMethod}
                        onChange={(e) =>
                          onUpdateItem(item.id, { evalMethod: e.target.value })
                        }
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                      />
                    </td>
                  </tr>

                  {/* 성취기준 */}
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
                              ...(matched ? { directive: matched.directive } : {}),
                            });
                          }
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 bg-slate-50 text-slate-600"
                      >
                        <option value="">
                          ▼ 2022 개정 「{activeItemSubject}」 성취기준 목록에서 빠른 선택 (직접 수정도 가능)
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
                          onUpdateItem(item.id, { achievementStandard: e.target.value })
                        }
                        className="w-full px-2 py-1 text-xs font-semibold text-slate-900 rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                      />
                    </td>
                  </tr>

                  {/* DELTA 확장: 수행지시어 / 평가기능 / 난이도 */}
                  <tr>
                    <th>수행지시어 / 기능</th>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-500">지시어:</span>
                          <select
                            value={item.directive}
                            onChange={(e) =>
                              onUpdateItem(item.id, { directive: e.target.value })
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
                          <span className="text-[11px] font-bold text-slate-500">평가기능:</span>
                          <input
                            type="text"
                            list={`skills-list-${item.id}`}
                            value={item.skill}
                            onChange={(e) =>
                              onUpdateItem(item.id, { skill: e.target.value })
                            }
                            className="px-2 py-1 rounded border border-slate-300 text-xs font-semibold w-40"
                          />
                          <datalist id={`skills-list-${item.id}`}>
                            {skillsPool.map((sk) => (
                              <option key={sk.value} value={sk.value} />
                            ))}
                          </datalist>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-500">난이도:</span>
                          <select
                            value={item.difficulty}
                            onChange={(e) =>
                              onUpdateItem(item.id, {
                                difficulty: e.target.value as DifficultyLevel,
                              })
                            }
                            className="px-2 py-1 rounded border border-slate-300 text-xs font-semibold"
                          >
                            <option value="하">하</option>
                            <option value="중">중</option>
                            <option value="상">상</option>
                          </select>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* DELTA 확장: 어휘 수준 / 실시간 어휘 수 / 핵심 어휘 */}
                  <tr>
                    <th>어휘 수준 / 어휘 수</th>
                    <td className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={item.vocabLevelLabel}
                          onChange={(e) =>
                            onUpdateItem(item.id, { vocabLevelLabel: e.target.value })
                          }
                          className="px-2 py-1 rounded border border-slate-300 text-xs font-semibold"
                        >
                          {VOCAB_LEVELS.map((v) => (
                            <option key={v.id} value={v.shortLabel}>
                              {v.shortLabel} ({v.wordPoolDesc})
                            </option>
                          ))}
                          {!VOCAB_LEVELS.some((v) => v.shortLabel === item.vocabLevelLabel) && (
                            <option value={item.vocabLevelLabel}>{item.vocabLevelLabel}</option>
                          )}
                        </select>

                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          실제 대본 어휘 수: {wordCount}단어 ({formatDuration(estSec)})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 shrink-0">
                          핵심 포함 어휘:
                        </span>
                        <input
                          type="text"
                          value={item.keyVocab}
                          onChange={(e) =>
                            onUpdateItem(item.id, { keyVocab: e.target.value })
                          }
                          placeholder="예: venue, auditorium, register"
                          className="flex-1 px-2 py-1 text-xs rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* 의사소통 기능 / 언어 형식 */}
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

                  {/* 평가 과제 및 문항 구성 */}
                  <tr>
                    <th>평가 과제 및 문항 구성</th>
                    <td>
                      <textarea
                        rows={2}
                        value={item.taskDescription}
                        onChange={(e) =>
                          onUpdateItem(item.id, { taskDescription: e.target.value })
                        }
                        placeholder="예: 담화 또는 대화를 듣고 핵심 정보를 파악하여 서술하는 서답형 1문항"
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none resize-y"
                      />
                    </td>
                  </tr>

                  {/* 듣기 자료 유형 */}
                  <tr>
                    <th>듣기 자료 유형</th>
                    <td>
                      <input
                        type="text"
                        value={item.materialType}
                        onChange={(e) =>
                          onUpdateItem(item.id, { materialType: e.target.value })
                        }
                        placeholder="예: 담화문(안내 방송)_학교생활/일상(학교행사)"
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                      />
                    </td>
                  </tr>

                  {/* 듣기 자료 출처 */}
                  <tr>
                    <th>듣기 자료 출처</th>
                    <td>
                      <input
                        type="text"
                        value={item.source}
                        onChange={(e) =>
                          onUpdateItem(item.id, { source: e.target.value })
                        }
                        className="w-full px-2 py-1 text-xs text-slate-700 rounded border border-slate-200 focus:border-[#357DC7] focus:outline-none"
                      />
                    </td>
                  </tr>

                  {/* ── 듣기 자료(텍스트) ── */}
                  <tr>
                    <td colSpan={2} className="section-banner">
                      듣기 자료(텍스트)
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>
                          줄 앞에 <b>W:</b> (여자), <b>M:</b> (남자), <b>N:</b> (안내) 형식으로 화자를 구분하면 원어민 음성이 화자별로 분리 합성됩니다.
                        </span>
                        <span className="font-bold text-[#09396A]">
                          감지된 화자: {speakers.length ? speakers.join(', ') : '없음'} · 총 {wordCount}단어
                        </span>
                      </div>

                      <textarea
                        rows={9}
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
                            onUpdateItem(item.id, { koreanTranslation: e.target.value })
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
                      문항지, 활동지 또는 수행 과제 안내문
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="space-y-4">
                      {/* 발문 */}
                      <div>
                        <label className="block text-xs font-bold text-[#09396A] mb-1">
                          문항 발문 (문항:)
                        </label>
                        <textarea
                          rows={2}
                          value={item.questionPrompt}
                          onChange={(e) =>
                            onUpdateItem(item.id, { questionPrompt: e.target.value })
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
                            onUpdateItem(item.id, { stimulusTitle: e.target.value })
                          }
                          placeholder="상자 제목 (예: [2026 Career Mentoring Day Notice] - 필요 시 입력)"
                          className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-bold text-center"
                        />
                        <textarea
                          rows={5}
                          value={item.stimulusBody}
                          onChange={(e) =>
                            onUpdateItem(item.id, { stimulusBody: e.target.value })
                          }
                          placeholder={`예시 1 (포스터 빈칸):\nDate: Next Friday\nPlace: Moved from the library to the (   1   )\n\n예시 2 (우리말 서술 틀):\n(1) 남자의 의도(요청 사항):\n(2) 요청하게 된 이유:`}
                          className="w-full p-2.5 rounded border border-slate-300 bg-white text-xs leading-relaxed font-mono focus:border-[#357DC7] focus:outline-none resize-y"
                        />
                      </div>

                      {/* 5지선다 선택지 편집 (선택형일 때 표시) */}
                      {!item.isConstructedResponse && (
                        <div className="space-y-2 pt-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="block text-xs font-bold text-slate-700">
                              5지선다 선택지 및 정답 지정 (라디오 버튼 클릭으로 정답 선택)
                            </label>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isRefining}
                                onClick={() =>
                                  triggerQuickRefine(
                                    '현재 문항의 대본과 발문·정답 논리는 그대로 유지하되, ①~⑤ 선택지(options) 5개를 해당 문항 유형의 기출 표준 병렬 구조와 길이순 배열 원칙에 맞는 자연스러운 영어(English) 보기로 변환해 주세요.'
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#EAF2FB] text-[#09396A] border border-[#357DC7]/40 hover:bg-blue-100 transition disabled:opacity-50"
                              >
                                <Sparkles className="w-3 h-3 text-[#357DC7]" />
                                🅰️ 보기를 영어로 변환
                              </button>
                              <button
                                type="button"
                                disabled={isRefining}
                                onClick={() =>
                                  triggerQuickRefine(
                                    '현재 문항의 대본과 발문·정답 논리는 그대로 유지하되, ①~⑤ 선택지(options) 5개를 어미와 문장 구조가 균일한 자연스러운 한국어 보기로 변환해 주세요.'
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 transition disabled:opacity-50"
                              >
                                <Sparkles className="w-3 h-3 text-slate-500" />
                                가 보기를 한국어로 변환
                              </button>
                            </div>
                          </div>
                          {[0, 1, 2, 3, 4].map((oIdx) => {
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
                                    onUpdateItem(item.id, { correctChoice: choiceNum })
                                  }
                                  className="accent-emerald-600 w-4 h-4 cursor-pointer"
                                  title="정답으로 지정"
                                />
                                <span className="text-sm font-extrabold text-slate-700 w-5">
                                  {CIRCLED_NUMS[oIdx]}
                                </span>
                                <input
                                  type="text"
                                  value={item.options[oIdx] || ''}
                                  onChange={(e) => {
                                    const nextOpts = [...item.options];
                                    while (nextOpts.length < 5) nextOpts.push('');
                                    nextOpts[oIdx] = e.target.value;
                                    onUpdateItem(item.id, { options: nextOpts });
                                  }}
                                  placeholder={`${choiceNum}번 선택지 내용을 입력하세요`}
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
                      {item.isConstructedResponse
                        ? '채점 기준(서답형 문항의 경우)'
                        : '채점 기준 및 해설'}
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
                                            rows={Math.max(4, item.rubricRows.length * 2)}
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
                                            onClick={() => handleDeleteRubricRow(rr.id)}
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
                            정답: {item.correctChoice}번 ({CIRCLED_NUMS[item.correctChoice - 1]})
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
              이전: 파라미터 설정
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

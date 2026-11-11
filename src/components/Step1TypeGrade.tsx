import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  FileSpreadsheet,
  ListChecks,
} from 'lucide-react';
import {
  AssessmentMode,
  GenerationParams,
  SchoolLevel,
  VocabLevelId,
} from '../types/assessment';
import { DAEGU_EDU_LOGO } from '../assets/daeguEduLogo';
import {
  EVAL_PURPOSES,
  getSubjectsForSchoolAndGrade,
} from '../data/taxonomy';

interface Step1Props {
  params: GenerationParams;
  onChangeParams: (patch: Partial<GenerationParams>) => void;
  onNext: () => void;
}

export const Step1TypeGrade: React.FC<Step1Props> = ({
  params,
  onChangeParams,
  onNext,
}) => {
  const handleModeSelect = (mode: AssessmentMode) => {
    if (mode === 'std') {
      onChangeParams({
        mode: 'std',
        questionFormatMode: 'auto',
        questionFormats: ['mcq_5'],
        evalPurpose: '학교 자체 영어듣기능력평가(100% 객관식)',
        selectedStandards: [],
        selectedSkills: [],
      });
    } else {
      onChangeParams({
        mode: 'ib',
        questionFormatMode: 'auto',
        questionFormats: ['gap_poster', 'short_kr', 'mcq_5'],
        evalPurpose: '정기시험 혹은 수행평가(서술형/서답형)',
        selectedStandards: [],
        selectedSkills: [],
      });
    }
  };

  const handleSchoolLevelChange = (level: SchoolLevel) => {
    if (level === '중') {
      onChangeParams({
        schoolLevel: '중',
        grade: '2학년',
        subject: '중학교 영어',
        vocabLevelId: 'mid_basic',
        targetWordCount: 90,
        selectedStandards: [],
        selectedSkills: [],
      });
    } else {
      onChangeParams({
        schoolLevel: '고',
        grade: '1학년',
        subject: '공통영어1',
        vocabLevelId: 'high1_common',
        targetWordCount: 120,
        selectedStandards: [],
        selectedSkills: [],
      });
    }
  };

  const handleGradeChange = (grade: string) => {
    const validList = getSubjectsForSchoolAndGrade(params.schoolLevel, grade);
    const currentStillValid = validList.some((s) => s.subject === params.subject);

    let nextSubj = params.subject;
    let vocabLevelId: VocabLevelId = params.vocabLevelId;
    let targetWordCount = params.targetWordCount;

    if (params.schoolLevel === '고') {
      if (grade === '1학년') {
        nextSubj = currentStillValid ? params.subject : '공통영어1';
        vocabLevelId = 'high1_common';
        targetWordCount = 120;
      } else if (grade === '2학년') {
        nextSubj = currentStillValid ? params.subject : '영어Ⅰ';
        vocabLevelId = 'high2_general';
        targetWordCount = 140;
      } else {
        nextSubj = currentStillValid ? params.subject : '영어Ⅱ';
        vocabLevelId = 'high3_advanced';
        targetWordCount = 155;
      }
    } else {
      nextSubj = '중학교 영어';
      vocabLevelId = 'mid_basic';
      targetWordCount = grade === '1학년' ? 75 : grade === '2학년' ? 95 : 110;
    }

    onChangeParams({
      grade,
      subject: nextSubj,
      vocabLevelId,
      targetWordCount,
      selectedStandards: nextSubj === params.subject ? params.selectedStandards : [],
    });
  };

  const availableSubjects = getSubjectsForSchoolAndGrade(
    params.schoolLevel,
    params.grade
  );

  return (
    <div className="space-y-6">
      {/* 안내 헤더 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <img
            src={DAEGU_EDU_LOGO}
            alt="대한민국 교육수도 대구 · 대구광역시교육청"
            className="w-16 h-16 object-contain shrink-0 drop-shadow-xs"
          />
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#357DC7] uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              STEP 1 OF 4 · 대구광역시교육청 영어듣기 평가 체제 및 대상 학년 설정
            </div>
            <h1 className="text-2xl font-extrabold text-[#09396A]">
              어떤 유형의 영어듣기 평가 문항을 출제하시겠습니까?
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              대구형(IB·사고력 서답/선택형)과 기존 영어듣기 유형(100% 5지선다 객관식) 중 원하는 평가 방식을 선택하고 학년·과목을 지정해 주세요.
            </p>
          </div>
        </div>

        {/* 평가 유형 선택 대형 카드 2종 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* 대구형 카드 */}
          <button
            type="button"
            onClick={() => handleModeSelect('ib')}
            className={`relative text-left p-6 rounded-2xl border-2 transition-all ${
              params.mode === 'ib'
                ? 'border-[#09396A] bg-[#F4F8FD] shadow-md ring-2 ring-[#357DC7]/20'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#09396A] text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              {params.mode === 'ib' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-[#09396A] text-white">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  선택됨
                </span>
              )}
            </div>

            <div className="mt-4">
              <div className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-[#09396A] mb-1.5">
                2026 대구미래역량교육과정 · IB형 모델
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">
                대구형 영어듣기 평가 (IB · 서답형/선택형)
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                현장지원단 자료집 표준 서식을 기반으로 안내문·포스터 빈칸 완성형, 우리말 의도·이유 서술형, 영어 단답형 및 사고력 선택형 문항과 <b>다단계 채점 기준표</b>를 함께 설계합니다.
              </p>
            </div>

            <ul className="mt-4 pt-3 border-t border-slate-200/80 space-y-1.5 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#357DC7]" />
                안내 포스터 빈칸 완성 / 우리말 의도·이유 서술 / 5지선다 조합 가능
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#357DC7]" />
                10대 수행지시어(파악·추론·분석·요약 등) 및 부분점수 루브릭 자동 생성
              </li>
            </ul>
          </button>

          {/* 기존 영어듣기 유형 카드 */}
          <button
            type="button"
            onClick={() => handleModeSelect('std')}
            className={`relative text-left p-6 rounded-2xl border-2 transition-all ${
              params.mode === 'std'
                ? 'border-[#09396A] bg-[#F4F8FD] shadow-md ring-2 ring-[#357DC7]/20'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0">
                <ListChecks className="w-6 h-6" />
              </div>
              {params.mode === 'std' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-[#09396A] text-white">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  선택됨
                </span>
              )}
            </div>

            <div className="mt-4">
              <div className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-700 mb-1.5">
                시도교육청 공동주관 · 수능 듣기 표준형
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">
                기존 영어듣기 유형 (100% 5지선다 객관식)
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                전 문항을 <b>100% 5지선다 객관식(①~⑤)</b>으로 출제합니다. 목적, 의견, 관계, 할 일, 이유, 금액·숫자, 언급되지 않은 것, 내용 일치, 이어질 응답 등 표준 유형을 즉시 생성합니다.
              </p>
            </div>

            <ul className="mt-4 pt-3 border-t border-slate-200/80 space-y-1.5 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                정기고사 객관식 듣기 문항 및 학교 자체 듣기평가 출제에 최적화
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                매력적인 오답 선택지 5개 및 정답 근거 해설 자동 생성
              </li>
            </ul>
          </button>
        </div>
      </div>

      {/* 학교급 · 학년 · 과목 · 문서 기본 정보 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-[#09396A]" />
          <h2 className="text-base font-extrabold text-slate-900">
            대상 학교급 · 학년 · 과목 및 평가 정보
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 학교급 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              학교급 선택
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['고', '중'] as SchoolLevel[]).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => handleSchoolLevelChange(lv)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition ${
                    params.schoolLevel === lv
                      ? 'bg-[#09396A] text-white border-[#09396A]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {lv === '고' ? '고등학교' : '중학교'}
                </button>
              ))}
            </div>
          </div>

          {/* 학년 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              학년 선택
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['1학년', '2학년', '3학년'].map((gr) => (
                <button
                  key={gr}
                  type="button"
                  onClick={() => handleGradeChange(gr)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition ${
                    params.grade === gr
                      ? 'bg-[#357DC7] text-white border-[#357DC7]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {gr}
                </button>
              ))}
            </div>
          </div>

          {/* 과목 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700">
                과목 선택
              </label>
              <span className="text-[11px] font-semibold text-[#357DC7]">
                {params.schoolLevel === '고'
                  ? params.grade === '1학년'
                    ? '고1 공통과목 전용'
                    : `${params.grade} 선택과목 (${availableSubjects.length}종)`
                  : '중학교 교육과정'}
              </span>
            </div>
            <select
              value={params.subject}
              onChange={(e) =>
                onChangeParams({ subject: e.target.value, selectedStandards: [] })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#357DC7]"
            >
              {availableSubjects.map((s) => (
                <option key={s.subject} value={s.subject}>
                  {s.subject}
                  {s.category ? ` (${s.category})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5 pt-5 border-t border-slate-100">
          {/* 평가 방법/목적 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              평가 활용 방법 (원안지 표기)
            </label>
            <select
              value={params.evalPurpose}
              onChange={(e) => onChangeParams({ evalPurpose: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#357DC7]"
            >
              {EVAL_PURPOSES.map((ep) => (
                <option key={ep} value={ep}>
                  {ep}
                </option>
              ))}
            </select>
          </div>

          {/* 문서 제목 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              출제 문서 제목 (HWPX 상단 표기)
            </label>
            <input
              type="text"
              value={params.assessmentTitle}
              onChange={(e) => onChangeParams({ assessmentTitle: e.target.value })}
              placeholder="예: 2026학년도 1학기 대구형 영어듣기 평가 출제 원안"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#357DC7]"
            />
          </div>

          {/* 학교명 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              학교명 <span className="text-slate-400 font-normal">(선택 · 학생용 시험지 표기)</span>
            </label>
            <input
              type="text"
              value={params.schoolName}
              onChange={(e) => onChangeParams({ schoolName: e.target.value })}
              placeholder="예: 대구서부고등학교"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#357DC7]"
            />
          </div>
        </div>

        {/* 다음 단계 버튼 */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-extrabold text-white bg-[#09396A] hover:bg-[#0c4b8a] shadow-sm transition"
          >
            다음 단계: 성취기준 · 어휘 · 세부 파라미터 설정
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

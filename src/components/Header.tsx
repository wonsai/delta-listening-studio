import React, { useEffect, useRef, useState } from 'react';
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Download,
  Upload,
  X,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
  Home,
} from 'lucide-react';
import { DAEGU_EDU_LOGO } from '../assets/daeguEduLogo';
import { testGeminiApiKey } from '../services/geminiService';

interface HeaderProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
  onGoIntro?: () => void;
  itemCount: number;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  onLoadSamples: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
}

const STEPS = [
  { num: 1, title: '평가 유형 · 학년 선택', shortTitle: '유형·학년', sub: '대구형(IB) / 기존 객관식' },
  { num: 2, title: '출제 파라미터 설정', shortTitle: '파라미터', sub: '성취기준 · 어휘 · 지시어' },
  { num: 3, title: 'AI 출제 · 문항 편집', shortTitle: '문항 편집', sub: '원안 서식 인라인 수정' },
  { num: 4, title: '원어민 음성 · HWPX 출력', shortTitle: '음성·HWPX', sub: 'MP3 다운 · 한글 파일' },
];

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onSelectStep,
  onGoIntro,
  itemCount,
  apiKey,
  onSaveApiKey,
  onLoadSamples,
  onExportJson,
  onImportJson,
}) => {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [draftKey, setDraftKey] = useState(apiKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // 스크롤 다운 시 상단 메뉴 자동 축소 상태 (히스테리시스 + 문서 높이 보존으로 떨림 원천 방지)
  const [isScrolled, setIsScrolled] = useState(false);
  const [manualExpand, setManualExpand] = useState(false);
  const [reservedHeight, setReservedHeight] = useState(144);
  const fullHeaderRef = useRef<HTMLElement | null>(null);
  const expandAnchorScrollRef = useRef(0);

  const isCompact = isScrolled && !manualExpand;

  useEffect(() => {
    let rafId = 0;
    const updateOnScroll = () => {
      rafId = 0;
      const y = window.scrollY || window.pageYOffset || 0;
      setIsScrolled((prev) => {
        if (!prev && y > 56) return true;
        if (prev && y < 16) return false;
        return prev;
      });
      if (y < 16) {
        setManualExpand(false);
      } else if (manualExpand && Math.abs(y - expandAnchorScrollRef.current) > 80) {
        setManualExpand(false);
      }
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateOnScroll);
      }
    };

    updateOnScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [manualExpand]);

  useEffect(() => {
    if (isCompact) {
      document.documentElement.style.setProperty('--header-offset', '60px');
      return;
    }
    const el = fullHeaderRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.offsetHeight;
      if (h > 0) {
        setReservedHeight(h);
        document.documentElement.style.setProperty('--header-offset', `${h + 16}px`);
      }
    };

    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [isCompact, currentStep]);

  const openModal = () => {
    setDraftKey(apiKey);
    setTestResult(null);
    setShowKeyModal(true);
  };

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testGeminiApiKey(draftKey);
    setTestResult(res);
    setTesting(false);
  };

  const handleSaveKey = () => {
    onSaveApiKey(draftKey.trim());
    setShowKeyModal(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onImportJson(f);
    e.target.value = '';
  };

  return (
    <>
      <div
        className="print:hidden"
        style={isCompact ? { height: `${reservedHeight}px` } : undefined}
      >
        {isCompact ? (
          /* 스크롤 다운 시: 1줄 슬림 상단 바 (약 47px 높이) */
          <header className="fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm transition-all duration-200">
            <div className="h-[3px] bg-gradient-to-r from-[#E6002D] via-[#357DC7] to-[#09396A]" />
            <div className="max-w-7xl mx-auto px-3 sm:px-6 h-11 flex items-center justify-between gap-2">
              {/* 좌측 미니 로고 & 타이틀 */}
              <button
                type="button"
                onClick={() => onSelectStep(1)}
                className="flex items-center gap-2 shrink-0 text-left hover:opacity-85 transition"
                title="1단계 처음으로 이동"
              >
                <img
                  src={DAEGU_EDU_LOGO}
                  alt="대구광역시교육청 로고"
                  className="w-6 h-6 object-contain shrink-0"
                />
                <span className="hidden sm:inline text-sm font-extrabold tracking-tight text-[#09396A]">
                  DELTA 출제 스튜디오
                </span>
              </button>

              {/* 중앙 1줄 컴팩트 스텝 탭 */}
              <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5">
                {STEPS.map((step) => {
                  const isActive = currentStep === step.num;
                  const isDone = currentStep > step.num;
                  return (
                    <button
                      key={step.num}
                      type="button"
                      onClick={() => onSelectStep(step.num)}
                      title={`${step.num}단계: ${step.title}`}
                      className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${
                        isActive
                          ? 'bg-[#09396A] text-white border-[#09396A] shadow-sm'
                          : isDone
                          ? 'bg-white text-slate-700 border-[#357DC7]/40 hover:border-[#357DC7]'
                          : 'bg-slate-50/80 text-slate-500 border-slate-200 hover:bg-white hover:text-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                          isActive
                            ? 'bg-white text-[#09396A]'
                            : isDone
                            ? 'bg-[#EAF2FB] text-[#09396A]'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {step.num}
                      </span>
                      <span className="hidden lg:inline">{step.title}</span>
                      <span className="lg:hidden">{step.shortTitle}</span>
                      {step.num === 3 && itemCount > 0 && (
                        <span
                          className={`px-1.5 rounded-full text-[10px] font-extrabold ${
                            isActive
                              ? 'bg-blue-400/30 text-white'
                              : 'bg-[#EAF2FB] text-[#09396A]'
                          }`}
                        >
                          {itemCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* 우측 미니 유틸리티 버튼 & 상단 펼치기 */}
              <div className="flex items-center gap-1 shrink-0">
                {onGoIntro && (
                  <button
                    type="button"
                    onClick={onGoIntro}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-[#09396A] hover:bg-slate-100 transition"
                    title="첫 화면으로 이동"
                  >
                    <Home className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onLoadSamples}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-[#09396A] hover:bg-slate-100 transition"
                  title="자료집 예시 문항 불러오기"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#357DC7]" />
                </button>

                <button
                  type="button"
                  onClick={onExportJson}
                  className="hidden md:inline-flex p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  title="백업 저장 (JSON)"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <label
                  className="hidden md:inline-flex p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                  title="저장해 둔 JSON 프로젝트 파일 불러오기"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>

                <button
                  type="button"
                  onClick={openModal}
                  title={apiKey ? 'Gemini API 연결됨 (설정 열기)' : 'Gemini API 키 설정'}
                  className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                    apiKey
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <KeyRound className="w-3 h-3" />
                  <span className="hidden xl:inline">
                    {apiKey ? 'API 연결됨' : 'API 키'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    expandAnchorScrollRef.current = window.scrollY || 0;
                    setManualExpand(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  title="상단 메뉴 전체 펼치기"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>
        ) : (
          /* 페이지 최상단(또는 수동 펼침 시): 전체 브랜드 & 4단계 안내 헤더 */
          <header
            ref={fullHeaderRef}
            className={`${
              isScrolled ? 'fixed top-0 left-0 right-0' : 'sticky top-0'
            } z-30 bg-white border-b border-slate-200 shadow-sm`}
          >
            <div className="delta-brand-band" />

            {/* 상단 브랜드 & 유틸리티 바 */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => onSelectStep(1)}
              >
                <img
                  src={DAEGU_EDU_LOGO}
                  alt="대구광역시교육청 로고"
                  className="w-11 h-11 object-contain shrink-0 drop-shadow-2xs"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[#E6002D] tracking-tight">
                      대구광역시교육청
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-lg font-extrabold tracking-tight text-[#09396A]">
                      DELTA 출제 스튜디오
                    </span>
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#EAF2FB] text-[#09396A]">
                      교사용 출제 지원
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    대구형 영어듣기 평가 출제 도움(영어 음원 제작, 문항 편집 등)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onGoIntro && (
                  <button
                    type="button"
                    onClick={onGoIntro}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
                    title="첫 화면으로 이동"
                  >
                    <Home className="w-3.5 h-3.5" />
                    첫 화면
                  </button>
                )}

                <button
                  type="button"
                  onClick={onLoadSamples}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                  title="업로드된 현장지원단 자료집 4개 모델 예시 문항 불러오기"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#357DC7]" />
                  자료집 예시 문항 불러오기
                </button>

                <button
                  type="button"
                  onClick={onExportJson}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
                  title="현재 작업 중인 문항 세트를 JSON 파일로 백업"
                >
                  <Download className="w-3.5 h-3.5" />
                  백업 저장
                </button>

                <label
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                  title="저장해 둔 JSON 프로젝트 파일 불러오기"
                >
                  <Upload className="w-3.5 h-3.5" />
                  불러오기
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>

                <button
                  type="button"
                  onClick={openModal}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                    apiKey
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {apiKey ? 'Gemini API 연결됨' : 'API 키 설정'}
                </button>

                {isScrolled && manualExpand && (
                  <button
                    type="button"
                    onClick={() => setManualExpand(false)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                    title="상단 메뉴 작게 접기"
                  >
                    <ChevronUp className="w-4 h-4" />
                    접기
                  </button>
                )}
              </div>
            </div>

            {/* 스텝 바이 스텝 진행 네비게이션 바 */}
            <div className="bg-slate-50/90 border-t border-slate-200/80">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
                <nav className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {STEPS.map((step) => {
                    const isActive = currentStep === step.num;
                    const isDone = currentStep > step.num;
                    return (
                      <button
                        key={step.num}
                        type="button"
                        onClick={() => onSelectStep(step.num)}
                        className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-left border transition-all ${
                          isActive
                            ? 'bg-[#09396A] text-white border-[#09396A] shadow-sm'
                            : isDone
                            ? 'bg-white text-slate-800 border-[#357DC7]/40 hover:border-[#357DC7]'
                            : 'bg-white/70 text-slate-600 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                            isActive
                              ? 'bg-white text-[#09396A]'
                              : isDone
                              ? 'bg-[#EAF2FB] text-[#09396A]'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {step.num}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold truncate flex items-center gap-1.5">
                            <span>{step.title}</span>
                            {step.num === 3 && itemCount > 0 && (
                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                                  isActive
                                    ? 'bg-blue-400/30 text-white'
                                    : 'bg-[#EAF2FB] text-[#09396A]'
                                }`}
                              >
                                {itemCount}
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-[11px] truncate ${
                              isActive ? 'text-blue-100' : 'text-slate-400'
                            }`}
                          >
                            {step.sub}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </header>
        )}
      </div>

      {/* Gemini API 키 설정 모달 */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="delta-brand-band" />
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#09396A] flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-[#357DC7]" />
                    교사 개인 Gemini API 키 설정
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    입력하신 API 키는 외부 서버로 전송되지 않으며, 현재 사용 중인 브라우저(LocalStorage)에만 안전하게 보관됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Google AI Studio API Key
              </label>
              <input
                type="password"
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#357DC7] font-mono"
              />

              <div className="mt-2 flex items-center justify-between text-xs">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#357DC7] font-semibold hover:underline"
                >
                  무료 Gemini API 키 발급받기 (Google AI Studio)
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={testing || !draftKey.trim()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  연결 테스트
                </button>
              </div>

              {testResult && (
                <div
                  className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 ${
                    testResult.ok
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2">
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftKey('');
                      onSaveApiKey('');
                      setShowKeyModal(false);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 mr-auto"
                  >
                    저장된 키 삭제
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveKey}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#09396A] hover:bg-[#0c4b8a]"
                >
                  저장하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

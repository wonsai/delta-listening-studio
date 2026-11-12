import React from 'react';
import { ArrowRight, BookMarked, FileText, Headphones } from 'lucide-react';
import { DAEGU_EDU_LOGO } from '../assets/daeguEduLogo';

interface LandingIntroProps {
  onEnter: () => void;
}

export const LandingIntro: React.FC<LandingIntroProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-[#F5F7FA] to-[#EAF2FB]/60 text-slate-900">
      <div className="delta-brand-band rounded-none" />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="max-w-4xl w-full bg-white rounded-3xl border border-slate-200/90 shadow-lg p-8 sm:p-12 text-center">
          <img
            src={DAEGU_EDU_LOGO}
            alt="대구광역시교육청 로고"
            className="w-20 h-20 sm:w-24 sm:h-24 mx-auto object-contain drop-shadow-xs"
          />

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold bg-[#EAF2FB] text-[#09396A] mt-5">
            대구광역시교육청 · 교사용 출제 지원 플랫폼
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#09396A] mt-4">
            DELTA 출제 스튜디오
          </h1>

          <p className="text-sm sm:text-base text-slate-600 mt-2.5 max-w-xl mx-auto leading-relaxed font-medium">
            대구형 영어듣기 평가 출제 도움(영어 음원 제작, 문항 편집 등)
          </p>

          <div className="mt-8">
            <button
              type="button"
              onClick={onEnter}
              className="group inline-flex items-center justify-center gap-2.5 px-9 py-4 rounded-2xl text-base sm:text-lg font-extrabold text-white bg-gradient-to-r from-[#09396A] to-[#357DC7] hover:from-[#072d54] hover:to-[#2868ad] shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <span>플랫폼 접속하기</span>
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="rounded-2xl bg-slate-50/90 border border-slate-200/70 p-4">
              <div className="w-9 h-9 rounded-xl bg-[#EAF2FB] text-[#09396A] flex items-center justify-center mb-3">
                <BookMarked className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-extrabold text-slate-900">
                2022 개정 교육과정 반영
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                중·고등학교 듣기 성취기준, 수행지시어, 권장 어휘 수준 맞춤 설정
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50/90 border border-slate-200/70 p-4">
              <div className="w-9 h-9 rounded-xl bg-[#EAF2FB] text-[#09396A] flex items-center justify-center mb-3">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-extrabold text-slate-900">
                문항 설계 · 인라인 편집
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                대구형(IB 서답·선택형) 채점 기준표 및 5지선다 객관식 문항 편집 지원
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50/90 border border-slate-200/70 p-4">
              <div className="w-9 h-9 rounded-xl bg-[#EAF2FB] text-[#09396A] flex items-center justify-center mb-3">
                <Headphones className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-extrabold text-slate-900">
                영어 음원 · HWPX 출력
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                화자별 원어민 음성(MP3) 제작 및 한글(HWPX) 원안지·시험지 다운로드
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <img
              src={DAEGU_EDU_LOGO}
              alt="대구광역시교육청"
              className="w-5 h-5 object-contain"
            />
            <span>
              <strong className="text-[#09396A]">
                대구광역시교육청 · DELTA 대구형 영어듣기 출제 스튜디오
              </strong>{' '}
              · 2022 개정 교육과정 성취기준
            </span>
          </span>
          <span>교사 출제·인쇄 전용 (원어민 MP3 음원 + 한컴 HWPX 문서 출력)</span>
        </div>
      </footer>
    </div>
  );
};

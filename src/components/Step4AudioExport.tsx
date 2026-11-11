import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Volume2,
  Download,
  FileText,
  FileCheck2,
  ClipboardCheck,
  PackageCheck,
  Loader2,
  Sparkles,
  RefreshCw,
  Disc3,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Mic2,
  Square,
} from 'lucide-react';
import {
  GenerationParams,
  ListeningItem,
  TtsConfig,
  TtsEngineType,
} from '../types/assessment';
import {
  GEMINI_VOICES,
  KOKORO_VOICES,
  buildCombinedExamMp3,
  synthesizeItemMp3,
} from '../services/ttsService';
import {
  OfficialExamOptions,
  OfficialNumberingMode,
  buildAnswerKeyHwpx,
  buildFullPackageZip,
  buildMasterSpecHwpx,
  buildOfficialExamHwpx,
  deriveDefaultCoverTitle,
  sanitizeFilename,
  summarizeOfficialExamComposition,
  triggerBlobDownload,
} from '../services/hwpxService';
import {
  countTranscriptWords,
  detectSpeakers,
  estimateDurationSec,
  formatDuration,
} from '../services/wordUtils';

interface Step4Props {
  items: ListeningItem[];
  params: GenerationParams;
  ttsConfig: TtsConfig;
  onChangeTtsConfig: (patch: Partial<TtsConfig>) => void;
  apiKey: string;
  onUpdateItemAudio: (
    itemId: string,
    audioData: {
      audioUrl: string;
      audioBlob: Blob;
      audioExt: '.mp3' | '.wav';
      audioSizeBytes: number;
      audioEngineLabel: string;
    }
  ) => void;
  onBack: () => void;
}

const HWPX_MIME = 'application/vnd.hancom.hwpx';

export const Step4AudioExport: React.FC<Step4Props> = ({
  items,
  params,
  ttsConfig,
  onChangeTtsConfig,
  apiKey,
  onUpdateItemAudio,
  onBack,
}) => {
  const [synthesizingId, setSynthesizingId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [combinedUrl, setCombinedUrl] = useState<string | null>(null);
  const [combinedBlob, setCombinedBlob] = useState<Blob | null>(null);
  const [buildingCombined, setBuildingCombined] = useState(false);

  const [includeTranslation, setIncludeTranslation] = useState(true);
  const [includeExplanation, setIncludeExplanation] = useState(true);

  // [원안 양식] 문제지 표지 · 인쇄 옵션 상태
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [coverTitle, setCoverTitle] = useState(() =>
    deriveDefaultCoverTitle(params.assessmentTitle)
  );
  const [examDate, setExamDate] = useState('2026. 00. 00.');
  const [examPeriod, setExamPeriod] = useState('1');
  const [subjectCode, setSubjectCode] = useState('01');
  const [schoolNameInput, setSchoolNameInput] = useState(
    () => params.schoolName.trim() || '대구서부고등학교'
  );
  const [pageCountOverride, setPageCountOverride] = useState('');
  const [numberingMode, setNumberingMode] =
    useState<OfficialNumberingMode>('exam_standard');

  const [exportingDoc, setExportingDoc] = useState<
    'official' | 'master' | 'answer' | 'zip' | null
  >(null);
  const [exportSuccessMsg, setExportSuccessMsg] = useState('');

  const cancelBatchRef = useRef(false);

  const examComp = summarizeOfficialExamComposition(items);
  const officialOptions: OfficialExamOptions = {
    includeCoverPage,
    coverTitle,
    examDate,
    examPeriod,
    subjectCode,
    schoolName: schoolNameInput.trim() || params.schoolName.trim() || '대구서부고등학교',
    pageCountOverride,
    numberingMode,
  };

  const readyAudioCount = items.filter((it) => Boolean(it.audioBlob)).length;
  const voiceList = ttsConfig.engine === 'gemini' ? GEMINI_VOICES : KOKORO_VOICES;
  const activeVoices =
    ttsConfig.engine === 'gemini' ? ttsConfig.geminiVoices : ttsConfig.browserVoices;

  const handleEngineSwitch = (engine: TtsEngineType) => {
    onChangeTtsConfig({ engine });
    setErrorMessage('');
  };

  const handleVoiceChange = (role: 'W' | 'M' | 'N', voiceId: string) => {
    if (ttsConfig.engine === 'gemini') {
      onChangeTtsConfig({
        geminiVoices: { ...ttsConfig.geminiVoices, [role]: voiceId },
      });
    } else {
      onChangeTtsConfig({
        browserVoices: { ...ttsConfig.browserVoices, [role]: voiceId },
      });
    }
  };

  const invalidateCombinedAudio = () => {
    if (combinedUrl) {
      URL.revokeObjectURL(combinedUrl);
      setCombinedUrl(null);
      setCombinedBlob(null);
    }
  };

  const handleSynthesizeOne = async (item: ListeningItem) => {
    setErrorMessage('');
    setSynthesizingId(item.id);
    setProgressText(`${item.itemNo}번 문항 음성 합성 준비 중...`);
    try {
      const res = await synthesizeItemMp3(item, ttsConfig, apiKey, (msg) => {
        setProgressText(msg);
      });
      const url = URL.createObjectURL(res.blob);
      onUpdateItemAudio(item.id, {
        audioUrl: url,
        audioBlob: res.blob,
        audioExt: res.ext,
        audioSizeBytes: res.blob.size,
        audioEngineLabel: res.engineLabel,
      });
      invalidateCombinedAudio();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '음성 생성 중 오류가 발생했습니다.'
      );
    } finally {
      setSynthesizingId(null);
      setProgressText('');
    }
  };

  const handleSynthesizeAll = async (onlyMissing = false) => {
    const targets = onlyMissing ? items.filter((it) => !it.audioBlob) : items;
    if (targets.length === 0) return;

    cancelBatchRef.current = false;
    setBatchRunning(true);
    setErrorMessage('');

    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelBatchRef.current) break;
        const item = targets[i];
        setSynthesizingId(item.id);
        setProgressText(
          `[전체 ${i + 1}/${targets.length}] ${item.itemNo}번 문항 원어민 음성 합성 중...`
        );
        const res = await synthesizeItemMp3(item, ttsConfig, apiKey, (msg) => {
          setProgressText(`[전체 ${i + 1}/${targets.length}] ${msg}`);
        });
        const url = URL.createObjectURL(res.blob);
        onUpdateItemAudio(item.id, {
          audioUrl: url,
          audioBlob: res.blob,
          audioExt: res.ext,
          audioSizeBytes: res.blob.size,
          audioEngineLabel: res.engineLabel,
        });
      }
      invalidateCombinedAudio();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '일괄 음성 합성 중 오류가 발생했습니다.'
      );
    } finally {
      setSynthesizingId(null);
      setBatchRunning(false);
      setProgressText('');
    }
  };

  const handleStopBatch = () => {
    cancelBatchRef.current = true;
    setProgressText('현재 문항 완료 후 일괄 생성을 중지합니다...');
  };

  const handleDownloadSingleAudio = (item: ListeningItem) => {
    if (!item.audioBlob) return;
    const num = String(item.itemNo).padStart(2, '0');
    const ext = item.audioExt || '.mp3';
    const filename = `${num}번_문항_${sanitizeFilename(item.skill)}${ext}`;
    triggerBlobDownload(item.audioBlob, filename);
  };

  const handleBuildAndDownloadCombined = async () => {
    setErrorMessage('');
    setBuildingCombined(true);
    setProgressText('문항별 음원을 시험 진행용 합본 MP3로 병합 중...');
    try {
      const merged = await buildCombinedExamMp3(
        items,
        ttsConfig.gapBetweenItemsSec,
        (msg) => setProgressText(msg)
      );
      if (combinedUrl) URL.revokeObjectURL(combinedUrl);
      const url = URL.createObjectURL(merged);
      setCombinedBlob(merged);
      setCombinedUrl(url);
      const baseName = sanitizeFilename(params.assessmentTitle);
      triggerBlobDownload(merged, `00_${baseName}_시험진행용_전체합본.mp3`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '합본 MP3 병합 중 오류가 발생했습니다.'
      );
    } finally {
      setBuildingCombined(false);
      setProgressText('');
    }
  };

  const showExportBanner = (msg: string) => {
    setExportSuccessMsg(msg);
    setTimeout(() => setExportSuccessMsg(''), 4500);
  };

  const handleExportOfficialHwpx = async () => {
    setErrorMessage('');
    setExportingDoc('official');
    try {
      const bytes = await buildOfficialExamHwpx(items, params, officialOptions);
      const blob = new Blob([new Uint8Array(bytes)], { type: HWPX_MIME });
      const baseName = sanitizeFilename(params.assessmentTitle);
      const filename = `[원안_양식]_${baseName}_문제지.hwpx`;
      triggerBlobDownload(blob, filename);
      showExportBanner(
        `'${filename}' 파일이 다운로드되었습니다. (B4 2단 원안 양식 · 표지/꼬리말/저작권란 적용)`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '원안 양식 문제지 HWPX 생성에 실패했습니다.'
      );
    } finally {
      setExportingDoc(null);
    }
  };

  const handleExportMasterHwpx = async () => {
    setErrorMessage('');
    setExportingDoc('master');
    try {
      const bytes = await buildMasterSpecHwpx(items, params, {
        includeTranslation,
        includeExplanation,
      });
      const blob = new Blob([new Uint8Array(bytes)], { type: HWPX_MIME });
      const baseName = sanitizeFilename(params.assessmentTitle);
      const filename = `${baseName}_교사용_문항명세_채점기준서.hwpx`;
      triggerBlobDownload(blob, filename);
      showExportBanner(`'${filename}' 파일이 다운로드되었습니다.`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '교사용 문항 명세서 HWPX 생성에 실패했습니다.'
      );
    } finally {
      setExportingDoc(null);
    }
  };

  const handleExportAnswerHwpx = async () => {
    setErrorMessage('');
    setExportingDoc('answer');
    try {
      const bytes = await buildAnswerKeyHwpx(items, params);
      const blob = new Blob([new Uint8Array(bytes)], { type: HWPX_MIME });
      const baseName = sanitizeFilename(params.assessmentTitle);
      const filename = `${baseName}_대본_정답_채점기준표.hwpx`;
      triggerBlobDownload(blob, filename);
      showExportBanner(`'${filename}' 파일이 다운로드되었습니다.`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '대본·채점기준 별지 HWPX 생성에 실패했습니다.'
      );
    } finally {
      setExportingDoc(null);
    }
  };

  const handleExportFullZip = async () => {
    setErrorMessage('');
    setExportingDoc('zip');
    try {
      let mergedForZip = combinedBlob;
      if (!mergedForZip && readyAudioCount > 0) {
        setProgressText('통합 패키지용 전체 합본 MP3 자동 병합 중...');
        try {
          mergedForZip = await buildCombinedExamMp3(
            items,
            ttsConfig.gapBetweenItemsSec
          );
          const url = URL.createObjectURL(mergedForZip);
          setCombinedBlob(mergedForZip);
          setCombinedUrl(url);
        } catch {
          // 개별 음원만 포함하여 계속 진행
        }
      }
      setProgressText('한글(HWPX) 3종(원안 양식 포함) 및 MP3 음원 통합 ZIP 압축 중...');
      const zipBlob = await buildFullPackageZip(
        items,
        params,
        mergedForZip,
        officialOptions,
        { includeTranslation, includeExplanation }
      );
      const baseName = sanitizeFilename(params.assessmentTitle);
      const filename = `${baseName}_시험진행_통합패키지.zip`;
      triggerBlobDownload(zipBlob, filename);
      showExportBanner(
        `통합 패키지('${filename}') 다운로드가 완료되었습니다. 압축을 풀어 바로 시험을 진행하세요!`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '통합 ZIP 패키지 생성 중 오류가 발생했습니다.'
      );
    } finally {
      setExportingDoc(null);
      setProgressText('');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 상단 네비게이션 및 요약 배너 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-bold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            3단계 문항 편집으로
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  params.mode === 'ib'
                    ? 'bg-blue-100 text-[#09396A]'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {params.mode === 'ib' ? '대구형 (IB·사고력)' : '기존 100% 객관식'}
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                {params.assessmentTitle || '대구형 영어듣기 평가 출제 문항'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {params.schoolLevel}등학교 {params.grade} · {params.subject} · 총{' '}
              <strong className="text-slate-700">{items.length}문항</strong> · 원어민 음원{' '}
              <strong className="text-emerald-700">
                {readyAudioCount}/{items.length}개
              </strong>{' '}
              준비됨
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportFullZip}
          disabled={exportingDoc !== null || items.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#09396A] hover:bg-[#072B50] disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold shadow-sm transition"
        >
          {exportingDoc === 'zip' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PackageCheck className="w-4 h-4" />
          )}
          원클릭 시험 진행 패키지 (.zip) 다운로드
        </button>
      </div>

      {/* 알림 / 진행 상태 배너 */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">작업 중 확인이 필요합니다</p>
            <p className="text-xs mt-0.5 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {exportSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-emerald-800 text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{exportSuccessMsg}</span>
        </div>
      )}

      {progressText && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-[#09396A] text-sm">
          <div className="flex items-center gap-2.5 font-semibold">
            <Loader2 className="w-4 h-4 animate-spin text-[#357DC7] shrink-0" />
            <span>{progressText}</span>
          </div>
          {batchRunning && (
            <button
              type="button"
              onClick={handleStopBatch}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-xs font-bold text-red-600 hover:bg-red-50"
            >
              <Square className="w-3 h-3 fill-current" />
              중지
            </button>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 1: 한글(HWPX) 문서 및 통합 패키지 출력
         ===================================================================== */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-[#09396A] to-[#1E4E8C] text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-blue-200" />
            <div>
              <h3 className="text-base font-extrabold">
                1. 한글(HWPX) 문서 출력 · 정기고사 원안 양식 다운로드
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                업로드하신 학교 정기고사 [원안_양식] (문제지 표지 · B4 2단 테두리 · 한글 자동 문제번호 · 꼬리말 · 저작권 상자) 그대로 .hwpx를 출력합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs bg-white/10 px-3 py-1.5 rounded-xl">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeTranslation}
                onChange={(e) => setIncludeTranslation(e.target.checked)}
                className="rounded text-blue-500 focus:ring-0"
              />
              <span>교사용 명세서에 우리말 해석 포함</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeExplanation}
                onChange={(e) => setIncludeExplanation(e.target.checked)}
                className="rounded text-blue-500 focus:ring-0"
              />
              <span>교사용 명세서에 출제 해설 포함</span>
            </label>
          </div>
        </div>

        {/* [원안 양식] 표지 · 꼬리말 · 번호 체계 세부 설정 패널 */}
        <div className="px-5 sm:px-6 pt-5 pb-1">
          <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-white to-slate-50 p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#09396A] text-white">
                  원안 양식 설정
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                  문제지 표지 · 꼬리말 · 저작권란 자동 기입 정보
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <label className="inline-flex items-center gap-1.5 font-bold text-[#09396A] bg-white border border-blue-200 px-2.5 py-1 rounded-lg cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeCoverPage}
                    onChange={(e) => setIncludeCoverPage(e.target.checked)}
                    className="rounded text-[#09396A] focus:ring-0"
                  />
                  <span>1쪽 문제지 표지 포함</span>
                </label>

                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                  선택형 {examComp.mcqCount}문항({examComp.mcqPoints}점)
                </span>
                {examComp.shortAnswerCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-blue-100/80 text-[#09396A] font-semibold">
                    단답형 {examComp.shortAnswerCount}문항({examComp.shortAnswerPoints}점) · 5열 표 적용
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                  서술형 {examComp.essayCount}문항({examComp.essayPoints}점)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  예상 본문 {examComp.estimatedBodyPages}면 (B4 2단)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  표지 제목
                </label>
                <input
                  type="text"
                  value={coverTitle}
                  onChange={(e) => setCoverTitle(e.target.value)}
                  disabled={!includeCoverPage}
                  placeholder="2026학년도 2학기 기말시험 문제지 표지"
                  className="w-full rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  시험일자 (좌상단 상자)
                </label>
                <input
                  type="text"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  disabled={!includeCoverPage}
                  placeholder="2026. 12. 10."
                  className="w-full rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    교시
                  </label>
                  <input
                    type="text"
                    value={examPeriod}
                    onChange={(e) => setExamPeriod(e.target.value)}
                    disabled={!includeCoverPage}
                    placeholder="1"
                    className="w-full rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-800 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    과목코드
                  </label>
                  <input
                    type="text"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    disabled={!includeCoverPage}
                    placeholder="01"
                    className="w-full rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-800 text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  학교명 (표지·꼬리말·저작권란)
                </label>
                <input
                  type="text"
                  value={schoolNameInput}
                  onChange={(e) => setSchoolNameInput(e.target.value)}
                  placeholder="대구서부고등학교"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    면 수(표지 제외)
                  </label>
                  <input
                    type="text"
                    value={pageCountOverride}
                    onChange={(e) => setPageCountOverride(e.target.value)}
                    placeholder={`자동(${examComp.estimatedBodyPages})`}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    문항 번호 체계
                  </label>
                  <select
                    value={numberingMode}
                    onChange={(e) =>
                      setNumberingMode(e.target.value as OfficialNumberingMode)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1.5 text-[11px] font-semibold text-slate-800"
                  >
                    <option value="exam_standard">선택형→[서답형]</option>
                    <option value="sequential">1번~N번 순차</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 카드 1: 업로드된 [원안 양식] 정기고사 문제지 */}
          <div className="rounded-2xl border-2 border-[#357DC7] bg-blue-50/50 p-4 flex flex-col justify-between gap-4 shadow-sm hover:border-[#09396A] transition">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#09396A] text-white">
                  학교 정기고사 원안 양식 · B4 2단
                </span>
                <FileCheck2 className="w-5 h-5 text-[#09396A]" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900">
                [원안 양식] 정기고사 문제지 (.hwpx)
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                문제지 표지(시험일자·교시·과목코드·배점표·유의사항 1~5) + B4 2단 테두리 본문 + 한글 자동 문제번호(13pt 굵게, 1. / [서답형1]) + &lt;보기&gt;·포스터 상자 + 꼬리말 + 우하단 저작권 상자 완비
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportOfficialHwpx}
              disabled={exportingDoc !== null || items.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#09396A] hover:bg-[#072B50] disabled:opacity-50 text-white text-xs font-extrabold transition"
            >
              {exportingDoc === 'official' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              [원안 양식] 문제지 HWPX 다운로드
            </button>
          </div>

          {/* 카드 2: 교사용 문항 명세 · 채점기준서 */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between gap-4 hover:border-[#357DC7] transition">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  현장지원단 자료집 서식
                </span>
                <FileText className="w-5 h-5 text-emerald-700" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900">
                교사용 문항 명세 · 채점기준서 (.hwpx)
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                자료집 예시 서식(가. 운영 방안 + 나. 문항 명세표 + 성취기준·수행지시어·어휘 수 + 듣기 대본 + 4열 세부 채점기준표) 전체 수록
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportMasterHwpx}
              disabled={exportingDoc !== null || items.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-extrabold transition"
            >
              {exportingDoc === 'master' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              교사용 문항 명세서 HWPX 다운로드
            </button>
          </div>

          {/* 카드 3: 대본·정답·채점기준 별지 */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between gap-4 hover:border-[#357DC7] transition">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  공동 채점 · 사후 배부용
                </span>
                <ClipboardCheck className="w-5 h-5 text-amber-700" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900">
                대본 · 정답 · 채점기준 별지 (.hwpx)
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                문항별 정답·배점 빠른 요약표 + 영어 듣기 대본, 우리말 해석, 서답형 모범답안·세부 채점기준 및 해설 정리본
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportAnswerHwpx}
              disabled={exportingDoc !== null || items.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-extrabold transition"
            >
              {exportingDoc === 'answer' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              대본·채점기준 HWPX 다운로드
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: 원어민 음성(MP3) 생성 스튜디오
         ===================================================================== */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-5 h-5 text-[#357DC7]" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                2. 문항별 원어민 음성(MP3) 생성 · 다운로드 스튜디오
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                화자 구분(W: 여성, M: 남성)을 자동 인식하여 남녀 원어민 대화·담화 MP3 음원과 시험 진행용 합본 MP3를 제작합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSynthesizeAll(false)}
              disabled={batchRunning || synthesizingId !== null || items.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#357DC7] hover:bg-[#2868AC] disabled:opacity-50 text-white text-xs font-extrabold shadow-sm transition"
            >
              {batchRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              전체 문항 음성 일괄 생성 ({items.length}문항)
            </button>

            <button
              type="button"
              onClick={handleBuildAndDownloadCombined}
              disabled={buildingCombined || readyAudioCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-extrabold shadow-sm transition"
              title="생성 완료된 문항 음원들을 문항 간 풀이 대기 시간과 함께 하나의 MP3 파일로 합쳐 다운로드합니다"
            >
              {buildingCombined ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Disc3 className="w-4 h-4" />
              )}
              시험 진행용 합본 MP3 다운로드
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* TTS 엔진 선택 및 성우·속도 설정 패널 */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 엔진 1: Gemini 멀티화자 TTS */}
              <button
                type="button"
                onClick={() => handleEngineSwitch('gemini')}
                className={`text-left p-3.5 rounded-xl border-2 transition ${
                  ttsConfig.engine === 'gemini'
                    ? 'border-[#357DC7] bg-white shadow-sm'
                    : 'border-slate-200 bg-white/60 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Mic2 className="w-4 h-4 text-[#357DC7]" />
                    Gemini 원어민 멀티화자 TTS (추천)
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      apiKey.trim()
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {apiKey.trim() ? 'API 키 연결됨' : 'API 키 필요'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  실제 시험 방송 수준의 자연스러운 2인 대화 호흡(Multi-Speaker)과 한국어 문항 안내 멘트를 지원합니다.
                </p>
              </button>

              {/* 엔진 2: 브라우저 무료 신경망 TTS */}
              <button
                type="button"
                onClick={() => handleEngineSwitch('browser')}
                className={`text-left p-3.5 rounded-xl border-2 transition ${
                  ttsConfig.engine === 'browser'
                    ? 'border-[#357DC7] bg-white shadow-sm'
                    : 'border-slate-200 bg-white/60 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                    브라우저 무료 원어민 신경망 TTS (Kokoro ONNX)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#09396A]">
                    API 키 불필요 · 무제한
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  API 키 없이도 브라우저에서 직접 미국·영국 원어민 남녀 발음을 합성하여 MP3로 저장합니다 (최초 1회 모델 로드).
                </p>
              </button>
            </div>

            {/* 성우 배정 & 속도·쉼 시간 조절 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  여성 화자 (W:) 성우
                </label>
                <select
                  value={activeVoices.W}
                  onChange={(e) => handleVoiceChange('W', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                >
                  {voiceList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  남성 화자 (M:) 성우
                </label>
                <select
                  value={activeVoices.M}
                  onChange={(e) => handleVoiceChange('M', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                >
                  {voiceList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  내레이터 / 안내 (N:) 성우
                </label>
                <select
                  value={activeVoices.N}
                  onChange={(e) => handleVoiceChange('N', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                >
                  {voiceList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 border-t border-slate-200/80">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    원어민 발화 속도
                  </span>
                  <span className="text-[#09396A] font-extrabold">
                    {ttsConfig.speed.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.2}
                  step={0.05}
                  value={ttsConfig.speed}
                  onChange={(e) =>
                    onChangeTtsConfig({ speed: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#357DC7]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>천천히 (0.8x)</span>
                  <span>표준 (1.0x)</span>
                  <span>빠르게 (1.2x)</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>발화 간 호흡 간격</span>
                  <span className="text-[#09396A] font-extrabold">
                    {ttsConfig.pauseLine.toFixed(1)}초
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1.2}
                  step={0.1}
                  value={ttsConfig.pauseLine}
                  onChange={(e) =>
                    onChangeTtsConfig({ pauseLine: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#357DC7]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>짧게 (0.2초)</span>
                  <span>자연스럽게 (0.5초)</span>
                  <span>여유 (1.2초)</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>합본 MP3 문항 간 풀이 대기</span>
                  <span className="text-[#09396A] font-extrabold">
                    {ttsConfig.gapBetweenItemsSec}초
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={25}
                  step={1}
                  value={ttsConfig.gapBetweenItemsSec}
                  onChange={(e) => {
                    onChangeTtsConfig({
                      gapBetweenItemsSec: parseInt(e.target.value, 10),
                    });
                    invalidateCombinedAudio();
                  }}
                  className="w-full accent-[#357DC7]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>객관식 (8~10초)</span>
                  <span>서답형 (15~25초)</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-1 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ttsConfig.includeChime}
                  onChange={(e) =>
                    onChangeTtsConfig({ includeChime: e.target.checked })
                  }
                  className="rounded text-[#357DC7]"
                />
                <span className="font-semibold">
                  문항 시작 시 듣기평가 3화음 차임벨(딩-동-댕) 자동 삽입
                </span>
              </label>

              <label
                className={`inline-flex items-center gap-2 select-none ${
                  ttsConfig.engine === 'gemini'
                    ? 'cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <input
                  type="checkbox"
                  checked={
                    ttsConfig.engine === 'gemini' && ttsConfig.includeKoreanIntro
                  }
                  disabled={ttsConfig.engine !== 'gemini'}
                  onChange={(e) =>
                    onChangeTtsConfig({ includeKoreanIntro: e.target.checked })
                  }
                  className="rounded text-[#357DC7]"
                />
                <span className="font-semibold">
                  한국어 문항 번호·발문 내레이션 포함 (Gemini TTS 전용)
                </span>
              </label>
            </div>
          </div>

          {/* 합본 MP3 미리듣기 박스 (생성된 경우 표시) */}
          {combinedUrl && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <Disc3 className="w-4 h-4 text-emerald-700" />
                  시험 진행용 전체 합본 MP3 준비 완료 (문항 간 {ttsConfig.gapBetweenItemsSec}초 대기 포함)
                </span>
                <p className="text-[11px] text-emerald-700">
                  교실 방송이나 고사장 플레이어에서 파일 하나로 전체 시험을 진행할 수 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <audio controls src={combinedUrl} className="h-9 w-64 sm:w-80" />
                {combinedBlob && (
                  <button
                    type="button"
                    onClick={() =>
                      triggerBlobDownload(
                        combinedBlob,
                        `00_${sanitizeFilename(params.assessmentTitle)}_시험진행용_전체합본.mp3`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    합본 다시 저장
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 문항별 개별 음성 생성 및 MP3 다운로드 리스트 */}
          <div className="space-y-3">
            {items.map((item) => {
              const wc = countTranscriptWords(item.transcript);
              const estSec = estimateDurationSec(item.transcript, ttsConfig.speed);
              const speakers = detectSpeakers(item.transcript);
              const isBusy = synthesizingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition ${
                    item.audioBlob
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-[#09396A] text-white text-xs font-extrabold">
                          문항 {item.itemNo}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            item.isConstructedResponse
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {item.isConstructedResponse ? '서답형' : '5지선다 선택형'}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          [{item.directive}] {item.skill}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          · 화자 {speakers.join(' / ')} · {wc}단어 · 예상{' '}
                          {formatDuration(estSec)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate">
                        {item.questionPrompt}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.audioUrl && item.audioBlob ? (
                        <>
                          <audio
                            controls
                            src={item.audioUrl}
                            className="h-9 w-56 sm:w-64"
                          />
                          <button
                            type="button"
                            onClick={() => handleDownloadSingleAudio(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            MP3 저장 (
                            {Math.max(1, Math.round((item.audioSizeBytes || 0) / 1024))}
                            KB)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSynthesizeOne(item)}
                            disabled={isBusy || batchRunning}
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold disabled:opacity-50 transition"
                            title="현재 성우·속도 설정으로 음성을 다시 생성합니다"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            재생성
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSynthesizeOne(item)}
                          disabled={isBusy || batchRunning}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#357DC7] hover:bg-[#2868AC] disabled:opacity-50 text-white text-xs font-extrabold shadow-sm transition"
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              음성 합성 중...
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              원어민 음성 생성
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 대본 접기/펼치기 미리보기 */}
                  <details className="mt-2.5 group">
                    <summary className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer select-none">
                      영어 듣기 대본 확인 ({wc}단어)
                    </summary>
                    <pre className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {item.transcript}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

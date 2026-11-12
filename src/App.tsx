import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import {
  GenerationParams,
  ListeningItem,
  QuestionFormatType,
  TtsConfig,
} from './types/assessment';
import {
  QUESTION_FORMATS,
  VOCAB_LEVELS,
  getAchievementStandardsForSubject,
  getDefaultEnglishOptionSkills,
  getListeningPrimaryStandardsForSubject,
} from './data/taxonomy';
import { DEFAULT_OPERATION_GUIDE, SAMPLE_ITEMS } from './data/sampleItems';
import {
  generateListeningItems,
  getSavedApiKey,
  refineSingleItem,
  saveApiKey,
} from './services/geminiService';
import { sanitizeFilename, triggerBlobDownload } from './services/hwpxService';
import { DAEGU_EDU_LOGO } from './assets/daeguEduLogo';
import { Header } from './components/Header';
import { LandingIntro } from './components/LandingIntro';
import { Step1TypeGrade } from './components/Step1TypeGrade';
import { Step2Parameters } from './components/Step2Parameters';
import { Step3Editor } from './components/Step3Editor';
import { Step4AudioExport } from './components/Step4AudioExport';

function cloneSampleItems(): ListeningItem[] {
  return SAMPLE_ITEMS.map((it, idx) => ({
    ...it,
    id: `sample-${Date.now()}-${idx + 1}`,
    itemNo: idx + 1,
    operationGuide: { ...it.operationGuide },
    expressions: [...it.expressions],
    structures: [...it.structures],
    options: [...it.options],
    rubricRows: it.rubricRows.map((r) => ({ ...r })),
  }));
}

function renumberItems(list: ListeningItem[]): ListeningItem[] {
  return list.map((it, idx) => ({
    ...it,
    itemNo: idx + 1,
  }));
}

function revokeItemAudioUrls(list: ListeningItem[]) {
  list.forEach((it) => {
    if (it.audioUrl) {
      URL.revokeObjectURL(it.audioUrl);
    }
  });
}

const INITIAL_PARAMS: GenerationParams = {
  mode: 'ib',
  ibStructureMode: 'single',
  schoolLevel: '고',
  grade: '1학년',
  subject: '공통영어1',
  evalPurpose: '정기시험 혹은 수행평가(서술형/서답형)',
  assessmentTitle: '2026학년도 1학기 대구형 영어듣기 평가 출제 원안',
  schoolName: '',
  itemCount: 4,
  questionFormatMode: 'auto',
  questionFormats: ['gap_poster', 'short_kr', 'mcq_5'],
  questionFormatCounts: {
    gap_poster: 1,
    short_kr: 1,
    mcq_5: 2,
  },
  mcqOptionLanguage: 'auto',
  mcqEnglishSkills: getDefaultEnglishOptionSkills(),
  mcqPromptLanguage: 'ko',
  selectedStandards: [],
  selectedSkills: [],
  selectedDirective: '',
  selectedTopics: [],
  selectedSubtopic: '',
  customTopicDetail: '',
  textTypeMode: 'auto',
  textTypes: ['대화문', '담화문(안내 방송)', '담화문(음성 메시지)'],
  textTypeCounts: {
    '대화문': 2,
    '담화문(안내 방송)': 1,
    '담화문(음성 메시지)': 1,
  },
  targetWordCount: 115,
  vocabLevelId: 'high1_common',
  requiredWords: '',
  difficulty: '중',
  selectedExpressions: [],
  selectedStructures: [],
  includeOperationGuide: true,
  extraInstructions: '',
};

export const App: React.FC = () => {
  const initialKey = getSavedApiKey();

  const [hasEntered, setHasEntered] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [apiKey, setApiKey] = useState<string>(initialKey);
  const [params, setParams] = useState<GenerationParams>(INITIAL_PARAMS);
  const [items, setItems] = useState<ListeningItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep, hasEntered]);

  const [generating, setGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [ttsConfig, setTtsConfig] = useState<TtsConfig>(() => ({
    engine: initialKey.trim() ? 'gemini' : 'browser',
    speed: 1.0,
    pauseLine: 0.45,
    pausePara: 0.9,
    includeChime: true,
    includeKoreanIntro: false,
    gapBetweenItemsSec: 10,
    geminiVoices: {
      W: 'Kore',
      M: 'Puck',
      N: 'Aoede',
    },
    browserVoices: {
      W: 'af_heart',
      M: 'am_michael',
      N: 'af_sarah',
    },
  }));

  const showNotice = (
    type: 'success' | 'error' | 'info',
    message: string,
    autoHideMs = 5500
  ) => {
    setToast({ type, message });
    if (autoHideMs > 0) {
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, autoHideMs);
    }
  };

  const handleSaveApiKey = (key: string) => {
    saveApiKey(key);
    setApiKey(key);
    if (key.trim()) {
      setTtsConfig((prev) => ({ ...prev, engine: 'gemini' }));
      showNotice('success', 'Gemini API 키가 브라우저에 안전하게 저장되었습니다.');
    } else {
      setTtsConfig((prev) => ({ ...prev, engine: 'browser' }));
      showNotice('info', 'Gemini API 키가 초기화되었습니다. 무료 브라우저 TTS 모드로 전환됩니다.');
    }
  };

  const handleChangeParams = (patch: Partial<GenerationParams>) => {
    setParams((prev) => ({ ...prev, ...patch }));
  };

  const handleChangeTtsConfig = (patch: Partial<TtsConfig>) => {
    setTtsConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      showNotice(
        'error',
        'AI 자동 출제를 위해 우측 상단 [API 키 설정] 버튼에서 Gemini API 키를 먼저 입력해 주세요. (API 키 없이도 [직접 문항 출제 및 편집하기]로 바로 작성·출력할 수 있습니다)',
        7000
      );
      return;
    }

    setGenerating(true);
    setStatusMessage('대구형 교육과정 성취기준 및 어휘 수준 분석 중...');
    setToast(null);

    try {
      const generated = await generateListeningItems(apiKey, params, (msg) => {
        setStatusMessage(msg);
      });
      revokeItemAudioUrls(items);
      setItems(renumberItems(generated));
      setActiveIndex(0);
      setCurrentStep(3);
      showNotice(
        'success',
        `총 ${generated.length}문항이 출제되었습니다! 표 안의 모든 항목을 클릭해 직접 다듬거나 4단계에서 음원·HWPX로 내보낼 수 있습니다.`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'AI 문항 생성 중 오류가 발생했습니다.',
        8000
      );
    } finally {
      setGenerating(false);
      setStatusMessage('');
    }
  };

  const handleUpdateItem = (id: string, patch: Partial<ListeningItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  };

  const handleUpdateItemAudio = (
    itemId: string,
    audioData: {
      audioUrl: string;
      audioBlob: Blob;
      audioExt: '.mp3' | '.wav';
      audioSizeBytes: number;
      audioEngineLabel: string;
    }
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        if (it.audioUrl && it.audioUrl !== audioData.audioUrl) {
          URL.revokeObjectURL(it.audioUrl);
        }
        return {
          ...it,
          ...audioData,
        };
      })
    );
  };

  const createBlankItem = (itemNo: number, includeOpGuide: boolean): ListeningItem => {
    const vocabMeta =
      VOCAB_LEVELS.find((v) => v.id === params.vocabLevelId) || VOCAB_LEVELS[1];
    const allStandards = getAchievementStandardsForSubject(params.subject);
    const primaryStandards = getListeningPrimaryStandardsForSubject(params.subject);

    let questionFormat: QuestionFormatType = 'mcq_5';
    if (params.mode === 'ib') {
      if (params.questionFormatMode === 'counts' && params.questionFormatCounts) {
        const firstCountFmt = QUESTION_FORMATS.find(
          (f) => Number(params.questionFormatCounts?.[f.id] || 0) > 0
        );
        questionFormat = firstCountFmt?.id || params.questionFormats[0] || 'short_kr';
      } else {
        questionFormat = params.questionFormats[0] || 'short_kr';
      }
    }
    const isConstructed = questionFormat !== 'mcq_5';

    const selectedStdText =
      params.selectedStandards[0] ||
      primaryStandards[0]?.text ||
      allStandards[0]?.text ||
      '[10공영1-01-01] 말이나 글에 포함된 세부 정보를 파악한다.';
    const matchedStd = allStandards.find((s) => s.text === selectedStdText);

    const skill =
      params.selectedSkills[0] ||
      (params.mode === 'ib'
        ? matchedStd?.recommendedSkillIb || '세부 정보 파악'
        : matchedStd?.recommendedSkillStd || '목적');
    const directive = params.selectedDirective || matchedStd?.directive || '파악';
    const now = Date.now();

    return {
      id: `manual-${now}-${itemNo}`,
      itemNo,
      mode: params.mode,
      questionFormat,
      includeOperationGuide: includeOpGuide,
      operationGuide: { ...DEFAULT_OPERATION_GUIDE },
      gradeSubject: `${params.grade} / ${params.subject}`,
      evalMethod: isConstructed
        ? '정기시험 혹은 수행평가(서술형/서답형)'
        : '정기시험(선택형)',
      achievementStandard: selectedStdText,
      directive,
      skill,
      topic: params.selectedTopics[0] || '학교생활',
      subtopic: params.selectedSubtopic || '',
      expressions: [...params.selectedExpressions],
      structures: [...params.selectedStructures],
      vocabLevelId: params.vocabLevelId,
      vocabLevelLabel: vocabMeta.shortLabel,
      targetWordCount: 0,
      keyVocab: params.requiredWords,
      difficulty: params.difficulty,
      taskDescription: '',
      materialType: params.textTypes[0] || '대화문',
      source: '자체 제작',
      transcript: '',
      koreanTranslation: '',
      questionPrompt: '',
      stimulusTitle: '',
      stimulusBody: '',
      options: ['', '', '', '', ''],
      isConstructedResponse: isConstructed,
      correctChoice: 1,
      modelAnswer: '',
      totalMarks: isConstructed ? 3 : 2,
      rubricRows: isConstructed
        ? [
            {
              id: `rub-${now}-1`,
              scoreLabel: '3점',
              criteria: '',
            },
            {
              id: `rub-${now}-2`,
              scoreLabel: '0점',
              criteria: '',
            },
          ]
        : [],
      explanation: '',
    };
  };

  const handleAddItem = () => {
    const newItem = createBlankItem(
      items.length + 1,
      items.length === 0 && params.includeOperationGuide
    );
    const next = renumberItems([...items, newItem]);
    setItems(next);
    setActiveIndex(next.length - 1);
  };

  const handleDirectCreateOrEdit = () => {
    if (items.length === 0) {
      const firstItem = createBlankItem(1, params.includeOperationGuide);
      setItems([firstItem]);
      setActiveIndex(0);
    }
    setCurrentStep(3);
  };

  const handleDuplicateItem = (id: string) => {
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const src = items[idx];
    const copy: ListeningItem = {
      ...src,
      id: `dup-${Date.now()}`,
      includeOperationGuide: false,
      operationGuide: { ...src.operationGuide },
      expressions: [...src.expressions],
      structures: [...src.structures],
      options: [...src.options],
      rubricRows: src.rubricRows.map((r, rIdx) => ({
        ...r,
        id: `rub-${Date.now()}-${rIdx}`,
      })),
      audioUrl: undefined,
      audioBlob: undefined,
      audioExt: undefined,
      audioSizeBytes: undefined,
      audioEngineLabel: undefined,
    };
    const updated = [...items.slice(0, idx + 1), copy, ...items.slice(idx + 1)];
    setItems(renumberItems(updated));
    setActiveIndex(idx + 1);
  };

  const handleDeleteItem = (id: string) => {
    const target = items.find((it) => it.id === id);
    if (target?.audioUrl) {
      URL.revokeObjectURL(target.audioUrl);
    }
    const filtered = renumberItems(items.filter((it) => it.id !== id));
    setItems(filtered);
    setActiveIndex((prev) => Math.max(0, Math.min(prev, filtered.length - 1)));
  };

  const handleMoveItem = (index: number, dir: -1 | 1) => {
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= items.length) return;
    const clone = [...items];
    const [moved] = clone.splice(index, 1);
    clone.splice(nextIdx, 0, moved);
    setItems(renumberItems(clone));
    setActiveIndex(nextIdx);
  };

  const handleRefineItem = async (item: ListeningItem, instruction: string) => {
    if (!apiKey.trim()) {
      showNotice(
        'error',
        'AI 문항 다듬기/재출제를 사용하려면 상단 [API 키 설정]에서 Gemini API 키를 입력해 주세요.'
      );
      return;
    }

    setRefiningId(item.id);
    try {
      const refined = await refineSingleItem(
        apiKey,
        item,
        instruction,
        params
      );
      if (item.audioUrl) {
        URL.revokeObjectURL(item.audioUrl);
      }
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? refined : it))
      );
      showNotice(
        'success',
        `${item.itemNo}번 문항이 AI 요청사항에 맞춰 새롭게 업데이트되었습니다.`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : '문항 재출제 중 오류가 발생했습니다.'
      );
    } finally {
      setRefiningId(null);
    }
  };

  const handleLoadSamples = () => {
    revokeItemAudioUrls(items);
    setParams(INITIAL_PARAMS);
    setItems(cloneSampleItems());
    setActiveIndex(0);
    setCurrentStep(3);
    showNotice(
      'info',
      '2026 대구 중등 영어듣기 현장지원단 자료집의 표준 예시 4문항을 불러왔습니다.'
    );
  };

  const handleExportJson = () => {
    if (items.length === 0) {
      showNotice('info', '저장할 문항이 없습니다. 먼저 문항을 출제하거나 작성해 주세요.');
      return;
    }
    const cleanItems = items.map(
      ({ audioBlob: _b, audioUrl: _u, ...serializable }) => serializable
    );
    const payload = JSON.stringify(
      {
        version: '1.0',
        savedAt: new Date().toISOString(),
        params,
        items: cleanItems,
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const filename = `${sanitizeFilename(params.assessmentTitle)}_출제프로젝트.json`;
    triggerBlobDownload(blob, filename);
    showNotice('success', `출제 프로젝트 백업 파일('${filename}')을 저장했습니다.`);
  };

  const handleImportJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.items)) {
        throw new Error('올바른 DELTA 출제 프로젝트 JSON 형식이 아닙니다.');
      }
      revokeItemAudioUrls(items);
      if (parsed.params) {
        setParams((prev) => ({ ...prev, ...parsed.params }));
      }
      setItems(renumberItems(parsed.items));
      setActiveIndex(0);
      setCurrentStep(3);
      showNotice(
        'success',
        `프로젝트 파일에서 총 ${parsed.items.length}문항을 성공적으로 불러왔습니다.`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'JSON 파일을 읽는 중 오류가 발생했습니다.'
      );
    }
  };

  if (!hasEntered) {
    return <LandingIntro onEnter={() => setHasEntered(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA] text-slate-900">
      <Header
        currentStep={currentStep}
        onSelectStep={setCurrentStep}
        onGoIntro={() => setHasEntered(false)}
        itemCount={items.length}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        onLoadSamples={handleLoadSamples}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {toast && (
          <div
            className={`rounded-xl border px-4 py-3 flex items-start justify-between gap-3 text-sm shadow-sm ${
              toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-blue-50 border-blue-200 text-[#09396A]'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              ) : toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-[#357DC7] shrink-0 mt-0.5" />
              )}
              <span className="font-semibold leading-relaxed">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {currentStep === 1 && (
          <Step1TypeGrade
            params={params}
            onChangeParams={handleChangeParams}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <Step2Parameters
            params={params}
            onChangeParams={handleChangeParams}
            onBack={() => setCurrentStep(1)}
            onGenerate={handleGenerate}
            onSkipToEditor={handleDirectCreateOrEdit}
            generating={generating}
            statusMessage={statusMessage}
          />
        )}

        {currentStep === 3 && (
          <Step3Editor
            items={items}
            params={params}
            activeIndex={activeIndex}
            onSelectIndex={setActiveIndex}
            onUpdateItem={handleUpdateItem}
            onAddItem={handleAddItem}
            onDuplicateItem={handleDuplicateItem}
            onDeleteItem={handleDeleteItem}
            onMoveItem={handleMoveItem}
            onRefineItem={handleRefineItem}
            refiningId={refiningId}
            onBack={() => setCurrentStep(2)}
            onNext={() => setCurrentStep(4)}
          />
        )}

        {currentStep === 4 && (
          <Step4AudioExport
            items={items}
            params={params}
            ttsConfig={ttsConfig}
            onChangeTtsConfig={handleChangeTtsConfig}
            apiKey={apiKey}
            onUpdateItemAudio={handleUpdateItemAudio}
            onBack={() => setCurrentStep(3)}
          />
        )}
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
              <strong className="text-[#09396A]">대구광역시교육청 · DELTA 대구형 영어듣기 출제 스튜디오</strong> · 2022 개정 교육과정 성취기준
            </span>
          </span>
          <span>교사 출제·인쇄 전용 (원어민 MP3 음원 + 한컴 HWPX 문서 출력)</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

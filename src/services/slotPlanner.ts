import { GenerationParams, QuestionFormatType } from '../types/assessment';
import {
  AchievementStandardItem,
  IB_SKILLS,
  QUESTION_FORMATS,
  STD_SKILLS,
  TEXT_TYPES,
  getAchievementStandardsForSubject,
  getDefaultEnglishOptionSkills,
  getListeningPrimaryStandardsForSubject,
} from '../data/taxonomy';

export interface ItemSlotSpec {
  itemNo: number;
  format: QuestionFormatType;
  standardText: string;
  skill: string;
  directive: string;
  textType: string;
  mcqOptionLang: 'en' | 'ko';
  mcqOptionStyleHint: string;
  mcqPromptLang: 'ko' | 'en';
}

export const IB_PAPER2_CORE_FORMATS: QuestionFormatType[] = [
  'ib_mcq_3',
  'gap_poster',
  'ib_multi_true',
  'short_en',
  'ib_speaker_match',
  'ib_match_info',
];

export const IB_ALL_FORMATS = QUESTION_FORMATS.filter(
  (f) => f.group === 'ib_paper2' || f.group === 'daegu_ib'
);

export type IbDistributionPresetId =
  | 'ib_paper2_balanced'
  | 'ib_constructed_focus'
  | 'ib_dialogue_inference'
  | 'ib_daegu_hybrid';

export type CsatDistributionPresetId =
  | 'csat_balanced'
  | 'csat_gist_detail'
  | 'csat_indirect_speaking'
  | 'csat_high_diff';

export function buildIbDistributionCounts(
  preset: IbDistributionPresetId,
  total: number
): Partial<Record<QuestionFormatType, number>> {
  const orderMap: Record<IbDistributionPresetId, QuestionFormatType[]> = {
    // 실제 IB DP Paper 2 Listening 기출 핵심 6유형 균형 배분
    ib_paper2_balanced: [
      'ib_mcq_3',
      'gap_poster',
      'ib_multi_true',
      'ib_speaker_match',
      'short_en',
      'ib_match_info',
    ],
    // IB 서답형·노트테이킹·단답·근거 서술 집중
    ib_constructed_focus: [
      'gap_poster',
      'short_en',
      'ib_match_info',
      'tf_justify',
      'ib_order',
    ],
    // 대화·인터뷰·토론 기반 관점/추론 집중
    ib_dialogue_inference: [
      'ib_speaker_match',
      'ib_multi_true',
      'ib_mcq_3',
      'tf_justify',
      'short_en',
    ],
    // IB 기출 핵심 + 대구형 우리말 서술 혼합
    ib_daegu_hybrid: [
      'ib_mcq_3',
      'gap_poster',
      'ib_multi_true',
      'short_kr',
      'ib_speaker_match',
      'tf_justify',
    ],
  };

  const order = orderMap[preset] || orderMap.ib_paper2_balanced;
  const res: Partial<Record<QuestionFormatType, number>> = {};
  for (let i = 0; i < total; i++) {
    const key = order[i % order.length];
    res[key] = (res[key] || 0) + 1;
  }
  return res;
}

export function buildCsatDistributionCounts(
  preset: CsatDistributionPresetId,
  total: number
): Record<string, number> {
  const orderMap: Record<CsatDistributionPresetId, string[]> = {
    // 수능 4대 영역(대의·세부정보·간접말하기·복합이해) 균형 배분
    csat_balanced: [
      '목적',
      '의견',
      '숫자',
      '긴응답',
      '도표',
      '상황',
      '이유',
      '복합(주제+언급안됨)',
      '짧은응답',
      '내용일치',
    ],
    // 대의 파악(1~3번) + 세부 정보(5~10번) 집중
    csat_gist_detail: [
      '목적',
      '의견',
      '요지',
      '할일',
      '숫자',
      '이유',
      '언급안됨',
      '내용일치',
      '도표',
    ],
    // 간접 말하기(11~15번 · 영어 보기) 집중
    csat_indirect_speaking: [
      '짧은응답',
      '긴응답',
      '상황',
      '짧은응답',
      '긴응답',
    ],
    // 수능 고난도·변별력 집중 (금액·도표·긴응답·상황·16~17번 복합)
    csat_high_diff: [
      '숫자',
      '도표',
      '긴응답',
      '상황',
      '복합(주제+언급안됨)',
      '이유',
      '의견',
    ],
  };

  const order = orderMap[preset] || orderMap.csat_balanced;
  const res: Record<string, number> = {};
  for (let i = 0; i < total; i++) {
    const key = order[i % order.length];
    res[key] = (res[key] || 0) + 1;
  }
  return res;
}

const IB_FORMAT_PREFERRED_SKILLS: Partial<Record<QuestionFormatType, string[]>> = {
  ib_mcq_3: ['주제·요지 파악', '심정·의도 파악', '함축적 의미 추론'],
  gap_poster: ['세부 정보 파악', '핵심 내용 요약', '이해 전략 활용'],
  ib_multi_true: ['세부 정보 파악', '주제·요지 파악', '비판적 이해'],
  short_en: ['세부 정보 파악', '듣고 설명하기', '논리적 관계 파악'],
  ib_speaker_match: ['관점·의견 분석', '심정·의도 파악', '비판적 이해'],
  ib_match_info: ['논리적 관계 파악', '전개·구조 파악', '세부 정보 파악'],
  tf_justify: ['비판적 이해', '논리적 관계 파악', '세부 정보 파악'],
  ib_order: ['정보 조직', '전개·구조 파악', '세부 정보 파악'],
  short_kr: ['심정·의도 파악', '논리적 관계 파악', '듣고 설명하기'],
};

export function buildItemSlotPlan(params: GenerationParams): ItemSlotSpec[] {
  const count = Math.max(1, params.itemCount);
  const allSubjectStandards = getAchievementStandardsForSubject(params.subject);
  const primarySubjectStandards = getListeningPrimaryStandardsForSubject(
    params.subject
  );
  const activeStandards: AchievementStandardItem[] =
    params.selectedStandards.length > 0
      ? allSubjectStandards.filter((s) =>
          params.selectedStandards.includes(s.text)
        )
      : primarySubjectStandards;
  const fallbackStandards =
    activeStandards.length > 0 ? activeStandards : primarySubjectStandards;

  // 1) 문항 형식 슬롯 배열 구성
  const formatSlots: QuestionFormatType[] = [];
  if (params.mode === 'std') {
    for (let i = 0; i < count; i++) formatSlots.push('mcq_5');
  } else if (params.questionFormatMode === 'counts' && params.questionFormatCounts) {
    for (const fmtMeta of IB_ALL_FORMATS) {
      const n = Number(params.questionFormatCounts[fmtMeta.id] || 0);
      for (let k = 0; k < n && formatSlots.length < count; k++) {
        formatSlots.push(fmtMeta.id);
      }
    }
    const validSelected = params.questionFormats.filter((f) => f !== 'mcq_5');
    const fallbackPool: QuestionFormatType[] =
      validSelected.length > 0 ? validSelected : IB_PAPER2_CORE_FORMATS;
    let fIdx = 0;
    while (formatSlots.length < count) {
      formatSlots.push(fallbackPool[fIdx % fallbackPool.length]);
      fIdx++;
    }
  } else {
    const validSelected = params.questionFormats.filter((f) => f !== 'mcq_5');
    const pool: QuestionFormatType[] =
      validSelected.length > 0 ? validSelected : IB_PAPER2_CORE_FORMATS;
    for (let i = 0; i < count; i++) {
      formatSlots.push(pool[i % pool.length]);
    }
  }

  // IB Paper 2 / 정기고사 표준 흐름(선택형 → 복수선택 → 매칭 → 빈칸·단답 → 순서·서술형) 정렬
  const formatPriority: Record<QuestionFormatType, number> = {
    mcq_5: 0,
    ib_mcq_3: 1,
    ib_multi_true: 2,
    ib_speaker_match: 3,
    ib_match_info: 4,
    gap_poster: 5,
    short_en: 6,
    ib_order: 7,
    tf_justify: 8,
    short_kr: 9,
  };
  formatSlots.sort((a, b) => formatPriority[a] - formatPriority[b]);

  // 2) 성취기준 및 평가기능(skill) · 수행지시어 매칭
  const allModeSkills = params.mode === 'ib' ? IB_SKILLS : STD_SKILLS;
  const csatOrderMap = new Map(STD_SKILLS.map((sk, idx) => [sk.value, idx]));
  const usedAutoSkills = new Set<string>();

  // 기존형(수능 영어 듣기): 개수 지정 / 선택 유형 / 수능 4대 영역 자동 균형 배분
  let stdPlannedSkills: string[] | null = null;
  if (params.mode === 'std') {
    if (params.stdTypeMode === 'counts' && params.stdTypeCounts) {
      const expanded: string[] = [];
      for (const sk of STD_SKILLS) {
        const n = Number(params.stdTypeCounts[sk.value] || 0);
        for (let k = 0; k < n && expanded.length < count; k++) {
          expanded.push(sk.value);
        }
      }
      if (expanded.length > 0) {
        const defaultBalanced = [
          '목적',
          '의견',
          '숫자',
          '긴응답',
          '도표',
          '상황',
          '이유',
          '복합(주제+언급안됨)',
          '짧은응답',
          '내용일치',
        ];
        const fallbackPool =
          params.selectedSkills.length > 0
            ? params.selectedSkills
            : defaultBalanced;
        let pIdx = 0;
        while (expanded.length < count) {
          expanded.push(fallbackPool[pIdx % fallbackPool.length]);
          pIdx++;
        }
        expanded.sort(
          (a, b) => (csatOrderMap.get(a) ?? 99) - (csatOrderMap.get(b) ?? 99)
        );
        stdPlannedSkills = expanded;
      }
    } else if (params.selectedSkills.length > 0) {
      const sortedSelected = [...params.selectedSkills].sort(
        (a, b) => (csatOrderMap.get(a) ?? 99) - (csatOrderMap.get(b) ?? 99)
      );
      stdPlannedSkills = Array.from(
        { length: count },
        (_, i) => sortedSelected[i % sortedSelected.length]
      );
    } else {
      // 수능 전 유형 자동 배정: 4대 영역(대의 파악 · 세부 정보 · 간접 말하기 · 복합 이해)을 균형 있게 배정
      const balancedCounts = buildCsatDistributionCounts('csat_balanced', count);
      const expanded: string[] = [];
      for (const sk of STD_SKILLS) {
        const n = Number(balancedCounts[sk.value] || 0);
        for (let k = 0; k < n && expanded.length < count; k++) {
          expanded.push(sk.value);
        }
      }
      stdPlannedSkills = expanded;
    }
  }

  let preliminarySlots = Array.from({ length: count }, (_, i) => {
    const slotFormat = formatSlots[i];
    let stdItem = fallbackStandards[i % fallbackStandards.length];
    let skill: string;

    if (params.mode === 'std' && stdPlannedSkills) {
      skill = stdPlannedSkills[i];
      if (params.selectedStandards.length === 0) {
        const matchedStd =
          fallbackStandards.find((s) => s.recommendedSkillStd === skill) ||
          fallbackStandards.find(
            (s) =>
              s.directive ===
              (STD_SKILLS.find((sk) => sk.value === skill)?.directive || '')
          );
        if (matchedStd) stdItem = matchedStd;
      }
    } else if (params.selectedSkills.length > 0) {
      skill = params.selectedSkills[i % params.selectedSkills.length];
    } else {
      // 대구형(IB) 자동 배정: 문항 형식과 성취기준 모두에 자연스럽게 어울리는 인지 기능 배정
      const preferredForFmt = IB_FORMAT_PREFERRED_SKILLS[slotFormat] || [];
      const primaryRec = stdItem?.recommendedSkillIb || '세부 정보 파악';

      const unusedPreferred = preferredForFmt.find((sk) => !usedAutoSkills.has(sk));
      if (unusedPreferred) {
        skill = unusedPreferred;
        if (params.selectedStandards.length === 0) {
          const matchedStd = fallbackStandards.find(
            (s) => s.recommendedSkillIb === skill
          );
          if (matchedStd) stdItem = matchedStd;
        }
      } else if (!usedAutoSkills.has(primaryRec)) {
        skill = primaryRec;
      } else {
        const sameDirAlt = allModeSkills.find(
          (sk) =>
            !usedAutoSkills.has(sk.value) &&
            sk.directive === (stdItem?.directive || '파악')
        );
        const anyAlt = allModeSkills.find((sk) => !usedAutoSkills.has(sk.value));
        skill = sameDirAlt?.value || anyAlt?.value || preferredForFmt[0] || primaryRec;
      }
      usedAutoSkills.add(skill);
    }

    const standardText =
      stdItem?.text ||
      params.selectedStandards[i % Math.max(1, params.selectedStandards.length)] ||
      '';

    const matchedSkillMeta = allModeSkills.find((s) => s.value === skill);
    const directive =
      params.selectedDirective ||
      matchedSkillMeta?.directive ||
      stdItem?.directive ||
      '파악';

    return {
      format: slotFormat,
      standardText,
      skill,
      matchedSkillMeta,
      directive,
    };
  });

  // 기존형(수능) 자동 배정 시에도 1번(목적) → 16~17번(복합) 수능 공식 순서로 정렬
  if (params.mode === 'std') {
    preliminarySlots = preliminarySlots.sort(
      (a, b) =>
        (csatOrderMap.get(a.skill) ?? 99) - (csatOrderMap.get(b.skill) ?? 99)
    );
  }

  // 3) 담화·대화 유형 슬롯 배열 구성 (문항 수 및 문항 유형 특성 연동)
  const autoTextCycle = [
    '대화문',
    '담화문(안내 방송)',
    '대화문',
    '담화문(음성 메시지)',
    '대화문',
    '담화문(강연·발표)',
    '인터뷰',
    '토론·의견 교환',
  ];

  const dialogueRequiredSkills = new Set([
    '짧은응답',
    '긴응답',
    '듣고 응답하기',
    '의견',
    '할일',
    '숫자',
    '이유',
    '언급안됨',
    '도표',
  ]);
  const monologuePreferredSkills = new Set([
    '목적',
    '요지',
    '내용일치',
    '복합(주제+언급안됨)',
  ]);

  const textSlots: string[] = new Array(count).fill('');
  if (params.textTypeMode === 'counts' && params.textTypeCounts) {
    const remainingCounts: Record<string, number> = { ...params.textTypeCounts };

    for (let i = 0; i < count; i++) {
      const fmt = preliminarySlots[i].format;
      if (fmt === 'gap_poster') {
        if ((remainingCounts['담화문(안내 방송)'] || 0) > 0) {
          textSlots[i] = '담화문(안내 방송)';
          remainingCounts['담화문(안내 방송)']--;
        } else if ((remainingCounts['담화문(강연·발표)'] || 0) > 0) {
          textSlots[i] = '담화문(강연·발표)';
          remainingCounts['담화문(강연·발표)']--;
        }
      } else if (fmt === 'ib_speaker_match') {
        if ((remainingCounts['토론·의견 교환'] || 0) > 0) {
          textSlots[i] = '토론·의견 교환';
          remainingCounts['토론·의견 교환']--;
        } else if ((remainingCounts['인터뷰'] || 0) > 0) {
          textSlots[i] = '인터뷰';
          remainingCounts['인터뷰']--;
        } else if ((remainingCounts['대화문'] || 0) > 0) {
          textSlots[i] = '대화문';
          remainingCounts['대화문']--;
        }
      } else if (fmt === 'ib_match_info') {
        if ((remainingCounts['담화문(강연·발표)'] || 0) > 0) {
          textSlots[i] = '담화문(강연·발표)';
          remainingCounts['담화문(강연·발표)']--;
        } else if ((remainingCounts['인터뷰'] || 0) > 0) {
          textSlots[i] = '인터뷰';
          remainingCounts['인터뷰']--;
        }
      } else if (
        dialogueRequiredSkills.has(preliminarySlots[i].skill) &&
        (remainingCounts['대화문'] || 0) > 0
      ) {
        textSlots[i] = '대화문';
        remainingCounts['대화문']--;
      }
    }

    const flatRest: string[] = [];
    for (const tt of TEXT_TYPES) {
      const c = Number(remainingCounts[tt.id] || 0);
      for (let k = 0; k < c; k++) flatRest.push(tt.id);
    }

    let rIdx = 0;
    let autoIdx = 0;
    for (let i = 0; i < count; i++) {
      if (!textSlots[i]) {
        if (rIdx < flatRest.length) {
          textSlots[i] = flatRest[rIdx++];
        } else {
          textSlots[i] = autoTextCycle[autoIdx++ % autoTextCycle.length];
        }
      }
    }
  } else {
    let autoIdx = 0;
    for (let i = 0; i < count; i++) {
      const fmt = preliminarySlots[i].format;
      const sk = preliminarySlots[i].skill;
      if (sk === '상황') {
        textSlots[i] = '담화문(상황 설명)';
      } else if (fmt === 'ib_speaker_match') {
        textSlots[i] = i % 2 === 0 ? '토론·의견 교환' : '인터뷰';
      } else if (fmt === 'ib_match_info') {
        textSlots[i] = i % 2 === 0 ? '담화문(강연·발표)' : '인터뷰';
      } else if (dialogueRequiredSkills.has(sk)) {
        textSlots[i] = '대화문';
      } else if (sk === '복합(주제+언급안됨)') {
        textSlots[i] = '담화문(강연·발표)';
      } else if (fmt === 'gap_poster' || monologuePreferredSkills.has(sk)) {
        textSlots[i] = i % 2 === 0 ? '담화문(안내 방송)' : '담화문(강연·발표)';
      } else if (fmt === 'short_kr') {
        textSlots[i] = i % 2 === 0 ? '담화문(음성 메시지)' : '대화문';
      } else {
        let candidate = autoTextCycle[autoIdx++ % autoTextCycle.length];
        if (i > 0 && candidate === textSlots[i - 1] && count > 1) {
          candidate = autoTextCycle[autoIdx++ % autoTextCycle.length];
        }
        textSlots[i] = candidate;
      }
    }
  }

  // 4) 객관식 보기(①~⑤ 또는 IB A/B/C) 언어 및 발문 언어 결정
  const optionMode = params.mcqOptionLanguage || 'auto';
  const promptMode = params.mcqPromptLanguage || 'ko';
  const englishSkillSet = new Set(
    params.mcqEnglishSkills || getDefaultEnglishOptionSkills()
  );

  return preliminarySlots.map((p, i) => {
    const isIb3 = p.format === 'ib_mcq_3';
    const mcqOptionLang: 'en' | 'ko' = isIb3
      ? optionMode === 'ko'
        ? 'ko'
        : 'en'
      : optionMode === 'en'
      ? 'en'
      : optionMode === 'ko'
      ? 'ko'
      : p.matchedSkillMeta
      ? englishSkillSet.has(p.matchedSkillMeta.value)
        ? 'en'
        : 'ko'
      : 'ko';

    const mcqOptionStyleHint = isIb3
      ? mcqOptionLang === 'en'
        ? 'IB Paper 2 표준 A/B/C 3지선다 영어 선택지 3개 (문장 완성형 또는 간결한 구/절, 병렬 구조 엄수)'
        : 'IB 3지선다 한국어 선택지 3개 (문장 구조와 길이가 균일한 병렬 구조)'
      : p.matchedSkillMeta
      ? mcqOptionLang === 'en'
        ? p.matchedSkillMeta.optionStyleHintEn
        : p.matchedSkillMeta.optionStyleHintKo
      : mcqOptionLang === 'en'
      ? '문법 구조와 길이가 균일한 자연스러운 영어(English) 선택지 5개'
      : '어미와 수준이 균일한 자연스러운 한국어 선택지 5개';

    return {
      itemNo: i + 1,
      format: p.format,
      standardText: p.standardText,
      skill: p.skill,
      directive: p.directive,
      textType: textSlots[i],
      mcqOptionLang,
      mcqOptionStyleHint,
      mcqPromptLang: isIb3 && promptMode === 'en' ? 'en' : promptMode,
    };
  });
}

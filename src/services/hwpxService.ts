import JSZip from 'jszip';
import {
  HwpxDocument,
  HwpxOxmlParagraph,
  HwpxOxmlSection,
  HwpxOxmlTable,
  HwpxOxmlTableCell,
  HwpxPackage,
} from '@ubermensch1218/hwpxcore';
import { getExamPaperTemplateHwpxBytes } from '../assets/examPaperTemplateHwpx';
import { getSkeletonHwpxBytes } from '../assets/skeletonHwpx';
import { GenerationParams, ListeningItem, SubQuestionItem } from '../types/assessment';
import { countTranscriptWords } from './wordUtils';

const HP_NS = 'http://www.hancom.co.kr/hwpml/2011/paragraph';

// A4 세로 (210mm = 59528 hwpUnit), 좌우 여백 각 20mm(5669) → 본문 폭 170mm = 48190 hwpUnit
const PAGE_MARGIN_LR = 5669;
const PAGE_MARGIN_TB = 4252;
const BODY_WIDTH = 48190;

const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤'];
const KOR_SEC_LETTERS = ['나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];

async function openBlankHwpx(): Promise<HwpxDocument> {
  const skeletonBytes = getSkeletonHwpxBytes();
  const doc = await HwpxDocument.open(skeletonBytes);
  const sec = doc.section(0);
  sec.properties.setPageMargins({
    left: PAGE_MARGIN_LR,
    right: PAGE_MARGIN_LR,
    top: PAGE_MARGIN_TB,
    bottom: PAGE_MARGIN_TB,
    header: 2835,
    footer: 2835,
    gutter: 0,
  });
  return doc;
}

function makeParaId(): string {
  return String(Math.floor(Math.random() * 0x7fffffff) + 1);
}

interface StylePalette {
  // Run styles (charPrIDRef)
  charTitle: string;
  charSubTitle: string;
  charSectionHeading: string;
  charTableHeader: string;
  charBody: string;
  charBodyBold: string;
  charBodySmall: string;
  charAccentNavy: string;
  // Paragraph styles (paraPrIDRef)
  paraCenter: string;
  paraLeft: string;
  paraRight: string;
  paraJustify: string;
  // BorderFill styles (borderFillIDRef)
  bfBasic: string;
  bfHeaderSlate: string;
  bfBannerGray: string;
  bfSubHeaderLight: string;
  bfPosterBox: string;
  bfNavyBadge: string;
}

function createStylePalette(doc: HwpxDocument): StylePalette {
  const font = '함초롬바탕';
  const gothic = '함초롬돋움';

  const charTitle = doc.ensureRunStyle({ fontFamily: gothic, fontSize: 16, bold: true, textColor: '#09396A' });
  const charSubTitle = doc.ensureRunStyle({ fontFamily: gothic, fontSize: 10.5, bold: true, textColor: '#1E293B' });
  const charSectionHeading = doc.ensureRunStyle({ fontFamily: gothic, fontSize: 11.5, bold: true, textColor: '#0F172A' });
  const charTableHeader = doc.ensureRunStyle({ fontFamily: gothic, fontSize: 9.5, bold: true, textColor: '#0F172A' });
  const charBody = doc.ensureRunStyle({ fontFamily: font, fontSize: 9.5, bold: false, textColor: '#111827' });
  const charBodyBold = doc.ensureRunStyle({ fontFamily: gothic, fontSize: 9.5, bold: true, textColor: '#09396A' });
  const charBodySmall = doc.ensureRunStyle({ fontFamily: font, fontSize: 8.8, bold: false, textColor: '#334155' });
  const charAccentNavy = doc.ensureRunStyle({ fontFamily: gothic, fontSize: 10, bold: true, textColor: '#FFFFFF' });

  const paraCenter = doc.ensureParaStyle({ alignment: 'CENTER', lineSpacingValue: 150 });
  const paraLeft = doc.ensureParaStyle({ alignment: 'LEFT', lineSpacingValue: 160 });
  const paraRight = doc.ensureParaStyle({ alignment: 'RIGHT', lineSpacingValue: 150 });
  const paraJustify = doc.ensureParaStyle({ alignment: 'JUSTIFY', lineSpacingValue: 165 });

  const bfBasic = doc.oxml.ensureBorderFillStyle({
    sides: {
      left: { type: 'SOLID', width: '0.12 mm', color: '#475569' },
      right: { type: 'SOLID', width: '0.12 mm', color: '#475569' },
      top: { type: 'SOLID', width: '0.12 mm', color: '#475569' },
      bottom: { type: 'SOLID', width: '0.12 mm', color: '#475569' },
    },
    backgroundColor: null,
  });

  const bfHeaderSlate = doc.oxml.ensureBorderFillStyle({
    sides: {
      left: { type: 'SOLID', width: '0.12 mm', color: '#475569' },
      right: { type: 'SOLID', width: '0.12 mm', color: '#475569' },
      top: { type: 'SOLID', width: '0.12 mm', color: '#475569' },
      bottom: { type: 'SOLID', width: '0.12 mm', color: '#475569' },
    },
    backgroundColor: '#EEF2F7',
  });

  const bfBannerGray = doc.oxml.ensureBorderFillStyle({
    sides: {
      left: { type: 'SOLID', width: '0.12 mm', color: '#475569' },
      right: { type: 'SOLID', width: '0.12 mm', color: '#475569' },
      top: { type: 'SOLID', width: '0.18 mm', color: '#1E293B' },
      bottom: { type: 'SOLID', width: '0.15 mm', color: '#334155' },
    },
    backgroundColor: '#E2E8F0',
  });

  const bfSubHeaderLight = doc.oxml.ensureBorderFillStyle({
    sides: {
      left: { type: 'SOLID', width: '0.12 mm', color: '#64748B' },
      right: { type: 'SOLID', width: '0.12 mm', color: '#64748B' },
      top: { type: 'SOLID', width: '0.12 mm', color: '#64748B' },
      bottom: { type: 'SOLID', width: '0.12 mm', color: '#64748B' },
    },
    backgroundColor: '#E5E7EB',
  });

  const bfPosterBox = doc.oxml.ensureBorderFillStyle({
    sides: {
      left: { type: 'SOLID', width: '0.2 mm', color: '#1E293B' },
      right: { type: 'SOLID', width: '0.2 mm', color: '#1E293B' },
      top: { type: 'SOLID', width: '0.2 mm', color: '#1E293B' },
      bottom: { type: 'SOLID', width: '0.2 mm', color: '#1E293B' },
    },
    backgroundColor: '#FAFAFA',
  });

  const bfNavyBadge = doc.oxml.ensureBorderFillStyle({
    sides: {
      left: { type: 'SOLID', width: '0.15 mm', color: '#09396A' },
      right: { type: 'SOLID', width: '0.15 mm', color: '#09396A' },
      top: { type: 'SOLID', width: '0.15 mm', color: '#09396A' },
      bottom: { type: 'SOLID', width: '0.15 mm', color: '#09396A' },
    },
    backgroundColor: '#09396A',
  });

  return {
    charTitle,
    charSubTitle,
    charSectionHeading,
    charTableHeader,
    charBody,
    charBodyBold,
    charBodySmall,
    charAccentNavy,
    paraCenter,
    paraLeft,
    paraRight,
    paraJustify,
    bfBasic,
    bfHeaderSlate,
    bfBannerGray,
    bfSubHeaderLight,
    bfPosterBox,
    bfNavyBadge,
  };
}

type CellLineBlock =
  | {
      kind: 'text';
      text: string;
      charPrId: string;
      paraPrId: string;
    }
  | {
      kind: 'table';
      paraPrId: string;
      build: (hostPara: HwpxOxmlParagraph) => void;
    };

function getSubList(cell: HwpxOxmlTableCell): Element {
  const children = cell.element.childNodes;
  for (let i = 0; i < children.length; i++) {
    const ch = children.item(i);
    if (ch && ch.nodeType === 1) {
      const el = ch as Element;
      const ln = el.localName || el.tagName.split(':').pop() || '';
      if (ln === 'subList') return el;
    }
  }
  const doc = cell.element.ownerDocument!;
  const sl = doc.createElementNS(HP_NS, 'subList');
  sl.setAttribute('id', '');
  sl.setAttribute('textDirection', 'HORIZONTAL');
  sl.setAttribute('lineWrap', 'BREAK');
  sl.setAttribute('vertAlign', 'CENTER');
  sl.setAttribute('linkListIDRef', '0');
  sl.setAttribute('linkListNextIDRef', '0');
  sl.setAttribute('textWidth', '0');
  sl.setAttribute('textHeight', '0');
  sl.setAttribute('hasTextRef', '0');
  sl.setAttribute('hasNumRef', '0');
  cell.element.insertBefore(sl, cell.element.firstChild);
  return sl;
}

function setCellRichContent(
  cell: HwpxOxmlTableCell,
  section: HwpxOxmlSection,
  blocks: CellLineBlock[],
  opts: {
    borderFillId: string;
    vertAlign?: 'TOP' | 'CENTER' | 'BOTTOM';
    paddingH?: number;
    paddingV?: number;
  }
): void {
  cell.borderFillIDRef = opts.borderFillId;
  cell.vertAlign = opts.vertAlign || 'CENTER';
  cell.element.setAttribute('hasMargin', '1');
  cell.element.setAttribute('dirty', '1');
  cell.setMargin({
    left: opts.paddingH ?? 620,
    right: opts.paddingH ?? 620,
    top: opts.paddingV ?? 340,
    bottom: opts.paddingV ?? 340,
  });

  const subList = getSubList(cell);
  // 기존 문단 제거
  for (let i = subList.childNodes.length - 1; i >= 0; i--) {
    const ch = subList.childNodes.item(i);
    if (ch) subList.removeChild(ch);
  }

  const xmlDoc = cell.element.ownerDocument!;
  const safeBlocks: CellLineBlock[] =
    blocks.length > 0
      ? blocks
      : [{ kind: 'text', text: '', charPrId: '0', paraPrId: '0' }];

  for (const b of safeBlocks) {
    const pEl = xmlDoc.createElementNS(HP_NS, 'p');
    pEl.setAttribute('id', makeParaId());
    pEl.setAttribute('paraPrIDRef', String(b.paraPrId));
    pEl.setAttribute('styleIDRef', '0');
    pEl.setAttribute('pageBreak', '0');
    pEl.setAttribute('columnBreak', '0');
    pEl.setAttribute('merged', '0');
    subList.appendChild(pEl);

    if (b.kind === 'text') {
      const runEl = xmlDoc.createElementNS(HP_NS, 'run');
      runEl.setAttribute('charPrIDRef', String(b.charPrId));
      const tEl = xmlDoc.createElementNS(HP_NS, 't');
      tEl.textContent = b.text;
      runEl.appendChild(tEl);
      pEl.appendChild(runEl);
    } else {
      const hostPara = new HwpxOxmlParagraph(pEl, section);
      b.build(hostPara);
    }
  }
  cell.table.markDirty();
}

function setCellSimpleText(
  cell: HwpxOxmlTableCell,
  section: HwpxOxmlSection,
  text: string,
  opts: {
    charPrId: string;
    paraPrId: string;
    borderFillId: string;
    vertAlign?: 'TOP' | 'CENTER' | 'BOTTOM';
    paddingH?: number;
    paddingV?: number;
  }
): void {
  const lines = String(text || '').split(/\r?\n/);
  const blocks: CellLineBlock[] = lines.map((line) => ({
    kind: 'text',
    text: line,
    charPrId: opts.charPrId,
    paraPrId: opts.paraPrId,
  }));
  setCellRichContent(cell, section, blocks, opts);
}

function configureTableDefaults(table: HwpxOxmlTable, width: number, colWidths: number[]) {
  table.setSize(width, table.height);
  table.pageBreak = 'CELL';
  table.repeatHeader = false;
  table.setInMargin({ left: 560, right: 560, top: 300, bottom: 300 });
  table.setOutMargin({ left: 0, right: 0, top: 180, bottom: 260 });
  colWidths.forEach((w, idx) => {
    table.setColumnWidth(idx, w);
  });
}

/**
 * 1. 교사용 출제 원안지 전체 (.hwpx)
 * 업로드된 자료집 PDF 서식(가. 평가 운영 및 적용 방안 + 나. 문항 자료 표 + 포스터 상자 + 4열 채점기준표)과
 * DELTA 확장 항목(수행지시어, 어휘 수준·어휘 수, 의사소통 기능·구문)을 완벽히 재현합니다.
 */
export async function buildMasterSpecHwpx(
  items: ListeningItem[],
  params: GenerationParams,
  options?: { includeTranslation?: boolean; includeExplanation?: boolean }
): Promise<Uint8Array> {
  const includeTranslation = options?.includeTranslation ?? true;
  const includeExplanation = options?.includeExplanation ?? true;

  const doc = await openBlankHwpx();
  const sec = doc.section(0);
  const st = createStylePalette(doc);

  // 상단 제목 배너
  doc.addParagraph(params.assessmentTitle || '2026학년도 대구형 영어듣기 평가 출제 원안', {
    charPrIdRef: st.charTitle,
    paraPrIdRef: st.paraCenter,
  });

  // 상단 요약 배지 테이블 (학교 / 유형 / 학년·과목 / 문항 수)
  const metaPara = doc.addParagraph('', { paraPrIdRef: st.paraCenter });
  const metaTbl = metaPara.addTable(1, 2, {
    width: BODY_WIDTH,
    borderFillIdRef: st.bfHeaderSlate,
  });
  configureTableDefaults(metaTbl, BODY_WIDTH, [8600, BODY_WIDTH - 8600]);
  setCellSimpleText(
    metaTbl.cell(0, 0),
    sec,
    params.mode === 'ib' ? '대구형 (IB·사고력)' : '기존 영어듣기형',
    {
      charPrId: st.charAccentNavy,
      paraPrId: st.paraCenter,
      borderFillId: st.bfNavyBadge,
    }
  );
  setCellSimpleText(
    metaTbl.cell(0, 1),
    sec,
    `${params.schoolName ? params.schoolName + '  |  ' : ''}${params.schoolLevel}등학교 ${params.grade} · ${params.subject}  |  ${params.evalPurpose}  |  총 ${items.length}문항`,
    {
      charPrId: st.charSubTitle,
      paraPrId: st.paraLeft,
      borderFillId: st.bfHeaderSlate,
    }
  );

  // 가. 평가 운영 및 적용 방안 (첫 문항 또는 파라미터 토글 시 포함)
  const guideSource = items.find((it) => it.includeOperationGuide) || (params.includeOperationGuide ? items[0] : undefined);
  if (guideSource) {
    doc.addParagraph('', { charPrIdRef: st.charBodySmall, paraPrIdRef: st.paraLeft });
    doc.addParagraph('가. 평가 운영 및 적용 방안', {
      charPrIdRef: st.charSectionHeading,
      paraPrIdRef: st.paraLeft,
    });

    const opPara = doc.addParagraph('', { paraPrIdRef: st.paraLeft });
    const opTbl = opPara.addTable(3, 2, {
      width: BODY_WIDTH,
      borderFillIdRef: st.bfBasic,
    });
    const col0 = 10400;
    const col1 = BODY_WIDTH - col0;
    configureTableDefaults(opTbl, BODY_WIDTH, [col0, col1]);

    const opRows: [string, string][] = [
      ['운영 방법', guideSource.operationGuide.method],
      ['장점 및 기대효과', guideSource.operationGuide.benefits],
      ['운영 시 유의사항', guideSource.operationGuide.cautions],
    ];
    opRows.forEach(([label, val], rIdx) => {
      setCellSimpleText(opTbl.cell(rIdx, 0), sec, label, {
        charPrId: st.charTableHeader,
        paraPrId: st.paraCenter,
        borderFillId: st.bfHeaderSlate,
      });
      setCellSimpleText(opTbl.cell(rIdx, 1), sec, val, {
        charPrId: st.charBody,
        paraPrId: st.paraJustify,
        borderFillId: st.bfBasic,
      });
    });
  }

  // 문항별 명세표 출력
  items.forEach((item, idx) => {
    doc.addParagraph('', {
      charPrIdRef: st.charBodySmall,
      paraPrIdRef: st.paraLeft,
    });
    const secLetter = KOR_SEC_LETTERS[idx] || `${idx + 1}`;
    const headingPara = doc.addParagraph(`${secLetter}. 문항 자료(${item.itemNo})`, {
      charPrIdRef: st.charSectionHeading,
      paraPrIdRef: st.paraLeft,
    });
    if (idx > 0) {
      headingPara.pageBreak = true;
    }

    const actualWordCount = countTranscriptWords(item.transcript);
    const metaRows: [string, string][] = [
      ['학년 / 과목', item.gradeSubject],
      ['평가 방법', item.evalMethod],
      ['성취기준', item.achievementStandard],
      [
        '수행지시어 / 평가기능',
        `[${item.directive}] ${item.skill}   (난이도: ${item.difficulty} · 배점: ${item.totalMarks}점)`,
      ],
      [
        '어휘 수준 / 어휘 수',
        `${item.vocabLevelLabel}  |  대본 어휘 수: ${actualWordCount}단어${
          item.keyVocab.trim() ? `  |  핵심어휘: ${item.keyVocab}` : ''
        }`,
      ],
    ];

    if (item.expressions.length > 0 || item.structures.length > 0) {
      const expPart = item.expressions.length ? `[의사소통 기능] ${item.expressions.join(', ')}` : '';
      const strPart = item.structures.length ? `[언어 형식] ${item.structures.join(', ')}` : '';
      metaRows.push(['의사소통 기능 / 구문', [expPart, strPart].filter(Boolean).join('   /   ')]);
    }

    metaRows.push(
      ['평가 과제 및 문항 구성', item.taskDescription],
      ['듣기 자료 유형', item.materialType],
      ['듣기 자료 출처', item.source || '자체 제작(AI 생성)']
    );

    // 총 행 수 = 메타 행들 + (듣기자료 배너 + 듣기자료 본문) + (문항지 배너 + 문항지 본문) + (채점기준 배너 + 채점기준 본문)
    const totalRows = metaRows.length + 6;
    const tblPara = doc.addParagraph('', { paraPrIdRef: st.paraLeft });
    const specTbl = tblPara.addTable(totalRows, 2, {
      width: BODY_WIDTH,
      borderFillIdRef: st.bfBasic,
    });
    const leftW = 10800;
    const rightW = BODY_WIDTH - leftW;
    configureTableDefaults(specTbl, BODY_WIDTH, [leftW, rightW]);

    // 1) 상단 2열 메타데이터 행 채우기
    metaRows.forEach(([label, val], rIdx) => {
      setCellSimpleText(specTbl.cell(rIdx, 0), sec, label, {
        charPrId: st.charTableHeader,
        paraPrId: st.paraCenter,
        borderFillId: st.bfHeaderSlate,
      });
      setCellSimpleText(specTbl.cell(rIdx, 1), sec, val, {
        charPrId: st.charBody,
        paraPrId: st.paraLeft,
        borderFillId: st.bfBasic,
      });
    });

    let curRow = metaRows.length;

    // 2) 듣기 자료(텍스트) 배너 및 본문
    specTbl.mergeCells(curRow, 0, curRow, 1);
    setCellSimpleText(specTbl.cell(curRow, 0), sec, '듣기 자료(텍스트)', {
      charPrId: st.charTableHeader,
      paraPrId: st.paraCenter,
      borderFillId: st.bfBannerGray,
    });
    curRow++;

    specTbl.mergeCells(curRow, 0, curRow, 1);
    const scriptBlocks: CellLineBlock[] = String(item.transcript || '')
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((line) => ({
        kind: 'text' as const,
        text: line,
        charPrId: st.charBody,
        paraPrId: st.paraJustify,
      }));

    if (includeTranslation && item.koreanTranslation.trim()) {
      scriptBlocks.push({
        kind: 'text',
        text: '',
        charPrId: st.charBodySmall,
        paraPrId: st.paraLeft,
      });
      scriptBlocks.push({
        kind: 'text',
        text: '[우리말 해석]',
        charPrId: st.charBodyBold,
        paraPrId: st.paraLeft,
      });
      String(item.koreanTranslation)
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .forEach((line) => {
          scriptBlocks.push({
            kind: 'text',
            text: line,
            charPrId: st.charBodySmall,
            paraPrId: st.paraJustify,
          });
        });
    }

    setCellRichContent(specTbl.cell(curRow, 0), sec, scriptBlocks, {
      borderFillId: st.bfBasic,
      vertAlign: 'TOP',
      paddingH: 700,
      paddingV: 480,
    });
    curRow++;

    // 3) 문항지, 활동지 또는 수행 과제 안내문 배너 및 본문
    specTbl.mergeCells(curRow, 0, curRow, 1);
    setCellSimpleText(specTbl.cell(curRow, 0), sec, '문항지, 활동지 또는 수행 과제 안내문', {
      charPrId: st.charTableHeader,
      paraPrId: st.paraCenter,
      borderFillId: st.bfBannerGray,
    });
    curRow++;

    specTbl.mergeCells(curRow, 0, curRow, 1);
    const questionBlocks: CellLineBlock[] = [
      {
        kind: 'text',
        text: `문항: ${item.questionPrompt} [${item.totalMarks}점]`,
        charPrId: st.charBodyBold,
        paraPrId: st.paraJustify,
      },
    ];

    // 포스터/안내문 상자 (stimulusTitle이 있거나 gap_poster/tf_justify인 경우 중첩 박스 테이블로 깔끔하게 렌더링)
    if (item.stimulusTitle.trim() || (item.stimulusBody.trim() && item.questionFormat === 'gap_poster')) {
      questionBlocks.push({
        kind: 'text',
        text: '',
        charPrId: st.charBodySmall,
        paraPrId: st.paraCenter,
      });
      questionBlocks.push({
        kind: 'table',
        paraPrId: st.paraCenter,
        build: (hostPara) => {
          const boxW = BODY_WIDTH - 4200;
          const boxTbl = hostPara.addTable(1, 1, {
            width: boxW,
            borderFillIdRef: st.bfPosterBox,
          });
          configureTableDefaults(boxTbl, boxW, [boxW]);
          const boxLines: CellLineBlock[] = [];
          if (item.stimulusTitle.trim()) {
            boxLines.push({
              kind: 'text',
              text: item.stimulusTitle.trim(),
              charPrId: st.charTableHeader,
              paraPrId: st.paraCenter,
            });
          }
          String(item.stimulusBody || '')
            .split(/\r?\n/)
            .forEach((line) => {
              boxLines.push({
                kind: 'text',
                text: line,
                charPrId: st.charBody,
                paraPrId: st.paraLeft,
              });
            });
          setCellRichContent(boxTbl.cell(0, 0), sec, boxLines, {
            borderFillId: st.bfPosterBox,
            vertAlign: 'CENTER',
            paddingH: 800,
            paddingV: 450,
          });
        },
      });
    } else if (item.stimulusBody.trim()) {
      // (1) 남자의 의도: / (2) 이유: 형태
      questionBlocks.push({
        kind: 'text',
        text: '',
        charPrId: st.charBodySmall,
        paraPrId: st.paraLeft,
      });
      String(item.stimulusBody)
        .split(/\r?\n/)
        .forEach((line) => {
          questionBlocks.push({
            kind: 'text',
            text: line,
            charPrId: st.charBody,
            paraPrId: st.paraLeft,
          });
        });
    }

    // 5지선다 선택지
    if (!item.isConstructedResponse) {
      item.options.slice(0, 5).forEach((opt, oIdx) => {
        if (opt.trim()) {
          questionBlocks.push({
            kind: 'text',
            text: `${CIRCLED_NUMS[oIdx]} ${opt.trim()}`,
            charPrId: st.charBody,
            paraPrId: st.paraLeft,
          });
        }
      });
    }

    setCellRichContent(specTbl.cell(curRow, 0), sec, questionBlocks, {
      borderFillId: st.bfBasic,
      vertAlign: 'TOP',
      paddingH: 700,
      paddingV: 480,
    });
    curRow++;

    // 4) 채점 기준 배너 및 본문 (서답형은 4열 중첩 표, 선택형은 정답 + 해설)
    specTbl.mergeCells(curRow, 0, curRow, 1);
    setCellSimpleText(
      specTbl.cell(curRow, 0),
      sec,
      item.isConstructedResponse ? '채점 기준(서답형 문항의 경우)' : '채점 기준',
      {
        charPrId: st.charTableHeader,
        paraPrId: st.paraCenter,
        borderFillId: st.bfBannerGray,
      }
    );
    curRow++;

    specTbl.mergeCells(curRow, 0, curRow, 1);
    const gradingBlocks: CellLineBlock[] = [];

    if (item.isConstructedResponse) {
      const rubRows =
        item.rubricRows.length > 0
          ? item.rubricRows
          : [{ id: 'def', scoreLabel: `${item.totalMarks}점`, criteria: '핵심 내용을 정확하게 작성한 경우' }];

      gradingBlocks.push({
        kind: 'table',
        paraPrId: st.paraCenter,
        build: (hostPara) => {
          const innerW = BODY_WIDTH - 2400;
          const rCnt = rubRows.length + 1;
          const rubTbl = hostPara.addTable(rCnt, 4, {
            width: innerW,
            borderFillIdRef: st.bfBasic,
          });
          const w0 = 4200; // 문항 번호
          const w1 = 13200; // 모범답안
          const w3 = 4400; // 배점
          const w2 = innerW - w0 - w1 - w3; // 세부 채점 기준
          configureTableDefaults(rubTbl, innerW, [w0, w1, w2, w3]);

          // 헤더 행
          const headers = ['문항 번호', '모범답안', '세부 채점 기준', '배점'];
          headers.forEach((hText, cIdx) => {
            setCellSimpleText(rubTbl.cell(0, cIdx), sec, hText, {
              charPrId: st.charTableHeader,
              paraPrId: st.paraCenter,
              borderFillId: st.bfSubHeaderLight,
            });
          });

          // 문항 번호 & 모범답안 세로 병합 (2행 이상일 때)
          if (rubRows.length > 1) {
            rubTbl.mergeCells(1, 0, rubRows.length, 0);
            rubTbl.mergeCells(1, 1, rubRows.length, 1);
          }

          setCellSimpleText(rubTbl.cell(1, 0), sec, String(item.itemNo), {
            charPrId: st.charBodyBold,
            paraPrId: st.paraCenter,
            borderFillId: st.bfBasic,
          });
          setCellSimpleText(rubTbl.cell(1, 1), sec, item.modelAnswer || '-', {
            charPrId: st.charBody,
            paraPrId: st.paraLeft,
            borderFillId: st.bfBasic,
          });

          rubRows.forEach((rr, rrIdx) => {
            const targetRow = rrIdx + 1;
            const critText = rr.criteria.trim().startsWith('•')
              ? rr.criteria.trim()
              : `• ${rr.criteria.trim()}`;
            setCellSimpleText(rubTbl.cell(targetRow, 2), sec, critText, {
              charPrId: st.charBody,
              paraPrId: st.paraJustify,
              borderFillId: st.bfBasic,
            });
            setCellSimpleText(rubTbl.cell(targetRow, 3), sec, rr.scoreLabel, {
              charPrId: st.charBodyBold,
              paraPrId: st.paraCenter,
              borderFillId: st.bfBasic,
            });
          });
        },
      });
    } else {
      gradingBlocks.push({
        kind: 'text',
        text: `정답: ${item.correctChoice}번 (${CIRCLED_NUMS[item.correctChoice - 1] || ''})`,
        charPrId: st.charBodyBold,
        paraPrId: st.paraLeft,
      });
    }

    if (includeExplanation && item.explanation.trim()) {
      gradingBlocks.push({
        kind: 'text',
        text: `[출제 근거 및 해설] ${item.explanation.trim()}`,
        charPrId: st.charBodySmall,
        paraPrId: st.paraJustify,
      });
    }

    setCellRichContent(specTbl.cell(curRow, 0), sec, gradingBlocks, {
      borderFillId: st.bfBasic,
      vertAlign: 'TOP',
      paddingH: 650,
      paddingV: 450,
    });
  });

  return doc.save();
}

export type OfficialNumberingMode = 'exam_standard' | 'sequential';

export interface OfficialExamOptions {
  includeCoverPage?: boolean;     // 문제지 표지(1쪽) 포함 여부 (기본 true)
  coverTitle?: string;            // 표지 제목 (예: "2026학년도 2학기 기말시험 문제지 표지")
  examDate?: string;              // 시험일자 (예: "2026. 12. 10.")
  examPeriod?: string;            // 교시 (예: "1" -> "제 1 교시")
  subjectCode?: string;           // 과목코드 (예: "01")
  schoolName?: string;            // 학교명 (예: "대구서부고등학교")
  pageCountOverride?: string;     // 문제지 면 수 직접 지정 (비워두면 분량 기반 자동 산출)
  numberingMode?: OfficialNumberingMode; // 'exam_standard'(선택형 → [서답형]) | 'sequential'(1번~N번 순차)
}

export interface OfficialExamComposition {
  mcqCount: number;
  mcqPoints: number;
  shortAnswerCount: number;
  shortAnswerPoints: number;
  essayCount: number;
  essayPoints: number;
  totalCount: number;
  totalPoints: number;
  estimatedBodyPages: number;
}

export function deriveDefaultCoverTitle(assessmentTitle?: string): string {
  const raw = (assessmentTitle || '').trim();
  if (!raw) return '2026학년도 2학기 기말시험 문제지 표지';
  if (raw.endsWith('문제지 표지')) return raw;
  const stripped = raw
    .replace(/\s*(출제\s*원안지|출제\s*원안|출제\s*문항|원안지|원안|문제지)\s*$/g, '')
    .trim();
  return `${stripped || '2026학년도 2학기 기말시험'} 문제지 표지`;
}

function roundPoints(pts: number): number {
  return Math.round(pts * 100) / 100;
}

function formatCountPointsCell(count: number, points: number): string {
  if (count <= 0) return '-';
  return `${count}문항(${roundPoints(points)}점)`;
}

function visualWidthUnits(str: string): number {
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code > 0x7f) {
      w += 2;
    } else {
      w += 1.05;
    }
  }
  return w;
}

function classifyOptionRowLayout(options: string[]): 1 | 2 | 3 | 5 {
  const cleaned = options.slice(0, 5).map((o) =>
    String(o || '')
      .replace(/^[①②③④⑤1-5][.)\s]*/, '')
      .trim()
  );
  const maxW = cleaned.reduce((acc, cur) => Math.max(acc, visualWidthUnits(cur)), 0);
  if (maxW <= 7.5) return 1;
  if (maxW <= 14.5) return 2;
  if (maxW <= 22.5) return 3;
  return 5;
}

function estimateSingleItemHeightHwpUnit(item: ListeningItem): number {
  const COL_LINE_CHARS = 50; // 영문/한글 혼합 환산 폭 (단폭 30050 hwpUnit 기준)
  const LINE_H = 1820;

  const promptLines = Math.max(
    1,
    Math.ceil((visualWidthUnits(item.questionPrompt) + 14) / COL_LINE_CHARS)
  );
  let h = promptLines * LINE_H;

  const hasBox =
    Boolean(item.stimulusTitle.trim()) ||
    (Boolean(item.stimulusBody.trim()) &&
      (item.questionFormat === 'gap_poster' ||
        item.questionFormat === 'tf_justify' ||
        !item.isConstructedResponse));

  if (hasBox) {
    const bodyLines = String(item.stimulusBody || '')
      .split(/\r?\n/)
      .reduce(
        (sum, ln) => sum + Math.max(1, Math.ceil(visualWidthUnits(ln) / (COL_LINE_CHARS - 4))),
        item.stimulusTitle.trim() ? 1 : 0
      );
    h += bodyLines * 1760 + 960;
  } else if (item.stimulusBody.trim()) {
    const subLines = String(item.stimulusBody)
      .split(/\r?\n/)
      .filter((l) => l.trim()).length;
    h += subLines * LINE_H;
  }

  if (item.isConstructedResponse) {
    h += 2 * LINE_H; // 답안 메모 여백
  } else {
    const layout = classifyOptionRowLayout(item.options);
    if (layout === 1) h += LINE_H;
    else if (layout === 2) h += 2 * LINE_H;
    else if (layout === 3) h += 3 * LINE_H;
    else {
      const optLines = item.options.slice(0, 5).reduce((sum, opt) => {
        const w = visualWidthUnits(opt) + 4;
        return sum + Math.max(1, Math.ceil(w / (COL_LINE_CHARS - 2)));
      }, 0);
      h += optLines * LINE_H;
    }
  }

  // 문항 간 빈 줄
  h += item.isConstructedResponse ? 2 * LINE_H : LINE_H;
  return h;
}

export function summarizeOfficialExamComposition(
  items: ListeningItem[]
): OfficialExamComposition {
  let mcqCount = 0;
  let mcqPoints = 0;
  let shortAnswerCount = 0;
  let shortAnswerPoints = 0;
  let essayCount = 0;
  let essayPoints = 0;

  for (const it of items) {
    const pts = Number(it.totalMarks) || 0;
    if (!it.isConstructedResponse) {
      mcqCount += 1;
      mcqPoints += pts;
    } else if (it.questionFormat === 'gap_poster' || it.questionFormat === 'short_en') {
      shortAnswerCount += 1;
      shortAnswerPoints += pts;
    } else {
      essayCount += 1;
      essayPoints += pts;
    }
  }

  // B4 2단 본문 단 높이 시뮬레이션 (단당 가용 높이 약 87,000 hwpUnit, 마지막 단 우하단 저작권 상자 6,500 확보)
  const USABLE_COL_H = 87000;
  let colUsed = 1600; // 상단 10pt 한 줄 비우기
  let colIndex = 0;

  for (const it of items) {
    const itemH = estimateSingleItemHeightHwpUnit(it);
    if (colUsed + itemH > USABLE_COL_H && colUsed > 2000) {
      colIndex += 1;
      colUsed = itemH;
    } else {
      colUsed += itemH;
    }
  }
  // 우측 단에서 저작권 상자와 겹칠 경우 1단 추가 여유 반영
  if (colIndex % 2 === 1 && colUsed + 6500 > USABLE_COL_H) {
    colIndex += 1;
  }
  const totalCols = colIndex + 1;
  const estimatedBodyPages = Math.max(1, Math.ceil(totalCols / 2));

  const totalCount = mcqCount + shortAnswerCount + essayCount;
  const totalPoints = roundPoints(mcqPoints + shortAnswerPoints + essayPoints);

  return {
    mcqCount,
    mcqPoints: roundPoints(mcqPoints),
    shortAnswerCount,
    shortAnswerPoints: roundPoints(shortAnswerPoints),
    essayCount,
    essayPoints: roundPoints(essayPoints),
    totalCount,
    totalPoints,
    estimatedBodyPages,
  };
}

// ---- XML DOM 유틸리티 (@xmldom/xmldom 및 브라우저 DOM 모두 호환) ----

function domLocalTag(node: Node | null | undefined): string {
  if (!node || node.nodeType !== 1) return '';
  const el = node as Element;
  return el.localName || el.tagName.split(':').pop() || '';
}

function domChildElements(parent: Node, tag?: string): Element[] {
  const out: Element[] = [];
  const nodes = parent.childNodes;
  for (let i = 0; i < nodes.length; i++) {
    const ch = nodes.item(i);
    if (ch && ch.nodeType === 1) {
      const el = ch as Element;
      if (!tag || domLocalTag(el) === tag) {
        out.push(el);
      }
    }
  }
  return out;
}

function domFindAll(root: Node, tag: string): Element[] {
  const out: Element[] = [];
  const walk = (n: Node) => {
    const children = n.childNodes;
    for (let i = 0; i < children.length; i++) {
      const ch = children.item(i);
      if (ch && ch.nodeType === 1) {
        const el = ch as Element;
        if (domLocalTag(el) === tag) out.push(el);
        walk(el);
      }
    }
  };
  walk(root);
  return out;
}

function domFindByAttr(
  root: Node,
  tag: string,
  attr: string,
  val: string
): Element | null {
  const all = domFindAll(root, tag);
  for (const el of all) {
    if (el.getAttribute(attr) === val) return el;
  }
  return null;
}

function domClearChildren(node: Node): void {
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const ch = node.childNodes.item(i);
    if (ch) node.removeChild(ch);
  }
}

function domStripLineSegArrays(root: Node): void {
  const segs = domFindAll(root, 'linesegarray');
  for (const seg of segs) {
    if (seg.parentNode) {
      seg.parentNode.removeChild(seg);
    }
  }
}

function domStripMemoCtrls(root: Node): void {
  const ctrls = domFindAll(root, 'ctrl');
  for (const ctrl of ctrls) {
    const fb = domChildElements(ctrl, 'fieldBegin')[0];
    const fe = domChildElements(ctrl, 'fieldEnd')[0];
    if ((fb && fb.getAttribute('type') === 'MEMO') || fe) {
      if (ctrl.parentNode) {
        ctrl.parentNode.removeChild(ctrl);
      }
    }
  }
}

function createHpPara(
  xmlDoc: Document,
  paraPrId: string,
  styleId: string,
  runs: Array<{ charPrId: string; text?: string; nodes?: Node[] }>
): Element {
  const pEl = xmlDoc.createElementNS(HP_NS, 'hp:p');
  pEl.setAttribute('id', '0');
  pEl.setAttribute('paraPrIDRef', paraPrId);
  pEl.setAttribute('styleIDRef', styleId);
  pEl.setAttribute('pageBreak', '0');
  pEl.setAttribute('columnBreak', '0');
  pEl.setAttribute('merged', '0');

  if (runs.length === 0) {
    const runEl = xmlDoc.createElementNS(HP_NS, 'hp:run');
    runEl.setAttribute('charPrIDRef', '32');
    pEl.appendChild(runEl);
    return pEl;
  }

  for (const r of runs) {
    const runEl = xmlDoc.createElementNS(HP_NS, 'hp:run');
    runEl.setAttribute('charPrIDRef', r.charPrId);
    if (r.nodes) {
      for (const n of r.nodes) {
        runEl.appendChild(n);
      }
    }
    if (r.text !== undefined) {
      const tEl = xmlDoc.createElementNS(HP_NS, 'hp:t');
      tEl.appendChild(xmlDoc.createTextNode(r.text));
      runEl.appendChild(tEl);
    }
    pEl.appendChild(runEl);
  }
  return pEl;
}

function createHpTabbedOptionPara(
  xmlDoc: Document,
  paraPrId: string,
  styleId: string,
  charPrId: string,
  segments: string[]
): Element {
  const pEl = xmlDoc.createElementNS(HP_NS, 'hp:p');
  pEl.setAttribute('id', '0');
  pEl.setAttribute('paraPrIDRef', paraPrId);
  pEl.setAttribute('styleIDRef', styleId);
  pEl.setAttribute('pageBreak', '0');
  pEl.setAttribute('columnBreak', '0');
  pEl.setAttribute('merged', '0');

  const runEl = xmlDoc.createElementNS(HP_NS, 'hp:run');
  runEl.setAttribute('charPrIDRef', charPrId);

  const tEl = xmlDoc.createElementNS(HP_NS, 'hp:t');
  segments.forEach((seg, idx) => {
    tEl.appendChild(xmlDoc.createTextNode(seg));
    if (idx < segments.length - 1) {
      const tabEl = xmlDoc.createElementNS(HP_NS, 'hp:tab');
      tabEl.setAttribute('width', '1200');
      tabEl.setAttribute('leader', '0');
      tabEl.setAttribute('type', '1');
      tEl.appendChild(tabEl);
    }
  });

  runEl.appendChild(tEl);
  pEl.appendChild(runEl);
  return pEl;
}

function cleanStemText(rawPrompt: string): string {
  return String(rawPrompt || '')
    .replace(/^(\[?\s*서답형\s*\d+\s*\]?|\d+\s*[.)]|문항\s*[:：])\s*/i, '')
    .replace(/\s*\[\s*\d+(?:\.\d+)?\s*점[^\]]*\]\s*$/g, '')
    .trim();
}

function cleanOptionText(rawOpt: string): string {
  return String(rawOpt || '')
    .replace(/^[①②③④⑤1-5][.)\s]*/, '')
    .trim();
}

function formatBulletLineForExam(line: string): string {
  return line.replace(/^\s*[-*•]\s+/, '◦ ');
}

function setTableRowCellsText(
  xmlDoc: Document,
  tblEl: Element,
  rowIndex: number,
  values: string[],
  paraPrId: string,
  charPrId: string
): void {
  const rows = domChildElements(tblEl, 'tr');
  const rowEl = rows[rowIndex];
  if (!rowEl) return;
  const cells = domChildElements(rowEl, 'tc');
  values.forEach((val, cIdx) => {
    const tc = cells[cIdx];
    if (!tc) return;
    const subList = domChildElements(tc, 'subList')[0];
    if (!subList) return;
    domClearChildren(subList);
    subList.appendChild(
      createHpPara(xmlDoc, paraPrId, '0', [{ charPrId, text: val }])
    );
  });
}

/**
 * 2. 업로드된 학교 정기고사 [원안_양식] 100% 준수 HWPX 문제지 생성
 * - Section 0 (선택 가능): B4 1단 문제지 표지 (시험일자·교시 상자, 과목코드·면 수·선택형/단답형/서술형 문항 수 및 배점 표, 유의사항 1~5, 하단 학교명)
 * - Section 1: B4 2단 본문 원안 (바깥쪽 테두리 + 중앙 단 구분선, 하단 꼬리말, 함초롬바탕 13pt 굵게 자동 문제번호/서답형 번호 + 11pt 본문 160%, 29484 폭 <보기>·포스터 상자, 1/2/3/5행 자동 선택지 배열, 우하단 저작권 안내 상자)
 */
export async function buildOfficialExamHwpx(
  items: ListeningItem[],
  params: GenerationParams,
  options?: OfficialExamOptions
): Promise<Uint8Array> {
  const includeCoverPage = options?.includeCoverPage ?? true;
  const numberingMode: OfficialNumberingMode = options?.numberingMode ?? 'exam_standard';
  const coverTitle =
    (options?.coverTitle ?? '').trim() || deriveDefaultCoverTitle(params.assessmentTitle);

  const rawDate = (options?.examDate ?? '').trim() || '2026. 00. 00.';
  const cleanDate = rawDate.replace(/^시험일자\s*[:：]\s*/, '').trim();

  const rawPeriod = (options?.examPeriod ?? '').trim() || '1';
  const cleanPeriod = rawPeriod.replace(/^제\s*/, '').replace(/\s*교시$/, '').trim() || '1';

  const subjectCode = (options?.subjectCode ?? '').trim() || '01';
  const schoolName =
    (options?.schoolName ?? params.schoolName ?? '').trim() || '대구서부고등학교';
  const gradeNum =
    (params.grade || '').replace(/[^0-9]/g, '').trim() ||
    (params.grade || '').replace(/학년/g, '').trim() ||
    '1';
  const subjectName = (params.subject || '').trim() || '공통영어1';

  const comp = summarizeOfficialExamComposition(items);
  const manualPages = parseInt((options?.pageCountOverride ?? '').trim(), 10);
  const bodyPages =
    !Number.isNaN(manualPages) && manualPages > 0
      ? manualPages
      : comp.estimatedBodyPages;

  const pkg = await HwpxPackage.open(getExamPaperTemplateHwpxBytes());
  const sec0El = pkg.getXml('Contents/section0.xml');
  const sec1El = pkg.getXml('Contents/section1.xml');
  const doc0 = sec0El.ownerDocument!;
  const doc1 = sec1El.ownerDocument!;

  // -------------------------------------------------------------------------
  // A. 꼬리말(<hp:footer id="5">) 업데이트 및 표지 미포함 대비 복제본 확보
  // -------------------------------------------------------------------------
  const footerEl = domFindAll(sec0El, 'footer')[0];
  let clonedFooterCtrlForSec1: Element | null = null;
  if (footerEl) {
    const footerSubList = domChildElements(footerEl, 'subList')[0];
    if (footerSubList) {
      domClearChildren(footerSubList);
      const autoCtrl = doc0.createElementNS(HP_NS, 'hp:ctrl');
      const autoNum = doc0.createElementNS(HP_NS, 'hp:autoNum');
      autoNum.setAttribute('num', '1');
      autoNum.setAttribute('numType', 'PAGE');
      const autoFmt = doc0.createElementNS(HP_NS, 'hp:autoNumFormat');
      autoFmt.setAttribute('type', 'DIGIT');
      autoFmt.setAttribute('userChar', '');
      autoFmt.setAttribute('prefixChar', '');
      autoFmt.setAttribute('suffixChar', '');
      autoFmt.setAttribute('supscript', '0');
      autoNum.appendChild(autoFmt);
      autoCtrl.appendChild(autoNum);

      const footerPara = createHpPara(doc0, '34', '0', [
        {
          charPrId: '41',
          text: `[ ${gradeNum} ]학년  [ ${subjectName} ]과   `,
        },
        {
          charPrId: '41',
          nodes: [autoCtrl],
        },
        {
          charPrId: '41',
          text: `/ ${bodyPages}                        ${schoolName}`,
        },
      ]);
      footerSubList.appendChild(footerPara);
    }

    if (footerEl.parentNode && domLocalTag(footerEl.parentNode) === 'ctrl') {
      clonedFooterCtrlForSec1 = doc1.importNode(footerEl.parentNode, true) as Element;
    }
  }

  // -------------------------------------------------------------------------
  // B. Section 0 (문제지 표지) 업데이트
  // -------------------------------------------------------------------------
  if (includeCoverPage) {
    // 1) 우측 상단 교시 상자 (rect id="1336371180")
    const periodRect = domFindByAttr(sec0El, 'rect', 'id', '1336371180');
    if (periodRect) {
      const subList = domFindAll(periodRect, 'subList')[0];
      if (subList) {
        domClearChildren(subList);
        subList.appendChild(
          createHpPara(doc0, '4', '0', [
            { charPrId: '9', text: `제 ${cleanPeriod} 교시` },
          ])
        );
      }
    }

    // 2) 좌측 상단 시험일자 상자 (rect id="1336371178")
    const dateRect = domFindByAttr(sec0El, 'rect', 'id', '1336371178');
    if (dateRect) {
      const subList = domFindAll(dateRect, 'subList')[0];
      if (subList) {
        domClearChildren(subList);
        subList.appendChild(
          createHpPara(doc0, '4', '0', [
            { charPrId: '9', text: `시험일자 : ${cleanDate}` },
          ])
        );
      }
    }

    // 3) 표지 제목 및 ( 학년 ) 학년 ( 과목명 ) 문단
    const directParas0 = domChildElements(sec0El, 'p');
    const titleParas = directParas0.filter((p) => p.getAttribute('paraPrIDRef') === '13');
    if (titleParas[0]) {
      domClearChildren(titleParas[0]);
      const rTitle = doc0.createElementNS(HP_NS, 'hp:run');
      rTitle.setAttribute('charPrIDRef', '19');
      const tTitle = doc0.createElementNS(HP_NS, 'hp:t');
      tTitle.appendChild(doc0.createTextNode(coverTitle));
      rTitle.appendChild(tTitle);
      titleParas[0].appendChild(rTitle);
    }
    if (titleParas[1]) {
      domClearChildren(titleParas[1]);
      const runsSpec: Array<{ charPrId: string; text: string }> = [
        { charPrId: '18', text: `( ${gradeNum} ) 학년  (   ` },
        { charPrId: '21', text: subjectName },
        { charPrId: '18', text: '   )' },
      ];
      for (const rs of runsSpec) {
        const rEl = doc0.createElementNS(HP_NS, 'hp:run');
        rEl.setAttribute('charPrIDRef', rs.charPrId);
        const tEl = doc0.createElementNS(HP_NS, 'hp:t');
        tEl.appendChild(doc0.createTextNode(rs.text));
        rEl.appendChild(tEl);
        titleParas[1].appendChild(rEl);
      }
    }

    // 4) 문항 구성 요약표 (단답형 유무에 따라 5열 표 또는 4열 표 자동 선택 & 안내 메모 제거)
    const tblOuter = domFindByAttr(sec0El, 'tbl', 'id', '1336371182');
    const tbl5Col = domFindByAttr(sec0El, 'tbl', 'id', '1336371183');
    const tbl4Col = domFindByAttr(sec0El, 'tbl', 'id', '1087980455');

    if (comp.shortAnswerCount > 0) {
      if (tbl4Col && tbl4Col.parentNode) {
        tbl4Col.parentNode.removeChild(tbl4Col);
      }
      if (tbl5Col) {
        domStripMemoCtrls(tbl5Col);
        setTableRowCellsText(
          doc0,
          tbl5Col,
          1,
          [
            subjectCode,
            String(bodyPages),
            formatCountPointsCell(comp.mcqCount, comp.mcqPoints),
            formatCountPointsCell(comp.shortAnswerCount, comp.shortAnswerPoints),
            formatCountPointsCell(comp.essayCount, comp.essayPoints),
          ],
          '4',
          '16'
        );
      }
    } else {
      if (tbl5Col && tbl5Col.parentNode) {
        tbl5Col.parentNode.removeChild(tbl5Col);
      }
      if (tbl4Col) {
        domStripMemoCtrls(tbl4Col);
        setTableRowCellsText(
          doc0,
          tbl4Col,
          1,
          [
            subjectCode,
            String(bodyPages),
            formatCountPointsCell(comp.mcqCount, comp.mcqPoints),
            formatCountPointsCell(comp.essayCount, comp.essayPoints),
          ],
          '4',
          '16'
        );
      }
    }

    // 두 표 중 하나를 삭제했으므로 바깥 유의사항 상자 높이를 원래 1표 기준(43889)으로 복원
    if (tblOuter) {
      const outerSz = domChildElements(tblOuter, 'sz')[0];
      if (outerSz) {
        outerSz.setAttribute('height', '43889');
      }
    }

    // 5) 하단 학교명 문단 (charPrIDRef="20"에 자간 50%가 내장되어 자동 균등 배치됨)
    const lastPara0 = directParas0[directParas0.length - 1];
    if (lastPara0) {
      // 바깥 표 높이 복원에 맞춰 하단 학교명 위에 여백 1줄 보강하여 B4 표지 하단 균형 유지
      sec0El.insertBefore(
        createHpPara(doc0, '4', '0', [{ charPrId: '10' }]),
        lastPara0
      );
      domClearChildren(lastPara0);
      const rSchool = doc0.createElementNS(HP_NS, 'hp:run');
      rSchool.setAttribute('charPrIDRef', '20');
      const tSchool = doc0.createElementNS(HP_NS, 'hp:t');
      tSchool.appendChild(doc0.createTextNode(schoolName));
      rSchool.appendChild(tSchool);
      lastPara0.appendChild(rSchool);
    }

    domStripLineSegArrays(sec0El);
    pkg.setXml('Contents/section0.xml', sec0El);
  }

  // -------------------------------------------------------------------------
  // C. Section 1 (B4 2단 정기고사 본문 원안) 재구성
  // -------------------------------------------------------------------------
  const origParas1 = domChildElements(sec1El, 'p');
  const origFirstRun = origParas1[0]
    ? domChildElements(origParas1[0], 'run')[0]
    : null;
  const secPrClone = origFirstRun
    ? (domChildElements(origFirstRun, 'secPr')[0]?.cloneNode(true) as Element | undefined)
    : undefined;
  const colPrCtrlClone = origFirstRun
    ? (domChildElements(origFirstRun, 'ctrl')[0]?.cloneNode(true) as Element | undefined)
    : undefined;

  // 템플릿 내 원본 상자 원형 추출 (<보기>/제시문 박스, 3x3 <보 기> 박스, 우하단 저작권 박스)
  const rawBoxTbl = domFindByAttr(sec1El, 'tbl', 'id', '1491212881');
  const rawBogiTbl = domFindByAttr(sec1El, 'tbl', 'id', '1491212882');
  const rawCopyrightTbl = domFindByAttr(sec1El, 'tbl', 'id', '1830985148');

  const boxTblProto = rawBoxTbl ? (rawBoxTbl.cloneNode(true) as Element) : null;
  const bogiTblProto = rawBogiTbl ? (rawBogiTbl.cloneNode(true) as Element) : null;
  const copyrightTblProto = rawCopyrightTbl
    ? (rawCopyrightTbl.cloneNode(true) as Element)
    : null;

  // 기존 예시·안내 문단 모두 비우기
  for (const p of origParas1) {
    sec1El.removeChild(p);
  }

  // 1) 첫 문단 P0: B4 2단 구역 정의(secPr + colPr) + (상단 10pt 한 줄 비우기)
  const p0SetupNodes: Node[] = [];
  if (secPrClone) p0SetupNodes.push(secPrClone);
  if (colPrCtrlClone) p0SetupNodes.push(colPrCtrlClone);
  if (!includeCoverPage && clonedFooterCtrlForSec1) {
    p0SetupNodes.push(clonedFooterCtrlForSec1);
  }
  sec1El.appendChild(
    createHpPara(doc1, '33', '0', [
      { charPrId: '34', nodes: p0SetupNodes },
      { charPrId: '55', text: '' },
    ])
  );

  // 2) 문항 정렬 (정기고사 표준: 선택형 1.~K. → 서답형 [서답형1]~[서답형M])
  const orderedItems =
    numberingMode === 'exam_standard'
      ? [
          ...items.filter((it) => !it.isConstructedResponse),
          ...items.filter((it) => it.isConstructedResponse),
        ]
      : [...items];

  const appendStimulusBox = (titleText: string, bodyText: string) => {
    const trimmedTitle = titleText.trim();
    const lines = String(bodyText || '')
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);

    const isBogiHeader = /^<\s*보\s*기\s*>$/.test(trimmedTitle);

    if (isBogiHeader && bogiTblProto && lines.length > 0) {
      const bogiClone = bogiTblProto.cloneNode(true) as Element;
      bogiClone.setAttribute('id', makeParaId());
      const outMargin = domChildElements(bogiClone, 'outMargin')[0];
      if (outMargin) {
        outMargin.setAttribute('top', '140');
        outMargin.setAttribute('bottom', '180');
      }
      const trs = domChildElements(bogiClone, 'tr');
      const bodyTc = trs[2] ? domChildElements(trs[2], 'tc')[0] : null;
      const subList = bodyTc ? domChildElements(bodyTc, 'subList')[0] : null;
      if (subList) {
        domClearChildren(subList);
        for (const ln of lines) {
          subList.appendChild(
            createHpPara(doc1, '48', '8', [
              { charPrId: '37', text: formatBulletLineForExam(ln) },
            ])
          );
        }
      }
      const bodyH = Math.max(2400, lines.length * 1760 + 420);
      if (bodyTc) {
        const cSz = domChildElements(bodyTc, 'cellSz')[0];
        if (cSz) cSz.setAttribute('height', String(bodyH));
      }
      const tSz = domChildElements(bogiClone, 'sz')[0];
      if (tSz) {
        tSz.setAttribute('height', String(bodyH + 1896));
        tSz.setAttribute('protect', '0');
      }
      domStripLineSegArrays(bogiClone);
      sec1El.appendChild(
        createHpPara(doc1, '31', '0', [
          { charPrId: '24', nodes: [bogiClone], text: '' },
        ])
      );
      return;
    }

    if (boxTblProto) {
      const boxClone = boxTblProto.cloneNode(true) as Element;
      boxClone.setAttribute('id', makeParaId());
      const outMargin = domChildElements(boxClone, 'outMargin')[0];
      if (outMargin) {
        outMargin.setAttribute('top', '140');
        outMargin.setAttribute('bottom', '180');
      }
      const inMargin = domChildElements(boxClone, 'inMargin')[0];
      if (inMargin) {
        inMargin.setAttribute('left', '560');
        inMargin.setAttribute('right', '560');
        inMargin.setAttribute('top', '220');
        inMargin.setAttribute('bottom', '220');
      }
      const tr = domChildElements(boxClone, 'tr')[0];
      const tc = tr ? domChildElements(tr, 'tc')[0] : null;
      const subList = tc ? domChildElements(tc, 'subList')[0] : null;
      let totalLines = 0;

      if (subList) {
        domClearChildren(subList);
        if (trimmedTitle) {
          subList.appendChild(
            createHpPara(doc1, '4', '0', [{ charPrId: '41', text: trimmedTitle }])
          );
          totalLines += 1;
        }
        for (const ln of lines) {
          subList.appendChild(
            createHpPara(doc1, '2', '0', [
              { charPrId: '32', text: formatBulletLineForExam(ln) },
            ])
          );
          totalLines += 1;
        }
        if (totalLines === 0) {
          subList.appendChild(createHpPara(doc1, '2', '0', [{ charPrId: '32', text: '' }]));
          totalLines = 1;
        }
      }

      const estH = Math.max(2400, totalLines * 1820 + 520);
      if (tc) {
        const cSz = domChildElements(tc, 'cellSz')[0];
        if (cSz) cSz.setAttribute('height', String(estH));
        const cMargin = domChildElements(tc, 'cellMargin')[0];
        if (cMargin) {
          cMargin.setAttribute('left', '560');
          cMargin.setAttribute('right', '560');
          cMargin.setAttribute('top', '220');
          cMargin.setAttribute('bottom', '220');
        }
      }
      const tSz = domChildElements(boxClone, 'sz')[0];
      if (tSz) {
        tSz.setAttribute('height', String(estH));
        tSz.setAttribute('protect', '0');
      }
      domStripLineSegArrays(boxClone);
      sec1El.appendChild(
        createHpPara(doc1, '31', '0', [
          { charPrId: '24', nodes: [boxClone], text: '' },
        ])
      );
    }
  };

  const appendMcqOptions = (rawOptions: string[]) => {
    const opts = Array.from({ length: 5 }, (_, k) => cleanOptionText(rawOptions[k] || ''));
    const labeled = opts.map((txt, k) => `${CIRCLED_NUMS[k]} ${txt}`.trimEnd());
    const layout = classifyOptionRowLayout(opts);

    if (layout === 1) {
      // 2024서부고 1행답안 (styleIDRef="4", paraPrIDRef="32")
      sec1El.appendChild(
        createHpTabbedOptionPara(doc1, '32', '4', '29', labeled)
      );
    } else if (layout === 2) {
      // 2024서부고 2행답항 (styleIDRef="5", paraPrIDRef="30")
      sec1El.appendChild(
        createHpTabbedOptionPara(doc1, '30', '5', '29', [
          labeled[0],
          labeled[1],
          labeled[2],
        ])
      );
      sec1El.appendChild(
        createHpTabbedOptionPara(doc1, '30', '5', '29', [labeled[3], labeled[4]])
      );
    } else if (layout === 3) {
      // 2024서부고 3행답항 (styleIDRef="6", paraPrIDRef="28")
      sec1El.appendChild(
        createHpTabbedOptionPara(doc1, '28', '6', '29', [labeled[0], labeled[1]])
      );
      sec1El.appendChild(
        createHpTabbedOptionPara(doc1, '28', '6', '29', [labeled[2], labeled[3]])
      );
      sec1El.appendChild(
        createHpTabbedOptionPara(doc1, '28', '6', '29', [labeled[4]])
      );
    } else {
      // 긴 문장형 선택지: 내어쓰기 정렬된 5행 배열 (양식 3쪽 예시 문단 paraPrIDRef="38", charPrIDRef="33")
      for (const line of labeled) {
        sec1El.appendChild(
          createHpPara(doc1, '38', '0', [{ charPrId: '33', text: line }])
        );
      }
    }
  };

  const appendSubQuestion = (sub: SubQuestionItem, parentMarksShown: boolean) => {
    const subPrompt = cleanStemText(sub.questionPrompt);
    const subPts = roundPoints(Number(sub.totalMarks) || 2);
    const subScoreTag = parentMarksShown ? '' : ` [${subPts}점]`;
    sec1El.appendChild(
      createHpPara(doc1, '47', '10', [
        { charPrId: '32', text: `(${sub.subNo}) ${subPrompt}${subScoreTag}` },
      ])
    );
    if (sub.stimulusTitle?.trim() || sub.stimulusBody?.trim()) {
      appendStimulusBox(sub.stimulusTitle || '', sub.stimulusBody || '');
    }
    if (sub.format === 'mcq_5') {
      appendMcqOptions(sub.options);
    } else {
      sec1El.appendChild(createHpPara(doc1, '2', '0', [{ charPrId: '32', text: '' }]));
    }
  };

  orderedItems.forEach((item, idx) => {
    const isEssayNumbered =
      numberingMode === 'exam_standard' && item.isConstructedResponse;
    const stemText = cleanStemText(item.questionPrompt);
    const pts = roundPoints(Number(item.totalMarks) || (item.isConstructedResponse ? 3 : 2));
    const hasPartialCredit =
      item.isConstructedResponse &&
      item.rubricRows.some((r) => {
        const m = parseFloat(r.scoreLabel);
        return !Number.isNaN(m) && m > 0 && m < pts;
      });

    const scoreSuffix = hasPartialCredit
      ? `[${pts}점, 부분 점수 있음]`
      : item.isConstructedResponse && numberingMode === 'sequential'
      ? `[${pts}점, 서답형]`
      : `[${pts}점]`;

    // 문항 발문 (스타일에 연결된 한글 자동 번호: '2024서부고 문제' -> 1. / '2024서부고 서술형문제' -> [서답형1])
    sec1El.appendChild(
      createHpPara(
        doc1,
        isEssayNumbered ? '41' : '45',
        isEssayNumbered ? '3' : '1',
        [{ charPrId: '32', text: `${stemText} ${scoreSuffix}` }]
      )
    );

    // 제시문 상자 / 포스터 / <보 기> 또는 서답형 소문항 안내
    const shouldRenderBox =
      Boolean(item.stimulusTitle.trim()) ||
      (Boolean(item.stimulusBody.trim()) &&
        (item.questionFormat === 'gap_poster' ||
          item.questionFormat === 'tf_justify' ||
          !item.isConstructedResponse));

    if (shouldRenderBox) {
      appendStimulusBox(item.stimulusTitle, item.stimulusBody);
    } else if (item.stimulusBody.trim()) {
      const subLines = item.stimulusBody
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (const sl of subLines) {
        sec1El.appendChild(
          createHpPara(doc1, '47', '10', [{ charPrId: '32', text: sl }])
        );
      }
    }

    // 선택지 또는 서답형 풀이 여백
    if (!item.isConstructedResponse) {
      appendMcqOptions(item.options);
    } else {
      // 서답형 문항 아래 답안 메모 여백 (자동번호가 증가하지 않도록 기본 바탕글 문단 사용)
      sec1El.appendChild(createHpPara(doc1, '2', '0', [{ charPrId: '32', text: '' }]));
    }

    // 복합 다문항(subQuestions)이 있는 경우 함께 출력
    if (Array.isArray(item.subQuestions) && item.subQuestions.length > 0) {
      item.subQuestions.forEach((sq) => appendSubQuestion(sq, false));
    }

    // 문항과 문항 사이 한 줄 이상 비우기 (양식 준수사항 5번)
    if (idx < orderedItems.length - 1) {
      sec1El.appendChild(createHpPara(doc1, '2', '0', [{ charPrId: '32', text: '' }]));
      if (item.isConstructedResponse) {
        sec1El.appendChild(createHpPara(doc1, '2', '0', [{ charPrId: '32', text: '' }]));
      }
    }
  });

  // 3) 마지막 쪽 오른쪽 하단 저작권 보호 안내 상자 (tbl id="1830985148" 원형 복제 및 우하단 배치)
  if (copyrightTblProto) {
    const copyClone = copyrightTblProto.cloneNode(true) as Element;
    copyClone.setAttribute('id', makeParaId());
    copyClone.setAttribute('textWrap', 'SQUARE');

    const posEl = domChildElements(copyClone, 'pos')[0];
    if (posEl) {
      posEl.setAttribute('treatAsChar', '0');
      posEl.setAttribute('affectLSpacing', '0');
      posEl.setAttribute('flowWithText', '1');
      posEl.setAttribute('allowOverlap', '0');
      posEl.setAttribute('holdAnchorAndSO', '0');
      posEl.setAttribute('vertRelTo', 'PAGE');
      posEl.setAttribute('horzRelTo', 'PAGE');
      posEl.setAttribute('vertAlign', 'BOTTOM');
      posEl.setAttribute('horzAlign', 'RIGHT');
      posEl.setAttribute('vertOffset', '284');
      posEl.setAttribute('horzOffset', '424');
    }

    const copySubList = domFindAll(copyClone, 'subList')[0];
    if (copySubList) {
      domClearChildren(copySubList);
      copySubList.appendChild(
        createHpPara(doc1, '22', '0', [
          {
            charPrId: '6',
            text: `이 평가 문항의 저작권은 ${schoolName}에 있습니다. `,
          },
          {
            charPrId: '3',
            text: '저작권법에 의해 보호받는 저작물이므로 전재와 복제는 금지되며, 이를 어길 시 저작권법에 의거 처벌받을 수 있습니다.',
          },
        ])
      );
    }

    domStripLineSegArrays(copyClone);
    sec1El.appendChild(
      createHpPara(doc1, '2', '0', [
        { charPrId: '56', nodes: [copyClone] },
        { charPrId: '29', text: '' },
      ])
    );
  }

  domStripLineSegArrays(sec1El);

  // -------------------------------------------------------------------------
  // D. 표지 포함 여부에 따른 구역 매니페스트(header.xml, content.hpf) 정리 및 OCF 패키징
  // -------------------------------------------------------------------------
  const hpfEl = pkg.getXml('Contents/content.hpf');
  const titleNode = domFindAll(hpfEl, 'title')[0];
  if (titleNode) {
    domClearChildren(titleNode);
    titleNode.appendChild(
      hpfEl.ownerDocument!.createTextNode(params.assessmentTitle || coverTitle)
    );
  }

  if (includeCoverPage) {
    pkg.setXml('Contents/section1.xml', sec1El);
    pkg.setXml('Contents/content.hpf', hpfEl);
  } else {
    // 표지 생략 시 본문을 section0.xml로 단일 구역화하여 모든 버전의 한글에서 깔끔하게 열리도록 처리
    pkg.setXml('Contents/section0.xml', sec1El);

    const headerEl = pkg.getXml('Contents/header.xml');
    headerEl.setAttribute('secCnt', '1');
    pkg.setXml('Contents/header.xml', headerEl);

    for (const itemEl of domFindAll(hpfEl, 'item')) {
      if (itemEl.getAttribute('id') === 'section1' && itemEl.parentNode) {
        itemEl.parentNode.removeChild(itemEl);
      }
    }
    for (const refEl of domFindAll(hpfEl, 'itemref')) {
      if (refEl.getAttribute('idref') === 'section1' && refEl.parentNode) {
        refEl.parentNode.removeChild(refEl);
      } else if (refEl.getAttribute('idref') === 'section0') {
        refEl.setAttribute('linear', 'yes');
      }
    }
    pkg.setXml('Contents/content.hpf', hpfEl);
  }

  // 미리보기 텍스트 갱신
  const previewLines: string[] = [];
  if (includeCoverPage) {
    previewLines.push(coverTitle);
    previewLines.push(`(${gradeNum})학년 (${subjectName}) - ${schoolName}`);
  }
  orderedItems.forEach((it, i) => {
    previewLines.push(`${i + 1}. ${cleanStemText(it.questionPrompt)}`);
  });
  pkg.setPart('Preview/PrvText.txt', previewLines.join('\r\n'));

  // 한컴 OCF 규격 준수: mimetype 엔트리를 압축 없이(STORE) 맨 앞에 기록하고 불필요한 이전 썸네일 제외
  const outZip = new JSZip();
  outZip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });

  for (const partName of pkg.partNames()) {
    if (partName === 'mimetype') continue;
    if (partName === 'Preview/PrvImage.png') continue;
    if (!includeCoverPage && partName === 'Contents/section1.xml') continue;
    outZip.file(partName, pkg.getPart(partName), { compression: 'DEFLATE' });
  }

  return outZip.generateAsync({ type: 'uint8array' });
}

/**
 * 하위 호환 별칭: 학생 배부·시험 진행용 문제지 (.hwpx) -> 업로드된 정기고사 [원안_양식]으로 출력
 */
export async function buildStudentExamHwpx(
  items: ListeningItem[],
  params: GenerationParams,
  options?: OfficialExamOptions
): Promise<Uint8Array> {
  return buildOfficialExamHwpx(items, params, options);
}

/**
 * 3. 정답 · 대본 · 채점기준 별지 (.hwpx)
 * 시험 종료 후 학생 배부용 대본/해설지 및 교사 채점 위원용 요약표
 */
export async function buildAnswerKeyHwpx(
  items: ListeningItem[],
  params: GenerationParams
): Promise<Uint8Array> {
  const doc = await openBlankHwpx();
  const sec = doc.section(0);
  const st = createStylePalette(doc);

  doc.addParagraph(`${params.assessmentTitle || '영어듣기 평가'} — 정답 · 대본 · 채점기준표`, {
    charPrIdRef: st.charTitle,
    paraPrIdRef: st.paraCenter,
  });
  doc.addParagraph('', { charPrIdRef: st.charBodySmall, paraPrIdRef: st.paraLeft });

  // 빠른 정답 요약표
  doc.addParagraph('1. 문항별 정답 및 배점 요약', {
    charPrIdRef: st.charSectionHeading,
    paraPrIdRef: st.paraLeft,
  });
  const sumPara = doc.addParagraph('', { paraPrIdRef: st.paraLeft });
  const sumTbl = sumPara.addTable(items.length + 1, 5, {
    width: BODY_WIDTH,
    borderFillIdRef: st.bfBasic,
  });
  const sw = [4200, 7400, 9600, BODY_WIDTH - 4200 - 7400 - 9600 - 4400, 4400];
  configureTableDefaults(sumTbl, BODY_WIDTH, sw);

  ['번호', '문항 형식', '수행지시어·기능', '정답 / 모범답안 요약', '배점'].forEach((h, c) => {
    setCellSimpleText(sumTbl.cell(0, c), sec, h, {
      charPrId: st.charTableHeader,
      paraPrId: st.paraCenter,
      borderFillId: st.bfHeaderSlate,
    });
  });

  items.forEach((it, idx) => {
    const r = idx + 1;
    setCellSimpleText(sumTbl.cell(r, 0), sec, String(it.itemNo), {
      charPrId: st.charBodyBold,
      paraPrId: st.paraCenter,
      borderFillId: st.bfBasic,
    });
    setCellSimpleText(
      sumTbl.cell(r, 1),
      sec,
      it.isConstructedResponse ? '서답형' : '5지선다 선택형',
      { charPrId: st.charBody, paraPrId: st.paraCenter, borderFillId: st.bfBasic }
    );
    setCellSimpleText(sumTbl.cell(r, 2), sec, `[${it.directive}] ${it.skill}`, {
      charPrId: st.charBodySmall,
      paraPrId: st.paraCenter,
      borderFillId: st.bfBasic,
    });
    setCellSimpleText(
      sumTbl.cell(r, 3),
      sec,
      it.isConstructedResponse
        ? it.modelAnswer || '-'
        : `${CIRCLED_NUMS[it.correctChoice - 1] || ''} (${it.correctChoice}번)`,
      {
        charPrId: st.charBodyBold,
        paraPrId: it.isConstructedResponse ? st.paraLeft : st.paraCenter,
        borderFillId: st.bfBasic,
      }
    );
    setCellSimpleText(sumTbl.cell(r, 4), sec, `${it.totalMarks}점`, {
      charPrId: st.charBody,
      paraPrId: st.paraCenter,
      borderFillId: st.bfBasic,
    });
  });

  doc.addParagraph('', { charPrIdRef: st.charBodySmall, paraPrIdRef: st.paraLeft });
  doc.addParagraph('2. 문항별 듣기 대본 · 해석 · 세부 채점기준', {
    charPrIdRef: st.charSectionHeading,
    paraPrIdRef: st.paraLeft,
  });

  items.forEach((it) => {
    doc.addParagraph('', { charPrIdRef: st.charBodySmall, paraPrIdRef: st.paraLeft });
    const p = doc.addParagraph('', { paraPrIdRef: st.paraLeft });
    const t = p.addTable(3, 1, { width: BODY_WIDTH, borderFillIdRef: st.bfBasic });
    configureTableDefaults(t, BODY_WIDTH, [BODY_WIDTH]);

    setCellSimpleText(
      t.cell(0, 0),
      sec,
      `문항 ${it.itemNo}  |  ${it.achievementStandard}  |  어휘 ${countTranscriptWords(it.transcript)}단어`,
      {
        charPrId: st.charTableHeader,
        paraPrId: st.paraLeft,
        borderFillId: st.bfHeaderSlate,
      }
    );

    const scriptAndTrans = [
      it.transcript.trim(),
      it.koreanTranslation.trim() ? `\n[우리말 해석]\n${it.koreanTranslation.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    setCellSimpleText(t.cell(1, 0), sec, scriptAndTrans, {
      charPrId: st.charBody,
      paraPrId: st.paraJustify,
      borderFillId: st.bfBasic,
    });

    const ansLines: string[] = [];
    if (it.isConstructedResponse) {
      ansLines.push(`[모범답안]\n${it.modelAnswer}`);
      if (it.rubricRows.length) {
        ansLines.push('\n[세부 채점 기준]');
        it.rubricRows.forEach((rr) => {
          ansLines.push(`  - ${rr.scoreLabel}: ${rr.criteria}`);
        });
      }
    } else {
      ansLines.push(`[정답] ${it.correctChoice}번 (${CIRCLED_NUMS[it.correctChoice - 1] || ''})`);
    }
    if (it.explanation.trim()) {
      ansLines.push(`\n[해설] ${it.explanation.trim()}`);
    }

    setCellSimpleText(t.cell(2, 0), sec, ansLines.join('\n'), {
      charPrId: st.charBodySmall,
      paraPrId: st.paraJustify,
      borderFillId: st.bfPosterBox,
    });
  });

  return doc.save();
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60) || '대구형_영어듣기_출제문항'
  );
}

/**
 * 4. 전체 패키지 ZIP 다운로드 ([원안_양식] 문제지.hwpx + 교사용 문항명세서.hwpx + 대본·정답·채점기준표.hwpx + 문항별 MP3 + 합본 MP3 + 프로젝트 JSON)
 */
export async function buildFullPackageZip(
  items: ListeningItem[],
  params: GenerationParams,
  combinedMp3Blob?: Blob | null,
  officialOptions?: OfficialExamOptions,
  specOptions?: { includeTranslation?: boolean; includeExplanation?: boolean }
): Promise<Blob> {
  const zip = new JSZip();
  const baseName = sanitizeFilename(params.assessmentTitle);

  const [officialExamHwpx, masterHwpx, answerHwpx] = await Promise.all([
    buildOfficialExamHwpx(items, params, officialOptions),
    buildMasterSpecHwpx(items, params, specOptions),
    buildAnswerKeyHwpx(items, params),
  ]);

  zip.file(`01_[원안_양식]_${baseName}_문제지.hwpx`, officialExamHwpx);
  zip.file(`02_${baseName}_교사용_문항명세_채점기준서.hwpx`, masterHwpx);
  zip.file(`03_${baseName}_대본_정답_채점기준표.hwpx`, answerHwpx);

  const audioFolder = zip.folder('mp3_음원');
  if (audioFolder) {
    items.forEach((it) => {
      if (it.audioBlob) {
        const num = String(it.itemNo).padStart(2, '0');
        const ext = it.audioExt || '.mp3';
        audioFolder.file(`${num}번_문항_${sanitizeFilename(it.skill)}${ext}`, it.audioBlob);
      }
    });
    if (combinedMp3Blob) {
      audioFolder.file(`00_${baseName}_전체합본.mp3`, combinedMp3Blob);
    }
  }

  // 오디오 Blob 제외한 순수 JSON 백업 포함 (추후 재편집용)
  const serializableItems = items.map(({ audioBlob: _b, audioUrl: _u, ...rest }) => rest);
  zip.file(
    `project_${baseName}.json`,
    JSON.stringify({ version: '1.0', params, items: serializableItems }, null, 2)
  );

  return zip.generateAsync({ type: 'blob' });
}

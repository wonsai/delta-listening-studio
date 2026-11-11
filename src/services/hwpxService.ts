import JSZip from 'jszip';
import {
  HwpxDocument,
  HwpxOxmlParagraph,
  HwpxOxmlSection,
  HwpxOxmlTable,
  HwpxOxmlTableCell,
} from '@ubermensch1218/hwpxcore';
import { getSkeletonHwpxBytes } from '../assets/skeletonHwpx';
import { GenerationParams, ListeningItem } from '../types/assessment';
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

/**
 * 2. 학생 배부용 시험지 / 활동지 (.hwpx)
 * 대본과 정답·해설을 모두 제외하고, 학교 시험지 헤더(학년/반/번/이름)와
 * 문항·안내문 상자·선택지·서답형 답안 작성란만 깔끔하게 구성합니다.
 */
export async function buildStudentExamHwpx(
  items: ListeningItem[],
  params: GenerationParams
): Promise<Uint8Array> {
  const doc = await openBlankHwpx();
  const sec = doc.section(0);
  const st = createStylePalette(doc);

  // 학생용 시험지 상단 헤더 표 (시험 제목 + 학번/성명 란)
  const hdrPara = doc.addParagraph('', { paraPrIdRef: st.paraCenter });
  const hdrTbl = hdrPara.addTable(2, 5, {
    width: BODY_WIDTH,
    borderFillIdRef: st.bfBasic,
  });
  const c0 = 24990;
  const cSmall = 5800;
  configureTableDefaults(hdrTbl, BODY_WIDTH, [c0, cSmall, cSmall, cSmall, cSmall]);
  hdrTbl.mergeCells(0, 0, 1, 0);

  const examTitle = `${params.schoolName ? params.schoolName + ' ' : ''}${params.grade} ${params.subject} 영어듣기 평가`;
  setCellRichContent(
    hdrTbl.cell(0, 0),
    sec,
    [
      {
        kind: 'text',
        text: params.assessmentTitle || examTitle,
        charPrId: st.charSectionHeading,
        paraPrId: st.paraCenter,
      },
      {
        kind: 'text',
        text: `과목: ${params.subject} (${params.grade})`,
        charPrId: st.charBodySmall,
        paraPrId: st.paraCenter,
      },
    ],
    { borderFillId: st.bfHeaderSlate }
  );

  ['학년', '반', '번호', '성명'].forEach((lbl, i) => {
    setCellSimpleText(hdrTbl.cell(0, i + 1), sec, lbl, {
      charPrId: st.charTableHeader,
      paraPrId: st.paraCenter,
      borderFillId: st.bfHeaderSlate,
    });
    setCellSimpleText(hdrTbl.cell(1, i + 1), sec, ' ', {
      charPrId: st.charBody,
      paraPrId: st.paraCenter,
      borderFillId: st.bfBasic,
      paddingV: 500,
    });
  });

  doc.addParagraph('', { charPrIdRef: st.charBodySmall, paraPrIdRef: st.paraLeft });
  doc.addParagraph(
    '※ 들려주는 음성을 주의 깊게 듣고 각 물음에 알맞은 답을 고르거나 서술하시오.',
    { charPrIdRef: st.charBodyBold, paraPrIdRef: st.paraLeft }
  );

  items.forEach((item) => {
    doc.addParagraph('', { charPrIdRef: st.charBodySmall, paraPrIdRef: st.paraLeft });
    doc.addParagraph(
      `${item.itemNo}. ${item.questionPrompt} [${item.totalMarks}점]`,
      { charPrIdRef: st.charSubTitle, paraPrIdRef: st.paraJustify }
    );

    // 포스터·안내문 상자
    if (item.stimulusTitle.trim() || (item.stimulusBody.trim() && item.questionFormat === 'gap_poster')) {
      const boxPara = doc.addParagraph('', { paraPrIdRef: st.paraCenter });
      const boxW = BODY_WIDTH - 1600;
      const boxTbl = boxPara.addTable(1, 1, {
        width: boxW,
        borderFillIdRef: st.bfPosterBox,
      });
      configureTableDefaults(boxTbl, boxW, [boxW]);
      const lines: CellLineBlock[] = [];
      if (item.stimulusTitle.trim()) {
        lines.push({
          kind: 'text',
          text: item.stimulusTitle.trim(),
          charPrId: st.charTableHeader,
          paraPrId: st.paraCenter,
        });
      }
      String(item.stimulusBody || '')
        .split(/\r?\n/)
        .forEach((l) => {
          lines.push({
            kind: 'text',
            text: l,
            charPrId: st.charBody,
            paraPrId: st.paraLeft,
          });
        });
      setCellRichContent(boxTbl.cell(0, 0), sec, lines, {
        borderFillId: st.bfPosterBox,
        paddingH: 800,
        paddingV: 480,
      });
    }

    if (item.isConstructedResponse) {
      const ansPara = doc.addParagraph('', { paraPrIdRef: st.paraLeft });
      const ansTbl = ansPara.addTable(1, 2, {
        width: BODY_WIDTH,
        borderFillIdRef: st.bfBasic,
      });
      configureTableDefaults(ansTbl, BODY_WIDTH, [6800, BODY_WIDTH - 6800]);
      setCellSimpleText(ansTbl.cell(0, 0), sec, '답안 작성', {
        charPrId: st.charTableHeader,
        paraPrId: st.paraCenter,
        borderFillId: st.bfHeaderSlate,
      });

      let answerSlotLines: string[] = [];
      if (item.questionFormat === 'gap_poster') {
        const blankMatches = item.stimulusBody.match(/\(\s*\d+\s*\)/g);
        const count = blankMatches ? blankMatches.length : 3;
        answerSlotLines = Array.from(
          { length: count },
          (_, k) => `(${k + 1}) ____________________________________________`
        );
      } else if (item.stimulusBody.trim()) {
        answerSlotLines = item.stimulusBody
          .split(/\r?\n/)
          .filter((l) => l.trim())
          .map((l) => `${l} ________________________________________`);
      } else {
        answerSlotLines = [
          '______________________________________________________________ (                        )',
          '______________________________________________________________',
        ];
      }

      setCellSimpleText(ansTbl.cell(0, 1), sec, answerSlotLines.join('\n\n'), {
        charPrId: st.charBody,
        paraPrId: st.paraLeft,
        borderFillId: st.bfBasic,
        paddingV: 560,
      });
    } else {
      item.options.slice(0, 5).forEach((opt, oIdx) => {
        if (opt.trim()) {
          doc.addParagraph(`   ${CIRCLED_NUMS[oIdx]} ${opt.trim()}`, {
            charPrIdRef: st.charBody,
            paraPrIdRef: st.paraLeft,
          });
        }
      });
    }
  });

  return doc.save();
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
 * 4. 전체 패키지 ZIP 다운로드 (출제원안지.hwpx + 학생용시험지.hwpx + 대본채점기준표.hwpx + 문항별 MP3 + 합본 MP3 + 프로젝트 JSON)
 */
export async function buildFullPackageZip(
  items: ListeningItem[],
  params: GenerationParams,
  combinedMp3Blob?: Blob | null
): Promise<Blob> {
  const zip = new JSZip();
  const baseName = sanitizeFilename(params.assessmentTitle);

  const [masterHwpx, studentHwpx, answerHwpx] = await Promise.all([
    buildMasterSpecHwpx(items, params),
    buildStudentExamHwpx(items, params),
    buildAnswerKeyHwpx(items, params),
  ]);

  zip.file(`01_${baseName}_교사용_출제원안지.hwpx`, masterHwpx);
  zip.file(`02_${baseName}_학생용_시험지_활동지.hwpx`, studentHwpx);
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

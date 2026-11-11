// 영어 대본 어휘 수 계산, 예상 재생 시간 산출, 화자별 대본 파싱 유틸리티
// 기존 DELTA 플랫폼(Js_Tts.html)의 parseScript 및 assignVoices 로직 완벽 호환 이식

export interface ScriptSegment {
  spk: string;   // 'M' | 'W' | 'N' | 'D' | 이름 화자
  text: string;  // 발화 텍스트
  pause: number; // 발화 뒤 쉼(초)
}

const SPK_MAP: Record<string, string> = {
  m: 'M',
  man: 'M',
  b: 'M',
  boy: 'M',
  '남': 'M',
  '남자': 'M',
  w: 'W',
  woman: 'W',
  g: 'W',
  girl: 'W',
  '여': 'W',
  '여자': 'W',
  n: 'N',
  narrator: 'N',
  '해설': 'N',
  '안내': 'N',
};

const NAME_RE = /^\s*([A-Za-z가-힣][A-Za-z가-힣 .]{0,20}?)\s*[:：]\s*(.*)$/;

/**
 * 대본 텍스트를 화자별 발화 단위로 분리합니다.
 * 줄 안의 "W: ... M: ..." 패턴 및 빈 줄(문단 쉼)까지 정교하게 처리합니다.
 */
export function parseScript(
  text: string,
  pauseLine = 0.75,
  pausePara = 1.6
): ScriptSegment[] {
  const segs: ScriptSegment[] = [];
  const lines: string[] = [];

  String(text || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const parts = line.split(/\s+(?=(?:[A-Z][A-Za-z]{0,15}|[가-힣]{1,4})\s*[:：]\s)/);
      parts.forEach((pt) => lines.push(pt));
    });

  lines.forEach((line) => {
    if (!line.trim()) {
      if (segs.length) segs[segs.length - 1].pause += pausePara;
      return;
    }
    const m = line.match(NAME_RE);
    const raw = m ? m[1].trim() : '';
    const spk = m ? SPK_MAP[raw.toLowerCase()] || raw : 'D';
    const t = (m ? m[2] : line).trim();
    if (t) segs.push({ spk, text: t, pause: pauseLine });
  });

  return segs;
}

/**
 * 화자 키(M, W, N, 이름 화자 등)에 음성을 배정합니다.
 */
export function assignVoices(
  segs: ScriptSegment[],
  voices: { M: string; W: string; N: string; D?: string }
): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  segs.forEach((g) => {
    if (out[g.spk]) return;
    if (g.spk === 'M') out[g.spk] = voices.M;
    else if (g.spk === 'W') out[g.spk] = voices.W;
    else if (g.spk === 'N') out[g.spk] = voices.N;
    else if (g.spk === 'D') out[g.spk] = voices.D || voices.W;
    else {
      out[g.spk] = [voices.W, voices.M][n++ % 2] || voices.W;
    }
  });
  return out;
}

/**
 * 화자 기호(W:, M:, N: 등)를 제외한 실제 영어/발화 단어 수를 실시간 계산합니다.
 */
export function countTranscriptWords(transcript: string): number {
  if (!transcript || !transcript.trim()) return 0;
  const segs = parseScript(transcript, 0, 0);
  const body = segs.length > 0 ? segs.map((s) => s.text).join(' ') : transcript;
  // 영어/숫자 어절 카운트 (I'd, don't 등은 1단어로 처리)
  const matches = body.match(/[A-Za-z0-9]+(?:['’`-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

/**
 * 영어 단어 수와 발화 턴 수를 기반으로 예상 재생 시간(초)을 계산합니다.
 * 기본 중등 영어듣기 발화 속도: 약 135~145 WPM (speed=1.0 기준)
 */
export function estimateDurationSec(transcript: string, speed = 1.0): number {
  const words = countTranscriptWords(transcript);
  if (words === 0) return 0;
  const segs = parseScript(transcript, 0.75, 1.5);
  const wpm = 140 * Math.max(0.6, Math.min(1.5, speed));
  const speechSec = (words / wpm) * 60;
  const pauseSec = segs.reduce((acc, s) => acc + s.pause, 0);
  return Math.round(speechSec + pauseSec);
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0초';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `약 ${m}분 ${s}초` : `약 ${s}초`;
}

/**
 * 대본 내 등장하는 고유 화자 목록 반환
 */
export function detectSpeakers(transcript: string): string[] {
  const segs = parseScript(transcript, 0, 0);
  return Array.from(new Set(segs.map((s) => s.spk)));
}

import { Mp3Encoder } from '@breezystack/lamejs';
import { ListeningItem, TtsConfig } from '../types/assessment';
import { assignVoices, parseScript, ScriptSegment } from './wordUtils';

export const GEMINI_VOICES: { id: string; label: string; gender: 'F' | 'M' }[] = [
  { id: 'Kore', label: 'Kore · 미국 여성 (명료·아나운서 톤)', gender: 'F' },
  { id: 'Aoede', label: 'Aoede · 미국 여성 (자연스러운 대화 톤)', gender: 'F' },
  { id: 'Zephyr', label: 'Zephyr · 미국 여성 (밝고 친근한 톤)', gender: 'F' },
  { id: 'Leda', label: 'Leda · 여성 (부드럽고 차분한 톤)', gender: 'F' },
  { id: 'Puck', label: 'Puck · 미국 남성 (표준 회화·학생 톤)', gender: 'M' },
  { id: 'Charon', label: 'Charon · 미국 남성 (차분·신뢰감 있는 톤)', gender: 'M' },
  { id: 'Fenrir', label: 'Fenrir · 남성 (깊고 또렷한 강연 톤)', gender: 'M' },
  { id: 'Orus', label: 'Orus · 남성 (단정한 안내 방송 톤)', gender: 'M' },
];

export const KOKORO_VOICES: { id: string; label: string; gender: 'F' | 'M' }[] = [
  { id: 'af_heart', label: 'Heart · 미국 여성 (원어민 표준)', gender: 'F' },
  { id: 'af_bella', label: 'Bella · 미국 여성 (또렷한 발음)', gender: 'F' },
  { id: 'af_sarah', label: 'Sarah · 미국 여성 (안내·담화 추천)', gender: 'F' },
  { id: 'bf_emma', label: 'Emma · 영국 여성 (영국식 억양)', gender: 'F' },
  { id: 'am_michael', label: 'Michael · 미국 남성 (원어민 표준)', gender: 'M' },
  { id: 'am_adam', label: 'Adam · 미국 남성 (차분한 톤)', gender: 'M' },
  { id: 'am_fenrir', label: 'Fenrir · 미국 남성 (깊은 톤)', gender: 'M' },
  { id: 'bm_george', label: 'George · 영국 남성 (영국식 억양)', gender: 'M' },
];

// Kokoro 브라우저 캐시 인스턴스
let cachedKokoro: {
  generate: (
    text: string,
    opts: { voice: string; speed: number }
  ) => Promise<{ audio: Float32Array; sampling_rate?: number }>;
} | null = null;

async function loadKokoroEngine(onProgress?: (msg: string) => void) {
  if (cachedKokoro) return cachedKokoro;
  onProgress?.('브라우저 원어민 신경망 TTS 모듈을 불러오는 중...');

  let mod: {
    KokoroTTS: {
      from_pretrained: (
        repo: string,
        opts: {
          dtype: string;
          device: string;
          progress_callback?: (p: { progress?: number }) => void;
        }
      ) => Promise<typeof cachedKokoro>;
    };
  };
  try {
    // @ts-expect-error Dynamic CDN ESM import in browser
    mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
  } catch {
    throw new Error(
      '브라우저 무료 TTS 모듈을 내려받지 못했습니다. 인터넷 연결을 확인하거나 Gemini TTS 엔진을 선택해 주세요.'
    );
  }

  let lastPct = -1;
  cachedKokoro = await mod.KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p) => {
      if (p && typeof p.progress === 'number') {
        const pct = Math.round(p.progress);
        if (pct !== lastPct) {
          lastPct = pct;
          onProgress?.(`원어민 음성 모델 다운로드 중... ${pct}% (최초 1회)`);
        }
      }
    },
  });

  return cachedKokoro!;
}

/**
 * 영어듣기 평가용 맑은 3화음 차임벨("딩-동-댕") PCM 생성 (sampleRate 기준)
 */
function createExamChimePcm(sampleRate: number): Float32Array {
  const notes = [
    { freq: 523.25, start: 0.0, dur: 0.42 }, // C5
    { freq: 659.25, start: 0.28, dur: 0.42 }, // E5
    { freq: 783.99, start: 0.56, dur: 0.65 }, // G5
  ];
  const totalSec = 1.55; // 벨 울림 + 짧은 여백
  const len = Math.floor(sampleRate * totalSec);
  const out = new Float32Array(len);

  for (const n of notes) {
    const startIdx = Math.floor(n.start * sampleRate);
    const durSamples = Math.floor(n.dur * sampleRate);
    for (let i = 0; i < durSamples && startIdx + i < len; i++) {
      const t = i / sampleRate;
      const attack = Math.min(1, i / (0.012 * sampleRate));
      const decay = Math.exp(-4.2 * (t / n.dur));
      const sample =
        (Math.sin(2 * Math.PI * n.freq * t) * 0.75 +
          Math.sin(2 * Math.PI * (n.freq * 2) * t) * 0.2) *
        attack *
        decay *
        0.24;
      out[startIdx + i] += sample;
    }
  }
  return out;
}

/**
 * Base64 인코딩된 16-bit Little-Endian PCM(24kHz)을 Float32Array로 변환
 */
function base64Pcm16ToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const byteLen = binary.length;
  const bytes = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const sampleCount = Math.floor(byteLen / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(i * 2, true);
    float32[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
  }
  return float32;
}

/**
 * DELTA 원본 검증 로직: 24kHz PCM을 48kHz로 고품질 리샘플링 (MPEG-1 MP3 안정 인코딩용)
 * playbackSpeed가 1.0이 아닌 경우 발화 속도 배율도 함께 반영
 */
async function resamplePcmTo48k(
  pcm: Float32Array,
  sourceRate: number,
  speedMultiplier = 1.0
): Promise<Float32Array> {
  const targetRate = 48000;
  const effectiveSpeed = Math.max(0.65, Math.min(1.45, speedMultiplier));
  if (sourceRate === targetRate && Math.abs(effectiveSpeed - 1.0) < 0.01) {
    return pcm;
  }
  try {
    const outLength = Math.max(1, Math.ceil((pcm.length * targetRate) / (sourceRate * effectiveSpeed)));
    const offline = new OfflineAudioContext(1, outLength, targetRate);
    const buffer = offline.createBuffer(1, pcm.length, sourceRate);
    buffer.copyToChannel(new Float32Array(pcm), 0);
    const src = offline.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = effectiveSpeed;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    return new Float32Array(rendered.getChannelData(0));
  } catch {
    // OfflineAudioContext 미지원 환경 선형 보간 백업
    const ratio = (sourceRate * effectiveSpeed) / targetRate;
    const outLen = Math.max(1, Math.floor(pcm.length / ratio));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = pcm[idx] ?? 0;
      const b = pcm[Math.min(pcm.length - 1, idx + 1)] ?? a;
      out[i] = a + (b - a) * frac;
    }
    return out;
  }
}

/**
 * 48kHz Mono Float32Array → 64kbps MP3 Blob (@breezystack/lamejs)
 */
function encodeMp3From48k(pcm48k: Float32Array, kbps = 64): Blob {
  const encoder = new Mp3Encoder(1, 48000, kbps);
  const samples = new Int16Array(pcm48k.length);
  for (let i = 0; i < pcm48k.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm48k[i]));
    samples[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
  }

  const blockSize = 1152;
  const mp3Chunks: BlobPart[] = [];
  for (let i = 0; i < samples.length; i += blockSize) {
    const sub = samples.subarray(i, i + blockSize);
    const buf = encoder.encodeBuffer(sub);
    if (buf.length > 0) mp3Chunks.push(new Uint8Array(buf) as unknown as BlobPart);
  }
  const endBuf = encoder.flush();
  if (endBuf.length > 0) mp3Chunks.push(new Uint8Array(endBuf) as unknown as BlobPart);

  return new Blob(mp3Chunks, { type: 'audio/mpeg' });
}

function encodeWavFallback(pcm: Float32Array, sampleRate = 48000): Blob {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

const GEMINI_TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
];

async function callGeminiSingleOrDualTts(
  apiKey: string,
  promptText: string,
  speakers: { alias: string; voiceName: string }[]
): Promise<Float32Array> {
  const speechConfig =
    speakers.length <= 1
      ? {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: speakers[0]?.voiceName || 'Kore',
            },
          },
        }
      : {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: speakers.slice(0, 2).map((s) => ({
              speaker: s.alias,
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: s.voiceName,
                },
              },
            })),
          },
        };

  let lastErr = '';
  for (const model of GEMINI_TTS_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig,
        },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const b64 = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) {
        throw new Error('Gemini TTS 응답에서 오디오 데이터를 찾지 못했습니다.');
      }
      return base64Pcm16ToFloat32(b64);
    }

    const errJson = await res.json().catch(() => ({}));
    lastErr = errJson?.error?.message || `HTTP ${res.status}`;
    if (res.status === 400 && /API key/i.test(lastErr)) {
      throw new Error('유효하지 않은 Gemini API 키입니다.');
    }
  }

  throw new Error(`Gemini 원어민 TTS 호출 실패: ${lastErr}`);
}

/**
 * 단일 문항의 대본을 원어민 음성 MP3 Blob으로 합성합니다.
 */
export async function synthesizeItemMp3(
  item: ListeningItem,
  config: TtsConfig,
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<{ blob: Blob; ext: '.mp3' | '.wav'; engineLabel: string }> {
  const segs: ScriptSegment[] = parseScript(
    item.transcript,
    config.pauseLine,
    config.pausePara
  );

  if (segs.length === 0) {
    throw new Error(`${item.itemNo}번 문항의 듣기 대본이 비어 있습니다.`);
  }

  const chunks24k: Float32Array[] = [];
  const sr = 24000;

  if (config.includeChime) {
    chunks24k.push(createExamChimePcm(sr));
  }

  if (config.engine === 'gemini') {
    if (!apiKey.trim()) {
      throw new Error(
        'Gemini 원어민 TTS를 사용하려면 상단 [API 키 설정]에서 Gemini API 키를 입력하거나, API 키 없이 작동하는 [브라우저 무료 신경망 TTS]를 선택해 주세요.'
      );
    }

    // 한국어 문항 번호 안내 멘트 옵션 (Gemini TTS는 한국어·영어 모두 자연스럽게 지원)
    if (config.includeKoreanIntro) {
      onProgress?.(`${item.itemNo}번 문항 안내 멘트 생성 중...`);
      const introPrompt = `차분하고 명확한 한국어 듣기평가 안내 아나운서 톤으로 읽어 주세요:\n${item.itemNo}번. ${item.questionPrompt}`;
      const introPcm = await callGeminiSingleOrDualTts(apiKey, introPrompt, [
        { alias: 'Narrator', voiceName: config.geminiVoices.N || 'Kore' },
      ]);
      chunks24k.push(introPcm);
      chunks24k.push(new Float32Array(Math.round(sr * 1.4)));
    }

    const voiceMap = assignVoices(segs, config.geminiVoices);
    const uniqueSpeakers = Array.from(new Set(segs.map((s) => s.spk)));

    if (uniqueSpeakers.length === 1) {
      onProgress?.(`${item.itemNo}번 문항 원어민 담화 음성 생성 중 (Gemini TTS)...`);
      const spk = uniqueSpeakers[0];
      const fullScript = segs.map((s) => s.text).join(' ');
      const prompt = `Read the following English listening assessment script clearly, naturally, and at a steady educational pace for Korean secondary school students:\n\n${fullScript}`;
      const pcm = await callGeminiSingleOrDualTts(apiKey, prompt, [
        { alias: 'SpeakerA', voiceName: voiceMap[spk] || 'Kore' },
      ]);
      chunks24k.push(pcm);
    } else if (uniqueSpeakers.length === 2) {
      onProgress?.(`${item.itemNo}번 문항 원어민 2인 대화 음성 생성 중 (Gemini Multi-Speaker)...`);
      const [spk1, spk2] = uniqueSpeakers;
      const aliasMap: Record<string, string> = {
        [spk1]: 'SpeakerOne',
        [spk2]: 'SpeakerTwo',
      };
      const dialogueLines = segs
        .map((s) => `${aliasMap[s.spk]}: ${s.text}`)
        .join('\n');
      const prompt = `Read the following English listening assessment conversation naturally and clearly with realistic turn-taking at an educational pace:\n\n${dialogueLines}`;
      const pcm = await callGeminiSingleOrDualTts(apiKey, prompt, [
        { alias: 'SpeakerOne', voiceName: voiceMap[spk1] || 'Puck' },
        { alias: 'SpeakerTwo', voiceName: voiceMap[spk2] || 'Kore' },
      ]);
      chunks24k.push(pcm);
    } else {
      // 화자가 3명 이상일 경우 발화별 생성 후 자연스러운 쉼으로 연결
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        onProgress?.(`${item.itemNo}번 문항 발화 생성 중 (${i + 1}/${segs.length})...`);
        const pcm = await callGeminiSingleOrDualTts(apiKey, s.text, [
          { alias: 'Speaker', voiceName: voiceMap[s.spk] || 'Kore' },
        ]);
        chunks24k.push(pcm);
        if (s.pause > 0) {
          chunks24k.push(new Float32Array(Math.round(sr * s.pause)));
        }
      }
    }

    chunks24k.push(new Float32Array(Math.round(sr * 0.6)));
    const totalLen = chunks24k.reduce((acc, c) => acc + c.length, 0);
    const merged24k = new Float32Array(totalLen);
    let offset = 0;
    for (const c of chunks24k) {
      merged24k.set(c, offset);
      offset += c.length;
    }

    onProgress?.('48kHz 마스터링 및 MP3 인코딩 중...');
    const pcm48k = await resamplePcmTo48k(merged24k, sr, config.speed);
    try {
      const mp3 = encodeMp3From48k(pcm48k, 64);
      return { blob: mp3, ext: '.mp3', engineLabel: 'Gemini 원어민 TTS' };
    } catch {
      const wav = encodeWavFallback(pcm48k, 48000);
      return { blob: wav, ext: '.wav', engineLabel: 'Gemini 원어민 TTS (WAV)' };
    }
  } else {
    // 브라우저 무료 신경망 TTS (Kokoro-82M ONNX)
    const tts = await loadKokoroEngine(onProgress);
    const voiceMap = assignVoices(segs, config.browserVoices);
    let modelSr = 24000;

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      // Kokoro는 영어 전용이므로 한글만 있는 N: 줄은 건너뜀
      if (!/[A-Za-z]/.test(s.text)) continue;
      onProgress?.(`${item.itemNo}번 문항 원어민 음성 합성 중 (${i + 1}/${segs.length})...`);
      const out = await tts.generate(s.text, {
        voice: voiceMap[s.spk] || 'af_heart',
        speed: config.speed,
      });
      modelSr = out.sampling_rate || modelSr;
      const audioArr =
        out.audio instanceof Float32Array ? out.audio : Float32Array.from(out.audio);
      chunks24k.push(audioArr);
      if (s.pause > 0) {
        chunks24k.push(new Float32Array(Math.round(modelSr * s.pause)));
      }
    }

    const totalLen = chunks24k.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const c of chunks24k) {
      merged.set(c, offset);
      offset += c.length;
    }

    onProgress?.('48kHz 변환 및 MP3 인코딩 중...');
    const pcm48k = await resamplePcmTo48k(merged, modelSr, 1.0);
    try {
      const mp3 = encodeMp3From48k(pcm48k, 64);
      return { blob: mp3, ext: '.mp3', engineLabel: '브라우저 원어민 신경망 TTS' };
    } catch {
      const wav = encodeWavFallback(pcm48k, 48000);
      return { blob: wav, ext: '.wav', engineLabel: '브라우저 원어민 신경망 TTS (WAV)' };
    }
  }
}

/**
 * 이미 생성된 각 문항의 오디오 Blob들을 문항 간 풀이 대기 시간(무음)과 함께 하나의 합본 MP3로 병합합니다.
 */
export async function buildCombinedExamMp3(
  items: ListeningItem[],
  gapSeconds = 8,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  const readyItems = items.filter((it) => it.audioBlob);
  if (readyItems.length === 0) {
    throw new Error('먼저 문항별 음원을 1개 이상 생성해 주세요.');
  }

  const audioCtx = new AudioContext({ sampleRate: 48000 });
  const segments48k: Float32Array[] = [];

  try {
    for (let i = 0; i < readyItems.length; i++) {
      const it = readyItems[i];
      onProgress?.(`${it.itemNo}번 음원 디코딩 및 병합 준비 중 (${i + 1}/${readyItems.length})...`);
      const arrBuf = await it.audioBlob!.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrBuf.slice(0));
      // 모노 믹스다운
      const ch0 = decoded.getChannelData(0);
      let mono: Float32Array;
      if (decoded.numberOfChannels > 1) {
        const ch1 = decoded.getChannelData(1);
        mono = new Float32Array(decoded.length);
        for (let k = 0; k < decoded.length; k++) {
          mono[k] = (ch0[k] + ch1[k]) * 0.5;
        }
      } else {
        mono = new Float32Array(ch0);
      }

      const pcm48 =
        decoded.sampleRate === 48000
          ? mono
          : await resamplePcmTo48k(mono, decoded.sampleRate, 1.0);

      segments48k.push(pcm48);

      if (i < readyItems.length - 1 && gapSeconds > 0) {
        segments48k.push(new Float32Array(Math.round(48000 * gapSeconds)));
      }
    }
  } finally {
    await audioCtx.close().catch(() => {});
  }

  onProgress?.('전체 합본 MP3 파일 인코딩 중...');
  const totalLen = segments48k.reduce((acc, s) => acc + s.length, 0);
  const fullPcm = new Float32Array(totalLen);
  let off = 0;
  for (const s of segments48k) {
    fullPcm.set(s, off);
    off += s.length;
  }

  return encodeMp3From48k(fullPcm, 64);
}

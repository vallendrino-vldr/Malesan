/**
 * Procedural Royalty-Free Background Music (BGM) Generator
 *
 * Generates lightweight, copyright-safe, pleasant background soundbeds
 * directly in the browser via OfflineAudioContext and Web Audio synthesis.
 * Zero external network calls, zero copyright strikes, and instant on-device rendering.
 */

export type BgmPreset = {
  id: string;
  label: string;
  desc: string;
  mood: string;
};

export const BGM_PRESETS: readonly BgmPreset[] = [
  {
    id: "none",
    label: "Tanpa Musik",
    desc: "Suara asli video saja tanpa instrumen latar",
    mood: "Natural",
  },
  {
    id: "lofi",
    label: "Lofi Santai & Chill",
    desc: "Akord piano elektrik hangat untuk obrolan santai",
    mood: "Relaxing",
  },
  {
    id: "inspiratif",
    label: "Inspiratif & Cerita",
    desc: "Melodi akustik lembut untuk konten motivasi & edukasi",
    mood: "Uplifting",
  },
  {
    id: "upbeat",
    label: "Upbeat TikTok / Reels",
    desc: "Ritme ceria & energetik untuk konten tips cepat",
    mood: "Energetic",
  },
  {
    id: "suspense",
    label: "Misteri & Penasaran",
    desc: "Drone sinematik tegang untuk hook podcast & storytelling",
    mood: "Dramatic",
  },
  {
    id: "custom",
    label: "Upload Musik Sendiri",
    desc: "Gunakan file MP3/WAV milik Anda",
    mood: "Custom",
  },
];

/**
 * Generate a procedural royalty-free WAV Blob for the given BGM preset.
 */
export async function createProceduralBgmBlob(
  presetId: string,
  durationSeconds: number = 30,
): Promise<Blob | null> {
  if (presetId === "none" || presetId === "custom") return null;

  const OfflineCtx =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  if (!OfflineCtx) return null;

  const sampleRate = 44100;
  const dur = Math.max(5, Math.min(300, durationSeconds));
  const totalSamples = Math.floor(sampleRate * dur);

  const ctx = new OfflineCtx(2, totalSamples, sampleRate);

  // Master gentle compressor & limiter so BGM never peaks or distorts
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, 0);
  compressor.knee.setValueAtTime(12, 0);
  compressor.ratio.setValueAtTime(4, 0);
  compressor.attack.setValueAtTime(0.05, 0);
  compressor.release.setValueAtTime(0.25, 0);
  compressor.connect(ctx.destination);

  // Master Lowpass to keep BGM comfortably tucked underneath human speech (200Hz - 3.5kHz)
  const masterFilter = ctx.createBiquadFilter();
  masterFilter.type = "lowpass";
  masterFilter.frequency.setValueAtTime(2400, 0);
  masterFilter.connect(compressor);

  if (presetId === "lofi") {
    // Warm Lofi Chord Progression: Cmaj7 - Am7 - Dm7 - G7
    const chords = [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0],  // Am7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [196.0, 246.94, 293.66, 349.23], // G7
    ];
    const chordDur = 4.0;
    let t = 0;
    while (t < dur) {
      const chordIndex = Math.floor((t / chordDur) % chords.length);
      const notes = chords[chordIndex];
      for (const freq of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);
        // Soft vibrato
        osc.frequency.setValueCurveAtTime(
          new Float32Array([freq, freq * 1.003, freq * 0.997, freq]),
          t,
          chordDur,
        );

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.06, t + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.04, t + chordDur - 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + chordDur);

        osc.connect(gain);
        gain.connect(masterFilter);
        osc.start(t);
        osc.stop(t + chordDur);
      }
      t += chordDur;
    }
  } else if (presetId === "inspiratif") {
    // Uplifting Piano Arpeggio
    const scale = [220.0, 277.18, 329.63, 440.0, 554.37, 659.25];
    const stepDur = 0.5;
    let t = 0;
    let noteIdx = 0;
    while (t < dur) {
      const freq = scale[noteIdx % scale.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 1.6);

      osc.connect(gain);
      gain.connect(masterFilter);
      osc.start(t);
      osc.stop(t + stepDur * 2);

      noteIdx = (noteIdx + 1) % scale.length;
      t += stepDur;
    }
  } else if (presetId === "upbeat") {
    // Upbeat 120bpm Groovy Chord Pulse
    const beatDur = 0.5;
    const roots = [261.63, 329.63, 392.0, 349.23];
    let t = 0;
    let beat = 0;
    while (t < dur) {
      const root = roots[Math.floor((beat / 4) % roots.length)];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(root, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      osc.connect(gain);
      gain.connect(masterFilter);
      osc.start(t);
      osc.stop(t + 0.4);

      beat++;
      t += beatDur;
    }
  } else if (presetId === "suspense") {
    // Cinematic Suspense Low Drone
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(55.0, 0); // A1 sub
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(55.6, 0); // Binaural beat pulse

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = "lowpass";
    subFilter.frequency.setValueAtTime(320, 0);

    gain.gain.setValueAtTime(0.0001, 0);
    gain.gain.linearRampToValueAtTime(0.09, 2.0);
    gain.gain.setValueAtTime(0.09, dur - 2.0);
    gain.gain.linearRampToValueAtTime(0.0001, dur);

    osc1.connect(subFilter);
    osc2.connect(subFilter);
    subFilter.connect(gain);
    gain.connect(masterFilter);

    osc1.start(0);
    osc2.start(0);
    osc1.stop(dur);
    osc2.stop(dur);
  }

  const renderedBuffer = await ctx.startRendering();
  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Encode an AudioBuffer to standard 16-bit PCM WAV Blob.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // RIFF Chunk Descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt Subchunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample (16)

  // data Subchunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write Interleaved Samples
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// In-memory cache of generated BGM Blob URLs for instant playback
const bgmUrlCache = new Map<string, string>();
let currentAuditionAudio: HTMLAudioElement | null = null;
let currentAuditionPresetId: string | null = null;

export function stopBgmAudition() {
  if (currentAuditionAudio) {
    try {
      currentAuditionAudio.pause();
      currentAuditionAudio.currentTime = 0;
    } catch {}
    currentAuditionAudio = null;
    currentAuditionPresetId = null;
  }
}

export function getCurrentAuditionPresetId(): string | null {
  return currentAuditionPresetId;
}

export async function getProceduralBgmUrl(
  presetId: string,
  durationSeconds: number = 30,
  customFile?: File | null,
): Promise<string | null> {
  if (presetId === "none") return null;
  if (presetId === "custom" && customFile) {
    return URL.createObjectURL(customFile);
  }
  const cacheKey = `${presetId}_${durationSeconds}`;
  if (bgmUrlCache.has(cacheKey)) {
    return bgmUrlCache.get(cacheKey)!;
  }
  const blob = await createProceduralBgmBlob(presetId, durationSeconds);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  bgmUrlCache.set(cacheKey, url);
  return url;
}

export async function playBgmAudition(
  presetId: string,
  volume: number = 0.4,
  customFile?: File | null,
  onEnded?: () => void,
): Promise<boolean> {
  stopBgmAudition();

  if (presetId === "none") {
    onEnded?.();
    return false;
  }

  // Generate an 8-second quick preview for audition
  const audioUrl = await getProceduralBgmUrl(presetId, 12, customFile);
  if (!audioUrl) {
    onEnded?.();
    return false;
  }

  try {
    const audio = new Audio(audioUrl);
    audio.volume = Math.max(0.05, Math.min(1.0, volume));
    audio.loop = true;
    currentAuditionAudio = audio;
    currentAuditionPresetId = presetId;

    audio.onended = () => {
      stopBgmAudition();
      onEnded?.();
    };

    await audio.play();
    return true;
  } catch (err) {
    console.warn("BGM Audition autoplay blocked or failed:", err);
    stopBgmAudition();
    onEnded?.();
    return false;
  }
}


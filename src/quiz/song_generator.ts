import {decodeSongMd} from '../model/quiz';
import {note2midi, midi2freq, SAMPLE_FILES, europeanToAmerican} from '../util';
import type {SoundSource, SampleInstrumentType} from '../types';

export class SongGenerator {
  async fromFile(url: string, soundSource: SoundSource): Promise<AudioBuffer> {
    const mmd = await fetch(url).then(r => r.text());
    return this.fromStr(mmd, soundSource);
  }

  async fromStr(mmd: string, soundSource: SoundSource): Promise<AudioBuffer> {
    const song = decodeSongMd(mmd);

    let totalDuration = 0;
    for (const section of song.sections) {
      for (const measure of section.measures) {
        for (const note of measure.notes) {
          if (note.startTs !== undefined && !note.silent && note.note) {
            totalDuration = Math.max(totalDuration, note.startTs + 60 / (note.speed * measure.bpm));
          }
        }
      }
    }
    totalDuration += 2;

    const sampleRate = 44100;
    const ctx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

    let sampleBuffers: Map<number, AudioBuffer> | null = null;
    if (soundSource.sourceType === 'instrument') {
      sampleBuffers = await loadSampleBuffers(soundSource.instrumentType, ctx);
    }

    let currentMidi: number | null = null;
    let currentStart = 0;
    let currentDuration = 0;

    const flush = () => {
      if (currentMidi === null) return;
      stackNote(soundSource, currentMidi, currentStart, currentDuration, ctx, sampleBuffers);
      currentMidi = null;
    };

    for (const section of song.sections) {
      for (const measure of section.measures) {
        for (const note of measure.notes) {
          const noteDuration = 60 / (note.speed * measure.bpm);
          if (note.silent || !note.note || !note.noteGroup) {
            if (note.starts !== false) flush();
            continue;
          }
          const midi = note2midi(`${note.note}${note.noteGroup}`);
          if (note.starts !== false) {
            flush();
            currentMidi = midi;
            currentStart = note.startTs!;
            currentDuration = noteDuration;
          } else {
            currentDuration += noteDuration;
          }
        }
      }
    }
    flush();

    return ctx.startRendering();
  }
}

export function stackNote(
  soundSource: SoundSource,
  midi: number,
  startTime: number,
  duration: number,
  ctx: OfflineAudioContext,
  sampleBuffers?: Map<number, AudioBuffer> | null,
): void {
  if (soundSource.sourceType === 'midi-wave') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = soundSource.instrumentType;
    osc.frequency.value = midi2freq(midi);
    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + Math.max(duration, 0.01));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  } else if (sampleBuffers) {
    const nearest = findNearestSample(sampleBuffers, midi);
    if (!nearest) return;
    const [sampleMidi, buffer] = nearest;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, (midi - sampleMidi) / 12);
    const gain = ctx.createGain();
    const ctxDuration = ctx.length / ctx.sampleRate;
    const fadeStart = startTime + Math.max(0, duration - 0.08);
    const fadeEnd = Math.min(startTime + duration + 0.05, ctxDuration - 0.001);
    gain.gain.setValueAtTime(0.7, startTime);
    gain.gain.setValueAtTime(0.7, fadeStart);
    gain.gain.linearRampToValueAtTime(0, fadeEnd);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(startTime);
    source.stop(startTime + duration + 0.1);
  }
}

async function loadSampleBuffers(
  instrument: SampleInstrumentType,
  ctx: OfflineAudioContext,
): Promise<Map<number, AudioBuffer>> {
  const files = (SAMPLE_FILES as Record<string, string[]>)[instrument];
  const baseUrl = `/samples/${instrument}/`;
  const entries = await Promise.all(
    files
      .filter(file => /^[A-G]s?\d\.mp3$/.test(file))
      .map(async file => {
        const noteName = europeanToAmerican(file.replace('.mp3', ''));
        const midi = note2midi(noteName);
        const response = await fetch(`${baseUrl}${encodeURIComponent(file)}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        return [midi, buffer] as [number, AudioBuffer];
      })
  );
  return new Map(entries);
}

function findNearestSample(
  buffers: Map<number, AudioBuffer>,
  targetMidi: number,
): [number, AudioBuffer] | null {
  let nearest: [number, AudioBuffer] | null = null;
  let minDist = Infinity;
  for (const [midi, buffer] of buffers) {
    const dist = Math.abs(midi - targetMidi);
    if (dist < minDist) {
      minDist = dist;
      nearest = [midi, buffer];
    }
  }
  return nearest;
}

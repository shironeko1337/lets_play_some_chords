import * as mm from '@magenta/music';
import {note2midi} from '../util';
import type {Note, NoteGroup} from '../util';
import type {SongSetting} from '../model/quiz';

const IONIC_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

// Fields that drive what Magenta generates — these overlap with SongSetting
export type MagnetaConfig = {
  model: 'music_vae' | 'music_rnn'
  temperature: number       // randomness 0–2, default 1.0
  steps: number             // total 16th-note steps to generate (32 = 2 bars at 4/4)
  bpm: number
  keyNote: Note
  keyNoteGroup: NoteGroup
}

// Remaining SongSetting fields not covered by MagnetaConfig
export type MMDSongConfig = Omit<SongSetting, 'bpm' | 'keyNote' | 'keyNoteGroup'>

export type MMDGeneratorConfig = {
  magenta: MagnetaConfig
  song: Partial<MMDSongConfig>
}

function midiToJianpu(midi: number, keyMidi: number, defaultNoteGroup: number, keyNoteGroup: number) {
  const delta = midi - keyMidi;
  const pitchClass = ((delta % 12) + 12) % 12;
  const octave = (delta - pitchClass) / 12;
  const octaveShift = octave - defaultNoteGroup + keyNoteGroup;

  const exactIdx = IONIC_SEMITONES.indexOf(pitchClass);
  if (exactIdx !== -1) return {degree: exactIdx + 1, accidental: 0, octaveShift};

  const sharpIdx = IONIC_SEMITONES.indexOf(pitchClass - 1);
  if (sharpIdx !== -1) return {degree: sharpIdx + 1, accidental: 1, octaveShift};

  const flatIdx = IONIC_SEMITONES.indexOf((pitchClass + 1) % 12);
  if (flatIdx !== -1) return {degree: flatIdx + 1, accidental: -1, octaveShift};

  return {degree: 1, accidental: 0, octaveShift};
}

export class MMDGenerator {
  private vae: mm.MusicVAE;
  private rnn: mm.MusicRNN;
  private initPromise: Promise<void>;

  constructor() {
    this.vae = new mm.MusicVAE('/checkpoints/music_vae/mel_4bar_med_q2');
    this.rnn = new mm.MusicRNN('/checkpoints/music_rnn/melody_rnn');
    this.initPromise = Promise.all([
      this.vae.initialize(),
      this.rnn.initialize(),
    ]).then(() => {});
  }

  async generate(config: MMDGeneratorConfig): Promise<string> {
    await this.initPromise;
    const {magenta, song} = config;
    const keyMidi = note2midi(`${magenta.keyNote}${magenta.keyNoteGroup}`);

    let allTokens: string[] = [];

    if (magenta.model === 'music_vae') {
      // mel_2bar_small always outputs 32 steps; sample as many times as needed
      const MODEL_STEPS = 64;
      const numSamples = Math.max(1, Math.ceil(magenta.steps / MODEL_STEPS));
      const sequences = await this.vae.sample(numSamples, magenta.temperature);
      for (const ns of sequences) {
        allTokens.push(...this.noteSequenceToTokens(ns, magenta, keyMidi));
      }
    } else {
      const seed: mm.INoteSequence = {
        totalQuantizedSteps: 4,
        quantizationInfo: {stepsPerQuarter: 4},
        notes: [{pitch: keyMidi, quantizedStartStep: 0, quantizedEndStep: 4, velocity: 80}],
      };
      const ns = await this.rnn.continueSequence(seed, magenta.steps, magenta.temperature);
      allTokens = this.noteSequenceToTokens(ns, magenta, keyMidi);
    }

    return this.tokensToMMD(allTokens, magenta, song);
  }

  private noteSequenceToTokens(
    ns: mm.INoteSequence,
    magenta: MagnetaConfig,
    keyMidi: number,
  ): string[] {
    const stepsPerQuarter = ns.quantizationInfo?.stepsPerQuarter ?? 4;
    const defaultGroup = magenta.keyNoteGroup; // use key octave as reference
    const totalSteps = ns.totalQuantizedSteps ?? 32;
    const totalQuarters = Math.ceil(totalSteps / stepsPerQuarter);
    const notes = ns.notes ?? [];

    const tokens: string[] = [];
    for (let q = 0; q < totalQuarters; q++) {
      const stepStart = q * stepsPerQuarter;
      const stepEnd = stepStart + stepsPerQuarter;

      const starting = notes.find(n =>
        (n.quantizedStartStep ?? 0) >= stepStart && (n.quantizedStartStep ?? 0) < stepEnd
      );
      const continuing = !starting && notes.find(n =>
        (n.quantizedStartStep ?? 0) < stepStart && (n.quantizedEndStep ?? 0) > stepStart
      );

      if (starting) {
        const {degree, accidental, octaveShift} = midiToJianpu(
          starting.pitch ?? keyMidi, keyMidi, magenta.keyNoteGroup, magenta.keyNoteGroup
        );
        const prefix = octaveShift > 0 ? '^'.repeat(octaveShift) : octaveShift < 0 ? 'v'.repeat(-octaveShift) : '';
        const suffix = accidental === 1 ? '#' : accidental === -1 ? 'b' : '';
        tokens.push(`${prefix}${degree}${suffix}`);
      } else if (continuing) {
        tokens.push('-');
      } else {
        tokens.push('x');
      }
    }
    return tokens;
  }

  private tokensToMMD(
    tokens: string[],
    magenta: MagnetaConfig,
    song: Partial<MMDSongConfig>,
  ): string {
    const timeTop = song.timeSignatureTop ?? 4;
    const defaultGroup = song.defaultNoteGroup ?? 4;

    const measureLines: string[] = [];
    const numMeasures = Math.ceil(tokens.length / timeTop);
    for (let m = 0; m < numMeasures; m++) {
      const slice = tokens.slice(m * timeTop, (m + 1) * timeTop);
      while (slice.length < timeTop) slice.push('x');
      measureLines.push(slice.join(''));
    }

    const top = song.timeSignatureTop ?? 4;
    const bottom = song.timeSignatureBottom ?? 4;
    const headerLines = [
      `title: '${song.title ?? 'Generated'}'`,
      `key: ${magenta.keyNote}${magenta.keyNoteGroup}`,
      `bpm: ${magenta.bpm}`,
      `defaultNoteGroup: ${defaultGroup}`,
      `shift: ${song.shift ?? 0}`,
    ];
    if (top !== 4 || bottom !== 4) {
      headerLines.push(`timeSignatureTop: ${top}`, `timeSignatureBottom: ${bottom}`);
    }

    return `${headerLines.join('\n')}\n\n%%\n${measureLines.join('\n')}\n`;
  }
}

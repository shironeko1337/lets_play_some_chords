import * as Tone from "tone";

const SAMPLE_BASE_URL = `${import.meta.env.BASE_URL}samples`;

export const SAMPLE_FILES: any = {
  "bass-electric": [
    "As1.mp3",
    "As2.mp3",
    "As3.mp3",
    "As4.mp3",
    "Cs1.mp3",
    "Cs2.mp3",
    "Cs3.mp3",
    "Cs4.mp3",
    "Cs5.mp3",
    "E1.mp3",
    "E2.mp3",
    "E3.mp3",
    "E4.mp3",
    "G1.mp3",
    "G2.mp3",
    "G3.mp3",
    "G4.mp3",
  ],
  bassoon: [
    
    "A2.mp3",
    "A3.mp3",
    "A4.mp3",
    "C3.mp3",
    "C4.mp3",
    "C5.mp3",
    "E4.mp3",
    "G2.mp3",
    "G3.mp3",
    "G4.mp3",
  ],
  cello: [
    "A2.mp3",
    "A3.mp3",
    "A4.mp3",
    "As2.mp3",
    "As3.mp3",
    "B2.mp3",
    "B3.mp3",
    "B4.mp3",
    "C2.mp3",
    "C3.mp3",
    "C4.mp3",
    "C5.mp3",
    "Cs3.mp3",
    "Cs4.mp3",
    "D2.mp3",
    "D3.mp3",
    "D4.mp3",
    "Ds2.mp3",
    "Ds3.mp3",
    "Ds4.mp3",
    "E2.mp3",
    "E3.mp3",
    "E4.mp3",
    "F2 v2.mp3",
    "F2.mp3",
    "F3.mp3",
    "F4.mp3",
    "Fs3.mp3",
    "Fs4.mp3",
    "G2 v2.mp3",
    "G2.mp3",
    "G3.mp3",
    "G4.mp3",
    "Gs2.mp3",
    "Gs3.mp3",
    "Gs4.mp3",
  ],
  clarinet: [
    "As3.mp3",
    "As4.mp3",
    "As5.mp3",
    "D3.mp3",
    "D4.mp3",
    "D5.mp3",
    "D6.mp3",
    "F3.mp3",
    "F4.mp3",
    "F5.mp3",
    "Fs6.mp3",
  ],
  contrabass: [
    "A2.mp3",
    "As1.mp3",
    "B3.mp3",
    "C2.mp3",
    "Cs3.mp3",
    "D2.mp3",
    "E2.mp3",
    "E3.mp3",
    "Fs1.mp3",
    "Fs2.mp3",
    "G1.mp3",
    "Gs2.mp3",
    "Gs3.mp3",
  ],
  flute: [
    "A4.mp3",
    "A5.mp3",
    "A6.mp3",
    "C4.mp3",
    "C5.mp3",
    "C6.mp3",
    "C7.mp3",
    "E4.mp3",
    "E5.mp3",
    "E6.mp3",
  ],
  "french-horn": [
    "A1.mp3",
    "A3.mp3",
    "C2.mp3",
    "C4.mp3",
    "D3.mp3",
    "D5.mp3",
    "Ds2.mp3",
    "F3.mp3",
    "F5.mp3",
    "G2.mp3",
  ],
  "guitar-acoustic": [
    "A2.mp3",
    "A3.mp3",
    "A4.mp3",
    "As2.mp3",
    "As3.mp3",
    "As4.mp3",
    "B2.mp3",
    "B3.mp3",
    "B4.mp3",
    "C3.mp3",
    "C4.mp3",
    "C5.mp3",
    "Cs3.mp3",
    "Cs4.mp3",
    "Cs5.mp3",
    "D2.mp3",
    "D3.mp3",
    "D4.mp3",
    "D5.mp3",
    "Ds2.mp3",
    "Ds3.mp3",
    "Ds4.mp3",
    "E2.mp3",
    "E3.mp3",
    "E4.mp3",
    "F2.mp3",
    "F3.mp3",
    "F4.mp3",
    "Fs2.mp3",
    "Fs3.mp3",
    "Fs4.mp3",
    "G2.mp3",
    "G3.mp3",
    "G4.mp3",
    "Gs2.mp3",
    "Gs3.mp3",
    "Gs4.mp3",
  ],
  "guitar-electric": [
    "A2.mp3",
    "A3.mp3",
    "A4.mp3",
    "A5.mp3",
    "C3.mp3",
    "C4.mp3",
    "C5.mp3",
    "C6.mp3",
    "Cs2.mp3",
    "Ds3.mp3",
    "Ds4.mp3",
    "Ds5.mp3",
    "E2.mp3",
    "Fs2.mp3",
    "Fs3.mp3",
    "Fs4.mp3",
    "Fs5.mp3",
  ],
  "guitar-nylon": [
    "A2.mp3",
    "A3.mp3",
    "A4.mp3",
    "A5.mp3",
    "As5.mp3",
    "B1.mp3",
    "B2.mp3",
    "B3.mp3",
    "B4.mp3",
    "Cs3.mp3",
    "Cs4.mp3",
    "Cs5.mp3",
    "D2.mp3",
    "D3.mp3",
    "D5.mp3",
    "Ds4.mp3",
    "E2.mp3",
    "E3.mp3",
    "E4.mp3",
    "E5.mp3",
    "Fs2.mp3",
    "Fs3.mp3",
    "Fs4.mp3",
    "Fs5.mp3",
    "G3.mp3",
    "G5.mp3",
    "Gs2.mp3",
    "Gs4.mp3",
    "Gs5.mp3",
  ],
  harmonium: [
    "A2.mp3",
    "A3.mp3",
    "A4.mp3",
    "As2.mp3",
    "As3.mp3",
    "As4.mp3",
    "B2.mp3",
    "B3.mp3",
    "B4.mp3",
    "C2.mp3",
    "C3.mp3",
    "C4.mp3",
    "C5.mp3",
    "Cs2.mp3",
    "Cs3.mp3",
    "Cs4.mp3",
    "Cs5.mp3",
    "D2.mp3",
    "D3.mp3",
    "D4.mp3",
    "D5.mp3",
    "Ds2.mp3",
    "Ds3.mp3",
    "Ds4.mp3",
    "E2.mp3",
    "E3.mp3",
    "E4.mp3",
    "F2.mp3",
    "F3.mp3",
    "F4.mp3",
    "Fs2.mp3",
    "Fs3.mp3",
    "G2.mp3",
    "G3.mp3",
    "G4.mp3",
    "Gs2.mp3",
    "Gs3.mp3",
    "Gs4.mp3",
  ],
  harp: [
    "A2.mp3",
    "A4.mp3",
    "A6.mp3",
    "B1.mp3",
    "B3.mp3",
    "B5.mp3",
    "B6.mp3",
    "C3.mp3",
    "C5.mp3",
    "D2.mp3",
    "D4.mp3",
    "D6.mp3",
    "D7.mp3",
    "E1.mp3",
    "E3.mp3",
    "E5.mp3",
    "F2.mp3",
    "F4.mp3",
    "F6.mp3",
    "F7.mp3",
    "G1.mp3",
    "G3.mp3",
    "G5.mp3",
  ],
  organ: [
    "A1.mp3",
    "A2.mp3",
    "A3.mp3",
    "A4.mp3",
    "A5.mp3",
    "C1.mp3",
    "C2.mp3",
    "C3.mp3",
    "C4.mp3",
    "C5.mp3",
    "C6.mp3",
    "Ds1.mp3",
    "Ds2.mp3",
    "Ds3.mp3",
    "Ds4.mp3",
    "Ds5.mp3",
    "Fs1.mp3",
    "Fs2.mp3",
    "Fs3.mp3",
    "Fs4.mp3",
    "Fs5.mp3",
  ],
  piano: [
    "A1.mp3",
    "A2.mp3",
    "A3.mp3",
    "A4.mp3",
    "A5.mp3",
    "A6.mp3",
    "A7.mp3",
    "As1.mp3",
    "As2.mp3",
    "As3.mp3",
    "As4.mp3",
    "As5.mp3",
    "As6.mp3",
    "As7.mp3",
    "B1.mp3",
    "B2.mp3",
    "B3.mp3",
    "B4.mp3",
    "B5.mp3",
    "B6.mp3",
    "B7.mp3",
    "C1.mp3",
    "C2.mp3",
    "C3.mp3",
    "C4.mp3",
    "C5.mp3",
    "C6.mp3",
    "C7.mp3",
    "C8.mp3",
    "Cs1.mp3",
    "Cs2.mp3",
    "Cs3.mp3",
    "Cs4.mp3",
    "Cs5.mp3",
    "Cs6.mp3",
    "Cs7.mp3",
    "D1.mp3",
    "D2.mp3",
    "D3.mp3",
    "D4.mp3",
    "D5.mp3",
    "D6.mp3",
    "D7.mp3",
    "Ds1.mp3",
    "Ds2.mp3",
    "Ds3.mp3",
    "Ds4.mp3",
    "Ds5.mp3",
    "Ds6.mp3",
    "Ds7.mp3",
    "E1.mp3",
    "E2.mp3",
    "E3.mp3",
    "E4.mp3",
    "E5.mp3",
    "E6.mp3",
    "E7.mp3",
    "F1.mp3",
    "F2.mp3",
    "F3.mp3",
    "F4.mp3",
    "F5.mp3",
    "F6.mp3",
    "F7.mp3",
    "Fs1.mp3",
    "Fs2.mp3",
    "Fs3.mp3",
    "Fs4.mp3",
    "Fs5.mp3",
    "Fs6.mp3",
    "Fs7.mp3",
    "G1.mp3",
    "G2.mp3",
    "G3.mp3",
    "G4.mp3",
    "G5.mp3",
    "G6.mp3",
    "G7.mp3",
    "Gs1.mp3",
    "Gs2.mp3",
    "Gs3.mp3",
    "Gs4.mp3",
    "Gs5.mp3",
    "Gs6.mp3",
    "Gs7.mp3",
  ],
  saxophone: [
    "A4.mp3",
    "A5.mp3",
    "As3.mp3",
    "As4.mp3",
    "B3.mp3",
    "B4.mp3",
    "C4.mp3",
    "C5.mp3",
    "Cs3.mp3",
    "Cs4.mp3",
    "Cs5.mp3",
    "D3.mp3",
    "D4.mp3",
    "D5.mp3",
    "Ds3.mp3",
    "Ds4.mp3",
    "Ds5.mp3",
    "E3.mp3",
    "E4.mp3",
    "E5.mp3",
    "F3.mp3",
    "F4.mp3",
    "F5.mp3",
    "Fs3.mp3",
    "Fs4.mp3",
    "Fs5.mp3",
    "G3.mp3",
    "G4.mp3",
    "G5.mp3",
    "Gs3.mp3",
    "Gs4.mp3",
    "Gs5.mp3",
  ],
  trombone: [
    "As1.mp3",
    "As2.mp3",
    "As3.mp3",
    "C3.mp3",
    "C4.mp3",
    "Cs2.mp3",
    "Cs4.mp3",
    "D3.mp3",
    "D4.mp3",
    "Ds2.mp3",
    "Ds3.mp3",
    "Ds4.mp3",
    "F2.mp3",
    "F3.mp3",
    "F4.mp3",
    "Gs2.mp3",
    "Gs3.mp3",
  ],
  trumpet: [
    "A3.mp3",
    "A5.mp3",
    "As4.mp3",
    "C4.mp3",
    "C6.mp3",
    "D5.mp3",
    "Ds4.mp3",
    "F3.mp3",
    "F4.mp3",
    "F5.mp3",
    "G4.mp3",
  ],
  tuba: [
    "As1.mp3",
    "As2.mp3",
    "As3.mp3",
    "D3.mp3",
    "D4.mp3",
    "Ds2.mp3",
    "F1.mp3",
    "F2.mp3",
    "F3.mp3",
  ],
  violin: [
    "A3.mp3",
    "A4.mp3",
    "A5.mp3",
    "A6.mp3",
    "C4.mp3",
    "C5.mp3",
    "C6.mp3",
    "C7.mp3",
    "E4.mp3",
    "E5.mp3",
    "E6.mp3",
    "G3.mp3",
    "G4.mp3",
    "G5.mp3",
    "G6.mp3",
  ],
  xylophone: [
    "C5.mp3",
    "C6.mp3",
    "C7.mp3",
    "C8.mp3",
    "G4.mp3",
    "G5.mp3",
    "G6.mp3",
    "G7.mp3",
  ],
};

export type Note = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B' | string;
export type NoteGroup = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const NOTES: Note[] = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export const note2midi = (note: string) => {
  return (
    (note.charCodeAt(note.length - 1) - 47) * 12 +
    NOTES.indexOf(note.substring(0, note.length - 1))
  );
};

export const midi2note = (index: number) => {
  return `${NOTES[index % 12][0]}${NOTES[index % 12][1] ?? ""}${Math.floor(index / 12 + 0.001) - 1
    }`;
};

export const midi2freq = (index: number) => {
  return 440 * Math.pow(2, (index - 69) / 12);
};

// As5 -> A#5 (European to American notation)
export const europeanToAmerican = (note: string) => {
  return note.replace(/([ACDFG])s(\d)/, "$1#$2");
};

/**
 * distribution of the notes in a chord.
 */
export const ChordMIDI = {
  M: [0, 4, 7],
  m: [0, 3, 7],
  D7: [0, 4, 7, 10],
  M7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dim: [0, 3, 6],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
};

export const IonicScale = [
  [ChordMIDI.M, ChordMIDI.M7],
  [ChordMIDI.m, ChordMIDI.m7],
  [ChordMIDI.m, ChordMIDI.m7],
  [ChordMIDI.M, ChordMIDI.M7],
  [ChordMIDI.M, ChordMIDI.D7],
  [ChordMIDI.m, ChordMIDI.m7],
  [ChordMIDI.dim, ChordMIDI.m7b5],
];

export function getChordMIDI(rootMIDI: number, chordMIDI: number[]) {
  return chordMIDI.map((dif: number) => dif + rootMIDI);
}

export function play({noteMIDI, duration = "2n", instrument}: any) {
  let playingNotes = "";
  if (instrument) {
    playingNotes = noteMIDI.map((midi: number) => midi2note(midi)).join(", ");
    instrument.triggerAttackRelease(
      noteMIDI.map((midi: number) => midi2note(midi)),
      duration
    );
  }
  return playingNotes;
}

export async function loadInstrument(name: string) {
  let instrument = null;
  try {
    await Tone.start();

    // Convert array to object mapping note names to filenames
    // Convert European notation (As, Cs, Ds, Fs, Gs) to American notation (A#, C#, D#, F#, G#)
    const urls = SAMPLE_FILES[name].reduce((acc: any, file: string) => {
      const noteName = europeanToAmerican(file.replace(".mp3", ""));
      acc[noteName] = file;
      return acc;
    }, {});

    instrument = new Tone.Sampler({
      urls: urls,
      baseUrl: `${SAMPLE_BASE_URL}/${name}/`,
      onload: () => {
        console.log(`${name} loaded successfully`);
      },
    }).toDestination();
  } catch (error) {
    console.error("Error loading instrument:", error);
    instrument = null;
  }
  return instrument;
}

// Chromatic scale degrees from root (semitone 0–11)
const CHROMATIC_DEGREES = ['1', '2b', '2', '3b', '3', '4', '4#', '5', '6b', '6', '7b', '7'] as const;
export type ChromaticDegree = typeof CHROMATIC_DEGREES[number];

export function calcFlux(prevFreqBuf: Uint8Array | null, freqBuf: Uint8Array, threshold: number): number {
  if (!prevFreqBuf) return 0;
  let flux = 0;
  for (let i = 0; i < freqBuf.length; i++) {
    const diff = freqBuf[i] - prevFreqBuf[i];
    if (diff > 0) flux += diff;
  }
  return flux > threshold ? flux : 0;
}

export function calcMean(buf: Float32Array, start = 0, end = buf.length): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += Math.abs(buf[i]);
  return sum / (end - start);
}

export function msLog(val: unknown): string {
  return Number(val).toFixed(2);
}

export function detectLogger(info: unknown, startIndex: number, endIndex: number, sampleRate = 44100): void {
  console.log(
    `Detected ${info} from ${msLog((startIndex / sampleRate) * 1000)}ms to ${msLog((1000 * endIndex) / sampleRate)}ms at [${startIndex},${endIndex})`,
  );
}

/** Maps a frequency (Hz) to the nearest note name + octave, within a deviation threshold (%). */
export function getNoteFromFreq(freq: number, deviationThreshold = 1): {level: string; deviation: number | undefined} {
  const invalid = {level: '', deviation: undefined};
  if (freq <= 0) return invalid;

  const nExact = 12 * Math.log2(freq / 440.0);
  const nClosest = Math.round(nExact);

  const totalIdx = 4 * 12 + 9 + nClosest; // relative to A4 (index 57)
  const octave = Math.floor(totalIdx / 12);
  const noteIdx = ((totalIdx % 12) + 12) % 12;

  const level = `${NOTES[noteIdx]}${octave}`;
  const standardFreq = 440.0 * Math.pow(2, nClosest / 12);
  const deviation = ((freq - standardFreq) / standardFreq) * 100;

  if (Math.abs(deviation) <= deviationThreshold) {
    return {level, deviation: parseFloat(deviation.toFixed(2))};
  }
  return invalid;
}

/**
 * Returns the chromatic scale degree of `pitch` relative to `key` at octave `group`.
 * Degree notation: 1 2b 2 3b 3 4 4# 5 6b 6 7b 7 (sharps written as # of the degree above)
 * Second return value is octaves above the root octave.
 *
 * e.g. getPitchLevel('C3', 'C', 2) → ['1', 1]   (C3 is one octave above C2)
 *      getPitchLevel('F#3', 'D#', 3) → ['3b', 0] (F#3 is a minor 3rd above D#3)
 */
export function getPitchLevel(pitch: string, key: Note, group: NoteGroup, _scale = 'Ionian'): [ChromaticDegree, number] {
  const pitchNote = pitch.slice(0, -1) as Note;
  const pitchOctave = parseInt(pitch.slice(-1));

  const keySemitones = (group + 1) * 12 + NOTES.indexOf(key);
  const pitchSemitones = (pitchOctave + 1) * 12 + NOTES.indexOf(pitchNote);

  const diff = pitchSemitones - keySemitones;
  const degreeIdx = ((diff % 12) + 12) % 12;
  const octaveDiff = Math.floor(diff / 12);

  return [CHROMATIC_DEGREES[degreeIdx], octaveDiff];
}

const _instrumentCache = new Map<string, Promise<any>>();

export const playInstrumentNote = (note: Note, group: number, instrument: string) => {
  if (!_instrumentCache.has(instrument)) {
    _instrumentCache.set(instrument, loadInstrument(instrument));
  }
  _instrumentCache.get(instrument)!.then(sampler => {
    if (!sampler) return;
    play({noteMIDI: [note2midi(`${note}${group}`)], instrument: sampler, duration: '2n'});
  });
};

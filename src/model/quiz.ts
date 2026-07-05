import * as Tone from 'tone'
import {Note, NoteGroup, NOTES, midi2note, note2midi} from "../util"
import {SoundSource} from '../types';

const IONIC_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

class Track {
  timeBeforePlay: number = 0
  onEnded?: () => void;
  private player: Tone.Player | null = null
  private _audioStartTime?: number;
  private _audioOffset = 0;
  private _bufferDuration = 0;
  private _endTimeoutId?: ReturnType<typeof setTimeout>;
  private _pausedAt?: number;

  get progress(): number {
    if (this._pausedAt !== undefined) return this._pausedAt / this._bufferDuration;
    if (this._audioStartTime === undefined) return 0;
    const elapsed = Tone.now() - this._audioStartTime + this._audioOffset;
    return Math.min(Math.max(elapsed / this._bufferDuration, 0), 1);
  }

  get currentTime(): number {
    if (this._pausedAt !== undefined) return this._pausedAt;
    if (this._audioStartTime === undefined) return 0;
    return Math.max(Tone.now() - this._audioStartTime + this._audioOffset, 0);
  }

  /**
   * load a track to have a audio source in memory from given path
   */
  async load(path: string) {
    await Tone.start();
    this.player = new Tone.Player(path).toDestination();
    await Tone.loaded();
  }

  async loadBuffer(buffer: AudioBuffer) {
    await Tone.start();
    this.player = new Tone.Player(buffer).toDestination();
    await Tone.loaded();
  }

  /**
   * play a track with given timeBeforePlay, if timeBeforePlay is positive, wait for certain time before playing
   * if it's negative, skip the first certain time of the audio source
   */
  play() {
    if (!this.player) return;
    this._bufferDuration = this.player.buffer.duration;
    const now = Tone.now();
    if (this.timeBeforePlay > 0) {
      this._audioStartTime = now + this.timeBeforePlay;
      this._audioOffset = 0;
      this.player.start(`+${this.timeBeforePlay}`);
    } else if (this.timeBeforePlay < 0) {
      this._audioStartTime = now;
      this._audioOffset = -this.timeBeforePlay;
      this.player.start(0, -this.timeBeforePlay);
    } else {
      this._audioStartTime = now;
      this._audioOffset = 0;
      this.player.start();
    }
    const delay = this.timeBeforePlay > 0 ? this.timeBeforePlay : 0;
    const playDuration = delay + this._bufferDuration - this._audioOffset;
    if (this._endTimeoutId !== undefined) clearTimeout(this._endTimeoutId);
    this._endTimeoutId = setTimeout(() => this.onEnded?.(), playDuration * 1000);
  }

  pause() {
    if (this._audioStartTime === undefined || this._pausedAt !== undefined) return;
    this._pausedAt = this.currentTime;
    if (this._endTimeoutId !== undefined) {
      clearTimeout(this._endTimeoutId);
      this._endTimeoutId = undefined;
    }
    try {this.player?.stop();} catch { }
    this._audioStartTime = undefined;
  }

  resume() {
    if (!this.player || this._pausedAt === undefined) return;
    const offset = this._pausedAt;
    const remaining = this._bufferDuration - offset;
    this._pausedAt = undefined;
    this._audioStartTime = Tone.now();
    this._audioOffset = offset;
    this.player.start(0, offset);
    if (this._endTimeoutId !== undefined) clearTimeout(this._endTimeoutId);
    this._endTimeoutId = setTimeout(() => this.onEnded?.(), remaining * 1000);
  }

  stop() {
    if (this._endTimeoutId !== undefined) {
      clearTimeout(this._endTimeoutId);
      this._endTimeoutId = undefined;
    }
    try {this.player?.stop();} catch { }
    this._audioStartTime = undefined;
    this._pausedAt = undefined;
  }
}

export class Song {
  sections: SongSection[] = []
  songSetting: SongSetting;

  measureCount = 0

  constructor(songSetting: SongSetting) {
    this.songSetting = songSetting;
  }

  addSection(setting: SectionSetting, sectionStartTs = 0) {
    const section = new SongSection({...setting, sectionStartTs});
    this.sections.push(section)
    return section
  }

  addMeasure(section: SongSection, measureStartTs = 0, bpm?: number) {
    const measure = new SongMeasure(section, this.measureCount, measureStartTs, bpm ?? section.bpm);
    section.measures.push(measure)
    section.measureCount++;
    this.measureCount++;
    return measure
  }

  updateTimestamps() {
    let ts = this.songSetting.shift ?? 0;
    for (const section of this.sections) {
      section.sectionStartTs = ts;
      for (const measure of section.measures) {
        measure.measureStartTs = ts;
        let elapsed = 0;
        for (const note of measure.notes) {
          note.startTs = ts + elapsed;
          elapsed += 60 / (note.speed * measure.bpm);
        }
        ts += measure.quaterNoteCount * 60 / measure.bpm;
      }
    }
  }

  addNotes(measure: SongMeasure, notesExpression: string, previousNote: SongNote) {
    const section = measure.section;
    return measure.addNotes(decodeNotesExpression(notesExpression,
      previousNote,
      section.defaultNoteGroup,
      section.keyNote,
      section.keyNoteGroup,
      measure))
  }
}

export type SongSetting = {
  shift: number;
  title: string
  bpm: number
  defaultNoteGroup: number
  keyNote?: Note
  keyNoteGroup?: NoteGroup
  timeSignatureTop?: number
  timeSignatureBottom?: number
  tonicPickup?: boolean
}

type SectionSetting = SongSetting & {
  name?: string
  sectionStartTs?: number;
}

class SongMeasure {
  section: SongSection
  index: number
  measureStartTs: number;
  bpm: number;

  quaterNoteCount: number;

  notes: SongNote[] = []

  constructor(section: SongSection, index: number, measureStartTs: number, bpm: number) {
    this.section = section
    this.index = index
    this.measureStartTs = measureStartTs;
    this.bpm = bpm;
    this.quaterNoteCount = section ? (section.timeSignatureTop / section.timeSignatureBottom * 4) : 0
  }

  /**
   * add notes and return the last added note
   */
  addNotes(notes: SongNote[]) {
    const totalTime = notes.reduce((sum, n) => sum + 1 / n.speed, 0);
    if (Math.abs(totalTime - this.quaterNoteCount) > 0.001) {
      console.error(`Note time mismatch: expected ${this.quaterNoteCount} beats, got ${totalTime}`);
    }
    this.notes.push(...notes);
    return this.notes[this.notes.length - 1];
  }
}

type SongNoteConfig = {measure: SongMeasure, starts?: boolean, silent?: boolean, ends?: boolean, note?: Note, noteGroup?: NoteGroup, speed?: number}

export class SongNote {
  id?: string;
  measure: SongMeasure;
  silent = false;
  ends = true;
  starts = true;
  note?: Note;
  noteGroup?: NoteGroup;
  speed: number; // 1 means it's a quarter note, 2 means it's 1/8 note, 8/3 means it's triplet
  startTs?: number;
  degree?: number;     // 1-7 scale degree in jianpu notation
  accidental?: number; // -1 flat, 0 natural, 1 sharp
  octaveShift?: number; // octave offset from defaultNoteGroup (+ = higher, - = lower)

  constructor({measure, silent = false, starts = true, ends = true, note, noteGroup, speed = 1}: SongNoteConfig) {
    this.measure = measure
    this.silent = silent
    this.ends = ends
    this.starts = starts
    this.note = note
    this.noteGroup = noteGroup
    this.speed = speed
  }
}

class SongSection {
  bpm: number;
  name: string
  keyNote: Note
  keyNoteGroup: NoteGroup
  defaultNoteGroup: number;
  timeSignatureTop: number;
  timeSignatureBottom: number;
  sectionStartTs: number;
  measures: SongMeasure[] = []
  measureCount = 0

  constructor({name = '', bpm, defaultNoteGroup = 3, timeSignatureTop = 4, timeSignatureBottom = 4, keyNote = 'C', keyNoteGroup = 3, sectionStartTs = 0}: SectionSetting) {
    this.name = name
    this.bpm = bpm;
    this.timeSignatureTop = timeSignatureTop;
    this.timeSignatureBottom = timeSignatureBottom;
    this.defaultNoteGroup = defaultNoteGroup;
    this.keyNote = keyNote
    this.keyNoteGroup = keyNoteGroup
    this.sectionStartTs = sectionStartTs;
  }
}

export class Quiz {
  song?: Song
  track?: Track

  constructor() {
  }

  async test(generate: (mmdPath: string, soundSource: SoundSource) => Promise<AudioBuffer>) {
    const songs = [
      // 'songs/morning_steps.mmd',
      // 'songs/wanderer.mmd',
      // 'songs/twilight.mmd',
      // 'songs/playful_dance.mmd',
      // 'songs/moonlit_path.mmd',
      // 'songs/river_flow.mmd',
      // 'songs/progression_study.mmd',
      'songs/jazz_progressions.mmd',
      // 'songs/rock_progressions.mmd',
      // 'songs/interval_training_45.mmd',
      // 'songs/interval_training_23.mmd',
      // 'songs/generated.mmd',
    ];
    const soundSource: SoundSource = {sourceType: 'instrument', instrumentType: 'piano'};
    const mmdPath = songs[Math.floor(Math.random() * songs.length)];
    const audioBuffer = await generate(mmdPath, soundSource);
    await this.loadFromMMD(soundSource, mmdPath, audioBuffer);
  }

  async load(musicPath: string, mmdPath: string) {
    const mmd = await fetch(mmdPath).then(r => r.text());
    this.song = decodeSongMd(mmd);
    this.track = new Track();
    this.track.timeBeforePlay = this.song.songSetting.shift;
    await this.track.load(musicPath);
  }

  async loadFromMMD(soundSource: SoundSource, mmdPath: string, audioBuffer?: AudioBuffer) {
    const mmd = await fetch(mmdPath).then(r => r.text());
    this.song = decodeSongMd(mmd);
    if (audioBuffer) {
      this.track = new Track();
      this.track.timeBeforePlay = this.song.songSetting.shift;
      await this.track.loadBuffer(audioBuffer);
    }
  }
}

export enum QuizEngineStatus {
  LOADING,
  READY,
  COUNTDOWN,
  PLAYING,
  END
}

class QuizEngine {
  status = QuizEngineStatus.LOADING
  load() {
    this.status = QuizEngineStatus.READY
  }

  play() { }
}

export const decodeSongMd = (s: string): Song => {
  const [configStr = '', musicStr = ''] = s.split(/%{2,}/);

  const parseKeyValues = (text: string): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const stripped = line.replace(/\(.*?\)/g, '').trim();
      const m = stripped.match(/^(\w+)\s*:\s*(.+)$/);
      if (m) result[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return result;
  };

  const applyConfig = (setting: SectionSetting, config: Record<string, string>): SectionSetting => {
    const result = {...setting};
    if (config.title !== undefined) result.title = config.title;
    if (config.bpm !== undefined) result.bpm = parseFloat(config.bpm);
    if (config.key !== undefined) {
      const m = config.key.match(/^([A-G][#b]?)(\d+)?$/);
      if (m) {
        result.keyNote = m[1] as Note;
        if (m[2] !== undefined) result.keyNoteGroup = parseInt(m[2]) as NoteGroup;
      }
    }
    if (config.keyNoteGroup !== undefined) result.keyNoteGroup = parseInt(config.keyNoteGroup) as NoteGroup;
    if (config.defaultNoteGroup !== undefined) result.defaultNoteGroup = parseInt(config.defaultNoteGroup);
    if (config.timeSignatureTop !== undefined) result.timeSignatureTop = parseInt(config.timeSignatureTop);
    if (config.timeSignatureBottom !== undefined) result.timeSignatureBottom = parseInt(config.timeSignatureBottom);
    if (config.shift !== undefined) result.shift = parseFloat(config.shift);
    if (config.tonicPickup !== undefined) result.tonicPickup = config.tonicPickup === 'true';
    return result;
  };

  let currentSetting: SectionSetting = applyConfig(
    {shift: 0, title: '', bpm: 80, defaultNoteGroup: 3, keyNote: 'C', keyNoteGroup: 3, timeSignatureTop: 4, timeSignatureBottom: 4},
    parseKeyValues(configStr)
  );

  const song = new Song(currentSetting);
  let currentSection: SongSection | null = null;
  let currentTs = 0;
  const addTonicPickup = (section: SongSection) => {
    const measure = song.addMeasure(section, currentTs, currentSetting.bpm);
    const restBeats = Math.max(0, Math.round(measure.quaterNoteCount) - 1);
    lastNote = song.addNotes(measure, '1' + 'x'.repeat(restBeats), lastNote) ?? lastNote;
    currentTs += measure.quaterNoteCount * 60 / measure.bpm;
  };

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = song.addSection(currentSetting, currentTs);
      if (currentSetting.tonicPickup) addTonicPickup(currentSection);
    }
    return currentSection;
  };

  // just for type, this object won't be read
  let lastNote = new SongNote({measure: new SongMeasure(currentSection!, 0, 0, currentSetting.bpm)});

  const lines = musicStr.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].replace(/\(.*?\)/g, '').trim();
    i++;
    if (!line) continue;

    // Multiline settings block: lone % on its own line
    if (line === '%') {
      const settingLines: string[] = [];
      while (i < lines.length && lines[i].replace(/\(.*?\)/g, '').trim() !== '%') {
        settingLines.push(lines[i]);
        i++;
      }
      i++; // skip closing %
      currentSetting = applyConfig(currentSetting, parseKeyValues(settingLines.join('\n')));
      continue;
    }

    // Inline settings: % bpm: 120 %
    const inlineMatch = line.match(/^%(.+)%$/);
    if (inlineMatch) {
      currentSetting = applyConfig(currentSetting, parseKeyValues(inlineMatch[1]));
      continue;
    }

    // Section marker: [SectionName]
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSetting = {...currentSetting, name: sectionMatch[1]};
      currentSection = song.addSection(currentSetting, currentTs);
      if (currentSetting.tonicPickup) addTonicPickup(currentSection);
      continue;
    }

    // Note expression line — one measure
    const section = ensureSection();
    const measure = song.addMeasure(section, currentTs, currentSetting.bpm);
    lastNote = song.addNotes(measure, line, lastNote) ?? lastNote;
    currentTs += measure.quaterNoteCount * 60 / measure.bpm;
  }

  song.updateTimestamps();
  return song;
}

/**
 * greedy match the expression of a note.
 */
export const decodeNotesExpression = (s: string, previousNote: SongNote, defaultNoteGroup: number, keyNote: Note, keyNoteGroup: NoteGroup, measure: SongMeasure) => {
  const cleaned = s.replace(/\/\/.*$/, '').replace(/\s/g, '');

  const regex = /[<>]|\-|x|\[\d+,\d+\]|[v^]*\d[#b]?/g;
  const notes: SongNote[] = [];
  let lastIndex = 0;

  const speedStack: number[] = [];
  let speed = 1;
  let tripletSavedSpeed: number | null = null;
  let tripletRemaining = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index !== lastIndex) {
      console.error(`Unexpected token at position ${lastIndex}: "${cleaned.slice(lastIndex, match.index)}"`);
    }
    const token = match[0];
    if (token === '<') {
      if (tripletRemaining > 0) {
        console.error('Nesting inside a triplet group is not allowed');
      }
      speedStack.push(speed);
      speed *= 2;
    } else if (token === '>') {
      speed = speedStack.pop() ?? 1;
    } else if (token[0] === '[') {
      const comma = token.indexOf(',');
      const x = parseInt(token.slice(1, comma));
      const y = parseInt(token.slice(comma + 1, -1));
      const prevSpeed = speedStack.length > 0 ? speedStack[speedStack.length - 1] : 1;
      tripletSavedSpeed = speed;
      speed = prevSpeed * x / y;
      tripletRemaining = x;
    } else {
      const prev = notes.length > 0 ? notes[notes.length - 1] : previousNote;
      const note = decodeNoteExpresssion(token, prev, defaultNoteGroup, keyNote, keyNoteGroup, measure);
      note.speed = speed;
      notes.push(note);
      if (tripletRemaining > 0) {
        tripletRemaining--;
        if (tripletRemaining === 0 && tripletSavedSpeed !== null) {
          speed = tripletSavedSpeed;
          tripletSavedSpeed = null;
        }
      }
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex !== cleaned.length) {
    console.error(`Unexpected token at position ${lastIndex}: "${cleaned.slice(lastIndex)}"`);
  }
  return notes;
}

export const decodeNoteExpresssion = (s: string, previousNote: SongNote, defaultNoteGourp: number, keyNote: Note, keyNoteGroup: NoteGroup, measure: SongMeasure) => {
  if (s === '-') {
    previousNote.ends = false;
    const tied = new SongNote({measure, note: previousNote.note, noteGroup: previousNote.noteGroup, starts: false});
    tied.degree = previousNote.degree;
    tied.accidental = previousNote.accidental;
    tied.octaveShift = previousNote.octaveShift;
    return tied;
  } else if (s === 'x') {
    return new SongNote({measure, silent: true});
  } else {
    let i = 0;
    let octaveShift = 0;
    while (s[i] === 'v') {octaveShift--; i++;}
    while (s[i] === '^') {octaveShift++; i++;}

    const degree = parseInt(s[i++]);
    let accidental = 0;
    if (s[i] === '#') accidental = 1;
    else if (s[i] === 'b') accidental = -1;

    const keyMIDI = note2midi(`${keyNote}${keyNoteGroup}`);
    const noteMIDI = keyMIDI + (defaultNoteGourp + octaveShift - keyNoteGroup) * 12 + IONIC_SEMITONES[degree - 1] + accidental;

    const noteStr = midi2note(noteMIDI);
    const note = noteStr.slice(0, -1) as Note;
    const noteGroup = parseInt(noteStr.slice(-1)) as NoteGroup;

    const songNote = new SongNote({measure, note, noteGroup});
    songNote.degree = degree;
    songNote.accidental = accidental;
    songNote.octaveShift = octaveShift;
    return songNote;
  }
}



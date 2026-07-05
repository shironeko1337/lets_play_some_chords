import {Song, SongNote} from "../model/quiz";

const BAR_H = 8;
const LOG_PAD = 8;
const VISIBLE_DURATION = 3; // seconds of lookahead window

const START_OPACITY = 0.1;
const END_OPACITY = 0.9;
const START_RADIUS = 400;
const END_RADIUS = 100;
const DISAPPEAR_DURATION = 0.2; // seconds
const QUATER_NOTE_SECTOR_RATIO = 1 / 4; // how much space would a quarter note take in the center sectors

// fill colors indexed by scale degree 1-7
// 1, 3, 6 — warm light;  2, 4 — cold light;  5, 7 — dark
const DEGREE_COLORS = [
  '#3b82f6', // 0  fallback (no degree)
  '#fde68a', // 1  warm amber
  '#93c5fd', // 2  cool sky blue
  '#fdba74', // 3  warm peach
  '#c4b5fd', // 4  cool lavender
  '#1e40af', // 5  dark deep blue
  '#fda4af', // 6  warm rose
  '#7c3aed', // 7  dark violet
] as const;

// text colors that contrast with each degree's fill
const DEGREE_TEXT_COLORS = [
  '#ffffff', // 0  fallback
  '#374151', // 1  dark on amber
  '#374151', // 2  dark on sky blue
  '#374151', // 3  dark on peach
  '#374151', // 4  dark on lavender
  '#ffffff', // 5  white on deep blue
  '#374151', // 6  dark on rose
  '#ffffff', // 7  white on violet
] as const;

function degreeColor(degree: number | undefined): string {
  return (degree !== undefined && degree >= 1 && degree <= 7) ? DEGREE_COLORS[degree] : DEGREE_COLORS[0];
}

function degreeTextColor(degree: number | undefined): string {
  return (degree !== undefined && degree >= 1 && degree <= 7) ? DEGREE_TEXT_COLORS[degree] : DEGREE_TEXT_COLORS[0];
}

export type EaseFn = (t: number) => number;

type SongContext = {
  song: Song
  progress: number
  time: number
  activatedMeasuresRange: [number, number]
  visibleDuration: number
}

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ms).padStart(3, '0')}`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export class QuizCanvas {
  private canvas!: HTMLCanvasElement;
  private rafId?: number;
  private song!: Song;
  private _lastLoggedNote: SongNote | null = null;

  ease: EaseFn = (t) => t;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    if (canvas.width !== canvas.offsetWidth) canvas.width = canvas.offsetWidth;
    const ctx = canvas.getContext('2d')!;
    const {width, height} = canvas;
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, width, BAR_H);
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, BAR_H, width, height - BAR_H);
  }

  private drawFrame(context: SongContext) {
    if (this.canvas.width !== this.canvas.offsetWidth) this.canvas.width = this.canvas.offsetWidth;
    const ctx = this.canvas.getContext('2d')!;
    const {width, height} = this.canvas;
    this.renderProgressBar(context);
    ctx.clearRect(0, BAR_H, width, height - BAR_H);
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, BAR_H, width, height - BAR_H);
    this.renderNotes(context);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#374151';
    ctx.textBaseline = 'top';
    ctx.fillText(formatTime(context.time), LOG_PAD, BAR_H + LOG_PAD);
    this.logCurrentNote(context);
  }

  private logCurrentNote(context: SongContext) {
    const note = getCurrentNote(context.song, context.time);
    if (!note || note === this._lastLoggedNote) return;
    this._lastLoggedNote = note;
    const acc = note.accidental === 1 ? '#' : note.accidental === -1 ? 'b' : '';
    const oct = note.octaveShift
      ? (note.octaveShift > 0 ? '^'.repeat(note.octaveShift) : 'v'.repeat(-note.octaveShift))
      : '';
    const jianpu = `${oct}${note.degree ?? '?'}${acc}`;
    const noteName = note.note ? `${note.note}${note.noteGroup}` : '?';
    console.log(`[note] ${jianpu}  (${noteName})`);
  }

  update(song: Song, getProgress: () => number, getTime: () => number) {
    this.song = song;
    this._lastLoggedNote = null;
    const frame = () => {
      const progress = getProgress();
      const time = getTime();
      const context: SongContext = {song, progress, time, activatedMeasuresRange: [0, 0], visibleDuration: VISIBLE_DURATION};
      context.activatedMeasuresRange = getCurrentActivatedMeasure(song, context);
      this.drawFrame(context);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  renderProgressBar(context: SongContext) {
    const ctx = this.canvas.getContext('2d')!;
    const {width} = this.canvas;
    ctx.clearRect(0, 0, width, BAR_H);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, width, BAR_H);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, Math.round(width * context.progress), BAR_H);
  }

  /** Iterates visible notes and delegates drawing to renderNote — does not touch the canvas directly. */
  renderNotes(context: SongContext) {
    const [first, last] = context.activatedMeasuresRange;
    const notes: SongNote[] = [];
    for (const section of this.song.sections) {
      for (const measure of section.measures) {
        if (measure.index < first || measure.index > last) continue;
        for (const note of measure.notes) {
          if (!note.silent) notes.push(note);
        }
      }
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      this.renderNote(notes[i], context);
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      this.renderSectorFill(notes[i], context);
    }
    this.renderBaseRing();
    for (let i = notes.length - 1; i >= 0; i--) {
      this.renderNoteText(notes[i], context);
    }
  }

  renderNote(note: SongNote, context: SongContext) {
    if (note.startTs === undefined || note.silent) return;

    const scale = (note.startTs - context.time) / context.visibleDuration;

    let opacity: number;
    let radius: number;

    if (scale > 1) {
      // not yet in the visible window
      return;
    } else if (scale > 0) {
      // approaching: scale goes 1 → 0 as note nears current time
      const t = this.ease(scale);
      opacity = lerp(END_OPACITY, START_OPACITY, t);
      radius = lerp(END_RADIUS, START_RADIUS, t);
    } else {
      // disappear phase: scale goes 0 → -(DISAPPEAR_DURATION / visibleDuration)
      const t = (-scale * context.visibleDuration) / DISAPPEAR_DURATION;
      if (t >= 1) return;
      opacity = END_OPACITY * (1 - t);
      radius = END_RADIUS * (1 - t);
    }

    const ctx = this.canvas.getContext('2d')!;
    const cx = this.canvas.width / 2;
    const cy = BAR_H + (this.canvas.height - BAR_H) / 2;

    ctx.save();
    ctx.globalAlpha = Math.max(0, opacity);

    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, radius), 0, Math.PI * 2);
    ctx.fillStyle = degreeColor(note.degree);
    ctx.fill();

    if (note.starts !== false) {
      const borderOpacity = scale > 0
        ? lerp(0.5, 1.0, 1 - this.ease(scale))
        : END_OPACITY * (1 - (-scale * context.visibleDuration) / DISAPPEAR_DURATION);
      ctx.globalAlpha = Math.max(0, borderOpacity);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderBaseRing() {
    const ctx = this.canvas.getContext('2d')!;
    const cx = this.canvas.width / 2;
    const cy = BAR_H + (this.canvas.height - BAR_H) / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, END_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  private circleRadius(note: SongNote, context: SongContext): number | null {
    if (note.startTs === undefined || note.silent) return null;
    const scale = (note.startTs - context.time) / context.visibleDuration;
    if (scale > 1) return null;
    if (scale > 0) return lerp(END_RADIUS, START_RADIUS, this.ease(scale));
    const t = (-scale * context.visibleDuration) / DISAPPEAR_DURATION;
    if (t >= 1) return null;
    return END_RADIUS * (1 - t);
  }

  renderNoteText(note: SongNote, context: SongContext) {
    const TEXT_BORDER_DISTANCE = 10;
    if (note.degree === undefined) return;
    const radius = this.circleRadius(note, context);
    if (radius === null) return;

    const scale = (note.startTs! - context.time) / context.visibleDuration;
    const opacity = scale > 0
      ? lerp(END_OPACITY, START_OPACITY, this.ease(scale))
      : END_OPACITY * (1 - (-scale * context.visibleDuration) / DISAPPEAR_DURATION);

    const ctx = this.canvas.getContext('2d')!;
    const cx = this.canvas.width / 2;
    const cy = BAR_H + (this.canvas.height - BAR_H) / 2;

    ctx.save();
    ctx.globalAlpha = Math.max(0, opacity);

    const fontSize = 16;
    const textTop = cy - radius + TEXT_BORDER_DISTANCE; // 2px below the top of the circle border
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = degreeTextColor(note.degree);
    const label = String(note.degree) + (note.accidental === 1 ? '#' : note.accidental === -1 ? 'b' : '');
    ctx.fillText(label, cx, textTop);

    if (note.octaveShift) {
      const dotR = 2;
      const dotGap = dotR * 3;
      const shifts = Math.abs(note.octaveShift);
      const dotBaseY = note.octaveShift > 0
        ? textTop - dotR * 3
        : textTop + fontSize + dotR * 2;
      ctx.fillStyle = degreeTextColor(note.degree);
      for (let d = 0; d < shifts; d++) {
        const dotX = cx - ((shifts - 1) * dotGap) / 2 + d * dotGap;
        ctx.beginPath();
        ctx.arc(dotX, dotBaseY, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private sectorAngles(note: SongNote, context: SongContext): {startAngle: number; endAngle: number; progress: number; opacity: number} | null {
    if (note.startTs === undefined) return null;
    const DURATION = 60 / note.measure.bpm / QUATER_NOTE_SECTOR_RATIO;
    const ANGLE = Math.PI * 2 * QUATER_NOTE_SECTOR_RATIO / note.speed;
    const progress = 1 - (note.startTs - context.time) / DURATION;
    const fullyPassedProgress = -60 / note.measure.bpm / note.speed / DURATION;

    if (progress < fullyPassedProgress || progress >= 1) return null;
    const endAngle = Math.PI * 3 / 2 + progress * Math.PI * 2;
    const opacity = (progress - fullyPassedProgress) / (1 - fullyPassedProgress);
    return {startAngle: endAngle - ANGLE, endAngle, progress, opacity};
  }

  renderSectorFill(note: SongNote, context: SongContext) {
    const angles = this.sectorAngles(note, context);
    if (!angles) return;
    const {startAngle, endAngle, opacity} = angles;
    const ctx = this.canvas.getContext('2d')!;
    const cx = this.canvas.width / 2;
    const cy = BAR_H + (this.canvas.height - BAR_H) / 2;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, END_RADIUS, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = degreeColor(note.degree);
    ctx.fill();
    ctx.restore();
  }

  renderSectorDecorations(note: SongNote, context: SongContext) {
    const angles = this.sectorAngles(note, context);
    if (!angles) return;
    const {startAngle, endAngle} = angles;
    const ctx = this.canvas.getContext('2d')!;
    const cx = this.canvas.width / 2;
    const cy = BAR_H + (this.canvas.height - BAR_H) / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;

    // arc border — always
    ctx.beginPath();
    ctx.arc(cx, cy, END_RADIUS, startAngle, endAngle);
    ctx.stroke();

    // leading radial border (endAngle edge, hits 12:00 first) — when note starts
    if (note.starts) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + END_RADIUS * Math.cos(endAngle), cy + END_RADIUS * Math.sin(endAngle));
      ctx.stroke();
    }

    // trailing radial border (startAngle edge) — when note ends
    if (note.ends) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + END_RADIUS * Math.cos(startAngle), cy + END_RADIUS * Math.sin(startAngle));
      ctx.stroke();
    }

    ctx.restore();
  }

  stop() {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
  }
}

function getCurrentNote(song: Song, time: number): SongNote | null {
  let best: SongNote | null = null;
  for (const section of song.sections) {
    for (const measure of section.measures) {
      for (const note of measure.notes) {
        if (note.silent || note.startTs === undefined) continue;
        if (note.startTs <= time && (!best || note.startTs > best.startTs!)) best = note;
      }
    }
  }
  return best;
}

/**
 * Get the index of the first and last activated measures, the current
 * measure is the measure of the note that hasn't finished, the last activated measure
 * is either the last measure or have at least one note that will be
 * activated after `visibleDuration` time since now.
 */
function getCurrentActivatedMeasure(song: Song, context: SongContext): [number, number] {
  let t = 0;
  let first = 0;
  let last = 0;
  let foundFirst = false;

  for (const section of song.sections) {
    for (const measure of section.measures) {
      const duration = measure.quaterNoteCount * 60 / section.bpm;
      const end = t + duration;

      // first: the earliest measure whose end is still ahead of context.time
      if (!foundFirst && context.time < end) {
        first = measure.index;
        foundFirst = true;
      }

      // last: the furthest measure that starts before the lookahead window closes
      if (t < context.time + context.visibleDuration) {
        last = measure.index;
      }

      t = end;
    }
  }

  // clamp first to final measure when time is past the end of the song
  if (!foundFirst) first = song.measureCount - 1;

  return [first, last];
}

import React, {useEffect, useRef, useState} from 'react';
import {ChordStream, } from './model/chord_stream';
import type {SoundStream} from './model/sound_stream';
import {getPitchLevel, NOTES, type Note, type NoteGroup} from './util';

type Props = {
  soundStream: SoundStream;
  isStreaming?: boolean;
  onClickNote?: (note: Note, group: NoteGroup) => void;
};

const NOTE_GROUPS: NoteGroup[] = [1, 2, 3, 4, 5, 6, 7];
const IONIAN_SEMITONES = new Set([0, 2, 4, 5, 7, 9, 11]);
const KEY_CHORD_SEMITONES = new Set([0]);

const GAP = 0;
const RECT_H = 100;
const LABEL_H = 20;
const FREQ_BAR_H = 80;
const FREQ_BAR_GAP = -10;
const MAX_CUR_FREQ_MARK_WIDTH = 10;
const OVERLAY_BORDER_W = 2;

function noteToRectIdx(noteStr: string, noteGroup: NoteGroup): number | null {
  const match = noteStr.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;
  const noteIdx = NOTES.indexOf(match[1] as Note);
  if (noteIdx === -1) return null;
  const octave = parseInt(match[2]);
  const octaveOffset = octave - (noteGroup - 1);
  if (octaveOffset < 0 || octaveOffset > 2) return null;
  return octaveOffset * 12 + noteIdx;
}

function noteToFreq(noteStr: string): number {
  const match = noteStr.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return -1;
  const noteIdx = NOTES.indexOf(match[1] as Note);
  if (noteIdx === -1) return -1;
  const octave = parseInt(match[2]);
  const midi = (octave + 1) * 12 + noteIdx;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function drawScale(ctx: CanvasRenderingContext2D, rootNote: Note, rectW: number, canvasW: number, opacities: Float32Array) {
  ctx.clearRect(0, 0, canvasW, RECT_H);
  const rootIdx = NOTES.indexOf(rootNote);

  for (let i = 0; i < 36; i++) {
    const noteIdx = i % 12;
    const semiFromRoot = ((noteIdx - rootIdx) + 12) % 12;
    const isKeyNote = KEY_CHORD_SEMITONES.has(semiFromRoot);
    const isInScale = IONIAN_SEMITONES.has(semiFromRoot);
    const x = i * (rectW + GAP);

    ctx.globalAlpha = opacities[i];
    ctx.fillStyle = isKeyNote ? '#fb2c36' : isInScale ? '#000' : '#fff';
    ctx.fillRect(x, 0, rectW, RECT_H);
  }
  ctx.globalAlpha = 1;
}

function drawFreqBar(ctx: CanvasRenderingContext2D, centerFreq: number, currentFreq: number, canvasW: number, lineWidth = 2) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasW, FREQ_BAR_H);

  if (centerFreq <= 0) return;

  const minFreq = centerFreq * 0.88;
  const maxFreq = centerFreq * 1.12;

  ctx.fillStyle = '#00ff41';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';

  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const freq = minFreq + t * (maxFreq - minFreq);
    const x = Math.round(t * canvasW);

    ctx.fillRect(x, 0, 1, 6);
    ctx.fillText(`${freq.toFixed(1)}`, x, FREQ_BAR_H - 6);
  }

  if (currentFreq > 0) {
    const t = (currentFreq - minFreq) / (maxFreq - minFreq);
    const x = Math.round(t * canvasW);
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FREQ_BAR_H);
    ctx.stroke();
  }
}

// Runs a RAF loop that lerps freq and loudness toward their targets, calling `onDraw` every frame.
// `onDraw` is always called with the latest closure (reads canvasW, detectedNote, etc. fresh).
function useSmoothDraw(
  target: number,
  loudnessRef: {current: number},
  onDraw: (smoothedFreq: number, smoothedLoudness: number) => void,
  factor = 0.12,
) {
  const targetRef = useRef(-1);
  const currentRef = useRef(-1);
  const smoothedLoudnessRef = useRef(0);
  const onDrawRef = useRef(onDraw);
  onDrawRef.current = onDraw;

  useEffect(() => {
    if (target > 0 && currentRef.current < 0) currentRef.current = target; // snap on first valid
    if (target <= 0) {currentRef.current = -1; smoothedLoudnessRef.current = 0;}
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      if (currentRef.current > 0 && targetRef.current > 0) {
        currentRef.current += (targetRef.current - currentRef.current) * factor;
      }
      smoothedLoudnessRef.current += (loudnessRef.current - smoothedLoudnessRef.current) * factor;
      onDrawRef.current(currentRef.current, smoothedLoudnessRef.current);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [factor, loudnessRef]);
}

export const ChordStreamVisualizer = ({soundStream, isStreaming = false, onClickNote}: Props) => {
  const chordStreamRef = useRef<ChordStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const freqCanvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [detectedNote, setDetectedNote] = useState<string>('');
  const [detectedFreq, setDetectedFreq] = useState<number>(-1);
  const detectedLoudnessPctRef = useRef(0)
  const maxDetectedLoudness = useRef(0)
  const [rootNote, setRootNote] = useState<Note>('C');
  const [noteGroup, setNoteGroup] = useState<NoteGroup>(3);
  const [canvasW, setCanvasW] = useState(0);

  // Keep canvas sized to container
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setCanvasW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const chordStream = new ChordStream();
    chordStream.onTick = (stream: ChordStream) => {
      setDetectedNote(stream.lastestDetectedNote);
      if (stream.lastestDetectedNoteBufferMean) {
        maxDetectedLoudness.current = Math.max(maxDetectedLoudness.current, stream.lastestDetectedNoteBufferMean,)
        detectedLoudnessPctRef.current = stream.lastestDetectedNoteBufferMean / maxDetectedLoudness.current
      }
      setDetectedFreq(stream.lastestDetectedNoteMajorFrequency);
    };
    chordStreamRef.current = chordStream;
    soundStream.chordStream = chordStream;
    chordStream.start();

    return () => {
      chordStream.stop();
      soundStream.chordStream = undefined;
    };
  }, [soundStream]);

  useEffect(() => {
    const chordStream = chordStreamRef.current;
    if (!chordStream) return;
    chordStream.load(soundStream.config as any);
  }, [soundStream]);

  const step = canvasW > 0 ? (canvasW + GAP) / 36 : GAP + 20;
  const rectW = step - GAP;

  const rectOpacitiesRef = useRef(new Float32Array(36).fill(1));
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;
  const rootNoteRef = useRef(rootNote);
  rootNoteRef.current = rootNote;
  const canvasWRef = useRef(canvasW);
  canvasWRef.current = canvasW;

  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayCurrentXRef = useRef<number | null>(null);
  const hadNoteRef = useRef(false);
  const detectedNoteRef = useRef(detectedNote);
  detectedNoteRef.current = detectedNote;
  const noteGroupRef = useRef(noteGroup);
  noteGroupRef.current = noteGroup;
  const stepRef = useRef(step);
  stepRef.current = step;
  const rectWRef = useRef(rectW);
  rectWRef.current = rectW;

  // Animate per-rect opacity and redraw scale canvas every frame
  useEffect(() => {
    const LERP = 0.1; // ~0.5s transition at 60fps
    let rafId: number;
    const tick = () => {
      const canvas = canvasRef.current;
      const w = canvasWRef.current;
      if (canvas && w > 0) {
        if (canvas.width !== w) canvas.width = w;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const streaming = isStreamingRef.current;
          const activeIdx = streaming && detectedNoteRef.current
            ? noteToRectIdx(detectedNoteRef.current, noteGroupRef.current)
            : null;
          const opacities = rectOpacitiesRef.current;
          for (let i = 0; i < 36; i++) {
            const target = !streaming ? 1 : (i === activeIdx ? 1 : 0.5);
            opacities[i] += (target - opacities[i]) * LERP;
          }
          drawScale(ctx, rootNoteRef.current, rectWRef.current, w, opacities);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const overlay = overlayRef.current;
      const note = detectedNoteRef.current;
      if (!overlay || !note) {
        hadNoteRef.current = false;
        overlayCurrentXRef.current = null;
        if (overlay) overlay.style.display = 'none';
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Compute target x — clamp out-of-range notes to nearest edge
      const rw = rectWRef.current;
      const s = stepRef.current;
      const ng = noteGroupRef.current;
      const rectIdx = noteToRectIdx(note, ng);
      let targetX: number;
      if (rectIdx !== null) {
        targetX = rectIdx * s;
      } else {
        // Note is out of range: find which side and clamp
        const match = note.match(/^([A-G]#?)(-?\d+)$/);
        if (!match) {rafId = requestAnimationFrame(tick); return;}
        const octave = parseInt(match[2]);
        targetX = octave < ng - 1 ? 0 : 35 * s;
      }

      if (!hadNoteRef.current || overlayCurrentXRef.current === null) {
        overlayCurrentXRef.current = 0;
        hadNoteRef.current = true;
      }
      overlayCurrentXRef.current += (targetX - overlayCurrentXRef.current) * 0.15;
      overlay.style.display = 'block';
      overlay.style.left = `${overlayCurrentXRef.current - OVERLAY_BORDER_W}px`;
      overlay.style.width = `${rw}px`;

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useSmoothDraw(detectedFreq, detectedLoudnessPctRef, (smoothedFreq, smoothedLoudness) => {
    const canvas = freqCanvasRef.current;
    if (!canvas || canvasW === 0) return;
    if (canvas.width !== canvasW) canvas.width = canvasW;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const centerFreq = detectedNote ? noteToFreq(detectedNote) : -1;
    const lineWidth = Math.max(1, smoothedLoudness * MAX_CUR_FREQ_MARK_WIDTH);
    drawFreqBar(ctx, centerFreq, smoothedFreq, canvasW, lineWidth);
  });

  const pitchLevel = detectedNote ? getPitchLevel(detectedNote, rootNote, noteGroup) : null;
  const currentLog = detectedNote
    ? `Latest detected note: ${detectedNote} of frequency ${detectedFreq} with pitch level ${pitchLevel![0]} octave ${pitchLevel![1]} for base note ${rootNote}${noteGroup}`
    : 'No note detected';

  return (
    <>
      <div className="flex items-center gap-3 font-mono text-sm">
        <label>Key:</label>
        <select
          value={rootNote}
          onChange={e => setRootNote(e.target.value as Note)}
          className="border rounded px-2 py-1"
        >
          {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={noteGroup}
          onChange={e => setNoteGroup(parseInt(e.target.value) as NoteGroup)}
          className="border rounded px-2 py-1"
        >
          {NOTE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div
        ref={wrapperRef}
        style={{position: 'relative', width: '100%', height: RECT_H, overflow: 'hidden', cursor: onClickNote ? 'pointer' : 'default'}}
        onClick={onClickNote ? (e) => {
          const rect = wrapperRef.current!.getBoundingClientRect();
          const i = Math.floor((e.clientX - rect.left) / step);
          if (i < 0 || i >= 36) return;
          const octave = Math.floor(i / 12) + (noteGroup - 1);
          onClickNote(NOTES[i % 12], octave as NoteGroup);
        } : undefined}
      >
        <canvas
          ref={canvasRef}
          height={RECT_H}
          style={{position: 'absolute', top: 0, left: 0}}
        />
        <div
          ref={overlayRef}
          style={{
            display: 'none',
            position: 'absolute',
            top: -OVERLAY_BORDER_W,
            width: rectW,
            height: RECT_H,
            boxSizing: 'content-box',
            border: `${OVERLAY_BORDER_W}px solid black`,
            background: 'rgba(0,255,65,.2)',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />
        {Array.from({length: 36}, (_, i) => {
          const octave = Math.floor(i / 12) + (noteGroup - 1);
          const noteIdx = i % 12;
          const semiFromRoot = ((noteIdx - NOTES.indexOf(rootNote)) + 12) % 12;
          const inScale = IONIAN_SEMITONES.has(semiFromRoot);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: i * step,
                top: RECT_H - 14 - 16,
                width: rectW,
                height: LABEL_H,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                zIndex: 1,
              }}
            >
              <span style={{fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold', color: inScale ? '#fff' : '#000', whiteSpace: 'nowrap'}}>
                {NOTES[noteIdx]}{octave}
              </span>
            </div>
          );
        })}
      </div>

      <canvas
        ref={freqCanvasRef}
        height={FREQ_BAR_H}
        style={{display: 'block', marginTop: FREQ_BAR_GAP}}
      />

      <div className="font-mono text-sm text-gray-700 bg-gray-100 rounded-lg p-3">
        <span>{currentLog}</span>
      </div>
    </>
  );
};

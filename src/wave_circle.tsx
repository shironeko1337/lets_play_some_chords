import {useEffect, useRef, useState} from "react";
import * as Tone from "tone";

type IntervalOption = {
  semitones: number;
  noteName: string;
  label: string;
  // [p, q] — the note completes p cycles while the tonic completes q cycles per loop (lowest-terms 5-limit just intonation, not the tempered pitch actually played)
  ratio: [number, number];
};

// Diatonic (natural major) scale degrees only, tonic excluded — comparing tonic against itself is a degenerate, identical-wave case
const INTERVALS: IntervalOption[] = [
  {semitones: 2, noteName: "D4", label: "Major 2nd", ratio: [9, 8]},
  {semitones: 4, noteName: "E4", label: "Major 3rd", ratio: [5, 4]},
  {semitones: 5, noteName: "F4", label: "Perfect 4th", ratio: [4, 3]},
  {semitones: 7, noteName: "G4", label: "Perfect 5th", ratio: [3, 2]},
  {semitones: 9, noteName: "A4", label: "Major 6th", ratio: [5, 3]},
  {semitones: 11, noteName: "B4", label: "Major 7th", ratio: [15, 8]},
  {semitones: 12, noteName: "C5", label: "Octave", ratio: [2, 1]},
];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

// The tonic must loop a shared multiple of every note's own tonic-side count (q), so its drawn wave
// is pixel-identical across every selection — this is the smallest number that works for all of them.
const TONIC_LOOPS = INTERVALS.map(i => i.ratio[1]).reduce(lcm, 1);

const BASE_RADIUS = 160;
const RING_AMPLITUDE = 34;
const TONIC_COLOR = "#3b82f6";
const NOTE_COLOR = "#f97316";
const POINT_RADIUS = 7;
const ANGLE_OFFSET = -Math.PI / 2; // rotate so t=0 renders at 12 o'clock instead of 3 o'clock

const TONIC_HZ = 256; // C4 — change here to retune the reference pitch
const SPEED_MIN = 0;
const SPEED_MAX = 2;
const SPEED_STEP = 0.001;
const DEFAULT_SPEED = 0.05;

// Same four types Tone.Oscillator accepts — reused directly as the audio oscillator's `type`
type WaveShape = "sine" | "square" | "triangle" | "sawtooth";
const WAVE_SHAPES: WaveShape[] = ["sine", "square", "triangle", "sawtooth"];

// All shapes are phase-aligned so they cross their baseline (ascending) at whole-numbered phase,
// matching sine — otherwise the feature points would no longer visually mark "both waves at rest"
const waveValue = (shape: WaveShape, phase: number): number => {
  const x = phase - Math.floor(phase);
  switch (shape) {
    case "square":
      return x < 0.5 ? 1 : -1;
    case "triangle":
      if (x < 0.25) return 4 * x;
      if (x < 0.75) return 2 - 4 * x;
      return 4 * x - 4;
    case "sawtooth":
      return x < 0.5 ? 2 * x : 2 * x - 2;
    default:
      return Math.sin(x * Math.PI * 2);
  }
};

const wavePosition = (cx: number, cy: number, t: number, cycles: number, shape: WaveShape) => {
  const theta = t * Math.PI * 2 + ANGLE_OFFSET;
  const r = BASE_RADIUS + RING_AMPLITUDE * waveValue(shape, cycles * t);
  return {x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta)};
};

export const WaveCircle = () => {
  const [semitones, setSemitones] = useState(7);
  const [showWavePoint, setShowWavePoint] = useState(false);
  const [playTonicSound, setPlayTonicSound] = useState(false);
  const [playNoteSound, setPlayNoteSound] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [waveShape, setWaveShape] = useState<WaveShape>("triangle");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speedRef = useRef(speed);
  const rafRef = useRef<number | undefined>(undefined);
  const tonicOscRef = useRef<Tone.Oscillator | null>(null);
  const noteOscRef = useRef<Tone.Oscillator | null>(null);

  const waveShapeRef = useRef(waveShape);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    waveShapeRef.current = waveShape;
  }, [waveShape]);

  const interval = INTERVALS.find(i => i.semitones === semitones)!;
  const [p, q] = interval.ratio;
  const noteLoops = (TONIC_LOOPS / q) * p;
  const featurePoints = TONIC_LOOPS / q;

  const render = (pointT?: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(cx, cy, BASE_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = "#d1d5db";
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    const samples = Math.max(4000, Math.max(TONIC_LOOPS, noteLoops) * 20);

    const drawWave = (cycles: number, color: string) => {
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const {x, y} = wavePosition(cx, cy, i / samples, cycles, waveShape);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    drawWave(TONIC_LOOPS, TONIC_COLOR);
    drawWave(noteLoops, NOTE_COLOR);

    ctx.fillStyle = "#111827";
    for (let k = 0; k < featurePoints; k++) {
      const theta = (k / featurePoints) * Math.PI * 2 + ANGLE_OFFSET;
      const x = cx + BASE_RADIUS * Math.cos(theta);
      const y = cy + BASE_RADIUS * Math.sin(theta);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (pointT !== undefined) {
      const drawPoint = (cycles: number, color: string) => {
        const {x, y} = wavePosition(cx, cy, pointT, cycles, waveShape);
        ctx.beginPath();
        ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      };
      drawPoint(TONIC_LOOPS, TONIC_COLOR);
      drawPoint(noteLoops, NOTE_COLOR);
    }
  };

  // static picture whenever the note or wave shape changes and the point isn't animating
  useEffect(() => {
    if (!showWavePoint) render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semitones, showWavePoint, waveShape]);

  // wave point animation — always restarts from 12 o'clock when (re)enabled
  useEffect(() => {
    if (!showWavePoint) return;
    let phase = 0;
    let lastTime: number | null = null;

    const tick = (time: number) => {
      if (lastTime === null) lastTime = time;
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      const effectiveTonicHz = TONIC_HZ * speedRef.current;
      phase = (phase + (dt * effectiveTonicHz) / TONIC_LOOPS) % 1;
      render(phase);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      render();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWavePoint, semitones, waveShape]);

  // audible tone for the tonic
  useEffect(() => {
    if (!playTonicSound) return;
    let cancelled = false;
    (async () => {
      await Tone.start();
      if (cancelled) return;
      tonicOscRef.current = new Tone.Oscillator(TONIC_HZ * speedRef.current, waveShapeRef.current).toDestination().start();
    })();
    return () => {
      cancelled = true;
      tonicOscRef.current?.stop().dispose();
      tonicOscRef.current = null;
    };
  }, [playTonicSound]);

  // audible tone for the selected note
  useEffect(() => {
    if (!playNoteSound) return;
    let cancelled = false;
    (async () => {
      await Tone.start();
      if (cancelled) return;
      noteOscRef.current = new Tone.Oscillator(TONIC_HZ * (p / q) * speedRef.current, waveShapeRef.current).toDestination().start();
    })();
    return () => {
      cancelled = true;
      noteOscRef.current?.stop().dispose();
      noteOscRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playNoteSound, semitones]);

  // live pitch/timbre update as the speed slider, note, or wave shape changes while sound is on
  useEffect(() => {
    if (tonicOscRef.current) {
      tonicOscRef.current.frequency.value = TONIC_HZ * speed;
      tonicOscRef.current.type = waveShape;
    }
    if (noteOscRef.current) {
      noteOscRef.current.frequency.value = TONIC_HZ * (p / q) * speed;
      noteOscRef.current.type = waveShape;
    }
  }, [speed, semitones, p, q, waveShape]);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center gap-3">
        <select
          value={semitones}
          onChange={e => setSemitones(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
        >
          {INTERVALS.map(i => (
            <option key={i.semitones} value={i.semitones}>
              {i.noteName} — {i.label} ({i.ratio[0]}:{i.ratio[1]})
            </option>
          ))}
        </select>
        <select
          value={waveShape}
          onChange={e => setWaveShape(e.target.value as WaveShape)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
        >
          {WAVE_SHAPES.map(shape => (
            <option key={shape} value={shape}>
              {shape[0].toUpperCase() + shape.slice(1)} wave
            </option>
          ))}
        </select>
      </div>
      <canvas ref={canvasRef} width={480} height={480} className="rounded-lg bg-gray-50" />
      <div className="flex flex-col items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={showWavePoint} onChange={e => setShowWavePoint(e.target.checked)} />
          Show wave point
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={playTonicSound} onChange={e => setPlayTonicSound(e.target.checked)} />
          Play tonic sound (C4 = {TONIC_HZ}Hz)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={playNoteSound} onChange={e => setPlayNoteSound(e.target.checked)} />
          Play {interval.noteName} sound
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Speed {speed.toFixed(3)}×
          <input
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={SPEED_STEP}
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="w-[640px] max-w-[90vw]"
          />
        </label>
      </div>
      <p className="text-sm text-gray-600">
        Tonic (C4, <span style={{color: TONIC_COLOR}}>blue</span>) always loops {TONIC_LOOPS} times — the same every
        time you change the note. {interval.noteName} (<span style={{color: NOTE_COLOR}}>orange</span>) loops{" "}
        {noteLoops} times, realigning with the tonic at {featurePoints} evenly-spaced points (marked in black).
      </p>
    </div>
  );
};

import {midi2freq, note2midi} from './util';
import type {Note, NoteGroup} from './util';

export type OscillatorInstrument = OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'
export const OSCILLATOR_INSTRUMENTS: OscillatorInstrument[] = ['sine', 'square', 'sawtooth', 'triangle'];

const MAJOR_CHORD_OFFSETS = [0, 4, 7];

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  return _ctx;
}

export function playChord(
  note: Note,
  group: NoteGroup,
  instrument: OscillatorInstrument = 'sine',
  duration = 1.5,
) {
  const ctx = getCtx();
  ctx.resume();
  const now = ctx.currentTime;
  const rootMidi = note2midi(`${note}${group}`);

  MAJOR_CHORD_OFFSETS.forEach(offset => {
    const freq = midi2freq(rootMidi + offset);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = instrument;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  });
}

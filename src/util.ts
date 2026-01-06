export const NOTES = [
  "C",
  "#C",
  "D",
  "#D",
  "E",
  "F",
  "#F",
  "G",
  "#G",
  "A",
  "#A",
  "B",
];

export const note2midi = (note: string) => {
  return (
    (note.charCodeAt(note.length - 1) - 47) * 12 +
    NOTES.indexOf(note.substring(0, note.length - 1))
  );
};

export const midi2note = (index: number) => {
  return `${NOTES[index % 12]}${Math.floor(index / 12 + 0.001) + 1}`;
};

export const midi2freq = (index: number) => {
  return 440 * Math.pow(2, (index - 69) / 12);
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

export function playNote(
  ctx: AudioContext,
  {
    noteMIDI,
    duration = 0.6,
    type = "sawtooth",
    attack = 0.01,
    release = 0.12,
    volume = 0.2,
  }: any
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = midi2freq(noteMIDI);
  console.log(noteMIDI, osc.frequency.value);

  // Simple pluck-ish envelope to avoid clicks
  const now = ctx.currentTime;
  const decay = 0.15;
  const sustain = 0.25;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(1.0, now + attack);
  gain.gain.exponentialRampToValueAtTime(sustain, now + attack + decay);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + release);
  // const osc = ctx.createOscillator();
  // osc.type = type;
  // osc.frequency.value = midi2freq(noteMIDI);
  // console.log(noteMIDI, osc.frequency.value);

  // const gain = ctx.createGain();
  // gain.gain.value = 0;

  // osc.connect(gain).connect(ctx.destination);

  // const t0 = ctx.currentTime;
  // const t1 = t0 + duration;

  // // ADSR-ish
  // gain.gain.setValueAtTime(0, t0);
  // gain.gain.linearRampToValueAtTime(volume, t0 + attack);
  // gain.gain.setValueAtTime(volume, Math.max(t0 + attack, t1 - release));
  // gain.gain.linearRampToValueAtTime(0, t1);

  // osc.start(t0);
  // osc.stop(t1 + 0.02);
}

/**
 * play chord by root midi and chord midi.
 */
export async function playChord(
  ctx: AudioContext,
  { rootMIDI, chordMIDI, duration = 0.8, type = "sine", volume = 0.18 }: any
) {
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const t0 = ctx.currentTime;
  const t1 = t0 + duration;

  for (const dif of chordMIDI) {
    const osc: any = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = midi2freq(rootMIDI + dif);
    console.log(rootMIDI + dif, osc.frequency.value);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.linearRampToValueAtTime(0, t1);

    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

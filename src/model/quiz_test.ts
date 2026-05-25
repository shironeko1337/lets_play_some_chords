import {describe, it, expect, vi} from 'vitest'
import {readFileSync} from 'fs'
import {resolve} from 'path'
import {fileURLToPath} from 'url'

vi.mock('tone', () => ({default: {}, Player: class { }, start: vi.fn(), loaded: vi.fn()}))

import {decodeSongMd} from './quiz'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const mmd = readFileSync(resolve(__dirname, '../../songs/test.mmd'), 'utf-8')

// key=C keyNoteGroup=4 defaultNoteGroup=3
// Degree N at octave G: MIDI = note2midi('C4') + (G-4)*12 + IONIC[N-1]
// IONIC = [0,2,4,5,7,9,11]
// group 3 base=48: 1=C3 2=D3 3=E3 4=F3 5=G3 6=A3 7=B3
// group 2 base=36: 5=G2

type NoteSpec = {note: string; noteGroup: number; speed: number; ends: boolean; silent: boolean; startTs: number; starts: boolean}
const n = (note: string, noteGroup: number, speed: number, ends: boolean, startTs: number, silent = false): NoteSpec =>
  ({note, noteGroup, speed, ends, silent, startTs, starts: true})
const tie = (note: string, noteGroup: number, speed: number, ends: boolean, startTs: number): NoteSpec =>
  ({note, noteGroup, speed, ends, silent: false, startTs, starts: false})

const EXPECTED_MEASURES: NoteSpec[][] = [
  // measure 1: 1---  [bpm=86, q=60/86≈0.6977s, start=0.05]
  [n('C', 3, 1, false, 0.0500), tie('C', 3, 1, false, 0.7477), tie('C', 3, 1, false, 1.4453), tie('C', 3, 1, true, 2.1430)],

  // measure 2: <13>345  [bpm=80, start≈2.8407]
  [n('C', 3, 2, true, 2.8407), n('E', 3, 2, true, 3.2157), n('E', 3, 1, true, 3.5907), n('F', 3, 1, true, 4.3407), n('G', 3, 1, true, 5.0907)],

  // measure 3: <65>---
  [n('A', 3, 2, true, 5.8407), n('G', 3, 2, false, 6.2157), tie('G', 3, 1, false, 6.5907), tie('G', 3, 1, false, 7.3407), tie('G', 3, 1, true, 8.0907)],

  // measure 4: <14>1<21>7
  [n('C', 3, 2, true, 8.8407), n('F', 3, 2, true, 9.2157), n('C', 3, 1, true, 9.5907), n('D', 3, 2, true, 10.3407), n('C', 3, 2, true, 10.7157), n('B', 3, 1, true, 11.0907)],

  // measure 5: <55-3>--
  [n('G', 3, 2, true, 11.8407), n('G', 3, 2, false, 12.2157), tie('G', 3, 2, true, 12.5907), n('E', 3, 2, false, 12.9657), tie('E', 3, 1, false, 13.3407), tie('E', 3, 1, true, 14.0907)],

  // measure 6: <13>234
  [n('C', 3, 2, true, 14.8407), n('E', 3, 2, true, 15.2157), n('D', 3, 1, true, 15.5907), n('E', 3, 1, true, 16.3407), n('F', 3, 1, true, 17.0907)],

  // measure 7: 56-5
  [n('G', 3, 1, true, 17.8407), n('A', 3, 1, false, 18.5907), tie('A', 3, 1, true, 19.3407), n('G', 3, 1, true, 20.0907)],

  // measure 8: <4 3 1 v5 1 v5 1 ->  (v lowers octave by 1: group 3-1=2)
  [
    n('F', 3, 2, true, 20.8407), n('E', 3, 2, true, 21.2157), n('C', 3, 2, true, 21.5907),
    n('G', 2, 2, true, 21.9657), n('C', 3, 2, true, 22.3407), n('G', 2, 2, true, 22.7157),
    n('C', 3, 2, false, 23.0907), tie('C', 3, 2, true, 23.4657),
  ],
]

const CLOSE = 2; // toBeCloseTo precision=2 → threshold < 0.005, well within 0.01

describe('decodeSongMd — startTs for test.mmd', () => {
  const song = decodeSongMd(mmd);
  const m = song.sections[0].measures;

  // shift=0.05; m1 bpm=86 (q=60/86≈0.6977s); m2-m8 bpm=80 (q=0.75s, e=0.375s)
  // m1_start=0.05, m2_start=0.05+4*60/86≈2.8407, m3+=3.0 each

  it('section [A] startTs = shift', () => {
    expect(song.sections[0].sectionStartTs).toBeCloseTo(0.05, CLOSE);
  });

  it('measure start times', () => {
    const expected = [0.0500, 2.8407, 5.8407, 8.8407, 11.8407, 14.8407, 17.8407, 20.8407];
    expected.forEach((ts, i) => expect(m[i].measureStartTs).toBeCloseTo(ts, CLOSE));
  });

  it('measure 1 (1---): q q q q  [bpm=86]', () => {
    const ts = [0.0500, 0.7477, 1.4453, 2.1430];
    ts.forEach((t, i) => expect(m[0].notes[i].startTs).toBeCloseTo(t, CLOSE));
  });

  it('measure 2 (<13>345): e e q q q', () => {
    const ts = [2.8407, 3.2157, 3.5907, 4.3407, 5.0907];
    ts.forEach((t, i) => expect(m[1].notes[i].startTs).toBeCloseTo(t, CLOSE));
  });

  it('measure 3 (<65>---): e e q q q', () => {
    const ts = [5.8407, 6.2157, 6.5907, 7.3407, 8.0907];
    ts.forEach((t, i) => expect(m[2].notes[i].startTs).toBeCloseTo(t, CLOSE));
  });

  it('measure 4 (<14>1<21>7): e e q e e q', () => {
    const ts = [8.8407, 9.2157, 9.5907, 10.3407, 10.7157, 11.0907];
    ts.forEach((t, i) => expect(m[3].notes[i].startTs).toBeCloseTo(t, CLOSE));
  });

  it('measure 5 (<55-3>--): e e e e q q', () => {
    const ts = [11.8407, 12.2157, 12.5907, 12.9657, 13.3407, 14.0907];
    ts.forEach((t, i) => expect(m[4].notes[i].startTs).toBeCloseTo(t, CLOSE));
  });

  it('measure 6 (<13>234): e e q q q', () => {
    const ts = [14.8407, 15.2157, 15.5907, 16.3407, 17.0907];
    ts.forEach((t, i) => expect(m[5].notes[i].startTs).toBeCloseTo(t, CLOSE));
  });

  it('measure 7 (56-5): q q q q', () => {
    const ts = [17.8407, 18.5907, 19.3407, 20.0907];
    ts.forEach((t, i) => expect(m[6].notes[i].startTs).toBeCloseTo(t, CLOSE));
  });

  it('measure 8 (<4 3 1 v5 1 v5 1 ->): e e e e e e e e', () => {
    const ts = [20.8407, 21.2157, 21.5907, 21.9657, 22.3407, 22.7157, 23.0907, 23.4657];
    ts.forEach((t, i) => expect(m[7].notes[i].startTs).toBeCloseTo(t, CLOSE));
  });
});

describe('decodeSongMd — test.mmd', () => {
  const song = decodeSongMd(mmd)

  it('has exactly one section', () => {
    expect(song.sections).toHaveLength(1)
  })

  it('section [A] has correct config', () => {
    const s = song.sections[0]
    expect(s.name).toBe('A')
    expect(s.bpm).toBe(80)
    expect(s.keyNote).toBe('C')
    expect(s.keyNoteGroup).toBe(4)
    expect(s.defaultNoteGroup).toBe(3)
    expect(s.timeSignatureTop).toBe(4)
    expect(s.timeSignatureBottom).toBe(4)
  })

  it('section [A] has 8 measures', () => {
    expect(song.sections[0].measures).toHaveLength(8)
  })

  EXPECTED_MEASURES.forEach((expected, mi) => {
    describe(`measure ${mi + 1}`, () => {
      it('has correct note count', () => {
        expect(song.sections[0].measures[mi].notes).toHaveLength(expected.length)
      })

      it('fills exactly 4 beats', () => {
        const total = song.sections[0].measures[mi].notes.reduce((s, note) => s + 1 / note.speed, 0)
        expect(total).toBeCloseTo(4, 3)
      })

      expected.forEach((exp, ni) => {
        it(`note[${ni}] — ${exp.note}${exp.noteGroup} speed=${exp.speed} ends=${exp.ends} startTs=${exp.startTs}`, () => {
          const got = song.sections[0].measures[mi].notes[ni]
          expect(got.note).toBe(exp.note)
          expect(got.noteGroup).toBe(exp.noteGroup)
          expect(got.speed).toBe(exp.speed)
          expect(got.ends).toBe(exp.ends)
          expect(got.silent).toBe(exp.silent)
          expect(got.starts).toBe(exp.starts)
          expect(got.startTs).toBeCloseTo(exp.startTs, CLOSE)
        })
      })
    })
  })
})

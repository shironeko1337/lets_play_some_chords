import {writeFileSync, mkdirSync} from 'fs';
import {join} from 'path';

const NOTES = [
  {midi: 48, token: 'v1'},
  {midi: 49, token: 'v2b'},
  {midi: 50, token: 'v2'},
  {midi: 51, token: 'v3'},
  {midi: 52, token: 'v3#'},
  {midi: 53, token: 'v4'},
  {midi: 54, token: 'v4#'},
  {midi: 55, token: 'v5'},
  {midi: 56, token: 'v6b'},
  {midi: 57, token: 'v6'},
  {midi: 58, token: 'v7b'},
  {midi: 59, token: 'v7'},
  {midi: 60, token: '1'},
  {midi: 61, token: '2b'}, //
  {midi: 62, token: '2'}, //
  {midi: 63, token: '3'}, //
  {midi: 64, token: '3#'}, //
  {midi: 65, token: '4'}, //
  {midi: 66, token: '4#'}, //
  {midi: 67, token: '5'}, //
  {midi: 68, token: '6b'}, //
  {midi: 69, token: '6'}, //
  {midi: 70, token: '7b'}, //
  {midi: 71, token: '7'}, //
  {midi: 72, token: '^1'}, //
];

const C4_IDX = 7;

// Each group is tried in order; within a group a random valid pattern is picked.
// Patterns are diatonic-index jumps (not semitones).
const PATTERN_GROUPS: number[][][] = [
  [[7, -5], [-5, 7], [-7, 5], [5, -7]], // 4p 5p
  [[3, -3], [-3, 3], [4, -4], [-4, 4]], // 3
  [[8, -8], [-8, 8], [9, -9], [-9, 9]], // 6
  [[10, -10], [-10, 10], [-11, 11], [11, -11]], // 7
];

function generateMelody(size: number): string[] {
  const indices: number[] = [C4_IDX];

  while (indices.length < size) {
    const cur = indices[indices.length - 1];
    let matched = false;

    for (const group of PATTERN_GROUPS) {
      if (matched) break;
      const valid = group.filter(pattern => {
        let idx = cur;
        for (const step of pattern) {
          idx += step;
          if (idx < 0 || idx >= NOTES.length) return false;
        }
        return true;
      });
      if (valid.length) {
        matched = true;
        const pattern = valid[Math.floor(Math.random() * valid.length)];
        let idx = cur;
        for (const step of pattern) {
          idx += step;
          indices.push(idx);
        }
      }
    }

    if (!matched) indices.push(C4_IDX); // fallback
  }

  return indices.slice(0, size).map(i => NOTES[i].token);
}

// --- CLI ---
const sizeArg = process.argv.slice(2).find(a => /^\d+$/.test(a));
const size = sizeArg ? parseInt(sizeArg) : 64;

const tokens = generateMelody(size);

const measures: string[] = [];
for (let i = 0; i < tokens.length; i += 4) {
  const chunk = tokens.slice(i, i + 4);
  while (chunk.length < 4) chunk.push('x');
  measures.push(chunk.join(''));
}

const mmd = [
  "title: 'Generated'",
  'key: C4',
  'bpm: 25',
  'defaultNoteGroup: 4',
  'shift: 0',
  '',
  '%%',
  ...measures,
  '',
].join('\n');

const outDir = join(process.cwd(), 'public', 'songs');
mkdirSync(outDir, {recursive: true});
const filename = `generated_${Date.now()}.mmd`;
writeFileSync(join(outDir, filename), mmd);
console.log(`Generated ${tokens.length} notes → public/songs/${filename}`);

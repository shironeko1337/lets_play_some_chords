---
description: Generate a new .mmd song file for the chord training app. Use when asked to write a new song, create a melody, or add a .mmd file to the songs/ directory.
---

Generate a new `.mmd` song file and save it to `songs/` using the format below.

## MMD format

Songs have two blocks separated by `%%`:
- Before `%%` — global config (key-value pairs)
- After `%%` — music notation (one line = one measure)

### Config keys

```
title: 'Song Name'
key: C4               # root note + octave (C4, G4, D4, F4, A4, E4, …)
bpm: 80
defaultNoteGroup: 4   # default octave for scale degrees (3 = lower, 4 = mid, 5 = higher)
shift: 0              # audio offset in seconds, almost always 0
timeSignatureTop: 4   # optional, default 4
timeSignatureBottom: 4 # optional, default 4
```

### Notation rules

| Token | Meaning |
|-------|---------|
| `1`–`7` | Scale degree relative to key (ionian/major scale) |
| `^` prefix | Octave up — e.g. `^1` |
| `v` prefix | Octave down — e.g. `v5` |
| `#` suffix | Sharp — e.g. `1#` |
| `b` suffix | Flat — e.g. `3b` |
| `-` | Tie: extends the previous note by one quarter-note beat |
| `x` | Silent beat (rest) |
| `<` … `>` | 8th-note group: every digit inside is an 8th note (speed 2) |
| `[Name]` | Section marker — starts a new named section |
| `% bpm: 120 %` | Inline tempo change |

### Beat budget rule (critical)

Every measure line must total exactly `timeSignatureTop` quarter-note beats:
- Each bare digit = 1 beat
- Each digit inside `<…>` = 0.5 beat
- Each `-` = 1 beat added to the previous note
- `x` = 1 beat

**Check each line before writing.** A mismatch logs a console error at runtime.

Examples of valid 4/4 measures:
```
1234          → 4 × 1 = 4 beats ✓
1---          → 1 + 3×1 = 4 beats ✓  (whole note)
2--1          → 1 + 2 + 1 = 4 beats ✓
<1231>23      → 4×0.5 + 2×1 = 4 beats ✓
<53>212       → 2×0.5 + 3×1 = 4 beats ✓
```

### Reference song (morning_steps.mmd)

```
title: 'Morning Steps'
key: C4
bpm: 72
defaultNoteGroup: 4
shift: 0

%%
[A]
35<65>3
2--1
<53>212
1---
[B]
56<76>5
6-5-
<32>1<23>5
<53>21-
```

## How to generate

1. If $ARGUMENTS contains a style hint (e.g. "waltz", "slow ballad", "upbeat"), use it to pick key, bpm, and rhythm.
2. Otherwise pick reasonable defaults: key C4 or G4, bpm 70–100, 4/4 time.
3. Write 2–3 sections ([A], [B], optionally [C]), 4–6 measures each.
4. Verify every measure line sums to the correct beat count before saving.
5. Save to `songs/<kebab-case-title>.mmd`.
6. Tell the user the filename and key/bpm chosen.

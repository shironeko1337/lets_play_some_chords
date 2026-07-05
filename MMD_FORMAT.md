# MMD Song File Format

MMD files describe melodies for the chord training app. They use a jianpu-style (numbered notation) text format. Songs live in `public/songs/*.mmd`.

---

## File Structure

Every `.mmd` file has two blocks separated by `%%` (two or more `%` characters):

```
<config block>

%%
<music block>
```

- **Config block** — key/value pairs describing the song.
- **Music block** — one measure per line, using jianpu notation.

---

## Config Block

All keys are optional and have defaults, but you should always set `title`, `key`, `bpm`, and `defaultNoteGroup`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `title` | string | `''` | Song display name. Wrap in single or double quotes. |
| `key` | string | `C3` | Root note + octave. E.g. `C4`, `G4`, `D4`, `F4`, `A4`, `Eb4`. |
| `bpm` | number | `80` | Tempo in beats per minute. Supports decimals (e.g. `72.5`). |
| `defaultNoteGroup` | integer | `3` | Default octave for scale degrees. Use `4` for mid-range melodies. |
| `shift` | number | `0` | Audio start offset in seconds. Use `0` unless syncing to an existing audio file. |
| `timeSignatureTop` | integer | `4` | Beats per measure. |
| `timeSignatureBottom` | integer | `4` | Note value that gets one beat (4 = quarter note). |
| `tonicPickup` | boolean | `false` | If `true`, prepends an extra measure playing the tonic (degree 1) followed by rests before every section — a reference tone ahead of each chord progression, added regardless of whether the section already starts on the tonic. |

**Example:**
```
title: 'River Flow'
key: C4
bpm: 76
defaultNoteGroup: 4
shift: 0
```

---

## Music Block

### Scale Degrees

Notes are written as scale degrees `1`–`7` relative to the key. Degree `1` = root (tonic).

```
1234   → four quarter notes: root, 2nd, 3rd, 4th scale degrees
```

### Accidentals

Append directly after the digit (no space):

| Symbol | Meaning | Example |
|--------|---------|---------|
| `#` | Sharp (+1 semitone) | `1#`, `3#`, `4#` |
| `b` | Flat (−1 semitone) | `3b`, `7b`, `6b` |

```
1#23b4   → sharp-1, 2, flat-3, 4
```

### Octave Shifts

Prefix before the digit (before accidentals too):

| Prefix | Meaning | Example |
|--------|---------|---------|
| `^` | One octave up | `^1`, `^5` |
| `^^` | Two octaves up | `^^1` |
| `v` | One octave down | `v5`, `v3` |
| `vv` | Two octaves down | `vv1` |

```
^1v5   → degree 1 up one octave, degree 5 down one octave
v7b    → flat-7, one octave below default
```

The full note token order is: **octave-prefix + digit + accidental**, e.g. `v3#`, `^^1b`.

### Rests

| Symbol | Meaning |
|--------|---------|
| `x` | Silent beat (one quarter note rest) |

```
251x   → degrees 2, 5, 1, then one beat of silence
xxxx   → full measure rest
```

### Duration

The default note is a **quarter note** (one beat in 4/4).

| Syntax | Meaning |
|--------|---------|
| `1` | Quarter note (1 beat) |
| `1-` | Half note (2 beats: `1` + tie) |
| `1--` | Dotted half note (3 beats) |
| `1---` | Whole note (4 beats) |
| `<123>` | Group of eighth notes (speed ×2) |

**Ties:** A `-` extends the previous note by one beat. The note sustains rather than retriggering.

```
1---       → whole note (4 beats)
1-3-       → half note 1, half note 3 (2+2 = 4 beats)
3--2       → dotted half 3, quarter 2 (3+1 = 4 beats)
```

**Eighth-note groups:** Wrap consecutive notes in `< >`. Every note inside is half a beat.

```
<1234>     → four eighth notes = 2 beats
<65>432    → two eighths + three quarters = 1+3 = 4 beats
3<12>3-    → quarter + two eighths + half = 1+1+2 = 4 beats
```

**Nested groups:** `< >` can be nested. Each level doubles the speed of the enclosing level.

```
1<<1234>>11   → quarter + four sixteenth notes + quarter + quarter = 4 beats
               (outer < makes eighths; inner < doubles again to sixteenths)
```

**Triplet groups:** The `[X,Y]` modifier placed immediately after `<` means "these X notes collectively fill Y beats at the outer tempo". The `< >` wrapper is required and contains exactly X note tokens.

```
<[3,2]111>    → three notes filling 2 beats (quarter-note triplet, speed = 3/2)
<[3,1]111>    → three notes filling 1 beat (eighth-note triplet, speed = 3)
<[2,2]11>     → equivalent to 11 (two quarter notes; useful to verify: 2 notes in 2 beats)
```

Speed formula for triplet notes: `speed = outerSpeed × X / Y`
where `outerSpeed` is the accumulated speed from any enclosing `< >` groups.

**Restriction:** A `< >` cannot be opened while a triplet's note count is still being consumed. For example, `<[3,2]11<2>1>` is illegal (the inner `<` opens while 1 triplet note remains). However, nesting after a triplet finishes is fine: `<[3,2]111<22>>` is legal — the triplet is exhausted before the inner `<` opens.

### Beat Budget Rule

**Every measure line must total exactly `timeSignatureTop` beats.**

In 4/4 (the default), each line must sum to 4 quarter-note beats:

- Quarter note = 1 beat
- Tie `-` = 1 additional beat on the previous note
- Each note inside `< >` = 0.5 beats (or less with deeper nesting)
- `x` = 1 beat
- Triplet `<[X,Y]...>` = Y beats total (regardless of X)

The parser logs a console error if the beat count doesn't match. **Off-by-one beat errors will cause timing drift.**

| Line | Count | Valid? |
|------|-------|--------|
| `1234` | 4×1 = 4 | ✓ |
| `1---` | 1+3 = 4 | ✓ |
| `1-3-` | 2+2 = 4 | ✓ |
| `<1234>12` | 4×0.5 + 2×1 = 4 | ✓ |
| `251x` | 3+1 = 4 | ✓ |
| `<[3,2]111>1-` | 2 + 1 + 1 = 4 | ✓ |
| `1<<1234>>11` | 1 + 4×0.25 + 1 + 1 = 4 | ✓ |
| `123` | 3 | ✗ |

---

## Section Markers

A line matching `[Name]` starts a new named section. Any text is valid inside the brackets — use it for structural labels or chord progression descriptions.

```
[A]
[Chorus]
[I-V-vi-IV]
[12-bar blues]
```

Sections are purely organizational — they don't loop or repeat automatically. To repeat a section, write its measures again (or reuse the same `[A]` label for display purposes).

---

## Mid-Song Settings Changes

You can change `bpm` (or any config key) mid-song in two ways:

**Inline (single key/value on one line):**
```
% bpm: 120 %
```

**Multiline block (lone `%` as delimiter):**
```
%
bpm: 100
key: G4
%
```

These changes apply to all measures that follow until the next change or end of file.

---

## Comments

Two styles of comments are stripped before parsing and can appear anywhere:

| Style | Syntax | Where |
|-------|--------|-------|
| End-of-line comment | `// comment` | After a note expression |
| Parenthetical | `(comment text)` | Anywhere on any line |

```
3-5-   // verse opening
1(root)2(second)3(third)4
```

---

## Capabilities

**What MMD can do:**
- Monophonic melodies in any major key
- Jianpu scale degrees 1–7 with sharps and flats
- Multi-octave range via `^`/`v` prefixes
- Quarter, half, whole, eighth, and sixteenth note durations (and any binary subdivision via nested `< >`)
- Triplets and other irrational subdivisions via `<[X,Y]...>` inside any group context
- Rests at any beat position
- Tied/sustained notes
- Named sections for structure
- Tempo changes mid-song
- Time signature customization

**What MMD cannot do:**
- **Chords / harmony** — only one note at a time (monophonic)
- **Dynamics / velocity** — no volume or accent control
- **Instrument selection** — set outside the `.mmd` file
- **Automatic section repeats** — no loop or repeat markers
- **Triplets nested inside triplets** — `<[X,Y]...<...>...>` is illegal; the outer triplet group may not contain `< >`
- **Minor/modal scales** — the scale is always Ionian (major); chromatic inflections via `#`/`b` are the only workaround

---

## Complete Example

```
title: 'Morning Steps'
key: C4
bpm: 72
defaultNoteGroup: 4
shift: 0

%%
[A]
35<65>3    // 3 quarters + 2 eighths + 1 quarter... wait — let's count:
           // 3(1) + 5(1) + <6(0.5) + 5(0.5)> + 3(1) = 4 beats ✓
2--1
<53>212
1---
[B]
56<76>5
6-5-
<32>1<23>5
<53>21-
```

### Beat verification for `<53>21-`:
- `<5` = 0.5
- `3>` = 0.5
- `2` = 1
- `1` = 1
- `-` = 1 (ties onto `1`)
- Total = 0.5 + 0.5 + 1 + 1 + 1 = **4 beats ✓**

---

## Quick Reference

```
Full note token syntax:  [v...][^...]<digit>[#|b]
                         └─ octave down  └─ octave up

Duration modifiers:
  1           quarter note (1 beat)
  1-          half note    (2 beats)
  1--         3 beats
  1---        whole note   (4 beats)
  <123>       eighth notes (0.5 beats each)
  <<1234>>    sixteenth notes (0.25 beats each)  ← nestable, each level ×2
  <[X,Y]...>  triplet group: X notes filling Y beats (outerSpeed × X/Y each)
  x           quarter rest (1 beat)

Triplet examples:
  <[3,2]111>   quarter-note triplet (3 notes in 2 beats, speed = 3/2)
  <[3,1]111>   eighth-note triplet  (3 notes in 1 beat,  speed = 3)
  <[5,4]11111> quintuplet           (5 notes in 4 beats, speed = 5/4)

Line-level constructs:
  [Name]          section marker
  % bpm: 90 %     inline setting change
  %               multiline setting block start/end
  // text         end-of-line comment
  (text)          inline comment (stripped anywhere)
```

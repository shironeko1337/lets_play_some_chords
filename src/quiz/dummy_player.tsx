import {useState, useRef, useEffect} from 'react';
import * as Tone from 'tone';
import {decodeSongMd} from '../model/quiz';
import {note2midi, loadInstrument} from '../util';

const SONGS = [
  {path: 'songs/jazz_progressions.mmd', label: 'Jazz Progressions'},
  {path: 'songs/rock_progressions.mmd', label: 'Rock Progressions'},
  {path: 'songs/progression_study.mmd', label: 'Progression Study'},
  {path: 'songs/interval_training_345.mmd', label: 'Interval Training: 3rd & 4ths & 5ths'},
  {path: 'songs/interval_training_45.mmd', label: 'Interval Training: 4ths & 5ths'},
  {path: 'songs/interval_training.mmd', label: 'Interval Training'},
  {path: 'songs/morning_steps.mmd', label: 'Morning Steps'},
  {path: 'songs/wanderer.mmd', label: 'Wanderer'},
  {path: 'songs/twilight.mmd', label: 'Twilight'},
  {path: 'songs/playful_dance.mmd', label: 'Playful Dance'},
  {path: 'songs/moonlit_path.mmd', label: 'Moonlit Path'},
  {path: 'songs/river_flow.mmd', label: 'River Flow'},
];

const RANDOM_MIN = 48; // C3
const RANDOM_MAX = 72; // C5

// Canonical natural-note pair per interval, anchored to C or G.
// Rule for each n: C+n natural? → {C, C+n}; else G−n natural? → {G−n, G};
//   else C−n natural? → {C−n, C}; else G+n natural? → {G, G+n};
//   else tritone fallback {B, F}.
// Pairs listed as all valid (ascending, descending) octave instances in C3–C5.
//   n=1  {B, C}   n=2  {C, D}   n=3  {E, G}   n=4  {C, E}
//   n=5  {C, F}   n=6  {B, F}   n=7  {C, G}   n=8  {B, G}
//   n=9  {C, A}   n=10 {A, G}   n=11 {C, B}
const EASY_MODE_PAIRS = new Map<number, [number, number][]>([
  [1,  [[59,60],[71,72],[60,59],[72,71]]],
  [2,  [[48,50],[60,62],[50,48],[62,60]]],
  [3,  [[52,55],[64,67],[55,52],[67,64]]],
  [4,  [[48,52],[60,64],[52,48],[64,60]]],
  [5,  [[48,53],[60,65],[53,48],[65,60]]],
  [6,  [[59,65],[53,59],[65,71],[65,59],[59,53],[71,65]]],
  [7,  [[48,55],[60,67],[55,48],[67,60]]],
  [8,  [[59,67],[67,59]]],
  [9,  [[48,57],[60,69],[57,48],[69,60]]],
  [10, [[57,67],[67,57]]],
  [11, [[48,59],[60,71],[59,48],[71,60]]],
]);

type IntervalConfig = {id: number; semitones: number; count: number};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildSeqFromIntervals(configs: IntervalConfig[]): number[] {
  const pool = shuffle(configs.flatMap(cfg => Array(cfg.count).fill(cfg.semitones) as number[]));
  const seq: number[] = [60]; // start at C4
  for (const absDiff of pool) {
    const prev = seq[seq.length - 1];
    const up = prev + absDiff;
    const down = prev - absDiff;
    const upOk = up >= RANDOM_MIN && up <= RANDOM_MAX;
    const downOk = down >= RANDOM_MIN && down <= RANDOM_MAX;
    if (upOk && downOk) seq.push(Math.random() < 0.5 ? up : down);
    else if (upOk) seq.push(up);
    else if (downOk) seq.push(down);
    else {
      const upShifted = up - 12;
      const downShifted = down + 12;
      if (upShifted >= RANDOM_MIN && upShifted <= RANDOM_MAX) seq.push(upShifted);
      else if (downShifted >= RANDOM_MIN && downShifted <= RANDOM_MAX) seq.push(downShifted);
      else seq.push(prev);
    }
  }
  return seq;
}

function buildEasyModePairs(configs: IntervalConfig[]): number[] {
  const pool = shuffle(configs.flatMap(cfg => Array(cfg.count).fill(cfg.semitones) as number[]));
  return pool.flatMap(n => {
    const pairs = EASY_MODE_PAIRS.get(n) ?? [];
    const [a, b] = pairs.length > 0
      ? pairs[Math.floor(Math.random() * pairs.length)]
      : [60, 60 + n];
    return [a, b];
  });
}

type Status = 'idle' | 'loading' | 'playing' | 'done';

function voiceFilename(diff: number): string {
  return `${Math.abs(diff)}.mp3`;
}

function beatTime(beat: number): string {
  return `${Math.floor(beat / 4)}:${beat % 4}:0`;
}

const INVERVAL_COUNTS: number[] = [
  1,
  4,
  4,
  4,
  6,
  4,
  6,
  8,
  8,
  8,
  8,
]

export const DummyPlayer = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [useRandom, setUseRandom] = useState(false);
  const [easyMode, setEasyMode] = useState(false);
  const [selectedSong, setSelectedSong] = useState(SONGS[0].path);
  const [intervalConfigs, setIntervalConfigs] = useState<IntervalConfig[]>(
    Array.from({length: 11}, (_, i) => ({id: i + 1, semitones: i + 1, count: INVERVAL_COUNTS[i]}))
  );
  const nextId = useRef(12);
  const [bpm, setBpm] = useState(30);
  const [answerDelay, setAnswerDelay] = useState(2);
  const [pairLabel, setPairLabel] = useState('');

  const samplerRef = useRef<Tone.Sampler | null>(null);
  const voicePlayersRef = useRef(new Map<number, Tone.Player>());

  useEffect(() => () => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    voicePlayersRef.current.forEach(p => p.dispose());
  }, []);

  const addInterval = () => {
    setIntervalConfigs(prev => [...prev, {id: nextId.current++, semitones: 1, count: 4}]);
  };

  const removeInterval = (id: number) => {
    setIntervalConfigs(prev => prev.filter(c => c.id !== id));
  };

  const updateInterval = (id: number, field: 'semitones' | 'count', raw: string) => {
    const value = parseInt(raw);
    if (isNaN(value)) return;
    setIntervalConfigs(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (field === 'semitones') return {...c, semitones: Math.max(1, Math.min(12, value))};
      return {...c, count: Math.max(1, Math.min(64, value))};
    }));
  };

  const handleStop = () => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    setStatus('done');
    setPairLabel('');
  };

  const handlePlay = async () => {
    setStatus('loading');
    setPairLabel('');

    // 1. Build MIDI sequence
    const easyModeActive = useRandom && easyMode;
    let seq: number[];
    if (useRandom) {
      if (intervalConfigs.length === 0) {setStatus('idle'); return;}
      seq = easyModeActive ? buildEasyModePairs(intervalConfigs) : buildSeqFromIntervals(intervalConfigs);
    } else {
      const mmd = await fetch(selectedSong).then(r => r.text());
      const song = decodeSongMd(mmd);
      seq = [];
      for (const section of song.sections)
        for (const measure of section.measures)
          for (const note of measure.notes)
            if (!note.silent && note.note && note.noteGroup && note.starts !== false)
              seq.push(note2midi(`${note.note}${note.noteGroup}`));
    }

    if (seq.length < 2) {setStatus('idle'); return;}

    // 2. Load piano sampler
    await Tone.start();
    samplerRef.current = await loadInstrument('piano');

    // 3. Find unique absolute intervals and load voice players
    // easy mode pairs are non-overlapping (step 2); song/normal random use overlapping (step 1)
    const pairStep = easyModeActive ? 2 : 1;
    const absDiffs = new Set<number>();
    for (let i = 0; i + 1 < seq.length; i += pairStep) {
      const d = Math.abs(seq[i + 1] - seq[i]);
      if (d !== 0) absDiffs.add(d);
    }

    voicePlayersRef.current.forEach(p => p.dispose());
    voicePlayersRef.current.clear();

    const voicePlayers = new Map<number, Tone.Player>();
    await Promise.all([...absDiffs].map(async absDiff => {
      const fileUrl = `voices/${voiceFilename(absDiff)}`;
      try {
        if (!(await fetch(fileUrl, {method: 'HEAD'})).ok) return;
        const player = new Tone.Player(fileUrl).toDestination();
        voicePlayers.set(absDiff, player);
      } catch { }
    }));
    await Tone.loaded();
    voicePlayersRef.current = voicePlayers;

    // 4. Schedule: A → B → voice → rest
    const transport = Tone.getTransport();
    transport.cancel();
    transport.bpm.value = bpm;

    const sampler = samplerRef.current;
    const stride = 3 + answerDelay;
    let pairIdx = 0;

    for (let i = 0; i + 1 < seq.length; i += pairStep) {
      const A = seq[i];
      const B = seq[i + 1];
      const diff = B - A;
      const base = pairIdx * stride;
      pairIdx++;

      const noteA = Tone.Frequency(A, 'midi').toNote();
      const noteB = Tone.Frequency(B, 'midi').toNote();
      const voicePlayer = voicePlayers.get(Math.abs(diff));

      transport.schedule((audioTime) => {
        sampler?.triggerAttackRelease(noteA, '4n', audioTime);
        setPairLabel(`${noteA} → ${noteB}  (${diff > 0 ? '+' : ''}${diff} st)`);
      }, beatTime(base));

      transport.schedule((audioTime) => {
        sampler?.triggerAttackRelease(noteB, '4n', audioTime);
      }, beatTime(base + 1));

      transport.schedule((audioTime) => {
        voicePlayer?.start(audioTime);
      }, beatTime(base + 1 + answerDelay));
    }

    transport.schedule(() => {
      setStatus('done');
      setPairLabel('');
    }, beatTime(pairIdx * stride));

    transport.start();
    setStatus('playing');
  };

  const isIdle = status === 'idle' || status === 'done';
  const totalNotes = intervalConfigs.reduce((s, c) => s + c.count, 0);

  return (
    <div className="flex flex-col items-center gap-6 py-8 min-h-64">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setUseRandom(false)}
          disabled={!isIdle}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50
            ${!useRandom ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Song
        </button>
        <button
          onClick={() => setUseRandom(true)}
          disabled={!isIdle}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50
            ${useRandom ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Random
        </button>
      </div>

      {/* Source selector */}
      {useRandom ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col gap-2">
            {intervalConfigs.map(cfg => (
              <div key={cfg.id} className="flex items-center gap-2">
                <input
                  type="number"
                  value={cfg.semitones}
                  onChange={e => updateInterval(cfg.id, 'semitones', e.target.value)}
                  disabled={!isIdle}
                  className="w-14 px-2 py-1 border border-gray-300 rounded text-sm text-center disabled:opacity-50"
                  min={1} max={12}
                />
                <span className="text-xs text-gray-400 w-4">st</span>
                <span className="text-xs text-gray-500">×</span>
                <input
                  type="number"
                  value={cfg.count}
                  onChange={e => updateInterval(cfg.id, 'count', e.target.value)}
                  disabled={!isIdle}
                  className="w-14 px-2 py-1 border border-gray-300 rounded text-sm text-center disabled:opacity-50"
                  min={1} max={64}
                />
                <span className="text-xs text-gray-400">times</span>
                <button
                  onClick={() => removeInterval(cfg.id)}
                  disabled={!isIdle}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors text-sm"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={addInterval}
              disabled={!isIdle}
              className="text-sm text-blue-500 hover:text-blue-700 disabled:opacity-40 transition-colors"
            >
              + add interval
            </button>
            <span className="text-xs text-gray-400">{totalNotes} pairs total</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={easyMode}
              onChange={e => setEasyMode(e.target.checked)}
              disabled={!isIdle}
              className="w-4 h-4 accent-blue-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-600">Easy mode</span>
            <span className="text-xs text-gray-400">(each pair anchored to C or G)</span>
          </label>
        </div>
      ) : (
        <select
          value={selectedSong}
          onChange={e => setSelectedSong(e.target.value)}
          disabled={!isIdle}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer disabled:opacity-50"
        >
          {SONGS.map(s => (
            <option key={s.path} value={s.path}>{s.label}</option>
          ))}
        </select>
      )}

      {/* BPM + answer delay */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">BPM:</label>
          <input
            type="number"
            value={bpm}
            onChange={e => setBpm(Math.max(20, Math.min(200, parseInt(e.target.value) || 60)))}
            disabled={!isIdle}
            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center disabled:opacity-50"
            min={20} max={200}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Answer delay (beats):</label>
          <input
            type="number"
            value={answerDelay}
            onChange={e => setAnswerDelay(Math.max(0, Math.min(16, parseInt(e.target.value) || 1)))}
            disabled={!isIdle}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center disabled:opacity-50"
            min={0} max={16}
          />
        </div>
      </div>

      {/* Play / Stop */}
      <div className="flex gap-4">
        {status === 'loading' ? (
          <span className="text-gray-400 text-lg animate-pulse">Loading…</span>
        ) : isIdle ? (
          <button
            onClick={handlePlay}
            className="px-10 py-5 text-xl font-bold bg-green-500 text-white rounded-2xl
                       hover:bg-green-600 active:scale-95 transition-all shadow-lg"
          >
            Play
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="px-10 py-5 text-xl font-bold bg-red-500 text-white rounded-2xl
                       hover:bg-red-600 active:scale-95 transition-all shadow-lg"
          >
            Stop
          </button>
        )}
      </div>

      {pairLabel && (
        <div className="text-2xl font-mono font-semibold text-gray-800 bg-gray-100 px-6 py-3 rounded-xl">
          {pairLabel}
        </div>
      )}
    </div>
  );
};

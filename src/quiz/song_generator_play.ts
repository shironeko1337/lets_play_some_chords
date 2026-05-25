import {SongGenerator} from './song_generator';
import type {SoundSource} from '../types';

const sourceEl = document.getElementById('source') as HTMLSelectElement;
const instrumentPicker = document.getElementById('instrument-picker') as HTMLElement;
const wavePicker = document.getElementById('wave-picker') as HTMLElement;
const instrumentEl = document.getElementById('instrument') as HTMLSelectElement;
const waveEl = document.getElementById('wave') as HTMLSelectElement;
const btn = document.getElementById('btn') as HTMLButtonElement;
const status = document.getElementById('status') as HTMLElement;

sourceEl.addEventListener('change', () => {
  const isInstrument = sourceEl.value === 'instrument';
  instrumentPicker.style.display = isInstrument ? '' : 'none';
  wavePicker.style.display = isInstrument ? 'none' : '';
});

btn.addEventListener('click', async () => {
  btn.disabled = true;
  status.textContent = 'Loading...';
  try {
    const mmd = await fetch('/songs/morning_steps.mmd').then(r => r.text());
    const generator = new SongGenerator();

    const isInstrument = sourceEl.value === 'instrument';
    const soundSource: SoundSource = isInstrument
      ? {sourceType: 'instrument', instrumentType: instrumentEl.value as any}
      : {sourceType: 'midi-wave', instrumentType: waveEl.value as any};

    status.textContent = isInstrument ? 'Fetching samples...' : 'Generating...';
    const buffer = await generator.fromStr(mmd, soundSource);

    const actx = new AudioContext();
    const src = actx.createBufferSource();
    src.buffer = buffer;
    src.connect(actx.destination);
    src.start();
    src.onended = () => { btn.disabled = false; status.textContent = 'Done.'; };
    status.textContent = `Playing ${buffer.duration.toFixed(1)}s…`;
  } catch (err) {
    status.textContent = 'Error: ' + (err as Error).message;
    console.error(err);
    btn.disabled = false;
  }
});

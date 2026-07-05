import {MMDGenerator} from './quiz/mmd_generator';
import type {MMDGeneratorConfig} from './quiz/mmd_generator';

const status = document.getElementById('status')!;
const outputWrap = document.getElementById('output-wrap')!;
const output = document.getElementById('output') as HTMLTextAreaElement;
const btn = document.getElementById('btn') as HTMLButtonElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(output.value);
  copyBtn.textContent = 'Copied!';
  setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
});

const field = (id: string) => (document.getElementById(id) as HTMLInputElement).value;

const generator = new MMDGenerator();
status.textContent = 'Loading models…';
// models initialise in the background; generate() awaits them

btn.disabled = true;

btn.addEventListener('click', async () => {
  btn.disabled = true;
  status.textContent = 'Generating…';
  output.style.display = 'none';

  const config: MMDGeneratorConfig = {
    magenta: {
      model:        field('model') as 'music_vae' | 'music_rnn',
      bpm:          parseInt(field('bpm')),
      keyNote:      field('keyNote') as any,
      keyNoteGroup: parseInt(field('keyNoteGroup')) as any,
      temperature:  parseFloat(field('temperature')),
      steps:        parseInt(field('steps')),
    },
    song: {
      title:               field('title'),
      defaultNoteGroup:    parseInt(field('defaultNoteGroup')),
      shift:               0,
      timeSignatureTop:    4,
      timeSignatureBottom: 4,
    },
  };

  try {
    const mmd = await generator.generate(config);

    // Show in page
    output.value = mmd;
    outputWrap.style.display = 'block';

    // Auto-download
    const filename = `${field('title').replace(/\s+/g, '_').toLowerCase()}.mmd`;
    const blob = new Blob([mmd], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);

    status.textContent = `Done — downloaded ${filename}`;
  } catch (e) {
    status.textContent = `Error: ${e}`;
  } finally {
    btn.disabled = false;
  }
});

generator['initPromise'].then(() => {
  status.textContent = 'Models ready. Configure and click Generate.';
  btn.disabled = false;
});

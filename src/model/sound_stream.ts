import {PitchDetector} from 'pitchy';
import {ChordStream} from './chord_stream';

export class Visualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private logEl: HTMLDivElement;
  private pixels: Float32Array<ArrayBuffer>;

  constructor(canvas: HTMLCanvasElement, logEl: HTMLDivElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.logEl = logEl;
    this.pixels = new Float32Array(canvas.width);
  }

  updatePlot(waveData: Uint8Array<ArrayBuffer>, bandwidth: number) {
    const {width, height} = this.canvas;
    if (this.pixels.length !== width) {
      this.pixels = new Float32Array(width) as Float32Array<ArrayBuffer>;
    }

    const labelHeight = 18;
    const plotHeight = height - labelHeight;
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);

    this.pixels.fill(0);
    for (let i = 1; i < waveData.length; i++) {
      const freq = i * bandwidth;
      if (freq < minFreq || freq > maxFreq) continue;
      const x = Math.floor(width * (Math.log10(freq) - logMin) / (logMax - logMin));
      if (x >= 0 && x < width && waveData[i] > this.pixels[x]) {
        this.pixels[x] = waveData[i];
      }
    }

    this.ctx.clearRect(0, 0, width, height);

    this.ctx.fillStyle = '#4ade80';
    for (let x = 0; x < width; x++) {
      const barHeight = (this.pixels[x] / 255) * plotHeight;
      this.ctx.fillRect(x, plotHeight - barHeight, 1, barHeight);
    }

    this.ctx.fillStyle = '#9ca3af';
    this.ctx.font = '10px monospace';
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const freq = Math.pow(10, logMin + t * (logMax - logMin));
      const x = Math.round(width * t);
      this.ctx.fillRect(x, plotHeight, 1, 3);
      const label = freq >= 1000
        ? `${parseFloat((freq / 1000).toPrecision(2))}k`
        : `${Math.round(freq)}`;
      this.ctx.textAlign = i === 0 ? 'left' : i === 9 ? 'right' : 'center';
      this.ctx.fillText(label, x, height - 2);
    }
  }

  updateInfo(pitch: string, pitchConfidence: string, logs?: string[]) {
    this.logEl.textContent = [
      `pitch: ${pitch} Hz`,
      `confidence: ${pitchConfidence}`,
      ...(logs ?? []),
    ].join('\n');
  }
}

export type SoundStreamFrame = {
  waveData: Uint8Array;
  pitch: number;
  pitchConfidence: number;
};

export type SoundStreamSourceType = 'device' | 'file';

export class SoundStream {
  ctx!: AudioContext;
  analyser!: AnalyserNode;
  deviceInputStream!: MediaStream;
  detector!: PitchDetector<Float32Array>;
  rawSampleBuffer!: Float32Array<ArrayBuffer>;
  waveBuffer!: Uint8Array<ArrayBuffer>;

  visualizer?: Visualizer;
  chordStream?: ChordStream;
  debugCallback?: Function;
  onFrame?: (pitch: number, clarity: number) => void;
  private _rafId?: number;
  private _source?: MediaStreamAudioSourceNode | MediaElementAudioSourceNode;
  private _deviceSource?: MediaStreamAudioSourceNode;
  private _fileSource?: MediaElementAudioSourceNode;

  config: {
    sampleRate: number;
    bufferOverlap: number;
    fftSize: number;
  } = {
      sampleRate: 44100,
      bufferOverlap: 100,
      fftSize: 2048,
    };

  async init({visualizer}: {visualizer?: Visualizer} = {}) {
    this.visualizer = visualizer;
    this.ctx = new AudioContext({sampleRate: 44100});
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    // smoothingTimeConstant blends the previous frame into the current FFT result (0=raw, 1=frozen)
    this.analyser.smoothingTimeConstant = 0.8;
    this.detector = PitchDetector.forFloat32Array(this.config.fftSize);
    this.rawSampleBuffer = new Float32Array(this.config.fftSize);
    this.waveBuffer = new Uint8Array(this.analyser.frequencyBinCount);
  }

  initStream(source: 'device', deviceId?: string): Promise<void>;
  initStream(source: 'file', audioEl: HTMLAudioElement): Promise<void>;
  async initStream(source: SoundStreamSourceType, audioElOrDeviceId?: HTMLAudioElement | string) {
    const deviceId = source === 'device' ? audioElOrDeviceId as string | undefined : undefined;
    const audioEl = source === 'file' ? audioElOrDeviceId as HTMLAudioElement : undefined;

    // Disconnect current source from analyser only (leave other connections intact)
    if (this._source) {
      try {this._source.disconnect(this.analyser);} catch { }
      this._source = undefined;
    }

    if (source === 'device') {
      // Re-acquire if stream inactive or device changed
      const currentDeviceId = this.deviceInputStream?.getAudioTracks()[0]?.getSettings().deviceId;
      if (!this.deviceInputStream?.active || (deviceId && currentDeviceId !== deviceId)) {
        this._deviceSource?.disconnect();
        this._deviceSource = undefined;
        this.deviceInputStream?.getTracks().forEach(t => t.stop());
        this.deviceInputStream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? {deviceId: {exact: deviceId}} : true,
        });
        this._deviceSource = this.ctx.createMediaStreamSource(this.deviceInputStream);
      }
      this._source = this._deviceSource!;
      this._source.connect(this.analyser);
    } else if (audioEl instanceof HTMLAudioElement) {
      // MediaElementAudioSourceNode can only be created once per element — reuse it
      if (!this._fileSource) {
        this._fileSource = this.ctx.createMediaElementSource(audioEl);
        this._fileSource.connect(this.ctx.destination);
      }
      this._source = this._fileSource;
      this._source.connect(this.analyser);
    }
  }

  private _lastUpdateTime = 0;

  private _update = () => {
    const ts = this.ctx.currentTime * 1000;

    this._lastUpdateTime = ts;
    this.analyser.getFloatTimeDomainData(this.rawSampleBuffer);
    const [pitch, clarity] = this.detector.findPitch(this.rawSampleBuffer, this.ctx.sampleRate);
    // smoothingTimeConstant applies here — each call blends previous FFT output with current
    this.analyser.getByteFrequencyData(this.waveBuffer);
    // this.debugCallback ? this.debugCallback(ts, pitch, clarity, this.rawSampleBuffer, this.waveBuffer) : null;
    this.chordStream?.update(this.ctx.currentTime * 1000, this.rawSampleBuffer, this.ctx.currentTime, this.waveBuffer);
    this.visualizer?.updateInfo(
      pitch.toFixed(1),
      `${(clarity * 100).toFixed(0)}%`,
      [`fftSize: ${this.config.fftSize}`],
    );
    this.visualizer?.updatePlot(this.waveBuffer, this.ctx.sampleRate / 2 / this.analyser.frequencyBinCount);
    this.onFrame?.(pitch, clarity);

    this._rafId = requestAnimationFrame(this._update);
  };

  start() {
    this.ctx.resume();
    this._rafId = requestAnimationFrame(this._update);
  }

  stop() {
    if (this._rafId !== undefined) {
      cancelAnimationFrame(this._rafId);
      this._rafId = undefined;
    }
  }
}

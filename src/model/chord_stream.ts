import {PitchDetector} from "pitchy";
import {calcFlux, calcMean, detectLogger, getNoteFromFreq} from "../util";

export type Note = {
  pitch?: number;
  timestamp?: number; // in case we want to show the note in real time, we don't need timestamp
  level?: number;
  duration?: number;
};

export type MainKey = {
  notation: string;
  freq: number;
};

export type ChordMap = {
  keyFrequencies: Array<number>;
  keyStarts: Array<[MainKey, number]>;
  notes: Array<Note>;
};

export class ChordStream {
  map?: ChordMap;
  // currentNote?: Note;
  // pitchBuffer?: Float32Array<ArrayBuffer>;
  // pitchConfidenceBuffer?: Float32Array<ArrayBuffer>;
  // bufferDuration: number = 0;
  // bufferShift: number = 0;
  // _lastRawBufferItems: number[] = [];
  // bufferIndex: number = 0; // where we start the comparision for the raw wave buffer, we only need this because pitch buffer always shift by 1
  // noteCandidates: Note[] = []

  // for start and stop streaming
  onTick?: (stream: ChordStream) => void;
  private _rafId?: number;

  private _tick = () => {
    this.onTick?.(this);
    this._rafId = requestAnimationFrame(this._tick);
  };

  start() {
    this._rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    if (this._rafId !== undefined) {
      cancelAnimationFrame(this._rafId);
      this._rafId = undefined;
    }
  }

  // constant configs
  fftSize: number = 2048
  sampleRate: number = 44100
  steadyDetectionWindowSize: number = 2048

  load({fftSize = 2048, sampleRate = 44100}) {
    this.fftSize = fftSize
    this.sampleRate = sampleRate
  }

  previousBuffer?: number[];
  lastAudioTime: number = 0;
  bufferSize = 0;
  currentTimestamp = 0;

  // for getting the buffer for a note

  // we need these two conditions to meet to know when a note starts
  // 1. frequency changes quickly
  // 2. wave increases
  prevFreqBuf: Uint8Array | null = null;
  prevFlux = 0;
  prevBufferMean = 0;

  noteBuffer = new Float32Array(10 * 4096); // buffer large enough to store one note's raw wave data
  noteStarted = false;
  noteBufferSize = 0;
  noteBurstBufferDataSize = 0;
  noteStartBufferIndex = -1; // when note starts, what is the index in the buffer data

  // these two are needed to identify when the note become smooth (best timing to know the real frequency)
  noteBurstFlux = -1; // flux when note bursts
  beforeFluxDropsQuickly = false; // if it's before the flux drops quickly, after flux drops

  // pitch detector for recognizing the note
  windowDetector = PitchDetector.forFloat32Array(
    this.steadyDetectionWindowSize,
  );

  // lastest result of note identification
  lastestDetectedNote = "";
  lastestDetectedNoteMajorFrequency = -1;
  lastestDetectedNoteBufferMean = 0;

  update(
    timeStamp: number,
    rawSampleBuffer: Float32Array<ArrayBuffer>,
    audioTime: number = 0,
    freqBuf: Uint8Array | null = null,
  ) {
    const currentBuffer: Array<number> = Array.from(rawSampleBuffer);
    const firstIndex = this.previousBuffer
      ? currentBuffer.findIndex(
        (x) => x === this.previousBuffer![this.previousBuffer!.length - 1],
      )
      : 0;
    const lastIndex = this.previousBuffer
      ? currentBuffer.findLastIndex(
        (x) => x === this.previousBuffer![this.previousBuffer!.length - 1],
      )
      : 0;

    // if we find the exact match of a number, then we can shift the number with
    // confidence
    // otherwise, the start index is determined by the passed time by audioTime
    let bufferDataStartIndex =
      firstIndex === lastIndex
        ? firstIndex + 1
        : Math.max(
          0,
          Math.floor(
            rawSampleBuffer.length - (audioTime - this.lastAudioTime) * 44100,
          ),
        );
    this.lastAudioTime = audioTime;
    this.previousBuffer = currentBuffer;
    const prevBufferSize = this.bufferSize;
    this.currentTimestamp = timeStamp;
    const addedDataSize = rawSampleBuffer.length - bufferDataStartIndex;

    this.bufferSize += addedDataSize;

    let validBufferDataStartIndex =
      rawSampleBuffer.length - this.bufferSize + prevBufferSize;

    // the minimum duration (ms) of a note for identify
    const MIN_NOTE_RECOGNIZATION_DURATION = 150;

    // calc if current buffer contains the note start by flux
    const flux = freqBuf ? calcFlux(this.prevFreqBuf, freqBuf, 1000) : 0;
    const bufferMean = calcMean(rawSampleBuffer);
    const hasNoteStart =
      !!(flux &&
        (!this.prevFlux || this.prevFlux * 10 < flux) &&
        bufferMean &&
        bufferMean > this.prevBufferMean);

    this.noteStarted ||= hasNoteStart;

    // if (this.noteStarted) {
    //   console.log(
    //     `[Note] ${audioTime}: flux: ${flux}, bufferMean: ${bufferMean}`,
    //   );
    // } else {
    //   console.log(
    //     `[Non note] ${audioTime}: flux: ${flux}, bufferMean: ${bufferMean}`,
    //   );
    // }

    // console.log(
    //   // performance.now(),
    //   "frame pitch",
    //   // pitch,
    //   audioTime,
    //   // ((this.noteBufferSize + addedDataSize) / 44100) * 1000,
    //   this.prevFlux,
    //   flux,
    //   this.noteStarted,
    //   addedDataSize,
    //   // this.bufferSize,
    //   // prevBufferSize,
    //   // this.bufferSize,
    //   // prevBufferSize / 44100,
    //   // this.bufferSize / 44100,
    // );

    // when buffer has non 0 flux, it means the current note ends aleady
    // in that case, the whole buffer is treated empty and the note is
    // ignored since it doesn't meet the minimum time for identification.
    if (this.noteStarted) {
      const isNoteStartingBuffer = this.noteStartBufferIndex === -1;
      const isNoteFinanlized =
        ((this.noteBufferSize + addedDataSize) / 44100) * 1000 >=
        MIN_NOTE_RECOGNIZATION_DURATION;
      let shouldEndCurrentNote = isNoteFinanlized;

      // if it's the first buffer of note, we save its index and size
      if (isNoteStartingBuffer) {
        this.noteStartBufferIndex = prevBufferSize;
        this.beforeFluxDropsQuickly = true;
        this.noteBurstFlux = flux;
      }

      // if we detect a drop or the burst buffer has enough size, then burst buffer is cut off
      if (
        flux < this.noteBurstFlux / 10 ||
        this.noteBurstBufferDataSize > 2047
      ) {
        this.beforeFluxDropsQuickly = false;
      }

      if (this.beforeFluxDropsQuickly) {
        this.noteBurstBufferDataSize += addedDataSize;
      }

      this.noteBuffer.set(
        rawSampleBuffer.subarray(validBufferDataStartIndex),
        this.noteBufferSize,
      );

      // console.log(audioTime, 'isNoteFinanlized',isNoteFinanlized, shouldEndCurrentNote);
      // we get a full note, try recognizing the note and move to next
      if (isNoteFinanlized) {
        const [fixedPitch, fixedPitchMajorFrequency] = this.getFixedPitchValue();
        if (fixedPitch) {
          this.lastestDetectedNote = fixedPitch
          this.lastestDetectedNoteMajorFrequency = fixedPitchMajorFrequency
          this.lastestDetectedNoteBufferMean = bufferMean
          // console.log(
          //   `Fixed pitch value is ${fixedPitch} starting at ${this.noteStartBufferIndex / 44100}ms ending at ${this.bufferSize / 44100}ms.`,
          // );
        }
      }

      if (shouldEndCurrentNote) {
        this.noteBufferSize = 0;
        this.noteBurstBufferDataSize = 0;
        this.noteStarted = false;
        this.noteBurstFlux = -1;
        this.noteStartBufferIndex = -1;
      } else {
        this.noteBufferSize += addedDataSize;
      }
    }

    this.prevFlux = flux;
    this.prevFreqBuf = freqBuf ? new Uint8Array(freqBuf) : null;
    this.prevBufferMean = bufferMean;
  }

  getFixedPitchValue() {
    const burstSize = this.noteBurstBufferDataSize;
    const steadyStart = burstSize;
    const steadySize = this.noteBufferSize - steadyStart;
    const steadyDetectionWindowSize = this.steadyDetectionWindowSize

    // logs out the pitch detection result of the first buffer of burst
    // if the first buffer is too short to be detected (<2048), then
    // fill it up using the steady data but do not move the steady data start index
    const [burstFreq, burstClarity] = this.windowDetector.findPitch(
      this.noteBuffer.subarray(0, steadyDetectionWindowSize),
      this.sampleRate,
    );
    const burstPitch =
      getNoteFromFreq(burstFreq, 50).level || `${burstFreq.toFixed(1)}Hz`;
    detectLogger(
      `${burstPitch} for burst with clarity=${burstClarity.toFixed(2)}`,
      this.noteStartBufferIndex,
      this.noteStartBufferIndex + steadyDetectionWindowSize,
    );

    // loop through steady data and for each window log the detection result accurately
    const votes = new Map();

    // let res = []
    for (
      let offset = 0;
      offset + steadyDetectionWindowSize <= steadySize;
      offset += steadyDetectionWindowSize
    ) {
      const [freq, clarity] = this.windowDetector.findPitch(
        this.noteBuffer.subarray(
          steadyStart + offset,
          steadyStart + offset + steadyDetectionWindowSize,
        ),
        this.sampleRate,
      );
      // res.push([freq,clarity])
      const level = getNoteFromFreq(freq, 50).level;

      if (clarity > 0.5 && level) {
        votes.set(level, [freq, (votes.get(level) ?? 0) + 1]);
      }
    }

    if (votes.size === 0) {
      return ['', -1];
    }

    const best = [...votes.entries()].reduce((a, b) => b[1][1] > a[1][1] ? b : a);
    return [best[0], best[1][0]];
  }
}


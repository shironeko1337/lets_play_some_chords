import { PitchDetector } from "pitchy";

const RECT = 5;

export class Debugger {
  sampleRate = 44100;
  currentTimestamp = 0;
  bufferCounted = 0;
  selectedRectIndex = -1;
  onSelect = null;
  difBuffer = new Float32Array(4);

  constructor(canvas, container, onHover) {
    this.canvas = canvas;
    this.container = container;
    this.onHover = onHover;
    this.ctx2d = canvas.getContext("2d");
    this.meta = new Map(); // rectIndex -> { pitch, value, timestamp, audioTime }
    this.rectsPerRow = Math.floor((window.innerWidth - 10) / RECT);

    canvas.width = this.rectsPerRow * RECT;
    canvas.height = 30000;

    this._borderDiv = document.createElement("div");
    this._borderDiv.style.cssText = `background:red; position:absolute;width:${RECT}px;height:${RECT}px;border:1px solid red;box-sizing:border-box;pointer-events:none;display:none;`;
    container.appendChild(this._borderDiv);

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.floor(x / RECT);
      const row = Math.floor(y / RECT);
      onHover(this.meta.get(row * this.rectsPerRow + col) ?? null);
    });

    canvas.addEventListener("mouseleave", () => onHover(null));

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const idx =
        Math.floor(y / RECT) * this.rectsPerRow + Math.floor(x / RECT);
      if (this.meta.has(idx)) {
        this._selectRect(idx);
        this.onSelect?.(this.meta.get(idx));
      }
    });
  }

  bufferData = [];
  _previousBufferLast = undefined;
  _previousBuffer = undefined;
  _dupCheckSamples = [];
  _prevFreqBuf = null;
  _windowDetector = null;
  _noteStopBurstIndex = 0;
  _rawNoteBufferAudioTimes = [];

  // we need these two conditions to meet to know when a note starts
  // 1. frequency changes quickly
  // 2. wave increases
  prevFlux = 0;
  prevBufferMean = 0;

  lastAudioTime = 0;
  bufferSize = 0;
  noteBuffer = new Float32Array(10 * 4096); // buffer large enough to store one note's raw wave data
  noteStarted = false;
  noteBufferSize = 0;
  noteBurstBufferDataSize = 0;
  noteStartBufferIndex = -1; // when note starts, what is the index in the buffer data

  // these two are needed to identify when the note become smooth (best timing to know the real frequency)
  noteBurstFlux = -1; // flux when note bursts
  beforeFluxDropsQuickly = false; // if it's before the flux drops quickly, after flux drops

  update(
    timeStamp,
    pitch,
    pitchConfidence,
    rawSampleBuffer,
    audioTime = 0,
    freqBuf = null,
  ) {
    const currentBuffer = Array.from(rawSampleBuffer);
    const firstIndex = this._previousBuffer
      ? currentBuffer.findIndex(
          (x) => x === this._previousBuffer[this._previousBuffer.length - 1],
        )
      : 0;
    const lastIndex = this._previousBuffer
      ? currentBuffer.findLastIndex(
          (x) => x === this._previousBuffer[this._previousBuffer.length - 1],
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
    // if (this._previousBuffer && firstIndex === lastIndex)
    // console.log(
    //   firstIndex === lastIndex
    //     ? `common index ${firstIndex} of ${this._previousBuffer[firstIndex]}`
    //     : `different index ${firstIndex} ${lastIndex} of ${this._previousBuffer[firstIndex]}`,
    //   bufferDataStartIndex,
    // );
    this.lastAudioTime = audioTime;
    this._previousBuffer = currentBuffer;
    const prevBufferSize = this.bufferSize;
    this.currentTimestamp = timeStamp;
    const addedDataSize = rawSampleBuffer.length - bufferDataStartIndex;

    // for (let i = bufferDataStartIndex; i < rawSampleBuffer.length; i++) {
    //   this.bufferData.push({
    //     timeStamp,
    //     value: rawSampleBuffer[i],
    //     pitch,
    //   });
    // }
    this.bufferSize += addedDataSize;

    // collect samples between 1000ms–2000ms for duplicate check
    // if (audioTime >= 1.0 && audioTime < 2.0) {
    //   for (let i = bufferDataStartIndex; i < rawSampleBuffer.length; i++) {
    //     this._dupCheckSamples.push(rawSampleBuffer[i]);
    //   }
    // } else if (audioTime >= 2.0 && this._dupCheckSamples.length > 0) {
    //   const total = this._dupCheckSamples.length;
    //   const unique = new Set(this._dupCheckSamples).size;
    //   console.log(`[dupCheck] total samples 1s–2s: ${total}, unique: ${unique}, duplicates: ${total - unique} (${((total - unique) / total * 100).toFixed(1)}%)`);
    //   this._dupCheckSamples = [];
    // }

    let validBufferDataStartIndex =
      rawSampleBuffer.length - this.bufferSize + prevBufferSize;

    // the minimum duration (ms) of a note for identify
    const MIN_NOTE_RECOGNIZATION_DURATION = 150;

    // calc if current buffer contains the note start by flux
    const flux = freqBuf ? this.calcFlux(freqBuf, 1000) : null;
    const bufferMean = this.calcMean(rawSampleBuffer);
    const hasNoteStart =
      flux &&
      (!this.prevFlux || this.prevFlux * 10 < flux) &&
      bufferMean &&
      bufferMean > this.prevBufferMean;

    this.noteStarted |= hasNoteStart;
    if (this.noteStarted) {
      console.log(
        `[Note] ${audioTime}: pitch: ${pitch}, flux: ${flux}, bufferMean: ${bufferMean}`,
      );
    } else {
      console.log(
        `[Non note] ${audioTime}: pitch: ${pitch}, flux: ${flux}, bufferMean: ${bufferMean}`,
      );
    }

    // console.log(
    //   // performance.now(),
    //   "frame pitch",
    //   pitch,
    //   audioTime,
    //   // ((this.noteBufferSize + addedDataSize) / 44100) * 1000,
    //   this.prevFlux,
    //   flux,
    //   this.noteStarted,
    //   // addedDataSize,
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

      // console.log(audioTime, 'isNoteFinanlized',isNoteFinanlized);

      // console.log(audioTime, shouldEndCurrentNote);
      // we get a full note, try recognizing the note and move to next
      if (isNoteFinanlized) {
        const fixedPitch = this.getFixedPitchValue();
        // if (fixedPitch) {
        console.log(
          `Fixed pitch value is ${fixedPitch} starting at ${this.noteStartBufferIndex / 44100}ms ending at ${this.bufferSize / 44100}ms.`,
        );
        // }
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

    let level = this.getValidPitchLevel(pitch, pitchConfidence);
    if (level) {
      detectLogger(
        "[buffer] " + level,
        this.bufferSize - 2048,
        this.bufferSize,
      );
    }

    this.prevFlux = flux;
    this.prevBufferMean = bufferMean;
  }

  getFixedPitchValue() {
    const burstSize = this.noteBurstBufferDataSize;
    const steadyStart = burstSize;
    const steadySize = this.noteBufferSize - steadyStart;
    const steadyStartBufferIndex = this.noteStartBufferIndex + burstSize;
    const steadyDetectionWindow = 2048;

    if (!this._windowDetector)
      this._windowDetector = PitchDetector.forFloat32Array(
        steadyDetectionWindow,
      );

    // logs out the pitch detection result of the first buffer of burst
    // if the first buffer is too short to be detected (<2048), then
    // fill it up using the steady data but do not move the steady data start index
    const [burstFreq, burstClarity] = this._windowDetector.findPitch(
      this.noteBuffer.subarray(0, steadyDetectionWindow),
      this.sampleRate,
    );
    const burstPitch =
      getPitchLevel(burstFreq, 50).level || `${burstFreq.toFixed(1)}Hz`;
    detectLogger(
      `${burstPitch} for burst with clarity=${burstClarity.toFixed(2)}`,
      this.noteStartBufferIndex,
      this.noteStartBufferIndex + steadyDetectionWindow,
    );

    // loop through steady data and for each window log the detection result accurately
    const votes = new Map();
    const res = [];

    for (
      let offset = 0;
      offset + steadyDetectionWindow <= steadySize;
      offset += steadyDetectionWindow
    ) {
      const [freq, clarity] = this._windowDetector.findPitch(
        this.noteBuffer.subarray(
          steadyStart + offset,
          steadyStart + offset + steadyDetectionWindow,
        ),
        this.sampleRate,
      );
      const windowPitch =
        getPitchLevel(freq, 50).level || `${freq.toFixed(1)}Hz`;
      detectLogger(
        `${windowPitch} window with clarity=${clarity.toFixed(2)}`,
        steadyStartBufferIndex + offset,
        steadyStartBufferIndex + offset + steadyDetectionWindow,
      );
      res.push([freq, clarity, getPitchLevel(freq, 50).level, burstFreq]);
      if (clarity > 0.5 && getPitchLevel(freq, 50).level) {
        // apply burst correction: burst freq should be not be higher than 1.2xfreq
        let correctedFreq = freq;
        // if (burstFreq > freq * 1.2) correctedFreq = freq * 2;
        const finalLevel = getPitchLevel(correctedFreq, 50).level;
        if (finalLevel) {
          votes.set(finalLevel, (votes.get(finalLevel) ?? 0) + 1);
        }
      }
    }

    if (votes.size === 0) {
      return null;
    }

    console.log(
      "Fixed pitch: all freqs",
      res,
      "burst",
      burstFreq,
      burstClarity,
    );
    return [...votes.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }

  calcFlux(freqBuf, threshold) {
    const prev = this._prevFreqBuf;
    this._prevFreqBuf = new Uint8Array(freqBuf);
    if (!prev) return null;
    let flux = 0;
    for (let i = 0; i < freqBuf.length; i++) {
      const diff = freqBuf[i] - prev[i];
      if (diff > 0) flux += diff;
    }
    return flux > threshold ? flux : 0;
  }

  calcMean(buf, start = 0, end = buf.length) {
    let sum = 0;
    for (let i = start; i < end; i++) sum += Math.abs(buf[i]);
    return sum / (end - start);
  }

  flush() {
    for (const { timeStamp, value, pitch, sampleAudioTime } of this
      .bufferData) {
      this.renderSample(timeStamp, value, pitch, sampleAudioTime);
      this.bufferCounted++;
    }
    this.bufferData = [];
  }

  previousPitchLevel = undefined;
  previousPitchCount = 0;

  getValidPitchLevel(pitch, pitchConfidence) {
    // For guitar sound, if there are 3 consecutive pitch falls into the range
    // that close to the preset frequency, then it's a valid sound peak.
    const MIN_CONSECUTIVE_PITCH_COUNT = 3;
    const { deviation, level } = getPitchLevel(pitch);
    let res = "";
    // console.log(pitch, pitchConfidence, level, deviation);
    if (pitchConfidence > 0.7 && deviation && deviation < 1) {
      this.previousPitchCount =
        this.previousPitchLevel === level ? this.previousPitchCount + 1 : 1;
      if (this.previousPitchCount === MIN_CONSECUTIVE_PITCH_COUNT) {
        res = level;
      }
      this.previousPitchLevel = level;
    } else {
      this.previousPitchLevel = undefined;
      this.previousPitchCount = 0;
    }
    return res;
  }

  renderSample(timeStamp, value, pitch, audioTime = 0) {
    const gray = Math.round(((value + 1) / 2) * 255);
    const col = this.bufferCounted % this.rectsPerRow;
    const row = Math.floor(this.bufferCounted / this.rectsPerRow);
    this.ctx2d.fillStyle = `rgb(${gray},${gray},${gray})`;
    this.ctx2d.fillRect(col * RECT, row * RECT, RECT, RECT);
    this.meta.set(this.bufferCounted, {
      id: this.bufferCounted,
      pitch,
      value,
      timestamp: timeStamp,
      audioTime,
    });
  }

  // Set border to the rect whose ctx timestamp is closest to the given value
  setBorder(timestamp) {
    const idx = this._binarySearch((m) => m.timestamp, timestamp);
    if (idx >= 0) this._selectRect(idx);
  }

  // Call once at replay start — binary search to anchor
  startReplayAt(audioTime) {
    const idx = this._binarySearch((m) => m.audioTime, audioTime);
    this._replayStartRect = idx >= 0 ? idx : 0;
    this._replayVirtualStart = audioTime; // use the requested time, not the found anchor's
    if (idx >= 0) this._selectRect(idx);
  }

  // Call each RAF tick — O(1), no search
  advanceReplay(currentAudioTime) {
    const rect =
      this._replayStartRect +
      Math.round(
        (currentAudioTime - this._replayVirtualStart) * this.sampleRate,
      );
    this._selectRect(rect);
  }

  // Binary search meta (keys 0..bufferCounted-1) for the entry whose field value is closest to target
  _binarySearch(field, target) {
    const n = this.bufferCounted;
    if (n === 0) return -1;
    let lo = 0,
      hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (field(this.meta.get(mid)) < target) lo = mid + 1;
      else hi = mid;
    }
    // pick closer of lo and lo-1
    if (
      lo > 0 &&
      Math.abs(field(this.meta.get(lo - 1)) - target) <
        Math.abs(field(this.meta.get(lo)) - target)
    ) {
      return lo - 1;
    }
    return lo;
  }

  _selectRect(rectIndex) {
    this.selectedRectIndex = rectIndex;
    const col = rectIndex % this.rectsPerRow;
    const row = Math.floor(rectIndex / this.rectsPerRow);
    this._borderDiv.style.left = `${this.canvas.offsetLeft + col * RECT}px`;
    this._borderDiv.style.top = `${this.canvas.offsetTop + row * RECT}px`;
    this._borderDiv.style.display = "block";
  }

  locate(row) {
    this.container.scrollTop = (row + 1) * RECT;
  }

  clear() {
    this.ctx2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.noteStartBufferIndex = -1;
    this.meta.clear();
    this.bufferCounted = 0;
    this.lastAudioTime = 0;
    this.currentTimestamp = 0;
    this._noteStopBurstIndex = 0;
    this.selectedRectIndex = -1;
    this.bufferData = [];
    this._rawNoteBufferAudioTimes = [];
    this._prevFreqBuf = null;
    this._borderDiv.style.display = "none";
  }
}
function noteToFreq(level) {
  const notes = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const noteStr = level.slice(0, -1);
  const octave = parseInt(level.slice(-1));
  const n = octave * 12 + notes.indexOf(noteStr) - (4 * 12 + 9);
  return 440 * Math.pow(2, n / 12);
}

function getPitchLevel(freq, deviationThreshold = 1) {
  const invalidPitchResult = {
    level: "",
    deviation: undefined,
  };
  if (freq <= 0) {
    return invalidPitchResult; // Handle invalid or silent frequencies
  }

  // Only sharps, no flats
  const notes = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];

  const refIdx = 9; // A is index 9
  const refOctave = 4; // A4

  // Calculate semitones away from A4 (440 Hz)
  const nExact = 12 * Math.log2(freq / 440.0);
  const nClosest = Math.round(nExact);

  // Determine the closest note name and octave
  const totalIdx = refOctave * 12 + refIdx + nClosest;
  const octave = Math.floor(totalIdx / 12);
  const noteIdx = ((totalIdx % 12) + 12) % 12; // Handle potential negative modulo safely

  const level = `${notes[noteIdx]}${octave}`;

  // Calculate the exact standard frequency for this note
  const standardFreq = 440.0 * Math.pow(2, nClosest / 12);

  // Calculate percentage deviation from the standard frequency
  const deviation = ((freq - standardFreq) / standardFreq) * 100;

  // Return the object only if it falls within the allowed threshold
  if (Math.abs(deviation) <= deviationThreshold) {
    return {
      level: level,
      deviation: parseFloat(deviation.toFixed(2)), // Keep it clean to 2 decimal places
    };
  }

  return invalidPitchResult;
}

function detectLogger(info, startIndex, endIndex, sampleRate = 44100) {
  console.log(
    `Detected ${info} from ${msLog((startIndex / sampleRate) * 1000)}
    ms to ${msLog((1000 * endIndex) / sampleRate)}ms at [${startIndex},${endIndex})`,
  );
}

function msLog(val) {
  return Number(val).toFixed(2);
}

import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { SoundStream, Visualizer } from './model/sound_stream';
import { Debugger } from './debugger.js';

function DebugApp() {
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenLogRef = useRef<HTMLDivElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const debugContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audio2Ref = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<SoundStream | null>(null);
  const debuggerRef = useRef<any>(null);
  const replayRafRef = useRef<number | null>(null);
  const [hover, setHover] = useState<any>(null);
  const [hasFile, setHasFile] = useState(false);
  const [selectedMeta, setSelectedMeta] = useState<any>(null);
  const [isMainPlaying, setIsMainPlaying] = useState(false);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(0.1);
  const [isMicPlaying, setIsMicPlaying] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  useEffect(() => {
    const visualizer = new Visualizer(hiddenCanvasRef.current!, hiddenLogRef.current!);
    const stream = new SoundStream();
    streamRef.current = stream;

    const dbg = new Debugger(debugCanvasRef.current!, debugContainerRef.current!, setHover);
    dbg.onSelect = (meta: any) => setSelectedMeta(meta);
    debuggerRef.current = dbg;

    stream.init({ visualizer });
    enumerateDevices();
  }, []);

  const stopReplay = () => {
    if (replayRafRef.current !== null) {
      cancelAnimationFrame(replayRafRef.current);
      replayRafRef.current = null;
    }
    audio2Ref.current?.pause();
    setIsReplayPlaying(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const audio = audioRef.current;
    const stream = streamRef.current;
    if (!file || !audio || !stream) return;
    if (audio.src) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(file);
    setHasFile(true);
    await stream.initStream('file', audio);
    stream.debugCallback = (ts: number, pitch: number, clarity: number, buf: Float32Array, freqBuf: Uint8Array) =>
      debuggerRef.current?.update(ts, pitch, clarity, buf, audioRef.current?.currentTime ?? 0, freqBuf);
  };

  const handleReplay = async (speed: number) => {
    if (!selectedMeta) return;
    debuggerRef.current?.startReplayAt(selectedMeta.audioTime);
    setIsReplayPlaying(true);

    const audio2 = audio2Ref.current;
    const audio = audioRef.current;

    if (audio2 && audio && speed >= 0.0625) {
      audio2.src = audio.src;
      audio2.currentTime = selectedMeta.audioTime;
      console.log(`start playback at ${selectedMeta.audioTime} on ${speed}x speed`);
      audio2.playbackRate = speed;
      await audio2.play();
    }

    const tick = () => {
      debuggerRef.current?.advanceReplay(audio2Ref.current!.currentTime);
      replayRafRef.current = requestAnimationFrame(tick);
    };
    replayRafRef.current = requestAnimationFrame(tick);
  };

  const enumerateDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter(d => d.kind === 'audioinput');
    setAudioDevices(inputs);
    if (inputs.length > 0 && !selectedDeviceId) setSelectedDeviceId(inputs[0].deviceId);
  };

  const handleMicToggle = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (isMicPlaying) {
      stream.stop();
      debuggerRef.current?.flush();
      setIsMicPlaying(false);
    } else {
      debuggerRef.current?.clear();
      await stream.initStream('device', selectedDeviceId || undefined);
      // after permission granted, labels become available — refresh list
      await enumerateDevices();
      stream.debugCallback = (ts: number, pitch: number, clarity: number, buf: Float32Array, freqBuf: Uint8Array) =>
        debuggerRef.current?.update(ts, pitch, clarity, buf, ts / 1000, freqBuf);
      stream.start();
      setIsMicPlaying(true);
    }
  };

  const replayEnabled = !!selectedMeta && !isMainPlaying && !isReplayPlaying && !isMicPlaying;

  return (
    <div style={{ fontFamily: 'monospace', padding: 5 }}>
      <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, padding: '4px 0', borderBottom: '1px solid #ccc', marginBottom: 4 }}>
        <input type="file" accept="audio/*" onChange={handleFileChange} />
        <button
          onClick={handleMicToggle}
          disabled={isMainPlaying || isReplayPlaying}
          style={{ marginLeft: 8, padding: '4px 12px', border: 'none', borderRadius: 4, cursor: 'pointer', background: isMicPlaying ? '#e55' : '#48a', color: '#fff' }}
        >
          {isMicPlaying ? 'Stop mic' : 'Use mic'}
        </button>
        <select
          value={selectedDeviceId}
          onChange={e => setSelectedDeviceId(e.target.value)}
          disabled={isMicPlaying}
          style={{ marginLeft: 8, padding: '2px 4px' }}
        >
          {audioDevices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
        <audio
          ref={audioRef}
          controls
          style={{
            marginLeft: 12, verticalAlign: 'middle',
            display: hasFile ? 'inline' : 'none',
            pointerEvents: isReplayPlaying ? 'none' : 'auto',
            opacity: isReplayPlaying ? 0.4 : 1,
          }}
          onPlay={() => { debuggerRef.current?.clear(); streamRef.current?.start(); setIsMainPlaying(true); setSelectedMeta(null); }}
          onPause={() => { streamRef.current?.stop(); debuggerRef.current?.flush(); setIsMainPlaying(false); }}
          onEnded={() => { streamRef.current?.stop(); debuggerRef.current?.flush(); setIsMainPlaying(false); }}
        />
        {hasFile && (
          <>
            <input
              type="number" min="0.01" max="1" step="0.01"
              value={replaySpeed}
              onChange={e => setReplaySpeed(parseFloat(e.target.value))}
              style={{ marginLeft: 12, width: 60, padding: '2px 4px' }}
            />
            <span style={{ marginLeft: 4 }}>×</span>
            <button
              onClick={isReplayPlaying ? stopReplay : () => handleReplay(replaySpeed)}
              disabled={!isReplayPlaying && !replayEnabled}
              style={{ marginLeft: 8, padding: '4px 12px', border: 'none', borderRadius: 4, cursor: isReplayPlaying || replayEnabled ? 'pointer' : 'default', background: isReplayPlaying ? '#e55' : replayEnabled ? '#4a9' : '#aaa', color: '#fff' }}
            >
              {isReplayPlaying ? 'Stop replay' : 'Replay from here'}
            </button>
          </>
        )}
        {/* Hidden second audio source for replay */}
        <audio
          ref={audio2Ref}
          style={{ display: 'none' }}
          onEnded={stopReplay}
        />
        <span style={{ marginLeft: 16, color: '#555' }}>
          {hover
            ? `#${hover.id}  pitch: ${hover.pitch.toFixed(1)} Hz  value: ${hover.value.toFixed(4)}  audioTime: ${hover.audioTime.toFixed(3)} s`
            : selectedMeta
            ? `selected: audioTime=${selectedMeta.audioTime.toFixed(3)} s — click Replay from here`
            : 'hover or click a rectangle to inspect'}
        </span>
      </div>

      <canvas ref={hiddenCanvasRef} width={800} height={200} style={{ display: 'none' }} />
      <div ref={hiddenLogRef} style={{ display: 'none' }} />

      <div
        ref={debugContainerRef}
        style={{ position: 'relative', width: '100%', height: '90vh', overflow: 'auto', marginTop: 4, background: '#111' }}
      >
        <canvas ref={debugCanvasRef} style={{ display: 'block' }} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<DebugApp />);

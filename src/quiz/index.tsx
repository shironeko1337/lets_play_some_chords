import {useState, useRef, useEffect} from 'react';
import {Modal, ModalContent, ModalHeader, ModalBody, ModalFooter} from '@heroui/react';
import {Input} from '@heroui/react';
import {SoundStream} from '../model/sound_stream';
import {Quiz, QuizEngineStatus} from '../model/quiz';
import {QuizCanvas} from './canvas';
import {SongGenerator} from './song_generator';
import type {SoundSource} from '../types';

const IconFreq = ({active}: {active: boolean}) => (
  <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden>
    <circle cx="8" cy="8" r="6" fill={active ? '#22c55e' : '#9ca3af'} />
  </svg>
);

const IconCog = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const QuizTab = () => {
  const [gameStatus, setGameStatus] = useState<QuizEngineStatus>(QuizEngineStatus.READY);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioSource, setAudioSource] = useState('');

  const streamRef = useRef<SoundStream | null>(null);
  const streamInitRef = useRef<Promise<void> | null>(null);
  const quizRef = useRef<Quiz | null>(null);
  const quizCanvasRef = useRef(new QuizCanvas());

  useEffect(() => {
    const stream = new SoundStream();
    streamRef.current = stream;
    streamInitRef.current = stream.init();
    return () => stream.stop();
  }, []);

  useEffect(() => {
    if (gameStatus !== QuizEngineStatus.PLAYING) return;
    const song = quizRef.current?.song;
    if (!song) return;
    quizCanvasRef.current.update(
      song,
      () => quizRef.current?.track?.progress ?? 0,
      () => quizRef.current?.track?.currentTime ?? 0,
    );
    return () => quizCanvasRef.current.stop();
  }, [gameStatus]);

  const handleEnd = () => {
    quizRef.current?.track?.stop();
    streamRef.current?.stop();
    setIsConnected(false);
    setIsPaused(false);
    setGameStatus(QuizEngineStatus.END);
  };

  const handleTogglePause = () => {
    if (gameStatus === QuizEngineStatus.COUNTDOWN) {
      setIsPaused(p => !p);
      return;
    }
    const track = quizRef.current?.track;
    if (!track) return;
    if (isPaused) {
      track.resume();
      setIsPaused(false);
    } else {
      track.pause();
      setIsPaused(true);
    }
  };

  // initialise canvas + countdown value when entering countdown
  useEffect(() => {
    if (gameStatus !== QuizEngineStatus.COUNTDOWN) return;
    const song = quizRef.current?.song;
    if (song) quizCanvasRef.current.update(song, () => 0, () => 0);
    setCountdown(3);
    return () => quizCanvasRef.current.stop();
  }, [gameStatus]);

  // tick — pauses when isPaused, resumes from current value
  useEffect(() => {
    if (gameStatus !== QuizEngineStatus.COUNTDOWN || isPaused || countdown === null || countdown === 0) return;
    const id = setTimeout(() => {
      if (countdown <= 1) {
        quizRef.current?.track?.play();
        setCountdown(0);
        setTimeout(() => { setGameStatus(QuizEngineStatus.PLAYING); setCountdown(null); }, 200);
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [gameStatus, isPaused, countdown]);

  const handlePlay = async () => {
    setGameStatus(QuizEngineStatus.LOADING);
    await streamInitRef.current;
    const stream = streamRef.current!;
    const quiz = new Quiz();
    quizRef.current = quiz;

    const soundSource: SoundSource = {sourceType: 'instrument', instrumentType: 'piano'};
    const mmdPath = 'songs/morning_steps.mmd';

    await Promise.all([
      stream.initStream('device').then(() => {
        stream.onFrame = (pitch) => setIsConnected(pitch > 0);
        stream.start();
      }),
      new SongGenerator().fromFile(mmdPath, soundSource).then(audioBuffer =>
        quiz.loadFromMMD(soundSource, mmdPath, audioBuffer)
      ),
    ]);

    if (quiz.track) quiz.track.onEnded = handleEnd;
    setGameStatus(QuizEngineStatus.COUNTDOWN);
  };

  const handleBack = () => setGameStatus(QuizEngineStatus.READY);

  const isOngoing = gameStatus === QuizEngineStatus.PLAYING || gameStatus === QuizEngineStatus.LOADING || gameStatus === QuizEngineStatus.COUNTDOWN;
  const showCanvas = gameStatus === QuizEngineStatus.COUNTDOWN || gameStatus === QuizEngineStatus.PLAYING || gameStatus === QuizEngineStatus.END;

  return (
    <div className="relative min-h-64">
      {/* Top-right icon buttons */}
      <div className="absolute top-0 right-0 flex items-center gap-2">
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 bg-white"
          aria-label="Frequency status"
          title={isConnected ? 'Signal detected' : 'No signal'}
        >
          <IconFreq active={isConnected} />
        </button>
        <button
          disabled={isOngoing}
          onClick={() => setSettingsOpen(true)}
          className={`w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 bg-white transition-colors
            ${isOngoing ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-900 hover:border-gray-400'}`}
          aria-label="Settings"
        >
          <IconCog />
        </button>
      </div>

      {/* Canvas — mounted from countdown onwards, stays visible through ended */}
      {showCanvas && (
        <div className="relative mt-10">
          <canvas
            ref={(el) => { if (el) quizCanvasRef.current.init(el); }}
            className="rounded-lg bg-gray-100 w-full"
            width={800}
            height={800}
          />
          {gameStatus === QuizEngineStatus.COUNTDOWN && countdown !== null && (
            <div
              className={`absolute inset-0 flex items-center justify-center rounded-lg
                transition-opacity duration-200 ${countdown === 0 ? 'opacity-0' : 'opacity-100'}`}
              style={{background: 'rgba(0,0,0,0.5)'}}
            >
              <span className="text-white font-bold select-none" style={{fontSize: '8rem', lineHeight: 1}}>
                {countdown > 0 ? countdown : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Center content */}
      <div className={`flex items-center justify-center ${showCanvas ? 'py-4' : 'min-h-64'}`}>
        {gameStatus === QuizEngineStatus.READY && (
          <button
            onClick={handlePlay}
            className="px-10 py-5 text-xl font-bold bg-blue-500 text-white rounded-2xl
                       hover:bg-blue-600 active:scale-95 transition-all shadow-lg"
          >
            Play
          </button>
        )}
        {gameStatus === QuizEngineStatus.LOADING && (
          <span className="text-gray-400 text-lg animate-pulse">Loading…</span>
        )}
        {(gameStatus === QuizEngineStatus.COUNTDOWN || gameStatus === QuizEngineStatus.PLAYING) && (
          <div className="flex gap-4">
            <button
              onClick={handleTogglePause}
              className="px-10 py-5 text-xl font-bold bg-yellow-400 text-white rounded-2xl
                         hover:bg-yellow-500 active:scale-95 transition-all shadow-lg"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={handleEnd}
              className="px-10 py-5 text-xl font-bold bg-red-500 text-white rounded-2xl
                         hover:bg-red-600 active:scale-95 transition-all shadow-lg"
            >
              End
            </button>
          </div>
        )}
        {gameStatus === QuizEngineStatus.END && (
          <button
            onClick={handleBack}
            className="px-10 py-5 text-xl font-bold bg-gray-500 text-white rounded-2xl
                       hover:bg-gray-600 active:scale-95 transition-all shadow-lg"
          >
            Back
          </button>
        )}
      </div>

      {/* Settings dialog */}
      <Modal isOpen={settingsOpen} onOpenChange={setSettingsOpen}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Settings</ModalHeader>
              <ModalBody>
                <Input
                  label="Audio Source"
                  placeholder="Device ID or URL"
                  value={audioSource}
                  onValueChange={setAudioSource}
                />
              </ModalBody>
              <ModalFooter>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

import {useEffect, useRef, useState} from 'react';
import {Select, SelectItem} from '@heroui/select';
import {Tabs, Tab} from '@heroui/react';
import {SoundStream, SoundStreamSourceType} from './model/sound_stream';
import {ChordStreamVisualizer} from './chord_visualizer';
import {SAMPLE_FILES, playInstrumentNote} from './util';
import type {Note, NoteGroup} from './util';
import {playChord, OSCILLATOR_INSTRUMENTS} from './midi_util';
import type {OscillatorInstrument} from './midi_util';
import type {PlaySourceType} from './types';

const INSTRUMENT_NAMES = Object.keys(SAMPLE_FILES).map(key => ({
  key,
  label: key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
}));

export const SoundVisualizer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<SoundStream | null>(null);
  const [stream, setStream] = useState<SoundStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [sourceType, setSourceType] = useState<SoundStreamSourceType>('device');

  const [playSource, setPlaySource] = useState<PlaySourceType>('midi-wave');
  const [oscInstrument, setOscInstrument] = useState<OscillatorInstrument>('sine');
  const [sampleInstrument, setSampleInstrument] = useState<string>('piano');

  useEffect(() => {
    const soundStream = new SoundStream();
    streamRef.current = soundStream;
    soundStream.init().then(() => setStream(soundStream));
    navigator.mediaDevices.enumerateDevices().then(all => {
      const inputs = all.filter(d => d.kind === 'audioinput');
      setDevices(inputs);
      if (inputs.length > 0) setSelectedDeviceId(inputs[0].deviceId);
    });
  }, []);

  const handleTabChange = (key: React.Key) => {
    const stream = streamRef.current;
    const audio = audioRef.current;
    if (!stream) return;
    const newType = key as SoundStreamSourceType;
    setSourceType(newType);
    if (newType === 'device') {
      stream.initStream('device');
    } else if (audio) {
      stream.initStream('file', audio);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const audio = audioRef.current;
    if (!file || !audio) return;
    if (audio.src) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(file);
  };

  const handleToggle = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (isMonitoring) {
      stream.stop();
    } else {
      if (sourceType === 'device') {
        await stream.initStream('device', selectedDeviceId || undefined);
        navigator.mediaDevices.enumerateDevices().then(all => {
          const inputs = all.filter(d => d.kind === 'audioinput');
          setDevices(inputs);
          if (!selectedDeviceId && inputs.length > 0) setSelectedDeviceId(inputs[0].deviceId);
        });
      }
      stream.start();
    }
    setIsMonitoring(m => !m);
  };

  const handleClickNote = (note: Note, group: NoteGroup) => {
    if (playSource === 'midi-wave') {
      playChord(note, group, oscInstrument);
    } else {
      playInstrumentNote(note, group, sampleInstrument);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <Tabs
          classNames={{'tabList': 'h-14', 'panel': 'py-0'}}
          isDisabled={isMonitoring}
          selectedKey={sourceType}
          onSelectionChange={handleTabChange}
          aria-label="Sound source"
        >
          <Tab key="device" title="Device input">
            <Select
              label="Audio input"
              className="w-64"
              isDisabled={isMonitoring}
              selectedKeys={selectedDeviceId ? [selectedDeviceId] : []}
              onSelectionChange={keys => setSelectedDeviceId(Array.from(keys)[0] as string)}
            >
              {devices.map(d => (
                <SelectItem key={d.deviceId}>{d.label || d.deviceId}</SelectItem>
              ))}
            </Select>
          </Tab>
          <Tab key="file" title="Local file">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="mt-2 text-sm text-gray-600
                file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
                file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100 cursor-pointer"
            />
          </Tab>
        </Tabs>

        {sourceType === 'device' && (
          <button
            onClick={handleToggle}
            className={`h-14 mb-1 px-4 py-2 font-semibold rounded-lg text-white transition-all active:scale-95
              ${isMonitoring ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isMonitoring ? 'Stop' : 'Start'}
          </button>
        )}

        <Tabs
          classNames={{'tabList': 'h-14', 'panel': 'py-0'}}
          selectedKey={playSource}
          onSelectionChange={key => setPlaySource(key as PlaySourceType)}
          aria-label="Play source"
        >
          <Tab key="midi-wave" title="MIDI Wave">
            <Select
              label="Waveform"
              className="w-40"
              selectedKeys={[oscInstrument]}
              onSelectionChange={keys => setOscInstrument(Array.from(keys)[0] as OscillatorInstrument)}
            >
              {OSCILLATOR_INSTRUMENTS.map(inst => (
                <SelectItem key={inst}>{inst}</SelectItem>
              ))}
            </Select>
          </Tab>
          <Tab key="instrument" title="Instrument">
            <Select
              label="Instrument"
              className="w-52"
              selectedKeys={[sampleInstrument]}
              onSelectionChange={keys => setSampleInstrument(Array.from(keys)[0] as string)}
            >
              {INSTRUMENT_NAMES.map(({key, label}) => (
                <SelectItem key={key}>{label}</SelectItem>
              ))}
            </Select>
          </Tab>
        </Tabs>
      </div>

      <audio
        ref={audioRef}
        controls
        className={`w-full ${sourceType === 'file' ? '' : 'hidden'}`}
        onLoadedMetadata={() => {
          const audio = audioRef.current;
        }}
        onPlay={() => {streamRef.current?.start(); setIsMonitoring(true);}}
        onPause={() => {streamRef.current?.stop(); setIsMonitoring(false);}}
        onEnded={() => {streamRef.current?.stop(); setIsMonitoring(false);}}
      />

      {stream && (
        <ChordStreamVisualizer
          soundStream={stream}
          isStreaming={isMonitoring}
          onClickNote={handleClickNote}
        />
      )}
    </div>
  );
};

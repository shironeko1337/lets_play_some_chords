import type {OscillatorInstrument} from './midi_util';

export type PlaySourceType = 'instrument' | 'midi-wave';

export type SampleInstrumentType =
  | 'bass-electric' | 'bassoon' | 'cello' | 'clarinet' | 'contrabass'
  | 'flute' | 'french-horn' | 'guitar-acoustic' | 'guitar-electric' | 'guitar-nylon'
  | 'harmonium' | 'harp' | 'organ' | 'piano' | 'saxophone'
  | 'trombone' | 'trumpet' | 'tuba' | 'violin' | 'xylophone';

export type InstrumentType = OscillatorInstrument | SampleInstrumentType;

export type SoundSource =
  | { sourceType: 'midi-wave'; instrumentType: OscillatorInstrument }
  | { sourceType: 'instrument'; instrumentType: SampleInstrumentType };

import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Slider } from "@heroui/slider";
import { Chip } from "@heroui/chip";
import { RadioGroup, Radio } from "@heroui/radio";
import { Select, SelectItem } from "@heroui/select";
import { HeroUIProvider } from "@heroui/system";
import "./index.css";
import {
  getChordMIDI,
  IonicScale,
  loadInstrument,
  midi2note,
  play,
} from "./util";

const INSTRUMENTS = [
  { name: "Piano", key: "piano" },
  { name: "Guitar (Acoustic)", key: "guitar-acoustic" },
  { name: "Guitar (Electric)", key: "guitar-electric" },
  { name: "Guitar (Nylon)", key: "guitar-nylon" },
  { name: "Violin", key: "violin" },
  { name: "Cello", key: "cello" },
  { name: "Bass (Electric)", key: "bass-electric" },
  { name: "Contrabass", key: "contrabass" },
  { name: "Harp", key: "harp" },
  { name: "Organ", key: "organ" },
  { name: "Harmonium", key: "harmonium" },
  { name: "Flute", key: "flute" },
  { name: "Clarinet", key: "clarinet" },
  { name: "Saxophone", key: "saxophone" },
  { name: "Trumpet", key: "trumpet" },
  { name: "Trombone", key: "trombone" },
  { name: "French Horn", key: "french-horn" },
  { name: "Tuba", key: "tuba" },
  { name: "Bassoon", key: "bassoon" },
  { name: "Xylophone", key: "xylophone" },
];

const SCALES = [
  { name: "I (Tonic chord) 主和弦", color: "primary" as const, shift: 0 },
  {
    name: "ii (Supertonic chord) 上主和弦",
    color: "primary" as const,
    shift: 2,
  },
  { name: "iii (Mediant chord) 中和弦", color: "success" as const, shift: 4 },
  {
    name: "IV (Subdominant chord) 下属和弦",
    color: "danger" as const,
    shift: 5,
  },
  { name: "V (Dominant chord) 属和弦", color: "danger" as const, shift: 7 },
  {
    name: "vi (Submediant chord) 下中和弦",
    color: "primary" as const,
    shift: 9,
  },
  {
    name: "vii° (Leading-tone chord) 导和弦",
    color: "secondary" as const,
    shift: 11,
  },
  { name: "Customized 自定义", color: "default" as const, shift: -1 },
];

const CHORD_TYPES = ["Traid", "Seventh"];

function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [instrumentName, setInstrumentName] = useState<any>(null);
  const [instrument, setInstrument] = useState<any>(null);
  const [rootMIDI, setRootMIDI] = useState(52); // E3
  const [chordType, setChordTypes] = useState(0);
  const [volume, setVolume] = useState(-10); // Volume in dB
  const [instrumentLoading, setInstrumentLoading] = useState(false);
  const [playingNotes, setPlayingNotes] = useState("-");
  const [guessNotes, setGuessNotes] = useState("-");
  const [highlightedNotes, setHighlightedNotes] = useState<any>([]);
  const [freeNotesMode, setFreeNotesMode] = useState(false);
  const [lastPlayedNotes, setLastPlayedNotes] = useState<any>([]);
  const [randomPlayedChordIndex, setRandomPlayedChordIndex] = useState<
    number | null
  >(null);

  const handleStart = () => {
    setHasStarted(true);
    setInstrumentName("piano");
  };

  useEffect(() => {
    if (!instrumentName || instrumentLoading) return;
    setInstrumentLoading(true);
    if (instrument) {
      instrument.dispose();
    }
    loadInstrument(instrumentName)
      .then((instrument: any) => {
        setInstrumentLoading(false);
        setInstrument(instrument);
      })
      .catch(() => setInstrumentLoading(false));
  }, [instrumentName]);

  useEffect(() => {
    if (instrument) {
      instrument.volume.value = volume;
    }
  }, [volume, instrument]);

  const playChord = (index: number, shouldShowChordInfo: boolean) => {
    const scale = SCALES[index];
    setFreeNotesMode(false);
    const chordRootMIDI = rootMIDI + scale.shift;
    const noteMIDI = getChordMIDI(chordRootMIDI, IonicScale[index][chordType]);
    const lastPlayedNotes = play({
      noteMIDI,
      instrument,
    });
    if (shouldShowChordInfo) {
      setHighlightedNotes(noteMIDI);
      setPlayingNotes(lastPlayedNotes);
    }
  };

  const onGuessRandomPlayedChord = (guessIndex: number) => {
    const name = SCALES[randomPlayedChordIndex!].name;
    if (randomPlayedChordIndex !== guessIndex) {
      setGuessNotes(`猜错了, 正确答案: ${name}`);
    } else {
      setGuessNotes(`猜对了, 正是 ${name}!`);
    }
    setRandomPlayedChordIndex(null);
  };

  return (
    <HeroUIProvider>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-8 relative">
          {/* Start Backdrop */}
          {!hasStarted && (
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-xl flex items-center justify-center z-50">
              <button
                onClick={handleStart}
                className="px-8 py-4 text-2xl font-bold bg-blue-500 text-white rounded-xl
                         hover:bg-blue-600 active:scale-95 transition-all shadow-2xl"
              >
                Start
              </button>
            </div>
          )}

          <div className="flex gap-12">
            {/* Left Panel */}
            <div className="w-80 flex flex-col gap-8">
              {/* Instrument Choice */}
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  Instrument
                </h2>
                <Select
                  label="Select an instrument"
                  selectedKeys={instrumentName ? [instrumentName] : []}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0];
                    setInstrumentName(selected as string);
                  }}
                >
                  {INSTRUMENTS.map((instrument) => (
                    <SelectItem key={instrument.key}>
                      {instrument.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {/* Chord Type Choice */}
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  Chord Type
                </h2>
                <RadioGroup
                  value={chordType.toString()}
                  onValueChange={(value) => setChordTypes(parseInt(value))}
                  orientation="vertical"
                >
                  {CHORD_TYPES.map((type, index) => (
                    <Radio key={type} value={index.toString()}>
                      {type}
                    </Radio>
                  ))}
                </RadioGroup>
              </div>

              {/* Root Note Slider */}
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  Root Note
                </h2>
                <Slider
                  value={rootMIDI}
                  onChange={(value) => setRootMIDI(value as number)}
                  minValue={40}
                  maxValue={76}
                  step={1}
                  showSteps={true}
                  marks={[
                    { value: 40, label: "E2" },
                    { value: 52, label: "E3" },
                    { value: 64, label: "E4" },
                    { value: 76, label: "E5" },
                  ]}
                  className="max-w-md"
                  aria-label="Root Note"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Current: {midi2note(rootMIDI)}
                </p>
              </div>

              {/* Volume Slider */}
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-gray-800">Volume</h2>
                <Slider
                  value={volume}
                  onChange={(value) => setVolume(value as number)}
                  minValue={-60}
                  maxValue={0}
                  step={0.1}
                  showSteps={false}
                  className="max-w-md"
                  aria-label="Volume"
                />
                <p className="text-sm text-gray-600 mt-2">
                  {volume.toFixed(1)} dB
                </p>
              </div>
            </div>

            {/* Right Panel */}
            <div className="flex-1 flex flex-col gap-8">
              {/* Scale Degree Chips */}
              <div className="flex flex-wrap gap-3">
                {SCALES.map((scale, index) => (
                  <Chip
                    className="cursor-pointer"
                    key={scale.name}
                    color={scale.color}
                    variant="flat"
                    onClick={() => {
                      if (scale.shift > -1) {
                        let shouldShowChordInfo = true;
                        if (randomPlayedChordIndex !== null) {
                          onGuessRandomPlayedChord(index);
                          shouldShowChordInfo = false;
                        } else {
                          setGuessNotes("");
                        }
                        playChord(index, shouldShowChordInfo);
                      } else {
                        if (lastPlayedNotes) {
                          setPlayingNotes(
                            play({
                              noteMIDI: lastPlayedNotes,
                              instrument,
                            })
                          );
                        }
                        setFreeNotesMode(true);
                      }
                    }}
                  >
                    {scale.name}
                  </Chip>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    playChord(0, true);
                  }}
                  className="px-4 py-2 text-lg font-bold bg-gray-400 text-white rounded-xl
                         hover:bg-gray-600 active:scale-95 transition-all shadow-2xl"
                >
                  Play tonic
                </button>
                <button
                  onClick={() => {
                    let index = randomPlayedChordIndex;
                    if (!randomPlayedChordIndex) {
                      index = ~~(Math.random() * (SCALES.length - 2)) + 1;
                      setRandomPlayedChordIndex(index);
                      setGuessNotes("点击上方和弦进行猜测");
                    }
                    playChord(index!, false);
                  }}
                  className="px-4 py-2 text-lg font-bold bg-green-400 text-white rounded-xl
                         hover:bg-blue-600 active:scale-95 transition-all shadow-2xl"
                >
                  Play a random chord from above (except tonic)
                </button>
              </div>

              {/* Note Buttons */}
              <div className="grid grid-cols-6 gap-3">
                {Array.from({ length: 24 }, (_, i) => {
                  const noteMIDI = i + rootMIDI;
                  const highlighted = freeNotesMode
                    ? lastPlayedNotes.includes(noteMIDI)
                    : highlightedNotes.includes(noteMIDI);

                  return (
                    <button
                      onClick={() => {
                        if (freeNotesMode) {
                          setLastPlayedNotes(
                            [noteMIDI, ...lastPlayedNotes].slice(
                              0,
                              chordType === 0 ? 3 : 4
                            )
                          );
                        }
                        setPlayingNotes(
                          play({
                            noteMIDI: [noteMIDI],
                            instrument,
                          })
                        );
                      }}
                      key={i + rootMIDI}
                      className={`cursor-pointer px-4 py-3 text-lg font-semibold border-2 border-gray-200
                             ${
                               highlighted ? `bg-orange-400` : `bg-white`
                             } rounded-lg hover:bg-gray-50 hover:border-blue-500
                             active:scale-95 transition-all`}
                    >
                      {midi2note(noteMIDI)}
                    </button>
                  );
                })}
              </div>
              <h2 className="text-lg font-semibold text-gray-800">Info</h2>
              <div>Last played notes: {playingNotes}</div>
              {guessNotes ? <div>{guessNotes}</div> : null}
              {instrumentLoading ? <div>Loading instruments...</div> : null}
            </div>
          </div>
        </div>
      </div>
    </HeroUIProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

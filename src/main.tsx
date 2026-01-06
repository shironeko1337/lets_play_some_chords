import React, { useCallback, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Slider } from "@heroui/slider";
import { Chip } from "@heroui/chip";
import { RadioGroup, Radio } from "@heroui/radio";
import { HeroUIProvider } from "@heroui/system";
import "./index.css";
import { IonicScale, midi2note, NOTES, playChord, playNote } from "./util";

const SCALES = [
  { name: "Tonic", color: "primary" as const },
  { name: "Supertonic", color: "secondary" as const },
  { name: "Mediant", color: "success" as const },
  { name: "Subdominant", color: "warning" as const },
  { name: "Dominant", color: "danger" as const },
  { name: "Submediant", color: "primary" as const },
  { name: "Leading-tone", color: "secondary" as const },
];

const CHORD_TYPES = ["Thirds", "Sevenths"];

function App() {
  const [instrument, setInstrument] = useState("piano");
  const [rootMIDI, setRootMIDI] = useState(40); // E2
  const [chordType, setChordTypes] = useState(1);
  const ctxRef = useRef(new AudioContext());
  const ctx = ctxRef.current;

  const getNote = useCallback(
    (index: number) => {
      return NOTES[index % 12];
    },
    [rootMIDI]
  );

  return (
    <HeroUIProvider>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <div className="flex gap-12">
            {/* Left Panel */}
            <div className="w-80 flex flex-col gap-8">
              {/* Instrument Choice */}
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  Instrument
                </h2>
                <RadioGroup
                  value={instrument}
                  onValueChange={setInstrument}
                  orientation="vertical"
                >
                  <Radio value="piano">Piano</Radio>
                  <Radio value="guitar">Guitar</Radio>
                </RadioGroup>
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
                  maxValue={64}
                  step={1}
                  showSteps={true}
                  marks={[
                    { value: 40, label: "E2" },
                    { value: 52, label: "E3" },
                    { value: 64, label: "E4" },
                  ]}
                  className="max-w-md"
                  aria-label="Root Note"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Current: {midi2note(rootMIDI)}
                </p>
              </div>
            </div>

            {/* Right Panel */}
            <div className="flex-1 flex flex-col gap-8">
              {/* Scale Degree Chips */}
              <div className="flex flex-wrap gap-3">
                {SCALES.map((scale, index) => (
                  <Chip
                    key={scale.name}
                    color={scale.color}
                    variant="flat"
                    onClick={() => {
                      playChord(ctx, {
                        rootMIDI,
                        chordMIDI: IonicScale[index][chordType],
                      });
                    }}
                  >
                    {scale.name}
                  </Chip>
                ))}
              </div>

              {/* Note Buttons */}
              <div className="grid grid-cols-6 gap-3">
                {Array.from({ length: 24 }, (_, i) => {
                  const noteMIDI = i + rootMIDI;
                  return (
                    <button
                      onClick={() => playNote(ctx, { noteMIDI })}
                      key={i + rootMIDI}
                      className="px-4 py-3 text-lg font-semibold border-2 border-gray-200
                             bg-white rounded-lg hover:bg-gray-50 hover:border-blue-500
                             active:scale-95 transition-all"
                    >
                      {midi2note(noteMIDI)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </HeroUIProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

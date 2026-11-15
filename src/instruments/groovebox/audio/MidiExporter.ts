/**
 * src/instruments/groovebox/audio/MidiExporter.ts
 *
 * - Multi-Track Standard MIDI File (`.mid` Format 1) Binary Encoder
 *   preserving extendable note durations (`durationSteps`), velocities, and micro-timing.
 * - Web MIDI API (`navigator.requestMIDIAccess`) Input & MIDI Learn Manager.
 */

import type { GrooveboxProject, Pattern } from '../types';

const TICKS_PER_QUARTER = 480;
const TICKS_PER_16TH = TICKS_PER_QUARTER / 4; // 120 ticks per 16th step

function writeVarLen(value: number): number[] {
  let v = Math.max(0, Math.round(value));
  const bytes: number[] = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function stringToBytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    out.push(str.charCodeAt(i) & 0xff);
  }
  return out;
}

function int32Bytes(val: number): number[] {
  return [
    (val >> 24) & 0xff,
    (val >> 16) & 0xff,
    (val >> 8) & 0xff,
    val & 0xff,
  ];
}

function int16Bytes(val: number): number[] {
  return [(val >> 8) & 0xff, val & 0xff];
}

interface RawMidiEvent {
  tick: number;
  data: number[];
}

function buildMidiTrackChunk(events: RawMidiEvent[], trackName: string): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick);
  const body: number[] = [];

  // Track Name Meta Event (FF 03 len text)
  const nameBytes = stringToBytes(trackName);
  body.push(0x00, 0xff, 0x03, nameBytes.length, ...nameBytes);

  let lastTick = 0;
  for (const ev of sorted) {
    const delta = Math.max(0, ev.tick - lastTick);
    lastTick = ev.tick;
    body.push(...writeVarLen(delta), ...ev.data);
  }

  // End of Track Meta Event (00 FF 2F 00)
  body.push(0x00, 0xff, 0x2f, 0x00);

  return [
    ...stringToBytes('MTrk'),
    ...int32Bytes(body.length),
    ...body,
  ];
}

/**
 * Encodes a GrooveboxProject's active pattern into a Standard MIDI File (Format 1) Blob.
 */
export function encodeProjectPatternToMidiBlob(
  project: GrooveboxProject,
  pattern?: Pattern
): Blob {
  const activePattern =
    pattern ??
    project.patterns[project.activePatternId] ??
    Object.values(project.patterns)[0];

  const totalSteps = activePattern.bars * 16;
  const numTracks = 1 + activePattern.tracks.length; // Tempo track + 8 instrument tracks

  const headerChunk = [
    ...stringToBytes('MThd'),
    ...int32Bytes(6),
    ...int16Bytes(1), // Format 1 (multi-track)
    ...int16Bytes(numTracks),
    ...int16Bytes(TICKS_PER_QUARTER),
  ];

  // Track 0: Tempo Meta Track
  const mpqn = Math.round(60_000_000 / Math.max(40, project.bpm));
  const tempoTrackEvents: RawMidiEvent[] = [
    {
      tick: 0,
      data: [
        0xff,
        0x51,
        0x03,
        (mpqn >> 16) & 0xff,
        (mpqn >> 8) & 0xff,
        mpqn & 0xff,
      ],
    },
  ];
  const chunks: number[][] = [
    headerChunk,
    buildMidiTrackChunk(tempoTrackEvents, `${project.name} Tempo`),
  ];

  // Tracks 1..8
  for (const seq of activePattern.tracks) {
    const trackMeta = project.tracks[seq.trackIndex];
    const channel = trackMeta?.isDrum ? 9 : seq.trackIndex % 8; // Ch 10 (index 9) for drums
    const trackEvents: RawMidiEvent[] = [];

    for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
      const step = seq.steps[stepIdx % seq.lengthSteps];
      if (!step || !step.active) continue;

      const microTickOffset = Math.round(step.microTiming * TICKS_PER_16TH);
      const startTick = Math.max(0, stepIdx * TICKS_PER_16TH + microTickOffset);

      for (const note of step.notes) {
        const midiNote = Math.min(127, Math.max(0, Math.round(note.midiNote)));
        const vel = Math.min(
          127,
          Math.max(1, Math.round((note.velocity || step.velocity) * 127))
        );
        const durTicks = Math.max(
          30,
          Math.round(note.durationSteps * TICKS_PER_16TH * 0.92)
        );

        trackEvents.push({
          tick: startTick,
          data: [0x90 | channel, midiNote, vel],
        });
        trackEvents.push({
          tick: startTick + durTicks,
          data: [0x80 | channel, midiNote, 0],
        });
      }
    }

    chunks.push(
      buildMidiTrackChunk(
        trackEvents,
        trackMeta ? `${trackMeta.index + 1}-${trackMeta.name}` : `Track ${seq.trackIndex + 1}`
      )
    );
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const uint8 = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    uint8.set(c, offset);
    offset += c.length;
  }

  return new Blob([uint8], { type: 'audio/midi' });
}

export function downloadMidiFile(project: GrooveboxProject): void {
  const blob = encodeProjectPatternToMidiBlob(project);
  const url = URL.createObjectURL(blob);
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}-${project.activePatternId.toLowerCase()}-${project.bpm}bpm.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export interface WebMidiCallbacks {
  onNoteOn: (midiNote: number, velocity: number, channel: number) => void;
  onControlChange: (cc: number, valueNorm: number, channel: number) => void;
  onStatusChange: (connectedInputs: string[]) => void;
}

/**
 * Web MIDI API (`navigator.requestMIDIAccess`) listener with clean teardown.
 */
export class GrooveboxMidiManager {
  private callbacks: WebMidiCallbacks;
  private midiAccess: MIDIAccess | null = null;
  private boundInputs: MIDIInput[] = [];

  constructor(callbacks: WebMidiCallbacks) {
    this.callbacks = callbacks;
  }

  public async connect(): Promise<string[]> {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      this.callbacks.onStatusChange([]);
      return [];
    }

    try {
      const access = await navigator.requestMIDIAccess();
      this.midiAccess = access;
      this.bindAllInputs();
      access.onstatechange = () => this.bindAllInputs();
      return this.boundInputs.map((i) => i.name || 'MIDI Input');
    } catch {
      this.callbacks.onStatusChange([]);
      return [];
    }
  }

  public dispose(): void {
    for (const input of this.boundInputs) {
      input.onmidimessage = null;
    }
    this.boundInputs = [];
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null;
      this.midiAccess = null;
    }
  }

  private bindAllInputs(): void {
    for (const input of this.boundInputs) {
      input.onmidimessage = null;
    }
    this.boundInputs = [];

    if (!this.midiAccess) return;
    const names: string[] = [];

    this.midiAccess.inputs.forEach((input) => {
      this.boundInputs.push(input);
      names.push(input.name || 'MIDI Device');
      input.onmidimessage = (ev: MIDIMessageEvent) => {
        const data = ev.data;
        if (!data || data.length < 2) return;
        const status = data[0] & 0xf0;
        const channel = data[0] & 0x0f;
        const data1 = data[1];
        const data2 = data.length > 2 ? data[2] : 0;

        if (status === 0x90 && data2 > 0) {
          this.callbacks.onNoteOn(data1, data2 / 127, channel);
        } else if (status === 0xb0) {
          this.callbacks.onControlChange(data1, data2 / 127, channel);
        }
      };
    });

    this.callbacks.onStatusChange(names);
  }
}

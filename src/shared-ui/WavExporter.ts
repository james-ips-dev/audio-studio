/**
 * src/shared-ui/WavExporter.ts
 *
 * Stateless Float32Array -> 16-bit PCM `.wav` Blob encoder and real-time
 * stereo master bus session recorder (48kHz native).
 * Zero coupling to any specific instrument's state.
 */

function writeAsciiString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Encodes stereo (or mono duplicated to stereo) Float32Array PCM buffers into a
 * standard 44-byte RIFF/WAVE 16-bit PCM Blob.
 */
export function encodeWav16BitStereo(
  leftChannel: Float32Array,
  rightChannel: Float32Array,
  sampleRate: number = 48000
): Blob {
  const frameCount = Math.min(leftChannel.length, rightChannel.length);
  const numChannels = 2;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // AudioFormat = 1 (Linear PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    const sampleL = Math.max(-1, Math.min(1, leftChannel[i]));
    const sampleR = Math.max(-1, Math.min(1, rightChannel[i]));

    view.setInt16(
      offset,
      sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7fff,
      true
    );
    offset += 2;

    view.setInt16(
      offset,
      sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7fff,
      true
    );
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Triggers a browser download for a generated `.wav` or `.mid` Blob.
 */
export function downloadAudioBlob(blob: Blob, filename: string): void {
  const safeName = filename.toLowerCase().endsWith('.wav')
    ? filename
    : `${filename}.wav`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Real-time stereo WAV session recorder that taps any Web Audio `AudioNode`
 * at native sample rate (48kHz) and exports a timestamped 16-bit PCM `.wav`.
 */
export class LiveStereoWavRecorder {
  private audioCtx: AudioContext;
  private sourceNode: AudioNode;
  private processorNode: ScriptProcessorNode | null = null;
  private silentSink: GainNode | null = null;
  private leftChunks: Float32Array[] = [];
  private rightChunks: Float32Array[] = [];
  private recording: boolean = false;
  private totalSamples: number = 0;

  constructor(audioCtx: AudioContext, sourceNode: AudioNode) {
    this.audioCtx = audioCtx;
    this.sourceNode = sourceNode;
  }

  public start(): void {
    if (this.recording) return;
    this.leftChunks = [];
    this.rightChunks = [];
    this.totalSamples = 0;
    this.recording = true;

    const processor = this.audioCtx.createScriptProcessor(4096, 2, 2);
    const silent = this.audioCtx.createGain();
    silent.gain.value = 0;

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.recording) return;
      const inputBuffer = event.inputBuffer;
      const left = inputBuffer.getChannelData(0);
      const right =
        inputBuffer.numberOfChannels > 1
          ? inputBuffer.getChannelData(1)
          : left;

      this.leftChunks.push(new Float32Array(left));
      this.rightChunks.push(new Float32Array(right));
      this.totalSamples += left.length;
    };

    this.sourceNode.connect(processor);
    processor.connect(silent);
    silent.connect(this.audioCtx.destination);

    this.processorNode = processor;
    this.silentSink = silent;
  }

  public stopAndExport(filenamePrefix: string = 'studio-session'): Blob | null {
    if (!this.recording) return null;
    this.recording = false;

    this.cleanupNodes();

    if (this.totalSamples === 0) return null;

    const mergedLeft = new Float32Array(this.totalSamples);
    const mergedRight = new Float32Array(this.totalSamples);
    let offset = 0;

    for (let i = 0; i < this.leftChunks.length; i++) {
      mergedLeft.set(this.leftChunks[i], offset);
      mergedRight.set(this.rightChunks[i], offset);
      offset += this.leftChunks[i].length;
    }

    this.leftChunks = [];
    this.rightChunks = [];

    const wavBlob = encodeWav16BitStereo(
      mergedLeft,
      mergedRight,
      this.audioCtx.sampleRate
    );

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    downloadAudioBlob(wavBlob, `${filenamePrefix}-${timestamp}.wav`);
    return wavBlob;
  }

  public dispose(): void {
    this.recording = false;
    this.cleanupNodes();
    this.leftChunks = [];
    this.rightChunks = [];
  }

  public isRecording(): boolean {
    return this.recording;
  }

  private cleanupNodes(): void {
    try {
      if (this.processorNode) {
        this.sourceNode.disconnect(this.processorNode);
        this.processorNode.disconnect();
        this.processorNode.onaudioprocess = null;
      }
      if (this.silentSink) {
        this.silentSink.disconnect();
      }
    } catch {
      // Ignore if already disconnected
    }
    this.processorNode = null;
    this.silentSink = null;
  }
}

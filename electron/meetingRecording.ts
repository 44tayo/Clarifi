import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const SAMPLE_RATE = 16000
const BYTES_PER_MS = (SAMPLE_RATE * 2) / 1000 // mono 16-bit PCM
const SNIPPET_MS = 4500

type ActiveRecording = {
  meetingId: string
  filePath: string
  pcmBytesWritten: number
  headerWritten: boolean
}

let active: ActiveRecording | null = null

function recordingsDir(): string {
  const dir = path.join(app.getPath('userData'), 'recordings')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function recordingRelativePath(meetingId: string): string {
  return path.join('recordings', `${meetingId}-system.wav`)
}

export function absoluteRecordingPath(meetingId: string): string {
  return path.join(app.getPath('userData'), recordingRelativePath(meetingId))
}

function writeWavHeader(fd: number, dataBytes: number): void {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataBytes, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataBytes, 40)
  fs.writeSync(fd, header, 0, 44, 0)
}

function extractPcm(wav: Buffer): Buffer | null {
  if (wav.length < 48 || wav.toString('ascii', 0, 4) !== 'RIFF') return null
  return wav.subarray(44)
}

export function startMeetingRecording(meetingId: string): string {
  stopMeetingRecording()
  recordingsDir()
  const filePath = absoluteRecordingPath(meetingId)
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    // ignore
  }
  const fd = fs.openSync(filePath, 'w')
  writeWavHeader(fd, 0)
  fs.closeSync(fd)
  active = {
    meetingId,
    filePath,
    pcmBytesWritten: 0,
    headerWritten: true,
  }
  return recordingRelativePath(meetingId)
}

/** Append a mono 16 kHz WAV chunk; returns millisecond offset of this chunk in the recording. */
export function appendSystemWavChunk(wavBuffer: Buffer): number | null {
  if (!active) return null
  const pcm = extractPcm(wavBuffer)
  if (!pcm || pcm.length === 0) return null

  const offsetMs = Math.floor(active.pcmBytesWritten / BYTES_PER_MS)
  const fd = fs.openSync(active.filePath, 'r+')
  try {
    fs.writeSync(fd, pcm, 0, pcm.length, 44 + active.pcmBytesWritten)
    active.pcmBytesWritten += pcm.length
    writeWavHeader(fd, active.pcmBytesWritten)
  } finally {
    fs.closeSync(fd)
  }
  return offsetMs
}

export function currentRecordingOffsetMs(): number {
  if (!active) return 0
  return Math.floor(active.pcmBytesWritten / BYTES_PER_MS)
}

export function stopMeetingRecording(): string | null {
  if (!active) return null
  const relative = recordingRelativePath(active.meetingId)
  if (active.pcmBytesWritten === 0) {
    try {
      fs.unlinkSync(active.filePath)
    } catch {
      // ignore
    }
    active = null
    return null
  }
  active = null
  return relative
}

export function deleteMeetingRecording(meetingId: string): void {
  try {
    fs.unlinkSync(absoluteRecordingPath(meetingId))
  } catch {
    // ignore
  }
}

export function sliceRecordingWav(
  meetingId: string,
  startMs: number,
  durationMs = SNIPPET_MS,
): Buffer | null {
  const filePath = absoluteRecordingPath(meetingId)
  if (!fs.existsSync(filePath)) return null

  const file = fs.readFileSync(filePath)
  if (file.length < 48) return null
  const pcm = file.subarray(44)
  const startByte = Math.max(0, Math.floor(startMs * BYTES_PER_MS))
  const endByte = Math.min(pcm.length, startByte + Math.floor(durationMs * BYTES_PER_MS))
  if (endByte <= startByte) return null

  // Align to 2-byte samples
  const alignedStart = startByte - (startByte % 2)
  const alignedEnd = endByte - (endByte % 2)
  if (alignedEnd <= alignedStart) return null

  const slice = pcm.subarray(alignedStart, alignedEnd)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + slice.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(slice.length, 40)
  return Buffer.concat([header, slice])
}

export function getSpeakerSnippetBase64(
  meetingId: string,
  startMs: number,
  durationMs = SNIPPET_MS,
): string | null {
  const wav = sliceRecordingWav(meetingId, startMs, durationMs)
  return wav ? wav.toString('base64') : null
}

/** Concatenate PCM payloads from multiple mono 16-bit WAV chunks into one WAV. */
export function mergeWavBuffers(buffers: Buffer[]): Buffer | null {
  const pcmParts: Buffer[] = []
  let sampleRate = 16000

  for (const buffer of buffers) {
    if (buffer.length < 48 || buffer.toString('ascii', 0, 4) !== 'RIFF') continue
    const pcm = buffer.subarray(44)
    if (pcm.length === 0) continue
    pcmParts.push(pcm)
    sampleRate = buffer.readUInt32LE(24) || sampleRate
  }

  if (pcmParts.length === 0) return null

  const pcm = Buffer.concat(pcmParts)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

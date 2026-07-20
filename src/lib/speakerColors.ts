const SPEAKER_COLORS = ['#2b6cff', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2']

export function speakerColor(speaker: string): string {
  let hash = 0
  for (let i = 0; i < speaker.length; i += 1) {
    hash = (hash + speaker.charCodeAt(i) * (i + 1)) % SPEAKER_COLORS.length
  }
  return SPEAKER_COLORS[hash] ?? SPEAKER_COLORS[0]!
}

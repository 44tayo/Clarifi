export async function transcribeAudio(
  audioBase64: string,
  format: 'wav' | 'webm' = 'webm',
  language = 'en',
  prompt?: string,
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    console.error('GROQ_API_KEY is not configured')
    return null
  }

  const extension = format === 'wav' ? 'wav' : 'webm'
  const contentType = format === 'wav' ? 'audio/wav' : 'audio/webm'
  const buffer = Buffer.from(audioBase64, 'base64')

  const formData = new FormData()
  formData.append(
    'file',
    new Blob([buffer], { type: contentType }),
    `audio.${extension}`,
  )
  formData.append('model', 'whisper-large-v3-turbo')
  if (language && language !== 'auto') {
    formData.append('language', language)
  }
  if (prompt?.trim()) {
    formData.append('prompt', prompt.trim().slice(-220))
  }
  formData.append('temperature', '0')

  try {
    // Groq's EU endpoint (api.eu.groq.com, Helsinki) must be enabled per
    // account by Groq sales before it can be used — set GROQ_API_BASE_URL
    // once that's done. Defaults to the standard US-hosted endpoint.
    const baseUrl = process.env.GROQ_API_BASE_URL?.trim() || 'https://api.groq.com'
    const response = await fetch(`${baseUrl}/openai/v1/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Whisper error:', err)
      return null
    }

    const data = (await response.json()) as { text?: string }
    return data.text?.trim() || null
  } catch (err) {
    console.error('Transcribe error:', err)
    return null
  }
}

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const audio = formData.get('audio')

  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: 'audio file is required' }, { status: 400 })
  }

  const file = new File([audio], 'recording.webm', { type: audio.type })

  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  })

  return NextResponse.json({ text: transcription.text })
}

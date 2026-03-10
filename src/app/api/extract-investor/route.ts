import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { parseInvestorsFromLLMResponse, INVESTOR_EXTRACTION_PROMPT } from '@/lib/extraction/investors'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(request: NextRequest) {
  const { text } = await request.json()

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text field is required' }, { status: 400 })
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: INVESTOR_EXTRACTION_PROMPT },
      { role: 'user', content: `Here is the description:\n\n${text}` },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 })
  }

  const investors = parseInvestorsFromLLMResponse(content)
  return NextResponse.json({ investors })
}

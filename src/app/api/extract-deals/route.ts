import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseDealsFromLLMResponse, DEAL_EXTRACTION_PROMPT } from '@/lib/extraction/deals'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest) {
  const { text } = await request.json()

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text field is required' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${DEAL_EXTRACTION_PROMPT}\n\nHere is the unstructured text:\n\n${text}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 })
  }

  const deals = parseDealsFromLLMResponse(content.text)
  return NextResponse.json({ deals })
}

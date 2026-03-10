import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(request: NextRequest) {
  const { content, existingSummaries } = await request.json()

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  // Generate mini-summary for this note
  const noteSummaryRes = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 100,
    messages: [
      {
        role: 'system',
        content: 'Summarize the following note about a deal/company in one concise sentence. Return ONLY the summary sentence.',
      },
      { role: 'user', content },
    ],
  })

  const noteSummary = noteSummaryRes.choices[0]?.message?.content?.trim() || null

  // Generate overall summary from all note summaries
  let overallSummary: string | null = null
  const allSummaries = [...(existingSummaries || []), noteSummary].filter(Boolean)

  if (allSummaries.length > 0) {
    const overallRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: 'You are given a list of note summaries about a deal/company. Write a concise overall summary that captures the key information across all notes. Keep it to 2-3 sentences. Return ONLY the summary.',
        },
        { role: 'user', content: allSummaries.join('\n') },
      ],
    })
    overallSummary = overallRes.choices[0]?.message?.content?.trim() || null
  }

  return NextResponse.json({ noteSummary, overallSummary })
}

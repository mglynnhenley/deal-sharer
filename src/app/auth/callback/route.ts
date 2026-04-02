import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  const next = searchParams.get('next') ?? '/'
  // Only allow relative paths to prevent open redirect attacks
  const redirectPath = next.startsWith('/') ? next : '/'
  return NextResponse.redirect(`${origin}${redirectPath}`)
}

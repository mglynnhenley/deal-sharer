'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login, resetPassword } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(formData: FormData) {
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
    }
  }

  async function handleReset(e: React.MouseEvent) {
    e.preventDefault()
    setError(null)
    setResetSent(false)
    const form = e.currentTarget.closest('form')
    if (!form) return
    const formData = new FormData(form)
    const result = await resetPassword(formData)
    if (result.error) setError(result.error)
    else setResetSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Deal Sharer</h1>
        <form action={handleSubmit} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full px-3 py-2 border rounded-md"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="w-full px-3 py-2 border rounded-md"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {resetSent && <p className="text-green-600 text-sm">Password reset email sent. Check your inbox.</p>}
          <button
            type="submit"
            className="w-full py-2 bg-black text-white rounded-md hover:bg-gray-800"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full text-sm text-gray-600 hover:text-black"
          >
            Forgot password?
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-black underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

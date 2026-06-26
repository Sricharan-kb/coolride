import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    })
    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-sm text-center">
        <h1 className="text-xl font-medium text-emerald-600 dark:text-emerald-400">
          Check your email
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          A login link has been sent to{' '}
          <strong>{email}</strong>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-xl font-medium text-gray-900 dark:text-zinc-100">
        Log in
      </h1>
      <input
        id="email"
        name="email"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-base outline-none focus:border-emerald-600 dark:focus:border-emerald-400"
      />
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 py-2 px-4 text-base font-medium disabled:opacity-50"
      >
        {loading ? 'Sending link...' : 'Send login link'}
      </button>
    </form>
  )
}

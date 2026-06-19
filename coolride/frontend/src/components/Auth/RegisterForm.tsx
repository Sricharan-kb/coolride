import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (authError) {
      setError(authError.message)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-xl font-medium text-gray-900 dark:text-zinc-100">
        Create account
      </h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-base outline-none focus:border-emerald-600 dark:focus:border-emerald-400"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-base outline-none focus:border-emerald-600 dark:focus:border-emerald-400"
      />
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}
      {/* TODO(NOTE): py-2 gives ~40px tap target — below 44px minimum; consider py-3 */}
      <button
        type="submit"
        disabled={loading}
        className="bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 py-2 px-4 text-base font-medium disabled:opacity-50"
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>
      <button
        type="button"
        onClick={onSwitchToLogin}
        className="text-sm text-gray-500 dark:text-zinc-400 underline self-start"
      >
        Have an account? Log in
      </button>
    </form>
  )
}

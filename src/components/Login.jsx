import React, { useState } from 'react'
import { Music, Mail, Lock, LogIn, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) throw signUpError

        if (data.user) {
          // setMessage('Account created! Please check your email to verify your account.')
          onLogin(data.user)
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) throw signInError

        if (data.user) {
          onLogin(data.user)
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <Music className="w-16 h-16 text-purple-300" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">DJ Session</h1>
          <p className="text-purple-200">
            {isSignUp ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-purple-200 text-sm font-medium mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-300" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white bg-opacity-20 text-white placeholder-purple-200 border border-purple-300 border-opacity-30 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-purple-200 text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-300" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white bg-opacity-20 text-white placeholder-purple-200 border border-purple-300 border-opacity-30 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 border-opacity-50 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-500 bg-opacity-20 border border-green-500 border-opacity-50 rounded-lg p-3 text-green-200 text-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all transform hover:scale-105 shadow-lg"
          >
            {loading ? (
              'Loading...'
            ) : (
              <>
                {isSignUp ? (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Sign Up
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </>
                )}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
              setMessage(null)
            }}
            className="text-purple-200 hover:text-white text-sm transition-colors"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  )
}


'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Link de recuperação no formato antigo (#access_token=...&type=recovery),
  // como o enviado pelo painel do Supabase, pode cair aqui após o redirect da
  // raiz. Encaminha para a tela de nova senha preservando o hash.
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || (hash.includes('error_code=') && hash.includes('otp'))) {
      window.location.replace(`/redefinir-senha${hash}`)
      return
    }
    // Link de email (confirmação/recuperação) que falhou no /api/auth/callback
    if (new URLSearchParams(window.location.search).get('error')) {
      setError('Esse link é inválido ou expirou. Se estava recuperando a senha, toque em "Esqueci minha senha" e peça um novo link.')
      window.history.replaceState(null, '', '/login')
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha inválidos. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/grupos')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col items-center justify-center p-4">
      
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3">⚽</div>
        <h1 className="text-3xl font-bold text-green-700">MeuBaba</h1>
        <p className="text-gray-500 text-sm mt-1">O app do seu futebol com os amigos</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Entrar</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="input-baba"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-baba pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/recuperar-senha" className="text-sm text-gray-400 hover:text-green-600 transition-colors">
            Esqueci minha senha
          </Link>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          Não tem conta?{' '}
          <Link href="/cadastro" className="text-green-600 font-semibold hover:underline">
            Cadastre-se grátis
          </Link>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        MeuBaba ⚽ · Feito para o futebol brasileiro 🇧🇷
      </p>
    </div>
  )
}

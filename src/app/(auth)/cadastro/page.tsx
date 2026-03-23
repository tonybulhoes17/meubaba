'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { PlayerPosition } from '@/lib/types'
import { POSITIONS_LABELS } from '@/lib/types'

export default function CadastroPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2
  const [positions, setPositions] = useState<PlayerPosition[]>([])

  const positions_list: PlayerPosition[] = ['goleiro', 'zagueiro', 'lateral', 'volante', 'meia', 'atacante']

  function togglePosition(pos: PlayerPosition) {
    if (positions.includes(pos)) {
      setPositions(positions.filter(p => p !== pos))
    } else if (positions.length < 3) {
      setPositions([...positions, pos])
    }
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setStep(2)
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (signUpError) {
      setError('Erro ao criar conta. Tente novamente.')
      setLoading(false)
      return
    }

    // Atualiza posições no perfil
    if (data.user) {
      await supabase
        .from('profiles')
        .update({
          position_1: positions[0] ?? null,
          position_2: positions[1] ?? null,
          position_3: positions[2] ?? null,
        })
        .eq('id', data.user.id)
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
        <p className="text-gray-500 text-sm mt-1">Crie sua conta gratuitamente</p>
      </div>

      {/* Progress */}
      <div className="w-full max-w-sm mb-4">
        <div className="flex gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-green-500" />
          <div className={`flex-1 h-1.5 rounded-full transition-all ${step === 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
        </div>
        <p className="text-xs text-gray-400 mt-1">{step === 1 ? 'Dados da conta' : 'Suas posições'}</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

        {step === 1 && (
          <>
            <h2 className="text-xl font-bold text-gray-800 mb-6">Criar conta</h2>
            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="João Silva"
                  required
                  className="input-baba"
                />
              </div>

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
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="input-baba"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  required
                  className="input-baba"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
              )}

              <button type="submit" className="btn-primary w-full mt-2">
                Continuar →
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Suas posições</h2>
            <p className="text-sm text-gray-500 mb-5">Escolha até 3 posições em ordem de preferência</p>

            <form onSubmit={handleCadastro} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {positions_list.map((pos) => {
                  const isSelected = positions.includes(pos)
                  const order = positions.indexOf(pos) + 1
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => togglePosition(pos)}
                      className={`relative flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                        isSelected
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-1 right-1.5 text-xs font-bold text-green-600">{order}°</span>
                      )}
                      {POSITIONS_LABELS[pos]}
                    </button>
                  )
                })}
              </div>

              <p className="text-xs text-gray-400 text-center">
                {positions.length}/3 selecionadas
              </p>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-xl hover:bg-gray-50 transition-all"
                >
                  ← Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1"
                >
                  {loading ? 'Criando...' : 'Criar conta ⚽'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <div className="mt-5 text-center text-sm text-gray-500">
        Já tem conta?{' '}
        <Link href="/login" className="text-green-600 font-semibold hover:underline">
          Entrar
        </Link>
      </div>
    </div>
  )
}

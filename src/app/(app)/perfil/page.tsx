'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Camera, Save, Loader2, Eye, EyeOff, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import type { PlayerPosition } from '@/lib/types'
import { POSITIONS_LABELS } from '@/lib/types'

const POSITIONS: PlayerPosition[] = ['goleiro', 'zagueiro', 'lateral', 'volante', 'meia', 'atacante']

export default function PerfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const { profile, fetchProfile, signOut } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  // Trocar senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [mostrarSenhas, setMostrarSenhas] = useState(false)
  const [loadingSenha, setLoadingSenha] = useState(false)
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [senhaOk, setSenhaOk] = useState(false)
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [positions, setPositions] = useState<PlayerPosition[]>([])

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setBio(profile.bio ?? '')
      const pos: PlayerPosition[] = []
      if (profile.position_1) pos.push(profile.position_1)
      if (profile.position_2) pos.push(profile.position_2)
      if (profile.position_3) pos.push(profile.position_3)
      setPositions(pos)
    }
  }, [profile])

  function togglePosition(pos: PlayerPosition) {
    if (positions.includes(pos)) {
      setPositions(positions.filter(p => p !== pos))
    } else if (positions.length < 3) {
      setPositions([...positions, pos])
    }
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setLoading(true)

    await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        position_1: positions[0] ?? null,
        position_2: positions[1] ?? null,
        position_3: positions[2] ?? null,
      })
      .eq('id', profile.id)

    await fetchProfile()
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTrocarSenha() {
    setErroSenha(null)
    if (novaSenha.length < 6) {
      setErroSenha('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmaSenha) {
      setErroSenha('As senhas não coincidem.')
      return
    }
    setLoadingSenha(true)

    // Verifica senha atual fazendo login
    const { data: { user } } = await supabase.auth.getUser()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: senhaAtual,
    })
    if (signInError) {
      setErroSenha('Senha atual incorreta.')
      setLoadingSenha(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setLoadingSenha(false)

    if (error) {
      setErroSenha('Erro ao atualizar senha. Tente novamente.')
    } else {
      setSenhaOk(true)
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmaSenha('')
      setTimeout(() => setSenhaOk(false), 3000)
    }
  }

  async function handleSairConta() {
    await signOut()
    router.push('/login')
  }

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    const ext = file.name.split('.').pop()
    const path = `${profile.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (!uploadError) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase
        .from('profiles')
        .update({ photo_url: data.publicUrl })
        .eq('id', profile.id)
      await fetchProfile()
    }
  }

  const initials = profile?.full_name
    ?.split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() ?? '?'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-600 pt-12 pb-8 px-4">
        <div className="max-w-lg mx-auto text-center">
          {/* Foto */}
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center overflow-hidden mx-auto">
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white">{initials}</span>
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow-md cursor-pointer hover:bg-gray-50 transition-all">
              <Camera size={14} className="text-green-600" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
            </label>
          </div>
          <h1 className="text-white text-xl font-bold">{profile?.full_name}</h1>
          <p className="text-green-200 text-sm">{profile?.bio || 'Sem bio ainda'}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 pb-8">
        <form onSubmit={handleSalvar} className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-800">Informações pessoais</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="input-baba"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Conte algo sobre você..."
                rows={3}
                maxLength={150}
                className="input-baba resize-none"
              />
            </div>
          </div>

          {/* Posições */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-1">Suas posições</h2>
            <p className="text-sm text-gray-400 mb-4">Escolha até 3 em ordem de preferência</p>
            <div className="grid grid-cols-2 gap-2">
              {POSITIONS.map(pos => {
                const isSelected = positions.includes(pos)
                const order = positions.indexOf(pos) + 1
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => togglePosition(pos)}
                    className={`relative flex items-center justify-center py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saved ? '✓ Salvo!' : loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>

        {/* Trocar senha */}
        <div className="mt-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-gray-500" />
              <h2 className="font-bold text-gray-800">Trocar senha</h2>
            </div>
            <button type="button" onClick={() => setMostrarSenhas(v => !v)}
              className="text-xs text-green-600 font-semibold">
              {mostrarSenhas ? 'Fechar' : 'Alterar'}
            </button>
          </div>

          {mostrarSenhas && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha atual</label>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={e => setSenhaAtual(e.target.value)}
                  placeholder="Digite sua senha atual"
                  className="input-baba"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="input-baba"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmaSenha}
                  onChange={e => setConfirmaSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="input-baba"
                />
              </div>

              {erroSenha && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl">{erroSenha}</div>
              )}
              {senhaOk && (
                <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl font-semibold">✓ Senha atualizada com sucesso!</div>
              )}

              <button
                type="button"
                onClick={handleTrocarSenha}
                disabled={loadingSenha || !senhaAtual || !novaSenha || !confirmaSenha}
                className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loadingSenha ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                {loadingSenha ? 'Atualizando...' : 'Atualizar senha'}
              </button>
            </div>
          )}
        </div>

        {/* Sair da conta */}
        <div className="mt-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <button
            onClick={handleSairConta}
            className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-600 font-semibold py-2 transition-colors"
          >
            <LogOut size={18} />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}

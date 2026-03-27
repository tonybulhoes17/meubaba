'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function ModalEntrarGrupo({ onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [grupoEncontrado, setGrupoEncontrado] = useState<{ id: string; name: string; city: string | null } | null>(null)

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    if (!codigo.trim()) return
    setLoading(true)
    setError(null)
    setGrupoEncontrado(null)

    const { data: grupo, error } = await supabase
      .from('groups')
      .select('id, name, city')
      .eq('invite_code', codigo.trim().toUpperCase())
      .single()

    if (error || !grupo) {
      setError('Código inválido. Verifique e tente novamente.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: jaEMembro } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', grupo.id)
      .eq('user_id', user!.id)
      .single()

    if (jaEMembro) {
      setError('Você já faz parte deste baba!')
      setLoading(false)
      return
    }

    setGrupoEncontrado(grupo)
    setLoading(false)
  }

  async function handleEntrar() {
    if (!grupoEncontrado) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('group_members')
      .insert({
        group_id: grupoEncontrado.id,
        user_id: user!.id,
        role: 'player',
      })

    if (error) {
      setError('Erro ao entrar no baba. Tente novamente.')
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    // overflow-y-auto + max-h para o modal rolar quando o teclado empurra
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-800">Entrar em um Baba</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={22} />
          </button>
        </div>

        <div className="p-5 space-y-4 pb-8">
          <p className="text-sm text-gray-500">
            Peça o código de convite para o administrador do baba.
          </p>

          <form onSubmit={handleBuscar} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de convite
              </label>
              <input
                type="text"
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: AB12CD34"
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
                className="input-baba text-center text-xl font-bold tracking-widest uppercase"
              />
            </div>

            {/* Botão buscar DENTRO do form — sempre visível */}
            {!grupoEncontrado && (
              <button
                type="submit"
                disabled={loading || codigo.length < 6}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            )}
          </form>

          {/* Grupo encontrado */}
          {grupoEncontrado && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium mb-1">Baba encontrado!</p>
              <p className="text-lg font-bold text-gray-800">⚽ {grupoEncontrado.name}</p>
              {grupoEncontrado.city && (
                <p className="text-sm text-gray-500 mt-0.5">📍 {grupoEncontrado.city}</p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          {grupoEncontrado && (
            <div className="flex gap-3">
              <button
                onClick={() => setGrupoEncontrado(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleEntrar}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? 'Entrando...' : 'Entrar no Baba! ⚽'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

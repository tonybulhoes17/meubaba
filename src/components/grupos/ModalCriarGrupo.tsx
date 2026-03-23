'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function ModalCriarGrupo({ onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cidade, setCidade] = useState('')

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Cria o grupo
    const { data: grupo, error: grupoError } = await supabase
      .from('groups')
      .insert({
        name: nome.trim(),
        description: descricao.trim() || null,
        city: cidade.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (grupoError || !grupo) {
      setError('Erro ao criar o baba. Tente novamente.')
      setLoading(false)
      return
    }

    // Adiciona criador como admin
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: grupo.id,
        user_id: user.id,
        role: 'admin',
      })

    if (memberError) {
      setError('Erro ao configurar o baba. Tente novamente.')
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Criar novo Baba ⚽</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCriar} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do baba <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Baba dos Médicos"
              required
              maxLength={50}
              className="input-baba"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Conte um pouco sobre o baba..."
              rows={3}
              maxLength={200}
              className="input-baba resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cidade <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={cidade}
              onChange={e => setCidade(e.target.value)}
              placeholder="Ex: São Paulo, SP"
              maxLength={50}
              className="input-baba"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !nome.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : '⚽'}
              {loading ? 'Criando...' : 'Criar Baba'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

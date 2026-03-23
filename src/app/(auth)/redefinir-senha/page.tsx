'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [erro, setErro] = useState('')
  const [showSenha, setShowSenha] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 6) { setErro('A senha deve ter ao menos 6 caracteres.'); return }
    if (senha !== confirma) { setErro('As senhas não coincidem.'); return }

    setLoading(true)
    setErro('')

    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setErro('Não foi possível redefinir a senha. O link pode ter expirado. Solicite um novo.')
    } else {
      setConcluido(true)
      setTimeout(() => router.push('/grupos'), 2500)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '3rem', textAlign: 'center' }}>
        <span style={{ fontSize: '2.5rem' }}>⚽</span>
        <h1 style={{ color: 'white', fontWeight: 900, margin: '0.5rem 0 0', fontSize: '1.5rem' }}>MeuBaba</h1>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {concluido ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '2rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <CheckCircle size={48} color="#16a34a" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ color: '#1e293b', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Senha redefinida!</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Redirecionando para o app...</p>
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <h2 style={{ color: '#1e293b', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.25rem' }}>🔑 Nova senha</h2>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>Escolha uma nova senha para sua conta.</p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.375rem' }}>Nova senha</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      style={{ width: '100%', padding: '0.75rem 2.75rem 0.75rem 1rem', border: '1.5px solid #e2e8f0', borderRadius: '0.875rem', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}
                      onFocus={e => e.target.style.borderColor = '#16a34a'}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                    <button type="button" onClick={() => setShowSenha(v => !v)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                      {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.375rem' }}>Confirmar senha</label>
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={confirma}
                    onChange={e => setConfirma(e.target.value)}
                    placeholder="Repita a nova senha"
                    required
                    style={{ width: '100%', padding: '0.75rem 1rem', border: `1.5px solid ${confirma && confirma !== senha ? '#ef4444' : '#e2e8f0'}`, borderRadius: '0.875rem', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}
                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                    onBlur={e => e.target.style.borderColor = confirma && confirma !== senha ? '#ef4444' : '#e2e8f0'}
                  />
                  {confirma && confirma !== senha && (
                    <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '4px 0 0' }}>As senhas não coincidem</p>
                  )}
                </div>

                {erro && (
                  <div style={{ backgroundColor: '#fee2e2', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                    <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0 }}>{erro}</p>
                  </div>
                )}

                <button type="submit" disabled={loading || senha.length < 6 || senha !== confirma}
                  style={{ width: '100%', backgroundColor: loading || senha.length < 6 || senha !== confirma ? '#e2e8f0' : '#16a34a', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', color: loading || senha.length < 6 || senha !== confirma ? '#94a3b8' : 'white', fontWeight: 700, fontSize: '0.95rem', cursor: loading || senha.length < 6 || senha !== confirma ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> : 'Salvar nova senha'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

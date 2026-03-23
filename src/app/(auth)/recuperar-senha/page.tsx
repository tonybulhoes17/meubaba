'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RecuperarSenhaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setErro('')

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })

    if (error) {
      setErro('Erro ao enviar email. Verifique o endereço e tente novamente.')
    } else {
      setEnviado(true)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>🔑 Recuperar senha</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', margin: '2px 0 0' }}>Enviaremos um link para seu email</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {enviado ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '2rem', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <CheckCircle size={48} color="#16a34a" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ color: '#1e293b', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.75rem' }}>Email enviado!</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para redefinir sua senha.
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 1.5rem' }}>
                Não recebeu? Verifique a pasta de spam ou tente novamente em alguns minutos.
              </p>
              <button onClick={() => router.push('/login')}
                style={{ width: '100%', backgroundColor: '#16a34a', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                Voltar para o login
              </button>
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                Digite o email cadastrado na sua conta e enviaremos um link para redefinir sua senha.
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.375rem' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    style={{ width: '100%', padding: '0.75rem 1rem', border: '1.5px solid #e2e8f0', borderRadius: '0.875rem', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}
                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                {erro && (
                  <div style={{ backgroundColor: '#fee2e2', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                    <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0 }}>{erro}</p>
                  </div>
                )}

                <button type="submit" disabled={loading || !email.trim()}
                  style={{ width: '100%', backgroundColor: loading || !email.trim() ? '#e2e8f0' : '#16a34a', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', color: loading || !email.trim() ? '#94a3b8' : 'white', fontWeight: 700, fontSize: '0.95rem', cursor: loading || !email.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : 'Enviar link de recuperação'}
                </button>
              </form>

              <button onClick={() => router.push('/login')}
                style={{ width: '100%', marginTop: '0.75rem', background: 'none', border: 'none', color: '#64748b', fontSize: '0.875rem', cursor: 'pointer', padding: '0.5rem' }}>
                ← Voltar para o login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

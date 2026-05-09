'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function FaleConoscoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [celular, setCelular] = useState('')
  const [cidade, setCidade] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !email.trim() || !mensagem.trim()) return
    setLoading(true)
    setErro(null)

    const { error } = await supabase.from('contact_messages').insert({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      celular: celular.trim() || null,
      cidade: cidade.trim() || null,
      mensagem: mensagem.trim(),
    })

    setLoading(false)
    if (error) {
      setErro('Erro ao enviar mensagem. Tente novamente.')
    } else {
      setEnviado(true)
    }
  }

  if (enviado) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ width: '5rem', height: '5rem', backgroundColor: '#dcfce7', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <CheckCircle size={40} color="#16a34a" />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', margin: '0 0 0.75rem' }}>Mensagem enviada! 🎉</h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 2rem' }}>
          Obrigado pelo contato, <strong>{nome.split(' ')[0]}</strong>! Recebemos sua mensagem e responderemos em breve no email <strong>{email}</strong>.
        </p>
        <button onClick={() => router.push('/grupos')}
          style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '0.875rem', padding: '0.875rem 2rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
          Voltar ao início
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '4rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '2rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <button onClick={() => router.back()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '4px' }}>
              <ArrowLeft size={22} />
            </button>
            <h1 style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>💬 Fale Conosco</h1>
          </div>

          {/* Banner fase de testes */}
          <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '1rem', padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,0.15)' }}>
            <p style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', margin: '0 0 4px' }}>
              🚀 MeuBaba está em fase de testes!
            </p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
              Sua opinião é muito importante para nós. Qualquer dúvida, sugestão ou problema — manda pra gente! Responderemos o mais rápido possível.
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <form onSubmit={handleEnviar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Dados pessoais */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', margin: '0 0 1rem' }}>Seus dados</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Nome <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input value={nome} onChange={e => setNome(e.target.value)} required
                  placeholder="Seu nome completo"
                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#16a34a'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input value={email} onChange={e => setEmail(e.target.value)} required type="email"
                  placeholder="seu@email.com"
                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#16a34a'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Celular <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <input value={celular} onChange={e => setCelular(e.target.value)}
                    placeholder="(75) 99999-9999"
                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Cidade <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <input value={cidade} onChange={e => setCidade(e.target.value)}
                    placeholder="Ex: Feira de Santana"
                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>
            </div>
          </div>

          {/* Mensagem */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', margin: '0 0 1rem' }}>Sua mensagem</h2>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} required
              placeholder="Conta pra gente o que você achou, o que sentiu falta ou qualquer dúvida que tiver..."
              rows={5} maxLength={1000}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }}
              onFocus={e => e.target.style.borderColor = '#16a34a'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '4px 0 0', textAlign: 'right' }}>{mensagem.length}/1000</p>
          </div>

          {erro && (
            <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.85rem', padding: '0.875rem 1rem', borderRadius: '0.875rem', fontWeight: 600 }}>
              {erro}
            </div>
          )}

          <button type="submit" disabled={loading || !nome.trim() || !email.trim() || !mensagem.trim()}
            style={{
              width: '100%', padding: '1rem', borderRadius: '0.875rem', border: 'none',
              background: loading || !nome.trim() || !email.trim() || !mensagem.trim()
                ? '#e2e8f0' : 'linear-gradient(135deg, #16a34a, #15803d)',
              color: loading || !nome.trim() || !email.trim() || !mensagem.trim() ? '#94a3b8' : 'white',
              fontWeight: 700, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {loading ? 'Enviando...' : 'Enviar mensagem'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
            Respondemos no email cadastrado em até 48h ⚽
          </p>
        </form>
      </div>
    </div>
  )
}

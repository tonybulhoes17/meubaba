'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, Shield, LogOut, Search, ChevronDown, ChevronUp } from 'lucide-react'

const ADMIN_EMAIL = 'tonybulhoes17@gmail.com'

interface Usuario {
  id: string
  full_name: string
  email: string
  created_at: string
}

interface Grupo {
  id: string
  name: string
  city: string | null
  created_at: string
  admin_name: string
  admin_email: string
  total_membros: number
}

interface Mensagem {
  id: string
  nome: string
  email: string
  celular: string | null
  cidade: string | null
  mensagem: string
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [autorizado, setAutorizado] = useState(false)
  const [loading, setLoading] = useState(true)

  // Dados
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [totalUsuarios, setTotalUsuarios] = useState(0)
  const [totalGrupos, setTotalGrupos] = useState(0)
  const [usuariosAtivos30d, setUsuariosAtivos30d] = useState(0)

  // UI
  const [aba, setAba] = useState<'usuarios' | 'grupos' | 'mensagens'>('usuarios')
  const [buscaUsuario, setBuscaUsuario] = useState('')
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [ordemUsuario, setOrdemUsuario] = useState<'nome' | 'data'>('data')
  const [ordemGrupo, setOrdemGrupo] = useState<'nome' | 'data' | 'membros'>('data')

  useEffect(() => {
    verificarAcesso()
  }, [])

  async function verificarAcesso() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) {
      router.push('/grupos')
      return
    }
    setAutorizado(true)
    await carregarDados()
    setLoading(false)
  }

  async function carregarDados() {
    // Usuários via profiles + auth (usa service role via API)
    const res = await fetch('/api/admin/dashboard')
    if (!res.ok) return
    const data = await res.json()

    setUsuarios(data.usuarios ?? [])
    setGrupos(data.grupos ?? [])
    setTotalUsuarios(data.totalUsuarios ?? 0)
    setTotalGrupos(data.totalGrupos ?? 0)
    setUsuariosAtivos30d(data.usuariosAtivos30d ?? 0)

    // Busca mensagens de contato
    const { data: msgs } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false })
    setMensagens(msgs ?? [])
  }

  async function handleSair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚙️</div>
        <p style={{ color: '#94a3b8', fontWeight: 600 }}>Carregando painel...</p>
      </div>
    </div>
  )

  if (!autorizado) return null

  const usuariosFiltrados = usuarios
    .filter(u => u.full_name?.toLowerCase().includes(buscaUsuario.toLowerCase()) || u.email?.toLowerCase().includes(buscaUsuario.toLowerCase()))
    .sort((a, b) => ordemUsuario === 'nome'
      ? (a.full_name ?? '').localeCompare(b.full_name ?? '')
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

  const gruposFiltrados = grupos
    .filter(g => g.name?.toLowerCase().includes(buscaGrupo.toLowerCase()) || g.admin_name?.toLowerCase().includes(buscaGrupo.toLowerCase()))
    .sort((a, b) => {
      if (ordemGrupo === 'nome') return a.name.localeCompare(b.name)
      if (ordemGrupo === 'membros') return b.total_membros - a.total_membros
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  function formatData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', paddingBottom: '3rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', padding: '2rem 1.5rem 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
              <Shield size={20} color="rgba(255,255,255,0.8)" />
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Painel Admin</span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>MeuBaba ⚽</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', margin: '4px 0 0' }}>Dashboard de controle</p>
          </div>
          <button onClick={handleSair}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.75rem', padding: '0.5rem 1rem', color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '👥', label: 'Total de Usuários', valor: totalUsuarios, cor: '#16a34a' },
            { icon: '🔥', label: 'Ativos (30 dias)', valor: usuariosAtivos30d, cor: '#f59e0b' },
            { icon: '⚽', label: 'Grupos Cadastrados', valor: totalGrupos, cor: '#2563eb' },
          ].map(c => (
            <div key={c.label} style={{ backgroundColor: '#1e293b', borderRadius: '1rem', padding: '1.25rem', border: `1px solid ${c.cor}33` }}>
              <p style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>{c.icon}</p>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: c.cor, margin: 0 }}>{c.valor}</p>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0', fontWeight: 600 }}>{c.label}</p>
            </div>
          ))}
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {(['usuarios', 'grupos', 'mensagens'] as const).map(a => (
            <button key={a} onClick={() => setAba(a)}
              style={{
                padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer',
                backgroundColor: aba === a ? '#16a34a' : '#1e293b',
                color: aba === a ? 'white' : '#64748b',
                fontWeight: 700, fontSize: '0.875rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
              {a === 'usuarios' ? <><Users size={15} /> Usuários</> : a === 'grupos' ? <><span>⚽</span> Grupos</> : <><span>💬</span> Mensagens {mensagens.length > 0 && <span style={{backgroundColor:'#ef4444',color:'white',borderRadius:'9999px',padding:'1px 7px',fontSize:'0.7rem',marginLeft:'4px'}}>{mensagens.length}</span>}</>}
            </button>
          ))}
        </div>

        {/* ======= ABA USUÁRIOS ======= */}
        {aba === 'usuarios' && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #334155' }}>
            {/* Toolbar */}
            <div style={{ padding: '1rem', borderBottom: '1px solid #334155', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, position: 'relative', minWidth: '200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input value={buscaUsuario} onChange={e => setBuscaUsuario(e.target.value)}
                  placeholder="Buscar por nome ou email..."
                  style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingTop: '0.625rem', paddingBottom: '0.625rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.625rem', color: 'white', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <select value={ordemUsuario} onChange={e => setOrdemUsuario(e.target.value as any)}
                style={{ padding: '0.625rem 0.875rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.625rem', color: '#94a3b8', fontSize: '0.85rem', outline: 'none' }}>
                <option value="data">Mais recentes</option>
                <option value="nome">A-Z</option>
              </select>
            </div>

            {/* Lista */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>#</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Nome</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Email</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u, i) => (
                    <tr key={u.id} style={{ borderTop: '1px solid #1e293b', backgroundColor: i % 2 === 0 ? '#1e293b' : '#182030' }}>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'white', fontWeight: 600 }}>{u.full_name ?? '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{u.email}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{formatData(u.created_at)}</td>
                    </tr>
                  ))}
                  {usuariosFiltrados.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Nenhum usuário encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #334155', color: '#64748b', fontSize: '0.75rem' }}>
              {usuariosFiltrados.length} de {totalUsuarios} usuários
            </div>
          </div>
        )}

        {/* ======= ABA GRUPOS ======= */}
        {aba === 'grupos' && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #334155' }}>
            {/* Toolbar */}
            <div style={{ padding: '1rem', borderBottom: '1px solid #334155', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, position: 'relative', minWidth: '200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input value={buscaGrupo} onChange={e => setBuscaGrupo(e.target.value)}
                  placeholder="Buscar por grupo ou admin..."
                  style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingTop: '0.625rem', paddingBottom: '0.625rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.625rem', color: 'white', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <select value={ordemGrupo} onChange={e => setOrdemGrupo(e.target.value as any)}
                style={{ padding: '0.625rem 0.875rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.625rem', color: '#94a3b8', fontSize: '0.85rem', outline: 'none' }}>
                <option value="data">Mais recentes</option>
                <option value="nome">A-Z</option>
                <option value="membros">Mais membros</option>
              </select>
            </div>

            {/* Lista */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>#</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Grupo</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Admin</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Email Admin</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Membros</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposFiltrados.map((g, i) => (
                    <tr key={g.id} style={{ borderTop: '1px solid #1e293b', backgroundColor: i % 2 === 0 ? '#1e293b' : '#182030' }}>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <p style={{ color: 'white', fontWeight: 700, margin: 0 }}>{g.name}</p>
                        {g.city && <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '2px 0 0' }}>📍 {g.city}</p>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#16a34a', fontWeight: 600 }}>{g.admin_name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>{g.admin_email}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ backgroundColor: '#16a34a22', color: '#4ade80', borderRadius: '9999px', padding: '2px 10px', fontWeight: 700, fontSize: '0.8rem' }}>{g.total_membros}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{formatData(g.created_at)}</td>
                    </tr>
                  ))}
                  {gruposFiltrados.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Nenhum grupo encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #334155', color: '#64748b', fontSize: '0.75rem' }}>
              {gruposFiltrados.length} de {totalGrupos} grupos
            </div>
          </div>
        )}
        {/* ======= ABA MENSAGENS ======= */}
        {aba === 'mensagens' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {mensagens.length === 0 && (
              <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#64748b', border: '1px solid #334155' }}>
                <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>💬</p>
                <p style={{ fontWeight: 600 }}>Nenhuma mensagem ainda</p>
              </div>
            )}
            {mensagens.map((m, i) => (
              <div key={m.id} style={{ backgroundColor: '#1e293b', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <p style={{ color: 'white', fontWeight: 800, fontSize: '1rem', margin: 0 }}>{m.nome}</p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>✉️ {m.email}</span>
                      {m.celular && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>📱 {m.celular}</span>}
                      {m.cidade && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>📍 {m.cidade}</span>}
                    </div>
                  </div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', flexShrink: 0 }}>{formatData(m.created_at)}</span>
                </div>
                <div style={{ backgroundColor: '#0f172a', borderRadius: '0.75rem', padding: '0.875rem', border: '1px solid #334155' }}>
                  <p style={{ color: '#e2e8f0', fontSize: '0.875rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{m.mensagem}</p>
                </div>
              </div>
            ))}
          </div>
        )}


'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Copy, Check, RefreshCw, Trash2, Shield, UserMinus, AlertTriangle, UserPlus, DollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Membro {
  id: string // group_members.id
  user_id: string
  full_name: string
  photo_url: string | null
  initials: string
  role: 'admin' | 'player'
  joined_at: string
}

type Secao = 'geral' | 'financeiro' | 'membros' | 'danger'

export default function ConfiguracoesPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [myUserId, setMyUserId] = useState('')
  const [secao, setSecao] = useState<Secao>('geral')

  // Dados do grupo
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cidade, setCidade] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [savingGeral, setSavingGeral] = useState(false)
  const [savedGeral, setSavedGeral] = useState(false)

  // Membros
  const [membros, setMembros] = useState<Membro[]>([])
  const [loadingMembros, setLoadingMembros] = useState(false)

  // Invite code
  const [copiado, setCopiado] = useState(false)
  const [renovandoCodigo, setRenovandoCodigo] = useState(false)

  // Confirmações
  const [confirmRemover, setConfirmRemover] = useState<string | null>(null)
  const [confirmPromover, setConfirmPromover] = useState<string | null>(null)

  // Cadastro rápido pelo admin
  const [mostrarCadastroRapido, setMostrarCadastroRapido] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [cadastrandoMembro, setCadastrandoMembro] = useState(false)
  const [erroCadastro, setErroCadastro] = useState<string | null>(null)
  const [cadastroOk, setCadastroOk] = useState(false)

  // Financeiro
  const [finFee, setFinFee] = useState('100.00')
  const [finDueDay, setFinDueDay] = useState('1')
  const [finPixKey, setFinPixKey] = useState('')
  const [savingFin, setSavingFin] = useState(false)
  const [savedFin, setSavedFin] = useState(false)
  const [finConfigId, setFinConfigId] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [groupId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setMyUserId(user.id)

    // Verifica se é admin
    const { data: member } = await supabase
      .from('group_members').select('role')
      .eq('group_id', groupId).eq('user_id', user.id).single()

    if (member?.role !== 'admin') {
      router.push(`/grupos/${groupId}`)
      return
    }

    // Dados do grupo
    const { data: group } = await supabase
      .from('groups').select('*').eq('id', groupId).single()

    if (group) {
      setNome(group.name ?? '')
      setDescricao(group.description ?? '')
      setCidade(group.city ?? '')
      setInviteCode(group.invite_code ?? '')
    }

    // Membros
    await fetchMembros()

    // Config financeira
    const { data: finConfig } = await supabase
      .from('group_finance_config')
      .select('*')
      .eq('group_id', groupId)
      .single()
    if (finConfig) {
      setFinConfigId(finConfig.id)
      setFinFee(finConfig.monthly_fee?.toString() ?? '100.00')
      setFinDueDay(finConfig.due_day?.toString() ?? '1')
      setFinPixKey(finConfig.pix_key ?? '')
    }

    setLoading(false)
  }

  async function fetchMembros() {
    setLoadingMembros(true)
    const { data } = await supabase
      .from('group_members')
      .select('id, user_id, role, joined_at, profile:profiles(full_name, photo_url)')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('joined_at')

    const lista: Membro[] = (data ?? []).map((m: any) => {
      const nome = m.profile?.full_name ?? 'Jogador'
      return {
        id: m.id,
        user_id: m.user_id,
        full_name: nome,
        photo_url: m.profile?.photo_url ?? null,
        initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
        role: m.role,
        joined_at: m.joined_at,
      }
    })
    setMembros(lista)
    setLoadingMembros(false)
  }

  async function salvarGeral() {
    if (!nome.trim()) return
    setSavingGeral(true)
    const { error } = await supabase
      .from('groups')
      .update({ name: nome.trim(), description: descricao.trim() || null, city: cidade.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', groupId)

    if (error) { alert(`Erro: ${error.message}`); setSavingGeral(false); return }
    setSavingGeral(false)
    setSavedGeral(true)
    setTimeout(() => setSavedGeral(false), 2000)
  }

  async function copiarCodigo() {
    await navigator.clipboard.writeText(inviteCode)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function renovarCodigo() {
    if (!confirm('Gerar novo código? O código atual deixará de funcionar.')) return
    setRenovandoCodigo(true)
    const novoCodigo = Math.random().toString(36).substring(2, 10).toUpperCase()
    const { error } = await supabase
      .from('groups').update({ invite_code: novoCodigo }).eq('id', groupId)
    if (!error) setInviteCode(novoCodigo)
    setRenovandoCodigo(false)
  }

  async function removerMembro(membro: Membro) {
    const { error } = await supabase
      .from('group_members')
      .update({ is_active: false })
      .eq('id', membro.id)
    if (error) { alert(`Erro: ${error.message}`); return }
    setConfirmRemover(null)
    await fetchMembros()
  }

  async function promoverAdmin(membro: Membro) {
    const { error } = await supabase
      .from('group_members')
      .update({ role: 'admin' })
      .eq('id', membro.id)
    if (error) { alert(`Erro: ${error.message}`); return }
    setConfirmPromover(null)
    await fetchMembros()
  }

  async function rebaixarAdmin(membro: Membro) {
    // Verifica se há pelo menos 2 admins antes de rebaixar
    const admins = membros.filter(m => m.role === 'admin')
    if (admins.length <= 1) { alert('O grupo precisa ter pelo menos 1 admin!'); return }
    const { error } = await supabase
      .from('group_members').update({ role: 'player' }).eq('id', membro.id)
    if (error) { alert(`Erro: ${error.message}`); return }
    await fetchMembros()
  }

  async function cadastrarMembroRapido() {
    if (!novoNome.trim() || !novoEmail.trim() || !novaSenha.trim()) return
    if (novaSenha.length < 6) { setErroCadastro('A senha deve ter pelo menos 6 caracteres.'); return }
    setCadastrandoMembro(true)
    setErroCadastro(null)

    // Usa a API do Supabase Auth via signUp para criar o usuário
    // Como não temos service_role no client, usamos a API de admin via endpoint
    try {
      const res = await fetch('/api/admin/cadastrar-membro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoNome.trim(),
          email: novoEmail.trim().toLowerCase(),
          senha: novaSenha,
          groupId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErroCadastro(json.error ?? 'Erro ao cadastrar.')
      } else {
        setCadastroOk(true)
        setNovoNome('')
        setNovoEmail('')
        setNovaSenha('')
        setMostrarCadastroRapido(false)
        setTimeout(() => setCadastroOk(false), 3000)
        await fetchMembros()
      }
    } catch {
      setErroCadastro('Erro de conexão. Tente novamente.')
    }
    setCadastrandoMembro(false)
  }

  async function salvarFinanceiro() {
    const fee = parseFloat(finFee.replace(',', '.'))
    const day = parseInt(finDueDay)
    if (isNaN(fee) || fee <= 0) { alert('Valor da mensalidade inválido.'); return }
    if (isNaN(day) || day < 1 || day > 28) { alert('Dia de vencimento deve ser entre 1 e 28.'); return }
    setSavingFin(true)

    const isNovo = !finConfigId
    const payload = {
      group_id: groupId,
      monthly_fee: fee,
      due_day: day,
      pix_key: finPixKey.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let configId = finConfigId
    if (finConfigId) {
      await supabase.from('group_finance_config').update(payload).eq('id', finConfigId)
    } else {
      const { data } = await supabase.from('group_finance_config').insert(payload).select().single()
      if (data) { configId = data.id; setFinConfigId(data.id) }
    }

    // Parte 2: primeira configuração → marca todos os membros ativos como adimplentes
    // do mês de Jan do ano corrente até o mês atual (status 'manual')
    if (isNovo) {
      const { data: membrosAtivos } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('is_active', true)

      if (membrosAtivos && membrosAtivos.length > 0) {
        const now = new Date()
        const curYear = now.getFullYear()
        const curMonth = now.getMonth() + 1

        // Gera todos os meses de Jan/ano_corrente até mês atual
        const meses: string[] = []
        for (let m = 1; m <= curMonth; m++) {
          meses.push(`${curYear}-${String(m).padStart(2, '0')}`)
        }

        const rows: any[] = []
        for (const mem of membrosAtivos) {
          for (const mes of meses) {
            rows.push({
              group_id: groupId,
              user_id: mem.user_id,
              month: mes,
              status: 'manual',
              submission_id: null,
              updated_at: new Date().toISOString(),
            })
          }
        }

        // Insere em lotes de 50
        for (let i = 0; i < rows.length; i += 50) {
          await supabase.from('member_payment_status')
            .upsert(rows.slice(i, i + 50), { onConflict: 'group_id,user_id,month' })
        }
      }
    }

    setSavingFin(false)
    setSavedFin(true)
    setTimeout(() => setSavedFin(false), 2000)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>⚙️</div>
    </div>
  )

  const admins = membros.filter(m => m.role === 'admin')
  const players = membros.filter(m => m.role === 'player')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '5rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b, #334155)', paddingTop: '3rem', paddingBottom: '1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>⚙️ Configurações</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', margin: '2px 0 0' }}>Apenas administradores</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: '640px', margin: '0.875rem auto 0', display: 'flex', gap: '0.25rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '3px' }}>
          {([
            { key: 'geral', label: '🏠 Geral' },
            { key: 'financeiro', label: '💰 Financeiro' },
            { key: 'membros', label: `👥 Membros (${membros.length})` },
            { key: 'danger', label: '⚠️ Avançado' },
          ] as { key: Secao; label: string }[]).map(s => (
            <button key={s.key} onClick={() => setSecao(s.key)}
              style={{ flex: 1, padding: '7px 4px', borderRadius: '0.625rem', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.15s', backgroundColor: secao === s.key ? 'white' : 'transparent', color: secao === s.key ? '#1e293b' : 'rgba(255,255,255,0.7)' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ========== SEÇÃO GERAL ========== */}
        {secao === 'geral' && (
          <>
            {/* Dados do grupo */}
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 1rem' }}>📋 Dados do Grupo</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Nome do grupo *</label>
                  <input value={nome} onChange={e => setNome(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', color: '#1e293b', fontWeight: 600 }}
                    onFocus={e => e.target.style.borderColor = '#334155'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    placeholder="Nome do baba" />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Cidade</label>
                  <input value={cidade} onChange={e => setCidade(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', color: '#1e293b' }}
                    onFocus={e => e.target.style.borderColor = '#334155'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    placeholder="Ex: São Paulo, SP" />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Descrição</label>
                  <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', color: '#1e293b', resize: 'none', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = '#334155'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    placeholder="Uma breve descrição do grupo..." />
                </div>
              </div>

              <button onClick={salvarGeral} disabled={savingGeral || !nome.trim()}
                style={{ width: '100%', marginTop: '1rem', background: savedGeral ? '#16a34a' : savingGeral ? '#94a3b8' : 'linear-gradient(135deg, #1e293b, #334155)', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: savingGeral || !nome.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
                {savingGeral ? <Loader2 size={18} className="animate-spin" /> : savedGeral ? <Check size={18} /> : <Save size={18} />}
                {savedGeral ? 'Salvo!' : savingGeral ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>

            {/* Código de convite */}
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.875rem' }}>🔗 Código de Convite</p>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.875rem' }}>Compartilhe este código para novos membros entrarem no grupo.</p>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ flex: 1, backgroundColor: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '0.875rem', padding: '0.875rem 1rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.2em', color: '#1e293b', fontFamily: 'monospace' }}>{inviteCode}</span>
                </div>
                <button onClick={copiarCodigo}
                  style={{ width: '48px', height: '48px', borderRadius: '0.875rem', backgroundColor: copiado ? '#dcfce7' : '#f1f5f9', border: `2px solid ${copiado ? '#16a34a' : '#e2e8f0'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
                  {copiado ? <Check size={18} color="#16a34a" /> : <Copy size={18} color="#64748b" />}
                </button>
              </div>

              <button onClick={renovarCodigo} disabled={renovandoCodigo}
                style={{ width: '100%', marginTop: '0.75rem', backgroundColor: 'transparent', border: '2px solid #e2e8f0', borderRadius: '0.875rem', padding: '0.75rem', color: '#64748b', fontWeight: 600, fontSize: '0.8rem', cursor: renovandoCodigo ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {renovandoCodigo ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Gerar novo código
              </button>
            </div>
          </>
        )}

        {/* ========== SEÇÃO MEMBROS ========== */}
        {secao === 'membros' && (
          <>
            {/* Cadastro rápido */}
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <button onClick={() => { setMostrarCadastroRapido(v => !v); setErroCadastro(null) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={16} color="#16a34a" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>Cadastrar membro</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>{mostrarCadastroRapido ? 'Fechar' : 'Novo'}</span>
              </button>

              {mostrarCadastroRapido && (
                <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                    Cadastra o usuário na plataforma e já adiciona ao grupo automaticamente.
                  </p>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Nome completo</label>
                    <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                      placeholder="Ex: João Silva"
                      style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Email</label>
                    <input value={novoEmail} onChange={e => setNovoEmail(e.target.value)}
                      type="email" placeholder="email@exemplo.com"
                      style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Senha</label>
                    <input value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                      type="password" placeholder="Mínimo 6 caracteres"
                      style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  {erroCadastro && (
                    <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.8rem', padding: '0.75rem', borderRadius: '0.75rem' }}>{erroCadastro}</div>
                  )}
                  {cadastroOk && (
                    <div style={{ backgroundColor: '#dcfce7', color: '#16a34a', fontSize: '0.8rem', padding: '0.75rem', borderRadius: '0.75rem', fontWeight: 700 }}>✅ Membro cadastrado com sucesso!</div>
                  )}

                  <button onClick={cadastrarMembroRapido}
                    disabled={cadastrandoMembro || !novoNome.trim() || !novoEmail.trim() || !novaSenha.trim()}
                    style={{ width: '100%', padding: '0.875rem', borderRadius: '0.875rem', border: 'none', background: cadastrandoMembro ? '#94a3b8' : 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: cadastrandoMembro ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    {cadastrandoMembro ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    {cadastrandoMembro ? 'Cadastrando...' : 'Cadastrar e adicionar ao grupo'}
                  </button>
                </div>
              )}
            </div>

            {/* Admins */}
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', margin: 0 }}>
                  🛡️ Administradores ({admins.length})
                </p>
              </div>
              {admins.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: '#fef9c3', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {m.photo_url ? <img src={m.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706' }}>{m.initials}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.full_name} {m.user_id === myUserId && <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 400 }}>(você)</span>}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '1px 0 0' }}>Admin · desde {formatDate(m.joined_at)}</p>
                  </div>
                  {m.user_id !== myUserId && admins.length > 1 && (
                    <button onClick={() => rebaixarAdmin(m)}
                      style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'none', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Rebaixar
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Jogadores */}
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', margin: 0 }}>
                  👟 Jogadores ({players.length})
                </p>
              </div>
              {players.length === 0 && (
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem', padding: '2rem' }}>Nenhum jogador ainda</p>
              )}
              {players.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {m.photo_url ? <img src={m.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{m.initials}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</p>
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '1px 0 0' }}>Desde {formatDate(m.joined_at)}</p>
                  </div>

                  {/* Ações */}
                  {confirmRemover === m.id ? (
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button onClick={() => removerMembro(m)}
                        style={{ fontSize: '0.72rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '0.5rem', padding: '5px 10px', cursor: 'pointer', fontWeight: 700 }}>
                        Confirmar
                      </button>
                      <button onClick={() => setConfirmRemover(null)}
                        style={{ fontSize: '0.72rem', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.5rem', padding: '5px 10px', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  ) : confirmPromover === m.id ? (
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button onClick={() => promoverAdmin(m)}
                        style={{ fontSize: '0.72rem', backgroundColor: '#fef9c3', color: '#a16207', border: 'none', borderRadius: '0.5rem', padding: '5px 10px', cursor: 'pointer', fontWeight: 700 }}>
                        Confirmar
                      </button>
                      <button onClick={() => setConfirmPromover(null)}
                        style={{ fontSize: '0.72rem', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.5rem', padding: '5px 10px', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button onClick={() => setConfirmPromover(m.id)}
                        title="Promover a admin"
                        style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: '#fef9c3', border: '1px solid #f59e0b33', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Shield size={14} color="#d97706" />
                      </button>
                      <button onClick={() => setConfirmRemover(m.id)}
                        title="Remover do grupo"
                        style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: '#fee2e2', border: '1px solid #dc262633', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserMinus size={14} color="#b91c1c" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ========== SEÇÃO FINANCEIRO ========== */}
        {secao === 'financeiro' && (
          <>
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <DollarSign size={18} color="#16a34a" />
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Configurações de Mensalidade</p>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Valor da mensalidade (R$)</label>
                <input type="number" min="0" step="0.01" value={finFee} onChange={e => setFinFee(e.target.value)} placeholder="100.00"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Dia de vencimento (1 a 28)</label>
                <input type="number" min="1" max="28" value={finDueDay} onChange={e => setFinDueDay(e.target.value)} placeholder="1"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' as const }} />
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.375rem 0 0' }}>Todo mês, após esse dia, membros sem pagamento ficam inadimplentes.</p>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Chave PIX para recebimento</label>
                <input type="text" value={finPixKey} onChange={e => setFinPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' as const }} />
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.375rem 0 0' }}>Exibida com QR Code para os membros na hora do pagamento.</p>
              </div>

              <button onClick={salvarFinanceiro} disabled={savingFin}
                style={{ width: '100%', backgroundColor: savedFin ? '#dcfce7' : '#16a34a', color: savedFin ? '#15803d' : 'white', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.9rem', cursor: savingFin ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
                {savingFin ? <Loader2 size={16} className="animate-spin" /> : savedFin ? <Check size={16} /> : <DollarSign size={16} />}
                {savingFin ? 'Salvando...' : savedFin ? 'Salvo!' : 'Salvar configurações financeiras'}
              </button>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '1rem', padding: '1rem' }}>
              <p style={{ fontSize: '0.78rem', color: '#15803d', margin: 0, lineHeight: 1.6 }}>
                💡 <strong>Primeira configuração:</strong> ao salvar pela primeira vez, todos os membros ativos serão marcados automaticamente como adimplentes do mês de Janeiro até o mês atual.
              </p>
            </div>
          </>
        )}

        {/* ========== SEÇÃO DANGER ========== */}
        {secao === 'danger' && (
          <>
            <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '1rem', padding: '1rem', display: 'flex', gap: '0.75rem' }}>
              <AlertTriangle size={20} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.8rem', color: '#9a3412', margin: 0, lineHeight: 1.5 }}>
                As ações abaixo são <strong>irreversíveis</strong>. Tenha certeza antes de prosseguir.
              </p>
            </div>

            {/* Encerrar temporada ativa */}
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem' }}>🏁 Encerrar temporada</p>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 1rem', lineHeight: 1.5 }}>
                Encerra a temporada ativa. As estatísticas são preservadas para histórico. Uma nova temporada pode ser criada depois.
              </p>
              <button onClick={async () => {
                if (!confirm('Encerrar a temporada ativa? As estatísticas serão preservadas.')) return
                const { data: season } = await supabase.from('seasons').select('id').eq('group_id', groupId).eq('status', 'active').single()
                if (season) {
                  await supabase.from('seasons').update({ status: 'finished', ended_at: new Date().toISOString().split('T')[0] }).eq('id', season.id)
                  alert('Temporada encerrada!')
                  router.push(`/grupos/${groupId}`)
                } else {
                  alert('Nenhuma temporada ativa encontrada.')
                }
              }}
                style={{ width: '100%', backgroundColor: '#fff7ed', border: '2px solid #fed7aa', borderRadius: '0.875rem', padding: '0.875rem', color: '#9a3412', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                🏁 Encerrar temporada atual
              </button>
            </div>

            {/* Excluir grupo */}
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #fee2e2' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#b91c1c', margin: '0 0 0.25rem' }}>🗑️ Excluir grupo</p>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 1rem', lineHeight: 1.5 }}>
                Remove permanentemente o grupo e todos os dados associados — rodadas, estatísticas, membros e histórico. Esta ação <strong>não pode ser desfeita</strong>.
              </p>
              <button onClick={async () => {
                const confirmado = prompt('Para confirmar, digite o nome do grupo:')
                const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).single()
                if (confirmado !== group?.name) { alert('Nome incorreto. Operação cancelada.'); return }
                // Soft delete — desativa todos os membros
                await supabase.from('group_members').update({ is_active: false }).eq('group_id', groupId)
                alert('Grupo removido.')
                router.push('/grupos')
              }}
                style={{ width: '100%', backgroundColor: '#fee2e2', border: '2px solid #fca5a5', borderRadius: '0.875rem', padding: '0.875rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                🗑️ Excluir este grupo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

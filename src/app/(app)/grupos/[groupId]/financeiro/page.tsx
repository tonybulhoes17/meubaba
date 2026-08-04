'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle, ChevronRight, Plus, Edit2, Check, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FinConfig {
  id: string
  monthly_fee: number
  due_day: number
  pix_key: string | null
}

interface MemberStatus {
  user_id: string
  full_name: string
  photo_url: string | null
  initials: string
  currentStatus: 'paid' | 'pending' | 'overdue' | 'manual' | null
}

interface MonthStatus {
  month: string        // 'YYYY-MM'
  label: string        // 'Jan 2025'
  status: 'paid' | 'pending' | 'overdue' | 'manual' | null
  submission_id: string | null
}

interface Submission {
  id: string
  user_id: string
  full_name: string
  photo_url: string | null
  months: string[]
  period_type: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return `${MONTH_LABELS[mo]} ${y}`
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function visibleMonths(): string[] {
  const months: string[] = []
  const d = new Date()
  const curYear = d.getFullYear()
  const curMonth = d.getMonth() // 0-based

  // 12 meses passados (incluindo o atual)
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(curYear, curMonth - i, 1)
    months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }

  // Meses futuros até dezembro do ano corrente
  for (let m = curMonth + 2; m <= 12; m++) {
    months.push(`${curYear}-${String(m).padStart(2, '0')}`)
  }

  // Remove duplicatas mantendo ordem
  return [...new Set(months)]
}

// Mantém alias para compatibilidade
function last12Months(): string[] { return visibleMonths() }

function statusColor(s: string | null) {
  if (s === 'paid' || s === 'manual' || s === 'approved') return { bg: '#dcfce7', text: '#15803d', border: '#86efac' }
  if (s === 'pending') return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' }
  if (s === 'rejected') return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' }
  return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' }
}

function statusIcon(s: string | null) {
  if (s === 'paid' || s === 'manual' || s === 'approved') return '✅'
  if (s === 'pending') return '⏳'
  if (s === 'rejected') return '❌'
  return '❌'
}

function statusLabel(s: string | null) {
  if (s === 'paid') return 'Pago'
  if (s === 'manual') return 'Pago (manual)'
  if (s === 'approved') return 'Aprovado ✅'
  if (s === 'pending') return 'Aguardando validação'
  if (s === 'rejected') return 'Recusado ❌'
  return 'Em aberto'
}

function periodLabel(p: string) {
  if (p === 'monthly') return 'Mensal'
  if (p === 'quarterly') return 'Trimestral'
  if (p === 'semiannual') return 'Semestral'
  return 'Anual'
}

export default function FinanceiroPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myUserId, setMyUserId] = useState('')
  const [config, setConfig] = useState<FinConfig | null>(null)
  const [adminTab, setAdminTab] = useState<'pendentes' | 'membros' | 'inadimplentes' | 'dashboard'>('dashboard')

  // Jogador
  const [myMonths, setMyMonths] = useState<MonthStatus[]>([])
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([])
  const [myCurrentStatus, setMyCurrentStatus] = useState<string | null>(null)

  // Admin
  const [pendentes, setPendentes] = useState<Submission[]>([])
  const [allMembers, setAllMembers] = useState<MemberStatus[]>([])
  const [inadimplentes, setInadimplentes] = useState<MemberStatus[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberStatus | null>(null)
  const [memberMonths, setMemberMonths] = useState<MonthStatus[]>([])
  const [loadingMember, setLoadingMember] = useState(false)

  // Cache de status de todos os membros para a tabela
  const [allMemberStatuses, setAllMemberStatuses] = useState<Record<string, Record<string, string>>>({})
  const [loadingTable, setLoadingTable] = useState(false)

  // Edição manual (detalhe do membro)
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [confirmManual, setConfirmManual] = useState<{ month: string; newStatus: string } | null>(null)
  const [savingManual, setSavingManual] = useState(false)

  // Modal de confirmação da tabela
  const [tableConfirm, setTableConfirm] = useState<{ member: MemberStatus; month: string; newStatus: string } | null>(null)
  const [savingTable, setSavingTable] = useState(false)

  useEffect(() => { fetchData() }, [groupId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setMyUserId(user.id)

    const { data: member } = await supabase
      .from('group_members').select('role')
      .eq('group_id', groupId).eq('user_id', user.id).single()

    const admin = member?.role === 'admin'
    setIsAdmin(admin)

    // Config financeira
    const { data: cfg } = await supabase
      .from('group_finance_config').select('*')
      .eq('group_id', groupId).single()
    setConfig(cfg ?? null)

    // Dados do jogador (sempre carrega)
    await fetchMyData(user.id)

    // Dados do admin
    if (admin) {
      await fetchAdminData()
      await fetchAllMemberStatuses()
    }

    setLoading(false)
  }

  async function fetchMyData(userId: string) {
    const months = last12Months()
    const cur = currentMonth()

    const { data: statuses } = await supabase
      .from('member_payment_status')
      .select('month, status, submission_id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .in('month', months)

    const statusMap: Record<string, any> = {}
    ;(statuses ?? []).forEach((s: any) => { statusMap[s.month] = s })

    const monthList: MonthStatus[] = months.map(m => ({
      month: m,
      label: monthLabel(m),
      status: statusMap[m]?.status ?? null,
      submission_id: statusMap[m]?.submission_id ?? null,
    }))
    setMyMonths(monthList)

    const curStatus = statusMap[cur]?.status ?? null
    setMyCurrentStatus(curStatus)

    // Histórico de submissões
    const { data: subs } = await supabase
      .from('payment_submissions')
      .select('id, months, period_type, amount, status, rejection_reason, created_at')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    setMySubmissions((subs ?? []) as Submission[])
  }

  async function fetchAdminData() {
    // Pendentes — busca submissões e perfis separadamente
    const { data: subs, error: subsError } = await supabase
      .from('payment_submissions')
      .select('id, user_id, months, period_type, amount, status, rejection_reason, created_at')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    const pending: Submission[] = []
    for (const s of subs ?? []) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, photo_url')
        .eq('id', s.user_id)
        .single()
      const nome = prof?.full_name ?? 'Jogador'
      pending.push({
        ...s,
        full_name: nome,
        photo_url: prof?.photo_url ?? null,
        rejection_reason: s.rejection_reason ?? null,
        initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
      } as Submission)
    }
    setPendentes(pending)

    // Todos os membros ativos
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id, profile:profiles(full_name, photo_url)')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('profile(full_name)')

    const cur = currentMonth()
    const { data: curStatuses } = await supabase
      .from('member_payment_status')
      .select('user_id, status')
      .eq('group_id', groupId)
      .eq('month', cur)

    const statusByUser: Record<string, string> = {}
    ;(curStatuses ?? []).forEach((s: any) => { statusByUser[s.user_id] = s.status })

    const lista: MemberStatus[] = (members ?? []).map((m: any) => {
      const nome = m.profile?.full_name ?? 'Jogador'
      const st = (statusByUser[m.user_id] as any) ?? null
      return {
        user_id: m.user_id,
        full_name: nome,
        photo_url: m.profile?.photo_url ?? null,
        initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
        currentStatus: st,
      }
    })

    // Ordenar alfabeticamente
    lista.sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))
    setAllMembers(lista)
    setInadimplentes(lista.filter(m => m.currentStatus !== 'paid' && m.currentStatus !== 'manual'))
  }

  async function fetchMemberMonths(userId: string) {
    setLoadingMember(true)
    const months = last12Months()

    const { data: statuses } = await supabase
      .from('member_payment_status')
      .select('month, status, submission_id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .in('month', months)

    const statusMap: Record<string, any> = {}
    ;(statuses ?? []).forEach((s: any) => { statusMap[s.month] = s })

    const monthList: MonthStatus[] = months.map(m => ({
      month: m,
      label: monthLabel(m),
      status: statusMap[m]?.status ?? null,
      submission_id: statusMap[m]?.submission_id ?? null,
    }))
    setMemberMonths(monthList)
    setLoadingMember(false)
  }

  async function fetchAllMemberStatuses() {
    setLoadingTable(true)
    const months = visibleMonths()
    const { data: statuses } = await supabase
      .from('member_payment_status')
      .select('user_id, month, status')
      .eq('group_id', groupId)
      .in('month', months)

    const map: Record<string, Record<string, string>> = {}
    for (const s of statuses ?? []) {
      if (!map[s.user_id]) map[s.user_id] = {}
      map[s.user_id][s.month] = s.status
    }
    setAllMemberStatuses(map)
    setLoadingTable(false)
  }

  async function aplicarManual() {
    if (!confirmManual || !selectedMember) return
    setSavingManual(true)

    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      group_id: groupId,
      user_id: selectedMember.user_id,
      month: confirmManual.month,
      status: confirmManual.newStatus,
      submission_id: null,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    }

    await supabase.from('member_payment_status')
      .upsert(payload, { onConflict: 'group_id,user_id,month' })

    setConfirmManual(null)
    setEditingMonth(null)
    setSavingManual(false)
    await fetchMemberMonths(selectedMember.user_id)
    await fetchAdminData()
    await fetchAllMemberStatuses()
  }

  async function aplicarManualTabela() {
    if (!tableConfirm) return
    setSavingTable(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      group_id: groupId,
      user_id: tableConfirm.member.user_id,
      month: tableConfirm.month,
      status: tableConfirm.newStatus,
      submission_id: null,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('member_payment_status')
      .upsert(payload, { onConflict: 'group_id,user_id,month' })

    // Atualiza cache local imediatamente
    setAllMemberStatuses(prev => ({
      ...prev,
      [tableConfirm.member.user_id]: {
        ...prev[tableConfirm.member.user_id],
        [tableConfirm.month]: tableConfirm.newStatus,
      }
    }))
    // Atualiza lista de adimplentes/inadimplentes
    await fetchAdminData()
    setSavingTable(false)
    setTableConfirm(null)
  }

  // ── Resumo dashboard admin ──
  const cur = currentMonth()
  const adimplentes = allMembers.filter(m => m.currentStatus === 'paid' || m.currentStatus === 'manual')
  const totalArrecadado = 0 // calculado abaixo
  const valorMes = config?.monthly_fee ?? 100

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '2.5rem' }}>⚽</div>
    </div>
  )

  if (!config) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '1.5rem' }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', marginBottom: '1.5rem' }}>
        <ArrowLeft size={20} /> Voltar
      </button>
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💰</p>
        <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Financeiro não configurado</p>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>O administrador precisa configurar o módulo financeiro primeiro.</p>
        {isAdmin && (
          <button onClick={() => router.push(`/grupos/${groupId}/configuracoes`)}
            style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '0.875rem', padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>
            Ir para Configurações
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '6rem' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}>
          <ArrowLeft size={20} color="#64748b" />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>💰 Financeiro</h1>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
            Mensalidade: R$ {Number(config.monthly_fee).toFixed(2)} · Vencimento: dia {config.due_day}
          </p>
        </div>
      </div>

      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ══════════════ VISÃO DO JOGADOR ══════════════ */}
        {!isAdmin && (
          <>
            {/* Status atual */}
            <div style={{ ...(() => { const c = statusColor(myCurrentStatus); return { backgroundColor: c.bg, border: `1.5px solid ${c.border}`, borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' as const } })() }}>
              <p style={{ fontSize: '2rem', margin: '0 0 0.25rem' }}>{statusIcon(myCurrentStatus)}</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: statusColor(myCurrentStatus).text, margin: '0 0 0.25rem' }}>
                {myCurrentStatus === 'paid' || myCurrentStatus === 'manual' ? 'Você está adimplente' : myCurrentStatus === 'pending' ? 'Pagamento em análise' : 'Você está inadimplente'}
              </p>
              <p style={{ fontSize: '0.78rem', color: statusColor(myCurrentStatus).text, margin: 0, opacity: 0.8 }}>
                {monthLabel(cur)} · R$ {Number(config.monthly_fee).toFixed(2)}
              </p>
            </div>

            {/* Botão pagar — sempre visível */}
            {myCurrentStatus !== 'pending' && (
              <button onClick={() => router.push(`/grupos/${groupId}/financeiro/pagar`)}
                style={{ width: '100%', backgroundColor: myCurrentStatus === 'paid' || myCurrentStatus === 'manual' ? 'white' : '#16a34a', color: myCurrentStatus === 'paid' || myCurrentStatus === 'manual' ? '#16a34a' : 'white', border: myCurrentStatus === 'paid' || myCurrentStatus === 'manual' ? '2px solid #16a34a' : 'none', borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Plus size={18} /> {myCurrentStatus === 'paid' || myCurrentStatus === 'manual' ? 'Enviar pagamento do próximo mês' : 'Enviar comprovante de pagamento'}
              </button>
            )}
            {myCurrentStatus === 'pending' && (
              <div style={{ backgroundColor: '#fef9c3', border: '1.5px solid #fde047', borderRadius: '0.875rem', padding: '0.875rem', textAlign: 'center' as const }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#854d0e', margin: 0 }}>⏳ Comprovante enviado — aguardando validação do administrador</p>
              </div>
            )}

            {/* Linha do tempo 12 meses */}
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 1rem' }}>📅 Últimos 12 meses</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {myMonths.map(m => {
                  const c = statusColor(m.status)
                  return (
                    <div key={m.month} style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, borderRadius: '0.625rem', padding: '0.5rem', textAlign: 'center' as const }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: c.text, margin: '0 0 2px' }}>{m.label}</p>
                      <p style={{ fontSize: '0.9rem', margin: 0 }}>{statusIcon(m.status)}</p>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.875rem', flexWrap: 'wrap' as const }}>
                {[['paid','Pago'],['pending','Aguardando'],['overdue','Em aberto']].map(([s, l]) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColor(s).bg, border: `1px solid ${statusColor(s).border}` }} />
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Histórico de envios */}
            {mySubmissions.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: 0 }}>📋 Histórico de envios</p>
                </div>
                {mySubmissions.map(sub => (
                  <div key={sub.id} style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', margin: '0 0 2px' }}>
                          {periodLabel(sub.period_type)} · R$ {Number(sub.amount).toFixed(2)}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>
                          {sub.months.map(monthLabel).join(', ')}
                        </p>
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '9999px', backgroundColor: statusColor(sub.status).bg, color: statusColor(sub.status).text, whiteSpace: 'nowrap' as const }}>
                        {statusLabel(sub.status)}
                      </span>
                    </div>
                    {sub.status === 'rejected' && sub.rejection_reason && (
                      <div style={{ marginTop: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                        <span style={{ fontSize: '0.72rem' }}>⚠️</span>
                        <p style={{ fontSize: '0.72rem', color: '#b91c1c', margin: 0, lineHeight: 1.4 }}>
                          <strong>Motivo:</strong> {sub.rejection_reason}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════════ VISÃO DO ADMIN ══════════════ */}
        {isAdmin && (
          <>
            {/* Tabs admin */}
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
                {([['dashboard','📊'],['pendentes','⏳'],['membros','👥'],['inadimplentes','❌']] as const).map(([tab, icon]) => (
                  <button key={tab} onClick={() => setAdminTab(tab)}
                    style={{ flex: 1, padding: '0.75rem 0.25rem', fontSize: '0.68rem', fontWeight: adminTab === tab ? 700 : 500, color: adminTab === tab ? '#16a34a' : '#64748b', background: 'none', border: 'none', borderBottom: `2px solid ${adminTab === tab ? '#16a34a' : 'transparent'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontSize: '1rem' }}>{icon}</span>
                    {tab === 'dashboard' ? 'Resumo' : tab === 'pendentes' ? `Pendentes${pendentes.length > 0 ? ` (${pendentes.length})` : ''}` : tab === 'membros' ? 'Membros' : 'Inadimp.'}
                  </button>
                ))}
              </div>

              {/* Dashboard */}
              {adminTab === 'dashboard' && (
                <div style={{ padding: '1.25rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', margin: '0 0 0.875rem' }}>
                    {monthLabel(cur)}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                    <div style={{ backgroundColor: '#f0fdf4', borderRadius: '0.875rem', padding: '1rem', textAlign: 'center' as const }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', margin: '0 0 2px' }}>{adimplentes.length}</p>
                      <p style={{ fontSize: '0.7rem', color: '#15803d', margin: 0 }}>Adimplentes</p>
                    </div>
                    <div style={{ backgroundColor: '#fef2f2', borderRadius: '0.875rem', padding: '1rem', textAlign: 'center' as const }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b91c1c', margin: '0 0 2px' }}>{inadimplentes.length}</p>
                      <p style={{ fontSize: '0.7rem', color: '#b91c1c', margin: 0 }}>Inadimplentes</p>
                    </div>
                    <div style={{ backgroundColor: '#fefce8', borderRadius: '0.875rem', padding: '1rem', textAlign: 'center' as const }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#854d0e', margin: '0 0 2px' }}>{pendentes.length}</p>
                      <p style={{ fontSize: '0.7rem', color: '#854d0e', margin: 0 }}>Aguardando validação</p>
                    </div>
                    <div style={{ backgroundColor: '#f0fdf4', borderRadius: '0.875rem', padding: '1rem', textAlign: 'center' as const }}>
                      <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#15803d', margin: '0 0 2px' }}>
                        R$ {(adimplentes.length * valorMes).toFixed(2)}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: '#15803d', margin: 0 }}>Estimativa arrecadada</p>
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>
                      Total de membros: <strong>{allMembers.length}</strong> · Mensalidade: <strong>R$ {Number(config.monthly_fee).toFixed(2)}</strong> · Vencimento: dia <strong>{config.due_day}</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Pendentes */}
              {adminTab === 'pendentes' && (
                <div>
                  {pendentes.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center' as const }}>
                      <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎉</p>
                      <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Nenhum pagamento aguardando validação</p>
                    </div>
                  ) : pendentes.map(sub => (
                    <button key={sub.id} onClick={() => router.push(`/grupos/${groupId}/financeiro/${sub.id}`)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid #f8fafc', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
                      <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {sub.photo_url ? <img src={sub.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>{(sub as any).initials}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.full_name}</p>
                        <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>
                          {periodLabel(sub.period_type)} · {sub.months.map(monthLabel).join(', ')}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>R$ {Number(sub.amount).toFixed(2)}</p>
                      </div>
                      <ChevronRight size={16} color="#94a3b8" />
                    </button>
                  ))}
                </div>
              )}

              {/* Membros — tabela horizontal */}
              {adminTab === 'membros' && !selectedMember && (
                <div>
                  {loadingTable ? (
                    <div style={{ padding: '2rem', textAlign: 'center' as const }}><p style={{ fontSize: '1.5rem' }}>⚽</p></div>
                  ) : (
                    <div style={{ overflowX: 'auto' as const, overflowY: 'auto' as const, maxHeight: '70vh' }}>
                      <table style={{ borderCollapse: 'collapse' as const, minWidth: '100%' }}>
                        <thead style={{ position: 'sticky' as const, top: 0, zIndex: 3 }}>
                          <tr style={{ backgroundColor: '#f8fafc' }}>
                            {/* Coluna nome fixo */}
                            <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left' as const, fontSize: '0.7rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' as const, position: 'sticky' as const, left: 0, backgroundColor: '#f8fafc', zIndex: 2, borderBottom: '1px solid #e2e8f0', minWidth: '140px' }}>
                              Membro
                            </th>
                            {/* Colunas dos meses */}
                            {visibleMonths().map(m => (
                              <th key={m} style={{ padding: '0.5rem 0.375rem', textAlign: 'center' as const, fontSize: '0.62rem', fontWeight: 700, color: m === currentMonth() ? '#15803d' : '#64748b', whiteSpace: 'nowrap' as const, borderBottom: '1px solid #e2e8f0', minWidth: '52px', backgroundColor: m === currentMonth() ? '#f0fdf4' : '#f8fafc' }}>
                                <>{monthLabel(m).split(' ')[0]}<br/>{monthLabel(m).split(' ')[1]}</>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allMembers.map((m, idx) => (
                            <tr key={m.user_id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                              {/* Nome */}
                              <td style={{ padding: '0.5rem 0.875rem', position: 'sticky' as const, left: 0, backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa', zIndex: 1, borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                    {m.photo_url
                                      ? <img src={m.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      : <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748b' }}>{m.initials}</span>}
                                  </div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' as const, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                    {m.full_name.split(' ')[0]}
                                  </span>
                                </div>
                              </td>
                              {/* Células dos meses */}
                              {visibleMonths().map(mes => {
                                const st = allMemberStatuses[m.user_id]?.[mes] ?? null
                                const isPago = st === 'paid' || st === 'manual'
                                const isPending = st === 'pending'
                                return (
                                  <td key={mes} style={{ padding: '0.25rem 0.375rem', textAlign: 'center' as const, borderBottom: '1px solid #f1f5f9', backgroundColor: mes === currentMonth() ? (idx % 2 === 0 ? '#f9fefb' : '#f4fdf7') : 'transparent' }}>
                                    <button
                                      onClick={() => {
                                        if (isPending) return
                                        setTableConfirm({ member: m, month: mes, newStatus: isPago ? 'overdue' : 'manual' })
                                      }}
                                      title={isPago ? 'Clique para marcar como em aberto' : isPending ? 'Aguardando validação' : 'Clique para marcar como pago'}
                                      style={{ width: '28px', height: '28px', borderRadius: '0.375rem', border: 'none', cursor: isPending ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
                                        backgroundColor: isPago ? '#dcfce7' : isPending ? '#fef9c3' : '#fee2e2' }}>
                                      {isPago ? '✅' : isPending ? '⏳' : '❌'}
                                    </button>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Inadimplentes */}
              {adminTab === 'inadimplentes' && !selectedMember && (
                <div>
                  {inadimplentes.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center' as const }}>
                      <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎉</p>
                      <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Todos os membros estão adimplentes!</p>
                    </div>
                  ) : inadimplentes.map(m => {
                    const c = statusColor(m.currentStatus)
                    return (
                      <button key={m.user_id} onClick={async () => { setSelectedMember(m); setAdminTab('membros'); await fetchMemberMonths(m.user_id) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid #f8fafc', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
                        <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {m.photo_url ? <img src={m.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b91c1c' }}>{m.initials}</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</p>
                          <p style={{ fontSize: '0.7rem', margin: 0, color: c.text }}>{statusIcon(m.currentStatus)} {statusLabel(m.currentStatus)}</p>
                        </div>
                        <ChevronRight size={16} color="#94a3b8" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Detalhe do membro (histórico + edição manual) */}
            {selectedMember && (
              <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                <div style={{ padding: '0.875rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button onClick={() => { setSelectedMember(null); setEditingMonth(null); setConfirmManual(null) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                    <ArrowLeft size={16} color="#64748b" />
                  </button>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {selectedMember.photo_url ? <img src={selectedMember.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>{selectedMember.initials}</span>}
                  </div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: 0, flex: 1 }}>{selectedMember.full_name}</p>
                </div>

                <div style={{ padding: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', margin: '0 0 0.75rem' }}>
                    📅 Últimos 12 meses · <span style={{ fontWeight: 400, color: '#94a3b8' }}>✅ pago · ❌ em aberto</span>
                  </p>

                  {loadingMember ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                      <div style={{ fontSize: '1.5rem' }}>⚽</div>
                    </div>
                  ) : memberMonths.map(m => {
                    const c = statusColor(m.status)
                    const isEditing = editingMonth === m.month
                    const isPendingConfirm = confirmManual?.month === m.month

                    return (
                      <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0', borderBottom: '1px solid #f8fafc' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', margin: '0 0 2px' }}>{m.label}</p>
                          {isPendingConfirm ? (
                            <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.5rem', padding: '0.5rem', marginTop: '0.375rem' }}>
                              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#854d0e', margin: '0 0 0.5rem' }}>
                                ⚠️ Confirmar: marcar como "{confirmManual.newStatus === 'paid' ? 'Pago (manual)' : 'Em aberto'}"?
                              </p>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={aplicarManual} disabled={savingManual}
                                  style={{ flex: 1, backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.375rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                                  {savingManual ? '...' : '✅ Confirmar'}
                                </button>
                                <button onClick={() => { setConfirmManual(null); setEditingMonth(null) }}
                                  style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.5rem', padding: '0.375rem', fontSize: '0.72rem', cursor: 'pointer' }}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: c.text }}>
                              {statusIcon(m.status)} {statusLabel(m.status)}
                            </span>
                          )}
                        </div>

                        {!isPendingConfirm && (() => {
                          const isPago = m.status === 'paid' || m.status === 'manual'
                          return (
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              {isPago ? (
                                /* Pago → mostra ✅, clica para reverter */
                                <button
                                  onClick={() => setConfirmManual({ month: m.month, newStatus: 'overdue' })}
                                  title="Clique para marcar como em aberto"
                                  style={{ width: '30px', height: '30px', borderRadius: '0.5rem', backgroundColor: '#dcfce7', border: '1px solid #86efac', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Check size={14} color="#15803d" />
                                </button>
                              ) : (
                                /* Em aberto → mostra ❌, clica para marcar como pago */
                                <button
                                  onClick={() => setConfirmManual({ month: m.month, newStatus: 'manual' })}
                                  title="Clique para marcar como pago"
                                  style={{ width: '30px', height: '30px', borderRadius: '0.5rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <X size={14} color="#b91c1c" />
                                </button>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal confirmação tabela */}
      {tableConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.5rem', width: '100%', maxWidth: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.5rem' }}>
              {tableConfirm.newStatus === 'manual' ? '✅ Marcar como pago?' : '❌ Marcar como em aberto?'}
            </p>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              <strong>{tableConfirm.member.full_name}</strong> · {monthLabel(tableConfirm.month)}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setTableConfirm(null)}
                style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={aplicarManualTabela} disabled={savingTable}
                style={{ flex: 1, backgroundColor: tableConfirm.newStatus === 'manual' ? '#16a34a' : '#b91c1c', color: 'white', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: savingTable ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {savingTable ? <Loader2 size={15} className="animate-spin" /> : null}
                {savingTable ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

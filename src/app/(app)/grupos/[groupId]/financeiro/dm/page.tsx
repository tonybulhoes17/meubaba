'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MONTH_LABELS: Record<string, string> = {
  '01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun',
  '07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez',
}
function monthLabel(m: string) { const [y, mo] = m.split('-'); return `${MONTH_LABELS[mo]} ${y}` }

function visibleMonths(): string[] {
  const months: string[] = []
  const d = new Date()
  const y = d.getFullYear(), cm = d.getMonth()
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(y, cm - i, 1)
    months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }
  for (let m = cm + 2; m <= 12; m++) months.push(`${y}-${String(m).padStart(2, '0')}`)
  return [...new Set(months)]
}

export default function SolicitarDMPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => { load() }, [groupId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const months = visibleMonths()
    const { data: sts } = await supabase.from('member_payment_status')
      .select('month, status').eq('group_id', groupId).eq('user_id', user.id).in('month', months)
    const blocked = new Set((sts ?? []).filter((s: any) => ['paid', 'manual', 'dm', 'pending'].includes(s.status)).map((s: any) => s.month))

    // Meses já incluídos em solicitação DM pendente
    const { data: reqs } = await supabase.from('dm_requests')
      .select('months').eq('group_id', groupId).eq('user_id', user.id).eq('status', 'pending')
    ;(reqs ?? []).forEach((r: any) => (r.months ?? []).forEach((m: string) => blocked.add(m)))

    setAvailable(months.filter(m => !blocked.has(m)))
    setLoading(false)
  }

  function toggle(m: string) {
    setSelected(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort())
  }

  async function enviar() {
    if (selected.length === 0 || !reason.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data: req, error } = await supabase.from('dm_requests').insert({
      group_id: groupId, user_id: user.id, months: selected, reason: reason.trim(), status: 'pending',
    }).select('id').single()

    if (error || !req) { alert('Erro ao enviar solicitação.'); setSaving(false); return }

    const { data: admins } = await supabase.from('group_members')
      .select('user_id').eq('group_id', groupId).eq('role', 'admin').eq('is_active', true)
    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    if (admins && admins.length > 0) {
      await supabase.from('notifications').insert(
        admins.map((a: any) => ({
          user_id: a.user_id,
          type: 'dm_pending',
          title: '🏥 Solicitação de DM',
          body: `${prof?.full_name ?? 'Um membro'} solicitou DM para ${selected.map(monthLabel).join(', ')}.`,
          data: { group_id: groupId, dm_request_id: req.id },
          read: false,
        }))
      )
    }
    setSent(true)
    setTimeout(() => router.push(`/grupos/${groupId}/financeiro`), 2000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '2.5rem' }}>⚽</div>
    </div>
  )

  if (sent) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
      <div style={{ fontSize: '3rem' }}>🏥</div>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1d4ed8' }}>Solicitação enviada!</p>
      <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Aguardando aprovação do administrador.</p>
    </div>
  )

  const canSend = selected.length > 0 && reason.trim().length > 0 && !saving

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '6rem' }}>
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}>
          <ArrowLeft size={20} color="#64748b" />
        </button>
        <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>🏥 Solicitar DM</h1>
      </div>

      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '1rem', padding: '1rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#1d4ed8', margin: 0, lineHeight: 1.5 }}>
            Se você está lesionado, pode pedir isenção da mensalidade (Departamento Médico). Escolha os meses e informe o motivo. O administrador vai aprovar ou recusar.
          </p>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 0.875rem' }}>📅 Meses em aberto</p>
          {available.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>Nenhum mês disponível para solicitar.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {available.map(m => {
                const on = selected.includes(m)
                return (
                  <button key={m} onClick={() => toggle(m)}
                    style={{ backgroundColor: on ? '#dbeafe' : '#f8fafc', border: `1.5px solid ${on ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '0.625rem', padding: '0.5rem', cursor: 'pointer', textAlign: 'center' as const }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: on ? '#1d4ed8' : '#475569', margin: '0 0 2px' }}>{monthLabel(m)}</p>
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>{on ? '🏥' : '·'}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 0.625rem' }}>📝 Motivo</p>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="Ex: lesão no joelho, sem previsão de retorno..."
            style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.85rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
        </div>

        <button onClick={enviar} disabled={!canSend}
          style={{ width: '100%', backgroundColor: canSend ? '#2563eb' : '#94a3b8', color: 'white', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.9rem', cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {saving ? 'Enviando...' : `Enviar solicitação${selected.length ? ` (${selected.length})` : ''}`}
        </button>
      </div>
    </div>
  )
}

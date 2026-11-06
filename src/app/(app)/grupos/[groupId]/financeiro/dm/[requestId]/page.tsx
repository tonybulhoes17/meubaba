'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DmRequest {
  id: string
  user_id: string
  months: string[]
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
  full_name: string
  photo_url: string | null
}

const MONTH_LABELS: Record<string, string> = {
  '01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun',
  '07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez',
}
function monthLabel(m: string) { const [y, mo] = m.split('-'); return `${MONTH_LABELS[mo]} ${y}` }

export default function DmRequestDetailPage() {
  const { groupId, requestId } = useParams<{ groupId: string; requestId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [req, setReq] = useState<DmRequest | null>(null)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { load() }, [requestId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: member } = await supabase.from('group_members').select('role')
      .eq('group_id', groupId).eq('user_id', user.id).single()
    if (member?.role !== 'admin') { router.push(`/grupos/${groupId}`); return }

    const { data } = await supabase.from('dm_requests').select('*').eq('id', requestId).single()
    if (data) {
      const { data: prof } = await supabase.from('profiles').select('full_name, photo_url').eq('id', data.user_id).single()
      setReq({ ...data, full_name: prof?.full_name ?? 'Jogador', photo_url: prof?.photo_url ?? null } as DmRequest)
    }
    setLoading(false)
  }

  async function confirmar() {
    if (!req || !action) return
    if (action === 'reject' && !rejectReason.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()

    if (action === 'approve') {
      await supabase.from('dm_requests').update({ status: 'approved', reviewed_by: user?.id, reviewed_at: now }).eq('id', req.id)
      const rows = req.months.map(m => ({
        group_id: groupId, user_id: req.user_id, month: m, status: 'dm',
        submission_id: null, updated_by: user?.id, updated_at: now,
      }))
      await supabase.from('member_payment_status').upsert(rows, { onConflict: 'group_id,user_id,month' })
      await supabase.from('notifications').insert({
        user_id: req.user_id, type: 'dm_approved', title: '🏥 DM aprovado',
        body: `Sua solicitação de DM foi aprovada para: ${req.months.map(monthLabel).join(', ')}.`,
        data: { group_id: groupId, dm_request_id: req.id }, read: false,
      })
    } else {
      await supabase.from('dm_requests').update({
        status: 'rejected', rejection_reason: rejectReason.trim(), reviewed_by: user?.id, reviewed_at: now,
      }).eq('id', req.id)
      await supabase.from('notifications').insert({
        user_id: req.user_id, type: 'dm_rejected', title: '❌ DM recusado',
        body: `Sua solicitação de DM foi recusada. Motivo: ${rejectReason.trim()}`,
        data: { group_id: groupId, dm_request_id: req.id }, read: false,
      })
    }
    setDone(true)
    setTimeout(() => router.push(`/grupos/${groupId}/financeiro`), 2000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '2.5rem' }}>⚽</div>
    </div>
  )

  if (done) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
      <div style={{ fontSize: '3rem' }}>{action === 'approve' ? '🏥' : '❌'}</div>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: action === 'approve' ? '#1d4ed8' : '#b91c1c' }}>
        {action === 'approve' ? 'DM aprovado!' : 'DM recusado'}
      </p>
      <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Redirecionando...</p>
    </div>
  )

  if (!req) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#94a3b8' }}>Solicitação não encontrada.</p>
    </div>
  )

  const card = { backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' } as const

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '6rem' }}>
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}>
          <ArrowLeft size={20} color="#64748b" />
        </button>
        <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>🏥 Validar DM</h1>
      </div>

      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {req.photo_url
              ? <img src={req.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>{req.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</span>}
          </div>
          <div>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', margin: '0 0 2px' }}>{req.full_name}</p>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
              Enviado em {new Date(req.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div style={card}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 0.75rem' }}>📅 Meses solicitados</p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.375rem', marginBottom: '1rem' }}>
            {req.months.map(m => (
              <span key={m} style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: '9999px' }}>{monthLabel(m)}</span>
            ))}
          </div>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 0.375rem' }}>📝 Motivo</p>
          <p style={{ fontSize: '0.85rem', color: '#1e293b', margin: 0, lineHeight: 1.5 }}>{req.reason}</p>
        </div>

        {req.status !== 'pending' && (
          <div style={card}>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: req.status === 'approved' ? '#1d4ed8' : '#b91c1c', margin: 0 }}>
              {req.status === 'approved' ? '🏥 Aprovado' : '❌ Recusado'}
            </p>
            {req.rejection_reason && <p style={{ fontSize: '0.8rem', color: '#7f1d1d', margin: '0.5rem 0 0' }}>Motivo: {req.rejection_reason}</p>}
          </div>
        )}

        {req.status === 'pending' && !action && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setAction('reject')}
              style={{ flex: 1, backgroundColor: '#fee2e2', color: '#b91c1c', border: '2px solid #fca5a5', borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <X size={18} /> Recusar
            </button>
            <button onClick={() => setAction('approve')}
              style={{ flex: 1, backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Check size={18} /> Aprovar
            </button>
          </div>
        )}

        {action === 'approve' && (
          <div style={{ backgroundColor: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: '1rem', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1d4ed8', margin: '0 0 0.5rem' }}>🏥 Confirmar aprovação?</p>
            <p style={{ fontSize: '0.78rem', color: '#1d4ed8', margin: '0 0 1rem', lineHeight: 1.5 }}>
              Os meses <strong>{req.months.map(monthLabel).join(', ')}</strong> serão marcados como <strong>DM</strong> (isentos).
            </p>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={confirmar} disabled={saving}
                style={{ flex: 1, backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Salvando...' : 'Confirmar'}
              </button>
              <button onClick={() => setAction(null)} style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}

        {action === 'reject' && (
          <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '1rem', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#b91c1c', margin: '0 0 0.5rem' }}>❌ Recusar DM?</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
              placeholder="Informe o motivo da recusa..."
              style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #fca5a5', borderRadius: '0.75rem', fontSize: '0.85rem', outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }} />
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={confirmar} disabled={saving || !rejectReason.trim()}
                style={{ flex: 1, backgroundColor: saving || !rejectReason.trim() ? '#94a3b8' : '#b91c1c', color: 'white', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                {saving ? 'Salvando...' : 'Confirmar recusa'}
              </button>
              <button onClick={() => { setAction(null); setRejectReason('') }} style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

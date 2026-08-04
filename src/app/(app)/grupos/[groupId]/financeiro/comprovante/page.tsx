'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, X, Loader2, ZoomIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Submission {
  id: string
  user_id: string
  full_name: string
  photo_url: string | null
  months: string[]
  period_type: string
  amount: number
  receipt_url: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
}

const MONTH_LABELS: Record<string, string> = {
  '01':'Jan','02':'Fev','03':'Mar','04':'Abr',
  '05':'Mai','06':'Jun','07':'Jul','08':'Ago',
  '09':'Set','10':'Out','11':'Nov','12':'Dez',
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return `${MONTH_LABELS[mo]} ${y}`
}

function periodLabel(p: string) {
  if (p === 'monthly') return 'Mensal'
  if (p === 'quarterly') return 'Trimestral'
  if (p === 'semiannual') return 'Semestral'
  return 'Anual'
}

export default function SubmissionDetailPage() {
  const { groupId, submissionId } = useParams<{ groupId: string; submissionId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState<Submission | null>(null)
  const [zoomImg, setZoomImg] = useState(false)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { fetchData() }, [submissionId])

  async function fetchData() {
    // Verifica se é admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: member } = await supabase
      .from('group_members').select('role')
      .eq('group_id', groupId).eq('user_id', user.id).single()
    if (member?.role !== 'admin') { router.push(`/grupos/${groupId}`); return }

    const { data } = await supabase
      .from('payment_submissions')
      .select('*, profile:profiles(full_name, photo_url)')
      .eq('id', submissionId)
      .single()

    if (data) {
      setSub({
        ...data,
        full_name: data.profile?.full_name ?? 'Jogador',
        photo_url: data.profile?.photo_url ?? null,
      })
    }
    setLoading(false)
  }

  async function confirmarAcao() {
    if (!sub || !action) return
    if (action === 'reject' && !rejectReason.trim()) {
      alert('Informe o motivo da rejeição.')
      return
    }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()

    if (action === 'approve') {
      // Atualiza submission
      await supabase.from('payment_submissions').update({
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: now,
      }).eq('id', sub.id)

      // Atualiza todos os meses para 'paid'
      const statusRows = sub.months.map(m => ({
        group_id: groupId,
        user_id: sub.user_id,
        month: m,
        status: 'paid',
        submission_id: sub.id,
        updated_by: user?.id,
        updated_at: now,
      }))
      await supabase.from('member_payment_status')
        .upsert(statusRows, { onConflict: 'group_id,user_id,month' })

      // Notifica o jogador
      await supabase.from('notifications').insert({
        user_id: sub.user_id,
        type: 'payment_approved',
        title: '✅ Pagamento aprovado!',
        body: `Seu pagamento de ${periodLabel(sub.period_type)} (${sub.months.map(monthLabel).join(', ')}) foi aprovado.`,
        data: { group_id: groupId, submission_id: sub.id },
        read: false,
      })

    } else {
      // Rejeitar
      await supabase.from('payment_submissions').update({
        status: 'rejected',
        rejection_reason: rejectReason.trim(),
        reviewed_by: user?.id,
        reviewed_at: now,
      }).eq('id', sub.id)

      // Reverte os meses de 'pending' para 'overdue'
      const statusRows = sub.months.map(m => ({
        group_id: groupId,
        user_id: sub.user_id,
        month: m,
        status: 'overdue',
        submission_id: null,
        updated_by: user?.id,
        updated_at: now,
      }))
      await supabase.from('member_payment_status')
        .upsert(statusRows, { onConflict: 'group_id,user_id,month' })

      // Notifica o jogador com motivo
      await supabase.from('notifications').insert({
        user_id: sub.user_id,
        type: 'payment_rejected',
        title: '❌ Comprovante recusado',
        body: `Seu comprovante foi recusado. Motivo: ${rejectReason.trim()}`,
        data: { group_id: groupId, submission_id: sub.id },
        read: false,
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
      <div style={{ width: '4rem', height: '4rem', backgroundColor: action === 'approve' ? '#dcfce7' : '#fee2e2', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {action === 'approve' ? <Check size={32} color="#16a34a" /> : <X size={32} color="#b91c1c" />}
      </div>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: action === 'approve' ? '#15803d' : '#b91c1c' }}>
        {action === 'approve' ? 'Pagamento aprovado!' : 'Comprovante recusado'}
      </p>
      <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Redirecionando...</p>
    </div>
  )

  if (!sub) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#94a3b8' }}>Comprovante não encontrado.</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '6rem' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}>
          <ArrowLeft size={20} color="#64748b" />
        </button>
        <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Validar pagamento</h1>
      </div>

      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Info do jogador */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {sub.photo_url
              ? <img src={sub.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
                  {sub.full_name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
                </span>}
          </div>
          <div>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', margin: '0 0 2px' }}>{sub.full_name}</p>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
              Enviado em {new Date(sub.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })}
            </p>
          </div>
        </div>

        {/* Detalhes do pagamento */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 0.875rem' }}>📋 Detalhes do pagamento</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Período</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{periodLabel(sub.period_type)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Meses</span>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.25rem', justifyContent: 'flex-end', maxWidth: '60%' }}>
                {sub.months.map(m => (
                  <span key={m} style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px' }}>
                    {monthLabel(m)}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Valor declarado</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#15803d' }}>R$ {Number(sub.amount).toFixed(2)}</span>
            </div>
            {sub.status !== 'pending' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Status</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: sub.status === 'approved' ? '#15803d' : '#b91c1c' }}>
                  {sub.status === 'approved' ? '✅ Aprovado' : '❌ Recusado'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Comprovante */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: 0 }}>🧾 Comprovante PIX</p>
            <button onClick={() => setZoomImg(!zoomImg)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.72rem' }}>
              <ZoomIn size={14} /> {zoomImg ? 'Reduzir' : 'Ampliar'}
            </button>
          </div>
          <img
            src={sub.receipt_url} alt="Comprovante"
            style={{ width: '100%', borderRadius: '0.75rem', objectFit: zoomImg ? 'contain' : 'contain', maxHeight: zoomImg ? 'none' : '320px', backgroundColor: '#f8fafc', cursor: 'pointer' }}
            onClick={() => setZoomImg(!zoomImg)}
          />
        </div>

        {/* Ações (só se pendente) */}
        {sub.status === 'pending' && !action && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setAction('reject')}
              style={{ flex: 1, backgroundColor: '#fee2e2', color: '#b91c1c', border: '2px solid #fca5a5', borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <X size={18} /> Recusar
            </button>
            <button onClick={() => setAction('approve')}
              style={{ flex: 1, backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Check size={18} /> Aprovar
            </button>
          </div>
        )}

        {/* Confirmação aprovar */}
        {action === 'approve' && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '1rem', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#15803d', margin: '0 0 0.5rem' }}>✅ Confirmar aprovação?</p>
            <p style={{ fontSize: '0.78rem', color: '#15803d', margin: '0 0 1rem', lineHeight: 1.5 }}>
              Os meses <strong>{sub.months.map(monthLabel).join(', ')}</strong> serão marcados como <strong>pagos</strong> e o jogador será notificado.
            </p>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={confirmarAcao} disabled={saving}
                style={{ flex: 1, backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Salvando...' : 'Confirmar aprovação'}
              </button>
              <button onClick={() => setAction(null)}
                style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Confirmação recusar */}
        {action === 'reject' && (
          <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '1rem', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#b91c1c', margin: '0 0 0.5rem' }}>❌ Recusar comprovante?</p>
            <p style={{ fontSize: '0.78rem', color: '#b91c1c', margin: '0 0 0.75rem' }}>Informe o motivo — o jogador será notificado e poderá reenviar.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ex: valor incorreto, comprovante ilegível, data errada..."
              rows={3}
              style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #fca5a5', borderRadius: '0.75rem', fontSize: '0.85rem', outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
            />
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={confirmarAcao} disabled={saving || !rejectReason.trim()}
                style={{ flex: 1, backgroundColor: saving || !rejectReason.trim() ? '#94a3b8' : '#b91c1c', color: 'white', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: saving || !rejectReason.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                {saving ? 'Salvando...' : 'Confirmar recusa'}
              </button>
              <button onClick={() => { setAction(null); setRejectReason('') }}
                style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Se já foi processado anteriormente */}
        {sub.status === 'rejected' && sub.rejection_reason && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '1rem', padding: '1rem' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b91c1c', margin: '0 0 0.25rem' }}>Motivo da recusa:</p>
            <p style={{ fontSize: '0.82rem', color: '#7f1d1d', margin: 0 }}>{sub.rejection_reason}</p>
          </div>
        )}
      </div>
    </div>
  )
}

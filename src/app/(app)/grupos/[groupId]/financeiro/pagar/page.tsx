'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Upload, X, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FinConfig {
  monthly_fee: number
  due_day: number
  pix_key: string | null
}

const PERIOD_OPTIONS = [
  { value: 'monthly',    label: 'Mensal',     months: 1  },
  { value: 'quarterly',  label: 'Trimestral', months: 3  },
  { value: 'semiannual', label: 'Semestral',  months: 6  },
  { value: 'annual',     label: 'Anual',      months: 12 },
]

const MONTH_LABELS: Record<string, string> = {
  '01':'Jan','02':'Fev','03':'Mar','04':'Abr',
  '05':'Mai','06':'Jun','07':'Jul','08':'Ago',
  '09':'Set','10':'Out','11':'Nov','12':'Dez',
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return `${MONTH_LABELS[mo]} ${y}`
}

function addMonths(base: string, n: number): string {
  const [y, mo] = base.split('-').map(Number)
  const d = new Date(y, mo - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PagarPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<FinConfig | null>(null)
  const [myUserId, setMyUserId] = useState('')
  const [nextOpenMonth, setNextOpenMonth] = useState('')
  const [period, setPeriod] = useState('monthly')
  const [coveredMonths, setCoveredMonths] = useState<string[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => { fetchData() }, [groupId])

  useEffect(() => {
    if (!nextOpenMonth) return
    const opt = PERIOD_OPTIONS.find(p => p.value === period)!
    if (period === 'annual') {
      // Janeiro a dezembro do ano corrente do próximo mês aberto
      const year = nextOpenMonth.split('-')[0]
      const months = Array.from({ length: 12 }, (_, i) =>
        `${year}-${String(i + 1).padStart(2, '0')}`
      )
      setCoveredMonths(months)
    } else {
      const months = Array.from({ length: opt.months }, (_, i) => addMonths(nextOpenMonth, i))
      setCoveredMonths(months)
    }
  }, [period, nextOpenMonth])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setMyUserId(user.id)

    const { data: cfg } = await supabase
      .from('group_finance_config').select('*').eq('group_id', groupId).single()
    if (!cfg) { router.back(); return }
    setConfig(cfg)

    // Descobrir próximo mês aberto
    const { data: statuses } = await supabase
      .from('member_payment_status')
      .select('month, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .in('status', ['paid', 'manual', 'pending'])
      .order('month', { ascending: false })
      .limit(1)

    const cur = new Date()
    const curMonth = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`

    if (statuses && statuses.length > 0) {
      setNextOpenMonth(addMonths(statuses[0].month, 1))
    } else {
      setNextOpenMonth(curMonth)
    }

    setLoading(false)
  }

  function handleImage(file: File) {
    if (!file.type.startsWith('image/')) { alert('Envie apenas imagens.'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Imagem muito grande. Máximo 10MB.'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function copiarPix() {
    if (!config?.pix_key) return
    await navigator.clipboard.writeText(config.pix_key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function enviar() {
    if (!imageFile) { alert('Anexe o comprovante de pagamento.'); return }
    if (coveredMonths.length === 0) { alert('Erro ao calcular meses.'); return }
    setSending(true)

    try {
      const submissionId = crypto.randomUUID()
      const ext = imageFile.name.split('.').pop() ?? 'jpg'
      const path = `${groupId}/${myUserId}/${submissionId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(path, imageFile, { contentType: imageFile.type })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('payment-receipts').getPublicUrl(path)
      const receiptUrl = urlData.publicUrl

      const totalAmount = config!.monthly_fee * coveredMonths.length

      const { error: subError } = await supabase.from('payment_submissions').insert({
        id: submissionId,
        group_id: groupId,
        user_id: myUserId,
        months: coveredMonths,
        period_type: period,
        amount: totalAmount,
        receipt_url: receiptUrl,
        status: 'pending',
      })

      if (subError) throw subError

      // Cria status 'pending' para cada mês coberto
      const statusRows = coveredMonths.map(m => ({
        group_id: groupId,
        user_id: myUserId,
        month: m,
        status: 'pending',
        submission_id: submissionId,
        updated_at: new Date().toISOString(),
      }))

      await supabase.from('member_payment_status')
        .upsert(statusRows, { onConflict: 'group_id,user_id,month' })

      // Notificação in-app para admins
      const { data: admins } = await supabase
        .from('group_members').select('user_id')
        .eq('group_id', groupId).eq('role', 'admin').eq('is_active', true)

      if (admins && admins.length > 0) {
        const { data: profile } = await supabase
          .from('profiles').select('full_name').eq('id', myUserId).single()
        const nome = profile?.full_name ?? 'Um membro'

        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.user_id,
            type: 'payment_pending',
            title: '💰 Novo comprovante',
            body: `${nome} enviou um comprovante de pagamento (${PERIOD_OPTIONS.find(p => p.value === period)?.label}).`,
            data: { group_id: groupId, submission_id: submissionId },
            read: false,
          }))
        )
      }

      setSent(true)
      setTimeout(() => router.push(`/grupos/${groupId}/financeiro`), 2000)

    } catch (err: any) {
      alert(`Erro ao enviar: ${err.message}`)
      setSending(false)
    }
  }

  const totalAmount = config ? config.monthly_fee * coveredMonths.length : 0

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '2.5rem' }}>⚽</div>
    </div>
  )

  if (sent) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
      <div style={{ width: '4rem', height: '4rem', backgroundColor: '#dcfce7', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={32} color="#16a34a" />
      </div>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: '#15803d' }}>Comprovante enviado!</p>
      <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Aguardando validação do administrador.</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '6rem' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}>
          <ArrowLeft size={20} color="#64748b" />
        </button>
        <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Enviar pagamento</h1>
      </div>

      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Período */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 0.875rem' }}>Selecione o período</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setPeriod(opt.value)}
                style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `2px solid ${period === opt.value ? '#16a34a' : '#e2e8f0'}`, backgroundColor: period === opt.value ? '#f0fdf4' : 'white', color: period === opt.value ? '#15803d' : '#475569', fontWeight: period === opt.value ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Meses cobertos */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 0.75rem' }}>📅 Meses que serão cobertos</p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.375rem', marginBottom: '0.875rem' }}>
            {coveredMonths.map(m => (
              <span key={m} style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px', border: '1px solid #86efac' }}>
                {monthLabel(m)}
              </span>
            ))}
          </div>
          <div style={{ backgroundColor: '#f0fdf4', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>Total a pagar</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#15803d' }}>R$ {totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* PIX */}
        {config?.pix_key && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 0.75rem' }}>📲 Chave PIX para pagamento</p>
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', padding: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <p style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', margin: 0, wordBreak: 'break-all' as const }}>{config.pix_key}</p>
              <button onClick={copiarPix}
                style={{ backgroundColor: copied ? '#dcfce7' : '#16a34a', color: copied ? '#15803d' : 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 0.875rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {copied ? <Check size={14} /> : null}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
              Faça o PIX no valor de <strong>R$ {totalAmount.toFixed(2)}</strong> e anexe o comprovante abaixo.
            </p>
          </div>
        )}

        {/* Upload comprovante */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 0.75rem' }}>🧾 Comprovante de pagamento</p>

          {imagePreview ? (
            <div style={{ position: 'relative' as const }}>
              <img src={imagePreview} alt="Comprovante" style={{ width: '100%', borderRadius: '0.75rem', maxHeight: '300px', objectFit: 'contain', backgroundColor: '#f8fafc' }} />
              <button onClick={() => { setImageFile(null); setImagePreview(null) }}
                style={{ position: 'absolute' as const, top: '0.5rem', right: '0.5rem', backgroundColor: '#1e293b99', border: 'none', borderRadius: '9999px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color="white" />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              style={{ width: '100%', border: '2px dashed #cbd5e1', borderRadius: '0.875rem', padding: '2rem 1rem', backgroundColor: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={28} color="#94a3b8" />
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', margin: 0 }}>Toque para anexar o comprovante</p>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>JPG, PNG ou WEBP · máx. 10MB</p>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleImage(e.target.files[0]) }} />
        </div>

        {/* Botão enviar */}
        <button onClick={enviar} disabled={sending || !imageFile}
          style={{ width: '100%', backgroundColor: sending || !imageFile ? '#94a3b8' : '#16a34a', color: 'white', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.9rem', cursor: sending || !imageFile ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          {sending ? <Loader2 size={18} className="animate-spin" /> : null}
          {sending ? 'Enviando...' : 'Enviar comprovante'}
        </button>
      </div>
    </div>
  )
}

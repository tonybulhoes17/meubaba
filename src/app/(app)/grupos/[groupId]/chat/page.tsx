'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, Mic, Image, X, Reply, Trash2, AtSign, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { notificarMembros, notificarUsuario } from '@/lib/notificacoes'

interface Mensagem {
  id: string
  sender_id: string
  content: string | null
  audio_url: string | null
  photo_url: string | null
  reply_to_id: string | null
  mentions: string[] | null
  created_at: string
  is_deleted: boolean
  sender_name: string
  sender_photo: string | null
  sender_initials: string
  reply_to?: { content: string | null; sender_name: string } | null
  reactions: { emoji: string; user_ids: string[] }[]
}

interface Membro {
  user_id: string
  nome: string
  foto: string | null
  initials: string
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '⚽', '👏']

// Comprime imagem antes do upload — max 800px, qualidade 0.75
async function comprimirImagem(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 800
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX }
        else { w = Math.round((w * MAX) / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', 0.75)
    }
    img.src = url
  })
}

export default function ChatPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [myUserId, setMyUserId] = useState('')
  const [groupName, setGroupName] = useState('')
  const [membros, setMembros] = useState<Membro[]>([])
  const membrosRef = useRef<Membro[]>([])
  const groupNameRef = useRef('')
  const myUserIdRef = useRef('')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [replyTo, setReplyTo] = useState<Mensagem | null>(null)
  const [emojiTarget, setEmojiTarget] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [grupos, setGrupos] = useState<{ id: string; nome: string; ultima_msg: string | null; hora: string | null }[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<MediaRecorder | null>(null)
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    let channel: any
    initChat().then(ch => { channel = ch })
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [groupId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function initChat() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setMyUserId(user.id)
    myUserIdRef.current = user.id

    const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).single()
    const nome = group?.name ?? 'Chat'
    setGroupName(nome)
    groupNameRef.current = nome

    // Membros
    const { data: membrosData } = await supabase
      .from('group_members')
      .select('user_id, profile:profiles(full_name, photo_url)')
      .eq('group_id', groupId).eq('is_active', true)

    const lista: Membro[] = (membrosData ?? []).map((m: any) => {
      const n = m.profile?.full_name ?? 'Jogador'
      return { user_id: m.user_id, nome: n, foto: m.profile?.photo_url ?? null, initials: n.split(' ').map((x: string) => x[0]).slice(0, 2).join('') }
    })
    setMembros(lista)
    membrosRef.current = lista

    // Sidebar grupos
    const { data: gruposData } = await supabase
      .from('group_members').select('group_id, groups(name)').eq('user_id', user.id).eq('is_active', true)
    const gl: any[] = []
    for (const g of gruposData ?? []) {
      const { data: u } = await supabase.from('chat_messages').select('content, audio_url, photo_url, created_at')
        .eq('group_id', g.group_id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(1).single()
      gl.push({ id: g.group_id, nome: (g.groups as any)?.name ?? 'Grupo', ultima_msg: u?.photo_url ? '📷 Foto' : u?.audio_url ? '🎙️ Áudio' : (u?.content ?? null), hora: u?.created_at ?? null })
    }
    setGrupos(gl)

    // Carrega mensagens
    await carregarMensagens(lista)

    // ── REALTIME ──────────────────────────────────────────
    const channel = supabase.channel(`chat-group-${groupId}`)

    channel.on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` },
      (payload: any) => {
        const m = payload.new
        // Ignora se já existe (pode ser a nossa própria mensagem otimista)
        setMensagens(prev => {
          if (prev.find(x => x.id === m.id)) return prev
          // Remove o temp correspondente se for nossa mensagem
          const semTemp = prev.filter(x => !(x.id.startsWith('temp-') && x.sender_id === m.sender_id))
          const remetente = membrosRef.current.find(l => l.user_id === m.sender_id)
          const sNome = remetente?.nome ?? 'Jogador'
          const nova: Mensagem = {
            id: m.id, sender_id: m.sender_id, content: m.content,
            audio_url: m.audio_url, photo_url: m.photo_url,
            reply_to_id: m.reply_to_id, mentions: m.mentions,
            created_at: m.created_at, is_deleted: m.is_deleted,
            sender_name: sNome, sender_photo: remetente?.foto ?? null,
            sender_initials: sNome.split(' ').map((x: string) => x[0]).slice(0, 2).join(''),
            reply_to: null, reactions: [],
          }
          return [...semTemp, nova]
        })
      }
    )

    channel.on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` },
      (payload: any) => {
        setMensagens(prev => prev.map(m => m.id === payload.new.id
          ? { ...m, is_deleted: payload.new.is_deleted, content: payload.new.content } : m))
      }
    )

    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'message_reactions' },
      () => { carregarMensagens(membrosRef.current) }
    )

    channel.subscribe((status: string) => {
      console.log('Chat Realtime status:', status)
    })

    setLoading(false)
    return channel
  }

  async function carregarMensagens(lista?: Membro[]) {
    const { data: msgs, error } = await supabase
      .from('chat_messages')
      .select('id, sender_id, content, audio_url, photo_url, reply_to_id, mentions, created_at, is_deleted')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error || !msgs || msgs.length === 0) { setMensagens([]); return }

    const senderIds = [...new Set(msgs.map((m: any) => m.sender_id))]
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, photo_url').in('id', senderIds)
    const profilesMap: Record<string, any> = {}
    for (const p of profiles ?? []) profilesMap[p.id] = p

    const msgIds = msgs.map((m: any) => m.id)
    const { data: reacoes } = await supabase.from('message_reactions').select('message_id, emoji, user_id').in('message_id', msgIds)
    const reacoesMap: Record<string, { emoji: string; user_ids: string[] }[]> = {}
    for (const r of reacoes ?? []) {
      if (!reacoesMap[r.message_id]) reacoesMap[r.message_id] = []
      const ex = reacoesMap[r.message_id].find(x => x.emoji === r.emoji)
      if (ex) ex.user_ids.push(r.user_id)
      else reacoesMap[r.message_id].push({ emoji: r.emoji, user_ids: [r.user_id] })
    }

    const replyIds = msgs.filter((m: any) => m.reply_to_id).map((m: any) => m.reply_to_id)
    const repliesMap: Record<string, any> = {}
    if (replyIds.length > 0) {
      const { data: replies } = await supabase.from('chat_messages').select('id, content, sender_id').in('id', replyIds)
      for (const r of replies ?? []) repliesMap[r.id] = { ...r, sender_name: profilesMap[r.sender_id]?.full_name ?? 'Jogador' }
    }

    const formatadas: Mensagem[] = msgs.map((m: any) => {
      const prof = profilesMap[m.sender_id]
      const n = prof?.full_name ?? 'Jogador'
      return {
        id: m.id, sender_id: m.sender_id, content: m.content,
        audio_url: m.audio_url, photo_url: m.photo_url,
        reply_to_id: m.reply_to_id, mentions: m.mentions,
        created_at: m.created_at, is_deleted: m.is_deleted,
        sender_name: n, sender_photo: prof?.photo_url ?? null,
        sender_initials: n.split(' ').map((x: string) => x[0]).slice(0, 2).join(''),
        reply_to: m.reply_to_id && repliesMap[m.reply_to_id]
          ? { content: repliesMap[m.reply_to_id].content, sender_name: repliesMap[m.reply_to_id].sender_name }
          : null,
        reactions: reacoesMap[m.id] ?? [],
      }
    })
    setMensagens(formatadas)
  }

  function handleTextoChange(val: string) {
    setTexto(val)
    const match = val.match(/@(\w*)$/)
    if (match) { setShowMentions(true); setMentionQuery(match[1]) }
    else setShowMentions(false)
  }

  function inserirMencao(membro: Membro) {
    setTexto(texto.replace(/@\w*$/, `@${membro.nome.split(' ')[0]} `))
    setShowMentions(false)
    inputRef.current?.focus()
  }

  async function enviar(audioUrl?: string, photoUrl?: string) {
    const conteudo = texto.trim()
    if (!conteudo && !audioUrl && !photoUrl) return

    const mencoes = membros.filter(m => conteudo.includes(`@${m.nome.split(' ')[0]}`)).map(m => m.user_id)
    const meuMembro = membros.find(m => m.user_id === myUserIdRef.current)
    const meuNome = meuMembro?.nome ?? 'Você'
    const replyAtual = replyTo

    // ── Atualização otimista — aparece IMEDIATAMENTE ──
    const tempId = `temp-${Date.now()}`
    const otimista: Mensagem = {
      id: tempId, sender_id: myUserIdRef.current,
      content: conteudo || null, audio_url: audioUrl ?? null, photo_url: photoUrl ?? null,
      reply_to_id: replyAtual?.id ?? null, mentions: mencoes.length > 0 ? mencoes : null,
      created_at: new Date().toISOString(), is_deleted: false,
      sender_name: meuNome, sender_photo: meuMembro?.foto ?? null,
      sender_initials: meuNome.split(' ').map((x: string) => x[0]).slice(0, 2).join(''),
      reply_to: replyAtual ? { content: replyAtual.content, sender_name: replyAtual.sender_name } : null,
      reactions: [],
    }
    setMensagens(prev => [...prev, otimista])
    setTexto('')
    setReplyTo(null)

    // ── Insert no banco ──
    await supabase.from('chat_messages').insert({
      group_id: groupId, sender_id: myUserIdRef.current,
      content: conteudo || null, audio_url: audioUrl ?? null,
      photo_url: photoUrl ?? null, reply_to_id: replyAtual?.id ?? null,
      mentions: mencoes.length > 0 ? mencoes : null,
    })

    // ── Notificações em background (não bloqueiam a UI) ──
    const preview = audioUrl ? '🎙️ Áudio' : photoUrl ? '📷 Foto' : conteudo.slice(0, 50)
    notificarMembros(groupId, 'chat_message', `💬 ${meuNome.split(' ')[0]} no ${groupNameRef.current}`, preview, { group_id: groupId }, myUserIdRef.current)
    for (const uid of mencoes) {
      notificarUsuario(uid, groupId, 'mention', `📣 ${meuNome.split(' ')[0]} mencionou você`, conteudo.slice(0, 60), { group_id: groupId })
    }
  }

  async function reagir(messageId: string, emoji: string) {
    setEmojiTarget(null)
    const msg = mensagens.find(m => m.id === messageId)
    const jaReagiu = msg?.reactions.find(r => r.emoji === emoji)?.user_ids.includes(myUserId)
    if (jaReagiu) await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', myUserId).eq('emoji', emoji)
    else await supabase.from('message_reactions').insert({ message_id: messageId, user_id: myUserId, emoji })
  }

  async function apagarMensagem(id: string) {
    await supabase.from('chat_messages').update({ is_deleted: true, content: null }).eq('id', id)
    setConfirmDelete(null)
  }

  async function uploadFoto(file: File) {
    setUploadingMedia(true)
    const compressed = await comprimirImagem(file)
    const path = `${myUserIdRef.current}/${Date.now()}.jpg`
    const { error } = await supabase.storage.from('chat-media').upload(path, compressed, { contentType: 'image/jpeg' })
    if (error) { alert('Erro ao enviar foto'); setUploadingMedia(false); return }
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path)
    setUploadingMedia(false)
    await enviar(undefined, urlData.publicUrl)
  }

  async function iniciarGravacao() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = e => chunks.push(e.data)
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      const path = `${myUserIdRef.current}/${Date.now()}.webm`
      setUploadingMedia(true)
      const { error } = await supabase.storage.from('chat-media').upload(path, blob)
      if (!error) {
        const { data } = supabase.storage.from('chat-media').getPublicUrl(path)
        await enviar(data.publicUrl)
      }
      setUploadingMedia(false)
      stream.getTracks().forEach(t => t.stop())
    }
    recorder.start()
    audioRef.current = recorder
    setGravando(true)
  }

  function pararGravacao() { audioRef.current?.stop(); setGravando(false) }

  function formatHora(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatData(iso: string) {
    const d = new Date(iso), hoje = new Date(), ontem = new Date(hoje)
    ontem.setDate(hoje.getDate() - 1)
    if (d.toDateString() === hoje.toDateString()) return 'Hoje'
    if (d.toDateString() === ontem.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  }

  function formatHoraSidebar(iso: string | null) {
    if (!iso) return ''
    const d = new Date(iso), hoje = new Date(), ontem = new Date(hoje)
    ontem.setDate(hoje.getDate() - 1)
    if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === ontem.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const mensagensAgrupadas: { data: string; msgs: Mensagem[] }[] = []
  for (const m of mensagens) {
    const data = formatData(m.created_at)
    const ultimo = mensagensAgrupadas[mensagensAgrupadas.length - 1]
    if (!ultimo || ultimo.data !== data) mensagensAgrupadas.push({ data, msgs: [m] })
    else ultimo.msgs.push(m)
  }

  const membrosFiltrados = membros.filter(m => m.nome.toLowerCase().includes(mentionQuery.toLowerCase()) && m.user_id !== myUserId)

  if (loading) return (
    <div style={{ height: '100dvh', backgroundColor: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>💬</div>
    </div>
  )

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div style={{ height: '100dvh', backgroundColor: '#f0f2f5', display: 'flex', alignItems: 'stretch', justifyContent: 'center', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: '1100px', height: '100dvh', display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR — esconde no mobile */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRight: '1px solid #e2e8f0' }}
          className="hidden md:flex">
          <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', padding: '1rem' }}>
            <p style={{ color: 'white', fontWeight: 800, fontSize: '1rem', margin: '0 0 2px' }}>💬 Conversas</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', margin: 0 }}>{grupos.length} grupo{grupos.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {grupos.map(g => (
              <button key={g.id} onClick={() => router.push(`/grupos/${g.id}/chat`)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f8fafc', backgroundColor: g.id === groupId ? '#f0fdf4' : 'white', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (g.id !== groupId) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                onMouseLeave={e => { if (g.id !== groupId) e.currentTarget.style.backgroundColor = 'white' }}>
                <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '9999px', background: 'linear-gradient(135deg, #16a34a, #15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>⚽</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: g.id === groupId ? 800 : 600, color: g.id === groupId ? '#16a34a' : '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{g.nome}</p>
                    <span style={{ fontSize: '0.65rem', color: g.id === groupId ? '#16a34a' : '#94a3b8', flexShrink: 0 }}>{formatHoraSidebar(g.hora)}</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.ultima_msg ?? <em style={{ color: '#cbd5e1' }}>Nenhuma mensagem</em>}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ÁREA DO CHAT */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: '#f8fafc', position: 'relative' }}>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', padding: '1rem 1.25rem', paddingTop: 'max(1rem, env(safe-area-inset-top))', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', flexShrink: 0 }}><ArrowLeft size={20} /></button>
              <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>⚽</div>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>{groupName}</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.68rem', margin: 0 }}>{membros.length} membros</p>
              </div>
            </div>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '2px', boxSizing: 'border-box' }}
            onClick={() => { setEmojiTarget(null); setConfirmDelete(null) }}>

            {mensagens.length === 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem' }}>
                <p style={{ fontSize: '3rem', margin: '0 0 0.5rem' }}>💬</p>
                <p style={{ color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Nenhuma mensagem ainda</p>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', marginTop: '0.25rem' }}>Seja o primeiro a escrever!</p>
              </div>
            )}

            {mensagensAgrupadas.map(({ data, msgs }) => (
              <div key={data}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0' }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', padding: '2px 10px', borderRadius: '9999px', whiteSpace: 'nowrap' }}>{data}</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
                </div>

                {msgs.map((msg, i) => {
                  const isMine = msg.sender_id === myUserId
                  const showAvatar = !isMine && (i === 0 || msgs[i - 1]?.sender_id !== msg.sender_id)
                  const isTemp = msg.id.startsWith('temp-')

                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '0.5rem', marginBottom: '2px', opacity: isTemp ? 0.75 : 1 }}>
                      {!isMine && (
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '9999px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', opacity: showAvatar ? 1 : 0, marginBottom: '2px' }}>
                          {msg.sender_photo ? <img src={msg.sender_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b' }}>{msg.sender_initials}</span>}
                        </div>
                      )}

                      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: '2px' }}>
                        {showAvatar && !isMine && <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', margin: '0 0 2px 4px' }}>{msg.sender_name}</p>}

                        <div onDoubleClick={() => setEmojiTarget(emojiTarget === msg.id ? null : msg.id)}
                          style={{ backgroundColor: isMine ? '#dcfce7' : 'white', borderRadius: isMine ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem', padding: '0.5rem 0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'pointer' }}>

                          {msg.reply_to && !msg.is_deleted && (
                            <div style={{ backgroundColor: 'rgba(0,0,0,0.05)', borderLeft: '3px solid #16a34a', borderRadius: '0.5rem', padding: '4px 8px', marginBottom: '6px' }}>
                              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#16a34a', margin: '0 0 1px' }}>{msg.reply_to.sender_name}</p>
                              <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{msg.reply_to.content ?? '📎 Mídia'}</p>
                            </div>
                          )}

                          {msg.is_deleted ? (
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>🚫 Mensagem apagada</p>
                          ) : (
                            <>
                              {msg.photo_url && <img src={msg.photo_url} alt="" style={{ maxWidth: '200px', borderRadius: '0.75rem', display: 'block', marginBottom: msg.content ? '6px' : '0' }} />}
                              {msg.audio_url && <audio controls src={msg.audio_url} style={{ maxWidth: '200px', height: '36px' }} />}
                              {msg.content && (
                                <p style={{ fontSize: '0.9rem', color: '#1e293b', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}
                                  dangerouslySetInnerHTML={{ __html: msg.content.replace(/@(\w+)/g, '<span style="color:#16a34a;font-weight:700">@$1</span>') }} />
                              )}
                            </>
                          )}

                          <p style={{ fontSize: '0.62rem', color: '#94a3b8', margin: '3px 0 0', textAlign: 'right' }}>
                            {isTemp ? '⏳' : formatHora(msg.created_at)}
                          </p>
                        </div>

                        {msg.reactions.length > 0 && (
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: isMine ? 'flex-end' : 'flex-start', marginTop: '2px' }}>
                            {msg.reactions.map(r => (
                              <button key={r.emoji} onClick={() => reagir(msg.id, r.emoji)}
                                style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: r.user_ids.includes(myUserId) ? '#dcfce7' : 'white', border: `1px solid ${r.user_ids.includes(myUserId) ? '#16a34a44' : '#e2e8f0'}`, borderRadius: '9999px', padding: '2px 7px', cursor: 'pointer', fontSize: '0.75rem' }}>
                                <span>{r.emoji}</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>{r.user_ids.length}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {emojiTarget === msg.id && !msg.is_deleted && (
                          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '0.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', gap: '4px', flexWrap: 'wrap', zIndex: 20, position: 'relative' }}
                            onClick={e => e.stopPropagation()}>
                            {EMOJIS.map(e => (
                              <button key={e} onClick={() => reagir(msg.id, e)} style={{ fontSize: '1.2rem', border: 'none', background: 'none', cursor: 'pointer', padding: '4px', borderRadius: '0.5rem' }}>{e}</button>
                            ))}
                            <div style={{ width: '100%', height: '1px', backgroundColor: '#f1f5f9', margin: '2px 0' }} />
                            <button onClick={() => { setReplyTo(msg); setEmojiTarget(null); inputRef.current?.focus() }}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#475569', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '0.5rem' }}>
                              <Reply size={13} /> Responder
                            </button>
                            {isMine && (
                              <button onClick={() => { setConfirmDelete(msg.id); setEmojiTarget(null) }}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '0.5rem' }}>
                                <Trash2 size={13} /> Apagar
                              </button>
                            )}
                          </div>
                        )}

                        {confirmDelete === msg.id && (
                          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => apagarMensagem(msg.id)} style={{ fontSize: '0.72rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '0.5rem', padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>Apagar</button>
                            <button onClick={() => setConfirmDelete(null)} style={{ fontSize: '0.72rem', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.5rem', padding: '4px 10px', cursor: 'pointer' }}>Cancelar</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Mentions */}
          {showMentions && membrosFiltrados.length > 0 && (
            <div style={{ position: 'absolute', bottom: '4.5rem', left: '1.25rem', right: '1.25rem', backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden', zIndex: 50 }}>
              {membrosFiltrados.slice(0, 5).map(m => (
                <button key={m.user_id} onClick={() => inserirMencao(m)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', border: 'none', backgroundColor: 'white', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {m.foto ? <img src={m.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>{m.initials}</span>}
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{m.nome}</span>
                </button>
              ))}
            </div>
          )}

          {/* Reply preview */}
          {replyTo && (
            <div style={{ backgroundColor: '#f0fdf4', borderTop: '1px solid #bbf7d0', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              <Reply size={16} color="#16a34a" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', margin: 0 }}>{replyTo.sender_name}</p>
                <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.content ?? '📎 Mídia'}</p>
              </div>
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}><X size={16} color="#94a3b8" /></button>
            </div>
          )}

          {/* Input */}
          <div style={{ backgroundColor: 'white', borderTop: '1px solid #e2e8f0', padding: '0.625rem 1rem', paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}
            className="md:pb-3">
            <button onClick={() => fileRef.current?.click()} disabled={uploadingMedia}
              style={{ width: '36px', height: '36px', borderRadius: '9999px', backgroundColor: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {uploadingMedia ? <Loader2 size={16} color="#64748b" /> : <Image size={16} color="#64748b" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadFoto(e.target.files[0]) }} />

            <div style={{ flex: 1, backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '1.5rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input ref={inputRef} value={texto} onChange={e => handleTextoChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Digite uma mensagem..."
                style={{ flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '0.9rem', color: '#1e293b' }} />
              <button onClick={() => handleTextoChange(texto + '@')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                <AtSign size={15} color="#94a3b8" />
              </button>
            </div>

            {texto.trim() ? (
              <button onClick={() => enviar()} disabled={sending}
                style={{ width: '40px', height: '40px', borderRadius: '9999px', background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {sending ? <Loader2 size={18} color="white" /> : <Send size={18} color="white" />}
              </button>
            ) : (
              <button onMouseDown={iniciarGravacao} onMouseUp={pararGravacao} onTouchStart={iniciarGravacao} onTouchEnd={pararGravacao}
                style={{ width: '40px', height: '40px', borderRadius: '9999px', background: gravando ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                <Mic size={18} color="white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

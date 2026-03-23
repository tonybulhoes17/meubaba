'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, Mic, Image, X, Reply, Smile, Trash2, AtSign, Loader2 } from 'lucide-react'
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

export default function ChatPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [myUserId, setMyUserId] = useState('')
  const [groupName, setGroupName] = useState('')
  const [membros, setMembros] = useState<Membro[]>([])
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [replyTo, setReplyTo] = useState<Mensagem | null>(null)
  const [emojiTarget, setEmojiTarget] = useState<string | null>(null) // message_id
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [uploadingMedia, setUploadingMedia] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<MediaRecorder | null>(null)
  const [gravando, setGravando] = useState(false)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [grupos, setGrupos] = useState<{ id: string; nome: string; ultima_msg: string | null; hora: string | null }[]>([])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    fetchData().then(fn => { cleanup = fn })
    return () => { cleanup?.() }
  }, [groupId])

  // Scroll ao fundo quando chegam mensagens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyUserId(user.id)

    const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).single()
    setGroupName(group?.name ?? 'Chat')

    // Membros (para mentions)
    const { data: membrosData } = await supabase
      .from('group_members')
      .select('user_id, profile:profiles(full_name, photo_url)')
      .eq('group_id', groupId).eq('is_active', true)

    const lista: Membro[] = (membrosData ?? []).map((m: any) => {
      const nome = m.profile?.full_name ?? 'Jogador'
      return { user_id: m.user_id, nome, foto: m.profile?.photo_url ?? null, initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('') }
    })
    setMembros(lista)

    // Busca todos os grupos do usuário para sidebar
    const { data: gruposData } = await supabase
      .from('group_members')
      .select('group_id, groups(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const gruposList = []
    for (const g of gruposData ?? []) {
      const { data: ultima } = await supabase
        .from('chat_messages')
        .select('content, audio_url, photo_url, created_at')
        .eq('group_id', g.group_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1).single()
      gruposList.push({
        id: g.group_id,
        nome: (g.groups as any)?.name ?? 'Grupo',
        ultima_msg: ultima?.photo_url ? '📷 Foto' : ultima?.audio_url ? '🎙️ Áudio' : (ultima?.content ?? null),
        hora: ultima?.created_at ?? null,
      })
    }
    setGrupos(gruposList)

    // Busca mensagens
    await fetchMensagens(lista)

    // Realtime
    const channel = supabase
      .channel(`chat-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const m = payload.new as any
          // Usa dados do remetente já carregados em lista
          const remetente = lista.find(l => l.user_id === m.sender_id)
          const nome = remetente?.nome ?? 'Jogador'
          const novaMensagem: Mensagem = {
            id: m.id, sender_id: m.sender_id, content: m.content,
            audio_url: m.audio_url, photo_url: m.photo_url,
            reply_to_id: m.reply_to_id, mentions: m.mentions,
            created_at: m.created_at, is_deleted: m.is_deleted,
            sender_name: nome, sender_photo: remetente?.foto ?? null,
            sender_initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
            reply_to: null, reactions: [],
          }
          setMensagens(prev => {
            if (prev.find(msg => msg.id === novaMensagem.id)) return prev
            return [...prev, novaMensagem]
          })
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          setMensagens(prev => prev.map(m => m.id === payload.new.id ? { ...m, is_deleted: payload.new.is_deleted, content: payload.new.content } : m))
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' },
        async () => { await fetchMensagens(lista) })
      .subscribe()

    setLoading(false)
    console.log('Canal Realtime inscrito:', channel.state)
    return () => { supabase.removeChannel(channel) }
  }

  async function fetchMensagens(lista?: Membro[]) {
    const membrosParaUsar = lista ?? membros

    // Query simples — sem joins complexos
    const { data: msgs, error } = await supabase
      .from('chat_messages')
      .select('id, sender_id, content, audio_url, photo_url, reply_to_id, mentions, created_at, is_deleted')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) { console.error('Erro fetchMensagens:', error); return }
    if (!msgs || msgs.length === 0) { setMensagens([]); return }

    // Busca senders
    const senderIds = [...new Set(msgs.map((m: any) => m.sender_id))]
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, photo_url').in('id', senderIds)
    const profilesMap: Record<string, any> = {}
    for (const p of profiles ?? []) profilesMap[p.id] = p

    // Busca reações
    const msgIds = msgs.map((m: any) => m.id)
    const { data: reacoes } = await supabase
      .from('message_reactions').select('message_id, emoji, user_id').in('message_id', msgIds)
    const reacoesMap: Record<string, { emoji: string; user_ids: string[] }[]> = {}
    for (const r of reacoes ?? []) {
      if (!reacoesMap[r.message_id]) reacoesMap[r.message_id] = []
      const ex = reacoesMap[r.message_id].find(x => x.emoji === r.emoji)
      if (ex) ex.user_ids.push(r.user_id)
      else reacoesMap[r.message_id].push({ emoji: r.emoji, user_ids: [r.user_id] })
    }

    // Busca replies
    const replyIds = msgs.filter((m: any) => m.reply_to_id).map((m: any) => m.reply_to_id)
    const repliesMap: Record<string, any> = {}
    if (replyIds.length > 0) {
      const { data: replies } = await supabase
        .from('chat_messages').select('id, content, sender_id').in('id', replyIds)
      for (const r of replies ?? []) repliesMap[r.id] = { ...r, sender_name: profilesMap[r.sender_id]?.full_name ?? 'Jogador' }
    }

    const formatadas: Mensagem[] = msgs.map((m: any) => {
      const prof = profilesMap[m.sender_id]
      const nome = prof?.full_name ?? 'Jogador'
      return {
        id: m.id, sender_id: m.sender_id, content: m.content,
        audio_url: m.audio_url, photo_url: m.photo_url,
        reply_to_id: m.reply_to_id, mentions: m.mentions,
        created_at: m.created_at, is_deleted: m.is_deleted,
        sender_name: nome, sender_photo: prof?.photo_url ?? null,
        sender_initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
        reply_to: m.reply_to_id && repliesMap[m.reply_to_id]
          ? { content: repliesMap[m.reply_to_id].content, sender_name: repliesMap[m.reply_to_id].sender_name }
          : null,
        reactions: reacoesMap[m.id] ?? [],
      }
    })
    setMensagens(formatadas)
  }

  function formatarMensagemSync(m: any, lista: Membro[]): Mensagem {
    const nome = m.sender?.full_name ?? 'Jogador'
    const reacoesMapa: Record<string, string[]> = {}
    for (const r of m.reactions ?? []) {
      if (!reacoesMapa[r.emoji]) reacoesMapa[r.emoji] = []
      reacoesMapa[r.emoji].push(r.user_id)
    }
    return {
      id: m.id, sender_id: m.sender_id, content: m.content,
      audio_url: m.audio_url, photo_url: m.photo_url,
      reply_to_id: m.reply_to_id, mentions: m.mentions,
      created_at: m.created_at, is_deleted: m.is_deleted,
      sender_name: nome, sender_photo: m.sender?.photo_url ?? null,
      sender_initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
      reply_to: m.reply ? { content: m.reply.content, sender_name: m.reply.sender?.full_name ?? 'Jogador' } : null,
      reactions: Object.entries(reacoesMapa).map(([emoji, user_ids]) => ({ emoji, user_ids })),
    }
  }

  async function formatarMensagem(m: any, lista: Membro[]): Promise<Mensagem> {
    // Busca sender e reply se necessário
    const { data: sender } = await supabase.from('profiles').select('full_name, photo_url').eq('id', m.sender_id).single()
    let reply = null
    if (m.reply_to_id) {
      const { data: replyMsg } = await supabase
        .from('chat_messages').select('content, sender:profiles!sender_id(full_name)').eq('id', m.reply_to_id).single()
      if (replyMsg) reply = { content: replyMsg.content, sender_name: (replyMsg.sender as any)?.full_name ?? 'Jogador' }
    }
    const nome = sender?.full_name ?? 'Jogador'
    return {
      id: m.id, sender_id: m.sender_id, content: m.content,
      audio_url: m.audio_url, photo_url: m.photo_url,
      reply_to_id: m.reply_to_id, mentions: m.mentions,
      created_at: m.created_at, is_deleted: m.is_deleted,
      sender_name: nome, sender_photo: sender?.photo_url ?? null,
      sender_initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
      reply_to: reply, reactions: [],
    }
  }

  function handleTextoChange(val: string) {
    setTexto(val)
    const match = val.match(/@(\w*)$/)
    if (match) { setShowMentions(true); setMentionQuery(match[1]) }
    else setShowMentions(false)
  }

  function inserirMencao(membro: Membro) {
    const novoTexto = texto.replace(/@\w*$/, `@${membro.nome.split(' ')[0]} `)
    setTexto(novoTexto)
    setShowMentions(false)
    inputRef.current?.focus()
  }

  async function enviar(audioUrl?: string, photoUrl?: string) {
    const conteudo = texto.trim()
    if (!conteudo && !audioUrl && !photoUrl) return
    setSending(true)

    const mencoes = membros.filter(m => conteudo.includes(`@${m.nome.split(' ')[0]}`)).map(m => m.user_id)

    await supabase.from('chat_messages').insert({
      group_id: groupId, sender_id: myUserId,
      content: conteudo || null,
      audio_url: audioUrl ?? null,
      photo_url: photoUrl ?? null,
      reply_to_id: replyTo?.id ?? null,
      mentions: mencoes.length > 0 ? mencoes : null,
    })

    // Notifica membros (só 1 notif por remetente por grupo — evita spam)
    const meuNome = membros.find(m => m.user_id === myUserId)?.nome?.split(' ')[0] ?? 'Alguém'
    const preview = audioUrl ? '🎙️ Áudio' : photoUrl ? '📷 Foto' : conteudo.slice(0, 50)
    await notificarMembros(groupId, 'chat_message',
      `💬 ${meuNome} no ${groupName}`, preview, { group_id: groupId }, myUserId)

    // Notifica mencionados separadamente
    for (const uid of mencoes) {
      await notificarUsuario(uid, groupId, 'mention',
        `📣 ${meuNome} mencionou você`, conteudo.slice(0, 60), { group_id: groupId })
    }

    setTexto('')
    setReplyTo(null)
    setSending(false)
  }

  async function reagir(messageId: string, emoji: string) {
    setEmojiTarget(null)
    const msg = mensagens.find(m => m.id === messageId)
    const reacao = msg?.reactions.find(r => r.emoji === emoji)
    const jaReagiu = reacao?.user_ids.includes(myUserId)

    if (jaReagiu) {
      await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', myUserId).eq('emoji', emoji)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: myUserId, emoji })
    }
  }

  async function apagarMensagem(id: string) {
    await supabase.from('chat_messages').update({ is_deleted: true, content: null }).eq('id', id)
    setConfirmDelete(null)
  }

  async function uploadFoto(file: File) {
    setUploadingMedia(true)
    const ext = file.name.split('.').pop()
    const path = `${myUserId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('chat-media').upload(path, file)
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
      const path = `${myUserId}/${Date.now()}.webm`
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
    setAudioChunks(chunks)
  }

  function pararGravacao() {
    audioRef.current?.stop()
    setGravando(false)
  }

  function formatHora(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatData(iso: string) {
    const d = new Date(iso)
    const hoje = new Date()
    const ontem = new Date(hoje)
    ontem.setDate(hoje.getDate() - 1)
    if (d.toDateString() === hoje.toDateString()) return 'Hoje'
    if (d.toDateString() === ontem.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  }

  // Agrupa mensagens por data
  const mensagensAgrupadas: { data: string; msgs: Mensagem[] }[] = []
  for (const m of mensagens) {
    const data = formatData(m.created_at)
    const ultimo = mensagensAgrupadas[mensagensAgrupadas.length - 1]
    if (!ultimo || ultimo.data !== data) mensagensAgrupadas.push({ data, msgs: [m] })
    else ultimo.msgs.push(m)
  }

  const membrosFiltrados = membros.filter(m => m.nome.toLowerCase().includes(mentionQuery.toLowerCase()) && m.user_id !== myUserId)

  function formatHoraSidebar(iso: string | null) {
    if (!iso) return ''
    const d = new Date(iso)
    const hoje = new Date()
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
    if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === ontem.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-5xl">💬</div>
    </div>
  )

  // Lógica mobile: mostra lista OU chat (igual ao projeto de referência)
  const mostrando = 'chat' // esta página sempre abre o chat diretamente

  return (
    <div className="h-[100dvh] bg-gray-100 flex items-stretch justify-center">
      <div className="w-full max-w-5xl flex h-full border-0 md:border md:border-gray-200 md:my-4 md:mx-4 md:rounded-xl overflow-hidden md:shadow-xl">

        {/* ===== SIDEBAR — no mobile fica oculta (usuário já veio de uma rota específica) ===== */}
        <div className="hidden md:flex md:flex-col w-72 shrink-0 border-r border-gray-200 bg-white">
          {/* Header sidebar */}
          <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', padding: '1rem' }}>
            <p style={{ color: 'white', fontWeight: 800, fontSize: '1rem', margin: '0 0 2px' }}>💬 Conversas</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', margin: 0 }}>{grupos.length} grupo{grupos.length !== 1 ? 's' : ''}</p>
          </div>
          {/* Lista de grupos */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {grupos.map(g => {
              const isActive = g.id === groupId
              return (
                <button key={g.id} onClick={() => router.push(`/grupos/${g.id}/chat`)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors ${isActive ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                  <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '9999px', background: 'linear-gradient(135deg, #16a34a, #15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>⚽</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: isActive ? 800 : 600, color: isActive ? '#16a34a' : '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{g.nome}</p>
                      <span style={{ fontSize: '0.65rem', color: isActive ? '#16a34a' : '#94a3b8', flexShrink: 0 }}>{formatHoraSidebar(g.hora)}</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.ultima_msg ?? <em style={{ color: '#cbd5e1' }}>Nenhuma mensagem</em>}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ===== ÁREA DO CHAT — ocupa toda a tela no mobile ===== */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50">

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', padding: '1rem 1.25rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', flexShrink: 0 }}>
                <ArrowLeft size={20} />
              </button>
              <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>⚽</div>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>{groupName}</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.68rem', margin: 0 }}>{membros.length} membros</p>
              </div>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-0.5"
            onClick={() => { setEmojiTarget(null); setConfirmDelete(null) }}>

            {mensagens.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <p style={{ fontSize: '3rem', margin: '0 0 0.5rem' }}>💬</p>
                <p style={{ color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Nenhuma mensagem ainda</p>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', marginTop: '0.25rem' }}>Seja o primeiro a escrever!</p>
              </div>
            )}

            {mensagensAgrupadas.map(({ data, msgs }) => (
              <div key={data}>
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-gray-300" />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', padding: '2px 10px', borderRadius: '9999px', whiteSpace: 'nowrap' }}>{data}</span>
                  <div className="flex-1 h-px bg-gray-300" />
                </div>

                {msgs.map((msg, i) => {
                  const isMine = msg.sender_id === myUserId
                  const showAvatar = !isMine && (i === 0 || msgs[i - 1]?.sender_id !== msg.sender_id)

                  return (
                    <div key={msg.id}
                      className={`flex items-end gap-2 mb-0.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                      onClick={() => { setEmojiTarget(null); setConfirmDelete(null) }}>

                      {/* Avatar */}
                      {!isMine && (
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '9999px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', opacity: showAvatar ? 1 : 0 }}>
                          {msg.sender_photo
                            ? <img src={msg.sender_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b' }}>{msg.sender_initials}</span>}
                        </div>
                      )}

                      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: '2px' }}>
                        {showAvatar && !isMine && <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', margin: '0 0 2px 4px' }}>{msg.sender_name}</p>}

                        {/* Bubble */}
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
                          <p style={{ fontSize: '0.62rem', color: '#94a3b8', margin: '3px 0 0', textAlign: 'right' }}>{formatHora(msg.created_at)}</p>
                        </div>

                        {/* Reações */}
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

                        {/* Menu ações */}
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

                        {/* Confirmar apagar */}
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

          {/* Mentions dropdown */}
          {showMentions && membrosFiltrados.length > 0 && (
            <div style={{ backgroundColor: 'white', borderTop: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {membrosFiltrados.slice(0, 5).map(m => (
                <button key={m.user_id} onClick={() => inserirMencao(m)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left">
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

          {/* Input bar */}
          <div className="bg-white border-t border-gray-100 px-3 py-2 pb-safe flex items-center gap-2 shrink-0"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            <button onClick={() => fileRef.current?.click()} disabled={uploadingMedia}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 border-none cursor-pointer">
              {uploadingMedia ? <Loader2 size={16} color="#64748b" className="animate-spin" /> : <Image size={16} color="#64748b" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadFoto(e.target.files[0]) }} />

            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 flex items-center gap-2">
              <input ref={inputRef} value={texto}
                onChange={e => handleTextoChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Digite uma mensagem..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 placeholder-gray-400" />
              <button onClick={() => handleTextoChange(texto + '@')} className="bg-transparent border-none cursor-pointer p-0">
                <AtSign size={15} color="#94a3b8" />
              </button>
            </div>

            {texto.trim() ? (
              <button onClick={() => enviar()} disabled={sending}
                style={{ width: '40px', height: '40px', borderRadius: '9999px', background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {sending ? <Loader2 size={18} color="white" className="animate-spin" /> : <Send size={18} color="white" />}
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

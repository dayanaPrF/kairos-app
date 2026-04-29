'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'

/* ── Types ── */
interface Conversation {
  id_chat: string
  id_paciente: string
  paciente_nombre: string
  paciente_avatar: string
  last_message: string
  last_message_at: string
  unread_count: number
}

interface Message {
  id_mensaje: string
  id_chat: string
  id_perfil_emisor: string
  contenido: string
  fecha_envio: string
  leido: boolean
}

/* ── Helpers ── */
function formatTime(iso: string) {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return 'Ayer'
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = []
  let currentLabel = ''
  for (const msg of messages) {
    const d = new Date(msg.fecha_envio)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    let label: string
    if (d.toDateString() === today.toDateString()) label = 'Hoy'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Ayer'
    else label = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
    if (label !== currentLabel) {
      groups.push({ label, messages: [] })
      currentLabel = label
    }
    groups[groups.length - 1].messages.push(msg)
  }
  return groups
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function FisioSectionBandeja() {
  const [myId, setMyId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyId(user.id)
    })
  }, [])

  const loadConversations = useCallback(async (userId: string) => {
    setLoading(true)
    try {
      const { data: asignaciones } = await supabase
        .from('paciente_fisioterapeuta')
        .select('id_paciente')
        .eq('id_fisioterapeuta', userId)
        .is('deleted_at', null)

      if (!asignaciones?.length) {
        setConversations([])
        return
      }

      const pacienteIds = asignaciones.map(a => a.id_paciente)

      const { data: perfiles } = await supabase
        .from('perfil')
        .select('id_perfil, nombre, primer_apellido')
        .in('id_perfil', pacienteIds)

      const perfilMap: Record<string, string> = {}
      perfiles?.forEach(p => {
        perfilMap[p.id_perfil] = `${p.nombre} ${p.primer_apellido}`
      })

      const { data: chats } = await supabase
        .from('chat')
        .select('id_chat, id_paciente, updated_at')
        .eq('id_fisioterapeuta', userId)
        .in('id_paciente', pacienteIds)
        .is('deleted_at', null)

      const convs: Conversation[] = await Promise.all(
        pacienteIds.map(async (pId) => {
          const chat = chats?.find(c => c.id_paciente === pId)
          const nombre = perfilMap[pId] ?? 'Paciente'

          if (!chat) {
            return {
              id_chat: '',
              id_paciente: pId,
              paciente_nombre: nombre,
              paciente_avatar: initials(nombre),
              last_message: 'Sin mensajes aún',
              last_message_at: new Date().toISOString(),
              unread_count: 0,
            }
          }

          const { data: lastMsgs } = await supabase
            .from('mensaje')
            .select('contenido, fecha_envio')
            .eq('id_chat', chat.id_chat)
            .is('deleted_at', null)
            .order('fecha_envio', { ascending: false })
            .limit(1)

          const { count: unread } = await supabase
            .from('mensaje')
            .select('id_mensaje', { count: 'exact', head: true })
            .eq('id_chat', chat.id_chat)
            .eq('leido', false)
            .neq('id_perfil_emisor', userId)
            .is('deleted_at', null)

          const last = lastMsgs?.[0]
          return {
            id_chat: chat.id_chat,
            id_paciente: pId,
            paciente_nombre: nombre,
            paciente_avatar: initials(nombre),
            last_message: last?.contenido ?? 'Sin mensajes aún',
            last_message_at: last?.fecha_envio ?? chat.updated_at,
            unread_count: unread ?? 0,
          }
        })
      )

      convs.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      setConversations(convs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (myId) loadConversations(myId)
  }, [myId, loadConversations])

  const loadMessages = useCallback(async (conv: Conversation, userId: string) => {
    if (!conv.id_chat) { setMessages([]); return }

    // MARCAR COMO LEÍDOS: Esto dispara el Realtime en el Dashboard
    await supabase
      .from('mensaje')
      .update({ leido: true, fecha_lectura: new Date().toISOString() })
      .eq('id_chat', conv.id_chat)
      .eq('leido', false)
      .neq('id_perfil_emisor', userId)

    const { data } = await supabase
      .from('mensaje')
      .select('*')
      .eq('id_chat', conv.id_chat)
      .is('deleted_at', null)
      .order('fecha_envio', { ascending: true })

    setMessages(data ?? [])

    setConversations(prev =>
      prev.map(c => c.id_chat === conv.id_chat ? { ...c, unread_count: 0 } : c)
    )
  }, [])

  useEffect(() => {
    if (selected && myId) loadMessages(selected, myId)
  }, [selected, myId, loadMessages])

  useEffect(() => {
    if (!selected?.id_chat || !myId) return
    realtimeRef.current?.unsubscribe()
    const channel = supabase
      .channel(`chat:${selected.id_chat}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensaje', filter: `id_chat=eq.${selected.id_chat}` },
        async (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => (prev.find(m => m.id_mensaje === newMsg.id_mensaje) ? prev : [...prev, newMsg]))
          if (newMsg.id_perfil_emisor !== myId) {
            await supabase.from('mensaje').update({ leido: true, fecha_lectura: new Date().toISOString() }).eq('id_mensaje', newMsg.id_mensaje)
          }
        }
      ).subscribe()
    realtimeRef.current = channel
    return () => { channel.unsubscribe() }
  }, [selected?.id_chat, myId])

  const handleSend = async () => {
    if (!input.trim() || !myId || !selected || sending) return
    const texto = input.trim()
    setInput('')
    setSending(true)

    try {
      let chatId = selected.id_chat
      if (!chatId) {
        const { data: newChat } = await supabase.from('chat').insert({ id_fisioterapeuta: myId, id_paciente: selected.id_paciente }).select('id_chat').single()
        chatId = newChat?.id_chat ?? ''
        setSelected(prev => prev ? { ...prev, id_chat: chatId } : prev)
      }

      const { data: newMsg } = await supabase.from('mensaje').insert({ id_chat: chatId, id_perfil_emisor: myId, contenido: texto, tipo_contenido: 'texto', leido: false, fecha_envio: new Date().toISOString() }).select('*').single()
      if (newMsg) {
        setMessages(prev => [...prev, newMsg])
        setConversations(prev => prev.map(c => c.id_chat === chatId ? { ...c, last_message: texto, last_message_at: newMsg.fecha_envio } : c))
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const filtered = conversations.filter(c => c.paciente_nombre.toLowerCase().includes(search.toLowerCase()))
  const grouped = selected ? groupByDate(messages) : []

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: 'var(--color-background-primary)', borderRadius: '16px', overflow: 'hidden', border: '0.5px solid var(--color-border-tertiary)', boxShadow: '0 2px 24px rgba(0,0,0,0.06)' }}>
      <div style={{ width: '300px', minWidth: '260px', display: 'flex', flexDirection: 'column', borderRight: '0.5px solid var(--color-border-tertiary)' }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
          <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>Mensajes con Pacientes</div>
          <input
            type="text"
            placeholder="Buscar paciente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: '20px', fontSize: '13px', outline: 'none' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(conv => {
            const isActive = selected?.id_paciente === conv.id_paciente
            return (
              <button key={conv.id_paciente} onClick={() => setSelected(conv)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 14px', border: 'none', background: isActive ? 'var(--color-background-info)' : 'transparent', borderLeft: isActive ? '3px solid #1A73E8' : '3px solid transparent', cursor: 'pointer' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: isActive ? '#1A73E8' : '#E8F4FD', color: isActive ? '#fff' : '#1A6FAA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>{conv.paciente_avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '13px', fontWeight: conv.unread_count > 0 ? 600 : 400, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.paciente_nombre}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{formatTime(conv.last_message_at)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.last_message}</span>
                    {conv.unread_count > 0 && <span style={{ background: '#1A73E8', color: '#fff', borderRadius: '12px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>{conv.unread_count}</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {!selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
           <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-secondary)" strokeWidth="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
           <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Selecciona un paciente para chatear</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '13px 18px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#E8F4FD', color: '#1A6FAA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{selected.paciente_avatar}</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{selected.paciente_nombre}</div>
              <div style={{ fontSize: '11px', color: '#1A6FAA' }}>Paciente</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', background: 'var(--color-background-secondary)' }}>
            {grouped.map(group => (
              <div key={group.label}>
                <div style={{ textAlign: 'center', margin: '14px 0', fontSize: '10px', color: 'var(--color-text-secondary)' }}>{group.label}</div>
                {group.messages.map((msg) => {
                  const isMe = msg.id_perfil_emisor === myId
                  return (
                    <div key={msg.id_mensaje} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
                      <div style={{ padding: '8px 12px', borderRadius: '14px', background: isMe ? '#1A73E8' : '#fff', color: isMe ? '#fff' : '#333', fontSize: '13px', maxWidth: '70%', border: isMe ? 'none' : '0.5px solid #ddd' }}>
                        {msg.contenido}
                        <div style={{ fontSize: '9px', textAlign: 'right', marginTop: '4px', opacity: 0.8 }}>{formatMessageTime(msg.fecha_envio)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: '12px', borderTop: '0.5px solid #ddd', display: 'flex', gap: '8px' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Escribe un mensaje..."
              style={{ flex: 1, borderRadius: '20px', padding: '10px 15px', border: '1px solid #ddd', resize: 'none', height: '40px', outline: 'none' }}
            />
            <button onClick={handleSend} style={{ background: '#1A73E8', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer' }}>
              {sending ? '...' : '➤'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
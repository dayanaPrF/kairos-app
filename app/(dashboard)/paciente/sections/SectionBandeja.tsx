'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'

/* ── Types ── */
interface Conversation {
  id_chat: string
  id_fisioterapeuta: string
  fisio_nombre: string
  fisio_avatar: string
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

/* ── Component ── */
export function SectionBandeja() {
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

  /* ── 1. Usuario actual ── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyId(user.id)
    })
  }, [])

  /* ── 2. Cargar fisioterapeutas asignados + sus chats ── */
  const loadConversations = useCallback(async (userId: string) => {
    setLoading(true)
    try {
      // Fisioterapeutas asignados (sin deleted_at)
      const { data: asignaciones } = await supabase
        .from('paciente_fisioterapeuta')
        .select('id_fisioterapeuta')
        .eq('id_paciente', userId)
        .is('deleted_at', null)

      if (!asignaciones?.length) {
        setConversations([])
        return
      }

      const fisioIds = asignaciones.map(a => a.id_fisioterapeuta)

      // Perfiles de los fisios
      const { data: perfiles } = await supabase
        .from('perfil')
        .select('id_perfil, nombre, primer_apellido')
        .in('id_perfil', fisioIds)

      const perfilMap: Record<string, string> = {}
      perfiles?.forEach(p => {
        perfilMap[p.id_perfil] = `${p.nombre} ${p.primer_apellido}`
      })

      // Chats existentes
      const { data: chats } = await supabase
        .from('chat')
        .select('id_chat, id_fisioterapeuta, updated_at')
        .eq('id_paciente', userId)
        .in('id_fisioterapeuta', fisioIds)
        .is('deleted_at', null)

      // Construir una conversación por fisio asignado
      const convs: Conversation[] = await Promise.all(
        fisioIds.map(async (fisioId) => {
          const chat = chats?.find(c => c.id_fisioterapeuta === fisioId)
          const nombre = perfilMap[fisioId] ?? 'Fisioterapeuta'

          if (!chat) {
            return {
              id_chat: '',
              id_fisioterapeuta: fisioId,
              fisio_nombre: nombre,
              fisio_avatar: initials(nombre),
              last_message: 'Sin mensajes aún',
              last_message_at: new Date().toISOString(),
              unread_count: 0,
            }
          }

          // Último mensaje
          const { data: lastMsgs } = await supabase
            .from('mensaje')
            .select('contenido, fecha_envio')
            .eq('id_chat', chat.id_chat)
            .is('deleted_at', null)
            .order('fecha_envio', { ascending: false })
            .limit(1)

          // Conteo de no leídos (del fisio hacia el paciente)
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
            id_fisioterapeuta: fisioId,
            fisio_nombre: nombre,
            fisio_avatar: initials(nombre),
            last_message: last?.contenido ?? 'Sin mensajes aún',
            last_message_at: last?.fecha_envio ?? chat.updated_at,
            unread_count: unread ?? 0,
          }
        })
      )

      convs.sort((a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      )
      setConversations(convs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (myId) loadConversations(myId)
  }, [myId, loadConversations])

  /* ── 3. Cargar mensajes de la conversación seleccionada ── */
  const loadMessages = useCallback(async (conv: Conversation, userId: string) => {
    if (!conv.id_chat) { setMessages([]); return }

    const { data } = await supabase
      .from('mensaje')
      .select('id_mensaje, id_chat, id_perfil_emisor, contenido, fecha_envio, leido')
      .eq('id_chat', conv.id_chat)
      .is('deleted_at', null)
      .order('fecha_envio', { ascending: true })

    setMessages(data ?? [])

    // Marcar como leídos los del fisio
    await supabase
      .from('mensaje')
      .update({ leido: true, fecha_lectura: new Date().toISOString() })
      .eq('id_chat', conv.id_chat)
      .eq('leido', false)
      .neq('id_perfil_emisor', userId)

    setConversations(prev =>
      prev.map(c => c.id_chat === conv.id_chat ? { ...c, unread_count: 0 } : c)
    )
  }, [])

  useEffect(() => {
    if (selected && myId) loadMessages(selected, myId)
  }, [selected, myId, loadMessages])

  /* ── 4. Realtime: nuevos mensajes en el chat abierto ── */
  useEffect(() => {
    if (!selected?.id_chat || !myId) return

    realtimeRef.current?.unsubscribe()

    const channel = supabase
      .channel(`chat:${selected.id_chat}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensaje',
          filter: `id_chat=eq.${selected.id_chat}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => {
            if (prev.find(m => m.id_mensaje === newMsg.id_mensaje)) return prev
            return [...prev, newMsg]
          })
          // Marcar automáticamente si es del fisio
          if (newMsg.id_perfil_emisor !== myId) {
            await supabase
              .from('mensaje')
              .update({ leido: true, fecha_lectura: new Date().toISOString() })
              .eq('id_mensaje', newMsg.id_mensaje)
          }
        }
      )
      .subscribe()

    realtimeRef.current = channel
    return () => { channel.unsubscribe() }
  }, [selected?.id_chat, myId])

  /* ── 5. Enviar mensaje ── */
  const handleSend = async () => {
    if (!input.trim() || !myId || !selected || sending) return
    const texto = input.trim()
    setInput('')
    setSending(true)

    try {
      let chatId = selected.id_chat

      // Crear chat si no existe todavía
      if (!chatId) {
        const { data: newChat } = await supabase
          .from('chat')
          .insert({ id_paciente: myId, id_fisioterapeuta: selected.id_fisioterapeuta })
          .select('id_chat')
          .single()

        if (newChat) {
          chatId = newChat.id_chat
        } else {
          // Ya existía (UNIQUE constraint), obtenerlo
          const { data: existing } = await supabase
            .from('chat')
            .select('id_chat')
            .eq('id_paciente', myId)
            .eq('id_fisioterapeuta', selected.id_fisioterapeuta)
            .single()
          chatId = existing?.id_chat ?? ''
        }

        if (!chatId) { setSending(false); return }

        setSelected(prev => prev ? { ...prev, id_chat: chatId } : prev)
        setConversations(prev =>
          prev.map(c =>
            c.id_fisioterapeuta === selected.id_fisioterapeuta
              ? { ...c, id_chat: chatId }
              : c
          )
        )
      }

      // Insertar el mensaje
      const { data: newMsg } = await supabase
        .from('mensaje')
        .insert({
          id_chat: chatId,
          id_perfil_emisor: myId,
          contenido: texto,
          tipo_contenido: 'texto',
          leido: false,
          fecha_envio: new Date().toISOString(),
        })
        .select('id_mensaje, id_chat, id_perfil_emisor, contenido, fecha_envio, leido')
        .single()

      if (newMsg) {
        setMessages(prev =>
          prev.find(m => m.id_mensaje === newMsg.id_mensaje) ? prev : [...prev, newMsg]
        )
        setConversations(prev =>
          prev.map(c =>
            c.id_chat === chatId
              ? { ...c, last_message: texto, last_message_at: newMsg.fecha_envio }
              : c
          )
        )
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const filtered = conversations.filter(c =>
    c.fisio_nombre.toLowerCase().includes(search.toLowerCase())
  )
  const grouped = selected ? groupByDate(messages) : []

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: 'var(--color-background-primary)', borderRadius: '16px', overflow: 'hidden', border: '0.5px solid var(--color-border-tertiary)', boxShadow: '0 2px 24px rgba(0,0,0,0.06)' }}>

      {/* ── Lista de conversaciones ── */}
      <div style={{ width: '300px', minWidth: '260px', display: 'flex', flexDirection: 'column', borderRight: '0.5px solid var(--color-border-tertiary)' }}>

        <div style={{ padding: '20px 16px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
          <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>Mensajes</div>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 30px', background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: '20px', fontSize: '13px', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              Cargando conversaciones...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
              No tienes fisioterapeutas asignados aún.
            </div>
          )}
          {!loading && filtered.map(conv => {
            const isActive = selected?.id_fisioterapeuta === conv.id_fisioterapeuta
            return (
              <button
                key={conv.id_fisioterapeuta}
                onClick={() => setSelected(conv)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '11px',
                  padding: '11px 14px', border: 'none', textAlign: 'left', cursor: 'pointer',
                  background: isActive ? 'var(--color-background-info)' : 'transparent',
                  borderLeft: isActive ? '3px solid #1A73E8' : '3px solid transparent',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--color-background-secondary)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                  background: isActive ? '#1A73E8' : '#E8F4FD',
                  color: isActive ? '#fff' : '#1A6FAA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 600,
                }}>
                  {conv.fisio_avatar}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                    <span style={{ fontSize: '13px', fontWeight: conv.unread_count > 0 ? 600 : 400, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                      {conv.fisio_nombre}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', flexShrink: 0, marginLeft: '4px' }}>
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                      {conv.last_message}
                    </span>
                    {conv.unread_count > 0 && (
                      <span style={{ background: '#1A73E8', color: '#fff', borderRadius: '12px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, flexShrink: 0, marginLeft: '6px' }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Panel de chat ── */}
      {!selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-secondary)" strokeWidth="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '5px' }}>Tus mensajes</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Selecciona a tu fisioterapeuta para comenzar</div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Header */}
          <div style={{ padding: '13px 18px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', gap: '11px', background: 'var(--color-background-primary)' }}>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '6px', flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#E8F4FD', color: '#1A6FAA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
              {selected.fisio_avatar}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{selected.fisio_nombre}</div>
              <span style={{ background: '#E8F4FD', color: '#1A6FAA', borderRadius: '6px', padding: '1px 7px', fontSize: '11px', fontWeight: 500 }}>
                Fisioterapeuta
              </span>
            </div>
          </div>

          {/* Mensajes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '2px', background: 'var(--color-background-secondary)' }}>
            {!selected.id_chat && messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                <div style={{ marginBottom: '8px', fontSize: '28px' }}>👋</div>
                <div>Inicia la conversación con tu fisioterapeuta</div>
              </div>
            )}

            {grouped.map(group => (
              <div key={group.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0 10px' }}>
                  <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontWeight: 500, textTransform: 'capitalize', background: 'var(--color-background-secondary)', padding: '2px 8px', borderRadius: '10px', border: '0.5px solid var(--color-border-tertiary)' }}>
                    {group.label}
                  </span>
                  <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
                </div>

                {group.messages.map((msg, idx) => {
                  const isMe = msg.id_perfil_emisor === myId
                  const prev = group.messages[idx - 1]
                  const next = group.messages[idx + 1]
                  const sameAsPrev = prev?.id_perfil_emisor === msg.id_perfil_emisor
                  const sameAsNext = next?.id_perfil_emisor === msg.id_perfil_emisor

                  // Lógica de bordes estilo Messenger
                  let borderRadius: string
                  if (isMe) {
                    if (sameAsPrev && sameAsNext) borderRadius = '18px 4px 4px 18px'
                    else if (sameAsPrev) borderRadius = '18px 4px 18px 18px'
                    else if (sameAsNext) borderRadius = '18px 18px 4px 18px'
                    else borderRadius = '18px 4px 18px 18px'
                  } else {
                    if (sameAsPrev && sameAsNext) borderRadius = '4px 18px 18px 4px'
                    else if (sameAsPrev) borderRadius = '4px 18px 18px 18px'
                    else if (sameAsNext) borderRadius = '18px 18px 18px 4px'
                    else borderRadius = '4px 18px 18px 18px'
                  }

                  return (
                    <div
                      key={msg.id_mensaje}
                      style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '7px', marginTop: sameAsPrev ? '2px' : '9px' }}
                    >
                      {/* Avatar fisio */}
                      {!isMe && (
                        <div style={{ width: '26px', flexShrink: 0 }}>
                          {!sameAsNext && (
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#E8F4FD', color: '#1A6FAA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>
                              {selected.fisio_avatar}
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ maxWidth: '66%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          padding: '8px 12px',
                          borderRadius,
                          background: isMe ? '#1A73E8' : 'var(--color-background-primary)',
                          color: isMe ? '#fff' : 'var(--color-text-primary)',
                          fontSize: '13px', lineHeight: '1.45', wordBreak: 'break-word',
                          border: isMe ? 'none' : '0.5px solid var(--color-border-tertiary)',
                        }}>
                          {msg.contenido}
                        </div>

                        {!sameAsNext && (
                          <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '3px', padding: '0 3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            {formatMessageTime(msg.fecha_envio)}
                            {isMe && (
                              msg.leido
                                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /><path d="M20 12L9 23l-5-5" /></svg>
                                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 14px', borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'flex-end', gap: '8px', background: 'var(--color-background-primary)' }}>
            <button style={{ width: '34px', height: '34px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
            </button>

            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje..."
                rows={1}
                disabled={sending}
                style={{
                  width: '100%', resize: 'none',
                  border: '0.5px solid var(--color-border-secondary)',
                  borderRadius: '20px', padding: '9px 38px 9px 14px',
                  fontSize: '13px', lineHeight: '1.4', fontFamily: 'inherit',
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)',
                  outline: 'none', boxSizing: 'border-box',
                  maxHeight: '110px', overflowY: 'auto',
                  opacity: sending ? 0.6 : 1,
                }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 110) + 'px'
                }}
              />
              <button style={{ position: 'absolute', right: '10px', bottom: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 13s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
              </button>
            </div>

            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{
                width: '36px', height: '36px', borderRadius: '50%', border: 'none',
                background: input.trim() && !sending ? '#1A73E8' : 'var(--color-background-secondary)',
                color: input.trim() && !sending ? '#fff' : 'var(--color-text-secondary)',
                cursor: input.trim() && !sending ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s, color 0.15s',
              }}
            >
              {sending
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              }
            </button>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}

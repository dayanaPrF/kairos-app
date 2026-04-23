'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'

type Notificacion = {
  id_notificacion: string
  titulo: string
  mensaje: string
  tipo: string
  fecha_envio: string
  estado: string
  id_perfil: string
  created_at: string
}

function formatFechaRelativa(fechaStr: string): string {
  const fecha = new Date(fechaStr)
  const ahora = new Date()
  const diffMs = ahora.getTime() - fecha.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffMin < 1) return 'Justo ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffH < 24) return `Hace ${diffH} h`
  if (diffD === 1) return 'Ayer'
  if (diffD < 7) return `Hace ${diffD} días`
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function getTipoIcon(tipo: string): string {
  switch (tipo?.toLowerCase()) {
    case 'cita':         return '📅'
    case 'recordatorio': return '🔔'
    case 'ejercicio':
    case 'tarea':        return '💪'
    case 'resultado':    return '📊'
    case 'mensaje':      return '💬'
    case 'alerta':       return '⚠️'
    case 'sistema':      return '⚙️'
    default:             return '📌'
  }
}

function getTipoColor(tipo: string): string {
  switch (tipo?.toLowerCase()) {
    case 'cita':         return '#2874A6'
    case 'recordatorio': return '#E67E22'
    case 'ejercicio':
    case 'tarea':        return '#27AE60'
    case 'resultado':    return '#8E44AD'
    case 'mensaje':      return '#2980B9'
    case 'alerta':       return '#C0392B'
    default:             return '#5499C7'
  }
}

// Estado en BD puede ser "Pendiente" (mayúscula) u otros valores
const esLeida = (estado: string) => estado?.toLowerCase() === 'leida'

export function SectionNotificaciones({ onLeidas }: { onLeidas?: () => void }) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtrando, setFiltrando] = useState<'todas' | 'no_leidas' | 'leidas'>('todas')

  useEffect(() => {
    const fetchNotificaciones = async () => {
      setLoading(true)
      try {
        // id_perfil == auth.uid() — mismo UUID, sin join necesario
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('notificacion')
          .select('*')
          .eq('id_perfil', user.id)
          .is('deleted_at', null)
          .order('fecha_envio', { ascending: false })

        console.log('[Notif] data:', data, 'error:', error?.message)
        if (data) setNotificaciones(data)
      } catch (err) {
        console.error('[Notif] Error inesperado:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchNotificaciones()
  }, [])

  const marcarLeida = async (id: string) => {
    await supabase
      .from('notificacion')
      .update({ estado: 'leida', updated_at: new Date().toISOString() })
      .eq('id_notificacion', id)

    setNotificaciones(prev =>
      prev.map(n => n.id_notificacion === id ? { ...n, estado: 'leida' } : n)
    )
    onLeidas?.()
  }

  const marcarTodasLeidas = async () => {
    const ids = notificaciones
      .filter(n => !esLeida(n.estado))
      .map(n => n.id_notificacion)

    if (ids.length === 0) return

    await supabase
      .from('notificacion')
      .update({ estado: 'leida', updated_at: new Date().toISOString() })
      .in('id_notificacion', ids)

    setNotificaciones(prev => prev.map(n => ({ ...n, estado: 'leida' })))
    onLeidas?.()
  }

  const filtradas = notificaciones.filter(n => {
    if (filtrando === 'no_leidas') return !esLeida(n.estado)
    if (filtrando === 'leidas')    return esLeida(n.estado)
    return true
  })

  const noLeidas = notificaciones.filter(n => !esLeida(n.estado)).length

  if (loading) return <div style={{ padding: '40px', color: '#888' }}>Cargando notificaciones…</div>

  return (
    <>
      <div className="dash-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="dash-page-title">Notificaciones</div>
          {noLeidas > 0 && (
            <span style={{
              background: '#E74C3C', color: '#fff', borderRadius: '20px',
              padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700,
            }}>
              {noLeidas} nuevas
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="dash-page-sub">Centro de avisos y recordatorios</div>
          {noLeidas > 0 && (
            <button
              onClick={marcarTodasLeidas}
              style={{
                background: 'none', border: '1px solid #2874A6', color: '#2874A6',
                borderRadius: '8px', padding: '5px 12px', fontSize: '0.78rem',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              Marcar todas como leídas
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['todas', 'no_leidas', 'leidas'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltrando(f)}
            style={{
              padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem',
              fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filtrando === f ? '#2874A6' : '#EBF5FB',
              color: filtrando === f ? '#fff' : '#5499C7',
              transition: 'all 0.15s',
            }}
          >
            {f === 'todas' ? 'Todas' : f === 'no_leidas' ? 'No leídas' : 'Leídas'}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#aaa', fontSize: '0.9rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔔</div>
          <div>No hay notificaciones aquí aún.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtradas.map(n => {
            const leida = esLeida(n.estado)
            const color = getTipoColor(n.tipo)

            return (
              <div
                key={n.id_notificacion}
                style={{
                  background: leida ? '#fafafa' : '#fff',
                  border: leida ? '1px solid #eee' : `1px solid ${color}30`,
                  borderLeft: leida ? '3px solid #ddd' : `4px solid ${color}`,
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                  boxShadow: leida ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s',
                  cursor: leida ? 'default' : 'pointer',
                  opacity: leida ? 0.75 : 1,
                }}
                onClick={() => !leida && marcarLeida(n.id_notificacion)}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                  background: `${color}15`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '1.2rem',
                }}>
                  {getTipoIcon(n.tipo)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      fontWeight: leida ? 500 : 700, fontSize: '0.92rem',
                      color: leida ? '#666' : '#1a3c5e', lineHeight: 1.3,
                    }}>
                      {n.titulo}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {!leida && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                      )}
                      <span style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap' }}>
                        {formatFechaRelativa(n.fecha_envio)}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '4px', fontSize: '0.84rem', color: leida ? '#aaa' : '#555', lineHeight: 1.5 }}>
                    {n.mensaje}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color, background: `${color}12`,
                      padding: '2px 8px', borderRadius: '6px',
                    }}>
                      {n.tipo}
                    </span>
                    {!leida && (
                      <span style={{ fontSize: '0.75rem', color: '#5499C7' }}>· Toca para marcar como leída</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

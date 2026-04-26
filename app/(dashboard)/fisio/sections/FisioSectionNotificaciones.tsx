'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatFechaRelativa(fechaStr: string): string {
  const fecha = new Date(fechaStr)
  const ahora = new Date()
  const diffMs  = ahora.getTime() - fecha.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH   = Math.floor(diffMin / 60)
  const diffD   = Math.floor(diffH / 24)

  if (diffMin < 1) return 'Justo ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffH < 24)  return `Hace ${diffH} h`
  if (diffD === 1) return 'Ayer'
  if (diffD < 7)   return `Hace ${diffD} días`
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

// Tipos de notificación relevantes para el fisioterapeuta
function getTipoIcon(tipo: string): string {
  switch (tipo?.toLowerCase()) {
    case 'cita':           return '📅'
    case 'paciente':       return '🧑‍🦽'
    case 'inactividad':    return '⏰'
    case 'sesion':         return '🏋️'
    case 'recordatorio':   return '🔔'
    case 'resultado':      return '📊'
    case 'mensaje':        return '💬'
    case 'alerta':         return '⚠️'
    case 'sistema':        return '⚙️'
    case 'reporte':        return '📋'
    default:               return '📌'
  }
}

function getTipoColor(tipo: string): string {
  switch (tipo?.toLowerCase()) {
    case 'cita':           return '#2874A6'
    case 'paciente':       return '#8E44AD'
    case 'inactividad':    return '#E67E22'
    case 'sesion':         return '#27AE60'
    case 'recordatorio':   return '#F39C12'
    case 'resultado':      return '#16A085'
    case 'mensaje':        return '#2980B9'
    case 'alerta':         return '#C0392B'
    case 'reporte':        return '#6C3483'
    case 'sistema':        return '#7F8C8D'
    default:               return '#5499C7'
  }
}

function getTipoLabel(tipo: string): string {
  switch (tipo?.toLowerCase()) {
    case 'cita':         return 'Cita'
    case 'paciente':     return 'Paciente'
    case 'inactividad':  return 'Inactividad'
    case 'sesion':       return 'Sesión'
    case 'recordatorio': return 'Recordatorio'
    case 'resultado':    return 'Resultado'
    case 'mensaje':      return 'Mensaje'
    case 'alerta':       return 'Alerta'
    case 'reporte':      return 'Reporte'
    case 'sistema':      return 'Sistema'
    default:             return tipo ?? 'General'
  }
}

const esLeida = (estado: string) => estado?.toLowerCase() === 'leida'

// Filtros relevantes para el fisio (distintos a los del paciente)
type Filtro = 'todas' | 'no_leidas' | 'citas' | 'pacientes' | 'alertas' | 'leidas'

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todas',      label: 'Todas'      },
  { key: 'no_leidas',  label: 'No leídas'  },
  { key: 'citas',      label: 'Citas'      },
  { key: 'pacientes',  label: 'Pacientes'  },
  { key: 'alertas',    label: 'Alertas'    },
  { key: 'leidas',     label: 'Leídas'     },
]

// ── Componente ─────────────────────────────────────────────────────────────────
export function FisioSectionNotificaciones({ onLeidas }: { onLeidas?: () => void }) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtrando, setFiltrando] = useState<Filtro>('todas')

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        // id_perfil == auth.uid() — mismo UUID que id_fisioterapeuta
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('notificacion')
          .select('*')
          .eq('id_perfil', user.id)
          .is('deleted_at', null)
          .order('fecha_envio', { ascending: false })

        console.log('[FisioNotif] data:', data, 'error:', error?.message)
        if (data) setNotificaciones(data)
      } catch (err) {
        console.error('[FisioNotif] Error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
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
    if (!ids.length) return

    await supabase
      .from('notificacion')
      .update({ estado: 'leida', updated_at: new Date().toISOString() })
      .in('id_notificacion', ids)

    setNotificaciones(prev => prev.map(n => ({ ...n, estado: 'leida' })))
    onLeidas?.()
  }

  const filtradas = notificaciones.filter(n => {
    switch (filtrando) {
      case 'no_leidas': return !esLeida(n.estado)
      case 'leidas':    return esLeida(n.estado)
      case 'citas':     return n.tipo?.toLowerCase() === 'cita'
      case 'pacientes': return ['paciente', 'inactividad', 'sesion'].includes(n.tipo?.toLowerCase())
      case 'alertas':   return ['alerta', 'resultado', 'reporte'].includes(n.tipo?.toLowerCase())
      default:          return true
    }
  })

  const noLeidas = notificaciones.filter(n => !esLeida(n.estado)).length

  // Resumen por tipo para el header
  const contPorTipo = {
    citas:     notificaciones.filter(n => n.tipo?.toLowerCase() === 'cita' && !esLeida(n.estado)).length,
    pacientes: notificaciones.filter(n => ['paciente','inactividad','sesion'].includes(n.tipo?.toLowerCase()) && !esLeida(n.estado)).length,
    alertas:   notificaciones.filter(n => ['alerta','resultado','reporte'].includes(n.tipo?.toLowerCase()) && !esLeida(n.estado)).length,
  }

  if (loading) return (
    <div style={{ padding: '40px', color: 'var(--text-light)', textAlign: 'center' }}>
      Cargando notificaciones…
    </div>
  )

  return (
    <>
      {/* ── Header ── */}
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
          <div className="dash-page-sub">Centro de avisos clínicos y operativos</div>
          {noLeidas > 0 && (
            <button
              onClick={marcarTodasLeidas}
              style={{
                background: 'none', border: '1px solid var(--blue)', color: 'var(--blue)',
                borderRadius: '8px', padding: '5px 14px', fontSize: '0.78rem',
                cursor: 'pointer', fontWeight: 700,
              }}
            >
              Marcar todas como leídas
            </button>
          )}
        </div>
      </div>

      {/* ── Resumen rápido ── */}
      {noLeidas > 0 && (
        <div style={{
          display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap',
        }}>
          {[
            { label: 'Citas pendientes',     count: contPorTipo.citas,     color: '#2874A6', icon: '📅' },
            { label: 'Alertas de pacientes', count: contPorTipo.pacientes,  color: '#E67E22', icon: '🧑‍🦽' },
            { label: 'Alertas clínicas',     count: contPorTipo.alertas,   color: '#C0392B', icon: '⚠️' },
          ].filter(r => r.count > 0).map(r => (
            <div key={r.label} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: `${r.color}10`, border: `1px solid ${r.color}30`,
              borderRadius: '12px', padding: '10px 16px',
            }}>
              <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: r.color, lineHeight: 1 }}>
                  {r.count}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '2px' }}>
                  {r.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltrando(f.key)}
            style={{
              padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem',
              fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filtrando === f.key ? 'var(--blue)' : 'var(--blue-xlight, #EBF5FB)',
              color: filtrando === f.key ? '#fff' : 'var(--blue)',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
            {/* badge en filtro si hay no leídas de ese tipo */}
            {f.key === 'citas' && contPorTipo.citas > 0 && (
              <span style={{
                marginLeft: '6px', background: '#2874A6', color: '#fff',
                borderRadius: '10px', padding: '0 5px', fontSize: '0.68rem',
              }}>
                {contPorTipo.citas}
              </span>
            )}
            {f.key === 'pacientes' && contPorTipo.pacientes > 0 && (
              <span style={{
                marginLeft: '6px', background: '#E67E22', color: '#fff',
                borderRadius: '10px', padding: '0 5px', fontSize: '0.68rem',
              }}>
                {contPorTipo.pacientes}
              </span>
            )}
            {f.key === 'alertas' && contPorTipo.alertas > 0 && (
              <span style={{
                marginLeft: '6px', background: '#C0392B', color: '#fff',
                borderRadius: '10px', padding: '0 5px', fontSize: '0.68rem',
              }}>
                {contPorTipo.alertas}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Lista ── */}
      {filtradas.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          color: 'var(--text-light)', fontSize: '0.9rem',
        }}>
          <div style={{ fontSize: '2.8rem', marginBottom: '12px' }}>🔔</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Sin notificaciones aquí</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            {filtrando === 'todas' ? 'Estás al día con todo.' : 'Prueba cambiando el filtro.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtradas.map(n => {
            const leida = esLeida(n.estado)
            const color = getTipoColor(n.tipo)

            return (
              <div
                key={n.id_notificacion}
                onClick={() => !leida && marcarLeida(n.id_notificacion)}
                style={{
                  background: leida ? 'var(--bg, #fafafa)' : '#fff',
                  border: leida ? '1px solid var(--border, #eee)' : `1px solid ${color}25`,
                  borderLeft: leida ? '3px solid var(--border, #ddd)' : `4px solid ${color}`,
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                  boxShadow: leida ? 'none' : '0 2px 10px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s',
                  cursor: leida ? 'default' : 'pointer',
                  opacity: leida ? 0.72 : 1,
                }}
              >
                {/* Ícono */}
                <div style={{
                  width: '42px', height: '42px', borderRadius: '11px', flexShrink: 0,
                  background: `${color}15`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
                }}>
                  {getTipoIcon(n.tipo)}
                </div>

                {/* Contenido */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: '12px',
                  }}>
                    <div style={{
                      fontWeight: leida ? 500 : 700, fontSize: '0.92rem',
                      color: leida ? 'var(--text-mid, #666)' : 'var(--text, #1a3c5e)',
                      lineHeight: 1.3,
                    }}>
                      {n.titulo}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {!leida && (
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%', background: color,
                        }} />
                      )}
                      <span style={{ fontSize: '0.73rem', color: 'var(--text-light, #aaa)', whiteSpace: 'nowrap' }}>
                        {formatFechaRelativa(n.fecha_envio)}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    marginTop: '5px', fontSize: '0.84rem',
                    color: leida ? 'var(--text-light, #aaa)' : 'var(--text-mid, #555)',
                    lineHeight: 1.55,
                  }}>
                    {n.mensaje}
                  </div>

                  {/* Footer: tipo + acción */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', marginTop: '10px',
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color, background: `${color}12`,
                      padding: '3px 9px', borderRadius: '6px',
                    }}>
                      {getTipoLabel(n.tipo)}
                    </span>

                    {!leida && (
                      <button
                        onClick={e => { e.stopPropagation(); marcarLeida(n.id_notificacion) }}
                        style={{
                          background: 'none', border: `1px solid ${color}40`,
                          color, borderRadius: '6px', padding: '3px 10px',
                          fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Marcar como leída
                      </button>
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

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'

type Cita = {
  id_cita: string
  fecha_cita: string
  hora_inicio: string
  hora_fin: string
  motivo_cita: string
  estado_cita: string
  notas_cita: string | null
  id_fisioterapeuta: string | null
  id_clinica: string | null
  fisioterapeutaNombre?: string | null
  clinicaNombre?: string | null
}

function formatFecha(fechaStr: string): string {
  const fecha = new Date(fechaStr + 'T00:00:00')
  return fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatHora(horaStr: string): string {
  const [h, m] = horaStr.split(':')
  return `${h}:${m}`
}

function getBadge(estado: string): { label: string; cls: string } {
  switch (estado?.toLowerCase()) {
    case 'programada':
    case 'agendada':
    case 'pendiente':
      return { label: 'Agendada', cls: 'agendada' }
    case 'confirmada':
      return { label: 'Próxima', cls: 'prox' }
    case 'completada':
    case 'realizada':
      return { label: 'Completada', cls: 'pasada' }
    case 'cancelada':
      return { label: 'Cancelada', cls: 'cancelada' }
    default:
      return { label: estado ?? 'Pendiente', cls: 'agendada' }
  }
}

function isPasada(fechaStr: string): boolean {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return new Date(fechaStr + 'T00:00:00') < hoy
}

export function SectionCitas() {
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [citaSeleccionada, setCitaSeleccionada] = useState<Cita | null>(null)

  useEffect(() => {
    const fetchCitas = async () => {
      setLoading(true)
      setError(null)
      try {
        // PASO 1: usuario autenticado
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) { setError('No hay sesión activa.'); return }
        console.log('[Citas] user.id:', user.id)

        // PASO 2: id_perfil == id_paciente (mismo UUID, relación 1:1 por convención)
        await cargarCitas(user.id)
      } catch (err: any) {
        console.error('[Citas] Error inesperado:', err)
        setError(err?.message ?? 'Error inesperado')
      } finally {
        setLoading(false)
      }
    }

    const cargarCitas = async (idPaciente: string) => {
      console.log('[Citas] Cargando citas para idPaciente:', idPaciente)

      const { data: citasRaw, error: citasErr } = await supabase
        .from('cita')
        .select('*')
        .eq('id_paciente', idPaciente)
        .is('deleted_at', null)
        .order('fecha_cita', { ascending: true })

      console.log('[Citas] citasRaw:', JSON.stringify(citasRaw))
      console.log('[Citas] citasErr:', citasErr?.message)

      if (citasErr) { setError(`Error al cargar citas: ${citasErr.message}`); return }
      if (!citasRaw || citasRaw.length === 0) { setCitas([]); return }

      // Enriquecer con fisioterapeuta y clínica en queries separados
      const citasEnriquecidas: Cita[] = await Promise.all(
        citasRaw.map(async (c: any) => {
          let fisioterapeutaNombre: string | null = null
          let clinicaNombre: string | null = null

          if (c.id_fisioterapeuta) {
            const { data: fData } = await supabase
              .from('fisioterapeuta')
              .select('cedula_profesional, especialidad')
              .eq('id_fisioterapeuta', c.id_fisioterapeuta)
              .single()
            console.log('[Citas] fisioterapeuta data:', fData)
            // En tu tabla de prueba, cedula_profesional = "Dr. Alejandro García"
            fisioterapeutaNombre = fData?.cedula_profesional ?? null
          }

          if (c.id_clinica) {
            const { data: clData } = await supabase
              .from('clinica')
              .select('nombre_clinica')
              .eq('id_clinica', c.id_clinica)
              .single()
            clinicaNombre = clData?.nombre_clinica ?? null
          }

          return { ...c, fisioterapeutaNombre, clinicaNombre }
        })
      )

      setCitas(citasEnriquecidas)
      setLoading(false)
    }

    fetchCitas()
  }, [])

  const proximas = citas.filter(
    c => !isPasada(c.fecha_cita) && c.estado_cita?.toLowerCase() !== 'cancelada'
  )
  const historial = citas.filter(
    c => isPasada(c.fecha_cita) || c.estado_cita?.toLowerCase() === 'cancelada'
  )

  if (loading) return <div style={{ padding: '40px', color: '#888' }}>Cargando citas…</div>

  if (error) return (
    <div style={{ padding: '32px', color: '#c0392b', background: '#fdf2f2', borderRadius: '12px', margin: '20px 0' }}>
      <strong>⚠️ {error}</strong>
      <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#888' }}>
        Revisa la consola del navegador (F12) para ver los logs detallados.
      </div>
    </div>
  )

  return (
    <>
      {/* ── Modal detalles ── */}
      {citaSeleccionada && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setCitaSeleccionada(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '16px', padding: '32px',
              maxWidth: '480px', width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a3c5e' }}>Detalles de la cita</div>
              <span className={`dash-badge ${getBadge(citaSeleccionada.estado_cita).cls}`}>
                {getBadge(citaSeleccionada.estado_cita).label}
              </span>
            </div>
            <div style={{ display: 'grid', gap: '12px', fontSize: '0.88rem', color: '#444' }}>
              <div><span style={{ color: '#888', marginRight: 8 }}>📅</span><strong>{formatFecha(citaSeleccionada.fecha_cita)}</strong></div>
              <div>
                <span style={{ color: '#888', marginRight: 8 }}>🕐</span>
                <strong>{formatHora(citaSeleccionada.hora_inicio)} – {formatHora(citaSeleccionada.hora_fin)} HRS</strong>
              </div>
              <div><span style={{ color: '#888', marginRight: 8 }}>📋</span>{citaSeleccionada.motivo_cita}</div>
              {citaSeleccionada.fisioterapeutaNombre && (
                <div><span style={{ color: '#888', marginRight: 8 }}>👨‍⚕️</span>{citaSeleccionada.fisioterapeutaNombre}</div>
              )}
              {citaSeleccionada.clinicaNombre && (
                <div><span style={{ color: '#888', marginRight: 8 }}>📍</span>{citaSeleccionada.clinicaNombre}</div>
              )}
              {citaSeleccionada.notas_cita && (
                <div style={{ marginTop: '8px', background: '#f4f8fb', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ color: '#5499C7', fontWeight: 600, marginBottom: 4 }}>📝 Notas del terapeuta</div>
                  <div style={{ lineHeight: 1.6 }}>{citaSeleccionada.notas_cita}</div>
                </div>
              )}
            </div>
            <button
              onClick={() => setCitaSeleccionada(null)}
              style={{
                marginTop: '24px', width: '100%', padding: '10px',
                background: '#2874A6', color: '#fff', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <div className="dash-page-header">
        <div className="dash-page-title">Mis Citas</div>
        <div className="dash-page-sub">Historial y próximas sesiones</div>
      </div>

      <div className="dash-sec-label">Próximas</div>
      {proximas.length === 0 ? (
        <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '24px' }}>
          No tienes citas próximas agendadas.
        </div>
      ) : (
        <div className="dash-cita-grid">
          {proximas.map(c => {
            const badge = getBadge(c.estado_cita)
            return (
              <div key={c.id_cita} className="dash-cita-card">
                <div className="dash-cita-head">
                  <span className="dash-cita-fecha">{formatFecha(c.fecha_cita)}</span>
                  <span className={`dash-badge ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="dash-cita-body">
                  <div className="dash-cita-time">
                    <div className="dash-ct-hour">{formatHora(c.hora_inicio)}</div>
                    <div className="dash-ct-period">HRS</div>
                  </div>
                  <div>
                    <div className="dash-ci-title">{c.motivo_cita}</div>
                    <div className="dash-ci-place">
                      {c.clinicaNombre ? `📍 ${c.clinicaNombre}` : ''}
                      {c.fisioterapeutaNombre
                        ? (c.clinicaNombre ? ` · ${c.fisioterapeutaNombre}` : `👨‍⚕️ ${c.fisioterapeutaNombre}`)
                        : ''}
                    </div>
                  </div>
                </div>
                <button className="dash-btn-sm" onClick={() => setCitaSeleccionada(c)}>
                  Ver detalles completos
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="dash-sec-label">Historial</div>
      {historial.length === 0 ? (
        <div style={{ color: '#aaa', fontSize: '0.9rem' }}>No hay citas anteriores.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.8 }}>
          {historial.map(c => {
            const badge = getBadge(c.estado_cita)
            return (
              <div key={c.id_cita} className="dash-cita-card" style={{ maxWidth: 520 }}>
                <div className="dash-cita-head">
                  <span className="dash-cita-fecha">{formatFecha(c.fecha_cita)}</span>
                  <span className={`dash-badge ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="dash-cita-body">
                  <div className="dash-cita-time">
                    <div className="dash-ct-hour">{formatHora(c.hora_inicio)}</div>
                    <div className="dash-ct-period">HRS</div>
                  </div>
                  <div>
                    <div className="dash-ci-title">{c.motivo_cita}</div>
                    <div className="dash-ci-place">
                      {c.clinicaNombre ? `📍 ${c.clinicaNombre}` : ''}
                      {c.fisioterapeutaNombre
                        ? (c.clinicaNombre ? ` · ${c.fisioterapeutaNombre}` : `👨‍⚕️ ${c.fisioterapeutaNombre}`)
                        : ''}
                    </div>
                  </div>
                </div>
                <button className="dash-btn-sm" onClick={() => setCitaSeleccionada(c)} style={{ opacity: 0.7 }}>
                  Ver detalles
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

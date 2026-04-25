'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────────
type EstadoSesion = 'completada' | 'parcial' | 'omitida' | 'futura'

type SesionDia = {
  fecha: string
  estado: EstadoSesion
  duracionMin: number
}

type FaseDatos = {
  id_fase: string
  nombre: string
  ejercicios: { nombre: string; repeticiones: number; icono: string }[]
}

type ProgresoState = {
  nombreRutina: string
  fechaInicio: string
  fechaFin: string
  semanaActual: number
  totalSemanas: number
  porcentajeGlobal: number
  sesiones: SesionDia[]
  totalCompletadas: number
  totalParciales: number
  totalOmitidas: number
  rachaActual: number
  tiempoTotalMin: number
  sesionesEstaSemana: number
  minutosEstaSemana: number
  fases: FaseDatos[]
  totalEjercicios: number
  loading: boolean
  error: string | null
}

// ── Helpers puros ──────────────────────────────────────────────────────────────
function duracionAMin(d: string | null): number {
  if (!d) return 0
  const p = d.split(':').map(Number)
  return (p[0] ?? 0) * 60 + (p[1] ?? 0)
}

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatMin(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatFechaCorta(ymd: string): string {
  return new Date(ymd + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function buildCalendario(sesiones: SesionDia[], fechaInicio: string, fechaFin: string) {
  const mapa = new Map(sesiones.map(s => [s.fecha, s.estado]))
  const result: { fecha: string; estado: string }[] = []
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const cur = new Date(fechaInicio + 'T00:00:00')
  const fin = new Date(fechaFin + 'T00:00:00')
  while (cur <= fin) {
    const ymd = cur.toISOString().slice(0, 10)
    if (cur.getTime() > hoy.getTime()) result.push({ fecha: ymd, estado: 'futura' })
    else if (mapa.has(ymd))            result.push({ fecha: ymd, estado: mapa.get(ymd)! })
    else                               result.push({ fecha: ymd, estado: 'omitida' })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

function colorEstado(estado: string): string {
  switch (estado) {
    case 'completada': return '#27AE60'
    case 'parcial':    return '#F39C12'
    case 'omitida':    return '#E74C3C'
    default:           return '#EBF0F5'   // futura / vacía
  }
}

// ── Sub-componentes UI ─────────────────────────────────────────────────────────
function MiniStatTile({ label, value, sub, accent = false }: {
  label: string; value: string; sub: string; accent?: boolean
}) {
  return (
    <div className={`dash-stat-tile${accent ? ' accent' : ''}`}>
      <span className="dash-st-label">{label}</span>
      <span className="dash-st-value">{value}</span>
      <span className="dash-st-sub">{sub}</span>
    </div>
  )
}

function BarraProgreso({ nombre, valor, tipo }: { nombre: string; valor: number; tipo: string }) {
  return (
    <div>
      <div className="dash-pb-header">
        <span className="dash-pb-name">{nombre}</span>
        <span className={`dash-pb-val ${tipo}`}>{valor}%</span>
      </div>
      <div className="dash-pb-track">
        <div className={`dash-pb-fill ${tipo}`} style={{ width: `${valor}%`, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export function SectionProgreso() {
  const EMPTY: ProgresoState = {
    nombreRutina: '', fechaInicio: '', fechaFin: '',
    semanaActual: 0, totalSemanas: 0, porcentajeGlobal: 0,
    sesiones: [], totalCompletadas: 0, totalParciales: 0,
    totalOmitidas: 0, rachaActual: 0, tiempoTotalMin: 0,
    sesionesEstaSemana: 0, minutosEstaSemana: 0,
    fases: [], totalEjercicios: 0,
    loading: true, error: null,
  }

  const [state, setState] = useState<ProgresoState>(EMPTY)

  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setState({ ...EMPTY, loading: false, error: 'Sin sesión' }); return }

        const idPaciente = user.id  // id_perfil == id_paciente

        // ── 1. Rutina activa ──────────────────────────────────────────────────
        const { data: rpRaw } = await supabase
          .from('rutina_paciente')
          .select('id_rutina_paciente, id_rutina, fecha_inicio, fecha_fin, rutina(nombre_rutina, duracion)')
          .eq('id_paciente', idPaciente)
          .eq('activa', true)
          .is('deleted_at', null)
          .single()

        if (!rpRaw) { setState({ ...EMPTY, loading: false, error: 'Sin rutina activa' }); return }

        const rutina      = (rpRaw as any).rutina
        const fechaInicio = rpRaw.fecha_inicio
        const fechaFin    = rpRaw.fecha_fin
        const MS          = 86_400_000
        const dtIni       = new Date(fechaInicio + 'T00:00:00').getTime()
        const dtFin       = new Date(fechaFin    + 'T00:00:00').getTime()
        const dtHoy       = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() })()

        const totalSemanas = Math.max(1, Math.ceil((dtFin - dtIni) / (7 * MS)))
        const semanaActual = Math.min(totalSemanas, Math.max(1, Math.ceil((dtHoy - dtIni) / (7 * MS))))

        // ── 2. Sesiones ───────────────────────────────────────────────────────
        const { data: sesRaw } = await supabase
          .from('sesion_entrenamiento')
          .select('fecha, estado_sesion, duracion_total')
          .eq('id_paciente', idPaciente)
          .eq('id_rutina_paciente', rpRaw.id_rutina_paciente)
          .is('deleted_at', null)
          .order('fecha', { ascending: true })

        const sesiones: SesionDia[] = (sesRaw ?? []).map((s: any) => ({
          fecha:       s.fecha,
          estado:      s.estado_sesion as EstadoSesion,
          duracionMin: duracionAMin(s.duracion_total),
        }))

        const totalCompletadas = sesiones.filter(s => s.estado === 'completada').length
        const totalParciales   = sesiones.filter(s => s.estado === 'parcial').length
        const realizadas       = totalCompletadas + totalParciales
        const tiempoTotalMin   = sesiones.reduce((a, s) => a + s.duracionMin, 0)
        const diasTransc       = Math.max(1, Math.floor((dtHoy - MS - dtIni) / MS) + 1)
        const totalOmitidas    = Math.max(0, diasTransc - realizadas)
        const porcentajeGlobal = Math.min(100, Math.round((totalCompletadas / Math.max(1, diasTransc)) * 100))

        // Racha actual
        const setComp = new Set(sesiones.filter(s => s.estado === 'completada').map(s => s.fecha))
        let racha = 0
        const cur = new Date(dtHoy)
        while (setComp.has(toYMD(cur))) { racha++; cur.setDate(cur.getDate() - 1) }

        // Semana actual
        const dtIniSem   = dtIni + (semanaActual - 1) * 7 * MS
        const dtFinSem   = dtIniSem + 7 * MS
        const semSes     = sesiones.filter(s => {
          const dt = new Date(s.fecha + 'T00:00:00').getTime()
          return dt >= dtIniSem && dt < dtFinSem
        })
        const sesionesEstaSemana = semSes.filter(s => s.estado === 'completada').length
        const minutosEstaSemana  = semSes.reduce((a, s) => a + s.duracionMin, 0)

        // ── 3. Fases y ejercicios ─────────────────────────────────────────────
        const { data: fasesRaw } = await supabase
          .from('fase')
          .select('id_fase, nombre_fase, numero_fase, ejercicio(nombre_ejercicio, repeticiones, icono, orden)')
          .eq('id_rutina', rpRaw.id_rutina)
          .is('deleted_at', null)
          .order('numero_fase', { ascending: true })

        const fases: FaseDatos[] = (fasesRaw ?? []).map((f: any) => ({
          id_fase: f.id_fase,
          nombre: `Fase ${f.numero_fase}: ${f.nombre_fase}`,
          ejercicios: [...(f.ejercicio ?? [])]
            .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
            .map((e: any) => ({
              nombre:       e.nombre_ejercicio,
              repeticiones: e.repeticiones ?? 0,
              icono:        e.icono ?? '💪',
            })),
        }))

        const totalEjercicios = fases.reduce((a, f) => a + f.ejercicios.length, 0)

        setState({
          nombreRutina: rutina?.nombre_rutina ?? 'Rutina',
          fechaInicio, fechaFin, semanaActual, totalSemanas, porcentajeGlobal,
          sesiones, totalCompletadas, totalParciales, totalOmitidas,
          rachaActual: racha, tiempoTotalMin,
          sesionesEstaSemana, minutosEstaSemana,
          fases, totalEjercicios,
          loading: false, error: null,
        })
      } catch (err: any) {
        console.error('[Progreso]', err)
        setState({ ...EMPTY, loading: false, error: err?.message ?? 'Error inesperado' })
      }
    })()
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (state.loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', opacity: 0.4 }}>
      Cargando progreso…
    </div>
  )

  if (state.error) return (
    <div style={{ padding: '24px', color: '#c0392b', background: '#fdf2f2', borderRadius: '12px' }}>
      ⚠️ {state.error}
    </div>
  )

  const {
    nombreRutina, fechaInicio, fechaFin,
    semanaActual, totalSemanas, porcentajeGlobal,
    sesiones, totalCompletadas, totalParciales, totalOmitidas,
    rachaActual, tiempoTotalMin,
    sesionesEstaSemana, minutosEstaSemana,
    fases, totalEjercicios,
  } = state

  const calendario  = fechaInicio && fechaFin ? buildCalendario(sesiones, fechaInicio, fechaFin) : []
  const consistencia = sesiones.length > 0
    ? Math.round((totalCompletadas / Math.max(1, sesiones.length)) * 100)
    : 0

  const indicadores = [
    { nombre: 'Progreso global del plan', valor: porcentajeGlobal,                            tipo: 'blue' },
    { nombre: 'Consistencia de sesiones', valor: Math.min(100, consistencia),                 tipo: 'blue' },
    { nombre: 'Sesiones esta semana',     valor: Math.min(100, Math.round((sesionesEstaSemana / 7) * 100)), tipo: 'lime' },
    { nombre: 'Racha actual (días)',      valor: Math.min(100, Math.round((rachaActual / 30) * 100)),       tipo: 'lime' },
  ]

  return (
    <>
      <div className="dash-page-header">
        <div className="dash-page-title">Mi Progreso</div>
        <div className="dash-page-sub">{nombreRutina} · Semana {semanaActual} / {totalSemanas}</div>
      </div>

      <div className="dash-prog-layout">

        {/* ── Columna izquierda ── */}
        <div>
          <div className="dash-prog-hero">
            <div className="dash-ph-label">Progreso global</div>
            <div className="dash-ph-circle">
              <div className="dash-ph-pct">{porcentajeGlobal}%</div>
              <div className="dash-ph-sub">completado</div>
            </div>
            <p className="dash-ph-desc">
              {rachaActual > 0
                ? <><strong>{rachaActual} día{rachaActual !== 1 ? 's' : ''}</strong> consecutivos. ¡Sigue así!</>
                : <>Comienza hoy para iniciar tu racha de días consecutivos.</>}
            </p>
          </div>

          <div className="dash-prog-stats" style={{ marginTop: '16px' }}>
            <MiniStatTile label="Sesiones"     value={String(totalCompletadas)} sub="Completadas" />
            <MiniStatTile label="Racha actual" value={String(rachaActual)}      sub="Días seguidos 🏅" accent />
          </div>

          <div className="dash-prog-stats" style={{ marginTop: '12px' }}>
            <MiniStatTile label="Parciales"    value={String(totalParciales)}    sub="Sesiones parciales" />
            <MiniStatTile label="Tiempo total" value={formatMin(tiempoTotalMin)} sub="Acumulado" />
          </div>

          <div className="dash-card" style={{ marginTop: '16px' }}>
            <div className="dash-card-title">Esta semana (sem. {semanaActual})</div>
            <div style={{ display: 'flex', gap: '20px', marginTop: '8px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#2874A6' }}>{sesionesEstaSemana}</div>
                <div style={{ fontSize: '0.78rem', color: '#99A8B8' }}>sesiones completadas</div>
              </div>
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#27AE60' }}>{formatMin(minutosEstaSemana)}</div>
                <div style={{ fontSize: '0.78rem', color: '#99A8B8' }}>tiempo activo</div>
              </div>
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#E74C3C' }}>{totalOmitidas}</div>
                <div style={{ fontSize: '0.78rem', color: '#99A8B8' }}>días sin sesión</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Columna derecha ── */}
        <div>
          <div className="dash-card">
            <div className="dash-card-title">Indicadores de recuperación</div>
            <div className="dash-prog-bars">
              {indicadores.map((ind, i) => (
                <BarraProgreso key={i} nombre={ind.nombre} valor={ind.valor} tipo={ind.tipo} />
              ))}
            </div>
          </div>

          {fases.length > 0 && (
            <div className="dash-card" style={{ marginTop: '16px' }}>
              <div className="dash-card-title">
                Ejercicios del plan
                <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: '#99A8B8', fontWeight: 400 }}>
                  {totalEjercicios} en total
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                {fases.map(f => (
                  <div key={f.id_fase}>
                    <div style={{
                      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.07em', color: '#2874A6', marginBottom: '8px',
                    }}>
                      {f.nombre}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {f.ejercicios.map((e, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          background: '#F4F8FB', borderRadius: '8px', padding: '8px 12px',
                          fontSize: '0.84rem',
                        }}>
                          <span style={{ fontSize: '1.1rem' }}>{e.icono}</span>
                          <span style={{ flex: 1, color: '#334455', fontWeight: 500 }}>{e.nombre}</span>
                          {e.repeticiones > 0 && (
                            <span style={{ color: '#99A8B8', fontSize: '0.78rem' }}>×{e.repeticiones} reps</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Calendario full-width ── */}
      {calendario.length > 0 && (
        <div className="dash-card" style={{ marginTop: '20px' }}>
          <div className="dash-card-title" style={{ marginBottom: '12px' }}>
            Calendario de asistencia
            <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: '#99A8B8', fontWeight: 400 }}>
              {formatFechaCorta(fechaInicio)} → {formatFechaCorta(fechaFin)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Completada', estado: 'completada' },
              { label: 'Parcial',    estado: 'parcial'    },
              { label: 'Sin sesión', estado: 'omitida'    },
              { label: 'Pendiente',  estado: 'futura'     },
            ].map(({ label, estado }) => (
              <div key={estado} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#667' }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '3px',
                  background: colorEstado(estado),
                  border: estado === 'futura' ? '1px solid #ddd' : 'none',
                }} />
                {label}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(20px, 1fr))', gap: '3px' }}>
            {calendario.map(({ fecha, estado }) => (
              <div
                key={fecha}
                title={`${formatFechaCorta(fecha)} · ${estado}`}
                style={{
                  aspectRatio: '1', borderRadius: '3px',
                  background: colorEstado(estado),
                  border: estado === 'futura' ? '1px solid #ddd' : 'none',
                  cursor: 'default', transition: 'transform 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface MetricaRaw {
  id_metricas_vision: string
  puntuacion_ia: number | null
  momento_ejercicio: string | null
  id_ejercicio: string
  id_sesion_entrenamiento: string
  created_at: string
  sesion_entrenamiento: {
    fecha: string
    id_paciente: string
  }
  ejercicio: {
    nombre_ejercicio: string
    icono: string | null
  }
}

interface EjercicioKPI {
  id_ejercicio: string
  nombre_ejercicio: string
  icono: string
  promedio: number
  total_mediciones: number
  mejor: number
  peor: number
  tendencia: 'sube' | 'baja' | 'estable'
  historico: { fecha: string; score: number }[]
}

interface KPIsGenerales {
  total_metricas: number
  promedio_global: number
  ejercicios_evaluados: number
  pacientes_evaluados: number
  mejor_ejercicio: string
  peor_ejercicio: string
  tendencia_global: 'sube' | 'baja' | 'estable'
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function FisioSectionReportes() {
  const [kpis, setKpis]             = useState<KPIsGenerales | null>(null)
  const [ejercicios, setEjercicios] = useState<EjercicioKPI[]>([])
  const [loading, setLoading]       = useState(true)
  const [filtro, setFiltro]         = useState<'todos' | 'mejores' | 'peores'>('todos')
  const [periodo, setPeriodo]       = useState<'7d' | '30d' | '90d' | 'todo'>('30d')

  useEffect(() => { cargar() }, [periodo])

  const cargar = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Pacientes del fisio
    const { data: relPacientes } = await supabase
      .from('paciente_fisioterapeuta')
      .select('id_paciente')
      .eq('id_fisioterapeuta', user.id)
      .is('deleted_at', null)

    const pacienteIds = (relPacientes ?? []).map(r => r.id_paciente)
    if (!pacienteIds.length) { setLoading(false); return }

    // Sesiones de esos pacientes en el período
    let sesionesQuery = supabase
      .from('sesion_entrenamiento')
      .select('id_sesion_entrenamiento, fecha, id_paciente')
      .in('id_paciente', pacienteIds)
      .is('deleted_at', null)

    if (periodo !== 'todo') {
      const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90
      const desde = new Date()
      desde.setDate(desde.getDate() - dias)
      sesionesQuery = sesionesQuery.gte('fecha', desde.toISOString().split('T')[0])
    }

    const { data: sesiones } = await sesionesQuery
    const sesionIds = (sesiones ?? []).map(s => s.id_sesion_entrenamiento)

    if (!sesionIds.length) {
      setKpis(null); setEjercicios([]); setLoading(false); return
    }

    // Métricas de visión de esas sesiones
    const { data: metricas } = await supabase
      .from('metricas_vision')
      .select(`
        id_metricas_vision, puntuacion_ia, momento_ejercicio,
        id_ejercicio, id_sesion_entrenamiento, created_at,
        sesion_entrenamiento ( fecha, id_paciente ),
        ejercicio ( nombre_ejercicio, icono )
      `)
      .in('id_sesion_entrenamiento', sesionIds)
      .not('puntuacion_ia', 'is', null)
      .order('created_at', { ascending: true })

    if (!metricas?.length) {
      setKpis(null); setEjercicios([]); setLoading(false); return
    }

    procesarMetricas(metricas as unknown as MetricaRaw[], pacienteIds)
    setLoading(false)
  }

  const procesarMetricas = (metricas: MetricaRaw[], pacienteIds: string[]) => {
    // Agrupar por ejercicio
    const porEjercicio: Record<string, MetricaRaw[]> = {}
    for (const m of metricas) {
      if (!porEjercicio[m.id_ejercicio]) porEjercicio[m.id_ejercicio] = []
      porEjercicio[m.id_ejercicio].push(m)
    }

    const kpisEjercicio: EjercicioKPI[] = Object.entries(porEjercicio).map(([id, ms]) => {
      const scores = ms.map(m => m.puntuacion_ia ?? 0)
      const promedio = scores.reduce((a, b) => a + b, 0) / scores.length

      // Tendencia: comparar primera mitad vs segunda mitad
      const mid = Math.floor(scores.length / 2)
      const primeraM = scores.slice(0, mid)
      const segundaM = scores.slice(mid)
      const avgP = primeraM.length ? primeraM.reduce((a, b) => a + b, 0) / primeraM.length : promedio
      const avgS = segundaM.length ? segundaM.reduce((a, b) => a + b, 0) / segundaM.length : promedio
      const diff = avgS - avgP
      const tendencia: EjercicioKPI['tendencia'] =
        diff > 2 ? 'sube' : diff < -2 ? 'baja' : 'estable'

      // Histórico agrupado por fecha
      const porFecha: Record<string, number[]> = {}
      for (const m of ms) {
        const fecha = (m.sesion_entrenamiento as any)?.fecha ?? m.created_at.split('T')[0]
        if (!porFecha[fecha]) porFecha[fecha] = []
        porFecha[fecha].push(m.puntuacion_ia ?? 0)
      }
      const historico = Object.entries(porFecha)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, vals]) => ({
          fecha,
          score: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
        }))

      const ej = ms[0].ejercicio as any
      return {
        id_ejercicio: id,
        nombre_ejercicio: ej?.nombre_ejercicio ?? 'Ejercicio',
        icono: ej?.icono ?? '🏋️',
        promedio: Math.round(promedio * 10) / 10,
        total_mediciones: scores.length,
        mejor: Math.round(Math.max(...scores) * 10) / 10,
        peor: Math.round(Math.min(...scores) * 10) / 10,
        tendencia,
        historico,
      }
    })

    kpisEjercicio.sort((a, b) => b.promedio - a.promedio)

    // KPIs globales
    const todosScores = metricas.map(m => m.puntuacion_ia ?? 0)
    const promedioGlobal = todosScores.reduce((a, b) => a + b, 0) / todosScores.length

    const mid = Math.floor(metricas.length / 2)
    const avgP = metricas.slice(0, mid).reduce((a, m) => a + (m.puntuacion_ia ?? 0), 0) / (mid || 1)
    const avgS = metricas.slice(mid).reduce((a, m) => a + (m.puntuacion_ia ?? 0), 0) / ((metricas.length - mid) || 1)
    const diffGlobal = avgS - avgP
    const tendenciaGlobal: EjercicioKPI['tendencia'] =
      diffGlobal > 2 ? 'sube' : diffGlobal < -2 ? 'baja' : 'estable'

    const pacientesEval = new Set(
      metricas.map(m => (m.sesion_entrenamiento as any)?.id_paciente).filter(Boolean)
    ).size

    setKpis({
      total_metricas: metricas.length,
      promedio_global: Math.round(promedioGlobal * 10) / 10,
      ejercicios_evaluados: kpisEjercicio.length,
      pacientes_evaluados: pacientesEval,
      mejor_ejercicio: kpisEjercicio[0]?.nombre_ejercicio ?? '—',
      peor_ejercicio: kpisEjercicio[kpisEjercicio.length - 1]?.nombre_ejercicio ?? '—',
      tendencia_global: tendenciaGlobal,
    })
    setEjercicios(kpisEjercicio)
  }

  const ejerciciosFiltrados = ejercicios.filter(e => {
    if (filtro === 'mejores') return e.promedio >= 70
    if (filtro === 'peores')  return e.promedio < 50
    return true
  })

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            📊 Reportes
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: '5px 0 0' }}>
            Rendimiento IA por ejercicio — basado en métricas de visión computacional
          </p>
        </div>

        {/* Selector de período */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border)' }}>
          {([['7d', '7 días'], ['30d', '30 días'], ['90d', '90 días'], ['todo', 'Todo']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPeriodo(val)}
              style={{
                padding: '6px 12px', borderRadius: '7px', border: 'none',
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all .15s',
                background: periodo === val ? 'var(--blue)' : 'transparent',
                color: periodo === val ? '#fff' : 'var(--text-light)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : !kpis ? (
        <EmptyState />
      ) : (
        <>
          {/* ── KPIs Globales ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <KPICard
              icon="🎯"
              label="Puntuación IA global"
              value={`${kpis.promedio_global}`}
              unit="/100"
              color={scoreColor(kpis.promedio_global)}
              tendencia={kpis.tendencia_global}
              grande
            />
            <KPICard icon="📐" label="Mediciones totales"   value={`${kpis.total_metricas}`}       color="blue" />
            <KPICard icon="🏋️" label="Ejercicios evaluados" value={`${kpis.ejercicios_evaluados}`}  color="teal" />
            <KPICard icon="🧑‍🦽" label="Pacientes evaluados"  value={`${kpis.pacientes_evaluados}`}   color="purple" />
          </div>

          {/* Mejor / Peor ejercicio */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <DestacadoCard
              label="🏆 Mejor ejercicio"
              nombre={kpis.mejor_ejercicio}
              score={ejercicios[0]?.promedio}
              tipo="mejor"
            />
            <DestacadoCard
              label="⚠️ Ejercicio a mejorar"
              nombre={kpis.peor_ejercicio}
              score={ejercicios[ejercicios.length - 1]?.promedio}
              tipo="peor"
            />
          </div>

          {/* ── Ranking de ejercicios ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                Rendimiento por ejercicio
              </h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                {([['todos', 'Todos'], ['mejores', '≥ 70'], ['peores', '< 50']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFiltro(val)}
                    style={{
                      padding: '5px 12px', borderRadius: '20px', cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 700, fontFamily: 'inherit',
                      border: '1.5px solid',
                      borderColor: filtro === val ? 'var(--blue)' : 'var(--border)',
                      background: filtro === val ? 'var(--blue-xlight)' : 'transparent',
                      color: filtro === val ? 'var(--blue)' : 'var(--text-light)',
                      transition: 'all .15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {ejerciciosFiltrados.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', opacity: 0.4, fontSize: '0.85rem' }}>
                Sin ejercicios en este rango
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ejerciciosFiltrados.map((e, idx) => (
                  <EjercicioRow key={e.id_ejercicio} ejercicio={e} posicion={idx + 1} total={ejerciciosFiltrados.length} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════════════════════════════════════════
function KPICard({ icon, label, value, unit, color, tendencia, grande }: {
  icon: string
  label: string
  value: string
  unit?: string
  color: 'blue' | 'teal' | 'purple' | 'green' | 'amber' | 'red'
  tendencia?: 'sube' | 'baja' | 'estable'
  grande?: boolean
}) {
  const paleta = {
    blue:   { bg: 'var(--blue-xlight)', text: 'var(--blue)',   border: '#b5d4f4' },
    teal:   { bg: '#e1f5ee',            text: '#0f6e56',       border: '#9fe1cb' },
    purple: { bg: '#eeedfe',            text: '#534ab7',       border: '#ceebf6' },
    green:  { bg: '#eaf3de',            text: '#3b6d11',       border: '#c0dd97' },
    amber:  { bg: '#faeeda',            text: '#854f0b',       border: '#fac775' },
    red:    { bg: '#fcebeb',            text: '#a32d2d',       border: '#f7c1c1' },
  }
  const { bg, text, border } = paleta[color]

  return (
    <div className="dash-card" style={{
      padding: '18px 20px',
      borderLeft: `3px solid ${border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: bg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0,
        }}>
          {icon}
        </div>
        {tendencia && (
          <span style={{ fontSize: '1rem' }}>
            {tendencia === 'sube' ? '↗' : tendencia === 'baja' ? '↘' : '→'}
          </span>
        )}
      </div>

      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
          <span style={{
            fontSize: grande ? '2rem' : '1.6rem',
            fontWeight: 800,
            color: text,
            lineHeight: 1,
          }}>
            {value}
          </span>
          {unit && (
            <span style={{ fontSize: '0.8rem', color: text, opacity: 0.7, fontWeight: 600 }}>
              {unit}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '4px', fontWeight: 600 }}>
          {label}
        </div>
        {tendencia && (
          <div style={{ fontSize: '0.7rem', marginTop: '4px', color: tendencia === 'sube' ? '#3b6d11' : tendencia === 'baja' ? '#a32d2d' : 'var(--text-light)', fontWeight: 600 }}>
            {tendencia === 'sube' ? '↗ Mejorando' : tendencia === 'baja' ? '↘ Bajando' : '→ Estable'}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESTACADO CARD — mejor / peor ejercicio
// ═══════════════════════════════════════════════════════════════════════════════
function DestacadoCard({ label, nombre, score, tipo }: {
  label: string
  nombre: string
  score?: number
  tipo: 'mejor' | 'peor'
}) {
  const esMejor = tipo === 'mejor'
  const bg     = esMejor ? '#eaf3de' : '#faeeda'
  const text   = esMejor ? '#3b6d11' : '#854f0b'
  const border = esMejor ? '#c0dd97' : '#fac775'

  return (
    <div className="dash-card" style={{ padding: '16px 20px', borderTop: `3px solid ${border}` }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)', marginBottom: '6px' }}>
        {nombre}
      </div>
      {score !== undefined && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          background: bg, color: text, padding: '4px 10px',
          borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
        }}>
          {score}/100
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILA DE EJERCICIO — barra de progreso + métricas
// ═══════════════════════════════════════════════════════════════════════════════
function EjercicioRow({ ejercicio: e, posicion, total }: {
  ejercicio: EjercicioKPI
  posicion: number
  total: number
}) {
  const color = scoreColor(e.promedio)
  const paleta = {
    green:  { bar: '#639922', bg: '#eaf3de', text: '#3b6d11' },
    amber:  { bar: '#ba7517', bg: '#faeeda', text: '#854f0b' },
    red:    { bar: '#e24b4a', bg: '#fcebeb', text: '#a32d2d' },
    blue:   { bar: 'var(--blue)', bg: 'var(--blue-xlight)', text: 'var(--blue)' },
  }
  const { bar, bg, text } = paleta[color]

  const tendenciaIcon = e.tendencia === 'sube' ? '↗' : e.tendencia === 'baja' ? '↘' : '→'
  const tendenciaColor = e.tendencia === 'sube' ? '#3b6d11' : e.tendencia === 'baja' ? '#a32d2d' : 'var(--text-light)'

  return (
    <div className="dash-card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>

        {/* Posición */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px',
          background: posicion <= 3 ? bg : 'var(--bg)',
          color: posicion <= 3 ? text : 'var(--text-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.8rem', flexShrink: 0,
          border: `1px solid ${posicion <= 3 ? bar + '44' : 'var(--border)'}`,
        }}>
          {posicion}
        </div>

        {/* Icono + nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
          <span style={{ fontSize: '1.1rem' }}>{e.icono}</span>
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
            {e.nombre_ejercicio}
          </span>
        </div>

        {/* Barra de progreso */}
        <div style={{ flex: 1, minWidth: '80px' }}>
          <div style={{
            height: '8px', borderRadius: '4px',
            background: 'var(--bg)', overflow: 'hidden',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              height: '100%', width: `${e.promedio}%`,
              background: bar, borderRadius: '4px',
              transition: 'width .4s ease',
            }} />
          </div>
        </div>

        {/* Score */}
        <div style={{
          minWidth: '56px', textAlign: 'right',
          fontWeight: 800, fontSize: '1rem', color: text,
        }}>
          {e.promedio}<span style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.7 }}>/100</span>
        </div>

        {/* Tendencia */}
        <div style={{ color: tendenciaColor, fontWeight: 700, fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>
          {tendenciaIcon}
        </div>

        {/* Métricas secundarias */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: 'var(--text-light)', flexShrink: 0 }}>
          <span title="Mediciones">📐 {e.total_mediciones}</span>
          <span title="Mejor puntuación">⬆ {e.mejor}</span>
          <span title="Peor puntuación">⬇ {e.peor}</span>
        </div>
      </div>

      {/* Mini histórico de puntos */}
      {e.historico.length > 1 && (
        <MiniSparkline historico={e.historico} color={bar} />
      )}
    </div>
  )
}

// ─── Sparkline SVG minimalista ────────────────────────────────────────────────
function MiniSparkline({ historico, color }: { historico: { fecha: string; score: number }[]; color: string }) {
  const W = 200
  const H = 28
  const pad = 4

  const scores = historico.map(h => h.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const rango = max - min || 1

  const pts = historico.map((h, i) => {
    const x = pad + (i / (historico.length - 1)) * (W - pad * 2)
    const y = H - pad - ((h.score - min) / rango) * (H - pad * 2)
    return `${x},${y}`
  })

  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', fontWeight: 600, flexShrink: 0 }}>
        Evolución
      </span>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {historico.map((h, i) => {
          const [x, y] = pts[i].split(',').map(Number)
          return (
            <circle key={i} cx={x} cy={y} r="3" fill={color} />
          )
        })}
      </svg>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>
        {historico[0].fecha} → {historico[historico.length - 1].fecha}
      </span>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(score: number): 'green' | 'amber' | 'red' | 'blue' {
  if (score >= 70) return 'green'
  if (score >= 50) return 'amber'
  return 'red'
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Skeleton KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="dash-card" style={{ height: '100px', opacity: 0.3, background: 'var(--bg)' }} />
        ))}
      </div>
      <div style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.82rem', padding: '20px 0' }}>
        Calculando métricas IA...
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="dash-card" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 20px', gap: '12px',
      opacity: 0.5, textAlign: 'center',
    }}>
      <span style={{ fontSize: '3rem' }}>📊</span>
      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)' }}>
        Sin métricas en este período
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', maxWidth: '320px' }}>
        Las métricas de rendimiento IA se generan automáticamente durante las sesiones de entrenamiento de tus pacientes
      </div>
    </div>
  )
}
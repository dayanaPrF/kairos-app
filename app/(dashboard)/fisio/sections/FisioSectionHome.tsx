'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface CitaHoy {
  id_cita: string
  hora_inicio: string
  hora_fin: string
  motivo_cita: string
  estado_cita: string
  paciente_nombre: string
}

interface PacienteInactivo {
  id_paciente: string
  nombre: string
  dias_sin_sesion: number
}

interface FisioHomeData {
  nombreFisio: string
  totalPacientes: number
  citasHoy: CitaHoy[]
  sesionesHoy: number
  pacientesInactivos: PacienteInactivo[]
  proximaCita: CitaHoy | null
  loading: boolean
  error: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function estadoBadge(estado: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    confirmada:  { bg: '#eef8d6', color: '#76a82e', label: 'Confirmada'  },
    pendiente:   { bg: '#fff3cd', color: '#856404', label: 'Pendiente'   },
    completada:  { bg: '#e4f5fb', color: '#1a3f52', label: 'Completada'  },
    cancelada:   { bg: '#fde8e8', color: '#c0392b', label: 'Cancelada'   },
  }
  const s = map[estado?.toLowerCase()] ?? { bg: '#f0f0f0', color: '#666', label: estado }
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: '20px',
      fontSize: '0.72rem', fontWeight: 700,
    }}>
      {s.label}
    </span>
  )
}

// ─── Hook de datos ────────────────────────────────────────────────────────────
function useFisioHomeData(): FisioHomeData {
  const [data, setData] = useState<FisioHomeData>({
    nombreFisio: '', totalPacientes: 0, citasHoy: [],
    sesionesHoy: 0, pacientesInactivos: [], proximaCita: null,
    loading: true, error: null,
  })

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const isoHoy = new Date().toISOString().split('T')[0]

        // ── 1. Nombre del fisio ──────────────────────────────────────────
        const { data: perfil } = await supabase
          .from('perfil')
          .select('nombre, primer_apellido')
          .eq('id_perfil', user.id)
          .maybeSingle()

        const nombreFisio = [perfil?.nombre, perfil?.primer_apellido].filter(Boolean).join(' ')

        // ── 2. Total pacientes asignados ─────────────────────────────────
        const { data: relPacs } = await supabase
          .from('paciente_fisioterapeuta')
          .select('id_paciente')
          .eq('id_fisioterapeuta', user.id)
          .is('deleted_at', null)

        const totalPacientes = relPacs?.length ?? 0
        const pacIds = relPacs?.map(r => r.id_paciente) ?? []

        // ── 3. Citas de hoy ──────────────────────────────────────────────
        const { data: citasRaw } = await supabase
          .from('cita')
          .select('id_cita, hora_inicio, hora_fin, motivo_cita, estado_cita, id_paciente')
          .eq('id_fisioterapeuta', user.id)
          .eq('fecha_cita', isoHoy)
          .neq('estado_cita', 'cancelada')
          .order('hora_inicio', { ascending: true })

        // Nombres de pacientes para las citas de hoy
        let citasHoy: CitaHoy[] = []
        if (citasRaw?.length) {
          const pacIdsCitas = [...new Set(citasRaw.map(c => c.id_paciente))]
          const { data: perfiles } = await supabase
            .from('perfil')
            .select('id_perfil, nombre, primer_apellido')
            .in('id_perfil', pacIdsCitas)

          const mapaPerfiles = Object.fromEntries(
            (perfiles ?? []).map(p => [p.id_perfil, `${p.nombre} ${p.primer_apellido}`])
          )

          citasHoy = citasRaw.map(c => ({
            id_cita:       c.id_cita,
            hora_inicio:   c.hora_inicio?.slice(0, 5) ?? '',
            hora_fin:      c.hora_fin?.slice(0, 5)    ?? '',
            motivo_cita:   c.motivo_cita ?? 'Consulta',
            estado_cita:   c.estado_cita ?? '',
            paciente_nombre: mapaPerfiles[c.id_paciente] ?? 'Paciente',
          }))
        }

        // ── 4. Sesiones completadas hoy (de sus pacientes) ───────────────
        let sesionesHoy = 0
        if (pacIds.length) {
          const { data: sesHoy } = await supabase
            .from('sesion_entrenamiento')
            .select('id_sesion_entrenamiento')
            .in('id_paciente', pacIds)
            .eq('fecha', isoHoy)
            .eq('estado_sesion', 'completada')

          sesionesHoy = sesHoy?.length ?? 0
        }

        // ── 5. Pacientes sin sesión en los últimos 7 días ────────────────
        let pacientesInactivos: PacienteInactivo[] = []
        if (pacIds.length) {
          const hace7 = new Date()
          hace7.setDate(hace7.getDate() - 7)
          const iso7 = hace7.toISOString().split('T')[0]

          const { data: sesRecientes } = await supabase
            .from('sesion_entrenamiento')
            .select('id_paciente, fecha')
            .in('id_paciente', pacIds)
            .gte('fecha', iso7)

          const conActividad = new Set((sesRecientes ?? []).map(s => s.id_paciente))
          const inactivosIds = pacIds.filter(id => !conActividad.has(id))

          if (inactivosIds.length) {
            const { data: perfilesInactivos } = await supabase
              .from('perfil')
              .select('id_perfil, nombre, primer_apellido')
              .in('id_perfil', inactivosIds)
              .limit(5)

            // Última sesión de cada inactivo
            const { data: ultimasSesiones } = await supabase
              .from('sesion_entrenamiento')
              .select('id_paciente, fecha')
              .in('id_paciente', inactivosIds)
              .order('fecha', { ascending: false })

            const mapaUltima: Record<string, string> = {}
            for (const s of ultimasSesiones ?? []) {
              if (!mapaUltima[s.id_paciente]) mapaUltima[s.id_paciente] = s.fecha
            }

            pacientesInactivos = (perfilesInactivos ?? []).map(p => {
              const ultima = mapaUltima[p.id_perfil]
              const dias = ultima
                ? Math.floor((Date.now() - new Date(ultima).getTime()) / 86400000)
                : 99
              return {
                id_paciente: p.id_perfil,
                nombre: `${p.nombre} ${p.primer_apellido}`,
                dias_sin_sesion: dias,
              }
            }).sort((a, b) => b.dias_sin_sesion - a.dias_sin_sesion)
          }
        }

        // ── 6. Próxima cita (hoy o futura) ──────────────────────────────
        const proximaCita = citasHoy.find(c =>
          c.estado_cita !== 'completada' && c.estado_cita !== 'cancelada'
        ) ?? null

        setData({
          nombreFisio,
          totalPacientes,
          citasHoy,
          sesionesHoy,
          pacientesInactivos,
          proximaCita,
          loading: false,
          error: null,
        })
      } catch (err: any) {
        console.error(err)
        setData(prev => ({ ...prev, loading: false, error: err.message }))
      }
    }
    load()
  }, [])

  return data
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function FisioSectionHome() {
  const {
    nombreFisio, totalPacientes, citasHoy,
    sesionesHoy, pacientesInactivos, proximaCita,
    loading, error,
  } = useFisioHomeData()

  const hoy = new Date()
  const diaSemana = DIAS[hoy.getDay()]
  const diaNum    = hoy.getDate()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', opacity: 0.4 }}>
      Cargando...
    </div>
  )

  if (error) return (
    <div style={{ padding: '20px', color: 'red', fontSize: '0.85rem' }}>
      Error: {error}
    </div>
  )

  return (
    <div className="fisio-home-wrap">

      {/* ── HERO — bienvenida + stat strip ── */}
      <div className="dash-hero" style={{ marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <div className="dash-hero-label">Panel del día</div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>
            {diaSemana} {diaNum} — ¡Buena jornada, Dr. {nombreFisio.split(' ')[0]}!
          </h2>
          <p style={{ opacity: 0.85, fontSize: '0.88rem' }}>
            {citasHoy.length > 0
              ? `Tienes ${citasHoy.length} cita${citasHoy.length > 1 ? 's' : ''} programada${citasHoy.length > 1 ? 's' : ''} hoy`
              : 'No tienes citas programadas para hoy'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <StatPill label="Pacientes" value={totalPacientes} icon="🧑‍🦽" />
          <StatPill label="Citas hoy"  value={citasHoy.length} icon="📅" accent />
          <StatPill label="Sesiones completadas" value={sesionesHoy} icon="✅" />
        </div>
      </div>

      {/* ── GRID 2 columnas ── */}
      <div className="fisio-home-grid">

        {/* COLUMNA IZQUIERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Citas del día */}
          <div className="dash-card">
            <div className="dash-card-title">
              📅 Agenda de hoy
              <span style={{
                marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600,
                color: 'var(--blue)', cursor: 'pointer', opacity: 0.8,
              }}>
                Ver agenda completa →
              </span>
            </div>

            {citasHoy.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', opacity: 0.4, fontSize: '0.85rem', fontStyle: 'italic' }}>
                Sin citas para hoy
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {citasHoy.map(cita => (
                  <div key={cita.id_cita} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px 14px', borderRadius: '10px',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    transition: '.2s',
                  }}>
                    {/* Hora */}
                    <div style={{
                      minWidth: '52px', textAlign: 'center',
                      background: 'var(--blue)', borderRadius: '8px', padding: '8px 4px',
                      color: '#fff',
                    }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 900, lineHeight: 1 }}>{cita.hora_inicio}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '2px' }}>hrs</div>
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                        {cita.paciente_nombre}
                      </div>
                      <div style={{ fontSize: '0.77rem', color: 'var(--text-light)', marginTop: '2px' }}>
                        {cita.motivo_cita} · {cita.hora_inicio}–{cita.hora_fin} hrs
                      </div>
                    </div>
                    {estadoBadge(cita.estado_cita)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pacientes sin actividad */}
          <div className="dash-card">
            <div className="dash-card-title">
              ⚠️ Pacientes sin actividad
              <span style={{
                marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600,
                background: '#fde8e8', color: '#c0392b',
                padding: '2px 8px', borderRadius: '20px',
              }}>
                {pacientesInactivos.length} alerta{pacientesInactivos.length !== 1 ? 's' : ''}
              </span>
            </div>

            {pacientesInactivos.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', opacity: 0.4, fontSize: '0.85rem', fontStyle: 'italic' }}>
                Todos tus pacientes tienen actividad reciente ✅
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pacientesInactivos.map(pac => (
                  <div key={pac.id_paciente} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '10px',
                    background: '#fff9f9', border: '1px solid #fde8e8',
                  }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'var(--blue-xlight)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem', fontWeight: 800, color: 'var(--blue)',
                    }}>
                      {pac.nombre.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>
                        {pac.nombre}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#c0392b', marginTop: '1px' }}>
                        Sin sesión hace {pac.dias_sin_sesion === 99 ? 'más de 7' : pac.dias_sin_sesion} días
                      </div>
                    </div>
                    <button style={{
                      background: 'none', border: '1.5px solid var(--blue)',
                      color: 'var(--blue)', borderRadius: '8px', padding: '5px 12px',
                      fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    }}>
                      Contactar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Próxima cita destacada */}
          <div className="dash-note-card">
            <div className="dash-card-title" style={{ marginBottom: '14px' }}>
              🕐 Próxima cita
            </div>
            {proximaCita ? (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(75,179,214,0.2)',
                }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '12px',
                    background: 'var(--blue)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, lineHeight: 1 }}>{proximaCita.hora_inicio.slice(0,2)}</span>
                    <span style={{ fontSize: '0.6rem', opacity: 0.85 }}>hrs</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                      {proximaCita.paciente_nombre}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-mid)', marginTop: '3px' }}>
                      {proximaCita.motivo_cita}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px' }}>
                      {proximaCita.hora_inicio} – {proximaCita.hora_fin} hrs
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    {estadoBadge(proximaCita.estado_cita)}
                  </div>
                </div>
                <button style={{
                  width: '100%', marginTop: '12px', padding: '10px',
                  background: 'var(--blue)', color: '#fff', border: 'none',
                  borderRadius: '10px', fontWeight: 700, fontSize: '0.85rem',
                  cursor: 'pointer',
                }}>
                  Iniciar consulta →
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', opacity: 0.5, fontStyle: 'italic', fontSize: '0.85rem' }}>
                No hay más citas pendientes hoy
              </div>
            )}
          </div>

          {/* Resumen semanal simple */}
          <div className="dash-card">
            <div className="dash-card-title">📆 Esta semana</div>
            <SemanaSummary fisioId={null} />
          </div>

          {/* Accesos rápidos */}
          <div className="dash-card">
            <div className="dash-card-title">⚡ Accesos rápidos</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { icon: '🧑‍🦽', label: 'Nuevo paciente'   },
                { icon: '📅', label: 'Agendar cita'      },
                { icon: '🏋️', label: 'Crear rutina'       },
                { icon: '💬', label: 'Enviar mensaje'     },
              ].map(({ icon, label }) => (
                <button key={label} style={{
                  padding: '14px 10px', borderRadius: '12px',
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '6px', transition: '.2s',
                  color: 'var(--text-mid)', fontWeight: 600, fontSize: '0.8rem',
                }}>
                  <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatPill({ label, value, icon, accent }: {
  label: string; value: number; icon: string; accent?: boolean
}) {
  return (
    <div style={{
      background: accent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: '14px', padding: '14px 18px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      minWidth: '90px',
    }}>
      <span style={{ fontSize: '1.3rem' }}>{icon}</span>
      <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
    </div>
  )
}

function SemanaSummary({ fisioId }: { fisioId: string | null }) {
  const [semana, setSemana] = useState<{ dia: string; citas: number }[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const hoy = new Date()
      const lunes = new Date(hoy)
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))

      const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(lunes)
        d.setDate(lunes.getDate() + i)
        return d.toISOString().split('T')[0]
      })

      const { data: citas } = await supabase
        .from('cita')
        .select('fecha_cita')
        .eq('id_fisioterapeuta', user.id)
        .gte('fecha_cita', dias[0])
        .lte('fecha_cita', dias[6])
        .neq('estado_cita', 'cancelada')

      const DIAS_CORTOS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
      const conteo = dias.map((iso, i) => ({
        dia: DIAS_CORTOS[i],
        citas: (citas ?? []).filter(c => c.fecha_cita === iso).length,
      }))

      setSemana(conteo)
    }
    load()
  }, [])

  const max = Math.max(...semana.map(s => s.citas), 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '70px' }}>
      {semana.map((s, i) => {
        const hoyIdx = (new Date().getDay() + 6) % 7
        const isHoy = i === hoyIdx
        const altura = s.citas > 0 ? Math.max(20, (s.citas / max) * 60) : 8
        return (
          <div key={s.dia} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '100%', height: `${altura}px`, borderRadius: '5px',
              background: isHoy ? 'var(--blue)' : s.citas > 0 ? 'var(--blue-light)' : 'var(--border)',
              transition: '.3s',
            }} title={`${s.citas} cita${s.citas !== 1 ? 's' : ''}`} />
            <span style={{
              fontSize: '0.65rem', color: isHoy ? 'var(--blue)' : 'var(--text-light)',
              fontWeight: isHoy ? 800 : 500,
            }}>{s.dia}</span>
          </div>
        )
      })}
    </div>
  )
}
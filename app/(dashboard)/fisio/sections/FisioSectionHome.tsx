'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface CitaHoy {
  id_cita: string
  id_paciente: string
  hora_inicio: string
  hora_fin: string
  motivo_cita: string
  estado_cita: string
  paciente_nombre: string
  notas_cita: string | null
}

interface PacienteInactivo {
  id_paciente: string
  nombre: string
  dias_sin_sesion: number
  ultima_fecha: string | null
}

interface DiaResumen {
  dia: string
  fecha: string
  citas: number
}

interface FisioHomeData {
  fisioId: string | null
  nombreFisio: string
  totalPacientes: number
  citasHoy: CitaHoy[]
  sesionesHoy: number
  pacientesInactivos: PacienteInactivo[]
  proximaCita: CitaHoy | null
  semana: DiaResumen[]
  loading: boolean
  error: string | null
}

export interface FisioSectionHomeProps {
  /** Router de navegación del dashboard. section = nombre de ruta, params = query params */
  onNavigate?: (section: string, params?: Record<string, string>) => void
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const DIAS_SEMANA  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_CORTOS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES        = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

const ESTADO_CFG: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
  confirmada: { bg: '#f0fdf4', fg: '#166534', dot: '#22c55e', label: 'Confirmada' },
  pendiente:  { bg: '#fffbeb', fg: '#92400e', dot: '#f59e0b', label: 'Pendiente'  },
  completada: { bg: '#eff6ff', fg: '#1e40af', dot: '#3b82f6', label: 'Completada' },
  cancelada:  { bg: '#fef2f2', fg: '#991b1b', dot: '#ef4444', label: 'Cancelada'  },
  en_curso:   { bg: '#f0f9ff', fg: '#0c4a6e', dot: '#0ea5e9', label: 'En curso'   },
}

const AVATAR_PALETTES = [
  ['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'], ['#fce7f3', '#9d174d'],
  ['#ede9fe', '#6d28d9'], ['#ffedd5', '#c2410c'], ['#e0f2fe', '#0369a1'],
  ['#fef9c3', '#854d0e'], ['#f1f5f9', '#334155'],
]

// ─── Utilidades ───────────────────────────────────────────────────────────────
function getHoyISO() {
  return new Date().toISOString().split('T')[0]
}

function getHoraActual() {
  return new Date().toTimeString().slice(0, 5)
}

function diasDesde(fechaISO: string | null): number {
  if (!fechaISO) return 999
  return Math.floor((Date.now() - new Date(fechaISO).getTime()) / 86_400_000)
}

function getLunes(): Date {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  return lunes
}

// ─── Hook principal de datos ──────────────────────────────────────────────────
function useFisioHomeData(): FisioHomeData & { refresh: () => void } {
  const [data, setData] = useState<FisioHomeData>({
    fisioId: null, nombreFisio: '', totalPacientes: 0, citasHoy: [],
    sesionesHoy: 0, pacientesInactivos: [], proximaCita: null,
    semana: [], loading: true, error: null,
  })
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return

        const isoHoy = getHoyISO()
        const fisioId = user.id

        // ── Paralelo 1: perfil + pacientes asignados ─────────────────────
        const [{ data: perfil }, { data: relPacs }] = await Promise.all([
          supabase.from('perfil').select('nombre, primer_apellido').eq('id_perfil', fisioId).maybeSingle(),
          supabase.from('paciente_fisioterapeuta').select('id_paciente').eq('id_fisioterapeuta', fisioId).is('deleted_at', null),
        ])

        if (cancelled) return

        const nombreFisio   = [perfil?.nombre, perfil?.primer_apellido].filter(Boolean).join(' ')
        const totalPacientes = relPacs?.length ?? 0
        const pacIds         = relPacs?.map(r => r.id_paciente) ?? []

        // ── Paralelo 2: citas hoy + semana ──────────────────────────────
        const lunes    = getLunes()
        const lunesISO = lunes.toISOString().split('T')[0]
        const domISO   = (() => { const d = new Date(lunes); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0] })()

        const [{ data: citasRaw }, { data: citasSemana }] = await Promise.all([
          supabase
            .from('cita')
            .select('id_cita, hora_inicio, hora_fin, motivo_cita, estado_cita, id_paciente, notas_cita')
            .eq('id_fisioterapeuta', fisioId)
            .eq('fecha_cita', isoHoy)
            .neq('estado_cita', 'cancelada')
            .order('hora_inicio', { ascending: true }),
          supabase
            .from('cita')
            .select('fecha_cita')
            .eq('id_fisioterapeuta', fisioId)
            .gte('fecha_cita', lunesISO)
            .lte('fecha_cita', domISO)
            .neq('estado_cita', 'cancelada'),
        ])

        if (cancelled) return

        // Nombres para citas de hoy
        let citasHoy: CitaHoy[] = []
        if (citasRaw?.length) {
          const ids = [...new Set(citasRaw.map(c => c.id_paciente))]
          const { data: perfiles } = await supabase
            .from('perfil').select('id_perfil, nombre, primer_apellido').in('id_perfil', ids)

          const mapaP = Object.fromEntries(
            (perfiles ?? []).map(p => [p.id_perfil, `${p.nombre} ${p.primer_apellido}`])
          )
          citasHoy = citasRaw.map(c => ({
            id_cita:         c.id_cita,
            id_paciente:     c.id_paciente,
            hora_inicio:     c.hora_inicio?.slice(0, 5) ?? '',
            hora_fin:        c.hora_fin?.slice(0, 5)    ?? '',
            motivo_cita:     c.motivo_cita ?? 'Consulta',
            estado_cita:     c.estado_cita ?? 'pendiente',
            notas_cita:      c.notas_cita ?? null,
            paciente_nombre: mapaP[c.id_paciente] ?? 'Paciente',
          }))
        }

        // Semana
        const diasISO = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(lunes); d.setDate(lunes.getDate() + i)
          return d.toISOString().split('T')[0]
        })
        const semana: DiaResumen[] = diasISO.map((iso, i) => ({
          dia:   DIAS_CORTOS[i],
          fecha: iso,
          citas: (citasSemana ?? []).filter(c => c.fecha_cita === iso).length,
        }))

        // ── Paralelo 3: sesiones hoy + inactividad ───────────────────────
        const hace7ISO = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0] })()

        const [sesHoyRes, sesRecientesRes] = await Promise.all([
          pacIds.length
            ? supabase.from('sesion_entrenamiento').select('id_sesion_entrenamiento')
                .in('id_paciente', pacIds).eq('fecha', isoHoy).eq('estado_sesion', 'completada')
            : Promise.resolve({ data: [] }),
          pacIds.length
            ? supabase.from('sesion_entrenamiento').select('id_paciente, fecha')
                .in('id_paciente', pacIds).gte('fecha', hace7ISO)
            : Promise.resolve({ data: [] }),
        ])

        if (cancelled) return

        const sesionesHoy   = sesHoyRes.data?.length ?? 0
        const conActividad  = new Set((sesRecientesRes.data ?? []).map(s => s.id_paciente))
        const inactivosIds  = pacIds.filter(id => !conActividad.has(id))

        // Pacientes inactivos
        let pacientesInactivos: PacienteInactivo[] = []
        if (inactivosIds.length) {
          const [{ data: perfsInact }, { data: ultimasSes }] = await Promise.all([
            supabase.from('perfil').select('id_perfil, nombre, primer_apellido')
              .in('id_perfil', inactivosIds).limit(6),
            supabase.from('sesion_entrenamiento').select('id_paciente, fecha')
              .in('id_paciente', inactivosIds).order('fecha', { ascending: false }),
          ])

          if (cancelled) return

          const mapaUltima: Record<string, string> = {}
          for (const s of ultimasSes ?? []) {
            if (!mapaUltima[s.id_paciente]) mapaUltima[s.id_paciente] = s.fecha
          }

          pacientesInactivos = (perfsInact ?? [])
            .map(p => ({
              id_paciente:     p.id_perfil,
              nombre:          `${p.nombre} ${p.primer_apellido}`,
              ultima_fecha:    mapaUltima[p.id_perfil] ?? null,
              dias_sin_sesion: diasDesde(mapaUltima[p.id_perfil] ?? null),
            }))
            .sort((a, b) => b.dias_sin_sesion - a.dias_sin_sesion)
        }

        // ── Próxima cita: la siguiente no completada desde ahora ─────────
        const horaActual = getHoraActual()
        const proximaCita =
          citasHoy.find(c =>
            c.estado_cita !== 'completada' &&
            c.estado_cita !== 'cancelada'  &&
            c.hora_inicio >= horaActual
          ) ??
          citasHoy.find(c =>
            c.estado_cita !== 'completada' &&
            c.estado_cita !== 'cancelada'
          ) ?? null

        if (!cancelled) {
          setData({
            fisioId, nombreFisio, totalPacientes, citasHoy,
            sesionesHoy, pacientesInactivos, proximaCita,
            semana, loading: false, error: null,
          })
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Error desconocido'
          setData(prev => ({ ...prev, loading: false, error: msg }))
        }
      }
    }

    setData(prev => ({ ...prev, loading: true, error: null }))
    load()
    return () => { cancelled = true }
  }, [tick])

  return { ...data, refresh }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function FisioSectionHome({ onNavigate }: FisioSectionHomeProps) {
  const {
    fisioId, nombreFisio, totalPacientes, citasHoy,
    sesionesHoy, pacientesInactivos, proximaCita, semana,
    loading, error, refresh,
  } = useFisioHomeData()

  const [showMiniAgenda, setShowMiniAgenda] = useState(false);

  // Estado local para optimistic UI al iniciar consulta
  const [iniciando, setIniciando] = useState<string | null>(null)
  // Modal de detalle de cita
  const [citaDetalle, setCitaDetalle] = useState<CitaHoy | null>(null)

  const navigate = useCallback(
    (section: string, params?: Record<string, string>) => onNavigate?.(section, params),
    [onNavigate]
  )

  const handleIniciarConsulta = useCallback(async (cita: CitaHoy) => {
    setIniciando(cita.id_cita)
    try {
      await supabase
        .from('cita')
        .update({ estado_cita: 'en_curso', updated_at: new Date().toISOString() })
        .eq('id_cita', cita.id_cita)
      navigate('consulta', { id_cita: cita.id_cita, id_paciente: cita.id_paciente })
    } catch {
      setIniciando(null)
    }
  }, [navigate])

  const handleCompletarCita = useCallback(async (cita: CitaHoy) => {
    await supabase
      .from('cita')
      .update({ estado_cita: 'completada', updated_at: new Date().toISOString() })
      .eq('id_cita', cita.id_cita)
    setCitaDetalle(null)
    refresh()
  }, [refresh])

  const handleContactar = useCallback((pac: PacienteInactivo) => {
    navigate('mensajes', { id_paciente: pac.id_paciente })
  }, [navigate])

  const hoy         = new Date()
  const diaSemana   = DIAS_SEMANA[hoy.getDay()]
  const diaNum      = hoy.getDate()
  const mes         = MESES[hoy.getMonth()]
  const primerNombre = nombreFisio.split(' ')[0] || 'Doctor'

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) return <HomeSkeletonLoader />

  if (error) return (
    <div style={{
      padding: '24px', background: '#fef2f2', borderRadius: '14px',
      border: '1px solid #fecaca', color: '#991b1b',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '6px' }}>⚠️ Error al cargar el panel</div>
      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{error}</div>
      <button
        onClick={refresh}
        style={{
          marginTop: '12px', padding: '8px 16px', background: '#991b1b',
          color: '#fff', border: 'none', borderRadius: '8px',
          fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
        }}
      >
        Reintentar
      </button>
    </div>
  )

  return (
    <>
      {/* ── Modal detalle de cita ───────────────────────────────────────── */}
      {citaDetalle && (
        <CitaDetalleModal
          cita={citaDetalle}
          iniciando={iniciando === citaDetalle.id_cita}
          onIniciar={() => handleIniciarConsulta(citaDetalle)}
          onCompletar={() => handleCompletarCita(citaDetalle)}
          onVerPaciente={() => { setCitaDetalle(null); navigate('paciente', { id_paciente: citaDetalle.id_paciente }) }}
          onClose={() => setCitaDetalle(null)}
        />
      )}

      <div className="fisio-home-wrap">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <div className="dash-hero" style={{ marginBottom: '20px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '0.7rem', fontWeight: 700, opacity: 0.7,
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px',
            }}>
              Panel del día
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 8px' }}>
              {diaSemana} {diaNum} de {mes} — ¡Buena jornada, Dr. {primerNombre}!
            </h2>
            <p style={{ opacity: 0.85, fontSize: '0.87rem', margin: 0, lineHeight: 1.5 }}>
              {citasHoy.length > 0
                ? <>Tienes <strong>{citasHoy.length}</strong> cita{citasHoy.length > 1 ? 's' : ''} programada{citasHoy.length > 1 ? 's' : ''} hoy{proximaCita ? ` · próxima a las ${proximaCita.hora_inicio} hrs` : ''}</>
                : 'No tienes citas programadas para hoy'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
            <StatPill label="Pacientes"   value={totalPacientes}  icon="🧑‍🦽" />
            <StatPill label="Citas hoy"   value={citasHoy.length} icon="📅" accent />
            <StatPill label="Completadas" value={sesionesHoy}     icon="✅" />
          </div>
        </div>

        {/* ── GRID ──────────────────────────────────────────────────────── */}
        <div className="fisio-home-grid">

          {/* IZQUIERDA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Agenda del día */}
            <div className="dash-card">
              <div className="dash-card-title">
                📅 Agenda de hoy
                {/* Este ya usa navigate('agenda'), asegúrate que el componente padre 
                    mapee 'agenda' hacia FisioSectionAgenda */}
                <NavLinkBtn label="Ver agenda completa" onClick={() => navigate('agenda')} />
              </div>

              {citasHoy.length === 0 ? (
                <EmptyState icon="📭" texto="Sin citas para hoy" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {citasHoy.map(cita => (
                    <CitaRow
                      key={cita.id_cita}
                      cita={cita}
                      esProxima={proximaCita?.id_cita === cita.id_cita}
                      iniciando={iniciando === cita.id_cita}
                      onClickDetalle={() => setCitaDetalle(cita)}
                      onIniciar={() => handleIniciarConsulta(cita)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pacientes sin actividad */}
            <div className="dash-card">
              <div className="dash-card-title">
                ⚠️ Sin actividad reciente
                <AlertaBadge count={pacientesInactivos.length} />
              </div>

              {pacientesInactivos.length === 0 ? (
                <EmptyState icon="✅" texto="Todos tus pacientes tienen actividad reciente" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pacientesInactivos.map(pac => (
                    <PacienteInactivoRow
                      key={pac.id_paciente}
                      pac={pac}
                      onContactar={() => handleContactar(pac)}
                      onVerPaciente={() => navigate('paciente', { id_paciente: pac.id_paciente })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* DERECHA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Próxima cita destacada */}
            <ProximaCitaCard
              cita={proximaCita}
              iniciando={iniciando === proximaCita?.id_cita}
              onIniciar={() => proximaCita && handleIniciarConsulta(proximaCita)}
              onVerPerfil={() => proximaCita && navigate('paciente', { id_paciente: proximaCita.id_paciente })}
              onVerDetalle={() => proximaCita && setCitaDetalle(proximaCita)}
            />

            {/* Resumen semanal */}

            <div className="dash-card">
              <div className="dash-card-title">
                📆 Esta semana
                <NavLinkBtn label="Ver agenda" onClick={() => setShowMiniAgenda(true)} />
              </div>
              <SemanaSummary semana={semana} />
              
              {/* Ventana chiquita de citas (Mini Agenda) */}
              {showMiniAgenda && (
                <div style={{
                  position: 'absolute', zIndex: 100, background: '#fff',
                  border: '1px solid var(--border)', borderRadius: '12px',
                  padding: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  width: '280px', right: '20px', top: '60px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <strong style={{ fontSize: '0.85rem' }}>Próximas citas</strong>
                    <button onClick={() => setShowMiniAgenda(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                  </div>
                  
                  {semana.filter(s => s.citas > 0).length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>No hay citas programadas.</p>
                  ) : (
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {semana.map(dia => dia.citas > 0 && (
                        <div key={dia.fecha} style={{ fontSize: '0.75rem', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <strong>{dia.dia}:</strong> {dia.citas} cita(s)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── BANDA DE ACCESOS RÁPIDOS ───────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginTop: '16px',
        }}>
          {[
            { 
              icon: '🧑‍🦽', label: 'Nuevo paciente', sub: 'Registrar paciente',   
              section: 'pacientes', color: '#4b7bec' // Mapea a FisioSectionPacientes.tsx
            },
            { 
              icon: '📅', label: 'Agendar cita', sub: 'Reservar horario',     
              section: 'agenda', color: '#26de81'    // Mapea a FisioSectionAgenda.tsx
            },
            { 
              icon: '🏋️', label: 'Crear rutina', sub: 'Plan de ejercicios',   
              section: 'rutinas', color: '#fd9644'   // Mapea a FisioSectionRutinas.tsx
            },
            { 
              icon: '💬', label: 'Mensajes', sub: 'Chat con pacientes',   
              section: 'mensajes', color: '#a55eea' 
            },
          ].map(({ icon, label, sub, section, color }) => (
            <QuickAccessCard
              key={section}
              icon={icon}
              label={label}
              sub={sub}
              color={color}
              onClick={() => navigate(section)}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Sub-componentes puros ────────────────────────────────────────────────────

function HomeSkeletonLoader() {
  const bar = (w: string, h = '14px', r = '6px') => (
    <div style={{ width: w, height: h, borderRadius: r, background: 'var(--border)', opacity: 0.5 }} />
  )
  return (
    <div className="fisio-home-wrap" style={{ opacity: 0.6 }}>
      <div className="dash-hero" style={{ marginBottom: '20px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {bar('40%', '12px')}
          {bar('70%', '20px', '8px')}
          {bar('55%')}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 90, height: 80, borderRadius: 14, background: 'rgba(255,255,255,0.15)' }} />)}
        </div>
      </div>
      <div className="fisio-home-grid">
        {[0, 1].map(col => (
          <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[120, 80, 100].map(h => (
              <div key={h} className="dash-card" style={{ minHeight: h, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bar('50%')} {bar('100%', '44px', '10px')} {bar('80%', '44px', '10px')}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatPill({ label, value, icon, accent }: {
  label: string; value: number; icon: string; accent?: boolean
}) {
  return (
    <div style={{
      background: accent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.14)',
      border: '1px solid rgba(255,255,255,0.22)',
      borderRadius: '14px', padding: '13px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
      minWidth: '86px',
    }}>
      <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      <span style={{ fontSize: '1.55rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
    </div>
  )
}

function EmptyState({ icon, texto }: { icon: string; texto: string }) {
  return (
    <div style={{
      padding: '28px 0', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      opacity: 0.45, fontSize: '0.84rem', fontStyle: 'italic',
    }}>
      <span style={{ fontSize: '1.8rem', opacity: 0.6 }}>{icon}</span>
      {texto}
    </div>
  )
}

function AlertaBadge({ count }: { count: number }) {
  return (
    <span style={{
      marginLeft: 'auto', fontSize: '0.71rem', fontWeight: 700,
      background: count > 0 ? '#fee2e2' : '#dcfce7',
      color:      count > 0 ? '#991b1b' : '#166534',
      padding: '2px 9px', borderRadius: '20px',
    }}>
      {count} alerta{count !== 1 ? 's' : ''}
    </span>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado?.toLowerCase()] ?? { bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8', label: estado }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: cfg.bg, color: cfg.fg,
      padding: '3px 9px', borderRadius: '20px',
      fontSize: '0.71rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  )
}

function Avatar({ nombre, size = 36 }: { nombre: string; size?: number }) {
  const initials = nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
  const [bg, fg] = AVATAR_PALETTES[nombre.charCodeAt(0) % AVATAR_PALETTES.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: fg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.36) + 'px', fontWeight: 800,
      userSelect: 'none',
    }}>
      {initials}
    </div>
  )
}

// ── CitaRow ────────────────────────────────────────────────────────────────────
function CitaRow({ cita, esProxima, iniciando, onClickDetalle, onIniciar }: {
  cita: CitaHoy
  esProxima: boolean
  iniciando: boolean
  onClickDetalle: () => void
  onIniciar: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const esCompletada = cita.estado_cita === 'completada'

  return (
    <div
      onClick={onClickDetalle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '11px 13px', borderRadius: '11px',
        background: esProxima ? 'var(--blue-xlight, #eff6ff)' : 'var(--bg)',
        border: `1px solid ${esProxima ? 'var(--blue)' : hovered ? 'var(--blue-light, #93c5fd)' : 'var(--border)'}`,
        cursor: 'pointer', transition: 'border-color .15s, background .15s',
        opacity: esCompletada ? 0.6 : 1,
      }}
    >
      {/* Bloque hora */}
      <div style={{
        minWidth: '50px', textAlign: 'center',
        background: esCompletada ? 'var(--border)' : 'var(--blue)',
        borderRadius: '8px', padding: '7px 4px', color: '#fff', flexShrink: 0,
      }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 900, lineHeight: 1 }}>{cita.hora_inicio}</div>
        <div style={{ fontSize: '0.6rem', opacity: 0.8, marginTop: '2px' }}>hrs</div>
      </div>

      <Avatar nombre={cita.paciente_nombre} size={32} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cita.paciente_nombre}
          {esProxima && <span style={{ marginLeft: 6, fontSize: '0.65rem', fontWeight: 700, color: 'var(--blue)', background: 'rgba(59,130,246,0.12)', padding: '1px 6px', borderRadius: '10px' }}>Próxima</span>}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px' }}>
          {cita.motivo_cita} · hasta {cita.hora_fin}
        </div>
      </div>

      {/* Badge + botón rápido si es la próxima */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <EstadoBadge estado={cita.estado_cita} />
        {esProxima && !esCompletada && (
          <button
            onClick={e => { e.stopPropagation(); onIniciar() }}
            disabled={iniciando}
            style={{
              padding: '5px 11px', background: 'var(--blue)', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '0.74rem',
              fontWeight: 700, cursor: iniciando ? 'not-allowed' : 'pointer',
              opacity: iniciando ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            {iniciando ? '…' : 'Iniciar →'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── PacienteInactivoRow ────────────────────────────────────────────────────────
function PacienteInactivoRow({ pac, onContactar, onVerPaciente }: {
  pac: PacienteInactivo
  onContactar: () => void
  onVerPaciente: () => void
}) {
  const critico = pac.dias_sin_sesion >= 14
  const diasLabel = pac.dias_sin_sesion >= 999
    ? 'Nunca ha tenido sesión'
    : `Sin sesión hace ${pac.dias_sin_sesion} día${pac.dias_sin_sesion !== 1 ? 's' : ''}`

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '11px',
      padding: '10px 12px', borderRadius: '10px',
      background: critico ? '#fff5f5' : '#fff9f9',
      border: `1px solid ${critico ? '#fca5a5' : '#fde8e8'}`,
    }}>
      <Avatar nombre={pac.nombre} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          onClick={onVerPaciente}
          style={{
            fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            textAlign: 'left', width: '100%',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {pac.nombre}
        </button>
        <div style={{
          fontSize: '0.74rem', marginTop: '1px',
          color: critico ? '#b91c1c' : '#c0392b',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: critico ? '#ef4444' : '#f87171', display: 'inline-block', flexShrink: 0 }} />
          {diasLabel}
          {pac.ultima_fecha && (
            <span style={{ opacity: 0.6, fontWeight: 400 }}>
              · última: {new Date(pac.ultima_fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onContactar}
        style={{
          background: 'none', border: '1.5px solid var(--blue)',
          color: 'var(--blue)', borderRadius: '8px', padding: '5px 11px',
          fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        💬 Contactar
      </button>
    </div>
  )
}

// ── ProximaCitaCard ────────────────────────────────────────────────────────────
function ProximaCitaCard({ cita, iniciando, onIniciar, onVerPerfil, onVerDetalle }: {
  cita: CitaHoy | null
  iniciando: boolean
  onIniciar: () => void
  onVerPerfil: () => void
  onVerDetalle: () => void
}) {
  return (
    <div className="dash-note-card">
      <div className="dash-card-title" style={{ marginBottom: '14px' }}>🕐 Próxima cita</div>
      {cita ? (
        <>
          <div
            onClick={onVerDetalle}
            style={{
              display: 'flex', alignItems: 'center', gap: '13px',
              padding: '13px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(75,179,214,0.2)',
              cursor: 'pointer',
            }}
          >
            {/* Bloque hora grande */}
            <div style={{
              width: '54px', height: '54px', borderRadius: '12px',
              background: 'var(--blue)', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
            }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, lineHeight: 1 }}>{cita.hora_inicio.slice(0, 2)}</span>
              <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>:{cita.hora_inicio.slice(3, 5)}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cita.paciente_nombre}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-mid)', marginTop: '3px' }}>{cita.motivo_cita}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: '2px' }}>
                {cita.hora_inicio} – {cita.hora_fin} hrs
              </div>
            </div>
            <EstadoBadge estado={cita.estado_cita} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '11px' }}>
            <button
              onClick={onIniciar}
              disabled={iniciando || cita.estado_cita === 'completada'}
              style={{
                flex: 1, padding: '10px',
                background: cita.estado_cita === 'completada' ? 'var(--border)' : 'var(--blue)',
                color: '#fff', border: 'none', borderRadius: '10px',
                fontWeight: 700, fontSize: '0.84rem', cursor: iniciando ? 'not-allowed' : 'pointer',
                opacity: iniciando ? 0.7 : 1, transition: 'opacity .15s',
              }}
            >
              {iniciando ? 'Iniciando…' : cita.estado_cita === 'completada' ? 'Ya completada' : 'Iniciar consulta →'}
            </button>
            <button
              onClick={onVerPerfil}
              style={{
                padding: '10px 14px', background: 'none',
                border: '1.5px solid var(--blue)', color: 'var(--blue)',
                borderRadius: '10px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer',
              }}
            >
              Perfil
            </button>
          </div>
        </>
      ) : (
        <EmptyState icon="🎉" texto="Sin más citas pendientes hoy" />
      )}
    </div>
  )
}

// ── NavLinkBtn — botón tipo link para títulos de cards ───────────────────────
function NavLinkBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        marginLeft: 'auto',
        background: 'none',
        border: 'none',
        padding: '3px 8px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.74rem',
        fontWeight: 600,
        color: 'var(--blue)',
        opacity: hov ? 1 : 0.7,
        textDecoration: 'none',
        transition: 'opacity .15s, background .15s',
        backgroundColor: hov ? 'rgba(59,130,246,0.08)' : 'transparent',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
      }}
    >
      {label}
      <span style={{ fontSize: '0.8rem' }}>→</span>
    </button>
  )
}

// ── QuickAccessCard — tarjeta de acceso rápido con color e ícono ──────────────
function QuickAccessCard({ icon, label, sub, color, onClick }: {
  icon: string
  label: string
  sub: string
  color: string
  onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  // Derivar versión clara del color para el fondo
  const bgAlpha = hov ? '18%' : '10%'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '16px 14px',
        borderRadius: '14px',
        border: `1.5px solid ${hov ? color : 'var(--border)'}`,
        background: hov
          ? `color-mix(in srgb, ${color} 12%, transparent)`
          : 'var(--bg)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '10px',
        transition: 'border-color .18s, background .18s, transform .18s',
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {/* Ícono con fondo coloreado */}
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        background: `color-mix(in srgb, ${color} ${bgAlpha}, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        transition: 'background .18s',
      }}>
        {icon}
      </div>
      {/* Texto */}
      <div>
        <div style={{
          fontSize: '0.84rem',
          fontWeight: 700,
          color: hov ? color : 'var(--text)',
          transition: 'color .18s',
          lineHeight: 1.2,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: '0.72rem',
          color: 'var(--text-light)',
          marginTop: '2px',
          fontWeight: 400,
        }}>
          {sub}
        </div>
      </div>
    </button>
  )
}

// ── SemanaSummary ─────────────────────────────────────────────────────────────
function SemanaSummary({ semana }: { semana: DiaResumen[] }) {
  const [hovIdx, setHovIdx] = useState<number | null>(null)
  const hoyIdx     = (new Date().getDay() + 6) % 7
  const max        = Math.max(...semana.map(s => s.citas), 1)
  const totalSemana = semana.reduce((acc, s) => acc + s.citas, 0)

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: '14px', fontSize: '0.8rem', color: 'var(--text-light)',
      }}>
        <span>
          <strong style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800 }}>{totalSemana}</strong>
          {' '}citas esta semana
        </span>
        <span style={{ fontSize: '0.75rem' }}>
          {semana[hoyIdx]?.citas ?? 0} hoy
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '72px', position: 'relative' }}>
        {semana.map((s, i) => {
          const isHoy   = i === hoyIdx
          const isPast  = i < hoyIdx
          const isFut   = i > hoyIdx
          const altura  = s.citas > 0 ? Math.max(18, (s.citas / max) * 62) : 7
          const isHov   = hovIdx === i

          let barBg = 'var(--border)'
          if (s.citas > 0) {
            if (isHoy)        barBg = 'var(--blue)'
            else if (isPast)  barBg = 'var(--blue-light, #93c5fd)'
            else              barBg = 'var(--blue-xlight, #dbeafe)'
          }

          return (
            <div
              key={s.dia}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}
              onMouseEnter={() => setHovIdx(i)}
              onMouseLeave={() => setHovIdx(null)}
            >
              {/* Tooltip */}
              {isHov && (
                <div style={{
                  position: 'absolute', bottom: '80px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--text)', color: 'var(--bg)',
                  padding: '4px 8px', borderRadius: '6px',
                  fontSize: '0.7rem', fontWeight: 700,
                  whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,.15)',
                }}>
                  {s.citas} cita{s.citas !== 1 ? 's' : ''}
                  <span style={{ opacity: 0.65, fontWeight: 400, marginLeft: 4 }}>
                    {new Date(s.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )}

              <div style={{
                width: '100%', height: `${altura}px`, borderRadius: '5px',
                background: barBg,
                opacity: isPast ? 0.6 : isFut && s.citas === 0 ? 0.4 : 1,
                transition: 'height .3s, background .3s',
                cursor: 'default',
                outline: isHoy ? '2px solid var(--blue)' : 'none',
                outlineOffset: '2px',
              }} />

              <span style={{
                fontSize: '0.63rem',
                color: isHoy ? 'var(--blue)' : 'var(--text-light)',
                fontWeight: isHoy ? 800 : 500,
              }}>
                {s.dia}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CitaDetalleModal ────────────────────────────────────────────────────────────
function CitaDetalleModal({ cita, iniciando, onIniciar, onCompletar, onVerPaciente, onClose }: {
  cita: CitaHoy
  iniciando: boolean
  onIniciar: () => void
  onCompletar: () => void
  onVerPaciente: () => void
  onClose: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const esCompletada = cita.estado_cita === 'completada'
  const esCancelada  = cita.estado_cita === 'cancelada'

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div style={{
        background: 'var(--bg, #fff)', borderRadius: '18px',
        width: '100%', maxWidth: '440px',
        boxShadow: '0 20px 60px rgba(0,0,0,.2)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--blue)', padding: '20px 22px',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
        }}>
          <div style={{
            width: 58, height: 58, borderRadius: '14px',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0,
          }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, lineHeight: 1 }}>{cita.hora_inicio.slice(0, 2)}</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>:{cita.hora_inicio.slice(3, 5)}</span>
          </div>
          <div style={{ flex: 1, color: '#fff' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{cita.paciente_nombre}</div>
            <div style={{ fontSize: '0.82rem', opacity: 0.85, marginTop: '3px' }}>{cita.motivo_cita}</div>
            <div style={{ fontSize: '0.76rem', opacity: 0.7, marginTop: '2px' }}>{cita.hora_inicio} – {cita.hora_fin} hrs</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
              width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
              fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Estado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>Estado</span>
            <EstadoBadge estado={cita.estado_cita} />
          </div>

          {/* Notas */}
          {cita.notas_cita && (
            <div style={{
              padding: '12px 14px', background: 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: '10px',
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Notas de cita
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.5 }}>
                {cita.notas_cita}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!esCompletada && !esCancelada && (
              <button
                onClick={onIniciar}
                disabled={iniciando}
                style={{
                  width: '100%', padding: '11px',
                  background: 'var(--blue)', color: '#fff', border: 'none',
                  borderRadius: '10px', fontWeight: 700, fontSize: '0.87rem',
                  cursor: iniciando ? 'not-allowed' : 'pointer', opacity: iniciando ? 0.7 : 1,
                }}
              >
                {iniciando ? 'Iniciando…' : '▶ Iniciar consulta'}
              </button>
            )}
            {!esCompletada && !esCancelada && (
              <button
                onClick={onCompletar}
                style={{
                  width: '100%', padding: '11px',
                  background: 'none', color: '#166534',
                  border: '1.5px solid #22c55e', borderRadius: '10px',
                  fontWeight: 700, fontSize: '0.87rem', cursor: 'pointer',
                }}
              >
                ✓ Marcar como completada
              </button>
            )}
            <button
              onClick={onVerPaciente}
              style={{
                width: '100%', padding: '11px',
                background: 'none', color: 'var(--text-mid)',
                border: '1px solid var(--border)', borderRadius: '10px',
                fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer',
              }}
            >
              Ver expediente del paciente →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
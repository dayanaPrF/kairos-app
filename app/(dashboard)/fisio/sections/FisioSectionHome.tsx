'use client'

import { useEffect, useState, useCallback } from 'react'
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

interface PacienteLista {
  id_paciente: string
  nombre: string
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
  pacientes: PacienteLista[]
  proximaCita: CitaHoy | null
  semana: DiaResumen[]
  loading: boolean
  error: string | null
}

export interface FisioSectionHomeProps {
  onNavigate?: (section: string, params?: Record<string, string>) => void
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

const ESTADO_CFG: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
  confirmada: { bg: '#f0fdf4', fg: '#166534', dot: '#22c55e', label: 'Confirmada' },
  pendiente:  { bg: '#fffbeb', fg: '#92400e', dot: '#f59e0b', label: 'Pendiente'  },
  completada: { bg: '#eff6ff', fg: '#1e40af', dot: '#3b82f6', label: 'Completada' },
  cancelada:  { bg: '#fef2f2', fg: '#991b1b', dot: '#ef4444', label: 'Cancelada'  },
  en_curso:   { bg: '#f0f9ff', fg: '#0c4a6e', dot: '#0ea5e9', label: 'En curso'   },
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function getHoyISO() { return new Date().toISOString().split('T')[0] }
function getHoraActual() { return new Date().toTimeString().slice(0, 5) }
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
    pacientes: [], proximaCita: null, semana: [], loading: true, error: null,
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

        const [{ data: perfil }, { data: relPacs }] = await Promise.all([
          supabase.from('perfil').select('nombre, primer_apellido').eq('id_perfil', fisioId).maybeSingle(),
          supabase.from('paciente_fisioterapeuta').select('id_paciente').eq('id_fisioterapeuta', fisioId).is('deleted_at', null),
        ])

        const nombreFisio = [perfil?.nombre, perfil?.primer_apellido].filter(Boolean).join(' ')
        const pacIds = relPacs?.map(r => r.id_paciente) ?? []

        let pacientes: PacienteLista[] = []
        if (pacIds.length) {
          const { data: perfs } = await supabase.from('perfil').select('id_perfil, nombre, primer_apellido').in('id_perfil', pacIds)
          pacientes = (perfs ?? []).map(p => ({
            id_paciente: p.id_perfil,
            nombre: `${p.nombre} ${p.primer_apellido}`.trim()
          }))
        }

        const lunes = getLunes()
        const domISO = (() => { const d = new Date(lunes); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0] })()

        const [{ data: citasRaw }, { data: citasSemana }] = await Promise.all([
          supabase.from('cita').select('*').eq('id_fisioterapeuta', fisioId).eq('fecha_cita', isoHoy).neq('estado_cita', 'cancelada').order('hora_inicio', { ascending: true }),
          supabase.from('cita').select('fecha_cita').eq('id_fisioterapeuta', fisioId).gte('fecha_cita', lunes.toISOString().split('T')[0]).lte('fecha_cita', domISO).neq('estado_cita', 'cancelada'),
        ])

        const mapaP = Object.fromEntries(pacientes.map(p => [p.id_paciente, p.nombre]))
        const citasHoy: CitaHoy[] = (citasRaw ?? []).map(c => ({
          id_cita: c.id_cita,
          id_paciente: c.id_paciente,
          hora_inicio: c.hora_inicio?.slice(0, 5) ?? '',
          hora_fin: c.hora_fin?.slice(0, 5) ?? '',
          motivo_cita: c.motivo_cita ?? 'Consulta',
          estado_cita: c.estado_cita,
          paciente_nombre: mapaP[c.id_paciente] || 'Paciente',
          notas_cita: c.notas_cita
        }))

        const semana = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(lunes); d.setDate(lunes.getDate() + i); const iso = d.toISOString().split('T')[0]
          return { dia: DIAS_CORTOS[i], fecha: iso, citas: (citasSemana ?? []).filter(c => c.fecha_cita === iso).length }
        })

        const horaActual = getHoraActual()
        const proxima = citasHoy.find(c => c.estado_cita === 'en_curso') || citasHoy.find(c => c.estado_cita !== 'completada' && c.hora_inicio >= horaActual) || citasHoy.find(c => c.estado_cita !== 'completada') || null

        if (!cancelled) {
          setData({ fisioId, nombreFisio, totalPacientes: pacIds.length, citasHoy, pacientes, proximaCita: proxima, semana, loading: false, error: null })
        }
      } catch (err: any) {
        if (!cancelled) setData(prev => ({ ...prev, loading: false, error: err.message }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [tick])
  return { ...data, refresh }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function FisioSectionHome({ onNavigate }: FisioSectionHomeProps) {
  const { nombreFisio, totalPacientes, citasHoy, pacientes, proximaCita, semana, loading, error, refresh } = useFisioHomeData()
  const [iniciando, setIniciando] = useState<string | null>(null)
  const [finalizando, setFinalizando] = useState(false)
  const [citaDetalle, setCitaDetalle] = useState<CitaHoy | null>(null)
  const [consultaActiva, setConsultaActiva] = useState<CitaHoy | null>(null)
  const [notasConsulta, setNotasConsulta] = useState('')
  const [accionError, setAccionError] = useState<string | null>(null)

  const navigate = useCallback((section: string, params?: Record<string, string>) => onNavigate?.(section, params), [onNavigate])

  useEffect(() => {
    const citaEnCurso = citasHoy.find(c => c.estado_cita === 'en_curso')
    if (citaEnCurso && !consultaActiva) {
      setConsultaActiva(citaEnCurso)
      setNotasConsulta(citaEnCurso.notas_cita ?? '')
    }
    if (!citaEnCurso && consultaActiva && consultaActiva.estado_cita === 'completada') {
      setConsultaActiva(null)
      setNotasConsulta('')
    }
  }, [citasHoy, consultaActiva])

  const handleIniciarConsulta = useCallback(async (cita: CitaHoy) => {
    setAccionError(null)
    setIniciando(cita.id_cita)

    try {
      if (cita.estado_cita !== 'en_curso') {
        const { error } = await supabase
          .from('cita')
          .update({ estado_cita: 'en_curso', updated_at: new Date().toISOString() })
          .eq('id_cita', cita.id_cita)

        if (error) throw error
      }

      const citaEnCurso = { ...cita, estado_cita: 'en_curso' }
      setConsultaActiva(citaEnCurso)
      setNotasConsulta(cita.notas_cita ?? '')
      setCitaDetalle(null)
      refresh()
    } catch (err: any) {
      setAccionError(err?.message ?? 'No se pudo iniciar la consulta.')
    } finally {
      setIniciando(null)
    }
  }, [refresh])

  const handleFinalizarConsulta = useCallback(async () => {
    if (!consultaActiva) return
    setAccionError(null)
    setFinalizando(true)

    try {
      const { error } = await supabase
        .from('cita')
        .update({
          estado_cita: 'completada',
          notas_cita: notasConsulta,
          updated_at: new Date().toISOString(),
        })
        .eq('id_cita', consultaActiva.id_cita)

      if (error) throw error

      setConsultaActiva(null)
      setNotasConsulta('')
      setCitaDetalle(null)
      refresh()
    } catch (err: any) {
      setAccionError(err?.message ?? 'No se pudo finalizar la cita.')
    } finally {
      setFinalizando(false)
    }
  }, [consultaActiva, notasConsulta, refresh])

  const handleFinalizarDesdeModal = useCallback(async (notas: string) => {
    if (!citaDetalle) return
    setConsultaActiva(citaDetalle)
    setNotasConsulta(notas)

    setAccionError(null)
    setFinalizando(true)
    try {
      const { error } = await supabase
        .from('cita')
        .update({ estado_cita: 'completada', notas_cita: notas, updated_at: new Date().toISOString() })
        .eq('id_cita', citaDetalle.id_cita)

      if (error) throw error
      setCitaDetalle(null)
      setConsultaActiva(null)
      setNotasConsulta('')
      refresh()
    } catch (err: any) {
      setAccionError(err?.message ?? 'No se pudo finalizar la cita.')
    } finally {
      setFinalizando(false)
    }
  }, [citaDetalle, refresh])

  if (loading) return <HomeSkeletonLoader />

  const hoy = new Date()

  return (
    <>
      {citaDetalle && (
        <CitaDetalleModal
          cita={citaDetalle}
          iniciando={iniciando === citaDetalle.id_cita}
          finalizando={finalizando}
          onIniciar={() => handleIniciarConsulta(citaDetalle)}
          onFinalizar={(notas: string) => handleFinalizarDesdeModal(notas)}
          onVerPaciente={() => { setCitaDetalle(null); navigate('pacientes', { id_paciente: citaDetalle.id_paciente }) }}
          onClose={() => setCitaDetalle(null)}
        />
      )}

      <div className="fisio-home-wrap">
        <div className="dash-hero" style={{ marginBottom: '20px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', marginBottom: '8px' }}>Panel del día</div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 8px' }}>
              {DIAS_SEMANA[hoy.getDay()]} {hoy.getDate()} de {MESES[hoy.getMonth()]} — ¡Buen día, Dr. {nombreFisio.split(' ')[0]}!
            </h2>
            <p style={{ opacity: 0.85, fontSize: '0.87rem', margin: 0 }}>
              {citasHoy.length > 0 ? `Tienes ${citasHoy.length} citas programadas hoy.` : 'No tienes citas programadas para hoy.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <StatPill label="Pacientes" value={totalPacientes} icon="🧑‍🦽" />
            <StatPill label="Citas hoy" value={citasHoy.length} icon="📅" accent />
          </div>
        </div>

        {(error || accionError) && <ErrorNotice texto={accionError || error || ''} />}

        {consultaActiva && (
          <ConsultaActivaPanel
            cita={consultaActiva}
            notas={notasConsulta}
            onNotasChange={setNotasConsulta}
            onFinalizar={handleFinalizarConsulta}
            finalizando={finalizando}
            onVerPaciente={() => navigate('pacientes', { id_paciente: consultaActiva.id_paciente })}
          />
        )}

        <div className="fisio-home-grid">
          {/* COLUMNA IZQUIERDA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="dash-card">
              <div className="dash-card-title">📅 Agenda de hoy <NavLinkBtn label="Ver todo" onClick={() => navigate('agenda')} /></div>
              {citasHoy.length === 0 ? <EmptyState icon="📭" texto="Sin citas para hoy" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {citasHoy.map(c => (
                    <CitaRow
                      key={c.id_cita}
                      cita={c}
                      esProxima={proximaCita?.id_cita === c.id_cita}
                      iniciando={iniciando === c.id_cita}
                      onClickDetalle={() => setCitaDetalle(c)}
                      onIniciar={() => handleIniciarConsulta(c)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="dash-card">
              <div className="dash-card-title">👥 Mis Pacientes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pacientes.map(p => (
                  <PacienteSimpleRow
                    key={p.id_paciente}
                    pac={p}
                    onContactar={() => navigate('mensajes', { id_paciente: p.id_paciente })}
                    onVer={() => navigate('pacientes', { id_paciente: p.id_paciente })}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ProximaCitaCard
              cita={proximaCita}
              iniciando={iniciando === proximaCita?.id_cita}
              onIniciar={() => proximaCita && handleIniciarConsulta(proximaCita)}
              onVerPerfil={() => proximaCita && navigate('pacientes', { id_paciente: proximaCita.id_paciente })}
              onVerDetalle={() => proximaCita && setCitaDetalle(proximaCita)}
            />

            <div className="dash-card">
              <div className="dash-card-title">📆 Esta semana</div>
              <SemanaSummary semana={semana} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '16px' }}>
          <QuickAccessCard icon="🧑‍🦽" label="Nuevo paciente" sub="Registrar" color="#4b7bec" onClick={() => navigate('pacientes')} />
          <QuickAccessCard icon="📅" label="Agendar cita" sub="Calendario" color="#26de81" onClick={() => navigate('agenda')} />
          <QuickAccessCard icon="🏋️" label="Crear rutina" sub="Ejercicios" color="#fd9644" onClick={() => navigate('rutinas')} />
          <QuickAccessCard icon="💬" label="Mensajes" sub="Chat" color="#a55eea" onClick={() => navigate('mensajes')} />
        </div>
      </div>
    </>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function ConsultaActivaPanel({ cita, notas, onNotasChange, onFinalizar, finalizando, onVerPaciente }: any) {
  return (
    <div style={{ marginBottom: '18px', borderRadius: '18px', border: '1.5px solid #0ea5e9', background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)', boxShadow: '0 12px 30px rgba(14, 165, 233, 0.12)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Consulta en curso</div>
          <h3 style={{ margin: '4px 0 0', fontSize: '1.18rem', fontWeight: 900, color: '#0f172a' }}>{cita.paciente_nombre}</h3>
          <div style={{ marginTop: '4px', fontSize: '0.84rem', color: '#475569' }}>{cita.hora_inicio} - {cita.hora_fin} · {cita.motivo_cita}</div>
        </div>
        <EstadoBadge estado="en_curso" />
      </div>

      <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: '16px', alignItems: 'stretch' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>Notas de la consulta</label>
          <textarea
            value={notas}
            onChange={(e) => onNotasChange(e.target.value)}
            placeholder="Escribe aquí la evolución, observaciones, ejercicios indicados o recomendaciones para el paciente."
            style={{ width: '100%', minHeight: '150px', padding: '14px', borderRadius: '14px', border: '1.5px solid #cbd5e1', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.92rem', lineHeight: 1.5, outline: 'none', background: '#fff' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onVerPaciente} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: '#fff', color: '#2563eb', border: '1.5px solid #2563eb', fontWeight: 800, cursor: 'pointer' }}>
            Ver paciente
          </button>
          <button onClick={onFinalizar} disabled={finalizando} style={{ width: '100%', padding: '13px', borderRadius: '12px', background: '#10b981', color: '#fff', border: 'none', fontWeight: 900, cursor: finalizando ? 'not-allowed' : 'pointer', opacity: finalizando ? 0.7 : 1 }}>
            {finalizando ? 'Finalizando...' : 'Finalizar cita'}
          </button>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4 }}>
            Al finalizar se guardarán las notas en <strong>notas_cita</strong> y la cita pasará a <strong>completada</strong>.
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorNotice({ texto }: { texto: string }) {
  return (
    <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '12px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 700, fontSize: '0.85rem' }}>
      {texto}
    </div>
  )
}

function StatPill({ label, value, icon, accent }: any) {
  return (
    <div style={{ background: accent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: '14px', padding: '13px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '86px' }}>
      <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      <span style={{ fontSize: '1.55rem', fontWeight: 900, color: '#fff' }}>{value}</span>
      <span style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.82)' }}>{label}</span>
    </div>
  )
}

function PacienteSimpleRow({ pac, onContactar, onVer }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
      <Avatar nombre={pac.nombre} size={36} />
      <div style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }} onClick={onVer}>{pac.nombre}</div>
      <button onClick={onContactar} style={{ background: 'none', border: '1.5px solid var(--blue)', color: 'var(--blue)', borderRadius: '8px', padding: '5px 11px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>💬 Mensaje</button>
    </div>
  )
}

function CitaRow({ cita, esProxima, iniciando, onClickDetalle, onIniciar }: any) {
  const esCompletada = cita.estado_cita === 'completada'
  const esEnCurso = cita.estado_cita === 'en_curso'

  return (
    <div onClick={onClickDetalle} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 13px', borderRadius: '11px', background: esEnCurso ? '#f0f9ff' : esProxima ? '#eff6ff' : 'var(--bg)', border: `1px solid ${esEnCurso ? '#0ea5e9' : esProxima ? '#3b82f6' : 'var(--border)'}`, cursor: 'pointer', opacity: esCompletada ? 0.6 : 1 }}>
      <div style={{ minWidth: '50px', textAlign: 'center', background: esCompletada ? '#ccc' : esEnCurso ? '#0ea5e9' : '#3b82f6', borderRadius: '8px', padding: '7px 4px', color: '#fff' }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 900 }}>{cita.hora_inicio}</div>
      </div>
      <Avatar nombre={cita.paciente_nombre} size={32} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.87rem' }}>{cita.paciente_nombre}</div>
        <div style={{ fontSize: '0.75rem', color: '#666' }}>{cita.motivo_cita}</div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <EstadoBadge estado={cita.estado_cita} />
        {(esProxima || esEnCurso) && !esCompletada && (
          <button onClick={(e) => { e.stopPropagation(); onIniciar() }} style={{ padding: '5px 11px', background: esEnCurso ? '#0ea5e9' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
            {iniciando ? '...' : esEnCurso ? 'Continuar' : 'Iniciar'}
          </button>
        )}
      </div>
    </div>
  )
}

function ProximaCitaCard({ cita, iniciando, onIniciar, onVerPerfil, onVerDetalle }: any) {
  const esEnCurso = cita?.estado_cita === 'en_curso'

  return (
    <div className="dash-note-card">
      <div className="dash-card-title" style={{ marginBottom: '14px' }}>🕐 Próxima cita</div>
      {cita ? (
        <>
          <div onClick={onVerDetalle} style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '13px', borderRadius: '12px', background: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: esEnCurso ? '#0ea5e9' : '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{cita.hora_inicio}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{cita.paciente_nombre}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{cita.motivo_cita}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '11px' }}>
            <button onClick={onIniciar} disabled={iniciando} style={{ flex: 1, padding: '10px', background: esEnCurso ? '#0ea5e9' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: iniciando ? 'not-allowed' : 'pointer', opacity: iniciando ? 0.7 : 1 }}>{iniciando ? 'Iniciando...' : esEnCurso ? 'Continuar consulta' : 'Iniciar consulta'}</button>
            <button onClick={onVerPerfil} style={{ padding: '10px', background: 'none', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '10px', fontWeight: 700 }}>Perfil</button>
          </div>
        </>
      ) : <EmptyState icon="🎉" texto="Sin citas pendientes" />}
    </div>
  )
}

function QuickAccessCard({ icon, label, sub, color, onClick }: any) {
  return (
    <button onClick={onClick} style={{ padding: '16px', borderRadius: '14px', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ width: '35px', height: '35px', borderRadius: '8px', background: `${color}22`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '10px' }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{label}</div>
      <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{sub}</div>
    </button>
  )
}

function SemanaSummary({ semana }: { semana: DiaResumen[] }) {
  const max = Math.max(...semana.map(s => s.citas), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '60px', marginTop: '10px' }}>
      {semana.map(s => (
        <div key={s.fecha} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '100%', height: `${(s.citas / max) * 40}px`, background: s.citas > 0 ? '#3b82f6' : '#eee', borderRadius: '4px' }} />
          <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{s.dia}</span>
        </div>
      ))}
    </div>
  )
}

function Avatar({ nombre, size = 36 }: any) {
  const initials = nombre.split(' ').map((n:any)=>n[0]).join('').toUpperCase().slice(0,2)
  return <div style={{ width: size, height: size, borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>{initials}</div>
}

function EstadoBadge({ estado }: any) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.pendiente
  return <span style={{ background: cfg.bg, color: cfg.fg, padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700 }}>{cfg.label}</span>
}

function NavLinkBtn({ label, onClick }: any) {
  return <button onClick={onClick} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>{label} →</button>
}

function EmptyState({ icon, texto }: any) {
  return <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}><div>{icon}</div>{texto}</div>
}

function HomeSkeletonLoader() { return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div> }

// ─── Modal de detalle ─────────────────────────────────────────────────────────
function CitaDetalleModal({ cita, onClose, onIniciar, onFinalizar, iniciando, finalizando }: any) {
  const [notas, setNotas] = useState(cita.notas_cita || '')
  const esCompletada = cita.estado_cita === 'completada'
  const esEnCurso = cita.estado_cita === 'en_curso'

  const handleFinalizar = async () => {
    await onFinalizar(notas)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '20px', width: '420px', maxWidth: 'calc(100vw - 32px)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Gestionar cita</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
          <p style={{ margin: '4px 0' }}><strong>Paciente:</strong> {cita.paciente_nombre}</p>
          <p style={{ margin: '4px 0' }}><strong>Motivo:</strong> {cita.motivo_cita}</p>
          <p style={{ margin: '4px 0' }}><strong>Horario:</strong> {cita.hora_inicio} - {cita.hora_fin}</p>
          <EstadoBadge estado={cita.estado_cita} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: '#666' }}>NOTAS DE LA CONSULTA</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Escribe las observaciones aquí..."
            style={{ width: '100%', height: '110px', padding: '12px', borderRadius: '12px', border: '1.5px solid #eee', resize: 'none', fontFamily: 'inherit', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!esCompletada && (
            <>
              <button
                onClick={onIniciar}
                disabled={iniciando}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: esEnCurso ? '#0ea5e9' : '#3b82f6', color: '#fff', border: 'none', fontWeight: 700, cursor: iniciando ? 'not-allowed' : 'pointer', opacity: iniciando ? 0.7 : 1 }}
              >
                {iniciando ? 'Abriendo...' : esEnCurso ? 'Continuar consulta' : 'Iniciar consulta'}
              </button>
              <button
                onClick={handleFinalizar}
                disabled={finalizando}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, cursor: finalizando ? 'not-allowed' : 'pointer', opacity: finalizando ? 0.7 : 1 }}
              >
                {finalizando ? 'Guardando...' : 'Finalizar cita'}
              </button>
            </>
          )}
          <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #eee', color: '#666', fontWeight: 600, cursor: 'pointer' }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Cita {
  id_cita: string
  fecha_cita: string
  hora_inicio: string
  hora_fin: string
  motivo_cita: string
  estado_cita: string
  notas_cita: string | null
  id_paciente: string
  id_clinica: string | null
  paciente_nombre: string
  clinica_nombre: string
}

interface Clinica {
  id_clinica: string
  nombre_clinica: string
}

interface Paciente {
  id_paciente: string
  nombre_completo: string
}

interface HorarioAtencion {
  id_horario_atencion: string
  dia_semana: number   // 0=Dom … 6=Sáb
  hora_inicio: string
  hora_cierre: string
  id_clinica: string | null
  clinica_nombre: string
}

type Vista = 'semana' | 'mes'
type ModalMode = 'nueva' | 'editar' | 'horario' | null

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_HORARIO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function isoHoy() { return new Date().toISOString().split('T')[0] }

function fmtHora(h: string) { return h?.slice(0, 5) ?? '' }

function lunesDe(fecha: Date) {
  const d = new Date(fecha)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDias(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date) { return d.toISOString().split('T')[0] }

function estadoStyle(estado: string): { bg: string; color: string; label: string } {
  const m: Record<string, { bg: string; color: string; label: string }> = {
    confirmada: { bg: '#eef8d6', color: '#5a9216', label: 'Confirmada' },
    pendiente:  { bg: '#fff3cd', color: '#856404', label: 'Pendiente'  },
    completada: { bg: '#e4f5fb', color: '#1a6090', label: 'Completada' },
    cancelada:  { bg: '#fde8e8', color: '#c0392b', label: 'Cancelada'  },
  }
  return m[estado?.toLowerCase()] ?? { bg: '#f0f0f0', color: '#666', label: estado ?? '—' }
}

// ─── Hook datos ───────────────────────────────────────────────────────────────
function useAgendaData() {
  const [citas, setCitas]           = useState<Cita[]>([])
  const [clinicas, setClinicas]     = useState<Clinica[]>([])
  const [pacientes, setPacientes]   = useState<Paciente[]>([])
  const [horarios, setHorarios]     = useState<HorarioAtencion[]>([])
  const [fisioId, setFisioId]       = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)

  const cargarCitas = useCallback(async (uid: string) => {
    // Citas de los próximos 60 días y últimos 30
    const desde = toISO(addDias(new Date(), -30))
    const hasta = toISO(addDias(new Date(), 60))

    const { data: citasRaw } = await supabase
      .from('cita')
      .select('id_cita, fecha_cita, hora_inicio, hora_fin, motivo_cita, estado_cita, notas_cita, id_paciente, id_clinica')
      .eq('id_fisioterapeuta', uid)
      .gte('fecha_cita', desde)
      .lte('fecha_cita', hasta)
      .order('fecha_cita', { ascending: true })
      .order('hora_inicio', { ascending: true })

    if (!citasRaw?.length) { setCitas([]); return }

    // Nombres de pacientes
    const pacIds = [...new Set(citasRaw.map(c => c.id_paciente))]
    const { data: perfiles } = await supabase
      .from('perfil')
      .select('id_perfil, nombre, primer_apellido')
      .in('id_perfil', pacIds)

    const mapaP = Object.fromEntries(
      (perfiles ?? []).map(p => [p.id_perfil, `${p.nombre} ${p.primer_apellido}`])
    )

    // Nombres de clínicas
    const clinIds = [...new Set(citasRaw.map(c => c.id_clinica).filter(Boolean))]
    let mapaC: Record<string, string> = {}
    if (clinIds.length) {
      const { data: cls } = await supabase
        .from('clinica')
        .select('id_clinica, nombre_clinica')
        .in('id_clinica', clinIds)
      mapaC = Object.fromEntries((cls ?? []).map(c => [c.id_clinica, c.nombre_clinica]))
    }

    setCitas(citasRaw.map(c => ({
      ...c,
      hora_inicio:     fmtHora(c.hora_inicio),
      hora_fin:        fmtHora(c.hora_fin),
      paciente_nombre: mapaP[c.id_paciente]   ?? 'Paciente',
      clinica_nombre:  mapaC[c.id_clinica ?? ''] ?? 'Sin clínica',
    })))
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setFisioId(user.id)

      // Clínicas del fisio
      const { data: relClin } = await supabase
        .from('clinica_fisioterapeuta')
        .select('clinica(id_clinica, nombre_clinica)')
        .eq('id_fisioterapeuta', user.id)

      const cls: Clinica[] = (relClin ?? [])
        .map(r => (r.clinica as any))
        .filter(Boolean)
      setClinicas(cls)

      // Pacientes asignados
      const { data: relPac } = await supabase
        .from('paciente_fisioterapeuta')
        .select('id_paciente')
        .eq('id_fisioterapeuta', user.id)
        .is('deleted_at', null)

      const pacIds = (relPac ?? []).map(r => r.id_paciente)
      if (pacIds.length) {
        const { data: perfs } = await supabase
          .from('perfil')
          .select('id_perfil, nombre, primer_apellido')
          .in('id_perfil', pacIds)
        setPacientes((perfs ?? []).map(p => ({
          id_paciente: p.id_perfil,
          nombre_completo: `${p.nombre} ${p.primer_apellido}`,
        })))
      }

      // Horarios de atención
      const { data: hors } = await supabase
        .from('horario_atencion')
        .select('id_horario_atencion, dia_semana, hora_inicio, hora_cierre, id_clinica, clinica(nombre_clinica)')
        .eq('id_fisioterapeuta', user.id)
        .is('deleted_at', null)

      setHorarios((hors ?? []).map(h => ({
        ...h,
        hora_inicio:   fmtHora(h.hora_inicio),
        hora_cierre:   fmtHora(h.hora_cierre),
        clinica_nombre: (h.clinica as any)?.nombre_clinica ?? 'Sin clínica',
      })))

      await cargarCitas(user.id)
      setLoading(false)
    }
    init()
  }, [cargarCitas])

  const recargar = useCallback(async () => {
    if (fisioId) await cargarCitas(fisioId)
  }, [fisioId, cargarCitas])

  return { citas, clinicas, pacientes, horarios, fisioId, loading, recargar, setHorarios }
}

// ─── Formulario empty ─────────────────────────────────────────────────────────
const emptyCita = () => ({
  id_cita:        '',
  fecha_cita:     isoHoy(),
  hora_inicio:    '10:00',
  hora_fin:       '11:00',
  motivo_cita:    '',
  estado_cita:    'pendiente',
  notas_cita:     '',
  id_paciente:    '',
  id_clinica:     '',
})

const emptyHorario = () => ({
  id_horario_atencion: '',
  dia_semana:  1,
  hora_inicio: '09:00',
  hora_cierre: '18:00',
  id_clinica:  '',
})

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export function FisioSectionAgenda() {
  const { citas, clinicas, pacientes, horarios, fisioId, loading, recargar, setHorarios } = useAgendaData()
  const [vista, setVista]           = useState<Vista>('semana')
  const [semanaBase, setSemanaBase] = useState(() => lunesDe(new Date()))
  const [mesBase, setMesBase]       = useState(() => {
    const h = new Date(); return { anio: h.getFullYear(), mes: h.getMonth() }
  })
  const [modalMode, setModalMode]   = useState<ModalMode>(null)
  const [citaForm, setCitaForm]     = useState(emptyCita())
  const [horarioForm, setHorarioForm] = useState(emptyHorario())
  const [saving, setSaving]         = useState(false)
  const [msgError, setMsgError]     = useState<string | null>(null)
  const [citaDetalle, setCitaDetalle] = useState<Cita | null>(null)

  // ── Navegación ──────────────────────────────────────────────────────────────
  const prevSemana = () => setSemanaBase(d => addDias(d, -7))
  const nextSemana = () => setSemanaBase(d => addDias(d,  7))
  const prevMes    = () => setMesBase(m => m.mes === 0 ? { anio: m.anio - 1, mes: 11 } : { ...m, mes: m.mes - 1 })
  const nextMes    = () => setMesBase(m => m.mes === 11 ? { anio: m.anio + 1, mes: 0 } : { ...m, mes: m.mes + 1 })
  const irHoy      = () => { setSemanaBase(lunesDe(new Date())); setMesBase({ anio: new Date().getFullYear(), mes: new Date().getMonth() }) }

  // ── Modal nueva cita ────────────────────────────────────────────────────────
  const abrirNueva = (fecha?: string) => {
    setCitaForm({ ...emptyCita(), fecha_cita: fecha ?? isoHoy() })
    setModalMode('nueva')
    setMsgError(null)
  }

  const abrirEditar = (cita: Cita) => {
    setCitaForm({
      id_cita:     cita.id_cita,
      fecha_cita:  cita.fecha_cita,
      hora_inicio: cita.hora_inicio,
      hora_fin:    cita.hora_fin,
      motivo_cita: cita.motivo_cita,
      estado_cita: cita.estado_cita,
      notas_cita:  cita.notas_cita ?? '',
      id_paciente: cita.id_paciente,
      id_clinica:  cita.id_clinica ?? '',
    })
    setCitaDetalle(null)
    setModalMode('editar')
    setMsgError(null)
  }

  const guardarCita = async () => {
    if (!citaForm.id_paciente) { setMsgError('Selecciona un paciente'); return }
    if (!citaForm.motivo_cita.trim()) { setMsgError('El motivo es obligatorio'); return }
    setSaving(true); setMsgError(null)
    try {
      const payload: any = {
        fecha_cita:       citaForm.fecha_cita,
        hora_inicio:      citaForm.hora_inicio,
        hora_fin:         citaForm.hora_fin,
        motivo_cita:      citaForm.motivo_cita.trim(),
        estado_cita:      citaForm.estado_cita,
        notas_cita:       citaForm.notas_cita || null,
        id_paciente:      citaForm.id_paciente,
        id_fisioterapeuta: fisioId,
        id_clinica:       citaForm.id_clinica || null,
      }
      if (modalMode === 'editar') payload.id_cita = citaForm.id_cita

      const { error } = await supabase.from('cita').upsert(payload)
      if (error) throw error
      setModalMode(null)
      await recargar()
    } catch (err: any) {
      setMsgError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const cancelarCita = async (id: string) => {
    await supabase.from('cita').update({ estado_cita: 'cancelada' }).eq('id_cita', id)
    setCitaDetalle(null)
    await recargar()
  }

  // ── Modal horario ───────────────────────────────────────────────────────────
  const guardarHorario = async () => {
    setSaving(true); setMsgError(null)
    try {
      const payload: any = {
        dia_semana:  horarioForm.dia_semana,
        hora_inicio: horarioForm.hora_inicio,
        hora_cierre: horarioForm.hora_cierre,
        id_clinica:  horarioForm.id_clinica || null,
        id_fisioterapeuta: fisioId,
      }
      if (horarioForm.id_horario_atencion) payload.id_horario_atencion = horarioForm.id_horario_atencion

      const { data, error } = await supabase.from('horario_atencion').upsert(payload).select().single()
      if (error) throw error
      setHorarios(prev => {
        const existe = prev.find(h => h.id_horario_atencion === data.id_horario_atencion)
        const nuevo = {
          ...data,
          hora_inicio:  fmtHora(data.hora_inicio),
          hora_cierre:  fmtHora(data.hora_cierre),
          clinica_nombre: clinicas.find(c => c.id_clinica === data.id_clinica)?.nombre_clinica ?? 'Sin clínica',
        }
        return existe ? prev.map(h => h.id_horario_atencion === data.id_horario_atencion ? nuevo : h) : [...prev, nuevo]
      })
      setModalMode(null)
    } catch (err: any) {
      setMsgError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const eliminarHorario = async (id: string) => {
    await supabase.from('horario_atencion').update({ deleted_at: new Date().toISOString() }).eq('id_horario_atencion', id)
    setHorarios(prev => prev.filter(h => h.id_horario_atencion !== id))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', opacity: 0.4 }}>
      Cargando agenda...
    </div>
  )

  // ── Días de la semana actual ─────────────────────────────────────────────────
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDias(semanaBase, i))

  // ── Días del mes actual ──────────────────────────────────────────────────────
  const primerDiaMes    = new Date(mesBase.anio, mesBase.mes, 1)
  const ultimoDiaMes    = new Date(mesBase.anio, mesBase.mes + 1, 0)
  const offsetInicio    = (primerDiaMes.getDay() + 6) % 7  // Lunes = 0
  const diasMes         = Array.from({ length: ultimoDiaMes.getDate() }, (_, i) =>
    new Date(mesBase.anio, mesBase.mes, i + 1)
  )

  const citasDelDia = (iso: string) => citas.filter(c => c.fecha_cita === iso && c.estado_cita !== 'cancelada')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div className="dash-page-title">Agenda</div>
          <div className="dash-page-sub">Gestiona tus citas y horarios de atención</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Horarios */}
          <button onClick={() => { setHorarioForm(emptyHorario()); setModalMode('horario'); setMsgError(null) }} style={{
            padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
            border: '1.5px solid var(--border)', background: 'var(--white)', color: 'var(--text-mid)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            🕐 Horarios
          </button>
          {/* Vista semana / mes */}
          <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            {(['semana', 'mes'] as const).map(v => (
              <button key={v} onClick={() => setVista(v)} style={{
                padding: '7px 14px', border: 'none', fontSize: '12.5px', fontWeight: 600,
                background: vista === v ? 'var(--blue)' : 'var(--white)',
                color: vista === v ? '#fff' : 'var(--text-mid)',
                cursor: 'pointer', fontFamily: 'inherit', transition: '.15s',
              }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => abrirNueva()} style={{
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
            background: 'var(--blue)', color: '#fff', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            + Nueva cita
          </button>
        </div>
      </div>

      {/* ── VISTA SEMANA ── */}
      {vista === 'semana' && (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0, flex: 1 }}>
          {/* Navegación */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <NavBtn onClick={prevSemana}>‹</NavBtn>
              <NavBtn onClick={nextSemana}>›</NavBtn>
              <button onClick={irHoy} style={navBtnStyle}>Hoy</button>
            </div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
              {MESES[diasSemana[0].getMonth()]} {diasSemana[0].getDate()} – {MESES[diasSemana[6].getMonth()]} {diasSemana[6].getDate()}, {diasSemana[6].getFullYear()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
              {citas.filter(c => diasSemana.some(d => toISO(d) === c.fecha_cita) && c.estado_cita !== 'cancelada').length} citas esta semana
            </div>
          </div>

          {/* Grid días */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            {diasSemana.map((d, i) => {
              const iso   = toISO(d)
              const esHoy = iso === isoHoy()
              const citasD = citasDelDia(iso)
              return (
                <div key={iso} style={{
                  borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                  minHeight: '420px',
                }}>
                  {/* Header del día */}
                  <div style={{
                    padding: '10px 8px', textAlign: 'center',
                    background: esHoy ? 'var(--blue-xlight)' : 'var(--bg)',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: esHoy ? 'var(--blue)' : 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {DIAS_CORTOS[d.getDay()]}
                    </div>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', margin: '4px auto 0',
                      background: esHoy ? 'var(--blue)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: esHoy ? 900 : 600,
                      color: esHoy ? '#fff' : 'var(--text)',
                    }}>
                      {d.getDate()}
                    </div>
                  </div>

                  {/* Citas del día */}
                  <div style={{ padding: '6px 5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {citasD.map(cita => {
                      const es = estadoStyle(cita.estado_cita)
                      return (
                        <div key={cita.id_cita} onClick={() => setCitaDetalle(cita)} style={{
                          background: es.bg, borderLeft: `3px solid ${es.color}`,
                          borderRadius: '6px', padding: '6px 7px', cursor: 'pointer',
                          transition: '.15s',
                        }}>
                          <div style={{ fontSize: '11.5px', fontWeight: 700, color: es.color, lineHeight: 1.2 }}>
                            {cita.hora_inicio}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 600, marginTop: '2px', lineHeight: 1.3 }}>
                            {cita.paciente_nombre.split(' ')[0]}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-light)', marginTop: '1px', lineHeight: 1.2 }}>
                            {cita.motivo_cita.length > 20 ? cita.motivo_cita.slice(0, 18) + '…' : cita.motivo_cita}
                          </div>
                        </div>
                      )
                    })}
                    {/* Botón añadir en día */}
                    <button onClick={() => abrirNueva(iso)} style={{
                      width: '100%', padding: '5px', borderRadius: '6px',
                      border: '1.5px dashed var(--border)', background: 'none',
                      color: 'var(--text-light)', fontSize: '18px', cursor: 'pointer',
                      lineHeight: 1, transition: '.15s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--blue)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--blue)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-light)' }}
                    >+</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── VISTA MES ── */}
      {vista === 'mes' && (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0, flex: 1 }}>
          {/* Navegación */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <NavBtn onClick={prevMes}>‹</NavBtn>
              <NavBtn onClick={nextMes}>›</NavBtn>
              <button onClick={irHoy} style={navBtnStyle}>Hoy</button>
            </div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
              {MESES[mesBase.mes]} {mesBase.anio}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
              {citas.filter(c => {
                const d = new Date(c.fecha_cita + 'T00:00:00')
                return d.getMonth() === mesBase.mes && d.getFullYear() === mesBase.anio && c.estado_cita !== 'cancelada'
              }).length} citas este mes
            </div>
          </div>

          {/* Header días semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
              <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid días del mes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {/* Celdas vacías del inicio */}
            {Array.from({ length: offsetInicio }).map((_, i) => (
              <div key={`e-${i}`} style={{ minHeight: '90px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg)', opacity: 0.4 }} />
            ))}
            {/* Días del mes */}
            {diasMes.map((d, idx) => {
              const iso      = toISO(d)
              const esHoy    = iso === isoHoy()
              const citasD   = citasDelDia(iso)
              const colIdx   = (offsetInicio + idx) % 7
              return (
                <div key={iso} onClick={() => abrirNueva(iso)} style={{
                  minHeight: '90px', padding: '6px',
                  borderRight: colIdx < 6 ? '1px solid var(--border)' : 'none',
                  borderBottom: '1px solid var(--border)',
                  background: esHoy ? 'var(--blue-xlight)' : 'var(--white)',
                  cursor: 'pointer', transition: '.15s',
                }}
                  onMouseEnter={e => { if (!esHoy) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg)' }}
                  onMouseLeave={e => { if (!esHoy) (e.currentTarget as HTMLDivElement).style.background = 'var(--white)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: esHoy ? 'var(--blue)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: esHoy ? 900 : 600,
                      color: esHoy ? '#fff' : 'var(--text)',
                    }}>{d.getDate()}</span>
                    {citasD.length > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-xlight)', borderRadius: '10px', padding: '1px 6px' }}>
                        {citasD.length}
                      </span>
                    )}
                  </div>
                  {citasD.slice(0, 2).map(c => {
                    const es = estadoStyle(c.estado_cita)
                    return (
                      <div key={c.id_cita} onClick={e => { e.stopPropagation(); setCitaDetalle(c) }} style={{
                        background: es.bg, borderLeft: `2px solid ${es.color}`,
                        borderRadius: '4px', padding: '2px 5px', marginBottom: '2px',
                        fontSize: '10.5px', fontWeight: 600, color: es.color, cursor: 'pointer',
                      }}>
                        {c.hora_inicio} {c.paciente_nombre.split(' ')[0]}
                      </div>
                    )
                  })}
                  {citasD.length > 2 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-light)', paddingLeft: '4px' }}>
                      +{citasD.length - 2} más
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── HORARIOS DE ATENCIÓN — siempre visibles abajo ── */}
      <div className="dash-card" style={{ marginBottom: 0 }}>
        <div className="dash-card-title" style={{ display: 'flex', alignItems: 'center' }}>
          🕐 Mis horarios de atención
          <button onClick={() => { setHorarioForm(emptyHorario()); setModalMode('horario'); setMsgError(null) }} style={{
            marginLeft: 'auto', background: 'none', border: '1.5px dashed var(--border)',
            borderRadius: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 600,
            color: 'var(--blue)', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            + Agregar horario
          </button>
        </div>
        {horarios.length === 0 ? (
          <div style={{ textAlign: 'center', opacity: 0.4, fontSize: '13px', fontStyle: 'italic', padding: '12px 0' }}>
            Sin horarios configurados
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {horarios.sort((a, b) => a.dia_semana - b.dia_semana).map(h => (
              <div key={h.id_horario_atencion} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'var(--bg)', borderRadius: '10px', padding: '8px 12px',
                border: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>
                    {DIAS_HORARIO[h.dia_semana]}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-mid)' }}>
                    {h.hora_inicio} – {h.hora_cierre}
                    {h.clinica_nombre !== 'Sin clínica' && ` · ${h.clinica_nombre}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => { setHorarioForm({ ...h }); setModalMode('horario'); setMsgError(null) }} style={iconBtnStyle}>✏️</button>
                  <button onClick={() => eliminarHorario(h.id_horario_atencion)} style={iconBtnStyle}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL DETALLE CITA ── */}
      {citaDetalle && (
        <Overlay onClose={() => setCitaDetalle(null)}>
          <div style={{ width: '420px' }}>
            <ModalHeader title="Detalle de cita" onClose={() => setCitaDetalle(null)} />
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: estadoStyle(citaDetalle.estado_cita).bg,
                  borderRadius: '10px', padding: '10px 12px',
                  color: estadoStyle(citaDetalle.estado_cita).color,
                  textAlign: 'center', minWidth: '52px',
                }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, lineHeight: 1 }}>
                    {new Date(citaDetalle.fecha_cita + 'T00:00:00').getDate()}
                  </div>
                  <div style={{ fontSize: '0.62rem', textTransform: 'uppercase' }}>
                    {MESES[new Date(citaDetalle.fecha_cita + 'T00:00:00').getMonth()].slice(0, 3)}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text)' }}>{citaDetalle.paciente_nombre}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-mid)', marginTop: '2px' }}>{citaDetalle.motivo_cita}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                    {citaDetalle.hora_inicio} – {citaDetalle.hora_fin} hrs · {citaDetalle.clinica_nombre}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span style={{
                    background: estadoStyle(citaDetalle.estado_cita).bg,
                    color: estadoStyle(citaDetalle.estado_cita).color,
                    padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                  }}>
                    {estadoStyle(citaDetalle.estado_cita).label}
                  </span>
                </div>
              </div>

              {citaDetalle.notas_cita && (
                <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--text-mid)', lineHeight: 1.6 }}>
                  <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)' }}>Notas</strong>
                  {citaDetalle.notas_cita}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button onClick={() => abrirEditar(citaDetalle)} style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: 'var(--blue)', color: '#fff', fontWeight: 700,
                  fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                }}>✏️ Editar</button>
                {citaDetalle.estado_cita !== 'cancelada' && citaDetalle.estado_cita !== 'completada' && (
                  <button onClick={() => cancelarCita(citaDetalle.id_cita)} style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    border: '1.5px solid #fde8e8', background: '#fde8e8',
                    color: '#c0392b', fontWeight: 700, fontSize: '13px',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>✕ Cancelar</button>
                )}
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── MODAL NUEVA / EDITAR CITA ── */}
      {(modalMode === 'nueva' || modalMode === 'editar') && (
        <Overlay onClose={() => setModalMode(null)}>
          <div style={{ width: '480px' }}>
            <ModalHeader title={modalMode === 'nueva' ? 'Nueva cita' : 'Editar cita'} onClose={() => setModalMode(null)} />
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Paciente */}
              <FormField label="Paciente *">
                <select value={citaForm.id_paciente} onChange={e => setCitaForm(f => ({ ...f, id_paciente: e.target.value }))} style={inputStyle}>
                  <option value="">Selecciona un paciente...</option>
                  {pacientes.map(p => <option key={p.id_paciente} value={p.id_paciente}>{p.nombre_completo}</option>)}
                </select>
              </FormField>

              {/* Fecha */}
              <FormField label="Fecha *">
                <input type="date" value={citaForm.fecha_cita} onChange={e => setCitaForm(f => ({ ...f, fecha_cita: e.target.value }))} style={inputStyle} />
              </FormField>

              {/* Horas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <FormField label="Hora inicio *">
                  <input type="time" value={citaForm.hora_inicio} onChange={e => setCitaForm(f => ({ ...f, hora_inicio: e.target.value }))} style={inputStyle} />
                </FormField>
                <FormField label="Hora fin *">
                  <input type="time" value={citaForm.hora_fin} onChange={e => setCitaForm(f => ({ ...f, hora_fin: e.target.value }))} style={inputStyle} />
                </FormField>
              </div>

              {/* Motivo */}
              <FormField label="Motivo *">
                <input type="text" placeholder="Ej. Sesión de seguimiento..." value={citaForm.motivo_cita} onChange={e => setCitaForm(f => ({ ...f, motivo_cita: e.target.value }))} style={inputStyle} />
              </FormField>

              {/* Estado */}
              <FormField label="Estado">
                <select value={citaForm.estado_cita} onChange={e => setCitaForm(f => ({ ...f, estado_cita: e.target.value }))} style={inputStyle}>
                  <option value="pendiente">Pendiente</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="completada">Completada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </FormField>

              {/* Clínica */}
              {clinicas.length > 0 && (
                <FormField label="Clínica">
                  <select value={citaForm.id_clinica} onChange={e => setCitaForm(f => ({ ...f, id_clinica: e.target.value }))} style={inputStyle}>
                    <option value="">Sin clínica específica</option>
                    {clinicas.map(c => <option key={c.id_clinica} value={c.id_clinica}>{c.nombre_clinica}</option>)}
                  </select>
                </FormField>
              )}

              {/* Notas */}
              <FormField label="Notas">
                <textarea
                  placeholder="Observaciones para el paciente..."
                  value={citaForm.notas_cita ?? ''}
                  onChange={e => setCitaForm(f => ({ ...f, notas_cita: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', height: 'auto', paddingTop: '10px' }}
                />
              </FormField>

              {msgError && <div style={{ color: '#c0392b', fontSize: '12.5px', fontWeight: 600 }}>⚠️ {msgError}</div>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button onClick={() => setModalMode(null)} style={cancelBtnStyle}>Cancelar</button>
                <button onClick={guardarCita} disabled={saving} style={saveBtnStyle}>
                  {saving ? 'Guardando...' : modalMode === 'nueva' ? 'Crear cita' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── MODAL HORARIO ── */}
      {modalMode === 'horario' && (
        <Overlay onClose={() => setModalMode(null)}>
          <div style={{ width: '420px' }}>
            <ModalHeader title={horarioForm.id_horario_atencion ? 'Editar horario' : 'Agregar horario'} onClose={() => setModalMode(null)} />
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <FormField label="Día de la semana">
                <select value={horarioForm.dia_semana} onChange={e => setHorarioForm(f => ({ ...f, dia_semana: Number(e.target.value) }))} style={inputStyle}>
                  {DIAS_HORARIO.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <FormField label="Hora inicio">
                  <input type="time" value={horarioForm.hora_inicio} onChange={e => setHorarioForm(f => ({ ...f, hora_inicio: e.target.value }))} style={inputStyle} />
                </FormField>
                <FormField label="Hora cierre">
                  <input type="time" value={horarioForm.hora_cierre} onChange={e => setHorarioForm(f => ({ ...f, hora_cierre: e.target.value }))} style={inputStyle} />
                </FormField>
              </div>

              {clinicas.length > 0 && (
                <FormField label="Clínica">
                  <select value={horarioForm.id_clinica} onChange={e => setHorarioForm(f => ({ ...f, id_clinica: e.target.value }))} style={inputStyle}>
                    <option value="">Sin clínica específica</option>
                    {clinicas.map(c => <option key={c.id_clinica} value={c.id_clinica}>{c.nombre_clinica}</option>)}
                  </select>
                </FormField>
              )}

              {msgError && <div style={{ color: '#c0392b', fontSize: '12.5px', fontWeight: 600 }}>⚠️ {msgError}</div>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button onClick={() => setModalMode(null)} style={cancelBtnStyle}>Cancelar</button>
                <button onClick={guardarHorario} disabled={saving} style={saveBtnStyle}>
                  {saving ? 'Guardando...' : 'Guardar horario'}
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}

// ─── Sub-componentes UI ───────────────────────────────────────────────────────
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(2px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--white)', borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px', borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
    }}>
      <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text)' }}>{title}</div>
      <button onClick={onClose} style={{
        background: 'none', border: '1px solid var(--border)', width: '28px', height: '28px',
        borderRadius: '50%', cursor: 'pointer', fontSize: '14px', color: 'var(--text-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={navBtnStyle}>{children}</button>
  )
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const navBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: '7px', border: '1.5px solid var(--border)',
  background: 'var(--white)', color: 'var(--text-mid)', fontSize: '13px',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)',
  borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit',
  color: 'var(--text)', background: 'var(--bg)', outline: 'none',
  appearance: 'none' as any,
}

const saveBtnStyle: React.CSSProperties = {
  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
  background: 'var(--blue)', color: '#fff', fontWeight: 700,
  fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
}

const cancelBtnStyle: React.CSSProperties = {
  flex: 1, padding: '10px', borderRadius: '8px',
  border: '1.5px solid var(--border)', background: 'none',
  color: 'var(--text-mid)', fontWeight: 600,
  fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '14px', padding: '4px', borderRadius: '6px',
  lineHeight: 1,
}
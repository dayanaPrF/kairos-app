'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ModalAgregarPaciente } from './ModalAgregarPaciente'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Paciente {
  id_paciente: string
  nombre: string
  primer_apellido: string
  segundo_apellido: string
  correo_electronico: string
  numero_telefono: string
  sexo: string
  fecha_nacimiento: string | null
  tipo_sangre: string | null
  edad: number | null
  rutinaActiva: string | null
  ultimaSesion: string | null
  diasSinSesion: number | null
  diagnosticoVigente: string | null
  esPrincipal: boolean
}

interface FichaData {
  paciente: Paciente
  diagnosticos: { nombre_diagnostico: string; aun_vigente: boolean; fecha_diagnostico: string | null }[]
  sesiones: { fecha: string; estado_sesion: string; duracion_total: string | null }[]
  rutina: { nombre_rutina: string; fecha_inicio: string; fecha_fin: string; activa: boolean } | null
  proximaCita: { fecha_cita: string; hora_inicio: string; motivo_cita: string; estado_cita: string } | null
  contactoEmergencia: {
    nombre: string; primer_apellido: string; parentesco: string; numero_telefono: string
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcEdad(fechaNac: string | null): number | null {
  if (!fechaNac) return null
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  if (hoy < new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())) edad--
  return edad
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function actividadColor(dias: number | null) {
  if (dias === null) return { bg: '#f0f0f0', color: '#888', label: 'Sin sesiones' }
  if (dias <= 2)  return { bg: '#eef8d6', color: '#76a82e', label: `Hace ${dias}d` }
  if (dias <= 7)  return { bg: '#fff3cd', color: '#856404', label: `Hace ${dias}d` }
  return { bg: '#fde8e8', color: '#c0392b', label: `Hace ${dias}d` }
}

function Avatar({ nombre, size = 36 }: { nombre: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--blue) 0%, var(--lime-mid) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800,
      fontSize: size > 40 ? '1.2rem' : '0.85rem',
      flexShrink: 0,
    }}>
      {nombre.charAt(0).toUpperCase()}
    </div>
  )
}

// ─── Hook principal ───────────────────────────────────────────────────────────
function usePacientes() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: rels } = await supabase
        .from('paciente_fisioterapeuta')
        .select('id_paciente, es_principal')
        .eq('id_fisioterapeuta', user.id)
        .is('deleted_at', null)

      if (!rels?.length) { setPacientes([]); setLoading(false); return }

      const ids = rels.map(r => r.id_paciente)
      const principalSet = new Set(rels.filter(r => r.es_principal).map(r => r.id_paciente))

      const { data: perfiles } = await supabase
        .from('perfil')
        .select('id_perfil, nombre, primer_apellido, segundo_apellido, correo_electronico, numero_telefono, sexo, fecha_nacimiento')
        .in('id_perfil', ids)

      const { data: datosPac } = await supabase
        .from('paciente')
        .select('id_paciente, tipo_sangre')
        .in('id_paciente', ids)

      const { data: rutinas } = await supabase
        .from('rutina_paciente')
        .select('id_paciente, rutina(nombre_rutina)')
        .in('id_paciente', ids)
        .eq('activa', true)

      const { data: sesiones } = await supabase
        .from('sesion_entrenamiento')
        .select('id_paciente, fecha')
        .in('id_paciente', ids)
        .order('fecha', { ascending: false })

      const { data: diags } = await supabase
        .from('diagnostico')
        .select('id_paciente, nombre_diagnostico')
        .in('id_paciente', ids)
        .eq('aun_vigente', true)

      const mapaMP  = Object.fromEntries((datosPac ?? []).map(p => [p.id_paciente, p]))
      const mapaRut = Object.fromEntries((rutinas   ?? []).map(r => [r.id_paciente, (r.rutina as any)?.nombre_rutina ?? null]))
      const mapaUltimaS: Record<string, string> = {}
      for (const s of sesiones ?? []) {
        if (!mapaUltimaS[s.id_paciente]) mapaUltimaS[s.id_paciente] = s.fecha
      }
      const mapaDiag = Object.fromEntries((diags ?? []).map(d => [d.id_paciente, d.nombre_diagnostico]))

      const lista: Paciente[] = (perfiles ?? []).map(p => ({
        id_paciente:        p.id_perfil,
        nombre:             p.nombre,
        primer_apellido:    p.primer_apellido,
        segundo_apellido:   p.segundo_apellido ?? '',
        correo_electronico: p.correo_electronico,
        numero_telefono:    p.numero_telefono,
        sexo:               p.sexo ?? '',
        fecha_nacimiento:   p.fecha_nacimiento ?? null,
        tipo_sangre:        mapaMP[p.id_perfil]?.tipo_sangre ?? null,
        edad:               calcEdad(p.fecha_nacimiento),
        rutinaActiva:       mapaRut[p.id_perfil] ?? null,
        ultimaSesion:       mapaUltimaS[p.id_perfil] ?? null,
        diasSinSesion:      diasDesde(mapaUltimaS[p.id_perfil] ?? null),
        diagnosticoVigente: mapaDiag[p.id_perfil] ?? null,
        esPrincipal:        principalSet.has(p.id_perfil),
      }))

      setPacientes(lista.sort((a, b) => (a.diasSinSesion ?? 999) - (b.diasSinSesion ?? 999)))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { pacientes, loading, error, recargar: cargar }
}

async function cargarFicha(paciente: Paciente): Promise<FichaData> {
  const id = paciente.id_paciente
  const isoHoy = new Date().toISOString().split('T')[0]

  const [diagRes, sesRes, rutRes, citaRes, contRes] = await Promise.all([
    supabase.from('diagnostico')
      .select('nombre_diagnostico, aun_vigente, fecha_diagnostico')
      .eq('id_paciente', id)
      .order('fecha_diagnostico', { ascending: false }),

    supabase.from('sesion_entrenamiento')
      .select('fecha, estado_sesion, duracion_total')
      .eq('id_paciente', id)
      .order('fecha', { ascending: false })
      .limit(10),

    supabase.from('rutina_paciente')
      .select('fecha_inicio, fecha_fin, activa, rutina(nombre_rutina)')
      .eq('id_paciente', id)
      .eq('activa', true)
      .maybeSingle(),

    supabase.from('cita')
      .select('fecha_cita, hora_inicio, motivo_cita, estado_cita')
      .eq('id_paciente', id)
      .gte('fecha_cita', isoHoy)
      .neq('estado_cita', 'cancelada')
      .order('fecha_cita', { ascending: true })
      .limit(1)
      .maybeSingle(),

    supabase.from('paciente')
      .select('id_contacto_emergencia')
      .eq('id_paciente', id)
      .maybeSingle(),
  ])

  const rut = rutRes.data
  let ce = null
  if (contRes.data?.id_contacto_emergencia) {
    const { data: contacto } = await supabase
      .from('contacto_emergencia')
      .select('nombre, primer_apellido, parentesco, numero_telefono')
      .eq('id_contacto_emergencia', contRes.data.id_contacto_emergencia)
      .maybeSingle()
    ce = contacto
  }

  return {
    paciente,
    diagnosticos: diagRes.data ?? [],
    sesiones:     sesRes.data  ?? [],
    rutina: rut ? {
      nombre_rutina: (rut.rutina as any)?.nombre_rutina ?? 'Rutina',
      fecha_inicio:  rut.fecha_inicio ?? '',
      fecha_fin:     rut.fecha_fin    ?? '',
      activa:        rut.activa,
    } : null,
    proximaCita: citaRes.data ? {
      fecha_cita:  citaRes.data.fecha_cita,
      hora_inicio: citaRes.data.hora_inicio?.slice(0, 5) ?? '',
      motivo_cita: citaRes.data.motivo_cita ?? 'Consulta',
      estado_cita: citaRes.data.estado_cita ?? '',
    } : null,
    contactoEmergencia: ce ?? null,
  }
}

export function FisioSectionPacientes() {
  const { pacientes, loading, error, recargar } = usePacientes()
  const [busqueda, setBusqueda]   = useState('')
  const [fichaPac, setFichaPac]   = useState<FichaData | null>(null)
  const [fichaLoading, setFichaLoading] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [fisioId, setFisioId]     = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setFisioId(data.user.id)
    })
  }, [])

  const abrirFicha = async (pac: Paciente) => {
    setFichaLoading(true)
    setFichaPac(null)
    const data = await cargarFicha(pac)
    setFichaPac(data)
    setFichaLoading(false)
  }

  // Se filtran únicamente por el texto de búsqueda
  const filtrados = pacientes.filter(p => {
    const nombre = `${p.nombre} ${p.primer_apellido} ${p.segundo_apellido}`.toLowerCase()
    return nombre.includes(busqueda.toLowerCase()) ||
           p.correo_electronico?.toLowerCase().includes(busqueda.toLowerCase())
  })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', opacity: 0.4 }}>
      Cargando pacientes...
    </div>
  )

  if (error) return (
    <div style={{ padding: '20px', color: 'red', fontSize: '0.85rem' }}>Error: {error}</div>
  )

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%' }}>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="dash-page-title">Mis pacientes</div>
            <div className="dash-page-sub">
              {pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''} asignado{pacientes.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={() => setModalAbierto(true)}
            style={{
              background: 'var(--blue)', color: '#fff', border: 'none',
              borderRadius: '10px', padding: '9px 18px',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            + Agregar paciente
          </button>
        </div>

        {/* Búsqueda únicamente (Filtros eliminados) */}
        <div className="dash-card" style={{ padding: '14px', marginBottom: 0 }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{
              position: 'absolute', left: '12px', top: '50%',
              transform: 'translateY(-50%)', fontSize: '14px', opacity: 0.5,
            }}>🔍</span>
            <input
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 36px',
                border: '1.5px solid var(--border)', borderRadius: '8px',
                fontSize: '13px', fontFamily: 'inherit', color: 'var(--text)',
                background: 'var(--bg)', outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Tabla de pacientes */}
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0, flex: 1 }}>
          {filtrados.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', opacity: 0.4, fontSize: '0.85rem', fontStyle: 'italic' }}>
              No se encontraron pacientes
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.2fr 1fr 1fr 0.8fr',
                padding: '10px 18px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg)',
              }}>
                {['Paciente', 'Diagnóstico', 'Rutina activa', 'Última sesión', ''].map(h => (
                  <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {h}
                  </span>
                ))}
              </div>

              <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
                {filtrados.map(pac => {
                  const act = actividadColor(pac.diasSinSesion)
                  const isSelected = fichaPac?.paciente.id_paciente === pac.id_paciente
                  return (
                    <div
                      key={pac.id_paciente}
                      onClick={() => abrirFicha(pac)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.2fr 1fr 1fr 0.8fr',
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer', transition: '.15s',
                        background: isSelected ? 'var(--blue-xlight)' : 'var(--white)',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar nombre={pac.nombre} size={36} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                            {pac.nombre} {pac.primer_apellido}
                            {pac.esPrincipal && (
                              <span style={{
                                marginLeft: '6px', fontSize: '10px', fontWeight: 700,
                                background: 'var(--blue-xlight)', color: 'var(--blue)',
                                padding: '1px 6px', borderRadius: '20px',
                              }}>Principal</span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '1px' }}>
                            {pac.edad !== null ? `${pac.edad} años` : '—'}
                            {pac.tipo_sangre ? ` · ${pac.tipo_sangre}` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '12.5px', color: 'var(--text-mid)' }}>
                        {pac.diagnosticoVigente
                          ? <span title={pac.diagnosticoVigente}>{pac.diagnosticoVigente.length > 28 ? pac.diagnosticoVigente.slice(0, 26) + '…' : pac.diagnosticoVigente}</span>
                          : <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Sin diagnóstico</span>
                        }
                      </div>

                      <div style={{ fontSize: '12.5px', color: 'var(--text-mid)' }}>
                        {pac.rutinaActiva
                          ? <span style={{ background: 'var(--lime-light)', color: 'var(--lime-dark)', padding: '3px 8px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 600 }}>
                              {pac.rutinaActiva.length > 18 ? pac.rutinaActiva.slice(0, 16) + '…' : pac.rutinaActiva}
                            </span>
                          : <span style={{ opacity: 0.4, fontStyle: 'italic', fontSize: '12px' }}>Sin rutina</span>
                        }
                      </div>

                      <div>
                        <span style={{ background: act.bg, color: act.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700 }}>
                          {act.label}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: isSelected ? 'var(--blue)' : 'var(--text-light)', fontSize: '16px', fontWeight: 600 }}>
                          {isSelected ? '✕' : '→'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {(fichaPac || fichaLoading) && (
        <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>
          {fichaLoading ? (
            <div className="dash-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', opacity: 0.4 }}>
              Cargando ficha...
            </div>
          ) : fichaPac ? (
            <Ficha data={fichaPac} onCerrar={() => setFichaPac(null)} />
          ) : null}
        </div>
      )}

      {modalAbierto && fisioId && (
        <ModalAgregarPaciente
          fisioterapeutaId={fisioId}
          onAgregado={() => recargar()}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  )
}

function Ficha({ data, onCerrar }: { data: FichaData; onCerrar: () => void }) {
  const { paciente: p, diagnosticos, sesiones, rutina, proximaCita, contactoEmergencia } = data
  const [tab, setTab] = useState<'info' | 'sesiones' | 'diagnosticos'>('info')
  const estadoSesionColor: Record<string, { bg: string; color: string }> = {
    completada: { bg: '#eef8d6', color: '#76a82e' },
    parcial:    { bg: '#fff3cd', color: '#856404' },
    pendiente:  { bg: '#e4f5fb', color: '#1a3f52' },
  }

  return (
    <>
      <div className="dash-card" style={{ marginBottom: 0, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar nombre={p.nombre} size={48} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text)' }}>{p.nombre} {p.primer_apellido}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                {p.edad !== null ? `${p.edad} años` : '—'}{p.sexo ? ` · ${p.sexo}` : ''}{p.tipo_sangre ? ` · ${p.tipo_sangre}` : ''}
              </div>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'var(--bg)', border: '1px solid var(--border)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--text-mid)' }}><span>✉️</span><span>{p.correo_electronico}</span></div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--text-mid)' }}><span>📞</span><span>{p.numero_telefono}</span></div>
        </div>
      </div>
      {/* ... (resto del componente Ficha se mantiene igual) ... */}
    </>
  )
}
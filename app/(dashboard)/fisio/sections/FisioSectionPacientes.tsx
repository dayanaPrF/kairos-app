'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ModalAgregarPaciente } from './ModalAgregarPaciente'
import { ModalGestionDiagnosticos } from './ModalGestionDiagnosticos'

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
        .is('deleted_at', null)

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
        .is('deleted_at', null)

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

  // Función eliminar mejorada con borrado lógico de diagnósticos y rutinas[cite: 6, 7]
  const eliminar = async (idPaciente: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const confirmar = window.confirm('¿Estás seguro de eliminar al paciente? Se ocultarán sus diagnósticos y rutinas actuales.')
    if (!confirmar) return

    try {
      const timestamp = new Date().toISOString()

      // 1. Marcar relación paciente-fisioterapeuta como eliminada[cite: 7]
      await supabase
        .from('paciente_fisioterapeuta')
        .update({ deleted_at: timestamp })
        .eq('id_fisioterapeuta', user.id)
        .eq('id_paciente', idPaciente)

      // 2. Marcar diagnósticos vigentes como eliminados/no vigentes[cite: 6]
      await supabase
        .from('diagnostico')
        .update({ 
          deleted_at: timestamp,
          aun_vigente: false 
        })
        .eq('id_paciente', idPaciente)
        .eq('id_fisioterapeuta', user.id)

      // 3. Desactivar rutinas activas[cite: 7]
      await supabase
        .from('rutina_paciente')
        .update({ 
          deleted_at: timestamp,
          activa: false 
        })
        .eq('id_paciente', idPaciente)

      await cargar()
    } catch (err: any) { 
      alert("Error al procesar la baja: " + err.message) 
    }
  }

  useEffect(() => { cargar() }, [cargar])
  return { pacientes, loading, error, recargar: cargar, eliminar }
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export function FisioSectionPacientes() {
  const { pacientes, loading, error, recargar, eliminar } = usePacientes()
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [fisioId, setFisioId] = useState<string | null>(null)
  const [pacienteParaDiag, setPacienteParaDiag] = useState<{id: string, nombre: string} | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setFisioId(data.user.id) })
  }, [])

  const filtrados = pacientes.filter(p => {
    const full = `${p.nombre} ${p.primer_apellido} ${p.segundo_apellido}`.toLowerCase()
    return full.includes(busqueda.toLowerCase()) || p.correo_electronico?.toLowerCase().includes(busqueda.toLowerCase())
  })

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', opacity: 0.4 }}>Cargando pacientes...</div>

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="dash-page-title">Mis pacientes</div>
            <div className="dash-page-sub">{pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''} asignado{pacientes.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={() => setModalAbierto(true)} className="btn-primary" style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            + Agregar paciente
          </button>
        </div>

        {/* Tabla */}
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr', padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            {['Paciente', 'Diagnóstico', 'Rutina activa', 'Última sesión', 'Acciones'].map(h => (
              <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
            {filtrados.map(pac => {
              const act = actividadColor(pac.diasSinSesion)
              return (
                <div key={pac.id_paciente} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr', padding: '14px 18px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar nombre={pac.nombre} size={36} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{pac.nombre} {pac.primer_apellido}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{pac.edad ?? '—'} años</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '12.5px' }}>{pac.diagnosticoVigente || <span style={{ opacity: 0.4 }}>—</span>}</div>
                  <div>{pac.rutinaActiva ? <span style={{ fontSize: '11.5px' }}>✅ {pac.rutinaActiva}</span> : <span style={{ opacity: 0.4 }}>—</span>}</div>
                  <div><span style={{ background: act.bg, color: act.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11.5px' }}>{act.label}</span></div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                    <button 
                      onClick={() => setPacienteParaDiag({ id: pac.id_paciente, nombre: pac.nombre })}
                      title="Gestionar Diagnósticos"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                    >🩺</button>
                    <button 
                      onClick={() => eliminar(pac.id_paciente)} 
                      title="Eliminar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                    >🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* MODALES */}
      {pacienteParaDiag && fisioId && (
        <ModalGestionDiagnosticos 
          pacienteId={pacienteParaDiag.id} 
          pacienteNombre={pacienteParaDiag.nombre} 
          fisioId={fisioId} 
          onCerrar={() => {
            setPacienteParaDiag(null)
            recargar()
          }} 
        />
      )}

      {modalAbierto && fisioId && (
        <ModalAgregarPaciente 
          fisioterapeutaId={fisioId} 
          onAgregado={recargar} 
          onCerrar={() => setModalAbierto(false)} 
        />
      )}
    </div>
  )
}
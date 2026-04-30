'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

interface PacienteResultado {
  id_paciente: string
  tipo_sangre: string | null
  perfil: {
    nombre: string
    primer_apellido: string
    segundo_apellido: string | null
    correo_electronico: string
    fecha_nacimiento: string | null
  }
}

interface Props {
  fisioterapeutaId: string
  onAgregado: () => void
  onCerrar: () => void
}

export function ModalAgregarPaciente({ fisioterapeutaId, onAgregado, onCerrar }: Props) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<PacienteResultado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState<PacienteResultado | null>(null)
  const [esPrincipal, setEsPrincipal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCerrar])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResultados([])
      setBuscando(false)
      return
    }

    setBuscando(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const q = query.trim()
      setError(null)

      try {
        const orFilter = `nombre.ilike.%${q}%,primer_apellido.ilike.%${q}%,segundo_apellido.ilike.%${q}%,correo_electronico.ilike.%${q}%`
        
        console.log("--- INICIANDO BÚSQUEDA ---")
        console.log("Filtro enviado a Supabase:", orFilter)

        const { data: perfiles, error: perfilErr } = await supabase
          .from('perfil')
          .select('id_perfil, nombre, primer_apellido, segundo_apellido, correo_electronico, fecha_nacimiento')
          .or(orFilter)
          .limit(20)

        console.log('1. Resultado consulta Perfiles:', perfiles)
        
        if (perfilErr) {
          console.error('Error específico en tabla perfil:', perfilErr)
          throw perfilErr
        }

        if (!perfiles || perfiles.length === 0) {
          console.warn('Aviso: No se encontraron coincidencias en la tabla Perfil.')
          setResultados([])
          setBuscando(false)
          return
        }

        const idsPerfiles = perfiles.map(p => p.id_perfil)

        const { data: pacientes, error: pacErr } = await supabase
          .from('paciente')
          .select('id_paciente, tipo_sangre')
          .in('id_paciente', idsPerfiles)
          .is('deleted_at', null)

        console.log('2. Coincidencias en tabla Paciente:', pacientes)

        if (pacErr) throw pacErr

        const transformados: PacienteResultado[] = (pacientes ?? []).map(pac => {
          const perf = perfiles.find(p => p.id_perfil === pac.id_paciente)
          return {
            id_paciente: pac.id_paciente,
            tipo_sangre: pac.tipo_sangre,
            perfil: perf ? {
              nombre: perf.nombre,
              primer_apellido: perf.primer_apellido,
              segundo_apellido: perf.segundo_apellido,
              correo_electronico: perf.correo_electronico,
              fecha_nacimiento: perf.fecha_nacimiento
            } : null
          }
        }).filter(item => item.perfil !== null) as PacienteResultado[]

        const { data: yaAsignados, error: asignadosErr } = await supabase
          .from('paciente_fisioterapeuta')
          .select('id_paciente')
          .eq('id_fisioterapeuta', fisioterapeutaId)
          .is('deleted_at', null)

        console.log('3. IDs que ya tienes asignados (se filtrarán):', yaAsignados)

        if (asignadosErr) throw asignadosErr

        const idsAsignados = new Set((yaAsignados ?? []).map(r => r.id_paciente))
        const final = transformados.filter(p => !idsAsignados.has(p.id_paciente))
        
        console.log('4. Lista final a mostrar:', final)
        
        // ACTUALIZACIÓN DE ESTADO: Forzamos la actualización de resultados
        setResultados([...final])

      } catch (err: any) {
        console.error('Error fatal en el flujo de búsqueda:', err)
        setError(`Error: ${err.message || 'Error desconocido'}`)
      } finally {
        setBuscando(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, fisioterapeutaId])

  const confirmar = async () => {
    if (!seleccionado || guardando) return
    setGuardando(true)
    setError(null)

    const { error: err } = await supabase
      .from('paciente_fisioterapeuta')
      .insert({
        id_paciente: seleccionado.id_paciente,
        id_fisioterapeuta: fisioterapeutaId,
        es_principal: esPrincipal,
      })

    if (err) {
      console.error('Error al insertar vínculo:', err)
      setError('No se pudo vincular al paciente.')
      setGuardando(false)
    } else {
      onAgregado()
      onCerrar()
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', backdropFilter: 'blur(4px)'
      }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}
    >
      <div style={{
        background: '#fff', borderRadius: '16px',
        border: '1px solid #ddd', width: '500px',
        maxWidth: '100%', overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>

        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid #eee',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px' }}>Agregar paciente</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
              Busca por nombre, apellidos o correo
            </div>
          </div>
          <button onClick={onCerrar} style={{
            background: '#f5f5f5', border: '1px solid #ddd',
            width: '32px', height: '32px', borderRadius: '50%',
            cursor: 'pointer'
          }}>✕</button>
        </div>

        <div style={{ padding: '14px 20px 10px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>🔍</span>
            <input
              autoFocus
              type="text"
              placeholder="Buscar paciente..."
              value={query}
              onChange={e => { setQuery(e.target.value); setSeleccionado(null); setError(null) }}
              style={{
                width: '100%', padding: '10px 12px 10px 38px', boxSizing: 'border-box',
                border: '1.5px solid #ddd', borderRadius: '10px',
                fontSize: '14px', outline: 'none'
              }}
            />
          </div>
        </div>

        {/* CONTENEDOR DE LA LISTA: Aseguramos que sea visible y tenga scroll */}
        <div style={{ padding: '10px 20px', overflowY: 'auto', minHeight: '200px', maxHeight: '400px' }}>
          {query.trim().length < 2 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', opacity: 0.5, fontSize: '13px' }}>Escribe para buscar...</div>
          ) : buscando ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', opacity: 0.5, fontSize: '13px' }}>Buscando...</div>
          ) : resultados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', opacity: 0.5, fontSize: '13px' }}>No se encontraron pacientes nuevos</div>
          ) : (
            resultados.map((pac) => (
              <div
                key={pac.id_paciente}
                onClick={() => setSeleccionado(pac)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', borderRadius: '12px', cursor: 'pointer',
                  background: seleccionado?.id_paciente === pac.id_paciente ? '#eef6ff' : 'transparent',
                  border: `1.5px solid ${seleccionado?.id_paciente === pac.id_paciente ? '#3b82f6' : 'transparent'}`,
                  marginBottom: '8px', transition: '0.2s'
                }}
              >
                <Avatar nombre={pac.perfil.nombre} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>
                    {pac.perfil.nombre} {pac.perfil.primer_apellido}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{pac.perfil.correo_electronico}</div>
                </div>
                {seleccionado?.id_paciente === pac.id_paciente && <span style={{ color: '#3b82f6', fontWeight: 900 }}>✓</span>}
              </div>
            ))
          )}
        </div>

        {error && <div style={{ margin: '0 20px 10px', color: '#e74c3c', fontSize: '12px', fontWeight: 600 }}>{error}</div>}

        <div style={{ padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={esPrincipal} 
              onChange={e => setEsPrincipal(e.target.checked)} 
              style={{ width: '16px', height: '16px' }}
            />
            Asignar como principal
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onCerrar} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #ddd', background: 'none', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={!seleccionado || guardando}
              style={{
                padding: '9px 20px', borderRadius: '8px', border: 'none',
                background: seleccionado ? '#3b82f6' : '#ccc',
                color: '#fff', fontWeight: 700, cursor: seleccionado ? 'pointer' : 'not-allowed'
              }}
            >
              {guardando ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
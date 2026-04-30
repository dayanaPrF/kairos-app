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
        // 1. Buscar perfiles
        const { data: perfiles, error: perfilErr } = await supabase
          .from('perfil')
          .select('id_perfil, nombre, primer_apellido, segundo_apellido, correo_electronico, fecha_nacimiento')
          .or(`nombre.ilike.%${q}%,primer_apellido.ilike.%${q}%,segundo_apellido.ilike.%${q}%,correo_electronico.ilike.%${q}%`)
          .limit(20)

        if (perfilErr) throw perfilErr
        if (!perfiles || perfiles.length === 0) {
          setResultados([])
          setBuscando(false)
          return
        }

        const idsPerfiles = perfiles.map(p => p.id_perfil)

        // 2. CORRECCIÓN: Usamos 'id_paciente' que es la columna en tu SQL que referencia al perfil
        const { data: pacientes, error: pacErr } = await supabase
          .from('paciente')
          .select('id_paciente, tipo_sangre')
          .in('id_paciente', idsPerfiles)
          .is('deleted_at', null)

        if (pacErr) throw pacErr

        // 3. Unir información
        const transformados: PacienteResultado[] = pacientes.map(pac => {
          // Buscamos el perfil usando pac.id_paciente porque son el mismo UUID en tu esquema
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

        // 4. Excluir ya asignados
        const { data: yaAsignados, error: asignadosErr } = await supabase
          .from('paciente_fisioterapeuta')
          .select('id_paciente')
          .eq('id_fisioterapeuta', fisioterapeutaId)
          .is('deleted_at', null)

        if (asignadosErr) throw asignadosErr

        const idsAsignados = new Set((yaAsignados ?? []).map(r => r.id_paciente))
        setResultados(transformados.filter(p => !idsAsignados.has(p.id_paciente)))

      } catch (err: any) {
        console.error('Error en búsqueda:', err)
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
      console.error('Error al insertar:', err)
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
        background: 'var(--white)', borderRadius: '16px',
        border: '1px solid var(--border)', width: '500px',
        maxWidth: '100%', overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>

        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text)' }}>Agregar paciente</div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '3px' }}>
              Busca por nombre, apellidos o correo
            </div>
          </div>
          <button onClick={onCerrar} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            width: '32px', height: '32px', borderRadius: '50%',
            cursor: 'pointer', color: 'var(--text-light)'
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
                border: '1.5px solid var(--border)', borderRadius: '10px',
                fontSize: '14px', background: 'var(--bg)', outline: 'none'
              }}
            />
          </div>
        </div>

        <div style={{ padding: '4px 20px 8px', overflowY: 'auto', minHeight: '160px', maxHeight: '300px' }}>
          {query.trim().length < 2 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', opacity: 0.35, fontSize: '13px' }}>Escribe para buscar...</div>
          ) : buscando ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', opacity: 0.35, fontSize: '13px' }}>Buscando...</div>
          ) : resultados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', opacity: 0.35, fontSize: '13px' }}>No se encontraron pacientes nuevos</div>
          ) : (
            resultados.map(pac => (
              <div
                key={pac.id_paciente}
                onClick={() => setSeleccionado(seleccionado?.id_paciente === pac.id_paciente ? null : pac)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                  background: seleccionado?.id_paciente === pac.id_paciente ? 'var(--blue-xlight)' : 'transparent',
                  border: `1.5px solid ${seleccionado?.id_paciente === pac.id_paciente ? 'var(--blue-light)' : 'transparent'}`,
                  marginBottom: '6px', transition: '.2s'
                }}
              >
                <Avatar nombre={pac.perfil.nombre} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{`${pac.perfil.nombre} ${pac.perfil.primer_apellido}`}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{pac.perfil.correo_electronico}</div>
                </div>
                {seleccionado?.id_paciente === pac.id_paciente && <span style={{ color: 'var(--blue)', fontWeight: 900 }}>✓</span>}
              </div>
            ))
          )}
        </div>

        {error && <div style={{ margin: '0 20px 10px', color: '#e74c3c', fontSize: '12px', fontWeight: 600 }}>{error}</div>}

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
            <input 
              type="checkbox" 
              checked={esPrincipal} 
              onChange={e => setEsPrincipal(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Asignar como principal
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onCerrar} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={!seleccionado || guardando}
              style={{
                padding: '9px 20px', borderRadius: '8px', border: 'none',
                background: seleccionado ? 'var(--blue)' : '#ccc',
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
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface EjercicioResumen {
  id_ejercicio: string
  nombre_ejercicio: string
  descripcion: string | null
  icono: string | null
  repeticiones: number | null
  tiene_ia: boolean
  total_poses: number
  total_articulaciones: number
  fase_nombre: string
  fase_numero: number
}

interface RutinaActiva {
  id_rutina_paciente: string
  nombre_rutina: string
  fecha_inicio: string | null
  fecha_fin: string | null
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function SectionRutina() {
  const [rutina, setRutina]           = useState<RutinaActiva | null>(null)
  const [ejercicios, setEjercicios]   = useState<EjercicioResumen[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [selected, setSelected]       = useState<EjercicioResumen | null>(null)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true); setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // 1. Buscar rutina activa del paciente
      const { data: rutinaRaw, error: errR } = await supabase
        .from('rutina_paciente')
        .select('id_rutina_paciente, fecha_inicio, fecha_fin, rutina(id_rutina, nombre_rutina)')
        .eq('id_paciente', user.id)
        .eq('activa', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (errR || !rutinaRaw) {
        setRutina(null); setEjercicios([]); setLoading(false); return
      }

      const rut = rutinaRaw.rutina as any
      setRutina({
        id_rutina_paciente: rutinaRaw.id_rutina_paciente,
        nombre_rutina: rut.nombre_rutina,
        fecha_inicio: rutinaRaw.fecha_inicio,
        fecha_fin: rutinaRaw.fecha_fin,
      })

      // 2. Traer las fases de esa rutina
      const { data: fases, error: errF } = await supabase
        .from('fase')
        .select('id_fase, numero_fase, nombre_fase')
        .eq('id_rutina', rut.id_rutina)
        .is('deleted_at', null)
        .order('numero_fase')

      if (errF || !fases?.length) {
        setEjercicios([]); setLoading(false); return
      }

      // 3. Traer los ejercicios de todas las fases (con poses para saber si tiene IA)
      const { data: ejsRaw, error: errE } = await supabase
        .from('ejercicio')
        .select(`
          id_ejercicio, nombre_ejercicio, descripcion, icono, repeticiones,
          id_fase, secuencia_poses, secuencia_poses_personalizada,
          biblioteca_ejercicio ( secuencia_poses )
        `)
        .in('id_fase', fases.map(f => f.id_fase))
        .is('deleted_at', null)
        .order('orden')

      if (errE || !ejsRaw) {
        setEjercicios([]); setLoading(false); return
      }

      // 4. Mapear a EjercicioResumen
      const faseMap = Object.fromEntries(fases.map(f => [f.id_fase, f]))

      const resumen: EjercicioResumen[] = ejsRaw.map(ej => {
      // ── LOGS TEMPORALES ──
      console.log('📦 ejercicio raw:', ej.nombre_ejercicio)
      console.log('📦 biblioteca_ejercicio:', JSON.stringify((ej as any).biblioteca_ejercicio))
      console.log('📦 secuencia_poses:', ej.secuencia_poses)
      // ─────────────────────

      const bibRaw = (ej as any).biblioteca_ejercicio
      const bib = Array.isArray(bibRaw) ? bibRaw[0] : bibRaw

      console.log('📦 bib resuelto:', JSON.stringify(bib))
      console.log('📦 bib?.secuencia_poses:', JSON.stringify(bib?.secuencia_poses))

      const poses: any[] =
        (ej.secuencia_poses_personalizada as any[] | null) ??
        (bib?.secuencia_poses as any[] | null) ??
        (ej.secuencia_poses as any[] | null) ??
        []

      console.log('📦 poses.length:', poses.length)
      // ... resto igual
        const totalArts = poses.reduce(
          (acc: number, p: any) => acc + (p.articulaciones?.length ?? 0), 0
        )

        const fase = faseMap[ej.id_fase]
        return {
          id_ejercicio: ej.id_ejercicio,
          nombre_ejercicio: ej.nombre_ejercicio,
          descripcion: ej.descripcion,
          icono: ej.icono,
          repeticiones: ej.repeticiones,
          tiene_ia: poses.length > 0,
          total_poses: poses.length,
          total_articulaciones: totalArts,
          fase_nombre: fase?.nombre_fase ?? '',
          fase_numero: fase?.numero_fase ?? 0,
        }
      })

      setEjercicios(resumen)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Agrupar por fase ─────────────────────────────────────────────────────────
  const porFase = ejercicios.reduce<Record<number, EjercicioResumen[]>>((acc, ej) => {
    if (!acc[ej.fase_numero]) acc[ej.fase_numero] = []
    acc[ej.fase_numero].push(ej)
    return acc
  }, {})

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="dash-page-header">
        <div className="dash-page-title">Mi Rutina</div>
        <div className="dash-page-sub">
          {rutina ? rutina.nombre_rutina : 'Ejercicios asignados por tu fisioterapeuta'}
        </div>
      </div>

      {/* ── Estados ── */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', opacity: 0.4 }}>
          Cargando tu rutina...
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: '16px', borderRadius: '10px', background: '#fde8e8', color: '#c0392b', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && !rutina && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px', opacity: 0.5 }}>
          <span style={{ fontSize: '3rem' }}>🏋️</span>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Sin rutina activa</div>
          <div style={{ fontSize: '0.82rem', textAlign: 'center', maxWidth: '300px' }}>
            Tu fisioterapeuta aún no te ha asignado una rutina.
          </div>
        </div>
      )}

      {!loading && !error && rutina && ejercicios.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '12px', opacity: 0.5 }}>
          <span style={{ fontSize: '3rem' }}>📋</span>
          <div style={{ fontWeight: 700 }}>La rutina no tiene ejercicios aún</div>
        </div>
      )}

      {/* ── Info de rutina ── */}
      {rutina && (
        <div className='dash-sec-label-rutine'>
          {ejercicios.length} ejercicio{ejercicios.length !== 1 ? 's' : ''} en tu rutina
          {rutina.fecha_inicio && (
            <span style={{ marginLeft: '12px', opacity: 0.6, fontSize: '0.78rem' }}>
              · Inicio: {rutina.fecha_inicio}
              {rutina.fecha_fin ? ` · Fin: ${rutina.fecha_fin}` : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Lista agrupada por fase ── */}
      {Object.entries(porFase)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([numFase, ejes]) => (
          <div key={numFase}>
            <div className="dash-sec-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'var(--blue)', color: '#fff', borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 800 }}>
                Fase {numFase}
              </span>
              {ejes[0]?.fase_nombre}
            </div>

            <div className="dash-routine-list">
              {ejes.map(ej => (
                <div
                  key={ej.id_ejercicio}
                  className="dash-ri"
                  style={{
                    cursor: ej.tiene_ia ? 'pointer' : 'default',
                    borderLeft: selected?.id_ejercicio === ej.id_ejercicio
                      ? '4px solid var(--lime)'
                      : '4px solid transparent',
                    opacity: ej.tiene_ia ? 1 : 0.6,
                  }}
                  onClick={() => ej.tiene_ia && setSelected(ej)}
                >
                  <div className="dash-ri-icon" style={{ fontSize: '1.5rem' }}>
                    {ej.icono ?? '🏋️'}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div className="dash-ri-title">{ej.nombre_ejercicio}</div>
                    <div className="dash-ri-sub">
                      {ej.tiene_ia
                        ? `🤖 ${ej.total_poses} poses · ${ej.total_articulaciones} articulaciones monitoreadas`
                        : 'Sin evaluación IA — ejercicio manual'}
                      {ej.repeticiones && ` · ${ej.repeticiones} reps`}
                    </div>
                  </div>

                  <span className={`dash-ri-badge ${ej.tiene_ia ? 'pending' : ''}`}
                    style={!ej.tiene_ia ? { background: '#f0f0f0', color: '#999' } : {}}>
                    {ej.tiene_ia ? 'Con IA' : 'Manual'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      }

      {/* ── Modal de lanzamiento ── */}
      {selected && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-icon-badge">{selected.icono ?? '🏋️'}</div>
              <div style={{ flex: 1 }}>
                <h3 className="modal-title">{selected.nombre_ejercicio}</h3>
                <p className="modal-subtitle">IA de Visión Computacional Lista</p>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="doc-note-box">
                <div className="doc-note-header">
                  <span>ℹ️ Descripción del ejercicio</span>
                </div>
                <p className="doc-note-text" style={{ marginBottom: '15px' }}>
                  {selected.descripcion ?? 'Sin descripción adicional.'}
                </p>
                <div className="doc-tip" style={{ background: 'var(--blue-xlight)', border: '1px solid var(--blue-light)' }}>
                  <strong>Configuración:</strong> El sistema validará{' '}
                  <strong>{selected.total_articulaciones} ángulos</strong> distribuidos en{' '}
                  <strong>{selected.total_poses} poses</strong> en tiempo real.
                  {selected.repeticiones && ` Realiza ${selected.repeticiones} repeticiones.`}
                </div>
              </div>

              <div className="exercise-preview-mock" style={{ background: 'var(--blue-deep)', color: 'var(--lime)' }}>
                <div className="play-circle" style={{ borderColor: 'var(--lime)', color: 'var(--lime)' }}>📷</div>
                <span>Se requiere acceso a la cámara</span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-modal-back" onClick={() => setSelected(null)}>
                Regresar
              </button>
              <Link
                href={`/paciente/rehabilitacion?id=${selected.id_ejercicio}`}
                className="btn-modal-start"
              >
                Comenzar ahora →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
'use client'
/**
 * EjercicioBuilder v2 — con catálogo de poses/ejercicios predefinidos
 *
 * MODOS de creación:
 *   1. "catalogo_ejercicio" — selecciona un ejercicio completo predefinido
 *   2. "catalogo_poses"    — selecciona poses sueltas del catálogo y las ordena
 *   3. "personalizado"     — builder libre con el muñequito (comportamiento previo)
 *
 * El fisio puede cambiar de modo en cualquier momento; al confirmar se
 * serializa el resultado al formato EjercicioFormData existente.
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MunequitoReferencia } from '@/app/components/MunequitoReferencia'
import {
  cargarPosesCatalogo,
  cargarEjerciciosCatalogo,
  type PoseCatalogo,
  type EjercicioCatalogo,
  type PoseSecuenciaItem,
} from '@/app/lib/poses/compiler'
import type { KeypointRule } from '@/app/lib/poses/types'

// ─── Tipos (compatibles con el sistema existente) ─────────────────────────────

export interface Articulacion {
  id_articulacion: string
  nombre_articulacion: string
  puntos_mediapipe: string[]
}

export interface PoseArticulacion {
  id_articulacion: string
  nombre_articulacion: string
  angulo: number
  tolerancia: number
}

export interface Pose {
  tmpId: string
  orden: number
  nombre: string
  hold_sec: number
  articulaciones: PoseArticulacion[]
}

export interface EjercicioFormData {
  nombre_ejercicio: string
  descripcion: string
  video_muestra: string
  icono: string
  repeticiones: string
  secuencia_poses: Pose[]
  guardar_en_biblioteca: boolean
  id_biblioteca_ejercicio?: string
  tiene_override: boolean
  // Nuevo: referencia al catálogo
  id_ejercicio_catalogo?: string | null
  // Poses del catálogo seleccionadas (no van a secuencia_poses legacy)
  _poses_catalogo?: PoseCatalogoPose[]
  _modo?: ModoCreacion
}

// Pose del catálogo lista para usar en secuencia
export interface PoseCatalogoPose {
  tmpId:      string
  id_pose:    string
  nombre:     string
  imagen_url: string | null
  hold_sec:   number
  keypoints:  KeypointRule[]
}

type ModoCreacion = 'catalogo_ejercicio' | 'catalogo_poses' | 'personalizado'

const ICONOS = ['🏋️','🦵','💪','🤸','🧘','🚶','🏃','🔄','⬆️','🎯','🦶','🙌','🖐️','🫀']
const DIFICULTAD_LABEL = ['', 'Básico', 'Intermedio', 'Avanzado']
const DIFICULTAD_COLOR = ['', '#4a7c0f', '#856404', '#c0392b']

// ─── Helpers (copiados del builder original) ──────────────────────────────────

function defaultAngulo(nombre: string): number {
  const n = nombre.toLowerCase()
  if (n.includes('hombro'))  return 90
  if (n.includes('codo'))    return 170
  if (n.includes('cadera'))  return 170
  if (n.includes('rodilla')) return 170
  if (n.includes('tobillo')) return 90
  if (n.includes('tronco'))  return 170
  if (n.includes('cuello'))  return 90
  return 90
}

function defaultTolerancia(nombre: string): number {
  const n = nombre.toLowerCase()
  if (n.includes('codo'))    return 20
  if (n.includes('rodilla')) return 20
  if (n.includes('cadera'))  return 20
  if (n.includes('tobillo')) return 20
  return 15
}

const defaultForm = (): EjercicioFormData => ({
  nombre_ejercicio: '', descripcion: '', video_muestra: '',
  icono: '🏋️', repeticiones: '', secuencia_poses: [],
  guardar_en_biblioteca: true, tiene_override: false,
  id_ejercicio_catalogo: null, _poses_catalogo: [], _modo: 'catalogo_ejercicio',
})

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

interface EjercicioBuilderProps {
  ejercicioInicial?:        EjercicioFormData
  mostrarOpcionBiblioteca?: boolean
  onConfirmar: (data: EjercicioFormData) => void
  onCancelar:  () => void
}

export function EjercicioBuilder({
  ejercicioInicial,
  mostrarOpcionBiblioteca = true,
  onConfirmar,
  onCancelar,
}: EjercicioBuilderProps) {
  const [form, setForm]   = useState<EjercicioFormData>(ejercicioInicial ?? defaultForm())
  const [error, setError] = useState<string | null>(null)

  const modo = form._modo ?? 'catalogo_ejercicio'

  const update = (field: keyof EjercicioFormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const setModo = (m: ModoCreacion) =>
    setForm(prev => ({ ...prev, _modo: m }))

  const confirmar = () => {
    if (!form.nombre_ejercicio.trim()) { setError('El nombre del ejercicio es obligatorio'); return }
    if (modo === 'catalogo_ejercicio' && !form.id_ejercicio_catalogo) {
      setError('Selecciona un ejercicio del catálogo'); return
    }
    if (modo === 'catalogo_poses' && !(form._poses_catalogo?.length)) {
      setError('Agrega al menos una pose'); return
    }
    if (modo === 'personalizado' && !form.secuencia_poses.length) {
      setError('Agrega al menos una pose personalizada'); return
    }
    setError(null)
    onConfirmar(form)
  }

  return (
    <div style={{ background: 'var(--bg)', borderRadius: '14px', border: '1.5px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Datos base */}
      <DatosBase form={form} update={update} />

      {/* Selector de modo */}
      <ModoSelector modo={modo} onChange={setModo} />

      {/* Contenido según modo */}
      {modo === 'catalogo_ejercicio' && (
        <ModoCatalogoEjercicio form={form} setForm={setForm} />
      )}
      {modo === 'catalogo_poses' && (
        <ModoCatalogoPoses form={form} setForm={setForm} />
      )}
      {modo === 'personalizado' && (
        <ModoPersonalizado form={form} setForm={setForm} />
      )}

      {/* Opción biblioteca */}
      {mostrarOpcionBiblioteca && !ejercicioInicial?.id_biblioteca_ejercicio && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', background: '#f8fcff', border: '1px solid var(--border)' }}>
          <input type="checkbox" id="guardar-bib" checked={form.guardar_en_biblioteca}
            onChange={e => update('guardar_en_biblioteca', e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--blue)' }} />
          <label htmlFor="guardar-bib" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
            Guardar en mi biblioteca para reutilizar en otras rutinas
          </label>
        </div>
      )}

      {error && <div style={{ padding: '10px 14px', borderRadius: '9px', background: '#fde8e8', color: '#c0392b', fontSize: '0.8rem' }}>⚠️ {error}</div>}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={btnOutline}>Cancelar</button>
        <button onClick={confirmar}  style={btnPrimary}>✅ Confirmar ejercicio</button>
      </div>
    </div>
  )
}

// ─── Datos base ───────────────────────────────────────────────────────────────

function DatosBase({ form, update }: {
  form: EjercicioFormData
  update: (f: keyof EjercicioFormData, v: unknown) => void
}) {
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '12px' }}>📋 Datos del ejercicio</div>
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: '10px', marginBottom: '10px' }}>
        <select value={form.icono} onChange={e => update('icono', e.target.value)}
          style={{ border: '1.5px solid var(--border)', borderRadius: '9px', background: 'var(--bg)', fontSize: '1.3rem', cursor: 'pointer', textAlign: 'center', padding: '4px' }}>
          {ICONOS.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <input value={form.nombre_ejercicio} onChange={e => update('nombre_ejercicio', e.target.value)}
          placeholder="Nombre del ejercicio *" style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={labelStyle}>Descripción / instrucción</label>
          <input value={form.descripcion} onChange={e => update('descripcion', e.target.value)}
            placeholder="Ej. Mantén la espalda recta..." style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Repeticiones</label>
          <input type="number" value={form.repeticiones} onChange={e => update('repeticiones', e.target.value)}
            placeholder="10" min={1} style={inputStyle} />
        </div>
      </div>
    </div>
  )
}

// ─── Selector de modo ─────────────────────────────────────────────────────────

function ModoSelector({ modo, onChange }: { modo: ModoCreacion; onChange: (m: ModoCreacion) => void }) {
  const tabs: { key: ModoCreacion; label: string; desc: string }[] = [
    { key: 'catalogo_ejercicio', label: '📚 Ejercicio predefinido', desc: 'Secuencia completa lista para usar' },
    { key: 'catalogo_poses',     label: '🧩 Armar con poses',       desc: 'Elige poses del catálogo y ordénalas' },
    { key: 'personalizado',      label: '✏️ Personalizado',          desc: 'Define ángulos manualmente con el muñequito' },
  ]
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '10px' }}>🤖 Evaluación IA — elige cómo definir las poses</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            padding: '12px', borderRadius: '12px', border: `2px solid ${modo === t.key ? 'var(--blue)' : 'var(--border)'}`,
            background: modo === t.key ? 'var(--blue-xlight)' : 'var(--bg)',
            cursor: 'pointer', textAlign: 'left', transition: '.15s',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: modo === t.key ? 'var(--blue)' : 'var(--text)' }}>{t.label}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '3px' }}>{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODO 1: Catálogo de ejercicios completos
// ══════════════════════════════════════════════════════════════════════════════

function ModoCatalogoEjercicio({ form, setForm }: {
  form: EjercicioFormData
  setForm: React.Dispatch<React.SetStateAction<EjercicioFormData>>
}) {
  const [catalogo, setCatalogo]   = useState<EjercicioCatalogo[]>([])
  const [loading, setLoading]     = useState(true)
  const [categoria, setCategoria] = useState<string>('todas')
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    cargarEjerciciosCatalogo().then(data => { setCatalogo(data); setLoading(false) })
  }, [])

  const categorias = ['todas', ...Array.from(new Set(catalogo.map(e => e.categoria ?? 'general').filter(Boolean)))]

  const filtrados = categoria === 'todas'
    ? catalogo
    : catalogo.filter(e => (e.categoria ?? 'general') === categoria)

  const seleccionar = (ej: EjercicioCatalogo) => {
    setForm(prev => ({
      ...prev,
      id_ejercicio_catalogo: ej.id_ejercicio_catalogo,
      nombre_ejercicio:      prev.nombre_ejercicio || ej.nombre,
      descripcion:           prev.descripcion      || (ej.descripcion ?? ''),
      icono:                 prev.icono            === '🏋️' ? (ej.icono ?? '🏋️') : prev.icono,
      repeticiones:          prev.repeticiones     || String(ej.repeticiones_sugeridas ?? ''),
    }))
  }

  if (loading) return <LoadingState texto="Cargando catálogo..." />

  if (!catalogo.length) return (
    <div style={emptyStyle}>
      <span style={{ fontSize: '2rem' }}>📭</span>
      <div style={{ fontWeight: 700 }}>Catálogo vacío</div>
      <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>El equipo admin aún no ha cargado ejercicios predefinidos.</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Filtro por categoría */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {categorias.map(c => (
          <button 
            key={c} 
            onClick={() => setCategoria(c)} 
            style={{
              padding: '5px 12px', 
              borderRadius: '20px', 
              cursor: 'pointer', // Eliminamos border: 'none' de aquí
              background: categoria === c ? 'var(--blue)' : 'var(--bg)',
              color: categoria === c ? '#fff' : 'var(--text-mid)',
              fontWeight: categoria === c ? 700 : 500, 
              fontSize: '0.78rem',
              border: `1px solid ${categoria === c ? 'var(--blue)' : 'var(--border)'}`,
            }}
          >
            {c === 'todas' ? 'Todas' : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid de ejercicios */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {filtrados.map(ej => {
          const seleccionado = form.id_ejercicio_catalogo === ej.id_ejercicio_catalogo
          const abierto      = expandido === ej.id_ejercicio_catalogo
          return (
            <div key={ej.id_ejercicio_catalogo}
              style={{
                borderRadius: '12px', border: `2px solid ${seleccionado ? 'var(--blue)' : 'var(--border)'}`,
                background: seleccionado ? 'var(--blue-xlight)' : 'var(--bg)',
                overflow: 'hidden', cursor: 'pointer', transition: '.15s',
              }}
              onClick={() => seleccionar(ej)}
            >
              {/* Imagen de referencia */}
              {ej.imagen_url && (
                <div style={{ height: '120px', overflow: 'hidden', background: '#f0f4f8' }}>
                  <img src={ej.imagen_url} alt={ej.nombre}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{ej.icono ?? '🏋️'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: seleccionado ? 'var(--blue)' : 'var(--text)' }}>
                      {ej.nombre}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {ej.categoria && <Chip label={ej.categoria} color="blue" />}
                      <Chip
                        label={DIFICULTAD_LABEL[ej.dificultad] ?? 'Básico'}
                        customColor={DIFICULTAD_COLOR[ej.dificultad]}
                      />
                      <Chip label={`${ej.poses_secuencia.length} poses`} color="gray" />
                    </div>
                  </div>
                  {seleccionado && <span style={{ color: 'var(--blue)', fontSize: '1.1rem' }}>✓</span>}
                </div>

                {/* Expandir detalles */}
                <button
                  onClick={e => { e.stopPropagation(); setExpandido(abierto ? null : ej.id_ejercicio_catalogo) }}
                  style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--blue)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                >
                  {abierto ? '▲ Ocultar poses' : '▼ Ver poses'}
                </button>

                {abierto && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {ej.poses_secuencia.sort((a,b) => a.orden - b.orden).map((ps, i) => (
                      <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-light)', padding: '4px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.04)', display: 'flex', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{ps.orden}.</span>
                        <span>{ps.nombre_override ?? `Pose ${ps.orden}`}</span>
                        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{ps.hold_sec}s</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {form.id_ejercicio_catalogo && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#eef8d6', border: '1px solid rgba(76,160,15,0.3)', fontSize: '0.82rem', color: '#4a7c0f', fontWeight: 600 }}>
          ✅ Ejercicio seleccionado — los datos del nombre/ícono se han completado automáticamente. Puedes editarlos arriba.
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODO 2: Armar secuencia con poses del catálogo
// ══════════════════════════════════════════════════════════════════════════════

function ModoCatalogoPoses({ form, setForm }: {
  form: EjercicioFormData
  setForm: React.Dispatch<React.SetStateAction<EjercicioFormData>>
}) {
  const [catalogo, setCatalogo]   = useState<PoseCatalogo[]>([])
  const [loading, setLoading]     = useState(true)
  const [categoria, setCategoria] = useState<string>('todas')
  const [showPicker, setShowPicker] = useState(false)

  const poses: PoseCatalogoPose[] = form._poses_catalogo ?? []

  useEffect(() => {
    cargarPosesCatalogo().then(data => { setCatalogo(data); setLoading(false) })
  }, [])

  const categorias = ['todas', ...Array.from(new Set(catalogo.map(p => p.categoria ?? 'general').filter(Boolean)))]
  const filtradas = categoria === 'todas' ? catalogo : catalogo.filter(p => (p.categoria ?? 'general') === categoria)

  const agregarPose = (pose: PoseCatalogo) => {
    const nueva: PoseCatalogoPose = {
      tmpId:     crypto.randomUUID(),
      id_pose:   pose.id_pose,
      nombre:    pose.nombre,
      imagen_url: pose.imagen_url,
      hold_sec:  3,
      keypoints: pose.keypoints,
    }
    setForm(prev => ({ ...prev, _poses_catalogo: [...(prev._poses_catalogo ?? []), nueva] }))
    setShowPicker(false)
  }

  const quitarPose = (tmpId: string) =>
    setForm(prev => ({ ...prev, _poses_catalogo: (prev._poses_catalogo ?? []).filter(p => p.tmpId !== tmpId) }))

  const updateHoldSec = (tmpId: string, v: number) =>
    setForm(prev => ({ ...prev, _poses_catalogo: (prev._poses_catalogo ?? []).map(p => p.tmpId === tmpId ? { ...p, hold_sec: v } : p) }))

  const moverArriba = (idx: number) => {
    if (idx === 0) return
    setForm(prev => {
      const arr = [...(prev._poses_catalogo ?? [])]
      ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
      return { ...prev, _poses_catalogo: arr }
    })
  }

  const moverAbajo = (idx: number) => {
    setForm(prev => {
      const arr = [...(prev._poses_catalogo ?? [])]
      if (idx >= arr.length - 1) return prev
      ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
      return { ...prev, _poses_catalogo: arr }
    })
  }

  if (loading) return <LoadingState texto="Cargando poses..." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Secuencia armada */}
      {poses.length > 0 && (
        <div style={{ borderRadius: '12px', border: '1.5px solid var(--blue)', background: 'var(--blue-xlight)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--blue)' }}>🎬 Secuencia armada</div>
          {poses.map((pose, idx) => (
            <div key={pose.tmpId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(75,179,214,0.2)' }}>
              <span style={{ background: 'var(--blue)', color: '#fff', borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>{idx + 1}</span>

              {pose.imagen_url && (
                <img src={pose.imagen_url} alt={pose.nombre}
                  style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' }}>{pose.nombre}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{pose.keypoints.length} articulaciones</div>
              </div>

              {/* Hold sec */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>Mantener</span>
                <input type="number" min={1} max={30} value={pose.hold_sec}
                  onChange={e => updateHoldSec(pose.tmpId, parseFloat(e.target.value) || 1)}
                  style={{ width: '44px', padding: '3px 6px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem', textAlign: 'center', fontWeight: 700 }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>s</span>
              </div>

              {/* Ordenar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                <button onClick={() => moverArriba(idx)} disabled={idx === 0}
                  style={{ ...btnIcono, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                <button onClick={() => moverAbajo(idx)} disabled={idx === poses.length - 1}
                  style={{ ...btnIcono, opacity: idx === poses.length - 1 ? 0.3 : 1 }}>▼</button>
              </div>

              <button onClick={() => quitarPose(pose.tmpId)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '1rem', opacity: 0.7, flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Botón para agregar pose */}
      <button onClick={() => setShowPicker(!showPicker)} style={{
        padding: '12px', borderRadius: '12px', border: '2px dashed var(--blue)',
        background: showPicker ? 'var(--blue-xlight)' : 'transparent',
        color: 'var(--blue)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
      }}>
        {showPicker ? '✕ Cerrar catálogo' : '+ Agregar pose del catálogo'}
      </button>

      {/* Picker de poses */}
      {showPicker && (
        <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {categorias.map(c => (
              <button key={c} onClick={() => setCategoria(c)} style={{
                padding: '4px 10px', borderRadius: '20px', border: `1px solid ${categoria === c ? 'var(--blue)' : 'var(--border)'}`,
                background: categoria === c ? 'var(--blue)' : 'transparent',
                color: categoria === c ? '#fff' : 'var(--text-mid)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600,
              }}>
                {c === 'todas' ? 'Todas' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {filtradas.map(pose => (
              <button key={pose.id_pose} onClick={() => agregarPose(pose)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                borderRadius: '10px', border: '1.5px solid var(--border)', background: 'white',
                cursor: 'pointer', textAlign: 'left', transition: '.1s',
              }}>
                {pose.imagen_url
                  ? <img src={pose.imagen_url} alt={pose.nombre} style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'var(--blue-xlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🤸</div>
                }
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' }}>{pose.nombre}</div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    {pose.categoria && <Chip label={pose.categoria} color="blue" />}
                    <Chip label={DIFICULTAD_LABEL[pose.dificultad] ?? 'Básico'} customColor={DIFICULTAD_COLOR[pose.dificultad]} />
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: '3px' }}>
                    {pose.keypoints.length} articulaciones
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODO 3: Personalizado (builder libre — comportamiento previo)
// ══════════════════════════════════════════════════════════════════════════════

function ModoPersonalizado({ form, setForm }: {
  form: EjercicioFormData
  setForm: React.Dispatch<React.SetStateAction<EjercicioFormData>>
}) {
  const [articulaciones, setArticulaciones] = useState<Articulacion[]>([])
  const [loadingArts, setLoadingArts]       = useState(true)

  useEffect(() => {
    supabase
      .from('ai_articulacion_config')
      .select('id_articulacion, nombre_articulacion, puntos_mediapipe')
      .order('nombre_articulacion')
      .then(({ data }) => { setArticulaciones(data ?? []); setLoadingArts(false) })
  }, [])

  const update = (field: keyof EjercicioFormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const addPose = () => {
    const n = form.secuencia_poses.length + 1
    update('secuencia_poses', [
      ...form.secuencia_poses,
      { tmpId: crypto.randomUUID(), orden: n, nombre: `Pose ${n}`, hold_sec: 1, articulaciones: [] },
    ])
  }

  const removePose = (tmpId: string) =>
    update('secuencia_poses',
      form.secuencia_poses.filter(p => p.tmpId !== tmpId).map((p, i) => ({ ...p, orden: i + 1 }))
    )

  const updatePoseField = (tmpId: string, field: 'nombre' | 'hold_sec', value: string | number) =>
    update('secuencia_poses', form.secuencia_poses.map(p => p.tmpId !== tmpId ? p : {
      ...p, [field]: field === 'hold_sec' ? (parseFloat(value as string) || 0) : value,
    }))

  const addArticulacion = (poseTmpId: string, art: Articulacion) =>
    update('secuencia_poses', form.secuencia_poses.map(p => {
      if (p.tmpId !== poseTmpId) return p
      if (p.articulaciones.find(a => a.id_articulacion === art.id_articulacion)) return p
      return {
        ...p, articulaciones: [...p.articulaciones, {
          id_articulacion: art.id_articulacion,
          nombre_articulacion: art.nombre_articulacion,
          angulo: defaultAngulo(art.nombre_articulacion),
          tolerancia: defaultTolerancia(art.nombre_articulacion),
        }],
      }
    }))

  const removeArticulacion = (poseTmpId: string, id_articulacion: string) =>
    update('secuencia_poses', form.secuencia_poses.map(p =>
      p.tmpId !== poseTmpId ? p : { ...p, articulaciones: p.articulaciones.filter(a => a.id_articulacion !== id_articulacion) }
    ))

  const updateAngulo = useCallback((poseTmpId: string, nombre_articulacion: string, nuevoAngulo: number) =>
    setForm(prev => ({
      ...prev,
      secuencia_poses: prev.secuencia_poses.map(p =>
        p.tmpId !== poseTmpId ? p : {
          ...p, articulaciones: p.articulaciones.map(a =>
            a.nombre_articulacion !== nombre_articulacion ? a : { ...a, angulo: nuevoAngulo }
          ),
        }
      ),
    })), [])

  const updateTolerancia = useCallback((poseTmpId: string, id_articulacion: string, value: number) =>
    setForm(prev => ({
      ...prev,
      secuencia_poses: prev.secuencia_poses.map(p =>
        p.tmpId !== poseTmpId ? p : {
          ...p, articulaciones: p.articulaciones.map(a =>
            a.id_articulacion !== id_articulacion ? a : { ...a, tolerancia: value }
          ),
        }
      ),
    })), [])

  return (
    <div style={{ borderRadius: '12px', border: '1.5px solid var(--border)', background: '#fffbf0', padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>
          ✏️ Definición manual de poses
        </div>
        <button onClick={addPose} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
          + Añadir pose
        </button>
      </div>

      <div style={{ padding: '10px 14px', borderRadius: '9px', background: '#fff3cd', border: '1px solid #ffc107', fontSize: '0.78rem', color: '#856404' }}>
        ⚠️ Modo avanzado — requiere conocimiento de los ángulos MediaPipe. Usar solo si las poses del catálogo no cubren el caso clínico.
      </div>

      {form.secuencia_poses.length === 0 ? (
        <div style={{ padding: '20px', borderRadius: '10px', border: '1.5px dashed rgba(0,0,0,0.15)', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-light)', opacity: 0.6 }}>
          Sin poses — el ejercicio no tendrá evaluación IA
        </div>
      ) : form.secuencia_poses.map((pose, idx) => (
        <PoseCard
          key={pose.tmpId}
          pose={pose}
          index={idx}
          articulacionesDisponibles={articulaciones}
          loadingArts={loadingArts}
          onUpdateField={(field, value) => updatePoseField(pose.tmpId, field, value)}
          onAddArt={art => addArticulacion(pose.tmpId, art)}
          onRemoveArt={id => removeArticulacion(pose.tmpId, id)}
          onAnguloChange={(nombre, angulo) => updateAngulo(pose.tmpId, nombre, angulo)}
          onToleranciaChange={(id, v) => updateTolerancia(pose.tmpId, id, v)}
          onRemove={() => removePose(pose.tmpId)}
        />
      ))}
    </div>
  )
}

// ─── PoseCard (igual que antes — sin cambios) ─────────────────────────────────

function PoseCard({ pose, index, articulacionesDisponibles, loadingArts, onUpdateField, onAddArt, onRemoveArt, onAnguloChange, onToleranciaChange, onRemove }: {
  pose: Pose; index: number; articulacionesDisponibles: Articulacion[]; loadingArts: boolean
  onUpdateField: (f: 'nombre' | 'hold_sec', v: string | number) => void
  onAddArt: (a: Articulacion) => void; onRemoveArt: (id: string) => void
  onAnguloChange: (n: string, a: number) => void; onToleranciaChange: (id: string, v: number) => void
  onRemove: () => void
}) {
  const [showSelector, setShowSelector] = useState(false)
  const disponibles = articulacionesDisponibles.filter(a => !pose.articulaciones.find(pa => pa.id_articulacion === a.id_articulacion))

  return (
    <div style={{ borderRadius: '12px', border: '1px solid rgba(75,179,214,0.3)', background: 'rgba(255,255,255,0.95)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'rgba(75,179,214,0.08)', borderBottom: '1px solid rgba(75,179,214,0.15)' }}>
        <span style={{ background: 'var(--blue)', color: '#fff', borderRadius: '6px', padding: '2px 9px', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>Pose {index + 1}</span>
        <input value={pose.nombre} onChange={e => onUpdateField('nombre', e.target.value)}
          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', outline: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Mantener</span>
          <input type="number" min={0} max={15} step={0.5} value={pose.hold_sec ?? 0}
            onChange={e => onUpdateField('hold_sec', parseFloat(e.target.value) || 0)}
            style={{ width: '48px', padding: '3px 6px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem', textAlign: 'center', fontWeight: 700 }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>s</span>
        </div>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '1rem', opacity: 0.6 }}>✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '200px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 8px', borderRight: '1px solid rgba(75,179,214,0.1)' }}>
          <MunequitoReferencia articulaciones={pose.articulaciones} onAnguloChange={onAnguloChange} size={1.0} mostrarLeyenda={true} />
        </div>
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          {pose.articulaciones.map(art => (
            <ArticulacionRow key={art.id_articulacion} art={art}
              onChangeAngulo={v => onAnguloChange(art.nombre_articulacion, v)}
              onChangeTol={v => onToleranciaChange(art.id_articulacion, v)}
              onRemove={() => onRemoveArt(art.id_articulacion)} />
          ))}
          {disponibles.length > 0 && (
            <div>
              <button onClick={() => setShowSelector(!showSelector)}
                style={{ width: '100%', padding: '8px', borderRadius: '9px', border: '1.5px dashed var(--blue)', background: 'transparent', color: 'var(--blue)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                {showSelector ? '✕ Cerrar' : '+ Agregar articulación'}
              </button>
              {showSelector && (
                <div style={{ marginTop: '8px', borderRadius: '10px', border: '1px solid var(--blue)', background: '#f8fcff', padding: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {loadingArts
                    ? <div style={{ fontSize: '0.78rem', opacity: 0.5, gridColumn: 'span 2' }}>Cargando...</div>
                    : disponibles.map(a => (
                      <button key={a.id_articulacion} onClick={() => { onAddArt(a); setShowSelector(false) }}
                        style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}>
                        {articulacionIcon(a.nombre_articulacion)} {a.nombre_articulacion}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ArticulacionRow (igual que antes) ────────────────────────────────────────

function ArticulacionRow({ art, onChangeAngulo, onChangeTol, onRemove }: {
  art: PoseArticulacion; onChangeAngulo: (v: number) => void
  onChangeTol: (v: number) => void; onRemove: () => void
}) {
  return (
    <div style={{ borderRadius: '10px', border: '1px solid rgba(75,179,214,0.25)', background: 'white', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'rgba(75,179,214,0.06)', borderBottom: '1px solid rgba(75,179,214,0.12)' }}>
        <span style={{ fontSize: '1rem' }}>{articulacionIcon(art.nombre_articulacion)}</span>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', flex: 1 }}>{art.nombre_articulacion}</span>
        <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--blue)', minWidth: '42px', textAlign: 'right' }}>{art.angulo}°</span>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '0.85rem', opacity: 0.6 }}>✕</button>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Ángulo objetivo</label>
          </div>
          <input type="range" min={0} max={180} step={1} value={art.angulo}
            onChange={e => onChangeAngulo(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--blue)', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-light)', marginTop: '2px' }}>
            <span>0°</span><span>90°</span><span>180°</span>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Tolerancia</label>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>
              ±{art.tolerancia}° → {Math.max(0, art.angulo - art.tolerancia)}°–{Math.min(180, art.angulo + art.tolerancia)}°
            </span>
          </div>
          <input type="range" min={5} max={40} step={1} value={art.tolerancia}
            onChange={e => onChangeTol(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#6c8fc7', cursor: 'pointer', opacity: 0.8 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-light)', marginTop: '2px' }}>
            <span>Estricto (5°)</span><span>Amplio (40°)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers pequeños ─────────────────────────────────────────────────────────

function articulacionIcon(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('codo'))    return '💪'
  if (n.includes('hombro'))  return '🦾'
  if (n.includes('rodilla')) return '🦵'
  if (n.includes('cadera'))  return '🏃'
  if (n.includes('tobillo')) return '🦶'
  if (n.includes('tronco'))  return '🧍'
  if (n.includes('cuello'))  return '🙆'
  return '⚙️'
}

function Chip({ label, color, customColor }: { label: string; color?: 'blue' | 'green' | 'gray'; customColor?: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    blue:  { bg: 'var(--blue-xlight)', fg: 'var(--blue)' },
    green: { bg: '#eef8d6',           fg: '#4a7c0f'      },
    gray:  { bg: '#f0f0f0',           fg: '#777'         },
  }
  const c = color ? colors[color] : { bg: `${customColor}18`, fg: customColor ?? '#777' }
  return (
    <span style={{ background: c.bg, color: c.fg, borderRadius: '6px', padding: '2px 7px', fontSize: '0.68rem', fontWeight: 700 }}>
      {label}
    </span>
  )
}

function LoadingState({ texto }: { texto: string }) {
  return <div style={{ padding: '30px', textAlign: 'center', opacity: 0.4, fontSize: '0.85rem' }}>{texto}</div>
}

const emptyStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', padding: '40px 20px', gap: '8px', opacity: 0.5,
}

const btnIcono: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: '4px',
  fontSize: '0.65rem', cursor: 'pointer', color: 'var(--text-mid)', padding: '1px 5px', lineHeight: 1.4,
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '9px',
  border: '1.5px solid var(--border)', background: '#fff',
  fontSize: '0.85rem', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600,
  color: 'var(--text-light)', marginBottom: '5px',
}
const btnPrimary: React.CSSProperties = {
  background: 'var(--blue)', color: '#fff', border: 'none',
  borderRadius: '9px', padding: '9px 18px', fontWeight: 700, fontSize: '0.82rem',
  cursor: 'pointer', fontFamily: 'inherit',
}
const btnOutline: React.CSSProperties = {
  background: 'transparent', border: '1.5px solid var(--border)',
  color: 'var(--text-mid)', borderRadius: '9px', padding: '9px 18px',
  fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
}
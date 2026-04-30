'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface Articulacion {
  id_articulacion: string
  nombre_articulacion: string
  puntos_mediapipe: string[]
}

// Una articulación dentro de una pose, con su ángulo
export interface PoseArticulacion {
  id_articulacion: string
  nombre_articulacion: string   // desnormalizado para el UI
  angulo: number
  tolerancia: number
}

// Una pose = un keyframe con N articulaciones
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
}

const ICONOS = ['🏋️','🦵','💪','🤸','🧘','🚶','🏃','🔄','⬆️','🎯','🦶','🙌','🖐️','🫀']

const defaultEjercicio = (): EjercicioFormData => ({
  nombre_ejercicio: '',
  descripcion: '',
  video_muestra: '',
  icono: '🏋️',
  repeticiones: '',
  secuencia_poses: [],
  guardar_en_biblioteca: true,
  tiene_override: false,
})

interface EjercicioBuilderProps {
  ejercicioInicial?: EjercicioFormData
  mostrarOpcionBiblioteca?: boolean
  onConfirmar: (data: EjercicioFormData) => void
  onCancelar: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export function EjercicioBuilder({
  ejercicioInicial,
  mostrarOpcionBiblioteca = true,
  onConfirmar,
  onCancelar,
}: EjercicioBuilderProps) {
  const [form, setForm]                     = useState<EjercicioFormData>(ejercicioInicial ?? defaultEjercicio())
  const [articulaciones, setArticulaciones] = useState<Articulacion[]>([])
  const [loadingArts, setLoadingArts]       = useState(true)
  const [error, setError]                   = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('ai_articulacion_config')
      .select('id_articulacion, nombre_articulacion, puntos_mediapipe')
      .order('nombre_articulacion')
      .then(({ data }) => { setArticulaciones(data ?? []); setLoadingArts(false) })
  }, [])

  const update = (field: keyof EjercicioFormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  // ── Poses ──────────────────────────────────────────────────────────────────
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
      ...p,
      [field]: field === 'hold_sec'
        ? (parseFloat(value as string) || 0)  // NaN → 0
        : value,
    }))

  // Agregar articulación a una pose
  const addArticulacion = (poseTmpId: string, art: Articulacion) =>
    update('secuencia_poses', form.secuencia_poses.map(p => {
      if (p.tmpId !== poseTmpId) return p
      if (p.articulaciones.find(a => a.id_articulacion === art.id_articulacion)) return p // ya existe
      return {
        ...p,
        articulaciones: [
          ...p.articulaciones,
          { id_articulacion: art.id_articulacion, nombre_articulacion: art.nombre_articulacion, angulo: 90, tolerancia: 10 },
        ],
      }
    }))

  const removeArticulacion = (poseTmpId: string, id_articulacion: string) =>
    update('secuencia_poses', form.secuencia_poses.map(p =>
      p.tmpId !== poseTmpId ? p : { ...p, articulaciones: p.articulaciones.filter(a => a.id_articulacion !== id_articulacion) }
    ))

  const updateArticulacion = (poseTmpId: string, id_articulacion: string, field: 'angulo' | 'tolerancia', value: number) =>
    update('secuencia_poses', form.secuencia_poses.map(p =>
      p.tmpId !== poseTmpId ? p : {
        ...p,
        articulaciones: p.articulaciones.map(a =>
          a.id_articulacion !== id_articulacion ? a : { ...a, [field]: value }
        ),
      }
    ))

  const confirmar = () => {
    if (!form.nombre_ejercicio.trim()) { setError('El nombre del ejercicio es obligatorio'); return }
    setError(null)
    onConfirmar(form)
  }

  return (
    <div style={{ background: 'var(--bg)', borderRadius: '14px', border: '1.5px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Datos base */}
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
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>URL de video demostrativo (opcional)</label>
            <input value={form.video_muestra} onChange={e => update('video_muestra', e.target.value)}
              placeholder="https://youtube.com/..." style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Secuencia de poses */}
      <div style={{ borderRadius: '12px', border: '1.5px solid var(--blue)', background: 'var(--blue-xlight)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--blue)' }}>🤖 Secuencia de poses</div>
          <button onClick={addPose} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            + Añadir pose
          </button>
        </div>

        {/* Timeline resumen */}
        {form.secuencia_poses.length > 0 && (
          <TimelinePoses poses={form.secuencia_poses} />
        )}

        {form.secuencia_poses.length === 0 ? (
          <div style={{ padding: '20px', borderRadius: '10px', border: '1.5px dashed rgba(75,179,214,0.4)', textAlign: 'center', fontSize: '0.82rem', color: 'var(--blue)', opacity: 0.6 }}>
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
            onUpdateArt={(id, field, value) => updateArticulacion(pose.tmpId, id, field, value)}
            onRemove={() => removePose(pose.tmpId)}
          />
        ))}
      </div>

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
        <button onClick={confirmar} style={btnPrimary}>✅ Confirmar ejercicio</button>
      </div>
    </div>
  )
}

// ─── Timeline resumen ─────────────────────────────────────────────────────────
function TimelinePoses({ poses }: { poses: Pose[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(75,179,214,0.2)', overflowX: 'auto', gap: '2px' }}>
      {poses.map((pose, idx) => (
        <div key={pose.tmpId} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ background: 'var(--blue)', color: '#fff', borderRadius: '10px', padding: '4px 10px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
              {pose.nombre}
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '120px' }}>
              {pose.articulaciones.map(a => (
                <span key={a.id_articulacion} style={{ fontSize: '0.6rem', background: 'rgba(75,179,214,0.15)', color: 'var(--blue)', borderRadius: '4px', padding: '1px 5px', fontWeight: 600 }}>
                  {a.nombre_articulacion.split(' ')[0]} {a.angulo}°
                </span>
              ))}
              {pose.articulaciones.length === 0 && (
                <span style={{ fontSize: '0.6rem', color: '#ccc' }}>sin articulaciones</span>
              )}
            </div>
          </div>
          {idx < poses.length - 1 && (
            <div style={{ width: '28px', height: '2px', background: 'var(--blue)', opacity: 0.3, margin: '0 4px', flexShrink: 0 }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── PoseCard ─────────────────────────────────────────────────────────────────
function PoseCard({
  pose, index, articulacionesDisponibles, loadingArts,
  onUpdateField, onAddArt, onRemoveArt, onUpdateArt, onRemove,
}: {
  pose: Pose
  index: number
  articulacionesDisponibles: Articulacion[]
  loadingArts: boolean
  onUpdateField: (field: 'nombre' | 'hold_sec', value: string | number) => void
  onAddArt: (art: Articulacion) => void
  onRemoveArt: (id: string) => void
  onUpdateArt: (id: string, field: 'angulo' | 'tolerancia', value: number) => void
  onRemove: () => void
}) {
  const [showSelector, setShowSelector] = useState(false)

  // Articulaciones que aún no están en esta pose
  const disponibles = articulacionesDisponibles.filter(
    a => !pose.articulaciones.find(pa => pa.id_articulacion === a.id_articulacion)
  )

  return (
    <div style={{ borderRadius: '12px', border: '1px solid rgba(75,179,214,0.3)', background: 'rgba(255,255,255,0.95)', overflow: 'hidden', boxShadow: '0 2px 10px rgba(75,179,214,0.1)' }}>

      {/* Header pose */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'rgba(75,179,214,0.08)', borderBottom: '1px solid rgba(75,179,214,0.15)' }}>
        <span style={{ background: 'var(--blue)', color: '#fff', borderRadius: '6px', padding: '2px 9px', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>
          Pose {index + 1}
        </span>
        <input value={pose.nombre} onChange={e => onUpdateField('nombre', e.target.value)}
          placeholder="Nombre de la pose (ej. T-Pose)"
          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', outline: 'none' }} />

        {/* Hold sec */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Mantener</span>
          <input type="number" value={pose.hold_sec} min={0} max={15} step={0.5}
            onChange={e => onUpdateField('hold_sec', e.target.value)}
            value={pose.hold_sec ?? 0}
            style={{ width: '48px', padding: '3px 6px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem', textAlign: 'center', fontWeight: 700, background: 'white' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>s</span>
        </div>

        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '1rem', opacity: 0.6, flexShrink: 0 }}>✕</button>
      </div>

      {/* Cuerpo: muñequito + articulaciones */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: '220px' }}>

        {/* Muñequito */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 8px', background: 'rgba(75,179,214,0.03)', borderRight: '1px solid rgba(75,179,214,0.1)' }}>
          <MunequitoMulti articulaciones={pose.articulaciones} />
          {pose.articulaciones.length === 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', textAlign: 'center', marginTop: '8px', opacity: 0.6 }}>
              Agrega articulaciones →
            </div>
          )}
        </div>

        {/* Panel de articulaciones */}
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Lista de articulaciones activas */}
          {pose.articulaciones.map(art => (
            <ArticulacionSlider
              key={art.id_articulacion}
              art={art}
              onChangeAngulo={v => onUpdateArt(art.id_articulacion, 'angulo', v)}
              onChangeTol={v => onUpdateArt(art.id_articulacion, 'tolerancia', v)}
              onRemove={() => onRemoveArt(art.id_articulacion)}
            />
          ))}

          {/* Botón agregar articulación */}
          {disponibles.length > 0 && (
            <div>
              <button
                onClick={() => setShowSelector(!showSelector)}
                style={{ width: '100%', padding: '8px', borderRadius: '9px', border: '1.5px dashed var(--blue)', background: 'transparent', color: 'var(--blue)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {showSelector ? '✕ Cerrar' : '+ Agregar articulación'}
              </button>

              {showSelector && (
                <div style={{ marginTop: '8px', borderRadius: '10px', border: '1px solid var(--blue)', background: '#f8fcff', padding: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {loadingArts ? (
                    <div style={{ fontSize: '0.78rem', opacity: 0.5, gridColumn: 'span 2' }}>Cargando...</div>
                  ) : disponibles.map(a => (
                    <button
                      key={a.id_articulacion}
                      onClick={() => { onAddArt(a); setShowSelector(false) }}
                      style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', textAlign: 'left', transition: '.15s' }}
                    >
                      {articulacionIcon(a.nombre_articulacion)} {a.nombre_articulacion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {pose.articulaciones.length === 0 && !showSelector && disponibles.length === 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontStyle: 'italic', padding: '8px 0' }}>
              Todas las articulaciones ya están en esta pose
            </div>
          )}
        </div>
      </div>

      {/* Footer: validación simultánea */}
      {pose.articulaciones.length > 1 && (
        <div style={{ padding: '8px 16px', background: '#eef8d6', borderTop: '1px solid rgba(76,160,15,0.2)', fontSize: '0.72rem', color: '#4a7c0f', fontWeight: 600 }}>
          ✅ La IA validará esta pose cuando las {pose.articulaciones.length} articulaciones estén en rango simultáneamente
        </div>
      )}
    </div>
  )
}

// ─── Slider por articulación ──────────────────────────────────────────────────
function ArticulacionSlider({ art, onChangeAngulo, onChangeTol, onRemove }: {
  art: PoseArticulacion
  onChangeAngulo: (v: number) => void
  onChangeTol: (v: number) => void
  onRemove: () => void
}) {
  return (
    <div style={{ borderRadius: '10px', border: '1px solid rgba(75,179,214,0.25)', background: 'white', overflow: 'hidden' }}>
      {/* Nombre articulación */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'rgba(75,179,214,0.06)', borderBottom: '1px solid rgba(75,179,214,0.12)' }}>
        <span style={{ fontSize: '1rem' }}>{articulacionIcon(art.nombre_articulacion)}</span>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', flex: 1 }}>{art.nombre_articulacion}</span>
        <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--blue)', minWidth: '42px', textAlign: 'right' }}>{art.angulo}°</span>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '0.85rem', opacity: 0.6 }}>✕</button>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Ángulo */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Ángulo objetivo</label>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>{describeAngulo(art.angulo, art.nombre_articulacion)}</span>
          </div>
          <input type="range" min={0} max={180} step={5} value={art.angulo}
            onChange={e => onChangeAngulo(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--blue)', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-light)', marginTop: '2px' }}>
            <span>0°</span><span>90°</span><span>180°</span>
          </div>
        </div>

        {/* Tolerancia */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Tolerancia</label>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>±{art.tolerancia}° → {Math.max(0, art.angulo - art.tolerancia)}°–{Math.min(180, art.angulo + art.tolerancia)}°</span>
          </div>
          <input type="range" min={1} max={30} step={1} value={art.tolerancia}
            onChange={e => onChangeTol(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#6c8fc7', cursor: 'pointer' }} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUÑEQUITO MULTI-ARTICULACIÓN
// Muestra el cuerpo completo con todas las articulaciones activas coloreadas
// ═══════════════════════════════════════════════════════════════════════════════
function MunequitoMulti({ articulaciones }: { articulaciones: PoseArticulacion[] }) {
  const get = (keyword: string) =>
    articulaciones.find(a => a.nombre_articulacion.toLowerCase().includes(keyword))

  const codoDer   = get('codo derecho')   ?? get('codo der')
  const codoIzq   = get('codo izquierdo') ?? get('codo izq')
  const hombroDer = get('hombro derecho') ?? get('hombro der')
  const hombroIzq = get('hombro izquierdo') ?? get('hombro izq')
  const caderaDer = get('cadera derecha') ?? get('cadera der')
  const caderaIzq = get('cadera izquierda') ?? get('cadera izq')
  const rodillaDer = get('rodilla derecha') ?? get('rodilla der')
  const rodillaIzq = get('rodilla izquierda') ?? get('rodilla izq')
  const tobilloDer = get('tobillo derecho') ?? get('tobillo der')
  const tobilloIzq = get('tobillo izquierdo') ?? get('tobillo izq')
  const tronco    = get('tronco')
  const cuello    = get('cuello')

  // Colores
  const ACTIVE = '#378ADD'
  const RED    = '#E24B4A'
  const DARK   = '#185FA5'
  const GRAY   = '#b0aea6'
  const SKIN   = '#D8D6CC'
  const W      = 3.5
  const WG     = 2

  // Geometría base del cuerpo
  const CX = 90
  // Cabeza
  const HCX = CX, HCY = 22
  // Cuello
  const NECK = { x: CX, y: 36 }
  // Hombros
  const SHR = { x: CX + 26, y: 50 }  // hombro derecho
  const SHL = { x: CX - 26, y: 50 }  // hombro izquierdo
  // Torso
  const HIP  = { x: CX,     y: 112 }
  const HIPR = { x: CX + 16, y: 115 }
  const HIPL = { x: CX - 16, y: 115 }

  // ── Cálculo de segmentos activos ──────────────────────────────────────────
  const d2r = (d: number) => d * Math.PI / 180

  // CODO DERECHO: hombro → codo → muñeca
  const elbowDerPos = { x: SHR.x + 24, y: SHR.y + 44 }
  const wristDer = codoDer ? {
    x: elbowDerPos.x + 40 * Math.sin(d2r(codoDer.angulo)) * 0.6,
    y: elbowDerPos.y + 40 * Math.cos(d2r(180 - codoDer.angulo)),
  } : { x: elbowDerPos.x + 10, y: elbowDerPos.y + 34 }

  // CODO IZQUIERDO
  const elbowIzqPos = { x: SHL.x - 24, y: SHL.y + 44 }
  const wristIzq = codoIzq ? {
    x: elbowIzqPos.x - 40 * Math.sin(d2r(codoIzq.angulo)) * 0.6,
    y: elbowIzqPos.y + 40 * Math.cos(d2r(180 - codoIzq.angulo)),
  } : { x: elbowIzqPos.x - 10, y: elbowIzqPos.y + 34 }

  // HOMBRO DERECHO: ángulo = elevación del brazo (0=abajo, 180=arriba)
  const armAngleDer = hombroDer ? -(hombroDer.angulo) + 90 : -80
  const elbowHombroDer = {
    x: SHR.x + 42 * Math.cos(d2r(armAngleDer)),
    y: SHR.y - 42 * Math.sin(d2r(armAngleDer)),
  }
  const wristHombroDer = {
    x: elbowHombroDer.x + 32 * Math.cos(d2r(armAngleDer)),
    y: elbowHombroDer.y - 32 * Math.sin(d2r(armAngleDer)),
  }

  // HOMBRO IZQUIERDO
  const armAngleIzq = hombroIzq ? (hombroIzq.angulo) - 90 : 80
  const elbowHombroIzq = {
    x: SHL.x - 42 * Math.cos(d2r(armAngleIzq)),
    y: SHL.y - 42 * Math.sin(d2r(armAngleIzq)),
  }
  const wristHombroIzq = {
    x: elbowHombroIzq.x - 32 * Math.cos(d2r(armAngleIzq)),
    y: elbowHombroIzq.y - 32 * Math.sin(d2r(armAngleIzq)),
  }

  // Función rodilla
  const calcRodilla = (hip: typeof HIPR, lado: 1 | -1, rodilla?: PoseArticulacion) => {
    const knee = { x: hip.x + lado * 5, y: hip.y + 46 }
    const ang  = rodilla ? (180 - rodilla.angulo) : 0
    const ankle = {
      x: knee.x - lado * 46 * Math.sin(d2r(ang)) * 0.7,
      y: knee.y + 46 * Math.cos(d2r(ang)) * (rodilla && rodilla.angulo < 90 ? 0.7 : 1),
    }
    return { knee, ankle }
  }

  const { knee: kneeDer, ankle: ankleDer } = calcRodilla(HIPR, 1, rodillaDer)
  const { knee: kneeIzq, ankle: ankleIzq } = calcRodilla(HIPL, -1, rodillaIzq)

  // Función cadera
  const calcCadera = (hip: typeof HIPR, lado: 1 | -1, cadera?: PoseArticulacion) => {
    const ang   = cadera ? cadera.angulo - 90 : -85
    const thigh = {
      x: hip.x + 46 * Math.sin(d2r(ang)) * lado * 0.4,
      y: hip.y + 46 * Math.cos(d2r(ang - 10)) * (cadera && cadera.angulo > 90 ? 1 : -0.5),
    }
    const shin = { x: thigh.x + lado * 3, y: thigh.y + 40 }
    return { thigh, shin }
  }

  const { thigh: thighDerC, shin: shinDerC } = calcCadera(HIPR, 1, caderaDer)
  const { thigh: thighIzqC, shin: shinIzqC } = calcCadera(HIPL, -1, caderaIzq)

  // Función tobillo
  const calcTobillo = (knee: {x:number,y:number}, lado: 1 | -1, tobillo?: PoseArticulacion) => {
    const ankle = { x: knee.x + lado * 2, y: knee.y + 46 }
    const footA = tobillo ? tobillo.angulo - 90 : 0
    const toe   = {
      x: ankle.x + 28 * Math.cos(d2r(footA)) * lado,
      y: ankle.y + 28 * Math.sin(d2r(footA)) * 0.4,
    }
    return { ankle, toe }
  }

  const { ankle: ankleDerT, toe: toeDer } = calcTobillo(kneeDer, 1, tobilloDer)
  const { ankle: ankleIzqT, toe: toeIzq } = calcTobillo(kneeIzq, -1, tobilloIzq)

  // Cuello tilt
  const neckTilt  = cuello ? cuello.angulo - 90 : 0
  const headFinalX = HCX + 18 * Math.sin(d2r(neckTilt))

  // Tronco
  const trunkTilt = tronco ? (180 - tronco.angulo) * 0.4 : 0
  const hipFinalX = HIP.x + 10 * Math.sin(d2r(trunkTilt))

  // Helpers
  const isActive = (a?: PoseArticulacion) => !!a
  const segColor = (a?: PoseArticulacion) => isActive(a) ? ACTIVE : GRAY
  const segW     = (a?: PoseArticulacion) => isActive(a) ? W : WG

  // Brazo derecho: prioridad hombro > codo > inactivo
  const useHombroDer = !!hombroDer
  const useCodoDer   = !!codoDer && !hombroDer

  // Brazo izquierdo
  const useHombroIzq = !!hombroIzq
  const useCodoIzq   = !!codoIzq && !hombroIzq

  // Pierna derecha: prioridad cadera > rodilla > tobillo
  const useCaderaDer  = !!caderaDer
  const useRodillaDer = !!rodillaDer && !caderaDer
  const useTobilloDer = !!tobilloDer && !caderaDer && !rodillaDer

  // Pierna izquierda
  const useCaderaIzq  = !!caderaIzq
  const useRodillaIzq = !!rodillaIzq && !caderaIzq
  const useTobilloIzq = !!tobilloIzq && !caderaIzq && !rodillaIzq

  return (
    <svg width="180" height="280" viewBox="0 0 180 280" style={{ display: 'block' }}>

      {/* CABEZA */}
      <circle cx={headFinalX} cy={HCY} r={13} fill="none" stroke={cuello ? RED : GRAY} strokeWidth={cuello ? 2.5 : 2}/>

      {/* CUELLO */}
      <line x1={headFinalX} y1={HCY + 13} x2={NECK.x} y2={NECK.y} stroke={cuello ? RED : GRAY} strokeWidth={cuello ? 2.5 : 2} strokeLinecap="round"/>

      {/* TORSO */}
      <line x1={NECK.x} y1={NECK.y} x2={hipFinalX} y2={HIP.y} stroke={tronco ? RED : GRAY} strokeWidth={tronco ? 3 : 2.5} strokeLinecap="round"/>

      {/* HOMBROS */}
      <line x1={SHL.x} y1={SHL.y} x2={SHR.x} y2={SHR.y} stroke={GRAY} strokeWidth={2.5} strokeLinecap="round"/>

      {/* CADERAS */}
      <line x1={HIPL.x} y1={HIPL.y} x2={HIPR.x} y2={HIPR.y} stroke={GRAY} strokeWidth={2.5} strokeLinecap="round"/>

      {/* ── BRAZO DERECHO ── */}
      {useHombroDer ? (
        // Hombro derecho activo: todo el brazo se eleva
        <>
          <line x1={SHR.x} y1={SHR.y} x2={elbowHombroDer.x} y2={elbowHombroDer.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <line x1={elbowHombroDer.x} y1={elbowHombroDer.y} x2={wristHombroDer.x} y2={wristHombroDer.y} stroke={RED} strokeWidth={W - 0.5} strokeLinecap="round"/>
          <Dot cx={SHR.x} cy={SHR.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={elbowHombroDer.x} cy={elbowHombroDer.y} r={5} fill={SKIN} stroke={RED}/>
          <Dot cx={wristHombroDer.x} cy={wristHombroDer.y} r={4} fill={SKIN} stroke={RED}/>
        </>
      ) : useCodoDer ? (
        // Codo derecho activo: brazo fijo, antebrazo móvil
        <>
          <line x1={SHR.x} y1={SHR.y} x2={elbowDerPos.x} y2={elbowDerPos.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={elbowDerPos.x} y1={elbowDerPos.y} x2={wristDer.x} y2={wristDer.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <Dot cx={SHR.x} cy={SHR.y} r={5} fill={SKIN} stroke={ACTIVE}/>
          <Dot cx={elbowDerPos.x} cy={elbowDerPos.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={wristDer.x} cy={wristDer.y} r={4.5} fill={SKIN} stroke={RED}/>
        </>
      ) : (
        // Brazo derecho inactivo
        <>
          <line x1={SHR.x} y1={SHR.y} x2={elbowDerPos.x} y2={elbowDerPos.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
          <line x1={elbowDerPos.x} y1={elbowDerPos.y} x2={wristDer.x} y2={wristDer.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
          <Dot cx={SHR.x} cy={SHR.y} r={4} fill={SKIN} stroke={GRAY}/>
          <Dot cx={elbowDerPos.x} cy={elbowDerPos.y} r={4} fill={SKIN} stroke={GRAY}/>
        </>
      )}

      {/* ── BRAZO IZQUIERDO ── */}
      {useHombroIzq ? (
        <>
          <line x1={SHL.x} y1={SHL.y} x2={elbowHombroIzq.x} y2={elbowHombroIzq.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <line x1={elbowHombroIzq.x} y1={elbowHombroIzq.y} x2={wristHombroIzq.x} y2={wristHombroIzq.y} stroke={RED} strokeWidth={W - 0.5} strokeLinecap="round"/>
          <Dot cx={SHL.x} cy={SHL.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={elbowHombroIzq.x} cy={elbowHombroIzq.y} r={5} fill={SKIN} stroke={RED}/>
          <Dot cx={wristHombroIzq.x} cy={wristHombroIzq.y} r={4} fill={SKIN} stroke={RED}/>
        </>
      ) : useCodoIzq ? (
        <>
          <line x1={SHL.x} y1={SHL.y} x2={elbowIzqPos.x} y2={elbowIzqPos.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={elbowIzqPos.x} y1={elbowIzqPos.y} x2={wristIzq.x} y2={wristIzq.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <Dot cx={SHL.x} cy={SHL.y} r={5} fill={SKIN} stroke={ACTIVE}/>
          <Dot cx={elbowIzqPos.x} cy={elbowIzqPos.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={wristIzq.x} cy={wristIzq.y} r={4.5} fill={SKIN} stroke={RED}/>
        </>
      ) : (
        <>
          <line x1={SHL.x} y1={SHL.y} x2={elbowIzqPos.x} y2={elbowIzqPos.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
          <line x1={elbowIzqPos.x} y1={elbowIzqPos.y} x2={wristIzq.x} y2={wristIzq.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
          <Dot cx={SHL.x} cy={SHL.y} r={4} fill={SKIN} stroke={GRAY}/>
          <Dot cx={elbowIzqPos.x} cy={elbowIzqPos.y} r={4} fill={SKIN} stroke={GRAY}/>
        </>
      )}

      {/* ── PIERNA DERECHA ── */}
      {useCaderaDer ? (
        <>
          <line x1={HIPR.x} y1={HIPR.y} x2={thighDerC.x} y2={thighDerC.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <line x1={thighDerC.x} y1={thighDerC.y} x2={shinDerC.x} y2={shinDerC.y} stroke={RED} strokeWidth={W - 0.5} strokeLinecap="round"/>
          <Dot cx={HIPR.x} cy={HIPR.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={thighDerC.x} cy={thighDerC.y} r={5} fill={SKIN} stroke={RED}/>
          <Dot cx={shinDerC.x} cy={shinDerC.y} r={4} fill={SKIN} stroke={RED}/>
        </>
      ) : useRodillaDer ? (
        <>
          <line x1={HIPR.x} y1={HIPR.y} x2={kneeDer.x} y2={kneeDer.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={kneeDer.x} y1={kneeDer.y} x2={ankleDer.x} y2={ankleDer.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <Dot cx={HIPR.x} cy={HIPR.y} r={5} fill={SKIN} stroke={ACTIVE}/>
          <Dot cx={kneeDer.x} cy={kneeDer.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={ankleDer.x} cy={ankleDer.y} r={4.5} fill={SKIN} stroke={RED}/>
        </>
      ) : useTobilloDer ? (
        <>
          <line x1={HIPR.x} y1={HIPR.y} x2={kneeDer.x} y2={kneeDer.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={kneeDer.x} y1={kneeDer.y} x2={ankleDerT.x} y2={ankleDerT.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={ankleDerT.x} y1={ankleDerT.y} x2={toeDer.x} y2={toeDer.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <Dot cx={HIPR.x} cy={HIPR.y} r={4} fill={SKIN} stroke={ACTIVE}/>
          <Dot cx={kneeDer.x} cy={kneeDer.y} r={5} fill={SKIN} stroke={ACTIVE}/>
          <Dot cx={ankleDerT.x} cy={ankleDerT.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={toeDer.x} cy={toeDer.y} r={4} fill={SKIN} stroke={RED}/>
        </>
      ) : (
        <>
          <line x1={HIPR.x} y1={HIPR.y} x2={kneeDer.x} y2={kneeDer.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
          <line x1={kneeDer.x} y1={kneeDer.y} x2={ankleDer.x} y2={ankleDer.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
          <Dot cx={HIPR.x} cy={HIPR.y} r={4} fill={SKIN} stroke={GRAY}/>
          <Dot cx={kneeDer.x} cy={kneeDer.y} r={4} fill={SKIN} stroke={GRAY}/>
        </>
      )}

      {/* ── PIERNA IZQUIERDA ── */}
      {useCaderaIzq ? (
        <>
          <line x1={HIPL.x} y1={HIPL.y} x2={thighIzqC.x} y2={thighIzqC.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <line x1={thighIzqC.x} y1={thighIzqC.y} x2={shinIzqC.x} y2={shinIzqC.y} stroke={RED} strokeWidth={W - 0.5} strokeLinecap="round"/>
          <Dot cx={HIPL.x} cy={HIPL.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={thighIzqC.x} cy={thighIzqC.y} r={5} fill={SKIN} stroke={RED}/>
          <Dot cx={shinIzqC.x} cy={shinIzqC.y} r={4} fill={SKIN} stroke={RED}/>
        </>
      ) : useRodillaIzq ? (
        <>
          <line x1={HIPL.x} y1={HIPL.y} x2={kneeIzq.x} y2={kneeIzq.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={kneeIzq.x} y1={kneeIzq.y} x2={ankleIzq.x} y2={ankleIzq.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <Dot cx={HIPL.x} cy={HIPL.y} r={5} fill={SKIN} stroke={ACTIVE}/>
          <Dot cx={kneeIzq.x} cy={kneeIzq.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={ankleIzq.x} cy={ankleIzq.y} r={4.5} fill={SKIN} stroke={RED}/>
        </>
      ) : useTobilloIzq ? (
        <>
          <line x1={HIPL.x} y1={HIPL.y} x2={kneeIzq.x} y2={kneeIzq.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={kneeIzq.x} y1={kneeIzq.y} x2={ankleIzqT.x} y2={ankleIzqT.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={ankleIzqT.x} y1={ankleIzqT.y} x2={toeIzq.x} y2={toeIzq.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <Dot cx={HIPL.x} cy={HIPL.y} r={4} fill={SKIN} stroke={ACTIVE}/>
          <Dot cx={kneeIzq.x} cy={kneeIzq.y} r={5} fill={SKIN} stroke={ACTIVE}/>
          <Dot cx={ankleIzqT.x} cy={ankleIzqT.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={toeIzq.x} cy={toeIzq.y} r={4} fill={SKIN} stroke={RED}/>
        </>
      ) : (
        <>
          <line x1={HIPL.x} y1={HIPL.y} x2={kneeIzq.x} y2={kneeIzq.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
          <line x1={kneeIzq.x} y1={kneeIzq.y} x2={ankleIzq.x} y2={ankleIzq.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
          <Dot cx={HIPL.x} cy={HIPL.y} r={4} fill={SKIN} stroke={GRAY}/>
          <Dot cx={kneeIzq.x} cy={kneeIzq.y} r={4} fill={SKIN} stroke={GRAY}/>
        </>
      )}

      {/* Leyenda */}
      <line x1="4" y1="270" x2="16" y2="270" stroke={ACTIVE} strokeWidth="2.5" strokeLinecap="round"/>
      <text x="19" y="274" fontSize="8" fill={ACTIVE} fontFamily="sans-serif">fijo</text>
      <line x1="42" y1="270" x2="54" y2="270" stroke={RED} strokeWidth="2.5" strokeLinecap="round"/>
      <text x="57" y="274" fontSize="8" fill={RED} fontFamily="sans-serif">móvil</text>
      <circle cx="96" cy="270" r="3.5" fill={DARK}/>
      <text x="102" y="274" fontSize="8" fill={DARK} fontFamily="sans-serif">articulación</text>
    </svg>
  )
}

// ─── Helpers SVG ──────────────────────────────────────────────────────────────
function Dot({ cx, cy, r, fill, stroke }: { cx: number; cy: number; r: number; fill: string; stroke: string }) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth="1.5"/>
}

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

function describeAngulo(angulo: number, art: string): string {
  const n = art.toLowerCase()
  if (n.includes('codo')) {
    if (angulo >= 160) return 'Extendido'
    if (angulo >= 110) return 'Casi extendido'
    if (angulo >= 70)  return 'Flexión 90°'
    if (angulo >= 30)  return 'Muy flexionado'
    return 'Máxima flexión'
  }
  if (n.includes('hombro')) {
    if (angulo <= 20)  return 'Brazo al costado'
    if (angulo <= 70)  return 'Elevación baja'
    if (angulo <= 110) return 'Horizontal (T)'
    if (angulo <= 150) return 'Elevación alta'
    return 'Brazo sobre cabeza'
  }
  if (n.includes('rodilla')) {
    if (angulo >= 160) return 'Extendida'
    if (angulo >= 110) return 'Flexión leve'
    if (angulo >= 70)  return 'Flexión 90°'
    if (angulo >= 30)  return 'Flexión profunda'
    return 'Máxima flexión'
  }
  if (n.includes('cadera')) {
    if (angulo >= 160) return 'Pierna extendida'
    if (angulo >= 110) return 'Flexión ligera'
    if (angulo >= 70)  return 'Sentado (90°)'
    if (angulo >= 30)  return 'Flexión profunda'
    return 'Máxima flexión'
  }
  if (n.includes('tobillo')) {
    if (angulo >= 110) return 'Dorsiflexión'
    if (angulo >= 80)  return 'Neutro'
    if (angulo >= 50)  return 'Flexión plantar'
    return 'Punta de pie'
  }
  if (n.includes('tronco'))  return angulo >= 150 ? 'Erguido' : angulo >= 100 ? 'Inclinación leve' : 'Inclinación lateral'
  if (n.includes('cuello'))  return angulo >= 110 ? 'Inc. derecha' : angulo >= 70 ? 'Neutro' : 'Inc. izquierda'
  return `${angulo}°`
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '9px',
  border: '1.5px solid var(--border)', background: '#fff',
  fontSize: '0.85rem', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600,
  color: 'var(--text-light)', marginBottom: '5px',
}
const btnPrimary: React.CSSProperties = {
  background: 'var(--blue)', color: '#fff', border: 'none',
  borderRadius: '9px', padding: '9px 18px',
  fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
}
const btnOutline: React.CSSProperties = {
  background: 'transparent', border: '1.5px solid var(--border)',
  color: 'var(--text-mid)', borderRadius: '9px', padding: '9px 18px',
  fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
}
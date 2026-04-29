'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface Articulacion {
  id_articulacion: string
  nombre_articulacion: string
  puntos_mediapipe: string[]
}

export interface Pose {
  tmpId: string
  orden: number
  nombre: string
  angulo: number
  tolerancia: number
  hold_sec: number
}

export interface EjercicioFormData {
  nombre_ejercicio: string
  descripcion: string
  video_muestra: string
  icono: string
  repeticiones: string
  id_articulacion_principal: string
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
  id_articulacion_principal: '',
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
  const [form, setForm]               = useState<EjercicioFormData>(ejercicioInicial ?? defaultEjercicio())
  const [articulaciones, setArticulaciones] = useState<Articulacion[]>([])
  const [loadingArts, setLoadingArts] = useState(true)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('ai_articulacion_config')
      .select('id_articulacion, nombre_articulacion, puntos_mediapipe')
      .order('nombre_articulacion')
      .then(({ data }) => {
        setArticulaciones(data ?? [])
        setLoadingArts(false)
      })
  }, [])

  const update = (field: keyof EjercicioFormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const addPose = () => {
    const n = form.secuencia_poses.length + 1
    const defaults: Record<number, { nombre: string; angulo: number }> = {
      1: { nombre: 'Posición inicial', angulo: 170 },
      2: { nombre: 'Punto medio',      angulo: 90  },
      3: { nombre: 'Extensión máxima', angulo: 20  },
    }
    const d = defaults[n] ?? { nombre: `Pose ${n}`, angulo: 90 }
    update('secuencia_poses', [
      ...form.secuencia_poses,
      { tmpId: crypto.randomUUID(), orden: n, nombre: d.nombre, angulo: d.angulo, tolerancia: 10, hold_sec: 1 },
    ])
  }

  const removePose = (tmpId: string) =>
    update('secuencia_poses',
      form.secuencia_poses.filter(p => p.tmpId !== tmpId).map((p, i) => ({ ...p, orden: i + 1 }))
    )

  const updatePose = (tmpId: string, field: keyof Pose, value: string | number) =>
    update('secuencia_poses',
      form.secuencia_poses.map(p => p.tmpId === tmpId ? { ...p, [field]: value } : p)
    )

  const confirmar = () => {
    if (!form.nombre_ejercicio.trim()) { setError('El nombre del ejercicio es obligatorio'); return }
    setError(null)
    onConfirmar(form)
  }

  const articulacionSel = articulaciones.find(a => a.id_articulacion === form.id_articulacion_principal)

  return (
    <div style={{
      background: 'var(--bg)', borderRadius: '14px',
      border: '1.5px solid var(--border)', padding: '20px',
      display: 'flex', flexDirection: 'column', gap: '20px',
    }}>

      {/* Datos base */}
      <div>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '12px' }}>
          📋 Datos del ejercicio
        </div>
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

      {/* Configuración IA */}
      <div style={{
        borderRadius: '12px', border: '1.5px solid var(--blue)',
        background: 'var(--blue-xlight)', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--blue)' }}>
          🤖 Configuración de IA — Poses y articulación
        </div>

        <div>
          <label style={{ ...labelStyle, color: 'var(--blue)' }}>Articulación a evaluar</label>
          {loadingArts ? (
            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Cargando articulaciones...</div>
          ) : (
            <select value={form.id_articulacion_principal}
              onChange={e => update('id_articulacion_principal', e.target.value)} style={selectStyle}>
              <option value="">— Sin evaluación IA —</option>
              {articulaciones.map(a => (
                <option key={a.id_articulacion} value={a.id_articulacion}>{a.nombre_articulacion}</option>
              ))}
            </select>
          )}
          {articulacionSel && (
            <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--blue)', opacity: 0.8 }}>
              Puntos MediaPipe: {articulacionSel.puntos_mediapipe.join(' → ')}
            </div>
          )}
        </div>

        {form.id_articulacion_principal && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <label style={{ ...labelStyle, color: 'var(--blue)', marginBottom: 0 }}>
                Secuencia de poses (keyframes)
              </label>
              <button onClick={addPose} style={{
                background: 'var(--blue)', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '5px 12px',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
              }}>
                + Añadir pose
              </button>
            </div>

            {form.secuencia_poses.length === 0 ? (
              <div style={{
                padding: '16px', borderRadius: '10px',
                border: '1.5px dashed rgba(75,179,214,0.4)',
                textAlign: 'center', fontSize: '0.8rem', color: 'var(--blue)', opacity: 0.6,
              }}>
                Sin poses — el ejercicio no tendrá evaluación por ángulo
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <TimelinePoses poses={form.secuencia_poses} />
                {form.secuencia_poses.map((pose, idx) => (
                  <PoseCard
                    key={pose.tmpId}
                    pose={pose}
                    index={idx}
                    nombreArticulacion={articulacionSel?.nombre_articulacion ?? ''}
                    onChange={(field, value) => updatePose(pose.tmpId, field, value)}
                    onRemove={() => removePose(pose.tmpId)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {mostrarOpcionBiblioteca && !ejercicioInicial?.id_biblioteca_ejercicio && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 14px', borderRadius: '10px',
          background: '#f8fcff', border: '1px solid var(--border)',
        }}>
          <input type="checkbox" id="guardar-biblioteca" checked={form.guardar_en_biblioteca}
            onChange={e => update('guardar_en_biblioteca', e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--blue)' }} />
          <label htmlFor="guardar-biblioteca" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
            Guardar en mi biblioteca para reutilizar en otras rutinas
          </label>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '9px', background: '#fde8e8', color: '#c0392b', fontSize: '0.8rem' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={btnOutline}>Cancelar</button>
        <button onClick={confirmar} style={btnPrimary}>✅ Confirmar ejercicio</button>
      </div>
    </div>
  )
}

// ─── Timeline visual ──────────────────────────────────────────────────────────
function TimelinePoses({ poses }: { poses: Pose[] }) {
  if (poses.length === 0) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '12px 16px', borderRadius: '10px',
      background: 'rgba(255,255,255,0.7)',
      border: '1px solid rgba(75,179,214,0.2)', overflowX: 'auto',
    }}>
      {poses.map((pose, idx) => (
        <div key={pose.tmpId} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '50%',
              background: 'var(--blue)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '0.8rem',
              boxShadow: '0 2px 8px rgba(75,179,214,0.4)',
            }}>
              {pose.angulo}°
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--blue)', fontWeight: 600, textAlign: 'center', maxWidth: '64px', lineHeight: 1.2 }}>
              {pose.nombre}
            </div>
          </div>
          {idx < poses.length - 1 && (
            <div style={{ width: '36px', height: '2px', background: 'linear-gradient(to right, var(--blue), var(--blue-light))', position: 'relative', margin: '0 2px' }}>
              <span style={{ position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.6rem', color: 'var(--blue)', opacity: 0.6 }}>→</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── PoseCard con muñequito ───────────────────────────────────────────────────
function PoseCard({ pose, index, onChange, onRemove, nombreArticulacion }: {
  pose: Pose
  index: number
  onChange: (field: keyof Pose, value: string | number) => void
  onRemove: () => void
  nombreArticulacion: string
}) {
  return (
    <div style={{
      borderRadius: '12px', border: '1px solid rgba(75,179,214,0.3)',
      background: 'rgba(255,255,255,0.9)', overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(75,179,214,0.08)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
        background: 'rgba(75,179,214,0.08)', borderBottom: '1px solid rgba(75,179,214,0.15)',
      }}>
        <span style={{ background: 'var(--blue)', color: '#fff', borderRadius: '6px', padding: '2px 9px', fontSize: '0.7rem', fontWeight: 800 }}>
          Pose {index + 1}
        </span>
        <input value={pose.nombre} onChange={e => onChange('nombre', e.target.value)}
          placeholder="Nombre de la pose"
          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', outline: 'none' }} />
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '1rem', opacity: 0.7 }}>✕</button>
      </div>

      {/* Cuerpo: muñequito + sliders */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: '200px' }}>

        {/* Muñequito */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '12px 8px', background: 'rgba(75,179,214,0.04)',
          borderRight: '1px solid rgba(75,179,214,0.12)',
        }}>
          <MunequitoBody angulo={pose.angulo} nombreArticulacion={nombreArticulacion} />
          <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--blue)', marginTop: '4px' }}>{pose.angulo}°</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', textAlign: 'center', marginTop: '2px', maxWidth: '160px' }}>
            {describeAngulo(pose.angulo, nombreArticulacion)}
          </div>
        </div>

        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 18px', justifyContent: 'center' }}>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={labelStyle}>Ángulo objetivo</label>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--blue)' }}>{pose.angulo}°</span>
            </div>
            <input type="range" min={0} max={180} step={5} value={pose.angulo}
              onChange={e => onChange('angulo', parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--blue)', height: '6px', cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-light)', marginTop: '3px' }}>
              <span>0° (doblado)</span><span>90°</span><span>180° (extendido)</span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={labelStyle}>Tolerancia</label>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>±{pose.tolerancia}°</span>
            </div>
            <input type="range" min={1} max={30} step={1} value={pose.tolerancia}
              onChange={e => onChange('tolerancia', parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#6c8fc7', height: '6px', cursor: 'pointer' }} />
            <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: '3px' }}>
              Rango aceptado: {Math.max(0, pose.angulo - pose.tolerancia)}° – {Math.min(180, pose.angulo + pose.tolerancia)}°
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={labelStyle}>Mantener en posición</label>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>{pose.hold_sec}s</span>
            </div>
            <input type="range" min={0} max={10} step={0.5} value={pose.hold_sec}
              onChange={e => onChange('hold_sec', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#6c8fc7', height: '6px', cursor: 'pointer' }} />
            <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: '3px' }}>
              {pose.hold_sec === 0 ? 'Sin tiempo mínimo' : `Paciente debe sostener ${pose.hold_sec}s en rango`}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUÑEQUITO CUERPO COMPLETO
// ═══════════════════════════════════════════════════════════════════════════════
function MunequitoBody({ angulo, nombreArticulacion }: { angulo: number; nombreArticulacion: string }) {
  const n = nombreArticulacion.toLowerCase()
  const isDer = n.includes('derecho') || n.includes('der')
  const lado  = isDer ? 1 : -1

  // Constantes del cuerpo (coordenadas base del muñequito de palitos)
  const CX   = 88   // centro X
  const HEAD = { cx: CX, cy: 22, r: 13 }

  // Articulaciones base (sin movimiento)
  const NECK   = { x: CX,      y: 36  }
  const SHOLR  = { x: CX + 22, y: 48  }  // hombro derecho
  const SHOLL  = { x: CX - 22, y: 48  }  // hombro izquierdo
  const HIP    = { x: CX,      y: 105 }
  const HIPR   = { x: CX + 14, y: 108 }  // cadera derecha
  const HIPL   = { x: CX - 14, y: 108 }  // cadera izquierda

  // Articulaciones activas (calculadas según ángulo)
  // Ángulo en radianes para rotar el segmento móvil
  const deg2rad = (d: number) => (d * Math.PI) / 180

  // ── Codo ──────────────────────────────────────────────────────────────────
  // Brazo: hombro → codo (fijo, apunta 30° hacia afuera-abajo)
  const ELBOW = isDer
    ? { x: SHOLR.x + 22, y: SHOLR.y + 42 }
    : { x: SHOLL.x - 22, y: SHOLL.y + 42 }
  // Antebrazo (codo → muñeca): 180° = extendido abajo, 0° = doblado arriba
  const antLen = 38
  const antAngle = isDer
    ? (-90 + angulo)          // Der: 180→apunta abajo, 0→apunta arriba
    : (-90 + angulo)
  const WRIST = {
    x: ELBOW.x + antLen * Math.cos(deg2rad(antAngle)) * lado,
    y: ELBOW.y + antLen * Math.sin(deg2rad(angulo > 90 ? antAngle : antAngle)),
  }
  // Más directo: calcular la muñeca correctamente
  // ref: ángulo 180 = antebrazo apunta abajo; ángulo 0 = apunta hacia arriba
  const wristFinal = {
    x: ELBOW.x + antLen * Math.sin(deg2rad(angulo)) * lado * 0.6,
    y: ELBOW.y + antLen * Math.cos(deg2rad(180 - angulo)),
  }

  // ── Hombro ────────────────────────────────────────────────────────────────
  // Brazo elevado: 0° = pegado al cuerpo, 180° = arriba del todo
  const SHOL_ACT = isDer ? SHOLR : SHOLL
  const armLen   = 40
  // 0° = brazo abajo (apunta hacia cadera), 180° = brazo arriba
  const armAngle = isDer ? -(angulo) + 90 : (angulo) - 90
  const ELBOW_HOMBRO = {
    x: SHOL_ACT.x + armLen * Math.cos(deg2rad(armAngle)) * lado,
    y: SHOL_ACT.y - armLen * Math.sin(deg2rad(armAngle)) * (angulo > 90 ? 1 : 1),
  }
  // Forearm sigue la dirección del brazo
  const WRIST_HOMBRO = {
    x: ELBOW_HOMBRO.x + 30 * Math.cos(deg2rad(armAngle)) * lado,
    y: ELBOW_HOMBRO.y - 30 * Math.sin(deg2rad(armAngle)),
  }

  // ── Cadera ────────────────────────────────────────────────────────────────
  const HIP_ACT  = isDer ? HIPR : HIPL
  const thighLen = 45
  // 180° = pierna extendida abajo; 0° = pierna hacia arriba (flexión máxima)
  const hipAngle = angulo - 90
  const KNEE_CAD = {
    x: HIP_ACT.x + thighLen * Math.sin(deg2rad(hipAngle)) * lado * 0.4,
    y: HIP_ACT.y + thighLen * Math.cos(deg2rad(hipAngle - 10)) * (angulo > 90 ? 1 : -0.5),
  }
  const ANKLE_CAD = {
    x: KNEE_CAD.x + 40 * Math.sin(deg2rad(10)) * lado * 0.3,
    y: KNEE_CAD.y + 40,
  }

  // ── Rodilla ───────────────────────────────────────────────────────────────
  const HIP_ROD   = isDer ? HIPR : HIPL
  const thigh2Len = 44
  const KNEE_ROD  = {
    x: HIP_ROD.x + thigh2Len * Math.sin(deg2rad(8)) * lado * 0.5,
    y: HIP_ROD.y + thigh2Len * 0.98,
  }
  const shinLen  = 44
  // 180° = tibia extendida (abajo); 0° = tibia muy doblada (hacia atrás)
  const shinAngle = (180 - angulo)
  const ANKLE_ROD = {
    x: KNEE_ROD.x - shinLen * Math.sin(deg2rad(shinAngle)) * lado * 0.7,
    y: KNEE_ROD.y + shinLen * Math.cos(deg2rad(shinAngle)) * (angulo > 90 ? 1 : 0.8),
  }

  // ── Tobillo ───────────────────────────────────────────────────────────────
  const HIP_TOB   = isDer ? HIPR : HIPL
  const KNEE_TOB  = {
    x: HIP_TOB.x + 4 * lado,
    y: HIP_TOB.y + 44,
  }
  const ANKLE_TOB = {
    x: KNEE_TOB.x + 2 * lado,
    y: KNEE_TOB.y + 44,
  }
  // Pie: 90° = recto, <90 = plantar, >90 = dorsiflexión
  const footLen   = 28
  const footAngle = angulo - 90
  const TOE = {
    x: ANKLE_TOB.x + footLen * Math.cos(deg2rad(footAngle)) * lado,
    y: ANKLE_TOB.y + footLen * Math.sin(deg2rad(footAngle)) * 0.5,
  }

  // ── Cuello ────────────────────────────────────────────────────────────────
  // 90° = cabeza recta; <90 = inclinada izquierda; >90 = inclinada derecha
  const neckTilt = angulo - 90  // ángulo de inclinación lateral
  const HEAD_CUELLO = {
    cx: HEAD.cx + 20 * Math.sin(deg2rad(neckTilt)),
    cy: HEAD.cy,
  }

  // ── Tronco ────────────────────────────────────────────────────────────────
  // 180° = tronco recto; <180 = inclinado hacia el lado activo
  const trunkTilt = (180 - angulo) * 0.4 * lado
  const HIP_TRUNK = { x: HIP.x + 10 * Math.sin(deg2rad(trunkTilt)), y: HIP.y }

  // Determinar qué articulación dibujar activa
  const isCodo    = n.includes('codo')
  const isHombro  = n.includes('hombro')
  const isCadera  = n.includes('cadera')
  const isRodilla = n.includes('rodilla')
  const isTobillo = n.includes('tobillo')
  const isTronco  = n.includes('tronco')
  const isCuello  = n.includes('cuello')

  const BLUE = '#378ADD'
  const RED  = '#E24B4A'
  const DARK = '#185FA5'
  const GRAY = '#9a9893'
  const SKIN = '#D3D1C7'
  const W    = 3.5   // grosor segmento activo
  const WG   = 2.5   // grosor segmento inactivo

  return (
    <svg width="176" height="260" viewBox="0 0 176 260" style={{ display: 'block' }}>

      {/* ── CABEZA ── */}
      {isCuello ? (
        <circle cx={HEAD_CUELLO.cx} cy={HEAD_CUELLO.cy} r={HEAD.r} fill="none" stroke={RED} strokeWidth="2.5"/>
      ) : (
        <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill="none" stroke={GRAY} strokeWidth="2"/>
      )}

      {/* ── CUELLO ── */}
      {isCuello ? (
        <>
          <line x1={HEAD_CUELLO.cx} y1={HEAD_CUELLO.cy + HEAD.r} x2={NECK.x} y2={NECK.y} stroke={RED} strokeWidth="2.5" strokeLinecap="round"/>
          {/* Arco */}
          <CircleArc cx={NECK.x} cy={NECK.y} r={14} startDeg={-90 + neckTilt} endDeg={-90} color={BLUE} />
        </>
      ) : (
        <line x1={HEAD.cx} y1={HEAD.cy + HEAD.r} x2={NECK.x} y2={NECK.y} stroke={GRAY} strokeWidth="2" strokeLinecap="round"/>
      )}

      {/* ── TORSO ── */}
      {isTronco ? (
        <>
          <line x1={NECK.x} y1={NECK.y} x2={HIP_TRUNK.x} y2={HIP_TRUNK.y} stroke={RED} strokeWidth="3" strokeLinecap="round"/>
          <CircleArc cx={NECK.x} cy={NECK.y} r={16} startDeg={90} endDeg={90 + trunkTilt} color={BLUE} />
        </>
      ) : (
        <line x1={NECK.x} y1={NECK.y} x2={HIP.x} y2={HIP.y} stroke={GRAY} strokeWidth="2.5" strokeLinecap="round"/>
      )}

      {/* ── HOMBROS ── */}
      <line x1={SHOLL.x} y1={SHOLL.y} x2={SHOLR.x} y2={SHOLR.y} stroke={GRAY} strokeWidth="2.5" strokeLinecap="round"/>

      {/* ── CADERA BAR ── */}
      <line x1={HIPL.x} y1={HIPL.y} x2={HIPR.x} y2={HIPR.y} stroke={GRAY} strokeWidth="2.5" strokeLinecap="round"/>

      {/* ── BRAZO INACTIVO (lado opuesto) ── */}
      {(isCodo || isHombro) && (() => {
        const shInact = isDer ? SHOLL : SHOLR
        const elInact = isDer
          ? { x: SHOLL.x - 22, y: SHOLL.y + 42 }
          : { x: SHOLR.x + 22, y: SHOLR.y + 42 }
        return (
          <>
            <line x1={shInact.x} y1={shInact.y} x2={elInact.x} y2={elInact.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
            <line x1={elInact.x} y1={elInact.y} x2={elInact.x + (isDer ? -10 : 10)} y2={elInact.y + 32} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
            <Dot cx={shInact.x} cy={shInact.y} r={4} fill={SKIN} stroke={GRAY}/>
            <Dot cx={elInact.x} cy={elInact.y} r={4} fill={SKIN} stroke={GRAY}/>
          </>
        )
      })()}

      {/* ── PIERNA INACTIVA (lado opuesto) ── */}
      {(isCadera || isRodilla || isTobillo) && (() => {
        const hpInact  = isDer ? HIPL : HIPR
        const knInact  = { x: hpInact.x - 3 * lado, y: hpInact.y + 44 }
        const ankInact = { x: knInact.x - 2 * lado, y: knInact.y + 44 }
        return (
          <>
            <line x1={hpInact.x} y1={hpInact.y} x2={knInact.x} y2={knInact.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
            <line x1={knInact.x} y1={knInact.y} x2={ankInact.x} y2={ankInact.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
            <Dot cx={hpInact.x} cy={hpInact.y} r={4} fill={SKIN} stroke={GRAY}/>
            <Dot cx={knInact.x} cy={knInact.y} r={4} fill={SKIN} stroke={GRAY}/>
          </>
        )
      })()}

      {/* ── BRAZO ACTIVO — CODO ── */}
      {isCodo && (
        <>
          <CircleArc cx={ELBOW.x} cy={ELBOW.y} r={14} startDeg={isDer ? -60 : 240} endDeg={isDer ? -60 + angulo : 240 - angulo} color={BLUE} />
          <line x1={SHOL_ACT.x} y1={SHOL_ACT.y} x2={ELBOW.x} y2={ELBOW.y} stroke={BLUE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={ELBOW.x} y1={ELBOW.y} x2={wristFinal.x} y2={wristFinal.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <Dot cx={SHOL_ACT.x} cy={SHOL_ACT.y} r={5} fill={SKIN} stroke={BLUE}/>
          <Dot cx={ELBOW.x} cy={ELBOW.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={wristFinal.x} cy={wristFinal.y} r={4.5} fill={SKIN} stroke={RED}/>
        </>
      )}

      {/* ── BRAZO ACTIVO — HOMBRO ── */}
      {isHombro && (
        <>
          <CircleArc cx={SHOL_ACT.x} cy={SHOL_ACT.y} r={14} startDeg={isDer ? 90 : 90} endDeg={isDer ? 90 - angulo : 90 + angulo} color={BLUE} />
          <line x1={SHOL_ACT.x} y1={SHOL_ACT.y} x2={ELBOW_HOMBRO.x} y2={ELBOW_HOMBRO.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <line x1={ELBOW_HOMBRO.x} y1={ELBOW_HOMBRO.y} x2={WRIST_HOMBRO.x} y2={WRIST_HOMBRO.y} stroke={RED} strokeWidth={W - 0.5} strokeLinecap="round"/>
          <Dot cx={SHOL_ACT.x} cy={SHOL_ACT.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={ELBOW_HOMBRO.x} cy={ELBOW_HOMBRO.y} r={5} fill={SKIN} stroke={RED}/>
          <Dot cx={WRIST_HOMBRO.x} cy={WRIST_HOMBRO.y} r={4} fill={SKIN} stroke={RED}/>
        </>
      )}

      {/* ── PIERNA ACTIVA — CADERA ── */}
      {isCadera && (
        <>
          <CircleArc cx={HIP_ACT.x} cy={HIP_ACT.y} r={14} startDeg={90} endDeg={90 - hipAngle * lado} color={BLUE} />
          <line x1={HIP_ACT.x} y1={HIP_ACT.y} x2={KNEE_CAD.x} y2={KNEE_CAD.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <line x1={KNEE_CAD.x} y1={KNEE_CAD.y} x2={ANKLE_CAD.x} y2={ANKLE_CAD.y} stroke={RED} strokeWidth={W - 0.5} strokeLinecap="round"/>
          <Dot cx={HIP_ACT.x} cy={HIP_ACT.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={KNEE_CAD.x} cy={KNEE_CAD.y} r={5} fill={SKIN} stroke={RED}/>
          <Dot cx={ANKLE_CAD.x} cy={ANKLE_CAD.y} r={4} fill={SKIN} stroke={RED}/>
        </>
      )}

      {/* ── PIERNA ACTIVA — RODILLA ── */}
      {isRodilla && (
        <>
          <CircleArc cx={KNEE_ROD.x} cy={KNEE_ROD.y} r={14} startDeg={isDer ? -100 : 280} endDeg={isDer ? -100 + (180 - angulo) : 280 - (180 - angulo)} color={BLUE} />
          <line x1={HIP_ROD.x} y1={HIP_ROD.y} x2={KNEE_ROD.x} y2={KNEE_ROD.y} stroke={BLUE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={KNEE_ROD.x} y1={KNEE_ROD.y} x2={ANKLE_ROD.x} y2={ANKLE_ROD.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <Dot cx={HIP_ROD.x} cy={HIP_ROD.y} r={5} fill={SKIN} stroke={BLUE}/>
          <Dot cx={KNEE_ROD.x} cy={KNEE_ROD.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={ANKLE_ROD.x} cy={ANKLE_ROD.y} r={4.5} fill={SKIN} stroke={RED}/>
        </>
      )}

      {/* ── PIERNA ACTIVA — TOBILLO ── */}
      {isTobillo && (
        <>
          <line x1={HIP_TOB.x} y1={HIP_TOB.y} x2={KNEE_TOB.x} y2={KNEE_TOB.y} stroke={BLUE} strokeWidth={W} strokeLinecap="round"/>
          <line x1={KNEE_TOB.x} y1={KNEE_TOB.y} x2={ANKLE_TOB.x} y2={ANKLE_TOB.y} stroke={BLUE} strokeWidth={W} strokeLinecap="round"/>
          <CircleArc cx={ANKLE_TOB.x} cy={ANKLE_TOB.y} r={13} startDeg={0} endDeg={-footAngle * lado} color={BLUE} />
          <line x1={ANKLE_TOB.x} y1={ANKLE_TOB.y} x2={TOE.x} y2={TOE.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
          <Dot cx={HIP_TOB.x} cy={HIP_TOB.y} r={4} fill={SKIN} stroke={BLUE}/>
          <Dot cx={KNEE_TOB.x} cy={KNEE_TOB.y} r={5} fill={SKIN} stroke={BLUE}/>
          <Dot cx={ANKLE_TOB.x} cy={ANKLE_TOB.y} r={7} fill={DARK} stroke="white"/>
          <Dot cx={TOE.x} cy={TOE.y} r={4} fill={SKIN} stroke={RED}/>
        </>
      )}

      {/* ── Brazos inactivos cuando la articulación es de pierna ── */}
      {(isCadera || isRodilla || isTobillo || isTronco || isCuello) && (
        <>
          {[SHOLL, SHOLR].map((sh, i) => {
            const el = { x: sh.x + (i === 1 ? 18 : -18), y: sh.y + 42 }
            const wr = { x: el.x + (i === 1 ? 8 : -8),  y: el.y + 30 }
            return (
              <g key={i}>
                <line x1={sh.x} y1={sh.y} x2={el.x} y2={el.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
                <line x1={el.x} y1={el.y} x2={wr.x} y2={wr.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
                <Dot cx={sh.x} cy={sh.y} r={4} fill={SKIN} stroke={GRAY}/>
                <Dot cx={el.x} cy={el.y} r={4} fill={SKIN} stroke={GRAY}/>
              </g>
            )
          })}
        </>
      )}

      {/* ── Piernas inactivas cuando la articulación es de brazo/cuello/tronco ── */}
      {(isCodo || isHombro || isTronco || isCuello) && (
        <>
          {[HIPL, HIPR].map((hp, i) => {
            const kn  = { x: hp.x + (i === 1 ? 4 : -4), y: hp.y + 44 }
            const ank = { x: kn.x  + (i === 1 ? 3 : -3), y: kn.y  + 44 }
            return (
              <g key={i}>
                <line x1={hp.x} y1={hp.y} x2={kn.x} y2={kn.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
                <line x1={kn.x} y1={kn.y} x2={ank.x} y2={ank.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
                <Dot cx={hp.x} cy={hp.y} r={4} fill={SKIN} stroke={GRAY}/>
                <Dot cx={kn.x} cy={kn.y} r={4} fill={SKIN} stroke={GRAY}/>
              </g>
            )
          })}
        </>
      )}

      {/* Leyenda */}
      <g>
        <line x1="4" y1="250" x2="18" y2="250" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round"/>
        <text x="22" y="254" fontSize="9" fill={BLUE} fontFamily="sans-serif">fijo</text>
        <line x1="46" y1="250" x2="60" y2="250" stroke={RED} strokeWidth="2.5" strokeLinecap="round"/>
        <text x="64" y="254" fontSize="9" fill={RED} fontFamily="sans-serif">móvil</text>
        <circle cx="102" cy="250" r="4" fill={DARK}/>
        <text x="109" y="254" fontSize="9" fill={DARK} fontFamily="sans-serif">articulación</text>
      </g>
    </svg>
  )
}

// ─── Sub-componentes SVG helpers ──────────────────────────────────────────────
function Dot({ cx, cy, r, fill, stroke }: { cx: number; cy: number; r: number; fill: string; stroke: string }) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth="1.5"/>
}

function CircleArc({ cx, cy, r, startDeg, endDeg, color }: {
  cx: number; cy: number; r: number; startDeg: number; endDeg: number; color: string
}) {
  const deg2rad = (d: number) => (d * Math.PI) / 180
  const x1 = cx + r * Math.cos(deg2rad(startDeg))
  const y1 = cy + r * Math.sin(deg2rad(startDeg))
  const x2 = cx + r * Math.cos(deg2rad(endDeg))
  const y2 = cy + r * Math.sin(deg2rad(endDeg))
  const diff = Math.abs(endDeg - startDeg)
  const large = diff > 180 ? 1 : 0
  const sweep = endDeg > startDeg ? 1 : 0
  if (diff < 1) return null
  return (
    <path
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`}
      fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" opacity="0.35"
    />
  )
}

// ─── Descripción textual del ángulo ──────────────────────────────────────────
function describeAngulo(angulo: number, art: string): string {
  const n = art.toLowerCase()
  if (n.includes('codo')) {
    if (angulo >= 160) return 'Brazo extendido'
    if (angulo >= 120) return 'Extensión moderada'
    if (angulo >= 80)  return 'Flexión media (90°)'
    if (angulo >= 40)  return 'Flexión pronunciada'
    return 'Codo muy flexionado'
  }
  if (n.includes('hombro')) {
    if (angulo <= 20)  return 'Brazo pegado al cuerpo'
    if (angulo <= 60)  return 'Elevación baja'
    if (angulo <= 100) return 'Brazo al frente / lado'
    if (angulo <= 150) return 'Elevación alta'
    return 'Brazo por encima de la cabeza'
  }
  if (n.includes('cadera')) {
    if (angulo >= 160) return 'Pierna extendida (de pie)'
    if (angulo >= 120) return 'Flexión ligera'
    if (angulo >= 80)  return 'Flexión media (sentado)'
    if (angulo >= 40)  return 'Flexión profunda'
    return 'Máxima flexión de cadera'
  }
  if (n.includes('rodilla')) {
    if (angulo >= 160) return 'Rodilla extendida'
    if (angulo >= 120) return 'Flexión ligera'
    if (angulo >= 80)  return 'Flexión media (90°)'
    if (angulo >= 40)  return 'Flexión profunda'
    return 'Rodilla muy flexionada'
  }
  if (n.includes('tobillo')) {
    if (angulo >= 110) return 'Dorsiflexión (punta arriba)'
    if (angulo >= 85)  return 'Posición neutra'
    if (angulo >= 60)  return 'Flexión plantar leve'
    return 'Flexión plantar máxima'
  }
  if (n.includes('tronco')) {
    if (angulo >= 160) return 'Tronco erguido'
    if (angulo >= 120) return 'Inclinación leve'
    if (angulo >= 80)  return 'Inclinación moderada'
    return 'Inclinación lateral máxima'
  }
  if (n.includes('cuello')) {
    if (angulo >= 110) return 'Inclinación derecha'
    if (angulo >= 80)  return 'Cabeza recta (neutro)'
    if (angulo >= 50)  return 'Inclinación izquierda'
    return 'Inclinación lateral máxima'
  }
  if (angulo <= 30)  return 'Posición cerrada'
  if (angulo <= 90)  return 'Ángulo agudo'
  if (angulo <= 150) return 'Ángulo obtuso'
  return 'Posición extendida'
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
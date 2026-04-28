'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface Articulacion {
  id_articulacion: string
  nombre_articulacion: string
  puntos_mediapipe: string[]   // la DB los devuelve como strings
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
  // Datos base
  nombre_ejercicio: string
  descripcion: string
  video_muestra: string
  icono: string
  repeticiones: string
  // IA
  id_articulacion_principal: string
  secuencia_poses: Pose[]
  // Biblioteca
  guardar_en_biblioteca: boolean
  id_biblioteca_ejercicio?: string   // si viene de biblioteca
  // Override personalizado
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

// ─── Props ────────────────────────────────────────────────────────────────────
interface EjercicioBuilderProps {
  /** Si se pasa, el componente edita un ejercicio existente de la biblioteca */
  ejercicioInicial?: EjercicioFormData
  /** Si true, muestra el toggle "guardar en biblioteca" */
  mostrarOpcionBiblioteca?: boolean
  /** Callback al confirmar el ejercicio */
  onConfirmar: (data: EjercicioFormData) => void
  onCancelar: () => void
}

// ─── Componente ───────────────────────────────────────────────────────────────
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
      .then(({ data }) => {
        setArticulaciones(data ?? [])
        setLoadingArts(false)
      })
  }, [])

  const update = (field: keyof EjercicioFormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  // ── Poses ──────────────────────────────────────────────────────────────────
  const addPose = () => {
    const nuevaOrden = form.secuencia_poses.length + 1
    update('secuencia_poses', [
      ...form.secuencia_poses,
      {
        tmpId: crypto.randomUUID(),
        orden: nuevaOrden,
        nombre: nuevaOrden === 1 ? 'Posición inicial' : nuevaOrden === 2 ? 'Punto medio' : 'Extensión máxima',
        angulo: nuevaOrden === 1 ? 0 : nuevaOrden === 2 ? 90 : 160,
        tolerancia: 10,
        hold_sec: 1,
      },
    ])
  }

  const removePose = (tmpId: string) =>
    update('secuencia_poses',
      form.secuencia_poses
        .filter(p => p.tmpId !== tmpId)
        .map((p, i) => ({ ...p, orden: i + 1 }))
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

      {/* ── Datos base ── */}
      <div>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '12px' }}>
          📋 Datos del ejercicio
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: '10px', marginBottom: '10px' }}>
          {/* Icono picker */}
          <select
            value={form.icono}
            onChange={e => update('icono', e.target.value)}
            style={{
              border: '1.5px solid var(--border)', borderRadius: '9px',
              background: 'var(--bg)', fontSize: '1.3rem',
              cursor: 'pointer', textAlign: 'center', padding: '4px',
            }}
          >
            {ICONOS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input
            value={form.nombre_ejercicio}
            onChange={e => update('nombre_ejercicio', e.target.value)}
            placeholder="Nombre del ejercicio *"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Descripción / instrucción</label>
            <input
              value={form.descripcion}
              onChange={e => update('descripcion', e.target.value)}
              placeholder="Ej. Mantén la espalda recta..."
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Repeticiones</label>
            <input
              type="number"
              value={form.repeticiones}
              onChange={e => update('repeticiones', e.target.value)}
              placeholder="10"
              min={1}
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>URL de video demostrativo (opcional)</label>
            <input
              value={form.video_muestra}
              onChange={e => update('video_muestra', e.target.value)}
              placeholder="https://youtube.com/..."
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ── Configuración IA ── */}
      <div style={{
        borderRadius: '12px',
        border: '1.5px solid var(--blue)',
        background: 'var(--blue-xlight)',
        padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--blue)' }}>
          🤖 Configuración de IA — Poses y articulación
        </div>

        {/* Articulación principal */}
        <div>
          <label style={{ ...labelStyle, color: 'var(--blue)' }}>Articulación a evaluar</label>
          {loadingArts ? (
            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Cargando articulaciones...</div>
          ) : (
            <select
              value={form.id_articulacion_principal}
              onChange={e => update('id_articulacion_principal', e.target.value)}
              style={selectStyle}
            >
              <option value="">— Sin evaluación IA —</option>
              {articulaciones.map(a => (
                <option key={a.id_articulacion} value={a.id_articulacion}>
                  {a.nombre_articulacion}
                </option>
              ))}
            </select>
          )}
          {articulacionSel && (
            <div style={{
              marginTop: '6px', fontSize: '0.72rem',
              color: 'var(--blue)', opacity: 0.8,
            }}>
              Puntos MediaPipe: {articulacionSel.puntos_mediapipe.join(' → ')}
            </div>
          )}
        </div>

        {/* Poses / Keyframes */}
        {form.id_articulacion_principal && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '10px',
            }}>
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
                textAlign: 'center', fontSize: '0.8rem',
                color: 'var(--blue)', opacity: 0.6,
              }}>
                Sin poses — el ejercicio no tendrá evaluación por ángulo
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Línea de tiempo visual */}
                <TimelinePoses poses={form.secuencia_poses} />

                {/* Cards de poses */}
                {form.secuencia_poses.map((pose, idx) => (
                  <PoseCard
                    key={pose.tmpId}
                    pose={pose}
                    index={idx}
                    onChange={(field, value) => updatePose(pose.tmpId, field, value)}
                    onRemove={() => removePose(pose.tmpId)}
                    nombreArticulacion={articulacionSel?.nombre_articulacion ?? ''}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Opción biblioteca ── */}
      {mostrarOpcionBiblioteca && !ejercicioInicial?.id_biblioteca_ejercicio && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 14px', borderRadius: '10px',
          background: '#f8fcff', border: '1px solid var(--border)',
        }}>
          <input
            type="checkbox"
            id="guardar-biblioteca"
            checked={form.guardar_en_biblioteca}
            onChange={e => update('guardar_en_biblioteca', e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--blue)' }}
          />
          <label htmlFor="guardar-biblioteca" style={{
            fontSize: '0.82rem', fontWeight: 600,
            color: 'var(--text)', cursor: 'pointer',
          }}>
            Guardar en mi biblioteca para reutilizar en otras rutinas
          </label>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '9px',
          background: '#fde8e8', color: '#c0392b', fontSize: '0.8rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={btnOutline}>Cancelar</button>
        <button onClick={confirmar} style={btnPrimary}>
          ✅ Confirmar ejercicio
        </button>
      </div>
    </div>
  )
}

// ─── Timeline visual de poses ─────────────────────────────────────────────────
function TimelinePoses({ poses }: { poses: Pose[] }) {
  if (poses.length === 0) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0',
      padding: '12px 16px', borderRadius: '10px',
      background: 'rgba(255,255,255,0.7)',
      border: '1px solid rgba(75,179,214,0.2)',
      overflowX: 'auto',
    }}>
      {poses.map((pose, idx) => (
        <div key={pose.tmpId} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {/* Nodo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'var(--blue)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '0.85rem',
              boxShadow: '0 2px 8px rgba(75,179,214,0.4)',
            }}>
              {pose.angulo}°
            </div>
            <div style={{
              fontSize: '0.65rem', color: 'var(--blue)',
              fontWeight: 600, textAlign: 'center',
              maxWidth: '60px', lineHeight: 1.2,
            }}>
              {pose.nombre}
            </div>
          </div>
          {/* Línea conectora */}
          {idx < poses.length - 1 && (
            <div style={{
              width: '40px', height: '2px',
              background: 'linear-gradient(to right, var(--blue), var(--blue-light))',
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute', top: '-8px', left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.6rem', color: 'var(--blue)', opacity: 0.6,
              }}>→</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Card de una pose ─────────────────────────────────────────────────────────
function PoseCard({
  pose, index, onChange, onRemove, nombreArticulacion,
}: {
  pose: Pose
  index: number
  onChange: (field: keyof Pose, value: string | number) => void
  onRemove: () => void
  nombreArticulacion: string
}) {
  return (
    <div style={{
      borderRadius: '10px',
      border: '1px solid rgba(75,179,214,0.3)',
      background: 'rgba(255,255,255,0.8)',
      overflow: 'hidden',
    }}>
      {/* Cabecera */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 14px',
        background: 'rgba(75,179,214,0.08)',
        borderBottom: '1px solid rgba(75,179,214,0.15)',
      }}>
        <span style={{
          background: 'var(--blue)', color: '#fff',
          borderRadius: '6px', padding: '2px 8px',
          fontSize: '0.7rem', fontWeight: 800,
        }}>
          Pose {index + 1}
        </span>
        <input
          value={pose.nombre}
          onChange={e => onChange('nombre', e.target.value)}
          placeholder="Nombre de la pose"
          style={{
            flex: 1, border: 'none', background: 'transparent',
            fontSize: '0.83rem', fontWeight: 600, color: 'var(--text)',
            outline: 'none',
          }}
        />
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '0.85rem', opacity: 0.7 }}>
          ✕
        </button>
      </div>

      {/* Cuerpo: muñequito + controles */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0', padding: '0' }}>

        {/* Muñequito */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '12px 8px',
          background: 'rgba(75,179,214,0.04)',
          borderRight: '1px solid rgba(75,179,214,0.15)',
        }}>
          <MunequitoArticulacion angulo={pose.angulo} nombreArticulacion={nombreArticulacion} />
          <div style={{
            marginTop: '6px', fontWeight: 800, fontSize: '1.1rem',
            color: 'var(--blue)', textAlign: 'center',
          }}>
            {pose.angulo}°
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', textAlign: 'center', marginTop: '2px' }}>
            {describeAngulo(pose.angulo, nombreArticulacion)}
          </div>
        </div>

        {/* Controles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '14px' }}>
          {/* Ángulo */}
          <div>
            <label style={{ ...labelStyle, color: '#555' }}>Ángulo objetivo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range" min={0} max={180} step={5}
                value={pose.angulo}
                onChange={e => onChange('angulo', parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--blue)' }}
              />
              <span style={{ minWidth: '42px', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', color: 'var(--blue)' }}>
                {pose.angulo}°
              </span>
            </div>
          </div>

          {/* Tolerancia */}
          <div>
            <label style={{ ...labelStyle, color: '#555' }}>Tolerancia (±°)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range" min={1} max={30} step={1}
                value={pose.tolerancia}
                onChange={e => onChange('tolerancia', parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--blue)' }}
              />
              <span style={{ minWidth: '34px', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)' }}>
                ±{pose.tolerancia}°
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: '2px' }}>
              Rango aceptado: {Math.max(0, pose.angulo - pose.tolerancia)}° – {Math.min(180, pose.angulo + pose.tolerancia)}°
            </div>
          </div>

          {/* Hold */}
          <div>
            <label style={{ ...labelStyle, color: '#555' }}>Mantener (seg)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range" min={0} max={10} step={0.5}
                value={pose.hold_sec}
                onChange={e => onChange('hold_sec', parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--blue)' }}
              />
              <span style={{ minWidth: '34px', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)' }}>
                {pose.hold_sec}s
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: '2px' }}>
              {pose.hold_sec === 0 ? 'Sin tiempo mínimo' : `Debe sostener ${pose.hold_sec}s en rango`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Descripción textual del ángulo ──────────────────────────────────────────
function describeAngulo(angulo: number, art: string): string {
  const esCodo    = art.toLowerCase().includes('codo')
  const esRodilla = art.toLowerCase().includes('rodilla')
  const esHombro  = art.toLowerCase().includes('hombro')

  if (esCodo) {
    if (angulo <= 20)  return 'Codo casi extendido'
    if (angulo <= 60)  return 'Extensión moderada'
    if (angulo <= 100) return 'Flexión media'
    if (angulo <= 140) return 'Flexión pronunciada'
    return 'Codo muy flexionado'
  }
  if (esRodilla) {
    if (angulo <= 20)  return 'Rodilla casi recta'
    if (angulo <= 60)  return 'Flexión ligera'
    if (angulo <= 100) return 'Flexión media'
    if (angulo <= 140) return 'Flexión profunda'
    return 'Rodilla muy flexionada'
  }
  if (esHombro) {
    if (angulo <= 30)  return 'Brazo pegado al cuerpo'
    if (angulo <= 80)  return 'Elevación parcial'
    if (angulo <= 120) return 'Brazo a la altura del hombro'
    if (angulo <= 160) return 'Elevación alta'
    return 'Brazo extendido arriba'
  }
  if (angulo <= 30)  return 'Casi cerrado'
  if (angulo <= 90)  return 'Ángulo agudo'
  if (angulo <= 150) return 'Ángulo obtuso'
  return 'Casi extendido'
}

// ─── Muñequito SVG animado por articulación ───────────────────────────────────
function MunequitoArticulacion({ angulo, nombreArticulacion }: {
  angulo: number
  nombreArticulacion: string
}) {
  const art = nombreArticulacion.toLowerCase()
  const esCodo    = art.includes('codo')
  const esRodilla = art.includes('rodilla')
  const esDerecho = art.includes('derecho') || art.includes('der')

  // Ángulo en radianes para el segmento móvil
  // 180° = extendido, 0° = completamente doblado
  const rad = ((180 - angulo) * Math.PI) / 180

  if (esCodo) return <MunequitoCodo angulo={angulo} derecho={esDerecho} />
  if (esRodilla) return <MunequitoRodilla angulo={angulo} derecho={esDerecho} />
  return <MunequitoGenerico angulo={angulo} />
}

// ─── Muñequito Codo ───────────────────────────────────────────────────────────
function MunequitoCodo({ angulo, derecho }: { angulo: number; derecho: boolean }) {
  // Origen en el hombro, codo en el centro, muñeca calculada
  const sx = 80, sy = 30            // hombro
  const ex = 80, ey = 90            // codo (fijo)
  const largoAntebrazo = 55

  // El ángulo 180° = brazo extendido (antebrazo apunta hacia abajo)
  // El ángulo 0° = brazo completamente doblado (antebrazo apunta hacia arriba)
  const rad = ((angulo) * Math.PI) / 180
  // Brazo hacia abajo es la referencia (270° en coords SVG = hacia abajo)
  const wx = ex + largoAntebrazo * Math.sin(rad) * (derecho ? 1 : -1)
  const wy = ey + largoAntebrazo * Math.cos(rad)

  // Arco del ángulo en el codo
  const arcR = 18
  const a1x = ex, a1y = ey - arcR          // punto en brazo (arriba)
  const a2x = ex + arcR * Math.sin(rad) * (derecho ? 1 : -1)
  const a2y = ey + arcR * Math.cos(rad)
  const largeArc = angulo > 180 ? 1 : 0
  const sweep = derecho ? 1 : 0

  return (
    <svg width="160" height="150" style={{ display: 'block' }}>
      {/* Cabeza */}
      <circle cx="80" cy="12" r="9" fill="none" stroke="#4BB3D6" strokeWidth="2"/>
      {/* Cuello + torso */}
      <line x1="80" y1="21" x2="80" y2="30" stroke="#4BB3D6" strokeWidth="2"/>

      {/* Brazo (hombro → codo) */}
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#4BB3D6" strokeWidth="3" strokeLinecap="round"/>

      {/* Antebrazo (codo → muñeca) — parte móvil */}
      <line x1={ex} y1={ey} x2={wx} y2={wy} stroke="#E74C3C" strokeWidth="3" strokeLinecap="round"/>

      {/* Arco del ángulo */}
      <path
        d={`M ${a1x} ${a1y} A ${arcR} ${arcR} 0 ${largeArc} ${sweep} ${a2x} ${a2y}`}
        fill="none" stroke="rgba(75,179,214,0.35)" strokeWidth="5" strokeLinecap="round"
      />

      {/* Puntos articulación */}
      <circle cx={sx} cy={sy} r="4" fill="#4BB3D6"/>
      <circle cx={ex} cy={ey} r="5" fill="#185FA5"/>
      <circle cx={wx} cy={wy} r="4" fill="#E74C3C"/>

      {/* Etiquetas */}
      <text x="95" y="33" fontSize="9" fill="#4BB3D6" fontFamily="sans-serif">hombro</text>
      <text x={derecho ? ex + 8 : ex - 40} y={ey + 4} fontSize="9" fill="#185FA5" fontFamily="sans-serif">codo</text>
      <text x={wx > 100 ? wx - 40 : wx + 4} y={wy + 4} fontSize="9" fill="#E74C3C" fontFamily="sans-serif">muñeca</text>

      {/* Leyenda brazo/antebrazo */}
      <line x1="10" y1="135" x2="26" y2="135" stroke="#4BB3D6" strokeWidth="3" strokeLinecap="round"/>
      <text x="30" y="139" fontSize="9" fill="#4BB3D6" fontFamily="sans-serif">brazo</text>
      <line x1="70" y1="135" x2="86" y2="135" stroke="#E74C3C" strokeWidth="3" strokeLinecap="round"/>
      <text x="90" y="139" fontSize="9" fill="#E74C3C" fontFamily="sans-serif">antebrazo</text>
    </svg>
  )
}

// ─── Muñequito Rodilla ────────────────────────────────────────────────────────
function MunequitoRodilla({ angulo, derecho }: { angulo: number; derecho: boolean }) {
  const cx = 80
  // Cadera
  const hx = cx, hy = 20
  // Rodilla (fija)
  const rx = cx, ry = 90
  // Largo de la pierna inferior
  const largoTibia = 55

  // 180° = pierna extendida (tibia apunta abajo)
  // 0° = rodilla muy doblada (tibia apunta hacia atrás/arriba)
  const rad = (angulo * Math.PI) / 180
  const ax = rx + largoTibia * Math.sin(Math.PI - rad) * (derecho ? 0.3 : -0.3)
  const ay = ry + largoTibia * Math.cos(Math.PI - rad) * -1 + largoTibia

  // Para ángulos pequeños el tobillo va hacia atrás
  const tx = rx - largoTibia * Math.sin(rad) * (derecho ? 0.4 : -0.4)
  const ty = ry + largoTibia * Math.abs(Math.cos(rad))

  // Arco
  const arcR = 16
  const arc1y = ry - arcR
  const arc2x = rx + arcR * Math.sin(Math.PI - rad) * (derecho ? 0.3 : -0.3) * -1
  const arc2y = ry + arcR * Math.abs(Math.cos(rad))

  return (
    <svg width="160" height="160" style={{ display: 'block' }}>
      {/* Cabeza */}
      <circle cx="80" cy="10" r="8" fill="none" stroke="#4BB3D6" strokeWidth="2"/>
      {/* Torso muy compacto */}
      <line x1="80" y1="18" x2="80" y2="26" stroke="#4BB3D6" strokeWidth="2"/>

      {/* Muslo (cadera → rodilla) */}
      <line x1={hx} y1={hy} x2={rx} y2={ry} stroke="#4BB3D6" strokeWidth="3" strokeLinecap="round"/>

      {/* Tibia (rodilla → tobillo) — móvil */}
      <line x1={rx} y1={ry} x2={tx} y2={ty} stroke="#E74C3C" strokeWidth="3" strokeLinecap="round"/>

      {/* Arco del ángulo */}
      <path
        d={`M ${rx} ${arc1y} A ${arcR} ${arcR} 0 0 ${derecho ? 0 : 1} ${arc2x} ${arc2y}`}
        fill="none" stroke="rgba(75,179,214,0.35)" strokeWidth="5" strokeLinecap="round"
      />

      {/* Puntos */}
      <circle cx={hx} cy={hy} r="4" fill="#4BB3D6"/>
      <circle cx={rx} cy={ry} r="5" fill="#185FA5"/>
      <circle cx={tx} cy={ty} r="4" fill="#E74C3C"/>

      {/* Etiquetas */}
      <text x="88" y={hy + 4} fontSize="9" fill="#4BB3D6" fontFamily="sans-serif">cadera</text>
      <text x={rx + 8} y={ry + 4} fontSize="9" fill="#185FA5" fontFamily="sans-serif">rodilla</text>
      <text x={tx > 100 ? tx - 38 : tx + 6} y={ty + 4} fontSize="9" fill="#E74C3C" fontFamily="sans-serif">tobillo</text>

      {/* Leyenda */}
      <line x1="10" y1="148" x2="26" y2="148" stroke="#4BB3D6" strokeWidth="3" strokeLinecap="round"/>
      <text x="30" y="152" fontSize="9" fill="#4BB3D6" fontFamily="sans-serif">muslo</text>
      <line x1="70" y1="148" x2="86" y2="148" stroke="#E74C3C" strokeWidth="3" strokeLinecap="round"/>
      <text x="90" y="152" fontSize="9" fill="#E74C3C" fontFamily="sans-serif">tibia</text>
    </svg>
  )
}

// ─── Muñequito genérico (otras articulaciones) ────────────────────────────────
function MunequitoGenerico({ angulo }: { angulo: number }) {
  const cx = 80, cy = 75
  const r = 45
  const rad = (angulo * Math.PI) / 180

  const x1 = cx, y1 = cy - r
  const x2 = cx + r * Math.sin(rad)
  const y2 = cy - r * Math.cos(rad)

  const largeArc = angulo > 180 ? 1 : 0
  const arcPath = `M ${cx + 16} ${cy - 16} A 16 16 0 ${largeArc} 1 ${cx + 16 * Math.sin(rad)} ${cy - 16 * Math.cos(rad)}`

  return (
    <svg width="160" height="150" style={{ display: 'block' }}>
      <line x1={cx} y1={cy} x2={x1} y2={y1} stroke="#4BB3D6" strokeWidth="3" strokeLinecap="round"/>
      <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#E74C3C" strokeWidth="3" strokeLinecap="round"/>
      <path d={arcPath} fill="none" stroke="rgba(75,179,214,0.4)" strokeWidth="5"/>
      <circle cx={cx} cy={cy} r="5" fill="#185FA5"/>
      <circle cx={x1} cy={y1} r="3.5" fill="#4BB3D6"/>
      <circle cx={x2} cy={y2} r="3.5" fill="#E74C3C"/>
    </svg>
  )
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
  fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnOutline: React.CSSProperties = {
  background: 'transparent', border: '1.5px solid var(--border)',
  color: 'var(--text-mid)', borderRadius: '9px', padding: '9px 18px',
  fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
  fontFamily: 'inherit',
}
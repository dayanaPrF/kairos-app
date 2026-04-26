'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos (alineados a la DB) ────────────────────────────────────────────────
interface Rutina {
  id_rutina: string
  nombre_rutina: string
  duracion: number | null
  created_at: string
  fases?: Fase[]
  // conteo extra (join manual)
  total_fases?: number
  total_pacientes?: number
}

interface Fase {
  id_fase: string
  numero_fase: number
  nombre_fase: string
  duracion_fase: number | null
  indicaciones_medico: string | null
  id_rutina: string
  ejercicios?: Ejercicio[]
}

interface Ejercicio {
  id_ejercicio: string
  nombre_ejercicio: string
  orden: number
  descripcion: string | null
  video_muestra: string | null
  repeticiones: number | null
  metrica_objetivo: Record<string, unknown> | null
  icono: string | null
  id_fase: string
}

interface RutinaPaciente {
  id_rutina_paciente: string
  id_rutina: string
  id_paciente: string
  fecha_inicio: string | null
  fecha_fin: string | null
  activa: boolean
  nombre_rutina?: string
  nombre_paciente?: string
}

interface PacienteOpt {
  id_paciente: string
  nombre: string
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'biblioteca' | 'builder' | 'asignaciones'

// ─── Componente principal ─────────────────────────────────────────────────────
export function FisioSectionRutinas() {
  const [tab, setTab] = useState<Tab>('biblioteca')

  return (
    <div className="rutinas-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            🏋️ Rutinas
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: '4px 0 0' }}>
            Crea, gestiona y asigna rutinas de rehabilitación a tus pacientes
          </p>
        </div>
        {tab === 'biblioteca' && (
          <button
            onClick={() => setTab('builder')}
            style={{
              background: 'var(--blue)', color: '#fff', border: 'none',
              borderRadius: '10px', padding: '10px 18px',
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            + Nueva rutina
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px',
        background: 'var(--bg)', borderRadius: '12px',
        padding: '4px', border: '1px solid var(--border)',
        width: 'fit-content',
      }}>
        {([
          { key: 'biblioteca', label: '📚 Biblioteca', },
          { key: 'builder',    label: '🔧 Crear / editar', },
          { key: 'asignaciones', label: '📋 Asignaciones', },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: '9px', border: 'none',
              background: tab === t.key ? 'var(--blue)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--text-mid)',
              fontWeight: tab === t.key ? 700 : 500,
              fontSize: '0.82rem', cursor: 'pointer', transition: '.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'biblioteca'   && <TabBiblioteca onEdit={() => setTab('builder')} onAsignar={() => setTab('asignaciones')} />}
      {tab === 'builder'      && <TabBuilder onDone={() => setTab('biblioteca')} />}
      {tab === 'asignaciones' && <TabAsignaciones />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — BIBLIOTECA
// ═══════════════════════════════════════════════════════════════════════════════
function TabBiblioteca({ onEdit, onAsignar }: { onEdit: () => void; onAsignar: () => void }) {
  const [rutinas, setRutinas]   = useState<Rutina[]>([])
  const [loading, setLoading]   = useState(true)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [detalle, setDetalle]   = useState<Record<string, Fase[]>>({})

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: ruts } = await supabase
        .from('rutina')
        .select('id_rutina, nombre_rutina, duracion, created_at')
        .eq('id_fisioterapeuta', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (!ruts) { setLoading(false); return }

      // Conteo de fases por rutina
      const ids = ruts.map(r => r.id_rutina)
      const { data: fases } = await supabase
        .from('fase')
        .select('id_rutina')
        .in('id_rutina', ids)
        .is('deleted_at', null)

      // Conteo de asignaciones activas
      const { data: asigs } = await supabase
        .from('rutina_paciente')
        .select('id_rutina')
        .in('id_rutina', ids)
        .eq('activa', true)
        .is('deleted_at', null)

      const fasesPorRutina: Record<string, number> = {}
      for (const f of fases ?? []) fasesPorRutina[f.id_rutina] = (fasesPorRutina[f.id_rutina] ?? 0) + 1

      const asigsPorRutina: Record<string, number> = {}
      for (const a of asigs ?? []) asigsPorRutina[a.id_rutina] = (asigsPorRutina[a.id_rutina] ?? 0) + 1

      setRutinas(ruts.map(r => ({
        ...r,
        total_fases: fasesPorRutina[r.id_rutina] ?? 0,
        total_pacientes: asigsPorRutina[r.id_rutina] ?? 0,
      })))
      setLoading(false)
    }
    load()
  }, [])

  const expandir = async (id: string) => {
    if (expandida === id) { setExpandida(null); return }
    setExpandida(id)
    if (detalle[id]) return

    const { data: fases } = await supabase
      .from('fase')
      .select('id_fase, numero_fase, nombre_fase, duracion_fase, indicaciones_medico, id_rutina')
      .eq('id_rutina', id)
      .is('deleted_at', null)
      .order('numero_fase', { ascending: true })

    if (!fases) return

    const fasIds = fases.map(f => f.id_fase)
    const { data: ejercicios } = await supabase
      .from('ejercicio')
      .select('id_ejercicio, nombre_ejercicio, orden, descripcion, repeticiones, icono, id_fase')
      .in('id_fase', fasIds)
      .is('deleted_at', null)
      .order('orden', { ascending: true })

    const ejPorFase: Record<string, Ejercicio[]> = {}
    for (const e of ejercicios ?? []) {
      if (!ejPorFase[e.id_fase]) ejPorFase[e.id_fase] = []
      ejPorFase[e.id_fase].push(e as Ejercicio)
    }

    setDetalle(prev => ({
      ...prev,
      [id]: fases.map(f => ({ ...f, ejercicios: ejPorFase[f.id_fase] ?? [] })),
    }))
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta rutina? Esta acción no se puede deshacer.')) return
    await supabase.from('rutina').update({ deleted_at: new Date().toISOString() }).eq('id_rutina', id)
    setRutinas(prev => prev.filter(r => r.id_rutina !== id))
  }

  if (loading) return <LoadingState />

  if (rutinas.length === 0) return (
    <EmptyState
      icon="🏋️"
      title="Sin rutinas todavía"
      desc="Crea tu primera rutina con fases y ejercicios personalizados"
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {rutinas.map(r => (
        <div key={r.id_rutina} className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Cabecera de la rutina */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '16px 20px', cursor: 'pointer',
              borderBottom: expandida === r.id_rutina ? '1px solid var(--border)' : 'none',
            }}
            onClick={() => expandir(r.id_rutina)}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'var(--blue-xlight)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0,
            }}>🏋️</div>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                {r.nombre_rutina ?? 'Sin nombre'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '3px', display: 'flex', gap: '12px' }}>
                <span>📐 {r.total_fases} fase{r.total_fases !== 1 ? 's' : ''}</span>
                {r.duracion && <span>⏱ {r.duracion} días</span>}
                <span>👤 {r.total_pacientes} paciente{r.total_pacientes !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={e => { e.stopPropagation(); onAsignar() }}
                style={btnStyle('outline')}
              >
                Asignar
              </button>
              <button
                onClick={e => { e.stopPropagation(); eliminar(r.id_rutina) }}
                style={{ ...btnStyle('ghost'), color: '#c0392b' }}
              >
                🗑
              </button>
              <span style={{
                fontSize: '0.8rem', color: 'var(--text-light)',
                transition: '.2s', transform: expandida === r.id_rutina ? 'rotate(180deg)' : 'none',
                display: 'inline-block',
              }}>▼</span>
            </div>
          </div>

          {/* Detalle expandido */}
          {expandida === r.id_rutina && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(detalle[r.id_rutina] ?? []).length === 0 ? (
                <div style={{ opacity: 0.4, fontSize: '0.82rem', fontStyle: 'italic', padding: '8px 0' }}>
                  Esta rutina no tiene fases aún
                </div>
              ) : (detalle[r.id_rutina] ?? []).map(fase => (
                <div key={fase.id_fase} style={{
                  borderRadius: '10px', border: '1px solid var(--border)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    background: 'var(--blue-xlight)', padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <span style={{
                      background: 'var(--blue)', color: '#fff',
                      borderRadius: '6px', padding: '2px 8px',
                      fontSize: '0.7rem', fontWeight: 800,
                    }}>
                      Fase {fase.numero_fase}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>
                      {fase.nombre_fase}
                    </span>
                    {fase.duracion_fase && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginLeft: 'auto' }}>
                        {fase.duracion_fase} días
                      </span>
                    )}
                  </div>

                  {fase.indicaciones_medico && (
                    <div style={{
                      padding: '8px 14px', background: '#fffbeb',
                      fontSize: '0.78rem', color: '#856404',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      💡 {fase.indicaciones_medico}
                    </div>
                  )}

                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(fase.ejercicios ?? []).length === 0 ? (
                      <div style={{ opacity: 0.4, fontSize: '0.78rem', fontStyle: 'italic' }}>Sin ejercicios</div>
                    ) : (fase.ejercicios ?? []).map(ej => (
                      <div key={ej.id_ejercicio} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px', borderRadius: '8px',
                        background: 'var(--bg)', border: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: '1.1rem' }}>{ej.icono ?? '🏋️'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>
                            {ej.nombre_ejercicio}
                          </div>
                          {ej.descripcion && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '1px' }}>
                              {ej.descripcion}
                            </div>
                          )}
                        </div>
                        {ej.repeticiones && (
                          <span style={{
                            background: 'var(--blue-xlight)', color: 'var(--blue)',
                            borderRadius: '8px', padding: '3px 9px',
                            fontSize: '0.72rem', fontWeight: 700,
                          }}>
                            {ej.repeticiones} reps
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
function TabBuilder({ onDone }: { onDone: () => void }) {
  const [nombre, setNombre]   = useState('')
  const [duracion, setDuracion] = useState('')
  const [fases, setFases]     = useState<FaseForm[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  interface EjercicioForm {
    tmpId: string
    nombre_ejercicio: string
    orden: number
    descripcion: string
    repeticiones: string
    icono: string
  }

  interface FaseForm {
    tmpId: string
    numero_fase: number
    nombre_fase: string
    duracion_fase: string
    indicaciones_medico: string
    ejercicios: EjercicioForm[]
  }

  const addFase = () => {
    setFases(prev => [...prev, {
      tmpId: crypto.randomUUID(),
      numero_fase: prev.length + 1,
      nombre_fase: '',
      duracion_fase: '',
      indicaciones_medico: '',
      ejercicios: [],
    }])
  }

  const removeFase = (tmpId: string) =>
    setFases(prev => prev.filter(f => f.tmpId !== tmpId).map((f, i) => ({ ...f, numero_fase: i + 1 })))

  const updateFase = (tmpId: string, field: string, value: string) =>
    setFases(prev => prev.map(f => f.tmpId === tmpId ? { ...f, [field]: value } : f))

  const addEjercicio = (faseTmpId: string) =>
    setFases(prev => prev.map(f => f.tmpId === faseTmpId ? {
      ...f,
      ejercicios: [...f.ejercicios, {
        tmpId: crypto.randomUUID(),
        nombre_ejercicio: '',
        orden: f.ejercicios.length + 1,
        descripcion: '',
        repeticiones: '',
        icono: '🏋️',
      }],
    } : f))

  const removeEjercicio = (faseTmpId: string, ejTmpId: string) =>
    setFases(prev => prev.map(f => f.tmpId === faseTmpId ? {
      ...f,
      ejercicios: f.ejercicios
        .filter(e => e.tmpId !== ejTmpId)
        .map((e, i) => ({ ...e, orden: i + 1 })),
    } : f))

  const updateEjercicio = (faseTmpId: string, ejTmpId: string, field: string, value: string) =>
    setFases(prev => prev.map(f => f.tmpId === faseTmpId ? {
      ...f,
      ejercicios: f.ejercicios.map(e => e.tmpId === ejTmpId ? { ...e, [field]: value } : e),
    } : f))

  const guardar = async () => {
    if (!nombre.trim()) { setError('El nombre de la rutina es obligatorio'); return }
    setSaving(true); setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // 1. Insertar rutina
      const { data: rutinaData, error: errRutina } = await supabase
        .from('rutina')
        .insert({
          nombre_rutina: nombre.trim(),
          duracion: duracion ? parseInt(duracion) : null,
          id_fisioterapeuta: user.id,
          created_by: user.id,
          updated_by: user.id,
        })
        .select('id_rutina')
        .single()

      if (errRutina || !rutinaData) throw new Error(errRutina?.message ?? 'Error al guardar rutina')

      const id_rutina = rutinaData.id_rutina

      // 2. Insertar fases y sus ejercicios
      for (const fase of fases) {
        const { data: faseData, error: errFase } = await supabase
          .from('fase')
          .insert({
            numero_fase: fase.numero_fase,
            nombre_fase: fase.nombre_fase.trim() || `Fase ${fase.numero_fase}`,
            duracion_fase: fase.duracion_fase ? parseInt(fase.duracion_fase) : null,
            indicaciones_medico: fase.indicaciones_medico.trim() || null,
            id_rutina,
            created_by: user.id,
            updated_by: user.id,
          })
          .select('id_fase')
          .single()

        if (errFase || !faseData) throw new Error(errFase?.message ?? 'Error al guardar fase')

        const id_fase = faseData.id_fase

        if (fase.ejercicios.length > 0) {
          const { error: errEj } = await supabase
            .from('ejercicio')
            .insert(fase.ejercicios.map(e => ({
              nombre_ejercicio: e.nombre_ejercicio.trim() || 'Ejercicio',
              orden: e.orden,
              descripcion: e.descripcion.trim() || null,
              repeticiones: e.repeticiones ? parseInt(e.repeticiones) : null,
              icono: e.icono || '🏋️',
              id_fase,
              created_by: user.id,
              updated_by: user.id,
            })))

          if (errEj) throw new Error(errEj.message)
        }
      }

      onDone()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const ICONOS = ['🏋️','🦵','💪','🤸','🧘','🚶','🏃','🔄','⬆️','🎯','🦶','🙌']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '760px' }}>
      {/* Datos generales */}
      <div className="dash-card">
        <div className="dash-card-title">📝 Datos generales</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginTop: '4px' }}>
          <div>
            <label style={labelStyle}>Nombre de la rutina *</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Rehabilitación de rodilla — Fase inicial"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Duración total (días)</label>
            <input
              type="number"
              value={duracion}
              onChange={e => setDuracion(e.target.value)}
              placeholder="30"
              style={inputStyle}
              min={1}
            />
          </div>
        </div>
      </div>

      {/* Fases */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {fases.map(fase => (
          <div key={fase.tmpId} className="dash-card" style={{ borderLeft: '4px solid var(--blue)' }}>
            {/* Cabecera fase */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{
                background: 'var(--blue)', color: '#fff',
                borderRadius: '8px', padding: '3px 10px',
                fontSize: '0.75rem', fontWeight: 800, flexShrink: 0,
              }}>
                Fase {fase.numero_fase}
              </span>
              <input
                value={fase.nombre_fase}
                onChange={e => updateFase(fase.tmpId, 'nombre_fase', e.target.value)}
                placeholder="Nombre de la fase (ej. Fase aguda)"
                style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
              />
              <button onClick={() => removeFase(fase.tmpId)} style={{ ...btnStyle('ghost'), color: '#c0392b', flexShrink: 0 }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Duración (días)</label>
                <input
                  type="number"
                  value={fase.duracion_fase}
                  onChange={e => updateFase(fase.tmpId, 'duracion_fase', e.target.value)}
                  placeholder="7"
                  style={inputStyle}
                  min={1}
                />
              </div>
              <div>
                <label style={labelStyle}>Indicaciones para el paciente</label>
                <input
                  value={fase.indicaciones_medico}
                  onChange={e => updateFase(fase.tmpId, 'indicaciones_medico', e.target.value)}
                  placeholder="Ej. Evitar cargar peso mayor a 5 kg"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Ejercicios */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {fase.ejercicios.map(ej => (
                <div key={ej.tmpId} style={{
                  display: 'grid', gridTemplateColumns: '36px 2fr 2fr 80px 36px',
                  gap: '8px', alignItems: 'center',
                  padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                }}>
                  {/* Icono picker simple */}
                  <select
                    value={ej.icono}
                    onChange={e => updateEjercicio(fase.tmpId, ej.tmpId, 'icono', e.target.value)}
                    style={{ border: 'none', background: 'transparent', fontSize: '1.1rem', cursor: 'pointer', padding: 0 }}
                  >
                    {ICONOS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>

                  <input
                    value={ej.nombre_ejercicio}
                    onChange={e => updateEjercicio(fase.tmpId, ej.tmpId, 'nombre_ejercicio', e.target.value)}
                    placeholder="Nombre del ejercicio"
                    style={{ ...inputStyle, marginBottom: 0, fontSize: '0.82rem' }}
                  />
                  <input
                    value={ej.descripcion}
                    onChange={e => updateEjercicio(fase.tmpId, ej.tmpId, 'descripcion', e.target.value)}
                    placeholder="Descripción / instrucción"
                    style={{ ...inputStyle, marginBottom: 0, fontSize: '0.82rem' }}
                  />
                  <input
                    type="number"
                    value={ej.repeticiones}
                    onChange={e => updateEjercicio(fase.tmpId, ej.tmpId, 'repeticiones', e.target.value)}
                    placeholder="Reps"
                    style={{ ...inputStyle, marginBottom: 0, fontSize: '0.82rem', textAlign: 'center' }}
                    min={1}
                  />
                  <button
                    onClick={() => removeEjercicio(fase.tmpId, ej.tmpId)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '0.9rem' }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={() => addEjercicio(fase.tmpId)}
                style={{
                  width: '100%', padding: '9px', borderRadius: '9px',
                  border: '1.5px dashed var(--border)', background: 'transparent',
                  color: 'var(--blue)', fontSize: '0.8rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Agregar ejercicio
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addFase}
          style={{
            padding: '14px', borderRadius: '12px',
            border: '2px dashed var(--blue)', background: 'var(--blue-xlight)',
            color: 'var(--blue)', fontSize: '0.88rem', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          + Agregar fase
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: '#fde8e8', color: '#c0392b', fontSize: '0.82rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onDone} style={btnStyle('outline')}>Cancelar</button>
        <button
          onClick={guardar}
          disabled={saving}
          style={{ ...btnStyle('primary'), opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Guardando...' : '💾 Guardar rutina'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — ASIGNACIONES
// ═══════════════════════════════════════════════════════════════════════════════
function TabAsignaciones() {
  const [rutinas, setRutinas]       = useState<{ id_rutina: string; nombre_rutina: string }[]>([])
  const [pacientes, setPacientes]   = useState<PacienteOpt[]>([])
  const [asignaciones, setAsignaciones] = useState<RutinaPaciente[]>([])
  const [loading, setLoading]       = useState(true)

  // Form nueva asignación
  const [selRutina, setSelRutina]   = useState('')
  const [selPac, setSelPac]         = useState('')
  const [fechaIni, setFechaIni]     = useState('')
  const [fechaFin, setFechaFin]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Rutinas del fisio
      const { data: ruts } = await supabase
        .from('rutina')
        .select('id_rutina, nombre_rutina')
        .eq('id_fisioterapeuta', user.id)
        .is('deleted_at', null)

      // Pacientes asignados al fisio
      const { data: relPacs } = await supabase
        .from('paciente_fisioterapeuta')
        .select('id_paciente')
        .eq('id_fisioterapeuta', user.id)
        .is('deleted_at', null)

      const pacIds = relPacs?.map(r => r.id_paciente) ?? []

      let pacs: PacienteOpt[] = []
      if (pacIds.length) {
        const { data: perfiles } = await supabase
          .from('perfil')
          .select('id_perfil, nombre, primer_apellido')
          .in('id_perfil', pacIds)

        pacs = (perfiles ?? []).map(p => ({
          id_paciente: p.id_perfil,
          nombre: `${p.nombre} ${p.primer_apellido}`,
        }))
      }

      // Asignaciones activas
      const rutIds = (ruts ?? []).map(r => r.id_rutina)
      let asigs: RutinaPaciente[] = []

      if (rutIds.length) {
        const { data: asigRaw } = await supabase
          .from('rutina_paciente')
          .select('id_rutina_paciente, id_rutina, id_paciente, fecha_inicio, fecha_fin, activa')
          .in('id_rutina', rutIds)
          .is('deleted_at', null)
          .order('activa', { ascending: false })

        const mapaRutinas = Object.fromEntries((ruts ?? []).map(r => [r.id_rutina, r.nombre_rutina]))
        const mapaPacs = Object.fromEntries(pacs.map(p => [p.id_paciente, p.nombre]))

        asigs = (asigRaw ?? []).map(a => ({
          ...a,
          nombre_rutina: mapaRutinas[a.id_rutina] ?? '—',
          nombre_paciente: mapaPacs[a.id_paciente] ?? 'Paciente',
        }))
      }

      setRutinas(ruts ?? [])
      setPacientes(pacs)
      setAsignaciones(asigs)
      setLoading(false)
    }
    load()
  }, [])

  const asignar = async () => {
    if (!selRutina || !selPac) { setError('Selecciona rutina y paciente'); return }
    setSaving(true); setError(null)

    const { error: err } = await supabase
      .from('rutina_paciente')
      .insert({
        id_rutina: selRutina,
        id_paciente: selPac,
        fecha_inicio: fechaIni || null,
        fecha_fin: fechaFin || null,
        activa: true,
      })

    if (err) { setError(err.message); setSaving(false); return }

    // Refresh
    const rutNombre = rutinas.find(r => r.id_rutina === selRutina)?.nombre_rutina ?? '—'
    const pacNombre = pacientes.find(p => p.id_paciente === selPac)?.nombre ?? 'Paciente'

    setAsignaciones(prev => [{
      id_rutina_paciente: crypto.randomUUID(),
      id_rutina: selRutina,
      id_paciente: selPac,
      fecha_inicio: fechaIni || null,
      fecha_fin: fechaFin || null,
      activa: true,
      nombre_rutina: rutNombre,
      nombre_paciente: pacNombre,
    }, ...prev])

    setSelRutina(''); setSelPac(''); setFechaIni(''); setFechaFin('')
    setSaving(false)
  }

  const desactivar = async (id: string) => {
    await supabase
      .from('rutina_paciente')
      .update({ activa: false, updated_at: new Date().toISOString() })
      .eq('id_rutina_paciente', id)

    setAsignaciones(prev => prev.map(a =>
      a.id_rutina_paciente === id ? { ...a, activa: false } : a
    ))
  }

  if (loading) return <LoadingState />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Formulario nueva asignación */}
      <div className="dash-card">
        <div className="dash-card-title">➕ Nueva asignación</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
          <div>
            <label style={labelStyle}>Rutina</label>
            <select value={selRutina} onChange={e => setSelRutina(e.target.value)} style={selectStyle}>
              <option value="">— Selecciona rutina —</option>
              {rutinas.map(r => <option key={r.id_rutina} value={r.id_rutina}>{r.nombre_rutina}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Paciente</label>
            <select value={selPac} onChange={e => setSelPac(e.target.value)} style={selectStyle}>
              <option value="">— Selecciona paciente —</option>
              {pacientes.map(p => <option key={p.id_paciente} value={p.id_paciente}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Fecha de inicio</label>
            <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Fecha de fin (opcional)</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: '8px', color: '#c0392b', fontSize: '0.8rem' }}>⚠️ {error}</div>
        )}

        <button
          onClick={asignar}
          disabled={saving}
          style={{ ...btnStyle('primary'), marginTop: '14px', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Asignando...' : '✅ Asignar rutina'}
        </button>
      </div>

      {/* Lista de asignaciones */}
      <div className="dash-card">
        <div className="dash-card-title">📋 Asignaciones activas / historial</div>

        {asignaciones.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', opacity: 0.4, fontSize: '0.85rem', fontStyle: 'italic' }}>
            Sin asignaciones todavía
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {asignaciones.map(a => (
              <div key={a.id_rutina_paciente} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 14px', borderRadius: '10px',
                background: a.activa ? 'var(--bg)' : '#f8f8f8',
                border: `1px solid ${a.activa ? 'var(--border)' : '#e0e0e0'}`,
                opacity: a.activa ? 1 : 0.6,
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: a.activa ? 'var(--blue-xlight)' : '#eee',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', fontWeight: 800,
                  color: a.activa ? 'var(--blue)' : '#999', flexShrink: 0,
                }}>
                  {a.nombre_paciente?.charAt(0) ?? '?'}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>
                    {a.nombre_paciente}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px' }}>
                    🏋️ {a.nombre_rutina}
                    {a.fecha_inicio && ` · Inicio: ${a.fecha_inicio}`}
                    {a.fecha_fin    && ` · Fin: ${a.fecha_fin}`}
                  </div>
                </div>

                <span style={{
                  padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                  background: a.activa ? '#eef8d6' : '#f0f0f0',
                  color: a.activa ? '#76a82e' : '#999',
                }}>
                  {a.activa ? 'Activa' : 'Finalizada'}
                </span>

                {a.activa && (
                  <button
                    onClick={() => desactivar(a.id_rutina_paciente)}
                    style={{ ...btnStyle('ghost'), fontSize: '0.75rem', color: '#c0392b' }}
                  >
                    Finalizar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', opacity: 0.4 }}>
      Cargando...
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', gap: '10px', opacity: 0.5,
    }}>
      <span style={{ fontSize: '2.5rem' }}>{icon}</span>
      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{title}</div>
      <div style={{ fontSize: '0.82rem', textAlign: 'center', maxWidth: '300px' }}>{desc}</div>
    </div>
  )
}

// ─── Estilos reutilizables ────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '9px',
  border: '1.5px solid var(--border)', background: 'var(--bg)',
  fontSize: '0.85rem', color: 'var(--text)',
  outline: 'none', boxSizing: 'border-box', marginBottom: '0',
  fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--text-light)', marginBottom: '5px',
}

function btnStyle(variant: 'primary' | 'outline' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: '9px', padding: '9px 16px', fontSize: '0.82rem',
    fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
  }
  if (variant === 'primary') return { ...base, background: 'var(--blue)', color: '#fff' }
  if (variant === 'outline') return { ...base, background: 'transparent', border: '1.5px solid var(--border)', color: 'var(--text-mid)' }
  return { ...base, background: 'transparent', color: 'var(--text-light)', padding: '6px 10px' }
}
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EjercicioBuilder, type EjercicioFormData, type Pose } from '@/app/(dashboard)/fisio/sections/EjercicioBuilder'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface BibliotecaEjercicio {
  id_biblioteca_ejercicio: string
  nombre_ejercicio: string
  descripcion: string | null
  icono: string | null
  repeticiones?: number | null
  secuencia_poses: Pose[]
}

interface Rutina {
  id_rutina: string
  nombre_rutina: string
  duracion: number | null
  created_at: string
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
  ejercicios?: EjercicioEnFase[]
}

interface EjercicioEnFase {
  id_ejercicio: string
  nombre_ejercicio: string
  orden: number
  descripcion: string | null
  repeticiones: number | null
  icono: string | null
  id_fase: string
  id_biblioteca_ejercicio: string | null
  secuencia_poses_personalizada: Pose[] | null
  secuencia_poses_efectiva?: Pose[]
  tiene_ia?: boolean
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

interface EjercicioFormInterno extends EjercicioFormData {
  tmpId: string
  orden: number
}

interface FaseForm {
  tmpId: string
  numero_fase: number
  nombre_fase: string
  duracion_fase: string
  indicaciones_medico: string
  ejercicios: EjercicioFormInterno[]
}

type Tab = 'biblioteca_ej' | 'rutinas' | 'asignaciones'

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export function FisioSectionRutinas() {
  const [tab, setTab] = useState<Tab>('rutinas')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>🏋️ Rutinas</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: '4px 0 0' }}>
          Crea y asigna rutinas de rehabilitación con evaluación IA por poses
        </p>
      </div>

      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg)', borderRadius: '12px', padding: '4px', border: '1px solid var(--border)', width: 'fit-content' }}>
        {([
          { key: 'rutinas',       label: '📋 Mis rutinas' },
          { key: 'biblioteca_ej', label: '📚 Biblioteca de ejercicios' },
          { key: 'asignaciones',  label: '🔗 Asignaciones' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', borderRadius: '9px', border: 'none',
            background: tab === t.key ? 'var(--blue)' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--text-mid)',
            fontWeight: tab === t.key ? 700 : 500,
            fontSize: '0.82rem', cursor: 'pointer', transition: '.2s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rutinas'       && <TabRutinas onIrAsignaciones={() => setTab('asignaciones')} />}
      {tab === 'biblioteca_ej' && <TabBibliotecaEjercicios />}
      {tab === 'asignaciones'  && <TabAsignaciones />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB RUTINAS
// ═══════════════════════════════════════════════════════════════════════════════
function TabRutinas({ onIrAsignaciones }: { onIrAsignaciones: () => void }) {
  const [vista, setVista]         = useState<'lista' | 'builder'>('lista')
  const [rutinas, setRutinas]     = useState<Rutina[]>([])
  const [loading, setLoading]     = useState(true)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [detalle, setDetalle]     = useState<Record<string, Fase[]>>({})

  useEffect(() => { cargarRutinas() }, [])

  const cargarRutinas = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: ruts } = await supabase
      .from('rutina')
      .select('id_rutina, nombre_rutina, duracion, created_at')
      .eq('id_fisioterapeuta', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (!ruts) { setLoading(false); return }

    const ids = ruts.map(r => r.id_rutina)
    const [{ data: fases }, { data: asigs }] = await Promise.all([
      supabase.from('fase').select('id_rutina').in('id_rutina', ids).is('deleted_at', null),
      supabase.from('rutina_paciente').select('id_rutina').in('id_rutina', ids).eq('activa', true).is('deleted_at', null),
    ])

    const fasesPor: Record<string, number> = {}
    for (const f of fases ?? []) fasesPor[f.id_rutina] = (fasesPor[f.id_rutina] ?? 0) + 1
    const asigsPor: Record<string, number> = {}
    for (const a of asigs ?? []) asigsPor[a.id_rutina] = (asigsPor[a.id_rutina] ?? 0) + 1

    setRutinas(ruts.map(r => ({ ...r, total_fases: fasesPor[r.id_rutina] ?? 0, total_pacientes: asigsPor[r.id_rutina] ?? 0 })))
    setLoading(false)
  }

  const expandir = async (id: string) => {
    if (expandida === id) { setExpandida(null); return }
    setExpandida(id)
    if (detalle[id]) return

    const { data: fases } = await supabase
      .from('fase')
      .select('id_fase, numero_fase, nombre_fase, duracion_fase, indicaciones_medico, id_rutina')
      .eq('id_rutina', id).is('deleted_at', null).order('numero_fase')

    if (!fases?.length) { setDetalle(prev => ({ ...prev, [id]: [] })); return }

    const { data: ejercicios } = await supabase
      .from('ejercicio')
      .select(`id_ejercicio, nombre_ejercicio, orden, descripcion, repeticiones, icono, id_fase,
               id_biblioteca_ejercicio, secuencia_poses_personalizada,
               biblioteca_ejercicio ( secuencia_poses )`)
      .in('id_fase', fases.map(f => f.id_fase))
      .is('deleted_at', null).order('orden')

    const ejPorFase: Record<string, EjercicioEnFase[]> = {}
    for (const e of ejercicios ?? []) {
      const bib = (e as any).biblioteca_ejercicio
      const posesEfectivas: Pose[] =
        (e.secuencia_poses_personalizada as Pose[] | null) ??
        (bib?.secuencia_poses as Pose[] | null) ?? []

      const ej: EjercicioEnFase = {
        id_ejercicio: e.id_ejercicio, nombre_ejercicio: e.nombre_ejercicio,
        orden: e.orden, descripcion: e.descripcion,
        repeticiones: e.repeticiones, icono: e.icono, id_fase: e.id_fase,
        id_biblioteca_ejercicio: e.id_biblioteca_ejercicio,
        secuencia_poses_personalizada: e.secuencia_poses_personalizada as Pose[] | null,
        secuencia_poses_efectiva: posesEfectivas,
        tiene_ia: posesEfectivas.length > 0,
      }
      if (!ejPorFase[e.id_fase]) ejPorFase[e.id_fase] = []
      ejPorFase[e.id_fase].push(ej)
    }

    setDetalle(prev => ({ ...prev, [id]: fases.map(f => ({ ...f, ejercicios: ejPorFase[f.id_fase] ?? [] })) }))
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta rutina?')) return
    await supabase.from('rutina').update({ deleted_at: new Date().toISOString() }).eq('id_rutina', id)
    setRutinas(prev => prev.filter(r => r.id_rutina !== id))
  }

  if (loading) return <LoadingState />
  if (vista === 'builder') return <BuilderRutina onDone={() => { setVista('lista'); cargarRutinas() }} onCancelar={() => setVista('lista')} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setVista('builder')} style={btnPrimary}>+ Nueva rutina</button>
      </div>

      {rutinas.length === 0 ? (
        <EmptyState icon="📋" title="Sin rutinas" desc="Crea tu primera rutina de rehabilitación" />
      ) : rutinas.map(r => (
        <div key={r.id_rutina} className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', cursor: 'pointer', borderBottom: expandida === r.id_rutina ? '1px solid var(--border)' : 'none' }}
            onClick={() => expandir(r.id_rutina)}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--blue-xlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>📋</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>{r.nombre_rutina}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '3px', display: 'flex', gap: '12px' }}>
                <span>📐 {r.total_fases} fase{r.total_fases !== 1 ? 's' : ''}</span>
                {r.duracion && <span>⏱ {r.duracion} días</span>}
                <span>👤 {r.total_pacientes} paciente{r.total_pacientes !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={e => { e.stopPropagation(); onIrAsignaciones() }} style={btnOutline}>Asignar</button>
              <button onClick={e => { e.stopPropagation(); eliminar(r.id_rutina) }} style={{ ...btnGhost, color: '#c0392b' }}>🗑</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'inline-block', transform: expandida === r.id_rutina ? 'rotate(180deg)' : 'none', transition: '.2s' }}>▼</span>
            </div>
          </div>

          {expandida === r.id_rutina && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(detalle[r.id_rutina] ?? []).length === 0 ? (
                <div style={{ opacity: 0.4, fontSize: '0.82rem', fontStyle: 'italic' }}>Sin fases</div>
              ) : (detalle[r.id_rutina] ?? []).map(fase => (
                <div key={fase.id_fase} style={{ borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--blue-xlight)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: 'var(--blue)', color: '#fff', borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 800 }}>Fase {fase.numero_fase}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{fase.nombre_fase}</span>
                    {fase.duracion_fase && <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginLeft: 'auto' }}>{fase.duracion_fase} días</span>}
                  </div>
                  {fase.indicaciones_medico && (
                    <div style={{ padding: '8px 14px', background: '#fffbeb', fontSize: '0.78rem', color: '#856404', borderBottom: '1px solid var(--border)' }}>
                      💡 {fase.indicaciones_medico}
                    </div>
                  )}
                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(fase.ejercicios ?? []).map(ej => (
                      <div key={ej.id_ejercicio} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '1.1rem' }}>{ej.icono ?? '🏋️'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{ej.nombre_ejercicio}</div>
                          {ej.descripcion && <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '1px' }}>{ej.descripcion}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {ej.repeticiones && <Chip label={`${ej.repeticiones} reps`} />}
                          {ej.tiene_ia && <Chip label={`🤖 ${ej.secuencia_poses_efectiva?.length} poses`} color="green" />}
                          {ej.secuencia_poses_personalizada && <Chip label="✏️ Personalizado" color="yellow" />}
                        </div>
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
// BUILDER DE RUTINA
// ═══════════════════════════════════════════════════════════════════════════════
function BuilderRutina({ onDone, onCancelar }: { onDone: () => void; onCancelar: () => void }) {
  const [nombre, setNombre]         = useState('')
  const [duracion, setDuracion]     = useState('')
  const [fases, setFases]           = useState<FaseForm[]>([])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [editandoEj, setEditandoEj] = useState<{ faseTmpId: string; ejTmpId: string | null } | null>(null)
  const [biblioteca, setBiblioteca] = useState<BibliotecaEjercicio[]>([])
  const [mostrarBib, setMostrarBib] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('biblioteca_ejercicio')
        .select('id_biblioteca_ejercicio, nombre_ejercicio, descripcion, icono, secuencia_poses')
        .eq('id_fisioterapeuta', user.id).is('deleted_at', null).order('nombre_ejercicio')
      setBiblioteca(data ?? [])
    }
    load()
  }, [])

  const addFase = () => setFases(prev => [...prev, {
    tmpId: crypto.randomUUID(), numero_fase: prev.length + 1,
    nombre_fase: '', duracion_fase: '', indicaciones_medico: '', ejercicios: [],
  }])

  const removeFase = (tmpId: string) =>
    setFases(prev => prev.filter(f => f.tmpId !== tmpId).map((f, i) => ({ ...f, numero_fase: i + 1 })))

  const updateFase = (tmpId: string, field: keyof FaseForm, value: string) =>
    setFases(prev => prev.map(f => f.tmpId === tmpId ? { ...f, [field]: value } : f))

  const confirmarEjercicio = (faseTmpId: string, ejTmpId: string | null, data: EjercicioFormData) => {
    setFases(prev => prev.map(f => {
      if (f.tmpId !== faseTmpId) return f
      if (ejTmpId) return { ...f, ejercicios: f.ejercicios.map(e => e.tmpId === ejTmpId ? { ...e, ...data } : e) }
      return { ...f, ejercicios: [...f.ejercicios, { ...data, tmpId: crypto.randomUUID(), orden: f.ejercicios.length + 1 }] }
    }))
    setEditandoEj(null)
  }

  const removeEjercicio = (faseTmpId: string, ejTmpId: string) =>
    setFases(prev => prev.map(f => f.tmpId !== faseTmpId ? f : {
      ...f, ejercicios: f.ejercicios.filter(e => e.tmpId !== ejTmpId).map((e, i) => ({ ...e, orden: i + 1 })),
    }))

  const agregarDeBiblioteca = (faseTmpId: string, bib: BibliotecaEjercicio) => {
    setFases(prev => prev.map(f => f.tmpId !== faseTmpId ? f : {
      ...f, ejercicios: [...f.ejercicios, {
        tmpId: crypto.randomUUID(), orden: f.ejercicios.length + 1,
        nombre_ejercicio: bib.nombre_ejercicio,
        descripcion: bib.descripcion ?? '',
        video_muestra: '',
        icono: bib.icono ?? '🏋️',
        repeticiones: '',
        secuencia_poses: bib.secuencia_poses ?? [],
        guardar_en_biblioteca: false,
        tiene_override: false,
        id_biblioteca_ejercicio: bib.id_biblioteca_ejercicio,
      }],
    }))
    setMostrarBib(null)
  }

  // Contar total de articulaciones en todas las poses de un ejercicio
  const contarArts = (poses: Pose[]) =>
    poses.reduce((acc, p) => acc + p.articulaciones.length, 0)

  const guardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: rutinaData, error: errR } = await supabase
        .from('rutina')
        .insert({ nombre_rutina: nombre.trim(), duracion: duracion ? parseInt(duracion) : null, id_fisioterapeuta: user.id, created_by: user.id, updated_by: user.id })
        .select('id_rutina').single()
      if (errR || !rutinaData) throw new Error(errR?.message)

      for (const fase of fases) {
        const { data: faseData, error: errF } = await supabase
          .from('fase')
          .insert({ numero_fase: fase.numero_fase, nombre_fase: fase.nombre_fase || `Fase ${fase.numero_fase}`, duracion_fase: fase.duracion_fase ? parseInt(fase.duracion_fase) : null, indicaciones_medico: fase.indicaciones_medico || null, id_rutina: rutinaData.id_rutina, created_by: user.id, updated_by: user.id })
          .select('id_fase').single()
        if (errF || !faseData) throw new Error(errF?.message)

        for (const ej of fase.ejercicios) {
          let id_biblioteca: string | null = ej.id_biblioteca_ejercicio ?? null

          const posesLimpias = ej.secuencia_poses.map(({ tmpId, ...rest }) => rest)

          if (ej.guardar_en_biblioteca && !id_biblioteca) {
            const { data: bibData } = await supabase
              .from('biblioteca_ejercicio')
              .insert({
                nombre_ejercicio: ej.nombre_ejercicio || 'Ejercicio',
                descripcion: ej.descripcion || null,
                video_muestra: ej.video_muestra || null,
                icono: ej.icono,
                id_fisioterapeuta: user.id,
                secuencia_poses: posesLimpias,
              })
              .select('id_biblioteca_ejercicio').single()
            id_biblioteca = bibData?.id_biblioteca_ejercicio ?? null
          }

          const posesPersonalizadas =
            id_biblioteca && ej.tiene_override ? posesLimpias : null

          const { error: errE } = await supabase.from('ejercicio').insert({
            nombre_ejercicio: ej.nombre_ejercicio || 'Ejercicio',
            orden: ej.orden,
            descripcion: ej.descripcion || null,
            video_muestra: ej.video_muestra || null,
            repeticiones: parseInt(ej.repeticiones) || null,
            icono: ej.icono,
            id_fase: faseData.id_fase,
            id_biblioteca_ejercicio: id_biblioteca,
            secuencia_poses_personalizada: posesPersonalizadas,
            secuencia_poses: !id_biblioteca ? posesLimpias : null,  // ✅ reutiliza
            created_by: user.id,
            updated_by: user.id,
          })
          if (errE) throw new Error(`Ejercicio "${ej.nombre_ejercicio}": ${errE.message}`)
        }
      }
      onDone()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
      <div className="dash-card">
        <div className="dash-card-title">📝 Datos generales</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginTop: '4px' }}>
          <div>
            <label style={labelStyle}>Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Rehabilitación post-operatoria" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Duración (días)</label>
            <input type="number" value={duracion} onChange={e => setDuracion(e.target.value)} placeholder="30" min={1} style={inputStyle} />
          </div>
        </div>
      </div>

      {fases.map(fase => (
        <div key={fase.tmpId} className="dash-card" style={{ borderLeft: '4px solid var(--blue)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ background: 'var(--blue)', color: '#fff', borderRadius: '8px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>Fase {fase.numero_fase}</span>
            <input value={fase.nombre_fase} onChange={e => updateFase(fase.tmpId, 'nombre_fase', e.target.value)} placeholder="Nombre de la fase" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => removeFase(fase.tmpId)} style={{ ...btnGhost, color: '#c0392b' }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Duración (días)</label>
              <input type="number" value={fase.duracion_fase} onChange={e => updateFase(fase.tmpId, 'duracion_fase', e.target.value)} placeholder="7" min={1} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Indicaciones para el paciente</label>
              <input value={fase.indicaciones_medico} onChange={e => updateFase(fase.tmpId, 'indicaciones_medico', e.target.value)} placeholder="Ej. Evitar cargar peso mayor a 5 kg" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {fase.ejercicios.map(ej => (
              <div key={ej.tmpId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '1.1rem' }}>{ej.icono ?? '🏋️'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.83rem', color: 'var(--text)' }}>{ej.nombre_ejercicio || 'Sin nombre'}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                    {ej.repeticiones && <span>{ej.repeticiones} reps</span>}
                    {ej.secuencia_poses.length > 0 && (
                      <span style={{ color: '#4a7c0f' }}>
                        🤖 {ej.secuencia_poses.length} poses · {contarArts(ej.secuencia_poses)} articulaciones
                      </span>
                    )}
                    {ej.id_biblioteca_ejercicio && <span style={{ color: 'var(--blue)' }}>📚 De biblioteca</span>}
                  </div>
                </div>
                <button onClick={() => setEditandoEj({ faseTmpId: fase.tmpId, ejTmpId: ej.tmpId })} style={{ ...btnGhost, fontSize: '0.75rem' }}>✏️</button>
                <button onClick={() => removeEjercicio(fase.tmpId, ej.tmpId)} style={{ ...btnGhost, color: '#c0392b' }}>✕</button>
              </div>
            ))}

            {editandoEj?.faseTmpId === fase.tmpId && (
              <EjercicioBuilder
                ejercicioInicial={editandoEj.ejTmpId ? fase.ejercicios.find(e => e.tmpId === editandoEj.ejTmpId) : undefined}
                mostrarOpcionBiblioteca={true}
                onConfirmar={data => confirmarEjercicio(fase.tmpId, editandoEj.ejTmpId, data)}
                onCancelar={() => setEditandoEj(null)}
              />
            )}

            {editandoEj?.faseTmpId !== fase.tmpId && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setEditandoEj({ faseTmpId: fase.tmpId, ejTmpId: null })}
                  style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--blue)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                  + Nuevo ejercicio
                </button>
                <button onClick={() => setMostrarBib(mostrarBib === fase.tmpId ? null : fase.tmpId)}
                  style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1.5px dashed var(--blue)', background: 'var(--blue-xlight)', color: 'var(--blue)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                  📚 De biblioteca
                </button>
              </div>
            )}

            {mostrarBib === fase.tmpId && (
              <div style={{ borderRadius: '10px', border: '1px solid var(--blue)', background: '#f8fcff', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--blue)', marginBottom: '4px' }}>📚 Selecciona de tu biblioteca</div>
                {biblioteca.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', opacity: 0.5, fontStyle: 'italic' }}>Biblioteca vacía</div>
                ) : biblioteca.map(b => (
                  <div key={b.id_biblioteca_ejercicio} onClick={() => agregarDeBiblioteca(fase.tmpId, b)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <span>{b.icono ?? '🏋️'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{b.nombre_ejercicio}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--blue)' }}>
                        {b.secuencia_poses?.length > 0
                          ? `🤖 ${b.secuencia_poses.length} poses · ${contarArts(b.secuencia_poses)} articulaciones`
                          : 'Sin evaluación IA'}
                      </div>
                    </div>
                    <span style={{ color: 'var(--blue)', fontSize: '0.75rem', fontWeight: 700 }}>+ Agregar</span>
                  </div>
                ))}
                <button onClick={() => setMostrarBib(null)} style={{ ...btnGhost, alignSelf: 'flex-end', fontSize: '0.75rem' }}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      ))}

      <button onClick={addFase} style={{ padding: '14px', borderRadius: '12px', border: '2px dashed var(--blue)', background: 'var(--blue-xlight)', color: 'var(--blue)', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
        + Agregar fase
      </button>

      {error && <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#fde8e8', color: '#c0392b', fontSize: '0.82rem' }}>⚠️ {error}</div>}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onCancelar} style={btnOutline}>Cancelar</button>
        <button onClick={guardar} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando...' : '💾 Guardar rutina'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB BIBLIOTECA
// ═══════════════════════════════════════════════════════════════════════════════
function TabBibliotecaEjercicios() {
  const [ejercicios, setEjercicios] = useState<BibliotecaEjercicio[]>([])
  const [loading, setLoading]       = useState(true)
  const [creando, setCreando]       = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await supabase
      .from('biblioteca_ejercicio')
      .select('id_biblioteca_ejercicio, nombre_ejercicio, descripcion, icono, secuencia_poses')
      .eq('id_fisioterapeuta', user.id).is('deleted_at', null).order('nombre_ejercicio')
    setEjercicios(data ?? [])
    setLoading(false)
  }

  const guardarNuevo = async (data: EjercicioFormData) => {
    if (!userId) return
    const posesLimpias = data.secuencia_poses.map(({ tmpId, ...rest }) => rest)
    await supabase.from('biblioteca_ejercicio').insert({
      nombre_ejercicio: data.nombre_ejercicio,
      descripcion: data.descripcion || null,
      video_muestra: data.video_muestra || null,
      icono: data.icono,
      id_fisioterapeuta: userId,
      secuencia_poses: posesLimpias,
    })
    setCreando(false)
    cargar()
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este ejercicio de la biblioteca?')) return
    await supabase.from('biblioteca_ejercicio').update({ deleted_at: new Date().toISOString() }).eq('id_biblioteca_ejercicio', id)
    setEjercicios(prev => prev.filter(e => e.id_biblioteca_ejercicio !== id))
  }

  // Total de articulaciones en todas las poses
  const contarArts = (poses: Pose[]) =>
    poses.reduce((acc, p) => acc + p.articulaciones.length, 0)

  if (loading) return <LoadingState />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setCreando(!creando)} style={btnPrimary}>
          {creando ? 'Cancelar' : '+ Nuevo ejercicio en biblioteca'}
        </button>
      </div>

      {creando && (
        <EjercicioBuilder
          mostrarOpcionBiblioteca={false}
          onConfirmar={guardarNuevo}
          onCancelar={() => setCreando(false)}
        />
      )}

      {ejercicios.length === 0 && !creando ? (
        <EmptyState icon="📚" title="Biblioteca vacía" desc="Crea ejercicios reutilizables con poses IA" />
      ) : ejercicios.map(ej => (
        <div key={ej.id_biblioteca_ejercicio} className="dash-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--blue-xlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
              {ej.icono ?? '🏋️'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text)' }}>{ej.nombre_ejercicio}</div>
              {ej.descripcion && <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '2px' }}>{ej.descripcion}</div>}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                {(ej.secuencia_poses?.length ?? 0) > 0
                  ? <Chip label={`🤖 ${ej.secuencia_poses.length} poses · ${contarArts(ej.secuencia_poses)} articulaciones`} color="green" />
                  : <Chip label="Sin evaluación IA" color="gray" />
                }
              </div>

              {/* Preview de poses como timeline */}
              {(ej.secuencia_poses?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {ej.secuencia_poses.map((pose, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ background: 'var(--blue-xlight)', border: '1px solid var(--blue)', borderRadius: '8px', padding: '3px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                        {pose.nombre}
                        {pose.articulaciones.length > 0 && (
                          <span style={{ opacity: 0.7, fontWeight: 500 }}> · {pose.articulaciones.length} art.</span>
                        )}
                      </div>
                      {i < ej.secuencia_poses.length - 1 && <span style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>→</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => eliminar(ej.id_biblioteca_ejercicio)} style={{ ...btnGhost, color: '#c0392b' }}>🗑</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB ASIGNACIONES (sin cambios)
// ═══════════════════════════════════════════════════════════════════════════════
function TabAsignaciones() {
  const [rutinas, setRutinas]           = useState<{ id_rutina: string; nombre_rutina: string }[]>([])
  const [pacientes, setPacientes]       = useState<PacienteOpt[]>([])
  const [asignaciones, setAsignaciones] = useState<RutinaPaciente[]>([])
  const [loading, setLoading]           = useState(true)
  const [selRutina, setSelRutina]       = useState('')
  const [selPac, setSelPac]             = useState('')
  const [fechaIni, setFechaIni]         = useState('')
  const [fechaFin, setFechaFin]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: ruts }, { data: relPacs }] = await Promise.all([
        supabase.from('rutina').select('id_rutina, nombre_rutina').eq('id_fisioterapeuta', user.id).is('deleted_at', null),
        supabase.from('paciente_fisioterapeuta').select('id_paciente').eq('id_fisioterapeuta', user.id).is('deleted_at', null),
      ])
      const pacIds = (relPacs ?? []).map(r => r.id_paciente)
      let pacs: PacienteOpt[] = []
      if (pacIds.length) {
        const { data: perfiles } = await supabase.from('perfil').select('id_perfil, nombre, primer_apellido').in('id_perfil', pacIds)
        pacs = (perfiles ?? []).map(p => ({ id_paciente: p.id_perfil, nombre: `${p.nombre} ${p.primer_apellido}` }))
      }
      const rutIds = (ruts ?? []).map(r => r.id_rutina)
      let asigs: RutinaPaciente[] = []
      if (rutIds.length) {
        const { data: asigRaw } = await supabase.from('rutina_paciente')
          .select('id_rutina_paciente, id_rutina, id_paciente, fecha_inicio, fecha_fin, activa')
          .in('id_rutina', rutIds).is('deleted_at', null).order('activa', { ascending: false })
        const mapaR = Object.fromEntries((ruts ?? []).map(r => [r.id_rutina, r.nombre_rutina]))
        const mapaP = Object.fromEntries(pacs.map(p => [p.id_paciente, p.nombre]))
        asigs = (asigRaw ?? []).map(a => ({ ...a, nombre_rutina: mapaR[a.id_rutina], nombre_paciente: mapaP[a.id_paciente] }))
      }
      setRutinas(ruts ?? []); setPacientes(pacs); setAsignaciones(asigs); setLoading(false)
    }
    load()
  }, [])

  const asignar = async () => {
    if (!selRutina || !selPac) { setError('Selecciona rutina y paciente'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('rutina_paciente').insert({
      id_rutina: selRutina, id_paciente: selPac,
      fecha_inicio: fechaIni || null, fecha_fin: fechaFin || null, activa: true,
    })
    if (err) { setError(err.message); setSaving(false); return }
    const rutNombre = rutinas.find(r => r.id_rutina === selRutina)?.nombre_rutina ?? '—'
    const pacNombre = pacientes.find(p => p.id_paciente === selPac)?.nombre ?? 'Paciente'
    setAsignaciones(prev => [{
      id_rutina_paciente: crypto.randomUUID(), id_rutina: selRutina, id_paciente: selPac,
      fecha_inicio: fechaIni || null, fecha_fin: fechaFin || null, activa: true,
      nombre_rutina: rutNombre, nombre_paciente: pacNombre,
    }, ...prev])
    setSelRutina(''); setSelPac(''); setFechaIni(''); setFechaFin(''); setSaving(false)
  }

  const desactivar = async (id: string) => {
    await supabase.from('rutina_paciente').update({ activa: false }).eq('id_rutina_paciente', id)
    setAsignaciones(prev => prev.map(a => a.id_rutina_paciente === id ? { ...a, activa: false } : a))
  }

  if (loading) return <LoadingState />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="dash-card">
        <div className="dash-card-title">➕ Nueva asignación</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
          <div><label style={labelStyle}>Rutina</label>
            <select value={selRutina} onChange={e => setSelRutina(e.target.value)} style={selectStyle}>
              <option value="">— Selecciona —</option>
              {rutinas.map(r => <option key={r.id_rutina} value={r.id_rutina}>{r.nombre_rutina}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Paciente</label>
            <select value={selPac} onChange={e => setSelPac(e.target.value)} style={selectStyle}>
              <option value="">— Selecciona —</option>
              {pacientes.map(p => <option key={p.id_paciente} value={p.id_paciente}>{p.nombre}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Fecha inicio</label><input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Fecha fin (opcional)</label><input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={inputStyle} /></div>
        </div>
        {error && <div style={{ marginTop: '8px', color: '#c0392b', fontSize: '0.8rem' }}>⚠️ {error}</div>}
        <button onClick={asignar} disabled={saving} style={{ ...btnPrimary, marginTop: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Asignando...' : '✅ Asignar rutina'}
        </button>
      </div>

      <div className="dash-card">
        <div className="dash-card-title">📋 Asignaciones</div>
        {asignaciones.length === 0
          ? <div style={{ padding: '20px 0', textAlign: 'center', opacity: 0.4, fontSize: '0.85rem', fontStyle: 'italic' }}>Sin asignaciones todavía</div>
          : asignaciones.map(a => (
            <div key={a.id_rutina_paciente} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px', borderRadius: '10px', marginBottom: '8px', background: a.activa ? 'var(--bg)' : '#f8f8f8', border: `1px solid ${a.activa ? 'var(--border)' : '#e0e0e0'}`, opacity: a.activa ? 1 : 0.6 }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: a.activa ? 'var(--blue-xlight)' : '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: a.activa ? 'var(--blue)' : '#999', flexShrink: 0 }}>
                {a.nombre_paciente?.charAt(0) ?? '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{a.nombre_paciente}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px' }}>
                  🏋️ {a.nombre_rutina}{a.fecha_inicio && ` · Inicio: ${a.fecha_inicio}`}{a.fecha_fin && ` · Fin: ${a.fecha_fin}`}
                </div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, background: a.activa ? '#eef8d6' : '#f0f0f0', color: a.activa ? '#76a82e' : '#999' }}>
                {a.activa ? 'Activa' : 'Finalizada'}
              </span>
              {a.activa && <button onClick={() => desactivar(a.id_rutina_paciente)} style={{ ...btnGhost, color: '#c0392b', fontSize: '0.75rem' }}>Finalizar</button>}
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Chip({ label, color = 'blue' }: { label: string; color?: 'blue' | 'green' | 'yellow' | 'gray' }) {
  const colors = { blue: { bg: 'var(--blue-xlight)', color: 'var(--blue)' }, green: { bg: '#eef8d6', color: '#4a7c0f' }, yellow: { bg: '#fff3cd', color: '#856404' }, gray: { bg: '#f0f0f0', color: '#999' } }
  const c = colors[color]
  return <span style={{ background: c.bg, color: c.color, borderRadius: '8px', padding: '3px 9px', fontSize: '0.72rem', fontWeight: 700 }}>{label}</span>
}

function LoadingState() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', opacity: 0.4 }}>Cargando...</div>
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '10px', opacity: 0.5 }}>
      <span style={{ fontSize: '2.5rem' }}>{icon}</span>
      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{title}</div>
      <div style={{ fontSize: '0.82rem', textAlign: 'center', maxWidth: '300px' }}>{desc}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: '0.85rem', color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '5px' }
const btnPrimary: React.CSSProperties = { background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '9px', padding: '9px 16px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }
const btnOutline: React.CSSProperties = { background: 'transparent', border: '1.5px solid var(--border)', color: 'var(--text-mid)', borderRadius: '9px', padding: '9px 16px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: React.CSSProperties = { background: 'transparent', border: 'none', color: 'var(--text-light)', borderRadius: '9px', padding: '6px 10px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }
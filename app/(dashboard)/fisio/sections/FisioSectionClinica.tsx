'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos alineados a la DB ──────────────────────────────────────────────────
interface Direccion {
  id_direccion: string
  pais: string
  codigo_postal: string
  estado: string
  municipio: string
  colonia: string
  calle: string
  numero_exterior: string
  numero_interior: string
  indicaciones_extra: string
}

interface Clinica {
  id_clinica: string
  nombre_clinica: string
  telefono_contacto: string
  correo_electronico: string | null
  sitio_web: string | null
  instagram: string | null
  facebook: string | null
  registro_sanitario: string | null
  fecha_apertura: string | null
  id_direccion: string | null
  direccion?: Direccion | null
}

interface HorarioAtencion {
  id_horario_atencion: string
  dia_semana: number
  hora_inicio: string
  hora_cierre: string
  id_clinica: string
  id_fisioterapeuta: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const DIAS_COMPLETO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// ─── Componente principal ─────────────────────────────────────────────────────
export function FisioSectionClinica() {
  const [clinicas, setClinicas]     = useState<Clinica[]>([])
  const [selClinica, setSelClinica] = useState<Clinica | null>(null)
  const [loading, setLoading]       = useState(true)
  const [userId, setUserId]         = useState<string | null>(null)
  const [vista, setVista]           = useState<'lista' | 'detalle' | 'nueva'>('lista')

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: rels } = await supabase
      .from('clinica_fisioterapeuta')
      .select('id_clinica')
      .eq('id_fisioterapeuta', user.id)

    const clinicaIds = (rels ?? []).map(r => r.id_clinica)

    if (clinicaIds.length) {
      const { data: clins } = await supabase
        .from('clinica')
        .select(`
          id_clinica, nombre_clinica, telefono_contacto,
          correo_electronico, sitio_web, instagram, facebook,
          registro_sanitario, fecha_apertura, id_direccion,
          direccion (
            id_direccion, pais, codigo_postal, estado, municipio,
            colonia, calle, numero_exterior, numero_interior, indicaciones_extra
          )
        `)
        .in('id_clinica', clinicaIds)
        .is('deleted_at', null)

      setClinicas((clins as unknown as Clinica[]) ?? [])
    }

    setLoading(false)
  }

  if (loading) return <LoadingState />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            🏥 Mi clínica
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: '5px 0 0' }}>
            Gestiona tus clínicas, direcciones y horarios de atención
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {(vista === 'detalle' || vista === 'nueva') && (
            <button
              onClick={() => { setVista('lista'); setSelClinica(null) }}
              style={btn('outline')}
            >
              ← Volver
            </button>
          )}
          {vista === 'lista' && (
            <button onClick={() => setVista('nueva')} style={btn('primary')}>
              + Nueva clínica
            </button>
          )}
        </div>
      </div>

      {/* ── Stats rápidas (solo en lista) ── */}
      {vista === 'lista' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <StatCard icon="🏥" label="Clínicas" value={clinicas.length} />
          <StatCard icon="📋" label="Registro sanitario" value={clinicas.filter(c => c.registro_sanitario).length} hint="con registro" />
        </div>
      )}

      {/* ── Contenido ── */}
      {vista === 'lista' && (
        <VistaLista
          clinicas={clinicas}
          userId={userId!}
          onVerDetalle={(c) => { setSelClinica(c); setVista('detalle') }}
        />
      )}

      {vista === 'detalle' && selClinica && (
        <VistaDetalle
          clinica={selClinica}
          userId={userId!}
          onGuardado={(updated) => {
            setClinicas(prev => prev.map(c => c.id_clinica === updated.id_clinica ? updated : c))
            setSelClinica(updated)
          }}
        />
      )}

      {vista === 'nueva' && (
        <FormNuevaClinica
          userId={userId!}
          onCreada={(c) => {
            setClinicas(prev => [...prev, c])
            setVista('lista')
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════════════════════
function StatCard({ icon, label, value, hint }: { icon: string; label: string; value: string | number; hint?: string }) {
  return (
    <div className="dash-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div style={{
        width: '42px', height: '42px', borderRadius: '12px',
        background: 'var(--blue-xlight)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '3px' }}>
          {label}{hint ? ` · ${hint}` : ''}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISTA LISTA
// ═══════════════════════════════════════════════════════════════════════════════
function VistaLista({ clinicas, onVerDetalle }: {
  clinicas: Clinica[]
  onVerDetalle: (c: Clinica) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {clinicas.length === 0 ? (
        <EmptyState
          icon="🏥"
          title="Sin clínicas registradas"
          desc="Agrega tu primera clínica usando el botón de arriba"
        />
      ) : clinicas.map(c => (
        <ClinicaCard key={c.id_clinica} clinica={c} onEditar={() => onVerDetalle(c)} />
      ))}
    </div>
  )
}

// ─── Tarjeta de clínica ────────────────────────────────────────────────────────
function ClinicaCard({ clinica: c, onEditar }: { clinica: Clinica; onEditar: () => void }) {
  return (
    <div
      className="dash-card"
      onClick={onEditar}
      style={{ cursor: 'pointer', transition: 'box-shadow .15s', padding: '18px 20px' }}
    >
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Icono */}
        <div style={{
          width: '50px', height: '50px', borderRadius: '14px',
          background: 'var(--blue-xlight)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0,
        }}>🏥</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)', marginBottom: '6px' }}>
            {c.nombre_clinica}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.78rem', color: 'var(--text-light)' }}>
            <span>📞 {c.telefono_contacto}</span>
            {c.correo_electronico && <span>✉️ {c.correo_electronico}</span>}
            {c.sitio_web && <span>🌐 {c.sitio_web}</span>}
            {c.direccion && (
              <span>
                📍 {[c.direccion.calle, c.direccion.numero_exterior].filter(Boolean).join(' ')},
                {' '}{[c.direccion.colonia, c.direccion.municipio, c.direccion.estado].filter(Boolean).join(', ')}
              </span>
            )}
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
            {c.registro_sanitario && <Chip label="🏛 Registro sanitario" color="blue" />}
            {c.instagram          && <Chip label="📸 Instagram"          color="pink" />}
            {c.facebook           && <Chip label="👥 Facebook"           color="blue" />}
            {c.sitio_web          && <Chip label="🌐 Sitio web"          color="teal" />}
            {c.fecha_apertura     && (
              <Chip
                label={`📅 Desde ${new Date(c.fecha_apertura).getFullYear()}`}
                color="gray"
              />
            )}
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onEditar() }}
          style={btn('outline')}
        >
          Editar →
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISTA DETALLE — editar clínica
// ═══════════════════════════════════════════════════════════════════════════════
function VistaDetalle({ clinica, userId, onGuardado }: {
  clinica: Clinica
  userId: string
  onGuardado: (c: Clinica) => void
}) {
  const [tab, setTab] = useState<'general' | 'direccion' | 'horarios'>('general')

  const [form, setForm] = useState({
    nombre_clinica:     clinica.nombre_clinica     ?? '',
    telefono_contacto:  clinica.telefono_contacto  ?? '',
    correo_electronico: clinica.correo_electronico ?? '',
    sitio_web:          clinica.sitio_web          ?? '',
    instagram:          clinica.instagram          ?? '',
    facebook:           clinica.facebook           ?? '',
    registro_sanitario: clinica.registro_sanitario ?? '',
    fecha_apertura:     clinica.fecha_apertura     ?? '',
  })

  const dir = clinica.direccion
  const [dirForm, setDirForm] = useState({
    pais:               dir?.pais               ?? 'México',
    codigo_postal:      dir?.codigo_postal      ?? '',
    estado:             dir?.estado             ?? '',
    municipio:          dir?.municipio          ?? '',
    colonia:            dir?.colonia            ?? '',
    calle:              dir?.calle              ?? '',
    numero_exterior:    dir?.numero_exterior    ?? '',
    numero_interior:    dir?.numero_interior    ?? '',
    indicaciones_extra: dir?.indicaciones_extra ?? '',
  })

  const [horarios, setHorarios] = useState<HorarioAtencion[]>([])
  const [loadingH, setLoadingH] = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('horario_atencion')
      .select('id_horario_atencion, dia_semana, hora_inicio, hora_cierre, id_clinica, id_fisioterapeuta')
      .eq('id_clinica', clinica.id_clinica)
      .eq('id_fisioterapeuta', userId)
      .is('deleted_at', null)
      .order('dia_semana')
      .then(({ data }) => { setHorarios(data ?? []); setLoadingH(false) })
  }, [clinica.id_clinica, userId])

  const guardar = async () => {
    setSaving(true); setError(null)
    try {
      let id_direccion = clinica.id_direccion
      if (id_direccion) {
        await supabase.from('direccion').update({ ...dirForm, updated_at: new Date().toISOString() }).eq('id_direccion', id_direccion)
      } else {
        const { data: newDir } = await supabase.from('direccion').insert(dirForm).select('id_direccion').single()
        id_direccion = newDir?.id_direccion ?? null
      }

      const { data: updated, error: errC } = await supabase
        .from('clinica')
        .update({ ...form, id_direccion, updated_at: new Date().toISOString() })
        .eq('id_clinica', clinica.id_clinica)
        .select(`
          id_clinica, nombre_clinica, telefono_contacto,
          correo_electronico, sitio_web, instagram, facebook,
          registro_sanitario, fecha_apertura, id_direccion,
          direccion (
            id_direccion, pais, codigo_postal, estado, municipio,
            colonia, calle, numero_exterior, numero_interior, indicaciones_extra
          )
        `)
        .single()

      if (errC) throw new Error(errC.message)
      onGuardado(updated as unknown as Clinica)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const TABS = [
    { key: 'general',   label: '🏥 General'   },
    { key: 'direccion', label: '📍 Dirección'  },
    { key: 'horarios',  label: '🕐 Horarios'   },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Cabecera de clínica */}
      <div className="dash-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: 'var(--blue-xlight)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0,
        }}>🏥</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)' }}>
            {clinica.nombre_clinica}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '3px' }}>
            {clinica.telefono_contacto}
            {clinica.direccion?.municipio ? ` · ${clinica.direccion.municipio}, ${clinica.direccion.estado}` : ''}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', fontWeight: tab === t.key ? 700 : 500,
              fontSize: '0.85rem', fontFamily: 'inherit',
              color: tab === t.key ? 'var(--blue)' : 'var(--text-light)',
              borderBottom: tab === t.key ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: '-2px', transition: 'all .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel general */}
      {tab === 'general' && (
        <div className="dash-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Nombre de la clínica *" value={form.nombre_clinica}
              onChange={v => setForm(p => ({ ...p, nombre_clinica: v }))} placeholder="Ej. Clínica Kairós" span2 />
            <Field label="Teléfono de contacto *" value={form.telefono_contacto}
              onChange={v => setForm(p => ({ ...p, telefono_contacto: v }))} placeholder="55 1234 5678" />
            <Field label="Correo electrónico" value={form.correo_electronico}
              onChange={v => setForm(p => ({ ...p, correo_electronico: v }))} placeholder="contacto@clinica.mx" />
            <Field label="Sitio web" value={form.sitio_web}
              onChange={v => setForm(p => ({ ...p, sitio_web: v }))} placeholder="https://..." />
            <Field label="Instagram" value={form.instagram}
              onChange={v => setForm(p => ({ ...p, instagram: v }))} placeholder="@clinica" />
            <Field label="Facebook" value={form.facebook}
              onChange={v => setForm(p => ({ ...p, facebook: v }))} placeholder="facebook.com/clinica" />
            <Field label="Registro sanitario (COFEPRIS)" value={form.registro_sanitario}
              onChange={v => setForm(p => ({ ...p, registro_sanitario: v }))} placeholder="COFEPRIS-XXX" />
            <Field label="Fecha de apertura" value={form.fecha_apertura}
              onChange={v => setForm(p => ({ ...p, fecha_apertura: v }))} type="date" />
          </div>
        </div>
      )}

      {/* Panel dirección */}
      {tab === 'direccion' && (
        <div className="dash-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="País" value={dirForm.pais}
              onChange={v => setDirForm(p => ({ ...p, pais: v }))} placeholder="México" />
            <Field label="Código postal" value={dirForm.codigo_postal}
              onChange={v => setDirForm(p => ({ ...p, codigo_postal: v }))} placeholder="06600" />
            <Field label="Estado" value={dirForm.estado}
              onChange={v => setDirForm(p => ({ ...p, estado: v }))} placeholder="Ciudad de México" />
            <Field label="Municipio / Alcaldía" value={dirForm.municipio}
              onChange={v => setDirForm(p => ({ ...p, municipio: v }))} placeholder="Cuauhtémoc" />
            <Field label="Colonia" value={dirForm.colonia}
              onChange={v => setDirForm(p => ({ ...p, colonia: v }))} placeholder="Juárez" />
            <Field label="Calle" value={dirForm.calle}
              onChange={v => setDirForm(p => ({ ...p, calle: v }))} placeholder="Av. Insurgentes" />
            <Field label="Número exterior" value={dirForm.numero_exterior}
              onChange={v => setDirForm(p => ({ ...p, numero_exterior: v }))} placeholder="123" />
            <Field label="Número interior" value={dirForm.numero_interior}
              onChange={v => setDirForm(p => ({ ...p, numero_interior: v }))} placeholder="Piso 2, Of. 5" />
            <Field label="Indicaciones extra" value={dirForm.indicaciones_extra}
              onChange={v => setDirForm(p => ({ ...p, indicaciones_extra: v }))}
              placeholder="Ej. Frente al metro, edificio azul" span2 />
          </div>
        </div>
      )}

      {/* Panel horarios */}
      {tab === 'horarios' && (
        <div className="dash-card">
          <div className="dash-card-title" style={{ marginBottom: '4px' }}>Horarios de atención</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', margin: '0 0 16px' }}>
            Activa los días disponibles y ajusta los horarios de apertura y cierre
          </p>
          {loadingH ? (
            <div style={{ opacity: 0.4, padding: '12px 0', fontSize: '0.82rem' }}>Cargando horarios...</div>
          ) : (
            <PanelHorarios
              horarios={horarios}
              clinicaId={clinica.id_clinica}
              userId={userId}
              onChange={setHorarios}
            />
          )}
        </div>
      )}

      {/* Feedback */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#fde8e8', color: '#c0392b', fontSize: '0.82rem' }}>
          ⚠️ {error}
        </div>
      )}
      {saved && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#eef8d6', color: '#4a7c0f', fontSize: '0.82rem' }}>
          ✅ Cambios guardados correctamente
        </div>
      )}

      {/* Botón guardar (solo en general y dirección) */}
      {tab !== 'horarios' && (
        <div>
          <button onClick={guardar} disabled={saving} style={{ ...btn('primary'), opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando...' : '💾 Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Panel horarios ───────────────────────────────────────────────────────────
function PanelHorarios({ horarios, clinicaId, userId, onChange }: {
  horarios: HorarioAtencion[]
  clinicaId: string
  userId: string
  onChange: (h: HorarioAtencion[]) => void
}) {
  const [saving, setSaving] = useState<number | null>(null)
  const mapaHorario = Object.fromEntries(horarios.map(h => [h.dia_semana, h]))

  const toggleDia = async (dia: number) => {
    const existing = mapaHorario[dia]
    if (existing) {
      await supabase
        .from('horario_atencion')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id_horario_atencion', existing.id_horario_atencion)
      onChange(horarios.filter(h => h.dia_semana !== dia))
    } else {
      setSaving(dia)
      const { data, error } = await supabase
        .from('horario_atencion')
        .insert({ dia_semana: dia, hora_inicio: '08:00', hora_cierre: '18:00', id_clinica: clinicaId, id_fisioterapeuta: userId })
        .select('id_horario_atencion, dia_semana, hora_inicio, hora_cierre, id_clinica, id_fisioterapeuta')
        .single()
      if (!error && data) onChange([...horarios, data].sort((a, b) => a.dia_semana - b.dia_semana))
      setSaving(null)
    }
  }

  const updateHora = async (id: string, field: 'hora_inicio' | 'hora_cierre', value: string) => {
    await supabase.from('horario_atencion').update({ [field]: value }).eq('id_horario_atencion', id)
    onChange(horarios.map(h => h.id_horario_atencion === id ? { ...h, [field]: value } : h))
  }

  // Calcular horas totales activas
  const totalHoras = horarios.reduce((acc, h) => {
    const [h1, m1] = h.hora_inicio.split(':').map(Number)
    const [h2, m2] = h.hora_cierre.split(':').map(Number)
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
    return acc + Math.max(0, diff / 60)
  }, 0)

  return (
    <div>
      {/* Resumen */}
      {horarios.length > 0 && (
        <div style={{
          display: 'flex', gap: '16px', marginBottom: '16px',
          padding: '10px 14px', borderRadius: '10px',
          background: 'var(--blue-xlight)', fontSize: '0.8rem', color: 'var(--blue)',
        }}>
          <span>📅 <strong>{horarios.length}</strong> {horarios.length === 1 ? 'día activo' : 'días activos'}</span>
          <span>⏱ <strong>{totalHoras.toFixed(1)}</strong> horas/semana</span>
          <span>📊 {DIAS.filter((_, i) => mapaHorario[i]).join(', ')}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {DIAS_COMPLETO.map((dia, idx) => {
          const horario  = mapaHorario[idx]
          const activo   = !!horario
          const cargando = saving === idx

          return (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '10px 14px', borderRadius: '10px',
              background: activo ? 'var(--bg)' : '#fafafa',
              border: `1.5px solid ${activo ? 'var(--blue)' : 'var(--border)'}`,
              opacity: cargando ? 0.5 : 1,
              transition: '.2s',
            }}>
              {/* Toggle */}
              <button
                onClick={() => toggleDia(idx)}
                disabled={cargando}
                style={{
                  width: '40px', height: '22px', borderRadius: '11px',
                  background: activo ? 'var(--blue)' : '#ddd',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: '.2s', flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: '3px',
                  left: activo ? '20px' : '3px',
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: '#fff', transition: '.2s',
                }} />
              </button>

              <div style={{
                width: '80px', fontWeight: activo ? 700 : 500,
                fontSize: '0.85rem',
                color: activo ? 'var(--text)' : 'var(--text-light)',
              }}>
                {dia}
              </div>

              {activo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                  <input
                    type="time"
                    value={horario.hora_inicio}
                    onChange={e => updateHora(horario.id_horario_atencion, 'hora_inicio', e.target.value)}
                    style={{ ...inputSt, width: '130px' }}
                  />
                  <span style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>a</span>
                  <input
                    type="time"
                    value={horario.hora_cierre}
                    onChange={e => updateHora(horario.id_horario_atencion, 'hora_cierre', e.target.value)}
                    style={{ ...inputSt, width: '130px' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginLeft: '4px' }}>
                    {calcHoras(horario.hora_inicio, horario.hora_cierre)} hrs
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                  No disponible
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM NUEVA CLÍNICA
// ═══════════════════════════════════════════════════════════════════════════════
function FormNuevaClinica({ userId, onCreada }: { userId: string; onCreada: (c: Clinica) => void }) {
  const [step, setStep]       = useState<1 | 2>(1)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [form, setForm] = useState({
    nombre_clinica: '', telefono_contacto: '',
    correo_electronico: '', sitio_web: '',
    instagram: '', facebook: '',
    registro_sanitario: '', fecha_apertura: '',
  })
  const [dirForm, setDirForm] = useState({
    pais: 'México', codigo_postal: '', estado: '',
    municipio: '', colonia: '', calle: '',
    numero_exterior: '', numero_interior: '', indicaciones_extra: '',
  })

  const guardar = async () => {
    if (!form.nombre_clinica.trim() || !form.telefono_contacto.trim()) {
      setError('Nombre y teléfono son obligatorios'); return
    }
    setSaving(true); setError(null)
    try {
      const { data: dirData } = await supabase
        .from('direccion').insert(dirForm).select('id_direccion').single()

      const { data: clinicaData, error: errC } = await supabase
        .from('clinica')
        .insert({ ...form, id_direccion: dirData?.id_direccion ?? null })
        .select('id_clinica').single()

      if (errC || !clinicaData) throw new Error(errC?.message ?? 'Error al crear clínica')

      await supabase.from('clinica_fisioterapeuta')
        .insert({ id_clinica: clinicaData.id_clinica, id_fisioterapeuta: userId })

      onCreada({
        ...form,
        id_clinica: clinicaData.id_clinica,
        id_direccion: dirData?.id_direccion ?? null,
        direccion: dirData ? { id_direccion: dirData.id_direccion, ...dirForm } as Direccion : null,
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
        {[
          { n: 1, label: 'Datos generales' },
          { n: 2, label: 'Dirección'       },
        ].map(({ n, label }, i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 1 ? 'none' : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: n < step ? 'pointer' : 'default' }}
              onClick={() => n < step && setStep(n as 1 | 2)}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: step >= n ? 'var(--blue)' : 'var(--border)',
                color: step >= n ? '#fff' : 'var(--text-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.8rem', flexShrink: 0, transition: '.2s',
              }}>
                {n}
              </div>
              <span style={{
                fontSize: '0.82rem', fontWeight: step === n ? 700 : 500,
                color: step === n ? 'var(--text)' : 'var(--text-light)',
              }}>
                {label}
              </span>
            </div>
            {i < 1 && (
              <div style={{
                flex: 1, height: '2px', margin: '0 12px',
                background: step > n ? 'var(--blue)' : 'var(--border)',
                transition: '.3s',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Paso 1 */}
      {step === 1 && (
        <div className="dash-card">
          <div className="dash-card-title">🏥 Datos generales</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '8px' }}>
            <Field label="Nombre *" value={form.nombre_clinica}
              onChange={v => setForm(p => ({ ...p, nombre_clinica: v }))} placeholder="Clínica Kairós" span2 />
            <Field label="Teléfono *" value={form.telefono_contacto}
              onChange={v => setForm(p => ({ ...p, telefono_contacto: v }))} placeholder="55 1234 5678" />
            <Field label="Correo" value={form.correo_electronico}
              onChange={v => setForm(p => ({ ...p, correo_electronico: v }))} placeholder="contacto@clinica.mx" />
            <Field label="Sitio web" value={form.sitio_web}
              onChange={v => setForm(p => ({ ...p, sitio_web: v }))} placeholder="https://..." />
            <Field label="Instagram" value={form.instagram}
              onChange={v => setForm(p => ({ ...p, instagram: v }))} placeholder="@clinica" />
            <Field label="Facebook" value={form.facebook}
              onChange={v => setForm(p => ({ ...p, facebook: v }))} placeholder="facebook.com/clinica" />
            <Field label="Registro sanitario" value={form.registro_sanitario}
              onChange={v => setForm(p => ({ ...p, registro_sanitario: v }))} placeholder="COFEPRIS-XXX" />
            <Field label="Fecha de apertura" value={form.fecha_apertura}
              onChange={v => setForm(p => ({ ...p, fecha_apertura: v }))} type="date" />
          </div>
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => {
                if (!form.nombre_clinica.trim() || !form.telefono_contacto.trim()) {
                  setError('Nombre y teléfono son obligatorios'); return
                }
                setError(null); setStep(2)
              }}
              style={btn('primary')}
            >
              Siguiente → Dirección
            </button>
          </div>
        </div>
      )}

      {/* Paso 2 */}
      {step === 2 && (
        <div className="dash-card">
          <div className="dash-card-title">📍 Dirección</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '8px' }}>
            <Field label="País" value={dirForm.pais}
              onChange={v => setDirForm(p => ({ ...p, pais: v }))} placeholder="México" />
            <Field label="Código postal" value={dirForm.codigo_postal}
              onChange={v => setDirForm(p => ({ ...p, codigo_postal: v }))} placeholder="06600" />
            <Field label="Estado" value={dirForm.estado}
              onChange={v => setDirForm(p => ({ ...p, estado: v }))} placeholder="CDMX" />
            <Field label="Municipio / Alcaldía" value={dirForm.municipio}
              onChange={v => setDirForm(p => ({ ...p, municipio: v }))} placeholder="Cuauhtémoc" />
            <Field label="Colonia" value={dirForm.colonia}
              onChange={v => setDirForm(p => ({ ...p, colonia: v }))} placeholder="Juárez" />
            <Field label="Calle" value={dirForm.calle}
              onChange={v => setDirForm(p => ({ ...p, calle: v }))} placeholder="Av. Insurgentes" />
            <Field label="Núm. exterior" value={dirForm.numero_exterior}
              onChange={v => setDirForm(p => ({ ...p, numero_exterior: v }))} placeholder="123" />
            <Field label="Núm. interior" value={dirForm.numero_interior}
              onChange={v => setDirForm(p => ({ ...p, numero_interior: v }))} placeholder="Piso 2" />
            <Field label="Indicaciones extra" value={dirForm.indicaciones_extra}
              onChange={v => setDirForm(p => ({ ...p, indicaciones_extra: v }))}
              placeholder="Frente al metro, edificio azul" span2 />
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(1)} style={btn('outline')}>← Atrás</button>
            <button onClick={guardar} disabled={saving} style={{ ...btn('primary'), opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creando...' : '✅ Crear clínica'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#fde8e8', color: '#c0392b', fontSize: '0.82rem' }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', span2 }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; span2?: boolean
}) {
  return (
    <div style={{ gridColumn: span2 ? 'span 2' : undefined }}>
      <label style={labelSt}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputSt}
      />
    </div>
  )
}

function Chip({ label, color }: { label: string; color: 'blue' | 'teal' | 'pink' | 'gray' }) {
  const colors = {
    blue: { bg: 'var(--blue-xlight)', text: 'var(--blue)' },
    teal: { bg: '#e1f5ee', text: '#0f6e56' },
    pink: { bg: '#fbeaf0', text: '#993556' },
    gray: { bg: '#f1efe8', text: '#5f5e5a' },
  }
  const { bg, text } = colors[color]
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600, background: bg, color: text,
      padding: '3px 9px', borderRadius: '20px',
    }}>
      {label}
    </span>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', opacity: 0.4, gap: '10px' }}>
      <span>⏳</span> Cargando clínica...
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', gap: '10px',
      opacity: 0.5, textAlign: 'center',
    }}>
      <span style={{ fontSize: '2.5rem' }}>{icon}</span>
      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{title}</div>
      <div style={{ fontSize: '0.82rem', maxWidth: '300px' }}>{desc}</div>
    </div>
  )
}

function calcHoras(inicio: string, cierre: string): string {
  try {
    const [h1, m1] = inicio.split(':').map(Number)
    const [h2, m2] = cierre.split(':').map(Number)
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
    if (diff <= 0) return '0'
    return (diff / 60).toFixed(1).replace('.0', '')
  } catch { return '?' }
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '9px',
  border: '1.5px solid var(--border)', background: 'var(--bg)',
  fontSize: '0.85rem', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}


const labelSt: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600,
  color: 'var(--text-light)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em',
}

function btn(variant: 'primary' | 'outline' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: '9px', padding: '9px 18px', fontSize: '0.82rem',
    fontWeight: 700, cursor: 'pointer', border: 'none',
    fontFamily: 'inherit', transition: 'opacity .15s',
  }
  if (variant === 'primary') return { ...base, background: 'var(--blue)', color: '#fff' }
  if (variant === 'outline') return { ...base, background: 'transparent', border: '1.5px solid var(--border)', color: 'var(--text-mid)' }
  return { ...base, background: 'transparent', color: 'var(--text-light)', padding: '6px 10px' }
}
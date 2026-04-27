'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import Link from 'next/link'
import { DireccionBlock } from '@/app/components/Direccionblock'

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface DireccionForm {
  id_direccion?: string
  pais: string; estado: string; municipio: string; colonia: string
  calle: string; numero_exterior: string; numero_interior: string; codigo_postal: string
}

interface IdiomaForm {
  id_idioma?: string
  idioma: string
  nivel: string
}

interface HorarioForm {
  id_horario_atencion?: string
  dia_semana: number
  hora_inicio: string
  hora_cierre: string
}

interface PerfilFisioForm {
  nombre_completo: string
  numero_telefono: string
  sexo: string
  fecha_nacimiento: string
  // Datos profesionales
  cedula_profesional: string
  universidad_egreso: string
  especialidad: string
  perfil_profesional: string
  anios_experiencia: number | ''
  // Idiomas y horarios
  idiomas: IdiomaForm[]
  horarios: HorarioForm[]
  // Dirección
  direccion: DireccionForm
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const emptyDir = (): DireccionForm => ({
  pais: '', estado: '', municipio: '', colonia: '',
  calle: '', numero_exterior: '', numero_interior: '', codigo_postal: ''
})

const emptyIdioma = (): IdiomaForm => ({ idioma: '', nivel: 'Básico' })

const emptyHorario = (): HorarioForm => ({ dia_semana: 1, hora_inicio: '09:00', hora_cierre: '18:00' })

const emptyForm = (): PerfilFisioForm => ({
  nombre_completo: '',
  numero_telefono: '',
  sexo: 'Otro',
  fecha_nacimiento: '',
  cedula_profesional: '',
  universidad_egreso: '',
  especialidad: '',
  perfil_profesional: '',
  anios_experiencia: '',
  idiomas: [],
  horarios: [],
  direccion: emptyDir()
})

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const NIVELES_IDIOMA = ['Básico', 'Intermedio', 'Avanzado', 'Nativo']

const ESPECIALIDADES = [
  'Fisioterapia Deportiva',
  'Fisioterapia Neurológica',
  'Fisioterapia Pediátrica',
  'Fisioterapia Geriátrica',
  'Fisioterapia Ortopédica',
  'Fisioterapia Respiratoria',
  'Fisioterapia Cardiovascular',
  'Rehabilitación Postoperatoria',
  'Otra',
]

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PerfilFisioPage() {
  const [authUser, setAuthUser]     = useState<any>(null)
  const [form, setForm]             = useState<PerfilFisioForm>(emptyForm())
  const [isComplete, setIsComplete] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [mensaje, setMensaje]   = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [pacientesCount, setPacientesCount] = useState(0)
  const router = useRouter()

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/')
  }, [router])

  // ── Helpers de form ────────────────────────────────────────────────────────
  const setDir = (field: keyof DireccionForm, val: string) =>
    setForm(f => ({ ...f, direccion: { ...f.direccion, [field]: val } }))

  const updateIdioma = (idx: number, field: keyof IdiomaForm, val: string) =>
    setForm(f => {
      const next = [...f.idiomas]
      next[idx] = { ...next[idx], [field]: val }
      return { ...f, idiomas: next }
    })

  const addIdioma = () =>
    setForm(f => ({ ...f, idiomas: [...f.idiomas, emptyIdioma()] }))

  const removeIdioma = (idx: number) =>
    setForm(f => ({ ...f, idiomas: f.idiomas.filter((_, i) => i !== idx) }))

  const updateHorario = (idx: number, field: keyof HorarioForm, val: string | number) =>
    setForm(f => {
      const next = [...f.horarios]
      next[idx] = { ...next[idx], [field]: val }
      return { ...f, horarios: next }
    })

  const addHorario = () =>
    setForm(f => ({ ...f, horarios: [...f.horarios, emptyHorario()] }))

  const removeHorario = (idx: number) =>
    setForm(f => ({ ...f, horarios: f.horarios.filter((_, i) => i !== idx) }))

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setAuthUser(user)

        const { data: perfil, error: ePerfil } = await supabase
          .from('perfil').select('*, direccion(*)')
          .eq('id_perfil', user.id).maybeSingle()
        if (ePerfil) throw ePerfil

        const { data: fisio, error: eFisio } = await supabase
          .from('fisioterapeuta')
          .select('*')
          .eq('id_fisioterapeuta', user.id).maybeSingle()
        if (eFisio) throw eFisio

        const { data: idiomas } = await supabase
          .from('idioma')
          .select('*')
          .eq('id_fisioterapeuta', user.id)
          .is('deleted_at', null)

        const { data: horarios } = await supabase
          .from('horario_atencion')
          .select('*')
          .eq('id_fisioterapeuta', user.id)
          .is('deleted_at', null)

        const { count } = await supabase
          .from('paciente_fisioterapeuta')
          .select('id_paciente', { count: 'exact', head: true })
          .eq('id_fisioterapeuta', user.id)
          .is('deleted_at', null)

        setPacientesCount(count ?? 0)

        if (perfil) {
          setForm({
            nombre_completo: [perfil.nombre, perfil.primer_apellido, perfil.segundo_apellido].filter(Boolean).join(' '),
            numero_telefono: perfil.numero_telefono || '',
            sexo:            perfil.sexo            || 'Otro',
            fecha_nacimiento: perfil.fecha_nacimiento || '',
            cedula_profesional:  fisio?.cedula_profesional  || '',
            universidad_egreso:  fisio?.universidad_egreso  || '',
            especialidad:        fisio?.especialidad        || '',
            perfil_profesional:  fisio?.perfil_profesional  || '',
            anios_experiencia:   fisio?.anios_experiencia   ?? '',
            idiomas: (idiomas ?? []).map(i => ({
              id_idioma: i.id_idioma,
              idioma:    i.idioma || '',
              nivel:     i.nivel  || 'Básico',
            })),
            horarios: (horarios ?? []).map(h => ({
              id_horario_atencion: h.id_horario_atencion,
              dia_semana:  h.dia_semana,
              hora_inicio: h.hora_inicio?.slice(0, 5) || '09:00',
              hora_cierre: h.hora_cierre?.slice(0, 5) || '18:00',
            })),
            direccion: {
              id_direccion:    perfil.direccion?.id_direccion,
              pais:            perfil.direccion?.pais            || '',
              estado:          perfil.direccion?.estado          || '',
              municipio:       perfil.direccion?.municipio       || '',
              colonia:         perfil.direccion?.colonia         || '',
              calle:           perfil.direccion?.calle           || '',
              numero_exterior: perfil.direccion?.numero_exterior || '',
              numero_interior: perfil.direccion?.numero_interior || '',
              codigo_postal:   perfil.direccion?.codigo_postal   || '',
            },
          })
          setIsComplete(
            !!perfil.numero_telefono && !!perfil.sexo &&
            !!perfil.fecha_nacimiento && !!perfil.id_direccion &&
            !!fisio?.cedula_profesional && !!fisio?.universidad_egreso
          )
        } else {
          setIsComplete(false)
        }
      } catch (err: any) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setMensaje(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesión activa.')

      // 1. Dirección del fisio
      const { data: dirU, error: eDirU } = await supabase
        .from('direccion').upsert({ ...form.direccion })
        .select('id_direccion').single()
      if (eDirU) throw eDirU

      // 2. Perfil base
      const partes    = form.nombre_completo.trim().split(/\s+/)
      const nombre    = partes[0]                || 'Fisioterapeuta'
      const primerAp  = partes[1]                || 'Sin Apellido'
      const segundoAp = partes.slice(2).join(' ') || ''

      const { error: ePerfil } = await supabase.from('perfil').upsert({
        id_perfil:          user.id,
        nombre, primer_apellido: primerAp, segundo_apellido: segundoAp,
        correo_electronico: user.email,
        numero_telefono:    form.numero_telefono,
        sexo:               form.sexo,
        fecha_nacimiento:   form.fecha_nacimiento || null,
        id_direccion:       dirU.id_direccion,
      })
      if (ePerfil) throw ePerfil

      // 3. Datos de fisioterapeuta
      const { error: eFisio } = await supabase.from('fisioterapeuta').upsert({
        id_fisioterapeuta:  user.id,
        cedula_profesional: form.cedula_profesional,
        universidad_egreso: form.universidad_egreso,
        especialidad:       form.especialidad || null,
        perfil_profesional: form.perfil_profesional || null,
        anios_experiencia:  form.anios_experiencia !== '' ? Number(form.anios_experiencia) : null,
      })
      if (eFisio) throw eFisio

      // 4. Idiomas: soft-delete los viejos y re-insertar
      await supabase.from('idioma')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id_fisioterapeuta', user.id)

      if (form.idiomas.length > 0) {
        const { error: eIdiomas } = await supabase.from('idioma').insert(
          form.idiomas.map(i => ({
            idioma:           i.idioma,
            nivel:            i.nivel,
            id_fisioterapeuta: user.id,
          }))
        )
        if (eIdiomas) throw eIdiomas
      }

      // 5. Horarios: soft-delete los viejos y re-insertar
      await supabase.from('horario_atencion')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id_fisioterapeuta', user.id)

      if (form.horarios.length > 0) {
        const { error: eHorarios } = await supabase.from('horario_atencion').insert(
          form.horarios.map(h => ({
            dia_semana:        h.dia_semana,
            hora_inicio:       h.hora_inicio,
            hora_cierre:       h.hora_cierre,
            id_fisioterapeuta: user.id,
          }))
        )
        if (eHorarios) throw eHorarios
      }

      // 6. Contraseña opcional
      if (showPassword && newPassword.length >= 8) {
        const { error: ePass } = await supabase.auth.updateUser({ password: newPassword })
        if (ePass) throw ePass
      }

      setMensaje({ tipo: 'exito', texto: '¡Perfil actualizado correctamente!' })
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      console.error(err)
      setMensaje({ tipo: 'error', texto: err?.message || 'Error al guardar. Revisa los campos.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div className="p-10">Cargando...</div>

  const fullName = form.nombre_completo || authUser?.user_metadata?.full_name || 'Fisioterapeuta'
  const email    = authUser?.email
  const initial  = fullName.charAt(0).toUpperCase()

  return (
    <div className="profile-page-wrapper">
      <div className="p-wrap">

        {/* ── LADO IZQUIERDO ── */}
        <div className="p-left">
          <div className="brand">
            <Link href="/dashboard">
              <button className='btn-regresar'>← Regresar al inicio</button>
            </Link>
          </div>
          <div className="p-avatar">{initial}</div>
          <div className="user-name" style={{ color: '#fff', fontWeight: 900 }}>{fullName}</div>
          <div className="user-email" style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '20px' }}>{email}</div>

          {/* Tarjeta de estadísticas del fisio */}
          <div className="physio-info-card" style={{
            background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '12px',
            width: '100%', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px'
          }}>
            <div style={{ color: '#fff', opacity: 0.6, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
              Mi actividad
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                <span>👥</span>
                <span><strong>{pacientesCount}</strong> pacientes activos</span>
              </div>

              {form.especialidad && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.9 }}>
                  <span>🎓</span><span>{form.especialidad}</span>
                </div>
              )}

              {form.anios_experiencia !== '' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.9 }}>
                  <span>📅</span><span>{form.anios_experiencia} años de experiencia</span>
                </div>
              )}

              {form.cedula_profesional && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.8 }}>
                  <span>📋</span>
                  <span style={{ fontSize: '0.75rem' }}>Cédula: {form.cedula_profesional}</span>
                </div>
              )}

              {form.idiomas.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#fff', opacity: 0.8 }}>
                  <span>🌐</span>
                  <span style={{ fontSize: '0.75rem' }}>
                    {form.idiomas.map(i => `${i.idioma} (${i.nivel})`).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="p-divider" style={{ margin: '20px 0' }} />
        </div>

        {/* ── LADO DERECHO ── */}
        <div className="p-right">

          {!isComplete && (
            <div className="warning-banner" style={{
              background: '#FFF4E5', borderLeft: '4px solid #FFA117', padding: '16px',
              borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px'
            }}>
              <span>⚠️</span>
              <div>
                <strong style={{ display: 'block', color: '#663C00', marginBottom: '4px' }}>Información pendiente</strong>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#663C00' }}>
                  Tu perfil no está completo. Llena todos los campos para aparecer como terapeuta disponible.
                </p>
              </div>
            </div>
          )}

          <div className="page-header">
            <div className="page-badge"><div className="bdot" />Mi Perfil</div>
            <h1 className="page-title">Perfil Profesional</h1>
            <p className="page-sub">Actualiza tus datos personales y profesionales</p>
          </div>

          {/* ── Datos personales ── */}
          <div className="section-title" style={{ marginTop: '20px' }}>Datos personales</div>
          <div className="p-fields-grid">

            <div className="p-full">
              <div className="fl">Nombre Completo</div>
              <div className="p-fw">
                <span className="p-fi">👤</span>
                <input className="p-input" type="text" value={form.nombre_completo}
                  onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))} />
              </div>
            </div>

            <div className="p-full">
              <div className="fl">Correo electrónico</div>
              <div className="p-fw">
                <span className="p-fi">✉️</span>
                <input className="p-input" type="email" value={email} disabled />
              </div>
            </div>

            <div>
              <div className="fl">Teléfono</div>
              <div className="p-fw">
                <span className="p-fi">📞</span>
                <input className="p-input" type="text" placeholder="55..."
                  value={form.numero_telefono}
                  onChange={e => setForm(f => ({ ...f, numero_telefono: e.target.value }))} />
              </div>
            </div>

            <div>
              <div className="fl">Sexo</div>
              <div className="p-fw">
                <span className="p-fi">🚻</span>
                <select className="p-input" style={{ appearance: 'none' }}
                  value={form.sexo} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
                  <option value="Femenino">Femenino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="p-full">
              <div className="fl">Fecha de nacimiento</div>
              <div className="p-fw">
                <span className="p-fi">🗓️</span>
                <input className="p-input" type="date" value={form.fecha_nacimiento}
                  onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} />
              </div>
            </div>

            {/* Dirección */}
            <div className="p-full">
              <div className="fl">Dirección</div>
              <DireccionBlock prefix="fisio" value={form.direccion} onChange={setDir} />
            </div>
          </div>

          {/* ── Datos profesionales ── */}
          <div className="section-title">Datos profesionales</div>
          <div className="p-fields-grid">

            <div>
              <div className="fl">Cédula Profesional</div>
              <div className="p-fw">
                <span className="p-fi">📋</span>
                <input className="p-input" type="text" placeholder="Ej. 12345678"
                  value={form.cedula_profesional}
                  onChange={e => setForm(f => ({ ...f, cedula_profesional: e.target.value }))} />
              </div>
            </div>

            <div>
              <div className="fl">Años de Experiencia</div>
              <div className="p-fw">
                <span className="p-fi">📅</span>
                <input className="p-input" type="number" min={0} max={60} placeholder="Ej. 5"
                  value={form.anios_experiencia}
                  onChange={e => setForm(f => ({ ...f, anios_experiencia: e.target.value === '' ? '' : Number(e.target.value) }))} />
              </div>
            </div>

            <div className="p-full">
              <div className="fl">Universidad de Egreso</div>
              <div className="p-fw">
                <span className="p-fi">🏫</span>
                <input className="p-input" type="text" placeholder="Ej. UNAM, IPN..."
                  value={form.universidad_egreso}
                  onChange={e => setForm(f => ({ ...f, universidad_egreso: e.target.value }))} />
              </div>
            </div>

            <div className="p-full">
              <div className="fl">Especialidad</div>
              <div className="p-fw">
                <span className="p-fi">🎓</span>
                <select className="p-input" style={{ appearance: 'none' }}
                  value={ESPECIALIDADES.includes(form.especialidad) ? form.especialidad : 'Otra'}
                  onChange={e => setForm(f => ({ ...f, especialidad: e.target.value !== 'Otra' ? e.target.value : ' ' }))}>
                  <option value="">Seleccionar...</option>
                  {ESPECIALIDADES.map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
              {!ESPECIALIDADES.slice(0, -1).includes(form.especialidad) && form.especialidad.trim() !== '' && (
                <div className="p-fw" style={{ marginTop: '8px' }}>
                  <span className="p-fi">✏️</span>
                  <input className="p-input" type="text" placeholder="Describe tu especialidad..."
                    value={form.especialidad.trim()}
                    onChange={e => setForm(f => ({ ...f, especialidad: e.target.value }))} autoFocus />
                </div>
              )}
            </div>

            <div className="p-full">
              <div className="fl">Perfil Profesional</div>
              <div className="p-fw" style={{ alignItems: 'flex-start' }}>
                <span className="p-fi" style={{ marginTop: '10px' }}>📝</span>
                <textarea
                  className="p-input"
                  rows={4}
                  placeholder="Cuéntale a tus pacientes sobre ti, tu enfoque terapéutico y metodología..."
                  value={form.perfil_profesional}
                  onChange={e => setForm(f => ({ ...f, perfil_profesional: e.target.value }))}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </div>

          {/* ── Idiomas ── */}
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Idiomas
            <button onClick={addIdioma} style={{
              color: '#2874A6', cursor: 'pointer', background: 'none', border: 'none',
              fontSize: '0.8rem', fontWeight: 600
            }}>
              + Agregar idioma
            </button>
          </div>

          {form.idiomas.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>
              No has agregado idiomas. Agregar idiomas puede ayudarte a atender más pacientes.
            </div>
          ) : (
            <div className="p-fields-grid">
              {form.idiomas.map((idioma, idx) => (
                <div key={idx} className="p-full">
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 2 }}>
                      {idx === 0 && <div className="fl">Idioma</div>}
                      <div className="p-fw">
                        <span className="p-fi">🌐</span>
                        <input className="p-input" type="text" placeholder="Ej. Inglés, Francés..."
                          value={idioma.idioma}
                          onChange={e => updateIdioma(idx, 'idioma', e.target.value)} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      {idx === 0 && <div className="fl">Nivel</div>}
                      <div className="p-fw">
                        <span className="p-fi">📊</span>
                        <select className="p-input" style={{ appearance: 'none' }}
                          value={idioma.nivel}
                          onChange={e => updateIdioma(idx, 'nivel', e.target.value)}>
                          {NIVELES_IDIOMA.map(n => <option key={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                    <button onClick={() => removeIdioma(idx)} style={{
                      background: 'none', border: '1px solid #FC8181', color: '#E53E3E',
                      borderRadius: '6px', padding: '8px 10px', cursor: 'pointer',
                      fontSize: '0.75rem', marginBottom: '2px', whiteSpace: 'nowrap'
                    }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Horarios de atención ── */}
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px' }}>
            Horarios de Atención
            <button onClick={addHorario} style={{
              color: '#2874A6', cursor: 'pointer', background: 'none', border: 'none',
              fontSize: '0.8rem', fontWeight: 600
            }}>
              + Agregar horario
            </button>
          </div>

          {form.horarios.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>
              No has configurado horarios. Los pacientes los verán al agendar citas.
            </div>
          ) : (
            <div className="p-fields-grid">
              {form.horarios.map((horario, idx) => (
                <div key={idx} className="p-full">
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: '140px' }}>
                      {idx === 0 && <div className="fl">Día</div>}
                      <div className="p-fw">
                        <span className="p-fi">📅</span>
                        <select className="p-input" style={{ appearance: 'none' }}
                          value={horario.dia_semana}
                          onChange={e => updateHorario(idx, 'dia_semana', Number(e.target.value))}>
                          {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: '100px' }}>
                      {idx === 0 && <div className="fl">Inicio</div>}
                      <div className="p-fw">
                        <span className="p-fi">🕐</span>
                        <input className="p-input" type="time"
                          value={horario.hora_inicio}
                          onChange={e => updateHorario(idx, 'hora_inicio', e.target.value)} />
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: '100px' }}>
                      {idx === 0 && <div className="fl">Cierre</div>}
                      <div className="p-fw">
                        <span className="p-fi">🕕</span>
                        <input className="p-input" type="time"
                          value={horario.hora_cierre}
                          onChange={e => updateHorario(idx, 'hora_cierre', e.target.value)} />
                      </div>
                    </div>
                    <button onClick={() => removeHorario(idx)} style={{
                      background: 'none', border: '1px solid #FC8181', color: '#E53E3E',
                      borderRadius: '6px', padding: '8px 10px', cursor: 'pointer',
                      fontSize: '0.75rem', marginBottom: '2px', whiteSpace: 'nowrap'
                    }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Seguridad ── */}
          <div className="section-title" style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
            Seguridad
            {!showPassword && (
              <button onClick={() => setShowPassword(true)}
                style={{ color: '#2874A6', cursor: 'pointer', background: 'none', border: 'none', fontSize: '0.8rem' }}>
                Cambiar contraseña
              </button>
            )}
          </div>

          {showPassword ? (
            <div className="p-fields-grid" style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
              <div className="p-full">
                <div className="fl">Nueva contraseña</div>
                <div className="p-fw">
                  <span className="p-fi">🔒</span>
                  <input className="p-input" type="password" placeholder="Mínimo 8 caracteres"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus />
                </div>
              </div>
              <button onClick={() => { setShowPassword(false); setNewPassword('') }}
                style={{ color: '#888', background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          ) : (
            <div style={{ padding: '10px', fontSize: '0.8rem', color: '#999' }}>Tu contraseña está encriptada.</div>
          )}

          {mensaje && (
            <div style={{
              marginTop: '16px', padding: '12px 16px', borderRadius: '8px',
              background: mensaje.tipo === 'exito' ? '#F0FFF4' : '#FFF5F5',
              border: `1px solid ${mensaje.tipo === 'exito' ? '#68D391' : '#FC8181'}`,
              color: mensaje.tipo === 'exito' ? '#276749' : '#9B2C2C',
              fontSize: '0.85rem'
            }}>
              {mensaje.tipo === 'exito' ? '✅ ' : '❌ '}{mensaje.texto}
            </div>
          )}

          <div className="actions" style={{ marginTop: '30px' }}>
            <button onClick={handleSave} className="btn-save" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios →'}
            </button>
            <button onClick={handleSignOut} className="btn-out">Cerrar sesión</button>
          </div>
        </div>
      </div>
    </div>
  )
}
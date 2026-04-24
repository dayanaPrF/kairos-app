'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import Link from 'next/link'
import { DireccionBlock } from '@/app/components/Direccionblock'

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface DireccionForm {
  id_direccion?: string
  pais: string; estado: string; municipio: string; colonia: string
  calle: string; numero_exterior: string; numero_interior: string; codigo_postal: string
}

interface ContactoForm {
  id_contacto_emergencia?: string
  nombre: string; primer_apellido: string; segundo_apellido: string
  parentesco: string; sexo: string
  correo_electronico: string
  numero_telefono: string; segundo_telefono: string
  tipo_contacto_pref: string; disponibilidad_horaria: string
  direccion: DireccionForm
}

interface PerfilForm {
  nombre_completo: string
  numero_telefono: string
  sexo: string
  fecha_nacimiento: string
  tipo_sangre: string
  nss: string
  direccion: DireccionForm
  contacto: ContactoForm
}


// ─── Helpers ──────────────────────────────────────────────────────────────────
const emptyDir = (): DireccionForm => ({
  pais: '', estado: '', municipio: '', colonia: '',
  calle: '', numero_exterior: '', numero_interior: '', codigo_postal: ''
})

const emptyContacto = (): ContactoForm => ({
  nombre: '', primer_apellido: '', segundo_apellido: '',
  parentesco: '', sexo: 'Otro',
  correo_electronico: '',
  numero_telefono: '', segundo_telefono: '',
  tipo_contacto_pref: 'Llamada', disponibilidad_horaria: '',
  direccion: emptyDir()
})

const emptyForm = (): PerfilForm => ({
  nombre_completo: '',
  numero_telefono: '',
  sexo: 'Otro',
  fecha_nacimiento: '',
  tipo_sangre: 'O+',
  nss: '',
  direccion: emptyDir(),
  contacto: emptyContacto()
})

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PerfilPage() {
  const [authUser, setAuthUser]     = useState<any>(null)
  const [dbData, setDbData]         = useState<any>(null)
  const [form, setForm]             = useState<PerfilForm>(emptyForm())
  const [isComplete, setIsComplete] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [mensaje, setMensaje]   = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setDir = (field: keyof DireccionForm, val: string) =>
    setForm(f => ({ ...f, direccion: { ...f.direccion, [field]: val } }))

  const setCDir = (field: keyof DireccionForm, val: string) =>
    setForm(f => ({ ...f, contacto: { ...f.contacto, direccion: { ...f.contacto.direccion, [field]: val } } }))

  const setCont = (field: keyof Omit<ContactoForm, 'direccion'>, val: string) =>
    setForm(f => ({ ...f, contacto: { ...f.contacto, [field]: val } }))

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

        const { data: pac, error: ePac } = await supabase
          .from('paciente')
          .select('*, contacto_emergencia(*, direccion(*))')
          .eq('id_paciente', user.id).maybeSingle()
        if (ePac) throw ePac

        const db = perfil ? { ...perfil, paciente: pac } : null
        setDbData(db)

        if (perfil) {
          const ce = pac?.contacto_emergencia
          setForm({
            nombre_completo: [perfil.nombre, perfil.primer_apellido, perfil.segundo_apellido].filter(Boolean).join(' '),
            numero_telefono:  perfil.numero_telefono  || '',
            sexo:             perfil.sexo             || 'Otro',
            fecha_nacimiento: perfil.fecha_nacimiento || '',
            tipo_sangre: pac?.tipo_sangre || 'O+',
            nss:         pac?.nss         || '',
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
            contacto: {
              id_contacto_emergencia: ce?.id_contacto_emergencia,
              nombre:                 ce?.nombre               || '',
              primer_apellido:        ce?.primer_apellido      || '',
              segundo_apellido:       ce?.segundo_apellido     || '',
              parentesco:             ce?.parentesco           || '',
              sexo:                   ce?.sexo                 || 'Otro',
              correo_electronico:     ce?.correo_electronico   || '',
              numero_telefono:        ce?.numero_telefono      || '',
              segundo_telefono:       ce?.segundo_telefono     || '',
              tipo_contacto_pref:     ce?.tipo_contacto_pref   || 'Llamada',
              disponibilidad_horaria: ce?.disponibilidad_horaria || '',
              direccion: {
                id_direccion:    ce?.direccion?.id_direccion,
                pais:            ce?.direccion?.pais            || '',
                estado:          ce?.direccion?.estado          || '',
                municipio:       ce?.direccion?.municipio       || '',
                colonia:         ce?.direccion?.colonia         || '',
                calle:           ce?.direccion?.calle           || '',
                numero_exterior: ce?.direccion?.numero_exterior || '',
                numero_interior: ce?.direccion?.numero_interior || '',
                codigo_postal:   ce?.direccion?.codigo_postal   || '',
              }
            }
          })
          setIsComplete(
            !!perfil.numero_telefono && !!perfil.sexo &&
            !!perfil.fecha_nacimiento && !!perfil.id_direccion &&
            !!ce?.id_contacto_emergencia
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

      const { data: dirC, error: eDirC } = await supabase
        .from('direccion').upsert({ ...form.contacto.direccion })
        .select('id_direccion').single()
      if (eDirC) throw eDirC

      const { data: cont, error: eCont } = await supabase
        .from('contacto_emergencia').upsert({
          id_contacto_emergencia: form.contacto.id_contacto_emergencia,
          nombre:                 form.contacto.nombre,
          primer_apellido:        form.contacto.primer_apellido,
          segundo_apellido:       form.contacto.segundo_apellido,
          parentesco:             form.contacto.parentesco.trim(),
          sexo:                   form.contacto.sexo,
          correo_electronico:     form.contacto.correo_electronico,
          numero_telefono:        form.contacto.numero_telefono,
          segundo_telefono:       form.contacto.segundo_telefono,
          tipo_contacto_pref:     form.contacto.tipo_contacto_pref,
          disponibilidad_horaria: form.contacto.disponibilidad_horaria.trim(),
          id_direccion:           dirC.id_direccion,
        }).select('id_contacto_emergencia').single()
      if (eCont) throw eCont

      const { data: dirU, error: eDirU } = await supabase
        .from('direccion').upsert({ ...form.direccion })
        .select('id_direccion').single()
      if (eDirU) throw eDirU

      const partes    = form.nombre_completo.trim().split(/\s+/)
      const nombre    = partes[0]                || 'Paciente'
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

      const { error: ePac } = await supabase.from('paciente').upsert({
        id_paciente:            user.id,
        tipo_sangre:            form.tipo_sangre,
        nss:                    form.nss,
        id_contacto_emergencia: cont.id_contacto_emergencia,
      })
      if (ePac) throw ePac

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

  const fullName = form.nombre_completo || authUser?.user_metadata?.full_name || 'Paciente'
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
          <div className="physio-info-card" style={{
            background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '12px',
            width: '100%', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px'
          }}>
            <div style={{ color: '#fff', opacity: 0.6, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Tu Fisioterapeuta</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '6px' }}>
              <span>👨‍⚕️</span><span style={{ fontWeight: 600 }}>Dr. Alejandro García</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.9, marginBottom: '6px' }}>
              <span>🎓</span><span>Rehabilitación Deportiva</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.9 }}>
              <span>🏫</span><span>UNAM</span>
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
                  Tu perfil no está completo. Debes llenar todos los campos para poder <strong>agendar citas</strong>.
                </p>
              </div>
            </div>
          )}

          <div className="page-header">
            <div className="page-badge"><div className="bdot" />Mi Perfil</div>
            <h1 className="page-title">Información Personal</h1>
            <p className="page-sub">Actualiza tus datos de contacto y acceso</p>
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

            {/* Información médica */}
            <div className="p-full">
              <div className="fl">Información médica</div>
              <div className="p-grid-inner" style={{ marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl-dir">TIPO DE SANGRE</div>
                  <div className="p-fw">
                    <span className="p-fi">🩸</span>
                    <select className="p-input" style={{ appearance: 'none' }}
                      value={form.tipo_sangre}
                      onChange={e => setForm(f => ({ ...f, tipo_sangre: e.target.value }))}>
                      {['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl-dir">NSS</div>
                  <div className="p-fw">
                    <span className="p-fi">📄</span>
                    <input className="p-input" type="text" placeholder="Número de NSS"
                      value={form.nss} onChange={e => setForm(f => ({ ...f, nss: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Dirección del paciente */}
            <div className="p-full">
              <div className="fl">Dirección</div>
              <DireccionBlock prefix="pac" value={form.direccion} onChange={setDir} />
            </div>
          </div>

          {/* ── Contacto de emergencia ── */}
          <div className="section-title">Contacto de emergencia</div>
          <div className="p-fields-grid">

            <div className="p-full">
              <div className="fl">Nombre del Contacto</div>
              <div className="p-fw"><span className="p-fi">👤</span>
                <input className="p-input" type="text" placeholder="Nombre(s)"
                  value={form.contacto.nombre} onChange={e => setCont('nombre', e.target.value)} />
              </div>
            </div>

            <div className="p-full">
              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Primer Apellido</div>
                  <div className="p-fw"><span className="p-fi">👤</span>
                    <input className="p-input" type="text" placeholder="1er Apellido"
                      value={form.contacto.primer_apellido} onChange={e => setCont('primer_apellido', e.target.value)} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Segundo Apellido</div>
                  <div className="p-fw"><span className="p-fi">👤</span>
                    <input className="p-input" type="text" placeholder="2do Apellido"
                      value={form.contacto.segundo_apellido} onChange={e => setCont('segundo_apellido', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Parentesco</div>
                  <div className="p-fw"><span className="p-fi">🤝</span>
                    <select className="p-input" style={{ appearance: 'none' }}
                      value={
                        ['Padre','Madre','Hermano/a','Cónyuge','Hijo/a','Abuelo/a','Tío/a','Amigo/a',''].includes(form.contacto.parentesco)
                          ? form.contacto.parentesco : 'Otro'
                      }
                      onChange={e => setCont('parentesco', e.target.value !== 'Otro' ? e.target.value : ' ')}>
                      <option value="">Seleccionar...</option>
                      <option>Padre</option><option>Madre</option><option>Hermano/a</option>
                      <option>Cónyuge</option><option>Hijo/a</option><option>Abuelo/a</option>
                      <option>Tío/a</option><option>Amigo/a</option><option>Otro</option>
                    </select>
                  </div>
                  {!['Padre','Madre','Hermano/a','Cónyuge','Hijo/a','Abuelo/a','Tío/a','Amigo/a',''].includes(form.contacto.parentesco) && (
                    <div className="p-fw" style={{ marginTop: '8px' }}>
                      <span className="p-fi">✏️</span>
                      <input className="p-input" type="text" placeholder="Ej. Tutor, Padrino..."
                        value={form.contacto.parentesco.trim()}
                        onChange={e => setCont('parentesco', e.target.value)} autoFocus />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Sexo</div>
                  <div className="p-fw">
                    <span className="p-fi">🚻</span>
                    <select className="p-input" style={{ appearance: 'none' }}
                      value={form.contacto.sexo} onChange={e => setCont('sexo', e.target.value)}>
                      <option>Femenino</option><option>Masculino</option><option>Otro</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-full" style={{ marginTop: '12px' }}>
              <div className="fl">Correo electrónico</div>
              <div className="p-fw"><span className="p-fi">✉️</span>
                <input className="p-input" type="email" placeholder="correo@ejemplo.com"
                  value={form.contacto.correo_electronico} onChange={e => setCont('correo_electronico', e.target.value)} />
              </div>
            </div>

            <div className="p-full">
              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Teléfono Principal</div>
                  <div className="p-fw"><span className="p-fi">📞</span>
                    <input className="p-input" type="text" placeholder="55..."
                      value={form.contacto.numero_telefono} onChange={e => setCont('numero_telefono', e.target.value)} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Segundo Teléfono</div>
                  <div className="p-fw"><span className="p-fi">📱</span>
                    <input className="p-input" type="text" placeholder="Opcional"
                      value={form.contacto.segundo_telefono} onChange={e => setCont('segundo_telefono', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Contacto Preferido</div>
                  <div className="p-fw">
                    <span className="p-fi">🔔</span>
                    <select className="p-input" style={{ appearance: 'none' }}
                      value={form.contacto.tipo_contacto_pref} onChange={e => setCont('tipo_contacto_pref', e.target.value)}>
                      <option>Llamada</option><option>WhatsApp</option><option>Mensaje de texto</option>
                    </select>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Disponibilidad Horaria</div>
                  <div className="p-fw"><span className="p-fi">🕒</span>
                    <select className="p-input" style={{ appearance: 'none' }}
                      value={
                        ['Todos los días, todo el día','Horario laboral (9:00-18:00)','Solo fines de semana',
                         'Fuera de horario laboral (18:00-9:00)','Solo horario escolar (8:00-3:00, lun-virn)','']
                          .includes(form.contacto.disponibilidad_horaria)
                          ? form.contacto.disponibilidad_horaria : 'Disponibilidad personalizada'
                      }
                      onChange={e => setCont('disponibilidad_horaria', e.target.value !== 'Disponibilidad personalizada' ? e.target.value : ' ')}>
                      <option value="">Seleccionar...</option>
                      <option>Todos los días, todo el día</option>
                      <option>Horario laboral (9:00-18:00)</option>
                      <option>Solo fines de semana</option>
                      <option>Fuera de horario laboral (18:00-9:00)</option>
                      <option>Solo horario escolar (8:00-3:00, lun-virn)</option>
                      <option>Disponibilidad personalizada</option>
                    </select>
                  </div>
                  {!['Todos los días, todo el día','Horario laboral (9:00-18:00)','Solo fines de semana',
                     'Fuera de horario laboral (18:00-9:00)','Solo horario escolar (8:00-3:00, lun-virn)','']
                      .includes(form.contacto.disponibilidad_horaria) && (
                    <div className="p-fw" style={{ marginTop: '8px' }}>
                      <span className="p-fi">✏️</span>
                      <input className="p-input" type="text" placeholder="Ej. Lunes y miércoles de 10:00 a 14:00"
                        value={form.contacto.disponibilidad_horaria.trim()}
                        onChange={e => setCont('disponibilidad_horaria', e.target.value)} autoFocus />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dirección del contacto */}
            <div className="p-full" style={{ marginTop: '25px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <div className="fl" style={{ marginBottom: '8px', color: '#5499C7', fontWeight: 'bold' }}>DIRECCIÓN DEL CONTACTO</div>
              <DireccionBlock prefix="cont" value={form.contacto.direccion} onChange={setCDir} />
            </div>
          </div>

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
            <button onClick={() => supabase.auth.signOut()} className="btn-out">Cerrar sesión</button>
          </div>
        </div>
      </div>
    </div>
  )
}
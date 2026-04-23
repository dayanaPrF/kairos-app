'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import Link from 'next/link'

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

// ─── Componente ───────────────────────────────────────────────────────────────
export default function PerfilPage() {
  const [authUser, setAuthUser]   = useState<any>(null)
  const [dbData, setDbData]       = useState<any>(null)
  const [form, setForm]           = useState<PerfilForm>(emptyForm())
  const [isComplete, setIsComplete] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword]   = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [mensaje, setMensaje]     = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // ── Helpers de actualización de estado anidado ────────────────────────────
  const setDir = (field: keyof DireccionForm, val: string) =>
    setForm(f => ({ ...f, direccion: { ...f.direccion, [field]: val } }))

  const setCDir = (field: keyof DireccionForm, val: string) =>
    setForm(f => ({ ...f, contacto: { ...f.contacto, direccion: { ...f.contacto.direccion, [field]: val } } }))

  const setCont = (field: keyof Omit<ContactoForm, 'direccion'>, val: string) =>
    setForm(f => ({ ...f, contacto: { ...f.contacto, [field]: val } }))

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        setAuthUser(user)

        // ── Consulta 1: perfil + dirección del paciente ──────────────────────
        const { data: perfil, error: ePerfil } = await supabase
          .from('perfil')
          .select('*, direccion(*)')
          .eq('id_perfil', user.id)
          .maybeSingle()

        if (ePerfil) throw ePerfil

        // ── Consulta 2: paciente + contacto_emergencia + su dirección ─────
        // La FK está en paciente.id_paciente → perfil.id_perfil,
        // así que partimos desde paciente y hacemos join hacia contacto_emergencia
        const { data: pac, error: ePac } = await supabase
          .from('paciente')
          .select(`
            *,
            contacto_emergencia (
              *,
              direccion (*)
            )
          `)
          .eq('id_paciente', user.id)
          .maybeSingle()

        if (ePac) throw ePac

        // Combinamos ambos resultados en dbData para referencia futura
        const db = perfil ? { ...perfil, paciente: pac } : null
        setDbData(db)

        if (perfil) {
          const ce = pac?.contacto_emergencia

          setForm({
            nombre_completo: [perfil.nombre, perfil.primer_apellido, perfil.segundo_apellido].filter(Boolean).join(' '),
            numero_telefono: perfil.numero_telefono || '',
            sexo:            perfil.sexo            || 'Otro',
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

          // Banner de advertencia
          const ok =
            !!perfil.numero_telefono &&
            !!perfil.sexo &&
            !!perfil.fecha_nacimiento &&
            !!perfil.id_direccion &&
            !!ce?.id_contacto_emergencia
          setIsComplete(ok)
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

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setMensaje(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesión activa.')

      // PASO 1: Dirección del contacto de emergencia
      const { data: dirC, error: eDirC } = await supabase
        .from('direccion')
        .upsert({ ...form.contacto.direccion })
        .select('id_direccion')
        .single()
      if (eDirC) throw eDirC

      // PASO 2: Contacto de emergencia
      const { data: cont, error: eCont } = await supabase
        .from('contacto_emergencia')
        .upsert({
          id_contacto_emergencia: form.contacto.id_contacto_emergencia,
          nombre:                 form.contacto.nombre,
          primer_apellido:        form.contacto.primer_apellido,
          segundo_apellido:       form.contacto.segundo_apellido,
          parentesco:             form.contacto.parentesco,
          sexo:                   form.contacto.sexo,
          correo_electronico:     form.contacto.correo_electronico,
          numero_telefono:        form.contacto.numero_telefono,
          segundo_telefono:       form.contacto.segundo_telefono,
          tipo_contacto_pref:     form.contacto.tipo_contacto_pref,
          disponibilidad_horaria: form.contacto.disponibilidad_horaria,
          id_direccion:           dirC.id_direccion,
        })
        .select('id_contacto_emergencia')
        .single()
      if (eCont) throw eCont

      // PASO 3: Dirección del paciente
      const { data: dirU, error: eDirU } = await supabase
        .from('direccion')
        .upsert({ ...form.direccion })
        .select('id_direccion')
        .single()
      if (eDirU) throw eDirU

      // PASO 4: Perfil
      const partes = form.nombre_completo.trim().split(/\s+/)
      const nombre      = partes[0]              || 'Paciente'
      const primerAp    = partes[1]              || 'Sin Apellido'
      const segundoAp   = partes.slice(2).join(' ') || ''

      const { error: ePerfil } = await supabase
        .from('perfil')
        .upsert({
          id_perfil:        user.id,
          nombre,
          primer_apellido:  primerAp,
          segundo_apellido: segundoAp,
          correo_electronico: user.email,
          numero_telefono:  form.numero_telefono,
          sexo:             form.sexo,
          fecha_nacimiento: form.fecha_nacimiento || null,
          id_direccion:     dirU.id_direccion,
        })
      if (ePerfil) throw ePerfil

      // PASO 5: Paciente
      const { error: ePac } = await supabase
        .from('paciente')
        .upsert({
          id_paciente:            user.id,
          tipo_sangre:            form.tipo_sangre,
          nss:                    form.nss,
          id_contacto_emergencia: cont.id_contacto_emergencia,
        })
      if (ePac) throw ePac

      // Cambiar contraseña (opcional)
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

  // ── Render ────────────────────────────────────────────────────────────────
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
              <span>👨‍⚕️</span> <span style={{ fontWeight: 600 }}>Dr. Alejandro García</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.9, marginBottom: '6px' }}>
              <span>🎓</span> <span>Rehabilitación Deportiva</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.9 }}>
              <span>🏫</span> <span>UNAM</span>
            </div>
          </div>

          <div className="p-divider" style={{ margin: '20px 0' }} />
        </div>

        {/* ── LADO DERECHO ── */}
        <div className="p-right">

          {/* Banner */}
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
                <input className="p-input" type="text"
                  value={form.nombre_completo}
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
                  value={form.sexo}
                  onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
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
                <input className="p-input" type="date"
                  value={form.fecha_nacimiento}
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
                      value={form.nss}
                      onChange={e => setForm(f => ({ ...f, nss: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Dirección del paciente */}
            <div className="p-full">
              <div className="fl">Dirección</div>
              <div className="p-grid-inner" style={{ marginTop: '12px' }}>
                <div>
                  <div className="fl-dir">País</div>
                  <div className="p-fw"><span className="p-fi">📍</span>
                    <input className="p-input" type="text" placeholder="Ej. México"
                      value={form.direccion.pais} onChange={e => setDir('pais', e.target.value)} /></div>
                </div>
                <div>
                  <div className="fl-dir">Estado</div>
                  <div className="p-fw"><span className="p-fi">📍</span>
                    <input className="p-input" type="text" placeholder="Ej. Puebla"
                      value={form.direccion.estado} onChange={e => setDir('estado', e.target.value)} /></div>
                </div>
              </div>
              <div className="fl-dir">Municipio</div>
              <div className="p-fw"><span className="p-fi">📍</span>
                <input className="p-input" type="text" placeholder="Municipio"
                  value={form.direccion.municipio} onChange={e => setDir('municipio', e.target.value)} /></div>
              <div className="fl-dir">Colonia</div>
              <div className="p-fw"><span className="p-fi">📍</span>
                <input className="p-input" type="text" placeholder="Colonia"
                  value={form.direccion.colonia} onChange={e => setDir('colonia', e.target.value)} /></div>
              <div className="fl-dir">Calle</div>
              <div className="p-fw"><span className="p-fi">🏠</span>
                <input className="p-input" type="text" placeholder="Av. Siempre Viva 123"
                  value={form.direccion.calle} onChange={e => setDir('calle', e.target.value)} /></div>
              <div className="p-grid-inner" style={{ marginTop: '12px' }}>
                <div>
                  <div className="fl-dir">Número exterior</div>
                  <div className="p-fw"><span className="p-fi">#️⃣</span>
                    <input className="p-input" type="text" placeholder="No. Ext"
                      value={form.direccion.numero_exterior} onChange={e => setDir('numero_exterior', e.target.value)} /></div>
                </div>
                <div>
                  <div className="fl-dir">Número interior</div>
                  <div className="p-fw"><span className="p-fi">#️⃣</span>
                    <input className="p-input" type="text" placeholder="No. Int"
                      value={form.direccion.numero_interior} onChange={e => setDir('numero_interior', e.target.value)} /></div>
                </div>
              </div>
              <div className="fl-dir">Código postal</div>
              <div className="p-fw"><span className="p-fi">📮</span>
                <input className="p-input" type="text" placeholder="72000"
                  value={form.direccion.codigo_postal} onChange={e => setDir('codigo_postal', e.target.value)} /></div>
            </div>
          </div>

          {/* ── Contacto de emergencia ── */}
          <div className="section-title">Contacto de emergencia</div>
          <div className="p-fields-grid">

            <div className="p-full">
              <div className="fl">Nombre del Contacto</div>
              <div className="p-fw"><span className="p-fi">👤</span>
                <input className="p-input" type="text" placeholder="Nombre(s)"
                  value={form.contacto.nombre} onChange={e => setCont('nombre', e.target.value)} /></div>
            </div>

            <div className="p-full">
              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Primer Apellido</div>
                  <div className="p-fw"><span className="p-fi">👤</span>
                    <input className="p-input" type="text" placeholder="1er Apellido"
                      value={form.contacto.primer_apellido} onChange={e => setCont('primer_apellido', e.target.value)} /></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Segundo Apellido</div>
                  <div className="p-fw"><span className="p-fi">👤</span>
                    <input className="p-input" type="text" placeholder="2do Apellido"
                      value={form.contacto.segundo_apellido} onChange={e => setCont('segundo_apellido', e.target.value)} /></div>
                </div>
              </div>

              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Parentesco</div>
                  <div className="p-fw"><span className="p-fi">🤝</span>
                    <input className="p-input" type="text" placeholder="Ej. Padre, Cónyuge"
                      value={form.contacto.parentesco} onChange={e => setCont('parentesco', e.target.value)} /></div>
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
                  value={form.contacto.correo_electronico} onChange={e => setCont('correo_electronico', e.target.value)} /></div>
            </div>

            <div className="p-full">
              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Teléfono Principal</div>
                  <div className="p-fw"><span className="p-fi">📞</span>
                    <input className="p-input" type="text" placeholder="55..."
                      value={form.contacto.numero_telefono} onChange={e => setCont('numero_telefono', e.target.value)} /></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Segundo Teléfono</div>
                  <div className="p-fw"><span className="p-fi">📱</span>
                    <input className="p-input" type="text" placeholder="Opcional"
                      value={form.contacto.segundo_telefono} onChange={e => setCont('segundo_telefono', e.target.value)} /></div>
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
                    <input className="p-input" type="text" placeholder="Ej. 9:00 - 18:00"
                      value={form.contacto.disponibilidad_horaria} onChange={e => setCont('disponibilidad_horaria', e.target.value)} /></div>
                </div>
              </div>
            </div>

            {/* Dirección del contacto */}
            <div className="p-full" style={{ marginTop: '25px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <div className="fl" style={{ marginBottom: '15px', color: '#5499C7', fontWeight: 'bold' }}>DIRECCIÓN DEL CONTACTO</div>
              <div className="p-grid-inner">
                <div style={{ flex: 1 }}>
                  <div className="fl-dir">PAÍS</div>
                  <div className="p-fw"><span className="p-fi">📍</span>
                    <input className="p-input" type="text" placeholder="Ej. México"
                      value={form.contacto.direccion.pais} onChange={e => setCDir('pais', e.target.value)} /></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl-dir">ESTADO</div>
                  <div className="p-fw"><span className="p-fi">📍</span>
                    <input className="p-input" type="text" placeholder="Ej. Puebla"
                      value={form.contacto.direccion.estado} onChange={e => setCDir('estado', e.target.value)} /></div>
                </div>
              </div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>MUNICIPIO</div>
              <div className="p-fw"><span className="p-fi">📍</span>
                <input className="p-input" type="text" placeholder="Municipio"
                  value={form.contacto.direccion.municipio} onChange={e => setCDir('municipio', e.target.value)} /></div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>COLONIA</div>
              <div className="p-fw"><span className="p-fi">📍</span>
                <input className="p-input" type="text" placeholder="Colonia"
                  value={form.contacto.direccion.colonia} onChange={e => setCDir('colonia', e.target.value)} /></div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>CALLE</div>
              <div className="p-fw"><span className="p-fi">🏠</span>
                <input className="p-input" type="text" placeholder="Av. Siempre Viva 123"
                  value={form.contacto.direccion.calle} onChange={e => setCDir('calle', e.target.value)} /></div>
              <div className="p-grid-inner" style={{ marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl-dir">NÚMERO EXTERIOR</div>
                  <div className="p-fw"><span className="p-fi">#️⃣</span>
                    <input className="p-input" type="text" placeholder="No. Ext"
                      value={form.contacto.direccion.numero_exterior} onChange={e => setCDir('numero_exterior', e.target.value)} /></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl-dir">NÚMERO INTERIOR</div>
                  <div className="p-fw"><span className="p-fi">#️⃣</span>
                    <input className="p-input" type="text" placeholder="No. Int"
                      value={form.contacto.direccion.numero_interior} onChange={e => setCDir('numero_interior', e.target.value)} /></div>
                </div>
              </div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>CÓDIGO POSTAL</div>
              <div className="p-fw"><span className="p-fi">📮</span>
                <input className="p-input" type="text" placeholder="72000"
                  value={form.contacto.direccion.codigo_postal} onChange={e => setCDir('codigo_postal', e.target.value)} /></div>
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

          {/* Mensaje de feedback */}
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
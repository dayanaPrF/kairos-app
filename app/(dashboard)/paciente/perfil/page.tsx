'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import Link from 'next/link'

export default function PerfilPage() {
  const [profile, setProfile] = useState<any>(null)
  const [dbData, setDbData] = useState<any>(null)
  const [isComplete, setIsComplete] = useState<boolean>(true)
  const [showPasswordFields, setShowPasswordFields] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFullProfile = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          setProfile(user)
          
          // Obtener datos de la tabla 'perfil' y su relación con 'direccion'
          const { data: dbProfile } = await supabase
            .from('perfil')
            .select(`*, direccion (*)`)
            .eq('id_perfil', user.id)
            .single()

          if (dbProfile) {
            setDbData(dbProfile)
            
            // Lógica de validación para el banner de advertencia
            const hasPhone = !!dbProfile.numero_telefono
            const hasGender = !!dbProfile.sexo
            const hasBirth = !!dbProfile.fecha_nacimiento
            const hasAddress = !!dbProfile.id_direccion 
            
            if (!hasPhone || !hasGender || !hasBirth || !hasAddress) {
              setIsComplete(false)
            }
          } else {
            setIsComplete(false)
          }
        }
      } catch (err) {
        console.error("Error cargando perfil:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchFullProfile()
  }, [])

  if (loading) return <div className="p-10">Cargando...</div>

  const fullName = profile?.user_metadata?.full_name || dbData?.nombre || 'Paciente'
  const email = profile?.email
  const initial = fullName.charAt(0).toUpperCase()

  return (
    <div className="profile-page-wrapper">
      <div className="p-wrap">
        
        {/* LADO IZQUIERDO */}
        <div className="p-left">
          <div className="brand">
            <Link href="/dashboard">
              <button className='btn-regresar'>← Regresar al inicio</button>
            </Link>
          </div>

          <div className="p-avatar">{initial}</div>
          <div className="user-name" style={{color: '#fff', fontWeight: 900}}>{fullName}</div>
          <div className="user-email" style={{fontSize: '0.8rem', opacity: 0.7, marginBottom: '20px'}}>{email}</div>

          <div className="physio-info-card" style={{
            background: 'rgba(255, 255, 255, 0.1)', 
            padding: '15px', borderRadius: '12px', width: '100%', fontSize: '0.85rem',
            border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '10px'
          }}>
            <div style={{color: '#fff', opacity: 0.6, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px'}}>Tu Fisioterapeuta</div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '6px'}}>
              <span>👨‍⚕️</span> <span style={{fontWeight: 600}}>Dr. Alejandro García</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.9, marginBottom: '6px'}}>
              <span>🎓</span> <span>Rehabilitación Deportiva</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.9}}>
              <span>🏫</span> <span>UNAM</span>
            </div>
          </div>

          <div className="p-divider" style={{margin: '20px 0'}}></div>
          <div className="info-list"></div>
          <div className="prog-wrap" style={{marginTop: 'auto', width: '100%'}}></div>
        </div>

        {/* LADO DERECHO */}
        <div className="p-right">
          
          {/* BANNER DE ADVERTENCIA */}
          {!isComplete && (
            <div className="warning-banner" style={{
              background: '#FFF4E5', borderLeft: '4px solid #FFA117', padding: '16px',
              borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px'
            }}>
              <span>⚠️</span>
              <div>
                <strong style={{display: 'block', color: '#663C00', marginBottom: '4px'}}>Información pendiente</strong>
                <p style={{margin: 0, fontSize: '0.85rem', color: '#663C00'}}>
                  Tu perfil no está completo. Debes llenar todos los campos para poder <strong>agendar citas</strong>.
                </p>
              </div>
            </div>
          )}

          <div className="page-header">
            <div className="page-badge"><div className="bdot"></div>Mi Perfil</div>
            <h1 className="page-title">Información Personal</h1>
            <p className="page-sub">Actualiza tus datos de contacto y acceso</p>
          </div>

          <div className="section-title" style={{marginTop: '20px'}}>Datos personales</div>
          
          <div className="p-fields-grid">
            <div className="p-full">
              <div className="fl">Nombre Completo</div>
              <div className="p-fw">
                <span className="p-fi">👤</span>
                <input className="p-input" type="text" defaultValue={fullName} />
              </div>
            </div>

            <div className="p-full">
              <div className="fl">Correo electrónico</div>
              <div className="p-fw">
                <span className="p-fi">✉️</span>
                <input className="p-input" type="email" defaultValue={email} disabled />
              </div>
            </div>

            <div>
              <div className="fl">Teléfono</div>
              <div className="p-fw">
                <span className="p-fi">📞</span>
                <input className="p-input" type="text" placeholder="55..." defaultValue={dbData?.numero_telefono || ''} />
              </div>
            </div>

            <div>
              <div className="fl">Sexo</div>
              <div className="p-fw">
                <span className="p-fi">🚻</span>
                <select className="p-input" style={{appearance: 'none'}} defaultValue={dbData?.sexo || 'Seleccionar'}>
                  <option disabled>Seleccionar</option>
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
                <input className="p-input" type="date" defaultValue={dbData?.fecha_nacimiento || ''} />
              </div>
            </div>

            {/* SECCIÓN DIRECCIÓN COMPLETA (TUYA) */}
            <div className="p-full">
              <div className="fl">Dirección</div>
              <div className="p-grid-inner" style={{marginTop: '12px'}}>
                <div>
                  <div className="fl-dir">País</div>
                  <div className="p-fw"><span className="p-fi">📍</span><input className="p-input" type="text" placeholder="Ej. México" /></div>
                </div>
                <div>
                  <div className="fl-dir">Estado</div>
                  <div className="p-fw"><span className="p-fi">📍</span><input className="p-input" type="text" placeholder="Ej. Puebla" /></div>
                </div>
              </div>

              <div className="fl-dir">Municipio</div>
              <div className="p-fw"><span className="p-fi">📍</span><input className="p-input" type="text" placeholder="Municipio" /></div>

              <div className="fl-dir">Colonia</div>
              <div className="p-fw"><span className="p-fi">📍</span><input className="p-input" type="text" placeholder="Colonia" /></div>
              
              <div className="fl-dir">Calle</div>
              <div className="p-fw"><span className="p-fi">🏠</span><input className="p-input" type="text" placeholder="Av. Siempre Viva 123" /></div>

              <div className="p-grid-inner" style={{marginTop: '12px'}}>
                <div>
                  <div className="fl-dir">Número exterior</div>
                  <div className="p-fw"><span className="p-fi">#️⃣</span><input className="p-input" type="text" placeholder="No. Ext" /></div>
                </div>
                <div>
                  <div className="fl-dir">Número interior</div>
                  <div className="p-fw"><span className="p-fi">#️⃣</span><input className="p-input" type="text" placeholder="No. Int" /></div>
                </div>
              </div>

              <div className="fl-dir">Código postal</div>
              <div className="p-fw"><span className="p-fi">📮</span><input className="p-input" type="text" placeholder="72000" /></div>
            </div>
          </div>

          {/* CONTACTO DE EMERGENCIA (TUYO) */}
          <div className="section-title">Contacto de emergencia</div>
          <div className="p-fields-grid">
            <div className="p-full">
              <div className="fl">Nombre del Contacto</div>
              <div className="p-fw"><span className="p-fi">👤</span><input className="p-input" type="text" placeholder="Nombre completo" /></div>
            </div>

            <div className="p-full"> 
              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Primer Apellido</div>
                  <div className="p-fw"><span className="p-fi">👤</span><input className="p-input" type="text" placeholder="1er Apellido" /></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Segundo Apellido</div>
                  <div className="p-fw"><span className="p-fi">👤</span><input className="p-input" type="text" placeholder="2do Apellido" /></div>
                </div>
              </div>

              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Parentesco</div>
                  <div className="p-fw"><span className="p-fi">🤝</span><input className="p-input" type="text" placeholder="Ej. Padre, Cónyuge" /></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Sexo</div>
                  <div className="p-fw">
                    <span className="p-fi">🚻</span>
                    <select className="p-input" style={{ appearance: 'none' }}>
                      <option>Seleccionar</option><option>Femenino</option><option>Masculino</option><option>Otro</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-full" style={{ marginTop: '12px' }}>
              <div className="fl">Correo electrónico</div>
              <div className="p-fw"><span className="p-fi">✉️</span><input className="p-input" type="email" placeholder="correo@ejemplo.com" /></div>
            </div>

            <div className="p-full">
              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Teléfono Principal</div>
                  <div className="p-fw"><span className="p-fi">📞</span><input className="p-input" type="text" placeholder="55..." /></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Segundo Teléfono</div>
                  <div className="p-fw"><span className="p-fi">📱</span><input className="p-input" type="text" placeholder="Opcional" /></div>
                </div>
              </div>
              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Contacto Preferido</div>
                  <div className="p-fw">
                    <span className="p-fi">🔔</span>
                    <select className="p-input" style={{ appearance: 'none' }}>
                      <option>Llamada</option><option>WhatsApp</option><option>Mensaje de texto</option>
                    </select>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Disponibilidad Horaria</div>
                  <div className="p-fw"><span className="p-fi">🕒</span><input className="p-input" type="text" placeholder="Ej. 9:00 - 18:00" /></div>
                </div>
              </div>
            </div>

            {/* DIRECCIÓN DEL CONTACTO (TUYA) */}
            <div className="p-full" style={{ marginTop: '25px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <div className="fl" style={{ marginBottom: '15px', color: '#5499C7', fontWeight: 'bold' }}>DIRECCIÓN DEL CONTACTO</div>
              <div className="p-grid-inner">
                <div style={{ flex: 1 }}>
                  <div className="fl-dir">PAÍS</div>
                  <div className="p-fw"><span className="p-fi">📍</span><input className="p-input" type="text" placeholder="Ej. México" /></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl-dir">ESTADO</div>
                  <div className="p-fw"><span className="p-fi">📍</span><input className="p-input" type="text" placeholder="Ej. Puebla" /></div>
                </div>
              </div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>MUNICIPIO</div>
              <div className="p-fw"><span className="p-fi">📍</span><input className="p-input" type="text" placeholder="Municipio" /></div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>COLONIA</div>
              <div className="p-fw"><span className="p-fi">📍</span><input className="p-input" type="text" placeholder="Colonia" /></div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>CALLE</div>
              <div className="p-fw"><span className="p-fi">🏠</span><input className="p-input" type="text" placeholder="Av. Siempre Viva 123" /></div>
              <div className="p-grid-inner" style={{ marginTop: '12px' }}>
                <div style={{ flex: 1 }}><div className="fl-dir">NÚMERO EXTERIOR</div><div className="p-fw"><span className="p-fi">#️⃣</span><input className="p-input" type="text" placeholder="No. Ext" /></div></div>
                <div style={{ flex: 1 }}><div className="fl-dir">NÚMERO INTERIOR</div><div className="p-fw"><span className="p-fi">#️⃣</span><input className="p-input" type="text" placeholder="No. Int" /></div></div>
              </div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>CÓDIGO POSTAL</div>
              <div className="p-fw"><span className="p-fi">📮</span><input className="p-input" type="text" placeholder="72000" /></div>
            </div>
          </div>

          {/* SEGURIDAD DINÁMICA */}
          <div className="section-title" style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
            Seguridad
            {!showPasswordFields && (
              <button onClick={() => setShowPasswordFields(true)} style={{ color: '#2874A6', cursor: 'pointer', background: 'none', border: 'none', fontSize: '0.8rem' }}>
                Cambiar contraseña
              </button>
            )}
          </div>

          {showPasswordFields ? (
            <div className="p-fields-grid" style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
              <div className="p-full">
                <div className="fl">Nueva contraseña</div>
                <div className="p-fw"><span className="p-fi">🔒</span><input className="p-input" type="password" placeholder="Mínimo 8 caracteres" autoFocus /></div>
              </div>
              <button onClick={() => setShowPasswordFields(false)} style={{ color: '#888', background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}>Cancelar</button>
            </div>
          ) : (
            <div style={{ padding: '10px', fontSize: '0.8rem', color: '#999' }}>Tu contraseña está encriptada.</div>
          )}

          <div className="actions" style={{marginTop: '30px'}}>
            <button className="btn-save">Guardar cambios →</button>
            <button onClick={() => supabase.auth.signOut()} className="btn-out">Cerrar sesión</button>
          </div>
        </div>
      </div>
    </div>
  )
}
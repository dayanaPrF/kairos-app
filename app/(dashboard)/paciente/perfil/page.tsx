'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import Link from 'next/link'

export default function PerfilPage() {
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setProfile(user)
    }
    fetchProfile()
  }, [])

  if (!profile) return <div className="p-10">Cargando...</div>

  const fullName = profile.user_metadata?.full_name || 'Paciente'
  const email = profile.email
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
          <div className="user-email" style={{fontSize: '0.8rem', opacity: 0.7}}>{email}</div>

          <div className="p-divider"></div>

          <div className="info-list">
            {/* ... (tus info-rows sin cambios) */}
          </div>

          <div className="prog-wrap" style={{marginTop: 'auto', width: '100%'}}>
            {/* ... (tu barra de progreso sin cambios) */}
          </div>
        </div>

        {/* LADO DERECHO */}
        <div className="p-right">
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

            {/* CAMPOS COMPARTIDOS (Sin p-full) */}
            <div>
              <div className="fl">Teléfono</div>
              <div className="p-fw">
                <span className="p-fi">📞</span>
                <input className="p-input" type="text" placeholder="55..." />
              </div>
            </div>

            <div>
              <div className="fl">Sexo</div>
              <div className="p-fw">
                <span className="p-fi">🚻</span>
                <select className="p-input" style={{appearance: 'none'}}>
                  <option>Seleccionar</option>
                  <option>Femenino</option>
                  <option>Masculino</option>
                  <option>Otro</option>
                </select>
              </div>
            </div>

            <div className="p-full">
              <div className="fl">Fecha de nacimiento</div>
              <div className="p-fw">
                <span className="p-fi">🗓️</span>
                <input className="p-input" type="date" />
              </div>
            </div>

            {/* SECCIÓN DIRECCIÓN COMPLETA */}
            <div className="p-full">
              <div className="fl">Dirección</div>

              <div className="p-grid-inner" style={{marginTop: '12px'}}>
                <div>
                  <div className="fl-dir">País</div>
                  <div className="p-fw">
                    <span className="p-fi">📍</span>
                    <input className="p-input" type="text" placeholder="Ej. México" />
                  </div>
                </div>
                <div>
                  <div className="fl-dir">Estado</div>
                  <div className="p-fw">
                    <span className="p-fi">📍</span>
                    <input className="p-input" type="text" placeholder="Ej. Estado de México" />
                  </div>
                </div>
              </div>

              <div className="fl-dir">Municipio</div>
              <div className="p-fw">
                <span className="p-fi">📍</span>
                <input className="p-input" type="text" placeholder="San Cristobal" />
              </div>

              <div className="fl-dir">Colonia</div>
              <div className="p-fw">
                <span className="p-fi">📍</span>
                <input className="p-input" type="text" placeholder="San Cristobal" />
              </div>
              
              <div className="fl-dir">Calle</div>
              <div className="p-fw">
                <span className="p-fi">🏠</span>
                <input className="p-input" type="text" placeholder="Av. Siempre Viva 123" />
              </div>

              <div className="p-grid-inner" style={{marginTop: '12px'}}>
                <div>
                  <div className="fl-dir">Número exterior</div>
                  <div className="p-fw">
                    <span className="p-fi">#️⃣</span>
                    <input className="p-input" type="number" placeholder="Ej. México" />
                  </div>
                </div>
                <div>
                  <div className="fl-dir">Número interior</div>
                  <div className="p-fw">
                    <span className="p-fi">#️⃣</span>
                    <input className="p-input" type="number" placeholder="Ej. Estado de México" />
                  </div>
                </div>
              </div>

              <div className="fl-dir">Código postal</div>
              <div className="p-fw">
                <span className="p-fi">📮</span>
                <input className="p-input" type="text" placeholder="72000" />
              </div>
            </div>
          </div>

          <div className="section-title">Contacto de emergencia</div>
          <div className="p-fields-grid">
            <div className="p-full">
              <div className="fl">Nueva contraseña</div>
              <div className="p-fw">
                <span className="p-fi">🔒</span>
                <input className="p-input" type="password" placeholder="Mínimo 8 caracteres" />
              </div>
            </div>
          </div>

          <div className="section-title">Seguridad</div>
          <div className="p-fields-grid">
            <div className="p-full">
              <div className="fl">Nueva contraseña</div>
              <div className="p-fw">
                <span className="p-fi">🔒</span>
                <input className="p-input" type="password" placeholder="Mínimo 8 caracteres" />
              </div>
            </div>
          </div>

          <div className="actions">
            <button className="btn-save">Guardar cambios →</button>
            <button onClick={() => supabase.auth.signOut()} className="btn-out">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
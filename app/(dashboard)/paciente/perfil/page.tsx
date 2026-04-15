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
            <button className='btn-regresar'>← Regresar al inicio</button>
          </div>

          <div className="p-avatar">{initial}</div>
          <div className="user-name" style={{color: '#fff', fontWeight: 900}}>{fullName}</div>
          <div className="user-email" style={{fontSize: '0.8rem', opacity: 0.7}}>{email}</div>

          <div className="p-divider"></div>

          <div className="info-list">
            <div className="p-info-row">
              <span className="info-ico">🏥</span>
              <div className="info-text">
                <div className="info-label" style={{fontSize: '0.6rem', opacity: 0.6}}>PROGRAMA</div>
                <div className="info-val" style={{fontSize: '0.85rem', fontWeight: 600}}>Fisioterapia Hombro</div>
              </div>
            </div>
            <div className="p-info-row">
              <span className="info-ico">📅</span>
              <div className="info-text">
                <div className="info-label" style={{fontSize: '0.6rem', opacity: 0.6}}>PRÓXIMA CITA</div>
                <div className="info-val" style={{fontSize: '0.85rem', fontWeight: 600}}>17 de Abril</div>
              </div>
            </div>
          </div>

          <div className="prog-wrap" style={{marginTop: 'auto', width: '100%'}}>
            <div className="prog-label" style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '5px'}}>
              <span>Progreso</span><span>60%</span>
            </div>
            <div className="prog-track" style={{height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px'}}>
              <div className="prog-fill" style={{width: '60%', height: '100%', background: 'var(--lime)', borderRadius: '10px'}}></div>
            </div>
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

            <div className="p-full">
              <div className="fl">Teléfono</div>
              <div className="p-fw">
                <span className="p-fi">📞</span>
                <input className="p-input" type="email" defaultValue={email} disabled />
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
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="btn-out"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
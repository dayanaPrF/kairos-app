'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

import { SectionHome } from './sections/SectionHome'
import { SectionRutina } from './sections/SectionRutina'
import { SectionCitas } from './sections/SectionCitas'
import { SectionProgreso } from './sections/SectionProgreso'
import { SectionNotificaciones } from './sections/SectionNotificaciones'

type Section = 'home' | 'rutina' | 'citas' | 'progreso' | 'notificaciones'

export default function PacientePage() {
  const [userName, setUserName] = useState('Paciente')
  const [activeSection, setActiveSection] = useState<Section>('home')
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserName(user.user_metadata?.full_name?.split(' ')[0] || 'Paciente')

        // Contar notificaciones no leídas para el badge del topbar
        const { data } = await supabase
          .from('notificacion')
          .select('id_notificacion', { count: 'exact', head: false })
          .eq('id_perfil', user.id)
          .is('deleted_at', null)
          .not('estado', 'ilike', 'leida')

        setNotifCount(data?.length ?? 0)
      }
    }
    getProfile()
  }, [])

  // Actualizar badge cuando el usuario vuelve de notificaciones
  const handleSectionChange = (section: Section) => {
    setActiveSection(section)
    if (section !== 'notificaciones') return
    // Al abrir notificaciones, el badge se actualizará cuando cierre
  }

  const refreshNotifCount = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('notificacion')
      .select('id_notificacion')
      .eq('id_perfil', user.id)
      .is('deleted_at', null)
      .not('estado', 'ilike', 'leida')
    setNotifCount(data?.length ?? 0)
  }

  const todayStr = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const navItems: { key: Section; icon: string; label: string }[] = [
    { key: 'home',            icon: '🏠', label: 'Principal'       },
    { key: 'rutina',          icon: '🏋️', label: 'Mi Rutina'       },
    { key: 'citas',           icon: '📅', label: 'Mis Citas'       },
    { key: 'progreso',        icon: '📊', label: 'Progreso'        },
    { key: 'notificaciones',  icon: '🔔', label: 'Notificaciones'  },
  ]

  return (
    <div className="dash-root">

      {/* ── SIDEBAR ── */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <div className="dash-logo">
            <Image
              src="/logo_kairos.png"
              alt="Kairós Logo"
              width={70}
              height={70}
              style={{ width: 'auto', height: 'auto' }}
              priority
            />
          </div>
          <div className="dash-brand-tag">Plataforma de rehabilitación</div>
        </div>

        <nav className="dash-sidebar-nav">
          {navItems.map(({ key, icon, label }) => (
            <button
              key={key}
              className={`dash-nav-item ${activeSection === key ? 'active' : ''}`}
              onClick={() => handleSectionChange(key)}
            >
              <span className="dash-nav-icon">{icon}</span>
              {label}
              {/* Badge de notificaciones en sidebar */}
              {key === 'notificaciones' && notifCount > 0 && (
                <span style={{
                  marginLeft: 'auto', background: '#E74C3C', color: '#fff',
                  borderRadius: '12px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700,
                }}>
                  {notifCount}
                </span>
              )}
              {activeSection === key && <div className="dash-nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-sf-hint">Semana 6 de 12 · Plan de rehabilitación de hombro</div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="dash-main">

        {/* TOPBAR */}
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <div className="dash-topbar-title">Buenos días, {userName} ☀️</div>
            <div className="dash-topbar-sub">{todayStr}</div>
          </div>

          <div className="dash-topbar-actions">
            <button className="dash-t-btn">⚙️ Configuración</button>

            {/* Botón notificaciones con badge y navegación */}
            <button
              className="dash-t-btn"
              style={{ position: 'relative' }}
              onClick={() => {
                handleSectionChange('notificaciones')
                // Limpiar badge visualmente al abrir; se recalcula al salir
                setNotifCount(0)
              }}
            >
              🔔 Notificaciones
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: '4px', right: '4px',
                  background: '#E74C3C', color: '#fff', borderRadius: '50%',
                  width: '16px', height: '16px', fontSize: '0.6rem',
                  fontWeight: 700, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', lineHeight: 1,
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            <button className="dash-t-btn primary">💬 Bandeja de entrada</button>

            <Link href="/paciente/perfil" className="dash-avatar-link">
              <button className="dash-s-avatar">{userName[0]}</button>
            </Link>

            <div>
              <div className="dash-s-name">{userName}</div>
              <div className="dash-s-role">Paciente</div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div className="dash-content">
          {activeSection === 'home' && (
            <SectionHome onStart={() => setActiveSection('rutina')} />
          )}
          {activeSection === 'rutina'         && <SectionRutina />}
          {activeSection === 'citas'          && <SectionCitas />}
          {activeSection === 'progreso'       && <SectionProgreso />}
          {activeSection === 'notificaciones' && (
            <SectionNotificaciones onLeidas={refreshNotifCount} />
          )}
        </div>
      </div>
    </div>
  )
}

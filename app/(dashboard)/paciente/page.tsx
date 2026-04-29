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
import { SectionBandeja } from './sections/SectionBandeja'

type Section = 'home' | 'rutina' | 'citas' | 'progreso' | 'notificaciones' | 'bandeja'

export default function PacientePage() {
  const [userName, setUserName] = useState('Paciente')
  const [activeSection, setActiveSection] = useState<Section>('home')
  const [notifCount, setNotifCount] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  // Cuenta mensajes no leídos enviados por fisioterapeutas al paciente
  const refreshUnreadMessages = async (userId: string) => {
    // 1. Obtener todos los chats del paciente
    const { data: chats } = await supabase
      .from('chat')
      .select('id_chat')
      .eq('id_paciente', userId)
      .is('deleted_at', null)

    if (!chats?.length) {
      setUnreadMessages(0)
      return
    }

    const chatIds = chats.map(c => c.id_chat)

    // 2. Contar mensajes no leídos en esos chats donde el emisor NO es el paciente
    const { count } = await supabase
      .from('mensaje')
      .select('id_mensaje', { count: 'exact', head: true })
      .in('id_chat', chatIds)
      .eq('leido', false)
      .neq('id_perfil_emisor', userId)
      .is('deleted_at', null)

    setUnreadMessages(count ?? 0)
  }

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserName(user.user_metadata?.full_name?.split(' ')[0] || 'Paciente')

      // Notificaciones no leídas
      const { data: notifs } = await supabase
        .from('notificacion')
        .select('id_notificacion', { count: 'exact', head: false })
        .eq('id_perfil', user.id)
        .is('deleted_at', null)
        .not('estado', 'ilike', 'leida')

      setNotifCount(notifs?.length ?? 0)

      // Mensajes no leídos (real, desde Supabase)
      await refreshUnreadMessages(user.id)
    }

    getProfile()
  }, [])

  const handleSectionChange = (section: Section) => {
    setActiveSection(section)
    // Al abrir la bandeja se limpia el badge; se recalculará al salir
    if (section === 'bandeja') setUnreadMessages(0)
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
    { key: 'bandeja',         icon: '💬', label: 'Mensajes'        },
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

              {key === 'notificaciones' && notifCount > 0 && (
                <span style={{ marginLeft: 'auto', background: '#E74C3C', color: '#fff', borderRadius: '12px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {notifCount}
                </span>
              )}

              {key === 'bandeja' && unreadMessages > 0 && (
                <span style={{ marginLeft: 'auto', background: '#1A73E8', color: '#fff', borderRadius: '12px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {unreadMessages}
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

            <button
              className="dash-t-btn"
              style={{ position: 'relative' }}
              onClick={() => {
                handleSectionChange('notificaciones')
                setNotifCount(0)
              }}
            >
              🔔 Notificaciones
              {notifCount > 0 && (
                <span style={{ position: 'absolute', top: '4px', right: '4px', background: '#E74C3C', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            <button
              className="dash-t-btn primary"
              style={{ position: 'relative' }}
              onClick={() => handleSectionChange('bandeja')}
            >
              💬 Bandeja de entrada
              {unreadMessages > 0 && (
                <span style={{ position: 'absolute', top: '4px', right: '4px', background: '#E74C3C', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>

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
          {activeSection === 'home'           && <SectionHome onStart={() => setActiveSection('rutina')} />}
          {activeSection === 'rutina'         && <SectionRutina />}
          {activeSection === 'citas'          && <SectionCitas />}
          {activeSection === 'progreso'       && <SectionProgreso />}
          {activeSection === 'notificaciones' && <SectionNotificaciones onLeidas={refreshNotifCount} />}
          {activeSection === 'bandeja'        && <SectionBandeja />}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

// Importación de Secciones
import { FisioSectionHome } from '@/app/(dashboard)/fisio/sections/FisioSectionHome'
import { FisioSectionPacientes } from '@/app/(dashboard)/fisio/sections/FisioSectionPacientes'
import { FisioSectionAgenda } from '@/app/(dashboard)/fisio/sections/FisioSectionAgenda'
import { FisioSectionRutinas } from '@/app/(dashboard)/fisio/sections/FisioSectionRutinas'
import { FisioSectionClinica } from '@/app/(dashboard)/fisio/sections/FisioSectionClinica'
import { FisioSectionReportes } from '@/app/(dashboard)/fisio/sections/FisioSectionReportes'
import { FisioSectionNotificaciones } from '@/app/(dashboard)/fisio/sections/FisioSectionNotificaciones'
import { FisioSectionBandeja } from '@/app/(dashboard)/fisio/sections/FisioSectionBandeja'

type Section = 'home' | 'pacientes' | 'agenda' | 'rutinas' | 'mensajes' | 'clinica' | 'reportes' | 'notificaciones'

export default function FisioDashPage() {
  const [userName, setUserName] = useState('Fisioterapeuta')
  const [activeSection, setActiveSection] = useState<Section>('home')
  const [notifCount, setNotifCount] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  const refreshUnreadMessages = useCallback(async (userId: string) => {
    const { data: chats } = await supabase
      .from('chat')
      .select('id_chat')
      .eq('id_fisioterapeuta', userId)
      .is('deleted_at', null)

    if (!chats?.length) {
      setUnreadMessages(0)
      return
    }

    const chatIds = chats.map(c => c.id_chat)
    const { count } = await supabase
      .from('mensaje')
      .select('id_mensaje', { count: 'exact', head: true })
      .in('id_chat', chatIds)
      .eq('leido', false)
      .neq('id_perfil_emisor', userId)
      .is('deleted_at', null)

    setUnreadMessages(count ?? 0)
  }, [])

  const refreshNotifCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('notificacion')
      .select('id_notificacion')
      .eq('id_perfil', user.id)
      .is('deleted_at', null)
      .not('estado', 'ilike', 'leida')
    setNotifCount(data?.length ?? 0)
  }, [])

  useEffect(() => {
    let channel: any;

    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('perfil')
        .select('nombre')
        .eq('id_perfil', user.id)
        .maybeSingle()
      if (perfil?.nombre) setUserName(perfil.nombre)

      refreshNotifCount()
      refreshUnreadMessages(user.id)

      // SUSCRIPCIÓN EN TIEMPO REAL: Si un mensaje se marca como leído, actualiza el contador global
      channel = supabase
        .channel('global-chat-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensaje' }, () => {
            refreshUnreadMessages(user.id);
        })
        .subscribe()
    }

    initData()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [refreshNotifCount, refreshUnreadMessages])

  const todayStr = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const navItems: { key: Section; icon: string; label: string }[] = [
    { key: 'home',            icon: '🏠', label: 'Inicio'          },
    { key: 'pacientes',       icon: '🧑‍🦽', label: 'Mis pacientes'   },
    { key: 'agenda',          icon: '📅', label: 'Agenda'          },
    { key: 'rutinas',         icon: '🏋️', label: 'Rutinas'         },
    { key: 'mensajes',        icon: '💬', label: 'Mensajes'        },
    { key: 'notificaciones',  icon: '🔔', label: 'Notificaciones'  },
    { key: 'clinica',         icon: '🏥', label: 'Mi clínica'      },
    { key: 'reportes',        icon: '📊', label: 'Reportes'        },
  ]

  const renderSection = () => {
    switch (activeSection) {
      case 'home':           return <FisioSectionHome />
      case 'pacientes':      return <FisioSectionPacientes />
      case 'agenda':         return <FisioSectionAgenda />
      case 'rutinas':        return <FisioSectionRutinas />
      case 'mensajes':       return <FisioSectionBandeja />
      case 'notificaciones': return <FisioSectionNotificaciones onLeidas={refreshNotifCount} />
      case 'clinica':        return <FisioSectionClinica />
      case 'reportes':       return <FisioSectionReportes/>
      default:               return <FisioSectionHome />
    }
  }

  return (
    <div className="dash-root">
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <div className="dash-logo">
            <Image src="/logo_kairos.png" alt="Kairós Logo" width={70} height={70} style={{ width: 'auto', height: 'auto' }} priority />
          </div>
          <div className="dash-brand-tag">Panel Fisioterapeuta</div>
        </div>
        <nav className="dash-sidebar-nav">
          {navItems.map(({ key, icon, label }) => (
            <button key={key} className={`dash-nav-item ${activeSection === key ? 'active' : ''}`} onClick={() => setActiveSection(key)}>
              <span className="dash-nav-icon">{icon}</span>
              {label}
              {key === 'notificaciones' && notifCount > 0 && <span className="sidebar-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
              {key === 'mensajes' && unreadMessages > 0 && <span className="sidebar-badge" style={{ background: '#1A73E8' }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
              {activeSection === key && <div className="dash-nav-dot" />}
            </button>
          ))}
        </nav>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <div className="dash-topbar-title">Hola, Dr. {userName} 👋</div>
            <div className="dash-topbar-sub">{todayStr}</div>
          </div>
          <div className="dash-topbar-actions">
            <button className="dash-t-btn" style={{ position: 'relative' }} onClick={() => setActiveSection('notificaciones')}>
              🔔 Notificaciones
              {notifCount > 0 && <span className="topbar-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
            <button className="dash-t-btn primary" style={{ position: 'relative' }} onClick={() => setActiveSection('mensajes')}>
              💬 Mensajes
              {unreadMessages > 0 && <span className="topbar-badge" style={{ background: '#FFF', color: '#1A73E8' }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
            </button>
            <Link href="/fisio/perfil" className="dash-avatar-link">
              <button className="dash-s-avatar">{userName[0]}</button>
            </Link>
            <div>
              <div className="dash-s-name">{userName}</div>
              <div className="dash-s-role">Fisioterapeuta</div>
            </div>
          </div>
        </header>
        <div className="dash-content">{renderSection()}</div>
      </div>

      <style jsx>{`
        .sidebar-badge { margin-left: auto; background: #E74C3C; color: #fff; border-radius: 12px; padding: 1px 7px; fontSize: 0.7rem; font-weight: 700; }
        .topbar-badge { position: absolute; top: 4px; right: 4px; background: #E74C3C; color: #fff; border-radius: 50%; width: 16px; height: 16px; font-size: 0.6rem; font-weight: 700; display: flex; alignItems: center; justifyContent: center; }
      `}</style>
    </div>
  )
}
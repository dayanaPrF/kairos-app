'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

// Secciones
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

  const refreshNotifCount = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('notificacion')
      .select('id_notificacion')
      .eq('id_perfil', userId)
      .is('deleted_at', null)
      .not('estado', 'ilike', 'leida')
    setNotifCount(data?.length ?? 0)
  }, [])

  useEffect(() => {
    let globalChannel: any

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cargar datos iniciales
      const { data: perfil } = await supabase.from('perfil').select('nombre').eq('id_perfil', user.id).maybeSingle()
      if (perfil?.nombre) setUserName(perfil.nombre)
      
      refreshNotifCount(user.id)
      refreshUnreadMessages(user.id)

      // REALTIME GLOBAL: Escucha cambios en mensajes y notificaciones para los contadores
      globalChannel = supabase
        .channel('global-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensaje' }, () => {
          refreshUnreadMessages(user.id)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacion' }, () => {
          refreshNotifCount(user.id)
        })
        .subscribe()
    }

    init()
    return () => { if (globalChannel) supabase.removeChannel(globalChannel) }
  }, [refreshNotifCount, refreshUnreadMessages])

  const todayStr = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const navItems: { key: Section; icon: string; label: string }[] = [
    { key: 'home', icon: '🏠', label: 'Inicio' },
    { key: 'pacientes', icon: '🧑‍🦽', label: 'Mis pacientes' },
    { key: 'agenda', icon: '📅', label: 'Agenda' },
    { key: 'rutinas', icon: '🏋️', label: 'Rutinas' },
    { key: 'mensajes', icon: '💬', label: 'Mensajes' },
    { key: 'notificaciones', icon: '🔔', label: 'Notificaciones' },
    { key: 'clinica', icon: '🏥', label: 'Mi clínica' },
    { key: 'reportes', icon: '📊', label: 'Reportes' },
  ]

  return (
    <div className="dash-root">
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <div className="dash-logo"><Image src="/logo_kairos.png" alt="Logo" width={70} height={70} priority /></div>
          <div className="dash-brand-tag">Panel Fisioterapeuta</div>
        </div>
        <nav className="dash-sidebar-nav">
          {navItems.map(({ key, icon, label }) => (
            <button key={key} className={`dash-nav-item ${activeSection === key ? 'active' : ''}`} onClick={() => setActiveSection(key)}>
              <span className="dash-nav-icon">{icon}</span>
              {label}
              {key === 'notificaciones' && notifCount > 0 && <span className="sidebar-badge">{notifCount}</span>}
              {key === 'mensajes' && unreadMessages > 0 && <span className="sidebar-badge" style={{ background: '#1A73E8' }}>{unreadMessages}</span>}
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
            <button className="dash-t-btn" onClick={() => setActiveSection('notificaciones')}>
              🔔 {notifCount > 0 && <span className="topbar-badge">{notifCount}</span>}
            </button>
            <button className="dash-t-btn primary" onClick={() => setActiveSection('mensajes')}>
              💬 {unreadMessages > 0 && <span className="topbar-badge" style={{ background: '#FFF', color: '#1A73E8' }}>{unreadMessages}</span>}
            </button>
            <Link href="/fisio/perfil" className="dash-s-avatar">{userName[0]}</Link>
            <div className="dash-s-info">
              <div className="dash-s-name">{userName}</div>
              <div className="dash-s-role">Fisioterapeuta</div>
            </div>
          </div>
        </header>
        <div className="dash-content">
          {activeSection === 'home' && <FisioSectionHome />}
          {activeSection === 'pacientes' && <FisioSectionPacientes />}
          {activeSection === 'mensajes' && <FisioSectionBandeja />}
          {activeSection === 'notificaciones' && <FisioSectionNotificaciones onLeidas={() => {}} />}
          {/* ... resto de secciones ... */}
        </div>
      </div>
      
      <style jsx>{`
        .sidebar-badge { margin-left: auto; background: #E74C3C; color: #fff; border-radius: 12px; padding: 1px 7px; font-size: 0.7rem; font-weight: 700; }
        .topbar-badge { position: absolute; top: -5px; right: -5px; background: #E74C3C; color: #fff; border-radius: 50%; width: 18px; height: 18px; font-size: 0.65rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }
      `}</style>
    </div>
  )
}
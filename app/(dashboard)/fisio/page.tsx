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
  const [userId, setUserId] = useState<string | null>(null)

  // 1. Refrescar Mensajes No Leídos (Directo a la tabla mensaje)
  const refreshUnreadMessages = useCallback(async (uid: string) => {
    // Buscamos mensajes no leídos donde el emisor NO sea el usuario actual
    // y que pertenezcan a un chat donde el usuario es el fisioterapeuta
    const { count, error } = await supabase
      .from('mensaje')
      .select(`
        id_mensaje,
        chat!inner(id_fisioterapeuta)
      `, { count: 'exact', head: true })
      .eq('chat.id_fisioterapeuta', uid)
      .eq('leido', false)
      .neq('id_perfil_emisor', uid)
      .is('deleted_at', null)

    if (!error) {
      setUnreadMessages(count ?? 0)
    }
  }, [])

  // 2. Refrescar Notificaciones
  const refreshNotifCount = useCallback(async (uid: string) => {
    const { count } = await supabase
      .from('notificacion')
      .select('id_notificacion', { count: 'exact', head: true })
      .eq('id_perfil', uid)
      .is('deleted_at', null)
      .not('estado', 'ilike', 'leida')

    setNotifCount(count ?? 0)
  }, [])

  // 3. Inicialización y Tiempo Real
  useEffect(() => {
    let globalChannel: any

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Carga inicial de datos
      const { data: perfil } = await supabase
        .from('perfil')
        .select('nombre')
        .eq('id_perfil', user.id)
        .maybeSingle()
      
      if (perfil?.nombre) setUserName(perfil.nombre)
      
      refreshNotifCount(user.id)
      refreshUnreadMessages(user.id)

      // SUSCRIPCIÓN REALTIME
      globalChannel = supabase
        .channel('dashboard-realtime-v2')
        .on(
          'postgres_changes', 
          { event: '*', schema: 'public', table: 'mensaje' }, 
          (payload) => {
            // Cuando hay CUALQUIER cambio (nuevo mensaje o mensaje marcado como leido)
            refreshUnreadMessages(user.id)
          }
        )
        .on(
          'postgres_changes', 
          { event: '*', schema: 'public', table: 'notificacion' }, 
          () => refreshNotifCount(user.id)
        )
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
          <div className="dash-logo">
            <Image src="/logo_kairos.png" alt="Logo" width={70} height={70} priority />
          </div>
          <div className="dash-brand-tag">Panel Fisioterapeuta</div>
        </div>
        <nav className="dash-sidebar-nav">
          {navItems.map(({ key, icon, label }) => (
            <button 
              key={key} 
              className={`dash-nav-item ${activeSection === key ? 'active' : ''}`} 
              onClick={() => setActiveSection(key)}
            >
              <span className="dash-nav-icon">{icon}</span>
              {label}
              {key === 'notificaciones' && notifCount > 0 && (
                <span className="sidebar-badge">{notifCount}</span>
              )}
              {key === 'mensajes' && unreadMessages > 0 && (
                <span className="sidebar-badge" style={{ background: '#1A73E8' }}>
                  {unreadMessages}
                </span>
              )}
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
            {/* Notificaciones Header */}
            <button className="dash-t-btn" onClick={() => setActiveSection('notificaciones')}>
              🔔 {notifCount > 0 && <span className="topbar-badge">{notifCount}</span>}
            </button>

            {/* Mensajes Header */}
            <button className="dash-t-btn primary" onClick={() => setActiveSection('mensajes')}>
              💬 Mensajes
              {unreadMessages > 0 && (
                <span className="topbar-badge" style={{ background: '#E74C3C', color: '#FFF' }}>
                  {unreadMessages}
                </span>
              )}
            </button>

            <Link href="/fisio/perfil" className="dash-avatar-link">
              <button className="dash-s-avatar">{userName[0]}</button>
            </Link>
            <div className="dash-s-info">
              <div className="dash-s-name">{userName}</div>
              <div className="dash-s-role">Fisioterapeuta</div>
            </div>
          </div>
        </header>

        <div className="dash-content">
          {activeSection === 'home' && (
            <FisioSectionHome onNavigate={(section) => setActiveSection(section as Section)} />
          )}
          {activeSection === 'pacientes' && <FisioSectionPacientes />}
          {activeSection === 'agenda' && <FisioSectionAgenda />}
          {activeSection === 'rutinas' && <FisioSectionRutinas />}
          {activeSection === 'mensajes' && <FisioSectionBandeja />}
          {activeSection === 'notificaciones' && (
            <FisioSectionNotificaciones onLeidas={() => userId && refreshNotifCount(userId)} />
          )}
          {activeSection === 'clinica' && <FisioSectionClinica />}
          {activeSection === 'reportes' && <FisioSectionReportes />}
        </div>
      </div>
      
      <style jsx>{`
        .sidebar-badge { 
          margin-left: auto; 
          background: #E74C3C; 
          color: #fff; 
          border-radius: 12px; 
          padding: 1px 8px; 
          font-size: 0.7rem; 
          font-weight: 700; 
        }
        .topbar-badge { 
          position: absolute; 
          top: -5px; 
          right: -5px; 
          background: #E74C3C; 
          color: #fff; 
          border-radius: 50%; 
          width: 18px; 
          height: 18px; 
          font-size: 0.65rem; 
          font-weight: 700; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border: 2px solid #fff; 
        }
      `}</style>
    </div>
  )
}
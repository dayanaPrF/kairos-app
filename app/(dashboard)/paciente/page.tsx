'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

// Importación de las nuevas secciones según tu estructura de carpetas
import { SectionHome } from './sections/SectionHome'
import { SectionRutina } from './sections/SectionRutina'
import { SectionCitas } from './sections/SectionCitas'
import { SectionProgreso } from './sections/SectionProgreso'

type Section = 'home' | 'rutina' | 'citas' | 'progreso'

export default function PacientePage() {
  const [userName, setUserName] = useState('Paciente')
  const [activeSection, setActiveSection] = useState<Section>('home')

  useEffect(() => {
      const getProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Google usa full_name, registro manual usa nombre
          const nombre = 
            user.user_metadata?.full_name?.split(' ')[0] ||
            user.user_metadata?.nombre ||
            'Paciente'
          setUserName(nombre)
        }
      }
      getProfile()
    }, [])

  const todayStr = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const navItems: { key: Section; icon: string; label: string }[] = [
    { key: 'home',     icon: '🏠', label: 'Principal' },
    { key: 'rutina',   icon: '🏋️', label: 'Mi Rutina'  },
    { key: 'citas',    icon: '📅', label: 'Mis Citas'  },
    { key: 'progreso', icon: '📊', label: 'Progreso'   },
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
              className="mx-auto"
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
              onClick={() => setActiveSection(key)}
            >
              <span className="dash-nav-icon">{icon}</span>
              {label}
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
            <button className="dash-t-btn" style={{ position: 'relative' }}>
              🔔 Notificaciones
              <span className="dash-notif-dot" />
            </button>
            <button className="dash-t-btn primary">💬 Bandeja de entrada</button>
            
            <Link href="/paciente/perfil" className="dash-avatar-link">
              <button className="dash-s-avatar">
                {userName[0]}
              </button>
            </Link>
            
            <div>
              <div className="dash-s-name">{userName}</div>
              <div className="dash-s-role">Paciente</div>
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="dash-content">
          {activeSection === 'home' && (
            <SectionHome onStart={() => setActiveSection('rutina')} />
          )}
          {activeSection === 'rutina'   && <SectionRutina />}
          {activeSection === 'citas'    && <SectionCitas />}
          {activeSection === 'progreso' && <SectionProgreso />}
        </div>
      </div>
    </div>
  )
}
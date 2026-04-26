'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

import { FisioSectionHome } from '@/app/(dashboard)/fisio/sections/FisioSectionHome'
import { FisioSectionPacientes } from '@/app/(dashboard)/fisio/sections/FisioSectionPacientes'
import { FisioSectionAgenda } from '@/app/(dashboard)/fisio/sections/FisioSectionAgenda'
import { FisioSectionRutinas } from '@/app/(dashboard)/fisio/sections/FisioSectionRutinas'
import { FisioSectionClinica } from '@/app/(dashboard)/fisio/sections/FisioSectionClinica'
import { FisioSectionReportes } from '@/app/(dashboard)/fisio/sections/FisioSectionReportes'

// ── 1. Agregar 'notificaciones' al tipo ──────────────────────────────────────
type Section = 'home' | 'pacientes' | 'agenda' | 'rutinas' | 'mensajes' | 'clinica' | 'reportes' | 'notificaciones'

export default function FisioDashPage() {
  const [userName, setUserName]         = useState('Fisioterapeuta')
  const [activeSection, setActiveSection] = useState<Section>('home')
  const [notifCount, setNotifCount]     = useState(0)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('perfil')
        .select('nombre')
        .eq('id_perfil', user.id)
        .maybeSingle()

      if (perfil?.nombre) setUserName(perfil.nombre)

      const { data } = await supabase
        .from('notificacion')
        .select('id_notificacion')
        .eq('id_perfil', user.id)
        .is('deleted_at', null)
        .not('estado', 'ilike', 'leida')

      setNotifCount(data?.length ?? 0)
    }
    getProfile()
  }, [])

  const todayStr = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── 2. Agregar notificaciones al nav ─────────────────────────────────────────
  const navItems: { key: Section; icon: string; label: string }[] = [
    { key: 'home',            icon: '🏠', label: 'Inicio'          },
    { key: 'pacientes',       icon: '🧑‍🦽', label: 'Mis pacientes'   },
    { key: 'agenda',          icon: '📅', label: 'Agenda'          },
    { key: 'rutinas',         icon: '🏋️', label: 'Rutinas'         },
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
      case 'notificaciones': return <ComingSoon label="Notificaciones" icon="🔔" />
      case 'clinica':        return <FisioSectionClinica />
      case 'reportes':       return <FisioSectionReportes/>
    }
  }

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

              {/* ── 3. Badge en sidebar solo en notificaciones ── */}
              {key === 'notificaciones' && notifCount > 0 && (
                <span style={{
                  marginLeft: 'auto', background: '#E74C3C', color: '#fff',
                  borderRadius: '12px', padding: '1px 7px',
                  fontSize: '0.7rem', fontWeight: 700,
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}

              {activeSection === key && <div className="dash-nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-sf-hint">Kairós · Fisioterapeutas</div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="dash-main">

        {/* TOPBAR */}
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <div className="dash-topbar-title">Hola, Dr. {userName} 👋</div>
            <div className="dash-topbar-sub">{todayStr}</div>
          </div>

          <div className="dash-topbar-actions">

            {/* ── 4. Botón topbar navega a 'notificaciones', no a 'mensajes' ── */}
            <button
              className="dash-t-btn"
              style={{ position: 'relative' }}
              onClick={() => setActiveSection('notificaciones')}
            >
              🔔 Notificaciones
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: '4px', right: '4px',
                  background: '#E74C3C', color: '#fff', borderRadius: '50%',
                  width: '16px', height: '16px', fontSize: '0.6rem',
                  fontWeight: 700, display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            <button
              className="dash-t-btn primary"
              onClick={() => setActiveSection('mensajes')}
            >
              💬 Mensajes
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

        {/* CONTENT */}
        <div className="dash-content">
          {renderSection()}
        </div>
      </div>
    </div>
  )
}

function ComingSoon({ label, icon }: { label: string; icon: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', gap: '12px', opacity: 0.4,
    }}>
      <span style={{ fontSize: '3rem' }}>{icon}</span>
      <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{label}</div>
      <div style={{ fontSize: '0.85rem' }}>Próximamente</div>
    </div>
  )
}
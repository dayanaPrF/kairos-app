'use client'
import React, { useState, ReactNode } from 'react';
import { 
  Home, Dumbbell, Calendar, BarChart3, User, 
  Settings, LogOut, Bell, Search, PlayCircle 
} from 'lucide-react';

/* --- Interfaces para TypeScript (Evita el error de 'any') --- */
interface NavLinkProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
}

interface PhaseItemProps {
  name: string;
  progress: number;
  status: string;
  color: string;
  muted?: boolean;
}

/* --- Subcomponentes usando tus clases de globals.css --- */
const NavLink = ({ icon, label, active = false }: NavLinkProps) => (
  <button className={`nav-item ${active ? 'active' : ''}`}>
    <span className="nico">{icon}</span>
    {label}
  </button>
);

const PhaseItem = ({ name, progress, status, color, muted = false }: PhaseItemProps) => (
  <div className="phase-list" style={{ opacity: muted ? 0.5 : 1 }}>
    <div className="phase-row">
      <div className="ph-info">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong style={{ color: 'var(--text)', fontSize: '0.85rem' }}>{name}</strong>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: color.includes('--') ? `var(${color})` : color }}>
            {status}
          </span>
        </div>
        <div className="st-bar" style={{ marginTop: '8px' }}>
          <div 
            className="st-bar-fill" 
            style={{ 
              width: `${progress}%`,
              background: color.includes('--') ? `var(${color})` : color 
            }}
          ></div>
        </div>
      </div>
    </div>
  </div>
);

export default function PacienteDashboard() {
  const [userName] = useState('Dayana');

  return (
    <div id="app" className="active" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      
      {/* HEADER */}
      <header className="top-header">
        <div className="header-brand">
            <div style={{
               width: '32px', height: '32px', background: 'linear-gradient(135deg, var(--blue), var(--lime))',
               borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
               color: 'white', fontWeight: '900'
             }}>K</div>
            <span className="bname">Kairós</span>
        </div>

        <div className="header-search">
          <span className="sico"><Search size={16}/></span>
          <input type="text" placeholder="Buscar ejercicios..." />
        </div>

        <div className="header-right">
          <button className="hbtn"><Bell size={20}/><div className="notif-badge"></div></button>
          <div className="user-chip">
            <div className="user-avatar">{userName.charAt(0)}</div>
            <span className="ucname">{userName} P.</span>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <p className="sidebar-label">Menú</p>
            <NavLink icon={<Home size={18}/>} label="Home" active />
            <NavLink icon={<Dumbbell size={18}/>} label="Ejercicios" />
            <NavLink icon={<Calendar size={18}/>} label="Citas" />
            <NavLink icon={<BarChart3 size={18}/>} label="Progreso" />
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content">
          <div className="page-header">
            <h1 style={{ color: 'var(--blue-dark)', fontWeight: 900 }}>¡Hola, {userName}! 👋</h1>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Martes, 7 de abril de 2026</p>
          </div>

          <div className="stat-strip">
            <div className="stat-tile accent">
              <span className="st-label">Progreso Total</span>
              <span className="st-value">68%</span>
              <span className="st-sub">Fase 2: Fortalecimiento</span>
            </div>
          </div>

          <div className="two-col" style={{ marginTop: '20px' }}>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: '20px' }}>Fases del Tratamiento</h3>
              <PhaseItem name="Fase 1 · Inflamación" progress={100} status="✓ Completada" color="--lime" />
              <div style={{ height: '15px' }}></div>
              <PhaseItem name="Fase 2 · Fortalecimiento" progress={68} status="En curso" color="--blue" />
              <div style={{ height: '15px' }}></div>
              <PhaseItem name="Fase 3 · Funcional" progress={0} status="Pendiente" color="--gray-light" muted />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
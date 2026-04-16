'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Image from 'next/image'; 
import Link from 'next/link';

type Section = 'home' | 'rutina' | 'citas' | 'progreso'

export default function PacientePage() {
  const [userName, setUserName] = useState('Paciente')
  const [activeSection, setActiveSection] = useState<Section>('home')

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserName(user.user_metadata?.full_name?.split(' ')[0] || 'Paciente')
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
            <Link href="paciente/perfil" className="dash-avatar-link">
              <button className="dash-s-avatar">
                {userName[0]}
              </button>
            </Link>
            {/*<button className="dash-s-avatar">{userName[0]}</button>*/}
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
          {activeSection === 'rutina'   && <SectionRutina />}
          {activeSection === 'citas'    && <SectionCitas />}
          {activeSection === 'progreso' && <SectionProgreso />}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   SECCIÓN: HOME
══════════════════════════════════════════════ */
function SectionHome({ onStart }: { onStart: () => void }) {
  const weekDays = [
    { d: 'Dom', p: '95%',  s: 'done'  },
    { d: 'Lun', p: '100%', s: 'done'  },
    { d: 'Mar', p: '100%', s: 'done'  },
    { d: 'Mié', p: '87%',  s: 'done'  },
    { d: 'Jue', p: 'Hoy',  s: 'today' },
    { d: 'Vie', p: '—',    s: ''      },
    { d: 'Sáb', p: '—',    s: ''      },
  ]
  
  return (
    <div className="dash-home-grid">

      {/* LEFT COLUMN */}
      <div>
        {/* HERO */}
        <div className="dash-hero">
          <div>
            <div className="dash-hero-label">Objetivo de hoy</div>
            <h2>Rutina de Fortalecimient de<br />hombros y brazos</h2>
            <p>Sesión de 40 min aprox· Enfocada en rango de movimiento</p>
            {/*<button className="dash-btn-start">▶ Comenzar sesión</button>*/}
            <button className="dash-btn-start" onClick={onStart}>
              ▶ Comenzar sesión
            </button>
          </div>
          <div className="dash-hero-emoji">🧘‍♂️</div>
        </div>

        {/* SEMANA */}
        <div className="dash-card">
          <div className="dash-card-title">Resumen de la semana</div>
          <div className="dash-week-grid">
            {weekDays.map((item, i) => (
              <div key={i} className={`dash-wc ${item.s}`}>
                <span className="dash-wc-day">{item.d}</span>
                <span className="dash-wc-pct">{item.p}</span>
                <div className="dash-wc-dot" />
              </div>
            ))}
          </div>
        </div>

        {/* STATS */}
        <div className="dash-stats-strip">
          <div className="dash-stat-tile">
            <span className="dash-st-label">Racha actual</span>
            <span className="dash-st-value">12</span>
            <span className="dash-st-sub">Días consecutivos</span>
          </div>
          <div className="dash-stat-tile accent">
            <span className="dash-st-label">Progreso total</span>
            <span className="dash-st-value">68%</span>
            <div className="dash-st-bar">
              <div className="dash-st-bar-fill" style={{ width: '68%' }} />
            </div>
            <span className="dash-st-sub">Semana 6 / 12</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div>
        {/* NOTA FISIO */}
        <div className="dash-note-card">
          <div className="dash-nc-header">
            <div className="dash-nc-ava">👨‍⚕️</div>
            <div>
              <div className="dash-nc-name">Dr. Sebastián Rosales</div>
              <div className="dash-nc-role">Fisioterapeuta · UNAM</div>
            </div>
          </div>
          <p className="dash-nc-body">
            Juan, recuerda realizar las elevaciones laterales de forma lenta y controlada.
            Si sientes un pinchazo agudo, reduce el ángulo a 80°. Nos vemos el viernes.
          </p>
          <span className="dash-tag-more">Ver más notas →</span>
        </div>

        {/* CITA */}
        <div className="dash-appt-card">
          <div className="dash-card-title">Próxima cita</div>
          <div className="dash-appt-row">
            <div className="dash-adb">
              <span className="dash-adb-day">27</span>
              <span className="dash-adb-mon">FEB</span>
            </div>
            <div>
              <div className="dash-ai-title">Sesión presencial</div>
              <div className="dash-ai-sub">Viernes · 16:00 hrs · Clínica Central</div>
            </div>
            <span className="dash-badge prox" style={{ marginLeft: 'auto' }}>Próxima</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   SECCIÓN: RUTINA (Integrando PoseSelector)
══════════════════════════════════════════════ */
function SectionRutina() {
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  
  // Importamos los ejercicios reales que configuraron tus amigos
  // Asegúrate de que la ruta a ALL_POSES sea correcta según tu estructura
  const { ALL_POSES } = require("../../lib/poses"); 

  return (
    <>
      <div className="dash-page-header">
        <div className="dash-page-title">Mi Rutina</div>
        <div className="dash-page-sub">Selecciona un ejercicio de la biblioteca de Kairós</div>
      </div>

      <div className='dash-sec-label-rutine'>
        Sesiones de hoy: {ALL_POSES.length} ejercicios disponibles
      </div>
      
      <div className="dash-sec-label">Biblioteca de Ejercicios IA</div>
      
      <div className="dash-routine-list">
        {ALL_POSES.map((pose: any) => (
          <div 
            key={pose.id} 
            className="dash-ri" 
            style={{ 
              cursor: 'pointer',
              borderLeft: selectedExercise?.id === pose.id ? '4px solid var(--lime)' : 'none' 
            }} 
            onClick={() => setSelectedExercise(pose)}
          >
            {/* Usamos el icono que viene en el archivo de tus amigos */}
            <div className="dash-ri-icon" style={{ fontSize: '1.5rem' }}>
              {pose.icon || "🧘"}
            </div>
            
            <div style={{ flex: 1 }}>
              <div className="dash-ri-title">{pose.name}</div>
              <div className="dash-ri-sub">
                {pose.keypoints.length} puntos de control monitoreados
              </div>
            </div>

            <span className="dash-ri-badge pending">Disponible</span>
          </div>
        ))}
      </div>

      {/* ── MODAL DE LANZAMIENTO ── */}
      {selectedExercise && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-icon-badge">{selectedExercise.icon || "🧘"}</div>
              <div style={{ flex: 1 }}>
                <h3 className="modal-title">{selectedExercise.name}</h3>
                <p className="modal-subtitle">IA de Visión Computacional Lista</p>
              </div>
              <button className="modal-close" onClick={() => setSelectedExercise(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="doc-note-box">
                <div className="doc-note-header">
                  <span>ℹ️ Descripción del ejercicio</span>
                </div>
                <p className="doc-note-text" style={{ marginBottom: '15px' }}>
                  {selectedExercise.description}
                </p>
                <div className="doc-tip" style={{ background: 'var(--blue-xlight)', border: '1px solid var(--blue-light)' }}>
                  <strong>Configuración:</strong> El sistema validará {selectedExercise.keypoints.length} ángulos en tiempo real con un margen de {selectedExercise.globalMarginDeg}° grados.
                </div>
              </div>

              <div className="exercise-preview-mock" style={{ background: 'var(--blue-deep)', color: 'var(--lime)' }}>
                <div className="play-circle" style={{ borderColor: 'var(--lime)', color: 'var(--lime)' }}>📷</div>
                <span>Se requiere acceso a la cámara</span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-modal-back" onClick={() => setSelectedExercise(null)}>
                Regresar
              </button>
              
              {/* Pasamos el ejercicio seleccionado a la pantalla de la cámara */}
              <Link 
                href={`/paciente/rehabilitacion?id=${selectedExercise.id}`} 
                className="btn-modal-start"
              >
                Comenzar ahora →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
/* ══════════════════════════════════════════════
   SECCIÓN: CITAS
══════════════════════════════════════════════ */
function SectionCitas() {
  const proximas = [
    {
      fecha: 'Viernes, 27 de Febrero',
      hora: '16:00',
      tipo: 'Sesión Presencial',
      lugar: 'Clínica Central · Dr. Rosales',
      badgeClass: 'prox',
      badgeLabel: 'Próxima',
    },
    {
      fecha: 'Miércoles, 5 de Marzo',
      hora: '11:30',
      tipo: 'Evaluación de Progreso',
      lugar: 'Módulo 3 · Dr. Rosales',
      badgeClass: 'agendada',
      badgeLabel: 'Agendada',
    },
  ]

  return (
    <>
      <div className="dash-page-header">
        <div className="dash-page-title">Mis Citas</div>
        <div className="dash-page-sub">Historial y próximas sesiones</div>
      </div>

      <div className="dash-sec-label">Próximas</div>
      <div className="dash-cita-grid">
        {proximas.map((c, i) => (
          <div key={i} className="dash-cita-card">
            <div className="dash-cita-head">
              <span className="dash-cita-fecha">{c.fecha}</span>
              <span className={`dash-badge ${c.badgeClass}`}>{c.badgeLabel}</span>
            </div>
            <div className="dash-cita-body">
              <div className="dash-cita-time">
                <div className="dash-ct-hour">{c.hora}</div>
                <div className="dash-ct-period">HRS</div>
              </div>
              <div>
                <div className="dash-ci-title">{c.tipo}</div>
                <div className="dash-ci-place">📍 {c.lugar}</div>
              </div>
            </div>
            <button className="dash-btn-sm">Ver detalles completos</button>
          </div>
        ))}
      </div>

      <div className="dash-sec-label">Historial</div>
      <div style={{ opacity: 0.75 }}>
        <div className="dash-cita-card" style={{ maxWidth: 460 }}>
          <div className="dash-cita-head">
            <span className="dash-cita-fecha">Miércoles, 19 de Febrero</span>
            <span className="dash-badge pasada">Completada</span>
          </div>
          <div className="dash-cita-body">
            <div className="dash-cita-time">
              <div className="dash-ct-hour">10:00</div>
              <div className="dash-ct-period">HRS</div>
            </div>
            <div>
              <div className="dash-ci-title">Sesión de Seguimiento</div>
              <div className="dash-ci-place">📍 Clínica Central · Dr. Rosales</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════
   SECCIÓN: PROGRESO
══════════════════════════════════════════════ */
function SectionProgreso() {
  const indicadores = [
    { nombre: 'Rango de movimiento', valor: 82, tipo: 'blue' },
    { nombre: 'Fuerza muscular',     valor: 61, tipo: 'blue' },
    { nombre: 'Control del dolor',   valor: 90, tipo: 'lime' },
    { nombre: 'Adherencia semanal',  valor: 95, tipo: 'lime' },
  ]

  return (
    <>
      <div className="dash-page-header">
        <div className="dash-page-title">Mi Progreso</div>
        <div className="dash-page-sub">Rehabilitación de Hombro · Semana 6 / 12</div>
      </div>

      <div className="dash-prog-layout">
        {/* HERO CIRCLE */}
        <div className="dash-prog-hero">
          <div className="dash-ph-label">Progreso global</div>
          <div className="dash-ph-circle">
            <div className="dash-ph-pct">68%</div>
            <div className="dash-ph-sub">completado</div>
          </div>
          <p className="dash-ph-desc">
            ¡Vas muy bien! Mantén la racha de{' '}
            <strong>12 días</strong> consecutivos para acelerar tu recuperación.
          </p>
        </div>

        {/* INDICATORS */}
        <div>
          <div className="dash-card">
            <div className="dash-card-title">Indicadores de recuperación</div>
            <div className="dash-prog-bars">
              {indicadores.map((ind, i) => (
                <div key={i}>
                  <div className="dash-pb-header">
                    <span className="dash-pb-name">{ind.nombre}</span>
                    <span className={`dash-pb-val ${ind.tipo}`}>{ind.valor}%</span>
                  </div>
                  <div className="dash-pb-track">
                    <div
                      className={`dash-pb-fill ${ind.tipo}`}
                      style={{ width: `${ind.valor}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-prog-stats">
            <div className="dash-stat-tile">
              <span className="dash-st-label">Sesiones</span>
              <span className="dash-st-value">28</span>
              <span className="dash-st-sub">Completadas</span>
            </div>
            <div className="dash-stat-tile">
              <span className="dash-st-label">Racha máxima</span>
              <span className="dash-st-value">12</span>
              <span className="dash-st-sub">Días seguidos 🏅</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
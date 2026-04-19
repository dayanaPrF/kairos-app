'use client'

export function SectionHome({ onStart }: { onStart: () => void }) {
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
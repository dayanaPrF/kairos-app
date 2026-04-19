'use client'

export function SectionCitas() {
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
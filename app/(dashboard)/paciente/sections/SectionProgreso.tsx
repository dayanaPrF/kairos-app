'use client'

export function SectionProgreso() {
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
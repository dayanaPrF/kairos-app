'use client'
import { useState } from 'react'
import { useHomeData } from '@/hooks/Usehomedata'

// ── helpers ────────────────────────────────────────────────────────────────────
function formatFecha(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return {
    dia:  d.getDate().toString(),
    mes:  d.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase(),
    diaSemana: d.toLocaleDateString('es-MX', { weekday: 'long' }),
  }
}

// ── Componente ─────────────────────────────────────────────────────────────────
export function SectionHome({ onStart }: { onStart: () => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const {
    rutina, semana, rachaActual, progresoTotal,
    fisio, proximaCita, loading, error
  } = useHomeData()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', opacity: 0.4 }}>
      Cargando...
    </div>
  )

  if (error) return (
    <div style={{ padding: '20px', color: 'red', fontSize: '0.85rem' }}>
      Error al cargar datos: {error}
    </div>
  )

  return (
    <div className="dash-home-grid">
      {/* ── COLUMNA IZQUIERDA ── */}
      <div>
        <div className="dash-hero">
          <div>
            <div className="dash-hero-label">Objetivo de hoy</div>
            {rutina ? (
              <>
                <h2>{rutina.nombre}</h2>
                <p>
                  Sesión de {rutina.duracion} min aprox
                  · {rutina.totalEjercicios} ejercicios
                </p>
              </>
            ) : (
              <>
                <h2>Sin rutina activa</h2>
                <p>Tu fisioterapeuta aún no te ha asignado una rutina.</p>
              </>
            )}
            <button
              className="dash-btn-start"
              onClick={onStart}
              disabled={!rutina}
              style={{ opacity: rutina ? 1 : 0.4, cursor: rutina ? 'pointer' : 'not-allowed' }}
            >
              ▶ Comenzar sesión
            </button>
          </div>
          <div className="dash-hero-emoji">🧘‍♂️</div>
        </div>

        <div className="dash-card">
          <div className="dash-card-title">Resumen de la semana</div>
          <div className="dash-week-grid">
            {semana.map((item, i) => {
              const status =
                item.esHoy                       ? 'today'
                : item.porcentaje === 100        ? 'done'
                : item.porcentaje !== null       ? 'partial'
                : ''
              const label =
                item.esHoy                       ? 'Hoy'
                : item.porcentaje !== null       ? `${item.porcentaje}%`
                : '—'
              return (
                <div key={i} className={`dash-wc ${status}`}>
                  <span className="dash-wc-day">{item.dia}</span>
                  <span className="dash-wc-pct">{label}</span>
                  <div className="dash-wc-dot" />
                </div>
              )
            })}
          </div>
        </div>

        <div className="dash-stats-strip">
          <div className="dash-stat-tile">
            <span className="dash-st-label">Racha actual</span>
            <span className="dash-st-value">{rachaActual}</span>
            <span className="dash-st-sub">Días consecutivos</span>
          </div>
          <div className="dash-stat-tile accent">
            <span className="dash-st-label">Progreso total</span>
            <span className="dash-st-value">{progresoTotal}%</span>
            <div className="dash-st-bar">
              <div className="dash-st-bar-fill" style={{ width: `${progresoTotal}%` }} />
            </div>
            {rutina && (
              <span className="dash-st-sub">
                Semana {rutina.semanaActual} / {rutina.totalSemanas}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── COLUMNA DERECHA ── */}
      <div>
        <div className="dash-note-card">
          <div className="dash-nc-header">
            <div className="dash-nc-ava">👨‍⚕️</div>
            <div>
              {fisio ? (
                <>
                  <div className="dash-nc-name">{fisio.nombre}</div>
                  <div className="dash-nc-role">
                    {[fisio.especialidad, fisio.universidad].filter(Boolean).join(' · ')}
                  </div>
                </>
              ) : (
                <>
                  <div className="dash-nc-name">Sin fisioterapeuta asignado</div>
                  <div className="dash-nc-role">Se asignará al agendar tu primera cita</div>
                </>
              )}
            </div>
          </div>

          {fisio?.notaReciente ? (
            <p className="dash-nc-body">{fisio.notaReciente}</p>
          ) : (
            <p className="dash-nc-body" style={{ opacity: 0.45, fontStyle: 'italic' }}>
              {fisio
                ? 'Aún no hay notas de tu fisioterapeuta.'
                : 'Las notas aparecerán aquí después de tu primera consulta.'}
            </p>
          )}
          <span 
            className="dash-tag-more" 
            onClick={() => setIsModalOpen(true)}
            style={{ cursor: fisio ? 'pointer' : 'default', opacity: fisio ? 1 : 0.5 }}
          >
            Ver más notas →
          </span>
        </div>

        <div className="dash-appt-card">
          <div className="dash-card-title">Próxima cita</div>
          {proximaCita ? (() => {
            const { dia, mes, diaSemana } = formatFecha(proximaCita.fecha)
            return (
              <div className="dash-appt-row">
                <div className="dash-adb">
                  <span className="dash-adb-day">{dia}</span>
                  <span className="dash-adb-mon">{mes}</span>
                </div>
                <div>
                  <div className="dash-ai-title">{proximaCita.motivo}</div>
                  <div className="dash-ai-sub">
                    {diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}
                    {' · '}{proximaCita.horaInicio} – {proximaCita.horaFin} hrs
                    {' · '}{proximaCita.clinica}
                  </div>
                </div>
                <span className="dash-badge prox" style={{ marginLeft: 'auto' }}>
                  {proximaCita.estado === 'confirmada' ? 'Confirmada' : 'Próxima'}
                </span>
              </div>
            )
          })() : (
            <div style={{ padding: '16px 0', opacity: 0.45, fontSize: '0.85rem', fontStyle: 'italic' }}>
              No tienes citas programadas próximamente.
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL DE NOTAS (NOTAS_CITA) ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Historial de Notas de Citas</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Se accede mediante casting para mapear notas_cita[cite: 1, 3] */}
              {(fisio as any)?.historialNotas && (fisio as any).historialNotas.length > 0 ? (
                (fisio as any).historialNotas.map((cita: any, idx: number) => (
                  <div key={idx} className="nota-item">
                    <span className="nota-fecha">
                      {cita.fecha_cita ? new Date(cita.fecha_cita).toLocaleDateString() : 'Fecha no disponible'}
                    </span>
                    <p className="nota-texto">{cita.notas_cita}</p>
                  </div>
                ))
              ) : (
                <div className="no-notes-fallback">
                  {fisio?.notaReciente ? (
                    <>
                      <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '10px' }}>
                        Nota de la última cita:
                      </p>
                      <div className="nota-item">
                        <span className="nota-fecha">Nota Actual</span>
                        <p className="nota-texto">{fisio.notaReciente}</p>
                      </div>
                    </>
                  ) : (
                    <p className="no-notes">No hay historial de notas en tus citas pasadas.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(2px);
        }
        .modal-content {
          background: white;
          padding: 24px;
          border-radius: 16px;
          width: 90%;
          max-width: 450px;
          max-height: 70vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          color: #333;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          border-bottom: 1px solid #eee;
          padding-bottom: 12px;
        }
        .modal-header h3 { margin: 0; font-size: 1.1rem; color: #111; font-weight: 700; }
        .close-btn {
          background: #f0f0f0;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          width: 32px; height: 32px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .nota-item {
          padding: 15px 0;
          border-bottom: 1px solid #fafafa;
        }
        .nota-fecha {
          font-size: 0.7rem;
          text-transform: uppercase;
          color: #999;
          font-weight: 700;
          display: block;
          margin-bottom: 4px;
        }
        .nota-texto {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.5;
          color: #444;
        }
        .no-notes {
          text-align: center;
          padding: 40px 20px;
          opacity: 0.5;
          font-style: italic;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  )
}
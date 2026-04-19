'use client'

import { useState } from 'react'
import Link from 'next/link'

export function SectionRutina() {
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  
  // Importamos los ejercicios reales que configuraron tus amigos
  // Asegúrate de que la ruta a ALL_POSES sea correcta según tu estructura
  const { ALL_POSES } = require("../../../lib/poses"); 

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
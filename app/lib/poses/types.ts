// Tipos para poses dinámicas desde Supabase

export interface LandmarkPoint {
  x: number
  y: number
  z: number
  visibility?: number
}

// Una articulación dentro de una pose (tal como viene de Supabase)
export interface PoseArticulacionDB {
  id_articulacion: string
  nombre_articulacion: string
  angulo: number       // ángulo objetivo
  tolerancia: number   // ±tolerancia
}

// Una pose completa tal como viene del JSONB de Supabase
export interface PoseDB {
  orden: number
  nombre: string
  hold_sec: number
  articulaciones: PoseArticulacionDB[]
}

// Config de articulación de la tabla ai_articulacion_config
export interface ArticulacionConfig {
  id_articulacion: string
  nombre_articulacion: string
  puntos_mediapipe: string[]  // [idx_A, idx_B_vertice, idx_C]
}

// ── Formato interno que usa validatePose ──────────────────────────────────────

export interface KeypointRule {
  landmark: number    // índice MediaPipe del vértice (B)
  relativeTo: number  // índice MediaPipe del punto A
  anchor: number      // índice MediaPipe del punto C
  minAngle: number    // angulo - tolerancia
  maxAngle: number    // angulo + tolerancia
  nombreArticulacion: string
}

// Una pose ya "compilada" lista para validar
export interface PoseCompiledStep {
  orden: number
  nombre: string
  hold_sec: number
  keypoints: KeypointRule[]
}

// El ejercicio completo listo para el detector
export interface EjercicioCompilado {
  id_ejercicio: string
  nombre_ejercicio: string
  descripcion: string | null
  icono: string | null
  repeticiones: number | null
  pasos: PoseCompiledStep[]   // secuencia de poses en orden
}

// Resultado de validación (sin cambios, compatible con poseUtils existente)
export interface ValidationResult {
  isValid: boolean
  score: number
  keypointResults: {
    landmark: number
    passed: boolean
    actual: number | null
    expected: [number, number]
    nombreArticulacion?: string
  }[]
}
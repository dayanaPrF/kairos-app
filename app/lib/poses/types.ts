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
  angulo: number
  tolerancia: number
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
  puntos_mediapipe: string[]
}

// ── Formato interno que usa validatePose ──────────────────────────────────────

export interface KeypointRule {
  landmark: number
  relativeTo: number
  anchor: number
  minAngle: number
  maxAngle: number
  nombreArticulacion: string
}

// Una pose ya "compilada" lista para validar
export interface PoseCompiledStep {
  orden: number
  nombre: string
  hold_sec: number
  keypoints: KeypointRule[]
  imagen_url: string | null   // imagen de referencia del catálogo; null = mostrar muñequito
}

// El ejercicio completo listo para el detector
export interface EjercicioCompilado {
  id_ejercicio: string
  nombre_ejercicio: string
  descripcion: string | null
  icono: string | null
  repeticiones: number | null
  pasos: PoseCompiledStep[]
}

// Resultado de validación
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
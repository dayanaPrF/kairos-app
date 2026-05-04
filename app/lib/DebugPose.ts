/**
 * HERRAMIENTA DE DEBUG — pegar temporalmente en el loop de MediaPipe
 * dentro de PoseDetector, justo después de detectForVideo.
 *
 * Imprime en consola los ángulos reales de las articulaciones configuradas
 * para que puedas comparar contra lo que tienes guardado en Supabase.
 *
 * Uso:
 *   1. Agrega debugAngulos(mirrored, pasoRef.current) en el loop
 *   2. Haz la pose frente a la cámara
 *   3. Lee los ángulos en consola
 *   4. Actualiza los valores en Supabase si hay diferencia
 *   5. Elimina este import cuando ya no lo necesites
 */

import type { LandmarkPoint, PoseCompiledStep } from './poses/types'
import { angleBetween } from './poseUtils'

let lastDebugTime = 0

export function debugAngulos(
  landmarks: LandmarkPoint[],
  paso: PoseCompiledStep,
  intervalMs = 1000
): void {
  const now = Date.now()
  if (now - lastDebugTime < intervalMs) return
  lastDebugTime = now

  console.groupCollapsed(`[PoseDebug] ${paso.nombre} — ${new Date().toLocaleTimeString()}`)
  for (const kp of paso.keypoints) {
    const a = landmarks[kp.relativeTo]
    const b = landmarks[kp.landmark]
    const c = landmarks[kp.anchor]

    if (!a || !b || !c) {
      console.warn(`  ⚠ ${kp.nombreArticulacion}: landmark no disponible (idx ${kp.relativeTo}, ${kp.landmark}, ${kp.anchor})`)
      continue
    }

    const vis = [a.visibility, b.visibility, c.visibility].map(v => v !== undefined ? v.toFixed(2) : 'n/a')
    const angle = angleBetween(a, b, c)
    const ok    = angle >= kp.minAngle && angle <= kp.maxAngle

    console.log(
      `  ${ok ? '✅' : '❌'} ${kp.nombreArticulacion}:`,
      `actual=${angle.toFixed(1)}°`,
      `objetivo=[${kp.minAngle}°–${kp.maxAngle}°]`,
      `vis=(${vis.join(', ')})`
    )
  }
  console.groupEnd()
}


// ─── Puntos MediaPipe de referencia ──────────────────────────────────────────
// Usar estos índices para verificar que tu ai_articulacion_config sea correcto
//
// 11 = hombro izquierdo    12 = hombro derecho
// 13 = codo izquierdo      14 = codo derecho
// 15 = muñeca izquierda    16 = muñeca derecha
// 23 = cadera izquierda    24 = cadera derecha
// 25 = rodilla izquierda   26 = rodilla derecha
// 27 = tobillo izquierdo   28 = tobillo derecho
//
// Para CODO DERECHO el ángulo es: hombro(12) → codo(14) → muñeca(16)
//   relativeTo = 12, landmark = 14, anchor = 16
//
// Para HOMBRO DERECHO: cadera(24) → hombro(12) → codo(14)  [o muñeca]
//   relativeTo = 24, landmark = 12, anchor = 14
//
// Verifica que tus registros en ai_articulacion_config tengan
// puntos_mediapipe = [A, B_vertice, C] en ese orden.
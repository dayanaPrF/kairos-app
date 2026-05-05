/**
 * CONVERSIÓN DE ÁNGULOS: Muñequito → MediaPipe
 *
 * RESUMEN DE CONVERSIONES POR ARTICULACIÓN:
 *
 * ─── Hombro ────────────────────────────────────────────────────────────────────
 * Muñequito: 0=arriba, 90=horizontal(T), 180=abajo
 * MediaPipe [muñeca, hombro, cadera]:
 *   - Hombro IZQUIERDO: vector muñeca apunta hacia X positivo al subir → coincide
 *   - Hombro DERECHO:   vector muñeca apunta hacia X negativo al subir → espejado
 *
 * Conversión:
 *   Izquierdo: angulo_mp = angulo
 *   Derecho:   angulo_mp = 180 - angulo
 *
 * ─── Codo ──────────────────────────────────────────────────────────────────────
 * Ambos usan ángulo interior → COINCIDEN en ambos lados
 *
 * ─── Rodilla ───────────────────────────────────────────────────────────────────
 * Ambos usan ángulo interior → COINCIDEN en ambos lados
 *
 * ─── Cadera ────────────────────────────────────────────────────────────────────
 * Muñequito: 90=de pie, 0=horizontal adelante
 * MediaPipe [hombro, cadera, rodilla]: 180=de pie, 90=horizontal
 *
 * Conversión:
 *   Izquierdo: angulo_mp = angulo + 90
 *   Derecho:   el hombro de referencia está al lado opuesto →
 *              angulo_mp = 180 - (angulo + 90) = 90 - angulo
 *              (clamp a [0, 180])
 *
 * ─── Tobillo ───────────────────────────────────────────────────────────────────
 * Muñequito desde horizontal → MediaPipe entre tibia y pie
 * Conversión: angulo_mp = angulo + 90 (ambos lados, pie simétrico)
 *
 * ─── Tronco / Cuello ───────────────────────────────────────────────────────────
 * Inclinaciones pequeñas — usar directo
 */

export type ArticulacionTipo =
  | 'hombro'
  | 'codo'
  | 'rodilla'
  | 'cadera'
  | 'tobillo'
  | 'tronco'
  | 'cuello'

/**
 * Detecta el tipo de articulación a partir del nombre en BD.
 */
export function detectarTipo(nombre: string): ArticulacionTipo | null {
  const n = nombre.toLowerCase()
  if (n.includes('hombro'))  return 'hombro'
  if (n.includes('codo'))    return 'codo'
  if (n.includes('rodilla')) return 'rodilla'
  if (n.includes('cadera'))  return 'cadera'
  if (n.includes('tobillo')) return 'tobillo'
  if (n.includes('tronco'))  return 'tronco'
  if (n.includes('cuello'))  return 'cuello'
  return null
}

/**
 * Convierte el ángulo guardado desde el muñequito al ángulo real
 * que mide angleBetween con los landmarks de MediaPipe.
 *
 * Aplica esta conversión en el compiler, no en runtime.
 */
export function convertirAnguloMunequitoAMediaPipe(
  angulo: number,
  nombreArticulacion: string
): number {
  const tipo = detectarTipo(nombreArticulacion)
  const n    = nombreArticulacion.toLowerCase()
  const esDerecho = n.includes('derecho') || n.includes('der')

  switch (tipo) {
    case 'hombro':
      // Hombro derecho: vector muñeca apunta al lado opuesto → espejar
      // Hombro izquierdo: coincide directo
      return esDerecho ? 180 - angulo : angulo

    case 'codo':
      // Ángulo interior — coincide en ambos lados
      return angulo

    case 'rodilla':
      // Ángulo interior — coincide en ambos lados
      return angulo

    case 'cadera':
      // Muñequito: 90=de pie, 0=horizontal → MediaPipe: 180=de pie, 90=horizontal
      // Izquierdo: +90 offset
      // Derecho: el hombro de referencia está al lado contrario → 90 - angulo
      if (esDerecho) {
        return Math.max(0, Math.min(180, 90 - angulo))
      }
      return Math.max(0, Math.min(180, angulo + 90))

    case 'tobillo':
      // Simétrico en ambos lados
      return Math.max(0, Math.min(180, angulo + 90))

    case 'tronco':
    case 'cuello':
      return angulo

    default:
      return angulo
  }
}
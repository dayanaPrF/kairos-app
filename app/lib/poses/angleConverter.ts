/**
 * CONVERSIÓN DE ÁNGULOS: Muñequito → MediaPipe
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CÓMO MIDE MEDIAPIPE CADA ARTICULACIÓN
 * angleBetween(A, B, C) = ángulo en el vértice B entre vectores BA y BC
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── HOMBRO  [muñeca(A), hombro(B), cadera(C)] ────────────────────────────
 *   Brazo abajo (reposo) → ~180°   Brazo horizontal (T) → ~90°
 *   Brazo arriba         → ~0°
 *   Muñequito: 0=arriba, 90=T, 180=abajo → coincide 1:1 con MP izquierdo
 *   Derecho: la cadera C está al lado contrario → ángulo espejado
 *     angulo_mp = 180 - angulo
 *
 * ── CODO  [hombro(A), codo(B), muñeca(C)] ────────────────────────────────
 *   Extendido → ~180°   Flexión 90° → ~90°   Máxima flexión → ~30°
 *   Muñequito: 180=extendido, 0=máxima flexión → coincide 1:1, ambos lados
 *   → sin conversión
 *
 * ── RODILLA  [cadera(A), rodilla(B), tobillo(C)] ─────────────────────────
 *   Extendida → ~180°   Flexión 90° → ~90°   Máxima flexión → ~30°
 *   Muñequito: 180=extendida, 0=máxima flexión → coincide 1:1, ambos lados
 *   → sin conversión
 *
 * ── CADERA  [hombro(A), cadera(B), rodilla(C)] ───────────────────────────
 *   De pie erguido → ~180°   Flexión de cadera 90° → ~90°
 *   Muñequito: 90=de pie, 0=horizontal adelante
 *   → Izquierdo: angulo_mp = angulo + 90
 *   → Derecho:   el hombro A está al lado contrario
 *                angulo_mp = 90 - angulo  (clamp [0, 180])
 *
 * ── TOBILLO  [rodilla(A), tobillo(B), pie(C)] ────────────────────────────
 *   Neutro anatómico → ~90°   Dorsiflexión → >90°   Plantar → <90°
 *   Muñequito: 90=neutro, >90=dorsiflexión, <90=plantar → coincide 1:1
 *   → sin conversión
 *
 * ── TRONCO / CUELLO ───────────────────────────────────────────────────────
 *   Inclinaciones pequeñas → pasar directo
 * ════════════════════════════════════════════════════════════════════════════
 */

export type ArticulacionTipo =
  | 'hombro'
  | 'codo'
  | 'rodilla'
  | 'cadera'
  | 'tobillo'
  | 'tronco'
  | 'cuello'

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
 * Convierte el ángulo guardado en el builder (sistema visual del muñequito)
 * al ángulo que realmente mide MediaPipe con angleBetween.
 */
export function convertirAnguloMunequitoAMediaPipe(
  angulo: number,
  nombreArticulacion: string,
): number {
  const tipo      = detectarTipo(nombreArticulacion)
  const n         = nombreArticulacion.toLowerCase()
  const esDerecho = n.includes('derecho') || n.includes('der')

  switch (tipo) {

    case 'hombro':
      // Izquierdo: coincide 1:1
      // Derecho:   la cadera de referencia queda al lado opuesto → espejar
      return esDerecho ? 180 - angulo : angulo

    case 'codo':
      // Ángulo interior hombro→codo→muñeca — igual en ambos lados
      // El muñequito y MP usan el mismo sistema: 180=extendido, 0=flexión máxima
      return angulo

    case 'rodilla':
      // Ángulo interior cadera→rodilla→tobillo — igual en ambos lados
      // El muñequito y MP usan el mismo sistema: 180=extendida, 0=flexión máxima
      return angulo

    case 'cadera':
      // Muñequito: 90=de pie, 0=horizontal
      // MediaPipe: 180=de pie, 90=horizontal  → offset +90
      // Derecho:   hombro de referencia al lado opuesto → 90 - angulo
      if (esDerecho) {
        return Math.max(0, Math.min(180, 90 - angulo))
      }
      return Math.max(0, Math.min(180, angulo + 90))

    case 'tobillo':
      // Muñequito y MP coinciden: 90=neutro, >90=dorsiflexión, <90=plantar
      return angulo

    case 'tronco':
    case 'cuello':
      return angulo

    default:
      return angulo
  }
}
import type { ValidationResult } from './poses/types'

// ─── Mensajes por articulación y dirección ────────────────────────────────────
// Cada articulación tiene instrucciones para cuando el ángulo es muy PEQUEÑO
// (necesitas abrir/estirar) o muy GRANDE (necesitas cerrar/flexionar).

const MENSAJES: Record<string, { pequeño: string[]; grande: string[] }> = {
  codo: {
    pequeño: [
      'Estira el codo un poco más',
      'Extiende el brazo',
      'Abre el codo',
    ],
    grande: [
      'Flexiona el codo',
      'Dobla un poco el brazo',
      'Cierra el codo',
    ],
  },
  hombro: {
    pequeño: [
      'Sube el brazo',
      'Eleva el hombro',
      'Levanta el brazo hacia arriba',
    ],
    grande: [
      'Baja el brazo',
      'Relaja el hombro',
      'Lleva el brazo hacia abajo',
    ],
  },
  rodilla: {
    pequeño: [
      'Dobla más la rodilla',
      'Flexiona la rodilla',
      'Baja un poco más',
    ],
    grande: [
      'Estira la rodilla',
      'Extiende la pierna',
      'Endereza la rodilla',
    ],
  },
  cadera: {
    pequeño: [
      'Inclínate un poco hacia adelante',
      'Flexiona la cadera',
      'Dobla el tronco hacia adelante',
    ],
    grande: [
      'Endereza la espalda',
      'Ponte más recto',
      'Extiende la cadera',
    ],
  },
  tobillo: {
    pequeño: [
      'Dobla el pie hacia arriba',
      'Flexiona el tobillo',
      'Sube la punta del pie',
    ],
    grande: [
      'Baja la punta del pie',
      'Relaja el tobillo',
      'Extiende el pie hacia abajo',
    ],
  },
  muñeca: {
    pequeño: [
      'Flexiona la muñeca',
      'Dobla la mano hacia adentro',
    ],
    grande: [
      'Extiende la muñeca',
      'Estira la mano',
    ],
  },
  cuello: {
    pequeño: [
      'Inclina la cabeza hacia adelante',
      'Baja la barbilla',
    ],
    grande: [
      'Endereza la cabeza',
      'Mira al frente',
    ],
  },
}

// Índice rotatorio para variar mensajes (evitar repetición auditiva)
const msgCounters: Record<string, number> = {}

function nextMsg(key: string, arr: string[]): string {
  if (!msgCounters[key]) msgCounters[key] = 0
  const msg = arr[msgCounters[key] % arr.length]
  msgCounters[key]++
  return msg
}

// ─── Tipos de entrada ──────────────────────────────────────────────────────────
type KeypointResult = ValidationResult['keypointResults'][number]

// ─── Función principal ────────────────────────────────────────────────────────
/**
 * Genera un hint de voz/texto inteligente basado en los keypoints fallidos.
 * Prioriza la articulación con mayor desviación respecto al objetivo.
 *
 * @param keypointResults  Resultado de validatePose
 * @param verbose          Si true, incluye el ángulo numérico (útil para texto)
 */
export function getHint(
  keypointResults: KeypointResult[],
  verbose = false
): string | null {
  // Solo articulaciones que se pudieron medir y que fallaron
  const failed = keypointResults.filter(r => !r.passed && r.actual !== null)
  if (failed.length === 0) return null

  // Ordenar por mayor desviación absoluta al centro del rango objetivo
  const conDesviacion = failed.map(r => {
    const mid       = (r.expected[0] + r.expected[1]) / 2
    const desviacion = Math.abs(r.actual! - mid)
    const esPequeno  = r.actual! < mid
    return { ...r, mid, desviacion, esPequeno }
  }).sort((a, b) => b.desviacion - a.desviacion)

  const peor = conDesviacion[0]
  const nombre = peor.nombreArticulacion?.toLowerCase() ?? ''

  // Buscar la clave de articulación en el mapa de mensajes
  const clave = Object.keys(MENSAJES).find(k => nombre.includes(k))

  let msg: string

  if (clave) {
    const lista = peor.esPequeno
      ? MENSAJES[clave].pequeño
      : MENSAJES[clave].grande
    const msgKey = `${clave}_${peor.esPequeno ? 'p' : 'g'}`
    msg = nextMsg(msgKey, lista)
  } else {
    // Articulación no reconocida — fallback descriptivo
    msg = peor.esPequeno
      ? `Abre más ${peor.nombreArticulacion ?? 'la articulación'}`
      : `Cierra más ${peor.nombreArticulacion ?? 'la articulación'}`
  }

  // Añadir info numérica si se pide (útil para el HUD de texto)
  if (verbose && peor.actual !== null) {
    const faltan = Math.round(Math.abs(peor.actual - peor.mid))
    msg += ` (${faltan}° de diferencia)`
  }

  // Si hay múltiples articulaciones fallidas, mencionar cuántas
  if (failed.length > 1) {
    msg += failed.length === 2 ? ' y ajusta otra articulación' : ` y ${failed.length - 1} más`
  }

  return msg
}

/**
 * Versión corta para síntesis de voz — sin números, más natural.
 */
export function getHintVoz(keypointResults: KeypointResult[]): string | null {
  return getHint(keypointResults, false)
}

/**
 * Versión para el HUD — con números, más informativa.
 */
export function getHintHUD(keypointResults: KeypointResult[]): string | null {
  return getHint(keypointResults, true)
}

/**
 * Resumen de score para mostrar en pantalla.
 * Ej: "2/3 articulaciones correctas"
 */
export function getScoreLabel(keypointResults: KeypointResult[]): string {
  const evaluables = keypointResults.filter(r => r.actual !== null)
  const correctas  = evaluables.filter(r => r.passed).length
  return `${correctas}/${evaluables.length} articulación${evaluables.length !== 1 ? 'es' : ''} correcta${correctas !== 1 ? 's' : ''}`
}
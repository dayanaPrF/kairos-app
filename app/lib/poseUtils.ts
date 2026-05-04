import type { LandmarkPoint, PoseCompiledStep, ValidationResult } from './poses/types'

/**
 * Calcula el ángulo en la articulación B, formado por los vectores BA y BC.
 * Usa producto punto — correcto independientemente de la orientación de los ejes.
 */
export function angleBetween(
  a: LandmarkPoint,
  b: LandmarkPoint,
  c: LandmarkPoint
): number {
  const v1x = a.x - b.x
  const v1y = a.y - b.y
  const v2x = c.x - b.x
  const v2y = c.y - b.y

  const dot  = v1x * v2x + v1y * v2y
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y)
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y)

  if (mag1 < 1e-6 || mag2 < 1e-6) return 0

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
  return (Math.acos(cosAngle) * 180) / Math.PI
}

/**
 * Valida landmarks contra UN paso compilado.
 * Los rangos minAngle/maxAngle ya vienen con tolerancia correcta del compiler.
 */
export function validatePose(
  landmarks: LandmarkPoint[],
  paso: PoseCompiledStep
): ValidationResult {
  const MIN_VISIBILITY = 0.35
  let passed = 0
  const keypointResults: ValidationResult['keypointResults'] = []

  for (const kp of paso.keypoints) {
    const a = landmarks[kp.relativeTo]
    const b = landmarks[kp.landmark]
    const c = landmarks[kp.anchor]

    const invisible =
      !a || !b || !c ||
      (a.visibility !== undefined && a.visibility < MIN_VISIBILITY) ||
      (b.visibility !== undefined && b.visibility < MIN_VISIBILITY) ||
      (c.visibility !== undefined && c.visibility < MIN_VISIBILITY)

    if (invisible) {
      keypointResults.push({
        landmark: kp.landmark,
        passed: false,
        actual: null,
        expected: [kp.minAngle, kp.maxAngle],
        nombreArticulacion: kp.nombreArticulacion,
      })
      continue
    }

    const angle = angleBetween(a, b, c)
    const ok    = angle >= kp.minAngle && angle <= kp.maxAngle
    if (ok) passed++

    keypointResults.push({
      landmark: kp.landmark,
      passed: ok,
      actual: angle,
      expected: [kp.minAngle, kp.maxAngle],
      nombreArticulacion: kp.nombreArticulacion,
    })
  }

  const evaluables = keypointResults.filter(r => r.actual !== null).length
  const score      = evaluables > 0 ? passed / evaluables : 0

  return {
    isValid: score >= 0.75,
    score,
    keypointResults,
  }
}
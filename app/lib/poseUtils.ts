import type { LandmarkPoint, PoseCompiledStep, ValidationResult } from './poses/types'

export function angleBetween(
  a: LandmarkPoint,
  b: LandmarkPoint,
  c: LandmarkPoint
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let deg = Math.abs((radians * 180) / Math.PI)
  if (deg > 180) deg = 360 - deg
  return deg
}

/** Valida landmarks contra UN paso (pose) del ejercicio compilado */
export function validatePose(
  landmarks: LandmarkPoint[],
  paso: PoseCompiledStep
): ValidationResult {
  let passed = 0
  const keypointResults: ValidationResult['keypointResults'] = []

  for (const kp of paso.keypoints) {
    const a = landmarks[kp.relativeTo]
    const b = landmarks[kp.landmark]
    const c = landmarks[kp.anchor]

    if (!a || !b || !c) {
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
    const ok = angle >= kp.minAngle && angle <= kp.maxAngle
    if (ok) passed++

    keypointResults.push({
      landmark: kp.landmark,
      passed: ok,
      actual: angle,
      expected: [kp.minAngle, kp.maxAngle],
      nombreArticulacion: kp.nombreArticulacion,
    })
  }

  const score = paso.keypoints.length > 0 ? passed / paso.keypoints.length : 0
  return {
    isValid: score >= 0.85,
    score,
    keypointResults,
  }
}
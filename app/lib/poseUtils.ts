import { LandmarkPoint, PoseDefinition, ValidationResult } from "./poses/types"

/** Calcula el ángulo en grados formado por tres puntos: A-B-C donde B es el vértice */
export function angleBetween(
  a: LandmarkPoint,
  b: LandmarkPoint,
  c: LandmarkPoint
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs((radians * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

/** Valida los landmarks detectados contra una definición de pose */
export function validatePose(
  landmarks: LandmarkPoint[],
  pose: PoseDefinition
): ValidationResult {
  const keypointResults: ValidationResult["keypointResults"] = [];
  let passed = 0;

  for (const kp of pose.keypoints) {
    // Validación por ángulo de articulación
    if (
      kp.relativeTo !== undefined &&
      kp.anchor !== undefined &&
      kp.minAngle !== undefined &&
      kp.maxAngle !== undefined
    ) {
      const a = landmarks[kp.relativeTo];
      const b = landmarks[kp.landmark];
      const c = landmarks[kp.anchor];

      if (!a || !b || !c) {
        keypointResults.push({ landmark: kp.landmark, passed: false, actual: null, expected: [kp.minAngle, kp.maxAngle] });
        continue;
      }

      const angle = angleBetween(a, b, c);
      const min = kp.minAngle - pose.globalMarginDeg;
      const max = kp.maxAngle + pose.globalMarginDeg;
      const ok = angle >= min && angle <= max;
      if (ok) passed++;
      keypointResults.push({ landmark: kp.landmark, passed: ok, actual: angle, expected: [kp.minAngle, kp.maxAngle] });

    // Validación por posición relativa normalizada
    } else if (kp.xRange || kp.yRange) {
      const lm = landmarks[kp.landmark];
      if (!lm) {
        keypointResults.push({ landmark: kp.landmark, passed: false, actual: null, expected: [0, 0] });
        continue;
      }
      const xOk = kp.xRange ? lm.x >= kp.xRange[0] && lm.x <= kp.xRange[1] : true;
      const yOk = kp.yRange ? lm.y >= kp.yRange[0] && lm.y <= kp.yRange[1] : true;
      const ok = xOk && yOk;
      if (ok) passed++;
      keypointResults.push({ landmark: kp.landmark, passed: ok, actual: lm.x, expected: kp.xRange ?? [0, 1] });
    }
  }

  const score = pose.keypoints.length > 0 ? passed / pose.keypoints.length : 0;
  return {
    isValid: score >= 0.85, // 85% de keypoints correctos = pose válida
    score,
    keypointResults,
  };
}
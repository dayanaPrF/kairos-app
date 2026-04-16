// hugPose.ts
import { PoseDefinition } from "./types";

export const hugPose: PoseDefinition = {
  id: "hug-pose",
  name: "Abrazo",
  description: "Cerrar los brazos sobre el pecho",
  icon: "🤗",
  globalMarginDeg: 20,
  keypoints: [
    // Ángulo cerrado en los hombros (brazos hacia el frente/adentro)
    { landmark: 11, relativeTo: 23, anchor: 13, minAngle: 30, maxAngle: 70 },
    { landmark: 12, relativeTo: 24, anchor: 14, minAngle: 30, maxAngle: 70 },
    // Codos muy flexionados
    { landmark: 13, relativeTo: 11, anchor: 15, minAngle: 30, maxAngle: 90 },
    { landmark: 14, relativeTo: 12, anchor: 16, minAngle: 30, maxAngle: 90 },
  ],
};
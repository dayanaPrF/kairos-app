// upDownPose.ts
import { PoseDefinition } from "./types";

export const upDownPose: PoseDefinition = {
  id: "up-down",
  name: "Arriba y Abajo",
  description: "Brazo izquierdo arriba y brazo derecho abajo",
  icon: "🙋",
  globalMarginDeg: 7,
  keypoints: [
    // Brazo Izquierdo arriba (ángulo amplio respecto a la cadera)
    { landmark: 11, relativeTo: 23, anchor: 13, minAngle: 150, maxAngle: 180 },
    // Brazo Derecho abajo (ángulo cerrado respecto a la cadera)
    { landmark: 12, relativeTo: 24, anchor: 14, minAngle: 10, maxAngle: 40 },
    // Ambos codos estirados
    { landmark: 13, relativeTo: 11, anchor: 15, minAngle: 150, maxAngle: 180 },
    { landmark: 14, relativeTo: 12, anchor: 16, minAngle: 150, maxAngle: 180 },
  ],
};
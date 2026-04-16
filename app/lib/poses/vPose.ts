// vPose.ts
import { PoseDefinition } from "./types";

export const vPose: PoseDefinition = {
  id: "v-pose",
  name: "Brazos en V",
  description: "Brazos extendidos hacia arriba y hacia afuera",
  icon: "✌️",
  globalMarginDeg: 10,
  keypoints: [
    // Ángulo entre Cadera - Hombro - Codo (Apertura del brazo respecto al cuerpo)
    { landmark: 11, relativeTo: 23, anchor: 13, minAngle: 130, maxAngle: 170 },
    { landmark: 12, relativeTo: 24, anchor: 14, minAngle: 130, maxAngle: 170 },
    // Brazos estirados (Codos rectos)
    { landmark: 13, relativeTo: 11, anchor: 15, minAngle: 150, maxAngle: 180 },
    { landmark: 14, relativeTo: 12, anchor: 16, minAngle: 150, maxAngle: 180 },
  ],
};
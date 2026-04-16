import { PoseDefinition } from "./types";

export const warriorPose: PoseDefinition = {
  id: "warrior",
  name: "Guerrero I",
  description: "Brazos levantados, piernas en posición de estocada",
  // Mantener un margen bajo ayuda a que la detección sea estable, 
  // pero los rangos internos deben ser amplios.
  globalMarginDeg: 5, 
  keypoints: [
    // Brazos: Permitimos que estén más doblados (desde 130°)
    { landmark: 13, relativeTo: 11, anchor: 15, minAngle: 130, maxAngle: 190 },
    { landmark: 14, relativeTo: 12, anchor: 16, minAngle: 130, maxAngle: 190 },
    
    // Rodilla delantera: Ampliamos el rango para que no exija los 90° exactos
    // (Acepta desde una flexión leve hasta una profunda)
    { landmark: 25, relativeTo: 23, anchor: 27, minAngle: 60, maxAngle: 150 },
    
    // Rodilla trasera: Permitimos que la pierna de atrás esté algo flexionada (desde 120°)
    { landmark: 26, relativeTo: 24, anchor: 28, minAngle: 120, maxAngle: 190 },
  ],
};
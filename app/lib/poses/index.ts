import { tPose } from "./tPose";
import { warriorPose } from "./warriors";
import { vPose } from "./vPose";
import { hugPose } from "./hugPose";
import { upDownPose } from "./upDownPose";
import type { PoseDefinition } from "./types.ts";

// Agrega aquí cualquier pose nueva — se refleja automáticamente en la UI
export const ALL_POSES: PoseDefinition[] = [
  tPose,
  warriorPose,
  vPose,
  hugPose,
  upDownPose,
];

export { tPose, warriorPose, vPose, hugPose, upDownPose };
export type { PoseDefinition, ValidationResult } from "./types.ts";
export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseKeypoint {
  landmark: number;
  relativeTo?: number;
  anchor?: number;
  minAngle?: number;
  maxAngle?: number;
  xRange?: [number, number];
  yRange?: [number, number];
}

export interface PoseDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string; // <--- AGREGADO: Propiedad para el emoji o letra
  keypoints: PoseKeypoint[];
  globalMarginDeg: number;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  keypointResults: {
    landmark: number;
    passed: boolean;
    actual: number | null;
    expected: [number, number];
  }[];
}
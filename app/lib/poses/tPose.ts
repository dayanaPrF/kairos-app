import { PoseDefinition } from "./types";

export const tPose: PoseDefinition = {
  id: "t-pose",
  name: "Pose T",
  description: "Brazos extendidos horizontalmente a los lados",
  globalMarginDeg: 5,
  keypoints: [
    { landmark: 13, relativeTo: 11, anchor: 15, minAngle: 150, maxAngle: 180 },
    { landmark: 14, relativeTo: 12, anchor: 16, minAngle: 150, maxAngle: 180 },
    { landmark: 11, relativeTo: 23, anchor: 13, minAngle: 70, maxAngle: 110 },
    { landmark: 12, relativeTo: 24, anchor: 14, minAngle: 70, maxAngle: 110 },
  ],
};
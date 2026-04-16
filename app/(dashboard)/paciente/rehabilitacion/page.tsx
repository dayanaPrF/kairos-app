"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import PoseSelector from "../../../components/PoseSelector";
import PoseDetector from "../../../components/PoseDetector";
import { ALL_POSES } from "../../../lib/poses"; // La lista de ejercicios

export default function RehabilitacionPage() {
  const router = useRouter();
  // Estado para manejar qué pantalla mostrar
  const [selectedPose, setSelectedPose] = useState<any>(null);

  // PANTALLA 1: Si no hay pose seleccionada, mostramos el Selector
  if (!selectedPose) {
    return (
      <PoseSelector 
        onSelect={(pose) => setSelectedPose(pose)} 
      />
    );
  }

  // PANTALLA 2: Si ya seleccionó una, mostramos el Detector con la cámara
  return (
    <PoseDetector 
      pose={selectedPose} 
      onBack={() => setSelectedPose(null)} 
    />
  );
}
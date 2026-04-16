"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import PoseDetector from "../../../components/PoseDetector";
import { ALL_POSES } from "../../../lib/poses"; // Datos estáticos de tus amigos

export default function RehabilitacionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [poseToExecute, setPoseToExecute] = useState<any>(null);

  useEffect(() => {
    const poseId = searchParams.get('id');
    
    if (poseId) {
      // Buscamos el ejercicio en la lista estática usando el ID de la URL
      const foundPose = ALL_POSES.find((p: any) => p.id === poseId);
      
      if (foundPose) {
        setPoseToExecute(foundPose);
      } else {
        // Si por algo no lo encuentra, carga el primero por defecto para que no falle la demo
        setPoseToExecute(ALL_POSES[0]);
      }
    }
  }, [searchParams]);

  // Si aún no se carga la pose, mostramos un loader con estilo Kairós
  if (!poseToExecute) {
    return (
      <div style={{ background: "var(--blue-deep)", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lime)", fontFamily: "sans-serif" }}>
        PREPARANDO CÁMARA E IA...
      </div>
    );
  }

  // AQUÍ EL SALTO ES DIRECTO AL DETECTOR (LA CÁMARA)
  return (
    <PoseDetector 
      pose={poseToExecute} 
      onBack={() => router.push('/paciente')} // Si regresa, va al Dashboard
    />
  );
}
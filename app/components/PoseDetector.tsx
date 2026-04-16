"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { validatePose } from "../lib/poseUtils";
import type { PoseDefinition, ValidationResult } from "../lib/poses/types.ts";

// --- CONFIGURACIÓN ---
const REPEAT_MESSAGE_COOLDOWN = 3000; 
const HOLD_TIME_SECONDS = 10; 

const KEYPOINT_HINTS: Record<number, { low: string; high: string }> = {
  13: { low: "Estira un poco tu brazo izquierdo", high: "Relaja tu codo izquierdo" },
  14: { low: "Estira un poco tu brazo derecho", high: "Relaja tu codo derecho" },
  11: { low: "Sube tu brazo izquierdo", high: "Baja un poco tu brazo izquierdo" },
  12: { low: "Sube tu brazo derecho", high: "Baja un poco tu brazo derecho" },
  25: { low: "Dobla un poco más tu rodilla delantera", high: "Estira un poco tu rodilla delantera" },
  26: { low: "Trata de estirar tu pierna trasera", high: "Estira la pierna trasera" },
};

function getHint(keypointResults: ValidationResult["keypointResults"]): string | null {
  const failed = keypointResults.filter((r) => !r.passed && r.actual !== null);
  if (failed.length === 0) return null;
  const first = failed[0];
  const hints = KEYPOINT_HINTS[first.landmark];
  if (!hints) return `Ajusta el punto ${first.landmark}`;
  const mid = (first.expected[0] + first.expected[1]) / 2;
  return first.actual! < mid ? hints.low : hints.high;
}

interface Props {
  pose: PoseDefinition;
  onBack: () => void;
}

export default function PoseDetector({ pose, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [status, setStatus] = useState<{ result: ValidationResult | null; fps: number }>({ result: null, fps: 0 });
  const [timeLeft, setTimeLeft] = useState<number>(HOLD_TIME_SECONDS);
  const [isFinished, setIsFinished] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(true);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const lastFrameTime = useRef<number>(performance.now());
  const frameCount = useRef<number>(0);
  const lastSpokenText = useRef<string>("");
  const lastSpeakTime = useRef<number>(0);
  const isSpeaking = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- VOZ ---
  const getLatinaVoice = useCallback(() => {
    if (typeof window === "undefined") return null;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang === "es-MX" && v.name.includes("Google")) ||
      voices.find((v) => v.lang === "es-MX") ||
      voices.find((v) => v.lang.startsWith("es-")) ||
      voices[0]
    );
  }, []);

  const speak = useCallback((text: string, force: boolean = false) => {
    if (!isVoiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    
    const now = Date.now();
    const isDifferentMessage = text !== lastSpokenText.current;
    
    // Nueva lógica: Si el mensaje es diferente al último, ignoramos el cooldown y hablamos de inmediato
    if (!force && !isDifferentMessage && (now - lastSpeakTime.current < REPEAT_MESSAGE_COOLDOWN)) return;
    if (isSpeaking.current && !force && !isDifferentMessage) return;

    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = getLatinaVoice();
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = "es-MX";
    utterance.rate = 1.1;
    
    utterance.onstart = () => { 
      isSpeaking.current = true; 
      lastSpokenText.current = text;
      lastSpeakTime.current = Date.now();
    };
    utterance.onend = () => { isSpeaking.current = false; };
    utterance.onerror = () => { isSpeaking.current = false; };
    
    window.speechSynthesis.speak(utterance);
  }, [isVoiceEnabled, getLatinaVoice]);

  // --- LÓGICA DEL CRONÓMETRO Y ASISTENCIA ACTIVA ---
  useEffect(() => {
    const hasPerson = !!status.result;
    const isPoseValid = status.result?.isValid;
    
    if (isFinished) return;

    if (hasPerson && isPoseValid) {
      if (timeLeft === HOLD_TIME_SECONDS) {
        speak("¡Posición correcta! Manténla ahí.", true);
      }

      timerRef.current = setInterval(() => {
        if (!status.result?.isValid) {
          if (timerRef.current) clearInterval(timerRef.current);
          return;
        }

        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsFinished(true);
            speak("¡Tiempo completado! Excelente trabajo.", true);
            return 0;
          }
          if (prev <= 4) speak((prev - 1).toString(), true);
          return prev - 1;
        });
      }, 1000);

    } else if (hasPerson && !isPoseValid) {
      if (timerRef.current) clearInterval(timerRef.current);
      
      const hint = getHint(status.result?.keypointResults || []) || "Ajusta tu pose";
      // Si el hint cambió, speak() lo detectará y hablará de inmediato
      speak(hint);
      
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeLeft < HOLD_TIME_SECONDS) {
        speak("Vuelve a la posición para continuar.");
      }
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status.result?.isValid, !!status.result, isFinished, speak, timeLeft]);

  // --- BUCLE DE MEDIAPIPE ---
  useEffect(() => {
    let running = true;
    let rafId: number;
    let landmarker: PoseLandmarker | null = null;
    let stream: MediaStream | null = null;

    async function setup() {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsCameraReady(true);
            loop();
          };
        }
      } catch (err) { console.error("Setup error:", err); }
    }

    function loop() {
      if (!running || !videoRef.current || !landmarker || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;

      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        const result = landmarker.detectForVideo(video, performance.now());
        
        if (result.landmarks && result.landmarks.length > 0) {
          const drawingUtils = new DrawingUtils(ctx);
          const mirrored = result.landmarks[0].map((lm) => ({ x: 1 - lm.x, y: lm.y, z: lm.z, visibility: lm.visibility }));
          const validation = validatePose(mirrored, pose);

          const color = isFinished ? "#00d26e" : (validation.isValid ? "#00d26e" : "#dc3c3c");
          drawingUtils.drawConnectors(mirrored, PoseLandmarker.POSE_CONNECTIONS, { color, lineWidth: 5 });

          frameCount.current++;
          const now = performance.now();
          if (now - lastFrameTime.current >= 1000) {
            const fps = Math.round((frameCount.current * 1000) / (now - lastFrameTime.current));
            setStatus({ result: validation, fps });
            frameCount.current = 0;
            lastFrameTime.current = now;
          } else {
            setStatus(prev => ({ ...prev, result: validation }));
          }
        } else {
          setStatus(prev => ({ ...prev, result: null }));
        }
      }
      rafId = requestAnimationFrame(loop);
    }

    setup();
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      landmarker?.close();
      stream?.getTracks().forEach(t => t.stop());
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
    };
  }, [pose]);

  const { result, fps } = status;

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#080808", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px", gap: "12px", fontFamily: "'Nunito', sans-serif", boxSizing: "border-box", overflow: "hidden" }}>
      <video ref={videoRef} style={{ display: "none" }} autoPlay playsInline muted />

      <div style={{ width: "100%", maxWidth: "1600px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "8px 16px", color: "#bbb", cursor: "pointer" }}>← VOLVER</button>
        <div style={{ 
          background: isFinished ? "var(--lime)" : "#1a1a1a", 
          padding: "8px 30px", 
          borderRadius: "20px", 
          fontSize: "24px", 
          fontWeight: "bold", 
          color: isFinished ? "#000" : "#00d26e",
          border: `2px solid #00d26e`,
          minWidth: "120px",
          textAlign: "center"
        }}>
          {timeLeft}s
        </div>
        <button onClick={() => { window.speechSynthesis.cancel(); setIsVoiceEnabled(!isVoiceEnabled); }} style={{ background: isVoiceEnabled ? "rgba(0,210,110,0.1)" : "#1a1a1a", border: `1px solid ${isVoiceEnabled ? "#00d26e55" : "#333"}`, borderRadius: 10, padding: "8px 14px", color: isVoiceEnabled ? "#00d26e" : "#777", cursor: "pointer" }}>
          {isVoiceEnabled ? "🔊 AUDIO" : "🔇 MUTED"}
        </button>
      </div>

      <div style={{ position: "relative", flex: 1, width: "100%", maxWidth: "1600px", borderRadius: 24, overflow: "hidden", background: "#000", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!isCameraReady && <div style={{ color: "#00d26e", fontSize: "1.2rem", letterSpacing: "2px" }}>INICIALIZANDO SISTEMA...</div>}
        <canvas ref={canvasRef} style={{ height: "100%", width: "100%", objectFit: "contain", display: isCameraReady ? "block" : "none" }} />
        
        {result && !isFinished && (
          <div style={{ position: "absolute", top: 20, left: 20, padding: "12px 28px", borderRadius: 12, background: result.isValid ? "rgba(0,210,110,0.9)" : "rgba(220,60,60,0.9)", color: "#fff", fontWeight: "bold", backdropFilter: "blur(4px)" }}>
            {result.isValid ? "✓ MANTÉN LA POSICIÓN" : "✗ CORRIGE TU POSTURA"}
          </div>
        )}

        {isFinished && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,210,110,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", backdropFilter: "blur(12px)", zIndex: 10 }}>
            <h1 style={{ color: "#fff", fontSize: 80, margin: 0, textShadow: "0 0 20px #00d26e" }}>¡LOGRADO!</h1>
            <button onClick={() => { setTimeLeft(HOLD_TIME_SECONDS); setIsFinished(false); }} style={{ marginTop: 30, padding: "18px 60px", borderRadius: 40, background: "#00d26e", color: "#000", border: "none", fontWeight: "900", cursor: "pointer", fontSize: 22, boxShadow: "0 10px 30px rgba(0,210,110,0.4)" }}>REPETIR</button>
          </div>
        )}
      </div>

      <div style={{ width: "100%", maxWidth: "1600px", background: "#111", border: "1px solid #222", borderRadius: 24, padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 28, color: "#fff", fontWeight: 600 }}>
          {isFinished ? "SESIÓN COMPLETADA" : !result ? "ESPERANDO USUARIO..." : result.isValid ? "¡ASÍ ESTÁ BIEN!" : <span style={{ color: "#ffcc00" }}>{getHint(result.keypointResults)?.toUpperCase()}</span>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, color: "#00d26e", fontWeight: "900" }}>{result ? Math.round(result.score * 100) : 0}%</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>PRECISIÓN | {fps} FPS</div>
        </div>
      </div>
    </div>
  );
}
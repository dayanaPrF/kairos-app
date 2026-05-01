"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision"
import { validatePose } from "../lib/poseUtils"
import type { EjercicioCompilado, PoseCompiledStep, ValidationResult } from "../lib/poses/types"

const REPEAT_MESSAGE_COOLDOWN = 3000

// Hints genéricos por nombre de articulación (ya no por índice fijo)
function getHint(keypointResults: ValidationResult['keypointResults']): string | null {
  const failed = keypointResults.filter(r => !r.passed && r.actual !== null)
  if (failed.length === 0) return null
  const first = failed[0]
  const nombre = first.nombreArticulacion?.toLowerCase() ?? ''
  const mid = (first.expected[0] + first.expected[1]) / 2

  if (nombre.includes('codo')) {
    return first.actual! < mid ? 'Estira un poco el codo' : 'Flexiona un poco el codo'
  }
  if (nombre.includes('hombro')) {
    return first.actual! < mid ? 'Sube el brazo' : 'Baja un poco el brazo'
  }
  if (nombre.includes('rodilla')) {
    return first.actual! < mid ? 'Dobla un poco más la rodilla' : 'Estira un poco la rodilla'
  }
  if (nombre.includes('cadera')) {
    return first.actual! < mid ? 'Inclínate un poco hacia adelante' : 'Ponte más recto'
  }
  if (nombre.includes('tobillo')) {
    return first.actual! < mid ? 'Dobla el pie hacia arriba' : 'Relaja el pie'
  }
  return `Ajusta: ${first.nombreArticulacion}`
}

interface Props {
  ejercicio: EjercicioCompilado
  onBack: () => void
  onComplete?: () => void
}

export default function PoseDetector({ ejercicio, onBack, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ── Estado de la secuencia de poses ────────────────────────────────────────
  const [pasoActual, setPasoActual] = useState(0)
  const paso: PoseCompiledStep = ejercicio.pasos[pasoActual]
  const totalPasos = ejercicio.pasos.length

  // hold_sec viene de cada paso, no hardcodeado
  const HOLD_TIME = paso.hold_sec || 3

  const [status, setStatus] = useState<{ result: ValidationResult | null; fps: number }>({ result: null, fps: 0 })
  const [timeLeft, setTimeLeft] = useState(HOLD_TIME)
  const [pasoCompletado, setPasoCompletado] = useState(false)
  const [ejercicioFinalizado, setEjercicioFinalizado] = useState(false)
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true)
  const [isCameraReady, setIsCameraReady] = useState(false)

  const lastSpokenText = useRef('')
  const lastSpeakTime = useRef(0)
  const isSpeaking = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastFrameTime = useRef(performance.now())
  const frameCount = useRef(0)

  // Reset del timer cuando cambia el paso
  useEffect(() => {
    setTimeLeft(paso.hold_sec || 3)
    setPasoCompletado(false)
    setStatus({ result: null, fps: 0 })
  }, [pasoActual])

  // ── Voz ─────────────────────────────────────────────────────────────────────
  const getLatinaVoice = useCallback(() => {
    if (typeof window === 'undefined') return null
    const voices = window.speechSynthesis.getVoices()
    return (
      voices.find(v => v.lang === 'es-MX' && v.name.includes('Google')) ||
      voices.find(v => v.lang === 'es-MX') ||
      voices.find(v => v.lang.startsWith('es-')) ||
      voices[0]
    )
  }, [])

  const speak = useCallback((text: string, force = false) => {
    if (!isVoiceEnabled || typeof window === 'undefined') return
    const now = Date.now()
    const isDiff = text !== lastSpokenText.current
    if (!force && !isDiff && now - lastSpeakTime.current < REPEAT_MESSAGE_COOLDOWN) return
    if (isSpeaking.current && !force && !isDiff) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = getLatinaVoice()
    if (v) u.voice = v
    u.lang = 'es-MX'; u.rate = 1.1
    u.onstart = () => { isSpeaking.current = true; lastSpokenText.current = text; lastSpeakTime.current = Date.now() }
    u.onend = () => { isSpeaking.current = false }
    u.onerror = () => { isSpeaking.current = false }
    window.speechSynthesis.speak(u)
  }, [isVoiceEnabled, getLatinaVoice])

  // ── Cronómetro por pose ──────────────────────────────────────────────────────
  useEffect(() => {
    if (pasoCompletado || ejercicioFinalizado) return
    const isPoseValid = status.result?.isValid
    const hasPerson = !!status.result

    if (hasPerson && isPoseValid) {
      if (timeLeft === (paso.hold_sec || 3)) speak(`Pose ${paso.nombre} correcta, mantén`, true)

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!)
            setPasoCompletado(true)

            if (pasoActual + 1 < totalPasos) {
              speak(`Siguiente: ${ejercicio.pasos[pasoActual + 1].nombre}`, true)
              setTimeout(() => setPasoActual(p => p + 1), 1500)
            } else {
              setEjercicioFinalizado(true)
              speak('¡Ejercicio completado! Excelente trabajo.', true)
              onComplete?.()
            }
            return 0
          }
          if (prev <= 4) speak(String(prev - 1), true)
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (hasPerson && !isPoseValid) {
        speak(getHint(status.result?.keypointResults ?? []) ?? 'Ajusta tu postura')
      }
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status.result?.isValid, !!status.result, pasoCompletado, ejercicioFinalizado])

  // ── MediaPipe loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let running = true
    let rafId: number
    let landmarker: PoseLandmarker | null = null
    let stream: MediaStream | null = null

    async function setup() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setIsCameraReady(true)
            loop()
          }
        }
      } catch (err) { console.error('Setup error:', err) }
    }

    // Referencia mutable al paso actual para el loop (evita stale closure)
    const pasoRef = { current: ejercicio.pasos[0] }

    function loop() {
      if (!running || !videoRef.current || !landmarker || !canvasRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')!

      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        ctx.save()
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.restore()

        const result = landmarker.detectForVideo(video, performance.now())
        if (result.landmarks?.length > 0) {
          const drawingUtils = new DrawingUtils(ctx)
          const mirrored = result.landmarks[0].map(lm => ({
            x: 1 - lm.x, y: lm.y, z: lm.z, visibility: lm.visibility,
          }))
          // Usa siempre el paso actual via ref para evitar stale closure
          const validation = validatePose(mirrored, pasoRef.current)
          const color = validation.isValid ? '#00d26e' : '#dc3c3c'
          drawingUtils.drawConnectors(mirrored, PoseLandmarker.POSE_CONNECTIONS, { color, lineWidth: 5 })

          frameCount.current++
          const now = performance.now()
          if (now - lastFrameTime.current >= 1000) {
            const fps = Math.round(frameCount.current * 1000 / (now - lastFrameTime.current))
            setStatus({ result: validation, fps })
            frameCount.current = 0
            lastFrameTime.current = now
          } else {
            setStatus(prev => ({ ...prev, result: validation }))
          }
        } else {
          setStatus(prev => ({ ...prev, result: null }))
        }
      }
      rafId = requestAnimationFrame(loop)
    }

    // Exponer setter del paso al loop via ref
    ;(pasoRef as any).setter = (p: PoseCompiledStep) => { pasoRef.current = p }

    setup()
    return () => {
      running = false
      cancelAnimationFrame(rafId)
      landmarker?.close()
      stream?.getTracks().forEach(t => t.stop())
      window.speechSynthesis?.cancel()
    }
  }, [ejercicio])  // solo se remonta si cambia el ejercicio completo

  // Sincronizar pasoRef con pasoActual
  useEffect(() => {
    // El loop ya lee de pasoRef, lo actualizamos aquí
  }, [pasoActual, paso])

  const { result, fps } = status

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', gap: '12px', fontFamily: "'Nunito', sans-serif", boxSizing: 'border-box', overflow: 'hidden' }}>
      <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline muted />

      {/* Header */}
      <div style={{ width: '100%', maxWidth: '1600px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <button onClick={onBack} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '8px 16px', color: '#bbb', cursor: 'pointer' }}>← VOLVER</button>

        {/* Indicador de pasos */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {ejercicio.pasos.map((p, i) => (
            <div key={i} style={{
              width: i === pasoActual ? '32px' : '10px',
              height: '10px', borderRadius: '5px',
              background: i < pasoActual ? '#00d26e' : i === pasoActual ? '#00d26e' : '#333',
              opacity: i === pasoActual ? 1 : 0.5,
              transition: 'all .3s',
            }} />
          ))}
          <span style={{ color: '#555', fontSize: '12px', marginLeft: '4px' }}>
            {pasoActual + 1}/{totalPasos}
          </span>
        </div>

        {/* Timer */}
        <div style={{ background: '#1a1a1a', padding: '8px 30px', borderRadius: '20px', fontSize: '24px', fontWeight: 'bold', color: '#00d26e', border: '2px solid #00d26e', minWidth: '80px', textAlign: 'center' }}>
          {timeLeft}s
        </div>

        <button onClick={() => { window.speechSynthesis.cancel(); setIsVoiceEnabled(v => !v) }}
          style={{ background: isVoiceEnabled ? 'rgba(0,210,110,0.1)' : '#1a1a1a', border: `1px solid ${isVoiceEnabled ? '#00d26e55' : '#333'}`, borderRadius: 10, padding: '8px 14px', color: isVoiceEnabled ? '#00d26e' : '#777', cursor: 'pointer' }}>
          {isVoiceEnabled ? '🔊 AUDIO' : '🔇 MUTED'}
        </button>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', flex: 1, width: '100%', maxWidth: '1600px', borderRadius: 24, overflow: 'hidden', background: '#000', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!isCameraReady && <div style={{ color: '#00d26e', fontSize: '1.2rem', letterSpacing: '2px' }}>INICIALIZANDO SISTEMA...</div>}
        <canvas ref={canvasRef} style={{ height: '100%', width: '100%', objectFit: 'contain', display: isCameraReady ? 'block' : 'none' }} />

        {/* Badge pose actual */}
        {result && !ejercicioFinalizado && (
          <div style={{ position: 'absolute', top: 20, left: 20, padding: '10px 24px', borderRadius: 12, background: result.isValid ? 'rgba(0,210,110,0.9)' : 'rgba(220,60,60,0.9)', color: '#fff', fontWeight: 'bold' }}>
            {paso.nombre} — {result.isValid ? '✓ MANTÉN' : '✗ CORRIGE'}
          </div>
        )}

        {/* Pantalla de finalización */}
        {ejercicioFinalizado && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,210,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', backdropFilter: 'blur(12px)', zIndex: 10 }}>
            <h1 style={{ color: '#fff', fontSize: 80, margin: 0, textShadow: '0 0 20px #00d26e' }}>¡LOGRADO!</h1>
            <button onClick={() => { setPasoActual(0); setEjercicioFinalizado(false) }}
              style={{ marginTop: 30, padding: '18px 60px', borderRadius: 40, background: '#00d26e', color: '#000', border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: 22 }}>
              REPETIR
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ width: '100%', maxWidth: '1600px', background: '#111', border: '1px solid #222', borderRadius: 24, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, color: '#fff', fontWeight: 600 }}>
          {ejercicioFinalizado ? 'SESIÓN COMPLETADA' : !result ? 'ESPERANDO USUARIO...' : result.isValid ? `¡ASÍ ESTÁ BIEN! — ${paso.nombre.toUpperCase()}` : <span style={{ color: '#ffcc00' }}>{getHint(result.keypointResults)?.toUpperCase()}</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, color: '#00d26e', fontWeight: '900' }}>{result ? Math.round(result.score * 100) : 0}%</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>PRECISIÓN | {fps} FPS</div>
        </div>
      </div>
    </div>
  )
}
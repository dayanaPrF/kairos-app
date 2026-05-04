"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision"
import { validatePose } from "../lib/poseUtils"
import { MunequitoReferencia } from "./MunequitoReferencia"
import type { EjercicioCompilado, PoseCompiledStep, ValidationResult } from "../lib/poses/types"

const REPEAT_MESSAGE_COOLDOWN = 3000

function getHint(keypointResults: ValidationResult['keypointResults']): string | null {
  const failed = keypointResults.filter(r => !r.passed && r.actual !== null)
  if (failed.length === 0) return null
  const first  = failed[0]
  const nombre = first.nombreArticulacion?.toLowerCase() ?? ''
  const mid    = (first.expected[0] + first.expected[1]) / 2
  if (nombre.includes('codo'))    return first.actual! < mid ? 'Estira un poco el codo'            : 'Flexiona un poco el codo'
  if (nombre.includes('hombro'))  return first.actual! < mid ? 'Sube el brazo'                     : 'Baja un poco el brazo'
  if (nombre.includes('rodilla')) return first.actual! < mid ? 'Dobla un poco más la rodilla'      : 'Estira un poco la rodilla'
  if (nombre.includes('cadera'))  return first.actual! < mid ? 'Inclínate un poco hacia adelante'  : 'Ponte más recto'
  if (nombre.includes('tobillo')) return first.actual! < mid ? 'Dobla el pie hacia arriba'         : 'Relaja el pie'
  return `Ajusta: ${first.nombreArticulacion}`
}

interface Props {
  ejercicio: EjercicioCompilado
  onBack: () => void
  onComplete?: () => void
}

export default function PoseDetector({ ejercicio, onBack, onComplete }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const pasoRef       = useRef<PoseCompiledStep>(ejercicio.pasos[0])

  const totalRepeticiones = ejercicio.repeticiones ?? 1
  const totalPasos        = ejercicio.pasos.length

  // ── Estado ────────────────────────────────────────────────────────────────────
  const [pasoActual, setPasoActual]           = useState(0)
  const [repActual, setRepActual]             = useState(1)
  const [status, setStatus]                   = useState<{ result: ValidationResult | null; fps: number }>({ result: null, fps: 0 })
  const [timeLeft, setTimeLeft]               = useState(ejercicio.pasos[0].hold_sec || 3)
  const [pasoCompletado, setPasoCompletado]   = useState(false)
  const [ejercicioFinalizado, setEjercicioFinalizado] = useState(false)
  const [isVoiceEnabled, setIsVoiceEnabled]   = useState(true)
  const [isCameraReady, setIsCameraReady]     = useState(false)

  const paso = ejercicio.pasos[pasoActual]

  const lastSpokenText = useRef('')
  const lastSpeakTime  = useRef(0)
  const isSpeaking     = useRef(false)
  const timerRef       = useRef<NodeJS.Timeout | null>(null)
  const lastFrameTime  = useRef(performance.now())
  const frameCount     = useRef(0)

  // ── Sincronizar pasoRef ───────────────────────────────────────────────────────
  useEffect(() => {
    pasoRef.current = paso
    setTimeLeft(paso.hold_sec || 3)
    setPasoCompletado(false)
    setStatus({ result: null, fps: 0 })
  }, [pasoActual])

  // ── Voz ───────────────────────────────────────────────────────────────────────
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
    const now   = Date.now()
    const isDiff = text !== lastSpokenText.current
    if (!force && !isDiff && now - lastSpeakTime.current < REPEAT_MESSAGE_COOLDOWN) return
    if (isSpeaking.current && !force && !isDiff) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = getLatinaVoice()
    if (v) u.voice = v
    u.lang = 'es-MX'; u.rate = 1.1
    u.onstart = () => { isSpeaking.current = true; lastSpokenText.current = text; lastSpeakTime.current = Date.now() }
    u.onend   = () => { isSpeaking.current = false }
    u.onerror = () => { isSpeaking.current = false }
    window.speechSynthesis.speak(u)
  }, [isVoiceEnabled, getLatinaVoice])

  // ── Cronómetro con repeticiones ────────────────────────────────────────────────
  useEffect(() => {
    if (pasoCompletado || ejercicioFinalizado) return
    const isPoseValid = status.result?.isValid
    const hasPerson   = !!status.result

    if (hasPerson && isPoseValid) {
      if (timeLeft === (paso.hold_sec || 3)) speak(`${paso.nombre}, mantén`, true)

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!)
            setPasoCompletado(true)

            const esUltimoPaso = pasoActual + 1 >= totalPasos
            const esUltimaRep  = repActual >= totalRepeticiones

            if (!esUltimoPaso) {
              // Avanzar al siguiente paso dentro de la misma repetición
              speak(`Siguiente pose: ${ejercicio.pasos[pasoActual + 1].nombre}`, true)
              setTimeout(() => setPasoActual(p => p + 1), 1200)
            } else if (!esUltimaRep) {
              // Terminar la repetición, volver al primer paso
              const sigRep = repActual + 1
              speak(`Repetición ${sigRep} de ${totalRepeticiones}`, true)
              setTimeout(() => {
                setRepActual(sigRep)
                setPasoActual(0)
                setPasoCompletado(false)
                setTimeLeft(ejercicio.pasos[0].hold_sec || 3)
              }, 1500)
            } else {
              // Todas las repeticiones completadas
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

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { t.stop(); t.enabled = false })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
    if (landmarkerRef.current) {
      try { landmarkerRef.current.close() } catch (_) {}
      landmarkerRef.current = null
    }
    window.speechSynthesis?.cancel()
    setIsCameraReady(false)
  }, [])

  // ── MediaPipe ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let running = true
    let rafId: number

    async function setup() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setIsCameraReady(true)
            loop()
          }
        }
      } catch (err) { console.error('Setup error:', err) }
    }

    function loop() {
      if (!running || !videoRef.current || !landmarkerRef.current || !canvasRef.current) return
      const video  = videoRef.current
      const canvas = canvasRef.current
      const ctx    = canvas.getContext('2d')!

      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth) {
          canvas.width  = video.videoWidth
          canvas.height = video.videoHeight
        }
        ctx.save()
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.restore()

        const result = landmarkerRef.current.detectForVideo(video, performance.now())
        if (result.landmarks?.length > 0) {
          const drawingUtils = new DrawingUtils(ctx)
          const mirrored     = result.landmarks[0].map(lm => ({ x: 1 - lm.x, y: lm.y, z: lm.z, visibility: lm.visibility }))
          const validation   = validatePose(mirrored, pasoRef.current)
          const color        = validation.isValid ? '#00d26e' : '#dc3c3c'
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

    setup()
    return () => { running = false; cancelAnimationFrame(rafId); cleanup() }
  }, [ejercicio])

  const { result, fps } = status

  // ── Layout izquierda (referencia) + derecha (cámara) ─────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#080808', display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', sans-serif", boxSizing: 'border-box', overflow: 'hidden' }}>
      <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline muted />

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', gap: '12px', flexShrink: 0 }}>
        <button onClick={() => { cleanup(); onBack() }}
          style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '8px 16px', color: '#bbb', cursor: 'pointer' }}>
          ← VOLVER
        </button>

        {/* Info ejercicio */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>{ejercicio.nombre_ejercicio}</div>
          <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>
            Repetición {repActual} de {totalRepeticiones}
            {totalPasos > 1 && ` · Pose ${pasoActual + 1}/${totalPasos}`}
          </div>
        </div>

        {/* Timer */}
        <div style={{ background: '#1a1a1a', padding: '8px 24px', borderRadius: '20px', fontSize: '22px', fontWeight: 'bold', color: '#00d26e', border: '2px solid #00d26e', minWidth: '80px', textAlign: 'center' }}>
          {timeLeft}s
        </div>

        <button onClick={() => { window.speechSynthesis.cancel(); setIsVoiceEnabled(v => !v) }}
          style={{ background: isVoiceEnabled ? 'rgba(0,210,110,0.1)' : '#1a1a1a', border: `1px solid ${isVoiceEnabled ? '#00d26e55' : '#333'}`, borderRadius: 10, padding: '8px 14px', color: isVoiceEnabled ? '#00d26e' : '#777', cursor: 'pointer' }}>
          {isVoiceEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      {/* ── CUERPO: izquierda referencia + derecha cámara ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', gap: '12px', padding: '0 12px 12px', overflow: 'hidden' }}>

        {/* PANEL IZQUIERDO — referencia del fisio */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Tabs de poses */}
          {totalPasos > 1 && (
            <div style={{ display: 'flex', gap: '4px', padding: '10px 10px 0', flexShrink: 0 }}>
              {ejercicio.pasos.map((p, i) => (
                <div key={i} style={{
                  flex: 1, padding: '5px 4px', borderRadius: '8px', textAlign: 'center',
                  fontSize: '10px', fontWeight: 700,
                  background: i === pasoActual ? '#00d26e22' : 'transparent',
                  color: i === pasoActual ? '#00d26e' : i < pasoActual ? '#555' : '#333',
                  border: `1px solid ${i === pasoActual ? '#00d26e44' : 'transparent'}`,
                }}>
                  {i < pasoActual ? '✓' : `P${i + 1}`}
                </div>
              ))}
            </div>
          )}

          {/* Nombre de la pose */}
          <div style={{ padding: '12px 16px 4px', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px' }}>Pose objetivo</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>{paso.nombre}</div>
          </div>

          {/* Muñequito */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
            <MunequitoReferencia
              articulaciones={paso.keypoints.map(kp => ({
                nombre_articulacion: kp.nombreArticulacion ?? '',
                angulo: Math.round((kp.minAngle + kp.maxAngle) / 2),
                tolerancia: Math.round((kp.maxAngle - kp.minAngle) / 2),
              }))}
              size={1.4}
              mostrarLeyenda={true}
            />
          </div>

          {/* Articulaciones a validar */}
          <div style={{ padding: '8px 12px 12px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {paso.keypoints.map((kp, i) => {
              const artResult = result?.keypointResults.find(r => r.landmark === kp.landmark)
              const ok = artResult?.passed ?? false
              const angActual = artResult?.actual !== null && artResult?.actual !== undefined
                ? Math.round(artResult.actual)
                : null
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '8px', background: '#1a1a1a', border: `1px solid ${ok ? '#00d26e33' : '#333'}` }}>
                  <span style={{ fontSize: '14px' }}>{ok ? '✅' : '⭕'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: ok ? '#00d26e' : '#888', fontWeight: 600 }}>
                      {kp.nombreArticulacion}
                    </div>
                    <div style={{ fontSize: '10px', color: '#555' }}>
                      Objetivo: {Math.round((kp.minAngle + kp.maxAngle) / 2)}°
                      {angActual !== null && ` · Actual: ${angActual}°`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* PANEL DERECHO — cámara */}
        <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#000', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!isCameraReady && (
            <div style={{ color: '#00d26e', fontSize: '1.1rem', letterSpacing: '2px' }}>
              INICIALIZANDO SISTEMA...
            </div>
          )}
          <canvas ref={canvasRef} style={{ height: '100%', width: '100%', objectFit: 'contain', display: isCameraReady ? 'block' : 'none' }} />

          {/* Badge estado */}
          {result && !ejercicioFinalizado && (
            <div style={{ position: 'absolute', top: 16, left: 16, padding: '8px 20px', borderRadius: 10, background: result.isValid ? 'rgba(0,210,110,0.9)' : 'rgba(220,60,60,0.9)', color: '#fff', fontWeight: 'bold', fontSize: '0.85rem' }}>
              {result.isValid ? `✓ ${paso.nombre} — MANTÉN` : `✗ ${getHint(result.keypointResults) ?? 'CORRIGE TU POSTURA'}`}
            </div>
          )}

          {/* Indicador de repeticiones */}
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: '6px' }}>
            {Array.from({ length: totalRepeticiones }).map((_, i) => (
              <div key={i} style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: i < repActual - 1 ? '#00d26e' : i === repActual - 1 ? '#00d26e88' : '#333',
                border: i === repActual - 1 ? '2px solid #00d26e' : '2px solid #333',
              }} />
            ))}
          </div>

          {/* Pantalla de finalización */}
          {ejercicioFinalizado && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,210,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', backdropFilter: 'blur(12px)', zIndex: 10 }}>
              <h1 style={{ color: '#fff', fontSize: 72, margin: 0, textShadow: '0 0 20px #00d26e' }}>¡LOGRADO!</h1>
              <p style={{ color: '#00d26e', fontSize: '1.1rem', margin: '8px 0 24px' }}>
                {totalRepeticiones} repetición{totalRepeticiones !== 1 ? 'es' : ''} completada{totalRepeticiones !== 1 ? 's' : ''}
              </p>
              <button
                onClick={() => {
                  setPasoActual(0)
                  setRepActual(1)
                  setEjercicioFinalizado(false)
                  setPasoCompletado(false)
                  setTimeLeft(ejercicio.pasos[0].hold_sec || 3)
                  setStatus({ result: null, fps: 0 })
                }}
                style={{ padding: '16px 52px', borderRadius: 40, background: '#00d26e', color: '#000', border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: 20 }}
              >
                REPETIR
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px 12px', flexShrink: 0 }}>
        <div style={{ fontSize: 18, color: '#fff', fontWeight: 600 }}>
          {ejercicioFinalizado
            ? 'SESIÓN COMPLETADA'
            : !result
              ? 'ESPERANDO USUARIO...'
              : result.isValid
                ? `¡ASÍ ESTÁ BIEN!`
                : <span style={{ color: '#ffcc00' }}>{getHint(result.keypointResults)?.toUpperCase()}</span>
          }
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 24, color: '#00d26e', fontWeight: '900' }}>{result ? Math.round(result.score * 100) : 0}%</span>
          <span style={{ fontSize: 11, color: '#555', marginLeft: '8px' }}>PRECISIÓN | {fps} FPS</span>
        </div>
      </div>
    </div>
  )
}
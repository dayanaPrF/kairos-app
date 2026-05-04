"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision"
import { validatePose } from "../lib/poseUtils"
import { getHintVoz, getHintHUD, getScoreLabel } from "@/app/lib/HintUtils"
import { MunequitoReferencia } from "./MunequitoReferencia"
import type { EjercicioCompilado, PoseCompiledStep, ValidationResult } from "../lib/poses/types"

const REPEAT_MESSAGE_COOLDOWN = 3000

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
  // ── pasoRef siempre apunta al paso vigente para el loop de RAF ──────────────
  const pasoRef       = useRef<PoseCompiledStep>(ejercicio.pasos[0])
  const yaInicioRef   = useRef(false)

  const totalRepeticiones = ejercicio.repeticiones ?? 1
  const totalPasos        = ejercicio.pasos.length

  const [pasoActual, setPasoActual]                   = useState(0)
  const [repActual, setRepActual]                     = useState(1)
  const [status, setStatus]                           = useState<{ result: ValidationResult | null; fps: number }>({ result: null, fps: 0 })
  const [timeLeft, setTimeLeft]                       = useState(ejercicio.pasos[0].hold_sec || 3)
  const [pasoCompletado, setPasoCompletado]           = useState(false)
  const [ejercicioFinalizado, setEjercicioFinalizado] = useState(false)
  const [isVoiceEnabled, setIsVoiceEnabled]           = useState(true)
  const [isCameraReady, setIsCameraReady]             = useState(false)
  // ── Overlay de transición entre poses (en lugar de return temprano) ──────────
  const [transicionando, setTransicionando]           = useState(false)
  const [transicionNombre, setTransicionNombre]       = useState('')

  // ── 'paso' nunca es undefined — si el índice se sale, usamos el último ──────
  const paso: PoseCompiledStep =
    ejercicio.pasos[pasoActual] ?? ejercicio.pasos[ejercicio.pasos.length - 1]

  const lastSpokenText = useRef('')
  const lastSpeakTime  = useRef(0)
  const isSpeaking     = useRef(false)
  const timerRef       = useRef<NodeJS.Timeout | null>(null)
  const lastFrameTime  = useRef(performance.now())
  const frameCount     = useRef(0)
  // ── Debounce de hints — evita bombardear con mensajes cada frame ─────────────
  const lastHintTime   = useRef(0)
  const HINT_COOLDOWN  = 4000   // ms mínimo entre hints de corrección
  const pendingHintRef = useRef<NodeJS.Timeout | null>(null)

  // ── Sincronizar pasoRef cuando cambia el índice ───────────────────────────────
  useEffect(() => {
    const nuevoPaso = ejercicio.pasos[pasoActual]
    if (!nuevoPaso) return
    pasoRef.current = nuevoPaso
    setTimeLeft(nuevoPaso.hold_sec || 3)
    setPasoCompletado(false)
    setStatus({ result: null, fps: 0 })
    // Quitar overlay de transición al confirmar que el paso ya está listo
    setTransicionando(false)
  }, [pasoActual, ejercicio.pasos])

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
    const now    = Date.now()
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

  /**
   * speakHint — solo para mensajes de corrección de postura.
   * Debounce de HINT_COOLDOWN ms: si la pose sigue mal después de ese tiempo,
   * habla una vez y vuelve a esperar. Nunca interrumpe conteo regresivo.
   */
  const speakHint = useCallback((keypointResults: ValidationResult['keypointResults']) => {
    if (!isVoiceEnabled || typeof window === 'undefined') return
    if (pendingHintRef.current) return  // ya hay uno programado, esperar
    const now = Date.now()
    if (now - lastHintTime.current < HINT_COOLDOWN) return  // cooldown activo

    pendingHintRef.current = setTimeout(() => {
      pendingHintRef.current = null
      // Re-verificar que la pose sigue siendo inválida antes de hablar
      const hint = getHintVoz(keypointResults)
      if (hint) {
        speak(hint, true)
        lastHintTime.current = Date.now()
      }
    }, 600)  // pequeño delay para no hablar en flashes breves de pose inválida
  }, [isVoiceEnabled, speak])

  // ── Avanzar al siguiente paso — con overlay de transición ────────────────────
  const avanzarPaso = useCallback((pasoActualIdx: number, repActualNum: number) => {
    const esUltimoPaso = pasoActualIdx + 1 >= totalPasos
    const esUltimaRep  = repActualNum >= totalRepeticiones

    if (!esUltimoPaso) {
      // → Siguiente pose dentro de la misma repetición
      const siguientePaso = ejercicio.pasos[pasoActualIdx + 1]
      speak(`Siguiente pose: ${siguientePaso.nombre}`, true)

      // Mostrar overlay con nombre de la siguiente pose
      setTransicionando(true)
      setTransicionNombre(siguientePaso.nombre)

      setTimeout(() => {
        setPasoActual(pasoActualIdx + 1)
        // El overlay se oculta en el useEffect de pasoActual
      }, 1200)

    } else if (!esUltimaRep) {
      // → Nueva repetición desde el primer paso
      const sigRep = repActualNum + 1
      speak(`Repetición ${sigRep} de ${totalRepeticiones}`, true)

      setTransicionando(true)
      setTransicionNombre(`Repetición ${sigRep} · ${ejercicio.pasos[0].nombre}`)

      setTimeout(() => {
        setRepActual(sigRep)
        setPasoActual(0)
        setPasoCompletado(false)
        setTimeLeft(ejercicio.pasos[0].hold_sec || 3)
        // El overlay se oculta en el useEffect de pasoActual
      }, 1500)

    } else {
      // → Ejercicio completado
      setEjercicioFinalizado(true)
      speak('¡Ejercicio completado! Excelente trabajo.', true)
      onComplete?.()
    }
  }, [totalPasos, totalRepeticiones, ejercicio.pasos, speak, onComplete])

  // ── Cronómetro con repeticiones ───────────────────────────────────────────────
  useEffect(() => {
    if (!paso || pasoCompletado || ejercicioFinalizado || transicionando) return
    const isPoseValid = status.result?.isValid
    const hasPerson   = !!status.result

    if (hasPerson && isPoseValid) {
      if (timeLeft === (paso.hold_sec || 3)) speak(`${paso.nombre}, mantén`, true)
      // Limpiar hint pendiente — la pose ya es válida
      if (pendingHintRef.current) {
        clearTimeout(pendingHintRef.current)
        pendingHintRef.current = null
      }

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!)
            setPasoCompletado(true)
            avanzarPaso(pasoActual, repActual)
            return 0
          }
          if (prev <= 4) speak(String(prev - 1), true)
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      // Solo hablar si hay persona detectada y la pose es incorrecta
      if (hasPerson && !isPoseValid && status.result) {
        speakHint(status.result.keypointResults)
      }
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status.result?.isValid, !!status.result, pasoCompletado, ejercicioFinalizado, transicionando])

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
    if (pendingHintRef.current) {
      clearTimeout(pendingHintRef.current)
      pendingHintRef.current = null
    }
    window.speechSynthesis?.cancel()
    setIsCameraReady(false)
    yaInicioRef.current = false
  }, [])

  // ── MediaPipe — solo se monta una vez por ejercicio ───────────────────────────
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
        }).catch(err => {
          console.error('❌ Cámara:', err.name, '-', err.message)
          throw err
        })

        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setIsCameraReady(true)
            yaInicioRef.current = true
            loop()
          }
        }
      } catch (err) {
        console.error('Setup error:', err)
      }
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
          const mirrored     = result.landmarks[0].map(lm => ({
            x: 1 - lm.x, y: lm.y, z: lm.z, visibility: lm.visibility,
          }))
          // ── Siempre usa pasoRef.current — nunca el estado de React ──────────
          const validation = validatePose(mirrored, pasoRef.current)
          const color      = validation.isValid ? '#00d26e' : '#dc3c3c'
          drawingUtils.drawConnectors(mirrored, PoseLandmarker.POSE_CONNECTIONS, { color, lineWidth: 5 })

          frameCount.current++
          const now = performance.now()
          if (now - lastFrameTime.current >= 1000) {
            const fps = Math.round(frameCount.current * 1000 / (now - lastFrameTime.current))
            setStatus({ result: validation, fps })
            frameCount.current    = 0
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

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#080808',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Nunito', sans-serif", boxSizing: 'border-box', overflow: 'hidden',
    }}>
      <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline muted />

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 20px', gap: '12px', flexShrink: 0,
      }}>
        <button
          onClick={() => { cleanup(); onBack() }}
          style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '8px 16px', color: '#bbb', cursor: 'pointer' }}
        >
          ← VOLVER
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>{ejercicio.nombre_ejercicio}</div>
          <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>
            Repetición {repActual} de {totalRepeticiones}
            {totalPasos > 1 && ` · Pose ${pasoActual + 1}/${totalPasos}`}
          </div>
        </div>

        <div style={{
          background: '#1a1a1a', padding: '8px 24px', borderRadius: '20px',
          fontSize: '22px', fontWeight: 'bold', color: '#00d26e',
          border: '2px solid #00d26e', minWidth: '80px', textAlign: 'center',
        }}>
          {timeLeft}s
        </div>

        <button
          onClick={() => { window.speechSynthesis.cancel(); setIsVoiceEnabled(v => !v) }}
          style={{
            background: isVoiceEnabled ? 'rgba(0,210,110,0.1)' : '#1a1a1a',
            border: `1px solid ${isVoiceEnabled ? '#00d26e55' : '#333'}`,
            borderRadius: 10, padding: '8px 14px',
            color: isVoiceEnabled ? '#00d26e' : '#777', cursor: 'pointer',
          }}
        >
          {isVoiceEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      {/* ── CUERPO ────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr',
        gap: '12px', padding: '0 12px 12px', overflow: 'hidden',
      }}>

        {/* PANEL IZQUIERDO */}
        <div style={{
          background: '#111', border: '1px solid #222', borderRadius: 20,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

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

          <div style={{ padding: '12px 16px 4px', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px' }}>Pose objetivo</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>{paso.nombre}</div>
          </div>

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

          <div style={{ padding: '8px 12px 12px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {paso.keypoints.map((kp, i) => {
              const artResult = result?.keypointResults.find(r => r.landmark === kp.landmark)
              const ok        = artResult?.passed ?? false
              const angActual = artResult?.actual !== null && artResult?.actual !== undefined
                ? Math.round(artResult.actual) : null
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '5px 8px', borderRadius: '8px', background: '#1a1a1a',
                  border: `1px solid ${ok ? '#00d26e33' : '#333'}`,
                }}>
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
        <div style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          background: '#000', border: '1px solid #222',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>

          {/* Splash inicial — solo si nunca ha arrancado la cámara */}
          {!isCameraReady && !yaInicioRef.current && (
            <div style={{ color: '#00d26e', fontSize: '1.1rem', letterSpacing: '2px', position: 'absolute', zIndex: 5 }}>
              INICIALIZANDO SISTEMA...
            </div>
          )}

          {/* Canvas — siempre montado, visible en cuanto la cámara arranca */}
          <canvas
            ref={canvasRef}
            style={{
              height: '100%', width: '100%', objectFit: 'contain',
              display: (isCameraReady || yaInicioRef.current) ? 'block' : 'none',
            }}
          />

          {/* ── OVERLAY DE TRANSICIÓN ENTRE POSES ─────────────────────────
              Aparece encima del canvas — el canvas sigue corriendo debajo ── */}
          {transicionando && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 20,
              background: 'rgba(8, 8, 8, 0.82)',
              backdropFilter: 'blur(8px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '16px',
              animation: 'fadeInOverlay .25s ease',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                border: '3px solid #00d26e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem',
              }}>
                ✓
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#00d26e', fontSize: '0.75rem', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>
                  ¡Pose completada!
                </div>
                <div style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 800 }}>
                  {transicionNombre}
                </div>
                <div style={{ color: '#555', fontSize: '0.8rem', marginTop: '6px' }}>
                  Prepárate...
                </div>
              </div>
              {/* Barra de progreso animada */}
              <div style={{
                width: '160px', height: '3px',
                background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden',
                marginTop: '4px',
              }}>
                <div style={{
                  height: '100%', background: '#00d26e', borderRadius: '2px',
                  animation: 'transicionBar 1.2s linear forwards',
                }} />
              </div>
            </div>
          )}

          {/* Badge de estado — solo visible si no estamos en transición */}
          {result && !ejercicioFinalizado && !transicionando && (
            <div style={{
              position: 'absolute', top: 16, left: 16,
              padding: '8px 20px', borderRadius: 10,
              background: result.isValid ? 'rgba(0,210,110,0.9)' : 'rgba(220,60,60,0.9)',
              color: '#fff', fontWeight: 'bold', fontSize: '0.85rem',
            }}>
              {result.isValid
                ? `✓ ${paso.nombre} — MANTÉN`
                : `✗ ${getHintHUD(result.keypointResults) ?? 'CORRIGE TU POSTURA'}`}
            </div>
          )}

          {/* Indicadores de repeticiones */}
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: '6px' }}>
            {Array.from({ length: totalRepeticiones }).map((_, i) => (
              <div key={i} style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: i < repActual - 1 ? '#00d26e' : i === repActual - 1 ? '#00d26e88' : '#333',
                border: `2px solid ${i === repActual - 1 ? '#00d26e' : '#333'}`,
              }} />
            ))}
          </div>

          {/* Overlay de ejercicio finalizado */}
          {ejercicioFinalizado && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,210,110,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', backdropFilter: 'blur(12px)', zIndex: 10,
            }}>
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
                  setTransicionando(false)
                }}
                style={{
                  padding: '16px 52px', borderRadius: 40,
                  background: '#00d26e', color: '#000',
                  border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: 20,
                }}
              >
                REPETIR
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 20px 12px', flexShrink: 0,
      }}>
        <div style={{ fontSize: 18, color: '#fff', fontWeight: 600 }}>
          {ejercicioFinalizado
            ? 'SESIÓN COMPLETADA'
            : transicionando
              ? <span style={{ color: '#00d26e' }}>SIGUIENTE POSE</span>
              : !result
                ? 'ESPERANDO USUARIO...'
                : result.isValid
                  ? '¡ASÍ ESTÁ BIEN!'
                  : <span style={{ color: '#ffcc00' }}>
                      {getHintHUD(result.keypointResults)?.toUpperCase() ?? 'CORRIGE TU POSTURA'}
                    </span>
          }
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 24, color: result?.isValid ? '#00d26e' : result ? '#ffcc00' : '#555', fontWeight: '900' }}>
            {result ? Math.round(result.score * 100) : 0}%
          </span>
          <span style={{ fontSize: 11, color: '#555', marginLeft: '8px' }}>PRECISIÓN | {fps} FPS</span>
          {result && !result.isValid && (
            <div style={{ fontSize: 10, color: '#444', marginTop: '2px' }}>
              {getScoreLabel(result.keypointResults)}
            </div>
          )}
        </div>
      </div>

      {/* ── Keyframes para el overlay ────────────────────────────────────── */}
      <style>{`
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes transicionBar {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  )
}
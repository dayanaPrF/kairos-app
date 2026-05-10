"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision"
import { validatePose } from "../lib/poseUtils"
import { getHintVoz, getScoreLabel } from "@/app/lib/HintUtils"
import { MunequitoReferencia } from "./MunequitoReferencia"
import { useSesion } from "@/hooks/useSesion"
import type { EjercicioCompilado, PoseCompiledStep, ValidationResult } from "../lib/poses/types"

const REPEAT_MESSAGE_COOLDOWN = 3000

interface Props {
  ejercicio:          EjercicioCompilado
  onBack:             () => void
  onComplete?:        () => void
  idRutinasPaciente?: string | null
}

export default function PoseDetector({ ejercicio, onBack, onComplete, idRutinasPaciente }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const pasoRef       = useRef<PoseCompiledStep>(ejercicio.pasos[0])
  const yaInicioRef   = useRef(false)

  const totalRepeticiones = ejercicio.repeticiones ?? 1
  const totalPasos        = ejercicio.pasos.length

  const [pasoActual, setPasoActual]                   = useState(0)
  const [repActual, setRepActual]                     = useState(1)
  const [status, setStatus]                           = useState<{ result: ValidationResult | null; fps: number }>({ result: null, fps: 0 })
  const [timeLeft, setTimeLeft]                       = useState(ejercicio.pasos[0].hold_sec || 3)
  const [ejercicioFinalizado, setEjercicioFinalizado] = useState(false)
  const [isVoiceEnabled, setIsVoiceEnabled]           = useState(true)
  const [isCameraReady, setIsCameraReady]             = useState(false)
  const [transicionando, setTransicionando]           = useState(false)
  const [transicionNombre, setTransicionNombre]       = useState('')

  const pasoActualRef          = useRef(0)
  const repActualRef           = useRef(1)
  const transicionandoRef      = useRef(false)
  const ejercicioFinalizadoRef = useRef(false)
  const pasoCompletadoRef      = useRef(false)
  const timerRef               = useRef<NodeJS.Timeout | null>(null)
  const timeLeftRef            = useRef(ejercicio.pasos[0].hold_sec || 3)

  const paso: PoseCompiledStep =
    ejercicio.pasos[pasoActual] ?? ejercicio.pasos[ejercicio.pasos.length - 1]

  const lastSpokenText    = useRef('')
  const lastSpeakTime     = useRef(0)
  const isSpeaking        = useRef(false)
  const lastFrameTime     = useRef(performance.now())
  const frameCount        = useRef(0)
  const lastHintTime      = useRef(0)
  const HINT_COOLDOWN_MS  = 5000
  const isVoiceEnabledRef = useRef(isVoiceEnabled)
  useEffect(() => { isVoiceEnabledRef.current = isVoiceEnabled }, [isVoiceEnabled])

  const { iniciarSesion, acumularScore, cerrarSesion } = useSesion({ idRutinasPaciente })

  useEffect(() => { pasoActualRef.current = pasoActual }, [pasoActual])
  useEffect(() => { repActualRef.current = repActual }, [repActual])
  useEffect(() => { transicionandoRef.current = transicionando }, [transicionando])
  useEffect(() => { ejercicioFinalizadoRef.current = ejercicioFinalizado }, [ejercicioFinalizado])

  useEffect(() => {
    const nuevoPaso = ejercicio.pasos[pasoActual]
    if (!nuevoPaso) return
    pasoRef.current           = nuevoPaso
    pasoCompletadoRef.current = false
    timeLeftRef.current       = nuevoPaso.hold_sec || 3
    setTimeLeft(nuevoPaso.hold_sec || 3)
    setStatus({ result: null, fps: 0 })
  }, [pasoActual, ejercicio.pasos])

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
    if (!isVoiceEnabledRef.current || typeof window === 'undefined') return
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
  }, [getLatinaVoice])

  const speakHintFromLoop = useCallback((
    keypointResults: ValidationResult['keypointResults']
  ) => {
    if (!isVoiceEnabledRef.current || typeof window === 'undefined') return
    const now = Date.now()
    if (now - lastHintTime.current < HINT_COOLDOWN_MS) return
    const hint = getHintVoz(keypointResults)
    if (!hint) return
    lastHintTime.current = now
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(hint)
    const v = getLatinaVoice()
    if (v) u.voice = v
    u.lang = 'es-MX'; u.rate = 1.05
    window.speechSynthesis.speak(u)
  }, [getLatinaVoice])

  const avanzarPaso = useCallback(() => {
    const pasoIdx = pasoActualRef.current
    const repNum  = repActualRef.current

    const esUltimoPaso = pasoIdx + 1 >= totalPasos
    const esUltimaRep  = repNum >= totalRepeticiones

    if (!esUltimoPaso) {
      const siguientePaso = ejercicio.pasos[pasoIdx + 1]
      speak(`Siguiente pose: ${siguientePaso.nombre}`, true)
      setTransicionando(true)
      transicionandoRef.current = true
      setTransicionNombre(siguientePaso.nombre)
      setTimeout(() => {
        setPasoActual(pasoIdx + 1)
        pasoActualRef.current = pasoIdx + 1
        setTransicionando(false)
        transicionandoRef.current = false
      }, 1200)

    } else if (!esUltimaRep) {
      const sigRep = repNum + 1
      speak(`Repetición ${sigRep} de ${totalRepeticiones}`, true)
      setTransicionando(true)
      transicionandoRef.current = true
      setTransicionNombre(`Repetición ${sigRep} · ${ejercicio.pasos[0].nombre}`)
      setTimeout(() => {
        setRepActual(sigRep)
        repActualRef.current = sigRep
        setPasoActual(0)
        pasoActualRef.current = 0
        pasoCompletadoRef.current = false
        timeLeftRef.current = ejercicio.pasos[0].hold_sec || 3
        setTimeLeft(ejercicio.pasos[0].hold_sec || 3)
        setTransicionando(false)
        transicionandoRef.current = false
      }, 1500)

    } else {
      ejercicioFinalizadoRef.current = true
      setEjercicioFinalizado(true)
      speak('¡Ejercicio completado! Excelente trabajo.', true)
      cerrarSesion(true)
      setTimeout(() => onComplete?.(), 0)
    }
  }, [totalPasos, totalRepeticiones, ejercicio.pasos, speak, onComplete, cerrarSesion])

  const isValid   = status.result?.isValid
  const hasPerson = !!status.result

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (
      pasoCompletadoRef.current ||
      ejercicioFinalizadoRef.current ||
      transicionandoRef.current ||
      !hasPerson ||
      !isValid
    ) return

    const pasoActivo = pasoRef.current
    speak(`${pasoActivo.nombre}, mantén`, true)

    timerRef.current = setInterval(() => {
      if (
        pasoCompletadoRef.current ||
        ejercicioFinalizadoRef.current ||
        transicionandoRef.current
      ) {
        clearInterval(timerRef.current!)
        timerRef.current = null
        return
      }

      timeLeftRef.current = timeLeftRef.current - 1
      setTimeLeft(timeLeftRef.current)

      if (timeLeftRef.current <= 4 && timeLeftRef.current > 0) {
        speak(String(timeLeftRef.current), true)
      }

      if (timeLeftRef.current <= 0) {
        clearInterval(timerRef.current!)
        timerRef.current = null
        pasoCompletadoRef.current = true
        avanzarPaso()
      }
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isValid, hasPerson])

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
    yaInicioRef.current = false
  }, [])

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
            iniciarSesion()
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
          const raw = result.landmarks[0]

          const mirrored = raw.map(lm => ({
            x: 1 - lm.x, y: lm.y, z: lm.z, visibility: lm.visibility,
          }))

          const unmirrored = raw.map(lm => ({
            x: 1 - lm.x, y: lm.y, z: lm.z, visibility: lm.visibility,
          }))
          const SWAP: [number, number][] = [
            [11,12],[13,14],[15,16],[17,18],[19,20],[21,22],
            [23,24],[25,26],[27,28],[29,30],[31,32],
            [1,4],[2,5],[3,6],[7,8],[9,10],
          ]
          const forValidation = [...unmirrored]
          for (const [a, b] of SWAP) {
            if (forValidation[a] && forValidation[b]) {
              const tmp = forValidation[a]
              forValidation[a] = forValidation[b]
              forValidation[b] = tmp
            }
          }

          const validation = validatePose(forValidation, pasoRef.current)
          const color      = validation.isValid ? '#00d26e' : '#dc3c3c'

          const drawingUtils = new DrawingUtils(ctx)
          drawingUtils.drawConnectors(mirrored, PoseLandmarker.POSE_CONNECTIONS, { color, lineWidth: 5 })

          if (!validation.isValid) {
            speakHintFromLoop(validation.keypointResults)
          }

          acumularScore(validation.score)

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
    return () => {
      running = false
      cancelAnimationFrame(rafId)
      cerrarSesion(false)
      cleanup()
    }
  }, [ejercicio])

  const { result, fps } = status

  const reiniciar = useCallback(() => {
    pasoActualRef.current          = 0
    repActualRef.current           = 1
    pasoCompletadoRef.current      = false
    transicionandoRef.current      = false
    ejercicioFinalizadoRef.current = false
    timeLeftRef.current            = ejercicio.pasos[0].hold_sec || 3
    pasoRef.current                = ejercicio.pasos[0]
    setPasoActual(0)
    setRepActual(1)
    setEjercicioFinalizado(false)
    setTransicionando(false)
    setTimeLeft(ejercicio.pasos[0].hold_sec || 3)
    setStatus({ result: null, fps: 0 })
    iniciarSesion()
  }, [ejercicio, iniciarSesion])

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
          onClick={() => { cerrarSesion(false); cleanup(); onBack() }}
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

          {/* ── REFERENCIA VISUAL: imagen del catálogo o muñequito ────────── */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', overflow: 'hidden' }}>
            {paso.imagen_url ? (
              // Pose del catálogo → mostrar imagen de referencia
              <img
                src={paso.imagen_url}
                alt={paso.nombre}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  opacity: 0.92,
                }}
              />
            ) : (
              // Pose personalizada (legacy) → mostrar muñequito
              <MunequitoReferencia
                articulaciones={paso.keypoints.map(kp => ({
                  nombre_articulacion: kp.nombreArticulacion ?? '',
                  angulo: Math.round((kp.minAngle + kp.maxAngle) / 2),
                  tolerancia: Math.round((kp.maxAngle - kp.minAngle) / 2),
                }))}
                size={1.4}
                mostrarLeyenda={true}
              />
            )}
          </div>
        </div>

        {/* PANEL DERECHO — cámara */}
        <div style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          background: '#000', border: '1px solid #222',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!isCameraReady && !yaInicioRef.current && (
            <div style={{ color: '#00d26e', fontSize: '1.1rem', letterSpacing: '2px', position: 'absolute', zIndex: 5 }}>
              INICIALIZANDO SISTEMA...
            </div>
          )}

          <canvas
            ref={canvasRef}
            style={{
              height: '100%', width: '100%', objectFit: 'contain',
              display: (isCameraReady || yaInicioRef.current) ? 'block' : 'none',
            }}
          />

          {/* Overlay de transición entre poses */}
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
              }}>✓</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#00d26e', fontSize: '0.75rem', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>
                  ¡Pose completada!
                </div>
                <div style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 800 }}>{transicionNombre}</div>
                <div style={{ color: '#555', fontSize: '0.8rem', marginTop: '6px' }}>Prepárate...</div>
              </div>
              <div style={{ width: '160px', height: '3px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{ height: '100%', background: '#00d26e', borderRadius: '2px', animation: 'transicionBar 1.2s linear forwards' }} />
              </div>
            </div>
          )}

          {/* Chips de articulaciones */}
          {result && !ejercicioFinalizado && !transicionando && (
            <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {result.isValid ? (
                <div style={{
                  padding: '10px 22px', borderRadius: 12,
                  background: 'rgba(0,210,110,0.92)',
                  color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                  letterSpacing: '0.5px',
                  boxShadow: '0 0 20px rgba(0,210,110,0.4)',
                }}>
                  ✓ {paso.nombre} — MANTÉN
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxWidth: '340px' }}>
                  {result.keypointResults
                    .filter(r => r.actual !== null)
                    .map((r, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '4px 10px', borderRadius: '20px',
                        background: r.passed ? 'rgba(0,210,110,0.85)' : 'rgba(0,0,0,0.65)',
                        border: `1px solid ${r.passed ? '#00d26e' : 'rgba(255,255,255,0.15)'}`,
                        fontSize: '0.75rem', fontWeight: 700,
                        color: r.passed ? '#fff' : 'rgba(255,255,255,0.7)',
                        backdropFilter: 'blur(4px)',
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: r.passed ? '#fff' : '#dc3c3c' }} />
                        {r.nombreArticulacion}
                        {r.actual !== null && <span style={{ opacity: 0.6, fontWeight: 400 }}>{Math.round(r.actual)}°</span>}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Puntos de repetición */}
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: '6px' }}>
            {Array.from({ length: totalRepeticiones }).map((_, i) => (
              <div key={i} style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: i < repActual - 1 ? '#00d26e' : i === repActual - 1 ? '#00d26e88' : '#333',
                border: `2px solid ${i === repActual - 1 ? '#00d26e' : '#333'}`,
              }} />
            ))}
          </div>

          {/* Pantalla de ejercicio finalizado */}
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
                onClick={reiniciar}
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
                ? <span style={{ color: '#555' }}>ESPERANDO USUARIO...</span>
                : result.isValid
                  ? <span style={{ color: '#00d26e' }}>¡ASÍ ESTÁ BIEN!</span>
                  : <span style={{ color: '#555', fontSize: 14 }}>{getScoreLabel(result.keypointResults)}</span>
          }
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: result?.isValid ? '#00d26e' : result ? '#ffcc00' : '#555' }}>
            {result ? Math.round(result.score * 100) : 0}%
          </span>
          <span style={{ fontSize: 11, color: '#444', marginLeft: '8px' }}>PRECISIÓN | {fps} FPS</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes transicionBar  { from { width: 0%; } to { width: 100%; } }
      `}</style>
    </div>
  )
}
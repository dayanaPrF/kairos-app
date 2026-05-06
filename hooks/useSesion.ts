/**
 * useSesion.ts
 * Hook que encapsula toda la lógica de persistencia de sesiones en Supabase.
 *
 * Protecciones implementadas:
 * - Ref `cerradaRef` evita que cerrarSesion se ejecute dos veces
 * - `beforeunload` marca la sesión como parcial si el usuario cierra la pestaña
 * - iniciarSesion solo se llama cuando la cámara YA está lista (no durante setup)
 */
import { useRef, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface UseSesionOptions {
  idRutinasPaciente?: string | null
}

export function useSesion({ idRutinasPaciente }: UseSesionOptions = {}) {
  const idSesionRef = useRef<string | null>(null)
  const inicioRef   = useRef<number>(0)
  const puntosRef   = useRef<number[]>([])
  // ── Guardia: evita doble cierre ───────────────────────────────────────────
  const cerradaRef  = useRef(false)

  // ── beforeunload: cierre de pestaña / refresh ─────────────────────────────
  // fetch con keepalive=true es lo más confiable para requests al cerrar la página
  useEffect(() => {
    const handler = () => {
      if (!idSesionRef.current || cerradaRef.current) return
      const patchUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sesion_entrenamiento`
        + `?id_sesion_entrenamiento=eq.${idSesionRef.current}`

      fetch(patchUrl, {
        method: 'PATCH',
        keepalive: true,   // el browser completa el request aunque la página cierre
        headers: {
          'Content-Type':  'application/json',
          'apikey':        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({ estado_sesion: 'parcial' }),
      }).catch(() => {/* página cerrándose — ignorar */})
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  /** Llama esto solo cuando la cámara está lista y MediaPipe cargó correctamente */
  const iniciarSesion = useCallback(async () => {
    // Reset de guardia — necesario si el usuario presiona "Repetir"
    cerradaRef.current = false
    puntosRef.current  = []

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const hoy = new Date().toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('sesion_entrenamiento')
        .insert({
          fecha:              hoy,
          estado_sesion:      'parcial',
          id_paciente:        user.id,
          id_rutina_paciente: idRutinasPaciente ?? null,
        })
        .select('id_sesion_entrenamiento')
        .single()

      if (error) { console.error('[useSesion] insert error', error); return }

      idSesionRef.current = data.id_sesion_entrenamiento
      inicioRef.current   = performance.now()

      console.log('[useSesion] sesión iniciada:', idSesionRef.current)
    } catch (err) {
      console.error('[useSesion] iniciarSesion error', err)
    }
  }, [idRutinasPaciente])

  /** Acumula un score (0–1) por frame. Llamar desde el loop de RAF. */
  const acumularScore = useCallback((score: number) => {
    puntosRef.current.push(score)
  }, [])

  /**
   * Cierra la sesión — idempotente gracias a cerradaRef.
   * Puede llamarse desde el botón "Volver", desde avanzarPaso al completar,
   * y desde el cleanup del useEffect — solo la primera llamada tiene efecto.
   *
   * @param completada true = ejercicio terminó; false = cancelada / salida anticipada
   */
  const cerrarSesion = useCallback(async (completada: boolean) => {
    // ── Guardia ──────────────────────────────────────────────────────────────
    if (cerradaRef.current || !idSesionRef.current) return
    cerradaRef.current  = true

    const idSesion      = idSesionRef.current
    idSesionRef.current = null  // limpiar ref de inmediato para evitar races

    try {
      const duracionMs  = performance.now() - inicioRef.current
      const duracionSec = Math.max(0, Math.round(duracionMs / 1000))
      const hh = String(Math.floor(duracionSec / 3600)).padStart(2, '0')
      const mm = String(Math.floor((duracionSec % 3600) / 60)).padStart(2, '0')
      const ss = String(duracionSec % 60).padStart(2, '0')
      const intervalo = `${hh}:${mm}:${ss}`

      const scores       = puntosRef.current
      const puntuacionIA = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10000) / 100
        : null

      const { error } = await supabase
        .from('sesion_entrenamiento')
        .update({
          estado_sesion:  completada ? 'completada' : 'parcial',
          duracion_total: intervalo,
        })
        .eq('id_sesion_entrenamiento', idSesion)

      if (error) { console.error('[useSesion] update error', error); return }

      // Guardar métricas solo si hay datos de IA
      if (puntuacionIA !== null) {
        await supabase.from('metricas_vision').insert({
          id_sesion_entrenamiento: idSesion,
          puntuacion_ia:           puntuacionIA,
          datos_crudos: {
            total_frames:   scores.length,
            score_promedio: puntuacionIA,
            score_maximo:   Math.round(Math.max(...scores) * 10000) / 100,
            completada,
          },
        })
      }

      console.log('[useSesion] sesión cerrada:', { completada, duracion: intervalo, puntuacionIA })
    } catch (err) {
      console.error('[useSesion] cerrarSesion error', err)
    }
  }, [])

  return { iniciarSesion, acumularScore, cerrarSesion }
}
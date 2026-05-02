import { supabase } from '@/lib/supabase'
import type {
  PoseDB,
  ArticulacionConfig,
  PoseCompiledStep,
  EjercicioCompilado,
} from './types'

/**
 * Toma un ejercicio crudo de Supabase y lo "compila" al formato
 * que PoseDetector y validatePose necesitan, inyectando los
 * puntos_mediapipe de ai_articulacion_config.
 */
export async function compilarEjercicio(
  ejercicio: {
    id_ejercicio: string
    nombre_ejercicio: string
    descripcion: string | null
    icono: string | null
    repeticiones: number | null
    secuencia_poses: PoseDB[] | null
    secuencia_poses_personalizada: PoseDB[] | null
    // ✅ Puede llegar como objeto o como array según Supabase
    biblioteca_ejercicio: { secuencia_poses: PoseDB[] } | { secuencia_poses: PoseDB[] }[] | null
  }
): Promise<EjercicioCompilado | null> {
    // 1. Determinar qué secuencia de poses usar
    // Supabase puede devolver biblioteca_ejercicio como array o como objeto según el join
    // En compilarEjercicio, justo al inicio de la función:
    console.log('🔍 biblioteca_ejercicio raw:', JSON.stringify(ejercicio.biblioteca_ejercicio))
    console.log('🔍 secuencia_poses:', ejercicio.secuencia_poses)
    console.log('🔍 secuencia_poses_personalizada:', ejercicio.secuencia_poses_personalizada)

    const bibRaw = ejercicio.biblioteca_ejercicio
    const bib = Array.isArray(bibRaw) ? bibRaw[0] : bibRaw

    console.log('🔍 bib resuelto:', JSON.stringify(bib))
    console.log('🔍 poses finales:', JSON.stringify(
    ejercicio.secuencia_poses_personalizada ??
    bib?.secuencia_poses ??
    ejercicio.secuencia_poses ??
    []
    ))

    const poses: PoseDB[] =
    ejercicio.secuencia_poses_personalizada ??
    bib?.secuencia_poses ??
    ejercicio.secuencia_poses ??
    []

  if (poses.length === 0) return null  // ejercicio sin IA, no compilable

  // 2. Recolectar todos los id_articulacion únicos que necesitamos
  const idsNecesarios = new Set<string>()
  for (const pose of poses) {
    for (const art of pose.articulaciones) {
      idsNecesarios.add(art.id_articulacion)
    }
  }

  if (idsNecesarios.size === 0) return null

  // 3. Traer los puntos_mediapipe de esas articulaciones
  const { data: configs, error } = await supabase
    .from('ai_articulacion_config')
    .select('id_articulacion, nombre_articulacion, puntos_mediapipe')
    .in('id_articulacion', Array.from(idsNecesarios))

  if (error || !configs?.length) {
    console.error('Error cargando ai_articulacion_config:', error)
    return null
  }

  // Mapa rápido id → config
  const configMap = new Map<string, ArticulacionConfig>(
    configs.map(c => [c.id_articulacion, c])
  )

  // 4. Compilar cada pose
  const pasos: PoseCompiledStep[] = poses
    .sort((a, b) => a.orden - b.orden)
    .map(pose => ({
      orden: pose.orden,
      nombre: pose.nombre,
      hold_sec: pose.hold_sec,
      keypoints: pose.articulaciones.flatMap(art => {
        const cfg = configMap.get(art.id_articulacion)
        if (!cfg || cfg.puntos_mediapipe.length < 3) return []

        const [idxA, idxB, idxC] = cfg.puntos_mediapipe.map(Number)
        return [{
          landmark: idxB,              // vértice
          relativeTo: idxA,
          anchor: idxC,
          minAngle: art.angulo - art.tolerancia,
          maxAngle: art.angulo + art.tolerancia,
          nombreArticulacion: art.nombre_articulacion,
        }]
      }),
    }))
    .filter(p => p.keypoints.length > 0)  // descartar poses sin articulaciones válidas

  if (pasos.length === 0) return null

  return {
    id_ejercicio: ejercicio.id_ejercicio,
    nombre_ejercicio: ejercicio.nombre_ejercicio,
    descripcion: ejercicio.descripcion,
    icono: ejercicio.icono,
    repeticiones: ejercicio.repeticiones,
    pasos,
  }
}
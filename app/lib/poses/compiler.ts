import { supabase } from '@/lib/supabase'
import type {
  PoseDB,
  ArticulacionConfig,
  PoseCompiledStep,
  EjercicioCompilado,
} from './types'
import { convertirAnguloMunequitoAMediaPipe } from '@/app/lib/poses/angleConverter'

/**
 * Tolerancia mínima en grados que se aplica en CADA dirección.
 *
 * Si en BD guardas angulo=90, tolerancia=5 → rango sería [85, 95] (solo 10°).
 * Con MIN_TOLERANCE=15 el rango efectivo será [75, 105] (30°), mucho más
 * alcanzable con el ruido real de cámara y variaciones de postura.
 *
 * Ajusta este valor según qué tan estricto quieras el sistema:
 *   - 10° → ejercicios precisos (fisioterapia muy controlada)
 *   - 15° → balance entre precisión y usabilidad  ← recomendado
 *   - 20° → muy permisivo, bueno para onboarding
 *
 * La tolerancia de BD sigue siendo el objetivo visual en el muñequito,
 * pero en runtime se usa max(tolerancia_BD, MIN_TOLERANCE).
 */
const MIN_TOLERANCE_DEG = 15

/**
 * Toma un ejercicio crudo de Supabase y lo "compila" al formato
 * que PoseDetector y validatePose necesitan.
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
    biblioteca_ejercicio: { secuencia_poses: PoseDB[] } | { secuencia_poses: PoseDB[] }[] | null
  }
): Promise<EjercicioCompilado | null> {

  // 1. Resolver qué secuencia de poses usar
  const bibRaw = ejercicio.biblioteca_ejercicio
  const bib    = Array.isArray(bibRaw) ? bibRaw[0] : bibRaw

  const poses: PoseDB[] =
    ejercicio.secuencia_poses_personalizada ??
    bib?.secuencia_poses ??
    ejercicio.secuencia_poses ??
    []

  if (poses.length === 0) return null

  // 2. Recolectar todos los id_articulacion únicos necesarios
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

  const configMap = new Map<string, ArticulacionConfig>(
    configs.map(c => [c.id_articulacion, c])
  )

  // 4. Compilar cada pose aplicando tolerancia mínima garantizada
  const pasos: PoseCompiledStep[] = poses
    .sort((a, b) => a.orden - b.orden)
    .map(pose => ({
      orden:    pose.orden,
      nombre:   pose.nombre,
      hold_sec: pose.hold_sec,
      keypoints: pose.articulaciones.flatMap(art => {
        const cfg = configMap.get(art.id_articulacion)
        if (!cfg || cfg.puntos_mediapipe.length < 3) return []

        const [idxA, idxB, idxC] = cfg.puntos_mediapipe.map(Number)

        // ── Convertir ángulo del muñequito al sistema de MediaPipe ────────────
        const anguloConvertido   = convertirAnguloMunequitoAMediaPipe(art.angulo, art.nombre_articulacion)
        const toleranciaEfectiva = Math.max(art.tolerancia, MIN_TOLERANCE_DEG)
        const minAngle           = Math.max(0,   anguloConvertido - toleranciaEfectiva)
        const maxAngle           = Math.min(180, anguloConvertido + toleranciaEfectiva)

        // ── ORDEN DE puntos_mediapipe EN BD ───────────────────────────────────
        // La convención que usa este compiler es:
        //   [0] = idxA  → punto extremo A  (ej: muñeca)
        //   [1] = idxB  → VÉRTICE           (ej: hombro)  ← donde se mide el ángulo
        //   [2] = idxC  → punto extremo C  (ej: cadera)
        //
        // Si ves ángulos incorrectos (~30° cuando debería ser ~150°), el orden
        // en BD probablemente está como [vértice, A, C] en lugar de [A, vértice, C].
        //
        // Índices MediaPipe:
        //   11=hombro izq  12=hombro der  13=codo izq  14=codo der
        //   15=muñeca izq  16=muñeca der  23=cadera izq 24=cadera der
        //   25=rodilla izq 26=rodilla der 27=tobillo izq 28=tobillo der
        //
        // HOMBRO DERECHO correcto: ["16", "12", "24"]  (muñeca → hombro ← cadera)
        // CODO DERECHO correcto:   ["12", "14", "16"]  (hombro → codo ← muñeca)

        if (process.env.NODE_ENV === 'development') {
          console.info(
            `[compiler] ${art.nombre_articulacion}: ` +
            `puntos=[${idxA}, ${idxB}(vértice), ${idxC}] ` +
            `BD=${art.angulo}° → convertido=${anguloConvertido}° ` +
            `±${toleranciaEfectiva}° → rango [${minAngle}°, ${maxAngle}°]`
          )
        }

        return [{
          landmark:           idxB,
          relativeTo:         idxA,
          anchor:             idxC,
          minAngle,
          maxAngle,
          nombreArticulacion: art.nombre_articulacion,
        }]
      }),
    }))
    .filter(p => p.keypoints.length > 0)

  if (pasos.length === 0) return null

  return {
    id_ejercicio:     ejercicio.id_ejercicio,
    nombre_ejercicio: ejercicio.nombre_ejercicio,
    descripcion:      ejercicio.descripcion,
    icono:            ejercicio.icono,
    repeticiones:     ejercicio.repeticiones,
    pasos,
  }
}
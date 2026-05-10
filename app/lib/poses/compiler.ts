import { supabase } from '@/lib/supabase'
import type {
  PoseDB,
  ArticulacionConfig,
  KeypointRule,
  PoseCompiledStep,
  EjercicioCompilado,
} from './types'
import { detectarTipo } from '@/app/lib/poses/angleConverter'

// ─── Tipos del catálogo ───────────────────────────────────────────────────────

export interface PoseCatalogo {
  id_pose:     string
  nombre:      string
  descripcion: string | null
  imagen_url:  string | null
  categoria:   string | null
  dificultad:  number
  keypoints:   KeypointRule[]
}

export interface PoseSecuenciaItem {
  orden:           number
  id_pose:         string
  hold_sec:        number
  nombre_override: string | null
}

export interface EjercicioCatalogo {
  id_ejercicio_catalogo:  string
  nombre:                 string
  descripcion:            string | null
  imagen_url:             string | null
  icono:                  string | null
  categoria:              string | null
  dificultad:             number
  repeticiones_sugeridas: number | null
  poses_secuencia:        PoseSecuenciaItem[]
}

// ─── Tipo extendido para soportar Modo 2 ─────────────────────────────────────
interface PoseDBConIdPose extends PoseDB {
  id_pose?: string
}

// ─── Tolerancia mínima ────────────────────────────────────────────────────────
const MIN_TOLERANCE: Record<string, number> = {
  hombro:  15, codo:    15, rodilla: 15,
  cadera:  20, tobillo: 20, tronco:  10, cuello: 10,
}

function getTolerance(nombreArticulacion: string, toleranciaDB: number): number {
  const tipo = detectarTipo(nombreArticulacion)
  return Math.max(toleranciaDB, tipo ? (MIN_TOLERANCE[tipo] ?? 15) : 15)
}

// ══════════════════════════════════════════════════════════════════════════════
// compilarEjercicio
// ══════════════════════════════════════════════════════════════════════════════
export async function compilarEjercicio(
  ejercicio: {
    id_ejercicio:                  string
    nombre_ejercicio:              string
    descripcion:                   string | null
    icono:                         string | null
    repeticiones:                  number | null
    id_ejercicio_catalogo?:        string | null
    secuencia_poses:               PoseDBConIdPose[] | null
    secuencia_poses_personalizada: PoseDB[] | null
    biblioteca_ejercicio:
      | { secuencia_poses: PoseDB[] }
      | { secuencia_poses: PoseDB[] }[]
      | null
  }
): Promise<EjercicioCompilado | null> {

  if (ejercicio.id_ejercicio_catalogo) {
    return compilarDesde_Catalogo(ejercicio)
  }

  const posesConIdPose = (ejercicio.secuencia_poses ?? []).filter(p => !!(p as any).id_pose)
  if (posesConIdPose.length > 0) {
    return compilarDesde_PosesCatalogo(ejercicio, posesConIdPose)
  }

  return compilarDesde_Legacy(ejercicio)
}

// ─── Modo 1: ejercicio predefinido del catálogo ───────────────────────────────

async function compilarDesde_Catalogo(ejercicio: {
  id_ejercicio:           string
  nombre_ejercicio:       string
  descripcion:            string | null
  icono:                  string | null
  repeticiones:           number | null
  id_ejercicio_catalogo?: string | null
}): Promise<EjercicioCompilado | null> {

  const { data: ejCat, error: errEj } = await supabase
    .from('ai_ejercicio_catalogo')
    .select('nombre, icono, repeticiones_sugeridas, poses_secuencia')
    .eq('id_ejercicio_catalogo', ejercicio.id_ejercicio_catalogo!)
    .single()

  if (errEj || !ejCat) {
    console.error('[Compiler Modo 1] catálogo no encontrado:', errEj)
    return null
  }

  const secuencia = ejCat.poses_secuencia as PoseSecuenciaItem[]
  if (!secuencia?.length) return null

  const poseIds = secuencia.map(s => s.id_pose)

  // ← ahora también traemos imagen_url
  const { data: poses, error: errPoses } = await supabase
    .from('ai_pose_catalogo')
    .select('id_pose, nombre, keypoints, imagen_url')
    .in('id_pose', poseIds)

  if (errPoses || !poses?.length) {
    console.error('[Compiler Modo 1] poses no encontradas:', errPoses)
    return null
  }

  const poseMap = new Map(poses.map(p => [p.id_pose, p]))

  const pasos: PoseCompiledStep[] = secuencia
    .sort((a, b) => a.orden - b.orden)
    .flatMap(item => {
      const pose = poseMap.get(item.id_pose)
      if (!pose) return []
      const keypoints = pose.keypoints as KeypointRule[]
      if (!keypoints?.length) return []
      return [{
        orden:     item.orden,
        nombre:    item.nombre_override ?? pose.nombre,
        hold_sec:  item.hold_sec,
        keypoints,
        imagen_url: (pose as any).imagen_url ?? null,  // ← imagen de referencia
      }]
    })

  if (!pasos.length) return null

  return {
    id_ejercicio:     ejercicio.id_ejercicio,
    nombre_ejercicio: ejercicio.nombre_ejercicio || ejCat.nombre,
    descripcion:      ejercicio.descripcion,
    icono:            ejercicio.icono ?? ejCat.icono,
    repeticiones:     ejercicio.repeticiones ?? ejCat.repeticiones_sugeridas,
    pasos,
  }
}

// ─── Modo 2: poses sueltas del catálogo ──────────────────────────────────────

async function compilarDesde_PosesCatalogo(
  ejercicio: {
    id_ejercicio:     string
    nombre_ejercicio: string
    descripcion:      string | null
    icono:            string | null
    repeticiones:     number | null
  },
  posesSecuencia: PoseDBConIdPose[]
): Promise<EjercicioCompilado | null> {

  const poseIds = posesSecuencia
    .map(p => (p as any).id_pose as string)
    .filter(Boolean)

  // ← ahora también traemos imagen_url
  const { data: posesCatalogo, error } = await supabase
    .from('ai_pose_catalogo')
    .select('id_pose, nombre, keypoints, imagen_url')
    .in('id_pose', poseIds)

  if (error || !posesCatalogo?.length) {
    console.error('[Compiler Modo 2] poses del catálogo no encontradas:', error)
    return null
  }

  const poseMap = new Map(posesCatalogo.map(p => [p.id_pose, p]))

  const pasos: PoseCompiledStep[] = posesSecuencia
    .sort((a, b) => a.orden - b.orden)
    .flatMap(poseSeq => {
      const id_pose = (poseSeq as any).id_pose as string
      const poseCat = poseMap.get(id_pose)
      if (!poseCat) return []
      const keypoints = poseCat.keypoints as KeypointRule[]
      if (!keypoints?.length) return []
      return [{
        orden:     poseSeq.orden,
        nombre:    poseSeq.nombre || poseCat.nombre,
        hold_sec:  poseSeq.hold_sec,
        keypoints,
        imagen_url: (poseCat as any).imagen_url ?? null,  // ← imagen de referencia
      }]
    })

  if (!pasos.length) return null

  return {
    id_ejercicio:     ejercicio.id_ejercicio,
    nombre_ejercicio: ejercicio.nombre_ejercicio,
    descripcion:      ejercicio.descripcion,
    icono:            ejercicio.icono,
    repeticiones:     ejercicio.repeticiones,
    pasos,
  }
}

// ─── Modo 3: flujo legacy con articulaciones ─────────────────────────────────

async function compilarDesde_Legacy(ejercicio: {
  id_ejercicio:                  string
  nombre_ejercicio:              string
  descripcion:                   string | null
  icono:                         string | null
  repeticiones:                  number | null
  secuencia_poses:               PoseDB[] | null
  secuencia_poses_personalizada: PoseDB[] | null
  biblioteca_ejercicio:
    | { secuencia_poses: PoseDB[] }
    | { secuencia_poses: PoseDB[] }[]
    | null
}): Promise<EjercicioCompilado | null> {

  const bibRaw = ejercicio.biblioteca_ejercicio
  const bib    = Array.isArray(bibRaw) ? bibRaw[0] : bibRaw

  const poses: PoseDB[] =
    ejercicio.secuencia_poses_personalizada ??
    bib?.secuencia_poses ??
    ejercicio.secuencia_poses ??
    []

  if (!poses.length) return null

  const idsNecesarios = new Set<string>()
  for (const pose of poses)
    for (const art of pose.articulaciones)
      idsNecesarios.add(art.id_articulacion)

  if (!idsNecesarios.size) return null

  const { data: configs, error } = await supabase
    .from('ai_articulacion_config')
    .select('id_articulacion, nombre_articulacion, puntos_mediapipe')
    .in('id_articulacion', Array.from(idsNecesarios))

  if (error || !configs?.length) return null

  const configMap = new Map<string, ArticulacionConfig>(
    configs.map(c => [c.id_articulacion, c])
  )

  const pasos: PoseCompiledStep[] = poses
    .sort((a, b) => a.orden - b.orden)
    .map(pose => ({
      orden:    pose.orden,
      nombre:   pose.nombre,
      hold_sec: pose.hold_sec,
      imagen_url: null,   // ← legacy siempre usa muñequito
      keypoints: pose.articulaciones.flatMap(art => {
        const cfg = configMap.get(art.id_articulacion)
        if (!cfg || cfg.puntos_mediapipe.length < 3) return []
        const [idxA, idxB, idxC] = cfg.puntos_mediapipe.map(Number)
        const anguloMP           = art.angulo
        const toleranciaEfectiva = getTolerance(art.nombre_articulacion, art.tolerancia)
        const esExtremoAlto      = anguloMP >= 155
        const esExtremoBajo      = anguloMP <= 25
        return [{
          landmark:           idxB,
          relativeTo:         idxA,
          anchor:             idxC,
          minAngle:           esExtremoBajo ? 0   : Math.max(0,   anguloMP - toleranciaEfectiva),
          maxAngle:           esExtremoAlto ? 180 : Math.min(180, anguloMP + toleranciaEfectiva),
          nombreArticulacion: art.nombre_articulacion,
        }]
      }),
    }))
    .filter(p => p.keypoints.length > 0)

  if (!pasos.length) return null

  return {
    id_ejercicio:     ejercicio.id_ejercicio,
    nombre_ejercicio: ejercicio.nombre_ejercicio,
    descripcion:      ejercicio.descripcion,
    icono:            ejercicio.icono,
    repeticiones:     ejercicio.repeticiones,
    pasos,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers para el builder del fisio
// ══════════════════════════════════════════════════════════════════════════════

export async function cargarPosesCatalogo(): Promise<PoseCatalogo[]> {
  const { data, error } = await supabase
    .from('ai_pose_catalogo')
    .select('id_pose, nombre, descripcion, imagen_url, categoria, dificultad, keypoints')
    .eq('activa', true)
    .order('categoria')
    .order('nombre')
  if (error) { console.error('cargarPosesCatalogo:', error); return [] }
  return (data ?? []) as PoseCatalogo[]
}

export async function cargarEjerciciosCatalogo(): Promise<EjercicioCatalogo[]> {
  const { data, error } = await supabase
    .from('ai_ejercicio_catalogo')
    .select('id_ejercicio_catalogo, nombre, descripcion, imagen_url, icono, categoria, dificultad, repeticiones_sugeridas, poses_secuencia')
    .eq('activo', true)
    .order('categoria')
    .order('nombre')
  if (error) { console.error('cargarEjerciciosCatalogo:', error); return [] }
  return (data ?? []) as EjercicioCatalogo[]
}
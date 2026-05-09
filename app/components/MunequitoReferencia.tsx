'use client'

import { useRef, useEffect, useCallback, useMemo } from 'react'

export interface PoseArticulacionSimple {
  id_articulacion?: string
  nombre_articulacion: string
  angulo: number
  tolerancia: number
}

interface Props {
  articulaciones: PoseArticulacionSimple[]
  onAnguloChange?: (nombre_articulacion: string, nuevoAngulo: number) => void
  size?: number
  mostrarLeyenda?: boolean
}

// ─── Colores ──────────────────────────────────────────────────────────────────
const BLUE = '#378ADD'
const DARK = '#185FA5'
const GRAY = '#888780'
const SKIN = '#D8D6CC'
const WHITE = '#ffffff'
const ARC  = 'rgba(55,138,221,0.22)'

// ─── Definición de articulaciones ─────────────────────────────────────────────
// [A, B_vértice, C] — idéntico a ai_articulacion_config
// draggable = índice MediaPipe del punto que el usuario arrastra
//
// REGLA: el punto arrastrable es siempre el que más cambia visualmente
// cuando se modifica esa articulación:
//   Hombro    → mover la muñeca cambia el ángulo hombro [muñeca→hombro→cadera]
//   Codo      → mover la muñeca también afecta al codo [hombro→codo→muñeca]
//   Cadera    → mover la rodilla cambia el ángulo cadera [hombro→cadera→rodilla]
//   Rodilla   → mover el tobillo cambia el ángulo rodilla [cadera→rodilla→tobillo]
//   Tobillo   → mover el pie cambia el ángulo tobillo [rodilla→tobillo→pie]
// ─────────────────────────────────────────────────────────────────────────────
const JOINT_DEFS: Record<string, { A: number; B: number; C: number; draggable: number }> = {
  'hombro izquierdo':  { A: 15, B: 11, C: 23, draggable: 15 },
  'hombro derecho':    { A: 16, B: 12, C: 24, draggable: 16 },
  'codo izquierdo':    { A: 11, B: 13, C: 15, draggable: 15 },
  'codo derecho':      { A: 12, B: 14, C: 16, draggable: 16 },
  'cadera izquierda':  { A: 11, B: 23, C: 25, draggable: 25 },
  'cadera derecha':    { A: 12, B: 24, C: 26, draggable: 26 },
  'tronco izquierdo':  { A: 11, B: 23, C: 25, draggable: 25 },
  'tronco derecho':    { A: 12, B: 24, C: 26, draggable: 26 },
  'rodilla izquierda': { A: 23, B: 25, C: 27, draggable: 27 },
  'rodilla derecha':   { A: 24, B: 26, C: 28, draggable: 28 },
  'tobillo izquierdo': { A: 25, B: 27, C: 31, draggable: 31 },
  'tobillo derecho':   { A: 26, B: 28, C: 32, draggable: 32 },
  'cuello':            { A: 11, B: 0,  C: 12, draggable: 0  },
}

// ─── Ángulo entre 3 puntos ────────────────────────────────────────────────────
function angleBetween(
  A: { x: number; y: number },
  B: { x: number; y: number },
  C: { x: number; y: number }
): number {
  const v1x = A.x - B.x, v1y = A.y - B.y
  const v2x = C.x - B.x, v2y = C.y - B.y
  const dot = v1x * v2x + v1y * v2y
  const m1 = Math.sqrt(v1x ** 2 + v1y ** 2)
  const m2 = Math.sqrt(v2x ** 2 + v2y ** 2)
  if (m1 < 1e-6 || m2 < 1e-6) return 0
  return Math.round(Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180 / Math.PI)
}

// ─── Pose base calibrada para T-pose real ─────────────────────────────────────
//
// Estos valores reflejan lo que MediaPipe REALMENTE mide en una T-pose frontal:
//
//   Hombro ~90°:
//     muñeca(15) está horizontal respecto a hombro(11), y cadera(23) está abajo.
//     El ángulo [muñeca→hombro→cadera] ≈ 90°.
//
//   Codo ~140°:  ← NO 180°. En T-pose frontal, los brazos no quedan perfectamente
//     rectos vistos de frente. MediaPipe mide el ángulo 3D proyectado y el
//     húmero vs antebrazo dan ~130-150° en persona real. Usamos 140° como base.
//
//   Cadera ~170°: hombro(11), cadera(23) y rodilla(25) casi en línea vertical.
//   Rodilla ~170°: cadera(23), rodilla(25) y tobillo(27) casi en línea vertical.
//   Tobillo ~90°: rodilla(25), tobillo(27) y pie(31) forman ~90° neutro.
//
// viewBox: 200 × 310
// ─────────────────────────────────────────────────────────────────────────────
function getBaseLandmarks(W: number, S: number): Record<number, { x: number; y: number }> {
  const cx = W / 2
  return {
    0:  { x: cx,        y: 18  * S },  // nariz
    11: { x: cx - 28,   y: 62  * S },  // hombro izq  (paciente)
    12: { x: cx + 28,   y: 62  * S },  // hombro der  (paciente)
    13: { x: cx - 60,   y: 68  * S },  // codo izq    — ligeramente bajo para dar ~140° en T-pose
    14: { x: cx + 60,   y: 68  * S },  // codo der
    15: { x: cx - 95,   y: 74  * S },  // muñeca izq  — horizontal con hombro
    16: { x: cx + 95,   y: 74  * S },  // muñeca der
    23: { x: cx - 18,   y: 145 * S },  // cadera izq
    24: { x: cx + 18,   y: 145 * S },  // cadera der
    25: { x: cx - 20,   y: 218 * S },  // rodilla izq
    26: { x: cx + 20,   y: 218 * S },  // rodilla der
    27: { x: cx - 18,   y: 284 * S },  // tobillo izq
    28: { x: cx + 18,   y: 284 * S },  // tobillo der
    31: { x: cx - 30,   y: 300 * S },  // pie izq
    32: { x: cx + 30,   y: 300 * S },  // pie der
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function MunequitoReferencia({
  articulaciones,
  onAnguloChange,
  size = 1,
  mostrarLeyenda = true,
}: Props) {
  const canvasRef         = useRef<HTMLCanvasElement>(null)
  const draggingRef       = useRef<number | null>(null)
  const lmRef             = useRef<Record<number, { x: number; y: number }>>({})
  const articulacionesRef = useRef(articulaciones)
  articulacionesRef.current = articulaciones

  const W = Math.round(200 * size)
  const H = Math.round(310 * size)
  const S = size

  // Longitudes de hueso calculadas UNA vez desde la pose base
  const boneLengths = useMemo(() => {
    const base = getBaseLandmarks(W, S)
    const lengths: Record<number, number> = {}
    const pairs: [number, number][] = [
      [11, 13], [13, 15], [12, 14], [14, 16],
      [23, 25], [25, 27], [24, 26], [26, 28],
      [27, 31], [28, 32],
    ]
    for (const [p, c] of pairs) {
      lengths[c] = Math.hypot(base[c].x - base[p].x, base[c].y - base[p].y)
    }
    return lengths
  }, [W, S])

  // ── Inicializar landmarks desde ángulos guardados ─────────────────────────
  //
  // Para cada articulación activa, calcula dónde debe quedar el punto
  // draggable para que angleBetween(A,B,C) == art.angulo.
  //
  // Estrategia:
  //   1. El punto B (vértice) es fijo en la base.
  //   2. El punto A es fijo en la base.
  //   3. Queremos colocar el punto draggable (C o A según la articulación)
  //      tal que el ángulo en B sea el deseado.
  //
  //   Dirección de referencia: vector B→A (en la pose base).
  //   Rotamos ese vector para que forme `angulo` grados con el otro brazo.
  //
  //   Como angleBetween es simétrico, necesitamos saber en qué "lado" rotar.
  //   Usamos el signo del cross product para mantener coherencia visual.
  // ─────────────────────────────────────────────────────────────────────────
  const initLandmarks = useCallback(() => {
    const lm = getBaseLandmarks(W, S)

    for (const art of articulacionesRef.current) {
      const key  = art.nombre_articulacion.toLowerCase().trim()
      const jdef = JOINT_DEFS[key]
      if (!jdef) continue

      const B = lm[jdef.B]
      const A = lm[jdef.A]
      const C = lm[jdef.C]
      if (!B || !A || !C) continue

      // Vector B→A (dirección de referencia)
      const bax = A.x - B.x, bay = A.y - B.y
      const baLen = Math.sqrt(bax * bax + bay * bay) || 1

      // Ángulo actual de B→A
      const refAngle = Math.atan2(bay, bax)

      // Queremos que el ángulo entre BA y BC sea `art.angulo` grados.
      // Entonces BC debe estar a ±art.angulo desde BA.
      // Elegimos la rotación que coloca C en la posición anatómicamente correcta.
      // Para brazos: rotar en sentido negativo (hacia abajo) desde la horizontal.
      // Para piernas: rotar en sentido positivo (hacia abajo) desde la vertical.
      const targetRad = (art.angulo * Math.PI) / 180

      // Determinar el sentido de rotación según el tipo de articulación
      const isRight   = key.includes('derecho') || key.includes('der')
      let rotDir = 1  // sentido antihorario por defecto

      if (key.includes('hombro') || key.includes('codo')) {
        // Brazos: el punto C (muñeca) debe quedar hacia afuera-abajo
        rotDir = isRight ? -1 : 1
      } else if (key.includes('cadera') || key.includes('tronco') || key.includes('rodilla') || key.includes('tobillo')) {
        // Piernas: el punto C (rodilla/tobillo/pie) debe quedar hacia abajo
        rotDir = isRight ? 1 : -1
      }

      const newAngle = refAngle + rotDir * (Math.PI - targetRad)
      const lenBC = boneLengths[jdef.draggable] ??
                    Math.hypot(C.x - B.x, C.y - B.y)

      lm[jdef.draggable] = {
        x: Math.max(2, Math.min(W - 2, B.x + lenBC * Math.cos(newAngle))),
        y: Math.max(2, Math.min(H - 2, B.y + lenBC * Math.sin(newAngle))),
      }

      // ── IMPORTANTE: NO propagamos a hijos ────────────────────────────────
      // Cada punto es independiente. El fisio mueve la muñeca para hombro,
      // y mueve el codo por separado para el codo. Sin cadena automática.
    }

    lmRef.current = lm
  }, [W, H, S, boneLengths])

  // ── Límites de arrastre ───────────────────────────────────────────────────
  // Amplios y permisivos — el fisio tiene libertad total de movimiento
  const getBounds = useCallback((idx: number) => {
    const cx = W / 2
    // Cada punto puede moverse libremente en su mitad del cuerpo (izq/der)
    // con márgenes mínimos para no salir del canvas
    const map: Record<number, { xMin: number; xMax: number; yMin: number; yMax: number }> = {
      13: { xMin: 2,      xMax: cx - 2,  yMin: 10 * S, yMax: H - 10 },  // codo izq
      14: { xMin: cx + 2, xMax: W - 2,   yMin: 10 * S, yMax: H - 10 },  // codo der
      15: { xMin: 2,      xMax: cx - 2,  yMin: 5  * S, yMax: H - 5  },  // muñeca izq
      16: { xMin: cx + 2, xMax: W - 2,   yMin: 5  * S, yMax: H - 5  },  // muñeca der
      25: { xMin: 2,      xMax: W - 2,   yMin: 80 * S, yMax: H - 20 },  // rodilla izq — libre
      26: { xMin: 2,      xMax: W - 2,   yMin: 80 * S, yMax: H - 20 },  // rodilla der
      27: { xMin: 2,      xMax: W - 2,   yMin: 100 * S, yMax: H - 5  }, // tobillo izq
      28: { xMin: 2,      xMax: W - 2,   yMin: 100 * S, yMax: H - 5  }, // tobillo der
      31: { xMin: 2,      xMax: W - 2,   yMin: 120 * S, yMax: H - 2  }, // pie izq
      32: { xMin: 2,      xMax: W - 2,   yMin: 120 * S, yMax: H - 2  }, // pie der
    }
    return map[idx] ?? { xMin: 2, xMax: W - 2, yMin: 2, yMax: H - 2 }
  }, [W, H, S])

  // ── Notificar cambios al padre ────────────────────────────────────────────
  // Solo notifica las articulaciones que usan este punto draggable
  const notifyChanges = useCallback((dragIdx: number) => {
    if (!onAnguloChange) return
    const lm = lmRef.current
    for (const [jointName, jdef] of Object.entries(JOINT_DEFS)) {
      if (jdef.draggable !== dragIdx) continue
      if (!lm[jdef.A] || !lm[jdef.B] || !lm[jdef.C]) continue
      const newAngle = angleBetween(lm[jdef.A], lm[jdef.B], lm[jdef.C])
      const match = articulacionesRef.current.find(
        a => a.nombre_articulacion.toLowerCase().trim() === jointName
      )
      if (match) onAnguloChange(match.nombre_articulacion, newAngle)
    }
  }, [onAnguloChange])

  // ── Dibujo ────────────────────────────────────────────────────────────────
  const draw = useCallback((activeIdx: number | null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const lm  = lmRef.current
    ctx.clearRect(0, 0, W, H)

    const seg = (a: number, b: number, color: string, w: number) => {
      if (!lm[a] || !lm[b]) return
      ctx.beginPath(); ctx.moveTo(lm[a].x, lm[a].y); ctx.lineTo(lm[b].x, lm[b].y)
      ctx.strokeStyle = color; ctx.lineWidth = w * S; ctx.lineCap = 'round'; ctx.stroke()
    }

    const dot = (p: { x: number; y: number }, r: number, fill: string, stroke: string, sw = 1.5) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, r * S, 0, Math.PI * 2)
      ctx.fillStyle = fill; ctx.fill()
      ctx.strokeStyle = stroke; ctx.lineWidth = sw * S; ctx.stroke()
    }

    const activas = new Set(articulacionesRef.current.map(a => a.nombre_articulacion.toLowerCase()))

    const armL = (activas.has('hombro izquierdo') || activas.has('codo izquierdo'))     ? BLUE : GRAY
    const armR = (activas.has('hombro derecho')   || activas.has('codo derecho'))       ? BLUE : GRAY
    const legL = (activas.has('cadera izquierda') || activas.has('rodilla izquierda') || activas.has('tronco izquierdo')) ? BLUE : GRAY
    const legR = (activas.has('cadera derecha')   || activas.has('rodilla derecha')   || activas.has('tronco derecho'))   ? BLUE : GRAY
    const ankL = activas.has('tobillo izquierdo') ? BLUE : GRAY
    const ankR = activas.has('tobillo derecho')   ? BLUE : GRAY

    if (!lm[11] || !lm[12] || !lm[23] || !lm[24]) return
    const neck = { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 - 10 * S }
    const hipC = { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2 }

    // Torso
    ctx.beginPath(); ctx.moveTo(neck.x, neck.y); ctx.lineTo(hipC.x, hipC.y)
    ctx.strokeStyle = GRAY; ctx.lineWidth = 3 * S; ctx.lineCap = 'round'; ctx.stroke()
    seg(11, 12, GRAY, 2.5); seg(23, 24, GRAY, 2.5)

    // Brazos (11→13→15 izq, 12→14→16 der)
    seg(11, 13, armL, 3.5); seg(13, 15, armL, 3)
    seg(12, 14, armR, 3.5); seg(14, 16, armR, 3)

    // Piernas (23→25→27→31 izq, 24→26→28→32 der)
    seg(23, 25, legL, 3.5); seg(25, 27, legL, 3); seg(27, 31, ankL, 2.5)
    seg(24, 26, legR, 3.5); seg(26, 28, legR, 3); seg(28, 32, ankR, 2.5)

    // Cabeza
    ctx.beginPath(); ctx.arc(neck.x, neck.y - 14 * S, 13 * S, 0, Math.PI * 2)
    ctx.strokeStyle = GRAY; ctx.lineWidth = 2 * S; ctx.fillStyle = 'transparent'
    ctx.fill(); ctx.stroke()

    // Arcos de ángulo en articulaciones activas
    for (const art of articulacionesRef.current) {
      const key  = art.nombre_articulacion.toLowerCase().trim()
      const jdef = JOINT_DEFS[key]
      if (!jdef || !lm[jdef.A] || !lm[jdef.B] || !lm[jdef.C]) continue
      const B = lm[jdef.B], A = lm[jdef.A], C = lm[jdef.C]
      const a1 = Math.atan2(A.y - B.y, A.x - B.x)
      const a2 = Math.atan2(C.y - B.y, C.x - B.x)
      ctx.beginPath(); ctx.arc(B.x, B.y, 12 * S, a1, a2)
      ctx.strokeStyle = ARC; ctx.lineWidth = 2.5 * S; ctx.stroke()
      const mid = (a1 + a2) / 2
      ctx.fillStyle = BLUE; ctx.font = `bold ${Math.round(9 * S)}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(`${art.angulo}°`, B.x + 22 * S * Math.cos(mid), B.y + 22 * S * Math.sin(mid))
    }

    // Puntos fijos (hombros, caderas)
    for (const idx of [11, 12, 23, 24]) {
      if (lm[idx]) dot(lm[idx], 5, SKIN, BLUE, 1.5)
    }

    // Puntos arrastrables (codos, muñecas, rodillas, tobillos)
    if (onAnguloChange) {
      for (const idx of [13, 14, 15, 16, 25, 26, 27, 28]) {
        if (!lm[idx]) continue
        const isActive = activeIdx === idx
        dot(lm[idx], isActive ? 8 : 6, isActive ? DARK : BLUE, WHITE, 2)
        // Anillo visual de "arrastra aquí"
        if (!isActive) {
          ctx.beginPath(); ctx.arc(lm[idx].x, lm[idx].y, 10 * S, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(55,138,221,0.2)'; ctx.lineWidth = 1 * S; ctx.stroke()
        }
      }
      // Pies (solo visual, no arrastrables directamente salvo tobillo)
      for (const idx of [31, 32]) {
        if (lm[idx]) dot(lm[idx], 3.5, SKIN, BLUE, 1.5)
      }
    }

    // Leyenda
    if (mostrarLeyenda) {
      const ly = H - 14 * S
      ctx.lineWidth = 2.5 * S; ctx.lineCap = 'round'
      ctx.strokeStyle = BLUE
      ctx.beginPath(); ctx.moveTo(4 * S, ly); ctx.lineTo(16 * S, ly); ctx.stroke()
      ctx.fillStyle = BLUE; ctx.font = `${Math.round(8 * S)}px sans-serif`; ctx.textAlign = 'left'
      ctx.fillText('activo', 19 * S, ly + 3 * S)
      ctx.strokeStyle = GRAY
      ctx.beginPath(); ctx.moveTo(62 * S, ly); ctx.lineTo(74 * S, ly); ctx.stroke()
      ctx.fillStyle = GRAY; ctx.fillText('fijo', 77 * S, ly + 3 * S)
    }
  }, [W, H, S, onAnguloChange, mostrarLeyenda])

  // ── Eventos ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !onAnguloChange) return

    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect()
      const src = 'touches' in e ? e.touches[0] : e
      return { x: src.clientX - r.left, y: src.clientY - r.top }
    }

    const findHandle = (x: number, y: number): number | null => {
      const lm = lmRef.current
      for (const idx of [13, 14, 15, 16, 25, 26, 27, 28, 31, 32]) {
        if (lm[idx] && Math.hypot(x - lm[idx].x, y - lm[idx].y) < 14 * S) return idx
      }
      return null
    }

    const onDown = (e: MouseEvent | TouchEvent) => {
      const { x, y } = getPos(e)
      const h = findHandle(x, y)
      if (h !== null) {
        draggingRef.current = h
        canvas.style.cursor = 'grabbing'
        if (e.cancelable) e.preventDefault()
      }
    }

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (draggingRef.current === null) {
        const { x, y } = getPos(e)
        canvas.style.cursor = findHandle(x, y) ? 'grab' : 'default'
        return
      }
      const { x, y } = getPos(e)
      const idx    = draggingRef.current
      const bounds = getBounds(idx)
      const lm     = lmRef.current

      // ── Mover SOLO el punto arrastrado — sin cadena ───────────────────────
      lm[idx] = {
        x: Math.max(bounds.xMin, Math.min(bounds.xMax, x)),
        y: Math.max(bounds.yMin, Math.min(bounds.yMax, y)),
      }
      // Sin propagateChildren — cada punto es independiente

      notifyChanges(idx)
      draw(idx)
      if (e.cancelable) e.preventDefault()
    }

    const onUp = () => {
      if (draggingRef.current !== null) {
        draggingRef.current = null
        canvas.style.cursor = 'default'
        draw(null)
      }
    }

    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('touchstart', onDown, { passive: false })
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)

    return () => {
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('touchstart', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [draw, getBounds, notifyChanges, onAnguloChange, S])

  // ── Control de re-inicialización ──────────────────────────────────────────
  // Solo reinicializa cuando cambian los ÁNGULOS o el conjunto de articulaciones.
  // Cambios de tolerancia → solo redibuja, NO mueve el muñeco.
  const anglesKey = articulaciones.map(a => `${a.nombre_articulacion}:${a.angulo}`).join('|')
  const namesKey  = articulaciones.map(a => a.nombre_articulacion).join('|')

  const isInitialMount = useRef(true)
  const lastAnglesKey  = useRef('')
  const lastNamesKey   = useRef('')

  useEffect(() => {
    const first         = isInitialMount.current
    isInitialMount.current = false

    const anglesChanged = anglesKey !== lastAnglesKey.current
    const namesChanged  = namesKey  !== lastNamesKey.current

    lastAnglesKey.current = anglesKey
    lastNamesKey.current  = namesKey

    if (first || anglesChanged || namesChanged) {
      initLandmarks()
    }
    draw(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anglesKey, namesKey, mostrarLeyenda])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ display: 'block', cursor: onAnguloChange ? 'default' : 'auto' }}
    />
  )
}

// ─── MunequitoConControles ─────────────────────────────────────────────────────
interface PanelProps {
  articulaciones: PoseArticulacionSimple[]
  onAnguloChange: (nombre: string, angulo: number) => void
  onToleranciaChange?: (nombre: string, tolerancia: number) => void
  size?: number
}

export function MunequitoConControles({
  articulaciones,
  onAnguloChange,
  onToleranciaChange,
  size = 1,
}: PanelProps) {
  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      <MunequitoReferencia
        articulaciones={articulaciones}
        onAnguloChange={onAnguloChange}
        size={size}
        mostrarLeyenda={true}
      />
      {articulaciones.length > 0 && (
        <div style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '14px', padding: '14px', background: '#f8faff', borderRadius: '12px', border: '1px solid #d0e4f7' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#378ADD', letterSpacing: '1px' }}>ÁNGULOS</div>
          {articulaciones.map(art => (
            <div key={art.nombre_articulacion} style={{ marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#333', textTransform: 'capitalize' }}>{art.nombre_articulacion}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#378ADD' }}>{art.angulo}°</span>
              </div>
              <input type="range" min={0} max={180} step={1} value={art.angulo}
                onChange={e => onAnguloChange(art.nombre_articulacion, Number(e.target.value))}
                style={{ width: '100%', accentColor: '#378ADD', cursor: 'pointer' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#aaa', marginTop: '2px' }}>
                <span>0°</span><span>90°</span><span>180°</span>
              </div>
              {onToleranciaChange && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#888' }}>Tolerancia</span>
                    <span style={{ fontSize: '0.68rem', color: '#888', fontWeight: 'bold' }}>±{art.tolerancia}°</span>
                  </div>
                  <input type="range" min={5} max={40} step={1} value={art.tolerancia}
                    onChange={e => { e.stopPropagation(); onToleranciaChange(art.nombre_articulacion, parseInt(e.target.value)) }}
                    style={{ width: '100%', accentColor: '#6c8fc7', cursor: 'pointer', opacity: 0.8 }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
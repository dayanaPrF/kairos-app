// Extraído de EjercicioBuilder.tsx para ser reutilizado en el detector del paciente

export interface PoseArticulacionSimple {
  nombre_articulacion: string
  angulo: number
  tolerancia: number
}

function Dot({ cx, cy, r, fill, stroke }: { cx: number; cy: number; r: number; fill: string; stroke: string }) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth="1.5"/>
}

interface Props {
  articulaciones: PoseArticulacionSimple[]
  size?: number  // escala, default 1
  mostrarLeyenda?: boolean
}

export function MunequitoReferencia({ articulaciones, size = 1, mostrarLeyenda = true }: Props) {
  const get = (keyword: string) =>
    articulaciones.find(a => a.nombre_articulacion.toLowerCase().includes(keyword))

  const codoDer    = get('codo derecho')    ?? get('codo der')
  const codoIzq    = get('codo izquierdo')  ?? get('codo izq')
  const hombroDer  = get('hombro derecho')  ?? get('hombro der')
  const hombroIzq  = get('hombro izquierdo') ?? get('hombro izq')
  const caderaDer  = get('cadera derecha')  ?? get('cadera der')
  const caderaIzq  = get('cadera izquierda') ?? get('cadera izq')
  const rodillaDer = get('rodilla derecha') ?? get('rodilla der')
  const rodillaIzq = get('rodilla izquierda') ?? get('rodilla izq')
  const tobilloDer = get('tobillo derecho') ?? get('tobillo der')
  const tobilloIzq = get('tobillo izquierdo') ?? get('tobillo izq')
  const tronco     = get('tronco')
  const cuello     = get('cuello')

  const ACTIVE = '#378ADD'
  const RED    = '#E24B4A'
  const DARK   = '#185FA5'
  const GRAY   = '#b0aea6'
  const SKIN   = '#D8D6CC'
  const W      = 3.5
  const WG     = 2

  const CX   = 90
  const HCX  = CX, HCY = 22
  const NECK = { x: CX, y: 36 }
  const SHR  = { x: CX + 26, y: 50 }
  const SHL  = { x: CX - 26, y: 50 }
  const HIP  = { x: CX,      y: 112 }
  const HIPR = { x: CX + 16, y: 115 }
  const HIPL = { x: CX - 16, y: 115 }

  const d2r = (d: number) => d * Math.PI / 180

  const elbowDerPos = { x: SHR.x + 24, y: SHR.y + 44 }
  const wristDer = codoDer
    ? { x: elbowDerPos.x + 40 * Math.sin(d2r(codoDer.angulo)) * 0.6, y: elbowDerPos.y + 40 * Math.cos(d2r(180 - codoDer.angulo)) }
    : { x: elbowDerPos.x + 10, y: elbowDerPos.y + 34 }

  const elbowIzqPos = { x: SHL.x - 24, y: SHL.y + 44 }
  const wristIzq = codoIzq
    ? { x: elbowIzqPos.x - 40 * Math.sin(d2r(codoIzq.angulo)) * 0.6, y: elbowIzqPos.y + 40 * Math.cos(d2r(180 - codoIzq.angulo)) }
    : { x: elbowIzqPos.x - 10, y: elbowIzqPos.y + 34 }

  const armAngleDer    = hombroDer ? -(hombroDer.angulo) + 90 : -80
  const elbowHombroDer = { x: SHR.x + 42 * Math.cos(d2r(armAngleDer)), y: SHR.y - 42 * Math.sin(d2r(armAngleDer)) }
  const wristHombroDer = { x: elbowHombroDer.x + 32 * Math.cos(d2r(armAngleDer)), y: elbowHombroDer.y - 32 * Math.sin(d2r(armAngleDer)) }

  const armAngleIzq    = hombroIzq ? (hombroIzq.angulo) - 90 : 80
  const elbowHombroIzq = { x: SHL.x - 42 * Math.cos(d2r(armAngleIzq)), y: SHL.y - 42 * Math.sin(d2r(armAngleIzq)) }
  const wristHombroIzq = { x: elbowHombroIzq.x - 32 * Math.cos(d2r(armAngleIzq)), y: elbowHombroIzq.y - 32 * Math.sin(d2r(armAngleIzq)) }

  const calcRodilla = (hip: typeof HIPR, lado: 1 | -1, rodilla?: PoseArticulacionSimple) => {
    const knee  = { x: hip.x + lado * 5, y: hip.y + 46 }
    const ang   = rodilla ? (180 - rodilla.angulo) : 0
    const ankle = {
      x: knee.x - lado * 46 * Math.sin(d2r(ang)) * 0.7,
      y: knee.y + 46 * Math.cos(d2r(ang)) * (rodilla && rodilla.angulo < 90 ? 0.7 : 1),
    }
    return { knee, ankle }
  }

  const { knee: kneeDer, ankle: ankleDer } = calcRodilla(HIPR,  1, rodillaDer)
  const { knee: kneeIzq, ankle: ankleIzq } = calcRodilla(HIPL, -1, rodillaIzq)

  const calcCadera = (hip: typeof HIPR, lado: 1 | -1, cadera?: PoseArticulacionSimple) => {
    const ang   = cadera ? cadera.angulo - 90 : -85
    const thigh = {
      x: hip.x + 46 * Math.sin(d2r(ang)) * lado * 0.4,
      y: hip.y + 46 * Math.cos(d2r(ang - 10)) * (cadera && cadera.angulo > 90 ? 1 : -0.5),
    }
    return { thigh, shin: { x: thigh.x + lado * 3, y: thigh.y + 40 } }
  }

  const { thigh: thighDerC, shin: shinDerC } = calcCadera(HIPR,  1, caderaDer)
  const { thigh: thighIzqC, shin: shinIzqC } = calcCadera(HIPL, -1, caderaIzq)

  const calcTobillo = (knee: { x: number; y: number }, lado: 1 | -1, tobillo?: PoseArticulacionSimple) => {
    const ankle = { x: knee.x + lado * 2, y: knee.y + 46 }
    const footA = tobillo ? tobillo.angulo - 90 : 0
    return { ankle, toe: { x: ankle.x + 28 * Math.cos(d2r(footA)) * lado, y: ankle.y + 28 * Math.sin(d2r(footA)) * 0.4 } }
  }

  const { ankle: ankleDerT, toe: toeDer } = calcTobillo(kneeDer,  1, tobilloDer)
  const { ankle: ankleIzqT, toe: toeIzq } = calcTobillo(kneeIzq, -1, tobilloIzq)

  const neckTilt   = cuello ? cuello.angulo - 90 : 0
  const headFinalX = HCX + 18 * Math.sin(d2r(neckTilt))
  const trunkTilt  = tronco ? (180 - tronco.angulo) * 0.4 : 0
  const hipFinalX  = HIP.x + 10 * Math.sin(d2r(trunkTilt))

  const useHombroDer  = !!hombroDer
  const useCodoDer    = !!codoDer && !hombroDer
  const useHombroIzq  = !!hombroIzq
  const useCodoIzq    = !!codoIzq && !hombroIzq
  const useCaderaDer  = !!caderaDer
  const useRodillaDer = !!rodillaDer && !caderaDer
  const useTobilloDer = !!tobilloDer && !caderaDer && !rodillaDer
  const useCaderaIzq  = !!caderaIzq
  const useRodillaIzq = !!rodillaIzq && !caderaIzq
  const useTobilloIzq = !!tobilloIzq && !caderaIzq && !rodillaIzq

  const w = Math.round(180 * size)
  const h = Math.round(280 * size)

  return (
    <svg width={w} height={h} viewBox="0 0 180 280" style={{ display: 'block' }}>

      {/* CABEZA */}
      <circle cx={headFinalX} cy={HCY} r={13} fill="none" stroke={cuello ? RED : GRAY} strokeWidth={cuello ? 2.5 : 2}/>
      {/* CUELLO */}
      <line x1={headFinalX} y1={HCY + 13} x2={NECK.x} y2={NECK.y} stroke={cuello ? RED : GRAY} strokeWidth={cuello ? 2.5 : 2} strokeLinecap="round"/>
      {/* TORSO */}
      <line x1={NECK.x} y1={NECK.y} x2={hipFinalX} y2={HIP.y} stroke={tronco ? RED : GRAY} strokeWidth={tronco ? 3 : 2.5} strokeLinecap="round"/>
      {/* HOMBROS */}
      <line x1={SHL.x} y1={SHL.y} x2={SHR.x} y2={SHR.y} stroke={GRAY} strokeWidth={2.5} strokeLinecap="round"/>
      {/* CADERAS */}
      <line x1={HIPL.x} y1={HIPL.y} x2={HIPR.x} y2={HIPR.y} stroke={GRAY} strokeWidth={2.5} strokeLinecap="round"/>

      {/* BRAZO DERECHO */}
      {useHombroDer ? (<>
        <line x1={SHR.x} y1={SHR.y} x2={elbowHombroDer.x} y2={elbowHombroDer.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
        <line x1={elbowHombroDer.x} y1={elbowHombroDer.y} x2={wristHombroDer.x} y2={wristHombroDer.y} stroke={RED} strokeWidth={W - 0.5} strokeLinecap="round"/>
        <Dot cx={SHR.x} cy={SHR.y} r={7} fill={DARK} stroke="white"/>
        <Dot cx={elbowHombroDer.x} cy={elbowHombroDer.y} r={5} fill={SKIN} stroke={RED}/>
        <Dot cx={wristHombroDer.x} cy={wristHombroDer.y} r={4} fill={SKIN} stroke={RED}/>
      </>) : useCodoDer ? (<>
        <line x1={SHR.x} y1={SHR.y} x2={elbowDerPos.x} y2={elbowDerPos.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
        <line x1={elbowDerPos.x} y1={elbowDerPos.y} x2={wristDer.x} y2={wristDer.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
        <Dot cx={SHR.x} cy={SHR.y} r={5} fill={SKIN} stroke={ACTIVE}/>
        <Dot cx={elbowDerPos.x} cy={elbowDerPos.y} r={7} fill={DARK} stroke="white"/>
        <Dot cx={wristDer.x} cy={wristDer.y} r={4.5} fill={SKIN} stroke={RED}/>
      </>) : (<>
        <line x1={SHR.x} y1={SHR.y} x2={elbowDerPos.x} y2={elbowDerPos.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
        <line x1={elbowDerPos.x} y1={elbowDerPos.y} x2={wristDer.x} y2={wristDer.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
        <Dot cx={SHR.x} cy={SHR.y} r={4} fill={SKIN} stroke={GRAY}/>
        <Dot cx={elbowDerPos.x} cy={elbowDerPos.y} r={4} fill={SKIN} stroke={GRAY}/>
      </>)}

      {/* BRAZO IZQUIERDO */}
      {useHombroIzq ? (<>
        <line x1={SHL.x} y1={SHL.y} x2={elbowHombroIzq.x} y2={elbowHombroIzq.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
        <line x1={elbowHombroIzq.x} y1={elbowHombroIzq.y} x2={wristHombroIzq.x} y2={wristHombroIzq.y} stroke={RED} strokeWidth={W - 0.5} strokeLinecap="round"/>
        <Dot cx={SHL.x} cy={SHL.y} r={7} fill={DARK} stroke="white"/>
        <Dot cx={elbowHombroIzq.x} cy={elbowHombroIzq.y} r={5} fill={SKIN} stroke={RED}/>
        <Dot cx={wristHombroIzq.x} cy={wristHombroIzq.y} r={4} fill={SKIN} stroke={RED}/>
      </>) : useCodoIzq ? (<>
        <line x1={SHL.x} y1={SHL.y} x2={elbowIzqPos.x} y2={elbowIzqPos.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
        <line x1={elbowIzqPos.x} y1={elbowIzqPos.y} x2={wristIzq.x} y2={wristIzq.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
        <Dot cx={SHL.x} cy={SHL.y} r={5} fill={SKIN} stroke={ACTIVE}/>
        <Dot cx={elbowIzqPos.x} cy={elbowIzqPos.y} r={7} fill={DARK} stroke="white"/>
        <Dot cx={wristIzq.x} cy={wristIzq.y} r={4.5} fill={SKIN} stroke={RED}/>
      </>) : (<>
        <line x1={SHL.x} y1={SHL.y} x2={elbowIzqPos.x} y2={elbowIzqPos.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
        <line x1={elbowIzqPos.x} y1={elbowIzqPos.y} x2={wristIzq.x} y2={wristIzq.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
        <Dot cx={SHL.x} cy={SHL.y} r={4} fill={SKIN} stroke={GRAY}/>
        <Dot cx={elbowIzqPos.x} cy={elbowIzqPos.y} r={4} fill={SKIN} stroke={GRAY}/>
      </>)}

      {/* PIERNA DERECHA */}
      {useCaderaDer ? (<>
        <line x1={HIPR.x} y1={HIPR.y} x2={thighDerC.x} y2={thighDerC.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
        <line x1={thighDerC.x} y1={thighDerC.y} x2={shinDerC.x} y2={shinDerC.y} stroke={RED} strokeWidth={W - 0.5} strokeLinecap="round"/>
        <Dot cx={HIPR.x} cy={HIPR.y} r={7} fill={DARK} stroke="white"/>
        <Dot cx={thighDerC.x} cy={thighDerC.y} r={5} fill={SKIN} stroke={RED}/>
        <Dot cx={shinDerC.x} cy={shinDerC.y} r={4} fill={SKIN} stroke={RED}/>
      </>) : useRodillaDer ? (<>
        <line x1={HIPR.x} y1={HIPR.y} x2={kneeDer.x} y2={kneeDer.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
        <line x1={kneeDer.x} y1={kneeDer.y} x2={ankleDer.x} y2={ankleDer.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
        <Dot cx={HIPR.x} cy={HIPR.y} r={5} fill={SKIN} stroke={ACTIVE}/>
        <Dot cx={kneeDer.x} cy={kneeDer.y} r={7} fill={DARK} stroke="white"/>
        <Dot cx={ankleDer.x} cy={ankleDer.y} r={4.5} fill={SKIN} stroke={RED}/>
      </>) : useTobilloDer ? (<>
        <line x1={HIPR.x} y1={HIPR.y} x2={kneeDer.x} y2={kneeDer.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
        <line x1={kneeDer.x} y1={kneeDer.y} x2={ankleDerT.x} y2={ankleDerT.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
        <line x1={ankleDerT.x} y1={ankleDerT.y} x2={toeDer.x} y2={toeDer.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
        <Dot cx={HIPR.x} cy={HIPR.y} r={4} fill={SKIN} stroke={ACTIVE}/>
        <Dot cx={kneeDer.x} cy={kneeDer.y} r={5} fill={SKIN} stroke={ACTIVE}/>
        <Dot cx={ankleDerT.x} cy={ankleDerT.y} r={7} fill={DARK} stroke="white"/>
        <Dot cx={toeDer.x} cy={toeDer.y} r={4} fill={SKIN} stroke={RED}/>
      </>) : (<>
        <line x1={HIPR.x} y1={HIPR.y} x2={kneeDer.x} y2={kneeDer.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
        <line x1={kneeDer.x} y1={kneeDer.y} x2={ankleDer.x} y2={ankleDer.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
        <Dot cx={HIPR.x} cy={HIPR.y} r={4} fill={SKIN} stroke={GRAY}/>
        <Dot cx={kneeDer.x} cy={kneeDer.y} r={4} fill={SKIN} stroke={GRAY}/>
      </>)}

      {/* PIERNA IZQUIERDA */}
      {useCaderaIzq ? (<>
        <line x1={HIPL.x} y1={HIPL.y} x2={thighIzqC.x} y2={thighIzqC.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
        <line x1={thighIzqC.x} y1={thighIzqC.y} x2={shinIzqC.x} y2={shinIzqC.y} stroke={RED} strokeWidth={W - 0.5} strokeLinecap="round"/>
        <Dot cx={HIPL.x} cy={HIPL.y} r={7} fill={DARK} stroke="white"/>
        <Dot cx={thighIzqC.x} cy={thighIzqC.y} r={5} fill={SKIN} stroke={RED}/>
        <Dot cx={shinIzqC.x} cy={shinIzqC.y} r={4} fill={SKIN} stroke={RED}/>
      </>) : useRodillaIzq ? (<>
        <line x1={HIPL.x} y1={HIPL.y} x2={kneeIzq.x} y2={kneeIzq.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
        <line x1={kneeIzq.x} y1={kneeIzq.y} x2={ankleIzq.x} y2={ankleIzq.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
        <Dot cx={HIPL.x} cy={HIPL.y} r={5} fill={SKIN} stroke={ACTIVE}/>
        <Dot cx={kneeIzq.x} cy={kneeIzq.y} r={7} fill={DARK} stroke="white"/>
        <Dot cx={ankleIzq.x} cy={ankleIzq.y} r={4.5} fill={SKIN} stroke={RED}/>
      </>) : useTobilloIzq ? (<>
        <line x1={HIPL.x} y1={HIPL.y} x2={kneeIzq.x} y2={kneeIzq.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
        <line x1={kneeIzq.x} y1={kneeIzq.y} x2={ankleIzqT.x} y2={ankleIzqT.y} stroke={ACTIVE} strokeWidth={W} strokeLinecap="round"/>
        <line x1={ankleIzqT.x} y1={ankleIzqT.y} x2={toeIzq.x} y2={toeIzq.y} stroke={RED} strokeWidth={W} strokeLinecap="round"/>
        <Dot cx={HIPL.x} cy={HIPL.y} r={4} fill={SKIN} stroke={ACTIVE}/>
        <Dot cx={kneeIzq.x} cy={kneeIzq.y} r={5} fill={SKIN} stroke={ACTIVE}/>
        <Dot cx={ankleIzqT.x} cy={ankleIzqT.y} r={7} fill={DARK} stroke="white"/>
        <Dot cx={toeIzq.x} cy={toeIzq.y} r={4} fill={SKIN} stroke={RED}/>
      </>) : (<>
        <line x1={HIPL.x} y1={HIPL.y} x2={kneeIzq.x} y2={kneeIzq.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
        <line x1={kneeIzq.x} y1={kneeIzq.y} x2={ankleIzq.x} y2={ankleIzq.y} stroke={GRAY} strokeWidth={WG} strokeLinecap="round"/>
        <Dot cx={HIPL.x} cy={HIPL.y} r={4} fill={SKIN} stroke={GRAY}/>
        <Dot cx={kneeIzq.x} cy={kneeIzq.y} r={4} fill={SKIN} stroke={GRAY}/>
      </>)}

      {/* Leyenda */}
      {mostrarLeyenda && (<>
        <line x1="4" y1="270" x2="16" y2="270" stroke={ACTIVE} strokeWidth="2.5" strokeLinecap="round"/>
        <text x="19" y="274" fontSize="8" fill={ACTIVE} fontFamily="sans-serif">fijo</text>
        <line x1="42" y1="270" x2="54" y2="270" stroke={RED} strokeWidth="2.5" strokeLinecap="round"/>
        <text x="57" y="274" fontSize="8" fill={RED} fontFamily="sans-serif">móvil</text>
        <circle cx="96" cy="270" r="3.5" fill={DARK}/>
        <text x="102" y="274" fontSize="8" fill={DARK} fontFamily="sans-serif">articulación</text>
      </>)}
    </svg>
  )
}
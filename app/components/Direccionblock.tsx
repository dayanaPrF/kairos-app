'use client'
import { useState, useEffect, useRef } from 'react'

interface DireccionForm {
  id_direccion?: string
  pais: string; estado: string; municipio: string; colonia: string
  calle: string; numero_exterior: string; numero_interior: string; codigo_postal: string
}

interface DireccionBlockProps {
  prefix: string
  value: DireccionForm
  onChange: (field: keyof DireccionForm, val: string) => void
}

interface CPData {
  colonias: string[]
  municipio: string
  estado: string
  pais: string
}

// ─── Función principal de búsqueda por CP ────────────────────────────────────
async function buscarPorCP(cp: string, pais: string): Promise<CPData | null> {
  if (cp.length < 4) return null

  try {
    // Para México usamos la API de COPOMEX (requiere token gratis en copomex.com)
    // Fallback: zippopotam.us (no tiene colonias pero sí estado/municipio)
    const codigoPais = pais === 'México' || pais === 'Mexico' || pais === '' ? 'MX'
      : pais === 'Estados Unidos' ? 'US'
      : pais === 'España' ? 'ES'
      : pais === 'Argentina' ? 'AR'
      : pais === 'Colombia' ? 'CO'
      : pais === 'Chile' ? 'CL'
      : null

    if (!codigoPais) return null

    const res = await fetch(`https://api.zippopotam.us/${codigoPais}/${cp}`)
    if (!res.ok) return null

    const data = await res.json()
    const lugar = data.places?.[0]
    if (!lugar) return null

    return {
      colonias: [],   // zippopotam no da colonias, las dejamos para que el user las escriba
      municipio: lugar['place name']   || '',
      estado:    lugar['state']        || '',
      pais:      data['country']       || pais,
    }
  } catch {
    return null
  }
}

export function DireccionBlock({ prefix, value, onChange }: DireccionBlockProps) {
  const [cpStatus, setCpStatus] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle')
  const [coloniasSugeridas, setColoniasSugeridas] = useState<string[]>([])
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // ── Buscar cuando cambia el CP ───────────────────────────────────────────
  useEffect(() => {
    const cp = value.codigo_postal?.trim()
    if (!cp || cp.length < 4) {
      setCpStatus('idle')
      setColoniasSugeridas([])
      return
    }

    setCpStatus('loading')

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const resultado = await buscarPorCP(cp, value.pais)
      if (resultado) {
        setCpStatus('found')
        setColoniasSugeridas(resultado.colonias)
        // Solo autorrellena si el campo está vacío o si viene de la API
        if (!value.municipio) onChange('municipio', resultado.municipio)
        if (!value.estado)    onChange('estado',    resultado.estado)
        if (!value.pais && resultado.pais) onChange('pais', resultado.pais)
      } else {
        setCpStatus('notfound')
        setColoniasSugeridas([])
      }
    }, 600) // espera 600ms después de dejar de escribir

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value.codigo_postal, value.pais])

  const cpBorderColor =
    cpStatus === 'found'    ? '#68D391' :
    cpStatus === 'notfound' ? '#FC8181' :
    cpStatus === 'loading'  ? '#90CDF4' : undefined

  return (
    <>
      {/* ── CP primero — es el campo "inteligente" ── */}
      <div style={{ marginTop: '12px' }}>
        <div className="fl-dir" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          Código postal
          {cpStatus === 'loading' && (
            <span style={{ fontSize: '0.7rem', color: '#90CDF4' }}>🔍 Buscando...</span>
          )}
          {cpStatus === 'found' && (
            <span style={{ fontSize: '0.7rem', color: '#38A169' }}>✅ Encontrado</span>
          )}
          {cpStatus === 'notfound' && (
            <span style={{ fontSize: '0.7rem', color: '#E53E3E' }}>❌ No encontrado</span>
          )}
        </div>
        <div className="p-fw">
          <span className="p-fi">📮</span>
          <input
            className="p-input"
            type="text"
            placeholder="72000 — autorrellena estado y municipio"
            value={value.codigo_postal}
            onChange={e => onChange('codigo_postal', e.target.value)}
            style={cpBorderColor ? { borderColor: cpBorderColor, borderWidth: '1.5px' } : {}}
          />
        </div>
      </div>

      {/* ── País + Estado ── */}
      <div className="p-grid-inner" style={{ marginTop: '12px' }}>
        <div>
          <div className="fl-dir">País</div>
          <div className="p-fw">
            <span className="p-fi">🌎</span>
            <input
              className="p-input" type="text"
              placeholder="Ej. México"
              list={`${prefix}-paises`}
              value={value.pais}
              onChange={e => {
                onChange('pais', e.target.value)
                onChange('estado', '')
                onChange('municipio', '')
                onChange('codigo_postal', '')
                setCpStatus('idle')
              }}
            />
            <datalist id={`${prefix}-paises`}>
              {['México','Estados Unidos','España','Argentina','Colombia','Chile',
                'Perú','Venezuela','Ecuador','Bolivia','Uruguay','Costa Rica',
                'Guatemala','Cuba','Brasil','Canadá'].map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
        </div>
        <div>
          <div className="fl-dir">Estado / Provincia</div>
          <div className="p-fw">
            <span className="p-fi">📍</span>
            <input
              className="p-input" type="text"
              placeholder="Se rellena con el CP"
              value={value.estado}
              onChange={e => onChange('estado', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Municipio ── */}
      <div className="fl-dir" style={{ marginTop: '12px' }}>Municipio / Alcaldía</div>
      <div className="p-fw">
        <span className="p-fi">🏙️</span>
        <input
          className="p-input" type="text"
          placeholder="Se rellena con el CP"
          value={value.municipio}
          onChange={e => onChange('municipio', e.target.value)}
        />
      </div>

      {/* ── Colonia — con sugerencias si las hay ── */}
      <div className="fl-dir" style={{ marginTop: '12px' }}>Colonia / Barrio</div>
      <div className="p-fw">
        <span className="p-fi">🏘️</span>
        <input
          className="p-input" type="text"
          placeholder={coloniasSugeridas.length ? 'Selecciona o escribe tu colonia' : 'Colonia'}
          list={coloniasSugeridas.length ? `${prefix}-colonias` : undefined}
          value={value.colonia}
          onChange={e => onChange('colonia', e.target.value)}
        />
        {coloniasSugeridas.length > 0 && (
          <datalist id={`${prefix}-colonias`}>
            {coloniasSugeridas.map(c => <option key={c} value={c} />)}
          </datalist>
        )}
      </div>

      {/* ── Calle ── */}
      <div className="fl-dir" style={{ marginTop: '12px' }}>Calle</div>
      <div className="p-fw">
        <span className="p-fi">🏠</span>
        <input
          className="p-input" type="text"
          placeholder="Av. Siempre Viva"
          value={value.calle}
          onChange={e => onChange('calle', e.target.value)}
        />
      </div>

      {/* ── Núms ── */}
      <div className="p-grid-inner" style={{ marginTop: '12px' }}>
        <div>
          <div className="fl-dir">Número exterior</div>
          <div className="p-fw">
            <span className="p-fi">#️⃣</span>
            <input className="p-input" type="text" placeholder="No. Ext"
              value={value.numero_exterior}
              onChange={e => onChange('numero_exterior', e.target.value)} />
          </div>
        </div>
        <div>
          <div className="fl-dir">Número interior</div>
          <div className="p-fw">
            <span className="p-fi">#️⃣</span>
            <input className="p-input" type="text" placeholder="No. Int (opcional)"
              value={value.numero_interior}
              onChange={e => onChange('numero_interior', e.target.value)} />
          </div>
        </div>
      </div>
    </>
  )
}
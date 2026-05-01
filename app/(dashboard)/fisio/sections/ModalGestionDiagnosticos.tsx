'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Diagnostico {
  id_diagnostico: string
  nombre_diagnostico: string
  descripcion: string | null
  fecha_diagnostico: string | null
  aun_vigente: boolean
}

export function ModalGestionDiagnosticos({ pacienteId, pacienteNombre, fisioId, onCerrar }: any) {
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([])
  const [loading, setLoading] = useState(true)
  
  const [editId, setEditId] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [desc, setDesc] = useState('')
  const [vigente, setVigente] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('diagnostico').select('*').eq('id_paciente', pacienteId).is('deleted_at', null).order('fecha_diagnostico', { ascending: false })
    setDiagnosticos(data || [])
    setLoading(false)
  }, [pacienteId])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!nombre.trim()) return alert('El nombre es obligatorio')
    const payload = {
      nombre_diagnostico: nombre,
      descripcion: desc,
      aun_vigente: vigente,
      id_paciente: pacienteId,
      id_fisioterapeuta: fisioId,
      fecha_diagnostico: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    }
    if (editId) await supabase.from('diagnostico').update(payload).eq('id_diagnostico', editId)
    else await supabase.from('diagnostico').insert([payload])
    
    setEditId(null); setNombre(''); setDesc(''); setVigente(true)
    cargar()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="dash-card" style={{ width: '450px', padding: '24px', position: 'relative', background: '#fff', borderRadius: '15px' }}>
        <button onClick={onCerrar} style={{ position: 'absolute', right: '15px', top: '15px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        <h3 style={{ margin: '0 0 4px 0' }}>Diagnósticos</h3>
        <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '20px' }}>Paciente: {pacienteNombre}</p>

        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
          <input placeholder="Nombre del diagnóstico" value={nombre} onChange={e => setNombre(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
          <textarea placeholder="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ddd', minHeight: '60px' }} />
          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
            <input type="checkbox" checked={vigente} onChange={e => setVigente(e.target.checked)} /> Diagnóstico vigente
          </label>
          <button onClick={guardar} style={{ width: '100%', background: 'var(--blue)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
            {editId ? 'Actualizar' : 'Guardar'}
          </button>
        </div>

        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {diagnosticos.map(d => (
            <div key={d.id_diagnostico} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{d.nombre_diagnostico}</div>
                <div style={{ fontSize: '11px', opacity: 0.6 }}>{d.fecha_diagnostico}</div>
              </div>
              <button onClick={() => { setEditId(d.id_diagnostico); setNombre(d.nombre_diagnostico); setDesc(d.descripcion || ''); setVigente(d.aun_vigente); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
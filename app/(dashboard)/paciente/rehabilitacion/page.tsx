'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { compilarEjercicio } from '@/app/lib/poses/compiler'
import PoseDetector from '../../../components/PoseDetector'
import type { EjercicioCompilado } from '@/app/lib/poses/types'

export default function RehabilitacionPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const [ejercicios, setEjercicios]               = useState<EjercicioCompilado[]>([])
  const [idRutinasPaciente, setIdRutinasPaciente] = useState<string | null>(null)  // ← NUEVO
  const [indiceActual, setIndiceActual]           = useState(0)
  const [error, setError]                         = useState<string | null>(null)
  const [loading, setLoading]                     = useState(true)
  const [todosCompletos, setTodosCompletos]       = useState(false)

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) { setError('No se especificó ejercicio'); return }
    cargar(id)
  }, [searchParams])

  const cargar = async (idEjercicioInicial: string) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: ejInicial } = await supabase
        .from('ejercicio')
        .select('id_fase')
        .eq('id_ejercicio', idEjercicioInicial)
        .single()

      if (!ejInicial) throw new Error('Ejercicio no encontrado')

      // ← NUEVO: buscar la rutina_paciente activa para pasarla al hook de sesión
      const hoy = new Date().toISOString().split('T')[0]
      const { data: rpActiva } = await supabase
        .from('rutina_paciente')
        .select('id_rutina_paciente')
        .eq('id_paciente', user.id)
        .eq('activa', true)
        .is('deleted_at', null)
        .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setIdRutinasPaciente(rpActiva?.id_rutina_paciente ?? null)

      const { data: ejsRaw } = await supabase
        .from('ejercicio')
        .select(`
          id_ejercicio, nombre_ejercicio, descripcion, icono, repeticiones,
          secuencia_poses, secuencia_poses_personalizada,
          biblioteca_ejercicio ( secuencia_poses )
        `)
        .eq('id_fase', ejInicial.id_fase)
        .is('deleted_at', null)
        .order('orden')

      if (!ejsRaw?.length) throw new Error('No hay ejercicios en esta fase')

      const idxInicial = ejsRaw.findIndex(e => e.id_ejercicio === idEjercicioInicial)
      const ordenados  = [
        ...ejsRaw.slice(idxInicial),
        ...ejsRaw.slice(0, idxInicial),
      ]

      const compilados: EjercicioCompilado[] = []
      for (const ej of ordenados) {
        const compilado = await compilarEjercicio(ej as any)
        if (compilado) compilados.push(compilado)
      }

      if (!compilados.length) throw new Error('Ningún ejercicio tiene poses configuradas')

      setEjercicios(compilados)
      setIndiceActual(0)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const avanzarEjercicio = () => {
    if (indiceActual + 1 < ejercicios.length) {
      setIndiceActual(i => i + 1)
    } else {
      setTodosCompletos(true)
    }
  }

  const ejercicioActual = useMemo(
    () => ejercicios[indiceActual],
    [ejercicios, indiceActual]
  )

  if (loading) return (
    <div style={{ background: '#080808', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d26e', fontFamily: 'sans-serif', letterSpacing: '2px' }}>
      PREPARANDO IA...
    </div>
  )

  if (error) return (
    <div style={{ background: '#080808', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', color: '#fff' }}>
      <span style={{ fontSize: '3rem' }}>⚠️</span>
      <p style={{ color: '#dc3c3c' }}>{error}</p>
      <button onClick={() => router.back()} style={{ padding: '12px 32px', borderRadius: '10px', background: '#1a1a1a', border: '1px solid #333', color: '#bbb', cursor: 'pointer' }}>
        Volver
      </button>
    </div>
  )

  if (todosCompletos) return (
    <div style={{ background: '#080808', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', color: '#fff', fontFamily: "'Nunito', sans-serif" }}>
      <h1 style={{ fontSize: 64, margin: 0, color: '#00d26e', textShadow: '0 0 20px #00d26e' }}>🏆 ¡SESIÓN COMPLETA!</h1>
      <p style={{ fontSize: 20, opacity: 0.6 }}>
        Completaste {ejercicios.length} ejercicio{ejercicios.length !== 1 ? 's' : ''} con IA
      </p>
      <div style={{ display: 'flex', gap: '16px' }}>
        <button
          onClick={() => { setIndiceActual(0); setTodosCompletos(false) }}
          style={{ padding: '14px 32px', borderRadius: 20, background: '#1a1a1a', border: '1px solid #333', color: '#bbb', cursor: 'pointer', fontSize: 16 }}
        >
          Repetir sesión
        </button>
        <button
          onClick={() => router.push('/paciente')}
          style={{ padding: '14px 32px', borderRadius: 20, background: '#00d26e', color: '#000', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: 16 }}
        >
          Finalizar →
        </button>
      </div>
    </div>
  )

  if (!ejercicioActual) return null

  return (
    <div style={{ position: 'relative' }}>
      {ejercicios.length > 1 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'center', gap: '8px', padding: '8px', background: 'rgba(0,0,0,0.6)' }}>
          {ejercicios.map((ej, i) => (
            <div key={ej.id_ejercicio} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: i === indiceActual ? '80px' : '40px',
                height: '6px', borderRadius: '3px',
                background: i < indiceActual ? '#00d26e' : i === indiceActual ? '#00d26e' : '#333',
                opacity: i === indiceActual ? 1 : i < indiceActual ? 0.7 : 0.3,
                transition: 'all .3s',
              }} />
              {i === indiceActual && (
                <span style={{ fontSize: '10px', color: '#00d26e', whiteSpace: 'nowrap' }}>
                  {ej.nombre_ejercicio}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <PoseDetector
        key={ejercicioActual.id_ejercicio}
        ejercicio={ejercicioActual}
        onBack={() => router.push('/paciente')}
        onComplete={avanzarEjercicio}
        idRutinasPaciente={idRutinasPaciente}                            // ← NUEVO
      />
    </div>
  )
}
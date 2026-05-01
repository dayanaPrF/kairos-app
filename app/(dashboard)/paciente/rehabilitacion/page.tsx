"use client"

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { compilarEjercicio } from '@/app/lib/poses/compiler'
import PoseDetector from '../../../components/PoseDetector'
import type { EjercicioCompilado } from '@/app/lib/poses/types'

export default function RehabilitacionPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [ejercicio, setEjercicio] = useState<EjercicioCompilado | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) { setError('No se especificó ejercicio'); return }

    const cargar = async () => {
      const { data, error: err } = await supabase
        .from('ejercicio')
        .select(`
          id_ejercicio, nombre_ejercicio, descripcion, icono, repeticiones,
          secuencia_poses, secuencia_poses_personalizada,
          biblioteca_ejercicio ( secuencia_poses )
        `)
        .eq('id_ejercicio', id)
        .single()

      if (err || !data) { setError('Ejercicio no encontrado'); return }

      const compilado = await compilarEjercicio(data as any)
      if (!compilado) { setError('Este ejercicio no tiene poses configuradas'); return }

      setEjercicio(compilado)
    }

    cargar()
  }, [searchParams])

  if (error) return (
    <div style={{ background: '#080808', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', color: '#fff' }}>
      <span style={{ fontSize: '3rem' }}>⚠️</span>
      <p style={{ color: '#dc3c3c' }}>{error}</p>
      <button onClick={() => router.back()} style={{ padding: '12px 32px', borderRadius: '10px', background: '#1a1a1a', border: '1px solid #333', color: '#bbb', cursor: 'pointer' }}>
        Volver
      </button>
    </div>
  )

  if (!ejercicio) return (
    <div style={{ background: '#080808', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d26e', fontFamily: 'sans-serif', letterSpacing: '2px' }}>
      PREPARANDO IA...
    </div>
  )

  return (
    <PoseDetector
      ejercicio={ejercicio}
      onBack={() => router.push('/paciente')}
    />
  )
}
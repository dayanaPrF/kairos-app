// hooks/useHomeData.ts
// Llama esto desde SectionHome o desde el layout del dashboard

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface HomeData {
  // Rutina activa
  rutina: {
    nombre: string
    duracion: number        // minutos
    totalEjercicios: number
    semanaActual: number
    totalSemanas: number
  } | null

  // Semana (Dom→Sáb de la semana actual)
  semana: {
    dia: string             // 'Dom', 'Lun', etc.
    fecha: string           // ISO
    esHoy: boolean
    porcentaje: number | null  // null = sin sesión registrada
  }[]

  // Estadísticas
  rachaActual: number       // días consecutivos con sesión
  progresoTotal: number     // 0–100

  // Fisioterapeuta asignado (principal)
  fisio: {
    nombre: string
    especialidad: string
    universidad: string
    notaReciente: string | null
  } | null

  // Próxima cita
  proximaCita: {
    fecha: string           // ISO date
    horaInicio: string      // 'HH:MM'
    horaFin: string
    motivo: string
    clinica: string
    estado: string
  } | null

  loading: boolean
  error: string | null
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function useHomeData(): HomeData {
  const [data, setData] = useState<HomeData>({
    rutina: null, semana: [], rachaActual: 0,
    progresoTotal: 0, fisio: null, proximaCita: null,
    loading: true, error: null
  })

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const hoy = new Date()
        const isoHoy = hoy.toISOString().split('T')[0]

        // ── 1. Rutina activa ────────────────────────────────────────────────
        const { data: rutPac } = await supabase
          .from('rutina_paciente')
          .select('*, rutina(nombre_rutina, duracion, fase(id_fase, ejercicio(id_ejercicio)))')
          .eq('id_paciente', user.id)
          .eq('activa', true)
          .maybeSingle()

        let rutinaInfo = null
        if (rutPac?.rutina) {
          const fases = rutPac.rutina.fase ?? []
          const totalEjercicios = fases.reduce(
            (acc: number, f: any) => acc + (f.ejercicio?.length ?? 0), 0
          )
          const inicio = rutPac.fecha_inicio
            ? new Date(rutPac.fecha_inicio) : hoy
          const semanaActual = Math.max(1,
            Math.ceil((hoy.getTime() - inicio.getTime()) / (7 * 86400000))
          )
          rutinaInfo = {
            nombre:         rutPac.rutina.nombre_rutina ?? 'Rutina activa',
            duracion:       rutPac.rutina.duracion ?? 0,
            totalEjercicios,
            semanaActual,
            totalSemanas:   Math.ceil((rutPac.rutina.duracion ?? 42) / 7),
          }
        }

        // ── 2. Sesiones de la semana actual ─────────────────────────────────
        // Lunes a domingo de la semana corriente
        const lunes = new Date(hoy)
        lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
        lunes.setHours(0, 0, 0, 0)
        const domingo = new Date(lunes)
        domingo.setDate(lunes.getDate() + 6)

        const { data: sesiones } = await supabase
          .from('sesion_entrenamiento')
          .select('fecha, estado_sesion, observaciones_paciente')
          .eq('id_paciente', user.id)
          .gte('fecha', lunes.toISOString().split('T')[0])
          .lte('fecha', domingo.toISOString().split('T')[0])

        const semanaData = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(lunes)
          d.setDate(lunes.getDate() + i)
          const iso = d.toISOString().split('T')[0]
          const sesion = sesiones?.find(s => s.fecha === iso)
          return {
            dia:       DIAS[(d.getDay())],
            fecha:     iso,
            esHoy:     iso === isoHoy,
            porcentaje: sesion
              ? (sesion.estado_sesion === 'completada' ? 100
                : sesion.estado_sesion === 'parcial'   ? 60 : 30)
              : null
          }
        })

        // ── 3. Racha de días consecutivos ────────────────────────────────────
        const { data: todasSesiones } = await supabase
          .from('sesion_entrenamiento')
          .select('fecha')
          .eq('id_paciente', user.id)
          .order('fecha', { ascending: false })

        let racha = 0
        if (todasSesiones?.length) {
          const fechasSet = new Set(todasSesiones.map(s => s.fecha))
          const cursor = new Date(hoy)
          while (fechasSet.has(cursor.toISOString().split('T')[0])) {
            racha++
            cursor.setDate(cursor.getDate() - 1)
          }
        }

        // ── 4. Fisioterapeuta principal ──────────────────────────────────────
        let fisioInfo = null

        // Query 1: obtener el id del fisio principal
        const { data: relFisio } = await supabase
          .from('paciente_fisioterapeuta')
          .select('id_fisioterapeuta')
          .eq('id_paciente', user.id)
          .eq('es_principal', true)
          .maybeSingle()

        if (relFisio?.id_fisioterapeuta) {
          const fisioId = relFisio.id_fisioterapeuta

          // Query 2: datos del fisio + perfil por separado
          const [{ data: fisioRow }, { data: perfilRow }] = await Promise.all([
            supabase
              .from('fisioterapeuta')
              .select('especialidad, universidad_egreso')
              .eq('id_fisioterapeuta', fisioId)
              .maybeSingle(),

            supabase
              .from('perfil')
              .select('nombre, primer_apellido, segundo_apellido')
              .eq('id_perfil', fisioId)
              .maybeSingle(),
          ])

          const nombre = [
            perfilRow?.nombre,
            perfilRow?.primer_apellido,
            perfilRow?.segundo_apellido,
          ].filter(Boolean).join(' ')

          const { data: citaConNota } = await supabase
            .from('cita')
            .select('notas_cita')
            .eq('id_paciente', user.id)
            .not('notas_cita', 'is', null)
            .order('fecha_cita', { ascending: false })
            .limit(1)
            .maybeSingle()

          fisioInfo = {
            nombre,
            especialidad:  fisioRow?.especialidad       ?? '',
            universidad:   fisioRow?.universidad_egreso ?? '',
            notaReciente:  citaConNota?.notas_cita      ?? null,
          }
        }
        // ── 5. Próxima cita ──────────────────────────────────────────────────
        let citaInfo = null
        const { data: proxCita } = await supabase
          .from('cita')
          .select('fecha_cita, hora_inicio, hora_fin, motivo_cita, estado_cita, clinica(nombre_clinica)')
          .eq('id_paciente', user.id)
          .gte('fecha_cita', isoHoy)
          .neq('estado_cita', 'cancelada')
          .order('fecha_cita', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (proxCita) {
          citaInfo = {
            fecha:      proxCita.fecha_cita,
            horaInicio: proxCita.hora_inicio?.slice(0, 5) ?? '',
            horaFin:    proxCita.hora_fin?.slice(0, 5)    ?? '',
            motivo:     proxCita.motivo_cita   ?? 'Sesión',
            clinica:    (proxCita.clinica as any)?.nombre_clinica ?? 'Clínica',
            estado:     proxCita.estado_cita   ?? '',
          }
        }

        // ── Progreso total (basado en semana actual / total semanas) ─────────
        const progresoTotal = rutinaInfo
          ? Math.min(100, Math.round((rutinaInfo.semanaActual / rutinaInfo.totalSemanas) * 100))
          : 0

        setData({
          rutina:       rutinaInfo,
          semana:       semanaData,
          rachaActual:  racha,
          progresoTotal,
          fisio:        fisioInfo,
          proximaCita:  citaInfo,
          loading:      false,
          error:        null,
        })

      } catch (err: any) {
        console.error(err)
        setData(prev => ({ ...prev, loading: false, error: err.message }))
      }
    }

    load()
  }, [])

  return data
}
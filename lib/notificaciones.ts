import { supabase } from '@/lib/supabase'

export const enviarNotificacion = async (
  id_perfil: string, 
  titulo: string, 
  mensaje: string, 
  tipo: 'cita' | 'asignacion' | 'clinica'
) => {
  const { error } = await supabase
    .from('notificacion')
    .insert([{
      id_perfil,
      titulo,
      mensaje,
      tipo,
      estado: 'enviada',
      fecha_envio: new Date().toISOString()
    }])
  if (error) console.error('Error enviando notificación:', error)
}
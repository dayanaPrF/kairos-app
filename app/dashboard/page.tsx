'use client'
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [tienePerfil, setTienePerfil] = useState<boolean | null>(null); // null = cargando
    const router = useRouter();

    useEffect(() => {
        const checkUserAndProfile = async () => {
            // 1. Obtener el usuario autenticado
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                setUser(user);

                // 2. BUSCAR si ya existe en la tabla PACIENTE o FISIOTERAPEUTA
                const { data: esPaciente } = await supabase.from('paciente').select('id_paciente').eq('id_paciente', user.id).single();
                const { data: esFisio } = await supabase.from('fisioterapeuta').select('id_fisioterapeuta').eq('id_fisioterapeuta', user.id).single();

                if (esPaciente || esFisio) {
                    setTienePerfil(true);
                    // Si ya tiene perfil, podrías redirigirlo a su dashboard real aquí
                    // router.push(esPaciente ? '/dashboard/paciente' : '/dashboard/fisio');
                } else {
                    setTienePerfil(false);
                }
            } else {
                router.push('/'); // Si no hay usuario, mandarlo al login
            }
        };
        checkUserAndProfile();
    }, [router]);

    const registrarRol = async (rol: 'paciente' | 'fisioterapeuta') => {
        // Obtenemos los datos del metadata si existen (para Google/FB)
        const nombreMeta = user.user_metadata?.full_name?.split(' ')[0] || '';
        const apellidoMeta = user.user_metadata?.full_name?.split(' ')[1] || '';

        // 1. Upsert en PERFIL (usa upsert para que si ya existe por registro normal, solo actualice)
        const { error: errorPerfil } = await supabase.from('perfil').upsert({
            id_perfil: user.id,
            nombre: nombreMeta,
            primer_apellido: apellidoMeta,
            correo_electronico: user.email,
            provider: user.app_metadata.provider || 'email'
        });

        if (errorPerfil) {
            console.error("Error al crear perfil:", errorPerfil.message);
            return;
        }

        // 2. Insertar en la tabla específica
        const { error: errorRol } = await supabase.from(rol).insert({
            [`id_${rol}`]: user.id 
        });
        
        if (!errorRol) {
            alert(`¡Configurado como ${rol}!`);
            setTienePerfil(true);
            // router.push(rol === 'paciente' ? '/dashboard/paciente' : '/dashboard/fisio');
        } else {
            console.error("Error al asignar rol:", errorRol.message);
        }
    };

    // Mientras revisamos la base de datos...
    if (tienePerfil === null || !user) return <div className="p-8">Cargando sesión...</div>;

    // Si YA tiene perfil, mostramos el contenido del Dashboard
    if (tienePerfil) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold">Bienvenido de nuevo, {user.user_metadata?.full_name || user.email}</h1>
                <p className="mt-4">Aquí va tu contenido de Kairós para usuarios registrados.</p>
            </div>
        );
    }

    // Si NO tiene perfil (es de Google/FB nuevo), mostramos la elección
    return (
        <div className="p-8 text-center">
            <h1 className="text-2xl font-bold">¡Hola! Es tu primera vez aquí</h1>
            <p className="mt-4">Para continuar en Kairós, necesitamos saber:</p>
            <h2 className="text-xl mt-2 font-semibold">¿Cuál es tu función?</h2>
            
            <div className="flex justify-center gap-4 mt-6">
                <button onClick={() => registrarRol('paciente')} className="btn-social">
                    Soy Paciente
                </button>
                <button onClick={() => registrarRol('fisioterapeuta')} className="btn-social">
                    Soy Fisioterapeuta
                </button>
            </div>
        </div>
    );
}
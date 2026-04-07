'use client'

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase'; // Verifica que esta ruta sea la correcta en tu proyecto

export default function Home() {
    const router = useRouter();

    // 1. Estados para el formulario y mensajes
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [cargando, setCargando] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // 2. Función para Login con Correo y Contraseña
    const manejarLoginEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setCargando(true);

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            setErrorMsg("Correo o contraseña incorrectos");
            setCargando(false);
        } else {
            router.push('/dashboard');
        }
    };

    // 3. Función para Login Social (Google y Facebook)
    const manejarLoginSocial = async (proveedor: 'google' | 'facebook') => {
        setErrorMsg(null);
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: proveedor,
            options: {
                // redirectTo ayuda a que después del login social, 
                // el navegador vuelva a tu página de dashboard
                redirectTo: `${window.location.origin}/dashboard`,
            },
        });

        if (error) {
            setErrorMsg(`No se pudo conectar con ${proveedor}. Inténtalo más tarde.`);
            console.error("Error OAuth:", error.message);
        }
    };

    return (
        <div id="screen-login" className="screen active">
            {/* HERO SECTION - Izquierda en Desktop */}
            <div className="login-hero">
                <div className="hero-logo">
                    <Image 
                        src="/logo_kairos.png"
                        alt="Kairós Logo"
                        width={180} 
                        height={180}
                        className="mx-auto"
                        priority 
                    />
                    <div className="hero-tag">Movimiento medido, progreso real</div>
                </div>
                <div className="hero-desc">
                    Tu plataforma de rehabilitación física personalizada. 
                    Monitorea tu progreso y comunícate con tu fisioterapeuta.
                </div>
                <div className="hero-pills">
                    <div className="hero-pill">🏋️ Rutinas guiadas</div>
                    <div className="hero-pill">📊 Seguimiento real</div>
                    <div className="hero-pill">👨‍⚕️ Con tu fisio</div>
                </div>
            </div>

            {/* FORM SECTION - Derecha en Desktop */}
            <div className="login-form-wrap">
                <form className="login-form" onSubmit={manejarLoginEmail}>
                    <h2>¡Bienvenido!</h2>
                    <p className="sub">Ingresa tus datos para continuar tu tratamiento</p>
                    
                    {/* Input Correo */}
                    <div className="field-label">Correo electrónico</div>
                    <div className="field-wrap">
                        <span className="ficon">📧</span>
                        <input 
                            type="email" 
                            placeholder="tu@correo.com" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    
                    {/* Input Contraseña */}
                    <div className="field-label">Contraseña</div>
                    <div className="field-wrap">
                        <span className="ficon">🔒</span>
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    
                    <div className="login-links-row">
                        <a href="/registro">¿No tienes cuenta?</a>
                    </div>

                    {/* Alerta de Error con tu estilo de globals.css */}
                    {errorMsg && (
                        <div className="kr-msg-error">
                            {errorMsg}
                        </div>
                    )}

                    {/* Botón de Ingreso */}
                    <button 
                        type="submit" 
                        className="btn-login" 
                        disabled={cargando}
                    >
                        {cargando ? 'Verificando...' : 'Ingresar →'}
                    </button>

                    <div className="or-divider">o continúa con</div>

                    {/* Botones Sociales */}
                    <button 
                        type="button" 
                        className="btn-social"
                        onClick={() => manejarLoginSocial('google')}
                    >
                        <div className="s-icon g-ico">G</div> Iniciar sesión con Google
                    </button>

                    <button 
                        type="button" 
                        className="btn-social"
                        onClick={() => manejarLoginSocial('facebook')}
                    >
                        <div className="s-icon f-ico">f</div> Iniciar sesión con Facebook
                    </button>
                </form>
            </div>
        </div>
    );
}
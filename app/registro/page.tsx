'use client'
import { useState } from "react";
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function RegistroPage() {
    // --- ESTADOS DE FLUJO ---
    const [paso, setPaso] = useState(1);
    
    // --- DATOS ACUMULADOS (Paso 1) ---
    const [nombre, setNombre] = useState('');
    const [primerApellido, setPrimerApellido] = useState('');
    const [segundoApellido, setSegundoApellido] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [aceptaTerminos, setAceptaTerminos] = useState(false);

    // --- ROL (Paso 2) ---
    const [rol, setRol] = useState<'paciente' | 'fisioterapeuta' | null>(null);

    // --- DATOS ESPECÍFICOS (Paso 3) ---
    // Paciente
    const [tipoSangre, setTipoSangre] = useState('');
    const [nss, setNss] = useState('');
    // Fisioterapeuta
    const [cedula, setCedula] = useState('');
    const [universidad, setUniversidad] = useState('');
    const [especialidad, setEspecialidad] = useState('');
    const [experiencia, setExperiencia] = useState('');

    // --- UI ---
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error', texto: string } | null>(null);
    const router = useRouter();

    // --- LÓGICA ---

    async function validarPaso1(e: React.FormEvent) {
        e.preventDefault();
        setMensaje(null);

        if (!aceptaTerminos) {
            setMensaje({ tipo: 'error', texto: 'Debes aceptar los términos y condiciones.' });
            return;
        }

        setCargando(true);
        const { data: existe, error } = await supabase
            .from('perfil')
            .select('correo_electronico')
            .eq('correo_electronico', email)
            .maybeSingle();

        if (error) {
            setMensaje({ tipo: 'error', texto: 'Error al verificar disponibilidad.' });
            setCargando(false);
            return;
        }

        if (existe) {
            setMensaje({ tipo: 'error', texto: 'Este correo ya está registrado.' });
            setCargando(false);
        } else {
            setPaso(2);
            setCargando(false);
        }
    }

    function manejarSeleccionRol(tipo: 'paciente' | 'fisioterapeuta') {
        setRol(tipo);
        setPaso(3);
    }

    async function finalizarRegistro(e: React.FormEvent) {
        e.preventDefault();
        setMensaje(null);
        setCargando(true);

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nombre,
                    primer_apellido: primerApellido,
                    segundo_apellido: segundoApellido,
                    numero_telefono: telefono,
                    rol: rol
                }
            }
        });

        if (authError) {
            setMensaje({ tipo: 'error', texto: authError.message });
            setCargando(false);
            return;
        }

        const userId = authData.user?.id;
        let errorTabla = null;

        if (rol === 'paciente') {
            const { error } = await supabase.from('paciente').insert({
                id_paciente: userId,
                tipo_sangre: tipoSangre,
                nss: nss
            });
            errorTabla = error;
        } else if (rol === 'fisioterapeuta') {
            const { error } = await supabase.from('fisioterapeuta').insert({
                id_fisioterapeuta: userId,
                cedula_profesional: cedula,
                universidad_egreso: universidad,
                especialidad: especialidad,
                anios_experiencia: parseInt(experiencia) || 0
            });
            errorTabla = error;
        }

        if (errorTabla) {
            setMensaje({ tipo: 'error', texto: 'Error al guardar detalles de perfil.' });
            setCargando(false);
        } else {
            setMensaje({ tipo: 'exito', texto: '¡Registro exitoso! Redirigiendo...' });
            setTimeout(() => router.push('/dashboard'), 2000);
        }
    }

    return (
        <div className="kr-root">
            <div className="kr-card">
                
                {/* PANEL IZQUIERDO: STEPS */}
                <div className="kr-left">
                    <div className="kr-brand">
                        <div className="kr-brand-dot" />
                        <div className="kr-brand-name">Kairós</div>
                    </div>

                    <div className="kr-steps">
                        <div className={`kr-step ${paso === 1 ? 'active' : 'done'}`}>
                            <div className="kr-step-num">{paso > 1 ? '✓' : '1'}</div>
                            <div className="kr-step-info">
                                <div className="kr-step-label">Paso 1</div>
                                <div className="kr-step-title">Tu cuenta</div>
                                <div className="kr-step-desc">Datos y acceso</div>
                            </div>
                        </div>
                        <div className="kr-connector" />
                        
                        <div className={`kr-step ${paso === 2 ? 'active' : paso > 2 ? 'done' : ''}`}>
                            <div className="kr-step-num">{paso > 2 ? '✓' : '2'}</div>
                            <div className="kr-step-info">
                                <div className="kr-step-label">Paso 2</div>
                                <div className="kr-step-title">Perfil</div>
                                <div className="kr-step-desc">Tu función</div>
                            </div>
                        </div>
                        <div className="kr-connector" />

                        <div className={`kr-step ${paso === 3 ? 'active' : ''}`}>
                            <div className="kr-step-num">3</div>
                            <div className="kr-step-info">
                                <div className="kr-step-label">Paso 3</div>
                                <div className="kr-step-title">Detalles</div>
                                <div className="kr-step-desc">Información extra</div>
                            </div>
                        </div>
                    </div>

                    <div className="kr-footer-info">
                        <div className="kr-footer-label">PROCESO DE REGISTRO</div>
                        <div className="kr-footer-sub">3 pasos simples • ~2 minutos</div>
                    </div>
                </div>

                {/* PANEL DERECHO: CONTENIDO DINÁMICO */}
                <div className="kr-right">
                    
                    {paso === 1 && (
                        <>
                            <div className="kr-header">
                                <div className="kr-badge"><div className="kr-badge-dot" /> Paso 1 de 3</div>
                                <h2>Crea tu cuenta</h2>
                                <p>Comienza tu proceso de rehabilitación hoy</p>
                            </div>

                            <form onSubmit={validarPaso1} className="kr-fields">
                                <div className="kr-row">
                                    <div className="fld">
                                        <label>Nombre *</label>
                                        <div className="fld-wrap">
                                            <span className="ico">👤</span>
                                            <input type="text" placeholder="Tu nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="fld">
                                        <label>1er Apellido *</label>
                                        <div className="fld-wrap">
                                            <span className="ico">👤</span>
                                            <input type="text" placeholder="1er paterno" required value={primerApellido} onChange={(e) => setPrimerApellido(e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                <div className="kr-row">
                                    <div className="fld">
                                        <label>2do Apellido</label>
                                        <div className="fld-wrap">
                                            <span className="ico">👤</span>
                                            <input type="text" placeholder="2do apellido" value={segundoApellido} onChange={(e) => setSegundoApellido(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="fld">
                                        <label>Teléfono *</label>
                                        <div className="fld-wrap">
                                            <span className="ico">📞</span>
                                            <input type="tel" placeholder="10 dígitos" required value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <div className="fld">
                                    <label>Correo electrónico *</label>
                                    <div className="fld-wrap">
                                        <span className="ico">📧</span>
                                        <input type="email" placeholder="tu@correo.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                                    </div>
                                </div>
                                <div className="fld">
                                    <label>Contraseña *</label>
                                    <div className="fld-wrap">
                                        <span className="ico">🔒</span>
                                        <input type="password" placeholder="Mínimo 8 caracteres" required value={password} onChange={(e) => setPassword(e.target.value)} />
                                    </div>
                                </div>
                                <div className="kr-terms">
                                    <input type="checkbox" id="terms" checked={aceptaTerminos} onChange={(e) => setAceptaTerminos(e.target.checked)} />
                                    <label htmlFor="terms">Acepto los Términos y Políticas</label>
                                </div>
                                {mensaje && <div className={`kr-msg-${mensaje.tipo}`}>{mensaje.texto}</div>}
                                <button type="submit" className="btn-register" disabled={cargando}>
                                    {cargando ? 'Verificando...' : 'Siguiente'}
                                    <div className="arr">→</div>
                                </button>
                            </form>
                        </>
                    )}

                    {paso === 2 && (
                        <>
                            <div className="kr-header">
                                <div className="kr-badge"><div className="kr-badge-dot" /> Paso 2 de 3</div>
                                <h2>¿Cómo usarás Kairós?</h2>
                                <p>Selecciona tu rol en la plataforma</p>
                            </div>
                            <div className="kr-role-list">
                                <div className="kr-role-opt" onClick={() => manejarSeleccionRol('paciente')}>
                                    <div className="ico">🧘‍♂️</div>
                                    <div className="info"><h3>Soy Paciente</h3><p>Recibe terapia y ve tu progreso.</p></div>
                                    <div className="check">→</div>
                                </div>
                                <div className="kr-role-opt" onClick={() => manejarSeleccionRol('fisioterapeuta')}>
                                    <div className="ico">⚕️</div>
                                    <div className="info"><h3>Soy Fisioterapeuta</h3><p>Monitorea pacientes y rutinas.</p></div>
                                    <div className="check">→</div>
                                </div>
                            </div>
                            <button className="btn-back" onClick={() => setPaso(1)}>← Regresar</button>
                        </>
                    )}

                    {paso === 3 && (
                        <>
                            <div className="kr-header">
                                <div className="kr-badge"><div className="kr-badge-dot" /> Paso 3 de 3</div>
                                <h2>Información Médica</h2>
                                <p>Perfil de <strong>{rol}</strong></p>
                            </div>

                            <form onSubmit={finalizarRegistro} className="kr-fields">
                                {rol === 'paciente' ? (
                                    <>
                                        <div className="fld">
                                            <label>Tipo de Sangre</label>
                                            <div className="fld-wrap">
                                                <span className="ico">🩸</span>
                                                <input type="text" placeholder="Ej. O+" value={tipoSangre} onChange={(e) => setTipoSangre(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="fld">
                                            <label>NSS (Número de Seguro Social)</label>
                                            <div className="fld-wrap">
                                                <span className="ico">📋</span>
                                                <input type="text" placeholder="11 dígitos" value={nss} onChange={(e) => setNss(e.target.value)} />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="fld">
                                            <label>Cédula Profesional *</label>
                                            <div className="fld-wrap">
                                                <span className="ico">🪪</span>
                                                <input type="text" required placeholder="Número de cédula" value={cedula} onChange={(e) => setCedula(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="fld">
                                            <label>Universidad de Egreso *</label>
                                            <div className="fld-wrap">
                                                <span className="ico">🎓</span>
                                                <input type="text" required placeholder="Institución" value={universidad} onChange={(e) => setUniversidad(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="kr-row">
                                            <div className="fld">
                                                <label>Especialidad</label>
                                                <div className="fld-wrap">
                                                    <span className="ico">✨</span>
                                                    <input type="text" placeholder="Ej. Deportiva" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="fld">
                                                <label>Años Exp.</label>
                                                <div className="fld-wrap">
                                                    <span className="ico">⏳</span>
                                                    <input type="number" placeholder="0" value={experiencia} onChange={(e) => setExperiencia(e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {mensaje && <div className={`kr-msg-${mensaje.tipo}`}>{mensaje.texto}</div>}

                                <button type="submit" className="btn-register" disabled={cargando}>
                                    {cargando ? 'Registrando...' : 'Finalizar Registro'}
                                    <div className="arr">✓</div>
                                </button>
                                <button type="button" className="btn-back" onClick={() => setPaso(2)}>← Cambiar rol</button>
                            </form>
                        </>
                    )}

                    <div className="kr-login-link">
                        ¿Ya tienes cuenta? <a href="/">Inicia sesión</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
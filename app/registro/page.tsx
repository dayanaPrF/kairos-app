'use client'
import { useState } from "react";
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image'; 

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

    // --- ESTADO DE ERRORES EN TIEMPO REAL ---
    const [errores, setErrores] = useState<{ [key: string]: string }>({});

    // --- ROL (Paso 2) ---
    const [rol, setRol] = useState<'paciente' | 'fisioterapeuta' | null>(null);

    // --- DATOS ESPECÍFICOS (Paso 3) ---
    const [tipoSangre, setTipoSangre] = useState('');
    const [nss, setNss] = useState('');
    const [cedula, setCedula] = useState('');
    const [universidad, setUniversidad] = useState('');
    const [especialidad, setEspecialidad] = useState('');
    const [experiencia, setExperiencia] = useState('');

    // --- UI ---
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error', texto: string } | null>(null);
    const router = useRouter();

    // --- VALIDACIONES ---
    const validarEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const validarSoloLetras = (texto: string) => /^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]+$/.test(texto);
    const validarPasswordRobusta = (password: string) => /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(password);
    const validarTipoSangre = (sangre: string) => /^(A|B|AB|O)[+-]$/i.test(sangre);

    // --- MANEJADOR DE CAMBIOS EN TIEMPO REAL ---
    const manejarCambio = (campo: string, valor: string, setter: Function) => {
        setter(valor);
        let error = "";

        if (valor.trim() === "") {
            setErrores(prev => ({ ...prev, [campo]: "" }));
            return;
        }

        switch (campo) {
            case 'nombre':
            case 'primerApellido':
            case 'segundoApellido':
                if (!validarSoloLetras(valor)) error = "Solo se permiten letras.";
                else if (valor.trim().length < 2) error = "Mínimo 2 caracteres.";
                break;
            case 'email':
                if (!validarEmail(valor)) error = "Correo no válido.";
                break;
            case 'telefono':
                if (!/^\d{10}$/.test(valor)) error = "Deben ser 10 dígitos.";
                break;
            case 'password':
                if (!validarPasswordRobusta(valor)) error = "Requiere 8+ caracteres, Mayús. y Símbolo.";
                break;
            // Validaciones Paso 3: Paciente
            case 'tipoSangre':
                if (!validarTipoSangre(valor)) error = "Formato no válido (Ej: O+, A-).";
                break;
            case 'nss':
                if (!/^\d{11}$/.test(valor)) error = "El NSS debe tener 11 dígitos.";
                break;
            // Validaciones Paso 3: Fisioterapeuta
            case 'cedula':
                if (valor.trim().length < 7) error = "Cédula no válida.";
                break;
            case 'universidad':
                if (valor.trim().length < 3) error = "Nombre muy corto.";
                break;
        }
        setErrores(prev => ({ ...prev, [campo]: error }));
    };

    // --- LÓGICA ---
    async function validarPaso1(e: React.FormEvent) {
        e.preventDefault();
        setMensaje(null);

        if (!nombre || !primerApellido || !telefono || !email || !password || !aceptaTerminos || Object.values(errores).some(x => x !== "")) {
            setMensaje({ tipo: 'error', texto: 'Por favor, corrige los campos y acepta los términos.' });
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
        } else if (existe) {
            setMensaje({ tipo: 'error', texto: 'Este correo ya está registrado.' });
        } else {
            setPaso(2);
        }
        setCargando(false);
    }

    function manejarSeleccionRol(tipo: 'paciente' | 'fisioterapeuta') {
        setRol(tipo);
        setPaso(3);
    }

    async function finalizarRegistro(e: React.FormEvent) {
        e.preventDefault();
        setMensaje(null);

        // Validación final exhaustiva por rol
        if (rol === 'paciente') {
            if (!tipoSangre || !nss || errores.tipoSangre || errores.nss) {
                setMensaje({ tipo: 'error', texto: 'Verifica los datos médicos del paciente.' });
                return;
            }
        } else if (rol === 'fisioterapeuta') {
            if (!cedula || !universidad || errores.cedula || errores.universidad) {
                setMensaje({ tipo: 'error', texto: 'Verifica los datos profesionales.' });
                return;
            }
        }

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
                tipo_sangre: tipoSangre.toUpperCase(),
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
                
                <div className="kr-left">
                    <div className="kr-brand">
                        <div className="kr-brand-dot" />
                        <div className="kr-logo">
                             <Image
                                src="/kairos-title.png"
                                alt="Kairós Logo"
                                width={70} 
                                height={70}
                                className="mx-auto"
                                priority
                            />
                        </div>
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
                                            <input type="text" placeholder="Tu nombre" required value={nombre} onChange={(e) => manejarCambio('nombre', e.target.value, setNombre)} />
                                        </div>
                                        {errores.nombre && <p className="kr-msg-error" style={{margin: '4px 0 0', fontSize: '10px'}}>{errores.nombre}</p>}
                                    </div>
                                    <div className="fld">
                                        <label>1er Apellido *</label>
                                        <div className="fld-wrap">
                                            <span className="ico">👤</span>
                                            <input type="text" placeholder="1er apellido" required value={primerApellido} onChange={(e) => manejarCambio('primerApellido', e.target.value, setPrimerApellido)} />
                                        </div>
                                        {errores.primerApellido && <p className="kr-msg-error" style={{margin: '4px 0 0', fontSize: '10px'}}>{errores.primerApellido}</p>}
                                    </div>
                                </div>

                                <div className="kr-row">
                                    <div className="fld">
                                        <label>2do Apellido</label>
                                        <div className="fld-wrap">
                                            <span className="ico">👤</span>
                                            <input type="text" placeholder="2do apellido" value={segundoApellido} onChange={(e) => manejarCambio('segundoApellido', e.target.value, setSegundoApellido)} />
                                        </div>
                                    </div>
                                    <div className="fld">
                                        <label>Teléfono *</label>
                                        <div className="fld-wrap">
                                            <span className="ico">📞</span>
                                            <input type="tel" placeholder="10 dígitos" required value={telefono} onChange={(e) => manejarCambio('telefono', e.target.value, setTelefono)} />
                                        </div>
                                        {errores.telefono && <p className="kr-msg-error" style={{margin: '4px 0 0', fontSize: '10px'}}>{errores.telefono}</p>}
                                    </div>
                                </div>
                                <div className="fld">
                                    <label>Correo electrónico *</label>
                                    <div className="fld-wrap">
                                        <span className="ico">📧</span>
                                        <input type="email" placeholder="tu@correo.com" required value={email} onChange={(e) => manejarCambio('email', e.target.value, setEmail)} />
                                    </div>
                                    {errores.email && <p className="kr-msg-error" style={{margin: '4px 0 0', fontSize: '10px'}}>{errores.email}</p>}
                                </div>
                                <div className="fld">
                                    <label>Contraseña *</label>
                                    <div className="fld-wrap">
                                        <span className="ico">🔒</span>
                                        <input 
                                            type="password" 
                                            placeholder="Mínimo 8 caracteres" 
                                            required 
                                            value={password} 
                                            onChange={(e) => manejarCambio('password', e.target.value, setPassword)} 
                                        />
                                    </div>
                                    {errores.password && <p className="kr-msg-error" style={{margin: '4px 0 0', fontSize: '10px'}}>{errores.password}</p>}
                                </div>
                               <div className="kr-terms">
                                    <input 
                                        type="checkbox" 
                                        id="terms" 
                                        checked={aceptaTerminos} 
                                        onChange={(e) => setAceptaTerminos(e.target.checked)} 
                                    />
                                    <label htmlFor="terms">
                                        Acepto los <a href="/terminos-politicas">Términos y Políticas</a>
                                    </label>
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
                                            <label>Tipo de Sangre *</label>
                                            <div className="fld-wrap">
                                                <span className="ico">🩸</span>
                                                <input 
                                                    type="text" 
                                                    required 
                                                    placeholder="Ej. O+, A-" 
                                                    value={tipoSangre} 
                                                    onChange={(e) => manejarCambio('tipoSangre', e.target.value, setTipoSangre)} 
                                                />
                                            </div>
                                            {errores.tipoSangre && <p className="kr-msg-error" style={{margin: '4px 0 0', fontSize: '10px'}}>{errores.tipoSangre}</p>}
                                        </div>
                                        <div className="fld">
                                            <label>NSS (Número de Seguro Social) *</label>
                                            <div className="fld-wrap">
                                                <span className="ico">📋</span>
                                                <input 
                                                    type="text" 
                                                    required 
                                                    placeholder="11 dígitos" 
                                                    value={nss} 
                                                    onChange={(e) => manejarCambio('nss', e.target.value, setNss)} 
                                                />
                                            </div>
                                            {errores.nss && <p className="kr-msg-error" style={{margin: '4px 0 0', fontSize: '10px'}}>{errores.nss}</p>}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="fld">
                                            <label>Cédula Profesional *</label>
                                            <div className="fld-wrap">
                                                <span className="ico">🪪</span>
                                                <input type="text" required placeholder="Número de cédula" value={cedula} onChange={(e) => manejarCambio('cedula', e.target.value, setCedula)} />
                                            </div>
                                            {errores.cedula && <p className="kr-msg-error" style={{margin: '4px 0 0', fontSize: '10px'}}>{errores.cedula}</p>}
                                        </div>
                                        <div className="fld">
                                            <label>Universidad de Egreso *</label>
                                            <div className="fld-wrap">
                                                <span className="ico">🎓</span>
                                                <input type="text" required placeholder="Institución" value={universidad} onChange={(e) => manejarCambio('universidad', e.target.value, setUniversidad)} />
                                            </div>
                                            {errores.universidad && <p className="kr-msg-error" style={{margin: '4px 0 0', fontSize: '10px'}}>{errores.universidad}</p>}
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
                                                    <input type="number" min="0" placeholder="0" value={experiencia} onChange={(e) => setExperiencia(e.target.value)} />
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
'use client'
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
    const [user, setUser] = useState<any>(null);
    const [cargando, setCargando] = useState(true);
    const [paso, setPaso] = useState(1);
    const [rolSeleccionado, setRolSeleccionado] = useState<'paciente' | 'fisioterapeuta' | null>(null);
    
    // --- ESTADOS PARA DATOS ---
    const [datoExtra, setDatoExtra] = useState(''); // NSS o Cédula
    const [tipoSangre, setTipoSangre] = useState('O+');
    const [universidad, setUniversidad] = useState('');
    const [especialidad, setEspecialidad] = useState('');
    const [experiencia, setExperiencia] = useState('');
    
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorExp, setErrorExp] = useState<string | null>(null);
    const [errorEsp, setErrorEsp] = useState<string | null>(null);
    
    const router = useRouter();

    useEffect(() => {
        const checkUserAndProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/'); return; }
            setUser(user);

            const { data: paciente } = await supabase.from('paciente').select('id_paciente').eq('id_paciente', user.id).maybeSingle();
            if (paciente) { router.push('/paciente'); return; }

            const { data: fisio } = await supabase.from('fisioterapeuta').select('id_fisioterapeuta').eq('id_fisioterapeuta', user.id).maybeSingle();
            if (fisio) { router.push('/fisio'); return; }

            setCargando(false);
        };
        checkUserAndProfile();
    }, [router]);

    // VALIDACIÓN IDENTIFICADOR (NSS/Cédula)
    useEffect(() => {
        if (datoExtra === '') { setError(null); return; }

        if (rolSeleccionado === 'fisioterapeuta') {
            if (!/^[0-9]{7,8}$/.test(datoExtra)) {
                setError('La cédula debe tener entre 7 y 8 dígitos numéricos.');
            } else { setError(null); }
        } else {
            if (!/^[0-9]{11}$/.test(datoExtra)) {
                setError('El NSS debe tener exactamente 11 dígitos numéricos.');
            } else { setError(null); }
        }
    }, [datoExtra, rolSeleccionado]);

    // VALIDACIÓN ESPECIALIDAD (Solo letras)
    useEffect(() => {
        if (especialidad !== '' && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/.test(especialidad)) {
            setErrorEsp('La especialidad solo puede contener letras.');
        } else { setErrorEsp(null); }
    }, [especialidad]);

    // VALIDACIÓN EXPERIENCIA (Números 0-60)
    useEffect(() => {
        if (experiencia === '') { setErrorExp(null); return; }
        const n = Number(experiencia);
        if (isNaN(n) || n < 0 || n > 60) {
            setErrorExp('Ingresa un número válido (0-60).');
        } else { setErrorExp(null); }
    }, [experiencia]);

    const prepararRegistro = (rol: 'paciente' | 'fisioterapeuta') => {
        setRolSeleccionado(rol);
        setPaso(2);
    };

    const finalizarRegistro = async (e: React.FormEvent) => {
        e.preventDefault();
        if (error || errorExp || errorEsp || datoExtra === '') return; 
        
        setEnviando(true);
        const nombres = user.user_metadata?.full_name?.split(' ') || [];
        const nombreMeta = nombres[0] || '';
        const apellidoMeta = nombres[1] || '';

        await supabase.from('perfil').upsert({
            id_perfil: user.id,
            nombre: nombreMeta,
            primer_apellido: apellidoMeta,
            correo_electronico: user.email,
        });

        if (rolSeleccionado === 'fisioterapeuta') {
            await supabase.from('fisioterapeuta').insert({
                id_fisioterapeuta: user.id,
                cedula_profesional: datoExtra,
                universidad_egreso: universidad,
                especialidad: especialidad,
                anios_experiencia: parseInt(experiencia) || 0
            });
        } else {
            await supabase.from('paciente').insert({
                id_paciente: user.id,
                nss: datoExtra,
                tipo_sangre: tipoSangre
            });
        }
        router.push(rolSeleccionado === 'paciente' ? '/paciente' : '/fisio');
    };

    if (cargando) {
        return (
            <div className="kr-root" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>
                <p>Cargando Kairós...</p>
            </div>
        );
    }

    return (
        <div className="kr-root">
            <div className="kr-card">
                <div className="kr-left">
                    <div className="kr-logo"><img src="/kairos-title.png" alt="Kairós Logo" /></div>
                    <div className="kr-steps">
                        <div className={`kr-step ${paso === 1 ? 'active' : ''}`}>
                            <div className="kr-step-num">1</div>
                            <div className="kr-step-info">
                                <span className="kr-step-label">Configuración</span>
                                <h3 className="kr-step-title">Tu identidad</h3>
                            </div>
                        </div>
                        <div className="kr-connector"></div>
                        <div className={`kr-step ${paso === 2 ? 'active' : ''}`}>
                            <div className="kr-step-num">2</div>
                            <div className="kr-step-info">
                                <span className="kr-step-label">Validación</span>
                                <h3 className="kr-step-title">Datos específicos</h3>
                            </div>
                        </div>
                    </div>
                    <div><span className="kr-footer-label">Kairós Salud</span><p className="kr-footer-sub">Seguridad activa.</p></div>
                </div>

                <div className="kr-right">
                    {paso === 1 ? (
                        <div className="animate-fade-in">
                            <div className="kr-header">
                                <div className="kr-badge"><span className="kr-badge-dot"></span>Paso inicial</div>
                                <h2>¡Hola, {user.user_metadata?.full_name?.split(' ')[0]}!</h2>
                                <p>Selecciona tu perfil en <strong>Kairós</strong>:</p>
                            </div>
                            <div className="kr-role-list">
                                <div className="kr-role-opt" onClick={() => prepararRegistro('paciente')}>
                                    <span className="ico">🧘‍♂️</span>
                                    <div><h3>Soy Paciente</h3><p>Realizaré ejercicios y veré mi progreso.</p></div>
                                    <span className="check">→</span>
                                </div>
                                <div className="kr-role-opt" onClick={() => prepararRegistro('fisioterapeuta')}>
                                    <span className="ico">⚕️</span>
                                    <div><h3>Soy Fisioterapeuta</h3><p>Gestionaré pacientes y crearé rutinas.</p></div>
                                    <span className="check">→</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <div className="kr-header">
                                <button onClick={() => {setPaso(1); setDatoExtra(''); setError(null);}} style={{border:'none', background:'none', cursor:'pointer', color:'var(--blue)', fontWeight:700, marginBottom:'10px'}}>
                                    ← Volver
                                </button>
                                <h2>¡Casi listo!</h2>
                                <p>Perfil: <strong>{rolSeleccionado === 'paciente' ? 'Paciente' : 'Fisioterapeuta'}</strong></p>
                            </div>

                            <form onSubmit={finalizarRegistro} className="kr-fields" style={{marginTop:'20px'}}>
                                <div className="fld">
                                    <label>{rolSeleccionado === 'fisioterapeuta' ? 'Cédula Profesional' : 'Número de Seguro Social (NSS)'}</label>
                                    <div className="fld-wrap">
                                        <span className="ico">📋</span>
                                        <input 
                                            type="text" required 
                                            placeholder={rolSeleccionado === 'fisioterapeuta' ? "Ej. 12345678" : "Ej. 12345678901"}
                                            value={datoExtra}
                                            onChange={(e) => { if (/^\d*$/.test(e.target.value)) setDatoExtra(e.target.value); }}
                                            className={error ? 'input-error' : ''}
                                        />
                                    </div>
                                    {error && <p className="kr-msg-error">{error}</p>}
                                </div>

                                {rolSeleccionado === 'paciente' ? (
                                    <div className="fld">
                                        <label>Tipo de Sangre</label>
                                        <div className="fld-wrap">
                                            <select 
                                                value={tipoSangre} 
                                                onChange={(e) => setTipoSangre(e.target.value)}
                                                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'white'}}
                                            >
                                                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="fld">
                                            <label>Universidad de Egreso</label>
                                            <div className="fld-wrap">
                                                <span className="ico">🎓</span>
                                                <input type="text" required placeholder="Nombre de la institución" value={universidad} onChange={(e) => setUniversidad(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="fld">
                                            <label>Especialidad</label>
                                            <div className="fld-wrap">
                                                <span className="ico">✨</span>
                                                <input 
                                                    type="text" placeholder="Ej. Rehabilitación" 
                                                    value={especialidad} 
                                                    onChange={(e) => setEspecialidad(e.target.value)}
                                                    className={errorEsp ? 'input-error' : ''}
                                                />
                                            </div>
                                            {errorEsp && <p className="kr-msg-error">{errorEsp}</p>}
                                        </div>
                                        <div className="fld">
                                            <label>Años de Experiencia</label>
                                            <div className="fld-wrap">
                                                <span className="ico">⏳</span>
                                                <input 
                                                    type="text" required placeholder="Años" 
                                                    value={experiencia} 
                                                    onChange={(e) => { if (/^\d*$/.test(e.target.value)) setExperiencia(e.target.value); }} 
                                                    className={errorExp ? 'input-error' : ''}
                                                />
                                            </div>
                                            {errorExp && <p className="kr-msg-error">{errorExp}</p>}
                                        </div>
                                    </>
                                )}

                                <button 
                                    type="submit" 
                                    className="btn-register" 
                                    disabled={enviando || !!error || !!errorExp || !!errorEsp || datoExtra === ''} 
                                    style={{marginTop:'20px', width:'100%', opacity: (enviando || !!error || !!errorExp || !!errorEsp || datoExtra === '') ? 0.6 : 1}}
                                >
                                    {enviando ? 'Guardando...' : 'Finalizar registro ✓'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
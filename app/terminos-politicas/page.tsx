'use client'
import Link from 'next/link';

export default function TerminosPage() {
    return (
        <div className="kr-root" style={{ background: 'var(--bg-light)', minHeight: '100vh', padding: '40px 20px', overflowY: 'auto' }}>
            <div className="kr-card" style={{ maxWidth: '900px', margin: '0 auto', flexDirection: 'column', padding: '50px', height: 'auto', gap: '0' }}>
                
                <div className="kr-header">
                    <Link href="/registro" className="btn-back" style={{ marginBottom: '25px', display: 'inline-block', textDecoration: 'none' }}>
                        ← Volver al registro
                    </Link>
                    <div className="kr-badge">
                        <div className="kr-badge-dot" /> 
                        Marco Legal v2.0
                    </div>
                    <h1 style={{ fontSize: '2.2rem', marginBottom: '10px', color: 'var(--blue-dark)' }}>Términos de Servicio y Privacidad</h1>
                    <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Última revisión: 3 de abril de 2026</p>
                </div>

                <div className="legal-content" style={{ marginTop: '40px', color: 'var(--text-dark)', lineHeight: '1.8', fontSize: '0.95rem', textAlign: 'justify' }}>
                    
                    <section style={{ marginBottom: '35px' }}>
                        <h3 style={{ color: 'var(--blue)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '15px' }}>
                            1. NATURALEZA DEL SERVICIO
                        </h3>
                        <p>
                            Kairós es una plataforma tecnológica de asistencia en rehabilitación física que utiliza algoritmos de visión artificial para el análisis de movimiento. El servicio se proporciona "tal cual" y está diseñado para complementar, no sustituir, el juicio profesional de un fisioterapeuta humano. Los usuarios aceptan que la precisión de las métricas puede variar según las condiciones de iluminación y hardware del dispositivo del usuario.
                        </p>
                    </section>

                    <section style={{ marginBottom: '35px' }}>
                        <h3 style={{ color: 'var(--blue)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '15px' }}>
                            2. TRATAMIENTO DE DATOS SENSIBLES
                        </h3>
                        <p>
                            Al registrarse como <strong>Paciente</strong>, usted otorga su consentimiento expreso para el tratamiento de los siguientes datos:
                        </p>
                        <ul style={{ marginLeft: '25px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li><strong>Datos de Identidad Médica:</strong> El Número de Seguro Social (NSS) y Tipo de Sangre son almacenados con encriptación de extremo a extremo para facilitar la atención de emergencias durante la práctica de ejercicios.</li>
                            <li><strong>Datos Biométricos:</strong> Las coordenadas de los puntos de referencia corporales (Landmarks) capturadas por la cámara son procesadas en tiempo real para la corrección de postura.</li>
                            <li><strong>Historial de Progreso:</strong> Registros de repeticiones, ángulos de extensión y fatiga muscular percibida.</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '35px' }}>
                        <h3 style={{ color: 'var(--blue)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '15px' }}>
                            3. VALIDACIÓN DE PROFESIONALES
                        </h3>
                        <p>
                            Todo usuario registrado bajo el rol de <strong>Fisioterapeuta</strong> declara bajo protesta de decir verdad que los datos proporcionados (Cédula Profesional, Universidad y Especialidad) son fidedignos y vigentes. Kairós se reserva el derecho de suspender cuentas que no puedan acreditar su formación académica ante las autoridades de salud correspondientes.
                        </p>
                    </section>

                    <section style={{ marginBottom: '35px' }}>
                        <h3 style={{ color: 'var(--blue)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '15px' }}>
                            4. EXONERACIÓN DE RESPONSABILIDAD
                        </h3>
                        <p>
                            El usuario es el único responsable de realizar los ejercicios en un entorno seguro y libre de obstáculos. Kairós, sus desarrolladores y la institución educativa afiliada (BUAP) no se hacen responsables por lesiones derivadas del mal uso de la plataforma, el sobreesfuerzo físico o la ejecución de rutinas no validadas previamente por un médico traumatólogo o fisioterapeuta.
                        </p>
                    </section>

                    <section style={{ marginBottom: '35px' }}>
                        <h3 style={{ color: 'var(--blue)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '15px' }}>
                            5. SEGURIDAD DE LA INFORMACIÓN
                        </h3>
                        <p>
                            Utilizamos <strong>Supabase</strong> como infraestructura de base de datos, implementando políticas de seguridad de nivel de fila (RLS) para asegurar que solo usted y su terapeuta asignado puedan acceder a su información clínica. La contraseña de acceso es responsabilidad exclusiva del usuario.
                        </p>
                    </section>

                    <div style={{ 
                        background: 'var(--gray-xlight)', 
                        padding: '25px', 
                        borderRadius: '16px', 
                        marginTop: '40px',
                        borderLeft: '5px solid var(--blue)'
                    }}>
                        <p style={{ margin: 0, fontWeight: '700', color: 'var(--blue-dark)', fontSize: '1rem' }}>
                            Aviso de Uso Académico
                        </p>
                        <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem', color: 'var(--text-mid)' }}>
                            Este sitio web es un prototipo desarrollado para el proyecto de fin de carrera y prácticas profesionales. No es un producto comercial. Los datos ingresados son utilizados únicamente para validar la funcionalidad del sistema CRUD y la integración con modelos de IA.
                        </p>
                    </div>

                </div>

                <div style={{ marginTop: '50px', borderTop: '1px solid var(--border)', paddingTop: '25px', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', letterSpacing: '0.5px' }}>
                        Kairós Digital Health AI • Puebla, México • 2026
                    </p>
                </div>
            </div>
        </div>
    );
}
import Image from 'next/image'; // Importamos la herramienta para imágenes de Next.js

export default function Home() {
  return (
    <>
      <div id="screen-login" className="screen active">
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
          <div className="hero-desc">Tu plataforma de rehabilitación física personalizada. Sigue tus rutinas, monitorea tu progreso y comunícate con tu fisioterapeuta.</div>
          <div className="hero-pills">
            <div className="hero-pill">🏋️ Rutinas guiadas</div>
            <div className="hero-pill">📊 Seguimiento real</div>
            <div className="hero-pill">👨‍⚕️ Con tu fisio</div>
          </div>
        </div>
        <div className="login-form-wrap">
          <div className="login-form">
            <h2>¡Bienvenido!</h2>
            <p className="sub">Ingresa tus datos para continuar tu tratamiento</p>
            <div className="field-label">Correo electrónico</div>
            <div className="field-wrap"><span className="ficon">📧</span><input type="email" id="login-email" placeholder="tu@correo.com" /></div>
            <div className="field-label">Contraseña</div>
            <div className="field-wrap"><span className="ficon">🔒</span><input type="password" id="login-pass" placeholder="••••••••" /></div>
            <div className="login-links-row"><a href="#">¿Olvidaste tu contraseña?</a><a href="#">¿No tienes cuenta?</a></div>
            {/* Ojo: onckick no funciona en Next.js, lo quitamos por ahora */}
            <button className="btn-login">Ingresar →</button>
            <div className="or-divider">o continúa con</div>
            <button className="btn-social"><div className="s-icon g-ico">G</div> Iniciar sesión con Google</button>
            <button className="btn-social"><div className="s-icon f-ico">f</div> Iniciar sesión con Facebook</button>
          </div>
        </div>
      </div>
    </>
  );
}
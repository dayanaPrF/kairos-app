'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import Link from 'next/link'

export default function PerfilPage() {
  const [profile, setProfile] = useState<any>(null)
  const [dbData, setDbData] = useState<any>(null)
  const [isComplete, setIsComplete] = useState<boolean>(true)
  const [showPasswordFields, setShowPasswordFields] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFullProfile = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          setProfile(user)
          
          // Obtener datos de la tabla 'perfil' y su relación con 'direccion'
          // Modifica tu select en el useEffect:
          const { data: dbProfile } = await supabase
            .from('perfil')
            .select(`
              *, 
              direccion (*),
              contacto_emergencia (*, direccion (*))
            `)
            .eq('id_perfil', user.id)
            .single()

          if (dbProfile) {
            setDbData(dbProfile)
            
            // Lógica de validación para el banner de advertencia
            const hasPhone = !!dbProfile.numero_telefono
            const hasGender = !!dbProfile.sexo
            const hasBirth = !!dbProfile.fecha_nacimiento
            const hasAddress = !!dbProfile.id_direccion 
            
            if (!hasPhone || !hasGender || !hasBirth || !hasAddress) {
              setIsComplete(false)
            }
          } else {
            setIsComplete(false)
          }
        }
      } catch (err) {
        console.error("Error cargando perfil:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchFullProfile()
  }, [])

  if (loading) return <div className="p-10">Cargando...</div>

  const fullName = profile?.user_metadata?.full_name || dbData?.nombre || 'Paciente'
  const email = profile?.email
  const initial = fullName.charAt(0).toUpperCase()

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No se encontró una sesión activa.");

      // --- PROCESAMIENTO DE NOMBRE ---
      // Tu DB pide nombre y primer_apellido por separado. 
      // Vamos a intentar dividir el input de "Nombre Completo"
      const nombreCompleto = (document.getElementsByName('nombre_completo')[0] as HTMLInputElement)?.value || "";
      const partesNombre = nombreCompleto.trim().split(" ");
      
      const nombre = partesNombre[0] || "Paciente";
      const primerApellido = partesNombre[1] || "Apellido"; // Fallback para evitar el NOT NULL
      const segundoApellido = partesNombre.slice(2).join(" ") || null;

      // --- PASO 1: DIRECCIÓN DEL USUARIO ---
      const { data: dirUser, error: errDirUser } = await supabase
        .from('direccion')
        .upsert({
          id_direccion: dbData?.id_direccion,
          pais: (document.getElementsByName('pais')[0] as HTMLInputElement)?.value || 'México',
          estado: (document.getElementsByName('estado')[0] as HTMLInputElement)?.value,
          municipio: (document.getElementsByName('municipio')[0] as HTMLInputElement)?.value,
          colonia: (document.getElementsByName('colonia')[0] as HTMLInputElement)?.value,
          calle: (document.getElementsByName('calle')[0] as HTMLInputElement)?.value,
          numero_exterior: (document.getElementsByName('num_ext')[0] as HTMLInputElement)?.value, // SQL: numero_exterior
          numero_interior: (document.getElementsByName('num_int')[0] as HTMLInputElement)?.value,  // SQL: numero_interior
          codigo_postal: (document.getElementsByName('cp')[0] as HTMLInputElement)?.value,      // SQL: codigo_postal
        })
        .select().single();

      if (errDirUser) throw errDirUser;

      // --- PASO 2: PERFIL DEL USUARIO ---
      const { error: errPerfil } = await supabase.from('perfil').upsert({
        id_perfil: user.id,
        nombre: nombre,
        primer_apellido: primerApellido,   // AÑADIDO: Requisito NOT NULL
        segundo_apellido: segundoApellido, 
        correo_electronico: user.email,    // AÑADIDO: Requisito NOT NULL
        numero_telefono: (document.getElementsByName('telefono')[0] as HTMLInputElement)?.value || "0000000000",
        sexo: (document.getElementsByName('sexo')[0] as HTMLSelectElement)?.value,
        fecha_nacimiento: (document.getElementsByName('fecha_nacimiento')[0] as HTMLInputElement)?.value || null,
        id_direccion: dirUser.id_direccion,
      });

      if (errPerfil) throw errPerfil;

      // --- PASO 3: DIRECCIÓN DEL CONTACTO ---
      const { data: dirContacto, error: errDirContacto } = await supabase
        .from('direccion')
        .upsert({
          id_direccion: dbData?.contacto_emergencia?.id_direccion, 
          pais: (document.getElementsByName('c_pais')[0] as HTMLInputElement)?.value || 'México',
          estado: (document.getElementsByName('c_estado')[0] as HTMLInputElement)?.value,
          municipio: (document.getElementsByName('c_municipio')[0] as HTMLInputElement)?.value,
          colonia: (document.getElementsByName('c_colonia')[0] as HTMLInputElement)?.value,
          calle: (document.getElementsByName('c_calle')[0] as HTMLInputElement)?.value,
          numero_exterior: (document.getElementsByName('c_num_ext')[0] as HTMLInputElement)?.value,
          numero_interior: (document.getElementsByName('c_num_int')[0] as HTMLInputElement)?.value,
          codigo_postal: (document.getElementsByName('c_cp')[0] as HTMLInputElement)?.value,
        })
        .select().single();

      if (errDirContacto) throw errDirContacto;

      // --- PASO 4: CONTACTO DE EMERGENCIA ---
      const { error: errContacto } = await supabase.from('contacto_emergencia').upsert({
        id_contacto_emergencia: dbData?.contacto_emergencia?.id_contacto_emergencia,
        nombre: (document.getElementsByName('nombre_contacto')[0] as HTMLInputElement)?.value || "Contacto",
        primer_apellido: (document.getElementsByName('ap1_contacto')[0] as HTMLInputElement)?.value || "Apellido",
        segundo_apellido: (document.getElementsByName('ap2_contacto')[0] as HTMLInputElement)?.value,
        numero_telefono: (document.getElementsByName('tel1_contacto')[0] as HTMLInputElement)?.value || "0000000000", // SQL: numero_telefono
        segundo_telefono: (document.getElementsByName('tel2_contacto')[0] as HTMLInputElement)?.value, // SQL: segundo_telefono
        parentesco: (document.getElementsByName('parentesco_contacto')[0] as HTMLInputElement)?.value,
        sexo: (document.getElementsByName('sexo_contacto')[0] as HTMLSelectElement)?.value,
        correo_electronico: (document.getElementsByName('email_contacto')[0] as HTMLInputElement)?.value,
        tipo_contacto_pref: (document.getElementsByName('pref_contacto')[0] as HTMLSelectElement)?.value,
        disponibilidad_horaria: (document.getElementsByName('disponibilidad_horaria')[0] as HTMLInputElement)?.value,
        id_direccion: dirContacto.id_direccion
      });

      if (errContacto) throw errContacto;

      alert("¡Datos guardados correctamente!");
      window.location.reload();

    } catch (error: any) {
      console.error("Error completo:", error);
      alert("Error: " + (error.hint || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page-wrapper">
      <div className="p-wrap">
        
        {/* LADO IZQUIERDO */}
        <div className="p-left">
          <div className="brand">
            <Link href="/dashboard">
              <button className='btn-regresar'>← Regresar al inicio</button>
            </Link>
          </div>

          <div className="p-avatar">{initial}</div>
          <div className="user-name" style={{color: '#fff', fontWeight: 900}}>{fullName}</div>
          <div className="user-email" style={{fontSize: '0.8rem', opacity: 0.7, marginBottom: '20px'}}>{email}</div>

          <div className="physio-info-card" style={{
            background: 'rgba(255, 255, 255, 0.1)', 
            padding: '15px', borderRadius: '12px', width: '100%', fontSize: '0.85rem',
            border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '10px'
          }}>
            <div style={{color: '#fff', opacity: 0.6, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px'}}>Tu Fisioterapeuta</div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '6px'}}>
              <span>👨‍⚕️</span> <span style={{fontWeight: 600}}>Dr. Alejandro García</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.9, marginBottom: '6px'}}>
              <span>🎓</span> <span>Rehabilitación Deportiva</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', opacity: 0.9}}>
              <span>🏫</span> <span>UNAM</span>
            </div>
          </div>

          <div className="p-divider" style={{margin: '20px 0'}}></div>
          <div className="info-list"></div>
          <div className="prog-wrap" style={{marginTop: 'auto', width: '100%'}}></div>
        </div>

        {/* LADO DERECHO */}
        <div className="p-right">
          
          {/* BANNER DE ADVERTENCIA */}
          {!isComplete && (
            <div className="warning-banner" style={{
              background: '#FFF4E5', borderLeft: '4px solid #FFA117', padding: '16px',
              borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px'
            }}>
              <span>⚠️</span>
              <div>
                <strong style={{display: 'block', color: '#663C00', marginBottom: '4px'}}>Información pendiente</strong>
                <p style={{margin: 0, fontSize: '0.85rem', color: '#663C00'}}>
                  Tu perfil no está completo. Debes llenar todos los campos para poder <strong>agendar citas</strong>.
                </p>
              </div>
            </div>
          )}

          <div className="page-header">
            <div className="page-badge"><div className="bdot"></div>Mi Perfil</div>
            <h1 className="page-title">Información Personal</h1>
            <p className="page-sub">Actualiza tus datos de contacto y acceso</p>
          </div>

          <div className="section-title" style={{marginTop: '20px'}}>Datos personales</div>
          
          <div className="p-fields-grid">
            <div className="p-full">
              <div className="fl">Nombre Completo</div>
              <div className="p-fw">
                <span className="p-fi">👤</span>
                <input name="nombre_completo" className="p-input" type="text" defaultValue={fullName} />
              </div>
            </div>

            <div className="p-full">
              <div className="fl">Correo electrónico</div>
              <div className="p-fw">
                <span className="p-fi">✉️</span>
                <input className="p-input" type="email" defaultValue={email} disabled />
              </div>
            </div>

            <div>
              <div className="fl">Teléfono</div>
              <div className="p-fw">
                <span className="p-fi">📞</span>
                <input name="telefono" className="p-input" type="text" placeholder="55..." defaultValue={dbData?.numero_telefono || ''} />
              </div>
            </div>

            <div>
              <div className="fl">Sexo</div>
              <div className="p-fw">
                <span className="p-fi">🚻</span>
                <select name='sexo' className="p-input" style={{appearance: 'none'}} defaultValue={dbData?.sexo || 'Seleccionar'}>
                  <option disabled>Seleccionar</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="p-full">
              <div className="fl">Fecha de nacimiento</div>
              <div className="p-fw">
                <span className="p-fi">🗓️</span>
                <input name="fecha_nacimiento" className="p-input" type="date" defaultValue={dbData?.fecha_nacimiento || ''} />
              </div>
            </div>

            {/* SECCIÓN DIRECCIÓN */}
            <div className="p-full">
              <div className="fl">Dirección</div>
              <div className="p-grid-inner" style={{marginTop: '12px'}}>
                <div>
                  <div className="fl-dir">País</div>
                  <div className="p-fw"><span className="p-fi">📍</span><input name="pais" className="p-input" type="text" placeholder="Ej. México" defaultValue={dbData?.direccion?.pais || ''}/></div>
                </div>
                <div>
                  <div className="fl-dir">Estado</div>
                  <div className="p-fw"><span className="p-fi">📍</span><input name="estado" className="p-input" type="text" placeholder="Ej. Puebla" defaultValue={dbData?.direccion?.estado || ''}/></div>
                </div>
              </div>

              <div className="fl-dir">Municipio</div>
              <div className="p-fw"><span className="p-fi">📍</span><input name="municipio" className="p-input" type="text" placeholder="Municipio" defaultValue={dbData?.direccion?.municipio || ''}/></div>

              <div className="fl-dir">Colonia</div>
              <div className="p-fw"><span className="p-fi">📍</span><input name='colonia' className="p-input" type="text" placeholder="Colonia" defaultValue={dbData?.direccion?.colonia || ''}/></div>
              
              <div className="fl-dir">Calle</div>
              <div className="p-fw"><span className="p-fi">🏠</span><input name='calle' className="p-input" type="text" placeholder="Av. Siempre Viva 123" defaultValue={dbData?.direccion?.calle || ''}/></div>

              <div className="p-grid-inner" style={{marginTop: '12px'}}>
                <div>
                  <div className="fl-dir">Número exterior</div>
                  <div className="p-fw"><span className="p-fi">#️⃣</span><input name="num_ext" className="p-input" type="text" placeholder="No. Ext" defaultValue={dbData?.direccion?.num_ext || ''}/></div>
                </div>
                <div>
                  <div className="fl-dir">Número interior</div>
                  <div className="p-fw"><span className="p-fi">#️⃣</span><input name="num_int" className="p-input" type="text" placeholder="No. Int" defaultValue={dbData?.direccion?.num_int || ''}/></div>
                </div>
              </div>

              <div className="fl-dir">Código postal</div>
              <div className="p-fw"><span className="p-fi">📮</span><input name='cp' className="p-input" type="text" placeholder="72000" defaultValue={dbData?.direccion?.cp}/></div>
            </div>
          </div>

          {/* CONTACTO DE EMERGENCIA (TUYO) */}
          <div className="section-title">Contacto de emergencia</div>
          <div className="p-fields-grid">
            <div className="p-full">
              <div className="fl">Nombre del Contacto</div>
              <div className="p-fw"><span className="p-fi">👤</span><input name='nombre_contacto' className="p-input" type="text" placeholder="Nombre completo" defaultValue={dbData?.contacto_emergencia?.nombre || ''}/></div>
            </div>

            <div className="p-full"> 
              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Primer Apellido</div>
                  <div className="p-fw"><span className="p-fi">👤</span><input name='ap1_contacto' className="p-input" type="text" placeholder="1er Apellido" defaultValue={dbData?.contacto_emergencia?.ap1_contacto || ''}/></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Segundo Apellido</div>
                  <div className="p-fw"><span className="p-fi">👤</span><input name='ap2_contacto' className="p-input" type="text" placeholder="2do Apellido" defaultValue={dbData?.contacto_emergencia?.ap2_contacto || ''}/></div>
                </div>
              </div>

              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Parentesco</div>
                  <div className="p-fw"><span className="p-fi">🤝</span><input name='parentesco_contacto' className="p-input" type="text" placeholder="Ej. Padre, Cónyuge" defaultValue={dbData?.contacto_emergencia?.parentesco || ''}/></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Sexo</div>
                  <div className="p-fw">
                    <span className="p-fi">🚻</span>
                    <select name='sexo_contacto' className="p-input" style={{ appearance: 'none' }} defaultValue={dbData?.contacto_emergencia?.sexo || 'Seleccionar'}>
                      <option>Seleccionar</option><option>Femenino</option><option>Masculino</option><option>Otro</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-full" style={{ marginTop: '12px' }}>
              <div className="fl">Correo electrónico</div>
              <div className="p-fw"><span className="p-fi">✉️</span><input name='email_contacto' className="p-input" type="email" placeholder="correo@ejemplo.com" defaultValue={dbData?.contacto_emergencia?.email || ''}/></div>
            </div>

            <div className="p-full">
              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Teléfono Principal</div>
                  <div className="p-fw"><span className="p-fi">📞</span><input name='tel1_contacto' className="p-input" type="text" placeholder="55..." defaultValue={dbData?.contacto_emergencia?.telefono_principal || ''}/></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Segundo Teléfono</div>
                  <div className="p-fw"><span className="p-fi">📱</span><input name='tel2_contacto' className="p-input" type="text" placeholder="Opcional" defaultValue={dbData?.contacto_emergencia?.telefono_secundario || ''}/></div>
                </div>
              </div>
              <div className="p-grid-inner" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="fl">Contacto Preferido</div>
                  <div className="p-fw">
                    <span className="p-fi">🔔</span>
                    <select name='pref_contacto' className="p-input" style={{ appearance: 'none' }} defaultValue={dbData?.contacto_emergencia?.contacto_preferido || 'Llamada'}>
                      <option>Llamada</option><option>WhatsApp</option><option>Mensaje de texto</option>
                    </select>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl">Disponibilidad Horaria</div>
                  <div className="p-fw"><span className="p-fi">🕒</span><input name='disponibilidad_horaria' className="p-input" type="text" placeholder="Ej. 9:00 - 18:00" defaultValue={dbData?.contacto_emergencia?.disponibilidad_horaria || ''}/></div>
                </div>
              </div>
            </div>

            {/* DIRECCIÓN DEL CONTACTO*/}
            <div className="p-full" style={{ marginTop: '25px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <div className="fl" style={{ marginBottom: '15px', color: '#5499C7', fontWeight: 'bold' }}>DIRECCIÓN DEL CONTACTO</div>
              <div className="p-grid-inner">
                <div style={{ flex: 1 }}>
                  <div className="fl-dir">PAÍS</div>
                  <div className="p-fw"><span className="p-fi">📍</span><input name='c_pais' className="p-input" type="text" placeholder="Ej. México" defaultValue={dbData?.contacto_emergencia?.direccion?.pais || ''}/></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fl-dir">ESTADO</div>
                  <div className="p-fw"><span className="p-fi">📍</span><input name='c_estado' className="p-input" type="text" placeholder="Ej. Puebla" defaultValue={dbData?.contacto_emergencia?.direccion?.estado || ''}/></div>
                </div>
              </div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>MUNICIPIO</div>
              <div className="p-fw"><span className="p-fi">📍</span><input name='c_municipio' className="p-input" type="text" placeholder="Municipio" defaultValue={dbData?.contacto_emergencia?.direccion?.municipio || ''}/></div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>COLONIA</div>
              <div className="p-fw"><span className="p-fi">📍</span><input name='c_colonia' className="p-input" type="text" placeholder="Colonia" defaultValue={dbData?.contacto_emergencia?.direccion?.colonia || ''}/></div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>CALLE</div>
              <div className="p-fw"><span className="p-fi">🏠</span><input name='c_calle' className="p-input" type="text" placeholder="Av. Siempre Viva 123" defaultValue={dbData?.contacto_emergencia?.direccion?.calle || ''}/></div>
              <div className="p-grid-inner" style={{ marginTop: '12px' }}>
                <div style={{ flex: 1 }}><div className="fl-dir">NÚMERO EXTERIOR</div><div className="p-fw"><span className="p-fi">#️⃣</span><input name='c_num_ext' className="p-input" type="text" placeholder="No. Ext" defaultValue={dbData?.contacto_emergencia?.direccion?.num_ext || ''}/></div></div>
                <div style={{ flex: 1 }}><div className="fl-dir">NÚMERO INTERIOR</div><div className="p-fw"><span className="p-fi">#️⃣</span><input name='c_num_int' className="p-input" type="text" placeholder="No. Int" defaultValue={dbData?.contacto_emergencia?.direccion?.num_int || ''}/></div></div>
              </div>
              <div className="fl-dir" style={{ marginTop: '12px' }}>CÓDIGO POSTAL</div>
              <div className="p-fw"><span className="p-fi">📮</span><input name='c_cp' className="p-input" type="text" placeholder="72000" defaultValue={dbData?.contacto_emergencia?.direccion?.cp || ''}/></div>
            </div>
          </div>

          {/* SEGURIDAD DINÁMICA */}
          <div className="section-title" style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
            Seguridad
            {!showPasswordFields && (
              <button onClick={() => setShowPasswordFields(true)} style={{ color: '#2874A6', cursor: 'pointer', background: 'none', border: 'none', fontSize: '0.8rem' }}>
                Cambiar contraseña
              </button>
            )}
          </div>

          {showPasswordFields ? (
            <div className="p-fields-grid" style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
              <div className="p-full">
                <div className="fl">Nueva contraseña</div>
                <div className="p-fw"><span className="p-fi">🔒</span><input name='new_password' className="p-input" type="password" placeholder="Mínimo 8 caracteres" autoFocus /></div>
              </div>
              <button onClick={() => setShowPasswordFields(false)} style={{ color: '#888', background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}>Cancelar</button>
            </div>
          ) : (
            <div style={{ padding: '10px', fontSize: '0.8rem', color: '#999' }}>Tu contraseña está encriptada.</div>
          )}

          <div className="actions" style={{marginTop: '30px'}}>
            <button onClick={handleSave} className="btn-save" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar cambios →'}
            </button>
            <button onClick={() => supabase.auth.signOut()} className="btn-out">Cerrar sesión</button>
          </div>
        </div>
      </div>
    </div>
  )
}
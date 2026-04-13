/* eslint-disable */
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Building2, SlidersHorizontal, Bell, ShieldCheck, Check } from 'lucide-react'
import type { Profile } from '@/lib/types'

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

const INDUSTRIAS = [
  'Manufactura','Minería','Retail / Comercio','Hotelería / Turismo','Agroindustria',
  'Logística / Transporte','Inmobiliario','Salud','Educación','Gobierno','Energía','Tecnología','Otra',
]

const sections = [
  { id: 'perfil',          label: 'Mi Perfil',       icon: User },
  { id: 'empresa',         label: 'Mi Empresa',      icon: Building2 },
  { id: 'general',         label: 'General',          icon: SlidersHorizontal },
  { id: 'notificaciones',  label: 'Notificaciones',   icon: Bell },
  { id: 'seguridad',       label: 'Seguridad',        icon: ShieldCheck },
]

interface Props {
  profile: Profile
  email: string
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative w-10 h-6 flex-shrink-0 transition-colors"
      style={{ backgroundColor: value ? '#000' : '#CFCFCF', borderRadius: '9999px' }}
    >
      <span
        className="absolute top-1 w-4 h-4 bg-white transition-transform"
        style={{ borderRadius: '9999px', transform: value ? 'translateX(20px)' : 'translateX(4px)' }}
      />
    </button>
  )
}

export default function Configuracion({ profile: initialProfile, email }: Props) {
  const supabase = createClient()
  const [seccion, setSeccion] = useState('perfil')
  const [loading, setLoading] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Mi Perfil
  const [nombre, setNombre] = useState(initialProfile.nombre)

  // Mi Empresa
  const [empresa, setEmpresa] = useState(initialProfile.empresa)
  const [rfc, setRfc] = useState('')
  const [industria, setIndustria] = useState('')
  const [empresaEstado, setEmpresaEstado] = useState('')
  const [website, setWebsite] = useState('')

  // General
  const [moneda, setMoneda] = useState('MXN')
  const [timezone, setTimezone] = useState('America/Mexico_City')

  // Notificaciones
  const [notifNuevoProyecto, setNotifNuevoProyecto] = useState(true)
  const [notifCambioEstado, setNotifCambioEstado] = useState(true)
  const [notifComentario, setNotifComentario] = useState(false)

  // Seguridad
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    try {
      const ep = localStorage.getItem(`nodo-empresa-${initialProfile.id}`)
      if (ep) {
        const p = JSON.parse(ep)
        setRfc(p.rfc ?? '')
        setIndustria(p.industria ?? '')
        setEmpresaEstado(p.estado ?? '')
        setWebsite(p.website ?? '')
      }
      const gp = localStorage.getItem(`nodo-general-${initialProfile.id}`)
      if (gp) {
        const p = JSON.parse(gp)
        setMoneda(p.moneda ?? 'MXN')
        setTimezone(p.timezone ?? 'America/Mexico_City')
      }
      const np = localStorage.getItem(`nodo-notif-${initialProfile.id}`)
      if (np) {
        const p = JSON.parse(np)
        setNotifNuevoProyecto(p.nuevoProyecto ?? true)
        setNotifCambioEstado(p.cambioEstado ?? true)
        setNotifComentario(p.comentario ?? false)
      }
    } catch {}
  }, [initialProfile.id])

  function showSaved(msg = 'Cambios guardados') {
    setSavedMsg(msg)
    setErrorMsg('')
    setTimeout(() => setSavedMsg(''), 3000)
  }

  function showError(msg: string) {
    setErrorMsg(msg)
    setSavedMsg('')
  }

  function cambiarSeccion(id: string) {
    setSeccion(id)
    setSavedMsg('')
    setErrorMsg('')
    setNewPassword('')
    setConfirmPassword('')
  }

  async function guardarPerfil() {
    setLoading(true)
    const { error } = await supabase.from('profiles').update({ nombre }).eq('id', initialProfile.id)
    setLoading(false)
    if (error) showError('Error al guardar: ' + error.message)
    else showSaved()
  }

  async function guardarEmpresa() {
    setLoading(true)
    const { error } = await supabase.from('profiles').update({ empresa }).eq('id', initialProfile.id)
    if (!error) {
      localStorage.setItem(`nodo-empresa-${initialProfile.id}`, JSON.stringify({ rfc, industria, estado: empresaEstado, website }))
    }
    setLoading(false)
    if (error) showError('Error al guardar: ' + error.message)
    else showSaved()
  }

  function guardarGeneral() {
    localStorage.setItem(`nodo-general-${initialProfile.id}`, JSON.stringify({ moneda, timezone }))
    showSaved()
  }

  function guardarNotificaciones() {
    localStorage.setItem(`nodo-notif-${initialProfile.id}`, JSON.stringify({
      nuevoProyecto: notifNuevoProyecto,
      cambioEstado: notifCambioEstado,
      comentario: notifComentario,
    }))
    showSaved('Preferencias guardadas')
  }

  async function cambiarPassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      showError('Las contraseñas no coinciden.')
      return
    }
    if (newPassword.length < 8) {
      showError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) showError('Error: ' + error.message)
    else {
      setNewPassword('')
      setConfirmPassword('')
      showSaved('Contraseña actualizada correctamente')
    }
  }

  const inp = "w-full border px-3 py-2 text-sm bg-white"
  const borde = { borderColor: '#CFCFCF' }
  const inpDisabled = { borderColor: '#CFCFCF', color: '#888', backgroundColor: '#f5f5f5' }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Configuración</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Administra tu perfil, empresa y preferencias</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Navegación lateral */}
        <div className="w-52 flex-shrink-0 border" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
          <nav className="flex flex-col">
            {sections.map(({ id, label, icon: Icon }, idx) => (
              <button
                key={id}
                onClick={() => cambiarSeccion(id)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium w-full text-left transition-colors"
                style={{
                  backgroundColor: seccion === id ? '#000' : 'transparent',
                  color: seccion === id ? '#D7FF2F' : '#444',
                  borderBottom: idx < sections.length - 1 ? '1px solid #CFCFCF' : 'none',
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Panel de contenido */}
        <div className="flex-1 border p-8" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>

          {savedMsg && (
            <div className="flex items-center gap-2 mb-6 px-4 py-2.5 text-sm font-medium"
              style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
              <Check size={14} /> {savedMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-6 px-4 py-2.5 text-sm font-medium border"
              style={{ backgroundColor: '#fff5f5', color: '#c00', borderColor: '#fcc' }}>
              {errorMsg}
            </div>
          )}

          {/* ── MI PERFIL ── */}
          {seccion === 'perfil' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-bold text-lg mb-1">Mi Perfil</h2>
                <p className="text-sm" style={{ color: '#666' }}>Tu información personal dentro de Nodo.</p>
              </div>
              <hr style={{ borderColor: '#CFCFCF' }} />
              <div className="flex flex-col gap-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre</label>
                  <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                    className={inp} style={borde} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Correo electrónico</label>
                  <input type="email" value={email} disabled className={inp} style={inpDisabled} />
                  <p className="text-xs mt-1" style={{ color: '#888' }}>El correo se gestiona desde Seguridad.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rol en la plataforma</label>
                  <input type="text"
                    value={initialProfile.rol === 'analista' ? 'Analista' : 'EPCista'}
                    disabled className={inp} style={inpDisabled} />
                </div>
              </div>
              <div>
                <button onClick={guardarPerfil} disabled={loading || !nombre.trim()}
                  className="px-6 py-2.5 text-sm font-bold disabled:opacity-50"
                  style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
                  {loading ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}

          {/* ── MI EMPRESA ── */}
          {seccion === 'empresa' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-bold text-lg mb-1">Mi Empresa</h2>
                <p className="text-sm" style={{ color: '#666' }}>Información de tu organización o negocio.</p>
              </div>
              <hr style={{ borderColor: '#CFCFCF' }} />
              <div className="flex flex-col gap-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1">Razón social</label>
                  <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)}
                    className={inp} style={borde} placeholder="Nombre de tu empresa" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">RFC</label>
                    <input type="text" value={rfc} onChange={e => setRfc(e.target.value)}
                      className={inp} style={borde} placeholder="XAXX010101000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Estado</label>
                    <select value={empresaEstado} onChange={e => setEmpresaEstado(e.target.value)}
                      className={inp} style={borde}>
                      <option value="">Selecciona</option>
                      {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Industria</label>
                  <select value={industria} onChange={e => setIndustria(e.target.value)}
                    className={inp} style={borde}>
                    <option value="">Selecciona</option>
                    {INDUSTRIAS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sitio web</label>
                  <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                    className={inp} style={borde} placeholder="https://tuempresa.com" />
                </div>
              </div>
              <div>
                <button onClick={guardarEmpresa} disabled={loading}
                  className="px-6 py-2.5 text-sm font-bold disabled:opacity-50"
                  style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
                  {loading ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}

          {/* ── GENERAL ── */}
          {seccion === 'general' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-bold text-lg mb-1">General</h2>
                <p className="text-sm" style={{ color: '#666' }}>Preferencias de visualización y formato.</p>
              </div>
              <hr style={{ borderColor: '#CFCFCF' }} />
              <div className="flex flex-col gap-5 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1">Moneda preferida</label>
                  <select value={moneda} onChange={e => setMoneda(e.target.value)}
                    className={inp} style={borde}>
                    <option value="MXN">MXN — Peso mexicano</option>
                    <option value="USD">USD — Dólar estadounidense</option>
                  </select>
                  <p className="text-xs mt-1" style={{ color: '#888' }}>Se usará como valor por defecto al crear proyectos.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Zona horaria</label>
                  <select value={timezone} onChange={e => setTimezone(e.target.value)}
                    className={inp} style={borde}>
                    <option value="America/Mexico_City">Ciudad de México (UTC−6)</option>
                    <option value="America/Tijuana">Tijuana / Ensenada (UTC−8)</option>
                    <option value="America/Monterrey">Monterrey (UTC−6)</option>
                    <option value="America/Chihuahua">Chihuahua (UTC−7)</option>
                    <option value="America/Cancun">Cancún (UTC−5)</option>
                    <option value="America/Hermosillo">Hermosillo / Sonora (UTC−7)</option>
                  </select>
                </div>
              </div>
              <div>
                <button onClick={guardarGeneral}
                  className="px-6 py-2.5 text-sm font-bold"
                  style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
                  Guardar cambios
                </button>
              </div>
            </div>
          )}

          {/* ── NOTIFICACIONES ── */}
          {seccion === 'notificaciones' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-bold text-lg mb-1">Notificaciones</h2>
                <p className="text-sm" style={{ color: '#666' }}>Controla qué eventos generan alertas para ti.</p>
              </div>
              <hr style={{ borderColor: '#CFCFCF' }} />
              <div className="flex flex-col gap-3">
                {[
                  {
                    label: 'Nuevo proyecto recibido',
                    desc: 'Cuando un EPCista envía un nuevo proyecto para análisis.',
                    value: notifNuevoProyecto,
                    set: setNotifNuevoProyecto,
                  },
                  {
                    label: 'Cambio de estado',
                    desc: 'Cuando el estado de un proyecto es actualizado.',
                    value: notifCambioEstado,
                    set: setNotifCambioEstado,
                  },
                  {
                    label: 'Nuevos comentarios',
                    desc: 'Cuando alguien agrega un comentario en un proyecto.',
                    value: notifComentario,
                    set: setNotifComentario,
                  },
                ].map(({ label, desc, value, set }) => (
                  <div key={label} className="flex items-center justify-between border p-4"
                    style={{ borderColor: '#CFCFCF' }}>
                    <div className="pr-4">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#888' }}>{desc}</p>
                    </div>
                    <Toggle value={value} onChange={set} />
                  </div>
                ))}
              </div>
              <div>
                <button onClick={guardarNotificaciones}
                  className="px-6 py-2.5 text-sm font-bold"
                  style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
                  Guardar preferencias
                </button>
              </div>
            </div>
          )}

          {/* ── SEGURIDAD ── */}
          {seccion === 'seguridad' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-bold text-lg mb-1">Seguridad</h2>
                <p className="text-sm" style={{ color: '#666' }}>Administra tu contraseña y acceso a la cuenta.</p>
              </div>
              <hr style={{ borderColor: '#CFCFCF' }} />

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#666' }}>Cuenta</h3>
                <div className="max-w-md">
                  <label className="block text-sm font-medium mb-1">Correo electrónico</label>
                  <input type="email" value={email} disabled className={inp} style={inpDisabled} />
                </div>
              </div>

              <hr style={{ borderColor: '#CFCFCF' }} />

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#666' }}>Cambiar contraseña</h3>
                <div className="flex flex-col gap-3 max-w-md">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className={inp} style={borde}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Confirmar contraseña</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className={inp} style={borde}
                      placeholder="Repite la nueva contraseña"
                      autoComplete="new-password"
                    />
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs" style={{ color: '#c00' }}>Las contraseñas no coinciden.</p>
                  )}
                </div>
                <button
                  onClick={cambiarPassword}
                  disabled={loading || !newPassword || !confirmPassword}
                  className="mt-4 px-6 py-2.5 text-sm font-bold disabled:opacity-50"
                  style={{ backgroundColor: '#000', color: '#D7FF2F' }}
                >
                  {loading ? 'Actualizando…' : 'Actualizar contraseña'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* eslint-disable */
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { User, Building2, SlidersHorizontal, Bell, ShieldCheck, Check, CalendarDays, Users } from 'lucide-react'
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
      style={{ backgroundColor: value ? 'var(--color-principal)' : 'var(--color-linea)', borderRadius: '9999px' }}
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
  const [calendarioUrl, setCalendarioUrl] = useState(initialProfile.calendario_url ?? '')
  const isNodoUser = ['nodo_admin', 'nodo_analista'].includes(initialProfile.rol)

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
    const updateData: Record<string, unknown> = { nombre }
    if (isNodoUser) updateData.calendario_url = calendarioUrl || null
    const { error } = await supabase.from('profiles').update(updateData).eq('id', initialProfile.id)
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

  const inp = "w-full border border-borde px-3 py-2 text-sm bg-white/60 rounded-xl"
  const inpDisabled = "w-full border border-borde px-3 py-2 text-sm rounded-xl text-muted bg-gray-50"

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Configuración</h1>
        <p className="text-sm mt-1 text-muted">Administra tu perfil, empresa y preferencias</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Navegación lateral */}
        <div className="w-52 flex-shrink-0 glass-card overflow-hidden">
          <nav className="flex flex-col">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => cambiarSeccion(id)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium w-full text-left transition-colors border-b border-borde ${
                  seccion === id ? 'bg-principal text-acento' : 'text-gray-600 hover:bg-white/50'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
            {['nodo_admin', 'nodo_analista'].includes(initialProfile.rol) && (() => {
              const base = initialProfile.rol === 'nodo_admin' ? '/admin' : '/analista'
              return (
                <Link
                  href={`${base}/configuracion/roles`}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium w-full text-left transition-colors text-gray-600 hover:bg-white/50"
                >
                  <ShieldCheck size={15} />
                  Roles
                </Link>
              )
            })()}
          </nav>
        </div>

        {/* Panel de contenido */}
        <div className="flex-1 glass-card p-8">

          {savedMsg && (
            <div className="flex items-center gap-2 mb-6 px-4 py-2.5 text-sm font-medium rounded-xl bg-acento text-principal">
              <Check size={14} /> {savedMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-6 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-50 text-red-600 border border-red-200">
              {errorMsg}
            </div>
          )}

          {/* ── MI PERFIL ── */}
          {seccion === 'perfil' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-bold text-lg mb-1">Mi Perfil</h2>
                <p className="text-sm text-muted">Tu información personal dentro de Nodo.</p>
              </div>
              <hr className="border-borde" />
              <div className="flex flex-col gap-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre</label>
                  <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                    className={inp} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Correo electrónico</label>
                  <input type="email" value={email} disabled className={inpDisabled} />
                  <p className="text-xs mt-1 text-muted">El correo se gestiona desde Seguridad.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rol en la plataforma</label>
                  <input type="text"
                    value={
                      initialProfile.rol === 'nodo_analista' ? 'Analista Nodo' :
                      initialProfile.rol === 'nodo_admin' ? 'Administrador' :
                      initialProfile.rol === 'cliente_final' ? 'Cliente Final' :
                      initialProfile.rol === 'financiero' ? 'Financiero' :
                      initialProfile.rol === 'suministrador' ? 'Suministrador' :
                      initialProfile.rol === 'finder' ? 'Finder Comercial' :
                      initialProfile.rol === 'pendiente' ? 'Pendiente' :
                      initialProfile.rol === 'epc' ? 'EPC' :
                      initialProfile.rol
                    }
                    disabled className={inpDisabled} />
                </div>
                {isNodoUser && (
                  <div>
                    <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                      <CalendarDays size={14} /> Link de calendario para reuniones
                    </label>
                    <input type="url" value={calendarioUrl} onChange={e => setCalendarioUrl(e.target.value)}
                      className={inp}
                      placeholder="https://calendly.com/tu-nombre" />
                    <p className="text-xs mt-1 text-muted">
                      Los EPCistas podrán ver este link en el detalle de cada proyecto asignado a ti para agendar reuniones.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <button onClick={guardarPerfil} disabled={loading || !nombre.trim()}
                  className="px-6 py-2.5 text-sm font-bold disabled:opacity-50 bg-acento text-principal rounded-xl">
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
                <p className="text-sm text-muted">Información de tu organización o negocio.</p>
              </div>
              <hr className="border-borde" />
              <div className="flex flex-col gap-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1">Razón social</label>
                  <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)}
                    className={inp} placeholder="Nombre de tu empresa" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">RFC</label>
                    <input type="text" value={rfc} onChange={e => setRfc(e.target.value)}
                      className={inp} placeholder="XAXX010101000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Estado</label>
                    <select value={empresaEstado} onChange={e => setEmpresaEstado(e.target.value)}
                      className={inp}>
                      <option value="">Selecciona</option>
                      {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Industria</label>
                  <select value={industria} onChange={e => setIndustria(e.target.value)}
                    className={inp}>
                    <option value="">Selecciona</option>
                    {INDUSTRIAS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sitio web</label>
                  <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                    className={inp} placeholder="https://tuempresa.com" />
                </div>
              </div>
              <div>
                <button onClick={guardarEmpresa} disabled={loading}
                  className="px-6 py-2.5 text-sm font-bold disabled:opacity-50 bg-acento text-principal rounded-xl">
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
                <p className="text-sm text-muted">Preferencias de visualización y formato.</p>
              </div>
              <hr className="border-borde" />
              <div className="flex flex-col gap-5 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1">Moneda preferida</label>
                  <select value={moneda} onChange={e => setMoneda(e.target.value)}
                    className={inp}>
                    <option value="MXN">MXN — Peso mexicano</option>
                    <option value="USD">USD — Dólar estadounidense</option>
                  </select>
                  <p className="text-xs mt-1 text-muted">Se usará como valor por defecto al crear proyectos.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Zona horaria</label>
                  <select value={timezone} onChange={e => setTimezone(e.target.value)}
                    className={inp}>
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
                  className="px-6 py-2.5 text-sm font-bold bg-acento text-principal rounded-xl">
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
                <p className="text-sm text-muted">Controla qué eventos generan alertas para ti.</p>
              </div>
              <hr className="border-borde" />
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
                  <div key={label} className="flex items-center justify-between border border-borde rounded-xl p-4">
                    <div className="pr-4">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs mt-0.5 text-muted">{desc}</p>
                    </div>
                    <Toggle value={value} onChange={set} />
                  </div>
                ))}
              </div>
              <div>
                <button onClick={guardarNotificaciones}
                  className="px-6 py-2.5 text-sm font-bold bg-acento text-principal rounded-xl">
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
                <p className="text-sm text-muted">Administra tu contraseña y acceso a la cuenta.</p>
              </div>
              <hr className="border-borde" />

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide mb-3 text-muted">Cuenta</h3>
                <div className="max-w-md">
                  <label className="block text-sm font-medium mb-1">Correo electrónico</label>
                  <input type="email" value={email} disabled className={inpDisabled} />
                </div>
              </div>

              <hr className="border-borde" />

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide mb-4 text-muted">Cambiar contraseña</h3>
                <div className="flex flex-col gap-3 max-w-md">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className={inp}
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
                      className={inp}
                      placeholder="Repite la nueva contraseña"
                      autoComplete="new-password"
                    />
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-600">Las contraseñas no coinciden.</p>
                  )}
                </div>
                <button
                  onClick={cambiarPassword}
                  disabled={loading || !newPassword || !confirmPassword}
                  className="mt-4 px-6 py-2.5 text-sm font-bold disabled:opacity-50 bg-principal text-acento rounded-xl"
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

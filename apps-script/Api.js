// PulsoMOVE · ruteo de pedidos. manejar(req, deps) es lo único que llama doPost (Hojas.js).
// deps = {repo, ahora, hoy, sha256, hmac, aleatorio, props:{CLAVE_CARGA, SECRETO_TOKEN, PIMIENTA}}

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

function ErrorApi(codigo) {
  this.codigo = codigo;
}

function falla(codigo) {
  throw new ErrorApi(codigo);
}

function esVerdad(v) {
  return String(v).toLowerCase() === 'true';
}

function rolesDe(u) {
  return String(u.roles || '').split(',').map(r => r.trim()).filter(Boolean);
}

function tieneRol(u, rol) {
  return rolesDe(u).indexOf(rol) >= 0;
}

function texto(v) {
  return v == null ? '' : String(v).trim();
}

// ---------- Sesión ----------

// Devuelve {usuario, usuarios} o lanza ErrorApi. usuarios es la hoja completa, por si la acción la reescribe.
function sesion(req, deps, opciones) {
  const dni = leerToken(req.token, deps.ahora(), deps.props.SECRETO_TOKEN, deps.hmac);
  if (!dni) falla('sin_sesion');
  const usuarios = deps.repo.leer('usuarios');
  const usuario = usuarios.find(u => u.dni === dni && esVerdad(u.activo));
  if (!usuario) falla('sin_sesion');
  if (esVerdad(usuario.debe_cambiar_pin) && !(opciones && opciones.permitirCambioPin)) falla('debe_cambiar_pin');
  return { usuario, usuarios };
}

function exigirClave(req, deps) {
  const clave = deps.props.CLAVE_CARGA;
  if (!clave || typeof req.clave !== 'string' || !igualSeguro(req.clave, clave)) falla('clave');
}

// ---------- Acciones ----------

function login(req, deps) {
  const dni = normalizarDni(req.dni);
  const usuarios = deps.repo.leer('usuarios');
  const u = usuarios.find(x => x.dni === dni && esVerdad(x.activo));
  if (!u || !dni) falla('credenciales');
  const ahora = deps.ahora();
  if (Number(u.bloqueado_hasta) > ahora) falla('bloqueado');
  if (hashPin(texto(req.pin), u.sal, deps.props.PIMIENTA, deps.sha256) !== u.pin_hash) {
    const intentos = Number(u.intentos || 0) + 1;
    u.intentos = String(intentos >= MAX_INTENTOS ? 0 : intentos);
    if (intentos >= MAX_INTENTOS) u.bloqueado_hasta = String(ahora + BLOQUEO_MS);
    deps.repo.escribir('usuarios', usuarios);
    falla('credenciales');
  }
  u.intentos = '0';
  u.bloqueado_hasta = '';
  deps.repo.escribir('usuarios', usuarios);
  return {
    token: crearToken(dni, ahora, deps.props.SECRETO_TOKEN, deps.hmac),
    nombre: u.nombre, sede: u.sede, turno: u.turno, roles: rolesDe(u),
    debe_cambiar_pin: esVerdad(u.debe_cambiar_pin),
  };
}

function cambiarPin(req, deps) {
  const { usuario, usuarios } = sesion(req, deps, { permitirCambioPin: true });
  const nuevo = texto(req.pin_nuevo);
  if (!pinValido(nuevo)) falla('pin_invalido');
  if (hashPin(nuevo, usuario.sal, deps.props.PIMIENTA, deps.sha256) === usuario.pin_hash) falla('pin_invalido');
  usuario.sal = deps.aleatorio(16);
  usuario.pin_hash = hashPin(nuevo, usuario.sal, deps.props.PIMIENTA, deps.sha256);
  usuario.debe_cambiar_pin = 'false';
  deps.repo.escribir('usuarios', usuarios);
  return {};
}

function ordenTareas(a, b) {
  return (Number(a.prioridad) - Number(b.prioridad)) || String(a.socio_nombre).localeCompare(String(b.socio_nombre));
}

function conDias(t, hoy) {
  const c = Object.assign({}, t);
  c.dias_pendiente = t.estado === 'pendiente' ? diasHabiles(t.pendiente_desde, hoy) : 0;
  return c;
}

function misTareas(req, deps) {
  const { usuario } = sesion(req, deps);
  const hoy = deps.hoy();
  const tareas = deps.repo.leer('tareas')
    .filter(t => t.asignado_dni === usuario.dni && (t.estado === 'pendiente' || (t.fecha === hoy && t.estado === 'hecha')))
    .sort(ordenTareas)
    .map(t => conDias(t, hoy));
  return { hoy: hoy, tareas: tareas };
}

function marcar(req, deps) {
  const { usuario } = sesion(req, deps);
  const idMarca = texto(req.id_marca);
  const marca = { canal: texto(req.canal), resultado: texto(req.resultado), fecha: texto(req.fecha), detalle: texto(req.detalle) };
  if (!idMarca || validarMarca(marca)) falla('datos_invalidos');
  const tareas = deps.repo.leer('tareas');
  const t = tareas.find(x => x.id === texto(req.tarea_id));
  if (!t) falla('no_existe');
  if (t.asignado_dni !== usuario.dni) falla('prohibido');
  if (seVerificaEnMove(t.tipo)) falla('datos_invalidos');
  if (deps.repo.leer('registro').some(r => r.id_marca === idMarca)) return {};
  const ts = new Date(deps.ahora()).toISOString();
  deps.repo.agregar('registro', {
    id_marca: idMarca, ts: ts, tarea_id: t.id, fecha_tarea: t.fecha, sede: t.sede, socio_id: t.socio_id,
    socio_nombre: t.socio_nombre, tipo: t.tipo, dni: usuario.dni, canal: marca.canal, resultado: marca.resultado,
    fecha_resultado: marca.fecha, detalle: marca.detalle,
  });
  t.estado = 'hecha';
  t.hecha_en = ts;
  deps.repo.escribir('tareas', tareas);
  return {};
}

// ---------- Coordinación ----------

const DIAS_ALERTA = 2;

// Sede que puede ver el usuario: la suya si coordina, la pedida si es admin.
function sedePermitida(usuario, pedida) {
  if (tieneRol(usuario, 'admin')) {
    if (SEDES.indexOf(pedida) < 0) falla('datos_invalidos');
    return pedida;
  }
  if (!tieneRol(usuario, 'coordinador')) falla('prohibido');
  if (pedida && pedida !== usuario.sede) falla('prohibido');
  return usuario.sede;
}

function vistaSede(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const sede = sedePermitida(usuario, texto(req.sede));
  const hoy = deps.hoy();
  const lunes = lunesDe(hoy);
  const tareas = deps.repo.leer('tareas').filter(t => t.sede === sede);
  const equipo = usuarios.filter(u => u.sede === sede && esVerdad(u.activo) && tieneRol(u, 'recepcion'));
  const nombre = dni => (usuarios.find(u => u.dni === dni) || {}).nombre || '';
  const personas = equipo.map(u => {
    const suyas = tareas.filter(t => t.asignado_dni === u.dni);
    const hechas = suyas.filter(t => t.estado === 'hecha').map(t => fechaArgentina(t.hecha_en));
    return {
      dni: u.dni, nombre: u.nombre, sede: u.sede, turno: u.turno,
      hechas_hoy: hechas.filter(f => f === hoy).length,
      pendientes: suyas.filter(t => t.estado === 'pendiente').length,
      hechas_semana: hechas.filter(f => f >= lunes && f <= hoy).length,
    };
  });
  const alertas = tareas.filter(t => t.estado === 'pendiente')
    .map(t => Object.assign(conDias(t, hoy), { asignado_nombre: nombre(t.asignado_dni) }))
    .filter(t => t.dias_pendiente >= DIAS_ALERTA)
    .sort((a, b) => b.dias_pendiente - a.dias_pendiente || ordenTareas(a, b));
  const garantias = deps.repo.leer('garantia').filter(g => g.sede === sede && g.estado === 'pendiente');
  return { hoy: hoy, sede: sede, personas: personas, alertas: alertas, garantias: garantias };
}

// Lista de una persona tal como la ve ella, con lo que marcó en cada tarea. Admin: cualquiera; coordinador: su sede.
function tareasDe(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!tieneRol(usuario, 'admin') && !tieneRol(usuario, 'coordinador')) falla('prohibido');
  const u = usuarios.find(x => x.dni === normalizarDni(req.dni));
  if (!u) falla('no_existe');
  if (!tieneRol(usuario, 'admin')) sedePermitida(usuario, u.sede);
  const hoy = deps.hoy();
  const marcas = {};
  deps.repo.leer('registro').forEach(r => { marcas[r.tarea_id] = { canal: r.canal, resultado: r.resultado, fecha: r.fecha_resultado, detalle: r.detalle }; });
  const tareas = deps.repo.leer('tareas')
    .filter(t => t.asignado_dni === u.dni && (t.estado === 'pendiente' || (t.estado === 'hecha' && fechaArgentina(t.hecha_en) === hoy)))
    .sort(ordenTareas)
    .map(t => Object.assign(conDias(t, hoy), marcas[t.id] ? { marca: marcas[t.id] } : {}));
  return { hoy: hoy, nombre: u.nombre, turno: u.turno, sede: u.sede, tareas: tareas };
}

function reasignar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const tareas = deps.repo.leer('tareas');
  const t = tareas.find(x => x.id === texto(req.tarea_id));
  if (!t) falla('no_existe');
  sedePermitida(usuario, t.sede);
  const destino = usuarios.find(u => u.dni === normalizarDni(req.dni));
  if (!destino || destino.sede !== t.sede || !esVerdad(destino.activo) || !tieneRol(destino, 'recepcion')) falla('datos_invalidos');
  t.asignado_dni = destino.dni;
  deps.repo.escribir('tareas', tareas);
  return {};
}

function garantiaCrear(req, deps) {
  const { usuario } = sesion(req, deps);
  const motivo = texto(req.motivo);
  if (!motivo || !texto(req.socio_nombre)) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  const id = 'G-' + deps.aleatorio(6);
  deps.repo.agregar('garantia', {
    id: id, ts: ts, sede: usuario.sede, socio_id: texto(req.socio_id), socio_nombre: texto(req.socio_nombre),
    profe: texto(req.profe), motivo: motivo, registra_dni: usuario.dni, estado: 'pendiente',
    decide_dni: '', comentario: '', decidido_en: '',
  });
  return { id: id };
}

function garantiaDecidir(req, deps) {
  const { usuario } = sesion(req, deps);
  const estado = texto(req.estado);
  const garantias = deps.repo.leer('garantia');
  const g = garantias.find(x => x.id === texto(req.id));
  if (!g) falla('no_existe');
  sedePermitida(usuario, g.sede);
  if (estado !== 'aprobada' && estado !== 'rechazada') falla('datos_invalidos');
  g.estado = estado;
  g.decide_dni = usuario.dni;
  g.comentario = texto(req.comentario);
  g.decidido_en = new Date(deps.ahora()).toISOString();
  deps.repo.escribir('garantia', garantias);
  return {};
}

// ---------- Pipeline (con clave) ----------

const SEDES = ['bariloche', 'bolson', 'puelo'];
const TURNOS = ['manana', 'tarde'];

function cargarTareas(req, deps) {
  exigirClave(req, deps);
  const fecha = texto(req.fecha);
  const nuevas = req.tareas;
  const cerrar = req.cerrar || [];
  if (!fechaIsoValida(fecha) || !Array.isArray(nuevas) || !Array.isArray(cerrar)) falla('datos_invalidos');
  const completa = t => t && SEDES.indexOf(t.sede) >= 0 && texto(t.socio_id) && texto(t.asignado_dni);
  if (!nuevas.every(completa) || !cerrar.every(c => c && SEDES.indexOf(c.sede) >= 0 && texto(c.socio_id))) falla('datos_invalidos');
  const r = fusionarCargaDetalle(deps.repo.leer('tareas'), nuevas, cerrar, fecha);
  deps.repo.escribir('tareas', r.filas);
  return { nuevas: r.nuevas, actualizadas: r.actualizadas, cerradas: r.cerradas };
}

function bajarRegistro(req, deps) {
  exigirClave(req, deps);
  const desde = texto(req.desde);
  return { filas: deps.repo.leer('registro').filter(r => String(r.ts) >= desde) };
}

function usuariosResumen(req, deps) {
  exigirClave(req, deps);
  return deps.repo.leer('usuarios').filter(u => esVerdad(u.activo))
    .map(u => ({ dni: u.dni, nombre: u.nombre, sede: u.sede, turno: u.turno, roles: u.roles }));
}

// ---------- Administración ----------

const ROLES = ['recepcion', 'coordinador', 'admin'];

function exigirAdmin(req, deps) {
  const s = sesion(req, deps);
  if (!tieneRol(s.usuario, 'admin')) falla('prohibido');
  return s;
}

function nuevoPin(u, deps) {
  const pin = generarPin(deps.aleatorio);
  u.sal = deps.aleatorio(16);
  u.pin_hash = hashPin(pin, u.sal, deps.props.PIMIENTA, deps.sha256);
  u.debe_cambiar_pin = 'true';
  u.intentos = '0';
  u.bloqueado_hasta = '';
  return pin;
}

function usuariosCargar(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.usuarios)) falla('datos_invalidos');
  const lista = req.usuarios.map(x => ({
    dni: normalizarDni(x && x.dni), nombre: texto(x && x.nombre), sede: texto(x && x.sede),
    turno: texto(x && x.turno), roles: rolesDe({ roles: x && x.roles }),
  }));
  const valido = x => x.dni && x.nombre && SEDES.indexOf(x.sede) >= 0 && TURNOS.indexOf(x.turno) >= 0 &&
    x.roles.length && x.roles.every(r => ROLES.indexOf(r) >= 0);
  if (!lista.every(valido)) falla('datos_invalidos');
  const usuarios = deps.repo.leer('usuarios');
  const pines = [];
  for (const x of lista) {
    let u = usuarios.find(v => v.dni === x.dni);
    if (!u) {
      u = { dni: x.dni, activo: 'true' };
      usuarios.push(u);
      pines.push({ dni: x.dni, pin: nuevoPin(u, deps) });
    }
    u.nombre = x.nombre;
    u.sede = x.sede;
    u.turno = x.turno;
    u.roles = x.roles.join(',');
  }
  deps.repo.escribir('usuarios', usuarios);
  return { pines: pines };
}

function pinRegenerar(req, deps) {
  const { usuarios } = exigirAdmin(req, deps);
  const u = usuarios.find(v => v.dni === normalizarDni(req.dni));
  if (!u) falla('no_existe');
  const pin = nuevoPin(u, deps);
  deps.repo.escribir('usuarios', usuarios);
  return { pin: pin };
}

function usuariosListar(req, deps) {
  const { usuarios } = exigirAdmin(req, deps);
  const ahora = deps.ahora();
  return usuarios.map(u => ({
    dni: u.dni, nombre: u.nombre, sede: u.sede, turno: u.turno, roles: rolesDe(u),
    activo: esVerdad(u.activo), bloqueado: Number(u.bloqueado_hasta) > ahora,
  }));
}

function usuarioActivo(req, deps) {
  const { usuarios } = exigirAdmin(req, deps);
  const u = usuarios.find(v => v.dni === normalizarDni(req.dni));
  if (!u) falla('no_existe');
  u.activo = String(req.activo === true || esVerdad(req.activo));
  deps.repo.escribir('usuarios', usuarios);
  return {};
}

const ACCIONES = {
  login: login,
  cambiar_pin: cambiarPin,
  mis_tareas: misTareas,
  marcar: marcar,
  cargar_tareas: cargarTareas,
  bajar_registro: bajarRegistro,
  usuarios_resumen: usuariosResumen,
  sede: vistaSede,
  reasignar: reasignar,
  tareas_de: tareasDe,
  garantia_crear: garantiaCrear,
  garantia_decidir: garantiaDecidir,
  usuarios_cargar: usuariosCargar,
  pin_regenerar: pinRegenerar,
  usuarios_listar: usuariosListar,
  usuario_activo: usuarioActivo,
};

function manejar(req, deps) {
  try {
    if (!req || typeof req !== 'object' || !Object.prototype.hasOwnProperty.call(ACCIONES, req.accion)) falla('datos_invalidos');
    return { ok: true, data: ACCIONES[req.accion](req, deps) };
  } catch (e) {
    if (e instanceof ErrorApi) return { ok: false, error: e.codigo };
    return { ok: false, error: 'interno' };
  }
}

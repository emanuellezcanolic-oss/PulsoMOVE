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

const ACCIONES = {
  login: login,
  cambiar_pin: cambiarPin,
  mis_tareas: misTareas,
  marcar: marcar,
  cargar_tareas: cargarTareas,
  bajar_registro: bajarRegistro,
  usuarios_resumen: usuariosResumen,
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

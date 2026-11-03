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

function misTareas(req, deps) {
  sesion(req, deps);
  return { hoy: deps.hoy(), tareas: [] };
}

const ACCIONES = {
  login: login,
  cambiar_pin: cambiarPin,
  mis_tareas: misTareas,
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

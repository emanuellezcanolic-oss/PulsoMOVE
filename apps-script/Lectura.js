// Acceso de solo lectura para coordinación (Emanuel, 26/11/2026): «quién hace y quién no», para consultar desde Claude.
//
// El bloqueo de escritura no depende de quien consulta: este token se firma con OTRO secreto, así que `sesion()` lo
// rechaza en todas las acciones de la app. La única acción que lo acepta es `lectura`, que no escribe nada.
// Quién entra: el admin, y la coordinación que el admin habilite. Se quita desde Equipo. No salen montos, teléfonos,
// anotaciones ni DNI.

const LECTURA_DIAS_SESION = 30;
const LECTURA_DIAS_RANGO = 31;
const LECTURA_MAX_DETALLE = 40;   // por persona: lo que falta, no el historial entero

function lectSecreto(deps) {
  return deps.props.SECRETO_TOKEN + ':lectura';
}

function lectFila(u, deps) {
  return deps.repo.leer('lectura').find(f => f.dni === u.dni);
}

function lectPuede(u, deps) {
  if (tieneRol(u, 'admin')) return true;
  const f = lectFila(u, deps);
  return tieneRol(u, 'coordinador') && !!f && f.activa === 'true';
}

// Cambia al quitar el acceso o al cambiar el PIN: los tokens anteriores dejan de servir
function lectSello(u, deps) {
  const f = lectFila(u, deps);
  return String((f && f.version) || '0') + '.' + String(u.sal).slice(0, 8);
}

function lectToken(u, deps) {
  const datos = aB64url(u.dni + '|' + (deps.ahora() + LECTURA_DIAS_SESION * 86400000));
  const sello = deps.hmac(datos + '|' + lectSello(u, deps), lectSecreto(deps));
  return datos + '.' + sello;
}

function lectSesion(req, deps) {
  const partes = String(req.token == null ? '' : req.token).split('.');
  if (partes.length !== 2) falla('sin_sesion');
  let campos;
  try { campos = deB64url(partes[0]).split('|'); } catch (e) { falla('sin_sesion'); }
  const u = deps.repo.leer('usuarios').find(x => x.dni === campos[0] && esVerdad(x.activo));
  if (!u || !(Number(campos[1]) > deps.ahora())) falla('sin_sesion');
  if (!igualSeguro(deps.hmac(partes[0] + '|' + lectSello(u, deps), lectSecreto(deps)), partes[1])) falla('sin_sesion');
  if (!lectPuede(u, deps)) falla('sin_sesion');
  return u;
}

function lecturaEntrar(req, deps) {
  const s = login(req, deps);                       // mismo control de PIN, intentos y bloqueo que la app
  const u = deps.repo.leer('usuarios').find(x => x.dni === normalizarDni(req.dni));
  if (s.debe_cambiar_pin) falla('debe_cambiar_pin');
  if (!lectPuede(u, deps)) falla('prohibido');
  return { token: lectToken(u, deps), nombre: u.nombre, dias: LECTURA_DIAS_SESION };
}

function usuarioLectura(req, deps) {
  const { usuario, usuarios } = exigirAdmin(req, deps);
  const u = usuarios.find(v => v.dni === normalizarDni(req.dni));
  if (!u) falla('no_existe');
  if (!tieneRol(u, 'coordinador') || typeof req.activa !== 'boolean') falla('datos_invalidos');
  const filas = deps.repo.leer('lectura');
  const previa = filas.find(f => f.dni === u.dni);
  const version = Number((previa && previa.version) || 0) + (req.activa ? 0 : 1);
  deps.repo.escribir('lectura', filas.filter(f => f.dni !== u.dni).concat([{
    dni: u.dni, activa: String(req.activa), version: String(version),
    actualizado: new Date(deps.ahora()).toISOString(), por_dni: usuario.dni,
  }]));
  return {};
}

function lectRango(req, hoy) {
  const desde = texto(req.desde) || hoy, hasta = texto(req.hasta) || hoy;
  if (!fechaIsoValida(desde) || !fechaIsoValida(hasta) || desde > hasta) falla('datos_invalidos');
  if ((Date.parse(hasta) - Date.parse(desde)) / 86400000 > LECTURA_DIAS_RANGO) falla('datos_invalidos');
  return { desde: desde, hasta: hasta };
}

// El dinero se ve solo dentro de PulsoMOVE (Emanuel, 26/11/2026). Acá no se leen las hojas de plata, y si alguien
// escribió un importe en un título o en el nombre de una tarea, se tapa.
function lectSinPlata(s) {
  return String(s == null ? '' : s).replace(/\$\s*\d[\d.,]*|\d[\d.,]*\s*(pesos|usd|ars)(?![a-z])/gi, '(importe)');
}

function lectDetalle(filas) {
  return filas.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.socio_nombre).localeCompare(String(b.socio_nombre)))
    .slice(0, LECTURA_MAX_DETALLE).map(t => ({ fecha: t.fecha, tipo: lectSinPlata(t.tipo), socio: t.socio_nombre }));
}

function lecturaVer(req, deps) {
  const yo = lectSesion(req, deps);
  const hoy = deps.hoy();
  const rango = lectRango(req, hoy);
  const pedida = texto(req.sede);
  let sedes;
  if (tieneRol(yo, 'admin')) sedes = pedida ? [sedePermitida(yo, pedida)] : SEDES;
  else sedes = [sedePermitida(yo, pedida)];
  const equipo = rol => deps.repo.leer('usuarios')
    .filter(u => esVerdad(u.activo) && tieneRol(u, rol) && sedes.indexOf(u.sede) >= 0)
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  const enRango = iso => { const f = fechaArgentina(iso); return f >= rango.desde && f <= rango.hasta; };
  const tope = rango.hasta < hoy ? rango.hasta : hoy;

  const tareas = deps.repo.leer('tareas').filter(t => t.estado !== 'cerrada' && !esRecordatorio(t.tipo));
  const esperas = esperasActivas(deps.repo.leer('registro'), hoy);
  const recepcion = equipo('recepcion').map(u => {
    const suyas = tareas.filter(t => t.asignado_dni === u.dni);
    // Lo que espera a MOVE o una respuesta no es "no hecho": la persona no lo puede cerrar (igual que en la app)
    const faltan = suyas.filter(t => t.estado === 'pendiente' && t.fecha <= tope && !esperaAMove(t) && !enEspera(t, esperas));
    return {
      nombre: u.nombre, sede: u.sede, turno: u.turno,
      hechas: suyas.filter(t => t.estado === 'hecha' && enRango(t.hecha_en)).length,
      pendientes: faltan.length,
      atrasadas: faltan.filter(t => t.fecha < hoy).length,
      esperando: suyas.filter(t => esperaAMove(t) || enEspera(t, esperas)).length,
      sin_hacer: lectDetalle(faltan),
    };
  });

  const planes = deps.repo.leer('profe_tareas');
  const profes = equipo('profe').map(u => {
    const suyas = planes.filter(t => t.profe_dni === u.dni);
    const faltan = suyas.filter(t => t.estado === 'pendiente' && t.fecha <= tope);
    const mes = tareasMesDeDni(deps, u.dni, tope.slice(0, 7), hoy);
    return {
      nombre: u.nombre, sede: u.sede,
      hechas: suyas.filter(t => t.hecha_en && enRango(t.hecha_en)).length,
      pendientes: faltan.length,
      atrasadas: faltan.filter(t => t.fecha < hoy).length,
      cerradas_sin_marcar: suyas.filter(t => t.estado === 'cerrada' && !t.hecha_en && enRango(t.cerrada_en)).length,
      tareas_del_mes: { mes: mes.mes, hechas: mes.hechas, total: mes.total, faltan: mes.lista.filter(x => !x.hecha).map(x => lectSinPlata(x.texto)) },
      sin_hacer: lectDetalle(faltan),
    };
  });

  const nombresVisibles = {};
  equipo('recepcion').concat(equipo('profe')).forEach(u => { nombresVisibles[u.dni] = true; });
  const todos = deps.repo.leer('usuarios');
  const hechosPedidos = deps.repo.leer('pedidos_hechos');
  const pedidos = pedActivos(deps).map(p => {
    const e = pedEstado(p, hoy);
    const asignados = pedAsignados(p, todos, hechosPedidos, e.ciclo).filter(a => nombresVisibles[a.dni]);
    return {
      titulo: lectSinPlata(p.titulo), estado: e.estado, cierra: e.ciclo,
      hicieron: asignados.filter(a => a.hecho).map(a => a.nombre),
      faltan: asignados.filter(a => !a.hecho).map(a => a.nombre),
      cantidad: asignados.length,
    };
  }).filter(p => p.cantidad && p.estado !== 'programado');

  return { hoy: hoy, desde: rango.desde, hasta: rango.hasta, sedes: sedes, recepcion: recepcion, profes: profes, pedidos: pedidos };
}

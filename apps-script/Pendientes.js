// PulsoMOVE · Pendientes con socios (Emanuel, 25/11/2026).
// Un socio le pide algo al profe («cambiar la fecha de evaluación», «marcarle la planificación») y hoy se olvida.
// El profe (o recepción, para el profe del socio) lo anota y aparece todos los días en su lista hasta que lo marque «Hecho»
// o «No corresponde» (con motivo). Si pasan más de 3 días hábiles sin resolver, coordinación lo ve con un aviso amable.
// Si el socio es de otro profe, el pedido se le puede derivar al profe dueño (le llega a él) o hacerlo uno mismo.
// Cuenta como tarea hecha del profe cuando la resuelve, pero no baja nada mientras está pendiente: no entra en los planes del día
// (ni en el modo concentrado, ni en el día completo, ni en ningún porcentaje).

const PS_DIAS_AVISO = 3;            // días hábiles sin resolver → coordinación lo ve
const PS_QUE_MAX = 200;
const PS_MOTIVO_MAX = 200;
const PS_DIAS_GUARDAR = 120;        // lo resuelto se guarda 4 meses (para contar lo hecho del mes y ver el historial)
const PS_ESTADOS = ['pendiente', 'hecho', 'no_corresponde'];
// Si lo que se pidió es un plan, recordar que existe «Plan extra» (así le cuenta a quien lo hizo)
const PS_ES_PLAN = /\bplan(es|ificaci[oó]n)?\b|\brutina/i;

function psCoordina(u) {
  return tieneRol(u, 'admin') || tieneRol(u, 'coordinador');
}

function psAcceso(u) {
  if (!esProfe(u) && !tieneRol(u, 'recepcion') && !psCoordina(u)) falla('prohibido');
}

function psProfeActivo(usuarios, dni) {
  return usuarios.find(u => u.dni === dni && esVerdad(u.activo) && esProfe(u)) || null;
}

// Socios que puede elegir quien anota. Profe: los mismos que Plan extra (los suyos y los de sus sedes). Recepción: los de la planilla de su sede.
function psSociosDe(usuario, deps) {
  if (esProfe(usuario)) {
    const reeval = deps.repo.leer('profe_reeval');
    const dniDe = {};
    reeval.forEach(c => { if (!dniDe[c.socio_id]) dniDe[c.socio_id] = c.profe_dni; });
    return sociosPlanExtra(usuario, deps).map(s => ({ socio_id: s.socio_id, nombre: s.socio_nombre, sede: s.sede, profe: s.profe, profe_dni: s.profe ? (dniDe[s.socio_id] || '') : usuario.dni }));
  }
  const vistos = {}, out = [];
  const sedeOk = s => tieneRol(usuario, 'admin') && !tieneRol(usuario, 'recepcion') ? true : s === usuario.sede;
  deps.repo.leer('profe_planilla').forEach(f => {
    const id = texto(f.socio_id);
    if (!id || vistos[id] || !texto(f.nombre) || !sedeOk(f.sede)) return;
    vistos[id] = true;
    out.push({ socio_id: id, nombre: texto(f.nombre), sede: f.sede, profe: texto(f.profe_nombre), profe_dni: texto(f.profe_dni) });
  });
  deps.repo.leer('profe_reeval').forEach(c => {
    const id = texto(c.socio_id);
    if (!id || vistos[id] || !sedeOk(c.sede)) return;
    vistos[id] = true;
    out.push({ socio_id: id, nombre: texto(c.socio_nombre), sede: c.sede, profe: texto(c.profe), profe_dni: texto(c.profe_dni) });
  });
  return out.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
}

function psVista(p, hoy) {
  const desde = fechaArgentina(p.creado_ts);
  const dias = p.estado === 'pendiente' ? diasHabiles(desde, hoy) : 0;
  return {
    id: p.id, sede: p.sede, socio_id: p.socio_id, socio_nombre: p.socio_nombre, profe_dni: p.profe_dni, profe_nombre: p.profe_nombre, que: p.que,
    limite: p.limite, vence_hoy: !!(p.limite && p.limite <= hoy && p.estado === 'pendiente'), estado: p.estado, motivo: p.motivo, desde: desde,
    dias_habiles: dias, atrasado: p.estado === 'pendiente' && dias > PS_DIAS_AVISO, creado_nombre: p.creado_nombre, creado_rol: p.creado_rol,
    derivado_de_nombre: p.derivado_de_nombre, resuelto: p.resuelto_ts ? fechaArgentina(p.resuelto_ts) : '', resuelto_nombre: p.resuelto_nombre,
    es_plan: PS_ES_PLAN.test(p.que),
  };
}

function psOrden(a, b) {
  const la = a.limite || '9999-99-99', lb = b.limite || '9999-99-99';
  return (la < lb ? -1 : la > lb ? 1 : 0) || (String(a.creado_ts) < String(b.creado_ts) ? -1 : 1);
}

// Lo del profe: abiertos (todos los días hasta resolverlos) y lo resuelto hoy / en el mes. Solo lee.
function psDeProfe(usuario, deps, hoy) {
  const filas = deps.repo.leer('socio_pendientes').filter(p => p.profe_dni === usuario.dni);
  const mes = hoy.slice(0, 7);
  const resueltos = filas.filter(p => p.estado !== 'pendiente' && p.resuelto_ts);
  return {
    abiertos: filas.filter(p => p.estado === 'pendiente').sort(psOrden).map(p => psVista(p, hoy)),
    resueltos_hoy: resueltos.filter(p => fechaArgentina(p.resuelto_ts) === hoy).map(p => psVista(p, hoy)),
    hechos_mes: resueltos.filter(p => p.estado === 'hecho' && fechaArgentina(p.resuelto_ts).slice(0, 7) === mes).length,
    dias_aviso: PS_DIAS_AVISO,
  };
}

// Lo que coordinación tiene que mirar: pendientes con más de 3 días hábiles. `sede` vacía = todas.
function psAtrasados(deps, hoy, sede) {
  return deps.repo.leer('socio_pendientes').filter(p => p.estado === 'pendiente' && (!sede || p.sede === sede)).map(p => psVista(p, hoy))
    .filter(v => v.atrasado).sort((a, b) => b.dias_habiles - a.dias_habiles);
}

function socioPendienteSocios(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  psAcceso(usuario);
  const hoy = deps.hoy();
  const desde = sumarDiasProfe(hoy, -14);
  const anotados = deps.repo.leer('socio_pendientes').filter(p => p.creado_dni === usuario.dni && fechaArgentina(p.creado_ts) >= desde)
    .sort((a, b) => (String(a.creado_ts) < String(b.creado_ts) ? 1 : -1)).slice(0, 15).map(p => psVista(p, hoy));
  const sedes = {};
  psSociosDe(usuario, deps).forEach(s => { sedes[s.sede] = true; });
  if (usuario.sede) sedes[usuario.sede] = true;
  const profes = usuarios.filter(u => esVerdad(u.activo) && esProfe(u) && (sedes[u.sede] || psCoordina(usuario))).map(u => ({ dni: u.dni, nombre: u.nombre, sede: u.sede }))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  return { socios: psSociosDe(usuario, deps), profes: profes, anotados: anotados, soy_profe: esProfe(usuario), dias_aviso: PS_DIAS_AVISO };
}

// para: 'yo' (lo hago yo) | 'dueno' (se lo derivo al profe dueño del socio). Recepción: siempre al profe del socio (o al que elija).
function socioPendienteAnotar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  psAcceso(usuario);
  const hoy = deps.hoy();
  const que = texto(req.que).replace(/\s+/g, ' ');
  if (que.length < 3 || que.length > PS_QUE_MAX) falla('datos_invalidos');
  const limite = texto(req.limite);
  if (limite && (!fechaIsoValida(limite) || limite < hoy)) falla('datos_invalidos');
  const s = psSociosDe(usuario, deps).find(x => x.socio_id === texto(req.socio_id));
  if (!s) falla('no_existe');
  const dueno = duenoActualDeSocio(deps, hoy, usuarios, { socio_id: s.socio_id, profe_dni: s.profe_dni, profe: s.profe });
  const duenoU = psProfeActivo(usuarios, dueno.dni);
  let para = null, derivadoDe = null;
  if (esProfe(usuario)) {
    if (texto(req.para) === 'dueno' && duenoU && duenoU.dni !== usuario.dni) { para = duenoU; derivadoDe = usuario; }
    else para = usuario;
  } else {
    const elegido = texto(req.profe_dni) ? psProfeActivo(usuarios, texto(req.profe_dni)) : null;
    if (texto(req.profe_dni) && !elegido) falla('datos_invalidos');
    para = elegido || duenoU;
    if (!para) falla('pendiente_sin_profe');
  }
  const ts = new Date(deps.ahora()).toISOString();
  // limpieza: lo resuelto hace más de 4 meses se borra
  const limiteGuardar = sumarDiasProfe(hoy, -PS_DIAS_GUARDAR);
  const filas = deps.repo.leer('socio_pendientes');
  const quedan = filas.filter(p => p.estado === 'pendiente' || !p.resuelto_ts || fechaArgentina(p.resuelto_ts) >= limiteGuardar);
  if (quedan.length < filas.length) deps.repo.escribir('socio_pendientes', quedan);
  const fila = {
    id: 'ps-' + deps.aleatorio(5), sede: s.sede, socio_id: s.socio_id, socio_nombre: s.nombre, profe_dni: para.dni, profe_nombre: para.nombre,
    que: que, limite: limite, estado: 'pendiente', motivo: '', creado_ts: ts, creado_dni: usuario.dni, creado_nombre: usuario.nombre,
    creado_rol: esProfe(usuario) ? 'profe' : 'recepcion', derivado_de_dni: derivadoDe ? derivadoDe.dni : '', derivado_de_nombre: derivadoDe ? derivadoDe.nombre : '',
    resuelto_ts: '', resuelto_dni: '', resuelto_nombre: '',
  };
  deps.repo.agregar('socio_pendientes', fila);
  const deOtro = !!(duenoU && duenoU.dni !== para.dni);
  return { pendiente: psVista(fila, hoy), para_nombre: para.nombre, dueno_nombre: dueno.nombre || '', de_otro_profe: deOtro,
    recordar_plan_extra: esProfe(usuario) && para.dni === usuario.dni && deOtro && PS_ES_PLAN.test(que) };
}

// Hecho / No corresponde (con motivo) / volver a pendiente (deshacer, el mismo día). Lo resuelve el profe que lo tiene, o admin.
function socioPendienteResolver(req, deps) {
  const { usuario } = sesion(req, deps);
  const filas = deps.repo.leer('socio_pendientes');
  const p = filas.find(x => x.id === texto(req.id));
  if (!p) falla('no_existe');
  if (p.profe_dni !== usuario.dni && !tieneRol(usuario, 'admin')) falla('prohibido');
  const resultado = texto(req.resultado);
  if (PS_ESTADOS.indexOf(resultado) < 0) falla('datos_invalidos');
  const hoy = deps.hoy();
  if (resultado === 'pendiente') {
    if (p.estado === 'pendiente' || fechaArgentina(p.resuelto_ts) !== hoy) falla('datos_invalidos');
    Object.assign(p, { estado: 'pendiente', motivo: '', resuelto_ts: '', resuelto_dni: '', resuelto_nombre: '' });
  } else {
    if (p.estado !== 'pendiente') falla('ya_anotado');
    const motivo = texto(req.motivo).slice(0, PS_MOTIVO_MAX);
    if (resultado === 'no_corresponde' && motivo.length < 3) falla('pendiente_sin_motivo');
    Object.assign(p, { estado: resultado, motivo: motivo, resuelto_ts: new Date(deps.ahora()).toISOString(), resuelto_dni: usuario.dni, resuelto_nombre: usuario.nombre });
  }
  deps.repo.escribir('socio_pendientes', filas);
  return { pendiente: psVista(p, hoy), mios: esProfe(usuario) ? psDeProfe(usuario, deps, hoy) : null };
}

// Pasárselo al profe dueño del socio (si es otro). Le llega a él.
function socioPendienteDerivar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!esProfe(usuario)) falla('prohibido');
  const filas = deps.repo.leer('socio_pendientes');
  const p = filas.find(x => x.id === texto(req.id));
  if (!p || p.estado !== 'pendiente') falla('no_existe');
  if (p.profe_dni !== usuario.dni) falla('prohibido');
  const hoy = deps.hoy();
  const r = deps.repo.leer('profe_reeval').find(x => x.socio_id === p.socio_id) || {};
  const dueno = duenoActualDeSocio(deps, hoy, usuarios, { socio_id: p.socio_id, profe_dni: texto(r.profe_dni), profe: texto(r.profe) });
  const duenoU = psProfeActivo(usuarios, dueno.dni);
  if (!duenoU || duenoU.dni === usuario.dni) falla('pendiente_sin_profe');
  Object.assign(p, { profe_dni: duenoU.dni, profe_nombre: duenoU.nombre, derivado_de_dni: usuario.dni, derivado_de_nombre: usuario.nombre });
  deps.repo.escribir('socio_pendientes', filas);
  return { pendiente: psVista(p, hoy), para_nombre: duenoU.nombre, mios: psDeProfe(usuario, deps, hoy) };
}

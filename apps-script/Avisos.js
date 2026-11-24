// PulsoMOVE · Aviso de condición del socio (Emanuel, 24/11/2026). Desde el lunes 30/11/2026.
//
// Cuando la membresía de un socio de la Planilla ya venció (el día del vencimiento o después), no renovó y no tiene una condición
// puesta a mano, le aparece al profe dueño del socio y a la recepción de su sede un aviso amable: "¿Cómo viene Fulano?".
// Se responde con cuatro botones (renueva con fecha, está de vacaciones, no vuelve, todavía no sé). Si alguien responde, el aviso
// desaparece para el otro. No es una tarea: no se guarda en `tareas` ni cuenta en el cumplimiento de nadie.
//
// Lo respondido queda en la hoja `aviso_condicion` (una fila por respuesta) y se ve en la ficha del socio. La condición automática
// no cambia (la baja a los 7 días sigue igual): solo las vacaciones cargadas por recepción pasan a ser una condición a mano.

const AVISO_CONDICION_DESDE = '2026-11-30';   // antes de este día no se avisa; para los que ya vencieron, los días cuentan desde acá
const AVISO_RENUEVA_DIAS_MAX = 10;            // "renueva el ...": hasta 10 días desde hoy
const AVISO_MOTIVO_MAX = 200;
const AVISO_RESPUESTAS = ['renueva', 'vacaciones', 'no_vuelve', 'no_se'];
const DIAS_GUARDAR_AVISOS = 180;              // las respuestas más viejas se borran solas (la ficha muestra las últimas)
const AVISO_HISTORIAL_FICHA = 8;

function diaDeSemanaIso(iso) {
  return new Date(iso + 'T12:00:00Z').getUTCDay();
}

function proximoDiaHabilAviso(iso) {
  let d = sumarDiasProfe(iso, 1);
  while (diaDeSemanaIso(d) === 0 || diaDeSemanaIso(d) === 6) d = sumarDiasProfe(d, 1);
  return d;
}

function diasCorridosAviso(desde, hasta) {
  return Math.round((Date.parse(hasta + 'T12:00:00Z') - Date.parse(desde + 'T12:00:00Z')) / 86400000);
}

function ddmmAviso(iso) {
  return String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7);
}

// Las respuestas de un socio, la más nueva primero, tal como las ve la ficha
function historialAviso(filas, nombres) {
  return (filas || []).slice().sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1)).map(a => ({
    ts: a.ts, fecha: fechaLocalDe(a.ts), quien: a.nombre || nombres[a.dni] || '', respuesta: a.respuesta, hasta: a.hasta, nota: a.nota, vence: a.vence,
  }));
}

// Lo que dice el aviso. Amable, sin mayúsculas ni signos de alarma; "ya van N días" solo informa.
function textosAviso(nombre, vence, hoy, dias, ult, pedido) {
  if (pedido) {
    return { titulo: `${pedido.quien || 'El profe'} cuenta que ${nombre} está de vacaciones`,
      lineas: [`Dice que vuelve el ${ddmmAviso(pedido.hasta)}. Si lo confirmás, cargá las vacaciones así no cuentan como baja.`] };
  }
  const lineas = [vence === hoy ? 'Su plan vence hoy. Contanos cómo sigue así lo acompañamos.' : `Su plan venció el ${ddmmAviso(vence)}. Contanos cómo sigue así lo acompañamos.`];
  if (ult && ult.respuesta === 'renueva' && ult.hasta) lineas.push(`Quedó en renovar el ${ddmmAviso(ult.hasta)}: ¿pudo hacerlo?`);
  if (dias >= 1) lineas.push(`Ya ${dias === 1 ? 'va 1 día' : 'van ' + dias + ' días'}: ¿pudiste hablar con ${nombre}? Con lo que nos cuentes lo ayudamos mejor.`);
  return { titulo: `¿Cómo viene ${nombre}?`, lineas: lineas };
}

// El aviso de una fila de la Planilla (la vista de filasPlanilla), o null si hoy no corresponde.
// `desde` es AVISO_CONDICION_DESDE (las pruebas y la práctica lo adelantan).
function estadoAvisoCondicion(f, hoy, desde) {
  if (!fechaIsoValida(hoy) || hoy < desde) return null;
  if (f.condicion !== 'ACTIVO' || f.condicion_manual || !fechaIsoValida(f.vence) || f.vence > hoy) return null;
  const ult = (f.aviso_hist || []).filter(a => a.vence === f.vence)[0] || null;   // la respuesta de este vencimiento, la más nueva
  let pedido = null;
  if (ult) {
    if (ult.respuesta === 'no_vuelve') return null;
    if (ult.respuesta === 'renueva' && ult.hasta && hoy <= ult.hasta) return null;                    // silencia hasta la fecha: si pasó, vuelve a preguntar
    if (ult.respuesta === 'no_se' && hoy < proximoDiaHabilAviso(ult.fecha)) return null;              // vuelve el próximo día hábil
    if (ult.respuesta === 'vacaciones_pedida' && ult.hasta && hoy <= ult.hasta) pedido = { hasta: ult.hasta, quien: ult.quien, fecha: ult.fecha };
  }
  const dias = Math.max(0, diasCorridosAviso(f.vence > desde ? f.vence : desde, hoy));
  const t = textosAviso(f.nombre, f.vence, hoy, dias, ult, pedido);
  return { socio_id: f.socio_id, nombre: f.nombre, sede: f.sede, profe_dni: f.profe_dni, profe: f.profe_nombre || '', vence: f.vence, dias: dias,
    titulo: t.titulo, lineas: t.lineas, pedido_vacaciones: pedido, ultima: ult ? { respuesta: ult.respuesta, hasta: ult.hasta, quien: ult.quien, fecha: ult.fecha } : null,
    vac_max: sumarDiasProfe(f.vence, DIAS_VACACIONES_MAX), renueva_max: sumarDiasProfe(hoy, AVISO_RENUEVA_DIAS_MAX) };
}

// como: 'profe' (sus socios) o 'recepcion' (los de la sede). El pedido de vacaciones que hizo un profe queda solo para recepción.
function listarAvisosCondicion(filas, hoy, desde, como) {
  return filas.map(f => estadoAvisoCondicion(f, hoy, desde)).filter(a => a && (como === 'recepcion' || !a.pedido_vacaciones))
    .sort((a, b) => b.dias - a.dias || String(a.nombre).localeCompare(String(b.nombre)));
}

// Los avisos de una persona para su pantalla de inicio. Antes de calcular, se descarta lo que no puede ser aviso (casi toda la planilla).
function avisosCondicionDe(usuario, usuarios, deps, como) {
  const hoy = deps.hoy(), desde = deps.avisoDesde || AVISO_CONDICION_DESDE;
  if (hoy < desde) return [];
  const pre = {};
  let hay = false;
  deps.repo.leer('profe_planilla').forEach(f => {
    if (f.condicion_auto === 'ACTIVO' && fechaIsoValida(f.vence) && f.vence <= hoy && (como === 'profe' || f.sede === usuario.sede)) { pre[f.socio_id] = true; hay = true; }
  });
  if (!hay) return [];
  const filas = filasPlanilla(deps, hoy, usuarios, pre).filter(f => (como === 'profe' ? f.profe_dni === usuario.dni : f.sede === usuario.sede));
  return listarAvisosCondicion(filas, hoy, desde, como);
}

function avisoCondicionResponder(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const hoy = deps.hoy(), desde = deps.avisoDesde || AVISO_CONDICION_DESDE;
  const socio = texto(req.socio_id), respuesta = texto(req.respuesta), fecha = texto(req.fecha), nota = texto(req.nota);
  if (!socio || AVISO_RESPUESTAS.indexOf(respuesta) < 0 || nota.length > AVISO_MOTIVO_MAX) falla('datos_invalidos');
  const fila = filasPlanilla(deps, hoy, usuarios, { [socio]: true })[0];
  if (!fila) falla('no_existe');
  if (!puedeEditarPlanilla(usuario, fila, 'condicion')) falla('prohibido');
  const como = tieneRol(usuario, 'recepcion') && usuario.sede ? 'recepcion' : 'profe';
  const devolver = extra => Object.assign({ avisos: avisosCondicionDe(usuario, usuarios, deps, como) }, extra || {});
  // si otro ya lo respondió (o ya no corresponde), no se pisa: se le cuenta quién fue
  const aviso = estadoAvisoCondicion(fila, hoy, desde);
  if (!aviso) {
    const ult = (fila.aviso_hist || [])[0];
    return devolver({ ya_respondido: ult ? { quien: ult.quien, respuesta: ult.respuesta, hasta: ult.hasta, fecha: ult.fecha } : { quien: '', respuesta: '', hasta: '', fecha: '' } });
  }
  const puedeCargarVacaciones = tieneRol(usuario, 'recepcion') || tieneRol(usuario, 'coordinador') || tieneRol(usuario, 'admin');
  let registrada = respuesta, hasta = '';
  if (respuesta === 'renueva') {
    if (!fechaIsoValida(fecha)) falla('aviso_sin_fecha');
    if (fecha < hoy) falla('datos_invalidos');
    if (fecha > sumarDiasProfe(hoy, AVISO_RENUEVA_DIAS_MAX)) falla('aviso_fecha_lejos');
    hasta = fecha;
  } else if (respuesta === 'vacaciones') {
    if (!fechaIsoValida(fecha)) falla('vac_sin_vuelta');
    if (puedeCargarVacaciones) {
      const motivo = motivoVacacionesInvalidas(usuario, fila, fecha, hoy);
      if (motivo) falla(motivo);
      // recepción / coordinación / admin: las vacaciones quedan cargadas (la condición pasa a ser a mano, como desde la ficha)
      deps.repo.agregar('profe_planilla_edit', { socio_id: socio, campo: 'condicion', valor: 'VACACIONES', hasta: fecha, vence_al_editar: fila.vence || '',
        ts: new Date(deps.ahora()).toISOString(), dni: usuario.dni });
    } else {
      // el profe no las carga: queda como pedido a recepción, con la fecha de vuelta
      if (fecha < hoy) falla('datos_invalidos');
      if (fecha > sumarDiasProfe(fila.vence, DIAS_VACACIONES_MAX)) falla('vac_larga');
      registrada = 'vacaciones_pedida';
    }
    hasta = fecha;
  } else if (fecha) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  // lo más viejo se borra solo (una sola escritura, y solo si hay algo para borrar)
  const limite = sumarDiasProfe(hoy, -DIAS_GUARDAR_AVISOS);
  const guardadas = deps.repo.leer('aviso_condicion');
  const vigentes = guardadas.filter(a => fechaLocalDe(a.ts) >= limite);
  if (vigentes.length < guardadas.length) deps.repo.escribir('aviso_condicion', vigentes);
  deps.repo.agregar('aviso_condicion', { id: 'ac-' + socio + '-' + ts, socio_id: socio, sede: fila.sede, profe_dni: fila.profe_dni, vence: fila.vence,
    respuesta: registrada, hasta: hasta, nota: respuesta === 'no_vuelve' || respuesta === 'no_se' ? nota : '', dni: usuario.dni, nombre: usuario.nombre, ts: ts });
  return devolver({ registrada: registrada, hasta: hasta });
}

// ---------- Aviso al dueño: Plan extra de un socio que figura como de otro profe (Emanuel, 24/11/2026) ----------
// Regla de Emanuel: el plan lo cuenta quien lo hizo. Cuando un profe anota un Plan extra de un socio cuyo dueño actual (planilla o
// reevaluaciones) es otro profe, el dueño recibe «<Profe> modificó el plan de <socio>, que figura como tu socio. ¿Es tu socio?».
//  - Sí: queda como figura (el dueño no cambia). El plan sigue contando como armado por quien lo hizo.
//  - No: el socio pasa a quien hizo el plan (edición de `profe_dni` en profe_planilla_edit, que la PC respeta), y se le crea una tarea
//    a recepción de la sede para corregir el profe en MOVE (el mismo mecanismo de "no es mi entrenado").
//  - Sin respuesta: el plan cuenta para quien lo hizo y el dueño no cambia. Todo queda en el historial del socio.
// Comisión de esa renovación (la calcula la PC, pulso_profes_liq.py): sigue al dueño confirmado; si nadie respondió, a quien hizo el plan.
const AVISO_DUENO_DIAS_GUARDAR = 180;
const DIAS_PLAN_HECHO_POR = 35;       // "Plan hecho por X" en la fila del socio mientras el plan sea de los últimos 35 días
const NOTA_PLAN_EXTRA = 'Plan extra de un socio que no estaba en tu lista';

// El dueño actual de un socio: lo que dice la planilla (con lo que coordinación o un "no" cambió) y, si no está, las reevaluaciones.
function duenoActualDeSocio(deps, hoy, usuarios, c) {
  const fila = filasPlanilla(deps, hoy, usuarios, { [c.socio_id]: true })[0];
  const dni = fila && fila.profe_dni ? fila.profe_dni : c.profe_dni;
  const u = usuarios.find(x => x.dni === dni);
  return { dni: dni || '', nombre: u ? u.nombre : ((fila && fila.profe_nombre) || c.profe || '') };
}

function vistaAvisoDueno(a, usuarios) {
  return { recepcion: usuarios.filter(u => u.sede === a.sede && esVerdad(u.activo) && tieneRol(u, 'recepcion')).map(u => ({ dni: u.dni, nombre: u.nombre })), id: a.id, socio_id: a.socio_id, socio_nombre: a.socio_nombre, sede: a.sede, hizo: a.hizo_nombre, fecha: fechaLocalDe(a.ts),
    titulo: `${a.hizo_nombre} modificó el plan de ${a.socio_nombre}, que figura como tu socio.`,
    lineas: ['¿Es tu socio?', `Si decís que no, pasa a ser socio de ${a.hizo_nombre} y le avisamos a recepción para que lo cambie en MOVE.`] };
}

function avisosDuenoDe(usuario, deps, usuarios) {
  usuarios = usuarios || deps.repo.leer('usuarios');
  return deps.repo.leer('aviso_dueno').filter(a => a.estado === 'pendiente' && a.dueno_dni === usuario.dni)
    .sort((a, b) => (String(a.ts) < String(b.ts) ? -1 : 1)).map(a => vistaAvisoDueno(a, usuarios));
}

// Crea el aviso (una sola vez por plan) y limpia lo más viejo. Devuelve la fila, o null si el dueño no puede recibirlo.
function crearAvisoDueno(deps, usuarios, hizo, tarea, dueno, ts) {
  const du = usuarios.find(u => u.dni === dueno.dni && esVerdad(u.activo) && esProfe(u));
  if (!du || du.dni === hizo.dni) return null;
  const limite = sumarDiasProfe(deps.hoy(), -AVISO_DUENO_DIAS_GUARDAR);
  const guardadas = deps.repo.leer('aviso_dueno');
  const vigentes = guardadas.filter(a => fechaLocalDe(a.ts) >= limite);
  if (vigentes.length < guardadas.length) deps.repo.escribir('aviso_dueno', vigentes);
  if (vigentes.some(a => a.tarea_id === tarea.id)) return null;
  const fila = { id: 'ad-' + tarea.socio_id + '-' + ts, tarea_id: tarea.id, socio_id: tarea.socio_id, socio_nombre: tarea.socio_nombre, sede: tarea.sede,
    hizo_dni: hizo.dni, hizo_nombre: tarea.profe || hizo.nombre, dueno_dni: du.dni, dueno_nombre: du.nombre, estado: 'pendiente', ts: ts, respondida_ts: '', respondio_dni: '' };
  deps.repo.agregar('aviso_dueno', fila);
  return fila;
}

function notaPlanExtraCon(nota, extra) {
  return String(nota || NOTA_PLAN_EXTRA).split(' · ')[0] + (extra ? ' · ' + extra : '');
}

function avisoDuenoResponder(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!esProfe(usuario)) falla('prohibido');
  const id = texto(req.id), respuesta = texto(req.respuesta);
  if (!id || ['si', 'no'].indexOf(respuesta) < 0) falla('datos_invalidos');
  const avisos = deps.repo.leer('aviso_dueno');
  const a = avisos.find(x => x.id === id);
  if (!a || a.dueno_dni !== usuario.dni) falla('no_existe');
  const devolver = extra => Object.assign({ avisos: avisosDuenoDe(usuario, deps, usuarios) }, extra || {});
  if (a.estado !== 'pendiente') return devolver({ ya_respondido: a.estado });
  const ts = new Date(deps.ahora()).toISOString();
  const tareas = deps.repo.leer('profe_tareas');
  const plan = tareas.find(x => x.id === a.tarea_id);
  let recepcionista = '', sinRecepcion = false;
  if (respuesta === 'no') {
    const conSede = Object.assign({}, usuario, { sede: a.sede });
    const op = opcionesDeProfe(conSede, usuarios);
    const dniRec = normalizarDni(req.dni);
    const rec = dniRec ? op.recepcion.find(u => u.dni === dniRec) : op.recepcion[0];
    if (dniRec && !rec) falla('datos_invalidos');
    // tarea a recepción de la sede para corregir el profe en MOVE (si ya había una pendiente por este socio, esa sirve)
    const yaHay = deps.repo.leer('tareas').some(x => x.socio_id === 'profe-' + a.socio_id && x.estado === 'pendiente');
    if (rec && !yaHay) recepcionista = avisarCambioDeProfe(conSede, usuarios, deps, { socio_id: a.socio_id, socio_nombre: a.socio_nombre },
      op.profes.indexOf(a.hizo_nombre) >= 0 ? a.hizo_nombre : '', rec.dni).nombre;
    else if (rec) recepcionista = rec.nombre;
    else sinRecepcion = true;
    // el socio pasa a quien hizo el plan: edición de planilla (la PC la respeta) y reevaluaciones
    deps.repo.agregar('profe_planilla_edit', { socio_id: a.socio_id, campo: 'profe_dni', valor: a.hizo_dni, hasta: '', vence_al_editar: '', ts: ts, dni: usuario.dni });
    const reeval = deps.repo.leer('profe_reeval');
    let cambio = false;
    reeval.forEach(c => { if (c.socio_id === a.socio_id && c.profe_dni === usuario.dni) { c.profe_dni = a.hizo_dni; c.profe = a.hizo_nombre; cambio = true; } });
    if (cambio) deps.repo.escribir('profe_reeval', reeval);
    // lo que el dueño tenía pendiente de ese socio sale de su lista (como en "no es mi entrenado")
    tareas.forEach(t => {
      if (t.profe_dni === usuario.dni && t.socio_id === a.socio_id && t.estado === 'pendiente') {
        Object.assign(t, { estado: 'derivada', hecha_en: ts, hecha_dni: usuario.dni, nota: `No es su socio: pasó a ${a.hizo_nombre}, que le hizo el plan` });
      }
    });
  }
  if (plan) plan.nota = notaPlanExtraCon(plan.nota, respuesta === 'no' ? `${usuario.nombre} dijo que no era su socio: pasó a ser tuyo` : `${usuario.nombre} confirmó que es su socio`);
  deps.repo.escribir('profe_tareas', tareas);
  a.estado = respuesta;
  a.respondida_ts = ts;
  a.respondio_dni = usuario.dni;
  deps.repo.escribir('aviso_dueno', avisos);
  return devolver({ registrada: respuesta, recepcionista: recepcionista, sin_recepcion: sinRecepcion });
}

// Lo que ve la ficha de la planilla: los Plan extra de cada socio (el más nuevo primero) con lo que respondió el dueño
function planExtraPorSocio(deps, ids, nombres) {
  const porTarea = {};
  deps.repo.leer('aviso_dueno').forEach(a => { porTarea[a.tarea_id] = a; });
  const out = {};
  deps.repo.leer('profe_tareas').forEach(t => {
    if (t.tipo !== 'Plan extra' || t.estado !== 'hecha' || !ids[t.socio_id]) return;
    const a = porTarea[t.id];
    (out[t.socio_id] = out[t.socio_id] || []).push({ ts: t.hecha_en, fecha: fechaArgentina(t.hecha_en), hizo_dni: t.profe_dni, quien: nombres[t.profe_dni] || t.profe,
      aviso: a ? a.estado : '', dueno: a ? a.dueno_nombre : '' });
  });
  Object.keys(out).forEach(k => out[k].sort((x, y) => (String(x.ts) < String(y.ts) ? 1 : -1)));
  return out;
}

// "Plan hecho por X": el último Plan extra (de los últimos 35 días) hecho por alguien que no es el dueño que figura
function planHechoPor(hist, duenoDni, hoy) {
  const desde = sumarDiasProfe(hoy, -DIAS_PLAN_HECHO_POR);
  const ult = (hist || [])[0];
  return ult && ult.fecha >= desde && ult.hizo_dni !== duenoDni ? ult.quien : '';
}

// Lo que baja la PC para atribuir (pulso_planilla.py y pulso_profes_liq.py): los Plan extra hechos y lo que respondieron los dueños
function planExtraParaPc(deps, hoy) {
  const desde = sumarDiasProfe(hoy, -90);
  return {
    plan_extra: deps.repo.leer('profe_tareas').filter(t => t.tipo === 'Plan extra' && t.estado === 'hecha' && fechaArgentina(t.hecha_en) >= desde)
      .map(t => ({ id: t.id, socio_id: t.socio_id, socio_nombre: t.socio_nombre, sede: t.sede, profe: t.profe, profe_dni: t.profe_dni, hecha_en: t.hecha_en, fecha: fechaArgentina(t.hecha_en) })),
    avisos_dueno: deps.repo.leer('aviso_dueno'),
  };
}

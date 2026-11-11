// PulsoMOVE Profes: los planes que tiene que renovar cada profe (y cada kinesiólogo), día por día.
// El reparto lo calcula la PC (pulso_profes.py) con los datos de MOVE y lo sube con cargar_profe_tareas.
// Acá solo se guarda, se muestra y se marca. No toca nada de recepción (Emanuel, 10/11/2026).

const TIPOS_PROFE = ['Plan nuevo', 'Plan vencido', 'Sin plan', 'Plan sin vencimiento', 'Renovar plan'];
const DIAS_GUARDAR_PROFE = 60;      // las cerradas se guardan dos meses, para ver cuántas hizo cada uno
const DIAS_SEMANA_PROFE = 7;        // "próximos a renovar": lo que viene en la semana

function esProfe(u) {
  return tieneRol(u, 'profe');
}

function sumarDiasProfe(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// La carga del día reemplaza la agenda: lo que ya no viene es porque MOVE muestra el plan renovado (o el socio se fue).
// Lo marcado por el profe se respeta mientras sea el mismo vencimiento; si cambió el vencimiento, es un ciclo nuevo.
function fusionarProfeTareas(viejas, nuevas, hoy, ts) {
  const porId = {};
  viejas.forEach(v => { porId[v.id] = v; });
  const vistas = {};
  const filas = [];
  let nuevasN = 0, cerradasN = 0;
  nuevas.forEach(n => {
    const v = porId[n.id];
    vistas[n.id] = true;
    const mismoCiclo = v && v.estado !== 'cerrada' && String(v.vence || '') === String(n.vence || '');
    if (!mismoCiclo) nuevasN++;
    filas.push({
      id: n.id, fecha: n.fecha, sede: n.sede, profe: n.profe, profe_dni: n.profe_dni, socio_id: n.socio_id, socio_nombre: n.socio_nombre,
      tipo: n.tipo, accion: n.accion, vence: n.vence, alta: n.alta,
      estado: mismoCiclo ? v.estado : 'pendiente', hecha_en: mismoCiclo ? v.hecha_en : '', hecha_dni: mismoCiclo ? v.hecha_dni : '',
      nota: mismoCiclo ? v.nota : '', cargada: mismoCiclo && v.cargada ? v.cargada : hoy, cerrada_en: '',
    });
  });
  const desde = sumarDiasProfe(hoy, -DIAS_GUARDAR_PROFE);
  viejas.forEach(v => {
    if (vistas[v.id]) return;
    if (v.estado === 'cerrada') {
      if (String(v.cerrada_en).slice(0, 10) >= desde) filas.push(v);
      return;
    }
    cerradasN++;
    filas.push(Object.assign({}, v, { estado: 'cerrada', cerrada_en: ts, nota: v.estado === 'hecha' ? v.nota : (v.nota || 'Se cerró sola: MOVE ya no lo muestra pendiente') }));
  });
  return { filas: filas, nuevas: nuevasN, cerradas: cerradasN };
}

function cargarProfeTareas(req, deps) {
  exigirClave(req, deps);
  const hoy = texto(req.hoy) || deps.hoy();
  if (!fechaIsoValida(hoy) || !Array.isArray(req.tareas)) falla('datos_invalidos');
  const lista = req.tareas.map(t => ({
    id: texto(t && t.id), fecha: texto(t && t.fecha), sede: texto(t && t.sede), profe: texto(t && t.profe), profe_dni: normalizarDni(t && t.profe_dni),
    socio_id: texto(t && t.socio_id), socio_nombre: texto(t && t.socio_nombre), tipo: texto(t && t.tipo), accion: texto(t && t.accion),
    vence: texto(t && t.vence), alta: texto(t && t.alta),
  }));
  const valida = t => t.id && fechaIsoValida(t.fecha) && SEDES.indexOf(t.sede) >= 0 && t.profe && t.socio_id && TIPOS_PROFE.indexOf(t.tipo) >= 0;
  if (!lista.every(valida)) falla('datos_invalidos');
  const r = fusionarProfeTareas(deps.repo.leer('profe_tareas'), lista, hoy, new Date(deps.ahora()).toISOString());
  deps.repo.escribir('profe_tareas', r.filas);
  return { nuevas: r.nuevas, cerradas: r.cerradas, total: lista.length };
}

function vistaTareaProfe(t, hoy) {
  const dias = t.fecha < hoy ? Math.round((Date.parse(hoy) - Date.parse(t.fecha)) / 86400000) : 0;
  return {
    id: t.id, fecha: t.fecha, sede: t.sede, profe: t.profe, socio_id: t.socio_id, socio_nombre: t.socio_nombre, tipo: t.tipo, accion: t.accion,
    vence: t.vence, alta: t.alta, estado: t.estado, hecha_en: t.hecha_en, nota: t.nota, atraso: dias,
  };
}

const ORDEN_TIPO_PROFE = { 'Plan nuevo': 0, 'Plan vencido': 1, 'Sin plan': 2, 'Plan sin vencimiento': 3, 'Renovar plan': 4 };
function ordenProfe(a, b) {
  return (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) || (ORDEN_TIPO_PROFE[a.tipo] - ORDEN_TIPO_PROFE[b.tipo]) || String(a.vence).localeCompare(String(b.vence));
}

// Lo de un profe: hoy (lo del día y lo atrasado), los próximos días y cuánto lleva hecho.
function agendaDeProfe(filas, hoy) {
  const hasta = sumarDiasProfe(hoy, DIAS_SEMANA_PROFE);
  const abiertas = filas.filter(t => t.estado !== 'cerrada');
  const hoyLista = abiertas.filter(t => t.fecha <= hoy && (t.estado === 'pendiente' || String(t.hecha_en).slice(0, 10) === hoy || fechaArgentina(t.hecha_en) === hoy)).sort(ordenProfe);
  const proximas = abiertas.filter(t => t.fecha > hoy && t.fecha <= hasta && t.estado === 'pendiente').sort(ordenProfe);
  const mes = hoy.slice(0, 7);
  const delMes = filas.filter(t => (t.estado === 'hecha' && fechaArgentina(t.hecha_en).slice(0, 7) === mes) || (t.estado === 'cerrada' && String(t.cerrada_en).slice(0, 7) === mes));
  return {
    hoy: hoyLista.map(t => vistaTareaProfe(t, hoy)),
    proximas: proximas.map(t => vistaTareaProfe(t, hoy)),
    resumen: {
      pendientes_hoy: hoyLista.filter(t => t.estado === 'pendiente').length,
      hechas_hoy: hoyLista.filter(t => t.estado === 'hecha').length,
      atrasadas: hoyLista.filter(t => t.estado === 'pendiente' && t.fecha < hoy).length,
      nuevos: hoyLista.filter(t => t.estado === 'pendiente' && t.tipo === 'Plan nuevo').length,
      proximas: proximas.length,
      en_agenda: abiertas.filter(t => t.estado === 'pendiente').length,
      hechas_mes: delMes.length,
    },
  };
}

// profe → lo suyo. coordinador → los profes de su sede. admin → la sede que pida (o todas).
function profeTareas(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const hoy = deps.hoy();
  const filas = deps.repo.leer('profe_tareas');
  const coordina = tieneRol(usuario, 'admin') || tieneRol(usuario, 'coordinador');
  const out = { hoy: hoy };
  if (esProfe(usuario)) {
    out.mio = agendaDeProfe(filas.filter(t => t.profe_dni === usuario.dni), hoy);
    out.mio.reeval = reevalDeProfe(usuario, deps, hoy, usuarios);
    out.mio.revisiones = revisionesDeProfe(usuario, deps, hoy);
  }
  if (coordina) {
    const sede = tieneRol(usuario, 'admin') ? texto(req.sede) : usuario.sede;
    if (sede && SEDES.indexOf(sede) < 0) falla('datos_invalidos');
    const deSede = filas.filter(t => !sede || t.sede === sede);
    const nombres = [];
    deSede.forEach(t => { if (nombres.indexOf(t.profe) < 0) nombres.push(t.profe); });
    out.sede = sede || '';
    const rev = revisionesPorProfe(deps, hoy, sede);
    out.equipo = nombres.sort().map(n => {
      const a = agendaDeProfe(deSede.filter(t => t.profe === n), hoy);
      return { profe: n, con_usuario: deSede.some(t => t.profe === n && t.profe_dni), resumen: a.resumen, hoy: a.hoy, revisiones: rev[n] || null };
    });
  }
  if (!out.mio && !out.equipo) falla('prohibido');
  return out;
}

// El profe marca que renovó el plan. También puede desmarcarlo. A la mañana siguiente la PC mira MOVE y la cierra.
function profeMarcar(req, deps) {
  const { usuario } = sesion(req, deps);
  const filas = deps.repo.leer('profe_tareas');
  const t = filas.find(x => x.id === texto(req.id) && x.estado !== 'cerrada');
  if (!t) falla('no_existe');
  if (!(esProfe(usuario) && t.profe_dni === usuario.dni) && !tieneRol(usuario, 'admin')) falla('prohibido');
  if (req.hecha === false) {
    t.estado = 'pendiente'; t.hecha_en = ''; t.hecha_dni = '';
  } else {
    t.estado = 'hecha'; t.hecha_en = new Date(deps.ahora()).toISOString(); t.hecha_dni = usuario.dni;
  }
  t.nota = texto(req.nota).slice(0, 300);
  deps.repo.escribir('profe_tareas', filas);
  return { tarea: vistaTareaProfe(t, deps.hoy()) };
}

// ---------- Reevaluaciones recomendadas (Emanuel, 10/11/2026) ----------
// Es solo una recomendación: una por día hábil, del socio con la evaluación más vieja al más reciente, en un horario
// en que el socio ya suele venir, con menos gente y con su profe. El profe se la pide a recepción con un botón.

const DIAS_REEVAL = 56;              // meta institucional: reevaluar a los 56 días
const RECOMENDADAS_SEMANA = 4;       // una por día, en los próximos 4 días hábiles
const DIAS_PROPUESTA = 5;            // para un socio elegido a mano: el mejor horario de los próximos 5 días hábiles
const MIRAR_PRIMEROS = 10;           // para encontrarle día a la recomendación se mira entre los 10 más atrasados
const TIPO_PEDIDO_REEVAL = 'Coordinar reevaluación · lo pide el profe';   // empieza como la de siempre: la PC la sigue igual
const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function normNombre(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
}

// 0 = lunes, como el mapa de calor
function diaSemanaIso(iso) {
  return (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7;
}

function habilesDespues(hoy, n) {
  const out = [];
  let d = hoy;
  while (out.length < n) {
    d = sumarDiasProfe(d, 1);
    if (diaSemanaIso(d) < 5) out.push(d);
  }
  return out;
}

// '1-14:00:5|3-18:00:2' → { '1': { '14:00': 5 }, '3': { '18:00': 2 } }
function leerHabitos(s) {
  const out = {};
  String(s || '').split('|').filter(Boolean).forEach(p => {
    const m = /^(\d)-(\d\d:\d\d):(\d+)$/.exec(p);
    if (m) (out[m[1]] = out[m[1]] || {})[m[2]] = Number(m[3]);
  });
  return out;
}

// { hora: { cupo, reservas, profes: [nombres normalizados] } } de un día, con las reservas de los próximos días
function franjasDelDia(proximas, sede, fecha) {
  const out = {};
  proximas.forEach(f => {
    if (f.tipo !== 'franja' || f.sede !== sede || f.fecha !== fecha) return;
    const h = out[f.hora] = out[f.hora] || { cupo: 0, reservas: 0, profes: [] };
    h.cupo += Number(f.cupo) || 0;
    h.reservas += Number(f.reservas) || 0;
    if (f.profe) h.profes.push(normNombre(f.profe));
  });
  return out;
}

function libreDe(franja, patron, sede, dia, hora) {
  if (franja.cupo > 0) return Math.max(0, 1 - franja.reservas / franja.cupo);
  const p = patron.find(x => x.sede === sede && x.tipo === 'patron' && String(x.clave) === String(dia) && x.hora === hora);
  return p && p.ocupacion !== '' && p.ocupacion != null ? Math.max(0, 1 - Number(p.ocupacion)) : 0.5;
}

// Propuesta para un socio un día dado. estricta: solo en una hora en que el socio suele venir.
function propuestaDia(c, fecha, ctx, estricta) {
  const dia = diaSemanaIso(fecha);
  const clave = c.sede + '|' + fecha;
  ctx.memo = ctx.memo || {};
  const franjas = ctx.memo[clave] = ctx.memo[clave] || franjasDelDia(ctx.proximas, c.sede, fecha);
  const profe = normNombre(c.profe);
  const conProfe = Object.keys(franjas).filter(h => franjas[h].profes.indexOf(profe) >= 0);
  if (!conProfe.length) return null;
  const hab = leerHabitos(c.habitos)[String(dia)] || {};
  const suyas = conProfe.filter(h => hab[h]);
  const opciones = suyas.length ? suyas : (estricta ? [] : conProfe);
  if (!opciones.length) return null;
  const puntaje = h => libreDe(franjas[h], ctx.patron, c.sede, dia, h) + (hab[h] || 0) / 100;
  const hora = opciones.sort((a, b) => puntaje(b) - puntaje(a) || (a < b ? -1 : 1))[0];
  const f = franjas[hora];
  const ocupacion = f.cupo > 0 ? `${f.reservas} de ${f.cupo} lugares reservados` : 'suele haber poca gente';
  const motivo = suyas.length
    ? `Suele venir los ${NOMBRES_DIA[dia]} a las ${hora} · ese día hay ${ocupacion} · está ${c.profe}`
    : `No tenemos un horario fijo suyo ese día · a las ${hora} hay ${ocupacion} y está ${c.profe}`;
  return { fecha: fecha, hora: hora, motivo: motivo, suya: !!suyas.length };
}

function mejorPropuesta(c, dias, ctx) {
  for (const d of dias) { const p = propuestaDia(c, d, ctx, true); if (p) return p; }
  for (const d of dias) { const p = propuestaDia(c, d, ctx, false); if (p) return p; }
  return null;
}

function reevalYaPedida(tareas, c) {
  return tareas.some(t => t.sede === c.sede && t.estado === 'pendiente' && (t.socio_id === 'eval-' + c.socio_id || t.socio_id === 'reeval-' + c.socio_id));
}

function vistaReeval(c, p, pedida, usuarios) {
  const r = p && usuarios ? recepcionistaPara(usuarios, c.sede, p.hora) : null;
  return {
    socio_id: c.socio_id, socio_nombre: c.socio_nombre, sede: c.sede, ultima_eval: c.ultima_eval, dias: c.dias === '' ? null : Number(c.dias),
    pedida: pedida, propuesta: p, sugerida_dni: r ? r.dni : '',
  };
}

function reevalDeProfe(usuario, deps, hoy, usuarios) {
  const filas = deps.repo.leer('profe_reeval').filter(c => c.profe_dni === usuario.dni);
  if (!filas.length) return null;
  const tareas = deps.repo.leer('tareas');
  const ctx = { proximas: deps.repo.leer('proximas'), patron: deps.repo.leer('ocupacion') };
  const pedida = c => reevalYaPedida(tareas, c);
  const atrasados = filas.filter(c => c.dias !== '' && Number(c.dias) >= DIAS_REEVAL && !pedida(c));
  const usados = {};
  const recomendadas = [];
  const semana = habilesDespues(hoy, RECOMENDADAS_SEMANA);
  semana.forEach((d, n) => {
    const libres = atrasados.filter(c => !usados[c.socio_id]);
    const despues = semana.slice(n + 1);
    // al que ya viene otro día de la semana se lo guarda para ese día, en su horario
    const tieneOtroDia = c => despues.some(x => propuestaDia(c, x, ctx, true));
    let elegido = null, p = null;
    for (const c of libres.slice(0, MIRAR_PRIMEROS)) { p = propuestaDia(c, d, ctx, true); if (p) { elegido = c; break; } }
    if (!elegido) for (const c of libres) { if (tieneOtroDia(c)) continue; p = propuestaDia(c, d, ctx, false); if (p) { elegido = c; break; } }
    if (!elegido) for (const c of libres) { p = propuestaDia(c, d, ctx, false); if (p) { elegido = c; break; } }
    if (!elegido) return;
    usados[elegido.socio_id] = true;
    recomendadas.push(vistaReeval(elegido, p, false, usuarios));
  });
  const dias = habilesDespues(hoy, DIAS_PROPUESTA);
  // a quién de recepción se le puede pedir, por sede (Emanuel cubre socios de dos sedes)
  const recepcion = {};
  filas.forEach(c => { if (!recepcion[c.sede]) recepcion[c.sede] = usuarios.filter(u => u.sede === c.sede && esVerdad(u.activo) && tieneRol(u, 'recepcion')).map(u => ({ dni: u.dni, nombre: u.nombre, turno: u.turno })); });
  return {
    meta_dias: DIAS_REEVAL,
    recomendadas: recomendadas,
    socios: filas.map(c => vistaReeval(c, pedida(c) ? null : mejorPropuesta(c, dias, ctx), pedida(c), usuarios)),
    recepcion: recepcion,
  };
}

function cargarProfeReeval(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas)) falla('datos_invalidos');
  const filas = req.filas.map(x => ({
    id: texto(x && x.id), sede: texto(x && x.sede), profe: texto(x && x.profe), profe_dni: normalizarDni(x && x.profe_dni),
    socio_id: texto(x && x.socio_id), socio_nombre: texto(x && x.socio_nombre), ultima_eval: texto(x && x.ultima_eval),
    dias: texto(x && x.dias), habitos: texto(x && x.habitos), cargada: texto(req.hoy) || deps.hoy(),
  }));
  if (!filas.every(x => x.id && SEDES.indexOf(x.sede) >= 0 && x.profe && x.socio_id)) falla('datos_invalidos');
  deps.repo.escribir('profe_reeval', filas);
  return { filas: filas.length };
}

// Quién de recepción la coordina: quien está en la sede a esa hora; si no, el turno de esa hora.
function recepcionistaPara(usuarios, sede, hora) {
  const equipo = usuarios.filter(u => u.sede === sede && esVerdad(u.activo) && tieneRol(u, 'recepcion'));
  return equipo.find(u => u.hora_inicio && u.hora_fin && u.hora_inicio <= hora && hora < u.hora_fin)
    || equipo.find(u => u.turno === (hora < '14:00' ? 'manana' : 'tarde')) || equipo[0] || null;
}

// El profe le pide a recepción que coordine la reevaluación. Va como "Coordinar reevaluación": recepción la marca
// AGENDADA con la fecha y, si después MOVE no la muestra cargada, le vuelve sola (control_evaluaciones en la PC).
function profePedirReeval(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!esProfe(usuario)) falla('prohibido');
  const hoy = deps.hoy();
  const c = deps.repo.leer('profe_reeval').find(x => x.profe_dni === usuario.dni && x.socio_id === texto(req.socio_id));
  if (!c) falla('no_existe');
  const fecha = texto(req.fecha), hora = texto(req.hora);
  if (!fechaIsoValida(fecha) || fecha < hoy || !/^\d\d:\d\d$/.test(hora)) falla('datos_invalidos');
  const tareas = deps.repo.leer('tareas');
  if (reevalYaPedida(tareas, c)) falla('ya_pedida');
  // el profe elige a quién pedírsela; si no elige, quien está en la sede a esa hora
  const elegida = normalizarDni(req.dni);
  const r = elegida ? usuarios.find(u => u.dni === elegida && u.sede === c.sede && esVerdad(u.activo) && tieneRol(u, 'recepcion')) : recepcionistaPara(usuarios, c.sede, hora);
  if (elegida && !r) falla('datos_invalidos');
  if (!r) falla('sin_recepcion');
  const quien = String(usuario.nombre || c.profe).split(' ')[0];
  const dia = NOMBRES_DIA[diaSemanaIso(fecha)];
  const desde = c.ultima_eval ? `última evaluación el ${c.ultima_eval.slice(8, 10)}/${c.ultima_eval.slice(5, 7)} (hace ${c.dias} días)` : 'no tiene evaluación cargada';
  const fila = {
    id: hoy + '-' + c.sede + '-reeval-' + c.socio_id, fecha: hoy, sede: c.sede, socio_id: 'reeval-' + c.socio_id, socio_nombre: c.socio_nombre,
    profe: c.profe, tipo: TIPO_PEDIDO_REEVAL, prioridad: '1',
    situacion: `${quien} te pidió que coordines una reevaluación con ${c.socio_nombre} · ${desde}`,
    accion: `Mandale un mensaje a ${c.socio_nombre} para coordinarla: proponerle el ${dia} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} a las ${hora} con ${c.profe}. Si no puede, buscar otro horario con ${c.profe}`,
    ultima_anotacion: '', asignado_dni: r.dni, pendiente_desde: hoy, estado: 'pendiente', hecha_en: '',
    intro: 'Marcala recién cuando quede agendada, con la fecha. Después de esa fecha miramos en MOVE que se haya cargado.',
  };
  deps.repo.agregar('tareas', fila);
  return { recepcionista: r.nombre, fecha: fecha, hora: hora };
}

// ---------- Revisión del plan renovado (Emanuel, 10/11/2026) ----------
// La PC compara el plan nuevo con el anterior del mismo socio (pulso_planes_revision.py). Es una recomendación:
// nunca bloquea ni vuelve a asignar la tarea. Si hubo saltos de escalón, se le pregunta al profe si son correctos.

const DIAS_REVISION_PROFE = 14;      // lo que ve el profe: sus planes de las últimas dos semanas
const DIAS_REVISION_EQUIPO = 30;     // lo que resume coordinación
const RESPUESTAS_REVISION = ['correcta', 'corregir'];

function leerJson(s, siNo) {
  try { return JSON.parse(s); } catch (e) { return siNo; }
}

function vistaRevision(r) {
  return {
    id: r.id, fecha: r.fecha, socio_id: r.socio_id, socio_nombre: r.socio_nombre, pct: Number(r.pct) || 0, banda: r.banda,
    saltos: leerJson(r.saltos, []), rpe: leerJson(r.rpe, []), respuesta: r.respuesta, nota: r.nota,
  };
}

function resumenRevisiones(filas) {
  const con = filas.filter(r => leerJson(r.saltos, []).length);
  return {
    revisados: filas.length,
    en_rango: filas.filter(r => r.banda === 'bien').length,
    casi_todo: filas.filter(r => r.banda === 'casi_todo').length,
    poco: filas.filter(r => r.banda === 'poco' || r.banda === 'sin_modificar').length,
    con_saltos: con.length,
    saltos_sin_responder: con.filter(r => !r.respuesta).length,
    corregir: filas.filter(r => r.respuesta === 'corregir').length,
  };
}

function cargarProfeRevision(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas)) falla('datos_invalidos');
  const previas = {};
  deps.repo.leer('profe_revision').forEach(r => { previas[r.id] = r; });
  const filas = req.filas.map(x => {
    const v = previas[texto(x && x.id)] || {};
    return {
      id: texto(x && x.id), fecha: texto(x && x.fecha), sede: texto(x && x.sede), profe: texto(x && x.profe), profe_dni: normalizarDni(x && x.profe_dni),
      socio_id: texto(x && x.socio_id), socio_nombre: texto(x && x.socio_nombre), pct: texto(x && x.pct), banda: texto(x && x.banda),
      saltos: texto(x && x.saltos) || '[]', rpe: texto(x && x.rpe) || '[]',
      respuesta: v.respuesta || '', respondida_en: v.respondida_en || '', nota: v.nota || '',   // lo que contestó el profe no se pisa
    };
  });
  if (!filas.every(x => x.id && fechaIsoValida(x.fecha) && x.socio_id && x.profe)) falla('datos_invalidos');
  deps.repo.escribir('profe_revision', filas);
  return { filas: filas.length };
}

function revisionesDeProfe(usuario, deps, hoy) {
  const desde = sumarDiasProfe(hoy, -DIAS_REVISION_PROFE);
  const filas = deps.repo.leer('profe_revision').filter(r => r.profe_dni === usuario.dni && r.fecha >= desde)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  return { lista: filas.map(vistaRevision), resumen: resumenRevisiones(filas) };
}

function revisionesPorProfe(deps, hoy, sede) {
  const desde = sumarDiasProfe(hoy, -DIAS_REVISION_EQUIPO);
  const por = {};
  deps.repo.leer('profe_revision').filter(r => r.fecha >= desde && (!sede || r.sede === sede)).forEach(r => { (por[r.profe] = por[r.profe] || []).push(r); });
  const out = {};
  Object.keys(por).forEach(p => { out[p] = { resumen: resumenRevisiones(por[p]), lista: por[p].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 20).map(vistaRevision) }; });
  return out;
}

// ¿Te parece que esa progresión es correcta para su nivel? El profe contesta; coordinación lo ve.
function profeResponderRevision(req, deps) {
  const { usuario } = sesion(req, deps);
  const filas = deps.repo.leer('profe_revision');
  const r = filas.find(x => x.id === texto(req.id));
  if (!r) falla('no_existe');
  if (!(esProfe(usuario) && r.profe_dni === usuario.dni)) falla('prohibido');
  if (RESPUESTAS_REVISION.indexOf(texto(req.respuesta)) < 0) falla('datos_invalidos');
  r.respuesta = texto(req.respuesta);
  r.respondida_en = new Date(deps.ahora()).toISOString();
  r.nota = texto(req.nota).slice(0, 300);
  deps.repo.escribir('profe_revision', filas);
  return { revision: vistaRevision(r) };
}

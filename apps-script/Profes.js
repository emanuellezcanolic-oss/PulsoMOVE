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
    const cambioDeProfe = v && v.estado === 'derivada' && v.profe !== n.profe;
    const mismoCiclo = v && v.estado !== 'cerrada' && !cambioDeProfe && String(v.vence || '') === String(n.vence || '');
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

const ORDEN_TIPO_PROFE = { 'Plan nuevo': 0, 'Plan vencido': 1, 'Sin plan': 2, 'Plan sin vencimiento': 3, 'Renovar plan': 4, 'Plan extra': 5 };
function ordenProfe(a, b) {
  return (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) || (ORDEN_TIPO_PROFE[a.tipo] - ORDEN_TIPO_PROFE[b.tipo]) || String(a.vence).localeCompare(String(b.vence));
}

// Lo de un profe: hoy (lo del día y lo atrasado), los próximos días y cuánto lleva hecho.
function agendaDeProfe(filas, hoy) {
  const hasta = sumarDiasProfe(hoy, DIAS_SEMANA_PROFE);
  const abiertas = filas.filter(t => t.estado !== 'cerrada');
  const hoyLista = abiertas.filter(t => t.fecha <= hoy && (t.estado === 'pendiente' || (t.estado === 'hecha' && (String(t.hecha_en).slice(0, 10) === hoy || fechaArgentina(t.hecha_en) === hoy)))).sort(ordenProfe);
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
      en_papel: filas.filter(t => t.estado === 'papel').length,
      derivadas: filas.filter(t => t.estado === 'derivada').length,
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
    out.mio.opciones = opcionesDeProfe(usuario, usuarios);
    out.mio.mes = mesDeProfe(usuario, deps, hoy);
    out.mio.hechas = hechasDeProfe(filas, usuario.dni, hoy);
    const pronto = sumarDiasProfe(hoy, DIAS_AL_RENOVAR);
    const renueva = {};
    filas.forEach(t => { if (t.profe_dni === usuario.dni && t.estado === 'pendiente' && t.fecha <= pronto) renueva[t.socio_id] = true; });
    out.mio.auditoria = auditoriaDeProfe(usuario.dni, deps, hoy, { planesHoy: out.mio.resumen.pendientes_hoy + out.mio.resumen.hechas_hoy, renueva: renueva });
    out.mio.sabados = sabadosDeProfe(usuario, deps, hoy);
    out.mio.tareas_mes = tareasMesDeDni(deps, usuario.dni, mesDe(hoy), hoy);
  }
  if (coordina) {
    const sede = tieneRol(usuario, 'admin') ? texto(req.sede) : usuario.sede;
    if (sede && SEDES.indexOf(sede) < 0) falla('datos_invalidos');
    const deSede = filas.filter(t => !sede || t.sede === sede);
    const nombres = [];
    deSede.forEach(t => { if (nombres.indexOf(t.profe) < 0) nombres.push(t.profe); });
    out.sede = sede || '';
    const rev = revisionesPorProfe(deps, hoy, sede);
    const coord = coordinacionPorProfe(deps, sede);
    const diasMes = deps.repo.leer('profe_dias').filter(d => String(d.fecha).slice(0, 7) === hoy.slice(0, 7));
    out.agenda = agendaEquipo(usuario, usuarios, deps, hoy, sede);
    const tmHoy = tareasDelMes(deps, mesDe(hoy));
    const mesQueViene = mesDe(sumarDiasProfe(mesDe(hoy) + '-01', 32));
    out.tareas_mes = { mes: mesDe(hoy), lista: tmHoy.lista, origen: tmHoy.origen, siguiente: Object.assign({ mes: mesQueViene }, tareasDelMes(deps, mesQueViene)) };
    out.ve_liq = tieneRol(usuario, 'admin');
    // el horario que se muestra es el de la app (lo edita coordinación), no el que calculó la PC a la mañana
    const horarioDe = n => out.agenda.horarios.filter(x => mismoProfe(x.profe, n));
    out.equipo = nombres.sort().map(n => {
      const a = agendaDeProfe(deSede.filter(t => t.profe === n), hoy);
      const dni = (deSede.find(t => t.profe === n && t.profe_dni) || {}).profe_dni;
      const dias = diasMes.filter(d => d.dni === dni);
      const aud = dni ? auditoriaDeProfe(dni, deps, hoy) : null;
      const h = horarioDe(n);
      const co = coord[n] ? Object.assign({}, coord[n], h.length ? { horas_semana: horasSemanaDe(h), horario: textoHorario(h) } : {}) : null;
      return { profe: n, con_usuario: !!dni, resumen: a.resumen, hoy: a.hoy, revisiones: rev[n] || null, coord: co,
        tareas_mes: dni ? (x => ({ hechas: x.hechas, total: x.total, pct: x.pct, puntos: x.puntos, lista: x.lista }))(tareasMesDeDni(deps, dni, mesDe(hoy), hoy)) : null,
        liq: tieneRol(usuario, 'admin') ? liqDeProfe(deps, n, dni) : null,
        auditoria: aud ? { puntaje: aud.puntaje, nivel: aud.nivel, cambio_semana: aud.cambio_semana, secciones: aud.secciones, cuantos: aud.cuantos, repetido: aud.repetido, pendientes: aud.pendientes.slice(0, 40), dejadas: aud.dejadas.slice(0, 40) } : null,
        dias: { completos: dias.length, en_una_hora: dias.filter(d => Number(d.minutos) <= META_HORA_MIN).length } };
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
  return { tarea: vistaTareaProfe(t, deps.hoy()), dia_completo: req.hecha === false ? null : anotarDiaCompleto(usuario, filas, deps) };
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
  // si conocemos el horario del profe, manda el horario; si no, el profe que figura en la clase de MOVE
  const suyo = (ctx.horarios || []).filter(x => normNombre(x.profe) === profe);
  const conProfe = Object.keys(franjas).filter(h => (suyo.length ? enHorario(suyo, c.sede, dia, h) : franjas[h].profes.indexOf(profe) >= 0));
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

function avisadoNoEsMio(tareas, c) {
  return tareas.some(t => t.estado === 'pendiente' && t.socio_id === 'profe-' + c.socio_id);
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
  const ctx = { proximas: deps.repo.leer('proximas'), patron: deps.repo.leer('ocupacion'), horarios: deps.repo.leer('profe_horarios') };
  const pedida = c => reevalYaPedida(tareas, c);
  const noEsMio = c => avisadoNoEsMio(tareas, c);
  const atrasados = filas.filter(c => c.dias !== '' && Number(c.dias) >= DIAS_REEVAL && !pedida(c) && !noEsMio(c));
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
    socios: filas.filter(c => !noEsMio(c)).map(c => vistaReeval(c, pedida(c) ? null : mejorPropuesta(c, dias, ctx), pedida(c), usuarios)),
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
    minutos: r.minutos === '' || r.minutos == null ? null : Number(r.minutos), dias_plan: Number(r.dias_plan) || null,
  };
}

function mediana(xs) {
  if (!xs.length) return null;
  const o = xs.slice().sort((a, b) => a - b);
  return o.length % 2 ? o[(o.length - 1) / 2] : Math.round((o[o.length / 2 - 1] + o[o.length / 2]) / 2);
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
    minutos_mediana: mediana(filas.map(r => Number(r.minutos)).filter(m => m > 0)),
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
      saltos: texto(x && x.saltos) || '[]', rpe: texto(x && x.rpe) || '[]', minutos: texto(x && x.minutos), dias_plan: texto(x && x.dias_plan),
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

// ---------- Otra situación: no es mi entrenado / tiene el plan en papel (Emanuel, 10/11/2026) ----------
// "No es mi entrenado, es de X": el profe elige a quién de recepción de su sede avisarle, y a esa persona le llega
// "Cambiar profesor · lo pide el profe" en el nivel 1. Cuando MOVE muestra el profe nuevo, la renovación pasa sola
// a la lista de ese profe (fusionarProfeTareas). "Tiene el plan en papel": sale de la lista y queda anotado.

const TIPO_CAMBIAR_PROFE = 'Cambiar profesor · lo pide el profe';

function opcionesDeProfe(usuario, usuarios) {
  return {
    profes: usuarios.filter(u => esVerdad(u.activo) && esProfe(u) && u.dni !== usuario.dni).map(u => u.nombre).sort(),
    recepcion: usuarios.filter(u => u.sede === usuario.sede && esVerdad(u.activo) && tieneRol(u, 'recepcion')).map(u => ({ dni: u.dni, nombre: u.nombre })),
  };
}

function profeOtraSituacion(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!esProfe(usuario)) falla('prohibido');
  const filas = deps.repo.leer('profe_tareas');
  const t = filas.find(x => x.id === texto(req.id) && x.estado === 'pendiente' && x.profe_dni === usuario.dni);
  if (!t) falla('no_existe');
  const ts = new Date(deps.ahora()).toISOString();
  const hoy = deps.hoy();
  const que = texto(req.que);
  if (que === 'papel') {
    Object.assign(t, { estado: 'papel', hecha_en: ts, hecha_dni: usuario.dni, nota: 'Tiene el plan en papel' });
    deps.repo.escribir('profe_tareas', filas);
    return { tarea: vistaTareaProfe(t, hoy), dia_completo: anotarDiaCompleto(usuario, filas, deps) };
  }
  if (que !== 'otro_profe') falla('datos_invalidos');
  const r = avisarCambioDeProfe(usuario, usuarios, deps, t, texto(req.profe), req.dni);
  Object.assign(t, { estado: 'derivada', hecha_en: ts, hecha_dni: usuario.dni, nota: `No es su entrenado: ${r.nuevo ? 'es de ' + r.nuevo : 'no sabe de quién es'} (avisado a ${r.nombre})` });
  deps.repo.escribir('profe_tareas', filas);
  return { tarea: vistaTareaProfe(t, hoy), recepcionista: r.nombre, dia_completo: anotarDiaCompleto(usuario, filas, deps) };
}

// "No es mi entrenado": nuevo vacío = no sabe de quién es; recepción se fija con quién entrena. Devuelve {nombre, nuevo}.
function avisarCambioDeProfe(usuario, usuarios, deps, socio, nuevo, dniRecepcion) {
  const op = opcionesDeProfe(usuario, usuarios);
  const r = op.recepcion.find(u => u.dni === normalizarDni(dniRecepcion));
  if ((nuevo && op.profes.indexOf(nuevo) < 0) || !r) falla('datos_invalidos');
  const tareas = deps.repo.leer('tareas');
  if (tareas.some(x => x.socio_id === 'profe-' + socio.socio_id && x.estado === 'pendiente')) falla('ya_avisado');
  const hoy = deps.hoy();
  const quien = String(usuario.nombre).split(' ')[0];
  deps.repo.agregar('tareas', {
    id: hoy + '-' + usuario.sede + '-profe-' + socio.socio_id, fecha: hoy, sede: usuario.sede, socio_id: 'profe-' + socio.socio_id, socio_nombre: socio.socio_nombre,
    profe: nuevo, tipo: TIPO_CAMBIAR_PROFE, prioridad: '1',
    situacion: nuevo ? `${quien} avisa que ${socio.socio_nombre} no es su entrenado: es de ${nuevo}` : `${quien} avisa que ${socio.socio_nombre} no es su entrenado y no sabe de quién es`,
    accion: nuevo ? `Cambiarle el profesor en MOVE a ${nuevo}. Cuando MOVE lo muestre, la renovación del plan le pasa sola a ${nuevo}`
      : 'Fijate en qué horario viene y qué profe está a esa hora (o preguntale al socio) y cambiale el profesor en MOVE',
    ultima_anotacion: '', asignado_dni: r.dni, pendiente_desde: hoy, estado: 'pendiente', hecha_en: '', intro: '',
  });
  return { nombre: r.nombre, nuevo: nuevo };
}

// Desde las reevaluaciones (o cualquier socio de mi lista): no es mi entrenado. Si tenía una renovación mía pendiente, sale de mi lista.
function profeNoEsMio(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!esProfe(usuario)) falla('prohibido');
  const c = deps.repo.leer('profe_reeval').find(x => x.profe_dni === usuario.dni && x.socio_id === texto(req.socio_id));
  if (!c) falla('no_existe');
  const nuevo = texto(req.profe);
  const r = avisarCambioDeProfe(usuario, usuarios, deps, c, nuevo, req.dni);
  const filas = deps.repo.leer('profe_tareas');
  const t = filas.find(x => x.profe_dni === usuario.dni && x.socio_id === c.socio_id && x.estado === 'pendiente');
  if (t) {
    Object.assign(t, { estado: 'derivada', hecha_en: new Date(deps.ahora()).toISOString(), hecha_dni: usuario.dni, nota: `No es su entrenado: ${nuevo ? 'es de ' + nuevo : 'no sabe de quién es'} (avisado a ${r.nombre})` });
    deps.repo.escribir('profe_tareas', filas);
  }
  return { recepcionista: r.nombre, socio_id: c.socio_id };
}

// ---------- Mi mes del profe: días completos, medallas y traer un socio a hoy (Emanuel, 10/11/2026) ----------
// Cuando el profe termina lo del día se anota en profe_dias (con cuánto tardó desde la primera marca): de ahí salen los
// papelitos, la medalla "en una hora" y lo que ve coordinación. Nada de ranking entre compañeros.

const META_HORA_MIN = 60;   // la idea: que en una hora terminen los planes del día

function marcasDelDia(filas, dni, hoy) {
  return filas.filter(t => t.profe_dni === dni && t.hecha_dni === dni && t.hecha_en && fechaArgentina(t.hecha_en) === hoy);
}

// Se llama después de cada marca: si no queda nada pendiente para hoy, el día queda completo (una sola vez)
function anotarDiaCompleto(usuario, filas, deps) {
  const hoy = deps.hoy();
  const pendientes = filas.filter(t => t.profe_dni === usuario.dni && t.estado === 'pendiente' && t.fecha <= hoy);
  const marcas = marcasDelDia(filas, usuario.dni, hoy);
  if (pendientes.length || !marcas.length) return null;
  const dias = deps.repo.leer('profe_dias');
  if (dias.some(d => d.dni === usuario.dni && d.fecha === hoy)) return null;
  const primera = marcas.map(t => t.hecha_en).sort()[0];
  const ahora = new Date(deps.ahora()).toISOString();
  const fila = { dni: usuario.dni, fecha: hoy, primera_ts: primera, completado_ts: ahora, planes: String(marcas.length),
    minutos: String(Math.max(0, Math.round((Date.parse(ahora) - Date.parse(primera)) / 60000))) };
  deps.repo.agregar('profe_dias', fila);
  return fila;
}

function medallasDeProfe(usuario, deps, hoy, revis) {
  const mes = hoy.slice(0, 7);
  const dias = deps.repo.leer('profe_dias').filter(d => d.dni === usuario.dni && String(d.fecha).slice(0, 7) === mes);
  const rev = deps.repo.leer('profe_revision').filter(r => r.profe_dni === usuario.dni && String(r.fecha).slice(0, 7) === mes);
  const nombreProfe = (deps.repo.leer('profe_tareas').find(t => t.profe_dni === usuario.dni) || {}).profe || usuario.nombre;
  const pedidas = deps.repo.leer('tareas').filter(t => t.tipo === TIPO_PEDIDO_REEVAL && t.profe === nombreProfe && String(t.fecha).slice(0, 7) === mes).length;
  const m = (clave, emoji, nombre, para, n, meta) => ({ clave, emoji, nombre, para, n: n, meta: meta, ganada: n >= meta });
  return [
    m('dia', '✅', 'Día completo', 'Terminar todos los planes del día', dias.length, 10),
    m('hora', '⏱️', 'En una hora', `Terminar los planes del día en menos de ${META_HORA_MIN} minutos desde el primero`, dias.filter(d => Number(d.minutos) <= META_HORA_MIN).length, 5),
    m('escalon', '🪜', 'De a un escalón', 'Planes renovados sin saltear escalones', rev.filter(r => leerJson(r.saltos, []).length === 0).length, 5),
    m('justo', '🎯', 'Customización justa', 'Planes renovados cambiando entre el 30 y el 80%', rev.filter(r => r.banda === 'bien').length, 5),
    m('reeval', '🩺', 'Reevaluador', 'Reevaluaciones pedidas a recepción', pedidas, 4),
  ];
}

function mesDeProfe(usuario, deps, hoy) {
  const desde = sumarDiasProfe(hoy, -DIAS_REVISION_EQUIPO);
  const rev = deps.repo.leer('profe_revision').filter(r => r.profe_dni === usuario.dni && r.fecha >= desde);
  const dias = deps.repo.leer('profe_dias').filter(d => d.dni === usuario.dni && String(d.fecha).slice(0, 7) === hoy.slice(0, 7));
  const hoyFila = dias.find(d => d.fecha === hoy) || null;
  return {
    revisiones: resumenRevisiones(rev), medallas: medallasDeProfe(usuario, deps, hoy),
    dias_completos: dias.length, en_una_hora: dias.filter(d => Number(d.minutos) <= META_HORA_MIN).length,
    hoy_completo: hoyFila, meta_minutos: META_HORA_MIN,
    primera_marca_hoy: (marcasDelDia(deps.repo.leer('profe_tareas'), usuario.dni, hoy).map(t => t.hecha_en).sort()[0]) || '',
  };
}

// Traer a hoy un socio de los próximos días: por ejemplo, cuando uno de hoy era de otro profe
function profeAdelantar(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!esProfe(usuario)) falla('prohibido');
  const hoy = deps.hoy();
  const filas = deps.repo.leer('profe_tareas');
  const t = filas.find(x => x.id === texto(req.id) && x.profe_dni === usuario.dni && x.estado === 'pendiente' && x.fecha > hoy);
  if (!t) falla('no_existe');
  t.fecha = hoy;
  deps.repo.escribir('profe_tareas', filas);
  return { tarea: vistaTareaProfe(t, hoy) };
}

// ---------- Lo que ya hice, y deshacer si me equivoqué (Emanuel, 10/11/2026) ----------
const DIAS_HECHAS_PROFE = 14;
const ESTADOS_RESUELTOS = ['hecha', 'papel', 'derivada'];

function hechasDeProfe(filas, dni, hoy) {
  const desde = sumarDiasProfe(hoy, -DIAS_HECHAS_PROFE);
  return filas.filter(t => t.profe_dni === dni && ESTADOS_RESUELTOS.indexOf(t.estado) >= 0 && t.hecha_en && fechaArgentina(t.hecha_en) >= desde)
    .sort((a, b) => (a.hecha_en < b.hecha_en ? 1 : -1)).slice(0, 60).map(t => vistaTareaProfe(t, hoy));
}

// Vuelve a pendiente. Si era "no es mi entrenado", también se cancela el aviso a recepción si todavía no lo hizo.
function profeDeshacer(req, deps) {
  const { usuario } = sesion(req, deps);
  const filas = deps.repo.leer('profe_tareas');
  const t = filas.find(x => x.id === texto(req.id) && ESTADOS_RESUELTOS.indexOf(x.estado) >= 0);
  if (!t) falla('no_existe');
  if (!(esProfe(usuario) && t.profe_dni === usuario.dni) && !tieneRol(usuario, 'admin')) falla('prohibido');
  const hoy = deps.hoy();
  let aviso = '';
  if (t.estado === 'derivada') {
    const tareas = deps.repo.leer('tareas');
    const r = tareas.find(x => x.socio_id === 'profe-' + t.socio_id && x.estado === 'pendiente');
    if (r) {
      r.estado = 'cerrada';
      r.ultima_anotacion = 'Cancelado: el profe se había equivocado';
      deps.repo.escribir('tareas', tareas);
      aviso = 'cancelado';
    } else {
      aviso = 'ya_hecho';    // recepción ya lo había hecho: si cambió el profe en MOVE, hay que pedir que lo vuelva a cambiar
    }
  }
  if (t.tipo === 'Plan extra') {
    deps.repo.escribir('profe_tareas', filas.filter(x => x !== t));   // lo había agregado a mano: se borra
    return { tarea: Object.assign(vistaTareaProfe(t, hoy), { estado: 'borrada' }), aviso_recepcion: '' };
  }
  Object.assign(t, { estado: 'pendiente', hecha_en: '', hecha_dni: '', nota: '' });
  deps.repo.escribir('profe_tareas', filas);
  // el día deja de estar completo si quedó algo pendiente para hoy
  if (t.fecha <= hoy) {
    const dias = deps.repo.leer('profe_dias');
    const quedan = dias.filter(d => !(d.dni === t.profe_dni && d.fecha === hoy));
    if (quedan.length !== dias.length) deps.repo.escribir('profe_dias', quedan);
  }
  return { tarea: vistaTareaProfe(t, hoy), aviso_recepcion: aviso };
}

// ---------- Plan extra: renové el plan de un socio que no estaba en mi lista de hoy (Emanuel, 11/11/2026) ----------
// Si estaba agendado para otro día, se da por hecho ahí; si no, queda anotado como "Plan extra". Cuenta como renovado.
function profePlanExtra(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!esProfe(usuario)) falla('prohibido');
  const c = deps.repo.leer('profe_reeval').find(x => x.profe_dni === usuario.dni && x.socio_id === texto(req.socio_id));
  if (!c) falla('no_existe');
  const hoy = deps.hoy();
  const ts = new Date(deps.ahora()).toISOString();
  const filas = deps.repo.leer('profe_tareas');
  if (filas.some(t => t.socio_id === c.socio_id && t.profe_dni === usuario.dni && t.estado === 'hecha' && fechaArgentina(t.hecha_en) === hoy)) falla('ya_anotado');
  let t = filas.find(x => x.socio_id === c.socio_id && x.profe_dni === usuario.dni && x.estado === 'pendiente');
  if (t) {
    Object.assign(t, { fecha: t.fecha > hoy ? hoy : t.fecha, estado: 'hecha', hecha_en: ts, hecha_dni: usuario.dni, nota: 'Plan extra: lo renovó antes de que le tocara' });
  } else {
    t = { id: 'px-' + c.socio_id + '-' + hoy, fecha: hoy, sede: c.sede, profe: c.profe, profe_dni: usuario.dni, socio_id: c.socio_id, socio_nombre: c.socio_nombre,
      tipo: 'Plan extra', accion: 'Renovó el plan sin que estuviera en la lista', vence: '', alta: '', estado: 'hecha', hecha_en: ts, hecha_dni: usuario.dni,
      nota: 'Plan extra', cargada: hoy, cerrada_en: '' };
    filas.push(t);
  }
  deps.repo.escribir('profe_tareas', filas);
  return { tarea: vistaTareaProfe(t, hoy) };
}

// ---------- Auditoría automática de planes (F2.18, Emanuel 11/11/2026) ----------
// La PC audita todas las noches (pulso_auditoria.py) y sube los hallazgos y el puntaje de cada profe.
// Cada hallazgo es una tarea: se cierra sola cuando la auditoría siguiente ya no lo encuentra (corregido, verificado).
// Si el profe dice "lo corregí" y al otro día sigue, queda como "dijo que corrigió y no lo hizo". Si vuelve, "reapareció".

const SECCIONES_AUDITORIA = ['gestion', 'diagnostico', 'metodologia', 'custom', 'rpe', 'general'];
const NOMBRE_SECCION_AUDITORIA = { gestion: 'Gestión y vigencia', diagnostico: 'Diagnóstico y evolución', metodologia: 'Rigor metodológico',
  custom: 'Customización', rpe: 'RPE según el objetivo', general: 'Generales' };
const DIAS_GUARDAR_AUDITORIA = 30;
// Meta del día (Emanuel, 11/11/2026): el profe tiene una hora por día, en casa, para los planes y estas tareas.
// Primero van los planes del día; con lo que queda de la hora, unas pocas correcciones de la auditoría.
const MIN_HORA_PROFE = 60;
const MIN_POR_PLAN = 12;           // lo que tarda en promedio un plan (mediana real del equipo: 11 a 19 min)
const MIN_POR_CORRECCION = 5;
const META_AUDITORIA_MAX = 4;
const DIAS_AL_RENOVAR = 7;         // lo de un socio que renueva en una semana se corrige con el plan nuevo
const MOTIVO_MAX = 300;
const DIAS_GUARDAR_PUNTAJES = 120;

function fusionarAuditoria(viejas, nuevas, auditados, hoy, ts) {
  const porId = {};
  viejas.forEach(v => { porId[v.id] = v; });
  const vistas = {};
  const filas = [];
  let nuevasN = 0, corregidas = 0, noCorregidas = 0;
  nuevas.forEach(n => {
    const v = porId[n.id];
    vistas[n.id] = true;
    let estado = 'pendiente', reaparecio = '';
    if (v && v.estado !== 'corregido' && v.estado !== 'cerrada') {
      estado = v.estado;
      if (v.estado === 'marcada' && fechaArgentina(v.marcada_en) < hoy) { estado = 'no_corregido'; noCorregidas++; }
    } else {
      nuevasN++;
      if (v) reaparecio = '1';
    }
    filas.push({
      id: n.id, fecha: v && estado !== 'pendiente' ? v.fecha : (v && !reaparecio ? v.fecha : hoy), ultima: hoy, sede: n.sede, profe: n.profe, profe_dni: n.profe_dni,
      socio_id: n.socio_id, socio_nombre: n.socio_nombre, seccion: n.seccion, gravedad: n.gravedad, texto: n.texto, cuantos: n.cuantos,
      estado: estado, marcada_en: estado === 'pendiente' ? '' : (v && v.marcada_en) || '', corregido_en: '', reaparecio: reaparecio || (v && v.reaparecio) || '',
      motivo: estado === 'dejada' ? (v && v.motivo) || '' : '', pospuesta: estado === 'pendiente' && v && !reaparecio ? v.pospuesta || '' : '',
    });
  });
  const desde = sumarDiasProfe(hoy, -DIAS_GUARDAR_AUDITORIA);
  viejas.forEach(v => {
    if (vistas[v.id]) return;
    if (v.estado === 'corregido' || v.estado === 'cerrada') {
      if (String(v.corregido_en).slice(0, 10) >= desde) filas.push(v);
      return;
    }
    const verificado = auditados[v.socio_id];
    if (verificado) corregidas++;
    filas.push(Object.assign({}, v, { estado: verificado ? 'corregido' : 'cerrada', corregido_en: ts }));
  });
  return { filas: filas, nuevas: nuevasN, corregidas: corregidas, no_corregidas: noCorregidas };
}

function cargarProfeAuditoria(req, deps) {
  exigirClave(req, deps);
  const hoy = texto(req.hoy) || deps.hoy();
  if (!fechaIsoValida(hoy) || !Array.isArray(req.hallazgos) || !Array.isArray(req.puntajes) || !Array.isArray(req.auditados)) falla('datos_invalidos');
  const lista = req.hallazgos.map(x => ({
    id: texto(x && x.id), sede: texto(x && x.sede), profe: texto(x && x.profe), profe_dni: normalizarDni(x && x.profe_dni), socio_id: texto(x && x.socio_id),
    socio_nombre: texto(x && x.socio_nombre), seccion: texto(x && x.seccion), gravedad: texto(x && x.gravedad) === 'r' ? 'r' : 'a',
    texto: texto(x && x.texto).slice(0, 1500), cuantos: texto(x && x.cuantos),
  }));
  if (!lista.every(x => x.id && x.socio_id && x.profe && SECCIONES_AUDITORIA.indexOf(x.seccion) >= 0)) falla('datos_invalidos');
  const auditados = {};
  req.auditados.forEach(i => { auditados[texto(i)] = true; });
  const r = fusionarAuditoria(deps.repo.leer('profe_auditoria'), lista, auditados, hoy, new Date(deps.ahora()).toISOString());
  deps.repo.escribir('profe_auditoria', r.filas);
  // el puntaje del día de cada profe: se guarda la historia para ver la evolución
  const desde = sumarDiasProfe(hoy, -DIAS_GUARDAR_PUNTAJES);
  const puntajes = deps.repo.leer('profe_puntajes').filter(p => p.fecha >= desde && p.fecha !== hoy);
  req.puntajes.forEach(p => puntajes.push({
    fecha: hoy, profe: texto(p.profe), profe_dni: normalizarDni(p.profe_dni), socios: texto(p.socios), puntaje: texto(p.puntaje),
    gestion: texto(p.gestion), diagnostico: texto(p.diagnostico), metodologia: texto(p.metodologia), custom: texto(p.custom), rpe: texto(p.rpe),
  }));
  deps.repo.escribir('profe_puntajes', puntajes);
  return { nuevas: r.nuevas, corregidas: r.corregidas, no_corregidas: r.no_corregidas, abiertas: lista.length };
}

function nivelAuditoria(p) {
  const n = Number(p);
  return n >= 80 ? 'optimo' : n >= 60 ? 'mejorar' : 'critico';
}

function vistaHallazgo(h, alRenovar) {
  return { id: h.id, socio_id: h.socio_id, socio_nombre: h.socio_nombre, seccion: h.seccion, gravedad: h.gravedad, detalle: String(h.texto).split(' | '),
    estado: h.estado, desde: h.fecha, reaparecio: h.reaparecio === '1', motivo: h.motivo || '', pospuesta: h.pospuesta || '', al_renovar: !!alRenovar };
}

// Orden para corregir: lo que dijo que corrigió y sigue igual, lo grave, lo más viejo
function ordenHallazgo(a, b) {
  const k = h => [h.estado === 'no_corregido' ? 0 : 1, h.gravedad === 'r' ? 0 : 1, String(h.fecha), String(h.id)];
  const x = k(a), y = k(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

// Cuántas correcciones entran hoy en la hora, después de los planes del día
function metaAuditoria(planesHoy) {
  const minPlanes = planesHoy * MIN_POR_PLAN;
  const quedan = Math.max(0, MIN_HORA_PROFE - minPlanes);
  return { meta: Math.max(1, Math.min(META_AUDITORIA_MAX, Math.floor(quedan / MIN_POR_CORRECCION))), min_planes: minPlanes, min_quedan: quedan };
}

// Lo más repetido: el comienzo de cada hallazgo, sin fechas ni nombres de ejercicio
function loQueMasSeRepite(filas, n) {
  const c = {};
  filas.forEach(h => String(h.texto).split(' | ').forEach(t => {
    const k = t.replace(/^D[ií]a [A-Z0-9]+[^:]*: /, '').split(/[:(]/)[0].replace(/\d+/g, '').trim();
    if (k) c[k] = (c[k] || 0) + 1;
  }));
  return Object.keys(c).map(k => ({ que: k, veces: c[k] })).sort((a, b) => b.veces - a.veces).slice(0, n || 6);
}

function auditoriaDeProfe(dni, deps, hoy, agenda) {
  const abiertas = deps.repo.leer('profe_auditoria').filter(h => h.profe_dni === dni);
  const pts = deps.repo.leer('profe_puntajes').filter(p => p.profe_dni === dni).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (!abiertas.length && !pts.length) return null;
  const ult = pts[pts.length - 1] || null;
  const hace7 = pts.filter(p => p.fecha <= sumarDiasProfe(hoy, -7)).pop() || null;
  const pend = abiertas.filter(h => h.estado === 'pendiente' || h.estado === 'no_corregido' || h.estado === 'marcada');
  const semana = sumarDiasProfe(hoy, -7);
  const renueva = (agenda && agenda.renueva) || {};
  const hechoHoy = h => (h.estado === 'marcada' || h.estado === 'dejada') && fechaArgentina(h.marcada_en) === hoy;
  const libres = pend.filter(h => h.estado !== 'marcada' && !(h.pospuesta && h.pospuesta > hoy) && !renueva[h.socio_id]).sort(ordenHallazgo);
  const m = metaAuditoria(agenda ? agenda.planesHoy : 0);
  const hechasHoy = abiertas.filter(hechoHoy);
  const dia = agenda ? Object.assign(m, {
    hechas: hechasHoy.length, planes_hoy: agenda.planesHoy,
    lista: hechasHoy.map(h => vistaHallazgo(h)).concat(libres.slice(0, Math.max(0, m.meta - hechasHoy.length)).map(h => vistaHallazgo(h))),
    al_renovar: pend.filter(h => renueva[h.socio_id]).length, pospuestas: pend.filter(h => h.pospuesta && h.pospuesta > hoy).length,
  }) : null;
  const dejadas = abiertas.filter(h => h.estado === 'dejada');
  return {
    dia: dia,
    dejadas: dejadas.sort((a, b) => (String(a.marcada_en) < String(b.marcada_en) ? 1 : -1)).slice(0, 60).map(h => vistaHallazgo(h)),
    puntaje: ult ? Number(ult.puntaje) : null, nivel: ult ? nivelAuditoria(ult.puntaje) : '', fecha: ult ? ult.fecha : '',
    cambio_semana: ult && hace7 ? Number(ult.puntaje) - Number(hace7.puntaje) : null,
    secciones: ult ? ['gestion', 'diagnostico', 'metodologia', 'custom', 'rpe'].map(s => ({ seccion: s, nombre: NOMBRE_SECCION_AUDITORIA[s], puntaje: Number(ult[s]) })) : [],
    historia: pts.slice(-8).map(p => ({ fecha: p.fecha, puntaje: Number(p.puntaje) })),
    pendientes: pend.sort((a, b) => (a.gravedad === b.gravedad ? String(a.socio_nombre).localeCompare(String(b.socio_nombre)) : a.gravedad === 'r' ? -1 : 1)).slice(0, 150).map(h => vistaHallazgo(h, renueva[h.socio_id])),
    cuantos: { pendientes: pend.length, no_corregidos: pend.filter(h => h.estado === 'no_corregido').length, dejadas: dejadas.length,
      corregidos_semana: abiertas.filter(h => h.estado === 'corregido' && String(h.corregido_en).slice(0, 10) >= semana).length },
    repetido: loQueMasSeRepite(pend, 5),
  };
}

// "Lo corregí": a la mañana siguiente la PC lo mira en MOVE. hecha: false lo desmarca.
function profeAuditoriaMarcar(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!esProfe(usuario)) falla('prohibido');
  const filas = deps.repo.leer('profe_auditoria');
  const h = filas.find(x => x.id === texto(req.id) && x.profe_dni === usuario.dni && x.estado !== 'corregido' && x.estado !== 'cerrada');
  if (!h) falla('no_existe');
  // que: 'corregi' (o hecha: true), 'deshacer' (o hecha: false), 'dejar' (prefiero dejarlo así, con motivo), 'otro_dia'
  const que = texto(req.que) || (req.hecha === false ? 'deshacer' : 'corregi');
  const ts = new Date(deps.ahora()).toISOString();
  if (que === 'deshacer') { h.estado = 'pendiente'; h.marcada_en = ''; h.motivo = ''; h.pospuesta = ''; }
  else if (que === 'corregi') { h.estado = 'marcada'; h.marcada_en = ts; h.motivo = ''; h.pospuesta = ''; }
  else if (que === 'dejar') {
    const motivo = texto(req.motivo).slice(0, MOTIVO_MAX);
    if (!motivo) falla('datos_invalidos');
    h.estado = 'dejada'; h.marcada_en = ts; h.motivo = motivo; h.pospuesta = '';
  } else if (que === 'otro_dia') { h.estado = h.estado === 'no_corregido' ? 'no_corregido' : 'pendiente'; h.pospuesta = habilesDespues(deps.hoy(), 1)[0]; }
  else falla('datos_invalidos');
  deps.repo.escribir('profe_auditoria', filas);
  return { hallazgo: vistaHallazgo(h) };
}

// Para la PC: los socios con algo marcado como corregido, así se los vuelve a mirar en MOVE a la mañana
function profeAuditoriaMarcadas(req, deps) {
  exigirClave(req, deps);
  const ids = {};
  const dejadas = [];
  deps.repo.leer('profe_auditoria').forEach(h => { if (h.estado === 'marcada') ids[h.socio_id] = true; if (h.estado === 'dejada') dejadas.push(h.id); });
  // dejadas: lo que el profe prefirió dejar así; la PC no se lo cuenta en el puntaje
  return { socios: Object.keys(ids), dejadas: dejadas };
}

// ---------- Tablero de coordinación (Emanuel, 11/11/2026) ----------
// La PC sube, por profe, los planes vencidos con cuántas veces vino el socio desde que se le venció, cuántos planes
// renovó en 30 días, cómo los customizó (criterio 30-80%) y cuánto tiempo pasa armándolos. Se guarda solo la última.
function cargarProfeCoordinacion(req, deps) {
  exigirClave(req, deps);
  const hoy = texto(req.hoy) || deps.hoy();
  if (!fechaIsoValida(hoy) || !Array.isArray(req.filas)) falla('datos_invalidos');
  const filas = req.filas.map(x => ({ fecha: hoy, profe: texto(x && x.profe), profe_dni: normalizarDni(x && x.profe_dni), sede: texto(x && x.sede),
    datos: typeof (x && x.datos) === 'string' ? x.datos : JSON.stringify((x && x.datos) || {}) }));
  if (!filas.every(x => x.profe && SEDES.indexOf(x.sede) >= 0 && x.datos.length < 48000 && leerJson(x.datos, null))) falla('datos_invalidos');
  deps.repo.escribir('profe_coord', filas);
  return { filas: filas.length };
}

function coordinacionPorProfe(deps, sede) {
  const out = {};
  deps.repo.leer('profe_coord').filter(r => !sede || r.sede === sede).forEach(r => { out[r.profe] = Object.assign({ fecha: String(r.fecha).slice(0, 10) }, leerJson(r.datos, {})); });
  return out;
}

// ---------- Horarios de los profes (Emanuel y Lucía, 11/11/2026) ----------
function diasDeHorario(s) {
  const t = String(s || '').trim();
  const m = t.match(/^(\d)\s*-\s*(\d)$/);
  if (m) { const out = []; for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i); return out; }
  return t.split(',').map(x => x.trim()).filter(x => /^\d$/.test(x)).map(Number);
}

function enHorario(filas, sede, dia, hora) {
  return filas.some(x => x.sede === sede && diasDeHorario(x.dias).indexOf(dia) >= 0 && String(x.desde) <= hora && hora < String(x.hasta));
}

const esHora = h => /^\d\d:\d\d$/.test(h) && Number(h.slice(0, 2)) < 24 && Number(h.slice(3)) < 60;
function filaHorario(x) {
  return { profe: texto(x && x.profe).slice(0, 80), sede: texto(x && x.sede), dias: texto(x && x.dias), desde: texto(x && x.desde), hasta: texto(x && x.hasta) };
}
const horarioValido = x => x.profe && SEDES.indexOf(x.sede) >= 0 && diasDeHorario(x.dias).length && esHora(x.desde) && esHora(x.hasta) && x.desde < x.hasta;

// La PC los subió la primera vez (lo que pasó Lucía). Desde que coordinación los edita en la app (11/11/2026),
// la app manda: la PC solo los carga si la hoja está vacía, salvo que pida forzar.
function cargarProfeHorarios(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas)) falla('datos_invalidos');
  const filas = req.filas.map(filaHorario);
  if (!filas.every(horarioValido)) falla('datos_invalidos');
  if (!req.forzar && deps.repo.leer('profe_horarios').length) return { filas: 0, ya_cargados: true };
  deps.repo.escribir('profe_horarios', filas);
  return { filas: filas.length };
}

// ---------- Panel de horarios y sábados para coordinación (Emanuel, 11/11/2026) ----------
// Los sábados se turnan: en cada sede le toca a uno por semana (antes estaba en la pestaña "sabados y feriados" de cada planilla).
// Coordinación carga quién va cada sábado y los horarios de la semana; al profe le aparece un aviso grande la semana que le toca.
const SABADOS_ADELANTE = 120;       // lo que se muestra y se puede cargar hacia adelante
const SABADOS_ATRAS = 35;
const DIAS_AVISO_SABADO = 6;        // desde el lunes de esa semana

function esSabado(f) { return fechaIsoValida(f) && new Date(f + 'T12:00:00Z').getUTCDay() === 6; }

function mismoProfe(a, b) {
  const x = normNombre(a).split(' '), y = normNombre(b).split(' ');
  if (!x[0] || !y[0]) return false;
  // iguales, o todas las palabras del nombre más corto están en el otro ("Emanuel" y "Emanuel Lezcano")
  const [c, l] = x.length <= y.length ? [x, y] : [y, x];
  return c.every(t => l.indexOf(t) >= 0);
}

// Quién puede editar: admin cualquier sede; coordinador la suya
function sedeEditable(usuario, sede) {
  if (SEDES.indexOf(sede) < 0) falla('datos_invalidos');
  if (tieneRol(usuario, 'admin')) return;
  if (tieneRol(usuario, 'coordinador') && usuario.sede === sede) return;
  falla('prohibido');
}

function profesDelEquipo(usuarios) {
  return usuarios.filter(u => esVerdad(u.activo) && esProfe(u)).map(u => ({ nombre: u.nombre, dni: u.dni, sede: u.sede }))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
}

function horasSemanaDe(filas) {
  const min = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  return Math.round(filas.reduce((s, x) => s + diasDeHorario(x.dias).length * (min(x.hasta) - min(x.desde)), 0) / 6) / 10;
}
const NOMBRE_DIA_CORTO = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const NOMBRE_SEDE_PROFE = { bariloche: 'Bariloche', bolson: 'El Bolsón', puelo: 'Lago Puelo' };
function textoHorario(filas) {
  return filas.map(x => {
    const d = diasDeHorario(x.dias);
    const seguidos = d.length > 2 && d.every((v, i) => !i || v === d[i - 1] + 1);
    return `${NOMBRE_SEDE_PROFE[x.sede] || x.sede}: ${seguidos ? NOMBRE_DIA_CORTO[d[0]] + ' a ' + NOMBRE_DIA_CORTO[d[d.length - 1]] : d.map(i => NOMBRE_DIA_CORTO[i]).join(', ')} ${x.desde} a ${x.hasta}`;
  }).join(' · ');
}

function sabadosVista(filas, desde, hasta, sede) {
  return filas.filter(s => s.fecha >= desde && s.fecha <= hasta && (!sede || s.sede === sede))
    .map(s => ({ fecha: s.fecha, sede: s.sede, profe: s.profe, profe_dni: s.profe_dni, nota: s.nota }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.sede).localeCompare(String(b.sede))));
}

// Para coordinación: horarios, sábados y la lista de profes con usuario
function agendaEquipo(usuario, usuarios, deps, hoy, sede) {
  const editables = tieneRol(usuario, 'admin') ? SEDES.slice() : (tieneRol(usuario, 'coordinador') && usuario.sede ? [usuario.sede] : []);
  return {
    horarios: deps.repo.leer('profe_horarios').map(filaHorario),
    sabados: sabadosVista(deps.repo.leer('profe_sabados'), sumarDiasProfe(hoy, -SABADOS_ATRAS), sumarDiasProfe(hoy, SABADOS_ADELANTE), ''),
    profes: profesDelEquipo(usuarios), editables: editables, sede: sede || '',
    feriados: feriadosVista(deps, sumarDiasProfe(hoy, -SABADOS_ATRAS), sumarDiasProfe(hoy, SABADOS_ADELANTE)),
    rotaciones: SEDES.reduce((o, k) => { o[k] = rotacionActual(deps, k); return o; }, {}),
    rotacion_elegida: SEDES.reduce((o, k) => { o[k] = !!rotacionElegida(deps, k); return o; }, {}),
    por_mes: sabadosPorMes(deps.repo.leer('profe_sabados')),
    pregunta_feriado: feriadosVista(deps, hoy, sumarDiasProfe(hoy, DIAS_PREGUNTA_FERIADO)).filter(f => !f.se_trabaja),
  };
}

// Para el profe: el sábado de esta semana si le toca, y sus próximos sábados
function sabadosDeProfe(usuario, deps, hoy) {
  const mios = sabadosVista(deps.repo.leer('profe_sabados'), hoy, sumarDiasProfe(hoy, SABADOS_ADELANTE), '')
    .filter(s => (s.profe_dni && s.profe_dni === usuario.dni) || (!s.profe_dni && mismoProfe(s.profe, usuario.nombre)));
  const esta = mios.find(s => s.fecha <= sumarDiasProfe(hoy, DIAS_AVISO_SABADO)) || null;
  const mes = hoy.slice(0, 7);
  const delMes = deps.repo.leer('profe_sabados').filter(s => String(s.fecha).slice(0, 7) === mes && s.profe &&
    ((s.profe_dni && s.profe_dni === usuario.dni) || (!s.profe_dni && mismoProfe(s.profe, usuario.nombre)))).length;
  return { esta_semana: esta, proximos: mios.slice(0, 6), en_el_mes: delMes };
}

// Guarda los horarios de un profe (reemplaza los suyos en esa sede)
function profeHorariosGuardar(req, deps) {
  const { usuario } = sesion(req, deps);
  const profe = texto(req.profe).slice(0, 80), sede = texto(req.sede);
  if (!profe) falla('datos_invalidos');
  sedeEditable(usuario, sede);
  if (!Array.isArray(req.filas) || req.filas.length > 14) falla('datos_invalidos');
  const nuevas = req.filas.map(x => filaHorario(Object.assign({}, x, { profe: profe, sede: sede })));
  if (!nuevas.every(horarioValido)) falla('datos_invalidos');
  const quedan = deps.repo.leer('profe_horarios').map(filaHorario).filter(x => !(mismoProfe(x.profe, profe) && x.sede === sede));
  deps.repo.escribir('profe_horarios', quedan.concat(nuevas));
  const suyos = quedan.concat(nuevas).filter(x => mismoProfe(x.profe, profe));
  return { profe: profe, filas: nuevas.length, horas_semana: horasSemanaDe(suyos), horario: textoHorario(suyos) };
}

// Guarda uno o varios sábados: [{fecha, sede, profe, profe_dni, nota}] (profe vacío lo borra)
function profeSabadosGuardar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!Array.isArray(req.sabados) || !req.sabados.length || req.sabados.length > 60) falla('datos_invalidos');
  const hoy = deps.hoy();
  const profes = profesDelEquipo(usuarios);
  const lista = req.sabados.map(x => {
    const s = { fecha: texto(x && x.fecha), sede: texto(x && x.sede), profe: texto(x && x.profe).slice(0, 80), profe_dni: normalizarDni(x && x.profe_dni), nota: texto(x && x.nota).slice(0, 200) };
    if (!esSabado(s.fecha) || s.fecha < sumarDiasProfe(hoy, -SABADOS_ATRAS) || s.fecha > sumarDiasProfe(hoy, 400)) falla('datos_invalidos');
    sedeEditable(usuario, s.sede);
    const u = s.profe_dni ? profes.find(p => p.dni === s.profe_dni) : profes.find(p => s.profe && mismoProfe(p.nombre, s.profe));
    if (u) { s.profe = s.profe || u.nombre; s.profe_dni = u.dni; }
    return s;
  });
  const ts = new Date(deps.ahora()).toISOString();
  const clave = s => s.fecha + '|' + s.sede;
  const nuevas = {};
  lista.forEach(s => { nuevas[clave(s)] = s; });
  const filas = deps.repo.leer('profe_sabados').filter(s => !nuevas[clave(s)] && s.fecha >= sumarDiasProfe(hoy, -400));
  lista.forEach(s => { if (s.profe || s.nota) filas.push(Object.assign(s, { por_dni: usuario.dni, en: ts })); });
  deps.repo.escribir('profe_sabados', filas);
  return { guardados: lista.length };
}

// ---------- Rotación automática de los sábados y feriados (Emanuel, 11/11/2026) ----------
// En cada sede rotan los profes de turno (mañana, tarde, noche; en Puelo son dos): los que están en la sede de lunes a viernes.
// Cada sábado vacío se le asigna a quien hace más tiempo que no va (a igual, por turno). Si el sábado es feriado,
// coordinación contesta si se trabaja; si no, queda cerrado y se puede reordenar: cada uno pasa al sábado siguiente.
const FERIADOS_SABADO = [   // nacionales que caen sábado; coordinación puede sumar los locales desde el panel
  { fecha: '2026-06-20', nombre: 'Paso a la Inmortalidad del Gral. Manuel Belgrano' },
  { fecha: '2027-05-01', nombre: 'Día del Trabajador' },
  { fecha: '2027-11-20', nombre: 'Día de la Soberanía Nacional (puede trasladarse)' },
  { fecha: '2027-12-25', nombre: 'Navidad' },
];
const DIAS_PREGUNTA_FERIADO = 45;   // desde cuándo se le pregunta a coordinación

// Quiénes trabajan los sábados: los que coordinación tildó en el panel; si nunca tildó, los que están en la sede de lunes a viernes.
// Siempre en orden de turno (mañana, tarde, noche) según el horario.
function rotacionDeSede(horarios, sede, elegidos) {
  if (elegidos) {
    const inicio = n => horarios.filter(h => h.sede === sede && mismoProfe(h.profe, n)).map(h => h.desde).sort()[0] || '99:99';
    return elegidos.slice().sort((a, b) => (inicio(a) < inicio(b) ? -1 : inicio(a) > inicio(b) ? 1 : elegidos.indexOf(a) - elegidos.indexOf(b)));
  }
  const porProfe = {};
  horarios.filter(h => h.sede === sede).forEach(h => {
    const k = normNombre(h.profe);
    const p = porProfe[k] = porProfe[k] || { profe: h.profe, dias: {}, desde: h.desde };
    diasDeHorario(h.dias).forEach(d => { p.dias[d] = true; });
    if (h.desde < p.desde) p.desde = h.desde;
  });
  return Object.keys(porProfe).map(k => porProfe[k]).filter(p => [0, 1, 2, 3, 4].every(d => p.dias[d]))
    .sort((a, b) => (a.desde < b.desde ? -1 : 1)).map(p => p.profe);
}

function rotacionElegida(deps, sede) {
  const f = deps.repo.leer('profe_rotacion').find(r => r.sede === sede);
  return f ? String(f.profes || '').split('|').map(x => x.trim()).filter(Boolean) : null;
}
function rotacionActual(deps, sede) {
  return rotacionDeSede(deps.repo.leer('profe_horarios').map(filaHorario), sede, rotacionElegida(deps, sede));
}

// Coordinación tilda quiénes trabajan los sábados en su sede
function profeRotacionGuardar(req, deps) {
  const { usuario } = sesion(req, deps);
  const sede = texto(req.sede);
  sedeEditable(usuario, sede);
  if (!Array.isArray(req.profes) || req.profes.length > 12) falla('datos_invalidos');
  const profes = [];
  req.profes.map(x => texto(x).slice(0, 80)).filter(Boolean).forEach(n => { if (!profes.some(p => mismoProfe(p, n))) profes.push(n); });
  const filas = deps.repo.leer('profe_rotacion').filter(r => r.sede !== sede);
  filas.push({ sede, profes: profes.join('|'), por_dni: usuario.dni, en: new Date(deps.ahora()).toISOString() });
  deps.repo.escribir('profe_rotacion', filas);
  // lo que armó la rotación desde la semana que viene se vuelve a armar con los nuevos (lo cargado a mano no se toca)
  const hoy = deps.hoy();
  const desde = sumarDiasProfe(hoy, 7);
  const sab = deps.repo.leer('profe_sabados');
  const quedan = sab.filter(x => !(x.sede === sede && x.fecha >= desde && x.por_dni === 'rotacion'));
  if (quedan.length !== sab.length) deps.repo.escribir('profe_sabados', quedan);
  const r = profeSabadosGenerar({ token: req.token, sede: sede }, deps);
  return { sede, rotacion: rotacionActual(deps, sede), rearmados: r.nuevos[sede] || 0 };
}

function feriadosVista(deps, desde, hasta) {
  const cargados = deps.repo.leer('profe_feriados');
  const out = {};
  FERIADOS_SABADO.forEach(f => { out[f.fecha] = { fecha: f.fecha, nombre: f.nombre, se_trabaja: '' }; });
  cargados.forEach(f => { if (f.borrado === '1') delete out[f.fecha]; else out[f.fecha] = { fecha: f.fecha, nombre: f.nombre || (out[f.fecha] || {}).nombre || 'Feriado', se_trabaja: f.se_trabaja || '' }; });
  return Object.keys(out).filter(f => f >= desde && f <= hasta).sort().map(f => out[f]);
}

// Completa los sábados vacíos de la sede hasta "hasta" (no toca lo que ya está cargado)
function generarSabados(filas, rot, feriados, sede, hoy, hasta) {
  if (rot.length < 2) return [];
  const cerrado = {};
  feriados.forEach(f => { if (f.se_trabaja === 'no') cerrado[f.fecha] = true; });
  const deSede = filas.filter(s => s.sede === sede);
  const ultimo = {};
  rot.forEach(p => { ultimo[p] = ''; });
  deSede.filter(s => s.profe).forEach(s => rot.forEach(p => { if (mismoProfe(p, s.profe) && s.fecha > ultimo[p]) ultimo[p] = s.fecha; }));
  const ocupado = {};
  deSede.forEach(s => { ocupado[s.fecha] = true; });
  const nuevas = [];
  let f = sumarDiasProfe(hoy, (6 - new Date(hoy + 'T12:00:00Z').getUTCDay() + 7) % 7);
  for (; f <= hasta; f = sumarDiasProfe(f, 7)) {
    if (ocupado[f] || cerrado[f]) continue;
    // quien hace más que no va; a igual, el orden de turno. Lo cargado más adelante también cuenta.
    const p = rot.slice().sort((a, b) => (ultimo[a] < ultimo[b] ? -1 : ultimo[a] > ultimo[b] ? 1 : rot.indexOf(a) - rot.indexOf(b)))[0];
    if (ultimo[p] > f) continue;   // ya tiene uno más adelante: dejamos el hueco para que lo vea coordinación
    nuevas.push({ fecha: f, sede: sede, profe: p, profe_dni: '', nota: '', por_dni: 'rotacion', en: '' });
    ultimo[p] = f;
  }
  return nuevas;
}

// La PC lo llama todos los días (con la clave) y coordinación desde el panel: deja cargados los próximos 4 meses
function profeSabadosGenerar(req, deps) {
  let usuario = null, usuarios = deps.repo.leer('usuarios');
  if (req.clave) exigirClave(req, deps); else ({ usuario, usuarios } = sesion(req, deps));
  const hoy = deps.hoy();
  const sedes = texto(req.sede) ? [texto(req.sede)] : SEDES.slice();
  sedes.forEach(s => { if (usuario) sedeEditable(usuario, s); else if (SEDES.indexOf(s) < 0) falla('datos_invalidos'); });
  const hasta = sumarDiasProfe(hoy, SABADOS_ADELANTE);
  const feriados = feriadosVista(deps, hoy, hasta);
  const filas = deps.repo.leer('profe_sabados');
  const profes = profesDelEquipo(usuarios);
  const out = {};
  let todas = [];
  sedes.forEach(s => {
    const n = generarSabados(filas, rotacionActual(deps, s), feriados, s, hoy, hasta);
    n.forEach(x => { const u = profes.find(p => mismoProfe(p.nombre, x.profe)); if (u) x.profe_dni = u.dni; });
    out[s] = n.length;
    todas = todas.concat(n);
  });
  if (todas.length) deps.repo.escribir('profe_sabados', filas.concat(todas));
  return { nuevos: out };
}

// Coordinación: marcar un sábado como feriado, contestar si se trabaja y (si no) reordenar
function profeFeriado(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!tieneRol(usuario, 'admin') && !tieneRol(usuario, 'coordinador')) falla('prohibido');
  const fecha = texto(req.fecha);
  if (!esSabado(fecha)) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  const lista = deps.repo.leer('profe_feriados').filter(f => f.fecha !== fecha);
  const previo = feriadosVista(deps, fecha, fecha)[0] || null;
  if (req.borrar) {
    lista.push({ fecha, nombre: '', se_trabaja: '', borrado: '1', por_dni: usuario.dni, en: ts });
    deps.repo.escribir('profe_feriados', lista);
    return { fecha, borrado: true };
  }
  const se = texto(req.se_trabaja);
  if (['si', 'no', ''].indexOf(se) < 0) falla('datos_invalidos');
  const nombre = texto(req.nombre).slice(0, 120) || (previo && previo.nombre) || 'Feriado';
  lista.push({ fecha, nombre, se_trabaja: se, borrado: '', por_dni: usuario.dni, en: ts });
  deps.repo.escribir('profe_feriados', lista);
  let movidos = 0;
  if (se === 'no') {
    const hoy = deps.hoy();
    const sedes = tieneRol(usuario, 'admin') ? SEDES.slice() : [usuario.sede];
    let filas = deps.repo.leer('profe_sabados');
    sedes.forEach(sede => {
      const futuros = filas.filter(s => s.sede === sede && s.fecha >= fecha && s.fecha >= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      const delDia = futuros.find(s => s.fecha === fecha);
      if (!delDia) return;
      if (req.reordenar && delDia.profe) {
        // cada uno pasa al sábado siguiente: el del feriado va el que viene, y así (el último queda para la rotación)
        const sigue = futuros.filter(s => s.fecha > fecha);
        let lleva = { profe: delDia.profe, profe_dni: delDia.profe_dni };
        sigue.forEach(s => { const t = { profe: s.profe, profe_dni: s.profe_dni }; Object.assign(s, lleva, { por_dni: usuario.dni, en: ts }); lleva = t; movidos++; });
      }
      Object.assign(delDia, { profe: '', profe_dni: '', nota: 'Feriado: no se trabaja', por_dni: usuario.dni, en: ts });
    });
    deps.repo.escribir('profe_sabados', filas);
  }
  return { fecha, se_trabaja: se, movidos };
}

// Cuántos sábados va cada uno por mes (para las horas; lo cerrado por feriado no cuenta)
function sabadosPorMes(filas) {
  const out = {};
  filas.filter(s => s.profe).forEach(s => {
    const k = s.profe_dni || normNombre(s.profe);
    const o = out[k] = out[k] || { profe: s.profe, profe_dni: s.profe_dni, meses: {} };
    const m = String(s.fecha).slice(0, 7);
    o.meses[m] = (o.meses[m] || 0) + 1;
  });
  return Object.keys(out).map(k => out[k]);
}

// Primera carga desde las planillas (PC). No pisa lo que coordinación ya cargó en la app.
function cargarProfeSabados(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.sabados)) falla('datos_invalidos');
  const lista = req.sabados.map(x => ({ fecha: texto(x && x.fecha), sede: texto(x && x.sede), profe: texto(x && x.profe).slice(0, 80), profe_dni: normalizarDni(x && x.profe_dni), nota: texto(x && x.nota).slice(0, 200), por_dni: 'planilla', en: '' }));
  if (!lista.every(s => esSabado(s.fecha) && SEDES.indexOf(s.sede) >= 0 && (s.profe || s.nota))) falla('datos_invalidos');
  const filas = deps.repo.leer('profe_sabados');
  const hay = {};
  filas.forEach(s => { hay[s.fecha + '|' + s.sede] = true; });
  const nuevas = lista.filter(s => !hay[s.fecha + '|' + s.sede]);
  deps.repo.escribir('profe_sabados', filas.concat(nuevas));
  return { nuevos: nuevas.length, ya_estaban: lista.length - nuevas.length };
}

// ---------- Tareas del mes y comisión por renovaciones (Emanuel, 13/11/2026) ----------
// Antes estaban en las pestañas "Tareas Mensuales" y "Objetivos" de cada planilla. Coordinación arma las tareas del mes;
// cada profe marca las suyas (es decisión del profe si la hizo) con una nota, por ejemplo los nombres de los socios.
// La comisión la calcula la PC con las suscripciones de MOVE: solo cuentan los socios que renuevan la membresía.
// Este repositorio no trae cifras: los valores salen de las planillas y viven en la planilla privada.
const TAREAS_MES_MAX = 12;
const TAREAS_MES_BASE = [   // las de octubre de 2026 en las planillas, para arrancar
  { texto: 'Coordinar una reunión con Emanuel', pide_nota: 'Fecha de la reunión' },
  { texto: 'Agregar un objetivo concreto y medible en la app a 10 socios', pide_nota: 'Nombres de los socios' },
  { texto: 'Tener alguna evaluación cargada en la app de 10 socios', pide_nota: 'Nombres de los socios' },
  { texto: 'Agendar como mínimo 10 evaluaciones con socios a futuro', pide_nota: 'Nombres de los socios' },
  { texto: 'Que 10 socios como mínimo tengan rutinas fuera del gimnasio cargadas', pide_nota: 'Nombres de los socios' },
];
// Objetivo "Tarea mensual" de la planilla: % de tareas hechas → puntos
const TAREAS_MES_TRAMOS = [[1, 20], [0.8, 15], [0.6, 10], [0, 0]];

function mesDe(fecha) { return String(fecha).slice(0, 7); }

// Las tareas de un mes: las que cargó coordinación; si ese mes todavía no tiene, las del último mes con tareas (o las de base)
function tareasDelMes(deps, mes) {
  const todas = deps.repo.leer('profe_tmes');
  let lista = todas.filter(t => t.mes === mes);
  let origen = 'cargadas';
  if (!lista.length) {
    const previos = todas.map(t => t.mes).filter(m => m < mes).sort();
    const ult = previos[previos.length - 1];
    lista = ult ? todas.filter(t => t.mes === ult).map(t => Object.assign({}, t, { mes: mes }))
      : TAREAS_MES_BASE.map((t, i) => ({ mes: mes, id: 'base-' + (i + 1), texto: t.texto, pide_nota: t.pide_nota, orden: String(i + 1) }));
    origen = ult ? 'copiadas' : 'base';
  }
  return { origen: origen, lista: lista.sort((a, b) => Number(a.orden) - Number(b.orden)).map(t => ({ id: t.id, texto: t.texto, pide_nota: t.pide_nota || '' })) };
}

function puntosTareasMes(pct) {
  for (let i = 0; i < TAREAS_MES_TRAMOS.length; i++) if (pct >= TAREAS_MES_TRAMOS[i][0]) return TAREAS_MES_TRAMOS[i][1];
  return 0;
}

function diasDelMesProfe(mes) {
  return new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
}

// Un consejo según el día del mes: la idea es hacerlas al principio y no el último día
function consejoTareasMes(hechas, total, dia, diasMes) {
  const faltan = total - hechas;
  if (!total) return '';
  if (!faltan) return '🎉 Completaste las tareas del mes. ¡Bien ahí!';
  const quedan = diasMes - dia;
  const txtFaltan = faltan === 1 ? 'falta 1 tarea' : 'faltan ' + faltan + ' tareas';
  if (dia <= 10) return hechas ? `Vas ${hechas} de ${total}: seguí ahora que es principio de mes y el resto del mes te queda libre para tus planes.`
    : 'Aprovechá los primeros días del mes: si las hacés ahora, el resto del mes te queda libre para tus planes.';
  if (dia <= 20) return `Ya van ${dia} días del mes y te ${txtFaltan}. Elegí una y hacela esta semana.`;
  return `Quedan ${quedan} ${quedan === 1 ? 'día' : 'días'} para cerrar el mes y te ${txtFaltan}. Que no te agarre el último día.`;
}

function tareasMesDeDni(deps, dni, mes, hoy) {
  const T = tareasDelMes(deps, mes);
  const marcas = deps.repo.leer('profe_tmes_hechas').filter(h => h.mes === mes && h.dni === dni);
  const lista = T.lista.map(t => {
    const m = marcas.find(h => h.tarea_id === t.id);
    return Object.assign({}, t, { hecha: !!(m && m.hecha === '1'), nota: (m && m.nota) || '', en: (m && m.en) || '' });
  });
  const hechas = lista.filter(t => t.hecha).length;
  const pct = lista.length ? hechas / lista.length : 0;
  const dia = mes === mesDe(hoy) ? Number(hoy.slice(8, 10)) : diasDelMesProfe(mes);
  return { mes: mes, lista: lista, hechas: hechas, total: lista.length, pct: Math.round(pct * 100), puntos: puntosTareasMes(pct),
    consejo: consejoTareasMes(hechas, lista.length, dia, diasDelMesProfe(mes)), dia: dia, dias_mes: diasDelMesProfe(mes) };
}

// El profe marca (o desmarca) una tarea del mes, con una nota. Solo el mes en curso (y el anterior hasta el día 5).
function profeTareaMesMarcar(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!esProfe(usuario)) falla('prohibido');
  const hoy = deps.hoy();
  const mes = texto(req.mes) || mesDe(hoy);
  const anterior = mesDe(sumarDiasProfe(mesDe(hoy) + '-01', -1));
  if (mes !== mesDe(hoy) && !(mes === anterior && Number(hoy.slice(8, 10)) <= 5)) falla('datos_invalidos');
  const tarea = tareasDelMes(deps, mes).lista.find(t => t.id === texto(req.tarea_id));
  if (!tarea) falla('no_existe');
  const filas = deps.repo.leer('profe_tmes_hechas').filter(h => !(h.mes === mes && h.dni === usuario.dni && h.tarea_id === tarea.id));
  const hecha = req.hecha !== false;
  filas.push({ mes: mes, tarea_id: tarea.id, dni: usuario.dni, hecha: hecha ? '1' : '', nota: texto(req.nota).slice(0, 600), en: new Date(deps.ahora()).toISOString() });
  deps.repo.escribir('profe_tmes_hechas', filas);
  return tareasMesDeDni(deps, usuario.dni, mes, hoy);
}

// Coordinación carga las tareas de un mes (para todos los profes)
function profeTareasMesGuardar(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!tieneRol(usuario, 'admin') && !tieneRol(usuario, 'coordinador')) falla('prohibido');
  const mes = texto(req.mes);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || mes < mesDe(deps.hoy())) falla('datos_invalidos');
  if (!Array.isArray(req.tareas) || !req.tareas.length || req.tareas.length > TAREAS_MES_MAX) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  const usadas = {};
  const nuevas = req.tareas.map((t, i) => {
    let id = texto(t && t.id);
    if (!id || usadas[id] || id.indexOf('base-') === 0) id = 'tm-' + mes + '-' + (i + 1) + '-' + String(deps.ahora()).slice(-5);
    usadas[id] = true;
    const x = { mes: mes, id: id, texto: texto(t && t.texto).slice(0, 300), pide_nota: texto(t && t.pide_nota).slice(0, 80), orden: String(i + 1), por_dni: usuario.dni, en: ts };
    if (!x.texto) falla('datos_invalidos');
    return x;
  });
  // si había tareas "base" ya marcadas este mes, las marcas pasan a la tarea nueva en la misma posición
  const base = tareasDelMes(deps, mes);
  if (base.origen !== 'cargadas') {
    const hechas = deps.repo.leer('profe_tmes_hechas');
    let cambio = false;
    hechas.forEach(h => {
      const i = base.lista.findIndex(t => t.id === h.tarea_id);
      if (h.mes === mes && i >= 0 && nuevas[i] && nuevas[i].texto === base.lista[i].texto) { h.tarea_id = nuevas[i].id; cambio = true; }
    });
    if (cambio) deps.repo.escribir('profe_tmes_hechas', hechas);
  }
  deps.repo.escribir('profe_tmes', deps.repo.leer('profe_tmes').filter(t => t.mes !== mes).concat(nuevas));
  return { mes: mes, tareas: nuevas.length };
}

// ---------- Comisión por renovaciones (la sube la PC: pulso_profes_liq.py) ----------
function cargarProfeLiq(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas)) falla('datos_invalidos');
  const filas = req.filas.map(x => ({ mes: texto(x && x.mes), profe: texto(x && x.profe), profe_dni: normalizarDni(x && x.profe_dni), sede: texto(x && x.sede),
    datos: typeof (x && x.datos) === 'string' ? x.datos : JSON.stringify((x && x.datos) || {}), cargada: deps.hoy() }));
  if (!filas.every(x => /^\d{4}-\d{2}$/.test(x.mes) && x.profe && x.datos.length < 20000 && leerJson(x.datos, null))) falla('datos_invalidos');
  const meses = {};
  filas.forEach(x => { meses[x.mes] = true; });
  // reemplaza los meses que vienen; los otros quedan como estaban (historia)
  deps.repo.escribir('profe_liq', deps.repo.leer('profe_liq').filter(x => !meses[x.mes]).concat(filas));
  return { filas: filas.length, meses: Object.keys(meses).sort() };
}

function liqDeProfe(deps, profe, dni) {
  const filas = deps.repo.leer('profe_liq').filter(x => (dni && x.profe_dni === dni) || (!x.profe_dni && mismoProfe(x.profe, profe))).sort((a, b) => (a.mes < b.mes ? 1 : -1));
  return filas.slice(0, 3).map(x => Object.assign({ mes: x.mes, cargada: x.cargada }, leerJson(x.datos, {})));
}

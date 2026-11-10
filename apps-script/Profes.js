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
  const { usuario } = sesion(req, deps);
  const hoy = deps.hoy();
  const filas = deps.repo.leer('profe_tareas');
  const coordina = tieneRol(usuario, 'admin') || tieneRol(usuario, 'coordinador');
  const out = { hoy: hoy };
  if (esProfe(usuario)) out.mio = agendaDeProfe(filas.filter(t => t.profe_dni === usuario.dni), hoy);
  if (coordina) {
    const sede = tieneRol(usuario, 'admin') ? texto(req.sede) : usuario.sede;
    if (sede && SEDES.indexOf(sede) < 0) falla('datos_invalidos');
    const deSede = filas.filter(t => !sede || t.sede === sede);
    const nombres = [];
    deSede.forEach(t => { if (nombres.indexOf(t.profe) < 0) nombres.push(t.profe); });
    out.sede = sede || '';
    out.equipo = nombres.sort().map(n => {
      const a = agendaDeProfe(deSede.filter(t => t.profe === n), hoy);
      return { profe: n, con_usuario: deSede.some(t => t.profe === n && t.profe_dni), resumen: a.resumen, hoy: a.hoy };
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

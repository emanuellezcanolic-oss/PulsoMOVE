// PulsoMOVE · Seguimiento de consultas (embudo) y pase de turno.
// Consultas: se apoyan en lo que recepción ya registra (hoja actividad, tipo consulta). Cada una avanza por estados
// (abierta, visita, prueba, vendida, perdida) con un próximo paso y fecha; el próximo paso aparece solo en las tareas del día.
// Pase de turno: nota corta de quien termina para quien sigue, por sede. Del socio solo va el nombre.

const SEG_ESTADOS = ['abierta', 'visita', 'prueba', 'vendida', 'perdida'];
const SEG_ABIERTOS = ['abierta', 'visita', 'prueba'];
const SEG_DIAS = 60;

function segSede(usuario, pedida) {
  const sede = tieneRol(usuario, 'admin') && texto(pedida) ? texto(pedida) : usuario.sede;
  if (SEDES.indexOf(sede) < 0) falla('datos_invalidos');
  return sede;
}

function segExigir(req, deps) {
  const s = sesion(req, deps);
  if (!tieneRol(s.usuario, 'recepcion') && !tieneRol(s.usuario, 'coordinador') && !tieneRol(s.usuario, 'admin')) falla('prohibido');
  return s;
}

function consultasVer(req, deps) {
  const { usuario, usuarios } = segExigir(req, deps);
  const sede = segSede(usuario, req.sede);
  const hoy = deps.hoy();
  const desde = sumarDias(hoy, -SEG_DIAS);
  const estados = {};
  deps.repo.leer('consulta_estado').forEach(e => { estados[e.id] = e; });
  const nombreDe = dni => ((usuarios.find(u => u.dni === dni) || {}).nombre) || '';
  const lista = deps.repo.leer('actividad').filter(a => a.tipo === 'consulta' && a.sede === sede && String(a.ts).slice(0, 10) >= desde).map(a => {
    const e = estados[a.id] || {};
    const estado = SEG_ESTADOS.indexOf(e.estado) >= 0 ? e.estado : 'abierta';
    const abierta = SEG_ABIERTOS.indexOf(estado) >= 0;
    return {
      id: a.id, nombre: a.nombre, canal: a.canal, origen: a.origen, interes: a.interes, detalle: a.detalle, fecha: String(a.ts).slice(0, 10), quien: nombreDe(a.dni),
      estado: estado, proximo_fecha: e.proximo_fecha || '', proximo_paso: e.proximo_paso || '', nota: e.nota || '',
      vencida: abierta && !!e.proximo_fecha && e.proximo_fecha <= hoy,
    };
  }).sort((a, b) => (SEG_ABIERTOS.indexOf(a.estado) >= 0 ? 0 : 1) - (SEG_ABIERTOS.indexOf(b.estado) >= 0 ? 0 : 1)
    || String(a.proximo_fecha || '9999').localeCompare(String(b.proximo_fecha || '9999')) || String(b.fecha).localeCompare(String(a.fecha)));
  const mes = hoy.slice(0, 7);
  const delMes = lista.filter(c => c.fecha.indexOf(mes) === 0);
  const cuenta = (...e) => delMes.filter(c => e.indexOf(c.estado) >= 0).length;
  return {
    sede: sede, hoy: hoy, consultas: lista, estados: SEG_ESTADOS,
    embudo: { mes: mes, consultas: delMes.length, visita: cuenta('visita', 'prueba', 'vendida'), prueba: cuenta('prueba', 'vendida'), vendida: cuenta('vendida'), perdida: cuenta('perdida'), abiertas: lista.filter(c => SEG_ABIERTOS.indexOf(c.estado) >= 0).length, para_hoy: lista.filter(c => c.vencida).length },
  };
}

function consultaActualizar(req, deps) {
  const { usuario, usuarios } = segExigir(req, deps);
  const id = texto(req.id);
  const act = deps.repo.leer('actividad').find(a => a.id === id && a.tipo === 'consulta');
  if (!act) falla('no_encontrado');
  if (!tieneRol(usuario, 'admin') && act.sede !== usuario.sede) falla('prohibido');
  const estado = SEG_ESTADOS.indexOf(texto(req.estado)) >= 0 ? texto(req.estado) : 'abierta';
  const abierta = SEG_ABIERTOS.indexOf(estado) >= 0;
  const fecha = abierta && texto(req.proximo_fecha) ? liqFecha(req.proximo_fecha) : '';
  if (abierta && texto(req.proximo_fecha) && !fecha) falla('datos_invalidos');
  const paso = texto(req.proximo_paso).slice(0, 160), nota = texto(req.nota).slice(0, 300);
  const filas = deps.repo.leer('consulta_estado').filter(e => e.id !== id);
  filas.push({ id: id, estado: estado, proximo_fecha: fecha, proximo_paso: abierta ? paso : '', nota: nota, dni: usuario.dni, sede: act.sede, actualizado: new Date(deps.ahora()).toISOString() });
  deps.repo.escribir('consulta_estado', filas);
  // El próximo paso se vuelve tarea del día. Al cerrar la consulta, lo que quedaba pendiente se retira.
  const socio = 'consulta-' + id;
  const tareas = deps.repo.leer('tareas');
  const quedan = tareas.filter(t => !(t.socio_id === socio && t.estado === 'pendiente' && (!abierta || String(t.id).indexOf(socio + '-') === 0)));
  if (quedan.length !== tareas.length) deps.repo.escribir('tareas', quedan);
  if (abierta && fecha) {
    const responsable = usuarios.find(u => u.dni === act.dni && esVerdad(u.activo) && tieneRol(u, 'recepcion')) || usuario;
    deps.repo.agregar('tareas', {
      id: socio + '-' + fecha, fecha: fecha, sede: act.sede, socio_id: socio, socio_nombre: act.nombre, profe: '', tipo: 'Seguimiento de consulta',
      prioridad: '2', situacion: 'Consulta de ' + act.canal + ' · ' + (estado === 'abierta' ? 'sigue abierta' : estado === 'visita' ? 'quedó en venir' : 'hizo la prueba'),
      accion: paso || 'Hacer el seguimiento y proponerle la visita', ultima_anotacion: nota, asignado_dni: responsable.dni, pendiente_desde: fecha, estado: 'pendiente', hecha_en: '', intro: '',
    });
  }
  return {};
}

// ---------- Pase de turno ----------

const PASE_CAMPOS = ['pendientes', 'esperando', 'novedades'];

function paseGuardar(req, deps) {
  const { usuario } = segExigir(req, deps);
  const f = {};
  PASE_CAMPOS.forEach(k => { f[k] = texto(req[k]).slice(0, 700); });
  if (!PASE_CAMPOS.some(k => f[k])) falla('datos_invalidos');
  deps.repo.agregar('pases', {
    id: 'P-' + deps.aleatorio(6), fecha: deps.hoy(), sede: usuario.sede, dni: usuario.dni, nombre: usuario.nombre, turno: usuario.turno || '',
    pendientes: f.pendientes, esperando: f.esperando, novedades: f.novedades, ts: new Date(deps.ahora()).toISOString(), leidos: '',
  });
  return {};
}

function paseVer(req, deps) {
  const { usuario } = segExigir(req, deps);
  const sede = segSede(usuario, req.sede);
  const hoy = deps.hoy();
  const desde = sumarDias(hoy, -10);
  const lista = deps.repo.leer('pases').filter(p => p.sede === sede && String(p.fecha) >= desde)
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 12)
    .map(p => {
      const leidos = String(p.leidos || '').split(',').filter(Boolean);
      return { id: p.id, fecha: p.fecha, nombre: p.nombre, turno: p.turno, pendientes: p.pendientes, esperando: p.esperando, novedades: p.novedades, mio: p.dni === usuario.dni, leido: p.dni === usuario.dni || leidos.indexOf(usuario.dni) >= 0, leyeron: leidos.length };
    });
  return { sede: sede, hoy: hoy, pases: lista, sin_leer: lista.filter(p => !p.leido && String(p.fecha) >= sumarDias(hoy, -3)).length };
}

function paseLeido(req, deps) {
  const { usuario } = segExigir(req, deps);
  const filas = deps.repo.leer('pases');
  const p = filas.find(x => x.id === texto(req.id));
  if (!p) falla('no_encontrado');
  if (!tieneRol(usuario, 'admin') && p.sede !== usuario.sede) falla('prohibido');
  const leidos = String(p.leidos || '').split(',').filter(Boolean);
  if (leidos.indexOf(usuario.dni) < 0) { leidos.push(usuario.dni); p.leidos = leidos.join(','); deps.repo.escribir('pases', filas); }
  return {};
}

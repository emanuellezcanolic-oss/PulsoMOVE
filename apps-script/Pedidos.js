// PulsoMOVE · Pedidos de coordinación (Emanuel, 18/11/2026).
// Coordinación (admin y coordinador: Emanuel y Lucía) les pide cosas a recepción y a los profes. Es una sola clase de pedido: una tarea
// con fecha límite que le aparece a quien le toca N días antes. Cada persona la marca como hecha (con una nota) y puede ir sumando
// ítems / observaciones a lo largo de los días (un pedido de limpieza, librería, lo que sea). Los ítems son de cada sede.
// Una tarea sin hacer pasada su fecha sigue apareciendo, marcada como atrasada.
// Un pedido puede repetirse cada semana o cada mes: no hay proceso que lo renueve, el ciclo vigente se calcula con la fecha de hoy
// y cada artículo queda guardado con el cierre al que pertenece (así los pedidos anteriores quedan de historial).

const PEDIDO_ROLES = ['recepcion', 'profe'];
const PEDIDO_REPITE = ['', 'semanal', 'mensual'];
const PEDIDO_MAX_ITEMS_SEDE = 80;     // artículos por sede en cada cierre
const PEDIDO_DIAS_GUARDAR = 200;      // lo más viejo se limpia al guardar

function pedCsv(s) {
  return texto(s).split(',').map(x => x.trim()).filter(Boolean);
}

function pedDiasEntre(desde, hasta) {
  return Math.round((new Date(hasta + 'T12:00:00Z') - new Date(desde + 'T12:00:00Z')) / 86400000);
}

// La misma fecha k meses después; si el mes no tiene ese día (30 de febrero), el último del mes
function pedSumarMeses(iso, k) {
  const a = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + k, dia = Number(iso.slice(8, 10));
  const ult = new Date(Date.UTC(a + Math.floor(m / 12), ((m % 12) + 12) % 12 + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(a + Math.floor(m / 12), ((m % 12) + 12) % 12, Math.min(dia, ult), 12));
  return d.toISOString().slice(0, 10);
}

// El cierre vigente: el de la fecha cargada y, si se repite, el primero que no pasó todavía
function pedCiclo(p, hoy) {
  const base = texto(p.cierra);
  if (!base) return '';
  if (p.repite === 'semanal') {
    let c = base;
    while (c < hoy) c = sumarDias(c, 7);
    return c;
  }
  if (p.repite === 'mensual') {
    let k = 0, c = base;
    while (c < hoy) c = pedSumarMeses(base, ++k);
    return c;
  }
  return base;
}

function pedAvisarDias(p) {
  const n = Number(p.avisar_dias);
  return isFinite(n) && n >= 0 ? n : 5;
}

// Desde cuándo se le avisa a la gente. Sin fecha de cierre, desde que se creó.
function pedDesde(p, ciclo) {
  return ciclo ? sumarDias(ciclo, -pedAvisarDias(p)) : texto(p.creado).slice(0, 10);
}

// ¿A esta persona le toca el pedido? Por nombre propio, o por rol (y sede, si se limitó a algunas)
function pedLeToca(p, u) {
  if (pedCsv(p.para_dnis).indexOf(u.dni) >= 0) return true;
  const roles = pedCsv(p.para_roles), sedes = pedCsv(p.para_sedes);
  if (!roles.some(r => tieneRol(u, r))) return false;
  return !sedes.length || sedes.indexOf(u.sede) >= 0;
}

function pedEsCoord(u) {
  return tieneRol(u, 'admin') || tieneRol(u, 'coordinador');
}

function pedActivos(deps) {
  return deps.repo.leer('pedidos').filter(p => p.estado !== 'borrado');
}

// Cómo está un pedido hoy: 'programado' (todavía no se avisa), 'activo', 'atrasado' (tarea sin hacer pasada su fecha) o 'cerrado'
function pedEstado(p, hoy) {
  const ciclo = pedCiclo(p, hoy);
  if (!ciclo) return { ciclo: '', estado: 'activo', desde: pedDesde(p, ''), faltan: null };
  const faltan = pedDiasEntre(hoy, ciclo);
  const desde = pedDesde(p, ciclo);
  if (hoy < desde) return { ciclo: ciclo, estado: 'programado', desde: desde, faltan: faltan };
  if (faltan < 0) return { ciclo: ciclo, estado: 'atrasado', desde: desde, faltan: faltan };
  return { ciclo: ciclo, estado: 'activo', desde: desde, faltan: faltan };
}

function pedItemsDe(items, id, ciclo) {
  return items.filter(i => i.pedido_id === id && i.ciclo === ciclo);
}

function pedVerItem(i, dni) {
  return { id: i.id, texto: i.texto, cantidad: i.cantidad, nombre: i.nombre, sede: i.sede, mio: i.dni === dni, ts: i.ts };
}

// Lo que ve cada persona: los pedidos que le tocan y ya están en época de aviso
function pedidosMios(req, deps) {
  const { usuario } = sesion(req, deps);
  const hoy = deps.hoy();
  const items = deps.repo.leer('pedidos_items');
  const hechos = deps.repo.leer('pedidos_hechos');
  const lista = [];
  pedActivos(deps).forEach(p => {
    if (!pedLeToca(p, usuario)) return;
    const e = pedEstado(p, hoy);
    if (e.estado === 'programado' || e.estado === 'cerrado') return;
    const h = hechos.find(x => x.pedido_id === p.id && x.ciclo === e.ciclo && x.dni === usuario.dni);
    // lo que se hizo antes de hoy no vuelve a aparecer; lo de hoy queda tildado hasta que termine el día
    if (h && String(h.ts).slice(0, 10) < hoy) return;
    const o = {
      id: p.id, tipo: p.tipo, titulo: p.titulo, detalle: p.detalle, de_nombre: p.de_nombre, cierra: e.ciclo, faltan: e.faltan, atrasado: e.estado === 'atrasado',
      repite: p.repite, hecho: !!h, hecho_nota: h ? h.nota : '',
    };
    o.items = pedItemsDe(items, p.id, e.ciclo).filter(i => i.sede === usuario.sede).map(i => pedVerItem(i, usuario.dni));
    lista.push(o);
  });
  lista.sort((a, b) => (a.hecho - b.hecho) || ((a.faltan == null ? 9999 : a.faltan) - (b.faltan == null ? 9999 : b.faltan)));
  return { hoy: hoy, sede: usuario.sede, pedidos: lista };
}

function pedirAsignado(req, deps) {
  const { usuario } = sesion(req, deps);
  const p = pedActivos(deps).find(x => x.id === texto(req.pedido_id));
  if (!p) falla('no_existe');
  if (!pedLeToca(p, usuario)) falla('prohibido');
  const hoy = deps.hoy();
  const e = pedEstado(p, hoy);
  return { usuario: usuario, p: p, e: e, hoy: hoy };
}

// Marcar un pedido: una tarea como hecha (con nota) o, en una lista, "mi sede ya cargó todo"
function pedidoHecho(req, deps) {
  const { usuario, p, e, hoy } = pedirAsignado(req, deps);
  if (e.estado === 'programado') falla('datos_invalidos');
  const hechos = deps.repo.leer('pedidos_hechos').filter(x => !(x.pedido_id === p.id && x.ciclo === e.ciclo && x.dni === usuario.dni));
  const hecho = req.hecho !== false;
  if (hecho) hechos.push({ pedido_id: p.id, ciclo: e.ciclo, dni: usuario.dni, nombre: usuario.nombre, sede: usuario.sede, nota: texto(req.nota).slice(0, 300), ts: new Date(deps.ahora()).toISOString() });
  deps.repo.escribir('pedidos_hechos', hechos);
  return pedidosMios(req, deps);
}

function pedidoItemAgregar(req, deps) {
  const { usuario, p, e } = pedirAsignado(req, deps);
  if (e.estado === 'programado') falla('datos_invalidos');
  const t = texto(req.texto).slice(0, 80);
  if (!t) falla('datos_invalidos');
  const items = deps.repo.leer('pedidos_items');
  if (pedItemsDe(items, p.id, e.ciclo).filter(i => i.sede === usuario.sede).length >= PEDIDO_MAX_ITEMS_SEDE) falla('datos_invalidos');
  deps.repo.agregar('pedidos_items', { id: 'pi-' + deps.aleatorio(5), pedido_id: p.id, ciclo: e.ciclo, sede: usuario.sede, dni: usuario.dni, nombre: usuario.nombre,
    texto: t, cantidad: texto(req.cantidad).slice(0, 20) || '1', ts: new Date(deps.ahora()).toISOString() });
  // si ya había marcado "listo", al sumar algo se reabre
  const hechos = deps.repo.leer('pedidos_hechos');
  const quedan = hechos.filter(x => !(x.pedido_id === p.id && x.ciclo === e.ciclo && x.dni === usuario.dni));
  if (quedan.length < hechos.length) deps.repo.escribir('pedidos_hechos', quedan);
  return pedidosMios(req, deps);
}

// Quita un artículo: lo puede sacar cualquiera de la misma sede mientras el pedido siga abierto
function pedidoItemQuitar(req, deps) {
  const { usuario } = sesion(req, deps);
  const items = deps.repo.leer('pedidos_items');
  const i = items.find(x => x.id === texto(req.item_id));
  if (!i) falla('no_existe');
  const p = pedActivos(deps).find(x => x.id === i.pedido_id);
  if (!p) falla('no_existe');
  if (!pedEsCoord(usuario)) {
    if (!pedLeToca(p, usuario) || i.sede !== usuario.sede) falla('prohibido');
    const e = pedEstado(p, deps.hoy());
    if (e.estado === 'programado' || e.ciclo !== i.ciclo) falla('datos_invalidos');
  }
  deps.repo.escribir('pedidos_items', items.filter(x => x.id !== i.id));
  return pedEsCoord(usuario) && req.volver === 'ver' ? pedidosVer(req, deps) : pedidosMios(req, deps);
}

function pedExigirCoord(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!pedEsCoord(usuario)) falla('prohibido');
  return { usuario: usuario, usuarios: usuarios };
}

// A quién le toca hoy cada pedido, con quién ya lo marcó
function pedAsignados(p, usuarios, hechos, ciclo) {
  return usuarios.filter(u => esVerdad(u.activo) && !pedEsCoord(u) && pedLeToca(p, u) && (tieneRol(u, 'recepcion') || tieneRol(u, 'profe')))
    .map(u => {
      const h = hechos.find(x => x.pedido_id === p.id && x.ciclo === ciclo && x.dni === u.dni);
      return { dni: u.dni, nombre: u.nombre, sede: u.sede, roles: rolesDe(u).filter(r => PEDIDO_ROLES.indexOf(r) >= 0), hecho: !!h, nota: h ? h.nota : '', cuando: h ? h.ts : '' };
    });
}

function pedidosVer(req, deps) {
  const { usuarios } = pedExigirCoord(req, deps);
  const hoy = deps.hoy();
  const items = deps.repo.leer('pedidos_items');
  const hechos = deps.repo.leer('pedidos_hechos');
  const pedidos = pedActivos(deps).map(p => {
    const e = pedEstado(p, hoy);
    const ciclos = [];
    items.filter(i => i.pedido_id === p.id).forEach(i => { if (ciclos.indexOf(i.ciclo) < 0) ciclos.push(i.ciclo); });
    ciclos.sort().reverse();
    const porSede = ciclo => SEDES.map(s => ({ sede: s, items: pedItemsDe(items, p.id, ciclo).filter(i => i.sede === s).map(i => pedVerItem(i, '')) })).filter(x => x.items.length);
    return {
      id: p.id, tipo: p.tipo, titulo: p.titulo, detalle: p.detalle, de_nombre: p.de_nombre, de_dni: p.de_dni, cierra: texto(p.cierra), avisar_dias: pedAvisarDias(p), repite: p.repite,
      para_roles: pedCsv(p.para_roles), para_sedes: pedCsv(p.para_sedes), para_dnis: pedCsv(p.para_dnis),
      estado: e.estado, ciclo: e.ciclo, desde: e.desde, faltan: e.faltan,
      asignados: pedAsignados(p, usuarios, hechos, e.ciclo),
      por_sede: porSede(e.ciclo),
      anteriores: ciclos.filter(c => c !== e.ciclo).slice(0, 6).map(c => ({ ciclo: c, por_sede: porSede(c) })),
    };
  });
  const orden = { atrasado: 0, activo: 1, programado: 2, cerrado: 3 };
  pedidos.sort((a, b) => (orden[a.estado] - orden[b.estado]) || String(a.ciclo || '9999').localeCompare(String(b.ciclo || '9999')));
  const personas = usuarios.filter(u => esVerdad(u.activo) && !pedEsCoord(u) && (tieneRol(u, 'recepcion') || tieneRol(u, 'profe')))
    .map(u => ({ dni: u.dni, nombre: u.nombre, sede: u.sede, roles: rolesDe(u).filter(r => PEDIDO_ROLES.indexOf(r) >= 0) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return { hoy: hoy, pedidos: pedidos, personas: personas };
}

// Crea o cambia un pedido. Lo pueden hacer Emanuel y Lucía; el pedido queda a nombre de quien lo creó.
function pedidoGuardar(req, deps) {
  const { usuario, usuarios } = pedExigirCoord(req, deps);
  const hoy = deps.hoy();
  const tipo = 'tarea';   // una sola clase de pedido (Emanuel, 18/11/2026); la hoja conserva la columna
  const titulo = texto(req.titulo).slice(0, 80);
  if (!titulo) falla('datos_invalidos');
  const roles = (Array.isArray(req.para_roles) ? req.para_roles : []).filter(r => PEDIDO_ROLES.indexOf(r) >= 0);
  const sedes = (Array.isArray(req.para_sedes) ? req.para_sedes : []).filter(s => SEDES.indexOf(s) >= 0);
  const dnis = (Array.isArray(req.para_dnis) ? req.para_dnis : []).map(normalizarDni)
    .filter(d => usuarios.some(u => u.dni === d && esVerdad(u.activo) && (tieneRol(u, 'recepcion') || tieneRol(u, 'profe'))));
  if (!roles.length && !dnis.length) falla('datos_invalidos');
  const cierra = texto(req.cierra);
  if (cierra && !fechaIsoValida(cierra)) falla('datos_invalidos');
  const repite = texto(req.repite);
  if (PEDIDO_REPITE.indexOf(repite) < 0 || (repite && !cierra)) falla('datos_invalidos');
  const avisar = req.avisar_dias == null || req.avisar_dias === '' ? 5 : Math.round(Number(req.avisar_dias));
  if (!isFinite(avisar) || avisar < 0 || avisar > 60) falla('datos_invalidos');
  const todos = deps.repo.leer('pedidos');
  const ahora = new Date(deps.ahora()).toISOString();
  const id = texto(req.id);
  let p = id ? todos.find(x => x.id === id && x.estado !== 'borrado') : null;
  if (id && !p) falla('no_existe');
  if (!p && cierra && cierra < hoy) falla('datos_invalidos');
  const antes = p ? pedCiclo(p, hoy) : '';
  if (!p) {
    p = { id: 'pd-' + deps.aleatorio(5), de_dni: usuario.dni, de_nombre: usuario.nombre, creado: ahora, estado: 'abierto' };
    todos.push(p);
  }
  Object.assign(p, { tipo: tipo, titulo: titulo, detalle: texto(req.detalle).slice(0, 600), para_roles: roles.join(','), para_sedes: sedes.join(','), para_dnis: dnis.join(','),
    cierra: cierra, avisar_dias: String(avisar), repite: repite, actualizado: ahora });
  deps.repo.escribir('pedidos', todos);
  // si cambió la fecha de cierre, lo ya cargado se va con ella
  const ahoraCiclo = pedCiclo(p, hoy);
  if (antes && ahoraCiclo && antes !== ahoraCiclo) {
    const mover = f => f.map(x => (x.pedido_id === p.id && x.ciclo === antes ? Object.assign({}, x, { ciclo: ahoraCiclo }) : x));
    deps.repo.escribir('pedidos_items', mover(deps.repo.leer('pedidos_items')));
    deps.repo.escribir('pedidos_hechos', mover(deps.repo.leer('pedidos_hechos')));
  }
  pedLimpiar(deps, hoy);
  return pedidosVer(req, deps);
}

function pedidoBorrar(req, deps) {
  pedExigirCoord(req, deps);
  const todos = deps.repo.leer('pedidos');
  const p = todos.find(x => x.id === texto(req.id) && x.estado !== 'borrado');
  if (!p) falla('no_existe');
  p.estado = 'borrado';
  p.actualizado = new Date(deps.ahora()).toISOString();
  deps.repo.escribir('pedidos', todos);
  return pedidosVer(req, deps);
}

// Lo muy viejo se borra para que la hoja no crezca sin fin: artículos y marcas de ciclos de hace más de 200 días
function pedLimpiar(deps, hoy) {
  const limite = sumarDias(hoy, -PEDIDO_DIAS_GUARDAR);
  ['pedidos_items', 'pedidos_hechos'].forEach(h => {
    const filas = deps.repo.leer(h);
    const vigentes = filas.filter(x => String(x.ciclo || '9999') >= limite);
    if (vigentes.length < filas.length) deps.repo.escribir(h, vigentes);
  });
}

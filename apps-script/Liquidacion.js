// PulsoMOVE · Liquidación de recepción: sueldo por hora + comisión por ingresos nuevos + extras, mes a mes,
// y las horas que salen del QR de ingreso. Las reglas salen de las planillas de recepción (pestaña "Objetivos").
// Quién ve qué: coordinación con rol admin ve y edita todo; cada recepcionista (y coordinador) ve solo lo suyo.
// Los datos viven en la planilla privada: este repositorio no trae ninguna cifra de nadie.

const LIQ_CONCEPTOS = ['Aguinaldo', 'Horas extra', 'Extra objetivo', 'Online', 'Informes', 'Consumo staff', 'Monotributo', 'Otro'];
const LIQ_ETIQUETAS = ['No alcanzado', 'Objetivo 1', 'Objetivo 2', 'Máximo'];
// Valores de las planillas (pestaña Objetivos, noviembre 2026). Los objetivos son de "4 hs": coordinación los puede cambiar por mes.
const LIQ_TARIFAS_BASE = [480, 648, 720, 864];
const LIQ_METAS_BASE = { bolson: [19, 20, 25, 27], puelo: [10.6, 11.2, 14, 16], bariloche: [] };
// Horas por día de la semana (lunes a domingo). Emanuel, 12/11/2026: Tani, Azul, Ara y Rubén 6 h, Keila 7 h, Rubén también los sábados.
const LIQ_DIAS_BASE = [6, 6, 6, 6, 6, 0, 0];
const LIQ_FILAS_MAX = 2000;

function liqJson(s) {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    return {};
  }
}

function liqNumero(v, min, max) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!isFinite(n) || n < min || n > max) falla('datos_invalidos');
  return n;
}

function liqMes(m) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(texto(m)) ? texto(m) : '';
}

function liqFecha(f) {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto(f)) ? texto(f) : '';
}

function liqHora(h) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(texto(h)) ? texto(h) : '';
}

function liqMinutos(hhmm) {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

// 0 = lunes … 6 = domingo
function liqDiaSemana(fecha) {
  return (new Date(fecha + 'T12:00:00Z').getUTCDay() + 6) % 7;
}

function liqDiasDelMes(mes) {
  const a = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  const n = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= n; d++) out.push(mes + '-' + String(d).padStart(2, '0'));
  return out;
}

function liqLunesDe(fecha) {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - liqDiaSemana(fecha));
  return d.toISOString().slice(0, 10);
}

function liqRedondeo(n, dec) {
  const k = Math.pow(10, dec || 0);
  return Math.round(n * k) / k;
}

// Objetivos y tarifas de un mes: la última configuración cargada hasta ese mes, sobre los valores de las planillas
function liqConfigDelMes(filas, mes) {
  const cargadas = filas.filter(f => f.dni === '*' && /^\d{4}-\d{2}$/.test(f.mes) && f.mes <= mes).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
  const ultima = cargadas.length ? liqJson(cargadas[cargadas.length - 1].datos) : {};
  const metas = {};
  Object.keys(LIQ_METAS_BASE).forEach(s => {
    metas[s] = ultima.metas && Array.isArray(ultima.metas[s]) ? ultima.metas[s].map(Number) : LIQ_METAS_BASE[s].slice();
  });
  return {
    tarifas: Array.isArray(ultima.tarifas) && ultima.tarifas.length === 4 ? ultima.tarifas.map(Number) : LIQ_TARIFAS_BASE.slice(),
    metas: metas,
    desde: cargadas.length ? cargadas[cargadas.length - 1].mes : '',
  };
}

// Tramo de la comisión según los ingresos nuevos del mes: 0 no alcanzado … 3 máximo. null si no hay objetivos o nuevos.
function liqTramo(nuevos, metas) {
  if (nuevos == null || !Array.isArray(metas) || metas.length < 4) return null;
  let t = 0;
  for (let i = 1; i < 4; i++) if (nuevos >= metas[i]) t = i;
  return t;
}

// La liquidación de una persona en un mes. `fila` es lo cargado para ese mes (o null); `previa` lo del último mes con datos,
// de donde se arrastran el valor hora y las horas cuando el mes todavía no se cargó.
function liqCalcular(sede, fila, previa, cfg, nuevosApp, ajusteHoras) {
  const d = fila ? liqJson(fila.datos) : {};
  const p = previa ? liqJson(previa.datos) : {};
  const valorHora = d.valor_hora != null ? Number(d.valor_hora) : (p.valor_hora != null ? Number(p.valor_hora) : 0);
  const horasPlanilla = d.horas != null ? Number(d.horas) : (p.horas != null ? Number(p.horas) : 0);
  const ajuste = Number(ajusteHoras) || 0;           // coberturas del mes: horas que cubrió menos las que le cubrieron
  const horas = Math.max(0, horasPlanilla + ajuste);
  const nuevos = d.nuevos != null && d.nuevos !== '' ? Number(d.nuevos) : (nuevosApp != null ? Number(nuevosApp) : null);
  const metas = Array.isArray(d.metas) && d.metas.length === 4 ? d.metas.map(Number) : (cfg.metas[sede] || []);
  const tramo = liqTramo(nuevos, metas);
  const tarifa = tramo == null ? null : cfg.tarifas[tramo];
  const calculada = tramo == null ? null : Math.round(nuevos * tarifa);
  const manual = d.comision != null && d.comision !== '';
  const comision = manual ? Number(d.comision) : (calculada == null ? 0 : calculada);
  const extras = (Array.isArray(d.extras) ? d.extras : []).map(x => ({ c: texto(x.c), m: Number(x.m) || 0 }));
  const totalExtras = extras.reduce((a, x) => a + x.m, 0);
  const base = Math.round(valorHora * horas);
  return {
    cargado: !!fila, valor_hora: valorHora, horas: horas, horas_planilla: horasPlanilla, ajuste_horas: ajuste, base: base,
    nuevos: nuevos, nuevos_app: nuevosApp == null ? null : Number(nuevosApp), nuevos_manual: d.nuevos != null && d.nuevos !== '',
    metas: metas, tramo: tramo, etiqueta: tramo == null ? '' : LIQ_ETIQUETAS[tramo], tarifa: tarifa,
    comision_calculada: calculada, comision: comision, comision_manual: manual,
    extras: extras, total_extras: totalExtras, total: base + comision + totalExtras,
    nota: texto(d.nota),
  };
}

// Horas por QR de un mes. dias = horas por día de la semana (lunes a domingo).
// Con entrada y salida del QR son horas reales; sin salida se toman las horas previstas de ese día (estimadas).
function liqHorasQr(filasQr, dias, mes, hoy, omitir) {
  const salteados = {};
  (omitir || []).forEach(f => { salteados[f] = 1; });      // días en que otra persona la cubrió: no se le prevén horas
  const prev = d => (salteados[d] ? 0 : Number(dias[liqDiaSemana(d)]) || 0);
  const porFecha = {};
  filasQr.forEach(f => { if (texto(f.fecha).slice(0, 7) === mes) porFecha[f.fecha] = f; });
  const out = [];
  let totalPrevistasPasadas = 0, sinQr = 0;
  liqDiasDelMes(mes).forEach(f => {
    const q = porFecha[f];
    const prevista = prev(f);
    if (prevista > 0 && f <= hoy) totalPrevistasPasadas += prevista;
    if (!q) {
      if (prevista > 0 && f < hoy) sinQr++;
      return;
    }
    const entrada = liqHora(q.entrada), salida = liqHora(q.salida);
    const dif = entrada && salida ? liqMinutos(salida) - liqMinutos(entrada) : 0;
    const real = dif >= 60 && dif <= 14 * 60;
    out.push({ fecha: f, entrada: entrada, salida: salida, prevista: prevista, real: real, horas: real ? liqRedondeo(dif / 60, 2) : prevista, fuera: prevista === 0 });
  });
  const semanas = {};
  out.forEach(d => {
    const lunes = liqLunesDe(d.fecha);
    const s = semanas[lunes] = semanas[lunes] || { desde: lunes, horas: 0, dias: 0, reales: 0 };
    s.horas += d.horas; s.dias++; if (d.real) s.reales++;
  });
  const total = out.reduce((a, d) => a + d.horas, 0);
  return {
    dias: out,
    semanas: Object.keys(semanas).sort().map(k => Object.assign(semanas[k], { horas: liqRedondeo(semanas[k].horas, 1) })),
    total: liqRedondeo(total, 1),
    previstas_pasadas: liqRedondeo(totalPrevistasPasadas, 1),
    previstas_mes: liqRedondeo(liqDiasDelMes(mes).reduce((a, d) => a + prev(d), 0), 1),
    dias_con_qr: out.length, dias_sin_qr: sinQr, dias_reales: out.filter(d => d.real).length,
  };
}

// Socios nuevos que cobró una persona en un mes según sus cajas de MOVE (todo el mes, desde el día 1). null si no hay cajas de ese mes.
function liqNuevosDeCajas(filasVentas, dni, m) {
  const propias = filasVentas.filter(f => f.dni === dni && String(f.fecha).indexOf(m) === 0);
  return propias.length ? propias.reduce((a, f) => a + (Number(f.nuevos) || 0), 0) : null;
}

// Socios nuevos mes a mes de una persona: lo cargado en la liquidación (planilla o a mano) manda; si no hay, lo que suman sus cajas.
// Es la venta que más pesa, por eso se muestra aparte en Rendimiento.
function liqNuevosPorMes(dni, filasLiq, filasVentas, hoyMes) {
  const meses = {};
  filasLiq.forEach(f => { if (f.dni === dni && /^\d{4}-\d{2}$/.test(f.mes)) meses[f.mes] = 1; });
  filasVentas.forEach(f => { if (f.dni === dni && /^\d{4}-\d{2}/.test(String(f.fecha))) meses[String(f.fecha).slice(0, 7)] = 1; });
  return Object.keys(meses).sort().filter(m => m <= hoyMes).map(m => {
    const fl = filasLiq.find(f => f.dni === dni && f.mes === m);
    const cargado = fl ? liqJson(fl.datos).nuevos : null;
    const cajas = liqNuevosDeCajas(filasVentas, dni, m);
    const hayCargado = cargado != null && cargado !== '';
    return { mes: m, nuevos: hayCargado ? Number(cargado) : cajas, cajas: cajas, fuente: hayCargado ? 'liquidacion' : 'cajas' };
  }).filter(x => x.nuevos != null).slice(-12);
}

// Cuánto falta para el próximo escalón de la comisión, con lo que se lleva y el ritmo del mes. null si la sede no tiene objetivos (Bariloche).
function liqEscalon(u, mes, hoy, filasLiq, nuevosApp) {
  const cfg = liqConfigDelMes(filasLiq, mes);
  const l = liqCalcular(u.sede, filasLiq.find(f => f.dni === u.dni && f.mes === mes) || null, null, cfg, nuevosApp);
  if (l.tramo == null || l.nuevos == null) return null;
  const dias = liqDiasDelMes(mes).length;
  const corridos = mes === hoy.slice(0, 7) ? Number(hoy.slice(8, 10)) : dias;
  const restantes = Math.max(0, dias - corridos);
  const proyeccion = corridos ? liqRedondeo(l.nuevos / corridos * dias, 1) : l.nuevos;
  const tramoProyectado = liqTramo(proyeccion, l.metas);
  let siguiente = null;
  if (l.tramo < 3) {
    const meta = l.metas[l.tramo + 1], tarifa = cfg.tarifas[l.tramo + 1];
    const faltan = Math.max(0, Math.ceil(meta - l.nuevos));
    siguiente = {
      etiqueta: LIQ_ETIQUETAS[l.tramo + 1], meta: meta, tarifa: tarifa, faltan: faltan,
      por_dia: restantes > 0 ? liqRedondeo(faltan / restantes, 1) : null,
      comision_al_llegar: Math.round(Math.ceil(meta) * tarifa), comision_hoy: Math.round(l.nuevos * cfg.tarifas[l.tramo]),
    };
  }
  return {
    mes: mes, nuevos: l.nuevos, tramo: l.tramo, etiqueta: l.etiqueta, tarifa: l.tarifa, metas: l.metas,
    proyeccion: proyeccion, tramo_proyectado: tramoProyectado, etiqueta_proyectada: tramoProyectado == null ? '' : LIQ_ETIQUETAS[tramoProyectado],
    dias_restantes: restantes, siguiente: siguiente, maximo: l.tramo === 3,
  };
}

// Coberturas y cambios de turno (eventuales): quién cubrió a quién, un día y por cuántas horas.
// A quien cubre se le suman esas horas; a la titular se le descuentan salvo que se le pague igual (descuenta = 'false').
function liqCoberturasDe(filas, dni, mes) {
  const delMes = filas.filter(c => texto(c.fecha).slice(0, 7) === mes && (c.cubre_dni === dni || c.titular_dni === dni));
  let ajuste = 0;
  const omitir = [];
  delMes.forEach(c => {
    const h = Number(c.horas) || 0;
    if (c.cubre_dni === dni) ajuste += h;
    if (c.titular_dni === dni) {
      if (c.descuenta !== 'false' && c.descuenta !== false) ajuste -= h;
      omitir.push(c.fecha);
    }
  });
  return { ajuste: liqRedondeo(ajuste, 2), omitir: omitir, lista: delMes };
}

function liqRecepcionistas(usuarios) {
  return usuarios.filter(u => esVerdad(u.activo) && tieneRol(u, 'recepcion'));
}

function liqDiasDe(filas, dni) {
  const f = filas.find(x => x.dni === dni && x.mes === 'horas');
  const d = f ? liqJson(f.datos).dias : null;
  return Array.isArray(d) && d.length === 7 ? d.map(Number) : LIQ_DIAS_BASE.slice();
}

function liquidacionVer(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const admin = tieneRol(usuario, 'admin');
  if (!admin && !tieneRol(usuario, 'recepcion') && !tieneRol(usuario, 'coordinador')) falla('prohibido');
  const equipo = admin ? liqRecepcionistas(usuarios) : [usuario];
  if (!admin && texto(req.dni) && normalizarDni(req.dni) !== usuario.dni) falla('prohibido');
  const hoy = deps.hoy();
  const mes = liqMes(req.mes) || hoy.slice(0, 7);
  const filas = deps.repo.leer('liquidacion');
  const qr = deps.repo.leer('liq_qr');
  const rendimiento = deps.repo.leer('rendimiento');
  const coberturas = deps.repo.leer('coberturas');
  const nombreDe = dni => ((usuarios.find(u => u.dni === dni) || {}).nombre) || 'Otra persona';
  const configs = {};
  const config = m => configs[m] || (configs[m] = liqConfigDelMes(filas, m));
  const filasVentas = deps.repo.leer('ventas');
  const nuevosApp = (dni, m) => {
    const deCajas = liqNuevosDeCajas(filasVentas, dni, m);      // el mes entero, desde el día 1
    if (deCajas != null) return deCajas;
    const r = rendimiento.find(x => x.mes === m && x.dni === dni);
    const v = r ? liqJson(r.datos).nuevos : null;
    return v == null ? null : Number(v);
  };
  const personas = equipo.map(u => {
    const propias = filas.filter(f => f.dni === u.dni && /^\d{4}-\d{2}$/.test(f.mes)).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
    const previaDe = m => propias.filter(f => f.mes < m && (liqJson(f.datos).valor_hora != null)).pop() || null;
    const meses = propias.map(f => f.mes);
    if (meses.indexOf(mes) < 0 && mes <= hoy.slice(0, 7)) meses.push(mes);
    meses.sort();
    const serie = meses.slice(-12).map(m => {
      const l = liqCalcular(u.sede, propias.find(f => f.mes === m) || null, previaDe(m), config(m), nuevosApp(u.dni, m), liqCoberturasDe(coberturas, u.dni, m).ajuste);
      return { mes: m, cargado: l.cargado, base: l.base, comision: l.comision, extras: l.total_extras, extras_detalle: l.extras, total: l.total, nuevos: l.nuevos, horas: l.horas };
    });
    const cob = liqCoberturasDe(coberturas, u.dni, mes);
    const actual = liqCalcular(u.sede, propias.find(f => f.mes === mes) || null, previaDe(mes), config(mes), nuevosApp(u.dni, mes), cob.ajuste);
    const dias = liqDiasDe(filas, u.dni);
    return {
      dni: u.dni, nombre: u.nombre, sede: u.sede, turno: u.turno,
      liquidacion: actual, serie: serie, dias_horas: dias,
      qr: liqHorasQr(qr.filter(f => f.dni === u.dni), dias, mes, hoy, cob.omitir),
      coberturas: cob.lista.map(c => ({ id: c.id, fecha: c.fecha, horas: Number(c.horas) || 0, rol: c.cubre_dni === u.dni ? 'cubrio' : 'cubierta', con: nombreDe(c.cubre_dni === u.dni ? c.titular_dni : c.cubre_dni), descuenta: c.descuenta !== 'false', motivo: c.motivo })).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    };
  }).sort((a, b) => String(a.sede).localeCompare(String(b.sede)) || String(a.nombre).localeCompare(String(b.nombre)));
  const todos = {};
  filas.forEach(f => { if (/^\d{4}-\d{2}$/.test(f.mes) && f.dni !== '*') todos[f.mes] = 1; });
  todos[hoy.slice(0, 7)] = 1; todos[mes] = 1;
  const actualizado = qr.reduce((a, f) => (f.actualizado > a ? f.actualizado : a), '');
  return {
    mes: mes, hoy: hoy, puede_editar: admin, personas: personas, meses: Object.keys(todos).sort(),
    config: config(mes), conceptos: LIQ_CONCEPTOS, etiquetas: LIQ_ETIQUETAS, qr_actualizado: actualizado,
  };
}

function exigirAdminLiq(req, deps) {
  const s = sesion(req, deps);
  if (!tieneRol(s.usuario, 'admin')) falla('prohibido');
  return s;
}

function liqGuardarFila(deps, dni, mes, datos) {
  const filas = deps.repo.leer('liquidacion').filter(f => !(f.dni === dni && f.mes === mes));
  filas.push({ dni: dni, mes: mes, datos: JSON.stringify(datos), actualizado: new Date(deps.ahora()).toISOString() });
  deps.repo.escribir('liquidacion', filas);
}

function liquidacionGuardar(req, deps) {
  const { usuarios } = exigirAdminLiq(req, deps);
  const dni = normalizarDni(req.dni), mes = liqMes(req.mes), d = req.datos;
  if (!mes || !d || typeof d !== 'object' || !usuarios.some(u => u.dni === dni)) falla('datos_invalidos');
  const extras = Array.isArray(d.extras) ? d.extras : [];
  if (extras.length > 30) falla('datos_invalidos');
  const datos = {
    valor_hora: liqNumero(d.valor_hora, 0, 1000000),
    horas: liqNumero(d.horas, 0, 500),
    nuevos: liqNumero(d.nuevos, 0, 1000),
    comision: liqNumero(d.comision, 0, 100000000),
    extras: extras.map(x => {
      const c = texto(x && x.c).slice(0, 40);
      const m = liqNumero(x && x.m, -100000000, 100000000);
      if (!c || m == null) falla('datos_invalidos');
      return { c: c, m: m };
    }),
    nota: texto(d.nota).slice(0, 300),
  };
  if (Array.isArray(d.metas) && d.metas.length === 4) datos.metas = d.metas.map(x => liqNumero(x, 0, 1000));
  liqGuardarFila(deps, dni, mes, datos);
  return {};
}

function liquidacionConfigGuardar(req, deps) {
  exigirAdminLiq(req, deps);
  const mes = liqMes(req.mes);
  if (!mes || !Array.isArray(req.tarifas) || req.tarifas.length !== 4 || !req.metas || typeof req.metas !== 'object') falla('datos_invalidos');
  const metas = {};
  Object.keys(LIQ_METAS_BASE).forEach(s => {
    const m = req.metas[s];
    if (m == null || (Array.isArray(m) && !m.length)) { metas[s] = []; return; }
    if (!Array.isArray(m) || m.length !== 4) falla('datos_invalidos');
    metas[s] = m.map(x => liqNumero(x, 0, 1000));
  });
  liqGuardarFila(deps, '*', mes, { tarifas: req.tarifas.map(x => liqNumero(x, 0, 1000000)), metas: metas });
  return {};
}

function liquidacionHorasGuardar(req, deps) {
  const { usuarios } = exigirAdminLiq(req, deps);
  const dni = normalizarDni(req.dni);
  if (!usuarios.some(u => u.dni === dni) || !Array.isArray(req.dias) || req.dias.length !== 7) falla('datos_invalidos');
  liqGuardarFila(deps, dni, 'horas', { dias: req.dias.map(x => liqNumero(x, 0, 16) || 0) });
  return {};
}

// Lo que sube la PC. Por defecto no pisa lo que coordinación ya tocó: solo agrega los meses que faltan.
function cargarLiquidacion(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas) || req.filas.length > LIQ_FILAS_MAX) falla('datos_invalidos');
  const filas = deps.repo.leer('liquidacion');
  const ts = new Date(deps.ahora()).toISOString();
  let nuevas = 0, pisadas = 0;
  req.filas.forEach(f => {
    const dni = texto(f && f.dni), mes = texto(f && f.mes);
    if (!dni || !(liqMes(mes) || mes === 'horas' || (dni === '*' && liqMes(mes))) || !f.datos || typeof f.datos !== 'object') falla('datos_invalidos');
    const i = filas.findIndex(x => x.dni === dni && x.mes === mes);
    if (i >= 0 && !req.pisar) return;
    const fila = { dni: dni, mes: mes, datos: JSON.stringify(f.datos), actualizado: ts };
    if (i >= 0) { filas[i] = fila; pisadas++; } else { filas.push(fila); nuevas++; }
  });
  deps.repo.escribir('liquidacion', filas);
  return { nuevas: nuevas, pisadas: pisadas };
}

// Ingresos por QR de cada día (primera entrada y última salida). Reemplaza lo de esos mismos días.
function cargarLiqQr(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas) || req.filas.length > LIQ_FILAS_MAX) falla('datos_invalidos');
  const nuevas = req.filas.map(f => {
    const dni = texto(f && f.dni), fecha = liqFecha(f && f.fecha);
    if (!dni || !fecha) falla('datos_invalidos');
    return { dni: dni, fecha: fecha, entrada: liqHora(f.entrada), salida: liqHora(f.salida), n: String(Number(f.n) || 0) };
  });
  const clave = f => f.dni + '|' + f.fecha;
  const pisan = {};
  nuevas.forEach(f => { pisan[clave(f)] = 1; });
  const ts = new Date(deps.ahora()).toISOString();
  const quedan = deps.repo.leer('liq_qr').filter(f => !pisan[clave(f)]);
  nuevas.forEach(f => quedan.push(Object.assign(f, { actualizado: ts })));
  deps.repo.escribir('liq_qr', quedan);
  return { filas: nuevas.length };
}

// ---------- Coberturas y cambios de turno ----------

function exigirCoordinacionCob(req, deps) {
  const s = sesion(req, deps);
  if (!tieneRol(s.usuario, 'admin') && !tieneRol(s.usuario, 'coordinador')) falla('prohibido');
  return s;
}

// Admin: todas las sedes. Coordinación: solo su sede.
function liqPuedeConCob(usuario, a, b) {
  if (tieneRol(usuario, 'admin')) return true;
  return [a, b].every(u => !u || u.sede === usuario.sede);
}

function coberturasVer(req, deps) {
  const { usuario, usuarios } = exigirCoordinacionCob(req, deps);
  const hoy = deps.hoy();
  const mes = liqMes(req.mes) || hoy.slice(0, 7);
  const admin = tieneRol(usuario, 'admin');
  const equipo = liqRecepcionistas(usuarios).filter(u => admin || u.sede === usuario.sede);
  const filas = deps.repo.leer('liquidacion');
  const dnis = {};
  equipo.forEach(u => { dnis[u.dni] = 1; });
  const nombreDe = dni => ((usuarios.find(u => u.dni === dni) || {}).nombre) || '';
  const lista = deps.repo.leer('coberturas').filter(c => texto(c.fecha).slice(0, 7) === mes && (dnis[c.cubre_dni] || dnis[c.titular_dni]))
    .map(c => ({ id: c.id, fecha: c.fecha, titular_dni: c.titular_dni, titular: nombreDe(c.titular_dni), cubre_dni: c.cubre_dni, cubre: nombreDe(c.cubre_dni), horas: Number(c.horas) || 0, descuenta: c.descuenta !== 'false', motivo: c.motivo, nota: c.nota }))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return { mes: mes, hoy: hoy, coberturas: lista, motivos: LIQ_MOTIVOS_COB, personas: equipo.map(u => ({ dni: u.dni, nombre: u.nombre, sede: u.sede, dias: liqDiasDe(filas, u.dni) })) };
}

const LIQ_MOTIVOS_COB = ['Faltó', 'Enfermedad', 'Cambio de horario', 'Cubre un extra', 'Otro'];

function coberturaGuardar(req, deps) {
  const { usuario, usuarios } = exigirCoordinacionCob(req, deps);
  const fecha = liqFecha(req.fecha);
  const cubre = usuarios.find(u => u.dni === normalizarDni(req.cubre_dni) && esVerdad(u.activo) && tieneRol(u, 'recepcion'));
  const titularDni = texto(req.titular_dni) ? normalizarDni(req.titular_dni) : '';
  const titular = titularDni ? usuarios.find(u => u.dni === titularDni && tieneRol(u, 'recepcion')) : null;
  const horas = liqNumero(req.horas, 0.5, 16);
  if (!fecha || !cubre || (titularDni && !titular) || horas == null || (titular && titular.dni === cubre.dni)) falla('datos_invalidos');
  if (!liqPuedeConCob(usuario, cubre, titular)) falla('prohibido');
  const motivo = LIQ_MOTIVOS_COB.indexOf(texto(req.motivo)) >= 0 ? texto(req.motivo) : 'Otro';
  const filas = deps.repo.leer('coberturas');
  const id = texto(req.id);
  const fila = {
    id: id || 'C-' + deps.aleatorio(6), fecha: fecha, titular_dni: titular ? titular.dni : '', cubre_dni: cubre.dni, horas: String(horas),
    descuenta: req.descuenta === false || req.descuenta === 'false' ? 'false' : 'true', motivo: motivo, nota: texto(req.nota).slice(0, 200),
    creado_por: usuario.dni, actualizado: new Date(deps.ahora()).toISOString(),
  };
  if (id) {
    const i = filas.findIndex(c => c.id === id);
    if (i < 0) falla('no_encontrado');
    filas[i] = fila;
  } else filas.push(fila);
  deps.repo.escribir('coberturas', filas);
  return { id: fila.id };
}

function coberturaBorrar(req, deps) {
  const { usuario, usuarios } = exigirCoordinacionCob(req, deps);
  const filas = deps.repo.leer('coberturas');
  const c = filas.find(x => x.id === texto(req.id));
  if (!c) falla('no_encontrado');
  const u = dni => usuarios.find(x => x.dni === dni);
  if (!liqPuedeConCob(usuario, u(c.cubre_dni), u(c.titular_dni))) falla('prohibido');
  deps.repo.escribir('coberturas', filas.filter(x => x.id !== c.id));
  return {};
}

// PulsoMOVE · Liquidación de profes y de kinesiología (Emanuel, 24-25/11/2026). Reemplaza el sueldo y la comisión de la pestaña
// "Objetivos" de las planillas Excel (filas 15 a 26) y las pestañas mensuales de kinesiología.
// Reglas aprobadas:
//  - Período del mes M = pagos del 6 de M al 5 de M+1. Se cuenta por pago (quien paga tarde y vuelve a pagar a tiempo dentro del
//    mismo período cuenta dos veces). El día 5 se cierra; "liquidada" es una marca de coordinación con admin.
//  - Al profe solo le paga la RENOVACIÓN: comisión = valor(nivel) × (RENUEVA + 2·X2 + LIBERADO). Los socios nuevos se liquidan a
//    recepción, nunca al profe, pero SÍ suman a los activos que definen el nivel (Emanuel, 25/11; se puede apagar en la configuración).
//    Activos = NUEVO + RENUEVA + 2·X2 + LIBERADO.
//  - Planes de 3 meses o más: una renovación por cada mes que cubre. El mes del pago no pide asistencia; del 2.º en adelante cuenta solo si
//    el socio entrenó en ese período; si no registra, queda «sin asistencia registrada» y admin puede marcar «sí entrenó» (el QR a veces
//    falla). Queda el historial. SUPUESTO a confirmar.
//  - Una sola estructura para todos los profesionales (profes y kinesiología): mismos conceptos y pantalla. Por persona cambian el valor hora
//    y los objetivos: si tiene metas propias se usan; si están vacías, ROUNDDOWN(horas por semana × 41 / 50 / 60 ÷ 30).
//  - Kinesiología: además, cada sesión (SESIÓN 0 / X1 / X1 M / X2 / X2 M / X3 / X3 M; M = sesión Move) × la tarifa del mes y las plantillas.
// Quién ve qué: cada profe o kinesiólogo ve SOLO lo suyo; coordinación ve a todos pero sin plata; admin ve y edita todo.
// Los valores reales (valor por hora, valores por nivel, metas, tarifas) NO están en este repositorio: viven en la hoja `liqpro`
// (tipo 'config') que edita admin. Sin esos valores la pantalla lo avisa y la plata queda en cero.

const LP_FACTORES = [40, 41, 50, 60];                       // metas de los profes: horas × factor ÷ 30 (el nivel usa de la 2.ª en adelante)
const LP_SESION_TIPOS = ['SESIÓN 0', 'X1', 'X1 M', 'X2', 'X2 M', 'X3', 'X3 M'];
const LP_SUMAN = ['Aguinaldo / extra', 'Horas extra / clases', 'Online', 'Coordinación', 'Informes', 'Otro'];
const LP_RESTAN = ['Permiso no retribuido', 'Consumo staff', 'Fiado'];
const LP_MULT_SABADO = 4;                                   // cada sábado trabajado vale 4 horas (planilla)
const LP_DIA_PERIODO = 6;                                   // el período arranca el 6 y cierra el 5 del mes siguiente
const LP_LISTA_MAX = 150;
const LP_SESIONES_MAX = 3000;

// ---------- Período y estado ----------

function lpMesSiguiente(mes) {
  const a = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0');
}

// Pagos del 6 de M al 5 de M+1
function lpPeriodo(mes) {
  return { desde: mes + '-' + String(LP_DIA_PERIODO).padStart(2, '0'), hasta: lpMesSiguiente(mes) + '-' + String(LP_DIA_PERIODO - 1).padStart(2, '0') };
}

// El período al que pertenece una fecha: del 6 en adelante es el mes de la fecha; antes del 6, el anterior
function lpPeriodoDe(fecha) {
  const f = String(fecha).slice(0, 10), mes = f.slice(0, 7);
  if (Number(f.slice(8, 10)) >= LP_DIA_PERIODO) return mes;
  const a = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  return m === 1 ? (a - 1) + '-12' : a + '-' + String(m - 1).padStart(2, '0');
}

// 'en_curso' hasta el día 5 inclusive, 'cerrada' después, 'liquidada' cuando admin la marcó
function lpEstadoDe(mes, hoy, liquidada) {
  if (liquidada) return 'liquidada';
  return hoy <= lpPeriodo(mes).hasta ? 'en_curso' : 'cerrada';
}

// ---------- Configuración y datos por persona (hoja liqpro: mes, dni, tipo, id, datos) ----------

function lpFilas(deps) {
  return deps.repo.leer('liqpro');
}

function lpConfigDelMes(filas, mes) {
  const cargadas = filas.filter(f => f.tipo === 'config' && f.dni === '*' && /^\d{4}-\d{2}$/.test(f.mes) && f.mes <= mes).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
  const d = cargadas.length ? liqJson(cargadas[cargadas.length - 1].datos) : {};
  const nums = (v, n) => (Array.isArray(v) && v.length === n ? v.map(Number) : null);
  return {
    valores: nums(d.valores, 4), factores: nums(d.factores, 4) || LP_FACTORES.slice(),
    tarifas: d.tarifas && typeof d.tarifas === 'object' ? d.tarifas : {},
    valor_plantilla: d.valor_plantilla != null && d.valor_plantilla !== '' ? Number(d.valor_plantilla) : null,
    sabado_mult: d.sabado_mult != null && d.sabado_mult !== '' ? Number(d.sabado_mult) : LP_MULT_SABADO,
    nuevos_en_activos: !(d.nuevos_en_activos === false || d.nuevos_en_activos === 'false'),   // encendido salvo que admin lo apague
    desde: cargadas.length ? cargadas[cargadas.length - 1].mes : '',
  };
}

const LP_HEREDA = ['tipo', 'valor_hora', 'horas_mes', 'horas_semana', 'metas', 'valores', 'monotributo', 'valor_plantilla', 'tarifas'];

// Tarifa de sesión: la propia de la persona manda; lo que no tiene, sale de la del mes (cada kine cobra distinto, 26/11/2026)
function lpTarifas(cfg, p) {
  return Object.assign({}, cfg.tarifas || {}, (p && p.tarifas) || {});
}

function lpTarifasDe(t) {
  const out = {};
  const o = t && typeof t === 'object' ? t : {};
  Object.keys(o).forEach(k => { if (LP_SESION_TIPOS.indexOf(k) < 0) falla('datos_invalidos'); const n = liqNumero(o[k], 0, 10000000); if (n != null) out[k] = n; });
  return out;
}

// Lo de una persona en un mes: lo que se hereda (valor hora, horas, metas…) sale de la última carga hasta ese mes;
// lo propio del mes (HOME, sábados, extras, plantillas…) solo del mes mismo.
function lpPersonaDelMes(filas, dni, mes) {
  const propias = filas.filter(f => f.tipo === 'persona' && f.dni === dni && /^\d{4}-\d{2}$/.test(f.mes)).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
  const out = { cargado: false, heredado_de: '' };
  propias.filter(f => f.mes <= mes).forEach(f => {
    const d = liqJson(f.datos);
    LP_HEREDA.forEach(k => { if (d[k] != null && d[k] !== '') { out[k] = d[k]; if (f.mes < mes) out.heredado_de = f.mes; } });
  });
  const exacta = propias.find(f => f.mes === mes);
  if (exacta) {
    const d = liqJson(exacta.datos);
    out.cargado = true;
    ['home_horas', 'sabados', 'plantillas', 'extras', 'socios_manual', 'comision_manual', 'nota'].forEach(k => { if (d[k] != null) out[k] = d[k]; });
  }
  return out;
}

function lpEtiquetas(n) {
  const out = ['No alcanzado'];
  for (let i = 1; i < n - 1; i++) out.push('Objetivo ' + i);
  if (n > 1) out.push('Máximo');
  return out;
}

// Nivel según las metas: la 1.ª no cuenta (es el piso); desde la 2.ª, cada meta alcanzada sube un nivel
function lpNivel(activos, metas) {
  if (!Array.isArray(metas) || metas.length < 2) return null;
  let n = 0;
  for (let i = 1; i < metas.length; i++) if (activos >= metas[i]) n = i;
  return n;
}

function lpMetasDe(p, cfg) {
  if (Array.isArray(p.metas) && p.metas.length >= 2) return { metas: p.metas.map(Number), fijas: true };
  const hs = Number(p.horas_semana);
  if (hs > 0) return { metas: cfg.factores.map(f => Math.floor(hs * f / 30)), fijas: false };
  return { metas: null, fijas: false };
}

function lpNum(v) {
  return v == null || v === '' ? 0 : Number(v) || 0;
}

function lpPlata(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

// Los movimientos del período de un profe: lo que sube la PC por pagos (liqpro_mov) y, si todavía no hay, el mes calendario de la comisión vieja
function lpMovDe(deps, u, mes) {
  const f = deps.repo.leer('liqpro_mov').find(x => x.periodo === mes && (x.profe_dni === u.dni || (!x.profe_dni && mismoProfe(x.profe, u.nombre))));
  if (f) {
    const d = leerJson(f.datos, {});
    return { fuente: 'periodo', renovaciones: lpNum(d.renovaciones), x2: lpNum(d.x2), liberados: lpNum(d.liberados), nuevos: lpNum(d.nuevos), online: lpNum(d.online),
      lista: Array.isArray(d.lista) ? d.lista.slice(0, LP_LISTA_MAX) : [], sin_asistencia: Array.isArray(d.sin_asistencia) ? d.sin_asistencia.slice(0, LP_LISTA_MAX) : [], datos_hasta: d.datos_hasta || f.cargada || '', parcial: !!d.parcial, avisos: d.avisos || [] };
  }
  const v = deps.repo.leer('profe_liq').find(x => x.mes === mes && ((x.profe_dni && x.profe_dni === u.dni) || (!x.profe_dni && mismoProfe(x.profe, u.nombre))));
  if (v) {
    const d = leerJson(v.datos, {});
    return { fuente: 'mes_calendario', renovaciones: lpNum(d.renovaciones), x2: 0, liberados: lpNum(d.liberados), nuevos: lpNum(d.nuevos), online: lpNum(d.online),
      lista: (Array.isArray(d.renov_lista) ? d.renov_lista : []).slice(0, LP_LISTA_MAX).map(x => ({ nombre: x.nombre, tipo: x.tipo })), sin_asistencia: [], datos_hasta: d.datos_hasta || '', parcial: !!d.parcial, avisos: [] };
  }
  return null;
}

// Meses de planes largos sin asistencia que admin marcó «sí entrenó»: pasan a contar. Si después la PC ve la asistencia, el mes deja de
// estar en la lista y ya viene contado, así que no se suma dos veces.
function lpMovConMarcas(mov, filas, dni, mes) {
  if (!mov) return null;
  const marcas = {};
  filas.filter(f => f.tipo === 'entreno' && f.dni === dni && f.mes === mes).forEach(f => { marcas[f.id] = liqJson(f.datos); });
  const sin = (mov.sin_asistencia || []).map(x => {
    const m = marcas[x.clave] || {};
    return { clave: x.clave, nombre: x.nombre, mes: x.mes, de: x.de, marcado: !!m.entreno, historial: m.historial || [] };
  });
  return Object.assign({}, mov, { sin_asistencia: sin, entreno_manual: sin.filter(x => x.marcado).length });
}

// Sábados que le tocaron en el mes (rotación de coordinación), salvo feriados que no se trabajan
function lpSabadosAuto(deps, dni, mes) {
  const noSeTrabaja = {};
  deps.repo.leer('profe_feriados').forEach(f => { if (f.se_trabaja === 'false' && f.borrado !== 'true') noSeTrabaja[f.fecha] = 1; });
  return deps.repo.leer('profe_sabados').filter(s => s.profe_dni === dni && String(s.fecha).slice(0, 7) === mes && !noSeTrabaja[s.fecha]).length;
}

// ---------- El cálculo (puro) ----------
// entrada: { p (persona del mes), cfg, mov (o null), sesiones (lista del mes), sabados_auto, reemplazos (de reemplazosDe) }
// Cada línea trae `como`: la cuenta hecha, para que el profe entienda y pueda reclamar.
function lpCalcular(e) {
  const p = e.p, cfg = e.cfg, mov = e.mov;
  const tipo = p.tipo === 'kine' ? 'kine' : 'profe';
  const vh = lpNum(p.valor_hora);
  const horas = lpNum(p.horas_mes), home = lpNum(p.home_horas);
  const sabAuto = e.sabados_auto || 0;
  const sab = p.sabados != null && p.sabados !== '' ? lpNum(p.sabados) : sabAuto;
  const lineas = [];
  const faltan = [];
  if (!vh) faltan.push('el valor por hora');
  const linea = (k, t, grupo, monto, como, extra) => lineas.push(Object.assign({ k: k, t: t, grupo: grupo, monto: Math.round(monto), como: como }, extra || {}));
  linea('horas', 'Horas del mes', 'horas', horas * vh, `${liqRedondeo(horas, 2)} h × ${lpPlata(vh)}`, { cant: horas });
  if (home) linea('home', 'Horas extra HOME', 'horas', home * vh, `${liqRedondeo(home, 2)} h × ${lpPlata(vh)}`, { cant: home });
  if (sab) linea('sabados', 'Sábados trabajados', 'horas', sab * cfg.sabado_mult * vh, `${sab} ${sab === 1 ? 'sábado' : 'sábados'} × ${cfg.sabado_mult} h × ${lpPlata(vh)}${p.sabados != null && p.sabados !== '' ? '' : ' (según la rotación de sábados)'}`, { cant: sab });
  // Reemplazos (vacaciones y licencias de otros): salen solos de lo que cargó coordinación, a su valor hora
  (e.reemplazos || []).forEach((r, i) => {
    const dias = r.dias.map(f => f.slice(8, 10) + '/' + f.slice(5, 7));
    const cuales = dias.length <= 6 ? dias.join(', ') : 'del ' + dias[0] + ' al ' + dias[dias.length - 1];
    linea('reemplazo' + i, 'Reemplazaste a ' + r.profe, 'horas', r.horas * vh, `${String(r.horas).replace('.', ',')} h en ${dias.length} ${dias.length === 1 ? 'día' : 'días'} (${cuales}) × ${lpPlata(vh)}`, { cant: r.horas });
  });
  const base = lineas.reduce((a, l) => a + l.monto, 0);

  // Comisión por renovaciones
  const renov = mov ? mov.renovaciones : 0, x2 = mov ? mov.x2 : 0, lib = mov ? mov.liberados : 0, nuevos = mov ? mov.nuevos : 0;
  const manual = p.socios_manual && typeof p.socios_manual === 'object' ? p.socios_manual : null;
  const marcados = mov ? mov.entreno_manual || 0 : 0;                                  // «sí entrenó», marcado por admin
  const pendientes = mov ? (mov.sin_asistencia || []).filter(x => !x.marcado).length : 0;
  const cobran = manual && manual.cobran != null && manual.cobran !== '' ? Number(manual.cobran) : renov + 2 * x2 + lib + marcados;
  const activos = manual && manual.activos != null && manual.activos !== '' ? Number(manual.activos) : renov + 2 * x2 + lib + marcados + (cfg.nuevos_en_activos ? nuevos : 0);
  const M = lpMetasDe(p, cfg);
  const nivel = M.metas ? lpNivel(activos, M.metas) : null;
  const valores = Array.isArray(p.valores) && M.metas && p.valores.length === M.metas.length ? p.valores.map(Number) : (cfg.valores && M.metas && cfg.valores.length === M.metas.length ? cfg.valores : null);
  const etiquetas = M.metas ? lpEtiquetas(M.metas.length) : [];
  const valorNivel = nivel != null && valores ? valores[nivel] : null;
  const calculada = valorNivel == null ? null : Math.round(valorNivel * cobran);
  const comManual = p.comision_manual != null && p.comision_manual !== '';
  const comision = comManual ? Number(p.comision_manual) : (calculada == null ? 0 : calculada);
  if (!M.metas) faltan.push('las horas por semana (para las metas) o metas propias');
  else if (!valores) faltan.push('el valor por socio de cada nivel');
  const comoCom = comManual ? 'Cargada a mano por coordinación' + (calculada != null ? ` (con la regla daría ${lpPlata(calculada)})` : '')
    : valorNivel == null ? 'Falta cargar metas o valores por nivel'
    : `${cobran} socios × ${lpPlata(valorNivel)} (${etiquetas[nivel]})${marcados && !(manual && manual.cobran != null) ? `, con ${marcados} ${marcados === 1 ? 'marcado' : 'marcados'} «sí entrenó»` : ''}`;
  linea('comision', 'Comisión por renovaciones', 'comision', comision, comoCom, { cant: cobran });
  if (pendientes) linea('sin_asistencia', 'Sin asistencia registrada (plan de 3 meses o más)', 'comision', 0,
    `${pendientes} ${pendientes === 1 ? 'mes' : 'meses'} de plan sin asistencia en el período: no se paga salvo que coordinación marque «sí entrenó»`, { cant: pendientes });

  // Kinesiología: sesiones y plantillas
  const sesiones = (e.sesiones || []).filter(s => s.estado !== 'anulada');
  const tarifasP = lpTarifas(cfg, p);
  const porTipo = LP_SESION_TIPOS.map(t => {
    const n = sesiones.filter(s => s.tipo === t).length;
    const tarifa = tarifasP[t] != null && tarifasP[t] !== '' ? Number(tarifasP[t]) : null;
    return { tipo: t, n: n, tarifa: tarifa, monto: tarifa == null ? 0 : Math.round(n * tarifa) };
  });
  if (tipo === 'kine') {
    porTipo.filter(x => x.n).forEach(x => {
      linea('ses:' + x.tipo, 'Sesiones ' + x.tipo, 'sesiones', x.monto, x.tarifa == null ? `${x.n} × tarifa sin cargar` : `${x.n} × ${lpPlata(x.tarifa)}`, { cant: x.n });
      if (x.tarifa == null) faltan.push('la tarifa de ' + x.tipo);
    });
    const pl = lpNum(p.plantillas);
    if (pl) {
      if (cfg.valor_plantilla == null) faltan.push('el valor de la plantilla');
      linea('plantillas', 'Plantillas', 'sesiones', pl * lpNum(cfg.valor_plantilla), `${pl} × ${lpPlata(lpNum(cfg.valor_plantilla))}`, { cant: pl });
    }
  }
  // Conceptos manuales: los que suman y los descuentos (siempre restan)
  (Array.isArray(p.extras) ? p.extras : []).forEach((x, i) => {
    const c = texto(x && x.c), m = Number(x && x.m) || 0;
    if (!c || !m) return;
    const resta = LP_RESTAN.indexOf(c) >= 0;
    linea('x' + i, c, resta ? 'descuentos' : 'extras', resta ? -Math.abs(m) : m, resta ? 'Descuento cargado por coordinación' : 'Cargado por coordinación');
  });
  const mono = lpNum(p.monotributo);
  if (mono) linea('monotributo', 'Monotributo', 'extras', mono, 'Monto fijo mensual');
  const total = lineas.reduce((a, l) => a + l.monto, 0);
  const sub = g => lineas.filter(l => l.grupo === g).reduce((a, l) => a + l.monto, 0);
  return {
    tipo: tipo, valor_hora: vh, horas: horas, home_horas: home, sabados: sab, sabados_auto: sabAuto, sabado_mult: cfg.sabado_mult,
    renovaciones: renov, x2: x2, liberados: lib, nuevos: nuevos, online: mov ? mov.online : 0, cobran: cobran, activos: activos,
    nuevos_en_activos: cfg.nuevos_en_activos, marcados_entreno: marcados, sin_asistencia: pendientes, metas: M.metas, metas_fijas: M.fijas, factores: M.fijas ? null : cfg.factores, nivel: nivel, etiqueta: nivel == null ? '' : etiquetas[nivel], etiquetas: etiquetas,
    valores: valores, valor_nivel: valorNivel, faltan_siguiente: M.metas && nivel != null && nivel < M.metas.length - 1 ? Math.max(0, M.metas[nivel + 1] - activos) : 0,
    comision_calculada: calculada, comision_manual: comManual,
    sesiones: porTipo, plantillas: lpNum(p.plantillas),
    lineas: lineas, base: base, subtotales: { horas: sub('horas'), comision: sub('comision'), sesiones: sub('sesiones'), extras: sub('extras'), descuentos: sub('descuentos') },
    total: total, faltan: faltan.filter((x, i, a) => a.indexOf(x) === i), nota: texto(p.nota),
  };
}

// Lo que ve quien no es admin cuando mira a otra persona (coordinación): cantidades y niveles, nunca plata
function lpSinMontos(l) {
  return {
    tipo: l.tipo, horas: l.horas, home_horas: l.home_horas, sabados: l.sabados, renovaciones: l.renovaciones, x2: l.x2, liberados: l.liberados, nuevos: l.nuevos,
    online: l.online, cobran: l.cobran, nuevos_en_activos: l.nuevos_en_activos, marcados_entreno: l.marcados_entreno, sin_asistencia: l.sin_asistencia, metas_fijas: l.metas_fijas, activos: l.activos, metas: l.metas, nivel: l.nivel, etiqueta: l.etiqueta, etiquetas: l.etiquetas, faltan_siguiente: l.faltan_siguiente,
    sesiones: l.sesiones.map(s => ({ tipo: s.tipo, n: s.n })), plantillas: l.plantillas,
    lineas: l.lineas.map(x => ({ k: x.k, t: x.t, grupo: x.grupo, cant: x.cant })), sin_montos: true,
  };
}

// ---------- Objetivos del profesional (sin plata: son puntos) ----------

function lpObjetivos(deps, u, mes, hoy, l) {
  const fila = deps.repo.leer('profe_estado').find(x => x.tipo !== 'sede' && mismoProfe(x.nombre, u.nombre));
  const datos = fila ? leerJson(fila.datos, {}) : {};
  const d = datos[mes] || {};
  const d3 = desercion3Meses(datos, mes);
  let tareas = null;
  try { tareas = tareasMesDeDni(deps, u.dni, mes, hoy); } catch (e) { tareas = null; }
  const m = {
    nivel: l.nivel, desercion: d.desercion != null ? d.desercion : null, desercion_3m: d3.desercion, tareas_pct: tareas ? tareas.pct : null,
    reeval_pct: d.reeval != null ? d.reeval : null, reeval_n: d.reeval != null && d.activos ? Math.round(d.reeval * d.activos / 100) : null, perfil_pct: d.perfil != null ? d.perfil : null,
  };
  const pun = puntajeObjetivos(m);
  const tramos = l.metas ? l.metas.map((meta, i) => ({ etiqueta: l.etiquetas[i], meta: meta, puntos: OBJ_ACTIVOS_PTS[Math.min(i, OBJ_ACTIVOS_PTS.length - 1)] })) : [];
  return {
    activos: { valor: l.activos, nivel: l.nivel, etiqueta: l.etiqueta, metas: l.metas, tramos: tramos, faltan_siguiente: l.faltan_siguiente, puntos: pun.puntos.activos },
    desercion: { promedio_3m: d3.desercion, bajas: d3.bajas, vencian: d3.vencian, meses: d3.meses, motivo: d3.motivo, tramos: OBJ_DESERCION_TXT, puntos: pun.puntos.desercion },
    tareas: { pct: m.tareas_pct, puntos: pun.puntos.tareas, hechas: tareas ? tareas.hechas : null, total: tareas ? tareas.total : null },
    reeval: { pct: m.reeval_pct, n: m.reeval_n, puntos: pun.puntos.reeval }, perfil: { pct: m.perfil_pct, puntos: pun.puntos.perfil },
    total_puntos: pun.total, mensaje: pun.mensaje, aclaracion: 'Los puntos no se pagan: son el puntaje de objetivos (la comisión depende solo del nivel de activos).',
  };
}

// ---------- Sesiones de kinesiología ----------

function lpSesionesDe(deps, dni, mes) {
  return deps.repo.leer('liqpro_sesiones').filter(s => s.kine_dni === dni && String(s.fecha).slice(0, 7) === mes);
}

function lpClavePaciente(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function lpVistaSesion(s) {
  return { id: s.id, fecha: s.fecha, paciente: s.paciente, tipo: s.tipo, estado: s.estado, nota: s.nota };
}

function lpBloqueSesiones(deps, dni, mes, cfg, verMontos) {
  const lista = lpSesionesDe(deps, dni, mes).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.paciente).localeCompare(String(b.paciente)));
  const pacientes = [];
  deps.repo.leer('liqpro_sesiones').filter(s => s.kine_dni === dni).forEach(s => { if (pacientes.indexOf(s.paciente) < 0) pacientes.push(s.paciente); });
  const tarifasP = lpTarifas(cfg, lpPersonaDelMes(lpFilas(deps), dni, mes));
  const resumen = LP_SESION_TIPOS.map(t => {
    const n = lista.filter(s => s.tipo === t).length;
    const tarifa = tarifasP[t] != null && tarifasP[t] !== '' ? Number(tarifasP[t]) : null;
    return verMontos ? { tipo: t, n: n, tarifa: tarifa, monto: tarifa == null ? 0 : Math.round(n * tarifa) } : { tipo: t, n: n };
  });
  return { mes: mes, dias: liqDiasDelMes(mes), tipos: LP_SESION_TIPOS, lista: lista.map(lpVistaSesion), pacientes: pacientes.sort(), resumen: resumen,
    sin_confirmar: lista.filter(s => s.estado === 'importada').length };
}

// ---------- Ver ----------

function lpPersonasVisibles(usuario, usuarios) {
  const profes = usuarios.filter(u => esVerdad(u.activo) && esProfe(u));
  if (tieneRol(usuario, 'admin') || tieneRol(usuario, 'coordinador')) return profes;
  return esProfe(usuario) ? [usuario] : [];
}

function lpReclamosDe(filas, dni, mes) {
  return filas.filter(f => f.tipo === 'reclamo' && f.dni === dni && f.mes === mes).map(f => Object.assign({ id: f.id }, liqJson(f.datos))).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

function liqproVer(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const admin = tieneRol(usuario, 'admin'), coord = tieneRol(usuario, 'coordinador');
  const visibles = lpPersonasVisibles(usuario, usuarios);
  if (!visibles.length) falla('prohibido');
  const pedido = texto(req.dni) ? normalizarDni(req.dni) : '';
  if (pedido && !visibles.some(u => u.dni === pedido)) falla('prohibido');
  const hoy = deps.hoy();
  const mes = liqMes(req.mes) || lpPeriodoDe(hoy);
  const filas = lpFilas(deps);
  const cfg = lpConfigDelMes(filas, mes);
  const estadoFila = filas.find(f => f.tipo === 'estado' && f.dni === '*' && f.mes === mes);
  const liquidada = estadoFila ? liqJson(estadoFila.datos) : null;
  const estado = lpEstadoDe(mes, hoy, !!(liquidada && liquidada.liquidada));
  const lista = (pedido ? visibles.filter(u => u.dni === pedido) : visibles);
  const personas = lista.map(u => {
    const propio = u.dni === usuario.dni;
    const verMontos = admin || propio;
    const p = lpPersonaDelMes(filas, u.dni, mes);
    const mov = lpMovConMarcas(lpMovDe(deps, u, mes), filas, u.dni, mes);
    const sesAll = lpSesionesDe(deps, u.dni, mes);
    const calc = lpCalcular({ p: p, cfg: cfg, mov: mov, sesiones: sesAll, sabados_auto: lpSabadosAuto(deps, u.dni, mes), reemplazos: reemplazosDe(deps, u.dni, mes) });
    const cierre = filas.find(f => f.tipo === 'cierre' && f.dni === u.dni && f.mes === mes);
    const congelada = estado === 'liquidada' && cierre ? liqJson(cierre.datos) : null;
    const liq = congelada && congelada.liq ? congelada.liq : calc;
    const out = {
      dni: u.dni, nombre: u.nombre, sede: u.sede, tipo: calc.tipo, propio: propio, cargado: p.cargado, heredado_de: p.heredado_de,
      liquidacion: verMontos ? liq : lpSinMontos(liq), congelada: !!congelada,
      mov: mov ? { fuente: mov.fuente, datos_hasta: mov.datos_hasta, parcial: mov.parcial, avisos: mov.avisos, online: mov.online, nuevos: mov.nuevos,
        lista: verMontos || coord ? mov.lista : [], sin_asistencia: verMontos || coord ? mov.sin_asistencia : [] } : null,
      objetivos: lpObjetivos(deps, u, mes, hoy, liq),
      reclamos: verMontos ? lpReclamosDe(filas, u.dni, mes) : [],
    };
    if (calc.tipo === 'kine') {
      out.sesiones = verMontos ? lpBloqueSesiones(deps, u.dni, mes, cfg, true) : { mes: mes, resumen: LP_SESION_TIPOS.map(t => ({ tipo: t, n: sesAll.filter(s => s.tipo === t).length })), lista: [], pacientes: [], dias: [], tipos: LP_SESION_TIPOS, sin_confirmar: 0 };
    }
    if (admin) {
      out.edicion = { tarifas: p.tarifas || {}, tipo: p.tipo || 'profe', valor_hora: p.valor_hora == null ? '' : p.valor_hora, horas_mes: p.horas_mes == null ? '' : p.horas_mes, horas_semana: p.horas_semana == null ? '' : p.horas_semana,
        metas: p.metas || null, valores: p.valores || null, monotributo: p.monotributo == null ? '' : p.monotributo, home_horas: p.home_horas == null ? '' : p.home_horas,
        sabados: p.sabados == null ? '' : p.sabados, plantillas: p.plantillas == null ? '' : p.plantillas, extras: p.extras || [], socios_manual: p.socios_manual || null,
        comision_manual: p.comision_manual == null ? '' : p.comision_manual, nota: p.nota || '' };
      if (congelada && calc.total !== liq.total) out.total_vivo = calc.total;
    }
    return out;
  }).sort((a, b) => String(a.sede).localeCompare(String(b.sede)) || String(a.nombre).localeCompare(String(b.nombre)));
  const meses = {};
  filas.forEach(f => { if (/^\d{4}-\d{2}$/.test(f.mes)) meses[f.mes] = 1; });
  deps.repo.leer('liqpro_mov').forEach(f => { if (/^\d{4}-\d{2}$/.test(f.periodo)) meses[f.periodo] = 1; });
  meses[lpPeriodoDe(hoy)] = 1; meses[mes] = 1;
  const reclamosAbiertos = admin ? filas.filter(f => f.tipo === 'reclamo' && liqJson(f.datos).estado === 'abierto').length : 0;
  const out = {
    mes: mes, hoy: hoy, periodo: lpPeriodo(mes), estado: estado, liquidada_ts: liquidada ? liquidada.ts || '' : '', puede_editar: admin, ve_montos: admin,
    personas: personas, meses: Object.keys(meses).sort(), reclamos_abiertos: reclamosAbiertos,
    sumas: LP_SUMAN, restas: LP_RESTAN, sesion_tipos: LP_SESION_TIPOS, factores: cfg.factores,
  };
  if (admin) out.config = cfg;
  else out.config = { sabado_mult: cfg.sabado_mult, nuevos_en_activos: cfg.nuevos_en_activos };
  return out;
}

// ---------- Guardar (admin) ----------

function lpEscribir(deps, tipo, mes, dni, id, datos) {
  const filas = lpFilas(deps).filter(f => !(f.tipo === tipo && f.mes === mes && f.dni === dni && f.id === id));
  if (datos != null) filas.push({ mes: mes, dni: dni, tipo: tipo, id: id, datos: JSON.stringify(datos), actualizado: new Date(deps.ahora()).toISOString() });
  deps.repo.escribir('liqpro', filas);
}

function lpExigirAdmin(req, deps) {
  const s = sesion(req, deps);
  if (!tieneRol(s.usuario, 'admin')) falla('prohibido');
  return s;
}

function lpLiquidada(deps, mes) {
  const f = lpFilas(deps).find(x => x.tipo === 'estado' && x.dni === '*' && x.mes === mes);
  return !!(f && liqJson(f.datos).liquidada);
}

function liqproConfigGuardar(req, deps) {
  lpExigirAdmin(req, deps);
  const mes = liqMes(req.mes);
  if (!mes) falla('datos_invalidos');
  if (lpLiquidada(deps, mes)) falla('liquidada');
  const arr4 = (v, tope) => { if (v == null || (Array.isArray(v) && !v.length)) return null; if (!Array.isArray(v) || v.length !== 4) falla('datos_invalidos'); return v.map(x => liqNumero(x, 0, tope)); };
  const tarifas = lpTarifasDe(req.tarifas);
  lpEscribir(deps, 'config', mes, '*', '', {
    valores: arr4(req.valores, 10000000), factores: arr4(req.factores, 1000), tarifas: tarifas, valor_plantilla: liqNumero(req.valor_plantilla, 0, 10000000),
    sabado_mult: liqNumero(req.sabado_mult, 0, 24), nuevos_en_activos: !(req.nuevos_en_activos === false || req.nuevos_en_activos === 'false'),
  });
  return {};
}

function liqproPersonaGuardar(req, deps) {
  const { usuarios } = lpExigirAdmin(req, deps);
  const dni = normalizarDni(req.dni), mes = liqMes(req.mes), d = req.datos;
  const u = usuarios.find(x => x.dni === dni && esProfe(x));
  if (!mes || !d || typeof d !== 'object' || !u) falla('datos_invalidos');
  if (lpLiquidada(deps, mes)) falla('liquidada');
  const extras = Array.isArray(d.extras) ? d.extras : [];
  if (extras.length > 30) falla('datos_invalidos');
  const metas = Array.isArray(d.metas) && d.metas.length ? d.metas : null;
  if (metas && (metas.length < 2 || metas.length > 6)) falla('datos_invalidos');
  const valores = Array.isArray(d.valores) && d.valores.length ? d.valores : null;
  if (valores && (!metas || valores.length !== metas.length)) falla('datos_invalidos');
  const sm = d.socios_manual && typeof d.socios_manual === 'object' ? { activos: liqNumero(d.socios_manual.activos, 0, 1000), cobran: liqNumero(d.socios_manual.cobran, 0, 1000) } : null;
  const propias = lpTarifasDe(d.tarifas);
  const datos = {
    tarifas: Object.keys(propias).length ? propias : null,
    tipo: d.tipo === 'kine' ? 'kine' : 'profe', valor_hora: liqNumero(d.valor_hora, 0, 1000000), horas_mes: liqNumero(d.horas_mes, 0, 500), horas_semana: liqNumero(d.horas_semana, 0, 80),
    metas: metas ? metas.map(x => liqNumero(x, 0, 1000)) : null, valores: valores ? valores.map(x => liqNumero(x, 0, 10000000)) : null,
    monotributo: liqNumero(d.monotributo, 0, 100000000), home_horas: liqNumero(d.home_horas, 0, 500), sabados: liqNumero(d.sabados, 0, 10), plantillas: liqNumero(d.plantillas, 0, 1000),
    comision_manual: liqNumero(d.comision_manual, 0, 100000000), socios_manual: sm && (sm.activos != null || sm.cobran != null) ? sm : null,
    extras: extras.map(x => {
      const c = texto(x && x.c).slice(0, 40), m = liqNumero(x && x.m, 0, 100000000);
      if (!c || m == null || (LP_SUMAN.indexOf(c) < 0 && LP_RESTAN.indexOf(c) < 0)) falla('datos_invalidos');
      return { c: c, m: m };
    }),
    nota: texto(d.nota).slice(0, 300),
  };
  lpEscribir(deps, 'persona', mes, dni, '', datos);
  return {};
}

// Liquidar congela las cuentas del mes (para que no cambien si después se corrige un pago). Solo con el período cerrado.
function liqproLiquidar(req, deps) {
  const { usuario, usuarios } = lpExigirAdmin(req, deps);
  const mes = liqMes(req.mes);
  if (!mes) falla('datos_invalidos');
  const hoy = deps.hoy();
  if (req.reabrir) {
    lpEscribir(deps, 'estado', mes, '*', '', null);
    deps.repo.escribir('liqpro', lpFilas(deps).filter(f => !(f.tipo === 'cierre' && f.mes === mes)));
    return { estado: lpEstadoDe(mes, hoy, false) };
  }
  if (hoy <= lpPeriodo(mes).hasta) falla('periodo_abierto');
  if (lpLiquidada(deps, mes)) falla('liquidada');
  const filas = lpFilas(deps);
  const cfg = lpConfigDelMes(filas, mes);
  const nuevas = filas.filter(f => !(f.tipo === 'cierre' && f.mes === mes) && !(f.tipo === 'estado' && f.mes === mes));
  const ts = new Date(deps.ahora()).toISOString();
  usuarios.filter(u => esVerdad(u.activo) && esProfe(u)).forEach(u => {
    const p = lpPersonaDelMes(filas, u.dni, mes);
    const liq = lpCalcular({ p: p, cfg: cfg, mov: lpMovConMarcas(lpMovDe(deps, u, mes), filas, u.dni, mes), sesiones: lpSesionesDe(deps, u.dni, mes), sabados_auto: lpSabadosAuto(deps, u.dni, mes), reemplazos: reemplazosDe(deps, u.dni, mes) });
    nuevas.push({ mes: mes, dni: u.dni, tipo: 'cierre', id: '', datos: JSON.stringify({ liq: liq, ts: ts }), actualizado: ts });
  });
  nuevas.push({ mes: mes, dni: '*', tipo: 'estado', id: '', datos: JSON.stringify({ liquidada: true, ts: ts, por: usuario.dni }), actualizado: ts });
  deps.repo.escribir('liqpro', nuevas);
  return { estado: 'liquidada' };
}

// ---------- «Sí entrenó» (admin): cuenta un mes de plan largo que no registró asistencia ----------

function liqproEntreno(req, deps) {
  const { usuario, usuarios } = lpExigirAdmin(req, deps);
  const dni = normalizarDni(req.dni), mes = liqMes(req.mes), clave = texto(req.clave);
  const u = usuarios.find(x => x.dni === dni && esProfe(x));
  if (!u || !mes || !clave) falla('datos_invalidos');
  if (lpLiquidada(deps, mes)) falla('liquidada');
  const mov = lpMovDe(deps, u, mes);
  const item = mov && (mov.sin_asistencia || []).find(x => x.clave === clave);
  if (!item) falla('no_encontrado');
  const previa = lpFilas(deps).find(f => f.tipo === 'entreno' && f.dni === dni && f.mes === mes && f.id === clave);
  const entreno = !(req.entreno === false || req.entreno === 'false');
  const historial = (previa ? liqJson(previa.datos).historial || [] : []).concat([{ ts: new Date(deps.ahora()).toISOString(), por: usuario.nombre, entreno: entreno }]).slice(-20);
  lpEscribir(deps, 'entreno', mes, dni, clave, { entreno: entreno, nombre: item.nombre, historial: historial });
  return {};
}

// ---------- Reclamos del profe ----------

function liqproReclamo(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!esProfe(usuario)) falla('prohibido');
  const mes = liqMes(req.mes), txt = texto(req.texto).slice(0, 400);
  if (!mes || txt.length < 3) falla('datos_invalidos');
  const id = 'R-' + deps.aleatorio(5);
  lpEscribir(deps, 'reclamo', mes, usuario.dni, id, { ts: new Date(deps.ahora()).toISOString(), linea: texto(req.linea).slice(0, 40), texto: txt, estado: 'abierto', respuesta: '' });
  return { id: id };
}

function liqproReclamoResolver(req, deps) {
  lpExigirAdmin(req, deps);
  const f = lpFilas(deps).find(x => x.tipo === 'reclamo' && x.id === texto(req.id));
  if (!f) falla('no_encontrado');
  const d = liqJson(f.datos);
  d.estado = 'resuelto';
  d.respuesta = texto(req.respuesta).slice(0, 400);
  lpEscribir(deps, 'reclamo', f.mes, f.dni, f.id, d);
  return {};
}

// ---------- Sesiones: las carga o confirma cada kinesiólogo (admin, las de cualquiera) ----------

function lpKineObjetivo(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const admin = tieneRol(usuario, 'admin');
  if (!admin && !esProfe(usuario)) falla('prohibido');
  const dni = admin && texto(req.kine_dni) ? normalizarDni(req.kine_dni) : usuario.dni;
  const u = usuarios.find(x => x.dni === dni && esProfe(x));
  if (!u) falla('datos_invalidos');
  const filas = lpFilas(deps);
  const mesRef = liqMes(req.mes) || lpPeriodoDe(deps.hoy());
  if (lpPersonaDelMes(filas, dni, mesRef).tipo !== 'kine') falla('prohibido');
  return { usuario: usuario, admin: admin, dni: dni, usuarios: usuarios };
}

function liqproSesionGuardar(req, deps) {
  const fecha = liqFecha(req.fecha);
  const k = lpKineObjetivo(Object.assign({}, req, { mes: fecha ? fecha.slice(0, 7) : '' }), deps);
  const paciente = texto(req.paciente).slice(0, 60), tipo = texto(req.tipo);
  if (!fecha || !paciente || LP_SESION_TIPOS.indexOf(tipo) < 0) falla('datos_invalidos');
  if (!k.admin && lpLiquidada(deps, fecha.slice(0, 7))) falla('liquidada');
  const todas = deps.repo.leer('liqpro_sesiones');
  if (todas.length >= LP_SESIONES_MAX * 10) falla('datos_invalidos');
  const idPedido = texto(req.id);
  const clave = lpClavePaciente(paciente);
  const previa = todas.find(s => (idPedido && s.id === idPedido) || (!idPedido && s.kine_dni === k.dni && s.fecha === fecha && lpClavePaciente(s.paciente) === clave));
  if (idPedido && !previa) falla('no_encontrado');
  if (previa && previa.kine_dni !== k.dni) falla('prohibido');
  const fila = { id: previa ? previa.id : 'S-' + deps.aleatorio(6), mes: fecha.slice(0, 7), fecha: fecha, kine_dni: k.dni, paciente: paciente, tipo: tipo, nota: texto(req.nota).slice(0, 120),
    estado: 'confirmada', por_dni: k.usuario.dni, ts: new Date(deps.ahora()).toISOString() };
  const quedan = todas.filter(s => !previa || s.id !== previa.id);
  quedan.push(fila);
  deps.repo.escribir('liqpro_sesiones', quedan);
  return { id: fila.id };
}

function liqproSesionBorrar(req, deps) {
  const { usuario } = sesion(req, deps);
  const todas = deps.repo.leer('liqpro_sesiones');
  const s = todas.find(x => x.id === texto(req.id));
  if (!s) falla('no_encontrado');
  if (!tieneRol(usuario, 'admin') && (s.kine_dni !== usuario.dni || lpLiquidada(deps, String(s.fecha).slice(0, 7)))) falla('prohibido');
  deps.repo.escribir('liqpro_sesiones', todas.filter(x => x.id !== s.id));
  return {};
}

// El kinesiólogo confirma lo importado de la planilla vieja (todo el mes o las que elija)
function liqproSesionesConfirmar(req, deps) {
  const k = lpKineObjetivo(req, deps);
  const mes = liqMes(req.mes);
  if (!mes) falla('datos_invalidos');
  if (!k.admin && lpLiquidada(deps, mes)) falla('liquidada');
  const ids = Array.isArray(req.ids) ? req.ids.map(texto) : null;
  const todas = deps.repo.leer('liqpro_sesiones');
  let n = 0;
  todas.forEach(s => {
    if (s.kine_dni === k.dni && String(s.fecha).slice(0, 7) === mes && s.estado === 'importada' && (!ids || ids.indexOf(s.id) >= 0)) { s.estado = 'confirmada'; s.por_dni = k.usuario.dni; n++; }
  });
  if (n) deps.repo.escribir('liqpro_sesiones', todas);
  return { confirmadas: n };
}

// ---------- Lo que sube la PC ----------

// Movimientos por período (pagos del 6 al 5): reemplaza los períodos que vienen
function cargarLiqproMov(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas) || req.filas.length > 500) falla('datos_invalidos');
  const filas = req.filas.map(x => ({ periodo: texto(x && x.periodo), profe: texto(x && x.profe), profe_dni: normalizarDni(x && x.profe_dni), sede: texto(x && x.sede),
    datos: typeof (x && x.datos) === 'string' ? x.datos : JSON.stringify((x && x.datos) || {}), cargada: deps.hoy() }));
  if (!filas.every(x => liqMes(x.periodo) && x.profe && x.datos.length < 40000 && leerJson(x.datos, null))) falla('datos_invalidos');
  const periodos = {};
  filas.forEach(x => { periodos[x.periodo] = 1; });
  const cerrados = Object.keys(periodos).filter(m => lpLiquidada(deps, m));
  if (cerrados.length) falla('liquidada');
  deps.repo.escribir('liqpro_mov', deps.repo.leer('liqpro_mov').filter(x => !periodos[x.periodo]).concat(filas));
  return { filas: filas.length, periodos: Object.keys(periodos).sort() };
}

// Configuración y datos por persona desde la PC (valores reales que no están en el repositorio). No pisa lo cargado por admin salvo con `pisar`.
function cargarLiqproConfig(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas) || req.filas.length > 500) falla('datos_invalidos');
  const filas = lpFilas(deps);
  const ts = new Date(deps.ahora()).toISOString();
  let nuevas = 0, pisadas = 0;
  req.filas.forEach(f => {
    const tipo = texto(f && f.tipo), mes = texto(f && f.mes), dni = texto(f && f.dni);
    if (['config', 'persona'].indexOf(tipo) < 0 || !liqMes(mes) || !dni || !f.datos || typeof f.datos !== 'object') falla('datos_invalidos');
    if ((tipo === 'config') !== (dni === '*')) falla('datos_invalidos');
    const i = filas.findIndex(x => x.tipo === tipo && x.mes === mes && x.dni === dni && x.id === '');
    if (i >= 0 && !req.pisar) return;
    const fila = { mes: mes, dni: dni, tipo: tipo, id: '', datos: JSON.stringify(f.datos), actualizado: ts };
    if (i >= 0) { filas[i] = fila; pisadas++; } else { filas.push(fila); nuevas++; }
  });
  deps.repo.escribir('liqpro', filas);
  return { nuevas: nuevas, pisadas: pisadas };
}

// Sesiones importadas de la planilla vieja. Idempotente: una sesión (kinesiólogo, día, paciente) que ya está no se toca ni se repite.
function cargarLiqproSesiones(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas) || req.filas.length > LP_SESIONES_MAX) falla('datos_invalidos');
  const todas = deps.repo.leer('liqpro_sesiones');
  const ts = new Date(deps.ahora()).toISOString();
  const hay = {};
  todas.forEach(s => { hay[s.kine_dni + '|' + s.fecha + '|' + lpClavePaciente(s.paciente)] = 1; });
  let nuevas = 0, existentes = 0;
  req.filas.forEach(f => {
    const dni = normalizarDni(f && f.kine_dni), fecha = liqFecha(f && f.fecha), paciente = texto(f && f.paciente).slice(0, 60), tipo = texto(f && f.tipo);
    if (!dni || !fecha || !paciente || LP_SESION_TIPOS.indexOf(tipo) < 0) falla('datos_invalidos');
    const k = dni + '|' + fecha + '|' + lpClavePaciente(paciente);
    if (hay[k]) { existentes++; return; }
    hay[k] = 1;
    todas.push({ id: 'I-' + dni + '-' + fecha + '-' + lpClavePaciente(paciente), mes: fecha.slice(0, 7), fecha: fecha, kine_dni: dni, paciente: paciente, tipo: tipo, nota: '', estado: 'importada', por_dni: '', ts: ts });
    nuevas++;
  });
  if (nuevas) deps.repo.escribir('liqpro_sesiones', todas);
  return { nuevas: nuevas, existentes: existentes };
}

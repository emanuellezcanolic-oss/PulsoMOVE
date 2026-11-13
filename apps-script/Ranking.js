// PulsoMOVE · Ranking entre sedes (gamificación) y resumen semanal para gerencia.
// Todo sale de las hojas que ya existen: ventas (cajas de MOVE), liquidacion (historial de nuevos), tareas y cierres.
// El ranking no muestra plata: solo socios nuevos, escalones y récords. El resumen semanal es solo para administración y supervisión.

const RANK_SUMA_VENTAS = ['planes', 'planes_monto', 'nuevos', 'renovaciones', 'largos', 'mostrador', 'mostrador_monto'];

function rankSumar(filas) {
  const t = {};
  RANK_SUMA_VENTAS.forEach(k => { t[k] = 0; });
  filas.forEach(f => RANK_SUMA_VENTAS.forEach(k => { t[k] += Number(f[k]) || 0; }));
  return t;
}

function rankMesAnterior(mes) {
  const a = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  return m === 1 ? (a - 1) + '-12' : a + '-' + String(m - 1).padStart(2, '0');
}

function rankVer(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!tieneRol(usuario, 'recepcion') && !tieneRol(usuario, 'coordinador') && !tieneRol(usuario, 'admin')) falla('prohibido');
  const hoy = deps.hoy();
  const mes = hoy.slice(0, 7), anterior = rankMesAnterior(mes), diaHoy = hoy.slice(8, 10);
  const ventas = deps.repo.leer('ventas');
  const liq = deps.repo.leer('liquidacion');
  const equipo = liqRecepcionistas(usuarios);
  const personas = equipo.map(u => {
    const propias = ventas.filter(f => f.dni === u.dni);
    const nuevos = propias.filter(f => String(f.fecha).indexOf(mes) === 0).reduce((a, f) => a + (Number(f.nuevos) || 0), 0);
    const aLaFecha = propias.filter(f => String(f.fecha).indexOf(anterior) === 0 && String(f.fecha).slice(8, 10) <= diaHoy).reduce((a, f) => a + (Number(f.nuevos) || 0), 0);
    const serie = liqNuevosPorMes(u.dni, liq, ventas, mes);
    const previos = serie.filter(s => s.mes < mes);
    const record = previos.reduce((m, s) => (m == null || s.nuevos > m.nuevos ? s : m), null);
    const mejorDia = propias.reduce((m, f) => (Number(f.nuevos) > (m ? m.n : 0) ? { fecha: f.fecha, n: Number(f.nuevos) } : m), null);
    const corridos = Number(diaHoy) || 1, dias = liqDiasDelMes(mes).length;
    const esc = liqEscalon(u, mes, hoy, liq, nuevos);
    return {
      dni: u.dni, nombre: u.nombre, sede: u.sede, nuevos: nuevos, mes_pasado_a_la_fecha: aLaFecha, vs_mes_pasado: nuevos - aLaFecha,
      proyeccion: liqRedondeo(nuevos / corridos * dias, 1),
      record: record ? { mes: record.mes, nuevos: record.nuevos } : null,
      bate_record: !!record && nuevos > record.nuevos, falta_record: record && nuevos <= record.nuevos ? record.nuevos - nuevos + 1 : 0,
      mejor_dia: mejorDia, escalon: esc ? { tramo: esc.tramo, etiqueta: esc.etiqueta, siguiente: esc.siguiente ? { etiqueta: esc.siguiente.etiqueta, faltan: esc.siguiente.faltan } : null, maximo: esc.maximo } : null,
    };
  }).filter(p => p.nuevos > 0 || p.record || p.mejor_dia)
    .sort((a, b) => b.nuevos - a.nuevos || b.vs_mes_pasado - a.vs_mes_pasado || String(a.nombre).localeCompare(String(b.nombre)));
  personas.forEach((p, i) => { p.puesto = i + 1; });
  // Equipo: lo de todas las sedes juntas y el mejor mes que se registró
  const porMes = {};
  equipo.forEach(u => liqNuevosPorMes(u.dni, liq, ventas, mes).forEach(s => { porMes[s.mes] = (porMes[s.mes] || 0) + s.nuevos; }));
  const previos = Object.keys(porMes).filter(m => m < mes);
  const mejor = previos.reduce((m, k) => (m == null || porMes[k] > porMes[m] ? k : m), null);
  const sedes = {};
  personas.forEach(p => { sedes[p.sede] = (sedes[p.sede] || 0) + p.nuevos; });
  return {
    mes: mes, hoy: hoy, mi_dni: usuario.dni, personas: personas,
    equipo: { nuevos: personas.reduce((a, p) => a + p.nuevos, 0), por_sede: sedes, record: mejor ? { mes: mejor, nuevos: porMes[mejor] } : null },
  };
}

// ---------- Resumen semanal para gerencia ----------

function rankSumarDias(fecha, n) {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function resumenSemanal(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!tieneRol(usuario, 'admin') && !tieneRol(usuario, 'supervision')) falla('prohibido');
  const hoy = deps.hoy();
  // Por defecto, la última semana completa (lunes a domingo). Con `actual` se mira la que va corriendo.
  const lunesActual = liqLunesDe(hoy);
  const lunes = liqFecha(req.lunes) ? liqLunesDe(liqFecha(req.lunes)) : (req.actual ? lunesActual : rankSumarDias(lunesActual, -7));
  const domingo = rankSumarDias(lunes, 6), lunesAnt = rankSumarDias(lunes, -7), domingoAnt = rankSumarDias(lunes, -1);
  const enSemana = (f, a, b) => { const x = String(f).slice(0, 10); return x >= a && x <= b; };
  const ventas = deps.repo.leer('ventas'), tareas = deps.repo.leer('tareas'), cierres = deps.repo.leer('cierres'), cob = deps.repo.leer('coberturas');
  const equipo = liqRecepcionistas(usuarios);
  const sedeDe = {};
  usuarios.forEach(u => { sedeDe[u.dni] = u.sede; });
  const mesActual = lunes.slice(0, 7);
  const sedes = Object.keys(SEDES_RANK).map(sede => {
    const v = ventas.filter(f => f.sede === sede);
    const sem = rankSumar(v.filter(f => enSemana(f.fecha, lunes, domingo)));
    const ant = rankSumar(v.filter(f => enSemana(f.fecha, lunesAnt, domingoAnt)));
    const mesAFecha = rankSumar(v.filter(f => String(f.fecha).indexOf(mesActual) === 0 && String(f.fecha) <= domingo));
    const t = tareas.filter(x => x.sede === sede && enSemana(x.fecha, lunes, domingo));
    const hechas = t.filter(x => x.estado === 'hecha').length;
    const animos = cierres.filter(c => c.sede === sede && enSemana(c.fecha, lunes, domingo) && Number(c.animo) > 0).map(c => Number(c.animo));
    const delEquipo = {};
    equipo.filter(u => u.sede === sede).forEach(u => { delEquipo[u.dni] = 1; });
    const cobSede = cob.filter(c => enSemana(c.fecha, lunes, domingo) && (delEquipo[c.cubre_dni] || delEquipo[c.titular_dni]));
    return {
      sede: sede, nuevos: sem.nuevos, nuevos_ant: ant.nuevos, renovaciones: sem.renovaciones, renovaciones_ant: ant.renovaciones, largos: sem.largos,
      entro: sem.planes_monto + sem.mostrador_monto, entro_ant: ant.planes_monto + ant.mostrador_monto, mostrador: sem.mostrador_monto,
      nuevos_mes: mesAFecha.nuevos, tareas_hechas: hechas, tareas_total: t.length, tareas_pct: t.length ? Math.round(hechas / t.length * 100) : null,
      animo: animos.length ? liqRedondeo(animos.reduce((a, x) => a + x, 0) / animos.length, 1) : null, cierres: animos.length,
      coberturas: cobSede.length, horas_cobertura: liqRedondeo(cobSede.reduce((a, c) => a + (Number(c.horas) || 0), 0), 1),
    };
  });
  const suma = k => sedes.reduce((a, s) => a + (s[k] || 0), 0);
  const porPersona = {};
  ventas.filter(f => enSemana(f.fecha, lunes, domingo)).forEach(f => { porPersona[f.dni] = (porPersona[f.dni] || 0) + (Number(f.nuevos) || 0); });
  const destacados = Object.keys(porPersona).filter(d => porPersona[d] > 0).map(d => ({ nombre: ((usuarios.find(u => u.dni === d) || {}).nombre) || 'Otra persona', sede: sedeDe[d] || '', nuevos: porPersona[d] }))
    .sort((a, b) => b.nuevos - a.nuevos).slice(0, 3);
  return {
    desde: lunes, hasta: domingo, hoy: hoy, en_curso: domingo >= hoy, sedes: sedes, destacados: destacados,
    total: { nuevos: suma('nuevos'), nuevos_ant: suma('nuevos_ant'), renovaciones: suma('renovaciones'), renovaciones_ant: suma('renovaciones_ant'), largos: suma('largos'), entro: suma('entro'), entro_ant: suma('entro_ant'), nuevos_mes: suma('nuevos_mes'), coberturas: suma('coberturas') },
  };
}

const SEDES_RANK = { bariloche: 1, bolson: 1, puelo: 1 };

// Calendario del equipo (Emanuel, 26/11/2026): quién está cada día, en qué horario, quién falta y quién lo cubre.
// No guarda nada: arma la vista con los horarios, vacaciones, coberturas, sábados y feriados que ya existen, así no se carga dos veces.
// Lo ve todo el equipo, por eso no viaja plata, motivos, notas ni si una licencia es paga.

function calendarioDias(d) {
  const { mes, horarios, ausencias, coberturas, sabados, feriados, usuarios } = d;
  const userDe = dni => usuarios.find(u => u.dni === dni) || null;
  const sedesDe = (nombre, dni) => {
    const suyas = horarios.filter(h => mismoProfe(h.profe, nombre)).map(h => h.sede);
    const u = userDe(dni);
    const out = suyas.length ? suyas : (u && u.sede ? [u.sede] : []);
    return out.filter((s, i) => out.indexOf(s) === i);
  };
  const out = {};
  for (let f = mes + '-01'; f.slice(0, 7) === mes; f = sumarDiasProfe(f, 1)) {
    const dia = (new Date(f + 'T12:00:00Z').getUTCDay() + 6) % 7;      // 0 = lunes
    const del = ausencias.filter(a => a.desde <= f && f <= a.hasta);
    const ausentes = del.map(a => ({
      nombre: a.profe, sedes: sedesDe(a.profe, a.profe_dni), tipo: a.tipo === 'vacaciones' ? 'vacaciones' : 'licencia',
      cubren: dia > 4 ? [] : cubrenDe(a).filter(c => c.desde <= f && f <= c.hasta).map(c => ({ nombre: c.profe, desde: c.hora_desde || '', hasta: c.hora_hasta || '' })),
    }));
    const falta = nombre => del.some(a => mismoProfe(a.profe, nombre));
    const trabajan = dia > 4 ? [] : horarios.filter(h => diasDeHorario(h.dias).indexOf(dia) >= 0 && !falta(h.profe))
      .map(h => ({ nombre: h.profe, sede: h.sede, desde: h.desde, hasta: h.hasta }));
    // quien cubre aparece en la franja que cubre: la cargada o, si no se cargó, la de quien falta
    if (dia <= 4) del.forEach(a => cubrenDe(a).filter(c => c.desde <= f && f <= c.hasta).forEach(c => {
      const suyos = horarios.filter(h => mismoProfe(h.profe, a.profe) && diasDeHorario(h.dias).indexOf(dia) >= 0);
      if (c.hora_desde) trabajan.push({ nombre: c.profe, sede: (suyos[0] || {}).sede || sedesDe(a.profe, a.profe_dni)[0] || '', desde: c.hora_desde, hasta: c.hora_hasta, cubre: a.profe });
      else suyos.forEach(h => trabajan.push({ nombre: c.profe, sede: h.sede, desde: h.desde, hasta: h.hasta, cubre: a.profe }));
    }));
    trabajan.sort((a, b) => String(a.sede).localeCompare(String(b.sede)) || String(a.desde).localeCompare(String(b.desde)) || String(a.nombre).localeCompare(String(b.nombre)));
    const fe = feriados.find(x => x.fecha === f);
    out[f] = {
      feriado: fe ? { nombre: fe.nombre, se_trabaja: fe.se_trabaja || '' } : null,
      trabajan: fe && fe.se_trabaja === 'no' ? [] : trabajan,
      ausentes: ausentes,
      sabado: fe && fe.se_trabaja === 'no' ? [] : sabados.filter(s => s.fecha === f && s.profe).map(s => ({ sede: s.sede, nombre: s.profe, ausente: falta(s.profe) })),
      // coberturas de recepción de un día (sin el motivo: puede ser de salud)
      coberturas: coberturas.filter(c => c.fecha === f).map(c => {
        const cubre = userDe(c.cubre_dni), titular = userDe(c.titular_dni);
        return { sede: (titular || cubre || {}).sede || '', cubre: (cubre || {}).nombre || '', titular: (titular || {}).nombre || '', horas: Number(c.horas) || 0 };
      }),
    };
  }
  return out;
}

function calendarioVer(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  exigirVisible(usuario, 'cal', deps);
  const hoy = deps.hoy();
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(texto(req.mes)) ? texto(req.mes) : hoy.slice(0, 7);
  const finMes = mes + '-31';
  return {
    mes: mes, hoy: hoy,
    dias: calendarioDias({
      mes: mes, usuarios: usuarios,
      horarios: deps.repo.leer('profe_horarios').map(filaHorario),
      ausencias: deps.repo.leer('profe_ausencias'),
      coberturas: deps.repo.leer('coberturas'),
      sabados: deps.repo.leer('profe_sabados'),
      feriados: feriadosVista(deps, mes + '-01', finMes),
    }),
  };
}

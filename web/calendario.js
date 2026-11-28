// Pantalla Calendario: el mes entero y, al tocar un día, quién está en cada sede, quién falta y quién lo cubre.
(function (raiz) {
  const SEDES = { bariloche: 'Bariloche', bolson: 'El Bolsón', puelo: 'Lago Puelo' };
  const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const diaSemana = f => (new Date(f + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const nombreMes = m => MESES[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);
  const otroMes = (m, n) => { const d = new Date(m + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
  const deSede = (sede, x) => !sede || x === sede;

  const TIPOS = { ingreso: 'Ingreso', reevaluacion: 'Reevaluación' };
  const ESTADOS = { agendado: '', hecho: '✅ hecho', no_vino: '🚫 no vino' };
  const turnosDe = (C, sede, f) => (C.turnos || []).filter(t => t.fecha === f && deSede(sede, t.sede));

  function bloqueTurnos(C, sede, f, esc) {
    const lista = turnosDe(C, sede, f);
    const habil = diaSemana(f) <= 4;
    const enAgenda = !sede || (C.agenda_sedes || []).indexOf(sede) >= 0;
    const reservar = C.puede_reservar && habil && enAgenda && f >= C.hoy;
    if (!lista.length && !reservar) return '';
    const boton = (t, e, txt) => `<button class="boton claro cal-mini" data-accion="cal-estado" data-id="${esc(t.id)}" data-e="${e}" data-socio="${esc(t.socio)}">${txt}</button>`;
    const filas = lista.map(t => `<li class="cal-turno"><span><b>${esc(t.hora)}</b> ${esc(t.socio)} · ${TIPOS[t.tipo] || esc(t.tipo)} · ${esc(t.profe)}${t.nota ? ' · ' + esc(t.nota) : ''} ${ESTADOS[t.estado] || ''}</span>${
      t.estado === 'agendado' && (C.puede_reservar || t.mio) ? `<span class="cal-acciones">${boton(t, 'hecho', 'Hecho')}${boton(t, 'no_vino', 'No vino')}${C.puede_reservar ? boton(t, 'cancelado', 'Cancelar') : ''}</span>` : ''}</li>`).join('');
    return `<h3>Evaluaciones</h3>${filas ? `<ul class="cal-turnos">${filas}</ul>` : '<p class="aclara">Todavía no hay evaluaciones este día.</p>'}${
      reservar ? `<button class="boton verde" data-accion="cal-reservar" data-f="${f}">➕ Reservar evaluación</button> <span class="aclara">Por ahora, en Lago Puelo.</span>` : ''}`;
  }

  function delDia(d, sede) {
    return {
      feriado: d.feriado,
      trabajan: d.trabajan.filter(t => deSede(sede, t.sede)),
      ausentes: d.ausentes.filter(a => !sede || a.sedes.indexOf(sede) >= 0),
      sabado: d.sabado.filter(s => deSede(sede, s.sede)),
      coberturas: d.coberturas.filter(c => deSede(sede, c.sede)),
    };
  }

  function grilla(C, sede, elegido, esc) {
    const fechas = Object.keys(C.dias).sort();
    const huecos = Array(diaSemana(fechas[0])).fill('<div class="cal-hueco"></div>').join('');
    const celdas = fechas.map(f => {
      const d = delDia(C.dias[f], sede);
      const marcas = [
        d.feriado ? '<span class="cal-feriado">🎌 feriado</span>' : '',
        ...d.ausentes.map(a => `<span class="cal-falta">${a.tipo === 'vacaciones' ? '🏖' : '📄'} ${esc(a.nombre.split(' ')[0])}</span>`),
        ...d.sabado.map(s => `<span class="cal-sab${s.ausente ? ' cal-falta' : ''}">${esc(s.nombre.split(' ')[0])}</span>`),
        d.coberturas.length ? `<span class="cal-cob">🔁 ${d.coberturas.length}</span>` : '',
        turnosDe(C, sede, f).length ? `<span class="cal-eval">📋 ${turnosDe(C, sede, f).length}</span>` : '',
      ].join('');
      const clase = [f === C.hoy ? 'hoy' : '', diaSemana(f) > 4 ? 'finde' : ''].join(' ').trim();
      return `<button class="cal-dia ${clase}" data-accion="cal-dia" data-f="${f}" aria-pressed="${f === elegido}" aria-label="${Number(f.slice(8))} de ${nombreMes(C.mes)}"><b>${Number(f.slice(8))}</b>${marcas}</button>`;
    }).join('');
    return `<div class="cal-grilla">${DIAS.map(n => `<div class="cal-cabeza">${n}</div>`).join('')}${huecos}${celdas}</div>`;
  }

  const franja = x => (x.desde ? `${x.desde} a ${x.hasta}` : '');

  function detalle(C, sede, f, esc) {
    const d = delDia(C.dias[f], sede);
    const finde = diaSemana(f) > 4;
    const bloques = [];
    if (d.feriado) bloques.push(`<p class="cal-aviso">🎌 ${esc(d.feriado.nombre)}: ${d.feriado.se_trabaja === 'no' ? 'no se trabaja' : d.feriado.se_trabaja === 'si' ? 'se trabaja' : 'falta definir si se trabaja'}</p>`);
    if (d.ausentes.length) bloques.push(`<h3>No están</h3><ul>${d.ausentes.map(a => `<li><b>${esc(a.nombre)}</b> · ${a.tipo === 'vacaciones' ? '🏖 de vacaciones' : '📄 de licencia'}${finde ? '' : a.cubren.length
      ? ' · cubre ' + a.cubren.map(c => esc(c.nombre) + (franja(c) ? ' (' + franja(c) + ')' : '')).join(', ')
      : ' · <span class="amarillo">sin reemplazo cargado</span>'}</li>`).join('')}</ul>`);
    Object.keys(SEDES).filter(s => deSede(sede, s)).forEach(s => {
      const t = d.trabajan.filter(x => x.sede === s), sab = d.sabado.filter(x => x.sede === s), cob = d.coberturas.filter(x => x.sede === s);
      if (!t.length && !sab.length && !cob.length) return;
      bloques.push(`<h3>${SEDES[s]}</h3><ul>${
        t.map(x => `<li><b>${esc(x.nombre)}</b> · ${franja(x)}${x.cubre ? ` <span class="cal-cubre">cubre a ${esc(x.cubre)}</span>` : ''}</li>`).join('')
      }${sab.map(x => `<li><b>${esc(x.nombre)}</b> · sábado${x.ausente ? ' <span class="amarillo">está ausente: hay que cambiarlo</span>' : ''}</li>`).join('')
      }${cob.map(x => `<li>🔁 <b>${esc(x.cubre)}</b>${x.titular ? ' cubre a ' + esc(x.titular) : ' hace horas extra'} · ${String(x.horas).replace('.', ',')} h</li>`).join('')}</ul>`);
    });
    return `<section class="cal-detalle"><h2>${DIAS_LARGOS[diaSemana(f)]} ${Number(f.slice(8))} de ${MESES[Number(f.slice(5, 7)) - 1]}</h2>${bloqueTurnos(C, sede, f, esc)}${bloques.join('') || '<p class="vacio">No hay nada cargado para este día.</p>'}</section>`;
  }

  // C = lo que devuelve calendario_ver; sede '' = todas
  function vista(C, sede, elegido, esc) {
    if (!C) return '<div class="cargando">Cargando…</div>';
    const f = C.dias[elegido] ? elegido : (C.dias[C.hoy] ? C.hoy : C.mes + '-01');
    const chips = [['', 'Todas las sedes']].concat(Object.keys(SEDES).map(k => [k, SEDES[k]]))
      .map(([k, n]) => `<button class="chip" data-accion="cal-sede" data-s="${k}" aria-pressed="${sede === k}">${n}</button>`).join('');
    return `<h1 class="titulo">Calendario</h1>
      <p class="bajada">Quién está cada día, quién falta y las evaluaciones. Tocá un día para ver el detalle y reservar.</p>
      ${C.puede_franjas ? '<button class="boton claro" data-accion="cal-franjas">🕒 Horas para evaluar</button>' : ''}
      <div class="filtros">${chips}</div>
      <div class="cal-mes"><button class="boton claro" data-accion="cal-mes" data-m="${otroMes(C.mes, -1)}" aria-label="Mes anterior">‹</button><b>${nombreMes(C.mes)}</b><button class="boton claro" data-accion="cal-mes" data-m="${otroMes(C.mes, 1)}" aria-label="Mes siguiente">›</button></div>
      ${grilla(C, sede, f, esc)}
      ${detalle(C, sede, f, esc)}`;
  }

  raiz.PulsoCalendario = { vista };
})(typeof window !== 'undefined' ? window : globalThis);

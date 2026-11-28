// Agenda de evaluaciones (Emanuel, 27/11/2026): cada profe marca sus horas para evaluar, recepción reserva solo en huecos libres.
// Turnos en punto (7, 8, 9…). Ingreso 2 puntos, reevaluación 1; tope 5 puntos por turno de 6 horas. El profe evalúa estando en sala.
// Empieza en Lago Puelo.

const AGENDA_SEDES = ['puelo'];
const AGENDA_TIPOS = { ingreso: { nombre: 'Evaluación de ingreso', puntos: 2 }, reevaluacion: { nombre: 'Reevaluación', puntos: 1 } };
const AGENDA_ESTADOS = ['agendado', 'hecho', 'no_vino', 'cancelado'];
const AGENDA_PUNTOS_POR_6H = 5;
const AGENDA_DIAS_ADELANTE = 60;
const FRANJAS_PROFE = ['p1', 'p2', 'evitar'];    // primera opción, segunda, mejor no
const FRANJAS_COORD = ['no', 'evitar'];          // bloqueado, mejor no

const horaEntera = h => /^([01]\d|2[0-3]):00$/.test(h);
const hh = n => (n < 10 ? '0' : '') + n + ':00';

function agendaReserva(u) { return tieneRol(u, 'recepcion') || tieneRol(u, 'coordinador') || tieneRol(u, 'admin'); }
function agendaCoordina(u) { return tieneRol(u, 'coordinador') || tieneRol(u, 'admin'); }

function agendaDiaSemana(f) { return (new Date(f + 'T12:00:00Z').getUTCDay() + 6) % 7; }   // 0 = lunes

// Horas en punto que entran completas en una franja de trabajo: 09:00 a 13:00 → 09, 10, 11, 12
function horasDe(desde, hasta) {
  const m = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const out = [];
  for (let n = Math.ceil(m(desde) / 60); (n + 1) * 60 <= m(hasta); n++) out.push(hh(n));
  return out;
}

function agendaTope(minutos) {
  return minutos ? Math.max(2, Math.floor(minutos / 60 * AGENDA_PUNTOS_POR_6H / 6)) : 2;
}

// La única regla de disponibilidad: la usan la pantalla de reserva y el guardado.
// Devuelve, por profe que está ese día en la sede, sus puntos y las horas en que se puede reservar `tipo`.
function agendaDisponibles(deps, usuarios, fecha, sede, tipo, ignorarId) {
  const dia = agendaDiaSemana(fecha);
  if (dia > 4) return { motivo: 'Los fines de semana no se toman evaluaciones.', profes: [] };
  const horarios = deps.repo.leer('profe_horarios').map(filaHorario);
  const cal = calendarioDias({
    mes: fecha.slice(0, 7), usuarios: usuarios, horarios: horarios, ausencias: deps.repo.leer('profe_ausencias'), coberturas: [], sabados: [],
    feriados: feriadosVista(deps, fecha, fecha),
  })[fecha];
  if (cal.feriado && cal.feriado.se_trabaja === 'no') return { motivo: 'Feriado: ese día no se trabaja.', profes: [] };
  const franjas = deps.repo.leer('agenda_franjas').filter(f => f.sede === sede && Number(f.dia) === dia);
  const turnos = deps.repo.leer('agenda').filter(t => t.fecha === fecha && t.estado !== 'cancelado' && t.id !== ignorarId);
  const profes = profesDelEquipo(usuarios).map(p => {
    const suyo = n => mismoProfe(n, p.nombre);
    const trabaja = cal.trabajan.filter(t => t.sede === sede && suyo(t.nombre));
    const ausente = cal.ausentes.some(a => suyo(a.nombre));
    const mias = franjas.filter(f => f.profe_dni === p.dni);
    const elegidas = mias.filter(f => f.origen === 'profe' && (f.tipo === 'p1' || f.tipo === 'p2'));
    if (!trabaja.length && (!elegidas.length || ausente)) return null;      // ese día no está en la sede
    const minutos = trabaja.reduce((a, t) => a + (Number(t.hasta.slice(0, 2)) * 60 + Number(t.hasta.slice(3, 5))) - (Number(t.desde.slice(0, 2)) * 60 + Number(t.desde.slice(3, 5))), 0);
    const tope = agendaTope(minutos);
    const propios = turnos.filter(t => t.profe_dni === p.dni);
    const usados = propios.reduce((a, t) => a + (AGENDA_TIPOS[t.tipo] || { puntos: 1 }).puntos, 0);
    // si el profe marcó horas para ese día, solo esas; si no marcó nada, las de su turno
    const base = elegidas.length ? elegidas.map(f => f.hora) : [].concat.apply([], trabaja.map(t => horasDe(t.desde, t.hasta)));
    const bloqueada = h => mias.some(f => f.hora === h && f.tipo === 'no');
    const horas = usados + AGENDA_TIPOS[tipo].puntos > tope ? [] : base.filter((h, i) => base.indexOf(h) === i && !bloqueada(h) && !propios.some(t => t.hora === h))
      .sort().map(h => {
        const e = elegidas.find(f => f.hora === h);
        return { hora: h, pref: e ? e.tipo : 'turno', evitar: mias.some(f => f.hora === h && f.tipo === 'evitar') };
      });
    horas.sort((a, b) => (a.evitar - b.evitar) || (a.pref === 'p1' ? 0 : a.pref === 'p2' ? 1 : 2) - (b.pref === 'p1' ? 0 : b.pref === 'p2' ? 1 : 2) || a.hora.localeCompare(b.hora));
    return { dni: p.dni, nombre: p.nombre, tope: tope, usados: usados, horas: horas };
  }).filter(Boolean);
  return { motivo: profes.length ? '' : 'Ese día no hay ningún profe cargado en la sede.', profes: profes };
}

function agendaFechaValida(deps, fecha) {
  const hoy = deps.hoy();
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= hoy && fecha <= sumarDiasProfe(hoy, AGENDA_DIAS_ADELANTE);
}

function agendaPedido(req, deps) {
  const fecha = texto(req.fecha), sede = texto(req.sede), tipo = texto(req.tipo);
  if (!agendaFechaValida(deps, fecha) || AGENDA_SEDES.indexOf(sede) < 0 || !AGENDA_TIPOS[tipo]) falla('datos_invalidos');
  return { fecha: fecha, sede: sede, tipo: tipo };
}

function agendaDia(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!agendaReserva(usuario)) falla('prohibido');
  const p = agendaPedido(req, deps);
  return agendaDisponibles(deps, usuarios, p.fecha, p.sede, p.tipo);
}

function agendaSocios(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!agendaReserva(usuario)) falla('prohibido');
  const vistos = {}, out = [];
  deps.repo.leer('profe_planilla').forEach(f => {
    const id = texto(f.socio_id);
    if (!id || vistos[id] || !texto(f.nombre) || AGENDA_SEDES.indexOf(f.sede) < 0) return;
    vistos[id] = true;
    out.push({ socio_id: id, nombre: texto(f.nombre) });
  });
  return { socios: out.sort((a, b) => a.nombre.localeCompare(b.nombre)) };
}

function agendaGuardar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!agendaReserva(usuario)) falla('prohibido');
  const p = agendaPedido(req, deps);
  const hora = texto(req.hora), dni = normalizarDni(req.profe_dni);
  const socioId = texto(req.socio_id).slice(0, 20), nombre = texto(req.socio_nombre).slice(0, 80);
  if (!horaEntera(hora) || !dni || nombre.length < 3) falla('datos_invalidos');
  const profe = agendaDisponibles(deps, usuarios, p.fecha, p.sede, p.tipo).profes.find(x => x.dni === dni);
  if (!profe || !profe.horas.some(h => h.hora === hora)) falla('sin_lugar');
  const filas = deps.repo.leer('agenda');
  const mismo = t => (socioId ? t.socio_id === socioId : !t.socio_id && normNombre(t.socio_nombre) === normNombre(nombre));
  if (filas.some(t => t.estado === 'agendado' && t.tipo === p.tipo && t.fecha >= deps.hoy() && mismo(t))) falla('turno_repetido');
  const ts = new Date(deps.ahora()).toISOString();
  const fila = { id: 'ag-' + deps.aleatorio(8), tipo: p.tipo, sede: p.sede, fecha: p.fecha, hora: hora, profe: profe.nombre, profe_dni: dni,
    socio_id: socioId, socio_nombre: nombre, estado: 'agendado', nota: texto(req.nota).slice(0, 200), creado_por: usuario.dni, creado: ts, actualizado: ts };
  filas.push(fila);
  deps.repo.escribir('agenda', filas);
  return { id: fila.id };
}

// Cancelar lo hace quien reserva; «hecho» y «no vino» también el profe del turno
function agendaEstado(req, deps) {
  const { usuario } = sesion(req, deps);
  const estado = texto(req.estado);
  if (AGENDA_ESTADOS.indexOf(estado) < 0 || estado === 'agendado') falla('datos_invalidos');
  const filas = deps.repo.leer('agenda');
  const t = filas.find(x => x.id === texto(req.id));
  if (!t) falla('no_encontrado');
  if (!agendaReserva(usuario) && !(t.profe_dni === usuario.dni && estado !== 'cancelado')) falla('prohibido');
  t.estado = estado;
  t.actualizado = new Date(deps.ahora()).toISOString();
  deps.repo.escribir('agenda', filas);
  return { id: t.id, estado: estado };
}

// Las horas marcadas. El profe ve y edita las suyas; coordinación, las de cualquiera (y sus bloqueos van aparte).
function agendaFranjasVer(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const coord = agendaCoordina(usuario);
  if (!coord && !esProfe(usuario)) falla('prohibido');
  // los de la sede: por su horario cargado o por su usuario
  const horarios = deps.repo.leer('profe_horarios').map(filaHorario).filter(h => h.sede === AGENDA_SEDES[0]);
  const deSede = p => p.sede === AGENDA_SEDES[0] || horarios.some(h => mismoProfe(h.profe, p.nombre));
  const profes = profesDelEquipo(usuarios).filter(p => (coord ? deSede(p) : p.dni === usuario.dni));
  const dni = normalizarDni(req.profe_dni) || (esProfe(usuario) ? usuario.dni : (profes[0] || {}).dni);
  if (!profes.some(p => p.dni === dni)) falla('prohibido');
  const sede = AGENDA_SEDES[0];
  return {
    coord: coord, profe_dni: dni, sede: sede, profes: profes.map(p => ({ dni: p.dni, nombre: p.nombre })),
    franjas: deps.repo.leer('agenda_franjas').filter(f => f.profe_dni === dni && f.sede === sede).map(f => ({ dia: Number(f.dia), hora: f.hora, tipo: f.tipo, origen: f.origen })),
  };
}

function agendaFranjasGuardar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const coord = agendaCoordina(usuario);
  const dni = normalizarDni(req.profe_dni), sede = texto(req.sede), origen = texto(req.origen);
  if (AGENDA_SEDES.indexOf(sede) < 0 || ['profe', 'coord'].indexOf(origen) < 0 || !Array.isArray(req.franjas) || req.franjas.length > 100) falla('datos_invalidos');
  if (!profesDelEquipo(usuarios).some(p => p.dni === dni)) falla('datos_invalidos');
  // cada capa la escribe su dueño: el profe sus preferencias, coordinación sus bloqueos (y puede ayudar a cargar las del profe)
  if (!coord && !(dni === usuario.dni && origen === 'profe')) falla('prohibido');
  const validos = origen === 'coord' ? FRANJAS_COORD : FRANJAS_PROFE;
  const nuevas = req.franjas.map(x => ({ dia: Number(x && x.dia), hora: texto(x && x.hora), tipo: texto(x && x.tipo) }));
  if (!nuevas.every(x => x.dia >= 0 && x.dia <= 4 && horaEntera(x.hora) && validos.indexOf(x.tipo) >= 0)) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  const quedan = deps.repo.leer('agenda_franjas').filter(f => !(f.profe_dni === dni && f.sede === sede && f.origen === origen));
  deps.repo.escribir('agenda_franjas', quedan.concat(nuevas.map(x => ({ profe_dni: dni, sede: sede, dia: String(x.dia), hora: x.hora, tipo: x.tipo, origen: origen, por_dni: usuario.dni, en: ts }))));
  return { guardadas: nuevas.length };
}

// Los turnos del mes para el calendario: sin documentos
function agendaDelMes(deps, mes, usuario) {
  return deps.repo.leer('agenda').filter(t => t.estado !== 'cancelado' && String(t.fecha).slice(0, 7) === mes)
    .map(t => ({ id: t.id, fecha: t.fecha, hora: t.hora, sede: t.sede, tipo: t.tipo, profe: t.profe, socio: t.socio_nombre, estado: t.estado, nota: t.nota, mio: t.profe_dni === usuario.dni }))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

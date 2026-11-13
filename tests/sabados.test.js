const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const PROFE = usuario({ dni: '20111222', nombre: 'Belén Juárez', roles: 'profe', sede: 'bolson' });
const OTRO = usuario({ dni: '20333444', nombre: 'Enzo Legammari', roles: 'profe', sede: 'bolson' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación Bolsón', roles: 'coordinador', sede: 'bolson' });
const ADMIN = usuario({ dni: '20777888', nombre: 'Admin', roles: 'admin', sede: 'puelo' });
const RECE = usuario({ dni: '20999000', nombre: 'Recepción', roles: 'recepcion', sede: 'bolson' });

function entorno(hoy = '2026-11-11') {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [PROFE, OTRO, COORD, ADMIN, RECE] }), hoy, ahora: Date.parse(hoy + 'T15:00:00Z') });
  return d;
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;
const tarea = (profe, dni) => ({ id: 'pp-' + dni, fecha: '2026-11-11', sede: 'bolson', profe, profe_dni: dni, socio_id: dni, socio_nombre: 'Socio', tipo: 'Renovar plan', accion: 'Renovarlo', vence: '2026-11-12', alta: '' });
const conTareas = d => pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy: '2026-11-11', tareas: [tarea('Belen Juarez', '20111222'), tarea('Enzo Legammari', '20333444')] });

test('coordinación carga quién va cada sábado y el profe ve el aviso esa semana', () => {
  const d = entorno();
  conTareas(d);
  const tk = entrar(d, '20555666');
  assert.deepEqual(pedir(d, { accion: 'profe_sabados_guardar', token: tk, sabados: [{ fecha: '2026-11-14', sede: 'bolson', profe: 'Belén Juárez' }, { fecha: '2026-11-21', sede: 'bolson', profe_dni: '20333444' }] }).data, { guardados: 2 });
  // no es sábado / otra sede
  assert.equal(pedir(d, { accion: 'profe_sabados_guardar', token: tk, sabados: [{ fecha: '2026-11-13', sede: 'bolson', profe: 'Belén Juárez' }] }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'profe_sabados_guardar', token: tk, sabados: [{ fecha: '2026-11-14', sede: 'puelo', profe: 'Belén Juárez' }] }).error, 'prohibido');
  // recepción y profe no pueden
  assert.equal(pedir(d, { accion: 'profe_sabados_guardar', token: entrar(d, '20111222'), sabados: [{ fecha: '2026-11-14', sede: 'bolson', profe: 'x' }] }).error, 'prohibido');
  const mio = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.sabados;
  assert.equal(mio.esta_semana.fecha, '2026-11-14');
  assert.equal(mio.esta_semana.profe_dni, '20111222');
  const enzo = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20333444') }).data.mio.sabados;
  assert.equal(enzo.esta_semana, null);           // el 21 es la semana que viene
  assert.deepEqual(enzo.proximos.map(s => s.fecha), ['2026-11-21']);
  // cambiar y borrar
  pedir(d, { accion: 'profe_sabados_guardar', token: tk, sabados: [{ fecha: '2026-11-14', sede: 'bolson', profe: '' }] });
  assert.equal(pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.sabados.esta_semana, null);
  assert.equal(d.repo.hojas.profe_sabados.length, 1);
});

test('el aviso aparece desde el lunes de esa semana', () => {
  const d = entorno('2026-11-16');
  conTareas(d);
  pedir(d, { accion: 'profe_sabados_guardar', token: entrar(d, '20555666'), sabados: [{ fecha: '2026-11-21', sede: 'bolson', profe: 'Enzo Legammari' }, { fecha: '2026-11-28', sede: 'bolson', profe: 'Enzo Legammari' }] });
  const s = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20333444') }).data.mio.sabados;
  assert.equal(s.esta_semana.fecha, '2026-11-21');
  assert.equal(s.proximos.length, 2);
});

test('horarios: coordinación edita los de su sede y el tablero usa los de la app', () => {
  const d = entorno();
  conTareas(d);
  pedir(d, { accion: 'cargar_profe_coordinacion', clave: PROPS.CLAVE_CARGA, hoy: '2026-11-11', filas: [{ profe: 'Belen Juarez', profe_dni: '20111222', sede: 'bolson', datos: JSON.stringify({ socios: 5, horas_semana: 30, horario: 'viejo' }) }] });
  const tk = entrar(d, '20555666');
  const r = pedir(d, { accion: 'profe_horarios_guardar', token: tk, profe: 'Belén Juárez', sede: 'bolson', filas: [{ dias: '0-4', desde: '07:00', hasta: '13:30' }, { dias: '5', desde: '08:00', hasta: '12:00' }] }).data;
  assert.equal(r.horas_semana, 36.5);
  assert.equal(r.horario, 'El Bolsón: lun a vie 07:00 a 13:30 · El Bolsón: sáb 08:00 a 12:00');
  assert.equal(pedir(d, { accion: 'profe_horarios_guardar', token: tk, profe: 'Belén Juárez', sede: 'bolson', filas: [{ dias: '0-4', desde: '13:00', hasta: '09:00' }] }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'profe_horarios_guardar', token: tk, profe: 'Javi', sede: 'puelo', filas: [] }).error, 'prohibido');
  // el admin puede cualquier sede
  assert.equal(pedir(d, { accion: 'profe_horarios_guardar', token: entrar(d, '20777888'), profe: 'Javier Larramendy', sede: 'puelo', filas: [{ dias: '0-4', desde: '08:00', hasta: '15:00' }] }).data.horas_semana, 35);
  const out = pedir(d, { accion: 'profe_tareas', token: tk }).data;
  const c = out.equipo.find(p => p.profe === 'Belen Juarez').coord;
  assert.equal(c.horas_semana, 36.5);
  assert.equal(out.agenda.editables.join(), 'bolson');
  assert.equal(out.agenda.horarios.length, 3);
  assert.ok(out.agenda.profes.some(p => p.dni === '20333444'));
  // la PC ya no los pisa
  assert.deepEqual(pedir(d, { accion: 'cargar_profe_horarios', clave: PROPS.CLAVE_CARGA, filas: [{ profe: 'X', sede: 'bolson', dias: '0', desde: '08:00', hasta: '09:00' }] }).data, { filas: 0, ya_cargados: true });
  assert.equal(d.repo.hojas.profe_horarios.length, 3);
});

test('la carga de la PC no pisa lo que coordinación ya cargó', () => {
  const d = entorno();
  conTareas(d);
  pedir(d, { accion: 'profe_sabados_guardar', token: entrar(d, '20555666'), sabados: [{ fecha: '2026-11-14', sede: 'bolson', profe: 'Enzo Legammari' }] });
  const r = pedir(d, { accion: 'cargar_profe_sabados', clave: PROPS.CLAVE_CARGA, sabados: [{ fecha: '2026-11-14', sede: 'bolson', profe: 'Belén Juárez' }, { fecha: '2026-11-21', sede: 'bolson', profe: 'Belén Juárez' }] }).data;
  assert.deepEqual(r, { nuevos: 1, ya_estaban: 1 });
  assert.equal(pedir(d, { accion: 'cargar_profe_sabados', clave: 'mal', sabados: [] }).error, 'clave');
  const s = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.sabados;
  assert.equal(s.esta_semana, null);
  assert.deepEqual(s.proximos.map(x => x.fecha), ['2026-11-21']);
});

test('nombres: no confunde dos profes con palabras en común', () => {
  assert.equal(L.mismoProfe('Profe Mañana (práctica)', 'Profe Tarde (práctica)'), false);
  assert.equal(L.mismoProfe('Belén Juárez', 'Belen Juarez'), true);
  assert.equal(L.mismoProfe('Emanuel', 'Emanuel Lezcano'), true);
  assert.equal(L.mismoProfe('Enzo Legammari', 'Belén Juárez'), false);
});

const HORARIOS = [
  { profe: 'Belén Juárez', sede: 'bolson', dias: '0-4', desde: '07:00', hasta: '13:30' },
  { profe: 'Enzo Legammari', sede: 'bolson', dias: '0-4', desde: '13:30', hasta: '20:00' },
  { profe: 'Emanuel Lezcano', sede: 'bolson', dias: '0-4', desde: '20:00', hasta: '22:00' },
  { profe: 'Sofía Bertinotti', sede: 'bolson', dias: '0,2,4', desde: '10:00', hasta: '12:00' },   // kine: no entra en la rotación
];
const conHorarios = d => pedir(d, { accion: 'cargar_profe_horarios', clave: PROPS.CLAVE_CARGA, filas: HORARIOS });

test('rotación: mañana, tarde y noche, a quien hace más que no va', () => {
  const d = entorno();
  conHorarios(d);
  assert.deepEqual(L.rotacionDeSede(HORARIOS, 'bolson'), ['Belén Juárez', 'Enzo Legammari', 'Emanuel Lezcano']);
  // ya cargado: 14 Enzo, 21 Belén → sigue Emanuel, después Enzo, Belén...
  pedir(d, { accion: 'cargar_profe_sabados', clave: PROPS.CLAVE_CARGA, sabados: [{ fecha: '2026-11-14', sede: 'bolson', profe: 'Enzo Legammari' }, { fecha: '2026-11-21', sede: 'bolson', profe: 'Belén Juárez' }] });
  const r = pedir(d, { accion: 'profe_sabados_generar', clave: PROPS.CLAVE_CARGA, sede: 'bolson' }).data;
  assert.ok(r.nuevos.bolson >= 14);
  const sab = d.repo.hojas.profe_sabados.filter(s => s.sede === 'bolson').sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  assert.deepEqual(sab.slice(0, 6).map(s => s.profe.split(' ')[0]), ['Enzo', 'Belén', 'Emanuel', 'Enzo', 'Belén', 'Emanuel']);
  // otra vez no duplica
  assert.equal(pedir(d, { accion: 'profe_sabados_generar', clave: PROPS.CLAVE_CARGA, sede: 'bolson' }).data.nuevos.bolson, 0);
  // el profe ve cuántos sábados tiene en el mes
  conTareas(d);
  assert.equal(pedir(d, { accion: 'profe_tareas', token: entrar(d, '20333444') }).data.mio.sabados.en_el_mes, 1);
});

test('feriado: se le pregunta a coordinación y, si no se trabaja, se reordena', () => {
  const d = entorno();
  conHorarios(d);
  conTareas(d);
  const tk = entrar(d, '20555666');
  pedir(d, { accion: 'profe_sabados_generar', token: tk, sede: 'bolson' });
  pedir(d, { accion: 'profe_feriado', token: tk, fecha: '2026-11-21', nombre: 'Feriado local' });
  let A = pedir(d, { accion: 'profe_tareas', token: tk }).data.agenda;
  assert.deepEqual(A.pregunta_feriado.map(f => f.fecha), ['2026-11-21']);
  const antes = d.repo.hojas.profe_sabados.filter(s => s.sede === 'bolson').sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map(s => s.profe);
  const r = pedir(d, { accion: 'profe_feriado', token: tk, fecha: '2026-11-21', se_trabaja: 'no', reordenar: true }).data;
  assert.ok(r.movidos > 3);
  const despues = d.repo.hojas.profe_sabados.filter(s => s.sede === 'bolson').sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  assert.equal(despues[1].profe, '');                       // 21/11 cerrado
  assert.equal(despues[1].nota, 'Feriado: no se trabaja');
  assert.equal(despues[2].profe, antes[1]);                 // el del feriado va el sábado siguiente
  assert.equal(despues[3].profe, antes[2]);
  A = pedir(d, { accion: 'profe_tareas', token: tk }).data.agenda;
  assert.equal(A.pregunta_feriado.length, 0);
  assert.ok(A.por_mes.length >= 3);
  assert.equal(pedir(d, { accion: 'profe_feriado', token: entrar(d, '20111222'), fecha: '2026-11-21', se_trabaja: 'si' }).error, 'prohibido');
});

test('coordinación tilda quiénes trabajan los sábados', () => {
  const d = entorno();
  conHorarios(d);
  conTareas(d);
  const tk = entrar(d, '20555666');
  let A = pedir(d, { accion: 'profe_tareas', token: tk }).data.agenda;
  assert.deepEqual(A.rotaciones.bolson, ['Belén Juárez', 'Enzo Legammari', 'Emanuel Lezcano']);   // las kines no
  assert.equal(A.rotacion_elegida.bolson, false);
  pedir(d, { accion: 'profe_sabados_generar', token: tk, sede: 'bolson' });
  assert.ok(d.repo.hojas.profe_sabados.some(s => s.profe === 'Emanuel Lezcano'));
  // saca a Emanuel: rotan Belén y Enzo, en orden de turno aunque se tilden al revés; lo de la rotación se rearma
  const r = pedir(d, { accion: 'profe_rotacion_guardar', token: tk, sede: 'bolson', profes: ['Enzo Legammari', 'Belén Juárez'] }).data;
  assert.deepEqual(r.rotacion, ['Belén Juárez', 'Enzo Legammari']);
  assert.ok(r.rearmados > 10);
  const sab = d.repo.hojas.profe_sabados.filter(s => s.sede === 'bolson').sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  assert.ok(sab.slice(1).every(s => s.profe !== 'Emanuel Lezcano'));   // esta semana queda como estaba
  assert.deepEqual(sab.slice(1, 5).map(s => s.profe.split(' ')[0]).sort(), ['Belén', 'Belén', 'Enzo', 'Enzo']);
  A = pedir(d, { accion: 'profe_tareas', token: tk }).data.agenda;
  assert.equal(A.rotacion_elegida.bolson, true);
  assert.equal(pedir(d, { accion: 'profe_rotacion_guardar', token: tk, sede: 'puelo', profes: ['X'] }).error, 'prohibido');
});

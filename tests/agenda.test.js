const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario } = require('./repo_falso');

const PROFE = usuario({ dni: '20111222', nombre: 'Javier Luna', roles: 'profe', sede: 'puelo' });
const OTRO = usuario({ dni: '20333444', nombre: 'Agus Sol', roles: 'profe', sede: 'puelo' });
const RECE = usuario({ dni: '20555666', nombre: 'Rita Sosa', roles: 'recepcion', sede: 'puelo' });
const COORD = usuario({ dni: '20777888', nombre: 'Coord Uno', roles: 'coordinador', sede: 'puelo' });
const LUNES = '2026-11-30';

function entorno() {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [PROFE, OTRO, RECE, COORD] }), hoy: '2026-11-27', ahora: Date.parse('2026-11-27T15:00:00Z') });
  d.repo.hojas.profe_horarios = [{ profe: 'Javier Luna', sede: 'puelo', dias: '0-4', desde: '08:00', hasta: '15:00' },
    { profe: 'Agus Sol', sede: 'puelo', dias: '0-4', desde: '15:00', hasta: '22:00' }];
  return d;
}
const entrar = (d, dni) => L.manejar({ accion: 'login', dni, pin: '4831' }, d).data.token;
const pedir = (d, dni, req) => L.manejar(Object.assign({ token: entrar(d, dni) }, req), d);
const ver = (d, tipo) => pedir(d, RECE.dni, { accion: 'agenda_dia', fecha: LUNES, sede: 'puelo', tipo: tipo || 'reevaluacion' }).data;
const reservar = (d, extra) => pedir(d, RECE.dni, Object.assign({ accion: 'agenda_guardar', fecha: LUNES, sede: 'puelo', tipo: 'reevaluacion', hora: '09:00', profe_dni: PROFE.dni, socio_id: '1', socio_nombre: 'Ana Paz' }, extra));
const javier = (d, tipo) => ver(d, tipo).profes.find(p => p.dni === PROFE.dni);

test('sin horas marcadas se ofrecen las de su turno, en punto, con tope de 5 puntos', () => {
  const p = javier(entorno());
  assert.equal(p.tope, 5);
  assert.deepEqual(p.horas.map(h => h.hora), ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00']);
});

test('2 ingresos y 1 reevaluación llenan el día; no se pisa la hora ni se repite el socio', () => {
  const d = entorno();
  assert.equal(reservar(d, { tipo: 'ingreso', hora: '08:00' }).ok, true);
  assert.equal(reservar(d, { hora: '08:00', socio_id: '2' }).error, 'sin_lugar');
  assert.equal(reservar(d, { tipo: 'ingreso', hora: '10:00' }).error, 'turno_repetido');
  assert.equal(reservar(d, { tipo: 'ingreso', hora: '10:00', socio_id: '2', socio_nombre: 'Beto Gil' }).ok, true);
  assert.equal(javier(d, 'ingreso').horas.length, 0);
  assert.equal(reservar(d, { hora: '12:00', socio_id: '3', socio_nombre: 'Caro Luz' }).ok, true);
  assert.equal(reservar(d, { hora: '13:00', socio_id: '4', socio_nombre: 'Dani Ruiz' }).error, 'sin_lugar');
  assert.equal(reservar(d, { hora: '09:30' }).error, 'datos_invalidos');
});

test('el profe marca sus horas (también fuera del turno) y coordinación bloquea', () => {
  const d = entorno();
  const g = (dni, extra) => pedir(d, dni, Object.assign({ accion: 'agenda_franjas_guardar', profe_dni: PROFE.dni, sede: 'puelo', origen: 'profe' }, extra));
  assert.equal(g(PROFE.dni, { franjas: [{ dia: 0, hora: '15:00', tipo: 'p2' }, { dia: 0, hora: '12:00', tipo: 'p1' }, { dia: 0, hora: '11:00', tipo: 'p1' }] }).ok, true);
  assert.deepEqual(javier(d).horas.map(h => h.hora + h.pref), ['11:00p1', '12:00p1', '15:00p2']);
  assert.equal(g(OTRO.dni, { franjas: [] }).error, 'prohibido');
  assert.equal(g(PROFE.dni, { origen: 'coord', franjas: [] }).error, 'prohibido');
  assert.equal(g(COORD.dni, { origen: 'coord', franjas: [{ dia: 0, hora: '12:00', tipo: 'no' }] }).ok, true);
  assert.deepEqual(javier(d).horas.map(h => h.hora), ['11:00', '15:00']);
});

test('de vacaciones o en feriado no se puede; el fin de semana tampoco', () => {
  const d = entorno();
  d.repo.hojas.profe_ausencias = [{ id: 'a', profe: 'Javier Luna', profe_dni: PROFE.dni, desde: LUNES, hasta: LUNES, tipo: 'vacaciones' }];
  assert.equal(javier(d), undefined);
  assert.equal(reservar(d, {}).error, 'sin_lugar');
  d.repo.hojas.profe_feriados = [{ fecha: LUNES, nombre: 'Feriado', se_trabaja: 'no', borrado: '' }];
  assert.equal(ver(d).profes.length, 0);
  assert.equal(pedir(d, RECE.dni, { accion: 'agenda_dia', fecha: '2026-11-28', sede: 'puelo', tipo: 'ingreso' }).data.profes.length, 0);
});

test('quién puede qué; cancelar libera la hora; el calendario muestra el turno sin documentos', () => {
  const d = entorno();
  const id = reservar(d, {}).data.id;
  assert.equal(pedir(d, PROFE.dni, { accion: 'agenda_guardar', fecha: LUNES, sede: 'puelo', tipo: 'ingreso', hora: '10:00', profe_dni: PROFE.dni, socio_nombre: 'Eva Mar' }).error, 'prohibido');
  assert.equal(pedir(d, OTRO.dni, { accion: 'agenda_estado', id, estado: 'hecho' }).error, 'prohibido');
  const cal = pedir(d, PROFE.dni, { accion: 'calendario_ver', mes: '2026-11' }).data;
  assert.equal(cal.turnos[0].socio, 'Ana Paz');
  assert.equal(cal.turnos[0].mio, true);
  assert.doesNotMatch(JSON.stringify(cal), /20111222|20555666/);
  assert.equal(pedir(d, PROFE.dni, { accion: 'agenda_estado', id, estado: 'cancelado' }).error, 'prohibido');
  assert.equal(pedir(d, RECE.dni, { accion: 'agenda_estado', id, estado: 'cancelado' }).ok, true);
  assert.equal(reservar(d, {}).ok, true);
});

const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

// Martes 10/11/2026. Los próximos días hábiles: mié 11, jue 12, vie 13, lun 16, mar 17.
const HOY = '2026-11-10';
const PROFE = usuario({ dni: '20111222', nombre: 'Profe Uno', roles: 'profe' });
const MANANA = Object.assign(usuario({ dni: '30111111', nombre: 'Recepción Mañana', turno: 'manana' }), { hora_inicio: '07:00', hora_fin: '15:00' });
const TARDE = Object.assign(usuario({ dni: '30222222', nombre: 'Recepción Tarde', turno: 'tarde' }), { hora_inicio: '15:00', hora_fin: '21:00' });

const socio = (id, dias, habitos, extra = {}) => Object.assign({
  id: 're-' + id, sede: 'bolson', profe: 'Profe Uno', profe_dni: '20111222', socio_id: String(id), socio_nombre: 'Socio ' + id,
  ultima_eval: dias === '' ? '' : '2026-01-01', dias: String(dias), habitos: habitos || '', cargada: HOY,
}, extra);
const franja = (fecha, hora, cupo, reservas, profe = 'Profe  Uno') => ({ sede: 'bolson', tipo: 'franja', fecha, hora, clase: 'Sala', profe, horario_id: fecha + hora, cupo: String(cupo), reservas: String(reservas), nombres: '' });

function entorno(reeval, proximas, tareas = []) {
  return depsFalsas({ repo: repoFalso({ usuarios: [PROFE, MANANA, TARDE], profe_reeval: reeval, proximas, tareas, ocupacion: [] }), hoy: HOY, ahora: Date.parse(HOY + 'T15:00:00Z') });
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = d => pedir(d, { accion: 'login', dni: '20111222', pin: '4831' }).data.token;
const reeval = d => pedir(d, { accion: 'profe_tareas', token: entrar(d) }).data.mio.reeval;

const SEMANA = ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16'];
const todasLasFranjas = () => SEMANA.flatMap(f => [franja(f, '09:00', 10, 8), franja(f, '14:00', 10, 2), franja(f, '18:00', 10, 9)]);

test('una por día, de la evaluación más vieja a la más reciente', () => {
  const d = entorno([socio(1, 300), socio(2, 200), socio(3, 100), socio(4, 80), socio(5, 30), socio(6, '')], todasLasFranjas());
  const r = reeval(d);
  assert.deepEqual(r.recomendadas.map(x => x.socio_id), ['1', '2', '3', '4']);      // los de menos de 56 días y sin evaluación, no
  assert.deepEqual(r.recomendadas.map(x => x.propuesta.fecha), SEMANA);
  assert.ok(r.recomendadas.every(x => x.propuesta.hora === '14:00'));            // sin horario fijo: la hora con menos gente
  assert.equal(r.socios.length, 6);
});

test('prefiere la hora en que el socio ya viene, aunque haya un poco más de gente', () => {
  // el socio 1 viene los miércoles (2) a las 09:00, no a las 14:00
  const d = entorno([socio(1, 300, '2-09:00:6')], todasLasFranjas());
  const p = reeval(d).recomendadas[0].propuesta;
  assert.deepEqual([p.fecha, p.hora, p.suya], ['2026-11-11', '09:00', true]);
  assert.match(p.motivo, /Suele venir los miércoles a las 09:00/);
});

test('busca el día que le queda al socio entre los más atrasados', () => {
  // el más atrasado viene solo los jueves: el miércoles le toca al siguiente y el jueves a él
  const d = entorno([socio(1, 300, '3-18:00:5'), socio(2, 200)], todasLasFranjas());
  const r = reeval(d).recomendadas;
  assert.deepEqual(r.slice(0, 2).map(x => [x.socio_id, x.propuesta.fecha]), [['2', '2026-11-11'], ['1', '2026-11-12']]);
});

test('solo en horarios en que está su profe', () => {
  const prox = SEMANA.flatMap(f => [franja(f, '09:00', 10, 1, 'Otro Profe'), franja(f, '18:00', 10, 9)]);
  const p = reeval(entorno([socio(1, 300, '2-09:00:6')], prox)).recomendadas[0].propuesta;
  assert.equal(p.hora, '18:00');
  assert.match(p.motivo, /No tenemos un horario fijo suyo/);
});

test('el profe se la pide a recepción: tarea Coordinar reevaluación para quien está a esa hora', () => {
  const d = entorno([socio(1, 300, '2-09:00:6')], todasLasFranjas());
  const tk = entrar(d);
  const r = pedir(d, { accion: 'profe_pedir_reeval', token: tk, socio_id: '1', fecha: '2026-11-11', hora: '09:00' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.recepcionista, 'Recepción Mañana');
  const t = d.repo.hojas.tareas[0];
  assert.equal(t.tipo, 'Coordinar reevaluación · lo pide el profe');
  assert.ok(t.tipo.startsWith('Coordinar reevaluación'));   // la PC la sigue como a las de siempre
  assert.equal(L.nivelDeTarea(t), 1);                         // para recepción es de lo primero
  assert.match(t.situacion, /^Profe te pidió que coordines una reevaluación con Socio 1/);
  assert.equal(t.socio_id, 'reeval-1');
  assert.equal(t.asignado_dni, '30111111');
  assert.match(t.accion, /^Mandale un mensaje a Socio 1 para coordinarla: proponerle el miércoles 11\/11 a las 09:00 con Profe Uno/);
  // ya pedida: no se repite ni se vuelve a recomendar
  assert.equal(pedir(d, { accion: 'profe_pedir_reeval', token: tk, socio_id: '1', fecha: '2026-11-11', hora: '09:00' }).error, 'ya_pedida');
  const v = reeval(d);
  assert.equal(v.recomendadas.length, 0);
  assert.equal(v.socios[0].pedida, true);
  // a la tarde, la de la tarde
  const d2 = entorno([socio(2, 300)], todasLasFranjas());
  assert.equal(pedir(d2, { accion: 'profe_pedir_reeval', token: entrar(d2), socio_id: '2', fecha: '2026-11-12', hora: '18:00' }).data.recepcionista, 'Recepción Tarde');
});

test('si recepción ya tiene la reevaluación del socio, no se pide de nuevo', () => {
  const ya = [{ id: 'x', sede: 'bolson', socio_id: 'eval-1', tipo: 'Coordinar reevaluación', estado: 'pendiente', fecha: HOY }];
  const d = entorno([socio(1, 300)], todasLasFranjas(), ya);
  assert.equal(pedir(d, { accion: 'profe_pedir_reeval', token: entrar(d), socio_id: '1', fecha: '2026-11-11', hora: '14:00' }).error, 'ya_pedida');
});

test('un profe no pide por socios de otro, y recepción no puede pedir', () => {
  const d = entorno([socio(1, 300, '', { profe_dni: '99999999' })], todasLasFranjas());
  assert.equal(pedir(d, { accion: 'profe_pedir_reeval', token: entrar(d), socio_id: '1', fecha: '2026-11-11', hora: '14:00' }).error, 'no_existe');
  const tkRec = pedir(d, { accion: 'login', dni: '30111111', pin: '4831' }).data.token;
  assert.equal(pedir(d, { accion: 'profe_pedir_reeval', token: tkRec, socio_id: '1', fecha: '2026-11-11', hora: '14:00' }).error, 'prohibido');
});

test('cargar_profe_reeval reemplaza la lista y pide la clave', () => {
  const d = entorno([socio(1, 300)], []);
  assert.equal(pedir(d, { accion: 'cargar_profe_reeval', clave: 'mal', filas: [] }).error, 'clave');
  const r = pedir(d, { accion: 'cargar_profe_reeval', clave: PROPS.CLAVE_CARGA, hoy: HOY, filas: [socio(2, 100), socio(3, 50)] });
  assert.deepEqual(r.data, { filas: 2 });
  assert.deepEqual(d.repo.hojas.profe_reeval.map(x => x.socio_id), ['2', '3']);
});

test('el profe elige a quién de recepción pedírsela', () => {
  const d = entorno([socio(1, 300, '2-09:00:6')], todasLasFranjas());
  const v = reeval(d);
  assert.equal(v.recomendadas[0].sugerida_dni, '30111111');            // la que está a las 09:00
  assert.deepEqual(v.recepcion.bolson.map(u => u.nombre), ['Recepción Mañana', 'Recepción Tarde']);
  const tk = entrar(d);
  assert.equal(pedir(d, { accion: 'profe_pedir_reeval', token: tk, socio_id: '1', fecha: '2026-11-11', hora: '09:00', dni: '20111222' }).error, 'datos_invalidos');   // no es de recepción
  const r = pedir(d, { accion: 'profe_pedir_reeval', token: tk, socio_id: '1', fecha: '2026-11-11', hora: '09:00', dni: '30222222' });
  assert.equal(r.data.recepcionista, 'Recepción Tarde');
  assert.equal(d.repo.hojas.tareas[0].asignado_dni, '30222222');
});

test('no es mi entrenado desde las reevaluaciones: aviso a recepción y deja de recomendarse', () => {
  const OTRO = usuario({ dni: '20333444', nombre: 'Profe Dos', roles: 'profe' });
  const d = depsFalsas({ repo: repoFalso({ usuarios: [PROFE, OTRO, MANANA, TARDE], profe_reeval: [socio(1, 300), socio(2, 200)], proximas: todasLasFranjas(), ocupacion: [],
    tareas: [], profe_tareas: [{ id: 'pp-1', fecha: HOY, sede: 'bolson', profe: 'Profe Uno', profe_dni: '20111222', socio_id: '1', socio_nombre: 'Socio 1', tipo: 'Plan vencido', estado: 'pendiente', vence: '2026-11-01' }] }),
    hoy: HOY, ahora: Date.parse(HOY + 'T15:00:00Z') });
  const tk = entrar(d);
  assert.equal(reeval(d).recomendadas[0].socio_id, '1');
  // sabe de quién es
  const r = pedir(d, { accion: 'profe_no_es_mio', token: tk, socio_id: '1', profe: 'Profe Dos', dni: '30222222' });
  assert.ok(r.ok, JSON.stringify(r));
  const t = d.repo.hojas.tareas[0];
  assert.deepEqual([t.tipo, t.asignado_dni, t.socio_id], ['Cambiar profesor · lo pide el profe', '30222222', 'profe-1']);
  const v = reeval(d);
  assert.ok(!v.recomendadas.some(x => x.socio_id === '1') && !v.socios.some(x => x.socio_id === '1'));
  assert.equal(d.repo.hojas.profe_tareas[0].estado, 'derivada');                    // su renovación pendiente también sale
  assert.equal(pedir(d, { accion: 'profe_no_es_mio', token: tk, socio_id: '1', profe: '', dni: '30111111' }).error, 'ya_avisado');
  // no sabe de quién es
  const r2 = pedir(d, { accion: 'profe_no_es_mio', token: tk, socio_id: '2', profe: '', dni: '30111111' });
  assert.ok(r2.ok, JSON.stringify(r2));
  assert.match(d.repo.hojas.tareas[1].situacion, /no es su entrenado y no sabe de quién es/);
  assert.match(d.repo.hojas.tareas[1].accion, /Fijate en qué horario viene/);
  assert.equal(pedir(d, { accion: 'profe_no_es_mio', token: tk, socio_id: '2', profe: 'Profe Dos', dni: '30111111' }).error, 'ya_avisado');
});

test('con el horario del profe cargado, propone solo cuando el profe está en la sede', () => {
  // en MOVE la clase de las 09:00 figura con el profe, pero su horario es de 14 a 17 (por ejemplo, una kinesióloga)
  const d = entorno([socio(1, 300)], todasLasFranjas());
  assert.deepEqual(pedir(d, { accion: 'cargar_profe_horarios', clave: PROPS.CLAVE_CARGA, filas: [{ profe: 'Profe Uno', sede: 'bolson', dias: '0,2,4', desde: '08:00', hasta: '10:00' }, { profe: 'Profe Uno', sede: 'bolson', dias: '1,3', desde: '17:00', hasta: '19:00' }] }).data, { filas: 2 });
  const r = reeval(d);
  // miércoles 11 (2): solo 09:00 · jueves 12 (3): solo 18:00
  assert.deepEqual(r.recomendadas.map(x => [x.propuesta.fecha, x.propuesta.hora]).slice(0, 1), [['2026-11-11', '09:00']]);
  const s = r.socios[0].propuesta;
  assert.ok(s && ['09:00', '18:00'].indexOf(s.hora) >= 0);
  assert.equal(pedir(d, { accion: 'cargar_profe_horarios', clave: PROPS.CLAVE_CARGA, filas: [{ profe: 'Profe Uno', sede: 'bolson', dias: 'x', desde: '08:00', hasta: '10:00' }] }).error, 'datos_invalidos');
});

test('sin horario cargado sigue mirando el profe de la clase de MOVE', () => {
  const d = entorno([socio(1, 300)], todasLasFranjas());
  pedir(d, { accion: 'cargar_profe_horarios', clave: PROPS.CLAVE_CARGA, filas: [{ profe: 'Otra Persona', sede: 'bolson', dias: '0-4', desde: '08:00', hasta: '10:00' }] });
  assert.equal(reeval(d).recomendadas[0].propuesta.hora, '14:00');
});

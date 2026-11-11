const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const HOY = '2026-11-10';
const UNO = usuario({ dni: '20111222', nombre: 'Belu Prueba', roles: 'profe' });
const DOS = usuario({ dni: '20333444', nombre: 'Enzo Prueba', roles: 'profe', turno: 'tarde' });
const REC = usuario({ dni: '30111111', nombre: 'Rocío Prueba' });
const REC_OTRA = usuario({ dni: '30999999', nombre: 'De otra sede', sede: 'puelo' });

const tarea = (id, extra = {}) => Object.assign({ id: 'pp-' + id, fecha: HOY, sede: 'bolson', profe: 'Belu Prueba', profe_dni: '20111222', socio_id: String(id),
  socio_nombre: 'Socio ' + id, tipo: 'Plan vencido', accion: 'Renovarlo', vence: '2026-11-01' }, extra);
function entorno() {
  return depsFalsas({ repo: repoFalso({ usuarios: [UNO, DOS, REC, REC_OTRA], tareas: [] }), hoy: HOY, ahora: Date.parse(HOY + 'T15:00:00Z') });
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;
const cargar = (d, tareas) => pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy: d.dia, tareas });

test('las opciones: los otros profes y la recepción de mi sede', () => {
  const d = entorno();
  cargar(d, [tarea(1)]);
  const op = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.opciones;
  assert.deepEqual(op.profes, ['Enzo Prueba']);
  assert.deepEqual(op.recepcion.map(u => u.nombre), ['Rocío Prueba']);
});

test('no es mi entrenado: aviso importante a recepción y la renovación sale de mi lista', () => {
  const d = entorno();
  cargar(d, [tarea(1)]);
  const tk = entrar(d, '20111222');
  assert.equal(pedir(d, { accion: 'profe_otra_situacion', token: tk, id: 'pp-1', que: 'otro_profe', profe: 'Nadie', dni: '30111111' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'profe_otra_situacion', token: tk, id: 'pp-1', que: 'otro_profe', profe: 'Enzo Prueba', dni: '30999999' }).error, 'datos_invalidos');   // no es de mi sede
  const r = pedir(d, { accion: 'profe_otra_situacion', token: tk, id: 'pp-1', que: 'otro_profe', profe: 'Enzo Prueba', dni: '30111111' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.recepcionista, 'Rocío Prueba');
  const t = d.repo.hojas.tareas[0];
  assert.deepEqual([t.tipo, t.socio_id, t.asignado_dni, L.nivelDeTarea(t)], ['Cambiar profesor · lo pide el profe', 'profe-1', '30111111', 1]);
  assert.match(t.situacion, /^Belu avisa que Socio 1 no es su entrenado: es de Enzo Prueba/);
  assert.equal(pedir(d, { accion: 'profe_tareas', token: tk }).data.mio.hoy.length, 0);
  // al día siguiente MOVE todavía no lo cambió: sigue fuera de mi lista
  d.dia = '2026-11-11';
  cargar(d, [tarea(1, { fecha: '2026-11-11' })]);
  assert.equal(d.repo.hojas.profe_tareas[0].estado, 'derivada');
  // MOVE ya muestra a Enzo: le aparece a Enzo, pendiente
  d.dia = '2026-11-12';
  cargar(d, [tarea(1, { fecha: '2026-11-12', profe: 'Enzo Prueba', profe_dni: '20333444' })]);
  assert.equal(d.repo.hojas.profe_tareas[0].estado, 'pendiente');
  assert.equal(pedir(d, { accion: 'profe_tareas', token: entrar(d, '20333444') }).data.mio.hoy.length, 1);
});

test('no se avisa dos veces por el mismo socio', () => {
  const d = entorno();
  cargar(d, [tarea(1), tarea(2, { socio_id: '1', id: 'pp-1b' })]);
  const tk = entrar(d, '20111222');
  pedir(d, { accion: 'profe_otra_situacion', token: tk, id: 'pp-1', que: 'otro_profe', profe: 'Enzo Prueba', dni: '30111111' });
  assert.equal(pedir(d, { accion: 'profe_otra_situacion', token: tk, id: 'pp-1b', que: 'otro_profe', profe: 'Enzo Prueba', dni: '30111111' }).error, 'ya_avisado');
});

test('tiene el plan en papel: sale de la lista y queda anotado', () => {
  const d = entorno();
  cargar(d, [tarea(1)]);
  const tk = entrar(d, '20111222');
  assert.equal(pedir(d, { accion: 'profe_otra_situacion', token: entrar(d, '20333444'), id: 'pp-1', que: 'papel' }).error, 'no_existe');   // no es suya
  const r = pedir(d, { accion: 'profe_otra_situacion', token: tk, id: 'pp-1', que: 'papel' });
  assert.equal(r.data.tarea.estado, 'papel');
  const mio = pedir(d, { accion: 'profe_tareas', token: tk }).data.mio;
  assert.equal(mio.hoy.length, 0);
  assert.equal(mio.resumen.en_papel, 1);
  cargar(d, [tarea(1)]);   // mismo vencimiento en MOVE: sigue anotado
  assert.equal(d.repo.hojas.profe_tareas[0].estado, 'papel');
});

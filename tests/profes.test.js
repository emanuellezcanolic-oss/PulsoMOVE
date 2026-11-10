const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const PROFE = usuario({ dni: '20111222', nombre: 'Profe Uno', roles: 'profe' });
const OTRO = usuario({ dni: '20333444', nombre: 'Profe Dos', roles: 'profe', turno: 'tarde' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación', roles: 'coordinador' });
const RECE = usuario();   // recepcionista de bolson, 30123456

function entorno(extra = {}) {
  return depsFalsas({ repo: repoFalso({ usuarios: [PROFE, OTRO, COORD, RECE], ...extra }), hoy: '2026-11-10', ahora: Date.parse('2026-11-10T15:00:00Z') });
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;
const tarea = (id, extra = {}) => Object.assign({
  id: 'pp-' + id, fecha: '2026-11-10', sede: 'bolson', profe: 'Profe Uno', profe_dni: '20111222', socio_id: String(id),
  socio_nombre: 'Socio ' + id, tipo: 'Renovar plan', accion: 'Renovarlo', vence: '2026-11-12', alta: '',
}, extra);
const cargar = (d, tareas) => pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy: d.dia, tareas });

test('cargar_profe_tareas pide la clave y valida', () => {
  const d = entorno();
  assert.equal(pedir(d, { accion: 'cargar_profe_tareas', clave: 'mal', tareas: [] }).error, 'clave');
  assert.equal(cargar(d, [tarea(1, { tipo: 'Cualquiera' })]).error, 'datos_invalidos');
  assert.equal(cargar(d, [tarea(1, { sede: 'marte' })]).error, 'datos_invalidos');
  assert.deepEqual(cargar(d, [tarea(1), tarea(2)]).data, { nuevas: 2, cerradas: 0, total: 2 });
});

test('el profe ve solo lo suyo: hoy, atrasado y los próximos días', () => {
  const d = entorno();
  cargar(d, [tarea(1), tarea(2, { fecha: '2026-11-06', tipo: 'Plan vencido' }), tarea(3, { fecha: '2026-11-13' }),
    tarea(4, { fecha: '2026-12-01' }), tarea(5, { profe: 'Profe Dos', profe_dni: '20333444' }), tarea(6, { tipo: 'Plan nuevo' })]);
  const r = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.data.mio.hoy.map(t => t.socio_id), ['2', '6', '1']);   // primero lo atrasado; el día, con el plan nuevo arriba
  assert.equal(r.data.mio.hoy[0].atraso, 4);
  assert.deepEqual(r.data.mio.proximas.map(t => t.socio_id), ['3']);        // lo de diciembre todavía no
  assert.equal(r.data.mio.resumen.atrasadas, 1);
  assert.equal(r.data.mio.resumen.nuevos, 1);
  assert.equal(r.data.equipo, undefined);
});

test('recepción no entra a lo de los profes', () => {
  const d = entorno();
  cargar(d, [tarea(1)]);
  assert.equal(pedir(d, { accion: 'profe_tareas', token: entrar(d, '30123456') }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'profe_marcar', token: entrar(d, '30123456'), id: 'pp-1' }).error, 'prohibido');
});

test('coordinación ve a todos los profes de su sede', () => {
  const d = entorno();
  cargar(d, [tarea(1), tarea(5, { profe: 'Profe Dos', profe_dni: '20333444' }), tarea(7, { sede: 'puelo', profe: 'Profe Tres' })]);
  const r = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20555666') });
  assert.deepEqual(r.data.equipo.map(p => p.profe), ['Profe Dos', 'Profe Uno']);
  assert.equal(r.data.equipo[1].resumen.pendientes_hoy, 1);
});

test('marcar y desmarcar: solo el profe dueño', () => {
  const d = entorno();
  cargar(d, [tarea(1)]);
  assert.equal(pedir(d, { accion: 'profe_marcar', token: entrar(d, '20333444'), id: 'pp-1' }).error, 'prohibido');
  const tk = entrar(d, '20111222');
  const r = pedir(d, { accion: 'profe_marcar', token: tk, id: 'pp-1', nota: 'Pasó a mancuernas' });
  assert.equal(r.data.tarea.estado, 'hecha');
  assert.equal(d.repo.hojas.profe_tareas[0].hecha_dni, '20111222');
  const mio = pedir(d, { accion: 'profe_tareas', token: tk }).data.mio;
  assert.equal(mio.resumen.hechas_hoy, 1);
  assert.equal(mio.hoy.length, 1);   // la hecha de hoy se sigue viendo
  assert.equal(pedir(d, { accion: 'profe_marcar', token: tk, id: 'pp-1', hecha: false }).data.tarea.estado, 'pendiente');
});

test('la carga siguiente respeta lo marcado y cierra lo que MOVE ya muestra renovado', () => {
  const d = entorno();
  cargar(d, [tarea(1), tarea(2)]);
  pedir(d, { accion: 'profe_marcar', token: entrar(d, '20111222'), id: 'pp-1' });
  d.dia = '2026-11-11';
  // el 2 sigue igual; el 1 sigue con el mismo vencimiento (MOVE todavía no lo muestra): queda hecha; aparece el 3
  let r = cargar(d, [tarea(1, { fecha: '2026-11-10' }), tarea(2, { fecha: '2026-11-11' }), tarea(3, { fecha: '2026-11-11' })]);
  assert.deepEqual(r.data, { nuevas: 1, cerradas: 0, total: 3 });
  assert.equal(d.repo.hojas.profe_tareas.find(t => t.id === 'pp-1').estado, 'hecha');
  // al otro día el 1 ya no viene (renovado en MOVE): se cierra
  d.dia = '2026-11-12';
  r = cargar(d, [tarea(2, { fecha: '2026-11-12' }), tarea(3, { fecha: '2026-11-12' })]);
  assert.equal(r.data.cerradas, 1);
  const uno = d.repo.hojas.profe_tareas.find(t => t.id === 'pp-1');
  assert.equal(uno.estado, 'cerrada');
  assert.ok(uno.cerrada_en);
  // un vencimiento nuevo del mismo socio es otro ciclo: vuelve a pendiente
  pedir(d, { accion: 'profe_marcar', token: entrar(d, '20111222'), id: 'pp-2' });
  r = cargar(d, [tarea(2, { fecha: '2026-12-10', vence: '2026-12-12' }), tarea(3, { fecha: '2026-11-12' })]);
  assert.equal(d.repo.hojas.profe_tareas.find(t => t.id === 'pp-2').estado, 'pendiente');
});

test('un usuario profe no aparece en el equipo de recepción de la sede', () => {
  const d = entorno();
  const r = pedir(d, { accion: 'sede', token: entrar(d, '20555666') });
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(!r.data.personas.some(p => p.dni === '20111222'));
});

test('usuarios_cargar acepta el rol profe', () => {
  const d = entorno();
  const r = pedir(d, { accion: 'usuarios_cargar', clave: PROPS.CLAVE_CARGA, usuarios: [{ dni: '27999888', nombre: 'Sol', sede: 'bariloche', turno: 'manana', roles: 'profe' }] });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.pines.length, 1);
});

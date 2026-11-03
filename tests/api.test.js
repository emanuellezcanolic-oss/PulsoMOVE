const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario } = require('./repo_falso');

const MIN15 = 15 * 60 * 1000;

function entorno(usuarios = [usuario()], extra = {}) {
  return depsFalsas({ repo: repoFalso({ usuarios, ...extra }) });
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni = '30123456', pin = '4831') => pedir(d, { accion: 'login', dni, pin }).data.token;

// ---------- Task 3: login ----------

test('login correcto con DNI con puntos', () => {
  const d = entorno();
  const r = pedir(d, { accion: 'login', dni: '30.123.456', pin: '4831' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.nombre, 'Ana Prueba');
  assert.deepEqual(r.data.roles, ['recepcion']);
  assert.equal(r.data.debe_cambiar_pin, false);
  assert.equal(L.leerToken(r.data.token, d.t, 's', d.hmac), '30123456');
});

test('PIN mal suma intento', () => {
  const d = entorno();
  assert.deepEqual(pedir(d, { accion: 'login', dni: '30123456', pin: '0907' }), { ok: false, error: 'credenciales' });
  assert.equal(d.repo.hojas.usuarios[0].intentos, '1');
});

test('DNI inexistente → credenciales', () => {
  assert.equal(pedir(entorno(), { accion: 'login', dni: '1', pin: '4831' }).error, 'credenciales');
});

test('5 fallos bloquean 15 minutos', () => {
  const d = entorno();
  for (let i = 0; i < 5; i++) pedir(d, { accion: 'login', dni: '30123456', pin: '0907' });
  assert.equal(d.repo.hojas.usuarios[0].bloqueado_hasta, String(d.t + MIN15));
  assert.equal(pedir(d, { accion: 'login', dni: '30123456', pin: '4831' }).error, 'bloqueado');
  d.t += MIN15 + 1;
  assert.ok(pedir(d, { accion: 'login', dni: '30123456', pin: '4831' }).ok);
  assert.equal(d.repo.hojas.usuarios[0].intentos, '0');
});

test('usuario inactivo → credenciales', () => {
  const d = entorno([usuario({ activo: false })]);
  assert.equal(pedir(d, { accion: 'login', dni: '30123456', pin: '4831' }).error, 'credenciales');
});

test('debe cambiar PIN antes de usar la app', () => {
  const d = entorno([usuario({ debe_cambiar_pin: true })]);
  const r = pedir(d, { accion: 'login', dni: '30123456', pin: '4831' });
  assert.equal(r.data.debe_cambiar_pin, true);
  assert.equal(pedir(d, { accion: 'mis_tareas', token: r.data.token }).error, 'debe_cambiar_pin');
});

test('cambiar_pin', () => {
  const d = entorno([usuario({ debe_cambiar_pin: true })]);
  const token = entrar(d);
  assert.equal(pedir(d, { accion: 'cambiar_pin', token, pin_nuevo: '1111' }).error, 'pin_invalido');
  assert.equal(pedir(d, { accion: 'cambiar_pin', token, pin_nuevo: '4831' }).error, 'pin_invalido');
  assert.ok(pedir(d, { accion: 'cambiar_pin', token, pin_nuevo: '0907' }).ok);
  assert.equal(d.repo.hojas.usuarios[0].debe_cambiar_pin, 'false');
  assert.equal(pedir(d, { accion: 'login', dni: '30123456', pin: '4831' }).error, 'credenciales');
  assert.ok(pedir(d, { accion: 'login', dni: '30123456', pin: '0907' }).ok);
});

test('sin token o token vencido → sin_sesion', () => {
  const d = entorno();
  assert.equal(pedir(d, { accion: 'mis_tareas' }).error, 'sin_sesion');
  const token = entrar(d);
  d.t += 10 * 3600 * 1000 + 1;
  assert.equal(pedir(d, { accion: 'mis_tareas', token }).error, 'sin_sesion');
});

test('token de usuario desactivado → sin_sesion', () => {
  const d = entorno();
  const token = entrar(d);
  d.repo.hojas.usuarios[0].activo = 'false';
  assert.equal(pedir(d, { accion: 'mis_tareas', token }).error, 'sin_sesion');
});

test('acción desconocida o pedido raro → datos_invalidos', () => {
  const d = entorno();
  assert.equal(pedir(d, { accion: 'borrar_todo' }).error, 'datos_invalidos');
  assert.equal(pedir(d, null).error, 'datos_invalidos');
});

// ---------- Task 4: mis tareas y marcar ----------

function tarea(o) {
  return { id: 'T1', fecha: '2026-11-09', sede: 'bolson', socio_id: '501', socio_nombre: 'Socio Uno', profe: 'Profe A',
           tipo: 'Vence en 7 días', prioridad: '2', situacion: 'Vence el 12/11', accion: 'Llamar', ultima_anotacion: '',
           asignado_dni: '30123456', pendiente_desde: '2026-11-09', estado: 'pendiente', hecha_en: '', ...o };
}
const OTRA = usuario({ dni: '28999888', nombre: 'Beto Prueba', turno: 'tarde', pin: '0907' });

test('mis_tareas: propias pendientes y de hoy, ordenadas', () => {
  const d = entorno([usuario(), OTRA], { tareas: [
    tarea({ id: 'hoy-b', socio_nombre: 'Zoe', prioridad: '1' }),
    tarea({ id: 'hoy-a', socio_nombre: 'Ana', prioridad: '1' }),
    tarea({ id: 'vieja', fecha: '2026-11-05', pendiente_desde: '2026-11-05', prioridad: '3' }),
    tarea({ id: 'hecha-hoy', estado: 'hecha', prioridad: '4' }),
    tarea({ id: 'hecha-ayer', fecha: '2026-11-06', estado: 'hecha' }),
    tarea({ id: 'cerrada', estado: 'cerrada' }),
    tarea({ id: 'ajena', asignado_dni: '28999888' }),
  ] });
  const r = pedir(d, { accion: 'mis_tareas', token: entrar(d) });
  assert.equal(r.data.hoy, '2026-11-09');
  assert.deepEqual(r.data.tareas.map(t => t.id), ['hoy-a', 'hoy-b', 'vieja', 'hecha-hoy']);
  assert.equal(r.data.tareas[2].dias_pendiente, 2);
});

test('marcar: ajena, inexistente, válida', () => {
  const d = entorno([usuario(), OTRA], { tareas: [tarea({}), tarea({ id: 'T2', asignado_dni: '28999888' })], registro: [] });
  const token = entrar(d);
  const m = { accion: 'marcar', token, canal: 'LL', resultado: 'RESERVA', detalle: 'Jueves 18 h' };
  assert.equal(pedir(d, { ...m, tarea_id: 'T2', id_marca: 'a' }).error, 'prohibido');
  assert.equal(pedir(d, { ...m, tarea_id: 'NO', id_marca: 'b' }).error, 'no_existe');
  assert.equal(pedir(d, { ...m, tarea_id: 'T1', id_marca: 'c', resultado: 'VUELVE' }).error, 'datos_invalidos');
  assert.ok(pedir(d, { ...m, tarea_id: 'T1', id_marca: 'c' }).ok);
  const reg = d.repo.hojas.registro;
  assert.equal(reg.length, 1);
  assert.equal(reg[0].socio_id, '501');
  assert.equal(reg[0].tipo, 'Vence en 7 días');
  assert.equal(reg[0].dni, '30123456');
  assert.equal(reg[0].sede, 'bolson');
  assert.equal(reg[0].fecha_tarea, '2026-11-09');
  assert.equal(d.repo.hojas.tareas[0].estado, 'hecha');
  assert.ok(d.repo.hojas.tareas[0].hecha_en);
});

test('marcar: mismo id_marca dos veces → una fila; corrección agrega otra', () => {
  const d = entorno([usuario()], { tareas: [tarea({})], registro: [] });
  const m = { accion: 'marcar', token: entrar(d), tarea_id: 'T1', canal: 'LL', resultado: 'RESERVA' };
  assert.ok(pedir(d, { ...m, id_marca: 'x1' }).ok);
  assert.ok(pedir(d, { ...m, id_marca: 'x1' }).ok);
  assert.equal(d.repo.hojas.registro.length, 1);
  assert.ok(pedir(d, { ...m, id_marca: 'x2', resultado: 'NO CONTESTA' }).ok);
  assert.equal(d.repo.hojas.registro.length, 2);
  assert.equal(d.repo.hojas.tareas[0].estado, 'hecha');
});

test('marcar sin id_marca → datos_invalidos', () => {
  const d = entorno([usuario()], { tareas: [tarea({})], registro: [] });
  assert.equal(pedir(d, { accion: 'marcar', token: entrar(d), tarea_id: 'T1', canal: 'LL', resultado: 'RESERVA' }).error, 'datos_invalidos');
});

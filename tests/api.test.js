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

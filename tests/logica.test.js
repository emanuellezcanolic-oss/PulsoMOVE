const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const L = require('./cargar').cargar();

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const azar = n => crypto.randomBytes(n).toString('hex');

test('normalizarDni', () => {
  assert.equal(L.normalizarDni(' 30.123.456 '), '30123456');
  assert.equal(L.normalizarDni(30123456), '30123456');
  assert.equal(L.normalizarDni(undefined), '');
});

test('pinValido', () => {
  for (const p of ['4831', '0907']) assert.ok(L.pinValido(p), p);
  for (const p of ['1111', '1234', '9876', '0123', '3210', '123', '12a4', '', null]) assert.ok(!L.pinValido(p), String(p));
});

test('hashPin determinista y depende de la sal', () => {
  assert.equal(L.hashPin('4831', 'ab', 'pp', sha), sha('ab:4831:pp'));
  assert.notEqual(L.hashPin('4831', 'ab', 'pp', sha), L.hashPin('4831', 'cd', 'pp', sha));
});

test('generarPin siempre válido', () => {
  for (let i = 0; i < 200; i++) assert.ok(L.pinValido(L.generarPin(azar)));
});

const hmac = (s, k) => crypto.createHmac('sha256', k).update(s).digest('base64url');
const H10 = 10 * 3600 * 1000;

test('token: válido, vence a las 10 h', () => {
  const t = L.crearToken('30123456', 1000, 'sec', hmac);
  assert.equal(L.leerToken(t, 1000, 'sec', hmac), '30123456');
  assert.equal(L.leerToken(t, 1000 + H10 - 1, 'sec', hmac), '30123456');
  assert.equal(L.leerToken(t, 1000 + H10 + 1, 'sec', hmac), null);
});

test('token: adulterado o basura → null', () => {
  const t = L.crearToken('30123456', 1000, 'sec', hmac);
  const [datos, firma] = t.split('.');
  const otraFirma = firma.slice(0, -1) + (firma.slice(-1) === 'A' ? 'B' : 'A');
  assert.equal(L.leerToken(datos + '.' + otraFirma, 1000, 'sec', hmac), null);
  const otroDato = L.crearToken('99999999', 1000, 'sec', hmac).split('.')[0];
  assert.equal(L.leerToken(otroDato + '.' + firma, 1000, 'sec', hmac), null);
  assert.equal(L.leerToken(t, 1000, 'otro-secreto', hmac), null);
  for (const x of ['basura', '', undefined, null, 'a.b.c', '%%%.%%%']) assert.equal(L.leerToken(x, 1000, 'sec', hmac), null);
});

// ---------- Task 4 ----------

test('validarMarca', () => {
  const ok = m => assert.equal(L.validarMarca(m), null, JSON.stringify(m));
  const mal = m => assert.equal(L.validarMarca(m), 'datos_invalidos', JSON.stringify(m));
  mal({ canal: 'LL', resultado: 'VUELVE' });
  ok({ canal: 'LL', resultado: 'VUELVE', fecha: '2026-11-10' });
  mal({ canal: 'LL', resultado: 'VUELVE', fecha: '10/11' });
  mal({ canal: 'LL', resultado: 'VUELVE', fecha: '2026-02-30' });
  mal({ canal: 'MP', resultado: 'PAGA' });
  mal({ canal: 'MP', resultado: 'VACACIONES' });
  mal({ canal: 'PR', resultado: 'BAJA' });
  mal({ canal: 'PR', resultado: 'BAJA', detalle: '   ' });
  ok({ canal: 'PR', resultado: 'BAJA', detalle: 'Se muda' });
  mal({ canal: 'WHATSAPP', resultado: 'RESERVA' });
  mal({ canal: 'MP', resultado: 'VINO' });
  ok({ canal: 'MP', resultado: 'ENCUESTA ENVIADA' });
  ok({ canal: 'SIN CONTACTO', resultado: 'NO CONTESTA' });
});

test('diasHabiles', () => {
  assert.equal(L.diasHabiles('2026-11-05', '2026-11-09'), 2);
  assert.equal(L.diasHabiles('2026-11-09', '2026-11-09'), 0);
  assert.equal(L.diasHabiles('2026-11-07', '2026-11-09'), 0);
  assert.equal(L.diasHabiles('2026-11-02', '2026-11-09'), 5);
  assert.equal(L.diasHabiles('', '2026-11-09'), 0);
});

// ---------- Task 5 ----------

const nueva = o => ({ sede: 'bolson', socio_id: '501', socio_nombre: 'Socio Uno', profe: 'Profe A', tipo: 'Riesgo alto',
                      prioridad: '5', situacion: 's', accion: 'a', ultima_anotacion: '', asignado_dni: '30123456', ...o });

test('fusionarCarga: nueva, repetida y arrastre', () => {
  let f = L.fusionarCarga([], [nueva({})], [], '2026-11-06');
  assert.equal(f.length, 1);
  assert.equal(f[0].id, '2026-11-06-bolson-501');
  assert.equal(f[0].pendiente_desde, '2026-11-06');
  assert.equal(f[0].estado, 'pendiente');
  // al día siguiente hábil, mismo socio con otro tipo y otra persona: se conserva id, persona y pendiente_desde
  f = L.fusionarCarga(f, [nueva({ tipo: 'Vence en 7 días', prioridad: '2', asignado_dni: '28999888' })], [], '2026-11-09');
  assert.equal(f.length, 1);
  assert.equal(f[0].id, '2026-11-06-bolson-501');
  assert.equal(f[0].asignado_dni, '30123456');
  assert.equal(f[0].pendiente_desde, '2026-11-06');
  assert.equal(f[0].fecha, '2026-11-09');
  assert.equal(f[0].tipo, 'Vence en 7 días');
});

test('fusionarCarga: lo hecho hoy no reaparece; lo hecho otro día sí', () => {
  const hecha = { ...L.fusionarCarga([], [nueva({})], [], '2026-11-09')[0], estado: 'hecha' };
  assert.equal(L.fusionarCarga([hecha], [nueva({})], [], '2026-11-09').length, 1);
  const f = L.fusionarCarga([{ ...hecha, fecha: '2026-11-02' }], [nueva({})], [], '2026-11-09');
  assert.equal(f.length, 2);
});

test('fusionarCarga: cerrar y limpiar viejas', () => {
  const base = L.fusionarCarga([], [nueva({}), nueva({ socio_id: '502' })], [], '2026-11-09');
  const f = L.fusionarCarga(base, [], [{ sede: 'bolson', socio_id: '502' }], '2026-11-09');
  assert.equal(f.find(t => t.socio_id === '502').estado, 'cerrada');
  assert.equal(f.find(t => t.socio_id === '501').estado, 'pendiente');
  const vieja = { ...base[0], id: 'v', fecha: '2026-09-01', estado: 'hecha' };
  assert.equal(L.fusionarCarga([vieja], [], [], '2026-11-09').length, 0);
  const viejaPend = { ...vieja, estado: 'pendiente' };
  assert.equal(L.fusionarCarga([viejaPend], [], [], '2026-11-09').length, 1);
});

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

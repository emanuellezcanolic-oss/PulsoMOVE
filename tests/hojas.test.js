// La escritura sobre la planilla, con una hoja simulada: quien lee sin esperar turno nunca debe encontrarla vacía.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function hojaFalsa(filas, alCambiar) {
  const h = {
    filas,
    getLastRow: () => h.filas.length,
    getMaxRows: () => 1000,
    setFrozenRows: () => h,
    appendRow: f => { h.filas.push(f); alCambiar(); return h; },
    getRange: (fila, col, n, cols) => ({
      setNumberFormat() { return this; },
      setFontWeight() { return this; },
      setValues(v) { v.forEach((x, i) => { h.filas[fila - 1 + i] = x; }); alCambiar(); return this; },
      clearContent() { h.filas.splice(fila - 1, n); alCambiar(); return this; },
      getDisplayValues: () => h.filas.slice(fila - 1, fila - 1 + n),
    }),
  };
  return h;
}

function cargarRepo(hojas) {
  const libro = {
    getSheetByName: n => hojas[n] || null,
    insertSheet: n => (hojas[n] = hojaFalsa([], () => {})),
  };
  const ctx = vm.createContext({
    SpreadsheetApp: { openById: () => libro },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'id' }) },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Hojas.js'), 'utf8'), ctx);
  return vm.runInContext('repoHojas()', ctx);
}

const COLS = ['dni', 'nombre', 'sede', 'turno', 'roles', 'pin_hash', 'sal', 'debe_cambiar_pin', 'intentos', 'bloqueado_hasta', 'activo', 'hora_inicio', 'hora_fin'];
const fila = dni => ({ dni, nombre: 'N' + dni });
const aFila = o => COLS.map(c => o[c] || '');

test('reescribir una hoja nunca la deja vacía para quien lee en ese momento', () => {
  const vistas = [];
  const h = hojaFalsa([COLS, aFila(fila('1')), aFila(fila('2')), aFila(fila('3'))], () => vistas.push(h.filas.length - 1));
  const repo = cargarRepo({ usuarios: h });
  repo.escribir('usuarios', [fila('1'), fila('2')]);
  assert.ok(vistas.length > 0);
  assert.ok(vistas.every(n => n >= 2), 'filas vistas en cada paso: ' + vistas.join(','));
});

test('reescribir con menos filas borra las que sobran', () => {
  const h = hojaFalsa([COLS, aFila(fila('1')), aFila(fila('2')), aFila(fila('3'))], () => {});
  const repo = cargarRepo({ usuarios: h });
  repo.escribir('usuarios', [fila('9')]);
  assert.deepEqual(Array.from(repo.leer('usuarios').map(u => u.dni)), ['9']);
});

test('reescribir con más filas y con ninguna', () => {
  const h = hojaFalsa([COLS, aFila(fila('1'))], () => {});
  const repo = cargarRepo({ usuarios: h });
  repo.escribir('usuarios', [fila('1'), fila('2'), fila('3')]);
  assert.equal(repo.leer('usuarios').length, 3);
  repo.escribir('usuarios', []);
  assert.equal(repo.leer('usuarios').length, 0);
});

test('leer una hoja que todavía no existe no la crea', () => {
  const hojas = {};
  const repo = cargarRepo(hojas);
  assert.equal(repo.leer('cierres').length, 0);
  assert.equal(hojas.cierres, undefined);
});

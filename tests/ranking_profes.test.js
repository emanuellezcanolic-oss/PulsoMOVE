const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const BELEN = usuario({ dni: '20111222', nombre: 'Belén Juárez', roles: 'profe', sede: 'bolson' });
const ENZO = usuario({ dni: '20333444', nombre: 'Enzo Legammari', roles: 'profe', sede: 'bolson' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación', roles: 'coordinador', sede: 'bolson' });
const RECE = usuario({ dni: '20999000', nombre: 'Rocío', roles: 'recepcion', sede: 'bolson' });
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;

function entorno() {
  const hoy = '2026-11-16';
  const d = depsFalsas({ repo: repoFalso({ usuarios: [BELEN, ENZO, COORD, RECE] }), hoy, ahora: Date.parse(hoy + 'T15:00:00Z') });
  pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy, tareas: [
    { id: 'pp-1', fecha: hoy, sede: 'bolson', profe: 'Belen Juarez', profe_dni: '20111222', socio_id: '1', socio_nombre: 'Ana', tipo: 'Renovar plan', accion: 'x', vence: hoy, alta: '' },
    { id: 'pp-2', fecha: hoy, sede: 'bolson', profe: 'Enzo Legammari', profe_dni: '20333444', socio_id: '2', socio_nombre: 'Juan', tipo: 'Renovar plan', accion: 'x', vence: hoy, alta: '' }] });
  pedir(d, { accion: 'cargar_profe_estado', clave: PROPS.CLAVE_CARGA, filas: [
    { clave: 'prof:30', tipo: 'profe', nombre: 'Belén Juárez', sede: 'bolson', datos: { '2026-11': { activos: 90, desercion: 8 } } },
    { clave: 'prof:32', tipo: 'profe', nombre: 'Enzo Legammari', sede: 'bolson', datos: { '2026-11': { activos: 80, desercion: 22 } } }] });
  pedir(d, { accion: 'cargar_profe_coordinacion', clave: PROPS.CLAVE_CARGA, hoy, filas: [
    { profe: 'Belen Juarez', profe_dni: '20111222', sede: 'bolson', datos: { al_dia_pct: 90, vencidos: 3 } },
    { profe: 'Enzo Legammari', profe_dni: '20333444', sede: 'bolson', datos: { al_dia_pct: 50, vencidos: 20 } }] });
  return d;
}

test('ranking de profes: puntaje sobre 100 con las reglas a la vista y sin plata', () => {
  const d = entorno();
  pedir(d, { accion: 'cargar_profe_liq', clave: PROPS.CLAVE_CARGA, filas: [{ mes: '2026-11', profe: 'Belen Juarez', profe_dni: '20111222', sede: 'bolson',
    datos: { activos_mes: 46, metas: [36, 37, 45, 55], nivel: 2, nivel_txt: 'Objetivo 2', valor_socio: 700, comision: 32200 } }] });
  const R = pedir(d, { accion: 'ranking_profes', token: entrar(d, '20111222') }).data;
  assert.equal(R.reglas.reduce((a, r) => a + r.max, 0), 100);
  assert.deepEqual(R.personas.map(p => p.nombre), ['Belén Juárez', 'Enzo Legammari']);
  const b = R.personas[0];
  assert.equal(b.items.desercion.pts, 30);
  assert.equal(b.items.al_dia.pts, 27);
  assert.equal(b.items.activos.pts, 7);
  assert.equal(b.items.tareas.pts, 0);          // todavía no marcó tareas del mes
  assert.equal(b.total, 64);
  assert.equal(b.donde_sumar.clave, 'custom');
  assert.equal(R.personas[1].items.desercion.pts, 10);
  assert.equal(R.personas[1].items.activos, null);
  assert.ok(!JSON.stringify(R).includes('32200'));
  assert.equal(R.mi_dni, '20111222');
  // coordinación lo ve; recepción no
  assert.equal(pedir(d, { accion: 'ranking_profes', token: entrar(d, '20555666') }).data.personas.length, 2);
  assert.equal(pedir(d, { accion: 'ranking_profes', token: entrar(d, '20999000') }).error, 'prohibido');
});

test('tramos de deserción', () => {
  assert.deepEqual([5, 10, 12, 20, 25, 26, null].map(L.puntosRankDesercion), [30, 30, 25, 20, 10, 0, null]);
});

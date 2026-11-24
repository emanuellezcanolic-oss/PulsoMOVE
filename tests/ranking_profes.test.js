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
    // los puntos van con los 3 meses cerrados (ago–oct): Belén 12 de 105 (11,4%), Enzo 21 de 110 (19,1%); noviembre no cuenta
    { clave: 'prof:30', tipo: 'profe', nombre: 'Belén Juárez', sede: 'bolson', datos: { '2026-08': { real: { bajas: 5, vencian: 40 } },
      '2026-09': { real: { bajas: 4, vencian: 35 } }, '2026-10': { real: { bajas: 3, vencian: 30 } }, '2026-11': { activos: 90, desercion: 40, real: { bajas: 30, vencian: 40 } } } },
    { clave: 'prof:32', tipo: 'profe', nombre: 'Enzo Legammari', sede: 'bolson', datos: { '2026-08': { real: { bajas: 8, vencian: 40 } },
      '2026-09': { real: { bajas: 7, vencian: 40 } }, '2026-10': { real: { bajas: 6, vencian: 30 } }, '2026-11': { activos: 80, desercion: 2 } } }] });
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
  assert.equal(b.items.desercion.valor, '11,4%');
  assert.match(b.items.desercion.extra, /ago–oct · 12 de 105/);
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

test('tramos de deserción: una sola tabla para Cómo venís y el ranking (24/11/2026)', () => {
  const t = [5, 10, 14, 14.1, 18, 18.5, 22, 22.1, 40, null];
  assert.deepEqual(t.map(L.puntosRankDesercion), [30, 30, 30, 20, 20, 10, 10, 5, 5, null]);
  assert.deepEqual(t.map(L.puntosDesercion), t.map(L.puntosRankDesercion));
});

test('deserción de 3 meses cerrados: suma de bajas ÷ suma de vencimientos, mínimo 60', () => {
  const datos = { '2026-07': { real: { bajas: 50, vencian: 50 } }, '2026-08': { real: { bajas: 2, vencian: 10 } }, '2026-09': { real: { bajas: 10, vencian: 30 } },
    '2026-10': { real: { bajas: 3, vencian: 30 } }, '2026-11': { real: { bajas: 30, vencian: 30 } } };
  const r = L.desercion3Meses(datos, '2026-11');
  assert.deepEqual(Array.from(r.meses), ['2026-08', '2026-09', '2026-10']);
  assert.equal(r.vencian, 70);
  assert.equal(r.bajas, 15);
  assert.equal(r.desercion, 21.4);           // ponderado: 15/70, no el promedio de 20%, 33% y 10%
  assert.equal(r.motivo, '');
  // enero mira los 3 meses del año anterior
  assert.deepEqual(Array.from(L.desercion3Meses({}, '2027-01').meses), ['2026-10', '2026-11', '2026-12']);
  // sin 60 vencimientos: sin dato y se dice por qué
  const poco = L.desercion3Meses({ '2026-09': { real: { bajas: 1, vencian: 25 } }, '2026-10': { real: { bajas: 1, vencian: 34 } } }, '2026-11');
  assert.equal(poco.desercion, null);
  assert.equal(poco.vencian, 59);
  assert.match(poco.motivo, /59 socios.*al menos 60/);
  // meses solo con la deserción de MOVE (sin la de la PC) no cuentan
  assert.equal(L.desercion3Meses({ '2026-10': { desercion: 5, activos: 200 } }, '2026-11').vencian, 0);
});

test('ranking de profes: sin 60 vencimientos en 3 meses no hay puntos de deserción y se dice por qué', () => {
  const d = entorno();
  pedir(d, { accion: 'cargar_profe_estado', clave: PROPS.CLAVE_CARGA, filas: [
    { clave: 'prof:30', tipo: 'profe', nombre: 'Belén Juárez', sede: 'bolson', datos: { '2026-10': { real: { bajas: 0, vencian: 40 } }, '2026-11': { activos: 40, desercion: 0 } } }] });
  const R = pedir(d, { accion: 'ranking_profes', token: entrar(d, '20111222') }).data;
  const b = R.personas.find(p => p.nombre === 'Belén Juárez');
  assert.equal(b.items.desercion.pts, 0);
  assert.equal(b.items.desercion.sin_dato, true);
  assert.match(b.items.desercion.motivo, /40 socios/);
  assert.notEqual(b.donde_sumar && b.donde_sumar.clave, 'desercion');
  assert.match(R.reglas.find(r => r.clave === 'desercion').como, /Hasta 14%: 30 · hasta 18%: 20 · hasta 22%: 10 · más de 22%: 5/);
});

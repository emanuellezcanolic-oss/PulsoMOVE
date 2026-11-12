const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const ADMIN = usuario({ dni: '20000001', nombre: 'Lucía Admin', roles: 'recepcion,coordinador,admin', sede: 'bolson' });
const TANI = usuario({ dni: '20000002', nombre: 'Tani', roles: 'recepcion', sede: 'bolson', turno: 'tarde' });
const AZUL = usuario({ dni: '20000003', nombre: 'Azul', roles: 'recepcion', sede: 'puelo', turno: 'tarde' });
const KEILA = usuario({ dni: '20000004', nombre: 'Keila', roles: 'recepcion,coordinador', sede: 'bariloche' });
const PROFE = usuario({ dni: '20000005', nombre: 'Profe', roles: 'profe', sede: 'bolson' });

const entorno = (extra = {}) => depsFalsas({ repo: repoFalso({ usuarios: [ADMIN, TANI, AZUL, KEILA, PROFE], ...extra }), hoy: '2026-11-12', ahora: Date.parse('2026-11-12T15:00:00Z') });
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;
const fila = (dni, mes, datos) => ({ dni, mes, datos: JSON.stringify(datos), actualizado: '' });

test('el tramo de la comisión sale de los ingresos nuevos y los objetivos de la sede', () => {
  const metas = [10.6, 11.2, 14, 16];
  assert.equal(L.liqTramo(7, metas), 0);
  assert.equal(L.liqTramo(13, metas), 1);
  assert.equal(L.liqTramo(14, metas), 2);
  assert.equal(L.liqTramo(28, metas), 3);
  assert.equal(L.liqTramo(null, metas), null);
  assert.equal(L.liqTramo(20, []), null, 'sin objetivos cargados no hay tramo');
});

test('la liquidación suma horas, comisión y extras; la comisión cargada a mano manda', () => {
  const cfg = L.liqConfigDelMes([], '2026-06');
  const base = fila('x', '2026-06', { valor_hora: 8100, horas: 120, nuevos: 13, extras: [{ c: 'Aguinaldo', m: 1000 }, { c: 'Consumo staff', m: -500 }] });
  const l = L.liqCalcular('puelo', base, null, cfg, null);
  assert.equal(l.base, 972000);
  assert.equal(l.tramo, 1);
  assert.equal(l.comision_calculada, 8424, '13 nuevos por 648');
  assert.equal(l.total, 972000 + 8424 + 500);
  const manual = L.liqCalcular('puelo', fila('x', '2026-06', { valor_hora: 8100, horas: 120, nuevos: 13, comision: 5000 }), null, cfg, null);
  assert.equal(manual.comision, 5000);
  assert.equal(manual.comision_manual, true);
  assert.equal(manual.comision_calculada, 8424);
});

test('un mes sin cargar arrastra el valor hora y las horas del último mes con datos', () => {
  const cfg = L.liqConfigDelMes([], '2026-11');
  const previa = fila('x', '2026-10', { valor_hora: 8748, horas: 120 });
  const l = L.liqCalcular('bolson', null, previa, cfg, 9);
  assert.equal(l.cargado, false);
  assert.equal(l.base, 1049760);
  assert.equal(l.nuevos, 9);
  assert.equal(l.comision, 9 * 480);
});

test('la configuración de un mes vale hasta que se cargue otra', () => {
  const filas = [fila('*', '2026-03', { tarifas: [480, 648, 720, 864], metas: { bolson: [1, 2, 3, 4] } })];
  assert.deepEqual(L.liqConfigDelMes(filas, '2026-02').metas.bolson, [19, 20, 25, 27]);
  assert.deepEqual(L.liqConfigDelMes(filas, '2026-11').metas.bolson, [1, 2, 3, 4]);
});

test('recepción ve solo lo suyo y admin ve a todas', () => {
  const d = entorno({ liquidacion: [fila(TANI.dni, '2026-11', { valor_hora: 8748, horas: 120, nuevos: 21 }), fila(AZUL.dni, '2026-11', { valor_hora: 8748, horas: 120 })] });
  const propia = pedir(d, { accion: 'liquidacion_ver', token: entrar(d, TANI.dni) });
  assert.equal(propia.ok, true);
  assert.deepEqual(propia.data.personas.map(p => p.dni), [TANI.dni]);
  assert.equal(propia.data.puede_editar, false);
  assert.equal(pedir(d, { accion: 'liquidacion_ver', token: entrar(d, TANI.dni), dni: AZUL.dni }).error, 'prohibido');
  const coord = pedir(d, { accion: 'liquidacion_ver', token: entrar(d, KEILA.dni) });
  assert.deepEqual(coord.data.personas.map(p => p.dni), [KEILA.dni], 'una coordinadora que no es admin ve solo lo suyo');
  const todas = pedir(d, { accion: 'liquidacion_ver', token: entrar(d, ADMIN.dni) });
  assert.deepEqual(todas.data.personas.map(p => p.dni).sort(), [ADMIN.dni, AZUL.dni, KEILA.dni, TANI.dni].sort());
  assert.equal(todas.data.puede_editar, true);
  assert.equal(pedir(d, { accion: 'liquidacion_ver', token: entrar(d, PROFE.dni) }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'liquidacion_ver' }).error, 'sin_sesion');
});

test('guardar y configurar son solo de admin, y se valida lo que entra', () => {
  const d = entorno();
  const tani = entrar(d, TANI.dni), adm = entrar(d, ADMIN.dni);
  const datos = { valor_hora: 8748, horas: 120, nuevos: 21, extras: [{ c: 'Aguinaldo', m: 500000 }] };
  assert.equal(pedir(d, { accion: 'liquidacion_guardar', token: tani, dni: TANI.dni, mes: '2026-11', datos }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'liquidacion_config_guardar', token: tani, mes: '2026-11', tarifas: [1, 2, 3, 4], metas: {} }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'liquidacion_guardar', token: adm, dni: TANI.dni, mes: 'noviembre', datos }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'liquidacion_guardar', token: adm, dni: TANI.dni, mes: '2026-11', datos: { valor_hora: -1 } }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'liquidacion_guardar', token: adm, dni: TANI.dni, mes: '2026-11', datos: { extras: [{ c: '', m: 5 }] } }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'liquidacion_guardar', token: adm, dni: '99999999', mes: '2026-11', datos }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'liquidacion_guardar', token: adm, dni: TANI.dni, mes: '2026-11', datos }).ok, true);
  const ver = pedir(d, { accion: 'liquidacion_ver', token: tani }).data.personas[0].liquidacion;
  assert.equal(ver.total, 1049760 + Math.round(21 * 648) + 500000, '21 nuevos en Bolsón: objetivo 1');
  assert.equal(ver.extras[0].c, 'Aguinaldo');
  assert.equal(pedir(d, { accion: 'liquidacion_config_guardar', token: adm, mes: '2026-11', tarifas: [500, 700, 800, 900], metas: { bolson: [10, 20, 30, 40], puelo: [1, 2, 3, 4], bariloche: [] } }).ok, true);
  assert.equal(pedir(d, { accion: 'liquidacion_ver', token: tani }).data.personas[0].liquidacion.tarifa, 700, 'cambia la tarifa del tramo');
});

test('la progresión mes a mes trae cada mes cargado', () => {
  const d = entorno({ liquidacion: [fila(TANI.dni, '2026-09', { valor_hora: 8748, horas: 120, nuevos: 10 }), fila(TANI.dni, '2026-10', { valor_hora: 8748, horas: 120, nuevos: 7, extras: [{ c: 'Online', m: 250000 }] })] });
  const p = pedir(d, { accion: 'liquidacion_ver', token: entrar(d, TANI.dni), mes: '2026-10' }).data.personas[0];
  assert.deepEqual(p.serie.map(s => s.mes), ['2026-09', '2026-10'], 'hasta el mes que se está mirando');
  assert.equal(p.serie[1].extras, 250000);
  assert.equal(p.liquidacion.total, 1049760 + 7 * 480 + 250000);
});

test('horas por QR: con salida son reales, sin salida se toman las previstas, y se agrupan por semana', () => {
  const d = entorno({
    liq_qr: [
      { dni: TANI.dni, fecha: '2026-11-09', entrada: '15:02', salida: '21:10', n: '2' },   // lunes: 6,13 h reales
      { dni: TANI.dni, fecha: '2026-11-10', entrada: '14:55', salida: '', n: '1' },        // martes: sin salida
      { dni: TANI.dni, fecha: '2026-11-12', entrada: '15:00', salida: '15:20', n: '2' },   // jueves: salida demasiado corta, se descarta
      { dni: TANI.dni, fecha: '2026-10-30', entrada: '15:00', salida: '21:00', n: '2' },   // otro mes
    ],
  });
  const q = pedir(d, { accion: 'liquidacion_ver', token: entrar(d, TANI.dni), mes: '2026-11' }).data.personas[0].qr;
  assert.equal(q.dias_con_qr, 3);
  assert.equal(q.dias_reales, 1);
  assert.equal(q.dias[0].horas, 6.13);
  assert.equal(q.dias[1].horas, 6, 'estimada con las horas previstas');
  assert.equal(q.total, 18.1);
  assert.equal(q.semanas.length, 1);
  assert.equal(q.semanas[0].desde, '2026-11-09');
  assert.equal(q.dias_sin_qr, 6, 'del 2 al 6 y el 11 debía venir y no hay QR');
});

test('las horas por día se editan y cambian la estimación; Rubén puede tener sábado', () => {
  const d = entorno({ liq_qr: [{ dni: KEILA.dni, fecha: '2026-11-07', entrada: '09:00', salida: '', n: '1' }] });
  const adm = entrar(d, ADMIN.dni);
  assert.equal(pedir(d, { accion: 'liquidacion_horas_guardar', token: adm, dni: KEILA.dni, dias: [7, 7, 7, 7, 7, 4] }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'liquidacion_horas_guardar', token: entrar(d, TANI.dni), dni: KEILA.dni, dias: [7, 7, 7, 7, 7, 4, 0] }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'liquidacion_horas_guardar', token: adm, dni: KEILA.dni, dias: [7, 7, 7, 7, 7, 4, 0] }).ok, true);
  const k = pedir(d, { accion: 'liquidacion_ver', token: adm }).data.personas.find(p => p.dni === KEILA.dni);
  assert.deepEqual(k.dias_horas, [7, 7, 7, 7, 7, 4, 0]);
  assert.equal(k.qr.dias[0].horas, 4, 'sábado con 4 horas previstas');
  assert.equal(k.qr.previstas_mes, 7 * 21 + 4 * 4, 'noviembre 2026: 21 días de semana y 4 sábados');
});

test('cargar_liquidacion pide clave y no pisa lo que ya se editó, salvo que se pida', () => {
  const d = entorno({ liquidacion: [fila(TANI.dni, '2026-10', { valor_hora: 1, horas: 1 })] });
  const envio = (extra = {}) => pedir(d, { accion: 'cargar_liquidacion', clave: PROPS.CLAVE_CARGA, filas: [{ dni: TANI.dni, mes: '2026-10', datos: { valor_hora: 9, horas: 9 } }, { dni: TANI.dni, mes: '2026-09', datos: { valor_hora: 5, horas: 5 } }], ...extra });
  assert.equal(pedir(d, { accion: 'cargar_liquidacion', clave: 'mal', filas: [] }).error, 'clave');
  assert.deepEqual(envio().data, { nuevas: 1, pisadas: 0 });
  assert.equal(JSON.parse(d.repo.hojas.liquidacion.find(f => f.mes === '2026-10').datos).valor_hora, 1);
  assert.deepEqual(envio({ pisar: true }).data, { nuevas: 0, pisadas: 2 });
  assert.equal(JSON.parse(d.repo.hojas.liquidacion.find(f => f.mes === '2026-10').datos).valor_hora, 9);
  assert.equal(pedir(d, { accion: 'cargar_liquidacion', clave: PROPS.CLAVE_CARGA, filas: [{ dni: TANI.dni, mes: 'x', datos: {} }] }).error, 'datos_invalidos');
});

test('cargar_liq_qr reemplaza los mismos días y deja los demás', () => {
  const d = entorno({ liq_qr: [{ dni: TANI.dni, fecha: '2026-11-09', entrada: '15:00', salida: '', n: '1', actualizado: '' }, { dni: TANI.dni, fecha: '2026-11-10', entrada: '15:00', salida: '', n: '1', actualizado: '' }] });
  assert.equal(pedir(d, { accion: 'cargar_liq_qr', clave: 'mal', filas: [] }).error, 'clave');
  assert.equal(pedir(d, { accion: 'cargar_liq_qr', clave: PROPS.CLAVE_CARGA, filas: [{ dni: TANI.dni, fecha: 'ayer' }] }).error, 'datos_invalidos');
  assert.deepEqual(pedir(d, { accion: 'cargar_liq_qr', clave: PROPS.CLAVE_CARGA, filas: [{ dni: TANI.dni, fecha: '2026-11-09', entrada: '15:00', salida: '21:00', n: 2 }] }).data, { filas: 1 });
  const hoja = d.repo.hojas.liq_qr;
  assert.equal(hoja.length, 2);
  assert.equal(hoja.find(f => f.fecha === '2026-11-09').salida, '21:00');
});

test('los socios nuevos de noviembre salen de las cajas del mes entero y los meses anteriores de la planilla', () => {
  const venta = (dni, fecha, nuevos) => ({ fecha, sede: 'bolson', dni, nombre: 'x', nuevos: String(nuevos) });
  const d = entorno({
    liquidacion: [fila(TANI.dni, '2026-10', { valor_hora: 8748, horas: 120, nuevos: 18 })],
    ventas: [venta(TANI.dni, '2026-10', 99), venta(TANI.dni, '2026-11-02', 4), venta(TANI.dni, '2026-11-10', 3), venta(AZUL.dni, '2026-11-05', 9)],
  });
  const serie = L.liqNuevosPorMes(TANI.dni, d.repo.leer('liquidacion'), d.repo.leer('ventas'), '2026-11');
  assert.deepEqual(serie.map(s => [s.mes, s.nuevos, s.fuente]), [['2026-10', 18, 'liquidacion'], ['2026-11', 7, 'cajas']]);
  const r = pedir(d, { accion: 'liquidacion_ver', token: entrar(d, TANI.dni) });
  assert.equal(r.data.personas[0].liquidacion.nuevos, 7, 'la comisión de noviembre cuenta desde el día 1');
  const rend = pedir(d, { accion: 'rendimiento', token: entrar(d, ADMIN.dni), sede: 'bolson' });
  const tani = rend.data.personas.find(p => p.dni === TANI.dni);
  assert.equal(tani.nuevos_meses.length, 2);
});

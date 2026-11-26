// Liquidación de profes y de kinesiología (LiqProfes.js). Datos y valores inventados: el repositorio no trae ninguna cifra real.
const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const ADMIN = usuario({ dni: '40000001', nombre: 'Admin Prueba', roles: 'recepcion,coordinador,admin', sede: 'bolson' });
const COORD = usuario({ dni: '40000002', nombre: 'Coord Prueba', roles: 'recepcion,coordinador', sede: 'bolson' });
const REC = usuario({ dni: '40000003', nombre: 'Recep Prueba', roles: 'recepcion', sede: 'bolson' });
const PA = usuario({ dni: '40000004', nombre: 'Ana Profe', roles: 'profe', sede: 'bolson' });
const PB = usuario({ dni: '40000005', nombre: 'Beto Profe', roles: 'profe', sede: 'puelo' });
const KI = usuario({ dni: '40000006', nombre: 'Kina Kine', roles: 'profe', sede: 'bariloche' });
const KI2 = usuario({ dni: '40000007', nombre: 'Kiko Kine', roles: 'profe', sede: 'bariloche' });

const HOY = '2026-11-24';
const fila = (tipo, mes, dni, datos, id = '') => ({ mes, dni, tipo, id, datos: JSON.stringify(datos), actualizado: '' });
// valores inventados y bien distintos entre sí, para poder buscarlos en lo que ve cada rol
const CFG = { valores: [101, 202, 303, 404], tarifas: { 'SESIÓN 0': 7001, X1: 7002, 'X1 M': 7003, X2: 7004, 'X2 M': 7005, X3: 7006, 'X3 M': 7007 }, valor_plantilla: 5003 };
const PROFE_A = { tipo: 'profe', valor_hora: 3571, horas_mes: 100, horas_semana: 27.5, monotributo: 1234 };
const KINE = { tipo: 'kine', valor_hora: 4111, horas_mes: 50, metas: [10, 15, 20, 30], valores: [1010, 2020, 3030, 4040] };

function entorno(extra = {}, hoy = HOY) {
  return depsFalsas({ repo: repoFalso({ usuarios: [ADMIN, COORD, REC, PA, PB, KI, KI2], ...extra }), hoy, ahora: Date.parse(hoy + 'T15:00:00Z') });
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;
const ver = (d, dni, extra = {}) => pedir(d, Object.assign({ accion: 'liqpro_ver', token: entrar(d, dni), mes: '2026-10' }, extra));
const mov = (periodo, profe, dni, datos) => ({ periodo, profe, profe_dni: dni, sede: 'bolson', datos: JSON.stringify(datos), cargada: HOY });
const base = () => entorno({
  liqpro: [fila('config', '2026-09', '*', CFG), fila('persona', '2026-09', PA.dni, PROFE_A), fila('persona', '2026-09', KI.dni, KINE)],
  liqpro_mov: [mov('2026-10', 'Ana Profe', PA.dni, { renovaciones: 30, x2: 5, liberados: 4, nuevos: 12, online: 2, lista: [{ nombre: 'Socio Uno', tipo: 'renueva' }] })],
});

test('el período del mes M va del 6 de M al 5 de M+1 y cierra el 5', () => {
  assert.deepEqual(L.lpPeriodo('2026-10'), { desde: '2026-10-06', hasta: '2026-11-05' });
  assert.deepEqual(L.lpPeriodo('2026-12'), { desde: '2026-12-06', hasta: '2027-01-05' });
  assert.equal(L.lpPeriodoDe('2026-11-05'), '2026-10');
  assert.equal(L.lpPeriodoDe('2026-11-06'), '2026-11');
  assert.equal(L.lpPeriodoDe('2027-01-03'), '2026-12');
  assert.equal(L.lpEstadoDe('2026-10', '2026-11-05', false), 'en_curso');
  assert.equal(L.lpEstadoDe('2026-10', '2026-11-06', false), 'cerrada');
  assert.equal(L.lpEstadoDe('2026-10', '2026-11-06', true), 'liquidada');
});

test('comisión del profe: valor del nivel × (renueva + 2·X2 + liberados); los nuevos no cobran', () => {
  const d = base();
  const l = ver(d, ADMIN.dni).data.personas.find(p => p.dni === PA.dni).liquidacion;
  assert.deepEqual(l.metas, [36, 37, 45, 55], 'horas 27,5: floor(h×40/41/50/60÷30)');
  assert.equal(l.cobran, 30 + 2 * 5 + 4);
  assert.equal(l.activos, 44 + 12, 'los nuevos suman a los activos (nivel)');
  assert.equal(l.nivel, 3);
  assert.equal(l.etiqueta, 'Máximo');
  assert.equal(l.comision_calculada, 404 * 44, 'pero no se le pagan');
  assert.equal(l.faltan_siguiente, 0);
  assert.equal(l.nuevos, 12);
  assert.ok(!l.lineas.some(x => /nuevo/i.test(x.t)), 'no hay línea de pago por nuevos');
});

test('que los nuevos sumen a los activos viene encendido y se puede apagar', () => {
  const d = base();
  assert.equal(L.lpConfigDelMes([], '2026-10').nuevos_en_activos, true);
  d.repo.hojas.liqpro.push(fila('config', '2026-10', '*', Object.assign({}, CFG, { nuevos_en_activos: false })));
  const l = ver(d, ADMIN.dni).data.personas.find(p => p.dni === PA.dni).liquidacion;
  assert.equal(l.activos, 44);
  assert.equal(l.nivel, 1);
  assert.equal(l.cobran, 44);
  assert.equal(l.comision_calculada, 202 * 44);
  // guardar la configuración sin decir nada lo deja encendido
  assert.ok(pedir(d, { accion: 'liqpro_config_guardar', token: entrar(d, ADMIN.dni), mes: '2026-10', valores: [1, 2, 3, 4], tarifas: {} }).ok);
  assert.equal(ver(d, ADMIN.dni).data.config.nuevos_en_activos, true);
});

test('plan largo sin asistencia: no se paga hasta que admin marca «sí entrenó», y queda el historial', () => {
  const d = base();
  const sin = [{ clave: '7-70-2', socio_id: '7', nombre: 'Socio Siete', mes: 2, de: 3 }];
  d.repo.hojas.liqpro_mov = [mov('2026-10', 'Ana Profe', PA.dni, { renovaciones: 30, sin_asistencia: sin })];
  let p = ver(d, PA.dni).data.personas[0];
  assert.equal(p.liquidacion.cobran, 30);
  const linea = p.liquidacion.lineas.find(x => x.k === 'sin_asistencia');
  assert.match(linea.t, /Sin asistencia registrada/);
  assert.equal(linea.monto, 0);
  assert.equal(p.mov.sin_asistencia[0].marcado, false);
  const marcar = (dni, extra = {}) => pedir(d, Object.assign({ accion: 'liqpro_entreno', token: entrar(d, dni), dni: PA.dni, mes: '2026-10', clave: '7-70-2' }, extra));
  assert.equal(marcar(PA.dni).error, 'prohibido', 'el profe no se marca solo');
  assert.equal(marcar(COORD.dni).error, 'prohibido');
  assert.equal(marcar(ADMIN.dni, { clave: 'otra' }).error, 'no_encontrado');
  assert.ok(marcar(ADMIN.dni).ok);
  p = ver(d, PA.dni).data.personas[0];
  assert.equal(p.liquidacion.cobran, 31);
  assert.ok(!p.liquidacion.lineas.some(x => x.k === 'sin_asistencia'));
  assert.match(p.liquidacion.lineas.find(x => x.k === 'comision').como, /1 marcado «sí entrenó»/);
  assert.equal(p.mov.sin_asistencia[0].historial[0].por, 'Admin Prueba');
  // se puede deshacer y queda anotado; la marca sobrevive a una nueva subida de la PC
  assert.ok(marcar(ADMIN.dni, { entreno: false }).ok);
  assert.equal(ver(d, PA.dni).data.personas[0].liquidacion.cobran, 30);
  assert.ok(marcar(ADMIN.dni).ok);
  assert.equal(ver(d, PA.dni).data.personas[0].mov.sin_asistencia[0].historial.length, 3);
  assert.ok(pedir(d, { accion: 'cargar_liqpro_mov', clave: PROPS.CLAVE_CARGA, filas: [mov('2026-10', 'Ana Profe', PA.dni, { renovaciones: 30, sin_asistencia: sin })] }).ok);
  assert.equal(ver(d, PA.dni).data.personas[0].liquidacion.cobran, 31);
  // si después la PC ve la asistencia, ya viene contado y no se suma dos veces
  d.repo.hojas.liqpro_mov = [mov('2026-10', 'Ana Profe', PA.dni, { renovaciones: 31, sin_asistencia: [] })];
  assert.equal(ver(d, PA.dni).data.personas[0].liquidacion.cobran, 31);
  assert.ok(pedir(d, { accion: 'liqpro_liquidar', token: entrar(d, ADMIN.dni), mes: '2026-10' }).ok);
  assert.equal(marcar(ADMIN.dni).error, 'liquidada');
});

test('una sola estructura para todos: sin objetivos propios, también kinesiología usa las metas por horas', () => {
  const d = base();
  d.repo.hojas.liqpro = d.repo.hojas.liqpro.filter(f => f.dni !== KI.dni);
  d.repo.hojas.liqpro.push(fila('persona', '2026-09', KI.dni, { tipo: 'kine', valor_hora: 4111, horas_mes: 50, horas_semana: 30 }));
  const r = ver(d, ADMIN.dni).data.personas;
  const k = r.find(p => p.dni === KI.dni), a = r.find(p => p.dni === PA.dni);
  assert.deepEqual(k.liquidacion.metas, [40, 41, 50, 60]);
  assert.equal(k.liquidacion.metas_fijas, false);
  assert.deepEqual(Object.keys(k.objetivos), Object.keys(a.objetivos), 'mismos objetivos para todos');
  assert.deepEqual(Object.keys(k.liquidacion), Object.keys(a.liquidacion), 'misma liquidación para todos');
});

test('total: horas + HOME + sábados×4 + comisión + extras − descuentos + monotributo, cada línea con su cuenta', () => {
  const d = base();
  d.repo.hojas.liqpro.push(fila('persona', '2026-10', PA.dni, { home_horas: 10, sabados: 2, extras: [{ c: 'Aguinaldo / extra', m: 1000 }, { c: 'Consumo staff', m: 300 }, { c: 'Fiado', m: 50 }] }));
  const l = ver(d, ADMIN.dni).data.personas.find(p => p.dni === PA.dni).liquidacion;
  const horas = (100 + 10 + 2 * 4) * 3571;
  assert.equal(l.subtotales.horas, horas);
  assert.equal(l.total, horas + 404 * 44 + 1000 - 300 - 50 + 1234);
  const sab = l.lineas.find(x => x.k === 'sabados');
  assert.match(sab.como, /2 sábados × 4 h/);
  assert.ok(l.lineas.every(x => x.como), 'todas las líneas explican la cuenta');
  assert.equal(l.lineas.filter(x => x.grupo === 'descuentos').every(x => x.monto < 0), true);
});

test('los sábados salen de la rotación si coordinación no los cargó, sin los feriados que no se trabajan', () => {
  const d = base();
  d.repo.hojas.profe_sabados = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24'].map(f => ({ fecha: f, sede: 'bolson', profe: 'Ana Profe', profe_dni: PA.dni }));
  d.repo.hojas.profe_feriados = [{ fecha: '2026-10-10', nombre: 'Feriado', se_trabaja: 'false', borrado: '' }];
  const l = ver(d, ADMIN.dni).data.personas.find(p => p.dni === PA.dni).liquidacion;
  assert.equal(l.sabados, 3);
});

test('sin valores cargados la plata queda en cero y la pantalla lo dice', () => {
  const d = entorno({ liqpro_mov: [mov('2026-10', 'Ana Profe', PA.dni, { renovaciones: 10 })] });
  const l = ver(d, ADMIN.dni).data.personas.find(p => p.dni === PA.dni).liquidacion;
  assert.equal(l.total, 0);
  assert.ok(l.faltan.length >= 2);
});

test('kinesiología con metas fijas: 4 niveles (10/15/20/30) y 5 niveles (Sofía: +25)', () => {
  const k = L.lpCalcular({ p: { tipo: 'kine', metas: [10, 15, 20, 30], valores: [1, 2, 3, 4] }, cfg: L.lpConfigDelMes([], '2026-10'), mov: { renovaciones: 25, x2: 0, liberados: 0, nuevos: 0, online: 0 } });
  assert.equal(k.nivel, 2);
  assert.equal(k.comision_calculada, 75);
  const s = L.lpCalcular({ p: { tipo: 'kine', metas: [10, 15, 20, 25, 30], valores: [1, 2, 3, 4, 5], socios_manual: { activos: 29, cobran: 29 } }, cfg: L.lpConfigDelMes([], '2026-10'), mov: null });
  assert.equal(s.nivel, 3);
  assert.equal(s.etiqueta, 'Objetivo 3');
  assert.equal(s.comision_calculada, 4 * 29);
  const m = L.lpCalcular({ p: { tipo: 'kine', metas: [10, 15, 20, 25, 30], valores: [1, 2, 3, 4, 5], socios_manual: { activos: 30, cobran: 30 } }, cfg: L.lpConfigDelMes([], '2026-10'), mov: null });
  assert.equal(m.etiqueta, 'Máximo');
});

test('las sesiones de kinesiología se pagan por tipo × tarifa del mes, y las plantillas × su valor', () => {
  const d = base();
  d.repo.hojas.liqpro.push(fila('persona', '2026-10', KI.dni, { plantillas: 3 }));
  d.repo.hojas.liqpro_sesiones = [
    { id: 'a', mes: '2026-10', fecha: '2026-10-02', kine_dni: KI.dni, paciente: 'Paciente Uno', tipo: 'SESIÓN 0', estado: 'confirmada' },
    { id: 'b', mes: '2026-10', fecha: '2026-10-09', kine_dni: KI.dni, paciente: 'Paciente Uno', tipo: 'X1', estado: 'confirmada' },
    { id: 'c', mes: '2026-10', fecha: '2026-10-09', kine_dni: KI.dni, paciente: 'Paciente Dos', tipo: 'X1', estado: 'importada' },
    { id: 'd', mes: '2026-10', fecha: '2026-10-16', kine_dni: KI.dni, paciente: 'Paciente Dos', tipo: 'X2 M', estado: 'confirmada' },
    { id: 'e', mes: '2026-09', fecha: '2026-09-30', kine_dni: KI.dni, paciente: 'Paciente Dos', tipo: 'X3', estado: 'confirmada' },
  ];
  const p = ver(d, ADMIN.dni).data.personas.find(x => x.dni === KI.dni);
  const l = p.liquidacion;
  assert.equal(l.subtotales.sesiones, 7001 + 2 * 7002 + 7005 + 3 * 5003, 'la sesión de septiembre no entra en octubre');
  assert.equal(p.sesiones.sin_confirmar, 1);
  assert.equal(p.sesiones.resumen.find(x => x.tipo === 'X1').n, 2);
  assert.equal(l.total, 50 * 4111 + 7001 + 2 * 7002 + 7005 + 3 * 5003);
});

test('cada profe ve solo su liquidación; la de otro está prohibida', () => {
  const d = base();
  const r = ver(d, PA.dni);
  assert.ok(r.ok);
  assert.deepEqual(r.data.personas.map(p => p.dni), [PA.dni]);
  assert.equal(r.data.personas[0].liquidacion.total > 0, true);
  const otro = ver(d, PA.dni, { dni: PB.dni });
  assert.equal(otro.ok, false);
  assert.equal(otro.error, 'prohibido');
  const json = JSON.stringify(ver(d, PB.dni).data);
  assert.ok(!json.includes('Ana Profe') && !json.includes('3571'), 'Beto no ve nada de Ana');
});

test('coordinación ve a todos pero sin un solo monto; recepción no entra', () => {
  const d = base();
  d.repo.hojas.liqpro.push(fila('persona', '2026-10', PA.dni, { extras: [{ c: 'Aguinaldo / extra', m: 9876 }] }));
  const r = ver(d, COORD.dni);
  assert.ok(r.ok);
  assert.equal(r.data.personas.length, 4);
  const json = JSON.stringify(r.data);
  ['3571', '101', '202', '303', '404', '9876', '1234', '7001', '4111', '1010', '5003'].forEach(n => assert.ok(!new RegExp('(^|\\D)' + n + '(\\D|$)').test(json), 'no debe aparecer ' + n));
  const a = r.data.personas.find(p => p.dni === PA.dni);
  assert.equal(a.liquidacion.nivel, 3, 'sí ve el nivel y las cantidades');
  assert.equal(a.liquidacion.cobran, 44);
  assert.equal(r.data.ve_montos, false);
  assert.equal(r.data.personas[0].edicion, undefined);
  assert.equal(ver(d, REC.dni).error, 'prohibido');
});

test('un coordinador que también es profe ve sus propios montos', () => {
  const d = entorno({ liqpro: [fila('persona', '2026-09', '40000009', PROFE_A)] });
  d.repo.hojas.usuarios.push(usuario({ dni: '40000009', nombre: 'Coord Profe', roles: 'coordinador,profe', sede: 'bolson' }));
  const r = ver(d, '40000009');
  const yo = r.data.personas.find(p => p.dni === '40000009');
  assert.ok(yo.liquidacion.total > 0);
  assert.equal(r.data.personas.find(p => p.dni === PA.dni).liquidacion.sin_montos, true);
});

test('solo admin guarda configuración y datos por persona; valida conceptos y números', () => {
  const d = base();
  const t = entrar(d, PA.dni);
  assert.equal(pedir(d, { accion: 'liqpro_config_guardar', token: t, mes: '2026-10', valores: [1, 2, 3, 4], tarifas: {} }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'liqpro_persona_guardar', token: t, dni: PA.dni, mes: '2026-10', datos: {} }).error, 'prohibido');
  const ta = entrar(d, ADMIN.dni);
  assert.equal(pedir(d, { accion: 'liqpro_persona_guardar', token: ta, dni: PA.dni, mes: '2026-10', datos: { extras: [{ c: 'Inventado', m: 5 }] } }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'liqpro_persona_guardar', token: ta, dni: PA.dni, mes: '2026-10', datos: { valor_hora: -5 } }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'liqpro_persona_guardar', token: ta, dni: REC.dni, mes: '2026-10', datos: {} }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'liqpro_config_guardar', token: ta, mes: '2026-10', valores: [1, 2, 3], tarifas: {} }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'liqpro_config_guardar', token: ta, mes: '2026-10', valores: [1, 2, 3, 4], tarifas: { Raro: 3 } }).error, 'datos_invalidos');
  assert.ok(pedir(d, { accion: 'liqpro_config_guardar', token: ta, mes: '2026-10', valores: [5, 6, 7, 8], tarifas: { X1: 9 } }).ok);
  assert.ok(pedir(d, { accion: 'liqpro_persona_guardar', token: ta, dni: PA.dni, mes: '2026-10', datos: { valor_hora: 3571, horas_mes: 90, extras: [{ c: 'Online', m: 700 }] } }).ok);
  const l = ver(d, PA.dni).data.personas[0].liquidacion;
  assert.equal(l.valores[1], 6, 'la configuración del mes manda');
  assert.equal(l.horas, 90);
});

test('el valor hora y las horas se heredan del mes anterior; HOME, sábados y extras no', () => {
  const d = base();
  d.repo.hojas.liqpro.push(fila('persona', '2026-09', PA.dni, Object.assign({}, PROFE_A, { home_horas: 20, extras: [{ c: 'Online', m: 11 }] })));
  const l = ver(d, ADMIN.dni).data.personas.find(p => p.dni === PA.dni);
  assert.equal(l.liquidacion.valor_hora, 3571);
  assert.equal(l.liquidacion.home_horas, 0);
  assert.equal(l.heredado_de, '2026-09');
  assert.equal(l.cargado, false);
});

test('liquidar congela el mes, solo con el período cerrado, y reabrir lo suelta', () => {
  const d = base();
  const ta = entrar(d, ADMIN.dni);
  assert.equal(pedir(d, { accion: 'liqpro_liquidar', token: ta, mes: '2026-11' }).error, 'periodo_abierto');
  assert.ok(pedir(d, { accion: 'liqpro_liquidar', token: ta, mes: '2026-10' }).ok);
  const antes = ver(d, PA.dni).data;
  assert.equal(antes.estado, 'liquidada');
  assert.equal(antes.personas[0].congelada, true);
  const total = antes.personas[0].liquidacion.total;
  // se corrige un pago después: lo liquidado no cambia, y admin ve la diferencia
  d.repo.hojas.liqpro_mov[0].datos = JSON.stringify({ renovaciones: 1, x2: 0, liberados: 0, nuevos: 0 });
  assert.equal(ver(d, PA.dni).data.personas[0].liquidacion.total, total);
  const adm = ver(d, ADMIN.dni).data.personas.find(p => p.dni === PA.dni);
  assert.notEqual(adm.total_vivo, undefined);
  assert.equal(ver(d, PA.dni).data.personas[0].total_vivo, undefined, 'el profe no ve el recálculo');
  assert.equal(pedir(d, { accion: 'liqpro_persona_guardar', token: ta, dni: PA.dni, mes: '2026-10', datos: { valor_hora: 1 } }).error, 'liquidada');
  assert.equal(pedir(d, { accion: 'cargar_liqpro_mov', clave: PROPS.CLAVE_CARGA, filas: [mov('2026-10', 'Ana Profe', PA.dni, {})] }).error, 'liquidada');
  assert.ok(pedir(d, { accion: 'liqpro_liquidar', token: ta, mes: '2026-10', reabrir: true }).ok);
  assert.notEqual(ver(d, PA.dni).data.personas[0].liquidacion.total, total);
  assert.equal(ver(d, PA.dni).data.estado, 'cerrada');
});

test('reclamos: el profe reclama sobre lo suyo y admin responde', () => {
  const d = base();
  const tp = entrar(d, PA.dni);
  assert.equal(pedir(d, { accion: 'liqpro_reclamo', token: tp, mes: '2026-10', texto: 'a' }).error, 'datos_invalidos');
  const r = pedir(d, { accion: 'liqpro_reclamo', token: tp, mes: '2026-10', linea: 'comision', texto: 'Me faltan dos renovaciones' });
  assert.ok(r.ok);
  assert.equal(ver(d, PA.dni).data.personas[0].reclamos.length, 1);
  assert.equal(ver(d, PB.dni).data.personas[0].reclamos.length, 0, 'los reclamos de otro no se ven');
  assert.equal(ver(d, ADMIN.dni).data.reclamos_abiertos, 1);
  assert.equal(pedir(d, { accion: 'liqpro_reclamo_resolver', token: tp, id: r.data.id }).error, 'prohibido');
  assert.ok(pedir(d, { accion: 'liqpro_reclamo_resolver', token: entrar(d, ADMIN.dni), id: r.data.id, respuesta: 'Corregido' }).ok);
  assert.equal(ver(d, PA.dni).data.personas[0].reclamos[0].respuesta, 'Corregido');
  assert.equal(ver(d, ADMIN.dni).data.reclamos_abiertos, 0);
});

test('sesiones: la kinesióloga carga y borra las suyas; nadie más toca las de otra; confirma lo importado', () => {
  const d = base();
  d.repo.hojas.liqpro.push(fila('persona', '2026-09', KI2.dni, KINE));
  const tk = entrar(d, KI.dni);
  const guardar = (extra, token = tk) => pedir(d, Object.assign({ accion: 'liqpro_sesion_guardar', token, fecha: '2026-10-07', paciente: 'Paciente Uno', tipo: 'X1' }, extra));
  const g = guardar({});
  assert.ok(g.ok, JSON.stringify(g));
  assert.equal(guardar({ tipo: 'X2' }).data.id, g.data.id, 'misma persona y día: se corrige, no se repite');
  assert.equal(d.repo.hojas.liqpro_sesiones.length, 1);
  assert.equal(d.repo.hojas.liqpro_sesiones[0].tipo, 'X2');
  assert.equal(guardar({ tipo: 'X9' }).error, 'datos_invalidos');
  assert.equal(guardar({ fecha: 'ayer' }).error, 'datos_invalidos');
  assert.equal(guardar({ paciente: '' }).error, 'datos_invalidos');
  // una profe común (no kine) no carga sesiones; la otra kine no toca las de Kina
  assert.equal(guardar({}, entrar(d, PA.dni)).error, 'prohibido');
  assert.equal(guardar({ id: g.data.id, tipo: 'X1' }, entrar(d, KI2.dni)).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'liqpro_sesion_borrar', token: entrar(d, KI2.dni), id: g.data.id }).error, 'prohibido');
  // Kiko no ve las de Kina; admin sí
  assert.equal(ver(d, KI2.dni).data.personas[0].sesiones.lista.length, 0);
  assert.equal(ver(d, ADMIN.dni).data.personas.find(p => p.dni === KI.dni).sesiones.lista.length, 1);
  assert.equal(ver(d, COORD.dni).data.personas.find(p => p.dni === KI.dni).sesiones.lista.length, 0, 'coordinación no ve pacientes');
  // admin carga a nombre de Kina
  assert.ok(guardar({ kine_dni: KI.dni, fecha: '2026-10-14' }, entrar(d, ADMIN.dni)).ok);
  // importadas: confirmar
  d.repo.hojas.liqpro_sesiones.push({ id: 'I-1', mes: '2026-10', fecha: '2026-10-20', kine_dni: KI.dni, paciente: 'Paciente Tres', tipo: 'X1', estado: 'importada' });
  assert.equal(ver(d, KI.dni).data.personas[0].sesiones.sin_confirmar, 1);
  const c = pedir(d, { accion: 'liqpro_sesiones_confirmar', token: tk, mes: '2026-10' });
  assert.equal(c.data.confirmadas, 1);
  assert.equal(ver(d, KI.dni).data.personas[0].sesiones.sin_confirmar, 0);
  assert.ok(pedir(d, { accion: 'liqpro_sesion_borrar', token: tk, id: g.data.id }).ok);
});

test('con el mes liquidado la kinesióloga ya no cambia sesiones; admin sí', () => {
  const d = base();
  assert.ok(pedir(d, { accion: 'liqpro_liquidar', token: entrar(d, ADMIN.dni), mes: '2026-10' }).ok);
  const g = req => pedir(d, Object.assign({ accion: 'liqpro_sesion_guardar', fecha: '2026-10-07', paciente: 'P', tipo: 'X1' }, req));
  assert.equal(g({ token: entrar(d, KI.dni) }).error, 'liquidada');
  assert.ok(g({ token: entrar(d, ADMIN.dni), kine_dni: KI.dni }).ok);
});

test('la PC sube movimientos por período, sesiones importadas (idempotente) y configuración (sin pisar lo de admin)', () => {
  const d = entorno({ liqpro: [fila('persona', '2026-09', KI.dni, KINE)] });
  const clave = PROPS.CLAVE_CARGA;
  assert.equal(pedir(d, { accion: 'cargar_liqpro_mov', clave: 'mala', filas: [] }).error, 'clave');
  assert.equal(pedir(d, { accion: 'cargar_liqpro_mov', clave, filas: [{ periodo: 'x', profe: 'A', datos: {} }] }).error, 'datos_invalidos');
  const m = pedir(d, { accion: 'cargar_liqpro_mov', clave, filas: [{ periodo: '2026-10', profe: 'Ana Profe', profe_dni: PA.dni, datos: { renovaciones: 3 } }] });
  assert.deepEqual(m.data.periodos, ['2026-10']);
  pedir(d, { accion: 'cargar_liqpro_mov', clave, filas: [{ periodo: '2026-10', profe: 'Ana Profe', profe_dni: PA.dni, datos: { renovaciones: 8 } }] });
  assert.equal(d.repo.hojas.liqpro_mov.length, 1, 'el período se reemplaza');
  const s = [{ kine_dni: KI.dni, fecha: '2026-10-02', paciente: 'Paciente Uno', tipo: 'X1' }, { kine_dni: KI.dni, fecha: '2026-10-02', paciente: 'PACIENTE uno', tipo: 'X1' }];
  assert.deepEqual(pedir(d, { accion: 'cargar_liqpro_sesiones', clave, filas: s }).data, { nuevas: 1, existentes: 1 });
  assert.deepEqual(pedir(d, { accion: 'cargar_liqpro_sesiones', clave, filas: s }).data, { nuevas: 0, existentes: 2 });
  assert.equal(d.repo.hojas.liqpro_sesiones[0].estado, 'importada');
  const cf = [{ tipo: 'config', mes: '2026-10', dni: '*', datos: { valores: [1, 2, 3, 4] } }];
  assert.deepEqual(pedir(d, { accion: 'cargar_liqpro_config', clave, filas: cf }).data, { nuevas: 1, pisadas: 0 });
  assert.deepEqual(pedir(d, { accion: 'cargar_liqpro_config', clave, filas: cf }).data, { nuevas: 0, pisadas: 0 });
  assert.equal(pedir(d, { accion: 'cargar_liqpro_config', clave, filas: [{ tipo: 'config', mes: '2026-10', dni: PA.dni, datos: {} }] }).error, 'datos_invalidos');
});

test('sin movimientos por período se usa el mes calendario de la comisión vieja, avisando la fuente', () => {
  const d = entorno({ liqpro: [fila('persona', '2026-09', PA.dni, PROFE_A)],
    profe_liq: [{ mes: '2026-10', profe: 'Ana Profe', profe_dni: PA.dni, sede: 'bolson', datos: JSON.stringify({ renovaciones: 20, liberados: 2, nuevos: 5 }), cargada: HOY }] });
  const p = ver(d, PA.dni).data.personas[0];
  assert.equal(p.mov.fuente, 'mes_calendario');
  assert.equal(p.liquidacion.cobran, 22);
  const sin = ver(entorno({ liqpro: [fila('persona', '2026-09', PA.dni, PROFE_A)] }), PA.dni).data.personas[0];
  assert.equal(sin.mov, null);
});

test('objetivos del profesional: activos contra metas y deserción contra los tramos publicados (14/18/22%)', () => {
  const real = (v, b) => ({ real: { vencian: v, bajas: b } });
  const d = base();
  d.repo.hojas.profe_estado = [{ clave: 'x', tipo: 'profe', nombre: 'Ana Profe', sede: 'bolson', cargada: HOY, datos: JSON.stringify({ '2026-07': real(25, 3), '2026-08': real(25, 3), '2026-09': real(25, 3) }) }];
  let o = ver(d, PA.dni).data.personas[0].objetivos;
  assert.equal(o.desercion.promedio_3m, 12, '9 bajas de 75');
  assert.equal(o.desercion.puntos, 30);
  assert.equal(o.activos.puntos, 40, 'Máximo: los nuevos suman a los activos');
  d.repo.hojas.profe_estado[0].datos = JSON.stringify({ '2026-07': real(25, 5), '2026-08': real(25, 5), '2026-09': real(25, 4) });
  o = ver(d, PA.dni).data.personas[0].objetivos;
  assert.equal(o.desercion.promedio_3m, 18.7);
  assert.equal(o.desercion.puntos, 10);
  assert.match(o.aclaracion, /no se pagan/);
});

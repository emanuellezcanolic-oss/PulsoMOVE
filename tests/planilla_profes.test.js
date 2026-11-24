// Planilla de socios del profe: carga de la PC, permisos por rol, condición efectiva y ediciones.
const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const BELEN = usuario({ dni: '20111222', nombre: 'Profe Uno', roles: 'profe', sede: 'bolson' });
const ENZO = usuario({ dni: '20333444', nombre: 'Profe Dos', roles: 'profe', sede: 'bolson' });
const JAVI = usuario({ dni: '20444555', nombre: 'Profe Tres', roles: 'profe', sede: 'puelo' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación', roles: 'coordinador', sede: 'bolson' });
const ADMIN = usuario({ dni: '20777888', nombre: 'Admin', roles: 'admin', sede: 'bolson' });
const RECE = usuario({ dni: '20999000', nombre: 'Rocío', roles: 'recepcion', sede: 'bolson' });
const RECE_P = usuario({ dni: '20999001', nombre: 'Ara', roles: 'recepcion', sede: 'puelo' });
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;
const HOY = '2026-11-16';

const fila = (socio_id, extra) => Object.assign({ socio_id, sede: 'bolson', profe_dni: '20111222', profe_nombre: 'Profe Uno', nombre: 'Socio ' + socio_id,
  condicion_auto: 'ACTIVO', vence: '2026-11-30', plan_meses: '1', plan_tipo: 'paga', plan_fecha: '2026-10-20', plan_proximo: '2026-11-20',
  plan_rutinas: '3', plan_pct: '45', plan_estado: 'ok', ultima_eval: '2026-09-01', perfil: 'Si', ultima_visita: '2026-11-14',
  contacto_fecha: '', contacto_quien: '', contacto_canal: '', contacto_resultado: '', contacto_nota: '', contactos_n: '0',
  meses: { '2026-10': 'RENUEVA', '2026-11': 'RENUEVA' }, mov_mes: 'renovo', observaciones: 'de la planilla', profe_move: '', origen: 'planilla' }, extra || {});

function entorno() {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [BELEN, ENZO, JAVI, COORD, ADMIN, RECE, RECE_P] }), hoy: HOY, ahora: Date.parse(HOY + 'T15:00:00Z') });
  const r = pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: HOY, filas: [
    fila('1'), fila('2', { profe_dni: '20333444', profe_nombre: 'Profe Dos', profe_move: 'Profe Uno' }),
    fila('3', { sede: 'puelo', profe_dni: '20444555', profe_nombre: 'Profe Tres' }),
    fila('4', { condicion_auto: 'BAJA', vence: '2026-11-01', mov_mes: 'baja' })] });
  assert.equal(r.ok, true, JSON.stringify(r));
  return d;
}

const ver = (d, dni, extra) => pedir(d, Object.assign({ accion: 'profe_planilla', token: entrar(d, dni) }, extra || {}));
const editar = (d, dni, datos) => pedir(d, Object.assign({ accion: 'profe_planilla_editar', token: entrar(d, dni) }, datos));

test('planilla: la carga de la PC pide la clave, valida y reemplaza la hoja entera', () => {
  const d = entorno();
  assert.equal(pedir(d, { accion: 'cargar_profe_planilla', clave: 'mal', filas: [] }).error, 'clave');
  assert.equal(pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, filas: [fila('9', { condicion_auto: 'RARA' })] }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, filas: [fila('9', { meses: '[no es json' })] }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, filas: [fila('9'), fila('9')] }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, filas: [fila('9', { vence: '31/11/2026' })] }).error, 'datos_invalidos');
  assert.equal(d.repo.hojas.profe_planilla.length, 4);
  assert.equal(typeof d.repo.hojas.profe_planilla[0].meses, 'string');
  assert.equal(pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, filas: [fila('7')] }).data.filas, 1);
  assert.deepEqual(d.repo.hojas.profe_planilla.map(f => f.socio_id), ['7']);
});

test('planilla: ediciones iniciales de la planilla vieja, una sola vez por socio', () => {
  const d = entorno();
  const ed = [{ socio_id: '1', campo: 'condicion', valor: 'VACACIONES', vence_al_editar: '2026-11-30' }, { socio_id: '99', campo: 'condicion', valor: 'DERIVADO' }];
  const filas = [fila('1'), fila('2')];
  assert.equal(pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, filas, ediciones: ed }).data.ediciones_iniciales, 1);
  assert.equal(pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, filas, ediciones: ed }).data.ediciones_iniciales, 0);
  const e = d.repo.hojas.profe_planilla_edit;
  assert.equal(e.length, 1);
  assert.equal(e[0].dni, 'planilla');
  const f = ver(d, '20111222').data.filas.find(x => x.socio_id === '1');
  assert.equal(f.condicion, 'VACACIONES');
  assert.equal(f.condicion_manual.quien, 'planilla vieja');
  // la PC las lee con su clave
  assert.equal(pedir(d, { accion: 'profe_planilla_ediciones', clave: 'mal' }).error, 'clave');
  assert.equal(pedir(d, { accion: 'profe_planilla_ediciones', clave: PROPS.CLAVE_CARGA }).data.filas.length, 1);
});

test('planilla: cada rol ve lo suyo', () => {
  const d = entorno();
  const p = ver(d, '20111222').data;
  assert.equal(p.modo, 'mio');
  assert.deepEqual(p.filas.map(f => f.socio_id).sort(), ['1', '4']);
  assert.equal(p.cupo, 110);
  assert.deepEqual(p.filas[0].meses, { '2026-10': 'RENUEVA', '2026-11': 'RENUEVA' });
  assert.equal(p.filas.every(f => f.editable && !f.puede_profe), true);
  assert.deepEqual(ver(d, '20333444').data.filas.map(f => f.socio_id), ['2']);
  // coordinador: su sede, aunque pida otra
  const c = ver(d, '20555666', { sede: 'puelo' }).data;
  assert.equal(c.modo, 'equipo');
  assert.deepEqual(c.filas.map(f => f.socio_id).sort(), ['1', '2', '4']);
  assert.equal(c.profes.length, 2);
  assert.deepEqual(ver(d, '20555666', { profe_dni: '20333444' }).data.filas.map(f => f.socio_id), ['2']);
  // admin: todo, o la sede que pide
  assert.equal(ver(d, '20777888').data.filas.length, 4);
  assert.deepEqual(ver(d, '20777888', { sede: 'puelo' }).data.filas.map(f => f.socio_id), ['3']);
  // recepción (17/11): la planilla de su sede, todos los profes, aunque pida otra; edita pero no cambia el dueño
  const r = ver(d, '20999000', { sede: 'puelo' }).data;
  assert.equal(r.modo, 'equipo');
  assert.deepEqual(r.filas.map(f => f.socio_id).sort(), ['1', '2', '4']);
  assert.equal(r.filas.every(f => f.editable && !f.puede_profe), true);
  assert.deepEqual(ver(d, '20999001').data.filas.map(f => f.socio_id), ['3']);
  assert.ok(!/price|precio|comision|monto/i.test(JSON.stringify(r)));
  // recepción sin sede no la ve
  const d2 = depsFalsas({ repo: repoFalso({ usuarios: [usuario({ dni: '20999002', nombre: 'Sin sede', roles: 'recepcion', sede: '' })] }), hoy: HOY, ahora: Date.parse(HOY + 'T15:00:00Z') });
  assert.equal(ver(d2, '20999002').error, 'prohibido');
  // nada de plata
  assert.ok(!/price|precio|comision|monto/i.test(JSON.stringify(ver(d, '20777888').data)));
});

test('planilla: profe_move queda a la vista para marcar al mal asignado en MOVE', () => {
  const d = entorno();
  const f = ver(d, '20333444').data.filas[0];
  assert.equal(f.profe_move, 'Profe Uno');
});

test('planilla: condición efectiva con fecha hasta, vigente y vencida', () => {
  const d = entorno();
  // recepción, antes de que venza (vence el 30/11), con fecha de vuelta
  pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: HOY, filas: [fila('4', { condicion_auto: 'BAJA', vence: '2026-11-18', mov_mes: 'baja' })] });
  const r = editar(d, '20999000', { socio_id: '4', campo: 'condicion', valor: 'VACACIONES', hasta: '2026-11-20' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.fila.condicion, 'VACACIONES');
  assert.equal(r.data.fila.condicion_manual.hasta, '2026-11-20');
  d.dia = '2026-11-20';
  assert.equal(ver(d, '20111222').data.filas.find(x => x.socio_id === '4').condicion, 'VACACIONES');
  // ya vencida la membresía, recepción todavía puede mover la fecha de vuelta de esas vacaciones (dentro de los 60 días)
  assert.equal(editar(d, '20999000', { socio_id: '4', campo: 'condicion', valor: 'VACACIONES', hasta: '2026-11-20' }).ok, true);
  d.dia = '2026-11-21';   // pasó la fecha: vuelve la automática (baja)
  const f = ver(d, '20111222').data.filas.find(x => x.socio_id === '4');
  assert.equal(f.condicion, 'BAJA');
  assert.equal(f.condicion_manual, null);
  // las reglas sueltas, igual que en la pantalla
  const filaV = { condicion_auto: 'BAJA', vence: '2026-11-01' };
  assert.deepEqual(L.condicionEfectiva(filaV, { valor: 'VACACIONES', hasta: '2026-12-01' }, HOY), { condicion: 'VACACIONES', manual: true });
  assert.deepEqual(L.condicionEfectiva(filaV, { valor: 'VACACIONES', hasta: '2026-11-15' }, HOY), { condicion: 'BAJA', manual: false });
  assert.deepEqual(L.condicionEfectiva(filaV, null, HOY), { condicion: 'BAJA', manual: false });
});

test('planilla: edición sin hasta vale mientras MOVE no cambie el vencimiento', () => {
  const d = entorno();
  assert.equal(editar(d, '20111222', { socio_id: '1', campo: 'condicion', valor: 'DERIVADO' }).data.fila.condicion, 'DERIVADO');
  assert.equal(d.repo.hojas.profe_planilla_edit[0].vence_al_editar, '2026-11-30');
  assert.equal(ver(d, '20111222').data.filas.find(x => x.socio_id === '1').condicion, 'DERIVADO');
  // al día siguiente MOVE muestra que renovó: la edición deja de mandar
  pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, filas: [fila('1', { vence: '2026-12-30' })] });
  const f = ver(d, '20111222').data.filas[0];
  assert.equal(f.condicion, 'ACTIVO');
  assert.equal(f.condicion_manual, null);
  // vacío vuelve a la automática aunque siga el mismo vencimiento
  editar(d, '20111222', { socio_id: '1', campo: 'condicion', valor: 'DERIVADO' });
  assert.equal(editar(d, '20111222', { socio_id: '1', campo: 'condicion', valor: '' }).data.fila.condicion, 'ACTIVO');
});

test('planilla: observaciones editadas reemplazan a las importadas', () => {
  const d = entorno();
  assert.equal(ver(d, '20111222').data.filas.find(x => x.socio_id === '1').observaciones, 'de la planilla');
  editar(d, '20999000', { socio_id: '1', campo: 'observaciones', valor: 'Llamó: vuelve en diciembre' });
  const f = ver(d, '20111222').data.filas.find(x => x.socio_id === '1');
  assert.equal(f.observaciones, 'Llamó: vuelve en diciembre');
  assert.equal(f.obs_editada.quien, 'Rocío');
});

test('planilla: quién puede editar qué', () => {
  const d = entorno();
  const ok = (dni, datos) => assert.equal(editar(d, dni, datos).ok, true, dni + ' ' + JSON.stringify(datos));
  const no = (dni, datos, err) => assert.equal(editar(d, dni, datos).error, err || 'prohibido', dni + ' ' + JSON.stringify(datos));
  // profe: solo sus socios, y nunca el dueño
  ok('20111222', { socio_id: '1', campo: 'observaciones', valor: 'x' });
  no('20111222', { socio_id: '2', campo: 'observaciones', valor: 'x' });
  no('20111222', { socio_id: '1', campo: 'profe_dni', valor: '20333444' });
  // recepción: los de su sede
  ok('20999000', { socio_id: '2', campo: 'condicion', valor: 'DERIVADO' });
  no('20999000', { socio_id: '3', campo: 'condicion', valor: 'DERIVADO' });
  ok('20999001', { socio_id: '3', campo: 'condicion', valor: 'DERIVADO' });
  no('20999000', { socio_id: '2', campo: 'profe_dni', valor: '20111222' });
  // coordinador: su sede, incluso el dueño (a un profe de su sede)
  no('20555666', { socio_id: '3', campo: 'observaciones', valor: 'x' });
  no('20555666', { socio_id: '1', campo: 'profe_dni', valor: '20444555' });
  ok('20555666', { socio_id: '2', campo: 'profe_dni', valor: '20111222' });
  assert.deepEqual(ver(d, '20111222').data.filas.map(f => f.socio_id).sort(), ['1', '2', '4']);
  assert.deepEqual(ver(d, '20333444').data.filas, []);
  // pasado al profe que tiene MOVE: deja de figurar como mal asignado
  assert.equal(ver(d, '20111222').data.filas.find(f => f.socio_id === '2').profe_move, '');
  // el socio pasado ya lo edita su profe nuevo, y el viejo no
  ok('20111222', { socio_id: '2', campo: 'observaciones', valor: 'ahora es mío' });
  no('20333444', { socio_id: '2', campo: 'observaciones', valor: 'x' });
  // admin: todo
  ok('20777888', { socio_id: '3', campo: 'profe_dni', valor: '20111222' });
  no('20777888', { socio_id: 'nadie', campo: 'condicion', valor: 'ACTIVO' }, 'no_existe');
});

test('planilla: ediciones inválidas se rechazan', () => {
  const d = entorno();
  const mal = datos => assert.equal(editar(d, '20111222', Object.assign({ socio_id: '1' }, datos)).error, 'datos_invalidos', JSON.stringify(datos));
  mal({ campo: 'vence', valor: '2026-12-01' });
  mal({ campo: 'condicion', valor: 'FELIZ' });
  // vacaciones: las carga recepción, no el profe
  assert.equal(editar(d, '20111222', { socio_id: '1', campo: 'condicion', valor: 'VACACIONES', hasta: '2026-12-10' }).error, 'vac_solo_recepcion');
  const malVac = (datos, err) => assert.equal(editar(d, '20999000', Object.assign({ socio_id: '1', campo: 'condicion', valor: 'VACACIONES' }, datos)).error, err, JSON.stringify(datos));
  malVac({}, 'vac_sin_vuelta');                                    // sin hasta
  malVac({ hasta: '2026-02-30' }, 'vac_sin_vuelta');
  malVac({ hasta: '2026-11-10' }, 'datos_invalidos');              // hasta en el pasado
  malVac({ hasta: '2027-01-30' }, 'vac_larga');                    // vence el 30/11: más de 60 días
  malVac({ socio_id: '4', hasta: '2026-12-01' }, 'vac_vencida');   // la membresía ya venció (01/11)
  mal({ campo: 'condicion', valor: 'DERIVADO', hasta: '2026-12-01' });      // hasta solo para vacaciones
  mal({ campo: 'observaciones', valor: 'x'.repeat(301) });
  assert.equal(editar(d, '20777888', { socio_id: '1', campo: 'profe_dni', valor: '20999000' }).error, 'datos_invalidos');   // no es profe
  assert.equal(d.repo.hojas.profe_planilla_edit || undefined, undefined);
  assert.equal(pedir(d, { accion: 'profe_planilla_editar', socio_id: '1', campo: 'condicion', valor: 'ACTIVO' }).error, 'sin_sesion');
});

test('planilla: reglas de vacaciones (24/11/2026): recepción, antes de vencer, con vuelta, hasta 60 días', () => {
  const d = entorno();
  // socio 1 vence el 30/11: 60 días después es el 29/01
  assert.equal(editar(d, '20999000', { socio_id: '1', campo: 'condicion', valor: 'VACACIONES', hasta: '2027-01-29' }).ok, true);
  assert.equal(editar(d, '20999000', { socio_id: '1', campo: 'condicion', valor: 'VACACIONES', hasta: '2027-01-30' }).error, 'vac_larga');
  // coordinación y admin también pueden; el profe no
  assert.equal(editar(d, '20555666', { socio_id: '1', campo: 'condicion', valor: 'VACACIONES', hasta: '2026-12-15' }).ok, true);
  assert.equal(editar(d, '20777888', { socio_id: '1', campo: 'condicion', valor: 'VACACIONES', hasta: '2026-12-16' }).ok, true);
  assert.equal(editar(d, '20111222', { socio_id: '1', campo: 'condicion', valor: 'VACACIONES', hasta: '2026-12-17' }).error, 'vac_solo_recepcion');
  // el mismo día del vencimiento todavía se puede; al día siguiente no
  pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: HOY, filas: [fila('5', { vence: HOY }), fila('6', { vence: '2026-11-15' })] });
  assert.equal(editar(d, '20999000', { socio_id: '5', campo: 'condicion', valor: 'VACACIONES', hasta: '2026-12-20' }).ok, true);
  assert.equal(editar(d, '20999000', { socio_id: '6', campo: 'condicion', valor: 'VACACIONES', hasta: '2026-12-20' }).error, 'vac_vencida');
  // las que vinieron de la planilla vieja no habilitan a cargarlas después de vencida
  d.repo.hojas.profe_planilla_edit.push({ socio_id: '6', campo: 'condicion', valor: 'VACACIONES', hasta: '2026-12-01', vence_al_editar: '2026-11-15', ts: '2026-11-10T12:00:00.000Z', dni: 'planilla' });
  assert.equal(editar(d, '20999000', { socio_id: '6', campo: 'condicion', valor: 'VACACIONES', hasta: '2026-12-05' }).error, 'vac_vencida');
  // otras condiciones a mano siguen sin esas reglas
  assert.equal(editar(d, '20111222', { socio_id: '6', campo: 'condicion', valor: 'DERIVADO' }).ok, true);
  // el cliente tiene los mensajes con el motivo, y no reintenta
  const api = require('../web/api.js');
  ['vac_solo_recepcion', 'vac_sin_vuelta', 'vac_vencida', 'vac_larga'].forEach(c => assert.notEqual(api.mensaje(c), api.mensaje('cualquiera'), c));
});

test('planilla: el último contacto de recepción de hoy se completa en vivo desde registro', () => {
  const d = entorno();
  d.repo.hojas.registro = [
    { id_marca: 'm1', ts: '2026-11-10T14:00:00.000Z', socio_id: '1', dni: '20999000', canal: 'MP', resultado: 'NOTIFICADO', detalle: 'le escribí', tipo: 'Vence' },
    { id_marca: 'm2', ts: '2026-11-16T13:00:00.000Z', socio_id: '1', dni: '20999000', canal: 'LL', resultado: 'PAGA', detalle: 'paga el jueves', tipo: 'Vence' },
    { id_marca: 'm3', ts: '2026-11-16T13:00:00.000Z', socio_id: '2', dni: '20999000', canal: 'LL', resultado: 'PAGA', detalle: '', tipo: 'Vence' }];
  const f = ver(d, '20111222').data.filas.find(x => x.socio_id === '1');
  assert.equal(f.contactos.length, 2);
  assert.equal(f.contacto_fecha, '2026-11-16');
  assert.equal(f.contacto_quien, 'Rocío');
  assert.equal(f.contacto_nota, 'paga el jueves');
});

test('planilla: nombre distinto en la planilla vieja y socio que entró desde MOVE llegan a la pantalla', () => {
  const d = entorno();
  pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, filas: [fila('1', { nombre_planilla: 'Socio Uno Viejo' }), fila('5', { origen: 'move' })] });
  const F = ver(d, '20111222').data.filas;
  assert.equal(F.find(f => f.socio_id === '1').nombre_planilla, 'Socio Uno Viejo');
  assert.equal(F.find(f => f.socio_id === '5').origen, 'move');
  assert.equal(F.find(f => f.socio_id === '5').nombre_planilla, '');
});

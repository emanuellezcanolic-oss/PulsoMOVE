// Aviso "¿Cómo viene?" (24/11/2026): socios de la Planilla con la membresía vencida, sin renovar y sin condición a mano.
const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const BELEN = usuario({ dni: '20111222', nombre: 'Profe Uno', roles: 'profe', sede: 'bolson' });
const ENZO = usuario({ dni: '20333444', nombre: 'Profe Dos', roles: 'profe', sede: 'bolson' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación', roles: 'coordinador', sede: 'bolson' });
const RECE = usuario({ dni: '20999000', nombre: 'Rocío', roles: 'recepcion', sede: 'bolson' });
const RECE2 = usuario({ dni: '20999002', nombre: 'Tomás', roles: 'recepcion', sede: 'bolson' });
const RECE_P = usuario({ dni: '20999001', nombre: 'Ara', roles: 'recepcion', sede: 'puelo' });
const HOY = '2026-12-02';   // miércoles
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;

const fila = (socio_id, extra) => Object.assign({ socio_id, sede: 'bolson', profe_dni: '20111222', profe_nombre: 'Profe Uno', nombre: 'Socia ' + socio_id,
  condicion_auto: 'ACTIVO', vence: '2026-12-02', plan_meses: '1', plan_tipo: 'paga', plan_fecha: '2026-11-02', plan_proximo: '2026-12-10',
  plan_rutinas: '3', plan_pct: '45', plan_estado: 'ok', ultima_eval: '2026-10-01', perfil: 'Si', ultima_visita: '2026-12-01',
  contacto_fecha: '', contacto_quien: '', contacto_canal: '', contacto_resultado: '', contacto_nota: '', contactos_n: '0',
  meses: {}, mov_mes: 'por_vencer', observaciones: '', profe_move: '', origen: 'planilla' }, extra || {});

function entorno(hoy, filas, extra) {
  const d = depsFalsas({ repo: repoFalso(Object.assign({ usuarios: [BELEN, ENZO, COORD, RECE, RECE2, RECE_P] }, extra || {})), hoy: hoy || HOY, ahora: Date.parse((hoy || HOY) + 'T15:00:00Z') });
  const r = pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: hoy || HOY, filas: filas || [
    fila('1'),                                                   // vence hoy
    fila('2', { vence: '2026-11-28' }),                          // venció antes del 30/11: los días cuentan desde el 30/11
    fila('3', { vence: '2026-12-10' }),                          // todavía no vence
    fila('4', { condicion_auto: 'BAJA', vence: '2026-11-20' }),  // ya es baja
    fila('5', { profe_dni: '20333444', profe_nombre: 'Profe Dos', vence: '2026-12-01' }),
    fila('6', { sede: 'puelo', profe_dni: '', profe_nombre: 'Profe Puelo', vence: '2026-12-01' })] });
  assert.equal(r.ok, true, JSON.stringify(r));
  return d;
}
const avisosDe = (d, dni) => pedir(d, { accion: 'mi_dia', token: entrar(d, dni) }).data.avisos_condicion;
const avisosProfe = (d, dni) => pedir(d, { accion: 'profe_tareas', token: entrar(d, dni) }).data.mio.avisos_condicion;
const ids = lista => lista.map(a => a.socio_id).sort();
const responder = (d, dni, datos) => pedir(d, Object.assign({ accion: 'aviso_condicion_responder', token: entrar(d, dni) }, datos));
const ficha = (d, dni, id) => pedir(d, { accion: 'profe_planilla', token: entrar(d, dni) }).data.filas.find(f => f.socio_id === id);

test('aviso: empieza el 30/11/2026 (antes no aparece nada)', () => {
  assert.equal(L.AVISO_CONDICION_DESDE, undefined);   // constante interna del script
  const antes = entorno('2026-11-27');
  assert.deepEqual(avisosDe(antes, '20999000'), []);
  assert.deepEqual(avisosProfe(antes, '20111222'), []);
  assert.deepEqual(avisosDe(entorno('2026-11-30', [fila('1', { vence: '2026-11-30' })]), '20999000').map(a => a.dias), [0]);
});

test('aviso: quiénes entran (vencidos, sin renovar, sin condición a mano) y a quién le llega', () => {
  const d = entorno();
  assert.deepEqual(ids(avisosDe(d, '20999000')), ['1', '2', '5']);          // recepción de Bolsón: la sede entera
  assert.deepEqual(ids(avisosDe(d, '20999002')), ['1', '2', '5']);          // y las dos recepcionistas ven lo mismo
  assert.deepEqual(ids(avisosDe(d, '20999001')), ['6']);                    // Puelo, lo suyo
  assert.deepEqual(ids(avisosProfe(d, '20111222')), ['1', '2']);            // el profe, sus socios
  assert.deepEqual(ids(avisosProfe(d, '20333444')), ['5']);
  // con una condición puesta a mano ya no se avisa (aunque venza)
  pedir(d, { accion: 'profe_planilla_editar', token: entrar(d, '20999000'), socio_id: '5', campo: 'condicion', valor: 'DERIVADO' });
  assert.deepEqual(ids(avisosDe(d, '20999000')), ['1', '2']);
  // quien renueva (MOVE le cambia el vencimiento) deja de aparecer
  pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: HOY, filas: [fila('1', { vence: '2027-01-02' }), fila('2', { vence: '2026-11-28' })] });
  assert.deepEqual(ids(avisosDe(d, '20999000')), ['2']);
  // y no es una tarea: no hay nada en `tareas`, así que no cuenta en el cumplimiento de nadie
  assert.equal(d.repo.hojas.tareas, undefined);
});

test('aviso: los textos, amables, y el contador "ya van N días" cuenta desde el vencimiento (o desde el 30/11)', () => {
  const d = entorno();
  const a = avisosDe(d, '20999000');
  const por = id => a.find(x => x.socio_id === id);
  assert.equal(por('1').titulo, '¿Cómo viene Socia 1?');
  assert.deepEqual(por('1').lineas, ['Su plan vence hoy. Contanos cómo sigue así lo acompañamos.']);
  assert.equal(por('1').dias, 0);
  // venció el 01/12: 1 día
  assert.deepEqual(por('5').lineas, ['Su plan venció el 01/12. Contanos cómo sigue así lo acompañamos.',
    'Ya va 1 día: ¿pudiste hablar con Socia 5? Con lo que nos cuentes lo ayudamos mejor.']);
  // venció el 28/11, antes del arranque: cuenta desde el 30/11 → 2 días
  assert.equal(por('2').dias, 2);
  assert.deepEqual(por('2').lineas, ['Su plan venció el 28/11. Contanos cómo sigue así lo acompañamos.',
    'Ya van 2 días: ¿pudiste hablar con Socia 2? Con lo que nos cuentes lo ayudamos mejor.']);
  // el que más días lleva, primero
  assert.deepEqual(a.map(x => x.socio_id), ['2', '5', '1']);
  // nada de mayúsculas sostenidas ni signos de alarma
  a.forEach(x => assert.equal(/[A-ZÁÉÍÓÚ]{4,}|!/.test(x.titulo + x.lineas.join(' ')), false, x.titulo));
});

test('aviso "Renueva": fecha obligatoria (hasta 10 días), silencia hasta esa fecha y al día siguiente vuelve a preguntar', () => {
  const d = entorno();
  const r = (datos, dni) => responder(d, dni || '20999000', Object.assign({ socio_id: '1', respuesta: 'renueva' }, datos));
  assert.equal(r({}).error, 'aviso_sin_fecha');
  assert.equal(r({ fecha: '2026-12-13' }).error, 'aviso_fecha_lejos');      // 11 días
  assert.equal(r({ fecha: '2026-12-01' }).error, 'datos_invalidos');        // pasada
  assert.equal(r({ fecha: '2026-12-04', nota: 'x' }).ok, true);
  const ok = r({ fecha: '2026-12-12', socio_id: '2' });                     // 10 días: el último permitido
  assert.equal(ok.ok, true);
  // desaparece para recepción y para el profe
  assert.deepEqual(ids(avisosDe(d, '20999000')), ['5']);
  assert.deepEqual(ids(avisosDe(d, '20999002')), ['5']);
  assert.deepEqual(ids(avisosProfe(d, '20111222')), []);
  // NO cambia la condición automática: solo queda la nota en la ficha
  const f = ficha(d, '20111222', '1');
  assert.equal(f.condicion, 'ACTIVO');
  assert.equal(f.condicion_manual, null);
  assert.equal(d.repo.hojas.profe_planilla_edit, undefined);
  assert.deepEqual(f.aviso_hist.map(h => [h.quien, h.respuesta, h.hasta, h.fecha]), [['Rocío', 'renueva', '2026-12-04', HOY]]);
  // hasta el 04/12 inclusive sigue en silencio; el 05/12 (sábado) vuelve, con lo que quedó dicho
  d.dia = '2026-12-04';
  assert.deepEqual(ids(avisosDe(d, '20999000')), ['5']);   // el 2 está silenciado hasta el 12/12
  d.dia = '2026-12-05';
  const vuelve = avisosDe(d, '20999000').find(x => x.socio_id === '1');
  assert.ok(vuelve);
  assert.deepEqual(vuelve.lineas.slice(0, 2), ['Su plan venció el 02/12. Contanos cómo sigue así lo acompañamos.', 'Quedó en renovar el 04/12: ¿pudo hacerlo?']);
  assert.equal(vuelve.dias, 3);
  assert.deepEqual(ids(avisosProfe(d, '20111222')), ['1']);
});

test('aviso "Todavía no sé": vuelve el próximo día hábil con el contador subiendo', () => {
  const d = entorno('2026-12-03');    // jueves
  assert.equal(responder(d, '20111222', { socio_id: '1', respuesta: 'no_se', fecha: '2026-12-05' }).error, 'datos_invalidos');
  assert.equal(responder(d, '20111222', { socio_id: '1', respuesta: 'no_se' }).ok, true);
  assert.deepEqual(ids(avisosProfe(d, '20111222')), ['2']);      // queda el otro socio, este no
  assert.equal(avisosDe(d, '20999000').find(x => x.socio_id === '1'), undefined);
  d.dia = '2026-12-04';               // viernes: es el próximo día hábil
  assert.equal(avisosDe(d, '20999000').find(x => x.socio_id === '1').dias, 2);
  responder(d, '20999000', { socio_id: '1', respuesta: 'no_se' });
  d.dia = '2026-12-05';               // sábado: sigue callado
  d.dia = '2026-12-07';               // lunes: vuelve
  const lunes = avisosDe(d, '20999000').find(x => x.socio_id === '1');
  assert.equal(lunes.dias, 5);
  assert.match(lunes.lineas[1], /^Ya van 5 días: ¿pudiste hablar con Socia 1\? Con lo que nos cuentes lo ayudamos mejor\.$/);
});

test('aviso "No vuelve": queda documentado con el motivo, sin sacarlo antes de la baja automática', () => {
  const d = entorno();
  assert.equal(responder(d, '20111222', { socio_id: '5', respuesta: 'no_vuelve' }).error, 'prohibido');   // no es su socio
  assert.equal(responder(d, '20111222', { socio_id: '1', respuesta: 'no_vuelve', nota: 'x'.repeat(201) }).error, 'datos_invalidos');
  const r = responder(d, '20111222', { socio_id: '1', respuesta: 'no_vuelve', nota: 'Se mudó de ciudad' });
  assert.equal(r.ok, true);
  assert.deepEqual(ids(avisosDe(d, '20999000')), ['2', '5']);
  assert.deepEqual(ids(avisosProfe(d, '20111222')), ['2']);
  const f = ficha(d, '20999000', '1');
  assert.equal(f.condicion, 'ACTIVO');                         // la condición sigue siendo la automática: la baja la cuenta la PC a los 7 días
  assert.equal(d.repo.hojas.profe_planilla_edit, undefined);
  assert.deepEqual(f.aviso_hist.map(h => [h.quien, h.respuesta, h.nota]), [['Profe Uno', 'no_vuelve', 'Se mudó de ciudad']]);
  // sin motivo también vale
  assert.equal(responder(d, '20999000', { socio_id: '2', respuesta: 'no_vuelve' }).ok, true);
  // a los 7 días la PC lo pasa a BAJA (condición automática) y el aviso ya no corresponde
  pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: HOY, filas: [fila('5', { condicion_auto: 'BAJA', vence: '2026-12-01', profe_dni: '20333444' })] });
  assert.deepEqual(ids(avisosDe(d, '20999000')), []);
});

test('aviso "Está de vacaciones": recepción las carga con las reglas; si lo responde un profe queda como pedido a recepción', () => {
  const d = entorno();
  // el profe no las carga: queda como pedido, con la fecha de vuelta
  assert.equal(responder(d, '20111222', { socio_id: '1', respuesta: 'vacaciones' }).error, 'vac_sin_vuelta');
  assert.equal(responder(d, '20111222', { socio_id: '1', respuesta: 'vacaciones', fecha: '2027-03-01' }).error, 'vac_larga');
  const p = responder(d, '20111222', { socio_id: '1', respuesta: 'vacaciones', fecha: '2026-12-20' });
  assert.equal(p.ok, true);
  assert.equal(p.data.registrada, 'vacaciones_pedida');
  assert.equal(d.repo.hojas.profe_planilla_edit, undefined);                          // todavía no hay condición cargada
  assert.deepEqual(ids(avisosProfe(d, '20111222')), ['2']);                           // a este socio ya no le aparece al profe
  const pedido = avisosDe(d, '20999000').find(x => x.socio_id === '1');                // a recepción sí, con el pedido
  assert.equal(pedido.titulo, 'Profe Uno cuenta que Socia 1 está de vacaciones');
  assert.deepEqual(pedido.lineas, ['Dice que vuelve el 20/12. Si lo confirmás, cargá las vacaciones así no cuentan como baja.']);
  assert.equal(pedido.pedido_vacaciones.hasta, '2026-12-20');
  // recepción las carga: con las reglas de siempre (hasta 7 días después de vencer, con vuelta, hasta 60 días)
  assert.equal(responder(d, '20999000', { socio_id: '1', respuesta: 'vacaciones', fecha: '2027-03-01' }).error, 'vac_larga');
  assert.equal(responder(d, '20999000', { socio_id: '1', respuesta: 'vacaciones' }).error, 'vac_sin_vuelta');
  const ok = responder(d, '20999000', { socio_id: '1', respuesta: 'vacaciones', fecha: '2026-12-20' });
  assert.equal(ok.ok, true);
  const f = ficha(d, '20111222', '1');
  assert.equal(f.condicion, 'VACACIONES');
  assert.equal(f.condicion_manual.hasta, '2026-12-20');
  assert.equal(f.condicion_manual.quien, 'Rocío');
  assert.deepEqual(ids(avisosDe(d, '20999000')), ['2', '5']);
  assert.deepEqual(f.aviso_hist.map(h => h.respuesta), ['vacaciones', 'vacaciones_pedida']);
  // recepción directo, en otro socio: queda cargada sin pasar por el pedido
  assert.equal(responder(d, '20999002', { socio_id: '5', respuesta: 'vacaciones', fecha: '2026-12-15' }).ok, true);
  assert.equal(ficha(d, '20999002', '5').condicion, 'VACACIONES');
});

test('aviso: quién puede responder, y si otro ya respondió no se pisa', () => {
  const d = entorno();
  assert.equal(responder(d, '20333444', { socio_id: '1', respuesta: 'no_se' }).error, 'prohibido');   // profe de otro socio
  assert.equal(responder(d, '20999001', { socio_id: '1', respuesta: 'no_se' }).error, 'prohibido');   // recepción de otra sede
  assert.equal(responder(d, '20999000', { socio_id: 'nadie', respuesta: 'no_se' }).error, 'no_existe');
  assert.equal(responder(d, '20999000', { socio_id: '1', respuesta: 'otra' }).error, 'datos_invalidos');
  assert.equal(responder(d, '20555666', { socio_id: '1', respuesta: 'no_se' }).ok, true);              // coordinación de la sede
  assert.equal(pedir(d, { accion: 'aviso_condicion_responder', socio_id: '1', respuesta: 'no_se' }).error, 'sin_sesion');
  // el otro llega tarde: no se guarda de nuevo y se le cuenta quién fue
  const tarde = responder(d, '20111222', { socio_id: '1', respuesta: 'renueva', fecha: '2026-12-04' });
  assert.equal(tarde.ok, true);
  assert.equal(tarde.data.ya_respondido.quien, 'Coordinación');
  assert.equal(tarde.data.ya_respondido.respuesta, 'no_se');
  assert.equal(d.repo.hojas.aviso_condicion.length, 1);
});

test('aviso: una respuesta vale para ese vencimiento; si renueva y vuelve a vencer, se pregunta de nuevo', () => {
  const d = entorno();
  responder(d, '20111222', { socio_id: '1', respuesta: 'no_vuelve' });
  assert.deepEqual(ids(avisosProfe(d, '20111222')), ['2']);
  pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: HOY, filas: [fila('1', { vence: '2026-12-02' })] });
  assert.deepEqual(ids(avisosProfe(d, '20111222')), []);                       // el mismo vencimiento: sigue respondido
  d.dia = '2027-01-05';
  pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: d.dia, filas: [fila('1', { vence: '2027-01-04' })] });   // renovó y venció de nuevo
  assert.deepEqual(ids(avisosProfe(d, '20111222')), ['1']);
});

test('aviso: la planilla trae los avisos según quién la mira, y la ficha el historial', () => {
  const d = entorno();
  const prof = pedir(d, { accion: 'profe_planilla', token: entrar(d, '20111222') }).data;
  assert.deepEqual(ids(prof.avisos), ['1', '2']);
  const rec = pedir(d, { accion: 'profe_planilla', token: entrar(d, '20999000') }).data;
  assert.deepEqual(ids(rec.avisos), ['1', '2', '5']);
  responder(d, '20999000', { socio_id: '1', respuesta: 'no_se' });
  assert.deepEqual(ids(pedir(d, { accion: 'profe_planilla', token: entrar(d, '20111222') }).data.avisos), ['2']);
  assert.equal(ficha(d, '20111222', '1').aviso_hist.length, 1);
  assert.deepEqual(ficha(d, '20111222', '2').aviso_hist, []);
});

test('aviso: las respuestas de más de 180 días se borran solas', () => {
  const viejo = { id: 'ac-1-viejo', socio_id: '1', sede: 'bolson', profe_dni: '20111222', vence: '2026-05-01', respuesta: 'no_se', hasta: '', nota: '', dni: '20999000', nombre: 'Rocío', ts: '2026-05-02T15:00:00.000Z' };
  const reciente = Object.assign({}, viejo, { id: 'ac-1-reciente', ts: '2026-11-20T15:00:00.000Z', vence: '2026-11-20' });
  const d = entorno(HOY, null, { aviso_condicion: [viejo, reciente] });
  responder(d, '20999000', { socio_id: '1', respuesta: 'no_se' });
  assert.deepEqual(d.repo.hojas.aviso_condicion.map(a => a.id).slice(0, 1), ['ac-1-reciente']);
  assert.equal(d.repo.hojas.aviso_condicion.length, 2);
  assert.equal(d.repo.hojas.aviso_condicion.some(a => a.id === 'ac-1-viejo'), false);
});

test('aviso: los mensajes de error se entienden y la hoja nueva tiene sus columnas', () => {
  const api = require('../web/api.js');
  ['aviso_sin_fecha', 'aviso_fecha_lejos'].forEach(c => assert.notEqual(api.mensaje(c), api.mensaje('cualquiera'), c));
  const fs = require('fs'), path = require('path');
  const hojas = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Hojas.js'), 'utf8');
  assert.match(hojas, /aviso_condicion: \['id', 'socio_id', 'sede', 'profe_dni', 'vence', 'respuesta', 'hasta', 'nota', 'dni', 'nombre', 'ts'\]/);
});

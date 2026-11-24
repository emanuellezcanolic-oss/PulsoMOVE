// ➕ Contacto extra (24/11/2026): recepción anota un contacto a un socio que no estaba en su lista del día.
const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario } = require('./repo_falso');

const ANA = usuario({ dni: '30123456', nombre: 'Ana Prueba', sede: 'bolson', roles: 'recepcion' });
const BETO = usuario({ dni: '28999888', nombre: 'Beto Prueba', sede: 'puelo', roles: 'recepcion' });
const PROFE = usuario({ dni: '27111222', nombre: 'Profe Prueba', sede: 'bolson', roles: 'profe' });
const HOY = '2026-11-24';
const AHORA = Date.parse(HOY + 'T15:00:00Z');
const tarea = o => Object.assign({ id: 'T1', fecha: HOY, sede: 'bolson', socio_id: '501', socio_nombre: 'Socio Uno', profe: 'Profe A', tipo: 'Vence en 7 días', prioridad: '2',
  situacion: 'Vence el 27/11', accion: 'Llamar', ultima_anotacion: '', asignado_dni: '30123456', pendiente_desde: HOY, estado: 'pendiente', hecha_en: '', intro: '' }, o);
const planilla = (id, nombre, sede) => ({ socio_id: id, sede: sede || 'bolson', profe_dni: '27111222', profe_nombre: 'Profe Prueba', nombre: nombre, condicion_auto: 'ACTIVO', vence: '2026-12-20', meses: '{}', cargada: HOY });

function entorno(extra) {
  return depsFalsas({ repo: repoFalso(Object.assign({ usuarios: [ANA, BETO, PROFE], tareas: [], registro: [], rendimiento: [], objetivos: [], actividad: [],
    profe_planilla: [planilla('601', 'Socia Seis'), planilla('602', 'Socio Siete'), planilla('603', 'Socia Puelo', 'puelo')] }, extra || {})), hoy: HOY, ahora: AHORA });
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni: dni || '30123456', pin: '4831' }).data.token;
const extra = (d, datos, dni) => pedir(d, Object.assign({ accion: 'contacto_extra', token: entrar(d, dni), id_marca: 'm-' + Math.random().toString(36).slice(2), canal: 'MP', resultado: 'NOTIFICADO' }, datos));
const valores = d => pedir(d, { accion: 'rendimiento', token: entrar(d), mes: '2026-11' }).data.personas.find(p => p.dni === '30123456').valores;

test('contacto extra: los socios para elegir son los de la planilla de la sede', () => {
  const d = entorno({ tareas: [tarea({ socio_id: '777', socio_nombre: 'Socio Tarea' }), tarea({ id: 'T2', socio_id: 'eval-9', socio_nombre: 'No va' })] });
  const r = pedir(d, { accion: 'contacto_extra_socios', token: entrar(d) });
  assert.deepEqual(r.data.socios.map(s => s.nombre), ['Socia Seis', 'Socio Siete', 'Socio Tarea']);
  assert.equal(pedir(d, { accion: 'contacto_extra_socios', token: entrar(d, '27111222') }).error, 'prohibido');   // el profe no
  assert.deepEqual(pedir(d, { accion: 'contacto_extra_socios', token: entrar(d, '28999888') }).data.socios.map(s => s.nombre), ['Socia Puelo']);
});

test('contacto extra: queda hecha como "Contacto extra" y suma en mensajes y tareas hechas', () => {
  const d = entorno();
  const r = extra(d, { socio_id: '601', canal: 'LL', resultado: 'PAGA', fecha: '2026-11-27', detalle: 'Paga el jueves' });
  assert.deepEqual(r.data, { extra: true, socio_nombre: 'Socia Seis' });
  const t = d.repo.hojas.tareas[0];
  assert.equal(t.tipo, 'Contacto extra');
  assert.equal(t.estado, 'hecha');
  assert.equal(t.asignado_dni, '30123456');
  assert.equal(t.socio_id, 'extra-601');
  const m = d.repo.hojas.registro[0];
  assert.equal(m.tipo, 'Contacto extra');
  assert.equal(m.socio_id, '601');          // para que figure en los contactos de la ficha de la planilla
  assert.equal(m.canal, 'LL');
  assert.equal(L.esContactoConSocio(m), true);
  // en la lista del día de la persona queda a la vista, hecha
  const lista = pedir(d, { accion: 'mis_tareas', token: entrar(d) }).data.tareas;
  assert.deepEqual(lista.map(x => [x.tipo, x.estado]), [['Contacto extra', 'hecha']]);
  const v = valores(d);
  assert.equal(v.mensajes, 1);
  assert.equal(v.tareas_hechas, 1);
  assert.equal(v.tareas_extra, 1);
  const dia = pedir(d, { accion: 'mi_dia', token: entrar(d) }).data;
  assert.equal(dia.hoy.mensajes, 1);
  assert.equal(dia.hoy.hechas, 1);
});

test('contacto extra: no toca el denominador ni el % de cumplimiento', () => {
  const d = entorno({ tareas: [tarea({ id: 'A', estado: 'hecha', hecha_en: HOY + 'T14:00:00.000Z' }), tarea({ id: 'B', socio_id: '502' })] });
  assert.equal(valores(d).tareas_pct, 1 / 2);
  extra(d, { socio_id: '601' });
  extra(d, { socio_id: '602', canal: 'PR' });
  const v = valores(d);
  assert.equal(v.tareas_total, 2);            // los extras no suben el total
  assert.equal(v.tareas_pct, 1 / 2);          // ni cambian el %: suman, pero no restan si no se hacen
  assert.equal(v.tareas_hechas, 3);
  assert.equal(v.tareas_extra, 2);
  assert.equal(v.mensajes, 2);
  assert.equal(pedir(d, { accion: 'mi_dia', token: entrar(d) }).data.hoy.pendientes, 1);
});

test('contacto extra: si el socio ya estaba en la lista de hoy, se cierra esa tarea y no se duplica', () => {
  const d = entorno({ tareas: [tarea({ id: 'T9', socio_id: '601', socio_nombre: 'Socia Seis', tipo: 'Vence en 7 días' })] });
  const r = extra(d, { socio_id: '601', canal: 'AU', resultado: 'RESERVA' });
  assert.equal(r.data.cerro, 'Vence en 7 días');
  assert.equal(d.repo.hojas.tareas.length, 1);
  assert.equal(d.repo.hojas.tareas[0].estado, 'hecha');
  assert.equal(d.repo.hojas.registro.length, 1);
  assert.equal(d.repo.hojas.registro[0].tarea_id, 'T9');
  assert.equal(valores(d).tareas_extra, 0);
  assert.equal(valores(d).mensajes, 1);
  // una tarea de otra persona no se cierra: ahí sí queda el extra
  const e = entorno({ tareas: [tarea({ id: 'T8', socio_id: '602', asignado_dni: '28999888' })] });
  extra(e, { socio_id: '602' });
  assert.equal(e.repo.hojas.tareas.find(t => t.id === 'T8').estado, 'pendiente');
  assert.equal(e.repo.hojas.tareas.length, 2);
});

test('contacto extra: validaciones (canal real, resultado, socio de la sede) y no se repite', () => {
  const d = entorno();
  const mal = (datos, err, dni) => assert.equal(extra(d, datos, dni).error, err, JSON.stringify(datos));
  mal({ socio_id: '601', canal: 'SIN CONTACTO' }, 'datos_invalidos');
  mal({ socio_id: '601', canal: 'MG' }, 'datos_invalidos');            // AU/MP/LL/PR como el resto
  mal({ socio_id: '601', resultado: 'RARO' }, 'datos_invalidos');
  mal({ socio_id: '601', resultado: 'PAGA' }, 'datos_invalidos');       // pide fecha
  mal({ socio_id: '601', resultado: 'BAJA' }, 'datos_invalidos');       // pide detalle
  mal({ socio_id: '601', resultado: 'ESPERANDO', fecha: '2026-11-30', detalle: 'x' }, 'datos_invalidos');
  mal({ socio_id: '603' }, 'no_existe');                                // es de otra sede
  mal({ socio_id: 'nadie' }, 'no_existe');
  mal({ socio_id: '601' }, 'prohibido', '27111222');                    // el profe no
  assert.equal(d.repo.hojas.tareas.length, 0);
  const una = { socio_id: '601', id_marca: 'fija' };
  extra(d, una); extra(d, una);
  assert.equal(d.repo.hojas.tareas.length, 1);
  assert.equal(d.repo.hojas.registro.length, 1);
});

test('contacto extra: un "no contestó" extra no baja el contacto efectivo', () => {
  const d = entorno({ registro: [{ id_marca: 'x', ts: HOY + 'T13:00:00.000Z', dni: '30123456', tipo: 'Vence el plan', canal: 'LL', resultado: 'PAGÓ' }] });
  const antes = valores(d).contacto_pct;
  extra(d, { socio_id: '601', resultado: 'NO CONTESTA' });
  assert.equal(valores(d).contacto_pct, antes);
  assert.equal(valores(d).mensajes, 2);
});

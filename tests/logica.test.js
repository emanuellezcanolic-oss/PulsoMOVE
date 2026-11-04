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
  ok({ canal: 'MP', resultado: 'SALUDADO' });
  mal({ canal: 'PR', resultado: 'LLEGÓ' });
  mal({ canal: 'PR', resultado: 'SIN CAMBIO' });
  ok({ canal: 'PR', resultado: 'SIN CAMBIO', detalle: 'Lo pidió el socio' });
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

test('fusionarCarga guarda y actualiza intro', () => {
  let f = L.fusionarCarga([], [nueva({ intro: 'Texto 1' })], [], '2026-11-06');
  assert.equal(f[0].intro, 'Texto 1');
  f = L.fusionarCarga(f, [nueva({ intro: 'Texto 2' })], [], '2026-11-09');
  assert.equal(f[0].intro, 'Texto 2');
});

test('fusionarCarga: cerrar con hecha=true la deja hecha, verificada', () => {
  const base = L.fusionarCarga([], [nueva({ tipo: 'Asignarle profesor' })], [], '2026-11-05');
  const f = L.fusionarCarga(base, [], [{ sede: 'bolson', socio_id: '501', hecha: true }], '2026-11-06');
  assert.equal(f[0].estado, 'hecha');
  assert.equal(f[0].hecha_en, '2026-11-06T15:00:00.000Z');
  assert.equal(f[0].fecha, '2026-11-06');
});

test('NOTIFICADO: un recordatorio enviado no pide fecha ni motivo', () => {
  assert.equal(L.validarMarca({ canal: 'MP', resultado: 'NOTIFICADO' }), null);
});

test('resultados por categoría: cada uno una sola vez, y lo que queda afuera tiene su propio formulario', () => {
  const agrupados = L.GRUPOS_RESULTADO.flatMap(g => g[1]);
  assert.equal(new Set(agrupados).size, agrupados.length);
  assert.deepEqual(L.RESULTADOS.filter(r => agrupados.indexOf(r) < 0).sort(), ['AGENDADA', 'CORREGIDO', 'ENCUESTA ENVIADA', 'HECHO', 'LO CAMBIA EL PROFE', 'LO SIGUE EL PROFE', 'NO HACE FALTA', 'NO SE HACE', 'REPROGRAMADA', 'SALUDADO', 'SE HIZO', 'SEGUIDO', 'SIN CAMBIO']);
  assert.ok(agrupados.every(r => L.RESULTADOS.indexOf(r) >= 0));
});

test('evaluación: agendada y reprogramada piden la fecha; si no se hace, el motivo', () => {
  assert.equal(L.validarMarca({ canal: 'PR', resultado: 'AGENDADA' }), 'datos_invalidos');
  assert.equal(L.validarMarca({ canal: 'PR', resultado: 'AGENDADA', fecha: '2026-11-20' }), null);
  assert.equal(L.validarMarca({ canal: 'PR', resultado: 'REPROGRAMADA' }), 'datos_invalidos');
  assert.equal(L.validarMarca({ canal: 'PR', resultado: 'SE HIZO' }), null);
  assert.equal(L.validarMarca({ canal: 'PR', resultado: 'NO SE HACE' }), 'datos_invalidos');
  assert.equal(L.validarMarca({ canal: 'PR', resultado: 'NO SE HACE', detalle: 'Se fue de viaje' }), null);
});

test('la fecha se pide y se pregunta en los mismos resultados', () => {
  assert.deepEqual(Object.keys(L.PREGUNTA_FECHA).sort(), L.PIDEN_FECHA.slice().sort());
});

test('seVerificaEnMove', () => {
  assert.ok(L.seVerificaEnMove('Asignarle profesor'));
  assert.ok(L.seVerificaEnMove('Corregir calendario'));
  assert.ok(!L.seVerificaEnMove('Coordinar reevaluación'));
  assert.ok(!L.seVerificaEnMove('Coordinar evaluación inicial'));
  assert.ok(!L.seVerificaEnMove('Riesgo alto'));
});

// ---------- Rendimiento ----------

test('puntuar: pondera, tope 100% por métrica y reparte el peso de lo que no tiene datos', () => {
  const v = { tareas_pct: 0.9, a_tiempo_pct: 0.4, nuevos: 40 };
  const r = L.puntuar(v, {});
  const fila = k => r.filas.find(x => x.clave === k);
  assert.equal(fila('tareas_pct').cumple, 1);
  assert.equal(fila('a_tiempo_pct').cumple, 0.5);
  assert.equal(fila('nuevos').cumple, 1);        // 40 de 20: no suma más de 100%
  assert.equal(fila('referidos').cumple, null);  // sin dato: no castiga
  const pesos = 15 + 10 + 8;
  assert.equal(r.total, Math.round((15 + 5 + 8) / pesos * 100));
  assert.equal(r.grupos.find(g => g.nombre === 'Cumplimiento').puntaje, 80);
  assert.equal(r.grupos.find(g => g.nombre === 'Retención').puntaje, null);
});

test('puntuar: usa el objetivo de la persona y un objetivo 0 no cuenta', () => {
  const a = L.puntuar({ nuevos: 5 }, { nuevos: 10 });
  assert.equal(a.filas.find(x => x.clave === 'nuevos').objetivo, 10);
  assert.equal(a.total, 50);
  const b = L.puntuar({ nuevos: 5, tienda: 1 }, { tienda: 0 });
  assert.equal(b.filas.find(x => x.clave === 'tienda').cumple, null);
});

test('puntuar: el incentivo se habilita solo con el cumplimiento al día', () => {
  assert.equal(L.puntuar({ tareas_pct: 1, a_tiempo_pct: 1 }, {}).incentivo, true);
  assert.equal(L.puntuar({ tareas_pct: 0.5, nuevos: 40 }, {}).incentivo, false);
  assert.equal(L.puntuar({ nuevos: 40 }, {}).incentivo, null);
});

test('puntuar: sin ningún dato no hay puntaje', () => {
  const r = L.puntuar({}, {});
  assert.equal(r.total, null);
});

// ---------- Motivación ----------

test('fusionarCarga usa la fecha de cada tarea y deja adelantar', () => {
  const f = L.fusionarCarga([], [nueva({ fecha: '2026-11-06' })], [], '2026-11-04');
  assert.equal(f[0].fecha, '2026-11-06');
  assert.equal(f[0].pendiente_desde, '2026-11-06');
  assert.equal(f[0].id, '2026-11-06-bolson-501');
});

test('puntos: el plan de 3 meses vale el doble que un socio nuevo', () => {
  assert.equal(L.calcularPuntos({ nuevos: 1 }), 5);
  assert.equal(L.calcularPuntos({ planes_largos: 1 }), 10);
  assert.equal(L.calcularPuntos({ tareas_hechas: 3, adelantadas: 2, tienda: 1, resenas: 1, referidos: 1, consultas: 1 }), 3 + 2 + 2 + 2 + 3 + 1);
  assert.equal(L.calcularPuntos({}), 0);
});

test('coach: pide planes de 3 meses a los 3 días sin vender', () => {
  const m = L.mensajesCoach({ dias_sin_plan_largo: 3 }, {}, { hoy: '2026-11-15' });
  assert.ok(m.some(x => x.clave === 'plan' && /3 días/.test(x.texto)));
  assert.ok(!L.mensajesCoach({ dias_sin_plan_largo: 2 }, {}, { hoy: '2026-11-15' }).some(x => x.clave === 'plan'));
});

test('coach: buenas ventas y pocos mensajes, y al revés', () => {
  const c = { hoy: '2026-11-15' };
  assert.ok(L.mensajesCoach({ nuevos: 15, mensajes: 5 }, {}, c).some(x => x.clave === 'mensajes'));
  assert.ok(L.mensajesCoach({ nuevos: 1, mensajes: 90 }, {}, c).some(x => x.clave === 'ventas'));
  assert.ok(!L.mensajesCoach({ nuevos: 15, mensajes: 90 }, {}, c).some(x => x.clave === 'ventas' || x.clave === 'mensajes'));
});

test('coach: atrasadas, felicita y no pasa de 3 mensajes', () => {
  assert.ok(L.mensajesCoach({}, {}, { hoy: '2026-11-15', atrasadas: 4 }).some(x => x.clave === 'atrasadas'));
  assert.ok(L.mensajesCoach({ tareas_pct: 0.95 }, {}, { hoy: '2026-11-15' }).some(x => x.clave === 'bien'));
  assert.ok(L.mensajesCoach({ dias_sin_plan_largo: 9, nuevos: 15, mensajes: 1, tareas_pct: 0.95 }, {}, { hoy: '2026-11-15', atrasadas: 2, racha: 5 }).length <= 3);
});

test('frase y saludo', () => {
  assert.match(L.saludo('Ara Stettler', 9), /Hola Ara/);
  assert.ok(L.fraseDelDia(0, 10, 1).length > 10);
  assert.notEqual(L.fraseDelDia(0, 10, 1), L.fraseDelDia(10, 10, 1));
  assert.match(L.fraseDelDia(8, 10, 1), /2/);   // faltan 2
});

test('audio: lo recomienda en los contactos delicados', () => {
  assert.ok(L.recomiendaAudio('Pagó y no viene: llamada'));
  assert.ok(L.recomiendaAudio('Encuesta de baja'));
  assert.ok(!L.recomiendaAudio('Socio nuevo · semana 2'));
  assert.ok(L.validarMarca({ canal: 'AU', resultado: 'RESERVA' }) === null);
});

// ---------- Avisos personalizados ----------

const ctxAviso = o => Object.assign({ nombre: 'Ara Stettler', minuto: 9 * 60, inicio: 8 * 60, fin: 14 * 60, hechas: 3, pendientes: 10, minutosSinMarcar: 5, enviados: {}, siguiente: null, ayer: 0, racha: 0, adelantar: 0, puntos: 0, diasSinPlan: 0 }, o);

test('aviso: arranque con el primer socio', () => {
  const a = L.proximoAviso(ctxAviso({ minuto: 8 * 60 + 5, hechas: 0, siguiente: { nombre: 'Diego', situacion: '18 días sin venir' } }));
  assert.equal(a.clave, 'arranque');
  assert.match(a.titulo, /Ara/);
  assert.match(a.cuerpo, /Diego/);
});

test('aviso: tiempo sin marcar, ritmo y última hora', () => {
  assert.equal(L.proximoAviso(ctxAviso({ minutosSinMarcar: 45 })).clave.indexOf('sin-marcar'), 0);
  assert.equal(L.proximoAviso(ctxAviso({ minuto: 11 * 60 + 30, hechas: 2, pendientes: 20 })).clave, 'ritmo');
  assert.equal(L.proximoAviso(ctxAviso({ minuto: 13 * 60 + 10, hechas: 20, pendientes: 2 })).clave, 'ultima-hora');
});

test('aviso: logros', () => {
  assert.equal(L.proximoAviso(ctxAviso({ hechas: 12, ayer: 10 })).clave, 'supero-ayer');
  assert.equal(L.proximoAviso(ctxAviso({ hechas: 10, enviados: {} })).clave, 'cuenta-10');
  assert.equal(L.proximoAviso(ctxAviso({ hechas: 5, pendientes: 0, adelantar: 30 })).clave, 'adelantar');
});

test('aviso: no repite y fuera del turno no molesta', () => {
  assert.equal(L.proximoAviso(ctxAviso({ hechas: 12, ayer: 10, enviados: { 'supero-ayer': 1, 'cuenta-10': 1 } })), null);
  assert.equal(L.proximoAviso(ctxAviso({ minuto: 7 * 60 })), null);
  assert.equal(L.proximoAviso(ctxAviso({ minuto: 15 * 60, minutosSinMarcar: 90 })), null);
  assert.equal(L.proximoAviso(ctxAviso({ minutosSinMarcar: 45, pendientes: 0 })), null);
});

test('plan de 3 meses en el aviso', () => {
  assert.equal(L.proximoAviso(ctxAviso({ diasSinPlan: 4 })).clave, 'plan');
});

test('audio y guía para socios antiguos', () => {
  assert.ok(L.recomiendaAudio('Socio antiguo: invitarlo a volver'));
  assert.ok(L.calcularPuntos({ reenganches: 1 }) >= 10);
});

test('prioridad: lo que se pierde va primero, lo atrasado sube y el cierre queda al final', () => {
  assert.equal(L.nivelDeTarea({ tipo: 'Le vence el plan esta semana' }), 1);
  assert.equal(L.nivelDeTarea({ tipo: 'Apertura del turno' }), 1);
  assert.equal(L.nivelDeTarea({ tipo: 'Entrena en otra sede' }), 2);
  assert.equal(L.nivelDeTarea({ tipo: 'Revisar plan con el profe' }), 2);
  assert.equal(L.nivelDeTarea({ tipo: 'Socio antiguo: invitarlo a volver' }), 3);
  assert.equal(L.nivelDeTarea({ tipo: 'Socio antiguo: invitarlo a volver', dias_pendiente: 2 }), 2);
  assert.equal(L.nivelDeTarea({ tipo: 'Entrena en otra sede', dias_pendiente: 3 }), 1);
  assert.equal(L.nivelDeTarea({ tipo: 'Cierre del turno', dias_pendiente: 5 }), 3);
});

test('medallas: avance propio, con tope en la meta', () => {
  const m = L.medallasDelMes({ tareas: 3, racha: 7, puente: 4 });
  const de = k => m.find(x => x.clave === k);
  assert.equal(de('primera').ganada, true);
  assert.equal(de('constancia').ganada, true);
  assert.equal(de('constancia').actual, 5);
  assert.equal(de('puente').ganada, false);
  assert.equal(de('puente').actual, 4);
  assert.equal(de('voz').actual, 0);
});

test('resumen de cierres: promedia lo respondido y cuenta las notas bajas', () => {
  const r = L.resumenCierres([
    { sede: 'bolson', animo: '5', sala: '2', profes: '4' },
    { sede: 'bolson', animo: '4', sala: '', profes: '' },
    { sede: 'puelo', animo: '3', sala: '3', profes: '3' },
  ]);
  assert.equal(r.total.respuestas, 3);
  assert.equal(r.total.dia, 4);
  assert.equal(r.sedes[0].sede, 'bolson');
  assert.equal(r.sedes[0].sala, 2);
  assert.equal(r.bajas, 1);
});

test('aviso de media hora: recomienda y recuerda lo pendiente', () => {
  const a = L.avisoMediaHora('Ara Stettler', 3, 0);
  assert.match(a.titulo, /Ara, falta media hora/);
  assert.match(a.cuerpo, /baños/);
  assert.match(a.cuerpo, /quedan 3 tareas/);
  assert.match(a.cuerpo, /contar por qué/);
  assert.match(L.avisoMediaHora('Ara', 0, 1).cuerpo, /al día/);
  assert.notEqual(L.avisoMediaHora('Ara', 0, 0).cuerpo, L.avisoMediaHora('Ara', 0, 1).cuerpo);
});

test('encuesta: cambia de un día al otro y los lunes pregunta por el finde', () => {
  const a = L.preguntasDelDia('2026-11-03', 7), b = L.preguntasDelDia('2026-11-04', 7);
  assert.notEqual(a.nota.clave, b.nota.clave);
  assert.notEqual(a.abierta, b.abierta);
  assert.match(L.preguntasDelDia('2026-11-09', 7).abierta, /finde/);
  assert.doesNotMatch(a.abierta, /finde/);
  assert.deepEqual(L.preguntasDelDia('2026-11-04', 7), b);
  const claves = new Set(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map(f => L.preguntasDelDia(f, 7).nota.clave));
  assert.equal(claves.size, 4);
});

test('avisos nuevos: medalla, lunes, prioritarias, los que volvieron y el equipo', () => {
  const medalla = { clave: 'puente', emoji: '🤝', nombre: 'Puente', como: '10 tareas' };
  assert.equal(L.proximoAviso(ctxAviso({ nuevaMedalla: medalla })).clave, 'medalla-puente');
  assert.equal(L.proximoAviso(ctxAviso({ diaSemana: 1, minuto: 8 * 60 + 10 })).clave, 'lunes');
  assert.equal(L.proximoAviso(ctxAviso({ prioritarias: 3, minuto: 10 * 60 })).clave, 'prioritarias');
  assert.equal(L.proximoAviso(ctxAviso({ volvieron: 2 })).clave, 'volvieron-2');
  assert.equal(L.proximoAviso(ctxAviso({ equipoHechas: 24, equipoFaltan: 5, minuto: 12 * 60 })).clave, 'equipo-2');
});

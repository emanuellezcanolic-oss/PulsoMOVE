// Plan extra de un socio que figura como de otro profe (24/11/2026): el plan lo cuenta quien lo hizo y el dueño responde si es su socio.
const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const HOY = '2026-11-24';
const DUENA = usuario({ dni: '20111222', nombre: 'Agus Prueba', roles: 'profe', sede: 'bolson' });
const HIZO = usuario({ dni: '20333444', nombre: 'Emanuel Prueba', roles: 'profe', sede: 'bolson' });
const REC = usuario({ dni: '30111111', nombre: 'Rocío Prueba', roles: 'recepcion', sede: 'bolson' });
const REC2 = usuario({ dni: '30222222', nombre: 'Tomás Prueba', roles: 'recepcion', sede: 'bolson' });
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;

const reeval = (id, profe, dni) => ({ id: 're-' + id, sede: 'bolson', profe, profe_dni: dni, socio_id: String(id), socio_nombre: 'Socio ' + id, ultima_eval: '', dias: '', habitos: '' });
const filaPl = (id, dni, nombre) => ({ socio_id: String(id), sede: 'bolson', profe_dni: dni, profe_nombre: nombre, nombre: 'Socio ' + id, condicion_auto: 'ACTIVO', vence: '2026-12-20',
  plan_meses: '1', plan_tipo: 'paga', plan_fecha: '2026-11-01', plan_proximo: '2026-12-01', plan_rutinas: '3', plan_pct: '45', plan_estado: 'ok', ultima_eval: '', perfil: 'Si',
  ultima_visita: '', contacto_fecha: '', contacto_quien: '', contacto_canal: '', contacto_resultado: '', contacto_nota: '', contactos_n: '0', meses: {}, mov_mes: 'por_vencer',
  observaciones: '', profe_move: '', origen: 'planilla' });

function entorno() {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [DUENA, HIZO, REC, REC2], tareas: [], profe_tareas: [],
    profe_reeval: [reeval(5, 'Agus Prueba', '20111222'), reeval(6, 'Emanuel Prueba', '20333444')] }), hoy: HOY, ahora: Date.parse(HOY + 'T15:00:00Z') });
  const r = pedir(d, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: HOY, filas: [filaPl(5, '20111222', 'Agus Prueba'), filaPl(6, '20333444', 'Emanuel Prueba')] });
  assert.ok(r.ok, JSON.stringify(r));
  return d;
}
const avisosDe = (d, dni) => pedir(d, { accion: 'profe_tareas', token: entrar(d, dni) }).data.mio.avisos_dueno;
const fichaDe = (d, id, dni) => pedir(d, { accion: 'profe_planilla', token: entrar(d, dni || '30111111') }).data.filas.find(f => f.socio_id === id);
const anotar = (d, id) => pedir(d, { accion: 'profe_plan_extra', token: entrar(d, '20333444'), socio_id: String(id) });

test('al anotar el plan de un socio de otro profe, el dueño recibe el aviso con las dos opciones', () => {
  const d = entorno();
  const r = anotar(d, 5);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.aviso_dueno, 'Agus Prueba');
  const t = d.repo.hojas.profe_tareas[0];
  assert.deepEqual([t.tipo, t.estado, t.profe_dni], ['Plan extra', 'hecha', '20333444']);
  assert.equal(t.nota, 'Plan extra de un socio que no estaba en tu lista · figura como socio de Agus Prueba');
  const av = avisosDe(d, '20111222');
  assert.equal(av.length, 1);
  assert.equal(av[0].titulo, 'Emanuel Prueba modificó el plan de Socio 5, que figura como tu socio.');
  assert.equal(av[0].lineas[0], '¿Es tu socio?');
  assert.deepEqual(av[0].recepcion.map(u => u.nombre), ['Rocío Prueba', 'Tomás Prueba']);
  assert.deepEqual(avisosDe(d, '20333444'), []);                 // a quien lo hizo no le llega
  assert.equal(d.repo.hojas.aviso_dueno[0].estado, 'pendiente');
});

test('un socio mío no genera aviso, y la nota ya no dice "en MOVE es socio de"', () => {
  const d = entorno();
  const r = anotar(d, 6);
  assert.equal(r.data.aviso_dueno, '');
  assert.equal(d.repo.hojas.profe_tareas[0].nota, 'Plan extra de un socio que no estaba en tu lista');
  assert.ok(!d.repo.hojas.aviso_dueno || d.repo.hojas.aviso_dueno.length === 0);
  // la planilla dice que es de otro aunque MOVE (reevaluaciones) lo tenga conmigo: manda la planilla, se pregunta igual
  const e = entorno();
  e.repo.hojas.profe_reeval.push(reeval(7, 'Emanuel Prueba', '20333444'));
  pedir(e, { accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: HOY, filas: [filaPl(7, '20111222', 'Agus Prueba')] });
  assert.equal(anotar(e, 7).data.aviso_dueno, 'Agus Prueba');
  assert.match(e.repo.hojas.profe_tareas[0].nota, /figura como socio de Agus Prueba$/);
});

test('sin respuesta: el dueño no cambia, "Plan hecho por" en la fila y todo en el historial', () => {
  const d = entorno();
  anotar(d, 5);
  const f = fichaDe(d, '5');
  assert.equal(f.profe_dni, '20111222');
  assert.equal(f.plan_hecho_por, 'Emanuel Prueba');
  assert.deepEqual(f.plan_extra_hist.map(h => [h.fecha, h.quien, h.aviso, h.dueno]), [[HOY, 'Emanuel Prueba', 'pendiente', 'Agus Prueba']]);
  assert.equal(fichaDe(d, '6').plan_hecho_por, '');               // el suyo, nada que marcar
  // pasados 35 días ya no se muestra
  d.dia = '2027-01-05';
  assert.equal(fichaDe(d, '5').plan_hecho_por, '');
  assert.equal(fichaDe(d, '5').plan_extra_hist.length, 1);
});

test('la PC baja los Plan extra y la respuesta del aviso (con clave)', () => {
  const d = entorno();
  anotar(d, 5);
  assert.equal(pedir(d, { accion: 'profe_planilla_ediciones', clave: 'mal' }).error, 'clave');
  const r = pedir(d, { accion: 'profe_planilla_ediciones', clave: PROPS.CLAVE_CARGA }).data;
  assert.deepEqual(r.plan_extra.map(x => [x.socio_id, x.profe_dni, x.fecha]), [['5', '20333444', HOY]]);
  assert.deepEqual(r.avisos_dueno.map(x => [x.tarea_id, x.hizo_dni, x.dueno_dni, x.estado]), [['px-5-' + HOY, '20333444', '20111222', 'pendiente']]);
  assert.deepEqual(r.filas, []);
});

test('el dueño responde que sí: queda como figura, el plan sigue siendo de quien lo hizo', () => {
  const d = entorno();
  anotar(d, 5);
  const tk = entrar(d, '20111222');
  const id = avisosDe(d, '20111222')[0].id;
  assert.equal(pedir(d, { accion: 'aviso_dueno_responder', token: entrar(d, '20333444'), id, respuesta: 'si' }).error, 'no_existe');   // no es suyo
  assert.equal(pedir(d, { accion: 'aviso_dueno_responder', token: tk, id, respuesta: 'quizás' }).error, 'datos_invalidos');
  const r = pedir(d, { accion: 'aviso_dueno_responder', token: tk, id, respuesta: 'si' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.data.avisos, []);
  assert.equal(d.repo.hojas.aviso_dueno[0].estado, 'si');
  assert.equal(d.repo.hojas.aviso_dueno[0].respondio_dni, '20111222');
  assert.equal(d.repo.hojas.profe_planilla_edit, undefined);      // no se mueve el dueño
  assert.equal(fichaDe(d, '5').profe_dni, '20111222');
  assert.equal(fichaDe(d, '5').plan_hecho_por, 'Emanuel Prueba');
  assert.match(d.repo.hojas.profe_tareas[0].nota, /Agus Prueba confirmó que es su socio$/);
  assert.equal(d.repo.hojas.tareas.length, 0);                    // y no hay tarea a recepción
  assert.equal(pedir(d, { accion: 'aviso_dueno_responder', token: tk, id, respuesta: 'no' }).data.ya_respondido, 'si');   // no se pisa
  assert.equal(d.repo.hojas.aviso_dueno[0].estado, 'si');
});

test('el dueño responde que no: el socio pasa a quien hizo el plan y recepción corrige MOVE', () => {
  const d = entorno();
  // el dueño tenía una renovación pendiente de ese socio
  pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy: HOY, tareas: [{ id: 'pp-5', fecha: '2026-11-26', sede: 'bolson', profe: 'Agus Prueba', profe_dni: '20111222',
    socio_id: '5', socio_nombre: 'Socio 5', tipo: 'Renovar plan', accion: 'Renovarlo', vence: '2026-12-01' }] });
  anotar(d, 5);
  const tk = entrar(d, '20111222');
  const id = avisosDe(d, '20111222')[0].id;
  assert.equal(pedir(d, { accion: 'aviso_dueno_responder', token: tk, id, respuesta: 'no', dni: '30999999' }).error, 'datos_invalidos');   // recepción que no es de la sede
  assert.equal(d.repo.hojas.aviso_dueno[0].estado, 'pendiente');                                                                              // y no se escribió nada
  const r = pedir(d, { accion: 'aviso_dueno_responder', token: tk, id, respuesta: 'no', dni: '30222222' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.recepcionista, 'Tomás Prueba');
  assert.deepEqual(r.data.avisos, []);
  // dueño de planilla = quien hizo el plan, como edición que la planilla respeta
  const e = d.repo.hojas.profe_planilla_edit[0];
  assert.deepEqual([e.socio_id, e.campo, e.valor, e.dni], ['5', 'profe_dni', '20333444', '20111222']);
  const f = fichaDe(d, '5');
  assert.deepEqual([f.profe_dni, f.profe_nombre, f.plan_hecho_por], ['20333444', 'Emanuel Prueba', '']);
  assert.equal(f.plan_extra_hist[0].aviso, 'no');
  assert.equal(d.repo.hojas.profe_reeval.find(c => c.socio_id === '5').profe_dni, '20333444');
  // tarea a recepción para corregir el profe en MOVE (el mismo mecanismo de "no es mi entrenado")
  const t = d.repo.hojas.tareas[0];
  assert.deepEqual([t.tipo, t.socio_id, t.asignado_dni, t.sede, t.profe, L.nivelDeTarea(t)], ['Cambiar profesor · lo pide el profe', 'profe-5', '30222222', 'bolson', 'Emanuel Prueba', 1]);
  assert.match(t.situacion, /Socio 5 no es su entrenado: es de Emanuel Prueba/);
  // lo que tenía pendiente la dueña sale de su lista y la nota de quien hizo el plan lo cuenta
  assert.equal(d.repo.hojas.profe_tareas.find(x => x.id === 'pp-5').estado, 'derivada');
  assert.match(d.repo.hojas.profe_tareas.find(x => x.id === 'px-5-' + HOY).nota, /Agus Prueba dijo que no era su socio: pasó a ser tuyo$/);
  // la PC ve la respuesta
  assert.equal(pedir(d, { accion: 'profe_planilla_ediciones', clave: PROPS.CLAVE_CARGA }).data.avisos_dueno[0].estado, 'no');
});

test('el aviso no se repite por el mismo plan y se limpia a los 180 días', () => {
  const d = entorno();
  anotar(d, 5);
  assert.equal(anotar(d, 5).error, 'ya_anotado');
  assert.equal(d.repo.hojas.aviso_dueno.length, 1);
  d.dia = '2027-06-30';
  d.t = Date.parse('2027-06-30T15:00:00Z');
  anotar(d, 6);          // cualquier alta nueva dispara la limpieza... pero el 6 es suyo: no entra por acá
  d.repo.hojas.profe_planilla = [filaPl(5, '20111222', 'Agus Prueba')];
  assert.equal(anotar(d, 5).ok, true);
  assert.equal(d.repo.hojas.aviso_dueno.length, 1);              // el viejo se borró, quedó el nuevo
  assert.equal(d.repo.hojas.aviso_dueno[0].tarea_id, 'px-5-2027-06-30');
});

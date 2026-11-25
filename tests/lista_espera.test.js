// Lista de espera (ListaEspera.js). Todo con personas y celulares inventados.
const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario } = require('./repo_falso');

const KEI = usuario({ dni: '30000001', nombre: 'Keila Prueba', roles: 'recepcion', sede: 'bariloche', turno: 'manana' });
const RUB = usuario({ dni: '30000002', nombre: 'Rubén Prueba', roles: 'recepcion', sede: 'bariloche', turno: 'tarde' });
const ROC = usuario({ dni: '30000003', nombre: 'Rocío Prueba', roles: 'recepcion', sede: 'bolson', turno: 'manana' });
const LUC = usuario({ dni: '30000004', nombre: 'Lucía Prueba', roles: 'recepcion,coordinador', sede: 'bolson' });
const EMA = usuario({ dni: '30000005', nombre: 'Emanuel Prueba', roles: 'admin', sede: 'bolson' });
const PRO = usuario({ dni: '30000006', nombre: 'Profe Prueba', roles: 'profe', sede: 'bariloche' });
const HOY = '2026-11-24';

// Por defecto el reparto del mes se apaga (queda 1 solo día hábil para repartir) y las pruebas miran los topes del día;
// las de reparto lo prenden con { reparto: true }
function entorno(personas = [], { reparto = false } = {}) {
  const config = reparto ? [] : [{ clave: 'feriados', valor: JSON.stringify(['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']) }, { clave: 'dias_min_reparto', valor: '1' }];
  const d = depsFalsas({ repo: repoFalso({ usuarios: [KEI, RUB, ROC, LUC, EMA, PRO], espera: personas, espera_config: config }), hoy: HOY, ahora: Date.parse(HOY + 'T15:00:00Z') });
  d.fecha = f => { d.dia = f; d.t = Date.parse(f + 'T15:00:00Z'); };
  return d;
}
const pedir = (d, quien, req) => L.manejar({ ...req, token: L.manejar({ accion: 'login', dni: quien.dni, pin: '4831' }, d).data.token }, d);
let n = 0;
function P(o = {}) {
  const base = { id: 'p' + (++n), sede: 'bariloche', sede_interes: 'bariloche', fecha_alta: '2026-10-20', prioridad: '3', nombre: 'Persona Inventada ' + n, celular: '5492944' + String(100000 + n),
    horario_texto: '8 a 10', franjas: 'manana', observaciones: '', estado: 'esperando', estado_ts: '', derivacion: '', evaluacion: '', interesado: '', origen: 'planilla', referido_por: '',
    contacto_dni: '', consentimiento_fecha: '2026-10-20', consentimiento_canal: 'mostrador', baja_pedida: '', intentos: '0', recon_n: '0', ultimo_contacto: '', proximo_contacto: '',
    ultimo_mensaje_ts: '', ultima_respuesta: '', respondio_alguna_vez: '', lugar_ref: '', ofertas_perdidas: '0', pases: '[]', fecha_ingreso: '', nota_pausa: '', cargada: '', creado_por: '' };
  return { ...base, ...o };
}

test('celulares: formatos mezclados van al formato de WhatsApp y lo inválido queda vacío', () => {
  const c = L.leNormalizarCelular;
  assert.equal(c('2944 12-3456'), '5492944123456');
  assert.equal(c('+54 9 2944 123456'), '5492944123456');
  assert.equal(c('0294415123456'), '5492944123456');
  assert.equal(c('294415123456'), '5492944123456');
  assert.equal(c('15123456'), '5492944123456');
  assert.equal(c('123456'), '5492944123456');
  assert.equal(c('2,944E+9'), '');
  assert.equal(c(''), '');
  assert.equal(c('12345'), '');
  assert.equal(c('1112345678'), '');   // no empieza con 2 o 3
});

test('franjas: sale del texto libre del horario', () => {
  const f = L.leFranjasDeTexto;
  assert.deepEqual(f('07 a 11HS'), ['manana']);
  assert.deepEqual(f('8:00 am'), ['manana']);
  assert.deepEqual(f('16 a 20'), ['tarde']);
  assert.deepEqual(f('4 a 8 pm'), ['tarde']);
  assert.deepEqual(f('10 a 15'), ['manana', 'tarde']);
  assert.deepEqual(f('por la mañana'), ['manana']);
  assert.deepEqual(f('mañana y tarde'), ['manana', 'tarde']);
  assert.deepEqual(f(''), []);
});

test('visibilidad: recepción ve su sede, coordinación todas, los profes ninguna', () => {
  const d = entorno([P({ sede: 'bariloche' }), P({ sede: 'bolson' })]);
  assert.equal(pedir(d, KEI, { accion: 'espera_ver' }).data.personas.length, 1);
  assert.equal(pedir(d, ROC, { accion: 'espera_ver' }).data.personas[0].sede, 'bolson');
  assert.equal(pedir(d, LUC, { accion: 'espera_ver' }).data.personas.length, 2);
  assert.equal(pedir(d, EMA, { accion: 'espera_ver' }).data.sedes.length, 3);
  assert.equal(pedir(d, PRO, { accion: 'espera_ver' }).error, 'prohibido');
  assert.equal(pedir(d, PRO, { accion: 'espera_hoy' }).error, 'prohibido');
  const id = d.repo.hojas.espera[1].id;   // de Bolsón
  assert.equal(pedir(d, KEI, { accion: 'espera_mensaje', id, clave: 'posicion' }).error, 'prohibido');
});

test('orden: prioridad, después antigüedad; los sin reconfirmar no cuentan; el pase adelanta dentro de su prioridad', () => {
  const a = P({ id: 'a', prioridad: '3', fecha_alta: '2026-09-01' });
  const b = P({ id: 'b', prioridad: '3', fecha_alta: '2026-10-01' });
  const c = P({ id: 'c', prioridad: '1', fecha_alta: '2026-11-10' });
  const viejo = P({ id: 'v', prioridad: '1', fecha_alta: '2026-05-01' });   // más de 90 días: no cuenta
  const d = entorno([a, b, c, viejo]);
  const V = pedir(d, KEI, { accion: 'espera_ver' }).data.personas;
  const lugar = id => V.find(p => p.id === id).lugar;
  assert.equal(lugar('c'), 1); assert.equal(lugar('a'), 2); assert.equal(lugar('b'), 3);
  assert.equal(lugar('v'), null);
  assert.equal(V.find(p => p.id === 'v').vigente, false);
  // pase discrecional: solo coordinación y con motivo; adelanta pero no pasa a otra prioridad
  assert.equal(pedir(d, KEI, { accion: 'espera_pase', id: 'b', lugares: 5, motivo: 'x' }).error, 'prohibido');
  assert.equal(pedir(d, LUC, { accion: 'espera_pase', id: 'b', lugares: 5, motivo: '' }).error, 'datos_invalidos');
  pedir(d, LUC, { accion: 'espera_pase', id: 'b', lugares: 5, motivo: 'Colaboró con la comunidad' });
  const V2 = pedir(d, KEI, { accion: 'espera_ver' }).data.personas;
  assert.equal(V2.find(p => p.id === 'c').lugar, 1);
  assert.equal(V2.find(p => p.id === 'b').lugar, 2);
  assert.equal(V2.find(p => p.id === 'a').lugar, 3);
  assert.ok(d.repo.hojas.espera_hist.some(h => h.tipo === 'pase' && /Colaboró/.test(h.detalle)));
});

test('alta: celular válido, duplicado avisa, referidos: 2 personas dan un pase automático', () => {
  const d = entorno([P({ id: 'ref', nombre: 'Referente Inventada', prioridad: '3', fecha_alta: '2026-11-20' }), P({ id: 'otra', fecha_alta: '2026-11-21' })]);
  assert.equal(pedir(d, KEI, { accion: 'espera_alta', nombre: 'Ana Test', celular: '123' }).error, 'celular_invalido');
  const r = pedir(d, KEI, { accion: 'espera_alta', nombre: 'Ana Test', celular: '2944 55-5001', horario: '8 a 10', prioridad: 3, consentimiento: true, referido_por: 'ref' }).data;
  assert.equal(r.persona.estado, 'esperando');
  assert.equal(r.persona.franjas[0], 'manana');
  assert.equal(r.persona.dueno_dni, KEI.dni);   // mañana → Keila
  assert.match(r.mensaje.texto, /Te acabo de anotar/);
  assert.ok(r.mensaje.wa.startsWith('https://wa.me/5492944555001?text='));
  assert.ok(pedir(d, KEI, { accion: 'espera_alta', nombre: 'Ana Test', celular: '2944555001' }).data.duplicado);
  assert.equal(d.repo.hojas.espera.length, 3);
  assert.equal(JSON.parse(d.repo.hojas.espera.find(p => p.id === 'ref').pases).length, 0);
  pedir(d, KEI, { accion: 'espera_alta', nombre: 'Beto Test', celular: '2944555002', horario: '8 a 10', referido_por: 'ref' });
  const pases = JSON.parse(d.repo.hojas.espera.find(p => p.id === 'ref').pases);
  assert.equal(pases.length, 1);
  assert.equal(pases[0].lugares, 5);
  assert.ok(d.repo.hojas.espera_hist.some(h => h.tipo === 'pase' && /referidos/.test(h.detalle)));
});

test('tareas de hoy: cada una va a su dueño según la franja, con mensaje y WhatsApp', () => {
  const m = P({ id: 'm', franjas: 'manana', fecha_alta: '2026-11-20', estado: 'nuevo', consentimiento_fecha: '' });
  const t = P({ id: 't', franjas: 'tarde', fecha_alta: '2026-11-20', estado: 'nuevo' });
  const d = entorno([m, t]);
  const k = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.deepEqual(k.tareas.map(x => x.persona_id), ['m']);
  assert.equal(k.tareas[0].tipo, 'primer_contacto');
  assert.equal(k.tareas[0].sin_consentimiento, true);
  assert.ok(k.tareas[0].mensaje.wa.includes('wa.me/' + m.celular));
  assert.match(k.tareas[0].mensaje.texto, /Keila/);
  const r = pedir(d, RUB, { accion: 'espera_hoy' }).data;
  assert.deepEqual(r.tareas.map(x => x.persona_id), ['t']);
  // coordinación puede cambiar el dueño
  assert.equal(pedir(d, KEI, { accion: 'espera_actualizar', id: 't', campos: { contacto_dni: KEI.dni } }).error, 'prohibido');
  pedir(d, EMA, { accion: 'espera_actualizar', id: 't', campos: { contacto_dni: KEI.dni } });
  assert.equal(pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas.length, 2);
});

test('tope por turno, una acción por persona y un mensaje por semana; la baja pedida no recibe nada', () => {
  const gente = [];
  for (let i = 0; i < 12; i++) gente.push(P({ id: 'g' + i, estado: 'nuevo', fecha_alta: '2026-11-' + String(10 + i).padStart(2, '0') }));
  gente.push(P({ id: 'baja', estado: 'nuevo', baja_pedida: '2026-11-01', fecha_alta: '2026-11-05' }));
  gente.push(P({ id: 'reciente', estado: 'contactado', ultimo_mensaje_ts: '2026-11-22T12:00:00Z', ultimo_contacto: '2026-11-22', intentos: '1', fecha_alta: '2026-11-05' }));
  const d = entorno(gente);
  const h = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.equal(h.tareas.length, 8);
  assert.equal(h.pendientes_total, 12);
  assert.ok(!h.tareas.some(t => t.persona_id === 'baja' || t.persona_id === 'reciente'));
  for (let i = 0; i < 3; i++) pedir(d, KEI, { accion: 'espera_resultado', id: h.tareas[i].persona_id, resultado: 'sin_respuesta', mensaje_clave: 'primer_contacto_p3' });
  const h2 = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.equal(h2.hechas_yo, 3);
  assert.equal(h2.tareas.length, 5);
  assert.ok(!h2.tareas.some(t => h.tareas.slice(0, 3).some(x => x.persona_id === t.persona_id)));
  // a la misma persona no se le escribe dos veces en la semana
  assert.equal(pedir(d, KEI, { accion: 'espera_resultado', id: h.tareas[0].persona_id, resultado: 'sin_respuesta', mensaje_clave: 'sigues_en_lista' }).error, 'espera_semana');
});

test('tope por sede: 15 por día entre todas las recepcionistas', () => {
  const gente = [];
  for (let i = 0; i < 10; i++) gente.push(P({ id: 'm' + i, estado: 'nuevo', franjas: 'manana', fecha_alta: '2026-11-15' }));
  for (let i = 0; i < 10; i++) gente.push(P({ id: 't' + i, estado: 'nuevo', franjas: 'tarde', fecha_alta: '2026-11-15' }));
  const d = entorno(gente);
  for (let i = 0; i < 8; i++) pedir(d, KEI, { accion: 'espera_resultado', id: 'm' + i, resultado: 'sin_respuesta', mensaje_clave: 'primer_contacto_p3' });
  assert.equal(pedir(d, KEI, { accion: 'espera_hoy' }).data.restantes, 0);
  for (let i = 0; i < 7; i++) pedir(d, RUB, { accion: 'espera_resultado', id: 't' + i, resultado: 'sin_respuesta', mensaje_clave: 'primer_contacto_p3' });
  const r = pedir(d, RUB, { accion: 'espera_hoy' }).data;
  assert.equal(r.restantes, 0);   // 8 + 7 = 15 de la sede, aunque a Rubén le quedaría 1 de su turno
  assert.equal(r.tareas.length, 0);
});

test('resultados: sí reconfirma y guarda el consentimiento; baja = nunca más; 3 intentos y más de 90 días = pausa', () => {
  const d = entorno([P({ id: 'x', estado: 'contactado', consentimiento_fecha: '' }), P({ id: 'y', estado: 'esperando' }),
    P({ id: 'z', estado: 'contactado', fecha_alta: '2026-06-01', intentos: '2', ultimo_contacto: '2026-11-01' })]);
  pedir(d, KEI, { accion: 'espera_resultado', id: 'x', resultado: 'respondio_si', mensaje_clave: 'reconfirmacion' });
  const x = d.repo.hojas.espera.find(p => p.id === 'x');
  assert.equal(x.estado, 'reconfirmo'); assert.equal(x.consentimiento_fecha, HOY); assert.equal(x.ultima_respuesta, HOY);
  pedir(d, KEI, { accion: 'espera_resultado', id: 'y', resultado: 'pidio_baja', mensaje_clave: 'sigues_en_lista' });
  const y = d.repo.hojas.espera.find(p => p.id === 'y');
  assert.equal(y.baja_pedida, HOY); assert.equal(y.estado, 'descartado');
  assert.equal(pedir(d, EMA, { accion: 'espera_actualizar', id: 'y', campos: { estado: 'esperando' } }).error, 'espera_baja_pedida');
  pedir(d, KEI, { accion: 'espera_resultado', id: 'z', resultado: 'sin_respuesta', mensaje_clave: 'sigues_en_lista' });
  assert.equal(d.repo.hojas.espera.find(p => p.id === 'z').estado, 'pausa');
  // reversible: se vuelve a esperando a mano y recupera el contador
  pedir(d, KEI, { accion: 'espera_actualizar', id: 'z', campos: { estado: 'esperando' } });
  const z = d.repo.hojas.espera.find(p => p.id === 'z');
  assert.equal(z.estado, 'esperando'); assert.equal(z.intentos, '0');
});

test('reconfirmación en las semanas 4 y 12 y cierre amable en la 13', () => {
  const d = entorno([P({ id: 'r', estado: 'esperando', fecha_alta: '2026-10-20' })]);   // 5 semanas
  let t = pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas;
  assert.equal(t[0].tipo, 'reconfirmacion'); assert.equal(t[0].mensaje.clave, 'reconfirmacion');
  pedir(d, KEI, { accion: 'espera_resultado', id: 'r', resultado: 'sin_respuesta', mensaje_clave: 'reconfirmacion' });
  d.fecha('2026-12-10');
  assert.equal(pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas.length, 0);   // semana 7: todavía no
  d.fecha('2027-01-20');   // pasaron más de 12 semanas con 1 sola reconfirmación: la segunda
  t = pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas;
  assert.equal(t[0].mensaje.clave, 'sigues_en_lista');
  pedir(d, KEI, { accion: 'espera_resultado', id: 'r', resultado: 'sin_respuesta', mensaje_clave: 'sigues_en_lista' });
  d.fecha('2027-02-01');
  t = pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas;
  assert.equal(t[0].tipo, 'cierre');
  pedir(d, KEI, { accion: 'espera_resultado', id: 'r', resultado: 'sin_respuesta', mensaje_clave: 'cierre_amable' });
  assert.equal(d.repo.hojas.espera.find(p => p.id === 'r').estado, 'cerrado_amable');
});

test('aviso de avance: solo si el lugar mejoró respecto de lo que se le dijo, y no más de 1 por semana', () => {
  const a = P({ id: 'a', fecha_alta: '2026-10-01' });
  const b = P({ id: 'b', fecha_alta: '2026-10-10', lugar_ref: '2' });
  const d = entorno([a, b]);
  assert.equal(pedir(d, KEI, { accion: 'espera_mensaje', id: 'b', clave: 'posicion' }).data.mensaje.texto.match(/lugar (\d)/)[1], '2');
  assert.ok(!pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas.some(t => t.tipo === 'avance'));   // sigue en el 2: nada
  d.repo.hojas.espera.find(p => p.id === 'a').estado = 'ingreso';   // se fue el primero
  const t = pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas.find(x => x.tipo === 'avance');
  assert.ok(t); assert.match(t.mensaje.texto, /N° 1/); assert.match(t.mensaje.texto, /antes 2/);
  pedir(d, KEI, { accion: 'espera_resultado', id: 'b', resultado: 'sin_respuesta', mensaje_clave: 'avance' });
  assert.equal(d.repo.hojas.espera.find(p => p.id === 'b').lugar_ref, '1');
  assert.equal(pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas.length, 0);
});

test('baja de un socio: hasta 3 candidatos de la franja, ofrecer abre ventana de 24 h y si vence pasa al siguiente', () => {
  const gente = [P({ id: 'c1', prioridad: '2', fecha_alta: '2026-10-20' }), P({ id: 'c2', prioridad: '1', fecha_alta: '2026-11-10' }), P({ id: 'c3', fecha_alta: '2026-10-01' }),
    P({ id: 'c4', fecha_alta: '2026-10-02' }), P({ id: 'tarde', franjas: 'tarde' }), P({ id: 'otra_sede', sede: 'bolson' })];
  const d = entorno(gente);
  const r = pedir(d, KEI, { accion: 'espera_candidatos', franja: 'manana' }).data;
  assert.match(r.aviso, /Cupo sin verificar/);
  assert.deepEqual(r.grupos[0].candidatos.map(c => c.persona_id), ['c2', 'c1', 'c3']);
  assert.match(r.grupos[0].candidatos[0].motivo, /Prioridad 1/);
  const of = pedir(d, KEI, { accion: 'espera_ofrecer', id: 'c2', franja: 'manana' }).data;
  assert.match(of.mensaje.texto, /se liberó un lugar/);
  assert.equal(pedir(d, KEI, { accion: 'espera_ofrecer', id: 'c2', franja: 'manana' }).error, 'espera_oferta_activa');
  assert.deepEqual(pedir(d, KEI, { accion: 'espera_candidatos', franja: 'manana' }).data.grupos[0].candidatos.map(c => c.persona_id), ['c1', 'c3', 'c4']);
  d.fecha('2026-11-26');   // pasó la ventana
  const h = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  const v = h.tareas.find(t => t.tipo === 'oferta_vencida');
  assert.ok(v); assert.equal(v.persona_id, 'c2');
  assert.equal(v.candidatos[0].persona_id, 'c1');
  assert.match(v.mensaje.texto, /ofrecimos a la siguiente/);
  assert.equal(d.repo.hojas.espera.find(p => p.id === 'c2').ofertas_perdidas, '1');
  pedir(d, KEI, { accion: 'espera_oferta_resolver', id: 'c1', resultado: 'ingreso' });
  assert.equal(d.repo.hojas.espera.find(p => p.id === 'c1').estado, 'ingreso');
});

test('beneficios: se sugiere a quien lleva más de 30 días y respondió; hay tope por mes y por sede; se registra quién', () => {
  const quiere = P({ id: 'q', fecha_alta: '2026-10-15', respondio_alguna_vez: 'true', ultima_respuesta: '2026-11-10', recon_n: '0', estado: 'reconfirmo' });
  const nuevo = P({ id: 'n', fecha_alta: '2026-11-10', respondio_alguna_vez: 'true', ultima_respuesta: '2026-11-10', estado: 'reconfirmo' });
  const mudo = P({ id: 'm', fecha_alta: '2026-10-15', ultima_respuesta: '2026-11-10', estado: 'reconfirmo' });
  const d = entorno([quiere, nuevo, mudo]);
  const t = pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas;
  assert.deepEqual(t.map(x => x.persona_id), ['q']);
  assert.equal(t[0].tipo, 'beneficio');
  assert.match(t[0].mensaje.texto, /botas de presoterapia/);
  const o = pedir(d, KEI, { accion: 'espera_beneficio', id: 'q', beneficio: 'presoterapia', estado: 'ofrecido' }).data;
  pedir(d, RUB, { accion: 'espera_beneficio', id: 'q', beneficio_id: o.beneficio_id, estado: 'canjeado' });
  const lista = pedir(d, KEI, { accion: 'espera_beneficios_de', id: 'q' }).data.beneficios;
  assert.equal(lista[0].estado, 'canjeado'); assert.equal(lista[0].quien, 'Rubén Prueba');
  pedir(d, EMA, { accion: 'espera_config_guardar', config: { tope_beneficios_mes: 1 } });
  assert.equal(pedir(d, KEI, { accion: 'espera_beneficio', id: 'n', beneficio: 'charla', estado: 'ofrecido' }).error, 'espera_tope_beneficio');
  assert.equal(pedir(d, KEI, { accion: 'espera_config_guardar', config: { tope_turno: 3 } }).error, 'prohibido');
});

test('carga de la PC: pide clave, valida, es idempotente y no pisa lo que cambió la app', () => {
  const d = entorno();
  const fila = { id: 'le-imp0000001', sede: 'bariloche', sede_interes: 'bariloche', fecha_alta: '2026-10-01', prioridad: '3', nombre: 'Carga Inventada', celular: '5492944100100', horario_texto: '8 a 10', franjas: 'manana', observaciones: '', estado: 'nuevo', derivacion: '', evaluacion: '', interesado: '', origen: 'planilla', contacto_dni: KEI.dni };
  assert.equal(L.manejar({ accion: 'cargar_espera', filas: [fila] }, d).error, 'clave');
  const cl = { accion: 'cargar_espera', clave: 'clave-prueba' };
  assert.equal(L.manejar({ ...cl, filas: [{ ...fila, celular: '123' }] }, d).error, 'datos_invalidos');
  assert.equal(L.manejar({ ...cl, filas: [{ ...fila, estado: 'rojo' }] }, d).error, 'datos_invalidos');
  assert.equal(L.manejar({ ...cl, filas: [fila] }, d).data.nuevos, 1);
  pedir(d, KEI, { accion: 'espera_resultado', id: fila.id, resultado: 'respondio_si', mensaje_clave: 'reconfirmacion' });
  const r = L.manejar({ ...cl, filas: [fila] }, d).data;
  assert.equal(r.nuevos, 0); assert.equal(r.ya_estaban, 1);
  assert.equal(d.repo.hojas.espera.length, 1);
  assert.equal(d.repo.hojas.espera[0].estado, 'reconfirmo');
});

test('catálogo de mensajes: 10 de ideas + 6 de otros rubros + beneficio (y el de presoterapia), avance y posición; sin presión ni promesas', () => {
  const claves = L.MENSAJES_ESPERA.map(m => m.clave);
  assert.equal(claves.length, 20);
  assert.equal(new Set(claves).size, 20);
  ['beneficio', 'beneficio_presoterapia', 'avance', 'posicion'].forEach(c => assert.ok(claves.includes(c)));
  L.MENSAJES_ESPERA.forEach(m => {
    assert.ok(!/última chance|ultima chance|no te lo pierdas|solo hoy|urgente|garantizado|seguro que entrás/i.test(m.texto), m.clave);
    assert.ok(!/\$\s?\d/.test(m.texto), 'sin precios inventados: ' + m.clave);
  });
  const d = entorno([P({ id: 'p1', nombre: 'LAURA inventada' })]);
  const m = pedir(d, KEI, { accion: 'espera_mensaje', id: 'p1', clave: 'sigues_en_lista' }).data.mensaje;
  assert.match(m.texto, /^Hola Laura,/);
  const m2 = pedir(d, KEI, { accion: 'espera_mensaje', id: 'p1', clave: 'recordatorio_eval' }).data.mensaje;
  assert.deepEqual(m2.faltan.sort(), ['dia_horario', 'hora', 'profe']);
  assert.equal(m2.wa, '');   // no hay WhatsApp hasta completar lo que falta
});

test('métricas: solo coordinación, por sede y estado', () => {
  const d = entorno([P({ id: 'a' }), P({ id: 'b', estado: 'ingreso', fecha_ingreso: '2026-11-20', fecha_alta: '2026-10-20' })]);
  pedir(d, KEI, { accion: 'espera_resultado', id: 'a', resultado: 'respondio_si', mensaje_clave: 'reconfirmacion' });
  assert.equal(pedir(d, KEI, { accion: 'espera_metricas' }).error, 'prohibido');
  const m = pedir(d, EMA, { accion: 'espera_metricas' }).data.sedes.find(s => s.sede === 'bariloche');
  assert.equal(m.total, 2); assert.equal(m.ingresos, 1); assert.equal(m.tasa_respuesta, 100); assert.equal(m.dias_hasta_ingreso_mediana, 31);
});

test('sede nueva configurable: una sede extra sirve sin tocar código', () => {
  const d = entorno();
  pedir(d, EMA, { accion: 'espera_config_guardar', config: { sedes_extra: [{ clave: 'nueva', nombre: 'Sede nueva' }] } });
  const r = pedir(d, EMA, { accion: 'espera_alta', sede: 'nueva', nombre: 'Alguien Inventado', celular: '2944777001', horario: '18 a 20', sede_interes: 'nueva' });
  assert.equal(r.data.persona.sede, 'nueva');
  assert.ok(pedir(d, EMA, { accion: 'espera_ver' }).data.sedes.some(s => s.clave === 'nueva'));
});

test('las columnas de la hoja espera son las de Hojas.js', () => {
  const fs = require('fs'), path = require('path');
  const hojas = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Hojas.js'), 'utf8');
  const m = /espera: \[([^\]]+)\]/.exec(hojas);
  const cols = m[1].replace(/\s+/g, ' ').split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean);
  const vm = require('vm');
  assert.deepEqual(cols, vm.runInContext('LE_COLUMNAS', L));
});

// ---------- Reparto parejo en el mes (Emanuel, 24/11/2026) ----------

test('reparto: 60 contactos no caen de golpe: tope = max(1, ceil(pendientes / días hábiles que quedan))', () => {
  const gente = [];
  for (let i = 0; i < 60; i++) gente.push(P({ id: 'g' + i, estado: 'nuevo', fecha_alta: '2026-11-20' }));
  const d = entorno(gente, { reparto: true });
  d.fecha('2026-11-02');   // lunes: quedan 21 días hábiles del mes
  const h = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.equal(h.reparto.dias_habiles, 21);
  assert.equal(h.reparto.tope_dia, 3);            // ceil(60 / 21)
  assert.equal(h.tareas.length, 3);
  assert.equal(h.pendientes_total, 60);
  // feriados: no cuentan como días hábiles
  pedir(d, EMA, { accion: 'espera_config_guardar', config: { feriados: ['2026-11-23', '2026-11-30'] } });
  assert.equal(pedir(d, KEI, { accion: 'espera_hoy' }).data.reparto.dias_habiles, 19);
});

test('reparto: nunca pasa de los topes duros y lo atrasado se redistribuye sin acumularse', () => {
  const gente = [];
  for (let i = 0; i < 60; i++) gente.push(P({ id: 'g' + i, estado: 'nuevo', fecha_alta: '2026-11-20' }));
  const d = entorno(gente, { reparto: true });
  d.fecha('2026-11-17');   // quedan 10 días hábiles (17 al 30)
  let h = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.equal(h.reparto.dias_habiles, 10);
  assert.equal(h.tareas.length, 6);               // ceil(60/10) = 6, menos de los 8 del turno
  // no hace nada ese día: al siguiente se recalcula con lo que queda (60 / 9 = 7), sin acumular lo del día perdido de golpe
  d.fecha('2026-11-18');
  h = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.equal(h.reparto.tope_dia, 7);
  assert.ok(h.tareas.length <= 7);
  // al final del mes se mira al menos 5 días hábiles hacia adelante: no se vuelca todo el último día
  d.fecha('2026-11-30');
  h = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.equal(h.reparto.dias_habiles, 5);
  assert.ok(h.tareas.length <= 8);
  // hechas hoy cuentan dentro del tope del día
  const antes = h.tareas.length;
  pedir(d, KEI, { accion: 'espera_resultado', id: h.tareas[0].persona_id, resultado: 'sin_respuesta', mensaje_clave: 'primer_contacto_p3' });
  const despues = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.equal(despues.tareas.length, antes - 1);
});

test('reparto: sábados, domingos y feriados no se asignan tareas de contacto', () => {
  const d = entorno([P({ id: 'a', estado: 'nuevo', fecha_alta: '2026-11-20' })], { reparto: true });
  d.fecha('2026-11-28');   // sábado
  const h = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.equal(h.reparto.habil, false);
  assert.equal(h.tareas.length, 0);
  assert.equal(h.pendientes_total, 1);   // sigue pendiente: pasa al próximo día hábil, sin castigo
  d.fecha('2026-11-30');
  assert.equal(pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas.length, 1);
});

// ---------- Check durante el día y verificación al otro día ----------

test('check: lo hecho se ve hecho de inmediato; al otro día se comprueba lo que se pueda y el resto queda «hecha, sin comprobar» sin castigo', () => {
  const d = entorno([P({ id: 'a', estado: 'nuevo', fecha_alta: '2026-11-20' }), P({ id: 'b', estado: 'nuevo', fecha_alta: '2026-11-21' }), P({ id: 'c', estado: 'nuevo', fecha_alta: '2026-11-22' })], { reparto: true });
  pedir(d, KEI, { accion: 'espera_resultado', id: 'a', resultado: 'respondio_si', mensaje_clave: 'primer_contacto_p3' });
  pedir(d, KEI, { accion: 'espera_resultado', id: 'b', resultado: 'sin_respuesta', mensaje_clave: 'primer_contacto_p3' });
  let h = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.deepEqual(h.hechas_hoy.map(x => [x.persona_id, x.verif]), [['a', 'pendiente'], ['b', 'pendiente']]);   // ✔ ya, verificación pendiente
  assert.equal(h.hechas_yo, 2);
  // "c" quedó sin hacer: pasa al día siguiente, sin penalización
  d.fecha('2026-11-25');
  h = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  const verifs = d.repo.hojas.espera_hist.filter(x => x.tipo === 'contacto').map(x => [x.persona_id, x.verif]);
  assert.deepEqual(verifs, [['a', 'comprobada'], ['b', 'sin_comprobar']]);
  assert.equal(h.sin_comprobar, 1);
  assert.ok(h.tareas.some(t => t.persona_id === 'c'));
  assert.equal(h.hechas_yo, 0);   // el contador del día arranca de cero: lo de ayer no se arrastra
});

test('check: si la evidencia contradice lo marcado, se reabre como tarea; si no, no se toca', () => {
  const d = entorno([P({ id: 'a', estado: 'evaluacion_agendada', fecha_alta: '2026-11-20' }), P({ id: 'b', estado: 'esperando', fecha_alta: '2026-11-21', ultimo_contacto: '2026-11-24' })], { reparto: true });
  pedir(d, KEI, { accion: 'espera_resultado', id: 'a', resultado: 'sin_respuesta', mensaje_clave: 'recordatorio_eval' });
  d.fecha('2026-11-25');
  pedir(d, KEI, { accion: 'espera_hoy' });
  const cl = { accion: 'cargar_espera_evidencia', clave: 'clave-prueba' };
  assert.equal(L.manejar({ accion: 'cargar_espera_evidencia', filas: [] }, d).error, 'clave');
  const r = L.manejar({ ...cl, filas: [{ persona_id: 'a', ok: false, detalle: 'MOVE no muestra la evaluación' }, { persona_id: 'zzz', ok: false }] }, d).data;
  assert.equal(r.reabiertas, 1);
  assert.equal(d.repo.hojas.espera.find(p => p.id === 'a').estado, 'reconfirmo');   // ya no figura como agendada
  d.fecha('2026-12-02');
  let t = pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas.find(x => x.persona_id === 'a');
  assert.equal(t.tipo, 'revisar'); assert.match(t.motivo, /MOVE no muestra/);
  // al registrar el contacto la reapertura se cierra
  pedir(d, KEI, { accion: 'espera_resultado', id: 'a', resultado: 'respondio_si', mensaje_clave: 'sigues_en_lista' });
  assert.ok(d.repo.hojas.espera_hist.some(h => h.tipo === 'verificacion' && h.verif === 'atendida'));
  // ok:true confirma lo que estaba sin comprobar
  const c = L.manejar({ ...cl, filas: [{ persona_id: 'a', ok: true }] }, d).data;
  assert.ok(c.confirmadas >= 0);
});

test('check: las métricas de coordinación muestran cuántas quedaron sin comprobar', () => {
  const d = entorno([P({ id: 'a', estado: 'nuevo', fecha_alta: '2026-11-20' })], { reparto: true });
  pedir(d, KEI, { accion: 'espera_resultado', id: 'a', resultado: 'sin_respuesta', mensaje_clave: 'primer_contacto_p3' });
  d.fecha('2026-11-25');
  pedir(d, KEI, { accion: 'espera_hoy' });
  assert.equal(pedir(d, EMA, { accion: 'espera_metricas' }).data.sedes.find(s => s.sede === 'bariloche').sin_comprobar, 1);
});

// ---------- Ajustes del 25/11/2026: datos obligatorios, beneficios, etiquetas y re-sincronizar desde la planilla ----------

test('alta: sin apellido, sin celular válido o sin franja no se guarda, con un código claro', () => {
  const d = entorno();
  const base = { accion: 'espera_alta', nombre: 'Ana Inventada', celular: '2944 55-6001', franjas: ['manana'] };
  assert.equal(pedir(d, KEI, { ...base, nombre: 'Ana' }).error, 'espera_nombre_incompleto');
  assert.equal(pedir(d, KEI, { ...base, nombre: '  ' }).error, 'espera_nombre_incompleto');
  assert.equal(pedir(d, KEI, { ...base, celular: '' }).error, 'celular_invalido');
  assert.equal(pedir(d, KEI, { ...base, franjas: [], horario: 'cuando pueda' }).error, 'espera_sin_franja');
  assert.equal((d.repo.hojas.espera || []).length, 0);
  // la franja puede venir marcada o salir del texto del horario
  assert.deepEqual(pedir(d, KEI, { ...base, franjas: [], horario: '16 a 20' }).data.persona.franjas, ['tarde']);
  const r = pedir(d, KEI, { ...base, celular: '2944556002', franjas: ['manana', 'tarde'] }).data.persona;
  assert.deepEqual(r.franjas, ['manana', 'tarde']);
  assert.deepEqual(r.faltan, []);
});

test('editar: tampoco deja borrar el apellido, el celular ni la franja; lo demás se edita igual aunque falten datos', () => {
  const d = entorno([P({ id: 'inc', nombre: 'Rodri', celular: '', creado_por: 'pc' })]);
  assert.equal(pedir(d, KEI, { accion: 'espera_actualizar', id: 'inc', campos: { nombre: 'Rodri' } }).error, 'espera_nombre_incompleto');
  assert.equal(pedir(d, KEI, { accion: 'espera_actualizar', id: 'inc', campos: { celular: '12' } }).error, 'celular_invalido');
  assert.equal(pedir(d, KEI, { accion: 'espera_actualizar', id: 'inc', campos: { franjas: '' } }).error, 'espera_sin_franja');
  assert.ok(pedir(d, KEI, { accion: 'espera_actualizar', id: 'inc', campos: { observaciones: 'Llamar a la tarde' } }).ok);
  const p = pedir(d, KEI, { accion: 'espera_actualizar', id: 'inc', campos: { nombre: 'Rodrigo Inventado', celular: '2944 55-6003' } }).data.persona;
  assert.deepEqual(p.faltan, []);
});

test('faltan datos: la carga vieja los acepta, se marcan y la tarea del día propone completarlos (sin contar en los topes)', () => {
  const d = entorno();
  const fila = { id: 'le-imp0000009', sede: 'bariloche', sede_interes: 'bariloche', fecha_alta: '2026-11-20', prioridad: '3', nombre: 'Rodri', celular: '', horario_texto: '', franjas: 'manana',
    observaciones: '', estado: 'nuevo', derivacion: '', evaluacion: '', interesado: '', origen: 'planilla', contacto_dni: KEI.dni };
  const coni = { ...fila, id: 'le-imp0000010', nombre: 'Coni', celular: '5492944100200' };
  assert.equal(L.manejar({ accion: 'cargar_espera', clave: 'clave-prueba', filas: [fila, coni] }, d).data.nuevos, 2);
  const V = pedir(d, KEI, { accion: 'espera_ver' }).data;
  assert.deepEqual(V.personas.find(p => p.id === fila.id).faltan, ['nombre', 'celular']);
  assert.deepEqual(V.personas.find(p => p.id === coni.id).faltan, ['nombre']);
  const H = pedir(d, KEI, { accion: 'espera_hoy' }).data;
  assert.deepEqual(H.completar.map(x => x.persona_id).sort(), [fila.id, coni.id].sort());
  assert.match(H.completar.find(x => x.persona_id === fila.id).motivo, /Sin celular no se le puede escribir/);
  // sin celular no hay contacto; con celular sí, y la tarjeta avisa qué falta
  assert.ok(!H.tareas.some(t => t.persona_id === fila.id));
  assert.deepEqual(H.tareas.find(t => t.persona_id === coni.id).faltan, ['nombre']);
  assert.equal(H.pendientes_total, 1);
});

test('beneficios: nutricionista y charla con el profe en el catálogo; presoterapia con su mensaje de agradecimiento y para quien más responde', () => {
  const claves = L.LE_CONFIG_DEFECTO.beneficios.map(b => b.clave);
  ['presoterapia', 'nutricionista', 'charla_profe'].forEach(c => assert.ok(claves.includes(c), c));
  L.LE_CONFIG_DEFECTO.beneficios.forEach(b => assert.ok(!/\$\s?\d|\d+\s?%/.test(b.titulo + b.detalle), 'sin precios: ' + b.clave));
  const uno = P({ id: 'uno', fecha_alta: '2026-10-01', respondio_alguna_vez: 'true', ultima_respuesta: '2026-11-10', estado: 'reconfirmo' });
  const tres = P({ id: 'tres', fecha_alta: '2026-10-10', respondio_alguna_vez: 'true', ultima_respuesta: '2026-11-10', estado: 'reconfirmo' });
  const d = entorno([uno, tres]);
  const h = r => ({ id: 'h' + Math.random(), persona_id: r, ts: '2026-11-01T12:00:00Z', dni: KEI.dni, nombre: '', tipo: 'contacto', mensaje_clave: 'reconfirmacion', resultado: 'respondio_si', detalle: '', verif: 'comprobada', verif_ts: '' });
  d.repo.hojas.espera_hist = [h('uno'), h('tres'), h('tres'), h('tres')];
  pedir(d, EMA, { accion: 'espera_config_guardar', config: { tope_turno: 1 } });
  const t = pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas;
  assert.equal(t.length, 1);
  assert.equal(t[0].persona_id, 'tres');   // más antigua es «uno», pero «tres» respondió más mensajes
  assert.equal(t[0].beneficio.clave, 'presoterapia');
  assert.equal(t[0].mensaje.clave, 'beneficio_presoterapia');
  assert.match(t[0].mensaje.texto, /^¡Hola Persona! Gracias por tu paciencia/);
  assert.match(t[0].mensaje.texto, /bonificada por nosotros/);
  assert.match(t[0].motivo, /por esperar con paciencia y por responder los mensajes/);
  // cuando se acaba el tope de presoterapia del mes, sigue con el próximo beneficio del catálogo con su mensaje genérico
  const cfg = JSON.parse(JSON.stringify(L.LE_CONFIG_DEFECTO.beneficios));
  cfg[0].tope_mes = 0;
  pedir(d, EMA, { accion: 'espera_config_guardar', config: { beneficios: cfg } });
  const t2 = pedir(d, KEI, { accion: 'espera_hoy' }).data.tareas[0];
  assert.equal(t2.beneficio.clave, 'outdoor'); assert.equal(t2.mensaje.clave, 'beneficio');
  // un mensaje propio que no existe no se puede guardar
  cfg[0].mensaje = 'no_existe';
  assert.equal(pedir(d, EMA, { accion: 'espera_config_guardar', config: { beneficios: cfg } }).error, 'datos_invalidos');
});

test('estados con las palabras de recepción: misma clave interna, etiqueta nueva y ayuda del cierre', () => {
  assert.equal(L.LE_ESTADOS.nuevo, 'Pendiente de mensaje');
  assert.equal(L.LE_ESTADOS.contactado, 'Aguardando respuesta');
  assert.equal(L.LE_ESTADOS.evaluacion_agendada, 'Evaluación agendada');
  assert.equal(L.LE_ESTADOS.descartado, 'Descartado');
  assert.equal(L.LE_ESTADOS.cerrado_amable, 'Cerrado: no respondió');
  ['pausa', 'reconfirmo', 'ingreso', 'esperando'].forEach(k => assert.ok(L.LE_ESTADOS[k], k));
  const V = pedir(entorno([P()]), KEI, { accion: 'espera_ver' }).data;
  assert.match(V.estados_ayuda.cerrado_amable, /mensaje de cierre después de varios intentos sin respuesta; si vuelve a escribir, se reactiva/);
});

// Re-sincronizar estados desde la planilla (cargar_espera con modo actualizar_estados)
function filaPlanilla(o = {}) {
  return { id: 'le-sync000001', sede: 'bariloche', sede_interes: 'bariloche', fecha_alta: '2026-10-01', prioridad: '3', nombre: 'Sync Inventada', celular: '5492944100300', horario_texto: '8 a 10',
    franjas: 'manana', observaciones: '', estado: 'nuevo', derivacion: '', evaluacion: '', interesado: '', origen: 'planilla', contacto_dni: KEI.dni, ...o };
}

test('re-sincronizar: actualiza el estado por el color si nadie la tocó en la app; es idempotente y solo devuelve conteos', () => {
  const d = entorno();
  const cl = { accion: 'cargar_espera', clave: 'clave-prueba' };
  const a = filaPlanilla(), b = filaPlanilla({ id: 'le-sync000002', celular: '5492944100301', nombre: 'Otra Inventada' }), c = filaPlanilla({ id: 'le-sync000003', celular: '5492944100302', nombre: 'Tercera Inventada' });
  L.manejar({ ...cl, filas: [a, b, c] }, d);
  d.t += 3600000;
  const sync = (filas, extra) => L.manejar({ ...cl, modo: 'actualizar_estados', filas, ...extra }, d);
  assert.equal(L.manejar({ accion: 'cargar_espera', modo: 'actualizar_estados', filas: [a] }, d).error, 'clave');
  const nuevas = [{ ...a, estado: 'contactado', derivacion: 'Kei' }, { ...b, estado: 'evaluacion_agendada', evaluacion: 'SI' }, { ...c, estado: 'nuevo' }, filaPlanilla({ id: 'le-sync000099', celular: '5492944100399' })];
  const sim = sync(nuevas, { simular: true }).data;
  assert.equal(sim.simulado, true); assert.equal(sim.actualizadas, 2);
  assert.equal(d.repo.hojas.espera.find(p => p.id === a.id).estado, 'nuevo', 'simular no escribe');
  const r = sync(nuevas).data;
  assert.deepEqual(r.cambios, { 'nuevo→contactado': 1, 'nuevo→evaluacion_agendada': 1 });
  assert.deepEqual(r.campos, { derivacion: 1, evaluacion: 1 });
  assert.equal(r.actualizadas, 2); assert.equal(r.sin_cambios, 1); assert.equal(r.no_estan, 1); assert.equal(r.tocadas_en_app, 0);
  assert.ok(!/Inventada|549294/.test(JSON.stringify(r)), 'sin nombres ni celulares');
  assert.equal(d.repo.hojas.espera.find(p => p.id === a.id).estado, 'contactado');
  assert.equal(d.repo.hojas.espera.length, 3, 'no da de alta a la que no estaba');
  assert.ok(d.repo.hojas.espera_hist.some(h => h.persona_id === a.id && h.tipo === 'sincro_planilla'));
  // otra vez lo mismo: nada cambia, y lo sincronizado no cuenta como «tocado en la app»
  d.t += 3600000;
  const r2 = sync(nuevas).data;
  assert.equal(r2.actualizadas, 0); assert.equal(r2.sin_cambios, 3); assert.equal(r2.tocadas_en_app, 0);
  // y si la recepcionista vuelve a pintar, se vuelve a actualizar
  assert.deepEqual(sync([{ ...a, estado: 'descartado' }]).data.cambios, { 'contactado→descartado': 1 });
  // estados que la planilla no tiene no se aceptan
  assert.equal(sync([{ ...a, estado: 'reconfirmo' }]).error, 'datos_invalidos');
});

test('re-sincronizar: si la tocaron en la app (historial o estado posterior a la carga), no se pisa', () => {
  const d = entorno();
  const cl = { accion: 'cargar_espera', clave: 'clave-prueba' };
  const a = filaPlanilla(), b = filaPlanilla({ id: 'le-sync000002', celular: '5492944100301' }), c = filaPlanilla({ id: 'le-sync000003', celular: '5492944100302' });
  L.manejar({ ...cl, filas: [a, b, c] }, d);
  d.t += 3600000;
  pedir(d, KEI, { accion: 'espera_resultado', id: a.id, resultado: 'respondio_si', mensaje_clave: 'reconfirmacion' });   // historial de contacto
  d.repo.hojas.espera.find(p => p.id === b.id).estado_ts = new Date(d.t).toISOString();                             // estado cambiado después de la carga
  pedir(d, KEI, { accion: 'espera_actualizar', id: c.id, campos: { observaciones: 'Prefiere audio' } });               // una edición
  const r = L.manejar({ ...cl, modo: 'actualizar_estados', filas: [a, b, c].map(x => ({ ...x, estado: 'descartado' })) }, d).data;
  assert.equal(r.tocadas_en_app, 3); assert.equal(r.actualizadas, 0); assert.deepEqual(r.cambios, {});
  assert.equal(d.repo.hojas.espera.find(p => p.id === a.id).estado, 'reconfirmo');
  // las altas hechas en la app nunca se tocan desde la planilla
  const app = pedir(d, KEI, { accion: 'espera_alta', nombre: 'Alta Inventada', celular: '2944556010', franjas: ['manana'] }).data.persona;
  const r2 = L.manejar({ ...cl, modo: 'actualizar_estados', filas: [{ ...a, id: app.id, celular: '5492944556010', estado: 'descartado' }] }, d).data;
  assert.equal(r2.tocadas_en_app, 1);
  // y un modo desconocido falla
  assert.equal(L.manejar({ ...cl, modo: 'otra_cosa', filas: [] }, d).error, 'datos_invalidos');
});

test('pantalla: el celular y los datos obligatorios se chequean igual que en el servidor', () => {
  require('../web/espera.js');
  const W = globalThis.PulsoEspera;
  ['2944 12-3456', '+54 9 2944 123456', '0294415123456', '15123456', '123456', '', '2,944E+9', '12345', '1112345678'].forEach(c => assert.equal(W.celularValido(c), !!L.leNormalizarCelular(c), c));
  assert.deepEqual(W.faltanParaGuardar({ nombre: 'Ana', celular: '1', franjas: '' }), ['nombre', 'celular', 'franja']);
  assert.deepEqual(W.faltanParaGuardar({ nombre: 'Ana Inventada', celular: '2944123456', franjas: 'tarde' }), []);
  assert.deepEqual(W.faltanParaGuardar({ observaciones: 'x' }), []);   // en la edición se chequea solo lo que se cambia
  assert.equal(W.ESTADO_CLASE.descartado, 'rojo'); assert.equal(W.ESTADO_CLASE.contactado, 'amarillo'); assert.equal(W.ESTADO_CLASE.evaluacion_agendada, 'verde');
});

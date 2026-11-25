// Pendientes con socios (Pendientes.js, 25/11/2026). Socios, profes y pedidos inventados.
const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const HOY = '2026-11-25';   // miércoles
const SOL = usuario({ dni: '20100001', nombre: 'Sol Prueba', roles: 'profe', sede: 'bolson' });
const LEO = usuario({ dni: '20100002', nombre: 'Leo Prueba', roles: 'profe', sede: 'bolson' });
const ANA = usuario({ dni: '20100003', nombre: 'Ana Prueba', roles: 'profe', sede: 'bariloche' });
const REC = usuario({ dni: '30100001', nombre: 'Rocío Prueba', roles: 'recepcion', sede: 'bolson' });
const COO = usuario({ dni: '30100002', nombre: 'Lucía Prueba', roles: 'recepcion,coordinador', sede: 'bolson' });
const ADM = usuario({ dni: '30100003', nombre: 'Emanuel Prueba', roles: 'admin', sede: 'bolson' });

const reeval = (id, profe, dni, sede) => ({ id: 're-' + id, sede: sede || 'bolson', profe, profe_dni: dni, socio_id: String(id), socio_nombre: 'Socio ' + id, ultima_eval: '', dias: '', habitos: '' });
const filaPl = (id, dni, nombre, sede) => ({ socio_id: String(id), sede: sede || 'bolson', profe_dni: dni, profe_nombre: nombre, nombre: 'Socio ' + id, condicion_auto: 'ACTIVO', vence: '2026-12-20',
  plan_meses: '1', plan_tipo: 'paga', plan_fecha: '2026-11-01', plan_proximo: '2026-12-01', plan_rutinas: '3', plan_pct: '45', plan_estado: 'ok', ultima_eval: '', perfil: 'Si',
  ultima_visita: '', contacto_fecha: '', contacto_quien: '', contacto_canal: '', contacto_resultado: '', contacto_nota: '', contactos_n: '0', meses: {}, mov_mes: 'por_vencer',
  observaciones: '', profe_move: '', origen: 'planilla' });

function entorno() {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [SOL, LEO, ANA, REC, COO, ADM], tareas: [], profe_tareas: [],
    profe_reeval: [reeval(1, 'Sol Prueba', SOL.dni), reeval(2, 'Leo Prueba', LEO.dni), reeval(3, 'Ana Prueba', ANA.dni, 'bariloche'), reeval(4, 'Profe Sin Usuario', '20999999')] }),
  hoy: HOY, ahora: Date.parse(HOY + 'T15:00:00Z') });
  const r = L.manejar({ accion: 'cargar_profe_planilla', clave: PROPS.CLAVE_CARGA, hoy: HOY,
    filas: [filaPl(1, SOL.dni, 'Sol Prueba'), filaPl(2, LEO.dni, 'Leo Prueba'), filaPl(3, ANA.dni, 'Ana Prueba', 'bariloche'), filaPl(4, '20999999', 'Profe Sin Usuario')] }, d);
  assert.ok(r.ok, JSON.stringify(r));
  d.fecha = f => { d.dia = f; d.t = Date.parse(f + 'T15:00:00Z'); };
  return d;
}
const token = (d, u) => L.manejar({ accion: 'login', dni: u.dni, pin: '4831' }, d).data.token;
const pedir = (d, u, req) => L.manejar({ ...req, token: token(d, u) }, d);
const mios = (d, u) => pedir(d, u, { accion: 'profe_tareas' }).data.mio.pendientes_socio;

test('el profe anota el pedido de su socio: aparece todos los días hasta que lo marca hecho, y suma como hecho', () => {
  const d = entorno();
  const r = pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '1', que: 'Cambiar la fecha de la evaluación', limite: '2026-11-27' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.pendiente.profe_dni, SOL.dni);
  assert.equal(r.data.de_otro_profe, false);
  d.fecha('2026-11-26');
  let m = mios(d, SOL);
  assert.equal(m.abiertos.length, 1);
  assert.equal(m.abiertos[0].que, 'Cambiar la fecha de la evaluación');
  d.fecha('2026-11-30');
  m = mios(d, SOL);
  assert.equal(m.abiertos.length, 1, 'sigue apareciendo');
  assert.equal(m.abiertos[0].vence_hoy, true);
  // no se mezcla con los planes: no cambia lo pendiente del día ni el modo concentrado
  const P = pedir(d, SOL, { accion: 'profe_tareas' }).data.mio;
  assert.equal(P.resumen.pendientes_hoy, 0);
  assert.equal(P.resumen.pedidos_socio_hechos_mes, 0);
  const h = pedir(d, SOL, { accion: 'socio_pendiente_resolver', id: r.data.pendiente.id, resultado: 'hecho' });
  assert.ok(h.ok);
  assert.equal(h.data.mios.abiertos.length, 0);
  assert.equal(h.data.mios.resueltos_hoy.length, 1);
  assert.equal(pedir(d, SOL, { accion: 'profe_tareas' }).data.mio.resumen.pedidos_socio_hechos_mes, 1);
  // deshacer el mismo día lo vuelve a la lista
  assert.ok(pedir(d, SOL, { accion: 'socio_pendiente_resolver', id: r.data.pendiente.id, resultado: 'pendiente' }).ok);
  assert.equal(mios(d, SOL).abiertos.length, 1);
});

test('«No corresponde» pide motivo; solo lo resuelve el profe que lo tiene (o admin)', () => {
  const d = entorno();
  const id = pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '1', que: 'Marcarle la planificación' }).data.pendiente.id;
  assert.equal(pedir(d, SOL, { accion: 'socio_pendiente_resolver', id, resultado: 'no_corresponde', motivo: '' }).error, 'pendiente_sin_motivo');
  assert.equal(pedir(d, LEO, { accion: 'socio_pendiente_resolver', id, resultado: 'hecho' }).error, 'prohibido');
  assert.equal(pedir(d, REC, { accion: 'socio_pendiente_resolver', id, resultado: 'hecho' }).error, 'prohibido');
  const r = pedir(d, SOL, { accion: 'socio_pendiente_resolver', id, resultado: 'no_corresponde', motivo: 'Ya se lo resolvió recepción' }).data;
  assert.equal(r.pendiente.estado, 'no_corresponde');
  assert.equal(pedir(d, SOL, { accion: 'socio_pendiente_resolver', id, resultado: 'hecho' }).error, 'ya_anotado');
  assert.equal(pedir(d, SOL, { accion: 'profe_tareas' }).data.mio.resumen.pedidos_socio_hechos_mes, 0, '«no corresponde» no cuenta como hecho');
  const id2 = pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '1', que: 'Otro pedido' }).data.pendiente.id;
  assert.ok(pedir(d, ADM, { accion: 'socio_pendiente_resolver', id: id2, resultado: 'hecho' }).ok);
});

test('socio de otro profe: se le deriva al dueño (le llega a él) o lo hace uno mismo, y si es un plan se recuerda Plan extra', () => {
  const d = entorno();
  const lista = pedir(d, SOL, { accion: 'socio_pendiente_socios' }).data;
  assert.ok(lista.socios.some(s => s.socio_id === '2' && s.profe === 'Leo Prueba'));
  assert.ok(!lista.socios.some(s => s.socio_id === '3'), 'otra sede no');
  const der = pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '2', que: 'Cambiar la evaluación', para: 'dueno' }).data;
  assert.equal(der.pendiente.profe_dni, LEO.dni);
  assert.equal(der.pendiente.derivado_de_nombre, 'Sol Prueba');
  assert.equal(mios(d, SOL).abiertos.length, 0);
  assert.equal(mios(d, LEO).abiertos.length, 1);
  const yo = pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '2', que: 'Armarle el plan nuevo', para: 'yo' }).data;
  assert.equal(yo.pendiente.profe_dni, SOL.dni);
  assert.equal(yo.recordar_plan_extra, true);
  assert.equal(yo.de_otro_profe, true);
  // después también se puede pasar al dueño
  const p = pedir(d, SOL, { accion: 'socio_pendiente_derivar', id: yo.pendiente.id });
  assert.ok(p.ok, JSON.stringify(p));
  assert.equal(p.data.para_nombre, 'Leo Prueba');
  assert.equal(mios(d, LEO).abiertos.length, 2);
  // un socio propio no se puede «derivar»
  const propio = pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '1', que: 'Algo propio' }).data.pendiente.id;
  assert.equal(pedir(d, SOL, { accion: 'socio_pendiente_derivar', id: propio }).error, 'pendiente_sin_profe');
});

test('recepción lo anota para el profe del socio (o para el que elija); sin profe con usuario, avisa', () => {
  const d = entorno();
  const S = pedir(d, REC, { accion: 'socio_pendiente_socios' }).data;
  assert.deepEqual(S.socios.map(s => s.socio_id).sort(), ['1', '2', '4']);   // solo su sede
  assert.equal(S.soy_profe, false);
  const r = pedir(d, REC, { accion: 'socio_pendiente_anotar', socio_id: '2', que: 'Quiere cambiar el horario de la evaluación' }).data;
  assert.equal(r.pendiente.profe_dni, LEO.dni);
  assert.equal(r.pendiente.creado_rol, 'recepcion');
  assert.equal(mios(d, LEO).abiertos[0].creado_nombre, 'Rocío Prueba');
  assert.equal(pedir(d, REC, { accion: 'socio_pendiente_anotar', socio_id: '4', que: 'Algo' }).error, 'pendiente_sin_profe');
  assert.equal(pedir(d, REC, { accion: 'socio_pendiente_anotar', socio_id: '4', que: 'Algo', profe_dni: SOL.dni }).data.pendiente.profe_dni, SOL.dni);
  assert.equal(pedir(d, REC, { accion: 'socio_pendiente_anotar', socio_id: '4', que: 'Algo', profe_dni: REC.dni }).error, 'datos_invalidos');
  assert.equal(pedir(d, REC, { accion: 'socio_pendiente_anotar', socio_id: '3', que: 'De otra sede' }).error, 'no_existe');
  assert.equal(pedir(d, REC, { accion: 'socio_pendiente_socios' }).data.anotados.length, 2);
});

test('validaciones: qué pidió, fecha límite y roles', () => {
  const d = entorno();
  assert.equal(pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '1', que: 'a' }).error, 'datos_invalidos');
  assert.equal(pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '1', que: 'x'.repeat(201) }).error, 'datos_invalidos');
  assert.equal(pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '1', que: 'Algo', limite: '2026-11-20' }).error, 'datos_invalidos');
  assert.equal(pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '1', que: 'Algo', limite: 'mañana' }).error, 'datos_invalidos');
  assert.equal(pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '999', que: 'Algo' }).error, 'no_existe');
  assert.equal(L.manejar({ accion: 'socio_pendiente_anotar', socio_id: '1', que: 'Algo' }, d).error, 'sin_sesion');
  assert.equal(pedir(d, LEO, { accion: 'socio_pendiente_derivar', id: 'ps-x' }).error, 'no_existe');
  assert.equal(pedir(d, REC, { accion: 'socio_pendiente_derivar', id: 'ps-x' }).error, 'prohibido');
});

test('más de 3 días hábiles sin resolver: coordinación lo ve (su sede; admin todas) y el profe ve que ya lo ven', () => {
  const d = entorno();
  pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '1', que: 'Cambiar la fecha de la evaluación' });   // miércoles 25
  pedir(d, ANA, { accion: 'socio_pendiente_anotar', socio_id: '3', que: 'Marcarle la planificación' });
  d.fecha('2026-11-30');   // lunes: 3 días hábiles (mié, jue, vie)
  assert.equal(pedir(d, COO, { accion: 'profe_tareas' }).data.pendientes_socio_atrasados.length, 0);
  d.fecha('2026-12-01');   // martes: 4 días hábiles
  const C = pedir(d, COO, { accion: 'profe_tareas' }).data.pendientes_socio_atrasados;
  assert.equal(C.length, 1);
  assert.equal(C[0].profe_nombre, 'Sol Prueba'); assert.equal(C[0].dias_habiles, 4);
  assert.equal(pedir(d, ADM, { accion: 'profe_tareas' }).data.pendientes_socio_atrasados.length, 2);
  assert.equal(mios(d, SOL).abiertos[0].atrasado, true);
  // el profe no ve el bloque de coordinación
  assert.equal(pedir(d, SOL, { accion: 'profe_tareas' }).data.pendientes_socio_atrasados, undefined);
});

test('la hoja socio_pendientes está en Hojas.js con las columnas que usa el código, y Pendientes.js se sube con clasp', () => {
  const fs = require('fs'), path = require('path');
  const raiz = path.join(__dirname, '..');
  const hojas = fs.readFileSync(path.join(raiz, 'apps-script', 'Hojas.js'), 'utf8');
  const m = /socio_pendientes: \[([^\]]+)\]/.exec(hojas);
  assert.ok(m, 'falta la hoja');
  const cols = m[1].replace(/\s+/g, ' ').split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean);
  const d = entorno();
  pedir(d, SOL, { accion: 'socio_pendiente_anotar', socio_id: '1', que: 'Algo' });
  assert.deepEqual(Object.keys(d.repo.hojas.socio_pendientes[0]), cols);
  assert.match(fs.readFileSync(path.join(raiz, '.claspignore'), 'utf8'), /^!Pendientes\.js$/m);
  const clasp = path.join(raiz, '.clasp.json');
  if (fs.existsSync(clasp)) assert.ok(JSON.parse(fs.readFileSync(clasp, 'utf8')).filePushOrder.includes('apps-script/Pendientes.js'));
  assert.match(fs.readFileSync(path.join(raiz, 'index.html'), 'utf8'), /apps-script\/Pendientes\.js/);
});

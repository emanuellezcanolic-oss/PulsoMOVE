const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario } = require('./repo_falso');

const LUCIA = usuario({ dni: '20555666', nombre: 'Lucía', roles: 'coordinador', sede: 'bolson' });
const EMA = usuario({ dni: '20777888', nombre: 'Emanuel', roles: 'admin', sede: 'bolson' });
const ANA = usuario({ dni: '30111111', nombre: 'Ana', roles: 'recepcion', sede: 'bolson' });
const LUZ = usuario({ dni: '30222222', nombre: 'Luz', roles: 'recepcion', sede: 'bolson', turno: 'tarde' });
const PEPE = usuario({ dni: '30333333', nombre: 'Pepe', roles: 'recepcion', sede: 'puelo' });
const BELEN = usuario({ dni: '20111222', nombre: 'Belén', roles: 'profe', sede: 'bolson' });

function entorno(hoy = '2026-11-10') {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [LUCIA, EMA, ANA, LUZ, PEPE, BELEN] }), hoy, ahora: Date.parse(hoy + 'T15:00:00Z') });
  d.fecha = f => { d.dia = f; d.t = Date.parse(f + 'T15:00:00Z'); };
  return d;
}
// "token" en estas pruebas es el dni: se entra de nuevo en cada pedido, porque la sesión vence cuando la prueba cambia de día
const entrar = (d, dni) => dni;
const pedir = (d, req) => L.manejar(/^\d{8}$/.test(req.token || '') ? { ...req, token: L.manejar({ accion: 'login', dni: req.token, pin: '4831' }, d).data.token } : req, d);
const limpieza = { accion: 'pedido_guardar', titulo: 'Pedido de limpieza', detalle: 'Lavandina, papel…', para_roles: ['recepcion'], cierra: '2026-11-18', avisar_dias: 5 };

test('solo coordinación crea pedidos y valida lo que carga', () => {
  const d = entorno();
  assert.equal(pedir(d, { ...limpieza, token: entrar(d, ANA.dni) }).error, 'prohibido');
  const tc = entrar(d, LUCIA.dni);
  assert.equal(pedir(d, { ...limpieza, token: tc, para_roles: [] }).error, 'datos_invalidos');        // sin a quién
  assert.equal(pedir(d, { ...limpieza, token: tc, cierra: '2026-11-01' }).error, 'datos_invalidos');  // ya pasó
  assert.equal(pedir(d, { ...limpieza, token: tc, avisar_dias: 90 }).error, 'datos_invalidos');
  assert.equal(pedir(d, { ...limpieza, token: tc, repite: 'diario' }).error, 'datos_invalidos');
  const r = pedir(d, { ...limpieza, token: tc }).data;
  assert.equal(r.pedidos.length, 1);
  assert.equal(r.pedidos[0].de_nombre, 'Lucía');
  assert.equal(r.pedidos[0].estado, 'programado');      // faltan 8 días y avisa desde 5 antes
  assert.deepEqual(r.pedidos[0].asignados.map(a => a.nombre).sort(), ['Ana', 'Luz', 'Pepe']);
});

test('el aviso empieza los días antes que se eligieron y, pasada la fecha, queda atrasado', () => {
  const d = entorno();
  const tc = entrar(d, LUCIA.dni), ta = entrar(d, ANA.dni);
  pedir(d, { ...limpieza, token: tc });
  assert.equal(pedir(d, { accion: 'pedidos_mios', token: ta }).data.pedidos.length, 0);   // el 10: faltan 8
  d.fecha('2026-11-13');
  let P = pedir(d, { accion: 'pedidos_mios', token: ta }).data.pedidos;
  assert.equal(P.length, 1);
  assert.equal(P[0].faltan, 5);
  d.fecha('2026-11-18');
  assert.equal(pedir(d, { accion: 'pedidos_mios', token: ta }).data.pedidos[0].faltan, 0);   // el día del cierre todavía se carga
  d.fecha('2026-11-19');
  // sin hacer, sigue apareciendo pero atrasado
  const P2 = pedir(d, { accion: 'pedidos_mios', token: ta }).data.pedidos;
  assert.equal(P2.length, 1);
  assert.equal(P2[0].atrasado, true);
  assert.equal(pedir(d, { accion: 'pedidos_ver', token: tc }).data.pedidos[0].estado, 'atrasado');
});

test('cada sede carga su lista día a día y coordinación la ve junta', () => {
  const d = entorno('2026-11-13');
  const tc = entrar(d, LUCIA.dni), ta = entrar(d, ANA.dni), tl = entrar(d, LUZ.dni), tp = entrar(d, PEPE.dni);
  const id = pedir(d, { ...limpieza, token: tc }).data.pedidos[0].id;
  assert.equal(pedir(d, { accion: 'pedido_item_agregar', token: ta, pedido_id: id, texto: 'Lavandina', cantidad: '2' }).data.pedidos[0].items.length, 1);
  d.fecha('2026-11-14');
  pedir(d, { accion: 'pedido_item_agregar', token: tl, pedido_id: id, texto: 'Papel higiénico', cantidad: '12' });
  pedir(d, { accion: 'pedido_item_agregar', token: tp, pedido_id: id, texto: 'Detergente' });
  // Ana y Luz comparten la lista de Bolsón; Pepe ve solo la de Puelo
  const deAna = pedir(d, { accion: 'pedidos_mios', token: ta }).data.pedidos[0].items;
  assert.deepEqual(deAna.map(i => i.texto), ['Lavandina', 'Papel higiénico']);
  assert.equal(deAna[0].mio, true);
  assert.equal(deAna[1].mio, false);
  assert.deepEqual(pedir(d, { accion: 'pedidos_mios', token: tp }).data.pedidos[0].items.map(i => i.texto), ['Detergente']);
  const V = pedir(d, { accion: 'pedidos_ver', token: tc }).data.pedidos[0];
  assert.deepEqual(V.por_sede.map(s => [s.sede, s.items.length]), [['bolson', 2], ['puelo', 1]]);
  // una compañera de la sede puede sacar un artículo; la de otra sede, no
  assert.equal(pedir(d, { accion: 'pedido_item_quitar', token: tp, item_id: deAna[0].id }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'pedido_item_quitar', token: tl, item_id: deAna[0].id }).data.pedidos[0].items.length, 1);
  // validaciones
  assert.equal(pedir(d, { accion: 'pedido_item_agregar', token: ta, pedido_id: id, texto: '  ' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'pedido_item_agregar', token: entrar(d, BELEN.dni), pedido_id: id, texto: 'Algo' }).error, 'prohibido');   // el pedido es de recepción
});

test('pasada la fecha se puede seguir sumando, y lo cargado queda a la vista de coordinación', () => {
  const d = entorno('2026-11-13');
  const tc = entrar(d, LUCIA.dni), ta = entrar(d, ANA.dni);
  const id = pedir(d, { ...limpieza, token: tc }).data.pedidos[0].id;
  pedir(d, { accion: 'pedido_item_agregar', token: ta, pedido_id: id, texto: 'Lavandina' });
  d.fecha('2026-11-19');
  assert.equal(pedir(d, { accion: 'pedido_item_agregar', token: ta, pedido_id: id, texto: 'Tarde' }).data.pedidos[0].items.length, 2);
  const V = pedir(d, { accion: 'pedidos_ver', token: tc }).data.pedidos[0];
  assert.equal(V.estado, 'atrasado');
  assert.equal(V.por_sede[0].items[0].texto, 'Lavandina');
});

test('un pedido mensual se renueva solo con la lista vacía y guarda la anterior', () => {
  const d = entorno('2026-11-13');
  const tc = entrar(d, LUCIA.dni), ta = entrar(d, ANA.dni);
  const id = pedir(d, { ...limpieza, token: tc, repite: 'mensual' }).data.pedidos[0].id;
  pedir(d, { accion: 'pedido_item_agregar', token: ta, pedido_id: id, texto: 'Lavandina' });
  d.fecha('2026-11-25');
  let V = pedir(d, { accion: 'pedidos_ver', token: tc }).data.pedidos[0];
  assert.equal(V.ciclo, '2026-12-18');
  assert.equal(V.estado, 'programado');
  assert.equal(V.anteriores[0].ciclo, '2026-11-18');
  d.fecha('2026-12-13');
  const P = pedir(d, { accion: 'pedidos_mios', token: ta }).data.pedidos[0];
  assert.equal(P.cierra, '2026-12-18');
  assert.equal(P.items.length, 0);
});

test('fechas repetidas: semanal, y fin de mes sin saltarse el mes', () => {
  assert.equal(L.pedCiclo({ cierra: '2026-11-04', repite: 'semanal' }, '2026-11-10'), '2026-11-11');
  assert.equal(L.pedCiclo({ cierra: '2026-01-31', repite: 'mensual' }, '2026-02-02'), '2026-02-28');
  assert.equal(L.pedCiclo({ cierra: '2026-01-31', repite: 'mensual' }, '2026-03-01'), '2026-03-31');
  assert.equal(L.pedCiclo({ cierra: '2026-11-04', repite: '' }, '2026-12-01'), '2026-11-04');
});

test('una tarea suelta se marca con nota, la ve coordinación y no vuelve al día siguiente', () => {
  const d = entorno();
  const tc = entrar(d, EMA.dni), tb = entrar(d, BELEN.dni);
  const r = pedir(d, { accion: 'pedido_guardar', token: tc, titulo: 'Mandame la lista de socios de mañana', para_dnis: [BELEN.dni], cierra: '2026-11-12' }).data;
  const id = r.pedidos[0].id;
  assert.equal(r.pedidos[0].de_nombre, 'Emanuel');
  assert.equal(pedir(d, { accion: 'pedidos_mios', token: entrar(d, ANA.dni) }).data.pedidos.length, 0);     // no es para Ana
  assert.equal(pedir(d, { accion: 'pedidos_mios', token: tb }).data.pedidos.length, 1);
  const h = pedir(d, { accion: 'pedido_hecho', token: tb, pedido_id: id, nota: 'Te la mandé por mail' }).data.pedidos[0];
  assert.equal(h.hecho, true);
  assert.equal(h.hecho_nota, 'Te la mandé por mail');
  const A = pedir(d, { accion: 'pedidos_ver', token: tc }).data.pedidos[0].asignados[0];
  assert.deepEqual([A.nombre, A.hecho, A.nota], ['Belén', true, 'Te la mandé por mail']);
  // la desmarca y la vuelve a marcar
  assert.equal(pedir(d, { accion: 'pedido_hecho', token: tb, pedido_id: id, hecho: false }).data.pedidos[0].hecho, false);
  pedir(d, { accion: 'pedido_hecho', token: tb, pedido_id: id });
  d.fecha('2026-11-11');
  assert.equal(pedir(d, { accion: 'pedidos_mios', token: tb }).data.pedidos.length, 0);
});

test('una tarea con fecha sin hacer queda atrasada y se sigue mostrando', () => {
  const d = entorno();
  const tc = entrar(d, LUCIA.dni), ta = entrar(d, ANA.dni);
  pedir(d, { accion: 'pedido_guardar', token: tc, titulo: 'Contar las llaves', para_roles: ['recepcion'], para_sedes: ['bolson'], cierra: '2026-11-12', avisar_dias: 2 });
  assert.equal(pedir(d, { accion: 'pedidos_mios', token: entrar(d, PEPE.dni) }).data.pedidos.length, 0);   // solo Bolsón
  assert.equal(pedir(d, { accion: 'pedidos_mios', token: ta }).data.pedidos[0].faltan, 2);
  d.fecha('2026-11-14');
  const P = pedir(d, { accion: 'pedidos_mios', token: ta }).data.pedidos[0];
  assert.equal(P.atrasado, true);
  assert.equal(P.faltan, -2);
});

test('cambiar la fecha de cierre se lleva lo ya cargado; borrar lo saca de todos lados', () => {
  const d = entorno('2026-11-13');
  const tc = entrar(d, LUCIA.dni), ta = entrar(d, ANA.dni);
  const id = pedir(d, { ...limpieza, token: tc }).data.pedidos[0].id;
  pedir(d, { accion: 'pedido_item_agregar', token: ta, pedido_id: id, texto: 'Lavandina' });
  const V = pedir(d, { ...limpieza, token: tc, id: id, cierra: '2026-11-20', avisar_dias: 8 }).data.pedidos[0];
  assert.equal(V.ciclo, '2026-11-20');
  assert.equal(V.por_sede[0].items.length, 1);
  assert.equal(pedir(d, { accion: 'pedidos_mios', token: ta }).data.pedidos[0].items.length, 1);
  assert.equal(pedir(d, { accion: 'pedido_borrar', token: ta, id: id }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'pedido_borrar', token: tc, id: id }).data.pedidos.length, 0);
  assert.equal(pedir(d, { accion: 'pedidos_mios', token: ta }).data.pedidos.length, 0);
});

test('la lista: avisar "mi sede ya cargó" y se reabre si suma algo', () => {
  const d = entorno('2026-11-14');
  const tc = entrar(d, LUCIA.dni), ta = entrar(d, ANA.dni);
  const id = pedir(d, { ...limpieza, token: tc }).data.pedidos[0].id;
  assert.equal(pedir(d, { accion: 'pedido_hecho', token: ta, pedido_id: id }).data.pedidos[0].hecho, true);
  assert.equal(pedir(d, { accion: 'pedido_item_agregar', token: ta, pedido_id: id, texto: 'Esponjas' }).data.pedidos[0].hecho, false);
});

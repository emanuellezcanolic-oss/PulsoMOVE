const test = require('node:test');
const assert = require('node:assert');
const { crearCliente } = require('../web/api.js');

function almacenFalso() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, m };
}

// fetch de prueba: responde con la función `servidor(cuerpo)`; si devuelve 'RED' simula sin conexión
function fetchFalso(servidor) {
  const pedidos = [];
  const f = async (url, opciones) => {
    const cuerpo = JSON.parse(opciones.body);
    pedidos.push(cuerpo);
    const r = servidor(cuerpo);
    if (r === 'RED') throw new TypeError('Failed to fetch');
    return { json: async () => r };
  };
  f.pedidos = pedidos;
  return f;
}

test('llamar manda POST text/plain con el token y devuelve data', async () => {
  let opciones;
  const fetch = async (url, o) => { opciones = o; return { json: async () => ({ ok: true, data: 7 }) }; };
  const c = crearCliente({ url: 'https://x/exec', fetch, almacen: almacenFalso() });
  c.guardarSesion({ token: 'tk', nombre: 'Ana', roles: ['recepcion'] });
  assert.equal(await c.llamar('mis_tareas'), 7);
  assert.equal(opciones.method, 'POST');
  assert.match(opciones.headers['Content-Type'], /^text\/plain/);
  assert.deepEqual(JSON.parse(opciones.body), { accion: 'mis_tareas', token: 'tk' });
});

test('error del servidor → excepción con código; sin_sesion borra la sesión', async () => {
  const almacen = almacenFalso();
  const c = crearCliente({ url: 'u', fetch: fetchFalso(() => ({ ok: false, error: 'sin_sesion' })), almacen });
  c.guardarSesion({ token: 'tk', nombre: 'Ana', roles: ['recepcion'] });
  await assert.rejects(c.llamar('mis_tareas'), e => e.codigo === 'sin_sesion');
  assert.equal(c.sesion(), null);
});

test('sin conexión → código red', async () => {
  const c = crearCliente({ url: 'u', fetch: fetchFalso(() => 'RED'), almacen: almacenFalso() });
  await assert.rejects(c.llamar('login'), e => e.codigo === 'red');
});

test('marcar sin conexión queda en cola y se envía después, una sola vez', async () => {
  let conectado = false;
  const fetch = fetchFalso(() => (conectado ? { ok: true, data: {} } : 'RED'));
  const almacen = almacenFalso();
  const c = crearCliente({ url: 'u', fetch, almacen });
  c.guardarSesion({ token: 'tk', nombre: 'Ana', roles: ['recepcion'] });
  const r = await c.marcar({ tarea_id: 'T1', canal: 'LL', resultado: 'RESERVA' });
  assert.equal(r.enviada, false);
  assert.equal(c.pendientesDeEnvio(), 1);
  // la cola sobrevive a recargar la página
  const c2 = crearCliente({ url: 'u', fetch, almacen });
  assert.equal(c2.pendientesDeEnvio(), 1);
  conectado = true;
  await c2.enviarCola();
  assert.equal(c2.pendientesDeEnvio(), 0);
  const marcas = fetch.pedidos.filter(p => p.accion === 'marcar');
  assert.ok(marcas.every(p => p.id_marca === marcas[0].id_marca && p.token === 'tk'));
});

test('cola: error definitivo descarta, ocupado conserva y corta', async () => {
  const respuestas = { T1: { ok: false, error: 'no_existe' }, T2: { ok: false, error: 'ocupado' }, T3: { ok: true, data: {} } };
  const fetch = fetchFalso(p => respuestas[p.tarea_id]);
  const c = crearCliente({ url: 'u', fetch, almacen: almacenFalso() });
  c.guardarSesion({ token: 'tk', nombre: 'Ana', roles: ['recepcion'] });
  for (const t of ['T1', 'T2', 'T3']) await c.marcar({ tarea_id: t, canal: 'LL', resultado: 'RESERVA' });
  // T1 se descartó, T2 quedó (ocupado) y T3 espera detrás de T2
  assert.equal(c.pendientesDeEnvio(), 2);
  respuestas.T2 = { ok: true, data: {} };
  const r = await c.enviarCola();
  assert.equal(c.pendientesDeEnvio(), 0);
  assert.deepEqual(r.descartadas, []);
});

test('cola: descartadas se informan', async () => {
  const c = crearCliente({ url: 'u', fetch: fetchFalso(() => ({ ok: false, error: 'prohibido' })), almacen: almacenFalso() });
  c.guardarSesion({ token: 'tk', nombre: 'Ana', roles: ['recepcion'] });
  const r = await c.marcar({ tarea_id: 'T9', canal: 'LL', resultado: 'RESERVA' });
  assert.equal(r.enviada, false);
  assert.equal(r.descartadas.length, 1);
  assert.equal(r.descartadas[0].error, 'prohibido');
});

test('mensaje en castellano para cada código', () => {
  const { mensaje } = require('../web/api.js');
  for (const k of ['credenciales', 'bloqueado', 'pin_invalido', 'sin_sesion', 'prohibido', 'datos_invalidos', 'no_existe', 'red', 'ocupado', 'interno', 'debe_cambiar_pin'])
    assert.ok(mensaje(k).length > 10, k);
  assert.ok(mensaje('raro').length > 10);
});

test('una sesión incompleta vuelve a la pantalla de entrada', () => {
  const c = crearCliente({ url: 'u', fetch: fetchFalso(() => ({ ok: true, data: {} })), almacen: almacenFalso() });
  [{}, { token: 'tk' }, { token: 'tk', nombre: 'Ana' }, { token: 'tk', nombre: 'Ana', roles: [] }].forEach(s => {
    c.guardarSesion(s);
    assert.equal(c.sesion(), null);
  });
  c.guardarSesion({ token: 'tk', nombre: 'Ana', roles: ['recepcion'] });
  assert.equal(c.sesion().nombre, 'Ana');
});

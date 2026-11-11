const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario } = require('./repo_falso');

const PROFE = usuario({ dni: '20111222', nombre: 'Profe Uno', roles: 'profe' });
const KINE = usuario({ dni: '20333444', nombre: 'Kine Dos', roles: 'profe', turno: 'tarde' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación', roles: 'coordinador' });
const RECE = usuario();   // 30123456
const BAJA = usuario({ dni: '20777888', nombre: 'Ya no está', roles: 'recepcion', activo: false });

function entorno() {
  return depsFalsas({ repo: repoFalso({ usuarios: [PROFE, KINE, COORD, RECE, BAJA] }), hoy: '2026-11-11', ahora: Date.parse('2026-11-11T15:00:00Z') });
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;
const pid = (d, dni, quien) => pedir(d, { accion: 'chat_personas', token: entrar(d, quien) }).data.personas.find(p => p.nombre === dni).pid;

test('las personas no muestran DNI y no incluyen a uno mismo ni a los dados de baja', () => {
  const d = entorno();
  const r = pedir(d, { accion: 'chat_personas', token: entrar(d, '20111222') });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.data.personas.map(p => p.nombre).sort(), ['Ana Prueba', 'Coordinación', 'Kine Dos']);
  assert.ok(r.data.personas.every(p => p.dni === undefined && /^[0-9a-f]{10}$/.test(p.pid)));
});

test('chat de a dos: se abre, el otro lo ve sin leer, lo lee y responde en la misma conversación', () => {
  const d = entorno();
  const a = entrar(d, '20111222'), b = entrar(d, '20333444');
  const e = pedir(d, { accion: 'chat_enviar', token: a, para: [pid(d, 'Kine Dos', '20111222')], texto: 'Hola, ¿viste a Pedro?', ref: 'Pedro Pérez' });
  assert.ok(e.ok, JSON.stringify(e));
  const lb = pedir(d, { accion: 'chat_listar', token: b }).data;
  assert.equal(lb.sin_leer, 1);
  assert.equal(lb.conversaciones[0].nombre, 'Profe Uno');
  assert.equal(lb.conversaciones[0].tipo, 'directo');
  const la = pedir(d, { accion: 'chat_listar', token: a }).data;
  assert.equal(la.sin_leer, 0);                                   // lo propio no cuenta
  assert.equal(la.conversaciones[0].nombre, 'Kine Dos');
  const v = pedir(d, { accion: 'chat_ver', token: b, id: e.data.id }).data;
  assert.equal(v.mensajes[0].texto, 'Hola, ¿viste a Pedro?');
  assert.equal(v.mensajes[0].ref, 'Pedro Pérez');
  assert.equal(v.mensajes[0].mio, false);
  assert.ok(pedir(d, { accion: 'chat_leido', token: b, id: e.data.id }).ok);
  assert.equal(pedir(d, { accion: 'chat_listar', token: b }).data.sin_leer, 0);
  d.t += 60000;
  const r = pedir(d, { accion: 'chat_enviar', token: b, para: [pid(d, 'Profe Uno', '20333444')], texto: 'Sí, ya está' });
  assert.equal(r.data.id, e.data.id);                             // misma conversación, no una nueva
  assert.equal(pedir(d, { accion: 'chat_ver', token: a, id: e.data.id }).data.mensajes.length, 2);
  assert.equal(d.repo.leer('chat_conv').length, 1);
});

test('solo lo ven quienes participan', () => {
  const d = entorno();
  const a = entrar(d, '20111222');
  const e = pedir(d, { accion: 'chat_enviar', token: a, para: [pid(d, 'Kine Dos', '20111222')], texto: 'Privado' });
  for (const dni of ['30123456', '20555666']) {                   // recepción y coordinación de afuera
    const t = entrar(d, dni);
    assert.equal(pedir(d, { accion: 'chat_ver', token: t, id: e.data.id }).error, 'no_existe');
    assert.equal(pedir(d, { accion: 'chat_enviar', token: t, id: e.data.id, texto: 'me meto' }).error, 'no_existe');
    assert.equal(pedir(d, { accion: 'chat_leido', token: t, id: e.data.id }).error, 'no_existe');
    assert.deepEqual(pedir(d, { accion: 'chat_listar', token: t }).data.conversaciones, []);
  }
  assert.equal(pedir(d, { accion: 'chat_listar', token: 'falso' }).error, 'sin_sesion');
});

test('grupo de tres: lo ven los tres, se le pone nombre y se suma gente', () => {
  const d = entorno();
  const a = entrar(d, '20111222');
  const e = pedir(d, { accion: 'chat_enviar', token: a, para: [pid(d, 'Kine Dos', '20111222'), pid(d, 'Ana Prueba', '20111222')], nombre: 'Bolsón', texto: 'Reunión el lunes' });
  assert.ok(e.ok, JSON.stringify(e));
  for (const dni of ['20111222', '20333444', '30123456']) {
    const l = pedir(d, { accion: 'chat_listar', token: entrar(d, dni) }).data.conversaciones[0];
    assert.equal(l.nombre, 'Bolsón');
    assert.equal(l.tipo, 'grupo');
    assert.equal(l.personas, 3);
  }
  assert.deepEqual(pedir(d, { accion: 'chat_listar', token: entrar(d, '20555666') }).data.conversaciones, []);
  const s = pedir(d, { accion: 'chat_agregar', token: entrar(d, '30123456'), id: e.data.id, para: [pid(d, 'Coordinación', '30123456')] });
  assert.ok(s.ok, JSON.stringify(s));
  assert.equal(pedir(d, { accion: 'chat_ver', token: entrar(d, '20555666'), id: e.data.id }).data.miembros.length, 4);
});

test('un chat de a dos no se convierte en grupo; los datos se validan', () => {
  const d = entorno();
  const a = entrar(d, '20111222');
  const k = pid(d, 'Kine Dos', '20111222');
  const e = pedir(d, { accion: 'chat_enviar', token: a, para: [k], texto: 'hola' });
  assert.equal(pedir(d, { accion: 'chat_agregar', token: a, id: e.data.id, para: [pid(d, 'Ana Prueba', '20111222')] }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'chat_enviar', token: a, para: [k], texto: '   ' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'chat_enviar', token: a, para: [k], texto: 'x'.repeat(1001) }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'chat_enviar', token: a, para: [], texto: 'a nadie' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'chat_enviar', token: a, para: ['0123456789'], texto: 'a un fantasma' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'chat_enviar', token: a, para: [k], texto: 'hola', ref: 'y'.repeat(81) }).error, 'datos_invalidos');
});

test('la conversación sin mensajes por un año se borra sola; la activa se queda', () => {
  const d = entorno();
  const a = entrar(d, '20111222');
  const vieja = pedir(d, { accion: 'chat_enviar', token: a, para: [pid(d, 'Kine Dos', '20111222')], texto: 'de hace mucho' }).data.id;
  d.t = Date.parse('2027-06-01T15:00:00Z');                     // 6 meses después
  const a2 = entrar(d, '20111222');                              // la sesión de antes ya venció
  const activa = pedir(d, { accion: 'chat_enviar', token: a2, para: [pid(d, 'Ana Prueba', '20111222')], texto: 'de hace poco' }).data.id;
  assert.equal(d.repo.leer('chat_conv').length, 2);
  d.t = Date.parse('2027-12-15T15:00:00Z');                     // más de un año de la primera, menos de un año de la segunda
  pedir(d, { accion: 'chat_enviar', token: entrar(d, '20111222'), id: activa, texto: 'sigo' });
  const ids = d.repo.leer('chat_conv').map(c => c.id);
  assert.deepEqual(ids, [activa]);
  assert.ok(!d.repo.leer('chat_msg').some(m => m.conv_id === vieja));
  assert.ok(!d.repo.leer('chat_lect').some(l => l.conv_id === vieja));
});

test('el aviso liviano cuenta lo que llega, se borra al leer y no se mezcla entre personas', () => {
  const d = entorno();
  const a = entrar(d, '20111222'), b = entrar(d, '20333444');
  assert.deepEqual(pedir(d, { accion: 'chat_novedad', token: b }).data, { sin_leer: 0, ts: '' });
  const e = pedir(d, { accion: 'chat_enviar', token: a, para: [pid(d, 'Kine Dos', '20111222'), pid(d, 'Ana Prueba', '20111222')], texto: 'uno' });
  d.t += 1000;
  pedir(d, { accion: 'chat_enviar', token: a, id: e.data.id, texto: 'dos' });
  const n = pedir(d, { accion: 'chat_novedad', token: b }).data;
  assert.equal(n.sin_leer, 2);
  assert.ok(n.ts > '2026');
  assert.equal(pedir(d, { accion: 'chat_novedad', token: a }).data.sin_leer, 0);       // quien escribe no se avisa a sí mismo
  assert.equal(pedir(d, { accion: 'chat_novedad', token: b }).data.sin_leer, pedir(d, { accion: 'chat_listar', token: b }).data.sin_leer);   // coincide con la bandeja
  pedir(d, { accion: 'chat_leido', token: b, id: e.data.id });
  assert.equal(pedir(d, { accion: 'chat_novedad', token: b }).data.sin_leer, 0);
  assert.equal(pedir(d, { accion: 'chat_novedad', token: entrar(d, '30123456') }).data.sin_leer, 2);   // la otra persona del grupo sigue con lo suyo
  assert.equal(pedir(d, { accion: 'chat_novedad', token: 'falso' }).error, 'sin_sesion');
});

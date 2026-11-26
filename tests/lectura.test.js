const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario } = require('./repo_falso');

const EMA = usuario({ dni: '20777888', nombre: 'Emanuel', roles: 'admin', sede: 'bolson' });
const LUCIA = usuario({ dni: '20555666', nombre: 'Lucía', roles: 'coordinador', sede: 'bolson' });
const ANA = usuario({ dni: '30111111', nombre: 'Ana', roles: 'recepcion', sede: 'bolson' });
const PEPE = usuario({ dni: '30333333', nombre: 'Pepe', roles: 'recepcion', sede: 'puelo' });
const BELEN = usuario({ dni: '20111222', nombre: 'Belén', roles: 'profe', sede: 'bolson' });
const HOY = '2026-11-12';

const tarea = (id, dni, sede, fecha, estado, extra = {}) => ({ id, fecha, sede, socio_id: id, socio_nombre: 'Socio ' + id, tipo: 'Renovación', prioridad: '1', asignado_dni: dni, pendiente_desde: fecha, estado, hecha_en: '', ultima_anotacion: 'tel 2944-000000 debe $50000', ...extra });

function entorno() {
  return depsFalsas({
    hoy: HOY, ahora: Date.parse(HOY + 'T15:00:00Z'),
    repo: repoFalso({
      usuarios: [EMA, LUCIA, ANA, PEPE, BELEN],
      tareas: [
        tarea('t1', ANA.dni, 'bolson', '2026-11-12', 'hecha', { hecha_en: '2026-11-12T13:00:00Z' }),
        tarea('t2', ANA.dni, 'bolson', '2026-11-10', 'pendiente'),
        tarea('t3', ANA.dni, 'bolson', '2026-11-12', 'pendiente'),
        tarea('t4', ANA.dni, 'bolson', '2026-11-20', 'pendiente'),
        tarea('t5', PEPE.dni, 'puelo', '2026-11-12', 'pendiente'),
      ],
      profe_tareas: [
        { id: 'p1', fecha: '2026-11-11', sede: 'bolson', profe_dni: BELEN.dni, socio_nombre: 'Socio p1', tipo: 'Renovar plan', estado: 'pendiente', hecha_en: '', cerrada_en: '' },
        { id: 'p2', fecha: '2026-11-12', sede: 'bolson', profe_dni: BELEN.dni, socio_nombre: 'Socio p2', tipo: 'Plan nuevo', estado: 'hecha', hecha_en: '2026-11-12T14:00:00Z', cerrada_en: '' },
        { id: 'p3', fecha: '2026-11-09', sede: 'bolson', profe_dni: BELEN.dni, socio_nombre: 'Socio p3', tipo: 'Renovar plan', estado: 'cerrada', hecha_en: '', cerrada_en: '2026-11-12T09:00:00Z' },
      ],
    }),
  });
}

const login = (d, u) => L.manejar({ accion: 'login', dni: u.dni, pin: '4831' }, d).data.token;
const entrar = (d, u, pin = '4831') => L.manejar({ accion: 'lectura_entrar', dni: u.dni, pin }, d);
const habilitar = (d, u, activa) => L.manejar({ accion: 'usuario_lectura', token: login(d, EMA), dni: u.dni, activa }, d);
const leer = (d, token, extra = {}) => L.manejar({ accion: 'lectura', token, ...extra }, d);

test('entran el admin y la coordinación habilitada; nadie más', () => {
  const d = entorno();
  assert.equal(entrar(d, EMA).ok, true);
  assert.equal(entrar(d, LUCIA).error, 'prohibido');       // todavía sin habilitar
  assert.equal(entrar(d, ANA).error, 'prohibido');
  assert.equal(entrar(d, BELEN).error, 'prohibido');
  assert.equal(habilitar(d, ANA, true).error, 'datos_invalidos');   // a recepción no se le puede dar
  assert.equal(habilitar(d, LUCIA, true).ok, true);
  assert.equal(entrar(d, LUCIA).ok, true);
  assert.equal(entrar(d, LUCIA, '0000').error, 'credenciales');
});

test('solo el admin habilita', () => {
  const d = entorno();
  assert.equal(L.manejar({ accion: 'usuario_lectura', token: login(d, LUCIA), dni: LUCIA.dni, activa: true }, d).error, 'prohibido');
});

test('el token de lectura no sirve para ninguna otra acción', () => {
  const d = entorno();
  const t = entrar(d, EMA).data.token;
  const antes = JSON.stringify(d.repo.hojas);
  const acciones = Object.keys(L.ACCIONES_PARA_PRUEBAS()).filter(a => !['login', 'lectura', 'lectura_entrar'].includes(a));
  for (const accion of acciones) {
    const r = L.manejar({ accion, token: t, dni: ANA.dni, id: 't2', resultado: 'HECHO', canal: 'MP', activa: true, activo: false }, d);
    assert.equal(r.ok, false, accion);
  }
  assert.equal(JSON.stringify(d.repo.hojas), antes);
});

test('una sesión común no sirve para leer, y leer no escribe nada', () => {
  const d = entorno();
  assert.equal(leer(d, login(d, EMA)).error, 'sin_sesion');
  const t = entrar(d, EMA).data.token;
  const antes = JSON.stringify(d.repo.hojas);
  assert.equal(leer(d, t).ok, true);
  assert.equal(JSON.stringify(d.repo.hojas), antes);
  assert.ok(L.accionesDeLectura().includes('lectura'));
});

test('al quitar el acceso, cambiar el PIN o vencer, el token deja de servir', () => {
  const d = entorno();
  habilitar(d, LUCIA, true);
  const t = entrar(d, LUCIA).data.token;
  assert.equal(leer(d, t).ok, true);
  habilitar(d, LUCIA, false);
  assert.equal(leer(d, t).error, 'sin_sesion');
  habilitar(d, LUCIA, true);
  assert.equal(leer(d, t).error, 'sin_sesion');            // volver a habilitar no revive lo viejo
  const t2 = entrar(d, LUCIA).data.token;
  L.manejar({ accion: 'pin_regenerar', token: login(d, EMA), dni: LUCIA.dni }, d);
  assert.equal(leer(d, t2).error, 'sin_sesion');
  const t3 = entrar(d, EMA).data.token;
  d.t += 31 * 24 * 3600 * 1000;
  assert.equal(leer(d, t3).error, 'sin_sesion');
});

test('dice quién hizo y quién no, sin datos de más', () => {
  const d = entorno();
  const r = leer(d, entrar(d, EMA).data.token).data;
  const ana = r.recepcion.find(p => p.nombre === 'Ana');
  assert.equal(ana.hechas, 1);
  assert.equal(ana.pendientes, 2);          // lo de los próximos días no cuenta
  assert.equal(ana.atrasadas, 1);
  assert.deepEqual(ana.sin_hacer.map(x => x.socio), ['Socio t2', 'Socio t3']);
  const belen = r.profes.find(p => p.nombre === 'Belén');
  assert.equal(belen.hechas, 1);
  assert.equal(belen.pendientes, 1);
  assert.equal(belen.atrasadas, 1);
  assert.equal(belen.cerradas_sin_marcar, 1);
  assert.equal(r.recepcion.find(p => p.nombre === 'Pepe').pendientes, 1);   // el admin ve todas las sedes
  const crudo = JSON.stringify(r);
  for (const prohibido of ['2944', '50000', 'pin_hash', ANA.dni, EMA.dni, 'ultima_anotacion']) assert.ok(!crudo.includes(prohibido), prohibido);
});

test('coordinación ve solo su sede; el rango se valida', () => {
  const d = entorno();
  habilitar(d, LUCIA, true);
  const t = entrar(d, LUCIA).data.token;
  assert.deepEqual(leer(d, t).data.recepcion.map(p => p.nombre), ['Ana']);
  assert.equal(leer(d, t, { sede: 'puelo' }).error, 'prohibido');
  assert.equal(leer(d, t, { desde: '2026-09-01', hasta: HOY }).error, 'datos_invalidos');
  assert.equal(leer(d, t, { desde: HOY, hasta: '2026-11-01' }).error, 'datos_invalidos');
  assert.equal(leer(d, t, { desde: '2026-11-01', hasta: HOY }).data.desde, '2026-11-01');
});

test('nada de dinero: ni las hojas de plata ni importes escritos en un texto', () => {
  const d = entorno();
  const R = d.repo.hojas;
  R.ventas = [{ fecha: HOY, sede: 'bolson', dni: ANA.dni, planes_monto: '987654', efectivo: '987654' }];
  R.liquidacion = [{ dni: ANA.dni, mes: '2026-11', datos: '{"sueldo":987654}' }];
  R.profe_liq = [{ mes: '2026-11', profe_dni: BELEN.dni, datos: '{"total":987654}' }];
  R.tareas.push(tarea('t9', ANA.dni, 'bolson', HOY, 'pendiente', { tipo: 'Cobrar deuda $ 987.654', socio_nombre: 'Socio t9', accion: 'cobrar $987654' }));
  R.pedidos = [{ id: 'x', tipo: 'tarea', titulo: 'Juntar $987.654 y 987654 pesos', detalle: '', para_roles: 'recepcion', para_sedes: '', para_dnis: '', cierra: '', avisar_dias: '', repite: '', estado: 'activo', creado: '2026-11-01' }];
  const crudo = JSON.stringify(leer(d, entrar(d, EMA).data.token).data);
  assert.ok(crudo.includes('Cobrar deuda') && crudo.includes('Juntar'), 'el texto sigue estando');
  assert.ok(!/987[.]?654/.test(crudo), crudo);
});

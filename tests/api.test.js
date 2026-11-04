const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario } = require('./repo_falso');

const MIN15 = 15 * 60 * 1000;

function entorno(usuarios = [usuario()], extra = {}) {
  return depsFalsas({ repo: repoFalso({ usuarios, ...extra }) });
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni = '30123456', pin = '4831') => pedir(d, { accion: 'login', dni, pin }).data.token;

// ---------- Task 3: login ----------

test('login correcto con DNI con puntos', () => {
  const d = entorno();
  const r = pedir(d, { accion: 'login', dni: '30.123.456', pin: '4831' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.nombre, 'Ana Prueba');
  assert.deepEqual(r.data.roles, ['recepcion']);
  assert.equal(r.data.debe_cambiar_pin, false);
  assert.equal(L.leerToken(r.data.token, d.t, 's', d.hmac), '30123456');
});

test('PIN mal suma intento', () => {
  const d = entorno();
  assert.deepEqual(pedir(d, { accion: 'login', dni: '30123456', pin: '0907' }), { ok: false, error: 'credenciales' });
  assert.equal(d.repo.hojas.usuarios[0].intentos, '1');
});

test('DNI inexistente → credenciales', () => {
  assert.equal(pedir(entorno(), { accion: 'login', dni: '1', pin: '4831' }).error, 'credenciales');
});

test('5 fallos bloquean 15 minutos', () => {
  const d = entorno();
  for (let i = 0; i < 5; i++) pedir(d, { accion: 'login', dni: '30123456', pin: '0907' });
  assert.equal(d.repo.hojas.usuarios[0].bloqueado_hasta, String(d.t + MIN15));
  assert.equal(pedir(d, { accion: 'login', dni: '30123456', pin: '4831' }).error, 'bloqueado');
  d.t += MIN15 + 1;
  assert.ok(pedir(d, { accion: 'login', dni: '30123456', pin: '4831' }).ok);
  assert.equal(d.repo.hojas.usuarios[0].intentos, '0');
});

test('usuario inactivo → credenciales', () => {
  const d = entorno([usuario({ activo: false })]);
  assert.equal(pedir(d, { accion: 'login', dni: '30123456', pin: '4831' }).error, 'credenciales');
});

test('debe cambiar PIN antes de usar la app', () => {
  const d = entorno([usuario({ debe_cambiar_pin: true })]);
  const r = pedir(d, { accion: 'login', dni: '30123456', pin: '4831' });
  assert.equal(r.data.debe_cambiar_pin, true);
  assert.equal(pedir(d, { accion: 'mis_tareas', token: r.data.token }).error, 'debe_cambiar_pin');
});

test('cambiar_pin', () => {
  const d = entorno([usuario({ debe_cambiar_pin: true })]);
  const token = entrar(d);
  assert.equal(pedir(d, { accion: 'cambiar_pin', token, pin_nuevo: '1111' }).error, 'pin_invalido');
  assert.equal(pedir(d, { accion: 'cambiar_pin', token, pin_nuevo: '4831' }).error, 'pin_invalido');
  assert.ok(pedir(d, { accion: 'cambiar_pin', token, pin_nuevo: '0907' }).ok);
  assert.equal(d.repo.hojas.usuarios[0].debe_cambiar_pin, 'false');
  assert.equal(pedir(d, { accion: 'login', dni: '30123456', pin: '4831' }).error, 'credenciales');
  assert.ok(pedir(d, { accion: 'login', dni: '30123456', pin: '0907' }).ok);
});

test('sin token o token vencido → sin_sesion', () => {
  const d = entorno();
  assert.equal(pedir(d, { accion: 'mis_tareas' }).error, 'sin_sesion');
  const token = entrar(d);
  d.t += 10 * 3600 * 1000 + 1;
  assert.equal(pedir(d, { accion: 'mis_tareas', token }).error, 'sin_sesion');
});

test('token de usuario desactivado → sin_sesion', () => {
  const d = entorno();
  const token = entrar(d);
  d.repo.hojas.usuarios[0].activo = 'false';
  assert.equal(pedir(d, { accion: 'mis_tareas', token }).error, 'sin_sesion');
});

test('acción desconocida o pedido raro → datos_invalidos', () => {
  const d = entorno();
  assert.equal(pedir(d, { accion: 'borrar_todo' }).error, 'datos_invalidos');
  assert.equal(pedir(d, null).error, 'datos_invalidos');
});

// ---------- Task 4: mis tareas y marcar ----------

function tarea(o) {
  return { id: 'T1', fecha: '2026-11-09', sede: 'bolson', socio_id: '501', socio_nombre: 'Socio Uno', profe: 'Profe A',
           tipo: 'Vence en 7 días', prioridad: '2', situacion: 'Vence el 12/11', accion: 'Llamar', ultima_anotacion: '',
           asignado_dni: '30123456', pendiente_desde: '2026-11-09', estado: 'pendiente', hecha_en: '', ...o };
}
const OTRA = usuario({ dni: '28999888', nombre: 'Beto Prueba', turno: 'tarde', pin: '0907' });

test('mis_tareas: propias pendientes y de hoy, ordenadas', () => {
  const d = entorno([usuario(), OTRA], { tareas: [
    tarea({ id: 'hoy-b', socio_nombre: 'Zoe', prioridad: '1' }),
    tarea({ id: 'hoy-a', socio_nombre: 'Ana', prioridad: '1' }),
    tarea({ id: 'vieja', fecha: '2026-11-05', pendiente_desde: '2026-11-05', prioridad: '3' }),
    tarea({ id: 'hecha-hoy', estado: 'hecha', prioridad: '4' }),
    tarea({ id: 'hecha-ayer', fecha: '2026-11-06', estado: 'hecha' }),
    tarea({ id: 'cerrada', estado: 'cerrada' }),
    tarea({ id: 'ajena', asignado_dni: '28999888' }),
  ] });
  const r = pedir(d, { accion: 'mis_tareas', token: entrar(d) });
  assert.equal(r.data.hoy, '2026-11-09');
  assert.deepEqual(r.data.tareas.map(t => t.id), ['hoy-a', 'hoy-b', 'vieja', 'hecha-hoy']);
  assert.equal(r.data.tareas[2].dias_pendiente, 2);
});

test('marcar: ajena, inexistente, válida', () => {
  const d = entorno([usuario(), OTRA], { tareas: [tarea({}), tarea({ id: 'T2', asignado_dni: '28999888' })], registro: [] });
  const token = entrar(d);
  const m = { accion: 'marcar', token, canal: 'LL', resultado: 'RESERVA', detalle: 'Jueves 18 h' };
  assert.equal(pedir(d, { ...m, tarea_id: 'T2', id_marca: 'a' }).error, 'prohibido');
  assert.equal(pedir(d, { ...m, tarea_id: 'NO', id_marca: 'b' }).error, 'no_existe');
  assert.equal(pedir(d, { ...m, tarea_id: 'T1', id_marca: 'c', resultado: 'VUELVE' }).error, 'datos_invalidos');
  assert.ok(pedir(d, { ...m, tarea_id: 'T1', id_marca: 'c' }).ok);
  const reg = d.repo.hojas.registro;
  assert.equal(reg.length, 1);
  assert.equal(reg[0].socio_id, '501');
  assert.equal(reg[0].tipo, 'Vence en 7 días');
  assert.equal(reg[0].dni, '30123456');
  assert.equal(reg[0].sede, 'bolson');
  assert.equal(reg[0].fecha_tarea, '2026-11-09');
  assert.equal(d.repo.hojas.tareas[0].estado, 'hecha');
  assert.ok(d.repo.hojas.tareas[0].hecha_en);
});

test('marcar: mismo id_marca dos veces → una fila; corrección agrega otra', () => {
  const d = entorno([usuario()], { tareas: [tarea({})], registro: [] });
  const m = { accion: 'marcar', token: entrar(d), tarea_id: 'T1', canal: 'LL', resultado: 'RESERVA' };
  assert.ok(pedir(d, { ...m, id_marca: 'x1' }).ok);
  assert.ok(pedir(d, { ...m, id_marca: 'x1' }).ok);
  assert.equal(d.repo.hojas.registro.length, 1);
  assert.ok(pedir(d, { ...m, id_marca: 'x2', resultado: 'NO CONTESTA' }).ok);
  assert.equal(d.repo.hojas.registro.length, 2);
  assert.equal(d.repo.hojas.tareas[0].estado, 'hecha');
});

test('marcar sin id_marca → datos_invalidos', () => {
  const d = entorno([usuario()], { tareas: [tarea({})], registro: [] });
  assert.equal(pedir(d, { accion: 'marcar', token: entrar(d), tarea_id: 'T1', canal: 'LL', resultado: 'RESERVA' }).error, 'datos_invalidos');
});

// ---------- Task 5: pipeline ----------

const lote = () => [
  { sede: 'bolson', socio_id: '501', socio_nombre: 'Socio Uno', profe: 'P', tipo: 'Riesgo alto', prioridad: '5',
    situacion: 's', accion: 'a', ultima_anotacion: '', asignado_dni: '30123456' },
  { sede: 'bolson', socio_id: '502', socio_nombre: 'Socio Dos', profe: 'P', tipo: 'Riesgo alto', prioridad: '5',
    situacion: 's', accion: 'a', ultima_anotacion: '', asignado_dni: '30123456' },
];

test('pipeline: clave mala → clave', () => {
  const d = entorno();
  for (const accion of ['cargar_tareas', 'bajar_registro', 'usuarios_resumen']) {
    assert.equal(pedir(d, { accion, clave: 'mala' }).error, 'clave', accion);
    assert.equal(pedir(d, { accion }).error, 'clave', accion);
  }
});

test('cargar_tareas dos veces el mismo día no duplica', () => {
  const d = entorno();
  const r1 = pedir(d, { accion: 'cargar_tareas', clave: 'clave-prueba', fecha: '2026-11-09', tareas: lote(), cerrar: [] });
  assert.deepEqual(r1.data, { nuevas: 2, actualizadas: 0, cerradas: 0 });
  const r2 = pedir(d, { accion: 'cargar_tareas', clave: 'clave-prueba', fecha: '2026-11-09', tareas: lote() });
  assert.deepEqual(r2.data, { nuevas: 0, actualizadas: 2, cerradas: 0 });
  assert.equal(d.repo.hojas.tareas.length, 2);
  const r3 = pedir(d, { accion: 'cargar_tareas', clave: 'clave-prueba', fecha: '2026-11-09', tareas: [], cerrar: [{ sede: 'bolson', socio_id: '502' }] });
  assert.equal(r3.data.cerradas, 1);
});

test('cargar_tareas valida fecha y lista', () => {
  const d = entorno();
  assert.equal(pedir(d, { accion: 'cargar_tareas', clave: 'clave-prueba', fecha: '09/11', tareas: [] }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'cargar_tareas', clave: 'clave-prueba', fecha: '2026-11-09', tareas: 'x' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'cargar_tareas', clave: 'clave-prueba', fecha: '2026-11-09', tareas: [{ sede: 'bolson' }] }).error, 'datos_invalidos');
});

test('bajar_registro filtra por ts', () => {
  const d = entorno([usuario()], { registro: [{ id_marca: 'a', ts: '2026-11-06T15:00:00.000Z' }, { id_marca: 'b', ts: '2026-11-09T12:00:00.000Z' }] });
  const r = pedir(d, { accion: 'bajar_registro', clave: 'clave-prueba', desde: '2026-11-07T00:00:00.000Z' });
  assert.deepEqual(r.data.filas.map(f => f.id_marca), ['b']);
});

test('usuarios_resumen sin hash ni sal y solo activos', () => {
  const d = entorno([usuario(), usuario({ dni: '27000111', activo: false })]);
  const r = pedir(d, { accion: 'usuarios_resumen', clave: 'clave-prueba' });
  assert.deepEqual(r.data.map(u => u.dni), ['30123456']);
  assert.deepEqual(Object.keys(r.data[0]).sort(), ['dni', 'nombre', 'roles', 'sede', 'turno']);
});

// ---------- Task 6: sede, alertas, reasignar, garantía ----------

const COORD = usuario({ dni: '25111222', nombre: 'Coord Bolson', pin: '0907', roles: 'recepcion,coordinador' });
const COORD_PUELO = usuario({ dni: '25333444', nombre: 'Coord Puelo', pin: '0907', sede: 'puelo', roles: 'coordinador' });
const ADMIN = usuario({ dni: '20000001', nombre: 'Admin', pin: '0907', sede: 'bolson', roles: 'admin' });
const TARDE = usuario({ dni: '28999888', nombre: 'Beto Prueba', pin: '0907', turno: 'tarde' });
const DE_PUELO = usuario({ dni: '26555666', nombre: 'Ceci Puelo', pin: '0907', sede: 'puelo' });

function equipo(extra = {}) {
  return entorno([usuario(), TARDE, COORD, COORD_PUELO, ADMIN, DE_PUELO], { registro: [], garantia: [], ...extra });
}

test('sede: alertas desde 2 días hábiles', () => {
  const d = equipo({ tareas: [
    tarea({ id: 'jue', fecha: '2026-11-05', pendiente_desde: '2026-11-05' }),
    tarea({ id: 'vie', fecha: '2026-11-06', pendiente_desde: '2026-11-06' }),
    tarea({ id: 'hecha', estado: 'hecha', hecha_en: '2026-11-09T13:00:00.000Z' }),
    tarea({ id: 'puelo', sede: 'puelo', asignado_dni: '26555666', pendiente_desde: '2026-11-02' }),
  ] });
  const r = pedir(d, { accion: 'sede', token: entrar(d, '25111222', '0907') });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.data.alertas.map(t => t.id), ['jue']);
  assert.equal(r.data.alertas[0].dias_pendiente, 2);
  assert.equal(r.data.alertas[0].asignado_nombre, 'Ana Prueba');
  const ana = r.data.personas.find(p => p.dni === '30123456');
  assert.deepEqual([ana.hechas_hoy, ana.pendientes, ana.hechas_semana], [1, 2, 1]);
  assert.ok(!r.data.personas.some(p => p.sede === 'puelo' || p.dni === '26555666'));
});

test('sede: permisos', () => {
  const d = equipo({ tareas: [] });
  assert.equal(pedir(d, { accion: 'sede', token: entrar(d) }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'sede', token: entrar(d, '25111222', '0907'), sede: 'puelo' }).error, 'prohibido');
  const adm = entrar(d, '20000001', '0907');
  assert.equal(pedir(d, { accion: 'sede', token: adm }).error, 'datos_invalidos');
  assert.ok(pedir(d, { accion: 'sede', token: adm, sede: 'puelo' }).ok);
});

test('reasignar', () => {
  const d = equipo({ tareas: [tarea({ pendiente_desde: '2026-11-05' })] });
  const c = entrar(d, '25111222', '0907');
  assert.equal(pedir(d, { accion: 'reasignar', token: c, tarea_id: 'T1', dni: '26555666' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'reasignar', token: entrar(d, '25333444', '0907'), tarea_id: 'T1', dni: '28999888' }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'reasignar', token: entrar(d), tarea_id: 'T1', dni: '28999888' }).error, 'prohibido');
  assert.ok(pedir(d, { accion: 'reasignar', token: c, tarea_id: 'T1', dni: '28999888' }).ok);
  assert.equal(d.repo.hojas.tareas[0].asignado_dni, '28999888');
  assert.equal(d.repo.hojas.tareas[0].pendiente_desde, '2026-11-05');
});

test('garantía: crear y decidir', () => {
  const d = equipo({ tareas: [] });
  const rec = entrar(d);
  const g = { accion: 'garantia_crear', token: rec, socio_id: '501', socio_nombre: 'Socio Uno', profe: 'Profe A' };
  assert.equal(pedir(d, g).error, 'datos_invalidos');
  const r = pedir(d, { ...g, motivo: 'No le armaron la rutina' });
  assert.ok(r.ok);
  const fila = d.repo.hojas.garantia[0];
  assert.deepEqual([fila.sede, fila.estado, fila.registra_dni], ['bolson', 'pendiente', '30123456']);
  assert.equal(pedir(d, { accion: 'garantia_decidir', token: rec, id: r.data.id, estado: 'aprobada' }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'garantia_decidir', token: entrar(d, '25333444', '0907'), id: r.data.id, estado: 'aprobada' }).error, 'prohibido');
  const c = entrar(d, '25111222', '0907');
  assert.equal(pedir(d, { accion: 'garantia_decidir', token: c, id: r.data.id, estado: 'quizas' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'sede', token: c }).data.garantias.length, 1);
  assert.ok(pedir(d, { accion: 'garantia_decidir', token: c, id: r.data.id, estado: 'aprobada', comentario: 'Ok' }).ok);
  assert.deepEqual([d.repo.hojas.garantia[0].estado, d.repo.hojas.garantia[0].decide_dni], ['aprobada', '25111222']);
  assert.equal(pedir(d, { accion: 'sede', token: c }).data.garantias.length, 0);
});

// ---------- Task 7: administración ----------

const nuevos = () => [
  { dni: '31.000.001', nombre: 'Uno Prueba', sede: 'bariloche', turno: 'manana', roles: 'recepcion,coordinador' },
  { dni: '31000002', nombre: 'Dos Prueba', sede: 'bariloche', turno: 'tarde', roles: 'recepcion' },
];

test('usuarios_cargar crea con PIN y pide cambio; recargar no toca PIN', () => {
  const d = entorno([]);
  const r = pedir(d, { accion: 'usuarios_cargar', clave: 'clave-prueba', usuarios: nuevos() });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.data.pines.map(p => p.dni), ['31000001', '31000002']);
  for (const p of r.data.pines) assert.ok(L.pinValido(p.pin));
  const pin1 = r.data.pines[0].pin;
  const login = pedir(d, { accion: 'login', dni: '31000001', pin: pin1 });
  assert.equal(login.data.debe_cambiar_pin, true);
  const cambio = [{ ...nuevos()[0], nombre: 'Uno Cambiado' }];
  const r2 = pedir(d, { accion: 'usuarios_cargar', clave: 'clave-prueba', usuarios: cambio });
  assert.deepEqual(r2.data.pines, []);
  assert.equal(d.repo.hojas.usuarios.length, 2);
  assert.equal(d.repo.hojas.usuarios[0].nombre, 'Uno Cambiado');
  assert.ok(pedir(d, { accion: 'login', dni: '31000001', pin: pin1 }).ok);
});

test('usuarios_cargar valida', () => {
  const d = entorno([]);
  const mal = u => assert.equal(pedir(d, { accion: 'usuarios_cargar', clave: 'clave-prueba', usuarios: [{ ...nuevos()[1], ...u }] }).error, 'datos_invalidos', JSON.stringify(u));
  mal({ sede: 'esquel' });
  mal({ turno: 'noche' });
  mal({ roles: 'jefe' });
  mal({ dni: '' });
  mal({ nombre: '' });
  assert.equal(pedir(d, { accion: 'usuarios_cargar', clave: 'mala', usuarios: nuevos() }).error, 'clave');
  assert.equal(d.repo.hojas.usuarios.length, 0);
});

test('pin_regenerar, usuarios_listar y usuario_activo solo admin', () => {
  const d = equipo({ tareas: [] });
  const rec = entrar(d);
  const adm = entrar(d, '20000001', '0907');
  for (const accion of ['pin_regenerar', 'usuarios_listar', 'usuario_activo'])
    assert.equal(pedir(d, { accion, token: rec, dni: '28999888', activo: false }).error, 'prohibido', accion);
  const lista = pedir(d, { accion: 'usuarios_listar', token: adm }).data;
  assert.equal(lista.length, 6);
  for (const u of lista) assert.ok(!('pin_hash' in u) && !('sal' in u));
  for (let i = 0; i < 5; i++) pedir(d, { accion: 'login', dni: '28999888', pin: '1357' });
  assert.equal(pedir(d, { accion: 'usuarios_listar', token: adm }).data.find(u => u.dni === '28999888').bloqueado, true);
  const r = pedir(d, { accion: 'pin_regenerar', token: adm, dni: '28999888' });
  assert.ok(L.pinValido(r.data.pin));
  const l = pedir(d, { accion: 'login', dni: '28999888', pin: r.data.pin });
  assert.ok(l.ok && l.data.debe_cambiar_pin);
  assert.equal(pedir(d, { accion: 'pin_regenerar', token: adm, dni: '1' }).error, 'no_existe');
  assert.ok(pedir(d, { accion: 'usuario_activo', token: adm, dni: '28999888', activo: false }).ok);
  assert.equal(pedir(d, { accion: 'login', dni: '28999888', pin: r.data.pin }).error, 'credenciales');
});

// ---------- Ver todo: lista de cada recepcionista ----------

test('tareas_de: admin ve cualquiera con su marca; coordinador solo su sede; recepción no', () => {
  const d = equipo({ tareas: [tarea({}), tarea({ id: 'T2', estado: 'hecha', hecha_en: '2026-11-09T13:00:00.000Z' }), tarea({ id: 'T3', estado: 'cerrada' })],
                     registro: [{ id_marca: 'a', ts: '1', tarea_id: 'T2', canal: 'LL', resultado: 'RESERVA', fecha_resultado: '', detalle: 'jueves' }] });
  const adm = entrar(d, '20000001', '0907');
  const r = pedir(d, { accion: 'tareas_de', token: adm, dni: '30.123.456' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.nombre, 'Ana Prueba');
  assert.deepEqual(r.data.tareas.map(t => t.id).sort(), ['T1', 'T2']);
  const t2 = r.data.tareas.find(t => t.id === 'T2');
  assert.equal(t2.marca.resultado, 'RESERVA');
  assert.equal(t2.marca.detalle, 'jueves');
  assert.equal(pedir(d, { accion: 'tareas_de', token: entrar(d), dni: '28999888' }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'tareas_de', token: entrar(d, '25333444', '0907'), dni: '30123456' }).error, 'prohibido');
  assert.ok(pedir(d, { accion: 'tareas_de', token: entrar(d, '25111222', '0907'), dni: '30123456' }).ok);
  assert.equal(pedir(d, { accion: 'tareas_de', token: adm, dni: '1' }).error, 'no_existe');
});

test('marcar rechaza tareas que se verifican en MOVE', () => {
  const d = entorno([usuario()], { tareas: [tarea({ tipo: 'Asignarle profesor' })], registro: [] });
  assert.equal(pedir(d, { accion: 'marcar', token: entrar(d), tarea_id: 'T1', id_marca: 'x', canal: 'PR', resultado: 'RESERVA' }).error, 'datos_invalidos');
  assert.equal(d.repo.hojas.tareas[0].estado, 'pendiente');
});

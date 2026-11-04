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

test('sede: una tarea de otra sede se ve con quien la tiene', () => {
  const d = equipo({ tareas: [tarea({ id: 'online', sede: 'puelo', pendiente_desde: '2026-11-02' }), tarea({ id: 'suya', sede: 'bolson', asignado_dni: '26555666', pendiente_desde: '2026-11-02' })] });
  const r = pedir(d, { accion: 'sede', token: entrar(d, '25111222', '0907') });
  assert.deepEqual(r.data.alertas.map(t => t.id), ['online']);
  assert.equal(r.data.personas.find(p => p.dni === '30123456').pendientes, 1);
});

test('sede: permisos', () => {
  const d = equipo({ tareas: [] });
  assert.equal(pedir(d, { accion: 'sede', token: entrar(d) }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'sede', token: entrar(d, '25111222', '0907'), sede: 'puelo' }).error, 'prohibido');
  const adm = entrar(d, '20000001', '0907');
  assert.equal(pedir(d, { accion: 'sede', token: adm, sede: 'esquel' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'sede', token: adm }).data.sede, 'bolson');   // sin sede pedida: la suya
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

// ---------- Rendimiento y registro manual ----------

test('registrar: valida, no duplica y una consulta crea su seguimiento', () => {
  const d = equipo({ tareas: [], actividad: [] });
  const token = entrar(d);
  assert.equal(pedir(d, { accion: 'registrar', token, id: 'a', tipo: 'otra', nombre: 'X' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'registrar', token, id: 'a', tipo: 'mensaje' }).error, 'datos_invalidos');
  assert.ok(pedir(d, { accion: 'registrar', token, id: 'm1', tipo: 'mensaje', nombre: 'Socio', categoria: 'Deuda', canal: 'MP' }).ok);
  assert.ok(pedir(d, { accion: 'registrar', token, id: 'm1', tipo: 'mensaje', nombre: 'Socio', categoria: 'Deuda', canal: 'MP' }).ok);
  assert.equal(d.repo.hojas.actividad.length, 1);
  assert.equal(pedir(d, { accion: 'registrar', token, id: 'c0', tipo: 'consulta', nombre: 'Ana' }).error, 'datos_invalidos');
  assert.ok(pedir(d, { accion: 'registrar', token, id: 'c1', tipo: 'consulta', nombre: 'Ana', interes: 'medio', origen: 'Instagram', detalle: 'Kine' }).ok);
  const t = d.repo.hojas.tareas[0];
  assert.equal(t.tipo, 'Seguimiento de consulta');
  assert.equal(t.fecha, '2026-11-11');          // medio: a las 48 horas
  assert.equal(t.asignado_dni, '30123456');
  assert.equal(t.socio_id, 'consulta-c1');
  assert.equal(pedir(d, { accion: 'mis_tareas', token }).data.tareas.length, 0);   // todavía no le toca
  d.dia = '2026-11-11';
  assert.equal(pedir(d, { accion: 'mis_tareas', token }).data.tareas.length, 1);
});

test('rendimiento: mezcla lo calculado con lo que pasa en la app', () => {
  const d = equipo({
    tareas: [
      tarea({ id: 'a', estado: 'hecha', pendiente_desde: '2026-11-09', hecha_en: '2026-11-09T15:00:00.000Z' }),
      tarea({ id: 'b', estado: 'hecha', pendiente_desde: '2026-11-05', fecha: '2026-11-05', hecha_en: '2026-11-09T15:00:00.000Z' }),
      tarea({ id: 'c' }), tarea({ id: 'd', estado: 'cerrada' }), tarea({ id: 'x', asignado_dni: '28999888' }),
    ],
    registro: [
      { ts: '2026-11-09T15:00:00.000Z', dni: '30123456', tipo: 'Riesgo alto', canal: 'LL', resultado: 'RESERVA' },
      { ts: '2026-11-09T15:00:00.000Z', dni: '30123456', tipo: 'Riesgo alto', canal: 'MP', resultado: 'NO CONTESTA' },
      { ts: '2026-11-09T15:00:00.000Z', dni: '30123456', tipo: 'Riesgo alto', canal: 'SIN CONTACTO', resultado: 'NO CONTESTA' },
      { ts: '2026-10-09T15:00:00.000Z', dni: '30123456', tipo: 'Riesgo alto', canal: 'LL', resultado: 'RESERVA' },
    ],
    actividad: [{ id: '1', ts: '2026-11-09T15:00:00.000Z', dni: '30123456', tipo: 'mensaje' }, { id: '2', ts: '2026-11-09T15:00:00.000Z', dni: '30123456', tipo: 'consulta' },
                { id: '3', ts: '2026-11-09T15:00:00.000Z', dni: '30123456', tipo: 'resena' }],
    rendimiento: [{ mes: '2026-11', dni: '30123456', datos: JSON.stringify({ nuevos: 2, mostrador_monto: 5000 }), actualizado: '2026-11-09' }],
    objetivos: [],
  });
  const r = pedir(d, { accion: 'rendimiento', token: entrar(d), mes: '2026-11' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.personas.length, 1);
  const v = r.data.personas[0].valores;
  assert.equal(v.tareas_pct, 2 / 3);
  assert.equal(v.a_tiempo_pct, 1 / 2);
  assert.equal(v.mensajes, 3);          // dos de tareas y uno suelto; SIN CONTACTO no cuenta
  assert.equal(v.contacto_pct, 1 / 3);
  assert.equal(v.consultas, 1);
  assert.equal(v.conversion, 1);
  assert.equal(v.resenas, 1);
  assert.equal(v.nuevos, 2);
  assert.ok(r.data.personas[0].puntaje.total > 0);
});

test('rendimiento: permisos y objetivos por persona', () => {
  const d = equipo({ tareas: [], actividad: [], rendimiento: [], objetivos: [] });
  const rec = entrar(d);
  assert.equal(pedir(d, { accion: 'rendimiento', token: rec, dni: '28999888' }).error, 'prohibido');
  const coord = pedir(d, { accion: 'rendimiento', token: entrar(d, '25111222', '0907') });
  assert.deepEqual(coord.data.personas.map(p => p.dni).sort(), ['25111222', '28999888', '30123456']);
  assert.equal(pedir(d, { accion: 'rendimiento', token: entrar(d, '25111222', '0907'), sede: 'puelo' }).error, 'prohibido');
  const adm = entrar(d, '20000001', '0907');
  assert.deepEqual(pedir(d, { accion: 'rendimiento', token: adm, sede: 'puelo' }).data.personas.map(p => p.dni), ['26555666']);
  assert.equal(pedir(d, { accion: 'objetivos_guardar', token: rec, dni: '30123456', valores: { nuevos: 5 } }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'objetivos_guardar', token: adm, dni: '30123456', valores: { inventado: 5 } }).error, 'datos_invalidos');
  assert.ok(pedir(d, { accion: 'objetivos_guardar', token: adm, dni: '30123456', valores: { nuevos: 5 } }).ok);
  assert.ok(pedir(d, { accion: 'objetivos_guardar', token: adm, dni: '30123456', valores: { nuevos: 7 } }).ok);
  assert.equal(d.repo.hojas.objetivos.length, 1);
  const f = pedir(d, { accion: 'rendimiento', token: rec }).data.personas[0].puntaje.filas.find(x => x.clave === 'nuevos');
  assert.equal(f.objetivo, 7);
});

test('cargar_rendimiento reemplaza el mes de esa persona', () => {
  const d = equipo({ rendimiento: [{ mes: '2026-11', dni: '1', datos: '{}', actualizado: 'x' }, { mes: '2026-10', dni: '1', datos: '{}', actualizado: 'x' }] });
  assert.equal(pedir(d, { accion: 'cargar_rendimiento', clave: 'mala', mes: '2026-11', filas: [] }).error, 'clave');
  assert.ok(pedir(d, { accion: 'cargar_rendimiento', clave: 'clave-prueba', mes: '2026-11', filas: [{ dni: '1', datos: { nuevos: 3 } }] }).ok);
  assert.equal(d.repo.hojas.rendimiento.length, 2);
  assert.equal(JSON.parse(d.repo.hojas.rendimiento.find(x => x.mes === '2026-11').datos).nuevos, 3);
});

// ---------- Plata, tiempos, adelantar, cierre, respaldo ----------

test('rendimiento: la plata solo la ve quien coordina', () => {
  const d = equipo({ tareas: [], actividad: [], objetivos: [], rendimiento: [{ mes: '2026-11', dni: '30123456', datos: JSON.stringify({ nuevos: 2, mostrador_monto: 5000, cobros_plan_monto: 9, cobros_plan: 3, mostrador: 1, bar: 1 }), actualizado: 'x' }] });
  const propia = pedir(d, { accion: 'rendimiento', token: entrar(d) }).data.personas[0].valores;
  for (const k of ['mostrador_monto', 'cobros_plan_monto', 'cobros_plan', 'mostrador', 'bar']) assert.ok(!(k in propia), k);
  assert.equal(propia.nuevos, 2);
  const coord = pedir(d, { accion: 'rendimiento', token: entrar(d, '25111222', '0907') }).data.personas.find(p => p.dni === '30123456').valores;
  assert.equal(coord.mostrador_monto, 5000);
});

test('marcar guarda cuánto tardó y si la adelantó', () => {
  const d = equipo({ tareas: [tarea({}), tarea({ id: 'T2', socio_id: '502', fecha: '2026-11-10', pendiente_desde: '2026-11-10' })] });
  const token = entrar(d);
  const m = { accion: 'marcar', token, canal: 'LL', resultado: 'RESERVA' };
  assert.ok(pedir(d, { ...m, tarea_id: 'T1', id_marca: 'a', abierta_en: new Date(d.t - 90000).toISOString() }).ok);
  assert.equal(d.repo.hojas.registro[0].segundos, '90');
  assert.equal(d.repo.hojas.registro[0].adelantada, '');
  assert.ok(pedir(d, { ...m, tarea_id: 'T2', id_marca: 'b', abierta_en: new Date(d.t - 99999000).toISOString() }).ok);
  assert.equal(d.repo.hojas.registro[1].segundos, '');       // más de 2 horas: se dejó abierta, no cuenta
  assert.equal(d.repo.hojas.registro[1].adelantada, '1');
});

test('mis_tareas: las de mañana se piden aparte', () => {
  const d = equipo({ tareas: [tarea({}), tarea({ id: 'T2', fecha: '2026-11-10', pendiente_desde: '2026-11-10' })] });
  const token = entrar(d);
  const r = pedir(d, { accion: 'mis_tareas', token }).data;
  assert.deepEqual(r.tareas.map(t => t.id), ['T1']);
  assert.equal(r.para_adelantar, 1);
  assert.deepEqual(pedir(d, { accion: 'mis_tareas', token, adelantar: true }).data.tareas.map(t => t.id).sort(), ['T1', 'T2']);
});

test('mi_dia: saludo, puntos, racha, coach y lo que hizo hoy', () => {
  const hoyHecha = '2026-11-09T15:00:00.000Z';
  const d = equipo({ tareas: [tarea({ estado: 'hecha', hecha_en: hoyHecha }), tarea({ id: 'T2', pendiente_desde: '2026-11-05', fecha: '2026-11-05' }), tarea({ id: 'V', estado: 'hecha', fecha: '2026-11-06', pendiente_desde: '2026-11-06', hecha_en: '2026-11-06T15:00:00.000Z' })],
    registro: [{ ts: hoyHecha, dni: '30123456', canal: 'LL', resultado: 'RESERVA', tipo: 'x' }], actividad: [], cierres: [], objetivos: [], rendimiento: [{ mes: '2026-11', dni: '30123456', datos: JSON.stringify({ dias_sin_plan_largo: 4, nuevos: 1 }), actualizado: 'x' }] });
  const r = pedir(d, { accion: 'mi_dia', token: entrar(d) });
  assert.ok(r.ok, JSON.stringify(r));
  assert.match(r.data.saludo, /Hola Ana/);
  assert.equal(r.data.hoy.hechas, 1);
  assert.equal(r.data.hoy.pendientes, 1);
  assert.equal(r.data.hoy.atrasadas, 1);
  assert.equal(r.data.hoy.mensajes, 1);
  assert.equal(r.data.hoy.consultas, 0);
  assert.equal(r.data.racha, 2);
  assert.ok(r.data.puntos >= 6);
  assert.ok(r.data.coach.some(m => m.clave === 'plan'));
  assert.equal(r.data.cierre_hecho, false);
});

test('cierre de turno: guarda, avisa y respeta permisos', () => {
  const d = equipo({ tareas: [], actividad: [], cierres: [], objetivos: [], rendimiento: [] });
  const token = entrar(d);
  assert.equal(pedir(d, { accion: 'cierre_guardar', token, animo: 9 }).error, 'datos_invalidos');
  assert.ok(pedir(d, { accion: 'cierre_guardar', token, animo: 4, respuestas: { consultas: 'No vino nadie' }, comentario: 'Bien' }).ok);
  assert.ok(pedir(d, { accion: 'cierre_guardar', token, animo: 5 }).ok);    // el segundo reemplaza al primero del día
  assert.equal(d.repo.hojas.cierres.length, 1);
  assert.equal(d.repo.hojas.cierres[0].animo, '5');
  assert.equal(pedir(d, { accion: 'mi_dia', token }).data.cierre_hecho, true);
  assert.equal(pedir(d, { accion: 'cierres_ver', token }).error, 'prohibido');
  assert.equal(pedir(d, { accion: 'cierres_ver', token: entrar(d, '25111222', '0907') }).data.cierres.length, 1);
  assert.equal(pedir(d, { accion: 'cierres_ver', token: entrar(d, '25333444', '0907') }).data.cierres.length, 0);
  assert.equal(pedir(d, { accion: 'cierres_ver', token: entrar(d, '20000001', '0907') }).data.cierres[0].nombre, 'Ana Prueba');
});

test('respaldo: exige clave y nunca incluye hash ni sal', () => {
  const d = equipo({ tareas: [tarea({})], actividad: [], cierres: [], objetivos: [], rendimiento: [] });
  assert.equal(pedir(d, { accion: 'respaldo' }).error, 'clave');
  const r = pedir(d, { accion: 'respaldo', clave: 'clave-prueba' }).data;
  assert.equal(r.tareas.length, 1);
  assert.ok(r.usuarios.length > 0);
  for (const u of r.usuarios) assert.ok(!('pin_hash' in u) && !('sal' in u));
});

test('tiempos en rendimiento para quien coordina', () => {
  const d = equipo({ tareas: [], actividad: [], objetivos: [], rendimiento: [], cierres: [],
    registro: [{ ts: '2026-11-09T12:00:00.000Z', dni: '30123456', canal: 'LL', resultado: 'RESERVA', tipo: 'x', segundos: '60' },
               { ts: '2026-11-09T14:30:00.000Z', dni: '30123456', canal: 'LL', resultado: 'RESERVA', tipo: 'x', segundos: '120' },
               { ts: '2026-11-06T12:00:00.000Z', dni: '30123456', canal: 'LL', resultado: 'RESERVA', tipo: 'x', segundos: '' }] });
  const v = pedir(d, { accion: 'rendimiento', token: entrar(d, '25111222', '0907') }).data.personas.find(p => p.dni === '30123456').tiempos;
  assert.equal(v.segundos_promedio, 90);
  assert.deepEqual(v.por_dia.map(x => [x.fecha, x.marcas]), [['2026-11-06', 1], ['2026-11-09', 2]]);
  const hoy = v.por_dia[1];
  assert.equal(hoy.primera, '09:00');
  assert.equal(hoy.ultima, '11:30');
  assert.equal(v.por_hora[9], 2);
  assert.equal(v.por_hora[11], 1);
});

// ---------- Profes: recordatorio sin marcar y llegada automática ----------

test('Profes de hoy no se marca ni cuenta como tarea', () => {
  const d = equipo({ tareas: [tarea({ id: 'P', tipo: 'Profes de hoy', socio_nombre: 'Profe Sol' }), tarea({})], actividad: [], cierres: [], objetivos: [], rendimiento: [] });
  const token = entrar(d);
  assert.equal(pedir(d, { accion: 'marcar', token, tarea_id: 'P', id_marca: 'x', canal: 'PR', resultado: 'HECHO' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'mi_dia', token }).data.hoy.pendientes, 1);
  assert.equal(pedir(d, { accion: 'rendimiento', token }).data.personas[0].valores.tareas_total, 1);
  assert.equal(pedir(d, { accion: 'sede', token: entrar(d, '25111222', '0907') }).data.personas.find(p => p.dni === '30123456').pendientes, 1);
  assert.equal(pedir(d, { accion: 'mis_tareas', token }).data.tareas.length, 2);   // la ve como recordatorio
});

test('llegada de profes: solo coordinación, por sede', () => {
  const fila = (sede, estado) => ({ fecha: '2026-11-03', sede, profe_id: '5', profe: 'Sol', clase: '08:00', qr: '07:40', estado });
  const d = equipo({ tareas: [], profes: [] });
  assert.equal(pedir(d, { accion: 'cargar_profes', clave: 'mala', filas: [] }).error, 'clave');
  assert.ok(pedir(d, { accion: 'cargar_profes', clave: 'clave-prueba', filas: [fila('bolson', 'a_tiempo'), fila('puelo', 'sin_qr')] }).ok);
  assert.equal(pedir(d, { accion: 'profes_ver', token: entrar(d) }).error, 'prohibido');
  assert.deepEqual(pedir(d, { accion: 'profes_ver', token: entrar(d, '25111222', '0907') }).data.filas.map(f => f.sede), ['bolson']);
  assert.deepEqual(pedir(d, { accion: 'profes_ver', token: entrar(d, '20000001', '0907'), sede: 'puelo' }).data.filas.map(f => f.estado), ['sin_qr']);
  assert.ok(pedir(d, { accion: 'cargar_profes', clave: 'clave-prueba', filas: [fila('bolson', 'tarde')] }).ok);
  assert.equal(d.repo.hojas.profes.length, 1);    // cada carga reemplaza la anterior
});

test('reasignar_tareas cambia de persona solo lo pendiente y conserva fechas', () => {
  const d = equipo({ tareas: [tarea({ pendiente_desde: '2026-11-05' }), tarea({ id: 'H', socio_id: '502', estado: 'hecha' }), tarea({ id: 'O', socio_id: '503' })] });
  assert.equal(pedir(d, { accion: 'reasignar_tareas', clave: 'mala', cambios: [] }).error, 'clave');
  const cambios = [{ sede: 'bolson', socio_id: '501', asignado_dni: '28999888' }, { sede: 'bolson', socio_id: '502', asignado_dni: '28999888' }];
  assert.equal(pedir(d, { accion: 'reasignar_tareas', clave: 'clave-prueba', cambios }).data.reasignadas, 1);
  const [a, h, o] = d.repo.hojas.tareas;
  assert.equal(a.asignado_dni, '28999888');
  assert.equal(a.pendiente_desde, '2026-11-05');
  assert.equal(h.asignado_dni, '30123456');
  assert.equal(o.asignado_dni, '30123456');
});

test('admin que además es recepcionista: ve todo y conserva su lista', () => {
  const lucia = usuario({ dni: '24000000', nombre: 'Luz Prueba', pin: '0907', roles: 'recepcion,coordinador,admin' });
  const d = entorno([lucia, usuario(), usuario({ dni: '26555666', nombre: 'Ceci Puelo', pin: '0907', sede: 'puelo' })], { tareas: [tarea({ asignado_dni: '24000000' })], registro: [], actividad: [], garantia: [], rendimiento: [], objetivos: [], cierres: [], profes: [] });
  const token = entrar(d, '24000000', '0907');
  assert.equal(pedir(d, { accion: 'mis_tareas', token }).data.tareas.length, 1);
  assert.ok(pedir(d, { accion: 'mi_dia', token }).ok);
  assert.deepEqual(pedir(d, { accion: 'rendimiento', token, sede: 'puelo' }).data.personas.map(p => p.dni), ['26555666']);
  assert.ok(pedir(d, { accion: 'rendimiento', token, sede: 'bolson' }).data.personas.some(p => p.dni === '24000000'));
  assert.ok(pedir(d, { accion: 'sede', token, sede: 'puelo' }).ok);
  assert.ok(pedir(d, { accion: 'tareas_de', token, dni: '26555666' }).ok);
  assert.ok(pedir(d, { accion: 'usuarios_listar', token }).ok);
  assert.ok(pedir(d, { accion: 'cierres_ver', token }).ok);
  assert.ok(pedir(d, { accion: 'profes_ver', token, sede: 'puelo' }).ok);
});

test('tiempos: tareas por hora y lo que le quedaba del turno', () => {
  const u = { ...usuario(), hora_fin: '14:00' };
  const d = entorno([u, usuario({ dni: '25111222', nombre: 'Coord', pin: '0907', roles: 'recepcion,coordinador' })], { tareas: [], actividad: [], objetivos: [], rendimiento: [], cierres: [],
    registro: [{ ts: '2026-11-06T12:00:00.000Z', dni: '30123456', canal: 'LL', resultado: 'RESERVA', tipo: 'x', segundos: '120' },
               { ts: '2026-11-06T13:00:00.000Z', dni: '30123456', canal: 'LL', resultado: 'RESERVA', tipo: 'x', segundos: '60' },
               { ts: '2026-11-06T14:00:00.000Z', dni: '30123456', canal: 'LL', resultado: 'RESERVA', tipo: 'x', segundos: '' }] });
  const t = pedir(d, { accion: 'rendimiento', token: entrar(d, '25111222', '0907') }).data.personas.find(p => p.dni === '30123456').tiempos;
  const dia = t.por_dia[0];
  assert.equal(dia.por_hora, 1.5);        // 3 marcas en 2 horas
  assert.equal(dia.minutos_libres, 180);  // última 11:00, turno hasta las 14:00
  assert.equal(dia.minutos_en_tareas, 3);
});

test('mi_dia: datos para los avisos personalizados', () => {
  const d = equipo({ actividad: [], cierres: [], objetivos: [], rendimiento: [], tareas: [
    tarea({ id: 'A', socio_nombre: 'Primero', prioridad: '1', situacion: 'Hace 18 días' }), tarea({ id: 'B', socio_nombre: 'Segundo', prioridad: '5' }),
    tarea({ id: 'F', fecha: '2026-11-10', pendiente_desde: '2026-11-10' }),
    tarea({ id: 'Y', estado: 'hecha', fecha: '2026-11-06', pendiente_desde: '2026-11-06', hecha_en: '2026-11-06T15:00:00.000Z' })] });
  const r = pedir(d, { accion: 'mi_dia', token: entrar(d) }).data;
  assert.equal(r.siguiente.nombre, 'Primero');
  assert.equal(r.ayer, 1);
  assert.equal(r.para_adelantar, 1);
});

test('a quien le dieron más permisos con la sesión abierta no le falla nada', () => {
  const lucia = usuario({ dni: '24000000', nombre: 'Luz Prueba', pin: '0907', roles: 'recepcion,coordinador' });
  const d = entorno([lucia, usuario()], { tareas: [], registro: [], actividad: [], garantia: [], rendimiento: [], objetivos: [], cierres: [], profes: [] });
  const token = entrar(d, '24000000', '0907');
  d.repo.hojas.usuarios[0].roles = 'recepcion,coordinador,admin';
  assert.ok(pedir(d, { accion: 'sede', token }).ok);
  assert.ok(pedir(d, { accion: 'rendimiento', token }).ok);
  assert.ok(pedir(d, { accion: 'profes_ver', token }).ok);
  assert.deepEqual(pedir(d, { accion: 'mi_dia', token }).data.roles, ['recepcion', 'coordinador', 'admin']);
});

const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const BELEN = usuario({ dni: '20111222', nombre: 'Belén Juárez', roles: 'profe', sede: 'bolson' });
const ENZO = usuario({ dni: '20333444', nombre: 'Enzo Legammari', roles: 'profe', sede: 'bolson' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación', roles: 'coordinador', sede: 'bolson' });
const OTRA = usuario({ dni: '20666777', nombre: 'Coord Puelo', roles: 'coordinador', sede: 'puelo' });

function entorno(hoy = '2026-11-16') {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [BELEN, ENZO, COORD, OTRA] }), hoy, ahora: Date.parse(hoy + 'T15:00:00Z') });
  L.manejar({ accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy, tareas: [
    { id: 'pp-1', fecha: hoy, sede: 'bolson', profe: 'Belen Juarez', profe_dni: '20111222', socio_id: '1', socio_nombre: 'Ana', tipo: 'Renovar plan', accion: 'x', vence: hoy, alta: '' },
    { id: 'pp-2', fecha: hoy, sede: 'bolson', profe: 'Enzo Legammari', profe_dni: '20333444', socio_id: '2', socio_nombre: 'Juan', tipo: 'Renovar plan', accion: 'x', vence: hoy, alta: '' }] }, d);
  return d;
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;

test('coordinación carga vacaciones con reemplazo; el reemplazo ve y marca los planes', () => {
  const d = entorno();
  const tc = entrar(d, '20555666');
  const a = pedir(d, { accion: 'profe_ausencia_guardar', token: tc, profe_dni: '20111222', desde: '2026-11-16', hasta: '2026-11-27', tipo: 'vacaciones', reemplazo_dni: '20333444' }).data.ausencia;
  assert.equal(a.reemplazo, 'Enzo Legammari');
  // se superpone: no
  assert.equal(pedir(d, { accion: 'profe_ausencia_guardar', token: tc, profe_dni: '20111222', desde: '2026-11-20', hasta: '2026-11-30' }).error, 'ya_anotado');
  // coordinación de otra sede también puede (Emanuel, 26/11/2026)
  const o = pedir(d, { accion: 'profe_ausencia_guardar', token: entrar(d, '20666777'), profe_dni: '20111222', desde: '2026-12-01', hasta: '2026-12-02' }).data.ausencia;
  pedir(d, { accion: 'profe_ausencia_guardar', token: tc, borrar: o.id });
  // Belén ve su aviso; Enzo ve lo que cubre
  assert.equal(pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.ausencia.reemplazo, 'Enzo Legammari');
  const te = entrar(d, '20333444');
  const cub = pedir(d, { accion: 'profe_tareas', token: te }).data.mio.cubriendo;
  assert.equal(cub.length, 1);
  assert.equal(cub[0].hoy[0].socio_nombre, 'Ana');
  // Enzo marca el plan de Belén: queda a su nombre
  assert.equal(pedir(d, { accion: 'profe_marcar', token: te, id: 'pp-1' }).ok, true);
  assert.equal(d.repo.hojas.profe_tareas.find(t => t.id === 'pp-1').hecha_dni, '20333444');
  const eq = pedir(d, { accion: 'profe_tareas', token: tc }).data.equipo;
  assert.equal(eq.find(p => p.profe === 'Enzo Legammari').cubrio_mes, 1);
  assert.equal(eq.find(p => p.profe === 'Belen Juarez').ausente.tipo, 'vacaciones');
  // la PC las lee con la clave
  assert.equal(pedir(d, { accion: 'profe_ausencias', clave: PROPS.CLAVE_CARGA }).data.ausencias.length, 1);
  // borrar
  assert.equal(pedir(d, { accion: 'profe_ausencia_guardar', token: tc, borrar: a.id }).data.borrada, a.id);
  assert.equal(pedir(d, { accion: 'profe_marcar', token: te, id: 'pp-1', hecha: false }).error, 'prohibido');   // ya no cubre
});

test('sin reemplazo nadie más marca; los sábados no se le asignan mientras está de vacaciones', () => {
  const d = entorno();
  const tc = entrar(d, '20555666');
  pedir(d, { accion: 'cargar_profe_horarios', clave: PROPS.CLAVE_CARGA, filas: [
    { profe: 'Belén Juárez', sede: 'bolson', dias: '0-4', desde: '07:00', hasta: '13:30' }, { profe: 'Enzo Legammari', sede: 'bolson', dias: '0-4', desde: '13:30', hasta: '20:00' }] });
  pedir(d, { accion: 'profe_ausencia_guardar', token: tc, profe_dni: '20111222', desde: '2026-11-16', hasta: '2026-11-29', tipo: 'vacaciones' });
  assert.equal(pedir(d, { accion: 'profe_marcar', token: entrar(d, '20333444'), id: 'pp-1' }).error, 'prohibido');
  pedir(d, { accion: 'profe_sabados_generar', token: tc, sede: 'bolson' });
  const sab = d.repo.hojas.profe_sabados.filter(s => s.fecha <= '2026-11-29').map(s => s.profe);
  assert.deepEqual(sab, ['Enzo Legammari', 'Enzo Legammari']);    // 21 y 28: Belén está de vacaciones
});

test('estado del gym: lo sube la PC y lo ve coordinación (cada coordinador su sede)', () => {
  const d = entorno();
  const filas = [{ clave: 'sede:bolson', tipo: 'sede', nombre: 'El Bolsón', sede: 'bolson', datos: { '2026-10': { activos: 300, desercion: 20 } } },
    { clave: 'sede:puelo', tipo: 'sede', nombre: 'Lago Puelo', sede: 'puelo', datos: { '2026-10': { activos: 200 } } }];
  assert.equal(pedir(d, { accion: 'cargar_profe_estado', clave: 'mal', filas }).error, 'clave');
  assert.deepEqual(pedir(d, { accion: 'cargar_profe_estado', clave: PROPS.CLAVE_CARGA, filas }).data, { filas: 2 });
  const r = pedir(d, { accion: 'profe_estado', token: entrar(d, '20555666') }).data;
  assert.deepEqual(r.filas.map(f => f.sede), ['bolson']);
  assert.equal(r.filas[0].datos['2026-10'].activos, 300);
  assert.equal(pedir(d, { accion: 'profe_estado', token: entrar(d, '20111222') }).error, 'prohibido');
});

const SOL = usuario({ dni: '20777888', nombre: 'Sol Prueba', roles: 'profe', sede: 'puelo' });

test('dos profes cubren a uno, cada uno con sus días y su franja; avisa 5 días antes', () => {
  const d = entorno();
  d.repo.hojas.usuarios.push(Object.assign({}, SOL));
  const tc = entrar(d, '20555666');
  const base = { accion: 'profe_ausencia_guardar', token: tc, profe_dni: '20111222', desde: '2026-11-23', hasta: '2026-11-27', tipo: 'vacaciones' };
  // franja a medias, días fuera de la ausencia o cubrirse a sí mismo: no
  assert.equal(pedir(d, Object.assign({}, base, { cubren: [{ profe_dni: '20333444', hora_desde: '08:00' }] })).error, 'datos_invalidos');
  assert.equal(pedir(d, Object.assign({}, base, { cubren: [{ profe_dni: '20333444', desde: '2026-11-20' }] })).error, 'datos_invalidos');
  assert.equal(pedir(d, Object.assign({}, base, { cubren: [{ profe_dni: '20111222' }] })).error, 'datos_invalidos');
  const a = pedir(d, Object.assign({}, base, { cubren: [{ profe_dni: '20333444', hora_desde: '08:00', hora_hasta: '12:00' }] })).data.ausencia;
  assert.equal(a.cubren.length, 1);
  assert.equal(a.cubren[0].desde, '2026-11-23');
  assert.equal(a.cubren[0].hasta, '2026-11-27');
  // después se le agrega otro
  const b = pedir(d, { accion: 'profe_ausencia_guardar', token: tc, id: a.id, cubren: a.cubren.concat([{ profe_dni: '20777888', desde: '2026-11-26', hasta: '2026-11-27', hora_desde: '12:00', hora_hasta: '16:00' }]) }).data.ausencia;
  assert.equal(b.reemplazo, 'Enzo Legammari y Sol Prueba');
  assert.equal(b.cubren.length, 2);
  // 16/11: faltan 7 días, todavía no avisa
  assert.equal(pedir(d, { accion: 'profe_tareas', token: entrar(d, '20333444') }).data.mio.avisos_cubrir.length, 0);
  // 18/11: faltan 5, avisa
  const antes = Object.assign({}, d, { hoy: () => '2026-11-18', ahora: () => Date.parse('2026-11-18T15:00:00Z') });
  const av = pedir(antes, { accion: 'profe_tareas', token: entrar(antes, '20333444') }).data.mio.avisos_cubrir;
  assert.deepEqual(av, [{ profe: 'Belén Juárez', sede: 'bolson', desde: '2026-11-23', hasta: '2026-11-27', hora_desde: '08:00', hora_hasta: '12:00' }]);
  // 23/11: Enzo cubre, Sol todavía no
  const lunes = Object.assign({}, d, { hoy: () => '2026-11-23', ahora: () => Date.parse('2026-11-23T15:00:00Z') });
  assert.equal(pedir(lunes, { accion: 'profe_tareas', token: entrar(lunes, '20333444') }).data.mio.cubriendo.length, 1);
  assert.equal(pedir(lunes, { accion: 'profe_tareas', token: entrar(lunes, '20777888') }).data.mio.cubriendo.length, 0);
  assert.equal(pedir(lunes, { accion: 'profe_marcar', token: entrar(lunes, '20777888'), id: 'pp-1' }).error, 'prohibido');
  // 26/11: los dos
  const jueves = Object.assign({}, d, { hoy: () => '2026-11-26', ahora: () => Date.parse('2026-11-26T15:00:00Z') });
  const cs = pedir(jueves, { accion: 'profe_tareas', token: entrar(jueves, '20777888') }).data.mio.cubriendo;
  assert.equal(cs.length, 1);
  assert.equal(cs[0].franja, '12:00 a 16:00');
  assert.equal(pedir(jueves, { accion: 'profe_marcar', token: entrar(jueves, '20777888'), id: 'pp-1' }).ok, true);
  // se saca a todos: queda sin reemplazo
  const c = pedir(d, { accion: 'profe_ausencia_guardar', token: tc, id: a.id, cubren: [] }).data.ausencia;
  assert.deepEqual([c.reemplazo, c.reemplazo_dni, c.cubren.length], ['', '', 0]);
});

test('lo reemplazado se paga: horas en la liquidación de cada reemplazo (Emanuel, 26/11/2026)', () => {
  const d = entorno();
  d.repo.hojas.usuarios.push(Object.assign({}, SOL));
  const en = hoy => Object.assign({}, d, { hoy: () => hoy, ahora: () => Date.parse(hoy + 'T15:00:00Z') });
  const tc = entrar(d, '20555666');
  pedir(d, { accion: 'cargar_profe_horarios', clave: PROPS.CLAVE_CARGA, filas: [{ profe: 'Belén Juárez', sede: 'bolson', dias: '0-4', desde: '07:00', hasta: '13:30' }] });
  pedir(d, { accion: 'cargar_liqpro_config', clave: PROPS.CLAVE_CARGA, filas: [
    { tipo: 'persona', mes: '2026-11', dni: '20333444', datos: { tipo: 'profe', valor_hora: 1000, horas_mes: 10 } },
    { tipo: 'persona', mes: '2026-11', dni: '20777888', datos: { tipo: 'profe', valor_hora: 2000, horas_mes: 10 } }] });
  pedir(d, { accion: 'profe_ausencia_guardar', token: tc, profe_dni: '20111222', desde: '2026-11-23', hasta: '2026-12-02', tipo: 'vacaciones', cubren: [
    { profe_dni: '20333444', desde: '2026-11-23', hasta: '2026-11-25' },
    { profe_dni: '20777888', desde: '2026-11-26', hasta: '2026-12-02', hora_desde: '12:00', hora_hasta: '16:00' }] });
  const ver = (hoy, dni, mes) => { const dd = en(hoy); const p = pedir(dd, { accion: 'liqpro_ver', token: entrar(dd, dni), mes }).data.personas.find(x => x.dni === dni); return p.liquidacion; };
  // Enzo: 3 días del horario de Belén (6,5 h) = 19,5 h
  const e = ver('2026-11-30', '20333444', '2026-11');
  const l = e.lineas.find(x => x.k.indexOf('reemplazo') === 0);
  assert.equal(l.t, 'Reemplazaste a Belén Juárez');
  assert.equal(l.cant, 19.5);
  assert.equal(l.monto, 19500);
  assert.match(l.como, /19,5 h en 3 días \(23\/11, 24\/11, 25\/11\)/);
  assert.equal(e.total, 10000 + 19500);
  // Sol: solo lo que ya pasó (26, 27 y 30/11, el finde no cuenta) = 12 h; diciembre va a la liquidación de diciembre
  assert.equal(ver('2026-11-30', '20777888', '2026-11').lineas.find(x => x.k.indexOf('reemplazo') === 0).cant, 12);
  assert.equal(ver('2026-12-04', '20777888', '2026-12').lineas.find(x => x.k.indexOf('reemplazo') === 0).cant, 8);
  // antes de que pase no suma nada
  assert.equal(ver('2026-11-23', '20777888', '2026-11').lineas.some(x => x.k.indexOf('reemplazo') === 0), false);
  // coordinación ve las horas de cada reemplazo (todas las cargadas, sin plata)
  const aus = pedir(d, { accion: 'profe_tareas', token: tc }).data.agenda.ausencias[0];
  assert.deepEqual(aus.cubren.map(c => c.horas).join(), '19.5,20');
});

test('licencia paga o sin goce, y contador anual de vacaciones (Emanuel, 26/11/2026)', () => {
  const d = entorno();
  const REC = usuario({ dni: '20999000', nombre: 'Rocío Recepción', roles: 'recepcion', sede: 'bolson' });
  d.repo.hojas.usuarios.push(Object.assign({}, REC));
  const en = hoy => Object.assign({}, d, { hoy: () => hoy, ahora: () => Date.parse(hoy + 'T15:00:00Z') });
  const tc = entrar(d, '20555666');
  const guardar = x => pedir(d, Object.assign({ accion: 'profe_ausencia_guardar', token: tc }, x));
  pedir(d, { accion: 'cargar_profe_horarios', clave: PROPS.CLAVE_CARGA, filas: [{ profe: 'Belén Juárez', sede: 'bolson', dias: '0-4', desde: '08:00', hasta: '12:00' }] });
  pedir(d, { accion: 'cargar_liqpro_config', clave: PROPS.CLAVE_CARGA, filas: [{ tipo: 'persona', mes: '2026-11', dni: '20111222', datos: { tipo: 'profe', valor_hora: 1000, horas_mes: 80 } }] });
  // vacaciones cargadas de meses atrás (para el contador del año), pero no del año pasado
  assert.ok(guardar({ profe_dni: '20111222', desde: '2026-02-02', hasta: '2026-02-08', tipo: 'vacaciones' }).ok);
  assert.equal(guardar({ profe_dni: '20111222', desde: '2025-12-01', hasta: '2025-12-05', tipo: 'vacaciones' }).error, 'datos_invalidos');
  // licencia a cuenta de vacaciones: cuenta; sin goce: no cuenta y se descuenta
  assert.ok(guardar({ profe_dni: '20111222', desde: '2026-11-09', hasta: '2026-11-10', tipo: 'licencia', pago: 'vacaciones' }).ok);
  const sg = guardar({ profe_dni: '20111222', desde: '2026-11-11', hasta: '2026-11-12', tipo: 'licencia' }).data.ausencia;
  assert.equal(sg.pago, '');
  assert.equal(guardar({ id: sg.id, pago: 'cualquiera' }).error, 'datos_invalidos');
  assert.equal(guardar({ id: sg.id, pago: 'no_paga' }).data.ausencia.pago, 'no_paga');
  guardar({ profe_dni: '20111222', desde: '2026-12-28', hasta: '2027-01-08', tipo: 'vacaciones' });
  const mio = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.vacaciones;
  assert.equal(mio.anio, '2026');
  assert.deepEqual([mio.habiles, mio.corridos, mio.habiles_tomados, mio.habiles_por_venir, mio.sin_goce, mio.otras_pagas, mio.sin_definir], [11, 13, 7, 4, 2, 0, 0]);
  // en enero arranca de cero (solo lo que cae en el año nuevo)
  const enero = en('2027-01-04');
  assert.equal(pedir(enero, { accion: 'profe_tareas', token: entrar(enero, '20111222') }).data.mio.vacaciones.habiles, 6);
  // sin goce: 2 días de 4 h se le descuentan
  const liq = pedir(d, { accion: 'liqpro_ver', token: entrar(d, '20111222'), mes: '2026-11' }).data.personas[0].liquidacion;
  const l = liq.lineas.find(x => x.k === 'sin_goce');
  assert.deepEqual([l.t, l.grupo, l.cant, l.monto], ['Permiso no retribuido', 'descuentos', 8, -8000]);
  assert.equal(liq.total, 80000 - 8000);
  // coordinación ve el contador de todos
  const tabla = pedir(d, { accion: 'profe_tareas', token: tc }).data.agenda.vacaciones;
  assert.equal(tabla.find(x => x.nombre === 'Belén Juárez').habiles, 11);

  // recepción: se anota igual, sin reemplazo en este bloque; sin goce le descuenta horas de su liquidación
  assert.equal(guardar({ profe_dni: '20999000', desde: '2026-11-18', hasta: '2026-11-18', tipo: 'vacaciones', cubren: [{ profe_dni: '20333444' }] }).error, 'datos_invalidos');
  assert.ok(guardar({ profe_dni: '20999000', desde: '2026-11-18', hasta: '2026-11-19', tipo: 'vacaciones' }).ok);
  assert.ok(guardar({ profe_dni: '20999000', desde: '2026-11-23', hasta: '2026-11-24', tipo: 'licencia', pago: 'no_paga' }).ok);
  pedir(d, { accion: 'cargar_liquidacion', clave: PROPS.CLAVE_CARGA, filas: [{ dni: '20999000', mes: '2026-11', datos: { valor_hora: 100, horas: 120 } }, { dni: '20999000', mes: 'horas', datos: { dias: [6, 6, 6, 6, 6, 0, 0] } }] });
  const p = pedir(d, { accion: 'liquidacion_ver', token: entrar(d, '20999000'), mes: '2026-11' }).data.personas[0];
  assert.deepEqual([p.vacaciones.habiles, p.sin_goce.horas, p.liquidacion.horas], [2, 12, 108]);
});

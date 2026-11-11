const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const PROFE = usuario({ dni: '20111222', nombre: 'Profe Uno', roles: 'profe' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación', roles: 'coordinador' });
const h = (socio, seccion, extra = {}) => Object.assign({ id: `au-${socio}-${seccion}`, sede: 'bolson', profe: 'Profe Uno', profe_dni: '20111222', socio_id: String(socio),
  socio_nombre: 'Socio ' + socio, seccion, gravedad: 'a', texto: 'Día A: detallar series | Día B: falta el bloque de movilidad', cuantos: '2' }, extra);
const pt = (puntaje, extra = {}) => Object.assign({ profe: 'Profe Uno', profe_dni: '20111222', socios: '10', puntaje: String(puntaje), gestion: '60', diagnostico: '40', metodologia: '100', custom: '80', rpe: '90' }, extra);

function entorno(dia = '2026-11-11') {
  return depsFalsas({ repo: repoFalso({ usuarios: [PROFE, COORD] }), hoy: dia, ahora: Date.parse(dia + 'T15:00:00Z') });
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;
const cargar = (d, hallazgos, puntajes, auditados) => pedir(d, { accion: 'cargar_profe_auditoria', clave: PROPS.CLAVE_CARGA, hoy: d.dia, hallazgos, puntajes: puntajes || [], auditados: auditados || hallazgos.map(x => x.socio_id) });
const dia = (d, f) => { d.dia = f; d.t = Date.parse(f + 'T15:00:00Z'); };

test('el profe ve su puntaje, sus secciones y lo que tiene para corregir', () => {
  const d = entorno();
  assert.deepEqual(cargar(d, [h(1, 'custom'), h(2, 'gestion', { gravedad: 'r', texto: 'El plan no fue modificado, solo se le cambió la fecha (plan creado el 01/09/2026)' })], [pt(72)]).data,
    { nuevas: 2, corregidas: 0, no_corregidas: 0, abiertas: 2 });
  const a = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.auditoria;
  assert.deepEqual([a.puntaje, a.nivel], [72, 'mejorar']);
  assert.equal(a.secciones.find(s => s.seccion === 'diagnostico').puntaje, 40);
  assert.deepEqual(a.pendientes.map(x => x.socio_id), ['2', '1']);                     // lo grave primero
  assert.deepEqual(a.pendientes[1].detalle, ['Día A: detallar series', 'Día B: falta el bloque de movilidad']);
});

test('se cierra solo cuando la auditoría ya no lo encuentra', () => {
  const d = entorno();
  cargar(d, [h(1, 'custom'), h(2, 'custom')], [pt(70)]);
  dia(d, '2026-11-12');
  const r = cargar(d, [h(2, 'custom')], [pt(75)], ['1', '2']);
  assert.deepEqual([r.data.corregidas, r.data.abiertas], [1, 1]);
  assert.equal(d.repo.hojas.profe_auditoria.find(x => x.id === 'au-1-custom').estado, 'corregido');
  const a = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.auditoria;
  assert.equal(a.cuantos.corregidos_semana, 1);
  assert.equal(a.historia.length, 2);
  // si el socio no se auditó (se dio de baja), no cuenta como corregido
  dia(d, '2026-11-13');
  cargar(d, [], [], []);
  assert.equal(d.repo.hojas.profe_auditoria.find(x => x.id === 'au-2-custom').estado, 'cerrada');
});

test('dijo que lo corrigió y sigue: no corregido; y si vuelve, reapareció', () => {
  const d = entorno();
  cargar(d, [h(1, 'custom')]);
  const tk = entrar(d, '20111222');
  assert.equal(pedir(d, { accion: 'profe_auditoria_marcar', token: tk, id: 'au-1-custom' }).data.hallazgo.estado, 'marcada');
  assert.deepEqual(pedir(d, { accion: 'profe_auditoria_marcadas', clave: PROPS.CLAVE_CARGA }).data.socios, ['1']);   // la PC lo vuelve a mirar
  dia(d, '2026-11-12');
  assert.equal(cargar(d, [h(1, 'custom')]).data.no_corregidas, 1);
  assert.equal(d.repo.hojas.profe_auditoria[0].estado, 'no_corregido');
  dia(d, '2026-11-13');
  cargar(d, []);                                   // ahora sí lo corrigió
  dia(d, '2026-11-14');
  cargar(d, [h(1, 'custom')]);                     // y volvió a aparecer
  const x = d.repo.hojas.profe_auditoria.find(v => v.id === 'au-1-custom');
  assert.deepEqual([x.estado, x.reaparecio, x.fecha], ['pendiente', '1', '2026-11-14']);
});

test('coordinación ve el puntaje y lo que más se repite de cada profe', () => {
  const d = entorno();
  cargar(d, [h(1, 'custom'), h(2, 'custom', { texto: 'Día A: falta el bloque de movilidad' })], [pt(58)]);
  pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy: d.dia, tareas: [{ id: 'pp-1', fecha: d.dia, sede: 'bolson', profe: 'Profe Uno', profe_dni: '20111222', socio_id: '1', socio_nombre: 'Socio 1', tipo: 'Renovar plan', accion: 'x', vence: '2026-11-20' }] });
  const e = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20555666') }).data.equipo[0];
  assert.deepEqual([e.auditoria.puntaje, e.auditoria.nivel, e.auditoria.cuantos.pendientes], [58, 'critico', 2]);
  assert.deepEqual(e.auditoria.repetido[0], { que: 'falta el bloque de movilidad', veces: 2 });
});

test('cargar_profe_auditoria pide la clave y valida la sección', () => {
  const d = entorno();
  assert.equal(pedir(d, { accion: 'cargar_profe_auditoria', clave: 'mal', hoy: d.dia, hallazgos: [], puntajes: [], auditados: [] }).error, 'clave');
  assert.equal(cargar(d, [h(1, 'otra')]).error, 'datos_invalidos');
});

test('meta del día: pocas correcciones, después de los planes del día y sin lo que se corrige al renovar', () => {
  const d = entorno();
  pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy: d.dia, tareas: [1, 2, 3].map(n => ({ id: 'pp-' + n, fecha: '2026-11-11', sede: 'bolson', profe: 'Profe Uno', profe_dni: '20111222',
    socio_id: String(n), socio_nombre: 'Socio ' + n, tipo: 'Renovar plan', accion: 'Renovarlo', vence: '2026-11-12', alta: '' })) });
  cargar(d, [1, 5, 6, 7, 8, 9, 10].map(n => h(n, 'custom')), [pt(70)]);
  const A = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.auditoria;
  // 3 planes hoy = 36 min; quedan 24 min = 4 correcciones (el máximo)
  assert.deepEqual([A.dia.planes_hoy, A.dia.min_quedan, A.dia.meta, A.dia.al_renovar], [3, 24, 4, 1]);
  assert.equal(A.dia.lista.length, 4);
  assert.ok(A.dia.lista.every(x => x.socio_id !== '1'));            // el socio 1 renueva hoy: se corrige con el plan nuevo
  assert.ok(A.pendientes.find(x => x.socio_id === '1').al_renovar);
});

test('prefiero dejarlo así pide motivo, queda para coordinación y no vuelve a aparecer', () => {
  const d = entorno();
  pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy: d.dia, tareas: [{ id: 'pp-9', fecha: '2026-11-30', sede: 'bolson', profe: 'Profe Uno', profe_dni: '20111222',
    socio_id: '9', socio_nombre: 'Socio 9', tipo: 'Renovar plan', accion: 'Renovarlo', vence: '2026-12-01', alta: '' }] });
  cargar(d, [h(1, 'custom'), h(2, 'custom')], [pt(70)]);
  const tok = entrar(d, '20111222');
  assert.equal(pedir(d, { accion: 'profe_auditoria_marcar', token: tok, id: 'au-1-custom', que: 'dejar', motivo: '' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'profe_auditoria_marcar', token: tok, id: 'au-1-custom', que: 'dejar', motivo: 'Es lo que necesita este socio' }).data.hallazgo.estado, 'dejada');
  let A = pedir(d, { accion: 'profe_tareas', token: tok }).data.mio.auditoria;
  assert.equal(A.dia.hechas, 1);
  assert.deepEqual(A.pendientes.map(x => x.socio_id), ['2']);
  assert.equal(A.dejadas[0].motivo, 'Es lo que necesita este socio');
  // la auditoría de la noche lo vuelve a encontrar: sigue dejada, con su motivo
  dia(d, '2026-11-12');
  cargar(d, [h(1, 'custom'), h(2, 'custom')], [pt(70)]);
  const fila = d.repo.hojas.profe_auditoria.find(x => x.id === 'au-1-custom');
  assert.deepEqual([fila.estado, fila.motivo], ['dejada', 'Es lo que necesita este socio']);
  const eq = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20555666') }).data.equipo[0];
  assert.equal(eq.auditoria.cuantos.dejadas, 1);
  // deshacer la devuelve a pendiente
  assert.equal(pedir(d, { accion: 'profe_auditoria_marcar', token: entrar(d, '20111222'), id: 'au-1-custom', que: 'deshacer' }).data.hallazgo.estado, 'pendiente');
});

test('otro día la saca de la meta hasta el próximo día hábil', () => {
  const d = entorno();
  cargar(d, [h(1, 'custom', { gravedad: 'r' }), h(2, 'custom')], [pt(70)]);
  const tok = entrar(d, '20111222');
  assert.equal(pedir(d, { accion: 'profe_auditoria_marcar', token: tok, id: 'au-1-custom', que: 'otro_dia' }).data.hallazgo.pospuesta, '2026-11-12');
  assert.ok(pedir(d, { accion: 'profe_tareas', token: tok }).data.mio.auditoria.dia.lista.every(x => x.socio_id !== '1'));
  dia(d, '2026-11-12');
  cargar(d, [h(1, 'custom', { gravedad: 'r' }), h(2, 'custom')], [pt(70)]);
  assert.equal(pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.auditoria.dia.lista[0].socio_id, '1');
});

const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const PROFE = usuario({ dni: '20111222', nombre: 'Belén Juárez', roles: 'profe', sede: 'bolson' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación', roles: 'coordinador', sede: 'bolson' });
const ADMIN = usuario({ dni: '20777888', nombre: 'Admin', roles: 'admin', sede: 'bolson' });

function entorno(hoy = '2026-11-03') {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [PROFE, COORD, ADMIN] }), hoy, ahora: Date.parse(hoy + 'T15:00:00Z') });
  pedirCon(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy, tareas: [{ id: 'pp-1', fecha: hoy, sede: 'bolson', profe: 'Belen Juarez', profe_dni: '20111222',
    socio_id: '1', socio_nombre: 'Socio', tipo: 'Renovar plan', accion: 'Renovarlo', vence: hoy, alta: '' }] });
  return d;
}
function pedirCon(d, req) { return L.manejar(req, d); }
const pedir = pedirCon;
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;

test('sin tareas cargadas el profe ve las de base y las marca él', () => {
  const d = entorno();
  const tk = entrar(d, '20111222');
  const T = pedir(d, { accion: 'profe_tareas', token: tk }).data.mio.tareas_mes;
  assert.equal(T.total, 5);
  assert.equal(T.hechas, 0);
  assert.match(T.consejo, /primeros días/);
  const r = pedir(d, { accion: 'profe_tarea_mes_marcar', token: tk, tarea_id: T.lista[1].id, nota: 'Ana, Juan' }).data;
  assert.equal(r.hechas, 1);
  assert.equal(r.lista[1].nota, 'Ana, Juan');
  // la desmarca
  assert.equal(pedir(d, { accion: 'profe_tarea_mes_marcar', token: tk, tarea_id: T.lista[1].id, hecha: false }).data.hechas, 0);
  // coordinación no marca por el profe
  assert.equal(pedir(d, { accion: 'profe_tarea_mes_marcar', token: entrar(d, '20555666'), tarea_id: T.lista[0].id }).error, 'prohibido');
});

test('coordinación arma las tareas del mes; lo marcado en las de base pasa a las nuevas', () => {
  const d = entorno();
  const tp = entrar(d, '20111222'), tc = entrar(d, '20555666');
  const base = pedir(d, { accion: 'profe_tareas', token: tp }).data.mio.tareas_mes.lista;
  pedir(d, { accion: 'profe_tarea_mes_marcar', token: tp, tarea_id: base[0].id, nota: '05/11' });
  const nuevas = base.map(t => ({ texto: t.texto, pide_nota: t.pide_nota })).concat([{ texto: 'Invitar a los socios al evento', pide_nota: '' }]);
  assert.deepEqual(pedir(d, { accion: 'profe_tareas_mes_guardar', token: tc, mes: '2026-11', tareas: nuevas }).data, { mes: '2026-11', tareas: 6 });
  const T = pedir(d, { accion: 'profe_tareas', token: tp }).data.mio.tareas_mes;
  assert.equal(T.total, 6);
  assert.equal(T.hechas, 1);
  assert.equal(T.lista[0].nota, '05/11');
  // el mes que viene arranca con las mismas (copiadas) hasta que coordinación las cambie
  const C = pedir(d, { accion: 'profe_tareas', token: tc }).data;
  assert.equal(C.tareas_mes.origen, 'cargadas');
  assert.equal(C.tareas_mes.siguiente.origen, 'copiadas');
  assert.equal(C.equipo[0].tareas_mes.hechas, 1);
  // validaciones
  assert.equal(pedir(d, { accion: 'profe_tareas_mes_guardar', token: tc, mes: '2026-10', tareas: nuevas }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'profe_tareas_mes_guardar', token: tp, mes: '2026-12', tareas: nuevas }).error, 'prohibido');
});

test('consejo según el día y puntos de la planilla', () => {
  assert.match(L.consejoTareasMes(1, 5, 15, 30), /Ya van 15 días del mes/);
  assert.match(L.consejoTareasMes(4, 5, 27, 30), /Quedan 3 días.*falta 1 tarea/);
  assert.match(L.consejoTareasMes(5, 5, 27, 30), /Completaste/);
  assert.deepEqual([1, 0.8, 0.6, 0.4].map(L.puntosTareasMes), [20, 15, 10, 0]);
});

test('la comisión la sube la PC y la ve solo coordinación con rol admin', () => {
  const d = entorno();
  const datos = { renovaciones: 70, nivel: 2, comision: 55440 };
  assert.equal(pedir(d, { accion: 'cargar_profe_liq', clave: 'mal', filas: [] }).error, 'clave');
  assert.deepEqual(pedir(d, { accion: 'cargar_profe_liq', clave: PROPS.CLAVE_CARGA, filas: [{ mes: '2026-10', profe: 'Belen Juarez', profe_dni: '20111222', sede: 'bolson', datos }] }).data, { filas: 1, meses: ['2026-10'], preguntas_recepcion: 0 });
  const A = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20777888') }).data;
  assert.equal(A.ve_liq, true);
  assert.equal(A.equipo[0].liq[0].comision, 55440);
  const C = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20555666') }).data;
  assert.equal(C.equipo[0].liq, null);
  assert.equal(pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.liq, undefined);
});

const RECE = usuario({ dni: '20999000', nombre: 'Rocío', roles: 'recepcion', sede: 'bolson' });

test('los que pagaron y no vinieron: recepción confirma y, si viene, se liquida', () => {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [PROFE, COORD, ADMIN, RECE] }), hoy: '2026-11-03', ahora: Date.parse('2026-11-03T15:00:00Z') });
  pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy: '2026-11-03', tareas: [{ id: 'pp-1', fecha: '2026-11-03', sede: 'bolson', profe: 'Belen Juarez', profe_dni: '20111222',
    socio_id: '1', socio_nombre: 'Socio', tipo: 'Renovar plan', accion: 'Renovarlo', vence: '2026-11-03', alta: '' }] });
  const datos = { renovaciones: 34, liberados: 1, nuevos: 1, socios_comision: 35, activos_mes: 36, metas: [36, 37, 45, 55], valores: [500, 600, 700, 800], nivel: 0, valor_socio: 500, comision: 17500,
    sin_venir_lista: [{ socio_id: '77', nombre: 'Ana Paz', sede: 'bolson' }, { socio_id: '78', nombre: 'Juan Gil', sede: 'bolson' }] };
  const filas = [{ mes: '2026-10', profe: 'Belen Juarez', profe_dni: '20111222', sede: 'bolson', datos }, { mes: '2026-11', profe: 'Belen Juarez', profe_dni: '20111222', sede: 'bolson', datos }];
  const r = pedir(d, { accion: 'cargar_profe_liq', clave: PROPS.CLAVE_CARGA, filas }).data;
  assert.equal(r.preguntas_recepcion, 2);          // solo octubre (noviembre se pregunta desde el día 20)
  assert.equal(pedir(d, { accion: 'cargar_profe_liq', clave: PROPS.CLAVE_CARGA, filas }).data.preguntas_recepcion, 0);   // no se repite
  const t = d.repo.hojas.tareas.find(x => x.socio_id === 'viene-77-2026-10');
  assert.equal(t.tipo, 'Confirmar si viene · comisión del profe');
  assert.equal(t.asignado_dni, '20999000');
  assert.match(t.situacion, /pagó octubre.*no se le liquida la comisión/);
  // recepción contesta: Ana viene
  const tr = entrar(d, '20999000');
  assert.deepEqual(pedir(d, { accion: 'marcar', token: tr, id_marca: 'm1', tarea_id: t.id, canal: 'PR', resultado: 'VIENE', detalle: '' }).data, {});
  const l = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20777888') }).data.equipo[0].liq.find(x => x.mes === '2026-10');
  assert.equal(l.confirmados, 1);
  assert.deepEqual(l.sin_venir_lista.map(s => s.respuesta), ['viene', 'preguntado']);
  assert.equal(l.nivel_txt, 'Objetivo 1');          // con Ana, 37 activos: sube de nivel
  assert.equal(l.comision, 600 * 36);
});

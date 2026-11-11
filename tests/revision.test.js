const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const HOY = '2026-11-10';
const PROFE = usuario({ dni: '20111222', nombre: 'Profe Uno', roles: 'profe' });
const OTRO = usuario({ dni: '20333444', nombre: 'Profe Dos', roles: 'profe' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación', roles: 'coordinador' });

const SALTO = [{ bloque: 'Bloque N°2', antes: 'Bisagra con disco', esc_antes: 0, despues: 'Peso muerto búlgaro con barra', esc_despues: 3, escalones: 3 }];
const rev = (id, extra = {}) => Object.assign({
  id: 'rev-' + id + '-' + HOY, fecha: HOY, sede: 'bolson', profe: 'Profe Uno', profe_dni: '20111222', socio_id: String(id), socio_nombre: 'Socio ' + id,
  pct: '0.95', banda: 'casi_todo', saltos: JSON.stringify(SALTO), rpe: '[]',
}, extra);

function entorno() {
  return depsFalsas({ repo: repoFalso({ usuarios: [PROFE, OTRO, COORD] }), hoy: HOY, ahora: Date.parse(HOY + 'T15:00:00Z') });
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;
const cargar = (d, filas) => pedir(d, { accion: 'cargar_profe_revision', clave: PROPS.CLAVE_CARGA, hoy: HOY, filas });

test('el profe ve la revisión de sus planes, con saltos y la pregunta', () => {
  const d = entorno();
  assert.deepEqual(cargar(d, [rev(1), rev(2, { pct: '0.5', banda: 'bien', saltos: '[]' }), rev(3, { profe: 'Profe Dos', profe_dni: '20333444' }),
    rev(4, { fecha: '2026-10-01', id: 'rev-4-viejo' })]).data, { filas: 4 });
  const r = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data.mio.revisiones;
  assert.deepEqual(r.lista.map(x => x.socio_id).sort(), ['1', '2']);          // lo de otro profe y lo de hace más de 14 días, no
  assert.equal(r.lista.find(x => x.socio_id === '1').saltos[0].escalones, 3);
  assert.deepEqual([r.resumen.revisados, r.resumen.en_rango, r.resumen.casi_todo, r.resumen.saltos_sin_responder], [2, 1, 1, 1]);
});

test('responder la pregunta y que la carga siguiente no la pise', () => {
  const d = entorno();
  cargar(d, [rev(1)]);
  const tk = entrar(d, '20111222');
  assert.equal(pedir(d, { accion: 'profe_responder_revision', token: tk, id: 'rev-1-' + HOY, respuesta: 'otra' }).error, 'datos_invalidos');
  assert.equal(pedir(d, { accion: 'profe_responder_revision', token: entrar(d, '20333444'), id: 'rev-1-' + HOY, respuesta: 'correcta' }).error, 'prohibido');
  const r = pedir(d, { accion: 'profe_responder_revision', token: tk, id: 'rev-1-' + HOY, respuesta: 'correcta', nota: 'Ya venía haciendo búlgara en otra sede' });
  assert.equal(r.data.revision.respuesta, 'correcta');
  cargar(d, [rev(1), rev(5)]);
  assert.equal(d.repo.hojas.profe_revision.find(x => x.socio_id === '1').respuesta, 'correcta');
  assert.equal(d.repo.hojas.profe_revision.find(x => x.socio_id === '1').nota, 'Ya venía haciendo búlgara en otra sede');
});

test('coordinación ve el resumen de cada profe', () => {
  const d = entorno();
  cargar(d, [rev(1), rev(2, { banda: 'bien', saltos: '[]' })]);
  pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy: HOY, tareas: [{ id: 'pp-1', fecha: HOY, sede: 'bolson', profe: 'Profe Uno', profe_dni: '20111222', socio_id: '1', socio_nombre: 'Socio 1', tipo: 'Renovar plan', accion: 'x', vence: '2026-11-12' }] });
  const e = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20555666') }).data.equipo;
  assert.deepEqual(e[0].revisiones.resumen, { revisados: 2, en_rango: 1, casi_todo: 1, poco: 0, con_saltos: 1, saltos_sin_responder: 1, corregir: 0 });
});

test('cargar_profe_revision pide la clave', () => {
  assert.equal(pedir(entorno(), { accion: 'cargar_profe_revision', clave: 'mal', filas: [] }).error, 'clave');
});

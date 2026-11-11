const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const PROFE = usuario({ dni: '20111222', nombre: 'Profe Uno', roles: 'profe' });
const COORD = usuario({ dni: '20555666', nombre: 'Coordinación', roles: 'coordinador' });

function entorno() {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [PROFE, COORD] }), hoy: '2026-11-11', ahora: Date.parse('2026-11-11T15:00:00Z') });
  d.dia = '2026-11-11';
  return d;
}
const pedir = (d, req) => L.manejar(req, d);
const entrar = (d, dni) => pedir(d, { accion: 'login', dni, pin: '4831' }).data.token;
const datos = { socios: 80, vencidos: 12, vienen: 3, vienen_mucho: 1, custom: { medidos: 20, en_rango_pct: 40 }, tiempo: { mediana_min: 15 },
  lista: [{ socio_id: '9', nombre: 'Socio 9', vence: '2026-10-20', dias: 22, vino_vencido: 12, vino_plan: 30, por_semana: 3 }] };
const subir = (d, filas, clave = PROPS.CLAVE_CARGA) => pedir(d, { accion: 'cargar_profe_coordinacion', clave, hoy: d.dia, filas });

test('cargar_profe_coordinacion pide la clave y valida', () => {
  const d = entorno();
  assert.equal(subir(d, [], 'mal').error, 'clave');
  assert.equal(subir(d, [{ profe: 'Profe Uno', sede: 'marte', datos: '{}' }]).error, 'datos_invalidos');
  assert.equal(subir(d, [{ profe: 'Profe Uno', sede: 'bolson', datos: 'no es json' }]).error, 'datos_invalidos');
});

test('coordinación ve el tablero de cada profe; se guarda solo la última corrida', () => {
  const d = entorno();
  pedir(d, { accion: 'cargar_profe_tareas', clave: PROPS.CLAVE_CARGA, hoy: d.dia, tareas: [{ id: 'pp-1', fecha: '2026-11-11', sede: 'bolson', profe: 'Profe Uno', profe_dni: '20111222',
    socio_id: '1', socio_nombre: 'Socio 1', tipo: 'Renovar plan', accion: 'Renovarlo', vence: '2026-11-12', alta: '' }] });
  assert.deepEqual(subir(d, [{ profe: 'Profe Uno', profe_dni: '20111222', sede: 'bolson', datos: JSON.stringify({ socios: 1 }) }]).data, { filas: 1 });
  assert.deepEqual(subir(d, [{ profe: 'Profe Uno', profe_dni: '20111222', sede: 'bolson', datos }]).data, { filas: 1 });
  assert.equal(d.repo.hojas.profe_coord.length, 1);
  const eq = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20555666') }).data.equipo;
  const c = eq.find(p => p.profe === 'Profe Uno').coord;
  assert.equal(c.fecha, '2026-11-11');
  assert.equal(c.vencidos, 12);
  assert.equal(c.lista[0].vino_vencido, 12);
  // el profe no ve el tablero de coordinación
  const mio = pedir(d, { accion: 'profe_tareas', token: entrar(d, '20111222') }).data;
  assert.equal(mio.equipo, undefined);
});

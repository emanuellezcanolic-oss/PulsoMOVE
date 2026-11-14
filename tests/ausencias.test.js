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
  // otra sede no
  assert.equal(pedir(d, { accion: 'profe_ausencia_guardar', token: entrar(d, '20666777'), profe_dni: '20111222', desde: '2026-12-01', hasta: '2026-12-02' }).error, 'prohibido');
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

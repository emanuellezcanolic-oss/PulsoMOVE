const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario } = require('./repo_falso');

const ANA = usuario({ dni: '20111222', nombre: 'Ana Perez', roles: 'profe', sede: 'puelo' });
const BETO = usuario({ dni: '20333444', nombre: 'Beto Diaz', roles: 'profe', sede: 'puelo' });
const RECE = usuario({ dni: '20555666', nombre: 'Rita Sosa', roles: 'recepcion', sede: 'puelo' });

function entorno() {
  const d = depsFalsas({ repo: repoFalso({ usuarios: [ANA, BETO, RECE] }), hoy: '2026-11-16', ahora: Date.parse('2026-11-16T15:00:00Z') });
  d.repo.hojas.profe_horarios = [{ profe: 'Ana Perez', sede: 'puelo', dias: '0-4', desde: '09:00', hasta: '13:00' },
    { profe: 'Beto Diaz', sede: 'puelo', dias: '0-4', desde: '15:00', hasta: '20:00' }];
  d.repo.hojas.profe_ausencias = [{ id: 'au-1', profe: 'Ana Perez', profe_dni: '20111222', desde: '2026-11-16', hasta: '2026-11-22', tipo: 'licencia', pago: 'no_paga', nota: 'privado',
    cubren: JSON.stringify([{ profe: 'Beto Diaz', profe_dni: '20333444', desde: '2026-11-16', hasta: '2026-11-17', hora_desde: '', hora_hasta: '' }]) }];
  d.repo.hojas.profe_sabados = [{ fecha: '2026-11-21', sede: 'puelo', profe: 'Ana Perez', profe_dni: '20111222' }];
  d.repo.hojas.coberturas = [{ id: 'C-1', fecha: '2026-11-18', titular_dni: '20555666', cubre_dni: '20333444', horas: '4', descuenta: 'true', motivo: 'Enfermedad', nota: 'privado' }];
  return d;
}
const ver = (d, extra) => {
  const token = L.manejar({ accion: 'login', dni: '20555666', pin: '4831' }, d).data.token;
  return L.manejar(Object.assign({ accion: 'calendario_ver', token }, extra), d);
};

test('quien está de vacaciones no aparece trabajando y quien cubre aparece en esa franja', () => {
  const r = ver(entorno()).data;
  const lunes = r.dias['2026-11-16'];
  assert.deepEqual(lunes.trabajan.map(t => t.nombre + ' ' + t.desde + (t.cubre ? ' x ' + t.cubre : '')), ['Beto Diaz 09:00 x Ana Perez', 'Beto Diaz 15:00']);
  assert.equal(lunes.ausentes[0].nombre, 'Ana Perez');
  assert.equal(r.dias['2026-11-18'].ausentes[0].cubren.length, 0);
  assert.equal(r.dias['2026-11-21'].sabado[0].ausente, true);
  assert.equal(r.dias['2026-11-23'].trabajan.length, 2);
  assert.equal(Object.keys(r.dias).length, 30);
});

test('lo ve todo el equipo sin plata, motivos ni notas', () => {
  const r = ver(entorno());
  const txt = JSON.stringify(r.data);
  assert.doesNotMatch(txt, /no_paga|privado|Enfermedad|20111222|20333444/);
  assert.equal(r.data.dias['2026-11-18'].coberturas[0].titular, 'Rita Sosa');
});

test('sin sesión no se ve', () => {
  assert.equal(L.manejar({ accion: 'calendario_ver' }, entorno()).error, 'sin_sesion');
});

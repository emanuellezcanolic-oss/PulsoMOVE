'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('./cargar').cargar();
const { repoFalso, depsFalsas, usuario, PROPS } = require('./repo_falso');

const HOY = '2026-11-24';

const CLAVE = 'a'.repeat(64);
const armar = () => depsFalsas({ hoy: HOY, ahora: Date.parse(HOY + 'T18:00:00Z'), repo: repoFalso({ usuarios: [usuario()],
  profe_auditoria: [
    { id: 'au-1-gestion', socio_id: '1', estado: 'marcada', marcada_en: HOY + 'T12:00:00Z' },
    { id: 'au-2-gestion', socio_id: '2', estado: 'no_corregido', marcada_en: HOY + 'T12:00:00Z' },
    { id: 'au-3-gestion', socio_id: '3', estado: 'pendiente', marcada_en: '' },
  ],
  profe_tareas: [{ id: 'pp-9', socio_id: '9', estado: 'hecha', hecha_en: HOY + 'T15:00:00Z', nota: '' }] }) });

test('verificación rápida: cierra solo lo marcado que MOVE ya no muestra y comprueba el plan renovado', () => {
  const d = armar();
  d.props = Object.assign({}, d.props, { CLAVE_CARGA: CLAVE });
  const por = L.manejar({ accion: 'profe_por_verificar', clave: CLAVE }, d).data;
  assert.deepEqual(por.auditoria.map(x => x.socio_id).sort(), ['1', '2']);
  assert.equal(por.planes.length, 1);
  const r = L.manejar({ accion: 'verificar_profe', clave: CLAVE, auditados: ['1', '2', '3'], abiertos: ['au-2-gestion'], planes_ok: ['pp-9'] }, d).data;
  assert.deepEqual(r, { corregidas: 1, comprobados: 1 });
  const h = d.repo.hojas.profe_auditoria;
  assert.equal(h[0].estado, 'corregido');
  assert.equal(h[1].estado, 'no_corregido', 'sigue en MOVE: queda como estaba');
  assert.equal(h[2].estado, 'pendiente', 'lo no marcado no se toca');
  assert.match(d.repo.hojas.profe_tareas[0].nota, /Comprobado en MOVE/);
  assert.equal(L.manejar({ accion: 'verificar_profe', clave: 'x', auditados: [], abiertos: [], planes_ok: [] }, d).error, 'clave');
});

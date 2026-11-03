// Repositorio en memoria con la misma interfaz que Hojas.js, y dependencias de prueba.
const crypto = require('crypto');

const PROPS = { CLAVE_CARGA: 'clave-prueba', SECRETO_TOKEN: 's', PIMIENTA: 'p' };
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const copia = x => JSON.parse(JSON.stringify(x));

function repoFalso(semilla = {}) {
  const hojas = copia(semilla);
  return {
    hojas,
    leer: h => copia(hojas[h] || []),
    escribir: (h, filas) => { hojas[h] = copia(filas); },
    agregar: (h, fila) => { (hojas[h] = hojas[h] || []).push(copia(fila)); },
  };
}

function depsFalsas({ repo, ahora = 1_800_000_000_000, hoy = '2026-11-09' } = {}) {
  const deps = {
    repo: repo || repoFalso(),
    t: ahora,
    dia: hoy,
    ahora: () => deps.t,
    hoy: () => deps.dia,
    sha256,
    hmac: (s, k) => crypto.createHmac('sha256', k).update(s).digest('base64url'),
    aleatorio: n => crypto.randomBytes(n).toString('hex'),
    props: { ...PROPS },
  };
  return deps;
}

// Fila de la hoja usuarios lista para usar en pruebas (valores como texto, igual que la planilla)
function usuario({ dni = '30123456', nombre = 'Ana Prueba', pin = '4831', sede = 'bolson', turno = 'manana',
                   roles = 'recepcion', debe_cambiar_pin = false, activo = true } = {}) {
  const sal = 'sal' + dni;
  return {
    dni, nombre, sede, turno, roles, sal,
    pin_hash: sha256(sal + ':' + pin + ':' + PROPS.PIMIENTA),
    debe_cambiar_pin: String(debe_cambiar_pin), intentos: '0', bloqueado_hasta: '', activo: String(activo),
  };
}

module.exports = { repoFalso, depsFalsas, usuario, PROPS };

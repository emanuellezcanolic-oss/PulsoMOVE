// PulsoMOVE · lo único que toca Google: la planilla privada, las Propiedades del script y doPost.

const COLUMNAS = {
  usuarios: ['dni', 'nombre', 'sede', 'turno', 'roles', 'pin_hash', 'sal', 'debe_cambiar_pin', 'intentos', 'bloqueado_hasta', 'activo', 'hora_inicio', 'hora_fin'],
  tareas: ['id', 'fecha', 'sede', 'socio_id', 'socio_nombre', 'profe', 'tipo', 'prioridad', 'situacion', 'accion',
           'ultima_anotacion', 'asignado_dni', 'pendiente_desde', 'estado', 'hecha_en', 'intro'],
  registro: ['id_marca', 'ts', 'tarea_id', 'fecha_tarea', 'sede', 'socio_id', 'socio_nombre', 'tipo', 'dni', 'canal',
             'resultado', 'fecha_resultado', 'detalle', 'segundos', 'adelantada'],
  actividad: ['id', 'ts', 'dni', 'sede', 'tipo', 'nombre', 'categoria', 'canal', 'origen', 'interes', 'detalle'],
  rendimiento: ['mes', 'dni', 'datos', 'actualizado'],
  objetivos: ['dni', 'clave', 'valor'],
  profes: ['fecha', 'sede', 'profe_id', 'profe', 'clase', 'qr', 'estado'],
  cierres: ['fecha', 'ts', 'dni', 'nombre', 'sede', 'animo', 'respuestas', 'comentario', 'hechas', 'pendientes', 'mensajes', 'consultas', 'sala', 'profes', 'lo_mejor', 'equipo', 'socios', 'pregunta'],
  garantia: ['id', 'ts', 'sede', 'socio_id', 'socio_nombre', 'profe', 'motivo', 'registra_dni', 'estado', 'decide_dni',
             'comentario', 'decidido_en'],
};
const ZONA = 'America/Argentina/Buenos_Aires';

function propiedades() {
  return PropertiesService.getScriptProperties();
}

function planilla() {
  return SpreadsheetApp.openById(propiedades().getProperty('ID_PLANILLA'));
}

// Repositorio sobre la planilla: filas como objetos, todo como texto.
function repoHojas() {
  const libro = planilla();
  const hoja = nombre => {
    if (!COLUMNAS[nombre]) throw new Error('Hoja desconocida: ' + nombre);
    let h = libro.getSheetByName(nombre);
    if (!h) {   // hojas agregadas después de la instalación
      h = libro.insertSheet(nombre);
      h.getRange(1, 1, 1, COLUMNAS[nombre].length).setValues([COLUMNAS[nombre]]).setFontWeight('bold');
      h.getRange(1, 1, h.getMaxRows(), COLUMNAS[nombre].length).setNumberFormat('@');
      h.setFrozenRows(1);
    }
    return h;
  };
  const aFilas = (nombre, objetos) => objetos.map(o => COLUMNAS[nombre].map(c => (o[c] == null ? '' : String(o[c]))));
  return {
    leer: function (nombre) {
      const h = hoja(nombre);
      const n = h.getLastRow() - 1;
      if (n < 1) return [];
      const cols = COLUMNAS[nombre];
      return h.getRange(2, 1, n, cols.length).getDisplayValues().map(fila => {
        const o = {};
        cols.forEach((c, i) => { o[c] = fila[i]; });
        return o;
      });
    },
    escribir: function (nombre, objetos) {
      const h = hoja(nombre);
      const cols = COLUMNAS[nombre].length;
      h.getRange(1, 1, 1, cols).setValues([COLUMNAS[nombre]]);
      if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, cols).clearContent();
      if (!objetos.length) return;
      h.getRange(2, 1, objetos.length, cols).setNumberFormat('@').setValues(aFilas(nombre, objetos));
    },
    agregar: function (nombre, objeto) {
      const h = hoja(nombre);
      h.getRange(h.getLastRow() + 1, 1, 1, COLUMNAS[nombre].length).setNumberFormat('@').setValues(aFilas(nombre, [objeto]));
    },
  };
}

function aHex(bytes) {
  return bytes.map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

function aleatorioHex(n) {
  let s = '';
  while (s.length < 2 * n) s += Utilities.getUuid().replace(/-/g, '');
  return s.slice(0, 2 * n);
}

function depsGoogle() {
  const p = propiedades();
  return {
    repo: repoHojas(),
    ahora: () => Date.now(),
    hoy: () => Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd'),
    sha256: s => aHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)),
    hmac: (s, k) => Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, k, Utilities.Charset.UTF_8)).replace(/=+$/, ''),
    aleatorio: aleatorioHex,
    props: {
      CLAVE_CARGA: p.getProperty('CLAVE_CARGA'),
      SECRETO_TOKEN: p.getProperty('SECRETO_TOKEN'),
      PIMIENTA: p.getProperty('PIMIENTA'),
    },
  };
}

function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return respuesta({ ok: false, error: 'datos_invalidos' });
  }
  if (req && req.accion === 'iniciar_clave') return respuesta(iniciarClave(req));
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return respuesta({ ok: false, error: 'ocupado' });
  try {
    return respuesta(manejar(req, depsGoogle()));
  } catch (err) {
    return respuesta({ ok: false, error: 'interno' });
  } finally {
    lock.releaseLock();
  }
}

// La primera visita del dueño (que autoriza el script) crea la planilla.
function doGet() {
  if (!propiedades().getProperty('ID_PLANILLA')) instalar();
  return respuesta({ ok: true, data: 'PulsoMOVE' });
}

// La clave de carga la genera la computadora que carga las tareas y se fija una sola vez: después no se puede cambiar
// por la web (para cambiarla, borrar CLAVE_CARGA en Propiedades del script).
function iniciarClave(req) {
  const p = propiedades();
  if (p.getProperty('CLAVE_CARGA') || typeof req.clave !== 'string' || !/^[0-9a-f]{64}$/.test(req.clave)) {
    return { ok: false, error: 'clave' };
  }
  p.setProperty('CLAVE_CARGA', req.clave);
  return { ok: true, data: {} };
}

// ---------- Para correr a mano desde el editor ----------

// Crea la planilla privada y los secretos internos. Se puede volver a correr sin romper nada.
function instalar() {
  const p = propiedades();
  if (!p.getProperty('ID_PLANILLA')) {
    const libro = SpreadsheetApp.create('PulsoMOVE (privada)');
    p.setProperty('ID_PLANILLA', libro.getId());
  }
  const libro = planilla();
  Object.keys(COLUMNAS).forEach(nombre => {
    const h = libro.getSheetByName(nombre) || libro.insertSheet(nombre);
    const cols = COLUMNAS[nombre];
    h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    h.getRange(1, 1, h.getMaxRows(), cols.length).setNumberFormat('@');
    h.setFrozenRows(1);
  });
  libro.getSheets().forEach(h => { if (!COLUMNAS[h.getName()] && libro.getSheets().length > 1) libro.deleteSheet(h); });
  ['SECRETO_TOKEN', 'PIMIENTA'].forEach(k => {
    if (!p.getProperty(k)) p.setProperty(k, aleatorioHex(32));
  });
  Logger.log('Listo. Planilla: ' + libro.getUrl());
}


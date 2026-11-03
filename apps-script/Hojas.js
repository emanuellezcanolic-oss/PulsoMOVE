// PulsoMOVE · lo único que toca Google: la planilla privada, las Propiedades del script y doPost.

const COLUMNAS = {
  usuarios: ['dni', 'nombre', 'sede', 'turno', 'roles', 'pin_hash', 'sal', 'debe_cambiar_pin', 'intentos', 'bloqueado_hasta', 'activo'],
  tareas: ['id', 'fecha', 'sede', 'socio_id', 'socio_nombre', 'profe', 'tipo', 'prioridad', 'situacion', 'accion',
           'ultima_anotacion', 'asignado_dni', 'pendiente_desde', 'estado', 'hecha_en'],
  registro: ['id_marca', 'ts', 'tarea_id', 'fecha_tarea', 'sede', 'socio_id', 'socio_nombre', 'tipo', 'dni', 'canal',
             'resultado', 'fecha_resultado', 'detalle'],
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
    const h = libro.getSheetByName(nombre);
    if (!h || !COLUMNAS[nombre]) throw new Error('Hoja desconocida: ' + nombre);
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

function doGet() {
  return respuesta({ ok: true, data: 'PulsoMOVE' });
}

// ---------- Para correr a mano desde el editor ----------

// Una sola vez: crea la planilla privada y las claves. Se puede volver a correr sin romper nada.
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
  ['CLAVE_CARGA', 'SECRETO_TOKEN', 'PIMIENTA'].forEach(k => {
    if (!p.getProperty(k)) p.setProperty(k, aleatorioHex(32));
  });
  Logger.log('Listo. Planilla: ' + libro.getUrl());
}

// Muestra la clave de carga para copiarla a %USERPROFILE%\.move\pulso_clave.txt. No la compartas.
function mostrarClaveCarga() {
  Logger.log(propiedades().getProperty('CLAVE_CARGA'));
}

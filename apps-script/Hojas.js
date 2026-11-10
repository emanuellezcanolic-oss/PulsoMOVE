// PulsoMOVE · lo único que toca Google: la planilla privada, las Propiedades del script y doPost.

const COLUMNAS = {
  usuarios: ['dni', 'nombre', 'sede', 'turno', 'roles', 'pin_hash', 'sal', 'debe_cambiar_pin', 'intentos', 'bloqueado_hasta', 'activo', 'hora_inicio', 'hora_fin'],
  tareas: ['id', 'fecha', 'sede', 'socio_id', 'socio_nombre', 'profe', 'tipo', 'prioridad', 'situacion', 'accion',
           'ultima_anotacion', 'asignado_dni', 'pendiente_desde', 'estado', 'hecha_en', 'intro'],
  registro: ['id_marca', 'ts', 'tarea_id', 'fecha_tarea', 'sede', 'socio_id', 'socio_nombre', 'tipo', 'dni', 'canal',
             'resultado', 'fecha_resultado', 'detalle', 'segundos', 'adelantada'],
  actividad: ['id', 'ts', 'dni', 'sede', 'tipo', 'nombre', 'categoria', 'canal', 'origen', 'interes', 'detalle'],
  rendimiento: ['mes', 'dni', 'datos', 'actualizado'],
  uso: ['ts', 'dni', 'fecha', 'activos', 'quieta', 'otra'],
  stock: ['ts', 'fecha', 'sede', 'dni', 'nombre', 'producto', 'cantidad'],
  ventas: ['fecha', 'sede', 'dni', 'nombre', 'planes', 'planes_monto', 'nuevos', 'renovaciones', 'largos', 'mostrador', 'mostrador_monto', 'efectivo', 'transferencia', 'mercadopago', 'otros_medios', 'productos', 'sin_clasificar'],
  ventas_largas: ['id', 'fecha', 'sede', 'dni_cobro', 'nombre_cobro', 'socio_id', 'socio_nombre', 'plan', 'tipo', 'largo', 'sugerido_dni', 'estado', 'pide_dni', 'responde_dni', 'hacia_dni', 'dni_vendio', 'ts_pedido', 'ts_decidido', 'decide_dni'],
  beneficios: ['id', 'ts', 'tipo', 'sede', 'socio_nombre', 'nuevo_socio', 'detalle', 'registra_dni', 'estado', 'decide_dni', 'comentario', 'decidido_en'],
  objetivos: ['dni', 'clave', 'valor'],
  // Mapa de calor de reservas: tipo 'patron' (clave = día de la semana 0-6) o 'mes' (clave = AAAA-MM)
  ocupacion: ['sede', 'tipo', 'clave', 'dia', 'hora', 'dias', 'clases', 'cupo', 'reservas', 'asistieron', 'ausentes', 'ocupacion', 'sin_cupo', 'actualizado'],
  // Reservas de los próximos días: tipo 'franja' (una clase, con los nombres de los anotados) o
  // 'sin_reserva' (alguien que suele venir y todavía no reservó). Del socio va el nombre y nada más.
  proximas: ['sede', 'tipo', 'fecha', 'hora', 'clase', 'profe', 'horario_id', 'cupo', 'reservas', 'nombres', 'actualizado'],
  profes: ['fecha', 'sede', 'profe_id', 'profe', 'clase', 'qr', 'estado'],
  fichajes: ['id', 'fecha', 'sede', 'persona_id', 'persona', 'dni', 'momento', 'hora', 'estado', 'desde_ts', 'cerrada_ts', 'recordado_ts', 'recordado_dni', 'no_viene_ts', 'no_viene_dni'],
  fichajes_control: ['ts'],
  avisos: ['dni', 'clave', 'ts', 'nombre'],
  reservas_qr: ['id', 'fecha', 'sede', 'socio_id', 'socio', 'clase', 'profe', 'hora', 'fin', 'estado', 'desde_ts', 'cerrada_ts', 'recordado_ts', 'recordado_dni', 'resuelta_ts', 'resuelta_dni', 'resultado', 'detalle'],
  servidor: ['ts', 'evento', 'accion', 'dueno', 'ms'],
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
    // Las lecturas no esperan turno: no crean hojas, y lo que falta todavía se lee como vacío.
    leer: function (nombre) {
      if (!COLUMNAS[nombre]) throw new Error('Hoja desconocida: ' + nombre);
      const h = libro.getSheetByName(nombre);
      if (!h) return [];
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
      const habia = h.getLastRow() - 1;
      h.getRange(1, 1, 1, cols).setValues([COLUMNAS[nombre]]);
      // Primero se pisa y recién después se borra lo que sobra: quien lee en ese momento nunca encuentra la hoja vacía.
      if (objetos.length) h.getRange(2, 1, objetos.length, cols).setNumberFormat('@').setValues(aFilas(nombre, objetos));
      if (habia > objetos.length) h.getRange(2 + objetos.length, 1, habia - objetos.length, cols).clearContent();
    },
    agregar: function (nombre, objeto) {
      const h = hoja(nombre);
      h.getRange(h.getLastRow() + 1, 1, 1, COLUMNAS[nombre].length).setNumberFormat('@').setValues(aFilas(nombre, [objeto]));
    },
    // Agrega sin turno: no pisa aunque haya otro escribiendo.
    anexar: function (nombre, objeto) {
      hoja(nombre).appendRow(aFilas(nombre, [objeto])[0]);
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
  return respuesta(atenderPedido(req, ambienteGoogle()));
}

// Lo que atenderPedido necesita de Google. Anotar nunca puede romper un pedido.
function ambienteGoogle() {
  const lock = LockService.getScriptLock();
  const cache = CacheService.getScriptCache();
  return {
    ahora: () => Date.now(),
    deps: depsGoogle,
    tomarTurno: () => lock.tryLock(ESPERA_TURNO_MS),
    soltarTurno: () => { cache.remove('turno'); lock.releaseLock(); },
    guardar: () => SpreadsheetApp.flush(),   // antes de soltar el turno, para que el siguiente ya vea lo guardado
    marcarDueno: accion => { try { cache.put('turno', accion + ' desde ' + new Date().toISOString(), 600); } catch (e) { /* solo sirve para diagnosticar */ } },
    dueno: () => { try { return cache.get('turno') || ''; } catch (e) { return ''; } },
    anotar: nota => {
      try {
        // Con el servidor trabado llegan muchos seguidos: alcanza con uno por minuto
        if (nota.evento === 'ocupado') {
          if (cache.get('anotado_ocupado')) return;
          cache.put('anotado_ocupado', '1', 60);
        }
        console.warn('PulsoMOVE ' + nota.evento + ' ' + nota.accion + ' ' + (nota.dueno || nota.ms));
        repoHojas().anexar('servidor', Object.assign({ ts: new Date().toISOString() }, nota));
      } catch (e) { /* nada */ }
    },
  };
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


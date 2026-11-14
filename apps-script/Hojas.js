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
  // Seguimiento de consultas (Seguimiento.js): el estado y el próximo paso de cada consulta registrada en `actividad`
  consulta_estado: ['id', 'estado', 'proximo_fecha', 'proximo_paso', 'nota', 'dni', 'sede', 'actualizado'],
  // Pase de turno: lo que deja quien termina para quien sigue (leidos: dni separados por coma)
  pases: ['id', 'fecha', 'sede', 'dni', 'nombre', 'turno', 'pendientes', 'esperando', 'novedades', 'ts', 'leidos'],
  coberturas: ['id', 'fecha', 'titular_dni', 'cubre_dni', 'horas', 'descuenta', 'motivo', 'nota', 'creado_por', 'actualizado'],
  beneficios: ['id', 'ts', 'tipo', 'sede', 'socio_nombre', 'nuevo_socio', 'detalle', 'registra_dni', 'estado', 'decide_dni', 'comentario', 'decidido_en'],
  objetivos: ['dni', 'clave', 'valor'],
  // Liquidación (Liquidacion.js): dni + mes → datos en JSON. dni '*' es la configuración del mes; mes 'horas' son las horas por día de la persona
  liquidacion: ['dni', 'mes', 'datos', 'actualizado'],
  // Ingreso por QR de cada día de recepción: primera entrada y última salida (lo carga la PC)
  liq_qr: ['dni', 'fecha', 'entrada', 'salida', 'n', 'actualizado'],
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
  // PulsoMOVE Profes: planes a renovar por profe. No confundir con `profes`, que es la llegada por QR
  profe_tareas: ['id', 'fecha', 'sede', 'profe', 'profe_dni', 'socio_id', 'socio_nombre', 'tipo', 'accion', 'vence', 'alta', 'estado', 'hecha_en', 'hecha_dni', 'nota', 'cargada', 'cerrada_en'],
  // Socios activos de cada profe con su última evaluación y los horarios en que suelen venir (pulso_profes.py)
  profe_reeval: ['id', 'sede', 'profe', 'profe_dni', 'socio_id', 'socio_nombre', 'ultima_eval', 'dias', 'habitos', 'cargada'],
  // Revisión del plan renovado contra el anterior: % customizado, saltos de escalón, RPE y la respuesta del profe
  profe_revision: ['id', 'fecha', 'sede', 'profe', 'profe_dni', 'socio_id', 'socio_nombre', 'pct', 'banda', 'saltos', 'rpe', 'respuesta', 'respondida_en', 'nota', 'minutos', 'dias_plan'],
  // Auditoría de planes (F2.18): hallazgos como tareas, y el puntaje de cada profe por día
  profe_auditoria: ['id', 'fecha', 'ultima', 'sede', 'profe', 'profe_dni', 'socio_id', 'socio_nombre', 'seccion', 'gravedad', 'texto', 'cuantos', 'estado', 'marcada_en', 'corregido_en', 'reaparecio', 'motivo', 'pospuesta'],
  // Tablero de coordinación: lo que calcula la PC por profe (vencidos y cuántas veces vino, customización, tiempo). Solo la última corrida
  // Horario de cada profe y kinesiólogo en cada sede (lo carga la PC; días 0=lunes … 6=domingo, '0-4' o '0,2,4')
  profe_horarios: ['profe', 'sede', 'dias', 'desde', 'hasta'],
  // A quién le toca cada sábado en cada sede (lo carga coordinación en la app; arrancó con las planillas)
  profe_sabados: ['fecha', 'sede', 'profe', 'profe_dni', 'nota', 'por_dni', 'en'],
  // Sábados feriados: si se trabaja o no (lo contesta coordinación)
  profe_feriados: ['fecha', 'nombre', 'se_trabaja', 'borrado', 'por_dni', 'en'],
  // Quiénes trabajan los sábados en cada sede (tildados por coordinación; profes separados por |)
  profe_rotacion: ['sede', 'profes', 'por_dni', 'en'],
  // Tareas del mes de los profes (las arma coordinación) y lo que marcó cada profe
  profe_tmes: ['mes', 'id', 'texto', 'pide_nota', 'orden', 'por_dni', 'en'],
  profe_tmes_hechas: ['mes', 'tarea_id', 'dni', 'hecha', 'nota', 'en'],
  // Comisión por renovaciones de cada profe por mes (la calcula la PC; solo la ve coordinación con rol admin)
  profe_liq: ['mes', 'profe', 'profe_dni', 'sede', 'datos', 'cargada'],
  // Vacaciones y licencias de los profes, con quién los cubre
  profe_ausencias: ['id', 'profe', 'profe_dni', 'desde', 'hasta', 'tipo', 'reemplazo', 'reemplazo_dni', 'nota', 'por_dni', 'en'],
  // Estado del Gym: analíticas de MOVE por sede y por profe, mes a mes (JSON). Solo la última carga
  profe_estado: ['clave', 'tipo', 'nombre', 'sede', 'datos', 'cargada'],
  profe_coord: ['fecha', 'profe', 'profe_dni', 'sede', 'datos'],
  profe_puntajes: ['fecha', 'profe', 'profe_dni', 'socios', 'puntaje', 'gestion', 'diagnostico', 'metodologia', 'custom', 'rpe'],
  // Días en que el profe terminó todo lo del día, y cuánto tardó desde la primera marca
  profe_dias: ['dni', 'fecha', 'primera_ts', 'completado_ts', 'planes', 'minutos'],
  chat_conv: ['id', 'tipo', 'nombre', 'miembros', 'creada_por', 'creada', 'ultimo_ts'],
  chat_msg: ['id', 'conv_id', 'ts', 'dni', 'nombre', 'texto', 'ref'],
  chat_lect: ['conv_id', 'dni', 'ts'],
  chat_aviso: ['dni', 'sin_leer', 'ts'],
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
// Velocidad (13/11/2026): dentro de un mismo pedido cada hoja se lee de Google una sola vez. Antes, la pestaña Profes
// de coordinación leía 91 veces (la misma hoja por cada profe) y tardaba 5 a 10 segundos. Lo leído se guarda como
// valores y cada leer() arma objetos nuevos, así nadie modifica sin querer lo que lee otro; escribir y agregar lo olvidan.
function repoHojas() {
  const libro = planilla();
  const hojas = {};
  const valores = {};
  const buscarHoja = nombre => (nombre in hojas ? hojas[nombre] : (hojas[nombre] = libro.getSheetByName(nombre)));
  const hoja = nombre => {
    if (!COLUMNAS[nombre]) throw new Error('Hoja desconocida: ' + nombre);
    let h = buscarHoja(nombre);
    if (!h) {   // hojas agregadas después de la instalación
      h = libro.insertSheet(nombre);
      h.getRange(1, 1, 1, COLUMNAS[nombre].length).setValues([COLUMNAS[nombre]]).setFontWeight('bold');
      h.getRange(1, 1, h.getMaxRows(), COLUMNAS[nombre].length).setNumberFormat('@');
      h.setFrozenRows(1);
      hojas[nombre] = h;
    }
    return h;
  };
  const leerValores = nombre => {
    if (nombre in valores) return valores[nombre];
    const h = buscarHoja(nombre);
    const n = h ? h.getLastRow() - 1 : 0;
    valores[nombre] = n < 1 ? [] : h.getRange(2, 1, n, COLUMNAS[nombre].length).getDisplayValues();
    return valores[nombre];
  };
  const aFilas = (nombre, objetos) => objetos.map(o => COLUMNAS[nombre].map(c => (o[c] == null ? '' : String(o[c]))));
  return {
    // Las lecturas no esperan turno: no crean hojas, y lo que falta todavía se lee como vacío.
    leer: function (nombre) {
      if (!COLUMNAS[nombre]) throw new Error('Hoja desconocida: ' + nombre);
      const cols = COLUMNAS[nombre];
      return leerValores(nombre).map(fila => {
        const o = {};
        cols.forEach((c, i) => { o[c] = fila[i]; });
        return o;
      });
    },
    escribir: function (nombre, objetos) {
      delete valores[nombre];
      const h = hoja(nombre);
      const cols = COLUMNAS[nombre].length;
      const habia = h.getLastRow() - 1;
      h.getRange(1, 1, 1, cols).setValues([COLUMNAS[nombre]]);
      // Primero se pisa y recién después se borra lo que sobra: quien lee en ese momento nunca encuentra la hoja vacía.
      if (objetos.length) h.getRange(2, 1, objetos.length, cols).setNumberFormat('@').setValues(aFilas(nombre, objetos));
      if (habia > objetos.length) h.getRange(2 + objetos.length, 1, habia - objetos.length, cols).clearContent();
    },
    agregar: function (nombre, objeto) {
      delete valores[nombre];
      const h = hoja(nombre);
      h.getRange(h.getLastRow() + 1, 1, 1, COLUMNAS[nombre].length).setNumberFormat('@').setValues(aFilas(nombre, [objeto]));
    },
    // Agrega sin turno: no pisa aunque haya otro escribiendo.
    anexar: function (nombre, objeto) {
      delete valores[nombre];
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


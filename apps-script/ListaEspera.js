// PulsoMOVE · Lista de espera (Emanuel, 24/11/2026).
// Una sola lista por sede (campo `sede`; `sede_interes` es la sede donde la persona quiere entrenar, por si se abre un gimnasio nuevo).
// La ve recepción de SU sede; coordinación / responsable / admin ven todas, separadas por sede. Los profes no la ven.
// El estado vive en un campo (no en el color de la celda) y cada acción queda en `espera_hist`.
// Reglas (todas con números en LE_CONFIG_DEFECTO, editables por admin en la hoja `espera_config`):
//  - Orden: prioridad 1, 2, 3 y dentro de cada una, antigüedad. «Pase de prioridad»: adelanta hasta N lugares dentro de la misma prioridad.
//  - «Lugar N» por franja horaria (mañana / tarde). Cuentan solo las filas vigentes (confirmadas en los últimos 90 días).
//  - Tareas diarias con tope (8 por recepcionista por turno, 15 por sede por día), 1 acción por persona, 1 mensaje por persona por semana.
//  - Nada se envía solo: la app arma el mensaje y recepción lo manda por WhatsApp. Sin presión ni promesas de fecha.
//  - Baja pedida = no recibe más tareas. Sin respuesta tras 3 intentos y más de 90 días = PAUSA (reversible).

// Las etiquetas son las palabras que usan las recepcionistas en la planilla (Emanuel, 25/11/2026); las claves internas no cambian.
const LE_ESTADOS = {
  nuevo: 'Pendiente de mensaje', esperando: 'Esperando lugar', contactado: 'Aguardando respuesta', reconfirmo: 'Reconfirmó',
  evaluacion_agendada: 'Evaluación agendada', pausa: 'En pausa', descartado: 'Descartado', ingreso: 'Ingresó', cerrado_amable: 'Cerrado: no respondió',
};
const LE_ESTADOS_AYUDA = {
  nuevo: 'Todavía no se le mandó el primer mensaje.',
  contactado: 'Se le escribió y todavía no contestó.',
  cerrado_amable: 'Se le mandó el mensaje de cierre después de varios intentos sin respuesta; si vuelve a escribir, se reactiva.',
};
const LE_EN_FILA = ['nuevo', 'esperando', 'contactado', 'reconfirmo', 'evaluacion_agendada'];
const LE_FRANJAS = { manana: 'la mañana', tarde: 'la tarde' };
const LE_RESULTADOS = ['respondio_si', 'respondio_no', 'sin_respuesta', 'pidio_baja'];
// Las columnas de la hoja `espera` (las mismas que Hojas.js: una prueba las compara)
const LE_COLUMNAS = ['id', 'sede', 'sede_interes', 'fecha_alta', 'prioridad', 'nombre', 'celular', 'horario_texto', 'franjas', 'observaciones', 'estado', 'estado_ts', 'derivacion', 'evaluacion', 'interesado',
  'origen', 'referido_por', 'contacto_dni', 'consentimiento_fecha', 'consentimiento_canal', 'baja_pedida', 'intentos', 'recon_n', 'ultimo_contacto', 'proximo_contacto',
  'ultimo_mensaje_ts', 'ultima_respuesta', 'respondio_alguna_vez', 'lugar_ref', 'ofertas_perdidas', 'pases', 'fecha_ingreso', 'nota_pausa', 'cargada', 'creado_por'];
const LE_SEDES_BASE = { bariloche: 'Bariloche', bolson: 'El Bolsón', puelo: 'Lago Puelo' };

// Todo lo que se puede ajustar sin tocar código. Los beneficios son del catálogo de abajo (sin precios: los define coordinación).
const LE_CONFIG_DEFECTO = {
  tope_turno: 8,               // acciones por recepcionista por turno (por día)
  tope_sede: 15,               // acciones por sede por día
  dias_sin_reconfirmar: 90,    // una fila sin confirmación hace más de esto no cuenta para el «lugar» hasta que reconfirme
  dias_pausa: 90,              // sin respuesta tras 3 intentos y más de esto desde la última respuesta = pausa
  intentos_pausa: 3,
  dias_entre_mensajes: 7,      // máximo 1 mensaje por persona por semana (la oferta de lugar es la excepción)
  dias_entre_reconfirmaciones: 14,
  semana_reconfirma_1: 4, semana_reconfirma_2: 12, semana_cierre: 13,
  pase_lugares: 5,             // cuántos lugares adelanta un pase (referidos o discrecional)
  referidos_para_pase: 2,
  ventana_oferta_horas: 24,    // SUPUESTO a confirmar con Emanuel
  ofertas_perdidas_pausa: 2,
  beneficio_dias_en_lista: 30,
  beneficio_dias_entre: 60,
  tope_beneficios_mes: 10,     // por sede
  feriados: [],                // fechas AAAA-MM-DD sin trabajo: no cuentan como días hábiles para repartir
  dias_min_reparto: 5,         // al repartir, mirar al menos estos días hábiles hacia adelante (para no tirar todo junto a fin de mes)
  sedes_extra: [],             // [{clave:'nueva', nombre:'Sede nueva'}]: para una sede que todavía no está en el sistema
  // `mensaje`: clave de un mensaje propio (si no, el genérico «beneficio»). `solo_si_respondio`: solo para quien respondió los mensajes.
  // La presoterapia + café la aprobó Emanuel (25/11/2026) como bonificación por esperar con paciencia y por responder los mensajes.
  beneficios: [
    { clave: 'presoterapia', activo: true, tope_mes: 6, titulo: 'Sesión de botas de presoterapia + café (bonificada)', detalle: 'una sesión de botas de presoterapia y un café, pasando por el gimnasio',
      motivo: 'por esperar con paciencia y por responder los mensajes', mensaje: 'beneficio_presoterapia', solo_si_respondio: true },
    { clave: 'outdoor', activo: true, tope_mes: 10, titulo: 'Descuento en actividades outdoor o eventos', detalle: 'un descuento en nuestras actividades outdoor y eventos (el porcentaje lo define coordinación)' },
    { clave: 'charla', activo: true, tope_mes: 10, titulo: 'Charla o clase abierta', detalle: 'una charla o clase abierta de The Move Club' },
    { clave: 'nutricionista', activo: true, tope_mes: 10, titulo: 'Descuento con la nutricionista', detalle: 'un descuento en la consulta con nuestra nutricionista (el porcentaje lo define coordinación)' },
    { clave: 'charla_profe', activo: true, tope_mes: 10, titulo: 'Charla abierta con el profe', detalle: 'una charla abierta con uno de nuestros profes, para que nos conozcas y le hagas todas tus preguntas' },
  ],
  completar_por_dia: 5,        // personas con datos incompletos que se proponen completar por día (no cuentan en los topes de contactos)
};

// ---------- Catálogo de mensajes: un solo lugar para editarlos ----------
// Variables: {nombre} {recepcionista} {sede} {franja} {lugar} {lugar_antes} {profesional} {dia_horario} {limite} {hora} {profe} {beneficio} {servicio}
// Las que no se pueden saber (profe, hora, límite...) quedan entre llaves y la pantalla avisa que hay que completarlas.
const BAJA_PIE = ' Si preferís no recibir más mensajes, respondé BAJA.';
const MENSAJES_ESPERA = [
  { clave: 'primer_contacto_p3', titulo: 'Primer contacto (nuevo)', texto: 'Hola {nombre}, ¿cómo estás? Soy {recepcionista} de The Move Club {sede}. Vi que te interesó entrenar con nosotros en el horario de {franja}. Ahora mismo estamos completos en ese horario, pero te anoté en la lista de espera y apenas se libere un lugar te aviso. ¿Te sigue sirviendo ese horario o tenés otro que te quede cómodo? Un abrazo.' + BAJA_PIE },
  { clave: 'primer_contacto_p1', titulo: 'Primer contacto (viene de otro servicio)', texto: 'Hola {nombre}, soy {recepcionista} de The Move Club. {profesional} me contó que estás por terminar {servicio} y que te vendría bien seguir entrenando con nosotros. Te dejé anotado/a con prioridad en la lista de espera para {franja}. ¿Te parece que lo veamos? Cualquier duda me escribís por acá.' + BAJA_PIE },
  { clave: 'sigues_en_lista', titulo: '¿Seguís en lista?', texto: 'Hola {nombre}, ¿cómo andás? Te escribo para saber si seguís queriendo entrenar en {franja}. Todavía no se liberó lugar, pero no te perdimos de vista. Contestame con un «sí» si seguís en la lista, o avisame si cambió el horario. ¡Gracias!' + BAJA_PIE },
  { clave: 'lugar_disponible', titulo: 'Se liberó un lugar', texto: '¡Hola {nombre}! Buenas noticias: se liberó un lugar en {dia_horario} en {sede}. Es tuyo si lo querés. Te lo guardo hasta {limite}. ¿Lo tomamos? Contestame con un «sí» y coordinamos tu evaluación de ingreso.' },
  { clave: 'lugar_paso', titulo: 'El lugar pasó al siguiente', texto: 'Hola {nombre}, como no pudimos hablar, el lugar de {dia_horario} se lo ofrecimos a la siguiente persona de la lista. Seguís anotado/a y apenas haya otro te aviso. ¡Gracias por la paciencia!' },
  { clave: 'recordatorio_eval', titulo: 'Recordatorio de evaluación', texto: 'Hola {nombre}, te recuerdo tu evaluación en The Move Club {sede} {dia_horario} a las {hora} con {profe}. Traé ropa cómoda y agua. Si no podés venir, avisame y la reprogramamos. ¡Te esperamos!' },
  { clave: 'noshow_eval', titulo: 'Después de no venir a la evaluación', texto: 'Hola {nombre}, hoy te esperábamos a las {hora} y no pudiste venir, no pasa nada. Si querés, te agendo otro día. ¿Cuál te queda mejor?' },
  { clave: 'cierre_amable', titulo: 'Cierre amable', texto: 'Hola {nombre}, como no tuvimos respuesta, voy a dejar tu lugar en la lista en pausa para no molestarte. Si más adelante querés retomar, escribime y te anoto de nuevo. ¡Mucho éxito con tus entrenamientos!' },
  { clave: 'reactivacion_p2', titulo: 'Reactivación de ex socio', texto: 'Hola {nombre}, ¿cómo estás? Hace tiempo que no te vemos por The Move Club y te extrañamos. Si te dan ganas de retomar, te puedo anotar en la lista de espera con prioridad para {franja} y avisarte cuando haya un lugar. ¿Te interesa? Si no, no hay problema.' + BAJA_PIE },
  { clave: 'alta_mostrador', titulo: 'Alta en el momento (mostrador)', texto: 'Hola {nombre}, soy {recepcionista} de The Move Club. Te acabo de anotar en la lista de espera para {franja} en {sede}. Te escribo solo cuando haya novedades. Si no querés recibir más mensajes, avisame y te saco.' },
  { clave: 'estado_lista', titulo: 'Cómo viene la lista (estado)', texto: 'Hola {nombre}, te escribo de The Move Club {sede}. Seguís anotado/a en nuestra lista para entrenar en {franja}. Hoy no hay cupo en ese horario, pero te aviso apenas haya novedades.' + BAJA_PIE },
  { clave: 'valor_tip', titulo: 'Un tip de valor', texto: 'Hola {nombre}, te dejo un tip corto de uno de los profes por si te sirve: {tip}. Sin compromiso, es para que vayas entrando en calor mientras esperás.' },
  { clave: 'reconfirmacion', titulo: 'Reconfirmación de una palabra', texto: 'Hola {nombre}, ¿cómo venís? Para cuidar la lista te pregunto: ¿seguís con ganas de entrenar con nosotros? Contestame «sí», «pausa» o «baja» y listo, con una palabra alcanza.' },
  { clave: 'microtarea', titulo: 'Micro-tarea de 10 minutos', texto: 'Hola {nombre}, un desafío de 10 minutos: salí a caminar a paso rápido y después contame del 1 al 10 cómo te sentiste. Es para conocerte un poco antes de entrenar juntos.' },
  { clave: 'evento', titulo: 'Invitación a charla o clase abierta', texto: 'Hola {nombre}, el {dia_horario} hacemos una charla abierta de 30 minutos sobre cómo empezar a entrenar sin lesionarte. Es gratis y estás invitado/a. ¿Querés que te guarde lugar?' },
  { clave: 'cierre_amable_vuelvo', titulo: 'Cierre amable (escribí «vuelvo»)', texto: 'Hola {nombre}, no pudimos hablar en estas semanas y no quiero molestarte. Te dejo en pausa. Cuando quieras volver, escribime «vuelvo» y retomamos donde quedaste.' },
  { clave: 'beneficio_presoterapia', titulo: 'Gracias por esperar: presoterapia + café', texto: '¡Hola {nombre}! Gracias por tu paciencia mientras esperás tu lugar en The Move Club y por estar siempre en contacto. Como agradecimiento, te queremos invitar a una sesión de botas de presoterapia con un café, bonificada por nosotros. ¿Qué día te queda cómodo pasar por {sede}?' },
  { clave: 'beneficio', titulo: 'Algo para vos mientras esperás', texto: 'Hola {nombre}, mientras esperás tu lugar en {franja} queremos tener un detalle con vos: {beneficio}. Sin costo y sin compromiso. Si te interesa, escribime y lo coordinamos.' },
  { clave: 'avance', titulo: 'Se movió la fila', texto: '¡Hola {nombre}! Se movió la fila: ahora estás N° {lugar} para el horario de {franja} (antes {lugar_antes}). Es el orden de la lista, no una fecha: tu lugar depende de que se libere uno. Te sigo avisando.' },
  { clave: 'posicion', titulo: 'En qué lugar estás', texto: 'Hola {nombre}, te cuento cómo viene la lista: hoy estás en el lugar {lugar} para el horario de {franja}. Es el orden de la lista, no una fecha: no puedo prometerte cuándo, porque depende de que se libere un lugar. Cualquier cosa, escribime.' + BAJA_PIE },
];

// ---------- Utilidades puras ----------

function leDias(desde, hasta) {
  if (!fechaIsoValida(desde) || !fechaIsoValida(hasta)) return null;
  return Math.round((Date.parse(hasta + 'T12:00:00Z') - Date.parse(desde + 'T12:00:00Z')) / 86400000);
}

function leSinTildes(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function leNorm(s) {
  return leSinTildes(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function lePrimerNombre(s) {
  const p = texto(s).split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
}

// Celular argentino a formato internacional de WhatsApp: 549 + área + número (13 dígitos). '' si no se puede.
// Cubre: espacios y guiones, +54, 0 de larga distancia, 15 de celular, número local de 6 dígitos (se supone el área 2944).
// La notación científica de Excel (2,944E+9) ya perdió dígitos: no se puede recuperar.
function leNormalizarCelular(s, areaDefecto) {
  const area = areaDefecto || '2944';
  const t = texto(s);
  if (!t || /\d[eE][+-]?\d/.test(t)) return '';
  let d = t.replace(/\D/g, '').replace(/^00/, '');
  if (d.indexOf('54') === 0 && d.length >= 12) d = d.slice(2);
  if (d.charAt(0) === '9' && d.length === 11) d = d.slice(1);
  if (d.charAt(0) === '0') d = d.slice(1);
  if (d.length === 12) {
    if (d.slice(4, 6) === '15') d = d.slice(0, 4) + d.slice(6);
    else if (d.slice(3, 5) === '15') d = d.slice(0, 3) + d.slice(5);
  }
  if (d.length === 8 && d.slice(0, 2) === '15') d = area + d.slice(2);
  if (d.length === 6) d = area + d;
  if (d.length !== 10 || !/^[23]/.test(d)) return '';
  return '549' + d;
}

// Franjas que pide el texto libre del horario: «07 a 11HS» → manana, «16 a 20» → tarde, «10 a 15» → ambas. Mismo criterio que el script de carga de la PC.
function leFranjasDeTexto(t) {
  const s = leSinTildes(t).toLowerCase();
  const out = {};
  if (/\bmanana\b|\bmaniana\b/.test(s)) out.manana = true;
  if (/\btarde\b|\bnoche\b/.test(s)) out.tarde = true;
  const hora = (h, suf) => {
    h = Number(h);
    if (suf === 'pm' && h < 12) h += 12;
    else if (!suf && h >= 1 && h <= 6) h += 12;   // «4 a 8» sin más es de la tarde
    return h;
  };
  const rango = /(\d{1,2})(?::\d{2})?\s*(am|pm)?\s*(?:hs|h)?\s*(?:a|-|–|hasta)\s*(\d{1,2})(?::\d{2})?\s*(am|pm)?/g;
  let m, hubo = false;
  while ((m = rango.exec(s))) {
    hubo = true;
    const a = hora(m[1], m[2] || m[4]), b = hora(m[3], m[4] || m[2]);
    const ini = Math.min(a, b), fin = Math.max(a, b);
    if (ini < 13) out.manana = true;
    if (fin > 13 || ini >= 13) out.tarde = true;
  }
  if (!hubo) {
    const uno = /(\d{1,2})(?::\d{2})?\s*(am|pm|hs|h)\b/.exec(s);
    if (uno) {
      const h = hora(uno[1], uno[2] === 'am' || uno[2] === 'pm' ? uno[2] : '');
      if (h < 13) out.manana = true; else out.tarde = true;
    }
  }
  return ['manana', 'tarde'].filter(f => out[f]);
}

// ---------- Datos obligatorios (Emanuel, 25/11/2026) ----------
// Para anotar a alguien hacen falta: nombre y apellido (2 palabras), un celular válido y al menos una franja (mañana / tarde).
// La carga de la planilla vieja los acepta incompletos (ya estaban cargados): la persona se marca «Faltan datos» y la tarea del día propone completarlos.
const LE_DATOS_TXT = { nombre: 'nombre y apellido', celular: 'un celular válido', franja: 'la franja horaria (mañana o tarde)' };

function leNombreCompleto(s) {
  return texto(s).split(/\s+/).filter(x => /[a-zA-ZÀ-ÿ]/.test(x)).length >= 2;
}

function leFaltanDatos(p) {
  const out = [];
  if (!leNombreCompleto(p.nombre)) out.push('nombre');
  if (!/^549\d{10}$/.test(texto(p.celular))) out.push('celular');
  if (!leFranjasDe(p).length) out.push('franja');
  return out;
}

function leConfig(deps) {
  const cfg = JSON.parse(JSON.stringify(LE_CONFIG_DEFECTO));
  deps.repo.leer('espera_config').forEach(f => {
    if (!Object.prototype.hasOwnProperty.call(LE_CONFIG_DEFECTO, f.clave)) return;
    const v = leerJson(f.valor, undefined);
    if (v !== undefined && typeof v === typeof LE_CONFIG_DEFECTO[f.clave]) cfg[f.clave] = v;
  });
  return cfg;
}

function leSedes(cfg) {
  const o = Object.assign({}, LE_SEDES_BASE);
  (cfg.sedes_extra || []).forEach(s => { if (s && /^[a-z0-9_]{2,20}$/.test(s.clave) && s.nombre) o[s.clave] = String(s.nombre).slice(0, 40); });
  return o;
}

function leFranjasDe(p) {
  return texto(p.franjas).split(',').map(x => x.trim()).filter(f => LE_FRANJAS[f]);
}

function lePases(p) {
  const x = leerJson(p.pases, []);
  return Array.isArray(x) ? x : [];
}

function leEnFila(p) {
  return LE_EN_FILA.indexOf(p.estado) >= 0 && !p.baja_pedida;
}

// Última vez que hubo señal de vida: respuesta, reconfirmación o, si no, el alta. Sin fecha no hay referencia.
function leReferencia(p) {
  const fechas = [p.ultima_respuesta, p.fecha_alta].filter(fechaIsoValida).sort();
  return fechas.length ? fechas[fechas.length - 1] : '';
}

function leVigente(p, hoy, cfg) {
  if (p.estado === 'evaluacion_agendada') return true;
  const ref = leReferencia(p);
  if (!ref) return false;
  return leDias(ref, hoy) <= cfg.dias_sin_reconfirmar;
}

function leDiasEnLista(p, hoy) {
  const d = leDias(p.fecha_alta, hoy);
  return d == null ? null : Math.max(0, d);
}

function lePrio(p) {
  const n = Number(p.prioridad);
  return n === 1 || n === 2 ? n : 3;
}

// Orden de una franja: prioridad, antigüedad (sin fecha, al final) y después los pases (cada uno adelanta N lugares dentro de su prioridad)
function leOrdenFranja(personas, sede, franja, hoy, cfg, soloVigentes) {
  const miembros = personas.filter(p => p.sede === sede && leEnFila(p) && leFranjasDe(p).indexOf(franja) >= 0 && (!soloVigentes || leVigente(p, hoy, cfg)));
  const cmp = (a, b) => {
    const fa = fechaIsoValida(a.fecha_alta) ? a.fecha_alta : '9999-99-99', fb = fechaIsoValida(b.fecha_alta) ? b.fecha_alta : '9999-99-99';
    return fa < fb ? -1 : fa > fb ? 1 : (a.id < b.id ? -1 : 1);
  };
  let out = [];
  [1, 2, 3].forEach(n => {
    const grupo = miembros.filter(p => lePrio(p) === n).sort(cmp);
    const conPase = [];
    grupo.forEach(p => lePases(p).forEach(x => conPase.push({ id: p.id, ts: String(x.ts || ''), lugares: Math.max(0, Number(x.lugares) || 0) })));
    conPase.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0)).forEach(x => {
      const i = grupo.findIndex(p => p.id === x.id);
      const p = grupo.splice(i, 1)[0];
      grupo.splice(Math.max(0, i - x.lugares), 0, p);
    });
    out = out.concat(grupo);
  });
  return out;
}

// {id: [{franja, lugar, total}]} solo con las filas vigentes
function leLugares(personas, sede, hoy, cfg) {
  const m = {};
  Object.keys(LE_FRANJAS).forEach(f => {
    const orden = leOrdenFranja(personas, sede, f, hoy, cfg, true);
    orden.forEach((p, i) => { (m[p.id] = m[p.id] || []).push({ franja: f, lugar: i + 1, total: orden.length }); });
  });
  return m;
}

function leMejorLugar(lugares) {
  return (lugares || []).slice().sort((a, b) => a.lugar - b.lugar)[0] || null;
}

// ---------- Mensajes ----------

function leMensajeCatalogo() {
  return MENSAJES_ESPERA.map(m => ({ clave: m.clave, titulo: m.titulo }));
}

function leFranjaTexto(p, clave) {
  const f = leFranjasDe(p);
  if (clave) return LE_FRANJAS[clave] || clave;
  if (f.length === 1) return LE_FRANJAS[f[0]];
  if (f.length === 2) return 'la mañana o la tarde';
  return texto(p.horario_texto) || 'el horario que pediste';
}

// Arma el texto listo para copiar. `ctx`: recepcionista, sedes, lugar, lugar_antes, beneficio, franja + lo que se quiera pisar.
function leArmarMensaje(clave, p, ctx) {
  const def = MENSAJES_ESPERA.find(m => m.clave === clave);
  if (!def) return null;
  const sedes = ctx.sedes || LE_SEDES_BASE;
  const vars = Object.assign({
    nombre: lePrimerNombre(p.nombre), recepcionista: lePrimerNombre(ctx.recepcionista), sede: sedes[p.sede] || p.sede,
    franja: leFranjaTexto(p, ctx.franja),
  }, ctx.vars || {});
  if (clave === 'primer_contacto_p1') {   // «viene de otro servicio»: lo que se sabe por el origen; si no, palabras neutras
    const serv = { kine: 'kinesiología', rf: 'readaptación física', rh: 'rehabilitación' }[leNorm(p.origen).split(' ')[0]];
    vars.servicio = vars.servicio || serv || 'tu tratamiento';
    vars.profesional = vars.profesional || 'Tu profesional';
  }
  const faltan = [];
  const txt = def.texto.replace(/\{(\w+)\}/g, (m, k) => {
    if (vars[k] != null && vars[k] !== '') return String(vars[k]);
    if (faltan.indexOf(k) < 0) faltan.push(k);
    return m;
  });
  const celular = texto(p.celular);
  return { clave: clave, titulo: def.titulo, texto: txt, faltan: faltan, wa: celular && !faltan.length ? 'https://wa.me/' + celular + '?text=' + encodeURIComponent(txt) : '' };
}

// ---------- Acceso ----------

function leEsCoord(u) {
  return tieneRol(u, 'coordinador') || tieneRol(u, 'admin');
}

function leAcceso(usuario) {
  if (!tieneRol(usuario, 'recepcion') && !leEsCoord(usuario)) falla('prohibido');
}

function leVeSede(usuario, sede) {
  return leEsCoord(usuario) || usuario.sede === sede;
}

function leIso(deps) {
  return new Date(deps.ahora()).toISOString();
}

function leCargar(deps) {
  return deps.repo.leer('espera');
}

function leGuardar(deps, personas) {
  deps.repo.escribir('espera', personas);
}

function leHist(deps, personaId, usuario, tipo, extra) {
  deps.repo.agregar('espera_hist', Object.assign({ id: 'lh-' + deps.aleatorio(5), persona_id: personaId, ts: leIso(deps), dni: usuario ? usuario.dni : '',
    nombre: usuario ? usuario.nombre : '', tipo: tipo, mensaje_clave: '', resultado: '', detalle: '', verif: '', verif_ts: '' }, extra || {}));
}

// Dueño del contacto: el que tenga puesto la persona; si no, la recepcionista activa de la sede que trabaja en su franja
function leDueno(p, usuarios) {
  if (p.contacto_dni) {
    const u = usuarios.find(x => x.dni === p.contacto_dni && esVerdad(x.activo));
    if (u) return u;
  }
  const rec = usuarios.filter(u => esVerdad(u.activo) && tieneRol(u, 'recepcion') && u.sede === p.sede)
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  const f = leFranjasDe(p)[0] || 'manana';
  return rec.find(u => u.turno === f) || rec[0] || null;
}

function leVistaPersona(p, hoy, cfg, usuarios, lugares) {
  const mejor = leMejorLugar(lugares[p.id]);
  const dueno = leDueno(p, usuarios);
  return {
    id: p.id, sede: p.sede, sede_interes: p.sede_interes, fecha_alta: p.fecha_alta, prioridad: lePrio(p), nombre: p.nombre, celular: p.celular,
    horario_texto: p.horario_texto, franjas: leFranjasDe(p), observaciones: p.observaciones, estado: p.estado, derivacion: p.derivacion,
    evaluacion: p.evaluacion, interesado: p.interesado, origen: p.origen, referido_por: p.referido_por,
    consentimiento_fecha: p.consentimiento_fecha, consentimiento_canal: p.consentimiento_canal, baja_pedida: p.baja_pedida,
    intentos: Number(p.intentos) || 0, ultimo_contacto: p.ultimo_contacto, proximo_contacto: p.proximo_contacto, ultima_respuesta: p.ultima_respuesta,
    respondio_alguna_vez: esVerdad(p.respondio_alguna_vez), dias_en_lista: leDiasEnLista(p, hoy), vigente: leEnFila(p) && leVigente(p, hoy, cfg),
    lugares: lugares[p.id] || [], lugar: mejor ? mejor.lugar : null, lugar_franja: mejor ? mejor.franja : '',
    pases: lePases(p), ofertas_perdidas: Number(p.ofertas_perdidas) || 0,
    dueno_dni: dueno ? dueno.dni : '', dueno_nombre: dueno ? dueno.nombre : '', contacto_dni: p.contacto_dni,
    faltan: leFaltanDatos(p),
  };
}

function leEquipoContacto(usuarios) {
  return usuarios.filter(u => esVerdad(u.activo) && tieneRol(u, 'recepcion')).map(u => ({ dni: u.dni, nombre: u.nombre, sede: u.sede, turno: u.turno }));
}

// ---------- Ver ----------

function esperaVer(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  leAcceso(usuario);
  const hoy = deps.hoy(), cfg = leConfig(deps), sedes = leSedes(cfg);
  const todas = leCargar(deps);
  const visibles = todas.filter(p => leVeSede(usuario, p.sede));
  const sedesVer = leEsCoord(usuario) ? Object.keys(sedes) : [usuario.sede];
  const lugares = {};
  sedesVer.forEach(s => Object.assign(lugares, leLugares(todas, s, hoy, cfg)));
  const ofertas = deps.repo.leer('espera_ofertas').filter(o => leVeSede(usuario, o.sede) && o.estado === 'ofrecida');
  return {
    hoy: hoy, es_coord: leEsCoord(usuario), mi_sede: usuario.sede, sedes: sedesVer.map(c => ({ clave: c, nombre: sedes[c] })),
    estados: LE_ESTADOS, estados_ayuda: LE_ESTADOS_AYUDA, datos_txt: LE_DATOS_TXT, franjas: LE_FRANJAS, mensajes: leMensajeCatalogo(),
    personas: visibles.map(p => leVistaPersona(p, hoy, cfg, usuarios, lugares)),
    ofertas: ofertas.map(o => ({ id: o.id, persona_id: o.persona_id, vence_ts: o.vence_ts, franja: o.franja })),
    equipo: leEsCoord(usuario) ? leEquipoContacto(usuarios) : [],
    beneficios: cfg.beneficios.filter(b => b.activo).map(b => ({ clave: b.clave, titulo: b.titulo })),
    config: leEsCoord(usuario) ? cfg : { pase_lugares: cfg.pase_lugares, ventana_oferta_horas: cfg.ventana_oferta_horas },
  };
}

function lePersonaVisible(req, deps, usuario) {
  const todas = leCargar(deps);
  const p = todas.find(x => x.id === texto(req.id));
  if (!p) falla('no_existe');
  if (!leVeSede(usuario, p.sede)) falla('prohibido');
  return { p: p, todas: todas };
}

function esperaMensaje(req, deps) {
  const { usuario } = sesion(req, deps);
  leAcceso(usuario);
  const { p, todas } = lePersonaVisible(req, deps, usuario);
  const cfg = leConfig(deps), hoy = deps.hoy();
  const lugares = leLugares(todas, p.sede, hoy, cfg)[p.id] || [];
  const mejor = leMejorLugar(lugares);
  const ctx = { recepcionista: usuario.nombre, sedes: leSedes(cfg), vars: {} };
  if (mejor) { ctx.vars.lugar = mejor.lugar; ctx.franja = mejor.franja; }
  if (req.clave === 'posicion' && !mejor) falla('espera_sin_lugar');
  if (p.lugar_ref) ctx.vars.lugar_antes = p.lugar_ref;
  const m = leArmarMensaje(texto(req.clave), p, ctx);
  if (!m) falla('datos_invalidos');
  return { mensaje: m };
}

function esperaHistorial(req, deps) {
  const { usuario } = sesion(req, deps);
  leAcceso(usuario);
  const { p } = lePersonaVisible(req, deps, usuario);
  const filas = deps.repo.leer('espera_hist').filter(h => h.persona_id === p.id).sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return { persona_id: p.id, historial: filas.slice(0, 60).map(h => ({ ts: h.ts, fecha: fechaArgentina(h.ts), quien: h.nombre, tipo: h.tipo, mensaje_clave: h.mensaje_clave, resultado: h.resultado, detalle: h.detalle, verif: h.verif })) };
}

// ---------- Alta ----------

function leNuevoId(deps) {
  return 'le-' + deps.aleatorio(5);
}

function lePersonaVacia() {
  const o = {};
  LE_COLUMNAS.forEach(c => { o[c] = ''; });
  o.intentos = '0'; o.recon_n = '0'; o.ofertas_perdidas = '0'; o.pases = '[]';
  return o;
}

function leCelularIgual(a, b) {
  return a.celular && b.celular && a.celular === b.celular;
}

// Pase por referidos: cada 2 personas anotadas con referido_por = esta persona, un pase de N lugares (queda en el historial)
function leAplicarPasesReferidos(deps, todas, usuario, cfg) {
  const cambios = [];
  todas.forEach(r => {
    if (!leEnFila(r)) return;
    const n = todas.filter(x => x.id !== r.id && x.referido_por && (x.referido_por === r.id || (x.sede === r.sede && leNorm(x.referido_por) === leNorm(r.nombre)))).length;
    const pases = lePases(r);
    const dados = pases.filter(x => x.tipo === 'referido').length;
    const debe = Math.floor(n / cfg.referidos_para_pase);
    if (debe > dados) {
      for (let i = dados; i < debe; i++) pases.push({ lugares: cfg.pase_lugares, ts: leIso(deps), tipo: 'referido', motivo: 'Trajo a ' + cfg.referidos_para_pase + ' personas que se anotaron', auto: true });
      r.pases = JSON.stringify(pases);
      leHist(deps, r.id, usuario, 'pase', { detalle: 'Pase de prioridad automático: +' + cfg.pase_lugares + ' lugares dentro de su prioridad (referidos)' });
      cambios.push(r.id);
    }
  });
  return cambios;
}

function esperaAlta(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  leAcceso(usuario);
  const cfg = leConfig(deps), sedes = leSedes(cfg), hoy = deps.hoy();
  const sede = leEsCoord(usuario) && texto(req.sede) ? texto(req.sede) : usuario.sede;
  if (!sedes[sede]) falla('datos_invalidos');
  if (!leVeSede(usuario, sede)) falla('prohibido');
  const nombre = texto(req.nombre).replace(/\s+/g, ' ').slice(0, 80);
  if (!leNombreCompleto(nombre)) falla('espera_nombre_incompleto');
  const celular = leNormalizarCelular(req.celular);
  if (!celular) falla('celular_invalido');
  const horario = texto(req.horario).slice(0, 120);
  let franjas = Array.isArray(req.franjas) ? req.franjas.filter(f => LE_FRANJAS[f]) : leFranjasDe({ franjas: texto(req.franjas) });
  if (!franjas.length) franjas = leFranjasDeTexto(horario);
  const prioridad = [1, 2, 3].indexOf(Number(req.prioridad)) >= 0 ? Number(req.prioridad) : 3;
  const sedeInteres = texto(req.sede_interes) || sede;
  if (!sedes[sedeInteres] && sedeInteres.length > 40) falla('datos_invalidos');
  const todas = leCargar(deps);
  const igual = todas.find(p => p.sede === sede && p.celular === celular && p.estado !== 'ingreso');
  if (igual) {
    const lugares = leLugares(todas, sede, hoy, cfg);
    return { duplicado: leVistaPersona(igual, hoy, cfg, usuarios, lugares) };
  }
  if (!franjas.length) falla('espera_sin_franja');   // después del duplicado: si ya está anotada, eso es lo que importa
  const p = lePersonaVacia();
  const consent = req.consentimiento === true || esVerdad(req.consentimiento);
  Object.assign(p, { id: leNuevoId(deps), sede: sede, sede_interes: sedeInteres.slice(0, 40), fecha_alta: hoy, prioridad: String(prioridad), nombre: nombre, celular: celular,
    horario_texto: horario, franjas: franjas.join(','), observaciones: texto(req.observaciones).slice(0, 300), estado: consent ? 'esperando' : 'nuevo',
    origen: texto(req.origen).slice(0, 40) || 'mostrador', referido_por: texto(req.referido_por).slice(0, 80), cargada: hoy, creado_por: usuario.dni,
    consentimiento_fecha: consent ? hoy : '', consentimiento_canal: consent ? 'mostrador' : '' });
  p.contacto_dni = (leDueno(p, usuarios) || {}).dni || '';
  todas.push(p);
  leHist(deps, p.id, usuario, 'alta', { detalle: 'Alta en el momento · prioridad ' + prioridad + (p.referido_por ? ' · referido por ' + p.referido_por : '') });
  leAplicarPasesReferidos(deps, todas, usuario, cfg);
  leGuardar(deps, todas);
  const lugares = leLugares(todas, sede, hoy, cfg);
  const mejor = leMejorLugar(lugares[p.id]);
  const m = leArmarMensaje('alta_mostrador', p, { recepcionista: usuario.nombre, sedes: sedes, franja: mejor ? mejor.franja : '' });
  return { persona: leVistaPersona(p, hoy, cfg, usuarios, lugares), mensaje: m };
}

// ---------- Editar ----------

const LE_EDITABLES = ['nombre', 'celular', 'horario_texto', 'franjas', 'prioridad', 'observaciones', 'sede_interes', 'derivacion', 'evaluacion', 'estado', 'interesado'];
const LE_ESTADOS_MANUALES = ['nuevo', 'esperando', 'contactado', 'reconfirmo', 'evaluacion_agendada', 'pausa', 'descartado', 'ingreso', 'cerrado_amable'];

function esperaActualizar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  leAcceso(usuario);
  const { p, todas } = lePersonaVisible(req, deps, usuario);
  const cfg = leConfig(deps), sedes = leSedes(cfg), hoy = deps.hoy();
  const c = req.campos && typeof req.campos === 'object' ? req.campos : {};
  const cambios = [];
  Object.keys(c).forEach(k => {
    const v = texto(c[k]);
    if (k === 'contacto_dni' || k === 'sede') {
      if (!leEsCoord(usuario)) falla('prohibido');
      if (k === 'sede' && !sedes[v]) falla('datos_invalidos');
      if (k === 'contacto_dni' && v && !usuarios.some(u => u.dni === v && esVerdad(u.activo) && tieneRol(u, 'recepcion'))) falla('datos_invalidos');
      if (p[k] !== v) { cambios.push(k + ': ' + (p[k] || '—') + ' → ' + (v || '—')); p[k] = v; }
      return;
    }
    if (k === 'consentimiento') {
      if (esVerdad(c[k]) && !p.consentimiento_fecha) { p.consentimiento_fecha = hoy; p.consentimiento_canal = 'mostrador'; cambios.push('consentimiento de WhatsApp'); }
      return;
    }
    if (LE_EDITABLES.indexOf(k) < 0) falla('datos_invalidos');
    let nuevo = v;
    if (k === 'celular') { nuevo = leNormalizarCelular(v); if (!nuevo) falla('celular_invalido'); }
    else if (k === 'nombre') { nuevo = v.replace(/\s+/g, ' ').slice(0, 80); if (!leNombreCompleto(nuevo)) falla('espera_nombre_incompleto'); }
    else if (k === 'prioridad') { if (['1', '2', '3'].indexOf(v) < 0) falla('datos_invalidos'); }
    else if (k === 'franjas') { nuevo = (Array.isArray(c[k]) ? c[k] : v.split(',')).map(x => texto(x)).filter(f => LE_FRANJAS[f]).join(','); if (!nuevo) falla('espera_sin_franja'); }
    else if (k === 'estado') {
      if (LE_ESTADOS_MANUALES.indexOf(v) < 0) falla('datos_invalidos');
      if (p.baja_pedida && LE_EN_FILA.indexOf(v) >= 0) falla('espera_baja_pedida');
    } else nuevo = v.slice(0, k === 'observaciones' ? 300 : 120);
    if (p[k] !== nuevo) { cambios.push(k + ': ' + (p[k] || '—') + ' → ' + (nuevo || '—')); p[k] = nuevo; if (k === 'estado') { p.estado_ts = leIso(deps); if (nuevo === 'esperando' || nuevo === 'reconfirmo') { p.ultima_respuesta = hoy; p.intentos = '0'; p.recon_n = '0'; } } }
  });
  if (!cambios.length) return { persona: leVistaPersona(p, hoy, cfg, usuarios, leLugares(todas, p.sede, hoy, cfg)) };
  leHist(deps, p.id, usuario, 'edicion', { detalle: cambios.join(' · ').slice(0, 300) + (texto(req.motivo) ? ' · ' + texto(req.motivo).slice(0, 120) : '') });
  leGuardar(deps, todas);
  return { persona: leVistaPersona(p, hoy, cfg, usuarios, leLugares(todas, p.sede, hoy, cfg)) };
}

// Pase discrecional: solo coordinación, con motivo, queda registrado
function esperaPase(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!leEsCoord(usuario)) falla('prohibido');
  const { p, todas } = lePersonaVisible(req, deps, usuario);
  const cfg = leConfig(deps), hoy = deps.hoy();
  const lugares = Number(req.lugares), motivo = texto(req.motivo).slice(0, 200);
  if (!(lugares >= 1 && lugares <= 20) || !motivo) falla('datos_invalidos');
  const pases = lePases(p);
  pases.push({ lugares: Math.floor(lugares), ts: leIso(deps), tipo: 'discrecional', motivo: motivo, por: usuario.nombre });
  p.pases = JSON.stringify(pases);
  leHist(deps, p.id, usuario, 'pase', { detalle: 'Pase discrecional +' + Math.floor(lugares) + ' lugares: ' + motivo });
  leGuardar(deps, todas);
  return { persona: leVistaPersona(p, hoy, cfg, usuarios, leLugares(todas, p.sede, hoy, cfg)) };
}

// ---------- Resultado de un contacto ----------

function leFechaOpcional(v) {
  v = texto(v);
  if (v && !fechaIsoValida(v)) falla('datos_invalidos');
  return v;
}

function esperaResultado(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  leAcceso(usuario);
  const { p, todas } = lePersonaVisible(req, deps, usuario);
  const cfg = leConfig(deps), hoy = deps.hoy(), ahora = leIso(deps);
  const resultado = texto(req.resultado), clave = texto(req.mensaje_clave), tipo = texto(req.tarea_tipo);
  if (LE_RESULTADOS.indexOf(resultado) < 0) falla('datos_invalidos');
  if (clave && !MENSAJES_ESPERA.some(m => m.clave === clave)) falla('datos_invalidos');
  const envio = req.envio !== false;   // false = la persona escribió primero y no mandamos nada
  const esOferta = clave === 'lugar_disponible' || clave === 'lugar_paso';
  if (envio && !esOferta && p.ultimo_mensaje_ts) {
    const d = leDias(fechaArgentina(p.ultimo_mensaje_ts), hoy);
    if (d != null && d < cfg.dias_entre_mensajes && !(leEsCoord(usuario) && req.forzar === true)) falla('espera_semana');
  }
  const proximo = leFechaOpcional(req.proximo);
  p.ultimo_contacto = hoy;
  if (envio) p.ultimo_mensaje_ts = ahora;
  if (proximo) p.proximo_contacto = proximo;
  if (envio && (clave === 'reconfirmacion' || clave === 'sigues_en_lista')) p.recon_n = String((Number(p.recon_n) || 0) + 1);
  if (envio && (clave === 'avance' || clave === 'posicion')) {
    const mejor = leMejorLugar(leLugares(todas, p.sede, hoy, cfg)[p.id]);
    if (mejor) p.lugar_ref = String(mejor.lugar);
  }
  if (resultado === 'respondio_si') {
    p.intentos = '0'; p.recon_n = '0'; p.ultima_respuesta = hoy; p.respondio_alguna_vez = 'true';
    if (!p.consentimiento_fecha) { p.consentimiento_fecha = hoy; p.consentimiento_canal = 'respuesta por WhatsApp'; }
    if (['nuevo', 'esperando', 'contactado', 'pausa', 'cerrado_amable'].indexOf(p.estado) >= 0) { p.estado = 'reconfirmo'; p.estado_ts = ahora; }
  } else if (resultado === 'respondio_no') {
    p.ultima_respuesta = hoy; p.respondio_alguna_vez = 'true'; p.estado = 'descartado'; p.estado_ts = ahora;
  } else if (resultado === 'pidio_baja') {
    p.baja_pedida = hoy; p.estado = 'descartado'; p.estado_ts = ahora; p.proximo_contacto = '';
  } else {   // sin_respuesta
    p.intentos = String((Number(p.intentos) || 0) + 1);
    if (p.estado === 'nuevo' || p.estado === 'esperando') { p.estado = 'contactado'; p.estado_ts = ahora; }
    if (clave === 'cierre_amable' || clave === 'cierre_amable_vuelvo') { p.estado = 'cerrado_amable'; p.estado_ts = ahora; }
    else leAutoPausa(p, hoy, cfg, ahora);
  }
  leHist(deps, p.id, usuario, 'contacto', { verif: 'pendiente', mensaje_clave: clave, resultado: resultado, detalle: ((tipo ? tipo + ' · ' : '') + texto(req.nota)).slice(0, 300) });
  leCerrarReabiertas(deps, p.id);
  leGuardar(deps, todas);
  return { persona: leVistaPersona(p, hoy, cfg, usuarios, leLugares(todas, p.sede, hoy, cfg)) };
}

// 3 intentos sin respuesta y más de 90 días desde la última señal de vida: PAUSA (no se archiva ni se borra; se reactiva a mano)
function leAutoPausa(p, hoy, cfg, ahora) {
  if (!leEnFila(p) || p.estado === 'evaluacion_agendada') return false;
  const ref = leReferencia(p);
  if ((Number(p.intentos) || 0) >= cfg.intentos_pausa && (!ref || leDias(ref, hoy) > cfg.dias_pausa)) {
    p.estado = 'pausa'; p.estado_ts = ahora; p.nota_pausa = 'Sin respuesta tras ' + p.intentos + ' intentos';
    return true;
  }
  return false;
}

// ---------- Tareas de hoy ----------

const LE_RANGO = { oferta_vencida: 0, revisar: 1, primer_contacto: 1, reconfirmacion: 2, seguimiento: 2, cierre: 2, avance: 3, beneficio: 4 };

function leBeneficiosDelMes(filas, sede, hoy, clave) {
  const mes = hoy.slice(0, 7);
  return filas.filter(b => b.sede === sede && String(b.ts).slice(0, 7) === mes && b.estado !== 'cancelado' && (!clave || b.beneficio === clave)).length;
}

function leTarea(deps, tipo, p, extra) {
  return Object.assign({ persona_id: p.id, tipo: tipo, nombre: p.nombre, celular: p.celular, prioridad: lePrio(p), sede: p.sede, rango: LE_RANGO[tipo] }, extra || {});
}

// ---------- Reparto parejo en el mes y verificación al día siguiente (Emanuel, 24/11/2026) ----------

function leEsHabil(iso, cfg) {
  const d = new Date(iso + 'T12:00:00Z').getUTCDay();
  return d >= 1 && d <= 5 && (cfg.feriados || []).indexOf(iso) < 0;
}

// Días hábiles que quedan para repartir, contando hoy: hasta fin de mes y, como mínimo, `dias_min_reparto`
function leDiasHabilesRestantes(hoy, cfg) {
  const mes = hoy.slice(0, 7);
  let n = 0, d = hoy;
  for (let i = 0; i < 70; i++) {
    if (d.slice(0, 7) !== mes && n >= cfg.dias_min_reparto) break;
    if (leEsHabil(d, cfg)) n++;
    d = sumarDias(d, 1);
  }
  return Math.max(1, n);
}

// Cuántas acciones le tocan hoy: lo pendiente (más lo que ya hizo hoy) repartido en los días hábiles que quedan, sin pasar de los topes de turno y de sede.
// Lo atrasado no se acumula: mañana se vuelve a calcular con lo que quedó. Mismo criterio que pulso_profes.repartir: max(1, ceil(pendientes / días hábiles)).
function leCuotaDelDia(pendientes, hechasYo, hechasSede, hoy, cfg) {
  const dias = leDiasHabilesRestantes(hoy, cfg);
  const habil = leEsHabil(hoy, cfg);
  const tope = Math.max(1, Math.ceil((pendientes + hechasYo) / dias));
  const cuota = habil ? Math.max(0, Math.min(tope, cfg.tope_turno, cfg.tope_sede) - hechasYo) : 0;
  return { dias_habiles: dias, habil: habil, tope_dia: tope, cuota: Math.max(0, Math.min(cuota, cfg.tope_sede - hechasSede)) };
}

// Al otro día se mira lo que se pueda comprobar de cada contacto marcado como hecho: comprobada (hay una respuesta registrada) o
// «hecha, sin comprobar» (no hay forma de saberlo, y no pasa nada). Se reabre solo si la evidencia la contradice (ver cargarEsperaEvidencia).
function leVerificarAyer(deps, todas, hoy) {
  const hist = deps.repo.leer('espera_hist');
  const ahora = leIso(deps);
  let cambio = false;
  hist.forEach(h => {
    if (h.tipo !== 'contacto' || h.verif !== 'pendiente' || !(fechaArgentina(h.ts) < hoy)) return;
    const p = todas.find(x => x.id === h.persona_id);
    const respondio = h.resultado === 'respondio_si' || h.resultado === 'respondio_no' || h.resultado === 'pidio_baja'
      || (p && fechaIsoValida(p.ultima_respuesta) && p.ultima_respuesta >= fechaArgentina(h.ts));
    h.verif = respondio ? 'comprobada' : 'sin_comprobar'; h.verif_ts = ahora; cambio = true;
  });
  if (cambio) deps.repo.escribir('espera_hist', hist);
}

function leCerrarReabiertas(deps, personaId) {
  const hist = deps.repo.leer('espera_hist');
  let cambio = false;
  hist.forEach(h => { if (h.persona_id === personaId && h.tipo === 'verificacion' && h.verif === 'reabierta') { h.verif = 'atendida'; cambio = true; } });
  if (cambio) deps.repo.escribir('espera_hist', hist);
}

// La PC (o MOVE) aporta evidencia: [{persona_id, ok}]. ok = true confirma lo último que se marcó como hecho; ok = false lo contradice
// (ej.: figuraba una evaluación agendada y MOVE no la muestra) y reabre a la persona como tarea, sin castigo para nadie.
function cargarEsperaEvidencia(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas)) falla('datos_invalidos');
  const todas = leCargar(deps), hist = deps.repo.leer('espera_hist');
  let confirmadas = 0, reabiertas = 0;
  const ahora = leIso(deps);
  req.filas.forEach(x => {
    const p = todas.find(q => q.id === texto(x && x.persona_id));
    if (!p) return;
    if (x.ok === true) {
      hist.forEach(h => { if (h.persona_id === p.id && h.tipo === 'contacto' && h.verif === 'sin_comprobar') { h.verif = 'comprobada'; h.verif_ts = ahora; confirmadas++; } });
    } else if (x.ok === false && leEnFila(p) && !hist.some(h => h.persona_id === p.id && h.tipo === 'verificacion' && h.verif === 'reabierta')) {
      if (p.estado === 'evaluacion_agendada') { p.estado = 'reconfirmo'; p.estado_ts = ahora; }
      hist.push({ id: 'lh-' + deps.aleatorio(5), persona_id: p.id, ts: ahora, dni: '', nombre: '', tipo: 'verificacion', mensaje_clave: '', resultado: 'reabierta',
        detalle: texto(x.detalle).slice(0, 200) || 'la evidencia no coincide', verif: 'reabierta', verif_ts: ahora });
      reabiertas++;
    }
  });
  deps.repo.escribir('espera_hist', hist);
  leGuardar(deps, todas);
  return { confirmadas: confirmadas, reabiertas: reabiertas };
}

// Barrido que se hace al abrir la pantalla: ofertas vencidas y pausas automáticas. Solo escribe si algo cambió.
function leBarrer(deps, todas, cfg, hoy) {
  const ahora = leIso(deps);
  let cambio = false;
  leVerificarAyer(deps, todas, hoy);
  const ofertas = deps.repo.leer('espera_ofertas');
  let cambioOfertas = false;
  ofertas.forEach(o => {
    if (o.estado === 'ofrecida' && o.vence_ts < ahora) {
      o.estado = 'vencida'; cambioOfertas = true;
      const p = todas.find(x => x.id === o.persona_id);
      if (p) {
        p.ofertas_perdidas = String((Number(p.ofertas_perdidas) || 0) + 1);
        leHist(deps, p.id, null, 'oferta', { resultado: 'vencida', detalle: 'No respondió en la ventana de ' + cfg.ventana_oferta_horas + ' h: el lugar pasa al siguiente' });
        if (Number(p.ofertas_perdidas) >= cfg.ofertas_perdidas_pausa && leEnFila(p)) { p.estado = 'pausa'; p.estado_ts = ahora; p.nota_pausa = 'Perdió ' + p.ofertas_perdidas + ' ofertas seguidas'; }
        cambio = true;
      }
    }
  });
  if (cambioOfertas) deps.repo.escribir('espera_ofertas', ofertas);
  todas.forEach(p => { if (leAutoPausa(p, hoy, cfg, ahora)) { leHist(deps, p.id, null, 'estado', { detalle: 'Pasó a PAUSA solo: ' + p.nota_pausa }); cambio = true; } });
  if (cambio) leGuardar(deps, todas);
  return ofertas;
}

function leTareasDePersona(p, hoy, cfg, lugar, beneficiosOk) {
  const semana = (() => { const r = leReferencia(p); const d = r ? leDias(r, hoy) : null; return d == null ? 999 : Math.floor(d / 7); })();
  const recon = Number(p.recon_n) || 0;
  const intentos = Number(p.intentos) || 0;
  const diasUlt = p.ultimo_contacto ? leDias(p.ultimo_contacto, hoy) : null;
  if (p.proximo_contacto && p.proximo_contacto > hoy) return null;
  const vig = leVigente(p, hoy, cfg);
  if (lugar && p.lugar_ref && Number(p.lugar_ref) - lugar.lugar >= 1 && vig) {
    return { tipo: 'avance', motivo: 'Subió de lugar: de ' + p.lugar_ref + ' a ' + lugar.lugar, clave: 'avance' };
  }
  if (intentos === 0 && !p.ultimo_contacto && vig && semana < cfg.semana_reconfirma_1 && (p.estado === 'nuevo' || p.estado === 'esperando')) {
    const clave = lePrio(p) === 1 ? 'primer_contacto_p1' : lePrio(p) === 2 ? 'reactivacion_p2' : 'primer_contacto_p3';
    return { tipo: 'primer_contacto', motivo: 'Todavía no se le escribió', clave: clave };
  }
  const entreRecon = diasUlt == null || diasUlt >= cfg.dias_entre_reconfirmaciones;
  if (recon === 0 && semana >= cfg.semana_reconfirma_1) return { tipo: 'reconfirmacion', motivo: semana >= 999 ? 'Sin fecha de alta: confirmar que sigue' : 'Hace ' + semana + ' semanas sin confirmar que sigue', clave: 'reconfirmacion' };
  if (recon === 1 && semana >= cfg.semana_reconfirma_2 && entreRecon) return { tipo: 'reconfirmacion', motivo: 'Segunda reconfirmación (semana ' + Math.min(semana, 99) + ')', clave: 'sigues_en_lista' };
  if (recon >= 2 && semana >= cfg.semana_cierre) return { tipo: 'cierre', motivo: 'No respondió las reconfirmaciones: cierre amable', clave: 'cierre_amable' };
  if (p.estado === 'contactado' && recon === 0 && intentos >= 1 && intentos < cfg.intentos_pausa && diasUlt != null && diasUlt >= 3) {
    return { tipo: 'seguimiento', motivo: 'Sin respuesta hace ' + diasUlt + ' días (intento ' + (intentos + 1) + ' de ' + cfg.intentos_pausa + ')', clave: 'sigues_en_lista' };
  }
  if (beneficiosOk && vig && esVerdad(p.respondio_alguna_vez) && leEnFila(p)) {
    const d = leDiasEnLista(p, hoy);
    if (d != null && d >= cfg.beneficio_dias_en_lista) return { tipo: 'beneficio', motivo: 'Lleva ' + d + ' días en lista y responde los mensajes', clave: 'beneficio' };
  }
  return null;
}

function esperaHoy(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  leAcceso(usuario);
  const hoy = deps.hoy(), cfg = leConfig(deps), sedes = leSedes(cfg), ahora = leIso(deps);
  const todas = leCargar(deps);
  const ofertas = leBarrer(deps, todas, cfg, hoy);
  const hist = deps.repo.leer('espera_hist');
  const accionesHoy = hist.filter(h => h.tipo === 'contacto' && fechaArgentina(h.ts) === hoy);
  const idsDeSede = {};
  todas.forEach(p => { idsDeSede[p.id] = p.sede; });
  const miSede = usuario.sede;
  const hechasYo = accionesHoy.filter(h => h.dni === usuario.dni).length;
  const hechasSede = accionesHoy.filter(h => idsDeSede[h.persona_id] === miSede).length;
  const lugares = leLugares(todas, miSede, hoy, cfg);
  const benef = deps.repo.leer('espera_benef');
  const beneficiosOk = leBeneficiosDelMes(benef, miSede, hoy) < cfg.tope_beneficios_mes && cfg.beneficios.some(b => b.activo);
  const actividad = {};
  accionesHoy.forEach(h => { actividad[h.persona_id] = true; });
  const tareas = [];
  const completar = [];   // datos incompletos (de la planilla vieja): se proponen completar, sin contar en los topes de contactos
  // Cuántas veces respondió cada persona: el beneficio prefiere a quienes responden los mensajes (Emanuel, 25/11/2026)
  const respuestas = {};
  hist.forEach(h => { if (h.tipo === 'contacto' && (h.resultado === 'respondio_si' || h.resultado === 'respondio_no')) respuestas[h.persona_id] = (respuestas[h.persona_id] || 0) + 1; });
  // Reabiertas por evidencia que contradice lo marcado
  const reabiertas = {};
  hist.filter(h => h.tipo === 'verificacion' && h.verif === 'reabierta').forEach(h => { reabiertas[h.persona_id] = h.detalle; });
  todas.filter(p => p.sede === miSede && leEnFila(p)).forEach(p => {
    const dueno = leDueno(p, usuarios);
    if (!dueno || dueno.dni !== usuario.dni) return;
    if (actividad[p.id]) return;                                   // 1 acción por persona por día
    const faltan = leFaltanDatos(p);
    if (faltan.length) completar.push({ persona_id: p.id, nombre: p.nombre, prioridad: lePrio(p), faltan: faltan, antig: fechaIsoValida(p.fecha_alta) ? p.fecha_alta : '9999-99-99',
      motivo: 'Faltan datos: ' + faltan.map(f => LE_DATOS_TXT[f]).join(', ') + (faltan.indexOf('celular') >= 0 ? '. Sin celular no se le puede escribir.' : '. Aprovechá el próximo mensaje para pedírselos.') });
    if (faltan.indexOf('celular') >= 0) return;                    // sin celular no hay contacto posible: primero completar
    if (p.ultimo_mensaje_ts) { const d = leDias(fechaArgentina(p.ultimo_mensaje_ts), hoy); if (d != null && d < cfg.dias_entre_mensajes) return; }   // 1 mensaje por semana
    if (deps.repo.leer('espera_ofertas').some(o => o.persona_id === p.id && o.estado === 'ofrecida')) return;
    const mejor = leMejorLugar(lugares[p.id]);
    let t = leTareasDePersona(p, hoy, cfg, mejor, beneficiosOk);
    if (reabiertas[p.id] != null) t = { tipo: 'revisar', motivo: 'Marcada como hecha, pero ' + (reabiertas[p.id] || 'la evidencia no coincide') + ': confirmalo con la persona', clave: 'sigues_en_lista' };
    if (!t) return;
    const ctx = { recepcionista: usuario.nombre, sedes: sedes, vars: {} };
    if (mejor) { ctx.vars.lugar = mejor.lugar; ctx.franja = mejor.franja; }
    if (p.lugar_ref) ctx.vars.lugar_antes = p.lugar_ref;
    let beneficio = null;
    if (t.tipo === 'beneficio') {
      const respondio = esVerdad(p.respondio_alguna_vez);
      const b = cfg.beneficios.filter(x => x.activo && (!x.solo_si_respondio || respondio) && leBeneficiosDelMes(benef, miSede, hoy, x.clave) < x.tope_mes
        && !benef.some(r => r.persona_id === p.id && r.estado !== 'cancelado' && leDias(String(r.ts).slice(0, 10), hoy) < cfg.beneficio_dias_entre))[0];
      if (!b) return;
      beneficio = { clave: b.clave, titulo: b.titulo, motivo: b.motivo || '' };
      ctx.vars.beneficio = b.detalle;
      if (b.mensaje && MENSAJES_ESPERA.some(x => x.clave === b.mensaje)) t.clave = b.mensaje;
      if (b.motivo) t.motivo += ' · bonificado ' + b.motivo;
    }
    const m = leArmarMensaje(t.clave, p, ctx);
    tareas.push(leTarea(deps, t.tipo, p, { motivo: t.motivo, mensaje: m, beneficio: beneficio, sin_consentimiento: !p.consentimiento_fecha, lugar: mejor ? mejor.lugar : null,
      dias_en_lista: leDiasEnLista(p, hoy), antig: fechaIsoValida(p.fecha_alta) ? p.fecha_alta : '9999-99-99', faltan: faltan,
      pref: t.tipo === 'beneficio' ? -(respuestas[p.id] || 0) : 0 }));
  });
  // Ofertas vencidas que ofreció esta persona: hay que pasar al siguiente
  const vencidas = ofertas.filter(o => o.estado === 'vencida' && o.dni === usuario.dni && o.sede === miSede).map(o => {
    const p = todas.find(x => x.id === o.persona_id);
    if (!p) return null;
    const m = leArmarMensaje('lugar_paso', p, { recepcionista: usuario.nombre, sedes: sedes, vars: { dia_horario: leFranjaTexto(p, o.franja) } });
    return leTarea(deps, 'oferta_vencida', p, { motivo: 'No respondió el lugar que se le ofreció: pasa al siguiente', oferta_id: o.id, franja: o.franja, mensaje: m,
      candidatos: leCandidatos(todas, miSede, o.franja, hoy, cfg, lugares, ofertas, [p.id]), dias_en_lista: leDiasEnLista(p, hoy), antig: '' });
  }).filter(Boolean);
  tareas.sort((a, b) => a.rango - b.rango || a.pref - b.pref || a.prioridad - b.prioridad || (a.antig < b.antig ? -1 : a.antig > b.antig ? 1 : 0));
  const q = leCuotaDelDia(tareas.length, hechasYo, hechasSede, hoy, cfg);
  // Las ofertas vencidas son urgentes (hay un lugar libre): van primero y no se reparten, solo respetan los topes duros
  const duras = Math.max(0, Math.min(cfg.tope_turno - hechasYo, cfg.tope_sede - hechasSede));
  const vistas = vencidas.slice(0, duras);
  const restantes = Math.max(0, Math.min(q.cuota, duras - vistas.length));
  const visibles = vistas.concat(tareas.slice(0, restantes)).map(t => { delete t.antig; delete t.rango; delete t.pref; return t; });
  // Completar datos: aparte, con su propio tope por día, para no tapar los contactos
  completar.sort((a, b) => a.prioridad - b.prioridad || (a.antig < b.antig ? -1 : a.antig > b.antig ? 1 : 0));
  const completarVer = completar.slice(0, Math.max(0, Number(cfg.completar_por_dia) || 0)).map(x => { delete x.antig; return x; });
  const hechasHoy = hist.filter(h => h.tipo === 'contacto' && fechaArgentina(h.ts) === hoy && h.dni === usuario.dni).map(h => {
    const p = todas.find(x => x.id === h.persona_id);
    return { persona_id: h.persona_id, nombre: p ? p.nombre : '', resultado: h.resultado, verif: h.verif || 'pendiente' };
  });
  // Lo de días anteriores que sigue sin comprobar se ve como «hecha, sin comprobar»: sin castigo
  const sinComprobar = hist.filter(h => h.tipo === 'contacto' && h.verif === 'sin_comprobar' && h.dni === usuario.dni).length;
  return { hoy: hoy, tareas: visibles, completar: completarVer, completar_total: completar.length, pendientes_total: vencidas.length + tareas.length, hechas_yo: hechasYo, hechas_sede: hechasSede, hechas_hoy: hechasHoy, sin_comprobar: sinComprobar,
    topes: { turno: cfg.tope_turno, sede: cfg.tope_sede }, restantes: vistas.length + restantes, ahora: ahora,
    reparto: { habil: q.habil, dias_habiles: q.dias_habiles, tope_dia: q.tope_dia, pendientes: tareas.length } };
}

// ---------- Baja de un socio: a quién ofrecerle el lugar ----------

function leMotivoCandidato(p, franja, hoy, cfg) {
  const prio = { 1: 'Prioridad 1 (viene de otro servicio)', 2: 'Prioridad 2 (ex entrenado)', 3: 'Prioridad 3' }[lePrio(p)];
  const partes = [prio];
  const d = leDiasEnLista(p, hoy);
  if (d != null) partes.push('espera hace ' + d + ' días');
  partes.push('pide ' + leFranjaTexto(p, franja));
  const pase = lePases(p).reduce((s, x) => s + (Number(x.lugares) || 0), 0);
  if (pase) partes.push('pase de prioridad (+' + pase + ')');
  if (!leVigente(p, hoy, cfg)) partes.push('hace más de ' + cfg.dias_sin_reconfirmar + ' días que no confirma: preguntale si sigue');
  return partes.join(' · ');
}

function leCandidatos(todas, sede, franja, hoy, cfg, lugares, ofertas, excluir) {
  const conOferta = {};
  (ofertas || []).forEach(o => { if (o.estado === 'ofrecida') conOferta[o.persona_id] = true; });
  const ok = p => !conOferta[p.id] && (excluir || []).indexOf(p.id) < 0;
  const vigentes = leOrdenFranja(todas, sede, franja, hoy, cfg, true).filter(ok);
  const resto = leOrdenFranja(todas, sede, franja, hoy, cfg, false).filter(p => ok(p) && !leVigente(p, hoy, cfg));
  return vigentes.concat(resto).slice(0, 3).map(p => ({ persona_id: p.id, nombre: p.nombre, prioridad: lePrio(p), celular: p.celular, motivo: leMotivoCandidato(p, franja, hoy, cfg), vigente: leVigente(p, hoy, cfg) }));
}

// Franja del socio que se fue: la que se le pasa, o la que sale de sus hábitos (profe_reeval.habitos)
function leFranjaDeSocio(deps, socioId) {
  const r = deps.repo.leer('profe_reeval').find(x => x.socio_id === socioId);
  if (!r) return '';
  const h = leerJson(r.habitos, null);
  const horas = [];
  const barrer = x => { if (Array.isArray(x)) x.forEach(barrer); else if (x && typeof x === 'object') Object.keys(x).forEach(k => barrer(x[k])); else if (typeof x === 'string' && /^\d{1,2}(:\d{2})?$/.test(x)) horas.push(Number(x.split(':')[0])); else if (typeof x === 'number' && x >= 5 && x <= 23) horas.push(x); };
  barrer(h);
  if (!horas.length) return '';
  const m = horas.filter(x => x < 13).length, t = horas.length - m;
  return m >= t ? 'manana' : 'tarde';
}

function esperaCandidatos(req, deps) {
  const { usuario } = sesion(req, deps);
  leAcceso(usuario);
  const cfg = leConfig(deps), sedes = leSedes(cfg), hoy = deps.hoy();
  const sede = leEsCoord(usuario) && texto(req.sede) ? texto(req.sede) : usuario.sede;
  if (!sedes[sede] || !leVeSede(usuario, sede)) falla('prohibido');
  let franja = texto(req.franja);
  if (!LE_FRANJAS[franja]) franja = leFranjaDeSocio(deps, texto(req.socio_id));
  const todas = leCargar(deps);
  const ofertas = deps.repo.leer('espera_ofertas');
  const lugares = leLugares(todas, sede, hoy, cfg);
  const franjas = franja ? [franja] : Object.keys(LE_FRANJAS);
  return { sede: sede, franja: franja, aviso: 'Cupo sin verificar: la app no sabe cuántos lugares hay. Confirmalo en MOVE antes de ofrecer.',
    ventana_horas: cfg.ventana_oferta_horas, grupos: franjas.map(f => ({ franja: f, candidatos: leCandidatos(todas, sede, f, hoy, cfg, lugares, ofertas, []) })) };
}

function esperaOfrecer(req, deps) {
  const { usuario } = sesion(req, deps);
  leAcceso(usuario);
  const { p, todas } = lePersonaVisible(req, deps, usuario);
  const cfg = leConfig(deps), sedes = leSedes(cfg), hoy = deps.hoy();
  const franja = texto(req.franja);
  if (!LE_FRANJAS[franja] || !leEnFila(p)) falla('datos_invalidos');
  const ofertas = deps.repo.leer('espera_ofertas');
  if (ofertas.some(o => o.persona_id === p.id && o.estado === 'ofrecida')) falla('espera_oferta_activa');
  const ahora = deps.ahora();
  const vence = new Date(ahora + cfg.ventana_oferta_horas * 3600000).toISOString();
  const id = 'lo-' + deps.aleatorio(5);
  deps.repo.agregar('espera_ofertas', { id: id, persona_id: p.id, sede: p.sede, franja: franja, ts: new Date(ahora).toISOString(), vence_ts: vence, estado: 'ofrecida', dni: usuario.dni, motivo: texto(req.motivo).slice(0, 200) });
  p.ultimo_mensaje_ts = new Date(ahora).toISOString(); p.ultimo_contacto = hoy;
  leHist(deps, p.id, usuario, 'oferta', { mensaje_clave: 'lugar_disponible', resultado: 'ofrecida', detalle: 'Lugar en ' + LE_FRANJAS[franja] + ' · vence ' + vence.slice(0, 16).replace('T', ' ') + ' (cupo sin verificar)' });
  leGuardar(deps, todas);
  const limite = new Date(ahora + cfg.ventana_oferta_horas * 3600000 - 3 * 3600000).toISOString();
  const lim = 'mañana a las ' + limite.slice(11, 16);
  const m = leArmarMensaje('lugar_disponible', p, { recepcionista: usuario.nombre, sedes: sedes, vars: { dia_horario: LE_FRANJAS[franja], limite: cfg.ventana_oferta_horas === 24 ? lim : 'dentro de ' + cfg.ventana_oferta_horas + ' horas' } });
  return { oferta_id: id, vence_ts: vence, mensaje: m };
}

// resultado: acepto | rechazo_horario | rechazo_otro | siguiente (ya se pasó al siguiente tras vencer) | ingreso
function esperaOfertaResolver(req, deps) {
  const { usuario } = sesion(req, deps);
  leAcceso(usuario);
  const resultado = texto(req.resultado);
  if (['acepto', 'rechazo_horario', 'rechazo_otro', 'siguiente', 'ingreso'].indexOf(resultado) < 0) falla('datos_invalidos');
  const todas = leCargar(deps);
  const ofertas = deps.repo.leer('espera_ofertas');
  let o = null, p = null;
  if (texto(req.oferta_id)) {
    o = ofertas.find(x => x.id === texto(req.oferta_id));
    if (!o || !leVeSede(usuario, o.sede)) falla('no_existe');
    p = todas.find(x => x.id === o.persona_id);
  } else {
    lePersonaVisible(req, deps, usuario);
    p = todas.find(x => x.id === texto(req.id));
  }
  if (!p) falla('no_existe');
  const cfg = leConfig(deps), hoy = deps.hoy(), ahora = leIso(deps);
  if (o) { o.estado = { acepto: 'aceptada', rechazo_horario: 'rechazada', rechazo_otro: 'rechazada', siguiente: 'atendida', ingreso: 'aceptada' }[resultado]; deps.repo.escribir('espera_ofertas', ofertas); }
  if (resultado === 'acepto') { p.estado = 'evaluacion_agendada'; p.estado_ts = ahora; p.ultima_respuesta = hoy; p.respondio_alguna_vez = 'true'; }
  if (resultado === 'ingreso') { p.estado = 'ingreso'; p.estado_ts = ahora; p.fecha_ingreso = hoy; p.ultima_respuesta = hoy; }
  if (resultado === 'rechazo_otro') { p.estado = 'descartado'; p.estado_ts = ahora; }
  if (resultado === 'rechazo_horario') p.ultima_respuesta = hoy;
  leHist(deps, p.id, usuario, 'oferta', { resultado: resultado, detalle: texto(req.nota).slice(0, 300) });
  leGuardar(deps, todas);
  const { usuarios } = sesion(req, deps);
  return { persona: leVistaPersona(p, hoy, cfg, usuarios, leLugares(todas, p.sede, hoy, cfg)) };
}

// ---------- Beneficios ----------

function esperaBeneficio(req, deps) {
  const { usuario } = sesion(req, deps);
  leAcceso(usuario);
  const { p } = lePersonaVisible(req, deps, usuario);
  const cfg = leConfig(deps), hoy = deps.hoy();
  const estado = texto(req.estado);
  if (['ofrecido', 'canjeado', 'cancelado'].indexOf(estado) < 0) falla('datos_invalidos');
  const filas = deps.repo.leer('espera_benef');
  if (estado === 'ofrecido') {
    const b = cfg.beneficios.find(x => x.clave === texto(req.beneficio) && x.activo);
    if (!b) falla('datos_invalidos');
    if (leBeneficiosDelMes(filas, p.sede, hoy) >= cfg.tope_beneficios_mes || leBeneficiosDelMes(filas, p.sede, hoy, b.clave) >= b.tope_mes) falla('espera_tope_beneficio');
    const fila = { id: 'lb-' + deps.aleatorio(5), persona_id: p.id, sede: p.sede, ts: leIso(deps), beneficio: b.clave, estado: 'ofrecido', dni: usuario.dni, nombre: usuario.nombre, canjeado_ts: '' };
    deps.repo.agregar('espera_benef', fila);
    leHist(deps, p.id, usuario, 'beneficio', { resultado: 'ofrecido', detalle: b.titulo });
    const todas = leCargar(deps);
    const q = todas.find(x => x.id === p.id);
    q.ultimo_mensaje_ts = leIso(deps); q.ultimo_contacto = hoy;
    leGuardar(deps, todas);
    return { beneficio_id: fila.id };
  }
  const fila = filas.find(x => x.id === texto(req.beneficio_id) && x.persona_id === p.id);
  if (!fila) falla('no_existe');
  fila.estado = estado;
  if (estado === 'canjeado') { fila.canjeado_ts = leIso(deps); fila.nombre = usuario.nombre; }
  deps.repo.escribir('espera_benef', filas);
  leHist(deps, p.id, usuario, 'beneficio', { resultado: estado, detalle: (cfg.beneficios.find(x => x.clave === fila.beneficio) || {}).titulo || fila.beneficio });
  return {};
}

function esperaBeneficiosDe(req, deps) {
  const { usuario } = sesion(req, deps);
  leAcceso(usuario);
  const { p } = lePersonaVisible(req, deps, usuario);
  const cfg = leConfig(deps);
  return { beneficios: deps.repo.leer('espera_benef').filter(b => b.persona_id === p.id).map(b => ({ id: b.id, beneficio: b.beneficio, titulo: (cfg.beneficios.find(x => x.clave === b.beneficio) || {}).titulo || b.beneficio, estado: b.estado, fecha: fechaArgentina(b.ts), quien: b.nombre })) };
}

// ---------- Métricas (coordinación) ----------

function esperaMetricas(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!leEsCoord(usuario)) falla('prohibido');
  const hoy = deps.hoy(), cfg = leConfig(deps), sedes = leSedes(cfg);
  const todas = leCargar(deps), hist = deps.repo.leer('espera_hist'), benef = deps.repo.leer('espera_benef');
  const porSede = Object.keys(sedes).map(s => {
    const ps = todas.filter(p => p.sede === s);
    const estados = {};
    Object.keys(LE_ESTADOS).forEach(e => { estados[e] = ps.filter(p => p.estado === e).length; });
    const ids = {};
    ps.forEach(p => { ids[p.id] = true; });
    const contactos = hist.filter(h => h.tipo === 'contacto' && ids[h.persona_id]);
    const envios = contactos.length, respuestas = contactos.filter(h => h.resultado === 'respondio_si' || h.resultado === 'respondio_no' || h.resultado === 'pidio_baja').length;
    const activos = ps.filter(leEnFila).map(p => leDiasEnLista(p, hoy)).filter(d => d != null).sort((a, b) => a - b);
    const ingresados = ps.filter(p => p.estado === 'ingreso' && p.fecha_ingreso).map(p => leDias(p.fecha_alta, p.fecha_ingreso)).filter(d => d != null && d >= 0).sort((a, b) => a - b);
    const mediana = a => (a.length ? a[Math.floor(a.length / 2)] : null);
    return { sede: s, nombre: sedes[s], total: ps.length, estados: estados, en_fila: ps.filter(leEnFila).length, vigentes: ps.filter(p => leEnFila(p) && leVigente(p, hoy, cfg)).length,
      contactos: envios, respuestas: respuestas, tasa_respuesta: envios ? Math.round(1000 * respuestas / envios) / 10 : null,
      dias_en_lista_mediana: mediana(activos), dias_hasta_ingreso_mediana: mediana(ingresados), ingresos: ps.filter(p => p.estado === 'ingreso').length,
      sin_comprobar: hist.filter(h => h.tipo === 'contacto' && h.verif === 'sin_comprobar' && ids[h.persona_id]).length,
      beneficios_ofrecidos: benef.filter(b => b.sede === s).length, beneficios_canjeados: benef.filter(b => b.sede === s && b.estado === 'canjeado').length };
  }).filter(x => x.total > 0 || true);
  return { hoy: hoy, sedes: porSede };
}

// ---------- Configuración (admin) ----------

function esperaConfigGuardar(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!tieneRol(usuario, 'admin')) falla('prohibido');
  const nuevo = req.config && typeof req.config === 'object' ? req.config : {};
  const filas = deps.repo.leer('espera_config');
  Object.keys(nuevo).forEach(k => {
    if (!Object.prototype.hasOwnProperty.call(LE_CONFIG_DEFECTO, k)) falla('datos_invalidos');
    const def = LE_CONFIG_DEFECTO[k], v = nuevo[k];
    if (typeof def === 'number' && !(typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1000)) falla('datos_invalidos');
    if (Array.isArray(def) && !Array.isArray(v)) falla('datos_invalidos');
    if (k === 'beneficios' && !v.every(b => b && /^[a-z0-9_]{2,20}$/.test(b.clave) && texto(b.titulo) && texto(b.detalle) && isFinite(Number(b.tope_mes))
      && (!b.mensaje || MENSAJES_ESPERA.some(m => m.clave === b.mensaje)))) falla('datos_invalidos');
    const i = filas.findIndex(f => f.clave === k);
    const fila = { clave: k, valor: JSON.stringify(v) };
    if (i >= 0) filas[i] = fila; else filas.push(fila);
  });
  deps.repo.escribir('espera_config', filas);
  return { config: leConfig(deps) };
}

// ---------- Carga desde la PC ----------

const LE_COLS_CARGA = ['id', 'sede', 'sede_interes', 'fecha_alta', 'prioridad', 'nombre', 'celular', 'horario_texto', 'franjas', 'observaciones', 'estado', 'derivacion', 'evaluacion', 'interesado', 'origen', 'contacto_dni', 'fecha_dudosa'];

// Idempotente: lo que ya está cargado no se toca (la app puede haber cambiado el estado, los intentos, los pases). Solo entran las filas nuevas.
function cargarEspera(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas) || req.filas.length > 2000) falla('datos_invalidos');
  if (req.modo === 'actualizar_estados') return cargarEsperaEstados(req, deps);
  if (req.modo != null && req.modo !== '' && req.modo !== 'altas') falla('datos_invalidos');
  const cfg = leConfig(deps), sedes = leSedes(cfg), hoy = texto(req.hoy) || deps.hoy();
  const todas = leCargar(deps);
  const porId = {};
  todas.forEach(p => { porId[p.id] = true; });
  let nuevos = 0, yaEstaban = 0;
  const ahora = leIso(deps);
  req.filas.forEach(x => {
    const f = leFilaDeCarga(x, sedes);
    if (porId[f.id]) { yaEstaban++; return; }
    porId[f.id] = true;
    const p = Object.assign(lePersonaVacia(), f, { cargada: hoy, creado_por: 'pc', estado_ts: ahora, origen: f.origen || 'planilla', franjas: f.franjas.split(',').filter(g => LE_FRANJAS[g]).join(',') });
    delete p.fecha_dudosa;
    p.observaciones = p.observaciones.slice(0, 300);
    todas.push(p);
    leHist(deps, p.id, null, 'alta', { detalle: 'Importada de la planilla vieja' + (f.fecha_dudosa ? ' (sin fecha de alta)' : '') });
    nuevos++;
  });
  leGuardar(deps, todas);
  return { nuevos: nuevos, ya_estaban: yaEstaban, total: todas.length };
}

function leFilaDeCarga(x, sedes) {
  const f = {};
  LE_COLS_CARGA.forEach(c => { f[c] = texto(x && x[c]); });
  const celular = f.celular;
  if (!/^[0-9a-z_-]{3,40}$/.test(f.id) || !sedes[f.sede] || !f.nombre || f.nombre.length > 80 || LE_ESTADOS[f.estado] == null
    || ['1', '2', '3'].indexOf(f.prioridad) < 0 || (celular && !/^549\d{10}$/.test(celular)) || (f.fecha_alta && !fechaIsoValida(f.fecha_alta))) falla('datos_invalidos');
  return f;
}

// ---------- Re-sincronizar estados desde la planilla (Emanuel, 25/11/2026) ----------
// Las recepcionistas volvieron a pintar la planilla vieja. Para quien ya está cargado (mismo id) se actualiza el estado según el color
// (y derivación / evaluación / observaciones si vienen), SOLO si en la app nadie tocó a esa persona desde que se importó:
// sin historial distinto de la carga y sin un cambio de estado posterior. Si la tocaron, no se pisa y se cuenta como «tocada en la app».
// Idempotente: correrlo dos veces con la misma planilla no cambia nada la segunda vez. `simular: true` cuenta sin escribir.
// La respuesta trae solo conteos: nunca nombres ni celulares.
const LE_ESTADOS_PLANILLA = ['nuevo', 'contactado', 'evaluacion_agendada', 'descartado'];
const LE_HIST_DE_CARGA = ['alta', 'sincro_planilla'];

function leTocadaEnApp(p, histDe) {
  if (p.creado_por !== 'pc') return true;
  const hs = histDe[p.id] || [];
  if (hs.some(h => LE_HIST_DE_CARGA.indexOf(h.tipo) < 0)) return true;
  const ref = hs.map(h => String(h.ts)).sort().pop() || '';
  return !!(p.estado_ts && ref && String(p.estado_ts) > ref);
}

function cargarEsperaEstados(req, deps) {
  const cfg = leConfig(deps), sedes = leSedes(cfg);
  const simular = req.simular === true;
  const todas = leCargar(deps);
  const porId = {};
  todas.forEach(p => { porId[p.id] = p; });
  const histDe = {};
  deps.repo.leer('espera_hist').forEach(h => { (histDe[h.persona_id] = histDe[h.persona_id] || []).push(h); });
  const ahora = leIso(deps);
  const r = { modo: 'actualizar_estados', simulado: simular, actualizadas: 0, sin_cambios: 0, tocadas_en_app: 0, no_estan: 0, cambios: {}, campos: {} };
  const nuevasHist = [];
  const vistas = {};
  req.filas.forEach(x => {
    const f = leFilaDeCarga(x, sedes);
    if (LE_ESTADOS_PLANILLA.indexOf(f.estado) < 0) falla('datos_invalidos');
    if (vistas[f.id]) return;
    vistas[f.id] = true;
    const p = porId[f.id];
    if (!p) { r.no_estan++; return; }
    if (leTocadaEnApp(p, histDe)) { r.tocadas_en_app++; return; }
    const partes = [];
    if (p.estado !== f.estado) {
      const k = p.estado + '→' + f.estado;
      r.cambios[k] = (r.cambios[k] || 0) + 1;
      partes.push('estado: ' + (LE_ESTADOS[p.estado] || p.estado) + ' → ' + LE_ESTADOS[f.estado]);
      if (!simular) { p.estado = f.estado; p.estado_ts = ahora; }
    }
    ['derivacion', 'evaluacion', 'observaciones'].forEach(c => {
      const v = f[c].slice(0, c === 'observaciones' ? 300 : 120);
      if (v && v !== p[c]) { r.campos[c] = (r.campos[c] || 0) + 1; partes.push(c); if (!simular) p[c] = v; }
    });
    if (!partes.length) { r.sin_cambios++; return; }
    r.actualizadas++;
    nuevasHist.push({ id: 'lh-' + deps.aleatorio(5), persona_id: p.id, ts: ahora, dni: '', nombre: '', tipo: 'sincro_planilla', mensaje_clave: '', resultado: '',
      detalle: ('Actualizado desde la planilla: ' + partes.join(' · ')).slice(0, 300), verif: '', verif_ts: '' });
  });
  if (!simular && nuevasHist.length) {
    leGuardar(deps, todas);
    nuevasHist.forEach(h => deps.repo.agregar('espera_hist', h));
  }
  return r;
}

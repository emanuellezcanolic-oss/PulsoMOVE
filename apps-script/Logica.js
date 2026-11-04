// PulsoMOVE · reglas puras (sin Google). Se prueban con Node y se pegan tal cual en Apps Script.

// ---------- PIN ----------

function normalizarDni(s) {
  return String(s == null ? '' : s).replace(/\D/g, '');
}

function pinValido(pin) {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return false;
  const d = pin.split('').map(Number);
  if (d.every(x => x === d[0])) return false;
  const sube = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const baja = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
  return !sube && !baja;
}

function hashPin(pin, sal, pimienta, sha256) {
  return sha256(sal + ':' + pin + ':' + pimienta);
}

// aleatorio(n) devuelve n bytes en hexadecimal
function generarPin(aleatorio) {
  for (;;) {
    const pin = String(parseInt(aleatorio(4), 16) % 10000).padStart(4, '0');
    if (pinValido(pin)) return pin;
  }
}

// ---------- Sesión ----------
// Token sin estado: base64url("dni|vence_ms") + "." + firma HMAC-SHA256 en base64url.

const DURACION_SESION_MS = 10 * 3600 * 1000;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Solo para texto ASCII (el token lleva dígitos y "|")
function aB64url(s) {
  let bits = '', out = '';
  for (const c of s) bits += c.charCodeAt(0).toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 6) out += B64[parseInt(bits.slice(i, i + 6).padEnd(6, '0'), 2)];
  return out;
}

function deB64url(s) {
  let bits = '', out = '';
  for (const c of s) {
    const i = B64.indexOf(c);
    if (i < 0) throw new Error('base64url inválido');
    bits += i.toString(2).padStart(6, '0');
  }
  for (let i = 0; i + 8 <= bits.length; i += 8) out += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
  return out;
}

function igualSeguro(a, b) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// hmac(texto, secreto) devuelve la firma en base64url
function crearToken(dni, ahoraMs, secreto, hmac) {
  const datos = aB64url(dni + '|' + (ahoraMs + DURACION_SESION_MS));
  return datos + '.' + hmac(datos, secreto);
}

function leerToken(token, ahoraMs, secreto, hmac) {
  try {
    const partes = String(token == null ? '' : token).split('.');
    if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
    if (!igualSeguro(hmac(partes[0], secreto), partes[1])) return null;
    const [dni, vence] = deB64url(partes[0]).split('|');
    if (!/^\d+$/.test(dni || '') || !(Number(vence) > ahoraMs)) return null;
    return dni;
  } catch (e) {
    return null;
  }
}

// ---------- Marcas ----------

const CANALES = ['MP', 'AU', 'MG', 'LL', 'PR', 'SIN CONTACTO'];
const RESULTADOS = ['VOLVIÓ', 'VUELVE', 'RESERVA', 'PAGÓ', 'PAGA', 'VACACIONES', 'PAUSA', 'SALUD', 'HORARIOS',
                    'PRECIO', 'BAJA', 'NO CONTESTA', 'TEL MAL', 'NOTIFICADO', 'ENCUESTA ENVIADA', 'SALUDADO', 'SIN CAMBIO', 'SEGUIDO', 'HECHO',
                    'AGENDADA', 'REPROGRAMADA', 'SE HIZO', 'NO SE HACE', 'CORREGIDO', 'LO SIGUE EL PROFE', 'LO CAMBIA EL PROFE', 'NO HACE FALTA'];
const PIDEN_FECHA = ['VUELVE', 'PAGA', 'VACACIONES', 'AGENDADA', 'REPROGRAMADA'];   // la fecha se pide solo en estos: en los demás no aparece
const PREGUNTA_FECHA = { VUELVE: '¿Qué día vuelve?', PAGA: '¿Qué día paga?', VACACIONES: '¿Qué día vuelve de vacaciones?', AGENDADA: '¿Qué día es la evaluación?', REPROGRAMADA: '¿Para qué día quedó?' };
// El desplegable de resultados, por categoría
const GRUPOS_RESULTADO = [
  ['Ya se resolvió', ['VOLVIÓ', 'RESERVA', 'PAGÓ']],
  ['Quedó en una fecha', ['VUELVE', 'PAGA', 'VACACIONES']],
  ['Solo se le avisó', ['NOTIFICADO']],
  ['Por qué no viene', ['PAUSA', 'SALUD', 'HORARIOS', 'PRECIO', 'BAJA']],
  ['No se pudo hablar', ['NO CONTESTA', 'TEL MAL']],
];
const PIDEN_DETALLE = ['BAJA', 'SIN CAMBIO', 'NO SE HACE'];

// Tareas que no se marcan a mano: se dan por hechas solo cuando MOVE muestra el dato cargado.
const SE_VERIFICAN_EN_MOVE = ['Asignarle profesor', 'Completar ficha', 'Corregir calendario'];

// Avisos para el turno: se leen, no se marcan ni cuentan como tarea. La llegada de los profes se mide sola con el QR.
function esRecordatorio(tipo) {
  return String(tipo).indexOf('Profes de hoy') === 0;
}

function seVerificaEnMove(tipo) {
  return SE_VERIFICAN_EN_MOVE.some(v => String(tipo).indexOf(v) === 0);
}

function fechaIsoValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T12:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function validarMarca(m) {
  if (!m || CANALES.indexOf(m.canal) < 0 || RESULTADOS.indexOf(m.resultado) < 0) return 'datos_invalidos';
  if (m.fecha && !fechaIsoValida(m.fecha)) return 'datos_invalidos';
  if (PIDEN_FECHA.indexOf(m.resultado) >= 0 && !m.fecha) return 'datos_invalidos';
  if (PIDEN_DETALLE.indexOf(m.resultado) >= 0 && !String(m.detalle || '').trim()) return 'datos_invalidos';
  return null;
}

// ---------- Fechas ----------

// Días de lunes a viernes desde `desde` (incluido) hasta `hasta` (excluido), fechas ISO.
function diasHabiles(desde, hasta) {
  if (!fechaIsoValida(desde) || !fechaIsoValida(hasta)) return 0;
  let n = 0;
  const d = new Date(desde + 'T12:00:00Z');
  const fin = new Date(hasta + 'T12:00:00Z');
  while (d < fin) {
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

// ---------- Carga diaria ----------

const DIAS_GUARDAR_TAREAS = 60;
const CAMPOS_ACTUALIZABLES = ['fecha', 'tipo', 'prioridad', 'situacion', 'accion', 'ultima_anotacion', 'socio_nombre', 'profe', 'intro'];

function sumarDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Mezcla la carga del día con lo que ya hay. Devuelve {filas, nuevas, actualizadas, cerradas}.
// Una pendiente del mismo socio conserva id, persona y pendiente_desde; lo hecho hoy no reaparece.
function fusionarCargaDetalle(existentes, nuevas, cerrar, fecha) {
  const limite = sumarDias(fecha, -DIAS_GUARDAR_TAREAS);
  const filas = existentes
    .filter(t => t.estado === 'pendiente' || String(t.fecha) >= limite)
    .map(t => Object.assign({}, t));
  const clave = t => t.sede + '|' + t.socio_id;
  let n = 0, act = 0, cer = 0;
  const fechaGeneral = fecha;
  for (const nv of nuevas) {
    const k = clave(nv);
    const fechaTarea = nv.fecha || fechaGeneral;
    const pend = filas.find(t => clave(t) === k && t.estado === 'pendiente');
    if (pend) {
      for (const c of CAMPOS_ACTUALIZABLES) pend[c] = c === 'fecha' ? fechaTarea : String(nv[c] == null ? '' : nv[c]);
      act++;
      continue;
    }
    if (filas.some(t => clave(t) === k && t.fecha === fechaTarea && t.estado !== 'pendiente')) {
      act++;
      continue;
    }
    filas.push({
      id: fechaTarea + '-' + nv.sede + '-' + nv.socio_id, fecha: fechaTarea, sede: nv.sede, socio_id: String(nv.socio_id),
      socio_nombre: String(nv.socio_nombre || ''), profe: String(nv.profe || ''), tipo: String(nv.tipo || ''),
      prioridad: String(nv.prioridad == null ? '' : nv.prioridad), situacion: String(nv.situacion || ''),
      accion: String(nv.accion || ''), ultima_anotacion: String(nv.ultima_anotacion || ''),
      asignado_dni: String(nv.asignado_dni || ''), pendiente_desde: fechaTarea, estado: 'pendiente', hecha_en: '', intro: String(nv.intro || ''),
    });
    n++;
  }
  for (const c of cerrar || []) {
    for (const t of filas) {
      if (clave(t) === clave(c) && t.estado === 'pendiente') {
        cer++;
        if (c.hecha) {
          t.estado = 'hecha';
          t.fecha = fecha;
          t.hecha_en = fecha + 'T15:00:00.000Z';
        } else {
          t.estado = 'cerrada';
        }
      }
    }
  }
  return { filas: filas, nuevas: n, actualizadas: act, cerradas: cer };
}

function fusionarCarga(existentes, nuevas, cerrar, fecha) {
  return fusionarCargaDetalle(existentes, nuevas, cerrar, fecha).filas;
}

// Fecha de Argentina (UTC-3, sin horario de verano) de un instante ISO
function fechaArgentina(iso) {
  const ms = Date.parse(iso);
  return isNaN(ms) ? '' : new Date(ms - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function lunesDe(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return sumarDias(iso, -((d.getUTCDay() + 6) % 7));
}

// ---------- Rendimiento ----------
// Objetivos base: los de CONTROL DE VENTAS de la planilla de recepción (nuevos, planes, tienda, mensajes, días de prueba, conversión).
// Los demás objetivos y los pesos los propuso Claude siguiendo "Cómo se mide" de MAN-REC-02; el admin los puede cambiar por persona.

const METRICAS = [
  { clave: 'tareas_pct', nombre: 'Tareas hechas', grupo: 'Cumplimiento', objetivo: 0.9, peso: 15, formato: 'pct' },
  { clave: 'a_tiempo_pct', nombre: 'Hechas el día que tocaba', grupo: 'Cumplimiento', objetivo: 0.8, peso: 10, formato: 'pct' },
  { clave: 'apertura_pct', nombre: 'Caja abierta a horario', grupo: 'Cumplimiento', objetivo: 0.9, peso: 5, formato: 'pct' },
  { clave: 'retencion_pct', nombre: 'Socios retenidos de sus tareas', grupo: 'Retención', objetivo: 0.5, peso: 15, formato: 'pct' },
  { clave: 'contacto_pct', nombre: 'Contactos con turno o fecha', grupo: 'Retención', objetivo: 0.7, peso: 10, formato: 'pct' },
  { clave: 'promesas_pct', nombre: 'Promesas cumplidas', grupo: 'Retención', objetivo: 0.6, peso: 5, formato: 'pct' },
  { clave: 'nuevos', nombre: 'Socios nuevos', grupo: 'Ventas', objetivo: 20, peso: 8, formato: 'num' },
  { clave: 'planes_largos', nombre: 'Planes de 3 meses o más', grupo: 'Ventas', objetivo: 10, peso: 5, formato: 'num' },
  { clave: 'conversion', nombre: 'Conversión de consultas', grupo: 'Ventas', objetivo: 0.6, peso: 4, formato: 'pct' },
  { clave: 'tienda', nombre: 'Indumentaria y suplementos', grupo: 'Ventas', objetivo: 5, peso: 4, formato: 'num' },
  { clave: 'mensajes', nombre: 'Mensajes enviados', grupo: 'Ventas', objetivo: 100, peso: 4, formato: 'num' },
  { clave: 'encuestas_pct', nombre: 'Encuestas de baja enviadas', grupo: 'Experiencia', objetivo: 0.9, peso: 5, formato: 'pct' },
  { clave: 'resenas', nombre: 'Reseñas de Google pedidas', grupo: 'Experiencia', objetivo: 8, peso: 5, formato: 'num' },
  { clave: 'referidos', nombre: 'Referidos conseguidos', grupo: 'Experiencia', objetivo: 4, peso: 5, formato: 'num' },
];
const GRUPOS_METRICAS = ['Cumplimiento', 'Retención', 'Ventas', 'Experiencia'];
const UMBRAL_INCENTIVO = 90;

function puntuar(valores, objetivos) {
  const filas = METRICAS.map(m => {
    const objetivo = objetivos && objetivos[m.clave] != null ? Number(objetivos[m.clave]) : m.objetivo;
    const valor = valores[m.clave];
    const conDato = valor != null && !isNaN(valor) && objetivo > 0;
    return { clave: m.clave, nombre: m.nombre, grupo: m.grupo, peso: m.peso, formato: m.formato, objetivo: objetivo,
             valor: valor == null ? null : valor, cumple: conDato ? Math.min(1, valor / objetivo) : null };
  });
  const puntaje = lista => {
    const pesos = lista.reduce((a, f) => a + (f.cumple == null ? 0 : f.peso), 0);
    return pesos ? Math.round(lista.reduce((a, f) => a + (f.cumple == null ? 0 : f.cumple * f.peso), 0) / pesos * 100) : null;
  };
  const grupos = GRUPOS_METRICAS.map(nombre => ({ nombre: nombre, puntaje: puntaje(filas.filter(f => f.grupo === nombre)) }));
  const cumplimiento = grupos[0].puntaje;
  return { total: puntaje(filas), grupos: grupos, filas: filas, incentivo: cumplimiento == null ? null : cumplimiento >= UMBRAL_INCENTIVO };
}

// ---------- Prioridad ----------
// Qué se hace primero. Arriba, lo que se pierde si se deja pasar: en las rondas de octubre, contactar antes del vencimiento rindió 78% contra 62%.
const NIVELES = [
  { n: 1, emoji: '🔴', titulo: 'Primero esto', ayuda: 'Si se deja pasar, se puede perder el socio.' },
  { n: 2, emoji: '🟠', titulo: 'Después', ayuda: 'Cuidan al socio y ordenan su seguimiento.' },
  { n: 3, emoji: '🟢', titulo: 'Cuando tengas un rato', ayuda: 'Suman, pero pueden esperar.' },
];
const TIPOS_NIVEL_1 = ['Apertura', 'Pagó y no viene', 'Le vence el plan', 'Vence', 'Socio nuevo', 'Vencieron'];   // el orden de urgencia de Emanuel (03/11/2026)
const TIPOS_NIVEL_3 = ['Socio antiguo', 'Revisar profesor', 'Completar ficha', 'Asignarle profesor', 'Cierre'];

// Lo que quedó de 2 días o más sube un escalón: lo no hecho no se pierde al fondo de la lista. El cierre siempre va al final.
function nivelDeTarea(t) {
  const tipo = String(t.tipo);
  const es = lista => lista.some(x => tipo.indexOf(x) === 0);
  if (tipo.indexOf('Cierre') === 0) return 3;
  const base = es(TIPOS_NIVEL_1) ? 1 : es(TIPOS_NIVEL_3) ? 3 : 2;
  return Number(t.dias_pendiente) >= 2 && base > 1 ? base - 1 : base;
}

// ---------- Motivación ----------
// Metas cercanas, avance visible y reconocimiento inmediato. Nada de textos para mandarles a los socios: eso lo escribe cada persona.

const PUNTOS = { tareas_hechas: 1, adelantadas: 1, nuevos: 5, planes_largos: 10, reenganches: 10, tienda: 2, resenas: 2, referidos: 3, consultas: 1 };

function calcularPuntos(v) {
  return Object.keys(PUNTOS).reduce((a, k) => a + (Number(v[k]) || 0) * PUNTOS[k], 0);
}

function saludo(nombre, hora) {
  const pila = String(nombre || '').trim().split(/\s+/)[0];
  const parte = hora < 12 ? '¡buen día!' : hora < 20 ? '¡buenas tardes!' : '¡buenas noches!';
  return 'Hola ' + pila + ', ' + parte + ' Que tengas una excelente jornada.';
}

const FRASES_ARRANQUE = [
  'El primer contacto del día es el que pone todo en marcha.',
  'Cada socio que recibís hoy puede salir mejor de lo que entró.',
  'Un mensaje a tiempo puede ser la razón por la que alguien vuelve.',
  'Lo que hacés acá se nota: nadie pasa por el club sin ser visto.',
];
const FRASES_RITMO = [
  'Vas muy bien: cada tarea hecha es un socio mejor cuidado.',
  'Buen ritmo. Seguí así, se nota el trabajo.',
  'Ya hiciste la parte difícil: arrancar.',
];

// hechas, total, semilla (cambia por día y por persona)
function fraseDelDia(hechas, total, semilla) {
  const faltan = total - hechas;
  if (total > 0 && faltan <= 0) return '¡Lista completa! Hoy dejaste todo al día.';
  if (total > 0 && faltan <= 3) return faltan === 1 ? '¡Te falta una sola! Cerrala y dejás todo al día.' : '¡Te faltan ' + faltan + '! Ya casi está.';
  if (total > 0 && hechas / total >= 0.5) return 'Ya pasaste la mitad: te faltan ' + faltan + '. ¡Vamos!';
  const lista = hechas > 0 ? FRASES_RITMO : FRASES_ARRANQUE;
  return lista[Math.abs(Number(semilla) || 0) % lista.length];
}

// c: {hoy, atrasadas, racha}. Como mucho 3 mensajes, primero lo más importante.
function mensajesCoach(v, objetivos, c) {
  const obj = k => (objetivos && objetivos[k] != null ? Number(objetivos[k]) : (METRICAS.find(m => m.clave === k) || {}).objetivo);
  const dia = Number(String(c.hoy).slice(8, 10)) || 1;
  const ritmo = Math.min(1, dia / 30);
  const avance = k => (Number(v[k]) || 0) / obj(k);
  const out = [];
  if (c.atrasadas > 0) out.push({ clave: 'atrasadas', tono: 'foco', texto: 'Tenés ' + c.atrasadas + (c.atrasadas === 1 ? ' tarea atrasada' : ' tareas atrasadas') + '. Si las cerrás primero, el resto del día fluye mejor.' });
  if (Number(v.dias_sin_plan_largo) >= 3) out.push({ clave: 'plan', tono: 'foco', texto: 'Van ' + v.dias_sin_plan_largo + ' días sin un plan de 3 meses. Hoy es un buen día para ofrecerlo: cada uno vale el doble de puntos.' });
  if (v.nuevos != null || v.mensajes != null) {
    if (avance('nuevos') >= ritmo && avance('mensajes') < ritmo * 0.7) out.push({ clave: 'mensajes', tono: 'foco', texto: 'Las ventas vienen muy bien, pero los mensajes están flojos. ¿Qué te parece si desde ahora le escribís a quienes hace rato no venís viendo?' });
    else if (avance('mensajes') >= ritmo && avance('nuevos') < ritmo * 0.7) out.push({ clave: 'ventas', tono: 'foco', texto: 'Los mensajes van muy bien. Ahora a transformarlos en ventas: a cada consulta, proponele la visita.' });
  }
  if (c.racha >= 3) out.push({ clave: 'racha', tono: 'logro', texto: '¡' + c.racha + ' días seguidos con tareas hechas! Esa constancia es la que retiene socios.' });
  if (v.tareas_pct >= 0.9) out.push({ clave: 'bien', tono: 'logro', texto: 'Estás al ' + Math.round(v.tareas_pct * 100) + '% de tus tareas del mes. Excelente.' });
  return out.slice(0, 3);
}

// Medallas del mes, personales y sin ranking: lo que suman es avance propio, no ganarle a otro. Empiezan de cero cada mes.
// c: {tareas, racha, adelantadas, puente, corregidos, encuestas, redondos, volvieron}
function medallasDelMes(c) {
  const M = [
    ['primera', '🌱', 'Arrancaste', 'Tu primera tarea del mes', 'tareas', 1],
    ['constancia', '🔥', 'Constancia', '5 días seguidos con tareas hechas', 'racha', 5],
    ['redondo', '🎯', 'Día redondo', 'Cerrar un turno sin pendientes', 'redondos', 1],
    ['adelantada', '🚀', 'Un paso adelante', '5 tareas adelantadas', 'adelantadas', 5],
    ['puente', '🤝', 'Puente con los profes', '10 tareas resueltas con un profe', 'puente', 10],
    ['brujula', '🧭', 'Brújula', '3 socios bien ubicados en MOVE', 'corregidos', 3],
    ['volvieron', '🙌', 'Volvieron por vos', '3 socios que volvieron después de tu contacto', 'volvieron', 3],
    ['voz', '💬', 'Voz del equipo', 'Contar cómo fue tu día 10 veces', 'encuestas', 10],
  ];
  return M.map(m => {
    const actual = Number(c[m[4]]) || 0;
    return { clave: m[0], emoji: m[1], nombre: m[2], como: m[3], actual: Math.min(actual, m[5]), meta: m[5], ganada: actual >= m[5] };
  });
}

// Lo que contestan al cerrar el turno, resumido para coordinación. Baja: alguna nota de 2 o menos.
function resumenCierres(cierres) {
  const prom = (filas, k) => {
    const v = filas.map(c => Number(c[k])).filter(x => x >= 1 && x <= 5);
    return v.length ? Math.round(10 * v.reduce((a, b) => a + b, 0) / v.length) / 10 : null;
  };
  const de = filas => ({ respuestas: filas.length, dia: prom(filas, 'animo'), sala: prom(filas, 'sala'), profes: prom(filas, 'profes') });
  const sedes = {};
  cierres.forEach(c => { (sedes[c.sede] = sedes[c.sede] || []).push(c); });
  return {
    total: de(cierres),
    sedes: Object.keys(sedes).sort().map(s => Object.assign({ sede: s }, de(sedes[s]))),
    bajas: cierres.filter(c => ['animo', 'sala', 'profes'].some(k => Number(c[k]) >= 1 && Number(c[k]) <= 2)).length,
  };
}

// Contactos delicados: un audio obliga a abrirlo y el tono de voz cambia cómo llega el mensaje.
const TIPOS_AUDIO = ['Socio antiguo', 'Pagó y no viene', 'Vencieron', 'Riesgo alto', 'Encuesta de baja', 'Faltó', 'Viene menos', 'De vacaciones'];

function recomiendaAudio(tipo) {
  return TIPOS_AUDIO.some(t => String(tipo).indexOf(t) === 0);
}

// Avisos durante el turno. c: {nombre, minuto, inicio, fin (minutos del día), hechas, pendientes, minutosSinMarcar, enviados, siguiente, ayer, racha, adelantar, diasSinPlan}.
// Personalizados con su nombre y sus números. La frecuencia la limita quien llama: cada 20 minutos, para que no se vuelvan ruido.
function proximoAviso(c) {
  if (c.inicio == null || c.fin == null || c.minuto < c.inicio || c.minuto >= c.fin) return null;
  const pila = String(c.nombre || '').trim().split(/\s+/)[0];
  const ya = k => c.enviados && c.enviados[k];
  const dale = (clave, titulo, cuerpo) => (ya(clave) ? null : { clave: clave, titulo: titulo, cuerpo: cuerpo });
  const sig = c.siguiente ? c.siguiente.nombre + (c.siguiente.situacion ? ' (' + c.siguiente.situacion + ')' : '') : '';
  const transcurrido = (c.minuto - c.inicio) / (c.fin - c.inicio);
  const total = c.hechas + c.pendientes;
  const falta = c.fin - c.minuto;
  const candidatos = [];
  if (c.nuevaMedalla) candidatos.push(dale('medalla-' + c.nuevaMedalla.clave, c.nuevaMedalla.emoji + ' ¡Nueva medalla, ' + pila + '!', c.nuevaMedalla.nombre + ': ' + c.nuevaMedalla.como + '.'));
  if (c.diaSemana === 1 && c.minuto - c.inicio <= 60) candidatos.push(dale('lunes', '👋 ¡Buena semana, ' + pila + '!', 'Qué bueno tenerte de vuelta. Al cerrar el turno te vamos a preguntar qué fue lo mejor de tu finde.'));
  if (c.hechas === 0 && c.pendientes > 0 && c.minuto - c.inicio <= 30) candidatos.push(dale('arranque', '☀️ ¡Buen arranque, ' + pila + '!', 'Hoy tenés ' + c.pendientes + ' tareas.' + (sig ? ' Podés empezar por ' + sig + '.' : '')));
  if (c.prioritarias > 0 && transcurrido >= 0.25 && transcurrido < 0.75) candidatos.push(dale('prioritarias', '🔴 ' + pila + ', quedan ' + c.prioritarias + ' de las primeras', 'Son las que no conviene dejar pasar.' + (sig ? ' Seguí con ' + sig + '.' : '')));
  if (c.volvieron > 0) candidatos.push(dale('volvieron-' + c.volvieron, '🙌 ' + (c.volvieron === 1 ? 'Un socio volvió' : c.volvieron + ' socios volvieron') + ' después de tu contacto', 'Este mes, ' + pila + '. Eso es lo que hace tu mensaje.'));
  if (c.equipoHechas >= 10 && c.equipoFaltan > 0 && transcurrido >= 0.5) candidatos.push(dale('equipo-' + Math.floor(c.equipoHechas / 10), '🤝 Entre todos ya van ' + c.equipoHechas, 'En tu sede hoy quedan ' + c.equipoFaltan + '. ¡Se nota cuando tiramos para el mismo lado!'));
  if (c.pendientes > 0 && c.hechas > 0 && falta <= 60) candidatos.push(dale('ultima-hora', '⏳ ' + pila + ', última hora de tu turno', 'Te ' + (c.pendientes === 1 ? 'queda 1 tarea' : 'quedan ' + c.pendientes + ' tareas') + '.' + (sig ? ' La próxima: ' + sig + '.' : '')));
  if (c.ayer > 0 && c.hechas > c.ayer) candidatos.push(dale('supero-ayer', '🏆 ¡Superaste a tu yo de ayer, ' + pila + '!', c.hechas + ' tareas hoy contra ' + c.ayer + ' ayer. Excelente.'));
  if (c.pendientes === 0 && c.adelantar > 0) candidatos.push(dale('adelantar', '✅ ' + pila + ', estás al día', 'Hay ' + c.adelantar + ' tareas para adelantar, y cada una suma un punto extra. ¿Sumamos unas más?'));
  if (c.hechas > 0 && c.hechas % 5 === 0) candidatos.push(dale('cuenta-' + c.hechas, '💪 ¡Ya van ' + c.hechas + ', ' + pila + '!', c.pendientes ? 'Cada contacto cuenta. ' + (sig ? 'Seguí con ' + sig + '.' : '') : 'Vas al día.'));
  if (transcurrido >= 0.5 && total > 0 && c.hechas / total < 0.4) candidatos.push(dale('ritmo', '⏱️ ' + pila + ', ya pasó la mitad de tu turno', 'Llevás ' + c.hechas + ' de ' + total + '. Con unos minutos ahora, llegás bien.' + (sig ? ' Seguí con ' + sig + '.' : '')));
  if (c.diasSinPlan >= 3) candidatos.push(dale('plan', '🎁 Hoy va un plan de 3 meses, ' + pila, 'Van ' + c.diasSinPlan + ' días sin venderlo, y vale el doble de puntos. Al próximo que renueve, ofrecéselo.'));
  if (c.racha >= 3) candidatos.push(dale('racha', '🔥 ¡' + c.racha + ' días seguidos, ' + pila + '!', 'Esa constancia es la que hace que los socios se queden.'));
  if (c.pendientes > 0 && c.minutosSinMarcar >= 40) {
    const tanda = Math.floor(c.minuto / 40);
    candidatos.push(dale('sin-marcar-' + tanda, '👀 ¿Seguimos, ' + pila + '?', 'Si tenés un momento libre, te esperan ' + c.pendientes + ' tareas.' + (sig ? ' La próxima: ' + sig + '.' : '')));
  }
  return candidatos.find(x => x) || null;
}

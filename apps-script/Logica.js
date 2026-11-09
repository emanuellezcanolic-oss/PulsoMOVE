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
                    'AGENDADA', 'REPROGRAMADA', 'SE HIZO', 'NO SE HACE', 'CORREGIDO', 'MULTISEDE', 'DE PASO', 'LO SIGUE EL PROFE', 'LO CAMBIA EL PROFE', 'NO HACE FALTA', 'RESPONDIÓ', 'ELIGIÓ PRODUCTO', 'ELIGIÓ RECOVERY', 'LO PIENSA'];
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

// Las respuestas posibles según lo que pide cada tarea (Emanuel, 05/11/2026). Lo que no está acá muestra la lista completa.
const NO_SE_PUDO = ['No se pudo hablar', [['NO CONTESTA', 'No contesta'], ['TEL MAL', 'El teléfono está mal']]];
const MOTIVOS = t => [t, [['PRECIO', 'Por el precio'], ['HORARIOS', 'No le sirven los horarios'], ['SALUD', 'Por salud'], ['PAUSA', 'Hace una pausa'], ['BAJA', 'Se da de baja']]];
const AVISADO = ['Solo se le avisó', [['NOTIFICADO', 'Le escribí: espero respuesta']]];
const RESULTADOS_POR_TIPO = [
  ['Recordar turno', [['Respondió', [['RESPONDIÓ', 'Confirmó que viene'], ['REPROGRAMADA', 'Lo cambiamos de día']]], AVISADO, NO_SE_PUDO]],
  ['Preguntar cómo sigue', [['Respondió', [['RESPONDIÓ', 'Ya está mejor']]], ['Sigue igual', [['SALUD', 'Sigue con el problema: volver a preguntar en una semana']]], AVISADO, ['Se va', [['BAJA', 'Se da de baja']]], NO_SE_PUDO]],
  ['Socio nuevo · semana 2', [['Respondió', [['RESPONDIÓ', 'Respondió el mensaje'], ['RESERVA', 'Respondió y quedó con turnos']]], AVISADO, MOTIVOS('Qué le pasa'), NO_SE_PUDO]],
  ['Socio nuevo', [['Ya se resolvió', [['RESERVA', 'Quedó con turnos reservados']]], AVISADO, MOTIVOS('Por qué no reserva'), NO_SE_PUDO]],
  ['Le vence el plan', [['Ya se resolvió', [['PAGÓ', 'Renovó'], ['RESERVA', 'Dejó turnos reservados']]], ['Quedó en una fecha', [['PAGA', 'Va a renovar'], ['VACACIONES', 'Se va de vacaciones']]], AVISADO, MOTIVOS('Por qué no renueva'), NO_SE_PUDO]],
  ['Vence', [['Ya se resolvió', [['PAGÓ', 'Renovó'], ['RESERVA', 'Dejó turnos reservados']]], ['Quedó en una fecha', [['PAGA', 'Va a renovar'], ['VACACIONES', 'Se va de vacaciones']]], AVISADO, MOTIVOS('Por qué no renueva'), NO_SE_PUDO]],
  ['Vencieron', [['Ya se resolvió', [['PAGÓ', 'Renovó']]], ['Quedó en una fecha', [['PAGA', 'Va a renovar'], ['VUELVE', 'Vuelve más adelante']]], AVISADO, MOTIVOS('Por qué no renovó'), NO_SE_PUDO]],
  ['Socio antiguo', [['Ya se resolvió', [['VOLVIÓ', 'Volvió'], ['RESERVA', 'Reservó un turno']]], ['Quedó en una fecha', [['VUELVE', 'Vuelve más adelante']]], AVISADO, MOTIVOS('Por qué no vuelve'), NO_SE_PUDO]],
  ['Para hablar cuando vengan', [['Ya se resolvió', [['RESERVA', 'Le enseñé y reservó']]], ['Solo se le avisó', [['NOTIFICADO', 'Le expliqué, todavía no reservó']]], MOTIVOS('Qué le pasa')]],
  ['De vacaciones', [['Ya se resolvió', [['VOLVIÓ', 'Volvió'], ['RESERVA', 'Reservó un turno']]], ['Quedó en una fecha', [['VACACIONES', 'Sigue de vacaciones']]], AVISADO, MOTIVOS('Qué le pasa'), NO_SE_PUDO]],
  ['Riesgo alto', [['Ya se resolvió', [['PAGÓ', 'Renovó'], ['VOLVIÓ', 'Volvió'], ['RESERVA', 'Reservó un turno']]], ['Quedó en una fecha', [['VUELVE', 'Vuelve'], ['VACACIONES', 'Se va de vacaciones']]], AVISADO, MOTIVOS('Por qué no viene'), NO_SE_PUDO]],
  ['Pagó y no viene', [['Ya se resolvió', [['VOLVIÓ', 'Volvió'], ['RESERVA', 'Reservó un turno']]], ['Quedó en una fecha', [['VUELVE', 'Vuelve'], ['VACACIONES', 'Está de vacaciones']]], AVISADO, MOTIVOS('Por qué no viene'), NO_SE_PUDO]],
  ['Faltó', [['Ya se resolvió', [['VOLVIÓ', 'Volvió'], ['RESERVA', 'Reservó un turno']]], ['Quedó en una fecha', [['VUELVE', 'Vuelve'], ['VACACIONES', 'Está de vacaciones']]], AVISADO, MOTIVOS('Por qué faltó'), NO_SE_PUDO]],
  ['Viene menos', [['Ya se resolvió', [['VOLVIÓ', 'Volvió a venir'], ['RESERVA', 'Reservó un turno']]], ['Quedó en una fecha', [['VUELVE', 'Vuelve'], ['VACACIONES', 'Está de vacaciones']]], AVISADO, MOTIVOS('Por qué viene menos'), NO_SE_PUDO]],
];

function resultadosDe(tipo) {
  const t = String(tipo);
  const f = RESULTADOS_POR_TIPO.find(x => t.indexOf(x[0]) === 0);
  return f ? f[1] : GRUPOS_RESULTADO.map(g => [g[0], g[1].map(v => [v, v])]);
}

// Tareas que no se marcan a mano: se dan por hechas solo cuando MOVE muestra el dato cargado.
const SE_VERIFICAN_EN_MOVE = ['Asignarle profesor', 'Completar ficha', 'Corregir calendario'];

// Avisos para el turno: se leen, no se marcan ni cuentan como tarea. La llegada de los profes se mide sola con el QR.
function esRecordatorio(tipo) {
  return String(tipo).indexOf('Profes de hoy') === 0;
}

// Fichaje en vivo: la PC sube cada 5 minutos a quién le falta fichar. Lo que deja de faltar se cierra solo.
const FICHAJES_VIGENCIA_MIN = 20;   // sin datos más nuevos no se muestra: esa persona ya pudo haber fichado
const FICHAJE_REAVISAR_MIN = 15;    // "ya se lo recordé" vale esto; si sigue sin QR, vuelve a pedirse

function fusionarFichajes(existentes, nuevas, fecha, ts) {
  const llegan = {};
  nuevas.forEach(n => { llegan[n.id] = n; });
  const piso = sumarDias(fecha, -35);
  let cambio = false;
  const filas = existentes.filter(f => {
    const queda = String(f.fecha) >= piso;
    if (!queda) cambio = true;
    return queda;
  }).map(f => {
    const c = Object.assign({}, f);
    if (c.estado === 'falta' && !llegan[c.id]) { c.estado = 'cerrada'; c.cerrada_ts = ts; cambio = true; }
    else if (c.estado === 'cerrada' && llegan[c.id]) { c.estado = 'falta'; c.cerrada_ts = ''; cambio = true; }
    return c;
  });
  nuevas.forEach(n => {
    if (filas.some(f => f.id === n.id)) return;
    cambio = true;
    filas.push({ id: n.id, fecha: fecha, sede: n.sede, persona_id: n.persona_id, persona: n.persona, dni: n.dni || '', momento: n.momento, hora: n.hora,
      estado: 'falta', desde_ts: ts, cerrada_ts: '', recordado_ts: '', recordado_dni: '', no_viene_ts: '', no_viene_dni: '' });
  });
  return { filas: filas, cambio: cambio };
}

// Lo ve la recepción de esa sede que está en su turno, y solo de otras personas: a nadie se le recuerda su propio
// fichaje en la app, porque el QR de ingreso lo escanea cada uno y el cartel era ruido (Emanuel, 09/11/2026).
// Se sigue registrando quién fichó y quién no: lo que se saca es el aviso, no la medición.
function fichajesVisibles(filas, c) {
  const noViene = {};
  filas.forEach(f => { if (f.fecha === c.hoy && f.no_viene_ts) noViene[f.sede + '|' + f.persona_id] = true; });
  return filas.filter(f => f.fecha === c.hoy && f.estado === 'falta' && !noViene[f.sede + '|' + f.persona_id]
      && f.dni !== c.dni && c.recepcion && c.enTurno && f.sede === c.sede)
    .map(f => ({ id: f.id, persona: f.persona, momento: f.momento, hora: f.hora, recordado: f.recordado_ts,
      urgente: !f.recordado_ts || c.ahora - Date.parse(f.recordado_ts) > FICHAJE_REAVISAR_MIN * 60000 }))
    .sort((a, b) => Number(b.urgente) - Number(a.urgente) || String(a.hora).localeCompare(String(b.hora)));
}

// Reservas sin QR: la PC sube cada 5 minutos quién reservó una clase ya empezada y sigue sin asistencia en MOVE.
const RESERVA_LIMITE_QR_MIN = 15;   // pasado esto el socio ya no puede escanear: le toca al profe dar el presente

function fusionarReservas(existentes, nuevas, fecha, ts) {
  const llegan = {};
  nuevas.forEach(n => { llegan[n.id] = n; });
  const piso = sumarDias(fecha, -35);
  let cambio = false;
  const filas = existentes.filter(f => {
    const queda = String(f.fecha) >= piso;
    if (!queda) cambio = true;
    return queda;
  }).map(f => {
    const c = Object.assign({}, f);
    if (c.estado === 'falta' && !llegan[c.id]) { c.estado = 'cerrada'; c.cerrada_ts = ts; cambio = true; }
    else if (c.estado === 'cerrada' && llegan[c.id]) { c.estado = 'falta'; c.cerrada_ts = ''; cambio = true; }
    return c;
  });
  nuevas.forEach(n => {
    if (filas.some(f => f.id === n.id)) return;
    cambio = true;
    filas.push({ id: n.id, fecha: fecha, sede: n.sede, socio_id: n.socio_id, socio: n.socio, clase: n.clase || '', profe: n.profe || '', hora: n.hora, fin: n.fin || '',
      estado: 'falta', desde_ts: ts, cerrada_ts: '', recordado_ts: '', recordado_dni: '', resuelta_ts: '', resuelta_dni: '', resultado: '', detalle: '' });
  });
  return { filas: filas, cambio: cambio };
}

// Lo ve la recepción de esa sede en su turno, hasta que MOVE muestre la asistencia o ella lo resuelva. minuto: minuto actual del día.
function reservasVisibles(filas, c, minuto) {
  if (!c.recepcion || !c.enTurno) return [];
  return filas.filter(f => f.fecha === c.hoy && f.estado === 'falta' && !f.resuelta_ts && f.sede === c.sede)
    .map(f => {
      const ini = aMinutoDelDia(f.hora), fin = aMinutoDelDia(f.fin);
      return { id: f.id, socio: f.socio, clase: f.clase, profe: f.profe, hora: f.hora, recordado: f.recordado_ts,
        puede_escanear: minuto - ini < RESERVA_LIMITE_QR_MIN, termino: fin != null && minuto >= fin };
    })
    .sort((a, b) => String(a.hora).localeCompare(String(b.hora)) || String(a.socio).localeCompare(String(b.socio)));
}

// Lo que el equipo fue anotando de un socio, sea cual sea la tarea. Las tareas guardan el id con un prefijo (eval-123, salud-123-20261109).
const HISTORIAL_MAXIMO = 5;
function idDeSocio(id) {
  const m = /^(?:[a-záéíóúñ]+-)?(\d+)(?:-\d+)?$/.exec(String(id));
  return m ? m[1] : '';
}

function historialDeSocios(registro, reservas) {
  const porSocio = {};
  const sumar = (id, ts, tipo, resultado, detalle) => {
    const i = idDeSocio(id);
    if (!i || (!detalle && !resultado)) return;
    (porSocio[i] = porSocio[i] || []).push({ ts: String(ts), tipo: String(tipo || '').split(':')[0], resultado: String(resultado || ''), detalle: String(detalle || '') });
  };
  registro.forEach(r => sumar(r.socio_id, r.ts, r.tipo, r.resultado, r.detalle));
  reservas.filter(r => r.resultado === 'contacto' && r.detalle).forEach(r => sumar(r.socio_id, r.resuelta_ts, 'Reserva sin QR', '', r.detalle));
  Object.keys(porSocio).forEach(i => { porSocio[i] = porSocio[i].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, HISTORIAL_MAXIMO); });
  return porSocio;
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

// Lo que se cuenta en cada sede para los reconocimientos a socios (Emanuel, 05/11/2026). La lista se cambia acá.
const PRODUCTOS_STOCK = ['Proteína ENA 930 g', 'Proteína ENA 453 g', 'Plant Protein ENA', 'Colágeno ENA', 'Creatina ENA 350 g', 'Creatina ENA 150 g', 'Citrato de magnesio', 'Omega', 'Cafeína', 'Shaker ENA',
                         'Barritas', 'Alfajor proteico', 'Bombones proteicos', 'Agua 500 ml', 'Agua 1 L', 'Gatorade 500 ml', 'Gatorade 750 ml', 'Red Bull', 'Corona Cero',
                         'Remeras', 'Musculosas', 'Buzos', 'Shorts', 'Gorras', 'Botas de presoterapia'];
// Lo que no se vende en todas las sedes (Emanuel, 05/11/2026): café en El Bolsón y Bariloche; pistola y botas para llevar, solo en Bariloche
const PRODUCTOS_STOCK_SEDE = { bariloche: ['Café', 'Botas de compresión para vender', 'Pistola de masajes para vender'], bolson: ['Café'], puelo: [] };
function productosStockDe(sede) {
  return PRODUCTOS_STOCK.concat(PRODUCTOS_STOCK_SEDE[sede] || []);
}

// ---------- Prioridad ----------
// Qué se hace primero. Arriba, lo que se pierde si se deja pasar: en las rondas de octubre, contactar antes del vencimiento rindió 78% contra 62%.
const NIVELES = [
  { n: 1, emoji: '🔴', titulo: 'Primero esto', ayuda: 'Si se deja pasar, se puede perder el socio.' },
  { n: 2 },   // sin título: siguen en orden, y "después" o "cuando tengas un rato" confundían (Emanuel, 05/11/2026)
  { n: 3 },
];
const TIPOS_NIVEL_1 = ['Encargo', 'Controlar stock', 'Apertura', 'Pagó y no viene', 'Le vence el plan', 'Vence', 'Socio nuevo', 'Vencieron'];   // el orden de urgencia de Emanuel (03/11/2026)
const TIPOS_NIVEL_3 = ['Socio antiguo', 'Revisar profesor', 'Completar ficha', 'Asignarle profesor', 'Cierre'];

// La semana del 04 al 06/11/2026 fue de práctica: las estadísticas de recepción arrancan de cero el lunes 09/11 (Emanuel, 07/11/2026).
// No se borra nada: lo anterior queda guardado pero no cuenta, y lo pendiente de la práctica empieza a contar desde el lunes.
var INICIO_REAL = '2026-11-09';   // var: las pruebas lo mueven
function pendienteDesde(t) {
  const p = String(t.pendiente_desde);
  return p < INICIO_REAL ? INICIO_REAL : p;
}
const CARTEL_INICIO = 'inicio-estadisticas-2026-11';

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
    ['brujula', '🧭', 'Brújula', '3 socios con la sede corregida y confirmada en MOVE', 'corregidos', 3],
    ['volvieron', '🙌', 'Volvieron por vos', '3 socios que volvieron después de tu contacto', 'volvieron', 3],
    ['voz', '💬', 'Voz del equipo', 'Contar cómo fue tu día 10 veces', 'encuestas', 10],
  ];
  return M.map(m => {
    const actual = Number(c[m[4]]) || 0;
    return { clave: m[0], emoji: m[1], nombre: m[2], como: m[3], actual: Math.min(actual, m[5]), meta: m[5], ganada: actual >= m[5] };
  });
}

// Qué más se puede hacer además de las tareas (Emanuel, 05/11/2026): un poco de todo. Primero lo más lejos del objetivo del mes;
// lo que ya hizo hoy va al final y, a igual avance, la rotación cambia cada día. Son ideas: el texto lo escribe cada persona.
const IDEAS_SUMAR = [
  { clave: 'resena', emoji: '⭐', titulo: 'Pedí una reseña de Google', como: 'A alguien que hoy se vaya contento.', valor: 'resenas', tipo: 'resena' },
  { clave: 'referido', emoji: '🤝', titulo: 'Preguntá por un referido', como: 'A un socio con buena onda: ¿quién más podría venir?', valor: 'referidos', tipo: 'referido' },
  { clave: 'plan', emoji: '🎁', titulo: 'Ofrecé un plan de 3 meses', como: 'Al próximo que venga a renovar.', valor: 'planes_largos', tipo: '' },
  { clave: 'tienda', emoji: '🛍️', titulo: 'Mostrá indumentaria o suplementos', como: 'A quien salga de entrenar.', valor: 'tienda', tipo: '' },
  { clave: 'prueba', emoji: '🎟️', titulo: 'Invitá a un día de prueba', como: 'A quien venga a averiguar por un servicio.', valor: 'dias_prueba', tipo: 'prueba', objetivo: 2 },
  { clave: 'mensaje', emoji: '💬', titulo: 'Recuperá a un socio que se alejó', como: 'Mejor con un audio corto y con tu voz: preguntale cómo anda, sin reproches ni hablar de cuotas. Si quiere volver, dejale el turno reservado.', valor: 'mensajes', tipo: 'mensaje' },
];

// c: {valores, objetivos, hechoHoy: {tipo: cantidad}, fecha}
function ideasParaSumar(c) {
  const objetivo = i => {
    const propio = c.objetivos && c.objetivos[i.valor];
    if (propio != null) return Number(propio);
    if (i.objetivo) return i.objetivo;
    const m = METRICAS.find(x => x.clave === i.valor);
    return m ? m.objetivo : 1;
  };
  const dia = Math.floor(Date.parse(c.fecha + 'T12:00:00Z') / 86400000) || 0;
  const hoy = c.hechoHoy || {};
  return IDEAS_SUMAR.map((i, n) => {
    const llevas = Number((c.valores || {})[i.valor]) || 0, meta = objetivo(i);
    return { clave: i.clave, emoji: i.emoji, titulo: i.titulo, como: i.como, tipo: i.tipo, llevas: llevas, meta: meta,
             puntos: PUNTOS[i.valor] || 0, hecha: !!(i.tipo && hoy[i.tipo]), avance: meta > 0 ? llevas / meta : 1, turno: (n + dia) % IDEAS_SUMAR.length };
  }).filter(i => i.avance < 1)
    .sort((a, b) => (a.hecha - b.hecha) || (Math.round(a.avance * 4) - Math.round(b.avance * 4)) || (a.turno - b.turno))
    .map(i => ({ clave: i.clave, emoji: i.emoji, titulo: i.titulo, como: i.como, tipo: i.tipo, llevas: i.llevas, meta: i.meta, puntos: i.puntos }));
}

// Nivel de eficiencia: lo que rinde cada hora de turno. Referencias propuestas por Claude (05/11/2026) con los primeros días de uso y las ventas de octubre: se ajustan acá.
const EFICIENCIA = [
  { clave: 'tareas_hora', objetivo: 4, peso: 50 },    // una tarea cada 15 minutos, contando el tiempo de atender
  { clave: 'ventas_hora', objetivo: 1, peso: 25 },    // octubre: la mejor persona hizo cerca de 1 punto de venta por hora
  { clave: 'uso_pct', objetivo: 0.6, peso: 25 },      // atender en persona no se ve en la app: no se le pide el 100%
];

// c: {horas, horasApp, horasCaja, tareas, puntosVenta, minutosActivos, minutosConSenal}. Las tareas se miden sobre los días que usó la app y las ventas sobre los días de caja.
// Si no hubo días de app o de caja, esa parte no resta; un cero en días trabajados sí cuenta.
function eficienciaDe(c) {
  if (!(c.horas > 0)) return null;
  const valores = { tareas_hora: c.horasApp > 0 ? (c.tareas || 0) / c.horasApp : null, ventas_hora: c.horasCaja > 0 ? (c.puntosVenta || 0) / c.horasCaja : null, uso_pct: c.minutosConSenal > 0 ? c.minutosActivos / c.minutosConSenal : null };
  const con = EFICIENCIA.filter(e => valores[e.clave] != null);
  const pesos = con.reduce((a, e) => a + e.peso, 0);
  const uno = n => (n == null ? null : Math.round(n * 10) / 10);
  return {
    horas: Math.round(c.horas), tareas_hora: uno(valores.tareas_hora), ventas_hora: uno(valores.ventas_hora), uso_pct: valores.uso_pct == null ? null : Math.round(valores.uso_pct * 100),
    indice: pesos ? Math.round(con.reduce((a, e) => a + Math.min(1, valores[e.clave] / e.objetivo) * e.peso, 0) / pesos * 100) : null,
  };
}

// Media hora antes del fin del turno: una recomendación para ir cerrando, que cambia cada día (Emanuel, 04/11/2026).
const IDEAS_CIERRE = [
  'empezás a revisar los baños y a acomodar tu área de trabajo',
  'acomodás tu área de trabajo y das una vuelta por los baños',
  'dejás lista la recepción y revisás los baños y las bolsas',
  'vas ordenando la recepción y anotás las novedades para el inbox',
];

function avisoMediaHora(nombre, pendientes, semilla) {
  const pila = String(nombre || '').trim().split(/\s+/)[0];
  const idea = IDEAS_CIERRE[Math.abs(Number(semilla) || 0) % IDEAS_CIERRE.length];
  const resto = pendientes > 0 ? ' Te ' + (pendientes === 1 ? 'queda 1 tarea' : 'quedan ' + pendientes + ' tareas') + ': si no llegás, al cerrar vas a contar por qué.' : ' Tus tareas están al día. ¡Bien ahí!';
  return { titulo: '⏰ ' + pila + ', falta media hora para tu cierre', cuerpo: '¿Qué te parece si ' + idea + '?' + resto };
}

// La encuesta del cierre cambia cada día para no volverse monótona (Emanuel, 04/11/2026): siempre cómo fue su día,
// más una nota y una pregunta abierta que van rotando. Los lunes, lo mejor del finde. Dos días seguidos nunca repite.
const PREGUNTAS_NOTA = [
  { clave: 'sala', titulo: '¿Cómo viste la sala?', bajo: 'Con mucho caos', alto: 'Muy organizada' },
  { clave: 'profes', titulo: '¿Cómo viste a los profes?', bajo: 'Poco presentes', alto: 'Muy presentes' },
  { clave: 'equipo', titulo: '¿Cómo te sentiste con tus compañeros?', bajo: 'Con poco apoyo', alto: 'Con mucho apoyo' },
  { clave: 'socios', titulo: '¿Cómo viste a los socios hoy?', bajo: 'Con pocas ganas', alto: 'Con muchas ganas' },
];
const PREGUNTAS_ABIERTAS = [
  '✨ ¿Qué fue lo mejor de hoy?',
  '🙏 ¿A quién del equipo le agradecerías algo hoy, y por qué?',
  '💡 ¿Qué cambiarías para que mañana salga mejor?',
  '😊 ¿Algún socio te alegró el día? Contanos.',
  '🏅 ¿Qué te salió bien hoy?',
];
const PREGUNTA_FINDE = '🌤️ ¿Qué fue lo mejor que te pasó este finde?';

function preguntasDelDia(fecha, semilla) {
  const dia = Math.floor(Date.parse(fecha + 'T12:00:00Z') / 86400000);
  const n = dia + Math.abs(Number(semilla) || 0);
  const lunes = new Date(fecha + 'T12:00:00Z').getUTCDay() === 1;
  return { nota: PREGUNTAS_NOTA[n % PREGUNTAS_NOTA.length], abierta: lunes ? PREGUNTA_FINDE : PREGUNTAS_ABIERTAS[n % PREGUNTAS_ABIERTAS.length] };
}

// Lo que contestan al cerrar el turno, resumido para coordinación. Baja: alguna nota de 2 o menos.
function resumenCierres(cierres) {
  const prom = (filas, k) => {
    const v = filas.map(c => Number(c[k])).filter(x => x >= 1 && x <= 5);
    return v.length ? Math.round(10 * v.reduce((a, b) => a + b, 0) / v.length) / 10 : null;
  };
  const de = filas => ({ respuestas: filas.length, dia: prom(filas, 'animo'), sala: prom(filas, 'sala'), profes: prom(filas, 'profes'), equipo: prom(filas, 'equipo'), socios: prom(filas, 'socios') });
  const sedes = {};
  cierres.forEach(c => { (sedes[c.sede] = sedes[c.sede] || []).push(c); });
  return {
    total: de(cierres),
    sedes: Object.keys(sedes).sort().map(s => Object.assign({ sede: s }, de(sedes[s]))),
    bajas: cierres.filter(c => ['animo', 'sala', 'profes', 'equipo', 'socios'].some(k => Number(c[k]) >= 1 && Number(c[k]) <= 2)).length,
  };
}

// Contactos delicados: un audio obliga a abrirlo y el tono de voz cambia cómo llega el mensaje.
const TIPOS_AUDIO = ['Socio antiguo', 'Pagó y no viene', 'Vencieron', 'Riesgo alto', 'Encuesta de baja', 'Faltó', 'Viene menos', 'De vacaciones'];

function recomiendaAudio(tipo) {
  return TIPOS_AUDIO.some(t => String(tipo).indexOf(t) === 0);
}

// ---------- Uso de la app por minuto: solo para quien coordina y no atiende recepción ----------

const MINUTOS_ALERTA_USO = 45;   // 40 sin tocar la app, más el margen de envío: la señal llega cada 5 minutos
const MINUTOS_SIN_ENTRAR = 30;

function minutoDeTs(ts) {
  const ms = Date.parse(ts);
  return isNaN(ms) ? null : Math.floor((((ms - 3 * 3600 * 1000) % 86400000) + 86400000) % 86400000 / 60000);
}

function aMinutoDelDia(hhmm) {
  return /^\d{1,2}:\d{2}$/.test(String(hhmm)) ? Number(String(hhmm).split(':')[0]) * 60 + Number(String(hhmm).split(':')[1]) : null;
}

// filas: hoja uso de ese día y esa persona. marcas: sus tareas de ese día. ahora: minuto actual si el día sigue, null si ya pasó.
// Una marca cuenta como minuto activo. con_senal: false en los días anteriores al registro por minuto.
function usoDelDia(filas, marcas, inicio, fin, ahora) {
  const estado = {};
  const pone = (lista, e) => String(lista || '').split(',').forEach(x => {
    const m = Number(x);
    if (x === '' || !(m >= 0 && m < 1440)) return;
    if (!estado[m] || e === 'a' || (e === 'o' && estado[m] === 'q')) estado[m] = e;
  });
  filas.forEach(f => { pone(f.quieta, 'q'); pone(f.otra, 'o'); pone(f.activos, 'a'); });
  const conSenal = Object.keys(estado).length > 0;
  const completando = {};
  let segundos = 0;
  marcas.forEach(r => {
    const m = minutoDeTs(r.ts);
    if (m == null) return;
    estado[m] = 'a';
    const s = Number(r.segundos) || 0;
    segundos += s;
    const h = Math.floor(m / 60);
    completando[h] = (completando[h] || 0) + s;
  });
  const vistos = Object.keys(estado).map(Number).sort((a, b) => a - b);
  const desde = inicio != null ? inicio : (vistos.length ? vistos[0] : 0);
  let hasta = fin != null ? fin : (vistos.length ? vistos[vistos.length - 1] + 1 : 0);
  if (ahora != null) hasta = Math.min(hasta, ahora);
  const r = { con_senal: conSenal, activo: 0, quieta: 0, otra: 0, cerrada: 0, completando: Math.round(segundos / 60), huecos: [], primera: vistos.length ? vistos[0] : null, ultima: vistos.length ? vistos[vistos.length - 1] : null, ultima_activa: null, completando_por_hora: completando };
  let hueco = null;
  const cierra = m => { if (hueco != null && m - hueco >= 40) r.huecos.push({ desde: hueco, hasta: m, minutos: m - hueco }); hueco = null; };
  for (let m = desde; m < hasta; m++) {
    const e = estado[m];
    if (e === 'a') r.activo++; else if (e === 'q') r.quieta++; else if (e === 'o') r.otra++; else r.cerrada++;
    if (e === 'a') cierra(m); else if (hueco == null) hueco = m;
  }
  cierra(hasta);
  for (let i = vistos.length - 1; i >= 0; i--) if (estado[vistos[i]] === 'a') { r.ultima_activa = vistos[i]; break; }
  return r;
}

// Cómo está ahora una persona, para la vista de sede. c: {uso, inicio, fin, ahora, pendientes, cerro, habil}
function estadoEnVivo(c) {
  if (c.inicio == null || c.fin == null) return { color: 'gris', texto: 'Sin horario cargado' };
  if (c.ahora < c.inicio) return { color: 'gris', texto: 'Todavía no empieza' };
  if (c.ahora >= c.fin) {
    if (!c.uso.primera && c.uso.primera !== 0) return c.habil ? { color: 'rojo', texto: 'No registró actividad en su turno' } : { color: 'gris', texto: 'Sin actividad hoy' };
    if (c.pendientes > 0) return { color: 'rojo', texto: 'Terminó el turno con ' + c.pendientes + (c.pendientes === 1 ? ' pendiente' : ' pendientes') };
    return { color: 'verde', texto: 'Terminó el turno al día' };
  }
  if (c.uso.ultima_activa == null) {
    return c.habil && c.ahora - c.inicio >= MINUTOS_SIN_ENTRAR ? { color: 'rojo', texto: 'No entró: van ' + (c.ahora - c.inicio) + ' min de turno' } : { color: 'gris', texto: 'Todavía no entró' };
  }
  const sin = c.ahora - c.uso.ultima_activa;
  if (sin >= MINUTOS_ALERTA_USO) return { color: 'rojo', texto: 'Sin tocar la app hace ' + sin + ' min' };
  return { color: 'verde', texto: sin <= 5 ? 'Usando la app ahora' : 'Usó la app hace ' + sin + ' min' };
}

// Avisos durante el turno. c: {nombre, minuto, inicio, fin (minutos del día), hechas, pendientes, minutosSinUso, enviados, siguiente, ayer, racha, adelantar, diasSinPlan}.
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
  if (c.pendientes > 0 && c.minutosSinUso >= 40) {
    const tanda = Math.floor(c.minuto / 40);
    const titulos = ['👀 ¿Seguimos, ' + pila + '?', '🙌 ' + pila + ', ¿qué te parece si continuamos?', '💪 ' + pila + ', ¿le damos a una más?'];
    candidatos.push(dale('sin-uso-' + tanda, titulos[tanda % titulos.length], 'Si tenés un momento libre, te esperan ' + c.pendientes + ' tareas.' + (sig ? ' La próxima: ' + sig + '.' : '')));
  }
  if (c.nuevaMedalla) candidatos.push(dale('medalla-' + c.nuevaMedalla.clave, c.nuevaMedalla.emoji + ' ¡Nueva medalla, ' + pila + '!', c.nuevaMedalla.nombre + ': ' + c.nuevaMedalla.como + '.'));
  if (c.diaSemana === 1 && c.minuto - c.inicio <= 60) candidatos.push(dale('lunes', '👋 ¡Buena semana, ' + pila + '!', 'Qué bueno tenerte de vuelta. Al cerrar el turno te vamos a preguntar qué fue lo mejor de tu finde.'));
  if (c.hechas === 0 && c.pendientes > 0 && c.minuto - c.inicio <= 30) candidatos.push(dale('arranque', '☀️ ¡Buen arranque, ' + pila + '!', 'Hoy tenés ' + c.pendientes + ' tareas.' + (sig ? ' Podés empezar por ' + sig + '.' : '')));
  if (c.prioritarias > 0 && transcurrido >= 0.25 && transcurrido < 0.75) candidatos.push(dale('prioritarias', '🔴 ' + pila + ', quedan ' + c.prioritarias + ' de las primeras', 'Son las que no conviene dejar pasar.' + (sig ? ' Seguí con ' + sig + '.' : '')));
  if (c.volvieron > 0) candidatos.push(dale('volvieron-' + c.volvieron, '🙌 ' + (c.volvieron === 1 ? 'Un socio volvió' : c.volvieron + ' socios volvieron') + ' después de tu contacto', 'Este mes, ' + pila + '. Eso es lo que hace tu mensaje.'));
  if (c.equipoHechas >= 10 && c.equipoFaltan > 0 && transcurrido >= 0.5) candidatos.push(dale('equipo-' + Math.floor(c.equipoHechas / 10), '🤝 Entre todos ya van ' + c.equipoHechas, 'En tu sede hoy quedan ' + c.equipoFaltan + '. ¡Se nota cuando tiramos para el mismo lado!'));
  if (c.pendientes > 0 && c.hechas > 0 && falta <= 60 && falta > 30) candidatos.push(dale('ultima-hora', '⏳ ' + pila + ', última hora de tu turno', 'Te ' + (c.pendientes === 1 ? 'queda 1 tarea' : 'quedan ' + c.pendientes + ' tareas') + '.' + (sig ? ' La próxima: ' + sig + '.' : '')));
  if (c.ayer > 0 && c.hechas > c.ayer) candidatos.push(dale('supero-ayer', '🏆 ¡Superaste a tu yo de ayer, ' + pila + '!', c.hechas + ' tareas hoy contra ' + c.ayer + ' ayer. Excelente.'));
  if (c.pendientes === 0 && c.idea) candidatos.push(dale('idea-' + c.idea.clave, c.idea.emoji + ' ' + pila + ', estás al día: ¿sumamos algo distinto?', c.idea.titulo + '. ' + c.idea.como));
  if (c.pendientes === 0 && c.adelantar > 0) candidatos.push(dale('adelantar', '✅ ' + pila + ', estás al día', 'Hay ' + c.adelantar + ' tareas para adelantar, y cada una suma un punto extra. ¿Sumamos unas más?'));
  if (c.hechas > 0 && c.hechas % 5 === 0) candidatos.push(dale('cuenta-' + c.hechas, '💪 ¡Ya van ' + c.hechas + ', ' + pila + '!', c.pendientes ? 'Cada contacto cuenta. ' + (sig ? 'Seguí con ' + sig + '.' : '') : 'Vas al día.'));
  if (transcurrido >= 0.5 && total > 0 && c.hechas / total < 0.4) candidatos.push(dale('ritmo', '⏱️ ' + pila + ', ya pasó la mitad de tu turno', 'Llevás ' + c.hechas + ' de ' + total + '. Con unos minutos ahora, llegás bien.' + (sig ? ' Seguí con ' + sig + '.' : '')));
  if (c.diasSinPlan >= 3) candidatos.push(dale('plan', '🎁 Hoy va un plan de 3 meses, ' + pila, 'Van ' + c.diasSinPlan + ' días sin venderlo, y vale el doble de puntos. Al próximo que renueve, ofrecéselo.'));
  if (c.racha >= 3) candidatos.push(dale('racha', '🔥 ¡' + c.racha + ' días seguidos, ' + pila + '!', 'Esa constancia es la que hace que los socios se queden.'));
  return candidatos.find(x => x) || null;
}

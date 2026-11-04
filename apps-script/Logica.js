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

const CANALES = ['MP', 'MG', 'LL', 'PR', 'SIN CONTACTO'];
const RESULTADOS = ['VOLVIÓ', 'VUELVE', 'RESERVA', 'PAGÓ', 'PAGA', 'VACACIONES', 'PAUSA', 'SALUD', 'HORARIOS',
                    'PRECIO', 'BAJA', 'NO CONTESTA', 'TEL MAL', 'ENCUESTA ENVIADA', 'SALUDADO', 'SIN CAMBIO'];
const PIDEN_FECHA = ['VUELVE', 'PAGA', 'VACACIONES'];
const PIDEN_DETALLE = ['BAJA', 'SIN CAMBIO'];

// Tareas que no se marcan a mano: se dan por hechas solo cuando MOVE muestra el dato cargado.
const SE_VERIFICAN_EN_MOVE = ['Asignarle profesor'];

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
  for (const nv of nuevas) {
    const k = clave(nv);
    const pend = filas.find(t => clave(t) === k && t.estado === 'pendiente');
    if (pend) {
      for (const c of CAMPOS_ACTUALIZABLES) pend[c] = c === 'fecha' ? fecha : String(nv[c] == null ? '' : nv[c]);
      act++;
      continue;
    }
    if (filas.some(t => clave(t) === k && t.fecha === fecha && t.estado !== 'pendiente')) {
      act++;
      continue;
    }
    filas.push({
      id: fecha + '-' + nv.sede + '-' + nv.socio_id, fecha: fecha, sede: nv.sede, socio_id: String(nv.socio_id),
      socio_nombre: String(nv.socio_nombre || ''), profe: String(nv.profe || ''), tipo: String(nv.tipo || ''),
      prioridad: String(nv.prioridad == null ? '' : nv.prioridad), situacion: String(nv.situacion || ''),
      accion: String(nv.accion || ''), ultima_anotacion: String(nv.ultima_anotacion || ''),
      asignado_dni: String(nv.asignado_dni || ''), pendiente_desde: fecha, estado: 'pendiente', hecha_en: '', intro: String(nv.intro || ''),
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

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

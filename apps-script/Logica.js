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

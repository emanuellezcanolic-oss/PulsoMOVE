// Carga los archivos de apps-script en un contexto aislado, como los ve Apps Script (ámbito global compartido).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ARCHIVOS = ['Logica.js', 'Api.js'];

function cargar() {
  const ctx = vm.createContext({});
  for (const a of ARCHIVOS) {
    const ruta = path.join(__dirname, '..', 'apps-script', a);
    if (fs.existsSync(ruta)) vm.runInContext(fs.readFileSync(ruta, 'utf8'), ctx, { filename: a });
  }
  return ctx;
}

module.exports = { cargar };

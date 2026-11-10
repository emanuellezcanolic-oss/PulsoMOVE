// Carga los archivos de apps-script en un contexto aislado, como los ve Apps Script (ámbito global compartido).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ARCHIVOS = ['Logica.js', 'Api.js', 'Profes.js'];

function cargar() {
  const ctx = vm.createContext({});
  for (const a of ARCHIVOS) {
    const ruta = path.join(__dirname, '..', 'apps-script', a);
    if (fs.existsSync(ruta)) vm.runInContext(fs.readFileSync(ruta, 'utf8'), ctx, { filename: a });
  }
  // Las constantes no quedan en el contexto por sí solas: se exponen las que miran las pruebas
  vm.runInContext('this.RESULTADOS = RESULTADOS; this.PIDEN_FECHA = PIDEN_FECHA; this.PREGUNTA_FECHA = PREGUNTA_FECHA; this.GRUPOS_RESULTADO = GRUPOS_RESULTADO; this.NIVELES = NIVELES; this.metaDelDia = metaDelDia; this.esContactoConSocio = esContactoConSocio;', ctx);
  return ctx;
}

module.exports = { cargar };

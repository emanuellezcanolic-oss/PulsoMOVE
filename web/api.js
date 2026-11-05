// PulsoMOVE · cliente de la Apps Script: sesión, pedidos y cola de marcas sin conexión.
(function (raiz) {
  const CLAVE_SESION = 'pulso_sesion';
  const CLAVE_COLA = 'pulso_cola';
  // Errores que no se arreglan reintentando: la marca se descarta y se avisa
  const DEFINITIVOS = ['prohibido', 'no_existe', 'datos_invalidos'];

  const MENSAJES = {
    credenciales: 'DNI o PIN incorrectos.',
    bloqueado: 'Demasiados intentos seguidos. Probá de nuevo en 15 minutos.',
    pin_invalido: 'Ese PIN no sirve: tienen que ser 4 números, no todos iguales ni seguidos (como 1234), y distinto del anterior.',
    sin_sesion: 'Tu sesión terminó. Entrá de nuevo con tu DNI y PIN.',
    debe_cambiar_pin: 'Antes de seguir tenés que elegir tu PIN nuevo.',
    prohibido: 'No tenés permiso para hacer eso.',
    datos_invalidos: 'Faltan datos o hay algo mal cargado. Revisá el formulario.',
    no_existe: 'Esa tarea o ese pedido ya no está. Actualizá la pantalla.',
    red: 'No hay conexión. Lo que marques se guarda en este equipo y se envía solo.',
    ocupado: 'El servidor está ocupado. Se reintenta solo en unos segundos.',
    interno: 'Algo falló en el servidor. Se reintenta solo; si sigue, avisale a Emanuel.',
  };

  function mensaje(codigo) {
    return MENSAJES[codigo] || 'Algo salió mal. Probá de nuevo.';
  }

  function ErrorPulso(codigo) {
    this.codigo = codigo;
    this.message = mensaje(codigo);
  }

  function nuevoId() {
    const c = raiz.crypto;
    if (c && c.randomUUID) return c.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function crearCliente(opciones) {
    const { url, fetch, almacen } = opciones;

    const leerJson = (k, def) => {
      try { const v = almacen.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
    };
    const guardarJson = (k, v) => { try { almacen.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

    // Una sesión sin token, nombre o roles no sirve: se vuelve a la pantalla de entrada en vez de dejar a la persona sin vistas (Ara, 05/11/2026)
    const sesion = () => {
      const s = leerJson(CLAVE_SESION, null);
      return s && s.token && s.nombre && Array.isArray(s.roles) && s.roles.length ? s : null;
    };
    const guardarSesion = s => guardarJson(CLAVE_SESION, s);
    const cerrarSesion = () => { try { almacen.removeItem(CLAVE_SESION); } catch (e) { /* nada */ } };
    const cola = () => leerJson(CLAVE_COLA, []);

    async function llamar(accion, datos) {
      const s = sesion();
      const cuerpo = Object.assign({ accion: accion }, s && s.token ? { token: s.token } : {}, datos || {});
      let r;
      try {
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) });
        r = await resp.json();
      } catch (e) {
        throw new ErrorPulso('red');
      }
      if (!r || !r.ok) {
        const codigo = (r && r.error) || 'interno';
        if (codigo === 'sin_sesion') cerrarSesion();
        throw new ErrorPulso(codigo);
      }
      return r.data;
    }

    // Envía la cola en orden. Corta en el primer error que se puede reintentar.
    async function enviarCola() {
      const descartadas = [];
      let pendientes = cola();
      while (pendientes.length) {
        const m = pendientes[0];
        try {
          await llamar('marcar', m);
        } catch (e) {
          if (DEFINITIVOS.indexOf(e.codigo) < 0) break;
          descartadas.push({ marca: m, error: e.codigo });
        }
        pendientes = cola().filter(x => x.id_marca !== m.id_marca);
        guardarJson(CLAVE_COLA, pendientes);
      }
      return { descartadas: descartadas };
    }

    // Guarda la marca en la cola y trata de enviarla ya. enviada=false si quedó esperando conexión.
    async function marcar(datos) {
      const m = Object.assign({ id_marca: nuevoId() }, datos);
      guardarJson(CLAVE_COLA, cola().concat([m]));
      const r = await enviarCola();
      return { enviada: !cola().some(x => x.id_marca === m.id_marca) && !r.descartadas.some(d => d.marca.id_marca === m.id_marca),
               descartadas: r.descartadas };
    }

    return {
      llamar, marcar, enviarCola, sesion, guardarSesion, cerrarSesion,
      pendientesDeEnvio: () => cola().length,
    };
  }

  const exportar = { crearCliente, mensaje, ErrorPulso };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportar;
  else raiz.PulsoApi = exportar;
})(typeof window !== 'undefined' ? window : globalThis);

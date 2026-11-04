// PulsoMOVE · modo práctica (?demo=1): corre el backend real (Logica.js + Api.js) en el navegador,
// con datos inventados en memoria. No se conecta a nada ni guarda nada en la planilla.
(function (raiz) {
  // Hash y firma de juguete: alcanzan porque todo vive en memoria y se borra al recargar
  function hashJuguete(s) {
    let h1 = 0x811c9dc5, h2 = 0x1b873593;
    for (let i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822507) >>> 0;
    }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  function hoyIso() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function diaHabilAntes(iso, n) {
    const d = new Date(iso + 'T12:00:00Z');
    while (n > 0) {
      d.setUTCDate(d.getUTCDate() - 1);
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n--;
    }
    return d.toISOString().slice(0, 10);
  }

  function diaHabilDespues(iso, n) {
    const d = new Date(iso + 'T12:00:00Z');
    while (n > 0) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n--;
    }
    return d.toISOString().slice(0, 10);
  }

  const PIMIENTA = 'demo';
  const PIN = '2580';
  const USUARIOS = [
    { dni: '11111111', nombre: 'Rocío (práctica)', sede: 'bolson', turno: 'manana', roles: 'recepcion' },
    { dni: '11111112', nombre: 'Tomás (práctica)', sede: 'bolson', turno: 'tarde', roles: 'recepcion' },
    { dni: '22222222', nombre: 'Responsable de sede (práctica)', sede: 'bolson', turno: 'manana', roles: 'recepcion,coordinador' },
    { dni: '44444444', nombre: 'Coordinación general (práctica)', sede: 'bolson', turno: 'manana', roles: 'recepcion,coordinador,admin' },
    { dni: '33333333', nombre: 'Admin (práctica)', sede: 'bolson', turno: 'manana', roles: 'admin' },
  ];

  function semilla() {
    const hoy = hoyIso();
    const usuarios = USUARIOS.map(u => Object.assign({}, u, {
      sal: 's' + u.dni, pin_hash: hashJuguete('s' + u.dni + ':' + PIN + ':' + PIMIENTA),
      debe_cambiar_pin: 'false', intentos: '0', bloqueado_hasta: '', activo: 'true',
    }));
    let n = 0;
    const t = (dni, tipo, prioridad, nombre, profe, situacion, accion, extra) => Object.assign({
      id: 'demo-' + (++n), fecha: hoy, sede: 'bolson', socio_id: 'D' + n, socio_nombre: nombre, profe: profe, tipo: tipo,
      prioridad: String(prioridad), situacion: situacion, accion: accion, ultima_anotacion: '', asignado_dni: dni,
      pendiente_desde: hoy, estado: 'pendiente', hecha_en: '',
    }, extra || {});
    const R = '11111111', C = '22222222', T = '11111112', G = '44444444';
    const tareas = [
      t(R, 'Socio nuevo · semana 2', 1, 'Valentina Ríos', 'Profe Sol', 'Alta el 27/10 · 2.ª semana', 'Mandar el mensaje de semana 2', { intro: 'Mensaje: “¿Cómo te sentiste en tu primera semana? ¿Algo que podamos mejorar?”.' }),
      t(R, 'Socio nuevo · semana 2', 1, 'Joaquín Paz', 'Profe Leo', 'Alta el 28/10 · 2.ª semana', 'Mandar el mensaje de semana 2'),
      t(R, 'Vence en 7 días', 2, 'Marta Quiroga', 'Profe Sol', 'Vence en 5 días', 'Llamar y reservarle el turno de la semana'),
      t(R, 'Pagó y no viene', 3, 'Diego Ferreyra', 'Profe Leo', 'Pagó y no viene: 18 días', 'Llamar, proponer día y horario concretos',
        { pendiente_desde: diaHabilAntes(hoy, 2), ultima_anotacion: 'Dijo que vuelve después del viaje' }),
      t(R, 'Premio a la constancia', 4, 'Lucas Ortiz', 'Profe Sol', 'Lleva 2 de 3 semanas para el premio', 'Contarle cuánto le falta y reservarle 3 turnos'),
      t(R, 'Faltó la semana pasada', 5, 'Carla Benítez', 'Profe Ana', 'Venía 3 veces por semana; la pasada, 0', 'Preguntar qué pasó y reservarle el próximo turno',
        { pendiente_desde: diaHabilAntes(hoy, 1) }),
      t(R, 'Asignarle profesor', 7, 'Nadia Campos', '', 'Socio vigente sin profesor en MOVE', 'Asignarle profesor en MOVE. Sugerido: Profe Sol (da el horario en que más viene)'),
      t(R, 'Cumpleaños del socio', 0, 'Paula Ibáñez', 'Profe Sol', 'Cumple el sábado, en 3 días', 'Pensar algo con su profe: un saludo o un detalle en su próximo turno'),
      t(R, 'Encuesta de baja', 85, 'Ramiro Núñez', '', 'Su plan terminó hace 16 días y no renovó', 'Enviarle la encuesta de baja', { intro: 'Saber por qué se va e invitarlo a volver. Mensaje personal, sin presión.' }),
      t(R, 'Revisar profesor', 91, 'Clara Gómez', 'Profe Leo', 'Tiene asignado a Profe Leo, pero 7 de sus últimas 8 asistencias fueron en horarios de Profe Sol', 'Hablarlo con los dos profes y, si corresponde, pasarla a Profe Sol en MOVE', { intro: 'Quien lo evalúa y le arma el plan tiene que ser quien le hace el seguimiento. Se cierra sola si MOVE muestra otro profesor; si hay un motivo para dejarlo, anotalo.' }),
      t(R, 'Profes de hoy', 0, 'Profe Sol', '', 'Primera clase a las 08:00', 'Recordarle que fiche con el QR al ingresar'),
      t(R, 'Profes de hoy', 0, 'Profe Leo', '', 'Primera clase a las 09:00', 'Recordarle que fiche con el QR al ingresar'),
      t(R, 'Cierre del turno', 95, 'Cierre de mi turno', '', 'Cerrar la caja · Baños y bolsas · Recepción ordenada · Dejar las novedades en el inbox', 'Hacerlo antes de irte'),
      t(R, 'Apertura del turno', -1, 'Apertura de mi turno', '', 'Contar la caja y registrar · Revisar el inbox y las novedades · Recepción y baños en orden', 'Hacerlo al llegar'),
      t(R, 'Completar ficha', 88, 'Bruno Cáceres', '', 'Falta en su ficha: contacto de emergencia', 'Pedirle el dato cuando venga y cargarlo en MOVE'),
      t(R, 'Le vence el plan esta semana', 2, 'Elena Ruiz', 'Profe Leo', 'Vence el viernes', 'Mensaje personal y renovar con turnos reservados', { fecha: diaHabilDespues(hoy, 1), pendiente_desde: diaHabilDespues(hoy, 1) }),
      t(R, 'Le vence el plan esta semana', 2, 'Omar Díaz', 'Profe Sol', 'Vence el sábado', 'Mensaje personal y renovar con turnos reservados', { fecha: diaHabilDespues(hoy, 1), pendiente_desde: diaHabilDespues(hoy, 1) }),
      t(R, 'Socio antiguo: invitarlo a volver', 80, 'Mariano Luna', 'Profe Sol', 'Entrenó 9 meses con Profe Sol · hace 2 meses que no viene', 'Mandarle un audio: cómo anda, si está entrenando, qué está haciendo', { intro: 'Son los que más chances tienen de volver. Lo primero es saber cómo está: la invitación viene después.' }),
      t(R, 'Riesgo alto', 6, 'Sergio Molina', 'Profe Ana', '21 días sin venir · bajó 60%', 'Hablar en persona o llamar; cerrar con turno o fecha'),
      t(R, 'Vence en 7 días', 2, 'Inés Duarte', 'Profe Leo', 'Vence en 3 días', 'Llamar y reservarle el turno', { estado: 'hecha', hecha_en: new Date().toISOString() }),
      t(T, 'Riesgo alto', 6, 'Pablo Sosa', 'Profe Ana', '30 días sin venir', 'Llamar', { pendiente_desde: diaHabilAntes(hoy, 3) }),
      t(T, 'Socio nuevo · semana 3', 1, 'Emilia Vera', 'Profe Sol', '3.ª semana: encuesta', 'Mandar la encuesta (respondió el mensaje de semana 2)'),
      t(G, 'Vence en 7 días', 2, 'Nora Paz', 'Profe Leo', 'Vence el viernes', 'Llamar y reservarle el turno'),
      t(C, 'Vence en 7 días', 2, 'Hugo Acosta', 'Profe Leo', 'Vence el viernes', 'Llamar y reservarle el turno'),
    ];
    const garantia = [{
      id: 'G-demo', ts: new Date().toISOString(), sede: 'bolson', socio_id: 'D20', socio_nombre: 'Rosa Medina', profe: 'Profe Leo',
      motivo: 'Dice que nadie le armó la rutina en 3 semanas', registra_dni: R, estado: 'pendiente', decide_dni: '', comentario: '', decidido_en: '',
    }];
    const mes = hoy.slice(0, 7);
    const venta = (o) => JSON.stringify(Object.assign({ cajas: 12, cobros_plan: 31, cobros_plan_monto: 2150000, mostrador: 24, mostrador_monto: 386000, bar: 18, recovery: 3, indumentaria: 1, suplementos: 2, otros: 0, tienda: 3, renovaciones: 22, retencion_total: 16, retencion_logradas: 9, retencion_pct: 9 / 16, dias_sin_plan_largo: 4, promesas_total: 5, promesas_cumplidas: 4, promesas_pct: 0.8, aperturas: 12, aperturas_bien: 10, apertura_pct: 10 / 12 }, o));
    const rendimiento = [
      { mes, dni: R, datos: venta({ nuevos: 9, planes_largos: 4 }), actualizado: new Date().toISOString() },
      { mes, dni: T, datos: venta({ nuevos: 13, planes_largos: 7, mostrador_monto: 512000, retencion_logradas: 11, retencion_pct: 11 / 16, aperturas_bien: 7, apertura_pct: 7 / 12 }), actualizado: new Date().toISOString() },
      { mes, dni: C, datos: venta({ nuevos: 6, planes_largos: 2, mostrador_monto: 214000, retencion_logradas: 5, retencion_pct: 5 / 16 }), actualizado: new Date().toISOString() },
    ];
    return { usuarios, tareas, registro: [], garantia, rendimiento, actividad: [], objetivos: [], cierres: [] };
  }

  function crearFetchDemo() {
    const hojas = semilla();
    const copia = x => JSON.parse(JSON.stringify(x));
    const deps = {
      repo: {
        leer: h => copia(hojas[h] || []),
        escribir: (h, filas) => { hojas[h] = copia(filas); },
        agregar: (h, fila) => { (hojas[h] = hojas[h] || []).push(copia(fila)); },
      },
      ahora: () => Date.now(),
      hoy: hoyIso,
      sha256: hashJuguete,
      hmac: (s, k) => hashJuguete(k + '|' + s),
      aleatorio: n => { let s = ''; while (s.length < 2 * n) s += Math.random().toString(16).slice(2); return s.slice(0, 2 * n); },
      props: { CLAVE_CARGA: '', SECRETO_TOKEN: 'demo', PIMIENTA: PIMIENTA },
    };
    return async (url, opciones) => {
      await new Promise(r => setTimeout(r, 150));
      const r = raiz.manejar(JSON.parse(opciones.body), deps);
      return { json: async () => r };
    };
  }

  raiz.PulsoDemo = { crearFetchDemo, USUARIOS, PIN };
})(window);

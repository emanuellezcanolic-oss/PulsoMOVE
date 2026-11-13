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
    { dni: '11111111', nombre: 'Rocío (práctica)', sede: 'bolson', turno: 'manana', roles: 'recepcion', hora_inicio: '08:00', hora_fin: '14:00' },
    { dni: '11111112', nombre: 'Tomás (práctica)', sede: 'bolson', turno: 'tarde', roles: 'recepcion', hora_inicio: '15:00', hora_fin: '21:00' },
    { dni: '22222222', nombre: 'Responsable de sede (práctica)', sede: 'bolson', turno: 'manana', roles: 'recepcion,coordinador' },
    { dni: '44444444', nombre: 'Coordinación general (práctica)', sede: 'bolson', turno: 'manana', roles: 'recepcion,coordinador,admin' },
    { dni: '33333333', nombre: 'Admin (práctica)', sede: 'bolson', turno: 'manana', roles: 'admin' },
    { dni: '55555555', nombre: 'Profe Mañana (práctica)', sede: 'bolson', turno: 'manana', roles: 'profe' },
    { dni: '55555556', nombre: 'Profe Tarde (práctica)', sede: 'bolson', turno: 'tarde', roles: 'profe' },
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
      t(R, 'Vence en 7 días', 2, 'Marta Quiroga', 'Profe Sol', 'Vence en 5 días', 'Mensaje personal y renovar con turnos reservados. Coordinale una reevaluación con Profe Sol: la última fue hace 120 días · Proponele modificar el plan con Profe Sol para renovar energías: lleva 70 días con el mismo · Revisen su objetivo: "correr 10 km en marzo"'),
      t(R, 'Pagó y no viene', 3, 'Diego Ferreyra', 'Profe Leo', 'Pagó y no viene: 18 días', 'Llamar, proponer día y horario concretos',
        { pendiente_desde: diaHabilAntes(hoy, 2), ultima_anotacion: 'Dijo que vuelve después del viaje' }),
      t(R, 'Faltó toda la semana pasada', 5, 'Carla Benítez', 'Profe Ana', 'Venía 3 veces por semana; la pasada, 0', 'Preguntar qué pasó y reservarle el próximo turno',
        { pendiente_desde: diaHabilAntes(hoy, 1) }),
      t(R, 'Asignarle profesor', 7, 'Nadia Campos', '', 'Socio vigente sin profesor en MOVE', 'Asignarle profesor en MOVE. Sugerido: Profe Sol (da el horario en que más viene)'),
      t(R, 'Cumpleaños del socio', 0, 'Paula Ibáñez', 'Profe Sol', 'Cumple el sábado, en 3 días', 'Pensar algo con su profe: un saludo o un detalle en su próximo turno'),
      t(R, 'Encuesta de baja', 85, 'Ramiro Núñez', '', 'Su plan terminó hace 16 días y no renovó', 'Escribirle un mensaje personal para saber por qué se va. Si no responde, recién ahí se manda la encuesta', { intro: 'Saber por qué se va e invitarlo a volver. Mensaje personal, sin presión.' }),
      t(R, 'Revisar profesor', 91, 'Clara Gómez', 'Profe Leo', 'Tiene asignado a Profe Leo, pero 7 de sus últimas 8 asistencias fueron en horarios de Profe Sol', 'Hablarlo con los dos profes y, si corresponde, pasarla a Profe Sol en MOVE', { intro: 'Quien lo evalúa y le arma el plan tiene que ser quien le hace el seguimiento. Se cierra sola si MOVE muestra otro profesor; si hay un motivo para dejarlo, anotalo.' }),
      t(R, 'Coordinar reevaluación', 92, 'Lía Benítez', 'Profe Sol', 'Riesgo moderado de baja · última evaluación hace 120 días', 'Hablar con Profe Sol para coordinarle una reevaluación'),
      t(R, 'Coordinar evaluación inicial', 92, 'Tomás Rey', 'Profe Leo', 'No tiene ninguna evaluación cargada en MOVE', 'Hablar con Profe Leo para coordinarle la evaluación inicial y que se la cargue en MOVE'),
      t(R, 'Evaluación sin cargar', 3, 'Paula Soria', 'Profe Sol', 'Tenía reevaluación el 02/11 y MOVE no muestra ninguna cargada', 'Averiguar por qué no se cargó. Si se hizo, pedirle a Profe Sol que la cargue. Si faltó o no se hizo, te sugerimos reprogramarla'),
      t(R, 'Corregir calendario', 1, 'Calendario: Profe Ana', '', 'Ya no trabaja y hoy figura a las 13:00, 14:00', 'Cambiarlo en el calendario de MOVE por el profe que esté hoy'),
      t(R, 'Profes de hoy', 0, 'Profe Sol', '', 'Primera clase a las 08:00', 'Recordarle que fiche con el QR al ingresar'),
      t(R, 'Profes de hoy', 0, 'Profe Leo', '', 'Primera clase a las 09:00', 'Recordarle que fiche con el QR al ingresar'),
      t(R, 'Cierre del turno', 95, 'Cierre de mi turno', '', 'Cerrar la caja · Baños y bolsas · Recepción ordenada · Dejar las novedades en el inbox', 'Hacerlo antes de irte'),
      t(R, 'Apertura del turno', -1, 'Apertura de mi turno', '', 'Contar la caja y registrar · Revisar el inbox y las novedades · Recepción y baños en orden', 'Hacerlo al llegar'),
      t(R, 'Completar ficha', 88, 'Bruno Cáceres', '', 'Falta en su ficha: contacto de emergencia', 'Pedirle el dato cuando venga y cargarlo en MOVE'),
      t(R, 'Le vence el plan esta semana', 2, 'Elena Ruiz', 'Profe Leo', 'Vence el viernes', 'Mensaje personal y renovar con turnos reservados', { fecha: diaHabilDespues(hoy, 1), pendiente_desde: diaHabilDespues(hoy, 1) }),
      t(R, 'Le vence el plan esta semana', 2, 'Omar Díaz', 'Profe Sol', 'Vence el sábado', 'Mensaje personal y renovar con turnos reservados', { fecha: diaHabilDespues(hoy, 1), pendiente_desde: diaHabilDespues(hoy, 1) }),
      t(R, 'Entrena en otra sede', 93, 'Lucía Vera', 'Profe Sol', 'Registrado en Lago Puelo · 5 de sus últimas 6 reservas fueron en El Bolsón · Su plan vale solo en El Bolsón', 'Preguntarle si entrena acá, o si hace doble turno o es multisede. Si entrena acá, corregir en MOVE la sede y, si hace falta, el profe, y avisarle a Profe Sol', { intro: 'Viene a tu sede, pero está registrado en otra. Cuando venga, preguntale si entrena acá, si hace doble turno o si es multisede. Si entrena acá, corregí la sede en MOVE: recién cuenta cuando MOVE muestra el cambio, y lo miramos cada mañana.' }),
      t(R, 'Revisar plan con el profe', 94, 'Bruno Sosa', 'Profe Leo', 'Tiene el mismo plan desde hace 94 días (desde el 01/08)', 'Hablar con Profe Leo para ver si le cambia el plan. Si lo ve bien, escribirle al socio para ver si le gustaría una modificación', { intro: 'Primero hablalo con el profe. Si lo ve bien, escribile vos al socio, con tus palabras, para ver si le gustaría modificar el plan. Se cierra sola cuando MOVE muestra un plan nuevo.' }),
      t(R, 'Socio antiguo: invitarlo a volver', 80, 'Mariano Luna', 'Profe Sol', 'Entrenó 9 meses con Profe Sol · hace 2 meses que no viene', 'Mandarle un audio: cómo anda, si está entrenando, qué está haciendo', { intro: 'Son los que más chances tienen de volver. Lo primero es saber cómo está: la invitación viene después.' }),
      t(R, 'Socio nuevo · semana 1: confirmar rutina y turnos fijos', 3, 'Abril Sosa', 'Profe Ana', 'Alta el lunes', 'No tiene reservas activas: ayudalo a reservar esta semana y a dejar sus días fijos · Preguntale qué quiere lograr en los próximos meses, para que se proyecte', { intro: 'Se dio de alta en los últimos 7 días.' }),
      t(R, 'Vencieron y no renovaron: recuperar', 4, 'Gustavo Herrera', 'Profe Leo', 'Venció hace 8 días', 'Llamar: renovar con un turno concreto', { intro: 'Vencieron hace menos de 15 días. Llamar con un turno concreto para volver.' }),
      t(R, 'Felicitar por la constancia', 3, 'Rosa Medina', 'Profe Sol', '14 días con QR en las últimas 4 semanas', 'Felicitarlo en persona o con un mensaje personal', { intro: 'Cuatro semanas seguidas viniendo 3 veces o más, con QR. Se lo ganó.' }),
      t(R, 'Invitar a escanear el QR', 3, 'Pablo Rey', 'Profe Leo', 'Viene 3 veces por semana, pero sin QR', 'Mostrarle cómo escanear: sin QR no accede al reconocimiento de constancia'),
      t(R, 'Encuesta de baja: no respondió', 85, 'Hernán Vega', '', 'Le escribieron hace 3 días y no respondió', 'Enviarle la encuesta de baja'),
      t(R, 'Controlar stock', 1, 'Stock para los reconocimientos', '', 'Contá lo que hay en tu sede', 'Controlar y cargar lo que hay; si no coincide con MOVE, agregarlo en MOVE'),
      t(R, 'Viene menos que antes', 6, 'Julieta Mansilla', 'Profe Sol', 'Bajó 58% · ahora 1,2 por semana', 'Preguntar qué cambió y reservarle el próximo turno', { intro: 'Su asistencia cayó a la mitad o más. Hablarle en la próxima visita o mandarle un mensaje: preguntar qué cambió.' }),
      t(R, 'De vacaciones: volver a preguntar', 7, 'Facundo Rojas', 'Profe Ana', 'Avisó vacaciones', 'Pedir fecha de vuelta y reservar', { intro: 'Pedir una fecha de vuelta y reservarle ese día.' }),
      t(R, 'Para hablar cuando vengan', 9, 'Sofía Herrera', 'Profe Leo', 'Cuando venga, en la puerta', 'Nunca reservó en la app: enseñarle a reservar y escanear', { intro: 'Marcala cuando lo veas en la puerta, en cualquier día de la semana.' }),
      t(R, 'Seguimiento de consulta', 8, 'Agustina Peralta', '', 'Consultó hace 3 días por entrenamiento personalizado', 'Preguntarle si pudo decidir y ofrecerle una clase de prueba'),
      t(R, 'Riesgo alto: prevenir antes de que venza', 6, 'Sergio Molina', 'Profe Ana', '21 días sin venir · bajó 60%', 'Hablar en persona o llamar; cerrar con turno o fecha'),
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
    const rango = (d, n) => Array.from({ length: n }, (_, i) => d + i).join(',');
    const ventas = [];
    const CATALOGO = ['Bebidas|Agua', 'Bebidas|Gatorade', 'Bebidas|Café', 'Barritas y snacks|Barritas', 'Barritas y snacks|Alfajor proteico', 'Recovery|Botas', 'Suplementos|Creatina', 'Suplementos|Proteína', 'Indumentaria|Remera', 'Indumentaria|Gorra'];
    for (let i = 1; i <= 34; i++) {
      const d = new Date(hoy + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - i);
      if (d.getUTCDay() === 0) continue;
      const fecha = d.toISOString().slice(0, 10);
      [[R, 'Rocío (práctica)', 1], [T, 'Tomás (práctica)', 2]].forEach(([dni, nombre, k]) => {
        const productos = {};
        CATALOGO.forEach((p, j) => { const n = (i * k + j * 3) % (j < 4 ? 4 : 7) === 0 ? 1 + (i + j) % 2 : 0; if (n) productos[p] = n; });
        const cuantos = Object.values(productos).reduce((a, b) => a + b, 0) + 0;
        const renovaciones = (i + k) % 3 === 0 ? 2 : 1, nuevos = (i + k) % 5 === 0 ? 1 : 0;
        productos['Planes|Mensual'] = renovaciones; if (nuevos) productos['Planes|3 meses'] = nuevos;
        const planes = renovaciones + nuevos, planes_monto = planes * 99000, mostrador_monto = cuantos * 6500;
        ventas.push({ fecha, sede: 'bolson', dni, nombre, planes, planes_monto, nuevos, renovaciones, largos: nuevos, mostrador: cuantos, mostrador_monto, efectivo: planes_monto, transferencia: mostrador_monto, mercadopago: 0, otros_medios: 0, productos: JSON.stringify(productos), sin_clasificar: 0 });
      });
    }
    const ayerDemo = (() => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
    const larga = o => Object.assign({ fecha: ayerDemo, sede: 'bolson', socio_id: '', plan: 'plan de 3 meses', tipo: 'renovacion', sugerido_dni: '', estado: 'cobro', pide_dni: '', responde_dni: '', hacia_dni: '', dni_vendio: '', ts_pedido: '', ts_decidido: '', decide_dni: '' }, o);
    const ventas_largas = [
      larga({ id: 'VL1', dni_cobro: T, nombre_cobro: 'Tomás (práctica)', socio_nombre: 'Carla Benítez', estado: 'pedida', pide_dni: T, responde_dni: R, hacia_dni: R }),
      larga({ id: 'VL2', dni_cobro: R, nombre_cobro: 'Rocío (práctica)', socio_nombre: 'Martín Suárez', sugerido_dni: T }),
      larga({ id: 'VL3', dni_cobro: T, nombre_cobro: 'Tomás (práctica)', socio_nombre: 'Julia Ponce', sugerido_dni: R }),
      larga({ id: 'VL4', dni_cobro: T, nombre_cobro: 'Tomás (práctica)', socio_nombre: 'Andrés Rey', estado: 'disputa', pide_dni: R, responde_dni: T, hacia_dni: R }),
      larga({ id: 'VL5', dni_cobro: T, nombre_cobro: 'Tomás (práctica)', socio_nombre: 'Lucas Prieto', plan: 'ingreso', tipo: 'nuevo', largo: 'no', sugerido_dni: R }),
    ];
    // Una clase recién empezada y otra de hace media hora, según la hora en que se abra la práctica
    const reservasDemo = dia => {
      const ahora = new Date(), hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
      const m = Math.max(40, ahora.getHours() * 60 + ahora.getMinutes());
      const fila = (id, socio, profe, ini) => ({ id, fecha: dia, sede: 'bolson', socio_id: id, socio, clase: 'Entrenamiento Libre', profe, hora: hhmm(ini), fin: hhmm(ini + 60), estado: 'falta', desde_ts: ahora.toISOString(), cerrada_ts: '', recordado_ts: '', recordado_dni: '', resuelta_ts: '', resuelta_dni: '', resultado: '', detalle: '' });
      return [fila('RS1', 'Clara Benítez', 'Profe Sol', m - 30), fila('RS2', 'Pablo Rey', 'Profe Sol', m - 11)];
    };
    const fichajeDemo = (id, persona, dni, hora) => ({ id, fecha: hoy, sede: 'bolson', persona_id: id, persona, dni, momento: 'entrada', hora, estado: 'falta', desde_ts: new Date().toISOString(), cerrada_ts: '', recordado_ts: '', recordado_dni: '', no_viene_ts: '', no_viene_dni: '' });
    // Mapa de calor de práctica, con la forma de los datos reales de Bolsón: valle al mediodía y pico a media mañana
    const ocupacionDemo = () => {
      const perfil = { '07:00': .25, '08:00': .35, '09:00': .40, '10:00': .68, '11:00': .90, '12:00': .15, '13:00': .28,
                       '14:00': .45, '15:00': .55, '16:00': .62, '17:00': .50, '18:00': .78, '19:00': .95, '20:00': .72, '21:00': .38 };
      const sedes = { bolson: 1, puelo: .8, bariloche: 1.1 };
      const filas = [];
      Object.keys(sedes).forEach(sede => {
        for (let d = 0; d < 5; d++) {
          Object.keys(perfil).forEach(hora => {
            const cupo = 20;
            const oc = Math.min(1.1, perfil[hora] * sedes[sede] * (d === 4 ? .8 : d === 0 ? 1.05 : 1));
            const reservas = Math.round(cupo * oc);
            filas.push({ sede, tipo: 'patron', clave: String(d), dia: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'][d], hora,
              dias: '12', clases: '2', cupo: String(cupo), reservas: String(reservas),
              asistieron: String(Math.round(reservas * .85)), ausentes: String(reservas - Math.round(reservas * .85)),
              ocupacion: String((reservas / cupo).toFixed(4)), sin_cupo: '0', actualizado: new Date().toISOString() });
          });
        }
        [['2026-06', 1620], ['2026-07', 1480], ['2026-08', 1710], ['2026-09', 1890], ['2026-10', 2040], ['2026-11', 640]].forEach(([mes, n]) => {
          const r = Math.round(n * sedes[sede]);
          filas.push({ sede, tipo: 'mes', clave: mes, dia: '', hora: '', dias: '0', clases: '0', cupo: '0', reservas: String(r),
            asistieron: String(Math.round(r * .85)), ausentes: String(r - Math.round(r * .85)), ocupacion: '', sin_cupo: '0', actualizado: new Date().toISOString() });
        });
      });
      return filas;
    };
    // Los próximos 8 días de práctica: nombres inventados, para ver cómo queda la lista de anotados
    const proximasDemo = () => {
      const nombres = ['Marta Quiroga', 'Juan Paz', 'Lucía Fernández', 'Rosa Medina', 'Diego Ayala', 'Carla Benítez',
                       'Andrés Rey', 'Sofía Barros', 'Nicolás Vera', 'Paula Giménez', 'Martín Soto', 'Elena Cruz'];
      const horas = ['07:00', '09:00', '11:00', '14:00', '18:00', '19:00'];
      const clases = { '07:00': 'Entrenamiento Personalizado', '09:00': 'Entrenamiento Personalizado', '11:00': 'Readaptación Física',
                       '14:00': 'Strong Women', '18:00': 'Entrenamiento Personalizado', '19:00': 'Entrenamiento Libre' };
      const ts = new Date().toISOString();
      const filas = [];
      Object.keys({ bolson: 1, puelo: 1, bariloche: 1 }).forEach(sede => {
        for (let i = 0; i < 8; i++) {
          const f = new Date(hoy + 'T12:00:00Z');
          f.setUTCDate(f.getUTCDate() + i);
          const fecha = f.toISOString().slice(0, 10);
          horas.forEach((hora, j) => {
            const cupo = hora === '11:00' ? 6 : hora === '14:00' ? 8 : 15;
            // Lo de hoy está casi lleno y lo de la semana que viene recién arranca: así se reserva de verdad
            const cuantos = Math.max(0, Math.round(cupo * (i === 0 ? .9 : i === 1 ? .5 : .2) * (j % 2 ? 1 : .7)));
            const gente = nombres.slice((i + j) % 5, (i + j) % 5 + cuantos);
            filas.push({ sede, tipo: 'franja', fecha, hora, clase: clases[hora], profe: j % 2 ? 'Belén Juárez' : 'Profe Leo',
              horario_id: `${sede}-${fecha}-${hora}`, cupo: String(cupo), reservas: String(gente.length), nombres: gente.join(' | '), actualizado: ts });
          });
        }
        [['Rosa Medina', '19:00', 9], ['Nicolás Vera', '09:00', 7], ['Elena Cruz', '18:00', 5]].forEach(([n, h, v]) => {
          filas.push({ sede, tipo: 'sin_reserva', fecha: '', hora: h, clase: '', profe: '', horario_id: '',
            cupo: '0', reservas: String(v), nombres: n, actualizado: ts });
        });
      });
      return filas;
    };
    // PulsoMOVE Profes: la agenda que armaría pulso_profes.py, con socios inventados
    const pp = (n, profe, dni, fecha, tipo, vence, extra) => Object.assign({ id: 'pp-D' + n, fecha, sede: 'bolson', profe, profe_dni: dni, socio_id: 'P' + n,
      socio_nombre: ['Lucía Ferro', 'Martín Ibarra', 'Carla Sosa', 'Pedro Gómez', 'Ana Ríos', 'Jorge Paz', 'Nora Díaz', 'Iván Molina', 'Sara Luna', 'Raúl Vera', 'Elsa Cano', 'Tito Rey'][n % 12],
      tipo, accion: { 'Plan nuevo': 'Socio nuevo: armarle el plan hoy', 'Plan vencido': 'El plan ya venció: renovarlo', 'Renovar plan': 'Le vence el plan: renovarlo antes del vencimiento' }[tipo],
      vence, alta: '', estado: 'pendiente', hecha_en: '', hecha_dni: '', nota: '', cargada: hoy, cerrada_en: '' }, extra || {});
    const B = '55555555', Z = '55555556';
    const profe_tareas = [
      pp(1, 'Profe Mañana (práctica)', B, hoy, 'Plan nuevo', '', { alta: hoy }),
      pp(2, 'Profe Mañana (práctica)', B, diaHabilAntes(hoy, 1), 'Plan vencido', diaHabilAntes(hoy, 6)),
      pp(3, 'Profe Mañana (práctica)', B, hoy, 'Plan vencido', diaHabilAntes(hoy, 3)),
      pp(4, 'Profe Mañana (práctica)', B, hoy, 'Renovar plan', diaHabilDespues(hoy, 2)),
      pp(5, 'Profe Mañana (práctica)', B, diaHabilDespues(hoy, 1), 'Renovar plan', diaHabilDespues(hoy, 3)),
      pp(6, 'Profe Mañana (práctica)', B, diaHabilDespues(hoy, 1), 'Renovar plan', diaHabilDespues(hoy, 4)),
      pp(7, 'Profe Mañana (práctica)', B, diaHabilDespues(hoy, 2), 'Renovar plan', diaHabilDespues(hoy, 5)),
      pp(8, 'Profe Mañana (práctica)', B, diaHabilDespues(hoy, 3), 'Renovar plan', diaHabilDespues(hoy, 6)),
      pp(9, 'Profe Tarde (práctica)', Z, hoy, 'Plan vencido', diaHabilAntes(hoy, 2)),
      pp(10, 'Profe Tarde (práctica)', Z, hoy, 'Renovar plan', diaHabilDespues(hoy, 1), { estado: 'hecha', hecha_en: new Date().toISOString(), hecha_dni: Z }),
      pp(11, 'Profe Tarde (práctica)', Z, diaHabilDespues(hoy, 2), 'Renovar plan', diaHabilDespues(hoy, 4)),
    ];
    // Reevaluaciones: socios del profe de práctica, de la evaluación más vieja a la más reciente, con sus horarios de siempre
    const PM = 'Profe Mañana (práctica)';
    const atras = n => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
    const profe_reeval = [['Marta Quiroga', 210, '1-08:00:6|3-08:00:5'], ['Juan Paz', 150, '2-10:00:4'], ['Lucía Fernández', 120, ''], ['Rosa Medina', 95, '0-15:00:3|4-15:00:3'],
      ['Diego Ayala', 70, '3-10:00:2'], ['Carla Benítez', 40, '1-08:00:7'], ['Andrés Rey', 20, '2-15:00:5']].map(([n, dias, h], k) => ({
      id: 're-R' + k, sede: 'bolson', profe: PM, profe_dni: B, socio_id: 'R' + k, socio_nombre: n, ultima_eval: atras(dias), dias: String(dias), habitos: h, cargada: hoy }));
    const proximasProfe = [];
    for (let i = 1; i < 8; i++) {
      const f = new Date(hoy + 'T12:00:00Z'); f.setUTCDate(f.getUTCDate() + i);
      const fecha = f.toISOString().slice(0, 10);
      [['08:00', 12, 9], ['10:00', 12, 3], ['15:00', 12, 6]].forEach(([hora, cupo, res]) => proximasProfe.push({ sede: 'bolson', tipo: 'franja', fecha, hora,
        clase: 'Entrenamiento Personalizado', profe: PM, horario_id: `pm-${fecha}-${hora}`, cupo: String(cupo), reservas: String((res + i) % cupo), nombres: '', actualizado: new Date().toISOString() }));
    }
    // Revisión de planes renovados: lo que armaría pulso_planes_revision.py
    const J = x => JSON.stringify(x);
    const profe_revision = [
      { id: 'rev-D1', fecha: atras(1), sede: 'bolson', profe: PM, profe_dni: B, socio_id: 'V1', socio_nombre: 'Iván Molina', pct: '0.96', banda: 'casi_todo',
        saltos: J([{ bloque: 'Bloque N°2', antes: 'Bisagra de cadera con disco', esc_antes: 0, despues: 'Peso muerto búlgaro con barra', esc_despues: 3, escalones: 3 },
          { bloque: 'Bloque N°3', antes: 'Remo con banda', esc_antes: 0, despues: 'Remo con barra en bisagra', esc_despues: 2, escalones: 2 }]),
        rpe: J([{ bloque: 'Movilidad', ejercicio: 'Movilidad de cadera en cuadrupedia', rpe: 8, regla: 'En movilidad el RPE tendría que ser menor a 7' }]), respuesta: '', respondida_en: '', nota: '' },
      { id: 'rev-D2', fecha: atras(2), sede: 'bolson', profe: PM, profe_dni: B, socio_id: 'V2', socio_nombre: 'Sara Luna', pct: '0.55', banda: 'bien', saltos: '[]', rpe: '[]', respuesta: '', respondida_en: '', nota: '' },
      { id: 'rev-D3', fecha: atras(3), sede: 'bolson', profe: PM, profe_dni: B, socio_id: 'V3', socio_nombre: 'Raúl Vera', pct: '0.12', banda: 'sin_modificar', saltos: '[]', rpe: '[]', respuesta: '', respondida_en: '', nota: '' },
    ];
    // Auditoría de planes: lo que subiría pulso_auditoria.py
    const au = (n, socio, seccion, gravedad, texto, extra) => Object.assign({ id: 'au-D' + n + '-' + seccion, fecha: atras(3), ultima: hoy, sede: 'bolson', profe: PM, profe_dni: B,
      socio_id: 'A' + n, socio_nombre: socio, seccion, gravedad, texto, cuantos: String(texto.split(' | ').length), estado: 'pendiente', marcada_en: '', corregido_en: '', reaparecio: '' }, extra || {});
    const profe_auditoria = [
      au(1, 'Lucía Ferro', 'gestion', 'r', 'El plan no fue modificado, solo se le cambió la fecha (plan creado el 01/09/2026)'),
      au(2, 'Martín Ibarra', 'custom', 'a', 'Día A: falta el bloque de movilidad | Sentadilla copa se repite el Día A y Día B'),
      au(3, 'Carla Sosa', 'rpe', 'a', 'Chequear el RPE en la movilidad: Día B · Movilidad de cadera con RPE 8', { estado: 'no_corregido', marcada_en: atras(1) + 'T12:00:00.000Z' }),
      au(4, 'Pedro Gómez', 'metodologia', 'a', 'Día A · Bloque N°2: Salto al cajón: los pliométricos van en el Bloque N°1', { reaparecio: '1' }),
      au(5, 'Ana Ríos', 'general', 'a', 'Borrar rutinas viejas (3): siguen asignadas días de planes anteriores'),
      au(6, 'Jorge Paz', 'diagnostico', 'a', 'Cargar un objetivo concreto en la app'),
      au(7, 'Nora Díaz', 'custom', 'a', 'Copia del plan modelo (AFG 1 A.K): solo se customizó el 14% de los ejercicios', { estado: 'dejada', marcada_en: atras(2) + 'T12:00:00.000Z', motivo: 'Es lo que necesita este socio: recién empieza' }),
      au(8, 'Iván Molina', 'gestion', 'a', 'Cada día del plan tiene una fecha de vencimiento diferente'),
      au(9, 'Elsa Cano', 'diagnostico', 'a', 'Cargar la fecha de evaluación en el excel'),
    ];
    const pp_ = (dias, puntaje) => ({ fecha: atras(dias), profe: PM, profe_dni: B, socios: '80', puntaje: String(puntaje), gestion: '58', diagnostico: '41', metodologia: '96', custom: '84', rpe: '90' });
    const profe_puntajes = [pp_(14, 64), pp_(7, 68), pp_(0, 71)];
    // Tablero de coordinación: lo que subiría pulso_coordinacion.py
    const venc = (n, nombre, dias, vino, plan) => ({ socio_id: 'C' + n, nombre, vence: atras(dias), dias, vino_vencido: vino, vino_plan: plan, por_semana: Math.round(vino / Math.max(1, dias / 7) * 10) / 10 });
    const porDia = semilla => { const o = {}; for (let k = 0; k < 30; k++) { const f = atras(k); const dw = new Date(f + 'T12:00:00Z').getUTCDay(); const n = dw === 0 || dw === 6 ? 0 : (k * semilla + 3) % 6; if (n) o[f] = n; } return o; };
    const cd = (profe, dni, d) => ({ fecha: hoy, profe, profe_dni: dni, sede: 'bolson', datos: J(Object.assign({ desde: atras(29), horas_pagadas: 22, horas_semana: 32.5, horario: 'Bolsón: lun a vie 07:00 a 13:30', cupo: 4, dias_habiles: 20, dias_cupo: d.custom.en_rango_pct < 30 ? 6 : 14,
      alertas: d.custom.en_rango_pct >= 30 ? [] : ['Hace 1.9 planes por hora paga y solo el 23% está customizado (30-80%): con ese tiempo tendría que customizar más', 'Llegó a su cupo de 4 planes por día en 6 de 20 días hábiles', '2 socios entrenan hace 2 semanas o más con el plan vencido'] }, d,
      { por_dia: porDia(d.socios % 5 + 2) }, (() => { const p = porDia(d.socios % 5 + 2); const n = Object.values(p).reduce((a, b) => a + b, 0); return { planes_30: n, dias_con_planes: Object.keys(p).length, planes_por_hora_pagada: Math.round(n / 22 * 10) / 10 }; })())) });
    const profe_coord = [
      cd(PM, B, { socios: 82, vigentes: 61, vencidos: 17, sin_plan: 4, renovados: 44, al_dia_pct: 74, vienen: 4, vienen_mucho: 2, no_vienen: 6, veces_vencidos: 51,
        custom: { medidos: 40, mediana_pct: 92, bandas: { sin_modificar: 1, poco: 2, bien: 9, casi_todo: 28 }, en_rango_pct: 23, con_saltos: 31, rpe_fuera: 6 },
        tiempo: { medidos: 38, mediana_min: 14, horas_medidas: 9.6, horas_estimadas: 10.3 },
        lista: [venc(1, 'Elsa Cano', 21, 12, 30), venc(2, 'Tito Rey', 15, 8, 20), venc(3, 'Nora Díaz', 30, 5, 9), venc(4, 'Jorge Paz', 9, 4, 16), venc(5, 'Ana Ríos', 40, 1, 3), venc(6, 'Pedro Gómez', 60, 0, 0)] }),
      cd('Profe Tarde (práctica)', Z, { socios: 64, vigentes: 55, vencidos: 7, sin_plan: 2, renovados: 38, al_dia_pct: 86, vienen: 1, vienen_mucho: 0, no_vienen: 4, veces_vencidos: 9,
        custom: { medidos: 30, mediana_pct: 64, bandas: { sin_modificar: 0, poco: 3, bien: 21, casi_todo: 6 }, en_rango_pct: 70, con_saltos: 8, rpe_fuera: 2 },
        tiempo: { medidos: 28, mediana_min: 22, horas_medidas: 10.1, horas_estimadas: 13.9 },
        lista: [venc(7, 'Iván Molina', 12, 5, 14), venc(8, 'Sara Luna', 33, 2, 8), venc(9, 'Raúl Vera', 18, 0, 6)] }),
    ];
    // Horarios y sábados de práctica: el sábado de esta semana le toca al profe de la mañana
    const profe_horarios = [{ profe: 'Profe Mañana (práctica)', sede: 'bolson', dias: '0-4', desde: '07:00', hasta: '13:30' }, { profe: 'Profe Tarde (práctica)', sede: 'bolson', dias: '0-4', desde: '13:30', hasta: '20:00' }];
    const sab = n => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7) + 7 * n); return d.toISOString().slice(0, 10); };
    const profe_sabados = [-2, -1, 0, 1, 2, 3].map(n => ({ fecha: sab(n), sede: 'bolson', profe: n % 2 ? 'Profe Tarde (práctica)' : 'Profe Mañana (práctica)', profe_dni: n % 2 ? Z : B, nota: '', por_dni: 'planilla', en: '' }));
    const profe_feriados = [{ fecha: sab(2), nombre: 'Feriado de práctica', se_trabaja: '', borrado: '', por_dni: '', en: '' }];
    // Liquidación de práctica: cifras inventadas, para ver cómo se ve la pestaña
    const liquidacionDemo = () => {
      const mesAtras = n => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 7); };
      const filas = [];
      [[R, 6500, [0, 14, 9, 22, 18]], [T, 6000, [0, 8, 11, 12, 20]]].forEach(([dni, vh, nuevos]) => {
        for (let i = 4; i >= 0; i--) {
          const datos = { valor_hora: vh + (4 - i) * 250, horas: 120, nuevos: nuevos[4 - i] || 0, extras: i === 2 ? [{ c: 'Aguinaldo', m: 380000 }] : (i === 0 ? [{ c: 'Extra objetivo', m: 12000 }] : []) };
          if (i === 4) delete datos.nuevos;
          filas.push({ dni, mes: mesAtras(i), datos: JSON.stringify(datos), actualizado: '' });
        }
      });
      const qr = [];
      [R, T].forEach(dni => { for (let k = 1; k <= 12; k++) { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - k); const f = d.toISOString().slice(0, 10); const dw = d.getUTCDay(); if (dw === 0 || dw === 6) continue; qr.push({ dni, fecha: f, entrada: dni === R ? '07:58' : '14:57', salida: k % 3 ? (dni === R ? '14:05' : '21:04') : '', n: '2', actualizado: new Date().toISOString() }); } });
      return { liquidacion: filas, liq_qr: qr };
    };
    const liqDemo = liquidacionDemo();
    // Comisión de práctica: números inventados (los reales viven en la planilla privada)
    const mesPrev = (() => { const d = new Date(hoy.slice(0, 7) + '-01T12:00:00Z'); d.setUTCDate(0); return d.toISOString().slice(0, 7); })();
    const liqD = (r, n, l, nivel, parcial) => JSON.stringify({ renovaciones: r, renov_socios: r - 2, nuevos: n, liberados: l, online: 0, activos_mes: r + n + l, horas_semana: 30, metas: [40, 41, 50, 60], nivel, nivel_txt: ['No alcanzado', 'Objetivo 1', 'Objetivo 2', 'Máximo'][nivel], valores: [500, 600, 700, 800], valor_socio: [500, 600, 700, 800][nivel], comision: [500, 600, 700, 800][nivel] * r, comision_planilla: null, faltan_siguiente: nivel < 3 ? [40, 41, 50, 60][nivel + 1] - (r + n + l) : 0, parcial, datos_hasta: hoy });
    const profe_liq = [
      { mes: mesPrev, profe: 'Profe Mañana (práctica)', profe_dni: B, sede: 'bolson', datos: liqD(58, 4, 2, 3, false), cargada: hoy },
      { mes: mesPrev, profe: 'Profe Tarde (práctica)', profe_dni: Z, sede: 'bolson', datos: liqD(44, 3, 1, 2, false), cargada: hoy },
      { mes: hoy.slice(0, 7), profe: 'Profe Mañana (práctica)', profe_dni: B, sede: 'bolson', datos: liqD(21, 1, 1, 0, true), cargada: hoy },
      { mes: hoy.slice(0, 7), profe: 'Profe Tarde (práctica)', profe_dni: Z, sede: 'bolson', datos: liqD(17, 2, 0, 0, true), cargada: hoy },
    ];
    return { liquidacion: liqDemo.liquidacion, liq_qr: liqDemo.liq_qr, profe_liq, profe_horarios, profe_sabados, profe_feriados, profe_tareas, profe_reeval, profe_revision, profe_auditoria, profe_puntajes, profe_coord, proximas: proximasDemo().concat(proximasProfe), fichajes: [fichajeDemo('FI1', 'Profe Sol', '', '08:00'), fichajeDemo('FI2', 'Rocío (práctica)', R, '08:00')], fichajes_control: [{ ts: new Date().toISOString() }], reservas_qr: reservasDemo(hoy), ventas, ventas_largas, stock: [{ ts: new Date().toISOString(), fecha: hoy, sede: 'bolson', dni: R, nombre: 'Rocío (práctica)', producto: 'Proteína ENA 930 g', cantidad: '5' }], beneficios: [{ id: 'B-demo', ts: new Date().toISOString(), tipo: 'referido', sede: 'bolson', socio_nombre: 'Marta Quiroga', nuevo_socio: 'Juan Paz', detalle: '', registra_dni: R, estado: 'pendiente', decide_dni: '', comentario: '', decidido_en: '' }, { id: 'B-demo2', ts: new Date().toISOString(), tipo: 'constancia', sede: 'puelo', socio_nombre: 'Rosa Medina', nuevo_socio: '', detalle: '14 días con QR en 4 semanas', registra_dni: '', estado: 'pendiente', decide_dni: '', comentario: '', decidido_en: '' }], uso: [{ ts: hoy + 'T12:00:00.000Z', dni: R, fecha: hoy, activos: rango(480, 50) + ',' + rango(600, 70), quieta: rango(530, 30), otra: rango(560, 25) }], ocupacion: ocupacionDemo(), usuarios, tareas, registro: [], garantia, rendimiento, actividad: [], objetivos: [], cierres: [
      { fecha: hoy, ts: hoy + 'T17:30:00.000Z', dni: T, nombre: 'Tomás (práctica)', sede: 'bolson', animo: '5', respuestas: '{}', comentario: '', hechas: '18', pendientes: '0', mensajes: '9', consultas: '2', sala: '4', profes: '', equipo: '', socios: '', pregunta: '😊 ¿Algún socio te alegró el día? Contanos.', lo_mejor: 'Un socio me contó que volvió a correr sin dolor.' },
      { fecha: hoy, ts: hoy + 'T13:30:00.000Z', dni: C, nombre: 'Responsable de sede (práctica)', sede: 'bolson', animo: '3', respuestas: '{}', comentario: 'A la tarde se llenó la sala de golpe.', hechas: '12', pendientes: '4', mensajes: '6', consultas: '1', sala: '2', profes: '', equipo: '', socios: '', pregunta: '', lo_mejor: '' },
    ] };
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

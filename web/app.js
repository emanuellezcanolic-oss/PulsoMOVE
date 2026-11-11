// PulsoMOVE · pantallas. Usa PulsoApi (web/api.js) y las reglas de Logica.js (CANALES, RESULTADOS, validarMarca...).
(function () {
  const DEMO = !!window.PulsoDemo;

  function memoria() {
    const m = {};
    return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
  }
  function almacenSeguro() {
    try { localStorage.setItem('pulso_prueba', '1'); localStorage.removeItem('pulso_prueba'); return localStorage; } catch (e) { return memoria(); }
  }

  const cliente = PulsoApi.crearCliente({
    url: window.PULSO_URL,
    fetch: DEMO ? PulsoDemo.crearFetchDemo() : window.fetch.bind(window),
    almacen: DEMO ? memoria() : almacenSeguro(),
  });

  const SEDES = { bariloche: 'Bariloche', bolson: 'El Bolsón', puelo: 'Lago Puelo' };
  const TURNOS = { manana: 'Mañana', tarde: 'Tarde' };
  const NOMBRE_CANAL = { AU: 'Audio', MP: 'Mensaje personal', MG: 'Mensaje general o plantilla', LL: 'Llamada', PR: 'En persona', 'SIN CONTACTO': 'Sin contacto' };
  const FRASE_GARANTIA = 'Si un profe no te saluda, no te arma tu rutina o no te hace seguimiento, te regalamos el mes siguiente, para darnos la oportunidad de mejorar.';
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const NOMBRE_RESULTADO = { NOTIFICADO: 'NOTIFICADO (ya se le avisó)' };
  const GUIA_ANTIGUO = ['Saludalo por su nombre y decile quién sos.', 'Contale que hace rato no lo ven y que te acordaste de él.', 'Preguntale cómo anda, si está entrenando, qué está haciendo.', 'Escuchá por qué dejó: si fue horario, precio o salud, ahí está la conversación.', 'Invitalo sin presión: una visita o un turno concreto. Decide él.'];
  const AVISO_AUDIO = 'Para este contacto, mejor un audio: obliga a abrirlo, y escuchar tu tono de voz cambia cómo llega el mensaje. Hablale con tus palabras: un texto armado se nota.';
  // A personas mayores se les sugiere llamar. Es una recomendación razonable y no un resultado probado: la evidencia sobre canales con adultos mayores está dividida.
  const AVISO_LLAMADA = 'Recomendación para personas mayores: que escuchen tu voz, en una llamada o en un audio. El audio lo pueden escuchar varias veces y con calma. Si llamás, probá entre las 10 y las 13, ni temprano ni de noche, y preguntale cómo prefiere que lo contacten. Hablale con tus palabras.';
  const avisoDeCanal = t => (String(t.tipo).indexOf('Socio antiguo') === 0 && String(t.accion).indexOf('Llamarlo') === 0
    ? `<div class="consejo-audio">📞 ${esc(AVISO_LLAMADA)}</div>` : recomiendaAudio(t.tipo) ? `<div class="consejo-audio">🎙️ ${esc(AVISO_AUDIO)}</div>` : '');
  function formularioDe(tipo) {
    const t = String(tipo);
    if (t.indexOf('Cumpleaños') === 0) return { resultado: 'SALUDADO', conCanal: true, detalle: 'Qué se hizo', boton: 'Listo, saludado' };
    if (t.indexOf('Encuesta de baja: no respondió') === 0) return { conCanal: true, etiqueta: 'Qué pasó', opciones: [['ENCUESTA ENVIADA', 'No respondió: le mandé la encuesta'], ['RESPONDIÓ', 'Al final respondió: no hace falta la encuesta']], detalle: 'Qué dijo', boton: 'Guardar' };
    if (t.indexOf('Encuesta de baja') === 0) return { conCanal: true, etiqueta: 'Qué pasó', opciones: [['NOTIFICADO', 'Le escribí: espero respuesta'], ['RESPONDIÓ', 'Respondió: ya sé por qué se va'], ['VUELVE', 'Va a volver']], consejo: 'Primero escribile vos, con tus palabras, para saber por qué se va. Si en 3 días no responde, te vuelve la tarea para mandarle la encuesta. Si responde, no se manda.', detalle: 'Qué dijo', boton: 'Guardar' };
    if (t.indexOf('Felicitar por la constancia: contarle') === 0) return { resultado: 'NOTIFICADO', conCanal: true, detalle: 'Qué te dijo', boton: 'Listo, se lo conté',
      consejo: 'Contale por qué lo hacemos: queremos premiar la constancia, justo cuando empieza la época en que más cuesta sostenerla. Cuentan las últimas 4 semanas, no el mes del calendario. Todavía no hay premio definido: no le prometas nada.' };
    if (t.indexOf('Felicitar por la constancia') === 0) return { conCanal: true, etiqueta: 'Qué eligió', opciones: [['ELIGIÓ PRODUCTO', 'Un producto'], ['ELIGIÓ RECOVERY', 'El pack recovery'], ['LO PIENSA', 'Lo va a pensar']], consejo: 'Decíselo por su nombre: se lo ganó con su constancia, no es un regalo. Lo que elija les llega a Lucía y Emanuel.', detalle: 'Qué producto eligió o qué dijo', boton: 'Guardar' };
    if (t.indexOf('Invitar a escanear') === 0) return { resultado: 'NOTIFICADO', conCanal: true, consejo: 'Ya viene con mucha constancia, pero sin QR no accede al reconocimiento. Mostrale cómo escanear en la próxima visita.', detalle: 'Qué dijo', boton: 'Listo, invitado' };
    if (t.indexOf('Controlar stock') === 0) return { resultado: 'HECHO', conCanal: false, stock: true, consejo: 'Contá lo que hay de verdad. Si un número no coincide con MOVE, o el producto no está cargado, agregalo en MOVE.', detalle: 'Otros productos que haya, o algo para avisar', boton: 'Guardar conteo' };
    if (t.indexOf('Encargo') === 0) return { resultado: 'HECHO', conCanal: false, detalle: 'Si hay algo para contar', boton: 'Listo' };
    if (t.indexOf('Apertura del turno') === 0) return { resultado: 'HECHO', conCanal: false, checklist: true, detalle: 'Si algo quedó sin hacer, contá por qué', boton: 'Listo' };
    if (t.indexOf('Seguimiento de consulta') === 0) return { resultado: 'SEGUIDO', conCanal: true, detalle: 'Qué respondió', boton: 'Seguimiento hecho' };
    if (t.indexOf('Coordinar') === 0) return { resultado: 'AGENDADA', conCanal: false, conFecha: true, consejo: 'Marcala recién cuando la evaluación ya esté agendada, con la fecha del turno. Después de esa fecha miramos en MOVE que se haya cargado.', detalle: 'Con quién y a qué hora', boton: 'Quedó agendada' };
    if (t.indexOf('Evaluación sin cargar') === 0) return { conCanal: false, etiqueta: 'Qué pasó', opciones: [['REPROGRAMADA', 'Faltó o no se hizo: la reprogramé'], ['SE HIZO', 'Se hizo: falta que el profe la cargue'], ['NO SE HACE', 'No se va a hacer']], detalle: 'Contá qué pasó', boton: 'Guardar' };
    if (t.indexOf('Entrena en otra sede') === 0) return { conCanal: false, etiqueta: '¿Sigue entrenando en la sede donde está registrado?', opciones: [['CORREGIDO', 'No, entrena acá: corregí la sede en MOVE'], ['MULTISEDE', 'Sí, hace doble turno o es multisede: queda como está'], ['DE PASO', 'Sí, acá vino de paso: queda como está']], consejo: 'Preguntale cuando venga. Si no entrena allá, primero corregí la sede en MOVE: recién cuenta cuando MOVE muestra el cambio, y lo miramos cada mañana. Si todavía no pudiste preguntarle, dejala pendiente.', detalle: 'Qué te dijo', boton: 'Guardar' };
    if (t.indexOf('Revisar plan') === 0) return { conCanal: false, etiqueta: 'Qué dijo el profe', opciones: [['LO CAMBIA EL PROFE', 'Se lo va a cambiar'], ['NOTIFICADO', 'Lo ve bien: ya le escribí al socio para ver si le gustaría un cambio'], ['NO HACE FALTA', 'No hace falta cambiarlo por ahora']], consejo: 'Primero hablalo con el profe. Si lo ve bien, escribile vos al socio, con tus palabras, para ver si le gustaría una modificación.', detalle: 'Qué te dijo', boton: 'Guardar' };
    // Lo pide un profe: no es su entrenado (Emanuel, 10/11/2026)
    if (t.indexOf('Cambiar profesor') === 0) return { conCanal: false, etiqueta: 'Qué hiciste', opciones: [['CORREGIDO', 'Listo: le cambié el profesor en MOVE'], ['SIN CAMBIO', 'Lo dejé como está']], consejo: 'Si el profe no sabe de quién es, fijate en qué horario viene y qué profe está a esa hora, o preguntale al socio cuando venga. Cuando MOVE muestra el profesor nuevo, la renovación del plan le pasa sola a ese profe.', detalle: 'A quién se lo pasaste, o por qué lo dejaste como está', boton: 'Guardar' };
    if (t.indexOf('Revisar profesor') === 0) return { resultado: 'SIN CAMBIO', conCanal: false, detalle: 'Por qué se deja como está', obligatorio: true, boton: 'Dejarlo como está' };
    return null;
  }

  const PULSO_ICONO = '<svg class="pulso" viewBox="0 0 44 18" aria-hidden="true"><path d="M1 10 H13 l3 -7 l4 13 l3 -9 l2 3 H43" fill="none" stroke="#798254" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PULSO_LARGO = 'M2 22 H110 l8 -14 l9 28 l8 -20 l6 6 H290 l8 -14 l9 28 l8 -20 l6 6 H470 l8 -14 l9 28 l8 -20 l6 6 H598';

  const E = {
    vista: null, hoy: '', tareas: null, filtro: 'pendientes', tipo: '', abierta: null, errorForm: '',
    sede: null, ocupacion: null, diaProx: '', sedeElegida: 'bolson', usuarios: null, mensajeLogin: '', personaDni: null, persona: null, rend: null, rendMes: null, rendDni: null, dia: null, adelantar: false, abiertaEn: null, cierres: null, cierrePospuesto: 0, paraAdelantar: 0, celebrado: {},
  };

  const app = document.getElementById('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Solo los formularios de Google se vuelven link: es lo único que la app le pide mandar
  const conLinks = s => esc(s).replace(/https:\/\/docs\.google\.com\/forms\/[A-Za-z0-9_\-\/]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  const historialSocio = t => (t.historial && t.historial.length ? `<details class="historial-socio"><summary>Lo que ya sabemos (${t.historial.length})</summary>${t.historial.map(h => `<span class="nota"><b>${esc(ddmmDe(h.ts))} · ${esc(h.tipo)}${h.resultado ? ' · ' + esc(NOMBRE_RESULTADO[h.resultado] || h.resultado) : ''}</b>${h.detalle ? ': “' + esc(h.detalle) + '”' : ''}</span>`).join('')}</details>` : '');
  const ddmmDe = ts => { const d = new Date(ts); return isNaN(d) ? '' : String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };
  const ddmm = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');
  const tituloDia = iso => { const d = new Date(iso + 'T12:00:00'); return DIAS[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1); };
  const roles = () => ((cliente.sesion() || {}).roles || []);
  const tiene = r => roles().indexOf(r) >= 0;

  const horaLocal = iso => new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(11, 16);
  const duracion = s => (s < 60 ? s + ' seg' : Math.round(s / 60) + ' min');

  // Avisos del sistema (push del navegador): salen aunque la PC esté en otra pestaña, con PulsoMOVE abierta
  function push(titulo, cuerpo) {
    try {
      if (window.Notification && Notification.permission === 'granted') new Notification(titulo, { body: cuerpo, icon: 'web/logo.png', tag: titulo });
    } catch (e) { /* sin notificaciones */ }
  }
  const avisosPendientes = () => window.Notification && Notification.permission === 'default';

  // Papelitos de verdad: caen con vaivén y giro, cada uno con su desvío y su ritmo. No son emojis (Emanuel, 09/11/2026).
  const COLORES_PAPEL = ['#f2b705', '#f2542d', '#0e9594', '#798254', '#f58a07', '#b8392e'];
  function trozosHtml(cuantos) {
    const al = (a, b) => a + Math.random() * (b - a);
    return Array.from({ length: cuantos }, (_, i) => {
      const izq = al(-4, 104), desvio = Math.round(al(-130, 130)), ancho = Math.round(al(6, 12));
      return `<i style="left:${izq.toFixed(1)}%;--x:${desvio}px;width:${ancho}px;height:${Math.round(ancho * al(1.1, 1.9))}px;background:${COLORES_PAPEL[i % COLORES_PAPEL.length]};border-radius:${i % 4 === 0 ? '50%' : '2px'};animation-delay:${al(0, 1.1).toFixed(2)}s;animation-duration:${al(2.4, 4.6).toFixed(2)}s"></i>`;
    }).join('');
  }

  // Solo los papelitos, sin cartel: sirve detrás de un diálogo que ya dice lo suyo
  function papelitos(cuantos) {
    document.querySelectorAll('.papelitos').forEach(x => x.remove());
    const c = document.createElement('div');
    c.className = 'celebracion papelitos';
    c.innerHTML = trozosHtml(cuantos || 90);
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 6500);
  }

  function celebrar(titulo, texto, grande) {
    push(titulo, texto);
    document.querySelectorAll('.celebracion').forEach(x => x.remove());
    const c = document.createElement('div');
    c.className = 'celebracion' + (grande ? ' grande' : '');
    const trozos = grande ? trozosHtml(90) : '';
    c.innerHTML = `${trozos}<div class="celebracion-caja"><b>${esc(titulo)}</b><span>${esc(texto)}</span>${grande && E.paraAdelantar ? '<button class="boton" data-celebra="adelantar">Adelantar tareas de mañana</button>' : ''}<button class="boton claro" data-celebra="cerrar">Seguir</button></div>`;
    document.body.appendChild(c);
    c.addEventListener('click', ev => {
      const b = ev.target.closest('[data-celebra]');
      if (!b) return;
      c.remove();
      if (b.dataset.celebra === 'adelantar') { E.adelantar = true; E.filtro = 'pendientes'; cargarVista(); }
    });
    if (!grande) setTimeout(() => c.remove(), 3500);
  }

  let temporizadorAviso;
  function aviso(texto, mal) {
    const a = document.getElementById('aviso');
    a.textContent = texto;
    a.className = 'visible' + (mal ? ' mal' : '');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { a.className = ''; }, mal ? 6000 : 2600);
  }

  function falla(e) {
    if (e && e.codigo === 'sin_sesion') { E.mensajeLogin = PulsoApi.mensaje('sin_sesion'); render(); return; }
    aviso(e && e.message ? e.message : PulsoApi.mensaje('interno'), true);
  }

  // ---------- Login y PIN ----------

  function vistaLogin() {
    const practica = DEMO ? `<div class="practica"><b>Modo práctica.</b> Probá con DNI <b>11111111</b> (recepción), <b>22222222</b> (responsable de sede), <b>55555555</b> (profe) o <b>33333333</b> (admin). PIN <b>${PulsoDemo.PIN}</b>.</div>` : '';
    return `<main class="login"><div class="caja">
      <img src="web/logo.png" alt="The Move Club">
      <svg class="gran-pulso" viewBox="0 0 380 56" aria-hidden="true"><path d="M2 32 H150 l10 -24 l12 44 l10 -32 l8 12 H378"/></svg>
      <h1>Pulso<span>MOVE</span></h1>
      <p class="bajada">Tus tareas de recepción del día.</p>
      <form data-form="login" autocomplete="off">
        <label class="campo">DNI<input name="dni" inputmode="numeric" autocomplete="username" required placeholder="Sin puntos"></label>
        <label class="campo pin">PIN<input name="pin" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" autocomplete="current-password" required></label>
        ${E.mensajeLogin ? `<div class="${E.mensajeLogin.startsWith("✅") ? "aviso-ok" : "error-form"}">${esc(E.mensajeLogin)}</div>` : ''}
        <button class="boton ancho">Entrar</button>
      </form>${practica}${DEMO ? '' : '<p class="bajada" style="margin:16px 0 0"><a href="?demo=1">Probar el modo práctica</a>, con datos inventados.</p>'}
    </div></main>`;
  }

  function vistaCambiarPin() {
    const s = cliente.sesion();
    return `<main class="login"><div class="caja">
      <img src="web/logo.png" alt="The Move Club">
      <h1>Tu <span>PIN</span></h1>
      <p class="bajada">Hola, ${esc(s.nombre)}. Elegí un PIN de 4 números que solo sepas vos. No pueden ser todos iguales ni seguidos (como 1234).</p>
      <form data-form="pin" autocomplete="off">
        <label class="campo pin">PIN nuevo<input name="a" type="password" inputmode="numeric" maxlength="4" required></label>
        <label class="campo pin">Repetilo<input name="b" type="password" inputmode="numeric" maxlength="4" required></label>
        ${E.mensajeLogin ? `<div class="${E.mensajeLogin.startsWith("✅") ? "aviso-ok" : "error-form"}">${esc(E.mensajeLogin)}</div>` : ''}
        <button class="boton ancho verde">Guardar PIN</button>
      </form>
    </div></main>`;
  }

  // ---------- Estructura ----------

  function pestanasDisponibles() {
    const p = [];
    if (tiene('profe')) p.push(['planes', 'Mis planes'], ['pmes', tiene('recepcion') ? 'Mis planes: el mes' : 'Mi mes']);   // PulsoMOVE Profes: profes y kinesiólogos
    if (tiene('recepcion')) p.push(['hoy', 'Mis tareas'], ['mes', 'Mi mes']);
    // La ve recepción: es la que contesta "¿a qué hora hay menos gente?" (Emanuel, 09/11/2026)
    if (tiene('recepcion') || tiene('coordinador') || tiene('admin')) p.push(['reservas', 'Reservas']);
    if (tiene('coordinador') || tiene('admin')) p.push(['sede', 'Sede']);
    if (tiene('coordinador') || tiene('admin')) p.push(['rend', 'Rendimiento']);
    if (tiene('coordinador') || tiene('admin')) p.push(['profes', 'Profes']);
    if (tiene('admin')) p.push(['admin', 'Equipo']);
    p.push(['chat', chatEtiqueta()]);   // mensajes entre el equipo: todos
    return p;
  }

  function encabezado() {
    const s = cliente.sesion();
    const p = pestanasDisponibles();
    return `<header class="barra">
      <div class="fila">
        <div class="marca">${PULSO_ICONO}<span class="nombre-app">PulsoMOVE</span><img src="web/logo.png" alt="The Move Club"></div>
        <div class="quien"><b>${esc(s.nombre)}</b>${esc(SEDES[s.sede] || '')}${s.turno ? ' · ' + esc(TURNOS[s.turno] || '') : ''}</div>
        <button class="boton-salir" data-accion="salir">Salir</button>
      </div>
      ${p.length > 1 ? `<nav class="pestanas" role="tablist">${p.map(([k, t]) => `<button role="tab" data-accion="vista" data-v="${k}" aria-selected="${E.vista === k}">${t}</button>`).join('')}</nav>` : ''}
    </header>`;
  }

  // ---------- Reservas: el mapa de calor ----------
  // Para contestar "¿a qué hora hay menos gente?" con un dato y no de memoria (Emanuel, 09/11/2026).
  const DIAS_SEM = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const VERDE_OC = .60, AMARILLO_OC = .85;

  function colorOcup(o) {
    if (o == null || o === '') return 'gris';
    return Number(o) < VERDE_OC ? 'verde' : Number(o) < AMARILLO_OC ? 'amarillo' : 'rojo';
  }

  function vistaReservas() {
    const O = E.ocupacion;
    const selector = (tiene('admin') || tiene('coordinador')) && O && O.sedes.length > 1
      ? `<div class="filtros">${O.sedes.map(k => `<button class="chip" data-accion="sede-elegir" data-s="${k}" aria-pressed="${(E.sedeElegida || O.sede) === k}">${SEDES[k]}</button>`).join('')}</div>` : '';
    if (!O) return selector + '<div class="cargando">Cargando las reservas…</div>';
    if (!O.patron.length) {
      // Sin el promedio de los meses igual sirve lo que viene: son datos distintos y cada uno se baja aparte
      return selector + `<div class="vacio"><p>Todavía no se calculó el mapa de calor de ${esc(SEDES[O.sede] || O.sede)}.</p>
        <p>Se arma a la mañana con lo que hay en MOVE. Si recién lo activamos, mañana ya vas a verlo.</p></div>
        ${bloqueProximos(O)}${bloqueSinReserva(O)}`;
    }
    const horas = [...new Set(O.patron.map(f => f.hora))].sort();
    const dias = [...new Set(O.patron.map(f => Number(f.clave)))].sort((a, b) => a - b);
    const celda = {};
    O.patron.forEach(f => { celda[f.clave + '|' + f.hora] = f; });
    const pct = f => (f && f.ocupacion !== '' && f.ocupacion != null) ? Math.round(Number(f.ocupacion) * 100) + '%' : '—';

    const filas = horas.map(h => `<tr><th scope="row">${esc(h)}</th>${dias.map(d => {
      const f = celda[d + '|' + h];
      if (!f) return '<td class="oc gris" title="Sin clases a esa hora"></td>';
      const titulo = `${DIAS_SEM[d]} ${h}: ${f.reservas} de ${f.cupo} lugares · medido en ${f.dias} ${f.dias === 1 ? 'día' : 'días'}`;
      return `<td class="oc ${colorOcup(f.ocupacion)}" title="${esc(titulo)}" tabindex="0" data-accion="franja" data-d="${d}" data-h="${esc(h)}"><b>${pct(f)}</b><span>${f.reservas}/${f.cupo}</span></td>`;
    }).join('')}</tr>`).join('');

    const rec = O.recomendadas || [];
    const recomendadas = rec.length
      ? `<div class="recomendadas"><b>Hoy hay más lugar a estas horas</b><div class="chips-hora">${rec.map(f =>
          `<span class="hora-libre"><b>${esc(f.hora)}</b> ${Math.round(Number(f.ocupacion) * 100)}% lleno · entran ${Math.max(0, Math.round(Number(f.cupo) - Number(f.reservas)))} más</span>`).join('')}</div>
        <span class="aclara">Si un socio te pregunta en qué horario hay menos gente, estas son. Es el promedio de los ${esc(DIAS_SEM[O.dia].toLowerCase())} de los últimos meses, no la reserva de hoy.</span></div>`
      : '<div class="recomendadas"><b>Todavía no puedo recomendarte un horario</b><span class="aclara">Hace falta más de un día medido en cada franja. Con unas semanas de datos aparece solo.</span></div>';

    const meses = (O.meses || []).slice(-8);
    const tope = Math.max(1, ...meses.map(m => Number(m.reservas)));
    const tendencia = meses.length > 1 ? `<section class="bloque"><div class="bloque-cab"><h2>Cómo viene mes a mes</h2></div>
      <div class="barras-mes">${meses.map(m => `<div class="barra-mes"><span class="valor">${m.reservas}</span>
        <i style="height:${Math.round(100 * Number(m.reservas) / tope)}%"></i><span class="mes">${esc(String(m.clave).slice(5))}</span></div>`).join('')}</div>
      <span class="aclara">Reservas por mes en ${esc(SEDES[O.sede] || O.sede)}. El último mes puede estar incompleto.</span></section>` : '';

    return selector + `<h1 class="titulo-dia">RESERVAS · ${esc((SEDES[O.sede] || O.sede).toUpperCase())}</h1>
      <p class="bajada">Qué tan llena está cada franja horaria. Sale de las reservas de los últimos meses y del cupo de cada clase en MOVE.</p>
      ${recomendadas}
      ${bloqueProximos(O)}
      ${bloqueSinReserva(O)}
      <section class="bloque"><div class="bloque-cab"><h2>Mapa de calor</h2></div>
        <div class="envoltura-tabla"><table class="calor"><thead><tr><th>Hora</th>${dias.map(d => `<th>${esc(DIAS_SEM[d].slice(0, 3))}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div>
        <div class="leyenda"><span class="oc verde"></span> Hay lugar <span class="oc amarillo"></span> Se está llenando <span class="oc rojo"></span> Lleno <span class="oc gris"></span> Sin clases</div>
        <span class="aclara">Cada casillero dice qué parte del cupo se ocupa en promedio. Tocá uno para ver el detalle.${O.actualizado ? ' Actualizado: ' + esc(String(O.actualizado).slice(0, 10)) : ''}</span>
      </section>
      ${tendencia}`;
  }

  function detalleFranja(d, h) {
    const f = (E.ocupacion.patron || []).find(x => String(x.clave) === String(d) && x.hora === h);
    if (!f) return;
    const libres = Math.max(0, Math.round(Number(f.cupo) - Number(f.reservas)));
    const col = colorOcup(f.ocupacion);
    dialogo(`<h3>${esc(DIAS_SEM[d])} a las ${esc(h)}</h3>
      <p><b>${f.reservas} de ${f.cupo} lugares</b> en promedio · ${col === 'rojo' ? 'está lleno' : col === 'amarillo' ? 'se está llenando' : 'hay lugar'}.</p>
      <p>${libres ? (libres === 1 ? 'Entra 1 persona más.' : `Entran ${libres} personas más.`) : 'No entra nadie más.'} De los que reservan, ${f.asistieron} ${Number(f.asistieron) === 1 ? 'viene' : 'vienen'} y ${f.ausentes} ${Number(f.ausentes) === 1 ? 'falta' : 'faltan'}.</p>
      <p class="aclara">Promedio de ${f.dias} ${f.dias === 1 ? 'día medido' : 'días medidos'} · ${f.clases} ${Number(f.clases) === 1 ? 'clase' : 'clases'} a esa hora${Number(f.sin_cupo) ? ` · ${f.sin_cupo} sin cupo cargado en MOVE` : ''}.</p>
      <button class="boton claro ancho" data-cerrar>Cerrar</button>`, dg => { dg.querySelector('[data-cerrar]').onclick = () => dg.close(); });
  }

  // Los días que vienen, clase por clase, y al tocar una los nombres de quienes reservaron.
  // El mapa de calor es el promedio de los últimos meses; esto es lo que hay anotado de verdad (Emanuel, 10/11/2026).
  function diaCorto(iso, hoy) {
    if (iso === hoy) return 'Hoy';
    const d = new Date(iso + 'T12:00:00Z'), h = new Date(hoy + 'T12:00:00Z');
    if (Math.round((d - h) / 86400000) === 1) return 'Mañana';
    return DIAS_SEM[(d.getUTCDay() + 6) % 7].slice(0, 3) + ' ' + iso.slice(8, 10);
  }

  // En el chip el día va corto por el lugar; en el texto de abajo, con el nombre entero
  function diaLargo(iso, hoy) {
    const c = diaCorto(iso, hoy);
    const d = new Date(iso + 'T12:00:00Z');
    return (c === 'Hoy' || c === 'Mañana' ? c : DIAS_SEM[(d.getUTCDay() + 6) % 7]) + ' ' + iso.slice(8, 10) + '/' + iso.slice(5, 7);
  }

  // El sello viene en UTC: se muestra en la hora de acá, que es la que la persona mira en su reloj
  function cuandoCorto(ts, hoy) {
    const d = new Date(ts);
    if (isNaN(d)) return ts.slice(0, 10);
    const dos = n => String(n).padStart(2, '0');
    const fecha = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
    return (fecha === hoy ? 'hoy' : dos(d.getDate()) + '/' + dos(d.getMonth() + 1)) + ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes());
  }

  function colorClase(f) {
    return Number(f.cupo) > 0 ? colorOcup(Number(f.reservas) / Number(f.cupo)) : 'gris';
  }

  function bloqueProximos(O) {
    const P = O.proximas || [];
    if (!P.length) {
      return `<section class="bloque"><div class="bloque-cab"><h2>Próximos días</h2></div>
        <span class="aclara">Todavía no se bajaron las reservas de los días que vienen. Se arman a la mañana y se refrescan durante el día.</span></section>`;
    }
    const fechas = [...new Set(P.map(f => f.fecha))].sort();
    const sel = fechas.indexOf(E.diaProx) >= 0 ? E.diaProx : fechas[0];
    const chips = fechas.map(f => {
      const d = P.filter(x => x.fecha === f);
      const anotados = d.reduce((s, x) => s + Number(x.reservas), 0);
      return `<button class="chip" data-accion="prox-dia" data-f="${f}" aria-pressed="${f === sel}">${esc(diaCorto(f, O.hoy))}<small> ${anotados}</small></button>`;
    }).join('');
    const delDia = P.filter(f => f.fecha === sel);
    const total = delDia.reduce((s, x) => s + Number(x.reservas), 0);
    const cupo = delDia.reduce((s, x) => s + Number(x.cupo), 0);
    const clases = delDia.map(f => `<li class="clase-prox ${colorClase(f)}" tabindex="0" data-accion="prox-clase" data-id="${esc(f.horario_id)}">
        <b class="hora">${esc(f.hora)}</b>
        <span class="que"><b>${esc(f.clase || 'Clase')}</b>${f.profe ? `<small>${esc(f.profe)}</small>` : ''}</span>
        <span class="cuenta">${f.reservas}${Number(f.cupo) ? '/' + f.cupo : ''}</span></li>`).join('');
    return `<section class="bloque"><div class="bloque-cab"><h2>Próximos días</h2></div>
      <div class="filtros dias-prox">${chips}</div>
      <p class="aclara">${esc(diaLargo(sel, O.hoy))}: <b>${total}</b> ${total === 1 ? 'reserva' : 'reservas'}${cupo ? ` de ${cupo} lugares` : ''}. Tocá una clase para ver quiénes reservaron.</p>
      <ul class="clases-prox">${clases || '<li class="aclara">Ese día no hay clases cargadas.</li>'}</ul>
      ${O.proximas_actualizado ? `<span class="aclara">Actualizado: ${esc(cuandoCorto(String(O.proximas_actualizado), O.hoy))}. Se refresca varias veces por día.</span>` : ''}</section>`;
  }

  function bloqueSinReserva(O) {
    const S = O.sin_reserva || [];
    if (!S.length) return '';
    return `<section class="bloque"><div class="bloque-cab"><h2>Vienen seguido y no reservaron</h2></div>
      <ul class="sin-reserva">${S.map(f => `<li><b>${esc(f.nombres)}</b><span>${f.reservas} ${Number(f.reservas) === 1 ? 'vez' : 'veces'} en el último mes · suele venir ${esc(f.hora)}</span></li>`).join('')}</ul>
      <span class="aclara">No tienen ninguna reserva en los días que vienen. Es para que lo tengas a mano cuando los veas o los llames: la app no le escribe a nadie.</span></section>`;
  }

  function detalleClase(id) {
    const f = (E.ocupacion.proximas || []).find(x => String(x.horario_id) === String(id));
    if (!f) return;
    const gente = String(f.nombres || '').split(' | ').filter(Boolean);
    const libres = Number(f.cupo) ? Math.max(0, Number(f.cupo) - Number(f.reservas)) : 0;
    dialogo(`<h3>${esc(diaCorto(f.fecha, E.ocupacion.hoy))} a las ${esc(f.hora)}</h3>
      <p><b>${esc(f.clase || 'Clase')}</b>${f.profe ? ' · ' + esc(f.profe) : ''}</p>
      <p>${f.reservas} ${Number(f.reservas) === 1 ? 'reserva' : 'reservas'}${Number(f.cupo) ? ` de ${f.cupo} lugares · ` + (libres ? (libres === 1 ? 'entra 1 más' : `entran ${libres} más`) : 'está completa') : ''}.</p>
      ${gente.length ? `<ol class="lista-socios">${gente.map(n => `<li>${esc(n)}</li>`).join('')}</ol>`
        : '<p class="aclara">Todavía no reservó nadie.</p>'}
      <p class="aclara">Los que están anotados en MOVE para esa clase. Puede cambiar hasta que empiece.</p>
      <button class="boton claro ancho" data-cerrar>Cerrar</button>`, dg => { dg.querySelector('[data-cerrar]').onclick = () => dg.close(); });
  }

  // ---------- Mis tareas ----------

  // La meta del día manda el avance: el total de tareas pendientes es mucho más de lo que entra en un turno
  function avance(hechas, total) {
    const meta = (E.dia && E.dia.hoy && E.dia.hoy.meta) || 0;
    const sobre = meta || total;
    const pct = sobre ? Math.min(100, Math.round(100 * hechas / sobre)) : 0;
    const enCola = cliente.pendientesDeEnvio();
    return `<section class="avance" aria-label="Avance del día">
      <div class="numeros"><b>${hechas}/${sobre}</b><span>${meta ? (hechas >= meta ? '¡meta de hoy cumplida! · seguí sumando' : 'tu meta de hoy · ' + pct + '%') : 'hechas hoy · ' + pct + '%'}</span>
        ${enCola ? `<span class="cola">${enCola} sin enviar todavía</span>` : ''}</div>
      <svg viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true">
        <path class="base" d="${PULSO_LARGO}" pathLength="100"/>
        <path class="lleno" d="${PULSO_LARGO}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 - pct}"/>
      </svg></section>`;
  }

  function etiquetaEstado(t) {
    if (t.estado === 'pendiente' && E.hoy && String(t.fecha) > E.hoy) return `<span class="estado adelanto">⏩ Del ${ddmm(t.fecha)}</span>`;
    if (t.estado === 'hecha' && (t.resultado_local || (t.marca && t.marca.resultado)) === 'CORREGIDO') return '<span class="estado adelanto">⏳ Falta que MOVE muestre el cambio</span>';
    if (t.estado === 'hecha') return `<span class="estado hecha">✓ ${esc(t.resultado_local || (t.marca && t.marca.resultado) || (seVerificaEnMove(t.tipo) ? 'Verificada en MOVE' : 'Hecha'))}</span>`;
    if (t.dias_pendiente >= 2) return `<span class="estado atrasada">Desde el ${ddmm(t.pendiente_desde)}</span>`;
    if (t.dias_pendiente === 1) return '<span class="estado ayer">De ayer</span>';
    return '';
  }

  const itemsDe = t => String(t.situacion).split(' · ').map(x => x.trim()).filter(Boolean);
  const checklistHtml = items => `<div class="checklist">${items.map(i => `<label><input type="checkbox" data-check="${esc(i)}"><span>${esc(i)}</span></label>`).join('')}</div>`;
  const CIERRE_BASE = ['Cerrar la caja', 'Baños y bolsas', 'Recepción ordenada', 'Dejar las novedades en el inbox'];

  // Tareas que no son un contacto de retención: formulario corto con el resultado ya puesto
  function formularioSimple(t, f) {
    const canal = f.conCanal ? `<label class="campo">Canal<select name="canal" required><option value="">Elegí…</option>${['AU', 'MP', 'LL', 'PR'].map(v => `<option value="${v}">${esc(NOMBRE_CANAL[v])}</option>`).join('')}</select></label>` : '<input type="hidden" name="canal" value="PR">';
    return `<form class="marca-form" data-form="marcar" data-id="${esc(t.id)}">
      ${f.opciones ? '' : `<input type="hidden" name="resultado" value="${esc(f.resultado)}">`}
      ${avisoDeCanal(t)}
      ${f.consejo ? `<div class="consejo-audio">${esc(f.consejo)}</div>` : ''}
      ${f.checklist ? checklistHtml(itemsDe(t)) : ''}
      ${f.stock ? `<p class="aclara">Si no hay, poné 0.</p><div class="conteo-stock">${productosStockDe(t.sede).map(p => `<label class="campo">${esc(p)}<input type="number" min="0" max="99999" step="1" inputmode="numeric" required data-stock="${esc(p)}"></label>`).join('')}</div>` : ''}
      <div class="campos">${canal}
        ${f.opciones ? `<label class="campo">${esc(f.etiqueta)}<select name="resultado" required data-accion="resultado"><option value="">Elegí…</option>${f.opciones.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select></label>` : ''}
        ${f.conFecha || f.opciones ? `<label class="campo" data-campo="fecha" ${f.conFecha ? '' : 'hidden'}><span data-ayuda="fecha">${esc(PREGUNTA_FECHA[f.resultado] || 'Fecha')}</span><input name="fecha" type="date" min="${esc(E.hoy)}" ${f.conFecha ? 'required' : ''}></label>` : ''}
        <label class="campo">${esc(f.detalle)} <span class="opcional" data-ayuda="detalle">${f.obligatorio ? '(obligatorio)' : '(opcional)'}</span><textarea name="detalle" maxlength="500" ${f.obligatorio ? 'required' : ''}></textarea></label>
      </div>
      ${E.errorForm ? `<div class="error-form">${esc(E.errorForm)}</div>` : ''}
      <div class="botones"><button class="boton verde">${esc(f.boton)}</button><button type="button" class="boton claro" data-accion="cerrar">Cancelar</button></div>
    </form>`;
  }

  function formularioMarca(t) {
    const simple = formularioDe(t.tipo);
    if (simple) return formularioSimple(t, simple);
    const opt = (lista, nombres) => lista.map(v => `<option value="${esc(v)}">${esc(nombres ? nombres[v] || v : v)}</option>`).join('');
    return `<form class="marca-form" data-form="marcar" data-id="${esc(t.id)}">
      ${avisoDeCanal(t)}
      ${String(t.tipo).indexOf('Socio antiguo') === 0 ? `<div class="guia-audio"><b>Ideas para tu audio, con tus palabras</b><ol>${GUIA_ANTIGUO.map(g => `<li>${esc(g)}</li>`).join('')}</ol></div>` : ''}
      <div class="campos">
        <label class="campo">Canal<select name="canal" required><option value="">Elegí…</option>${opt(CANALES, NOMBRE_CANAL)}</select></label>
        <label class="campo">Resultado<select name="resultado" required data-accion="resultado"><option value="">Elegí…</option>${resultadosDe(t.tipo).map(g => `<optgroup label="${esc(g[0])}">${g[1].map(o => `<option value="${esc(o[0])}">${esc(o[0] === o[1] ? (NOMBRE_RESULTADO[o[0]] || o[1]) : o[1])}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label class="campo" data-campo="fecha" hidden><span data-ayuda="fecha">Fecha</span><input name="fecha" type="date"></label>
        <label class="campo">Detalle <span class="opcional" data-ayuda="detalle">(opcional)</span><textarea name="detalle" maxlength="500" placeholder="Día y horario del turno, qué dijo…"></textarea></label>
      </div>
      ${E.errorForm ? `<div class="error-form">${esc(E.errorForm)}</div>` : ''}
      <div class="botones"><button class="boton verde">Guardar</button><button type="button" class="boton claro" data-accion="cerrar">Cancelar</button></div>
    </form>`;
  }

  // Se cierra sola cuando MOVE muestra el dato: no se marca a mano
  function tarjetaVerificada(t, i) {
    return `<article class="tarjeta${t.estado === 'hecha' ? ' hecha' : ''}" style="--i:${i}"><div class="cabeza">
        <span class="socio">${esc(t.socio_nombre)}</span>${etiquetaEstado(t)}
        <span class="situacion">${esc(t.situacion)}</span>
        <span class="accion">${conLinks(t.accion)}</span>
        ${t.estado === 'hecha' ? '' : '<span class="nota">No se marca acá: cuando esté cargado en MOVE, se cierra sola a la mañana siguiente.</span>'}
      </div></article>`;
  }

  function tarjetaLectura(t, i) {
    const m = t.marca;
    return `<article class="tarjeta${t.estado === 'hecha' ? ' hecha' : ''}" style="--i:${i}"><div class="cabeza">
        <span class="socio">${esc(t.socio_nombre)}</span>${etiquetaEstado(t)}
        <span class="profe">Profe: ${esc(t.profe || '—')}</span>
        <span class="situacion">${esc(t.situacion)}</span>
        <span class="accion">${conLinks(t.accion)}</span>
        ${t.ultima_anotacion ? `<span class="nota">Última anotación: “${esc(t.ultima_anotacion)}”</span>` : ''}${historialSocio(t)}
        ${m ? `<span class="nota"><b>Marcó${m.ts ? ' a las ' + horaLocal(m.ts) : ''}${m.segundos ? ' · ' + duracion(Number(m.segundos)) : ''}${m.adelantada ? ' · adelantada' : ''}:</b> ${esc(NOMBRE_CANAL[m.canal] || m.canal)} · ${esc(m.resultado)}${m.fecha ? ' ' + ddmm(m.fecha) : ''}${m.detalle ? ' · ' + esc(m.detalle) : ''}</span>` : ''}
      </div></article>`;
  }

  function tarjeta(t, i) {
    if (seVerificaEnMove(t.tipo)) return tarjetaVerificada(t, i);
    if (String(t.tipo).indexOf('Cierre del turno') === 0 && t.estado !== 'hecha') {
      return `<article class="tarjeta" style="--i:${i}"><button class="cabeza" data-accion="probar-cierre-real">
        <span class="socio">Checklist de cierre</span><span class="situacion">${esc(t.situacion)}</span><span class="accion">Tocá para completarlo antes de irte</span></button></article>`;
    }
    const abierta = E.abierta === t.id;
    return `<article class="tarjeta${t.estado === 'hecha' ? ' hecha' : ''}" style="--i:${i}">
      <button class="cabeza" data-accion="abrir" data-id="${esc(t.id)}" aria-expanded="${abierta}">
        <span class="socio">${esc(t.socio_nombre)}</span>${etiquetaEstado(t)}
        ${t.profe ? `<span class="profe">Profe: ${esc(t.profe)}</span>` : ''}
        ${String(t.tipo).indexOf('Entrena en otra sede') === 0 ? `<span class="cartel-sede">🏠 ${esc(t.situacion)}</span>` : `<span class="situacion">${esc(t.situacion)}</span>`}
        <span class="accion">${conLinks(t.accion)}</span>
        ${t.ultima_anotacion ? `<span class="nota">Última anotación: “${esc(t.ultima_anotacion)}”</span>` : ''}${historialSocio(t)}
      </button>
      ${abierta ? formularioMarca(t) : ''}
    </article>`;
  }

  // El avance cuenta lo que se puede marcar: lo que se verifica en MOVE se cierra solo a la mañana siguiente
  function deHoy(t) {
    return !esRecordatorio(t.tipo) && (t.estado === 'hecha' || String(t.fecha) <= E.hoy) && !(seVerificaEnMove(t.tipo) && t.estado !== 'hecha');
  }

  function panelDia(hechas, total, profes) {
    const D = E.dia;
    const semilla = Number(E.hoy.replace(/-/g, '')) + (cliente.sesion().nombre || '').length;
    const frase = fraseDelDia(hechas, total, semilla);
    return `<section class="saludo"><b>${esc(D ? D.saludo : 'Hola')}</b><p>${esc(frase)}</p></section>
      ${avance(hechas, total)}
      ${D ? bloqueVentasLargas(D) : ''}
      <section class="logros">
        <div class="logro oro"><strong>${D ? D.puntos : 0}</strong><span>puntos del mes</span></div>
        <div class="logro"><strong>${D && D.racha ? '🔥 ' + D.racha : '0'}</strong><span>días seguidos</span></div>
        <div class="logro"><strong>${D ? D.hoy.mensajes : 0}</strong><span>mensajes hoy</span></div>
      </section>
      <p class="aclara">Plan de 3 meses: 10 puntos, el doble que un socio nuevo. Cada tarea adelantada suma uno extra.</p>
      ${D && D.hoy.pendientes ? bloqueIdeas(D, 1) : ''}
      ${D ? bloqueMotivacion(D) : ''}
      ${D && D.coach.length ? `<section class="coach">${D.coach.map(m => `<p class="${esc(m.tono)}">${m.tono === 'logro' ? '★' : '→'} ${esc(m.texto)}</p>`).join('')}</section>` : ''}
      ${profes.length ? `<section class="profes-hoy"><b>Profes de hoy en tu turno</b><p>Recordales que fichen con el QR al ingresar.</p>${profes.map(p => `<div><span>${esc(p.socio_nombre)}</span><em>${esc(String(p.situacion).replace('Primera clase a las ', ''))}</em></div>`).join('')}</section>` : ''}
      ${E.paraAdelantar ? `<button class="boton adelantar ancho" data-accion="adelantar">${E.adelantar ? 'Ocultar las de los próximos días' : `⏩ Adelantar tareas (${E.paraAdelantar})`}</button>` : ''}
      <button class="boton ancho" data-accion="registrar">Registrar mensaje, consulta o venta</button>
      <button class="boton claro ancho" data-accion="garantia">Registrar pedido de garantía</button>
      <button class="boton claro ancho" data-accion="trajo-socio">🎁 Un socio trajo a un socio nuevo</button>
      ${avisosPendientes() ? '<button class="boton claro ancho" data-accion="activar-avisos">🔔 Activar avisos en esta PC</button>' : ''}
      ${DEMO ? '<button class="boton claro ancho" data-accion="probar-cierre">Probar la pregunta de cierre</button>' : ''}
      <div class="recordatorio">Todo contacto termina con un turno reservado o una fecha.</div>`;
  }

  // Además de las tareas: un poco de todo. Con tareas pendientes, una idea; al día, varias.
  function bloqueIdeas(D, cuantas) {
    const lista = (D.ideas || []).slice(0, cuantas);
    if (!lista.length) return '';
    return `<section class="ideas"><b>${cuantas > 1 ? 'Para seguir sumando' : 'Hoy, además'}</b>${lista.map(i => `<div class="idea"><span class="idea-txt"><strong>${i.emoji} ${esc(i.titulo)}</strong><small>${esc(i.como)} Llevás ${i.llevas} de ${i.meta} este mes${i.puntos ? ` · ${i.puntos} ${i.puntos === 1 ? 'punto' : 'puntos'}` : ''}.</small></span>${i.tipo ? `<button class="boton claro" data-accion="registrar" data-tipo="${esc(i.tipo)}">Registrar</button>` : ''}</div>`).join('')}</section>`;
  }

  // Lo propio y lo del equipo: competencia y pertenencia, sin ranking entre compañeros
  function bloqueMotivacion(D) {
    const ganadas = (D.medallas || []).filter(m => m.ganada);
    const siguiente = (D.medallas || []).filter(m => !m.ganada).sort((a, b) => b.actual / b.meta - a.actual / a.meta)[0];
    const eq = D.equipo || { hechas: 0, faltan: 0 };
    const totalEq = eq.hechas + eq.faltan;
    return `${D.volvieron ? `<section class="impacto">🙌 <b>${D.volvieron === 1 ? '1 socio volvió' : D.volvieron + ' socios volvieron'}</b> este mes después de tu contacto.</section>` : ''}
      ${totalEq ? `<section class="equipo"><b>🤝 Tu sede hoy</b><div class="barrita"><i style="width:${Math.round(100 * eq.hechas / totalEq)}%"></i></div><span>Entre todos: ${eq.hechas} ${eq.hechas === 1 ? "hecha" : "hechas"}, ${eq.faltan} por hacer</span></section>` : ''}
      <section class="medallas"><b>Tus medallas del mes</b>
        ${ganadas.length ? `<div class="medallas-lista">${ganadas.map(m => `<span title="${esc(m.como)}">${m.emoji} ${esc(m.nombre)}</span>`).join('')}</div>` : ''}
        ${siguiente ? `<p>Próxima: ${siguiente.emoji} <b>${esc(siguiente.nombre)}</b> · ${esc(siguiente.como)} (${siguiente.actual}/${siguiente.meta})</p>` : '<p>¡Las ganaste todas este mes! 🎉</p>'}
      </section>`;
  }

  function vistaHoy() {
    if (!E.tareas) return '<div class="cargando">Cargando tus tareas…</div>';
    const profes = E.tareas.filter(t => esRecordatorio(t.tipo));
    const todas = E.tareas.filter(t => !esRecordatorio(t.tipo));
    const delDia = todas.filter(deHoy);
    const hechas = delDia.filter(t => t.estado === 'hecha').length;
    const tipos = [];
    todas.forEach(t => { if (tipos.indexOf(t.tipo) < 0) tipos.push(t.tipo); });
    const visibles = todas.filter(t => (E.filtro === 'todas' || (E.filtro === 'hechas') === (t.estado === 'hecha')) && (!E.tipo || t.tipo === E.tipo));
    const porNivel = NIVELES.map(n => [n, tipos.map(tipo => [tipo, visibles.filter(t => t.tipo === tipo && nivelDeTarea(t) === n.n)]).filter(g => g[1].length)]).filter(x => x[1].length);
    const primera = E.filtro === 'pendientes' ? visibles.find(t => t.estado === 'pendiente' && deHoy(t) && !String(t.tipo).startsWith('Cierre')) : null;
    const grupoHtml = ([tipo, lista]) => `<section class="grupo"><h2>${esc(tipo)} <span class="cuenta">${lista.length}</span></h2>${lista[0].intro ? `<p class="intro-grupo">${esc(lista[0].intro)}</p>` : ''}${lista.map(t => tarjeta(t, i++)).join('')}</section>`;
    let i = 0;
    const chip = (k, txt) => `<button class="chip" data-accion="filtro" data-f="${k}" aria-pressed="${E.filtro === k}">${txt}</button>`;
    return `<div class="dos-columnas"><aside class="lado">${panelDia(hechas, delDia.length, profes)}</aside><div class="principal">
      <h1 class="titulo">${esc(tituloDia(E.hoy))} <span>·</span> hoy</h1>
      <p class="bajada">Ordenadas por prioridad. Tocá una tarea para marcarla.</p>
      <div class="filtros">${chip('pendientes', 'Pendientes')}${chip('hechas', 'Hechas')}${chip('todas', 'Todas')}
        <select data-accion="tipo" aria-label="Tipo de tarea"><option value="">Todos los tipos</option>${tipos.map(t => `<option ${E.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </div>
      ${primera ? `<button class="empeza" data-accion="abrir" data-id="${esc(primera.id)}"><b>👉 Empezá por acá</b><span>${esc(primera.socio_nombre)} · ${esc(primera.tipo)}</span></button>` : ''}
      ${porNivel.length ? porNivel.map(([n, grupos]) => `<section class="nivel nivel-${n.n}">${n.titulo ? `<h2 class="nivel-titulo">${n.emoji} ${esc(n.titulo)}<small>${esc(n.ayuda)}</small></h2>` : ''}${grupos.map(grupoHtml).join('')}</section>`).join('')
        : `<div class="vacio">${E.filtro === 'pendientes' ? '¡No te quedan tareas pendientes! Mirá qué más podés hacer hoy.' : 'No hay tareas para mostrar.'}</div>`}
      ${E.dia && !E.dia.hoy.pendientes && E.filtro === 'pendientes' ? bloqueIdeas(E.dia, 3) : ''}
    </div></div>`;
  }

  // ---------- PulsoMOVE Profes: planes a renovar (Profes.js) ----------
  // Profes y kinesiólogos trabajan igual: el socio nuevo hace el plan ese día, después los vencidos y después lo que vence (Emanuel, 10/11/2026).

  function estadoPlan(t) {
    if (t.estado === 'hecha') return '<span class="estado hecha">Hecho</span>';
    if (t.tipo === 'Plan nuevo') return '<span class="estado atrasada">Hoy</span>';
    if (t.atraso > 0) return `<span class="estado atrasada">${t.atraso} día${t.atraso > 1 ? 's' : ''} de atraso</span>`;
    return '';
  }

  function detallePlan(t) {
    if (t.tipo === 'Plan nuevo') return `Socio nuevo${t.alta ? ' desde el ' + ddmm(t.alta) : ''}`;
    if (t.vence) return (t.vence < E.planes.hoy ? 'Venció el ' : 'Vence el ') + ddmm(t.vence);
    return t.tipo;
  }

  function tarjetaPlan(t, i, puedeMarcar, puedeTraer) {
    return `<article class="tarjeta${t.estado === 'hecha' ? ' hecha' : ''}" style="--i:${i}"><div class="cabeza">
        <span class="socio">${esc(t.socio_nombre)}</span>${estadoPlan(t)}
        <span class="situacion"><b>${esc(t.tipo)}</b> · ${esc(detallePlan(t))}</span>
        <span class="accion">${esc(t.accion)}</span>
        ${t.nota ? `<span class="nota">“${esc(t.nota)}”</span>` : ''}
      </div>
      ${puedeTraer ? `<div class="fila-accion"><button class="boton claro" data-accion="plan-traer" data-id="${esc(t.id)}">Traerlo a hoy</button></div>` : ''}
      ${puedeMarcar && t.estado === 'pendiente' ? otraSituacion(t) : ''}
      ${puedeMarcar ? `<div class="fila-accion">${t.estado === 'hecha'
        ? `<button class="boton claro" data-accion="plan-marcar" data-id="${esc(t.id)}" data-hecha="0">Deshacer</button><span class="aclara">Se cierra sola cuando MOVE muestre el plan nuevo.</span>`
        : `<button class="boton verde" data-accion="plan-marcar" data-id="${esc(t.id)}" data-hecha="1">Listo, lo renové</button>`}</div>` : ''}
    </article>`;
  }

  function opcionesProfes(op) {
    return `<option value="">No sé de quién es</option>${op.profes.map(n => `<option>${esc(n)}</option>`).join('')}`;
  }

  // En las reevaluaciones: siempre la opción de avisar que no es mi entrenado
  function noEsMioSocio(x) {
    const op = (E.planes.mio && E.planes.mio.opciones) || { profes: [], recepcion: [] };
    return `<details class="otra-situacion"><summary>No es mi entrenado</summary>
      <div class="fila-accion"><span class="aclara">Es de</span>
        <select data-noes-profe="${esc(x.socio_id)}" aria-label="De qué profesional es">${opcionesProfes(op)}</select>
        <span class="aclara">· avisarle a</span>
        <select data-noes-rec="${esc(x.socio_id)}" aria-label="A quién de recepción">${op.recepcion.map(u => `<option value="${esc(u.dni)}">${esc(u.nombre)}</option>`).join('')}</select>
        <button class="boton claro" data-accion="no-es-mio" data-s="${esc(x.socio_id)}" ${op.recepcion.length ? '' : 'disabled'}>Avisar a recepción</button></div>
    </details>`;
  }

  function otraSituacion(t) {
    const op = (E.planes.mio && E.planes.mio.opciones) || { profes: [], recepcion: [] };
    return `<details class="otra-situacion"><summary>Otra situación</summary>
      <div class="fila-accion"><span class="aclara">No es mi entrenado, es de</span>
        <select data-otra-profe="${esc(t.id)}" aria-label="De qué profesional es">${opcionesProfes(op)}</select>
        <span class="aclara">· avisarle a</span>
        <select data-otra-rec="${esc(t.id)}" aria-label="A quién de recepción">${op.recepcion.map(u => `<option value="${esc(u.dni)}">${esc(u.nombre)}</option>`).join('')}</select>
        <button class="boton claro" data-accion="otra-situacion" data-que="otro_profe" data-id="${esc(t.id)}" ${op.recepcion.length ? '' : 'disabled'}>Avisar a recepción</button></div>
      <div class="fila-accion"><button class="boton claro" data-accion="otra-situacion" data-que="papel" data-id="${esc(t.id)}">Tiene el plan en papel</button></div>
    </details>`;
  }

  function cifrasPlanes(r) {
    const c = (n, txt, clase) => `<div class="${clase || ''}"><strong>${n}</strong><span>${txt}</span></div>`;
    return `<div class="cifras">${c(r.pendientes_hoy, 'para hoy', r.pendientes_hoy ? '' : 'bien')}${c(r.atrasadas, 'atrasados', r.atrasadas ? 'mal' : 'bien')}${c(r.hechas_hoy, 'hechos hoy', 'bien')}${c(r.hechas_mes, 'hechos este mes')}${c(r.proximas, 'próximos 7 días')}${c(r.en_agenda, 'en los próximos 30 días')}</div>`;
  }

  // Reevaluaciones: solo una recomendación. El profe se la pide a recepción, que la coordina con el socio (Emanuel, 10/11/2026).
  function haceCuanto(x) {
    return x.ultima_eval ? `Última evaluación: ${ddmm(x.ultima_eval)} (hace ${x.dias} días)` : 'Sin evaluación cargada';
  }

  function botonPedir(x) {
    if (x.pedida) return '<span class="estado hecha">Pedida a recepción</span>';
    if (!x.propuesta) return '<span class="aclara">Esta semana no encontramos un horario con vos.</span>';
    const equipo = ((E.planes.mio.reeval.recepcion || {})[x.sede]) || [];
    const opciones = equipo.map(u => `<option value="${esc(u.dni)}" ${u.dni === x.sugerida_dni ? 'selected' : ''}>${esc(u.nombre)}${u.dni === x.sugerida_dni ? ' (está a esa hora)' : ''}</option>`).join('');
    return `${equipo.length > 1 ? `<select data-reeval-a="${esc(x.socio_id)}" aria-label="A quién de recepción">${opciones}</select>` : ''}
      <button class="boton verde" data-accion="reeval-pedir" data-s="${esc(x.socio_id)}" data-f="${esc(x.propuesta.fecha)}" data-h="${esc(x.propuesta.hora)}">${equipo.length === 1 ? 'Pedírsela a ' + esc(equipo[0].nombre.split(' ')[0]) : 'Pedírsela a recepción'}</button>`;
  }

  function tarjetaReeval(x, i) {
    const p = x.propuesta;
    return `<article class="tarjeta${x.pedida ? ' hecha' : ''}" style="--i:${i}"><div class="cabeza">
        <span class="socio">${esc(x.socio_nombre)}</span>${x.dias != null && x.dias >= (E.planes.mio.reeval.meta_dias || 56) ? '<span class="estado atrasada">Toca reevaluar</span>' : ''}
        <span class="situacion">${esc(haceCuanto(x))}</span>
        ${p ? `<span class="accion">${esc(tituloDia(p.fecha))} a las ${esc(p.hora)}</span><span class="nota">${esc(p.motivo)}</span>` : ''}
      </div><div class="fila-accion">${botonPedir(x)}</div>${x.pedida ? '' : noEsMioSocio(x)}</article>`;
  }

  function bloqueReeval(M) {
    const R = M.reeval;
    if (!R) return '';
    let i = 0;
    const filtro = (E.reevalBusca || '').toLowerCase();
    const otros = R.socios.filter(x => !filtro || x.socio_nombre.toLowerCase().indexOf(filtro) >= 0);
    return `<section class="grupo"><h2>🩺 Reevaluaciones recomendadas <span class="cuenta">${R.recomendadas.length}</span></h2>
      <p class="intro-grupo">Es solo una recomendación: una por día, empezando por quien hace más tiempo que no se evalúa, en un horario en que ya viene, con menos gente y con vos. Si te sirve, pedísela a recepción y ellos la coordinan con el socio.</p>
      ${R.recomendadas.length ? R.recomendadas.map(x => tarjetaReeval(x, i++)).join('') : '<div class="vacio">Esta semana no hay reevaluaciones para recomendarte.</div>'}
      <details class="catalogo"${E.reevalAbierto ? ' open' : ''}><summary data-accion="reeval-abrir">Elegir otro socio (${R.socios.length} activos, de la evaluación más vieja a la más reciente)</summary>
        <input class="buscador" type="search" placeholder="Buscar por nombre" data-accion="reeval-buscar" value="${esc(E.reevalBusca || '')}" aria-label="Buscar socio">
        ${otros.slice(0, 60).map(x => tarjetaReeval(x, i++)).join('')}
        ${otros.length > 60 ? `<p class="aclara">Hay ${otros.length - 60} más: buscalos por nombre.</p>` : ''}
      </details></section>`;
  }

  // Revisión del plan renovado: recomendación, nunca bloquea (Emanuel, 10/11/2026)
  const TEXTO_BANDA = {
    sin_modificar: ['rojo', 'Así no cuenta como plan modificado: lo recomendado es cambiar entre el 30 y el 80% del plan.'],
    poco: ['amarillo', 'Está poco customizado: lo recomendado es cambiar entre el 30 y el 80% del plan.'],
    bien: ['verde', 'Bien: está entre el 30 y el 80%.'],
    casi_todo: ['amarillo', 'Cambiaste casi todo. Para eso usá una plantilla modelo y progresá desde ahí: la idea es que el plan nuevo sea una progresión del anterior.'],
  };
  const PREGUNTA_SALTO = '¿Te parece que esta progresión es correcta para su nivel? Lo recomendado es de a un escalón por plan.';

  function textoSalto(s) {
    const n = Math.abs(s.escalones);
    return `${s.bloque}: ${s.antes} (escalón ${s.esc_antes}) → ${s.despues} (escalón ${s.esc_despues}) · ${s.escalones > 0 ? 'subió' : 'bajó'} ${n} escalones`;
  }

  function tarjetaRevision(r, i, puedeResponder) {
    const [color, texto] = TEXTO_BANDA[r.banda] || ['gris', ''];
    const pct = Math.round(r.pct * 100);
    const saltos = r.saltos || [];
    const respuesta = r.respuesta === 'correcta' ? '✅ Dijiste que la progresión es correcta' : r.respuesta === 'corregir' ? '✏️ Dijiste que la vas a corregir' : '';
    return `<article class="tarjeta revision" style="--i:${i}"><div class="cabeza">
        <span class="socio">${esc(r.socio_nombre)}</span><span class="estado ${color === 'verde' ? 'hecha' : color === 'rojo' ? 'atrasada' : 'ayer'}">${pct}% cambiado</span>
        <span class="barra-custom" aria-hidden="true"><span class="zona"></span><span class="marca-pct ${color}" style="left:${Math.min(100, pct)}%"></span></span>
        <span class="situacion">Plan renovado el ${esc(ddmm(r.fecha))}${r.minutos ? ` · lo armaste en ~${r.minutos} min` : ''} · ${esc(texto)}</span>
        ${saltos.length ? `<span class="accion">Hay ${saltos.length} cambio${saltos.length > 1 ? 's' : ''} que saltea${saltos.length > 1 ? 'n' : ''} escalones</span>
          ${saltos.slice(0, 3).map(s => `<span class="nota">${esc(textoSalto(s))}</span>`).join('')}
          ${saltos.length > 3 ? `<details class="catalogo"><summary>Ver los otros ${saltos.length - 3}</summary>${saltos.slice(3).map(s => `<span class="nota">${esc(textoSalto(s))}</span>`).join('')}</details>` : ''}` : ''}
        ${(r.rpe || []).map(x => `<span class="nota">⚠️ ${esc(x.ejercicio)} con RPE ${esc(x.rpe)}: ${esc(x.regla)}</span>`).join('')}
        ${respuesta ? `<span class="nota"><b>${respuesta}</b>${r.nota ? ' · “' + esc(r.nota) + '”' : ''}</span>` : ''}
      </div>
      ${saltos.length && puedeResponder && !r.respuesta ? `<div class="fila-accion"><span class="pregunta-salto">${esc(PREGUNTA_SALTO)}</span>
        <button class="boton verde" data-accion="revision-responder" data-id="${esc(r.id)}" data-r="correcta">Sí, es correcta</button>
        <button class="boton claro" data-accion="revision-responder" data-id="${esc(r.id)}" data-r="corregir">La voy a corregir</button></div>` : ''}
    </article>`;
  }

  function bloqueRevisiones(M) {
    const R = M.revisiones;
    if (!R || !R.lista.length) return '';
    let i = 0;
    const s = R.resumen;
    return `<section class="grupo"><h2>🔎 Revisión de tus planes renovados <span class="cuenta">${R.lista.length}</span></h2>
      <p class="intro-grupo">Comparamos cada plan nuevo con el anterior del mismo socio. Es una recomendación: lo ideal es cambiar entre el 30 y el 80% y progresar de a un escalón. En las últimas dos semanas: ${s.en_rango} de ${s.revisados} en el rango${s.saltos_sin_responder ? ` · ${s.saltos_sin_responder} con saltos para revisar` : ''}.</p>
      ${R.lista.map(r => tarjetaRevision(r, i++, true)).join('')}</section>`;
  }

  // ---------- Mi mes del profe, modo concentrado y medallas (Emanuel, 10/11/2026) ----------
  const CONSEJOS_PROFE = [
    'Silenciá el celular un rato: con el modo concentrado terminás tus planes en una hora.',
    'Un plan a la vez: terminá este antes de abrir el siguiente.',
    'Progresá de a un escalón y cambiá una sola variable por vez.',
    'Si cambiás casi todo, mejor partí de una plantilla modelo y progresá desde ahí.',
    'Mirá el plan anterior antes de armar el nuevo: la idea es que sea su progresión.',
    'Pocas pestañas abiertas: MOVE y PulsoMOVE alcanzan.',
  ];

  function minutosDesde(iso) { return iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)) : 0; }

  function bandaConcentrado(M) {
    const r = M.resumen, mes = M.mes || {};
    if (mes.hoy_completo) return `<div class="concentrado listo">🎉 Terminaste lo de hoy: ${esc(mes.hoy_completo.planes)} planes${Number(mes.hoy_completo.minutos) ? ' en ' + esc(mes.hoy_completo.minutos) + ' minutos' : ''}.</div>`;
    if (!r.pendientes_hoy) return '';
    const va = mes.primera_marca_hoy ? ` · vas ${minutosDesde(mes.primera_marca_hoy)} min desde el primero` : '';
    return `<div class="concentrado">⏱️ <b>Modo concentrado:</b> te ${r.pendientes_hoy === 1 ? 'falta 1 plan' : 'faltan ' + r.pendientes_hoy + ' planes'}. La idea es terminarlos en una hora${va}.
      ${avisosPendientes() ? '<button class="boton claro" data-accion="activar-avisos">🔔 Activar consejos</button>' : ''}</div>`;
  }

  // Consejos cada 20 minutos mientras quedan planes y la app está abierta
  let relojConsejos = null, consejoN = 0;
  function programarConsejos() {
    clearInterval(relojConsejos);
    relojConsejos = setInterval(() => {
      const M = E.planes && E.planes.mio;
      if (E.vista !== 'planes' || !M || !M.resumen.pendientes_hoy) return;
      push(`Te ${M.resumen.pendientes_hoy === 1 ? 'falta 1 plan' : 'faltan ' + M.resumen.pendientes_hoy + ' planes'}`, CONSEJOS_PROFE[consejoN++ % CONSEJOS_PROFE.length]);
    }, 20 * 60 * 1000);
  }

  function festejarDia(r) {
    if (!r || !r.dia_completo) return;
    const d = r.dia_completo;
    celebrar('¡Día completo!', `Terminaste tus ${d.planes} plan${d.planes === '1' ? '' : 'es'} de hoy${Number(d.minutos) ? ' en ' + d.minutos + ' minutos' : ''}.${Number(d.minutos) <= 60 ? ' ⏱️ En menos de una hora.' : ''}`, true);
  }

  function medallasHtml(lista) {
    return `<div class="medallas-profe">${lista.map(m => `<div class="medalla-profe${m.ganada ? ' ganada' : ''}"><span class="emoji">${m.emoji}</span><b>${esc(m.nombre)}</b>
      <span class="para">${esc(m.para)}</span><span class="avance"><i style="width:${Math.min(100, Math.round(m.n / m.meta * 100))}%"></i></span><span class="cuenta">${m.n} de ${m.meta}${m.ganada ? ' · ¡ganada!' : ''}</span></div>`).join('')}</div>`;
  }

  // Plan extra: renové el plan de un socio que no estaba en la lista de hoy
  function bloquePlanExtra(M) {
    const socios = (M.reeval && M.reeval.socios) || [];
    if (!socios.length) return '';
    return `<div class="persona plan-extra"><b>➕ Plan extra</b><span class="turno">¿Le renovaste el plan a un socio que no estaba en tu lista? Agregalo y te cuenta.</span>
      <input class="buscador" list="socios-extra" data-extra-busca placeholder="Nombre del socio" aria-label="Socio al que le renovaste el plan">
      <datalist id="socios-extra">${socios.map(x => `<option value="${esc(x.socio_nombre)}"></option>`).join('')}</datalist>
      <button class="boton verde ancho" data-accion="plan-extra">Agregar plan extra</button></div>`;
  }

  // ---------- Auditoría de planes (F2.18): lo que hay que corregir y el puntaje ----------
  const NIVEL_AUD = { optimo: ['verde', 'Óptimo'], mejorar: ['amarillo', 'A mejorar'], critico: ['rojo', 'Crítico'] };
  const SECCION_AUD = { gestion: 'Gestión y vigencia', diagnostico: 'Diagnóstico', metodologia: 'Rigor metodológico', custom: 'Customización', rpe: 'RPE', general: 'Generales' };

  function tarjetaHallazgo(h, i, puedeMarcar) {
    const estado = h.estado === 'marcada' ? '<span class="estado hecha">Dijiste que lo corregiste</span>'
      : h.estado === 'no_corregido' ? '<span class="estado atrasada">Dijiste que lo corregiste y sigue igual</span>'
      : h.reaparecio ? '<span class="estado ayer">Volvió a aparecer</span>' : h.gravedad === 'r' ? '<span class="estado atrasada">Importante</span>' : '';
    return `<article class="tarjeta hallazgo${h.estado === 'marcada' ? ' hecha' : ''}" style="--i:${i}"><div class="cabeza">
        <span class="socio">${esc(h.socio_nombre)}</span>${estado}
        <span class="profe">${esc(SECCION_AUD[h.seccion] || h.seccion)} · desde el ${esc(ddmm(h.desde))}</span>
        ${h.detalle.slice(0, 6).map(t => `<span class="nota">• ${esc(t)}</span>`).join('')}${h.detalle.length > 6 ? `<span class="nota">… y ${h.detalle.length - 6} más</span>` : ''}
      </div>${puedeMarcar ? `<div class="fila-accion">${h.estado === 'marcada'
        ? `<button class="boton claro" data-accion="aud-marcar" data-id="${esc(h.id)}" data-hecha="0">Deshacer</button><span class="aclara">Mañana lo miramos en MOVE.</span>`
        : `<button class="boton claro" data-accion="aud-marcar" data-id="${esc(h.id)}" data-hecha="1">Lo corregí</button>`}</div>` : ''}</article>`;
  }

  function bloqueAuditoria(M) {
    const A = M.auditoria;
    if (!A || !A.pendientes.length) return '';
    let i = 0;
    const filtro = E.audSeccion || '';
    const lista = A.pendientes.filter(h => !filtro || h.seccion === filtro);
    const secciones = [...new Set(A.pendientes.map(h => h.seccion))];
    return `<section class="grupo"><h2>🧾 Auditoría: para corregir <span class="cuenta">${A.cuantos.pendientes}</span></h2>
      <p class="intro-grupo">Lo encontró la auditoría de anoche en tus planes. Cuando lo corregís en MOVE, se cierra solo a la mañana siguiente; si tocás "Lo corregí", lo miramos primero.${A.cuantos.corregidos_semana ? ` Esta semana corregiste ${A.cuantos.corregidos_semana}. 👏` : ''}</p>
      <div class="filtros"><button class="chip" data-accion="aud-seccion" data-s="" aria-pressed="${!filtro}">Todo</button>${secciones.map(s => `<button class="chip" data-accion="aud-seccion" data-s="${s}" aria-pressed="${filtro === s}">${esc(SECCION_AUD[s] || s)}</button>`).join('')}</div>
      <details class="catalogo"${E.audAbierto ? ' open' : ''}><summary data-accion="aud-abrir">Ver ${lista.length} socio${lista.length === 1 ? '' : 's'} con algo para corregir</summary>
        ${lista.slice(0, 40).map(h => tarjetaHallazgo(h, i++, true)).join('')}${lista.length > 40 ? `<p class="aclara">Y ${lista.length - 40} más: corregí estos primero.</p>` : ''}
      </details></section>`;
  }

  function puntajeAuditoria(A, titulo) {
    if (!A || A.puntaje == null) return '';
    const [color, nivel] = NIVEL_AUD[A.nivel] || ['gris', ''];
    const cambio = A.cambio_semana == null ? '' : A.cambio_semana > 0 ? ` · ▲ ${A.cambio_semana} en la semana` : A.cambio_semana < 0 ? ` · ▼ ${-A.cambio_semana} en la semana` : ' · igual que hace una semana';
    return `<div class="persona auditoria-pts"><b>${esc(titulo || 'Auditoría de tus planes')}</b>
      <div class="pts-grande ${color}"><strong>${A.puntaje}</strong><span>${esc(nivel)}${esc(cambio)}</span></div>
      ${(A.secciones || []).map(s => `<div class="pts-seccion"><span>${esc(s.nombre)}</span><span class="avance"><i class="${s.puntaje >= 80 ? 'verde' : s.puntaje >= 60 ? 'amarillo' : 'rojo'}" style="width:${s.puntaje}%"></i></span><b>${s.puntaje}</b></div>`).join('')}
      ${A.repetido && A.repetido.length ? `<span class="aclara">Lo que más se repite: ${A.repetido.slice(0, 3).map(r => esc(r.que) + ' (' + r.veces + ')').join(' · ')}</span>` : ''}
      <span class="aclara">80 o más: óptimo · 60 a 79: a mejorar · menos de 60: crítico.</span></div>`;
  }

  function vistaMesProfe() {
    if (!E.planes) return '<div class="cargando">Cargando tu mes…</div>';
    const M = E.planes.mio;
    if (!M) return '<div class="vacio">Tu usuario no tiene socios asignados como profe.</div>';
    const s = M.mes || {}, rv = s.revisiones || {}, r = M.resumen;
    const c = (n, txt, clase) => `<div class="${clase || ''}"><strong>${n == null ? '—' : n}</strong><span>${txt}</span></div>`;
    let i = 0;
    const lista = (M.revisiones && M.revisiones.lista) || [];
    return `<h1 class="titulo">Tu mes <span>·</span> planes</h1>
      <p class="bajada">Tus números, como los mira la auditoría. Son para vos: no hay ranking entre compañeros.</p>
      <div class="personas">
        ${puntajeAuditoria(M.auditoria)}
        <div class="persona"><b>Planes</b><div class="cifras">${c(r.en_agenda, 'te quedan en los próximos 30 días')}${c(r.atrasadas, 'atrasados hoy', r.atrasadas ? 'mal' : 'bien')}${c(r.hechas_mes, 'hechos este mes', 'bien')}${c(s.dias_completos, 'días completos')}${c(s.en_una_hora, 'días en menos de 1 hora')}${c(r.en_papel || 0, 'en papel')}</div></div>
        <div class="persona"><b>Customización y progresión (30 días)</b><div class="cifras">${c(rv.revisados, 'planes renovados revisados')}${c(rv.en_rango, 'entre 30 y 80%', 'bien')}${c(rv.casi_todo, 'cambiaste casi todo', rv.casi_todo ? 'mal' : '')}${c(rv.con_saltos, 'con saltos de escalón', rv.con_saltos ? 'mal' : 'bien')}${c(rv.saltos_sin_responder, 'saltos sin responder', rv.saltos_sin_responder ? 'mal' : 'bien')}${c(rv.minutos_mediana != null ? rv.minutos_mediana + ' min' : null, 'tardás en armar un plan (aprox.)')}</div></div>
      </div>
      <section class="grupo"><h2>🏅 Medallas del mes</h2>${medallasHtml(s.medallas || [])}</section>
      ${lista.length ? `<section class="grupo"><h2>🔎 Tus planes renovados <span class="cuenta">${lista.length}</span></h2>${lista.map(x => tarjetaRevision(x, i++, true)).join('')}</section>` : ''}`;
  }

  function bloqueHechas(M) {
    const H = M.hechas || [];
    if (!H.length) return '';
    const que = t => (t.estado === 'papel' ? '📄 Plan en papel' : t.estado === 'derivada' ? '↪️ ' + (t.nota || 'Es de otro profe') : '✅ Renovado');
    return `<details class="catalogo hechas-profe"><summary>Lo que ya hiciste (${H.length}): si te equivocaste, deshacelo</summary>
      ${H.map(t => `<div class="hecha-fila"><span><b>${esc(t.socio_nombre)}</b> · ${esc(que(t))} · ${esc(ddmmDe(t.hecha_en))}</span>
        <button class="boton claro" data-accion="plan-deshacer" data-id="${esc(t.id)}">Deshacer</button></div>`).join('')}</details>`;
  }

  function vistaPlanes() {
    if (!E.planes) return '<div class="cargando">Cargando tus planes…</div>';
    const M = E.planes.mio;
    if (!M) return '<div class="vacio">Tu usuario no tiene socios asignados como profe.</div>';
    let i = 0;
    const nuevos = M.hoy.filter(t => t.tipo === 'Plan nuevo');
    const resto = M.hoy.filter(t => t.tipo !== 'Plan nuevo');
    const porDia = {};
    M.proximas.forEach(t => { (porDia[t.fecha] = porDia[t.fecha] || []).push(t); });
    return `<div class="dos-columnas"><aside class="lado"><div class="persona"><b>Tu mes</b>${cifrasPlanes(M.resumen)}</div>
        <p class="aclara">Cada día tenés una cantidad pareja de planes: así, a fin de mes, todos tus socios quedan con el plan al día. Lo que no llegás a hacer pasa al día siguiente.</p>
        ${bloquePlanExtra(M)}</aside>
      <div class="principal">
      <h1 class="titulo">${esc(tituloDia(E.planes.hoy))} <span>·</span> tus planes</h1>
      <p class="bajada">Primero el socio nuevo, después los vencidos y después los que están por vencer.</p>
      ${bandaConcentrado(M)}
      ${nuevos.length ? `<section class="grupo"><h2>🆕 Plan nuevo, hoy <span class="cuenta">${nuevos.length}</span></h2>${nuevos.map(t => tarjetaPlan(t, i++, true)).join('')}</section>` : ''}
      ${resto.length ? `<section class="grupo"><h2>Para renovar hoy <span class="cuenta">${resto.length}</span></h2>${resto.map(t => tarjetaPlan(t, i++, true)).join('')}</section>`
        : (nuevos.length ? '' : '<div class="vacio">Hoy no tenés planes para renovar. 🎉</div>')}
      ${bloqueAuditoria(M)}
      ${bloqueHechas(M)}
      ${bloqueRevisiones(M)}
      ${bloqueReeval(M)}
      ${M.proximas.length ? `<section class="grupo"><h2>Próximos a renovar <span class="cuenta">${M.proximas.length}</span></h2>
        ${Object.keys(porDia).sort().map(f => `<h3 class="dia-prox">${esc(tituloDia(f))}</h3>${porDia[f].map(t => tarjetaPlan(t, i++, false, true)).join('')}`).join('')}</section>` : ''}
    </div></div>`;
  }

  // ---------- Tablero de coordinación: vencidos que igual vienen, customización y tiempo de armado ----------
  const BANDAS_CUSTOM = [['sin_modificar', 'Menos de 15%: no cuenta como modificado', 'gris'], ['poco', '15 a 30%: poco', 'amarillo'], ['bien', '30 a 80%: bien', 'verde'], ['casi_todo', 'Más de 80%: usar una plantilla modelo', 'rojo']];
  const colorViene = n => (n >= 8 ? 'rojo' : n >= 4 ? 'amarillo' : 'gris');
  const vez = n => n + (n === 1 ? ' vez' : ' veces');

  // Almanaque: cuántos planes armó cada día (los últimos 30), con el número grande
  function almanaque(porDia, desde, hoy, titulo, cupo, cupoDesde) {
    const dias = [];
    const d = new Date(desde + 'T12:00:00Z');
    const fin = new Date(hoy + 'T12:00:00Z');
    while (d <= fin) { dias.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
    if (!dias.length) return '';
    const max = Math.max(1, ...dias.map(f => (porDia || {})[f] || 0));
    const vacios = (new Date(dias[0] + 'T12:00:00Z').getUTCDay() + 6) % 7;   // la semana empieza el lunes
    const celdas = Array(vacios).fill('<div class="alm-dia vacio-dia"></div>').concat(dias.map(f => {
      const n = (porDia || {})[f] || 0;
      const finde = [0, 6].indexOf(new Date(f + 'T12:00:00Z').getUTCDay()) >= 0;
      const marca = cupo && !finde && f < hoy && f >= (cupoDesde || '') ? (n >= cupo ? ' llego' : ' falto') : '';
      return `<div class="alm-dia${finde ? ' finde' : ''}${n ? '' : ' cero'}${marca}" style="--int:${(n / max).toFixed(2)}" title="${esc(ddmm(f))}: ${n} plan${n === 1 ? '' : 'es'}${cupo ? ' de ' + cupo : ''}"><em>${esc(f.slice(8, 10))}</em><strong>${n || '·'}</strong>${cupo && !finde ? `<small>de ${cupo}</small>` : ''}</div>`;
    }));
    return `<div class="almanaque"><div class="alm-cab">${titulo ? `<b>${esc(titulo)}</b>` : ''}</div>
      <div class="alm-grilla">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(x => `<div class="alm-sem">${x}</div>`).join('')}${celdas.join('')}</div></div>`;
  }

  function sumarPorDia(lista) {
    const out = {};
    lista.forEach(p => Object.keys(p || {}).forEach(f => { out[f] = (out[f] || 0) + p[f]; }));
    return out;
  }

  function tablaEquipo(eq) {
    const con = eq.filter(p => p.coord);
    if (!con.length) return '';
    const pct = v => (v == null ? '—' : v + '%');
    const filas = con.map(p => {
      const c = p.coord, cu = c.custom || {}, t = c.tiempo || {};
      return `<tr><td><button class="enlace" data-accion="profe-ver" data-p="${esc(p.profe)}">${esc(p.profe)}</button></td>
        <td class="num">${c.socios}</td><td class="num">${c.horas_semana != null ? c.horas_semana + ' h' : '—'}</td><td class="num">${pct(c.al_dia_pct)}</td><td class="num">${c.vencidos}</td>
        <td class="num ${c.vienen_mucho ? 'rojo' : c.vienen ? 'amarillo' : ''}"><b>${c.vienen}</b>${c.vienen_mucho ? ` <small>(${c.vienen_mucho} con 8+)</small>` : ''}</td>
        <td class="num">${c.renovados}</td><td class="num ${cu.en_rango_pct >= 60 ? 'verde' : cu.en_rango_pct >= 30 ? 'amarillo' : cu.medidos ? 'rojo' : ''}">${cu.medidos ? pct(cu.en_rango_pct) : '—'}</td>
        <td class="num">${cu.medidos ? pct(cu.mediana_pct) : '—'}</td><td class="num">${cu.medidos ? cu.con_saltos + '/' + cu.medidos : '—'}</td>
        <td class="num">${t.mediana_min != null ? t.mediana_min + ' min' : '—'}</td><td class="num">${t.horas_estimadas != null ? '~' + t.horas_estimadas + ' h' : '—'}</td>
        <td class="num">${c.horas_pagadas != null ? c.horas_pagadas + ' h' : '—'}</td><td class="num"><b>${c.planes_por_hora_pagada != null ? c.planes_por_hora_pagada : '—'}</b></td>
        <td class="num ${c.cupo && c.dias_cupo < c.dias_habiles / 2 ? 'rojo' : ''}">${c.cupo ? `${c.dias_cupo}/${c.dias_habiles} <small>(${c.cupo}/día)</small>` : '—'}</td>
        <td class="num">${p.auditoria && p.auditoria.puntaje != null ? `<b class="aud-linea ${(NIVEL_AUD[p.auditoria.nivel] || [''])[0]}">${p.auditoria.puntaje}</b>` : '—'}</td>
        <td class="para-mirar">${(c.alertas || []).length ? `<span class="alerta-n">⚠️ ${c.alertas.length}</span> ${esc(c.alertas[0])}` : '<span class="verde">✓</span>'}</td></tr>`;
    }).join('');
    const todos = [];
    con.forEach(p => (p.coord.lista || []).forEach(v => { if (v.vino_vencido >= 4) todos.push(Object.assign({ profe: p.profe }, v)); }));
    todos.sort((a, b) => b.vino_vencido - a.vino_vencido);
    return `<section class="bloque tablero-coord"><div class="bloque-cab"><h2>📊 Tablero del equipo</h2><span class="aclara">Datos de MOVE del ${esc(ddmm(con[0].coord.fecha))} · renovaciones de los últimos 30 días</span></div>
      <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Profe</th><th>Socios</th><th title="Horas por semana según su horario">Horas/sem.</th><th>Al día</th><th>Vencidos</th><th title="Planes vencidos en los que el socio igual vino 4 veces o más desde que venció">Vencidos que igual vienen</th><th>Renovados</th><th title="Planes renovados con un cambio entre 30 y 80% respecto del anterior">Custom. 30-80%</th><th>Cambio (mediana)</th><th title="Planes con un salto de 2 escalones o más">Con saltos</th><th>Min por plan</th><th>Horas armando</th><th title="Una hora extra paga por día hábil para planificar">Horas pagadas</th><th>Planes por hora paga</th><th title="Días hábiles, desde que arrancó el reparto el 10/11, en que llegó a su cupo diario de planes">Cumplió el cupo</th><th>Auditoría</th><th>Para mirar</th></tr></thead><tbody>${filas}</tbody></table></div>
      ${almanaque(sumarPorDia(con.map(p => p.coord.por_dia)), con[0].coord.desde, con[0].coord.fecha, 'Planes armados por día · todo el equipo')}
      <p class="aclara">Protocolo: el plan se renueva todos los meses. "Vencidos que igual vienen": el socio vino 4 veces o más con el plan vencido (una semana de entrenamiento); 8 o más, dos semanas. Customización comparada con el plan anterior del mismo socio: menos de 15% no cuenta como modificado, 30 a 80% es lo recomendado, más de 80% es casi un plan nuevo (para eso, una plantilla modelo). El tiempo es aproximado: sale de cuándo se creó y se editó cada día del plan en MOVE. Horas pagadas: una hora extra por día hábil (lunes a viernes) en los últimos 30 días, sin descontar francos ni vacaciones.</p>
      ${todos.length ? `<h3 class="sub-coord">🔴 Planes vencidos que más se usaron <span class="cuenta">${todos.length}</span></h3>
        <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Socio</th><th>Profe</th><th>Venció</th><th>Vino desde que venció</th><th>Con este plan</th><th>Por semana</th></tr></thead><tbody>
        ${todos.slice(0, 25).map(v => `<tr><td>${esc(v.nombre)}</td><td>${esc(v.profe.split(' ')[0])}</td><td>hace ${v.dias} días</td><td class="num ${colorViene(v.vino_vencido)}"><b>${vez(v.vino_vencido)}</b></td><td class="num">${vez(v.vino_plan)}</td><td class="num">${v.por_semana}</td></tr>`).join('')}
        </tbody></table></div>${todos.length > 25 ? `<p class="aclara">Y ${todos.length - 25} más: entrá a cada profe para ver todos.</p>` : ''}` : ''}
    </section>`;
  }

  function coordDeProfe(c) {
    if (!c) return '';
    const cu = c.custom || {}, t = c.tiempo || {}, b = cu.bandas || {};
    const total = cu.medidos || 0;
    return `${(c.alertas || []).length ? `<section class="grupo alertas-coord"><h2>⚠️ Para mirar <span class="cuenta">${c.alertas.length}</span></h2>${c.alertas.map(a => `<p class="alerta-coord">${esc(a)}</p>`).join('')}</section>` : ''}
    <div class="personas">
      <div class="persona"><b>Planes vencidos</b><div class="pts-grande ${c.vienen_mucho ? 'rojo' : c.vienen ? 'amarillo' : 'verde'}"><strong>${c.vencidos}</strong><span>de ${c.socios} socios · al día ${c.al_dia_pct}%</span></div>
        <span class="aclara">${c.vienen} igual vinieron 4 veces o más desde que venció${c.vienen_mucho ? ` (${c.vienen_mucho} con 8 o más)` : ''} · ${c.no_vienen} no volvieron a venir · ${c.sin_plan} sin plan.</span></div>
      <div class="persona"><b>Customización (30 días)</b>${total ? BANDAS_CUSTOM.map(([k, txt, col]) => `<div class="pts-seccion"><span>${esc(txt)}</span><span class="avance"><i class="${col}" style="width:${Math.round(100 * (b[k] || 0) / total)}%"></i></span><b>${b[k] || 0}</b></div>`).join('') +
        `<span class="aclara">${total} planes renovados medidos · cambio mediano ${cu.mediana_pct}% · con saltos de 2+ escalones: ${cu.con_saltos} · RPE fuera de lo indicado: ${cu.rpe_fuera}</span>` : '<span class="aclara">Todavía no hay planes renovados medidos.</span>'}</div>
      <div class="persona"><b>Tiempo armando planes</b><div class="pts-grande"><strong>${t.mediana_min != null ? t.mediana_min : '—'}</strong><span>min por plan (mediana)</span></div>
        <span class="aclara">${c.renovados} planes renovados en 30 días${t.horas_estimadas != null ? ` · ~${t.horas_estimadas} h en total` : ''} · medido en ${t.medidos || 0}. Aproximado con las fechas de MOVE: 1-2 min suele ser un plan copiado.</span></div>
      ${c.horas_pagadas != null ? `<div class="persona"><b>Hora extra paga</b><div class="pts-grande"><strong>${c.planes_por_hora_pagada}</strong><span>planes por hora paga</span></div>
        <span class="aclara">${c.planes_30} planes en 30 días (${c.dias_con_planes} días con planes) · ${c.horas_pagadas} h pagadas (1 h por día hábil)${t.horas_estimadas != null ? ` · usó ~${t.horas_estimadas} h armando planes, el ${Math.round(100 * t.horas_estimadas / c.horas_pagadas)}% de lo pago` : ''}.</span></div>` : ''}
    </div>
    ${c.por_dia ? `<section class="grupo"><h2>🗓️ Planes por día</h2>${c.cupo ? `<p class="intro-grupo">Su cupo es de ${c.cupo} planes por día hábil, para dejar todo al día en un mes. Desde que arrancó el reparto (${esc(ddmm(c.cupo_desde || c.desde))}) llegó en ${c.dias_cupo} de ${c.dias_habiles} días hábiles.</p>` : ''}${almanaque(c.por_dia, c.desde, c.fecha, '', c.cupo, c.cupo_desde)}</section>` : ''}
    ${(c.lista || []).length ? `<section class="grupo"><h2>📅 Vencidos y cuántas veces vino <span class="cuenta">${c.vencidos}</span></h2>
      <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Socio</th><th>Venció</th><th>Vino desde que venció</th><th>Con este plan</th><th>Por semana</th></tr></thead><tbody>
      ${c.lista.map(v => `<tr><td>${esc(v.nombre)}</td><td>${esc(ddmm(v.vence))} · hace ${v.dias} días</td><td class="num ${colorViene(v.vino_vencido)}"><b>${vez(v.vino_vencido)}</b></td><td class="num">${vez(v.vino_plan)}</td><td class="num">${v.por_semana}</td></tr>`).join('')}
      </tbody></table></div></section>` : ''}`;
  }

  function vistaProfes() {
    if (!E.planes) return '<div class="cargando">Cargando los profes…</div>';
    const eq = E.planes.equipo || [];
    const selector = tiene('admin') ? `<div class="filtros">${Object.keys(SEDES).map(k => `<button class="chip" data-accion="planes-sede" data-s="${k}" aria-pressed="${E.sedeElegida === k}">${SEDES[k]}</button>`).join('')}</div>` : '';
    if (E.profeVer) {
      const p = eq.find(x => x.profe === E.profeVer);
      if (p) {
        let i = 0;
        return `<button class="chip" data-accion="profe-volver">← Todos los profes</button>
          <h1 class="titulo">${esc(p.profe)}</h1><div class="persona">${cifrasPlanes(p.resumen)}</div>
          ${p.coord && p.coord.horario ? `<p class="bajada">🕒 ${esc(p.coord.horario)} · ${p.coord.horas_semana} h por semana</p>` : ''}
          ${coordDeProfe(p.coord)}
          <section class="grupo"><h2>Lo de hoy <span class="cuenta">${p.hoy.length}</span></h2>${p.hoy.length ? p.hoy.map(t => tarjetaPlan(t, i++, false)).join('') : '<div class="vacio">Nada para hoy.</div>'}</section>
          ${p.auditoria ? `<div class="personas">${puntajeAuditoria(p.auditoria, 'Auditoría')}</div>${p.auditoria.pendientes.length ? `<section class="grupo"><h2>🧾 Para corregir <span class="cuenta">${p.auditoria.cuantos.pendientes}</span></h2>${p.auditoria.pendientes.map(h => tarjetaHallazgo(h, i++, false)).join('')}</section>` : ''}` : ''}
          ${p.revisiones && p.revisiones.lista.length ? `<section class="grupo"><h2>🔎 Planes renovados (30 días) <span class="cuenta">${p.revisiones.lista.length}</span></h2>${p.revisiones.lista.map(r => tarjetaRevision(r, i++, false)).join('')}</section>` : ''}`;
      }
    }
    return `<h1 class="titulo">Profes <span>·</span> planes al día</h1>
      <p class="bajada">Lo que cada profe y cada kinesiólogo tiene que renovar hoy, lo atrasado y lo que lleva hecho en el mes.</p>
      ${selector}
      ${tablaEquipo(eq)}
      ${eq.length ? `<div class="personas">${eq.map(p => `<div class="persona"><b>${esc(p.profe)}</b><span class="turno">${p.con_usuario ? 'Con usuario' : 'Todavía sin usuario en PulsoMOVE'}</span>${cifrasPlanes(p.resumen)}${p.auditoria && p.auditoria.puntaje != null ? `<span class="uso-hoy aud-linea ${(NIVEL_AUD[p.auditoria.nivel] || [''])[0]}">🧾 Auditoría: <b>${p.auditoria.puntaje}</b> ${esc((NIVEL_AUD[p.auditoria.nivel] || ['', ''])[1])}${p.auditoria.cambio_semana ? ` (${p.auditoria.cambio_semana > 0 ? '▲' : '▼'} ${Math.abs(p.auditoria.cambio_semana)})` : ''} · ${p.auditoria.cuantos.pendientes} para corregir${p.auditoria.cuantos.no_corregidos ? ` · ${p.auditoria.cuantos.no_corregidos} dijo que corrigió y sigue` : ''}</span>` : ''}${p.dias ? `<span class="uso-hoy">Días completos este mes: ${p.dias.completos} (en menos de 1 hora: ${p.dias.en_una_hora})${p.revisiones && p.revisiones.resumen.minutos_mediana != null ? ` · arma un plan en ~${p.revisiones.resumen.minutos_mediana} min` : ''}${p.resumen.en_papel ? ` · en papel: ${p.resumen.en_papel}` : ''}</span>` : ''}${p.revisiones ? `<span class="uso-hoy">Planes renovados (30 días): ${p.revisiones.resumen.revisados} · en 30-80%: ${p.revisiones.resumen.en_rango} · casi todo cambiado: ${p.revisiones.resumen.casi_todo}${p.revisiones.resumen.con_saltos ? ` · con saltos: ${p.revisiones.resumen.con_saltos} (${p.revisiones.resumen.saltos_sin_responder} sin responder, ${p.revisiones.resumen.corregir} a corregir)` : ''}</span>` : ''}
        <button class="chip ver-lista" data-accion="profe-ver" data-p="${esc(p.profe)}">Ver lo de hoy</button></div>`).join('')}</div>`
        : '<div class="vacio">Todavía no hay planes cargados para esta sede.</div>'}`;
  }

  // ---------- Rendimiento ----------

  const MESES =['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const nombreMes = m => MESES[Number(m.slice(5, 7)) - 1];
  const plata = n => '$' + Math.round(n || 0).toLocaleString('es-AR');
  const formato = (v, f) => (v == null ? '—' : f === 'pct' ? Math.round(v * 100) + '%' : Math.round(v * 10) / 10);

  // Con quien recibe el tablero se habla de lo que falta, no de lo que está mal: el rojo queda para quien coordina
  let vistaPropia = false;
  function estadoDe(c) {
    if (c == null) return ['sin', '·', 'Sin datos'];
    if (c >= 0.9) return ['bien', '✓', 'En objetivo'];
    if (c >= 0.6) return ['cerca', '~', 'Cerca'];
    return vistaPropia ? ['cerca', '→', 'Vamos por más'] : ['lejos', '!', 'Lejos'];
  }

  function barras(items, alto) {
    const max = Math.max(1, ...items.map(x => x.valor));
    return `<div class="barras" style="height:${alto || 110}px">${items.map(x => `<div class="barra" title="${esc(x.titulo)}"><span class="barra-num">${x.valor || ''}</span><i style="height:${Math.round(x.valor / max * 100)}%"></i><em>${esc(x.etiqueta)}</em></div>`).join('')}</div>`;
  }

  const horasMin = m => (!m ? '0 min' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'));

  function graficoDias(serie) {
    if (!serie || !serie.length) return '';
    const ult = serie.slice(-14);
    return `<section class="bloque"><div class="bloque-cab"><h2>Tareas hechas por día</h2></div>${barras(ult.map(x => ({ valor: x.hechas, etiqueta: x.fecha.slice(8, 10), titulo: `${ddmm(x.fecha)}: ${x.hechas} hechas` })))}</section>`;
  }

  const hm = m => (m == null ? '—' : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  const horas = m => (m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min');

  // Solo llega a quien coordina sin atender recepción
  function bloqueUso(p) {
    if (!p.uso || !p.uso.length) return '';
    const ult = p.uso.slice(-7).reverse();
    const seg = {};
    p.uso.forEach(d => Object.keys(d.completando_por_hora).forEach(h => { seg[h] = (seg[h] || 0) + d.completando_por_hora[h]; }));
    const barrasHora = [];
    for (let h = 6; h <= 22; h++) barrasHora.push({ valor: Math.round((seg[h] || 0) / 60), etiqueta: String(h), titulo: `De ${h} a ${h + 1} h: ${Math.round((seg[h] || 0) / 60)} min completando` });
    return `<section class="bloque"><div class="bloque-cab"><h2>Tiempo en su turno</h2><span class="sello">Solo coordinación</span></div>
      <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Día</th><th>Usando la app</th><th>Abierta sin tocar</th><th>En otra ventana</th><th>Cerrada</th><th>Completando</th><th>Huecos de 40 min o más</th></tr></thead><tbody>${ult.map(d => `<tr><td>${ddmm(d.fecha)}</td>${d.con_senal ? `<td class="num">${horas(d.activo)}</td><td class="num">${horas(d.quieta)}</td><td class="num">${horas(d.otra)}</td><td class="num">${horas(d.cerrada)}</td>` : '<td colspan="4">Sin medir: solo hay marcas de tareas</td>'}<td class="num">${horas(d.completando)}</td><td>${d.huecos.length ? d.huecos.map(h => `<span class="hueco">${hm(h.desde)} a ${hm(h.hasta)}</span>`).join(' ') : '—'}</td></tr>`).join('')}</tbody></table></div>
      <h3 class="sub-bloque">Minutos completando tareas, por hora</h3>${barras(barrasHora, 90)}
      <p class="aclara">Mide la app, no a la persona. Puede estar atendiendo el mostrador, en MOVE o en WhatsApp: "sin tocar", "otra ventana" y "cerrada" no significan que no esté trabajando. No es una medida de rendimiento y no entra en el puntaje: sirve para ver cuándo hay más y menos movimiento y repartir mejor las tareas.</p></section>`;
  }

  function bloqueTiempos(p) {
    const T = p.tiempos;
    if (!T || !T.por_dia.length) return '';
    const horas = [];
    for (let h = 6; h <= 22; h++) horas.push({ valor: T.por_hora[h] || 0, etiqueta: String(h), titulo: `De ${h} a ${h + 1} h: ${T.por_hora[h] || 0} marcas` });
    const ult = T.por_dia.slice(-7).reverse();
    return `<section class="bloque"><div class="bloque-cab"><h2>Cuándo hizo las tareas</h2>${T.segundos_promedio ? `<span class="sello">${duracion(T.segundos_promedio)} por tarea</span>` : ''}</div>
      ${barras(horas, 90)}
      <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Día</th><th>Primera</th><th>Última</th><th>Tareas</th><th>Por hora</th><th>En tareas</th><th>Le quedaban</th></tr></thead><tbody>${ult.map(d => `<tr><td>${ddmm(d.fecha)}</td><td>${d.primera}</td><td>${d.ultima}</td><td class="num">${d.marcas}</td><td class="num">${d.por_hora == null ? '—' : d.por_hora}</td><td class="num">${horasMin(d.minutos_en_tareas)}</td><td class="num">${d.minutos_libres == null ? '—' : horasMin(d.minutos_libres)}</td></tr>`).join('')}</tbody></table></div>
      <p class="aclara">"Le quedaban" es lo que faltaba para terminar el turno cuando marcó su última tarea: tiempo disponible, no tiempo ocioso, porque también atiende el mostrador. "En tareas" va de que abre la tarjeta a que la guarda y no mide la charla con el socio.</p></section>`;
  }

  function nota(n) {
    return n == null ? '—' : String(n);
  }

  const DETALLE = {
    tareas_pct: v => v.tareas_total ? `${v.tareas_hechas} de ${v.tareas_total}` : '',
    apertura_pct: v => v.aperturas ? `${v.aperturas_bien} de ${v.aperturas} días` : '',
    retencion_pct: v => v.retencion_total ? `${v.retencion_logradas} de ${v.retencion_total}` : '',
    promesas_pct: v => v.promesas_total ? `${v.promesas_cumplidas} de ${v.promesas_total}` : '',
    conversion: v => v.consultas ? `${v.nuevos || 0} nuevos con ${v.consultas} consultas` : '',
  };

  function selectorMes(data) {
    const actual = data.hoy.slice(0, 7);
    const d = new Date(actual + '-15T12:00:00');
    d.setMonth(d.getMonth() - 1);
    const anterior = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    return [anterior, actual].map(m => `<button class="chip" data-accion="rend-mes" data-m="${m}" aria-pressed="${data.mes === m}">${nombreMes(m)}</button>`).join('');
  }

  function detallePersona(p, editable, propia) {
    vistaPropia = !!propia;
    const P = p.puntaje, v = p.valores;
    const [cls, ico, txt] = estadoDe(P.total == null ? null : P.total / 100);
    const incentivo = P.incentivo == null ? '' : P.incentivo
      ? '<div class="incentivo si">✓ Incentivos habilitados: el cumplimiento está al día.</div>'
      : `<div class="incentivo no">${propia ? '→ Para habilitar los incentivos, seguí sumando' : '! Incentivos en pausa'}: el cumplimiento está en ${P.grupos[0].puntaje}% y hace falta 90%.</div>`;
    const completo = P.filas.every(f => f.cumple == null || f.cumple >= 1) && P.total != null;
    const grupos = P.grupos.map(g => {
      const filas = P.filas.filter(f => f.grupo === g.nombre);
      const [c2, i2, t2] = estadoDe(g.puntaje == null ? null : g.puntaje / 100);
      return `<section class="bloque"><div class="bloque-cab"><h2>${esc(g.nombre)}</h2><span class="sello ${c2}">${i2} ${nota(g.puntaje)}${g.puntaje == null ? '' : '%'} · ${t2}</span></div>
        ${filas.map(f => {
          const [c3, i3, t3] = estadoDe(f.cumple);
          const det = DETALLE[f.clave] ? DETALLE[f.clave](v) : '';
          return `<div class="metrica"><div class="metrica-fila"><span class="metrica-nombre">${esc(f.nombre)}</span>
              <span class="metrica-valor"><b>${formato(f.valor, f.formato)}</b> / ${formato(f.objetivo, f.formato)}</span></div>
            <div class="medidor" title="${esc(f.nombre)}: ${formato(f.valor, f.formato)} de ${formato(f.objetivo, f.formato)}${det ? ' (' + esc(det) + ')' : ''}"><i class="${c3}" style="width:${Math.round((f.cumple || 0) * 100)}%"></i></div>
            <div class="metrica-pie"><span class="estado-txt ${c3}">${i3} ${t3}</span>${det ? `<span>${esc(det)}</span>` : ''}
              ${editable ? `<label class="objetivo-edit">Objetivo <input type="number" min="0" step="any" data-objetivo="${f.clave}" data-pct="${f.formato === 'pct' ? 1 : 0}" value="${f.formato === 'pct' ? Math.round(f.objetivo * 100) : f.objetivo}">${f.formato === 'pct' ? '%' : ''}</label>` : ''}</div></div>`;
        }).join('')}</section>`;
    }).join('');
    const dato = (t, val, sub) => `<div class="dato"><strong>${val}</strong><span>${esc(t)}</span>${sub ? `<em>${esc(sub)}</em>` : ''}</div>`;
    const ventas = !propia && v.cajas != null ? `<section class="bloque"><div class="bloque-cab"><h2>Lo que pasó por su caja</h2></div><div class="datos">
        ${dato('Cobros de planes', plata(v.cobros_plan_monto), (v.cobros_plan || 0) + ' cobros')}
        ${dato('Mostrador', plata(v.mostrador_monto), (v.mostrador || 0) + ' ventas')}
        ${dato('Renovaciones', v.renovaciones || 0)}
        ${dato('Bar y snacks', v.bar || 0)}
        ${dato('Recovery', v.recovery || 0)}
        ${dato('Indumentaria', v.indumentaria || 0)}
        ${dato('Suplementos', v.suplementos || 0)}
        ${dato('Sin clasificar', v.otros || 0)}
        ${dato('Días de caja', v.cajas)}
        ${v.reenganche_total ? dato('Socios antiguos que volvieron', v.reenganches || 0, 'de ' + v.reenganche_total + ' contactados') : ''}
      </div><p class="aclara">Lo cobrado es de quien abrió esa caja, no siempre de quien hizo la venta.</p></section>` : '';
    const actividad = `<section class="bloque"><div class="bloque-cab"><h2>Cargado a mano</h2></div><div class="datos">
        ${v.reenganche_total ? dato('Socios antiguos que volvieron', v.reenganches || 0, 'de ' + v.reenganche_total + ' contactados') : ''}
        ${dato('Consultas', v.consultas || 0)}${dato('Días de prueba', v.dias_prueba || 0, 'objetivo 2')}${dato('Reseñas pedidas', v.resenas || 0)}${dato('Referidos', v.referidos || 0)}
      </div></section>`;
    return `${completo ? '<div class="todo-cumplido">🏆 ¡Todos los objetivos cumplidos! Sos un ejemplo para el equipo.</div>' : ''}<section class="tablero">
        <div class="puntaje"><span class="puntaje-n">${nota(P.total)}</span><span class="puntaje-de">${P.total == null ? '' : 'de 100'}</span>
          <span class="sello ${cls}">${ico} ${txt}</span></div>
        <div class="grupos">${P.grupos.map(g => `<div class="grupo-mini"><strong>${nota(g.puntaje)}</strong><span>${esc(g.nombre)}</span></div>`).join('')}</div>
      </section>${incentivo}<div class="tablero-columnas">${graficoDias(p.serie)}${propia ? '' : bloqueUso(p) + bloqueTiempos(p)}${grupos}${bloqueVentasPersona(p)}${ventas}${actividad}</div>
      ${editable ? `<div class="botones"><button class="boton verde" data-accion="objetivos-guardar" data-dni="${esc(p.dni)}">Guardar objetivos</button></div>` : ''}`;
  }

  function aclaracionDatos(d) {
    const fecha = d.actualizado ? new Date(d.actualizado).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return `<p class="aclara">Las tareas y lo que cargás se actualizan al momento. Ventas, caja y retención se calculan cada mañana${fecha ? ' (última: ' + esc(fecha) + ')' : ''}. Lo que todavía no tiene datos no resta puntos.</p>`;
  }

  function vistaMes() {
    if (!E.rend) return '<div class="cargando">Calculando tu mes…</div>';
    const s = cliente.sesion();
    const p = E.rend.personas.find(x => x.nombre === s.nombre) || E.rend.personas[0];
    if (!p) return '<div class="vacio">Todavía no hay datos.</div>';
    return `<div class="filtros">${selectorMes(E.rend)}</div>
      <h1 class="titulo">Mi ${nombreMes(E.rend.mes)}</h1><p class="bajada">Cómo vas contra tus objetivos del mes.</p>
      <div class="logros"><div class="logro oro"><strong>${p.puntos || 0}</strong><span>puntos del mes</span></div></div>
      ${detallePersona(p, false, true)}${aclaracionDatos(E.rend)}
      <div class="grupo"><button class="boton ancho" data-accion="registrar">Registrar mensaje, consulta o venta</button></div>`;
  }

  function vistaRendimiento() {
    const selector = tiene('admin') ? Object.keys(SEDES).map(k => `<button class="chip" data-accion="rend-sede" data-s="${k}" aria-pressed="${E.sedeElegida === k}">${SEDES[k]}</button>`).join('') : '';
    if (!E.rend) return `<div class="filtros">${selector}</div><div class="cargando">Calculando…</div>`;
    const R = E.rend;
    const p = E.rendDni && R.personas.find(x => x.dni === E.rendDni);
    if (p) {
      return `<div class="filtros"><button class="chip" data-accion="rend-volver">← Volver al equipo</button>${selectorMes(R)}</div>
        <h1 class="titulo">${esc(p.nombre)}</h1><p class="bajada">${esc(SEDES[p.sede] || '')} · ${esc(TURNOS[p.turno] || '')} · ${nombreMes(R.mes)}</p>
        <div class="filtros"><button class="chip" data-accion="rend-lista" data-dni="${esc(p.dni)}">Ver su lista de hoy</button></div>
        ${detallePersona(p, tiene('admin'), false)}${aclaracionDatos(R)}`;
    }
    const filas = R.personas.map((x, i) => {
      const P = x.puntaje, v = x.valores;
      const [c] = estadoDe(P.total == null ? null : P.total / 100);
      return `<tr class="fila-tocable" data-accion="rend-persona" data-dni="${esc(x.dni)}" tabindex="0">
        <td class="pos">${i + 1}</td><td><b>${esc(x.nombre)}</b><br><span class="profe">${esc(TURNOS[x.turno] || '')}</span></td>
        <td><span class="sello ${c}">${nota(P.total)}</span></td>
        ${P.grupos.map(g => `<td class="num">${nota(g.puntaje)}</td>`).join('')}
        <td class="num">${v.nuevos || 0}</td><td class="num">${plata(v.mostrador_monto)}</td><td class="num">${v.tareas_total ? Math.round((v.tareas_pct || 0) * 100) + '%' : '—'}</td></tr>`;
    }).join('');
    return `<div class="filtros">${selector}</div><div class="filtros">${selectorMes(R)}</div>
      <h1 class="titulo">Rendimiento <span>·</span> ${nombreMes(R.mes)}</h1>
      <p class="bajada">Tocá una persona para ver el detalle${tiene('admin') ? ' y ajustar sus objetivos' : ''}.</p>
      ${R.personas.length ? `<div class="envoltura-tabla"><table class="tabla"><thead><tr><th>#</th><th>Persona</th><th>Puntaje</th><th>Cumpl.</th><th>Reten.</th><th>Ventas</th><th>Exper.</th><th>Nuevos</th><th>Mostrador</th><th>Tareas</th></tr></thead><tbody>${filas}</tbody></table></div>`
        : '<div class="vacio">No hay recepcionistas cargados en esta sede.</div>'}
      ${aclaracionDatos(R)}${bloqueEficiencia(R)}${bloqueProfes()}${bloqueCierres()}`;
  }

  // Solo admin: lo que rinde cada hora de turno
  function bloqueEficiencia(R) {
    const filas = R.personas.filter(p => p.eficiencia);
    if (!filas.length) return '';
    const orden = filas.slice().sort((a, b) => (b.eficiencia.indice == null ? -1 : b.eficiencia.indice) - (a.eficiencia.indice == null ? -1 : a.eficiencia.indice));
    const coma = n => (n == null ? '—' : String(n).replace('.', ','));
    return `<section class="bloque"><div class="bloque-cab"><h2>Eficiencia por hora de turno</h2><span class="sello">${nombreMes(R.mes)}</span></div>
      <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Persona</th><th>Nivel</th><th>Horas</th><th>Tareas por hora</th><th>Puntos de venta por hora</th><th>Turno usando la app</th></tr></thead>
      <tbody>${orden.map(p => { const e = p.eficiencia; const [c] = estadoDe(e.indice == null ? null : e.indice / 100); return `<tr><td><b>${esc(p.nombre)}</b></td><td><span class="sello ${c}">${e.indice == null ? '—' : e.indice}</span></td><td class="num">${e.horas}</td><td class="num">${coma(e.tareas_hora)}</td><td class="num">${coma(e.ventas_hora)}</td><td class="num">${e.uso_pct == null ? '—' : e.uso_pct + '%'}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="aclara">Nivel de 0 a 100: la mitad son tareas por hora (referencia 4), un cuarto puntos de venta por hora (referencia 1) y un cuarto el turno usando la app (referencia 60%). Las horas salen de los días con actividad o caja por las horas del turno cargado: no hay fichaje. Atender a alguien en persona no se ve en la app, y cada sede tiene distinta cantidad de tareas: sirve para conversar, no para sacar conclusiones solo con el número.</p></section>`;
  }

  // Llegada de los profes: sale sola del QR. Regla del equipo: fichar 15 minutos antes de la primera clase.
  function bloqueProfes() {
    if (!E.profes || !E.profes.length) return '';
    const por = {};
    E.profes.forEach(f => {
      const p = por[f.profe] = por[f.profe] || { nombre: f.profe, dias: 0, a_tiempo: 0, justo: 0, tarde: 0, sin_qr: 0 };
      p.dias++;
      p[f.estado]++;
    });
    const filas = Object.values(por).sort((a, b) => (a.a_tiempo / a.dias) - (b.a_tiempo / b.dias));
    return `<section class="bloque"><div class="bloque-cab"><h2>Llegada de los profes</h2><span class="sello">Últimos 14 días</span></div>
      <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Profe</th><th>Días</th><th>15 min antes</th><th>Antes de clase</th><th>Tarde</th><th>Sin QR</th></tr></thead>
      <tbody>${filas.map(p => `<tr><td><b>${esc(p.nombre)}</b></td><td class="num">${p.dias}</td><td class="num">${p.a_tiempo}</td><td class="num">${p.justo}</td><td class="num">${p.tarde}</td><td class="num">${p.sin_qr}</td></tr>`).join('')}</tbody></table></div>
      <p class="aclara">Se mide solo, con el QR de entrada y la primera clase de cada día. "Sin QR" no quiere decir que no vino, y un reemplazo puede figurar a nombre del profe titular: conviene hablarlo antes de sacar conclusiones.</p></section>`;
  }

  const estrellasTexto = n => (Number(n) >= 1 ? '★'.repeat(Number(n)) + '☆'.repeat(5 - Number(n)) : '—');
  const notaSede = v => (v == null ? '—' : String(v).replace('.', ',') + ' ★');
  // Los avisos que reciben y por qué están. "Probado" dice de dónde sale cada idea, no que ya sepamos que acá funciona: eso lo va a decir el uso.
  const CATALOGO_AVISOS = [
    ['👀 ¿Seguimos, Ara?', 'A los 40 minutos sin tocar la app, si le quedan tareas. El título cambia', 'La invita a seguir, sin retar'],
    ['⏰ Ara, falta media hora para tu cierre', '30 minutos antes de terminar. La recomendación cambia cada día', 'Le da tiempo de ordenar y de terminar lo que falta'],
    ['🚪 Terminó tu turno: cerrá PulsoMOVE', 'Al terminar el turno', 'Que nadie quede con el usuario de otra persona'],
    ['☀️ ¡Buen arranque, Ara!', 'Al empezar el turno, con el primer socio', 'Da un primer paso claro. Metas cercanas'],
    ['👋 ¡Buena semana, Ara!', 'Los lunes', 'Pertenencia: alguien nota que volviste'],
    ['🔴 Ara, quedan 3 de las primeras', 'Entre el 25% y el 75% del turno', 'Prioridad: lo que se pierde si se deja pasar'],
    ['💪 ¡Ya van 10, Ara!', 'Cada 5 tareas', 'Competencia: avance visible'],
    ['🏆 ¡Superaste a tu yo de ayer!', 'Cuando hace más que el último día', 'Se compara con ella misma, no con otras personas'],
    ['🔥 ¡5 días seguidos!', 'Desde 3 días seguidos', 'Constancia'],
    ['🌱 ¡Nueva medalla!', 'Al ganar una medalla', 'Competencia: las medallas son personales, sin ranking'],
    ['🙌 2 socios volvieron después de tu contacto', 'Cuando vuelve un socio que contactó', 'Sentido: ver a quién le sirvió el trabajo'],
    ['🤝 Entre todos ya van 20', 'Desde la mitad del turno', 'Pertenencia: una meta del equipo de la sede'],
    ['⏳ Ara, última hora de tu turno', 'Última hora, si queda algo', 'Cierre del día'],
    ['⭐ Antes de irte: ¿cómo estuvo hoy?', '15 minutos antes de terminar. La pregunta cambia cada día', 'Escucha: lo que responde le llega a coordinación'],
  ];

  function bloqueCierres() {
    if (!E.cierres) return '';
    const Z = E.cierresResumen;
    const catalogo = `<details class="catalogo"><summary>🔔 Ver los avisos que recibe recepción y para qué está cada uno</summary><div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Aviso</th><th>Cuándo</th><th>Para qué</th></tr></thead><tbody>${CATALOGO_AVISOS.filter(x => tiene('admin') || !tiene('recepcion') || x[1].indexOf('sin tocar la app') < 0).map(a => `<tr><td>${esc(a[0])}</td><td>${esc(a[1])}</td><td>${esc(a[2])}</td></tr>`).join('')}</tbody></table></div><p class="aclara">Salen como mucho cada 20 minutos y solo con PulsoMOVE abierta en esa PC.</p></details>`;
    if (!E.cierres.length) return `<section class="bloque"><div class="bloque-cab"><h2>Cómo vivió el día el equipo</h2></div><p class="aclara">Todavía nadie respondió la encuesta del cierre.</p>${catalogo}</section>`;
    const mejores = E.cierres.filter(c => c.lo_mejor).slice(0, 8);
    return `<section class="bloque"><div class="bloque-cab"><h2>Cómo vivió el día el equipo</h2><span class="sello">Últimos 14 días</span></div>
      ${Z ? `<div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Sede</th><th>Respuestas</th><th>Su día</th><th>La sala</th><th>Los profes</th><th>Compañeros</th><th>Los socios</th></tr></thead><tbody>${Z.sedes.map(s => `<tr><td>${esc(SEDES[s.sede] || s.sede)}</td><td class="num">${s.respuestas}</td><td class="num">${notaSede(s.dia)}</td><td class="num">${notaSede(s.sala)}</td><td class="num">${notaSede(s.profes)}</td><td class="num">${notaSede(s.equipo)}</td><td class="num">${notaSede(s.socios)}</td></tr>`).join('')}</tbody></table></div>
      ${Z.bajas ? `<p class="alerta-pulso">⚠️ ${Z.bajas === 1 ? '1 respuesta tiene' : Z.bajas + ' respuestas tienen'} alguna nota de 2 estrellas o menos: conviene hablarlo.</p>` : ''}` : ''}
      ${mejores.length ? `<h3 class="sub-pulso">✨ Lo que contaron</h3>${mejores.map(c => `<p class="lo-mejor">${c.pregunta ? `<small>${esc(c.pregunta)}</small>` : ''}“${esc(c.lo_mejor)}” <em>${esc(c.nombre)} · ${ddmm(c.fecha)}</em></p>`).join('')}` : ''}
      ${catalogo}
      <h3 class="sub-pulso">Cierres de turno</h3>${E.cierres.slice(0, 20).map(c => {
      const r = Object.values(c.respuestas || {}).filter(Boolean);
      return `<div class="metrica"><div class="metrica-fila"><span class="metrica-nombre">${esc(c.nombre)} · ${ddmm(c.fecha)}</span><span class="notas-cierre">Día ${estrellasTexto(c.animo)}${c.sala ? ` · Sala ${estrellasTexto(c.sala)}` : ''}${c.profes ? ` · Profes ${estrellasTexto(c.profes)}` : ''}${c.equipo ? ` · Compañeros ${estrellasTexto(c.equipo)}` : ''}${c.socios ? ` · Socios ${estrellasTexto(c.socios)}` : ''}</span></div>
        <div class="metrica-pie"><span>${esc(c.hechas)} hechas · ${esc(c.pendientes)} pendientes · ${esc(c.mensajes)} mensajes · ${esc(c.consultas)} consultas</span></div>
        ${r.map(x => `<p class="aclara">“${esc(x)}”</p>`).join('')}${c.comentario ? `<p class="aclara">“${esc(c.comentario)}”</p>` : ''}</div>`;
    }).join('')}</section>`;
  }

  // Lo que ya completó en un formulario queda guardado en esta PC hasta enviarlo
  function guardarBorrador(form, clave) {
    const datos = {};
    form.querySelectorAll('input, textarea').forEach(c => {
      if (c.type === 'radio') { if (c.checked) datos[c.name] = c.value; }
      else if (c.type === 'checkbox') datos['✓' + (c.dataset.check || c.name)] = c.checked;
      else if (c.name) datos[c.name] = c.value;
    });
    try { almacenSeguro().setItem(clave, JSON.stringify(datos)); } catch (e) { /* sin almacenamiento no hay borrador */ }
  }

  function restaurarBorrador(form, clave) {
    let datos = null;
    try { datos = JSON.parse(almacenSeguro().getItem(clave) || 'null'); } catch (e) { datos = null; }
    if (!datos) return;
    form.querySelectorAll('input, textarea').forEach(c => {
      if (c.type === 'radio') c.checked = datos[c.name] === c.value;
      else if (c.type === 'checkbox') c.checked = !!datos['✓' + (c.dataset.check || c.name)];
      else if (c.name && datos[c.name] != null) c.value = datos[c.name];
    });
  }

  // El fondo oscuro de un diálogo es el propio <dialog>: se reconoce porque el toque cae fuera de su caja
  function tocoAfuera(ev, d) {
    if (ev.target !== d) return false;
    const r = d.getBoundingClientRect();
    return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
  }

  // Cierre de turno: 15 minutos antes de terminar, unas preguntas según lo que pasó en el día
  function dialogoCierre(prueba) {
    if (document.querySelector('dialog')) return;
    const D = E.dia;
    if (!D) return;
    push('⭐ Antes de irte: ¿cómo estuvo hoy?', 'Son unas pocas estrellas en PulsoMOVE.');
    const delDia = preguntasDelDia(E.hoy, [...String(cliente.sesion().nombre || '')].reduce((a, c) => a + c.charCodeAt(0), 0));
    const estrellas = (nombre, titulo, bajo, alto) => `<fieldset class="estrellas-campo"><legend>${esc(titulo)}</legend><div class="estrellas">${[5, 4, 3, 2, 1].map(n => `<input type="radio" id="${nombre}${n}" name="${nombre}" value="${n}" required><label for="${nombre}${n}" aria-label="${n} de 5">★</label>`).join('')}</div><div class="estrellas-pie"><span>${esc(bajo)}</span><span>${esc(alto)}</span></div></fieldset>`;
    const tareaCierre = (E.tareas || []).find(t => String(t.tipo).indexOf('Cierre del turno') === 0 && t.estado !== 'hecha');
    const items = tareaCierre ? itemsDe(tareaCierre) : CIERRE_BASE;
    // Solo una pregunta de lo que faltó, la más importante: que el cierre siga siendo corto
    let preguntas = [];
    if (!D.hoy.consultas) preguntas.push(['consultas', 'Hoy no registraste consultas. ¿No vino nadie a averiguar por los servicios?']);
    if (!D.hoy.mensajes) preguntas.push(['mensajes', 'Hoy no registraste mensajes. ¿Qué pasó?']);
    // Cumplir la meta y tener pendientes no se contradice, pero leído así confunde: la pregunta lo dice (Emanuel, 09/11/2026)
    const cumplioMeta = D.hoy.meta && D.hoy.hechas >= D.hoy.meta;
    if (D.hoy.pendientes) preguntas.push(['pendientes', cumplioMeta
      ? `Cumpliste tu meta de hoy: ${D.hoy.hechas} de ${D.hoy.meta}. ¡Bien ahí! La meta es lo mínimo del día, no toda la lista, así que igual ${D.hoy.pendientes === 1 ? 'quedó 1 tarea sin hacer' : `quedaron ${D.hoy.pendientes} tareas sin hacer`}. ¿Qué pasó con esas?`
      : `Te ${D.hoy.pendientes === 1 ? 'quedó 1 tarea pendiente' : `quedaron ${D.hoy.pendientes} tareas pendientes`}. ¿Por qué motivo?`]);
    preguntas = preguntas.slice(-1);
    dialogo(`<h3>Cierre de turno</h3>
      <form class="marca-form" style="border:0;padding:0">
        <div class="campo-titulo">Antes de irte, tildá lo que ya hiciste</div>
        ${checklistHtml(items)}
        ${estrellas('animo', '¿Cómo te sentiste en tu día?', 'Muy mal', 'Muy bien')}
        ${estrellas(delDia.nota.clave, delDia.nota.titulo, delDia.nota.bajo, delDia.nota.alto)}
        <label class="campo">${esc(delDia.abierta)} <span class="opcional">(opcional)</span><textarea name="lo_mejor" maxlength="300"></textarea></label>
        ${preguntas.map(([k, t]) => `<label class="campo pregunta">${esc(t)}<textarea name="r_${k}" maxlength="300" required></textarea></label>`).join('')}
        <label class="campo">Algo más que quieras contar <span class="opcional">(opcional)</span><textarea name="comentario" maxlength="400"></textarea></label>
        <p class="aclara" style="margin:0">Lo lee coordinación: sirve para ayudarte y para mejorar el club, no para retarte.</p>
        <div class="botones"><button class="boton verde">Enviar</button><button type="button" class="boton claro" data-ir>Primero completo lo que falta</button></div>
      </form>`, d => {
      const form = d.querySelector('form');
      const claveBorrador = 'pulso_cierre_' + cliente.sesion().nombre + '_' + E.hoy;
      restaurarBorrador(form, claveBorrador);
      form.addEventListener('input', () => guardarBorrador(form, claveBorrador));
      form.addEventListener('change', () => guardarBorrador(form, claveBorrador));
      const salir = () => { guardarBorrador(form, claveBorrador); E.cierrePospuesto = Date.now() + 10 * 60000; d.close(); };
      d.querySelector('[data-ir]').onclick = salir;
      d.addEventListener('cancel', ev => { ev.preventDefault(); salir(); });   // Escape
      d.addEventListener('click', ev => { if (tocoAfuera(ev, d)) salir(); });
      form.onsubmit = async ev => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const respuestas = {};
        preguntas.forEach(([k]) => { respuestas[k] = String(f.get('r_' + k)).trim(); });
        const sinTildar = [...ev.target.querySelectorAll('[data-check]')].filter(c => !c.checked).map(c => c.dataset.check);
        const comentario = String(f.get('comentario') || '').trim();
        if (sinTildar.length && !comentario) { aviso('Tildá todo el checklist, o contá en el comentario por qué algo quedó sin hacer.', true); return; }
        if (sinTildar.length) respuestas.checklist = 'Sin hacer: ' + sinTildar.join(', ');
        const btn = ev.target.querySelector('button');
        btn.disabled = true;
        try {
          await cliente.llamar('cierre_guardar', { animo: Number(f.get('animo')), [delDia.nota.clave]: Number(f.get(delDia.nota.clave)), lo_mejor: String(f.get('lo_mejor') || '').trim(), pregunta: delDia.abierta, respuestas, comentario: String(f.get('comentario') || '').trim() });
          D.cierre_hecho = true;
          try { almacenSeguro().removeItem(claveBorrador); } catch (e) { /* sin almacenamiento no hay borrador */ }
          if (tareaCierre) {
            await cliente.marcar({ tarea_id: tareaCierre.id, abierta_en: new Date().toISOString(), canal: 'PR', resultado: 'HECHO', fecha: '', detalle: respuestas.checklist || '' });
            tareaCierre.estado = 'hecha';
            tareaCierre.resultado_local = 'Checklist hecho';
          }
          d.close();
          render();
          revisarLogros();
          const dia = Number(f.get('animo'));
          // Si cumplió la meta, el cierre termina felicitando: es lo último que ve del día (Emanuel, 09/11/2026)
          if (cumplioMeta) papelitos();
          dialogoCerrarApp((cumplioMeta ? `¡Cumpliste tu meta de hoy: ${D.hoy.hechas} de ${D.hoy.meta}! ` : '') + (dia >= 4 ? '¡Gracias por contarlo! 🙌 Qué bueno que fue un buen día.' : dia <= 2 ? 'Gracias por contarlo. Coordinación lo va a ver para ayudarte.' : '¡Gracias por contarlo!'));
        } catch (e) { btn.disabled = false; falla(e); }
      };
    });
  }

  // Avisos personalizados durante el turno, como mucho uno cada 20 minutos
  const CADA_AVISO_MS = 20 * 60000;

  // Registro por minuto del uso de la app. Se manda cada 5 minutos: si no hay red, queda guardado y va después.
  let ultimaInteraccion = Date.now();
  ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { ultimaInteraccion = Date.now(); }, { passive: true, capture: true }));
  const MINUTOS_GRACIA_USO = 3;
  const claveUso = () => 'pulso_uso_' + cliente.sesion().nombre;
  function tomarMinutoDeUso() {
    if (!cliente.sesion() || !tiene('recepcion')) return;
    const iso = new Date(Date.now() - 3 * 3600000).toISOString();
    const fecha = iso.slice(0, 10), minuto = Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
    const alm = almacenSeguro();
    let q = {};
    try { q = JSON.parse(alm.getItem(claveUso()) || '{}'); } catch (e) { q = {}; }
    const d = q[fecha] = q[fecha] || { activos: [], quieta: [], otra: [] };
    const lista = (document.hidden || !document.hasFocus()) ? (Date.now() - ultimaInteraccion < 60000 ? d.activos : d.otra) : (Date.now() - ultimaInteraccion <= MINUTOS_GRACIA_USO * 60000 ? d.activos : d.quieta);
    if (lista.indexOf(minuto) < 0) lista.push(minuto);
    alm.setItem(claveUso(), JSON.stringify(q));
  }
  async function enviarUso() {
    if (!cliente.sesion() || !tiene('recepcion')) return;
    const clave = claveUso(), alm = almacenSeguro();
    let q = {};
    try { q = JSON.parse(alm.getItem(clave) || '{}'); } catch (e) { return; }
    for (const fecha of Object.keys(q)) {
      try {
        await cliente.llamar('uso', Object.assign({ fecha: fecha }, q[fecha]));
      } catch (e) { return; }
      let ahora = {};
      try { ahora = JSON.parse(alm.getItem(clave) || '{}'); } catch (e) { ahora = {}; }
      const enviado = q[fecha], resto = ahora[fecha];
      if (resto) ['activos', 'quieta', 'otra'].forEach(k => { resto[k] = resto[k].filter(m => enviado[k].indexOf(m) < 0); });
      if (!resto || !(resto.activos.length + resto.quieta.length + resto.otra.length)) delete ahora[fecha];
      alm.setItem(clave, JSON.stringify(ahora));
    }
  }
  function revisarAvisos() {
    avisarVentas();
    const D = E.dia;
    if (!D || !cliente.sesion() || !tiene('recepcion') || !D.hora_fin || !D.hora_inicio) return;
    if (Date.now() - (E.ultimoAviso || 0) < CADA_AVISO_MS) return;
    const min = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const ahora = new Date();
    const clave = 'pulso_avisos_' + E.hoy;
    const alm = almacenSeguro();
    let enviados = {};
    try { enviados = JSON.parse(alm.getItem(clave) || '{}'); } catch (e) { enviados = {}; }
    const a = proximoAviso({
      nombre: cliente.sesion().nombre, minuto: ahora.getHours() * 60 + ahora.getMinutes(), inicio: min(D.hora_inicio), fin: min(D.hora_fin), hechas: D.hoy.hechas, pendientes: D.hoy.pendientes,
      nuevaMedalla: medallaNueva(D), diaSemana: ahora.getDay(), prioritarias: D.prioritarias, volvieron: D.volvieron, equipoHechas: D.equipo ? D.equipo.hechas : 0, equipoFaltan: D.equipo ? D.equipo.faltan : 0,
      minutosSinUso: (Date.now() - ultimaInteraccion) / 60000, enviados: enviados, siguiente: D.siguiente, ayer: D.ayer, racha: D.racha, adelantar: D.para_adelantar, idea: (D.ideas || [])[0], diasSinPlan: D.dias_sin_plan,
    });
    if (!a) return;
    enviados[a.clave] = 1;
    if (a.clave.indexOf('medalla-') === 0) alm.setItem('pulso_medalla_' + E.hoy.slice(0, 7) + '_' + a.clave.slice(8), '1');
    alm.setItem(clave, JSON.stringify(enviados));
    E.ultimoAviso = Date.now();
    push(a.titulo, a.cuerpo);
    aviso(a.titulo);
  }

  // Al irse hay que cerrar la app: la PC es compartida y la sesión no puede quedar abierta con su usuario
  function turnoTerminando() {
    const D = E.dia;
    if (!D || !tiene('recepcion') || !D.hora_fin) return !!(D && D.cierre_hecho);
    const ahora = new Date();
    const [h, m] = D.hora_fin.split(':').map(Number);
    return D.cierre_hecho || h * 60 + m - (ahora.getHours() * 60 + ahora.getMinutes()) <= 30;
  }

  function dialogoCerrarApp(mensaje) {
    dialogo(`<h3>Antes de irte 🚪</h3><p>${esc(mensaje)}</p><p>Cerrá la app para que nadie quede con tu usuario.</p>
      <button class="boton-cerrar-app" data-cerrar>🚪 Cerrar la app</button>
      <button type="button" class="boton claro ancho" data-sigo style="margin-top:8px">Todavía sigo acá</button>`, d => {
      d.querySelector('[data-cerrar]').onclick = () => { d.close(); cerrarApp(); };
      d.querySelector('[data-sigo]').onclick = () => { d.close(); render(); };
    });
  }

  // Muchos se iban sin hacer el cierre del turno, así que no se sale de largo: primero se lo recuerda (Emanuel, 09/11/2026).
  // No lo obliga: si de verdad tiene que irse, puede, pero tiene que decirlo a propósito.
  function faltaElCierre() {
    const D = E.dia;
    return !!(D && cliente.sesion() && tiene('recepcion') && !D.cierre_hecho);
  }

  // Pregunta cada vez que intenta irse, no una sola: irse sin cerrar tiene que costar un clic a propósito
  function recordarCierre(seguir) {
    dialogo(`<h3>Te falta la última tarea</h3>
      <p>Todavía no hiciste el <b>cierre del turno</b>: el checklist de antes de irte y las preguntas del día.</p>
      <p class="aclara">Son dos minutos y es lo que mira coordinación para saber cómo estuvo el día y en qué darte una mano.</p>
      <button class="boton verde ancho" data-ahora>Hacerlo ahora</button>
      <button type="button" class="boton claro ancho" data-igual style="margin-top:8px">Hoy no puedo, me voy igual</button>`, d => {
      d.querySelector('[data-ahora]').onclick = () => { d.close(); E.cierrePospuesto = 0; dialogoCierre(); };
      d.querySelector('[data-igual]').onclick = () => { d.close(); seguir(); };
    });
  }

  function salirDeLaApp() {
    if (cliente.pendientesDeEnvio() && !confirm('Hay marcas que todavía no se enviaron. Si salís, se pierden. ¿Salir igual?')) return false;
    enviarUso();
    cliente.cerrarSesion();
      Object.assign(E, { vista: null, tareas: null, sede: null, usuarios: null, abierta: null, personaDni: null, persona: null, rend: null, rendMes: null, rendDni: null, dia: null, adelantar: false, cierres: null, celebrado: {} });
    return true;
  }

  // El navegador solo deja cerrar solas algunas pestañas: si no se cierra, la sesión igual queda cerrada y se lo decimos
  function cerrarApp() {
    if (faltaElCierre()) return recordarCierre(cerrarApp);
    if (!salirDeLaApp()) return;
    E.mensajeLogin = '✅ Listo, cerraste tu turno. Ya podés cerrar esta pestaña. ¡Que descanses!';
    render();
    try { window.close(); } catch (e) { /* la pestaña sigue abierta */ }
  }

  // Medalla ganada que todavía no se le avisó en esta PC
  function medallaNueva(D) {
    const alm = almacenSeguro();
    return (D.medallas || []).find(m => m.ganada && !alm.getItem('pulso_medalla_' + E.hoy.slice(0, 7) + '_' + m.clave)) || null;
  }

  function revisarCierre() {
    const D = E.dia;
    if (!D || !D.hora_fin || !cliente.sesion() || !tiene('recepcion')) return;
    const ahora = new Date();
    const [h, m] = D.hora_fin.split(':').map(Number);
    const falta = h * 60 + m - (ahora.getHours() * 60 + ahora.getMinutes());
    if (falta <= 0 && falta > -120) {
      const alm = almacenSeguro(), c = 'pulso_fin_' + E.hoy;
      if (!alm.getItem(c)) { alm.setItem(c, '1'); push('🚪 Terminó tu turno', 'Acordate de cerrar PulsoMOVE antes de irte.'); render(); }
    }
    if (falta <= 30 && falta > 15) {
      const alm = almacenSeguro(), c = 'pulso_media_hora_' + E.hoy;
      if (!alm.getItem(c)) {
        alm.setItem(c, '1');
        const a = avisoMediaHora(cliente.sesion().nombre, D.hoy.pendientes, Number(E.hoy.slice(8, 10)));
        push(a.titulo, a.cuerpo);
        aviso(a.titulo + '. ' + a.cuerpo);
      }
    }
    if (D.cierre_hecho || Date.now() < E.cierrePospuesto) return;
    if (falta <= 15 && falta > -60) dialogoCierre();
  }

  function dialogoRegistrar(tipo) {
    const opciones = (lista) => lista.map(v => `<option>${esc(v)}</option>`).join('');
    const ORIGEN = ['Local', 'WhatsApp', 'Instagram', 'Recomendación', 'Ex socio'];
    const CATEGORIA = ['Bienvenida', 'Recordatorio de pago', 'Deuda', 'Promoción', 'Seguimiento', 'Encuesta', 'Felicitación', 'Información general'];
    dialogo(`<h3>Registrar</h3>
      <form class="marca-form" style="border:0;padding:0">
        <label class="campo">Qué hiciste<select name="tipo" required>
          <option value="mensaje">Mensaje a un socio, fuera de mis tareas</option><option value="consulta">Consulta de alguien interesado</option>
          <option value="encuesta">Encuesta de bienvenida o de baja a un socio</option>
          <option value="prueba">Día de prueba</option><option value="resena">Pedí una reseña de Google</option><option value="referido">Me pasaron un referido</option></select></label>
        <label class="campo">Nombre y apellido de la persona<input name="nombre" required></label>
        <label class="campo" data-solo="mensaje">Categoría<select name="categoria">${opciones(CATEGORIA)}</select></label>
        <label class="campo" data-solo="encuesta">Cuál le mandaste<select name="cual"><option value="Bienvenida">Encuesta de bienvenida</option><option value="Baja">Encuesta de baja</option></select></label>
        <label class="campo" data-solo="encuesta">¿Respondió tu mensaje antes?<select name="respondio"><option value="si">Sí, respondió</option><option value="no">Todavía no respondió</option></select></label>
        <p class="aclara" data-solo="encuesta" data-aviso-encuesta style="margin:0"><b>Mandala solo si el socio respondió tu mensaje.</b> Primero escribile con tus palabras: en la bienvenida, cómo viene y cómo se sintió; en la baja, por qué se va. Si no hubo respuesta, esperá: sin esa conversación casi nunca contesta la encuesta.</p>
        <label class="campo" data-solo="mensaje encuesta">Canal<select name="canal"><option value="AU">Audio</option><option value="MP">Mensaje personal</option><option value="LL">Llamada</option><option value="PR">En persona</option></select></label>
        <label class="campo" data-solo="consulta">Interés<select name="interes"><option value="alto">Alto: seguimiento hoy</option><option value="medio">Medio: seguimiento en 48 horas</option><option value="exploratorio">Exploratorio: seguimiento en una semana</option></select></label>
        <label class="campo" data-solo="consulta prueba referido">Cómo llegó<select name="origen">${opciones(ORIGEN)}</select></label>
        <label class="campo">Detalle <span class="opcional">(opcional)</span><textarea name="detalle" maxlength="300"></textarea></label>
        <p class="aclara" style="margin:0">Solo el nombre: el teléfono queda en el celular laboral.</p>
        <div class="botones"><button class="boton verde">Guardar</button><button type="button" class="boton claro" data-cerrar>Cancelar</button></div>
      </form>`, d => {
      const form = d.querySelector('form');
      const mostrar = () => d.querySelectorAll('[data-solo]').forEach(l => { l.hidden = l.dataset.solo.split(' ').indexOf(form.tipo.value) < 0; });
      // Si todavía no respondió, el aviso se marca: la encuesta va después de la conversación, no en lugar de ella (Emanuel, 10/11/2026)
      const aviso_enc = d.querySelector('[data-aviso-encuesta]');
      const marcarAviso = () => { aviso_enc.classList.toggle('alerta', form.respondio.value === 'no'); };
      form.tipo.onchange = mostrar;
      form.respondio.onchange = marcarAviso;
      if (tipo) form.tipo.value = tipo;
      mostrar();
      marcarAviso();
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      form.onsubmit = async ev => {
        ev.preventDefault();
        const f = new FormData(form);
        const datos = { id: (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()), tipo: f.get('tipo'), nombre: String(f.get('nombre')).trim(), detalle: String(f.get('detalle') || '').trim() };
        if (datos.tipo === 'mensaje') { datos.categoria = f.get('categoria'); datos.canal = f.get('canal'); }
        if (datos.tipo === 'encuesta') { datos.categoria = f.get('cual'); datos.canal = f.get('canal'); datos.respondio = f.get('respondio'); }
        if (datos.tipo === 'consulta') datos.interes = f.get('interes');
        if (['consulta', 'prueba', 'referido'].indexOf(datos.tipo) >= 0) datos.origen = f.get('origen');
        const btn = form.querySelector('button');
        btn.disabled = true;
        try {
          await cliente.llamar('registrar', datos);
          d.close();
          aviso(datos.tipo === 'consulta' ? 'Guardado. El seguimiento aparece en tus tareas cuando le toque.'
            : datos.tipo === 'encuesta' && datos.respondio === 'no' ? 'Guardado. La próxima vez, esperá a que responda antes de mandarla.' : 'Guardado.');
          E.rend = null;
          if (E.vista === 'mes') cargarVista();
        } catch (e) { btn.disabled = false; falla(e); }
      };
    });
  }

  // ---------- Lista de una persona, solo lectura ----------

  function vistaPersona() {
    const volver = '<div class="filtros"><button class="chip" data-accion="persona-volver">← Volver a la sede</button></div>';
    if (!E.persona) return volver + '<div class="cargando">Cargando su lista…</div>';
    const P = E.persona;
    const hechas = P.tareas.filter(t => t.estado === 'hecha').length;
    const tipos = [];
    P.tareas.forEach(t => { if (tipos.indexOf(t.tipo) < 0) tipos.push(t.tipo); });
    let i = 0;
    return `${volver}<h1 class="titulo">${esc(P.nombre)}</h1>
      <p class="bajada">${esc(SEDES[P.sede] || '')} · ${esc(TURNOS[P.turno] || '')} · ${esc(tituloDia(P.hoy))}. Ves su lista tal cual, sin poder marcar.</p>
      ${avance(hechas, P.tareas.length)}
      ${tipos.length ? tipos.map(tipo => {
        const lista = P.tareas.filter(t => t.tipo === tipo);
        return `<section class="grupo"><h2>${esc(tipo)} <span class="cuenta">${lista.length}</span></h2>${lista.map(t => tarjetaLectura(t, i++)).join('')}</section>`;
      }).join('') : '<div class="vacio">Sin tareas para hoy.</div>'}`;
  }

  // ---------- Planes de 3 meses o más: de quién es la venta ----------

  function bloqueVentasLargas(D) {
    const V = D.ventas_largas;
    if (!V || !(V.pedidos.length + V.espera.length + V.cobradas.length + V.de_la_sede.length)) return '';
    const fila = (texto, extra, acciones) => `<div class="venta-larga"><p>${texto}</p>${extra ? `<p class="aclara">${extra}</p>` : ''}<div class="botones">${acciones}</div></div>`;
    const pedidos = V.pedidos.map(v => fila(
      v.cobro_pide ? `<b>${esc(v.pide)}</b> cobró el ${esc(v.plan)} de <b>${esc(v.socio_nombre)}</b> y dice que lo vendiste vos. ¿Es así?` : `<b>${esc(v.pide)}</b> dice que vendió el ${esc(v.plan)} de <b>${esc(v.socio_nombre)}</b>, que cobraste vos. ¿Es así?`,
      v.cobro_pide ? '' : 'Si decís que no, deciden Lucía y Emanuel.',
      `<button class="boton verde" data-accion="venta-responder" data-id="${esc(v.id)}" data-si="1">Sí, aceptar</button><button class="boton claro" data-accion="venta-responder" data-id="${esc(v.id)}" data-si="">No</button>`)).join('');
    const opciones = v => V.companeros.map(c => `<option value="${esc(c.dni)}" ${c.dni === v.sugerido_dni ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
    const cobradas = V.cobradas.map(v => fila(
      `Cobraste el ${esc(v.plan)} de <b>${esc(v.socio_nombre)}</b> el ${ddmm(v.fecha)}. ¿Lo vendió otra persona?`,
      `${v.sugerido ? `💡 ${esc(v.sugerido)} habló con este socio hace poco. ` : ''}Si no hacés nada, la venta queda para vos.`,
      V.companeros.length ? `<select data-venta-dar="${esc(v.id)}" aria-label="Dar la venta a">${opciones(v)}</select><button class="boton claro" data-accion="venta-dar" data-id="${esc(v.id)}">Dársela</button>` : '')).join('');
    const sede = V.de_la_sede.map(v => fila(
      `${esc(v.nombre_cobro)} cobró el ${esc(v.plan)} de <b>${esc(v.socio_nombre)}</b> el ${ddmm(v.fecha)}.`,
      v.te_sugiere ? '💡 Hablaste con este socio hace poco.' : '',
      `<button class="boton claro" data-accion="venta-pedir" data-id="${esc(v.id)}">La vendí yo</button>`)).join('');
    const espera = V.espera.map(v => `<p class="aclara">⏳ ${esc(v.plan)} de ${esc(v.socio_nombre)}: ${v.estado === 'pedida' ? 'falta que responda ' + esc(v.responde) : 'lo deciden Lucía y Emanuel'}.</p>`).join('');
    return `<section class="ventas-largas"><b>🏆 Ventas para confirmar: planes de 3 meses e ingresos</b>${pedidos}${cobradas}${sede}${espera}</section>`;
  }

  // Lucía y Emanuel deciden; coordinación ve cómo quedó
  function bloqueVentasLargasSede(S) {
    const lista = S.ventas_largas || [];
    if (!lista.length) return '';
    const disputa = lista.filter(v => v.estado === 'disputa');
    const resto = lista.filter(v => v.estado === 'asignada' || v.estado === 'confirmada' || v.estado === 'pedida');
    const botones = v => (tiene('admin') ? `<div class="fila-accion"><button class="boton verde" data-accion="venta-decidir" data-id="${esc(v.id)}" data-dni="${esc(v.hacia_dni)}">Es de ${esc(v.nombre_hacia)}</button>${v.dni_cobro ? `<button class="boton claro" data-accion="venta-decidir" data-id="${esc(v.id)}" data-dni="${esc(v.dni_cobro)}">Es de ${esc(v.nombre_cobro)}</button>` : ''}</div>` : '');
    return `<section class="grupo"><h2>🏆 Planes de 3 meses o más <span class="cuenta">${lista.length}</span></h2>
      ${disputa.map(v => `<article class="tarjeta"><div class="cabeza" style="display:grid;gap:2px;padding:12px 14px"><span class="socio">${esc(v.socio_nombre)}</span><span class="profe">${esc(v.plan)} · cobró ${esc(v.nombre_cobro)} · lo pide ${esc(v.nombre_hacia)}</span><span class="situacion">No se pusieron de acuerdo: hay que decidir.</span></div>${botones(v)}</article>`).join('')}
      ${resto.length ? `<div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Día</th><th>Socio</th><th>Cobró</th><th>Quedó para</th></tr></thead><tbody>${resto.map(v => `<tr><td>${ddmm(v.fecha)}</td><td>${esc(v.socio_nombre)}</td><td>${esc(v.nombre_cobro)}</td><td>${v.estado === 'pedida' ? `⏳ falta que responda ${esc(v.nombre_responde)}` : esc(v.nombre_vendio)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </section>`;
  }

  const ventasAvisadas = {};
  function avisarVentas() {
    const V = E.dia && E.dia.ventas_largas;
    if (!V) return;
    V.pedidos.forEach(v => {
      if (ventasAvisadas[v.id]) return;
      ventasAvisadas[v.id] = true;
      push('Una venta para revisar', `${v.pide} te escribió por el ${v.plan} de ${v.socio_nombre}.`);
    });
  }

  // ---------- Ventas ----------

  const nro = v => Number(v) || 0;
  const productosDe = f => { try { return JSON.parse(f.productos || '{}'); } catch (e) { return {}; } };
  const CAMPOS_SUMA = ['planes', 'planes_monto', 'nuevos', 'renovaciones', 'largos', 'mostrador', 'mostrador_monto', 'efectivo', 'transferencia', 'mercadopago', 'otros_medios', 'sin_clasificar'];
  function sumarVentas(filas) {
    const t = { productos: {} };
    CAMPOS_SUMA.forEach(k => { t[k] = 0; });
    filas.forEach(f => {
      CAMPOS_SUMA.forEach(k => { t[k] += nro(f[k]); });
      const p = productosDe(f);
      Object.keys(p).forEach(n => { t.productos[n] = (t.productos[n] || 0) + nro(p[n]); });
    });
    return t;
  }
  // Las claves vienen como "Categoría|Producto"
  const partesVenta = k => { const i = String(k).indexOf('|'); return i < 0 ? ['Otros', String(k)] : [k.slice(0, i), k.slice(i + 1)]; };
  const rankingProductos = t => Object.keys(t.productos).map(k => [partesVenta(k)[1], t.productos[k], partesVenta(k)[0]]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const ORDEN_CATEGORIAS = ['Planes', 'Suplementos', 'Indumentaria', 'Bebidas', 'Barritas y snacks', 'Comida', 'Recovery', 'Servicios', 'Planes sueltos', 'Otros'];
  function porCategoria(t) {
    const m = {};
    rankingProductos(t).forEach(([n, c, cat]) => { (m[cat] = m[cat] || { total: 0, items: [] }).total += c; m[cat].items.push([n, c]); });
    return Object.keys(m).sort((a, b) => (ORDEN_CATEGORIAS.indexOf(a) + 1 || 99) - (ORDEN_CATEGORIAS.indexOf(b) + 1 || 99)).map(cat => [cat, m[cat]]);
  }
  function queVendio(t) {
    const partes = [];
    if (t.renovaciones) partes.push(t.renovaciones + (t.renovaciones === 1 ? ' renovación' : ' renovaciones'));
    if (t.nuevos) partes.push(t.nuevos + (t.nuevos === 1 ? ' socio nuevo' : ' socios nuevos'));
    const planes = rankingProductos(t).filter(x => x[2] === 'Planes' && /meses$/.test(x[0])).map(([n, c]) => `${c} de ${n}`);
    return partes.concat(planes, rankingProductos(t).filter(x => x[2] !== 'Planes').map(([n, c]) => `${c} ${n}`)).join(' · ') || 'Sin ventas';
  }
  function barrasProductos(t) {
    const cats = porCategoria(t);
    if (!cats.length) return '<div class="vacio">Sin ventas en este período.</div>';
    const max = Math.max(...cats.map(x => x[1].total));
    return `<div class="ranking-ventas">${cats.map(([cat, x]) => `<div class="categoria-venta"><div class="fila-venta"><b class="nombre-cat">${esc(cat)}</b><div class="medidor"><i class="bien" style="width:${Math.round(x.total / max * 100)}%"></i></div><b>${x.total}</b></div><p class="detalle-cat">${x.items.map(([n, c]) => `${esc(n)} ${c}`).join(' · ')}</p></div>`).join('')}</div>`;
  }
  const PERIODOS_VENTA = [['ayer', 'Último día'], ['semana', '7 días'], ['mes', 'Este mes'], ['pasado', 'Mes pasado']];
  function filtrarPeriodo(filas, hoy, periodo) {
    const mes = hoy.slice(0, 7);
    if (periodo === 'mes') return filas.filter(f => String(f.fecha).indexOf(mes) === 0);
    if (periodo === 'pasado') {
      const d = new Date(mes + '-01T12:00:00Z');
      d.setUTCMonth(d.getUTCMonth() - 1);
      const ant = d.toISOString().slice(0, 7);
      return filas.filter(f => String(f.fecha).indexOf(ant) === 0);
    }
    if (periodo === 'ayer') {
      const ult = filas.map(f => String(f.fecha)).sort().pop();
      return filas.filter(f => String(f.fecha) === ult);
    }
    const d = new Date(hoy + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 7);
    const desde = d.toISOString().slice(0, 10);
    return filas.filter(f => String(f.fecha) >= desde);
  }
  // Coordinación: todo lo que pasó por las cajas de la sede
  function bloqueVentas(S) {
    const todas = S.ventas || [];
    if (!todas.length) return '';
    const periodo = E.ventasPeriodo || 'mes';
    const filas = filtrarPeriodo(todas, S.hoy, periodo);
    const t = sumarVentas(filas);
    const dato = (n, val, sub) => `<div class="dato"><strong>${val}</strong><span>${esc(n)}</span>${sub ? `<em>${esc(sub)}</em>` : ''}</div>`;
    const grupo = clave => { const m = {}; filas.forEach(f => { (m[f[clave]] = m[f[clave]] || []).push(f); }); return m; };
    const porPersona = grupo('nombre'), porDia = grupo('fecha');
    const personas = Object.keys(porPersona).map(n => [n, sumarVentas(porPersona[n])]).sort((a, b) => (b[1].planes_monto + b[1].mostrador_monto) - (a[1].planes_monto + a[1].mostrador_monto));
    const dias = Object.keys(porDia).sort().reverse().slice(0, 31);
    return `<section class="grupo"><h2>💰 Ventas de la sede</h2>
      <div class="filtros">${PERIODOS_VENTA.map(([k, n]) => `<button class="chip" data-accion="ventas-periodo" data-p="${k}" aria-pressed="${periodo === k}">${n}</button>`).join('')}</div>
      <section class="bloque"><div class="datos">
        ${dato('Entró en total', plata(t.planes_monto + t.mostrador_monto))}
        ${dato('Por planes', plata(t.planes_monto), t.planes + ' cobros')}
        ${dato('Por mostrador', plata(t.mostrador_monto), t.mostrador + ' ventas')}
        ${dato('Renovaciones', t.renovaciones)}${dato('Socios nuevos', t.nuevos)}${dato('Planes de 3 meses o más', t.largos)}
        ${dato('Efectivo', plata(t.efectivo))}${dato('Transferencia', plata(t.transferencia))}${dato('Mercado Pago', plata(t.mercadopago))}${dato('Tarjeta', plata(t.otros_medios))}
      </div></section>
      <div class="tablero-columnas">
        <section class="bloque"><div class="bloque-cab"><h2>Qué se vendió</h2></div>${barrasProductos(t)}${t.sin_clasificar ? `<p class="aclara">${t.sin_clasificar} ventas con un texto que no se pudo reconocer en la caja.</p>` : ''}</section>
        <section class="bloque"><div class="bloque-cab"><h2>Por persona</h2></div><div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Quién</th><th>Planes</th><th>Renov.</th><th>Mostrador</th><th>Total</th></tr></thead><tbody>${personas.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="num">${x.planes}</td><td class="num">${x.renovaciones}</td><td class="num">${x.mostrador}</td><td class="num"><b>${plata(x.planes_monto + x.mostrador_monto)}</b></td></tr>`).join('')}</tbody></table></div></section>
      </div>
      <section class="bloque"><div class="bloque-cab"><h2>Día por día</h2></div><div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Día</th><th>Entró</th><th>Qué se vendió</th></tr></thead><tbody>${dias.map(d => { const x = sumarVentas(porDia[d]); return `<tr><td>${ddmm(d)}</td><td class="num"><b>${plata(x.planes_monto + x.mostrador_monto)}</b></td><td>${esc(queVendio(x))}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="aclara">Sale de las cajas de MOVE y se actualiza cada mañana. Cada venta cuenta para quien abrió esa caja. Para que se reconozca, hay que escribir en la caja qué se vendió.</p></section></section>`;
  }
  // Lo que vendió cada persona, día por día. En su propia vista no hay plata: el backend no la manda.
  function bloqueVentasPersona(p) {
    const filas = (p.ventas_dias || []).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    if (!filas.length) return '';
    const t = sumarVentas(filas);
    return `<section class="bloque"><div class="bloque-cab"><h2>🛍️ Lo que se vendió en tu caja</h2></div>
      <div class="datos"><div class="dato"><strong>${t.renovaciones}</strong><span>Renovaciones</span></div><div class="dato"><strong>${t.nuevos}</strong><span>Socios nuevos</span></div><div class="dato"><strong>${t.largos}</strong><span>Planes de 3 meses o más</span></div><div class="dato"><strong>${t.mostrador}</strong><span>Ventas de mostrador</span></div></div>
      ${barrasProductos(t)}
      <div class="dias-venta">${filas.map(f => `<div class="dia-venta"><b>${ddmm(f.fecha)}</b><span>${esc(queVendio(sumarVentas([f])))}</span></div>`).join('')}</div></section>`;
  }

  // ---------- Sede ----------

  function bloqueStock(S) {
    const lista = (S.stock || []).filter(f => f.sede === S.sede);
    if (!lista.length) return '';
    return `<details class="grupo"><summary><h2>📦 Stock</h2></summary><div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Sede</th><th>Producto</th><th>Hay</th><th>Contó</th><th>Fecha</th></tr></thead><tbody>${lista.map(f => `<tr><td>${esc(SEDES[f.sede] || f.sede)}</td><td>${esc(f.producto)}</td><td class="num"><b>${esc(f.cantidad)}</b></td><td>${esc(f.nombre)}</td><td>${ddmm(f.fecha)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }

  // Solo llegan a Lucía y Emanuel
  function bloqueBeneficios(S) {
    const lista = S.beneficios || [];
    if (!lista.length) return '';
    const fila = b => `<article class="tarjeta"><div class="cabeza" style="display:grid;gap:2px;padding:12px 14px">
        <span class="socio">${esc(b.socio_nombre)}</span>
        <span class="profe">${b.tipo === 'referido' ? `Trajo a ${esc(b.nuevo_socio)}: en su próxima renovación de 3 meses paga 2` : `Constancia: ${esc(b.detalle)}`} · ${esc(SEDES[b.sede] || b.sede)}${b.detalle && b.tipo === 'referido' ? ' · ' + esc(b.detalle) : ''}</span>
        ${b.estado === 'aprobada' ? '<span class="situacion">Autorizado: falta crear el cupón en MOVE</span>' : ''}</div>
        <div class="fila-accion">${b.estado === 'pendiente'
    ? `<button class="boton verde" data-accion="beneficio" data-id="${esc(b.id)}" data-estado="aprobada">Autorizar</button><button class="boton claro" data-accion="beneficio" data-id="${esc(b.id)}" data-estado="rechazada">Rechazar</button>`
    : `<button class="boton verde" data-accion="beneficio" data-id="${esc(b.id)}" data-estado="aplicada">Cupón creado en MOVE</button>`}</div></article>`;
    return `<section class="grupo"><h2>🎁 Reconocimientos para autorizar <span class="cuenta">${lista.length}</span></h2>${lista.map(fila).join('')}</section>`;
  }

  function vistaSede() {
    if (E.personaDni) return vistaPersona();
    const selector = tiene('admin') ? `<div class="filtros">${Object.keys(SEDES).map(k => `<button class="chip" data-accion="sede-elegir" data-s="${k}" aria-pressed="${E.sedeElegida === k}">${SEDES[k]}</button>`).join('')}</div>` : '';
    if (!E.sede) return selector + '<div class="cargando">Cargando la sede…</div>';
    const S = E.sede;
    const nombre = dni => (S.personas.find(p => p.dni === dni) || {}).nombre || 'Otra persona';
    const aclaracion = '<p class="bajada">“Le quedan hoy” son las de hoy y las que arrastra de días anteriores. “Próximos días” son las del resto de la semana, que todavía no le tocan.</p>';
    const personas = S.personas.length ? aclaracion + `<div class="personas">${S.personas.map(p => `<div class="persona ${p.en_vivo ? 'vivo-' + esc(p.en_vivo.color) : ''}"><b>${esc(p.nombre)}</b><span class="turno">${esc(TURNOS[p.turno] || '')}</span>${p.en_vivo ? `<span class="en-vivo">${p.en_vivo.color === 'rojo' ? '🔴' : p.en_vivo.color === 'verde' ? '🟢' : '⚪'} ${esc(p.en_vivo.texto)}</span>` : ''}${p.uso_hoy && p.uso_hoy.con_senal ? `<span class="uso-hoy">Hoy: ${horas(p.uso_hoy.activo)} usando la app · ${horas(p.uso_hoy.completando)} completando</span>` : ''}
        <div class="cifras"><div class="${p.meta && p.hechas_hoy >= p.meta ? 'bien' : ''}"><strong>${p.hechas_hoy}${p.meta ? '/' + p.meta : ''}</strong><span>Hechas hoy${p.meta ? ' · meta' : ''}</span></div><div class="${p.pendientes_hoy > 15 ? 'mal' : ''}"><strong>${p.pendientes_hoy}</strong><span>Le quedan hoy</span></div><div><strong>${p.hechas_semana}</strong><span>Hechas esta semana</span></div><div><strong>${p.proximos_dias}</strong><span>Próximos días</span></div></div>
        ${p.atrasadas ? `<span class="aclara">De lo que le queda hoy, ${p.atrasadas === 1 ? '1 viene atrasada de días anteriores' : p.atrasadas + ' vienen atrasadas de días anteriores'}.</span>` : ''}
        <button class="chip ver-lista" data-accion="ver-persona" data-dni="${esc(p.dni)}">Ver su lista</button></div>`).join('')}</div>`
      : '<div class="vacio">No hay recepcionistas cargados en esta sede.</div>';
    const alertas = S.alertas.length ? S.alertas.map((t, i) => `<article class="tarjeta" style="--i:${i}">
        <div class="cabeza" style="display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:12px 14px">
          <span class="socio">${esc(t.socio_nombre)}</span><span class="estado atrasada">${t.dias_pendiente} días</span>
          <span class="profe">${esc(t.tipo)} · tiene ${esc(t.asignado_nombre || nombre(t.asignado_dni))}</span>
          <span class="accion">${conLinks(t.accion)}</span></div>
        <div class="fila-accion"><select data-reasignar="${esc(t.id)}" aria-label="Pasar a">${S.personas.filter(p => p.dni !== t.asignado_dni).map(p => `<option value="${esc(p.dni)}">Pasar a ${esc(p.nombre)}</option>`).join('')}</select>
          <button class="boton claro" data-accion="reasignar" data-id="${esc(t.id)}">Reasignar</button></div></article>`).join('')
      : '<div class="vacio">Sin tareas atrasadas. Todo al día.</div>';
    const garantias = S.garantias.length ? S.garantias.map(g => `<article class="tarjeta">
        <div class="cabeza" style="display:grid;gap:2px;padding:12px 14px"><span class="socio">${esc(g.socio_nombre)}</span>
          <span class="profe">Profe: ${esc(g.profe || '—')} · registró ${esc(nombre(g.registra_dni))} el ${ddmm(g.ts.slice(0, 10))}</span>
          <span class="situacion">“${esc(g.motivo)}”</span></div>
        <div class="fila-accion"><input data-comentario="${esc(g.id)}" placeholder="Comentario (opcional)">
          <button class="boton verde" data-accion="decidir" data-id="${esc(g.id)}" data-estado="aprobada">Regalar el mes siguiente</button>
          <button class="boton claro" data-accion="decidir" data-id="${esc(g.id)}" data-estado="rechazada">Rechazar</button></div></article>`).join('')
      : '<div class="vacio">No hay pedidos de garantía pendientes.</div>';
    return `${selector}<h1 class="titulo">${esc(SEDES[S.sede])} <span>·</span> ${esc(tituloDia(S.hoy))}</h1>
      <p class="bajada">Avance del equipo, ventas, tareas atrasadas y pedidos de garantía.</p>
      ${S.personas.some(p => p.en_vivo && p.en_vivo.color === 'rojo') ? `<div class="alerta-roja">🔴 Para mirar: ${S.personas.filter(p => p.en_vivo && p.en_vivo.color === 'rojo').map(p => esc(p.nombre.split(' ')[0])).join(', ')}</div>` : ''}
      ${bloqueBeneficios(S)}
      ${personas}
      ${bloqueVentasLargasSede(S)}
      ${bloqueVentas(S)}
      ${bloqueStock(S)}
      <section class="grupo"><h2>Atrasadas, 2 días o más <span class="cuenta">${S.alertas.length}</span></h2>${alertas}</section>
      <section class="grupo"><h2>Garantía de atención <span class="cuenta">${S.garantias.length}</span></h2><div class="frase">${esc(FRASE_GARANTIA)}</div><p class="bajada" style="margin-top:8px">Se regala el mes siguiente. Decide el responsable de sede.</p>${garantias}</section>`;
  }

  // ---------- Equipo (admin) ----------

  function vistaAdmin() {
    if (!E.usuarios) return '<div class="cargando">Cargando el equipo…</div>';
    const filas = E.usuarios.map(u => `<tr>
      <td><b>${esc(u.nombre)}</b><br><span class="profe">${esc(SEDES[u.sede] || u.sede)} · ${esc(TURNOS[u.turno] || u.turno)}</span></td>
      <td>${esc(u.roles.join(', '))}</td>
      <td>${u.activo ? (u.bloqueado ? '<span class="estado atrasada">Bloqueado</span>' : '<span class="estado hecha">Activo</span>') : '<span class="estado">Inactivo</span>'}</td>
      <td style="white-space:nowrap"><button class="boton claro" data-accion="nuevo-pin" data-dni="${esc(u.dni)}" data-nombre="${esc(u.nombre)}">Nuevo PIN</button>
        <button class="boton claro" data-accion="activo" data-dni="${esc(u.dni)}" data-activo="${u.activo ? '0' : '1'}">${u.activo ? 'Desactivar' : 'Activar'}</button></td></tr>`).join('');
    return `<h1 class="titulo">Equipo <span>·</span> ${E.usuarios.length}</h1>
      <p class="bajada">El PIN nuevo se muestra una sola vez: anotalo y entregáselo a la persona. En su primer ingreso lo cambia.</p>
      <div class="envoltura-tabla"><table class="tabla"><thead><tr><th>Persona</th><th>Roles</th><th>Estado</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }

  // ---------- Diálogos ----------

  function dialogo(html, alAbrir) {
    const d = document.createElement('dialog');
    d.innerHTML = `<div class="dentro">${html}</div>`;
    document.body.appendChild(d);
    const cerrarNativo = d.close.bind(d);
    d.close = () => { cerrarNativo(); d.remove(); };
    d.showModal();
    if (alAbrir) alAbrir(d);
    return d;
  }

  // Aviso de que desde el lunes 09/11 se miden las estadísticas. Se marca como visto y no vuelve.
  function cartelInicio(clave) {
    if (document.querySelector('dialog')) return;
    dialogo(`<h3>Desde el lunes 9/11 empezamos a medir</h3>
      <p>La primera semana fue de práctica: tus estadísticas empiezan de cero el lunes y nada de la práctica cuenta en tu contra.</p>
      <p><b>Lo importante, todos los días:</b></p>
      <ul>
        <li>Hacé el checklist de apertura al llegar y el de cierre antes de irte.</li>
        <li>Cumplí todas las tareas del día: es lo que más ayuda a los socios y a MOVE.</li>
        <li>Si alguna no pudiste hacerla, contá por qué en el cierre del turno.</li>
      </ul>
      <label class="visto"><input type="checkbox" id="cartel-visto"> Lo leí y lo entendí</label>
      <div class="botones"><button class="boton" id="cartel-ok" disabled>Listo</button></div>`, d => {
      const caja = d.querySelector('#cartel-visto'), boton = d.querySelector('#cartel-ok');
      caja.addEventListener('change', () => { boton.disabled = !caja.checked; });
      boton.addEventListener('click', async () => {
        boton.disabled = true;
        try { await cliente.llamar('aviso_visto', { clave: clave }); if (E.dia && E.dia.cartel) E.dia.cartel.visto = true; d.close(); }
        catch (e) { boton.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
      });
      d.addEventListener('cancel', ev => ev.preventDefault());
    });
  }

  function dialogoGarantia() {
    const nombres = (E.tareas || []).map(t => t.socio_nombre);
    dialogo(`<h3>Pedido de garantía</h3>
      <div class="frase">${esc(FRASE_GARANTIA)}</div>
      <p class="bajada" style="margin:0">Recepción solo registra el pedido. Decide el responsable de sede.</p>
      <form data-form="garantia" class="marca-form" style="border:0;padding:0">
        <label class="campo">Socio<input name="socio" list="lista-socios" required></label>
        <datalist id="lista-socios">${nombres.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <label class="campo">Profe<input name="profe"></label>
        <label class="campo">Qué pasó<textarea name="motivo" required placeholder="Con las palabras del socio"></textarea></label>
        <div class="botones"><button class="boton verde">Registrar</button><button type="button" class="boton claro" data-cerrar>Cancelar</button></div>
      </form>`, d => {
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      d.querySelector('form').onsubmit = async ev => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const socio = String(f.get('socio')).trim();
        const t = (E.tareas || []).find(x => x.socio_nombre === socio);
        const btn = ev.target.querySelector('button');
        btn.disabled = true;
        try {
          await cliente.llamar('garantia_crear', { socio_id: t ? t.socio_id : '', socio_nombre: socio, profe: String(f.get('profe') || (t ? t.profe : '')).trim(), motivo: String(f.get('motivo')).trim() });
          d.close();
          aviso('Pedido registrado. Le llega al responsable de sede.');
        } catch (e) { btn.disabled = false; falla(e); }
      };
    });
  }

  function dialogoTrajoSocio() {
    const nombres = (E.tareas || []).map(t => t.socio_nombre);
    dialogo(`<h3>🎁 Un socio trajo a un socio nuevo</h3>
      <p class="bajada" style="margin:0">Cuando renueve con un plan de 3 meses, paga 2. Lo autorizan Lucía y Emanuel.</p>
      <form data-form="trajo" class="marca-form" style="border:0;padding:0">
        <label class="campo">Nombre y apellido del socio que lo trajo<input name="socio" list="lista-socios" required></label>
        <datalist id="lista-socios">${nombres.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <label class="campo">Nombre y apellido del socio nuevo<input name="nuevo" required></label>
        <label class="campo">Detalle <span class="opcional">(opcional)</span><textarea name="detalle" maxlength="300"></textarea></label>
        <div class="botones"><button class="boton verde">Registrar</button><button type="button" class="boton claro" data-cerrar>Cancelar</button></div>
      </form>`, d => {
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      d.querySelector('form').onsubmit = async ev => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const socio = String(f.get('socio')).trim(), nuevo = String(f.get('nuevo')).trim();
        if (socio.split(/\s+/).length < 2 || nuevo.split(/\s+/).length < 2) { aviso('Hace falta nombre y apellido de los dos.', true); return; }
        const btn = ev.target.querySelector('button');
        btn.disabled = true;
        try {
          await cliente.llamar('beneficio_crear', { socio_nombre: socio, nuevo_socio: nuevo, detalle: String(f.get('detalle') || '').trim() });
          d.close();
          aviso('Registrado. Les llega a Lucía y Emanuel para autorizarlo.');
        } catch (e) { btn.disabled = false; falla(e); }
      };
    });
  }

  // ---------- Carga de datos ----------

  // Si le cambiaron los permisos con la sesión abierta, las pestañas se ponen al día solas
  function actualizarRoles(roles) {
    const s = cliente.sesion();
    if (s && roles && roles.join() !== (s.roles || []).join()) cliente.guardarSesion(Object.assign(s, { roles: roles }));
  }

  // Si una pantalla no pudo cargar por una demora, se vuelve a pedir sola, cada vez más espaciado.
  const REINTENTABLES = ['red', 'ocupado', 'demora', 'interno'];
  let relojVista = null, fallasVista = 0;
  function programarReintentoVista() {
    fallasVista++;
    relojVista = setTimeout(() => {
      if (!cliente.sesion()) return;
      if (E.abierta || document.querySelector('dialog')) { programarReintentoVista(); return; }   // no pisar lo que se está escribiendo
      cargarVista();
    }, Math.min(15000 * fallasVista, 60000));
  }

  async function cargarVista() {
    clearTimeout(relojVista);
    revisarFichajes();
    E.errorCarga = '';
    try {
      if (E.vista === 'hoy') {
        const r = await cliente.llamar('mis_tareas', E.adelantar ? { adelantar: true } : {});
        E.paraAdelantar = r.para_adelantar || 0;
        E.dia = await cliente.llamar('mi_dia');
        actualizarRoles(E.dia.roles);
        if (E.dia.cartel && !E.dia.cartel.visto) cartelInicio(E.dia.cartel.clave);
        if (!E.ultimaMarca) E.ultimaMarca = Date.now();
        saludarUnaVez();
        revisarAvisos();
        const locales = {};
        (E.tareas || []).forEach(t => { if (t.resultado_local) locales[t.id] = t.resultado_local; });
        E.hoy = r.hoy;
        E.tareas = r.tareas.map(t => Object.assign(t, locales[t.id] ? { resultado_local: locales[t.id] } : {}));
      } else if (E.vista === 'sede' && E.personaDni) {
        E.persona = await cliente.llamar('tareas_de', { dni: E.personaDni });
      } else if (E.vista === 'sede') {
        E.sede = await cliente.llamar('sede', tiene('admin') ? { sede: E.sedeElegida } : {});
      } else if (E.vista === 'mes') {
        E.rend = await cliente.llamar('rendimiento', Object.assign(E.rendMes ? { mes: E.rendMes } : {}, tiene('admin') ? { sede: cliente.sesion().sede } : {}));
      } else if (E.vista === 'rend') {
        cliente.llamar('cierres_ver').then(c => { E.cierres = c.cierres; E.cierresResumen = c.resumen; if (E.vista === 'rend' && !E.rendDni) render(); }).catch(() => {});
        cliente.llamar('profes_ver', tiene('admin') ? { sede: E.sedeElegida } : {}).then(c => { E.profes = c.filas; if (E.vista === 'rend' && !E.rendDni) render(); }).catch(() => {});
        E.rend = await cliente.llamar('rendimiento', Object.assign(E.rendMes ? { mes: E.rendMes } : {}, tiene('admin') ? { sede: E.sedeElegida } : {}));
      } else if (E.vista === 'chat') {
        await cargarChat();
        render();
      } else if (E.vista === 'reservas') {
        E.ocupacion = await cliente.llamar('ocupacion_ver', tiene('admin') || tiene('coordinador') ? { sede: E.sedeElegida } : {});
      } else if (E.vista === 'planes' || E.vista === 'profes' || E.vista === 'pmes') {
        E.planes = await cliente.llamar('profe_tareas', E.vista === 'profes' && tiene('admin') ? { sede: E.sedeElegida } : {});
        if (E.vista === 'planes') programarConsejos();
      } else if (E.vista === 'admin') {
        E.usuarios = await cliente.llamar('usuarios_listar');
      }
      fallasVista = 0;
    } catch (e) {
      if (e && e.codigo !== 'sin_sesion') E.errorCarga = e.message;
      const reintenta = e && REINTENTABLES.indexOf(e.codigo) >= 0;
      if (!reintenta || !fallasVista) falla(e);   // el cartel una sola vez, no en cada reintento
      if (reintenta) programarReintentoVista();
    }
    render();
  }

  function saludarUnaVez() {
    const k = 'pulso_saludo_' + E.hoy;
    const alm = almacenSeguro();
    if (DEMO || alm.getItem(k)) return;
    alm.setItem(k, '1');
    const primero = E.dia.coach[0];
    push(E.dia.saludo, primero ? primero.texto : '');
  }

  function irA(vista) {
    E.vista = vista;
    E.chatAbierta = null; E.chatConv = null; E.chatNuevo = false; E.chatSumar = false; E.chatBorrador = '';
    E.abierta = null;
    E.personaDni = null;
    E.persona = null;
    E.rend = null;
    E.rendDni = null;
    E.planes = null;
    E.profeVer = null;
    render();
    cargarVista();
  }

  // ---------- Render ----------

  // Fichaje en vivo: primera acción de recepción. Se va solo cuando MOVE muestra el QR.
  const tituloFichaje = f => (f.propia ? `${cliente.sesion().nombre.split(' ')[0]}, recordá fichar tu ${f.momento}` : `Recordale a ${f.persona} que fiche su ${f.momento}`);
  function bandaFichajes() {
    const F = E.fichajes || { filas: [], detenido: '' };
    const fila = f => `<div class="fichaje${f.urgente ? ' urgente' : ''}"><div><b>${f.urgente ? '🔴 ' : ''}${esc(tituloFichaje(f))}</b>
      <span>${f.momento === 'entrada' ? 'Empezaba' : 'Terminaba'} a las ${esc(f.hora)}. ${f.propia ? 'Escaneá el QR.' : f.urgente ? 'Todavía no escaneó el QR.' : `Se lo recordaste a las ${horaLocal(f.recordado)}: esperando el QR.`}</span></div>
      ${f.propia ? '' : `<div class="fichaje-botones">${f.urgente ? `<button class="boton" data-accion="fichaje" data-que="recordado" data-id="${esc(f.id)}">Ya se lo recordé</button>` : ''}<button class="boton claro" data-accion="fichaje" data-que="no_viene" data-id="${esc(f.id)}">${f.momento === 'entrada' ? 'Hoy no viene' : 'Ya se fue'}</button></div>`}</div>`;
    return `<section id="banda-fichajes" class="fichajes">${F.filas.map(fila).join('')}${F.detenido ? `<p class="fichaje-detenido">⚠️ El control de fichaje está frenado desde las ${horaLocal(F.detenido)}: recepción no recibe los recordatorios. Revisá que la PC esté prendida.</p>` : ''}</section>`;
  }
  // Reservas sin QR: debajo del fichaje y plegable, para que no tape la lista del día.
  function textoReserva(r) {
    const mensaje = 'Mandale un mensaje con interés genuino: preguntale si pasó algo, sin reproches.';
    if (r.puede_escanear) return r.recordado ? `Se lo pediste a las ${horaLocal(r.recordado)}: esperando el QR.` : `Fijate si está en la sala y pedile que escanee: tiene hasta los 15 minutos. Si no está, ${mensaje.charAt(0).toLowerCase() + mensaje.slice(1)}`;
    const profe = r.profe ? esc(r.profe) : 'su profe';
    return r.termino ? `Si no vino, ${mensaje.charAt(0).toLowerCase() + mensaje.slice(1)}`
      : `Ya no puede escanear. Si lo viste, ${profe} le da el presente. Si no vino, ${mensaje.charAt(0).toLowerCase() + mensaje.slice(1)}`;
  }
  function bandaReservas() {
    const R = (E.fichajes && E.fichajes.reservas) || [];
    if (!R.length) return '<section id="banda-reservas" hidden></section>';
    const boton = (r, que, txt, claro) => `<button class="boton${claro ? ' claro' : ''}" data-accion="reserva" data-que="${que}" data-id="${esc(r.id)}">${txt}</button>`;
    const botones = r => (r.puede_escanear ? (r.recordado ? '' : boton(r, 'recordado', 'Está: le pedí que escanee')) + boton(r, 'contacto', 'No está: ya le escribí', true)
      : (r.termino ? '' : boton(r, 'profe', 'Ya le avisé al profe')) + boton(r, 'contacto', 'No vino: ya le escribí', !r.termino));
    const fila = r => `<div class="fichaje"><div><b>${esc(r.socio)}</b><span>${esc(r.clase)} de las ${esc(r.hora)}. ${textoReserva(r)}</span><input class="reserva-detalle" data-id="${esc(r.id)}" maxlength="300" placeholder="Si ya te contó qué pasó, anotalo (opcional)" aria-label="Qué pasó con ${esc(r.socio)}"></div><div class="fichaje-botones">${botones(r)}</div></div>`;
    return `<section id="banda-reservas" class="fichajes"><button class="reservas-titulo" data-accion="reservas-plegar" aria-expanded="${E.reservasPlegadas ? 'false' : 'true'}">Reservaron y no escanearon: ${R.length} <span>${E.reservasPlegadas ? 'Ver' : 'Ocultar'}</span></button>${E.reservasPlegadas ? '' : R.map(fila).join('')}</section>`;
  }
  function mostrarFichajes(F) {
    E.fichajes = F;
    const banda = document.getElementById('banda-fichajes');
    if (banda) banda.outerHTML = bandaFichajes();
    const reservas = document.getElementById('banda-reservas');
    if (reservas) {
      // Se actualiza cada minuto: no se puede borrar lo que está escribiendo
      const escrito = {};
      reservas.querySelectorAll('.reserva-detalle').forEach(i => { if (i.value) escrito[i.dataset.id] = i.value; });
      const enFoco = document.activeElement && document.activeElement.classList.contains('reserva-detalle') ? document.activeElement.dataset.id : '';
      reservas.outerHTML = bandaReservas();
      document.querySelectorAll('#banda-reservas .reserva-detalle').forEach(i => { if (escrito[i.dataset.id]) i.value = escrito[i.dataset.id]; if (i.dataset.id === enFoco) i.focus(); });
    }
    const vistos = E.fichajesAvisados = E.fichajesAvisados || {};
    F.filas.filter(f => f.urgente && !vistos[f.id + '|' + f.recordado]).forEach(f => {
      vistos[f.id + '|' + f.recordado] = 1;
      push('🔴 ' + tituloFichaje(f), f.propia ? 'Escaneá el QR.' : 'Todavía no escaneó el QR.');
      aviso(tituloFichaje(f));
    });
  }
  async function revisarFichajes() {
    const s = cliente.sesion();
    if (!s || s.debe_cambiar_pin) return;
    try { mostrarFichajes(await cliente.llamar('fichajes_ver')); } catch (e) { /* sin conexión: se reintenta al minuto */ }
  }

  function render() {
    const s = cliente.sesion();
    if (!s) { app.innerHTML = vistaLogin(); return; }
    if (s.debe_cambiar_pin) { app.innerHTML = vistaCambiarPin(); return; }
    const disponibles = pestanasDisponibles().map(p => p[0]);
    if (disponibles.indexOf(E.vista) < 0) { E.vista = disponibles[0] || null; setTimeout(cargarVista); }
    const cuerpo = E.vista === 'hoy' ? vistaHoy() : E.vista === 'sede' ? vistaSede() : E.vista === 'admin' ? vistaAdmin() : E.vista === 'mes' ? vistaMes() : E.vista === 'rend' ? vistaRendimiento()
      : E.vista === 'reservas' ? vistaReservas()
      : E.vista === 'chat' ? vistaChat()
      : E.vista === 'planes' ? vistaPlanes() : E.vista === 'profes' ? vistaProfes() : E.vista === 'pmes' ? vistaMesProfe()
      : '<div class="vacio">Tu usuario no tiene ninguna vista asignada. Avisale a Emanuel.</div>';
    const sinDatos = { hoy: !E.tareas, sede: E.personaDni ? !E.persona : !E.sede, mes: !E.rend, rend: !E.rend, admin: !E.usuarios, reservas: !E.ocupacion, chat: !E.chat, planes: !E.planes, profes: !E.planes, pmes: !E.planes }[E.vista];
    const mostrar = E.errorCarga && sinDatos ? `<div class="vacio" style="margin-top:18px"><p>${esc(E.errorCarga)}</p><p>La pantalla vuelve a intentarlo sola. Tus marcas no se pierden.</p><button class="boton" data-accion="reintentar">Reintentar ahora</button></div>` : cuerpo;
    const bandas = E.vista === 'hoy' ? bandaFichajes() + bandaReservas() : '';
    app.innerHTML = encabezado() + `<main class="contenedor">${bandas}${mostrar}</main>` + (E.vista === 'hoy' && turnoTerminando() ? `<button class="cerrar-app-fijo${DEMO ? ' con-cinta' : ''}" data-accion="cerrar-app">🚪 ${E.dia && E.dia.cierre_hecho ? 'Listo por hoy' : 'Se termina tu turno'}: cerrá la app antes de irte</button>` : '') + (DEMO ? '<div class="cinta-practica">Modo práctica · datos inventados</div>' : '');
    const abierto = app.querySelector('.marca-form select');
    if (abierto && !E.errorForm) abierto.focus({ preventScroll: true });
    chatDespuesDeRender();
    if (!E.chat && !E.chatPidiendo && E.vista !== 'chat') { E.chatPidiendo = true; revisarMensajes().finally(() => { E.chatPidiendo = false; }); }   // el numerito de la pestaña, apenas se entra
  }

  // Reconocimiento apenas ocurre: la mitad, los últimos pasos y la lista completa
  function revisarLogros() {
    const delDia = (E.tareas || []).filter(deHoy);
    const hechas = delDia.filter(t => t.estado === 'hecha').length;
    const total = delDia.length;
    const falta = total - hechas;
    const meta = (E.dia && E.dia.hoy && E.dia.hoy.meta) || 0;
    const una = (k, fn) => { const c = E.hoy + k; if (!E.celebrado[c]) { E.celebrado[c] = true; fn(); } };
    // La meta es el mínimo del día, así que se festeja aunque queden tareas: es el logro que más se repite (Emanuel, 09/11/2026)
    if (meta && hechas >= meta) una('meta', () => celebrar('¡Cumpliste tu meta de hoy!', `Llegaste a ${hechas} de ${meta}.` + (falta ? ` Te quedan ${falta}: cada una que sumes es de más.` : ' Y no te quedó ninguna pendiente.'), true));
    if (total && !falta) una('todo', () => celebrar('¡Lista completa!', 'Dejaste todas las tareas de hoy al día. Excelente trabajo.', true));
    else if (falta === 3) una('3', () => celebrar('¡Te faltan 3!', 'Ya casi está: cerrá estas y dejás todo al día.'));
    else if (total >= 4 && hechas / total >= 0.5) una('mitad', () => celebrar('¡Mitad del día hecha!', `Vas ${hechas} de ${total}. Seguí así.`));
  }

  // ---------- Mensajes entre el equipo ----------
  // Chats de a dos o en grupo. Cada conversación la ven solo quienes participan; las sin movimiento por un año se borran solas.
  const ROL_CHAT = { recepcion: 'Recepción', profe: 'Profe', coordinador: 'Coordinación', admin: 'Administración', supervision: 'Supervisión' };
  const SEDE_CHAT = { bolson: 'El Bolsón', puelo: 'Lago Puelo', bariloche: 'Bariloche' };
  E.chat = null; E.chatAbierta = null; E.chatConv = null; E.chatNuevo = false; E.chatSumar = false; E.chatPersonas = null; E.chatBorrador = ''; E.chatSinLeer = 0;

  function chatCuando(ts) {
    const d = new Date(ts);
    if (isNaN(d)) return '';
    const hora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return d.toDateString() === new Date().toDateString() ? hora : ddmmDe(ts) + ' ' + hora;
  }

  const chatRoles = p => (p.roles || []).map(r => ROL_CHAT[r]).filter(Boolean).join(' · ');
  const chatPersona = p => `${esc(p.nombre)}<small>${esc([chatRoles(p), SEDE_CHAT[p.sede]].filter(Boolean).join(' · '))}</small>`;

  async function cargarChat() {
    const l = await cliente.llamar('chat_listar');
    const antes = E.chatSinLeer;
    E.chat = l.conversaciones;
    E.chatSinLeer = l.sin_leer;
    if (E.chatAbierta) {
      E.chatConv = await cliente.llamar('chat_ver', { id: E.chatAbierta });
      const c = E.chat.find(x => x.id === E.chatAbierta);
      if (c && c.sin_leer) {
        E.chatSinLeer -= c.sin_leer;
        c.sin_leer = 0;
        cliente.llamar('chat_leido', { id: E.chatAbierta }).catch(() => {});
      }
    }
    if ((E.chatNuevo || E.chatSumar) && !E.chatPersonas) E.chatPersonas = (await cliente.llamar('chat_personas')).personas;
    tituloMensajes();
    return E.chatSinLeer > antes;
  }

  function chatEtiqueta() {
    return E.chatSinLeer ? `Mensajes <b class="globito">${E.chatSinLeer}</b>` : 'Mensajes';
  }

  function chatElegir(excluir) {
    const ya = excluir || [];
    return `<input type="search" class="chat-buscar" data-chat-buscar placeholder="Buscar por nombre" aria-label="Buscar persona">
      <div class="chat-personas">${(E.chatPersonas || []).filter(p => ya.indexOf(p.pid) < 0).map(p => `<label class="chat-persona" data-nombre="${esc(p.nombre.toLowerCase())}"><input type="checkbox" name="para" value="${esc(p.pid)}"><span>${chatPersona(p)}</span></label>`).join('') || '<p class="nota">No hay más gente para sumar.</p>'}</div>`;
  }

  function vistaChat() {
    const privacidad = '<p class="nota chat-nota">Solo lo ven quienes participan en la conversación. Las que pasan un año sin mensajes se borran solas.</p>';
    if (E.chatNuevo) {
      return `<div class="chat-cabeza"><button class="boton claro chico" data-accion="chat-volver">← Mensajes</button><h2>Mensaje nuevo</h2></div>
        <form data-form="chat-nuevo" class="chat-form" autocomplete="off">
          <p class="nota">Elegí a quién. Con una persona es un chat de a dos; con dos o más, un grupo.</p>
          ${E.chatPersonas ? chatElegir() : '<p class="nota">Cargando…</p>'}
          <label class="campo chat-nombre-grupo" hidden>Nombre del grupo (opcional)<input name="nombre" maxlength="40" placeholder="Ej. Bolsón mañana"></label>
          <label class="campo">Mensaje<textarea name="texto" rows="3" maxlength="1000" required data-chat-texto placeholder="Escribí acá"></textarea></label>
          <button class="boton ancho verde">Enviar</button>
        </form>${privacidad}`;
    }
    if (E.chatAbierta && E.chatConv) {
      const c = E.chatConv;
      const ultimoMio = [...c.mensajes].reverse().find(m => m.mio);
      const leyeron = ultimoMio ? c.miembros.filter(m => !m.yo && m.leyo && m.leyo >= ultimoMio.ts).map(m => m.nombre.split(' ')[0]) : [];
      const quienes = c.miembros.filter(m => !m.yo).map(m => m.nombre).join(', ');
      return `<div class="chat-cabeza"><button class="boton claro chico" data-accion="chat-volver">← Mensajes</button>
          <div><h2>${esc(c.nombre)}</h2>${c.tipo === 'grupo' ? `<p class="nota">Con vos: ${esc(quienes)}</p>` : ''}</div>
          ${c.tipo === 'grupo' ? '<button class="boton claro chico" data-accion="chat-sumar">+ Sumar gente</button>' : ''}</div>
        ${E.chatSumar ? `<form data-form="chat-sumar" class="chat-form" autocomplete="off">${E.chatPersonas ? chatElegir(c.miembros.map(m => m.pid)) : '<p class="nota">Cargando…</p>'}<div class="botones"><button class="boton verde">Sumar</button><button type="button" class="boton claro" data-accion="chat-sumar">Cancelar</button></div></form>` : ''}
        <div class="chat-msgs" role="log">
          ${c.hay_mas ? '<p class="nota">Se muestran los últimos mensajes.</p>' : ''}
          ${c.mensajes.map(m => `<div class="chat-msg ${m.mio ? 'mio' : 'otro'}">${m.mio ? '' : `<b>${esc(m.de)}</b>`}${m.ref ? `<span class="chat-ref">Sobre ${esc(m.ref)}</span>` : ''}<p>${esc(m.texto)}</p><time>${esc(chatCuando(m.ts))}</time></div>`).join('') || '<p class="nota">Todavía no hay mensajes.</p>'}
          ${leyeron.length ? `<p class="nota chat-leido">Leído por ${esc(leyeron.join(', '))}</p>` : ''}
        </div>
        <form data-form="chat-enviar" class="chat-redactar" autocomplete="off">
          <input name="ref" maxlength="80" placeholder="Sobre un socio (opcional)" aria-label="Sobre un socio">
          <div class="chat-fila"><textarea name="texto" rows="2" maxlength="1000" required data-chat-texto placeholder="Escribí un mensaje">${esc(E.chatBorrador)}</textarea><button class="boton verde">Enviar</button></div>
        </form>${privacidad}`;
    }
    const lista = E.chat || [];
    return `<div class="chat-cabeza"><h2>Mensajes</h2><button class="boton verde chico" data-accion="chat-nuevo">✉️ Mensaje nuevo</button></div>
      ${lista.length ? `<div class="chat-lista">${lista.map(c => `<button class="chat-item${c.sin_leer ? ' sin-leer' : ''}" data-accion="chat-abrir" data-id="${esc(c.id)}">
          <span class="chat-quien"><b>${esc(c.nombre)}</b>${c.tipo === 'grupo' ? `<small>Grupo · ${c.personas} personas</small>` : ''}</span>
          <span class="chat-ultimo">${c.ultimo ? esc((c.ultimo.mio ? 'Vos: ' : (c.tipo === 'grupo' ? c.ultimo.de.split(' ')[0] + ': ' : '')) + c.ultimo.texto) : 'Sin mensajes'}</span>
          <span class="chat-hora">${c.ultimo ? esc(chatCuando(c.ultimo.ts)) : ''}${c.sin_leer ? `<b class="globito">${c.sin_leer}</b>` : ''}</span></button>`).join('')}</div>`
        : '<div class="vacio"><p>Todavía no tenés conversaciones.</p><p>Tocá “Mensaje nuevo” para escribirle a alguien del equipo o armar un grupo.</p></div>'}
      ${privacidad}`;
  }

  async function accionChat(a, el) {
    if (a === 'chat-abrir') { E.chatAbierta = el.dataset.id; E.chatConv = null; E.chatBorrador = ''; E.chatSumar = false; render(); try { await cargarChat(); } catch (e) { falla(e); } render(); }
    else if (a === 'chat-volver') { E.chatAbierta = null; E.chatConv = null; E.chatNuevo = false; E.chatSumar = false; E.chatBorrador = ''; render(); try { await cargarChat(); render(); } catch (e) { /* queda lo que había */ } }
    else if (a === 'chat-nuevo') { E.chatNuevo = true; render(); try { await cargarChat(); render(); } catch (e) { falla(e); } }
    else if (a === 'chat-sumar') { E.chatSumar = !E.chatSumar; render(); if (E.chatSumar && !E.chatPersonas) { try { await cargarChat(); render(); } catch (e) { falla(e); } } }
  }

  async function enviarFormChat(tipo, form) {
    const f = new FormData(form);
    const btn = form.querySelector('button:not([type=button])');
    const para = f.getAll('para');
    const texto = String(f.get('texto') || '').trim();
    try {
      if (tipo === 'chat-nuevo') {
        if (!para.length) { aviso('Elegí al menos a una persona.', true); return; }
        btn.disabled = true;
        const r = await cliente.llamar('chat_enviar', { para, texto, nombre: String(f.get('nombre') || '').trim() });
        E.chatNuevo = false; E.chatAbierta = r.id; E.chatConv = null; E.chatBorrador = '';
        await cargarChat();
      } else if (tipo === 'chat-enviar') {
        if (!texto) return;
        btn.disabled = true;
        await cliente.llamar('chat_enviar', { id: E.chatAbierta, texto, ref: String(f.get('ref') || '').trim() });
        E.chatBorrador = '';
        await cargarChat();
      } else if (tipo === 'chat-sumar') {
        if (!para.length) { aviso('Elegí a quién sumar.', true); return; }
        btn.disabled = true;
        await cliente.llamar('chat_agregar', { id: E.chatAbierta, para });
        E.chatSumar = false;
        await cargarChat();
        aviso('✅ Listo: ya están en el grupo.');
      }
      render();
    } catch (e) { if (btn) btn.disabled = false; falla(e); }
  }

  // Aviso apenas llega. La pantalla pregunta "¿hay algo nuevo?" con un pedido liviano (chat_novedad: una fila chica, no la mensajería entera):
  // cada 20 s con la app a la vista, cada 60 s en segundo plano, y enseguida al volver a ella. Si algo llegó: numerito en la pestaña y en
  // el título del navegador, sonido corto y aviso del sistema con quién escribió.
  E.chatTs = null;
  let relojMensajes = null;

  function sonidoMensaje() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const c = new Ctx(), t = c.currentTime;
      [[880, 0], [1175, .12]].forEach(([f, d]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.value = f; o.connect(g); g.connect(c.destination);
        g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.18, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .22);
        o.start(t + d); o.stop(t + d + .25);
      });
      setTimeout(() => c.close && c.close(), 800);
    } catch (e) { /* sin sonido */ }
  }

  function tituloMensajes() {
    document.title = (E.chatSinLeer ? `(${E.chatSinLeer}) ` : '') + 'PulsoMOVE';
  }

  // El cartel vive fuera de #app: render() reescribe todo lo de adentro y se lo llevaría puesto.
  let relojCartel = null;
  // Algunos diálogos de la app (los que se abren con showModal) tapan todo lo demás; un popover queda por encima de ellos.
  function ocultarCartel() {
    const b = document.getElementById('aviso-chat');
    if (!b) return;
    b.className = '';
    try { if (b.matches(':popover-open')) b.hidePopover(); } catch (e) { /* navegador sin popover */ }
  }
  function cartelMensaje(titulo, cuerpo, id) {
    let b = document.getElementById('aviso-chat');
    if (!b) {
      b = document.createElement('div');
      b.id = 'aviso-chat';
      b.setAttribute('role', 'status');
      b.setAttribute('popover', 'manual');
      b.addEventListener('click', ev => {
        if (ev.target.closest('.aviso-chat-x')) { ocultarCartel(); return; }
        const ir = ev.target.closest('[data-ir-chat]');
        if (!ir) return;
        ocultarCartel();
        E.vista = 'chat'; E.chatAbierta = ir.dataset.irChat || null; E.chatConv = null; E.chatNuevo = false; E.chatSumar = false; E.chatBorrador = '';
        render();
        cargarChat().then(render).catch(() => {});
      });
      document.body.appendChild(b);
    }
    b.innerHTML = `<button class="aviso-chat-cuerpo" data-ir-chat="${esc(id || '')}"><b>💬 ${esc(titulo)}</b><span>${esc(cuerpo)}</span></button><button class="aviso-chat-x" aria-label="Cerrar">×</button>`;
    b.className = 'visible';
    try { if (b.showPopover) { if (b.matches(':popover-open')) b.hidePopover(); b.showPopover(); } } catch (e) { /* queda como cartel común */ }
    clearTimeout(relojCartel);
    relojCartel = setTimeout(ocultarCartel, 10000);
  }

  // Al llegar un mensaje con la app abierta, o al abrirla con mensajes sin leer: cartel arriba, sonido y numerito.
  function avisarMensajeNuevo(alAbrir) {
    const c = (E.chat || []).find(x => x.ultimo && !x.ultimo.mio && x.sin_leer);
    if (E.vista === 'chat' && (!c || E.chatAbierta === c.id || !alAbrir)) return;   // ya lo está viendo
    sonidoMensaje();
    const quien = c ? (c.tipo === 'grupo' ? `${c.ultimo.de} en ${c.nombre}` : c.nombre) : 'Alguien del equipo';
    const texto = c ? c.ultimo.texto : '';
    if (E.chatSinLeer > 1) cartelMensaje(`Tenés ${E.chatSinLeer} mensajes sin leer`, c ? `Último de ${quien}: ${texto}` : '', c ? c.id : '');
    else cartelMensaje(quien, texto || 'Mensaje nuevo', c ? c.id : '');
  }

  async function revisarMensajes() {
    clearTimeout(relojMensajes);
    relojMensajes = setTimeout(revisarMensajes, document.hidden ? 60000 : 20000);
    const s = cliente.sesion();
    if (!s || s.debe_cambiar_pin) return;
    try {
      const n = await cliente.llamar('chat_novedad');
      const alAbrir = E.chatTs === null && n.sin_leer > 0;
      const nuevo = E.chatTs !== null && n.ts !== E.chatTs && n.sin_leer > E.chatSinLeer;
      const cambio = n.ts !== E.chatTs || n.sin_leer !== E.chatSinLeer || !E.chat;
      E.chatTs = n.ts;
      if (!cambio) return;
      const antes = JSON.stringify(E.chat);
      await cargarChat();
      tituloMensajes();
      if (nuevo || alAbrir) avisarMensajeNuevo(alAbrir);
      if (E.vista === 'chat') {
        const tx = app.querySelector('[data-chat-texto]');
        if (JSON.stringify(E.chat) !== antes && (!tx || !tx.value)) render();
      } else {
        const b = app.querySelector('.pestanas [data-v="chat"]');
        if (b) b.innerHTML = chatEtiqueta();
      }
    } catch (e) { /* sin conexión o sesión vencida: se reintenta */ }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarMensajes(); });
  window.addEventListener('focus', () => revisarMensajes());
  setTimeout(revisarMensajes, 2500);

  app.addEventListener('input', ev => {
    const t = ev.target;
    if (t.matches && t.matches('textarea[data-chat-texto]') && E.chatAbierta) E.chatBorrador = t.value;
    else if (t.matches && t.matches('[data-chat-buscar]')) {
      const q = t.value.trim().toLowerCase();
      app.querySelectorAll('.chat-persona').forEach(l => { l.hidden = !!q && l.dataset.nombre.indexOf(q) < 0; });
    } else if (t.matches && t.matches('.chat-persona input')) {
      const n = app.querySelectorAll('.chat-persona input:checked').length;
      const g = app.querySelector('.chat-nombre-grupo');
      if (g) g.hidden = n < 2;
    }
  });

  function chatDespuesDeRender() {
    const m = app.querySelector('.chat-msgs');
    if (m) m.scrollTop = m.scrollHeight;
  }

  // ---------- Eventos ----------

  app.addEventListener('submit', async ev => {
    const form = ev.target;
    const tipo = form.dataset.form;
    if (!tipo) return;
    ev.preventDefault();
    const f = new FormData(form);
    const btn = form.querySelector('button:not([type=button])');
    if (tipo.indexOf('chat-') === 0) { await enviarFormChat(tipo, form); return; }
    if (tipo === 'login') {
      btn.disabled = true;
      try {
        const s = await cliente.llamar('login', { dni: f.get('dni'), pin: f.get('pin') });
        cliente.guardarSesion(s);
        E.mensajeLogin = '';
        E.vista = null;
        E.tareas = null;
        E.chat = null; E.chatSinLeer = 0; E.chatTs = null; E.chatPersonas = null; E.chatAbierta = null; E.chatConv = null;   // los mensajes son de cada persona
        render();
      } catch (e) {
        E.mensajeLogin = e.message;
        render();
      }
    } else if (tipo === 'pin') {
      if (f.get('a') !== f.get('b')) { E.mensajeLogin = 'Los dos PIN no coinciden.'; render(); return; }
      if (!pinValido(String(f.get('a')))) { E.mensajeLogin = PulsoApi.mensaje('pin_invalido'); render(); return; }
      btn.disabled = true;
      try {
        await cliente.llamar('cambiar_pin', { pin_nuevo: f.get('a') });
        cliente.guardarSesion(Object.assign(cliente.sesion(), { debe_cambiar_pin: false }));
        E.mensajeLogin = '';
        render();
        aviso('PIN guardado.');
      } catch (e) { E.mensajeLogin = e.message; render(); }
    } else if (tipo === 'marcar') {
      const marca = { canal: f.get('canal'), resultado: f.get('resultado'), fecha: f.get('fecha') || '', detalle: String(f.get('detalle') || '').trim() };
      const sinTildar = [...form.querySelectorAll('[data-check]')].filter(c => !c.checked).map(c => c.dataset.check);
      if (sinTildar.length) {
        if (!marca.detalle) { E.errorForm = 'Tildá todo, o contá por qué algo quedó sin hacer.'; render(); return; }
        marca.detalle = 'Sin hacer: ' + sinTildar.join(', ') + '. ' + marca.detalle;
      }
      if (!marca.canal) { E.errorForm = 'Elegí el canal.'; render(); return; }
      if (validarMarca(marca)) {
        E.errorForm = PIDEN_FECHA.indexOf(marca.resultado) >= 0 && !marca.fecha ? `Con ${marca.resultado} hace falta la fecha.`
          : PIDEN_DETALLE.indexOf(marca.resultado) >= 0 && !marca.detalle ? `Con ${marca.resultado} hace falta escribir el motivo.`
          : 'Elegí el canal y el resultado.';
        render();
        return;
      }
      const conteo = [...form.querySelectorAll('[data-stock]')].map(i => ({ producto: i.dataset.stock, cantidad: i.value }));
      if (conteo.length) marca.stock = conteo;
      const t = E.tareas.find(x => x.id === form.dataset.id);
      btn.disabled = true;
      const r = await cliente.marcar(Object.assign({ tarea_id: t.id, abierta_en: E.abiertaEn }, marca));
      if (r.descartadas.length) {
        aviso(PulsoApi.mensaje(r.descartadas[0].error), true);
        btn.disabled = false;
        return;
      }
      t.estado = 'hecha';
      t.resultado_local = marca.resultado;
      E.abierta = null;
      E.errorForm = '';
      render();
      aviso(r.enviada ? 'Guardado.' : 'Guardado en este equipo. Se envía solo cuando vuelva la conexión.', !r.enviada);
      E.ultimaMarca = Date.now();
      revisarLogros();
      cliente.llamar('mi_dia').then(d => { E.dia = d; if (!E.abierta) render(); revisarAvisos(); }).catch(() => {});
    }
  });

  app.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.accion === 'tipo') { E.tipo = el.value; render(); }
    if (el.dataset.accion === 'reeval-buscar') { E.reevalBusca = el.value; E.reevalAbierto = true; render(); }
    if (el.dataset.accion === 'resultado') {
      const form = el.closest('form');
      const fecha = PIDEN_FECHA.indexOf(el.value) >= 0;
      const detalle = PIDEN_DETALLE.indexOf(el.value) >= 0;
      form.querySelector('[data-campo=fecha]').hidden = !fecha;
      form.querySelector('[data-ayuda=fecha]').textContent = PREGUNTA_FECHA[el.value] || 'Fecha';
      form.querySelector('[data-ayuda=detalle]').textContent = detalle ? '(motivo, obligatorio)' : '(opcional)';
      form.querySelector('[name=fecha]').required = fecha;
      if (!fecha) form.querySelector('[name=fecha]').value = '';
      form.querySelector('[name=detalle]').required = detalle;
    }
  });

  app.addEventListener('click', async ev => {
    const el = ev.target.closest('[data-accion]');
    if (!el || el.tagName === 'SELECT') return;
    const a = el.dataset.accion;
    if (a === 'salir') {
      const irse = () => { if (salirDeLaApp()) render(); };
      if (faltaElCierre()) recordarCierre(irse); else irse();
    } else if (a === 'cerrar-app') cerrarApp();
    else if (a.indexOf('chat-') === 0) accionChat(a, el);
    else if (a === 'fichaje') {
      el.disabled = true;
      try {
        const r = await cliente.llamar('fichaje_marcar', { id: el.dataset.id, que: el.dataset.que });
        mostrarFichajes({ filas: r.filas, reservas: E.fichajes ? E.fichajes.reservas : [], detenido: E.fichajes ? E.fichajes.detenido : '' });
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'reserva') {
      el.disabled = true;
      try {
        const campo = [...document.querySelectorAll('.reserva-detalle')].find(i => i.dataset.id === el.dataset.id);
        const r = await cliente.llamar('reserva_marcar', { id: el.dataset.id, que: el.dataset.que, detalle: campo ? campo.value : '' });
        mostrarFichajes(Object.assign({}, E.fichajes, { reservas: r.reservas }));
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'reservas-plegar') { E.reservasPlegadas = !E.reservasPlegadas; document.getElementById('banda-reservas').outerHTML = bandaReservas(); }
    else if (a === 'vista') irA(el.dataset.v);
    else if (a === 'plan-marcar') {
      el.disabled = true;
      try {
        const r = await cliente.llamar('profe_marcar', { id: el.dataset.id, hecha: el.dataset.hecha === '1' });
        const M = E.planes && E.planes.mio;
        if (M) {
          const t = M.hoy.find(x => x.id === r.tarea.id);
          if (t) { const antes = t.estado; Object.assign(t, r.tarea); if (antes !== t.estado) { const d = t.estado === 'hecha' ? 1 : -1; M.resumen.hechas_hoy += d; M.resumen.hechas_mes += d; M.resumen.pendientes_hoy -= d; if (t.atraso > 0) M.resumen.atrasadas -= d; } }
        }
        if (M && r.dia_completo) M.mes = Object.assign({}, M.mes, { hoy_completo: r.dia_completo, dias_completos: ((M.mes || {}).dias_completos || 0) + 1 });
        render();
        if (el.dataset.hecha === '1') { if (r.dia_completo) festejarDia(r); else aviso('✅ ¡Bien! Plan renovado.'); }
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'planes-sede') { E.sedeElegida = el.dataset.s; E.planes = null; E.profeVer = null; render(); cargarVista(); }
    else if (a === 'profe-ver') { E.profeVer = el.dataset.p; render(); window.scrollTo(0, 0); }
    else if (a === 'profe-volver') { E.profeVer = null; render(); }
    else if (a === 'reeval-abrir') { E.reevalAbierto = !el.parentElement.open; }
    else if (a === 'aud-seccion') { E.audSeccion = el.dataset.s; E.audAbierto = true; render(); }
    else if (a === 'aud-abrir') { E.audAbierto = !el.parentElement.open; }
    else if (a === 'aud-marcar') {
      el.disabled = true;
      try {
        const r = await cliente.llamar('profe_auditoria_marcar', { id: el.dataset.id, hecha: el.dataset.hecha === '1' });
        const A = E.planes && E.planes.mio && E.planes.mio.auditoria;
        if (A) { const x = A.pendientes.find(v => v.id === r.hallazgo.id); if (x) Object.assign(x, r.hallazgo); }
        render();
        aviso(el.dataset.hecha === '1' ? '✅ Anotado: mañana lo miramos en MOVE y, si está corregido, se cierra.' : '↩️ Deshecho.');
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'plan-extra') {
      const campo = app.querySelector('[data-extra-busca]');
      const socios = (E.planes && E.planes.mio && E.planes.mio.reeval && E.planes.mio.reeval.socios) || [];
      const nombre = (campo && campo.value || '').trim().toLowerCase();
      const s = socios.find(x => x.socio_nombre.toLowerCase() === nombre) || (nombre.length > 2 && socios.filter(x => x.socio_nombre.toLowerCase().indexOf(nombre) >= 0).length === 1 ? socios.find(x => x.socio_nombre.toLowerCase().indexOf(nombre) >= 0) : null);
      if (!s) { aviso('Elegí el socio de la lista: escribí su nombre y tocá la sugerencia.', true); return; }
      el.disabled = true;
      try {
        await cliente.llamar('profe_plan_extra', { socio_id: s.socio_id });
        await cargarVista();
        aviso(`✅ Anotado: le renovaste el plan a ${s.socio_nombre}. Te cuenta como hecho.`);
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'no-es-mio') {
      const s = el.dataset.s, art = el.closest('article');
      const valor = attr => { const x = art.querySelector('select[' + attr + ']'); return x ? x.value : ''; };
      el.disabled = true;
      try {
        const r = await cliente.llamar('profe_no_es_mio', { socio_id: s, profe: valor('data-noes-profe'), dni: valor('data-noes-rec') });
        await cargarVista();
        aviso(`✅ Listo: le avisamos a ${r.recepcionista} para que le cambie el profesor. Ya no te aparece.`);
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'plan-traer' || a === 'plan-deshacer') {
      el.disabled = true;
      try {
        const r = await cliente.llamar(a === 'plan-traer' ? 'profe_adelantar' : 'profe_deshacer', { id: el.dataset.id });
        await cargarVista();
        aviso(a === 'plan-traer' ? '👉 Listo: lo tenés para hoy.' : r.aviso_recepcion === 'cancelado' ? '↩️ Deshecho. También cancelamos el aviso a recepción.'
          : r.aviso_recepcion === 'ya_hecho' ? '↩️ Deshecho. Ojo: recepción ya había hecho el cambio de profesor; si hay que volverlo atrás, avisales.' : '↩️ Deshecho: volvió a tu lista.');
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'otra-situacion') {
      const id = el.dataset.id, que = el.dataset.que;
      const valor = attr => { const s = [...app.querySelectorAll('select[' + attr + ']')].find(x => x.getAttribute(attr) === id); return s ? s.value : ''; };
      el.disabled = true;
      try {
        const r = await cliente.llamar('profe_otra_situacion', que === 'papel' ? { id, que } : { id, que, profe: valor('data-otra-profe'), dni: valor('data-otra-rec') });
        const M = E.planes && E.planes.mio;
        if (M) { M.hoy = M.hoy.filter(x => x.id !== id); M.resumen.pendientes_hoy = Math.max(0, M.resumen.pendientes_hoy - 1); }
        render();
        if (M) M.hechas = [r.tarea].concat(M.hechas || []);
        render();
        if (r.dia_completo) festejarDia(r);
        else aviso((que === 'papel' ? '📄 Anotado: tiene el plan en papel.' : `✅ Listo: le avisamos a ${r.recepcionista}.`) + (M && M.proximas.length ? ' Si querés, traé uno de los próximos con "Traerlo a hoy".' : ''));
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'revision-responder') {
      el.disabled = true;
      try {
        const r = await cliente.llamar('profe_responder_revision', { id: el.dataset.id, respuesta: el.dataset.r });
        const R = E.planes && E.planes.mio && E.planes.mio.revisiones;
        if (R) { const x = R.lista.find(v => v.id === r.revision.id); if (x) { Object.assign(x, r.revision); R.resumen.saltos_sin_responder = Math.max(0, R.resumen.saltos_sin_responder - 1); } }
        render();
        aviso(el.dataset.r === 'correcta' ? '✅ Anotado: la progresión es correcta.' : '✏️ Anotado: la vas a corregir en MOVE.');
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'reeval-pedir') {
      el.disabled = true;
      try {
        const sel = [...app.querySelectorAll('select[data-reeval-a]')].find(s => s.dataset.reevalA === el.dataset.s && s.closest('article') === el.closest('article'));
        const r = await cliente.llamar('profe_pedir_reeval', Object.assign({ socio_id: el.dataset.s, fecha: el.dataset.f, hora: el.dataset.h }, sel ? { dni: sel.value } : {}));
        const R = E.planes && E.planes.mio && E.planes.mio.reeval;
        if (R) [].concat(R.recomendadas, R.socios).forEach(x => { if (x.socio_id === el.dataset.s) x.pedida = true; });
        render();
        aviso(`✅ Listo: se lo pediste a ${r.recepcionista}. Le aparece como tarea importante.`);
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'filtro') { E.filtro = el.dataset.f; E.abierta = null; render(); }
    else if (a === 'abrir') { E.abierta = E.abierta === el.dataset.id ? null : el.dataset.id; E.abiertaEn = new Date().toISOString(); E.errorForm = ''; render(); }
    else if (a === 'adelantar') { E.adelantar = !E.adelantar; cargarVista(); }
    else if (a === 'activar-avisos') { Notification.requestPermission().then(() => { render(); if (Notification.permission === 'granted') push('¡Listo!', 'Los avisos de PulsoMOVE van a aparecer acá.'); }); }
    else if (a === 'probar-cierre' || a === 'probar-cierre-real') dialogoCierre(true);
    else if (a === 'rend-lista') { E.vista = 'sede'; E.personaDni = el.dataset.dni; E.persona = null; render(); cargarVista(); }
    else if (a === 'cerrar') { E.abierta = null; E.errorForm = ''; render(); }
    else if (a === 'garantia') dialogoGarantia();
    else if (a === 'trajo-socio') dialogoTrajoSocio();
    else if (a === 'reintentar') { E.errorCarga = ''; render(); cargarVista(); }
    else if (a === 'registrar') dialogoRegistrar(el.dataset.tipo);
    else if (a === 'rend-mes') { E.rendMes = el.dataset.m; E.rend = null; render(); cargarVista(); }
    else if (a === 'rend-sede') { E.sedeElegida = el.dataset.s; E.rend = null; E.rendDni = null; render(); cargarVista(); }
    else if (a === 'rend-persona') { E.rendDni = el.dataset.dni; render(); window.scrollTo(0, 0); }
    else if (a === 'rend-volver') { E.rendDni = null; render(); }
    else if (a === 'objetivos-guardar') {
      const valores = {};
      app.querySelectorAll('[data-objetivo]').forEach(i => { if (i.value !== '') valores[i.dataset.objetivo] = Number(i.value) / (i.dataset.pct === '1' ? 100 : 1); });
      el.disabled = true;
      try { await cliente.llamar('objetivos_guardar', { dni: el.dataset.dni, valores }); aviso('Objetivos guardados.'); cargarVista(); } catch (e) { el.disabled = false; falla(e); }
    }
    else if (a === 'ver-persona') { E.personaDni = el.dataset.dni; E.persona = null; render(); cargarVista(); }
    else if (a === 'persona-volver') { E.personaDni = null; E.persona = null; render(); cargarVista(); }
    else if (a === 'ventas-periodo') { E.ventasPeriodo = el.dataset.p; render(); }
    else if (a === 'sede-elegir') { E.sedeElegida = el.dataset.s; E.sede = null; E.ocupacion = null; E.diaProx = ''; render(); cargarVista(); }
    else if (a === 'franja') detalleFranja(Number(el.dataset.d), el.dataset.h);
    else if (a === 'prox-dia') { E.diaProx = el.dataset.f; render(); }
    else if (a === 'prox-clase') detalleClase(el.dataset.id);
    else if (a === 'reasignar') {
      const dni = app.querySelector(`[data-reasignar="${CSS.escape(el.dataset.id)}"]`).value;
      el.disabled = true;
      try { await cliente.llamar('reasignar', { tarea_id: el.dataset.id, dni }); aviso('Tarea reasignada.'); cargarVista(); } catch (e) { el.disabled = false; falla(e); }
    } else if (a === 'decidir') {
      const comentario = app.querySelector(`[data-comentario="${CSS.escape(el.dataset.id)}"]`).value;
      el.disabled = true;
      try { await cliente.llamar('garantia_decidir', { id: el.dataset.id, estado: el.dataset.estado, comentario }); aviso('Decisión guardada.'); cargarVista(); } catch (e) { el.disabled = false; falla(e); }
    } else if (a === 'venta-dar' || a === 'venta-pedir' || a === 'venta-responder' || a === 'venta-decidir') {
      el.disabled = true;
      try {
        if (a === 'venta-dar') await cliente.llamar('venta_larga_pedir', { id: el.dataset.id, dni: app.querySelector(`[data-venta-dar="${CSS.escape(el.dataset.id)}"]`).value });
        if (a === 'venta-pedir') await cliente.llamar('venta_larga_pedir', { id: el.dataset.id });
        if (a === 'venta-responder') await cliente.llamar('venta_larga_responder', { id: el.dataset.id, acepta: !!el.dataset.si });
        if (a === 'venta-decidir') await cliente.llamar('venta_larga_decidir', { id: el.dataset.id, dni: el.dataset.dni });
        aviso('Guardado.');
        cargarVista();
      } catch (e) { el.disabled = false; falla(e); }
    } else if (a === 'beneficio') {
      el.disabled = true;
      try { await cliente.llamar('beneficio_decidir', { id: el.dataset.id, estado: el.dataset.estado }); aviso('Guardado.'); cargarVista(); } catch (e) { el.disabled = false; falla(e); }
    } else if (a === 'nuevo-pin') {
      if (!confirm(`¿Generar un PIN nuevo para ${el.dataset.nombre}? El anterior deja de funcionar.`)) return;
      try {
        const r = await cliente.llamar('pin_regenerar', { dni: el.dataset.dni });
        dialogo(`<h3>PIN de ${esc(el.dataset.nombre)}</h3><div class="pin-grande">${esc(r.pin)}</div>
          <p class="bajada" style="margin:0">Anotalo y entregáselo en persona. No se vuelve a mostrar. Lo cambia en su primer ingreso.</p>
          <button class="boton ancho" data-cerrar>Listo</button>`, d => { d.querySelector('[data-cerrar]').onclick = () => d.close(); });
        cargarVista();
      } catch (e) { falla(e); }
    } else if (a === 'activo') {
      try { await cliente.llamar('usuario_activo', { dni: el.dataset.dni, activo: el.dataset.activo === '1' }); cargarVista(); } catch (e) { falla(e); }
    }
  });

  // Reenvía lo que quedó sin conexión y actualiza la lista cada tanto (si no hay un formulario abierto)
  async function enviarPendientes() {
    if (!cliente.sesion() || !cliente.pendientesDeEnvio()) return;
    const r = await cliente.enviarCola();
    if (r.descartadas.length) aviso(PulsoApi.mensaje(r.descartadas[0].error), true);
    if (!E.abierta) render();
  }
  window.addEventListener('online', enviarPendientes);
  setInterval(enviarPendientes, 30000);
  setInterval(revisarCierre, 60000);
  setInterval(revisarAvisos, 60000);
  setInterval(revisarFichajes, 60000);
  setInterval(tomarMinutoDeUso, 60000);
  setInterval(enviarUso, 5 * 60000);
  setInterval(() => { if (cliente.sesion() && !E.abierta && !document.querySelector('dialog') && document.visibilityState === 'visible') cargarVista(); }, 5 * 60000);

  render();
})();

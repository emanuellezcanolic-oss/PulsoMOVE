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
    // Pagó y no figura que vino: se confirma antes de liquidarle la comisión al profe (Emanuel, 13/11/2026)
    if (t.indexOf('Confirmar si viene') === 0) return { conCanal: true, etiqueta: '¿Está viniendo?', opciones: [['VIENE', 'Sí, viene: le pedí que escanee el QR cada vez'], ['NO VIENE', 'No viene: le mandé un mensaje']], consejo: 'Te preguntamos porque pagó pero en MOVE no figura ninguna asistencia ese mes. La comisión del profe se liquida solo si el socio viene: si viene y no escanea, el profe pierde esa comisión. Si no viene, escribile para saber cómo está.', detalle: 'Qué te dijo (opcional)', boton: 'Guardar' };
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

  // Con coordinación, las pestañas se ordenan en grupos: lo mío, lo de recepción, lo de profes y lo del equipo (Emanuel, 13/11/2026)
  function pestanasDisponibles() {
    const p = [];
    const coord = tiene('coordinador') || tiene('admin');
    if (tiene('profe')) p.push(['planes', 'Mis planes', 'Mi día'], ['pmes', tiene('recepcion') ? 'Mis planes: el mes' : 'Mi mes', 'Mi día']);   // PulsoMOVE Profes: profes y kinesiólogos
    if (tiene('recepcion')) p.push(['hoy', 'Mis tareas', 'Mi día'], ['mes', 'Mi mes', 'Mi día']);
    if (coord) p.push(['sede', 'Sede', 'Recepción'], ['rend', 'Rendimiento', 'Recepción']);
    if (tiene('recepcion') || coord) p.push(['consultas', 'Consultas', coord ? 'Recepción' : 'Mi día'], ['pase', 'Pase de turno', coord ? 'Recepción' : 'Mi día']);
    // La ve recepción: es la que contesta "¿a qué hora hay menos gente?" (Emanuel, 09/11/2026)
    if (tiene('recepcion') || coord) p.push(['reservas', 'Reservas', coord ? 'Recepción' : 'Mi día']);
    if (tiene('admin') || tiene('recepcion') || coord) p.push(['liq', tiene('admin') ? 'Liquidación' : 'Mis ingresos', coord ? 'Recepción' : 'Mi día']);   // cada una ve lo suyo; admin ve a todas
    if (coord) p.push(['pres', 'Resumen', 'Profes'], ['profes', 'Planes y llegadas', 'Profes'], ['phor', 'Horarios y sábados', 'Profes'], ['pliq', tiene('admin') ? 'Comisiones y tareas' : 'Tareas del mes', 'Profes']);
    if (tiene('admin')) p.push(['resumen', 'Resumen semanal', 'Gestión'], ['admin', 'Equipo', 'Gestión']);
    p.push(['chat', chatEtiqueta(), coord ? 'Gestión' : 'Mi día']);   // mensajes entre el equipo: todos
    return p;
  }

  // Coordinación: arriba los grupos (Mi día, Recepción, Profes, Gestión) y abajo las pestañas del grupo (Emanuel, 13/11/2026)
  const ICONO_GRUPO = { 'Mi día': '🙋', 'Recepción': '🛎️', 'Profes': '🏋️', 'Gestión': '⚙️' };
  function navegacion(p) {
    if (p.length <= 1) return '';
    const tab = ([k, t]) => `<button role="tab" data-accion="vista" data-v="${k}" aria-selected="${E.vista === k}">${t}</button>`;
    if (!(tiene('coordinador') || tiene('admin'))) return `<nav class="pestanas" role="tablist">${p.map(tab).join('')}</nav>`;
    const grupos = [];
    p.forEach(x => { if (grupos.indexOf(x[2]) < 0) grupos.push(x[2]); });
    const actual = (p.find(x => x[0] === E.vista) || p[0])[2];
    return `<nav class="grupos-nav" aria-label="Secciones">${grupos.map(g => `<button class="grupo-boton" data-accion="grupo" data-g="${esc(g)}" aria-pressed="${g === actual}">${ICONO_GRUPO[g] || ''} ${esc(g)}</button>`).join('')}</nav>
      <nav class="pestanas" role="tablist">${p.filter(x => x[2] === actual).map(tab).join('')}</nav>`;
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
      ${navegacion(p)}
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
        ${t.estado === 'hecha' ? '' : `<span class="nota">Hacelo en MOVE y tocá el botón. Mañana MOVE lo confirma: si sigue igual, la tarea vuelve a aparecer.</span>
        <button class="boton verde" data-accion="hice-en-move" data-id="${esc(t.id)}">Ya lo hice en MOVE</button>`}
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

  const MOTIVOS_DEJAR = ['Es lo que necesita este socio', 'Lo hablé con coordinación', 'En este caso la auditoría se equivoca', 'Lo corrijo cuando le renueve el plan'];
  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

  function tarjetaHallazgo(h, i, puedeMarcar) {
    const estado = h.estado === 'marcada' ? '<span class="estado hecha">Dijiste que lo corregiste</span>'
      : h.estado === 'dejada' ? '<span class="estado hecha">Lo dejó así</span>'
      : h.estado === 'no_corregido' ? '<span class="estado atrasada">Dijiste que lo corregiste y sigue igual</span>'
      : h.al_renovar ? '<span class="estado ayer">Se corrige al renovar</span>'
      : h.reaparecio ? '<span class="estado ayer">Volvió a aparecer</span>' : h.gravedad === 'r' ? '<span class="estado atrasada">Importante</span>' : '';
    const id = esc(h.id);
    let acciones = '';
    if (puedeMarcar) {
      if (h.estado === 'marcada') acciones = `<div class="fila-accion"><button class="boton claro" data-accion="aud-marcar" data-id="${id}" data-que="deshacer">Deshacer</button><span class="aclara">Mañana lo miramos en MOVE.</span></div>`;
      else if (h.estado === 'dejada') acciones = `<div class="fila-accion"><button class="boton claro" data-accion="aud-marcar" data-id="${id}" data-que="deshacer">Deshacer</button></div>`;
      else acciones = `<div class="fila-accion"><button class="boton claro" data-accion="aud-marcar" data-id="${id}" data-que="corregi">Lo corregí</button>
          <button class="boton claro" data-accion="aud-marcar" data-id="${id}" data-que="otro_dia">Otro día</button></div>
        <details class="otra-situacion"><summary>Prefiero dejarlo así</summary><div class="fila-accion">
          <select data-aud-motivo="${id}" aria-label="Por qué lo dejás así"><option value="">¿Por qué?</option>${MOTIVOS_DEJAR.map(m => `<option>${esc(m)}</option>`).join('')}<option value="otro">Otro motivo</option></select>
          <input type="text" data-aud-nota="${id}" maxlength="200" placeholder="Contá un poco más (opcional)" aria-label="Detalle">
          <button class="boton claro" data-accion="aud-dejar" data-id="${id}">Guardar</button></div>
          <span class="aclara">Coordinación lo ve con tu motivo. No se te vuelve a pedir.</span></details>`;
    }
    return `<article class="tarjeta hallazgo${h.estado === 'marcada' || h.estado === 'dejada' ? ' hecha' : ''}" style="--i:${i}"><div class="cabeza">
        <span class="socio">${esc(h.socio_nombre)}</span>${estado}
        <span class="profe">${esc(SECCION_AUD[h.seccion] || h.seccion)} · desde el ${esc(ddmm(h.desde))}</span>
        ${h.detalle.slice(0, 6).map(t => `<span class="nota">• ${esc(t)}</span>`).join('')}${h.detalle.length > 6 ? `<span class="nota">… y ${h.detalle.length - 6} más</span>` : ''}
        ${h.estado === 'dejada' && h.motivo ? `<span class="nota motivo">🤚 ${esc(h.motivo)}</span>` : ''}
      </div>${acciones}</article>`;
  }

  function bloqueAuditoria(M) {
    const A = M.auditoria;
    if (!A || (!A.pendientes.length && !(A.dejadas || []).length)) return '';
    let i = 0;
    const D = A.dia;
    const filtro = E.audSeccion || '';
    const lista = A.pendientes.filter(h => !filtro || h.seccion === filtro);
    const secciones = [...new Set(A.pendientes.map(h => h.seccion))];
    const listo = D && D.hechas >= D.meta;
    const hoy = D ? `<h2>🧾 Auditoría · tu meta de hoy <span class="cuenta">${D.hechas} de ${D.meta}</span></h2>
      <p class="intro-grupo">Tenés una hora para planificar. ${D.planes_hoy ? `Hoy te ${D.planes_hoy === 1 ? 'toca 1 plan' : `tocan ${D.planes_hoy} planes`} (~${D.min_planes} min)` : 'Hoy no tenés planes'}${D.min_quedan ? `, así que para la auditoría te quedan ~${D.min_quedan} min: con ${plural(D.meta, 'corrección', 'correcciones')} cumplís.` : ': los planes te ocupan la hora, con 1 corrección cumplís.'}${D.al_renovar ? ` Lo de ${plural(D.al_renovar, 'cosa', 'cosas')} de socios que renovás esta semana se corrige al hacerles el plan nuevo.` : ''}</p>
      <div class="avance-dia"><i style="width:${Math.min(100, Math.round(100 * D.hechas / D.meta))}%"></i></div>
      ${listo ? `<div class="vacio">🎉 Listo lo de la auditoría por hoy.${A.cuantos.pendientes ? ' Si te sobra tiempo, abajo está el resto.' : ''}</div>` : ''}
      ${D.lista.map(h => tarjetaHallazgo(h, i++, true)).join('')}` : `<h2>🧾 Auditoría: para corregir <span class="cuenta">${A.cuantos.pendientes}</span></h2>`;
    return `<section class="grupo">${hoy}
      <p class="aclara">Cuando lo corregís en MOVE se cierra solo a la mañana siguiente; si tocás "Lo corregí", lo miramos primero.${A.cuantos.corregidos_semana ? ` Esta semana corregiste ${A.cuantos.corregidos_semana}. 👏` : ''}</p>
      ${A.pendientes.length ? `<details class="catalogo"${E.audAbierto ? ' open' : ''}><summary data-accion="aud-abrir">Ver todo lo pendiente (${A.cuantos.pendientes}), sin apuro</summary>
        <div class="filtros"><button class="chip" data-accion="aud-seccion" data-s="" aria-pressed="${!filtro}">Todo</button>${secciones.map(s => `<button class="chip" data-accion="aud-seccion" data-s="${s}" aria-pressed="${filtro === s}">${esc(SECCION_AUD[s] || s)}</button>`).join('')}</div>
        ${lista.slice(0, 40).map(h => tarjetaHallazgo(h, i++, true)).join('')}${lista.length > 40 ? `<p class="aclara">Y ${lista.length - 40} más.</p>` : ''}
      </details>` : ''}
      ${(A.dejadas || []).length ? `<details class="catalogo"><summary>Lo que preferiste dejar así (${A.cuantos.dejadas})</summary>${A.dejadas.map(h => tarjetaHallazgo(h, i++, true)).join('')}</details>` : ''}
    </section>`;
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

  // Detalle de un día del almanaque: qué profe armó qué plan, a quién, cuántas rutinas y cuánto cambió (Emanuel, 13/11/2026)
  const BANDA_TXT = { sin_modificar: 'casi igual al anterior', poco: 'poco cambio', bien: 'cambio justo (30-80%)', casi_todo: 'casi todo nuevo' };
  function detalleDia(lista, fecha) {
    if (!fecha) return '';
    const filas = lista.map(p => ({ profe: p.profe, items: ((p.coord && p.coord.detalle) || {})[fecha] || [] })).filter(x => x.items.length);
    const cerrar = `<button class="chip" data-accion="alm-dia" data-f="">Cerrar</button>`;
    if (!filas.length) return `<div class="detalle-dia"><div class="detalle-cab"><b>${esc(tituloDia(fecha))}</b>${cerrar}</div><p class="aclara">Ese día no se armó ningún plan.</p></div>`;
    const item = x => {
      const avisos = [];
      if (!x.ok) avisos.push(`<span class="rojo">no cuenta: tiene ${x.r} rutina (mínimo 2)</span>`);
      else if (x.f >= 1.5 && x.r < Math.round(x.f)) avisos.push(`<span class="amarillo">viene ${String(x.f).replace('.', ',')} veces por semana y el plan tiene ${x.r} días</span>`);
      return `<li><b>${esc(x.s)}</b> · ${x.t === 'nuevo' ? 'plan nuevo' : 'renovación'} · ${x.r} ${x.r === 1 ? 'rutina' : 'rutinas'}${x.pct != null ? ` · cambió ${x.pct}% <small>(${esc(BANDA_TXT[x.b] || '')})</small>` : ''}${x.f ? ` · viene ${String(x.f).replace('.', ',')}/semana` : ''}${avisos.length ? '<br>' + avisos.join(' · ') : ''}</li>`;
    };
    return `<div class="detalle-dia"><div class="detalle-cab"><b>${esc(tituloDia(fecha))}</b>${cerrar}</div>
      ${filas.map(f => { const ok = f.items.filter(x => x.ok).length; return `<div class="detalle-profe"><b>${esc(f.profe)}</b>: ${ok} ${ok === 1 ? 'plan' : 'planes'}${f.items.length > ok ? ` <small>(+${f.items.length - ok} que no cuentan)</small>` : ''}<ul>${f.items.map(item).join('')}</ul></div>`; }).join('')}
      <p class="aclara">Un plan cuenta si tiene al menos 2 rutinas (día A y día B). Lo ideal es que tenga tantos días como veces por semana viene el socio. El % compara con su plan anterior.</p></div>`;
  }

  // Membresías: quiénes renovaron (para que el profe lo coteje con su planilla). Sin plata.
  const RESP_VIENE = { sin_preguntar: 'todavía no se preguntó', preguntado: 'recepción lo está confirmando', viene: 'recepción confirmó que viene', no_viene: 'no viene' };
  function bloqueMembresias(M) {
    const L = M.membresias || [];
    if (!L.length) return '';
    const m = L.find(x => x.mes === E.membMes) || L[0];
    return `<section class="grupo"><h2>💳 Renovaron la membresía</h2>
      <p class="intro-grupo">Tus socios que renovaron y vinieron a entrenar en el mes (así cuentan). Si alguien pagó pero no figura que vino, le preguntamos a recepción si está viniendo.</p>
      ${L.length > 1 ? `<div class="filtros">${L.map(x => `<button class="chip" data-accion="memb-mes" data-m="${x.mes}" aria-pressed="${x.mes === m.mes}">${esc(nombreMes(x.mes + '-01'))}</button>`).join('')}</div>` : ''}
      <div class="persona"><div class="cifras"><div class="bien"><strong>${m.renovaciones}</strong><span>renovaron y vinieron</span></div><div><strong>${m.liberados}</strong><span>liberados que vinieron</span></div><div><strong>${m.nuevos}</strong><span>socios nuevos</span></div><div class="${m.sin_venir ? 'mal' : ''}"><strong>${m.sin_venir}</strong><span>pagaron y no figura que vinieron</span></div></div>
      ${m.parcial ? `<span class="aclara">Mes en curso: datos de MOVE hasta el ${esc(ddmm(m.datos_hasta))}.</span>` : ''}</div>
      ${m.renov_lista.length ? `<details class="no-liq"><summary><b>Renovaron (${m.renov_lista.length})</b></summary><ul>${m.renov_lista.map(x => `<li>${esc(x.nombre)}${x.tipo === 'liberado' ? ' <small>(liberado)</small>' : ''}</li>`).join('')}</ul></details>` : ''}
      ${m.sin_venir_lista.length ? `<details class="no-liq"><summary><b>Pagaron y no figura que vinieron (${m.sin_venir_lista.length})</b></summary><ul>${m.sin_venir_lista.map(x => `<li>${esc(x.nombre)} <small class="${ESTADO_VIENE[x.respuesta] ? ESTADO_VIENE[x.respuesta][0] : ''}">${esc(RESP_VIENE[x.respuesta] || '')}</small></li>`).join('')}</ul></details>` : ''}
    </section>`;
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
      ${bloqueMembresias(M)}
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
        ${bloqueTareasMes(M)}${bloquePlanExtra(M)}${proximosSabados(M)}</aside>
      <div class="principal">
      <h1 class="titulo">${esc(tituloDia(E.planes.hoy))} <span>·</span> tus planes</h1>
      ${avisoSabado(M)}
      ${avisoAusencia(M)}
      ${avisoTareasMes(M)}
      <p class="bajada">Primero el socio nuevo, después los vencidos y después los que están por vencer.</p>
      ${bandaConcentrado(M)}
      ${nuevos.length ? `<section class="grupo"><h2>🆕 Plan nuevo, hoy <span class="cuenta">${nuevos.length}</span></h2>${nuevos.map(t => tarjetaPlan(t, i++, true)).join('')}</section>` : ''}
      ${resto.length ? `<section class="grupo"><h2>Para renovar hoy <span class="cuenta">${resto.length}</span></h2>${resto.map(t => tarjetaPlan(t, i++, true)).join('')}</section>`
        : (nuevos.length ? '' : '<div class="vacio">Hoy no tenés planes para renovar. 🎉</div>')}
      ${bloqueCobertura(M)}
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
      return `<div class="alm-dia${finde ? ' finde' : ''}${n ? '' : ' cero'}${marca}${E.almDia === f ? ' elegido' : ''}" data-accion="alm-dia" data-f="${f}" role="button" tabindex="0" style="--int:${(n / max).toFixed(2)}" title="${esc(ddmm(f))}: ${n} plan${n === 1 ? '' : 'es'}${cupo ? ' de ' + cupo : ''}"><em>${esc(f.slice(8, 10))}</em><strong>${n || '·'}</strong>${cupo && !finde ? `<small>de ${cupo}</small>` : ''}</div>`;
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
      ${almanaque(sumarPorDia(con.map(p => p.coord.por_dia)), con[0].coord.desde, con[0].coord.fecha, 'Planes armados por día · todo el equipo · tocá un día para ver el detalle')}
      ${detalleDia(con, E.almDia)}
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
    ${c.por_dia ? `<section class="grupo"><h2>🗓️ Planes por día</h2>${c.cupo ? `<p class="intro-grupo">Su cupo es de ${c.cupo} planes por día hábil, para dejar todo al día en un mes. Desde que arrancó el reparto (${esc(ddmm(c.cupo_desde || c.desde))}) llegó en ${c.dias_cupo} de ${c.dias_habiles} días hábiles.</p>` : ''}${almanaque(c.por_dia, c.desde, c.fecha, 'Tocá un día para ver a quién le armó el plan', c.cupo, c.cupo_desde)}${detalleDia([{ profe: E.profeVer || '', coord: c }], E.almDia)}</section>` : ''}
    ${(c.lista || []).length ? `<section class="grupo"><h2>📅 Vencidos y cuántas veces vino <span class="cuenta">${c.vencidos}</span></h2>
      <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Socio</th><th>Venció</th><th>Vino desde que venció</th><th>Con este plan</th><th>Por semana</th></tr></thead><tbody>
      ${c.lista.map(v => `<tr><td>${esc(v.nombre)}</td><td>${esc(ddmm(v.vence))} · hace ${v.dias} días</td><td class="num ${colorViene(v.vino_vencido)}"><b>${vez(v.vino_vencido)}</b></td><td class="num">${vez(v.vino_plan)}</td><td class="num">${v.por_semana}</td></tr>`).join('')}
      </tbody></table></div></section>` : ''}`;
  }

  // ---------- Horarios y sábados: coordinación los carga, al profe le aparece el aviso (Emanuel, 11/11/2026) ----------
  const DIAS_LETRA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const normN = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const mismoN = (a, b) => { const x = normN(a), y = normN(b); if (!x[0] || !y[0]) return false; const [c, l] = x.length <= y.length ? [x, y] : [y, x]; return c.every(t => l.indexOf(t) >= 0); };
  const sabadoLargo = f => { const d = new Date(f + 'T12:00:00Z'); return 'sábado ' + d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()]; };

  function avisoSabado(M) {
    const s = M.sabados && M.sabados.esta_semana;
    if (!s) return '';
    const hoyEs = s.fecha === E.planes.hoy;
    return `<div class="aviso-sabado" role="status"><span class="aviso-sabado-ico">📅</span><div><b>${hoyEs ? 'Hoy, sábado, te toca trabajar' : 'Este ' + esc(sabadoLargo(s.fecha)) + ' te toca trabajar'}</b>
      <span>En ${esc(SEDES[s.sede] || s.sede)}${s.nota ? ' · ' + esc(s.nota) : ''}. ${hoyEs ? '¡Buen sábado!' : 'Acordate de organizar tu semana.'}</span></div></div>`;
  }

  function proximosSabados(M) {
    const S = M.sabados;
    if (!S || !S.proximos.length) return '';
    return `<div class="persona"><b>🗓️ Tus próximos sábados</b>${S.en_el_mes ? `<span class="aclara">Este mes: ${S.en_el_mes} ${S.en_el_mes === 1 ? 'sábado' : 'sábados'}</span>` : ''}<ul class="lista-sabados">${S.proximos.map(s => `<li>${esc(ddmm(s.fecha))} · ${esc(SEDES[s.sede] || s.sede)}${s.nota ? ` <small>${esc(s.nota)}</small>` : ''}</li>`).join('')}</ul></div>`;
  }

  function sabadosDesde(hoy, atras, n) {
    const d = new Date(hoy + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7) - 7 * atras);
    const out = [];
    for (let i = 0; i < n + atras; i++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 7); }
    return out;
  }

  function profesDeSede(A, sede) {
    const n = [];
    A.horarios.filter(h => h.sede === sede).forEach(h => { if (!n.some(x => mismoN(x, h.profe))) n.push(h.profe); });
    A.profes.filter(p => p.sede === sede).forEach(p => { if (!n.some(x => mismoN(x, p.nombre))) n.push(p.nombre); });
    return n.sort((a, b) => a.localeCompare(b));
  }

  // Feriados: coordinación contesta si se trabaja; si no, se cierra y se puede reordenar
  function preguntaFeriado(A) {
    const lista = (A && A.pregunta_feriado) || [];
    if (!lista.length) return '';
    return lista.map(f => `<div class="aviso-feriado" role="alert"><span class="aviso-sabado-ico">🎌</span><div><b>El ${esc(sabadoLargo(f.fecha))} es feriado: ¿se trabaja?</b>
      <span>${esc(f.nombre)}. Si no se trabaja, el sábado queda cerrado y podés reordenar: cada uno pasa al sábado siguiente, así nadie pierde ni suma de más.</span>
      <div class="fila-accion"><button class="boton verde" data-accion="feriado-resp" data-f="${f.fecha}" data-r="si">Sí, se trabaja</button>
      <button class="boton claro" data-accion="feriado-resp" data-f="${f.fecha}" data-r="no" data-reordenar="1">No: cerrar y reordenar</button>
      <button class="boton claro" data-accion="feriado-resp" data-f="${f.fecha}" data-r="no">No: cerrar sin reordenar</button></div></div></div>`).join('');
  }

  // Quiénes trabajan los sábados: coordinación los tilda por sede
  function bloqueRotacion(A, sedes) {
    return `<div class="rotacion-sedes">${sedes.map(k => {
      const rot = (A.rotaciones || {})[k] || [];
      const edita = A.editables.indexOf(k) >= 0;
      const todos = profesDeSede(A, k);
      rot.forEach(n => { if (!todos.some(x => mismoN(x, n))) todos.push(n); });
      return `<div class="rotacion-sede" data-sede="${k}"><b>${esc(SEDES[k])}</b><span class="aclara">${(A.rotacion_elegida || {})[k] ? 'Elegido por coordinación' : 'Automático: los que están de lunes a viernes'}</span>
        <div class="tildes">${todos.map(n => `<label class="tilde"><input type="checkbox" data-rot="${esc(n)}" ${rot.some(x => mismoN(x, n)) ? 'checked' : ''} ${edita ? '' : 'disabled'}> ${esc(n)}</label>`).join('')}</div>
        ${edita ? `<button class="boton claro" data-accion="rotacion-guardar" data-s="${k}">Guardar quiénes trabajan en ${esc(SEDES[k])}</button>` : ''}</div>`;
    }).join('')}</div>`;
  }

  // Sábados por mes de cada uno (lo cerrado por feriado no cuenta): después se usa para las horas
  function tablaSabadosMes(A, sedes) {
    const hoy = E.planes.hoy;
    const meses = [-1, 0, 1, 2, 3].map(n => { const d = new Date(hoy.slice(0, 7) + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); });
    const nombres = [];
    sedes.forEach(k => (A.rotaciones[k] || []).forEach(n => { if (!nombres.some(x => mismoN(x, n))) nombres.push(n); }));
    (A.por_mes || []).forEach(p => { if (A.sabados.some(s => sedes.indexOf(s.sede) >= 0 && mismoN(s.profe, p.profe)) && !nombres.some(x => mismoN(x, p.profe))) nombres.push(p.profe); });
    if (!nombres.length) return '';
    const cuenta = (n, m) => (A.por_mes || []).filter(p => mismoN(p.profe, n)).reduce((t, p) => t + (p.meses[m] || 0), 0);
    return `<h3 class="sub-coord">Sábados por mes</h3><div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Profe</th>${meses.map(m => `<th class="${m === hoy.slice(0, 7) ? 'mes-actual' : ''}">${esc(nombreMes(m + '-01'))}</th>`).join('')}</tr></thead>
      <tbody>${nombres.map(n => `<tr><td>${esc(n)}</td>${meses.map(m => `<td class="num ${m === hoy.slice(0, 7) ? 'mes-actual' : ''}"><b>${cuenta(n, m) || '·'}</b></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="aclara">Cuenta lo pasado y lo ya cargado para adelante. Los sábados cerrados por feriado no suman.</p>`;
  }

  function filaFranja(h, sedes) {
    const dias = h ? String(h.dias).indexOf('-') > 0 ? (() => { const [a, b] = h.dias.split('-').map(Number); const o = []; for (let i = a; i <= b; i++) o.push(i); return o; })() : String(h.dias).split(',').map(Number) : [0, 1, 2, 3, 4];
    const sede = h ? h.sede : sedes[0];
    if (h && sedes.indexOf(h.sede) < 0) {
      return `<div class="franja solo-ver"><span>${esc(SEDES[h.sede] || h.sede)}</span><span>${dias.map(i => DIAS_LETRA[i]).join(' ')}</span><span>${esc(h.desde)} a ${esc(h.hasta)}</span><small class="aclara">la edita otra coordinación</small></div>`;
    }
    return `<div class="franja" data-franja>
      <select data-h="sede" aria-label="Sede">${sedes.map(k => `<option value="${k}" ${k === sede ? 'selected' : ''}>${esc(SEDES[k])}</option>`).join('')}</select>
      <span class="dias-chk">${DIAS_LETRA.map((l, i) => `<label title="${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][i]}"><input type="checkbox" data-h="d" value="${i}" ${dias.indexOf(i) >= 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</span>
      <input type="time" data-h="desde" value="${esc(h ? h.desde : '08:00')}" aria-label="Desde"> <span>a</span> <input type="time" data-h="hasta" value="${esc(h ? h.hasta : '12:00')}" aria-label="Hasta">
      <button type="button" class="chip" data-accion="horario-quitar" title="Quitar esta franja">✕</button></div>`;
  }

  // ---------- Vacaciones y reemplazos (Emanuel, 13/11/2026) ----------
  const TIPO_AUS = { vacaciones: '🏖️ Vacaciones', licencia: '🩹 Licencia', otro: '📌 Ausencia' };
  function bloqueAusencias(A, editables) {
    const aus = A.ausencias || [];
    const profes = A.profes.filter(p => editables.indexOf(p.sede) >= 0);
    const hoy = E.planes.hoy;
    const fila = a => `<li class="${a.hasta < hoy ? 'pasada' : ''}"><b>${esc(a.profe)}</b> · ${esc(TIPO_AUS[a.tipo] || a.tipo)} del ${esc(ddmm(a.desde))} al ${esc(ddmm(a.hasta))}
      · ${a.reemplazo ? `lo cubre <b>${esc(a.reemplazo)}</b>` : '<span class="amarillo">sin reemplazo: no se le agenda nada esos días</span>'}${a.nota ? ` <small>(${esc(a.nota)})</small>` : ''}
      ${profes.some(p => p.dni === a.profe_dni) ? `<button class="enlace chico" data-accion="aus-borrar" data-id="${esc(a.id)}">quitar</button>` : ''}</li>`;
    const opciones = profes.map(p => `<option value="${esc(p.dni)}">${esc(p.nombre)}</option>`).join('');
    return `<section class="grupo"><h2>🏖️ Vacaciones y reemplazos</h2>
      <p class="intro-grupo">Con reemplazo, los planes de esos días le aparecen al reemplazo como "Cubrís a…" y lo que hace queda a su nombre (se cuenta para liquidarle ese trabajo). Sin reemplazo, no se le agenda nada esos días: se le adelanta antes de irse y se le reparte a la vuelta. La comisión por renovaciones se le liquida igual al profe: son sus socios. Esos sábados tampoco se le asignan.</p>
      ${aus.length ? `<ul class="lista-aus">${aus.map(fila).join('')}</ul>` : '<p class="aclara">No hay vacaciones cargadas.</p>'}
      ${profes.length ? `<div class="form-aus">
        <label>Profe<select data-aus="profe">${opciones}</select></label>
        <label>Desde<input type="date" data-aus="desde" value="${esc(hoy)}"></label>
        <label>Hasta<input type="date" data-aus="hasta" value="${esc(hoy)}"></label>
        <label>Tipo<select data-aus="tipo"><option value="vacaciones">Vacaciones</option><option value="licencia">Licencia</option><option value="otro">Otro</option></select></label>
        <label>Lo cubre<select data-aus="reemplazo"><option value="">Nadie (se le reparte antes y después)</option>${A.profes.map(p => `<option value="${esc(p.dni)}">${esc(p.nombre)}</option>`).join('')}</select></label>
        <label class="ancho">Nota<input type="text" data-aus="nota" placeholder="Opcional"></label>
        <button class="boton verde" data-accion="aus-guardar">Guardar</button></div>` : ''}
    </section>`;
  }

  function avisoAusencia(M) {
    const a = M.ausencia;
    if (!a) return '';
    const hoy = E.planes.hoy;
    const ya = a.desde <= hoy;
    return `<div class="aviso-mes">🏖️ <b>${ya ? 'Estás de ' + esc((TIPO_AUS[a.tipo] || '').replace(/^\S+ /, '').toLowerCase()) + ' hasta el ' + esc(ddmm(a.hasta)) : 'Del ' + esc(ddmm(a.desde)) + ' al ' + esc(ddmm(a.hasta)) + ' tenés ' + esc((TIPO_AUS[a.tipo] || '').replace(/^\S+ /, '').toLowerCase())}.</b>
      ${a.reemplazo ? `Te cubre ${esc(a.reemplazo)}: tus planes de esos días los ve y los hace él/ella.` : (ya ? 'No se te agenda nada: a la vuelta se te reparte lo pendiente.' : 'Antes de irte se te adelantan los planes de esos días.')} Tu comisión por renovaciones se liquida igual.</div>`;
  }

  function bloqueCobertura(M) {
    const C = M.cubriendo || [];
    if (!C.length) return '';
    let i = 500;
    return C.map(c => `<section class="grupo cubriendo"><h2>🔁 Cubrís a ${esc(c.profe)} <span class="cuenta">${c.hoy.length}</span></h2>
      <p class="intro-grupo">Está de ${esc((TIPO_AUS[c.tipo] || '').replace(/^\S+ /, '').toLowerCase())} hasta el ${esc(ddmm(c.hasta))}. Lo que marques queda a tu nombre y se cuenta para tu liquidación.</p>
      ${c.hoy.length ? c.hoy.map(t => tarjetaPlan(t, i++, true)).join('') : '<div class="vacio">Hoy no hay planes para renovar.</div>'}</section>`).join('');
  }

  function vistaAgendaEquipo(propia) {
    const A = E.planes.agenda;
    if (!A) return '<div class="vacio">No tenés acceso a los horarios del equipo.</div>';
    const hoy = E.planes.hoy;
    const sedes = (A.sede ? [A.sede] : Object.keys(SEDES)).filter(k => A.editables.indexOf(k) >= 0 || tiene('admin'));
    const fechas = sabadosDesde(hoy, 2, 16);
    const desdeHoy = fechas[2];
    const celda = (f, sede) => {
      const s = A.sabados.find(x => x.fecha === f && x.sede === sede);
      const editable = A.editables.indexOf(sede) >= 0 && f >= desdeHoy;
      if (!editable) return `<td class="${f < desdeHoy ? 'pasado' : ''}">${s && s.profe ? esc(s.profe) : '—'}${s && s.nota ? `<small class="nota-sab">${esc(s.nota)}</small>` : ''}</td>`;
      const ops = profesDeSede(A, sede);
      if (s && s.profe && !ops.some(o => mismoN(o, s.profe))) ops.push(s.profe);
      return `<td><select data-accion="sabado-elegir" data-f="${f}" data-s="${sede}" aria-label="Quién trabaja el sábado ${ddmm(f)} en ${esc(SEDES[sede])}"><option value="">— nadie cargado —</option>${ops.map(o => `<option value="${esc(o)}" ${s && mismoN(o, s.profe) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>${s && s.nota ? `<small class="nota-sab">${esc(s.nota)}</small>` : ''}</td>`;
    };
    const puedeEditar = A.editables.length > 0;
    const feriado = f => (A.feriados || []).find(x => x.fecha === f);
    const colFecha = f => {
      const fe = feriado(f);
      const marca = fe ? `<span class="marca-feriado ${fe.se_trabaja === 'no' ? 'cerrado' : fe.se_trabaja === 'si' ? 'abierto' : ''}" title="${esc(fe.nombre)}">🎌 ${fe.se_trabaja === 'no' ? 'feriado, cerrado' : fe.se_trabaja === 'si' ? 'feriado, se trabaja' : 'feriado: ¿se trabaja?'}</span>` : '';
      const boton = puedeEditar && f >= desdeHoy ? (fe ? `<button class="enlace chico" data-accion="feriado-quitar" data-f="${f}">quitar feriado</button>` : `<button class="enlace chico" data-accion="feriado-marcar" data-f="${f}">es feriado</button>`) : '';
      return `<td><b>${esc(ddmm(f))}</b>${f === desdeHoy ? ' <small>esta semana</small>' : ''}${marca}${boton}</td>`;
    };
    const cab = k => {
      const rot = (A.rotaciones || {})[k] || [];
      return `<th>${esc(SEDES[k])}${rot.length ? `<small class="rot">Rotan: ${rot.map(n => esc(n.split(' ')[0])).join(' → ')}</small>` : ''}${A.editables.indexOf(k) >= 0 ? `<button class="chip" data-accion="sabado-rotar" data-s="${k}" title="Completa los sábados vacíos: le toca a quien hace más tiempo que no va">↻ Completar la rotación</button>` : ''}</th>`;
    };
    const tabla = `<div class="envoltura-tabla"><table class="tabla compacta tabla-sabados"><thead><tr><th>Sábado</th>${sedes.map(cab).join('')}</tr></thead>
      <tbody>${fechas.map(f => `<tr class="${f === desdeHoy ? 'esta-semana' : ''}${feriado(f) ? ' fila-feriado' : ''}">${colFecha(f)}${sedes.map(k => celda(f, k)).join('')}</tr>`).join('')}</tbody></table></div>`;
    // horarios por profe
    const nombres = [];
    A.horarios.forEach(h => { if ((sedes.indexOf(h.sede) >= 0) && !nombres.some(n => mismoN(n, h.profe))) nombres.push(h.profe); });
    A.profes.forEach(p => { if (sedes.indexOf(p.sede) >= 0 && !nombres.some(n => mismoN(n, p.nombre))) nombres.push(p.nombre); });
    nombres.sort((a, b) => a.localeCompare(b));
    const editables = sedes.filter(k => A.editables.indexOf(k) >= 0);
    const bloqueProfe = n => {
      const suyos = A.horarios.filter(h => mismoN(h.profe, n));
      const horas = Math.round(suyos.reduce((t, h) => { const m = x => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5)); const d = String(h.dias).indexOf('-') > 0 ? Number(h.dias.split('-')[1]) - Number(h.dias.split('-')[0]) + 1 : String(h.dias).split(',').length; return t + d * (m(h.hasta) - m(h.desde)); }, 0) / 6) / 10;
      return `<div class="horario-profe" data-p="${esc(n)}"><div class="horario-cab"><b>${esc(n)}</b><span class="aclara">${suyos.length ? horas + ' h por semana' : 'sin horario cargado'}</span></div>
        <div class="franjas">${suyos.map(h => filaFranja(h, editables)).join('')}</div>
        ${editables.length ? `<div class="fila-accion"><button type="button" class="boton claro" data-accion="horario-agregar">+ Agregar franja</button><button type="button" class="boton verde" data-accion="horario-guardar">Guardar el horario de ${esc(n.split(' ')[0])}</button></div>` : ''}</div>`;
    };
    return `${propia ? '' : '<button class="chip" data-accion="agenda-cerrar">← Volver a los profes</button>'}
      <h1 class="titulo">Horarios y sábados <span>·</span> profes y kinesiólogos</h1>
      <p class="bajada">Lo carga coordinación. A cada profe le aparece un aviso grande en "Mis planes" desde el lunes de la semana en que le toca el sábado.</p>
      <section class="grupo"><h2>🗓️ Quién trabaja cada sábado</h2>
        <p class="intro-grupo">Se arma solo: en cada sede rotan los profes de turno (mañana, tarde y noche; en Lago Puelo, los dos), y cada sábado le toca a quien hace más tiempo que no va. Se completa todas las mañanas para los próximos 4 meses. Podés cambiar cualquier sábado: se guarda al elegir. Si un sábado es feriado, te preguntamos si se trabaja.</p>
        ${preguntaFeriado(A)}
        <h3 class="sub-coord">¿Quiénes trabajan los sábados?</h3>
        <p class="intro-grupo">Solo los profes que rotan los sábados (las kinesiólogas no). Tildá y guardá: los sábados que había armado la rotación desde la semana que viene se rearman con los tildados. Lo que cargaste a mano no se toca.</p>
        ${bloqueRotacion(A, sedes)}
        ${tabla}
        ${tablaSabadosMes(A, sedes)}</section>
      <section class="grupo"><h2>🕒 Horario de cada uno</h2>
        <p class="intro-grupo">Marcá los días y el horario en que cada uno está en la sede. Se usa para proponer las reevaluaciones y para las horas por semana del tablero.</p>
        ${nombres.map(bloqueProfe).join('') || '<div class="vacio">No hay profes cargados.</div>'}</section>
      ${bloqueAusencias(A, editables)}
      <template id="tpl-franja">${filaFranja(null, editables.length ? editables : ['bolson'])}</template>`;
  }

  // ---------- Tareas del mes del profe y comisión (Emanuel, 13/11/2026) ----------
  const plata0 = n => (n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR'));

  function filaTareaMes(t, puede) {
    const id = esc(t.id);
    return `<li class="tmes ${t.hecha ? 'hecha' : ''}"><label class="tmes-tilde"><input type="checkbox" data-tmes="${id}" ${t.hecha ? 'checked' : ''} ${puede ? '' : 'disabled'}><span>${esc(t.texto)}</span></label>
      ${t.pide_nota || t.nota ? `<div class="tmes-nota">${puede ? `<input type="text" data-tmes-nota="${id}" value="${esc(t.nota)}" placeholder="${esc(t.pide_nota || 'Nota')}" aria-label="${esc(t.pide_nota || 'Nota')}"><button class="chip" data-accion="tmes-nota" data-id="${id}">Guardar</button>` : `<small>${esc(t.nota)}</small>`}</div>` : ''}</li>`;
  }

  function bloqueTareasMes(M) {
    const T = M.tareas_mes;
    if (!T || !T.total) return '';
    return `<div class="persona tareas-mes"><b>📋 Tareas del mes <span class="cuenta">${T.hechas}/${T.total}</span></b>
      <span class="avance"><i class="${T.hechas === T.total ? 'verde' : T.dia > 20 ? 'rojo' : 'amarillo'}" style="width:${T.pct}%"></i></span>
      <p class="consejo-mes">${esc(T.consejo)}</p>
      <ul class="lista-tmes">${T.lista.map(t => filaTareaMes(t, true)).join('')}</ul>
      <span class="aclara">Las marcás vos cuando las hiciste. Suman al objetivo "Tarea mensual" (todas: 20 puntos).</span></div>`;
  }

  // Comunicado arriba: al principio del mes, para que no queden para el final
  function avisoTareasMes(M) {
    const T = M.tareas_mes;
    if (!T || !T.total || T.hechas === T.total) return '';
    if (T.dia > 10 && T.dia <= 20) return '';
    const urgente = T.dia > 20;
    return `<div class="aviso-mes ${urgente ? 'urgente' : ''}">📋 <b>${urgente ? 'Se termina el mes' : 'Arranca el mes'}:</b> ${esc(T.consejo)} <span class="aclara">(${T.hechas} de ${T.total} hechas · están en el costado)</span></div>`;
  }

  function vistaTareasMesCoord() {
    const D = E.planes;
    const tm = D.tareas_mes;
    if (!tm) return '';
    const cual = E.tmesCual === 'siguiente' ? tm.siguiente : tm;
    const mesTxt = m => nombreMes(m + '-01') + ' ' + m.slice(0, 4);
    const editor = `<div class="tmes-editor" data-mes="${esc(cual.mes)}">${cual.lista.map(t => `<div class="tmes-fila" data-tmes-fila data-id="${esc(t.id)}"><input type="text" data-c="texto" value="${esc(t.texto)}" aria-label="Tarea"><input type="text" data-c="pide_nota" value="${esc(t.pide_nota)}" placeholder="Qué anotar (opcional)" aria-label="Qué anotar"><button class="chip" data-accion="tmes-quitar" title="Quitar">✕</button></div>`).join('')}</div>
      <div class="fila-accion"><button class="boton claro" data-accion="tmes-agregar">+ Agregar tarea</button><button class="boton verde" data-accion="tmes-guardar">Guardar las tareas de ${esc(mesTxt(cual.mes))}</button></div>
      <template id="tpl-tmes"><div class="tmes-fila" data-tmes-fila data-id=""><input type="text" data-c="texto" value="" placeholder="Nueva tarea" aria-label="Tarea"><input type="text" data-c="pide_nota" value="" placeholder="Qué anotar (opcional)" aria-label="Qué anotar"><button class="chip" data-accion="tmes-quitar" title="Quitar">✕</button></div></template>`;
    const eq = (D.equipo || []).filter(p => p.tareas_mes);
    const tabla = eq.length ? `<div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Profe</th>${tm.lista.map((t, i) => `<th title="${esc(t.texto)}">${i + 1}</th>`).join('')}<th>Hechas</th><th>Puntos</th></tr></thead><tbody>
      ${eq.map(p => `<tr><td>${esc(p.profe)}</td>${tm.lista.map(t => { const x = p.tareas_mes.lista.find(y => y.id === t.id); return `<td class="num ${x && x.hecha ? 'verde' : ''}" title="${esc(x && x.nota || '')}">${x && x.hecha ? '✔' : '·'}</td>`; }).join('')}<td class="num"><b>${p.tareas_mes.hechas}/${p.tareas_mes.total}</b></td><td class="num">${p.tareas_mes.puntos}</td></tr>`).join('')}
      </tbody></table></div><p class="aclara">Pasá el mouse sobre una ✔ para ver lo que anotó. ${tm.lista.map((t, i) => `${i + 1}: ${esc(t.texto)}`).join(' · ')}</p>` : '';
    return `<section class="grupo"><h2>📋 Tareas del mes</h2>
      <p class="intro-grupo">Las ve cada profe en el costado de "Mis planes" y las marca cuando las hizo. Si un mes no tiene tareas cargadas, arranca con las del mes anterior.${tm.origen !== 'cargadas' ? ' <b>Este mes todavía no las cargaste: se están usando ' + (tm.origen === 'base' ? 'las de octubre de las planillas' : 'las del mes anterior') + '.</b>' : ''}</p>
      <div class="filtros"><button class="chip" data-accion="tmes-cual" data-c="actual" aria-pressed="${E.tmesCual !== 'siguiente'}">${esc(mesTxt(tm.mes))}</button><button class="chip" data-accion="tmes-cual" data-c="siguiente" aria-pressed="${E.tmesCual === 'siguiente'}">${esc(mesTxt(tm.siguiente.mes))}</button></div>
      ${editor}
      ${E.tmesCual === 'siguiente' ? '' : `<h3 class="sub-coord">Cómo van</h3>${tabla}`}</section>`;
  }

  // Los que pagaron y no figura que vinieron: por qué no se liquidan y qué contestó recepción
  const ESTADO_VIENE = { sin_preguntar: ['gris', 'Todavía no se le preguntó a recepción'], preguntado: ['amarillo', 'Preguntado a recepción: falta que conteste'], viene: ['verde', 'Recepción confirmó que viene: se liquida'], no_viene: ['rojo', 'No viene: no se liquida (recepción le escribió)'] };
  function noLiquidados(filas) {
    const con = filas.filter(x => (x.l.sin_venir_lista || []).length);
    if (!con.length) return '';
    return `<h3 class="sub-coord">❓ Por qué no se liquidaron</h3>
      <p class="intro-grupo">Pagaron pero en MOVE no figura ninguna asistencia ese mes (ni QR ni lista de la clase). A recepción de la sede del profe le llega la tarea "¿Está viniendo?" con el motivo: si confirma que viene, le pide que escanee el QR y ese mes se liquida; si no viene, le escribe y no se liquida. Del mes anterior se pregunta enseguida; del mes en curso, desde el día 20.</p>
      ${con.map(({ p, l }) => { const c = {}; l.sin_venir_lista.forEach(s => { c[s.respuesta] = (c[s.respuesta] || 0) + 1; });
        return `<details class="no-liq"><summary><b>${esc(p.profe)}</b>: ${l.sin_venir_lista.length} sin asistencia · ${Object.keys(ESTADO_VIENE).filter(k => c[k]).map(k => `<span class="${ESTADO_VIENE[k][0]}">${c[k]} ${{ sin_preguntar: 'sin preguntar', preguntado: 'esperando', viene: 'vienen', no_viene: 'no vienen' }[k]}</span>`).join(' · ')}</summary>
          <ul>${l.sin_venir_lista.map(s => `<li><span>${esc(s.nombre)}</span> <small class="${ESTADO_VIENE[s.respuesta][0]}">${esc(ESTADO_VIENE[s.respuesta][1])}</small></li>`).join('')}</ul></details>`; }).join('')}`;
  }

  function tablaComisiones() {
    const D = E.planes;
    if (!D.ve_liq) return '';
    const eq = (D.equipo || []).filter(p => (p.liq || []).length);
    if (!eq.length) return '<section class="grupo"><h2>💰 Comisión por renovaciones</h2><div class="vacio">Todavía no hay datos: la PC los calcula todas las mañanas.</div></section>';
    const meses = [];
    eq.forEach(p => p.liq.forEach(l => { if (meses.indexOf(l.mes) < 0) meses.push(l.mes); }));
    meses.sort().reverse();
    const mes = E.liqMes && meses.indexOf(E.liqMes) >= 0 ? E.liqMes : meses[0];
    const filas = eq.map(p => ({ p, l: p.liq.find(x => x.mes === mes) })).filter(x => x.l);
    const total = filas.reduce((t, x) => t + (x.l.comision || 0), 0);
    return `<section class="grupo"><h2>💰 Comisión por renovaciones</h2>
      <p class="intro-grupo">Suman los socios que renuevan la membresía y los liberados, <b>solo en los meses en que vinieron a entrenar</b>: si pagó y ese mes no vino, ese mes no suma. Un plan de 3 meses suma uno en cada mes. Los nuevos y los online no suman a la comisión. El nivel sale de los "activos del mes" (nuevos + los que suman) contra las metas de la planilla, según las horas por semana de cada uno. Lo ve solo coordinación con rol admin.</p>
      <div class="filtros">${meses.map(m => `<button class="chip" data-accion="liq-mes" data-m="${m}" aria-pressed="${m === mes}">${esc(nombreMes(m + '-01'))}</button>`).join('')}</div>
      <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Profe</th><th title="Renovaron y vinieron ese mes">Renovaciones</th><th title="Liberados que vinieron ese mes">Liberados</th><th title="Pagaron pero ese mes no vinieron: no suman">No vinieron</th><th>Nuevos</th><th>Activos del mes</th><th>Metas</th><th>Nivel</th><th>Por socio</th><th>Comisión</th><th title="Lo que calculó la planilla, para comparar">Planilla</th></tr></thead><tbody>
      ${filas.map(({ p, l }) => `<tr><td>${esc(p.profe)}</td><td class="num"><b>${l.renovaciones}</b></td><td class="num">${l.liberados}</td><td class="num ${l.sin_venir >= 10 ? 'amarillo' : ''}">${l.sin_venir || 0}${l.confirmados ? `<small> (${l.confirmados} sí vienen)</small>` : ''}</td><td class="num">${l.nuevos}</td><td class="num">${l.activos_mes}</td>
        <td class="num"><small>${l.metas ? l.metas.slice(1).join(' / ') : '—'}</small></td><td>${esc(l.nivel_txt || '—')}${l.parcial && l.faltan_siguiente ? `<small> · le faltan ${l.faltan_siguiente}</small>` : ''}</td>
        <td class="num">${plata0(l.valor_socio)}</td><td class="num"><b>${plata0(l.comision)}</b></td><td class="num ${l.comision_planilla != null && l.comision != null && Math.abs(l.comision_planilla - l.comision) > 1000 ? 'amarillo' : ''}">${plata0(l.comision_planilla)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td><b>Total</b></td><td colspan="8"></td><td class="num"><b>${plata0(total)}</b></td><td></td></tr></tfoot></table></div>
      ${noLiquidados(filas)}
      <p class="aclara">${filas[0].l.parcial ? `Mes en curso: datos de MOVE hasta el ${esc(ddmm(filas[0].l.datos_hasta))}; el nivel todavía puede subir. ` : ''}"No vinieron" en amarillo cuando son 10 o más: conviene revisar si esos socios entrenan sin que quede registrado (sin QR ni lista de la clase). La planilla en amarillo cuando da distinto: algunas planillas multiplican por otras filas (en noviembre, por las bajas). Las kinesiólogas no tienen planilla: se cuentan sus renovaciones pero no hay metas.</p></section>`;
  }

  async function marcarTareaMes(id, hecha) {
    const M = E.planes && E.planes.mio;
    if (!M || !M.tareas_mes) return;
    const t = M.tareas_mes.lista.find(x => x.id === id);
    const campo = [...app.querySelectorAll('[data-tmes-nota]')].find(x => x.dataset.tmesNota === id);
    const nota = campo ? campo.value.trim() : (t ? t.nota : '');
    const marcar = hecha == null ? !!(t && t.hecha) : hecha;
    try {
      M.tareas_mes = await cliente.llamar('profe_tarea_mes_marcar', { tarea_id: id, hecha: marcar, nota });
      render();
      const T = M.tareas_mes;
      aviso(hecha == null ? '📝 Nota guardada.' : marcar ? (T.hechas === T.total ? '🎉 ¡Completaste las tareas del mes!' : `✅ Bien: llevás ${T.hechas} de ${T.total}.`) : '↩️ Desmarcada.');
    } catch (e) { aviso(PulsoApi.mensaje(e.codigo || e.message), true); render(); }
  }

  // ---------- Resumen de coordinación: Estado del Gym con las Analíticas de MOVE (Emanuel, 13/11/2026) ----------
  // Lo mismo que "Estado del Gym" de MOVE Dashboard (semáforo de deserción, meta de ventas, campana de Gauss, estacionalidad,
  // 2025 contra 2026) pero con los cierres mensuales de MOVE en vez de las planillas.
  const MES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const mesTxt = m => MES_CORTO[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(2, 4);
  const num1 = v => (v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ','));
  const semaforo = d => (d == null ? ['gris', 'Sin datos'] : d < 15 ? ['verde', 'Bajo control'] : d < 25 ? ['amarillo', 'Moderada'] : ['rojo', 'Crítica']);
  const mediana = xs => { const a = xs.filter(v => v != null).sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; };

  // Un mes es "a revisar" si la deserción de la sede se despega mucho de lo habitual (por ejemplo, octubre 2026)
  function mesesRaros(sedes) {
    const raros = {};
    sedes.forEach(s => {
      const vals = Object.keys(s.datos).filter(m => s.datos[m].activos >= 20).map(m => s.datos[m].desercion);
      const med = mediana(vals);
      Object.keys(s.datos).forEach(m => { const d = s.datos[m].desercion; if (med && d != null && d > med * 1.8 && d > 30) (raros[m] = raros[m] || []).push(s.nombre + ' ' + num1(d) + '%'); });
    });
    return raros;
  }

  function svgBarras(serie, opciones) {
    const o = Object.assign({ alto: 150, ancho: 640, unidad: '', linea: null }, opciones || {});
    const max = Math.max(1, ...serie.map(x => x.v || 0), o.linea || 0);
    const n = serie.length, an = o.ancho / n;
    const y = v => o.alto - 18 - (v / max) * (o.alto - 34);
    return `<svg class="grafico" viewBox="0 0 ${o.ancho} ${o.alto}" role="img" aria-label="${esc(o.titulo || '')}">
      ${serie.map((x, i) => x.v == null ? '' : `<rect x="${i * an + an * 0.15}" y="${y(x.v)}" width="${an * 0.7}" height="${o.alto - 18 - y(x.v)}" rx="3" class="barra-${x.c || 'azul'}"><title>${esc(x.l)}: ${num1(x.v)}${o.unidad}</title></rect>
        <text x="${i * an + an / 2}" y="${y(x.v) - 3}" text-anchor="middle" class="graf-valor">${num1(x.v)}</text>`).join('')}
      ${serie.map((x, i) => `<text x="${i * an + an / 2}" y="${o.alto - 4}" text-anchor="middle" class="graf-eje">${esc(x.l)}</text>`).join('')}
      ${o.linea != null ? `<line x1="0" x2="${o.ancho}" y1="${y(o.linea)}" y2="${y(o.linea)}" class="graf-media"/><text x="${o.ancho - 2}" y="${y(o.linea) - 3}" text-anchor="end" class="graf-eje">media ${num1(o.linea)}${o.unidad}</text>` : ''}</svg>`;
  }

  function svgLineas(etiquetas, series, unidad) {
    const W = 640, H = 170;
    const vals = series.flatMap(s => s.v.filter(v => v != null));
    const max = Math.max(1, ...vals);
    const x = i => 20 + i * (W - 40) / Math.max(1, etiquetas.length - 1);
    const y = v => H - 22 - (v / max) * (H - 40);
    return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img">
      ${series.map(s => { const pts = s.v.map((v, i) => (v == null ? null : x(i) + ',' + y(v))); const tramos = []; let t = [];
        pts.forEach(p => { if (p) t.push(p); else if (t.length) { tramos.push(t); t = []; } }); if (t.length) tramos.push(t);
        return tramos.map(tr => `<polyline points="${tr.join(' ')}" class="linea-${s.c}"/>`).join('') + s.v.map((v, i) => v == null ? '' : `<circle cx="${x(i)}" cy="${y(v)}" r="3" class="punto-${s.c}"><title>${esc(s.n)} ${esc(etiquetas[i])}: ${num1(v)}${unidad}</title></circle>`).join(''); }).join('')}
      ${etiquetas.map((l, i) => `<text x="${x(i)}" y="${H - 5}" text-anchor="middle" class="graf-eje">${esc(l)}</text>`).join('')}
      </svg><div class="leyenda">${series.map(s => `<span><i class="punto-${s.c}"></i>${esc(s.n)}</span>`).join('')}</div>`;
  }

  // Campana de Gauss: cada profe en su z-score de deserción del mes (como en MOVE Dashboard)
  function svgGauss(filas) {
    const vals = filas.map(f => f.v);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) * (b - m), 0) / vals.length) || 1;
    const W = 640, H = 190, x = z => W / 2 + z * (W - 40) / 6.4, y = d => H - 30 - d * (H - 60);
    const dens = z => Math.exp(-z * z / 2);
    let curva = '', nucleo = '';
    for (let z = -3.2; z <= 3.21; z += 0.1) { curva += x(z) + ',' + y(dens(z)) + ' '; if (Math.abs(z) <= 1.0001) nucleo += x(z) + ',' + y(dens(z)) + ' '; }
    const pts = filas.map(f => Object.assign({}, f, { z: (f.v - m) / sd }));
    return { m, sd, pts, svg: `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Campana de Gauss de la deserción">
      <polygon points="${x(-1)},${y(0)} ${nucleo} ${x(1)},${y(0)}" class="gauss-nucleo"/>
      <polyline points="${curva}" class="gauss-curva"/>
      ${[-2, -1, 0, 1, 2].map(z => `<text x="${x(z)}" y="${H - 12}" text-anchor="middle" class="graf-eje">${z === 0 ? 'media ' + num1(m) + '%' : (z > 0 ? '+' : '') + z + 'σ'}</text>`).join('')}
      ${pts.map((p, i) => { const zz = Math.max(-3.1, Math.min(3.1, p.z)); const fuera = Math.abs(p.z) >= 1.5; const c = !fuera ? 'gris' : p.z > 0 ? 'rojo' : 'verde';
        return `<circle cx="${x(zz)}" cy="${y(dens(zz))}" r="${fuera ? 8 : 6}" class="gauss-punto-${c}"><title>${esc(p.n)}: ${num1(p.v)}% (z=${p.z >= 0 ? '+' : ''}${num1(p.z)})</title></circle>
          <text x="${x(zz)}" y="${y(dens(zz)) - 11 - (i % 2) * 10}" text-anchor="middle" class="graf-valor">${esc(p.n.split(' ')[0])}</text>`; }).join('')}</svg>` };
  }

  function vistaResumenProfes() {
    const D = E.estado;
    if (!D) return '<div class="cargando">Cargando el estado del gym…</div>';
    const sedes = D.filas.filter(f => f.tipo === 'sede');
    const profes = D.filas.filter(f => f.tipo !== 'sede');
    if (!sedes.length) return '<div class="vacio">Todavía no hay datos de MOVE cargados: la PC los sube todas las mañanas.</div>';
    const todosMeses = Object.keys(sedes[0].datos).sort();
    const mesHoy = D.hoy.slice(0, 7);
    const mes = E.estadoMes && todosMeses.indexOf(E.estadoMes) >= 0 ? E.estadoMes : mesHoy;
    const raros = mesesRaros(sedes);
    const prev = m => { const d = new Date(m + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };
    const haceUnAnio = m => (Number(m.slice(0, 4)) - 1) + m.slice(4);
    const chips = todosMeses.slice(-8).map(m => `<button class="chip" data-accion="estado-mes" data-m="${m}" aria-pressed="${m === mes}">${esc(mesTxt(m))}${raros[m] ? ' ⚠️' : ''}</button>`).join('');
    const enCurso = mes === mesHoy;
    const diasMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
    const restan = enCurso ? Math.max(0, diasMes - Number(D.hoy.slice(8, 10))) : 0;

    const tarjetaProfe = p => {
      const d = p.datos[mes] || {}, dp = p.datos[prev(mes)] || {}, d25 = p.datos[haceUnAnio(mes)] || {};
      const [col, txt] = semaforo(d.desercion);
      const ytd = Object.keys(p.datos).filter(m => m.slice(0, 4) === mes.slice(0, 4) && m <= mes && !raros[m] && p.datos[m].desercion != null && p.datos[m].activos >= 5).map(m => p.datos[m].desercion);
      const prom = ytd.length ? ytd.reduce((a, b) => a + b, 0) / ytd.length : null;
      const dif = d.desercion != null && dp.desercion != null ? d.desercion - dp.desercion : null;
      const vs25 = d25.altas && !enCurso ? Math.round((d.altas - d25.altas) / d25.altas * 100) : null;   // el mes en curso todavía no se compara
      return `<div class="estado-card"><div class="estado-cab"><span class="estado-punto ${col}"></span><div><b>${esc(p.nombre.split(' ')[0])}</b>${p.tipo === 'kine' ? ' <small>kine</small>' : ''}
          <span class="${col}">${txt} · ${num1(d.desercion)}% deserción ${esc(MES_CORTO[Number(mes.slice(5, 7)) - 1])}</span></div></div>
        <div class="estado-chips"><div><strong>${d.activos ?? '—'}</strong><span>activos</span></div><div><strong class="verde">${d.altas ?? '—'}</strong><span>altas</span></div><div><strong class="amarillo">${prom != null ? Math.round(prom) + '%' : '—'}</strong><span>prom. año</span></div>
          ${dif != null && Math.abs(dif) >= 0.5 ? `<div><strong class="${dif > 0 ? 'rojo' : 'verde'}">${dif > 0 ? '↑' : '↓'} ${num1(Math.abs(dif))}%</strong><span>vs ${esc(MES_CORTO[Number(prev(mes).slice(5, 7)) - 1])}</span></div>` : ''}</div>
        ${vs25 != null ? `<div class="estado-vs">vs ${esc(haceUnAnio(mes).slice(0, 4))}: <b class="${vs25 >= 0 ? 'verde' : 'rojo'}">${d.altas - d25.altas >= 0 ? '+' : ''}${d.altas - d25.altas} altas (${vs25 >= 0 ? '+' : ''}${vs25}%)</b></div>` : ''}
        ${d.reeval != null ? `<div class="estado-vs">Reevaluó al ${num1(d.reeval)}% · perfil ${num1(d.perfil)}% · objetivo ${num1(d.objetivo)}%</div>` : ''}</div>`;
    };

    const metaSede = s => {
      const d = s.datos[mes] || {};
      const cerrados = Object.keys(s.datos).filter(m => m.slice(0, 4) === mes.slice(0, 4) && m < mes && (s.datos[m].altas || 0) > 0);
      if (!cerrados.length) return '';
      const prom = Math.round(cerrados.reduce((a, m) => a + s.datos[m].altas, 0) / cerrados.length);
      const mejor = cerrados.reduce((a, m) => (s.datos[m].altas > s.datos[a].altas ? m : a), cerrados[0]);
      const mv = s.datos[mejor].altas, act = d.altas || 0;
      if (!enCurso) return `<div class="meta-sede"><b>Ventas · ${esc(mesTxt(mes))}</b><div class="estado-chips"><div><strong>${act}</strong><span>altas del mes</span></div><div><strong class="${act >= prom ? 'verde' : 'rojo'}">${act - prom >= 0 ? '+' : ''}${act - prom}</strong><span>vs promedio (${prom})</span></div><div><strong>${mv}</strong><span>mejor mes (${esc(mesTxt(mejor))})</span></div></div></div>`;
      const techo = d.activos || 0, falta = Math.max(0, techo - act), pct = techo ? Math.round(act / techo * 100) : 0;
      const frase = techo >= mv ? `Si renuevan los <b>${techo}</b> activos sería <b class="verde">récord</b> (supera a ${esc(mesTxt(mejor))}: ${mv}).`
        : techo >= prom ? `Si renuevan los <b>${techo}</b> se supera el promedio (${prom}), pero no alcanza el récord de ${esc(mesTxt(mejor))} (${mv}).`
        : `Aun renovando los <b>${techo}</b> queda por debajo del promedio (${prom}): hacen falta <b class="amarillo">${prom - techo} altas nuevas</b> además de las renovaciones.`;
      return `<div class="meta-sede"><b>🎯 Meta de ventas · ${esc(mesTxt(mes))}</b>
        <div class="estado-chips"><div><strong>${techo}</strong><span>socios a liquidar (techo)</span></div><div><strong class="${pct >= 80 ? 'verde' : pct >= 50 ? 'amarillo' : 'rojo'}">${act}</strong><span>liquidados · ${pct}%</span></div>
          <div><strong class="amarillo">${falta || '✓'}</strong><span>faltan · ${restan} días</span></div><div><strong>${mv}</strong><span>mejor mes · prom ${prom}</span></div></div>
        <p>${frase}${restan && falta ? ` Para que no quede nadie sin renovar hacen falta <b>${num1(falta / restan)} por día</b>.` : ''}</p></div>`;
    };

    // Gauss y homogeneidad: profes (no kines) con datos ese mes
    const conDato = profes.filter(p => p.tipo === 'profe' && p.datos[mes] && p.datos[mes].desercion != null && p.datos[mes].activos >= 10).map(p => ({ n: p.nombre, v: p.datos[mes].desercion }));
    const G = conDato.length >= 3 ? svgGauss(conDato) : null;
    const cv = G ? Math.round(G.sd / (G.m || 1) * 100) : null;
    const outs = G ? G.pts.filter(p => Math.abs(p.z) >= 1.5) : [];

    // Estacionalidad: deserción por mes del año (promedio de los años con datos, sin meses a revisar) contra la media
    const estac = sedes.map(s => {
      const porMes = {};
      Object.keys(s.datos).filter(m => !raros[m] && s.datos[m].activos >= 50 && s.datos[m].desercion != null && s.datos[m].tipo === 'cierre').forEach(m => { (porMes[m.slice(5, 7)] = porMes[m.slice(5, 7)] || []).push(s.datos[m].desercion); });
      const prom = Object.keys(porMes).map(k => ({ k, v: porMes[k].reduce((a, b) => a + b, 0) / porMes[k].length }));
      const media = prom.length ? prom.reduce((a, b) => a + b.v, 0) / prom.length : null;
      return { s, media, prom };
    });
    const proxMes = String(Number(D.hoy.slice(5, 7)) % 12 + 1).padStart(2, '0');

    const anios = [...new Set(todosMeses.map(m => m.slice(0, 4)))];
    return `<h1 class="titulo">Resumen <span>·</span> estado del gym</h1>
      <p class="bajada">Con los cierres mensuales de MOVE (Analíticas), no con las planillas. Datos al ${esc(ddmm(sedes[0].cargada))}. El mes en curso se actualiza cada mañana.</p>
      <div class="filtros">${chips}</div>
      ${raros[mes] ? `<div class="aviso-mes urgente">⚠️ <b>Dato a revisar:</b> en ${esc(mesTxt(mes))} MOVE da una deserción que se despega mucho de lo habitual (${esc(raros[mes].join(' · '))}). Puede ser un problema del cálculo de MOVE ese mes: conviene consultarlo con Teo antes de sacar conclusiones. Este mes no entra en los promedios ni en la estacionalidad.</div>` : ''}
      ${sedes.map(s => `<section class="grupo estado-sede"><h2>📍 ${esc(s.nombre)}</h2>${metaSede(s)}
        <div class="estado-lista">${profes.filter(p => p.sede === s.sede).map(tarjetaProfe).join('') || '<div class="vacio">Sin profes.</div>'}</div></section>`).join('')}
      ${G ? `<section class="grupo"><h2>🔔 Campana de Gauss · deserción de ${esc(mesTxt(mes))}</h2>
        <p class="intro-grupo">Cada profe ubicado según cuánto se aparta de la media del equipo. La zona sombreada es lo típico (±1σ); más allá de ±1,5σ se considera fuera de lo común.</p>${G.svg}
        <p>${outs.length ? outs.map(p => `<b class="${p.z > 0 ? 'rojo' : 'verde'}">${esc(p.n.split(' ')[0])}</b> ${p.z > 0 ? 'a acompañar (deserción alta)' : 'como referente (deserción baja)'}`).join(' · ') : `Equipo parejo: nadie se aparta más de 1,5σ de la media (${num1(G.m)}%).`}
          Homogeneidad entre profes: <b class="${cv < 15 ? 'verde' : cv < 30 ? 'amarillo' : 'rojo'}">${cv}% de variación</b> (${cv < 15 ? 'muy parejo' : cv < 30 ? 'variación moderada' : 'mucha dispersión entre profes'}).</p></section>` : ''}
      <section class="grupo"><h2>📅 Estacionalidad · meses de riesgo</h2>
        <p class="intro-grupo">Deserción promedio de cada mes del año (con los años que tiene MOVE, sin los meses a revisar), contra la media de la sede. En rojo, los meses 20% o más por encima: ahí conviene adelantar reevaluaciones y contacto.</p>
        ${estac.filter(e => e.media).map(e => { const serie = MES_CORTO.map((l, i) => { const k = String(i + 1).padStart(2, '0'); const x = e.prom.find(p => p.k === k); return { l, v: x ? x.v : null, c: !x ? 'gris' : x.v >= e.media * 1.2 ? 'rojo' : x.v >= e.media ? 'amarillo' : 'verde' }; });
          const px = e.prom.find(p => p.k === proxMes);
          return `<h3 class="sub-coord">${esc(e.s.nombre)}</h3>${svgBarras(serie, { unidad: '%', linea: e.media, titulo: 'Estacionalidad ' + e.s.nombre })}
            <p class="aclara">${px && px.v >= e.media * 1.2 ? `<b class="rojo">Atención: el mes que viene (${esc(MES_CORTO[Number(proxMes) - 1])}) suele tener más bajas (${num1(px.v)}% contra ${num1(e.media)}% de media).</b> Conviene trabajar a los socios en riesgo este mes.` : `El mes que viene (${esc(MES_CORTO[Number(proxMes) - 1])}) no figura entre los de más bajas.`}</p>`; }).join('')}</section>
      <section class="grupo"><h2>📈 Deserción mes a mes · ${anios.join(' contra ')}</h2>
        ${sedes.map(s => `<h3 class="sub-coord">${esc(s.nombre)}</h3>${svgLineas(MES_CORTO, anios.map((a, i) => ({ n: a, c: ['gris', 'rojo', 'azul'][i % 3], v: MES_CORTO.map((_, k) => { const m = a + '-' + String(k + 1).padStart(2, '0'); const d = s.datos[m]; return d && d.activos >= 20 && !raros[m] ? d.desercion : null; }) })), '%')}`).join('')}
        <p class="aclara">Los puntos que faltan son meses sin datos en MOVE (empezó a usarse a mediados de 2025; Bariloche, en 2026) o marcados como a revisar.</p></section>
      <section class="grupo"><h2>🧾 Altas por mes (nuevos + renovaciones)</h2>
        ${sedes.map(s => `<h3 class="sub-coord">${esc(s.nombre)}</h3>${svgBarras(todosMeses.filter(m => (s.datos[m].altas || 0) > 0).slice(-12).map(m => ({ l: mesTxt(m), v: s.datos[m].altas, c: m === mesHoy ? 'amarillo' : 'azul' })), {})}`).join('')}</section>`;
  }

  function vistaProfes() {
    if (!E.planes) return '<div class="cargando">Cargando los profes…</div>';
    if (E.agendaVer && E.planes.agenda) return vistaAgendaEquipo();
    if (E.tmesVer && E.planes.tareas_mes) return `<button class="chip" data-accion="tmes-cerrar">← Volver a los profes</button><h1 class="titulo">Tareas del mes${E.planes.ve_liq ? ' y comisiones' : ''}</h1>${vistaTareasMesCoord()}${tablaComisiones()}`;
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
          ${p.auditoria ? `<div class="personas">${puntajeAuditoria(p.auditoria, 'Auditoría')}</div>${(p.auditoria.dejadas || []).length ? `<section class="grupo"><h2>🤚 Prefirió dejarlo así <span class="cuenta">${p.auditoria.cuantos.dejadas}</span></h2><p class="intro-grupo">Lo que la auditoría marcó y el profe decidió no cambiar, con su motivo.</p>${p.auditoria.dejadas.map(h => tarjetaHallazgo(h, i++, false)).join('')}</section>` : ''}${p.auditoria.pendientes.length ? `<section class="grupo"><h2>🧾 Para corregir <span class="cuenta">${p.auditoria.cuantos.pendientes}</span></h2>${p.auditoria.pendientes.map(h => tarjetaHallazgo(h, i++, false)).join('')}</section>` : ''}` : ''}
          ${p.revisiones && p.revisiones.lista.length ? `<section class="grupo"><h2>🔎 Planes renovados (30 días) <span class="cuenta">${p.revisiones.lista.length}</span></h2>${p.revisiones.lista.map(r => tarjetaRevision(r, i++, false)).join('')}</section>` : ''}`;
      }
    }
    return `<h1 class="titulo">Profes <span>·</span> planes al día</h1>
      <p class="bajada">Lo que cada profe y cada kinesiólogo tiene que renovar hoy, lo atrasado y lo que lleva hecho en el mes.</p>
      ${selector}
      ${E.planes.agenda ? preguntaFeriado(E.planes.agenda) : ''}
      ${tablaEquipo(eq)}
      ${bloqueProfes()}
      ${eq.length ? `<div class="personas">${eq.map(p => `<div class="persona"><b>${esc(p.profe)}</b><span class="turno">${p.con_usuario ? 'Con usuario' : 'Todavía sin usuario en PulsoMOVE'}</span>${cifrasPlanes(p.resumen)}${p.auditoria && p.auditoria.puntaje != null ? `<span class="uso-hoy aud-linea ${(NIVEL_AUD[p.auditoria.nivel] || [''])[0]}">🧾 Auditoría: <b>${p.auditoria.puntaje}</b> ${esc((NIVEL_AUD[p.auditoria.nivel] || ['', ''])[1])}${p.auditoria.cambio_semana ? ` (${p.auditoria.cambio_semana > 0 ? '▲' : '▼'} ${Math.abs(p.auditoria.cambio_semana)})` : ''} · ${p.auditoria.cuantos.pendientes} para corregir${p.auditoria.cuantos.no_corregidos ? ` · ${p.auditoria.cuantos.no_corregidos} dijo que corrigió y sigue` : ''}${p.auditoria.cuantos.dejadas ? ` · ${p.auditoria.cuantos.dejadas} dejó así` : ''}</span>` : ''}${p.dias ? `<span class="uso-hoy">Días completos este mes: ${p.dias.completos} (en menos de 1 hora: ${p.dias.en_una_hora})${p.revisiones && p.revisiones.resumen.minutos_mediana != null ? ` · arma un plan en ~${p.revisiones.resumen.minutos_mediana} min` : ''}${p.resumen.en_papel ? ` · en papel: ${p.resumen.en_papel}` : ''}</span>` : ''}${p.revisiones ? `<span class="uso-hoy">Planes renovados (30 días): ${p.revisiones.resumen.revisados} · en 30-80%: ${p.revisiones.resumen.en_rango} · casi todo cambiado: ${p.revisiones.resumen.casi_todo}${p.revisiones.resumen.con_saltos ? ` · con saltos: ${p.revisiones.resumen.con_saltos} (${p.revisiones.resumen.saltos_sin_responder} sin responder, ${p.revisiones.resumen.corregir} a corregir)` : ''}</span>` : ''}
${p.tareas_mes ? `<span class="uso-hoy">📋 Tareas del mes: ${p.tareas_mes.hechas}/${p.tareas_mes.total}</span>` : ''}${p.ausente ? `<span class="uso-hoy amarillo">🏖️ De ${esc(p.ausente.tipo)} hasta el ${esc(ddmm(p.ausente.hasta))}${p.ausente.reemplazo ? ' · lo cubre ' + esc(p.ausente.reemplazo.split(' ')[0]) : ' · sin reemplazo'}</span>` : ''}${p.cubrio_mes ? `<span class="uso-hoy">🔁 Este mes hizo ${p.cubrio_mes} ${p.cubrio_mes === 1 ? 'plan' : 'planes'} cubriendo a otro profe</span>` : ''}
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
      </section>${incentivo}${bloqueEscalon(p)}${bloqueNuevosPersona(p, E.rend && E.rend.mes)}<div class="tablero-columnas">${graficoDias(p.serie)}${propia ? '' : bloqueUso(p) + bloqueTiempos(p)}${grupos}${bloqueVentasPersona(p)}${ventas}${actividad}</div>
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
      ${bloqueNuevosEquipo(R)}${aclaracionDatos(R)}${bloqueEficiencia(R)}${bloqueCierres()}`;
  }

  // Socios nuevos mes a mes: es la venta que más pesa. Sale de lo cargado en Liquidación (planilla de recepción) y, si no hay, de las cajas del mes entero.
  const NOTA_NUEVOS = 'Los meses con * salen de las cajas de MOVE (cuentan para quien abrió la caja, desde el día 1); el resto, de la planilla de recepción o de lo cargado en Liquidación.';
  function barrasNuevos(serie, actual) {
    const max = Math.max(1, ...serie.map(s => s.nuevos));
    return `<div class="liq-barras">${serie.map(s => `<div class="liq-barra${s.mes === actual ? ' elegida' : ''}" title="${esc(nombreMes(s.mes))}: ${s.nuevos} socios nuevos"><span class="liq-v">${s.nuevos}</span><div class="liq-pila" style="height:${Math.max(3, Math.round(s.nuevos / max * 100))}%"><i class="b-base" style="flex:1"></i></div><span class="mes">${esc(liqMesCorto(s.mes))}${s.fuente === 'cajas' ? '*' : ''}</span></div>`).join('')}</div>`;
  }
  // Cuánto falta para el próximo escalón de la comisión (ver liqEscalon en el backend)
  function bloqueEscalon(p) {
    const e = p.escalon;
    if (!e) return '';
    const num = n => String(Math.round(Number(n) * 10) / 10).replace('.', ',');
    const s = e.siguiente;
    const previo = e.tramo > 0 ? e.metas[e.tramo] : 0;
    const avance = s ? Math.min(100, Math.max(0, Math.round((e.nuevos - previo) / Math.max(1, s.meta - previo) * 100))) : 100;
    const ritmo = e.tramo_proyectado == null ? '' : e.tramo_proyectado > e.tramo
      ? `Al ritmo de este mes llegarías a ${num(e.proyeccion)} y pasarías a ${esc(e.etiqueta_proyectada)}.`
      : e.tramo_proyectado < e.tramo ? `Al ritmo de este mes terminarías en ${num(e.proyeccion)}: ojo, bajarías a ${esc(e.etiqueta_proyectada)}.`
        : `Al ritmo de este mes terminarías en ${num(e.proyeccion)}.`;
    const detalle = e.maximo ? `Estás en el máximo (${esc(e.etiqueta)}): cada socio nuevo vale ${plata(e.tarifa)}.`
      : `Te faltan <b>${s.faltan}</b> para ${esc(s.etiqueta)} (${num(s.meta)}). ${e.dias_restantes ? `Quedan ${e.dias_restantes} días${s.por_dia ? (s.por_dia < 1 ? `: alcanza con uno cada ${Math.max(1, Math.round(1 / s.por_dia))} días` : `: son ${num(s.por_dia)} por día`) : ''}.` : 'El mes terminó.'} Tu comisión pasaría de ${plata(s.comision_hoy)} a ${plata(s.comision_al_llegar)}.`;
    return `<section class="bloque escalon"><div class="bloque-cab"><h2>🎯 Tu próximo escalón</h2><span class="sello">${esc(e.etiqueta)} · ${plata(e.tarifa)} c/u</span></div>
      <div class="metrica-fila"><span class="metrica-nombre">Socios nuevos de ${esc(nombreMes(e.mes))}</span><span class="metrica-valor"><b>${e.nuevos}</b>${s ? ' / ' + num(s.meta) : ''}</span></div>
      <div class="medidor"><i class="${avance >= 100 ? 'bien' : avance >= 50 ? 'cerca' : 'lejos'}" style="width:${avance}%"></i></div>
      <p class="aclara">${detalle} ${ritmo}</p></section>`;
  }

  function bloqueNuevosPersona(p, mes) {
    const S = (p.nuevos_meses || []).slice(-9);
    if (!S.length) return '';
    return `<section class="bloque"><div class="bloque-cab"><h2>⭐ Socios nuevos mes a mes</h2><span class="sello">${S.reduce((a, s) => a + s.nuevos, 0)} en ${S.length} meses</span></div>${barrasNuevos(S, mes)}
      ${S.some(s => s.fuente === 'cajas') ? `<p class="aclara">${NOTA_NUEVOS}</p>` : ''}</section>`;
  }
  function bloqueNuevosEquipo(R) {
    const con = R.personas.filter(p => (p.nuevos_meses || []).length);
    if (!con.length) return '';
    const meses = Array.from(new Set(con.reduce((a, p) => a.concat(p.nuevos_meses.map(s => s.mes)), []))).sort().slice(-8);
    const celda = (p, m) => { const s = p.nuevos_meses.find(x => x.mes === m); return s ? `<td class="num${m === R.mes ? ' actual' : ''}">${s.nuevos}${s.fuente === 'cajas' ? '*' : ''}</td>` : `<td class="num">—</td>`; };
    const total = m => con.reduce((a, p) => a + ((p.nuevos_meses.find(x => x.mes === m) || {}).nuevos || 0), 0);
    return `<section class="bloque"><div class="bloque-cab"><h2>⭐ Socios nuevos mes a mes</h2><span class="sello">La venta que más pesa</span></div>
      <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Persona</th>${meses.map(m => `<th>${esc(liqMesCorto(m))}</th>`).join('')}</tr></thead>
      <tbody>${con.map(p => `<tr><td><b>${esc(p.nombre)}</b></td>${meses.map(m => celda(p, m)).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><td><b>Equipo</b></td>${meses.map(m => `<td class="num"><b>${total(m)}</b></td>`).join('')}</tr></tfoot></table></div>
      <p class="aclara">${NOTA_NUEVOS}</p></section>`;
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

  // Coberturas y cambios de turno: son eventuales. Lo que se carga acá ajusta solo las horas de la liquidación del mes.
  function bloqueCoberturas() {
    const C = E.cob;
    if (!C) return '';
    const nombre = dni => (C.personas.find(p => p.dni === dni) || {}).nombre || '';
    const opciones = (vacio) => (vacio ? '<option value="">Nadie (horas extra)</option>' : '<option value="">Elegí…</option>') + C.personas.map(p => `<option value="${esc(p.dni)}">${esc(p.nombre)}${tiene('admin') ? ' · ' + esc(SEDES[p.sede] || '') : ''}</option>`).join('');
    const lista = C.coberturas.map(c => `<div class="fila-cob"><span><b>${esc(c.cubre)}</b> ${c.titular ? 'cubrió a <b>' + esc(c.titular) + '</b>' : 'hizo horas extra'} · ${ddmm(c.fecha)} · ${String(c.horas).replace('.', ',')} h · ${esc(c.motivo || '')}${c.titular && !c.descuenta ? ' · con goce' : ''}${c.nota ? ' · ' + esc(c.nota) : ''}</span>
      <button class="chip" data-accion="cob-borrar" data-id="${esc(c.id)}">Quitar</button></div>`).join('');
    return `<section class="grupo"><h2>🔁 Coberturas y cambios de turno <span class="cuenta">${C.coberturas.length}</span></h2>
      <p class="bajada">Cuando alguien cubre a otra persona o cambia el horario por un día. Se suma a quien cubre y se descuenta a quien faltó, y la liquidación del mes se ajusta sola. Es eventual: no cambia el horario fijo de nadie.</p>
      <form data-form="cob-guardar" class="liq-fila">
        <label class="campo">Día<input name="fecha" type="date" value="${esc(C.hoy)}" required></label>
        <label class="campo">Quién cubrió<select name="cubre" required>${opciones(false)}</select></label>
        <label class="campo">A quién cubrió<select name="titular">${opciones(true)}</select></label>
        <label class="campo">Horas<input name="horas" type="number" step="0.5" min="0.5" max="16" value="6" inputmode="decimal" required></label>
        <label class="campo">Motivo<select name="motivo">${C.motivos.map(m => `<option>${esc(m)}</option>`).join('')}</select></label>
        <label class="campo">Nota<input name="nota" maxlength="200" placeholder="Opcional"></label>
        <label class="campo"><span><input name="goce" type="checkbox"> Se le paga igual a quien faltó</span></label>
        <div class="botones"><button class="boton verde">Guardar cobertura</button></div></form>
      ${lista ? `<div class="lista-cob">${lista}</div>` : '<div class="vacio">No hay coberturas cargadas este mes.</div>'}</section>`;
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
        ${p.esperan_move ? `<span class="aclara">Además tiene ${p.esperan_move} ${p.esperan_move === 1 ? 'tarea que espera' : 'tareas que esperan'} a MOVE: no le cuentan como pendientes.</span>` : ''}
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
      ${bloqueCoberturas()}
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
        // los dos pedidos a la vez: antes uno esperaba al otro
        const [r, dia] = await Promise.all([cliente.llamar('mis_tareas', E.adelantar ? { adelantar: true } : {}), cliente.llamar('mi_dia')]);
        E.paraAdelantar = r.para_adelantar || 0;
        E.dia = dia;
        actualizarRoles(E.dia.roles);
        if (E.dia.cartel && !E.dia.cartel.visto) cartelInicio(E.dia.cartel.clave);
        if (!E.ultimaMarca) E.ultimaMarca = Date.now();
        saludarUnaVez();
        revisarAvisos();
        cargarPaseSinLeer();
        const locales = {};
        (E.tareas || []).forEach(t => { if (t.resultado_local) locales[t.id] = t.resultado_local; });
        E.hoy = r.hoy;
        E.tareas = r.tareas.map(t => Object.assign(t, locales[t.id] ? { resultado_local: locales[t.id] } : {}));
      } else if (E.vista === 'sede' && E.personaDni) {
        E.persona = await cliente.llamar('tareas_de', { dni: E.personaDni });
      } else if (E.vista === 'sede') {
        E.sede = await cliente.llamar('sede', tiene('admin') ? { sede: E.sedeElegida } : {});
        cliente.llamar('coberturas_ver', {}).then(c => { E.cob = c; if (E.vista === 'sede' && !E.personaDni) render(); }).catch(() => {});
      } else if (E.vista === 'mes') {
        E.rend = await cliente.llamar('rendimiento', Object.assign(E.rendMes ? { mes: E.rendMes } : {}, tiene('admin') ? { sede: cliente.sesion().sede } : {}));
        recordar(claveRend('mes'), E.rend);
      } else if (E.vista === 'rend') {
        cliente.llamar('cierres_ver').then(c => { E.cierres = c.cierres; E.cierresResumen = c.resumen; if (E.vista === 'rend' && !E.rendDni) render(); }).catch(() => {});
        E.rend = await cliente.llamar('rendimiento', Object.assign(E.rendMes ? { mes: E.rendMes } : {}, tiene('admin') ? { sede: E.sedeElegida } : {}));
        recordar(claveRend('rend'), E.rend);
      } else if (E.vista === 'consultas') {
        E.cons = await cliente.llamar('consultas_ver', tiene('admin') && E.sedeElegida ? { sede: E.sedeElegida } : {});
      } else if (E.vista === 'pase') {
        E.pase = await cliente.llamar('pase_ver', tiene('admin') && E.sedeElegida ? { sede: E.sedeElegida } : {});
        E.paseSinLeer = E.pase.sin_leer;
      } else if (E.vista === 'resumen') {
        E.resumen = await cliente.llamar('resumen_semanal', E.resumenActual ? { actual: true } : {});
      } else if (E.vista === 'liq') {
        E.liq = await cliente.llamar('liquidacion_ver', E.liqMes ? { mes: E.liqMes } : {});
        E.liqMes = E.liq.mes;
      } else if (E.vista === 'chat') {
        await cargarChat();
        render();
      } else if (E.vista === 'reservas') {
        E.ocupacion = await cliente.llamar('ocupacion_ver', tiene('admin') || tiene('coordinador') ? { sede: E.sedeElegida } : {});
      } else if (E.vista === 'planes' || E.vista === 'profes' || E.vista === 'pmes' || E.vista === 'phor' || E.vista === 'pliq') {
        if (E.vista === 'profes') cliente.llamar('profes_ver', tiene('admin') ? { sede: E.sedeElegida } : {}).then(c => { E.profes = c.filas; if (E.vista === 'profes' && !E.profeVer && !E.agendaVer) render(); }).catch(() => {});
        const vistaPlanes = E.vista;
        E.planes = await cliente.llamar('profe_tareas', ['profes', 'phor', 'pliq'].indexOf(vistaPlanes) >= 0 && tiene('admin') ? { sede: E.sedeElegida } : {});
        recordar(clavePlanes(vistaPlanes), E.planes);
        if (E.vista === 'planes') programarConsejos();
      } else if (E.vista === 'pres') {
        E.estado = await cliente.llamar('profe_estado', {});
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

  // Velocidad (13/11/2026): al volver a una pestaña se muestra al instante lo último que se cargó y se actualiza por detrás.
  const MEMORIA = {};
  const clavePlanes = v => (['profes', 'phor', 'pliq'].indexOf(v) >= 0 ? 'equipo|' + (tiene('admin') ? E.sedeElegida : '') : 'mio');
  const claveRend = v => v + '|' + (E.rendMes || '') + '|' + (tiene('admin') ? E.sedeElegida : '');
  function recordar(clave, dato) { if (dato) MEMORIA[clave] = dato; }

  function irA(vista) {
    E.vista = vista;
    E.chatAbierta = null; E.chatConv = null; E.chatNuevo = false; E.chatSumar = false; E.chatBorrador = '';
    E.abierta = null;
    E.personaDni = null;
    E.persona = null;
    E.rend = MEMORIA[claveRend(vista)] || null;
    E.rendDni = null;
    E.liqDni = null; E.liqBorrador = null;
    E.planes = MEMORIA[clavePlanes(vista)] || null;
    E.profeVer = null; E.agendaVer = false; E.tmesVer = false;
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

  // ---------- Consultas con seguimiento (embudo) ----------
  const ESTADOS_CONSULTA = { abierta: 'Abierta', visita: 'Quedó en venir', prueba: 'Hizo la prueba', vendida: 'Se anotó', perdida: 'No siguió' };
  const INTERES_TXT = { alto: 'interés alto', medio: 'interés medio', exploratorio: 'explorando' };

  function vistaConsultas() {
    const C = E.cons;
    const selector = tiene('admin') ? `<div class="filtros">${Object.keys(SEDES).map(k => `<button class="chip" data-accion="cons-sede" data-s="${k}" aria-pressed="${(E.sedeElegida || C && C.sede) === k}">${SEDES[k]}</button>`).join('')}</div>` : '';
    if (!C) return selector + '<div class="cargando">Cargando las consultas…</div>';
    const em = C.embudo;
    const pct = em.consultas ? Math.round(em.vendida / em.consultas * 100) : 0;
    const dato = (n, v, sub) => `<div class="dato"><strong>${v}</strong><span>${esc(n)}</span>${sub ? `<em>${esc(sub)}</em>` : ''}</div>`;
    const tarjeta = c => {
      const abierta = ['abierta', 'visita', 'prueba'].indexOf(c.estado) >= 0;
      return `<article class="tarjeta cons ${c.vencida ? 'vencida' : ''}"><div class="cabeza" style="display:grid;gap:2px;padding:12px 14px">
          <span class="socio">${esc(c.nombre)} <span class="sello">${esc(ESTADOS_CONSULTA[c.estado] || c.estado)}</span></span>
          <span class="profe">${esc(c.canal || '')} · ${esc(INTERES_TXT[c.interes] || c.interes || '')} · ${ddmm(c.fecha)}${c.quien ? ' · ' + esc(c.quien) : ''}${c.detalle ? ' · ' + esc(c.detalle) : ''}</span>
          ${c.proximo_fecha ? `<span class="situacion">${c.vencida ? '⏰ Para hoy o atrasado' : 'Próximo paso'} · ${ddmm(c.proximo_fecha)}${c.proximo_paso ? ': ' + esc(c.proximo_paso) : ''}</span>` : ''}
          ${c.nota ? `<span class="aclara">${esc(c.nota)}</span>` : ''}</div>
        <details class="liq-dias"><summary>${abierta ? 'Actualizar' : 'Reabrir o corregir'}</summary>
          <form data-form="cons-guardar" data-id="${esc(c.id)}" class="liq-fila">
            <label class="campo">Cómo está<select name="estado">${Object.keys(ESTADOS_CONSULTA).map(k => `<option value="${k}"${k === c.estado ? ' selected' : ''}>${esc(ESTADOS_CONSULTA[k])}</option>`).join('')}</select></label>
            <label class="campo">Próximo paso el<input name="fecha" type="date" value="${esc(c.proximo_fecha)}"></label>
            <label class="campo">Qué hacer<input name="paso" maxlength="160" value="${esc(c.proximo_paso)}" placeholder="Ej.: confirmar la visita"></label>
            <label class="campo">Nota<input name="nota" maxlength="300" value="${esc(c.nota)}"></label>
            <div class="botones"><button class="boton verde">Guardar</button></div></form></details></article>`;
    };
    return `${selector}<h1 class="titulo">Consultas <span>·</span> ${esc(SEDES[C.sede] || '')}</h1>
      <p class="bajada">Cada consulta que registrás sigue acá hasta que se anota o no sigue. El próximo paso aparece solo en tus tareas del día.</p>
      <section class="bloque"><div class="datos">${dato('Consultas del mes', em.consultas)}${dato('Quedaron en venir', em.visita)}${dato('Hicieron la prueba', em.prueba)}${dato('Se anotaron', em.vendida, pct + '% de las consultas')}${dato('Para hoy', em.para_hoy, em.abiertas + ' abiertas')}</div></section>
      ${C.consultas.length ? C.consultas.map(tarjeta).join('') : '<div class="vacio">No hay consultas registradas en los últimos 60 días.</div>'}
      <p class="aclara">Las consultas se cargan con “Registrar mensaje, consulta o venta”. Acá solo se les da seguimiento.</p>`;
  }

  // ---------- Pase de turno ----------
  function vistaPase() {
    const P = E.pase;
    if (!P) return '<div class="cargando">Cargando el pase de turno…</div>';
    const lineas = t => esc(t).split('\n').filter(x => x.trim()).map(x => `<li>${x}</li>`).join('');
    const bloque = (titulo, t) => (t ? `<div class="pase-bloque"><b>${titulo}</b><ul>${lineas(t)}</ul></div>` : '');
    return `<h1 class="titulo">Pase de turno <span>·</span> ${esc(SEDES[P.sede] || '')}</h1>
      <p class="bajada">Lo que le dejás a quien sigue: qué quedó pendiente, quién espera respuesta y qué novedades hay de sala o de caja.</p>
      <section class="bloque"><div class="bloque-cab"><h2>Dejar un pase</h2></div>
        <form data-form="pase-guardar">
          <label class="campo">Qué quedó pendiente<textarea name="pendientes" rows="3" maxlength="700" placeholder="Una cosa por renglón"></textarea></label>
          <label class="campo">Quién espera respuesta<textarea name="esperando" rows="3" maxlength="700" placeholder="Nombre y qué espera"></textarea></label>
          <label class="campo">Novedades de sala o de caja<textarea name="novedades" rows="3" maxlength="700"></textarea></label>
          <div class="botones"><button class="boton verde">Dejar el pase</button></div></form></section>
      <section class="grupo"><h2>Últimos pases <span class="cuenta">${P.pases.length}</span></h2>
        ${P.pases.length ? P.pases.map(p => `<article class="tarjeta pase ${p.leido ? '' : 'sin-leer'}"><div class="cabeza" style="display:grid;gap:4px;padding:12px 14px">
          <span class="socio">${esc(p.nombre)} · ${ddmm(p.fecha)}${p.turno ? ' · ' + esc(TURNOS[p.turno] || '') : ''}${p.mio ? ' <span class="sello">el tuyo</span>' : ''}${!p.leido ? ' <span class="sello rojo">sin leer</span>' : ''}</span>
          ${bloque('Pendiente', p.pendientes)}${bloque('Esperan respuesta', p.esperando)}${bloque('Novedades', p.novedades)}
          <span class="profe">${p.leyeron ? 'Lo leyeron ' + p.leyeron : 'Todavía no lo leyó nadie'}</span></div>
          ${p.leido ? '' : `<div class="fila-accion"><button class="boton verde" data-accion="pase-leido" data-id="${esc(p.id)}">Lo leí</button></div>`}</article>`).join('') : '<div class="vacio">Todavía no hay pases de turno en esta sede.</div>'}</section>`;
  }

  function bandaPase() {
    if (!E.paseSinLeer) return '';
    return `<div class="banda-pase">📝 Tenés ${E.paseSinLeer === 1 ? 'un pase de turno' : E.paseSinLeer + ' pases de turno'} sin leer <button class="chip" data-accion="vista" data-v="pase">Leer</button></div>`;
  }

  async function cargarPaseSinLeer() {
    try {
      const p = await cliente.llamar('pase_ver', {});
      const antes = E.paseSinLeer;
      E.paseSinLeer = p.sin_leer;
      if (E.vista === 'hoy' && antes !== p.sin_leer) render();
    } catch (e) { /* el pase es un extra: si falla, la pantalla sigue */ }
  }

  // ---------- Ranking entre sedes: el panel lateral ----------
  // Se premian los procesos (quién cumple las tareas), después los planes de 3 meses; los socios nuevos van al final porque no se
  // pueden comparar entre sedes (Bariloche tiene lista de espera). Sin plata. Lo ven recepción, coordinación y administración.
  const MEDALLAS = ['🥇', '🥈', '🥉'];
  const RANKINGS = [['procesos', '✅ Procesos'], ['largos', '🏅 Planes de 3 meses'], ['nuevos', '👥 Socios nuevos']];
  const PERIODOS_LARGOS = [[1, 'Este mes'], [2, 'Últimos 2 meses'], [3, 'Últimos 3 meses']];
  const largosEn = (p, k) => (p.largos_meses || []).slice(-k).reduce((a, m) => a + m.n, 0);
  function veRanking() { return tiene('recepcion') || tiene('coordinador') || tiene('admin'); }

  function botonRanking() {
    if (!veRanking() || !cliente.sesion()) return '';
    return `<button class="boton-ranking${DEMO ? ' con-cinta' : ''}" data-accion="rank-abrir" aria-label="Abrir el ranking">🏆 <span>Ranking</span></button>`;
  }

  function panelRanking() {
    if (!E.rankAbierto) return '';
    const R = E.rank;
    const tab = E.rankTab || 'procesos';
    let cuerpo = '<div class="cargando">Armando el ranking…</div>';
    if (R) {
      const num = n => String(Math.round(Number(n) * 10) / 10).replace('.', ',');
      const valor = {
        procesos: p => (p.procesos.pct == null ? -1 : p.procesos.pct),
        largos: p => largosEn(p, E.rankPeriodo || 1),
        nuevos: p => p.nuevos,
      }[tab];
      let lista = R.personas.slice();
      if (tab === 'procesos') lista = lista.filter(p => p.procesos.total > 0);
      lista.sort((x, y) => valor(y) - valor(x) || (tab === 'procesos' ? (y.procesos.a_tiempo_pct || 0) - (x.procesos.a_tiempo_pct || 0) || y.procesos.hechas - x.procesos.hechas : y.nuevos - x.nuevos) || String(x.nombre).localeCompare(String(y.nombre)));
      const max = Math.max(1, ...lista.map(p => (tab === 'procesos' ? 100 : valor(p))));
      const fila = (p, i) => {
        const puesto = i + 1;
        const grande = tab === 'procesos' ? (p.procesos.pct == null ? '—' : p.procesos.pct + '%') : valor(p);
        const detalle = tab === 'procesos'
          ? `<span class="rk-pie">${p.procesos.hechas} de ${p.procesos.total} tareas del mes${p.procesos.a_tiempo_pct == null ? '' : ' · ' + p.procesos.a_tiempo_pct + '% en el día'}</span>`
          : tab === 'largos'
            ? `<span class="rk-pie">${(p.largos_meses || []).map(m => esc(nombreMes(m.mes).slice(0, 3)) + ' ' + m.n).join(' · ')}</span>`
            : (() => {
              const dif = p.vs_mes_pasado;
              const flecha = dif > 0 ? `<span class="rk-sube">▲ ${dif}</span>` : dif < 0 ? `<span class="rk-baja">▼ ${Math.abs(dif)}</span>` : '<span class="rk-igual">＝</span>';
              const rec = p.bate_record ? `<span class="rk-record">🔥 ¡Récord nuevo! Su mejor mes era ${p.record.nuevos}</span>`
                : p.record ? `<span class="rk-pie">Su récord: ${p.record.nuevos} (${esc(nombreMes(p.record.mes))}) · le faltan ${p.falta_record} para superarlo</span>` : '';
              const esc2 = p.escalon && p.escalon.etiqueta ? `<span class="rk-escalon">${esc(p.escalon.etiqueta)}${p.escalon.siguiente ? ` · a ${p.escalon.siguiente.faltan} de ${esc(p.escalon.siguiente.etiqueta)}` : p.escalon.maximo ? ' · ¡máximo!' : ''}</span>` : '';
              return `<div class="rk-datos">${flecha}<span class="rk-pie">vs. el mismo día del mes pasado (${p.mes_pasado_a_la_fecha})</span></div>${esc2}${rec}${p.mejor_dia ? `<span class="rk-pie">Mejor día: ${p.mejor_dia.n} el ${ddmm(p.mejor_dia.fecha)}</span>` : ''}`;
            })();
        return `<li class="rk-fila${p.dni === R.mi_dni ? ' yo' : ''}"><div class="rk-cab"><span class="rk-puesto">${MEDALLAS[i] || puesto}</span><b>${esc(p.nombre)}</b><span class="rk-sede">${esc(SEDES[p.sede] || '')}</span><span class="rk-n">${grande}</span></div>
          <div class="medidor"><i class="${puesto === 1 ? 'bien' : 'cerca'}" style="width:${Math.round((tab === 'procesos' ? (p.procesos.pct || 0) : valor(p)) / max * 100)}%"></i></div>${detalle}</li>`;
      };
      const eq = R.equipo;
      const resumen = tab === 'procesos'
        ? `<b>${eq.procesos_pct == null ? '—' : eq.procesos_pct + '%'}</b> de las tareas del mes cumplidas entre todas las sedes`
        : tab === 'largos'
          ? `<b>${R.personas.reduce((a, p) => a + largosEn(p, E.rankPeriodo || 1), 0)}</b> planes de 3 meses o más entre todas las sedes ${(E.rankPeriodo || 1) === 1 ? 'este mes' : 'en los últimos ' + E.rankPeriodo + ' meses'}`
          : `<b>${eq.nuevos}</b> socios nuevos entre todas las sedes${eq.record ? ` · mejor mes: ${eq.record.nuevos} (${esc(nombreMes(eq.record.mes))})` : ''}`;
      const aclara = tab === 'procesos'
        ? 'Es lo que más importa: cumplir los procesos. Cuenta las tareas del mes que cada una ya resolvió sobre las que le tocaron, sin las que esperan a MOVE. Es un porcentaje, así que se compara bien entre sedes.'
        : tab === 'largos'
          ? 'Planes de 3 meses o más vendidos, con el reparto de quién vendió cada uno. Es la venta que más pesa, y la idea es que se sostenga en el tiempo: por eso se puede mirar el mes, los últimos 2 y los últimos 3 meses. Abajo de cada nombre está el detalle mes por mes.'
          : 'Cuenta los socios nuevos de cada caja de MOVE desde el día 1. No se compara entre sedes: en Bariloche hay lista de espera y ahí no se busca que entren muchos. La flecha te compara con vos misma el mes pasado.';
      const periodos = tab === 'largos' ? `<div class="filtros">${PERIODOS_LARGOS.map(([k, n]) => `<button class="chip" data-accion="rank-periodo" data-k="${k}" aria-pressed="${(E.rankPeriodo || 1) === k}">${n}</button>`).join('')}</div>` : '';
      cuerpo = `${periodos}<div class="rk-equipo">${resumen}${tab === 'nuevos' ? `<div class="rk-sedes">${Object.keys(eq.por_sede).map(k => `<span>${esc(SEDES[k] || k)}: <b>${eq.por_sede[k]}</b></span>`).join('')}</div>` : ''}</div>
        ${lista.length ? `<ol class="rk-lista">${lista.map(fila).join('')}</ol>` : '<div class="vacio">Todavía no hay datos este mes.</div>'}
        <p class="aclara">${aclara}</p>`;
    }
    return `<div class="rk-fondo" data-accion="rank-cerrar"></div><aside class="rk-panel" role="dialog" aria-label="Ranking">
      <div class="rk-tope"><h2>🏆 Ranking · ${R ? esc(nombreMes(R.mes)) : ''}</h2><button class="chip" data-accion="rank-cerrar">Cerrar</button></div>
      <div class="filtros">${RANKINGS.map(([k, n]) => `<button class="chip" data-accion="rank-tab" data-t="${k}" aria-pressed="${tab === k}">${n}</button>`).join('')}</div>${cuerpo}</aside>`;
  }

  async function abrirRanking() {
    E.rankAbierto = true;
    render();
    try { E.rank = await cliente.llamar('ranking_ver', {}); } catch (e) { E.rankAbierto = false; falla(e); }
    render();
  }

  // ---------- Resumen semanal para gerencia (administración) ----------
  function vistaResumen() {
    const R = E.resumen;
    const chips = `<div class="filtros"><button class="chip" data-accion="resumen-semana" data-a="" aria-pressed="${!E.resumenActual}">Semana pasada</button><button class="chip" data-accion="resumen-semana" data-a="1" aria-pressed="${!!E.resumenActual}">Esta semana (en curso)</button></div>`;
    if (!R) return chips + '<div class="cargando">Armando el resumen…</div>';
    const dif = (a, b) => { const d = a - b; return d === 0 ? '＝' : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d); };
    const difP = (a, b) => (b ? (a >= b ? '▲ ' : '▼ ') + Math.abs(Math.round((a - b) / b * 100)) + '%' : '—');
    const T = R.total;
    const filas = R.sedes.map(s => `<tr><td><b>${esc(SEDES[s.sede] || s.sede)}</b></td><td class="num"><b>${s.nuevos}</b> <span class="profe">${dif(s.nuevos, s.nuevos_ant)}</span></td><td class="num">${s.renovaciones} <span class="profe">${dif(s.renovaciones, s.renovaciones_ant)}</span></td><td class="num">${s.largos}</td><td class="num">${plata(s.entro)} <span class="profe">${difP(s.entro, s.entro_ant)}</span></td><td class="num">${s.tareas_pct == null ? '—' : s.tareas_pct + '%'}</td><td class="num">${s.animo == null ? '—' : String(s.animo).replace('.', ',') + '/5'}</td><td class="num">${s.coberturas ? s.coberturas + ' (' + s.horas_cobertura + ' h)' : '—'}</td></tr>`).join('');
    return `${chips}<h1 class="titulo">Resumen semanal</h1><p class="bajada">Del ${ddmm(R.desde)} al ${ddmm(R.hasta)}${R.en_curso ? ' · la semana todavía no terminó' : ''}. Las flechas comparan con la semana anterior.</p>
      <section class="bloque"><div class="datos"><div class="dato"><strong>${T.nuevos}</strong><span>Socios nuevos</span><em>${dif(T.nuevos, T.nuevos_ant)} vs. semana anterior</em></div><div class="dato"><strong>${T.renovaciones}</strong><span>Renovaciones</span><em>${dif(T.renovaciones, T.renovaciones_ant)}</em></div><div class="dato"><strong>${T.largos}</strong><span>Planes de 3 meses o más</span></div><div class="dato"><strong>${plata(T.entro)}</strong><span>Entró en total</span><em>${difP(T.entro, T.entro_ant)}</em></div><div class="dato"><strong>${T.nuevos_mes}</strong><span>Nuevos en lo que va del mes</span></div></div></section>
      <section class="bloque"><div class="bloque-cab"><h2>Por sede</h2></div><div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Sede</th><th>Nuevos</th><th>Renov.</th><th>3 meses+</th><th>Entró</th><th>Tareas</th><th>Ánimo</th><th>Coberturas</th></tr></thead><tbody>${filas}</tbody></table></div></section>
      ${R.destacados.length ? `<section class="bloque"><div class="bloque-cab"><h2>🏅 Más socios nuevos de la semana</h2></div>${R.destacados.map((d, i) => `<div class="fila-cob"><span>${MEDALLAS[i]} <b>${esc(d.nombre)}</b> · ${esc(SEDES[d.sede] || '')}</span><b>${d.nuevos}</b></div>`).join('')}</section>` : ''}
      <div class="botones"><button class="boton verde" data-accion="resumen-copiar">Copiar el resumen para mandarlo</button></div>
      <p class="aclara">Sale de las cajas de MOVE, de las tareas hechas y de los cierres de turno. Las tareas son las del equipo de recepción de cada sede.</p>`;
  }

  function textoResumen(R) {
    const mil = n => '$' + Math.round(n).toLocaleString('es-AR');
    const l = [`Resumen semanal The Move Club · ${ddmm(R.desde)} al ${ddmm(R.hasta)}`, '',
      `Socios nuevos: ${R.total.nuevos} (semana anterior ${R.total.nuevos_ant})`, `Renovaciones: ${R.total.renovaciones}`, `Planes de 3 meses o más: ${R.total.largos}`, `Entró: ${mil(R.total.entro)}`, '', 'Por sede:'];
    R.sedes.forEach(s => l.push(`• ${SEDES[s.sede] || s.sede}: ${s.nuevos} nuevos, ${s.renovaciones} renovaciones, ${mil(s.entro)}${s.tareas_pct == null ? '' : ', tareas ' + s.tareas_pct + '%'}${s.animo == null ? '' : ', ánimo ' + String(s.animo).replace('.', ',') + '/5'}${s.coberturas ? ', ' + s.coberturas + ' coberturas' : ''}`));
    if (R.destacados.length) { l.push('', 'Más socios nuevos:'); R.destacados.forEach((d, i) => l.push(`${i + 1}. ${d.nombre} (${SEDES[d.sede] || ''}): ${d.nuevos}`)); }
    return l.join('\n');
  }

  function render() {
    const s = cliente.sesion();
    if (!s) { app.innerHTML = vistaLogin(); return; }
    if (s.debe_cambiar_pin) { app.innerHTML = vistaCambiarPin(); return; }
    const disponibles = pestanasDisponibles().map(p => p[0]);
    if (disponibles.indexOf(E.vista) < 0) { E.vista = disponibles[0] || null; setTimeout(cargarVista); }
    const cuerpo = E.vista === 'hoy' ? vistaHoy() : E.vista === 'sede' ? vistaSede() : E.vista === 'admin' ? vistaAdmin() : E.vista === 'mes' ? vistaMes() : E.vista === 'rend' ? vistaRendimiento()
      : E.vista === 'reservas' ? vistaReservas()
      : E.vista === 'liq' ? vistaLiquidacion()
      : E.vista === 'resumen' ? vistaResumen()
      : E.vista === 'consultas' ? vistaConsultas()
      : E.vista === 'pase' ? vistaPase()
      : E.vista === 'chat' ? vistaChat()
      : E.vista === 'planes' ? vistaPlanes() : E.vista === 'profes' ? vistaProfes() : E.vista === 'pmes' ? vistaMesProfe()
      : E.vista === 'pres' ? vistaResumenProfes()
      : E.vista === 'phor' ? (E.planes ? vistaAgendaEquipo(true) : '<div class="cargando">Cargando…</div>')
      : E.vista === 'pliq' ? (E.planes ? `<h1 class="titulo">${tiene('admin') ? 'Comisiones y tareas del mes' : 'Tareas del mes'} <span>·</span> profes</h1>${vistaTareasMesCoord()}${tablaComisiones()}` : '<div class="cargando">Cargando…</div>')
      : '<div class="vacio">Tu usuario no tiene ninguna vista asignada. Avisale a Emanuel.</div>';
    const sinDatos = { hoy: !E.tareas, sede: E.personaDni ? !E.persona : !E.sede, mes: !E.rend, rend: !E.rend, admin: !E.usuarios, reservas: !E.ocupacion, liq: !E.liq, resumen: !E.resumen, consultas: !E.cons, pase: !E.pase, chat: !E.chat, planes: !E.planes, profes: !E.planes, pmes: !E.planes, phor: !E.planes, pliq: !E.planes, pres: !E.estado }[E.vista];
    const mostrar = E.errorCarga && sinDatos ? `<div class="vacio" style="margin-top:18px"><p>${esc(E.errorCarga)}</p><p>La pantalla vuelve a intentarlo sola. Tus marcas no se pierden.</p><button class="boton" data-accion="reintentar">Reintentar ahora</button></div>` : cuerpo;
    const bandas = E.vista === 'hoy' ? bandaPase() + bandaFichajes() + bandaReservas() : '';
    app.innerHTML = encabezado() + `<main class="contenedor">${bandas}${mostrar}</main>` + (E.vista === 'hoy' && turnoTerminando() ? `<button class="cerrar-app-fijo${DEMO ? ' con-cinta' : ''}" data-accion="cerrar-app">🚪 ${E.dia && E.dia.cierre_hecho ? 'Listo por hoy' : 'Se termina tu turno'}: cerrá la app antes de irte</button>` : '') + (DEMO ? '<div class="cinta-practica">Modo práctica · datos inventados</div>' : '') + botonRanking() + panelRanking();
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

  // ---------- Liquidación ----------
  // Sueldo por hora + comisión por ingresos nuevos + extras, mes a mes, y las horas que salen del QR de ingreso.
  // Coordinación (admin) ve y edita a todas; cada persona ve solo lo suyo (Emanuel, 12/11/2026).
  const liqPlata = n => (Number(n) < 0 ? '−' : '') + '$' + Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-AR');
  const liqNum = n => (n == null || n === '' ? '—' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));
  const liqCorto = n => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2).replace('.', ',') + ' M' : Math.round(n / 1000) + ' mil');
  const liqMesCorto = m => nombreMes(m).slice(0, 3) + ' ' + m.slice(2, 4);
  const liqDDMM = f => f.slice(8, 10) + '/' + f.slice(5, 7);
  const LIQ_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  function liqBorradorDe(p, l) {
    const b = E.liqBorrador;
    if (b && b.dni === p.dni && b.mes === E.liq.mes) return b;
    return { dni: p.dni, mes: E.liq.mes, valor_hora: l.valor_hora || '', horas: l.horas || '', nuevos: l.nuevos_manual ? l.nuevos : '', comision: l.comision_manual ? l.comision : '', nota: l.nota, extras: l.extras.map(x => ({ c: x.c, m: x.m })) };
  }

  function liqCapturar(form) {
    const v = n => { const i = form.querySelector(`[name="${n}"]`); return i ? i.value : ''; };
    return {
      dni: form.dataset.dni, mes: form.dataset.mes, valor_hora: v('valor_hora'), horas: v('horas'), nuevos: v('nuevos'), comision: v('comision'), nota: v('nota'),
      extras: [...form.querySelectorAll('[data-liq-extra]')].map(f => ({ c: f.querySelector('select').value, m: f.querySelector('input').value })),
    };
  }

  function vistaLiquidacion() {
    const D = E.liq;
    if (!D) return '<div class="cargando">Calculando…</div>';
    const admin = D.puede_editar;
    const selector = `<div class="filtros">${D.meses.slice(-12).map(m => `<button class="chip" data-accion="liq-mes" data-m="${m}" aria-pressed="${D.mes === m}">${esc(liqMesCorto(m))}</button>`).join('')}</div>`;
    const p = admin ? D.personas.find(x => x.dni === E.liqDni) : D.personas[0];
    if (p) return `${admin ? '<div class="filtros"><button class="chip" data-accion="liq-volver">← Volver al equipo</button></div>' : ''}${selector}${liqDetalle(p, D, admin)}`;
    const T = D.personas.reduce((a, x) => { const l = x.liquidacion; a.base += l.base; a.comision += l.comision; a.extras += l.total_extras; a.total += l.total; return a; }, { base: 0, comision: 0, extras: 0, total: 0 });
    const filas = D.personas.map(x => {
      const l = x.liquidacion, q = x.qr;
      return `<tr class="fila-tocable" data-accion="liq-persona" data-dni="${esc(x.dni)}" tabindex="0">
        <td><b>${esc(x.nombre)}</b><br><span class="profe">${esc(SEDES[x.sede] || '')}${l.cargado ? '' : ' · sin cargar'}</span></td>
        <td class="num">${liqNum(l.horas)}</td><td class="num">${q.dias_con_qr ? liqNum(q.total) : '—'}</td>
        <td class="num">${l.nuevos == null ? '—' : l.nuevos}${l.etiqueta ? `<br><span class="profe">${esc(l.etiqueta)}</span>` : ''}</td>
        <td class="num">${liqPlata(l.base)}</td><td class="num">${liqPlata(l.comision)}</td><td class="num">${l.total_extras ? liqPlata(l.total_extras) : '—'}</td><td class="num"><b>${liqPlata(l.total)}</b></td></tr>`;
    }).join('');
    return `${selector}<h1 class="titulo">Liquidación <span>·</span> ${nombreMes(D.mes)}</h1>
      <p class="bajada">Tocá una persona para ver el detalle, editar la liquidación y ver sus horas por QR.</p>
      ${D.personas.length ? `<div class="envoltura-tabla"><table class="tabla"><thead><tr><th>Persona</th><th>Horas liquidadas</th><th>Horas por QR</th><th>Nuevos</th><th>Base</th><th>Comisión</th><th>Extras</th><th>Total</th></tr></thead><tbody>${filas}</tbody>
        <tfoot><tr><td colspan="4"><b>Total del equipo</b></td><td class="num"><b>${liqPlata(T.base)}</b></td><td class="num"><b>${liqPlata(T.comision)}</b></td><td class="num"><b>${liqPlata(T.extras)}</b></td><td class="num"><b>${liqPlata(T.total)}</b></td></tr></tfoot></table></div>` : '<div class="vacio">No hay recepcionistas cargados.</div>'}
      <p class="aclara">Sale de las planillas de recepción (pestaña Objetivos): valor hora por horas del mes, más la comisión por ingresos nuevos según el objetivo de la sede, más los extras. Si un mes no está cargado se usa el valor hora y las horas del último mes cargado, y queda marcado "sin cargar". Las horas por QR son una estimación: no reemplazan a las horas liquidadas.</p>
      ${liqConfigForm(D)}`;
  }

  function liqConfigForm(D) {
    const c = D.config, campo = (n, v, ph) => `<input name="${n}" type="number" step="any" min="0" value="${v == null ? '' : esc(v)}" placeholder="${ph || ''}" inputmode="decimal">`;
    const sedes = Object.keys(SEDES).map(s => `<div class="liq-fila"><b>${esc(SEDES[s])}</b>${[0, 1, 2, 3].map(i => `<label class="campo">${esc(D.etiquetas[i])}${campo(`m_${s}_${i}`, (c.metas[s] || [])[i], 'sin objetivo')}</label>`).join('')}</div>`).join('');
    return `<section class="bloque"><div class="bloque-cab"><h2>Objetivos y tarifas · ${nombreMes(D.mes)}</h2><span class="sello">${c.desde ? 'Cargado desde ' + esc(liqMesCorto(c.desde)) : 'Valores de las planillas'}</span></div>
      <form data-form="liq-config" data-mes="${esc(D.mes)}">
        <div class="liq-fila"><b>Plata por ingreso nuevo</b>${[0, 1, 2, 3].map(i => `<label class="campo">${esc(D.etiquetas[i])}${campo('t' + i, c.tarifas[i])}</label>`).join('')}</div>
        <p class="aclara">Ingresos nuevos del mes que hay que alcanzar en cada sede para cada tramo. Los objetivos de las planillas son de 4 horas. Una sede sin objetivos (Bariloche) no calcula la comisión sola: se carga a mano en cada persona.</p>
        ${sedes}
        <div class="botones"><button class="boton verde">Guardar desde ${esc(nombreMes(D.mes))}</button></div>
        <p class="aclara">Vale desde este mes hasta que cargues otra configuración en un mes posterior. Los meses anteriores no cambian.</p>
      </form></section>`;
  }

  function liqDetalle(p, D, admin) {
    const l = p.liquidacion, q = p.qr;
    const filaC = (t, v, cls) => `<tr${cls ? ` class="${cls}"` : ''}><td>${t}</td><td class="num">${v}</td></tr>`;
    const extras = l.extras.map(x => filaC(esc(x.c), liqPlata(x.m))).join('');
    const dif = l.comision_manual && l.comision_calculada != null && l.comision_calculada !== l.comision;
    const metas = l.metas.length === 4 ? `<div class="liq-metas">${l.metas.map((m, i) => `<div class="liq-meta${l.tramo === i ? ' actual' : ''}"><span>${esc(D.etiquetas[i])}</span><b>${liqNum(m)}</b><i>${liqPlata(D.config.tarifas[i])} c/u</i></div>`).join('')}</div>
      <p class="aclara">${l.nuevos == null ? 'Todavía no hay ingresos nuevos para este mes.' : `Llevás ${l.nuevos} ingresos nuevos${l.nuevos_manual ? '' : ' (los cuenta la app)'}. ${l.tramo != null && l.tramo < 3 ? `Para el ${esc(D.etiquetas[l.tramo + 1])} faltan ${liqNum(Math.max(0, l.metas[l.tramo + 1] - l.nuevos))}.` : l.tramo === 3 ? 'Alcanzaste el máximo.' : ''}`}</p>`
      : '<p class="aclara">Esta sede no tiene objetivos de ingresos cargados: la comisión se carga a mano.</p>';
    return `<h1 class="titulo">${esc(p.nombre)} <span>·</span> ${nombreMes(D.mes)}</h1><p class="bajada">${esc(SEDES[p.sede] || '')}${p.turno ? ' · ' + esc(TURNOS[p.turno] || '') : ''}</p>
      ${l.cargado ? '' : '<p class="aclara alerta">Este mes todavía no está cargado: se usan el valor hora y las horas del último mes cargado.</p>'}
      <section class="bloque"><div class="bloque-cab"><h2>${admin ? 'Liquidación del mes' : 'Mis ingresos del mes'}</h2><span class="sello bien">${liqPlata(l.total)}</span></div>
        <table class="tabla compacta liq-resumen"><tbody>
          ${filaC(`Horas: ${liqNum(l.horas)} h × ${liqPlata(l.valor_hora)}`, liqPlata(l.base))}
          ${l.ajuste_horas ? filaC(`<span class="profe">Incluye ${l.ajuste_horas > 0 ? '+' : ''}${liqNum(l.ajuste_horas)} h por coberturas (planilla: ${liqNum(l.horas_planilla)} h)</span>`, '', 'liq-aparte') : ''}
          ${(p.coberturas || []).map(c => filaC(`<span class="profe">${ddmm(c.fecha)} · ${c.rol === 'cubrio' ? 'Cubriste a ' + esc(c.con || 'otra persona') + ' · +' : (c.con ? esc(c.con) + ' te cubrió · ' + (c.descuenta ? '−' : 'con goce, ') : 'Cambio · ' + (c.descuenta ? '−' : ''))}${liqNum(c.horas)} h</span>`, '', 'liq-aparte')).join('')}
          ${filaC(`Comisión por ingresos nuevos${l.comision_manual ? ' (cargada a mano)' : l.tramo != null ? ` · ${l.nuevos} × ${liqPlata(l.tarifa)} · ${esc(l.etiqueta)}` : ''}`, liqPlata(l.comision))}
          ${dif ? filaC(`<span class="profe">Con la regla de objetivos daría ${liqPlata(l.comision_calculada)}</span>`, '', 'liq-aparte') : ''}
          ${extras}
          ${filaC('<b>Total a liquidar</b>', `<b>${liqPlata(l.total)}</b>`, 'liq-total')}
        </tbody></table>
        ${l.nota ? `<p class="aclara">${esc(l.nota)}</p>` : ''}</section>
      <section class="bloque"><div class="bloque-cab"><h2>Objetivos de ingresos nuevos</h2></div>${metas}</section>
      ${admin ? liqFormulario(p, l, D) : ''}
      ${liqProgresion(p, D)}
      ${liqQr(p, l, q, D, admin)}`;
  }

  function liqFormulario(p, l, D) {
    const b = liqBorradorDe(p, l);
    const num = (n, v, ph) => `<input name="${n}" type="number" step="any" value="${v == null ? '' : esc(v)}" placeholder="${esc(ph || '')}" inputmode="decimal">`;
    const fila = (x, i) => `<div class="liq-extra" data-liq-extra><select aria-label="Concepto">${D.conceptos.map(c => `<option${c === x.c ? ' selected' : ''}>${esc(c)}</option>`).join('')}${D.conceptos.indexOf(x.c) < 0 && x.c ? `<option selected>${esc(x.c)}</option>` : ''}</select>
      <input type="number" step="any" value="${esc(x.m)}" placeholder="Monto (negativo si se descuenta)" inputmode="decimal" aria-label="Monto"><button type="button" class="boton claro" data-accion="liq-extra-menos" data-i="${i}" aria-label="Quitar">✕</button></div>`;
    return `<section class="bloque"><div class="bloque-cab"><h2>Editar la liquidación</h2><span class="sello">${nombreMes(D.mes)}</span></div>
      <form data-form="liq-guardar" data-dni="${esc(p.dni)}" data-mes="${esc(D.mes)}">
        <div class="liq-fila">
          <label class="campo">Valor por hora${num('valor_hora', b.valor_hora)}</label>
          <label class="campo">Horas del mes${num('horas', b.horas)}</label>
          <label class="campo">Ingresos nuevos <span class="opcional">(vacío: los cuenta la app${l.nuevos_app == null ? '' : ': ' + l.nuevos_app})</span>${num('nuevos', b.nuevos, l.nuevos_app == null ? '' : String(l.nuevos_app))}</label>
          <label class="campo">Comisión a mano <span class="opcional">(vacío: ${l.comision_calculada == null ? 'sin objetivos' : 'la regla da ' + liqPlata(l.comision_calculada)})</span>${num('comision', b.comision)}</label>
        </div>
        <h3 class="liq-sub">Extras del mes</h3>
        ${b.extras.length ? b.extras.map(fila).join('') : '<p class="aclara">Sin extras este mes.</p>'}
        <div class="botones"><button type="button" class="boton claro" data-accion="liq-extra-mas">+ Agregar extra</button></div>
        <label class="campo">Nota <span class="opcional">(opcional)</span><textarea name="nota" maxlength="300">${esc(b.nota)}</textarea></label>
        <div class="botones"><button class="boton verde">Guardar liquidación</button></div>
      </form></section>`;
  }

  function liqProgresion(p, D) {
    const S = p.serie;
    if (!S.length) return '';
    const max = Math.max(1, ...S.map(s => s.total));
    const barras = S.map(s => `<div class="liq-barra${s.mes === D.mes ? ' elegida' : ''}" title="${esc(nombreMes(s.mes))}: ${liqPlata(s.total)}"><span class="liq-v">${liqCorto(s.total)}</span>
      <div class="liq-pila" style="height:${Math.max(3, Math.round(s.total / max * 100))}%">${s.extras > 0 ? `<i class="b-extra" style="flex:${s.extras}"></i>` : ''}${s.comision > 0 ? `<i class="b-com" style="flex:${s.comision}"></i>` : ''}<i class="b-base" style="flex:${Math.max(1, s.base)}"></i></div><span class="mes">${esc(liqMesCorto(s.mes))}</span></div>`).join('');
    const filas = S.slice().reverse().map((s, i, arr) => {
      const ant = arr[i + 1], variacion = ant && ant.total ? Math.round((s.total - ant.total) / ant.total * 1000) / 10 : null;
      const ex = (s.extras_detalle || []).map(x => `${esc(x.c)} ${liqPlata(x.m)}`).join(' · ');
      return `<tr><td>${esc(nombreMes(s.mes))}${s.cargado ? '' : ' <span class="profe">sin cargar</span>'}</td><td class="num">${liqNum(s.horas)}</td><td class="num">${s.nuevos == null ? '—' : s.nuevos}</td><td class="num">${liqPlata(s.base)}</td><td class="num">${liqPlata(s.comision)}</td><td>${ex || '—'}</td><td class="num"><b>${liqPlata(s.total)}</b></td><td class="num">${variacion == null ? '—' : (variacion > 0 ? '+' : '') + String(variacion).replace('.', ',') + '%'}</td></tr>`;
    }).join('');
    return `<section class="bloque"><div class="bloque-cab"><h2>Mes a mes</h2><span class="sello">Últimos ${S.length}</span></div>
      <div class="liq-barras">${barras}</div>
      <p class="liq-leyenda"><i class="b-base"></i>Horas <i class="b-com"></i>Comisión <i class="b-extra"></i>Extras</p>
      <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Mes</th><th>Horas</th><th>Nuevos</th><th>Base</th><th>Comisión</th><th>Extras</th><th>Total</th><th>Vs. mes anterior</th></tr></thead><tbody>${filas}</tbody></table></div></section>`;
  }

  function liqQr(p, l, q, D, admin) {
    const resumen = q.dias_con_qr
      ? `<div class="liq-metas"><div class="liq-meta"><span>Horas por QR</span><b>${liqNum(q.total)}</b><i>${q.dias_con_qr} días con QR</i></div>
          <div class="liq-meta"><span>Previstas hasta hoy</span><b>${liqNum(q.previstas_pasadas)}</b><i>mes completo: ${liqNum(q.previstas_mes)}</i></div>
          <div class="liq-meta"><span>Liquidadas</span><b>${liqNum(l.horas)}</b><i>${l.horas ? 'el QR lleva el ' + Math.round(q.total / l.horas * 100) + '% de esas horas' : ''}</i></div>
          <div class="liq-meta${q.dias_sin_qr ? ' atencion' : ''}"><span>Días sin QR</span><b>${q.dias_sin_qr}</b><i>días previstos sin escaneo</i></div></div>`
      : '<p class="aclara">Todavía no hay ingresos por QR cargados para este mes.</p>';
    const semanas = q.semanas.length ? `<div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Semana</th><th>Días con QR</th><th>Horas</th></tr></thead><tbody>${q.semanas.map(s => `<tr><td>Desde el ${liqDDMM(s.desde)}</td><td class="num">${s.dias}</td><td class="num"><b>${liqNum(s.horas)}</b></td></tr>`).join('')}</tbody></table></div>` : '';
    const dias = q.dias.length ? `<details class="liq-dias"><summary>Ver día por día</summary><div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Día</th><th>Entrada</th><th>Salida</th><th>Horas</th><th></th></tr></thead><tbody>${q.dias.map(d => `<tr><td>${LIQ_DIAS[(new Date(d.fecha + 'T12:00:00Z').getUTCDay() + 6) % 7]} ${liqDDMM(d.fecha)}</td><td>${esc(d.entrada || '—')}</td><td>${esc(d.salida || '—')}</td><td class="num">${liqNum(d.horas)}</td><td><span class="profe">${d.real ? 'con entrada y salida' : d.fuera ? 'día sin horas previstas' : 'estimada: sin salida por QR'}</span></td></tr>`).join('')}</tbody></table></div></details>` : '';
    const horasDia = admin
      ? `<form data-form="liq-horas" data-dni="${esc(p.dni)}"><div class="liq-fila">${LIQ_DIAS.map((d, i) => `<label class="campo">${d}<input name="d${i}" type="number" step="0.25" min="0" max="16" value="${esc(p.dias_horas[i])}" inputmode="decimal"></label>`).join('')}</div><div class="botones"><button class="boton verde">Guardar horas por día</button></div></form>`
      : `<p class="aclara">Horas previstas por día: ${LIQ_DIAS.map((d, i) => p.dias_horas[i] ? `${d} ${liqNum(p.dias_horas[i])} h` : '').filter(Boolean).join(' · ')}.</p>`;
    return `<section class="bloque"><div class="bloque-cab"><h2>Horas por QR de ingreso</h2><span class="sello">${q.dias_reales} reales · ${q.dias_con_qr - q.dias_reales} estimadas</span></div>
      ${resumen}${semanas}${dias}
      <h3 class="liq-sub">Horas previstas por día</h3>${horasDia}
      <p class="aclara">Cuenta la primera entrada y la última salida de cada día. Si falta la salida o es dudosa, se toman las horas previstas de ese día (se marca "estimada"). Si alguien no escanea, el día queda sin horas: sirve para conversar, no para descontar sin hablarlo.${D.qr_actualizado ? ` Actualizado ${esc(horaLocal(D.qr_actualizado))}.` : ''}</p></section>`;
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
    } else if (tipo === 'liq-guardar') {
      const b = liqCapturar(form);
      const extras = b.extras.filter(x => x.m !== '').map(x => ({ c: x.c, m: Number(x.m) }));
      btn.disabled = true;
      try {
        await cliente.llamar('liquidacion_guardar', { dni: b.dni, mes: b.mes, datos: { valor_hora: b.valor_hora, horas: b.horas, nuevos: b.nuevos, comision: b.comision, extras, nota: b.nota } });
        E.liqBorrador = null;
        aviso('Liquidación guardada.');
        cargarVista();
      } catch (e) { btn.disabled = false; falla(e); }
    } else if (tipo === 'liq-config') {
      const n = k => f.get(k);
      const tarifas = [0, 1, 2, 3].map(i => n('t' + i));
      const metas = {};
      for (const s of Object.keys(SEDES)) {
        const v = [0, 1, 2, 3].map(i => n(`m_${s}_${i}`));
        if (v.every(x => x === '')) metas[s] = [];
        else if (v.some(x => x === '')) { aviso(`En ${SEDES[s]} completá los 4 objetivos o dejá los 4 vacíos.`, true); return; }
        else metas[s] = v;
      }
      if (tarifas.some(x => x === '')) { aviso('Completá la plata por ingreso nuevo de los 4 tramos.', true); return; }
      btn.disabled = true;
      try { await cliente.llamar('liquidacion_config_guardar', { mes: form.dataset.mes, tarifas, metas }); aviso('Objetivos y tarifas guardados.'); cargarVista(); } catch (e) { btn.disabled = false; falla(e); }
    } else if (tipo === 'cons-guardar') {
      btn.disabled = true;
      try { await cliente.llamar('consulta_actualizar', { id: form.dataset.id, estado: f.get('estado'), proximo_fecha: f.get('fecha') || '', proximo_paso: f.get('paso') || '', nota: f.get('nota') || '' }); aviso('Consulta actualizada.'); cargarVista(); } catch (e) { btn.disabled = false; falla(e); }
    } else if (tipo === 'pase-guardar') {
      btn.disabled = true;
      try { await cliente.llamar('pase_guardar', { pendientes: f.get('pendientes') || '', esperando: f.get('esperando') || '', novedades: f.get('novedades') || '' }); aviso('Pase de turno guardado.'); form.reset(); cargarVista(); } catch (e) { btn.disabled = false; falla(e); }
    } else if (tipo === 'cob-guardar') {
      btn.disabled = true;
      try { await cliente.llamar('cobertura_guardar', { fecha: f.get('fecha'), cubre_dni: f.get('cubre'), titular_dni: f.get('titular') || '', horas: Number(f.get('horas')), motivo: f.get('motivo'), nota: f.get('nota') || '', descuenta: !f.get('goce') }); aviso('Cobertura guardada: la liquidación del mes ya se ajustó.'); cargarVista(); } catch (e) { btn.disabled = false; falla(e); }
    } else if (tipo === 'liq-horas') {
      btn.disabled = true;
      try { await cliente.llamar('liquidacion_horas_guardar', { dni: form.dataset.dni, dias: [0, 1, 2, 3, 4, 5, 6].map(i => f.get('d' + i) || 0) }); aviso('Horas por día guardadas.'); cargarVista(); } catch (e) { btn.disabled = false; falla(e); }
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
    if (el.dataset.tmes) { marcarTareaMes(el.dataset.tmes, el.checked); }
    if (el.dataset.accion === 'sabado-elegir') {
      const A = E.planes && E.planes.agenda;
      const s = { fecha: el.dataset.f, sede: el.dataset.s, profe: el.value };
      el.disabled = true;
      cliente.llamar('profe_sabados_guardar', { sabados: [s] }).then(() => {
        if (A) { A.sabados = A.sabados.filter(x => !(x.fecha === s.fecha && x.sede === s.sede)); if (s.profe) A.sabados.push(s); }
        el.disabled = false;
        aviso(s.profe ? `✅ El sábado ${ddmm(s.fecha)} en ${SEDES[s.sede]} va ${s.profe}.` : `Sábado ${ddmm(s.fecha)} sin nadie cargado.`);
      }).catch(e => { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); });
    }
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
    else if (a === 'grupo') { const x = pestanasDisponibles().find(q => q[2] === el.dataset.g); if (x) irA(x[0]); }
    else if (a === 'plan-marcar') {
      el.disabled = true;
      try {
        const r = await cliente.llamar('profe_marcar', { id: el.dataset.id, hecha: el.dataset.hecha === '1' });
        const M = E.planes && E.planes.mio;
        if (M) {
          const t = M.hoy.find(x => x.id === r.tarea.id);
          if (t) { const antes = t.estado; Object.assign(t, r.tarea); if (antes !== t.estado) { const d = t.estado === 'hecha' ? 1 : -1; M.resumen.hechas_hoy += d; M.resumen.hechas_mes += d; M.resumen.pendientes_hoy -= d; if (t.atraso > 0) M.resumen.atrasadas -= d; } }
          // un plan del profe que está cubriendo (vacaciones)
          (M.cubriendo || []).forEach(c => { const x = c.hoy.find(y => y.id === r.tarea.id); if (x) Object.assign(x, r.tarea); });
        }
        if (M && r.dia_completo) M.mes = Object.assign({}, M.mes, { hoy_completo: r.dia_completo, dias_completos: ((M.mes || {}).dias_completos || 0) + 1 });
        render();
        if (el.dataset.hecha === '1') { if (r.dia_completo) festejarDia(r); else aviso('✅ ¡Bien! Plan renovado.'); }
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'planes-sede') { E.sedeElegida = el.dataset.s; E.planes = null; E.profeVer = null; render(); cargarVista(); }
    else if (a === 'profe-ver') { E.profeVer = el.dataset.p; render(); window.scrollTo(0, 0); }
    else if (a === 'profe-volver') { E.profeVer = null; render(); }
    else if (a === 'tmes-abrir') { E.tmesVer = true; render(); window.scrollTo(0, 0); }
    else if (a === 'tmes-cerrar') { E.tmesVer = false; render(); }
    else if (a === 'tmes-cual') { E.tmesCual = el.dataset.c; render(); }
    else if (a === 'liq-mes') { E.liqMes = el.dataset.m; render(); }
    else if (a === 'estado-mes') { E.estadoMes = el.dataset.m; render(); }
    else if (a === 'alm-dia') { E.almDia = E.almDia === el.dataset.f ? '' : el.dataset.f; render(); }
    else if (a === 'memb-mes') { E.membMes = el.dataset.m; render(); }
    else if (a === 'tmes-quitar') { el.closest('[data-tmes-fila]').remove(); }
    else if (a === 'tmes-agregar') { app.querySelector('.tmes-editor').insertAdjacentHTML('beforeend', app.querySelector('#tpl-tmes').innerHTML); }
    else if (a === 'tmes-guardar') {
      const caja = app.querySelector('.tmes-editor');
      const tareas = [...caja.querySelectorAll('[data-tmes-fila]')].map(f => ({ id: f.dataset.id, texto: f.querySelector('[data-c=texto]').value.trim(), pide_nota: f.querySelector('[data-c=pide_nota]').value.trim() })).filter(t => t.texto);
      if (!tareas.length) { aviso('Cargá al menos una tarea.', true); return; }
      el.disabled = true;
      try {
        await cliente.llamar('profe_tareas_mes_guardar', { mes: caja.dataset.mes, tareas });
        E.planes = await cliente.llamar('profe_tareas', E.sedeElegida ? { sede: E.sedeElegida } : {});
        render();
        aviso(`✅ Guardadas las ${tareas.length} tareas de ${nombreMes(caja.dataset.mes + '-01')}.`);
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'tmes-nota') { await marcarTareaMes(el.dataset.id, null); }
    else if (a === 'aus-guardar') {
      const v = k => (app.querySelector('[data-aus="' + k + '"]') || {}).value || '';
      if (!v('desde') || !v('hasta') || v('hasta') < v('desde')) { aviso('Revisá las fechas: "hasta" no puede ser antes de "desde".', true); return; }
      el.disabled = true;
      try {
        await cliente.llamar('profe_ausencia_guardar', { profe_dni: v('profe'), desde: v('desde'), hasta: v('hasta'), tipo: v('tipo'), reemplazo_dni: v('reemplazo'), nota: v('nota') });
        E.planes = await cliente.llamar('profe_tareas', E.sedeElegida && tiene('admin') ? { sede: E.sedeElegida } : {});
        render();
        aviso('✅ Guardado. Desde mañana a las 6:00 el reparto ya lo tiene en cuenta.');
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'aus-borrar') {
      if (!confirm('¿Quitar estas vacaciones?')) return;
      try {
        await cliente.llamar('profe_ausencia_guardar', { borrar: el.dataset.id });
        E.planes = await cliente.llamar('profe_tareas', E.sedeElegida && tiene('admin') ? { sede: E.sedeElegida } : {});
        render();
      } catch (e) { aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'agenda-abrir') { E.agendaVer = true; render(); window.scrollTo(0, 0); }
    else if (a === 'agenda-cerrar') { E.agendaVer = false; render(); }
    else if (a === 'horario-quitar') { el.closest('[data-franja]').remove(); }
    else if (a === 'horario-agregar') {
      const tpl = app.querySelector('#tpl-franja');
      el.closest('.horario-profe').querySelector('.franjas').insertAdjacentHTML('beforeend', tpl.innerHTML);
    }
    else if (a === 'horario-guardar') {
      const caja = el.closest('.horario-profe');
      const profe = caja.dataset.p;
      const A = E.planes.agenda;
      const porSede = {};
      let mal = false;
      caja.querySelectorAll('[data-franja]').forEach(f => {
        const dias = [...f.querySelectorAll('[data-h=d]:checked')].map(x => x.value).join(',');
        const desde = f.querySelector('[data-h=desde]').value, hasta = f.querySelector('[data-h=hasta]').value, sede = f.querySelector('[data-h=sede]').value;
        if (!dias || !desde || !hasta || desde >= hasta) mal = true;
        (porSede[sede] = porSede[sede] || []).push({ dias, desde, hasta });
      });
      if (mal) { aviso('Revisá las franjas: cada una necesita al menos un día y un horario "desde" antes del "hasta".', true); return; }
      const sedes = Object.keys(porSede);
      A.horarios.filter(h => mismoN(h.profe, profe) && A.editables.indexOf(h.sede) >= 0).forEach(h => { if (sedes.indexOf(h.sede) < 0) sedes.push(h.sede); });
      el.disabled = true;
      try {
        let r = null;
        for (const s of sedes) r = await cliente.llamar('profe_horarios_guardar', { profe, sede: s, filas: porSede[s] || [] });
        E.planes = await cliente.llamar('profe_tareas', E.sedeElegida ? { sede: E.sedeElegida } : {});
        render();
        aviso(`✅ Guardado el horario de ${profe}${r ? ': ' + r.horas_semana + ' h por semana' : ''}.`);
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'rotacion-guardar') {
      const sede = el.dataset.s;
      const caja = el.closest('.rotacion-sede');
      const profes = [...caja.querySelectorAll('[data-rot]:checked')].map(x => x.dataset.rot);
      if (profes.length < 2 && !confirm(`Con ${profes.length ? 'una sola persona' : 'nadie'} no hay rotación en ${SEDES[sede]}: los sábados vacíos quedan para cargar a mano. ¿Guardar igual?`)) return;
      el.disabled = true;
      try {
        const r = await cliente.llamar('profe_rotacion_guardar', { sede, profes });
        E.planes = await cliente.llamar('profe_tareas', E.sedeElegida ? { sede: E.sedeElegida } : {});
        render();
        aviso(`✅ En ${SEDES[sede]} trabajan los sábados: ${r.rotacion.map(n => n.split(' ')[0]).join(', ') || 'nadie'}.${r.rearmados ? ` Rearmamos ${r.rearmados} sábados.` : ''}`);
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'sabado-rotar') {
      const sede = el.dataset.s;
      el.disabled = true;
      try {
        const r = await cliente.llamar('profe_sabados_generar', { sede });
        E.planes = await cliente.llamar('profe_tareas', E.sedeElegida ? { sede: E.sedeElegida } : {});
        render();
        const n = r.nuevos[sede] || 0;
        aviso(n ? `✅ ${n} sábados de ${SEDES[sede]} cargados con la rotación. Revisalos por si hay vacaciones o cambios.` : `Los sábados de ${SEDES[sede]} ya estaban completos (para la rotación hacen falta al menos dos profes de lunes a viernes).`);
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'feriado-marcar' || a === 'feriado-quitar' || a === 'feriado-resp') {
      const f = el.dataset.f;
      const pedido = { fecha: f };
      if (a === 'feriado-marcar') { const n = prompt(`¿Qué feriado es el sábado ${ddmm(f)}?`, 'Feriado'); if (n === null) return; pedido.nombre = n.trim() || 'Feriado'; }
      if (a === 'feriado-quitar') pedido.borrar = true;
      if (a === 'feriado-resp') { pedido.se_trabaja = el.dataset.r; pedido.reordenar = !!el.dataset.reordenar; }
      el.disabled = true;
      try {
        const r = await cliente.llamar('profe_feriado', pedido);
        E.planes = await cliente.llamar('profe_tareas', E.sedeElegida ? { sede: E.sedeElegida } : {});
        render();
        aviso(a === 'feriado-marcar' ? `🎌 Sábado ${ddmm(f)} marcado como feriado: contestá si se trabaja.` : a === 'feriado-quitar' ? `Sábado ${ddmm(f)} sin feriado.`
          : pedido.se_trabaja === 'si' ? `✅ El ${ddmm(f)} se trabaja: queda como estaba.` : `✅ El ${ddmm(f)} queda cerrado${r.movidos ? ` y reordenamos ${r.movidos} sábados: cada uno pasó al siguiente` : ''}.`);
      } catch (e) { el.disabled = false; aviso(PulsoApi.mensaje(e.codigo || e.message), true); }
    }
    else if (a === 'reeval-abrir') { E.reevalAbierto = !el.parentElement.open; }
    else if (a === 'aud-seccion') { E.audSeccion = el.dataset.s; E.audAbierto = true; render(); }
    else if (a === 'aud-abrir') { E.audAbierto = !el.parentElement.open; }
    else if (a === 'aud-marcar' || a === 'aud-dejar') {
      const id = el.dataset.id;
      const que = a === 'aud-dejar' ? 'dejar' : el.dataset.que;
      const pedido = { id, que };
      if (que === 'dejar') {
        const campo = attr => [...app.querySelectorAll('[' + attr + ']')].find(x => x.getAttribute(attr) === id);
        const m = (campo('data-aud-motivo') || {}).value || '', nota = ((campo('data-aud-nota') || {}).value || '').trim();
        pedido.motivo = m === 'otro' || !m ? nota : m + (nota ? ': ' + nota : '');
        if (!pedido.motivo) { aviso('Elegí por qué lo dejás así.', true); return; }
      }
      el.disabled = true;
      try {
        await cliente.llamar('profe_auditoria_marcar', pedido);
        E.planes = await cliente.llamar('profe_tareas', {});
        render();
        const A = E.planes.mio && E.planes.mio.auditoria, D = A && A.dia;
        const meta = D && D.hechas >= D.meta && que !== 'deshacer' && que !== 'otro_dia' ? ' 🎉 Cumpliste la meta de hoy.' : '';
        aviso({ corregi: '✅ Anotado: mañana lo miramos en MOVE.', dejar: '🤚 Listo: queda así, con tu motivo.', otro_dia: '📅 Pasa al próximo día hábil.', deshacer: '↩️ Deshecho.' }[que] + meta);
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
    else if (a === 'liq-mes') { E.liqMes = el.dataset.m; E.liq = null; E.liqBorrador = null; render(); cargarVista(); }
    else if (a === 'liq-persona') { E.liqDni = el.dataset.dni; E.liqBorrador = null; render(); window.scrollTo(0, 0); }
    else if (a === 'cons-sede') { E.sedeElegida = el.dataset.s; E.cons = null; render(); cargarVista(); }
    else if (a === 'pase-leido') { cliente.llamar('pase_leido', { id: el.dataset.id }).then(() => { cargarVista(); }).catch(falla); }
    else if (a === 'hice-en-move') {
      const t = (E.tareas || []).find(x => x.id === el.dataset.id);
      if (!t) return;
      el.disabled = true;
      cliente.marcar({ tarea_id: t.id, abierta_en: new Date().toISOString(), canal: 'SIN CONTACTO', resultado: 'CORREGIDO', fecha: '', detalle: '' }).then(r => {
        if (r.descartadas && r.descartadas.length) { aviso(PulsoApi.mensaje(r.descartadas[0].error), true); el.disabled = false; return; }
        t.estado = 'hecha'; t.resultado_local = 'CORREGIDO'; render(); aviso('Listo: MOVE lo confirma mañana.'); E.ultimaMarca = Date.now(); revisarLogros();
        cliente.llamar('mi_dia').then(d => { E.dia = d; if (!E.abierta) render(); }).catch(() => {});
      }).catch(e => { el.disabled = false; falla(e); });
    }
    else if (a === 'rank-periodo') { E.rankPeriodo = Number(el.dataset.k) || 1; render(); }
    else if (a === 'rank-tab') { E.rankTab = el.dataset.t; render(); }
    else if (a === 'rank-abrir') { abrirRanking(); }
    else if (a === 'rank-cerrar') { E.rankAbierto = false; render(); }
    else if (a === 'resumen-semana') { E.resumenActual = !!el.dataset.a; E.resumen = null; render(); cargarVista(); }
    else if (a === 'resumen-copiar') { try { navigator.clipboard.writeText(textoResumen(E.resumen)).then(() => aviso('Resumen copiado: pegalo donde lo quieras mandar.')); } catch (e) { aviso('No se pudo copiar.', true); } }
    else if (a === 'cob-borrar') { cliente.llamar('cobertura_borrar', { id: el.dataset.id }).then(() => { aviso('Cobertura quitada.'); cargarVista(); }).catch(falla); }
    else if (a === 'liq-volver') { E.liqDni = null; E.liqBorrador = null; render(); }
    else if (a === 'liq-extra-mas' || a === 'liq-extra-menos') {
      const form = el.closest('form');
      const b = liqCapturar(form);
      if (a === 'liq-extra-mas') b.extras.push({ c: 'Otro', m: '' }); else b.extras.splice(Number(el.dataset.i), 1);
      E.liqBorrador = b;
      render();
    }
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

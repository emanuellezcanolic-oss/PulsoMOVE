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
  function formularioDe(tipo) {
    const t = String(tipo);
    if (t.indexOf('Cumpleaños') === 0) return { resultado: 'SALUDADO', conCanal: true, detalle: 'Qué se hizo', boton: 'Listo, saludado' };
    if (t.indexOf('Encuesta de baja') === 0) return { resultado: 'ENCUESTA ENVIADA', conCanal: true, detalle: 'Qué respondió', boton: 'Encuesta enviada' };
    if (t.indexOf('Apertura del turno') === 0) return { resultado: 'HECHO', conCanal: false, checklist: true, detalle: 'Si algo quedó sin hacer, contá por qué', boton: 'Listo' };
    if (t.indexOf('Seguimiento de consulta') === 0) return { resultado: 'SEGUIDO', conCanal: true, detalle: 'Qué respondió', boton: 'Seguimiento hecho' };
    if (t.indexOf('Coordinar') === 0) return { resultado: 'AGENDADA', conCanal: false, conFecha: true, consejo: 'Marcala recién cuando la evaluación ya esté agendada, con la fecha del turno. Después de esa fecha miramos en MOVE que se haya cargado.', detalle: 'Con quién y a qué hora', boton: 'Quedó agendada' };
    if (t.indexOf('Evaluación sin cargar') === 0) return { conCanal: false, etiqueta: 'Qué pasó', opciones: [['REPROGRAMADA', 'Faltó o no se hizo: la reprogramé'], ['SE HIZO', 'Se hizo: falta que el profe la cargue'], ['NO SE HACE', 'No se va a hacer']], detalle: 'Contá qué pasó', boton: 'Guardar' };
    if (t.indexOf('Entrena en otra sede') === 0) return { conCanal: false, etiqueta: '¿Sigue entrenando en la sede donde está registrado?', opciones: [['CORREGIDO', 'No, entrena acá: corregí la sede en MOVE'], ['MULTISEDE', 'Sí, hace doble turno o es multisede: queda como está'], ['DE PASO', 'Sí, acá vino de paso: queda como está']], consejo: 'Preguntale cuando venga. Si no entrena allá, primero corregí la sede en MOVE: recién cuenta cuando MOVE muestra el cambio, y lo miramos cada mañana. Si todavía no pudiste preguntarle, dejala pendiente.', detalle: 'Qué te dijo', boton: 'Guardar' };
    if (t.indexOf('Revisar plan') === 0) return { conCanal: false, etiqueta: 'Qué dijo el profe', opciones: [['LO CAMBIA EL PROFE', 'Se lo va a cambiar'], ['NOTIFICADO', 'Lo ve bien: ya le escribí al socio para ver si le gustaría un cambio'], ['NO HACE FALTA', 'No hace falta cambiarlo por ahora']], consejo: 'Primero hablalo con el profe. Si lo ve bien, escribile vos al socio, con tus palabras, para ver si le gustaría una modificación.', detalle: 'Qué te dijo', boton: 'Guardar' };
    if (t.indexOf('Revisar profesor') === 0) return { resultado: 'SIN CAMBIO', conCanal: false, detalle: 'Por qué se deja como está', obligatorio: true, boton: 'Dejarlo como está' };
    return null;
  }

  const PULSO_ICONO = '<svg class="pulso" viewBox="0 0 44 18" aria-hidden="true"><path d="M1 10 H13 l3 -7 l4 13 l3 -9 l2 3 H43" fill="none" stroke="#798254" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PULSO_LARGO = 'M2 22 H110 l8 -14 l9 28 l8 -20 l6 6 H290 l8 -14 l9 28 l8 -20 l6 6 H470 l8 -14 l9 28 l8 -20 l6 6 H598';

  const E = {
    vista: null, hoy: '', tareas: null, filtro: 'pendientes', tipo: '', abierta: null, errorForm: '',
    sede: null, sedeElegida: 'bolson', usuarios: null, mensajeLogin: '', personaDni: null, persona: null, rend: null, rendMes: null, rendDni: null, dia: null, adelantar: false, abiertaEn: null, cierres: null, cierrePospuesto: 0, paraAdelantar: 0, celebrado: {},
  };

  const app = document.getElementById('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

  function celebrar(titulo, texto, grande) {
    push(titulo, texto);
    document.querySelectorAll('.celebracion').forEach(x => x.remove());
    const c = document.createElement('div');
    c.className = 'celebracion' + (grande ? ' grande' : '');
    const colores = ['#f2b705', '#f2542d', '#0e9594', '#798254', '#f58a07'];
    const trozos = grande ? Array.from({ length: 70 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colores[i % 5]};animation-delay:${Math.random() * 0.7}s;animation-duration:${2 + Math.random() * 1.6}s"></i>`).join('') : '';
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
    const practica = DEMO ? `<div class="practica"><b>Modo práctica.</b> Probá con DNI <b>11111111</b> (recepción), <b>22222222</b> (responsable de sede) o <b>33333333</b> (admin). PIN <b>${PulsoDemo.PIN}</b>.</div>` : '';
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
    if (tiene('recepcion')) p.push(['hoy', 'Mis tareas'], ['mes', 'Mi mes']);
    if (tiene('coordinador') || tiene('admin')) p.push(['sede', 'Sede']);
    if (tiene('coordinador') || tiene('admin')) p.push(['rend', 'Rendimiento']);
    if (tiene('admin')) p.push(['admin', 'Equipo']);
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

  // ---------- Mis tareas ----------

  function avance(hechas, total) {
    const pct = total ? Math.round(100 * hechas / total) : 0;
    const enCola = cliente.pendientesDeEnvio();
    return `<section class="avance" aria-label="Avance del día">
      <div class="numeros"><b>${hechas}/${total}</b><span>hechas hoy · ${pct}%</span>
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
      ${recomiendaAudio(t.tipo) ? `<div class="consejo-audio">🎙️ ${esc(AVISO_AUDIO)}</div>` : ''}
      ${f.consejo ? `<div class="consejo-audio">${esc(f.consejo)}</div>` : ''}
      ${f.checklist ? checklistHtml(itemsDe(t)) : ''}
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
      ${recomiendaAudio(t.tipo) ? `<div class="consejo-audio">🎙️ ${esc(AVISO_AUDIO)}</div>` : ''}
      ${String(t.tipo).indexOf('Socio antiguo') === 0 ? `<div class="guia-audio"><b>Ideas para tu audio, con tus palabras</b><ol>${GUIA_ANTIGUO.map(g => `<li>${esc(g)}</li>`).join('')}</ol></div>` : ''}
      <div class="campos">
        <label class="campo">Canal<select name="canal" required><option value="">Elegí…</option>${opt(CANALES, NOMBRE_CANAL)}</select></label>
        <label class="campo">Resultado<select name="resultado" required data-accion="resultado"><option value="">Elegí…</option>${GRUPOS_RESULTADO.map(g => `<optgroup label="${esc(g[0])}">${opt(g[1], NOMBRE_RESULTADO)}</optgroup>`).join('')}</select></label>
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
        <span class="accion">${esc(t.accion)}</span>
        ${t.estado === 'hecha' ? '' : '<span class="nota">No se marca acá: cuando esté cargado en MOVE, se cierra sola a la mañana siguiente.</span>'}
      </div></article>`;
  }

  function tarjetaLectura(t, i) {
    const m = t.marca;
    return `<article class="tarjeta${t.estado === 'hecha' ? ' hecha' : ''}" style="--i:${i}"><div class="cabeza">
        <span class="socio">${esc(t.socio_nombre)}</span>${etiquetaEstado(t)}
        <span class="profe">Profe: ${esc(t.profe || '—')}</span>
        <span class="situacion">${esc(t.situacion)}</span>
        <span class="accion">${esc(t.accion)}</span>
        ${t.ultima_anotacion ? `<span class="nota">Última anotación: “${esc(t.ultima_anotacion)}”</span>` : ''}
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
        <span class="accion">${esc(t.accion)}</span>
        ${t.ultima_anotacion ? `<span class="nota">Última anotación: “${esc(t.ultima_anotacion)}”</span>` : ''}
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
      <section class="logros">
        <div class="logro oro"><strong>${D ? D.puntos : 0}</strong><span>puntos del mes</span></div>
        <div class="logro"><strong>${D && D.racha ? '🔥 ' + D.racha : '0'}</strong><span>días seguidos</span></div>
        <div class="logro"><strong>${D ? D.hoy.mensajes : 0}</strong><span>mensajes hoy</span></div>
      </section>
      <p class="aclara">Plan de 3 meses: 10 puntos, el doble que un socio nuevo. Cada tarea adelantada suma uno extra.</p>
      ${D ? bloqueMotivacion(D) : ''}
      ${D && D.coach.length ? `<section class="coach">${D.coach.map(m => `<p class="${esc(m.tono)}">${m.tono === 'logro' ? '★' : '→'} ${esc(m.texto)}</p>`).join('')}</section>` : ''}
      ${profes.length ? `<section class="profes-hoy"><b>Profes de hoy en tu turno</b><p>Recordales que fichen con el QR al ingresar.</p>${profes.map(p => `<div><span>${esc(p.socio_nombre)}</span><em>${esc(String(p.situacion).replace('Primera clase a las ', ''))}</em></div>`).join('')}</section>` : ''}
      ${E.paraAdelantar ? `<button class="boton adelantar ancho" data-accion="adelantar">${E.adelantar ? 'Ocultar las de los próximos días' : `⏩ Adelantar tareas (${E.paraAdelantar})`}</button>` : ''}
      <button class="boton ancho" data-accion="registrar">Registrar mensaje, consulta o venta</button>
      <button class="boton claro ancho" data-accion="garantia">Registrar pedido de garantía</button>
      ${avisosPendientes() ? '<button class="boton claro ancho" data-accion="activar-avisos">🔔 Activar avisos en esta PC</button>' : ''}
      ${DEMO ? '<button class="boton claro ancho" data-accion="probar-cierre">Probar la pregunta de cierre</button>' : ''}
      <div class="recordatorio">Todo contacto termina con un turno reservado o una fecha.</div>`;
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
      ${porNivel.length ? porNivel.map(([n, grupos]) => `<section class="nivel nivel-${n.n}"><h2 class="nivel-titulo">${n.emoji} ${esc(n.titulo)}<small>${esc(n.ayuda)}</small></h2>${grupos.map(grupoHtml).join('')}</section>`).join('')
        : `<div class="vacio">${E.filtro === 'pendientes' ? '¡No te quedan tareas pendientes! Si querés sumar, adelantá las de mañana.' : 'No hay tareas para mostrar.'}</div>`}
    </div></div>`;
  }

  // ---------- Rendimiento ----------

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
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
      </section>${incentivo}<div class="tablero-columnas">${graficoDias(p.serie)}${propia ? '' : bloqueUso(p) + bloqueTiempos(p)}${grupos}${ventas}${actividad}</div>
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
      ${aclaracionDatos(R)}${bloqueProfes()}${bloqueCierres()}`;
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
    const catalogo = `<details class="catalogo"><summary>🔔 Ver los avisos que recibe recepción y para qué está cada uno</summary><div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Aviso</th><th>Cuándo</th><th>Para qué</th></tr></thead><tbody>${CATALOGO_AVISOS.map(a => `<tr><td>${esc(a[0])}</td><td>${esc(a[1])}</td><td>${esc(a[2])}</td></tr>`).join('')}</tbody></table></div><p class="aclara">Salen como mucho cada 20 minutos y solo con PulsoMOVE abierta en esa PC.</p></details>`;
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
    if (D.hoy.pendientes) preguntas.push(['pendientes', `Te ${D.hoy.pendientes === 1 ? 'quedó 1 tarea pendiente' : `quedaron ${D.hoy.pendientes} tareas pendientes`}. ¿Por qué motivo?`]);
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
      d.querySelector('[data-ir]').onclick = () => { E.cierrePospuesto = Date.now() + 10 * 60000; d.close(); };
      d.querySelector('form').onsubmit = async ev => {
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
          if (tareaCierre) {
            await cliente.marcar({ tarea_id: tareaCierre.id, abierta_en: new Date().toISOString(), canal: 'PR', resultado: 'HECHO', fecha: '', detalle: respuestas.checklist || '' });
            tareaCierre.estado = 'hecha';
            tareaCierre.resultado_local = 'Checklist hecho';
          }
          d.close();
          render();
          revisarLogros();
          const dia = Number(f.get('animo'));
          dialogoCerrarApp(dia >= 4 ? '¡Gracias por contarlo! 🙌 Qué bueno que fue un buen día.' : dia <= 2 ? 'Gracias por contarlo. Coordinación lo va a ver para ayudarte.' : '¡Gracias por contarlo!');
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
      minutosSinUso: (Date.now() - ultimaInteraccion) / 60000, enviados: enviados, siguiente: D.siguiente, ayer: D.ayer, racha: D.racha, adelantar: D.para_adelantar, diasSinPlan: D.dias_sin_plan,
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

  function salirDeLaApp() {
    if (cliente.pendientesDeEnvio() && !confirm('Hay marcas que todavía no se enviaron. Si salís, se pierden. ¿Salir igual?')) return false;
    enviarUso();
    cliente.cerrarSesion();
      Object.assign(E, { vista: null, tareas: null, sede: null, usuarios: null, abierta: null, personaDni: null, persona: null, rend: null, rendMes: null, rendDni: null, dia: null, adelantar: false, cierres: null, celebrado: {} });
    return true;
  }

  // El navegador solo deja cerrar solas algunas pestañas: si no se cierra, la sesión igual queda cerrada y se lo decimos
  function cerrarApp() {
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

  function dialogoRegistrar() {
    const opciones = (lista) => lista.map(v => `<option>${esc(v)}</option>`).join('');
    const ORIGEN = ['Local', 'WhatsApp', 'Instagram', 'Recomendación', 'Ex socio'];
    const CATEGORIA = ['Bienvenida', 'Recordatorio de pago', 'Deuda', 'Promoción', 'Seguimiento', 'Encuesta', 'Felicitación', 'Información general'];
    dialogo(`<h3>Registrar</h3>
      <form class="marca-form" style="border:0;padding:0">
        <label class="campo">Qué hiciste<select name="tipo" required>
          <option value="mensaje">Mensaje a un socio, fuera de mis tareas</option><option value="consulta">Consulta de alguien interesado</option>
          <option value="prueba">Día de prueba</option><option value="resena">Pedí una reseña de Google</option><option value="referido">Me pasaron un referido</option></select></label>
        <label class="campo">Nombre de la persona<input name="nombre" required></label>
        <label class="campo" data-solo="mensaje">Categoría<select name="categoria">${opciones(CATEGORIA)}</select></label>
        <label class="campo" data-solo="mensaje">Canal<select name="canal"><option value="AU">Audio</option><option value="MP">Mensaje personal</option><option value="LL">Llamada</option><option value="PR">En persona</option></select></label>
        <label class="campo" data-solo="consulta">Interés<select name="interes"><option value="alto">Alto: seguimiento hoy</option><option value="medio">Medio: seguimiento en 48 horas</option><option value="exploratorio">Exploratorio: seguimiento en una semana</option></select></label>
        <label class="campo" data-solo="consulta prueba referido">Cómo llegó<select name="origen">${opciones(ORIGEN)}</select></label>
        <label class="campo">Detalle <span class="opcional">(opcional)</span><textarea name="detalle" maxlength="300"></textarea></label>
        <p class="aclara" style="margin:0">Solo el nombre: el teléfono queda en el celular laboral.</p>
        <div class="botones"><button class="boton verde">Guardar</button><button type="button" class="boton claro" data-cerrar>Cancelar</button></div>
      </form>`, d => {
      const form = d.querySelector('form');
      const mostrar = () => d.querySelectorAll('[data-solo]').forEach(l => { l.hidden = l.dataset.solo.split(' ').indexOf(form.tipo.value) < 0; });
      form.tipo.onchange = mostrar;
      mostrar();
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      form.onsubmit = async ev => {
        ev.preventDefault();
        const f = new FormData(form);
        const datos = { id: (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()), tipo: f.get('tipo'), nombre: String(f.get('nombre')).trim(), detalle: String(f.get('detalle') || '').trim() };
        if (datos.tipo === 'mensaje') { datos.categoria = f.get('categoria'); datos.canal = f.get('canal'); }
        if (datos.tipo === 'consulta') datos.interes = f.get('interes');
        if (['consulta', 'prueba', 'referido'].indexOf(datos.tipo) >= 0) datos.origen = f.get('origen');
        const btn = form.querySelector('button');
        btn.disabled = true;
        try {
          await cliente.llamar('registrar', datos);
          d.close();
          aviso(datos.tipo === 'consulta' ? 'Guardado. El seguimiento aparece en tus tareas cuando le toque.' : 'Guardado.');
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

  // ---------- Sede ----------

  function vistaSede() {
    if (E.personaDni) return vistaPersona();
    const selector = tiene('admin') ? `<div class="filtros">${Object.keys(SEDES).map(k => `<button class="chip" data-accion="sede-elegir" data-s="${k}" aria-pressed="${E.sedeElegida === k}">${SEDES[k]}</button>`).join('')}</div>` : '';
    if (!E.sede) return selector + '<div class="cargando">Cargando la sede…</div>';
    const S = E.sede;
    const nombre = dni => (S.personas.find(p => p.dni === dni) || {}).nombre || 'Otra persona';
    const personas = S.personas.length ? `<div class="personas">${S.personas.map(p => `<div class="persona ${p.en_vivo ? 'vivo-' + esc(p.en_vivo.color) : ''}"><b>${esc(p.nombre)}</b><span class="turno">${esc(TURNOS[p.turno] || '')}</span>${p.en_vivo ? `<span class="en-vivo">${p.en_vivo.color === 'rojo' ? '🔴' : p.en_vivo.color === 'verde' ? '🟢' : '⚪'} ${esc(p.en_vivo.texto)}</span>` : ''}${p.uso_hoy && p.uso_hoy.con_senal ? `<span class="uso-hoy">Hoy: ${horas(p.uso_hoy.activo)} usando la app · ${horas(p.uso_hoy.completando)} completando</span>` : ''}
        <div class="cifras"><div><strong>${p.hechas_hoy}</strong><span>Hoy</span></div><div class="${p.pendientes > 15 ? 'mal' : ''}"><strong>${p.pendientes}</strong><span>Pendientes</span></div><div><strong>${p.hechas_semana}</strong><span>Semana</span></div></div>
        <button class="chip ver-lista" data-accion="ver-persona" data-dni="${esc(p.dni)}">Ver su lista</button></div>`).join('')}</div>`
      : '<div class="vacio">No hay recepcionistas cargados en esta sede.</div>';
    const alertas = S.alertas.length ? S.alertas.map((t, i) => `<article class="tarjeta" style="--i:${i}">
        <div class="cabeza" style="display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:12px 14px">
          <span class="socio">${esc(t.socio_nombre)}</span><span class="estado atrasada">${t.dias_pendiente} días</span>
          <span class="profe">${esc(t.tipo)} · tiene ${esc(t.asignado_nombre || nombre(t.asignado_dni))}</span>
          <span class="accion">${esc(t.accion)}</span></div>
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
      <p class="bajada">Avance del equipo, tareas atrasadas y pedidos de garantía.</p>
      ${S.personas.some(p => p.en_vivo && p.en_vivo.color === 'rojo') ? `<div class="alerta-roja">🔴 Para mirar: ${S.personas.filter(p => p.en_vivo && p.en_vivo.color === 'rojo').map(p => esc(p.nombre.split(' ')[0])).join(', ')}</div>` : ''}
      ${personas}
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

  // ---------- Carga de datos ----------

  // Si le cambiaron los permisos con la sesión abierta, las pestañas se ponen al día solas
  function actualizarRoles(roles) {
    const s = cliente.sesion();
    if (s && roles && roles.join() !== (s.roles || []).join()) cliente.guardarSesion(Object.assign(s, { roles: roles }));
  }

  async function cargarVista() {
    E.errorCarga = '';
    try {
      if (E.vista === 'hoy') {
        const r = await cliente.llamar('mis_tareas', E.adelantar ? { adelantar: true } : {});
        E.paraAdelantar = r.para_adelantar || 0;
        E.dia = await cliente.llamar('mi_dia');
        actualizarRoles(E.dia.roles);
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
      } else if (E.vista === 'admin') {
        E.usuarios = await cliente.llamar('usuarios_listar');
      }
    } catch (e) {
      if (e && e.codigo !== 'sin_sesion') E.errorCarga = e.message;
      falla(e);
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
    E.abierta = null;
    E.personaDni = null;
    E.persona = null;
    E.rend = null;
    E.rendDni = null;
    render();
    cargarVista();
  }

  // ---------- Render ----------

  function render() {
    const s = cliente.sesion();
    if (!s) { app.innerHTML = vistaLogin(); return; }
    if (s.debe_cambiar_pin) { app.innerHTML = vistaCambiarPin(); return; }
    const disponibles = pestanasDisponibles().map(p => p[0]);
    if (disponibles.indexOf(E.vista) < 0) { E.vista = disponibles[0] || null; setTimeout(cargarVista); }
    const cuerpo = E.vista === 'hoy' ? vistaHoy() : E.vista === 'sede' ? vistaSede() : E.vista === 'admin' ? vistaAdmin() : E.vista === 'mes' ? vistaMes() : E.vista === 'rend' ? vistaRendimiento()
      : '<div class="vacio">Tu usuario no tiene ninguna vista asignada. Avisale a Emanuel.</div>';
    const sinDatos = { hoy: !E.tareas, sede: E.personaDni ? !E.persona : !E.sede, mes: !E.rend, rend: !E.rend, admin: !E.usuarios }[E.vista];
    const mostrar = E.errorCarga && sinDatos ? `<div class="vacio" style="margin-top:18px"><p>${esc(E.errorCarga)}</p><button class="boton" data-accion="reintentar">Reintentar</button></div>` : cuerpo;
    app.innerHTML = encabezado() + `<main class="contenedor">${mostrar}</main>` + (E.vista === 'hoy' && turnoTerminando() ? `<button class="cerrar-app-fijo${DEMO ? ' con-cinta' : ''}" data-accion="cerrar-app">🚪 ${E.dia && E.dia.cierre_hecho ? 'Listo por hoy' : 'Se termina tu turno'}: cerrá la app antes de irte</button>` : '') + (DEMO ? '<div class="cinta-practica">Modo práctica · datos inventados</div>' : '');
    const abierto = app.querySelector('.marca-form select');
    if (abierto && !E.errorForm) abierto.focus({ preventScroll: true });
  }

  // Reconocimiento apenas ocurre: la mitad, los últimos pasos y la lista completa
  function revisarLogros() {
    const delDia = (E.tareas || []).filter(deHoy);
    const hechas = delDia.filter(t => t.estado === 'hecha').length;
    const total = delDia.length;
    const falta = total - hechas;
    const una = (k, fn) => { const c = E.hoy + k; if (!E.celebrado[c]) { E.celebrado[c] = true; fn(); } };
    if (total && !falta) una('todo', () => celebrar('¡Lista completa!', 'Dejaste todas las tareas de hoy al día. Excelente trabajo.', true));
    else if (falta === 3) una('3', () => celebrar('¡Te faltan 3!', 'Ya casi está: cerrá estas y dejás todo al día.'));
    else if (total >= 4 && hechas / total >= 0.5) una('mitad', () => celebrar('¡Mitad del día hecha!', `Vas ${hechas} de ${total}. Seguí así.`));
  }

  // ---------- Eventos ----------

  app.addEventListener('submit', async ev => {
    const form = ev.target;
    const tipo = form.dataset.form;
    if (!tipo) return;
    ev.preventDefault();
    const f = new FormData(form);
    const btn = form.querySelector('button:not([type=button])');
    if (tipo === 'login') {
      btn.disabled = true;
      try {
        const s = await cliente.llamar('login', { dni: f.get('dni'), pin: f.get('pin') });
        cliente.guardarSesion(s);
        E.mensajeLogin = '';
        E.vista = null;
        E.tareas = null;
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
      if (salirDeLaApp()) render();
    } else if (a === 'cerrar-app') cerrarApp();
    else if (a === 'vista') irA(el.dataset.v);
    else if (a === 'filtro') { E.filtro = el.dataset.f; E.abierta = null; render(); }
    else if (a === 'abrir') { E.abierta = E.abierta === el.dataset.id ? null : el.dataset.id; E.abiertaEn = new Date().toISOString(); E.errorForm = ''; render(); }
    else if (a === 'adelantar') { E.adelantar = !E.adelantar; cargarVista(); }
    else if (a === 'activar-avisos') { Notification.requestPermission().then(() => { render(); if (Notification.permission === 'granted') push('¡Listo!', 'Los avisos de PulsoMOVE van a aparecer acá.'); }); }
    else if (a === 'probar-cierre' || a === 'probar-cierre-real') dialogoCierre(true);
    else if (a === 'rend-lista') { E.vista = 'sede'; E.personaDni = el.dataset.dni; E.persona = null; render(); cargarVista(); }
    else if (a === 'cerrar') { E.abierta = null; E.errorForm = ''; render(); }
    else if (a === 'garantia') dialogoGarantia();
    else if (a === 'reintentar') { E.errorCarga = ''; render(); cargarVista(); }
    else if (a === 'registrar') dialogoRegistrar();
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
    else if (a === 'sede-elegir') { E.sedeElegida = el.dataset.s; E.sede = null; render(); cargarVista(); }
    else if (a === 'reasignar') {
      const dni = app.querySelector(`[data-reasignar="${CSS.escape(el.dataset.id)}"]`).value;
      el.disabled = true;
      try { await cliente.llamar('reasignar', { tarea_id: el.dataset.id, dni }); aviso('Tarea reasignada.'); cargarVista(); } catch (e) { el.disabled = false; falla(e); }
    } else if (a === 'decidir') {
      const comentario = app.querySelector(`[data-comentario="${CSS.escape(el.dataset.id)}"]`).value;
      el.disabled = true;
      try { await cliente.llamar('garantia_decidir', { id: el.dataset.id, estado: el.dataset.estado, comentario }); aviso('Decisión guardada.'); cargarVista(); } catch (e) { el.disabled = false; falla(e); }
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
  setInterval(tomarMinutoDeUso, 60000);
  setInterval(enviarUso, 5 * 60000);
  setInterval(() => { if (cliente.sesion() && !E.abierta && !document.querySelector('dialog') && document.visibilityState === 'visible') cargarVista(); }, 5 * 60000);

  render();
})();

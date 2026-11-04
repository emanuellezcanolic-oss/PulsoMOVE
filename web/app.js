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
  const NOMBRE_CANAL = { MP: 'Mensaje personal', MG: 'Mensaje general o plantilla', LL: 'Llamada', PR: 'En persona', 'SIN CONTACTO': 'Sin contacto' };
  const FRASE_GARANTIA = 'Si un profe no te saluda, no te arma tu rutina o no te hace seguimiento, te devolvemos el mes.';
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const PULSO_ICONO = '<svg class="pulso" viewBox="0 0 44 18" aria-hidden="true"><path d="M1 10 H13 l3 -7 l4 13 l3 -9 l2 3 H43" fill="none" stroke="#21785a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PULSO_LARGO = 'M2 22 H110 l8 -14 l9 28 l8 -20 l6 6 H290 l8 -14 l9 28 l8 -20 l6 6 H470 l8 -14 l9 28 l8 -20 l6 6 H598';

  const E = {
    vista: null, hoy: '', tareas: null, filtro: 'pendientes', tipo: '', abierta: null, errorForm: '',
    sede: null, sedeElegida: 'bolson', usuarios: null, mensajeLogin: '', personaDni: null, persona: null,
  };

  const app = document.getElementById('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ddmm = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');
  const tituloDia = iso => { const d = new Date(iso + 'T12:00:00'); return DIAS[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1); };
  const roles = () => ((cliente.sesion() || {}).roles || []);
  const tiene = r => roles().indexOf(r) >= 0;

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
    const practica = DEMO ? `<div class="practica"><b>Modo práctica.</b> Probá con DNI <b>11111111</b> (recepción), <b>22222222</b> (coordinación) o <b>33333333</b> (admin). PIN <b>${PulsoDemo.PIN}</b>.</div>` : '';
    return `<main class="login"><div class="caja">
      <img src="web/logo.png" alt="The Move Club">
      <svg class="gran-pulso" viewBox="0 0 380 56" aria-hidden="true"><path d="M2 32 H150 l10 -24 l12 44 l10 -32 l8 12 H378"/></svg>
      <h1>Pulso<span>MOVE</span></h1>
      <p class="bajada">Tus tareas de recepción del día.</p>
      <form data-form="login" autocomplete="off">
        <label class="campo">DNI<input name="dni" inputmode="numeric" autocomplete="username" required placeholder="Sin puntos"></label>
        <label class="campo pin">PIN<input name="pin" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" autocomplete="current-password" required></label>
        ${E.mensajeLogin ? `<div class="error-form">${esc(E.mensajeLogin)}</div>` : ''}
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
        ${E.mensajeLogin ? `<div class="error-form">${esc(E.mensajeLogin)}</div>` : ''}
        <button class="boton ancho verde">Guardar PIN</button>
      </form>
    </div></main>`;
  }

  // ---------- Estructura ----------

  function pestanasDisponibles() {
    const p = [];
    if (tiene('recepcion')) p.push(['hoy', 'Mis tareas']);
    if (tiene('coordinador') || tiene('admin')) p.push(['sede', 'Sede']);
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
    if (t.estado === 'hecha') return `<span class="estado hecha">✓ ${esc(t.resultado_local || (t.marca && t.marca.resultado) || (seVerificaEnMove(t.tipo) ? 'Verificada en MOVE' : 'Hecha'))}</span>`;
    if (t.dias_pendiente >= 2) return `<span class="estado atrasada">Desde el ${ddmm(t.pendiente_desde)}</span>`;
    if (t.dias_pendiente === 1) return '<span class="estado ayer">De ayer</span>';
    return '';
  }

  function formularioMarca(t) {
    const opt = (lista, nombres) => lista.map(v => `<option value="${esc(v)}">${esc(nombres ? nombres[v] || v : v)}</option>`).join('');
    return `<form class="marca-form" data-form="marcar" data-id="${esc(t.id)}">
      <div class="campos">
        <label class="campo">Canal<select name="canal" required><option value="">Elegí…</option>${opt(CANALES, NOMBRE_CANAL)}</select></label>
        <label class="campo">Resultado<select name="resultado" required data-accion="resultado"><option value="">Elegí…</option>${opt(RESULTADOS)}</select></label>
        <label class="campo">Fecha <span class="opcional" data-ayuda="fecha">(si quedó una)</span><input name="fecha" type="date"></label>
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
        ${t.estado === 'hecha' ? '' : '<span class="nota">No se marca acá: cuando MOVE lo muestre cargado, se cierra sola a la mañana siguiente.</span>'}
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
        ${m ? `<span class="nota"><b>Marcó:</b> ${esc(m.canal)} · ${esc(m.resultado)}${m.fecha ? ' ' + ddmm(m.fecha) : ''}${m.detalle ? ' · ' + esc(m.detalle) : ''}</span>` : ''}
      </div></article>`;
  }

  function tarjeta(t, i) {
    if (seVerificaEnMove(t.tipo)) return tarjetaVerificada(t, i);
    const abierta = E.abierta === t.id;
    return `<article class="tarjeta${t.estado === 'hecha' ? ' hecha' : ''}" style="--i:${i}">
      <button class="cabeza" data-accion="abrir" data-id="${esc(t.id)}" aria-expanded="${abierta}">
        <span class="socio">${esc(t.socio_nombre)}</span>${etiquetaEstado(t)}
        <span class="profe">Profe: ${esc(t.profe || '—')}</span>
        <span class="situacion">${esc(t.situacion)}</span>
        <span class="accion">${esc(t.accion)}</span>
        ${t.ultima_anotacion ? `<span class="nota">Última anotación: “${esc(t.ultima_anotacion)}”</span>` : ''}
      </button>
      ${abierta ? formularioMarca(t) : ''}
    </article>`;
  }

  function vistaHoy() {
    if (!E.tareas) return '<div class="cargando">Cargando tus tareas…</div>';
    const todas = E.tareas;
    const hechas = todas.filter(t => t.estado === 'hecha').length;
    const tipos = [];
    todas.forEach(t => { if (tipos.indexOf(t.tipo) < 0) tipos.push(t.tipo); });
    const visibles = todas.filter(t => (E.filtro === 'todas' || (E.filtro === 'hechas') === (t.estado === 'hecha')) && (!E.tipo || t.tipo === E.tipo));
    const grupos = tipos.map(tipo => [tipo, visibles.filter(t => t.tipo === tipo)]).filter(g => g[1].length);
    let i = 0;
    const chip = (k, txt) => `<button class="chip" data-accion="filtro" data-f="${k}" aria-pressed="${E.filtro === k}">${txt}</button>`;
    return `<h1 class="titulo">${esc(tituloDia(E.hoy))} <span>·</span> hoy</h1>
      <p class="bajada">Tocá una tarea para marcarla.</p>
      ${avance(hechas, todas.length)}
      <div class="recordatorio">Todo contacto termina con un turno reservado o una fecha.</div>
      <div class="filtros">${chip('pendientes', 'Pendientes')}${chip('hechas', 'Hechas')}${chip('todas', 'Todas')}
        <select data-accion="tipo" aria-label="Tipo de tarea"><option value="">Todos los tipos</option>${tipos.map(t => `<option ${E.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </div>
      ${grupos.length ? grupos.map(([tipo, lista]) => `<section class="grupo"><h2>${esc(tipo)} <span class="cuenta">${lista.length}</span></h2>${lista[0].intro ? `<p class="intro-grupo">${esc(lista[0].intro)}</p>` : ''}${lista.map(t => tarjeta(t, i++)).join('')}</section>`).join('')
        : `<div class="vacio">${E.filtro === 'pendientes' ? 'No te quedan tareas pendientes. ¡Bien!' : 'No hay tareas para mostrar.'}</div>`}
      <div class="grupo"><button class="boton claro ancho" data-accion="garantia">Registrar pedido de garantía</button></div>`;
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
    const personas = S.personas.length ? `<div class="personas">${S.personas.map(p => `<div class="persona"><b>${esc(p.nombre)}</b><span class="turno">${esc(TURNOS[p.turno] || '')}</span>
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
          <button class="boton verde" data-accion="decidir" data-id="${esc(g.id)}" data-estado="aprobada">Devolver el mes</button>
          <button class="boton claro" data-accion="decidir" data-id="${esc(g.id)}" data-estado="rechazada">Rechazar</button></div></article>`).join('')
      : '<div class="vacio">No hay pedidos de garantía pendientes.</div>';
    return `${selector}<h1 class="titulo">${esc(SEDES[S.sede])} <span>·</span> ${esc(tituloDia(S.hoy))}</h1>
      <p class="bajada">Avance del equipo, tareas atrasadas y pedidos de garantía.</p>
      ${personas}
      <section class="grupo"><h2>Atrasadas, 2 días o más <span class="cuenta">${S.alertas.length}</span></h2>${alertas}</section>
      <section class="grupo"><h2>Garantía de atención <span class="cuenta">${S.garantias.length}</span></h2><div class="frase">${esc(FRASE_GARANTIA)}</div><p class="bajada" style="margin-top:8px">Se devuelve el mes en curso. Decide la coordinación.</p>${garantias}</section>`;
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
    d.addEventListener('close', () => d.remove());
    d.showModal();
    if (alAbrir) alAbrir(d);
    return d;
  }

  function dialogoGarantia() {
    const nombres = (E.tareas || []).map(t => t.socio_nombre);
    dialogo(`<h3>Pedido de garantía</h3>
      <div class="frase">${esc(FRASE_GARANTIA)}</div>
      <p class="bajada" style="margin:0">Recepción solo registra el pedido. Decide la coordinación.</p>
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
          aviso('Pedido registrado. Le llega a la coordinación.');
        } catch (e) { btn.disabled = false; falla(e); }
      };
    });
  }

  // ---------- Carga de datos ----------

  async function cargarVista() {
    try {
      if (E.vista === 'hoy') {
        const r = await cliente.llamar('mis_tareas');
        const locales = {};
        (E.tareas || []).forEach(t => { if (t.resultado_local) locales[t.id] = t.resultado_local; });
        E.hoy = r.hoy;
        E.tareas = r.tareas.map(t => Object.assign(t, locales[t.id] ? { resultado_local: locales[t.id] } : {}));
      } else if (E.vista === 'sede' && E.personaDni) {
        E.persona = await cliente.llamar('tareas_de', { dni: E.personaDni });
      } else if (E.vista === 'sede') {
        E.sede = await cliente.llamar('sede', tiene('admin') ? { sede: E.sedeElegida } : {});
      } else if (E.vista === 'admin') {
        E.usuarios = await cliente.llamar('usuarios_listar');
      }
    } catch (e) { falla(e); }
    render();
  }

  function irA(vista) {
    E.vista = vista;
    E.abierta = null;
    E.personaDni = null;
    E.persona = null;
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
    const cuerpo = E.vista === 'hoy' ? vistaHoy() : E.vista === 'sede' ? vistaSede() : E.vista === 'admin' ? vistaAdmin()
      : '<div class="vacio">Tu usuario no tiene ninguna vista asignada. Avisale a Emanuel.</div>';
    app.innerHTML = encabezado() + `<main class="contenedor">${cuerpo}</main>` + (DEMO ? '<div class="cinta-practica">Modo práctica · datos inventados</div>' : '');
    const abierto = app.querySelector('.marca-form select');
    if (abierto && !E.errorForm) abierto.focus({ preventScroll: true });
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
      if (validarMarca(marca)) {
        E.errorForm = PIDEN_FECHA.indexOf(marca.resultado) >= 0 && !marca.fecha ? `Con ${marca.resultado} hace falta la fecha. Todo contacto termina con un turno o una fecha.`
          : PIDEN_DETALLE.indexOf(marca.resultado) >= 0 && !marca.detalle ? 'Con BAJA hace falta escribir el motivo en el detalle.'
          : 'Elegí el canal y el resultado.';
        render();
        return;
      }
      const t = E.tareas.find(x => x.id === form.dataset.id);
      btn.disabled = true;
      const r = await cliente.marcar(Object.assign({ tarea_id: t.id }, marca));
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
    }
  });

  app.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.accion === 'tipo') { E.tipo = el.value; render(); }
    if (el.dataset.accion === 'resultado') {
      const form = el.closest('form');
      const fecha = PIDEN_FECHA.indexOf(el.value) >= 0;
      const detalle = PIDEN_DETALLE.indexOf(el.value) >= 0;
      form.querySelector('[data-ayuda=fecha]').textContent = fecha ? '(obligatoria)' : '(si quedó una)';
      form.querySelector('[data-ayuda=detalle]').textContent = detalle ? '(motivo, obligatorio)' : '(opcional)';
      form.querySelector('[name=fecha]').required = fecha;
      form.querySelector('[name=detalle]').required = detalle;
    }
  });

  app.addEventListener('click', async ev => {
    const el = ev.target.closest('[data-accion]');
    if (!el || el.tagName === 'SELECT') return;
    const a = el.dataset.accion;
    if (a === 'salir') {
      if (cliente.pendientesDeEnvio() && !confirm('Hay marcas que todavía no se enviaron. Si salís, se pierden. ¿Salir igual?')) return;
      cliente.cerrarSesion();
      Object.assign(E, { vista: null, tareas: null, sede: null, usuarios: null, abierta: null, personaDni: null, persona: null });
      render();
    } else if (a === 'vista') irA(el.dataset.v);
    else if (a === 'filtro') { E.filtro = el.dataset.f; E.abierta = null; render(); }
    else if (a === 'abrir') { E.abierta = E.abierta === el.dataset.id ? null : el.dataset.id; E.errorForm = ''; render(); }
    else if (a === 'cerrar') { E.abierta = null; E.errorForm = ''; render(); }
    else if (a === 'garantia') dialogoGarantia();
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
  setInterval(() => { if (cliente.sesion() && !E.abierta && !document.querySelector('dialog') && document.visibilityState === 'visible') cargarVista(); }, 5 * 60000);

  render();
})();

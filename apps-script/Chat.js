// PulsoMOVE Chat: mensajes entre el equipo (recepción, profes, kinesiólogos, coordinación), de a dos o en grupo.
// Cada conversación la ven solo quienes participan: ni coordinación ni administración entran a las de otros desde la app.
// Las conversaciones sin movimiento por un año se borran solas (Emanuel, 11/11/2026). Nada de socios acá: solo mensajes entre personas del equipo.

const CHAT_MAX_TEXTO = 1000;
const CHAT_MAX_GRUPO = 12;          // personas por conversación, contando a quien la crea
const CHAT_MAX_NOMBRE = 40;
const CHAT_MAX_REF = 80;            // "sobre quién" (nombre de un socio): texto corto, para acordarse de qué se habla
const CHAT_MESES_GUARDAR = 12;
const CHAT_VER_MENSAJES = 100;      // los más nuevos; lo anterior sigue guardado pero no se baja

// Las personas se muestran con un código propio del chat: el DNI es el usuario de entrada y no tiene por qué verlo todo el equipo.
function chatPid(dni, deps) {
  return deps.sha256('chat:' + dni + ':' + (deps.props.PIMIENTA || '')).slice(0, 10);
}

function chatAhoraIso(deps) {
  return new Date(deps.ahora()).toISOString();
}

function chatMiembrosDe(conv) {
  return String(conv.miembros || '').split(',').filter(Boolean);
}

function chatNombreDe(dni, usuarios) {
  const u = usuarios.find(v => v.dni === dni);
  return u ? u.nombre : 'Alguien del equipo';
}

function chatConvDeEllos(deps, dni, id) {
  const conv = deps.repo.leer('chat_conv').find(c => c.id === texto(id));
  if (!conv || chatMiembrosDe(conv).indexOf(dni) < 0) falla('no_existe');   // quien no participa ni sabe que existe
  return conv;
}

// Las personas con las que se puede hablar: todas las activas del equipo menos uno mismo.
function chatPersonas(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  return {
    personas: usuarios.filter(u => esVerdad(u.activo) && u.dni !== usuario.dni)
      .map(u => ({ pid: chatPid(u.dni, deps), nombre: u.nombre, sede: u.sede, roles: rolesDe(u) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
}

function chatLecturasDe(deps, id) {
  const m = {};
  deps.repo.leer('chat_lect').filter(l => l.conv_id === id).forEach(l => { m[l.dni] = l.ts; });
  return m;
}

// La bandeja: mis conversaciones, la más reciente arriba, con cuántos mensajes de otros tengo sin leer.
function chatListar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const convs = deps.repo.leer('chat_conv').filter(c => chatMiembrosDe(c).indexOf(usuario.dni) >= 0);
  const ids = {};
  convs.forEach(c => { ids[c.id] = true; });
  const msgs = deps.repo.leer('chat_msg').filter(m => ids[m.conv_id]);
  const lect = {};
  deps.repo.leer('chat_lect').filter(l => l.dni === usuario.dni).forEach(l => { lect[l.conv_id] = l.ts; });
  const ult = {};
  const sin = {};
  msgs.forEach(m => {
    if (!ult[m.conv_id] || m.ts > ult[m.conv_id].ts) ult[m.conv_id] = m;
    if (m.dni !== usuario.dni && m.ts > (lect[m.conv_id] || '')) sin[m.conv_id] = (sin[m.conv_id] || 0) + 1;
  });
  const lista = convs.map(c => {
    const otros = chatMiembrosDe(c).filter(d => d !== usuario.dni);
    const u = ult[c.id];
    return {
      id: c.id, tipo: c.tipo,
      nombre: c.tipo === 'directo' ? chatNombreDe(otros[0], usuarios) : (c.nombre || otros.map(d => chatNombreDe(d, usuarios).split(' ')[0]).join(', ')),
      personas: otros.length + 1,
      ultimo: u ? { texto: u.texto.slice(0, 80), ts: u.ts, mio: u.dni === usuario.dni, de: u.nombre } : null,
      sin_leer: sin[c.id] || 0, orden: u ? u.ts : c.creada,
    };
  }).sort((a, b) => (a.orden < b.orden ? 1 : -1));
  lista.forEach(c => { delete c.orden; });
  return { conversaciones: lista, sin_leer: lista.reduce((s, c) => s + c.sin_leer, 0) };
}

// Una conversación abierta: los mensajes, quiénes están y hasta dónde leyó cada uno.
function chatVer(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const conv = chatConvDeEllos(deps, usuario.dni, req.id);
  const miembros = chatMiembrosDe(conv);
  const lect = chatLecturasDe(deps, conv.id);
  const todos = deps.repo.leer('chat_msg').filter(m => m.conv_id === conv.id).sort((a, b) => (a.ts < b.ts ? -1 : 1));
  const otros = miembros.filter(d => d !== usuario.dni);
  return {
    id: conv.id, tipo: conv.tipo,
    nombre: conv.tipo === 'directo' ? chatNombreDe(otros[0], usuarios) : (conv.nombre || otros.map(d => chatNombreDe(d, usuarios).split(' ')[0]).join(', ')),
    miembros: miembros.map(d => ({ pid: chatPid(d, deps), nombre: chatNombreDe(d, usuarios), yo: d === usuario.dni, leyo: lect[d] || '' })),
    hay_mas: todos.length > CHAT_VER_MENSAJES,
    mensajes: todos.slice(-CHAT_VER_MENSAJES).map(m => ({ id: m.id, ts: m.ts, de: m.nombre, mio: m.dni === usuario.dni, texto: m.texto, ref: m.ref })),
  };
}

function chatMarcarLeido(deps, id, dni) {
  const filas = deps.repo.leer('chat_lect');
  const ahora = chatAhoraIso(deps);
  const f = filas.find(l => l.conv_id === id && l.dni === dni);
  if (f) f.ts = ahora; else filas.push({ conv_id: id, dni: dni, ts: ahora });
  deps.repo.escribir('chat_lect', filas);
  chatRecontarAviso(deps, dni);
}

// ---------- Aviso liviano ----------
// Las pantallas preguntan seguido "¿hay algo nuevo?". Para que esa pregunta no lea toda la mensajería, cada persona tiene una fila
// en `chat_aviso` con cuántos mensajes tiene sin leer y cuándo llegó el último. Se actualiza al enviar y al leer.

function chatSinLeerDe(deps, dni) {
  const mias = {};
  deps.repo.leer('chat_conv').forEach(c => { if (chatMiembrosDe(c).indexOf(dni) >= 0) mias[c.id] = true; });
  const lect = {};
  deps.repo.leer('chat_lect').forEach(l => { if (l.dni === dni) lect[l.conv_id] = l.ts; });
  return deps.repo.leer('chat_msg').filter(m => mias[m.conv_id] && m.dni !== dni && m.ts > (lect[m.conv_id] || '')).length;
}

function chatPonerAviso(deps, dni, cambio) {
  const filas = deps.repo.leer('chat_aviso');
  let f = filas.find(a => a.dni === dni);
  if (!f) { f = { dni: dni, sin_leer: '0', ts: '' }; filas.push(f); }
  cambio(f);
  deps.repo.escribir('chat_aviso', filas);
}

function chatRecontarAviso(deps, dni) {
  const n = chatSinLeerDe(deps, dni);
  chatPonerAviso(deps, dni, f => { f.sin_leer = String(n); });
}

function chatAvisarA(deps, dnis, ts) {
  const filas = deps.repo.leer('chat_aviso');
  dnis.forEach(d => {
    let f = filas.find(a => a.dni === d);
    if (!f) { f = { dni: d, sin_leer: '0', ts: '' }; filas.push(f); }
    f.sin_leer = String((parseInt(f.sin_leer, 10) || 0) + 1);
    f.ts = ts;
  });
  deps.repo.escribir('chat_aviso', filas);
}

// Lo que preguntan las pantallas: cuántos sin leer y la marca del último que llegó. Si la marca cambió, bajan la bandeja completa.
function chatNovedad(req, deps) {
  const { usuario } = sesion(req, deps);
  const f = deps.repo.leer('chat_aviso').find(a => a.dni === usuario.dni);
  return { sin_leer: f ? parseInt(f.sin_leer, 10) || 0 : 0, ts: f ? f.ts : '' };
}

function chatLeido(req, deps) {
  const { usuario } = sesion(req, deps);
  const conv = chatConvDeEllos(deps, usuario.dni, req.id);
  chatMarcarLeido(deps, conv.id, usuario.dni);
  return {};
}

// Pasados 12 meses sin un mensaje nuevo, la conversación completa se borra (mensajes y lecturas incluidos).
function chatPurgar(deps) {
  const limite = new Date(deps.ahora());
  limite.setUTCMonth(limite.getUTCMonth() - CHAT_MESES_GUARDAR);
  const corte = limite.toISOString();
  const convs = deps.repo.leer('chat_conv');
  const viejas = {};
  convs.forEach(c => { if ((c.ultimo_ts || c.creada) < corte) viejas[c.id] = true; });
  const n = Object.keys(viejas).length;
  if (!n) return 0;
  deps.repo.escribir('chat_conv', convs.filter(c => !viejas[c.id]));
  deps.repo.escribir('chat_msg', deps.repo.leer('chat_msg').filter(m => !viejas[m.conv_id]));
  deps.repo.escribir('chat_lect', deps.repo.leer('chat_lect').filter(l => !viejas[l.conv_id]));
  deps.repo.leer('usuarios').forEach(u => chatRecontarAviso(deps, u.dni));
  return n;
}

// Quienes se nombran (por su código del chat) tienen que existir y estar activos.
function chatResolver(req, usuarios, yo, deps) {
  const pids = Array.isArray(req.para) ? req.para.map(texto).filter(Boolean) : [];
  const dnis = [];
  pids.forEach(p => {
    const u = usuarios.find(v => esVerdad(v.activo) && v.dni !== yo.dni && chatPid(v.dni, deps) === p);
    if (!u) falla('datos_invalidos');
    if (dnis.indexOf(u.dni) < 0) dnis.push(u.dni);
  });
  return dnis;
}

// Manda un mensaje. Con `id`, a una conversación mía. Con `para` (códigos de personas), abre una nueva:
// con una sola persona es un chat de a dos (si ya existía, se sigue ahí); con dos o más, un grupo.
function chatEnviar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const cuerpo = texto(req.texto);
  if (!cuerpo || cuerpo.length > CHAT_MAX_TEXTO) falla('datos_invalidos');
  const ref = texto(req.ref);
  if (ref.length > CHAT_MAX_REF) falla('datos_invalidos');
  const convs = deps.repo.leer('chat_conv');
  const ahora = chatAhoraIso(deps);
  let conv;
  if (texto(req.id)) {
    conv = convs.find(c => c.id === texto(req.id) && chatMiembrosDe(c).indexOf(usuario.dni) >= 0);
    if (!conv) falla('no_existe');
  } else {
    const otros = chatResolver(req, usuarios, usuario, deps);
    if (!otros.length || otros.length + 1 > CHAT_MAX_GRUPO) falla('datos_invalidos');
    if (otros.length === 1) {
      conv = convs.find(c => c.tipo === 'directo' && chatMiembrosDe(c).indexOf(usuario.dni) >= 0 && chatMiembrosDe(c).indexOf(otros[0]) >= 0);
    }
    if (!conv) {
      const nombre = texto(req.nombre);
      if (nombre.length > CHAT_MAX_NOMBRE) falla('datos_invalidos');
      conv = { id: 'ch-' + deps.aleatorio(5), tipo: otros.length === 1 ? 'directo' : 'grupo', nombre: otros.length === 1 ? '' : nombre,
        miembros: [usuario.dni].concat(otros).join(','), creada_por: usuario.dni, creada: ahora, ultimo_ts: ahora };
      convs.push(conv);
    }
  }
  conv.ultimo_ts = ahora;
  deps.repo.escribir('chat_conv', convs);
  deps.repo.agregar('chat_msg', { id: 'cm-' + deps.aleatorio(5), conv_id: conv.id, ts: ahora, dni: usuario.dni, nombre: usuario.nombre, texto: cuerpo, ref: ref });
  chatAvisarA(deps, chatMiembrosDe(conv).filter(d => d !== usuario.dni), ahora);
  chatMarcarLeido(deps, conv.id, usuario.dni);
  chatPurgar(deps);
  return { id: conv.id };
}

// Suma gente a un grupo. Cualquiera del grupo puede; un chat de a dos no se convierte en grupo (se abre uno nuevo).
function chatAgregar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const convs = deps.repo.leer('chat_conv');
  const conv = convs.find(c => c.id === texto(req.id) && chatMiembrosDe(c).indexOf(usuario.dni) >= 0);
  if (!conv) falla('no_existe');
  if (conv.tipo !== 'grupo') falla('datos_invalidos');
  const nuevos = chatResolver(req, usuarios, usuario, deps).filter(d => chatMiembrosDe(conv).indexOf(d) < 0);
  if (!nuevos.length || chatMiembrosDe(conv).length + nuevos.length > CHAT_MAX_GRUPO) falla('datos_invalidos');
  conv.miembros = chatMiembrosDe(conv).concat(nuevos).join(',');
  deps.repo.escribir('chat_conv', convs);
  return {};
}

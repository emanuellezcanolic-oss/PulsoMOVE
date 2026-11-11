// PulsoMOVE · ruteo de pedidos. manejar(req, deps) es lo único que llama doPost (Hojas.js).
// deps = {repo, ahora, hoy, sha256, hmac, aleatorio, props:{CLAVE_CARGA, SECRETO_TOKEN, PIMIENTA}}

const MAX_INTENTOS = 5;
const MAX_SEGUNDOS_TAREA = 2 * 3600;   // más que esto es una tarea que quedó abierta en pantalla
// Lo que un recepcionista no ve de su propio tablero: lo relacionado con plata y caja (Emanuel, 04/11/2026)
const SOLO_COORDINACION = ['cobros_plan', 'cobros_plan_monto', 'mostrador', 'mostrador_monto', 'bar', 'recovery', 'otros', 'cajas', 'indumentaria', 'suplementos', 'renovaciones'];
const BLOQUEO_MS = 15 * 60 * 1000;

function ErrorApi(codigo) {
  this.codigo = codigo;
}

function falla(codigo) {
  throw new ErrorApi(codigo);
}

function esVerdad(v) {
  return String(v).toLowerCase() === 'true';
}

function rolesDe(u) {
  return String(u.roles || '').split(',').map(r => r.trim()).filter(Boolean);
}

function tieneRol(u, rol) {
  return rolesDe(u).indexOf(rol) >= 0;
}

function texto(v) {
  return v == null ? '' : String(v).trim();
}

// ---------- Sesión ----------

// Devuelve {usuario, usuarios} o lanza ErrorApi. usuarios es la hoja completa, por si la acción la reescribe.
function sesion(req, deps, opciones) {
  const dni = leerToken(req.token, deps.ahora(), deps.props.SECRETO_TOKEN, deps.hmac);
  if (!dni) falla('sin_sesion');
  const usuarios = deps.repo.leer('usuarios');
  const usuario = usuarios.find(u => u.dni === dni && esVerdad(u.activo));
  if (!usuario) falla('sin_sesion');
  if (esVerdad(usuario.debe_cambiar_pin) && !(opciones && opciones.permitirCambioPin)) falla('debe_cambiar_pin');
  return { usuario, usuarios };
}

function exigirClave(req, deps) {
  const clave = deps.props.CLAVE_CARGA;
  if (!clave || typeof req.clave !== 'string' || !igualSeguro(req.clave, clave)) falla('clave');
}

// ---------- Acciones ----------

function login(req, deps) {
  const dni = normalizarDni(req.dni);
  const usuarios = deps.repo.leer('usuarios');
  const u = usuarios.find(x => x.dni === dni && esVerdad(x.activo));
  if (!u || !dni) falla('credenciales');
  const ahora = deps.ahora();
  if (Number(u.bloqueado_hasta) > ahora) falla('bloqueado');
  if (hashPin(texto(req.pin), u.sal, deps.props.PIMIENTA, deps.sha256) !== u.pin_hash) {
    const intentos = Number(u.intentos || 0) + 1;
    u.intentos = String(intentos >= MAX_INTENTOS ? 0 : intentos);
    if (intentos >= MAX_INTENTOS) u.bloqueado_hasta = String(ahora + BLOQUEO_MS);
    deps.repo.escribir('usuarios', usuarios);
    falla('credenciales');
  }
  u.intentos = '0';
  u.bloqueado_hasta = '';
  deps.repo.escribir('usuarios', usuarios);
  return {
    token: crearToken(dni, ahora, deps.props.SECRETO_TOKEN, deps.hmac),
    nombre: u.nombre, sede: u.sede, turno: u.turno, roles: rolesDe(u),
    debe_cambiar_pin: esVerdad(u.debe_cambiar_pin),
  };
}

function cambiarPin(req, deps) {
  const { usuario, usuarios } = sesion(req, deps, { permitirCambioPin: true });
  const nuevo = texto(req.pin_nuevo);
  if (!pinValido(nuevo)) falla('pin_invalido');
  if (hashPin(nuevo, usuario.sal, deps.props.PIMIENTA, deps.sha256) === usuario.pin_hash) falla('pin_invalido');
  usuario.sal = deps.aleatorio(16);
  usuario.pin_hash = hashPin(nuevo, usuario.sal, deps.props.PIMIENTA, deps.sha256);
  usuario.debe_cambiar_pin = 'false';
  deps.repo.escribir('usuarios', usuarios);
  return {};
}

function ordenTareas(a, b) {
  return (nivelDeTarea(a) - nivelDeTarea(b)) || (Number(a.prioridad) - Number(b.prioridad)) || String(a.socio_nombre).localeCompare(String(b.socio_nombre));
}

function conDias(t, hoy) {
  const c = Object.assign({}, t);
  c.dias_pendiente = t.estado === 'pendiente' ? diasHabiles(pendienteDesde(t), hoy) : 0;
  return c;
}

function misTareas(req, deps) {
  const { usuario } = sesion(req, deps);
  const hoy = deps.hoy();
  const todas = deps.repo.leer('tareas');
  const futuras = t => t.asignado_dni === usuario.dni && t.estado === 'pendiente' && String(t.fecha) > hoy;
  const tareas = todas
    .filter(t => t.asignado_dni === usuario.dni && ((req.adelantar && futuras(t)) || (String(t.fecha) <= hoy && (t.estado === 'pendiente' || fechaArgentina(t.hecha_en) === hoy || t.fecha === hoy))))
    .filter(t => t.estado !== 'cerrada')
    .sort(ordenTareas)
    .map(t => conDias(t, hoy));
  const historial = historialDeSocios(deps.repo.leer('registro'), deps.repo.leer('reservas_qr'));
  tareas.forEach(t => { t.historial = historial[idDeSocio(t.socio_id)] || []; });
  return { hoy: hoy, tareas: tareas, para_adelantar: todas.filter(futuras).length };
}

function marcar(req, deps) {
  const { usuario } = sesion(req, deps);
  const idMarca = texto(req.id_marca);
  const marca = { canal: texto(req.canal), resultado: texto(req.resultado), fecha: texto(req.fecha), detalle: texto(req.detalle) };
  if (!idMarca || validarMarca(marca)) falla('datos_invalidos');
  const tareas = deps.repo.leer('tareas');
  const t = tareas.find(x => x.id === texto(req.tarea_id));
  if (!t) falla('no_existe');
  if (t.asignado_dni !== usuario.dni) falla('prohibido');
  if (seVerificaEnMove(t.tipo) || esRecordatorio(t.tipo)) falla('datos_invalidos');
  if (String(t.tipo).indexOf('Controlar stock') === 0 && !stockValido(req.stock)) falla('datos_invalidos');
  if (deps.repo.leer('registro').some(r => r.id_marca === idMarca)) return {};
  const ts = new Date(deps.ahora()).toISOString();
  const abierta = Date.parse(texto(req.abierta_en));
  const segundos = isNaN(abierta) ? null : Math.round((deps.ahora() - abierta) / 1000);
  deps.repo.agregar('registro', {
    segundos: segundos != null && segundos >= 0 && segundos <= MAX_SEGUNDOS_TAREA ? String(segundos) : '',
    adelantada: String(t.fecha) > deps.hoy() ? '1' : '',
    id_marca: idMarca, ts: ts, tarea_id: t.id, fecha_tarea: t.fecha, sede: t.sede, socio_id: t.socio_id,
    socio_nombre: t.socio_nombre, tipo: t.tipo, dni: usuario.dni, canal: marca.canal, resultado: marca.resultado,
    fecha_resultado: marca.fecha, detalle: marca.detalle,
  });
  t.estado = 'hecha';
  t.hecha_en = ts;
  deps.repo.escribir('tareas', tareas);
  anotarEleccion(t, marca, deps);
  guardarStock(t, req.stock, usuario, ts, deps);
  return {};
}

// ---------- Coordinación ----------

const DIAS_ALERTA = 2;

// Sede que puede ver el usuario: la suya si coordina, la pedida si es admin.
function sedePermitida(usuario, pedida) {
  if (tieneRol(usuario, 'admin')) {
    const sede = pedida || usuario.sede;   // sin sede pedida, la suya
    if (SEDES.indexOf(sede) < 0) falla('datos_invalidos');
    return sede;
  }
  if (!tieneRol(usuario, 'coordinador')) falla('prohibido');
  if (pedida && pedida !== usuario.sede) falla('prohibido');
  return usuario.sede;
}

function vistaSede(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const sede = sedePermitida(usuario, texto(req.sede));
  const hoy = deps.hoy();
  const lunes = lunesDe(hoy);
  const equipo = usuarios.filter(u => u.sede === sede && esVerdad(u.activo) && tieneRol(u, 'recepcion'));
  // Lo online lo atiende una persona de otra sede: se ve con quien lo tiene, no en la sede del socio
  const deOtraSede = dni => usuarios.some(u => u.dni === dni && u.sede !== sede);
  const tareas = deps.repo.leer('tareas').filter(t => !esRecordatorio(t.tipo)
    && (equipo.some(u => u.dni === t.asignado_dni) || (t.sede === sede && !deOtraSede(t.asignado_dni))));
  const nombre = dni => (usuarios.find(u => u.dni === dni) || {}).nombre || '';
  const ve = veUso(usuario);
  const filasUso = ve ? deps.repo.leer('uso').filter(f => f.fecha === hoy) : [];
  const registro = ve ? deps.repo.leer('registro') : [];
  const diaSemana = new Date(hoy + 'T12:00:00Z').getUTCDay();
  const personas = equipo.map(u => {
    const suyas = tareas.filter(t => t.asignado_dni === u.dni);
    const hechas = suyas.filter(t => t.estado === 'hecha').map(t => fechaArgentina(t.hecha_en));
    const inicio = aMinutoDelDia(u.hora_inicio), fin = aMinutoDelDia(u.hora_fin);
    const enVivo = !ve ? {} : (() => {
      const ahora = minutoAhora(deps);
      const uso = usoDelDia(filasUso.filter(f => f.dni === u.dni), marcasDeTrabajo(registro, u.dni).filter(r => fechaArgentina(r.ts) === hoy), inicio, fin, ahora);
      const pendientes = suyas.filter(t => t.estado === 'pendiente' && String(t.fecha) <= hoy).length;
      return { en_vivo: estadoEnVivo({ uso: uso, inicio: inicio, fin: fin, ahora: ahora, pendientes: pendientes, habil: diaSemana >= 1 && diaSemana <= 5 }), uso_hoy: uso };
    })();
    return {
      ...enVivo,
      dni: u.dni, nombre: u.nombre, sede: u.sede, turno: u.turno,
      hechas_hoy: hechas.filter(f => f === hoy).length,
      meta: metaDe(u, tareas, hoy),
      // "Pendientes" contaba también lo de los próximos días y daba más de 200: ahora va separado (Emanuel, 09/11/2026)
      pendientes_hoy: suyas.filter(t => t.estado === 'pendiente' && String(t.fecha) <= hoy).length,
      atrasadas: suyas.filter(t => t.estado === 'pendiente' && String(t.fecha) < hoy).length,
      proximos_dias: suyas.filter(t => t.estado === 'pendiente' && String(t.fecha) > hoy).length,
      hechas_semana: hechas.filter(f => f >= lunes && f <= hoy).length,
    };
  });
  const alertas = tareas.filter(t => t.estado === 'pendiente')
    .map(t => Object.assign(conDias(t, hoy), { asignado_nombre: nombre(t.asignado_dni) }))
    .filter(t => t.dias_pendiente >= DIAS_ALERTA)
    .sort((a, b) => b.dias_pendiente - a.dias_pendiente || ordenTareas(a, b));
  const garantias = deps.repo.leer('garantia').filter(g => g.sede === sede && g.estado === 'pendiente');
  return { hoy: hoy, sede: sede, personas: personas, alertas: alertas, garantias: garantias, beneficios: beneficiosParaAutorizar(usuario, deps), stock: ultimoStock(usuario, sede, deps), ventas: ventasDeSede(usuario, sede, deps), ventas_largas: ventasLargasDeSede(usuario, usuarios, sede, deps) };
}

// Lista de una persona tal como la ve ella, con lo que marcó en cada tarea. Admin: cualquiera; coordinador: su sede.
function tareasDe(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!tieneRol(usuario, 'admin') && !tieneRol(usuario, 'coordinador')) falla('prohibido');
  const u = usuarios.find(x => x.dni === normalizarDni(req.dni));
  if (!u) falla('no_existe');
  if (!tieneRol(usuario, 'admin')) sedePermitida(usuario, u.sede);
  const hoy = deps.hoy();
  const marcas = {};
  deps.repo.leer('registro').forEach(r => { marcas[r.tarea_id] = { canal: r.canal, resultado: r.resultado, fecha: r.fecha_resultado, detalle: r.detalle, ts: r.ts, segundos: r.segundos, adelantada: r.adelantada }; });
  const tareas = deps.repo.leer('tareas')
    .filter(t => t.asignado_dni === u.dni && (t.estado === 'pendiente' || (t.estado === 'hecha' && fechaArgentina(t.hecha_en) === hoy)))
    .sort(ordenTareas)
    .map(t => Object.assign(conDias(t, hoy), marcas[t.id] ? { marca: marcas[t.id] } : {}));
  return { hoy: hoy, nombre: u.nombre, turno: u.turno, sede: u.sede, tareas: tareas };
}

function reasignar(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const tareas = deps.repo.leer('tareas');
  const t = tareas.find(x => x.id === texto(req.tarea_id));
  if (!t) falla('no_existe');
  sedePermitida(usuario, t.sede);
  const destino = usuarios.find(u => u.dni === normalizarDni(req.dni));
  if (!destino || destino.sede !== t.sede || !esVerdad(destino.activo) || !tieneRol(destino, 'recepcion')) falla('datos_invalidos');
  t.asignado_dni = destino.dni;
  deps.repo.escribir('tareas', tareas);
  return {};
}

function garantiaCrear(req, deps) {
  const { usuario } = sesion(req, deps);
  const motivo = texto(req.motivo);
  if (!motivo || !texto(req.socio_nombre)) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  const id = 'G-' + deps.aleatorio(6);
  deps.repo.agregar('garantia', {
    id: id, ts: ts, sede: usuario.sede, socio_id: texto(req.socio_id), socio_nombre: texto(req.socio_nombre),
    profe: texto(req.profe), motivo: motivo, registra_dni: usuario.dni, estado: 'pendiente',
    decide_dni: '', comentario: '', decidido_en: '',
  });
  return { id: id };
}

function garantiaDecidir(req, deps) {
  const { usuario } = sesion(req, deps);
  const estado = texto(req.estado);
  const garantias = deps.repo.leer('garantia');
  const g = garantias.find(x => x.id === texto(req.id));
  if (!g) falla('no_existe');
  sedePermitida(usuario, g.sede);
  if (estado !== 'aprobada' && estado !== 'rechazada') falla('datos_invalidos');
  g.estado = estado;
  g.decide_dni = usuario.dni;
  g.comentario = texto(req.comentario);
  g.decidido_en = new Date(deps.ahora()).toISOString();
  deps.repo.escribir('garantia', garantias);
  return {};
}

function stockValido(lista) {
  return Array.isArray(lista) && lista.length > 0 && lista.every(x => x && texto(x.producto) && /^\d{1,5}$/.test(String(x.cantidad)));
}

function guardarStock(t, lista, usuario, ts, deps) {
  if (String(t.tipo).indexOf('Controlar stock') !== 0) return;
  lista.forEach(x => deps.repo.agregar('stock', { ts: ts, fecha: fechaArgentina(ts), sede: t.sede, dni: usuario.dni, nombre: usuario.nombre, producto: texto(x.producto), cantidad: String(x.cantidad) }));
}

// ---------- Ventas: salen de las cajas de MOVE, una fila por día, sede y persona que abrió la caja ----------

const CAMPOS_PLATA_VENTAS = ['planes_monto', 'mostrador_monto', 'efectivo', 'transferencia', 'mercadopago', 'otros_medios'];
const DIAS_VENTAS_SEDE = 70;

function cargarVentas(req, deps) {
  exigirClave(req, deps);
  const desde = texto(req.desde);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !Array.isArray(req.filas) || req.filas.some(f => !f || String(f.fecha) < desde)) falla('datos_invalidos');
  const quedan = deps.repo.leer('ventas').filter(f => String(f.fecha) < desde);
  deps.repo.escribir('ventas', quedan.concat(req.filas));
  return { filas: req.filas.length };
}

function ventasDeSede(usuario, sede, deps) {
  if (!tieneRol(usuario, 'admin') && !tieneRol(usuario, 'coordinador')) return [];
  const desde = sumarDias(deps.hoy(), -DIAS_VENTAS_SEDE);
  return deps.repo.leer('ventas').filter(f => f.sede === sede && String(f.fecha) >= desde);
}

// Cada recepcionista ve lo que vendió, sin plata: la plata queda para coordinación (Emanuel, 04 y 05/11/2026)
function ventasDePersona(dni, mes, coordina, filas) {
  return filas.filter(f => f.dni === dni && String(f.fecha).indexOf(mes) === 0 && String(f.fecha) >= INICIO_REAL).map(f => {
    const o = Object.assign({}, f);
    if (!coordina) CAMPOS_PLATA_VENTAS.forEach(k => { delete o[k]; });
    return o;
  });
}

// ---------- Planes de 3 meses o más: la venta es de quien vendió, aunque otro haya cobrado (Emanuel, 05/11/2026) ----------
// Si nadie dice nada, queda para quien cobró. Quien cobró se la da a otro, o el otro la pide; el otro lado acepta o rechaza.
// Si quien cobró rechaza un pedido, deciden Lucía y Emanuel. Cambia a quién se le cuenta la venta, nunca la caja.

const DIAS_PARA_REASIGNAR = 7;

// Desde cuándo se puede reclamar una venta: los últimos 7 días, pero nunca antes del arranque de cero,
// porque una venta anterior no cuenta en las estadísticas de nadie (Emanuel, 09/11/2026).
function desdeReasignar(deps) {
  const d = sumarDias(deps.hoy(), -DIAS_PARA_REASIGNAR);
  return d > INICIO_REAL ? d : INICIO_REAL;
}

function cargarVentasLargas(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas) || req.filas.some(f => !f || !texto(f.id) || !/^\d{4}-\d{2}-\d{2}$/.test(texto(f.fecha)))) falla('datos_invalidos');
  const vienen = {};
  req.filas.forEach(f => { vienen[texto(f.id)] = true; });
  // Lo que ya no es una venta larga (por ejemplo, una cuota 2) se saca si nadie tocó todavía esa venta
  const desde = texto(req.desde);
  const filas = deps.repo.leer('ventas_largas').filter(f => !desde || !req.filas.length || f.estado !== 'cobro' || f.fecha < desde || vienen[f.id]);
  const ya = {};
  filas.forEach(f => { ya[f.id] = f; });
  let nuevas = 0;
  req.filas.forEach(f => {
    const v = ya[texto(f.id)];
    if (v) { if (!v.sugerido_dni) v.sugerido_dni = texto(f.sugerido_dni); return; }
    nuevas++;
    filas.push({ id: texto(f.id), fecha: texto(f.fecha), sede: texto(f.sede), dni_cobro: texto(f.dni_cobro), nombre_cobro: texto(f.nombre_cobro), socio_id: texto(f.socio_id), socio_nombre: texto(f.socio_nombre), largo: texto(f.largo), plan: texto(f.plan), tipo: texto(f.tipo), sugerido_dni: texto(f.sugerido_dni), estado: 'cobro', pide_dni: '', responde_dni: '', hacia_dni: '', dni_vendio: '', ts_pedido: '', ts_decidido: '', decide_dni: '' });
  });
  deps.repo.escribir('ventas_largas', filas);
  return { nuevas: nuevas };
}

function ventaLargaBuscar(filas, id) {
  const v = filas.find(f => f.id === texto(id));
  if (!v) falla('no_existe');
  return v;
}

// Quien cobró se la da a otra persona de la sede, o alguien de la sede la pide
function ventaLargaPedir(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  if (!tieneRol(usuario, 'recepcion')) falla('prohibido');
  const filas = deps.repo.leer('ventas_largas');
  const v = ventaLargaBuscar(filas, req.id);
  if (v.estado !== 'cobro' || v.sede !== usuario.sede || String(v.fecha) < desdeReasignar(deps)) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  if (usuario.dni === v.dni_cobro) {
    const otro = usuarios.find(u => u.dni === normalizarDni(req.dni) && esVerdad(u.activo) && tieneRol(u, 'recepcion') && u.sede === v.sede && u.dni !== usuario.dni);
    if (!otro) falla('datos_invalidos');
    Object.assign(v, { estado: 'pedida', pide_dni: usuario.dni, responde_dni: otro.dni, hacia_dni: otro.dni, ts_pedido: ts });
  } else {
    // Si cobró alguien que no usa la app, no hay a quién preguntarle: deciden Lucía y Emanuel
    Object.assign(v, { estado: v.dni_cobro ? 'pedida' : 'disputa', pide_dni: usuario.dni, responde_dni: v.dni_cobro, hacia_dni: usuario.dni, ts_pedido: ts });
  }
  deps.repo.escribir('ventas_largas', filas);
  return {};
}

function ventaLargaResponder(req, deps) {
  const { usuario } = sesion(req, deps);
  const filas = deps.repo.leer('ventas_largas');
  const v = ventaLargaBuscar(filas, req.id);
  if (v.estado !== 'pedida' || v.responde_dni !== usuario.dni) falla('prohibido');
  const ts = new Date(deps.ahora()).toISOString();
  if (req.acepta === true) Object.assign(v, { estado: 'asignada', dni_vendio: v.hacia_dni, ts_decidido: ts, decide_dni: usuario.dni });
  else if (v.pide_dni === v.dni_cobro) Object.assign(v, { estado: 'cobro', pide_dni: '', responde_dni: '', hacia_dni: '', ts_pedido: '' });
  else Object.assign(v, { estado: 'disputa', ts_decidido: '' });
  deps.repo.escribir('ventas_largas', filas);
  return {};
}

function ventaLargaDecidir(req, deps) {
  const { usuario } = exigirAdmin(req, deps);
  const filas = deps.repo.leer('ventas_largas');
  const v = ventaLargaBuscar(filas, req.id);
  const dni = normalizarDni(req.dni);
  if (v.estado !== 'disputa' || (dni !== v.hacia_dni && dni !== v.dni_cobro)) falla('datos_invalidos');
  Object.assign(v, { estado: dni === v.dni_cobro ? 'confirmada' : 'asignada', dni_vendio: dni, ts_decidido: new Date(deps.ahora()).toISOString(), decide_dni: usuario.dni });
  deps.repo.escribir('ventas_largas', filas);
  return {};
}

// La venta suma a quien vendió y se le saca a quien solo cobró
function ajustarVentasLargas(valores, dni, mes, filas) {
  filas.filter(v => v.estado === 'asignada' && v.dni_vendio !== v.dni_cobro && String(v.fecha).indexOf(mes) === 0 && String(v.fecha) >= INICIO_REAL).forEach(v => {
    const signo = dni === v.dni_vendio ? 1 : dni === v.dni_cobro ? -1 : 0;
    if (!signo) return;
    const clave = v.tipo === 'nuevo' ? 'nuevos' : 'renovaciones';
    // 'no' es el ingreso de un socio nuevo con un plan corto: mueve los nuevos, no los planes largos.
    // Las filas de antes del 09/11/2026 no tienen el campo y son todas de 3 meses o más.
    if (v.largo !== 'no') valores.planes_largos = Math.max(0, (Number(valores.planes_largos) || 0) + signo);
    valores[clave] = Math.max(0, (Number(valores[clave]) || 0) + signo);
  });
  return valores;
}

function ventasLargasDe(usuario, usuarios, deps) {
  if (!tieneRol(usuario, 'recepcion')) return null;
  const hoy = deps.hoy(), desde = desdeReasignar(deps);
  const nombre = dni => (usuarios.find(u => u.dni === dni) || {}).nombre || '';
  const ver = v => ({ id: v.id, estado: v.estado, fecha: v.fecha, socio_nombre: v.socio_nombre, plan: v.plan, nombre_cobro: v.nombre_cobro, sugerido_dni: v.sugerido_dni === usuario.dni ? '' : v.sugerido_dni, sugerido: v.sugerido_dni === usuario.dni ? '' : nombre(v.sugerido_dni), pide: nombre(v.pide_dni), cobro_pide: v.pide_dni === v.dni_cobro, responde: nombre(v.responde_dni), te_sugiere: v.sugerido_dni === usuario.dni });
  const filas = deps.repo.leer('ventas_largas').filter(v => v.sede === usuario.sede);
  const abierta = v => v.estado === 'cobro' && String(v.fecha) >= desde;
  return {
    pedidos: filas.filter(v => v.estado === 'pedida' && v.responde_dni === usuario.dni).map(ver),
    espera: filas.filter(v => (v.estado === 'pedida' || v.estado === 'disputa') && v.pide_dni === usuario.dni).map(ver),
    cobradas: filas.filter(v => abierta(v) && v.dni_cobro === usuario.dni).map(ver),
    de_la_sede: filas.filter(v => abierta(v) && v.dni_cobro !== usuario.dni).map(ver),
    companeros: usuarios.filter(u => u.sede === usuario.sede && u.dni !== usuario.dni && esVerdad(u.activo) && tieneRol(u, 'recepcion')).map(u => ({ dni: u.dni, nombre: u.nombre })),
  };
}

function ventasLargasDeSede(usuario, usuarios, sede, deps) {
  if (!tieneRol(usuario, 'admin') && !tieneRol(usuario, 'coordinador')) return [];
  const nombre = dni => (usuarios.find(u => u.dni === dni) || {}).nombre || '';
  const desde = sumarDias(deps.hoy(), -DIAS_VENTAS_SEDE);
  return deps.repo.leer('ventas_largas').filter(v => v.sede === sede && String(v.fecha) >= desde && v.estado !== 'cobro').map(v => Object.assign({}, v, { nombre_vendio: nombre(v.dni_vendio), nombre_hacia: nombre(v.hacia_dni), nombre_responde: nombre(v.responde_dni) }));
}

// El último conteo de cada producto en cada sede
function ultimoStock(usuario, sede, deps) {
  const ve = tieneRol(usuario, 'admin') ? () => true : (tieneRol(usuario, 'coordinador') ? f => f.sede === sede : () => false);
  const ultimo = {};
  deps.repo.leer('stock').filter(ve).forEach(f => { const k = f.sede + '|' + f.producto; if (!ultimo[k] || String(f.ts) >= String(ultimo[k].ts)) ultimo[k] = f; });
  return Object.keys(ultimo).sort().map(k => ultimo[k]);
}

// Lo que eligió el socio le llega a quien autoriza, junto con el reconocimiento
function anotarEleccion(t, marca, deps) {
  if (String(t.tipo).indexOf('Felicitar') !== 0 || marca.resultado.indexOf('ELIGIÓ') !== 0) return;
  const filas = deps.repo.leer('beneficios');
  const b = filas.filter(x => x.tipo === 'constancia' && String(x.id).indexOf(t.socio_id + '-') === 0 && x.estado === 'pendiente').pop();
  if (!b) return;
  b.detalle = texto(b.detalle) + ' · ' + (marca.resultado === 'ELIGIÓ RECOVERY' ? 'Eligió pack recovery' : 'Eligió producto') + (marca.detalle ? ': ' + marca.detalle : '');
  deps.repo.escribir('beneficios', filas);
}

// ---------- Reconocimientos a socios: los registra recepción, los autorizan Lucía y Emanuel ----------

const ESTADOS_BENEFICIO = ['aprobada', 'rechazada', 'aplicada'];
const DIAS_VER_BENEFICIOS = 60;

// Nombre y apellido: sin eso no se puede encontrar a la persona para el cupón
function nombreCompleto(s) {
  return texto(s).split(/\s+/).filter(Boolean).length >= 2;
}

function beneficioCrear(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!nombreCompleto(req.socio_nombre) || !nombreCompleto(req.nuevo_socio)) falla('datos_invalidos');
  const id = 'B-' + deps.aleatorio(6);
  deps.repo.agregar('beneficios', {
    id: id, ts: new Date(deps.ahora()).toISOString(), tipo: 'referido', sede: usuario.sede, socio_nombre: texto(req.socio_nombre), nuevo_socio: texto(req.nuevo_socio),
    detalle: texto(req.detalle), registra_dni: usuario.dni, estado: 'pendiente', decide_dni: '', comentario: '', decidido_en: '',
  });
  return { id: id };
}

function beneficioDecidir(req, deps) {
  const { usuario } = sesion(req, deps);
  if (!tieneRol(usuario, 'admin')) falla('prohibido');
  const estado = texto(req.estado);
  if (ESTADOS_BENEFICIO.indexOf(estado) < 0) falla('datos_invalidos');
  const filas = deps.repo.leer('beneficios');
  const b = filas.find(x => x.id === texto(req.id));
  if (!b) falla('no_existe');
  b.estado = estado;
  b.decide_dni = usuario.dni;
  b.comentario = texto(req.comentario);
  b.decidido_en = new Date(deps.ahora()).toISOString();
  deps.repo.escribir('beneficios', filas);
  return {};
}

function cargarBeneficios(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas)) falla('datos_invalidos');
  const ya = {};
  deps.repo.leer('beneficios').forEach(b => { ya[b.id] = true; });
  let n = 0;
  req.filas.forEach(f => {
    if (!texto(f.id) || ya[f.id]) return;
    ya[f.id] = true;
    n++;
    deps.repo.agregar('beneficios', {
      id: texto(f.id), ts: new Date(deps.ahora()).toISOString(), tipo: 'constancia', sede: texto(f.sede), socio_nombre: texto(f.socio_nombre), nuevo_socio: '',
      detalle: texto(f.detalle), registra_dni: '', estado: 'pendiente', decide_dni: '', comentario: '', decidido_en: '',
    });
  });
  return { nuevos: n };
}

// Saca reconocimientos que quedaron sin efecto, por ejemplo los de antes de que arrancara la promo (Emanuel, 09/11/2026).
// Solo los que nadie decidió: uno ya autorizado o rechazado no se toca.
function beneficiosBorrar(req, deps) {
  exigirClave(req, deps);
  const ids = Array.isArray(req.ids) ? req.ids.map(texto).filter(Boolean) : [];
  if (!ids.length) falla('datos_invalidos');
  const filas = deps.repo.leer('beneficios');
  const quedan = filas.filter(b => !(ids.indexOf(b.id) >= 0 && b.estado === 'pendiente'));
  if (quedan.length !== filas.length) deps.repo.escribir('beneficios', quedan);
  return { borradas: filas.length - quedan.length };
}

function beneficiosParaAutorizar(usuario, deps) {
  if (!tieneRol(usuario, 'admin')) return [];
  const desde = new Date(deps.ahora() - DIAS_VER_BENEFICIOS * 86400000).toISOString();
  return deps.repo.leer('beneficios').filter(b => b.estado === 'pendiente' || b.estado === 'aprobada' || String(b.ts) >= desde).filter(b => b.estado === 'pendiente' || b.estado === 'aprobada');
}

// ---------- Pipeline (con clave) ----------

const SEDES = ['bariloche', 'bolson', 'puelo'];
const TURNOS = ['manana', 'tarde'];

function cargarTareas(req, deps) {
  exigirClave(req, deps);
  const fecha = texto(req.fecha);
  const nuevas = req.tareas;
  const cerrar = req.cerrar || [];
  if (!fechaIsoValida(fecha) || !Array.isArray(nuevas) || !Array.isArray(cerrar)) falla('datos_invalidos');
  const completa = t => t && SEDES.indexOf(t.sede) >= 0 && texto(t.socio_id) && texto(t.asignado_dni);
  if (!nuevas.every(completa) || !cerrar.every(c => c && SEDES.indexOf(c.sede) >= 0 && texto(c.socio_id))) falla('datos_invalidos');
  const r = fusionarCargaDetalle(deps.repo.leer('tareas'), nuevas, cerrar, fecha);
  deps.repo.escribir('tareas', r.filas);
  registrarVerificadas(r.filas, cerrar, deps);
  const usoGuardado = deps.repo.leer('uso');
  const usoVigente = usoGuardado.filter(f => String(f.fecha) >= sumarDias(fecha, -DIAS_GUARDAR_USO));
  if (usoVigente.length < usoGuardado.length) deps.repo.escribir('uso', usoVigente);
  return { nuevas: r.nuevas, actualizadas: r.actualizadas, cerradas: r.cerradas };
}

// La sede corregida recién cuenta cuando MOVE la muestra (Emanuel, 04/11/2026). Lo anota el proceso diario, nunca la persona.
function registrarVerificadas(tareas, cerrar, deps) {
  const verificadas = cerrar.filter(c => c.verificada);
  if (!verificadas.length) return;
  const ya = {};
  deps.repo.leer('registro').forEach(r => { ya[r.id_marca] = true; });
  const ts = new Date(deps.ahora()).toISOString();
  verificadas.forEach(c => {
    const t = tareas.filter(x => x.sede === c.sede && x.socio_id === String(c.socio_id) && String(x.tipo).indexOf('Entrena en otra sede') === 0).pop();
    if (!t || ya['verificada-' + t.id]) return;
    ya['verificada-' + t.id] = true;
    deps.repo.agregar('registro', {
      segundos: '', adelantada: '', id_marca: 'verificada-' + t.id, ts: ts, tarea_id: t.id, fecha_tarea: t.fecha, sede: t.sede, socio_id: t.socio_id,
      socio_nombre: t.socio_nombre, tipo: t.tipo, dni: t.asignado_dni, canal: 'SIN CONTACTO', resultado: 'VERIFICADO EN MOVE', fecha_resultado: '', detalle: '',
    });
  });
}

// Corrige a quién le toca una tarea pendiente. No cambia fechas: no le suma atraso a nadie.
function reasignarTareas(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.cambios)) falla('datos_invalidos');
  const tareas = deps.repo.leer('tareas');
  let n = 0;
  req.cambios.forEach(c => {
    tareas.filter(t => t.sede === c.sede && t.socio_id === String(c.socio_id) && t.estado === 'pendiente').forEach(t => {
      t.asignado_dni = String(c.asignado_dni);
      n++;
    });
  });
  deps.repo.escribir('tareas', tareas);
  return { reasignadas: n };
}

function bajarRegistro(req, deps) {
  exigirClave(req, deps);
  const desde = texto(req.desde);
  return { filas: deps.repo.leer('registro').filter(r => String(r.ts) >= desde) };
}

function usuariosResumen(req, deps) {
  exigirClave(req, deps);
  // El horario y lo que ya tiene cargado cada día: con eso el proceso de la PC reparte las tareas nuevas
  // hasta la meta de cada persona y ningún día le queda con 113 (Emanuel, 09/11/2026).
  const carga = {};
  deps.repo.leer('tareas').forEach(t => {
    if (t.estado !== 'pendiente') return;
    const k = t.asignado_dni + '|' + String(t.fecha).slice(0, 10);
    carga[k] = (carga[k] || 0) + 1;
  });
  return deps.repo.leer('usuarios').filter(u => esVerdad(u.activo))
    .map(u => ({
      dni: u.dni, nombre: u.nombre, sede: u.sede, turno: u.turno, roles: u.roles,
      hora_inicio: u.hora_inicio || '', hora_fin: u.hora_fin || '',
      pendientes_por_fecha: Object.keys(carga).filter(k => k.indexOf(u.dni + '|') === 0)
        .reduce((o, k) => { o[k.split('|')[1]] = carga[k]; return o; }, {}),
    }));
}

// ---------- Registro manual: lo que MOVE no ve ----------

const TIPOS_ACTIVIDAD = ['mensaje', 'consulta', 'prueba', 'resena', 'referido', 'encuesta'];
// Encuesta de bienvenida o de baja mandada como tarea extra (Emanuel, 10/11/2026). Va en la categoría; si el socio había
// respondido el mensaje de antes se guarda en `interes` ('si' o 'no'), para no agregar una columna a la hoja.
const CATEGORIAS_ENCUESTA = ['Bienvenida', 'Baja'];
const DIAS_SEGUIMIENTO = { alto: 0, medio: 2, exploratorio: 7 };   // MAN-REC-02: alto en el momento, medio a las 48 horas, exploratorio a la semana

function registrar(req, deps) {
  const { usuario } = sesion(req, deps);
  const id = texto(req.id), tipo = texto(req.tipo), nombre = texto(req.nombre), interes = texto(req.interes);
  if (!id || TIPOS_ACTIVIDAD.indexOf(tipo) < 0 || !nombre) falla('datos_invalidos');
  if (tipo === 'consulta' && !Object.prototype.hasOwnProperty.call(DIAS_SEGUIMIENTO, interes)) falla('datos_invalidos');
  const respondio = texto(req.respondio);
  if (tipo === 'encuesta' && (CATEGORIAS_ENCUESTA.indexOf(texto(req.categoria)) < 0 || ['si', 'no'].indexOf(respondio) < 0)) falla('datos_invalidos');
  if (deps.repo.leer('actividad').some(a => a.id === id)) return {};
  const hoy = deps.hoy();
  deps.repo.agregar('actividad', {
    id: id, ts: new Date(deps.ahora()).toISOString(), dni: usuario.dni, sede: usuario.sede, tipo: tipo, nombre: nombre,
    categoria: texto(req.categoria), canal: texto(req.canal), origen: texto(req.origen), interes: tipo === 'encuesta' ? respondio : interes, detalle: texto(req.detalle),
  });
  if (tipo === 'consulta') {
    const fecha = sumarDias(hoy, DIAS_SEGUIMIENTO[interes]);
    deps.repo.agregar('tareas', {
      id: 'consulta-' + id, fecha: fecha, sede: usuario.sede, socio_id: 'consulta-' + id, socio_nombre: nombre, profe: '', tipo: 'Seguimiento de consulta',
      prioridad: '2', situacion: 'Consultó' + (texto(req.detalle) ? ': ' + texto(req.detalle) : '') + ' · interés ' + interes, accion: 'Hacer el seguimiento y proponerle la visita',
      ultima_anotacion: '', asignado_dni: usuario.dni, pendiente_desde: fecha, estado: 'pendiente', hecha_en: '', intro: '',
    });
  }
  return {};
}

// ---------- Rendimiento ----------

function delMes(iso, mes) {
  const f = fechaArgentina(iso);
  return f.indexOf(mes) === 0 && f >= INICIO_REAL;
}

// Lo que se mide en la app, en vivo. Lo que viene de MOVE (cajas, renovaciones) lo carga el pipeline cada mañana.
function valoresEnApp(dni, mes, tareas, registro, actividad, hoy) {
  const suyas = tareas.filter(t => t.asignado_dni === dni && t.estado !== 'cerrada' && !esRecordatorio(t.tipo) && pendienteDesde(t).indexOf(mes) === 0 && (t.estado === 'hecha' ? fechaArgentina(t.hecha_en) >= INICIO_REAL : String(t.fecha) <= hoy));
  const hechas = suyas.filter(t => t.estado === 'hecha');
  const aTiempo = hechas.filter(t => diasHabiles(pendienteDesde(t), fechaArgentina(t.hecha_en)) === 0);
  const marcas = registro.filter(r => r.dni === dni && delMes(r.ts, mes));
  const contactos = marcas.filter(esContactoConSocio);
  const CON_FECHA = ['RESERVA', 'VUELVE', 'PAGA', 'PAGÓ', 'VOLVIÓ', 'VACACIONES'];
  const reten = marcas.filter(r => !/^(Controlar stock|Encargo|Felicitar|Invitar a escanear|Cumpleaños|Encuesta de baja|Revisar profesor|Seguimiento de consulta|Profes de hoy|Apertura|Cierre|Socio antiguo|Coordinar|Cambiar profesor|Evaluación sin cargar|Entrena en otra sede|Revisar plan)/.test(r.tipo));
  const act = actividad.filter(a => a.dni === dni && delMes(a.ts, mes));
  const cuenta = t => act.filter(a => a.tipo === t).length;
  const encuestas = suyas.filter(t => String(t.tipo).indexOf('Encuesta de baja') === 0);
  const v = {
    mensajes: contactos.length + cuenta('mensaje') + cuenta('encuesta'), consultas: cuenta('consulta'), dias_prueba: cuenta('prueba'), resenas: cuenta('resena'), referidos: cuenta('referido'),
    tareas_total: suyas.length, tareas_hechas: hechas.length, adelantadas: marcas.filter(r => r.adelantada === '1').length,
    audios: marcas.filter(r => r.canal === 'AU').length,
  };
  if (suyas.length) v.tareas_pct = hechas.length / suyas.length;
  if (hechas.length) v.a_tiempo_pct = aTiempo.length / hechas.length;
  if (reten.length) v.contacto_pct = reten.filter(r => CON_FECHA.indexOf(r.resultado) >= 0).length / reten.length;
  if (encuestas.length) v.encuestas_pct = encuestas.filter(t => t.estado === 'hecha').length / encuestas.length;
  if (!cuenta('resena')) delete v.resenas;
  if (!cuenta('referido')) delete v.referidos;
  return v;
}

// Hechas por día, para el gráfico
function serieTareas(dni, mes, tareas) {
  const dias = {};
  tareas.filter(t => t.asignado_dni === dni && t.estado === 'hecha' && delMes(t.hecha_en, mes)).forEach(t => {
    const f = fechaArgentina(t.hecha_en);
    dias[f] = (dias[f] || 0) + 1;
  });
  return Object.keys(dias).sort().map(f => ({ fecha: f, hechas: dias[f] }));
}

// Las horas de actividad las ven los admin (Emanuel y Lucía) y quien coordina sin atender recepción (Emanuel, 04/11/2026).
function veUso(usuario) {
  return tieneRol(usuario, 'admin') || (tieneRol(usuario, 'coordinador') && !tieneRol(usuario, 'recepcion'));
}

const DIAS_GUARDAR_USO = 40;

function registrarUso(req, deps) {
  const { usuario } = sesion(req, deps);
  const fecha = texto(req.fecha);
  if (!fechaIsoValida(fecha)) falla('datos_invalidos');
  const lista = x => (Array.isArray(x) ? x : []).map(Number).filter(m => m >= 0 && m < 1440).slice(0, 1440).join(',');
  const fila = { ts: new Date(deps.ahora()).toISOString(), dni: usuario.dni, fecha: fecha, activos: lista(req.activos), quieta: lista(req.quieta), otra: lista(req.otra) };
  if (fila.activos || fila.quieta || fila.otra) deps.repo.agregar('uso', fila);
  return {};
}

function marcasDeTrabajo(registro, dni) {
  return registro.filter(r => r.dni === dni && r.resultado !== 'VERIFICADO EN MOVE');
}

function minutoAhora(deps) {
  return minutoDeTs(new Date(deps.ahora()).toISOString());
}

function usoDelMes(u, mes, filasUso, registro, deps) {
  const hoy = deps.hoy();
  const suyas = marcasDeTrabajo(registro, u.dni).filter(r => delMes(r.ts, mes));
  const usos = filasUso.filter(f => f.dni === u.dni && String(f.fecha).indexOf(mes) === 0);
  const dias = {};
  suyas.forEach(r => { dias[fechaArgentina(r.ts)] = true; });
  usos.forEach(f => { dias[f.fecha] = true; });
  const inicio = aMinutoDelDia(u.hora_inicio), fin = aMinutoDelDia(u.hora_fin);
  return Object.keys(dias).sort().map(f => Object.assign({ fecha: f }, usoDelDia(usos.filter(x => x.fecha === f), suyas.filter(r => fechaArgentina(r.ts) === f), inicio, fin, f === hoy ? minutoAhora(deps) : null)));
}

// Cuándo trabajó las tareas: horas de cada día, tareas por hora del día y tiempo promedio con la tarea abierta
function tiemposDe(dni, mes, registro, horaFin) {
  const marcas = marcasDeTrabajo(registro, dni).filter(r => delMes(r.ts, mes));
  const horaDe = ts => new Date(Date.parse(ts) - 3 * 3600 * 1000).toISOString().slice(11, 16);
  const dias = {};
  const porHora = {};
  marcas.forEach(r => {
    const f = fechaArgentina(r.ts), h = horaDe(r.ts);
    const d = dias[f] = dias[f] || { fecha: f, marcas: 0, primera: h, ultima: h, segundos: 0 };
    d.marcas++;
    d.segundos += Number(r.segundos) || 0;
    if (h < d.primera) d.primera = h;
    if (h > d.ultima) d.ultima = h;
    const hh = Number(h.slice(0, 2));
    porHora[hh] = (porHora[hh] || 0) + 1;
  });
  const conTiempo = marcas.map(r => Number(r.segundos)).filter(s => !isNaN(s) && s > 0);
  return {
    por_dia: Object.keys(dias).sort().map(f => {
      const d = dias[f];
      const min = hhmm => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
      const trabajado = min(d.ultima) - min(d.primera);
      return Object.assign({}, d, {
        por_hora: trabajado >= 15 ? Math.round(d.marcas / (trabajado / 60) * 10) / 10 : null,
        minutos_en_tareas: Math.round(d.segundos / 60),
        minutos_libres: horaFin ? Math.max(0, min(horaFin) - min(d.ultima)) : null,
      });
    }), por_hora: porHora,
    segundos_promedio: conTiempo.length ? Math.round(conTiempo.reduce((a, b) => a + b, 0) / conTiempo.length) : null,
  };
}

// ---------- Mi día: lo que motiva ----------

// Cuántas hizo en cada uno de los últimos días hábiles, del más viejo al más nuevo
function hechasPorDia(dni, tareas, hoy, dias) {
  const cuenta = {};
  tareas.filter(t => t.asignado_dni === dni && t.estado === 'hecha' && fechaArgentina(t.hecha_en) >= INICIO_REAL)
    .forEach(t => { const f = fechaArgentina(t.hecha_en); cuenta[f] = (cuenta[f] || 0) + 1; });
  const out = [];
  let d = hoy;
  for (let i = 0; i < 40 && out.length < dias; i++) {
    d = sumarDias(d, -1);
    if (d < INICIO_REAL) break;
    const dia = new Date(d + 'T12:00:00Z').getUTCDay();
    if (dia === 0 || dia === 6) continue;
    out.unshift(cuenta[d] || 0);
  }
  return out;
}

function metaDe(usuario, tareas, hoy) {
  return metaDelDia(horasDeTurno(usuario), hechasPorDia(usuario.dni, tareas, hoy, 10));
}

function rachaDe(dni, tareas, hoy) {
  const dias = {};
  tareas.filter(t => t.asignado_dni === dni && t.estado === 'hecha' && fechaArgentina(t.hecha_en) >= INICIO_REAL).forEach(t => { dias[fechaArgentina(t.hecha_en)] = true; });
  let n = 0;
  let d = hoy;
  if (dias[d]) n++;
  for (let i = 0; i < 40; i++) {
    d = sumarDias(d, -1);
    const dia = new Date(d + 'T12:00:00Z').getUTCDay();
    if (dia === 0 || dia === 6) continue;
    if (!dias[d]) break;
    n++;
  }
  return n;
}

function miDia(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const hoy = deps.hoy(), mes = hoy.slice(0, 7);
  const tareas = deps.repo.leer('tareas'), registro = deps.repo.leer('registro'), actividad = deps.repo.leer('actividad');
  const fila = deps.repo.leer('rendimiento').find(r => r.mes === mes && r.dni === usuario.dni);
  const valores = ajustarVentasLargas(Object.assign({}, fila ? JSON.parse(fila.datos) : {}, valoresEnApp(usuario.dni, mes, tareas, registro, actividad, hoy)), usuario.dni, mes, deps.repo.leer('ventas_largas'));
  const propios = {};
  deps.repo.leer('objetivos').filter(o => o.dni === usuario.dni).forEach(o => { propios[o.clave] = Number(o.valor); });
  const suyas = tareas.filter(t => t.asignado_dni === usuario.dni && t.estado !== 'cerrada');
  const pendientes = suyas.filter(t => t.estado === 'pendiente' && String(t.fecha) <= hoy && !seVerificaEnMove(t.tipo) && !esRecordatorio(t.tipo)).map(t => conDias(t, hoy));
  const atrasadas = pendientes.filter(t => diasHabiles(pendienteDesde(t), hoy) >= 1).length;
  const deHoy = valoresEnAppDia(usuario.dni, hoy, tareas, registro, actividad);
  const racha = rachaDe(usuario.dni, tareas, hoy);
  const hora = Number(new Date(deps.ahora() - 3 * 3600 * 1000).toISOString().slice(11, 13));
  const ordenadas = pendientes.slice().sort(ordenTareas);
  const anterior = (() => {
    for (let i = 1, d = hoy; i < 8; i++) {
      d = sumarDias(d, -1);
      const n = suyas.filter(t => t.estado === 'hecha' && fechaArgentina(t.hecha_en) === d).length;
      if (n) return n;
    }
    return 0;
  })();
  const delMesReg = registro.filter(r => r.dni === usuario.dni && String(fechaArgentina(r.ts)).indexOf(mes) === 0);
  const delMesCierres = deps.repo.leer('cierres').filter(c => c.dni === usuario.dni && String(c.fecha).indexOf(mes) === 0);
  const medallas = medallasDelMes({
    tareas: valores.tareas_hechas, racha: racha, adelantadas: valores.adelantadas, volvieron: valores.reenganches,
    puente: delMesReg.filter(r => r.resultado !== 'VERIFICADO EN MOVE' && /^(Coordinar|Evaluación sin cargar|Revisar plan|Entrena en otra sede|Revisar profesor)/.test(r.tipo)).length,
    corregidos: delMesReg.filter(r => r.resultado === 'VERIFICADO EN MOVE').length,
    encuestas: delMesCierres.length, redondos: delMesCierres.filter(c => Number(c.pendientes) === 0).length,
  });
  const deMiSede = tareas.filter(t => t.sede === usuario.sede && !esRecordatorio(t.tipo) && !seVerificaEnMove(t.tipo) && t.estado !== 'cerrada');
  return {
    medallas: medallas, volvieron: Number(valores.reenganches) || 0, prioritarias: pendientes.filter(t => nivelDeTarea(t) === 1).length,
    equipo: { hechas: deMiSede.filter(t => t.estado === 'hecha' && fechaArgentina(t.hecha_en) === hoy).length, faltan: deMiSede.filter(t => t.estado === 'pendiente' && String(t.fecha) <= hoy).length },
    roles: rolesDe(usuario),
    siguiente: ordenadas[0] ? { nombre: ordenadas[0].socio_nombre, situacion: ordenadas[0].situacion } : null, ayer: anterior,
    para_adelantar: suyas.filter(t => t.estado === 'pendiente' && String(t.fecha) > hoy).length, hora_inicio: usuario.hora_inicio || '',
    dias_sin_plan: Number(valores.dias_sin_plan_largo) || 0,
    cartel: cartelDe(usuario, deps), saludo: saludo(usuario.nombre, hora), puntos: calcularPuntos(valores), racha: racha,
    hoy: { hechas: deHoy.hechas, pendientes: pendientes.length, atrasadas: atrasadas, mensajes: deHoy.mensajes, consultas: deHoy.consultas, meta: metaDe(usuario, tareas, hoy) },
    coach: mensajesCoach(valores, propios, { hoy: hoy, atrasadas: atrasadas, racha: racha }),
    ideas: ideasParaSumar({ valores: valores, objetivos: propios, fecha: hoy, hechoHoy: actividad.filter(a => a.dni === usuario.dni && fechaArgentina(a.ts) === hoy).reduce((o, a) => { o[a.tipo] = (o[a.tipo] || 0) + 1; return o; }, {}) }),
    ventas_largas: ventasLargasDe(usuario, usuarios, deps), hora_fin: usuario.hora_fin || '', cierre_hecho: deps.repo.leer('cierres').some(c => c.dni === usuario.dni && c.fecha === hoy),
  };
}

// El cartel de que desde el lunes se mide: lo ve cada recepcionista hasta que lo marca como visto (no lo ven quienes administran).
function cartelDe(usuario, deps) {
  if (!tieneRol(usuario, 'recepcion') || tieneRol(usuario, 'admin')) return null;
  return { clave: CARTEL_INICIO, visto: deps.repo.leer('avisos').some(a => a.dni === usuario.dni && a.clave === CARTEL_INICIO) };
}

function avisoVisto(req, deps) {
  const { usuario } = sesion(req, deps);
  if (texto(req.clave) !== CARTEL_INICIO) falla('datos_invalidos');
  if (!deps.repo.leer('avisos').some(a => a.dni === usuario.dni && a.clave === CARTEL_INICIO)) {
    deps.repo.agregar('avisos', { dni: usuario.dni, clave: CARTEL_INICIO, ts: new Date(deps.ahora()).toISOString(), nombre: usuario.nombre });
  }
  return {};
}

function valoresEnAppDia(dni, hoy, tareas, registro, actividad) {
  const esHoy = ts => fechaArgentina(ts) === hoy;
  return {
    hechas: tareas.filter(t => t.asignado_dni === dni && t.estado === 'hecha' && esHoy(t.hecha_en)).length,
    mensajes: registro.filter(r => r.dni === dni && esHoy(r.ts) && esContactoConSocio(r)).length
      + actividad.filter(a => a.dni === dni && a.tipo === 'mensaje' && esHoy(a.ts)).length,
    consultas: actividad.filter(a => a.dni === dni && a.tipo === 'consulta' && esHoy(a.ts)).length,
  };
}

// ---------- Cierre de turno ----------

function cierreGuardar(req, deps) {
  const { usuario } = sesion(req, deps);
  const animo = Number(req.animo);
  if (!(animo >= 1 && animo <= 5)) falla('datos_invalidos');
  const nota = v => {
    if (v == null || v === '') return '';
    const n = Number(v);
    if (!(n >= 1 && n <= 5)) falla('datos_invalidos');
    return String(n);
  };
  const sala = nota(req.sala), profes = nota(req.profes), equipo = nota(req.equipo), socios = nota(req.socios);
  const hoy = deps.hoy();
  const tareas = deps.repo.leer('tareas');
  const d = valoresEnAppDia(usuario.dni, hoy, tareas, deps.repo.leer('registro'), deps.repo.leer('actividad'));
  const pendientes = tareas.filter(t => t.asignado_dni === usuario.dni && t.estado === 'pendiente' && String(t.fecha) <= hoy && !seVerificaEnMove(t.tipo) && !esRecordatorio(t.tipo)).length;
  const filas = deps.repo.leer('cierres').filter(c => !(c.dni === usuario.dni && c.fecha === hoy));
  filas.push({
    fecha: hoy, ts: new Date(deps.ahora()).toISOString(), dni: usuario.dni, nombre: usuario.nombre, sede: usuario.sede, animo: String(animo),
    respuestas: JSON.stringify(req.respuestas || {}), comentario: texto(req.comentario), hechas: String(d.hechas), pendientes: String(pendientes),
    mensajes: String(d.mensajes), consultas: String(d.consultas), sala: sala, profes: profes, equipo: equipo, socios: socios, lo_mejor: texto(req.lo_mejor).slice(0, 300), pregunta: texto(req.pregunta).slice(0, 120),
  });
  deps.repo.escribir('cierres', filas);
  return {};
}

// Admin y supervisión ven todas las sedes; cada responsable, la suya.
function cierresVer(req, deps) {
  const { usuario } = sesion(req, deps);
  const todas = tieneRol(usuario, 'admin') || tieneRol(usuario, 'supervision');
  if (!todas && !tieneRol(usuario, 'coordinador')) falla('prohibido');
  const desde = sumarDias(deps.hoy(), -14);
  const cierres = deps.repo.leer('cierres').filter(c => c.fecha >= desde && (todas || c.sede === usuario.sede))
    .map(c => Object.assign({}, c, { respuestas: JSON.parse(c.respuestas || '{}') }))
    .sort((a, b) => (b.fecha + b.ts).localeCompare(a.fecha + a.ts));
  return { cierres: cierres, resumen: resumenCierres(cierres) };
}

// Llegada de los profes, medida con su QR. La carga el pipeline cada mañana.
function cargarProfes(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas)) falla('datos_invalidos');
  deps.repo.escribir('profes', req.filas);
  return { filas: req.filas.length };
}

function cargarFichajes(req, deps) {
  exigirClave(req, deps);
  const fecha = texto(req.fecha);
  const buena = f => f && SEDES.indexOf(f.sede) >= 0 && texto(f.id) && texto(f.persona_id) && texto(f.persona) && ['entrada', 'salida'].indexOf(f.momento) >= 0;
  if (!fechaIsoValida(fecha) || !Array.isArray(req.filas) || !req.filas.every(buena)) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  const r = fusionarFichajes(deps.repo.leer('fichajes'), req.filas, fecha, ts);
  if (r.cambio) deps.repo.escribir('fichajes', r.filas);
  deps.repo.escribir('fichajes_control', [{ ts: ts }]);
  // Sin el campo reservas no se toca nada: la PC no pudo mirarlas y lo vigente sigue vigente
  if (req.reservas !== undefined) {
    const buenaReserva = f => f && SEDES.indexOf(f.sede) >= 0 && texto(f.id) && texto(f.socio_id) && texto(f.socio) && aMinutoDelDia(f.hora) != null;
    if (!Array.isArray(req.reservas) || !req.reservas.every(buenaReserva)) falla('datos_invalidos');
    const rr = fusionarReservas(deps.repo.leer('reservas_qr'), req.reservas, fecha, ts);
    if (rr.cambio) deps.repo.escribir('reservas_qr', rr.filas);
  }
  return { faltan: req.filas.length };
}

function contextoFichaje(usuario, deps) {
  const inicio = aMinutoDelDia(usuario.hora_inicio), fin = aMinutoDelDia(usuario.hora_fin), m = minutoAhora(deps);
  return { dni: usuario.dni, recepcion: tieneRol(usuario, 'recepcion'), sede: usuario.sede, enTurno: inicio != null && fin != null && m >= inicio && m < fin, hoy: deps.hoy(), ahora: deps.ahora() };
}

function fichajesVer(req, deps) {
  const { usuario } = sesion(req, deps);
  const control = deps.repo.leer('fichajes_control')[0];
  const vigente = control && deps.ahora() - Date.parse(control.ts) <= FICHAJES_VIGENCIA_MIN * 60000;
  const m = minutoAhora(deps);
  return {
    filas: vigente ? fichajesVisibles(deps.repo.leer('fichajes'), contextoFichaje(usuario, deps)) : [],
    reservas: vigente ? reservasVisibles(deps.repo.leer('reservas_qr'), contextoFichaje(usuario, deps), m) : [],
    detenido: control && !vigente && tieneRol(usuario, 'admin') && m >= 390 && m <= 1320 ? control.ts : '',
  };
}

function fichajeMarcar(req, deps) {
  const { usuario } = sesion(req, deps);
  const que = texto(req.que);
  if (['recordado', 'no_viene'].indexOf(que) < 0) falla('datos_invalidos');
  const filas = deps.repo.leer('fichajes');
  const f = filas.find(x => x.id === texto(req.id));
  if (!f) falla('no_existe');
  const c = contextoFichaje(usuario, deps);
  if (!c.recepcion || !c.enTurno || f.sede !== c.sede || f.dni === c.dni) falla('prohibido');
  const ts = new Date(deps.ahora()).toISOString();
  f[que + '_ts'] = ts;
  f[que + '_dni'] = usuario.dni;
  deps.repo.escribir('fichajes', filas);
  return { filas: fichajesVisibles(filas, c) };
}

// recordado: le recordó que escanee, sigue a la vista por si no lo hace. profe y contacto: ya está resuelta.
function reservaMarcar(req, deps) {
  const { usuario } = sesion(req, deps);
  const que = texto(req.que);
  if (['recordado', 'profe', 'contacto'].indexOf(que) < 0) falla('datos_invalidos');
  const filas = deps.repo.leer('reservas_qr');
  const f = filas.find(x => x.id === texto(req.id));
  if (!f) falla('no_existe');
  const c = contextoFichaje(usuario, deps);
  if (!c.recepcion || !c.enTurno || f.sede !== c.sede) falla('prohibido');
  const ts = new Date(deps.ahora()).toISOString();
  if (que === 'recordado') { f.recordado_ts = ts; f.recordado_dni = usuario.dni; }
  else { f.resuelta_ts = ts; f.resuelta_dni = usuario.dni; f.resultado = que; f.detalle = texto(req.detalle).slice(0, 300); }
  deps.repo.escribir('reservas_qr', filas);
  return { reservas: reservasVisibles(filas, c, minutoAhora(deps)) };
}

// Lo que contestaron los socios: la PC lo usa para volver a preguntar a la semana cuando hay un tema de salud
function reservasBajar(req, deps) {
  exigirClave(req, deps);
  return { filas: deps.repo.leer('reservas_qr').filter(f => f.resultado === 'contacto' && f.detalle) };
}

function profesVer(req, deps) {
  const { usuario } = sesion(req, deps);
  const sede = sedePermitida(usuario, texto(req.sede));
  return { filas: deps.repo.leer('profes').filter(f => f.sede === sede) };
}

function respaldo(req, deps) {
  exigirClave(req, deps);
  const usuarios = deps.repo.leer('usuarios').map(u => { const c = Object.assign({}, u); delete c.pin_hash; delete c.sal; return c; });
  const out = { usuarios: usuarios };
  ['tareas', 'registro', 'garantia', 'actividad', 'rendimiento', 'objetivos', 'cierres', 'profes', 'fichajes', 'reservas_qr', 'avisos', 'uso', 'beneficios', 'stock', 'ventas', 'ventas_largas', 'ocupacion', 'proximas'].forEach(h => { out[h] = deps.repo.leer(h); });
  return out;
}

// Horas: cada día con actividad o caja, por las horas de su turno. No hay fichaje: si un día trabajó distinto, el número no lo sabe.
function eficienciaDelMes(u, mes, valores, uso, registro, filasVentas, deps) {
  const inicio = aMinutoDelDia(u.hora_inicio), fin = aMinutoDelDia(u.hora_fin);
  if (inicio == null || fin == null || fin <= inicio) return null;
  const hoy = deps.hoy();
  const app = {}, caja = {};
  uso.forEach(d => { app[d.fecha] = true; });
  filasVentas.forEach(f => { if (f.dni === u.dni && String(f.fecha).indexOf(mes) === 0) caja[f.fecha] = true; });
  const delDia = f => (f === hoy ? Math.max(0, Math.min(fin, minutoAhora(deps)) - inicio) : fin - inicio);
  const horasDe = dias => Object.keys(dias).reduce((a, f) => a + delDia(f), 0) / 60;
  const conSenal = uso.filter(d => d.con_senal);
  return eficienciaDe({
    horas: horasDe(Object.assign({}, app, caja)), horasApp: horasDe(app), horasCaja: horasDe(caja),
    tareas: marcasDeTrabajo(registro, u.dni).filter(r => delMes(r.ts, mes)).length,
    puntosVenta: calcularPuntos(Object.assign({}, valores, { tareas_hechas: 0, adelantadas: 0 })),
    minutosActivos: conSenal.reduce((a, d) => a + d.activo, 0),
    minutosConSenal: conSenal.reduce((a, d) => a + delDia(d.fecha), 0),
  });
}

function vistaRendimiento(req, deps) {
  const { usuario, usuarios } = sesion(req, deps);
  const mes = /^\d{4}-\d{2}$/.test(texto(req.mes)) ? texto(req.mes) : deps.hoy().slice(0, 7);
  let equipo;
  const coordina = tieneRol(usuario, 'admin') || tieneRol(usuario, 'coordinador');
  if (coordina) {
    if (texto(req.dni)) falla('prohibido');
    const sede = sedePermitida(usuario, texto(req.sede));
    equipo = usuarios.filter(u => u.sede === sede && esVerdad(u.activo) && tieneRol(u, 'recepcion'));
  } else {
    if (texto(req.dni) && normalizarDni(req.dni) !== usuario.dni) falla('prohibido');
    equipo = [usuario];
  }
  const tareas = deps.repo.leer('tareas'), registro = deps.repo.leer('registro'), actividad = deps.repo.leer('actividad');
  const filasUso = veUso(usuario) ? deps.repo.leer('uso') : [];
  const calculado = deps.repo.leer('rendimiento').filter(r => r.mes === mes);
  const objetivos = deps.repo.leer('objetivos');
  const filasVentas = deps.repo.leer('ventas');
  const filasLargas = deps.repo.leer('ventas_largas');
  let actualizado = '';
  const personas = equipo.map(u => {
    const fila = calculado.find(r => r.dni === u.dni);
    if (fila && fila.actualizado > actualizado) actualizado = fila.actualizado;
    const valores = Object.assign({}, fila ? JSON.parse(fila.datos) : {}, valoresEnApp(u.dni, mes, tareas, registro, actividad, deps.hoy()));
    ajustarVentasLargas(valores, u.dni, mes, filasLargas);
    if (valores.consultas && valores.nuevos != null) valores.conversion = Math.min(1, valores.nuevos / valores.consultas);   // hay nuevos que no pasaron por una consulta registrada
    const propios = {};
    objetivos.filter(o => o.dni === u.dni).forEach(o => { propios[o.clave] = Number(o.valor); });
    const puntaje = puntuar(valores, propios);
    const puntos = calcularPuntos(valores);
    if (!coordina) SOLO_COORDINACION.forEach(k => { delete valores[k]; });
    const out = { dni: u.dni, nombre: u.nombre, turno: u.turno, sede: u.sede, valores: valores, puntaje: puntaje, puntos: puntos, serie: serieTareas(u.dni, mes, tareas), ventas_dias: ventasDePersona(u.dni, mes, coordina, filasVentas) };
    if (veUso(usuario)) {
      out.tiempos = tiemposDe(u.dni, mes, registro, u.hora_fin);
      out.uso = usoDelMes(u, mes, filasUso, registro, deps);
    }
    if (tieneRol(usuario, 'admin')) out.eficiencia = eficienciaDelMes(u, mes, valores, out.uso, registro, filasVentas, deps);
    return out;
  }).sort((a, b) => (b.puntaje.total == null ? -1 : b.puntaje.total) - (a.puntaje.total == null ? -1 : a.puntaje.total));
  return { mes: mes, hoy: deps.hoy(), actualizado: actualizado, personas: personas, metricas: METRICAS };
}

function objetivosGuardar(req, deps) {
  const { usuarios } = exigirAdmin(req, deps);
  const dni = normalizarDni(req.dni);
  const valores = req.valores;
  if (!usuarios.some(u => u.dni === dni) || !valores || typeof valores !== 'object') falla('datos_invalidos');
  const claves = Object.keys(valores);
  if (!claves.length || !claves.every(k => METRICAS.some(m => m.clave === k) && Number(valores[k]) >= 0)) falla('datos_invalidos');
  const filas = deps.repo.leer('objetivos').filter(o => !(o.dni === dni && claves.indexOf(o.clave) >= 0));
  claves.forEach(k => filas.push({ dni: dni, clave: k, valor: String(Number(valores[k])) }));
  deps.repo.escribir('objetivos', filas);
  return {};
}

// ---------- Mapa de calor de reservas ----------

function cargarOcupacion(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.filas)) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  deps.repo.escribir('ocupacion', req.filas.map(f => ({
    sede: texto(f.sede), tipo: texto(f.tipo), clave: texto(f.clave), dia: texto(f.dia), hora: texto(f.hora),
    dias: String(f.dias || 0), clases: String(f.clases || 0), cupo: String(f.cupo || 0), reservas: String(f.reservas || 0),
    asistieron: String(f.asistieron || 0), ausentes: String(f.ausentes || 0),
    ocupacion: f.ocupacion == null ? '' : String(f.ocupacion), sin_cupo: String(f.sin_cupo || 0), actualizado: ts,
  })));
  return { filas: req.filas.length };
}

// Franjas con más lugar de ese día: lo que recepción contesta cuando preguntan a qué hora hay menos gente.
// Una franja medida un solo día no se recomienda, y tiene que quedar al menos un lugar libre (Emanuel, 09/11/2026).
const MIN_DIAS_OCUPACION = 2;
function recomendarFranjas(filas, dia, cuantas) {
  return filas
    .filter(f => f.tipo === 'patron' && String(f.clave) === String(dia) && Number(f.cupo) > 0 && f.ocupacion !== ''
      && Number(f.dias) >= MIN_DIAS_OCUPACION && Number(f.cupo) - Number(f.reservas) >= 1)
    .sort((a, b) => (Number(a.ocupacion) - Number(b.ocupacion)) || String(a.hora).localeCompare(String(b.hora)))
    .slice(0, cuantas || 3);
}

function cargarProximas(req, deps) {
  exigirClave(req, deps);
  const desde = texto(req.desde), hasta = texto(req.hasta);
  if (!Array.isArray(req.filas) || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  // Se reemplaza solo el tramo que trae el proceso: así una corrida corta (hoy y mañana) no borra la semana.
  // Y la lista de quienes no reservaron solo se pisa en las sedes que vinieron en este envío.
  const sedesSin = req.filas.filter(f => texto(f.tipo) === 'sin_reserva').map(f => texto(f.sede));
  const quedan = deps.repo.leer('proximas').filter(f => {
    if (f.tipo === 'sin_reserva') return sedesSin.indexOf(texto(f.sede)) < 0;
    return !(texto(f.fecha) >= desde && texto(f.fecha) <= hasta);
  });
  req.filas.forEach(f => quedan.push({
    sede: texto(f.sede), tipo: texto(f.tipo), fecha: texto(f.fecha), hora: texto(f.hora),
    clase: texto(f.clase), profe: texto(f.profe), horario_id: texto(f.horario_id),
    cupo: String(f.cupo || 0), reservas: String(f.reservas || 0), nombres: texto(f.nombres), actualizado: ts,
  }));
  deps.repo.escribir('proximas', quedan);
  return { filas: req.filas.length };
}

function ocupacionVer(req, deps) {
  const { usuario } = sesion(req, deps);
  // Recepción ve la suya; quien coordina puede elegir. No es dato sensible de nadie: son cuántos lugares hay por hora.
  const coordina = tieneRol(usuario, 'admin') || tieneRol(usuario, 'coordinador');
  const sede = coordina ? sedePermitida(usuario, texto(req.sede)) : usuario.sede;
  const todas = deps.repo.leer('ocupacion');
  const filas = todas.filter(f => f.sede === sede);
  const hoy = deps.hoy();
  const dia = (new Date(hoy + 'T12:00:00Z').getUTCDay() + 6) % 7;   // 0 = lunes, como en el proceso de la PC
  // Lo que viene: de hoy para adelante, con los nombres de quienes reservaron cada clase (Emanuel, 10/11/2026).
  const prox = deps.repo.leer('proximas').filter(f => f.sede === sede);
  const franjas = prox.filter(f => f.tipo === 'franja' && texto(f.fecha) >= hoy)
    .sort((a, b) => String(a.fecha + a.hora + a.clase).localeCompare(String(b.fecha + b.hora + b.clase)));
  return {
    sede: sede, hoy: hoy, dia: dia,
    actualizado: filas.length ? filas[0].actualizado : '',
    patron: filas.filter(f => f.tipo === 'patron'),
    meses: filas.filter(f => f.tipo === 'mes'),
    recomendadas: recomendarFranjas(filas, dia, 3),
    proximas: franjas,
    sin_reserva: prox.filter(f => f.tipo === 'sin_reserva'),
    proximas_actualizado: prox.length ? prox[0].actualizado : '',
    sedes: tieneRol(usuario, 'admin') || tieneRol(usuario, 'coordinador') ? SEDES : [sede],
  };
}

function cargarRendimiento(req, deps) {
  exigirClave(req, deps);
  const mes = texto(req.mes);
  if (!/^\d{4}-\d{2}$/.test(mes) || !Array.isArray(req.filas)) falla('datos_invalidos');
  const dnis = req.filas.map(f => texto(f && f.dni));
  if (dnis.some(d => !d)) falla('datos_invalidos');
  const ts = new Date(deps.ahora()).toISOString();
  const filas = deps.repo.leer('rendimiento').filter(r => !(r.mes === mes && dnis.indexOf(r.dni) >= 0));
  req.filas.forEach(f => filas.push({ mes: mes, dni: texto(f.dni), datos: JSON.stringify(f.datos || {}), actualizado: ts }));
  deps.repo.escribir('rendimiento', filas);
  return { filas: req.filas.length };
}

// ---------- Administración ----------

const ROLES = ['recepcion', 'coordinador', 'admin', 'supervision', 'profe'];   // profe: también los kinesiólogos (Profes.js)

function exigirAdmin(req, deps) {
  const s = sesion(req, deps);
  if (!tieneRol(s.usuario, 'admin')) falla('prohibido');
  return s;
}

function nuevoPin(u, deps) {
  const pin = generarPin(deps.aleatorio);
  u.sal = deps.aleatorio(16);
  u.pin_hash = hashPin(pin, u.sal, deps.props.PIMIENTA, deps.sha256);
  u.debe_cambiar_pin = 'true';
  u.intentos = '0';
  u.bloqueado_hasta = '';
  return pin;
}

function usuariosCargar(req, deps) {
  exigirClave(req, deps);
  if (!Array.isArray(req.usuarios)) falla('datos_invalidos');
  const lista = req.usuarios.map(x => ({
    dni: normalizarDni(x && x.dni), nombre: texto(x && x.nombre), sede: texto(x && x.sede),
    turno: texto(x && x.turno), roles: rolesDe({ roles: x && x.roles }), hora_inicio: texto(x && x.hora_inicio), hora_fin: texto(x && x.hora_fin),
  }));
  const valido = x => x.dni && x.nombre && SEDES.indexOf(x.sede) >= 0 && TURNOS.indexOf(x.turno) >= 0 &&
    x.roles.length && x.roles.every(r => ROLES.indexOf(r) >= 0);
  if (!lista.every(valido)) falla('datos_invalidos');
  const usuarios = deps.repo.leer('usuarios');
  const pines = [];
  for (const x of lista) {
    let u = usuarios.find(v => v.dni === x.dni);
    if (!u) {
      u = { dni: x.dni, activo: 'true' };
      usuarios.push(u);
      pines.push({ dni: x.dni, pin: nuevoPin(u, deps) });
    }
    u.nombre = x.nombre;
    u.sede = x.sede;
    u.turno = x.turno;
    u.roles = x.roles.join(',');
    if (x.hora_inicio) u.hora_inicio = x.hora_inicio;
    if (x.hora_fin) u.hora_fin = x.hora_fin;
  }
  deps.repo.escribir('usuarios', usuarios);
  return { pines: pines };
}

function pinRegenerar(req, deps) {
  const { usuarios } = exigirAdmin(req, deps);
  const u = usuarios.find(v => v.dni === normalizarDni(req.dni));
  if (!u) falla('no_existe');
  const pin = nuevoPin(u, deps);
  deps.repo.escribir('usuarios', usuarios);
  return { pin: pin };
}

function usuariosListar(req, deps) {
  const { usuarios } = exigirAdmin(req, deps);
  const ahora = deps.ahora();
  return usuarios.map(u => ({
    dni: u.dni, nombre: u.nombre, sede: u.sede, turno: u.turno, roles: rolesDe(u),
    activo: esVerdad(u.activo), bloqueado: Number(u.bloqueado_hasta) > ahora,
  }));
}

function usuarioActivo(req, deps) {
  const { usuarios } = exigirAdmin(req, deps);
  const u = usuarios.find(v => v.dni === normalizarDni(req.dni));
  if (!u) falla('no_existe');
  u.activo = String(req.activo === true || esVerdad(req.activo));
  deps.repo.escribir('usuarios', usuarios);
  return {};
}

const ACCIONES = {
  login: login,
  cambiar_pin: cambiarPin,
  mis_tareas: misTareas,
  marcar: marcar,
  cargar_tareas: cargarTareas,
  reasignar_tareas: reasignarTareas,
  bajar_registro: bajarRegistro,
  usuarios_resumen: usuariosResumen,
  sede: vistaSede,
  reasignar: reasignar,
  tareas_de: tareasDe,
  registrar: registrar,
  mi_dia: miDia,
  cierre_guardar: cierreGuardar,
  cierres_ver: cierresVer,
  respaldo: respaldo,
  cargar_profes: cargarProfes,
  profes_ver: profesVer,
  cargar_fichajes: cargarFichajes,
  fichajes_ver: fichajesVer,
  fichaje_marcar: fichajeMarcar,
  reserva_marcar: reservaMarcar,
  aviso_visto: avisoVisto,
  reservas_bajar: reservasBajar,
  servidor_ver: servidorVer,
  rendimiento: vistaRendimiento,
  objetivos_guardar: objetivosGuardar,
  cargar_rendimiento: cargarRendimiento,
  cargar_ocupacion: cargarOcupacion,
  cargar_proximas: cargarProximas,
  ocupacion_ver: ocupacionVer,
  garantia_crear: garantiaCrear,
  garantia_decidir: garantiaDecidir,
  usuarios_cargar: usuariosCargar,
  pin_regenerar: pinRegenerar,
  usuarios_listar: usuariosListar,
  usuario_activo: usuarioActivo,
  uso: registrarUso,
  beneficio_crear: beneficioCrear,
  beneficio_decidir: beneficioDecidir,
  beneficios_borrar: beneficiosBorrar,
  cargar_beneficios: cargarBeneficios,
  cargar_ventas: cargarVentas,
  cargar_ventas_largas: cargarVentasLargas,
  venta_larga_pedir: ventaLargaPedir,
  venta_larga_responder: ventaLargaResponder,
  venta_larga_decidir: ventaLargaDecidir,
  // PulsoMOVE Profes (Profes.js). Se llaman al momento del pedido: así no importa en qué orden carga Apps Script los archivos
  cargar_profe_tareas: (r, d) => cargarProfeTareas(r, d),
  profe_tareas: (r, d) => profeTareas(r, d),
  profe_marcar: (r, d) => profeMarcar(r, d),
  cargar_profe_reeval: (r, d) => cargarProfeReeval(r, d),
  profe_pedir_reeval: (r, d) => profePedirReeval(r, d),
  cargar_profe_revision: (r, d) => cargarProfeRevision(r, d),
  profe_responder_revision: (r, d) => profeResponderRevision(r, d),
  profe_otra_situacion: (r, d) => profeOtraSituacion(r, d),
  profe_adelantar: (r, d) => profeAdelantar(r, d),
  profe_deshacer: (r, d) => profeDeshacer(r, d),
  profe_no_es_mio: (r, d) => profeNoEsMio(r, d),
  profe_plan_extra: (r, d) => profePlanExtra(r, d),
  cargar_profe_auditoria: (r, d) => cargarProfeAuditoria(r, d),
  profe_auditoria_marcar: (r, d) => profeAuditoriaMarcar(r, d),
  profe_auditoria_marcadas: (r, d) => profeAuditoriaMarcadas(r, d),
  cargar_profe_coordinacion: (r, d) => cargarProfeCoordinacion(r, d),
  cargar_profe_horarios: (r, d) => cargarProfeHorarios(r, d),
  // Chat del equipo (Chat.js)
  chat_personas: (r, d) => chatPersonas(r, d),
  chat_listar: (r, d) => chatListar(r, d),
  chat_novedad: (r, d) => chatNovedad(r, d),
  chat_ver: (r, d) => chatVer(r, d),
  chat_leido: (r, d) => chatLeido(r, d),
  chat_enviar: (r, d) => chatEnviar(r, d),
  chat_agregar: (r, d) => chatAgregar(r, d),
};

// Las pantallas que solo miran no esperan turno: un pedido trabado no las frena. Lista cerrada: lo que no esté acá espera.
// Respaldo, bajadas y lo que usan los procesos de la PC siguen con turno porque necesitan los datos completos y sin cambios a mitad.
const SOLO_LECTURA = ['mis_tareas', 'mi_dia', 'sede', 'tareas_de', 'rendimiento', 'cierres_ver', 'profes_ver', 'fichajes_ver', 'usuarios_listar', 'servidor_ver', 'ocupacion_ver', 'profe_tareas', 'chat_personas', 'chat_listar', 'chat_ver', 'chat_novedad'];
const ESPERA_TURNO_MS = 20000;
const PEDIDO_LENTO_MS = 15000;

function accionesDeLectura() {
  return SOLO_LECTURA;
}

// Atiende un pedido. `am` trae lo que depende de Google, para poder probarlo sin Google.
function atenderPedido(req, am) {
  const accion = req && typeof req.accion === 'string' ? req.accion.slice(0, 40) : '';
  const inicio = am.ahora();
  const anotarSiTardo = () => {
    const ms = am.ahora() - inicio;
    if (ms >= PEDIDO_LENTO_MS) am.anotar({ evento: 'lento', accion: accion, dueno: '', ms: ms });
  };
  if (SOLO_LECTURA.indexOf(accion) >= 0) {
    try {
      return manejar(req, am.deps());
    } catch (e) {
      return { ok: false, error: 'interno' };
    } finally {
      anotarSiTardo();
    }
  }
  if (!am.tomarTurno()) {
    am.anotar({ evento: 'ocupado', accion: accion, dueno: am.dueno(), ms: am.ahora() - inicio });
    return { ok: false, error: 'ocupado' };
  }
  try {
    am.marcarDueno(accion);
    const r = manejar(req, am.deps());
    am.guardar();
    return r;
  } catch (e) {
    return { ok: false, error: 'interno' };
  } finally {
    am.soltarTurno();
    anotarSiTardo();
  }
}

// Lo que el servidor anotó sobre demoras: quién tenía el turno cuando otro no pudo entrar.
function servidorVer(req, deps) {
  exigirClave(req, deps);
  return { filas: deps.repo.leer('servidor').slice(-50) };
}

function manejar(req, deps) {
  try {
    if (!req || typeof req !== 'object' || !Object.prototype.hasOwnProperty.call(ACCIONES, req.accion)) falla('datos_invalidos');
    return { ok: true, data: ACCIONES[req.accion](req, deps) };
  } catch (e) {
    if (e instanceof ErrorApi) return { ok: false, error: e.codigo };
    return { ok: false, error: 'interno' };
  }
}

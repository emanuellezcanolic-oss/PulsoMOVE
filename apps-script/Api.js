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
  c.dias_pendiente = t.estado === 'pendiente' ? diasHabiles(t.pendiente_desde, hoy) : 0;
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
  const personas = equipo.map(u => {
    const suyas = tareas.filter(t => t.asignado_dni === u.dni);
    const hechas = suyas.filter(t => t.estado === 'hecha').map(t => fechaArgentina(t.hecha_en));
    return {
      dni: u.dni, nombre: u.nombre, sede: u.sede, turno: u.turno,
      hechas_hoy: hechas.filter(f => f === hoy).length,
      pendientes: suyas.filter(t => t.estado === 'pendiente').length,
      hechas_semana: hechas.filter(f => f >= lunes && f <= hoy).length,
    };
  });
  const alertas = tareas.filter(t => t.estado === 'pendiente')
    .map(t => Object.assign(conDias(t, hoy), { asignado_nombre: nombre(t.asignado_dni) }))
    .filter(t => t.dias_pendiente >= DIAS_ALERTA)
    .sort((a, b) => b.dias_pendiente - a.dias_pendiente || ordenTareas(a, b));
  const garantias = deps.repo.leer('garantia').filter(g => g.sede === sede && g.estado === 'pendiente');
  return { hoy: hoy, sede: sede, personas: personas, alertas: alertas, garantias: garantias };
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
  return { nuevas: r.nuevas, actualizadas: r.actualizadas, cerradas: r.cerradas };
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
  return deps.repo.leer('usuarios').filter(u => esVerdad(u.activo))
    .map(u => ({ dni: u.dni, nombre: u.nombre, sede: u.sede, turno: u.turno, roles: u.roles }));
}

// ---------- Registro manual: lo que MOVE no ve ----------

const TIPOS_ACTIVIDAD = ['mensaje', 'consulta', 'prueba', 'resena', 'referido'];
const DIAS_SEGUIMIENTO = { alto: 0, medio: 2, exploratorio: 7 };   // MAN-REC-02: alto en el momento, medio a las 48 horas, exploratorio a la semana

function registrar(req, deps) {
  const { usuario } = sesion(req, deps);
  const id = texto(req.id), tipo = texto(req.tipo), nombre = texto(req.nombre), interes = texto(req.interes);
  if (!id || TIPOS_ACTIVIDAD.indexOf(tipo) < 0 || !nombre) falla('datos_invalidos');
  if (tipo === 'consulta' && !Object.prototype.hasOwnProperty.call(DIAS_SEGUIMIENTO, interes)) falla('datos_invalidos');
  if (deps.repo.leer('actividad').some(a => a.id === id)) return {};
  const hoy = deps.hoy();
  deps.repo.agregar('actividad', {
    id: id, ts: new Date(deps.ahora()).toISOString(), dni: usuario.dni, sede: usuario.sede, tipo: tipo, nombre: nombre,
    categoria: texto(req.categoria), canal: texto(req.canal), origen: texto(req.origen), interes: interes, detalle: texto(req.detalle),
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
  return fechaArgentina(iso).indexOf(mes) === 0;
}

// Lo que se mide en la app, en vivo. Lo que viene de MOVE (cajas, renovaciones) lo carga el pipeline cada mañana.
function valoresEnApp(dni, mes, tareas, registro, actividad, hoy) {
  const suyas = tareas.filter(t => t.asignado_dni === dni && t.estado !== 'cerrada' && !esRecordatorio(t.tipo) && String(t.pendiente_desde).indexOf(mes) === 0 && (t.estado === 'hecha' || String(t.fecha) <= hoy));
  const hechas = suyas.filter(t => t.estado === 'hecha');
  const aTiempo = hechas.filter(t => diasHabiles(t.pendiente_desde, fechaArgentina(t.hecha_en)) === 0);
  const marcas = registro.filter(r => r.dni === dni && delMes(r.ts, mes));
  const contactos = marcas.filter(r => r.canal !== 'SIN CONTACTO' && !/^(Profes de hoy|Apertura|Cierre|Coordinar|Evaluación sin cargar|Entrena en otra sede|Revisar plan)/.test(r.tipo));
  const CON_FECHA = ['RESERVA', 'VUELVE', 'PAGA', 'PAGÓ', 'VOLVIÓ', 'VACACIONES'];
  const reten = marcas.filter(r => !/^(Cumpleaños|Encuesta de baja|Revisar profesor|Seguimiento de consulta|Profes de hoy|Apertura|Cierre|Socio antiguo|Coordinar|Evaluación sin cargar|Entrena en otra sede|Revisar plan)/.test(r.tipo));
  const act = actividad.filter(a => a.dni === dni && delMes(a.ts, mes));
  const cuenta = t => act.filter(a => a.tipo === t).length;
  const encuestas = suyas.filter(t => String(t.tipo).indexOf('Encuesta de baja') === 0);
  const v = {
    mensajes: contactos.length + cuenta('mensaje'), consultas: cuenta('consulta'), dias_prueba: cuenta('prueba'), resenas: cuenta('resena'), referidos: cuenta('referido'),
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

// Cuándo trabajó las tareas: horas de cada día, tareas por hora del día y tiempo promedio con la tarea abierta
function tiemposDe(dni, mes, registro, horaFin) {
  const marcas = registro.filter(r => r.dni === dni && delMes(r.ts, mes));
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

function rachaDe(dni, tareas, hoy) {
  const dias = {};
  tareas.filter(t => t.asignado_dni === dni && t.estado === 'hecha').forEach(t => { dias[fechaArgentina(t.hecha_en)] = true; });
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
  const { usuario } = sesion(req, deps);
  const hoy = deps.hoy(), mes = hoy.slice(0, 7);
  const tareas = deps.repo.leer('tareas'), registro = deps.repo.leer('registro'), actividad = deps.repo.leer('actividad');
  const fila = deps.repo.leer('rendimiento').find(r => r.mes === mes && r.dni === usuario.dni);
  const valores = Object.assign({}, fila ? JSON.parse(fila.datos) : {}, valoresEnApp(usuario.dni, mes, tareas, registro, actividad, hoy));
  const propios = {};
  deps.repo.leer('objetivos').filter(o => o.dni === usuario.dni).forEach(o => { propios[o.clave] = Number(o.valor); });
  const suyas = tareas.filter(t => t.asignado_dni === usuario.dni && t.estado !== 'cerrada');
  const pendientes = suyas.filter(t => t.estado === 'pendiente' && String(t.fecha) <= hoy && !seVerificaEnMove(t.tipo) && !esRecordatorio(t.tipo)).map(t => conDias(t, hoy));
  const atrasadas = pendientes.filter(t => diasHabiles(t.pendiente_desde, hoy) >= 1).length;
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
    puente: delMesReg.filter(r => /^(Coordinar|Evaluación sin cargar|Revisar plan|Entrena en otra sede|Revisar profesor)/.test(r.tipo)).length,
    corregidos: delMesReg.filter(r => r.resultado === 'CORREGIDO').length,
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
    saludo: saludo(usuario.nombre, hora), puntos: calcularPuntos(valores), racha: racha,
    hoy: { hechas: deHoy.hechas, pendientes: pendientes.length, atrasadas: atrasadas, mensajes: deHoy.mensajes, consultas: deHoy.consultas },
    coach: mensajesCoach(valores, propios, { hoy: hoy, atrasadas: atrasadas, racha: racha }),
    hora_fin: usuario.hora_fin || '', cierre_hecho: deps.repo.leer('cierres').some(c => c.dni === usuario.dni && c.fecha === hoy),
  };
}

function valoresEnAppDia(dni, hoy, tareas, registro, actividad) {
  const esHoy = ts => fechaArgentina(ts) === hoy;
  return {
    hechas: tareas.filter(t => t.asignado_dni === dni && t.estado === 'hecha' && esHoy(t.hecha_en)).length,
    mensajes: registro.filter(r => r.dni === dni && esHoy(r.ts) && r.canal !== 'SIN CONTACTO' && !/^(Profes de hoy|Apertura|Cierre|Coordinar|Evaluación sin cargar|Entrena en otra sede|Revisar plan)/.test(r.tipo)).length
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

function profesVer(req, deps) {
  const { usuario } = sesion(req, deps);
  const sede = sedePermitida(usuario, texto(req.sede));
  return { filas: deps.repo.leer('profes').filter(f => f.sede === sede) };
}

function respaldo(req, deps) {
  exigirClave(req, deps);
  const usuarios = deps.repo.leer('usuarios').map(u => { const c = Object.assign({}, u); delete c.pin_hash; delete c.sal; return c; });
  const out = { usuarios: usuarios };
  ['tareas', 'registro', 'garantia', 'actividad', 'rendimiento', 'objetivos', 'cierres', 'profes'].forEach(h => { out[h] = deps.repo.leer(h); });
  return out;
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
  const calculado = deps.repo.leer('rendimiento').filter(r => r.mes === mes);
  const objetivos = deps.repo.leer('objetivos');
  let actualizado = '';
  const personas = equipo.map(u => {
    const fila = calculado.find(r => r.dni === u.dni);
    if (fila && fila.actualizado > actualizado) actualizado = fila.actualizado;
    const valores = Object.assign({}, fila ? JSON.parse(fila.datos) : {}, valoresEnApp(u.dni, mes, tareas, registro, actividad, deps.hoy()));
    if (valores.consultas && valores.nuevos != null) valores.conversion = Math.min(1, valores.nuevos / valores.consultas);   // hay nuevos que no pasaron por una consulta registrada
    const propios = {};
    objetivos.filter(o => o.dni === u.dni).forEach(o => { propios[o.clave] = Number(o.valor); });
    const puntaje = puntuar(valores, propios);
    const puntos = calcularPuntos(valores);
    if (!coordina) SOLO_COORDINACION.forEach(k => { delete valores[k]; });
    const out = { dni: u.dni, nombre: u.nombre, turno: u.turno, sede: u.sede, valores: valores, puntaje: puntaje, puntos: puntos, serie: serieTareas(u.dni, mes, tareas) };
    if (coordina) out.tiempos = tiemposDe(u.dni, mes, registro, u.hora_fin);
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

const ROLES = ['recepcion', 'coordinador', 'admin', 'supervision'];

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
  rendimiento: vistaRendimiento,
  objetivos_guardar: objetivosGuardar,
  cargar_rendimiento: cargarRendimiento,
  garantia_crear: garantiaCrear,
  garantia_decidir: garantiaDecidir,
  usuarios_cargar: usuariosCargar,
  pin_regenerar: pinRegenerar,
  usuarios_listar: usuariosListar,
  usuario_activo: usuarioActivo,
};

function manejar(req, deps) {
  try {
    if (!req || typeof req !== 'object' || !Object.prototype.hasOwnProperty.call(ACCIONES, req.accion)) falla('datos_invalidos');
    return { ok: true, data: ACCIONES[req.accion](req, deps) };
  } catch (e) {
    if (e instanceof ErrorApi) return { ok: false, error: e.codigo };
    return { ok: false, error: 'interno' };
  }
}

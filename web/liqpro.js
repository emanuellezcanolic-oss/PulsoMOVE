// PulsoMOVE · Liquidación de profes y kinesiología: cómo se ve y qué pasa al tocar (25/11/2026). El servidor está en apps-script/LiqProfes.js.
// app.js lo crea con lo que necesita y le pasa las acciones que empiezan con "lp-" y los formularios "lp-…".
// Cada profe o kinesiólogo ve solo lo suyo; coordinación ve a todos sin plata; admin ve y edita todo.
(function (raiz) {
  const SEDES = { bariloche: 'Bariloche', bolson: 'El Bolsón', puelo: 'Lago Puelo' };
  const ESTADOS = { en_curso: ['En curso', 'cerca'], cerrada: ['Cerrada el 5', 'bien'], liquidada: ['Liquidada', 'bien'] };
  const plata = n => (Number(n) < 0 ? '−' : '') + '$' + Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-AR');
  const num = n => (n == null || n === '' ? '—' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));
  const ddmm = f => (f ? String(f).slice(8, 10) + '/' + String(f).slice(5, 7) : '');
  const diaLocal = ts => { const d = new Date(ts); return isNaN(d) ? '' : String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };   // las marcas de hora vienen en UTC
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const mesCorto = m => MESES_CORTOS[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(2, 4);
  const GRUPOS = [['horas', 'Horas'], ['comision', 'Comisión por renovaciones'], ['sesiones', 'Sesiones de kinesiología'], ['extras', 'Extras'], ['descuentos', 'Descuentos']];

  function lista(txt) {
    return String(txt || '').split(/[,;\s]+/).filter(x => x !== '').map(Number);
  }

  function crear(c) {
    const { cliente, E, esc, aviso, falla, dialogo, tiene, recargar, nombreMes } = c;
    const L = { D: null, mes: '', dni: '', nuevaFila: '' };

    async function cargar() {
      const pedido = Object.assign({}, L.mes ? { mes: L.mes } : {});
      L.D = await cliente.llamar('liqpro_ver', pedido);
      L.mes = L.D.mes;
      if (L.D.personas.length === 1) L.dni = L.D.personas[0].dni;
      else if (L.dni && !L.D.personas.some(p => p.dni === L.dni)) L.dni = '';
    }

    const persona = () => (L.D ? L.D.personas.find(p => p.dni === L.dni) : null);

    function selectorMes(D) {
      return `<div class="filtros">${D.meses.slice(-12).map(m => `<button class="chip" data-accion="lp-mes" data-m="${m}" aria-pressed="${D.mes === m}">${esc(mesCorto(m))}</button>`).join('')}</div>`;
    }

    function cabecera(D) {
      const [txt, cls] = ESTADOS[D.estado] || ['', ''];
      return `<p class="bajada"><b>Período de ${esc(nombreMes(D.mes))}:</b> pagos del ${esc(ddmm(D.periodo.desde))} al ${esc(ddmm(D.periodo.hasta))}. <span class="sello ${cls}">${esc(txt)}</span>
        ${D.estado === 'en_curso' ? ' Todavía puede cambiar: se cierra el día 5.' : D.estado === 'cerrada' ? ' Ya no entran pagos nuevos; falta que coordinación la liquide.' : ' Lo liquidado queda como está aunque después se corrija algo.'}</p>`;
    }

    // ---------- Equipo (admin y coordinación) ----------
    function vistaEquipo(D) {
      const filas = D.personas.map(p => {
        const l = p.liquidacion;
        return `<tr><td><button class="enlace" data-accion="lp-persona" data-dni="${esc(p.dni)}"><b>${esc(p.nombre)}</b></button> <span class="profe">${p.tipo === 'kine' ? 'kine · ' : ''}${esc(SEDES[p.sede] || '')}</span></td>
          <td class="num">${num(l.cobran)}</td><td class="num">${num(l.activos)}</td><td>${esc(l.etiqueta || '—')}</td>
          ${D.ve_montos ? `<td class="num">${plata(l.subtotales.comision)}</td><td class="num"><b>${plata(l.total)}</b></td>` : ''}
          <td>${p.reclamos.some(r => r.estado === 'abierto') ? '<span class="sello lejos">reclamo</span>' : ''}${l.faltan && l.faltan.length ? '<span class="sello cerca">faltan datos</span>' : ''}</td></tr>`;
      }).join('');
      const total = D.ve_montos ? D.personas.reduce((a, p) => a + p.liquidacion.total, 0) : 0;
      return `${selectorMes(D)}${cabecera(D)}
        ${D.ve_montos ? '' : '<p class="aclara">Ves a todo el equipo con las cantidades y los niveles, sin plata: los montos son de administración y de cada persona.</p>'}
        <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Persona</th><th>Cobran</th><th>Activos</th><th>Nivel</th>${D.ve_montos ? '<th>Comisión</th><th>Total</th>' : ''}<th></th></tr></thead><tbody>${filas}</tbody>
        ${D.ve_montos ? `<tfoot><tr><td colspan="5"><b>Total del equipo</b></td><td class="num"><b>${plata(total)}</b></td><td></td></tr></tfoot>` : ''}</table></div>
        ${D.puede_editar ? botonesAdmin(D) + formConfig(D) : ''}`;
    }

    function botonesAdmin(D) {
      const abiertos = D.reclamos_abiertos ? `<span class="sello lejos">${D.reclamos_abiertos} ${D.reclamos_abiertos === 1 ? 'reclamo abierto' : 'reclamos abiertos'}</span>` : '';
      let b = '';
      if (D.estado === 'cerrada') b = `<button class="boton verde" data-accion="lp-liquidar">✅ Marcar ${esc(nombreMes(D.mes))} como liquidada</button>`;
      else if (D.estado === 'liquidada') b = '<button class="boton claro" data-accion="lp-reabrir">Reabrir el mes</button>';
      else b = '<span class="aclara">Se puede liquidar cuando el período cierre (después del día 5).</span>';
      return `<div class="fila-accion">${b} ${abiertos}</div>`;
    }

    // ---------- Configuración del mes (admin) ----------
    function formConfig(D) {
      const c = D.config;
      const v = (i) => (c.valores && c.valores[i] != null ? c.valores[i] : '');
      const tar = t => (c.tarifas && c.tarifas[t] != null ? c.tarifas[t] : '');
      const tipos = D.sesion_tipos;
      const campo = (n, t, val, ayuda) => `<label class="campo">${esc(t)}${ayuda ? ` <span class="opcional">${esc(ayuda)}</span>` : ''}<input name="${n}" inputmode="decimal" value="${esc(val)}"></label>`;
      return `<details class="catalogo"><summary>⚙️ Valores del mes: por nivel, tarifas de kinesiología y plantillas (solo administración)</summary>
        <form data-form="lp-config" data-mes="${esc(D.mes)}">
          <p class="aclara">Vale desde ${esc(nombreMes(D.mes))} y se mantiene en los meses siguientes hasta que cargues otro. ${c.desde ? 'Última carga: ' + esc(mesCorto(c.desde)) + '.' : '<b>Todavía no hay valores cargados:</b> la plata sale en cero hasta que los cargues.'}</p>
          <div class="liq-fila"><b>Valor por socio de cada nivel (para todos; cada persona puede tener los suyos)</b>${['No alcanzado', 'Objetivo 1', 'Objetivo 2', 'Máximo'].map((t, i) => campo('v' + i, t, v(i))).join('')}</div>
          <div class="liq-fila"><b>Tarifa de cada sesión de kinesiología (M = sesión Move)</b>${tipos.map((t, i) => campo('t' + i, t, tar(t))).join('')}</div>
          <div class="liq-fila"><b>Otros</b>${campo('plantilla', 'Valor de una plantilla', c.valor_plantilla == null ? '' : c.valor_plantilla)}${campo('sab', 'Horas por sábado', c.sabado_mult)}
            <label class="campo"><span><input type="checkbox" name="nuevos"${c.nuevos_en_activos ? ' checked' : ''}> Los socios nuevos suman a los activos</span><span class="opcional">no cambia lo que se paga: los nuevos son de recepción</span></label></div>
          <div class="botones"><button class="boton verde">Guardar valores</button></div>
        </form></details>`;
    }

    // ---------- Detalle de una persona ----------
    function lineasTabla(p, D) {
      const l = p.liquidacion;
      if (l.sin_montos) return '';
      let html = '';
      GRUPOS.forEach(([g, nombre]) => {
        const ls = l.lineas.filter(x => x.grupo === g);
        if (!ls.length) return;
        html += `<tr class="liq-grupo"><td colspan="3"><b>${esc(nombre)}</b></td></tr>` + ls.map(x => `<tr><td>${esc(x.t)}</td><td class="liq-como">${esc(x.como)}</td><td class="num">${plata(x.monto)}</td></tr>`).join('');
      });
      return `<div class="envoltura-tabla"><table class="tabla compacta liq-resumen"><thead><tr><th>Concepto</th><th>Cómo se calculó</th><th class="num">Monto</th></tr></thead><tbody>${html}
        <tr class="liq-total"><td colspan="2"><b>Total a cobrar</b></td><td class="num"><b>${plata(l.total)}</b></td></tr></tbody></table></div>`;
    }

    function bloqueComision(p) {
      const l = p.liquidacion;
      const tramos = l.metas ? `<div class="liq-metas">${l.metas.map((m, i) => `<div class="liq-meta${l.nivel === i ? ' actual' : ''}"><span>${esc(l.etiquetas[i])}</span><b>${i === 0 ? '< ' + num(l.metas[1]) : '≥ ' + num(m)}</b><i>${l.valores && !l.sin_montos ? plata(l.valores[i]) + ' c/u' : 'activos'}</i></div>`).join('')}</div>` : '';
      const mov = p.mov;
      return `<section class="bloque"><div class="bloque-cab"><h2>Socios que renovaron</h2><span class="sello ${l.nivel == null ? '' : 'bien'}">${esc(l.etiqueta || 'sin metas')}</span></div>
        <table class="tabla compacta"><tbody>
          <tr><td>Renovaciones</td><td class="num">${num(l.renovaciones)}</td></tr>
          <tr><td>Planes de 2 meses (X2), cuentan doble</td><td class="num">${num(l.x2)} × 2 = ${num(l.x2 * 2)}</td></tr>
          <tr><td>Liberados</td><td class="num">${num(l.liberados)}</td></tr>
          <tr class="liq-total"><td><b>Socios por los que cobrás</b></td><td class="num"><b>${num(l.cobran)}</b></td></tr>
          <tr><td class="profe">Socios nuevos del período: se liquidan a recepción, no a tu comisión${l.nuevos_en_activos ? ' (suman a tus activos para el nivel)' : ''}</td><td class="num profe">${num(l.nuevos)}</td></tr>
        </tbody></table>
        ${tramos}
        <p class="aclara">Activos del período: <b>${num(l.activos)}</b>.${l.nivel != null && l.faltan_siguiente ? ` Para el ${esc(l.etiquetas[l.nivel + 1])} faltan ${num(l.faltan_siguiente)}.` : l.nivel != null ? ' Alcanzaste el nivel máximo.' : ''}
        ${l.metas_fijas ? ' Tus metas son propias (las carga coordinación).' : l.metas ? ' Las metas salen de tus horas por semana (horas × 41 / 50 / 60 ÷ 30).' : ''}</p>
        ${mov ? `<p class="aclara">${mov.fuente === 'periodo' ? 'Datos de MOVE hasta el ' + esc(ddmm(mov.datos_hasta)) + '.' : '<b>Atención:</b> todavía no llegó el cálculo por pagos del período; se muestra el mes calendario de la comisión anterior (puede diferir un poco).'}${mov.parcial ? ' El período sigue abierto.' : ''}</p>`
          : '<p class="aclara alerta">Todavía no llegaron los datos de MOVE para este período.</p>'}
        ${mov && mov.avisos && mov.avisos.length ? `<p class="aclara">${mov.avisos.map(esc).join(' · ')}</p>` : ''}
        ${bloqueSinAsistencia(p)}
        ${mov && mov.lista && mov.lista.length ? `<details class="liq-dias"><summary>Ver los ${mov.lista.length} socios del período</summary><div class="envoltura-tabla"><table class="tabla compacta"><tbody>${mov.lista.map(x => `<tr><td>${esc(x.nombre)}</td><td>${esc(x.tipo === 'liberado' ? 'liberado' : x.tipo === 'x2' ? 'plan de 2 meses' : x.tipo === 'mes_plan' ? 'mes de un plan largo (entrenó)' : 'renovó')}${x.fecha ? ' · ' + esc(ddmm(x.fecha)) : ''}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
      </section>`;
    }

    // Planes de 3 meses o más: meses (del 2.º en adelante) sin asistencia registrada. Admin los puede marcar «sí entrenó».
    function bloqueSinAsistencia(p) {
      const lista = (p.mov && p.mov.sin_asistencia) || [];
      if (!lista.length) return '';
      const edita = L.D.puede_editar && L.D.estado !== 'liquidada';
      return `<div class="lp-sin"><p><b>Meses de planes largos sin asistencia registrada</b> <span class="profe">(solo se pagan si entrenó; el QR a veces falla)</span></p>${lista.map(x => {
        const u = x.historial[x.historial.length - 1];
        return `<div class="hecha-fila"><span>${esc(x.nombre)} · mes ${num(x.mes)} de ${num(x.de)} · <span class="sello ${x.marcado ? 'bien' : 'cerca'}">${x.marcado ? 'sí entrenó (marcado a mano)' : 'sin asistencia registrada'}</span>${u ? ` <span class="profe">${u.entreno ? 'marcado' : 'desmarcado'} por ${esc(u.por)} el ${esc(diaLocal(u.ts))}</span>` : ''}</span>
          ${edita ? `<button class="boton claro" data-accion="lp-entreno" data-dni="${esc(p.dni)}" data-clave="${esc(x.clave)}" data-v="${x.marcado ? '0' : '1'}">${x.marcado ? 'Deshacer' : 'Sí entrenó'}</button>` : ''}</div>`;
      }).join('')}</div>`;
    }

    function bloqueObjetivos(p) {
      const o = p.objetivos;
      if (!o) return '';
      const pts = v => (v == null ? '—' : num(v) + ' pts');
      const des = o.desercion;
      return `<section class="bloque"><div class="bloque-cab"><h2>Mis objetivos</h2><span class="sello bien">${num(o.total_puntos)} puntos</span></div>
        <p class="aclara">${esc(o.aclaracion)}</p>
        <table class="tabla compacta"><tbody>
          <tr><td>Socios activos: ${num(o.activos.valor)} ${o.activos.metas ? '(metas ' + o.activos.metas.slice(1).map(num).join(' / ') + ')' : ''}</td><td>${esc(o.activos.etiqueta || '—')}</td><td class="num">${pts(o.activos.puntos)}</td></tr>
          <tr><td>Deserción (promedio de los últimos 3 meses cerrados): ${des.promedio_3m == null ? 'sin dato' : num(des.promedio_3m) + '%'}<br><span class="profe">${des.promedio_3m == null ? esc(des.motivo) : esc(des.tramos)}</span></td><td>${des.promedio_3m == null ? '—' : num(des.bajas) + ' de ' + num(des.vencian)}</td><td class="num">${pts(des.puntos)}</td></tr>
          <tr><td>Tareas del mes${o.tareas.total ? ' (' + o.tareas.hechas + ' de ' + o.tareas.total + ')' : ''}</td><td>${o.tareas.pct == null ? '—' : num(o.tareas.pct) + '%'}</td><td class="num">${pts(o.tareas.puntos)}</td></tr>
          <tr><td>Reevaluaciones</td><td>${o.reeval.pct == null ? '—' : num(o.reeval.pct) + '%'}</td><td class="num">${pts(o.reeval.puntos)}</td></tr>
          <tr><td>Perfil del socio cargado</td><td>${o.perfil.pct == null ? '—' : num(o.perfil.pct) + '%'}</td><td class="num">${pts(o.perfil.puntos)}</td></tr>
        </tbody></table><p class="aclara">${esc(o.mensaje)}</p></section>`;
    }

    // ---------- Sesiones de kinesiología: calendario por paciente ----------
    function bloqueSesiones(p, D) {
      const S = p.sesiones;
      if (!S) return '';
      const edita = p.propio || D.puede_editar;
      const verMontos = !p.liquidacion.sin_montos;
      const pacientes = [];
      S.lista.forEach(s => { if (pacientes.indexOf(s.paciente) < 0) pacientes.push(s.paciente); });
      if (L.nuevaFila && pacientes.indexOf(L.nuevaFila) < 0) pacientes.push(L.nuevaFila);
      pacientes.sort();
      const celda = (pac, dia) => {
        const s = S.lista.find(x => x.paciente === pac && x.fecha === dia);
        const cls = s ? 'lp-sesion' + (s.estado === 'importada' ? ' lp-pendiente' : '') : 'lp-vacia';
        return `<td class="${cls}">${edita ? `<button class="lp-celda" data-accion="lp-celda" data-fecha="${esc(dia)}" data-pac="${esc(pac)}" ${s ? `data-id="${esc(s.id)}" data-tipo="${esc(s.tipo)}"` : ''} title="${esc(pac)} · ${esc(ddmm(dia))}">${s ? esc(s.tipo) : '+'}</button>` : s ? esc(s.tipo) : ''}</td>`;
      };
      const grilla = S.dias.length && pacientes.length ? `<div class="envoltura-tabla lp-calendario"><table class="tabla compacta"><thead><tr><th>Paciente</th>${S.dias.map(d => `<th class="num">${Number(d.slice(8))}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
        ${pacientes.map(pac => `<tr><th scope="row">${esc(pac)}</th>${S.dias.map(d => celda(pac, d)).join('')}<td class="num"><b>${S.lista.filter(x => x.paciente === pac).length}</b></td></tr>`).join('')}</tbody></table></div>`
        : '<div class="vacio">Todavía no hay sesiones cargadas este mes.</div>';
      const resumen = `<table class="tabla compacta"><thead><tr><th>Tipo de sesión</th><th class="num">Cantidad</th>${verMontos ? '<th class="num">Tarifa</th><th class="num">Importe</th>' : ''}</tr></thead><tbody>
        ${S.resumen.filter(r => r.n || verMontos && r.tarifa != null).map(r => `<tr><td>${esc(r.tipo)}</td><td class="num">${r.n}</td>${verMontos ? `<td class="num">${r.tarifa == null ? '<span class="profe">sin cargar</span>' : plata(r.tarifa)}</td><td class="num">${plata(r.monto)}</td>` : ''}</tr>`).join('')}
        <tr class="liq-total"><td><b>Total de sesiones</b></td><td class="num"><b>${S.resumen.reduce((a, r) => a + r.n, 0)}</b></td>${verMontos ? `<td></td><td class="num"><b>${plata(p.liquidacion.subtotales.sesiones)}</b></td>` : ''}</tr></tbody></table>`;
      const hoy = D.hoy && D.hoy.slice(0, 7) === D.mes ? D.hoy : D.mes + '-01';
      const alta = edita ? `<form data-form="lp-sesion" data-dni="${esc(p.dni)}" class="liq-fila">
        <label class="campo">Paciente<input name="paciente" list="lp-pacientes" maxlength="60" required autocomplete="off" placeholder="Nombre y apellido"></label>
        <datalist id="lp-pacientes">${S.pacientes.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <label class="campo">Día<input name="fecha" type="date" value="${esc(hoy)}" required></label>
        <label class="campo">Tipo<select name="tipo">${S.tipos.map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
        <button class="boton verde">Cargar sesión</button></form>` : '';
      const conf = edita && S.sin_confirmar ? `<div class="aviso-bloque"><p><b>${S.sin_confirmar}</b> ${S.sin_confirmar === 1 ? 'sesión viene' : 'sesiones vienen'} de la planilla vieja y falta que las confirmes (en amarillo).</p>
        <button class="boton claro" data-accion="lp-confirmar" data-dni="${esc(p.dni)}">✅ Confirmar las del mes</button></div>` : '';
      return `<section class="bloque"><div class="bloque-cab"><h2>Sesiones de ${esc(nombreMes(D.mes))}</h2><span class="sello">${S.lista.length} ${S.lista.length === 1 ? 'sesión' : 'sesiones'}</span></div>
        <p class="aclara">Un paciente por fila y un día por columna. Tocá una celda para cargar o corregir la sesión (SESIÓN 0, X1, X2, X3; «M» = sesión Move).</p>
        ${conf}${alta}${grilla}${edita && S.sin_confirmar === 0 ? '' : ''}${resumen}</section>`;
    }

    function bloqueReclamos(p, D) {
      if (!(p.propio || D.puede_editar)) return '';
      const rs = p.reclamos.map(r => `<div class="hecha-fila"><span><b>${esc(diaLocal(r.ts))}</b>${r.linea ? ' · ' + esc(r.linea) : ''}: ${esc(r.texto)}${r.respuesta ? `<br><i>Respuesta: ${esc(r.respuesta)}</i>` : ''}</span>
        ${D.puede_editar && r.estado === 'abierto' ? `<button class="boton claro" data-accion="lp-responder" data-id="${esc(r.id)}">Responder</button>` : `<span class="sello ${r.estado === 'abierto' ? 'cerca' : 'bien'}">${r.estado === 'abierto' ? 'abierto' : 'resuelto'}</span>`}</div>`).join('');
      const form = p.propio ? `<form data-form="lp-reclamo"><label class="campo">¿Algo no te cierra?<textarea name="texto" maxlength="400" required placeholder="Contanos qué línea o qué número y por qué"></textarea></label>
        <label class="campo">Sobre qué línea<select name="linea"><option value="">En general</option>${p.liquidacion.lineas.map(x => `<option value="${esc(x.t)}">${esc(x.t)}</option>`).join('')}</select></label>
        <div class="botones"><button class="boton claro">Enviar el reclamo</button></div></form>` : '';
      return `<section class="bloque"><div class="bloque-cab"><h2>Reclamos</h2></div>${rs || '<p class="aclara">No hay reclamos de este mes.</p>'}${form}</section>`;
    }

    // ---------- Edición de una persona (admin) ----------
    function formPersona(p, D) {
      const e = p.edicion;
      if (!e) return '';
      const campo = (n, t, val, ayuda) => `<label class="campo">${esc(t)}${ayuda ? ` <span class="opcional">${esc(ayuda)}</span>` : ''}<input name="${n}" inputmode="decimal" value="${esc(val == null ? '' : val)}"></label>`;
      const n = Math.max((e.extras || []).length + 1, 3);
      const slots = [];
      for (let i = 0; i < n; i++) {
        const x = (e.extras || [])[i] || { c: '', m: '' };
        slots.push(`<div class="liq-fila" data-lp-extra><label class="campo">Concepto<select><option value="">—</option>${D.sumas.concat(D.restas).map(t => `<option${x.c === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
          <label class="campo">Monto <span class="opcional">(los descuentos restan solos)</span><input inputmode="decimal" value="${esc(x.m)}"></label></div>`);
      }
      const sm = e.socios_manual || {};
      return `<details class="catalogo"><summary>✏️ Cargar y corregir lo de ${esc(p.nombre.split(' ')[0])} · ${esc(nombreMes(D.mes))}</summary>
        <form data-form="lp-persona" data-dni="${esc(p.dni)}" data-mes="${esc(D.mes)}">
          <p class="aclara">El valor hora, las horas, las metas y los valores se mantienen en los meses siguientes. HOME, sábados, extras y descuentos valen solo para este mes.${p.heredado_de ? ' Hoy se usan los de ' + esc(mesCorto(p.heredado_de)) + '.' : ''}</p>
          <div class="liq-fila"><label class="campo">Es<select name="tipo"><option value="profe"${e.tipo === 'kine' ? '' : ' selected'}>Profe</option><option value="kine"${e.tipo === 'kine' ? ' selected' : ''}>Kinesiología (suma sesiones y plantillas)</option></select></label>
            ${campo('valor_hora', 'Valor por hora', e.valor_hora)}${campo('horas_mes', 'Horas del mes', e.horas_mes)}${campo('horas_semana', 'Horas por semana', e.horas_semana, 'para las metas por horas')}${campo('monotributo', 'Monotributo', e.monotributo, 'si corresponde')}</div>
          <div class="liq-fila">${campo('home_horas', 'Horas extra HOME', e.home_horas)}${campo('sabados', 'Sábados trabajados', e.sabados, 'vacío = según la rotación')}${campo('plantillas', 'Plantillas', e.plantillas, 'kinesiología')}</div>
          <div class="liq-fila"><label class="campo">Objetivos propios: metas de socios <span class="opcional">(separadas por coma, por ejemplo 10, 15, 20, 30; vacío = metas por horas)</span><input name="metas" value="${esc((e.metas || []).join(', '))}"></label>
            <label class="campo">Valor por socio de cada nivel <span class="opcional">(uno por meta; vacío = los del mes)</span><input name="valores" value="${esc((e.valores || []).join(', '))}"></label></div>
          <div class="liq-fila"><b>Socios a mano (solo si MOVE no los tiene, por ejemplo RF de kinesiología)</b>${campo('sm_activos', 'Activos', sm.activos)}${campo('sm_cobran', 'Cobran', sm.cobran)}${campo('comision_manual', 'Comisión a mano', e.comision_manual, 'pisa la regla')}</div>
          <div class="liq-fila"><b>Extras y descuentos</b></div>${slots.join('')}
          <label class="campo">Nota<input name="nota" maxlength="300" value="${esc(e.nota)}"></label>
          <div class="botones"><button class="boton verde">Guardar</button></div>
        </form></details>`;
    }

    function detalle(p, D) {
      const l = p.liquidacion;
      return `${D.personas.length > 1 ? '<div class="filtros"><button class="chip" data-accion="lp-volver">← Volver al equipo</button></div>' : ''}${selectorMes(D)}
        <h1 class="titulo">${esc(p.nombre)} <span>·</span> ${esc(nombreMes(D.mes))}</h1>${cabecera(D)}
        ${p.congelada ? `<p class="aclara">Esta liquidación quedó cerrada el ${esc(diaLocal(D.liquidada_ts))}.${p.total_vivo != null ? ` <b>Hoy el cálculo daría ${plata(p.total_vivo)}</b>: reabrí el mes si hay que corregir.` : ''}</p>` : ''}
        ${l.faltan && l.faltan.length && D.puede_editar ? `<p class="aclara alerta">Falta cargar: ${l.faltan.map(esc).join(', ')}.</p>` : ''}
        ${l.sin_montos ? '' : `<section class="bloque"><div class="bloque-cab"><h2>${p.propio ? 'Mi liquidación' : 'Liquidación'}</h2><span class="sello bien">${plata(l.total)}</span></div>
          <p class="aclara">Cada línea muestra la cuenta que se hizo. Si algo no te cierra, avisá abajo con «Enviar el reclamo».</p>${lineasTabla(p, D)}</section>`}
        ${bloqueComision(p)}${bloqueSesiones(p, D)}${bloqueObjetivos(p)}${bloqueReclamos(p, D)}${D.puede_editar ? formPersona(p, D) : ''}`;
    }

    function vista() {
      const D = L.D;
      if (!D) return '<div class="cargando">Calculando…</div>';
      const p = persona();
      const titulo = D.personas.length > 1 ? `<h1 class="titulo">Liquidación <span>·</span> profes y kinesiología</h1>` : '';
      if (p) return `<div class="liqpro">${detalle(p, D)}</div>`;
      return `<div class="liqpro">${titulo}${vistaEquipo(D)}</div>`;
    }

    // ---------- Acciones ----------
    function dialogoCelda(el) {
      const id = el.dataset.id || '', pac = el.dataset.pac, fecha = el.dataset.fecha, p = persona();
      const tipos = L.D.sesion_tipos;
      const d = dialogo(`<h3>${esc(pac)}</h3><p class="bajada" style="margin:0">${esc(ddmm(fecha))}</p>
        <form><label class="campo">Sesión<select name="tipo">${tipos.map(t => `<option${t === el.dataset.tipo ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <div class="botones"><button class="boton verde">Guardar</button>${id ? '<button type="button" class="boton claro" data-quitar>Quitar</button>' : ''}<button type="button" class="boton claro" data-cerrar>Cancelar</button></div></form>`);
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      const q = d.querySelector('[data-quitar]');
      if (q) q.onclick = async () => { try { await cliente.llamar('liqpro_sesion_borrar', { id: id }); d.close(); await refrescar(); } catch (e) { falla(e); } };
      d.querySelector('form').onsubmit = async ev => {
        ev.preventDefault();
        try { await cliente.llamar('liqpro_sesion_guardar', { kine_dni: p.dni, fecha: fecha, paciente: pac, tipo: ev.target.tipo.value }); d.close(); await refrescar(); } catch (e) { falla(e); }
      };
    }

    function dialogoResponder(id) {
      const d = dialogo(`<h3>Responder el reclamo</h3><form><label class="campo">Respuesta<textarea name="r" maxlength="400" required></textarea></label>
        <div class="botones"><button class="boton verde">Marcar resuelto</button><button type="button" class="boton claro" data-cerrar>Cancelar</button></div></form>`);
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      d.querySelector('form').onsubmit = async ev => {
        ev.preventDefault();
        try { await cliente.llamar('liqpro_reclamo_resolver', { id: id, respuesta: ev.target.r.value }); d.close(); await refrescar(); aviso('Reclamo resuelto.'); } catch (e) { falla(e); }
      };
    }

    async function refrescar() {
      await cargar();
      if (recargar) recargar(true);
    }

    async function accion(a, el) {
      try {
        if (a === 'lp-mes') { L.mes = el.dataset.m; await refrescar(); }
        else if (a === 'lp-persona') { L.dni = el.dataset.dni; if (recargar) recargar(true); }
        else if (a === 'lp-volver') { L.dni = ''; if (recargar) recargar(true); }
        else if (a === 'lp-celda') dialogoCelda(el);
        else if (a === 'lp-confirmar') { const r = await cliente.llamar('liqpro_sesiones_confirmar', { kine_dni: el.dataset.dni, mes: L.D.mes }); await refrescar(); aviso(`Confirmaste ${r.confirmadas} ${r.confirmadas === 1 ? 'sesión' : 'sesiones'}.`); }
        else if (a === 'lp-responder') dialogoResponder(el.dataset.id);
        else if (a === 'lp-entreno') { el.disabled = true; await cliente.llamar('liqpro_entreno', { dni: el.dataset.dni, mes: L.D.mes, clave: el.dataset.clave, entreno: el.dataset.v === '1' }); await refrescar(); }
        else if (a === 'lp-liquidar') {
          if (!window.confirm('Se congelan las cuentas de ' + nombreMes(L.D.mes) + ' de todo el equipo. ¿Liquidar?')) return;
          await cliente.llamar('liqpro_liquidar', { mes: L.D.mes }); await refrescar(); aviso('Mes liquidado.');
        } else if (a === 'lp-reabrir') { await cliente.llamar('liqpro_liquidar', { mes: L.D.mes, reabrir: true }); await refrescar(); aviso('Mes reabierto.'); }
      } catch (e) { falla(e); }
    }

    async function enviar(tipo, form, btn) {
      const f = new FormData(form);
      const v = n => String(f.get(n) == null ? '' : f.get(n)).trim();
      if (btn) btn.disabled = true;
      try {
        if (tipo === 'lp-sesion') {
          await cliente.llamar('liqpro_sesion_guardar', { kine_dni: form.dataset.dni, fecha: v('fecha'), paciente: v('paciente'), tipo: v('tipo') });
          L.nuevaFila = '';
          await refrescar(); aviso('Sesión cargada.');
        } else if (tipo === 'lp-reclamo') {
          await cliente.llamar('liqpro_reclamo', { mes: L.D.mes, linea: v('linea'), texto: v('texto') });
          await refrescar(); aviso('Reclamo enviado. Coordinación lo va a revisar.');
        } else if (tipo === 'lp-config') {
          const tarifas = {};
          L.D.sesion_tipos.forEach((t, i) => { if (v('t' + i) !== '') tarifas[t] = Number(v('t' + i)); });
          const vals = [0, 1, 2, 3].map(i => v('v' + i));
          await cliente.llamar('liqpro_config_guardar', { mes: form.dataset.mes, valores: vals.every(x => x === '') ? [] : vals.map(Number), tarifas: tarifas,
            valor_plantilla: v('plantilla'), sabado_mult: v('sab'), nuevos_en_activos: f.get('nuevos') === 'on' });
          await refrescar(); aviso('Valores guardados.');
        } else if (tipo === 'lp-persona') {
          const extras = [...form.querySelectorAll('[data-lp-extra]')].map(x => ({ c: x.querySelector('select').value, m: x.querySelector('input').value })).filter(x => x.c && x.m !== '').map(x => ({ c: x.c, m: Number(x.m) }));
          const metas = lista(v('metas')), valores = lista(v('valores'));
          const sm = v('sm_activos') !== '' || v('sm_cobran') !== '' ? { activos: v('sm_activos'), cobran: v('sm_cobran') } : null;
          await cliente.llamar('liqpro_persona_guardar', { dni: form.dataset.dni, mes: form.dataset.mes, datos: {
            tipo: v('tipo'), valor_hora: v('valor_hora'), horas_mes: v('horas_mes'), horas_semana: v('horas_semana'), monotributo: v('monotributo'), home_horas: v('home_horas'),
            sabados: v('sabados'), plantillas: v('plantillas'), metas: metas.length ? metas : null, valores: valores.length ? valores : null, comision_manual: v('comision_manual'),
            socios_manual: sm, extras: extras, nota: v('nota') } });
          await refrescar(); aviso('Guardado.');
        }
      } catch (e) { if (btn) btn.disabled = false; falla(e); }
    }

    return { cargar, vista, accion, enviar, cargado: () => !!L.D, estado: L };
  }

  raiz.PulsoLiqPro = { crear: crear, lista: lista, plata: plata };
})(typeof window !== 'undefined' ? window : globalThis);

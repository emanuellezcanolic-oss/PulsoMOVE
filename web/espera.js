// PulsoMOVE · Lista de espera: cómo se ve y qué pasa al tocar (Emanuel, 24/11/2026). Lo que calcula el servidor está en apps-script/ListaEspera.js.
// app.js lo crea con lo que necesita (cliente, estado E, esc, aviso, falla, render, dialogo) y le pasa las acciones que empiezan con "esp-".
(function (raiz) {
  const SEDES = { bariloche: 'Bariloche', bolson: 'El Bolsón', puelo: 'Lago Puelo' };
  const FRANJA = { manana: 'Mañana', tarde: 'Tarde' };
  const ESTADO_CLASE = { nuevo: 'gris', esperando: 'verde', contactado: 'amarillo', reconfirmo: 'verde', evaluacion_agendada: 'verde', pausa: 'gris', descartado: 'rojo', ingreso: 'verde', cerrado_amable: 'gris' };
  const TIPO_TAREA = { revisar: ['↩️', 'Revisar: lo marcado no coincide'], oferta_vencida: ['⏰', 'Pasó la ventana: ofrecerle el lugar al siguiente'], primer_contacto: ['👋', 'Primer contacto'], reconfirmacion: ['🔁', '¿Sigue en la lista?'],
    seguimiento: ['💬', 'Seguimiento'], cierre: ['🤝', 'Cierre amable'], avance: ['📈', 'Subió en la fila'], beneficio: ['🎁', 'Un detalle mientras espera'] };
  const RESULTADOS = [['respondio_si', '✅ Respondió que sí', 'verde'], ['respondio_no', '👋 Respondió que no', 'claro'], ['sin_respuesta', '⏳ Sin respuesta', 'claro'], ['pidio_baja', '🚫 Pidió la baja de la lista', 'claro']];
  const dmy = iso => (iso ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) : '');
  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

  function crear(c) {
    const { cliente, E, esc, aviso, falla, render, dialogo, tiene } = c;
    E.esp = null; E.espHoy = null; E.espSede = ''; E.espEstado = 'fila'; E.espFranja = ''; E.espBusca = ''; E.espMetricas = null;
    const coord = () => tiene('coordinador') || tiene('admin');
    const nombreSede = (clave) => ((E.esp && E.esp.sedes.find(s => s.clave === clave)) || {}).nombre || SEDES[clave] || clave;

    async function copiar(texto) {
      try { await navigator.clipboard.writeText(texto); aviso('📋 Mensaje copiado.'); return; } catch (e) { /* sigue */ }
      const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); aviso('📋 Mensaje copiado.'); } catch (e) { aviso('No se pudo copiar: seleccionalo y copialo a mano.', true); }
      t.remove();
    }
    const waUrl = (celular, texto) => 'https://wa.me/' + celular + '?text=' + encodeURIComponent(texto);

    // ---------- Datos ----------
    async function cargar() {
      E.esp = await cliente.llamar('espera_ver', {});
      if (!E.espSede || !E.esp.sedes.some(s => s.clave === E.espSede) && E.espSede !== 'metricas') E.espSede = E.esp.mi_sede && E.esp.sedes.some(s => s.clave === E.esp.mi_sede) ? E.esp.mi_sede : (E.esp.sedes[0] || {}).clave;
    }
    async function cargarHoy(alCambiar) {
      try {
        const r = await cliente.llamar('espera_hoy', {});
        const igual = E.espHoy && JSON.stringify(E.espHoy) === JSON.stringify(r);
        E.espHoy = r;
        if (!igual && alCambiar) alCambiar();
      } catch (e) { /* la banda no aparece y listo */ }
    }

    // ---------- Piezas ----------
    const chipEstado = (e) => `<span class="esp-estado esp-${ESTADO_CLASE[e] || 'gris'}">${esc((E.esp && E.esp.estados[e]) || e)}</span>`;
    const chipPrio = (p) => `<span class="esp-prio esp-p${p}" title="${p === 1 ? 'Viene de otro servicio activo (Kine, RF o RH)' : p === 2 ? 'Ex entrenado' : 'Nuevo'}">P${p}</span>`;
    function lugarTexto(p) {
      if (!p.lugares.length) return p.vigente ? '' : '<span class="esp-aviso-chip" title="Hace más de 90 días que no confirma: no cuenta para el lugar hasta que responda">sin reconfirmar</span>';
      return p.lugares.map(l => `<span class="esp-lugar" title="Lugar ${l.lugar} de ${l.total} en ${FRANJA[l.franja] || l.franja}">${esc(FRANJA[l.franja] || l.franja)} · lugar ${l.lugar}/${l.total}</span>`).join(' ');
    }

    // Mensaje listo para copiar: editable, con botón de WhatsApp y copiar
    function cajaMensaje(m, celular, id) {
      const faltan = m.faltan && m.faltan.length ? `<p class="aclara esp-faltan">Completá antes de mandarlo: ${m.faltan.map(f => '<b>{' + esc(f) + '}</b>').join(', ')}.</p>` : '';
      return `<div class="esp-mensaje" data-msg="${esc(id)}"><textarea rows="5" aria-label="Mensaje listo para mandar" data-texto>${esc(m.texto)}</textarea>${faltan}
        <div class="botones"><button type="button" class="boton claro" data-accion="esp-copiar" data-msg="${esc(id)}">📋 Copiar</button>
        <button type="button" class="boton verde" data-accion="esp-wa" data-msg="${esc(id)}" data-celular="${esc(celular)}" ${celular ? '' : 'disabled'}>💬 Abrir en WhatsApp</button></div></div>`;
    }
    const textoDe = (el) => { const caja = el.closest('[data-msg]') || el; const t = caja.querySelector('[data-texto]'); return t ? t.value : ''; };

    // ---------- Banda de «Mis tareas»: Lista de espera de hoy ----------
    function tarjetaTarea(t, i) {
      const [ico, nombre] = TIPO_TAREA[t.tipo] || ['•', t.tipo];
      const id = 'tt-' + t.persona_id;
      const consent = t.sin_consentimiento ? '<p class="aclara">No hay registro de que haya aceptado que le escribamos por WhatsApp: el mensaje se lo pide y trae el aviso de baja. Si responde «sí», queda anotado.</p>' : '';
      const sigs = t.candidatos ? `<div class="esp-candidatos"><b>Siguientes de la lista:</b>${t.candidatos.map(k => candidatoHtml(k, t.franja)).join('') || '<p class="aclara">No quedan candidatos para esa franja. Mirá la gente en pausa.</p>'}</div>` : '';
      const botones = t.tipo === 'oferta_vencida'
        ? `<div class="botones"><button class="boton claro" data-accion="esp-oferta-siguiente" data-oferta="${esc(t.oferta_id)}" data-id="${esc(t.persona_id)}" data-msg="${esc(id)}">Ya le avisé que pasó al siguiente</button></div>`
        : `<div class="esp-resultados"><span class="aclara">Cuando se lo mandes, ¿qué pasó?</span><div class="botones">${RESULTADOS.map(r => `<button class="boton ${r[2]}" data-accion="esp-resultado" data-id="${esc(t.persona_id)}" data-r="${r[0]}" data-tipo="${esc(t.tipo)}" data-clave="${esc(t.mensaje.clave)}" data-msg="${esc(id)}">${r[1]}</button>`).join('')}</div>
          <label class="campo esp-prox">Próximo contacto <span class="opcional">(opcional)</span><input type="date" data-prox></label></div>`;
      return `<article class="tarjeta esp-tarea" style="--i:${i}"><div class="cabeza" style="display:grid;gap:3px;padding:12px 14px">
        <span class="socio">${chipPrio(t.prioridad)} ${esc(t.nombre)}</span><span class="situacion"><b>${ico} ${esc(nombre)}</b> · ${esc(t.motivo)}${t.lugar ? ` · hoy en el lugar ${t.lugar}` : ''}</span>
        ${t.dias_en_lista != null ? `<span class="profe">${plural(t.dias_en_lista, 'día', 'días')} en lista</span>` : ''}</div>
        <div class="esp-cuerpo">${consent}${t.beneficio ? `<p class="aclara">Beneficio sugerido: <b>${esc(t.beneficio.titulo)}</b>. Al marcar el resultado queda registrado como ofrecido.</p>` : ''}
        ${cajaMensaje(t.mensaje, t.celular || '', id)}${sigs}${botones}</div></article>`;
    }

    const VERIF = { pendiente: ['✔', 'hecha · mañana se comprueba'], comprobada: ['✔✔', 'hecha y comprobada'], sin_comprobar: ['✔', 'hecha, sin comprobar'], reabierta: ['↩️', 'reabierta'], atendida: ['✔', 'hecha'] };
    const RES_TXT = { respondio_si: 'respondió que sí', respondio_no: 'respondió que no', sin_respuesta: 'sin respuesta', pidio_baja: 'pidió la baja' };

    function bandaHoy() {
      const H = E.espHoy;
      if (!H || !(tiene('recepcion'))) return '';
      const pend = H.pendientes_total || 0;
      const resumen = `Hechas hoy: <b>${H.hechas_yo}</b> de ${H.topes.turno} tuyas · <b>${H.hechas_sede}</b> de ${H.topes.sede} de la sede`;
      const R = H.reparto || {};
      const reparto = R.habil === false ? 'Hoy no es día hábil: no se asignan contactos y lo pendiente pasa al próximo día hábil, sin penalización.'
        : `Se reparten parejo en el mes: hoy te tocan hasta ${R.tope_dia} (${plural(R.pendientes, 'pendiente', 'pendientes')} entre ${plural(R.dias_habiles, 'día hábil', 'días hábiles')}). Lo que no llegues a hacer pasa a mañana, sin penalización.`;
      const hechas = (H.hechas_hoy || []).length ? `<div class="esp-hechas"><b>Hechas hoy</b><ul>${H.hechas_hoy.map(x => { const v = VERIF[x.verif] || VERIF.pendiente; return `<li><span class="esp-check" title="${esc(v[1])}">${v[0]}</span> ${esc(x.nombre)} · ${esc(RES_TXT[x.resultado] || x.resultado)} <small>${esc(v[1])}</small></li>`; }).join('')}</ul>
        <p class="aclara">Se ven como hechas al instante. Mañana la app comprueba lo que pueda (por ejemplo, si hay una respuesta registrada); lo que no se pueda comprobar queda como «hecha, sin comprobar» y no te baja nada.${H.sin_comprobar ? ` Días anteriores sin comprobar: ${H.sin_comprobar}.` : ''}</p></div>` : '';
      if (!H.tareas.length && !pend) return `<section class="grupo esp-banda"><h2>⏳ Lista de espera de hoy <span class="cuenta">al día</span></h2><p class="intro-grupo">${resumen}. No hay nada pendiente con la lista de espera. Si alguien se anota en el mostrador, usá «Agregar a la lista».</p>${hechas}</section>`;
      const sobran = pend - H.tareas.length;
      return `<section class="grupo esp-banda"><h2>⏳ Lista de espera de hoy <span class="cuenta">${H.tareas.length}</span></h2>
        <p class="intro-grupo">Va después del checklist de apertura. ${resumen}. Una acción por persona y un mensaje por semana: nada se manda solo, vos lo copiás y lo mandás. ${reparto}${sobran > 0 && R.habil !== false ? ` Quedan ${sobran} para los próximos días.` : ''}</p>
        ${H.tareas.length ? H.tareas.map(tarjetaTarea).join('') : '<p class="aclara">Por hoy no hay más para hacer.</p>'}
        ${hechas}
        <div class="fila-accion"><button class="boton claro" data-accion="esp-alta">➕ Agregar a la lista</button><button class="boton claro" data-accion="esp-vista">Ver toda la lista</button></div></section>`;
    }

    // ---------- Candidatos (baja de un socio / oferta vencida) ----------
    function candidatoHtml(k, franja) {
      return `<div class="esp-cand"><div><b>${chipPrio(k.prioridad)} ${esc(k.nombre)}</b><span class="aclara">${esc(k.motivo)}</span></div>
        <div class="botones"><button class="boton verde" data-accion="esp-ofrecer" data-celular="${esc(k.celular || '')}" data-id="${esc(k.persona_id)}" data-franja="${esc(franja)}">Ofrecer lugar</button>
        <button class="boton claro" data-accion="esp-ingreso" data-id="${esc(k.persona_id)}">Ingresó</button></div></div>`;
    }

    async function dialogoBaja(opciones) {
      const o = opciones || {};
      const d = dialogo(`<h3>🧲 Te recomendamos ingresar a:</h3>
        <p class="aclara esp-alerta">Cupo sin verificar: la app no sabe cuántos lugares hay. Confirmalo en MOVE antes de ofrecer.${o.nombre ? ` Baja de ${esc(o.nombre)}.` : ''}</p>
        <label class="campo">Horario que se liberó<select data-franja><option value="">Que lo sugiera la app${o.socio_id ? ' (por los hábitos del socio)' : ''}</option><option value="manana">Mañana</option><option value="tarde">Tarde</option></select></label>
        <div data-candidatos><div class="cargando">Buscando en la lista…</div></div>
        <div class="botones"><button type="button" class="boton claro" data-cerrar>Cerrar</button></div>`);
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      const sel = d.querySelector('[data-franja]');
      async function buscar() {
        const caja = d.querySelector('[data-candidatos]');
        try {
          const r = await cliente.llamar('espera_candidatos', { franja: sel.value, socio_id: o.socio_id || '' });
          caja.innerHTML = r.grupos.map(g => `<section class="esp-grupo"><h4>${esc(FRANJA[g.franja] || g.franja)}</h4>
            ${g.candidatos.length ? g.candidatos.map(k => candidatoHtml(k, g.franja)).join('') : '<p class="aclara">No hay nadie en la lista para esa franja.</p>'}</section>`).join('') +
            `<p class="aclara">Se ofrece de a uno. Si no responde en ${r.ventana_horas} h, el lugar pasa al siguiente (supuesto a confirmar). Orden: prioridad 1, 2, 3 y dentro de cada una, antigüedad, con los pases de prioridad aplicados.</p>`;
        } catch (e) { caja.innerHTML = '<p class="aclara">No pudimos buscar. Cerrá y probá de nuevo.</p>'; falla(e); }
      }
      sel.onchange = buscar;
      d.addEventListener('click', async ev => {
        const b = ev.target.closest('[data-accion]');
        if (!b || !d.contains(b)) return;
        ev.stopPropagation();
        await accion(b.dataset.accion, b, d, buscar);
      });
      buscar();
      return d;
    }

    function dialogoMensaje(titulo, m, celular, extra) {
      const d = dialogo(`<h3>${esc(titulo)}</h3>${extra || ''}${cajaMensaje(m, celular, 'dlg')}<div class="botones"><button type="button" class="boton claro" data-cerrar>Cerrar</button></div>`);
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      d.addEventListener('click', ev => { const b = ev.target.closest('[data-accion]'); if (b && d.contains(b)) { ev.stopPropagation(); if (b.dataset.accion === 'esp-copiar') copiar(textoDe(b)); if (b.dataset.accion === 'esp-wa') window.open(waUrl(b.dataset.celular, textoDe(b)), '_blank', 'noopener'); } });
      return d;
    }

    // ---------- Alta ----------
    function dialogoAlta() {
      const sedes = coord() ? E.esp.sedes : [];
      const d = dialogo(`<h3>➕ Agregar a la lista</h3>
        <form class="marca-form" style="border:0;padding:0">
          ${coord() ? `<label class="campo">Sede de la lista<select name="sede">${sedes.map(s => `<option value="${esc(s.clave)}"${s.clave === E.espSede ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></label>` : ''}
          <label class="campo">Nombre y apellido<input name="nombre" maxlength="80" required></label>
          <label class="campo">Celular (con código de área)<input name="celular" inputmode="tel" placeholder="2944 123456" required></label>
          <label class="campo">Horario de interés<input name="horario" maxlength="120" placeholder="Ej.: 8 a 10, o a la tarde"></label>
          <label class="campo">Prioridad<select name="prioridad"><option value="3">3 · Nuevo</option><option value="2">2 · Ex entrenado</option><option value="1">1 · Viene de otro servicio (Kine, RF, RH)</option></select></label>
          <label class="campo">Quién lo trajo <span class="opcional">(opcional)</span><input name="referido_por" maxlength="80" placeholder="Nombre de quien lo recomendó"></label>
          <label class="campo">Sede donde quiere entrenar<input name="sede_interes" maxlength="40" placeholder="Si es otra sede o una nueva"></label>
          <label class="campo">Observaciones <span class="opcional">(opcional)</span><textarea name="observaciones" maxlength="300"></textarea></label>
          <label class="visto"><input type="checkbox" name="consentimiento"> Aceptó que le escribamos por WhatsApp sobre la lista</label>
          <div class="botones"><button class="boton verde">Agregar a la lista</button><button type="button" class="boton claro" data-cerrar>Cancelar</button></div>
        </form>`);
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      const form = d.querySelector('form');
      form.onsubmit = async ev => {
        ev.preventDefault();
        const btn = form.querySelector('button.verde'); btn.disabled = true;
        const f = new FormData(form);
        try {
          const r = await cliente.llamar('espera_alta', { sede: f.get('sede') || '', nombre: f.get('nombre'), celular: f.get('celular'), horario: f.get('horario'), prioridad: Number(f.get('prioridad')),
            referido_por: f.get('referido_por'), sede_interes: f.get('sede_interes') || '', observaciones: f.get('observaciones'), consentimiento: !!f.get('consentimiento') });
          d.close();
          if (r.duplicado) { aviso('Ese celular ya está en la lista: ' + r.duplicado.nombre + '.', true); return; }
          await recargar();
          dialogoMensaje('✅ Anotado: ' + r.persona.nombre, r.mensaje, r.persona.celular, `<p class="aclara">${r.persona.lugar ? 'Queda en el lugar ' + r.persona.lugar + '. ' : ''}Si querés avisarle ahora, el mensaje está listo.</p>`);
        } catch (e) { btn.disabled = false; falla(e); }
      };
    }

    // ---------- Ficha ----------
    async function dialogoFicha(id) {
      const p = E.esp.personas.find(x => x.id === id);
      if (!p) return;
      let hist = [], benef = [];
      try { hist = (await cliente.llamar('espera_historial', { id })).historial; benef = (await cliente.llamar('espera_beneficios_de', { id })).beneficios; } catch (e) { /* se ve sin historial */ }
      const estados = Object.keys(E.esp.estados);
      const pases = p.pases.length ? `<p class="aclara">Pases de prioridad: ${p.pases.map(x => '+' + x.lugares + (x.tipo === 'referido' ? ' (referidos)' : ' (coordinación: ' + esc(x.motivo || '') + ')')).join(' · ')}</p>` : '';
      const d = dialogo(`<h3>${chipPrio(p.prioridad)} ${esc(p.nombre)}</h3>
        <div class="esp-ficha-cab">${chipEstado(p.estado)} ${lugarTexto(p)} <small>${p.dias_en_lista != null ? plural(p.dias_en_lista, 'día', 'días') + ' en lista' : 'sin fecha de alta'} · ${esc(nombreSede(p.sede))} · contacta ${esc(p.dueno_nombre || '—')}</small></div>
        ${p.baja_pedida ? `<p class="esp-alerta">Pidió la baja de la lista el ${esc(dmy(p.baja_pedida))}: no recibe más mensajes.</p>` : ''}
        <p class="aclara">${p.consentimiento_fecha ? 'Aceptó que le escribamos por WhatsApp (' + esc(dmy(p.consentimiento_fecha)) + ', ' + esc(p.consentimiento_canal) + ').' : 'Todavía no hay registro de que haya aceptado que le escribamos por WhatsApp.'} ${p.referido_por ? 'Lo trajo: ' + esc(p.referido_por) + '.' : ''}</p>
        ${pases}
        <div class="botones"><select data-clave aria-label="Mensaje a armar"><option value="">Armar un mensaje…</option>${E.esp.mensajes.map(m => `<option value="${esc(m.clave)}">${esc(m.titulo)}</option>`).join('')}</select>
          ${p.baja_pedida ? '' : `<button type="button" class="boton claro" data-r="1">Registrar un contacto</button>`}</div>
        <form class="marca-form esp-editar" style="border:0;padding:0">
          <label class="campo">Nombre<input name="nombre" value="${esc(p.nombre)}" maxlength="80"></label>
          <label class="campo">Celular<input name="celular" value="${esc(p.celular)}" inputmode="tel"></label>
          <label class="campo">Horario de interés<input name="horario_texto" value="${esc(p.horario_texto)}" maxlength="120"></label>
          <label class="campo">Franjas <span class="opcional">(para el lugar)</span><select name="franjas"><option value=""${p.franjas.length ? '' : ' selected'}>Sin dato</option><option value="manana"${p.franjas.join() === 'manana' ? ' selected' : ''}>Mañana</option><option value="tarde"${p.franjas.join() === 'tarde' ? ' selected' : ''}>Tarde</option><option value="manana,tarde"${p.franjas.length === 2 ? ' selected' : ''}>Mañana o tarde</option></select></label>
          <label class="campo">Prioridad<select name="prioridad">${[1, 2, 3].map(n => `<option value="${n}"${p.prioridad === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="campo">Estado<select name="estado">${estados.map(e => `<option value="${e}"${p.estado === e ? ' selected' : ''}>${esc(E.esp.estados[e])}</option>`).join('')}</select></label>
          ${coord() ? `<label class="campo">Quién lo contacta<select name="contacto_dni"><option value="">Según el horario</option>${E.esp.equipo.filter(u => u.sede === p.sede).map(u => `<option value="${esc(u.dni)}"${p.contacto_dni === u.dni ? ' selected' : ''}>${esc(u.nombre)}</option>`).join('')}</select></label>` : ''}
          <label class="campo">Observaciones<textarea name="observaciones" maxlength="300">${esc(p.observaciones)}</textarea></label>
          <div class="botones"><button class="boton verde">Guardar</button><button type="button" class="boton claro" data-cerrar>Cerrar</button></div>
        </form>
        ${coord() ? `<details class="espera"><summary>⬆️ Pase de prioridad (coordinación)</summary><form class="marca-form esp-pase" style="border:0;padding:0"><p class="aclara">Lo adelanta hasta N lugares dentro de su prioridad. Queda registrado con el motivo; no hay sorteos. Por referidos (2 personas que se anotan) se da solo: +${E.esp.config.pase_lugares}.</p>
          <label class="campo">Lugares<input type="number" name="lugares" min="1" max="20" value="${E.esp.config.pase_lugares}"></label><label class="campo">Motivo (obligatorio)<input name="motivo" maxlength="200" required></label><div class="botones"><button class="boton claro">Dar el pase</button></div></form></details>` : ''}
        <details class="espera"><summary>🎁 Beneficios (${benef.length})</summary>
          ${benef.length ? `<ul class="pl-contactos">${benef.map(b => `<li><b>${esc(dmy(b.fecha))}</b> ${esc(b.titulo)} · ${esc(b.estado)}${b.quien ? ' · ' + esc(b.quien) : ''}${b.estado === 'ofrecido' ? ` <button class="chip" data-benef-canje="${esc(b.id)}">Lo canjeó</button>` : ''}</li>`).join('')}</ul>` : '<p class="aclara">Todavía no se le ofreció nada.</p>'}
          <div class="botones"><select data-benef>${E.esp.beneficios.map(b => `<option value="${esc(b.clave)}">${esc(b.titulo)}</option>`).join('')}</select><button type="button" class="boton claro" data-benef-ofrecer>Registrar que se lo ofrecí</button></div></details>
        <details class="espera"${hist.length ? '' : ' hidden'}><summary>🕓 Historial (${hist.length})</summary><ul class="pl-contactos">${hist.map(h => `<li><b>${esc(dmy(h.fecha))}</b> ${esc(h.tipo)}${h.mensaje_clave ? ' · ' + esc(h.mensaje_clave) : ''}${h.resultado ? ' · ' + esc(h.resultado) : ''}${h.verif && h.verif !== 'atendida' ? ' · ' + esc((VERIF[h.verif] || ['', h.verif])[1]) : ''}${h.detalle ? ' · ' + esc(h.detalle) : ''}${h.quien ? ' · ' + esc(h.quien) : ''}</li>`).join('')}</ul></details>`);
      d.querySelectorAll('[data-cerrar]').forEach(b => { b.onclick = () => d.close(); });
      d.querySelector('[data-clave]').onchange = async ev => {
        if (!ev.target.value) return;
        try { const r = await cliente.llamar('espera_mensaje', { id: id, clave: ev.target.value }); dialogoMensaje(r.mensaje.titulo, r.mensaje, p.celular); } catch (e) { falla(e); }
        ev.target.value = '';
      };
      const bR = d.querySelector('[data-r]');
      if (bR) bR.onclick = () => { d.close(); dialogoResultado(p); };
      d.querySelector('form.esp-editar').onsubmit = async ev => {
        ev.preventDefault();
        const f = new FormData(ev.target), campos = {};
        const mapa = { nombre: p.nombre, celular: p.celular, horario_texto: p.horario_texto, franjas: p.franjas.join(), prioridad: String(p.prioridad), estado: p.estado, contacto_dni: p.contacto_dni, observaciones: p.observaciones };
        Object.keys(mapa).forEach(k => { if (f.has(k) && String(f.get(k)) !== String(mapa[k])) campos[k] = String(f.get(k)); });
        if (!Object.keys(campos).length) { d.close(); return; }
        try { await cliente.llamar('espera_actualizar', { id: id, campos: campos }); d.close(); await recargar(); aviso('✅ Guardado.'); } catch (e) { falla(e); }
      };
      const fp = d.querySelector('form.esp-pase');
      if (fp) fp.onsubmit = async ev => {
        ev.preventDefault();
        const f = new FormData(fp);
        try { await cliente.llamar('espera_pase', { id: id, lugares: Number(f.get('lugares')), motivo: f.get('motivo') }); d.close(); await recargar(); aviso('✅ Pase registrado.'); } catch (e) { falla(e); }
      };
      const bo = d.querySelector('[data-benef-ofrecer]');
      if (bo) bo.onclick = async () => { try { await cliente.llamar('espera_beneficio', { id: id, beneficio: d.querySelector('[data-benef]').value, estado: 'ofrecido' }); d.close(); await recargar(); aviso('🎁 Registrado como ofrecido.'); } catch (e) { falla(e); } };
      d.querySelectorAll('[data-benef-canje]').forEach(b => { b.onclick = async () => { try { await cliente.llamar('espera_beneficio', { id: id, beneficio_id: b.dataset.benefCanje, estado: 'canjeado' }); d.close(); await recargar(); aviso('🎁 Registrado como canjeado.'); } catch (e) { falla(e); } }; });
    }

    // Registrar un contacto que no vino de una tarea
    function dialogoResultado(p) {
      const d = dialogo(`<h3>Registrar un contacto con ${esc(p.nombre)}</h3><form class="marca-form" style="border:0;padding:0">
        <label class="campo">Mensaje que mandaste<select name="clave"><option value="">Ninguno (me escribió él/ella)</option>${E.esp.mensajes.map(m => `<option value="${esc(m.clave)}">${esc(m.titulo)}</option>`).join('')}</select></label>
        <label class="campo">Qué pasó<select name="resultado">${RESULTADOS.map(r => `<option value="${r[0]}">${esc(r[1].replace(/^\S+\s/, ''))}</option>`).join('')}</select></label>
        <label class="campo">Próximo contacto <span class="opcional">(opcional)</span><input type="date" name="proximo"></label>
        <label class="campo">Nota <span class="opcional">(opcional)</span><textarea name="nota" maxlength="300"></textarea></label>
        <div class="botones"><button class="boton verde">Guardar</button><button type="button" class="boton claro" data-cerrar>Cancelar</button></div></form>`);
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      d.querySelector('form').onsubmit = async ev => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        try { await cliente.llamar('espera_resultado', { id: p.id, resultado: f.get('resultado'), mensaje_clave: f.get('clave'), envio: !!f.get('clave'), proximo: f.get('proximo') || '', nota: f.get('nota') }); d.close(); await recargar(); aviso('✅ Anotado en el historial.'); } catch (e) { falla(e); }
      };
    }

    // ---------- La pestaña ----------
    function filtrar(personas) {
      const q = E.espBusca.trim().toLowerCase();
      return personas.filter(p => p.sede === E.espSede
        && (E.espEstado === 'todas' || (E.espEstado === 'fila' ? ['nuevo', 'esperando', 'contactado', 'reconfirmo', 'evaluacion_agendada'].indexOf(p.estado) >= 0 && !p.baja_pedida : p.estado === E.espEstado))
        && (!E.espFranja || p.franjas.indexOf(E.espFranja) >= 0)
        && (!q || (p.nombre + ' ' + p.celular).toLowerCase().indexOf(q) >= 0));
    }
    const orden = (a, b) => a.prioridad - b.prioridad || String(a.fecha_alta || '9999').localeCompare(String(b.fecha_alta || '9999'));

    function filaPersona(p) {
      return `<article class="esp-fila${p.baja_pedida ? ' esp-baja' : ''}"><div class="esp-datos"><b>${chipPrio(p.prioridad)} ${esc(p.nombre)}</b>
        <span class="aclara">${esc(p.horario_texto || 'sin horario')} · ${p.dias_en_lista != null ? plural(p.dias_en_lista, 'día', 'días') : 'sin fecha'} · contacta ${esc((p.dueno_nombre || '—').split(' ')[0])}${p.intentos ? ' · ' + plural(p.intentos, 'intento', 'intentos') + ' sin respuesta' : ''}</span>
        <span>${chipEstado(p.estado)} ${lugarTexto(p)}</span></div>
        <div class="botones"><button class="boton claro" data-accion="esp-ficha" data-id="${esc(p.id)}">Abrir</button>
        ${p.celular && !p.baja_pedida ? `<a class="boton claro" href="https://wa.me/${esc(p.celular)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${esc(p.nombre)}">💬</a>` : ''}</div></article>`;
    }

    function panelMetricas() {
      const M = E.espMetricas;
      if (!M) return '<div class="cargando">Calculando…</div>';
      return `<div class="esp-metricas">${M.sedes.filter(s => s.total).map(s => `<section class="grupo"><h2>${esc(s.nombre)} <span class="cuenta">${plural(s.total, "persona", "personas")}</span></h2>
        <div class="esp-kpis"><div><b>${s.en_fila}</b><span>en fila (${s.vigentes} confirmadas)</span></div><div><b>${s.tasa_respuesta == null ? '—' : String(s.tasa_respuesta).replace('.', ',') + '%'}</b><span>respuesta (${s.respuestas} de ${s.contactos})</span></div>
          <div><b>${s.dias_en_lista_mediana == null ? '—' : s.dias_en_lista_mediana}</b><span>días en lista (mediana)</span></div><div><b>${s.ingresos}</b><span>ingresos${s.dias_hasta_ingreso_mediana != null ? ' · ' + s.dias_hasta_ingreso_mediana + ' días de espera' : ''}</span></div>
          <div><b>${s.sin_comprobar}</b><span>contactos hechos sin comprobar</span></div><div><b>${s.beneficios_canjeados}</b><span>beneficios canjeados de ${s.beneficios_ofrecidos}</span></div></div>
        <p class="aclara">${Object.keys(s.estados).filter(e => s.estados[e]).map(e => esc(E.esp.estados[e]) + ': ' + s.estados[e]).join(' · ')}</p></section>`).join('') || '<p class="aclara">Todavía no hay personas cargadas.</p>'}</div>`;
    }

    function vista() {
      if (!E.esp) return '<div class="cargando">Cargando la lista de espera…</div>';
      const D = E.esp;
      const tabsSede = D.sedes.length > 1 ? `<nav class="esp-sedes">${D.sedes.map(s => `<button class="chip" data-accion="esp-sede" data-s="${esc(s.clave)}" aria-pressed="${E.espSede === s.clave}">${esc(s.nombre)} <span class="cuenta">${D.personas.filter(p => p.sede === s.clave && ['nuevo', 'esperando', 'contactado', 'reconfirmo', 'evaluacion_agendada'].indexOf(p.estado) >= 0).length}</span></button>`).join('')}${D.es_coord ? `<button class="chip" data-accion="esp-sede" data-s="metricas" aria-pressed="${E.espSede === 'metricas'}">📊 Métricas</button>` : ''}</nav>` : '';
      const cabeza = `<h1 class="titulo">⏳ Lista de espera <span>·</span> ${E.espSede === 'metricas' ? 'métricas' : esc(nombreSede(E.espSede))}</h1>
        <p class="bajada">Orden: prioridad 1, 2 y 3 y, dentro de cada una, antigüedad. El «lugar» cuenta solo a quienes confirmaron en los últimos 90 días y es por franja horaria.</p>${tabsSede}`;
      if (E.espSede === 'metricas') return cabeza + panelMetricas();
      const lista = filtrar(D.personas).sort(orden);
      const chip = (k, t) => `<button class="chip" data-accion="esp-estado" data-e="${k}" aria-pressed="${E.espEstado === k}">${t}</button>`;
      const ofertas = D.ofertas.map(o => { const p = D.personas.find(x => x.id === o.persona_id); return p && p.sede === E.espSede ? `<li>${esc(p.nombre)}: lugar ofrecido en ${esc(FRANJA[o.franja] || o.franja)}, vence ${esc(dmy(String(o.vence_ts).slice(0, 10)))} ${esc(String(o.vence_ts).slice(11, 16))} UTC</li>` : ''; }).join('');
      return cabeza + `<div class="esp-acciones"><button class="boton verde" data-accion="esp-alta">➕ Agregar a la lista</button><button class="boton claro" data-accion="esp-baja">🧲 Se liberó un lugar</button></div>
        ${ofertas ? `<div class="esp-ofertas"><b>Lugares ofrecidos esperando respuesta</b><ul>${ofertas}</ul></div>` : ''}
        <div class="filtros">${chip('fila', 'En fila')}${chip('pausa', 'En pausa')}${chip('descartado', 'Descartados')}${chip('ingreso', 'Ingresaron')}${chip('cerrado_amable', 'Cerrado amable')}${chip('todas', 'Todas')}
          <select data-accion="esp-franja" aria-label="Horario"><option value="">Todos los horarios</option><option value="manana"${E.espFranja === 'manana' ? ' selected' : ''}>Mañana</option><option value="tarde"${E.espFranja === 'tarde' ? ' selected' : ''}>Tarde</option></select>
          <input type="search" class="buscador" data-esp-busca placeholder="Buscar por nombre o celular" value="${esc(E.espBusca)}" aria-label="Buscar"></div>
        <p class="aclara">${plural(lista.length, 'persona', 'personas')}.</p>
        ${lista.length ? lista.map(filaPersona).join('') : '<div class="vacio">No hay nadie con ese filtro.</div>'}`;
    }

    // ---------- Acciones ----------
    async function recargar() { await cargar(); await cargarHoy(); render(); }

    async function accion(a, el, dlg, despues) {
      try {
        if (a === 'esp-copiar') copiar(textoDe(el));
        else if (a === 'esp-wa') window.open(waUrl(el.dataset.celular, textoDe(el)), '_blank', 'noopener');
        else if (a === 'esp-alta') { if (!E.esp) await cargar(); dialogoAlta(); }
        else if (a === 'esp-baja') dialogoBaja({});
        else if (a === 'esp-vista') { c.irA('espera'); }
        else if (a === 'esp-ficha') await dialogoFicha(el.dataset.id);
        else if (a === 'esp-sede') { E.espSede = el.dataset.s; if (E.espSede === 'metricas' && !E.espMetricas) { E.espMetricas = (await cliente.llamar('espera_metricas', {})); } render(); }
        else if (a === 'esp-estado') { E.espEstado = el.dataset.e; render(); }
        else if (a === 'esp-ofrecer') {
          el.disabled = true;
          const r = await cliente.llamar('espera_ofrecer', { id: el.dataset.id, franja: el.dataset.franja });
                    if (dlg) dlg.close();
          dialogoMensaje('Lugar ofrecido: mandale este mensaje', r.mensaje, el.dataset.celular || '', '<p class="aclara">Quedó anotado el ofrecimiento. Si no responde en la ventana, el lugar pasa al siguiente. Cupo sin verificar: confirmalo en MOVE.</p>');
          cargar().then(() => cargarHoy(render));
        } else if (a === 'esp-ingreso') {
          if (!confirm('¿Marcar que esta persona ingresó? Sale de la lista.')) return;
          await cliente.llamar('espera_oferta_resolver', { id: el.dataset.id, resultado: 'ingreso' });
          if (dlg) dlg.close();
          await recargar(); aviso('✅ Marcado como ingresó.');
        } else if (a === 'esp-oferta-siguiente') {
          await cliente.llamar('espera_oferta_resolver', { oferta_id: el.dataset.oferta, resultado: 'siguiente' });
          await cargarHoy(); render(); aviso('✅ Anotado.');
        } else if (a === 'esp-resultado') {
          const caja = el.closest('.esp-tarea');
          const t = (E.espHoy.tareas || []).find(x => x.persona_id === el.dataset.id);
          el.disabled = true;
          if (t && t.beneficio) await cliente.llamar('espera_beneficio', { id: t.persona_id, beneficio: t.beneficio.clave, estado: 'ofrecido' });
          await cliente.llamar('espera_resultado', { id: el.dataset.id, resultado: el.dataset.r, mensaje_clave: el.dataset.clave, tarea_tipo: el.dataset.tipo, proximo: (caja.querySelector('[data-prox]') || {}).value || '' });
          await cargar(); await cargarHoy(); render(); aviso('✅ Anotado. Gracias.');
        }
        if (despues) despues();
      } catch (e) { if (el) el.disabled = false; falla(e); }
    }

    function alEscribir(el) {
      if (el.matches('[data-esp-busca]')) { E.espBusca = el.value; render(); const i = document.querySelector('[data-esp-busca]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
      else if (el.matches('[data-accion="esp-franja"]')) { E.espFranja = el.value; render(); }
    }

    return { vista, bandaHoy, cargar, cargarHoy, accion, alEscribir, dialogoBaja, copiar };
  }

  raiz.PulsoEspera = { crear: crear };
})(typeof window !== 'undefined' ? window : globalThis);

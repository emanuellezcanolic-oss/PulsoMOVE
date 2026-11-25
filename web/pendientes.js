// PulsoMOVE · Pendientes con socios: cómo se ven y qué pasa al tocar (Emanuel, 25/11/2026). El servidor está en apps-script/Pendientes.js.
// app.js lo crea con lo que necesita (cliente, estado E, esc, aviso, falla, dialogo, tiene, recargar) y le pasa las acciones que empiezan con "pds-".
(function (raiz) {
  const SEDES = { bariloche: 'Bariloche', bolson: 'El Bolsón', puelo: 'Lago Puelo' };
  const dmy = iso => (iso ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) : '');
  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
  const EJEMPLOS = ['Cambiar la fecha de la evaluación', 'Marcarle la planificación', 'Ajustarle un ejercicio que le molesta', 'Pasarle la rutina para hacer en casa'];

  function cuandoTxt(p) {
    const partes = ['Lo pidió el ' + dmy(p.desde) + (p.creado_rol === 'recepcion' ? ' (lo anotó ' + String(p.creado_nombre || '').split(' ')[0] + ', de recepción)' : '')];
    if (p.derivado_de_nombre) partes.push('te lo pasó ' + String(p.derivado_de_nombre).split(' ')[0]);
    if (p.limite) partes.push(p.limite < p.hoy ? 'tenía fecha el ' + dmy(p.limite) : 'para el ' + dmy(p.limite));
    return partes.join(' · ');
  }

  // Busca el socio por lo escrito en el campo: nombre exacto, «nombre (n.° id)» o una sola coincidencia
  function elegirSocio(socios, valor) {
    const q = String(valor || '').trim().toLowerCase();
    if (!q) return null;
    const exacto = socios.filter(s => s.etiqueta.toLowerCase() === q);
    if (exacto.length === 1) return exacto[0];
    const par = socios.filter(s => q.length > 2 && s.etiqueta.toLowerCase().indexOf(q) >= 0);
    return par.length === 1 ? par[0] : null;
  }

  function conEtiquetas(socios) {
    const n = {};
    socios.forEach(s => { n[s.nombre] = (n[s.nombre] || 0) + 1; });
    return socios.map(s => Object.assign({}, s, { etiqueta: n[s.nombre] > 1 ? `${s.nombre} (n.° ${s.socio_id})` : s.nombre }));
  }

  function crear(c) {
    const { cliente, E, esc, aviso, falla, dialogo, tiene, recargar } = c;

    // ---------- Bloque del profe: «📌 Pendientes con socios» ----------
    function tarjeta(p, hoy) {
      const v = Object.assign({ hoy: hoy }, p);
      return `<article class="pds-item${p.atrasado ? ' pds-atrasado' : ''}${p.vence_hoy ? ' pds-hoy' : ''}"><div class="pds-cab"><b>${esc(p.socio_nombre)}</b><span class="aclara">${esc(cuandoTxt(v))}</span></div>
        <p class="pds-que">“${esc(p.que)}”</p>
        ${p.atrasado ? `<p class="aclara pds-aviso">Lleva ${plural(p.dias_habiles, 'día hábil', 'días hábiles')} esperando: coordinación ya lo ve. Si no corresponde, marcalo así y listo.</p>` : ''}
        ${p.es_plan && p.puede_derivar ? '<p class="aclara">Si es un plan de otro profe que hacés vos, anotalo también en «➕ Plan extra» así te cuenta.</p>' : ''}
        <div class="botones"><button class="boton verde" data-accion="pds-hecho" data-id="${esc(p.id)}">✅ Hecho</button>
          <button class="boton claro" data-accion="pds-no" data-id="${esc(p.id)}">No corresponde</button>
          ${p.puede_derivar ? `<button class="boton claro" data-accion="pds-derivar" data-id="${esc(p.id)}">Pasárselo a ${esc(p.puede_derivar)}</button>` : ''}</div></article>`;
    }

    function bloqueProfe(M, hoy) {
      const P = M && M.pendientes_socio;
      if (!P) return '';
      const abiertos = P.abiertos || [], hechos = P.resueltos_hoy || [];
      const dueno = {};
      (M.extra || []).forEach(s => { if (s.profe) dueno[s.socio_id] = s.profe; });
      const lista = abiertos.map(p => tarjeta(Object.assign({}, p, { puede_derivar: dueno[p.socio_id] ? dueno[p.socio_id].split(' ')[0] : '' }), hoy)).join('');
      return `<section class="grupo pds"><h2>📌 Pendientes con socios <span class="cuenta">${abiertos.length || 'al día'}</span></h2>
        <p class="intro-grupo">Lo que un socio te pidió y no querés olvidarte. Aparece todos los días hasta que lo marques «Hecho». No te baja nada mientras está pendiente y, cuando lo resolvés, suma como tarea hecha.</p>
        ${lista || '<div class="vacio">No tenés pedidos de socios pendientes. 🙌</div>'}
        ${hechos.length ? `<details class="catalogo"><summary>Resueltos hoy (${hechos.length})</summary>${hechos.map(p => `<div class="hecha-fila"><span><b>${esc(p.socio_nombre)}</b> · ${p.estado === 'hecho' ? '✅ Hecho' : '🚫 No corresponde: ' + esc(p.motivo)} · “${esc(p.que)}”</span>
          <button class="boton claro" data-accion="pds-deshacer" data-id="${esc(p.id)}">Deshacer</button></div>`).join('')}</details>` : ''}
        <div class="fila-accion"><button class="boton claro" data-accion="pds-anotar">➕ Anotar pedido del socio</button>${P.hechos_mes ? `<span class="aclara">Este mes resolviste ${plural(P.hechos_mes, 'pedido', 'pedidos')}.</span>` : ''}</div></section>`;
    }

    // ---------- Coordinación: lo que lleva más de 3 días hábiles ----------
    function bloqueCoord(lista) {
      if (!lista || !lista.length) return '';
      return `<section class="grupo pds pds-coord"><h2>📌 Pedidos de socios esperando <span class="cuenta">${lista.length}</span></h2>
        <p class="intro-grupo">Estos pedidos llevan más de 3 días hábiles sin resolver. Quizás el profe está a full: un recordatorio amable o una mano suele alcanzar.</p>
        <div class="envoltura-tabla"><table class="tabla compacta"><thead><tr><th>Profe</th><th>Socio</th><th>Qué pidió</th><th>Desde</th><th>Días hábiles</th><th>Lo anotó</th></tr></thead><tbody>
        ${lista.map(p => `<tr><td>${esc(p.profe_nombre)}</td><td>${esc(p.socio_nombre)}</td><td>${esc(p.que)}${p.limite ? ` <small>(para el ${esc(dmy(p.limite))})</small>` : ''}</td><td>${esc(dmy(p.desde))}</td><td class="num"><b>${p.dias_habiles}</b></td><td>${esc(p.creado_nombre)}</td></tr>`).join('')}
        </tbody></table></div></section>`;
    }

    // ---------- Anotar (profe o recepción) ----------
    async function dialogoAnotar() {
      const esProfe = tiene('profe');
      const d = dialogo(`<h3>📌 Anotar pedido del socio</h3>
        <p class="bajada" style="margin:0">${esProfe ? 'Lo que un socio te pidió: queda en tu lista todos los días hasta que lo marques hecho.' : 'Lo que un socio le pidió a su profe: le llega al profe y queda en su lista hasta que lo resuelva.'}</p>
        <form class="marca-form" style="border:0;padding:0">
          <label class="campo">Socio<input class="buscador" name="socio" list="socios-pds" autocomplete="off" placeholder="Escribí el nombre" required><span class="aclara" data-carga>Cargando los socios…</span></label>
          <datalist id="socios-pds"></datalist>
          <div data-para></div>
          <label class="campo">¿Qué pidió?<input name="que" maxlength="200" required list="pds-ejemplos" placeholder="Ej.: ${esc(EJEMPLOS[0].toLowerCase())}"></label>
          <datalist id="pds-ejemplos">${EJEMPLOS.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
          <label class="campo">Para cuándo <span class="opcional">(opcional)</span><input type="date" name="limite" min="${esc(E.hoy || '')}"></label>
          <p class="aclara" data-plan hidden>Si es un plan que hacés vos para un socio de otro profe, acordate de anotarlo también en «➕ Plan extra»: así te cuenta a vos.</p>
          <div class="botones"><button class="boton verde">Anotar</button><button type="button" class="boton claro" data-cerrar>Cancelar</button></div>
        </form>
        <div data-anotados></div>`);
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      const form = d.querySelector('form');
      let D = { socios: [], profes: [], anotados: [] };
      try {
        D = await cliente.llamar('socio_pendiente_socios', {});
        D.socios = conEtiquetas(D.socios);
        d.querySelector('#socios-pds').innerHTML = D.socios.map(s => `<option value="${esc(s.etiqueta)}">${s.profe ? esc('Socio de ' + s.profe) : ''}</option>`).join('');
        d.querySelector('[data-carga]').textContent = D.socios.length ? '' : 'No hay socios cargados para tu sede.';
        if (D.anotados.length) d.querySelector('[data-anotados]').innerHTML = `<details class="catalogo"><summary>Lo que anotaste en las últimas dos semanas (${D.anotados.length})</summary><ul class="pl-contactos">${D.anotados.map(p => `<li><b>${esc(dmy(p.desde))}</b> ${esc(p.socio_nombre)} · ${esc(p.que)} · para ${esc(String(p.profe_nombre).split(' ')[0])} · ${p.estado === 'pendiente' ? 'pendiente' : p.estado === 'hecho' ? '✅ hecho' : '🚫 no corresponde: ' + esc(p.motivo)}</li>`).join('')}</ul></details>`;
      } catch (e) { d.querySelector('[data-carga]').textContent = 'No pudimos cargar los socios. Cerrá y probá de nuevo.'; }
      const caja = d.querySelector('[data-para]');
      const pintarPara = () => {
        const s = elegirSocio(D.socios, form.socio.value);
        if (!s) { caja.innerHTML = ''; return; }
        if (esProfe && s.profe) {
          caja.innerHTML = `<fieldset class="campo pds-para"><legend>${esc(s.nombre)} es socio de ${esc(s.profe)}</legend>
            <label class="visto"><input type="radio" name="para" value="dueno" checked> Pasárselo a ${esc(s.profe.split(' ')[0])} (le llega a su lista)</label>
            <label class="visto"><input type="radio" name="para" value="yo"> Lo hago yo</label></fieldset>`;
        } else if (!esProfe) {
          const otros = D.profes.filter(p => p.sede === s.sede || !s.sede);
          caja.innerHTML = `<label class="campo">¿Para qué profe?<select name="profe_dni"><option value="">${s.profe ? esc(s.profe) + ' (su profe)' : 'Su profe'}</option>${otros.filter(p => p.dni !== s.profe_dni).map(p => `<option value="${esc(p.dni)}">${esc(p.nombre)}</option>`).join('')}</select></label>`;
        } else caja.innerHTML = '';
      };
      const pintarPlan = () => {
        const s = elegirSocio(D.socios, form.socio.value);
        const r = form.querySelector('[name=para]:checked');
        d.querySelector('[data-plan]').hidden = !(esProfe && s && s.profe && r && r.value === 'yo' && /\bplan|planific|rutina/i.test(form.que.value));
      };
      form.socio.addEventListener('input', () => { pintarPara(); pintarPlan(); });
      form.socio.addEventListener('change', () => { pintarPara(); pintarPlan(); });
      form.que.addEventListener('input', pintarPlan);
      caja.addEventListener('change', pintarPlan);
      form.onsubmit = async ev => {
        ev.preventDefault();
        const s = elegirSocio(D.socios, form.socio.value);
        if (!s) { aviso('Elegí el socio de la lista: escribí su nombre y tocá la sugerencia.', true); return; }
        if (form.que.value.trim().length < 3) { aviso('Contá en pocas palabras qué pidió el socio.', true); return; }
        const r = form.querySelector('[name=para]:checked'), pr = form.querySelector('[name=profe_dni]');
        const btn = form.querySelector('button.verde');
        btn.disabled = true;
        try {
          const res = await cliente.llamar('socio_pendiente_anotar', { socio_id: s.socio_id, que: form.que.value.trim(), limite: form.limite.value || '', para: r ? r.value : 'yo', profe_dni: pr ? pr.value : '' });
          d.close();
          if (recargar) await recargar();
          aviso(res.recordar_plan_extra ? `📌 Anotado. Como el plan lo hacés vos, acordate de cargarlo también en «Plan extra».`
            : esProfe && res.pendiente.derivado_de_nombre ? `📌 Listo: se lo pasamos a ${res.para_nombre}. Le aparece en su lista hasta que lo resuelva.`
              : esProfe ? '📌 Anotado: te aparece todos los días hasta que lo marques hecho.'
                : `📌 Listo: le anotamos el pedido a ${res.para_nombre}. Le aparece en su lista hasta que lo resuelva.`);
        } catch (e) { btn.disabled = false; falla(e); }
      };
    }

    function dialogoNo(id) {
      const d = dialogo(`<form class="marca-form" style="border:0;padding:0"><h3 class="sin-mayus">🚫 No corresponde</h3>
        <p class="bajada" style="margin:0">Contanos en pocas palabras por qué, así queda claro para el socio y para coordinación.</p>
        <label class="campo">Motivo<textarea name="motivo" maxlength="200" required placeholder="Ej.: ya lo resolvió recepción, el socio cambió de idea…"></textarea></label>
        <div class="botones"><button class="boton verde">Guardar</button><button type="button" class="boton claro" data-cerrar>Cancelar</button></div></form>`);
      d.querySelector('[data-cerrar]').onclick = () => d.close();
      const form = d.querySelector('form');
      form.onsubmit = async ev => {
        ev.preventDefault();
        if (form.motivo.value.trim().length < 3) { aviso('Escribí el motivo en pocas palabras.', true); return; }
        try { await resolver(id, 'no_corresponde', form.motivo.value.trim()); d.close(); } catch (e) { falla(e); }
      };
    }

    async function resolver(id, resultado, motivo) {
      const r = await cliente.llamar('socio_pendiente_resolver', { id: id, resultado: resultado, motivo: motivo || '' });
      if (E.planes && E.planes.mio && r.mios) E.planes.mio.pendientes_socio = r.mios;
      if (recargar) await recargar();
      aviso(resultado === 'hecho' ? `✅ ¡Bien! Resuelto el pedido de ${r.pendiente.socio_nombre}. Suma como tarea hecha.` : resultado === 'pendiente' ? '↩️ Volvió a tu lista.' : '👌 Anotado como «no corresponde».');
    }

    async function accion(a, el) {
      const id = el && el.dataset.id;
      try {
        if (a === 'pds-anotar') await dialogoAnotar();
        else if (a === 'pds-hecho') { el.disabled = true; await resolver(id, 'hecho'); }
        else if (a === 'pds-deshacer') { el.disabled = true; await resolver(id, 'pendiente'); }
        else if (a === 'pds-no') dialogoNo(id);
        else if (a === 'pds-derivar') {
          el.disabled = true;
          const r = await cliente.llamar('socio_pendiente_derivar', { id: id });
          if (recargar) await recargar();
          aviso(`📌 Listo: se lo pasamos a ${r.para_nombre}. Ya no te aparece.`);
        }
      } catch (e) { if (el) el.disabled = false; falla(e); }
    }

    return { bloqueProfe, bloqueCoord, dialogoAnotar, accion };
  }

  raiz.PulsoPendientes = { crear: crear, elegirSocio: elegirSocio, conEtiquetas: conEtiquetas, SEDES: SEDES };
})(typeof window !== 'undefined' ? window : globalThis);

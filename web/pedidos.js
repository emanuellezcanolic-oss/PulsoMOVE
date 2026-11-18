// PulsoMOVE · Pedidos de coordinación: cómo se ven (Emanuel, 18/11/2026).
// Solo arma el HTML. Lo que pasa al tocar un botón vive en app.js (acciones que empiezan con "ped-").
(function (raiz) {
  const SEDES = { bariloche: 'Bariloche', bolson: 'El Bolsón', puelo: 'Lago Puelo' };
  const ROLES = { recepcion: 'Recepción', profe: 'Profes' };
  const AVISOS = [[1, 'el día anterior'], [2, '2 días antes'], [3, '3 días antes'], [5, '5 días antes'], [7, '1 semana antes'], [10, '10 días antes'], [14, '2 semanas antes']];
  const REPITE = [['', 'No se repite'], ['semanal', 'Todas las semanas'], ['mensual', 'Todos los meses']];
  const dmy = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');
  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

  function cuando(p) {
    if (p.faltan == null) return '';
    if (p.faltan < 0) return `Venció el ${dmy(p.cierra)} (hace ${plural(-p.faltan, 'día', 'días')})`;
    if (p.faltan === 0) return `Cierra hoy (${dmy(p.cierra)})`;
    if (p.faltan === 1) return `Cierra mañana (${dmy(p.cierra)})`;
    return `Cierra el ${dmy(p.cierra)} · faltan ${plural(p.faltan, 'día', 'días')}`;
  }

  const urgencia = p => (p.hecho ? 'hecho' : p.faltan == null ? '' : p.faltan <= 1 ? 'urgente' : p.faltan <= 3 ? 'pronto' : '');

  // ---------- Lo que ve recepción y cada profe ----------

  function tarjetaMia(p, esc) {
    const cab = `<div class="ped-cab"><b>${esc(p.titulo)}</b><span class="ped-cuando">${esc(cuando(p))}${p.repite ? ' · ' + (p.repite === 'semanal' ? 'semanal' : 'mensual') : ''}</span></div>
      <span class="aclara">Pedido de ${esc(p.de_nombre)}</span>${p.detalle ? `<p class="ped-detalle">${esc(p.detalle)}</p>` : ''}`;
    const items = p.items || [];
    const lista = items.length
      ? `<ul class="ped-items">${items.map(i => `<li><span><b>${esc(i.cantidad)}</b> × ${esc(i.texto)}</span><small>${esc(i.nombre)}</small><button class="chip" data-accion="ped-quitar" data-item="${esc(i.id)}" title="Quitar" aria-label="Quitar ${esc(i.texto)}">✕</button></li>`).join('')}</ul>`
      : '';
    const sumar = `<form class="ped-fila" data-form="ped-item" data-id="${esc(p.id)}"><input type="text" name="texto" maxlength="80" placeholder="Sumar un ítem u observación (ej. lavandina)" required aria-label="Ítem u observación"><input type="text" name="cantidad" maxlength="20" placeholder="Cant." class="ped-cant" aria-label="Cantidad" inputmode="numeric"><button class="boton claro">Agregar</button></form>`;
    const cierre = p.hecho
      ? `<div class="ped-hecho">✅ Hecho${p.hecho_nota ? ': ' + esc(p.hecho_nota) : ''} <button class="chip" data-accion="ped-deshacer" data-id="${esc(p.id)}">Deshacer</button></div>`
      : `<div class="ped-fila"><input type="text" maxlength="300" data-ped-nota="${esc(p.id)}" placeholder="Nota para coordinación (opcional)" aria-label="Nota"><button class="boton verde" data-accion="ped-hecho" data-id="${esc(p.id)}">Listo, hecho</button></div>`;
    return `<article class="ped ${urgencia(p)}">${cab}${lista}${p.hecho ? '' : sumar}${cierre}</article>`;
  }

  function bandaMios(M, esc) {
    if (!M || !M.pedidos || !M.pedidos.length) return '';
    const pend = M.pedidos.filter(p => !p.hecho).length;
    return `<section class="pedidos-mios"><h2>📌 Pedidos de coordinación <span class="cuenta">${pend ? plural(pend, 'pendiente', 'pendientes') : 'todo al día'}</span></h2>${M.pedidos.map(p => tarjetaMia(p, esc)).join('')}</section>`;
  }

  // ---------- Coordinación ----------

  function destinatarios(p, V, esc) {
    const partes = [];
    if (p.para_roles.length) partes.push(p.para_roles.map(r => ROLES[r] || r).join(' y ') + (p.para_sedes.length ? ' de ' + p.para_sedes.map(s => SEDES[s] || s).join(' y ') : ' de todas las sedes'));
    if (p.para_dnis.length) partes.push(p.para_dnis.map(d => ((V.personas.find(x => x.dni === d) || {}).nombre) || d).join(', '));
    return esc(partes.join(' + '));
  }

  function porSedeHtml(grupos, esc) {
    return grupos.map(g => `<div class="ped-sede"><b>${esc(SEDES[g.sede] || g.sede)}</b> <span class="aclara">${plural(g.items.length, 'artículo', 'artículos')}</span>
      <ul class="ped-items">${g.items.map(i => `<li><span><b>${esc(i.cantidad)}</b> × ${esc(i.texto)}</span><small>${esc(i.nombre)} · ${esc(dmy(String(i.ts).slice(0, 10)))}</small></li>`).join('')}</ul></div>`).join('');
  }

  const ESTADOS = { activo: ['verde', 'Avisando ahora'], programado: ['gris', 'Programado'], atrasado: ['rojo', 'Atrasado'], cerrado: ['gris', 'Cerrado'] };

  function tarjetaCoord(p, V, esc) {
    const [color, txt] = ESTADOS[p.estado] || ['gris', p.estado];
    const hechos = p.asignados.filter(a => a.hecho).length;
    const gente = p.asignados.length
      ? `<div class="ped-gente">${p.asignados.map(a => `<span class="chip-persona ${a.hecho ? 'ok' : ''}" title="${esc(a.nota || '')}">${a.hecho ? '✔' : '○'} ${esc(a.nombre)} <small>${esc(SEDES[a.sede] || '')}</small></span>`).join('')}</div>`
      : '<p class="aclara">Hoy no hay nadie activo que le toque.</p>';
    const lista = (p.por_sede.length || p.anteriores.length)
      ? `<h4 class="sub-coord">Ítems y observaciones que cargaron${p.ciclo ? ' (cierre del ' + esc(dmy(p.ciclo)) + ')' : ''}</h4>${p.por_sede.length ? porSedeHtml(p.por_sede, esc) : '<p class="aclara">Nada cargado en este cierre.</p>'}
        ${p.por_sede.length ? `<div class="botones"><button class="boton claro chico" data-accion="ped-excel" data-id="${esc(p.id)}">⬇️ Bajar para Excel</button></div>` : ''}
        ${p.anteriores.length ? `<details class="ped-ant"><summary>Cierres anteriores (${p.anteriores.length})</summary>${p.anteriores.map(a => `<h5>Cierre del ${esc(dmy(a.ciclo))}</h5>${a.por_sede.length ? porSedeHtml(a.por_sede, esc) : '<p class="aclara">Sin artículos.</p>'}`).join('')}</details>` : ''}`
      : '';
    return `<article class="ped-coord ${p.estado}"><div class="ped-cab"><b>📌 ${esc(p.titulo)}</b><span class="estado ${color}">${esc(txt)}</span></div>
      <p class="aclara">Pedido de ${esc(p.de_nombre)} · para ${destinatarios(p, V, esc)}${p.cierra ? ` · avisa desde el ${esc(dmy(p.desde))}, cierra el ${esc(dmy(p.ciclo))}` : ' · sin fecha de cierre'}${p.repite ? ' · ' + (p.repite === 'semanal' ? 'se repite cada semana' : 'se repite cada mes') : ''}</p>
      ${p.detalle ? `<p class="ped-detalle">${esc(p.detalle)}</p>` : ''}
      <h4 class="sub-coord">Quién lo hizo <span class="cuenta">${hechos} de ${p.asignados.length}</span></h4>${gente}${lista}
      <div class="botones"><button class="boton claro chico" data-accion="ped-editar" data-id="${esc(p.id)}">✏️ Editar</button><button class="boton claro chico" data-accion="ped-borrar" data-id="${esc(p.id)}">🗑️ Borrar</button></div></article>`;
  }

  function formulario(V, b, esc) {
    const tilde = (v, arr) => (arr.indexOf(v) >= 0 ? ' checked' : '');
    const personas = ['bariloche', 'bolson', 'puelo'].map(s => {
      const ps = V.personas.filter(p => p.sede === s);
      return ps.length ? `<div class="ped-grupo-sede"><b>${esc(SEDES[s])}</b>${ps.map(p => `<label class="ped-check"><input type="checkbox" name="dni" value="${esc(p.dni)}"${tilde(p.dni, b.para_dnis)}> ${esc(p.nombre)} <small>${p.roles.map(r => esc(ROLES[r] || r)).join(' · ')}</small></label>`).join('')}</div>` : '';
    }).join('');
    return `<section class="grupo ped-form"><h2>${b.id ? '✏️ Editar pedido' : '➕ Nuevo pedido'}</h2>
      <form data-form="ped-guardar" data-id="${esc(b.id || '')}">
        <label class="campo">Título<input name="titulo" maxlength="80" required value="${esc(b.titulo)}" placeholder="Ej. Pedido de artículos de limpieza"></label>
        <label class="campo">Detalle <span class="opcional">(opcional)</span><textarea name="detalle" maxlength="600" placeholder="Qué tienen que hacer y cómo (ej. cargar lo que falte de limpieza y avisar cuando terminaron)">${esc(b.detalle)}</textarea></label>
        <fieldset class="ped-para"><legend>¿A quién le llega?</legend>
          <div class="ped-opciones">${Object.keys(ROLES).map(r => `<label class="ped-check"><input type="checkbox" name="rol" value="${r}"${tilde(r, b.para_roles)}> ${esc(ROLES[r])}</label>`).join('')}</div>
          <div class="ped-opciones"><span class="aclara">Sedes:</span>${Object.keys(SEDES).map(s => `<label class="ped-check"><input type="checkbox" name="sede" value="${s}"${tilde(s, b.para_sedes)}> ${esc(SEDES[s])}</label>`).join('')}<span class="aclara">(sin tildar ninguna: todas)</span></div>
          <details${b.para_dnis.length ? ' open' : ''}><summary>O elegir personas puntuales${b.para_dnis.length ? ' (' + b.para_dnis.length + ')' : ''}</summary>${personas}</details>
        </fieldset>
        <div class="ped-fechas">
          <label class="campo">Fecha límite<input type="date" name="cierra" value="${esc(b.cierra)}" required></label>
          <label class="campo">Empezar a avisar<select name="avisar_dias">${AVISOS.map(a => `<option value="${a[0]}"${Number(b.avisar_dias) === a[0] ? ' selected' : ''}>${a[1]}</option>`).join('')}</select></label>
          <label class="campo">Repetir<select name="repite">${REPITE.map(a => `<option value="${a[0]}"${b.repite === a[0] ? ' selected' : ''}>${a[1]}</option>`).join('')}</select></label>
        </div>
        <p class="aclara">Se les avisa todos los días desde la fecha de aviso, como una tarea más de su pantalla, hasta que la marquen como hecha. Mientras tanto pueden ir sumando ítems y observaciones. Si lo repetís, pasada la fecha arranca solo el del mes (o semana) siguiente, vacío, y lo cargado queda guardado acá.</p>
        <div class="botones"><button class="boton verde">${b.id ? 'Guardar los cambios' : 'Crear el pedido'}</button><button type="button" class="boton claro" data-accion="ped-cancelar">Cancelar</button></div>
      </form></section>`;
  }

  const vacio = () => ({ id: '', tipo: 'tarea', titulo: '', detalle: '', para_roles: ['recepcion'], para_sedes: [], para_dnis: [], cierra: '', avisar_dias: 7, repite: '' });

  function vistaCoord(V, borrador, esc) {
    if (!V) return '<div class="cargando">Cargando pedidos…</div>';
    if (borrador) return formulario(V, Object.assign(vacio(), borrador), esc);
    const activos = V.pedidos.filter(p => p.estado !== 'cerrado'), cerrados = V.pedidos.filter(p => p.estado === 'cerrado');
    return `<h1 class="titulo">📌 Pedidos <span>·</span> a recepción y profes</h1>
      <p class="intro-grupo">Armá una tarea para recepción o profes (un pedido de limpieza, o lo que necesites) con fecha límite y desde cuándo les avisa. Les aparece arriba de su pantalla; pueden ir sumando ítems y observaciones y marcarla como hecha.</p>
      <div class="botones"><button class="boton verde" data-accion="ped-nuevo">➕ Nuevo pedido</button></div>
      <section class="grupo"><h2>Abiertos <span class="cuenta">${activos.length}</span></h2>${activos.length ? activos.map(p => tarjetaCoord(p, V, esc)).join('') : '<div class="vacio">No hay pedidos abiertos.</div>'}</section>
      ${cerrados.length ? `<section class="grupo"><h2>Cerrados <span class="cuenta">${cerrados.length}</span></h2>${cerrados.map(p => tarjetaCoord(p, V, esc)).join('')}</section>` : ''}`;
  }

  // Lo que dice el formulario → lo que espera el servidor
  function leerFormulario(form) {
    const f = new FormData(form);
    return {
      id: form.dataset.id || undefined, titulo: String(f.get('titulo') || '').trim(), detalle: String(f.get('detalle') || '').trim(),
      para_roles: f.getAll('rol'), para_sedes: f.getAll('sede'), para_dnis: f.getAll('dni'), cierra: f.get('cierra') || '', avisar_dias: Number(f.get('avisar_dias')), repite: f.get('repite') || '',
    };
  }

  // Los artículos de un pedido, listos para Excel (separador ;). Una fila por artículo.
  function filasExcel(p) {
    const cab = ['Pedido', 'Cierre', 'Sede', 'Artículo', 'Cantidad', 'Cargó', 'Fecha'];
    const filas = [];
    p.por_sede.forEach(g => g.items.forEach(i => filas.push([p.titulo, p.ciclo, SEDES[g.sede] || g.sede, i.texto, i.cantidad, i.nombre, String(i.ts).slice(0, 10)])));
    return [cab].concat(filas);
  }

  raiz.PulsoPedidos = { bandaMios, vistaCoord, leerFormulario, filasExcel, vacio, cuando };
})(window);

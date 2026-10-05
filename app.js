/* Mejoramiento institucional ENS San Bernardo — Guía 34 MEN */
const CFG = {
  url: 'https://cszimntzozysekgaukrh.supabase.co',
  key: 'sb_publishable_Bf7smDiScJkD_YxPPgJrCg_sBXXs4YU'
};
const SB = supabase.createClient(CFG.url, CFG.key);
const NIV = { 1: 'Existencia', 2: 'Pertinencia', 3: 'Apropiación', 4: 'Mejoramiento continuo' };
const S = { user: null, profile: null, miembros: [], ciclos: [], ciclo: null, areas: [], procesos: [], comps: [], descs: {}, fuentes: [], integrantes: [] };


/* ---------- Datos institucionales (completar los vacíos; los vacíos no se muestran) ---------- */
const INST = {
  nombre: 'Escuela Normal Superior San Bernardo',
  nombreLegal: 'Institución Educativa Escuela Normal Superior',
  lema: 'Educando para la paz con libertad y autonomía',
  municipio: 'San Bernardo', departamento: 'Cundinamarca', provincia: 'Sumapaz',
  entidad: 'Secretaría de Educación de Cundinamarca', nucleo: '100',
  dane: '125649000015', icfes: '00911-8', nit: '',
  resolucion: 'Acreditación de calidad y desarrollo Res. 7012 del 6-ago-2010; PFC Res. 000474 del 23-ene-2019',
  rector: 'Edwin Alveiro Niño Castiblanco',
  direccion: 'Km 1 vía La Unchía, vereda San Miguel',
  telefono: '3213609037', correo: 'iednormalsuperior_sanbernardo@secundinamarca.edu.co', web: ''
};
const instLines = () => [
  INST.dane && ['DANE', INST.dane], INST.icfes && ['ICFES', INST.icfes], INST.nit && ['NIT', INST.nit],
  INST.resolucion && ['Resolución', INST.resolucion],
  (INST.municipio || INST.departamento) && ['Ubicación', [INST.municipio, INST.provincia && 'Prov. ' + INST.provincia, INST.departamento].filter(Boolean).join(', ')],
  INST.entidad && ['Entidad territorial', INST.entidad],
  INST.direccion && ['Dirección', INST.direccion], INST.telefono && ['Teléfono', INST.telefono],
  INST.correo && ['Correo', INST.correo], INST.rector && ['Rector', INST.rector]
].filter(Boolean);
const instHtml = () => instLines().map(([k, v]) => `<span><b>${k}:</b> ${esc(v)}</span>`).join(' · ');
const printHead = titulo => `<div class="printonly"><img src="logo.png" alt=""><div><b style="font-size:1.2rem">${esc(INST.nombre)}</b><br>${esc(titulo)} · ${esc(S.ciclo?.nombre || '')}<br><span style="font-size:.85rem">${instHtml()}</span></div></div>`;
function renderFoot() {
  $('#foot').innerHTML = `<img src="logo.png" alt="Escudo"><div><b>${esc(INST.nombre)}</b> · ${esc(INST.lema)}<br>${instHtml() || '<span>Autoevaluación y plan de mejoramiento institucional · Guía 34 del Ministerio de Educación Nacional</span>'}</div>`;
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$ ' + Number(n || 0).toLocaleString('es-CO');
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const localDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const num = v => (v === '' || v == null ? null : Number(v));
const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

let toastT;
function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.style.background = bad ? 'var(--err)' : ''; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}
async function q(p) { const r = await p; if (r.error) throw new Error(r.error.message); return r.data; }

/* ---------- permisos ---------- */
const isAdmin = () => S.profile?.rol === 'admin';
const myAreas = () => S.miembros.filter(m => m.user_id === S.user.id).map(m => m.area_id);
const canArea = a => isAdmin() || myAreas().includes(a);
const isCoord = a => isAdmin() || S.miembros.some(m => m.user_id === S.user.id && m.area_id === a && m.es_coordinador);
const areaOf = compId => S.procesos.find(p => p.id === S.comps.find(c => c.id === compId).proceso_id).area_id;
const equipoDe = a => S.integrantes.filter(i => i.area_id === a);
const defaultArea = () => myAreas()[0] || 1;
const badge = (n, txt) => `<span class="badge b${n || 0}">${n ? n + ' · ' + NIV[n] : (txt || 'Sin valorar')}</span>`;

/* ---------- arranque ---------- */
async function boot() {
  const { data } = await SB.auth.getSession();
  S.user = data.session?.user || null;
  SB.auth.onAuthStateChange((ev, ses) => {
    const prev = S.user?.id; S.user = ses?.user || null;
    if (ev === 'SIGNED_OUT' || prev !== S.user?.id) start();
  });
  await start();
  window.addEventListener('hashchange', route);
}
async function start() {
  $('#top').hidden = true;
  if (!S.user) {
    const { error } = await SB.auth.signInAnonymously();
    if (error) return showAuth(error.message);
    return; /* el cambio de sesión vuelve a llamar start() */
  }
  try {
    S.profile = (await q(SB.from('profiles').select('*').eq('id', S.user.id)))[0];
    if (!S.profile?.activo) return showSetup();
    const [areas, procesos, comps, descs, fuentes, ciclos, miembros, integrantes] = await Promise.all([
      q(SB.from('areas').select('*').order('id')),
      q(SB.from('procesos').select('*').order('id')),
      q(SB.from('componentes').select('*').order('id')),
      q(SB.from('descriptores').select('*')),
      q(SB.from('fuentes_evidencia').select('*')),
      q(SB.from('ciclos').select('*').order('anio', { ascending: false })),
      q(SB.from('equipo_miembros').select('*')),
      q(SB.from('integrantes').select('*').order('id'))
    ]);
    Object.assign(S, { areas, procesos, comps, fuentes, ciclos, miembros, integrantes });
    S.descs = {}; descs.forEach(d => { (S.descs[d.componente_id] ||= {})[d.nivel] = d.texto; });
    const saved = +lsGet('cicloId');
    S.ciclo = ciclos.find(c => c.id === saved) || ciclos[0] || null;
    $('#top').hidden = false;
    $('#who').textContent = S.profile.nombre || S.profile.email || '';
    $('#salir').textContent = S.profile.email ? 'Salir' : 'Cambiar de equipo';
    $('#cicloSel').innerHTML = ciclos.map(c => `<option value="${c.id}" ${S.ciclo?.id === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
    route();
  } catch (e) { $('#app').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

/* ---------- ingreso del equipo (sin cuentas) ---------- */
const brandHead = () => `<img class="authlogo" src="logo.png" alt="Escudo de la ${esc(INST.nombre)}">
    <h1>Mejoramiento institucional</h1>
    <p class="muted lema">${esc(INST.nombre)} · ${esc(INST.lema)}<br>Autoevaluación y plan de mejoramiento (Guía 34, MEN).</p>`;
async function showSetup() {
  $('#app').innerHTML = `<div class="auth card">${brandHead()}<p class="muted">Cargando…</p></div>`;
  let areas;
  try { areas = await q(SB.rpc('areas_inicio')); }
  catch (e) { return showAuth(e.message); }
  $('#app').innerHTML = `<div class="auth card">${brandHead()}
    <label for="su-area">1. Área de gestión de su equipo</label>
    <select id="su-area"><option value="">Elija el área…</option>${areas.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')}</select>
    <label for="su-nom">2. Docentes integrantes del equipo (uno por línea)</label>
    <textarea id="su-nom" rows="6" placeholder="Nombre Apellido&#10;Nombre Apellido"></textarea>
    <label>3. Líder del equipo</label>
    <div id="su-lid" class="small muted">Escriba los integrantes para elegir al líder.</div>
    <div id="a-msg" style="margin-top:10px"></div>
    <div class="row" style="margin-top:12px"><button class="primary" data-act="su-go" id="su-go">Comenzar autoevaluación</button></div>
    <p class="small" style="margin-top:14px;text-align:center"><a href="#" data-act="admin-login">Acceso de administrador</a></p>
  </div>`;
}
function suLideres(sel) {
  const nombres = [...new Set(val('su-nom').split('\n').map(x => x.trim()).filter(Boolean))];
  sel = sel ?? document.querySelector('input[name="su-lider"]:checked')?.value;
  $('#su-lid').innerHTML = nombres.length
    ? nombres.map(n => `<label class="opt ${n === sel ? 'sel' : ''}" style="margin:4px 0"><input type="radio" name="su-lider" value="${esc(n)}" ${n === sel ? 'checked' : ''}><div><b>${esc(n)}</b></div></label>`).join('')
    : 'Escriba los integrantes para elegir al líder.';
}
function showAuth(err) {
  const off = err && /anonymous/i.test(err);
  $('#app').innerHTML = `<div class="auth card">${brandHead()}
    ${err ? `<div class="err">${esc(off ? 'Falta activar el ingreso anónimo en Supabase (Authentication → Sign In / Providers → Allow anonymous sign-ins).' : err)}</div>` : ''}
    <h3 style="margin-top:14px">Acceso de administrador</h3>
    <form data-form="login">
      <label for="a-mail">Correo</label><input id="a-mail" type="email" autocomplete="email" required>
      <label for="a-pass">Contraseña</label><input id="a-pass" type="password" autocomplete="current-password" required>
      <div id="a-msg" style="margin-top:10px"></div>
      <div class="row" style="margin-top:12px"><button class="primary" id="a-go">Ingresar</button><button type="button" data-act="reload">Volver</button></div>
    </form></div>`;
}
async function doAuth() {
  const email = val('a-mail'), password = $('#a-pass').value, msg = $('#a-msg');
  msg.innerHTML = '';
  const { error } = await SB.auth.signInWithPassword({ email, password });
  if (error) msg.innerHTML = `<div class="err">${esc(error.message.includes('Invalid') ? 'Correo o contraseña incorrectos.' : error.message)}</div>`;
}

/* ---------- router ---------- */
const VIEWS = () => ({ inicio: vInicio, autoevaluacion: vAuto, perfil: vPerfil, oportunidades: vOpor, pmi: vPmi, seguimiento: vSeg, equipo: vEquipo, reportes: vReportes, contexto: vContexto, informe: vInforme });
const NAV = [['inicio', 'Inicio'], ['contexto', 'Contexto'], ['autoevaluacion', '1 · Autoevaluación'], ['perfil', 'Perfil institucional'], ['oportunidades', 'Fortalezas y oportunidades'], ['pmi', '2 · Plan de mejoramiento'], ['seguimiento', '3 · Seguimiento'], ['equipo', 'Equipos'], ['reportes', 'Reportes']];
async function route() {
  if (!S.user || !S.profile?.activo) return;
  const [r, arg] = (location.hash || '#/inicio').slice(2).split('/');
  const key = VIEWS()[r] && (r !== 'reportes' || isAdmin()) ? r : 'inicio';
  $('#nav').innerHTML = NAV.filter(([k]) => k !== 'reportes' || isAdmin()).map(([k, t]) => `<a href="#/${k}" class="${k === key ? 'on' : ''}">${t}</a>`).join('');
  $('#app').innerHTML = '<p class="muted">Cargando…</p>';
  if (!S.ciclo && key !== 'equipo') { $('#app').innerHTML = '<div class="note">No hay ciclos creados. Un administrador debe crear uno en “Equipos”.</div>'; return; }
  try { $('#app').innerHTML = await VIEWS()[key](arg); window.scrollTo(0, 0); }
  catch (e) { $('#app').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}
const areaTabs = (view, cur) => `<div class="tabs">${S.areas.map(a => `<a href="#/${view}/${a.id}" class="${a.id === cur ? 'on' : ''}">${canArea(a.id) ? '● ' : ''}${esc(a.nombre)}</a>`).join('')}</div>`;
const areaComps = a => S.comps.filter(c => S.procesos.find(p => p.id === c.proceso_id).area_id === a);
const stepper = () => {
  const et = ['autoevaluacion', 'plan', 'seguimiento', 'cerrado'], names = ['Autoevaluación', 'Plan de mejoramiento', 'Seguimiento', 'Cerrado'];
  return `<div class="row noprint" style="gap:.4rem">${et.map((e, i) => `<span class="badge ${S.ciclo.etapa === e ? 'b3' : 'b0'} fit">${i + 1}. ${names[i]}</span>`).join('')}</div>`;
};

/* ---------- INICIO ---------- */
async function vInicio() {
  const cid = S.ciclo.id;
  const [cons, opor, obj, acc] = await Promise.all([
    q(SB.from('consensos').select('componente_id').eq('ciclo_id', cid)),
    q(SB.from('fortalezas_oportunidades').select('area_id,tipo,priorizada').eq('ciclo_id', cid)),
    q(SB.from('objetivos').select('id,area_id').eq('ciclo_id', cid)),
    q(SB.from('acciones').select('avance,estado,metas!inner(objetivos!inner(area_id,ciclo_id))').eq('metas.objetivos.ciclo_id', cid))
  ]);
  const cards = S.areas.map(a => {
    const cs = areaComps(a.id), ids = new Set(cs.map(c => c.id));
    const conCons = cons.filter(c => ids.has(c.componente_id)).length;
    const ac = acc.filter(x => x.metas.objetivos.area_id === a.id);
    const avance = ac.length ? Math.round(ac.reduce((s, x) => s + x.avance, 0) / ac.length) : 0;
    const eq = equipoDe(a.id).map(i => i.nombre + (i.es_lider ? ' (líder)' : ''));
    const pct = (n, t) => t ? Math.round(100 * n / t) : 0;
    return `<div class="card"><h3>${esc(a.nombre)}</h3>
      <p class="small muted">${eq.length ? esc(eq.join(' · ')) : 'Sin integrantes asignados'}</p>
      <p class="small" style="margin:.5rem 0 .2rem">Componentes con nivel acordado: <b>${conCons}/${cs.length}</b></p><div class="bar"><i style="width:${pct(conCons, cs.length)}%"></i></div>
      <p class="small" style="margin:.5rem 0 .2rem">Oportunidades priorizadas: <b>${opor.filter(o => o.area_id === a.id && o.tipo === 'oportunidad' && o.priorizada).length}</b> · Objetivo: <b>${obj.some(o => o.area_id === a.id) ? 'definido' : 'pendiente'}</b></p>
      <p class="small" style="margin:.5rem 0 .2rem">Avance de acciones (${ac.length}): <b>${avance}%</b></p><div class="bar"><i style="width:${avance}%"></i></div>
      <div class="row noprint" style="margin-top:12px"><a class="btn" href="#/autoevaluacion/${a.id}">Autoevaluar</a><a class="btn" href="#/pmi/${a.id}">Plan</a>${isAdmin() && conCons === cs.length ? `<button data-act="gen-pdf" data-a="${a.id}">PDF del área</button>` : ''}</div></div>`;
  }).join('');
  return `<h1>${esc(S.ciclo.nombre)}</h1>${stepper()}
    <p class="muted" style="margin-top:12px">Ruta de la Guía 34: <b>autoevaluar</b> los 45 componentes con evidencias → <b>perfil institucional</b> → <b>priorizar</b> una oportunidad por área → <b>plan de mejoramiento anual</b> (objetivo, metas, indicadores, acciones) → <b>seguimiento</b> y aprendizajes para el siguiente ciclo.</p>
    <div class="grid g4" style="margin-top:14px">${cards}</div>`;
}

/* ---------- 1 · AUTOEVALUACIÓN ---------- */
async function vAuto(arg) {
  const aid = +arg || defaultArea(), area = S.areas.find(a => a.id === aid), cid = S.ciclo.id;
  const comps = areaComps(aid), ids = comps.map(c => c.id);
  const cons = await q(SB.from('consensos').select('*').eq('ciclo_id', cid).in('componente_id', ids));
  const edit = canArea(aid);
  const body = S.procesos.filter(p => p.area_id === aid).map(p => {
    const fu = S.fuentes.filter(f => f.proceso_id === p.id);
    const cards = comps.filter(c => c.proceso_id === p.id).map(c => {
      const con = cons.find(x => x.componente_id === c.id);
      const warn = con && con.nivel >= 3 && !(con.justificacion || '').trim() ? '<span class="badge bw">Falta describir evidencia</span>' : '';
      return `<details class="comp" id="comp-${c.id}" data-def="${con ? 1 : 0}">
        <summary><span class="t"><b>${c.orden}.</b> ${esc(c.nombre)}</span>${warn}${badge(con?.nivel, 'Sin definir')}</summary>
        <div class="comp-body">
          <h3>Nivel acordado por el equipo</h3>
          <div class="opts">${[1, 2, 3, 4].map(n => `<label class="opt ${con?.nivel === n ? 'sel' : ''}"><input type="radio" name="n-${c.id}" value="${n}" ${con?.nivel === n ? 'checked' : ''} ${edit ? '' : 'disabled'}><div><b>${n} · ${NIV[n]}</b><span>${esc(S.descs[c.id]?.[n])}</span></div></label>`).join('')}</div>
          <label for="cj-${c.id}">Descripción de la evidencia (¿qué documentos, registros o hechos respaldan este nivel?)</label>
          <textarea id="cj-${c.id}" ${edit ? '' : 'disabled'}>${esc(con?.justificacion)}</textarea>
          ${edit ? `<div style="margin-top:8px"><button class="primary" data-act="save-cons" data-c="${c.id}">Guardar y pasar al siguiente</button> ${con ? `<button class="ghost danger small" data-act="del-cons" data-c="${c.id}">Quitar</button>` : ''}</div>` : '<p class="small muted">Solo lectura: no perteneces a este equipo.</p>'}
        </div></details>`;
    }).join('');
    return `<section class="card"><h2>${esc(p.nombre)}</h2>${fu.length ? `<details class="small"><summary class="muted" style="cursor:pointer">Fuentes de evidencia sugeridas (Anexo 3 de la guía)</summary><ul>${fu.map(f => `<li><b>${esc(f.fuente)}:</b> ${esc(f.ejemplo)}</li>`).join('')}</ul></details>` : ''}${cards}</section>`;
  }).join('');
  const done = cons.length, total = comps.length, falta = total - done, eq = equipoDe(aid);
  const lv = id => cons.find(c => c.componente_id === id)?.nivel, nm = list => list.length ? `<ul class="small" style="margin:.3rem 0 0">${list.map(c => `<li>${esc(c.nombre)}${lv(c.id) ? ' ' + badge(lv(c.id)) : ''}</li>`).join('')}</ul>` : '<p class="small muted" style="margin:.3rem 0 0">Ninguno.</p>';
  const fin = falta === 0
    ? `<div class="card" style="margin:12px 0;border-color:var(--brand)"><h2>¡Autoevaluación completa!</h2><p class="muted" style="margin-top:0">Resumen de ${esc(area.nombre)}: los ${total} componentes tienen nivel acordado.</p>
        <div class="row" style="gap:.5rem">${[1, 2, 3, 4].map(k => `<div class="fit"><span class="badge b${k}">${k} · ${NIV[k]}</span> <b>${comps.filter(c => lv(c.id) === k).length}</b></div>`).join('')}</div>
        <div class="grid g2" style="margin-top:12px"><div><b>Fortalezas (nivel 4)</b>${nm(comps.filter(c => lv(c.id) === 4))}</div><div><b>Oportunidades de mejora (niveles 1 y 2)</b>${nm(comps.filter(c => lv(c.id) <= 2))}</div></div>
        <p class="small muted" style="margin-bottom:0">Siguiente paso: en “Fortalezas y oportunidades” priorizan una oportunidad y luego formulan el plan de mejoramiento.</p>
        ${isAdmin() ? `<div class="noprint" style="margin-top:10px"><button data-act="gen-pdf" data-a="${aid}">Generar PDF del área (administrador)</button></div>` : ''}</div>`
    : `<div class="card noprint" style="margin:12px 0"><div class="row" style="align-items:center"><div><b>Faltan ${falta} de ${total} componentes</b><div class="bar" style="margin-top:6px"><i style="width:${Math.round(100 * done / total)}%"></i></div></div><div class="fit"><button class="primary" data-act="next-comp">Ir al siguiente sin definir</button></div></div>${isAdmin() ? `<div style="margin-top:8px"><button data-act="gen-pdf" data-a="${aid}">Generar PDF parcial (administrador)</button></div>` : ''}</div>`;
  return `<h1>Autoevaluación</h1>${areaTabs('autoevaluacion', aid)}
    <p class="muted">${esc(area.nombre)} · ${done}/${total} componentes con nivel acordado.${eq.length ? ` Equipo: ${esc(eq.map(i => i.nombre + (i.es_lider ? ' (líder)' : '')).join(' · '))}.` : ''}</p>
    <p class="muted small">Para cada componente, lean los cuatro descriptores, acuerden el nivel (1 a 4) y describan la evidencia que lo respalda. Los niveles 3 y 4 requieren evidencia.</p>${fin}${body}`;
}
/* abre el siguiente componente sin nivel, a partir de uno dado (o desde el inicio) */
function openNext(fromId) {
  const all = $$('details.comp'); if (!all.length) return false;
  let start = fromId ? all.findIndex(d => d.id === 'comp-' + fromId) + 1 : 0;
  const ord = [...all.slice(start), ...all.slice(0, start)];
  const t = ord.find(d => d.dataset.def === '0');
  all.forEach(d => { d.open = false; });
  if (!t) return false;
  t.open = true; t.scrollIntoView({ block: 'start' }); return true;
}

/* ---------- PERFIL INSTITUCIONAL (Anexo 2) ---------- */
async function vPerfil() {
  const cid = S.ciclo.id;
  const prev = S.ciclos.filter(c => c.anio < S.ciclo.anio).sort((a, b) => b.anio - a.anio)[0];
  const [cons, pcons] = await Promise.all([
    q(SB.from('consensos').select('*').eq('ciclo_id', cid)),
    prev ? q(SB.from('consensos').select('*').eq('ciclo_id', prev.id)) : Promise.resolve([])
  ]);
  const lvl = id => cons.find(c => c.componente_id === id)?.nivel || 0;
  const ant = id => pcons.find(c => c.componente_id === id)?.nivel || 0;
  const mark = (n, k) => `<td class="c ${n === k ? 'l' + k : ''}">${n === k ? '●' : ''}</td>`;
  const sumRow = (label, list) => `<tr class="tot"><td colspan="2">${label}</td>${[1, 2, 3, 4].map(k => `<td class="c">${list.filter(id => lvl(id) === k).length}</td>`).join('')}<td class="small">${list.filter(id => lvl(id)).length}/${list.length} valorados</td></tr>`;
  let csv = 'Área;Proceso;Componente;Nivel acordado;Descripción de la evidencia;Ciclo anterior\n';
  const rows = S.areas.map(a => {
    const aIds = areaComps(a.id).map(c => c.id);
    const inner = S.procesos.filter(p => p.area_id === a.id).map(p => {
      const cs = S.comps.filter(c => c.proceso_id === p.id);
      return cs.map((c, i) => {
        csv += [a.nombre, p.nombre, c.nombre, lvl(c.id) || '', cons.find(x => x.componente_id === c.id)?.justificacion || '', ant(c.id) || ''].map(x => `"${String(x).replace(/"/g, '""')}"`).join(';') + '\n';
        const d = lvl(c.id) && ant(c.id) ? lvl(c.id) - ant(c.id) : null;
        return `<tr>${i === 0 ? `<td rowspan="${cs.length + 1}" style="width:22%">${esc(p.nombre)}</td>` : ''}<td>${esc(c.nombre)}</td>${[1, 2, 3, 4].map(k => mark(lvl(c.id), k)).join('')}<td class="c">${d === null ? '—' : (d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : '=')}</td></tr>`;
      }).join('') + sumRow('Total proceso', cs.map(c => c.id)).replace('<tr class="tot"><td colspan="2">', '<tr class="tot"><td>');
    }).join('');
    return `<tr><th colspan="7">${esc(a.nombre.toUpperCase())}</th></tr>${inner}${sumRow('TOTAL ÁREA', aIds).replace('<td colspan="2">', '<td colspan="2" style="text-align:right">')}`;
  }).join('');
  window.__csv = csv;
  const all = S.comps.map(c => c.id);
  const dist = [1, 2, 3, 4].map(k => all.filter(id => lvl(id) === k).length);
  return `${printHead('Perfil institucional')}<h1>Perfil institucional</h1>
    <p class="muted">Se genera solo a partir de los niveles acordados por los equipos (Anexo 2 de la guía). ${prev ? `Se compara con “${esc(prev.nombre)}”.` : 'Sin ciclo anterior para comparar.'}</p>
    <div class="row noprint" style="margin-bottom:12px"><div class="fit"><button data-act="csv">Descargar CSV</button></div><div class="fit"><button data-act="print">Imprimir / PDF</button></div></div>
    <div class="grid g4" style="margin-bottom:14px">${dist.map((n, i) => `<div class="card"><span class="badge b${i + 1}">${i + 1} · ${NIV[i + 1]}</span><div class="kpi">${n}</div><span class="muted small">de ${all.length} componentes</span></div>`).join('')}</div>
    <div class="tw"><table><thead><tr><th>Proceso</th><th>Componente</th>${[1, 2, 3, 4].map(k => `<th class="c" title="${NIV[k]}">${k}</th>`).join('')}<th>Δ</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small muted">1 Existencia · 2 Pertinencia · 3 Apropiación · 4 Mejoramiento continuo. Δ = cambio frente al ciclo anterior.</p>`;
}

/* ---------- FORTALEZAS Y OPORTUNIDADES ---------- */
async function vOpor(arg) {
  const aid = +arg || defaultArea(), cid = S.ciclo.id, edit = canArea(aid);
  const comps = areaComps(aid), ids = comps.map(c => c.id);
  const [fo, cons] = await Promise.all([
    q(SB.from('fortalezas_oportunidades').select('*').eq('ciclo_id', cid).eq('area_id', aid).order('created_at')),
    q(SB.from('consensos').select('*').eq('ciclo_id', cid).in('componente_id', ids))
  ]);
  const sug = k => comps.filter(c => { const n = cons.find(x => x.componente_id === c.id)?.nivel; return k === 'oportunidad' ? n && n <= 2 : n === 4; });
  const sugHtml = (k, title) => `<div class="card"><h3>${title}</h3>${sug(k).length ? `<ul class="list small">${sug(k).map(c => `<li>${badge(cons.find(x => x.componente_id === c.id).nivel)} ${esc(c.nombre)} ${edit ? `<button class="ghost small" data-act="fo-from" data-k="${k}" data-c="${c.id}">Agregar</button>` : ''}</li>`).join('')}</ul>` : '<p class="small muted">Se llenará cuando haya consensos.</p>'}</div>`;
  const list = k => fo.filter(f => f.tipo === k).map(f => `<li><div class="row" style="align-items:center"><div>${esc(f.descripcion)}<br><span class="small muted">${f.componentes_ids.map(i => esc(S.comps.find(c => c.id === i)?.nombre.slice(0, 50))).join(' · ')}</span></div>
    ${edit ? `<div class="fit">${k === 'oportunidad' ? `<label style="margin:0;display:flex;gap:6px;align-items:center;font-weight:400"><input type="checkbox" style="width:auto" data-act="fo-prio" data-id="${f.id}" ${f.priorizada ? 'checked' : ''}> Priorizada</label>` : ''}<button class="ghost danger small" data-act="fo-del" data-id="${f.id}">Eliminar</button></div>` : (f.priorizada ? '<div class="fit"><span class="badge b3">Priorizada</span></div>' : '')}</div></li>`).join('') || '<li class="muted small">Ninguna aún.</li>';
  return `<h1>Fortalezas y oportunidades de mejora</h1>${areaTabs('oportunidades', aid)}
    <p class="muted">Sugerencias automáticas desde los consensos: niveles 1–2 como oportunidades, nivel 4 como fortalezas. Agrupa componentes afines y marca como <b>priorizada</b> la oportunidad que irá al plan (la guía propone una por área).</p>
    <div class="grid g2">${sugHtml('oportunidad', 'Posibles oportunidades (niveles 1–2)')}${sugHtml('fortaleza', 'Posibles fortalezas (nivel 4)')}</div>
    <div class="grid g2"><div class="card"><h2>Oportunidades de mejora</h2><ul class="list">${list('oportunidad')}</ul></div><div class="card"><h2>Fortalezas</h2><ul class="list">${list('fortaleza')}</ul></div></div>
    ${edit ? `<div class="card"><h3>Agregar manualmente</h3><div class="row"><div class="fit"><select id="fo-t"><option value="oportunidad">Oportunidad</option><option value="fortaleza">Fortaleza</option></select></div><div style="flex:3 1 300px"><input id="fo-d" placeholder="Descripción"></div></div>
      <label for="fo-c">Componentes relacionados (Ctrl/Cmd para varios)</label><select id="fo-c" multiple size="6">${comps.map(c => `<option value="${c.id}">${esc(c.nombre.slice(0, 90))}</option>`).join('')}</select>
      <div style="margin-top:8px"><button class="primary" data-act="fo-add" data-a="${aid}">Agregar</button></div></div>` : ''}`;
}

/* ---------- 2 · PLAN DE MEJORAMIENTO ---------- */
async function vPmi(arg) {
  const aid = +arg || defaultArea(), cid = S.ciclo.id, edit = canArea(aid), coord = isCoord(aid);
  const [fo, fc, objs] = await Promise.all([
    q(SB.from('fortalezas_oportunidades').select('*').eq('ciclo_id', cid).eq('area_id', aid).eq('tipo', 'oportunidad').order('created_at')),
    q(SB.from('factores_criticos').select('*').eq('ciclo_id', cid).eq('area_id', aid).order('total', { ascending: false })),
    q(SB.from('objetivos').select('*').eq('ciclo_id', cid).eq('area_id', aid))
  ]);
  const obj = objs[0];
  const metas = obj ? await q(SB.from('metas').select('*').eq('objetivo_id', obj.id).order('id')) : [];
  const mids = metas.map(m => m.id);
  const [inds, accs] = mids.length ? await Promise.all([
    q(SB.from('indicadores').select('*').in('meta_id', mids).order('id')),
    q(SB.from('acciones').select('*').in('meta_id', mids).order('fecha_inicio'))
  ]) : [[], []];
  const sel5 = id => `<select id="${id}">${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join('')}</select>`;
  const yr = S.ciclo.anio, meses = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const gantt = a => `<table class="gantt"><tr>${meses.map((m, i) => { const ini = a.fecha_inicio ? localDate(a.fecha_inicio) : null, fin = a.fecha_fin ? localDate(a.fecha_fin) : null; const on = ini && fin && ini <= new Date(yr, i + 1, 0) && fin >= new Date(yr, i, 1); return `<td class="${on ? 'on' : ''}" title="${m}"></td>`; }).join('')}</tr></table>`;
  const total = accs.reduce((s, a) => s + Number(a.costo || 0), 0);
  const metaHtml = metas.map(m => {
    const mi = inds.filter(i => i.meta_id === m.id), ma = accs.filter(a => a.meta_id === m.id);
    return `<div class="card"><div class="row" style="align-items:center"><div><h3>Meta: ${esc(m.texto)}</h3><span class="small muted">${esc(m.fecha_inicio || '')} → ${esc(m.fecha_fin || '')}</span></div>${edit ? `<div class="fit"><button class="ghost danger small" data-act="del" data-t="metas" data-id="${m.id}">Eliminar meta</button></div>` : ''}</div>
      <h3 style="margin-top:12px">Indicadores</h3>
      ${mi.length ? `<div class="tw"><table><tr><th>Indicador</th><th>Tipo</th><th>Fórmula</th><th>Fuente</th><th>Periodicidad</th><th>Responsable</th><th>Meta</th><th></th></tr>${mi.map(i => `<tr><td>${esc(i.nombre)}</td><td>${esc(i.tipo)}</td><td>${esc(i.formula)}</td><td>${esc(i.fuente_datos)}</td><td>${esc(i.periodicidad)}</td><td>${esc(i.responsable)}</td><td>${i.meta_valor ?? ''} ${esc(i.unidad_medida)}</td><td>${edit ? `<button class="ghost danger small" data-act="del" data-t="indicadores" data-id="${i.id}">✕</button>` : ''}</td></tr>`).join('')}</table></div>` : '<p class="small muted">Sin indicadores.</p>'}
      ${edit ? `<details style="margin-top:6px"><summary style="cursor:pointer;color:var(--brand)">+ Agregar indicador</summary><div class="row"><div><label>Nombre</label><input id="in-n-${m.id}"></div><div class="fit"><label>Tipo</label><select id="in-t-${m.id}"><option>resultado</option><option>proceso</option></select></div><div><label>Fórmula</label><input id="in-f-${m.id}" placeholder="(a / b) × 100"></div></div>
        <div class="row"><div><label>Fuente de datos</label><input id="in-s-${m.id}"></div><div><label>Periodicidad</label><input id="in-p-${m.id}" placeholder="Mensual, bimestral…"></div><div><label>Responsable</label><input id="in-r-${m.id}"></div><div><label>Meta (valor)</label><input id="in-v-${m.id}" type="number" step="any"></div><div><label>Unidad</label><input id="in-u-${m.id}" placeholder="%"></div></div>
        <button class="primary" data-act="add-ind" data-m="${m.id}" style="margin-top:8px">Guardar indicador</button></details>` : ''}
      <h3 style="margin-top:14px">Acciones y cronograma ${yr}</h3>
      ${ma.length ? `<div class="tw"><table><tr><th>Acción</th><th>Responsable</th><th>Indicador</th><th>Costo</th><th>Fuente</th><th style="min-width:150px">${meses.join(' ')}</th><th></th></tr>${ma.map(a => `<tr><td>${esc(a.descripcion)}<br><span class="small muted">${esc(a.fecha_inicio || '')} → ${esc(a.fecha_fin || '')}</span></td><td>${esc(a.responsable_texto || '—')}</td><td>${esc(inds.find(i => i.id === a.indicador_id)?.nombre || '—')}</td><td>${money(a.costo)}</td><td>${esc(a.fuente_financiacion || '')}</td><td>${gantt(a)}</td><td>${edit ? `<button class="ghost danger small" data-act="del" data-t="acciones" data-id="${a.id}">✕</button>` : ''}</td></tr>`).join('')}</table></div>` : '<p class="small muted">Sin acciones.</p>'}
      ${edit ? `<details style="margin-top:6px"><summary style="cursor:pointer;color:var(--brand)">+ Agregar acción</summary><label>Descripción</label><input id="ac-d-${m.id}">
        <div class="row"><div><label>Responsable</label><input id="ac-r-${m.id}" list="dl-eq-${aid}" placeholder="Nombre del responsable"><datalist id="dl-eq-${aid}">${equipoDe(aid).map(i => `<option value="${esc(i.nombre)}">`).join('')}</datalist></div><div><label>Inicio</label><input type="date" id="ac-i-${m.id}"></div><div><label>Fin</label><input type="date" id="ac-f-${m.id}"></div></div>
        <div class="row"><div><label>Indicador asociado</label><select id="ac-x-${m.id}"><option value="">—</option>${mi.map(i => `<option value="${i.id}">${esc(i.nombre)}</option>`).join('')}</select></div><div><label>Costo estimado (COP)</label><input type="number" min="0" id="ac-c-${m.id}" value="0"></div><div><label>Fuente</label><select id="ac-s-${m.id}"><option value="">—</option><option>FSE</option><option>otra</option></select></div></div>
        <button class="primary" data-act="add-acc" data-m="${m.id}" style="margin-top:8px">Guardar acción</button></details>` : ''}</div>`;
  }).join('');
  return `${printHead('Plan de mejoramiento')}<h1>Plan de mejoramiento ${yr}</h1>${areaTabs('pmi', aid)}
    <p class="muted">${esc(S.areas.find(a => a.id === aid).nombre)} · Una oportunidad priorizada → un objetivo → metas medibles → indicadores y acciones con responsable, plazo y presupuesto.</p>
    <div class="row noprint" style="margin-bottom:10px"><div class="fit"><button data-act="print">Imprimir / PDF</button></div></div>
    <div class="card"><h2>A. Factor crítico (urgencia + tendencia + impacto)</h2>
      ${fc.length ? `<table><tr><th>Factor</th><th>U</th><th>T</th><th>I</th><th>Total</th><th></th></tr>${fc.map(f => `<tr><td>${esc(f.descripcion)}</td><td>${f.urgencia}</td><td>${f.tendencia}</td><td>${f.impacto}</td><td><b>${f.total}</b></td><td>${edit ? `<button class="ghost danger small" data-act="del" data-t="factores_criticos" data-id="${f.id}">✕</button>` : ''}</td></tr>`).join('')}</table>` : '<p class="small muted">Aún no hay factores calificados.</p>'}
      ${edit ? `<div class="row"><div style="flex:3 1 300px"><label>Oportunidad de mejora</label><select id="fc-o"><option value="">Escribir otro factor…</option>${fo.map(o => `<option value="${o.id}" ${o.priorizada ? 'selected' : ''}>${esc(o.descripcion.slice(0, 100))}</option>`).join('')}</select><input id="fc-x" placeholder="Si no eliges una oportunidad, descríbelo aquí" style="margin-top:6px"></div><div class="fit"><label>Urgencia</label>${sel5('fc-u')}</div><div class="fit"><label>Tendencia</label>${sel5('fc-t')}</div><div class="fit"><label>Impacto</label>${sel5('fc-i')}</div></div><button class="primary" data-act="add-fc" data-a="${aid}" style="margin-top:8px">Calificar factor</button>` : ''}</div>
    <div class="card"><h2>B. Objetivo del área</h2>
      ${obj ? `<p style="font-size:1.05rem">${esc(obj.texto)} ${obj.aprobado ? '<span class="badge b4">Aprobado</span>' : '<span class="badge b0">Sin aprobar</span>'}</p>` : '<p class="small muted">Aún sin objetivo.</p>'}
      ${edit ? `<textarea id="ob-t" placeholder="Objetivo: verbo + qué se mejora + para qué">${esc(obj?.texto)}</textarea><div class="row" style="margin-top:6px"><div class="fit"><button class="primary" data-act="save-obj" data-a="${aid}" data-id="${obj?.id || ''}">Guardar objetivo</button></div>${obj && coord ? `<div class="fit"><button data-act="apr-obj" data-id="${obj.id}" data-v="${!obj.aprobado}">${obj.aprobado ? 'Quitar aprobación' : 'Marcar aprobado'}</button></div>` : ''}</div>` : ''}</div>
    ${obj ? `<h2>C. Metas, indicadores y acciones</h2>${metaHtml}
      ${edit ? `<div class="card"><h3>Nueva meta</h3><label>Meta (medible)</label><input id="me-t"><div class="row"><div><label>Inicio</label><input type="date" id="me-i" value="${yr}-01-01"></div><div><label>Fin</label><input type="date" id="me-f" value="${yr}-12-31"></div></div><button class="primary" data-act="add-meta" data-o="${obj.id}" style="margin-top:8px">Agregar meta</button></div>` : ''}
      <div class="card"><b>Presupuesto del área:</b> ${money(total)}</div>` : '<div class="note">Define el objetivo para poder agregar metas, indicadores y acciones.</div>'}`;
}

/* ---------- 3 · SEGUIMIENTO ---------- */
async function vSeg(arg) {
  const cid = S.ciclo.id, fa = +arg || 0;
  const [accs, enc, dec, lec] = await Promise.all([
    q(SB.from('acciones').select('*,metas!inner(texto,objetivos!inner(area_id,ciclo_id))').eq('metas.objetivos.ciclo_id', cid).order('fecha_fin')),
    q(SB.from('encuentros_seguimiento').select('*').eq('ciclo_id', cid).order('fecha', { ascending: false })),
    q(SB.from('decisiones').select('*').eq('ciclo_id', cid).order('fecha', { ascending: false })),
    q(SB.from('lecciones').select('*').eq('ciclo_id', cid).order('created_at', { ascending: false }))
  ]);
  const sg = accs.length ? await q(SB.from('seguimientos').select('*').in('accion_id', accs.map(a => a.id)).order('fecha', { ascending: false })) : [];
  const list = accs.filter(a => !fa || a.metas.objetivos.area_id === fa);
  const filt = `<div class="tabs"><a href="#/seguimiento" class="${!fa ? 'on' : ''}">Todas</a>${S.areas.map(a => `<a href="#/seguimiento/${a.id}" class="${fa === a.id ? 'on' : ''}">${esc(a.nombre.replace('Gestión ', ''))}</a>`).join('')}</div>`;
  const accHtml = list.map(a => {
    const aid = a.metas.objetivos.area_id, hist = sg.filter(s => s.accion_id === a.id), last = hist[0], edit = canArea(aid);
    return `<div class="card"><div class="row" style="align-items:center"><div><b>${esc(a.descripcion)}</b><br><span class="small muted">${esc(S.areas.find(x => x.id === aid).nombre)} · Meta: ${esc(a.metas.texto)} · ${esc(a.fecha_inicio || '')} → ${esc(a.fecha_fin || '')}</span></div><div class="fit">${last ? `<span class="sem ${last.semaforo}"></span>${last.semaforo}` : '<span class="badge b0">sin seguimiento</span>'}</div></div>
      <div class="bar" style="margin:8px 0"><i style="width:${a.avance}%"></i></div><span class="small">${a.avance}% · ${esc(a.estado.replace('_', ' '))}</span>
      ${hist.length ? `<ul class="list small">${hist.slice(0, 3).map(s => `<li><span class="sem ${s.semaforo}"></span><b>${esc(s.fecha)}</b> · ${s.avance ?? ''}% · ${esc(s.tipo_evidencia || '')} — ${esc(s.descripcion)} ${s.dificultades ? `<br><span class="muted">Dificultades: ${esc(s.dificultades)}</span>` : ''} ${s.evidencia_url ? `<a href="${esc(s.evidencia_url)}" target="_blank" rel="noopener">evidencia</a>` : ''}</li>`).join('')}</ul>` : ''}
      ${edit ? `<details><summary style="cursor:pointer;color:var(--brand)">+ Registrar seguimiento</summary>
        <div class="row"><div class="fit"><label>Fecha</label><input type="date" id="sg-f-${a.id}" value="${today()}"></div><div class="fit"><label>Avance %</label><input type="number" min="0" max="100" id="sg-a-${a.id}" value="${a.avance}"></div><div class="fit"><label>Semáforo</label><select id="sg-s-${a.id}"><option>verde</option><option>amarillo</option><option>rojo</option></select></div><div class="fit"><label>Tipo de evidencia</label><select id="sg-t-${a.id}"><option value="proceso">Proceso</option><option value="resultado">Resultado</option><option value="percepcion">Percepción</option><option value="aprendizaje">Aprendizaje</option></select></div></div>
        <label>Qué se hizo</label><textarea id="sg-d-${a.id}" style="min-height:56px"></textarea><div class="row"><div><label>Dificultades</label><input id="sg-x-${a.id}"></div><div><label>Enlace a evidencia</label><input type="url" id="sg-u-${a.id}"></div></div>
        <button class="primary" data-act="add-seg" data-id="${a.id}" style="margin-top:8px">Guardar seguimiento</button></details>` : ''}</div>`;
  }).join('') || '<div class="note">Aún no hay acciones. Se crean en “2 · Plan de mejoramiento”.</div>';
  const canTeam = isAdmin() || myAreas().length > 0;
  const simple = (title, items, fmt, form) => `<div class="card"><h2>${title}</h2><ul class="list small">${items.map(fmt).join('') || '<li class="muted">Sin registros.</li>'}</ul>${canTeam ? form : ''}</div>`;
  return `<h1>Seguimiento y aprendizajes</h1>${filt}${accHtml}
    <div class="grid g2">
    ${simple('Encuentros de seguimiento', enc, e => `<li><b>${esc(e.fecha)}</b> · ${esc(e.tema)}<br><span class="muted">${esc(e.agenda)}</span><br>${esc(e.acta)}</li>`, `<details><summary style="cursor:pointer;color:var(--brand)">+ Registrar encuentro</summary><label>Fecha</label><input type="date" id="en-f" value="${today()}"><label>Tema</label><input id="en-t"><label>Agenda</label><textarea id="en-a" style="min-height:48px"></textarea><label>Acta / acuerdos</label><textarea id="en-c" style="min-height:48px"></textarea><button class="primary" data-act="add-enc" style="margin-top:8px">Guardar</button></details>`)}
    ${simple('Decisiones y ajustes al plan', dec, d => `<li><b>${esc(d.fecha)}</b> · ${esc(S.areas.find(a => a.id === d.area_id)?.nombre || 'Institucional')}<br>${esc(d.decision)}<br><span class="muted">${esc(d.justificacion)}</span></li>`, `<details><summary style="cursor:pointer;color:var(--brand)">+ Registrar decisión</summary><label>Área</label><select id="de-a"><option value="">Institucional</option>${S.areas.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')}</select><label>Decisión</label><textarea id="de-d" style="min-height:48px"></textarea><label>Justificación</label><input id="de-j"><button class="primary" data-act="add-dec" style="margin-top:8px">Guardar</button></details>`)}
    </div>
    ${simple('Lecciones aprendidas (insumo del siguiente ciclo)', lec, l => `<li><span class="badge b3">${esc(l.tipo.replace('_', ' '))}</span> ${esc(S.areas.find(a => a.id === l.area_id)?.nombre || 'Institucional')} — ${esc(l.texto)}</li>`, `<details><summary style="cursor:pointer;color:var(--brand)">+ Registrar lección</summary><div class="row"><div><label>Tipo</label><select id="le-t"><option value="aprendizaje">Aprendizaje</option><option value="buena_practica">Buena práctica</option><option value="dificultad">Dificultad</option><option value="reto_proximo_ciclo">Reto próximo ciclo</option></select></div><div><label>Área</label><select id="le-a"><option value="">Institucional</option>${S.areas.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')}</select></div></div><label>Descripción</label><textarea id="le-x" style="min-height:48px"></textarea><button class="primary" data-act="add-lec" style="margin-top:8px">Guardar</button></details>`)}`;
}

/* ---------- EQUIPOS / ADMIN ---------- */
async function vEquipo() {
  const adm = isAdmin();
  const cards = S.areas.map(a => {
    const eq = equipoDe(a.id), ed = canArea(a.id);
    return `<div class="card"><h3>${esc(a.nombre)}</h3>
      <ul class="list small">${eq.map(i => `<li>${esc(i.nombre)} ${i.es_lider ? '<span class="badge b4">Líder</span>' : ''} ${ed ? `${i.es_lider ? '' : `<button class="ghost small" data-act="int-lider" data-id="${i.id}" data-a="${a.id}">Hacer líder</button>`}<button class="ghost danger small" data-act="int-del" data-id="${i.id}">Quitar</button>` : ''}</li>`).join('') || '<li class="muted">Sin integrantes registrados.</li>'}</ul>
      ${ed ? `<div class="row"><div><input id="int-n-${a.id}" placeholder="Nombre del docente"></div><div class="fit"><button data-act="int-add" data-a="${a.id}">Agregar</button></div></div>` : ''}</div>`;
  }).join('');
  const ciclos = S.ciclos.map(c => `<tr><td>${esc(c.nombre)}</td><td>${c.anio}</td><td>${adm ? `<select data-act="etapa" data-id="${c.id}">${[['autoevaluacion', 'Autoevaluación'], ['plan', 'Plan de mejoramiento'], ['seguimiento', 'Seguimiento'], ['cerrado', 'Cerrado']].map(([v, t]) => `<option value="${v}" ${c.etapa === v ? 'selected' : ''}>${t}</option>`).join('')}</select>` : esc(c.etapa)}</td></tr>`).join('');
  return `<h1>Equipos de gestión</h1>
    <p class="muted">Integrantes de los cuatro equipos. Cada equipo puede ajustar su lista y cambiar de líder.</p>
    <div class="grid g4">${cards}</div>
    <div class="card"><h2>Ciclos</h2><table><tr><th>Nombre</th><th>Año</th><th>Etapa</th></tr>${ciclos}</table>
    ${adm ? `<h3 style="margin-top:14px">Nuevo ciclo</h3><div class="row"><div><label>Nombre</label><input id="ci-n" placeholder="Ruta de mejoramiento 2027"></div><div class="fit"><label>Año</label><input id="ci-a" type="number" value="${(S.ciclos[0]?.anio || 2025) + 1}"></div><div class="fit"><button class="primary" data-act="add-ciclo">Crear ciclo</button></div></div>` : '<p class="small muted">Solo el administrador cambia la etapa del ciclo.</p>'}</div>`;
}

/* ---------- CONTEXTO ---------- */
const CAT = { institucional: 'Institucional', social: 'Social', economica: 'Económico', cultural: 'Cultural', ambiental: 'Ambiental', pedagogica: 'Pedagógico', otra: 'Otro' };
async function vContexto() {
  const items = await q(SB.from('contexto_hallazgos').select('*').eq('ciclo_id', S.ciclo.id).order('id'));
  const canEdit = isAdmin() || S.miembros.some(m => m.user_id === S.user.id);
  const catSel = id => `<select id="ct-c-${id}">${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`;
  const form = (id, it) => `<div class="row"><div><label>Título</label><input id="ct-t-${id}" value="${esc(it?.titulo)}"></div><div class="fit"><label>Categoría</label>${catSel(id).replace(`value="${it?.categoria}"`, `value="${it?.categoria}" selected`)}</div></div>
    <label>Descripción</label><textarea id="ct-d-${id}" style="min-height:90px">${esc(it?.descripcion)}</textarea><label>Fuente</label><input id="ct-f-${id}" value="${esc(it?.fuente)}">
    <div style="margin-top:8px"><button class="primary" data-act="ctx-save" data-id="${id}">Guardar</button></div>`;
  const list = items.map(it => `<div class="card"><div class="row" style="align-items:center"><div><span class="badge b0">${esc(CAT[it.categoria] || it.categoria)}</span> <b>${esc(it.titulo)}</b></div>${canEdit ? `<div class="fit"><button class="ghost danger small" data-act="ctx-del" data-id="${it.id}">Eliminar</button></div>` : ''}</div>
    <p style="margin:.4rem 0">${esc(it.descripcion)}</p><p class="small muted" style="margin:0">${esc(it.fuente)}</p>
    ${canEdit ? `<details style="margin-top:6px"><summary style="cursor:pointer;color:var(--brand)">Editar</summary>${form(it.id, it)}</details>` : ''}</div>`).join('') || '<div class="note">Aún no hay elementos de contexto.</div>';
  return `<h1>Contexto institucional</h1>
    <p class="muted">Punto de partida de la autoevaluación (Guía 34): quiénes somos, dónde estamos y qué retos tenemos. Se precargó con lo más relevante del PEI 2026; cada equipo puede corregirlo o ampliarlo.</p>
    <div class="grid g2">${list}</div>
    ${canEdit ? `<div class="card"><h3>Agregar elemento de contexto</h3>${form('new', null)}</div>` : ''}`;
}

/* ---------- INFORMES (se imprimen / guardan como PDF) ---------- */
const nivCount = (ids, cons) => [1, 2, 3, 4].map(k => ids.filter(id => cons.find(c => c.componente_id === id)?.nivel === k).length);
async function vInforme(arg) {
  const general = arg === 'general';
  if (!isAdmin()) return '<div class="err">Solo el administrador genera los informes en PDF.</div>';
  const areas = general ? S.areas : S.areas.filter(a => a.id === +arg);
  if (!areas.length) return '<div class="err">Área no encontrada.</div>';
  const cid = S.ciclo.id;
  const [cons, fo, objs, metas, inds, accs, ctx] = await Promise.all([
    q(SB.from('consensos').select('*').eq('ciclo_id', cid)),
    q(SB.from('fortalezas_oportunidades').select('*').eq('ciclo_id', cid)),
    q(SB.from('objetivos').select('*').eq('ciclo_id', cid)),
    q(SB.from('metas').select('*').order('id')), q(SB.from('indicadores').select('*').order('id')), q(SB.from('acciones').select('*').order('id')),
    q(SB.from('contexto_hallazgos').select('*').eq('ciclo_id', cid).order('id'))
  ]);
  const fecha = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  const titulo = general ? 'Informe general de autoevaluación y plan de mejoramiento' : 'Resumen de autoevaluación · ' + areas[0].nombre;
  const nivBadge = n => n ? `<span class="badge b${n}">${n} · ${NIV[n]}</span>` : '<span class="badge b0">Sin definir</span>';
  const sec = a => {
    const cs = areaComps(a.id), ids = cs.map(c => c.id), d = nivCount(ids, cons), def = d.reduce((x, y) => x + y, 0), eq = equipoDe(a.id);
    const lvl = id => cons.find(c => c.componente_id === id);
    const proc = S.procesos.filter(p => p.area_id === a.id).map(p => `<h3>${esc(p.nombre)}</h3><table><tr><th style="width:34%">Componente</th><th style="width:15%">Nivel</th><th>Descripción de la evidencia</th></tr>${cs.filter(c => c.proceso_id === p.id).map(c => `<tr><td>${esc(c.nombre)}</td><td>${nivBadge(lvl(c.id)?.nivel)}</td><td class="small">${esc(lvl(c.id)?.justificacion || '')}</td></tr>`).join('')}</table>`).join('');
    const fort = cs.filter(c => lvl(c.id)?.nivel === 4), opor = cs.filter(c => lvl(c.id)?.nivel && lvl(c.id).nivel <= 2);
    const prio = fo.filter(f => f.area_id === a.id && f.tipo === 'oportunidad' && f.priorizada);
    const ob = objs.find(o => o.area_id === a.id), ms = ob ? metas.filter(m => m.objetivo_id === ob.id) : [];
    const plan = ob ? `<h3>Objetivo</h3><p>${esc(ob.texto)}</p>${ms.map(m => { const mi = inds.filter(i => i.meta_id === m.id), ma = accs.filter(x => x.meta_id === m.id); return `<p><b>Meta:</b> ${esc(m.texto)} <span class="small muted">${esc(m.fecha_inicio || '')} → ${esc(m.fecha_fin || '')}</span></p>${mi.length ? `<p class="small"><b>Indicadores:</b> ${mi.map(i => esc(i.nombre) + (i.meta_valor != null ? ` (meta ${i.meta_valor} ${esc(i.unidad_medida || '')})` : '')).join('; ')}</p>` : ''}${ma.length ? `<table><tr><th>Acción</th><th>Responsable</th><th>Fechas</th><th>Costo</th><th>Avance</th></tr>${ma.map(x => `<tr><td>${esc(x.descripcion)}</td><td>${esc(x.responsable_texto || '')}</td><td class="small">${esc(x.fecha_inicio || '')} → ${esc(x.fecha_fin || '')}</td><td>${money(x.costo)}</td><td>${x.avance}%</td></tr>`).join('')}</table>` : ''}`; }).join('')}` : '<p class="muted">Aún no se ha formulado el plan de mejoramiento de esta área.</p>';
    return `<section class="${general ? 'pb' : ''}"><h2>${esc(a.nombre)}</h2>
      <p class="small"><b>Equipo:</b> ${eq.length ? esc(eq.map(i => i.nombre + (i.es_lider ? ' (líder)' : '')).join(', ')) : 'sin registrar'}</p>
      <p><b>Componentes con nivel acordado:</b> ${def}/${cs.length} · ${[1, 2, 3, 4].map(k => `<span class="badge b${k}">${NIV[k]}: ${d[k - 1]}</span>`).join(' ')}</p>
      <h3>Autoevaluación por componente</h3>${proc}
      <h3>Fortalezas (nivel 4)</h3>${fort.length ? `<ul>${fort.map(c => `<li>${esc(c.nombre)}</li>`).join('')}</ul>` : '<p class="muted small">Ninguna componente en nivel 4.</p>'}
      <h3>Oportunidades de mejora (niveles 1 y 2)</h3>${opor.length ? `<ul>${opor.map(c => `<li>${esc(c.nombre)} ${nivBadge(lvl(c.id).nivel)}</li>`).join('')}</ul>` : '<p class="muted small">Ninguna componente en niveles 1 o 2.</p>'}
      ${prio.length ? `<p><b>Oportunidad priorizada para el plan:</b> ${prio.map(f => esc(f.descripcion)).join('; ')}</p>` : ''}
      <h3>Plan de mejoramiento</h3>${plan}</section>`;
  };
  const resumen = general ? `<h2>Resumen institucional</h2><table><tr><th>Área de gestión</th>${[1, 2, 3, 4].map(k => `<th class="c">${k} · ${NIV[k]}</th>`).join('')}<th class="c">Sin definir</th></tr>${areas.map(a => { const ids = areaComps(a.id).map(c => c.id), d = nivCount(ids, cons); return `<tr><td>${esc(a.nombre)}</td>${d.map(n => `<td class="c">${n}</td>`).join('')}<td class="c">${ids.length - d.reduce((x, y) => x + y, 0)}</td></tr>`; }).join('')}${(() => { const ids = S.comps.map(c => c.id), d = nivCount(ids, cons); return `<tr class="tot"><td>TOTAL (${ids.length} componentes)</td>${d.map(n => `<td class="c">${n}</td>`).join('')}<td class="c">${ids.length - d.reduce((x, y) => x + y, 0)}</td></tr>`; })()}</table>` : '';
  const contexto = ctx.length ? `<h2>Contexto institucional</h2>${ctx.map(i => `<p class="small" style="margin:.3rem 0"><b>${esc(i.titulo)}.</b> ${esc(i.descripcion)}</p>`).join('')}` : '';
  S.pdfName = (general ? 'Informe-general-' : 'Resumen-' + areas[0].nombre.replace(/[^\wÁÉÍÓÚÑáéíóúñ]+/g, '-') + '-') + S.ciclo.anio;
  if (S.autoPrint) { S.autoPrint = false; setTimeout(() => { const t = document.title; document.title = S.pdfName; window.print(); document.title = t; }, 700); }
  return `<div class="row noprint" style="margin-bottom:12px"><div class="fit"><button class="primary" data-act="print">Imprimir / Guardar como PDF</button></div><div class="fit"><button data-act="volver">Volver</button></div></div>
    <div class="informe">${printHead(titulo)}<p class="muted small">${esc(S.ciclo.nombre)} · generado el ${esc(fecha)}</p>${resumen}${general ? contexto : ''}${areas.map(sec).join('')}${general ? '' : contexto}</div>`;
}

/* ---------- REPORTES (administrador) ---------- */
const csvCell = x => `"${String(x ?? '').replace(/"/g, '""')}"`;
function csvDown(nombre, filas) {
  const txt = '﻿' + filas.map(f => f.map(csvCell).join(';')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = nombre; a.click();
}
async function vReportes() {
  const cid = S.ciclo.id;
  const [cons, fo, objs, metas, inds, accs] = await Promise.all([
    q(SB.from('consensos').select('*').eq('ciclo_id', cid)),
    q(SB.from('fortalezas_oportunidades').select('*').eq('ciclo_id', cid)),
    q(SB.from('objetivos').select('*').eq('ciclo_id', cid)),
    q(SB.from('metas').select('*')), q(SB.from('indicadores').select('*')), q(SB.from('acciones').select('*'))
  ]);
  const pct = (n, t) => t ? Math.round(100 * n / t) : 0;
  const filasAuto = [['Área', 'Proceso', 'Componente', 'Nivel acordado', 'Nivel', 'Descripción de la evidencia']];
  const filasPlan = [['Área', 'Objetivo', 'Meta', 'Indicadores', 'Acción', 'Responsable', 'Inicio', 'Fin', 'Costo (COP)', 'Fuente', 'Avance %', 'Estado']];
  const filasEq = [['Área', 'Integrante', 'Líder']];
  const resumen = S.areas.map(a => {
    const cs = areaComps(a.id), ids = new Set(cs.map(c => c.id));
    const cA = cons.filter(c => ids.has(c.componente_id)), conEv = cA.filter(c => (c.justificacion || '').trim()).length;
    const sinEv = cA.filter(c => c.nivel >= 3 && !(c.justificacion || '').trim()).length;
    cs.forEach(c => {
      const pr = S.procesos.find(x => x.id === c.proceso_id), con = cons.find(x => x.componente_id === c.id);
      filasAuto.push([a.nombre, pr.nombre, c.nombre, con?.nivel || '', con ? NIV[con.nivel] : 'Sin definir', con?.justificacion || '']);
    });
    equipoDe(a.id).forEach(i => filasEq.push([a.nombre, i.nombre, i.es_lider ? 'Sí' : '']));
    const oA = objs.filter(o => o.area_id === a.id);
    oA.forEach(o => metas.filter(m => m.objetivo_id === o.id).forEach(m => {
      const mi = inds.filter(i => i.meta_id === m.id).map(i => i.nombre).join(' | '), ma = accs.filter(x => x.meta_id === m.id);
      (ma.length ? ma : [null]).forEach(x => filasPlan.push([a.nombre, o.texto, m.texto, mi, x?.descripcion || '', x?.responsable_texto || '', x?.fecha_inicio || '', x?.fecha_fin || '', x?.costo ?? '', x?.fuente_financiacion || '', x?.avance ?? '', x?.estado || '']));
    }));
    const aA = accs.filter(x => oA.some(o => metas.some(m => m.id === x.meta_id && m.objetivo_id === o.id)));
    const avance = aA.length ? Math.round(aA.reduce((t, x) => t + x.avance, 0) / aA.length) : 0;
    return { a, n: cs.length, con: cA.length, ev: conEv, sinEv, prio: fo.filter(f => f.area_id === a.id && f.tipo === 'oportunidad' && f.priorizada).length, obj: oA.length, acc: aA.length, avance };
  });
  window.__rep = { filasAuto, filasPlan, filasEq };
  const detalle = S.areas.map(a => {
    const filas = filasAuto.filter(f => f[0] === a.nombre);
    return `<section class="card"><h2>${esc(a.nombre)}</h2><div class="tw"><table><tr><th>Proceso</th><th>Componente</th><th>Nivel</th><th>Descripción de la evidencia</th></tr>${filas.map(f => `<tr><td>${esc(f[1])}</td><td>${esc(f[2])}</td><td>${f[3] ? badge(f[3]) : '<span class="muted">—</span>'}</td><td class="small">${esc(f[5])}</td></tr>`).join('')}</table></div></section>`;
  }).join('');
  return `${printHead('Reporte del proceso de autoevaluación')}<h1>Reportes</h1>
    <p class="muted">${esc(S.ciclo.nombre)} · estado actual de los cuatro equipos. Los equipos guardan su avance en la base de datos, así que pueden continuar en cualquier sesión.</p>
    <div class="row noprint" style="margin-bottom:12px"><div class="fit"><button data-act="rep-auto">Descargar autoevaluación (CSV)</button></div><div class="fit"><button data-act="rep-plan">Descargar plan de mejoramiento (CSV)</button></div><div class="fit"><button data-act="rep-eq">Descargar equipos (CSV)</button></div><div class="fit"><button class="primary" data-act="gen-pdf" data-a="general">Generar informe general (PDF)</button></div></div>
    <div class="card tw"><table><tr><th>Área</th><th>Niveles acordados</th><th>Con evidencia descrita</th><th>Nivel 3–4 sin describir</th><th>Oportunidades priorizadas</th><th>Objetivo</th><th>Acciones</th><th>Avance</th></tr>
    ${resumen.map(r => `<tr><td>${esc(r.a.nombre)}</td><td>${r.con}/${r.n} (${pct(r.con, r.n)}%)</td><td>${r.ev}</td><td>${r.sinEv ? `<span class="badge bw">${r.sinEv}</span>` : 0}</td><td>${r.prio}</td><td>${r.obj ? 'Definido' : 'Pendiente'}</td><td>${r.acc}</td><td>${r.avance}%</td></tr>`).join('')}</table></div>
    ${detalle}`;
}

/* ---------- acciones ---------- */
const ACT = {
  'admin-login': () => showAuth(),
  'rep-auto': () => csvDown(`autoevaluacion-${S.ciclo.anio}.csv`, window.__rep.filasAuto),
  'rep-plan': () => csvDown(`plan-mejoramiento-${S.ciclo.anio}.csv`, window.__rep.filasPlan),
  'rep-eq': () => csvDown(`equipos-${S.ciclo.anio}.csv`, window.__rep.filasEq),
  async 'su-go'() {
    const area = +val('su-area'), msg = $('#a-msg'); msg.innerHTML = '';
    const nombres = val('su-nom').split('\n').map(x => x.trim()).filter(Boolean), lider = document.querySelector('input[name="su-lider"]:checked')?.value;
    if (!area) { msg.innerHTML = '<div class="err">Elija el área de gestión.</div>'; return; }
    if (!nombres.length) { msg.innerHTML = '<div class="err">Escriba al menos un integrante.</div>'; return; }
    if (!lider) { msg.innerHTML = '<div class="err">Marque quién es el líder del equipo.</div>'; return; }
    try { await q(SB.rpc('iniciar_equipo', { p_area: area, p_nombres: nombres, p_lider: lider })); }
    catch (e) { msg.innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
    location.hash = '#/autoevaluacion/' + area; await start();
  },
  logout: async () => { await SB.auth.signOut(); },
  reload: () => start(),
  print: () => window.print(),
  csv: () => { const b = new Blob(['﻿' + window.__csv], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `perfil-institucional-${S.ciclo.anio}.csv`; a.click(); },
  async 'save-cons'(el) {
    const c = +el.dataset.c, n = +(document.querySelector(`input[name="n-${c}"]:checked`)?.value || 0); if (!n) return toast('Elige el nivel acordado', true);
    await q(SB.from('consensos').upsert({ ciclo_id: S.ciclo.id, componente_id: c, nivel: n, justificacion: val('cj-' + c), updated_at: new Date().toISOString() }, { onConflict: 'ciclo_id,componente_id' }));
    toast('Nivel guardado'); await route();
    if (!openNext(c)) toast('Todos los componentes de esta área tienen nivel acordado');
  },
  async 'del-cons'(el) { const c = +el.dataset.c; await q(SB.from('consensos').delete().eq('ciclo_id', S.ciclo.id).eq('componente_id', c)); await refresh(c); },
  async 'ctx-save'(el) {
    const id = el.dataset.id, t = val('ct-t-' + id); if (!t) return toast('Escribe el título', true);
    const row = { titulo: t, categoria: val('ct-c-' + id), descripcion: val('ct-d-' + id) || null, fuente: val('ct-f-' + id) || null };
    if (id === 'new') await q(SB.from('contexto_hallazgos').insert({ ...row, ciclo_id: S.ciclo.id })); else await q(SB.from('contexto_hallazgos').update(row).eq('id', +id));
    toast('Contexto guardado'); route();
  },
  async 'ctx-del'(el) { await q(SB.from('contexto_hallazgos').delete().eq('id', +el.dataset.id)); route(); },
  'next-comp': () => { if (!openNext(null)) toast('No hay componentes sin definir'); },
  'gen-pdf'(el) { S.autoPrint = true; location.hash = '#/informe/' + el.dataset.a; },
  'volver'() { history.length > 1 ? history.back() : (location.hash = '#/inicio'); },
  async 'fo-from'(el) {
    const c = +el.dataset.c, comp = S.comps.find(x => x.id === c);
    await q(SB.from('fortalezas_oportunidades').insert({ ciclo_id: S.ciclo.id, area_id: areaOf(c), tipo: el.dataset.k, descripcion: comp.nombre, componentes_ids: [c] })); toast('Agregado'); route();
  },
  async 'fo-add'(el) {
    const d = val('fo-d'); if (!d) return toast('Escribe la descripción', true);
    const ids = [...$('#fo-c').selectedOptions].map(o => +o.value);
    await q(SB.from('fortalezas_oportunidades').insert({ ciclo_id: S.ciclo.id, area_id: +el.dataset.a, tipo: val('fo-t'), descripcion: d, componentes_ids: ids })); route();
  },
  async 'fo-del'(el) { await q(SB.from('fortalezas_oportunidades').delete().eq('id', el.dataset.id)); route(); },
  async 'add-fc'(el) {
    const sel = val('fc-o'), a = +el.dataset.a, d = sel ? $('#fc-o').selectedOptions[0].textContent : val('fc-x');
    if (!d) return toast('Elige una oportunidad o escribe el factor crítico', true);
    await q(SB.from('factores_criticos').insert({ ciclo_id: S.ciclo.id, area_id: a, oportunidad_id: sel ? +sel : null, descripcion: d, urgencia: +val('fc-u'), tendencia: +val('fc-t'), impacto: +val('fc-i') })); route();
  },
  async 'save-obj'(el) {
    const t = val('ob-t'); if (!t) return toast('Escribe el objetivo', true);
    if (el.dataset.id) await q(SB.from('objetivos').update({ texto: t }).eq('id', el.dataset.id));
    else await q(SB.from('objetivos').insert({ ciclo_id: S.ciclo.id, area_id: +el.dataset.a, texto: t }));
    toast('Objetivo guardado'); route();
  },
  async 'apr-obj'(el) { await q(SB.from('objetivos').update({ aprobado: el.dataset.v === 'true' }).eq('id', el.dataset.id)); route(); },
  async 'add-meta'(el) {
    const t = val('me-t'); if (!t) return toast('Escribe la meta', true);
    await q(SB.from('metas').insert({ objetivo_id: +el.dataset.o, texto: t, fecha_inicio: val('me-i') || null, fecha_fin: val('me-f') || null })); route();
  },
  async 'add-ind'(el) {
    const m = el.dataset.m, n = val('in-n-' + m); if (!n) return toast('Escribe el nombre del indicador', true);
    await q(SB.from('indicadores').insert({ meta_id: +m, nombre: n, tipo: val('in-t-' + m), formula: val('in-f-' + m) || null, fuente_datos: val('in-s-' + m) || null, periodicidad: val('in-p-' + m) || null, responsable: val('in-r-' + m) || null, meta_valor: num(val('in-v-' + m)), unidad_medida: val('in-u-' + m) || null })); route();
  },
  async 'add-acc'(el) {
    const m = el.dataset.m, d = val('ac-d-' + m); if (!d) return toast('Describe la acción', true);
    const ini = val('ac-i-' + m), fin = val('ac-f-' + m); if (ini && fin && fin < ini) return toast('La fecha final es anterior a la inicial', true);
    await q(SB.from('acciones').insert({ meta_id: +m, descripcion: d, responsable_texto: val('ac-r-' + m) || null, fecha_inicio: ini || null, fecha_fin: fin || null, indicador_id: num(val('ac-x-' + m)), costo: num(val('ac-c-' + m)) || 0, fuente_financiacion: val('ac-s-' + m) || null })); route();
  },
  async del(el) { if (!confirm('¿Eliminar este registro y lo que depende de él?')) return; await q(SB.from(el.dataset.t).delete().eq('id', el.dataset.id)); route(); },
  async 'add-seg'(el) {
    const id = +el.dataset.id, av = Math.max(0, Math.min(100, +val('sg-a-' + id) || 0));
    await q(SB.from('seguimientos').insert({ accion_id: id, fecha: val('sg-f-' + id) || today(), avance: av, semaforo: val('sg-s-' + id), tipo_evidencia: val('sg-t-' + id), descripcion: val('sg-d-' + id) || null, dificultades: val('sg-x-' + id) || null, evidencia_url: val('sg-u-' + id) || null }));
    await q(SB.from('acciones').update({ avance: av, estado: av >= 100 ? 'completada' : av > 0 ? 'en_curso' : 'pendiente' }).eq('id', id));
    toast('Seguimiento registrado'); route();
  },
  async 'add-enc'() { const t = val('en-t'); if (!t) return toast('Escribe el tema', true); await q(SB.from('encuentros_seguimiento').insert({ ciclo_id: S.ciclo.id, fecha: val('en-f') || today(), tema: t, agenda: val('en-a') || null, acta: val('en-c') || null })); route(); },
  async 'add-dec'() { const d = val('de-d'); if (!d) return toast('Escribe la decisión', true); await q(SB.from('decisiones').insert({ ciclo_id: S.ciclo.id, area_id: num(val('de-a')), decision: d, justificacion: val('de-j') || null })); route(); },
  async 'add-lec'() { const x = val('le-x'); if (!x) return toast('Escribe la lección', true); await q(SB.from('lecciones').insert({ ciclo_id: S.ciclo.id, area_id: num(val('le-a')), tipo: val('le-t'), texto: x })); route(); },
  async 'int-add'(el) {
    const a = +el.dataset.a, n = val('int-n-' + a); if (!n) return toast('Escribe el nombre', true);
    await q(SB.from('integrantes').insert({ area_id: a, nombre: n, es_lider: !equipoDe(a).length })); await reloadTeam();
  },
  async 'int-del'(el) {
    const i = S.integrantes.find(x => x.id === +el.dataset.id);
    if (i?.es_lider && equipoDe(i.area_id).length > 1) return toast('Primero nombra a otro líder', true);
    await q(SB.from('integrantes').delete().eq('id', +el.dataset.id)); await reloadTeam();
  },
  async 'int-lider'(el) {
    const a = +el.dataset.a;
    await q(SB.from('integrantes').update({ es_lider: false }).eq('area_id', a).eq('es_lider', true));
    await q(SB.from('integrantes').update({ es_lider: true }).eq('id', +el.dataset.id)); await reloadTeam();
  },
  async 'add-ciclo'() {
    const n = val('ci-n'), a = +val('ci-a'); if (!n || !a) return toast('Completa nombre y año', true);
    await q(SB.from('ciclos').insert({ nombre: n, anio: a })); await start();
  }
};
const CHG = {
  async etapa(el) { await q(SB.from('ciclos').update({ etapa: el.value }).eq('id', el.dataset.id)); await start(); }
};
async function reloadTeam() { S.integrantes = await q(SB.from('integrantes').select('*').order('id')); route(); }
/* recarga la vista conservando el componente abierto */
async function refresh(compId) {
  const open = $$('details.comp[open]').map(d => d.id), y = window.scrollY;
  await route();
  open.forEach(id => { const d = document.getElementById(id); if (d) d.open = true; });
  if (compId) { const d = document.getElementById('comp-' + compId); if (d) d.open = true; }
  window.scrollTo(0, y);
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT' || el.type === 'checkbox') return;
  const f = ACT[el.dataset.act]; if (!f) return;
  if (el.tagName === 'A') e.preventDefault();
  el.disabled = true;
  try { await f(el); } catch (err) { toast(err.message, true); } finally { el.disabled = false; }
});
document.addEventListener('input', e => { if (e.target.id === 'su-nom') suLideres(); });
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'su-area') {
    if (!el.value) return;
    try {
      const r = await q(SB.rpc('integrantes_de', { p_area: +el.value }));
      $('#su-nom').value = r.map(x => x.nombre).join('\n'); suLideres(r.find(x => x.es_lider)?.nombre || '');
    } catch (err) { toast(err.message, true); }
    return;
  }
  if (el.name === 'su-lider') { $$('input[name="su-lider"]').forEach(r => r.closest('.opt').classList.toggle('sel', r.checked)); return; }
  if (el.name?.startsWith('n-')) { $$(`input[name="${el.name}"]`).forEach(r => r.closest('.opt').classList.toggle('sel', r.checked)); return; }
  if (el.dataset.act === 'fo-prio') { try { await q(SB.from('fortalezas_oportunidades').update({ priorizada: el.checked }).eq('id', el.dataset.id)); toast(el.checked ? 'Priorizada' : 'Quitada'); } catch (err) { toast(err.message, true); } return; }
  const f = CHG[el.dataset.act]; if (!f) return;
  try { await f(el); } catch (err) { toast(err.message, true); route(); }
});
document.addEventListener('submit', async e => {
  if (e.target.dataset.form !== 'login') return;
  e.preventDefault(); const b = $('#a-go'); b.disabled = true;
  try { await doAuth(); } finally { b.disabled = false; }
});
$('#salir').addEventListener('click', () => ACT.logout());
$('#cicloSel').addEventListener('change', e => { S.ciclo = S.ciclos.find(c => c.id === +e.target.value); lsSet('cicloId', S.ciclo.id); route(); });
document.head.insertAdjacentHTML('beforeend', `<style>
.informe h2{margin-top:1.4rem;border-bottom:2px solid var(--brand);padding-bottom:.2rem}.informe h3{margin:1rem 0 .3rem;font-size:1rem}
.informe table{margin:.4rem 0}.informe tr{break-inside:avoid}
@media print{.pb{break-before:page}body{font-size:11px}.badge,td.l1,td.l2,td.l3,td.l4,.bar>i{-webkit-print-color-adjust:exact;print-color-adjust:exact}
#cicloSel,.userbox,#nav,#toast{display:none!important}.informe{max-width:none}main{padding:0}}
</style>`);
renderFoot();
boot();

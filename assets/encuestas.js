/* LeiaNET — encuestas (sección Novedades)
 * Trae las encuestas del backend, deja votar y muestra votos + porcentajes.
 * Anti-bots del lado cliente: resuelve un proof-of-work que el servidor valida,
 * manda un campo honeypot y (opcional) un token de Cloudflare Turnstile.
 * Para activar Turnstile, antes de este script:
 *   <script>window.LEIA_TURNSTILE_SITEKEY = 'tu-site-key';</script>
 */
(function(){
  'use strict';
  var host = document.getElementById('encuestas-container');
  if(!host) return;

  var API = 'https://novedades.leianet.ar/api/encuestas';
  var TS_SITEKEY = window.LEIA_TURNSTILE_SITEKEY || '';
  var VOTER_KEY = 'leia_voter_id';
  var MAX_CERRADAS = 2;      // encuestas cerradas que se siguen mostrando
  var CH_MAX_AGE = 9 * 60e3; // el desafío del servidor vence a los 10 min

  var voterId = getVoterId();
  var polls = [];
  var offset = 0;            // diferencia reloj servidor - reloj local
  var st = {};               // estado por encuesta: {sel, busy, msg, prep}
  var lastFetch = 0;

  /* ---------- utilidades ---------- */
  function esc(s){ var d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; }
  function now(){ return Date.now() + offset; }
  function delay(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function newId(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var a = new Uint8Array(16);
    if(window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for(var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function getVoterId(){
    try{ var v = localStorage.getItem(VOTER_KEY); if(v && /^[A-Za-z0-9-]{16,64}$/.test(v)) return v; }catch(e){}
    var id = newId();
    try{ localStorage.setItem(VOTER_KEY, id); }catch(e){}
    return id;
  }
  function fmt(ms){
    var s = Math.max(0, Math.floor(ms / 1000));
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    if(d) return d + 'd ' + h + 'h';
    if(h) return h + 'h ' + m + 'm';
    if(m) return m + 'm ' + x + 's';
    return x + 's';
  }
  function pctTxt(p){ return (p % 1 === 0 ? p : p.toFixed(1)) + '%'; }
  function find(id){ for(var i = 0; i < polls.length; i++) if(polls[i].id === id) return polls[i]; return null; }
  function state(id){ return st[id] || (st[id] = { sel: [], busy: false, msg: '', prep: null }); }

  /* ---------- anti-bots: proof-of-work ---------- */
  function leadingZeroBits(h){
    var bits = 0;
    for(var i = 0; i < h.length; i++){
      if(h[i] === 0){ bits += 8; continue; }
      bits += Math.clz32(h[i]) - 24;
      break;
    }
    return bits;
  }
  async function solve(ch, bits){
    if(!(window.crypto && crypto.subtle)) throw new Error('Tu navegador no permite la verificación anti-bots.');
    var enc = new TextEncoder(), prefix = ch + ':';
    for(var n = 0; ; n++){
      var h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(prefix + n)));
      if(leadingZeroBits(h) >= bits) return n;
      if(n % 4000 === 3999) await delay(0); // no congelar la página
    }
  }
  // Se prepara apenas la persona toca una opción, así al apretar "Votar" ya está listo.
  function prepare(id){
    var s = state(id);
    if(s.prep && Date.now() - s.prep.t0 < CH_MAX_AGE) return s.prep.promise;
    var prep = { t0: Date.now() };
    prep.promise = fetch(API + '/challenge').then(function(r){
      return r.json().then(function(d){ if(!r.ok) throw new Error(d.error || 'No se pudo verificar.'); return d; });
    }).then(function(d){
      var tResp = Date.now();
      return solve(d.ch, d.bits).then(function(nonce){
        var espera = (d.minMs || 1500) + 150 - (Date.now() - tResp);
        return delay(Math.max(0, espera)).then(function(){ return { ch: d.ch, nonce: nonce }; });
      });
    });
    prep.promise.catch(function(){ if(s.prep === prep) s.prep = null; });
    s.prep = prep;
    return prep.promise;
  }

  /* ---------- anti-bots: Turnstile (opcional) ---------- */
  var tsLoading = null;
  function turnstileToken(){
    if(!TS_SITEKEY) return Promise.resolve('');
    if(!tsLoading) tsLoading = new Promise(function(res, rej){
      var sc = document.createElement('script');
      sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      sc.async = true; sc.onload = res; sc.onerror = function(){ tsLoading = null; rej(new Error('No se pudo cargar la verificación.')); };
      document.head.appendChild(sc);
    });
    return tsLoading.then(function(){
      return new Promise(function(res, rej){
        var box = document.createElement('div'), wid;
        box.style.cssText = 'position:fixed;bottom:84px;right:16px;z-index:300';
        document.body.appendChild(box);
        function limpiar(){ try{ window.turnstile.remove(wid); }catch(e){} box.remove(); }
        wid = window.turnstile.render(box, {
          sitekey: TS_SITEKEY, appearance: 'interaction-only',
          callback: function(t){ limpiar(); res(t); },
          'error-callback': function(){ limpiar(); rej(new Error('No pudimos verificar que sos humano.')); }
        });
      });
    });
  }

  /* ---------- render ---------- */
  function resultados(p){
    var total = p.total || 0;
    var html = '<div class="poll-res">';
    p.opciones.forEach(function(o){
      var v = o.votos || 0, pct = total ? v / total * 100 : 0;
      var win = p.cerrada && (p.ganadores || []).indexOf(o.id) !== -1;
      var mine = (p.miVoto || []).indexOf(o.id) !== -1;
      html += '<div class="poll-bar' + (win ? ' win' : '') + '" style="--w:' + pct + '%">' +
        (v ? '<span class="poll-fill"></span>' : '') +
        '<span class="poll-label">' + esc(o.texto) + (mine ? '<span class="poll-check" title="Tu voto">✓</span>' : '') + '</span>' +
        '<span class="poll-num"><b>' + pctTxt(pct) + '</b> · ' + v + ' ' + (v === 1 ? 'voto' : 'votos') + '</span>' +
      '</div>';
    });
    html += '</div>';
    var unidad = p.multiple ? (total === 1 ? 'votante' : 'votantes') : (total === 1 ? 'voto' : 'votos');
    html += '<div class="poll-foot">' + total + ' ' + unidad + (p.multiple ? ' · se podía elegir más de una opción, por eso los % pueden sumar más de 100' : '') + '</div>';
    if(p.cerrada){
      var g = p.ganadores || [], nombres = g.map(function(i){ return esc(p.opciones[i].texto); });
      var txt = !total ? 'VOTACIÓN CERRADA. SIN VOTOS'
        : g.length === 1 ? 'VOTACIÓN CERRADA. GANADOR: <b>' + nombres[0] + '</b>'
        : 'VOTACIÓN CERRADA. GANADORES (EMPATE): <b>' + nombres.join(' · ') + '</b>';
      html += '<div class="poll-closed"><span aria-hidden="true">🔒</span><span>' + txt + '</span></div>';
    }
    return html;
  }

  function formulario(p){
    var s = state(p.id), multi = p.multiple;
    var html = '<div class="poll-opts" role="' + (multi ? 'group' : 'radiogroup') + '" aria-label="Opciones">';
    p.opciones.forEach(function(o){
      var on = s.sel.indexOf(o.id) !== -1;
      html += '<label class="poll-opt' + (on ? ' sel' : '') + '">' +
        '<input type="' + (multi ? 'checkbox' : 'radio') + '" name="poll-' + p.id + '" value="' + o.id + '"' + (on ? ' checked' : '') + '>' +
        '<span class="poll-mark' + (multi ? ' sq' : '') + '"></span>' +
        '<span class="poll-opt-text">' + esc(o.texto) + '</span></label>';
    });
    html += '</div>' +
      '<div class="poll-hp" aria-hidden="true"><label>No completar este campo<input type="text" name="sitio_web" tabindex="-1" autocomplete="off"></label></div>' +
      '<div class="poll-actions"><button type="button" class="poll-btn" data-act="votar"' + (s.sel.length && !s.busy ? '' : ' disabled') + '>' + (s.busy ? 'Verificando…' : 'Votar') + '</button>' +
      '<span class="poll-msg" role="status" aria-live="polite">' + esc(s.msg) + '</span></div>' +
      '<div class="poll-hint">' + (multi ? 'Podés elegir más de una opción. ' : '') + 'Los resultados se ven al votar.</div>';
    return html;
  }

  function card(p){
    var cerr = p.cerrada, ver = cerr || p.yaVoto;
    return '<article class="poll-card' + (cerr ? ' is-closed' : '') + '" data-id="' + p.id + '">' +
      '<div class="poll-head"><span class="poll-badge">📊 Encuesta</span>' +
      '<span class="poll-chip">' + (p.multiple ? 'Múltiple choice' : 'Una sola opción') + '</span>' +
      (cerr
        ? '<span class="poll-timer">Cerró el ' + new Date(p.cierra).toLocaleDateString('es-AR') + '</span>'
        : '<span class="poll-timer" data-cierra="' + p.cierra + '">Cierra en ' + fmt(p.cierra - now()) + '</span>') +
      '</div><h3 class="poll-q">' + esc(p.pregunta) + '</h3>' +
      (ver ? resultados(p) : formulario(p)) + '</article>';
  }

  function render(){
    var activas = polls.filter(function(p){ return !p.cerrada; });
    var cerradas = polls.filter(function(p){ return p.cerrada; }).slice(0, MAX_CERRADAS);
    host.innerHTML = activas.concat(cerradas).map(card).join('');
  }

  /* ---------- datos ---------- */
  function cargar(){
    lastFetch = Date.now();
    return fetch(API + '?voter=' + encodeURIComponent(voterId))
      .then(function(r){ return r.ok ? r.json() : Promise.reject(); })
      .then(function(d){
        offset = (d.ahora || Date.now()) - Date.now();
        polls = d.encuestas || [];
        render();
      })
      .catch(function(){ /* si el backend no responde, la home sigue normal sin encuestas */ });
  }
  function reemplazar(np){
    for(var i = 0; i < polls.length; i++) if(polls[i].id === np.id){ polls[i] = np; return; }
  }

  /* ---------- votar ---------- */
  function pintarEstado(id){
    var c = host.querySelector('.poll-card[data-id="' + id + '"]'); if(!c) return;
    var s = state(id), b = c.querySelector('.poll-btn'), m = c.querySelector('.poll-msg');
    if(b){ b.disabled = s.busy || !s.sel.length; b.textContent = s.busy ? 'Verificando…' : 'Votar'; }
    if(m) m.textContent = s.msg;
  }

  function votar(id){
    var p = find(id), s = state(id);
    if(!p || s.busy || !s.sel.length) return;
    var c = host.querySelector('.poll-card[data-id="' + id + '"]');
    var hpEl = c && c.querySelector('input[name="sitio_web"]');
    var hp = hpEl ? hpEl.value : '';
    s.busy = true; s.msg = ''; pintarEstado(id);

    Promise.all([prepare(id), turnstileToken()]).then(function(r){
      return fetch(API + '/' + id + '/votar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: voterId, opciones: s.sel, ch: r[0].ch, nonce: r[0].nonce, sitio_web: hp, cf: r[1] })
      });
    }).then(function(r){
      return r.json().then(function(d){ return { ok: r.ok, d: d || {} }; });
    }).then(function(res){
      s.prep = null; // los desafíos son de un solo uso
      if(res.ok && res.d.poll){ reemplazar(res.d.poll); s.msg = ''; s.sel = []; }
      else if(res.d.poll){ reemplazar(res.d.poll); }          // ya votó / ya cerró: mostrar resultados
      else { s.msg = res.d.error || 'No se pudo registrar el voto.'; }
    }).catch(function(err){
      s.prep = null;
      s.msg = (err && err.message && err.message !== 'Failed to fetch') ? err.message : 'No se pudo conectar. Probá de nuevo.';
    }).then(function(){
      s.busy = false;
      var p2 = find(id);
      if(p2 && (p2.cerrada || p2.yaVoto)) render(); else pintarEstado(id);
    });
  }

  /* ---------- eventos ---------- */
  host.addEventListener('change', function(e){
    var inp = e.target; if(!inp || inp.tagName !== 'INPUT' || inp.type === 'text') return;
    var cardEl = inp.closest('.poll-card'); if(!cardEl) return;
    var id = cardEl.getAttribute('data-id'), s = state(id);
    s.sel = Array.prototype.map.call(cardEl.querySelectorAll('.poll-opt input:checked'), function(i){ return parseInt(i.value, 10); });
    Array.prototype.forEach.call(cardEl.querySelectorAll('.poll-opt'), function(l){ l.classList.toggle('sel', l.querySelector('input').checked); });
    s.msg = '';
    pintarEstado(id);
    prepare(id).catch(function(err){ s.msg = err.message || ''; pintarEstado(id); });
  });
  host.addEventListener('click', function(e){
    var b = e.target.closest('[data-act="votar"]'); if(!b) return;
    var cardEl = b.closest('.poll-card'); if(cardEl) votar(cardEl.getAttribute('data-id'));
  });

  // cuenta regresiva; al llegar a 0 se recarga para mostrar CERRADA + ganador
  setInterval(function(){
    if(document.hidden) return;
    var t = now(), vencida = false;
    Array.prototype.forEach.call(host.querySelectorAll('[data-cierra]'), function(el){
      var left = parseInt(el.getAttribute('data-cierra'), 10) - t;
      if(left <= 0){ el.textContent = 'Cerrando…'; vencida = true; }
      else el.textContent = 'Cierra en ' + fmt(left);
    });
    if(vencida && Date.now() - lastFetch > 3000) cargar();
  }, 1000);

  cargar();
})();

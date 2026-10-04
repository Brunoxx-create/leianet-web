/* ==========================================================================
   LeiaNET — capa de movimiento v2 (GSAP + ScrollTrigger + SplitText)
   - Intro del hero: titular enmascarado línea por línea, subrayado ámbar, ledger.
   - Scroll: títulos de sección por palabras, tarjetas en tandas (batch), parallax.
   - Ticker cuya velocidad y sentido siguen la velocidad del scroll.
   - Secciones moldeables: con el mouse la sección "se amasa" (esquinas, inclinación,
     foco de luz) y las tarjetas se inclinan hacia el cursor.
   - Respeta prefers-reduced-motion y los modos de rendimiento del sitio
     (perftier:change). Sin JS, todo el contenido queda visible.
   ========================================================================== */
(function(){
  'use strict';
  if(!window.gsap) return;
  var gsap = window.gsap;
  var plugins = [];
  if(window.ScrollTrigger) plugins.push(window.ScrollTrigger);
  if(window.SplitText) plugins.push(window.SplitText);
  gsap.registerPlugin.apply(gsap, plugins);
  var hasST = !!window.ScrollTrigger, hasSplit = !!window.SplitText;

  var $  = function(s, r){ return (r||document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePtr = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var flags = { mold: finePtr && !reduce, heavy: true };
  var tier = function(){ return window.__PERF_TIER || 'full'; };

  gsap.defaults({ ease: 'expo.out', duration: .9 });
  document.documentElement.classList.add('fx');

  /* ---------------------------------------------------------------- ticker */
  var ticker = { running:false, w:0, x:0, vel:0, track:null };
  function buildTicker(){
    var el = $('.ticker'); if(!el) return;
    var track = $('.ticker-track', el); if(!track) return;
    var group = $('.ticker-group', track); if(!group) return;
    ticker.track = track;
    $$('.ticker-group[data-clone]', track).forEach(function(n){ n.remove(); });
    ticker.w = group.getBoundingClientRect().width;
    if(!ticker.w) return;
    var copies = Math.max(1, Math.ceil((window.innerWidth * 1.5) / ticker.w));
    for(var i=0;i<copies;i++){
      var c = group.cloneNode(true); c.setAttribute('data-clone',''); c.setAttribute('aria-hidden','true'); track.appendChild(c);
    }
  }
  function runTicker(){
    if(reduce || !ticker.track || ticker.running) return;
    ticker.running = true;
    var base = 0.55; // px por frame a 60fps
    gsap.ticker.add(function(time, dt){
      if(!ticker.running || !ticker.w) return;
      ticker.vel *= 0.93; // la inercia del scroll se apaga sola
      var step = (base + ticker.vel) * (dt / 16.67);
      ticker.x -= step;
      if(ticker.x <= -ticker.w) ticker.x += ticker.w;
      if(ticker.x > 0) ticker.x -= ticker.w;
      ticker.track.style.transform = 'translate3d(' + ticker.x.toFixed(2) + 'px,0,0)';
    });
    if(hasST){
      ScrollTrigger.create({ onUpdate: function(self){
        if(tier() === 'low' || tier() === 'ultra') return;
        ticker.vel = gsap.utils.clamp(-26, 26, self.getVelocity() / 120);
      }});
    }
  }

  /* ----------------------------------------------------------------- intro */
  var introTargets = [];
  function intro(){
    var h1 = $('.hero h1');
    var lead = $('.hero p.lead');
    var ctas = $$('.hero-cta .btn');
    var live = $('.hero-live');
    var card = $('.status-card');
    var rows = $$('.status-row');
    var underline = $('.hero h1 span');
    introTargets = [lead, live, card].concat(ctas, rows).filter(Boolean);

    gsap.set(introTargets, { autoAlpha: 0 });
    var tl = gsap.timeline({ defaults:{ ease:'expo.out' }, onComplete:function(){ done = true; } });
    var done = false;

    function titleTween(lines){
      return gsap.fromTo(lines, { yPercent: 112 }, { yPercent: 0, duration: 1.15, stagger: .13, ease: 'expo.out' });
    }
    if(h1 && hasSplit){
      gsap.set(h1, { autoAlpha: 1 });
      SplitText.create(h1, { type:'lines', mask:'lines', linesClass:'h1-line', autoSplit:true,
        onSplit: function(self){ return titleTween(self.lines); } });
    } else if(h1){
      gsap.from(h1, { y: 30, autoAlpha: 0 });
    }
    tl.to(lead,  { autoAlpha:1, y:0, duration:.9 }, .45)
      .fromTo(ctas, { y:22 }, { autoAlpha:1, y:0, stagger:.09, duration:.8 }, .6)
      .fromTo(live, { y:10 }, { autoAlpha:1, y:0, duration:.7 }, .85)
      .fromTo(card, { y:30, rotationX:-7, transformPerspective:1200, transformOrigin:'50% 100%' },
                    { autoAlpha:1, y:0, rotationX:0, duration:1.25 }, .3)
      .fromTo(rows, { y:14 }, { autoAlpha:1, y:0, stagger:.1, duration:.8 }, .75);
    gsap.set(lead, { y: 20 });

    // red de seguridad: si algo falla, el contenido nunca queda oculto
    setTimeout(function(){
      if(!done) gsap.set(introTargets.concat(h1 ? [h1] : []), { clearProps:'opacity,visibility,transform' });
    }, 5200);
  }

  /* --------------------------------------------------- scroll: hero parallax */
  function heroScroll(){
    if(!hasST || reduce) return;
    var left = $('.hero > div:first-child'), right = $('.status-card-wrap');
    if(left)  gsap.to(left,  { yPercent:-4,  ease:'none', scrollTrigger:{ trigger:'.hero', start:'top top', end:'bottom top', scrub:.6 } });
    if(right) gsap.to(right, { yPercent:-2, ease:'none', scrollTrigger:{ trigger:'.hero', start:'top top', end:'bottom top', scrub:.6 } });
  }

  /* --------------------------------------- scroll: títulos y bloques en tanda */
  function revealOnScroll(){
    if(!hasST || reduce) return;

    $$('section.game .sec-head').forEach(function(head){
      var h2 = $('h2', head), badge = $('.icon-badge', head), sub = $('.sec-sub', head), extras = $$('.online-pill,.count', head);
      gsap.set([badge, sub].concat(extras).filter(Boolean), { autoAlpha:0 });
      var tl = gsap.timeline({ scrollTrigger:{ trigger: head, start:'top 86%', once:true } });
      if(badge) tl.fromTo(badge, { scale:.55, rotation:-14 }, { scale:1, rotation:0, autoAlpha:1, duration:1, ease:'back.out(1.5)' }, 0);
      if(h2 && hasSplit){
        gsap.set(h2, { autoAlpha:1 });
        SplitText.create(h2, { type:'words', mask:'words', autoSplit:true,
          onSplit:function(self){ return tl.fromTo(self.words, { yPercent:115 }, { yPercent:0, stagger:.08, duration:1.05 }, .08); } });
      } else if(h2){ gsap.set(h2, { autoAlpha:1 }); tl.from(h2, { y:28, autoAlpha:0 }, 0); }
      if(sub) tl.fromTo(sub, { y:14 }, { y:0, autoAlpha:1, duration:.8 }, .35);
      if(extras.length) tl.fromTo(extras, { y:10 }, { y:0, autoAlpha:1, duration:.7, stagger:.08 }, .45);
    });

    var items = $$('.reveal').filter(function(el){ return !el.classList.contains('sec-head'); });
    gsap.set(items, { autoAlpha:0, y:24 });
    ScrollTrigger.batch(items, {
      start:'top 92%', once:true,
      onEnter:function(batch){
        gsap.to(batch, { autoAlpha:1, y:0, duration:1, stagger:.08, overwrite:true, ease:'expo.out' });
      }
    });

    // tarjetas de novedades: se piden por red, entran cuando aparecen
    var host = $('#novedades-container');
    if(host && window.MutationObserver){
      new MutationObserver(function(muts){
        muts.forEach(function(m){
          m.addedNodes.forEach(function(n){
            if(n.nodeType !== 1) return;
            var cards = n.matches && n.matches('.novedad-card') ? [n] : $$('.novedad-card', n);
            if(cards.length) gsap.fromTo(cards, { y:30, autoAlpha:0 }, { y:0, autoAlpha:1, stagger:.1, duration:.9 });
          });
        });
        ScrollTrigger.refresh();
      }).observe(host, { childList:true, subtree:true });
    }
  }

  /* -------------------------------------------- secciones moldeables (hover) */
  /* Deformación tipo gelatina: el elemento se estira hacia el cursor (traslación,
     escala, sesgo e inclinación 3D) y vuelve con rebote elástico al salir. */
  function wireTilt(el, s){
    s = s || 1;
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener('pointermove', function(e){
      if(!flags.mold || e.pointerType !== 'mouse') return;
      var r = el.getBoundingClientRect();
      var u = (e.clientX - r.left) / r.width  - .5;   // -.5 .. .5
      var v = (e.clientY - r.top)  / r.height - .5;
      el.style.setProperty('--mx', ((u + .5) * 100).toFixed(1) + '%');
      el.style.setProperty('--my', ((v + .5) * 100).toFixed(1) + '%');
      gsap.to(el, {
        x: u * 12 * s, y: v * 12 * s,
        rotationY: u * 9 * s, rotationX: -v * 9 * s,
        scaleX: 1 + Math.abs(u) * .05 * s, scaleY: 1 + Math.abs(v) * .05 * s,
        skewX: v * -4 * s, skewY: u * 3 * s,
        duration: .55, ease: 'power3.out', overwrite: 'auto'
      });
    });
    el.addEventListener('pointerleave', function(){
      gsap.to(el, { x:0, y:0, rotationX:0, rotationY:0, scaleX:1, scaleY:1, skewX:0, skewY:0,
        duration: 1.2, ease: 'elastic.out(1,.5)', overwrite: 'auto' });
    });
  }
  function moldSections(){
    if(!finePtr || reduce) return;
    var R = 22;
    $$('section.game').forEach(function(bay){
      var q = {
        sx: gsap.quickTo(bay, '--sx', { duration:.5,  ease:'power3.out' }),
        sy: gsap.quickTo(bay, '--sy', { duration:.5,  ease:'power3.out' }),
        bx: gsap.quickTo(bay, '--bx', { duration:1.1, ease:'expo.out' }),
        by: gsap.quickTo(bay, '--by', { duration:1.1, ease:'expo.out' }),
        tl: gsap.quickTo(bay, '--r-tl', { duration:.9, ease:'expo.out' }),
        tr: gsap.quickTo(bay, '--r-tr', { duration:.9, ease:'expo.out' }),
        br: gsap.quickTo(bay, '--r-br', { duration:.9, ease:'expo.out' }),
        bl: gsap.quickTo(bay, '--r-bl', { duration:.9, ease:'expo.out' })
      };
      bay.addEventListener('pointerenter', function(e){
        if(!flags.mold || e.pointerType !== 'mouse') return;
        bay.classList.add('is-hot');
        gsap.to(bay, { '--lift':1, duration:.7, ease:'power3.out', overwrite:'auto' });
      });
      bay.addEventListener('pointermove', function(e){
        if(!flags.mold || e.pointerType !== 'mouse') return;
        var r = bay.getBoundingClientRect();
        var u = gsap.utils.clamp(0, 1, (e.clientX - r.left) / r.width);
        var v = gsap.utils.clamp(0, 1, (e.clientY - r.top)  / r.height);
        q.sx(u*100); q.sy(v*100);
        q.by((u - .5) * 3.2);
        q.bx((.5 - v) * 2.2);
        // la esquina más cercana al cursor se "estira" (más filosa); las lejanas se redondean
        q.tl(R + 6 - 26*(1-u)*(1-v));
        q.tr(R + 6 - 26*u*(1-v));
        q.br(R + 6 - 26*u*v);
        q.bl(R + 6 - 26*(1-u)*v);
        var hd = bay.querySelector('.sec-head');
        if(hd) gsap.to(hd, { x:(u-.5)*12, y:(v-.5)*7, duration:.8, ease:'power3.out', overwrite:'auto' });
      });
      bay.addEventListener('pointerleave', function(){
        bay.classList.remove('is-hot');
        q.bx(0); q.by(0); q.tl(R); q.tr(R); q.br(R); q.bl(R);
        gsap.to(bay, { '--lift':0, duration:1.1, ease:'expo.out', overwrite:'auto' });
        var hd = bay.querySelector('.sec-head');
        if(hd) gsap.to(hd, { x:0, y:0, duration:1.2, ease:'elastic.out(1,.6)', overwrite:'auto' });
      });
    });
    [['.card, .cafecito-card, .contact-card, .novedad-card', 1], ['.social-card', .8], ['.status-row', .6],
     ['.faq-item', .3], ['.perk-row', .5], ['.info-bar', .3], ['.status-card', .45]].forEach(function(p){
      $$(p[0]).forEach(function(c){ wireTilt(c, p[1]); });
    });
    // las tarjetas de novedades llegan después
    var host = $('#novedades-container');
    if(host && window.MutationObserver){
      new MutationObserver(function(){ $$('.novedad-card', host).forEach(function(c){ if(!c.__tilt){ c.__tilt = 1; wireTilt(c, 1); } }); })
        .observe(host, { childList:true, subtree:true });
    }
  }

  /* ----------------------------------------------- nav: píldora deslizante */
  function navPill(){
    var nav = $('#main-nav'); if(!nav) return;
    var mq = window.matchMedia('(min-width:881px)');
    var pill = document.createElement('span'); pill.className = 'nav-pill'; pill.setAttribute('aria-hidden','true');
    nav.prepend(pill);
    var links = $$('a', nav);
    function activeLink(){ return $('a.active', nav); }
    function moveTo(a, instant){
      if(!mq.matches || !a){ gsap.to(pill, { autoAlpha:0, duration: instant?0:.3 }); return; }
      var nr = nav.getBoundingClientRect(), ar = a.getBoundingClientRect();
      gsap.to(pill, { x: ar.left - nr.left, y: ar.top - nr.top, width: ar.width, height: ar.height, autoAlpha:1,
        duration: instant ? 0 : .55, ease:'expo.out', overwrite:'auto' });
    }
    links.forEach(function(a){
      a.addEventListener('pointerenter', function(){ if(finePtr) moveTo(a); });
      a.addEventListener('focus', function(){ moveTo(a); });
    });
    nav.addEventListener('pointerleave', function(){ moveTo(activeLink()); });
    nav.addEventListener('focusout', function(){ moveTo(activeLink()); });
    if(window.MutationObserver){
      new MutationObserver(function(){ if(!nav.matches(':hover')) moveTo(activeLink()); })
        .observe(nav, { attributes:true, subtree:true, attributeFilter:['class'] });
    }
    window.addEventListener('resize', function(){ moveTo(activeLink(), true); });
    setTimeout(function(){ moveTo(activeLink(), true); }, 400);
  }

  /* --------------------------------------- botones: imán + escala al presionar */
  function buttons(){
    if(finePtr && !reduce){
      $$('.btn.primary, .btn.coffee').forEach(function(b){
        var qx = gsap.quickTo(b, 'x', { duration:.5, ease:'power3.out' });
        var qy = gsap.quickTo(b, 'y', { duration:.5, ease:'power3.out' });
        b.addEventListener('pointermove', function(e){
          if(!flags.mold) return;
          var r = b.getBoundingClientRect();
          qx(((e.clientX - r.left)/r.width - .5) * 14);
          qy(((e.clientY - r.top)/r.height - .5) * 14);
        });
        b.addEventListener('pointerleave', function(){ qx(0); qy(0); });
      });
    }
    if(reduce) return;
    $$('.btn, .link-btn, .copy-btn').forEach(function(b){
      b.addEventListener('pointerdown', function(){ gsap.to(b, { scale:.96, duration:.12, ease:'power2.out', overwrite:'auto' }); });
      ['pointerup','pointerleave','pointercancel'].forEach(function(ev){
        b.addEventListener(ev, function(){ gsap.to(b, { scale:1, duration:.4, ease:'expo.out', overwrite:'auto' }); });
      });
    });
  }

  /* ------------------------------------------------ modos de rendimiento */
  function onTier(){
    var t = tier();
    flags.mold = finePtr && !reduce && t === 'full';
    if(t === 'low' || t === 'ultra'){
      ticker.running = false;
      if(ticker.track) ticker.track.style.transform = '';
      if(hasST){ ScrollTrigger.getAll().forEach(function(s){ s.kill(); }); }
      gsap.set($$('.reveal, .sec-head *, .hero *, .novedad-card'), { clearProps:'opacity,visibility,transform' });
    } else if(t === 'full' && !ticker.running && ticker.track){
      runTicker();
    }
  }
  window.addEventListener('perftier:change', onTier);

  /* ------------------------------------------------------------------ boot */
  function boot(){
    var rootEl = document.documentElement;
    buildTicker();
    navPill();
    buttons();
    if(reduce || tier() === 'low' || tier() === 'ultra'){
      rootEl.classList.remove('fx-pre');
      return; // contenido ya visible, sin movimiento
    }
    try{
      intro();
      heroScroll();
      revealOnScroll();
      moldSections();
      runTicker();
    }catch(err){ if(window.console) console.warn('[leia-fx]', err); }
    // GSAP ya fijó los estados iniciales en línea; soltamos el pre-ocultado por CSS
    requestAnimationFrame(function(){ rootEl.classList.remove('fx-pre'); });
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ready.then(function(){ buildTicker(); if(hasST) ScrollTrigger.refresh(); });
    window.addEventListener('resize', gsap.utils.debounce ? gsap.utils.debounce(buildTicker, 250) : buildTicker);
  }
  function go(){ requestAnimationFrame(function(){ requestAnimationFrame(boot); }); }
  if(document.readyState === 'complete') go(); else window.addEventListener('load', go, { once:true });
})();

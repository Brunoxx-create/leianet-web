/* ============================================================
   LeiaNET — Border Collie Runner (easter egg) — v3
   Pixel art + optimizado para no laguear: todo pre-renderizado en
   sprites cacheados (nada de gradientes/shadowBlur por frame), y el
   fondo dinámico del modal se actualiza throttled, no en cada frame.
   ============================================================ */
(function(){
  "use strict";

  var ASSET_PATH = (function(){
    var scripts = document.getElementsByTagName('script');
    for (var i=0;i<scripts.length;i++){
      if (scripts[i].src && scripts[i].src.indexOf('dog-runner.js') !== -1){
        return scripts[i].src.replace('dog-runner.js','');
      }
    }
    return 'assets/';
  })();

  var IMG_RUN1 = ASSET_PATH + 'dog_run1.png';
  var IMG_RUN2 = ASSET_PATH + 'dog_run2.png';
  var IMG_JUMP = ASSET_PATH + 'dog_jump.png';
  var SND_JUMP = ASSET_PATH + 'saltar.mp3';
  var SND_MUSIC = ASSET_PATH + 'musica.mp3';

  var LS_BEST = 'leianet_dogrunner_best';
  var LS_NICK = 'leianet_dogrunner_nick';

  // URL base de la API del leaderboard (el backend que corre en tu LXC
  // detras de Cloudflare Tunnel). Cambiala si usaste otro subdominio.
  var API_BASE = 'https://api.leianet.ar';

  /* ---------------- build DOM ---------------- */
  var overlay = document.createElement('div');
  overlay.id = 'dr-overlay';
  overlay.innerHTML =
    '<div id="dr-box">' +
      '<div id="dr-topbar">' +
        '<div id="dr-title">LeiaRUN <span>// Minigame EasterEgg</span></div>' +
        '<div id="dr-topbar-actions">' +
          '<div id="dr-trophy" title="Ver ranking completo">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M8 21h8"></path><path d="M12 17v4"></path>' +
              '<path d="M7 4h10v5a5 5 0 0 1-10 0V4z"></path>' +
              '<path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4"></path>' +
              '<path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"></path>' +
            '</svg>' +
          '</div>' +
          '<div id="dr-close" title="Cerrar">&times;</div>' +
        '</div>' +
      '</div>' +
      '<div id="dr-canvas-wrap">' +
        '<div id="dr-bg-nebula"></div>' +
        '<canvas id="dr-canvas"></canvas>' +
        '<div id="dr-hud">SCORE <b id="dr-score">0</b><span class="dr-best">BEST <b id="dr-best">0</b></span></div>' +
        '<div id="dr-rotate">' +
          '<svg id="dr-rotate-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"></rect><line x1="11" y1="18.4" x2="13" y2="18.4"></line></svg>' +
          '<p id="dr-rotate-text">Girá tu teléfono<span>Este minijuego se juega en horizontal</span></p>' +
        '</div>' +
        '<div id="dr-nickgate">' +
          '<div id="dr-nickgate-card">' +
            '<h3>¿Cómo te llamamos?</h3>' +
            '<input id="dr-nick-input" maxlength="16" autocomplete="off" spellcheck="false">' +
            '<button class="dr-btn" id="dr-nick-btn">Jugar</button>' +
            '<p id="dr-nickgate-hint">Se guarda en este navegador. Podés cambiarlo cuando quieras, cada vez que abrís el juego.</p>' +
          '</div>' +
        '</div>' +
        '<div id="dr-msg-layer">' +
          '<div id="dr-countdown" style="display:none"></div>' +
          '<div id="dr-over-card" style="display:none">' +
            '<img id="dr-sad-dog" alt="Perrito triste" src="' + ASSET_PATH + 'dog_sad.png">' +
            '<h3>Perdiste</h3>' +
            '<div class="dr-score-big" id="dr-over-score">0</div>' +
            '<div class="dr-score-best" id="dr-over-best">Mejor puntaje: 0</div>' +
            '<button class="dr-btn" id="dr-retry-btn">Reintentar</button>' +
            '<div id="dr-over-lb-link">Ver ranking completo</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="dr-footer-hint">ESPACIO / CLICK / TAP para saltar &nbsp;·&nbsp; ESC para cerrar</div>' +
      '<div id="dr-leaderboard">' +
        '<div id="dr-lb-header">' +
          '<div id="dr-lb-title">🏆 Ranking completo</div>' +
          '<div id="dr-lb-close" title="Cerrar">&times;</div>' +
        '</div>' +
        '<div id="dr-lb-body"><div id="dr-lb-list"></div></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  var canvas = overlay.querySelector('#dr-canvas');
  var ctx = canvas.getContext('2d');
  var msgLayer = overlay.querySelector('#dr-msg-layer');
  var overCard = overlay.querySelector('#dr-over-card');
  var overScoreEl = overlay.querySelector('#dr-over-score');
  var overBestEl = overlay.querySelector('#dr-over-best');
  var retryBtn = overlay.querySelector('#dr-retry-btn');
  var scoreEl = overlay.querySelector('#dr-score');
  var bestEl = overlay.querySelector('#dr-best');
  var closeBtn = overlay.querySelector('#dr-close');
  var bgNebula = overlay.querySelector('#dr-bg-nebula');
  var countdownEl = overlay.querySelector('#dr-countdown');
  var rotateOverlay = overlay.querySelector('#dr-rotate');
  var nickGate = overlay.querySelector('#dr-nickgate');
  var nickInput = overlay.querySelector('#dr-nick-input');
  var nickBtn = overlay.querySelector('#dr-nick-btn');
  var nickHint = overlay.querySelector('#dr-nickgate-hint');
  var trophyBtn = overlay.querySelector('#dr-trophy');
  var overLbLink = overlay.querySelector('#dr-over-lb-link');
  var lbOverlay = overlay.querySelector('#dr-leaderboard');
  var lbList = overlay.querySelector('#dr-lb-list');
  var lbCloseBtn = overlay.querySelector('#dr-lb-close');

  var best = parseInt(localStorage.getItem(LS_BEST) || '0', 10);
  bestEl.textContent = best;

  function isLowPerf(){
    var root = document.documentElement;
    return root.classList.contains('low-perf') || root.classList.contains('perf-mid');
  }

  /* ---------------- assets ---------------- */
  var runImgs = [new Image(), new Image()];
  runImgs[0].src = IMG_RUN1;
  runImgs[1].src = IMG_RUN2;

  var jumpImg = new Image();
  jumpImg.src = IMG_JUMP;

  var jumpSound = new Audio(SND_JUMP);
  var music = new Audio(SND_MUSIC);
  music.loop = true;
  music.volume = 0.45;
  music.playbackRate = 1.0;

  /* ============================================================
     PIXEL ART — todo pre-renderizado UNA sola vez a un canvas chico
     y después blitteado con drawImage (barato) escalado sin
     suavizado, para look retro y cero costo de gradientes por frame.
     ============================================================ */
  /* ============================================================
     OBSTÁCULOS — imágenes reales (recortadas y sin fondo), agrupadas
     en 3 niveles de dificultad. Se cargan recién cuando se abre el
     juego por primera vez (no en cada carga de la página).
     ============================================================ */
  var OBSTACLE_TIERS = {
    easy: ['rock_big','coral_pod','crater_shovel1','crater_shovel2','gas_tank_yellow',
           'gas_tank_small','dead_coral_tree','mars_rover','nasa_crate','crystal_cluster',
           'radio_dish','ice_block','rock_red','pipe_leak','tree_roots'],
    mid:  ['satellite_broken1','satellite_broken2','asteroid_smooth','asteroid_cluster','rover_wreck'],
    hard: ['ice_shards','tangled_wires','wreckage_debris','comet']
  };
  var OBSTACLE_IMAGES = {};
  var obstacleImagesLoaded = false;
  function loadObstacleImages(){
    if (obstacleImagesLoaded) return;
    obstacleImagesLoaded = true;
    var all = OBSTACLE_TIERS.easy.concat(OBSTACLE_TIERS.mid, OBSTACLE_TIERS.hard);
    for (var i=0;i<all.length;i++){
      var name = all[i];
      var im = new Image();
      im.src = ASSET_PATH + 'obstacles/' + name + '.png';
      OBSTACLE_IMAGES[name] = im;
    }
  }

  // sombrita pixel en el piso (un solo rect chico, no arc/ellipse)
  function drawPixelShadow(cx, w, groundY){
    var sw = Math.round(w*0.6/4)*4;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(Math.round(cx - sw/2), Math.round(groundY), sw, 4);
  }

  /* ---------------- canvas sizing ---------------- */
  var W = 800, H = 350, DPR = 1;
  function resizeCanvas(){
    var rect = canvas.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    W = rect.width; H = rect.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.imageSmoothingEnabled = false;
  }

  /* ---------------- game state ---------------- */
  var GROUND_Y;
  var state = 'idle';
  var lastTime = 0;
  var speed = 6;
  var baseSpeed = 6;
  var distance = 0;
  var score = 0;
  var obstacles = [];
  var spawnTimer = 0;
  var nextSpawnIn = 70;
  var runFrameTimer = 0;
  var runFrameIndex = 0;
  var countdownVal = 5;
  var intensity = 0;
  var nickGateDone = false; // se resetea cada vez que se abre el juego

  var dog = {
    x: 70, y: 0, w: 114, h: 57,
    jumping: false, jumpStart: 0,
    jumpDur: 600, jumpHeight: 138
  };

  function computeGround(){
    GROUND_Y = H * 0.72;
    dog.y = GROUND_Y - dog.h;
  }

  function computeIntensity(s){
    return Math.max(0, Math.min(1, 1 - Math.exp(-s/650)));
  }

  /* ---- fondo dinámico: SOLO se actualiza throttled, no por frame ---- */
  var lastFxUpdate = 0;
  var lastFxIntensity = -1;
  function applyDifficultyFX(now){
    music.playbackRate = 1.0 + intensity * 0.32; // barato, se puede hacer siempre
    if (isLowPerf()) return; // fondo fijo en modo bajo rendimiento (ya lo pone el CSS)
    if (now - lastFxUpdate < 400 && Math.abs(intensity - lastFxIntensity) < 0.04) return;
    lastFxUpdate = now;
    lastFxIntensity = intensity;
    var blue = 'rgba(110,140,255,' + (0.16*(1-intensity*0.6)).toFixed(3) + ')';
    var gold = 'rgba(217,164,65,' + (0.14 + intensity*0.10).toFixed(3) + ')';
    var red  = 'rgba(226,60,70,' + (intensity*0.22).toFixed(3) + ')';
    bgNebula.style.background =
      'radial-gradient(650px 320px at 15% -10%, ' + blue + ', transparent 60%),' +
      'radial-gradient(600px 320px at 85% 110%, ' + gold + ', transparent 60%),' +
      'radial-gradient(500px 260px at 60% 40%, ' + red + ', transparent 65%)';
  }

  /* ---------------- obstáculos (imágenes reales, cacheadas como Image) ---------------- */
  function pickObstacleType(){
    var r = Math.random();
    var pool;
    if (intensity > 0.6 && r < 0.30) pool = OBSTACLE_TIERS.hard;
    else if (intensity > 0.3 && r < 0.55) pool = OBSTACLE_TIERS.mid;
    else pool = OBSTACLE_TIERS.easy;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // arma un obstáculo respetando la relación de ancho/alto real de su
  // imagen (no las deforma a un cuadrado): se fija la altura objetivo y
  // el ancho sale de la proporción natural del sprite.
  function makeObstacle(centerX, targetH, type){
    var img = OBSTACLE_IMAGES[type];
    var aspect = 1;
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0){
      aspect = img.naturalWidth / img.naturalHeight;
    }
    return { x: centerX, w: targetH * aspect, h: targetH, type: type };
  }

  function spawnObstacle(){
    var baseH = 40 + Math.random()*24 + intensity*10;
    var o1 = makeObstacle(W + 20, baseH, pickObstacleType());
    obstacles.push(o1);
    // Antes el hueco entre un par de obstáculos era una distancia fija
    // en píxeles. A velocidad alta (más intensidad) esa misma distancia
    // se cruza en mucho menos tiempo real, así que a veces el par
    // quedaba directamente imposible de esquivar. Ahora el hueco se
    // calcula en función de la velocidad actual para mantener siempre
    // el mismo margen real de reacción/salto, y a intensidad muy alta
    // directamente no se generan pares.
    var doubleChance = intensity > 0.82 ? 0 : (0.10 + intensity*0.08);
    var double = Math.random() < doubleChance;
    if (double){
      var baseH2 = baseH * 0.82;
      var minGapSteps = 26; // ~433ms a 60fps, más colchón que antes
      var gapX = o1.x + o1.w/2 + Math.max(minGapSteps * speed, 110) + baseH2*0.5;
      obstacles.push(makeObstacle(gapX, baseH2, pickObstacleType()));
    }
    return double;
  }

  function drawObstacle(o){
    var cx = o.x, cy = GROUND_Y - o.h*0.5;
    drawPixelShadow(cx, o.w, GROUND_Y+2);
    var sprite = OBSTACLE_IMAGES[o.type];
    if (!sprite || !sprite.complete || sprite.naturalWidth === 0) return;
    ctx.drawImage(sprite, Math.round(cx - o.w/2), Math.round(cy - o.h/2), Math.round(o.w), Math.round(o.h));
  }

  function obstacleBox(o){
    // Antes usaba casi el sprite entero (80% ancho / 95% alto), lo que
    // hacía que a veces "tocara" antes de lo que se veía visualmente.
    // Ahora es más chico que el sprite real para dar margen de perdón.
    return { x:o.x - o.w*0.30, y: GROUND_Y - o.h*0.82, w:o.w*0.60, h:o.h*0.82 };
  }

  /* ---------------- perro ---------------- */
  function dogHitbox(){
    // Hitbox más chica que el sprite (antes 64%/75% del cuerpo, muy
    // ajustada) para que el jugador tenga margen real y no pierda por
    // rozar de casualidad con una pata o la cola.
    return { x: dog.x + dog.w*0.28, y: dog.y + dog.h*0.24, w: dog.w*0.46, h: dog.h*0.60 };
  }

  function updateDogY(now){
    if (!dog.jumping){ dog.y = GROUND_Y - dog.h; return; }
    var t = (now - dog.jumpStart) / dog.jumpDur;
    if (t >= 1){ dog.jumping = false; dog.y = GROUND_Y - dog.h; return; }
    var arc = Math.sin(Math.PI * t);
    dog.y = (GROUND_Y - dog.h) - arc * dog.jumpHeight;
  }

  function drawDog(now){
    var jumpReady = jumpImg.complete && jumpImg.naturalWidth > 0;
    var img = dog.jumping ? (jumpReady ? jumpImg : runImgs[0]) : runImgs[runFrameIndex];
    if (!img.complete || img.naturalWidth === 0) return;
    drawPixelShadow(dog.x + dog.w/2, dog.w*0.8, GROUND_Y+2);
    if (dog.jumping){
      var t = Math.min(1, (now - dog.jumpStart) / dog.jumpDur);
      var tilt = Math.sin(Math.PI * t) * -0.10;
      ctx.save();
      ctx.translate(Math.round(dog.x + dog.w/2), Math.round(dog.y + dog.h/2));
      ctx.rotate(tilt);
      ctx.drawImage(img, -dog.w/2, -dog.h/2, dog.w, dog.h);
      ctx.restore();
    } else {
      ctx.drawImage(img, Math.round(dog.x), Math.round(dog.y), dog.w, dog.h);
    }
  }

  /* ---------------- fondo: estrellas simples (no pixel, queda liviano) ---------------- */
  var stars = [];
  function initStars(){
    stars = [];
    var count = isLowPerf() ? 16 : 45;
    for (var i=0;i<count;i++){
      stars.push({
        x: Math.random()*W, y: Math.random()*H*0.65,
        r: Math.random()<0.5 ? 1 : 2,
        speed: 0.15 + Math.random()*0.5
      });
    }
  }

  function drawStars(steps){
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.55;
    for (var i=0;i<stars.length;i++){
      var s = stars[i];
      s.x -= s.speed * (speed/6) * steps;
      if (s.x < -4){ s.x = W+4; s.y = Math.random()*H*0.65; }
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  var groundScrollX = 0;
  function drawGround(steps){
    ctx.strokeStyle = intensity > 0.55 ? 'rgba(226,90,100,.55)' : '#2b2b30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y+2);
    ctx.lineTo(W, GROUND_Y+2);
    ctx.stroke();

    ctx.fillStyle = intensity > 0.55 ? 'rgba(226,90,100,.28)' : '#232326';
    groundScrollX -= speed * steps;
    if (groundScrollX < -40) groundScrollX += 40;
    for (var x = groundScrollX; x < W; x += 40){
      ctx.fillRect(Math.round(x), GROUND_Y+6, 20, 2);
    }
  }

  function rectsOverlap(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  /* ---------------- loop ---------------- */
  // Todo el movimiento (fondo, piso, obstaculos, spawns) se escala por
  // "steps": cuantos frames de 60fps "equivalen" al tiempo real que pasó
  // desde el frame anterior. Antes esto se hacia por-frame-de-rAF sin
  // normalizar, asi que en monitores de 90/120/144Hz el juego corria
  // 1.5x-2.4x mas rapido de lo previsto (mas llamadas a rAF por segundo)
  // mientras el salto seguia durando 600ms reales fijos, haciendo que a
  // veces fuera matematicamente imposible reaccionar a tiempo. Con
  // "steps" todo corre a la misma velocidad percibida sin importar el
  // refresco de pantalla.
  var REF_FRAME_MS = 1000/60;
  function loop(now){
    if (state !== 'playing'){ return; }
    requestAnimationFrame(loop);
    var dt = now - lastTime;
    lastTime = now;
    // clamp: si la pestaña estuvo en segundo plano (o hubo un freeze),
    // no queremos un salto gigante de "steps" de una sola vez.
    if (dt > 250) dt = 250;
    var steps = dt / REF_FRAME_MS;

    ctx.clearRect(0,0,W,H);
    drawStars(steps);
    drawGround(steps);

    distance += speed * steps;
    intensity = computeIntensity(distance/8);
    speed = baseSpeed + intensity * 7.5;
    applyDifficultyFX(now);

    score = Math.floor(distance / 8);
    scoreEl.textContent = score;

    runFrameTimer += dt;
    if (runFrameTimer > 110){ runFrameTimer = 0; runFrameIndex = 1 - runFrameIndex; }

    updateDogY(now);
    drawDog(now);

    spawnTimer += steps;
    if (spawnTimer > nextSpawnIn){
      spawnTimer = 0;
      // Piso minimo levantado (antes bajaba a ~26 "frames" ~= 433ms,
      // menos que los 600ms que dura el salto, lo que podia generar
      // huecos imposibles de esquivar). Ahora el minimo deja siempre
      // margen para completar un salto entero antes del siguiente spawn.
      nextSpawnIn = Math.max(52, 88 - intensity*34) + Math.random()*30;
      // Si el spawn que acaba de salir fue un par doble, le damos un
      // colchón extra al próximo para no encimarle un tercer obstáculo.
      if (spawnObstacle()) { nextSpawnIn += 20; }
    }
    for (var i = obstacles.length-1; i>=0; i--){
      var o = obstacles[i];
      o.x -= speed * steps;
      drawObstacle(o);
      if (o.x < -60) obstacles.splice(i,1);
    }

    var hb = dogHitbox();
    for (var j=0;j<obstacles.length;j++){
      if (rectsOverlap(hb, obstacleBox(obstacles[j]))){
        return gameOver();
      }
    }
  }

  function jump(){
    if (state !== 'playing' || dog.jumping) return;
    dog.jumping = true;
    dog.jumpStart = performance.now();
    try { jumpSound.currentTime = 0; jumpSound.play().catch(function(){}); } catch(e){}
  }

  /* ---------------- nick (localStorage) ---------------- */
  // Mismo filtro que el backend (ver server.js): normaliza el nick
  // (minusculas, sin tildes, deshace leetspeak y separadores tipo
  // "p.u.t.o", colapsa repeticiones tipo "puuuto") y lo compara contra
  // una lista de palabras no permitidas. Esto es solo para avisar al
  // toque; el backend vuelve a validar todo igual, porque esto se
  // puede saltear editando el JS del cliente.
  var BANNED_RAW_SYMBOLS = ['卐', '卍'];
  var BANNED_WORDS = [
    'abofetearlacarne','acabada','acabado','acabar','afeminado','almeja','anal',
    'anarca','anarquista','ano','anorecto','anti','asfisiar','asquerosa',
    'asqueroso','autoerotismo','ayuditamano','babas','bagre','bajada','balas',
    'balazo','bardear','basura','bellaca','bellaco','bichas','bicho',
    'bichote','biles','bizcocho','blandito','bobolongo','bofetada','bolas',
    'boluda','boludo','boquete','boquitas','bosta','bostero','bucal',
    'buitre','cabezon','cabron','cabrona','cachera','cachero','cachon',
    'cachonda','cachondo','cacorro','cagon','calenton','calentona','calzon',
    'camote','capitalista','carajo','carechimba','carne','carpa','cascarla',
    'castrista','caverna','cerda','cerdo','chairo','chancro','chavista',
    'cheta','cheto','chichi','chichis','chinga','chingada','chingado',
    'chingar','chochito','chocho','chole','chori','choripanero','chorra',
    'chorro','chota','chucha','chucho','chulito','chupa','chupada',
    'chupado','chupala','chupame','chupamelapija','chupapija','chupaverga',
    'cipayo','clito','clitoris','coito','cojer','cojerte','cojo',
    'cojoatuvieja','cojon','cojones','cola','colita','comerlo','comerse',
    'comunacho','comunista','comunoides','concha','conchadetumadre','conchatumadre',
    'conchita','conchuda','conchudo','consolador','correrse','corrupto',
    'cuca','cuco','cuevita','culera','culero','culiada','culiao',
    'culiar','culiarte','culito','culo','culon','culona','dictador',
    'dictadura','dildo','eche','ejaculacion','ejacular','encular','ereccion',
    'escort','escualido','esmegma','espermatozoide','estupida','estupido','esvastica',
    'extrema','facha','facho','facista','falangista','falo','faras',
    'farsante','fascista','fecal','felacion','fetiche','fifi','follar',
    'follon','forra','forro','frotar','fujimorista','ganas','garchandor',
    'garchar','garcharte','gato','genocida','gestapo','gigolo','globoludo',
    'golfa','golfo','gomoso','gonorrea','gorda','gordo','gorila',
    'gorilismo','gozar','grasa','grogui','guarra','guarrada','guarro',
    'guerrilla','guerrillero','hdp','hentai','hijadeputa','hijodeputa','hitler',
    'huevo','huevon','idiota','imbecil','imperialista','incesto','infiel',
    'intercambio','izquierda','izquierdoso','japa','japero','joder','jodido',
    'joto','kirchnerista','kuka','labios','laconchadetumadre','ladron','lamer',
    'lameculos','leche','lechecita','lelo','lesbiana','lesbico','libermensa',
    'libermenso','libertarado','lisonja','lubricante','macana','macanudo','machete',
    'madurista','mafia','mafioso','maldita','maldito','malparida','malparido',
    'mamada','mamon','mamona','manosear','manubrio','marica','maricon',
    'masoquismo','masoquista','masturbacion','masturbar','meada','meado','mear',
    'mecoinatuvieja','mecojo','megarcho','miembro','mierda','mierdosa','mierdoso',
    'mileista','milf','milico','miserable','mocos','mojada','mojado',
    'miron','nabo','nalgas','nalgon','nalgona','nazi','nazismo',
    'necrofilia','neoliberal','ninfomana','objeto','oligarca','opresor','orgia',
    'orina','orinar','ortiba','ortiva','orto','pajera','pajero',
    'pajita','pajon','palo','papaya','papo','paraco','parasito',
    'pecho','pechos','pechonalidad','pedofilia','pedofilo','pelotas','pelotuda',
    'pelotudo','pendeja','pendejada','pendejito','pendejo','penetracion','pene',
    'peroncha','peroncho','perra','perversion','pervertido','pete','petera',
    'pichula','pija','pijudo','pingo','pito','planera','planero',
    'polla','pollon','porky','pornga','porno','pornografia','poronga',
    'populista','prepucio','progre','progresaurio','progresista','prostitucion','prostituta',
    'pubertario','puneta','punetazo','puta','putero','putita','puto',
    'puton','quaker','radical','ramera','raya','reaccionario','rebelde',
    'recto','represor','reputamadre','reputisima','reputisimo','sadico','sadomaso',
    'sadomasoquismo','sauna','scort','semen','sinverguenza','socialismo','socialista',
    'sodomia','sodomiza','strip','swastika','swinger','tarada','tarado',
    'terrorista','tetas','tetona','tetonas','tilingo','tirano','tiznada',
    'trava','travesti','triangulo','trio','tripleputa','trola','trolo',
    'tubo','vagina','vendeptria','vendepatria','verga','vibrador','violacion',
    'violar','voyeur','vulva','wacho','waska','xrated','xxx',
    'zorra','zorron','zurdaje','zurdito','zurda','zurdo'
  ];
  var LEET_MAP = { '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '7':'t', '8':'b', '9':'g' };

  function normalizeForFilter(raw){
    var s = String(raw).toLowerCase();
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // saca tildes/diacriticos
    s = s.replace(/[0134579]/g, function(c){ return LEET_MAP[c] || ''; });
    s = s.replace(/[^a-z]/g, ''); // saca puntos, espacios, numeros y simbolos
    s = s.replace(/(.)\1{2,}/g, '$1'); // colapsa 3+ repeticiones seguidas ("puuuto")
    return s;
  }

  // Distancia de edicion (Levenshtein) para cazar variantes que no son
  // substring exacto (letras de mas/menos, sustituidas, etc). Mismo
  // algoritmo que el backend en server.js — hay que mantener los dos
  // sincronizados si se toca uno.
  function levenshtein(a, b){
    var m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    var prev = new Array(n + 1);
    var curr = new Array(n + 1);
    var i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++){
      curr[0] = i;
      for (j = 1; j <= n; j++){
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
  }

  // Tolerancia segun largo de palabra (igual criterio que el backend):
  // palabras cortas no admiten error, para no chocar con nombres reales
  // (ej "Perez"/"Jessica" no deben caer por parecerse a "perra"/"gato").
  function toleranceFor(len){
    if (len <= 4) return 0;
    if (len <= 6) return 1;
    if (len <= 9) return 2;
    return 3;
  }

  function fuzzyContainsWord(normalized, word){
    var wLen = word.length;
    var tol = toleranceFor(wLen);
    if (normalized.length < wLen - tol) return false;
    var winLen, start, chunk;
    for (winLen = Math.max(1, wLen - tol); winLen <= wLen + tol; winLen++){
      if (winLen > normalized.length) break;
      for (start = 0; start + winLen <= normalized.length; start++){
        chunk = normalized.slice(start, start + winLen);
        if (levenshtein(chunk, word) <= tol) return true;
      }
    }
    return false;
  }

  function containsBannedContent(rawName){
    var i, j;
    for (i = 0; i < BANNED_RAW_SYMBOLS.length; i++){
      if (rawName.indexOf(BANNED_RAW_SYMBOLS[i]) !== -1) return true;
    }
    var normalized = normalizeForFilter(rawName);
    // 1) substring exacto (rapido, cubre el caso comun)
    for (j = 0; j < BANNED_WORDS.length; j++){
      if (normalized.indexOf(BANNED_WORDS[j]) !== -1) return true;
    }
    // 2) fuzzy: cubre variantes con letras de mas/menos o sustituidas
    for (j = 0; j < BANNED_WORDS.length; j++){
      if (fuzzyContainsWord(normalized, BANNED_WORDS[j])) return true;
    }
    return false;
  }

  function sanitizeNickClient(raw){
    if (typeof raw !== 'string') return '';
    // limpieza liviana en el cliente; el backend vuelve a sanitizar en serio.
    return raw.replace(/[<>]/g, '').trim().slice(0, 16);
  }

  function showNickGate(){
    msgLayer.classList.add('dr-hide');
    overCard.style.display = 'none';
    var saved = localStorage.getItem(LS_NICK);
    nickInput.value = saved || 'Jugador';
    nickInput.classList.remove('dr-nick-error');
    nickHint.classList.remove('dr-nick-error-text');
    nickHint.textContent = 'Se guarda en este navegador. Podés cambiarlo cuando quieras, cada vez que abrís el juego.';
    nickGate.style.display = 'flex';
    setTimeout(function(){ nickInput.focus(); nickInput.select(); }, 60);
  }

  function confirmNick(){
    var cleaned = sanitizeNickClient(nickInput.value) || 'Jugador';
    if (containsBannedContent(cleaned)){
      nickInput.classList.add('dr-nick-error');
      nickHint.textContent = 'Ese nombre no está permitido. Probá con otro.';
      nickHint.classList.add('dr-nick-error-text');
      nickInput.focus();
      nickInput.select();
      return;
    }
    nickInput.classList.remove('dr-nick-error');
    nickHint.classList.remove('dr-nick-error-text');
    nickHint.textContent = 'Se guarda en este navegador. Podés cambiarlo cuando quieras, cada vez que abrís el juego.';
    localStorage.setItem(LS_NICK, cleaned);
    nickGateDone = true;
    nickGate.style.display = 'none';
    startCountdown();
  }

  function proceedAfterRotateCheck(){
    if (!nickGateDone){ showNickGate(); }
    else { startCountdown(); }
  }

  /* ---------------- leaderboard (API) ---------------- */
  function submitScore(name, s){
    if (!API_BASE || !(s > 0)) return;
    fetch(API_BASE + '/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, score: s })
    }).catch(function(){ /* sin conexion al backend: no interrumpe el juego */ });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function renderLeaderboard(rows){
    if (!rows || !rows.length){
      lbList.innerHTML = '<div class="dr-lb-empty">Todavía no hay puntajes. ¡Sé el primero!</div>';
      return;
    }
    var myNick = localStorage.getItem(LS_NICK);
    var html = '';
    for (var i = 0; i < rows.length; i++){
      var r = rows[i];
      var mine = (myNick && r.name === myNick) ? ' dr-lb-mine' : '';
      html += '<div class="dr-lb-row' + mine + '">' +
        '<span class="dr-lb-rank">#' + (r.rank || (i + 1)) + '</span>' +
        '<span class="dr-lb-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="dr-lb-score">' + r.score + '</span>' +
      '</div>';
    }
    lbList.innerHTML = html;
  }

  function openLeaderboard(){
    lbOverlay.style.display = 'flex';
    lbList.innerHTML = '<div class="dr-lb-loading">Cargando…</div>';
    if (!API_BASE){
      lbList.innerHTML = '<div class="dr-lb-empty">Ranking no disponible.</div>';
      return;
    }
    fetch(API_BASE + '/leaderboard?all=true')
      .then(function(r){ if (!r.ok) throw new Error('bad response'); return r.json(); })
      .then(function(data){ renderLeaderboard(data.top || []); })
      .catch(function(){
        lbList.innerHTML = '<div class="dr-lb-empty">No se pudo cargar el ranking. Probá de nuevo más tarde.</div>';
      });
  }

  function closeLeaderboard(){
    lbOverlay.style.display = 'none';
  }

  /* ---------------- flujo ---------------- */
  var countdownIv = null;
  function startCountdown(){
    overCard.style.display = 'none';
    msgLayer.classList.remove('dr-hide');
    state = 'countdown';
    countdownVal = 5;
    countdownEl.style.display = 'block';
    countdownEl.textContent = countdownVal;
    if (countdownIv){ clearInterval(countdownIv); }
    countdownIv = setInterval(function(){
      countdownVal--;
      if (countdownVal > 0){
        countdownEl.textContent = countdownVal;
      } else if (countdownVal === 0){
        countdownEl.textContent = '¡YA!';
      } else {
        clearInterval(countdownIv);
        countdownIv = null;
        countdownEl.style.display = 'none';
        beginPlay();
      }
    }, 700);
  }

  function beginPlay(){
    msgLayer.classList.add('dr-hide');
    obstacles = [];
    distance = 0;
    intensity = 0;
    lastFxIntensity = -1;
    speed = baseSpeed;
    spawnTimer = 0;
    dog.jumping = false;
    computeGround();
    initStars();
    applyDifficultyFX(0);
    state = 'playing';
    lastTime = performance.now();
    try { music.currentTime = 0; music.playbackRate = 1.0; music.play().catch(function(){}); } catch(e){}
    requestAnimationFrame(loop);
  }

  function gameOver(){
    state = 'over';
    music.pause();
    if (score > best){ best = score; localStorage.setItem(LS_BEST, String(best)); }
    bestEl.textContent = best;
    overScoreEl.textContent = score;
    overBestEl.textContent = 'Mejor puntaje: ' + best;
    msgLayer.classList.remove('dr-hide');
    overCard.style.display = 'block';
    submitScore(localStorage.getItem(LS_NICK) || 'Jugador', score);
  }

  /* ---------------- abrir / cerrar ---------------- */
  /* Mientras el modal está abierto, forzamos el modo "low-perf" del sitio
     (el mismo sistema adaptativo que ya usa leianet.ar) para parar del
     todo las animaciones de fondo (nebulosas, planetas, estrellas, brillo
     del cursor, etc.) y el backdrop-filter pesado del propio modal. Esas
     animaciones seguían corriendo tapadas detrás del modal y eran la
     causa real del lag, no el juego en sí. Al cerrar, se restaura
     exactamente el modo que el usuario tenía antes (no se lo pisa). */
  var savedPerfTier = null;
  function forceLowPerfWhilePlaying(){
    if (typeof window.__setPerfTier !== 'function') return; // API vieja/ausente: no tocar nada
    savedPerfTier = window.__PERF_TIER || 'full';
    if (savedPerfTier !== 'low' && savedPerfTier !== 'ultra'){
      window.__setPerfTier('low', 'dogrunner');
    }
  }
  function restorePerfState(){
    if (savedPerfTier === null) return;
    if (typeof window.__setPerfTier === 'function' && window.__PERF_TIER !== savedPerfTier){
      window.__setPerfTier(savedPerfTier, 'dogrunner');
    }
    savedPerfTier = null;
  }

  /* ---------------- soporte móvil: pedir horizontal ---------------- */
  // En celulares (mismo breakpoint que ya usa el resto del sitio) el
  // juego necesita ancho para jugarse cómodo, así que si el teléfono
  // está en vertical mostramos un aviso pidiendo girarlo, en vez de
  // arrancar el juego apretado en una franja angosta.
  var rotateBlocking = false;
  var mqMobile = window.matchMedia('(max-width:880px)');
  function needsRotate(){
    return mqMobile.matches && window.innerWidth < window.innerHeight;
  }

  function handleViewportChange(){
    if (!overlay.classList.contains('dr-open')) return;
    var blocked = needsRotate();
    if (blocked && !rotateBlocking){
      rotateBlocking = true;
      if (countdownIv){ clearInterval(countdownIv); countdownIv = null; }
      if (state === 'playing'){ try { music.pause(); } catch(e){} }
      state = 'idle';
      msgLayer.classList.add('dr-hide');
      overCard.style.display = 'none';
      nickGate.style.display = 'none';
      rotateOverlay.classList.add('dr-show');
    } else if (!blocked && rotateBlocking){
      rotateBlocking = false;
      rotateOverlay.classList.remove('dr-show');
      resizeCanvas();
      computeGround();
      initStars();
      proceedAfterRotateCheck();
    } else if (!blocked){
      resizeCanvas();
      computeGround();
      initStars();
    }
  }

  function openGame(){
    loadObstacleImages();
    forceLowPerfWhilePlaying();
    overlay.classList.add('dr-open');
    resizeCanvas();
    computeGround();
    initStars();
    intensity = 0;
    lastFxIntensity = -1;
    applyDifficultyFX(0);
    ctx.clearRect(0,0,W,H);
    drawStars(0);
    drawGround(0);
    overCard.style.display = 'none';
    nickGateDone = false;
    document.addEventListener('keydown', onKeyDown);
    rotateBlocking = needsRotate();
    if (rotateBlocking){
      rotateOverlay.classList.add('dr-show');
    } else {
      rotateOverlay.classList.remove('dr-show');
      proceedAfterRotateCheck();
    }
  }

  function closeGame(){
    overlay.classList.remove('dr-open');
    state = 'idle';
    music.pause();
    if (countdownIv){ clearInterval(countdownIv); countdownIv = null; }
    rotateBlocking = false;
    rotateOverlay.classList.remove('dr-show');
    nickGate.style.display = 'none';
    lbOverlay.style.display = 'none';
    document.removeEventListener('keydown', onKeyDown);
    restorePerfState();
  }

  function onKeyDown(e){
    if (e.code === 'Escape'){
      if (lbOverlay.style.display === 'flex'){ closeLeaderboard(); return; }
      closeGame();
      return;
    }
    if (lbOverlay.style.display === 'flex') return; // ranking abierto: ignorar el resto
    if (e.code === 'Space' || e.code === 'ArrowUp'){
      if (nickGate.style.display === 'flex'){ e.preventDefault(); confirmNick(); return; }
      e.preventDefault();
      if (state === 'playing') { jump(); }
      else if (state === 'over') { startCountdown(); }
    }
  }

  canvas.addEventListener('mousedown', function(){ if (state === 'playing') jump(); });
  canvas.addEventListener('touchstart', function(e){
    if (state === 'playing'){ e.preventDefault(); jump(); }
  }, {passive:false});

  retryBtn.addEventListener('click', startCountdown);
  closeBtn.addEventListener('click', closeGame);
  nickBtn.addEventListener('click', confirmNick);
  nickInput.addEventListener('keydown', function(e){
    if (e.key === 'Enter'){ e.preventDefault(); confirmNick(); }
  });
  trophyBtn.addEventListener('click', openLeaderboard);
  overLbLink.addEventListener('click', openLeaderboard);
  lbCloseBtn.addEventListener('click', closeLeaderboard);
  lbOverlay.addEventListener('click', function(e){ if (e.target === lbOverlay) closeLeaderboard(); });
  overlay.addEventListener('click', function(e){ if (e.target === overlay) closeGame(); });
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', function(){
    // iOS a veces reporta innerWidth/innerHeight viejos justo al disparar
    // el evento; con un pequeño delay ya están actualizados.
    setTimeout(handleViewportChange, 60);
  });

  /* ---------------- hook: click en el logo ---------------- */
  function attachTrigger(){
    var logo = document.querySelector('.brand');
    if (!logo){ setTimeout(attachTrigger, 300); return; }
    logo.addEventListener('click', function(e){ openGame(); });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attachTrigger);
  } else {
    attachTrigger();
  }

  window.LeiaNETDogRunner = { open: openGame, close: closeGame };

})();

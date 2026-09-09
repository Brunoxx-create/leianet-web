(function(){
  const API_BASE = "https://steam-api.leianet.ar";

  const form = document.getElementById("steam-preview-form");
  if(!form) return;

  const input = document.getElementById("steam-input");
  const bgInput = document.getElementById("steam-bg-input");
  const frameInput = document.getElementById("steam-frame-input");
  const loadBtn = document.getElementById("steam-load-btn");
  const errorMsg = document.getElementById("steam-error");
  const loadingBox = document.getElementById("steam-loading");
  const resultBox = document.getElementById("steam-result");

  const bgImg = document.getElementById("steam-bg-img");
  const avatarImg = document.getElementById("steam-avatar-img");
  const avatarFallback = document.getElementById("steam-avatar-fallback");
  const frameImg = document.getElementById("steam-frame-img");
  const nameEl = document.getElementById("steam-player-name");
  const statusEl = document.getElementById("steam-player-status");
  const gamesEl = document.getElementById("steam-games");
  const friendsEl = document.getElementById("steam-friends");

  function showError(msg){
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
  }
  function clearError(){
    errorMsg.hidden = true;
    errorMsg.textContent = "";
  }
  function isValidUrl(v){
    try{ const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; }
    catch(e){ return false; }
  }
  function extractSteamIdOrVanity(raw){
    const trimmed = raw.trim();
    if(/^\d{17}$/.test(trimmed)) return { type:"id", value: trimmed };
    const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
    if(profileMatch) return { type:"id", value: profileMatch[1] };
    const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^\/\s]+)/i);
    if(vanityMatch) return { type:"vanity", value: vanityMatch[1] };
    if(/^[a-zA-Z0-9_-]+$/.test(trimmed)) return { type:"vanity", value: trimmed };
    return null;
  }
  async function resolveSteamId64(parsed){
    if(parsed.type === "id") return parsed.value;
    const res = await fetch(`${API_BASE}/api/resolve/${encodeURIComponent(parsed.value)}`);
    if(!res.ok) throw new Error("No se pudo resolver ese nombre de usuario.");
    const data = await res.json();
    if(!data.steamid) throw new Error("No se encontró ese perfil de Steam.");
    return data.steamid;
  }
  function setLoading(isLoading){
    loadBtn.disabled = isLoading;
    loadingBox.hidden = !isLoading;
    if(isLoading) resultBox.hidden = true;
  }
  function renderChips(container, items){
    container.innerHTML = "";
    items.forEach((text)=>{
      const span = document.createElement("span");
      span.className = "steam-chip";
      span.textContent = text;
      container.appendChild(span);
    });
  }
  async function loadProfile(steamId64){
    const [profileRes, gamesRes, friendsRes] = await Promise.all([
      fetch(`${API_BASE}/api/profile/${steamId64}`),
      fetch(`${API_BASE}/api/games/${steamId64}`).catch(()=>null),
      fetch(`${API_BASE}/api/friends/${steamId64}`).catch(()=>null),
    ]);

    if(!profileRes.ok) throw new Error("No se pudo cargar el perfil. Verificá el SteamID.");
    const profileData = await profileRes.json();
    const player = profileData.response && profileData.response.players && profileData.response.players[0];
    if(!player) throw new Error("Ese perfil no existe o es privado.");

    nameEl.textContent = player.personaname || "Sin nombre";
    statusEl.textContent = player.personastate === 1 ? "En línea" : "Desconectado";

    avatarImg.src = player.avatarfull;
    avatarImg.hidden = false;
    avatarFallback.hidden = true;

    if(gamesRes && gamesRes.ok){
      const gamesData = await gamesRes.json();
      const games = (gamesData.response && gamesData.response.games) || [];
      const topGames = games
        .sort((a,b)=> (b.playtime_forever||0) - (a.playtime_forever||0))
        .slice(0,8)
        .map((g)=> g.name);
      renderChips(gamesEl, topGames.length ? topGames : ["Biblioteca privada o vacía"]);
    } else {
      renderChips(gamesEl, ["No se pudo cargar la biblioteca"]);
    }

    if(friendsRes && friendsRes.ok){
      const friendsData = await friendsRes.json();
      const friends = (friendsData.friendslist && friendsData.friendslist.friends) || [];
      friendsEl.textContent = `${friends.length} amigos`;
    } else {
      friendsEl.textContent = "Lista de amigos privada";
    }
  }
  function applyCustomAssets(){
    const bgUrl = bgInput.value.trim();
    const frameUrl = frameInput.value.trim();

    if(bgUrl){
      if(!isValidUrl(bgUrl)) throw new Error("El link del fondo no es una URL válida.");
      bgImg.src = bgUrl;
      bgImg.hidden = false;
    } else {
      bgImg.hidden = true;
    }
    if(frameUrl){
      if(!isValidUrl(frameUrl)) throw new Error("El link del marco no es una URL válida.");
      frameImg.src = frameUrl;
      frameImg.hidden = false;
    } else {
      frameImg.hidden = true;
    }
  }

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    clearError();

    const rawInput = input.value.trim();
    if(!rawInput){
      showError("Ingresá tu SteamID64 o el link de tu perfil.");
      return;
    }
    const parsed = extractSteamIdOrVanity(rawInput);
    if(!parsed){
      showError("No reconozco ese formato. Probá con tu SteamID64 o el link completo del perfil.");
      return;
    }

    setLoading(true);
    try{
      const steamId64 = await resolveSteamId64(parsed);
      await loadProfile(steamId64);
      applyCustomAssets();
      resultBox.hidden = false;
      if(typeof showToast === "function") showToast("Perfil cargado ✓");
    } catch(err){
      showError(err.message || "Ocurrió un error al cargar el perfil.");
    } finally {
      setLoading(false);
    }
  });
})();

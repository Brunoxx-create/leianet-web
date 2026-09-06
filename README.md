# LeiaNET — leianet.ar

Sitio web oficial de **LeiaNET (LeiaNETWORK)**, una red de servidores gratuitos de **Minecraft**, **Counter-Strike 1.6** y **Haxball**, hosteada de forma independiente. Cualquiera puede conectarse a los servidores sin pagar membresía.

🔗 **[leianet.ar](https://leianet.ar)**

---

## ✨ Qué tiene el sitio

- **Estado en vivo** de los servidores (online / offline / a medias) en la hero section.
- **Minecraft** — Survival, Creativo y PVP, con IP para copiar al toque.
- **Counter-Strike 1.6** — Nuevo Mixto, Only Dust2 y Deathmatch.
- **Haxball** — salas 2v2 / 3v3 / 4v4 "Gana y Sigue" + sala pública, con link directo para entrar.
- **Cafecito** — sección de apoyo económico al dominio, hosting e infraestructura.
- **FAQ** desplegable sobre el proyecto y cómo conectarse.
- **Redes sociales y contacto** (Discord, Instagram, X, TikTok, Twitch, WhatsApp, mail).
- Fondo animado con nebulosas, estrellas, planetas y un modo de **bajo rendimiento adaptativo** que se activa solo si detecta que el dispositivo lo necesita (menos animaciones, sin `backdrop-filter`, etc.).
- **Easter egg**: un minijuego escondido, **LeiaRUN** 🐕 (ver más abajo).

## 🐕 Easter egg — LeiaRUN

Haciendo click en el logo del header se abre un minijuego tipo *endless runner* (al estilo del dinosaurio de Chrome), protagonizado por un Border Collie que esquiva obstáculos espaciales.

- Código separado en `assets/dog-runner.js` y `assets/dog-runner.css` — no toca el resto del sitio.
- Controles: `ESPACIO` / `CLICK` / `TAP` para saltar, `ESC` para cerrar.
- Dificultad progresiva (velocidad y obstáculos más difíciles a medida que aumenta el puntaje), con mejor puntaje guardado en `localStorage`.
- **Soporte mobile**: si abrís el juego desde el celular en vertical, te pide girar el teléfono a horizontal antes de empezar (y pausa la partida si lo volvés a girar a mitad de juego).
- Mientras el juego está abierto se fuerza el modo de bajo rendimiento del sitio (nebulosas, brillo del cursor, etc. se apagan) para que no rame, y se restaura el modo que tenía el usuario al cerrar.

## 🗂️ Estructura del proyecto

```
.
├── index.html              # todo el sitio (HTML + CSS + JS del sitio principal)
├── 404.html                 # página de error 404
├── CNAME                    # dominio custom para GitHub Pages (leianet.ar)
├── robots.txt
├── sitemap.xml
├── llms.txt                 # resumen del sitio para agentes/LLMs
└── assets/
    ├── dog-runner.js         # lógica del minijuego easter egg (LeiaRUN)
    ├── dog-runner.css        # estilos del minijuego
    ├── dog_run1.png / dog_run2.png / dog_jump.png / dog_sad.png   # sprites del perro
    ├── obstacles/             # sprites de los obstáculos del minijuego
    ├── saltar.mp3, musica.mp3, clicksound.mp3, volversound.wav    # sonidos
    ├── logo_*.webp, icon_*.webp, favicon-*.png                    # branding e íconos
    └── ...
```

Es un sitio **100% estático**: no hay build step, framework ni dependencias — se edita `index.html` (y los archivos de `assets/`) directamente.

## 🚀 Desarrollo local

No hace falta ningún setup especial. Alcanza con abrir `index.html` en el navegador, o levantar un servidor estático simple para evitar problemas de rutas relativas:

```bash
# con Python
python3 -m http.server 8000

# con Node
npx serve .
```

Después entrás a `http://localhost:8000`.

## 🌐 Deploy

El sitio se sirve con **GitHub Pages** apuntando al dominio custom `leianet.ar` (configurado en el archivo `CNAME`). Cualquier push a la rama principal se refleja en producción — puede tardar uno o dos minutos en propagarse, y conviene forzar refresh de caché al probar cambios en `assets/` (JS/CSS suelen quedar cacheados por el navegador).

## 🤝 Contacto y comunidad

- Discord: [discord.gg/3Hsy6JrSMH](https://discord.gg/3Hsy6JrSMH) — reportes de bugs, anuncios y soporte.
- Mail: soporte@leianet.ar
- Instagram: [@leia_network](https://www.instagram.com/leia_network/) · X: [@leianetwork](https://twitter.com/leianetwork) · TikTok: [@leianetwork](https://www.tiktok.com/@leianetwork) · Twitch: [leian3t](https://twitch.tv/leian3t)

Si querés apoyar el proyecto (dominio, hosting e infraestructura), podés invitar un cafecito en [cafecito.app/leianet](https://cafecito.app/leianet).

---

© LeiaNET — proyecto independiente, sin fines de lucro.

// novedades.js
// Modulo de novedades para el backend que corre en tu LXC de Proxmox.
//
// Como se usa (en tu server.js / app.js principal):
//
//   const express = require('express');
//   const cors = require('cors');
//   const app = express();
//   app.use(cors({ origin: ['https://leianet.ar', 'https://www.leianet.ar'] }));
//   app.use(express.json());
//
//   const novedadesRouter = require('./novedades');
//   app.use('/api/novedades', novedadesRouter);
//
//   app.listen(3001, () => console.log('Backend arriba en :3001'));

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Archivo donde se guardan las novedades. Se crea solo si no existe.
const DB_FILE = path.join(__dirname, 'novedades.json');

// Token para poder publicar/borrar. Definilo como variable de entorno
// en el LXC (ver instrucciones), NO lo dejes hardcodeado en produccion.
const TOKEN = process.env.NOVEDADES_TOKEN || 'cambiar-esta-clave';

const TIPOS_VALIDOS = ['importante', 'anuncio', 'error', 'info'];

function leerNovedades() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function guardarNovedades(lista) {
  fs.writeFileSync(DB_FILE, JSON.stringify(lista, null, 2), 'utf-8');
}

function requiereToken(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (token !== TOKEN) {
    return res.status(401).json({ error: 'Token invalido' });
  }
  next();
}

// GET /api/novedades -> lista todas, mas nuevas primero (esto es lo que consume el index.html)
router.get('/', (req, res) => {
  const lista = leerNovedades();
  const ordenadas = [...lista].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  res.json(ordenadas);
});

// POST /api/novedades -> crea una nueva (requiere token)
// body: { tipo, fecha, titulo, texto }
router.post('/', requiereToken, (req, res) => {
  const { tipo, fecha, titulo, texto } = req.body || {};

  if (!tipo || !fecha || !titulo || !texto) {
    return res.status(400).json({ error: 'Faltan campos: tipo, fecha, titulo, texto son obligatorios' });
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: `Tipo invalido. Usar uno de: ${TIPOS_VALIDOS.join(', ')}` });
  }

  const lista = leerNovedades();
  const nueva = { id: Date.now(), tipo, fecha, titulo, texto };
  lista.push(nueva);
  guardarNovedades(lista);

  res.status(201).json(nueva);
});

// DELETE /api/novedades/:id -> borra una (requiere token)
router.delete('/:id', requiereToken, (req, res) => {
  const id = Number(req.params.id);
  const lista = leerNovedades();
  const nuevaLista = lista.filter((n) => n.id !== id);

  if (nuevaLista.length === lista.length) {
    return res.status(404).json({ error: 'No se encontro esa novedad' });
  }

  guardarNovedades(nuevaLista);
  res.json({ ok: true });
});

module.exports = router;

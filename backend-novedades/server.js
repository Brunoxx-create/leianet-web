// server.js
// Backend minimo para el LXC. Si ya tenes un backend Express corriendo
// (por ejemplo el del previsualizador de Steam), no uses este archivo:
// copia solo las 3 lineas marcadas mas abajo dentro de TU server.js ya
// existente, para tener todo bajo el mismo proceso/puerto.

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: ['https://leianet.ar', 'https://www.leianet.ar'] }));
app.use(express.json());

// --- Novedades ---
const novedadesRouter = require('./novedades');   // <- 1
app.use('/api/novedades', novedadesRouter);        // <- 2
// -----------------

app.get('/', (req, res) => res.send('Backend de LeiaNET funcionando'));

const PORT = process.env.PORT || 3001;              // <- 3 (puerto libre en tu LXC)
app.listen(PORT, () => console.log(`Backend escuchando en :${PORT}`));

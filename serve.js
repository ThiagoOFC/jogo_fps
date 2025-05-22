const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};
const projectiles = [];
const items = [];

const animalNames = ['Raposa', 'Tigre', 'Lobo', 'Coruja', 'Pantera'];
const weaponTypes = ['triple-straight', 'triple-cone'];

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const PLAYER_SIZE = 20;

function getRandomName() {
  return animalNames[Math.floor(Math.random() * animalNames.length)];
}

// Gera um item a cada 10s
setInterval(() => {
  const type = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
  items.push({
    id: randomUUID(),
    type,
    x: Math.random() * (CANVAS_WIDTH - 30) + 15,
    y: Math.random() * (CANVAS_HEIGHT - 30) + 15,
  });
}, 10000);

io.on('connection', (socket) => {
  const player = {
    id: socket.id,
    name: getRandomName(),
    x: Math.random() * 600,
    y: Math.random() * 400,
    angle: 0,
    hp: 100,
    weapon: null,
    weaponExpires: null,
  };
  players[socket.id] = player;

  socket.on('move', (directions) => {
    const speed = 5;
    const player = players[socket.id];
    if (!player) return;

    directions.forEach((dir) => {
      if (dir === 'w') player.y -= speed;
      if (dir === 's') player.y += speed;
      if (dir === 'a') player.x -= speed;
      if (dir === 'd') player.x += speed;
    });

    // Limites da tela
    player.x = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_SIZE, player.x));
    player.y = Math.max(0, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, player.y));
  });

  socket.on('shoot', ({ angle }) => {
    const p = players[socket.id];
    if (!p) return;

    const shots = [];

    // Tiro especial
    if (p.weapon === 'triple-straight') {
      for (let offset = -10; offset <= 10; offset += 10) {
        shots.push({
          id: randomUUID(),
          shooterId: p.id,
          x: p.x + 10,
          y: p.y + 10 + offset,
          angle,
          speed: 8,
          createdAt: Date.now(),
        });
      }
    } else if (p.weapon === 'triple-cone') {
      for (let spread = -0.2; spread <= 0.2; spread += 0.2) {
        shots.push({
          id: randomUUID(),
          shooterId: p.id,
          x: p.x + 10,
          y: p.y + 10,
          angle: angle + spread,
          speed: 8,
          createdAt: Date.now(),
        });
      }
    } else {
      // Tiro normal
      shots.push({
        id: randomUUID(),
        shooterId: socket.id,
        x: p.x + 10,
        y: p.y + 10,
        angle,
        speed: 8,
        createdAt: Date.now(),
      });
    }

    projectiles.push(...shots);
  });

  socket.on('chatMessage', (msg) => {
    io.emit('chatMessage', { name: player.name, message: msg });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
  });
});

setInterval(() => {
  const now = Date.now();

  // Atualiza projéteis
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.x += Math.cos(proj.angle) * proj.speed;
    proj.y += Math.sin(proj.angle) * proj.speed;

    for (const id in players) {
      const p = players[id];
      if (id === proj.shooterId) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        p.hp -= 10;
        if (p.hp <= 0) delete players[id];
        projectiles.splice(i, 1);
        break;
      }
    }

    if (now - proj.createdAt > 3000) {
      projectiles.splice(i, 1);
    }
  }

  // Verifica coleta de item
  for (const id in players) {
    const p = players[id];

    // Verifica se pegou um item
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const dx = p.x - item.x;
      const dy = p.y - item.y;
      if (Math.sqrt(dx * dx + dy * dy) < 25) {
        p.weapon = item.type;
        p.weaponExpires = now + 10000; // 10s
        items.splice(i, 1);
      }
    }

    // Remove arma se expirou
    if (p.weaponExpires && now > p.weaponExpires) {
      p.weapon = null;
      p.weaponExpires = null;
    }
  }

  // Envia estado
  io.emit('state', { players, projectiles, items });
}, 1000 / 30);

server.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));

// server.js
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

const animalNames = ['Raposa', 'Tigre', 'Lobo', 'Coruja', 'Pantera'];
function getRandomName() {
  return animalNames[Math.floor(Math.random() * animalNames.length)];
}

io.on('connection', (socket) => {
  const player = {
    id: socket.id,
    name: getRandomName(),
    x: Math.random() * 600,
    y: Math.random() * 400,
    angle: 0,
    hp: 100,
  };
  players[socket.id] = player;

  const CANVAS_WIDTH = 1200; // ajuste conforme seu layout real
  const CANVAS_HEIGHT = 800;
  const PLAYER_SIZE = 20;
  
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
  
    // Impede que saiam da tela
    player.x = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_SIZE, player.x));
    player.y = Math.max(0, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, player.y));
  });
  
  
  

  socket.on('shoot', ({ angle }) => {
    const p = players[socket.id];
    if (!p) return;
    projectiles.push({
      id: randomUUID(),
      shooterId: socket.id,
      x: p.x + 10,
      y: p.y + 10,
      angle,
      speed: 8,
      createdAt: Date.now()
    });
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
  projectiles.forEach((proj, i) => {
    proj.x += Math.cos(proj.angle) * proj.speed;
    proj.y += Math.sin(proj.angle) * proj.speed;

    // Check collision
    for (const id in players) {
      const p = players[id];
      if (id === proj.shooterId) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        p.hp -= 10;
        if (p.hp <= 0) delete players[id];
        projectiles.splice(i, 1);
        return;
      }
    }

    if (now - proj.createdAt > 3000) projectiles.splice(i, 1);
  });

  io.emit('state', { players, projectiles });
}, 1000 / 30);

server.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));
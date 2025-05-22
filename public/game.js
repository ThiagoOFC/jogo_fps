const socket = io();

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let players = {};
let myId = null;
let projectiles = [];
let items = [];

let mouseX = 0;
let mouseY = 0;

// Redimensionamento automático
function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  draw(players, projectiles, items); // redesenha ao redimensionar
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // chamada inicial

// Chat
const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const messages = document.getElementById('messages');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit('chatMessage', input.value);
    input.value = '';
  }
});

socket.on('chatMessage', ({ name, message }) => {
  const msg = document.createElement('div');
  msg.textContent = `${name}: ${message}`;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
});

socket.on('userJoined', ({ name }) => {
  const msg = document.createElement('div');
  msg.textContent = `${name} entrou na sala.`;
  messages.appendChild(msg);
});

socket.on('userLeft', ({ name }) => {
  const msg = document.createElement('div');
  msg.textContent = `${name} saiu da sala.`;
  messages.appendChild(msg);
});

// Movimento do mouse para atualizar mira
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

// Tiro com clique
canvas.addEventListener('click', () => {
  const player = players[myId];
  if (!player) return;

  const dx = mouseX - player.x;
  const dy = mouseY - player.y;
  const angle = Math.atan2(dy, dx);

  socket.emit('shoot', { angle });
});

// Estado vindo do servidor (agora inclui items)
socket.on('state', ({ players: serverPlayers, projectiles: serverProjectiles, items: serverItems }) => {
  players = serverPlayers;
  projectiles = serverProjectiles;
  items = serverItems;
  draw(players, projectiles, items);
});

function draw(players, projectiles, items) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Itens no mapa (ex: armas)
  for (const item of items) {
    ctx.beginPath();
    ctx.arc(item.x, item.y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = item.type === 'triple-cone' ? 'orange' : 'cyan';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.stroke();
  }

  // Jogadores
  for (const id in players) {
    const p = players[id];
    ctx.fillStyle = id === myId ? 'lime' : 'red';
    ctx.fillRect(p.x, p.y, 20, 20);
    ctx.fillStyle = 'white';
    ctx.fillText(`${p.name} (${p.hp})`, p.x, p.y - 5);
  }

  // Projéteis
  for (const proj of projectiles) {
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'yellow';
    ctx.fill();
  }
}

// Registro da conexão
socket.on('connect', () => {
  myId = socket.id;
});

// Registro da desconexão
socket.on('disconnect', () => {
  delete players[socket.id];
});

// Movimento fluido com múltiplas teclas
const pressedKeys = new Set();

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (['w', 'a', 's', 'd'].includes(key)) {
    pressedKeys.add(key);
  }
});

document.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (['w', 'a', 's', 'd'].includes(key)) {
    pressedKeys.delete(key);
  }
});

// Envia continuamente as teclas pressionadas
setInterval(() => {
  if (pressedKeys.size > 0) {
    socket.emit('move', Array.from(pressedKeys));
  }
}, 1000 / 60); // 60 FPS

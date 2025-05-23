const socket = io();

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let players = {};
let myId = null;
let projectiles = [];
let items = [];

let mouseX = 0;
let mouseY = 0;

// Sprite setup
const playerSprite = new Image();
playerSprite.src = '/assets/sprites/player.png';

const SPRITE_WIDTH = Math.floor(500 / 3); // 166
const SPRITE_HEIGHT = Math.floor(500 / 3); // 166


playerSprite.onload = () => {
  console.log("✅ Sprite carregada!", playerSprite.width, "x", playerSprite.height);
  resizeCanvas();
};

// Redimensionamento automático
function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  draw(players, projectiles, items);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();


// const directionMap = {
//     'down': 0,   // linha 3ª
//     'left': 3,   // linha 4ª
//     'right': 1,  // linha 2ª
//     'up': 3      // linha 1ª
//   };

  const directionMap = {
    'right': 0,
    'down': 1,
    'up': 2,
    'left': 0  // usa right espelhado
  };
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

// Movimento do mouse
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

// Tiro
canvas.addEventListener('click', () => {
  const player = players[myId];
  if (!player) return;

  const dx = mouseX - player.x;
  const dy = mouseY - player.y;
  const angle = Math.atan2(dy, dx);

  socket.emit('shoot', { angle });
});

// Estado vindo do servidor
socket.on('state', ({ players: serverPlayers, projectiles: serverProjectiles, items: serverItems }) => {
    // preserva os dados locais do jogador
    const local = players[myId] || {};
    players = serverPlayers;
  
    if (players[myId]) {
      players[myId].direction = local.direction || 'down';
      players[myId].frame = local.frame || 0;
      players[myId].frameTick = local.frameTick || 0;
    }
  
    projectiles = serverProjectiles;
    items = serverItems;
  
    draw(players, projectiles, items);
  });
  

// Desenha o personagem com sprite
function drawSprite(p) {
    if (!playerSprite.complete) return;
  
    const row = directionMap[p.direction || 'down'];
    const col = (p.frame || 0) % 3;
  
    const sx = col * SPRITE_WIDTH;
    const sy = row * SPRITE_HEIGHT;
    const dx = p.x;
    const dy = p.y;
    const dw = 40;
    const dh = 40;
  
    if (p.direction === 'left') {
      ctx.save();
      ctx.scale(-1, 1); // espelha horizontalmente
      ctx.drawImage(
        playerSprite,
        sx, sy,
        SPRITE_WIDTH, SPRITE_HEIGHT,
        -dx - dw, dy, // dx negativo por conta do flip
        dw, dh
      );
      ctx.restore();
    } else {
      ctx.drawImage(
        playerSprite,
        sx, sy,
        SPRITE_WIDTH, SPRITE_HEIGHT,
        dx, dy,
        dw, dh
      );
    }
  }
  
// Desenha tudo
function draw(players, projectiles, items) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Itens
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
    drawSprite(p);
    ctx.fillStyle = 'white';
    ctx.fillText(`${p.name} (${p.hp})`, p.x, p.y - 5);
  
    // 🔴 Visualização da hitbox (modo debug)
    ctx.beginPath();
    ctx.arc(p.x + 30, p.y + 30, 14, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.stroke();
  }
  

  // Projéteis
  for (const proj of projectiles) {
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'yellow';
    ctx.fill();
  }
}

// Conexão
socket.on('connect', () => {
  myId = socket.id;
});

socket.on('disconnect', () => {
  delete players[socket.id];
});

// Controle de movimento
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

// Animação e envio de movimento
setInterval(() => {
    const directions = Array.from(pressedKeys);
    const p = players[myId];
  
    if (p) {
      if (directions.includes('w')) p.direction = 'up';
      if (directions.includes('s')) p.direction = 'down';
      if (directions.includes('a')) p.direction = 'left';
      if (directions.includes('d')) p.direction = 'right';
  
      // Apenas avança animação se estiver se movendo
      if (pressedKeys.size > 0) {
        p.frameTick = (p.frameTick || 0) + 1;
        if (p.frameTick % 10 === 0) {
          p.frame = ((p.frame || 0) + 1) % 3;
        }
      } else {
        // Zera o frame ao parar
        p.frame = 1; // geralmente frame neutro está no meio (1)
      }
  
      socket.emit('move', directions);
    }
  }, 1000 / 60);
  

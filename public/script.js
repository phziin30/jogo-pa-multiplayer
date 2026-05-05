const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let myId = null;
let gameState = { players: {}, foods: [] };
let camera = { x: 0, y: 0 };
let gameStarted = false;
let isConnected = false;

// Ajusta o tamanho do Canvas
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Lógica do Menu de Login
const btnPlay = document.getElementById('btn-play');
if (btnPlay) {
    btnPlay.addEventListener('click', () => {
        const nick = document.getElementById('nick-input').value;
        socket.emit('joinGame', nick);
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('ui').classList.remove('hidden');
        gameStarted = true;
    });
}

// Conexão com o Servidor
socket.on('connect', () => { 
    myId = socket.id; 
    isConnected = true;
});
socket.on('disconnect', () => { isConnected = false; });
socket.on('gameState', (state) => { gameState = state; });

// Função centralizada para enviar movimento
function sendMousePos(clientX, clientY) {
    if (!gameStarted || !isConnected) return;
    socket.emit('mouseMove', {
        x: clientX + camera.x,
        y: clientY + camera.y
    });
}

// Controles (Mouse e Touch)
canvas.addEventListener('mousemove', (e) => sendMousePos(e.clientX, e.clientY));
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Evita rolar a tela no celular
    sendMousePos(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
canvas.addEventListener('touchstart', (e) => sendMousePos(e.touches[0].clientX, e.touches[0].clientY));

// Função que cria o efeito 3D (A que estava faltando!)
function drawSphere(x, y, radius, colorBase) {
    const gradient = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, radius * 0.1,
        x, y, radius
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.4, colorBase);
    gradient.addColorStop(1, '#000000');
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.closePath();
}

// Loop Principal de Renderização
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Só desenha o jogo se já tiver passado do menu
    if (!gameStarted) { 
        requestAnimationFrame(draw); 
        return; 
    }

    const me = gameState.players[myId];
    if (me) {
        camera.x = me.x - canvas.width / 2;
        camera.y = me.y - canvas.height / 2;
        document.getElementById('score').innerText = me.score;
    }

    // Fundo - Grade Matemática
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    const gridOffsetX = ((camera.x % 50) + 50) % 50;
    const gridOffsetY = ((camera.y % 50) + 50) % 50;
    
    for (let i = 0; i < canvas.width + 50; i += 50) {
        ctx.beginPath(); ctx.moveTo(i - gridOffsetX, 0); ctx.lineTo(i - gridOffsetX, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height + 50; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i - gridOffsetY); ctx.lineTo(canvas.width, i - gridOffsetY); ctx.stroke();
    }

    // 1. Desenha as Comidas com número ao lado
    gameState.foods.forEach(f => {
        const sx = f.x - camera.x;
        const sy = f.y - camera.y;
        
        drawSphere(sx, sy, 12, f.color);
        
        ctx.fillStyle = "white";
        ctx.font = "bold 16px Arial";
        ctx.fillText(f.value, sx + 20, sy - 10); // Número fora da bolinha
    });

    // 2. Desenha os Jogadores
    for (let id in gameState.players) {
        let p = gameState.players[id];
        const hx = p.x - camera.x;
        const hy = p.y - camera.y;

        // Corpo
        p.history.forEach((seg, i) => {
            if (i % 4 === 0) drawSphere(seg.x - camera.x, seg.y - camera.y, 18, p.color);
        });

        // Cabeça
        drawSphere(hx, hy, 22, p.color);

        // Nickname em cima
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(p.name, hx, hy - 35); 
        
        // Equação embaixo
        if(p.equation) {
            ctx.font = "14px Consolas";
            ctx.fillStyle = "#00ffcc";
            ctx.fillText(p.equation.text, hx, hy + 45); 
        }
    }

    requestAnimationFrame(draw);
}

requestAnimationFrame(draw);

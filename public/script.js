const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let myId = null;
let gameState = { players: {}, foods: [] };
let camera = { x: 0, y: 0 };
let isConnected = false;

// Controle de Conexão
socket.on('connect', () => { 
    myId = socket.id; 
    isConnected = true;
});

socket.on('disconnect', () => {
    isConnected = false;
});

socket.on('gameState', (state) => { gameState = state; });

// --- CONTROLES PARA PC (Mouse) ---
canvas.addEventListener('mousemove', (e) => {
    if (!isConnected) return;
    socket.emit('mouseMove', {
        x: e.clientX + camera.x,
        y: e.clientY + camera.y
    });
});

// --- CONTROLES PARA CELULAR (Touch) ---
canvas.addEventListener('touchmove', (e) => {
    if (!isConnected) return;
    e.preventDefault(); // Evita que a tela role para baixo quando você arrasta o dedo
    const touch = e.touches[0];
    socket.emit('mouseMove', {
        x: touch.clientX + camera.x,
        y: touch.clientY + camera.y
    });
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
    if (!isConnected) return;
    const touch = e.touches[0];
    socket.emit('mouseMove', {
        x: touch.clientX + camera.x,
        y: touch.clientY + camera.y
    });
});

// Função para desenhar esferas com efeito 3D
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

// LOOP DE RENDERIZAÇÃO
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Feedback visual se o Render estiver acordando o servidor
    if (!isConnected) {
        ctx.fillStyle = '#00ffcc';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("Conectando ao servidor... (O Render pode levar 50s para acordar)", canvas.width/2, canvas.height/2);
        requestAnimationFrame(draw);
        return;
    }

    const me = gameState.players[myId];
    if (me) {
        camera.x = me.x - canvas.width / 2;
        camera.y = me.y - canvas.height / 2;
        scoreEl.innerText = me.score;
    }

    // Grelha de fundo do mapa (Agora mais visível)
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    // Cálculo matemático correto para a grade não bugar quando for para a esquerda
    const gridOffsetX = ((camera.x % 50) + 50) % 50;
    const gridOffsetY = ((camera.y % 50) + 50) % 50;
    
    for (let i = 0; i < canvas.width + 50; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i - gridOffsetX, 0);
        ctx.lineTo(i - gridOffsetX, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height + 50; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i - gridOffsetY);
        ctx.lineTo(canvas.width, i - gridOffsetY);
        ctx.stroke();
    }

    // Desenha as Respostas (Comidas)
    gameState.foods.forEach(f => {
        const screenX = f.x - camera.x;
        const screenY = f.y - camera.y;
        drawSphere(screenX, screenY, 15, f.color);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.value, screenX, screenY);
    });

    // Desenha as Cobras dos Jogadores
    for (let id in gameState.players) {
        let p = gameState.players[id];
        
        // Desenha o corpo primeiro para ficar atrás da cabeça
        for (let i = p.history.length - 1; i >= 0; i -= 4) {
            const segment = p.history[i];
            drawSphere(segment.x - camera.x, segment.y - camera.y, 18, p.color);
        }

        // Desenha a cabeça
        const headX = p.x - camera.x;
        const headY = p.y - camera.y;
        drawSphere(headX, headY, 22, p.color);

        // Desenha os olhinhos
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(headX - 8, headY - 8, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(headX + 8, headY - 8, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(headX - 8, headY - 8, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(headX + 8, headY - 8, 2, 0, Math.PI*2); ctx.fill();

        // Desenha a Equação de PA
        if (p.equation) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 20px Consolas';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 5;
            ctx.fillText(p.equation.text, headX, headY + 40);
            ctx.shadowBlur = 0;
        }
    }

    requestAnimationFrame(draw);
}

requestAnimationFrame(draw);

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

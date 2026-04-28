 
const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let myId = null;
let gameState = { players: {}, foods: [] };
let camera = { x: 0, y: 0 };

socket.on('connect', () => { myId = socket.id; });
socket.on('gameState', (state) => { gameState = state; });

// Captura o rato e converte as coordenadas do ecrã para coordenadas do mundo
canvas.addEventListener('mousemove', (e) => {
    socket.emit('mouseMove', {
        x: e.clientX + camera.x,
        y: e.clientY + camera.y
    });
});

// Função para desenhar esferas 3D
function drawSphere(x, y, radius, colorBase) {
    const gradient = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, radius * 0.1, // Ponto de luz (reflexo)
        x, y, radius // Sombra nas bordas
    );
    gradient.addColorStop(0, '#ffffff'); // Brilho branco puro
    gradient.addColorStop(0.4, colorBase); // Cor principal
    gradient.addColorStop(1, '#000000'); // Sombra preta
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.closePath();
}

// LOOP DE RENDERIZAÇÃO (Desenha o gráfico o mais rápido que o monitor permitir)
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Se eu existir, a câmara centra-se em mim
    const me = gameState.players[myId];
    if (me) {
        camera.x = me.x - canvas.width / 2;
        camera.y = me.y - canvas.height / 2;
        scoreEl.innerText = me.score;
    }

    // Desenha uma grelha de fundo para dar sensação de movimento
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    const gridOffset = { x: camera.x % 50, y: camera.y % 50 };
    for (let i = 0; i < canvas.width + 50; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i - gridOffset.x, 0);
        ctx.lineTo(i - gridOffset.x, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height + 50; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i - gridOffset.y);
        ctx.lineTo(canvas.width, i - gridOffset.y);
        ctx.stroke();
    }

    // Desenha as Comidas (Números)
    gameState.foods.forEach(f => {
        const screenX = f.x - camera.x;
        const screenY = f.y - camera.y;
        
        drawSphere(screenX, screenY, 15, f.color);
        
        // Desenha o número no meio da esfera
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.value, screenX, screenY);
    });

    // Desenha os Jogadores
    for (let id in gameState.players) {
        let p = gameState.players[id];
        
        // 1. Desenha o Corpo (histórico de posições) de trás para a frente
        for (let i = p.history.length - 1; i >= 0; i -= 4) {
            const segment = p.history[i];
            const screenX = segment.x - camera.x;
            const screenY = segment.y - camera.y;
            drawSphere(screenX, screenY, 18, p.color);
        }

        // 2. Desenha a Cabeça
        const headX = p.x - camera.x;
        const headY = p.y - camera.y;
        drawSphere(headX, headY, 22, p.color);

        // 3. Desenha os "Olhos"
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(headX - 8, headY - 8, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(headX + 8, headY - 8, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(headX - 8, headY - 8, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(headX + 8, headY - 8, 2, 0, Math.PI*2); ctx.fill();

        // 4. Desenha a Equação flutuando no corpo da cobra
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Consolas';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 5;
        // Coloca a fórmula acompanhando a cobra
        ctx.fillText(p.equation.text, headX, headY + 40);
        ctx.shadowBlur = 0; // Reseta a sombra para os próximos elementos
    }

    requestAnimationFrame(draw);
}

// Inicia o ciclo de renderização
requestAnimationFrame(draw);

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

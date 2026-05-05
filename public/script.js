const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let myId = null;
let gameState = { players: {}, foods: [] };
let camera = { x: 0, y: 0 };
let gameStarted = false;

// Botão de Play
document.getElementById('btn-play').addEventListener('click', () => {
    const nick = document.getElementById('nick-input').value;
    socket.emit('joinGame', nick);
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('ui').classList.remove('hidden');
    gameStarted = true;
});

socket.on('connect', () => { myId = socket.id; });
socket.on('gameState', (state) => { gameState = state; });

// (Mantenha os eventos de mouseMove e touchMove do código anterior aqui)

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!gameStarted) { requestAnimationFrame(draw); return; }

    const me = gameState.players[myId];
    if (me) {
        camera.x = me.x - canvas.width / 2;
        camera.y = me.y - canvas.height / 2;
        document.getElementById('score').innerText = me.score;
    }

    // Desenha Comida com número FORA
    gameState.foods.forEach(f => {
        const sx = f.x - camera.x;
        const sy = f.y - camera.y;
        
        // Esfera
        drawSphere(sx, sy, 12, f.color);
        
        // Número ao lado/cima
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial";
        ctx.fillText(f.value, sx + 15, sy - 15);
    });

    // Desenha Jogadores
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

        // Nickname e Equação
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "bold 16px Orbitron";
        ctx.fillText(p.name, hx, hy - 45); // Nome acima
        
        ctx.font = "14px Consolas";
        ctx.fillStyle = "#00ffcc";
        ctx.fillText(p.equation.text, hx, hy + 45); // Equação abaixo
    }

    requestAnimationFrame(draw);
}

// (Função drawSphere e resize aqui...)
requestAnimationFrame(draw);

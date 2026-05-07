const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusMsg = document.getElementById('status-msg');

let myId = null;
let gameState = { players: {}, foods: [] };
let camera = { x: 0, y: 0 };
let gameStarted = false;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

socket.on('connect', () => { 
    myId = socket.id; 
    statusMsg.innerText = "Servidor Online! Escolha sua cor.";
    statusMsg.style.color = "#00ffcc";
});

document.getElementById('btn-play').addEventListener('click', () => {
    const nick = document.getElementById('nick-input').value || "Player";
    const color = document.getElementById('color-input').value;
    socket.emit('joinGame', { name: nick, color: color });
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('ui').classList.remove('hidden');
    document.getElementById('leaderboard').classList.remove('hidden');
    gameStarted = true;
});

socket.on('gameState', (state) => { gameState = state; });

const handleInput = (clientX, clientY) => {
    if (!gameStarted) return;
    socket.emit('mouseMove', { x: clientX + camera.x, y: clientY + camera.y });
};
canvas.addEventListener('mousemove', (e) => handleInput(e.clientX, e.clientY));
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    handleInput(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

function drawSphere(x, y, radius, color) {
    const grad = ctx.createRadialGradient(x-radius*0.3, y-radius*0.3, radius*0.1, x, y, radius);
    grad.addColorStop(0, '#fff'); grad.addColorStop(0.4, color); grad.addColorStop(1, '#000');
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2); ctx.fillStyle = grad; ctx.fill();
}

function updateLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    let arr = Object.values(gameState.players).sort((a, b) => b.score - a.score);
    arr.slice(0, 5).forEach(p => {
        const li = document.createElement('li');
        li.innerText = `${p.name}: ${p.score}`;
        if (p.id === myId) li.classList.add('my-rank');
        list.appendChild(li);
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!gameStarted) { requestAnimationFrame(draw); return; }

    const me = gameState.players[myId];
    if (me) {
        camera.x = me.x - canvas.width / 2;
        camera.y = me.y - canvas.height / 2;
        document.getElementById('score').innerText = me.score;
    }
    updateLeaderboard();

    ctx.strokeStyle = '#1a1a1a';
    const ox = ((camera.x % 50) + 50) % 50;
    const oy = ((camera.y % 50) + 50) % 50;
    for (let i = 0; i < canvas.width + 50; i += 50) {
        ctx.beginPath(); ctx.moveTo(i - ox, 0); ctx.lineTo(i - ox, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height + 50; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i - oy); ctx.lineTo(canvas.width, i - oy); ctx.stroke();
    }

    gameState.foods.forEach(f => {
        const sx = f.x - camera.x; const sy = f.y - camera.y;
        drawSphere(sx, sy, 12, f.color);
        ctx.fillStyle = "white"; ctx.font = "bold 16px Arial"; ctx.fillText(f.value, sx + 20, sy - 10);
    });

    for (let id in gameState.players) {
        const p = gameState.players[id];
        p.history.forEach((seg, i) => { if (i % 4 === 0) drawSphere(seg.x - camera.x, seg.y - camera.y, 18, p.color); });
        const hx = p.x - camera.x; const hy = p.y - camera.y;
        drawSphere(hx, hy, 22, p.color);
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "bold 14px Rajdhani";
        ctx.fillText(p.name, hx, hy - 35);
        if(p.equation) { ctx.fillStyle = "#00ffcc"; ctx.fillText(p.equation.text, hx, hy + 45); }
    }
    requestAnimationFrame(draw);
}
draw();
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

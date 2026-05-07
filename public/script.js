const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusMsg = document.getElementById('status-msg');

let myId = null;
let gameState = { players: {}, foods: [] };
let camera = { x: 0, y: 0 };
let gameStarted = false;

// Variáveis de Game Feel
let particles = [];
let screenShake = 0;
let currentCombo = 0;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- GERADOR DE SONS SINTÉTICOS (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration, vol) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}
// --------------------------------------------------

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

// EVENTOS DE GAME FEEL RECEBIDOS DO SERVIDOR
socket.on('eatSuccess', (data) => {
    currentCombo = data.combo;
    screenShake = 10 + (data.combo * 2); // Tela treme mais com combo alto
    if(screenShake > 30) screenShake = 30;

    // Toca som de acerto (Música Dinâmica: o tom sobe a cada combo!)
    playTone(400 + (data.combo * 50), 'sine', 0.3, 0.5);
    setTimeout(() => playTone(600 + (data.combo * 50), 'sine', 0.5, 0.5), 100);

    // Gera Partículas da Explosão
    for(let i=0; i < 15 + data.combo; i++){
        particles.push({
            x: data.x, y: data.y,
            vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
            life: 1.0, color: data.color
        });
    }
});

socket.on('eatFail', () => {
    currentCombo = 0;
    screenShake = 20; // Treme forte ao errar
    playTone(150, 'sawtooth', 0.5, 0.8); // Som grave de erro
});

socket.on('comboBreak', () => {
    currentCombo = 0;
});

const handleInput = (clientX, clientY) => {
    if (!gameStarted) return;
    socket.emit('mouseMove', { x: clientX + camera.x, y: clientY + camera.y });
};
canvas.addEventListener('mousemove', (e) => handleInput(e.clientX, e.clientY));
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); handleInput(e.touches[0].clientX, e.touches[0].clientY);
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
    // 1. APLICA O SCREEN SHAKE
    ctx.save();
    if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
        screenShake *= 0.8; // Suaviza a trepidação
        if(screenShake < 0.5) screenShake = 0;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!gameStarted) { ctx.restore(); requestAnimationFrame(draw); return; }

    const me = gameState.players[myId];
    if (me) {
        camera.x = me.x - canvas.width / 2;
        camera.y = me.y - canvas.height / 2;
        document.getElementById('score').innerText = me.score;
    }
    updateLeaderboard();

    // Fundo
    ctx.strokeStyle = '#1a1a1a';
    const ox = ((camera.x % 50) + 50) % 50;
    const oy = ((camera.y % 50) + 50) % 50;
    for (let i = 0; i < canvas.width + 50; i += 50) {
        ctx.beginPath(); ctx.moveTo(i - ox, 0); ctx.lineTo(i - ox, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height + 50; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i - oy); ctx.lineTo(canvas.width, i - oy); ctx.stroke();
    }

    // Comidas
    gameState.foods.forEach(f => {
        const sx = f.x - camera.x; const sy = f.y - camera.y;
        drawSphere(sx, sy, 12, f.color);
        ctx.fillStyle = "white"; ctx.font = "bold 16px Arial"; ctx.fillText(f.value, sx + 20, sy - 10);
    });

    // Partículas
    for(let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.05;
        if(p.life <= 0) { particles.splice(i, 1); continue; }
        
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x - camera.x, p.y - camera.y, 5 * p.life, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Jogadores
    for (let id in gameState.players) {
        const p = gameState.players[id];
        p.history.forEach((seg, i) => { if (i % 4 === 0) drawSphere(seg.x - camera.x, seg.y - camera.y, 18, p.color); });
        const hx = p.x - camera.x; const hy = p.y - camera.y;
        drawSphere(hx, hy, 22, p.color);
        
        // Se for o próprio jogador, desenha o COMBO em cima da cabeça
        if (id === myId && currentCombo > 1) {
            ctx.fillStyle = "#ff00cc";
            ctx.font = "bold 24px Orbitron";
            ctx.fillText(`${currentCombo}x COMBO!`, hx, hy - 60);
        }

        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "bold 14px Rajdhani";
        ctx.fillText(p.name, hx, hy - 35);
        if(p.equation) { ctx.fillStyle = "#00ffcc"; ctx.fillText(p.equation.text, hx, hy + 45); }
    }

    ctx.restore(); // Restaura o contexto (Fim do Screen Shake)
    requestAnimationFrame(draw);
}
draw();
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

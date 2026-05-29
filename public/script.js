const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusMsg = document.getElementById('status-msg');

let myId = null;
let gameState = { players: {}, foods: [] };
let camera = { x: 0, y: 0 };
let gameStarted = false;
let particles = [];
let screenShake = 0;
let currentCombo = 0;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- WEB AUDIO API (Sons Procedurais) ---
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

socket.on('connect', () => { 
    myId = socket.id; 
    statusMsg.innerText = "Sistemas Online. Bem-vindo à Arena.";
    statusMsg.style.color = "#00ffcc";
});

document.getElementById('btn-play').addEventListener('click', () => {
    const nick = document.getElementById('nick-input').value || "Player";
    const color = document.getElementById('color-input').value;
    const diff = document.getElementById('difficulty-input').value;
    socket.emit('joinGame', { name: nick, color: color, difficulty: diff });
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('ui').classList.remove('hidden');
    document.getElementById('leaderboard').classList.remove('hidden');
    gameStarted = true;
    if(audioCtx.state === 'suspended') audioCtx.resume();
});

socket.on('gameState', (state) => { gameState = state; });

socket.on('eatSuccess', (data) => {
    currentCombo = data.combo;
    screenShake = Math.min(25, 10 + data.combo * 2);
    playTone(400 + (data.combo * 60), 'sine', 0.3, 0.4);
    for(let i=0; i < 15; i++){
        particles.push({
            x: data.x, y: data.y, life: 1.0, color: data.color,
            vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15
        });
    }
});

socket.on('eatFail', () => {
    currentCombo = 0; screenShake = 20;
    playTone(120, 'sawtooth', 0.4, 0.6);
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

function draw() {
    ctx.save();
    if (screenShake > 0) {
        ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
        screenShake *= 0.85;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!gameStarted) { ctx.restore(); requestAnimationFrame(draw); return; }

    const me = gameState.players[myId];
    if (me) {
        camera.x = me.x - canvas.width / 2;
        camera.y = me.y - canvas.height / 2;
        document.getElementById('score').innerText = me.score;
    }

    // Grid de Fundo
    ctx.strokeStyle = '#111';
    const ox = ((camera.x % 60) + 60) % 60;
    const oy = ((camera.y % 60) + 60) % 60;
    for (let i = 0; i < canvas.width + 60; i += 60) {
        ctx.beginPath(); ctx.moveTo(i-ox, 0); ctx.lineTo(i-ox, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height + 60; i += 60) {
        ctx.beginPath(); ctx.moveTo(0, i-oy); ctx.lineTo(canvas.width, i-oy); ctx.stroke();
    }

    // Comidas
    gameState.foods.forEach(f => {
        const sx = f.x - camera.x; const sy = f.y - camera.y;
        if(sx > -50 && sx < canvas.width+50 && sy > -50 && sy < canvas.height+50) {
            drawSphere(sx, sy, 12, f.color);
            ctx.fillStyle = "white"; ctx.font = "bold 16px Arial"; ctx.fillText(f.value, sx + 20, sy - 10);
        }
    });

    // Partículas
    for(let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.03;
        if(p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x - camera.x, p.y - camera.y, 4, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Jogadores
    for (let id in gameState.players) {
        const p = gameState.players[id];
        p.history.forEach((seg, i) => { if (i % 4 === 0) drawSphere(seg.x-camera.x, seg.y-camera.y, 18, p.color); });
        const hx = p.x-camera.x; const hy = p.y-camera.y;
        drawSphere(hx, hy, 22, p.color);
        
        if (id === myId && p.combo > 1) {
            ctx.fillStyle = "#ff00cc"; ctx.font = "bold 22px Orbitron"; ctx.textAlign="center";
            ctx.fillText(`${p.combo}x COMBO!`, hx, hy - 70);
        }

        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "bold 15px Rajdhani";
        ctx.fillText(p.name, hx, hy - 40);
        if(p.equation) { 
            ctx.fillStyle = "#00ffcc"; ctx.font = "16px Orbitron";
            ctx.fillText(p.equation.text, hx, hy + 50); 
        }
    }

    // Atualiza Ranking Lateral
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    Object.values(gameState.players).sort((a,b)=>b.score-a.score).slice(0,5).forEach(p => {
        const li = document.createElement('li');
        li.innerText = `${p.name}: ${p.score}`;
        if(p.id === myId) li.className = 'my-rank';
        list.appendChild(li);
    });

    ctx.restore();
    requestAnimationFrame(draw);
}
draw();
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

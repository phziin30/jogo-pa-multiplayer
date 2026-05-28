const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const WORLD_SIZE = 2500;
let players = {};
let foods = [];

// MOTOR MATEMÁTICO COM DIFICULDADE (Risco vs Recompensa)
function generateEquation(diff) {
    let a1, r, n;
    if (diff === 'easy') {
        a1 = Math.floor(Math.random() * 5) + 1;
        r = Math.floor(Math.random() * 2) + 1;
        n = Math.floor(Math.random() * 3) + 3; 
    } else if (diff === 'hard') {
        a1 = Math.floor(Math.random() * 20) + 15;
        r = Math.floor(Math.random() * 8) + 5;
        n = Math.floor(Math.random() * 6) + 7; 
    } else { // medium
        a1 = Math.floor(Math.random() * 10) + 1;
        r = Math.floor(Math.random() * 5) + 1;
        n = Math.floor(Math.random() * 5) + 3;
    }
    return { text: `a₁=${a1}, r=${r}, a${n}=?`, answer: a1 + (n - 1) * r };
}

function spawnFood(specificValue = null) {
    foods.push({
        id: Math.random().toString(),
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        value: specificValue !== null ? specificValue : Math.floor(Math.random() * 120) + 1,
        color: `hsl(${Math.random() * 360}, 100%, 60%)`
    });
}

// Inicializa com 96 bolinhas (80 + 20%)
for (let i = 0; i < 96; i++) { spawnFood(); }

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        const startX = Math.random() * WORLD_SIZE;
        const startY = Math.random() * WORLD_SIZE;
        const diff = data.difficulty || 'medium';
        const eq = generateEquation(diff);
        
        players[socket.id] = {
            id: socket.id,
            name: data.name || "Player",
            color: data.color || "#00ffcc",
            difficulty: diff,
            x: startX, y: startY, targetX: startX, targetY: startY,
            score: 5, history: [], equation: eq, combo: 0, lastEatTime: 0
        };
        spawnFood(eq.answer);
    });

    socket.on('mouseMove', (data) => {
        if (players[socket.id] && typeof data.x === 'number') {
            players[socket.id].targetX = data.x;
            players[socket.id].targetY = data.y;
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

setInterval(() => {
    let playersArray = Object.values(players);
    const now = Date.now();

    playersArray.forEach(p => {
        const dx = p.targetX - p.x; const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let speed = 7 + (p.combo * 0.2); 
        if (speed > 12) speed = 12;

        if (dist > 5) { p.x += (dx / dist) * speed; p.y += (dy / dist) * speed; }
        
        p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
        p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
        p.history.unshift({ x: p.x, y: p.y });
        if (p.history.length > p.score * 4) p.history.pop();

        if (now - p.lastEatTime > 6000 && p.combo > 0) p.combo = 0;

        // Colisões entre cobras
        playersArray.forEach(other => {
            if (p.id === other.id) return;
            other.history.forEach((seg, idx) => {
                if (idx < 10) return;
                if (Math.sqrt(Math.pow(p.x - seg.x, 2) + Math.pow(p.y - seg.y, 2)) < 22) {
                    p.score = 5; p.combo = 0;
                    p.x = Math.random() * WORLD_SIZE; p.y = Math.random() * WORLD_SIZE;
                    p.history = []; p.targetX = p.x; p.targetY = p.y;
                    io.to(p.id).emit('eatFail'); 
                }
            });
        });

        // Colisão com números
        for (let i = foods.length - 1; i >= 0; i--) {
            const f = foods[i];
            if (Math.sqrt(Math.pow(p.x - f.x, 2) + Math.pow(p.y - f.y, 2)) < 30) {
                if (f.value === p.equation.answer) {
                    p.combo++;
                    p.lastEatTime = now;
                    
                    let points = 1; // Easy
                    if (p.difficulty === 'medium') points = 2;
                    if (p.difficulty === 'hard') points = 4;
                    
                    p.score += points + Math.floor(p.combo / 3);
                    io.to(p.id).emit('eatSuccess', { x: f.x, y: f.y, color: f.color, combo: p.combo });
                    p.equation = generateEquation(p.difficulty); 
                    spawnFood(p.equation.answer);
                } else { 
                    p.score = Math.max(5, p.score - 1); p.combo = 0;
                    io.to(p.id).emit('eatFail');
                }
                foods.splice(i, 1); spawnFood();
            }
        }
    });
    io.emit('gameState', { players, foods });
}, 1000 / 30);

server.listen(process.env.PORT || 3000);

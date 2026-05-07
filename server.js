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

function generateEquation() {
    const a1 = Math.floor(Math.random() * 10) + 1;
    const r = Math.floor(Math.random() * 5) + 1;
    const n = Math.floor(Math.random() * 8) + 3;
    return { text: `a₁=${a1}, r=${r}, a${n}=?`, answer: a1 + (n - 1) * r };
}

function spawnFood(specificValue = null) {
    foods.push({
        id: Math.random().toString(),
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        value: specificValue !== null ? specificValue : Math.floor(Math.random() * 60) + 1,
        color: `hsl(${Math.random() * 360}, 100%, 60%)`
    });
}

// Inicializa com 96 bolinhas (Aumento de 20%)
for (let i = 0; i < 96; i++) { spawnFood(); }

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        const startX = Math.random() * WORLD_SIZE;
        const startY = Math.random() * WORLD_SIZE;
        const eq = generateEquation();
        players[socket.id] = {
            id: socket.id,
            name: data.name || "Player",
            color: data.color || "#00ffcc",
            x: startX, y: startY,
            targetX: startX, targetY: startY,
            score: 5, history: [], equation: eq
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
    playersArray.forEach(p => {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            p.x += (dx / dist) * 7;
            p.y += (dy / dist) * 7;
        }
        p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
        p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
        p.history.unshift({ x: p.x, y: p.y });
        if (p.history.length > p.score * 4) p.history.pop();

        playersArray.forEach(other => {
            if (p.id === other.id) return;
            other.history.forEach((seg, idx) => {
                if (idx < 10) return;
                if (Math.sqrt(Math.pow(p.x - seg.x, 2) + Math.pow(p.y - seg.y, 2)) < 20) {
                    p.score = 5; p.x = Math.random() * WORLD_SIZE; p.y = Math.random() * WORLD_SIZE;
                    p.history = []; p.targetX = p.x; p.targetY = p.y;
                }
            });
        });

        for (let i = foods.length - 1; i >= 0; i--) {
            const f = foods[i];
            if (Math.sqrt(Math.pow(p.x - f.x, 2) + Math.pow(p.y - f.y, 2)) < 30) {
                if (f.value === p.equation.answer) {
                    p.score += 2; p.equation = generateEquation(); spawnFood(p.equation.answer);
                } else { p.score = Math.max(5, p.score - 1); }
                foods.splice(i, 1); spawnFood();
            }
        }
    });
    io.emit('gameState', { players, foods });
}, 1000 / 30);

server.listen(process.env.PORT || 3000);

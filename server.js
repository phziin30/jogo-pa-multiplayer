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

function updatePlayerEquation(p) {
    let ans = p.seq.a1 + (p.seq.n - 1) * p.seq.r;
    if (p.difficulty === 'easy') {
        let seqText = "";
        let startDisplay = Math.max(1, p.seq.n - 3); 
        for(let i = startDisplay; i < p.seq.n; i++) {
            seqText += (p.seq.a1 + (i - 1) * p.seq.r) + ", ";
        }
        p.equation = { text: seqText + "?", answer: ans };
    } else {
        p.equation = { text: `a₁=${p.seq.a1}, r=${p.seq.r}, a${p.seq.n}=?`, answer: ans };
    }
}

function spawnFood(specificValue = null, x = null, y = null, color = null, isLoot = false) {
    foods.push({
        id: Math.random().toString(),
        x: x !== null ? x : Math.random() * WORLD_SIZE,
        y: y !== null ? y : Math.random() * WORLD_SIZE,
        value: specificValue !== null ? specificValue : Math.floor(Math.random() * 120) + 1,
        color: color !== null ? color : `hsl(${Math.random() * 360}, 100%, 60%)`,
        isLoot: isLoot // Marca se é a bolinha de loot (morte)
    });
}

for (let i = 0; i < 96; i++) { spawnFood(); }

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        const startX = Math.random() * WORLD_SIZE;
        const startY = Math.random() * WORLD_SIZE;
        const diff = data.difficulty || 'medium';
        let a1 = Math.floor(Math.random() * 5) + 1;
        let r = Math.floor(Math.random() * 3) + 1;
        if(diff === 'hard') { a1 += 15; r += 5; }
        
        players[socket.id] = {
            id: socket.id,
            name: data.name || "Player",
            color: data.color || "#00ffcc",
            difficulty: diff,
            x: startX, y: startY, targetX: startX, targetY: startY,
            score: 5, history: [], combo: 0, lastEatTime: 0,
            seq: { a1: a1, r: r, n: 4 }
        };
        updatePlayerEquation(players[socket.id]);
        spawnFood(players[socket.id].equation.answer);
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

        // COLISÃO ENTRE COBRAS E GERADOR DE LOOT
        playersArray.forEach(other => {
            if (p.id === other.id) return;
            other.history.forEach((seg, idx) => {
                if (idx < 10) return;
                if (Math.sqrt(Math.pow(p.x - seg.x, 2) + Math.pow(p.y - seg.y, 2)) < 22) {
                    // O jogador 'p' morreu! Transforma o corpo dele em uma bolinha gigante
                    spawnFood(p.score, p.x, p.y, p.color, true); 
                    
                    // Reset do jogador morto
                    p.score = 5; p.combo = 0; p.seq.n = 4;
                    p.x = Math.random() * WORLD_SIZE; p.y = Math.random() * WORLD_SIZE;
                    p.history = []; p.targetX = p.x; p.targetY = p.y;
                    updatePlayerEquation(p);
                    io.to(p.id).emit('eatFail'); 
                }
            });
        });

        // COLETA DE NÚMEROS E LOOT
        for (let i = foods.length - 1; i >= 0; i--) {
            const f = foods[i];
            if (Math.sqrt(Math.pow(p.x - f.x, 2) + Math.pow(p.y - f.y, 2)) < 35) {
                // Se for LOOT (bolinha de morte), ganha pontos direto sem checar equação
                if (f.isLoot) {
                    p.score += f.value;
                    io.to(p.id).emit('eatSuccess', { x: f.x, y: f.y, color: f.color, combo: p.combo });
                    foods.splice(i, 1);
                } 
                // Se for comida normal, checa a resposta da PA
                else if (f.value === p.equation.answer) {
                    p.combo++; p.lastEatTime = now;
                    let pts = (p.difficulty === 'hard') ? 4 : (p.difficulty === 'medium' ? 2 : 1);
                    p.score += pts + Math.floor(p.combo / 3);
                    p.seq.n++;
                    updatePlayerEquation(p);
                    io.to(p.id).emit('eatSuccess', { x: f.x, y: f.y, color: f.color, combo: p.combo });
                    foods.splice(i, 1); spawnFood(p.equation.answer);
                } 
                else {
                    p.score = Math.max(5, p.score - 1); p.combo = 0;
                    io.to(p.id).emit('eatFail');
                    foods.splice(i, 1); spawnFood();
                }
            }
        }
    });
    io.emit('gameState', { players, foods });
}, 1000 / 30);

server.listen(process.env.PORT || 3000);

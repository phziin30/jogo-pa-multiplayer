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

io.on('connection', (socket) => {
    // O jogador só entra no jogo após enviar o nome
    socket.on('joinGame', (nickname) => {
        players[socket.id] = {
            id: socket.id,
            name: nickname || "Anônimo",
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            targetX: 0, targetY: 0,
            color: `hsl(${Math.random() * 360}, 80%, 50%)`,
            score: 5,
            history: [],
            equation: generateEquation()
        };
    });

    socket.on('mouseMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].targetX = data.x;
            players[socket.id].targetY = data.y;
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

// Loop de Física e Colisões
setInterval(() => {
    let playersArray = Object.values(players);

    playersArray.forEach(p => {
        // Movimentação
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            p.x += (dx / dist) * 5;
            p.y += (dy / dist) * 5;
        }
        p.history.unshift({ x: p.x, y: p.y });
        if (p.history.length > p.score * 4) p.history.pop();

        // 1. COLISÃO ENTRE COBRAS
        playersArray.forEach(other => {
            if (p.id === other.id) return; // Não colidir consigo mesmo
            
            // Verifica se a cabeça de 'p' bateu em qualquer segmento do corpo de 'other'
            other.history.forEach((segment, index) => {
                if (index < 10) return; // Ignora os primeiros segmentos perto da cabeça
                const d = Math.sqrt(Math.pow(p.x - segment.x, 2) + Math.pow(p.y - segment.y, 2));
                if (d < 20) {
                    // Se bater, o jogador 'p' morre (reseta)
                    p.score = 5;
                    p.x = Math.random() * WORLD_SIZE;
                    p.y = Math.random() * WORLD_SIZE;
                    p.history = [];
                }
            });
        });

        // 2. COLISÃO COM COMIDA (Igual ao anterior)
        foods.forEach((f, index) => {
            const fDist = Math.sqrt(Math.pow(p.x - f.x, 2) + Math.pow(p.y - f.y, 2));
            if (fDist < 30) {
                if (f.value === p.equation.answer) {
                    p.score += 2;
                    p.equation = generateEquation();
                } else {
                    p.score = Math.max(5, p.score - 1);
                }
                foods.splice(index, 1);
                foods.push({
                    id: Math.random(), x: Math.random() * WORLD_SIZE, y: Math.random() * WORLD_SIZE,
                    value: Math.floor(Math.random() * 50), color: `hsl(${Math.random() * 360}, 100%, 50%)`
                });
            }
        });
    });

    io.emit('gameState', { players, foods });
}, 1000 / 30);

server.listen(process.env.PORT || 3000);

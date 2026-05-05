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

// Função para gerar matemática
function generateEquation() {
    const a1 = Math.floor(Math.random() * 10) + 1;
    const r = Math.floor(Math.random() * 5) + 1;
    const n = Math.floor(Math.random() * 8) + 3;
    return { text: `a₁=${a1}, r=${r}, a${n}=?`, answer: a1 + (n - 1) * r };
}

// O CÓDIGO QUE EU TINHA ESQUECIDO: Função para espalhar comida
function spawnFood(specificValue = null) {
    foods.push({
        id: Math.random().toString(),
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        value: specificValue !== null ? specificValue : Math.floor(Math.random() * 50) + 1,
        color: `hsl(${Math.random() * 360}, 100%, 60%)`
    });
}

// Encher o mapa inicialmente com 80 números
for (let i = 0; i < 80; i++) {
    spawnFood();
}

io.on('connection', (socket) => {
    socket.on('joinGame', (nickname) => {
        const startX = Math.random() * WORLD_SIZE;
        const startY = Math.random() * WORLD_SIZE;
        const eq = generateEquation();
        
        players[socket.id] = {
            id: socket.id,
            name: nickname || "Player",
            x: startX,
            y: startY,
            // CORREÇÃO DA COBRA PARALISADA: Ela não vai mais pro zero.
            targetX: startX, 
            targetY: startY,
            color: `hsl(${Math.random() * 360}, 80%, 50%)`,
            score: 5,
            history: [],
            equation: eq
        };
        
        // Garante que a resposta certa desta cobra nova está no mapa
        spawnFood(eq.answer);
    });

    socket.on('mouseMove', (data) => {
        // Evita que toques estranhos na tela enviem valores quebrados
        if (players[socket.id] && typeof data.x === 'number' && typeof data.y === 'number') {
            players[socket.id].targetX = data.x;
            players[socket.id].targetY = data.y;
        }
    });

    socket.on('disconnect', () => { 
        delete players[socket.id]; 
    });
});

// LOOP DE FÍSICA E COLISÃO
setInterval(() => {
    let playersArray = Object.values(players);

    playersArray.forEach(p => {
        // FÍSICA DE MOVIMENTO
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 5) {
            p.x += (dx / dist) * 7; // Velocidade da cobra
            p.y += (dy / dist) * 7;
        }

        // Não deixa a cobra fugir do mapa
        p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
        p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));

        p.history.unshift({ x: p.x, y: p.y });
        if (p.history.length > p.score * 4) p.history.pop();

        // COLISÃO COM OUTRAS COBRAS
        playersArray.forEach(other => {
            if (p.id === other.id) return;
            
            other.history.forEach((segment, index) => {
                if (index < 8) return; // Ignora o pescoço
                const d = Math.sqrt(Math.pow(p.x - segment.x, 2) + Math.pow(p.y - segment.y, 2));
                if (d < 20) {
                    p.score = 5; // Volta ao tamanho original
                    p.x = Math.random() * WORLD_SIZE;
                    p.y = Math.random() * WORLD_SIZE;
                    p.targetX = p.x;
                    p.targetY = p.y;
                    p.history = [];
                }
            });
        });

        // COLISÃO COM COMIDA
        for (let i = foods.length - 1; i >= 0; i--) {
            let f = foods[i];
            const fDist = Math.sqrt(Math.pow(p.x - f.x, 2) + Math.pow(p.y - f.y, 2));
            
            if (fDist < 30) {
                if (f.value === p.equation.answer) {
                    p.score += 2; // Acertou, cresce!
                    p.equation = generateEquation();
                    spawnFood(p.equation.answer); // Spawna a nova resposta
                } else {
                    p.score = Math.max(5, p.score - 1); // Errou, encolhe
                }
                
                foods.splice(i, 1);
                spawnFood(); // Repõe uma comida aleatória para não esvaziar o mapa
            }
        }
    });

    io.emit('gameState', { players, foods });
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));

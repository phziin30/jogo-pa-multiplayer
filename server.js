const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Configurações do Mundo
const WORLD_SIZE = 2000;
let players = {};
let foods = [];

// Função para gerar uma pergunta de PA
function generateEquation() {
    const a1 = Math.floor(Math.random() * 10) + 1;
    const r = Math.floor(Math.random() * 5) + 1;
    const n = Math.floor(Math.random() * 8) + 3;
    const answer = a1 + (n - 1) * r;
    return {
        text: `a₁=${a1} | r=${r} | a${n}=?`,
        answer: answer
    };
}

// Inicializa o mapa com números aleatórios
function spawnInitialFoods() {
    for (let i = 0; i < 100; i++) {
        foods.push({
            id: Math.random().toString(),
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            value: Math.floor(Math.random() * 50) + 1,
            color: `hsl(${Math.random() * 360}, 100%, 60%)`
        });
    }
}
spawnInitialFoods();

io.on('connection', (socket) => {
    const equation = generateEquation();
    
    players[socket.id] = {
        id: socket.id,
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        targetX: 0,
        targetY: 0,
        color: `hsl(${Math.random() * 360}, 80%, 50%)`,
        score: 5, // Tamanho inicial
        history: [], // Guarda o rastro para desenhar o corpo
        equation: equation
    };

    // Garante que a resposta certa existe no mapa
    spawnSpecificFood(equation.answer);

    socket.on('mouseMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].targetX = data.x;
            players[socket.id].targetY = data.y;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

function spawnSpecificFood(value) {
    foods.push({
        id: Math.random().toString(),
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        value: value,
        color: `hsl(${Math.random() * 360}, 100%, 60%)`
    });
}

// GAME LOOP: Roda a 30 frames por segundo no servidor
setInterval(() => {
    for (let id in players) {
        let p = players[id];
        
        // Lógica de Movimentação (Persegue o rato)
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 5) {
            p.x += (dx / dist) * 6; // Velocidade da cobra
            p.y += (dy / dist) * 6;
        }

        // Mantém a cobra dentro do mapa
        p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
        p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));

        // Guarda o histórico para o corpo da cobra
        p.history.unshift({ x: p.x, y: p.y });
        if (p.history.length > p.score * 4) {
            p.history.pop();
        }

        // Colisão com a Comida
        for (let i = foods.length - 1; i >= 0; i--) {
            let f = foods[i];
            let fDist = Math.sqrt(Math.pow(p.x - f.x, 2) + Math.pow(p.y - f.y, 2));
            
            if (fDist < 25) { // Raio de colisão
                if (f.value === p.equation.answer) {
                    p.score += 3; // Cresce se acertar
                    p.equation = generateEquation(); // Nova fórmula!
                    spawnSpecificFood(p.equation.answer); // Spawna a nova resposta
                } else {
                    p.score = Math.max(5, p.score - 1); // Encolhe se errar (mínimo 5)
                }
                
                // Remove a comida comida e spawna uma nova aleatória
                foods.splice(i, 1);
                foods.push({
                    id: Math.random().toString(),
                    x: Math.random() * WORLD_SIZE,
                    y: Math.random() * WORLD_SIZE,
                    value: Math.floor(Math.random() * 60) + 1,
                    color: `hsl(${Math.random() * 360}, 100%, 60%)`
                });
            }
        }
    }

    io.emit('gameState', { players, foods });
}, 1000 / 30);

server.listen(process.env.PORT || 3000, () => console.log('Servidor Snake PA rodando...'));

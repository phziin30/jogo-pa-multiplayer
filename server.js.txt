const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let players = {};
let turnOrder = [];
let currentTurnIndex = 0;

function generatePAQuestion() {
    const a1 = Math.floor(Math.random() * 10) + 1;
    const r = Math.floor(Math.random() * 5) + 1;
    const n = Math.floor(Math.random() * 10) + 3;
    const answer = a1 + (n - 1) * r;
    return {
        text: `Numa PA onde a1 = ${a1} e r = ${r}, qual o valor de a${n}?`,
        answer: answer
    };
}

io.on('connection', (socket) => {
    console.log('Novo jogador conectado:', socket.id);

    // Adiciona novo jogador
    players[socket.id] = {
        id: socket.id,
        pos: 0,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        name: `Jogador ${turnOrder.length + 1}`
    };
    turnOrder.push(socket.id);

    io.emit('updateGameState', { players, turn: turnOrder[currentTurnIndex] });

    socket.on('requestQuestion', () => {
        if (socket.id === turnOrder[currentTurnIndex]) {
            const question = generatePAQuestion();
            socket.emit('question', question);
        }
    });

    socket.on('submitAnswer', (data) => {
        if (socket.id !== turnOrder[currentTurnIndex]) return;

        const isCorrect = parseInt(data.userAnswer) === data.correctAnswer;
        let diceRoll = 0;

        if (isCorrect) {
            diceRoll = Math.floor(Math.random() * 6) + 1;
            players[socket.id].pos += diceRoll;
            if (players[socket.id].pos >= 30) players[socket.id].pos = 30; // Fim do tabuleiro
        }

        // Passa a vez
        currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
        
        io.emit('turnResult', {
            playerId: socket.id,
            isCorrect,
            diceRoll,
            newPos: players[socket.id].pos,
            nextTurn: turnOrder[currentTurnIndex]
        });
        
        io.emit('updateGameState', { players, turn: turnOrder[currentTurnIndex] });
    });

    socket.on('disconnect', () => {
        turnOrder = turnOrder.filter(id => id !== socket.id);
        delete players[socket.id];
        if (currentTurnIndex >= turnOrder.length) currentTurnIndex = 0;
        io.emit('updateGameState', { players, turn: turnOrder[currentTurnIndex] });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

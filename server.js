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
    return {
        text: `Dada a PA onde a1 = ${a1} e r = ${r}, calcule a${n}:`,
        answer: a1 + (n - 1) * r
    };
}

io.on('connection', (socket) => {
    players[socket.id] = {
        id: socket.id,
        pos: 0,
        color: turnOrder.length === 0 ? '#ff0044' : '#00ddff', // Jogador 1 vermelho, Jogador 2 azul
        name: `Jogador ${turnOrder.length + 1}`
    };
    turnOrder.push(socket.id);

    io.emit('updateGameState', { players, turn: turnOrder[currentTurnIndex] });

    socket.on('requestQuestion', () => {
        if (socket.id === turnOrder[currentTurnIndex]) {
            socket.emit('question', generatePAQuestion());
        }
    });

    socket.on('submitAnswer', (data) => {
        if (socket.id !== turnOrder[currentTurnIndex]) return;

        const isCorrect = parseInt(data.userAnswer) === data.correctAnswer;
        let diceRoll = 0;
        let bonusMessage = "";
        let playAgain = false;

        if (isCorrect) {
            diceRoll = Math.floor(Math.random() * 6) + 1;
            let tempPos = players[socket.id].pos + diceRoll;

            // Lógica das Prendas (Casas 5, 10, 15, 20, 25)
            if (tempPos === 5) { tempPos += 2; bonusMessage = "Gabaritou Álgebra Linear! Avance 2 casas."; }
            else if (tempPos === 10) { tempPos -= 2; bonusMessage = "O servidor da UNIFOR caiu. Volte 2 casas."; }
            else if (tempPos === 15) { playAgain = true; bonusMessage = "Otimizou o código! Jogue novamente."; }
            else if (tempPos === 20) { tempPos -= 2; bonusMessage = "Deixou uma vulnerabilidade no sistema! Volte 2 casas."; }
            else if (tempPos === 25) { tempPos += 2; bonusMessage = "Resolveu a integral de primeira! Avance 2 casas."; }

            if (tempPos > 30) tempPos = 30;
            players[socket.id].pos = tempPos;
        }

        // Passa a vez se errar ou se não tiver o bônus de jogar de novo
        if (!isCorrect || !playAgain) {
            currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
        }
        
        io.emit('turnResult', {
            playerId: socket.id,
            isCorrect,
            diceRoll,
            bonusMessage,
            newPos: players[socket.id].pos,
            nextTurn: turnOrder[currentTurnIndex]
        });
    });

    socket.on('disconnect', () => {
        turnOrder = turnOrder.filter(id => id !== socket.id);
        delete players[socket.id];
        if (turnOrder.length > 0) currentTurnIndex = currentTurnIndex % turnOrder.length;
        io.emit('updateGameState', { players, turn: turnOrder[currentTurnIndex] });
    });
});

server.listen(process.env.PORT || 3000);

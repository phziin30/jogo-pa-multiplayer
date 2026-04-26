 
const socket = io();
let myId = null;

// Elementos da Interface
const boardEl = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const btnQuestion = document.getElementById('btn-question');
const questionBox = document.getElementById('question-box');
const answerInput = document.getElementById('answer-input');
const logEl = document.getElementById('log');

// Sons
const playSound = (id) => document.getElementById(id).play().catch(()=>{});

// Gerar Tabuleiro
for (let i = 1; i <= 30; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.id = `cell-${i}`;
    cell.innerText = i;
    if (i % 5 === 0) cell.innerText += ' 🎁'; // Ícone nas casas de prenda
    boardEl.appendChild(cell);
}

socket.on('connect', () => myId = socket.id);

socket.on('updateGameState', (state) => {
    document.querySelectorAll('.player-token').forEach(t => t.remove());

    const isMyTurn = state.turn === myId;
    btnQuestion.disabled = !isMyTurn;
    turnIndicator.innerText = isMyTurn ? "SUA VEZ! ROLE O DADO." : "Turno do adversário...";
    turnIndicator.style.color = isMyTurn ? "#58a6ff" : "#ff7b72";

    if (!isMyTurn) questionBox.classList.add('hidden');

    Object.values(state.players).forEach(player => {
        if (player.pos > 0) {
            const cell = document.getElementById(`cell-${player.pos}`);
            const token = document.createElement('div');
            token.className = 'player-token';
            token.style.backgroundColor = player.color;
            token.style.color = player.color; // Para o brilho (box-shadow)
            cell.appendChild(token);
        }
    });
});

btnQuestion.addEventListener('click', () => {
    socket.emit('requestQuestion');
    btnQuestion.disabled = true;
});

socket.on('question', (data) => {
    document.getElementById('question-text').innerText = data.text;
    answerInput.value = '';
    questionBox.classList.remove('hidden');
});

document.getElementById('btn-submit').addEventListener('click', () => {
    if (answerInput.value === '') return;
    socket.emit('submitAnswer', {
        userAnswer: answerInput.value,
        correctAnswer: currentQuestion.answer
    });
    questionBox.classList.add('hidden');
});
socket.on('question', (data) => { currentQuestion = data; }); // Atualiza pergunta local

socket.on('turnResult', (data) => {
    const isMe = data.playerId === myId;
    
    if (data.isCorrect) {
        playSound('sfx-correct');
        animateDice(data.diceRoll, () => {
            playSound('sfx-move');
            logTurn(isMe ? `Acertou! ROLOU ${data.diceRoll}.` : `Adversário acertou e rolou ${data.diceRoll}.`, "#3fb950");
            
            if (data.bonusMessage) {
                setTimeout(() => {
                    playSound('sfx-bonus');
                    logTurn(`🎁 PRENDA: ${data.bonusMessage}`, "gold");
                    socket.emit('requestUpdate'); // Força sincronização após o bônus
                }, 1000); // Mostra o bônus logo após mover
            }
        });
    } else {
        playSound('sfx-wrong');
        logTurn(isMe ? "Errou a PA! Passou a vez." : "O adversário errou a conta.", "#f85149");
    }
});

// Animação 3D simulada do Dado na Tela
function animateDice(resultNumber, callback) {
    const container = document.getElementById('dice-container');
    const dice = document.getElementById('dice');
    document.getElementById('dice-result-text').innerText = "Rolando...";
    container.classList.remove('hidden');
    
    playSound('sfx-roll');
    
    let rolls = 0;
    const interval = setInterval(() => {
        dice.innerText = Math.floor(Math.random() * 6) + 1;
        dice.style.transform = `rotate(${Math.random() * 360}deg) scale(${1 + Math.random()*0.2})`;
        rolls++;
        
        if (rolls > 15) {
            clearInterval(interval);
            dice.innerText = resultNumber;
            dice.style.transform = 'rotate(0deg) scale(1.3)';
            document.getElementById('dice-result-text').innerText = `Você tirou ${resultNumber}!`;
            
            setTimeout(() => {
                container.classList.add('hidden');
                callback();
            }, 1500);
        }
    }, 100);
}

function logTurn(msg, color) {
    const p = document.createElement('p');
    p.innerText = msg;
    p.style.color = color;
    logEl.prepend(p);
}

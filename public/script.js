
const socket = io();

const boardEl = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const btnQuestion = document.getElementById('btn-question');
const questionBox = document.getElementById('question-box');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer-input');
const btnSubmit = document.getElementById('btn-submit');
const logEl = document.getElementById('log');

let myId = null;
let currentQuestion = null;

// Desenha o tabuleiro de 30 casas
for (let i = 0; i < 30; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.id = `cell-${i}`;
    cell.innerText = i + 1;
    boardEl.appendChild(cell);
}

// Quando ligamos ao servidor, guardamos o nosso ID
socket.on('connect', () => {
    myId = socket.id;
});

// Atualiza o estado visual do jogo (posições e turnos)
socket.on('updateGameState', (state) => {
    // Limpa todos os pinos do tabuleiro
    document.querySelectorAll('.player-token').forEach(token => token.remove());

    const isMyTurn = state.turn === myId;
    btnQuestion.disabled = !isMyTurn;

    if (isMyTurn) {
        turnIndicator.innerText = "É a tua vez! Pede uma pergunta.";
        turnIndicator.style.color = "green";
    } else {
        turnIndicator.innerText = "Aguarda a vez do adversário...";
        turnIndicator.style.color = "red";
        questionBox.classList.add('hidden'); // Esconde a pergunta se não for o turno
    }

    // Desenha os pinos nas novas posições
    Object.values(state.players).forEach(player => {
        const cell = document.getElementById(`cell-${player.pos}`);
        if (cell) {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.style.backgroundColor = player.color;
            token.title = player.name; // Mostra o nome ao passar o rato
            cell.appendChild(token);
        }
    });
});

// Pedir pergunta ao servidor
btnQuestion.addEventListener('click', () => {
    socket.emit('requestQuestion');
    btnQuestion.disabled = true;
});

// Receber a pergunta e mostrar no ecrã
socket.on('question', (data) => {
    currentQuestion = data;
    questionText.innerText = data.text;
    answerInput.value = '';
    questionBox.classList.remove('hidden');
});

// Enviar a resposta
btnSubmit.addEventListener('click', () => {
    if (answerInput.value === '') return;
    
    socket.emit('submitAnswer', {
        userAnswer: answerInput.value,
        correctAnswer: currentQuestion.answer
    });
    
    questionBox.classList.add('hidden');
});

// Mostra o que aconteceu na jogada (Feedback)
socket.on('turnResult', (data) => {
    const isMe = data.playerId === myId;
    let message = '';

    if (data.isCorrect) {
        message = isMe 
            ? `Acertaste! O dado rolou ${data.diceRoll} e avançaste no tabuleiro.` 
            : `O adversário acertou e andou ${data.diceRoll} casas.`;
    } else {
        message = isMe 
            ? `Erraste a pergunta de PA. Passaste a vez.` 
            : `O adversário errou e passou a vez.`;
    }

    const logMsg = document.createElement('p');
    logMsg.innerText = message;
    logEl.prepend(logMsg); // Coloca a mensagem mais recente no topo
});

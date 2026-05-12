/**
 * CHESS MASTER - PREMIUM EDITION
 * Complete Javascript Engine & UI Controller
 */

// ============================================================================
// 1. AUDIO SYSTEM (Synthesized & Base64 sounds)
// ============================================================================
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(freq, type, duration, vol) {
    if (!gameState.soundEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const Sounds = {
    move: () => playTone(300, 'sine', 0.1, 0.5),
    capture: () => { playTone(200, 'square', 0.1, 0.5); setTimeout(() => playTone(150, 'square', 0.15, 0.6), 50); },
    check: () => { playTone(600, 'triangle', 0.4, 0.4); playTone(800, 'triangle', 0.4, 0.3); },
    win: () => { [400, 500, 600, 800].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.3, 0.5), i * 150)); },
    lose: () => { [400, 350, 300, 250].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.4, 0.5), i * 200)); }
};

// ============================================================================
// 2. CHESS CONSTANTS & CONFIG
// ============================================================================
const PIECES = {
    w: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

// Starting FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
const START_BOARD = [
    ['b_r', 'b_n', 'b_b', 'b_q', 'b_k', 'b_b', 'b_n', 'b_r'],
    ['b_p', 'b_p', 'b_p', 'b_p', 'b_p', 'b_p', 'b_p', 'b_p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['w_p', 'w_p', 'w_p', 'w_p', 'w_p', 'w_p', 'w_p', 'w_p'],
    ['w_r', 'w_n', 'w_b', 'w_q', 'w_k', 'w_b', 'w_n', 'w_r']
];

let gameState = {
    board: JSON.parse(JSON.stringify(START_BOARD)),
    turn: 'w',
    castling: { w: {k: true, q: true}, b: {k: true, q: true} },
    enPassantMarker: null, // {r, c}
    halfMoves: 0,
    history: [], // Stores full state for undo
    moveList: [], // Algebraic notation
    status: 'playing', // playing, checkmate, stalemate
    difficulty: 6, // 1-15
    soundEnabled: true,
    theme: 'theme-royal-gold',
    captured: { w: [], b: [] },
    playerColor: 'w' // AI is 'b'
};

// ============================================================================
// 3. CORE LOGIC (Move generation & validation)
// ============================================================================

// Utility to deep copy state
function cloneState(state) {
    return {
        board: state.board.map(row => [...row]),
        turn: state.turn,
        castling: { w: {...state.castling.w}, b: {...state.castling.b} },
        enPassantMarker: state.enPassantMarker ? {...state.enPassantMarker} : null,
        halfMoves: state.halfMoves
    };
}

// Convert r,c to index 0-63 or string "e2"
function toSquare(r, c) { return String.fromCharCode(97 + c) + (8 - r); }

function isInside(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function getPiece(board, r, c) {
    if (!isInside(r, c)) return null;
    return board[r][c];
}

// Direction vectors
const DIRS = {
    n: [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]], // Knight
    b: [[-1,-1], [-1,1], [1,-1], [1,1]], // Bishop
    r: [[-1,0], [1,0], [0,-1], [0,1]], // Rook
    q: [[-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]], // Queen/King
};

function generatePseudoLegalMoves(state, forColor) {
    let moves = [];
    const board = state.board;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece || piece[0] !== forColor) continue;
            
            const type = piece[2];
            const isWhite = forColor === 'w';
            const dir = isWhite ? -1 : 1;
            
            // PAWN
            if (type === 'p') {
                // Forward 1
                if (isInside(r + dir, c) && !board[r + dir][c]) {
                    addPawnMove(moves, r, c, r + dir, c, null);
                    // Forward 2
                    const startRow = isWhite ? 6 : 1;
                    if (r === startRow && !board[r + dir * 2][c]) {
                        moves.push({from: {r, c}, to: {r: r + dir * 2, c}, flags: 'b'}); // Big pawn push
                    }
                }
                // Capture Left
                if (isInside(r + dir, c - 1)) {
                    if (board[r + dir][c - 1] && board[r + dir][c - 1][0] !== forColor) {
                        addPawnMove(moves, r, c, r + dir, c - 1, board[r + dir][c - 1]);
                    } else if (state.enPassantMarker && state.enPassantMarker.r === r + dir && state.enPassantMarker.c === c - 1) {
                        moves.push({from: {r, c}, to: {r: r + dir, c: c - 1}, flags: 'e'}); // En passant
                    }
                }
                // Capture Right
                if (isInside(r + dir, c + 1)) {
                    if (board[r + dir][c + 1] && board[r + dir][c + 1][0] !== forColor) {
                        addPawnMove(moves, r, c, r + dir, c + 1, board[r + dir][c + 1]);
                    } else if (state.enPassantMarker && state.enPassantMarker.r === r + dir && state.enPassantMarker.c === c + 1) {
                        moves.push({from: {r, c}, to: {r: r + dir, c: c + 1}, flags: 'e'}); // En passant
                    }
                }
            }
            // KNIGHT, KING (Step pieces)
            else if (type === 'n' || type === 'k') {
                const dirs = DIRS[type === 'n' ? 'n' : 'q'];
                for (let d of dirs) {
                    const nr = r + d[0], nc = c + d[1];
                    if (isInside(nr, nc)) {
                        const target = board[nr][nc];
                        if (!target || target[0] !== forColor) {
                            moves.push({from: {r, c}, to: {r: nr, c: nc}});
                        }
                    }
                }
            }
            // BISHOP, ROOK, QUEEN (Sliding pieces)
            else {
                const dirs = type === 'b' ? DIRS.b : type === 'r' ? DIRS.r : DIRS.q;
                for (let d of dirs) {
                    let nr = r + d[0], nc = c + d[1];
                    while (isInside(nr, nc)) {
                        const target = board[nr][nc];
                        if (!target) {
                            moves.push({from: {r, c}, to: {r: nr, c: nc}});
                        } else {
                            if (target[0] !== forColor) {
                                moves.push({from: {r, c}, to: {r: nr, c: nc}});
                            }
                            break;
                        }
                        nr += d[0]; nc += d[1];
                    }
                }
            }
        }
    }
    
    // CASTLING
    if (!isAttacked(state, forColor === 'w' ? 'b' : 'w')) { // Cannot castle out of check
        const kRow = forColor === 'w' ? 7 : 0;
        // Kingside
        if (state.castling[forColor].k) {
            if (!board[kRow][5] && !board[kRow][6]) {
                // Check if squares passed through are attacked
                if (!isSquareAttacked(state, kRow, 5, forColor === 'w' ? 'b' : 'w') && 
                    !isSquareAttacked(state, kRow, 6, forColor === 'w' ? 'b' : 'w')) {
                    moves.push({from: {r: kRow, c: 4}, to: {r: kRow, c: 6}, flags: 'k'});
                }
            }
        }
        // Queenside
        if (state.castling[forColor].q) {
            if (!board[kRow][3] && !board[kRow][2] && !board[kRow][1]) {
                if (!isSquareAttacked(state, kRow, 3, forColor === 'w' ? 'b' : 'w') && 
                    !isSquareAttacked(state, kRow, 2, forColor === 'w' ? 'b' : 'w')) {
                    moves.push({from: {r: kRow, c: 4}, to: {r: kRow, c: 2}, flags: 'q'});
                }
            }
        }
    }
    
    return moves;
}

function addPawnMove(moves, r1, c1, r2, c2, target) {
    if (r2 === 0 || r2 === 7) { // Promotion
        moves.push({from: {r: r1, c: c1}, to: {r: r2, c: c2}, promotion: 'q'});
        moves.push({from: {r: r1, c: c1}, to: {r: r2, c: c2}, promotion: 'r'});
        moves.push({from: {r: r1, c: c1}, to: {r: r2, c: c2}, promotion: 'b'});
        moves.push({from: {r: r1, c: c1}, to: {r: r2, c: c2}, promotion: 'n'});
    } else {
        moves.push({from: {r: r1, c: c1}, to: {r: r2, c: c2}});
    }
}

// Check if current king is attacked
function isAttacked(state, attackingColor) {
    // Find king
    let kr = -1, kc = -1;
    const targetColor = attackingColor === 'w' ? 'b' : 'w';
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            if (state.board[i][j] === targetColor + '_k') {
                kr = i; kc = j; break;
            }
        }
        if (kr !== -1) break;
    }
    if (kr === -1) return false;
    return isSquareAttacked(state, kr, kc, attackingColor);
}

function isSquareAttacked(state, r, c, attackingColor) {
    const board = state.board;
    const isW = attackingColor === 'w';
    
    // Pawn attacks
    const pawnDir = isW ? 1 : -1;
    if (isInside(r + pawnDir, c - 1) && board[r + pawnDir][c - 1] === attackingColor + '_p') return true;
    if (isInside(r + pawnDir, c + 1) && board[r + pawnDir][c + 1] === attackingColor + '_p') return true;
    
    // Knight
    for (let d of DIRS.n) {
        if (isInside(r + d[0], c + d[1]) && board[r + d[0]][c + d[1]] === attackingColor + '_n') return true;
    }
    
    // King
    for (let d of DIRS.q) {
        if (isInside(r + d[0], c + d[1]) && board[r + d[0]][c + d[1]] === attackingColor + '_k') return true;
    }
    
    // Sliding (B, R, Q)
    const slDir = [...DIRS.b, ...DIRS.r];
    for (let i = 0; i < slDir.length; i++) {
        const d = slDir[i];
        let nr = r + d[0], nc = c + d[1];
        while (isInside(nr, nc)) {
            const piece = board[nr][nc];
            if (piece) {
                if (piece[0] === attackingColor) {
                    const type = piece[2];
                    if (type === 'q') return true;
                    if (i < 4 && type === 'b') return true; // Diagonal -> Bishop
                    if (i >= 4 && type === 'r') return true; // Orthogonal -> Rook
                }
                break;
            }
            nr += d[0]; nc += d[1];
        }
    }
    return false;
}

function getLegalMoves(state, forColor) {
    const pseudo = generatePseudoLegalMoves(state, forColor);
    return pseudo.filter(move => {
        const nextState = applyMove(state, move);
        return !isAttacked(nextState, forColor === 'w' ? 'b' : 'w');
    });
}

function applyMove(state, move) {
    let nextState = cloneState(state);
    const board = nextState.board;
    const pieceStr = board[move.from.r][move.from.c];
    const targetStr = board[move.to.r][move.to.c];
    const color = pieceStr[0];
    const isW = color === 'w';
    
    // Update piece position
    board[move.to.r][move.to.c] = pieceStr;
    board[move.from.r][move.from.c] = null;
    
    // Handle Flags
    if (move.flags === 'b') { // Big pawn
        nextState.enPassantMarker = { r: move.from.r + (isW ? -1 : 1), c: move.from.c };
    } else {
        nextState.enPassantMarker = null;
    }
    
    if (move.flags === 'e') { // En passant capture
        board[move.from.r][move.to.c] = null;
    }
    
    if (move.flags === 'k') { // Kingside castle
        board[move.to.r][5] = board[move.to.r][7];
        board[move.to.r][7] = null;
    }
    
    if (move.flags === 'q') { // Queenside castle
        board[move.to.r][3] = board[move.to.r][0];
        board[move.to.r][0] = null;
    }
    
    if (move.promotion) {
        board[move.to.r][move.to.c] = color + '_' + move.promotion;
    }
    
    // Update Castling availability
    if (pieceStr[2] === 'k') {
        nextState.castling[color].k = false;
        nextState.castling[color].q = false;
    }
    if (pieceStr[2] === 'r') {
        if (move.from.c === 0) nextState.castling[color].q = false;
        if (move.from.c === 7) nextState.castling[color].k = false;
    }
    if (targetStr && targetStr[2] === 'r') { // If a rook is captured, remove its right to castle
        const opp = color === 'w' ? 'b' : 'w';
        if (move.to.c === 0 && move.to.r === (isW ? 0 : 7)) nextState.castling[opp].q = false;
        if (move.to.c === 7 && move.to.r === (isW ? 0 : 7)) nextState.castling[opp].k = false;
    }
    
    nextState.turn = isW ? 'b' : 'w';
    return nextState;
}

// ============================================================================
// 4. UI Rendering & Interaction
// ============================================================================

const boardEl = document.getElementById('chess-board');
const piecesLayerEl = document.getElementById('pieces-layer');
let selectedSquare = null;
let currentLegalMoves = [];
let pendingPromotionMove = null;
let isBoardInitialized = false;
let piecesDOM = [];

function initBoardDOM() {
    boardEl.innerHTML = '';
    piecesLayerEl.innerHTML = '';
    piecesDOM = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sqEl = document.createElement('div');
            sqEl.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            sqEl.dataset.r = r;
            sqEl.dataset.c = c;
            sqEl.id = `sq-${r}-${c}`;
            sqEl.addEventListener('click', () => handleSquareClick(r, c));
            boardEl.appendChild(sqEl);
        }
    }
    isBoardInitialized = true;
}

function renderBoard() {
    if (!isBoardInitialized) initBoardDOM();

    const isChecks = isAttacked(gameState, gameState.turn === 'w' ? 'b' : 'w');
    let kingInCheckSq = null;
    
    if (isChecks) {
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                if(gameState.board[r][c] === gameState.turn + '_k') kingInCheckSq = {r, c};
            }
        }
    }

    const lastMove = gameState.history.length > 0 ? gameState.history[gameState.history.length - 1].lastMove : null;

    // Update squares
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sqEl = document.getElementById(`sq-${r}-${c}`);
            sqEl.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            
            if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
                sqEl.classList.add('last-move');
            }
            if (kingInCheckSq && kingInCheckSq.r === r && kingInCheckSq.c === c) {
                sqEl.classList.add('in-check');
            }
            if (selectedSquare) {
                const moveTarget = currentLegalMoves.find(m => m.to.r === r && m.to.c === c);
                if (moveTarget) {
                    sqEl.classList.add(gameState.board[r][c] ? 'valid-capture' : 'valid-move');
                }
            }
        }
    }

    // Update Pieces (Reconciliation for smooth transform animation)
    let targetPieces = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c]) {
                targetPieces.push({ r, c, type: gameState.board[r][c] });
            }
        }
    }

    let usedDOMs = new Set();
    
    targetPieces.forEach(tp => {
        let exactMatch = piecesDOM.find(dp => dp.type === tp.type && dp.r === tp.r && dp.c === tp.c && !usedDOMs.has(dp));
        if (exactMatch) { tp.dom = exactMatch; usedDOMs.add(exactMatch); }
    });

    targetPieces.forEach(tp => {
        if (!tp.dom) {
            let anyMatch = piecesDOM.find(dp => dp.type === tp.type && !usedDOMs.has(dp));
            if (anyMatch) { tp.dom = anyMatch; usedDOMs.add(anyMatch); }
            else {
                const el = document.createElement('div');
                const color = tp.type[0];
                const pieceType = tp.type[2];
                el.className = `piece ${color}`;
                el.innerText = PIECES[color][pieceType];
                piecesLayerEl.appendChild(el);
                
                let newDP = { type: tp.type, el: el };
                piecesDOM.push(newDP);
                tp.dom = newDP;
                usedDOMs.add(newDP);
            }
        }
    });

    piecesDOM = piecesDOM.filter(dp => {
        if (!usedDOMs.has(dp)) { dp.el.remove(); return false; }
        return true;
    });

    targetPieces.forEach(tp => {
        tp.dom.r = tp.r; tp.dom.c = tp.c;
        // Absolute positioning using percentages guarantees perfect grid alignments without transform sizing issues
        tp.dom.el.style.left = `${tp.c * 12.5}%`;
        tp.dom.el.style.top = `${tp.r * 12.5}%`;
        tp.dom.el.style.transform = 'none'; // Reset to let selected state take over transform
        
        if (selectedSquare && selectedSquare.r === tp.r && selectedSquare.c === tp.c) {
            tp.dom.el.classList.add('selected');
        } else {
            tp.dom.el.classList.remove('selected');
        }
    });
    
    updatePanels();
}

function handleSquareClick(r, c) {
    if (gameState.status !== 'playing' || gameState.turn !== gameState.playerColor) return;
    
    if (selectedSquare) {
        // Try to move
        if (tryMove(selectedSquare.r, selectedSquare.c, r, c)) {
            return;
        }
    }
    
    const piece = gameState.board[r][c];
    if (piece && piece[0] === gameState.turn) {
        selectedSquare = {r, c};
        currentLegalMoves = getLegalMoves(gameState, gameState.turn).filter(m => m.from.r === r && m.from.c === c);
        renderBoard();
        Sounds.move(); // Soft click sound
    } else {
        selectedSquare = null;
        currentLegalMoves = [];
        renderBoard();
    }
}

function tryMove(fr, fc, tr, tc) {
    const move = currentLegalMoves.find(m => m.to.r === tr && m.to.c === tc);
    if (!move) return false;

    // Check promotion
    if (move.promotion && !pendingPromotionMove) {
        // Show modal instead of playing move immediately
        pendingPromotionMove = move;
        document.getElementById('modal-promotion').classList.remove('hidden');
        return true;
    }
    
    executeMove(move);
    return true;
}

// User selects promotion piece
document.querySelectorAll('.promo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!pendingPromotionMove) return;
        const pType = btn.dataset.piece;
        
        // Find the specific promotion move
        const allPromo = currentLegalMoves.filter(m => m.to.r === pendingPromotionMove.to.r && m.to.c === pendingPromotionMove.to.c);
        const finalMove = allPromo.find(m => m.promotion === pType);
        
        document.getElementById('modal-promotion').classList.add('hidden');
        pendingPromotionMove = null;
        executeMove(finalMove);
    });
});

function executeMove(move) {
    selectedSquare = null;
    currentLegalMoves = [];
    
    // Save state for undo
    // Before applying, capture notation
    const notation = getNotation(gameState, move);
    const targetStr = gameState.board[move.to.r][move.to.c];
    const isCapture = !!targetStr || move.flags === 'e';
    
    gameState.history.push({
        stateStr: JSON.stringify(gameState),
        lastMove: move
    });
    gameState.moveList.push(notation);
    
    if (isCapture) {
        if (move.flags === 'e') {
            gameState.captured[gameState.turn].push(gameState.turn === 'w' ? 'b_p' : 'w_p');
        } else {
            gameState.captured[gameState.turn].push(targetStr);
        }
        Sounds.capture();
    } else {
        Sounds.move();
    }
    
    const nextState = applyMove(gameState, move);
    Object.assign(gameState, {
        board: nextState.board,
        turn: nextState.turn,
        castling: nextState.castling,
        enPassantMarker: nextState.enPassantMarker,
        halfMoves: nextState.halfMoves
    });
    
    // Generate opponent's legal moves to check mate/draw
    const oppMoves = getLegalMoves(gameState, gameState.turn);
    const inCheck = isAttacked(gameState, gameState.turn === 'w' ? 'b' : 'w');
    
    if (inCheck) Sounds.check();
    
    if (oppMoves.length === 0) {
        if (inCheck) {
            gameState.status = 'checkmate';
            setTimeout(() => showGameOver('Checkmate!', `${gameState.turn === 'w' ? 'Black' : 'White'} wins the game.`), 1000);
            Sounds.win(); // Assuming player checkmated AI, if not we play lose
        } else {
            gameState.status = 'stalemate';
            setTimeout(() => showGameOver('Stalemate', 'The game is a draw.'), 1000);
        }
    }
    
    renderBoard();
    
    if (gameState.status === 'playing' && gameState.turn !== gameState.playerColor) {
        // AI Turn
        setTimeout(makeAIMove, 500);
    }
}

function getNotation(state, move) {
    const piece = state.board[move.from.r][move.from.c];
    const type = piece[2];
    const cap = (state.board[move.to.r][move.to.c] || move.flags === 'e') ? 'x' : '';
    const dest = toSquare(move.to.r, move.to.c);
    
    if (move.flags === 'k') return "O-O";
    if (move.flags === 'q') return "O-O-O";
    
    let p = type === 'p' ? '' : type.toUpperCase();
    if (type === 'p' && cap) p = String.fromCharCode(97 + move.from.c);
    
    let promo = move.promotion ? '=' + move.promotion.toUpperCase() : '';
    
    return p + cap + dest + promo;
}

// ============================================================================
// 5. AI LOGIC (Minimax + Alpha Beta + Piece Square Tables)
// ============================================================================

// Piece values
const VALS = { p: 10, n: 32, b: 33, r: 50, q: 90, k: 20000 };

// Center control tables (bonus layout)
const PST_P = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5,  5,  5,  5,  5,  5,  5,  5],
    [1,  1,  2,  3,  3,  2,  1,  1],
    [0.5,0.5,1,  2.5,2.5,1,  0.5,0.5],
    [0,  0,  0,  2,  2,  0,  0,  0],
    [0.5,-0.5,-1,  0,  0,-1,-0.5,0.5],
    [0.5, 1, 1,  -2,-2,  1, 1, 0.5],
    [0,  0,  0,  0,  0,  0,  0,  0]
];
const PST_N = [
    [-5, -4, -3, -3, -3, -3, -4, -5],
    [-4, -2,  0,  0,  0,  0, -2, -4],
    [-3,  0,  1,  1.5,1.5,1,  0, -3],
    [-3,  0.5,1.5,2,  2,  1.5,0.5,-3],
    [-3,  0,  1.5,2,  2,  1.5,0, -3],
    [-3,  0.5,1,  1.5,1.5,1,  0.5,-3],
    [-4, -2,  0,  0.5,0.5,0, -2, -4],
    [-5, -4, -3, -3, -3, -3, -4, -5]
];

function evaluate(state) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = state.board[r][c];
            if (piece) {
                const color = piece[0];
                const type = piece[2];
                let val = VALS[type];
                
                // Add positional bonus
                let sqVal = 0;
                let pstRow = color === 'w' ? r : 7 - r; 
                if (type === 'p') sqVal = PST_P[pstRow][c];
                if (type === 'n') sqVal = PST_N[pstRow][c];
                // Center bonus for others roughly
                if (type === 'b' || type === 'q') {
                    sqVal = (3 - Math.abs(r - 3.5) + 3 - Math.abs(c - 3.5)) * 0.2;
                }
                
                val += sqVal;
                score += color === 'w' ? val : -val;
            }
        }
    }
    return score;
}

let aiNodes = 0;

function minimax(state, depth, alpha, beta, isMax) {
    if (depth === 0) return evaluate(state);
    
    aiNodes++;
    const forColor = isMax ? 'w' : 'b';
    const moves = getLegalMoves(state, forColor);
    
    if (moves.length === 0) {
        if (isAttacked(state, forColor === 'w' ? 'b' : 'w')) {
            return isMax ? -99999 + depth : 99999 - depth; 
        }
        return 0; // stalemate
    }
    
    // Very simple move ordering: Captures first
    moves.sort((a,b) => {
        let scA = state.board[a.to.r][a.to.c] ? 10 : 0;
        let scB = state.board[b.to.r][b.to.c] ? 10 : 0;
        return scB - scA;
    });

    if (isMax) {
        let maxEvaluation = -Infinity;
        for (let move of moves) {
            let evaluation = minimax(applyMove(state, move), depth - 1, alpha, beta, false);
            maxEvaluation = Math.max(maxEvaluation, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEvaluation;
    } else {
        let minEvaluation = Infinity;
        for (let move of moves) {
            let evaluation = minimax(applyMove(state, move), depth - 1, alpha, beta, true);
            minEvaluation = Math.min(minEvaluation, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEvaluation;
    }
}

function makeAIMove() {
    gameState.aiThinking = true;
    document.getElementById('turn-indicator').innerText = "AI Thinking...";
    
    setTimeout(() => {
        const moves = getLegalMoves(gameState, 'b');
        if (moves.length === 0) return;
        
        let bestMove = moves[0];
        
        // Difficulty handling
        const lvl = gameState.difficulty;
        
        if (lvl <= 3) {
            // Random move
            bestMove = moves[Math.floor(Math.random() * moves.length)];
        } else {
            // Minimax
            let depth = 1;
            if (lvl >= 4 && lvl <= 7) depth = 2;
            if (lvl >= 8 && lvl <= 12) depth = 3;
            if (lvl >= 13) depth = 4; // Max realistic JS depth without WebWorkers
            
            let bestVal = Infinity;
            aiNodes = 0;
            
            // Randomize moves slightly so it doesn't play exact same games
            moves.sort(() => Math.random() - 0.5);
            
            // Try capture moves first for pruning
            moves.sort((a,b) => (gameState.board[b.to.r][b.to.c] ? 10 : 0) - (gameState.board[a.to.r][a.to.c] ? 10 : 0));

            for (let move of moves) {
                let evaluation = minimax(applyMove(gameState, move), depth - 1, -Infinity, Infinity, true);
                if (evaluation < bestVal) {
                    bestVal = evaluation;
                    bestMove = move;
                }
            }
        }
        
        gameState.aiThinking = false;
        
        // Auto-promote AI to queen for simplicity
        if (bestMove.promotion) bestMove.promotion = 'q';
        
        executeMove(bestMove);
        
    }, 100);
}

// ============================================================================
// 6. UI UPDATES & EVENT LISTENERS
// ============================================================================

function updatePanels() {
    // Turn
    const tnEl = document.getElementById('turn-indicator');
    const aiBox = document.querySelector('.ai-info');
    const userBox = document.querySelector('.user-info');

    if (!gameState.aiThinking) {
        tnEl.innerText = gameState.turn === 'w' ? "White's Turn" : "Black's Turn";
        tnEl.className = `turn-indicator ${gameState.turn === 'w' ? 'white-turn' : 'black-turn'}`;
        
        // Mobile premium active state
        if (gameState.turn === 'w') {
            userBox.classList.add('active-turn');
            aiBox.classList.remove('active-turn');
        } else {
            userBox.classList.remove('active-turn');
            aiBox.classList.add('active-turn');
        }
    } else {
        // AI Thinking state
        aiBox.classList.add('active-turn');
        userBox.classList.remove('active-turn');
    }

    // Moves
    const histEl = document.getElementById('move-history');
    histEl.innerHTML = '';
    for(let i=0; i<gameState.moveList.length; i+=2) {
        const row = document.createElement('div');
        row.className = 'move-row';
        row.innerHTML = `<span class="move-num">${(i/2)+1}.</span>
                         <span class="move-w">${gameState.moveList[i]}</span>
                         <span class="move-b">${gameState.moveList[i+1] || ''}</span>`;
        histEl.appendChild(row);
    }
    histEl.scrollTop = histEl.scrollHeight;

    // Captured
    document.getElementById('white-captured').innerText = gameState.captured.w.map(p => PIECES[p[0]][p[2]]).join(' ');
    document.getElementById('black-captured').innerText = gameState.captured.b.map(p => PIECES[p[0]][p[2]]).join(' ');
    
    // Save to local storage
    localStorage.setItem('chessMasterTheme', gameState.theme);
    localStorage.setItem('chessMasterLevel', gameState.difficulty);
    localStorage.setItem('chessSound', gameState.soundEnabled);
}

// Undo
document.getElementById('btn-undo').addEventListener('click', () => {
    if (gameState.history.length >= 2) {
        // Pop AI's move and Player's move
        gameState.history.pop();
        const prev = JSON.parse(gameState.history.pop().stateStr);
        gameState = prev;
        gameState.moveList.splice(-2, 2);
        selectedSquare = null;
        currentLegalMoves = [];
        renderBoard();
    }
});

// Restart
function restartGame() {
    gameState = {
        board: JSON.parse(JSON.stringify(START_BOARD)),
        turn: 'w',
        castling: { w: {k: true, q: true}, b: {k: true, q: true} },
        enPassantMarker: null,
        halfMoves: 0,
        history: [],
        moveList: [],
        status: 'playing',
        difficulty: gameState.difficulty || 6,
        soundEnabled: gameState.soundEnabled,
        theme: gameState.theme,
        captured: { w: [], b: [] },
        playerColor: 'w'
    };
    document.getElementById('modal-game-over').classList.add('hidden');
    isBoardInitialized = false;
    renderBoard();
}
document.getElementById('btn-restart').addEventListener('click', restartGame);
document.getElementById('btn-game-over-restart').addEventListener('click', restartGame);

// Modals
document.getElementById('btn-game-over-close').addEventListener('click', () => {
    document.getElementById('modal-game-over').classList.add('hidden');
});

function showGameOver(title, desc) {
    document.getElementById('game-over-title').innerText = title;
    document.getElementById('game-over-desc').innerText = desc;
    document.getElementById('modal-game-over').classList.remove('hidden');
}

// Setup Doms & Custom Dropdowns
function setupDropdowns() {
    const diffList = document.getElementById('difficulty-list');
    for(let i=1; i<=15; i++) {
        let label = "Easy";
        if (i>=4 && i<=7) label = "Medium";
        if (i>=8 && i<=12) label = "Hard";
        if (i>=13) label = "Expert";
        diffList.innerHTML += `<li data-value="${i}">Lvl ${i}: ${label}</li>`;
    }
    
    // Load config
    const svTheme = localStorage.getItem('chessMasterTheme') || 'theme-royal-gold';
    const svLvl = localStorage.getItem('chessMasterLevel') || 6;
    const svSnd = localStorage.getItem('chessSound') !== 'false';
    
    gameState.theme = svTheme;
    gameState.difficulty = parseInt(svLvl);
    gameState.soundEnabled = svSnd;
    
    document.body.className = svTheme;
    document.getElementById('btn-sound').innerHTML = svSnd ? '<i class="ph ph-speaker-high"></i>' : '<i class="ph ph-speaker-slash"></i>';
    document.getElementById('ai-level-badge').innerText = "Level " + svLvl;
    
    // Custom Dropdown Logic
    function initDropdown(dropdownId, currentValue, onChange) {
        const dd = document.getElementById(dropdownId);
        const header = dd.querySelector('.dropdown-header');
        const textSpan = dd.querySelector('.sel-text');
        const listItems = dd.querySelectorAll('li');
        
        // Set initial
        listItems.forEach(li => {
            if (li.dataset.value == currentValue) {
                li.classList.add('active');
                textSpan.innerText = li.innerText;
            } else {
                li.classList.remove('active');
            }
        });

        // Toggle open/close
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close others
            document.querySelectorAll('.custom-dropdown').forEach(other => {
                if(other !== dd) other.classList.remove('open');
            });
            dd.classList.toggle('open');
        });

        // Item click
        listItems.forEach(li => {
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                listItems.forEach(i => i.classList.remove('active'));
                li.classList.add('active');
                textSpan.innerText = li.innerText;
                dd.classList.remove('open');
                onChange(li.dataset.value);
            });
        });
    }

    initDropdown('theme-dropdown', svTheme, (val) => {
        document.body.className = val;
        gameState.theme = val;
        updatePanels();
    });

    initDropdown('difficulty-dropdown', svLvl, (val) => {
        gameState.difficulty = parseInt(val);
        document.getElementById('ai-level-badge').innerText = "Level " + gameState.difficulty;
        updatePanels();
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown').forEach(dd => dd.classList.remove('open'));
    });
}

document.getElementById('btn-sound').addEventListener('click', () => {
    gameState.soundEnabled = !gameState.soundEnabled;
    document.getElementById('btn-sound').innerHTML = gameState.soundEnabled ? '<i class="ph ph-speaker-high"></i>' : '<i class="ph ph-speaker-slash"></i>';
    updatePanels();
});

// Tutorial System
const tutorialSteps = [
    { t: "Welcome to Chess Master", d: "Experience the timeless strategy game with a premium interface and an intelligent AI opponent." },
    { t: "The Objective", d: "The goal is simple: Checkmate the opponent's King. This means the King is under attack and cannot escape." },
    { t: "Piece Movement", d: "Click on any of your pieces (White) to view valid moves highlighted as elegant golden circles on the board." },
    { t: "Special Moves", d: "This game supports all advanced rules: Castling to protect your king, En Passant pawn captures, and Pawn Promotions." },
    { t: "AI Difficulty", d: "Select from 15 levels of AI in the top right. Levels 1-3 are easy, while Level 13+ takes milliseconds to destroy you." },
    { t: "Themes", d: "Switch between Royal Gold, Dark Premium, and Classic Wood themes dynamically to suit your aesthetic." }
];

let tutStep = 0;
function showTutorial() {
    tutStep = 0;
    updateTutorialUI();
    document.getElementById('modal-tutorial').classList.remove('hidden');
}

function updateTutorialUI() {
    document.getElementById('tut-title').innerText = tutorialSteps[tutStep].t;
    document.getElementById('tut-content').innerHTML = `<p>${tutorialSteps[tutStep].d}</p>`;
    document.getElementById('tut-progress').innerText = `${tutStep+1}/${tutorialSteps.length}`;
    document.getElementById('btn-tut-prev').disabled = tutStep === 0;
    document.getElementById('btn-tut-next').innerHTML = tutStep === tutorialSteps.length - 1 ? "Start" : '<i class="ph ph-caret-right"></i>';
}

document.getElementById('btn-tutorial').addEventListener('click', showTutorial);
document.getElementById('btn-tut-skip').addEventListener('click', () => document.getElementById('modal-tutorial').classList.add('hidden'));
document.getElementById('btn-tut-prev').addEventListener('click', () => { if(tutStep > 0) { tutStep--; updateTutorialUI(); } });
document.getElementById('btn-tut-next').addEventListener('click', () => { 
    if(tutStep < tutorialSteps.length - 1) { tutStep++; updateTutorialUI(); } 
    else { document.getElementById('modal-tutorial').classList.add('hidden'); localStorage.setItem('chessTutSeen', '1'); }
});


// Initialization
window.onload = () => {
    setupDropdowns();
    renderBoard();
    if (!localStorage.getItem('chessTutSeen')) {
        setTimeout(showTutorial, 1000);
    }
};

window.addEventListener('resize', () => {
    // Relying purely on CSS for resize
});

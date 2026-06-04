let tableau = Array.from({length: 10}, () => []);
let stock = [];
let foundations = 0; 
let moves = 0;
let history = []; // Almacén para la funcionalidad de deshacer

// Variables de Arrastre
let isDragging = false;
let dragOriginCol = -1;
let dragOriginIdx = -1;
let draggedCardsData = [];
let ghostEl = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isAnimating = false; // Bloquea interacción durante animaciones

const rankTexts = {1: 'A', 11: 'J', 12: 'Q', 13: 'K'};
function getRankText(rank) { return rankTexts[rank] || rank.toString(); }

function saveState() {
    // Guardamos una copia profunda del estado actual antes de un cambio
    const state = {
        tableau: JSON.parse(JSON.stringify(tableau)),
        stock: JSON.parse(JSON.stringify(stock)),
        foundations: foundations,
        moves: moves
    };
    history.push(state);
    // Limitamos el historial a los últimos 50 movimientos para rendimiento
    if (history.length > 50) history.shift();
}

function undo() {
    if (history.length === 0) {
        showToast("No hay movimientos para deshacer.");
        return;
    }
    const prevState = history.pop();
    tableau = prevState.tableau;
    stock = prevState.stock;
    foundations = prevState.foundations;
    moves = prevState.moves;
    
    updateUI();
    renderBoard();
}

function initGame() {
    let deck = [];
    // Crear 104 cartas (8 barajas de 13 cartas de picas)
    for (let i = 0; i < 8; i++) {
        for (let rank = 1; rank <= 13; rank++) {
            deck.push({ rank: rank, faceUp: false, id: `c_${i}_${rank}` });
        }
    }

    // Mezclar (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    tableau = Array.from({length: 10}, () => []);
    let cardIdx = 0;

    // Repartir 54 cartas al tablero (4 columnas de 6, 6 columnas de 5)
    for (let c = 0; c < 10; c++) {
        const numCards = c < 4 ? 6 : 5;
        for (let r = 0; r < numCards; r++) {
            let card = deck[cardIdx++];
            if (r === numCards - 1) card.faceUp = true;
            tableau[c].push(card);
        }
    }

    stock = deck.slice(cardIdx); // 50 cartas restantes
    foundations = 0;
    moves = 0;
    history = []; // Limpiar historial al reiniciar

    updateUI();
    renderBoard();
}

function renderBoard() {
    const tableauEl = document.getElementById('tableau');
    tableauEl.innerHTML = '';

    tableau.forEach((col, colIdx) => {
        const colEl = document.createElement('div');
        colEl.className = 'tableau-col flex flex-col relative h-full';
        colEl.dataset.colIndex = colIdx;

        if (col.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'card empty-slot';
            colEl.appendChild(emptyEl);
        } else {
            col.forEach((card, cardIdx) => {
                const cardEl = createCardElement(card);
                cardEl.dataset.cardIndex = cardIdx;

                // Determinar si es movible (para atenuar las que no lo son)
                let isMovable = true;
                if (card.faceUp) {
                    for (let i = cardIdx; i < col.length - 1; i++) {
                        // Revisar hasta la base de la columna
                        if (!col[i+1].faceUp || col[i].rank - 1 !== col[i+1].rank) {
                            isMovable = false;
                            break;
                        }
                    }
                    if (!isMovable) {
                        cardEl.classList.add('dimmed');
                    }
                }

                // Aplicar clase de solapamiento según el estado de la carta *anterior*
                if (cardIdx > 0) {
                    const prevCard = col[cardIdx - 1];
                    if (prevCard.faceUp) {
                        cardEl.classList.add('overlap-up');
                    } else {
                        cardEl.classList.add('overlap-down');
                    }
                }
                colEl.appendChild(cardEl);
            });
        }
        tableauEl.appendChild(colEl);
    });

    renderStockAndFoundations();
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card select-none ${card.faceUp ? 'face-up' : 'face-down'}`;
    
    if (card.faceUp) {
        el.innerHTML = `
            <div class="absolute top-1 left-1.5 flex flex-col items-center">
                <span class="text-[clamp(0.7rem,1.5vw,1.1rem)] font-bold suit-text leading-tight">${getRankText(card.rank)}</span>
                <span class="text-[clamp(0.8rem,1.5vw,1.1rem)] suit-icon leading-tight">♠</span>
            </div>
            <div class="absolute inset-0 flex items-center justify-center opacity-70 pointer-events-none">
                <span class="text-[clamp(2.5rem,4vw,4rem)] suit-icon">♠</span>
            </div>
        `;
    }
    return el;
}

function renderStockAndFoundations() {
    const stockEl = document.getElementById('stock');
    if (stock.length > 0) {
        const dealsLeft = stock.length / 10;
        stockEl.innerHTML = `
            <div class="card face-down relative cursor-pointer hover:brightness-110 transition-all" onclick="dealStock()">
                <div class="absolute inset-0 flex items-center justify-center font-bold text-lg text-[var(--text-main)] z-10 bg-black/20">
                    ${dealsLeft}
                </div>
            </div>
        `;
    } else {
        stockEl.innerHTML = `<div class="card empty-slot opacity-50"></div>`;
    }

    const foundEl = document.getElementById('foundations');
    foundEl.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        if (i < foundations) {
            foundEl.innerHTML += `
                <div class="card face-up relative w-[10%] min-w-[32px]">
                    <div class="absolute top-1 left-1.5 flex flex-col items-center">
                        <span class="text-[clamp(0.7rem,1.5vw,1.1rem)] font-bold suit-text leading-tight">K</span>
                        <span class="text-[clamp(0.8rem,1.5vw,1.1rem)] suit-icon leading-tight">♠</span>
                    </div>
                </div>
            `;
        } else {
            foundEl.innerHTML += `<div class="card empty-slot opacity-40 w-[10%] min-w-[32px] hidden sm:block"></div>`;
        }
    }
}

function updateUI() {
    document.getElementById('moves-count').textContent = moves;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

function showHint() {
    if (isAnimating) return;
    let possibleMoves = [];
    
    for (let srcCol = 0; srcCol < 10; srcCol++) {
        const col = tableau[srcCol];
        if (col.length === 0) continue;
        
        // Buscar secuencias válidas desde abajo
        for (let i = col.length - 1; i >= 0; i--) {
            if (!col[i].faceUp) break;
            
            let isValidSeq = true;
            for (let j = i; j < col.length - 1; j++) {
                if (col[j].rank - 1 !== col[j+1].rank) {
                    isValidSeq = false;
                    break;
                }
            }
            
            if (isValidSeq) {
                const topCard = col[i];
                
                // Buscar destino
                for (let dstCol = 0; dstCol < 10; dstCol++) {
                    if (srcCol === dstCol) continue;
                    const targetCol = tableau[dstCol];
                    
                    if (targetCol.length === 0) {
                        // Mover a espacio vacío puntúa si revelamos carta
                        if (i > 0) possibleMoves.push({srcCol, srcIdx: i, score: 1});
                    } else {
                        const targetTopCard = targetCol[targetCol.length - 1];
                        if (targetTopCard.rank - 1 === topCard.rank) {
                            let score = 5; 
                            if (i > 0 && !col[i-1].faceUp) score += 10; // Prioriza revelar cartas
                            possibleMoves.push({srcCol, srcIdx: i, score});
                        }
                    }
                }
            }
        }
    }
    
    if (possibleMoves.length > 0) {
        // Ordenar por mejor puntuación
        possibleMoves.sort((a, b) => b.score - a.score);
        const bestMove = possibleMoves[0];
        
        // Animar el grupo
        const colEl = document.querySelector(`.tableau-col[data-col-index="${bestMove.srcCol}"]`);
        const cards = colEl.querySelectorAll('.card');
        for (let i = bestMove.srcIdx; i < cards.length; i++) {
            cards[i].classList.add('hint-anim');
        }
        setTimeout(() => {
            for (let i = bestMove.srcIdx; i < cards.length; i++) {
                cards[i].classList.remove('hint-anim');
            }
        }, 1200);
    } else {
        showToast("No hay movimientos obvios. Toca el mazo para repartir.");
    }
}

function dealStock() {
    if (isAnimating) return;
    // Se eliminó la restricción de columnas vacías: ahora puedes repartir siempre
    if (stock.length === 0) return;

    isAnimating = true;
    saveState(); 

    const stockEl = document.getElementById('stock');
    const stockRect = stockEl.getBoundingClientRect();
    let cardsToDeal = [];
    for (let i = 0; i < 10; i++) {
        cardsToDeal.push(stock.pop());
    }

    let animationsCompleted = 0;

    for (let i = 0; i < 10; i++) {
        const card = cardsToDeal[i];
        card.faceUp = true;
        
        // Carta animada temporal
        const flyingCard = createCardElement(card);
        flyingCard.style.position = 'fixed';
        flyingCard.style.left = `${stockRect.left}px`;
        flyingCard.style.top = `${stockRect.top}px`;
        flyingCard.style.width = `${document.querySelector('.tableau-col').offsetWidth}px`;
        flyingCard.style.transition = 'all 0.4s ease-out';
        flyingCard.style.zIndex = '1000' + i;
        flyingCard.style.margin = '0';
        document.body.appendChild(flyingCard);

        // Reflujo
        flyingCard.offsetHeight;

        // Destino
        const targetCol = document.querySelectorAll('.tableau-col')[i];
        const lastCardInCol = targetCol.lastElementChild;
        let targetRect = targetCol.getBoundingClientRect();
        let destTop = targetRect.top;
        let destLeft = targetRect.left;

        if (lastCardInCol && !lastCardInCol.classList.contains('empty-slot')) {
            const lastCardRect = lastCardInCol.getBoundingClientRect();
            destTop = lastCardRect.top + (targetCol.offsetWidth * 0.28);
        }

        // Stagger de la animación
        setTimeout(() => {
            flyingCard.style.left = `${destLeft}px`;
            flyingCard.style.top = `${destTop}px`;

            setTimeout(() => {
                flyingCard.remove();
                tableau[i].push(card);
                animationsCompleted++;
                
                if (animationsCompleted === 10) {
                    isAnimating = false; // Liberamos la animación
                    renderBoard();       // Renderizamos para actualizar el DOM
                    checkSets();         // Chequeamos si el reparto completó una escalera
                }
            }, 400); 
        }, i * 80); 
    }
}

function checkSets() {
    for (let i = 0; i < 10; i++) {
        const col = tableau[i];
        if (col.length < 13) continue;

        // Buscamos una secuencia ininterrumpida de 13 cartas: K (13) -> A (1)
        let isComplete = true;
        for (let j = 0; j < 13; j++) {
            const card = col[col.length - 1 - j];
            // La carta al final (j=0) debe ser rango 1 (As), la anterior rango 2... hasta 13 (Rey)
            if (!card || !card.faceUp || card.rank !== j + 1) {
                isComplete = false;
                break;
            }
        }

        if (isComplete) {
            animateAndRemoveSet(i);
            return true; // Solo animamos una escalera a la vez
        }
    }
    return false;
}

function animateAndRemoveSet(colIdx) {
    isAnimating = true;
    const col = tableau[colIdx];
    const colEl = document.querySelector(`.tableau-col[data-col-index="${colIdx}"]`);
    
    // Seleccionamos los elementos del DOM de las últimas 13 cartas
    const cardsDom = Array.from(colEl.querySelectorAll('.card:not(.empty-slot)')).slice(-13);
    const foundationContainer = document.getElementById('foundations');
    const foundRect = foundationContainer.getBoundingClientRect();

    // Destino visual (hacia las fundaciones en la cabecera)
    const destWidth = cardsDom[0].offsetWidth;
    const destLeft = foundRect.right - destWidth - 10;
    const destTop = foundRect.top;

    let completedCount = 0;

    cardsDom.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const flyingCard = el.cloneNode(true);
        
        flyingCard.style.position = 'fixed';
        flyingCard.style.left = `${rect.left}px`;
        flyingCard.style.top = `${rect.top}px`;
        flyingCard.style.width = `${rect.width}px`;
        flyingCard.style.height = `${rect.height}px`;
        flyingCard.style.margin = '0';
        flyingCard.style.zIndex = (9999 + index).toString();
        flyingCard.style.transition = 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
        flyingCard.style.pointerEvents = 'none';
        flyingCard.style.boxShadow = '0 10px 15px rgba(0,0,0,0.5)';
        
        document.body.appendChild(flyingCard);
        el.style.opacity = '0'; // Ocultamos la original inmediatamente

        // Efecto cascada
        setTimeout(() => {
            flyingCard.style.left = `${destLeft}px`;
            flyingCard.style.top = `${destTop}px`;
            flyingCard.style.transform = 'scale(0.8) rotate(10deg)';
            flyingCard.style.opacity = '0'; // Se desvanece al llegar a la fundación

            setTimeout(() => {
                flyingCard.remove();
                completedCount++;
                
                if (completedCount === 13) {
                    // Actualizamos el estado interno tras la animación
                    col.splice(col.length - 13, 13);
                    foundations++;
                    
                    // Volteamos la siguiente carta si existe
                    if (col.length > 0 && !col[col.length - 1].faceUp) {
                        col[col.length - 1].faceUp = true;
                    }
                    
                    isAnimating = false;
                    renderBoard(); // Render final de limpieza
                    
                    if (foundations === 8) {
                        document.getElementById('win-moves').textContent = moves;
                        document.getElementById('win-modal').classList.remove('hidden');
                    } else {
                        checkSets(); // Revisar si hubo otra escalera en cascada
                    }
                }
            }, 600); // Tiempo de la transición CSS
        }, index * 80); // Stagger
    });
}

function closeWinModal() {
    document.getElementById('win-modal').classList.add('hidden');
    initGame();
}

function onPointerDown(e) {
    if (isAnimating) return;
    // Solo clic izquierdo o toque táctil
    if (e.button !== 0 && e.type !== 'touchstart') return;

    const cardEl = e.target.closest('.card:not(.empty-slot)');
    if (!cardEl) return;

    const colEl = cardEl.closest('.tableau-col');
    if (!colEl) return;

    const colIdx = parseInt(colEl.dataset.colIndex);
    const cardIdx = parseInt(cardEl.dataset.cardIndex);
    const col = tableau[colIdx];

    if (!col[cardIdx].faceUp) return;

    // Verificar si la secuencia arrastrada es válida (descendente)
    for (let i = cardIdx; i < col.length - 1; i++) {
        if (col[i].rank - 1 !== col[i+1].rank) {
            return; // Secuencia inválida para arrastrar
        }
    }

    // Iniciar arrastre
    e.preventDefault(); 
    isDragging = true;
    dragOriginCol = colIdx;
    dragOriginIdx = cardIdx;
    draggedCardsData = col.slice(cardIdx);

    const rect = cardEl.getBoundingClientRect();
    // Soporte para touch y ratón
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;

    // Crear elemento fantasma
    ghostEl = document.createElement('div');
    ghostEl.className = 'drag-ghost';
    ghostEl.style.width = `${cardEl.offsetWidth}px`;
    ghostEl.style.left = `${clientX - dragOffsetX}px`;
    ghostEl.style.top = `${clientY - dragOffsetY}px`;

    let currentTop = 0;
    const visibleHeight = cardEl.offsetWidth * 0.28; // Aproximadamente el gap de solapamiento

    const cardsInDom = colEl.querySelectorAll('.card');
    for (let i = cardIdx; i < col.length; i++) {
        const originalEl = cardsInDom[i];
        const clone = originalEl.cloneNode(true);
        
        clone.className = `card face-up`; // Forzar render limpio sin clases de overlap
        clone.style.margin = '0';
        clone.style.position = 'absolute';
        clone.style.top = `${currentTop}px`;
        clone.style.left = '0';
        
        ghostEl.appendChild(clone);
        originalEl.style.opacity = '0.3'; // Atenuar las originales
        currentTop += visibleHeight;
    }

    document.body.appendChild(ghostEl);

    document.addEventListener('pointermove', onPointerMove, {passive: false});
    document.addEventListener('touchmove', onPointerMove, {passive: false});
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);
}

function onPointerMove(e) {
    if (!isDragging || !ghostEl) return;
    e.preventDefault(); // Evitar scroll
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    ghostEl.style.left = `${clientX - dragOffsetX}px`;
    ghostEl.style.top = `${clientY - dragOffsetY}px`;
}

function onPointerUp(e) {
    if (!isDragging) return;

    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('touchend', onPointerUp);

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    // Determinar columna de destino basándose en coordenadas
    let targetColIdx = -1;
    const cols = document.querySelectorAll('.tableau-col');
    
    cols.forEach(col => {
        const rect = col.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top - 20) {
            targetColIdx = parseInt(col.dataset.colIndex);
        }
    });

    // Validar movimiento
    let moveValid = false;
    if (targetColIdx !== -1 && targetColIdx !== dragOriginCol) {
        const targetCol = tableau[targetColIdx];
        const draggedTopCard = draggedCardsData[0];

        if (targetCol.length === 0) {
            moveValid = true; 
        } else {
            const targetTopCard = targetCol[targetCol.length - 1];
            if (targetTopCard.rank - 1 === draggedTopCard.rank) {
                moveValid = true; 
            }
        }
    }

    if (moveValid) {
        saveState(); // Guardamos el estado antes de aplicar el movimiento
        // Aplicar movimiento
        tableau[targetColIdx].push(...draggedCardsData);
        tableau[dragOriginCol].splice(dragOriginIdx, draggedCardsData.length);
        moves++;

        // Voltear la carta inferior original si quedó boca abajo
        const sourceCol = tableau[dragOriginCol];
        if (sourceCol.length > 0 && !sourceCol[sourceCol.length - 1].faceUp) {
            sourceCol[sourceCol.length - 1].faceUp = true;
        }

        updateUI();
    }

    // Limpieza
    isDragging = false;
    dragOriginCol = -1;
    dragOriginIdx = -1;
    draggedCardsData = [];
    if (ghostEl) {
        ghostEl.remove();
        ghostEl = null;
    }
    
    // Primero renderizamos para que checkSets use los elementos del DOM actualizados
    renderBoard(); 

    // Luego verificamos si se completó alguna escalera para animarla
    if (moveValid) {
        checkSets();
    }
}

document.getElementById('tableau').addEventListener('pointerdown', onPointerDown);
document.getElementById('tableau').addEventListener('touchstart', onPointerDown, {passive: false});

// Iniciar el juego al cargar la página
window.onload = initGame;
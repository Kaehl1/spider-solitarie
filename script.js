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
let dragStartX = 0;
let dragStartY = 0;
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
        const isFaceCard = card.rank > 10;
        let faceImageSrc = '';

        if (card.rank === 13) {
            faceImageSrc = './img/rey.png'; // Recuerda poner la ruta correcta si las tienes en /img/
        } else if (card.rank === 12) {
            faceImageSrc = './img/reina.png';
        } else if (card.rank === 11) {
            faceImageSrc = './img/sota.png';
        }

        let pipsHTML = '';
        if (!isFaceCard) {
            if (card.rank === 1) {
                // Diseño dual para el As: Usamos leading-normal en lugar de none para que la pica respire y no se corte
                pipsHTML = `
                    <div class="w-full h-full flex items-center justify-center">
                        <span class="hidden sm:block text-[clamp(3.5rem,6.5vw,5.5rem)] suit-icon leading-none">♠</span>
                        <span class="block sm:hidden text-[clamp(2.5rem,8vw,3.5rem)] suit-icon leading-normal">♠</span>
                    </div>`;
            } else {
                // --- 1. DISEÑO PARA PC ---
                const addPip = (x, y, flip = false) => {
                    return `<span class="absolute suit-icon text-[clamp(1.2rem,2.8vw,1.8rem)] transform -translate-x-1/2 -translate-y-1/2 ${flip ? 'rotate-180' : ''} leading-none" style="left: ${x}%; top: ${y}%;">♠</span>`;
                };
                
                const pips = [];
                const L = 25, C = 50, R = 75; 
                
                switch(card.rank) {
                    case 2: pips.push(addPip(C, 20), addPip(C, 80, true)); break;
                    case 3: pips.push(addPip(C, 20), addPip(C, 50), addPip(C, 80, true)); break;
                    case 4: pips.push(addPip(L, 20), addPip(R, 20), addPip(L, 80, true), addPip(R, 80, true)); break;
                    case 5: pips.push(addPip(L, 20), addPip(R, 20), addPip(C, 50), addPip(L, 80, true), addPip(R, 80, true)); break;
                    case 6: pips.push(addPip(L, 20), addPip(R, 20), addPip(L, 50), addPip(R, 50), addPip(L, 80, true), addPip(R, 80, true)); break;
                    case 7: pips.push(addPip(L, 20), addPip(R, 20), addPip(L, 50), addPip(R, 50), addPip(C, 35), addPip(L, 80, true), addPip(R, 80, true)); break;
                    case 8: pips.push(addPip(L, 20), addPip(R, 20), addPip(L, 50), addPip(R, 50), addPip(C, 35), addPip(C, 65, true), addPip(L, 80, true), addPip(R, 80, true)); break;
                    case 9: pips.push(addPip(L, 15), addPip(R, 15), addPip(L, 38), addPip(R, 38), addPip(C, 50), addPip(L, 62, true), addPip(R, 62, true), addPip(L, 85, true), addPip(R, 85, true)); break;
                    case 10: pips.push(addPip(L, 14), addPip(R, 14), addPip(L, 38), addPip(R, 38), addPip(C, 26), addPip(C, 74, true), addPip(L, 62, true), addPip(R, 62, true), addPip(L, 86, true), addPip(R, 86, true)); break;
                }
                
                const desktopPattern = `<div class="hidden sm:block w-full h-full relative">${pips.join('')}</div>`;
                
                // --- 2. DISEÑO PARA MÓVIL ---
                // 'leading-normal' repara la punta cortada.
                const mobilePattern = `
                    <div class="flex sm:hidden w-full h-full items-center justify-center">
                        <span class="text-[clamp(1.8rem,5.5vw,2.5rem)] suit-icon leading-normal">♠</span>
                    </div>
                `;

                pipsHTML = desktopPattern + mobilePattern;
            }
        }

        el.innerHTML = `
            <div class="absolute top-0.5 left-0.5 sm:left-1 z-10">
                <span class="text-[clamp(0.75rem,2.5vw,1.2rem)] font-bold suit-text leading-none ${card.rank === 10 ? 'tracking-tighter' : ''}">${getRankText(card.rank)}</span>
            </div>
            <div class="absolute top-0.5 right-0.5 sm:right-1 z-10">
                <span class="text-[clamp(0.85rem,2.8vw,1.4rem)] suit-icon leading-none">♠</span>
            </div>
            
            <div class="absolute top-5 sm:top-7 bottom-1 inset-x-0 pointer-events-none overflow-hidden flex items-center justify-center">
                ${isFaceCard 
                    ? `<img src="${faceImageSrc}" class="w-full h-full object-contain scale-110 sm:scale-100 opacity-95 drop-shadow-sm" alt="Figura">`
                    : pipsHTML
                }
            </div>
        `;
    }
    return el;
}

function renderStockAndFoundations() {
    const stockEl = document.getElementById('stock');
    if (stock.length > 0) {
        const dealsLeft = stock.length / 10;
        let stockHTML = '<div class="relative w-full h-full cursor-pointer hover:brightness-110 transition-transform hover:scale-105" onclick="dealStock()">';
        
        // Creamos las cartas visuales apilándolas en horizontal hacia la derecha
        for(let i = 0; i < dealsLeft; i++) {
            let posClass = i === 0 ? 'relative' : 'absolute top-0 left-0';
            // Cambiamos el translate(x, y) por un translateX. Aumentamos a 4px para que se note bien el grosor de la baraja.
            stockHTML += `
                <div class="${posClass} card face-down shadow-md" style="transform: translateX(${i * 4}px); z-index: ${i}"></div>
            `;
        }
        stockHTML += '</div>';
        stockEl.innerHTML = stockHTML;
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
    
    // Limpiamos animaciones previas por si el usuario pulsa repetidamente
    document.querySelectorAll('.hint-anim').forEach(el => el.classList.remove('hint-anim'));
    
    let possibleMoves = [];
    
    for (let srcCol = 0; srcCol < 10; srcCol++) {
        const col = tableau[srcCol];
        if (col.length === 0) continue;
        
        // 1. Encontrar la RAÍZ de la secuencia móvil máxima (para NO partir escaleras)
        let srcIdx = col.length - 1;
        while (srcIdx > 0 && col[srcIdx - 1].faceUp && col[srcIdx - 1].rank - 1 === col[srcIdx].rank) {
            srcIdx--;
        }
        
        const topCard = col[srcIdx];
        
        // 2. Buscar el mejor destino para este grupo completo
        for (let dstCol = 0; dstCol < 10; dstCol++) {
            if (srcCol === dstCol) continue;
            const targetCol = tableau[dstCol];
            
            if (targetCol.length === 0) {
                // Mover a hueco vacío. Solo es óptimo si al hacerlo descubrimos una carta boca abajo
                if (srcIdx > 0) {
                    possibleMoves.push({srcCol, srcIdx, dstCol, score: 1});
                }
            } else {
                const targetTopCard = targetCol[targetCol.length - 1];
                if (targetTopCard.rank - 1 === topCard.rank) {
                    let score = 10; // Buen movimiento (conectar cartas)
                    // Puntos extra (movimiento perfecto) si además revelamos una carta nueva
                    if (srcIdx > 0 && !col[srcIdx - 1].faceUp) score += 5; 
                    possibleMoves.push({srcCol, srcIdx, dstCol, score});
                }
            }
        }
    }
    
    if (possibleMoves.length > 0) {
        // Ordenar del movimiento más óptimo al menos óptimo
        possibleMoves.sort((a, b) => b.score - a.score);
        const bestMove = possibleMoves[0];
        
        // Animar el grupo de origen al completo
        const srcColEl = document.querySelector(`.tableau-col[data-col-index="${bestMove.srcCol}"]`);
        const srcCards = srcColEl.querySelectorAll('.card');
        for (let i = bestMove.srcIdx; i < srcCards.length; i++) {
            srcCards[i].classList.add('hint-anim');
        }

        // Animar la carta destino (o el hueco vacío) para guiar el ojo del jugador
        const dstColEl = document.querySelector(`.tableau-col[data-col-index="${bestMove.dstCol}"]`);
        const dstCard = dstColEl.lastElementChild;
        if (dstCard) dstCard.classList.add('hint-anim');

        // Retirar la animación tras 1.2 segundos
        setTimeout(() => {
            document.querySelectorAll('.hint-anim').forEach(el => el.classList.remove('hint-anim'));
        }, 1200);
        
    } else {
        // Si no hay movimientos de escaleras completas, buscar el mazo
        const stockEl = document.getElementById('stock');
        if (stock.length > 0) {
            stockEl.classList.add('hint-anim');
            setTimeout(() => stockEl.classList.remove('hint-anim'), 1200);
        } else {
            showToast("No hay movimientos posibles y el mazo está vacío.");
        }
    }
}

function dealStock() {
    if (isAnimating) return;
    if (stock.length === 0) return;

    isAnimating = true;
    saveState(); 

    const stockEl = document.getElementById('stock');
    const stockRect = stockEl.getBoundingClientRect();
    let cardsToDeal = [];
    for (let i = 0; i < 10; i++) {
        cardsToDeal.push(stock.pop());
    }

    // Calculamos si es móvil o PC para que la animación sepa exactamente dónde aterrizar
    const isMobile = window.innerWidth < 640;

    let animationsCompleted = 0;

    // Calculamos los destinos de todas las cartas ANTES de empezar a moverlas
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

        // Forzamos al navegador a registrar la posición inicial (Reflujo)
        flyingCard.offsetHeight;

        // Calculamos el destino final
        const targetCol = document.querySelectorAll('.tableau-col')[i];
        const lastCardInCol = targetCol.lastElementChild;
        let targetRect = targetCol.getBoundingClientRect();
        let destTop = targetRect.top;
        let destLeft = targetRect.left;

        if (lastCardInCol && !lastCardInCol.classList.contains('empty-slot')) {
            const lastCardRect = lastCardInCol.getBoundingClientRect();
            // Usamos los mismos porcentajes de solapamiento que tenemos en el Drag & Drop (70% móvil, 40% PC)
            const visibleHeight = targetCol.offsetWidth * (isMobile ? 0.70 : 0.40);
            destTop = lastCardRect.top + visibleHeight;
        }

        // Aplicamos el retraso progresivo (Stagger) de 80ms a cada carta
        setTimeout(() => {
            flyingCard.style.left = `${destLeft}px`;
            flyingCard.style.top = `${destTop}px`;

            // Una vez que el vuelo termina (400ms después)...
            setTimeout(() => {
                flyingCard.remove();            // 1. Borramos la carta falsa que estaba volando
                tableau[i].push(card);          // 2. Metemos la carta en la lógica de esa columna
                
                renderBoard();                  // 3. ¡MAGIA! Renderizamos el tablero para que la carta real aparezca al instante

                animationsCompleted++;
                
                if (animationsCompleted === 10) {
                    isAnimating = false; // Liberamos los controles cuando aterriza la última
                    checkSets();         // Chequeamos si el reparto completó una escalera por casualidad
                }
            }, 400); 
        }, i * 80); 
    }
    
    // Renderizamos el mazo al principio para que el montón visual disminuya en el momento del clic
    renderStockAndFoundations();
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
    if (isAnimating || isDragging) return; // Evita que se dispare si ya estamos arrastrando
    
    // Solo clic izquierdo (si es un ratón) o toque
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const cardEl = e.target.closest('.card:not(.empty-slot)');
    if (!cardEl) return;

    const colEl = cardEl.closest('.tableau-col');
    if (!colEl) return;

    const colIdx = parseInt(colEl.dataset.colIndex);
    const cardIdx = parseInt(cardEl.dataset.cardIndex);
    const col = tableau[colIdx];

    if (!col[cardIdx].faceUp) return;

    for (let i = cardIdx; i < col.length - 1; i++) {
        if (col[i].rank - 1 !== col[i+1].rank) return;
    }

    e.preventDefault(); 
    isDragging = true;
    dragOriginCol = colIdx;
    dragOriginIdx = cardIdx;
    draggedCardsData = col.slice(cardIdx);

    // LIMPIEZA FORZADA: Si por algún error quedó un fantasma previo, lo aniquilamos
    document.querySelectorAll('.drag-ghost').forEach(el => el.remove());

    const rect = cardEl.getBoundingClientRect();
    
    // Con PointerEvents, e.clientX funciona perfecto tanto para dedo como para ratón
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    ghostEl = document.createElement('div');
    ghostEl.className = 'drag-ghost';
    ghostEl.style.width = `${cardEl.offsetWidth}px`;
    ghostEl.style.left = `${e.clientX - dragOffsetX}px`;
    ghostEl.style.top = `${e.clientY - dragOffsetY}px`;

    let currentTop = 0;
    
    // Calculamos el nuevo tamaño del escalón visual:
    // Móvil (70% de visibilidad por el margin -70%) y PC (40% de visibilidad)
    const isMobile = window.innerWidth < 640;
    const visibleHeight = cardEl.offsetWidth * (isMobile ? 0.70 : 0.40);

    const cardsInDom = colEl.querySelectorAll('.card');
    for (let i = cardIdx; i < col.length; i++) {
        const originalEl = cardsInDom[i];
        const clone = originalEl.cloneNode(true);
        
        clone.className = `card face-up`; 
        clone.style.margin = '0';
        clone.style.position = 'absolute';
        clone.style.top = `${currentTop}px`;
        clone.style.left = '0';
        
        ghostEl.appendChild(clone);
        originalEl.style.opacity = '0.3'; 
        currentTop += visibleHeight;
    }

    document.body.appendChild(ghostEl);

    // Escuchamos solo eventos Pointer
    document.addEventListener('pointermove', onPointerMove, {passive: false});
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp); // Atrapa cancelaciones del sistema
}

function onPointerMove(e) {
    if (!isDragging || !ghostEl) return;
    e.preventDefault(); 
    ghostEl.style.left = `${e.clientX - dragOffsetX}px`;
    ghostEl.style.top = `${e.clientY - dragOffsetY}px`;
}

function onPointerUp(e) {
    if (!isDragging) return;

    // Retiramos los listeners
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    const clientX = e.clientX;
    const clientY = e.clientY;

    let targetColIdx = -1;
    const cols = document.querySelectorAll('.tableau-col');
    
    cols.forEach(col => {
        const rect = col.getBoundingClientRect();
        // Ampliamos un poco el área de detección para los dedos (top - 20)
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top - 20) {
            targetColIdx = parseInt(col.dataset.colIndex);
        }
    });

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

    // Lógica del auto-movimiento inteligente (Toque rápido)
    const moveDistance = Math.sqrt(Math.pow(clientX - dragStartX, 2) + Math.pow(clientY - dragStartY, 2));
    
    if (targetColIdx === dragOriginCol && moveDistance < 10) {
        let bestTargetIdx = -1;
        let bestScore = -1;
        const draggedTopCard = draggedCardsData[0];

        for (let i = 0; i < 10; i++) {
            if (i === dragOriginCol) continue;
            const targetCol = tableau[i];

            if (targetCol.length > 0) {
                const targetTopCard = targetCol[targetCol.length - 1];
                if (targetTopCard.rank - 1 === draggedTopCard.rank) {
                    // Calculamos la puntuación: ¿qué tan larga es la escalera limpia en el destino?
                    let seqLength = 1;
                    for (let j = targetCol.length - 1; j > 0; j--) {
                        if (targetCol[j-1].faceUp && targetCol[j-1].rank - 1 === targetCol[j].rank) {
                            seqLength++;
                        } else {
                            break; // Se rompe la escalera (o llega a carta gris)
                        }
                    }
                    // Si encontramos un destino con una escalera mayor, lo elegimos
                    if (seqLength > bestScore) {
                        bestScore = seqLength;
                        bestTargetIdx = i;
                    }
                }
            } else if (bestScore === -1) {
                // Las columnas vacías son válidas, pero tienen la peor puntuación.
                // Solo irán aquí si no hay cartas válidas donde apilarse.
                bestScore = 0;
                bestTargetIdx = i;
            }
        }

        if (bestTargetIdx !== -1) {
            targetColIdx = bestTargetIdx;
            moveValid = true;
        }
    }

    if (moveValid) {
        saveState(); 
        tableau[targetColIdx].push(...draggedCardsData);
        tableau[dragOriginCol].splice(dragOriginIdx, draggedCardsData.length);
        moves++;

        const sourceCol = tableau[dragOriginCol];
        if (sourceCol.length > 0 && !sourceCol[sourceCol.length - 1].faceUp) {
            sourceCol[sourceCol.length - 1].faceUp = true;
        }

        updateUI();
    }

    // LIMPIEZA FINAL
    isDragging = false;
    dragOriginCol = -1;
    dragOriginIdx = -1;
    draggedCardsData = [];
    
    if (ghostEl) {
        ghostEl.remove();
        ghostEl = null;
    }
    // Doble barrido de seguridad
    document.querySelectorAll('.drag-ghost').forEach(el => el.remove());
    
    renderBoard(); 

    if (moveValid) {
        checkSets();
    }
}

// INICIALIZACIÓN DE EVENTOS (Solo usamos pointerdown, eliminamos touchstart)
document.getElementById('tableau').addEventListener('pointerdown', onPointerDown);

window.onload = initGame;
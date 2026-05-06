// --- Engine ---
class Card {
    constructor(suit, rank) {
        this.suit = suit; // 'h', 'd', 'c', 's'
        this.rank = rank; // 2-14 (11=J, 12=Q, 13=K, 14=A)
    }

    toString() {
        const ranks = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
        const suits = { 'h': '♥', 'd': '♦', 'c': '♣', 's': '♠' };
        return (ranks[this.rank] || this.rank) + suits[this.suit];
    }
}

class Deck {
    constructor() {
        this.cards = [];
        const suits = ['h', 'd', 'c', 's'];
        for (let s of suits) {
            for (let r = 2; r <= 14; r++) {
                this.cards.push(new Card(s, r));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal() {
        return this.cards.pop();
    }
}

// --- Evaluator ---
const HAND_RANKS = {
    ROYAL_FLUSH: 9,
    STRAIGHT_FLUSH: 8,
    FOUR_OF_A_KIND: 7,
    FULL_HOUSE: 6,
    FLUSH: 5,
    STRAIGHT: 4,
    THREE_OF_A_KIND: 3,
    TWO_PAIR: 2,
    PAIR: 1,
    HIGH_CARD: 0
};

function evaluateHand(cards) {
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const flush = getFlush(sorted);
    const straight = getStraight(sorted);
    
    if (flush && straight) {
        const straightFlush = getStraightFlush(flush);
        if (straightFlush) {
            return { rank: HAND_RANKS.STRAIGHT_FLUSH, value: straightFlush[0].rank, cards: straightFlush };
        }
    }
    
    const counts = getCounts(sorted);
    const quads = Object.keys(counts).filter(r => counts[r].length === 4);
    if (quads.length > 0) {
        const rank = parseInt(quads[0]);
        const kicker = sorted.find(c => c.rank !== rank);
        return { rank: HAND_RANKS.FOUR_OF_A_KIND, value: rank, kicker: kicker.rank };
    }
    
    const trips = Object.keys(counts).filter(r => counts[r].length === 3).sort((a, b) => b - a);
    const pairs = Object.keys(counts).filter(r => counts[r].length === 2).sort((a, b) => b - a);
    
    if (trips.length > 0 && (trips.length > 1 || pairs.length > 0)) {
        const setRank = parseInt(trips[0]);
        const pairRank = trips.length > 1 ? parseInt(trips[1]) : parseInt(pairs[0]);
        return { rank: HAND_RANKS.FULL_HOUSE, value: setRank, subValue: pairRank };
    }
    
    if (flush) return { rank: HAND_RANKS.FLUSH, value: flush[0].rank, cards: flush.slice(0, 5) };
    if (straight) return { rank: HAND_RANKS.STRAIGHT, value: straight[0].rank, cards: straight };
    
    if (trips.length > 0) {
        const rank = parseInt(trips[0]);
        const kickers = sorted.filter(c => c.rank !== rank).slice(0, 2);
        return { rank: HAND_RANKS.THREE_OF_A_KIND, value: rank, kickers: kickers.map(k => k.rank) };
    }
    
    if (pairs.length >= 2) {
        const p1 = parseInt(pairs[0]);
        const p2 = parseInt(pairs[1]);
        const kicker = sorted.find(c => c.rank !== p1 && c.rank !== p2);
        return { rank: HAND_RANKS.TWO_PAIR, value: p1, subValue: p2, kicker: kicker.rank };
    }
    
    if (pairs.length === 1) {
        const rank = parseInt(pairs[0]);
        const kickers = sorted.filter(c => c.rank !== rank).slice(0, 3);
        return { rank: HAND_RANKS.PAIR, value: rank, kickers: kickers.map(k => k.rank) };
    }
    
    return { rank: HAND_RANKS.HIGH_CARD, value: sorted[0].rank, kickers: sorted.slice(1, 5).map(c => c.rank) };
}

function getFlush(cards) {
    const suits = { h: [], d: [], c: [], s: [] };
    for (let c of cards) suits[c.suit].push(c);
    for (let s in suits) {
        if (suits[s].length >= 5) return suits[s].sort((a, b) => b.rank - a.rank);
    }
    return null;
}

function getStraight(cards) {
    const unique = [];
    const seen = new Set();
    for (let c of cards) {
        if (!seen.has(c.rank)) {
            unique.push(c);
            seen.add(c.rank);
        }
    }
    unique.sort((a, b) => b.rank - a.rank);
    if (unique.length > 0 && unique[0].rank === 14) {
        unique.push({ rank: 1, suit: unique[0].suit });
    }
    for (let i = 0; i <= unique.length - 5; i++) {
        if (unique[i].rank - unique[i + 4].rank === 4) {
            return unique.slice(i, i + 5);
        }
    }
    return null;
}

function getStraightFlush(flushCards) {
    return getStraight(flushCards);
}

function getCounts(cards) {
    const counts = {};
    for (let c of cards) {
        if (!counts[c.rank]) counts[c.rank] = [];
        counts[c.rank].push(c);
    }
    return counts;
}

// --- Bot ---
class Bot {
    constructor(name, chips) {
        this.name = name;
        this.chips = chips;
        this.hand = [];
        this.status = 'active'; // 'active', 'folded', 'all-in'
        this.isBot = true;
    }

    makeDecision(gameState) {
        const { communityCards, currentBet, pot, myBet } = gameState;
        const allCards = [...this.hand, ...communityCards];
        const evaluation = evaluateHand(allCards);
        
        let strength = 0;
        if (communityCards.length === 0) {
            const r1 = this.hand[0].rank;
            const r2 = this.hand[1].rank;
            strength = (r1 + r2) / 28;
            if (r1 === r2) strength += 0.3;
        } else {
            strength = evaluation.rank / 9;
        }

        const callAmount = currentBet - myBet;
        strength += (Math.random() - 0.5) * 0.1;

        if (strength < 0.2 && callAmount > 0) {
            return { action: 'fold' };
        } else if (strength > 0.7) {
            const raise = Math.min(this.chips, 20);
            return { action: 'raise', amount: callAmount + raise };
        } else {
            return { action: callAmount > 0 ? 'call' : 'check' };
        }
    }
}

// --- Game Controller ---
class Game {
    constructor(playerChips) {
        this.players = [
            { name: 'You', chips: playerChips, hand: [], status: 'active', isBot: false, currentBet: 0 },
            new Bot('Bot 1', playerChips),
            new Bot('Bot 2', playerChips),
            new Bot('Bot 3', playerChips)
        ];
        this.deck = new Deck();
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.dealerIndex = 0;
        this.turnIndex = 0;
        this.phase = 'pre-flop'; // 'pre-flop', 'flop', 'turn', 'river', 'showdown'
        this.smallBlind = 5;
        this.bigBlind = 10;
    }

    startRound() {
        this.deck = new Deck();
        this.deck.shuffle();
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = this.bigBlind;
        this.phase = 'pre-flop';
        
        for (let p of this.players) {
            if (p.chips > 0) {
                p.hand = [this.deck.deal(), this.deck.deal()];
                p.status = 'active';
                p.currentBet = 0;
            } else {
                p.status = 'out';
            }
        }

        const sbPlayer = this.players[(this.dealerIndex + 1) % this.players.length];
        const bbPlayer = this.players[(this.dealerIndex + 2) % this.players.length];
        this.bet(sbPlayer, this.smallBlind);
        this.bet(bbPlayer, this.bigBlind);
        this.turnIndex = (this.dealerIndex + 3) % this.players.length;
    }

    bet(player, amount) {
        const actualAmount = Math.min(player.chips, amount);
        player.chips -= actualAmount;
        player.currentBet += actualAmount;
        this.pot += actualAmount;
        if (player.currentBet > this.currentBet) {
            this.currentBet = player.currentBet;
        }
        if (player.chips === 0) player.status = 'all-in';
    }

    nextTurn() {
        let count = 0;
        do {
            this.turnIndex = (this.turnIndex + 1) % this.players.length;
            count++;
        } while (this.players[this.turnIndex].status !== 'active' && count < this.players.length);

        if (this.isPhaseComplete()) {
            this.advancePhase();
        }
    }

    isPhaseComplete() {
        const activePlayers = this.players.filter(p => p.status === 'active');
        if (activePlayers.length <= 1) return true;
        return activePlayers.every(p => p.currentBet === this.currentBet);
    }

    advancePhase() {
        for (let p of this.players) p.currentBet = 0;
        this.currentBet = 0;

        if (this.phase === 'pre-flop') {
            this.phase = 'flop';
            for (let i = 0; i < 3; i++) this.communityCards.push(this.deck.deal());
        } else if (this.phase === 'flop') {
            this.phase = 'turn';
            this.communityCards.push(this.deck.deal());
        } else if (this.phase === 'turn') {
            this.phase = 'river';
            this.communityCards.push(this.deck.deal());
        } else {
            this.phase = 'showdown';
            this.determineWinner();
        }
        this.turnIndex = (this.dealerIndex + 1) % this.players.length;
    }

    determineWinner() {
        const activePlayers = this.players.filter(p => p.status !== 'folded' && p.status !== 'out');
        let winner = activePlayers[0];
        let bestHand = null;

        for (let p of activePlayers) {
            const hand = evaluateHand([...p.hand, ...this.communityCards]);
            if (!bestHand || hand.rank > bestHand.rank || (hand.rank === bestHand.rank && hand.value > bestHand.value)) {
                bestHand = hand;
                winner = p;
            }
        }

        winner.chips += this.pot;
        this.pot = 0;
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    }
}

// --- UI Logic ---
const game = new Game(500);
const communityCardsEl = document.getElementById('community-cards');
const potDisplayEl = document.getElementById('pot-display');
const playersEl = document.getElementById('players');
const messageLogEl = document.getElementById('message-log');

const foldBtn = document.getElementById('fold-btn');
const callBtn = document.getElementById('call-btn');
const raiseBtn = document.getElementById('raise-btn');
const nextRoundBtn = document.getElementById('next-round-btn');

function render() {
    communityCardsEl.innerHTML = '';
    game.communityCards.forEach(card => {
        communityCardsEl.appendChild(createCardUI(card));
    });

    playersEl.innerHTML = '';
    game.players.forEach((player, i) => {
        const box = document.createElement('div');
        box.className = `player-box player-${i} ${game.turnIndex === i ? 'active' : ''}`;
        
        let handHtml = '';
        if (player.isBot && game.phase !== 'showdown') {
            handHtml = '<div class="card">?</div><div class="card">?</div>';
        } else {
            player.hand.forEach(card => {
                const cardEl = createCardUI(card);
                handHtml += cardEl.outerHTML;
            });
        }

        box.innerHTML = `
            <strong>${player.name}</strong><br>
            $${player.chips}<br>
            <div class="card-area">${handHtml}</div>
            <small>${player.status === 'folded' ? 'FOLDED' : (player.currentBet > 0 ? 'Bet: $' + player.currentBet : '')}</small>
        `;
        playersEl.appendChild(box);
    });

    potDisplayEl.textContent = `Pot: $${game.pot}`;

    const isPlayerTurn = game.turnIndex === 0 && game.phase !== 'showdown' && game.players[0].status === 'active';
    foldBtn.disabled = !isPlayerTurn;
    callBtn.disabled = !isPlayerTurn;
    raiseBtn.disabled = !isPlayerTurn;
    
    const callAmount = game.currentBet - game.players[0].currentBet;
    callBtn.textContent = callAmount > 0 ? `Call ($${callAmount})` : 'Check';

    if (game.phase === 'showdown') {
        nextRoundBtn.style.display = 'block';
    } else {
        nextRoundBtn.style.display = 'none';
    }
}

function createCardUI(card) {
    const el = document.createElement('div');
    el.className = `card ${['h', 'd'].includes(card.suit) ? 'red' : ''}`;
    const suits = { 'h': '♥', 'd': '♦', 'c': '♣', 's': '♠' };
    const ranks = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    el.textContent = (ranks[card.rank] || card.rank) + suits[card.suit];
    return el;
}

function log(msg) {
    const p = document.createElement('p');
    p.textContent = msg;
    messageLogEl.prepend(p);
}

async function handleBotTurns() {
    while (game.players[game.turnIndex].isBot && game.phase !== 'showdown') {
        render();
        await new Promise(r => setTimeout(r, 1000));
        
        const bot = game.players[game.turnIndex];
        const decision = bot.makeDecision({
            communityCards: game.communityCards,
            currentBet: game.currentBet,
            pot: game.pot,
            myBet: bot.currentBet
        });

        if (decision.action === 'fold') {
            bot.status = 'folded';
            log(`${bot.name} folds.`);
        } else if (decision.action === 'raise') {
            game.bet(bot, decision.amount);
            log(`${bot.name} raises to $${bot.currentBet}.`);
        } else {
            const callAmount = game.currentBet - bot.currentBet;
            game.bet(bot, callAmount);
            log(callAmount > 0 ? `${bot.name} calls.` : `${bot.name} checks.`);
        }
        
        game.nextTurn();
        if (game.phase === 'showdown') break;
    }
    render();
}

foldBtn.onclick = () => {
    game.players[0].status = 'folded';
    log('You fold.');
    game.nextTurn();
    handleBotTurns();
};

callBtn.onclick = () => {
    const callAmount = game.currentBet - game.players[0].currentBet;
    game.bet(game.players[0], callAmount);
    log(callAmount > 0 ? 'You call.' : 'You check.');
    game.nextTurn();
    handleBotTurns();
};

raiseBtn.onclick = () => {
    const callAmount = game.currentBet - game.players[0].currentBet;
    game.bet(game.players[0], callAmount + 20);
    log(`You raise to $${game.players[0].currentBet}.`);
    game.nextTurn();
    handleBotTurns();
};

nextRoundBtn.onclick = () => {
    game.startRound();
    log('--- New Round ---');
    render();
    if (game.players[game.turnIndex].isBot) handleBotTurns();
};

// Start
game.startRound();
log('Welcome to Texas Hold\'em!');
render();
if (game.players[game.turnIndex].isBot) handleBotTurns();


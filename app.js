// ---------- Game rules (change the numbers here only) ----------
const TOTAL_POINTS = 165;       // points available in one round
const BID_BASE = 100;           // a typed bid of 25 means a real bid of 125
const DOUBLE_PENALTY_AT = 85;   // opponent reaching this doubles the bidder's loss
const SHELEM_AT = 65;           // a typed bid of 65 or more is shelem
const SHELEM_SCORE = 330;       // won or lost, shelem is always worth this
const MAX_TYPED_BID = 195;

// The name the game is saved under in the browser
const STORAGE_KEY = 'shelem-game';

// A valid number is 0 or more and divisible by 5
function isValidNumber(n) {
  return Number.isFinite(n) && n >= 0 && n % 5 === 0;
}

function calculateRound(typedBid, opponentScore) {
  const fullBid = BID_BASE + typedBid;
  const bidderPoints = TOTAL_POINTS - opponentScore;


  if (typedBid >= SHELEM_AT) {
    const made = opponentScore === 0;
    return {
      bidderPoints,
      bidderDelta: made ? SHELEM_SCORE : -SHELEM_SCORE,
      opponentDelta: 0,
    };
  }
  // Same check as before (170 - opponentScore > fullBid).
  const bidderWon = bidderPoints >= fullBid;

  if (bidderWon) {
    return { bidderPoints, bidderDelta: bidderPoints, opponentDelta: 0 };
  }

  // Bidder failed: loses the bid (twice if the opponent scored enough),
  // and the opponent keeps their own points.
  const penalty = opponentScore >= DOUBLE_PENALTY_AT ? 2 * fullBid : fullBid;
  return { bidderPoints, bidderDelta: -penalty, opponentDelta: opponentScore };
}


function makeButton(label) {
  const btn = document.createElement('button');
  btn.textContent = label;
  return btn;
}


const sheet = document.getElementById('sheet');
const entryScreen = document.getElementById('entry-screen');
const numberForm = document.getElementById('number-form');
const numberInput = document.getElementById('number-input');
const question = document.getElementById('question');
const cancelBtn = document.getElementById('cancel-btn');

const colLeft = document.getElementById('col-left');
const colRight = document.getElementById('col-right');
const colMiddle = document.getElementById('col-middle');

const nameLeft = document.getElementById('name-left');
const nameRight = document.getElementById('name-right');


// Everything that changes during the game lives here.
// The totals are NOT stored: they are worked out from `rounds` every time
// the sheet is drawn, so deleting a round automatically fixes every total.
const state = {
  selectedTeam: null,   // who is bidding right now (null = no round in progress)
  rounds: [],           // finished rounds, in order: { team, bid, opponentScore }
};

// 'left' -> 'right' and the other way round
function opposite(team) {
  return team === 'left' ? 'right' : 'left';
}

// The column (the lanes) that belongs to a team
function columnOf(team) {
  return team === 'left' ? colLeft : colRight;
}

// helper
function normalizeScore(value) {
  const number = Number(value);
  return Math.abs(number) >= 100
    ? Math.abs(number) % 100
    : number;
}


// ---------- Small helpers ----------

// Creates <div class="..."> with optional text
function makeDiv(className, text = '') {
  const div = document.createElement('div');
  div.className = className;
  div.textContent = text;
  return div;
}


// ---------- Save and load (the browser remembers the game) ----------

// Writes the finished rounds and the names into the browser
function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      rounds: state.rounds,
      names: { left: nameLeft.value, right: nameRight.value },
    }));
  } catch (error) {
    // Storage blocked or full: the game still works, it just won't be remembered
  }
}

// Protects us from a broken or edited save
function isValidRound(round) {
  return Boolean(round)
    && (round.team === 'left' || round.team === 'right')
    && isValidNumber(round.bid) && round.bid <= MAX_TYPED_BID
    && isValidNumber(round.opponentScore) && round.opponentScore <= TOTAL_POINTS;
}

// Reads the saved game (if there is one) back into `state` and the name boxes
function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;

    if (Array.isArray(saved.rounds)) {
      state.rounds = saved.rounds.filter(isValidRound).map((round) => ({
        team: round.team,
        bid: round.bid,
        opponentScore: round.opponentScore,
      }));
    }

    if (saved.names) {
      nameLeft.value = String(saved.names.left || '');
      nameRight.value = String(saved.names.right || '');
    }
  } catch (error) {
    // Unreadable save: just start with an empty sheet
  }
}

// Names are saved while typing
nameLeft.addEventListener('input', saveGame);
nameRight.addEventListener('input', saveGame);


// ---------- The two "خواند" buttons ----------

// They are created once and moved into a fresh lane every time the sheet is drawn
const teamButtons = {
  left: makeTeamButton('left'),
  right: makeTeamButton('right'),
};

function makeTeamButton(team) {
  const btn = makeButton('خواند');
  btn.addEventListener('click', () => {
    openNumberEntry(team);
  });
  return btn;
}

// Show the full-screen number entry
function openNumberEntry(team) {
  state.selectedTeam = team;

  question.textContent = 'چند تا؟';
  numberInput.value = '';

  sheet.hidden = true;
  entryScreen.hidden = false;

  numberInput.focus();
}

// Add the number and its direction to the middle
function addScore(number, team) {
  const row = document.createElement('div');
  row.className = 'score-lane';

  const score = document.createElement('div');
  score.style.textAlign = 'center';

  const numberEl = document.createElement('div');
  const isShelem = number >= SHELEM_AT;
  numberEl.textContent = isShelem ? 'شلم' : number + BID_BASE;
  const arrowEl = document.createElement('div');
  arrowEl.textContent = team === 'left' ? '⟵' : '⟶';

  score.appendChild(numberEl);
  score.appendChild(arrowEl);
  row.appendChild(score);

  colMiddle.appendChild(row);
}


// ---------- Drawing the sheet ----------

// What to write in the two lanes of a finished round
function laneTexts(result, opponentScore) {
  if (result.bidderDelta === SHELEM_SCORE) {
    return { bidder: SHELEM_SCORE, opponent: 'نگرفت!' };
  }
  if (result.bidderDelta === -SHELEM_SCORE) {
    return { bidder: -SHELEM_SCORE, opponent: 'گرفت' };
  }
  return { bidder: result.bidderPoints, opponent: opponentScore };
}

// A finished round's lane: just the number
function addFinishedLane(team, text) {
  const lane = makeDiv('lane');
  lane.appendChild(makeDiv('lane-number', text));
  columnOf(team).appendChild(lane);
}

// The dashed line and the running totals under a round
function addRoundFooter(index, totals) {
  const lineTop = `${(2 + index) * 10}vh`;

  const divider = makeDiv('round-divider');
  divider.style.top = lineTop;

  const totalsRow = makeDiv('round-total');
  totalsRow.style.top = lineTop;
  totalsRow.append(
    makeDiv('total-left', totals.left),
    makeDiv(''),                          // empty middle cell
    makeDiv('total-right', totals.right)
  );

  sheet.append(divider, totalsRow);
}

// The delete button at the right edge of a round (only the last round gets one)
function addDeleteButton(index) {
  const holder = makeDiv('row-actions');
  holder.style.top = `${(1 + index) * 10}vh`;

  const btn = makeButton('×');
  btn.className = 'row-delete';
  btn.setAttribute('aria-label', 'حذف');
  btn.addEventListener('click', askDelete);

  holder.appendChild(btn);
  sheet.appendChild(holder);
}

// Draws the WHOLE sheet from state.rounds.
// Used when the page loads, after a round is finished, after a delete and after a restart.
function render() {
  // 1. Remove everything drawn for the rounds
  colLeft.replaceChildren();
  colRight.replaceChildren();
  colMiddle.replaceChildren();
  sheet.querySelectorAll('.round-divider, .round-total, .row-actions').forEach((el) => el.remove());
  sheet.classList.remove('busy');

  // 2. Draw every finished round, adding up the totals as we go
  const totals = { left: 0, right: 0 };

  state.rounds.forEach((round, index) => {
    const otherTeam = opposite(round.team);
    const result = calculateRound(round.bid, round.opponentScore);
    const texts = laneTexts(result, round.opponentScore);

    totals[round.team] += result.bidderDelta;
    totals[otherTeam] += result.opponentDelta;

    addFinishedLane(round.team, texts.bidder);
    addFinishedLane(otherTeam, texts.opponent);
    addScore(round.bid, round.team);
    addRoundFooter(index, totals);
    if (index === state.rounds.length - 1) addDeleteButton(index);   // last round only
  });

  // 3. Show both buttons again, each in a fresh lane for the next round
  ['left', 'right'].forEach((team) => {
    teamButtons[team].style.display = '';
    const lane = makeDiv('lane');
    lane.appendChild(teamButtons[team]);   // appendChild moves the button
    columnOf(team).appendChild(lane);
  });

  // 4. Grow the sheet: header + finished rounds + the row for the next round
  sheet.style.minHeight = `${(2 + state.rounds.length) * 10}vh`;
}


// ---------- Delete the last row ----------

// Delete: the × opens a full-screen question, the confirm button does the delete
const deleteScreen = document.getElementById('delete-screen');

function askDelete() {
  if (state.selectedTeam !== null) return;   // a round is being entered right now
  deleteScreen.hidden = false;
}

function closeDeleteQuestion() {
  deleteScreen.hidden = true;
}

// Removes the last round; the totals go back to the row before it
function deleteLastRound() {
  closeDeleteQuestion();
  if (state.selectedTeam !== null || state.rounds.length === 0) return;

  state.rounds.pop();
  saveGame();
  render();
}

document.getElementById('delete-confirm').addEventListener('click', deleteLastRound);
document.getElementById('delete-cancel').addEventListener('click', closeDeleteQuestion);


// ---------- Restart ----------

// Restart: the button opens a full-screen question, the confirm button does the reset
const resetScreen = document.getElementById('reset-screen');

function askReset() {
  resetScreen.hidden = false;
}

function closeResetQuestion() {
  resetScreen.hidden = true;
}

// Clears the whole sheet and starts over (asks first)
function resetGame() {
  closeResetQuestion();

  state.selectedTeam = null;
  state.rounds = [];

  // Clear the names
  nameLeft.value = '';
  nameRight.value = '';

  saveGame();
  render();
}

document.getElementById('reset-btn').addEventListener('click', askReset);
document.getElementById('reset-confirm').addEventListener('click', resetGame);
document.getElementById('reset-cancel').addEventListener('click', closeResetQuestion);


// ---------- One round, in order ----------

// 1. Ask the non-bidding team for the points it took
function showOpponentScore(otherTeam, biddingTeam, typedBid) {
  const opponentLane = teamButtons[otherTeam].parentElement;
  opponentLane.replaceChildren();   // removes the "خواند" button from this lane
  opponentLane.classList.add('asking');

  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode= 'numeric';
  input.placeholder = 'امتیاز';
  input.className = 'opponent-score-input';
  input.min = '0';

  const confirmBtn = makeButton('تایید');

  opponentLane.append(input, confirmBtn);
  input.focus();

  function submit() {
    const opponentScore = Number(input.value);
    const isValid = opponentScore !== '' && isValidNumber(opponentScore);


    if (!isValid || opponentScore > TOTAL_POINTS) {
      input.value = '';   // clear it so the player retries
      input.focus();
      return;
    }

    finishRound(biddingTeam, typedBid, opponentScore);
  }

  confirmBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  });
}

// 2. Runs once both numbers are known: remember the round, save, redraw
function finishRound(biddingTeam, typedBid, opponentScore) {
  state.rounds.push({ team: biddingTeam, bid: typedBid, opponentScore });
  state.selectedTeam = null;

  saveGame();
  render();
}


// Submit the number
numberForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const value = numberInput.value.trim();

  if (value > MAX_TYPED_BID){
    question.textContent = 'باید کمتر از 200 باشه!';
    numberInput.value = '';
    numberInput.focus();
    return;
  }
  else if (value === '' || !isValidNumber(Number(value))) {
    // Stay on the entry screen so the player can retry
    question.textContent = 'باید مضرب 5 باشه!';
    numberInput.value = '';
    numberInput.focus();
    return;
  }

  const bid = normalizeScore(value);
  const biddingTeam = state.selectedTeam;
  const otherTeam = opposite(biddingTeam);

  addScore(bid, biddingTeam);

  // Hide both bidding buttons
  teamButtons.left.style.display = 'none';
  teamButtons.right.style.display = 'none';

  // Hide the delete buttons until this round is finished
  sheet.classList.add('busy');

  // Return to the sheet and ask the other team for its score
  entryScreen.hidden = true;
  sheet.hidden = false;

  showOpponentScore(otherTeam, biddingTeam, bid);
});

// Cancel number entry
cancelBtn.addEventListener('click', () => {
  entryScreen.hidden = true;
  sheet.hidden = false;
  state.selectedTeam = null;
});


// ---------- Start ----------

loadGame();
render();

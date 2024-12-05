// Call the init function when the HTML window loads
window.onload = init;

let player;
let spacebar = false;
let counter = 0;
let episodes = 0;
let totalGames = 0;
let totalScore = 0;
let highScore = 0; // Track the highest score achieved

let positiveRewards = 0;
let negativeRewards = 0;

let canvas, ctx;
let centerLineY = 240;

// Agent parameters
let agent;

// DOM elements for performance metrics
let totalEpisodesElem, totalGamesElem, averageScoreElem, highestScoreElem;
let epsilonElem, learningRateElem, discountFactorElem;
let positiveRewardsElem, negativeRewardsElem;
let dyElem, playeryElem;

// Variables for timing
let lastTime = 0;
let lastActionTime = 0; // Track the time since the last action

function init() {
  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");

  // Initialize agent
  agent = new RLAgent();

  // Get DOM elements for updating performance metrics
  totalEpisodesElem = document.getElementById("totalEpisodes");
  totalGamesElem = document.getElementById("totalGames");
  averageScoreElem = document.getElementById("averageScore");
  highestScoreElem = document.getElementById("highestScore");
  epsilonElem = document.getElementById("epsilon");
  learningRateElem = document.getElementById("learningRate");
  discountFactorElem = document.getElementById("discountFactor");
  positiveRewardsElem = document.getElementById("positiveRewards");
  negativeRewardsElem = document.getElementById("negativeRewards");
  dyElem = document.getElementById("dy");
  playeryElem = document.getElementById("playery");

  // Update initial agent parameters
  epsilonElem.textContent = agent.epsilon.toFixed(2);
  learningRateElem.textContent = agent.learnRate;
  discountFactorElem.textContent = agent.discountFactor;

  startGame();

  lastTime = performance.now();
  lastActionTime = lastTime;

  window.requestAnimationFrame(gameLoop);
}

function startGame() {
  player = new Circle(canvas.width / 2, canvas.height / 2, 10, "yellow", 0.1);
}

class RLAgent {
  constructor() {
    this.qTable = {};
    this.epsilon = 0.5; // Start with high exploration
    this.learnRate = 0.05; // Lower learning rate for smoother updates
    this.discountFactor = 0.8; // Reduced discount factor to prioritize immediate rewards
  }

  getState(player, elapsedTime) {
    const dy = player.y - centerLineY; // Distance from centerline
    const velocity = player.velocity;
    const nearCeiling = player.y < player.radius + 50 ? 1 : 0; // Close to ceiling
    const nearGround = player.y > canvas.height - player.radius - 50 ? 1 : 0; // Close to ground
    const inSafeZone = player.y > centerLineY - 50 && player.y < centerLineY + 50 ? 1 : 0;
    const rising = player.velocity < 0 ? 1 : 0; // Is the player moving up?

    // Discretized state includes context
    return `${Math.floor(dy)},${Math.floor(velocity)},${nearCeiling},${nearGround},${inSafeZone},${rising}`;
  }

  chooseAction(state) {
    const qJump = this.qTable[state]?.jump ?? -Infinity; // Penalize jumping by default
    const qStay = this.qTable[state]?.stay ?? 0;

    if (Math.random() < this.epsilon) {
      // Exploration: random action
      return Math.random() < 0.5 ? 1 : 0;
    }

    // Exploitation: choose the best known action
    return qJump > qStay ? 1 : 0;
  }

  updateQValue(state, action, reward, nextState) {
    const maxNextQ = Math.max(
      this.qTable[nextState]?.jump ?? 0,
      this.qTable[nextState]?.stay ?? 0
    );
    const currentQ =
      this.qTable[state]?.[action === 1 ? "jump" : "stay"] ?? 0;
    const newQ =
      currentQ +
      this.learnRate * (reward + this.discountFactor * maxNextQ - currentQ);

    // Round the Q-value to avoid floating-point precision issues
    const roundedQ = parseFloat(newQ.toFixed(2));

    if (!this.qTable[state]) this.qTable[state] = {};
    this.qTable[state][action === 1 ? "jump" : "stay"] = roundedQ;
  }
}

function Circle(x, y, radius, color, velocity) {
  this.x = x;
  this.y = y;
  this.radius = radius;
  this.color = color;
  this.velocity = velocity;
}

function gameLoop(timestamp) {
  window.requestAnimationFrame(gameLoop);

  const deltaTime = (timestamp - lastTime) / 1000; // Convert to seconds
  lastTime = timestamp;

  update(deltaTime);
  render();
}

function update(deltaTime) {
  const elapsedTime = (lastTime - lastActionTime) / 1000; // Time since last action

  // Agent decision-making every frame
  const state = agent.getState(player, elapsedTime);
  const action = agent.chooseAction(state);

  if (action === 1) {
    spacebar = true;
    lastActionTime = lastTime; // Reset the action timer
  }

  // Proceed with game updates
  let reward = playerPosition(deltaTime); // Get reward from player position

  const nextState = agent.getState(player, elapsedTime);

  // Update Q-values only if an action was taken or a reward was given
  if (action === 1 || reward !== 0) {
    agent.updateQValue(state, action, reward, nextState);
    console.log(
      `Updated Q Values: ${state} ${action} ${reward.toFixed(2)} ${nextState}`
    );
  }

  // Update metrics
  updateMetrics();

  // Gradually decay exploration rate
  agent.epsilon = Math.max(0.1, agent.epsilon * 0.995);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw centerline
  ctx.beginPath();
  ctx.moveTo(0, centerLineY);
  ctx.lineTo(canvas.width, centerLineY);
  ctx.strokeStyle = "red";
  ctx.stroke();

  // Draw player
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  // Draw scores
  drawScores();
}

function playerPosition(deltaTime) {
  let reward = -0.1; // Small time decay penalty

  // Penalty for being close to the ceiling
  const nearCeilingPenalty = player.y < player.radius + 50 ? -1 : 0;
  reward += nearCeilingPenalty;

  if (player.y > canvas.height - player.radius) {
    player.velocity = 0;
    player.y = canvas.height - player.radius;
    reward -= 20; // Strong penalty for hitting the ground
    negativeRewards += 20;

    // Reset game state
    totalGames++;
    totalScore += counter;
    if (counter > highScore) highScore = counter;
    counter = 0;
    episodes++;
  }
  if (player.y < player.radius) {
    player.velocity = 0;
    player.y = player.radius;
    reward -= 50; // Drastically increase penalty for hitting the ceiling
    negativeRewards += 50;

    // Reset game state
    totalGames++;
    totalScore += counter;
    if (counter > highScore) highScore = counter;
    counter = 0;
    episodes++;
  }

  // Positive reward for being near the centerline
  const centerProximity = Math.abs(player.y - centerLineY);
  if (centerProximity <= 10) {
    reward += 1; // Positive reward for staying near the centerline
    positiveRewards += 1;
    counter++;
  }

  if (spacebar) {
    if (player.velocity < 0) {
      reward -= 5; // Penalize jumps when already moving upward
    }
    player.velocity = -5; // Jump immediately
    spacebar = false;
  }

  player.y += player.velocity * deltaTime * 60; // Adjust movement by deltaTime
  player.velocity += 0.25 * deltaTime * 60; // Gravity effect

  return reward;
}

function drawScores() {
  ctx.font = "20px Arial";
  ctx.fillStyle = "black";
  ctx.fillText(`Score: ${counter}`, 10, 20);
  ctx.fillText(`High Score: ${highScore}`, 10, 50);
}

document.body.onkeydown = function (key) {
  if (key.keyCode === 32) {
    spacebar = true;
  }
};

function updateMetrics() {
  totalEpisodesElem.textContent = episodes;
  totalGamesElem.textContent = totalGames;
  averageScoreElem.textContent = (totalScore / (totalGames || 1)).toFixed(2);
  highestScoreElem.textContent = highScore;
  positiveRewardsElem.textContent = positiveRewards;
  negativeRewardsElem.textContent = negativeRewards;
  epsilonElem.textContent = agent.epsilon.toFixed(2);
  learningRateElem.textContent = agent.learnRate;
  discountFactorElem.textContent = agent.discountFactor;
  dyElem.textContent = (player.y - centerLineY).toFixed(2);
  playeryElem.textContent = player.y.toFixed(2);
}

// Call the init function when the HTML window loads
window.onload = init;

let player;
let spacebar = false;
let counter = 0;
let episodes = 0;
let totalGames = 0;
let totalScore = 0;
let highScore = 0;

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
let lastJumpTime = 0; // Time when the last jump occurred

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
  lastJumpTime = lastTime;

  window.requestAnimationFrame(gameLoop);
}

function startGame() {
  player = new Circle(canvas.width / 2, canvas.height - 20, 10, "yellow", 0);
}

class RLAgent {
  constructor() {
    this.qTable = {};
    this.epsilon = 0.1; // Start with high exploration
    this.learnRate = 0.2; // Lower learning rate for smoother updates
    this.discountFactor = 0.8; // Prioritize immediate rewards
  }

  getState(player, discretizedElapsed) {
    const dy = player.y - centerLineY; // Distance from centerline
    const playery = player.y;
    // const inSafeZone = player.y > centerLineY - 50 && player.y < centerLineY + 50 ? 1 : 0;

    // Return the simplified state including discretizedElapsed
    return `${Math.floor(dy)},${Math.floor(playery)},${discretizedElapsed}`;
}


  chooseAction(state) {
    const qJump = this.qTable[state]?.jump ?? -Infinity;
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
    const currentQ = this.qTable[state]?.[action === 1 ? "jump" : "stay"] ?? 0;
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

  update(deltaTime, timestamp);
  render();

  lastTime = timestamp; // Update lastTime after update and render
}

function update(deltaTime, timestamp) {
  const elapsedSinceJump = (timestamp - lastJumpTime).toFixed(2); // Time since last jump in seconds
  // Discretize elapsed time into 0.5-second bins
  const discretizedElapsed = Math.floor(elapsedSinceJump / 0.5);

  // Agent decision-making
  const state = agent.getState(player, discretizedElapsed);
  const action = agent.chooseAction(state);

  if (action === 1) {
    spacebar = true;
    lastJumpTime = timestamp; // Reset the jump timer using timestamp
  }

  // Proceed with game updates
  let reward = playerPosition(deltaTime, elapsedSinceJump); // Pass elapsedSinceJump

  const nextElapsedSinceJump = ((timestamp - lastJumpTime)).toFixed(2);
  // const nextDiscretizedElapsed = Math.floor(nextElapsedSinceJump / 0.5);
  const nextState = agent.getState(player, nextElapsedSinceJump);

  // Update Q-values and log only under specific conditions

    if (action == 1 || Math.abs(reward) > 0.1) {
      agent.updateQValue(state, action, reward, nextState);
      console.log(
        `Updated Q Values: ${state} ${action} ${reward} ${nextState}`
      );
  
  }
  
  //}

  // Update metrics
  updateMetrics();

  // Gradually decay exploration rate
 // agent.epsilon = Math.max(0.001, agent.epsilon * 0.995);
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

function playerPosition(deltaTime, elapsedSinceJump) {
  let reward = 0; // Small time decay penalty
  
  if (player.y > player.radius + 50 && player.y < canvas.height - player.radius - 50) {
    // reward += 0.1; // Continuous positive reinforcement for staying safe
    // positiveRewards += 0.1;
  }
  // Penalty for being close to the ceiling
  const nearCeilingPenalty = player.y < player.radius + 50 ? -0.1 : 0; // Adjust ceiling margin if needed
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
    reward -= 5; // Drastically increase penalty for hitting the ceiling
    negativeRewards += 5;

    // Reset game state
    totalGames++;
    totalScore += counter;
    if (counter > highScore) highScore = counter;
    counter = 0;
    episodes++;
  }

  // // // Positive reward for reaching the top of a hop without touching the ceiling
  // if (player.velocity > 0 && player.y > player.radius + 50 && player.y < centerLineY && elapsedSinceJump > 0.5) {
  //   reward += 5; // Reward for successfully reaching the top
  //   positiveRewards += 1;
  // }

  // Positive reward for being near the centerline
  const centerProximity = Math.abs(player.y - centerLineY);
  if (centerProximity <= 10) {
    reward += 10; // Positive reward for staying near the centerline
    positiveRewards += 100;
    counter++;
  }

  if (spacebar) {
    if (player.velocity < 0) {
      reward -= 10; // Penalize jumps when already moving upward
    }

    if (elapsedSinceJump < 0.5) {
      reward -= 5; // Penalize jumps occurring less than 0.5 seconds after the last jump
    }

    player.velocity = -5; // Jump immediately
    spacebar = false;
  }

  player.y += player.velocity * deltaTime * 60; // Adjust movement by deltaTime
  player.velocity += 0.60 * deltaTime * 60; // Gravity effect

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

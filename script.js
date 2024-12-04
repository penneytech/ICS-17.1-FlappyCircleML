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

let speedMultiplier = 1; // Simulation speed multiplier
let gapSize = 200; // Adjusted gap size

let positiveRewardsMultiplierCenter = 10; // Multiplier for proximity rewards

let canvas, ctx;
let backgroundImg = new Image();
backgroundImg.src = "background.jpg"; // Load the background image once

// Agent parameters
let agent;

// DOM elements for performance metrics
let totalEpisodesElem, totalGamesElem, averageScoreElem, highestScoreElem;
let epsilonElem, learningRateElem, discountFactorElem;
let positiveRewardsElem, negativeRewardsElem;
let gapTopYElem, gapBottomYElem;
let gapCenterYElem, dyElem, playery; // Elements for gapCenterY, dy, and playery

let collisionOccurred = false; // Flag to track if collision has occurred

// Variables for timing
let lastTime = 0;

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
  gapTopYElem = document.getElementById("gapTopY");
  gapBottomYElem = document.getElementById("gapBottomY");
  gapCenterYElem = document.getElementById("gapCenterY");
  dyElem = document.getElementById("dy");
  playery = document.getElementById("playery");

  // Update initial agent parameters
  epsilonElem.textContent = agent.epsilon.toFixed(2);
  learningRateElem.textContent = agent.learnRate;
  discountFactorElem.textContent = agent.discountFactor;

  startGame();

  lastTime = performance.now();

  window.requestAnimationFrame(gameLoop);
}

function startGame() {
  if (!player) {
    player = new Circle(250, canvas.height / 2, 10, "yellow", 0.1);
  }
  // Initialize the first rectangle with random gap position
  let gapPosition = randomGapPosition(gapSize);
  rectangle = new RectangleTemplate(
    480,
    gapPosition + gapSize,
    50,
    canvas.height - (gapPosition + gapSize),
    "green"
  ); // Bottom rectangle
  rectangleTop = new RectangleTemplate(480, 0, 50, gapPosition, "green"); // Top rectangle

  // Update the gap Y coordinates in the table
  gapTopYElem.textContent = rectangleTop.h;
  gapBottomYElem.textContent = rectangle.y;

  // Log the new gap coordinates
  console.log(`CURRENT GAP: ${rectangleTop.h} - ${rectangle.y}`);
}

class RLAgent {
  constructor() {
    this.qTable = {};
    this.epsilon = 0.1; // Exploration rate
    this.learnRate = 0.01; // Learning rate
    this.discountFactor = 0.9; // Discount factor for future rewards
  }

  getState(player, rectangle, rectangleTop) {
    const dx = rectangle.x - player.x;
    const gapStart = rectangleTop.h;
    const gapEnd = rectangle.y;
    const gapCenterY = (gapStart + gapEnd) / 2;
    const dy = player.y - gapCenterY;
    const playery = player.y;

    return `${Math.floor(player.y)},${Math.floor(
      player.velocity
    )},${Math.floor(dx)},${Math.floor(dy)},${Math.floor(gapCenterY)},${Math.floor(playery)}`;
  }

  chooseAction(state) {
    if (Math.random() < this.epsilon) {
      // Exploration: random action
      return Math.random() < 0.5 ? 1 : 0;
    }

    // Exploitation: choose the best known action
    const qJump = this.qTable[state]?.jump || 0;
    const qStay = this.qTable[state]?.stay || 0;
    return qJump > qStay ? 1 : 0;
  }

  updateQValue(state, action, reward, nextState) {
    const maxNextQ = Math.max(
      this.qTable[nextState]?.jump || 0,
      this.qTable[nextState]?.stay || 0
    );
    const currentQ =
      this.qTable[state]?.[action === 1 ? "jump" : "stay"] || 0;
    const newQ =
      currentQ +
      this.learnRate * (reward + this.discountFactor * maxNextQ - currentQ);

    if (!this.qTable[state]) this.qTable[state] = {};
    this.qTable[state][action === 1 ? "jump" : "stay"] = newQ;
  }
}

function Circle(x, y, radius, color, velocity) {
  this.x = x;
  this.y = y;
  this.radius = radius;
  this.color = color;
  this.velocity = velocity;
}

function RectangleTemplate(x, y, w, h, color) {
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
  this.color = color;
  this.scored = false; // Property to track scoring
  this.proximityRewardGiven = false; // Track if proximity reward has been given
  this.centerRewardGiven = false; // New flag to track center reward
}

function gameLoop(timestamp) {
  window.requestAnimationFrame(gameLoop);

  const deltaTime = (timestamp - lastTime) / 1000; // Convert to seconds
  lastTime = timestamp;

  update(deltaTime);
  render();
}

function update(deltaTime) {
  const adjustedDeltaTime = deltaTime * speedMultiplier;

  // Agent decision-making every frame
  const state = agent.getState(player, rectangle, rectangleTop);
  const action = agent.chooseAction(state);

  if (action === 1) spacebar = true;

  // Proceed with game updates
  let reward = 0; // Initialize reward
  reward += playerPosition(adjustedDeltaTime); // Add reward from player position
  rectanglePosition(adjustedDeltaTime);

  const nextState = agent.getState(player, rectangle, rectangleTop);

  // Update metrics for gap center and dy
  let gapCenterY = (rectangleTop.h + rectangle.y) / 2;
  let dy = player.y - gapCenterY;

  // Update the DOM elements
  gapCenterYElem.textContent = gapCenterY.toFixed(2);
  dyElem.textContent = dy.toFixed(2);
  playery.textContent = player.y.toFixed(2);

  // Collision detection
  let collision = checkCollision(rectangle) || checkCollision(rectangleTop);

// Compute distance to gap center
let distanceToCenter = Math.abs(player.y - (rectangleTop.h + rectangle.y) / 2); // Absolute distance to center

// Calculate proximity reward
let proximityReward = Math.max(0, 4 - Math.floor(distanceToCenter / 500));

// Apply proximity reward only once per gap
if (!rectangle.proximityRewardGiven && player.x > rectangle.x) {
  reward += proximityReward;
  rectangle.proximityRewardGiven = true;

  console.log(
    `Proximity Reward Given. Distance to center: ${distanceToCenter.toFixed(
      2
    )}, Proximity Reward: ${proximityReward}`
  );
}


  // New code to give reward when distance to gap center is less than 50 pixels
  if (
    distanceToCenter < 10
  ) {
    let centerReward = 0.1; // Define the reward value

    reward += centerReward;
    positiveRewards += centerReward;

    console.log(
      `Center Reward Given. Distance to center: ${distanceToCenter.toFixed(
        2
      )}, Center Reward: ${centerReward}`
    );
  }

  // Check for collision
  if (!collisionOccurred && collision) {
    // Apply negative reward for collision
    reward -= 10;

    collisionOccurred = true;
    rectangle.color = "red";
    rectangleTop.color = "red";

    if (counter > highScore) {
      highScore = counter;
    }
    totalGames++;
    totalScore += counter;
    counter = 0;

    console.log("Collision detected. Rectangles turned red.");
  }

  // Reward when passing through the gap without collision
  if (
    !collisionOccurred &&
    !rectangle.scored &&
    player.x - player.radius > rectangle.x + rectangle.w
  ) {
    rectangle.scored = true; // Mark this gate as scored

    // Fixed reward for passing through the gap
    let successReward = 1;

    // Apply success reward
    reward += successReward;

    // Increment score
    counter++;

    console.log(
      `Passed through gap successfully. Success Reward: ${successReward}`
    );
  }

  // Update positive and negative rewards for metrics
  if (reward > 0) {
    positiveRewards += reward;
  } else if (reward < 0) {
    negativeRewards += reward;
  }

  // **Modified code to update Q-values only when action is taken or reward is given**
  if (action === 1 || reward !== 0) {
    agent.updateQValue(state, action, reward, nextState);
    //console.log("Q-value updated:", { state, action, reward });
  }

  // Update metrics for display
  updateMetrics();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  background();

  // Draw player
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  // Draw rectangles
  ctx.beginPath();
  ctx.rect(rectangle.x, rectangle.y, rectangle.w, rectangle.h);
  ctx.fillStyle = rectangle.color;
  ctx.fill();

  ctx.beginPath();
  ctx.rect(rectangleTop.x, rectangleTop.y, rectangleTop.w, rectangleTop.h);
  ctx.fillStyle = rectangleTop.color;
  ctx.fill();

  // Draw scores
  drawScores();
}

function playerPosition(deltaTime) {
  let reward = 0; // Initialize reward

  if (player.y > canvas.height - player.radius) {
    player.velocity = 0;
    player.y = canvas.height - player.radius;
    reward -= 2; // Negative reward for hitting the bottom
  }
  if (player.y < player.radius) {
    player.velocity = 0;
    player.y = player.radius;
    reward -= 2; // Negative reward for hitting the top
  }

  if (spacebar) {
    player.velocity = -5;
    spacebar = false;
  }

  player.y += player.velocity * deltaTime * 60; // Adjust movement by deltaTime
  player.velocity += 0.25 * deltaTime * 60; // Gravity effect

  return reward; // Return the reward
}

function rectanglePosition(deltaTime) {
  // Move rectangles together
  rectangle.x -= 4 * deltaTime * 60; // Adjust movement by deltaTime
  rectangleTop.x = rectangle.x; // Synchronize top rectangle's x position

  if (rectangle.x < -50) {
    rectangle.x = 480;
    rectangleTop.x = rectangle.x; // Reset top rectangle's x position

    // Randomize the gap and rectangle heights on reset
    let gapPosition = randomGapPosition(gapSize);
    rectangle.y = gapPosition + gapSize;
    rectangle.h = canvas.height - rectangle.y;
    rectangleTop.h = gapPosition;
    rectangleTop.y = 0; // Top rectangle starts from y=0

    // Reset scoring flags
    rectangle.scored = false;
    rectangle.proximityRewardGiven = false;
    rectangle.centerRewardGiven = false; // Reset center reward flag

    // Reset collision flag and rectangle colors
    collisionOccurred = false;
    rectangle.color = "green";
    rectangleTop.color = "green";

    // Start a new episode
    episodes++;
    updateMetrics();

    // Update the gap Y coordinates in the table
    gapTopYElem.textContent = rectangleTop.h;
    gapBottomYElem.textContent = rectangle.y;

    // Log the new gap coordinates
    console.log(`CURRENT GAP: ${rectangleTop.h} - ${rectangle.y}`);
    console.log("Starting new episode.");
  }
}

function checkCollision(rect) {
  return (
    rect.x <= player.x + player.radius &&
    rect.x + rect.w >= player.x - player.radius &&
    player.y + player.radius > rect.y &&
    player.y - player.radius < rect.y + rect.h
  );
}

function drawScores() {
  ctx.font = "20px Arial";
  ctx.fillStyle = "black";
  ctx.fillText(`High Score: ${highScore}`, 10, 20);
  ctx.fillText(`Score: ${counter}`, 10, 50);
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomGapPosition(gapHeight) {
  const minGapStart = 20; // Gap must start at least at y=20
  const maxGapStart = canvas.height - gapHeight - 20; // Gap must end at most at y=460
  return randomInteger(minGapStart, maxGapStart);
}

document.body.onkeydown = function (key) {
  if (key.keyCode === 32) {
    spacebar = true;
  }
};

function background() {
  ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
}

function updateMetrics() {
  totalEpisodesElem.textContent = episodes;
  totalGamesElem.textContent = totalGames;
  averageScoreElem.textContent = (
    totalScore / (totalGames || 1)
  ).toFixed(2);
  highestScoreElem.textContent = highScore;
  positiveRewardsElem.textContent = positiveRewards.toFixed(2);
  negativeRewardsElem.textContent = negativeRewards.toFixed(2);
  epsilonElem.textContent = agent.epsilon.toFixed(2);
  learningRateElem.textContent = agent.learnRate;
  discountFactorElem.textContent = agent.discountFactor;
}

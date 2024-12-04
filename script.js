// Call the init function when the HTML window loads
window.onload = init;

let player;
let spacebar = false;
let counter = 0;
let episodes = 0;
let totalReward = 0;
let survivalTime = 0;
let agent;
let highScore = 0; // Track the highest score achieved

let speedmultiplier = 1;
let gapSize = 250; // Control the size of the gap

function init() {
  canvas = document.getElementById("myCanvas");
  ctx = canvas.getContext("2d");

  agent = new RLAgent();

  player = new Circle(250, canvas.height / 2, 10, "yellow", 0.1);
  // Initialize the first rectangle with random gap position
  rectangle = new RectangleTemplate(480, randomGapPosition(gapSize), 50, 480, "green"); // 480px tall
  rectangleTop = new RectangleTemplate(480, rectangle.y - gapSize, 50, 480, "green"); // Ensure initial gap exists

  window.requestAnimationFrame(gameLoop);
}

class RLAgent {
  constructor() {
    this.qTable = {};
    this.epsilon = 0.1;
    this.learnRate = 0.01;
    this.discountFactor = 0.9;
  }

  getState(player, rectangle, rectangleTop) {
    const dx = rectangle.x - player.x;
    const gapStart = rectangleTop.h;
    const gapEnd = rectangle.y;
    const dy = player.y - gapStart;
    return `${Math.floor(player.y)},${Math.floor(player.velocity)},${Math.floor(dx)},${Math.floor(dy)},${Math.floor(gapEnd - gapStart)}`;
  }

  chooseAction(state, player, gapTop, gapBottom) {
    const belowGap = player.y > gapBottom;
    const falling = player.velocity > 0;

    if (Math.random() < this.epsilon) {
      return belowGap || falling ? 1 : 0; // Explore
    }

    const qJump = this.qTable[state]?.jump || 0;
    const qStay = this.qTable[state]?.stay || 0;
    return qJump > qStay && (belowGap || falling) ? 1 : 0; // Exploit
  }

  updateQValue(state, action, reward, nextState) {
    const maxNextQ = Math.max(
      this.qTable[nextState]?.jump || 0,
      this.qTable[nextState]?.stay || 0
    );
    const currentQ = this.qTable[state]?.[action === 1 ? "jump" : "stay"] || 0;
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
  this.scored = false; // New property to track scoring
}

// Game loop
function gameLoop(timestamp) {
  window.requestAnimationFrame(gameLoop);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  background();

  const gapTop = rectangleTop.h;
  const gapBottom = rectangle.y;

  const state = agent.getState(player, rectangle, rectangleTop);
  const action = agent.chooseAction(state, player, gapTop, gapBottom);

  if (action === 1) spacebar = true;

  playerPosition();
  rectanglePosition();
  rectangleTopPosition();

  drawScores(); // Display scores on screen

  // Collision and alignment
  let reward = 1;

  // Check for collision with both rectangles
  if (checkCollision(rectangle) || checkCollision(rectangleTop)) {
    reward = -100;
    handleRestart(state, action, reward, gapTop, gapBottom);
    return;
  }

  if (rectangle.x <= player.x + player.radius &&
      rectangle.x + rectangle.w >= player.x - player.radius) {
    if (isInGap(player, gapTop, gapBottom)) {
      reward += 100;
    }
  }

  const nextState = agent.getState(player, rectangle, rectangleTop);
  agent.updateQValue(state, action, reward, nextState);

  survivalTime++;
}

// Handle restarting the game
function handleRestart(state, action, reward, gapTop, gapBottom) {
  totalReward += reward;
  episodes++;

  console.log(`Episode: ${episodes}`);
  console.log(`Total Reward: ${totalReward}`);
  console.log(`Survival Time: ${survivalTime}`);
  console.log(`Gap Coordinates - Top: ${gapTop}, Bottom: ${gapBottom}`);
  console.log(`Q-Table Size: ${Object.keys(agent.qTable).length}`);

  survivalTime = 0;
  player = new Circle(250, canvas.height / 2, 10, "yellow", 0.1);
  rectangle = new RectangleTemplate(480, randomGapPosition(gapSize), 50, 480, "green"); // 480px tall
  rectangleTop = new RectangleTemplate(480, rectangle.y - gapSize, 50, 480, "green"); // Ensure initial gap exists

  // Reset counter and scoring flag for new game
  counter = 0;
  rectangle.scored = false; // Ensure the rectangle is ready for scoring
}

// Player position update
function playerPosition() {
  if (player.y > 480) {
    player.velocity = 0;
    player.y = 480;
  }
  if (player.y < 0) {
    player.velocity = 0;
    player.y = 0;
  }

  if (spacebar) {
    player.velocity = -5;
    spacebar = false;
  }

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  player.y = player.y + player.velocity;
  player.velocity += 0.25;
}

// Update the rectangles and scoring
function rectanglePosition() {
  ctx.beginPath();
  ctx.rect(rectangle.x, rectangle.y, rectangle.w, rectangle.h);
  ctx.fillStyle = rectangle.color;
  ctx.fill();

  rectangle.x -= 4 * speedmultiplier; // Move rectangle based on speed multiplier

  if (rectangle.x + rectangle.w < 0 && !rectangle.scored) {
    counter++; // Increment score
    rectangle.scored = true; // Mark this gate as scored
    if (counter > highScore) {
      highScore = counter; // Update high score if needed
    }
  }

  if (rectangle.x < -50) {
    rectangle.x = 480;
    // Randomize the gap and rectangle height on reset
    rectangle.y = randomGapPosition(gapSize); // Random position for bottom rectangle
    rectangleTop.h = randomInteger(100, 250); // Random height for top rectangle
    rectangleTop.y = rectangle.y - rectangleTop.h; // Position the top rectangle based on bottom rectangle's height
    rectangle.scored = false; // Reset scoring flag
  }
}

// Update the top rectangle position
function rectangleTopPosition() {
  ctx.beginPath();
  ctx.rect(rectangleTop.x, rectangleTop.y, rectangleTop.w, rectangleTop.h);
  ctx.fillStyle = rectangleTop.color;
  ctx.fill();

  rectangleTop.x -= 4 * speedmultiplier; // Move rectangle based on speed multiplier

  if (rectangleTop.x < -50) {
    rectangleTop.x = 480;
    // Randomize the gap position when rectangleTop resets
    rectangleTop.h = randomInteger(100, 250);
    rectangleTop.y = rectangle.y - rectangleTop.h; // Correct the gap position after reset
  }
}

// Check for collision with either rectangle
function checkCollision(rect) {
  return (
    rect.x <= player.x + player.radius &&
    rect.x + rect.w >= player.x - player.radius &&
    player.y + player.radius > rect.y && 
    player.y - player.radius < rect.y + rect.h
  );
}

// Check if the player is inside the gap
function isInGap(circle, gapStart, gapEnd) {
  return (
    circle.y - circle.radius >= gapStart &&
    circle.y + circle.radius <= gapEnd
  );
}

// Draw the scores (current and high score)
function drawScores() {
  ctx.font = "20px Arial";
  ctx.fillStyle = "black";
  ctx.fillText(`High Score: ${highScore}`, 10, 20);
  ctx.fillText(`Score: ${counter}`, 10, 50);
}

// Helper function to generate random integers for positioning
function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate a random position for the gap (to ensure it's within the screen bounds)
function randomGapPosition(gapHeight) {
  const maxY = canvas.height - gapHeight; // Ensure the gap stays within the visible area
  return randomInteger(20, maxY);
}

// Detect key press for spacebar
document.body.onkeydown = function (key) {
  if (key.keyCode === 32) {
    spacebar = true;
  }
};

// Background image rendering
function background() {
  img = new Image();
  img.src = "background.jpg";
  ctx.drawImage(img, 0, 0, 1000, 480);
}

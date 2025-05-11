import { Vector2D, Ball } from '../types';

// Generate a random color
export const getRandomColor = (): string => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Generate a random pastel color
export const getRandomPastelColor = (): string => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 80%)`;
};

// Calculate distance between two points
export const distance = (p1: Vector2D, p2: Vector2D): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Check if a ball is colliding with the circle boundary
export const isCollidingWithCircle = (
  ball: Ball, 
  centerX: number, 
  centerY: number, 
  circleRadius: number
): boolean => {
  const distanceFromCenter = distance(
    { x: centerX, y: centerY }, 
    ball.position
  );
  
  return distanceFromCenter + ball.radius >= circleRadius;
};

// Calculate reflection vector when ball hits circular boundary
export const reflectVelocity = (
  ball: Ball, 
  centerX: number, 
  centerY: number
): Vector2D => {
  // Calculate normal vector from center to ball
  const nx = ball.position.x - centerX;
  const ny = ball.position.y - centerY;
  
  // Normalize the normal
  const length = Math.sqrt(nx * nx + ny * ny);
  const normalX = nx / length;
  const normalY = ny / length;
  
  // Calculate dot product of velocity and normal
  const dotProduct = 
    ball.velocity.x * normalX + 
    ball.velocity.y * normalY;
  
  // Calculate reflection
  return {
    x: ball.velocity.x - 2 * dotProduct * normalX,
    y: ball.velocity.y - 2 * dotProduct * normalY
  };
};

// Generate a unique ID for balls
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

// Create a new ball with random properties
export const createRandomBall = (
  canvasWidth: number, 
  canvasHeight: number, 
  radius = 10
): Ball => {
  return {
    id: generateId(),
    position: {
      x: canvasWidth / 2,
      y: canvasHeight / 2
    },
    velocity: {
      x: (Math.random() - 0.5) * 5,
      y: (Math.random() - 0.5) * 5
    },
    radius,
    color: getRandomPastelColor()
  };
};

// Apply gravity to velocity
export const applyGravity = (velocity: Vector2D, gravity: number): Vector2D => {
  return {
    x: velocity.x,
    y: velocity.y + gravity
  };
};

// Calculate new position based on velocity
export const updatePosition = (
  position: Vector2D, 
  velocity: Vector2D
): Vector2D => {
  return {
    x: position.x + velocity.x,
    y: position.y + velocity.y
  };
}; 
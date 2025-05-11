import React, { useRef, useEffect, useState } from 'react';
import { GameProps, Ball, GameState } from '../types';
import { 
  createRandomBall, 
  isCollidingWithCircle, 
  reflectVelocity, 
  updatePosition,
  getRandomPastelColor,
  generateId
} from '../utils/gameUtils';
import { 
  playBounceSound, 
  playRandomSound, 
  playGameOverSound 
} from '../utils/sounds';

const RotatingCircle: React.FC<GameProps> = ({ isPlaying, onGameEnd }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const [gameState, setGameState] = useState<GameState>({
    balls: [],
    score: 0,
    gameOver: false
  });
  const [rotation, setRotation] = useState(0);
  
  // Initialize game
  useEffect(() => {
    if (!isPlaying) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Reset game state
    const initialBall = createRandomBall(canvas.width, canvas.height, 10);
    
    setGameState({
      balls: [initialBall],
      score: 0,
      gameOver: false
    });
    
    setRotation(0);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying]);
  
  // Game loop
  useEffect(() => {
    if (!isPlaying || gameState.gameOver) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const circleRadius = Math.min(canvas.width, canvas.height) * 0.4;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const holeSize = Math.PI / 4; // Size of the hole in the circle
    
    const animate = () => {
      if (!canvas || !ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update rotation
      setRotation(prev => (prev + 0.01) % (Math.PI * 2));
      
      // Draw outer circle with a hole
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, rotation, rotation + Math.PI * 2 - holeSize);
      ctx.strokeStyle = 'rgba(255, 100, 0, 0.8)';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Track balls that are out of the circle
      const outBalls: Ball[] = [];
      const inBalls: Ball[] = [];
      
      // Update ball positions and check for collisions
      gameState.balls.forEach(ball => {
        // Update position
        const newPosition = updatePosition(ball.position, ball.velocity);
        
        // Calculate angle from center
        const dx = newPosition.x - centerX;
        const dy = newPosition.y - centerY;
        const angle = Math.atan2(dy, dx);
        
        // Normalize angle to [0, 2π]
        const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2);
        
        // Check if ball is in the hole
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
        const isInHoleAngle = normalizedAngle > rotation && 
                              normalizedAngle < rotation + holeSize;
        
        const isNearEdge = Math.abs(distanceFromCenter - circleRadius) < ball.radius;
        
        if (isNearEdge && isInHoleAngle) {
          // Ball is exiting through the hole
          if (distanceFromCenter > circleRadius) {
            outBalls.push({
              ...ball,
              position: newPosition
            });
            
            // Play sound when ball exits
            playRandomSound();
            
            // Update score
            setGameState(prev => ({
              ...prev,
              score: prev.score + 1
            }));
            
            return;
          }
        }
        
        // Check for collision with circle boundary
        const isColliding = isCollidingWithCircle(
          { ...ball, position: newPosition },
          centerX,
          centerY,
          circleRadius
        );
        
        if (isColliding && !isInHoleAngle) {
          // Ball hit the boundary, reflect the velocity
          const reflectedVelocity = reflectVelocity(
            { ...ball, position: newPosition },
            centerX,
            centerY
          );
          
          // Play bounce sound
          playBounceSound(ball.radius / 30);
          
          inBalls.push({
            ...ball,
            position: newPosition,
            velocity: reflectedVelocity
          });
        } else if (distanceFromCenter > circleRadius + ball.radius * 2) {
          // Ball is completely outside the circle
          outBalls.push({
            ...ball,
            position: newPosition
          });
        } else {
          // Ball is still inside or partially inside
          inBalls.push({
            ...ball,
            position: newPosition
          });
        }
      });
      
      // For each ball that exited, create 2-3 new balls
      const newBalls: Ball[] = [];
      
      outBalls.forEach(() => {
        // Add 2-3 new balls
        const numNewBalls = Math.floor(Math.random() * 2) + 2; // 2 or 3
        
        for (let i = 0; i < numNewBalls; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 5 + Math.random() * 5;
          const speed = 1 + Math.random() * 2;
          
          newBalls.push({
            id: generateId(),
            position: {
              x: centerX,
              y: centerY
            },
            velocity: {
              x: Math.cos(angle) * speed,
              y: Math.sin(angle) * speed
            },
            radius,
            color: getRandomPastelColor()
          });
        }
      });
      
      // Update game state
      setGameState(prev => {
        const updatedBalls = [...inBalls, ...newBalls];
        
        // Check if there are too many balls (game over condition)
        if (updatedBalls.length > 50) {
          playGameOverSound();
          if (onGameEnd) onGameEnd();
          return {
            ...prev,
            balls: updatedBalls,
            gameOver: true
          };
        }
        
        return {
          ...prev,
          balls: updatedBalls
        };
      });
      
      // Draw balls
      [...inBalls, ...outBalls, ...newBalls].forEach(ball => {
        ctx.beginPath();
        ctx.arc(
          ball.position.x,
          ball.position.y,
          ball.radius,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      
      // Continue animation
      if (!gameState.gameOver) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameState, isPlaying, onGameEnd, rotation]);
  
  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className="game-canvas"
      />
      {gameState.gameOver && (
        <div className="game-over">
          <h2>Game Over!</h2>
          <p>Score: {gameState.score}</p>
        </div>
      )}
      <div className="score-display">
        Score: {gameState.score}
      </div>
    </div>
  );
};

export default RotatingCircle; 
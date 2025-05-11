import React, { useRef, useEffect, useState } from 'react';
import { GameProps, Ball, GameState, Vector2D } from '../types';
import { 
  createRandomBall, 
  isCollidingWithCircle, 
  reflectVelocity, 
  updatePosition, 
  getRandomPastelColor 
} from '../utils/gameUtils';
import { 
  playBounceSound, 
  playRandomSound 
} from '../utils/sounds';

interface TrailPoint {
  position: Vector2D;
  color: string;
  radius: number;
  alpha: number;
}

const TrailBall: React.FC<GameProps> = ({ isPlaying, onGameEnd }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const [gameState, setGameState] = useState<GameState>({
    balls: [],
    score: 0,
    gameOver: false
  });
  const [trailPoints, setTrailPoints] = useState<TrailPoint[]>([]);
  const [trailColor, setTrailColor] = useState(getRandomPastelColor());
  
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
    
    setTrailPoints([]);
    setTrailColor(getRandomPastelColor());
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying]);
  
  // Game loop
  useEffect(() => {
    if (!isPlaying) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const circleRadius = Math.min(canvas.width, canvas.height) * 0.4;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const animate = () => {
      if (!canvas || !ctx) return;
      
      // Draw background with some fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw outer circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 100, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Update trail points - fade them out
      const updatedTrailPoints = trailPoints
        .map(point => ({
          ...point,
          alpha: point.alpha - 0.01 // Fade out
        }))
        .filter(point => point.alpha > 0); // Remove completely faded points
      
      // Update ball positions and check for collisions
      const updatedBalls = gameState.balls.map(ball => {
        // Update position
        const newPosition = updatePosition(ball.position, ball.velocity);
        
        // Add a trail point
        updatedTrailPoints.push({
          position: { ...ball.position },
          color: trailColor,
          radius: ball.radius * 0.8,
          alpha: 0.8
        });
        
        // Check for collision with circle boundary
        const isColliding = isCollidingWithCircle(
          { ...ball, position: newPosition },
          centerX,
          centerY,
          circleRadius
        );
        
        if (isColliding) {
          // Ball hit the boundary, reflect the velocity
          const reflectedVelocity = reflectVelocity(
            { ...ball, position: newPosition },
            centerX,
            centerY
          );
          
          // Play bounce sound
          playBounceSound(0.5);
          
          // Change trail color
          setTrailColor(getRandomPastelColor());
          
          // Play random sound
          playRandomSound();
          
          // Update score
          setGameState(prev => ({
            ...prev,
            score: prev.score + 1
          }));
          
          return {
            ...ball,
            position: newPosition,
            velocity: reflectedVelocity
          };
        }
        
        return {
          ...ball,
          position: newPosition
        };
      });
      
      // Update game state
      setGameState(prev => ({
        ...prev,
        balls: updatedBalls
      }));
      
      // Update trail points
      setTrailPoints(updatedTrailPoints);
      
      // Draw trail points
      updatedTrailPoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(
          point.position.x,
          point.position.y,
          point.radius,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `${point.color}${Math.floor(point.alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
      });
      
      // Draw balls
      updatedBalls.forEach(ball => {
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      
      // Continue animation
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameState, isPlaying, trailPoints, trailColor]);
  
  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className="game-canvas"
      />
      <div className="score-display">
        Score: {gameState.score}
      </div>
    </div>
  );
};

export default TrailBall; 
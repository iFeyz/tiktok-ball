import React, { useRef, useEffect, useState } from 'react';
import { GameProps, Ball, GameState, Vector2D } from '../types';
import { 
  createRandomBall, 
  isCollidingWithCircle, 
  reflectVelocity, 
  updatePosition,
  getRandomPastelColor,
  generateId,
  distance
} from '../utils/gameUtils';
import { 
  playBounceSound, 
  playRandomSound, 
  playGameOverSound 
} from '../utils/sounds';

interface BonusSection {
  startAngle: number;
  endAngle: number;
  color: string;
}

interface CircleSpinBallProps extends GameProps {
  rotationSpeed?: number;
  growthRate?: number;
  circleSize?: number;
  bonusSectionCount?: number;
  ballSpeed?: number;
  bounciness?: number;
  effectsEnabled?: boolean;
  bounceVolume?: number;
}

const CircleSpinBall: React.FC<CircleSpinBallProps> = ({ 
  isPlaying, 
  onGameEnd,
  rotationSpeed = 0.005,
  growthRate = 0.1,
  circleSize = 0.4,
  bonusSectionCount = 3,
  ballSpeed = 5,
  bounciness = 0.8,
  effectsEnabled = true,
  bounceVolume = 0.3
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  
  const [gameState, setGameState] = useState<GameState>({
    balls: [],
    score: 0,
    gameOver: false
  });
  
  const [rotation, setRotation] = useState(0);
  const [bonusSections, setBonusSections] = useState<BonusSection[]>([]);
  
  // Initialize bonus sections
  const initBonusSections = () => {
    const sections: BonusSection[] = [];
    const sectionSize = Math.PI / 12; // Size of bonus sections
    
    for (let i = 0; i < bonusSectionCount; i++) {
      const startAngle = (Math.PI * 2 / bonusSectionCount) * i;
      sections.push({
        startAngle,
        endAngle: startAngle + sectionSize,
        color: getRandomPastelColor()
      });
    }
    
    setBonusSections(sections);
  };
  
  // Initialize game
  useEffect(() => {
    if (!isPlaying) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Reset game state
    const initialBall = {
      ...createRandomBall(canvas.width, canvas.height, 10),
      velocity: {
        x: (Math.random() - 0.5) * ballSpeed,
        y: (Math.random() - 0.5) * ballSpeed
      }
    };
    
    setGameState({
      balls: [initialBall],
      score: 0,
      gameOver: false
    });
    
    setRotation(0);
    initBonusSections();
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, ballSpeed, bonusSectionCount]);
  
  // Game loop
  useEffect(() => {
    if (!isPlaying || gameState.gameOver) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const circleRadius = Math.min(canvas.width, canvas.height) * circleSize;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const animate = (time: number) => {
      if (!canvas || !ctx) return;
      
      // Calculate delta time
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update rotation
      setRotation(prev => (prev + rotationSpeed * deltaTime / 16) % (Math.PI * 2));
      
      // Draw outer circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Draw bonus sections
      bonusSections.forEach(section => {
        ctx.beginPath();
        ctx.arc(
          centerX, 
          centerY, 
          circleRadius, 
          section.startAngle + rotation, 
          section.endAngle + rotation
        );
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = section.color;
        ctx.fill();
      });
      
      // Create array for new balls from bonus hits
      const newBalls: Ball[] = [];
      let isGameOver = false;
      
      // Update ball positions and check for collisions
      const updatedBalls = gameState.balls.map(ball => {
        // Apply growth
        const newRadius = ball.radius + (growthRate / 100);
        
        // Check if ball has grown too large
        if (newRadius >= circleRadius) {
          isGameOver = true;
          return ball;
        }
        
        // Update position
        const newPosition = updatePosition(ball.position, ball.velocity);
        
        // Calculate distance to center
        const distToCenter = distance(
          { x: centerX, y: centerY },
          newPosition
        );
        
        // Check for collision with circle boundary
        if (distToCenter + newRadius > circleRadius) {
          // Calculate angle from center
          const angle = Math.atan2(
            newPosition.y - centerY,
            newPosition.x - centerX
          );
          
          // Normalize angle to [0, 2π]
          const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2);
          
          // Check if the ball hits a bonus section
          const hitBonus = bonusSections.some(section => {
            const sectionStart = (section.startAngle + rotation) % (Math.PI * 2);
            const sectionEnd = (section.endAngle + rotation) % (Math.PI * 2);
            
            // Handle wrap-around for sections
            if (sectionStart > sectionEnd) {
              return normalizedAngle >= sectionStart || normalizedAngle <= sectionEnd;
            }
            
            return normalizedAngle >= sectionStart && normalizedAngle <= sectionEnd;
          });
          
          if (hitBonus) {
            // Create a new ball
            const newBall = {
              id: generateId(),
              position: {
                x: centerX,
                y: centerY
              },
              velocity: {
                x: (Math.random() - 0.5) * ballSpeed,
                y: (Math.random() - 0.5) * ballSpeed
              },
              radius: 10,
              color: getRandomPastelColor()
            };
            
            newBalls.push(newBall);
            
            // Play a special sound for bonus
            playRandomSound();
            
            // Increase score
            setGameState(prev => ({
              ...prev,
              score: prev.score + 5
            }));
          }
          
          // Reflect the velocity with bounce physics
          const reflectedVelocity = reflectVelocity(
            { ...ball, position: newPosition },
            centerX,
            centerY
          );
          
          // Apply bounciness factor
          const dampedVelocity = {
            x: reflectedVelocity.x * bounciness,
            y: reflectedVelocity.y * bounciness
          };
          
          // Play bounce sound
          playBounceSound(bounceVolume);
          
          // Return updated ball
          return {
            ...ball,
            radius: newRadius,
            position: {
              x: newPosition.x,
              y: newPosition.y
            },
            velocity: dampedVelocity
          };
        }
        
        // Ball is not colliding, just update position
        return {
          ...ball,
          radius: newRadius,
          position: newPosition
        };
      });
      
      // Update game state
      setGameState(prev => {
        if (isGameOver) {
          playGameOverSound();
          if (onGameEnd) onGameEnd();
          return {
            ...prev,
            balls: [...updatedBalls, ...newBalls],
            gameOver: true
          };
        }
        
        return {
          ...prev,
          balls: [...updatedBalls, ...newBalls]
        };
      });
      
      // Draw balls
      [...updatedBalls, ...newBalls].forEach(ball => {
        // Draw ball
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
        
        // Draw outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw effects if enabled
        if (effectsEnabled) {
          // Draw inner glow
          const gradient = ctx.createRadialGradient(
            ball.position.x,
            ball.position.y,
            0,
            ball.position.x,
            ball.position.y,
            ball.radius
          );
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.beginPath();
          ctx.arc(
            ball.position.x,
            ball.position.y,
            ball.radius * 0.8,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      });
      
      // Draw score
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText(`Score: ${gameState.score}`, canvas.width / 2, 30);
      
      // Draw ball count
      ctx.font = '16px Arial';
      ctx.fillText(`Balls: ${gameState.balls.length}`, canvas.width / 2, 60);
      
      // Continue animation if game is not over
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
  }, [isPlaying, gameState, rotation, bonusSections, bounceVolume, bounciness, effectsEnabled, circleSize, growthRate, rotationSpeed, ballSpeed]);
  
  return (
    <div className="game-container">
      <canvas 
        ref={canvasRef}
        width={800}
        height={600}
        style={{ background: '#000' }}
      />
      {gameState.gameOver && (
        <div className="game-over-overlay">
          <h2>Game Over!</h2>
          <p>Final Score: {gameState.score}</p>
          <p>Balls Created: {gameState.balls.length}</p>
        </div>
      )}
    </div>
  );
};

export default CircleSpinBall; 
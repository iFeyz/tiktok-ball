import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameProps, Ball, Vector2D } from '../types';
import { 
  getRandomPastelColor,
  generateId,
  distance,
  updatePosition,
  reflectVelocity // We might need this if the ball bounces off an outer boundary
} from '../utils/gameUtils';
import { 
  playBounceSound, 
  playGameOverSound, 
  playGameStartSound,
  playRandomSound // For circle destruction
} from '../utils/sounds';

interface Circle {
  id: string;
  radius: number;
  color: string;
  isDestroyed: boolean;
}

interface CollapsingCirclesState {
  ball: Ball | null;
  circles: Circle[];
  score: number;
  gameOver: boolean;
}

const CollapsingCircles: React.FC<GameProps> = ({ isPlaying, onGameEnd }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const [gameState, setGameState] = useState<CollapsingCirclesState>({
    ball: null,
    circles: [],
    score: 0,
    gameOver: false,
  });

  const initialCircleCount = 10;
  const circleGap = 30; // Gap between circles
  const ballRadius = 10;
  const ballSpeed = 3;
  const circleCollapseSpeed = 0.1;

  const initializeGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const newBall: Ball = {
      id: generateId(),
      position: { x: centerX, y: centerY },
      velocity: {
        x: (Math.random() - 0.5) * ballSpeed * 2,
        y: (Math.random() - 0.5) * ballSpeed * 2,
      },
      radius: ballRadius,
      color: getRandomPastelColor(),
    };

    const newCircles: Circle[] = [];
    for (let i = 0; i < initialCircleCount; i++) {
      newCircles.push({
        id: generateId(),
        radius: ballRadius + circleGap + (i * circleGap),
        color: getRandomPastelColor(),
        isDestroyed: false,
      });
    }

    setGameState({
      ball: newBall,
      circles: newCircles,
      score: 0,
      gameOver: false,
    });
    playGameStartSound();
  }, [ballSpeed, circleGap, initialCircleCount, ballRadius]);

  useEffect(() => {
    if (isPlaying) {
      initializeGame();
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, initializeGame]);

  useEffect(() => {
    if (!isPlaying || gameState.gameOver || !gameState.ball) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const animate = () => {
      if (!canvas || !ctx || !gameState.ball) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let currentBall = gameState.ball;
      let currentCircles = [...gameState.circles];
      let currentScore = gameState.score;
      let isGameOver = gameState.gameOver;

      // Update ball position
      currentBall.position = updatePosition(currentBall.position, currentBall.velocity);

      // Check for ball collision with canvas boundaries (optional, can be removed if ball should fly freely)
      if (currentBall.position.x - currentBall.radius < 0 || currentBall.position.x + currentBall.radius > canvas.width) {
        currentBall.velocity.x *= -1;
        currentBall.position.x = Math.max(currentBall.radius, Math.min(canvas.width - currentBall.radius, currentBall.position.x));
        playBounceSound(0.2);
      }
      if (currentBall.position.y - currentBall.radius < 0 || currentBall.position.y + currentBall.radius > canvas.height) {
        currentBall.velocity.y *= -1;
        currentBall.position.y = Math.max(currentBall.radius, Math.min(canvas.height - currentBall.radius, currentBall.position.y));
        playBounceSound(0.2);
      }
      
      // Check for circle destruction and collapse
      const ballDistFromCenter = distance(currentBall.position, { x: centerX, y: centerY });

      currentCircles = currentCircles.map(circle => {
        if (circle.isDestroyed) return circle;

        if (ballDistFromCenter > circle.radius) {
          playRandomSound(); // Sound for circle destruction
          currentScore += 10;
          return { ...circle, isDestroyed: true };
        }
        return circle;
      });

      // Collapse non-destroyed circles
      const activeCircles = currentCircles.filter(c => !c.isDestroyed);
      let targetRadiusOffset = ballRadius + circleGap;
      
      activeCircles.forEach(circle => {
        if (circle.radius > targetRadiusOffset) {
          circle.radius -= circleCollapseSpeed;
          if(circle.radius < targetRadiusOffset) circle.radius = targetRadiusOffset; // Prevent over-collapsing
        }
        targetRadiusOffset += circleGap;
      });
      
      // Check for game over (all circles destroyed)
      if (activeCircles.length === 0 && !isGameOver) {
        isGameOver = true;
        playGameOverSound();
        if (onGameEnd) onGameEnd();
      }

      // Draw circles (from largest to smallest for correct layering)
      [...currentCircles].sort((a,b) => b.radius - a.radius).forEach(circle => {
        if (!circle.isDestroyed) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, circle.radius, 0, Math.PI * 2);
          ctx.strokeStyle = circle.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      // Draw ball
      ctx.beginPath();
      ctx.arc(currentBall.position.x, currentBall.position.y, currentBall.radius, 0, Math.PI * 2);
      ctx.fillStyle = currentBall.color;
      ctx.fill();

      // Draw score
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${currentScore}`, 20, 30);
      ctx.textAlign = 'right';
      ctx.fillText(`Circles Left: ${activeCircles.length}`, canvas.width - 20, 30);

      setGameState(prev => ({
        ...prev,
        ball: currentBall,
        circles: currentCircles,
        score: currentScore,
        gameOver: isGameOver,
      }));

      if (!isGameOver) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
         // Display Game Over Message
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#ff7700';
        ctx.fillText('YOU WON!', canvas.width / 2, canvas.height / 2 - 30);
        ctx.font = '24px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText(`Final Score: ${currentScore}`, canvas.width / 2, canvas.height / 2 + 20);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, gameState.gameOver, gameState.ball, gameState.circles, onGameEnd, circleCollapseSpeed, ballRadius, circleGap]); // Added dependencies

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ backgroundColor: '#111' }}
    />
  );
};

export default CollapsingCircles; 
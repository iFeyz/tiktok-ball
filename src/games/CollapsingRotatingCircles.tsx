import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameProps, Ball, Vector2D } from '../types';
import { 
  getRandomPastelColor,
  generateId,
  distance,
  updatePosition,
  applyGravity,
  reflectVelocity,
  limitVelocity
} from '../utils/gameUtils';
import { 
  playBounceSound, 
  playGameOverSound, 
  playGameStartSound,
  playRandomSound
} from '../utils/sounds';

// Interface pour une particule d'effet visuel
interface Particle {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  radius: number;
  color: string;
  lifetime: number;  // Durée de vie restante en frames
  maxLifetime: number; // Durée de vie totale en frames
}

interface Circle {
  id: string;
  radius: number;
  targetRadius: number; // Rayon cible pour l'animation de rétrécissement
  color: string;
  rotation: number;
  rotationSpeed: number;
  isDestroyed: boolean;
  isFlashing: boolean; // Pour l'effet de flash lors du rétrécissement
}

interface CollapsingRotatingCirclesProps extends GameProps {
  gravity?: number;
  bounciness?: number;
  ballSpeed?: number;
  initialCircleCount?: number;
  circleGap?: number;
  exitSize?: number;
  rotationSpeed?: number;
  ballCount?: number;
  maxBallSpeed?: number;
  shrinkCirclesOnDestroy?: boolean;
  shrinkFactor?: number;
}

interface CollapsingRotatingCirclesState {
  balls: Ball[];
  circles: Circle[];
  particles: Particle[];
  score: number;
  gameOver: boolean;
  totalShrinkFactor: number; // Facteur cumulatif de rétrécissement
}

const CollapsingRotatingCircles: React.FC<CollapsingRotatingCirclesProps> = ({ 
  isPlaying, 
  onGameEnd,
  gravity = 0.2,
  bounciness = 0.9,
  ballSpeed = 5,
  initialCircleCount = 5,
  circleGap = 40,
  exitSize = 30, // Angle en degrés
  rotationSpeed = 0.01, // Vitesse de rotation en radians par frame
  ballCount = 1,
  maxBallSpeed = 8, // Vitesse maximale pour limiter les échappées
  shrinkCirclesOnDestroy = true,
  shrinkFactor = 0.8 // Réduire à 80% à chaque destruction
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const [gameState, setGameState] = useState<CollapsingRotatingCirclesState>({
    balls: [],
    circles: [],
    particles: [],
    score: 0,
    gameOver: false,
    totalShrinkFactor: 1.0 // Commence à 100% (pas de rétrécissement)
  });

  const ballRadius = 15;
  const exitSizeRad = (exitSize * Math.PI) / 180; // Conversion degrés -> radians
  
  // Fonction pour créer des particules lors de la destruction d'un cercle
  const createDestructionParticles = (centerX: number, centerY: number, circleRadius: number, circleColor: string) => {
    const particles: Particle[] = [];
    const particleCount = Math.min(50, Math.max(20, Math.floor(circleRadius / 2))); // Nombre de particules proportionnel au rayon
    
    for (let i = 0; i < particleCount; i++) {
      // Angle aléatoire pour diffuser les particules dans toutes les directions
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * circleRadius;
      
      // Position basée sur l'angle et la distance (dispersion autour du cercle)
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      // Vitesse basée sur l'angle (éjection vers l'extérieur)
      const speed = 1 + Math.random() * 3;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      // Taille et couleur aléatoires
      const size = 2 + Math.random() * 4;
      // Couleur légèrement variée basée sur la couleur du cercle
      const color = circleColor;
      
      particles.push({
        id: generateId(),
        position: { x, y },
        velocity: { x: vx, y: vy },
        radius: size,
        color,
        lifetime: 30 + Math.random() * 30, // Entre 30 et 60 frames (0.5-1s à 60fps)
        maxLifetime: 60
      });
    }
    
    return particles;
  };

  const initializeGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Créer les balles
    const newBalls: Ball[] = [];
    for (let i = 0; i < ballCount; i++) {
      newBalls.push({
        id: generateId(),
        position: { x: centerX, y: centerY },
        velocity: {
          x: (Math.random() - 0.5) * ballSpeed,
          y: 0 // La balle commence sans vitesse verticale
        },
        radius: ballRadius,
        color: getRandomPastelColor(),
      });
    }

    // Créer les cercles avec des rotations aléatoires et des vitesses légèrement différentes
    const newCircles: Circle[] = [];
    for (let i = 0; i < initialCircleCount; i++) {
      const radius = (i + 1) * circleGap + ballRadius;
      newCircles.push({
        id: generateId(),
        radius: radius,
        targetRadius: radius, // Initialement, le rayon cible est égal au rayon actuel
        color: getRandomPastelColor(),
        rotation: Math.random() * Math.PI * 2, // Rotation initiale aléatoire
        rotationSpeed: rotationSpeed * (1 + (Math.random() * 0.4 - 0.2)), // Variation de vitesse ±20%
        isDestroyed: false,
        isFlashing: false
      });
    }

    setGameState({
      balls: newBalls,
      circles: newCircles,
      particles: [],
      score: 0,
      gameOver: false,
      totalShrinkFactor: 1.0
    });
    playGameStartSound();
  }, [ballSpeed, initialCircleCount, circleGap, exitSize, rotationSpeed, ballCount, ballRadius]);

  useEffect(() => {
    if (isPlaying) {
      // Reset animation frame reference and initialize fresh game state
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
      initializeGame();
    } else {
      // Properly clean up the animation frame when stopping the game
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
    }
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
    };
  }, [isPlaying, initializeGame]);

  useEffect(() => {
    if (!isPlaying || gameState.gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const animate = () => {
      if (!canvas || !ctx) return;

      // Effacer le canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let currentBalls = [...gameState.balls];
      let currentCircles = [...gameState.circles];
      let currentParticles = [...gameState.particles];
      let currentScore = gameState.score;
      let isGameOver = gameState.gameOver;
      let totalShrinkFactor = gameState.totalShrinkFactor;
      let justDestroyedCircle = false;

      // Mettre à jour la rotation des cercles et animer le rétrécissement
      currentCircles = currentCircles.map(circle => {
        if (circle.isDestroyed) return circle;
        
        // Animer le rétrécissement avec une transition douce
        let newRadius = circle.radius;
        const targetRadius = circle.targetRadius;
        
        if (Math.abs(newRadius - targetRadius) > 0.1) {
          // Animation de rétrécissement fluide (5% de la différence par frame)
          newRadius += (targetRadius - newRadius) * 0.05;
        } else {
          newRadius = targetRadius; // Snap à la valeur exacte quand on est proche
        }
        
        return {
          ...circle,
          radius: newRadius,
          rotation: (circle.rotation + circle.rotationSpeed) % (Math.PI * 2),
          isFlashing: circle.isFlashing && Math.abs(newRadius - targetRadius) > 1 // Continuer le flash pendant la transition
        };
      });

      // Mettre à jour les particules
      currentParticles = currentParticles
        .map(particle => {
          // Réduire la durée de vie
          const newLifetime = particle.lifetime - 1;
          
          if (newLifetime <= 0) return null; // Supprimer les particules mortes
          
          // Calculer l'opacité basée sur la durée de vie restante
          const opacity = newLifetime / particle.maxLifetime;
          
          // Mettre à jour la position
          const newPosition = {
            x: particle.position.x + particle.velocity.x,
            y: particle.position.y + particle.velocity.y
          };
          
          // Ralentir les particules progressivement
          const friction = 0.98;
          const newVelocity = {
            x: particle.velocity.x * friction,
            y: particle.velocity.y * friction
          };
          
          return {
            ...particle,
            position: newPosition,
            velocity: newVelocity,
            lifetime: newLifetime,
            color: `rgba(${parseInt(particle.color.substr(1, 2), 16)}, 
                         ${parseInt(particle.color.substr(3, 2), 16)}, 
                         ${parseInt(particle.color.substr(5, 2), 16)}, 
                         ${opacity})`
          };
        })
        .filter(Boolean) as Particle[]; // Supprimer les particules nulles (mortes)

      // Mettre à jour les positions des balles et gérer les collisions
      currentBalls = currentBalls.map(ball => {
        // Appliquer la gravité
        let newVelocity = applyGravity(ball.velocity, gravity);
        
        // Limiter la vitesse maximale
        newVelocity = limitVelocity(newVelocity, maxBallSpeed);
        
        // Mettre à jour la position
        let newPosition = updatePosition(ball.position, newVelocity);

        // Vérifier les collisions avec les bords du canvas
        if (newPosition.x - ball.radius < 0 || newPosition.x + ball.radius > canvas.width) {
          newVelocity.x *= -bounciness;
          newPosition.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, newPosition.x));
          playBounceSound(0.3);
        }
        
        if (newPosition.y - ball.radius < 0 || newPosition.y + ball.radius > canvas.height) {
          newVelocity.y *= -bounciness;
          newPosition.y = Math.max(ball.radius, Math.min(canvas.height - ball.radius, newPosition.y));
          playBounceSound(0.3);
        }

        return {
          ...ball,
          position: newPosition,
          velocity: newVelocity
        };
      });

      // Détecter les balles qui s'échappent à travers les "portes de sortie"
      currentBalls.forEach(ball => {
        const ballDistFromCenter = distance(ball.position, { x: centerX, y: centerY });
        
        currentCircles.forEach(circle => {
          if (circle.isDestroyed) return;

          // Vérifier si la balle est près du cercle
          const distDiff = Math.abs(ballDistFromCenter - circle.radius);
          
          if (distDiff < ball.radius) {
            // Calculer l'angle de la balle par rapport au centre
            const ballAngle = Math.atan2(ball.position.y - centerY, ball.position.x - centerX);
            // Normaliser l'angle entre 0 et 2π
            const normalizedBallAngle = (ballAngle + Math.PI * 2) % (Math.PI * 2);
            
            // Calculer les limites de la "porte de sortie"
            const exitStart = circle.rotation;
            const exitEnd = (circle.rotation + exitSizeRad) % (Math.PI * 2);
            
            // Vérifier si la balle est dans la "porte de sortie"
            let isInExit = false;
            if (exitEnd > exitStart) {
              isInExit = normalizedBallAngle >= exitStart && normalizedBallAngle <= exitEnd;
            } else {
              // La porte de sortie chevauche 0/2π
              isInExit = normalizedBallAngle >= exitStart || normalizedBallAngle <= exitEnd;
            }
            
            if (isInExit) {
              // La balle s'échappe par la porte !
              if (ballDistFromCenter > circle.radius) {
                // Marquer le cercle comme détruit
                circle.isDestroyed = true;
                currentScore += 10;
                playRandomSound();
                justDestroyedCircle = true;
                
                // Créer des particules pour l'effet de destruction
                const newParticles = createDestructionParticles(
                  centerX, centerY, circle.radius, circle.color
                );
                currentParticles.push(...newParticles);
                
                // Si le rétrécissement est activé, calculer les nouveaux rayons cibles
                if (shrinkCirclesOnDestroy) {
                  // Réduire encore le facteur global de rétrécissement
                  totalShrinkFactor *= shrinkFactor;
                  
                  // Appliquer à tous les cercles non détruits
                  currentCircles.forEach(otherCircle => {
                    if (!otherCircle.isDestroyed) {
                      // Le rayon original est basé sur l'index du cercle (comme à l'initialisation)
                      const originalRadius = (currentCircles.indexOf(otherCircle) + 1) * circleGap + ballRadius;
                      
                      // Appliquer le facteur de rétrécissement global
                      const newTargetRadius = Math.max(
                        ballRadius * 2, // Minimum pour la jouabilité
                        originalRadius * totalShrinkFactor
                      );
                      
                      // Définir le nouveau rayon cible et activer le flash
                      otherCircle.targetRadius = newTargetRadius;
                      otherCircle.isFlashing = true;
                    }
                  });
                }
              }
            } else {
              // La balle frappe le cercle (pas la porte), elle rebondit
              const fromCenter = {
                x: ball.position.x - centerX,
                y: ball.position.y - centerY
              };
              const dist = Math.sqrt(fromCenter.x * fromCenter.x + fromCenter.y * fromCenter.y);
              
              // Normaliser le vecteur
              const normal = {
                x: fromCenter.x / dist,
                y: fromCenter.y / dist
              };
              
              // Calculer la réflexion
              const dotProduct = ball.velocity.x * normal.x + ball.velocity.y * normal.y;
              
              // Appliquer le rebond avec bounciness
              ball.velocity.x = (ball.velocity.x - 2 * dotProduct * normal.x) * bounciness;
              ball.velocity.y = (ball.velocity.y - 2 * dotProduct * normal.y) * bounciness;
              
              // Limiter la vitesse après le rebond
              ball.velocity = limitVelocity(ball.velocity, maxBallSpeed);
              
              // Repositionner la balle pour éviter qu'elle ne reste coincée
              const safetyMargin = 2;
              if (ballDistFromCenter < circle.radius) {
                // La balle est à l'intérieur, la pousser vers l'intérieur
                ball.position.x = centerX + normal.x * (circle.radius - ball.radius - safetyMargin);
                ball.position.y = centerY + normal.y * (circle.radius - ball.radius - safetyMargin);
              } else {
                // La balle est à l'extérieur, la pousser vers l'extérieur
                ball.position.x = centerX + normal.x * (circle.radius + ball.radius + safetyMargin);
                ball.position.y = centerY + normal.y * (circle.radius + ball.radius + safetyMargin);
              }
              
              playBounceSound(0.3);
            }
          }
        });
      });
      
      // Désactiver le flash après quelques frames
      if (!justDestroyedCircle) {
        currentCircles = currentCircles.map(circle => {
          if (circle.isFlashing) {
            return {
              ...circle,
              isFlashing: false
            };
          }
          return circle;
        });
      }

      // Vérifier si tous les cercles sont détruits
      const remainingCircles = currentCircles.filter(c => !c.isDestroyed);
      if (remainingCircles.length === 0 && !isGameOver) {
        isGameOver = true;
        playGameOverSound();
        if (onGameEnd) setTimeout(() => onGameEnd(), 2000);
      }

      // Dessiner les cercles
      currentCircles.forEach(circle => {
        if (circle.isDestroyed) return;
        
        // Couleur variable pour l'effet de flash
        const circleColor = circle.isFlashing ? 'rgba(255, 255, 255, 0.9)' : circle.color;
        
        // Dessiner l'arc principal (cercle moins la porte de sortie)
        ctx.beginPath();
        ctx.arc(
          centerX, 
          centerY, 
          circle.radius, 
          circle.rotation + exitSizeRad, // Début de l'arc après la porte
          circle.rotation + Math.PI * 2, // Tour complet
          false
        );
        ctx.strokeStyle = circleColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Marquer visuellement la porte de sortie
        ctx.beginPath();
        ctx.arc(
          centerX,
          centerY,
          circle.radius,
          circle.rotation, // Début de la porte
          circle.rotation + exitSizeRad, // Fin de la porte
          false
        );
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // Porte plus claire
        ctx.lineWidth = 5;
        ctx.stroke();
      });
      
      // Dessiner les particules
      currentParticles.forEach(particle => {
        ctx.beginPath();
        ctx.arc(
          particle.position.x,
          particle.position.y,
          particle.radius,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = particle.color;
        ctx.fill();
      });

      // Dessiner les balles
      currentBalls.forEach(ball => {
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

      // Afficher le score et le nombre de cercles restants
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${currentScore}`, 20, 30);
      ctx.textAlign = 'right';
      ctx.fillText(`Cercles restants: ${remainingCircles.length}`, canvas.width - 20, 30);

      // Afficher un message si le jeu est terminé
      if (isGameOver) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#ff7700';
        ctx.fillText('VICTOIRE !', canvas.width / 2, canvas.height / 2 - 30);
        ctx.font = '24px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText(`Score final: ${currentScore}`, canvas.width / 2, canvas.height / 2 + 20);
      }

      // Mettre à jour l'état du jeu
      setGameState({
        balls: currentBalls,
        circles: currentCircles,
        particles: currentParticles,
        score: currentScore,
        gameOver: isGameOver,
        totalShrinkFactor: totalShrinkFactor
      });

      // Continuer l'animation si le jeu n'est pas terminé
      if (!isGameOver) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
    };
  }, [isPlaying, gameState, gravity, bounciness, exitSizeRad, onGameEnd, maxBallSpeed, shrinkCirclesOnDestroy, shrinkFactor, ballRadius, circleGap]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ backgroundColor: '#111' }}
    />
  );
};

export default CollapsingRotatingCircles; 
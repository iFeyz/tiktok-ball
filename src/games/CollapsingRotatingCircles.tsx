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

// Définir et exporter les styles de porte disponibles
export enum ExitStyle {
  STANDARD = "standard",     // Style standard avec contour visible
  INVERTED = "inverted",     // Couleurs inversées
  GLOWING = "glowing",       // Effet brillant
  TRANSPARENT = "transparent", // Complètement transparent (cercle ouvert)
  COLORFUL = "colorful",     // Multicolore
}

// Définir et exporter les styles de particules disponibles
export enum ParticleStyle {
  STANDARD = "standard",     // Particules standard
  SPARKLE = "sparkle",       // Effet d'étincelles
  EXPLOSION = "explosion",   // Explosion plus énergétique
  MINIMAL = "minimal",       // Effet minimal
  CONFETTI = "confetti",     // Style confetti multicolore
}

// Interface pour une particule d'effet visuel
interface Particle {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  radius: number;
  color: string;
  lifetime: number;  // Durée de vie restante en frames
  maxLifetime: number; // Durée de vie totale en frames
  initialRadius: number; // Rayon initial pour l'animation de taille
}

interface Circle {
  id: string;
  radius: number;
  targetRadius: number; // Rayon cible pour l'animation de rétrécissement
  originalRadius: number; // Rayon original pour calculer l'espacement
  circleIndex: number; // Index du cercle dans la séquence
  color: string;
  rotation: number;
  rotationSpeed: number;
  originalRotationSpeed: number; // Vitesse de rotation originale pour l'ajustement proportionnel
  isDestroyed: boolean;
  isFlashing: boolean; // Pour l'effet de flash lors du rétrécissement
}

interface CollapsingRotatingCirclesProps extends GameProps {
  gravity?: number;
  bounciness?: number;
  ballSpeed?: number;
  initialCircleCount?: number;
  circleGap?: number;
  minCircleGap?: number; // Nouvel espace minimum entre les cercles
  exitSize?: number;
  rotationSpeed?: number;
  ballCount?: number;
  maxBallSpeed?: number;
  shrinkCirclesOnDestroy?: boolean;
  shrinkFactor?: number;
  effectsEnabled?: boolean;
  progressiveRotationOffset?: number; // Ajouter ce paramètre pour le décalage progressif
  ballsOnDestroy?: number; // Nombre de balles à créer quand un cercle est détruit
  baseBallRadius?: number; // Taille du cercle de base
  exitStyle?: ExitStyle;   // Style des portes de sortie
  particleStyle?: ParticleStyle; // Style des particules lors de la destruction
  minCircleRadius?: number; // Nouveau paramètre pour la taille minimale d'un cercle
  customEndMessage?: string; // Nouveau paramètre pour le message de fin personnalisé
  showFinalScore?: boolean; // Option pour afficher ou masquer le score final
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
  minCircleGap = 15, // Valeur par défaut pour l'espace minimum
  exitSize = 30, // Angle en degrés
  rotationSpeed = 0.01, // Vitesse de rotation en radians par frame
  ballCount = 1,
  maxBallSpeed = 8, // Vitesse maximale pour limiter les échappées
  shrinkCirclesOnDestroy = true,
  shrinkFactor = 0.8, // Réduire à 80% à chaque destruction
  effectsEnabled = true, // Activer par défaut
  progressiveRotationOffset = 0, // 0% par défaut (pas de décalage)
  ballsOnDestroy = 0, // Par défaut, pas de balles supplémentaires
  baseBallRadius = 15, // Taille par défaut du cercle de base
  exitStyle = ExitStyle.STANDARD, // Style de porte par défaut
  particleStyle = ParticleStyle.STANDARD, // Style de particules par défaut
  minCircleRadius = 20, // Taille minimale par défaut d'un cercle
  customEndMessage = "VICTOIRE !", // Valeur par défaut du message de fin
  showFinalScore = true // Afficher le score final par défaut
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

  const exitSizeRad = (exitSize * Math.PI) / 180; // Conversion degrés -> radians
  
  // Fonction pour créer des particules lors de la destruction d'un cercle
  const createDestructionParticles = (centerX: number, centerY: number, circleRadius: number, circleColor: string) => {
    if (!effectsEnabled) return [];
    
    const particles: Particle[] = [];
    
    // Calculer le nombre de particules en fonction du style
    let particleCount = Math.min(150, Math.max(50, Math.floor(circleRadius)));
    
    // Appliquer des modifications en fonction du style choisi
    switch(particleStyle) {
      case ParticleStyle.MINIMAL:
        particleCount = Math.floor(particleCount * 0.3); // Beaucoup moins de particules
        break;
      case ParticleStyle.EXPLOSION:
        particleCount = Math.min(200, Math.floor(particleCount * 1.5)); // Plus de particules
        break;
      case ParticleStyle.CONFETTI:
        particleCount = Math.min(300, Math.floor(particleCount * 1.8)); // Encore plus de particules pour l'effet confetti
        break;
      case ParticleStyle.SPARKLE:
        particleCount = Math.min(180, Math.floor(particleCount * 1.2)); // Légèrement plus de particules
        break;
    }
    
    for (let i = 0; i < particleCount; i++) {
      // Angle aléatoire pour diffuser les particules dans toutes les directions
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * circleRadius;
      
      // Position basée sur l'angle et la distance du centre du cercle
      const x = centerX + Math.cos(angle) * circleRadius;
      const y = centerY + Math.sin(angle) * circleRadius;
      
      // Vitesse basée sur l'angle avec composante aléatoire
      let speedMultiplier = 0.5 + Math.random() * 2;
      let vx = Math.cos(angle) * speedMultiplier;
      let vy = Math.sin(angle) * speedMultiplier;
      
      // Taille variée pour les particules
      let size = 1 + Math.random() * 6;
      
      // Variables pour différents styles de particules
      let particleColor = '';
      let lifetime = 60 + Math.random() * 120;
      
      // Appliquer des modifications en fonction du style choisi
      switch(particleStyle) {
        case ParticleStyle.STANDARD:
          // Modifier légèrement la couleur du cercle pour chaque particule
          const r = parseInt(circleColor.substr(1, 2), 16);
          const g = parseInt(circleColor.substr(3, 2), 16);
          const b = parseInt(circleColor.substr(5, 2), 16);
          
          // Ajuster légèrement les couleurs
          const brightness = 0.8 + Math.random() * 0.4;
          const newR = Math.min(255, Math.max(0, Math.floor(r * brightness)));
          const newG = Math.min(255, Math.max(0, Math.floor(g * brightness)));
          const newB = Math.min(255, Math.max(0, Math.floor(b * brightness)));
          
          // Convertir en couleur hexadécimale
          particleColor = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
          break;
          
        case ParticleStyle.SPARKLE:
          // Couleurs brillantes pour les étincelles
          const hue = Math.random() * 60 + 30; // Tons jaune-orange pour l'effet d'étincelle
          const sat = 80 + Math.random() * 20; // Haute saturation
          const light = 60 + Math.random() * 30; // Haute luminosité
          particleColor = `hsl(${hue}, ${sat}%, ${light}%)`;
          
          // Particules plus petites et plus rapides
          size = 0.5 + Math.random() * 3;
          speedMultiplier = 1 + Math.random() * 3;
          vx = Math.cos(angle) * speedMultiplier;
          vy = Math.sin(angle) * speedMultiplier;
          
          // Durée de vie plus courte
          lifetime = 30 + Math.random() * 70;
          break;
          
        case ParticleStyle.EXPLOSION:
          // Couleurs chaudes pour l'explosion
          const explosionHue = Math.random() * 30; // Rouge à orange
          particleColor = `hsl(${explosionHue}, 100%, ${50 + Math.random() * 30}%)`;
          
          // Particules plus rapides
          speedMultiplier = 2 + Math.random() * 4;
          vx = Math.cos(angle) * speedMultiplier;
          vy = Math.sin(angle) * speedMultiplier;
          
          // Certaines particules plus grosses
          size = Math.random() < 0.3 ? 3 + Math.random() * 7 : 1 + Math.random() * 4;
          
          // Durée de vie variable
          lifetime = 40 + Math.random() * 100;
          break;
          
        case ParticleStyle.MINIMAL:
          // Couleur plus simple, basée sur celle du cercle mais plus uniforme
          particleColor = circleColor;
          
          // Particules plus petites
          size = 0.5 + Math.random() * 2;
          
          // Durée de vie plus courte
          lifetime = 30 + Math.random() * 50;
          break;
          
        case ParticleStyle.CONFETTI:
          // Couleurs aléatoires vives pour les confettis
          const confettiHue = Math.random() * 360; // Toutes les couleurs
          particleColor = `hsl(${confettiHue}, 100%, 70%)`;
          
          // Forme plus rectangulaire (simulée avec des particules)
          size = 2 + Math.random() * 4;
          
          // Mouvement plus flottant
          speedMultiplier = 0.3 + Math.random() * 1.5;
          vx = Math.cos(angle) * speedMultiplier;
          vy = Math.sin(angle) * speedMultiplier - 0.5; // Flottement vers le haut
          
          // Durée de vie plus longue
          lifetime = 80 + Math.random() * 160;
          break;
      }
      
      particles.push({
        id: generateId(),
        position: { x, y },
        velocity: { x: vx, y: vy },
        radius: size,
        initialRadius: size,
        color: particleColor,
        lifetime: lifetime,
        maxLifetime: lifetime
      });
    }
    
    return particles;
  };

  const initializeGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Créer les balles avec le nouveau baseBallRadius
    const newBalls: Ball[] = [];
    for (let i = 0; i < ballCount; i++) {
      newBalls.push({
        id: generateId(),
        position: { x: centerX, y: centerY },
        velocity: {
          x: (Math.random() - 0.5) * ballSpeed,
          y: 0 // La balle commence sans vitesse verticale
        },
        radius: baseBallRadius,
        color: getRandomPastelColor(),
      });
    }

    // Créer les cercles avec des rotations progressivement décalées
    const newCircles: Circle[] = [];
    const baseRotationSpeed = rotationSpeed;
    
    for (let i = 0; i < initialCircleCount; i++) {
      const radius = (i + 1) * circleGap + baseBallRadius;
      
      // Calcul du décalage progressif de rotation basé sur l'index du cercle
      // Convertir le pourcentage en radians (un tour complet = 2*PI radians)
      const progressiveOffset = (progressiveRotationOffset / 100) * (Math.PI * 2) * i;
      
      // Calcul de la vitesse de rotation avec un incrément progressif
      // Chaque cercle tourne légèrement plus vite que le précédent
      const speedIncrement = 1 + ((progressiveRotationOffset / 100) * i);
      const adjustedRotationSpeed = baseRotationSpeed * speedIncrement;
      
      newCircles.push({
        id: generateId(),
        radius: radius,
        targetRadius: radius, // Initialement, le rayon cible est égal au rayon actuel
        originalRadius: radius, // Stocker le rayon original pour les calculs d'espacement
        color: getRandomPastelColor(),
        rotation: progressiveOffset, // Décalage initial basé sur l'index
        rotationSpeed: adjustedRotationSpeed, // Vitesse de rotation ajustée
        originalRotationSpeed: adjustedRotationSpeed, // Sauvegarder la vitesse de rotation originale
        circleIndex: i, // Stocker l'index du cercle
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
  }, [ballSpeed, initialCircleCount, circleGap, exitSize, rotationSpeed, ballCount, baseBallRadius, progressiveRotationOffset]);

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
          
          // Ajuster la vitesse de rotation proportionnellement au changement de rayon
          // Plus le cercle est petit, plus il devrait tourner lentement (pour maintenir une vitesse angulaire perçue constante)
          // Utiliser un facteur d'échelle pour contrôler cette adaptation
          // La formule newRotationSpeed = originalRotationSpeed * (newRadius / originalRadius) maintiendrait une vitesse linéaire constante
          // Nous utilisons un exposant (0.5) pour que l'effet soit moins prononcé (compromis jouabilité)
          const speedAdjustmentFactor = Math.pow(newRadius / circle.originalRadius, 0.5);
          const newRotationSpeed = circle.originalRotationSpeed * speedAdjustmentFactor;
          
          return {
            ...circle,
            radius: newRadius,
            rotationSpeed: newRotationSpeed,
            rotation: (circle.rotation + newRotationSpeed) % (Math.PI * 2),
            isFlashing: circle.isFlashing && Math.abs(newRadius - targetRadius) > 1 // Continuer le flash pendant la transition
          };
        } else {
          return {
            ...circle,
            radius: targetRadius, // Snap à la valeur exacte quand on est proche
            rotation: (circle.rotation + circle.rotationSpeed) % (Math.PI * 2),
            isFlashing: circle.isFlashing && Math.abs(newRadius - targetRadius) > 1 // Continuer le flash pendant la transition
          };
        }
      });

      // Mettre à jour les particules
      currentParticles = currentParticles
        .map(particle => {
          // Réduire la durée de vie
          const newLifetime = particle.lifetime - 0.8; // Diminution plus lente
          
          if (newLifetime <= 0) return null; // Supprimer les particules mortes
          
          // Calculer l'opacité basée sur la durée de vie restante, avec une courbe plus douce
          const lifetimeRatio = newLifetime / particle.maxLifetime;
          // Utiliser une fonction de courbe pour une disparition plus progressive
          const opacity = Math.pow(lifetimeRatio, 1.5);
          
          // Extraire les composantes RGB de la couleur (s'assurer que c'est un format hex)
          let r, g, b;
          if (particle.color.startsWith('#')) {
            r = parseInt(particle.color.substr(1, 2), 16);
            g = parseInt(particle.color.substr(3, 2), 16);
            b = parseInt(particle.color.substr(5, 2), 16);
          } else if (particle.color.startsWith('rgba')) {
            // Déjà au format rgba, extraire les composantes
            const rgbaMatch = particle.color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),/);
            if (rgbaMatch) {
              r = parseInt(rgbaMatch[1]);
              g = parseInt(rgbaMatch[2]);
              b = parseInt(rgbaMatch[3]);
            } else {
              // Fallback sur des valeurs par défaut si le format n'est pas reconnu
              r = 255;
              g = 255;
              b = 255;
            }
          } else {
            // Fallback sur des valeurs par défaut
            r = 255;
            g = 255;
            b = 255;
          }
          
          // Mettre à jour la position avec la physique
          const newPosition = {
            x: particle.position.x + particle.velocity.x,
            y: particle.position.y + particle.velocity.y
          };
          
          // Physique plus réaliste avec gravité et inertie
          const friction = 0.98; // Résistance de l'air légère
          const gravity = 0.1; // Force de gravité plus prononcée
          
          // Ajouter un mouvement aléatoire pour plus de naturel
          const randomX = (Math.random() - 0.5) * 0.2;
          const randomY = (Math.random() - 0.5) * 0.2;
          
          const newVelocity = {
            x: (particle.velocity.x * friction) + randomX,
            y: (particle.velocity.y * friction) + gravity + randomY
          };
          
          // Réduire progressivement la taille de la particule
          const sizeRatio = 0.5 + lifetimeRatio * 0.5; // Réduire jusqu'à 50% de la taille d'origine
          const newRadius = particle.initialRadius * sizeRatio;
          
          return {
            ...particle,
            position: newPosition,
            velocity: newVelocity,
            lifetime: newLifetime,
            radius: newRadius,
            color: `rgba(${r}, ${g}, ${b}, ${opacity})`
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
                
                // Créer de nouvelles balles si l'option est activée
                if (ballsOnDestroy > 0) {
                  const newBalls = createBallsOnDestroy(centerX, centerY, circle.radius);
                  currentBalls.push(...newBalls);
                }
                
                // Si le rétrécissement est activé, calculer les nouveaux rayons cibles
                if (shrinkCirclesOnDestroy) {
                  // Réduire encore le facteur global de rétrécissement
                  totalShrinkFactor *= shrinkFactor;
                  
                  // Trier les cercles non détruits par ordre croissant d'index
                  const activeCirlces = currentCircles
                    .filter(c => !c.isDestroyed)
                    .sort((a, b) => a.circleIndex - b.circleIndex);
                  
                  // Calculer les nouveaux rayons en maintenant un espacement minimum
                  let previousRadius = 0; // Point de départ (centre)
                  
                  activeCirlces.forEach((circle, idx) => {
                    // Calculer le rayon idéal basé sur le rétrécissement global
                    const idealRadius = circle.originalRadius * totalShrinkFactor;
                    
                    // Calculer le rayon minimum basé sur le rayon précédent et l'espacement minimum
                    const minRadiusFromGap = previousRadius + minCircleGap + baseBallRadius;
                    
                    // Prendre le maximum entre le rayon idéal, le rayon minimum requis, et la taille minimale configurée
                    const newTargetRadius = Math.max(
                      idealRadius, 
                      minRadiusFromGap,
                      minCircleRadius // Utiliser la taille minimale configurée
                    );
                    
                    // Définir le nouveau rayon cible et activer le flash
                    circle.targetRadius = newTargetRadius;
                    circle.isFlashing = true;
                    
                    // Mettre à jour le rayon précédent pour le prochain cercle
                    previousRadius = newTargetRadius;
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
        // Assurer que les deux arcs s'alignent correctement
        const fullCircle = Math.PI * 2;
        ctx.arc(
          centerX, 
          centerY, 
          circle.radius, 
          circle.rotation + exitSizeRad, // Début de l'arc après la porte
          circle.rotation + fullCircle, // Tour complet
          false
        );
        ctx.strokeStyle = circleColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Marquer visuellement la porte de sortie selon le style choisi
        if (exitStyle !== ExitStyle.TRANSPARENT) {
          ctx.beginPath();
          ctx.arc(
            centerX,
            centerY,
            circle.radius,
            circle.rotation, // Début de la porte
            circle.rotation + exitSizeRad, // Fin de la porte
            false
          );
          
          // Appliquer un style différent selon l'option choisie
          switch(exitStyle) {
            case ExitStyle.STANDARD:
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // Style standard
              ctx.lineWidth = 5;
              break;
              
            case ExitStyle.INVERTED:
              // Inverser la couleur du cercle
              if (circle.color.startsWith('#')) {
                const r = parseInt(circle.color.substr(1, 2), 16);
                const g = parseInt(circle.color.substr(3, 2), 16);
                const b = parseInt(circle.color.substr(5, 2), 16);
                const invR = 255 - r;
                const invG = 255 - g;
                const invB = 255 - b;
                ctx.strokeStyle = `rgb(${invR}, ${invG}, ${invB})`;
              } else {
                ctx.strokeStyle = '#ffffff'; // Fallback
              }
              ctx.lineWidth = 5;
              break;
              
            case ExitStyle.GLOWING:
              // Effet brillant avec gradient et largeur variable
              const gradient = ctx.createLinearGradient(
                centerX, 
                centerY, 
                centerX + Math.cos(circle.rotation + exitSizeRad/2) * circle.radius,
                centerY + Math.sin(circle.rotation + exitSizeRad/2) * circle.radius
              );
              gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
              gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
              gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
              
              ctx.strokeStyle = gradient;
              ctx.lineWidth = 8; // Plus large pour l'effet brillant
              
              // Ajouter un halo autour de la porte
              ctx.shadowColor = 'white';
              ctx.shadowBlur = 15;
              break;
              
            case ExitStyle.COLORFUL:
              // Effet multicolore avec dégradé arc-en-ciel
              const rainbow = ctx.createLinearGradient(
                centerX - circle.radius, 
                centerY, 
                centerX + circle.radius, 
                centerY
              );
              rainbow.addColorStop(0, 'red');
              rainbow.addColorStop(0.2, 'yellow');
              rainbow.addColorStop(0.4, 'green');
              rainbow.addColorStop(0.6, 'cyan');
              rainbow.addColorStop(0.8, 'blue');
              rainbow.addColorStop(1, 'magenta');
              
              ctx.strokeStyle = rainbow;
              ctx.lineWidth = 5;
              break;
          }
          
          // Si style brillant, dessiner la porte puis réinitialiser l'ombre
          if (exitStyle === ExitStyle.GLOWING) {
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          } else {
            ctx.stroke();
          }
        }
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
        
        // Ajouter un léger contour pour plus de définition
        ctx.strokeStyle = `rgba(255, 255, 255, ${particle.lifetime / particle.maxLifetime * 0.3})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
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
        ctx.fillText(customEndMessage, canvas.width / 2, canvas.height / 2 - 30);
        
        // Afficher le score final si l'option est activée
        if (showFinalScore) {
          ctx.font = '24px Arial';
          ctx.fillStyle = 'white';
          ctx.fillText(`Score final: ${currentScore}`, canvas.width / 2, canvas.height / 2 + 20);
        }
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
  }, [isPlaying, gameState, gravity, bounciness, exitSizeRad, onGameEnd, maxBallSpeed, shrinkCirclesOnDestroy, shrinkFactor, baseBallRadius, circleGap, minCircleGap, minCircleRadius, ballsOnDestroy, exitStyle, particleStyle, customEndMessage, showFinalScore]);

  // Fonction pour créer de nouvelles balles à l'emplacement d'un cercle détruit
  const createBallsOnDestroy = (centerX: number, centerY: number, circleRadius: number): Ball[] => {
    if (ballsOnDestroy <= 0) return [];
    
    const newBalls: Ball[] = [];
    
    for (let i = 0; i < ballsOnDestroy; i++) {
      // Angle aléatoire pour la direction de la balle
      const angle = Math.random() * Math.PI * 2;
      
      // Position sur le cercle détruit
      const posX = centerX + Math.cos(angle) * circleRadius * 0.8;
      const posY = centerY + Math.sin(angle) * circleRadius * 0.8;
      
      // Vitesse initiale légèrement orientée vers l'extérieur
      const speed = 1 + Math.random() * 3; // Vitesse modérée pour ne pas sortir trop vite
      const velX = Math.cos(angle) * speed;
      const velY = Math.sin(angle) * speed;
      
      newBalls.push({
        id: generateId(),
        position: { x: posX, y: posY },
        velocity: { x: velX, y: velY },
        radius: baseBallRadius,
        color: getRandomPastelColor()
      });
    }
    
    return newBalls;
  };

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
import { 
    useCallback, 
    useEffect, 
    useRef, 
    useState 
  } from 'react';
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
  playRandomSound,
  getAudioContext as getSoundAudioContext,
  initSound,
  connectToRecorder,
  playWallSound,
  hasCustomSound,
  loadCustomSound,
  playMIDINote as playMidiNote
} from '../utils/sounds';
import { useGameRecorder, downloadVideo } from '../utils/recorder';

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

// Define and export circle themes
export enum CircleTheme {
  DEFAULT = 'default',
  RAINBOW = 'rainbow',
  NEON = 'neon',
  LAVA = 'lava',
  WATER = 'water',
  CUSTOM = 'custom',
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

// D'abord, étendre l'interface Ball pour inclure les propriétés d'image
interface EnhancedBall extends Ball {
  image?: HTMLImageElement | null;
  imageIndex?: number;
  growing?: boolean;
  growthRate?: number;
  // New ball customization properties
  customColor?: string;
  hasTrail?: boolean;
  trailColor?: string;
  trailLength?: number;
  strokeWidth?: number;
  strokeColor?: string;
  hasGlow?: boolean;
  glowColor?: string;
  glowSize?: number;
  theme?: 'default' | 'rainbow' | 'fire' | 'ice' | 'neon';
}

interface CollapsingRotatingCirclesProps extends GameProps {
  gravity?: number;
  bounciness?: number;
  ballSpeed?: number;
  initialCircleCount?: number;
  circleGap?: number;
  minCircleGap?: number;
  exitSize?: number;
  rotationSpeed?: number;
  ballCount?: number;
  maxBallSpeed?: number;
  shrinkCirclesOnDestroy?: boolean;
  shrinkFactor?: number;
  effectsEnabled?: boolean;
  progressiveRotationOffset?: number;
  ballsOnDestroy?: number;
  baseBallRadius?: number;
  exitStyle?: ExitStyle;
  particleStyle?: ParticleStyle;
  minCircleRadius?: number;
  customEndMessage?: string;
  showFinalScore?: boolean;
  useCustomSounds?: boolean;
  customExitSound?: File;
  customExitSoundVolume?: number;
  customWallSound?: File;
  enableWallSound?: boolean;
  maxBallCount?: number;
  // Nouvelles propriétés pour les images personnalisées
  useCustomImages?: boolean;
  customImages?: string[];
  ballImageAssignments?: number[];
  inheritBallImage?: boolean;  // Option pour hériter de l'image de la balle qui touche la porte
  growing?: boolean;  // Option pour activer la croissance des balles comme dans GrowingBall
  growthRate?: number;  // Taux de croissance des balles
  // Nouvelles propriétés pour personnaliser le texte des cercles restants
  remainingCirclesPrefix?: string; // Texte personnalisé avant le nombre de cercles restants
  remainingCirclesBgColor?: string; // Couleur de fond du texte des cercles restants
  remainingCirclesTextColor?: string; // Couleur du texte des cercles restants
  // Propriété pour l'enregistrement
  isRecording?: boolean;
  // Add new props for door destruction sounds
  playMidiOnDoorDestroy?: boolean; // Whether to play MIDI notes when door is destroyed
  midiVolume?: number; // Volume for MIDI notes (0-1)
  playMusicOnDoorDestroy?: boolean; // Whether to play music/sound when door is destroyed
  doorDestroyMusicVolume?: number; // Volume for door destroy music/sound (0-1)
  // New properties for rainbow circles and custom stroke
  useRainbowCircles?: boolean; // Enable rainbow colors for circles
  circleStrokeWidth?: number; // Custom stroke width for circles
  animateRainbow?: boolean; // Whether to animate the rainbow effect over time
  // New theme properties
  circleTheme?: CircleTheme; // Theme for circles (rainbow, neon, lava, water, etc.)
  customCircleColor?: string; // Custom color for circles when using CUSTOM theme
  glowIntensity?: number; // Glow intensity for themes that support it (0-1)
  gradientSpeed?: number; // Speed of gradient animations
  // New ball customization properties
  customBallColor?: string; // Custom color for all balls
  ballHasTrail?: boolean; // Whether balls have a trailing effect
  ballTrailColor?: string; // Color for the ball trail
  ballTrailLength?: number; // Length of the ball trail (1-20)
  ballStrokeWidth?: number; // Width of ball outline
  ballStrokeColor?: string; // Color of ball outline
  ballHasGlow?: boolean; // Whether balls have a glow effect
  ballGlowColor?: string; // Color of the ball glow
  ballGlowSize?: number; // Size of the ball glow (1-10)
  ballTheme?: 'default' | 'rainbow' | 'fire' | 'ice' | 'neon'; // Visual theme for balls
}

interface CollapsingRotatingCirclesState {
  balls: EnhancedBall[];  // Changé de Ball[] à EnhancedBall[]
  circles: Circle[];
  particles: Particle[];
  score: number;
  gameOver: boolean;
  totalShrinkFactor: number;
  // Propriété pour suivre quelle balle a touché quelle porte
  lastBallToTouchCircle?: EnhancedBall | null;
}

// Ajouter les styles pour les contrôles d'enregistrement
const recordingStyles = {
  container: {
    position: 'absolute' as const,
    top: '10px',
    right: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '8px 12px',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'white',
    zIndex: 1000,
  },
  recordIcon: {
    width: '12px',
    height: '12px',
    backgroundColor: '#ff4b4b',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite',
  },
  time: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
};

const recordingControlsStyles = {
  container: {
    position: 'absolute' as const,
    bottom: '20px',
    right: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    zIndex: 1000,
  },
  button: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
  },
  recordButton: {
    backgroundColor: '#f44336',
    color: 'white',
  },
  downloadButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
  },
};

// Format recording time from milliseconds to MM:SS format
const formatRecordingTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const CollapsingRotatingCircles: React.FC<CollapsingRotatingCirclesProps> = ({ 
  isPlaying, 
  onGameEnd,
  gravity = 0.2,
  bounciness = 0.9,
  ballSpeed = 5,
  initialCircleCount = 5,
  circleGap = 40,
  minCircleGap = 15,
  exitSize = 30,
  rotationSpeed = 0.01,
  ballCount = 1,
  maxBallSpeed = 8,
  shrinkCirclesOnDestroy = true,
  shrinkFactor = 0.8,
  effectsEnabled = true,
  progressiveRotationOffset = 0,
  ballsOnDestroy = 0,
  baseBallRadius = 15,
  exitStyle = ExitStyle.STANDARD,
  particleStyle = ParticleStyle.STANDARD,
  minCircleRadius = 40,
  customEndMessage = "VICTOIRE !",
  showFinalScore = true,
  useCustomSounds = false,
  customExitSound,
  customExitSoundVolume = 0.5,
  customWallSound,
  enableWallSound = true,
  maxBallCount = 20,
  // Ajouter les nouvelles propriétés avec des valeurs par défaut
  useCustomImages = false,
  customImages = [],
  ballImageAssignments = [],
  inheritBallImage = false,
  growing = false,
  growthRate = 0.01,
  // Valeurs par défaut pour les nouvelles propriétés de texte
  remainingCirclesPrefix = "Cercles restants",
  remainingCirclesBgColor = "#ffffff",
  remainingCirclesTextColor = "#000000",
  // Propriété pour l'enregistrement
  isRecording,
  // Add new props with defaults
  playMidiOnDoorDestroy = false,
  midiVolume = 0.7,
  playMusicOnDoorDestroy = true,
  doorDestroyMusicVolume = 0.5,
  // New properties for rainbow circles and custom stroke
  useRainbowCircles = false,
  circleStrokeWidth = 3,
  animateRainbow = true,
  // New theme properties
  circleTheme = CircleTheme.DEFAULT,
  customCircleColor,
  glowIntensity = 0.5,
  gradientSpeed = 0.01,
  // New ball customization properties
  customBallColor,
  ballHasTrail = false,
  ballTrailColor = '#ffffff',
  ballTrailLength = 10,
  ballStrokeWidth = 2,
  ballStrokeColor = '#000000',
  ballHasGlow = false,
  ballGlowColor = '#ff0000',
  ballGlowSize = 5,
  ballTheme = 'default',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const [gameState, setGameState] = useState<CollapsingRotatingCirclesState>({
    balls: [],
    circles: [],
    particles: [],
    score: 0,
    gameOver: false,
    totalShrinkFactor: 1.0,
    lastBallToTouchCircle: null
  });
  
  // Référence pour les images chargées
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([]);

  const exitSizeRad = (exitSize * Math.PI) / 180; // Conversion degrés -> radians
  
  // Précharger les images si nécessaire
  useEffect(() => {
    if (useCustomImages && customImages.length > 0) {
      const images: HTMLImageElement[] = [];
      let loadedCount = 0;
      
      customImages.forEach((src, index) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          loadedCount++;
          if (loadedCount === customImages.length) {
            setLoadedImages(images);
          }
        };
        img.onerror = () => {
          // En cas d'erreur, augmenter quand même le compteur pour éviter les blocages
          loadedCount++;
          if (loadedCount === customImages.length) {
            setLoadedImages(images.filter(img => img.complete));
          }
        };
        images.push(img);
      });
    }
  }, [useCustomImages, customImages]);

  // Load custom sounds
  useEffect(() => {
    if (useCustomSounds) {
      if (customWallSound) {
        loadCustomSound(customWallSound, 'wall').catch(err => {
          console.error("Error loading custom wall sound:", err);
        });
      }
      // ... potentially load other custom sounds if needed ...
    }
  }, [useCustomSounds, customWallSound]);

  // Fonction pour créer des particules lors de la destruction d'un cercle
  const createDestructionParticles = (centerX: number, centerY: number, circleRadius: number, circleColor: string) => {
    if (!effectsEnabled) return [];
    
    let particleCount = 0;
    let particleColors: string[] = [];
    
    // Déterminer le style des particules
    switch (particleStyle) {
      case ParticleStyle.SPARKLE:
        particleCount = 25; // Plus de particules pour l'effet d'étincelles
        // Couleurs vives pour les étincelles
        particleColors = ['#ffff00', '#ffffff', '#ffcc00', '#ffffaa'];
        break;
        
      case ParticleStyle.EXPLOSION:
        particleCount = 35; // Beaucoup de particules pour une explosion
        // Couleurs rouge/orange pour l'explosion
        particleColors = ['#ff4400', '#ff8800', '#ffbb00', '#ffff00', '#ffffff'];
        break;
        
      case ParticleStyle.MINIMAL:
        particleCount = 10; // Très peu de particules pour un effet minimal
        // Utiliser des couleurs monochromes
        particleColors = ['#ffffff', '#eeeeee', '#dddddd'];
        break;
        
      case ParticleStyle.CONFETTI:
        particleCount = 30; // Nombreuses particules pour l'effet confetti
        // Couleurs vives et variées comme des confettis
        particleColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'];
        break;
        
      case ParticleStyle.STANDARD:
      default:
        particleCount = 20; // Nombre standard de particules
        // Use colors based on the circle theme if appropriate
        if (effectiveCircleTheme === CircleTheme.RAINBOW) {
          // Rainbow colors for particles
          particleColors = Array.from({ length: 6 }, (_, i) => {
            const hue = (i * 60) % 360;
            return `hsl(${hue}, 100%, 50%)`;
          });
        } else if (effectiveCircleTheme === CircleTheme.NEON) {
          // Neon colors with high lightness
          particleColors = Array.from({ length: 6 }, (_, i) => {
            const hue = (i * 60) % 360;
            const lightness = 60 + (glowIntensity * 20);
            return `hsl(${hue}, 100%, ${lightness}%)`;
          });
        } else if (effectiveCircleTheme === CircleTheme.LAVA) {
          // Lava theme colors (red to yellow)
          particleColors = Array.from({ length: 6 }, (_, i) => {
            const hue = 10 + (i * 10); // Range from 10 (red) to 60 (yellow)
            return `hsl(${hue}, 100%, 50%)`;
          });
        } else if (effectiveCircleTheme === CircleTheme.WATER) {
          // Water theme colors (blues and cyans)
          particleColors = Array.from({ length: 6 }, (_, i) => {
            const hue = 180 + (i * 10); // Range from 180 (cyan) to 240 (blue)
            return `hsl(${hue}, 85%, 55%)`;
          });
        } else if (effectiveCircleTheme === CircleTheme.CUSTOM && customCircleColor) {
          // Use the custom color + variants
          const r = parseInt(customCircleColor.substring(1, 3), 16);
          const g = parseInt(customCircleColor.substring(3, 5), 16);
          const b = parseInt(customCircleColor.substring(5, 7), 16);
          
          particleColors = [
            customCircleColor, 
            `rgb(${Math.min(r + 40, 255)}, ${Math.min(g + 40, 255)}, ${Math.min(b + 40, 255)})`, // Lighter
            `rgb(${Math.max(r - 40, 0)}, ${Math.max(g - 40, 0)}, ${Math.max(b - 40, 0)})`, // Darker
            '#ffffff'
          ];
        } else {
          // Default: derived from the circle's color for consistency
          particleColors = [circleColor];
          // Add white and a lighter shade for visual interest
          particleColors.push('#ffffff');
          
          // Créer une version plus claire de la couleur du cercle
          if (circleColor.startsWith('#')) {
            const r = parseInt(circleColor.substr(1, 2), 16);
            const g = parseInt(circleColor.substr(3, 2), 16);
            const b = parseInt(circleColor.substr(5, 2), 16);
            
            // Éclaircir la couleur en ajoutant de la luminosité
            const lighterColor = `rgb(${Math.min(r + 50, 255)}, ${Math.min(g + 50, 255)}, ${Math.min(b + 50, 255)})`;
            particleColors.push(lighterColor);
          }
        }
        break;
    }
    
    // Si des couleurs personnalisées sont fournies, les utiliser
    if (particleColors.length > 0) {
      particleColors = particleColors;
    }
    
    // Créer des particules avec les couleurs et propriétés définies
    const particles: Particle[] = [];
    
    // Générer les particules
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
      
      // For rainbow circles, create rainbow particles
      if (useRainbowCircles && particleStyle !== ParticleStyle.CONFETTI) {
        // Create particles with colors in the same rainbow spectrum
        const baseHue = Math.random() * 360; // Random hue across the spectrum
        const saturation = 90 + Math.random() * 10; // High saturation
        const lightness = 40 + Math.random() * 50; // Varied lightness
        particleColor = `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
      } else {
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
    // Nettoyer l'animation frame précédente pour éviter les animations concurrentes
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Debug logging for ball theme
    console.log("Initializing game with ball theme:", ballTheme);
    console.log("Ball customization options:", {
      customBallColor,
      ballHasTrail,
      ballTrailColor,
      ballTrailLength,
      ballStrokeWidth,
      ballStrokeColor,
      ballHasGlow,
      ballGlowColor,
      ballGlowSize,
      ballTheme
    });

    // Créer les balles avec images personnalisées si activées
    const newBalls: EnhancedBall[] = [];
    for (let i = 0; i < ballCount; i++) {
      // Déterminer si une image doit être assignée à cette balle
      let ballImage = null;
      let imageIndex = -1;

      if (useCustomImages && loadedImages.length > 0) {
        // Si des assignations d'images sont définies, les utiliser
        if (ballImageAssignments.length > i) {
          imageIndex = ballImageAssignments[i];
          
          // Si l'index est valide, assigner l'image correspondante
          if (imageIndex >= 0 && imageIndex < loadedImages.length) {
            ballImage = loadedImages[imageIndex];
          } else {
            // Sinon, assignation aléatoire
            imageIndex = Math.floor(Math.random() * loadedImages.length);
            ballImage = loadedImages[imageIndex];
          }
        } else {
          // Sans assignation spécifique, choisir aléatoirement
          imageIndex = Math.floor(Math.random() * loadedImages.length);
          ballImage = loadedImages[imageIndex];
        }
      }

      // Log theme being applied to this ball
      console.log(`Creating ball ${i+1} with theme: ${ballTheme}`);

      // Create the ball with all customization properties
      newBalls.push({
        id: generateId(),
        position: { x: centerX, y: centerY },
        velocity: {
          x: (Math.random() - 0.5) * ballSpeed,
          y: 0 // La balle commence sans vitesse verticale
        },
        radius: baseBallRadius,
        color: getRandomPastelColor(),
        image: ballImage,
        imageIndex: imageIndex,
        growing: growing,
        growthRate: growthRate,
        customColor: customBallColor,
        hasTrail: ballHasTrail,
        trailColor: ballTrailColor,
        trailLength: ballTrailLength,
        strokeWidth: ballStrokeWidth,
        strokeColor: ballStrokeColor,
        hasGlow: ballHasGlow,
        glowColor: ballGlowColor,
        glowSize: ballGlowSize,
        theme: ballTheme // Explicitly set the ball theme
      });
    }

    // Créer les cercles avec des rotations progressivement décalées
    const newCircles: Circle[] = [];
    const baseRotationSpeed = rotationSpeed;
    
    for (let i = 0; i < initialCircleCount; i++) {
      const radius = (i + 1) * circleGap + baseBallRadius;
      
      // Calcul du décalage progressif de rotation basé sur l'index du cercle
      // Convertir le pourcentage en radians (un tour complet = 2*PI radians)
      // Gérer à la fois les valeurs positives et négatives
      const progressiveOffset = (progressiveRotationOffset / 100) * (Math.PI * 2) * i;
      
      // Calcul de la vitesse de rotation avec un incrément progressif
      // Chaque cercle tourne légèrement plus vite ou plus lentement que le précédent
      // Pour les valeurs négatives, la vitesse diminue avec l'index
      const speedIncrement = 1 + ((progressiveRotationOffset / 100) * i);
      
      // Appliquer une limite minimale pour que la vitesse ne descende jamais en dessous de la vitesse de base
      // Math.max garantit que le multiplicateur est au moins 1.0 (100% de la vitesse de base)
      const speedMultiplier = progressiveRotationOffset >= 0 ? speedIncrement : Math.max(1.0, speedIncrement);
      
      const adjustedRotationSpeed = baseRotationSpeed * speedMultiplier;
      
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

    // Réinitialiser complètement l'état du jeu
    setGameState({
      balls: newBalls,
      circles: newCircles,
      particles: [], // S'assurer que les particules sont vides
      score: 0, // Réinitialiser le score
      gameOver: false, // Assurer que le jeu n'est pas terminé
      totalShrinkFactor: 1.0, // Réinitialiser le facteur de rétrécissement
      lastBallToTouchCircle: null // Réinitialiser la dernière balle
    });
    
    // Assurer que le son est joué après la réinitialisation de l'état
    setTimeout(() => {
      playGameStartSound();
    }, 100);
  }, [ballSpeed, initialCircleCount, circleGap, exitSize, rotationSpeed, ballCount, baseBallRadius, progressiveRotationOffset, useCustomImages, loadedImages, ballImageAssignments, growing, growthRate, customBallColor, ballHasTrail, ballTrailColor, ballTrailLength, ballStrokeWidth, ballStrokeColor, ballHasGlow, ballGlowColor, ballGlowSize, ballTheme]);

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
        // Appliquer la croissance si activée
        let newRadius = ball.radius;
        if (ball.growing && growing) {
          newRadius += ball.growthRate || growthRate;
        }
        
        // Appliquer la gravité
        let newVelocity = applyGravity(ball.velocity, gravity);
        
        // Limiter la vitesse maximale
        newVelocity = limitVelocity(newVelocity, maxBallSpeed);
        
        // Mettre à jour la position
        let newPosition = updatePosition(ball.position, newVelocity);

        // --- WALL COLLISION SOUND LOGIC --- 
        let didCollideWithWall = false;

        // Vérifier les collisions avec les bords du canvas
        if (newPosition.x - newRadius < 0 || newPosition.x + newRadius > canvas.width) {
          newVelocity.x *= -bounciness;
          newPosition.x = Math.max(newRadius, Math.min(canvas.width - newRadius, newPosition.x));
          didCollideWithWall = true;
        }
        
        if (newPosition.y - newRadius < 0 || newPosition.y + newRadius > canvas.height) {
          newVelocity.y *= -bounciness;
          newPosition.y = Math.max(newRadius, Math.min(canvas.height - newRadius, newPosition.y));
          didCollideWithWall = true;
        }

        // Play wall sound if collision occurred and enabled
        if (didCollideWithWall && enableWallSound) {
           const hasCustom = useCustomSounds && hasCustomSound('wall');
           playWallSound(0.3, hasCustom); // Use the new function from sounds.ts
        }
        // --- END WALL COLLISION SOUND LOGIC ---

        return {
          ...ball,
          position: newPosition,
          velocity: newVelocity,
          radius: newRadius
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
            
            // Vérifier si la balle est dans la "porte de sortie" avec une marge supplémentaire pour faciliter le passage
            // Ajouter une petite marge (10% de la taille de la porte) pour rendre la porte plus facile à traverser
            const margin = exitSizeRad * 0.1;
            let isInExit = false;
            
            if (exitEnd > exitStart) {
              isInExit = normalizedBallAngle >= (exitStart - margin) && normalizedBallAngle <= (exitEnd + margin);
            } else {
              // La porte de sortie chevauche 0/2π
              isInExit = normalizedBallAngle >= (exitStart - margin) || normalizedBallAngle <= (exitEnd + margin);
            }
            
            // Déterminer si la balle se dirige vers le centre ou vers l'extérieur
            const movingOutward = (
              (ball.position.x - centerX) * ball.velocity.x + 
              (ball.position.y - centerY) * ball.velocity.y
            ) > 0;
            
            // Si la balle est dans la porte ET se dirige vers l'extérieur, la laisser passer
            if (isInExit && movingOutward) {
              // La balle s'échappe par la porte !
              if (ballDistFromCenter > circle.radius - ball.radius / 2) { // Moins strict sur la condition de distance
                // Marquer le cercle comme détruit
                circle.isDestroyed = true;
                currentScore += 10;
                
                // Stocker la balle qui a touché la porte
                gameState.lastBallToTouchCircle = ball;
                
                // Initialiser le sound context si nécessaire avant de jouer des sons
                let soundCtx = getSoundAudioContext();
                if (!soundCtx) {
                  console.log('[Door Destroy] Sound context not found, initializing sound system...');
                  initSound();
                  soundCtx = getSoundAudioContext();
                }
                
                // Assurer que le contexte audio est actif
                if (soundCtx && soundCtx.state === 'suspended') {
                  console.log('[Door Destroy] Sound context is suspended, attempting to resume...');
                  soundCtx.resume().then(() => {
                    // Play MIDI note if enabled
                    if (playMidiOnDoorDestroy) {
                      console.log("[Door Destroy] Playing MIDI note for door destruction");
                      playMidiNote(midiVolume);
                    }
                    
                    // Play music/sound if enabled
                    if (playMusicOnDoorDestroy) {
                      if (useCustomSounds && customExitSound) {
                        // Custom exit sound handling with volume control
                        const audioElement = new Audio(URL.createObjectURL(customExitSound));
                        audioElement.volume = customExitSoundVolume;
                        audioElement.play().catch(e => console.error("Erreur lors de la lecture du son personnalisé:", e));
                      } else {
                        // Standard sound
                        playRandomSound();
                      }
                    }
                  }).catch(err => {
                    console.error('[Door Destroy] Failed to resume sound context:', err);
                  });
                } else {
                  // Play sounds immediately if context is active or unavailable
                  // Play MIDI note if enabled
                  if (playMidiOnDoorDestroy) {
                    console.log("[Door Destroy] Playing MIDI note for door destruction");
                    playMidiNote(midiVolume);
                  }
                  
                  // Play music/sound if enabled
                  if (playMusicOnDoorDestroy) {
                    if (useCustomSounds && customExitSound) {
                      // Custom exit sound handling with volume control
                      const audioElement = new Audio(URL.createObjectURL(customExitSound));
                      audioElement.volume = customExitSoundVolume;
                      audioElement.play().catch(e => console.error("Erreur lors de la lecture du son personnalisé:", e));
                    } else {
                      // Standard sound
                      playRandomSound();
                    }
                  }
                }
                
                justDestroyedCircle = true;
                
                // Créer des particules pour l'effet de destruction
                const newParticles = createDestructionParticles(
                  centerX, centerY, circle.radius, circle.color
                );
                currentParticles.push(...newParticles);
                
                // Créer de nouvelles balles si l'option est activée
                if (ballsOnDestroy > 0) {
                  const newBalls = createBallsOnDestroy(centerX, centerY, circle.radius, ball);
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
                  
                  // Calculer les nouveaux rayons en fonction du rétrécissement global
                  let previousRadius = 0; // Point de départ (centre)
                  
                  activeCirlces.forEach((circle, idx) => {
                    // Calculer le rayon idéal basé sur le rétrécissement global
                    const idealRadius = circle.originalRadius * totalShrinkFactor;
                    
                    // Calculer le rayon minimum basé sur le rayon précédent et l'espacement minimum défini par l'utilisateur
                    // Note: si minCircleGap est 0, cela permet aux cercles d'être collés les uns aux autres
                    const minRadiusFromGap = previousRadius + minCircleGap + baseBallRadius;
                    
                    // Prendre le maximum entre le rayon idéal et la taille minimale configurée
                    // Si minCircleGap est 0, on n'impose pas de contrainte supplémentaire basée sur l'espacement
                    let newTargetRadius;
                    
                    if (minCircleGap > 0) {
                      // Si un espacement minimum est demandé, on l'applique
                      newTargetRadius = Math.max(
                        idealRadius,
                        minRadiusFromGap,
                        minCircleRadius // Utiliser la taille minimale configurée
                      );
                    } else {
                      // Si l'espacement minimum est 0, on ignore la contrainte d'espacement
                      newTargetRadius = Math.max(
                        idealRadius,
                        minCircleRadius // Seulement respecter la taille minimale du cercle
                      );
                    }
                    
                    // Définir le nouveau rayon cible et activer le flash
                    circle.targetRadius = newTargetRadius;
                    circle.isFlashing = true;
                    
                    // Mettre à jour le rayon précédent pour le prochain cercle
                    previousRadius = newTargetRadius;
                  });
                }
              }
            } else if (!isInExit || !movingOutward) {
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
        let circleColor = circle.isFlashing ? 'rgba(255, 255, 255, 0.9)' : circle.color;
        
        // Create color based on selected theme
        const effectiveCircleTheme = useRainbowCircles ? CircleTheme.RAINBOW : circleTheme;
        if (!circle.isFlashing) {
          switch (effectiveCircleTheme) {
            case CircleTheme.RAINBOW:
              if (animateRainbow) {
                // Animated rainbow based on time and circle index
                const timeOffset = performance.now() / 1000; // Time in seconds
                const speed = gradientSpeed * 50;
                const hue = ((circle.circleIndex * 30) + timeOffset * speed) % 360;
                circleColor = `hsl(${hue}, 100%, 50%)`;
              } else {
                // Static rainbow based on circle index
                const hue = (circle.circleIndex * 60) % 360;
                circleColor = `hsl(${hue}, 100%, 50%)`;
              }
              break;
              
            case CircleTheme.NEON:
              // Bright neon colors with glow effect
              const neonHue = (circle.circleIndex * 40) % 360;
              // Higher lightness for neon effect
              const lightness = 50 + (glowIntensity * 20);
              circleColor = `hsl(${neonHue}, 100%, ${lightness}%)`;
              break;
              
            case CircleTheme.LAVA:
              // Lava theme uses red to yellow gradient
              let lavaHue;
              if (animateRainbow) {
                // Animate the lava colors
                const timeOffset = performance.now() / 1000;
                const speed = gradientSpeed * 30;
                // Fluctuate between 0 and 60 (red to yellow-orange)
                const fluctuation = Math.sin(timeOffset * speed + circle.circleIndex) * 30;
                lavaHue = 10 + fluctuation; // Base of red (10) with fluctuation
              } else {
                // Static lava colors
                lavaHue = 10 + (circle.circleIndex * 5) % 60; // Range from red(0) to yellow(60)
              }
              circleColor = `hsl(${lavaHue}, 100%, 50%)`;
              break;
              
            case CircleTheme.WATER:
              // Water theme uses blue to cyan gradient
              let waterHue;
              if (animateRainbow) {
                // Animate the water colors
                const timeOffset = performance.now() / 1000;
                const speed = gradientSpeed * 20;
                // Fluctuate colors in the blue range
                const fluctuation = Math.sin(timeOffset * speed + circle.circleIndex) * 30;
                waterHue = 200 + fluctuation; // Base of blue (200) with fluctuation
              } else {
                // Static water colors
                waterHue = 180 + (circle.circleIndex * 5) % 60; // Range in blue-cyan (180-240)
              }
              circleColor = `hsl(${waterHue}, 85%, 55%)`;
              break;
              
            case CircleTheme.CUSTOM:
              // Use the custom color for all circles
              if (customCircleColor) {
                circleColor = customCircleColor;
              }
              break;
              
            case CircleTheme.DEFAULT:
            default:
              // Use default random colors
              // No change needed as circleColor is already set
              break;
          }
        }
        
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
        ctx.lineWidth = circleStrokeWidth; // Use the custom stroke width
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
              ctx.lineWidth = circleStrokeWidth + 2; // Slightly thicker for the exit
              break;
              
            case ExitStyle.INVERTED:
              // Inverser la couleur du cercle
              if (effectiveCircleTheme === CircleTheme.RAINBOW || effectiveCircleTheme === CircleTheme.NEON || 
                  effectiveCircleTheme === CircleTheme.LAVA || effectiveCircleTheme === CircleTheme.WATER) {
                // For themed circles, use a complementary color for the exit
                if (circleColor.startsWith('hsl')) {
                  const hueMatch = circleColor.match(/hsl\((\d+)/);
                  if (hueMatch) {
                    const hue = (parseInt(hueMatch[1]) + 180) % 360; // Complementary color
                    ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
                  } else {
                    ctx.strokeStyle = '#ffffff'; // Fallback
                  }
                } else {
                  ctx.strokeStyle = '#ffffff'; // Fallback
                }
              } else if (circle.color.startsWith('#')) {
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
              ctx.lineWidth = circleStrokeWidth + 2;
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
              ctx.lineWidth = circleStrokeWidth + 3; // Plus large pour l'effet brillant
              
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
              ctx.lineWidth = circleStrokeWidth + 2;
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
        // If the ball has a trail and trail is enabled
        if (ball.hasTrail && ballHasTrail) {
          // Calculate the previous positions based on velocity
          const trailLength = ball.trailLength || ballTrailLength;
          const trailColor = ball.trailColor || ballTrailColor;
          
          for (let i = 1; i <= trailLength; i++) {
            const trailOpacity = 1 - (i / trailLength);
            const trailSize = ball.radius * (1 - (i / (trailLength * 2)));
            
            // Calculate trail position, going backwards based on velocity
            const trailPos = {
              x: ball.position.x - (ball.velocity.x * i * 0.5),
              y: ball.position.y - (ball.velocity.y * i * 0.5)
            };
            
            // Draw trail particle
            ctx.beginPath();
            ctx.arc(
              trailPos.x,
              trailPos.y,
              trailSize,
              0,
              Math.PI * 2
            );
            
            // Apply trail color with fading opacity
            ctx.fillStyle = trailColor.startsWith('#') 
              ? `${trailColor}${Math.floor(trailOpacity * 255).toString(16).padStart(2, '0')}`
              : `rgba(255, 255, 255, ${trailOpacity})`;
              
            ctx.fill();
          }
        }
        
        // Si la balle a une image et que les images personnalisées sont activées
        if (useCustomImages && ball.image) {
          // Dessiner l'image centrée sur la position de la balle, avec la taille correspondant au diamètre
          ctx.save();
          ctx.beginPath();
          ctx.arc(ball.position.x, ball.position.y, ball.radius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          
          // Dessiner l'image
          const size = ball.radius * 2;
          ctx.drawImage(
            ball.image,
            ball.position.x - ball.radius,
            ball.position.y - ball.radius,
            size,
            size
          );
          
          // Ajouter un contour
          if (ball.strokeWidth && ball.strokeWidth > 0 || ballStrokeWidth > 0) {
            ctx.strokeStyle = ball.strokeColor || ballStrokeColor;
            ctx.lineWidth = ball.strokeWidth || ballStrokeWidth;
            ctx.stroke();
          }
          
          ctx.restore();
        } else {
          // Dessin amélioré pour les balles sans image
          ctx.beginPath();
          ctx.arc(
            ball.position.x,
            ball.position.y,
            ball.radius,
            0,
            Math.PI * 2
          );
          
          // Apply ball theme or custom color
          let ballFillColor: string | CanvasGradient = ball.color;
          
          if (ball.customColor) {
            // Using custom color for this ball
            ballFillColor = ball.customColor;
            console.log("Applied custom ball color:", ball.customColor);
          } else if (ball.theme) {
            // Using specific theme from ball property
            console.log("Applied ball-specific theme:", ball.theme);
            switch(ball.theme) {
              case 'rainbow':
                // Create rainbow effect based on time
                const rainbowTime = performance.now() / 1000;
                const hue = (rainbowTime * 50) % 360;
                ballFillColor = `hsl(${hue}, 100%, 50%)`;
                break;
              case 'fire':
                // Create fire effect with gradient
                const fireGradient = ctx.createRadialGradient(
                  ball.position.x, ball.position.y, 0,
                  ball.position.x, ball.position.y, ball.radius
                );
                fireGradient.addColorStop(0, 'yellow');
                fireGradient.addColorStop(0.7, 'orange');
                fireGradient.addColorStop(1, 'red');
                ballFillColor = fireGradient;
                break;
              case 'ice':
                // Create ice effect with gradient
                const iceGradient = ctx.createRadialGradient(
                  ball.position.x, ball.position.y, 0,
                  ball.position.x, ball.position.y, ball.radius
                );
                iceGradient.addColorStop(0, 'white');
                iceGradient.addColorStop(0.7, 'lightblue');
                iceGradient.addColorStop(1, 'blue');
                ballFillColor = iceGradient;
                break;
              case 'neon':
                // Create neon effect
                ballFillColor = '#0ff';
                // Will add glow later
                break;
              default:
                // Use the default color
                ballFillColor = ball.color;
            }
          } else if (ballTheme !== 'default') {
            // Apply global theme if ball doesn't have specific theme
            console.log("Applied global ball theme:", ballTheme);
            switch(ballTheme) {
              case 'rainbow':
                // Create rainbow effect based on time and ball index
                const rainbowTime = performance.now() / 1000;
                const hue = (rainbowTime * 50) % 360;
                ballFillColor = `hsl(${hue}, 100%, 50%)`;
                break;
              case 'fire':
                // Create fire effect with gradient
                const fireGradient = ctx.createRadialGradient(
                  ball.position.x, ball.position.y, 0,
                  ball.position.x, ball.position.y, ball.radius
                );
                fireGradient.addColorStop(0, 'yellow');
                fireGradient.addColorStop(0.7, 'orange');
                fireGradient.addColorStop(1, 'red');
                ballFillColor = fireGradient;
                break;
              case 'ice':
                // Create ice effect with gradient
                const iceGradient = ctx.createRadialGradient(
                  ball.position.x, ball.position.y, 0,
                  ball.position.x, ball.position.y, ball.radius
                );
                iceGradient.addColorStop(0, 'white');
                iceGradient.addColorStop(0.7, 'lightblue');
                iceGradient.addColorStop(1, 'blue');
                ballFillColor = iceGradient;
                break;
              case 'neon':
                // Create neon effect
                ballFillColor = '#0ff';
                // Will add glow later
                break;
              default:
                // Use the default color or global custom ball color
                ballFillColor = customBallColor || ball.color;
            }
          } else if (customBallColor) {
            // Use global custom ball color
            console.log("Applied global custom ball color:", customBallColor);
            ballFillColor = customBallColor;
          }
          
          // Apply the ball fill color
          ctx.fillStyle = ballFillColor;
          ctx.fill();
          
          // Add glow effect if enabled
          if ((ball.hasGlow === true) || (ballHasGlow === true) || 
              ball.theme === 'neon' || ballTheme === 'neon') {
            
            // Set default glow size if not specified
            let effectiveGlowSize = 5;
            
            // Use ball-specific glow size if available, otherwise use global setting
            if (typeof ball.glowSize === 'number') {
              effectiveGlowSize = ball.glowSize;
            } else if (typeof ballGlowSize === 'number') {
              effectiveGlowSize = ballGlowSize;
            }
            
            let glowColor = ball.glowColor || ballGlowColor;
            
            // For neon theme, use cyan glow
            if (ball.theme === 'neon' || ballTheme === 'neon') {
              glowColor = ball.glowColor || '#0ff';
            }
            
            // Save current shadow settings
            const prevShadowColor = ctx.shadowColor;
            const prevShadowBlur = ctx.shadowBlur;
            
            // Apply glow effect using shadow
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = effectiveGlowSize * 5;
            
            // Draw another circle with same path for the glow
            ctx.beginPath();
            ctx.arc(
              ball.position.x,
              ball.position.y,
              ball.radius,
              0,
              Math.PI * 2
            );
            ctx.fillStyle = ballFillColor;
            ctx.fill();
            
            // Restore previous shadow settings
            ctx.shadowColor = prevShadowColor;
            ctx.shadowBlur = prevShadowBlur;
          }
          
          // Add stroke/outline if enabled
          if ((ball.strokeWidth && ball.strokeWidth > 0) || ballStrokeWidth > 0) {
            ctx.strokeStyle = ball.strokeColor || ballStrokeColor;
            ctx.lineWidth = ball.strokeWidth || ballStrokeWidth;
            ctx.stroke();
          } else {
            // Default subtle stroke
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      });

      // Afficher un message si le jeu est terminé
      if (isGameOver) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#ff7700';
        ctx.fillText(customEndMessage, canvas.width / 2, canvas.height / 2 - 30);
      }
      // Sinon afficher le nombre de cercles restants au centre-haut
      else if (remainingCircles.length > 0) {
        // Afficher le nombre de cercles restants au centre-haut avec un fond personnalisé
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Arial';
        const remainingText = `${remainingCirclesPrefix}: ${remainingCircles.length}`;
        
        // Mesurer la taille du texte pour créer un fond approprié
        const textMetrics = ctx.measureText(remainingText);
        const textWidth = textMetrics.width;
        const textHeight = 24; // Hauteur du texte (ajustée pour meilleure symétrie)
        const padding = 10; // Padding autour du texte
        
        // Position verticale améliorée
        const textY = 70; // Position Y du texte (déplacé plus bas comme demandé)
        
        // Dessiner le fond
        ctx.fillStyle = remainingCirclesBgColor;
        ctx.fillRect(
          centerX - textWidth/2 - padding, 
          textY - textHeight/2 - padding, 
          textWidth + padding*2, 
          textHeight + padding*2
        );
        
        // Dessiner le texte en respectant sa position verticale
        ctx.fillStyle = remainingCirclesTextColor;
        ctx.fillText(remainingText, centerX, textY + textHeight/4); // Ajustement vertical pour centrer le texte
      }

      // Mettre à jour l'état du jeu
      setGameState({
        balls: currentBalls,
        circles: currentCircles,
        particles: currentParticles,
        score: currentScore,
        gameOver: isGameOver,
        totalShrinkFactor: totalShrinkFactor,
        lastBallToTouchCircle: gameState.lastBallToTouchCircle // Persist last touched ball
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
  }, [isPlaying, gameState, gravity, bounciness, exitSizeRad, onGameEnd, maxBallSpeed, shrinkCirclesOnDestroy, shrinkFactor, baseBallRadius, circleGap, minCircleGap, minCircleRadius, ballsOnDestroy, exitStyle, particleStyle, customEndMessage, showFinalScore, useCustomSounds, customExitSound, customExitSoundVolume, customWallSound, enableWallSound, useCustomImages, loadedImages, ballImageAssignments, growing, growthRate, remainingCirclesPrefix, remainingCirclesBgColor, remainingCirclesTextColor, playMidiOnDoorDestroy, midiVolume, playMusicOnDoorDestroy, doorDestroyMusicVolume, useRainbowCircles, circleStrokeWidth, animateRainbow, circleTheme, customCircleColor, glowIntensity, gradientSpeed, customBallColor, ballHasTrail, ballTrailColor, ballTrailLength, ballStrokeWidth, ballStrokeColor, ballHasGlow, ballGlowColor, ballGlowSize, ballTheme]);

  // Fonction pour créer de nouvelles balles à l'emplacement d'un cercle détruit
  const createBallsOnDestroy = (centerX: number, centerY: number, circleRadius: number, sourceBall?: EnhancedBall): EnhancedBall[] => {
    if (ballsOnDestroy <= 0) return [];
    
    // Vérifier le nombre maximal de balles
    const currentBallCount = gameState.balls.length;
    const maxBallsToCreate = maxBallCount ? Math.min(ballsOnDestroy, maxBallCount - currentBallCount) : ballsOnDestroy;
    
    // Si on a déjà atteint ou dépassé le nombre maximal de balles, ne pas en créer d'autres
    if (maxBallsToCreate <= 0) return [];
    
    const newBalls: EnhancedBall[] = [];
    
    // Add debug logging
    console.log("Creating new balls with theme:", ballTheme);
    
    for (let i = 0; i < maxBallsToCreate; i++) {
      // Angle aléatoire pour la direction de la balle
      const angle = Math.random() * Math.PI * 2;
      
      // Position sur le cercle détruit
      const posX = centerX + Math.cos(angle) * circleRadius * 0.8;
      const posY = centerY + Math.sin(angle) * circleRadius * 0.8;
      
      // Vitesse initiale légèrement orientée vers l'extérieur
      const speed = 1 + Math.random() * 3; // Vitesse modérée pour ne pas sortir trop vite
      const velX = Math.cos(angle) * speed;
      const velY = Math.sin(angle) * speed;
      
      // Déterminer l'image à utiliser
      let ballImage = null;
      let imageIndex = -1;
      
      // Si l'héritage d'image est activé et qu'une balle source est fournie
      if (inheritBallImage && sourceBall && sourceBall.image) {
        ballImage = sourceBall.image;
        imageIndex = sourceBall.imageIndex || -1;
      } 
      // Sinon, utiliser une image aléatoire si les images personnalisées sont activées
      else if (useCustomImages && loadedImages.length > 0) {
        imageIndex = Math.floor(Math.random() * loadedImages.length);
        ballImage = loadedImages[imageIndex];
      }
      
      // Create the new ball with proper theme
      newBalls.push({
        id: generateId(),
        position: { x: posX, y: posY },
        velocity: { x: velX, y: velY },
        radius: baseBallRadius,
        color: getRandomPastelColor(),
        image: ballImage,
        imageIndex: imageIndex,
        growing: growing,
        growthRate: growthRate,
        customColor: customBallColor,
        hasTrail: ballHasTrail,
        trailColor: ballTrailColor,
        trailLength: ballTrailLength,
        strokeWidth: ballStrokeWidth,
        strokeColor: ballStrokeColor,
        hasGlow: ballHasGlow,
        glowColor: ballGlowColor,
        glowSize: ballGlowSize,
        theme: ballTheme // Use the current ballTheme here
      });
    }
    
    return newBalls;
  };

  // Ajout d'un état pour gérer l'affichage des contrôles d'enregistrement
  const [showRecordingControls, setShowRecordingControls] = useState(true);
  
  // Utiliser le hook useGameRecorder pour l'enregistrement
  const { 
    startRecording, 
    stopRecording, 
    isRecording: isRecordingActive, 
    videoBlob,
    recordingTime,
    downloadGameplayVideo
  } = useGameRecorder();

  // Fonction pour basculer l'enregistrement
  const toggleRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get sound context from sounds.ts, initialize if needed
    let soundCtx = getSoundAudioContext(); 
    if (!soundCtx) {
      console.log('[CRC Recording] Sound context not found from sounds.ts, initializing sound system...');
      initSound(); // Initialize sounds.ts context
      soundCtx = getSoundAudioContext();
      if (soundCtx) {
        console.log('[CRC Recording] Sound system initialized, context state:', soundCtx.state);
      } else {
        console.error('[CRC Recording] Failed to initialize sound system context.');
      }
    }

    // Define the next step: setup recorder audio and toggle recording state
    const proceedWithToggle = (finalSoundCtx: AudioContext | null) => {
      // Now call the handler which will connect sounds.ts and start recording
      handleRecordingToggle(); 
    };

    // Check if context needs resuming
    if (soundCtx && soundCtx.state === 'suspended') {
      console.log('[CRC Recording] Sound system audio context is suspended, attempting to resume...');
      soundCtx.resume().then(() => {
        console.log('[CRC Recording] Sound system audio context resumed successfully.');
        proceedWithToggle(soundCtx); // Proceed with the resumed context
      }).catch(err => {
        console.error('[CRC Recording] Failed to resume sound system audio context:', err);
        proceedWithToggle(null); // Proceed anyway
      });
    } else {
      // Context is active, was never suspended, or is null (initialization failed)
      if (soundCtx) {
        console.log('[CRC Recording] Sound system audio context is active or was not suspended. State:', soundCtx.state);
      } else {
        console.log('[CRC Recording] Sound system audio context is null (initialization failed). Proceeding anyway.');
      }
      proceedWithToggle(soundCtx); // Proceed with current context (or null)
    }
  };
  
  // Handler function for the actual recording start/stop logic
  const handleRecordingToggle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isRecordingActive) {
      console.log("Arrêt de l'enregistrement...");
      stopRecording()
      .then(blob => {
        if (blob) {
            console.log(`Enregistrement terminé, taille: ${blob.size} bytes`);
        } else {
            console.error("Stop recording returned no blob.");
        }
      })
      .catch(error => {
          console.error("Erreur lors de l'arrêt de l'enregistrement:", error);
        });
    } else {
      console.log("Démarrage de l'enregistrement avec capture audio...");
      
      // Get the sound audio context
      const soundCtx = getSoundAudioContext();
      if (soundCtx) {
        // Connect the sound system to the recorder
        console.log("Connexion du système audio à l'enregistreur...");
        // The hook will handle this internally
      } else {
        console.error("Contexte audio non disponible pour l'enregistrement. L'audio ne sera pas enregistré.");
      }
      
      // High quality recording options
      const recordingOptions = {
        frameRate: 60, // Higher frame rate for smoother motion
        videoBitsPerSecond: 20000000, // ULTRA QUALITY: 20 Mbps for maximum detail
        captureAudio: true
      };
      
      // Start recording using the hook's function with maximum quality settings
      startRecording(canvas, 60000, recordingOptions)
        .catch(error => {
          console.error("Échec du démarrage de l'enregistrement:", error);
          
          // Fallback to default codec with slightly lower bitrate but still high quality
          const fallbackOptions = {
            frameRate: 60,
            videoBitsPerSecond: 15000000, // Still high quality in fallback
            captureAudio: true
          };
          
          startRecording(canvas, 60000, fallbackOptions)
            .catch(fallbackError => {
              console.error("Échec du démarrage de l'enregistrement avec paramètres de secours:", fallbackError);
              alert("Impossible de démarrer l'enregistrement. Vérifiez les autorisations du navigateur ou réessayez.");
            });
        });
    }
  };
  
  // Fonction pour télécharger la vidéo
  const handleDownloadVideo = () => {
    if (videoBlob) {
      const filename = `cercles-game-${new Date().getTime()}.webm`;
      downloadGameplayVideo(filename);
    }
  };

  // Determine the effective circle theme
  // If useRainbowCircles is true, use RAINBOW theme for backward compatibility
  const effectiveCircleTheme = useRainbowCircles ? CircleTheme.RAINBOW : circleTheme;

  return (
    <div className="tiktok-game-wrapper" style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={450}
        height={800}
        style={{ backgroundColor: '#111' }}
      />
      {/* Afficher l'indicateur d'enregistrement */}
      {isRecordingActive && (
        <div style={recordingStyles.container}>
          <div style={recordingStyles.recordIcon}></div>
          <div style={recordingStyles.time}>{formatRecordingTime(recordingTime || 0)}</div>
        </div>
      )}
      {/* Ajouter les contrôles d'enregistrement */}
   
    </div>
  );
};

export default CollapsingRotatingCircles; 
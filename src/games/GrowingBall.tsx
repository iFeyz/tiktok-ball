import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { GameProps, Ball, GameState } from '../types';
import { 
  createRandomBall, 
  isCollidingWithCircle, 
  reflectVelocity, 
  applyGravity, 
  updatePosition 
} from '../utils/gameUtils';
import { 
  playBounceSound, 
  playGrowSound, 
  playGameOverSound,
  initSound,
  connectToRecorder,
  setAudioContext,
  getAudioContext as getSoundAudioContext,
  playBallMusicNote,
  MUSIC_SCALES,
  setBallMusicScale,
  CustomMusicKey,
  playNextProgressiveSoundPart,
  playNextExtractedNote,
  setProgressiveSoundVolume,
  getProgressiveSoundVolume,
  loadProgressiveSound,
  hasProgressiveSound,
  clearProgressiveSound,
  playMIDINote,
  hasMIDISequence,
  setMIDIVolume
} from '../utils/sounds';
import { useGameRecorder } from '../utils/recorder';

// Physics parameters for realistic bouncing
const DEFAULT_GRAVITY = 0.8;         // Gravité plus forte pour un mouvement plus réaliste
const DEFAULT_GROWTH_RATE = 0.7;
const DEFAULT_BOUNCINESS = 0.85;     // Augmenter la valeur par défaut pour plus de rebond
const DEFAULT_FRICTION = 0.98;       // Garder une friction modérée
const DEFAULT_BRIGHTNESS_INCREASE = 5;
const DEFAULT_SPEED = 7;             // Vitesse initiale modérée
const WALL_PADDING = 3;
const MAX_VELOCITY = 15;             // Augmenter la vitesse maximale pour permettre des rebonds plus énergiques
const MIN_VELOCITY = 2.0;            // Vitesse minimale réduite pour permettre aux balles de ralentir naturellement
const SPEED_CAP_AFTER_BOUNCE = 15;   // Augmenter aussi cette limite
const RANDOM_FORCE_INTERVAL = 5000;  // Forces aléatoires moins fréquentes
const RANDOM_FORCE_MAGNITUDE = 0.5;  // Forces aléatoires plus faibles
const MAX_BALLS = 5;
const COLLISION_THRESHOLD = 0.1;     // Seuil de collision plus élevé
const GRAVITY_SCALING = 1.1;         // Réduire légèrement la gravité pour des rebonds plus hauts
const AIR_RESISTANCE = 0.999;        // MODIFICATION: Réduire au minimum la résistance de l'air (presque pas de perte)
const VELOCITY_DAMPING = 0.998;      // MODIFICATION: Réduire l'amortissement pour maintenir l'énergie

// Explicitly define the allowed types for music scales
type MusicScaleKey = 'majorScale' | 'minorScale' | 'pentatonic' | 'blues' | 'jazz' | 'eastern';

interface GrowingBallProps extends GameProps {
  gravity?: number;
  growthRate?: number;
  bounciness?: number;
  ballSpeed?: number;
  initialBallCount?: number; // New prop for initial ball count
  effectsEnabled?: boolean; // New prop for visual effects toggle
  ballCollisionsEnabled?: boolean;
  scoreTrackingEnabled?: boolean;
  bgEffectsEnabled?: boolean;
  useCustomImages?: boolean;
  customImages?: string[];
  ballImageAssignments?: number[];
  useCustomSounds?: boolean;
  customBallSounds?: {[key: number]: string[]};  // Map ball index to custom sounds
  musicEnabled?: boolean; // Activer les effets musicaux
  ballMusicAssignments?: {[key: number]: keyof typeof MUSIC_SCALES | CustomMusicKey}; // Quelles balles jouent quelle gammes musicales
  backgroundMusicEnabled?: boolean; // Activer la musique de fond
  progressiveSoundEnabled?: boolean; // Activer les sons progressifs
  onBallCollision?: (volume: number) => void; // Callback pour les collisions de balles
  maxBallSpeed?: number;
  onGameOver?: () => void;
  ballCount: number;
  standardSoundsEnabled?: boolean;
  extractedMusicEnabled?: boolean;
  bounceVolume?: number; // New prop for bounce sound volume
  progressiveSoundVolume?: number; // New prop for progressive sound volume
  onVolumeChange?: (type: 'bounce' | 'progressive', value: number) => void;
  midiEnabled?: boolean;
  midiVolume?: number;
}

interface EnhancedBall extends Ball {
  pulseEffect?: number;
  glowSize?: number;
  glowOpacity?: number;
  squash?: number;          // Garder la propriété pour compatibilité
  rotation?: number;        // Garder la propriété pour compatibilité
  score?: number;
  image?: HTMLImageElement | null;
  lastCollisionTime?: number;
  imageIndex?: number;
  growing?: boolean;        // Added property for growth on click
  musicScale?: MusicScaleKey | CustomMusicKey; // La gamme musicale associée à la balle
  mass?: number;            // Masse proportionnelle à la taille
  elasticity?: number;      // Élasticité variable
  angularVelocity?: number; // Légère rotation
  initialSpeed?: number;    // Added property for initial speed
}

// Recording status UI styles
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

const GrowingBall: React.FC<GrowingBallProps> = ({ 
  isPlaying, 
  onGameEnd,
  gravity = DEFAULT_GRAVITY,
  growthRate = DEFAULT_GROWTH_RATE,
  bounciness = DEFAULT_BOUNCINESS,
  ballSpeed = DEFAULT_SPEED,
  initialBallCount = 1, // Default to 1 ball
  effectsEnabled = true, // Default to enabled
  ballCollisionsEnabled = true,
  scoreTrackingEnabled = true,
  bgEffectsEnabled = true,
  useCustomImages = false,
  customImages = [],
  ballImageAssignments = [],
  useCustomSounds = false,
  customBallSounds = {},  // Add customBallSounds prop with default empty object
  musicEnabled = true, // Activer la musique par défaut
  ballMusicAssignments = {}, // Assignation de gammes musicales vide par défaut
  backgroundMusicEnabled = false, // Musique de fond désactivée par défaut
  progressiveSoundEnabled = false, // Sons progressifs désactivés par défaut
  onBallCollision = undefined, // Callback pour les collisions de balles
  maxBallSpeed = MAX_VELOCITY,
  onGameOver,
  ballCount,
  standardSoundsEnabled = true,
  extractedMusicEnabled = true,
  bounceVolume = 0.7, // Default bounce volume
  progressiveSoundVolume = 0.7, // Default progressive sound volume
  onVolumeChange,
  midiEnabled = false,
  midiVolume = 0.7
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastRandomForceTime = useRef<number>(0);
  const [gameState, setGameState] = useState<GameState>({
    balls: [],
    score: 0,
    gameOver: false
  });
  const [backgroundBrightness, setBackgroundBrightness] = useState(0);
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([]);
  
  // Video recording state using our custom hook
  const { 
    isRecording, 
    recordingTime, 
    videoBlob, 
    startRecording, 
    stopRecording, 
    downloadGameplayVideo,
    getAudioDestination,
    getAudioContext,
    setupAudioRecording
  } = useGameRecorder();
  
  // Add state for custom sounds
  const [loadedSounds, setLoadedSounds] = useState<{[key: number]: HTMLAudioElement[]}>({});
  const [audioSetupComplete, setAudioSetupComplete] = useState(false);
  
  // Add state for progressive sound file status
  const [hasProgressiveFile, setHasProgressiveFile] = useState(false);
  
  // Initialize sound system and connect to recorder - using a single shared audio context
  useEffect(() => {
    // Créer ou réutiliser un contexte audio
    let audioContext = getSoundAudioContext();
    
    if (!audioContext) {
      // Initialiser le système audio avec un nouveau contexte
      initSound();
      audioContext = getSoundAudioContext();
      
      if (audioContext) {
        // Si le système audio a créé un contexte, configurer l'enregistreur pour l'utiliser
        console.log('Sharing audio context from sound system to recorder');
        setupAudioRecording(audioContext);
      }
    } else {
      // Déjà un contexte audio du système de son, le réutiliser
      console.log('Audio context already exists in sound system');
      setupAudioRecording(audioContext);
    }
    
    // Une fois que les deux systèmes partagent le même contexte, connecter les sorties audio
    const destination = getAudioDestination();
    if (destination) {
      console.log('Connecting sound system to recorder destination');
      connectToRecorder(destination);
      setAudioSetupComplete(true);
    }
  }, [getAudioDestination, setupAudioRecording]);
  
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
  
  // Load custom sounds when component mounts
  useEffect(() => {
    if (useCustomSounds && Object.keys(customBallSounds).length > 0) {
      const sounds: {[key: number]: HTMLAudioElement[]} = {};
      
      Object.entries(customBallSounds).forEach(([ballIndex, soundUrls]) => {
        const index = parseInt(ballIndex);
        sounds[index] = [];
        
        soundUrls.forEach(url => {
          const audio = new Audio(url);
          audio.load();
          sounds[index].push(audio);
        });
      });
      
      setLoadedSounds(sounds);
      console.log('Custom ball sounds loaded:', Object.keys(sounds).length);
    }
  }, [useCustomSounds, customBallSounds]);
  
  // Set initial progressive sound volume
  useEffect(() => {
    setProgressiveSoundVolume(progressiveSoundVolume);
  }, [progressiveSoundVolume]);
  
  // Add useEffect to check if progressive sound file is loaded
  useEffect(() => {
    setHasProgressiveFile(hasProgressiveSound());
  }, []);
  
  // Cap velocity to prevent extreme speeds
  const capVelocity = (vx: number, vy: number, maxSpeed: number): {x: number, y: number} => {
    const speed = Math.sqrt(vx * vx + vy * vy);
    
    if (speed > maxSpeed) {
      // Normalize and scale to max speed
      return {
        x: (vx / speed) * maxSpeed,
        y: (vy / speed) * maxSpeed
      };
    }
    
    // Ensure minimum velocity to prevent the ball from stopping
    if (speed < MIN_VELOCITY) {
      const minSpeed = MIN_VELOCITY;
      // If speed is too low, increase it to minimum while preserving direction
      return {
        x: speed > 0 ? (vx / speed) * minSpeed : (Math.random() - 0.5) * minSpeed,
        y: speed > 0 ? (vy / speed) * minSpeed : (Math.random() - 0.5) * minSpeed
      };
    }
    
    return { x: vx, y: vy };
  };
  
  // Apply a random force to prevent balls from stabilizing
  const applyRandomForce = (balls: EnhancedBall[], timestamp: number): EnhancedBall[] => {
    // Check if enough time has passed since the last random force
    if (timestamp - lastRandomForceTime.current < RANDOM_FORCE_INTERVAL) {
      return balls;
    }
    
    // Update the last random force time
    lastRandomForceTime.current = timestamp;
    
    // Apply random force to each ball with a chance to skip some balls
    return balls.map(ball => {
      // Only apply force with 75% probability to make movement more natural
      if (Math.random() > 0.25) {
        // Random angle with bias toward horizontal movement
        const angle = Math.random() * Math.PI * 1.5 + Math.PI * 0.25;
        
        // Apply force with some randomized magnitude
        const forceMagnitude = RANDOM_FORCE_MAGNITUDE * (0.7 + Math.random() * 0.6);
        const forceX = Math.cos(angle) * forceMagnitude;
        const forceY = Math.sin(angle) * forceMagnitude;
      
      return {
        ...ball,
        velocity: {
          x: ball.velocity.x + forceX,
          y: ball.velocity.y + forceY
        }
      };
      }
      return ball;
    });
  };
  
  // Fix dependency array in useEffect for ball initialization
  useEffect(() => {
    // Reset the game state if we're not playing
    if (!isPlaying) {
      setGameState({
        balls: [],
        score: 0,
        gameOver: false
      });
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear any previous animation frame
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = undefined;
    }
    
    // Create multiple balls based on initialBallCount or ballCount
    const initialBalls: EnhancedBall[] = [];
    const numBalls = Math.max(1, Math.min(initialBallCount || ballCount, MAX_BALLS)); // Ensure at least 1 ball, cap at maximum
    
    console.log(`Creating ${numBalls} balls with speed ${ballSpeed}`);
    
    for (let i = 0; i < numBalls; i++) {
      // Si des assignations d'images sont fournies, utiliser l'index assigné pour cette balle
      const assignedImageIndex = ballImageAssignments && ballImageAssignments.length > i 
        ? ballImageAssignments[i] 
        : -1; // -1 signifie pas d'assignation spécifique
      
      // Start with a moderate angle with more randomness
      const angle = Math.random() * Math.PI * 2; // Full 360-degree range
      
      // Augmenter la vitesse initiale des balles
      const initialSpeed = Math.min(ballSpeed * 1.5 + Math.random() * ballSpeed * 1.0, MAX_VELOCITY * 0.9);
      
      // Calculate initial velocities with more randomness
      const vx = Math.cos(angle) * initialSpeed;
      const vy = Math.sin(angle) * initialSpeed;
      
      // Start position - more centered with slight randomness
      const xPos = canvas.width / 2 + (Math.random() - 0.5) * (canvas.width * 0.3);
      const yPos = canvas.height / 2 + (Math.random() - 0.5) * (canvas.height * 0.3);
      
      // Generate a random pastel color
      const hue = Math.floor(Math.random() * 360);
      const color = `hsl(${hue}, 70%, 80%)`;
      
      // Choisir une image en fonction de l'assignation
      let image = null;
      let imageIndex = -1;
      
      if (useCustomImages && loadedImages.length > 0) {
        if (assignedImageIndex >= 0 && assignedImageIndex < loadedImages.length) {
          // Utiliser l'image assignée
          image = loadedImages[assignedImageIndex];
          imageIndex = assignedImageIndex;
        } else {
          // Sinon, choisir une image aléatoire
          const randomIndex = Math.floor(Math.random() * loadedImages.length);
          image = loadedImages[randomIndex];
          imageIndex = randomIndex;
        }
      }
      
      // Assign a music scale if music is enabled
      let musicScale: MusicScaleKey | CustomMusicKey | undefined = undefined;
      
      if (musicEnabled && imageIndex >= 0) {
        const scaleKey = ballMusicAssignments[imageIndex];
        if (scaleKey) {
          // Check if it's a standard scale from MUSIC_SCALES
          if (Object.keys(MUSIC_SCALES).includes(scaleKey)) {
            musicScale = scaleKey as MusicScaleKey;
          } else {
            // It must be a custom scale
            musicScale = scaleKey;
          }
        } else {
          // Select a random scale from standard scales
          const scaleKeys = Object.keys(MUSIC_SCALES) as MusicScaleKey[];
          musicScale = scaleKeys[Math.floor(Math.random() * scaleKeys.length)];
        }
      }
      
      initialBalls.push({
        id: Math.random().toString(36).substr(2, 9),
        position: {
          x: xPos,
          y: yPos
        },
        velocity: { x: vx, y: vy },
        radius: 15,
        color,
        pulseEffect: 0,
        glowSize: 1.5,
        glowOpacity: 0.7,
        squash: 0,
        rotation: 0,
        score: 0,
        image,
        lastCollisionTime: 0,
        imageIndex,
        musicScale,
        mass: 15 * 0.5,
        elasticity: 0.7 + Math.random() * 0.2,
        angularVelocity: (Math.random() - 0.5) * 0.1,
        initialSpeed: initialSpeed  // NOUVEAU: Stocker la vitesse initiale
      });
    }
    
    setGameState({
      balls: initialBalls,
      score: 0,
      gameOver: false
    });
    
    setBackgroundBrightness(0);
    lastRandomForceTime.current = 0;
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
    };
  }, [isPlaying, ballSpeed, initialBallCount, ballCount, useCustomImages, loadedImages, ballImageAssignments, musicEnabled, ballMusicAssignments]);
  
  // Fonction améliorée pour créer une balle avec trajectoire plus prévisible
  const createRealisticBall = (
    event: React.MouseEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
    currentBalls: EnhancedBall[],
    ballSpeed: number,
    useCustomImages: boolean,
    loadedImages: HTMLImageElement[],
    customImageIndex: number = -1,
    musicScale?: MusicScaleKey | CustomMusicKey
    ): EnhancedBall => {
    const { left, top } = canvas.getBoundingClientRect();
    const x = event.clientX - left;
    const y = event.clientY - top;
    
    // Générer un angle de lancement plus naturel
    // Privilégier les angles latéraux pour un mouvement plus naturel
    const angleBase = Math.random() > 0.5 ? Math.PI / 4 : (Math.PI * 3) / 4;
    const angleVariation = (Math.random() - 0.5) * Math.PI / 3;
    const angle = angleBase + angleVariation;
    
    // Vitesse initiale plus modérée mais variable
    const speedFactor = 0.7 + Math.random() * 0.6; // 70% à 130% de la vitesse de base
    const speed = ballSpeed * speedFactor;
    
    // Calculer les composantes de vitesse
    const vx = Math.cos(angle) * speed;
    // Composante verticale légèrement plus faible pour un lancement plus naturel
    const vy = Math.sin(angle) * speed * 0.8;
    
    // NOUVEAU: Calculer la vitesse initiale pour référence
    const initialSpeed = Math.sqrt(vx * vx + vy * vy);
    
    // Initialiser les autres paramètres
    const initialRadius = 10 + Math.random() * 5;
    const hue = Math.floor(Math.random() * 360);
    const saturation = 70 + Math.floor(Math.random() * 30);
    const lightness = 50 + Math.floor(Math.random() * 20);
    
    // Gérer l'image
    let image = null;
    let imageIndex = -1;
    
    if (useCustomImages && loadedImages.length > 0) {
      if (customImageIndex >= 0 && customImageIndex < loadedImages.length) {
        imageIndex = customImageIndex;
        image = loadedImages[customImageIndex];
      } else {
        imageIndex = Math.floor(Math.random() * loadedImages.length);
        image = loadedImages[imageIndex];
      }
    }
    
    // Créer la balle avec des propriétés réalistes
    const ball: EnhancedBall = {
      id: Math.random().toString(36).substr(2, 9),
      position: { x, y },
      velocity: { x: vx, y: vy },
      radius: initialRadius,
      color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      pulseEffect: 0,
      glowSize: 0,
      glowOpacity: 0.7,
      squash: 1,
      rotation: 0,
      score: 0,
      image,
      imageIndex,
      growing: true,
      lastCollisionTime: 0,
      musicScale,
      mass: initialRadius * 0.5,
      elasticity: 0.7 + Math.random() * 0.2,
      angularVelocity: (Math.random() - 0.5) * 0.1,
      initialSpeed: initialSpeed  // NOUVEAU: Stocker la vitesse initiale
    };
    
    return ball;
  };
  
  // Add function to play ball-specific sound
  const playBallSpecificSound = useCallback((volume: number, ballIndex?: number) => {
    if (useCustomSounds && ballIndex !== undefined && loadedSounds[ballIndex]?.length > 0) {
      // Get random sound for this ball type
      const ballSounds = loadedSounds[ballIndex];
      const randomSound = ballSounds[Math.floor(Math.random() * ballSounds.length)];
      
      if (randomSound) {
        randomSound.volume = Math.min(0.8, volume);
        randomSound.currentTime = 0;
        randomSound.play().catch(err => console.log('Sound play error:', err));
      }
    } else {
      // Fall back to default sound
      playBounceSound(volume, false);
    }
  }, [useCustomSounds, loadedSounds]);
  
  // Game loop with improved physics
  useEffect(() => {
    // Skip animation if game is not playing or game is over
    if (!isPlaying || gameState.gameOver) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Optimisation: configuration initiale du contexte pour une meilleure qualité
    const setupHighQualityContext = () => {
      const pixelRatio = window.devicePixelRatio || 1;
      
      // Configurer le contexte pour une haute qualité
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Configurer les dimensions basées sur le pixel ratio
      canvas.width = canvas.clientWidth * pixelRatio;
      canvas.height = canvas.clientHeight * pixelRatio;
      
      // Ajuster l'échelle pour compenser le pixel ratio
      ctx.scale(pixelRatio, pixelRatio);
    };
    
    // Configurer le contexte une fois
    setupHighQualityContext();
    
    // Dimensions et coordonnées pour le jeu
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;
    const circleRadius = Math.min(displayWidth, displayHeight) * 0.4;
    
    let lastTimestamp: number | null = null;
    
    // Version optimisée de la fonction d'animation
    const animate = (timestamp: number) => {
      if (!canvas || !ctx) return;
      
      // Calculer delta time pour des animations plus fluides
      const deltaTime = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 16.67, 3) : 1;
      lastTimestamp = timestamp;
      
      // Effacer le canvas (utiliser les dimensions d'affichage, pas les dimensions du canvas)
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      
      // Dessiner l'arrière-plan
      const bgGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, displayWidth > displayHeight ? displayWidth : displayHeight
      );
      bgGradient.addColorStop(0, `hsla(0, 0%, ${backgroundBrightness + 10}%, 1)`);
      bgGradient.addColorStop(1, `hsla(0, 0%, ${backgroundBrightness}%, 1)`);
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      
      // Dessiner le cercle extérieur
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 100, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      
      if (effectsEnabled) {
        ctx.shadowColor = 'rgba(255, 100, 0, 0.5)';
        ctx.shadowBlur = 15;
        ctx.stroke();
      }
      
      ctx.restore();
      
      // Diminuer la luminosité de l'arrière-plan progressivement
      if (bgEffectsEnabled) {
        setBackgroundBrightness(prev => Math.max(0, prev - 0.2));
      }
      
      // Suivi des changements d'état du jeu
      let totalScoreIncrement = 0;
      let gameOverDetected = false;
      
      // Appliquer les forces aléatoires moins fréquemment
      let updatedBalls = [...gameState.balls];
      
      if (timestamp - lastRandomForceTime.current > RANDOM_FORCE_INTERVAL) {
        lastRandomForceTime.current = timestamp;
        updatedBalls = updatedBalls.map(ball => {
          // Appliquer une force aléatoire seulement sur 10% des balles pour réduire le chaos
          if (Math.random() > 0.9) {
            const angle = Math.random() * Math.PI * 2;
            const forceX = Math.cos(angle) * RANDOM_FORCE_MAGNITUDE;
            const forceY = Math.sin(angle) * RANDOM_FORCE_MAGNITUDE;
            
            return {
              ...ball,
              velocity: {
                x: ball.velocity.x + forceX,
                y: ball.velocity.y + forceY
              }
            };
          }
          return ball;
        });
      }
      
      // Mettre à jour les positions des balles avec une physique améliorée
      updatedBalls = updatedBalls.map((enhancedBall) => {
        const ball = enhancedBall as EnhancedBall;
        
        // Appliquer la résistance de l'air (réduite pour conserver l'énergie)
        let newVx = ball.velocity.x * AIR_RESISTANCE;
        let newVy = ball.velocity.y * AIR_RESISTANCE;
        
        // Appliquer la gravité avec scaling basé sur le deltaTime pour un mouvement plus fluide
        newVy += (gravity * GRAVITY_SCALING * deltaTime);
        
        // MODIFICATION: Appliquer un amortissement minimal pour maintenir l'énergie
        newVx *= VELOCITY_DAMPING;
        newVy *= VELOCITY_DAMPING;
        
        // NOUVEAU: Vérifier si la balle ralentit et conserver sa vitesse
        const currentSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
        const initialSpeed = ball.initialSpeed || Math.sqrt(
          ball.velocity.x * ball.velocity.x + 
          ball.velocity.y * ball.velocity.y
        );
        
        // Si la vitesse est trop basse par rapport à la vitesse initiale, l'augmenter
        if (currentSpeed < initialSpeed * 0.85) {
          const boostFactor = Math.min(1.1, initialSpeed / currentSpeed * 0.9);
          newVx *= boostFactor;
          newVy *= boostFactor;
        }
        
        // Mettre à jour la position avec le mouvement
        let newPosition = {
          x: ball.position.x + (newVx * deltaTime),
          y: ball.position.y + (newVy * deltaTime)
        };
        
        // Effets visuels
        let newPulseEffect = ball.pulseEffect ? ball.pulseEffect * 0.9 : 0;
        let newGlowSize = ball.glowSize ? Math.max(1.5, ball.glowSize * 0.95) : 1.5;
        let newGlowOpacity = ball.glowOpacity ? Math.max(0.7, ball.glowOpacity * 0.98) : 0.7;
        
        // Suivi du score
        let newScore = ball.score || 0;
        let lastCollisionTime = ball.lastCollisionTime || 0;
        let currentScoreIncrement = 0;
        
        // Détection de collision avec les limites du cercle avec un délai
        const distanceFromCenter = Math.sqrt(
          Math.pow(newPosition.x - centerX, 2) + 
          Math.pow(newPosition.y - centerY, 2)
        );
        
        const isColliding = distanceFromCenter + ball.radius >= circleRadius - WALL_PADDING;
        const canCollideNow = timestamp - lastCollisionTime > COLLISION_THRESHOLD * 1000;
        
        // Gérer les collisions de manière plus contrôlée
        if (isColliding && canCollideNow) {
          // Utiliser la fonction handleCollision pour une physique plus stable
          const collisionResult = handleCollision(
            ball,
            newPosition,
            newVx,
            newVy,
            centerX,
            centerY,
            circleRadius,
            timestamp
          );
          
          newPosition = collisionResult.position;
          newVx = collisionResult.velocity.x;
          newVy = collisionResult.velocity.y;
          lastCollisionTime = collisionResult.lastCollisionTime;
          
          // Effets sonores et visuels lors de la collision
          if (effectsEnabled) {
            if (standardSoundsEnabled) {
              playGrowSound(ball.radius / 50 * bounceVolume, useCustomSounds);
            }
            
            const impactSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
            const volume = Math.min(1.0, impactSpeed / 10) * bounceVolume;
            
            if (useCustomSounds && ball.imageIndex !== undefined) {
              playBallSpecificSound(volume, ball.imageIndex);
            } else if (standardSoundsEnabled) {
              playBounceSound(volume, useCustomSounds);
            }
            
            newPulseEffect = Math.min(1.0, impactSpeed / 10);
            newGlowSize = 2.0 + (impactSpeed * 0.05);
            newGlowOpacity = Math.min(0.9, 0.7 + (impactSpeed * 0.02));
          }
            
          // Effets d'arrière-plan
            if (bgEffectsEnabled) {
            const impactSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
              const brightnessIncrease = Math.min(DEFAULT_BRIGHTNESS_INCREASE * 2, impactSpeed);
              setBackgroundBrightness(prev => Math.min(prev + brightnessIncrease, 50));
            }
            
          // Mise à jour du score basée sur la vitesse d'impact
            if (scoreTrackingEnabled) {
            const impactSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
            currentScoreIncrement = Math.max(1, Math.floor(impactSpeed / 3));
            newScore += currentScoreIncrement;
            totalScoreIncrement += currentScoreIncrement;
          }
          
          // Vérifier la condition de fin de jeu
            if (ball.radius >= circleRadius * 0.9) {
              playGameOverSound();
            gameOverDetected = true;
          }
          
          // Gestion des sons musicaux
            if (musicEnabled && effectsEnabled) {
            const impactSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
            const volume = Math.min(1.0, impactSpeed / 10) * bounceVolume;
            
            if (ball.musicScale && ball.id) {
              if (ball.imageIndex !== undefined && ballMusicAssignments[ball.imageIndex]) {
                setBallMusicScale(ball.id, ballMusicAssignments[ball.imageIndex]);
              } else if (!ball.musicScale) {
                setBallMusicScale(ball.id, ball.musicScale);
              }
              
              playBallMusicNote(ball.id, volume, impactSpeed);
            }
          }
          
          // Sons progressifs
            if (progressiveSoundEnabled && onBallCollision) {
            const impactSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
            const volume = Math.min(1.0, impactSpeed / 10) * bounceVolume;
              onBallCollision(volume);
            }
            
            // Sons extraits
            if (extractedMusicEnabled) {
            const impactSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
              const volume = Math.min(1.0, impactSpeed / 10);
              playNextExtractedNote(volume);
            }
            
            return {
            ...ball,
              position: newPosition,
              velocity: { x: newVx, y: newVy },
              pulseEffect: effectsEnabled ? newPulseEffect : 0,
              glowSize: effectsEnabled ? newGlowSize : 1,
              glowOpacity: effectsEnabled ? newGlowOpacity : 0,
              score: newScore,
              lastCollisionTime
            };
          } else if (isColliding) {
          // Si nous sommes en collision mais que le délai n'est pas écoulé,
          // corriger simplement la position pour éviter la pénétration
            const angle = Math.atan2(newPosition.y - centerY, newPosition.x - centerX);
          const correctedRadius = circleRadius - ball.radius - WALL_PADDING;
            
            newPosition = {
              x: centerX + Math.cos(angle) * correctedRadius,
              y: centerY + Math.sin(angle) * correctedRadius
            };
          }
          
          // Rotation de la balle pour plus de réalisme (si la propriété existe)
          const newRotation = ball.rotation !== undefined 
            ? ball.rotation + (ball.angularVelocity || 0) * deltaTime 
            : 0;
          
          return {
          ...ball,
            position: newPosition,
            velocity: { x: newVx, y: newVy },
            pulseEffect: effectsEnabled ? newPulseEffect : 0,
            glowSize: effectsEnabled ? newGlowSize : 1,
            glowOpacity: effectsEnabled ? newGlowOpacity : 0,
            score: newScore,
            lastCollisionTime,
            rotation: newRotation,
            initialSpeed: ball.initialSpeed || initialSpeed  // Stocker la vitesse initiale pour référence
        };
      });
      
      // Mettre à jour l'état du jeu
      if (totalScoreIncrement > 0 || gameOverDetected) {
        setGameState(prevState => ({
          ...prevState,
          balls: updatedBalls,
          score: prevState.score + totalScoreIncrement,
          gameOver: gameOverDetected ? true : prevState.gameOver
        }));
        
        if (gameOverDetected && onGameOver) {
          onGameOver();
        }
      } else {
        setGameState(prevState => ({
          ...prevState,
          balls: updatedBalls
        }));
      }
        
      // Dessiner les balles avec rotation pour plus de réalisme
        updatedBalls.forEach(ball => {
          const enhancedBall = ball as EnhancedBall;
          
        // Dessiner l'effet de lueur si activé
          if (effectsEnabled) {
          // Extraire les valeurs HSL de la couleur
            const colorMatch = enhancedBall.color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
            let hue = 0, saturation = 70, lightness = 80;
            
            if (colorMatch && colorMatch.length >= 4) {
              hue = parseInt(colorMatch[1]);
              saturation = parseInt(colorMatch[2]);
              lightness = parseInt(colorMatch[3]);
            }
          
          // Créer un dégradé pour l'effet de lueur
          const glowSize = enhancedBall.glowSize || 1.5;
          const glowOpacity = enhancedBall.glowOpacity || 0.7;
          
          const gradient = ctx.createRadialGradient(
            enhancedBall.position.x, enhancedBall.position.y, 0,
            enhancedBall.position.x, enhancedBall.position.y, enhancedBall.radius * glowSize
          );
            
            gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${Math.min(lightness + 15, 100)}%, ${glowOpacity + 0.1})`);
            gradient.addColorStop(0.5, `hsla(${hue}, ${saturation}%, ${lightness}%, ${glowOpacity})`);
            gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
            
            ctx.beginPath();
            ctx.arc(
              enhancedBall.position.x,
              enhancedBall.position.y,
              enhancedBall.radius * glowSize,
              0,
              Math.PI * 2
            );
            ctx.fillStyle = gradient;
            ctx.fill();
          }
          
        // Dessiner la balle
        const pulseEffect = enhancedBall.pulseEffect || 0;
          const pulseScale = effectsEnabled ? (1 + (pulseEffect * 0.2)) : 1;
        
          ctx.save();
          
          ctx.beginPath();
          ctx.arc(
            enhancedBall.position.x,
            enhancedBall.position.y,
            enhancedBall.radius * pulseScale,
            0,
            Math.PI * 2
          );
          
          if (effectsEnabled) {
            ctx.shadowColor = enhancedBall.color;
            ctx.shadowBlur = 20 * pulseEffect;
          }
          
          if (useCustomImages && enhancedBall.image) {
            ctx.clip();
            const imgSize = enhancedBall.radius * 2 * pulseScale;
          
          // Activer l'interpolation pour une meilleure qualité d'image
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
            ctx.drawImage(
              enhancedBall.image, 
              enhancedBall.position.x - imgSize/2, 
              enhancedBall.position.y - imgSize/2, 
              imgSize, 
              imgSize
            );
            ctx.globalCompositeOperation = 'source-over';
          } else {
            ctx.fillStyle = enhancedBall.color;
            ctx.fill();
            
            if (effectsEnabled) {
              ctx.globalCompositeOperation = 'overlay';
              ctx.beginPath();
              ctx.arc(
                enhancedBall.position.x - enhancedBall.radius * 0.3,
                enhancedBall.position.y - enhancedBall.radius * 0.3,
                enhancedBall.radius * 0.5,
                0,
                Math.PI * 2
              );
              ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
              ctx.fill();
              ctx.globalCompositeOperation = 'source-over';
            }
          }
          
        // Dessiner le contour avec une qualité améliorée
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
          ctx.strokeStyle = effectsEnabled ? 
            `rgba(255, 255, 255, ${0.8 + pulseEffect * 0.2})` : 
            'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = effectsEnabled ? 2 : 1;
          ctx.beginPath();
          ctx.arc(
            enhancedBall.position.x,
            enhancedBall.position.y,
            enhancedBall.radius,
            0,
            Math.PI * 2
          );
          ctx.stroke();
          
        // Dessiner le score avec une meilleure qualité de texte
          if (scoreTrackingEnabled && enhancedBall.score) {
          // Calculer la taille de police optimale basée sur le rayon
          const fontSize = Math.max(14, Math.min(enhancedBall.radius/2, 24));
          
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          
          // Ajouter un contour noir pour améliorer la lisibilité
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.lineWidth = 3;
          ctx.strokeText(
            enhancedBall.score.toString(), 
            enhancedBall.position.x, 
            enhancedBall.position.y
          );
          
            ctx.fillStyle = 'white';
            ctx.fillText(
              enhancedBall.score.toString(), 
              enhancedBall.position.x, 
              enhancedBall.position.y
            );
          }
          
          ctx.restore();
        });
        
      // Continuer l'animation si le jeu n'est pas terminé
        if (!gameState.gameOver) {
          requestRef.current = requestAnimationFrame(animate);
        }
      };
      
    // Démarrer l'animation
      requestRef.current = requestAnimationFrame(animate);
      
    // Nettoyer lors du démontage
      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
          requestRef.current = undefined;
        }
      };
    }, [
    gameState, 
    isPlaying, 
    ballSpeed, 
    effectsEnabled, 
    ballCollisionsEnabled, 
    scoreTrackingEnabled, 
    bgEffectsEnabled, 
    useCustomImages, 
    useCustomSounds, 
    loadedSounds, 
    playBallSpecificSound,
    musicEnabled, 
    ballMusicAssignments, 
    progressiveSoundEnabled, 
    onBallCollision, 
    extractedMusicEnabled,
    gravity, 
    growthRate, 
    bounciness, 
    standardSoundsEnabled,
    bounceVolume
    ]);
  
  // Setup canvas dimensions
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const handleResize = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      
      // Obtenir les dimensions du conteneur parent
      const container = canvas.parentElement;
      if (!container) return;
      
      // Obtenir la taille du conteneur
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // Appliquer un facteur de pixel ratio pour les écrans haute densité
      const pixelRatio = window.devicePixelRatio || 1;
      
      // Définir la taille du canvas en tenant compte du pixel ratio pour une meilleure netteté
      canvas.width = containerWidth * pixelRatio;
      canvas.height = containerHeight * pixelRatio;
      
      // Maintenir la taille d'affichage (CSS) comme avant
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;
      
      // Appliquer l'échelle au contexte pour compenser le pixel ratio
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(pixelRatio, pixelRatio);
        
        // Utiliser des fonctions pour améliorer la netteté du texte
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }
    };
    
    // Appliquer le redimensionnement immédiatement
    handleResize();
    
    // Écouter les changements de taille de fenêtre
    window.addEventListener('resize', handleResize);
    
    // Nettoyer l'écouteur d'événement lors du démontage
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
    };
  }, []);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPlaying || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Find the closest ball to start growing
    let closestBall: EnhancedBall | null = null;
    let closestDistance = Infinity;
    
    for (const ball of gameState.balls) {
      const dx = ball.position.x - mouseX;
      const dy = ball.position.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestBall = ball;
      }
    }
    
    // Start growing the closest ball
    if (closestBall) {
      closestBall.growing = true;
    }
  };

  const handleMouseUp = () => {
    // Stop growing all balls
    for (const ball of gameState.balls) {
      const enhancedBall = ball as EnhancedBall;
      enhancedBall.growing = false;
    }
  };

  // Toggle recording with audio capture
  const toggleRecording = () => {
    // Assurez-vous que le contexte audio est activé avant l'enregistrement 
    // (les navigateurs nécessitent une interaction utilisateur)
    const context = getSoundAudioContext();
    if (context && context.state === 'suspended') {
      context.resume().then(() => {
        console.log('Audio context resumed for recording');
      });
    }
    
    if (isRecording) {
      stopRecording().then(blob => {
        if (blob) {
          console.log('Recording stopped, blob size:', blob.size);
        }
      });
    } else {
      if (canvasRef.current) {
        // Use higher quality and bitrate for recording with audio capture
        startRecording(canvasRef.current, 60000, {
          frameRate: 60,
          videoBitsPerSecond: 5000000, // 5 Mbps
          captureAudio: true // Enable audio capture
        });
      }
    }
  };

  const handleDownloadVideo = () => {
    downloadGameplayVideo(`tiktok-game-${new Date().getTime()}.webm`);
  };

  // Fonction pour créer un effet visuel sur le canvas lors des collisions
  const performCanvasEffect = (canvas: HTMLCanvasElement) => {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Sauvegarder l'état actuel du contexte
    ctx.save();
    
    // Appliquer un effet de flash
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Restaurer l'état du contexte
    ctx.restore();
    
    // Effacer l'effet après un court délai
    setTimeout(() => {
      if (!canvasRef.current) return;
      const gameLoop = () => {}; // Dummy function to make TypeScript happy
      gameLoop(); // Force redraw
    }, 50);
  };

  // Améliorer le traitement des collisions sans changer les constantes de base
  const handleCollision = (
    ball: EnhancedBall,
    newPosition: { x: number, y: number },
    newVx: number,
    newVy: number,
    centerX: number,
    centerY: number,
    circleRadius: number,
    timestamp: number
  ) => {
    // Calculer l'angle d'impact
    const angle = Math.atan2(newPosition.y - centerY, newPosition.x - centerX);
    
    // Corriger la position pour éviter le chevauchement avec la limite
    const correctedRadius = circleRadius - ball.radius - WALL_PADDING;
    const correctedPosition = {
      x: centerX + Math.cos(angle) * correctedRadius,
      y: centerY + Math.sin(angle) * correctedRadius
    };
    
    // Vecteur normal à la surface d'impact (pointant vers l'intérieur)
    const nx = -Math.cos(angle);
    const ny = -Math.sin(angle);
    
    // Calculer la vitesse d'impact
    const impactSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
    
    // Calculer l'angle d'incidence (0 = perpendiculaire, 1 = tangentiel)
    const dotProduct = newVx * nx + newVy * ny;
    const incidenceAngle = Math.abs(dotProduct) / impactSpeed;
    
    // Appliquer une friction plus faible pour les impacts rasants
    const grazingFriction = 1 - (0.02 * (1 - incidenceAngle)); // MODIFIÉ: Moins de perte par friction
    
    // MODIFICATION: Augmenter l'énergie conservée pour des rebonds plus dynamiques
    // Conservation presque parfaite de l'énergie + un léger boost pour compenser d'autres pertes
    const bouncinessBoost = 1.0 + (bounciness * 0.3); // Jusqu'à 30% d'énergie supplémentaire
    const energyRetained = Math.min(1.05, bounciness * grazingFriction * bouncinessBoost);
    
    // Calculer les nouvelles composantes de vitesse avec l'énergie accrue
    const newVelocityX = (newVx - 2 * dotProduct * nx) * energyRetained;
    const newVelocityY = (newVy - 2 * dotProduct * ny) * energyRetained;
    
    // NOUVEAU: Conserver la norme de la vitesse initiale
    const initialSpeed = ball.initialSpeed || impactSpeed;
    const newSpeed = Math.sqrt(newVelocityX * newVelocityX + newVelocityY * newVelocityY);
    
    // Si la nouvelle vitesse est trop basse, la booster vers la vitesse initiale
    let finalVx = newVelocityX;
    let finalVy = newVelocityY;
    
    if (newSpeed < initialSpeed * 0.95) {
      const velocityBoost = Math.min(1.05, initialSpeed / newSpeed * 0.95);
      finalVx *= velocityBoost;
      finalVy *= velocityBoost;
    }
    
    // Jouer une note MIDI lors de la collision avec le mur circulaire
    if (midiEnabled && hasMIDISequence()) {
      // Force l'appel MIDI directement ici pour s'assurer qu'il est déclenché
      const midiVolumeAdjusted = Math.min(1.0, Math.max(0.4, impactSpeed / 8)) * (midiVolume || 0.7);
      // Déclencher immédiatement la note MIDI
      playMIDINote(midiVolumeAdjusted);
      
      // Pour les collisions plus fortes, jouer une note supplémentaire
      if (impactSpeed > 4) {
        setTimeout(() => {
          playMIDINote(midiVolumeAdjusted * 0.7);
        }, 100);
      }
    }
    
    return {
      position: correctedPosition,
      velocity: { x: finalVx, y: finalVy },
      lastCollisionTime: timestamp
    };
  };

  // Améliorer la gestion des collisions avec les murs
  const handleWallCollision = (ball: Ball, canvasWidth: number, canvasHeight: number, bounceVolume: number) => {
    let collision = false;
    let collisionIntensity = 0;
    let wallType = ''; // Pour identifier quel mur a été touché
    
    // Stocker la vitesse initiale pour référence si elle n'existe pas déjà
    const initialSpeed = (ball as EnhancedBall).initialSpeed || Math.sqrt(
      ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y
    );
    (ball as EnhancedBall).initialSpeed = initialSpeed;
    
    // Collision avec le mur droit
    if (ball.position.x + ball.radius > canvasWidth) {
      // Corriger la position pour éviter l'interpénétration
      ball.position.x = canvasWidth - ball.radius;
      
      // MODIFICATION: Conservation presque parfaite de l'énergie
      const speedSqr = ball.velocity.x * ball.velocity.x;
      const boostFactor = 1.0 + (bounciness * 0.25); // Jusqu'à 25% d'énergie supplémentaire
      const energyRetained = Math.min(1.05, (bounciness - 0.01 * (speedSqr / 100)) * boostFactor);
      
      // Inverser la vitesse horizontale avec moins de perte d'énergie
      ball.velocity.x = -ball.velocity.x * energyRetained;
      
      // Ajouter une légère poussée aléatoire pour éviter les mouvements trop linéaires
      if (Math.abs(ball.velocity.y) < 1.0) {
        ball.velocity.y += (Math.random() - 0.3) * 0.7 * bounciness; // Plus de poussée vers le haut
      } else {
        ball.velocity.y += (Math.random() - 0.5) * 0.2;
      }
      
      collision = true;
      collisionIntensity = Math.abs(ball.velocity.x);
      wallType = 'right';
      
      // Jouer MIDI lorsque la balle touche un mur
      if (midiEnabled && hasMIDISequence()) {
        // Forcer l'appel MIDI ici aussi pour les collisions avec les murs
        const midiVolumeAdjusted = Math.min(1.0, Math.max(0.4, collisionIntensity / 8)) * (midiVolume || 0.7);
        playMIDINote(midiVolumeAdjusted);
      }
    }
    
    // Collision avec le mur gauche
    if (ball.position.x - ball.radius < 0) {
      // Corriger la position
      ball.position.x = ball.radius;
      
      // MODIFICATION: Conservation presque parfaite de l'énergie
      const speedSqr = ball.velocity.x * ball.velocity.x;
      const boostFactor = 1.0 + (bounciness * 0.25);
      const energyRetained = Math.min(1.05, (bounciness - 0.01 * (speedSqr / 100)) * boostFactor);
      
      // Inverser la vitesse horizontale avec moins de perte d'énergie
      ball.velocity.x = -ball.velocity.x * energyRetained;
      
      // Ajouter une légère poussée aléatoire
      if (Math.abs(ball.velocity.y) < 1.0) {
        ball.velocity.y += (Math.random() - 0.3) * 0.7 * bounciness; // Plus de poussée vers le haut
      } else {
        ball.velocity.y += (Math.random() - 0.5) * 0.2;
      }
      
      collision = true;
      collisionIntensity = Math.abs(ball.velocity.x);
      wallType = 'left';
      
      // Jouer MIDI pour le mur gauche aussi
      if (midiEnabled && hasMIDISequence()) {
        const midiVolumeAdjusted = Math.min(1.0, Math.max(0.4, collisionIntensity / 8)) * (midiVolume || 0.7);
        playMIDINote(midiVolumeAdjusted);
      }
    }
    
    // Collision avec le sol
    if (ball.position.y + ball.radius > canvasHeight) {
      // Corriger la position
      ball.position.y = canvasHeight - ball.radius;
      
      // Rebond au sol avec plus d'absorption d'énergie et friction accrue
      // Seulement rebondir si la vitesse est significative
      if (Math.abs(ball.velocity.y) > 0.3) {
        // MODIFICATION: Boost similaire mais un peu plus faible pour le sol
        const speedSqr = ball.velocity.y * ball.velocity.y;
        const boostFactor = 1.0 + (bounciness * 0.2); // 20% d'énergie supplémentaire
        const energyRetained = Math.min(1.15, (bounciness - 0.05 * (speedSqr / 100)) * boostFactor);
        
        ball.velocity.y = -ball.velocity.y * energyRetained;
        
        // Appliquer une friction horizontale réduite pour maintenir le mouvement
        ball.velocity.x *= (1 - (DEFAULT_FRICTION * 0.8));
        
        collision = true;
        collisionIntensity = Math.abs(ball.velocity.y);
        wallType = 'floor';
        
        // Jouer MIDI pour le sol aussi
        if (midiEnabled && hasMIDISequence()) {
          const midiVolumeAdjusted = Math.min(1.0, Math.max(0.4, collisionIntensity / 8)) * (midiVolume || 0.7);
          playMIDINote(midiVolumeAdjusted);
        }
      } else {
        // Si la vitesse est très faible, "coller" au sol
        ball.velocity.y = 0;
        // Appliquer une friction horizontale plus faible pour garder du mouvement
        ball.velocity.x *= (1 - (DEFAULT_FRICTION * 2.5));
      }
    }
    
    // Collision avec le plafond
    if (ball.position.y - ball.radius < 0) {
      // Corriger la position
      ball.position.y = ball.radius;
      
      // MODIFICATION: Boost similaire aux murs latéraux
      const speedSqr = ball.velocity.y * ball.velocity.y;
      const boostFactor = 1.0 + (bounciness * 0.25);
      const energyRetained = Math.min(1.2, (bounciness - 0.03 * (speedSqr / 100)) * boostFactor);
      
      // Inverser la vitesse verticale avec moins de perte d'énergie
      ball.velocity.y = -ball.velocity.y * energyRetained;
      
      // Léger ajustement horizontal
      ball.velocity.x += (Math.random() - 0.5) * 0.2;
      
      collision = true;
      collisionIntensity = Math.abs(ball.velocity.y);
      wallType = 'ceiling';
      
      // Jouer MIDI pour le plafond aussi
      if (midiEnabled && hasMIDISequence()) {
        const midiVolumeAdjusted = Math.min(1.0, Math.max(0.4, collisionIntensity / 8)) * (midiVolume || 0.7);
        playMIDINote(midiVolumeAdjusted);
      }
    }
    
    // Si une collision s'est produite, jouer des sons et effets
    if (collision && collisionIntensity > 0.3) {
      const now = Date.now();
      // Ne jouer le son que si le dernier rebond date d'un certain temps
      if (now - (ball as EnhancedBall).lastCollisionTime! > 150) {
        // Volume en fonction de l'intensité de la collision - uniquement pour le son de rebond
        const bounceVolumeAdjusted = Math.min(0.7, Math.max(0.2, collisionIntensity / 10)) * bounceVolume;
        
        // Volume pour les autres sons, sans être affecté par bounceVolume
        const otherSoundsVolume = Math.min(0.7, Math.max(0.2, collisionIntensity / 10));
        
        // Jouer le son de rebond standard si activé (avec bounceVolume)
        if (standardSoundsEnabled) {
          playBounceSound(bounceVolumeAdjusted);
        }
        
        // Jouer plusieurs segments de son progressif lors d'une collision avec un mur
        // Utilise progressiveSoundVolume au lieu de bounceVolume
        if (progressiveSoundEnabled && hasProgressiveSound()) {
          // Calculer le nombre de segments à jouer en fonction de l'intensité 
          // de la collision et de la vitesse de la balle
          const speed = Math.sqrt(ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y);
          const segmentsToPlay = Math.min(4, Math.max(2, Math.floor(collisionIntensity / 4)));
          
          // Jouer le premier segment immédiatement avec le volume progressif (non affecté par bounceVolume)
          playNextProgressiveSoundPart(progressiveSoundVolume);
          
          // Jouer les segments supplémentaires avec un court délai entre chacun
          // et un volume décroissant, toujours basé sur progressiveSoundVolume
          for (let i = 1; i < segmentsToPlay; i++) {
            setTimeout(() => {
              // Réduire le volume progressivement pour chaque segment suivant
              const fadeVolume = progressiveSoundVolume * (1 - i * 0.2);
              playNextProgressiveSoundPart(fadeVolume);
            }, i * 180); // Légèrement plus de délai entre les segments pour une meilleure perception
          }
        }
        
        // CORRECTION: Appel renforcé pour jouer MIDI
        // Jouer une note MIDI si le mode MIDI est activé - appel direct ici aussi
        if (midiEnabled && hasMIDISequence()) {
          // Ajuster le volume en fonction de l'intensité de la collision
          const midiVolumeAdjusted = Math.min(1.0, Math.max(0.3, collisionIntensity / 8)) * (midiVolume || 0.7);
          
          // Console log pour débogage
          console.log("Tentative de jouer MIDI:", midiEnabled, midiVolumeAdjusted, collisionIntensity);
          
          // Jouer la note MIDI
          playMIDINote(midiVolumeAdjusted);
          
          // Pour les collisions plus fortes, jouer une note supplémentaire avec délai
          if (collisionIntensity > 1.2) {
            setTimeout(() => {
              playMIDINote(midiVolumeAdjusted * 0.6);
            }, 150);
          }
        }
        
        // Si la musique extraite est activée, jouer aussi une note (avec son propre volume)
        if (extractedMusicEnabled) {
          playNextExtractedNote(otherSoundsVolume);
          
          // Ajouter une deuxième note avec délai pour plus de richesse sonore
          if (collisionIntensity > 0.8) {
            setTimeout(() => {
              playNextExtractedNote(otherSoundsVolume * 0.7);
            }, 200);
          }
        }
        
        // Si la musique de balle est activée, jouer une note de la gamme musicale assignée (avec son propre volume)
        if (musicEnabled && (ball as EnhancedBall).musicScale) {
          playBallMusicNote(ball.id, otherSoundsVolume, collisionIntensity);
        }
        
        // Appeler le callback de collision s'il existe
        // Passer le progressiveSoundVolume plutôt que le bounceVolume
        if (onBallCollision) {
          onBallCollision(progressiveSoundVolume);
        }
        
        // Mettre à jour le temps de la dernière collision
        (ball as EnhancedBall).lastCollisionTime = now;
        
        // Ajouter un effet visuel plus important pour les collisions à haute vitesse
        if (effectsEnabled && collisionIntensity > 1.5) {
          (ball as EnhancedBall).pulseEffect = Math.min(1.0, collisionIntensity / 8);
          
          if (bgEffectsEnabled) {
            // Augmenter la luminosité de l'arrière-plan en fonction de l'intensité
            setBackgroundBrightness(prev => Math.min(prev + collisionIntensity * 1.5, 40));
          }
        }
      }
    }
    
    // Limiter les vitesses pour éviter les comportements erratiques après une collision
    const speed = Math.sqrt(
      ball.velocity.x * ball.velocity.x + 
      ball.velocity.y * ball.velocity.y
    );
    
    // MODIFICATION: Permettre des vitesses plus élevées pour des rebonds plus dynamiques
    // Utiliser une limite de vitesse qui augmente avec bounciness
    const dynamicMaxSpeed = maxBallSpeed * (1 + (bounciness - 0.75) * 0.3);
    
    if (speed > dynamicMaxSpeed) {
      const ratio = dynamicMaxSpeed / speed;
      ball.velocity.x *= ratio;
      ball.velocity.y *= ratio;
    }
    
    // MODIFICATION: Empêcher les balles de ralentir trop vite
    // Si la balle ralentit trop, lui donner occasionnellement un petit boost
    if (speed < MIN_VELOCITY * 1.5 && Math.random() > 0.7) {
      const boostFactor = 1.0 + (Math.random() * 0.2);
      ball.velocity.x *= boostFactor;
      ball.velocity.y *= boostFactor;
    }
  };

  // Mettre à jour le volume MIDI
  useEffect(() => {
    if (midiVolume !== undefined) {
      setMIDIVolume(midiVolume);
    }
  }, [midiVolume]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {isPlaying ? (
        <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', fontSize: 24, zIndex: 10 }}>
          Score: {gameState.score}
        </div>
      ) : (
        <div 
          style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            color: 'white',
            textAlign: 'center',
            zIndex: 10 
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 20 }}>Game Over</div>
          <div style={{ fontSize: 24, marginBottom: 30 }}>Score: {gameState.score}</div>
          <button 
            onClick={() => {
              setGameState({
                balls: [],
                score: 0,
                gameOver: false
              });
              requestRef.current = undefined;
            }}
            style={{
              background: 'linear-gradient(45deg, #ff4b4b, #ff9b4b)',
              border: 'none',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '20px',
              fontSize: '18px',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)'
            }}
          >
            Play Again
          </button>
        </div>
      )}

      {/* Recording controls */}
      <div style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 100, display: 'flex', gap: '10px' }}>
        <button 
          onClick={toggleRecording}
          style={{
            background: isRecording ? '#ff4b4b' : '#4b4bff',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {isRecording ? (
            <>
              <span style={{ 
                width: '10px', 
                height: '10px', 
                backgroundColor: 'white', 
                display: 'inline-block' 
              }}></span>
              Stop Recording
            </>
          ) : (
            <>
              <span style={{ 
                width: '10px', 
                height: '10px', 
                backgroundColor: 'white', 
                borderRadius: '50%', 
                display: 'inline-block' 
              }}></span>
              Record for TikTok
            </>
          )}
        </button>

        {videoBlob && (
          <button 
            onClick={handleDownloadVideo}
            style={{
              background: '#4bff4b',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Download Video
          </button>
        )}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div style={recordingStyles.container as React.CSSProperties}>
          <div style={recordingStyles.recordIcon as React.CSSProperties} />
          <div style={recordingStyles.time as React.CSSProperties}>
            {Math.floor(recordingTime / 1000).toString().padStart(2, '0')}:{(Math.floor(recordingTime / 10) % 100).toString().padStart(2, '0')}
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ 
          display: 'block', 
          width: '100%', 
          height: '100%', 
          touchAction: 'none'
        }}
      />
    </div>
  );
};

export default GrowingBall; 
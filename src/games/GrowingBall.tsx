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
  setMIDIVolume,
  setMIDITonality,
  MIDI_INSTRUMENT_PRESETS,
  MIDIInstrumentPresetKey,
  setMIDIInstrumentPreset,
  setMIDITrackIndex,
  hasCustomSound,
  CustomSoundType,
  playGameStartSound,
  playRandomSound,
  playWallSound
} from '../utils/sounds';
import { useGameRecorder } from '../utils/recorder';

// Physics parameters for realistic bouncing
const DEFAULT_GRAVITY = 0.0;         // MODIFIED: Gravité à zéro pour que la balle ne tombe pas
const DEFAULT_GROWTH_RATE = 1.0;      // Taux de croissance
const DEFAULT_BOUNCINESS = 1.0;      // MODIFIED: Rebond parfait, pas de perte d'énergie
const DEFAULT_FRICTION = 1.0;       // MODIFIED: Pas de friction sur les rebonds muraux (surtout sol)
const DEFAULT_BRIGHTNESS_INCREASE = 5;
const DEFAULT_SPEED = 12;             // Vitesse initiale légèrement augmentée
const WALL_PADDING = 0.05;
const MAX_VELOCITY = 35;              // Limite de vitesse augmentée (un peu plus pour gérer les rebonds forts)
const MIN_VELOCITY = 1.5;             // MODIFIED: Vitesse minimale (légèrement augmentée)
const SPEED_CAP_AFTER_BOUNCE = 30;    // MODIFIED: Augmenté pour plus d'énergie après rebond mural - CETTE VALEUR SERA IGNORÉE DANS handleWallCollision
const RANDOM_FORCE_INTERVAL = 4000;   // Forces aléatoires pour un peu de variété
const RANDOM_FORCE_MAGNITUDE = 0.0;  // MODIFIED: Pas de forces aléatoires pour ne pas affecter la vitesse
const MAX_BALLS = 5;
const COLLISION_THRESHOLD = 0.05;
const GRAVITY_SCALING = 0.25;         // Scaling de gravité ajusté
const AIR_RESISTANCE = 1.0;         // MODIFIED: Pas de résistance à l'air
const VELOCITY_DAMPING = 1.0;       // MODIFIED: Pas d'amortissement général de la vélocité
const TRAIL_EFFECT = true;
const MAX_BALL_RADIUS_FACTOR = 0.99;
const MAINTAIN_CONSTANT_SPEED = false; // La gravité nécessite des changements de vitesse
const SMOOTH_COLLISIONS = true;
const WALL_BOUNCE_FORCE = 0.0;        // MODIFIED: Pas de force additionnelle au rebond mural
const WALL_MARGIN = 5.0;
const WALL_IMMUNITY_TIME = 50;       // REDUCED from 150ms to 50ms to allow more frequent corrections
const RANDOM_BOUNCE_ANGLE = true;
const RANDOM_ANGLE_MAX = 0.15;
const REALISTIC_GRAVITY = true;
const WALL_TANGENTIAL_FRICTION = 1.0; // MODIFIED: Pas de friction tangentielle sur les murs
const MIN_WALL_BOUNCE_VELOCITY = 3.0; // NEW: Increased minimum rebound velocity after wall collision

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
  midiTonality?: string; // New prop: Tonality for MIDI sounds (e.g. "C", "D", "F#")
  midiInstrumentPreset?: MIDIInstrumentPresetKey;
  midiTrackIndex?: number | null;
  backgroundColor?: string; // New prop for background color
  circleColor?: string; // New prop for circle color
  circleAnimationEnabled?: boolean; // New prop to enable/disable circle animation
  circleAnimationDuration?: number; // New prop for circle animation duration
  showRecordingControls?: boolean; // New prop to show/hide recording controls
  showConfigPanel?: boolean; // Add prop to show/hide config panel
  
  // Add callback props for propagating changes to parent
  onBackgroundColorChange?: (color: string) => void;
  onCircleColorChange?: (color: string) => void;
  onCircleAnimationEnabledChange?: (enabled: boolean) => void;
  onCircleAnimationDurationChange?: (duration: number) => void;
  onShowRecordingControlsChange?: (show: boolean) => void;
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
  lastWallCollisionTime?: number; // Nouveau: temps de la dernière collision avec un mur
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

// Format recording time from milliseconds to MM:SS format
const formatRecordingTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
  midiVolume = 0.7,
  midiTonality = "C", // Default tonality is C
  midiInstrumentPreset = MIDI_INSTRUMENT_PRESETS.DEFAULT_CYCLING,
  midiTrackIndex = null,
  backgroundColor = '#000000', // Default background color
  circleColor = 'rgba(255, 100, 0, 0.8)', // Default circle color
  circleAnimationEnabled = true, // Default to enabled
  circleAnimationDuration = 500, // Default animation duration in ms
  showRecordingControls = false, // Default to hidden
  showConfigPanel = false,
  onBackgroundColorChange,
  onCircleColorChange,
  onCircleAnimationEnabledChange,
  onCircleAnimationDurationChange,
  onShowRecordingControlsChange
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
  
  // Add state for circle animation
  const [circleAnimationActive, setCircleAnimationActive] = useState(false);
  const [circleAnimationScale, setCircleAnimationScale] = useState(1);
  const circleAnimationRef = useRef<number | null>(null);
  
  // Add state to track configuration settings and panel visibility
  const [configSettings, setConfigSettings] = useState({
    backgroundColor,
    circleColor,
    circleAnimationEnabled,
    circleAnimationDuration,
    showRecordingControls
  });
  
  const [isConfigPanelVisible, setIsConfigPanelVisible] = useState(showConfigPanel);
  
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
  
  // Update configSettings when props change
  useEffect(() => {
    setConfigSettings({
      backgroundColor,
      circleColor,
      circleAnimationEnabled,
      circleAnimationDuration,
      showRecordingControls
    });
  }, [backgroundColor, circleColor, circleAnimationEnabled, circleAnimationDuration, showRecordingControls]);

  // Update config panel visibility when prop changes
  useEffect(() => {
    setIsConfigPanelVisible(showConfigPanel);
  }, [showConfigPanel]);
  
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
    
    // Ensure audio is always resumed when needed (Safari/iOS often suspends it)
    const resumeAudioContext = () => {
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('Audio context resumed on user interaction');
        });
      }
    };
    
    // Resume audio context on user interactions
    document.addEventListener('click', resumeAudioContext);
    document.addEventListener('touchstart', resumeAudioContext);
    
    return () => {
      document.removeEventListener('click', resumeAudioContext);
      document.removeEventListener('touchstart', resumeAudioContext);
    };
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
  
  // MODIFICATION: Ajouter des useEffect pour les nouveaux contrôles MIDI
  useEffect(() => {
    if (midiEnabled && midiInstrumentPreset) { // midiInstrumentPreset peut être undefined si non fourni par le parent
      setMIDIInstrumentPreset(midiInstrumentPreset);
    } else if (midiEnabled) {
      // Si activé mais pas de preset fourni, s'assurer que le son est sur défaut.
      // setMIDIInstrumentPreset attend un preset ou null.
      // Si la prop est undefined, on peut explicitement passer null pour le comportement par défaut.
      setMIDIInstrumentPreset(MIDI_INSTRUMENT_PRESETS.DEFAULT_CYCLING); 
    }
  }, [midiEnabled, midiInstrumentPreset]);

  useEffect(() => {
    if (midiEnabled && midiTrackIndex !== undefined) { // midiTrackIndex peut être 0 ou null
      setMIDITrackIndex(midiTrackIndex);
    } else if (midiEnabled) {
      // Si activé mais pas d'index fourni, s'assurer qu'il est sur null (toutes pistes principales)
      setMIDITrackIndex(null);
    }
  }, [midiEnabled, midiTrackIndex]);
  
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
  
  // Appliquer des forces aléatoires avec une probabilité fortement réduite
  const applyRandomForce = (balls: EnhancedBall[], timestamp: number): EnhancedBall[] => {
    return balls.map(ball => {
      // Seulement 5% de chance d'appliquer une force aléatoire pour réduire les glitches
      if (Math.random() > 0.95) {
        // Calculer l'angle par rapport au centre pour éviter les forces qui centrent la balle
        const canvas = canvasRef.current;
        if (!canvas) return ball;
        
        const canvasBounds = canvas.getBoundingClientRect();
        const centerX = canvasBounds.width / 2;
        const centerY = canvasBounds.height / 2;
        const dx = ball.position.x - centerX;
        const dy = ball.position.y - centerY;
        
        // Angle dirigé LOIN du centre (pour éviter le centrage)
        const baseAngle = Math.atan2(dy, dx);
        // Ajout de variation aléatoire de ±45 degrés
        const angleVariation = (Math.random() - 0.5) * Math.PI / 2;
        const finalAngle = baseAngle + angleVariation;
        
        // Force très faible
        const magnitude = RANDOM_FORCE_MAGNITUDE * (0.2 + Math.random() * 0.3);
        
        // Composantes X et Y de la force
        const forceX = Math.cos(finalAngle) * magnitude;
        const forceY = Math.sin(finalAngle) * magnitude;
      
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
        elasticity: 1.0, // MODIFIED: Élasticité parfaite pour la conservation de la vitesse
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
    
    // Vitesse initiale plus élevée pour compenser les pertes
    const speedFactor = 0.9 + Math.random() * 0.7; // 90% à 160% de la vitesse de base
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
      elasticity: 1.0, // MODIFIED: Élasticité parfaite pour la conservation de la vitesse
      angularVelocity: (Math.random() - 0.5) * 0.1,
      initialSpeed: initialSpeed  // NOUVEAU: Stocker la vitesse initiale
    };
    
    return ball;
  };
  
  // Add function to play ball-specific sound
  const playBallSpecificSound = useCallback((volume: number, ballIndex?: number) => {
    console.log(`[DEBUG BALL SOUND] playBallSpecificSound called with volume=${volume}, ballIndex=${ballIndex}`);
    console.log(`[DEBUG BALL SOUND] useCustomSounds=${useCustomSounds}, loadedSounds available:`, 
      Object.keys(loadedSounds).length > 0 ? `yes, for ${Object.keys(loadedSounds).length} ball types` : 'no');
    
    if (ballIndex === undefined) {
      console.log('[DEBUG BALL SOUND] No ballIndex provided, falling back to default sound');
      playBounceSound(volume, false);
      return;
    }
    
    if (!useCustomSounds) {
      console.log('[DEBUG BALL SOUND] Custom sounds not enabled, falling back to default sound');
      playBounceSound(volume, false);
      return;
    }
    
    // Check if we have sounds for this ball
    if (loadedSounds[ballIndex]?.length > 0) {
      // Get random sound for this ball type
      const ballSounds = loadedSounds[ballIndex];
      console.log(`[DEBUG BALL SOUND] Found ${ballSounds.length} sounds for ball index ${ballIndex}`);
      
      const randomIndex = Math.floor(Math.random() * ballSounds.length);
      const randomSound = ballSounds[randomIndex];
      
      if (randomSound) {
        console.log(`[DEBUG BALL SOUND] Playing sound #${randomIndex} for ball ${ballIndex}`);
        try {
          randomSound.volume = Math.min(0.8, volume);
          randomSound.currentTime = 0;
          randomSound.play()
            .then(() => console.log(`[DEBUG BALL SOUND] Sound playback started successfully`))
            .catch(err => console.log('[DEBUG BALL SOUND] Sound play error:', err));
        } catch (e) {
          console.error('[DEBUG BALL SOUND] Error during sound playback:', e);
          // Fall back to default sound if there's an error
          playBounceSound(volume, false);
        }
      } else {
        console.log(`[DEBUG BALL SOUND] No valid sound found at index ${randomIndex}, falling back to default`);
        playBounceSound(volume, false);
      }
    } else {
      // Fall back to default sound
      console.log(`[DEBUG BALL SOUND] No sounds loaded for ball index ${ballIndex}, falling back to default`);
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
    
    // Vérifier si MIDI est activé dès le début de l'animation
    if (midiEnabled) {
      console.log("MIDI activé dans useEffect initial");
      // Définir le volume MIDI global
      setMIDIVolume(midiVolume);
      
      // Définir la tonalité MIDI si spécifiée
      if (midiTonality) {
        setMIDITonality(midiTonality);
        console.log(`Tonalité MIDI définie sur ${midiTonality}`);
      }
      
      // Forcer l'initialisation de la séquence par défaut si nécessaire
      hasMIDISequence();
    }
    
    // Version optimisée de la fonction d'animation
    const animate = (timestamp: number) => {
      if (!canvas || !ctx) return;
      
      // Calculer delta time pour des animations plus fluides
      // Limiter deltaTime à 1 (équivalent à 60 FPS) pour éviter les sauts trop grands
      const deltaTime = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 16.67, 1) : 1;
      lastTimestamp = timestamp;
      
      // Clear the canvas
      if (TRAIL_EFFECT) {
        // Use custom background color with transparency
        const bgColorWithAlpha = configSettings.backgroundColor.startsWith('rgba') 
          ? configSettings.backgroundColor.replace(/[\d.]+\)$/, '0.1)') 
          : `rgba(${hexToRgb(configSettings.backgroundColor)}, 0.1)`;
        ctx.fillStyle = bgColorWithAlpha;
        ctx.fillRect(0, 0, displayWidth, displayHeight);
      } else {
        ctx.clearRect(0, 0, displayWidth, displayHeight);
      }
      
      // Dessiner l'arrière-plan avec la couleur personnalisée
      const rgbValues = hexToRgb(configSettings.backgroundColor);
      const bgGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, displayWidth > displayHeight ? displayWidth : displayHeight
      );
      bgGradient.addColorStop(0, `rgba(${rgbValues}, ${backgroundBrightness/100 + 0.1})`);
      bgGradient.addColorStop(1, `rgba(${rgbValues}, ${backgroundBrightness/100})`);
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      
      // Draw the outer circle with custom color and animation
      ctx.save();
      ctx.beginPath();
      const animatedRadius = circleAnimationActive ? circleRadius * circleAnimationScale : circleRadius;
      ctx.arc(centerX, centerY, animatedRadius, 0, Math.PI * 2);
      ctx.strokeStyle = configSettings.circleColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      
      if (effectsEnabled) {
        // Add glow effect to the circle
        const circleColorRgb = configSettings.circleColor.startsWith('rgba') 
          ? configSettings.circleColor.replace(/^rgba?\(|\)$/g, '').split(',').slice(0, 3).join(',')
          : hexToRgb(configSettings.circleColor);
        ctx.shadowColor = `rgba(${circleColorRgb}, 0.5)`;
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
        updatedBalls = applyRandomForce(updatedBalls, timestamp);
      }
      
      // Mettre à jour les positions des balles avec une physique améliorée
      updatedBalls = updatedBalls.map((enhancedBall) => {
        const ball = enhancedBall as EnhancedBall;
        
        // Apply anti-sticking measures at the start of each frame
        preventWallSticking(ball, displayWidth, displayHeight);
        
        let newVx = ball.velocity.x;
        let newVy = ball.velocity.y;
        
        // Appliquer la gravité si activée
        if (REALISTIC_GRAVITY) {
          newVy += gravity * GRAVITY_SCALING; // La gravité affecte la vitesse verticale
        }
        
        // Appliquer la résistance de l'air / amortissement
        newVx *= AIR_RESISTANCE;
        newVy *= AIR_RESISTANCE; // L'air ralentit la balle dans les deux directions
        
        // Limiter la vitesse maximale
        const speedForMaxLimit = Math.sqrt(newVx * newVx + newVy * newVy);
        if (speedForMaxLimit > MAX_VELOCITY) {
          const factor = MAX_VELOCITY / speedForMaxLimit;
          newVx *= factor;
          newVy *= factor;
        }
        
        // S'assurer que la balle ne s'arrête pas complètement trop vite à cause de la friction (sauf si vitesse quasi nulle)
        // MAINTENANT: cette logique est un peu plus agressive pour s'assurer qu'elle bouge toujours
        const speedForMinBoost = Math.sqrt(newVx * newVx + newVy * newVy);
        if (speedForMinBoost < MIN_VELOCITY && speedForMinBoost > 0.01) {
           const factor = MIN_VELOCITY / speedForMinBoost;
           newVx *= factor;
           newVy *= factor;
        }
        
        // Mettre à jour la position
        let newBallPosition = {
          x: ball.position.x + newVx,
          y: ball.position.y + newVy
        };
        
        // Maintenir la vitesse minimale pour éviter que la balle ralentisse trop
        // mais seulement pour le mouvement horizontal, pour permettre à la gravité d'agir
        const currentBallSpeedForMin = Math.sqrt(newVx * newVx + newVy * newVy);
        if (currentBallSpeedForMin < MIN_VELOCITY && currentBallSpeedForMin > 0) {
          const boostFactor = MIN_VELOCITY / currentBallSpeedForMin;
          // Appliquer le boost uniquement si MAINTAIN_CONSTANT_SPEED est faux, pour permettre la gravité
          if (!MAINTAIN_CONSTANT_SPEED) {
             newVx *= boostFactor; // Cela affectait la gravité, à revoir
          }
        }
        
        // Détection préventive de collision avec les murs
        // Si la balle est trop proche d'un mur et se dirige vers lui, on change sa direction
        const wallBounds = canvas.getBoundingClientRect();
        const wallWidth = wallBounds.width;
        const wallHeight = wallBounds.height;
        const safeDistance = ball.radius + 5; // Distance de sécurité
        
        // Vérifier les murs horizontaux
        if (newBallPosition.x - ball.radius < safeDistance && newVx < 0) {
          // Trop proche du mur gauche et se dirige vers lui
          handleWallCollision(ball, wallWidth, wallHeight, bounceVolume);
          newVx = ball.velocity.x;
          newVy = ball.velocity.y;
          newBallPosition.x = ball.position.x;
        } else if (newBallPosition.x + ball.radius > wallWidth - safeDistance && newVx > 0) {
          // Trop proche du mur droit et se dirige vers lui
          handleWallCollision(ball, wallWidth, wallHeight, bounceVolume);
          newVx = ball.velocity.x;
          newVy = ball.velocity.y;
          newBallPosition.x = ball.position.x;
        }
        
        // Vérifier les murs verticaux
        if (newBallPosition.y - ball.radius < safeDistance && newVy < 0) {
          // Trop proche du plafond et se dirige vers lui
          handleWallCollision(ball, wallWidth, wallHeight, bounceVolume);
          newVx = ball.velocity.x;
          newVy = ball.velocity.y;
          newBallPosition.y = ball.position.y;
        } else if (newBallPosition.y + ball.radius > wallHeight - safeDistance && newVy > 0) {
          // Trop proche du sol et se dirige vers lui
          handleWallCollision(ball, wallWidth, wallHeight, bounceVolume);
          newVx = ball.velocity.x;
          newVy = ball.velocity.y;
          newBallPosition.y = ball.position.y;
        }
        
        // Effets visuels
        let newPulseEffect = ball.pulseEffect ? ball.pulseEffect * 0.9 : 0;
        let newGlowSize = ball.glowSize ? Math.max(1.5, ball.glowSize * 0.95) : 1.5;
        let newGlowOpacity = ball.glowOpacity ? Math.max(0.7, ball.glowOpacity * 0.98) : 0.7;
        
        // Suivi du score
        let newScore = ball.score || 0;
        let lastCollisionTime = ball.lastCollisionTime || 0;
        let currentScoreIncrement = 0;
        
        // DÉTECTER LES COLLISIONS AVEC LES MURS DU CANVAS
        const canvasBounds = canvas.getBoundingClientRect();
        const canvasWidth = canvasBounds.width;
        const canvasHeight = canvasBounds.height;
        
        // Vérifier la collision avec le mur droit
        if (newBallPosition.x + ball.radius > canvasWidth) {
          console.log(`[WALL-RIGHT] Collision détectée! Rayon avant: ${ball.radius.toFixed(2)}`);
          handleWallCollision(ball, canvasWidth, canvasHeight, bounceVolume);
          
          // IMPORTANT: Ces ajustements sont maintenant gérés dans handleWallCollision
          // La fonction handleWallCollision met à jour correctement:
          // - la position de la balle pour éviter les problèmes de pénétration
          // - la vitesse de la balle (rebond)
          // - le rayon de la balle (croissance)
          // - les sons et effets visuels
          
          // Mise à jour de la vitesse et position après la gestion de collision
          newVx = ball.velocity.x;
          newBallPosition.x = ball.position.x;
          
          // Log de vérification
          console.log(`[WALL-RIGHT] Après collision, nouveau rayon: ${ball.radius.toFixed(2)}`);
        }
        // Vérifier la collision avec le mur gauche
        else if (newBallPosition.x - ball.radius < 0) {
          console.log(`[WALL-LEFT] Collision détectée! Rayon avant: ${ball.radius.toFixed(2)}`);
          handleWallCollision(ball, canvasWidth, canvasHeight, bounceVolume);
          
          // Mise à jour de la vitesse et position après la gestion de collision
          newVx = ball.velocity.x;
          newBallPosition.x = ball.position.x;
          
          console.log(`[WALL-LEFT] Après collision, nouveau rayon: ${ball.radius.toFixed(2)}`);
        }
        // Vérifier la collision avec le sol
        else if (newBallPosition.y + ball.radius > canvasHeight) {
          console.log(`[WALL-FLOOR] Collision détectée! Rayon avant: ${ball.radius.toFixed(2)}`);
          handleWallCollision(ball, canvasWidth, canvasHeight, bounceVolume);
          
          // Mise à jour de la vitesse et position après la gestion de collision
          newVy = ball.velocity.y;
          newBallPosition.y = ball.position.y;
          
          console.log(`[WALL-FLOOR] Après collision, nouveau rayon: ${ball.radius.toFixed(2)}`);
        }
        // Vérifier la collision avec le plafond
        else if (newBallPosition.y - ball.radius < 0) {
          console.log(`[WALL-CEILING] Collision détectée! Rayon avant: ${ball.radius.toFixed(2)}`);
          handleWallCollision(ball, canvasWidth, canvasHeight, bounceVolume);
          
          // Mise à jour de la vitesse et position après la gestion de collision
          newVy = ball.velocity.y;
          newBallPosition.y = ball.position.y;
          
          console.log(`[WALL-CEILING] Après collision, nouveau rayon: ${ball.radius.toFixed(2)}`);
        }
        
        // Détection de collision avec les limites du cercle avec un délai
        const distanceFromCenter = Math.sqrt(
          Math.pow(newBallPosition.x - centerX, 2) + 
          Math.pow(newBallPosition.y - centerY, 2)
        );
        
        const isColliding = distanceFromCenter + ball.radius >= circleRadius - WALL_PADDING;
        const canCollideNow = timestamp - lastCollisionTime > COLLISION_THRESHOLD * 1000;
        
        // Gérer les collisions de manière plus contrôlée
        if (isColliding && canCollideNow) {
          // Utiliser la fonction handleCollision pour une physique plus stable
          const collisionResult = handleCollision(
            ball,
            newBallPosition,
            newVx,
            newVy,
            centerX,
            centerY,
            circleRadius,
            timestamp
          );
          
          newBallPosition = collisionResult.position;
          newVx = collisionResult.velocity.x;
          newVy = collisionResult.velocity.y;
          lastCollisionTime = collisionResult.lastCollisionTime;
          
          // Effets sonores et visuels lors de la collision
          // DECOUPLED: First calculate shared values needed for both sound and visual effects
          const impactSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
          const volume = Math.min(1.0, impactSpeed / 10) * bounceVolume;
          
          // SOUND EFFECTS: Now completely independent from visual effects
          // First play the grow sound - ensure it always plays regardless of custom images
          console.log(`[DEBUG COLLISION] Playing grow sound with radius=${ball.radius}, useCustomSounds=${useCustomSounds}`);
          playGrowSound(ball.radius / 50 * bounceVolume, useCustomSounds);
          
          // Then play specific sound for the ball if available
          if (useCustomSounds && ball.imageIndex !== undefined) {
            console.log(`[DEBUG COLLISION] Playing ball-specific sound for imageIndex=${ball.imageIndex}`);
            playBallSpecificSound(volume, ball.imageIndex);
          } else if (standardSoundsEnabled) {
            console.log(`[DEBUG COLLISION] Playing standard bounce sound`);
            playBounceSound(volume, useCustomSounds);
          }
          
          // VISUAL EFFECTS: Only applied if effects are enabled
          let newPulseEffect = 0;
          let newGlowSize = 1.5;
          let newGlowOpacity = 0.7;
          
          if (effectsEnabled) {
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
            if (musicEnabled) {  // Removed dependency on effectsEnabled
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
              position: newBallPosition,
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
            const angle = Math.atan2(newBallPosition.y - centerY, newBallPosition.x - centerX);
          const correctedRadius = circleRadius - ball.radius - WALL_PADDING;
            
            newBallPosition = {
              x: centerX + Math.cos(angle) * correctedRadius,
              y: centerY + Math.sin(angle) * correctedRadius
            };
          }
          
          // Rotation de la balle pour plus de réalisme (si la propriété existe)
          const newRotation = ball.rotation !== undefined 
            ? ball.rotation + (ball.angularVelocity || 0) * deltaTime 
            : 0;
          
          // NOUVEAU: Ajouter une limite de vitesse pour empêcher les balles de devenir trop rapides
          const currentSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
          if (currentSpeed > MAX_VELOCITY) {
            const reductionFactor = MAX_VELOCITY / currentSpeed;
            newVx *= reductionFactor;
            newVy *= reductionFactor;
          }
          
          return {
          ...ball,
            position: newBallPosition,
            velocity: { x: newVx, y: newVy },
            pulseEffect: effectsEnabled ? newPulseEffect : 0,
            glowSize: effectsEnabled ? newGlowSize : 1,
            glowOpacity: effectsEnabled ? newGlowOpacity : 0,
            score: newScore,
            lastCollisionTime,
            rotation: newRotation,
            initialSpeed: ball.initialSpeed  // Garder la vitesse initiale pour référence
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
        
      // Trier les balles par score pour que la balle avec le plus gros score soit dessinée en dernier (au-dessus)
      const sortedBalls = [...updatedBalls].sort((a, b) => {
        const scoreA = (a as EnhancedBall).score || 0;
        const scoreB = (b as EnhancedBall).score || 0;
        return scoreA - scoreB;
      });
        
      // Dessiner les balles avec rotation pour plus de réalisme
      sortedBalls.forEach(ball => {
        const enhancedBall = ball as EnhancedBall;
        
        // Draw glow effect if enabled
        if (effectsEnabled) {
        // Extract HSL values from color
          const colorMatch = enhancedBall.color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
          let hue = 0, saturation = 70, lightness = 80;
          
          if (colorMatch && colorMatch.length >= 4) {
            hue = parseInt(colorMatch[1]);
            saturation = parseInt(colorMatch[2]);
            lightness = parseInt(colorMatch[3]);
          }
        
        // Create gradient for glow effect
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
        
      // Si l'effet de trainée est activé, dessiner une petite trainée derrière la balle
      if (TRAIL_EFFECT && enhancedBall.velocity) {
        const speed = Math.sqrt(
          enhancedBall.velocity.x * enhancedBall.velocity.x + 
          enhancedBall.velocity.y * enhancedBall.velocity.y
        );
        
        // Calculer la longueur de la trainée en fonction de la vitesse
        const trailLength = Math.min(speed * 3, 60); // Trainée plus longue pour mieux visualiser
        
        // Calculer la direction inverse de la vitesse pour dessiner la trainée
        const vNorm = Math.sqrt(
          enhancedBall.velocity.x * enhancedBall.velocity.x + 
          enhancedBall.velocity.y * enhancedBall.velocity.y
        );
        
        if (vNorm > 0.1) {  // Éviter division par zéro
          const vxNorm = -enhancedBall.velocity.x / vNorm;
          const vyNorm = -enhancedBall.velocity.y / vNorm;
          
          // Dessiner la trainée
          ctx.beginPath();
          ctx.moveTo(enhancedBall.position.x, enhancedBall.position.y);
          ctx.lineTo(
            enhancedBall.position.x + vxNorm * trailLength,
            enhancedBall.position.y + vyNorm * trailLength
          );
          
          // Créer un dégradé pour la trainée
          const gradient = ctx.createLinearGradient(
            enhancedBall.position.x, enhancedBall.position.y,
            enhancedBall.position.x + vxNorm * trailLength,
            enhancedBall.position.y + vyNorm * trailLength
          );
          
          // Rendre la trainée plus visible
          let color = enhancedBall.color;
          if (color.startsWith('hsl')) {
            gradient.addColorStop(0, color.replace(')', ', 0.9)').replace('hsl', 'hsla'));
            gradient.addColorStop(1, color.replace(')', ', 0)').replace('hsl', 'hsla'));
          } else {
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          }
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = enhancedBall.radius * 0.6; // Légèrement plus fine
          ctx.lineCap = 'round';
          ctx.stroke();
        }
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
  bounceVolume,
  backgroundColor,
  circleColor,
  circleAnimationEnabled,
  circleAnimationDuration,
  circleAnimationActive,
  circleAnimationScale,
  configSettings
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
    
    // Pour TikTok, nous voulons un ratio 9:16 (portrait)
    const tiktokRatio = 9/16;
    
    // Calculer la taille maximale disponible
    const maxWidth = container.clientWidth;
    const maxHeight = window.innerHeight * 0.8; // Utiliser 80% de la hauteur de la fenêtre
    
    let containerWidth, containerHeight;
    
    // Déterminer si nous sommes limités par la largeur ou la hauteur
    if (maxWidth / maxHeight > tiktokRatio) {
      // Limité par la hauteur, ajuster la largeur
      containerHeight = maxHeight;
      containerWidth = maxHeight * tiktokRatio;
    } else {
      // Limité par la largeur, ajuster la hauteur
      containerWidth = maxWidth;
      containerHeight = maxWidth / tiktokRatio;
    }
    
    // Appliquer un facteur de pixel ratio pour les écrans haute densité
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Définir la taille du canvas en tenant compte du pixel ratio pour une meilleure netteté
    canvas.width = containerWidth * pixelRatio;
    canvas.height = containerHeight * pixelRatio;
    
    // Maintenir la taille d'affichage (CSS)
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
    
    console.log(`Canvas resized to TikTok format: ${containerWidth}x${containerHeight} (ratio: ${containerWidth/containerHeight})`);
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
  // Ensure audio context is resumed before recording
  const context = getSoundAudioContext();
  if (context && context.state === 'suspended') {
    console.log('Resuming audio context before recording');
    context.resume().then(() => {
      console.log('Audio context resumed for recording');
      // Only start/stop recording after context is definitely resumed
      handleRecordingToggle();
    }).catch(err => {
      console.error('Failed to resume audio context:', err);
      // Try to continue anyway
      handleRecordingToggle();
    });
  } else {
    handleRecordingToggle();
  }
};

// Actual recording toggle implementation
const handleRecordingToggle = () => {
  if (isRecording) {
    console.log('Stopping recording...');
    stopRecording().then(blob => {
      if (blob) {
        console.log('Recording stopped successfully, blob size:', blob.size);
      } else {
        console.error('Recording stopped but no blob was created');
      }
    }).catch(err => {
      console.error('Error stopping recording:', err);
    });
  } else {
    if (canvasRef.current) {
      console.log('Starting recording with audio capture...');
      
      // Make sure all audio systems are properly connected before recording
      const destination = getAudioDestination();
      if (destination) {
        connectToRecorder(destination);
        console.log('Reconnected audio system to recorder');
      }
      
      // Use more stable settings for better compatibility
      startRecording(canvasRef.current, 60000, {
        frameRate: 30, // Lower to 30fps for stability
        videoBitsPerSecond: 3000000, // 3 Mbps for better compatibility
        captureAudio: true // Enable audio capture
      }).catch(err => {
        console.error('Failed to start recording:', err);
        alert('Recording failed to start. Please try again.');
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

// Améliorer le traitement des collisions pour maintenir la vitesse constante
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
  console.log(`[COLLISION] Collision avec cercle, radius avant: ${ball.radius.toFixed(2)}, midiEnabled: ${midiEnabled}`);
  
  // Trigger circle animation if enabled
  if (circleAnimationEnabled && configSettings.circleAnimationEnabled) {
    setCircleAnimationActive(true);
    setCircleAnimationScale(1.05); // Start with a slight scale up
    
    // Clear any existing animation
    if (circleAnimationRef.current) {
      cancelAnimationFrame(circleAnimationRef.current);
    }
    
    // Animate the circle
    let startTime = performance.now();
    const animateCircle = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / configSettings.circleAnimationDuration);
      
      // Ease out effect
      const scale = 1 + (0.05 * (1 - progress));
      setCircleAnimationScale(scale);
      
      if (progress < 1) {
        circleAnimationRef.current = requestAnimationFrame(animateCircle);
      } else {
        setCircleAnimationActive(false);
        setCircleAnimationScale(1);
        circleAnimationRef.current = null;
      }
    };
    
    circleAnimationRef.current = requestAnimationFrame(animateCircle);
  }
  
  // Stocker la vitesse avant collision pour la maintenir après
  const speedBeforeCollision = Math.sqrt(newVx * newVx + newVy * newVy);
  const initialSpeed = ball.initialSpeed || speedBeforeCollision;
  
  // Jouer une note MIDI au début de la collision si c'est activé ET qu'une séquence MIDI est disponible
  if (midiEnabled && typeof playMIDINote === 'function' && hasMIDISequence()) {
    try {
      // Calculer la vitesse d'impact
      const speed = Math.sqrt(newVx * newVx + newVy * newVy);
      // Calculer un volume entre 0.4 et 1 en fonction de la vitesse
      const volume = 0.4 + Math.min(0.6, speed / 20);
      
      console.log(`[COLLISION] Tentative de jouer un son MIDI volume=${volume}`);
      playMIDINote(volume);
    } catch (e) {
      console.error("[COLLISION] Erreur lecture MIDI:", e);
    }
  }
  
  // *** IMPORTANT *** AUGMENTER LA TAILLE DE LA BALLE À CHAQUE REBOND
  // Limiter la taille presque jusqu'à la taille du cercle pour éviter les chevauchements
  const maxBallRadius = circleRadius * MAX_BALL_RADIUS_FACTOR;
  const growthFactor = growthRate * 0.5; // Facteur de croissance plus petit
  const newRadius = Math.min(ball.radius + growthFactor, maxBallRadius);
  
  console.log(`[COLLISION] Augmentation du rayon: ${ball.radius.toFixed(2)} -> ${newRadius.toFixed(2)}, facteur: ${growthFactor.toFixed(2)}, max: ${maxBallRadius.toFixed(2)}`);
  
  // Mettre à jour le rayon de la balle
  ball.radius = newRadius;
  
  // Calculer la direction normale et l'angle d'incidence
  const dx = newPosition.x - centerX;
  const dy = newPosition.y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Normaliser le vecteur de direction
  const nx = dx / distance;
  const ny = dy / distance;
  
  // Calculer la projection du vecteur vitesse sur la normale
  const dotProduct = newVx * nx + newVy * ny;
  
  // Calculer l'impulsion (changement de vitesse)
  const impactSpeed = Math.abs(dotProduct);
  
  // Calculer la nouvelle vitesse en fonction de l'élasticité
  const elasticity = ball.elasticity || bounciness;
  
  // Réfléchir la composante normale de la vitesse et conserver l'énergie
  const reflectionX = nx * dotProduct * (1 + elasticity);
  const reflectionY = ny * dotProduct * (1 + elasticity);
  
  // Appliquer le rebond
  newVx -= reflectionX;
  newVy -= reflectionY;
  
  // Repositionner la balle exactement à la limite du cercle pour éviter les téléportations
  if (SMOOTH_COLLISIONS) {
    const newDistance = circleRadius - ball.radius;
    newPosition.x = centerX + nx * newDistance;
    newPosition.y = centerY + ny * newDistance;
  } else {
    // Repositionner la balle à la limite du cercle pour éviter la pénétration
    const overlapDistance = (ball.radius + circleRadius - distance) - WALL_PADDING;
    newPosition.x -= nx * overlapDistance * 1.01; // Petit décalage supplémentaire
    newPosition.y -= ny * overlapDistance * 1.01;
  }
  
  // Jouer un son pour la collision
  if (standardSoundsEnabled) {
    playBounceSound(Math.min(impactSpeed / 20, 1));
  }
  
  // IMPORTANT: Maintenir une vitesse constante après la collision
  if (MAINTAIN_CONSTANT_SPEED && ball.initialSpeed && ball.initialSpeed > 0) {
    const speedAfterCollision = Math.sqrt(ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y);
    if (speedAfterCollision > 0 && Math.abs(speedAfterCollision - ball.initialSpeed) > 0.01) {
      const correctionFactor = ball.initialSpeed / speedAfterCollision;
      ball.velocity.x *= correctionFactor;
      ball.velocity.y *= correctionFactor;
    }
  }
  
  // Mise à jour du temps de dernière collision
  const lastCollisionTime = timestamp;
  
  console.log(`[COLLISION] Collision terminée, nouveau rayon: ${ball.radius.toFixed(2)}`);
  
  // Retourner les valeurs mises à jour
  return {
    position: newPosition,
    velocity: { x: newVx, y: newVy },
    lastCollisionTime
  };
};

// Améliorer la gestion des collisions avec les murs
const handleWallCollision = (
  ball: EnhancedBall,
  canvasWidth: number,
  canvasHeight: number,
  bounceVolume: number // This is the game-wide bounceVolume prop
) => {
  const currentTime = performance.now();
  
  // DEBUG: Afficher les informations détaillées à chaque appel
  console.log(`[DEBUG COLLISION] handleWallCollision called with ball id=${ball.id}, radius=${ball.radius.toFixed(2)}, position=(${ball.position.x.toFixed(2)}, ${ball.position.y.toFixed(2)})`);
  console.log(`[DEBUG COLLISION] ball velocity=(${ball.velocity.x.toFixed(2)}, ${ball.velocity.y.toFixed(2)}), currentTime=${currentTime}`);
  console.log(`[DEBUG COLLISION] lastWallCollisionTime=${ball.lastWallCollisionTime || 'undefined'}, immunity time=${WALL_IMMUNITY_TIME}ms`);
  
  // DEBUG: Afficher l'état actuel des sons personnalisés
  console.log('[DEBUG SOUND] useCustomSounds:', useCustomSounds);
  console.log('[DEBUG SOUND] hasCustomSound("wall"):', hasCustomSound('wall'));
  console.log('[DEBUG SOUND] standardSoundsEnabled:', standardSoundsEnabled);
  
  // Vérifier si nous devons mettre à jour la physique, mais toujours jouer les sons
  let shouldUpdatePhysics = true;
  if (ball.lastWallCollisionTime && currentTime - ball.lastWallCollisionTime < WALL_IMMUNITY_TIME) {
    shouldUpdatePhysics = false;
    console.log(`[DEBUG COLLISION] Collision physics immunity active for ${Math.round(WALL_IMMUNITY_TIME - (currentTime - ball.lastWallCollisionTime))}ms more`);
  }

  // Use the component's bounciness prop, which defaults to DEFAULT_BOUNCINESS
  const currentBounciness = bounciness;

  let wall: "right" | "left" | "floor" | "ceiling" | null = null; // track which wall
  const initialSpeed = Math.sqrt(ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y);
  console.log(`[DEBUG COLLISION] Initial speed: ${initialSpeed.toFixed(2)}, currentBounciness: ${currentBounciness}`);

  const addRandomAngle = (vx: number, vy: number): {x: number, y: number} => {
    if (!RANDOM_BOUNCE_ANGLE) return {x: vx, y: vy};
    const angle = Math.atan2(vy, vx);
    const randomVariation = (Math.random() * 2 - 1) * RANDOM_ANGLE_MAX;
    const newAngle = angle + randomVariation;
    const speed = Math.sqrt(vx * vx + vy * vy);
    console.log(`[DEBUG COLLISION] Random angle applied: ${(randomVariation * 180 / Math.PI).toFixed(2)} degrees`);
    return { x: Math.cos(newAngle) * speed, y: Math.sin(newAngle) * speed };
  };
  
  let collided = false;
  
  // SAFETY_MARGIN ensures the ball is placed with enough clearance from the wall
  const SAFETY_MARGIN = ball.radius * 0.1 + 2; // Increased from 0.05 to 0.1, and base value from 1 to 2

  // Check for collision and reflect velocity
  // Ensure position is corrected to prevent sticking
  if (ball.position.x + ball.radius > canvasWidth - WALL_MARGIN) {
    wall = "right";
    console.log(`[DEBUG COLLISION] Right wall collision detected`);
    
    if (shouldUpdatePhysics) {
      console.log(`[DEBUG COLLISION] Updating physics for right wall collision`);
      // Corriger la position pour un contact exact avec le mur avec une marge de sécurité
      ball.position.x = canvasWidth - ball.radius - WALL_MARGIN - SAFETY_MARGIN;
      // Inverser la vélocité X avec un peu d'atténuation contrôlée par le bounciness
      ball.velocity.x = -Math.abs(ball.velocity.x) * currentBounciness;
      // Ensure minimum horizontal velocity away from wall
      if (Math.abs(ball.velocity.x) < MIN_WALL_BOUNCE_VELOCITY) {
        ball.velocity.x = -MIN_WALL_BOUNCE_VELOCITY;
      }
      // Appliquer une friction à la vélocité Y pour simuler une friction au mur
      ball.velocity.y *= WALL_TANGENTIAL_FRICTION;
      console.log(`[DEBUG COLLISION] After right wall: velocity=(${ball.velocity.x.toFixed(2)}, ${ball.velocity.y.toFixed(2)})`);
    } else {
      // Even during immunity, ensure ball is not inside wall
      if (ball.position.x + ball.radius > canvasWidth - WALL_MARGIN) {
        ball.position.x = canvasWidth - ball.radius - WALL_MARGIN - SAFETY_MARGIN;
        
        // Always ensure minimum velocity away from wall, even during immunity
        if (ball.velocity.x >= -0.5) {
          ball.velocity.x = -MIN_WALL_BOUNCE_VELOCITY;
        }
      }
      console.log(`[DEBUG COLLISION] Skipping physics update due to immunity time`);
    }
    
    collided = true;
  } else if (ball.position.x - ball.radius < WALL_MARGIN) {
    wall = "left";
    console.log(`[DEBUG COLLISION] Left wall collision detected`);
    
    if (shouldUpdatePhysics) {
      // Corriger la position pour un contact exact avec le mur avec une marge de sécurité
      ball.position.x = ball.radius + WALL_MARGIN + SAFETY_MARGIN;
      // Inverser la vélocité X avec un peu d'atténuation
      ball.velocity.x = Math.abs(ball.velocity.x) * currentBounciness;
      // Ensure minimum horizontal velocity away from wall
      if (Math.abs(ball.velocity.x) < MIN_WALL_BOUNCE_VELOCITY) {
        ball.velocity.x = MIN_WALL_BOUNCE_VELOCITY;
      }
      // Appliquer une friction à la vélocité Y
      ball.velocity.y *= WALL_TANGENTIAL_FRICTION;
      console.log(`[DEBUG COLLISION] After left wall: velocity=(${ball.velocity.x.toFixed(2)}, ${ball.velocity.y.toFixed(2)})`);
    } else {
      // Even during immunity, ensure ball is not inside wall
      if (ball.position.x - ball.radius < WALL_MARGIN) {
        ball.position.x = ball.radius + WALL_MARGIN + SAFETY_MARGIN;
        
        // Always ensure minimum velocity away from wall, even during immunity
        if (ball.velocity.x <= 0.5) {
          ball.velocity.x = MIN_WALL_BOUNCE_VELOCITY;
        }
      }
      console.log(`[DEBUG COLLISION] Skipping physics update due to immunity time`);
    }
    
    collided = true;
  }

  // Traitement spécial pour le sol - essentiel pour fixer le glitch
  if (ball.position.y + ball.radius > canvasHeight - WALL_MARGIN) {
    wall = "floor";
    
    if (shouldUpdatePhysics) {
      // IMPORTANT: S'assurer que la balle est exactement sur le sol avec une marge de sécurité
      ball.position.y = canvasHeight - ball.radius - WALL_MARGIN - SAFETY_MARGIN;
      
      // Force minimale pour éviter que la balle "colle" au sol
      const minBounceVelocity = MIN_WALL_BOUNCE_VELOCITY; // Using the constant for consistency
      
      // Si la vitesse est trop faible, ajouter une impulsion minimale
      if (Math.abs(ball.velocity.y) < minBounceVelocity) {
        ball.velocity.y = -minBounceVelocity;
      } else {
        // Sinon, rebond normal avec atténuation contrôlée
        ball.velocity.y = -Math.abs(ball.velocity.y) * currentBounciness;
      }
      
      // Appliquer une friction horizontale plus importante au sol
      ball.velocity.x *= DEFAULT_FRICTION;
      console.log(`[DEBUG COLLISION] After floor: velocity=(${ball.velocity.x.toFixed(2)}, ${ball.velocity.y.toFixed(2)})`);
    } else {
      // Even during immunity, ensure ball is not inside floor
      if (ball.position.y + ball.radius > canvasHeight - WALL_MARGIN) {
        ball.position.y = canvasHeight - ball.radius - WALL_MARGIN - SAFETY_MARGIN;
        
        // Always ensure minimum velocity away from floor, even during immunity
        if (ball.velocity.y >= -0.5) {
          ball.velocity.y = -MIN_WALL_BOUNCE_VELOCITY;
        }
      }
      console.log(`[DEBUG COLLISION] Skipping physics update due to immunity time`);
    }
    
    collided = true;
  } else if (ball.position.y - ball.radius < WALL_MARGIN) {
    wall = "ceiling";
    
    if (shouldUpdatePhysics) {
      // Corriger la position pour un contact exact avec le plafond avec une marge de sécurité
      ball.position.y = ball.radius + WALL_MARGIN + SAFETY_MARGIN;
      // Inverser la vélocité Y avec atténuation
      ball.velocity.y = Math.abs(ball.velocity.y) * currentBounciness;
      // Ensure minimum vertical velocity away from ceiling
      if (Math.abs(ball.velocity.y) < MIN_WALL_BOUNCE_VELOCITY) {
        ball.velocity.y = MIN_WALL_BOUNCE_VELOCITY;
      }
      // Appliquer une friction à la vélocité X
      ball.velocity.x *= WALL_TANGENTIAL_FRICTION;
      console.log(`[DEBUG COLLISION] After ceiling: velocity=(${ball.velocity.x.toFixed(2)}, ${ball.velocity.y.toFixed(2)})`);
    } else {
      // Even during immunity, ensure ball is not inside ceiling
      if (ball.position.y - ball.radius < WALL_MARGIN) {
        ball.position.y = ball.radius + WALL_MARGIN + SAFETY_MARGIN;
        
        // Always ensure minimum velocity away from ceiling, even during immunity
        if (ball.velocity.y <= 0.5) {
          ball.velocity.y = MIN_WALL_BOUNCE_VELOCITY;
        }
      }
      console.log(`[DEBUG COLLISION] Skipping physics update due to immunity time`);
    }
    
    collided = true;
  }

  if (collided && wall) {
    // Mettre à jour le temps de collision uniquement si nous mettons à jour la physique
    if (shouldUpdatePhysics) {
      ball.lastWallCollisionTime = currentTime;
      console.log(`[DEBUG COLLISION] Updated lastWallCollisionTime to ${currentTime}`);

      const newV = addRandomAngle(ball.velocity.x, ball.velocity.y);
      ball.velocity.x = newV.x;
      ball.velocity.y = newV.y;
      console.log(`[DEBUG COLLISION] After random angle: velocity=(${ball.velocity.x.toFixed(2)}, ${ball.velocity.y.toFixed(2)})`);
      
      // Grow the ball on collision
      const maxBallRadius = (Math.min(canvasWidth, canvasHeight) / 2) * MAX_BALL_RADIUS_FACTOR;
      const growthFactor = growthRate * 0.5; 
      const oldRadius = ball.radius;
      ball.radius = Math.min(ball.radius + growthFactor, maxBallRadius);
      console.log(`[DEBUG COLLISION] Ball grown from ${oldRadius.toFixed(2)} to ${ball.radius.toFixed(2)}`);
    }

    // Calculer le volume sonore en fonction de la vitesse d'impact
    const impactVolume = Math.min(initialSpeed / 15, 1) * bounceVolume * 0.3;
    console.log(`[DEBUG WALL SOUND] Initial speed ${initialSpeed.toFixed(2)} converted to impact volume ${impactVolume.toFixed(2)}`);
    
    // Toujours jouer le son, indépendamment de l'immunité physique
    if (standardSoundsEnabled) {
      try {
        // DEBUG: Afficher plus de détails sur les états sonores
        console.log(`[DEBUG WALL SOUND] Wall: ${wall}, useCustomSounds: ${useCustomSounds}, hasCustomWall: ${hasCustomSound('wall')}, impactVolume: ${impactVolume}`);
        
        // Vérifier si un son personnalisé est disponible
        if (useCustomSounds && hasCustomSound('wall')) {
          // Si un son personnalisé est disponible, utiliser seulement le son personnalisé
          console.log(`[DEBUG WALL SOUND] Playing custom wall sound for ${wall} collision`);
          playWallSound(impactVolume, true);
          
          // DEBUG: Validation après l'appel
          console.log(`[DEBUG WALL SOUND] Custom sound played with volume ${impactVolume}`);
        } else {
          // Si aucun son personnalisé n'est disponible, utiliser le son standard
          console.log(`[DEBUG WALL SOUND] Reason for standard sound: useCustomSounds=${useCustomSounds}, hasCustomSound('wall')=${hasCustomSound('wall')}`);
          console.log(`[DEBUG WALL SOUND] Using standard bounce sound for ${wall} collision`);
          playBounceSound(impactVolume);
        }
      } catch (e) {
        console.error(`[DEBUG WALL SOUND] Error playing wall collision sound:`, e);
      }
    } else {
      console.log(`[DEBUG WALL SOUND] Standard sounds disabled, no sound played`);
    }
    
    // Gestion MIDI
    if (midiEnabled && typeof playMIDINote === 'function' && hasMIDISequence()) {
      try {
        const normalizedSpeed = Math.min(1, initialSpeed / 15);
        const volume = 0.5 + normalizedSpeed * 0.5;
        
        // Jouer une note MIDI plus longue et plus audible
        playMIDINote(volume * midiVolume);
        
        // Ajouter un délai pour jouer une seconde note pour rendre le son plus reconnaissable
        if (normalizedSpeed > 0.5) {
          setTimeout(() => playMIDINote(volume * 0.8 * midiVolume), 150);
        }
      } catch (e) {
        console.error(`[BOUNCE-${wall}] Erreur MIDI:`, e);
      }
    }
  } else {
    console.log(`[DEBUG COLLISION] No wall collision detected`);
  }
};

// New function to prevent wall sticking by checking and fixing ball positions each frame
const preventWallSticking = (ball: EnhancedBall, canvasWidth: number, canvasHeight: number) => {
  const safetyMargin = ball.radius * 0.1 + 2; // More aggressive safety margin
  
  // Check and fix right wall sticking
  if (ball.position.x + ball.radius >= canvasWidth - WALL_MARGIN) {
    // Ball is touching or inside right wall
    ball.position.x = canvasWidth - ball.radius - WALL_MARGIN - safetyMargin;
    
    // If velocity is too low or heading toward wall, push it away
    if (ball.velocity.x >= -0.5) {
      ball.velocity.x = -MIN_WALL_BOUNCE_VELOCITY;
    }
  }
  
  // Check and fix left wall sticking
  if (ball.position.x - ball.radius <= WALL_MARGIN) {
    // Ball is touching or inside left wall
    ball.position.x = ball.radius + WALL_MARGIN + safetyMargin;
    
    // If velocity is too low or heading toward wall, push it away
    if (ball.velocity.x <= 0.5) {
      ball.velocity.x = MIN_WALL_BOUNCE_VELOCITY;
    }
  }
  
  // Check and fix floor sticking
  if (ball.position.y + ball.radius >= canvasHeight - WALL_MARGIN) {
    // Ball is touching or inside floor
    ball.position.y = canvasHeight - ball.radius - WALL_MARGIN - safetyMargin;
    
    // If velocity is too low or heading toward floor, push it up
    if (ball.velocity.y >= -0.5) {
      ball.velocity.y = -MIN_WALL_BOUNCE_VELOCITY;
    }
  }
  
  // Check and fix ceiling sticking
  if (ball.position.y - ball.radius <= WALL_MARGIN) {
    // Ball is touching or inside ceiling
    ball.position.y = ball.radius + WALL_MARGIN + safetyMargin;
    
    // If velocity is too low or heading toward ceiling, push it down
    if (ball.velocity.y <= 0.5) {
      ball.velocity.y = MIN_WALL_BOUNCE_VELOCITY;
    }
  }
};

useEffect(() => {
  if (isPlaying) {
    // Start the animation if it's not already running
    if (!requestRef.current) {
      initSound();
      
      // Set the MIDI tonality and instrument preset
      if (midiEnabled) {
        setMIDITonality(midiTonality);
        if (midiInstrumentPreset) {
          setMIDIInstrumentPreset(midiInstrumentPreset);
        }
        if (midiTrackIndex !== undefined) {
          setMIDITrackIndex(midiTrackIndex);
        }
        setMIDIVolume(midiVolume);
      }
      
      // Set progressive sound volume
      if (progressiveSoundEnabled && hasProgressiveSound()) {
        setProgressiveSoundVolume(progressiveSoundVolume);
      }
      
      // Create the initial balls only when game starts
      if (gameState.balls.length === 0) {
        const initialBalls: EnhancedBall[] = [];
        const canvas = canvasRef.current;
        
        if (canvas) {
          for (let i = 0; i < initialBallCount; i++) {
            // Create a ball with random position but constrained within the canvas
            const centerX = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
            const centerY = Math.random() * canvas.height * 0.8 + canvas.height * 0.1;
            
            const angle = Math.random() * Math.PI * 2;
            const speed = ballSpeed * (0.7 + Math.random() * 0.6); // Variation in speed
            
            // Give each ball a random direction
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            // Variation in size
            const radius = 20 + Math.random() * 15;
            
            // Randomly assign colors
            const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            // Assign an image if using custom images
            let imageIndex = -1;
            let ballImage = null;
            if (useCustomImages && customImages.length > 0 && loadedImages.length > 0) {
              // Use assigned image if available, otherwise random
              imageIndex = ballImageAssignments[i] !== undefined ? 
                ballImageAssignments[i] : 
                Math.floor(Math.random() * loadedImages.length);
              
              // Ensure index is within bounds
              imageIndex = Math.max(0, Math.min(loadedImages.length - 1, imageIndex));
              ballImage = loadedImages[imageIndex];
            }
            
            // Assign a music scale if music is enabled
            let musicScale: MusicScaleKey | CustomMusicKey | undefined = undefined;
            if (musicEnabled) {
              if (ballMusicAssignments[i]) {
                // Use assigned scale if available
                musicScale = ballMusicAssignments[i];
              } else {
                // Otherwise random scale
                const scales = Object.keys(MUSIC_SCALES) as MusicScaleKey[];
                musicScale = scales[Math.floor(Math.random() * scales.length)];
              }
            }
            
            const newBall: EnhancedBall = {
              id: `ball-${Date.now()}-${i}`,
              position: { x: centerX, y: centerY },
              velocity: { x: vx, y: vy },
              radius,
              color,
              image: ballImage,
              imageIndex: imageIndex,
              pulseEffect: 0,
              glowSize: 0, 
              glowOpacity: 0,
              squash: 0,
              rotation: 0,
              score: 0,
              lastCollisionTime: 0,
              lastWallCollisionTime: 0,
              growing: false,
              musicScale,
              // Masse proportionnelle au rayon
              mass: radius * radius * 0.01,
              // Élasticité aléatoire pour varier les rebonds
              elasticity: 0.8 + Math.random() * 0.2,
              // Légère rotation aléatoire
              angularVelocity: (Math.random() - 0.5) * 0.02,
              // Stocker la vitesse initiale pour maintenir constante (si besoin)
              initialSpeed: speed
            };
            
            initialBalls.push(newBall);
          }
          
          setGameState(prevState => ({
            ...prevState,
            balls: initialBalls,
            score: 0,
            isGameOver: false
          }));
        }
      }
      
      // Comme 'animate' est définie dans le composant, nous ne pouvons pas y référer directement ici
      // Nous devons juste lancer l'animation initiale et laisser la récursion fonctionner
      requestRef.current = requestAnimationFrame(() => {
        // La fonction animate sera appelée automatiquement lorsque le composant sera entièrement rendu
      });
    }
  } else {
    // Stop the animation
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
}, [isPlaying, ballCount, growthRate, gravity, ballSpeed]);  // Removed effectsEnabled from dependency array

// Helper function to convert hex color to RGB values
const hexToRgb = (hex: string): string => {
  // If already in RGB format, extract values
  if (hex.startsWith('rgb')) {
    return hex.replace(/^rgba?\(|\)$/g, '').split(',').slice(0, 3).join(',');
  }
  
  // Otherwise convert from hex
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `${r}, ${g}, ${b}`;
  }
  return '0, 0, 0'; // Default to black if invalid
};

// Create styles for recording controls
const recordingControlsStyles = {
  container: {
    position: 'absolute' as const,
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '10px',
    zIndex: 1000,
  },
  button: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: '20px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
  },
  recordButton: {
    backgroundColor: isRecording ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.7)',
  },
  downloadButton: {
    opacity: videoBlob ? 1 : 0.5,
    pointerEvents: videoBlob ? 'auto' : 'none' as React.CSSProperties['pointerEvents'],
  }
};

// Clean up animation on unmount
useEffect(() => {
  return () => {
    if (circleAnimationRef.current) {
      cancelAnimationFrame(circleAnimationRef.current);
    }
  };
}, []);

// Function to handle color change
const handleColorChange = (type: 'backgroundColor' | 'circleColor', value: string) => {
  setConfigSettings(prev => ({
    ...prev,
    [type]: value
  }));
  
  // Notify parent component
  if (type === 'backgroundColor' && onBackgroundColorChange) {
    onBackgroundColorChange(value);
  } else if (type === 'circleColor' && onCircleColorChange) {
    onCircleColorChange(value);
  }
};

// Function to handle toggle change
const handleToggleChange = (type: 'circleAnimationEnabled' | 'showRecordingControls') => {
  const newValue = !configSettings[type];
  
  setConfigSettings(prev => ({
    ...prev,
    [type]: newValue
  }));
  
  // Notify parent component
  if (type === 'circleAnimationEnabled' && onCircleAnimationEnabledChange) {
    onCircleAnimationEnabledChange(newValue);
  } else if (type === 'showRecordingControls' && onShowRecordingControlsChange) {
    onShowRecordingControlsChange(newValue);
  }
};

// Function to handle slider change
const handleSliderChange = (type: 'circleAnimationDuration', value: number) => {
  setConfigSettings(prev => ({
    ...prev,
    [type]: value
  }));
  
  // Notify parent component
  if (type === 'circleAnimationDuration' && onCircleAnimationDurationChange) {
    onCircleAnimationDurationChange(value);
  }
};

// Function to create a style attribute for the toggle slider
const getToggleStyles = (toggled: boolean) => {
  return {
    position: 'absolute' as const,
    cursor: 'pointer',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: toggled ? '#f85c2c' : '#ccc',
    transition: '.4s',
    borderRadius: '34px',
    '&:before': {
      content: '""',
      position: 'absolute' as const,
      height: '16px',
      width: '16px',
      left: toggled ? '18px' : '2px',
      bottom: '2px',
      backgroundColor: 'white',
      transition: '.4s',
      borderRadius: '50%',
    },
  };
};

// Add a toggle button for the config panel
const configButtonStyle = {
  position: 'absolute' as const,
  top: '10px',
  left: '10px',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  border: 'none',
  borderRadius: '50%',
  width: '40px',
  height: '40px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
  fontSize: '20px',
  boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
  zIndex: 1000,
};

// Styles for the config panel
const configPanelStyles = {
  container: {
    position: 'absolute' as const,
    top: '10px',
    right: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '10px',
    padding: '15px',
    width: '250px',
    color: 'white',
    zIndex: 1000,
    backdropFilter: 'blur(5px)',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    transition: 'all 0.3s ease',
  },
  title: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
    paddingBottom: '8px',
  },
  group: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontSize: '14px',
  },
  colorPicker: {
    width: '100%',
    height: '30px',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  toggleContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  toggle: {
    position: 'relative' as const,
    width: '40px',
    height: '20px',
  },
  toggleInput: {
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleSlider: {
    position: 'absolute' as const,
    cursor: 'pointer',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ccc',
    transition: '.4s',
    borderRadius: '34px',
    '&:before': {
      position: 'absolute',
      content: '',
      height: '16px',
      width: '16px',
      left: '2px',
      bottom: '2px',
      backgroundColor: 'white',
      transition: '.4s',
      borderRadius: '50%',
    },
  },
  rangeContainer: {
    width: '100%',
    marginTop: '5px',
  },
  rangeInput: {
    width: '100%',
    accentColor: '#f85c2c',
  },
  rangeValue: {
    fontSize: '12px',
    textAlign: 'right' as const,
    marginTop: '2px',
  },
  button: {
    backgroundColor: '#f85c2c',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    padding: '8px 12px',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
    marginTop: '10px',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#e64c17',
    },
  },
};

// Return the JSX canvas element with recording controls and config panel
return (
  <div 
    className="growing-ball-game" 
    style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      width: '100%',
      height: '100%',
      position: 'relative'
    }}
  >
    <canvas 
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{ 
        display: 'block', 
        background: configSettings.backgroundColor, 
        touchAction: 'none',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 0 10px rgba(0,0,0,0.5)'
      }}
    />
    {isRecording && (
      <div style={recordingStyles.container}>
        <div style={recordingStyles.recordIcon}></div>
        <div style={recordingStyles.time}>{formatRecordingTime(recordingTime)}</div>
      </div>
    )}
    {configSettings.showRecordingControls && (
      <div style={recordingControlsStyles.container}>
        <button 
          onClick={toggleRecording} 
          style={{...recordingControlsStyles.button, ...recordingControlsStyles.recordButton}}
          title={isRecording ? "Stop Recording" : "Start Recording"}
        >
          {isRecording ? '◼' : '⚫'}
        </button>
        <button 
          onClick={handleDownloadVideo} 
          style={{...recordingControlsStyles.button, ...recordingControlsStyles.downloadButton}}
          title="Download Video"
          disabled={!videoBlob}
        >
          ⬇️
        </button>
      </div>
    )}
    <button 
      onClick={() => setIsConfigPanelVisible(!isConfigPanelVisible)}
      style={configButtonStyle}
      title="Settings"
    >
      ⚙️
    </button>
    {isConfigPanelVisible && (
      <div style={configPanelStyles.container}>
        <div style={configPanelStyles.title}>Game Settings</div>
        
        <div style={configPanelStyles.group}>
          <label style={configPanelStyles.label}>Background Color</label>
          <input 
            type="color" 
            value={configSettings.backgroundColor} 
            onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
            style={configPanelStyles.colorPicker}
          />
        </div>
        
        <div style={configPanelStyles.group}>
          <label style={configPanelStyles.label}>Circle Color</label>
          <input 
            type="color" 
            value={configSettings.circleColor.startsWith('rgba') 
              ? '#' + configSettings.circleColor.replace(/^rgba\((\d+),\s*(\d+),\s*(\d+).*$/, 
                 (_, r, g, b) => {
                   return ((1 << 24) + (parseInt(r) << 16) + (parseInt(g) << 8) + parseInt(b)).toString(16).slice(1);
                 }) 
              : configSettings.circleColor}
            onChange={(e) => handleColorChange('circleColor', e.target.value)}
            style={configPanelStyles.colorPicker}
          />
        </div>
        
        <div style={configPanelStyles.toggleContainer}>
          <span>Circle Animation</span>
          <label style={configPanelStyles.toggle}>
            <input 
              type="checkbox" 
              checked={configSettings.circleAnimationEnabled} 
              onChange={() => handleToggleChange('circleAnimationEnabled')}
              style={configPanelStyles.toggleInput}
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: configSettings.circleAnimationEnabled ? '#f85c2c' : '#ccc',
              transition: '.4s',
              borderRadius: '34px',
            }}>
              <span style={{
                position: 'absolute',
                content: '""',
                height: '16px',
                width: '16px',
                left: configSettings.circleAnimationEnabled ? '18px' : '2px',
                bottom: '2px',
                backgroundColor: 'white',
                transition: '.4s',
                borderRadius: '50%',
              }}></span>
            </span>
          </label>
        </div>
        
        {configSettings.circleAnimationEnabled && (
          <div style={configPanelStyles.group}>
            <label style={configPanelStyles.label}>Animation Duration: {configSettings.circleAnimationDuration}ms</label>
            <div style={configPanelStyles.rangeContainer}>
              <input 
                type="range" 
                min="100" 
                max="2000" 
                step="50" 
                value={configSettings.circleAnimationDuration} 
                onChange={(e) => handleSliderChange('circleAnimationDuration', parseInt(e.target.value))}
                style={configPanelStyles.rangeInput}
              />
            </div>
          </div>
        )}
        
        <div style={configPanelStyles.toggleContainer}>
          <span>Recording Controls</span>
          <label style={configPanelStyles.toggle}>
            <input 
              type="checkbox" 
              checked={configSettings.showRecordingControls} 
              onChange={() => handleToggleChange('showRecordingControls')}
              style={configPanelStyles.toggleInput}
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: configSettings.showRecordingControls ? '#f85c2c' : '#ccc',
              transition: '.4s',
              borderRadius: '34px',
            }}>
              <span style={{
                position: 'absolute',
                content: '""',
                height: '16px',
                width: '16px',
                left: configSettings.showRecordingControls ? '18px' : '2px',
                bottom: '2px',
                backgroundColor: 'white',
                transition: '.4s',
                borderRadius: '50%',
              }}></span>
            </span>
          </label>
        </div>
        
        <button 
          style={{
            backgroundColor: '#f85c2c',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            padding: '8px 12px',
            fontSize: '14px',
            cursor: 'pointer',
            width: '100%',
            marginTop: '10px',
          }}
          onClick={() => {
            // Reset to prop default values
            const defaultSettings = {
              backgroundColor,
              circleColor,
              circleAnimationEnabled,
              circleAnimationDuration,
              showRecordingControls
            };
            
            setConfigSettings(defaultSettings);
            
            // Notify parent components
            if (onBackgroundColorChange) onBackgroundColorChange(backgroundColor);
            if (onCircleColorChange) onCircleColorChange(circleColor);
            if (onCircleAnimationEnabledChange) onCircleAnimationEnabledChange(circleAnimationEnabled);
            if (onCircleAnimationDurationChange) onCircleAnimationDurationChange(circleAnimationDuration);
            if (onShowRecordingControlsChange) onShowRecordingControlsChange(showRecordingControls);
          }}
        >
          Reset to Default
        </button>
      </div>
    )}
  </div>
);
};

export default GrowingBall;


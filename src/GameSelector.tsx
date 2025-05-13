import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GameType, Ball, Vector2D } from './types';
import GrowingBall from './games/GrowingBall';
import RotatingCircle from './games/RotatingCircle';
import TrailBall from './games/TrailBall';
import CollapsingCircles from './games/CollapsingCircles';
import CollapsingRotatingCircles, { 
  ExitStyle, 
  ParticleStyle,
  CircleTheme
} from './games/CollapsingRotatingCircles';
import { 
  playGameStartSound, 
  playGameOverSound, 
  initSound, 
  loadCustomSound, 
  hasCustomSound, 
  clearCustomSound,
  MUSIC_SCALES,
  loadCustomMusicScale,
  hasCustomMusicScale,
  clearCustomMusicScale,
  CustomMusicKey,
  loadBackgroundMusic,
  playBackgroundMusic,
  pauseBackgroundMusic,
  setBackgroundMusicVolume,
  hasBackgroundMusic,
  isBackgroundMusicActive,
  loadProgressiveSound,
  playNextProgressiveSoundPart,
  hasProgressiveSound,
  clearProgressiveSound,
  convertAudioToMusicScale,
  setStandardSoundsEnabled,
  getStandardSoundsEnabled,
  loadMusicSequence,
  playNextExtractedNote,
  hasExtractedNotes,
  enableExtractedNotes,
  disableExtractedNotes,
  resetExtractedNotes,
  stopAllSounds,
  playMIDINote,
  hasMIDISequence,
  clearMIDISequence,
  setMIDIVolume,
  loadMIDIFile,
  setMIDITonality,
  setMIDIInstrumentPreset,
  MIDI_INSTRUMENT_PRESETS,
  MIDIInstrumentPresetKey
} from './utils/sounds';
import * as Tone from 'tone';

// Physics presets optimized for controlled bouncing (with speed caps)
const physicsPresets = {
  satisfying: {
    name: "Satisfying",
    gravity: 1.2,
    growthRate: 0.8,
    bounciness: 0.85,
    ballSpeed: 7.0
  },
  slowMo: {
    name: "Slow Motion",
    gravity: 0.8,
    growthRate: 0.5,
    bounciness: 0.8,
    ballSpeed: 5.0
  },
  chaotic: {
    name: "Chaotic",
    gravity: 1.4,
    growthRate: 0.9,
    bounciness: 0.8,
    ballSpeed: 8.0
  },
  tiktokViral: {
    name: "TikTok Viral",
    gravity: 1.3,
    growthRate: 1.2,
    bounciness: 0.85,
    ballSpeed: 7.5
  }
};

// Types de sons disponibles
const soundTypes = ['bounce', 'grow', 'gameOver', 'wall'] as const;
type SoundType = typeof soundTypes[number];

// Mapping des noms conviviaux pour les types de sons
const soundTypeNames: Record<string, string> = {
  bounce: "de rebond",
  grow: "de croissance",
  gameOver: "de fin de jeu",
  wall: "de collision avec mur"
};

// Définition du type TabType avant le composant
type TabType = 'physics' | 'effects' | 'images' | 'sounds' | 'music' | 'sequence' | 'midi';

const GameSelector: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Déplacer la déclaration du state activeTab à l'intérieur du composant
  const [activeTab, setActiveTab] = useState<TabType>('physics');
  
  // Physics settings for GrowingBall
  const [gravity, setGravity] = useState(physicsPresets.satisfying.gravity);
  const [growthRate, setGrowthRate] = useState(physicsPresets.satisfying.growthRate);
  const [bounciness, setBounciness] = useState(physicsPresets.satisfying.bounciness);
  const [ballSpeed, setBallSpeed] = useState(physicsPresets.satisfying.ballSpeed);
  const [activePreset, setActivePreset] = useState("satisfying");
  
  // Ball count setting
  const [ballCount, setBallCount] = useState(1);
  
  // Visual effects and gameplay toggles
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [ballCollisionsEnabled, setBallCollisionsEnabled] = useState(true);
  const [scoreTrackingEnabled, setScoreTrackingEnabled] = useState(true);
  const [bgEffectsEnabled, setBgEffectsEnabled] = useState(true);
  
  // Custom images settings
  const [useCustomImages, setUseCustomImages] = useState(false);
  const [customImages, setCustomImages] = useState<string[]>([]);
  const [uploadedImagePreviews, setUploadedImagePreviews] = useState<string[]>([]);
  const [ballImageAssignments, setBallImageAssignments] = useState<number[]>([]);
  const [showImageAssignment, setShowImageAssignment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom sound settings
  const [useCustomSounds, setUseCustomSounds] = useState(false);
  const [soundFiles, setSoundFiles] = useState<{[key in SoundType]?: File}>({});
  const soundFileRefs = {
    bounce: useRef<HTMLInputElement>(null),
    grow: useRef<HTMLInputElement>(null),
    gameOver: useRef<HTMLInputElement>(null),
    wall: useRef<HTMLInputElement>(null)
  };
  
  // Music settings
  const [musicEnabled, setMusicEnabled] = useState<boolean>(false);
  const [ballMusicAssignments, setBallMusicAssignments] = useState<{
    [key: number]: keyof typeof MUSIC_SCALES | CustomMusicKey
  }>({
    0: 'majorScale',
    1: 'minorScale',
    2: 'pentatonic',
    3: 'blues',
    4: 'eastern'
  });
  const [customMusicScales, setCustomMusicScales] = useState<{[key: string]: File[]}>({});
  const [showCustomMusicUpload, setShowCustomMusicUpload] = useState<boolean>(false);
  const musicFileRef = useRef<HTMLInputElement>(null);
  const [customScaleName, setCustomScaleName] = useState<string>('');
  
  // Background music settings
  const [backgroundMusicFile, setBackgroundMusicFile] = useState<File | null>(null);
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState<boolean>(false);
  const [backgroundMusicVolume, setBackgroundMusicVolume] = useState<number>(0.5);
  const backgroundMusicRef = useRef<HTMLInputElement>(null);
  
  // Progressive sound settings
  const [progressiveSoundFile, setProgressiveSoundFile] = useState<File | null>(null);
  const [progressiveSoundEnabled, setProgressiveSoundEnabled] = useState<boolean>(false);
  const progressiveSoundRef = useRef<HTMLInputElement>(null);
  
  // Music conversion settings
  const [numNotesToExtract, setNumNotesToExtract] = useState<number>(8);
  const conversionFileRef = useRef<HTMLInputElement>(null);
  
  // États pour les options audio avancées
  const [standardSoundsEnabled, setStandardSoundsEnabled] = useState<boolean>(true);
  
  // Références pour les éléments d'upload de fichiers
  const soundFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const customMusicFileInputRef = useRef<HTMLInputElement>(null);
  const musicConversionRef = useRef<HTMLInputElement>(null);
  
  // États pour la séquence musicale extraite
  const [extractedMusicEnabled, setExtractedMusicEnabled] = useState<boolean>(false);
  const [extractedMusicFile, setExtractedMusicFile] = useState<File | null>(null);
  const [extractedNotesCount, setExtractedNotesCount] = useState<number>(16);
  const extractedMusicRef = useRef<HTMLInputElement>(null);
  
  // Add a state for bounce volume in GameSelector
  const [bounceVolume, setBounceVolume] = useState<number>(0.1); // Réduit de 0.3 à 0.1
  // Add a state for progressive sound volume in GameSelector 
  const [progressiveSoundVolume, setProgressiveSoundVolume] = useState<number>(0.7);
  
  // Nouveaux états pour la conversion MIDI
  const [midiEnabled, setMidiEnabled] = useState<boolean>(true); // Activé par défaut
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [midiVolume, setMidiVolume] = useState<number>(0.7);
  const [midiTonality, setMidiTonality] = useState<string>("C");
  const [midiInstrumentPreset, setMidiInstrumentPreset] = useState<MIDIInstrumentPresetKey>(MIDI_INSTRUMENT_PRESETS.DEFAULT_CYCLING);
  const midiFileRef = useRef<HTMLInputElement>(null);
  
  // Ajouter les états pour les sons de destruction de porte (cercles rotatifs)
  const [rotatingCirclesPlayMidiOnDoorDestroy, setRotatingCirclesPlayMidiOnDoorDestroy] = useState<boolean>(false);
  const [rotatingCirclesMidiVolume, setRotatingCirclesMidiVolume] = useState<number>(0.7);
  const [rotatingCirclesPlayMusicOnDoorDestroy, setRotatingCirclesPlayMusicOnDoorDestroy] = useState<boolean>(true);
  const [rotatingCirclesDoorDestroyMusicVolume, setRotatingCirclesDoorDestroyMusicVolume] = useState<number>(0.5);
  
  // Add rainbow circle properties
  const [useRainbowCircles, setUseRainbowCircles] = useState<boolean>(false);
  const [circleStrokeWidth, setCircleStrokeWidth] = useState<number>(5);
  const [animateRainbow, setAnimateRainbow] = useState<boolean>(true);
  // Circle theme properties
  const [circleTheme, setCircleTheme] = useState<CircleTheme>(CircleTheme.DEFAULT);
  const [customCircleColor, setCustomCircleColor] = useState<string>('#ff0000');
  const [glowIntensity, setGlowIntensity] = useState<number>(0.5);
  const [gradientSpeed, setGradientSpeed] = useState<number>(1.0);
  
  // Ball customization properties
  const [customBallColor, setCustomBallColor] = useState<string>('#ff4500');
  const [ballHasTrail, setBallHasTrail] = useState<boolean>(false);
  const [ballTrailColor, setBallTrailColor] = useState<string>('#ffffff');
  const [ballTrailLength, setBallTrailLength] = useState<number>(10);
  const [ballStrokeWidth, setBallStrokeWidth] = useState<number>(2);
  const [ballStrokeColor, setBallStrokeColor] = useState<string>('#ffffff');
  const [ballHasGlow, setBallHasGlow] = useState<boolean>(false);
  const [ballGlowColor, setBallGlowColor] = useState<string>('#ff0000');
  const [ballGlowSize, setBallGlowSize] = useState<number>(5);
  const [ballTheme, setBallTheme] = useState<'default' | 'rainbow' | 'fire' | 'ice' | 'neon'>('default');
  
  // Ajout des états manquants pour la fonction de rendu
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Ajout de l'état pour le décalage progressif des portes
  const [progressiveRotationOffset, setProgressiveRotationOffset] = useState(0); // 0% par défaut

  // Ajout de l'état pour le nombre de balles à créer lors de la destruction d'un cercle
  const [ballsOnDestroy, setBallsOnDestroy] = useState(0); // 0 par défaut

  // Ajout de l'état pour l'espace minimum entre les cercles
  const [minCircleGap, setMinCircleGap] = useState(15);

  // Ajout de l'état pour la taille du cercle de base
  const [baseBallRadius, setBaseBallRadius] = useState(15);

  // Ajout de l'état pour la taille minimale d'un cercle
  const [minCircleRadius, setMinCircleRadius] = useState(40);

  // Ajout de l'état pour limiter le nombre maximum de balles
  const [maxBallCount, setMaxBallCount] = useState(20);

  // Ajouter les états pour les styles de porte et de particules
  const [exitStyle, setExitStyle] = useState<ExitStyle>(ExitStyle.STANDARD);
  const [particleStyle, setParticleStyle] = useState<ParticleStyle>(ParticleStyle.STANDARD);

  // Ajouter les nouveaux états dans le composant GameSelector
  const [customEndMessage, setCustomEndMessage] = useState("VICTOIRE !");
  const [showFinalScore, setShowFinalScore] = useState(true);

  // Ajouter un référence pour le son personnalisé de porte de sortie
  const exitSoundFileInputRef = useRef<HTMLInputElement>(null);

  // Ajout des états manquants
  const [initialCircleCount, setInitialCircleCount] = useState(5);
  const [circleGap, setCircleGap] = useState(40);
  const [exitSize, setExitSize] = useState(30);
  const [rotationSpeed, setRotationSpeed] = useState(0.01);
  const [maxBallSpeed, setMaxBallSpeed] = useState(8);
  const [shrinkCirclesOnDestroy, setShrinkCirclesOnDestroy] = useState(true);
  const [shrinkFactor, setShrinkFactor] = useState(0.8);

  // Fonctions pour gérer les changements de style
  const handleExitStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setExitStyle(e.target.value as ExitStyle);
  };

  const handleParticleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setParticleStyle(e.target.value as ParticleStyle);
  };

  // Fonction pour gérer le changement de l'espace minimum entre les cercles
  const handleMinCircleGapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinCircleGap(parseInt(e.target.value));
  };

  // Fonction pour gérer le changement de la taille du cercle de base
  const handleBaseBallRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBaseBallRadius(parseInt(e.target.value));
  };

  // Fonction pour gérer le changement de la taille minimale d'un cercle
  const handleMinCircleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinCircleRadius(parseInt(e.target.value));
  };

  // Fonction pour gérer le changement du nombre maximal de balles
  const handleMaxBallCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxBallCount(parseInt(e.target.value));
  };

  // Initialisation des références pour les éléments d'upload
  useEffect(() => {
    soundTypes.forEach(type => {
      soundFileInputRefs.current[type] = document.querySelector(`#${type}FileInput`);
    });
  }, []);
  
  // Appliquer l'état des sons standards au système sonore
  useEffect(() => {
    setStandardSoundsEnabled(standardSoundsEnabled);
  }, [standardSoundsEnabled]);
  
  const handleGameSelect = (gameType: GameType) => {
    // Initialize sound on first interaction
    initSound();
    
    setSelectedGame(gameType);
    setIsPlaying(false);
    
    // Set the appropriate physics preset based on game type
    if (gameType === GameType.COLLAPSING_CIRCLES) {
      // You might want to apply a specific preset for CollapsingCircles if needed
      // For now, we'll use the default or let the user choose.
      setActivePreset("satisfying"); // Or any other default you prefer
    }
  };
  
  const handleStartGame = () => {
    // Vérifier qu'un jeu est sélectionné avant de commencer
    if (!selectedGame) {
      console.error("Tentative de démarrer un jeu alors qu'aucun n'est sélectionné");
      return;
    }
    
    // Arrêter tous les sons avant de démarrer le jeu
    stopAllSounds();
    
    // Initialiser le système MIDI si activé
    if (midiEnabled) {
      console.log("Initialisation du système MIDI avant le démarrage");
      // Forcer l'initialisation des notes MIDI par défaut
      hasMIDISequence();
      setMIDIVolume(midiVolume);
      // Appliquer les paramètres d'instrument et de tonalité
      setMIDIInstrumentPreset(midiInstrumentPreset);
      setMIDITonality(midiTonality);
      // Jouer une note MIDI pour initialiser le système
      try {
        playMIDINote(midiVolume);
      } catch (e) {
        console.error("Erreur lors de l'initialisation du système MIDI:", e);
      }
    }
    
    // Reset game state before starting
    setIsPlaying(true);
    playGameStartSound();
  };
  
  const handleStopGame = () => {
    // First stop all sounds
    stopAllSounds();
    // Then update the game state
    setIsPlaying(false);
    setTimeout(() => {
      playGameOverSound(useCustomSounds);
    }, 100);
  };
  
  const handleResetGame = () => {
    // Stop sounds and set playing to false first
    stopAllSounds();
    setIsPlaying(false);
    
    // Force a small delay to ensure the game fully stops before restarting
    setTimeout(() => {
      setIsPlaying(true);
      playGameStartSound();
    }, 300); // Un délai plus long pour assurer une réinitialisation complète
  };
  
  const handleGameEnd = () => {
    setIsPlaying(false);
  };

  const handleBackToMenu = () => {
    // Arrêter le jeu d'abord
    stopAllSounds();
    setIsPlaying(false);
    
    // Retourner au menu principal en réinitialisant le jeu sélectionné
    setSelectedGame(null);
  };
  
  const handleGravityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGravity(parseFloat(e.target.value));
    setActivePreset("custom");
  };
  
  const handleGrowthRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGrowthRate(parseFloat(e.target.value));
    setActivePreset("custom");
  };
  
  const handleBouncinessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBounciness(parseFloat(e.target.value));
    setActivePreset("custom");
  };
  
  const handleBallSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBallSpeed(parseFloat(e.target.value));
    setActivePreset("custom");
  };
  
  const handleInitialCircleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value);
    setInitialCircleCount(count);
  };

  const handleCircleGapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const gap = parseInt(e.target.value);
    setCircleGap(gap);
  };

  const handleExitSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const size = parseInt(e.target.value);
    setExitSize(size);
  };

  const handleRotationSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseFloat(e.target.value);
    setRotationSpeed(speed);
  };
  
  const handleProgressiveRotationOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProgressiveRotationOffset(parseFloat(e.target.value));
  };
  
  const handleBallCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value);
    setBallCount(count);
    
    // Réinitialiser les assignations d'images si nécessaire
    if (ballImageAssignments.length > count) {
      setBallImageAssignments(prev => prev.slice(0, count));
    } else if (ballImageAssignments.length < count) {
      const newAssignments = [...ballImageAssignments];
      for (let i = ballImageAssignments.length; i < count; i++) {
        newAssignments.push(-1); // -1 = image aléatoire
      }
      setBallImageAssignments(newAssignments);
    }
  };
  
  const handleEffectsToggle = () => {
    setEffectsEnabled(!effectsEnabled);
  };
  
  const handleBallCollisionsToggle = () => {
    setBallCollisionsEnabled(!ballCollisionsEnabled);
  };
  
  const handleScoreTrackingToggle = () => {
    setScoreTrackingEnabled(!scoreTrackingEnabled);
  };
  
  const handleBgEffectsToggle = () => {
    setBgEffectsEnabled(!bgEffectsEnabled);
  };
  
  const handleCustomImagesToggle = () => {
    setUseCustomImages(!useCustomImages);
    if (!useCustomImages && customImages.length > 0) {
      // Si on active les images personnalisées et qu'il y a des images, 
      // initialiser les assignations à -1 (aléatoire) par défaut
      const defaultAssignments = Array(ballCount).fill(-1);
      setBallImageAssignments(defaultAssignments);
    }
  };
  
  const handleCustomSoundsToggle = () => {
    const newValue = !useCustomSounds;
    setUseCustomSounds(newValue);
    // Synchroniser également l'état pour les sons des cercles rotatifs
    setUseCirclesCustomSounds(newValue);
  };
  
  const handleImageAssignmentToggle = () => {
    setShowImageAssignment(!showImageAssignment);
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newImages: string[] = [];
    const newPreviews: string[] = [];
    
    Array.from(files).forEach(file => {
      const imageUrl = URL.createObjectURL(file);
      newImages.push(imageUrl);
      newPreviews.push(imageUrl);
    });
    
    setCustomImages(prev => [...prev, ...newImages]);
    setUploadedImagePreviews(prev => [...prev, ...newPreviews]);
  };
  
  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>, soundType: SoundType) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSoundFiles(prev => ({
        ...prev,
        [soundType]: file
      }));
      console.log(`Son ${soundType} chargé:`, file.name);
    }
  };
  
  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const triggerSoundUpload = (soundType: SoundType) => {
    if (soundFileRefs[soundType] && soundFileRefs[soundType].current) {
      soundFileRefs[soundType].current?.click();
    }
  };
  
  const removeImage = (index: number) => {
    // Supprimer l'image
    setCustomImages(prev => prev.filter((_, i) => i !== index));
    setUploadedImagePreviews(prev => prev.filter((_, i) => i !== index));
    
    // Mettre à jour les assignations d'images
    const updatedAssignments = [...ballImageAssignments];
    for (let i = 0; i < updatedAssignments.length; i++) {
      if (updatedAssignments[i] === index) {
        // Si cette balle utilisait l'image supprimée, la mettre à -1 (aléatoire)
        updatedAssignments[i] = -1;
      } else if (updatedAssignments[i] > index) {
        // Si cette balle utilisait une image avec un index supérieur, décrémenter l'index
        updatedAssignments[i]--;
      }
    }
    setBallImageAssignments(updatedAssignments);
  };
  
  const removeSoundFile = (soundType: SoundType) => {
    setSoundFiles(prev => {
      const newSounds = { ...prev };
      delete newSounds[soundType];
      return newSounds;
    });
    
    const inputElement = document.querySelector(`#${soundType}FileInput`) as HTMLInputElement;
    if (inputElement) {
      inputElement.value = '';
    }
  };
  
  const assignImageToBall = (ballIndex: number, imageIndex: number) => {
    const newAssignments = [...ballImageAssignments];
    newAssignments[ballIndex] = imageIndex;
    setBallImageAssignments(newAssignments);
  };
  
  const applyPreset = (presetKey: string) => {
    const preset = physicsPresets[presetKey as keyof typeof physicsPresets];
    if (preset) {
      setGravity(preset.gravity);
      setGrowthRate(preset.growthRate);
      setBounciness(preset.bounciness);
      setBallSpeed(preset.ballSpeed);
      setActivePreset(presetKey);
    }
  };
  
  const handleMusicEnabledToggle = () => {
    setMusicEnabled(!musicEnabled);
  };
  
  const updateBallMusicAssignment = (ballIndex: number, scale: keyof typeof MUSIC_SCALES | CustomMusicKey) => {
    setBallMusicAssignments(prev => ({
      ...prev,
      [ballIndex]: scale
    }));
  };
  
  const handleCustomMusicToggle = () => {
    setShowCustomMusicUpload(!showCustomMusicUpload);
  };
  
  const handleMusicFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const musicFiles = Array.from(files);
    
    // Vérifier qu'un nom est défini
    if (!customScaleName.trim()) {
      alert("Veuillez définir un nom pour cette gamme musicale");
      return;
    }
    
    // Stocker les fichiers
    setCustomMusicScales(prev => ({
      ...prev,
      [customScaleName]: musicFiles
    }));
    
    // Charger les fichiers audio
    loadCustomMusicScale(musicFiles, customScaleName);
    
    // Réinitialiser le champ
    e.target.value = '';
    setCustomScaleName('');
  };
  
  const triggerMusicFileUpload = () => {
    if (musicFileRef.current) {
      musicFileRef.current.click();
    }
  };
  
  const removeCustomMusicScale = (name: string) => {
    setCustomMusicScales(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
    
    // Supprimer la gamme musicale
    clearCustomMusicScale(name);
    
    // Mettre à jour les assignations si nécessaire
    setBallMusicAssignments(prev => {
      const updated = { ...prev };
      
      // Remplacer les assignations pour cette gamme
      Object.keys(updated).forEach(ballIndex => {
        if (updated[parseInt(ballIndex)] === name) {
          updated[parseInt(ballIndex)] = 'majorScale';
        }
      });
      
      return updated;
    });
  };
  
  // Gérer la musique de fond lors du démarrage/arrêt du jeu
  useEffect(() => {
    if (isPlaying && backgroundMusicEnabled) {
      playBackgroundMusic();
    } else {
      pauseBackgroundMusic();
    }
  }, [isPlaying, backgroundMusicEnabled]);
  
  // Gérer le volume de la musique de fond
  useEffect(() => {
    setBackgroundMusicVolume(backgroundMusicVolume);
  }, [backgroundMusicVolume]);
  
  const handleBackgroundMusicToggle = () => {
    const newState = !backgroundMusicEnabled;
    setBackgroundMusicEnabled(newState);
    
    if (newState && isPlaying && hasBackgroundMusic()) {
      playBackgroundMusic();
    } else {
      pauseBackgroundMusic();
    }
  };
  
  const handleBackgroundMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setBackgroundMusicFile(file);
    
    // Charger la musique de fond
    loadBackgroundMusic(file);
    
    // Activer la musique si elle ne l'est pas déjà
    if (!backgroundMusicEnabled) {
      setBackgroundMusicEnabled(true);
    }
    
    // Jouer la musique si le jeu est en cours
    if (isPlaying) {
      playBackgroundMusic();
    }
    
    // Réinitialiser le champ
    e.target.value = '';
  };
  
  const triggerBackgroundMusicUpload = () => {
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.click();
    }
  };
  
  const handleProgressiveSoundToggle = () => {
    setProgressiveSoundEnabled(!progressiveSoundEnabled);
  };
  
  const handleProgressiveSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setProgressiveSoundFile(file);
    
    // Charger le son progressif
    loadProgressiveSound(file);
    
    // Activer le son progressif si ce n'est pas déjà fait
    if (!progressiveSoundEnabled) {
      setProgressiveSoundEnabled(true);
    }
    
    // Réinitialiser le champ
    e.target.value = '';
  };
  
  const triggerProgressiveSoundUpload = () => {
    console.log("Attempting to trigger file upload");
    if (progressiveSoundRef.current) {
      progressiveSoundRef.current.click();
    } else {
      console.error("progressiveSoundRef is not available");
    }
  };
  
  const clearProgressiveSoundFile = () => {
    setProgressiveSoundFile(null);
    clearProgressiveSound();
  };
  
  const handleMusicConversion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!customScaleName.trim()) {
      alert("Veuillez définir un nom pour cette gamme musicale avant de convertir");
      return;
    }
    
    try {
      // Afficher un message de chargement
      alert("Conversion en cours... Veuillez patienter.");
      
      // Convertir le fichier audio en gamme musicale (extrait les notes de l'ensemble du fichier)
      const musicScale = await convertAudioToMusicScale(file, numNotesToExtract);
      
      // Créer des fichiers audio synthétiques pour chaque note en utilisant Tone.js
      const audioFiles: File[] = [];
      
      // Créer un contexte audio temporaire pour générer les sons
      const context = new AudioContext();
      
      // Générer un son pour chaque note
      for (const note of musicScale) {
        // 1. Créer un oscillateur avec Tone.js
        const synth = new Tone.Synth().toDestination();
        
        // 2. Configurer la durée de l'enregistrement
        const duration = 1; // 1 seconde
        
        // 3. Créer un processor pour l'enregistrement
        const processor = context.createScriptProcessor(2048, 1, 1);
        const chunks: Float32Array[] = [];
        
        // 4. Capturer l'audio
        processor.onaudioprocess = (e) => {
          const channel = e.inputBuffer.getChannelData(0);
          chunks.push(new Float32Array(channel));
        };
        
        // 5. Connecter le processor au contexte
        processor.connect(context.destination);
        
        // 6. Jouer la note
        synth.triggerAttackRelease(note, duration);
        
        // 7. Attendre la fin de la lecture
        await new Promise(resolve => setTimeout(resolve, duration * 1000));
        
        // 8. Arrêter l'enregistrement
        processor.disconnect();
        
        // 9. Convertir les chunks en un buffer audio
        let totalLength = 0;
        for (const chunk of chunks) {
          totalLength += chunk.length;
        }
        
        const audioBuffer = context.createBuffer(1, totalLength, context.sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        let offset = 0;
        for (const chunk of chunks) {
          channelData.set(chunk, offset);
          offset += chunk.length;
        }
        
        // 10. Convertir le buffer en blob
        const blob = await audioBufferToWave(audioBuffer, context.sampleRate);
        
        // 11. Créer un fichier à partir du blob
        const audioFile = new File([blob], `${note}.wav`, { type: 'audio/wav' });
        audioFiles.push(audioFile);
      }
      
      // Charger la gamme musicale avec les fichiers créés
      loadCustomMusicScale(audioFiles, customScaleName);
      
      // Mettre à jour l'état
      setCustomMusicScales(prev => ({
        ...prev,
        [customScaleName]: audioFiles
      }));
      
      // Réinitialiser le champ
      e.target.value = '';
      setCustomScaleName('');
      
      alert(`Gamme musicale "${customScaleName}" créée avec ${musicScale.length} notes: ${musicScale.join(', ')}`);
    } catch (err) {
      console.error('Error converting audio to music scale:', err);
      alert("Erreur lors de la conversion. Veuillez réessayer.");
    }
  };
  
  // Fonction utilitaire pour convertir un AudioBuffer en fichier WAV
  const audioBufferToWave = (buffer: AudioBuffer, sampleRate: number): Promise<Blob> => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    
    // Écrire l'en-tête WAV
    // "RIFF" chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(view, 8, 'WAVE');
    
    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // taille du sous-chunk
    view.setUint16(20, 1, true); // Format audio (1 = PCM)
    view.setUint16(22, numOfChan, true); // Nombre de canaux
    view.setUint32(24, sampleRate, true); // Taux d'échantillonnage
    view.setUint32(28, sampleRate * 2 * numOfChan, true); // Débit binaire
    view.setUint16(32, numOfChan * 2, true); // Block align
    view.setUint16(34, 16, true); // Bits par échantillon
    
    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, length - 44, true);
    
    // Écrire les données audio
    const channels = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let c = 0; c < numOfChan; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return Promise.resolve(new Blob([arrayBuffer], { type: 'audio/wav' }));
  };
  
  // Fonction utilitaire pour écrire une chaîne dans un DataView
  const writeString = (view: DataView, offset: number, string: string): void => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  const triggerConversionFileUpload = () => {
    if (conversionFileRef.current) {
      conversionFileRef.current.click();
    }
  };
  
  const handleStandardSoundsToggle = () => {
    setStandardSoundsEnabled(!standardSoundsEnabled);
  };
  
  // Corriger les erreurs de lint
  // Ajouter des états pour les nouvelles propriétés de texte
  const [remainingCirclesPrefix, setRemainingCirclesPrefix] = useState<string>("Cercles restants");
  const [remainingCirclesBgColor, setRemainingCirclesBgColor] = useState<string>("#ffffff");
  const [remainingCirclesTextColor, setRemainingCirclesTextColor] = useState<string>("#000000");

  // Variable pour gérer l'utilisation de sons personnalisés pour les cercles
  const [useCirclesCustomSounds, setUseCirclesCustomSounds] = useState<boolean>(useCustomSounds);
  
  // Assurer que les deux états restent synchronisés
  useEffect(() => {
    setUseCirclesCustomSounds(useCustomSounds);
  }, [useCustomSounds]);

  // Add state for recording
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Add a function to toggle recording
  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  // Corriger la fonction renderGame
  const renderGame = () => {
    switch (selectedGame) {
      case GameType.GROWING_BALL:
        return (
          <GrowingBall
            isPlaying={isPlaying}
            onGameEnd={handleGameEnd}
            gravity={gravity}
            growthRate={growthRate}
            bounciness={bounciness}
            ballSpeed={ballSpeed}
            initialBallCount={ballCount}
            effectsEnabled={effectsEnabled}
            ballCollisionsEnabled={ballCollisionsEnabled}
            scoreTrackingEnabled={scoreTrackingEnabled}
            bgEffectsEnabled={bgEffectsEnabled}
            useCustomImages={useCustomImages}
            customImages={customImages}
            ballImageAssignments={ballImageAssignments}
            useCustomSounds={useCustomSounds}
            customBallSounds={{}}
            musicEnabled={musicEnabled}
            ballMusicAssignments={ballMusicAssignments}
            backgroundMusicEnabled={backgroundMusicEnabled}
            progressiveSoundEnabled={progressiveSoundEnabled}
            maxBallSpeed={maxBallSpeed}
            onBallCollision={(volume: number) => {
              if (progressiveSoundEnabled) {
                playNextProgressiveSoundPart(volume);
              }
            }}
            standardSoundsEnabled={standardSoundsEnabled}
            extractedMusicEnabled={extractedMusicEnabled}
            bounceVolume={bounceVolume}
            progressiveSoundVolume={progressiveSoundVolume}
            onVolumeChange={handleVolumeChange}
            midiEnabled={midiEnabled}
            midiVolume={midiVolume}
            midiTonality={midiTonality}
            midiInstrumentPreset={midiInstrumentPreset}
            ballCount={ballCount}
          />
        );

      case GameType.ROTATING_CIRCLE:
        return (
          <RotatingCircle
            isPlaying={isPlaying}
            onGameEnd={handleGameEnd}
          />
        );

      case GameType.COLLAPSING_ROTATING_CIRCLES:
        return (
          <CollapsingRotatingCircles
            isPlaying={isPlaying}
            onGameEnd={handleGameEnd}
            gravity={gravity}
            bounciness={bounciness}
            ballSpeed={ballSpeed}
            initialCircleCount={initialCircleCount}
            circleGap={circleGap}
            minCircleGap={minCircleGap}
            exitSize={exitSize}
            rotationSpeed={rotationSpeed}
            ballCount={ballCount}
            maxBallSpeed={maxBallSpeed}
            shrinkCirclesOnDestroy={shrinkCirclesOnDestroy}
            shrinkFactor={shrinkFactor}
            effectsEnabled={effectsEnabled}
            progressiveRotationOffset={progressiveRotationOffset}
            ballsOnDestroy={ballsOnDestroy}
            baseBallRadius={baseBallRadius}
            exitStyle={exitStyle}
            particleStyle={particleStyle}
            minCircleRadius={minCircleRadius}
            customEndMessage={customEndMessage}
            showFinalScore={showFinalScore}
            useCustomSounds={useCirclesCustomSounds}
            customExitSound={customExitSound || undefined}
            customExitSoundVolume={customExitSoundVolume}
            maxBallCount={maxBallCount}
            // Ajouter les nouvelles propriétés pour les images
            useCustomImages={useRotatingCirclesCustomImages}
            customImages={rotatingCirclesImageFiles}
            ballImageAssignments={rotatingCirclesBallImageAssignments}
            inheritBallImage={inheritBallImage}
            growing={rotatingCirclesGrowing}
            growthRate={rotatingCirclesGrowthRate}
            // Ajouter les nouvelles propriétés pour le texte
            remainingCirclesPrefix={remainingCirclesPrefix}
            remainingCirclesBgColor={remainingCirclesBgColor}
            remainingCirclesTextColor={remainingCirclesTextColor}
            // Ajouter la propriété pour l'enregistrement
            isRecording={isRecording}
            // Ajouter les propriétés pour les sons de destruction de porte
            playMidiOnDoorDestroy={rotatingCirclesPlayMidiOnDoorDestroy}
            midiVolume={rotatingCirclesMidiVolume}
            playMusicOnDoorDestroy={rotatingCirclesPlayMusicOnDoorDestroy}
            doorDestroyMusicVolume={rotatingCirclesDoorDestroyMusicVolume}
            // Add rainbow circle options
            useRainbowCircles={useRainbowCircles}
            circleStrokeWidth={circleStrokeWidth}
            animateRainbow={animateRainbow}
            // Add circle theme options
            circleTheme={circleTheme}
            customCircleColor={customCircleColor}
            glowIntensity={glowIntensity}
            gradientSpeed={gradientSpeed}
            // Add ball customization options
            customBallColor={customBallColor}
            ballHasTrail={ballHasTrail}
            ballTrailColor={ballTrailColor}
            ballTrailLength={ballTrailLength}
            ballStrokeWidth={ballStrokeWidth}
            ballStrokeColor={ballStrokeColor}
            ballHasGlow={ballHasGlow}
            ballGlowColor={ballGlowColor}
            ballGlowSize={ballGlowSize}
            ballTheme={ballTheme}
          />
        );

      default:
        return (
          <div className="game-placeholder">
            <h3>Sélectionnez un jeu</h3>
          </div>
        );
    }
  };
  
  // Render ball image assignment interface
  const renderBallImageAssignment = () => {
    if (!useCustomImages || !showImageAssignment || customImages.length === 0) return null;
    
    return (
      <div className="ball-image-assignment">
        <h5>Assign Images to Balls</h5>
        
        <div className="ball-assignments">
          {Array.from({ length: ballCount }).map((_, ballIndex) => (
            <div key={ballIndex} className="ball-assignment-row">
              <div className="ball-number">Ball {ballIndex + 1}:</div>
              <div className="image-options">
                <button 
                  className={`image-option ${ballImageAssignments[ballIndex] === -1 ? 'active' : ''}`}
                  onClick={() => assignImageToBall(ballIndex, -1)}
                >
                  Random
                </button>
                
                {uploadedImagePreviews.map((src, imgIndex) => (
                  <button 
                    key={imgIndex}
                    className={`image-option ${ballImageAssignments[ballIndex] === imgIndex ? 'active' : ''}`}
                    onClick={() => assignImageToBall(ballIndex, imgIndex)}
                  >
                    <img 
                      src={src} 
                      alt={`Image ${imgIndex + 1}`} 
                      className="image-option-thumbnail"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Render game controls
  const renderGameControls = () => {
    return (
      <>
        <div className="game-controls-sidebar">
          {!isPlaying ? (
            <>
              <button 
                className="control-button start"
                onClick={() => {
                  if (selectedGame) {
                    handleStartGame();
                  } else {
                    console.error("Aucun jeu sélectionné");
                  }
                }}
              >
                Démarrer
              </button>
              <button 
                className="control-button back"
                onClick={handleBackToMenu}
                style={{ marginTop: '10px', backgroundColor: '#555' }}
              >
                Retour au menu
              </button>
            </>
          ) : (
            <>
              <button 
                className="control-button stop"
                onClick={handleStopGame}
              >
                Arrêter
              </button>
              <button 
                className="control-button reset"
                onClick={handleResetGame}
              >
                Réinitialiser
              </button>
              <button 
                className="control-button back"
                onClick={handleBackToMenu}
                style={{ marginTop: '10px', backgroundColor: '#555' }}
              >
                Retour au menu
              </button>
            </>
          )}
        </div>
        
        {/* Display the game */}
   
        
        {/* Display appropriate settings based on game type */}
        <div className="game-settings-panel">
          <div className="settings-header">
            <h3>Paramètres</h3>
            <div className="game-tabs">
              <button 
                className={`tab-button ${activeTab === 'physics' ? 'active' : ''}`}
                onClick={() => handleTabChange('physics')}
              >
                Physique
              </button>
              <button 
                className={`tab-button ${activeTab === 'effects' ? 'active' : ''}`}
                onClick={() => handleTabChange('effects')}
              >
                Effets
              </button>
              <button 
                className={`tab-button ${activeTab === 'images' ? 'active' : ''}`}
                onClick={() => handleTabChange('images')}
              >
                Images
              </button>
              <button 
                className={`tab-button ${activeTab === 'sounds' ? 'active' : ''}`}
                onClick={() => handleTabChange('sounds')}
              >
                Sons
              </button>
              <button 
                className={`tab-button ${activeTab === 'music' ? 'active' : ''}`}
                onClick={() => handleTabChange('music')}
              >
                Musique
              </button>
              <button 
                className={`tab-button ${activeTab === 'sequence' ? 'active' : ''}`}
                onClick={() => handleTabChange('sequence')}
              >
                Séquence
              </button>
              <button 
                className={`tab-button ${activeTab === 'midi' ? 'active' : ''}`}
                onClick={() => handleTabChange('midi')}
              >
                MIDI
              </button>
            </div>
          </div>
          <div className="settings-content">
            {renderGameOptions()}
          </div>
        </div>
      </>
    );
  };
  
  // Render custom sounds interface
  const renderCustomSounds = () => {
    return (
      <div className="custom-sounds-section">
        <h4>Sons Personnalisés</h4>
        <div className="sound-toggle-container">
          <label className="toggle-label">
            Utiliser des sons personnalisés:
            <button 
              className={`toggle-button ${useCustomSounds ? 'active' : ''}`}
              onClick={handleCustomSoundsToggle}
            >
              {useCustomSounds ? 'ON' : 'OFF'}
            </button>
          </label>
        </div>
        
        {useCustomSounds && (
          <>
            <div className="sound-upload-container">
              {soundTypes.map(soundType => (
                <div className="sound-item" key={soundType}>
                  <span className="sound-label">Son {soundTypeNames[soundType]}:</span>
                  <div className="sound-buttons">
                    <input
                      type="file"
                      id={`${soundType}FileInput`}
                      onChange={(e) => handleSoundUpload(e, soundType)}
                      accept="audio/*"
                      style={{ display: 'none' }}
                    />
                    <button 
                      className="upload-button" 
                      onClick={() => triggerSoundUpload(soundType)}
                    >
                      {soundFiles[soundType] ? '🔄 Changer' : '📤 Choisir un fichier'}
                    </button>
                    {soundFiles[soundType] && (
                      <button 
                        className="delete-button" 
                        onClick={() => removeSoundFile(soundType)}
                      >
                        🗑️ Supprimer
                      </button>
                    )}
                  </div>
                  {soundFiles[soundType] && (
                    <div className="sound-info">
                      <span className="sound-filename">{soundFiles[soundType]?.name}</span>
                      <audio controls>
                        <source src={soundFiles[soundType] ? URL.createObjectURL(soundFiles[soundType]!) : ''} type={soundFiles[soundType]?.type} />
                        Votre navigateur ne supporte pas l'élément audio.
                      </audio>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Ajouter la nouvelle section pour les sons des cercles rotatifs */}
            {renderCirclesCustomSounds()}
            
            {/* Bouton pour les sons standards */}
            <div className="standard-sounds-toggle">
              <label className="toggle-label">
                Sons standards en plus des sons personnalisés:
                <button 
                  className={`toggle-button ${standardSoundsEnabled ? 'active' : ''}`}
                  onClick={handleStandardSoundsToggle}
                >
                  {standardSoundsEnabled ? 'ON' : 'OFF'}
                </button>
              </label>
              <div className="control-hint">
                Quand activé, les sons standards sont joués en plus des sons personnalisés. Sinon, seuls les sons personnalisés sont utilisés.
              </div>
            </div>
          </>
        )}
      </div>
    );
  };
  
  // Render custom music scales
  const renderCustomMusicScales = () => {
    if (!musicEnabled) return null;
    
    return (
      <div className="custom-music-section">
        <button
          className={`custom-music-toggle ${showCustomMusicUpload ? 'active' : ''}`}
          onClick={handleCustomMusicToggle}
        >
          {showCustomMusicUpload ? 'Masquer l\'upload de musique' : 'Ajouter des gammes musicales personnalisées'}
        </button>
        
        {showCustomMusicUpload && (
          <div className="custom-music-upload">
            <div className="custom-scale-name">
              <label htmlFor="scale-name">Nom de la gamme:</label>
              <input
                type="text"
                id="scale-name"
                value={customScaleName}
                onChange={(e) => setCustomScaleName(e.target.value)}
                placeholder="Ex: Ma Mélodie"
              />
            </div>
            
            <input
              type="file"
              ref={musicFileRef}
              onChange={handleMusicFileUpload}
              accept="audio/*"
              multiple
              className="file-input"
              style={{ display: 'none' }}
            />
            
            <div className="music-upload-controls">
              <button
                className="upload-button"
                onClick={triggerMusicFileUpload}
                disabled={!customScaleName.trim()}
              >
                Télécharger des fichiers audio pour la gamme
              </button>
              <p className="music-tip">Astuce: Téléchargez plusieurs fichiers audio (5-8 recommandés) pour créer une séquence musicale.</p>
            </div>
            
            {Object.keys(customMusicScales).length > 0 && (
              <div className="custom-scales-list">
                <h5>Gammes musicales personnalisées</h5>
                {Object.entries(customMusicScales).map(([name, files]) => (
                  <div key={name} className="custom-scale-item">
                    <div className="scale-name">{name}</div>
                    <div className="scale-info">{files.length} notes</div>
                    <button 
                      className="remove-scale"
                      onClick={() => removeCustomMusicScale(name)}
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  
  // Render background music section
  const renderBackgroundMusicSection = () => {
    return (
      <div className="music-background-section">
        <h5>Musique de Fond</h5>
        
        <div className="background-controls">
          <div className="toggle-control">
            <label className="toggle-label">
              Activer la musique de fond:
              <button 
                className={`toggle-button ${backgroundMusicEnabled ? 'active' : ''}`}
                onClick={handleBackgroundMusicToggle}
              >
                {backgroundMusicEnabled ? 'ON' : 'OFF'}
              </button>
            </label>
          </div>
          
          <input
            type="file"
            ref={backgroundMusicRef}
            onChange={handleBackgroundMusicUpload}
            accept="audio/*"
            className="file-input"
            style={{ display: 'none' }}
          />
          
          <div className="background-music-upload">
            <button
              className="upload-button"
              onClick={triggerBackgroundMusicUpload}
            >
              {backgroundMusicFile ? 'Changer la musique de fond' : 'Télécharger une musique de fond'}
            </button>
            
            {backgroundMusicFile && (
              <div className="background-music-info">
                Musique: {backgroundMusicFile.name.length > 20 ? 
                  backgroundMusicFile.name.substring(0, 20) + '...' : 
                  backgroundMusicFile.name}
              </div>
            )}
          </div>
          
          <div className="volume-control">
            <label>Volume: {Math.round(backgroundMusicVolume * 100)}%</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={backgroundMusicVolume}
              onChange={(e) => setBackgroundMusicVolume(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>
    );
  };
  
  // Render progressive sound section
  const renderProgressiveSoundSection = () => {
    const handleDirectFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      const file = files[0];
      
      // Afficher un message temporaire
      alert("Chargement du fichier audio en cours...");
      
      // Charger le son progressif
      loadProgressiveSound(file).then(() => {
        // Mettre à jour l'état
        setProgressiveSoundFile(file);
        
        // Activer le son progressif si ce n'est pas déjà fait
        if (!progressiveSoundEnabled) {
          setProgressiveSoundEnabled(true);
        }
        
        alert("Fichier audio chargé avec succès!");
      }).catch(err => {
        console.error("Erreur lors du chargement du fichier audio:", err);
        alert("Erreur lors du chargement du fichier audio. Veuillez réessayer.");
      });
      
      // Réinitialiser le champ pour permettre de sélectionner à nouveau le même fichier
      e.target.value = '';
    };

    return (
      <div className="music-progressive-section">
        <h4>Progressive Sound</h4>
        <p className="music-note">
          Upload a music file to play progressive parts with each ball collision
        </p>
        
        <div className="music-toggle-container">
          <label className="toggle-label">
            Progressive Sound:
            <button 
              className={`toggle-button ${progressiveSoundEnabled ? 'active' : ''}`}
              onClick={handleProgressiveSoundToggle}
            >
              {progressiveSoundEnabled ? 'ON' : 'OFF'}
            </button>
          </label>
        </div>
        
        {/* Option pour activer/désactiver les sons standards avec le son progressif */}
        {progressiveSoundEnabled && (
          <div className="music-toggle-container">
            <label className="toggle-label">
              Standard Sounds:
              <button 
                className={`toggle-button ${standardSoundsEnabled ? 'active' : ''}`}
                onClick={handleStandardSoundsToggle}
              >
                {standardSoundsEnabled ? 'ON' : 'OFF'}
              </button>
            </label>
            <div className="sound-note">
              {standardSoundsEnabled 
                ? "Playing both progressive and standard sounds on impact" 
                : "Only progressive sounds will play on impact"}
            </div>
          </div>
        )}
        
        {/* Contrôles de volume pour les sons progressifs */}
        {progressiveSoundEnabled && (
          <div className="volume-controls" style={{ marginTop: '15px', marginBottom: '20px' }}>
            <div className="volume-control">
              <label>
                Progressive Sound Volume: {Math.round(progressiveSoundVolume * 100)}%
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={progressiveSoundVolume}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setProgressiveSoundVolume(value);
                    handleVolumeChange('progressive', value);
                  }}
                  style={{ 
                    width: '100%', 
                    margin: '5px 0',
                    accentColor: '#ff5722'
                  }}
                />
              </label>
              <div className="volume-description" style={{ fontSize: '12px', opacity: 0.8 }}>
                Controls the volume of progressive sound segments played during collisions.
              </div>
            </div>
            
            <div className="volume-control" style={{ marginTop: '15px' }}>
              <label>
                Bounce Sound Volume: {Math.round(bounceVolume * 100)}%
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={bounceVolume}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setBounceVolume(value);
                    handleVolumeChange('bounce', value);
                  }}
                  style={{ 
                    width: '100%', 
                    margin: '5px 0',
                    accentColor: '#2196f3'
                  }}
                />
              </label>
              <div className="volume-description" style={{ fontSize: '12px', opacity: 0.8 }}>
                Controls only the volume of wall bounce sounds when balls hit walls.
              </div>
            </div>
            
            <div className="sound-settings" style={{ 
              marginTop: '15px',
              padding: '10px',
              backgroundColor: 'rgba(255, 87, 34, 0.1)',
              borderRadius: '4px'
            }}>
              <h5 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Sound Settings</h5>
              <p style={{ fontSize: '13px', margin: '5px 0' }}>
                When a ball hits a wall:
              </p>
              <ul style={{ fontSize: '13px', paddingLeft: '20px', margin: '5px 0' }}>
                <li>Multiple progressive sound segments will play</li>
                <li>The volume decreases with each segment for a fade-out effect</li>
                <li>Both progressive and standard bounce sounds can play together (if enabled)</li>
              </ul>
              <p style={{ fontSize: '13px', margin: '10px 0 5px 0', fontStyle: 'italic' }}>
                Tip: For the best experience, use music with distinct sections or beats.
              </p>
            </div>
          </div>
        )}
        
        {/* Méthode alternative d'upload directement dans le composant */}
        <div className="progressive-sound-controls" style={{ marginTop: '15px' }}>
          <input 
            type="file" 
            id="directProgressiveSound"
            onChange={handleDirectFileUpload}
            accept="audio/*"
            style={{ display: 'none' }}
          />
          
          <label 
            htmlFor="directProgressiveSound" 
            style={{
              display: 'inline-block',
              padding: '10px 15px',
              backgroundColor: '#ff5722',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: '14px'
            }}
          >
            Upload Music File
          </label>
          
          {progressiveSoundFile && (
            <div className="progressive-sound-info" style={{ marginTop: '10px' }}>
              <div className="file-name" style={{ fontSize: '14px', marginBottom: '5px' }}>
                <strong>Fichier chargé:</strong> {progressiveSoundFile.name}
              </div>
              <button 
                onClick={clearProgressiveSoundFile}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Supprimer
              </button>
            </div>
          )}
          
          {!progressiveSoundFile && hasProgressiveSound() && (
            <div className="progressive-sound-info" style={{ marginTop: '10px' }}>
              <div className="file-name" style={{ fontSize: '14px', marginBottom: '5px', color: 'green' }}>
                <strong>Son progressif prêt</strong> ✓
              </div>
              <button 
                onClick={clearProgressiveSoundFile}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Supprimer
              </button>
            </div>
          )}
          
          {!progressiveSoundFile && !hasProgressiveSound() && (
            <div className="sound-tip" style={{ marginTop: '10px', fontSize: '13px', fontStyle: 'italic' }}>
              Téléchargez un fichier audio pour créer une expérience sonore dynamique.
              <br/>
              La musique sera découpée et jouée en segments lors des rebonds.
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Render music conversion section
  const renderMusicConversionSection = () => {
    return (
      <div className="music-conversion-section">
        <h5>Convertir Audio en Gamme Musicale</h5>
        
        <div className="conversion-controls">
          <div className="custom-scale-name">
            <label htmlFor="conversion-scale-name">Nom de la gamme:</label>
            <input
              type="text"
              id="conversion-scale-name"
              value={customScaleName}
              onChange={(e) => setCustomScaleName(e.target.value)}
              placeholder="Ex: Ma Gamme"
            />
          </div>
          
          <div className="notes-number-control">
            <label>Nombre de notes: {numNotesToExtract}</label>
            <input 
              type="range" 
              min="5" 
              max="12" 
              step="1" 
              value={numNotesToExtract}
              onChange={(e) => setNumNotesToExtract(parseInt(e.target.value))}
            />
          </div>
          
          <input
            type="file"
            ref={conversionFileRef}
            onChange={handleMusicConversion}
            accept="audio/*"
            className="file-input"
            style={{ display: 'none' }}
          />
          
          <button
            className="convert-button"
            onClick={triggerConversionFileUpload}
            disabled={!customScaleName.trim()}
          >
            Convertir un fichier audio en gamme musicale
          </button>
          
          <div className="conversion-note">
            <strong>Comment ça marche:</strong> Cette fonction analyse un fichier audio et extrait
            les fréquences dominantes pour créer une gamme musicale. 
            Idéal pour créer des gammes personnalisées à partir de vos sons favoris.
          </div>
        </div>
      </div>
    );
  };
  
  // Section des effets musicaux
  const renderMusicSection = () => {
    if (selectedGame !== GameType.GROWING_BALL || isPlaying) {
      return null;
    }
    
    return (
      <div className="music-section">
        <h4>Effets Musicaux</h4>
        
        <div className="music-toggle-container">
          <label className="toggle-label">
            Activer la Musique:
            <button 
              className={`toggle-button ${musicEnabled ? 'active' : ''}`}
              onClick={handleMusicEnabledToggle}
            >
              {musicEnabled ? 'ON' : 'OFF'}
            </button>
          </label>
        </div>
        
        {musicEnabled && (
          <>
            <div className="music-options">
              <h5>Assignation des Gammes Musicales</h5>
              <div className="ball-assignments">
                {Array.from({ length: Math.min(ballCount, 5) }).map((_, index) => (
                  <div key={`music-${index}`} className="ball-assignment">
                    <div className="ball-indicator" style={{
                      backgroundColor: `hsl(${(index * 60) % 360}, 70%, 80%)`
                    }}>
                      {index + 1}
                    </div>
                    <select
                      value={ballMusicAssignments[index] || 'majorScale'}
                      onChange={(e) => updateBallMusicAssignment(index, e.target.value as keyof typeof MUSIC_SCALES | CustomMusicKey)}
                    >
                      <optgroup label="Gammes Standard">
                        <option value="majorScale">Gamme Majeure</option>
                        <option value="minorScale">Gamme Mineure</option>
                        <option value="pentatonic">Pentatonique</option>
                        <option value="blues">Blues</option>
                        <option value="jazz">Jazz</option>
                        <option value="eastern">Orientale</option>
                      </optgroup>
                      
                      {Object.keys(customMusicScales).length > 0 && (
                        <optgroup label="Gammes Personnalisées">
                          {Object.keys(customMusicScales).map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                ))}
              </div>
              <div className="music-note">
                <strong>Note:</strong> Chaque balle joue une séquence musicale quand elle touche le mur. 
                Le tempo s'accélère progressivement avec les rebonds!
              </div>
            </div>
            
            {renderBackgroundMusicSection()}
            
            {renderProgressiveSoundSection()}
            
            {renderMusicConversionSection()}
            
            {renderCustomMusicScales()}
          </>
        )}
      </div>
    );
  };
  
  // Render physics settings for Growing Ball game
  const renderPhysicsSettings = () => {
    if ((selectedGame !== GameType.GROWING_BALL && selectedGame !== GameType.COLLAPSING_ROTATING_CIRCLES) || isPlaying) {
      return null;
    }
    
    return (
      <div className="physics-settings">
        <h3>Physics Settings</h3>
        
        <div className="preset-buttons">
          {Object.keys(physicsPresets).map(key => (
            <button 
              key={key}
              className={`preset-button ${activePreset === key ? 'active' : ''}`}
              onClick={() => applyPreset(key)}
            >
              {physicsPresets[key as keyof typeof physicsPresets].name}
            </button>
          ))}
        </div>
        
        <div className="physics-controls">
          <div className="control">
            <label>Ball Speed: {ballSpeed.toFixed(1)}</label>
            <input 
              type="range" 
              min="2.0" 
              max="10.0" 
              step="0.5" 
              value={ballSpeed}
              onChange={handleBallSpeedChange}
            />
          </div>
          <div className="control">
            <label>Gravity: {gravity.toFixed(2)}</label>
            <input 
              type="range" 
              min="0.05" 
              max="2.0" 
              step="0.01" 
              value={gravity}
              onChange={handleGravityChange}
            />
          </div>
          <div className="control">
            <label>Growth Rate: {growthRate.toFixed(2)}</label>
            <input 
              type="range" 
              min="0.1" 
              max="2.0" 
              step="0.1" 
              value={growthRate}
              onChange={handleGrowthRateChange}
            />
          </div>
          <div className="control">
            <label>Bounciness: {bounciness.toFixed(2)}</label>
            <input 
              type="range" 
              min="0.5" 
              max="1.5" 
              step="0.05" 
              value={bounciness}
              onChange={handleBouncinessChange}
            />
          </div>
          <div className="control balls-control">
            <label>Number of Balls: {ballCount}</label>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="1" 
              value={ballCount}
              onChange={handleBallCountChange}
            />
            <div className="ball-indicators">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className={`ball-indicator ${i < ballCount ? 'active' : ''}`}
                ></div>
              ))}
            </div>
          </div>
          
          {/* Wall bounce sound volume control */}
          <div className="control">
            <label>Volume Son Rebond: {Math.round(bounceVolume * 100)}%</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={bounceVolume}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setBounceVolume(value);
                handleVolumeChange('bounce', value);
              }}
            />
          </div>
        </div>
        
        <div className="effects-section">
          <h4>Visual & Gameplay Options</h4>
          <div className="toggle-options">
            <div className="toggle-control">
              <label className="toggle-label">
                Visual Effects:
                <button 
                  className={`toggle-button ${effectsEnabled ? 'active' : ''}`}
                  onClick={handleEffectsToggle}
                >
                  {effectsEnabled ? 'ON' : 'OFF'}
                </button>
              </label>
            </div>
            
            <div className="toggle-control">
              <label className="toggle-label">
                Ball Collisions:
                <button 
                  className={`toggle-button ${ballCollisionsEnabled ? 'active' : ''}`}
                  onClick={handleBallCollisionsToggle}
                >
                  {ballCollisionsEnabled ? 'ON' : 'OFF'}
                </button>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Gérer l'activation/désactivation de la séquence musicale extraite
  useEffect(() => {
    if (extractedMusicEnabled) {
      enableExtractedNotes();
      
      // Désactiver les autres modes musicaux qui pourraient interférer
      if (progressiveSoundEnabled) {
        setProgressiveSoundEnabled(false);
      }
    } else {
      disableExtractedNotes();
    }
  }, [extractedMusicEnabled, progressiveSoundEnabled]);

  // Gérer le téléchargement et l'analyse de la séquence musicale
  const handleExtractedMusicToggle = () => {
    setExtractedMusicEnabled(!extractedMusicEnabled);
  };

  const handleExtractedMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setExtractedMusicFile(file);
    
    // Afficher un message de chargement
    alert("Analyse en cours... Veuillez patienter pendant l'extraction des notes.");
    
    // Charger la séquence musicale
    try {
      await loadMusicSequence(file, extractedNotesCount);
      
      // Activer la séquence musicale extraite
      if (!extractedMusicEnabled) {
        setExtractedMusicEnabled(true);
      }
      
      // Réinitialiser le champ
      e.target.value = '';
      
      alert("Séquence musicale extraite et prête à être utilisée!");
    } catch (err) {
      console.error('Erreur lors du chargement de la séquence musicale:', err);
      alert("Une erreur s'est produite lors de l'extraction des notes. Une gamme par défaut sera utilisée.");
    }
  };

  const triggerExtractedMusicUpload = () => {
    if (extractedMusicRef.current) {
      extractedMusicRef.current.click();
    }
  };

  // Rendu de la section de séquence musicale extraite
  const renderExtractedMusicSection = () => {
    return (
      <div className="music-sequence-section">
        <h4>Mode Séquence Musicale</h4>
        <p className="music-note">
          Téléchargez un fichier audio pour extraire sa mélodie et jouer une note à chaque collision
        </p>
        
        <div className="music-toggle-container">
          <label className="toggle-label">
            Séquence Musicale:
            <button 
              className={`toggle-button ${extractedMusicEnabled ? 'active' : ''}`}
              onClick={handleExtractedMusicToggle}
            >
              {extractedMusicEnabled ? 'ON' : 'OFF'}
            </button>
          </label>
        </div>
        
        <div className="sequence-settings">
          <label className="slider-label">
            Nombre de notes: {extractedNotesCount}
            <input
              type="range"
              min="5"
              max="30"
              value={extractedNotesCount}
              onChange={(e) => setExtractedNotesCount(parseInt(e.target.value))}
            />
          </label>
        </div>
        
        <input 
          type="file" 
          ref={extractedMusicRef}
          onChange={handleExtractedMusicUpload}
          accept="audio/*"
          style={{ display: 'none' }}
        />
        
        <div className="extracted-music-controls">
          <button 
            className="upload-button"
            onClick={triggerExtractedMusicUpload}
          >
            Télécharger et Analyser Musique
          </button>
          
          {extractedMusicFile && (
            <div className="extracted-music-info">
              <div className="file-name">
                Fichier: {extractedMusicFile.name}
              </div>
            </div>
          )}
        </div>
        
        <div className="extracted-music-details">
          {extractedMusicEnabled && hasExtractedNotes() ? (
            <div className="status active">Séquence musicale chargée et prête ✓</div>
          ) : extractedMusicEnabled ? (
            <div className="status pending">Veuillez télécharger un fichier audio</div>
          ) : (
            <div className="status inactive">Activez pour utiliser une séquence musicale</div>
          )}
        </div>
        
        <div className="sound-tip">
          <strong>Comment ça marche:</strong> Le système analyse votre musique, extrait les notes principales et les joue
          séquentiellement à chaque fois qu'une balle touche un mur. Idéal pour créer des vidéos TikTok avec votre propre musique!
        </div>
      </div>
    );
  };
  
  // Function to switch between tabs
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Add a handler for volume changes
  const handleVolumeChange = (type: 'bounce' | 'progressive', value: number) => {
    if (type === 'bounce') {
      setBounceVolume(value);
      // Ajouter un log pour déboguer
      console.log("Volume de rebond changé:", value);
    } else if (type === 'progressive') {
      setProgressiveSoundVolume(value);
      // Ajouter un log pour déboguer
      console.log("Volume progressif changé:", value);
    }
  };

  // Gérer l'activation/désactivation des notes MIDI
  useEffect(() => {
    if (midiEnabled) {
      // Si on active MIDI, désactiver les autres modes musicaux qui pourraient interférer
      if (extractedMusicEnabled) {
        setExtractedMusicEnabled(false);
      }
      if (progressiveSoundEnabled) {
        setProgressiveSoundEnabled(false);
      }
    }
  }, [midiEnabled, extractedMusicEnabled, progressiveSoundEnabled]);

  // Gérer l'activation/désactivation des notes MIDI
  const handleMidiToggle = () => {
    setMidiEnabled(!midiEnabled);
  };

  // Fonction pour gérer l'upload et la conversion d'un fichier en séquence MIDI
  const handleMidiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setMidiFile(file);
    
    // Afficher un message de chargement
    alert("Chargement du fichier MIDI en cours... Veuillez patienter.");
    
    try {
      // Charger le fichier MIDI directement
      await loadMIDIFile(file);
      
      // Activer le mode MIDI
      if (!midiEnabled) {
        setMidiEnabled(true);
      }
      
      // Réinitialiser le champ
      e.target.value = '';
      
      alert("Fichier MIDI chargé avec succès!");
    } catch (err) {
      console.error('Erreur lors du chargement du fichier MIDI:', err);
      alert("Une erreur s'est produite lors du chargement du fichier MIDI. Veuillez vérifier que le format est correct.");
    }
  };

  const triggerMidiUpload = () => {
    if (midiFileRef.current) {
      midiFileRef.current.click();
    }
  };

  // Fonction pour nettoyer la séquence MIDI
  const clearMidiFile = () => {
    setMidiFile(null);
    clearMIDISequence();
  };

  // Fonction pour gérer le volume MIDI
  const handleMidiVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setMidiVolume(value);
  };

  // Fonction pour gérer le changement d'instrument MIDI
  const handleMidiInstrumentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as MIDIInstrumentPresetKey;
    setMidiInstrumentPreset(value);
    setMIDIInstrumentPreset(value);
  };

  // Fonction pour gérer le changement de tonalité MIDI
  const handleMidiTonalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setMidiTonality(value);
    setMIDITonality(value);
  };

  // Modifier le composant renderMidiSection pour simplifier l'interface
  const renderMidiSection = () => {
    return (
      <div className="midi-section">
        <h4>MIDI Sound</h4>
        <p className="midi-note">
          Chargez un fichier MIDI qui sera joué à chaque rebond de la balle
        </p>
        
        <div className="music-toggle-container">
          <label className="toggle-label">
            Mode MIDI:
            <button 
              className={`toggle-button ${midiEnabled ? 'active' : ''}`}
              onClick={handleMidiToggle}
            >
              {midiEnabled ? 'ON' : 'OFF'}
            </button>
          </label>
        </div>
        
        <div className="sequence-settings">
          <label className="slider-label">
            Volume MIDI: {Math.round(midiVolume * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={midiVolume}
              onChange={handleMidiVolumeChange}
            />
          </label>
          
          {/* Wall bounce sound volume control */}
          <label className="slider-label" style={{ marginTop: '10px' }}>
            Volume Rebond Mural: {Math.round(bounceVolume * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={bounceVolume}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setBounceVolume(value);
                handleVolumeChange('bounce', value);
              }}
            />
          </label>
          
          {/* Sélection de l'instrument MIDI */}
          <div className="midi-select-container" style={{ marginTop: '10px' }}>
            <label className="select-label" style={{ display: 'block', marginBottom: '5px' }}>
              Instrument MIDI:
              <select
                value={midiInstrumentPreset}
                onChange={handleMidiInstrumentChange}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px',
                  marginTop: '5px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              >
                <option value={MIDI_INSTRUMENT_PRESETS.DEFAULT_CYCLING}>Cycle Automatique</option>
                <option value={MIDI_INSTRUMENT_PRESETS.MELODIC_MAIN}>Mélodique Principal</option>
                <option value={MIDI_INSTRUMENT_PRESETS.PAD_STRINGS}>Cordes & Pads</option>
                <option value={MIDI_INSTRUMENT_PRESETS.PERCUSSIVE}>Percussif</option>
                <option value={MIDI_INSTRUMENT_PRESETS.METAL_SYNTH}>Synthé Métallique</option>
                <option value={MIDI_INSTRUMENT_PRESETS.FM_SYNTH}>FM Synthétiseur</option>
              </select>
            </label>
          </div>
          
          {/* Sélection de la tonalité MIDI */}
          <div className="midi-select-container" style={{ marginTop: '10px' }}>
            <label className="select-label" style={{ display: 'block', marginBottom: '5px' }}>
              Tonalité MIDI:
              <select
                value={midiTonality}
                onChange={handleMidiTonalityChange}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px',
                  marginTop: '5px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              >
                <option value="C">C (Do)</option>
                <option value="C#">C# (Do♯)</option>
                <option value="D">D (Ré)</option>
                <option value="D#">D# (Ré♯)</option>
                <option value="E">E (Mi)</option>
                <option value="F">F (Fa)</option>
                <option value="F#">F# (Fa♯)</option>
                <option value="G">G (Sol)</option>
                <option value="G#">G# (Sol♯)</option>
                <option value="A">A (La)</option>
                <option value="A#">A# (La♯)</option>
                <option value="B">B (Si)</option>
              </select>
            </label>
          </div>
        </div>
        
        {/* Section pour charger un fichier MIDI */}
        <div className="midi-file-section">
          <h5>Charger un fichier MIDI</h5>
          
          <input
            type="file"
            ref={midiFileRef}
            onChange={handleMidiUpload}
            accept=".mid,.midi"
            style={{ display: 'none' }}
          />
          
          <div className="midi-upload-controls">
            <button
              className="upload-button"
              onClick={triggerMidiUpload}
              style={{
                backgroundColor: '#4285f4',
                margin: '10px 0'
              }}
            >
              Charger un fichier MIDI (.mid)
            </button>
            
            {midiFile && (
              <div className="midi-file-info" style={{ marginBottom: '15px' }}>
                <div className="file-name" style={{ fontSize: '14px', marginBottom: '5px' }}>
                  <strong>Fichier MIDI:</strong> {midiFile.name}
                </div>
                <button
                  onClick={clearMidiFile}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="midi-info" style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: 'rgba(63, 81, 181, 0.1)', 
          borderRadius: '5px' 
        }}>
          <h5 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Comment ça marche</h5>
          <p style={{ fontSize: '13px', margin: '0 0 5px 0' }}>
            Le système jouera une note MIDI chaque fois qu'une balle touche un mur,
            suivant la séquence de notes de votre fichier MIDI.
          </p>
        </div>

        {/* Add new section for door destruction sounds */}
        <div className="circle-destruction-sounds" style={{ 
          marginTop: '30px', 
          padding: '15px', 
          backgroundColor: 'rgba(64, 192, 128, 0.1)', 
          borderRadius: '5px',
          border: '1px solid rgba(64, 192, 128, 0.3)'
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#40c080' }}>Sons pour la destruction des portes</h4>
          
          <div className="toggle-control">
            <label className="toggle-label">
              Jouer une note MIDI à la destruction:
              <button 
                className={`toggle-button ${rotatingCirclesPlayMidiOnDoorDestroy ? 'active' : ''}`}
                onClick={handleRotatingCirclesPlayMidiOnDoorDestroy}
              >
                {rotatingCirclesPlayMidiOnDoorDestroy ? 'ON' : 'OFF'}
              </button>
            </label>
            <div className="control-hint">
              Joue une note MIDI chaque fois qu'une porte est détruite
            </div>
          </div>
          
          {rotatingCirclesPlayMidiOnDoorDestroy && (
            <div className="volume-slider">
              <label>Volume MIDI (destruction): {Math.round(rotatingCirclesMidiVolume * 100)}%</label>
              <input 
                type="range" 
                min="0.01" 
                max="1" 
                step="0.01" 
                value={rotatingCirclesMidiVolume}
                onChange={handleRotatingCirclesMidiVolumeChange}
              />
            </div>
          )}
          
          <div className="toggle-control" style={{ marginTop: '15px' }}>
            <label className="toggle-label">
              Jouer un son à la destruction:
              <button 
                className={`toggle-button ${rotatingCirclesPlayMusicOnDoorDestroy ? 'active' : ''}`}
                onClick={handleRotatingCirclesPlayMusicOnDoorDestroy}
              >
                {rotatingCirclesPlayMusicOnDoorDestroy ? 'ON' : 'OFF'}
              </button>
            </label>
            <div className="control-hint">
              Joue un son de musique chaque fois qu'une porte est détruite
            </div>
          </div>
          
          {rotatingCirclesPlayMusicOnDoorDestroy && (
            <div className="volume-slider">
              <label>Volume musique (destruction): {Math.round(rotatingCirclesDoorDestroyMusicVolume * 100)}%</label>
              <input 
                type="range" 
                min="0.01" 
                max="1" 
                step="0.01" 
                value={rotatingCirclesDoorDestroyMusicVolume}
                onChange={handleRotatingCirclesDoorDestroyMusicVolumeChange}
              />
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Mettre à jour la fonction renderCollapsingRotatingCirclesSettings pour corriger l'erreur des deux attributs value
  const renderCollapsingRotatingCirclesSettings = () => {
    return (
      <div className="game-settings">
        <div className="control">
          <label>Balle (rayon en pixels): {baseBallRadius}</label>
          <input 
            type="range" 
            min="1" 
            max="50" 
            step="1" 
            value={baseBallRadius}
            onChange={handleBaseBallRadiusChange}
          />
          <div className="control-hint">
            Ajuste la taille de la balle qui navigue entre les cercles
          </div>
        </div>
        
        <div className="control">
          <label>Taille minimale du cercle (pixels): {minCircleRadius}</label>
          <input 
            type="range" 
            min="1" 
            max="150" 
            step="5" 
            value={minCircleRadius}
            onChange={handleMinCircleRadiusChange}
          />
          <div className="control-hint">
            Limite la taille minimale qu'un cercle peut atteindre après rétrécissement
          </div>
        </div>
        
        <div className="control">
          <label>Nombre de cercles: {initialCircleCount}</label>
          <input 
            type="range" 
            min="1" 
            max="2000" 
            step="1" 
            value={initialCircleCount}
            onChange={handleInitialCircleCountChange}
          />
          <div className="control-hint">
            Plus il y a de cercles, plus le jeu devient difficile
          </div>
        </div>
        
        <div className="control">
          <label>Écart entre les cercles (pixels): {circleGap}</label>
          <input 
            type="range" 
            min="1" 
            max="100" 
            step="5" 
            value={circleGap}
            onChange={handleCircleGapChange}
          />
          <div className="control-hint">
            Détermine l'espacement entre les cercles concentriques
          </div>
        </div>
        
        <div className="control">
          <label>Écart minimum entre cercles (pixels): {minCircleGap}</label>
          <input 
            type="range" 
            min="0" 
            max="50" 
            step="1" 
            value={minCircleGap}
            onChange={handleMinCircleGapChange}
          />
          <div className="control-hint">
            Définit l'espacement minimum entre les cercles après rétrécissement
          </div>
        </div>
        
        <div className="control">
          <label>Limite maximum de balles: {maxBallCount}</label>
          <input 
            type="range" 
            min="5" 
            max="100" 
            step="1" 
            value={maxBallCount}
            onChange={handleMaxBallCountChange}
          />
          <div className="control-hint">
            Limite le nombre total de balles dans le jeu pour éviter les ralentissements
          </div>
        </div>
        
        <div className="control">
          <label>Style de la porte:</label>
          <select 
            value={exitStyle} 
            onChange={handleExitStyleChange}
            className="style-select"
          >
            <option value={ExitStyle.STANDARD}>Standard</option>
            <option value={ExitStyle.INVERTED}>Couleurs inversées</option>
            <option value={ExitStyle.GLOWING}>Brillant</option>
            <option value={ExitStyle.TRANSPARENT}>Transparent (cercle ouvert)</option>
            <option value={ExitStyle.COLORFUL}>Arc-en-ciel</option>
          </select>
          <div className="control-hint">
            Change l'apparence visuelle de la porte de sortie des cercles
          </div>
        </div>
        
        <div className="control">
          <label>Style des particules:</label>
          <select 
            value={particleStyle} 
            onChange={handleParticleStyleChange}
            className="style-select"
          >
            <option value={ParticleStyle.STANDARD}>Standard</option>
            <option value={ParticleStyle.SPARKLE}>Étincelles</option>
            <option value={ParticleStyle.EXPLOSION}>Explosion</option>
            <option value={ParticleStyle.MINIMAL}>Minimal</option>
            <option value={ParticleStyle.CONFETTI}>Confetti</option>
          </select>
          <div className="control-hint">
            Définit l'effet visuel lors de la destruction d'un cercle
          </div>
        </div>
        
        <div className="control">
          <label>Vitesse maximale de la balle: {maxBallSpeed.toFixed(1)}</label>
          <input 
            type="range" 
            min="1" 
            max="20" 
            step="0.5" 
            value={maxBallSpeed}
            onChange={handleMaxBallSpeedChange}
          />
          <div className="control-hint">
            Limite la vitesse pour empêcher la balle de sortir accidentellement
          </div>
        </div>
        
        <div className="control toggle-control">
          <label className="toggle-label">
            Rétrécir les cercles:
            <button 
              className={`toggle-button ${shrinkCirclesOnDestroy ? 'active' : ''}`}
              onClick={handleShrinkCirclesToggle}
            >
              {shrinkCirclesOnDestroy ? 'ON' : 'OFF'}
            </button>
          </label>
          <div className="control-hint">
            Rétrécit les cercles restants quand un cercle est détruit
          </div>
        </div>
        
        {shrinkCirclesOnDestroy && (
          <div className="control">
            <label>Taille après rétrécissement: {Math.round(shrinkFactor * 100)}%</label>
            <input 
              type="range" 
              min="0.3" 
              max="0.99" 
              step="0.01" 
              value={shrinkFactor}
              onChange={handleShrinkFactorChange}
            />
            <div className="control-hint">
              Pourcentage de la taille originale après destruction d'un cercle (plus petit = plus difficile)
            </div>
          </div>
        )}
        
        {/* Ajouter les nouveaux contrôles à la fin */}
        <div className="game-end-settings" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
          <h5>Personnalisation de fin de jeu</h5>
          
          <div className="control">
            <label>Message de fin:</label>
            <input 
              type="text" 
              value={customEndMessage}
              onChange={(e) => setCustomEndMessage(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #555',
                backgroundColor: '#333',
                color: 'white',
                marginTop: '5px'
              }}
              placeholder="Message affiché à la fin du jeu"
            />
            <div className="control-hint">
              Texte qui sera affiché lorsque tous les cercles sont détruits
            </div>
          </div>
          
          <div className="control toggle-control">
            <label className="toggle-label">
              Afficher le score final:
              <button 
                className={`toggle-button ${showFinalScore ? 'active' : ''}`}
                onClick={() => setShowFinalScore(!showFinalScore)}
              >
                {showFinalScore ? 'ON' : 'OFF'}
              </button>
            </label>
            <div className="control-hint">
              Détermine si le score final sera affiché sous le message de fin
            </div>
          </div>
        </div>
        
        {/* Ajouter les nouveaux contrôles pour la personnalisation du texte */}
        <div className="text-customization-section" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
          <h5>Personnalisation de l'affichage</h5>
          
          <div className="control">
            <label>Texte des cercles restants:</label>
            <input 
              type="text" 
              value={remainingCirclesPrefix}
              onChange={(e) => setRemainingCirclesPrefix(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #555',
                backgroundColor: '#333',
                color: 'white',
                marginTop: '5px'
              }}
              placeholder="Texte affiché avant le nombre de cercles restants"
            />
            <div className="control-hint">
              Personnalise le texte affiché avant le nombre de cercles restants
            </div>
          </div>
          
          <div className="control">
            <label>Couleur du fond texte:</label>
            <input 
              type="color" 
              value={remainingCirclesBgColor}
              onChange={(e) => setRemainingCirclesBgColor(e.target.value)}
              style={{ 
                width: '100%', 
                height: '40px', 
                border: 'none',
                borderRadius: '4px', 
                marginTop: '5px'
              }}
            />
            <div className="control-hint">
              Couleur de fond de l'indicateur de cercles restants
            </div>
          </div>
          
          <div className="control">
            <label>Couleur du texte:</label>
            <input 
              type="color" 
              value={remainingCirclesTextColor}
              onChange={(e) => setRemainingCirclesTextColor(e.target.value)}
              style={{ 
                width: '100%', 
                height: '40px', 
                border: 'none',
                borderRadius: '4px', 
                marginTop: '5px'
              }}
            />
            <div className="control-hint">
              Couleur du texte de l'indicateur de cercles restants
            </div>
          </div>
        </div>
        
        {/* Circle themes and settings */}
        <div className="rainbow-circle-settings" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
          <h5>Personnalisation des cercles</h5>
          
          <div className="control">
            <label>Thème des cercles:</label>
            <select 
              className="style-select"
              value={circleTheme}
              onChange={(e) => handleCircleThemeChange(e.target.value as CircleTheme)}
            >
              <option value={CircleTheme.DEFAULT}>Par défaut (couleurs aléatoires)</option>
              <option value={CircleTheme.RAINBOW}>Arc-en-ciel</option>
              <option value={CircleTheme.NEON}>Néon</option>
              <option value={CircleTheme.LAVA}>Lave</option>
              <option value={CircleTheme.WATER}>Eau</option>
              <option value={CircleTheme.CUSTOM}>Couleur personnalisée</option>
            </select>
            <div className="control-hint">
              Choisissez un thème de couleur pour les cercles
            </div>
          </div>
          
          {circleTheme === CircleTheme.CUSTOM && (
            <div className="control">
              <label>Couleur personnalisée:</label>
              <input 
                type="color" 
                value={customCircleColor}
                onChange={handleCustomCircleColorChange}
                style={{ width: '100%', height: '40px', cursor: 'pointer' }}
              />
              <div className="control-hint">
                Sélectionnez une couleur pour tous les cercles
              </div>
            </div>
          )}
          
          {(circleTheme === CircleTheme.RAINBOW || circleTheme === CircleTheme.LAVA || circleTheme === CircleTheme.WATER) && (
            <>
              <div className="control toggle-control">
                <label className="toggle-label">
                  Animer les couleurs:
                  <button 
                    className={`toggle-button ${animateRainbow ? 'active' : ''}`}
                    onClick={handleAnimateRainbowToggle}
                  >
                    {animateRainbow ? 'ON' : 'OFF'}
                  </button>
                </label>
                <div className="control-hint">
                  Permet aux couleurs de changer avec le temps pour un effet plus dynamique
                </div>
              </div>
              
              {animateRainbow && (
                <div className="control">
                  <label>Vitesse d'animation: {gradientSpeed.toFixed(1)}</label>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="3" 
                    step="0.1" 
                    value={gradientSpeed}
                    onChange={handleGradientSpeedChange}
                  />
                  <div className="control-hint">
                    Contrôle la vitesse de changement des couleurs
                  </div>
                </div>
              )}
            </>
          )}
          
          {circleTheme === CircleTheme.NEON && (
            <div className="control">
              <label>Intensité de la lueur: {Math.round(glowIntensity * 100)}%</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={glowIntensity}
                onChange={handleGlowIntensityChange}
              />
              <div className="control-hint">
                Ajuste l'intensité de l'effet lumineux néon
              </div>
            </div>
          )}
          
          <div className="control">
            <label>Épaisseur des cercles: {circleStrokeWidth}px</label>
            <input 
              type="range" 
              min="1" 
              max="15" 
              step="1" 
              value={circleStrokeWidth}
              onChange={handleCircleStrokeWidthChange}
            />
            <div className="control-hint">
              Ajuste l'épaisseur des traits des cercles
            </div>
          </div>
          
          {/* Legacy option for backward compatibility */}
          <div className="control toggle-control" style={{ display: 'none' }}>
            <label className="toggle-label">
              Cercles arc-en-ciel:
              <button 
                className={`toggle-button ${useRainbowCircles ? 'active' : ''}`}
                onClick={handleUseRainbowCirclesToggle}
              >
                {useRainbowCircles ? 'ON' : 'OFF'}
              </button>
            </label>
          </div>
        </div>
        
        {/* Ball customization section */}
        <div className="ball-customization-section" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
          <h5>Personnalisation des Balles</h5>
          
          <div className="control">
            <label>Thème des balles:</label>
            <select 
              className="style-select"
              value={ballTheme}
              onChange={handleBallThemeChange}
              style={{ 
                padding: "10px", 
                fontSize: "16px", 
                width: "100%",
                marginBottom: "10px",
                borderColor: ballTheme !== 'default' ? '#4CAF50' : '#ccc',
                backgroundColor: ballTheme !== 'default' ? '#f0fff0' : '#fff' 
              }}
            >
              <option value="default">Par défaut (couleurs aléatoires)</option>
              <option value="rainbow">Arc-en-ciel</option>
              <option value="fire">Feu</option>
              <option value="ice">Glace</option>
              <option value="neon">Néon</option>
            </select>
            <div className="control-hint">
              Choisissez un thème visuel pour les balles (sélection actuelle: <strong>{ballTheme}</strong>)
            </div>
          </div>
          
          {ballTheme === 'default' && (
            <div className="control">
              <label>Couleur personnalisée:</label>
              <input 
                type="color" 
                value={customBallColor}
                onChange={handleCustomBallColorChange}
                style={{ width: '100%', height: '40px', cursor: 'pointer' }}
              />
              <div className="control-hint">
                Sélectionnez une couleur pour toutes les balles
              </div>
            </div>
          )}
          
          <div className="control toggle-control">
            <label className="toggle-label">
              Traînée lumineuse:
              <button 
                className={`toggle-button ${ballHasTrail ? 'active' : ''}`}
                onClick={handleBallTrailToggle}
              >
                {ballHasTrail ? 'ON' : 'OFF'}
              </button>
            </label>
            <div className="control-hint">
              Ajoute un effet de traînée derrière les balles en mouvement
            </div>
          </div>
          
          {ballHasTrail && (
            <>
              <div className="control">
                <label>Couleur de la traînée:</label>
                <input 
                  type="color" 
                  value={ballTrailColor}
                  onChange={handleBallTrailColorChange}
                  style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                />
                <div className="control-hint">
                  Couleur des particules de la traînée
                </div>
              </div>
              
              <div className="control">
                <label>Longueur de la traînée: {ballTrailLength}</label>
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  step="1" 
                  value={ballTrailLength}
                  onChange={handleBallTrailLengthChange}
                />
                <div className="control-hint">
                  Nombre de particules dans la traînée
                </div>
              </div>
            </>
          )}
          
          <div className="control">
            <label>Épaisseur du contour: {ballStrokeWidth}px</label>
            <input 
              type="range" 
              min="0" 
              max="10" 
              step="1" 
              value={ballStrokeWidth}
              onChange={handleBallStrokeWidthChange}
            />
            <div className="control-hint">
              Épaisseur du contour des balles (0 pour désactiver)
            </div>
          </div>
          
          {ballStrokeWidth > 0 && (
            <div className="control">
              <label>Couleur du contour:</label>
              <input 
                type="color" 
                value={ballStrokeColor}
                onChange={handleBallStrokeColorChange}
                style={{ width: '100%', height: '40px', cursor: 'pointer' }}
              />
              <div className="control-hint">
                Couleur du contour des balles
              </div>
            </div>
          )}
          
          <div className="control toggle-control">
            <label className="toggle-label">
              Effet lumineux:
              <button 
                className={`toggle-button ${ballHasGlow ? 'active' : ''}`}
                onClick={handleBallGlowToggle}
              >
                {ballHasGlow ? 'ON' : 'OFF'}
              </button>
            </label>
            <div className="control-hint">
              Ajoute un effet lumineux autour des balles
            </div>
          </div>
          
          {ballHasGlow && (
            <>
              <div className="control">
                <label>Couleur de l'effet:</label>
                <input 
                  type="color" 
                  value={ballGlowColor}
                  onChange={handleBallGlowColorChange}
                  style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                />
                <div className="control-hint">
                  Couleur de l'effet lumineux
                </div>
              </div>
              
              <div className="control">
                <label>Intensité lumineuse: {ballGlowSize}</label>
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  step="1" 
                  value={ballGlowSize}
                  onChange={handleBallGlowSizeChange}
                />
                <div className="control-hint">
                  Intensité de l'effet lumineux
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Sons personnalisés */}
        {renderCirclesCustomSounds()}
        
        {/* Images personnalisées */}
        {renderRotatingCirclesImageSettings()}

        <div className="control">
          <label>Taille de la porte de sortie (degrés): {exitSize}</label>
          <input 
            type="range" 
            min="5" 
            max="180" 
            step="5" 
            value={exitSize}
            onChange={handleExitSizeChange}
          />
          <div className="control-hint">
            La taille de l'ouverture dans chaque cercle
          </div>
        </div>

        <div className="control">
          <label>Balles créées à la destruction: {ballsOnDestroy}</label>
          <input 
            type="range" 
            min="0" 
            max="10" 
            step="1" 
            value={ballsOnDestroy}
            onChange={handleBallsOnDestroyChange}
          />
          <div className="control-hint">
            Nombre de balles créées lorsqu'un cercle est détruit (0 pour désactiver)
          </div>
        </div>

        <div className="control">
          <label>Décalage progressif de rotation: {progressiveRotationOffset}%</label>
          <input 
            type="range" 
            min="-20" 
            max="20" 
            step="1" 
            value={progressiveRotationOffset}
            onChange={handleProgressiveRotationOffsetChange}
          />
          <div className="control-hint">
            Décale la rotation de chaque cercle d'un pourcentage progressif (-20% à +20%)
          </div>
        </div>

        <div className="control">
          <label>Vitesse de rotation: {rotationSpeed.toFixed(3)}</label>
          <input 
            type="range" 
            min="0.001" 
            max="0.1" 
            step="0.001" 
            value={rotationSpeed}
            onChange={handleRotationSpeedChange}
          />
          <div className="control-hint">
            Détermine la vitesse de rotation des cercles
          </div>
        </div>
      </div>
    );
  };
  
  const handleMaxBallSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxBallSpeed(parseFloat(e.target.value));
  };
  
  const handleShrinkCirclesToggle = () => {
    setShrinkCirclesOnDestroy(!shrinkCirclesOnDestroy);
  };
  
  const handleShrinkFactorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShrinkFactor(parseFloat(e.target.value));
  };
  
  // Fonction pour gérer le plein écran
  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Erreur de passage en plein écran: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };
  
  // Fonction pour gérer le bouton play/pause
  const handlePlayPause = () => {
    if (isPlaying) {
      handleStopGame();
    } else {
      handleStartGame();
    }
  };
  
  // Fonction pour afficher les options de jeu
  const renderGameOptions = () => {
    return (
      <div className="game-options">
        <button 
          className={`game-option ${selectedGame === GameType.GROWING_BALL ? 'active' : ''}`}
          onClick={() => handleGameSelect(GameType.GROWING_BALL)}
        >
          <div className="game-option-title">Balles Rebondissantes</div>
          <div className="game-option-desc">Classique! Les balles rebondissent et grossissent avec le temps.</div>
        </button>
        <button 
          className={`game-option ${selectedGame === GameType.ROTATING_CIRCLE ? 'active' : ''}`}
          onClick={() => handleGameSelect(GameType.ROTATING_CIRCLE)}
        >
          <div className="game-option-title">Rotation</div>
          <div className="game-option-desc">Faites sortir les balles à travers l'ouverture rotative.</div>
        </button>
        <button 
          className={`game-option ${selectedGame === GameType.COLLAPSING_ROTATING_CIRCLES ? 'active' : ''}`}
          onClick={() => handleGameSelect(GameType.COLLAPSING_ROTATING_CIRCLES)}
        >
          <div className="game-option-title">Cercles Rotatifs</div>
          <div className="game-option-desc">Faites passer la balle par les portes des cercles en rotation pour les détruire.</div>
        </button>
      </div>
    );
  };
  
  // Fonction pour gérer le changement du nombre de balles à créer
  const handleBallsOnDestroyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBallsOnDestroy(parseInt(e.target.value));
  };

  // Fonction pour déclencher l'upload du son de passage de porte
  const triggerExitSoundUpload = () => {
    if (exitSoundFileInputRef.current) {
      exitSoundFileInputRef.current.click();
    }
  };

  // Fonction pour gérer l'upload du son de passage de porte
  const handleExitSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Vérifier que c'est bien un fichier audio
      if (!file.type.startsWith('audio/')) {
        alert('Veuillez sélectionner un fichier audio valide.');
        return;
      }
      
      // Vérifier si le format est supporté (MP3, WAV, OGG, M4A, AAC)
      const supportedFormats = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];
      if (!supportedFormats.includes(file.type) && !file.type.startsWith('audio/')) {
        console.warn(`Format de fichier potentiellement non supporté: ${file.type}. On essaie quand même.`);
      }
      
      // Créer un objet URL pour précharger et tester le fichier audio
      const audioUrl = URL.createObjectURL(file);
      const audioTest = new Audio(audioUrl);
      
      // Vérifier si le fichier peut être lu
      audioTest.addEventListener('canplaythrough', () => {
        console.log(`Son de passage de porte chargé avec succès: ${file.name}`);
        setCustomExitSound(file);
        URL.revokeObjectURL(audioUrl);
      });
      
      audioTest.addEventListener('error', () => {
        console.error(`Erreur lors du chargement du son: ${file.name}`);
        alert('Ce fichier audio ne peut pas être lu. Veuillez essayer un autre format.');
        URL.revokeObjectURL(audioUrl);
      });
      
      // Démarrer le chargement pour tester
      audioTest.load();
    }
  };

  // Fonction pour supprimer le son personnalisé de passage de porte
  const removeExitSoundFile = () => {
    setCustomExitSound(null);
    if (exitSoundFileInputRef.current) {
      exitSoundFileInputRef.current.value = '';
    }
  };

  // Ajouter l'état pour le son personnalisé de passage de porte
  const [customExitSound, setCustomExitSound] = useState<File | null>(null);
  // Add state for exit sound volume
  const [customExitSoundVolume, setCustomExitSoundVolume] = useState<number>(0.5);

  // Ajouter la section pour gérer les sons personnalisés des cercles rotatifs
  const renderCirclesCustomSounds = () => {
    if (selectedGame !== GameType.COLLAPSING_ROTATING_CIRCLES || !useCustomSounds) {
      return null;
    }

    return (
      <div className="custom-sounds-section">
        <h4>Sons Personnalisés - Cercles Rotatifs</h4>
        
        <div className="sound-upload-container">
          <div className="sound-item">
            <span className="sound-label">Son de passage de porte:</span>
            <div className="sound-buttons">
              <input
                type="file"
                ref={exitSoundFileInputRef}
                onChange={handleExitSoundUpload}
                accept="audio/*"
                style={{ display: 'none' }}
              />
              <button 
                className="upload-button" 
                onClick={triggerExitSoundUpload}
              >
                {customExitSound ? '🔄 Changer' : '📤 Choisir un fichier'}
              </button>
              {customExitSound && (
                <button 
                  className="delete-button" 
                  onClick={removeExitSoundFile}
                >
                  🗑️ Supprimer
                </button>
              )}
            </div>
            {customExitSound && (
              <div className="sound-info">
                <span className="sound-filename">{customExitSound.name}</span>
                <audio controls>
                  <source src={URL.createObjectURL(customExitSound)} type={customExitSound.type} />
                  Votre navigateur ne supporte pas l'élément audio.
                </audio>
                
                {/* Add volume control slider */}
                <div className="volume-control" style={{ marginTop: '10px' }}>
                  <label>Volume: {Math.round(customExitSoundVolume * 100)}%</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={customExitSoundVolume}
                    onChange={(e) => setCustomExitSoundVolume(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Ajouter des variables d'état pour les images personnalisées et l'héritage d'image
  const [useRotatingCirclesCustomImages, setUseRotatingCirclesCustomImages] = useState<boolean>(false);
  const [rotatingCirclesImageFiles, setRotatingCirclesImageFiles] = useState<string[]>([]);
  const [rotatingCirclesBallImageAssignments, setRotatingCirclesBallImageAssignments] = useState<number[]>([]);
  const [inheritBallImage, setInheritBallImage] = useState<boolean>(false);
  const [rotatingCirclesGrowing, setRotatingCirclesGrowing] = useState<boolean>(false);
  const [rotatingCirclesGrowthRate, setRotatingCirclesGrowthRate] = useState<number>(0.01);

  // Ajouter des références pour les fichiers d'image
  const rotatingCirclesImageInputRef = useRef<HTMLInputElement>(null);

  // Fonctions pour gérer les images personnalisées pour les cercles rotatifs
  const triggerRotatingCirclesImageUpload = () => {
    if (rotatingCirclesImageInputRef.current) {
      rotatingCirclesImageInputRef.current.click();
    }
  };

  const handleRotatingCirclesImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImageFiles = [...rotatingCirclesImageFiles];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newImageFiles.push(url);
      }
    }

    setRotatingCirclesImageFiles(newImageFiles);
    if (e.target.value) e.target.value = ''; // Reset input
  };

  const removeRotatingCirclesImage = (index: number) => {
    const newImageFiles = [...rotatingCirclesImageFiles];
    // Libérer l'URL avant de la supprimer pour éviter les fuites de mémoire
    URL.revokeObjectURL(newImageFiles[index]);
    newImageFiles.splice(index, 1);
    setRotatingCirclesImageFiles(newImageFiles);

    // Mettre à jour les assignations d'images si nécessaire
    const newAssignments = [...rotatingCirclesBallImageAssignments];
    for (let i = 0; i < newAssignments.length; i++) {
      if (newAssignments[i] === index) {
        // Réinitialiser l'assignation
        newAssignments[i] = -1;
      } else if (newAssignments[i] > index) {
        // Décaler les indices supérieurs
        newAssignments[i]--;
      }
    }
    setRotatingCirclesBallImageAssignments(newAssignments);
  };

  // Fonction pour assigner une image à une balle pour les cercles rotatifs
  const assignRotatingCirclesImageToBall = (ballIndex: number, imageIndex: number) => {
    const newAssignments = [...rotatingCirclesBallImageAssignments];
    while (newAssignments.length <= ballIndex) {
      newAssignments.push(-1); // -1 pour indiquer pas d'image assignée
    }
    newAssignments[ballIndex] = imageIndex;
    setRotatingCirclesBallImageAssignments(newAssignments);
  };

  // Gérer l'option d'héritage d'image
  const handleInheritImageToggle = () => {
    setInheritBallImage(!inheritBallImage);
  };

  // Gérer l'option de croissance
  const handleRotatingCirclesGrowingToggle = () => {
    setRotatingCirclesGrowing(!rotatingCirclesGrowing);
  };

  // Gérer le taux de croissance
  const handleRotatingCirclesGrowthRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRotatingCirclesGrowthRate(parseFloat(e.target.value));
  };

  // Fonction pour gérer l'activation des images personnalisées pour les cercles rotatifs
  const handleRotatingCirclesCustomImagesToggle = () => {
    setUseRotatingCirclesCustomImages(!useRotatingCirclesCustomImages);
  };

  // Ajouter la fonction pour rendre les contrôles des images personnalisées pour les cercles rotatifs
  const renderRotatingCirclesImageSettings = () => {
    return (
      <div className="custom-images-section">
        <h4>Images personnalisées pour les balles</h4>
        
        <div className="control toggle-control">
          <label className="toggle-label">
            Utiliser des images personnalisées:
            <button 
              className={`toggle-button ${useRotatingCirclesCustomImages ? 'active' : ''}`}
              onClick={handleRotatingCirclesCustomImagesToggle}
            >
              {useRotatingCirclesCustomImages ? 'ON' : 'OFF'}
            </button>
          </label>
          <div className="control-hint">
            Permet d'utiliser des images de votre choix pour les balles
          </div>
        </div>
        
        {useRotatingCirclesCustomImages && (
          <>
            <div className="control">
              <label>Images des balles:</label>
              <div className="file-upload-container">
                <input 
                  type="file" 
                  ref={rotatingCirclesImageInputRef}
                  onChange={handleRotatingCirclesImageUpload}
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button 
                  className="upload-button"
                  onClick={triggerRotatingCirclesImageUpload}
                >
                  {rotatingCirclesImageFiles.length > 0 ? 'Ajouter d\'autres images' : 'Ajouter des images'}
                </button>
              </div>
              
              {rotatingCirclesImageFiles.length > 0 && (
                <div className="image-thumbnails">
                  {rotatingCirclesImageFiles.map((url, index) => (
                    <div key={index} className="image-thumbnail-container">
                      <img 
                        src={url} 
                        alt={`Thumbnail ${index}`} 
                        className="image-thumbnail"
                      />
                      <button 
                        className="remove-image-button"
                        onClick={() => removeRotatingCirclesImage(index)}
                      >
                        X
                      </button>
                      <div className="image-index">{index + 1}</div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="control-hint">
                Formats acceptés: JPEG, PNG, GIF, SVG
              </div>
            </div>
            
            {ballCount > 1 && rotatingCirclesImageFiles.length > 0 && (
              <div className="control">
                <label>Assigner des images aux balles:</label>
                <div className="ball-assignments">
                  {Array.from({ length: ballCount }).map((_, ballIndex) => (
                    <div key={ballIndex} className="ball-assignment">
                      <span>Balle {ballIndex + 1}:</span>
                      <select
                        value={rotatingCirclesBallImageAssignments[ballIndex] || -1}
                        onChange={(e) => assignRotatingCirclesImageToBall(ballIndex, parseInt(e.target.value))}
                      >
                        <option value="-1">Aléatoire</option>
                        {rotatingCirclesImageFiles.map((_, imageIndex) => (
                          <option key={imageIndex} value={imageIndex}>Image {imageIndex + 1}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="control toggle-control">
              <label className="toggle-label">
                Hériter de l'image parent:
                <button 
                  className={`toggle-button ${inheritBallImage ? 'active' : ''}`}
                  onClick={handleInheritImageToggle}
                >
                  {inheritBallImage ? 'ON' : 'OFF'}
                </button>
              </label>
              <div className="control-hint">
                Les nouvelles balles créées héritent de l'image de la balle qui a touché la porte
              </div>
            </div>
            
            <div className="control toggle-control">
              <label className="toggle-label">
                Croissance des balles:
                <button 
                  className={`toggle-button ${rotatingCirclesGrowing ? 'active' : ''}`}
                  onClick={handleRotatingCirclesGrowingToggle}
                >
                  {rotatingCirclesGrowing ? 'ON' : 'OFF'}
                </button>
              </label>
              <div className="control-hint">
                Active la croissance progressive des balles comme dans le jeu Balles Rebondissantes
              </div>
            </div>
            
            {rotatingCirclesGrowing && (
              <div className="control">
                <label>Taux de croissance: {rotatingCirclesGrowthRate.toFixed(3)}</label>
                <input 
                  type="range" 
                  min="0.001" 
                  max="0.05" 
                  step="0.001" 
                  value={rotatingCirclesGrowthRate}
                  onChange={handleRotatingCirclesGrowthRateChange}
                />
                <div className="control-hint">
                  Vitesse à laquelle les balles grossissent au fil du temps
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Add handlers for the rotating circles door destruction MIDI settings
  const handleRotatingCirclesPlayMidiOnDoorDestroy = () => {
    setRotatingCirclesPlayMidiOnDoorDestroy(!rotatingCirclesPlayMidiOnDoorDestroy);
  };

  const handleRotatingCirclesMidiVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRotatingCirclesMidiVolume(parseFloat(e.target.value));
  };

  const handleRotatingCirclesPlayMusicOnDoorDestroy = () => {
    setRotatingCirclesPlayMusicOnDoorDestroy(!rotatingCirclesPlayMusicOnDoorDestroy);
  };

  const handleRotatingCirclesDoorDestroyMusicVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRotatingCirclesDoorDestroyMusicVolume(parseFloat(e.target.value));
  };

  // Rainbow circle handlers
  const handleUseRainbowCirclesToggle = () => {
    setUseRainbowCircles(prev => !prev);
    // If enabling rainbow circles, set the theme to RAINBOW
    if (!useRainbowCircles) {
      setCircleTheme(CircleTheme.RAINBOW);
    }
  };

  const handleCircleStrokeWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCircleStrokeWidth(parseInt(e.target.value, 10));
  };

  const handleAnimateRainbowToggle = () => {
    setAnimateRainbow(prev => !prev);
  };
  
  // New circle theme handlers
  const handleCircleThemeChange = (theme: CircleTheme) => {
    setCircleTheme(theme);
    // If setting to RAINBOW, enable useRainbowCircles for backward compatibility
    if (theme === CircleTheme.RAINBOW) {
      setUseRainbowCircles(true);
    } else {
      setUseRainbowCircles(false);
    }
  };
  
  const handleCustomCircleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomCircleColor(e.target.value);
  };
  
  const handleGlowIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlowIntensity(parseFloat(e.target.value));
  };
  
  const handleGradientSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGradientSpeed(parseFloat(e.target.value));
  };
  
  // Add handlers for ball customization
  const handleCustomBallColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomBallColor(e.target.value);
  };

  const handleBallTrailToggle = () => {
    setBallHasTrail(!ballHasTrail);
  };

  const handleBallTrailColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBallTrailColor(e.target.value);
  };

  const handleBallTrailLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBallTrailLength(parseInt(e.target.value, 10));
  };

  const handleBallStrokeWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBallStrokeWidth(parseInt(e.target.value, 10));
  };

  const handleBallStrokeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBallStrokeColor(e.target.value);
  };

  const handleBallGlowToggle = () => {
    setBallHasGlow(!ballHasGlow);
  };

  const handleBallGlowColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBallGlowColor(e.target.value);
  };

  const handleBallGlowSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBallGlowSize(parseInt(e.target.value, 10));
  };

  const handleBallThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // Explicitly cast to the specific theme type to ensure correct type safety
    const selectedTheme = e.target.value as 'default' | 'rainbow' | 'fire' | 'ice' | 'neon';
    console.log("Ball theme changed to:", selectedTheme); // Add logging for debugging
    setBallTheme(selectedTheme);
  };
  
  // Render function for the main component with sidebar layout
  return (
    <div className="app-container">
      {/* Left sidebar with controls */}
      <div className="controls-sidebar">
        <div className="sidebar-header">
          <h1>TikTok Ball Game</h1>
        </div>
        
        {/* Game selection or game controls */}
        {!selectedGame ? (
          <div className="game-selection-sidebar">
            <h2>Sélectionnez un jeu</h2>
            <div className="game-options-sidebar">
              <button 
                className="game-button"
                onClick={() => handleGameSelect(GameType.GROWING_BALL)}
              >
                <div className="game-button-title">Balles Rebondissantes</div>
                <div className="game-button-desc">Classique! Les balles rebondissent sur les murs et grossissent avec le temps.</div>
              </button>
              <button 
                className="game-button"
                onClick={() => handleGameSelect(GameType.ROTATING_CIRCLE)}
              >
                <div className="game-button-title">Rotation</div>
                <div className="game-button-desc">Faites sortir les balles à travers l'ouverture rotative.</div>
              </button>
              <button 
                className="game-button"
                onClick={() => handleGameSelect(GameType.COLLAPSING_ROTATING_CIRCLES)}
              >
                <div className="game-button-title">Cercles Rotatifs</div>
                <div className="game-button-desc">Faites passer la balle par les portes des cercles en rotation pour les détruire.</div>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Game controls */}
            {renderGameControls()}
          
            {/* Tabs navigation */}
            <div className="controls-tabs">
              <button 
                className={`tab-button ${activeTab === 'physics' ? 'active' : ''}`}
                onClick={() => handleTabChange('physics')}
              >
                <span className="tab-icon">🎮</span> Physique
              </button>
              <button 
                className={`tab-button ${activeTab === 'effects' ? 'active' : ''}`}
                onClick={() => handleTabChange('effects')}
              >
                <span className="tab-icon">✨</span> Effets
              </button>
              <button 
                className={`tab-button ${activeTab === 'images' ? 'active' : ''}`}
                onClick={() => handleTabChange('images')}
              >
                <span className="tab-icon">🖼️</span> Images
              </button>
              <button 
                className={`tab-button ${activeTab === 'sounds' ? 'active' : ''}`}
                onClick={() => handleTabChange('sounds')}
              >
                <span className="tab-icon">🔊</span> Sons
              </button>
              <button 
                className={`tab-button ${activeTab === 'music' ? 'active' : ''}`}
                onClick={() => handleTabChange('music')}
              >
                <span className="tab-icon">🎵</span> Musique
              </button>
              <button 
                className={`tab-button ${activeTab === 'sequence' ? 'active' : ''}`}
                onClick={() => handleTabChange('sequence')}
              >
                <span className="tab-icon">🎼</span> Séquence
              </button>
              <button 
                className={`tab-button ${activeTab === 'midi' ? 'active' : ''}`}
                onClick={() => handleTabChange('midi')}
              >
                <span className="tab-icon">🎹</span> MIDI
              </button>
            </div>

            {/* Tab content panels */}
            <div className={`control-panel ${activeTab === 'physics' ? 'active' : ''}`}>
              {renderPhysicsSettings()}
              {renderCollapsingRotatingCirclesSettings()}
            </div>
        
            <div className={`control-panel ${activeTab === 'effects' ? 'active' : ''}`}>
              <div className="effects-section">
                <h4>Effets & Gameplay</h4>
                <div className="toggle-options">
              <div className="toggle-control">
                <label className="toggle-label">
                      Effets de particules:
                  <button
                        className={`toggle-button ${effectsEnabled ? 'active' : ''}`}
                        onClick={handleEffectsToggle}
                  >
                        {effectsEnabled ? 'ON' : 'OFF'}
                  </button>
                    </label>
                  </div>
                  <div className="toggle-control">
                    <label className="toggle-label">
                      Collisions entre balles:
                      <button 
                        className={`toggle-button ${ballCollisionsEnabled ? 'active' : ''}`}
                        onClick={handleBallCollisionsToggle}
                      >
                        {ballCollisionsEnabled ? 'ON' : 'OFF'}
                      </button>
                    </label>
                  </div>
                  <div className="toggle-control">
                    <label className="toggle-label">
                      Suivi du score:
                <button 
                  className={`toggle-button ${scoreTrackingEnabled ? 'active' : ''}`}
                  onClick={handleScoreTrackingToggle}
                >
                  {scoreTrackingEnabled ? 'ON' : 'OFF'}
                </button>
              </label>
            </div>
            <div className="toggle-control">
              <label className="toggle-label">
                      Effets d'arrière-plan:
                <button 
                  className={`toggle-button ${bgEffectsEnabled ? 'active' : ''}`}
                  onClick={handleBgEffectsToggle}
                >
                  {bgEffectsEnabled ? 'ON' : 'OFF'}
                </button>
              </label>
                  </div>
            </div>
          </div>
        </div>
        
            <div className={`control-panel ${activeTab === 'images' ? 'active' : ''}`}>
        <div className="custom-images-section">
                <h4>Images Personnalisées</h4>
          <div className="image-toggle-container">
            <label className="toggle-label">
                    Utiliser des images personnalisées:
              <button 
                className={`toggle-button ${useCustomImages ? 'active' : ''}`}
                onClick={handleCustomImagesToggle}
              >
                {useCustomImages ? 'ON' : 'OFF'}
              </button>
            </label>
          </div>
          
          <div className={`image-upload-container ${useCustomImages ? 'active' : ''}`}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <button
              className="upload-button"
              onClick={triggerFileUpload}
              disabled={!useCustomImages}
            >
                    Télécharger Image
            </button>
            
            {uploadedImagePreviews.length > 0 && (
                <div className="image-previews">
                  {uploadedImagePreviews.map((src, index) => (
                        <div className="image-preview-item" key={index}>
                          <img src={src} alt={`Image ${index}`} />
                      <button 
                        className="remove-image" 
                        onClick={() => removeImage(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            
                  <div className="upload-info">
                    Formats supportés: PNG, JPG, GIF<br />
                    Taille recommandée: 128×128px
                  </div>
                </div>
                
                {useCustomImages && uploadedImagePreviews.length > 0 && (
                <div className="assignment-toggle-container">
                  <button
                    className={`assignment-toggle-button ${showImageAssignment ? 'active' : ''}`}
                    onClick={handleImageAssignmentToggle}
                  >
                      {showImageAssignment ? 'Masquer les assignations' : 'Assigner des images aux balles'}
                  </button>
                    
                    {showImageAssignment && renderBallImageAssignment()}
                </div>
              )}
          </div>
        </div>
        
            <div className={`control-panel ${activeTab === 'sounds' ? 'active' : ''}`}>
        {renderCustomSounds()}
            </div>
            
            <div className={`control-panel ${activeTab === 'music' ? 'active' : ''}`}>
              {renderMusicSection()}
              {renderBackgroundMusicSection()}
              {renderProgressiveSoundSection()}
              {renderMusicConversionSection()}
              {renderCustomMusicScales()}
      </div>
            
            <div className={`control-panel ${activeTab === 'sequence' ? 'active' : ''}`}>
              {renderExtractedMusicSection()}
        </div>
        <div className={`control-panel ${activeTab === 'midi' ? 'active' : ''}`}>
          {renderMidiSection()}
        </div>
          </>
      )}
      </div>
      
      {/* Right content area with game */}
      <div className="game-content">
      <div className="game-container">
          {selectedGame ? renderGame() : (
            <div className="game-welcome">
              <h2>Bienvenue dans TikTok Ball Game!</h2>
              <p>Sélectionnez un jeu dans le menu pour commencer.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameSelector; 
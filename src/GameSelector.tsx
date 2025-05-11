import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GameType } from './types';
import GrowingBall from './games/GrowingBall';
import RotatingCircle from './games/RotatingCircle';
import TrailBall from './games/TrailBall';
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
  convertAudioToMIDI,
  playMIDINote,
  hasMIDISequence,
  clearMIDISequence,
  setMIDIVolume,
  loadMIDIFile
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
const soundTypes = ['bounce', 'grow', 'gameOver'] as const;
type SoundType = typeof soundTypes[number];

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
    gameOver: useRef<HTMLInputElement>(null)
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
  const [bounceVolume, setBounceVolume] = useState<number>(0.7);
  // Add a state for progressive sound volume in GameSelector 
  const [progressiveSoundVolume, setProgressiveSoundVolume] = useState<number>(0.7);
  
  // Nouveaux états pour la conversion MIDI
  const [midiEnabled, setMidiEnabled] = useState<boolean>(false);
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [midiNoteCount, setMidiNoteCount] = useState<number>(24);
  const midiFileRef = useRef<HTMLInputElement>(null);
  const [midiConversionInProgress, setMidiConversionInProgress] = useState<boolean>(false);
  const [midiVolume, setMidiVolume] = useState<number>(0.7);
  
  // Nouveaux états pour le fichier MIDI
  const [directMidiFile, setDirectMidiFile] = useState<File | null>(null);
  const directMidiFileRef = useRef<HTMLInputElement>(null);
  const [midiLoadingInProgress, setMidiLoadingInProgress] = useState<boolean>(false);
  
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
  };
  
  const handleStartGame = () => {
    // Arrêter tous les sons avant de démarrer le jeu
    stopAllSounds();
    // Reset game state before starting
    setIsPlaying(false);
    setTimeout(() => {
      setIsPlaying(true);
      playGameStartSound();
    }, 100);
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
    }, 200); // Slightly longer delay for more reliable reset
  };
  
  const handleGameEnd = () => {
    setIsPlaying(false);
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
    setUseCustomSounds(!useCustomSounds);
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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0]; // On prend seulement le premier fichier
    
    // Mettre à jour l'état avec le nouveau fichier son
    setSoundFiles(prev => ({
      ...prev,
      [soundType]: file
    }));
    
    // Charger le son dans le système audio
    loadCustomSound(file, soundType);
  };
  
  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const triggerSoundUpload = (soundType: SoundType) => {
    if (soundFileRefs[soundType].current) {
      soundFileRefs[soundType].current!.click();
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
    // Supprimer le fichier son
    setSoundFiles(prev => {
      const updated = { ...prev };
      delete updated[soundType];
      return updated;
    });
    
    // Effacer le son personnalisé
    clearCustomSound(soundType);
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
  
  const renderGame = () => {
    switch (selectedGame) {
      case GameType.GROWING_BALL:
        // Utilisez le spread operator pour passer toutes les props nécessaires
        return (
          <GrowingBall
            isPlaying={isPlaying}
            onGameEnd={handleGameEnd}
            gravity={gravity}
            growthRate={growthRate}
            bounciness={bounciness}
            ballSpeed={ballSpeed}
            ballCount={ballCount}
            initialBallCount={ballCount}
            effectsEnabled={effectsEnabled}
            ballCollisionsEnabled={ballCollisionsEnabled}
            scoreTrackingEnabled={scoreTrackingEnabled}
            bgEffectsEnabled={bgEffectsEnabled}
            useCustomImages={useCustomImages}
            customImages={customImages}
            ballImageAssignments={ballImageAssignments}
            useCustomSounds={useCustomSounds}
            customBallSounds={{}} // Pas encore implémenté correctement
            musicEnabled={musicEnabled}
            ballMusicAssignments={ballMusicAssignments}
            backgroundMusicEnabled={backgroundMusicEnabled}
            progressiveSoundEnabled={progressiveSoundEnabled}
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
          />
        );

      case GameType.ROTATING_CIRCLE:
        return (
          <RotatingCircle
            isPlaying={isPlaying}
            onGameEnd={handleGameEnd}
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
            <button 
              className="control-button start"
              onClick={handleStartGame}
            >
              Démarrer
            </button>
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
            </>
          )}
        </div>
        
        {/* Add global volume controls here so they're accessible during gameplay */}
        <div className="global-volume-controls" style={{ marginTop: '15px', marginBottom: '20px' }}>
          <div className="volume-control">
            <label style={{ display: 'block', marginBottom: '5px', color: '#fff', fontSize: '14px' }}>
              Wall Bounce Volume: {Math.round(bounceVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={bounceVolume}
              onChange={(e) => handleVolumeChange('bounce', parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '11px', color: '#ddd', marginTop: '3px' }}>
              Controls only the standard bounce sound when balls hit walls
            </div>
          </div>
          
          {progressiveSoundEnabled && hasProgressiveSound() && (
            <div className="volume-control" style={{ marginTop: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#fff', fontSize: '14px' }}>
                Progressive Sound: {Math.round(progressiveSoundVolume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={progressiveSoundVolume}
                onChange={(e) => handleVolumeChange('progressive', parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '11px', color: '#ddd', marginTop: '3px' }}>
                Controls volume of progressive sound segments during collisions
              </div>
            </div>
          )}
        </div>
      </>
    );
  };
  
  // Render custom sounds interface
  const renderCustomSounds = () => {
    if (selectedGame !== GameType.GROWING_BALL || isPlaying) {
      return null;
    }
    
    return (
      <div className="custom-sounds-section">
        <h4>Custom Sound Effects</h4>
        
        <div className="sound-toggle-container">
          <label className="toggle-label">
            Use Custom Sounds:
            <button 
              className={`toggle-button ${useCustomSounds ? 'active' : ''}`}
              onClick={handleCustomSoundsToggle}
            >
              {useCustomSounds ? 'ON' : 'OFF'}
            </button>
          </label>
        </div>
        
        <div className={`sound-upload-container ${useCustomSounds ? 'active' : ''}`}>
          {soundTypes.map(soundType => (
            <div key={soundType} className="sound-item">
              <div className="sound-type">
                {soundType.charAt(0).toUpperCase() + soundType.slice(1)} Sound:
              </div>
              <div className="sound-controls">
                <input
                  type="file"
                  ref={soundFileRefs[soundType]}
                  onChange={(e) => handleSoundUpload(e, soundType)}
                  accept="audio/*"
                  className="file-input"
                  style={{ display: 'none' }}
                />
                
                <button
                  className="upload-button"
                  onClick={() => triggerSoundUpload(soundType)}
                  disabled={!useCustomSounds}
                >
                  {soundFiles[soundType] ? 'Change Sound' : 'Upload Sound'}
                </button>
                
                {soundFiles[soundType] && (
                  <>
                    <span className="sound-filename">
                      {soundFiles[soundType]?.name 
                        ? (soundFiles[soundType]!.name.length > 20 
                           ? soundFiles[soundType]!.name.substring(0, 20) + '...' 
                           : soundFiles[soundType]!.name)
                        : 'No file selected'}
                    </span>
                    <button 
                      className="remove-sound"
                      onClick={() => removeSoundFile(soundType)}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          
          {useCustomSounds && !Object.keys(soundFiles).length && (
            <p className="upload-info">Upload at least one sound file to use custom sounds.</p>
          )}
        </div>
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
    if (selectedGame !== GameType.GROWING_BALL || isPlaying) {
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
    } else if (type === 'progressive') {
      setProgressiveSoundVolume(value);
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
    setMidiConversionInProgress(true);
    alert("Conversion en MIDI en cours... Veuillez patienter pendant l'analyse.");
    
    try {
      // Convertir le fichier audio en séquence MIDI
      await convertAudioToMIDI(file, midiNoteCount);
      
      // Activer le mode MIDI
      if (!midiEnabled) {
        setMidiEnabled(true);
      }
      
      // Réinitialiser le champ
      e.target.value = '';
      
      alert("Conversion MIDI terminée avec succès!");
    } catch (err) {
      console.error('Erreur lors de la conversion MIDI:', err);
      alert("Une erreur s'est produite lors de la conversion. Veuillez réessayer avec un autre fichier audio.");
    } finally {
      setMidiConversionInProgress(false);
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

  // Fonction pour gérer l'upload d'un fichier MIDI direct
  const handleDirectMidiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setDirectMidiFile(file);
    
    // Afficher un message de chargement
    setMidiLoadingInProgress(true);
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
    } finally {
      setMidiLoadingInProgress(false);
    }
  };
  
  const triggerDirectMidiUpload = () => {
    if (directMidiFileRef.current) {
      directMidiFileRef.current.click();
    }
  };

  // Nouveau composant pour afficher la section MIDI
  const renderMidiSection = () => {
    return (
      <div className="midi-section">
        <h4>MIDI Sound</h4>
        <p className="midi-note">
          Charger un fichier MIDI ou convertir une chanson pour jouer des notes quand la balle touche un mur
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
            Nombre de notes MIDI (pour la conversion): {midiNoteCount}
            <input
              type="range"
              min="8"
              max="48"
              value={midiNoteCount}
              onChange={(e) => setMidiNoteCount(parseInt(e.target.value))}
            />
          </label>
          
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
        </div>
        
        {/* Section pour charger un fichier MIDI directement */}
        <div className="midi-file-section">
          <h5>Charger un fichier MIDI directement</h5>
          
          <input
            type="file"
            ref={directMidiFileRef}
            onChange={handleDirectMidiUpload}
            accept=".mid,.midi"
            style={{ display: 'none' }}
          />
          
          <div className="midi-upload-controls">
            <button
              className="upload-button"
              onClick={triggerDirectMidiUpload}
              disabled={midiLoadingInProgress}
              style={{
                backgroundColor: '#4285f4',
                margin: '10px 0'
              }}
            >
              {midiLoadingInProgress 
                ? "Chargement en cours..." 
                : "Charger un fichier MIDI (.mid)"}
            </button>
            
            {directMidiFile && (
              <div className="midi-file-info" style={{ marginBottom: '15px' }}>
                <div className="file-name" style={{ fontSize: '14px', marginBottom: '5px' }}>
                  <strong>Fichier MIDI:</strong> {directMidiFile.name}
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
        
      </div>
    );
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
                Balles Rebondissantes
              </button>
              <button 
                className="game-button"
                onClick={() => handleGameSelect(GameType.ROTATING_CIRCLE)}
              >
                Rotation
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
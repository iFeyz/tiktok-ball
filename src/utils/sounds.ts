import * as Tone from 'tone';
import * as MidiParser from 'midi-parser-js';

// Initialize a synth
const synth = new Tone.PolySynth(Tone.Synth).toDestination();

// Initialize effects
const reverb = new Tone.Reverb(1.5).toDestination();

// Gammes musicales pour les balles
export const MUSIC_SCALES = {
  majorScale: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  minorScale: ['C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
  pentatonic: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
  blues: ['C4', 'Eb4', 'F4', 'Gb4', 'G4', 'Bb4', 'C5'],
  jazz: ['C4', 'D4', 'E4', 'G4', 'A4', 'B4', 'C5'],
  eastern: ['C4', 'Db4', 'E4', 'F4', 'G4', 'Ab4', 'B4', 'C5']
};

// Son personnalisés pour les gammes musicales
export type CustomMusicKey = string;
export const CUSTOM_MUSIC: {[key: CustomMusicKey]: HTMLAudioElement[]} = {};

// Musique de fond
let backgroundMusic: HTMLAudioElement | null = null;
let backgroundMusicVolume = 0.5;
let isBackgroundMusicPlaying = false;

// Objets pour suivre la progression musicale de chaque balle
type BallMusicState = {
  currentIndex: number;
  noteCount: number;
  lastPlayTime: number;
  tempo: number; // en millisecondes entre les notes
  scale: string[] | HTMLAudioElement[];
  isCustom: boolean;
};

const ballMusicStates: { [key: string]: BallMusicState } = {};

// Variables for progressive sound
let progressiveSound: HTMLAudioElement | null = null;
let progressiveSoundSegments: {audio: HTMLAudioElement, duration: number}[] = [];
let lastProgressiveSoundPlayTime = 0;
let isPlayingProgressiveSound = false;
let currentSegmentIndex = 0;
let progressiveSoundTimeout: ReturnType<typeof setTimeout> | null = null;
let progressiveSoundFadeTimeout: ReturnType<typeof setTimeout> | null = null;
let minDelayBetweenPlays = 20; // Réduire à 20ms pour une réactivité maximale
let isProgressiveSoundContinuousPlay = false; // Nouvelle variable pour le mode de lecture continue
let progressiveSoundVolume = 0.7; // Default volume for progressive sound

// Audio context pour tous les effets sonores
let audioContext: AudioContext | null = null;
let isSoundInitialized = false;

// Cache pour les effets sonores
const soundCache: { [key: string]: AudioBuffer } = {};
// Sons personnalisés uploadés par l'utilisateur
let customSounds: { bounce: AudioBuffer | null, grow: AudioBuffer | null, gameOver: AudioBuffer | null } = {
  bounce: null,
  grow: null,
  gameOver: null
};

// Point d'envoi pour l'enregistrement audio
let masterGainNode: GainNode | null = null;
let recorderDestination: MediaStreamAudioDestinationNode | null = null;

// Nouvelles variables pour l'activation des sons standards
let standardSoundsEnabled = true;
export const setStandardSoundsEnabled = (enabled: boolean): void => {
  standardSoundsEnabled = enabled;
};
export const getStandardSoundsEnabled = (): boolean => {
  return standardSoundsEnabled;
};

// Variables pour la séquence musicale extraite
let extractedNotes: string[] = [];
let currentNoteIndex = 0;
let isUsingExtractedNotes = false;

// Améliorer la gestion des sons progressifs pour une lecture plus fluide

// Ajouter des variables pour une meilleure gestion des segments audio
let progressiveAudioContext: AudioContext | null = null;
let progressiveAudioBuffer: AudioBuffer | null = null;
let progressiveAudioSource: AudioBufferSourceNode | null = null;
let progressiveGainNode: GainNode | null = null;
let progressiveSegmentDuration = 0.25; // Durée par défaut en secondes
let progressiveTotalSegments = 0;
let currentProgressiveSegment = 0;
let lastProgressivePlayTime = 0;
let progressiveOverlapFactor = 0.2; // Chevauchement entre segments (20%)
let progressiveFadeInTime = 0.02; // Fondu d'entrée en secondes
let progressiveFadeOutTime = 0.1; // Fondu de sortie en secondes

// Variables pour le support MIDI
let midiSequence: number[] = [];
let currentMidiIndex = 0;
let midiVolume = 0.7;
let rawMidiData: any = null; // Pour stocker les données MIDI brutes
let midiNotes: number[] = []; // Pour stocker les notes extraites du fichier MIDI

/**
 * Récupère le contexte audio actuel ou en crée un nouveau si nécessaire
 * @returns Le contexte audio actuel
 */
export const getAudioContext = (): AudioContext | null => {
  if (!audioContext) {
    initSound();
  }
  return audioContext;
};

/**
 * Configure le système audio pour utiliser un contexte audio existant
 * @param context Contexte audio existant à utiliser
 */
export const setAudioContext = (context: AudioContext): void => {
  if (isSoundInitialized) {
    console.warn('Sound system already initialized, cannot set new audio context');
    return;
  }
  
  audioContext = context;
  console.log('Using provided audio context for sound system');
  
  // Initialize with the provided context
  initSoundWithContext(context);
};

// Configure the audio system to connect with the recorder
export const connectToRecorder = (destination: MediaStreamAudioDestinationNode): void => {
  if (!audioContext) {
    console.error('Cannot connect to recorder: audio context not initialized');
    return;
  }
  
  // Ensure the destination belongs to the same audio context
  if (destination.context !== audioContext) {
    console.error('Cannot connect to recorder: destination belongs to a different audio context');
    return;
  }
  
  recorderDestination = destination;
  console.log('Audio connected to recorder destination');
  
  // Connect master gain node to recorder
  if (masterGainNode && recorderDestination) {
    try {
      masterGainNode.connect(recorderDestination);
      console.log('Master gain node connected to recorder');
    } catch (err) {
      console.error('Failed to connect to recorder:', err);
    }
  }
};

// Sound for ball bounce
export const playBounceSound = (volume: number = 0.7, useCustom: boolean = false): void => {
  // Ne rien jouer si les sons standards sont désactivés (à moins qu'on utilise un son custom)
  if (!standardSoundsEnabled && !useCustom) return;
  
  if (!audioContext) return;
  
  try {
    // Utiliser le son personnalisé s'il existe et si demandé
    const soundBuffer = (useCustom && customSounds.bounce) ? customSounds.bounce : soundCache['bounce'];
    if (!soundBuffer) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = soundBuffer;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = Math.min(1.0, Math.max(0.1, volume));
    
    source.connect(gainNode);
    
    // Connect to both the audio context destination and recorder if available
    gainNode.connect(audioContext.destination);
    
    // Also connect to recorder destination if available
    if (recorderDestination) {
      gainNode.connect(recorderDestination);
    }
    
    source.start();
  } catch (e) {
    console.error("Error playing bounce sound:", e);
  }
};

// Sound for ball growing
export const playGrowSound = (volume: number = 0.5, useCustom: boolean = false): void => {
  // Ne rien jouer si les sons standards sont désactivés (à moins qu'on utilise un son custom)
  if (!standardSoundsEnabled && !useCustom) return;
  
  if (!audioContext) return;
  
  try {
    // Utiliser le son personnalisé s'il existe et si demandé
    const soundBuffer = (useCustom && customSounds.grow) ? customSounds.grow : soundCache['grow'];
    if (!soundBuffer) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = soundBuffer;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = Math.min(1.0, Math.max(0.1, volume));
    
    source.connect(gainNode);
    
    // Connect to both the audio context destination and recorder if available
    gainNode.connect(audioContext.destination);
    
    // Also connect to recorder destination if available
    if (recorderDestination) {
      gainNode.connect(recorderDestination);
    }
    
    source.start();
  } catch (e) {
    console.error("Error playing grow sound:", e);
  }
};

// Sound for game over
export const playGameOverSound = (useCustom: boolean = false): void => {
  // Ne rien jouer si les sons standards sont désactivés (à moins qu'on utilise un son custom)
  if (!standardSoundsEnabled && !useCustom) return;
  
  if (!audioContext) return;
  
  try {
    // Utiliser le son personnalisé s'il existe et si demandé
    const soundBuffer = (useCustom && customSounds.gameOver) ? customSounds.gameOver : soundCache['gameOver'];
    if (!soundBuffer) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = soundBuffer;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.7; // Volume fixe pour le game over
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Also connect to recorder destination if available
    if (recorderDestination) {
      gainNode.connect(recorderDestination);
    }
    
    source.start();
  } catch (e) {
    console.error("Error playing game over sound:", e);
  }
};

/**
 * Initialise ou récupère l'état musical d'une balle
 * @param ballId ID unique de la balle
 * @param scale Gamme musicale à utiliser (facultatif)
 * @returns État musical de la balle
 */
export const getBallMusicState = (ballId: string, scale?: string[] | HTMLAudioElement[]): BallMusicState => {
  if (!ballMusicStates[ballId]) {
    const isCustomScale = scale !== undefined && typeof scale[0] !== 'string';
    
    // Assigner une échelle aléatoire si non spécifiée
    const scaleToUse = scale || 
      Object.values(MUSIC_SCALES)[Math.floor(Math.random() * Object.keys(MUSIC_SCALES).length)];
    
    ballMusicStates[ballId] = {
      currentIndex: 0,
      noteCount: 0,
      lastPlayTime: 0,
      tempo: 500, // Commencer à 500ms entre les notes
      scale: scaleToUse,
      isCustom: isCustomScale
    };
  } else if (scale) {
    // Mettre à jour l'échelle si spécifiée
    ballMusicStates[ballId].scale = scale;
    ballMusicStates[ballId].isCustom = typeof scale[0] !== 'string';
  }
  
  return ballMusicStates[ballId];
};

/**
 * Définit l'échelle musicale pour une balle
 * @param ballId ID de la balle
 * @param scaleName Nom de l'échelle musicale à utiliser
 */
export const setBallMusicScale = (ballId: string, scaleName: keyof typeof MUSIC_SCALES | CustomMusicKey): void => {
  if (MUSIC_SCALES[scaleName as keyof typeof MUSIC_SCALES]) {
    getBallMusicState(ballId, MUSIC_SCALES[scaleName as keyof typeof MUSIC_SCALES]);
  } else if (CUSTOM_MUSIC[scaleName]) {
    getBallMusicState(ballId, CUSTOM_MUSIC[scaleName]);
  }
};

/**
 * Joue une note pour une balle spécifique
 * @param ballId ID de la balle
 * @param volume Volume entre 0 et 1
 * @param impactVelocity Vitesse d'impact (utilisée pour moduler le tempo)
 */
export const playBallMusicNote = (ballId: string, volume: number, impactVelocity: number): void => {
  // S'assurer que Tone.js est démarré
  if (Tone.Transport.state !== 'started') {
    Tone.start();
  }
  
  // Récupérer l'état musical de la balle
  const state = ballMusicStates[ballId];
  if (!state) return;
  
  // Limiter l'intervalle entre les notes
  const now = Date.now();
  const elapsedSinceLastNote = now - state.lastPlayTime;
  const minimumInterval = Math.max(80, state.tempo - 50); // Intervalle minimum
  
  if (elapsedSinceLastNote < minimumInterval) {
    return;
  }
  
  // Mettre à jour le dernier temps de jeu
  state.lastPlayTime = now;
  
  // Récupérer la note à jouer
  const noteIndex = state.currentIndex;
  
  // Vérifie si nous avons un tableau de notes ou d'éléments audio
  if (state.isCustom && Array.isArray(state.scale) && state.scale[0] instanceof HTMLAudioElement) {
    // Pour les gammes personnalisées (fichiers audio)
    const audioElements = state.scale as HTMLAudioElement[];
    if (noteIndex >= 0 && noteIndex < audioElements.length) {
      // Créer un nouvel élément audio pour éviter les conflits de lecture
      const audioEl = document.createElement('audio');
      audioEl.src = audioElements[noteIndex].src;
      audioEl.volume = 0; // Commence à 0 pour le fondu entrant
      audioEl.className = 'ball-music-note';
      document.body.appendChild(audioEl);
      
      // Appliquer un fondu entrant
      const fadeInDuration = 80; // 80ms de fondu entrant
      const fadeInSteps = 8;
      const targetVolume = Math.min(0.8, Math.max(0.2, volume)); // Volume entre 0.2 et 0.8
      const volumeStep = targetVolume / fadeInSteps;
      
      let step = 0;
      audioEl.play().catch(err => console.error('Error playing note:', err));
      
      const fadeInInterval = setInterval(() => {
        step++;
        audioEl.volume = step * volumeStep;
        
        if (step >= fadeInSteps) {
          clearInterval(fadeInInterval);
          
          // Programmer le fondu sortant
          setTimeout(() => {
            const fadeOutDuration = 300; // 300ms de fondu sortant
            const fadeOutSteps = 10;
            const fadeOutStep = audioEl.volume / fadeOutSteps;
            
            let outStep = 0;
            const fadeOutInterval = setInterval(() => {
              outStep++;
              audioEl.volume = Math.max(0, audioEl.volume - fadeOutStep);
              
              if (outStep >= fadeOutSteps) {
                clearInterval(fadeOutInterval);
                audioEl.pause();
                if (audioEl.parentNode) {
                  audioEl.parentNode.removeChild(audioEl);
                }
              }
            }, fadeOutDuration / fadeOutSteps);
          }, 200); // Durée avant de commencer le fondu sortant
        }
      }, fadeInDuration / fadeInSteps);
    }
  } else {
    // Pour les gammes standard (utilisant Tone.js)
    const notes = state.scale as string[];
    if (noteIndex >= 0 && noteIndex < notes.length) {
      const note = notes[noteIndex];
      if (synth) {
        // Jouer la note avec un fondu d'entrée
        synth.triggerAttackRelease(note, "8n", undefined, Math.min(0.8, Math.max(0.2, volume)));
      }
    }
  }
  
  // Passer à la note suivante
  state.currentIndex = (noteIndex + 1) % state.noteCount;
  
  // Accélérer le tempo en fonction de la vitesse d'impact
  const impactFactor = Math.min(1, Math.max(0.3, impactVelocity / 15));
  state.tempo = Math.max(100, state.tempo - (impactFactor * 10));
};

// Sound for game start
export const playGameStartSound = () => {
  if (Tone.Transport.state !== 'started') {
    Tone.start();
  }
  
  const synthA = new Tone.Synth().connect(reverb);
  
  // Play an ascending pattern
  synthA.triggerAttackRelease('C4', '8n', Tone.now());
  synthA.triggerAttackRelease('E4', '8n', Tone.now() + 0.2);
  synthA.triggerAttackRelease('G4', '4n', Tone.now() + 0.4);
};

// Random pleasing sound
export const playRandomSound = () => {
  if (Tone.Transport.state !== 'started') {
    Tone.start();
  }
  
  const notesArray = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
  const randomNote = notesArray[Math.floor(Math.random() * notesArray.length)];
  synth.triggerAttackRelease(randomNote, '8n');
};

// Initialize Tone.js
export const initSound = (): void => {
  if (!isSoundInitialized) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      initSoundWithContext(audioContext);
    } catch (e) {
      console.error("Web Audio API not supported.", e);
    }
  }
};

// Initialize sound system with a specific context
const initSoundWithContext = (context: AudioContext): void => {
  try {
    // Create master gain node for routing to recorder
    masterGainNode = context.createGain();
    masterGainNode.gain.value = 1.0;
    masterGainNode.connect(context.destination);
    
    isSoundInitialized = true;
    
    // Précharger les sons par défaut
    loadDefaultSounds();
    
    console.log('Sound system initialized with audio context', context);
  } catch (e) {
    console.error("Failed to initialize sound system:", e);
  }
};

// Précharge les sons par défaut
const loadDefaultSounds = async (): Promise<void> => {
  if (!audioContext) return;
  
  try {
    // Son de rebond (fréquence plus haute pour l'effet de rebond)
    const bounceBuffer = await createSimpleTone(audioContext, 1200, 0.1);
    soundCache['bounce'] = bounceBuffer;
    
    // Son de croissance (fréquence plus grave pour l'effet de grossissement)
    const growBuffer = await createSimpleTone(audioContext, 300, 0.2);
    soundCache['grow'] = growBuffer;
    
    // Son de fin de jeu (combinaison de tonalités descendantes)
    const gameOverBuffer = await createGameOverSound(audioContext);
    soundCache['gameOver'] = gameOverBuffer;
  } catch (e) {
    console.error("Error loading default sounds:", e);
  }
};

// Crée un son simple avec une fréquence et durée spécifiées
const createSimpleTone = (
  context: AudioContext, 
  frequency: number, 
  duration: number
): Promise<AudioBuffer> => {
  return new Promise((resolve) => {
    const sampleRate = context.sampleRate;
    const frameCount = sampleRate * duration;
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < frameCount; i++) {
      // Créer une onde sinusoïdale simple
      const t = i / sampleRate;
      // Amplitude qui diminue avec le temps (pour un effet de fondu sortant)
      const fadeOut = 1 - t / duration;
      channelData[i] = Math.sin(2 * Math.PI * frequency * t) * fadeOut * 0.5;
    }
    
    resolve(buffer);
  });
};

// Crée un son de fin de jeu
const createGameOverSound = (context: AudioContext): Promise<AudioBuffer> => {
  return new Promise((resolve) => {
    const sampleRate = context.sampleRate;
    const duration = 1.2; // durée en secondes
    const frameCount = sampleRate * duration;
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      // Fréquence qui diminue avec le temps
      const frequency = 800 - (t / duration) * 600;
      const fadeFactor = t < 0.1 ? t / 0.1 : (t > 0.9 ? (1.0 - (t - 0.9) / 0.1) : 1.0);
      channelData[i] = Math.sin(2 * Math.PI * frequency * t) * fadeFactor * 0.5;
    }
    
    resolve(buffer);
  });
};

// Charge un son personnalisé à partir d'un fichier
export const loadCustomSound = async (file: File, soundType: 'bounce' | 'grow' | 'gameOver'): Promise<void> => {
  if (!audioContext) return;
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Stocker le son personnalisé
    customSounds[soundType] = audioBuffer;
    
    console.log(`Custom ${soundType} sound loaded successfully.`);
  } catch (e) {
    console.error(`Error loading custom ${soundType} sound:`, e);
  }
};

// Vérifie si un son personnalisé est disponible
export const hasCustomSound = (soundType: 'bounce' | 'grow' | 'gameOver'): boolean => {
  return customSounds[soundType] !== null;
};

// Supprime un son personnalisé
export const clearCustomSound = (soundType: 'bounce' | 'grow' | 'gameOver'): void => {
  customSounds[soundType] = null;
};

/**
 * Arrête tous les sons en cours de lecture
 */
export const stopAllSounds = () => {
  if (synth) {
    synth.releaseAll();
  }
  
  // Arrêter la musique de fond
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  }
  
  // Nettoyer les éléments audio des notes musicales
  const musicNotes = document.querySelectorAll('.ball-music-note');
  musicNotes.forEach(audio => {
    if (audio.parentNode) {
      (audio as HTMLAudioElement).pause();
      audio.parentNode.removeChild(audio);
    }
  });
  
  // Nettoyer les segments progressifs
  const progressiveSegments = document.querySelectorAll('.progressive-segment-audio');
  progressiveSegments.forEach(audio => {
    if (audio.parentNode) {
      (audio as HTMLAudioElement).pause();
      audio.parentNode.removeChild(audio);
    }
  });
  
  // Réinitialiser les états de lecture progressive
  isPlayingProgressiveSound = false;
  lastProgressiveSoundPlayTime = 0;
  
  // Annuler tous les timeouts en cours
  if (progressiveSoundTimeout) {
    clearTimeout(progressiveSoundTimeout);
    progressiveSoundTimeout = null;
  }
  
  if (progressiveSoundFadeTimeout) {
    clearTimeout(progressiveSoundFadeTimeout);
    progressiveSoundFadeTimeout = null;
  }
  
  // Arrêter les sons de rebond, de croissance et de game over
  Object.values(customSounds).forEach(sound => {
    if (sound && sound instanceof HTMLAudioElement) {
      sound.pause();
      sound.currentTime = 0;
    }
  });
};

/**
 * Charge une collection de sons pour créer une gamme musicale personnalisée
 * @param files Fichiers audio à charger
 * @param name Nom de la gamme personnalisée
 * @returns Promise qui se résout lorsque tous les sons sont chargés
 */
export const loadCustomMusicScale = async (files: File[], name: string): Promise<void> => {
  if (!files || files.length === 0) return;
  
  const audioElements: HTMLAudioElement[] = [];
  
  // Créer un tableau d'éléments audio pour chaque fichier
  for (const file of files) {
    const audioUrl = URL.createObjectURL(file);
    const audio = new Audio(audioUrl);
    audio.load();
    audioElements.push(audio);
  }
  
  // Stocker la gamme personnalisée
  CUSTOM_MUSIC[name] = audioElements;
  console.log(`Custom music scale "${name}" loaded with ${audioElements.length} notes`);
}

/**
 * Vérifie si une gamme musicale personnalisée existe
 * @param name Nom de la gamme
 * @returns true si la gamme existe
 */
export const hasCustomMusicScale = (name: string): boolean => {
  return !!CUSTOM_MUSIC[name] && CUSTOM_MUSIC[name].length > 0;
}

/**
 * Supprime une gamme musicale personnalisée
 * @param name Nom de la gamme à supprimer
 */
export const clearCustomMusicScale = (name: string): void => {
  if (CUSTOM_MUSIC[name]) {
    // Libérer les URLs créées par URL.createObjectURL
    CUSTOM_MUSIC[name].forEach(audio => {
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
    });
    
    delete CUSTOM_MUSIC[name];
    console.log(`Custom music scale "${name}" removed`);
  }
}

/**
 * Charge une musique de fond
 * @param file Fichier audio à utiliser comme musique de fond
 */
export const loadBackgroundMusic = (file: File): void => {
  // Libérer la ressource si une musique était déjà chargée
  if (backgroundMusic) {
    backgroundMusic.pause();
    if (backgroundMusic.src) {
      URL.revokeObjectURL(backgroundMusic.src);
    }
  }
  
  // Créer un nouvel élément audio avec le fichier
  const audioUrl = URL.createObjectURL(file);
  backgroundMusic = new Audio(audioUrl);
  backgroundMusic.loop = true;
  backgroundMusic.volume = backgroundMusicVolume;
  
  console.log('Background music loaded');
  
  // Si la musique était en cours de lecture, reprendre avec la nouvelle musique
  if (isBackgroundMusicPlaying) {
    playBackgroundMusic();
  }
};

/**
 * Joue la musique de fond
 */
export const playBackgroundMusic = (): void => {
  if (backgroundMusic) {
    backgroundMusic.play().catch(err => console.error('Error playing background music:', err));
    isBackgroundMusicPlaying = true;
  }
};

/**
 * Met en pause la musique de fond
 */
export const pauseBackgroundMusic = (): void => {
  if (backgroundMusic) {
    backgroundMusic.pause();
    isBackgroundMusicPlaying = false;
  }
};

/**
 * Ajuste le volume de la musique de fond
 * @param volume Volume entre 0 et 1
 */
export const setBackgroundMusicVolume = (volume: number): void => {
  backgroundMusicVolume = Math.max(0, Math.min(1, volume));
  if (backgroundMusic) {
    backgroundMusic.volume = backgroundMusicVolume;
  }
};

/**
 * Vérifie si une musique de fond est chargée
 * @returns true si une musique est chargée
 */
export const hasBackgroundMusic = (): boolean => {
  return backgroundMusic !== null;
};

/**
 * Vérifie si la musique de fond est en cours de lecture
 * @returns true si la musique est en cours de lecture
 */
export const isBackgroundMusicActive = (): boolean => {
  return isBackgroundMusicPlaying && backgroundMusic !== null;
};

/**
 * Set the volume for progressive sound playback
 * @param volume Volume level (0-1)
 */
export const setProgressiveSoundVolume = (volume: number): void => {
  // Utiliser la variable globale existante
  progressiveSoundVolume = Math.max(0, Math.min(1, volume));
  
  // Appliquer immédiatement le nouveau volume s'il y a un gain node actif
  if (progressiveGainNode && progressiveAudioContext) {
    // Transition douce vers le nouveau volume
    progressiveGainNode.gain.linearRampToValueAtTime(
      progressiveSoundVolume,
      progressiveAudioContext.currentTime + 0.1
    );
  }
};

/**
 * Get the current progressive sound volume
 * @returns Current volume level (0-1)
 */
export const getProgressiveSoundVolume = (): number => {
  return progressiveSoundVolume;
};

/**
 * Charge un fichier audio pour une lecture progressive
 * @param file Fichier audio à charger
 */
export const loadProgressiveSound = async (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Créer ou récupérer le contexte audio
    if (!progressiveAudioContext) {
      try {
        progressiveAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.error('Impossible de créer un contexte audio:', e);
        reject('Erreur de contexte audio');
        return;
      }
    }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (!event.target || !event.target.result || !progressiveAudioContext) {
        reject('Erreur de lecture du fichier');
        return;
      }
      
      try {
        // Décoder le fichier audio
        const arrayBuffer = event.target.result as ArrayBuffer;
        const audioBuffer = await progressiveAudioContext.decodeAudioData(arrayBuffer);
        
        // Stocker le buffer audio
        progressiveAudioBuffer = audioBuffer;
        
        // Calculer le nombre de segments en fonction de la durée totale
        const totalDuration = audioBuffer.duration;
        // On va calculer un nombre de segments adapté à la durée
        // Au minimum 4 segments, au max 12 segments
        progressiveTotalSegments = Math.max(4, Math.min(Math.floor(totalDuration / progressiveSegmentDuration), 12));
        // Ajuster la durée des segments pour qu'ils soient égaux
        progressiveSegmentDuration = totalDuration / progressiveTotalSegments;
        
        // Réinitialiser le segment courant
        currentProgressiveSegment = 0;
        
        // Créer le gain node pour contrôler le volume
        if (progressiveGainNode) {
          progressiveGainNode.disconnect();
        }
        progressiveGainNode = progressiveAudioContext.createGain();
        progressiveGainNode.gain.value = progressiveSoundVolume;
        progressiveGainNode.connect(progressiveAudioContext.destination);
        
        console.log(`Son progressif chargé: ${progressiveTotalSegments} segments de ${progressiveSegmentDuration.toFixed(2)}s`);
        
        resolve();
      } catch (e) {
        console.error('Erreur de décodage audio:', e);
        reject('Erreur de décodage audio');
      }
    };
    
    reader.onerror = (event) => {
      reject('Erreur de lecture du fichier');
    };
    
    reader.readAsArrayBuffer(file);
  });
};

// Fonction améliorée pour jouer le prochain segment avec des transitions fluides
export const playNextProgressiveSoundPart = (volume = 0.7): void => {
  if (!progressiveAudioBuffer || !progressiveAudioContext || !progressiveGainNode) {
    console.log('Aucun son progressif chargé');
    return;
  }
  
  // Limiter la fréquence de lecture pour éviter les déclenchements trop rapprochés
  const now = Date.now();
  const minTimeBetweenPlays = 150; // Temps minimum entre deux segments (ms)
  if (now - lastProgressivePlayTime < minTimeBetweenPlays) {
    return;
  }
  lastProgressivePlayTime = now;
  
  // S'assurer que le contexte audio est dans l'état "running"
  if (progressiveAudioContext.state === 'suspended') {
    progressiveAudioContext.resume();
  }
  
  // Arrêter la source précédente si elle existe
  if (progressiveAudioSource) {
    // Au lieu d'arrêter brusquement, on applique un fade out
    const stopTime = progressiveAudioContext.currentTime + progressiveFadeOutTime;
    if (progressiveAudioSource.stop) {
      try {
        // Fade out progressif
        if (progressiveGainNode) {
          progressiveGainNode.gain.setValueAtTime(progressiveGainNode.gain.value, progressiveAudioContext.currentTime);
          progressiveGainNode.gain.linearRampToValueAtTime(0, stopTime);
        }
        // Arrêter la lecture après le fade out
        progressiveAudioSource.stop(stopTime);
      } catch (e) {
        // Ignorer les erreurs (la source peut déjà être arrêtée)
      }
    }
  }
  
  // Créer une nouvelle source
  progressiveAudioSource = progressiveAudioContext.createBufferSource();
  progressiveAudioSource.buffer = progressiveAudioBuffer;
  
  // Calculer la durée de lecture
  const startOffset = currentProgressiveSegment * progressiveSegmentDuration;
  let endOffset = startOffset + progressiveSegmentDuration;
  
  // Ajouter un chevauchement (overlap) pour des transitions plus fluides
  const overlapTime = progressiveSegmentDuration * progressiveOverlapFactor;
  if (startOffset > overlapTime) {
    // Commencer un peu avant pour une transition plus fluide
    const actualStartOffset = startOffset - overlapTime;
    progressiveAudioSource.start(0, actualStartOffset, endOffset - actualStartOffset);
  } else {
    progressiveAudioSource.start(0, startOffset, progressiveSegmentDuration);
  }
  
  // Réinitialiser et configurer le nœud de gain
  progressiveGainNode.gain.cancelScheduledValues(progressiveAudioContext.currentTime);
  
  // Appliquer un fade in
  progressiveGainNode.gain.setValueAtTime(0, progressiveAudioContext.currentTime);
  progressiveGainNode.gain.linearRampToValueAtTime(
    progressiveSoundVolume * volume,
    progressiveAudioContext.currentTime + progressiveFadeInTime
  );
  
  // Connecter la source au gain
  progressiveAudioSource.connect(progressiveGainNode);
  
  // Passer au segment suivant avec rotation
  currentProgressiveSegment = (currentProgressiveSegment + 1) % progressiveTotalSegments;
  
  // Définir un événement onended pour nettoyer
  progressiveAudioSource.onended = () => {
    if (progressiveAudioSource) {
      progressiveAudioSource.disconnect();
      progressiveAudioSource = null;
    }
  };
};

// Vérifier si un son progressif est chargé
export const hasProgressiveSound = (): boolean => {
  return progressiveAudioBuffer !== null;
};

// Nettoyer le son progressif
export const clearProgressiveSound = (): void => {
  if (progressiveAudioSource) {
    try {
      progressiveAudioSource.stop();
    } catch (e) {
      // Ignorer les erreurs
    }
    progressiveAudioSource.disconnect();
    progressiveAudioSource = null;
  }
  
  if (progressiveGainNode) {
    progressiveGainNode.disconnect();
    progressiveGainNode = null;
  }
  
  progressiveAudioBuffer = null;
  currentProgressiveSegment = 0;
  progressiveTotalSegments = 0;
};

// Fonction pour définir le facteur de chevauchement
export const setProgressiveOverlap = (factor: number): void => {
  progressiveOverlapFactor = Math.max(0, Math.min(0.5, factor));
};

// Fonction pour définir les durées de fade
export const setProgressiveFades = (fadeIn: number, fadeOut: number): void => {
  progressiveFadeInTime = Math.max(0.01, Math.min(0.2, fadeIn));
  progressiveFadeOutTime = Math.max(0.01, Math.min(0.5, fadeOut));
};

/**
 * Convertit un AudioBuffer en blob WAV
 */
const bufferToWave = (abuffer: AudioBuffer, offset: number, len: number): Promise<Blob> => {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  
  // Écrire les en-têtes WAVE
  writeString(view, 0, 'RIFF');
  view.setUint32(4, length - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, abuffer.sampleRate, true);
  view.setUint32(28, abuffer.sampleRate * 2 * numOfChan, true);
  view.setUint16(32, numOfChan * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length - 44, true);
  
  // Écrire les données audio
  for (let i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }
  
  let idx = 44;
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < numOfChan; j++) {
      const value = Math.max(-1, Math.min(1, channels[j][i]));
      view.setInt16(idx, value < 0 ? value * 0x8000 : value * 0x7FFF, true);
      idx += 2;
    }
  }
  
  return Promise.resolve(new Blob([buffer], { type: 'audio/wav' }));
};

/**
 * Écrit une chaîne dans un DataView
 */
const writeString = (view: DataView, offset: number, string: string): void => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

/**
 * Analyse un fichier audio pour extraire les fréquences dominantes et créer une gamme musicale
 * Le fichier entier est divisé en segments pour une analyse complète.
 * @param file Fichier audio à analyser
 * @param numNotes Nombre de notes à extraire (entre 5 et 12)
 * @returns Promise qui se résout avec un tableau de notes
 */
export const convertAudioToMusicScale = async (file: File, numNotes: number = 8): Promise<string[]> => {
  if (!audioContext) {
    initSound();
    if (!audioContext) return ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']; // Gamme par défaut
  }
  
  try {
    // Limiter le nombre de notes entre 5 et 12
    numNotes = Math.min(12, Math.max(5, numNotes));
    
    // Charger le fichier audio
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Créer un OfflineAudioContext pour l'analyse
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    // Nombre de segments à analyser (diviser le fichier en parties)
    const numSegments = 10;
    const segmentLength = Math.floor(audioBuffer.length / numSegments);
    
    // Stocker toutes les fréquences détectées de tous les segments
    const allDetectedFrequencies: {frequency: number, amplitude: number}[] = [];
    
    // Analyser chaque segment du fichier
    for (let segmentIndex = 0; segmentIndex < numSegments; segmentIndex++) {
      // Créer un segment temporaire du buffer
      const tempBuffer = offlineContext.createBuffer(
        audioBuffer.numberOfChannels,
        segmentLength,
        audioBuffer.sampleRate
      );
      
      // Copier une partie des données du buffer original dans le buffer temporaire
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const tempData = tempBuffer.getChannelData(channel);
        
        const startIdx = segmentIndex * segmentLength;
        for (let i = 0; i < segmentLength && (startIdx + i) < originalData.length; i++) {
          tempData[i] = originalData[startIdx + i];
        }
      }
      
      // Créer une source avec ce segment
      const source = offlineContext.createBufferSource();
      source.buffer = tempBuffer;
      
      // Créer un analyseur
      const analyser = offlineContext.createAnalyser();
      analyser.fftSize = 4096; // Valeur plus élevée pour une meilleure résolution de fréquence
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Connecter la source à l'analyseur puis à la destination
      source.connect(analyser);
      analyser.connect(offlineContext.destination);
      
      // Commencer la lecture
      source.start(0);
      
      // Rendre l'audio pour ce segment
      await offlineContext.startRendering();
      
      // Extraire les données de fréquence
      analyser.getByteFrequencyData(dataArray);
      
      // Trouver les pics de fréquence pour ce segment
      for (let i = 2; i < bufferLength - 2; i++) {
        const value = dataArray[i];
        
        // Un pic est un point où la valeur est supérieure aux points adjacents
        if (value > 15 && // Seuil plus élevé pour réduire le bruit
            value > dataArray[i-2] && 
            value > dataArray[i-1] && 
            value > dataArray[i+1] && 
            value > dataArray[i+2]) {
          
          // Convertir l'indice en fréquence
          const frequency = i * (audioContext?.sampleRate || 44100) / analyser.fftSize;
          
          // Filtrer pour ne garder que des fréquences musicales utiles (20Hz-5000Hz)
          if (frequency >= 20 && frequency <= 5000) {
            allDetectedFrequencies.push({
              frequency,
              amplitude: value
            });
          }
        }
      }
    }
    
    // Agréger les fréquences similaires en les regroupant
    const frequencyGroups: {frequency: number, amplitude: number, count: number}[] = [];
    
    for (const freqData of allDetectedFrequencies) {
      // Vérifier si une fréquence similaire existe déjà dans les groupes
      let foundGroup = false;
      
      for (const group of frequencyGroups) {
        // Si la fréquence est à moins de 3% d'une fréquence existante, les regrouper
        if (Math.abs(group.frequency / freqData.frequency - 1) < 0.03) {
          // Calculer une moyenne pondérée pour la fréquence
          const totalAmp = group.amplitude * group.count + freqData.amplitude;
          const newCount = group.count + 1;
          group.frequency = (group.frequency * group.count + freqData.frequency) / newCount;
          group.amplitude = totalAmp / newCount;
          group.count++;
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        frequencyGroups.push({
          frequency: freqData.frequency,
          amplitude: freqData.amplitude,
          count: 1
        });
      }
    }
    
    // Sélectionner les groupes ayant le plus d'occurrences et la plus forte amplitude
    frequencyGroups.sort((a, b) => {
      // Combiner le nombre d'occurrences et l'amplitude pour le tri
      return (b.count * b.amplitude) - (a.count * a.amplitude);
    });
    
    // Prendre les N fréquences les plus significatives
    const topFrequencies = frequencyGroups.slice(0, numNotes);
    
    // Trier les fréquences par ordre croissant
    topFrequencies.sort((a, b) => a.frequency - b.frequency);
    
    // Convertir les fréquences en noms de notes
    const notes = topFrequencies.map(freq => frequencyToNoteName(freq.frequency));
    
    // Éliminer les notes en double
    const uniqueNotes = notes.filter((note, index) => {
      return notes.indexOf(note) === index;
    });
    
    // Si nous n'avons pas assez de notes, ajouter des octaves supplémentaires
    while (uniqueNotes.length < numNotes) {
      const lastNote = uniqueNotes[uniqueNotes.length - 1];
      const noteName = lastNote.substring(0, lastNote.length - 1);
      const octave = parseInt(lastNote.charAt(lastNote.length - 1)) + 1;
      if (octave <= 8) { // Limiter à l'octave 8
        uniqueNotes.push(noteName + octave);
      } else {
        break;
      }
    }
    
    console.log('Audio converted to music scale:', uniqueNotes);
    return uniqueNotes.slice(0, numNotes);
    
  } catch (err) {
    console.error('Error converting audio to music scale:', err);
    return ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']; // Gamme par défaut en cas d'erreur
  }
};

/**
 * Convertit une fréquence en nom de note (par ex. "A4", "C#5")
 * @param frequency Fréquence en Hz
 * @returns Nom de la note
 */
const frequencyToNoteName = (frequency: number): string => {
  // Définit A4 à 440 Hz
  const A4 = 440;
  
  // Calcule le nombre de demi-tons par rapport à A4
  const semitonesFromA4 = Math.round(12 * Math.log2(frequency / A4));
  
  // Convertit en nom de note
  const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
  const octaveOffset = Math.floor((semitonesFromA4 + 9) / 12);
  const octave = 4 + octaveOffset;
  const noteIndex = ((semitonesFromA4 % 12) + 12) % 12;
  
  return noteNames[noteIndex] + octave;
};

/**
 * Charge et analyse un fichier audio pour extraire une séquence de notes musicales
 * @param file Fichier audio à analyser
 * @param numNotes Nombre de notes à extraire (entre 5 et 30)
 */
export const loadMusicSequence = async (file: File, numNotes: number = 16): Promise<void> => {
  try {
    // Extraire les notes du fichier audio
    extractedNotes = await convertAudioToMusicScale(file, Math.min(30, Math.max(5, numNotes)));
    currentNoteIndex = 0;
    isUsingExtractedNotes = true;
    
    console.log(`Séquence musicale chargée avec ${extractedNotes.length} notes: ${extractedNotes.join(', ')}`);
  } catch (err) {
    console.error('Erreur lors du chargement de la séquence musicale:', err);
    // En cas d'erreur, utiliser une gamme par défaut
    extractedNotes = MUSIC_SCALES.majorScale;
    currentNoteIndex = 0;
    isUsingExtractedNotes = true;
  }
};

/**
 * Joue la note suivante de la séquence musicale extraite
 * @param volume Volume du son (0-1)
 */
export const playNextExtractedNote = (volume: number = 0.7): void => {
  if (!isUsingExtractedNotes || extractedNotes.length === 0) return;
  
  // S'assurer que Tone.js est démarré
  if (Tone.Transport.state !== 'started') {
    Tone.start();
  }
  
  // Jouer la note actuelle
  const note = extractedNotes[currentNoteIndex];
  if (synth) {
    synth.triggerAttackRelease(note, "8n", undefined, Math.min(0.8, Math.max(0.2, volume)));
  }
  
  // Passer à la note suivante
  currentNoteIndex = (currentNoteIndex + 1) % extractedNotes.length;
};

/**
 * Vérifie si une séquence musicale extraite est chargée
 */
export const hasExtractedNotes = (): boolean => {
  return isUsingExtractedNotes && extractedNotes.length > 0;
};

/**
 * Désactive l'utilisation de la séquence musicale extraite
 */
export const disableExtractedNotes = (): void => {
  isUsingExtractedNotes = false;
};

/**
 * Active l'utilisation de la séquence musicale extraite
 */
export const enableExtractedNotes = (): void => {
  if (extractedNotes.length > 0) {
    isUsingExtractedNotes = true;
  }
};

/**
 * Réinitialise la séquence musicale extraite
 */
export const resetExtractedNotes = (): void => {
  currentNoteIndex = 0;
};

/**
 * Convertit un fichier audio en séquence MIDI
 * @param file Le fichier audio à convertir
 * @param noteCount Le nombre de notes à extraire
 */
export const convertAudioToMIDI = async (file: File, noteCount: number = 24): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Décoder le fichier audio
      const audioBuffer = await decodeAudioFile(file);
      
      // Extraire les fréquences dominantes
      const frequencies = await analyzeAudioFrequencies(audioBuffer);
      
      // Convertir les fréquences en notes MIDI (entre 21 et 108, gamme standard du piano)
      const midiNotes = frequencies
        .map(freq => frequencyToMidi(freq))
        .filter(note => note >= 21 && note <= 108)
        .slice(0, noteCount);
      
      // Stocker la séquence MIDI
      midiSequence = midiNotes;
      currentMidiIndex = 0;
      
      console.log(`Séquence MIDI créée avec ${midiNotes.length} notes`);
      resolve();
    } catch (error) {
      console.error('Erreur lors de la conversion MIDI:', error);
      reject(error);
    }
  });
};

/**
 * Décode un fichier audio en AudioBuffer
 * @param file Le fichier audio à décoder
 * @returns Une promesse contenant l'AudioBuffer décodé
 */
const decodeAudioFile = async (file: File): Promise<AudioBuffer> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    
    fileReader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const audioContext = getAudioContext();
        
        if (!audioContext) {
          throw new Error('AudioContext not available');
        }
        
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        resolve(audioBuffer);
      } catch (error) {
        reject(error);
      }
    };
    
    fileReader.onerror = () => {
      reject(new Error('Failed to read audio file'));
    };
    
    fileReader.readAsArrayBuffer(file);
  });
};

/**
 * Analyse les fréquences dominantes d'un AudioBuffer
 * @param audioBuffer Le buffer audio à analyser
 * @returns Les fréquences dominantes trouvées dans le fichier audio
 */
const analyzeAudioFrequencies = async (audioBuffer: AudioBuffer): Promise<number[]> => {
  // Obtenir les données du canal gauche (ou mono si un seul canal)
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  
  // Diviser l'audio en segments pour l'analyse
  const segmentSize = Math.floor(channelData.length / 24); // 24 segments par défaut
  const frequencies: number[] = [];
  
  // Utiliser un AudioContext temporaire pour l'analyse
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const analyzer = audioContext.createAnalyser();
  analyzer.fftSize = 2048;
  
  // Pour chaque segment, trouver la fréquence dominante
  for (let i = 0; i < 24; i++) {
    const startIndex = i * segmentSize;
    const endIndex = Math.min(startIndex + segmentSize, channelData.length);
    
    if (endIndex - startIndex < 1024) continue; // Segment trop petit
    
    // Créer un buffer temporaire pour ce segment
    const segmentBuffer = audioContext.createBuffer(1, endIndex - startIndex, sampleRate);
    const segmentData = segmentBuffer.getChannelData(0);
    
    // Copier les données du segment
    for (let j = 0; j < endIndex - startIndex; j++) {
      segmentData[j] = channelData[startIndex + j];
    }
    
    // Trouver la fréquence dominante dans ce segment
    const dominantFrequency = findDominantFrequency(segmentData, sampleRate);
    
    if (dominantFrequency > 0) {
      frequencies.push(dominantFrequency);
    }
  }
  
  // Fermer le contexte audio temporaire
  await audioContext.close();
  
  return frequencies;
};

/**
 * Trouve la fréquence dominante dans un tableau de données audio
 * @param audioData Les données audio à analyser
 * @param sampleRate Le taux d'échantillonnage de l'audio
 * @returns La fréquence dominante en Hz
 */
const findDominantFrequency = (audioData: Float32Array, sampleRate: number): number => {
  // Utiliser une FFT (Fast Fourier Transform) pour convertir les données temporelles en données fréquentielles
  const bufferSize = 2048;
  const buffer = new Float32Array(bufferSize);
  
  // Copier les données du segment au centre (pour éviter les bords)
  const start = Math.max(0, Math.floor((audioData.length - bufferSize) / 2));
  for (let i = 0; i < bufferSize; i++) {
    if (start + i < audioData.length) {
      buffer[i] = audioData[start + i];
    } else {
      buffer[i] = 0;
    }
  }
  
  // Appliquer une fenêtre de Hanning pour réduire les fuites spectrales
  for (let i = 0; i < bufferSize; i++) {
    buffer[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (bufferSize - 1)));
  }
  
  // Calculer la FFT (version simplifiée)
  const real = new Float32Array(bufferSize);
  const imag = new Float32Array(bufferSize);
  
  for (let i = 0; i < bufferSize; i++) {
    real[i] = buffer[i];
    imag[i] = 0;
  }
  
  // Simuler une FFT en calculant des magnitudes simples
  // (Dans une vraie application, utilisez une bibliothèque FFT complète)
  const magnitudes = new Float32Array(bufferSize / 2);
  
  for (let i = 0; i < bufferSize / 2; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  
  // Trouver l'indice de la magnitude maximale
  let maxIndex = 0;
  let maxMagnitude = 0;
  
  for (let i = 1; i < magnitudes.length; i++) {
    if (magnitudes[i] > maxMagnitude) {
      maxMagnitude = magnitudes[i];
      maxIndex = i;
    }
  }
  
  // Convertir l'indice en fréquence
  const frequency = maxIndex * sampleRate / bufferSize;
  
  return frequency;
};

/**
 * Convertit une fréquence en note MIDI
 * @param frequency La fréquence en Hz
 * @returns Le numéro de note MIDI le plus proche
 */
const frequencyToMidi = (frequency: number): number => {
  // La formule pour convertir une fréquence en note MIDI:
  // MIDI = 69 + 12 * log2(f / 440)
  // 69 est la note A4 (440 Hz)
  if (frequency <= 0) return 60; // C4 par défaut
  
  const midiNote = Math.round(69 + 12 * Math.log2(frequency / 440));
  
  // Limiter dans la plage MIDI standard (21-108)
  return Math.min(108, Math.max(21, midiNote));
};

/**
 * Joue la prochaine note MIDI de la séquence
 * @param volume Le volume de la note (0-1)
 */
export const playMIDINote = (volume: number = 0.7): void => {
  if (!midiSequence.length) return;
  
  const note = midiSequence[currentMidiIndex];
  
  // Utiliser Tone.js pour jouer la note MIDI
  try {
    const synth = new Tone.Synth().toDestination();
    const adjustedVolume = Math.min(1, Math.max(0, volume * midiVolume));
    
    synth.volume.value = Tone.gainToDb(adjustedVolume);
    
    // Convertir le numéro MIDI en nom de note pour Tone.js
    const noteName = midiToNoteName(note);
    
    console.log(`Playing MIDI note: ${note} (${noteName}) with volume ${adjustedVolume}`);
    
    // Jouer la note (durée de 0.3 secondes)
    synth.triggerAttackRelease(noteName, 0.3);
    
    // Passer à la note suivante (en boucle)
    currentMidiIndex = (currentMidiIndex + 1) % midiSequence.length;
  } catch (error) {
    console.error('Erreur lors de la lecture de la note MIDI:', error);
  }
};

/**
 * Convertit un numéro MIDI en nom de note (format Tone.js)
 * @param midi Le numéro MIDI
 * @returns Le nom de la note (ex: "C4")
 */
const midiToNoteName = (midi: number): string => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = noteNames[midi % 12];
  return `${note}${octave}`;
};

/**
 * Vérifie si une séquence MIDI est chargée
 * @returns true si une séquence MIDI est disponible
 */
export const hasMIDISequence = (): boolean => {
  return midiSequence.length > 0;
};

/**
 * Nettoie la séquence MIDI actuelle
 */
export const clearMIDISequence = (): void => {
  midiSequence = [];
  currentMidiIndex = 0;
};

/**
 * Définit le volume pour les notes MIDI
 * @param volume Le niveau de volume (0-1)
 */
export const setMIDIVolume = (volume: number): void => {
  midiVolume = Math.min(1, Math.max(0, volume));
};

/**
 * Obtient le volume actuel des notes MIDI
 * @returns Le niveau de volume (0-1)
 */
export const getMIDIVolume = (): number => {
  return midiVolume;
};

/**
 * Charge un fichier MIDI directement (.mid)
 * @param file Le fichier MIDI à charger
 */
export const loadMIDIFile = async (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Vérifier que c'est bien un fichier MIDI
      if (!file.name.toLowerCase().endsWith('.mid') && !file.name.toLowerCase().endsWith('.midi')) {
        throw new Error('Le fichier doit être au format MIDI (.mid ou .midi)');
      }

      // Utiliser FileReader pour lire le fichier
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          // Convertir les données en format ArrayBuffer
          const arrayBuffer = event.target?.result;
          
          if (!arrayBuffer) {
            throw new Error('Échec de lecture du fichier MIDI');
          }
          
          // Utiliser MidiParser pour analyser les données MIDI
          // @ts-ignore - MidiParser n'a pas de types TypeScript complets
          const midiData = MidiParser.parse(arrayBuffer);
          
          // Stocker les données MIDI brutes
          rawMidiData = midiData;
          
          // Extraire les notes MIDI
          midiNotes = extractMIDINotes(midiData);
          
          if (midiNotes.length === 0) {
            throw new Error('Aucune note MIDI n\'a été trouvée dans le fichier');
          }
          
          // Stocker les notes dans la séquence pour playback
          midiSequence = [...midiNotes];
          currentMidiIndex = 0;
          
          console.log(`Fichier MIDI chargé avec succès: ${midiNotes.length} notes`);
          resolve();
        } catch (error) {
          console.error('Erreur lors du traitement du fichier MIDI:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Échec de lecture du fichier MIDI'));
      };
      
      // Lire le fichier comme ArrayBuffer
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Erreur lors du chargement du fichier MIDI:', error);
      reject(error);
    }
  });
};

/**
 * Extrait les notes MIDI d'un fichier MIDI parsé
 * @param midiData Les données MIDI parsées
 * @returns Un tableau de notes MIDI
 */
const extractMIDINotes = (midiData: any): number[] => {
  const notes: number[] = [];
  
  try {
    // Vérifier la structure des données MIDI
    if (!midiData || !midiData.track || midiData.track.length === 0) {
      throw new Error('Format MIDI invalide');
    }
    
    // Parcourir les pistes MIDI
    for (const track of midiData.track) {
      if (!track.event || !Array.isArray(track.event)) continue;
      
      // Parcourir les événements de la piste
      for (const event of track.event) {
        // Rechercher les événements de type "noteOn" (0x90)
        if (event.type === 9 && event.data && event.data.length >= 2) {
          const noteNumber = event.data[0];
          const velocity = event.data[1];
          
          // Ne considérer que les notes avec une vélocité > 0
          if (velocity > 0) {
            notes.push(noteNumber);
          }
        }
      }
    }
    
    // Si nous avons trop de notes, en prendre un échantillon représentatif
    if (notes.length > 100) {
      const sampledNotes: number[] = [];
      const step = Math.floor(notes.length / 100);
      
      for (let i = 0; i < 100; i++) {
        sampledNotes.push(notes[i * step]);
      }
      
      return sampledNotes;
    }
    
    return notes;
  } catch (error) {
    console.error('Erreur lors de l\'extraction des notes MIDI:', error);
    return [];
  }
}; 
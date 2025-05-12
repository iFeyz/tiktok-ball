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
let customSounds: { bounce: AudioBuffer | null, grow: AudioBuffer | null, gameOver: AudioBuffer | null, wall: AudioBuffer | null } = {
  bounce: null,
  grow: null,
  gameOver: null,
  wall: null
};

// Point d'envoi pour l'enregistrement audio
let masterGainNode: GainNode | null = null;
let recorderDestination: MediaStreamAudioDestinationNode | null = null;
let connectedNodes: Set<AudioNode> = new Set(); // Track connected nodes to avoid duplicates

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
let midiNotes: { note: number, track: number, timing: number }[] = []; // Notes MIDI avec timing et information de piste
let midiCurrentIndex = 0; // Index de la note MIDI actuelle à jouer
let midiVolume = 0.7; // Volume MIDI
let midiFileLoaded = false; // Indique si un fichier MIDI a été chargé
let midiTonality = "C"; // Tonalité par défaut (C)
let midiTranspose = 0; // Valeur de transposition (en demi-tons)

// Définition des types et constantes pour les presets d'instrument AVANT leur utilisation
export const MIDI_INSTRUMENT_PRESETS = {
  MELODIC_MAIN: 'melodic_main', // PolySynth (case 0)
  PAD_STRINGS: 'pad_strings',   // Sine Synth (case 1)
  PERCUSSIVE: 'percussive',     // Triangle Synth (case 2)
  METAL_SYNTH: 'metal_synth',   // MetalSynth (case 3)
  FM_SYNTH: 'fm_synth',         // FMSynth (case 4)
  DEFAULT_CYCLING: 'default_cycling' // Comportement original (track % 5)
} as const;

export type MIDIInstrumentPresetKey = typeof MIDI_INSTRUMENT_PRESETS[keyof typeof MIDI_INSTRUMENT_PRESETS];

let midiSelectedInstrumentPreset: MIDIInstrumentPresetKey = MIDI_INSTRUMENT_PRESETS.DEFAULT_CYCLING; // Instrument sélectionné
let midiSelectedTrackIndex: number | null = null; // Piste MIDI sélectionnée (null pour toutes les pistes principales)

// Add these variables at the top of the file with other declarations
let backgroundMusicOscillator: OscillatorNode | null = null;
let backgroundMusicGainNode: GainNode | null = null;
let backgroundMusicPlaying = false;

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
  
  // Store the destination
  recorderDestination = destination;
  
  // Connect master gain node to recorder if available
  if (masterGainNode && recorderDestination) {
    try {
      // Check if already connected to avoid duplicate connections
      if (!connectedNodes.has(masterGainNode)) {
        masterGainNode.connect(recorderDestination);
        connectedNodes.add(masterGainNode);
        console.log('Master gain node connected to recorder destination');
      } else {
        console.log('Master gain node already connected to recorder');
      }
    } catch (err) {
      console.error('Failed to connect to recorder:', err);
    }
  }
  
  // Also connect progressive sound nodes if they exist
  if (progressiveGainNode && recorderDestination) {
    try {
      if (!connectedNodes.has(progressiveGainNode)) {
        progressiveGainNode.connect(recorderDestination);
        connectedNodes.add(progressiveGainNode);
        console.log('Progressive gain node connected to recorder destination');
      }
    } catch (err) {
      console.error('Failed to connect progressive sound to recorder:', err);
    }
  }
  
  console.log('Audio fully connected to recorder destination');
};

// Helper function to ensure audio nodes are connected to recorder
const connectNodeToRecorder = (node: AudioNode): void => {
  if (recorderDestination && !connectedNodes.has(node)) {
    try {
      node.connect(recorderDestination);
      connectedNodes.add(node);
    } catch (err) {
      console.error('Failed to connect node to recorder:', err);
    }
  }
};

// Sound for ball bounce
export const playBounceSound = (
  volume: number = 0.3, 
  useCustom: boolean = false, 
  soundType: CustomSoundType = 'bounce'
): void => {
  // Ne rien jouer si les sons standards sont désactivés (à moins qu'on utilise un son custom)
  if (!standardSoundsEnabled && !useCustom) return;
  
  if (!audioContext) {
    console.warn('Cannot play sound: audio context not initialized');
    return;
  }
  
  // Resume audio context if it's suspended (browser policy)
  if (audioContext.state === 'suspended') {
    console.log('Resuming audio context for sound playback');
    audioContext.resume().catch(err => {
      console.error('Failed to resume audio context:', err);
    });
  }
  
  try {
    console.log(`Playing ${soundType} sound with volume ${volume}, useCustom=${useCustom}`);
    
    // Utiliser le son personnalisé s'il existe et si demandé
    const soundBuffer = (useCustom && customSounds[soundType]) ? customSounds[soundType] : soundCache['bounce'];
    
    // Vérifier si le tampon sonore existe
    if (!soundBuffer) {
      console.warn(`No sound buffer available for ${soundType}`);
      return;
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = soundBuffer;
    
    const gainNode = audioContext.createGain();
    // Réduire encore davantage le volume en le divisant par 2
    gainNode.gain.value = Math.min(0.5, Math.max(0.05, volume / 2));
    
    source.connect(gainNode);
    
    // Connect to the master gain node for consistent volume control
    if (masterGainNode) {
      gainNode.connect(masterGainNode);
    } else {
      // Fallback: connect directly to destination
      gainNode.connect(audioContext.destination);
    }
    
    // Also connect directly to recorder destination for reliable recording
    if (recorderDestination) {
      gainNode.connect(recorderDestination);
    }
    
    source.start();
  } catch (e) {
    console.error(`Error playing ${soundType} sound:`, e);
  }
};

// Sound for ball growing
export const playGrowSound = (volume: number = 0.5, useCustom: boolean = false): void => {
  console.log(`[DEBUG GROW SOUND] playGrowSound called with volume=${volume}, useCustom=${useCustom}, soundEnabled=${standardSoundsEnabled}`);
  
  // Ne rien jouer si les sons standards sont désactivés (à moins qu'on utilise un son custom)
  if (!standardSoundsEnabled && !useCustom) {
    console.log('[DEBUG GROW SOUND] Standard sounds disabled and not using custom, returning');
    return;
  }
  
  if (!audioContext) {
    console.log('[DEBUG GROW SOUND] No audio context available, returning');
    return;
  }
  
  try {
    // Utiliser le son personnalisé s'il existe et si demandé
    const hasCustomGrowSound = useCustom && customSounds.grow !== null;
    console.log(`[DEBUG GROW SOUND] hasCustomGrowSound: ${hasCustomGrowSound}, customSounds.grow exists: ${!!customSounds.grow}`);
    
    const soundBuffer = hasCustomGrowSound ? customSounds.grow : soundCache['grow'];
    if (!soundBuffer) {
      console.warn('[DEBUG GROW SOUND] No sound buffer available, returning');
      return;
    }
    
    console.log(`[DEBUG GROW SOUND] Using ${hasCustomGrowSound ? 'custom' : 'default'} grow sound`);
    const source = audioContext.createBufferSource();
    source.buffer = soundBuffer;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = Math.min(1.0, Math.max(0.1, volume));
    console.log(`[DEBUG GROW SOUND] Set gain to ${gainNode.gain.value.toFixed(2)}`);
    
    source.connect(gainNode);
    
    // Connect to both the audio context destination and recorder if available
    gainNode.connect(audioContext.destination);
    
    // Also connect to recorder destination if available
    if (recorderDestination) {
      gainNode.connect(recorderDestination);
      console.log('[DEBUG GROW SOUND] Connected to recorder destination');
    }
    
    source.start();
    console.log('[DEBUG GROW SOUND] Sound playback started successfully');
  } catch (e) {
    console.error("[DEBUG GROW SOUND] Error playing grow sound:", e);
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
  if (isSoundInitialized) {
    console.log('Sound system already initialized');
    return;
  }
  
  try {
    console.log('Initializing audio context for sound system');
    // Use AudioContext with fallback for older browsers
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioContextClass();
    
    // Initialize the system with the new context
    initSoundWithContext(audioContext);
  } catch (e) {
    console.error('Failed to initialize audio context:', e);
  }
};

/**
 * Initialize sound system with an existing audio context
 */
const initSoundWithContext = (context: AudioContext): void => {
  if (isSoundInitialized) {
    console.log('Sound system already initialized');
    return;
  }
  
  try {
    // Set up master gain node to control all audio
    masterGainNode = context.createGain();
    masterGainNode.gain.value = 1.0; // Full volume initially
    masterGainNode.connect(context.destination);
    
    // Load default sounds
    loadDefaultSounds().then(() => {
      console.log('Default sounds loaded successfully');
    }).catch(err => {
      console.error('Failed to load default sounds:', err);
    });
    
    isSoundInitialized = true;
    console.log('Sound system initialized successfully');
  } catch (e) {
    console.error('Failed to initialize sound system:', e);
  }
};

// Précharge les sons par défaut
const loadDefaultSounds = async (): Promise<void> => {
  if (!audioContext) return;
  
  try {
    // Son de rebond (fréquence plus basse pour un son moins intrusif)
    const bounceBuffer = await createSimpleTone(audioContext, 800, 0.08);
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
      // Créer une onde sinusoïdale simple avec montée et descente plus progressive
      const t = i / sampleRate;
      // Amplitude qui diminue plus rapidement (exponentielle au lieu de linéaire)
      const fadeIn = Math.min(1, t * 20); // Montée rapide pour éviter les clics
      const fadeOut = Math.exp(-3 * t / duration); // Descente exponentielle plus douce
      // Utiliser une fréquence plus basse pour un son moins aigu
      channelData[i] = Math.sin(2 * Math.PI * (frequency * 0.7) * t) * fadeIn * fadeOut * 0.3;
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

// Type de son personnalisé
export type CustomSoundType = 'bounce' | 'grow' | 'gameOver' | 'wall';

// Load a custom sound from a file
export const loadCustomSound = async (file: File, soundType: CustomSoundType): Promise<void> => {
  console.log(`[DEBUG SOUND LOADING] Starting to load custom ${soundType} sound from file: ${file.name}, size: ${file.size} bytes`);
  
  if (!audioContext) {
    console.error(`[DEBUG SOUND LOADING] No audio context available for loading ${soundType} sound`);
    try {
      // Try initializing the audio context if it doesn't exist
      console.log('[DEBUG SOUND LOADING] Attempting to initialize audio context');
      initSound();
      if (!audioContext) {
        console.error('[DEBUG SOUND LOADING] Failed to initialize audio context');
        return;
      }
    } catch (error) {
      console.error('[DEBUG SOUND LOADING] Error initializing audio context:', error);
      return;
    }
  }
  
  try {
    // First clear any existing custom sound of this type
    if (customSounds[soundType]) {
      console.log(`[DEBUG SOUND LOADING] Clearing existing ${soundType} sound before loading new one`);
      customSounds[soundType] = null;
    }
    
    console.log(`[DEBUG SOUND LOADING] Processing file for ${soundType} sound`);
    const arrayBuffer = await file.arrayBuffer();
    console.log(`[DEBUG SOUND LOADING] File converted to array buffer, size: ${arrayBuffer.byteLength} bytes`);
    
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log(`[DEBUG SOUND LOADING] Audio successfully decoded for ${soundType} sound`);
      
      // Store the custom sound
      customSounds[soundType] = audioBuffer;
      
      console.log(`[DEBUG SOUND LOADING] Custom ${soundType} sound loaded successfully. Duration: ${audioBuffer.duration.toFixed(2)}s`);
      console.log(`[DEBUG SOUND LOADING] Current customSounds state:`, 
        Object.entries(customSounds).map(([key, value]) => `${key}: ${value ? 'loaded' : 'null'}`));
    } catch (decodeError) {
      console.error(`[DEBUG SOUND LOADING] Error decoding audio data for ${soundType}:`, decodeError);
      // Even if decoding fails, make sure we don't block future sound playback
      customSounds[soundType] = null;
    }
  } catch (e) {
    console.error(`[DEBUG SOUND LOADING] Error loading custom ${soundType} sound:`, e);
    // Make sure we don't leave this sound in an undefined state
    customSounds[soundType] = null;
  }
};

// Clear a custom sound
export const clearCustomSound = (soundType: CustomSoundType): void => {
  console.log(`[DEBUG SOUND] Clearing custom ${soundType} sound. Before clearing:`, customSounds[soundType] ? 'loaded' : 'null');
  // Set the custom sound to null
  customSounds[soundType] = null;
  console.log(`[DEBUG SOUND] Custom ${soundType} sound cleared. Current customSounds state:`, Object.entries(customSounds)
    .map(([key, value]) => `${key}: ${value ? 'loaded' : 'null'}`).join(', '));
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
    
    // If audio context and recorder destination exist, connect HTML Audio to recorder
    if (audioContext && recorderDestination) {
      try {
        // Create media element source if needed
        const source = audioContext.createMediaElementSource(backgroundMusic);
        source.connect(audioContext.destination);
        source.connect(recorderDestination);
        console.log('[BACKGROUND] Connected HTML Audio background music to recorder');
      } catch (e) {
        // This might throw if the source is already connected
        console.warn('[BACKGROUND] Could not connect background music to recorder:', e);
      }
    }
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
 * Joue une note MIDI
 * @param volume Le volume de la note (0-1)
 */
export const playMIDINote = (volume: number = 0.7): void => {
  if (!audioContext) {
    console.warn('[MIDI] Cannot play MIDI note: audio context not initialized');
    return;
  }
  
  // Resume audio context if suspended (required by browsers)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(err => {
      console.error('[MIDI] Failed to resume audio context:', err);
    });
  }
  
  if (!midiFileLoaded || midiNotes.length === 0) {
    console.warn('[MIDI] No MIDI sequence loaded');
    return;
  }
  
  try {
    // Get a note from the sequence based on pattern
    let note;
    let track;
    
    // Logic for track selection based on preset or specific track
    if (midiSelectedTrackIndex !== null) {
      // Find a note from the specific track only
      const trackNotes = midiNotes.filter(n => n.track === midiSelectedTrackIndex);
      if (trackNotes.length > 0) {
        // Random selection from the specific track
        const randomIndex = Math.floor(Math.random() * trackNotes.length);
        note = trackNotes[randomIndex].note;
        track = trackNotes[randomIndex].track;
      } else {
        // Fallback if no notes in selected track
        midiCurrentIndex = (midiCurrentIndex + 1) % midiNotes.length;
        note = midiNotes[midiCurrentIndex].note;
        track = midiNotes[midiCurrentIndex].track;
      }
    } else {
      // Default cycling behavior or preset-based selection
      if (midiSelectedInstrumentPreset === MIDI_INSTRUMENT_PRESETS.DEFAULT_CYCLING) {
        // Original behavior: cycle through notes
        midiCurrentIndex = (midiCurrentIndex + 1) % midiNotes.length;
        note = midiNotes[midiCurrentIndex].note;
        track = midiNotes[midiCurrentIndex].track;
      } else {
        // Random selection for more variety
        const randomIndex = Math.floor(Math.random() * midiNotes.length);
        note = midiNotes[randomIndex].note;
        track = midiNotes[randomIndex].track;
      }
    }
    
    // Apply tonality transposition
    note = note + midiTranspose;
    
    // Ensure note is within MIDI range (0-127)
    note = Math.min(127, Math.max(0, note));
    
    // Calculate frequency using the MIDI note number
    const frequency = 440 * Math.pow(2, (note - 69) / 12);
    console.log(`[MIDI] Playing note: ${note} (${midiToNoteName(note)}), frequency: ${frequency.toFixed(2)}Hz, track: ${track}`);
    
    // For MIDI sound playing, create an oscillator with variable waveform based on track
    // Different tracks will have different timbres
    let oscillator: OscillatorNode | null = null;
    let gainNode = audioContext.createGain();
    
    // Set initial gain to 0 for fade-in
    gainNode.gain.value = 0;
    
    // Apply volume
    const adjustedVolume = Math.min(1, Math.max(0.1, volume * midiVolume));
    
    // Fade in time
    const attackTime = 0.02; // 20ms attack
    const decayTime = 0.2;  // 200ms decay 
    let releaseTime = 0.3; // 300ms release - using let instead of const to allow modification
    const sustainLevel = 0.7; // 70% of peak volume
    
    // Create different synthesizer types based on the preset or track
    let synthType: number;
    
    // Determine synth type based on preset
    if (midiSelectedInstrumentPreset === MIDI_INSTRUMENT_PRESETS.DEFAULT_CYCLING) {
      // Original behavior: cycle through synth types
      synthType = track % 5;
    } else if (midiSelectedInstrumentPreset === MIDI_INSTRUMENT_PRESETS.MELODIC_MAIN) {
      synthType = 0; // PolySynth 
    } else if (midiSelectedInstrumentPreset === MIDI_INSTRUMENT_PRESETS.PAD_STRINGS) {
      synthType = 1; // Sine Synth
    } else if (midiSelectedInstrumentPreset === MIDI_INSTRUMENT_PRESETS.PERCUSSIVE) {
      synthType = 2; // Triangle Synth 
    } else if (midiSelectedInstrumentPreset === MIDI_INSTRUMENT_PRESETS.METAL_SYNTH) {
      synthType = 3; // Metal Synth
    } else if (midiSelectedInstrumentPreset === MIDI_INSTRUMENT_PRESETS.FM_SYNTH) {
      synthType = 4; // FM Synth
    } else {
      // Default
      synthType = track % 5;
    }
    
    // Create different effects based on synth type
    switch(synthType) {
      case 0: // PolySynth - for melodic main lines
        oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        
        // Create Detune for richer sound
        const detune = 5; // Slight detune for chorus effect
        oscillator.detune.value = detune;
        
        // Connect to gain node
        oscillator.connect(gainNode);
        break;
        
      case 1: // SineSynth - for pad/string sounds
        oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        
        // Create a slow vibrato
        const vibratoAmount = 3; // Very subtle
        const vibratoSpeed = 4; // 4 Hz
        
        const vibratoOsc = audioContext.createOscillator();
        vibratoOsc.type = 'sine';
        vibratoOsc.frequency.value = vibratoSpeed;
        
        const vibratoGain = audioContext.createGain();
        vibratoGain.gain.value = vibratoAmount;
        
        vibratoOsc.connect(vibratoGain);
        vibratoGain.connect(oscillator.detune);
        
        // Longer release
        releaseTime = 0.8;
        
        oscillator.connect(gainNode);
        vibratoOsc.start();
        break;
        
      case 2: // TriangleSynth - for percussive sounds
        oscillator = audioContext.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency;
        
        // Shorter attack and shorter release for percussive sound
        const attackTimeTri = 0.01;
        const releaseTimeTri = 0.1;
        releaseTime = releaseTimeTri; // Set the main releaseTime variable
        
        // Connect to gain node
        oscillator.connect(gainNode);
        break;
        
      case 3: // MetalSynth - for metallic sounds
        oscillator = audioContext.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = frequency;
        
        // Create a distortion/waveshaper for metallic sound
        const distortion = audioContext.createWaveShaper();
        
        // Simple distortion curve
        const distortionCurve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
          // Moderate distortion amount
          const x = (i / 1024) * 2 - 1;
          distortionCurve[i] = Math.tanh(3 * x); // Tanh provides a nice distortion curve
        }
        
        distortion.curve = distortionCurve;
        
        // Connect with distortion
        oscillator.connect(distortion);
        distortion.connect(gainNode);
        break;
        
      case 4: // FMSynth - for complex tones
        // Create carrier
        const carrier = audioContext.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.value = frequency;
        
        // Create modulator
        const modulator = audioContext.createOscillator();
        modulator.type = 'sine';
        
        // Modulator frequency determines FM character
        const modulationIndex = 100; // Modulation amount
        const modulationRatio = 2.5; // Modulation frequency ratio
        
        modulator.frequency.value = frequency * modulationRatio;
        
        // Connect modulator to carrier frequency
        const modulationGain = audioContext.createGain();
        modulationGain.gain.value = modulationIndex;
        
        modulator.connect(modulationGain);
        modulationGain.connect(carrier.frequency);
        carrier.connect(gainNode);
        
        modulator.start();
        oscillator = carrier; // We'll start/stop the carrier like any other oscillator
        break;
        
      default:
        oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(gainNode);
    }
    
    // Connect gain node to master output and to recorder
    if (masterGainNode) {
      gainNode.connect(masterGainNode);
    } else {
      gainNode.connect(audioContext.destination);
    }
    
    // Always connect directly to recorder for reliable recording
    if (recorderDestination) {
      gainNode.connect(recorderDestination);
      console.log('[MIDI] Connected MIDI sound to recorder destination');
    }
    
    // Apply ADSR envelope
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(adjustedVolume, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(adjustedVolume * sustainLevel, now + attackTime + decayTime);
    gainNode.gain.setValueAtTime(adjustedVolume * sustainLevel, now + attackTime + decayTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, now + attackTime + decayTime + 0.1 + releaseTime);
    
    // Start the oscillator
    oscillator.start();
    
    // Stop after the envelope completes
    oscillator.stop(now + attackTime + decayTime + 0.1 + releaseTime + 0.1); // Add small buffer
    
    // Clean up
    setTimeout(() => {
      oscillator = null;
    }, (attackTime + decayTime + 0.1 + releaseTime + 0.2) * 1000);
    
  } catch (e) {
    console.error('[MIDI] Error playing MIDI note:', e);
  }
};

/**
 * Vérifie si une séquence MIDI est chargée
 */
export const hasMIDISequence = (): boolean => {
  return midiFileLoaded && midiNotes.length > 0;
};

/**
 * Efface la séquence MIDI
 */
export const clearMIDISequence = () => {
  midiNotes = [];
  midiCurrentIndex = 0;
  midiFileLoaded = false;
  // MODIFICATION: Réinitialiser également les sélections
  midiSelectedInstrumentPreset = MIDI_INSTRUMENT_PRESETS.DEFAULT_CYCLING;
  midiSelectedTrackIndex = null;
  console.log("[MIDI] Séquence MIDI effacée et sélections réinitialisées");
};

/**
 * Définit la tonalité pour les notes MIDI et calcule la transposition nécessaire
 * @param tonality La tonalité à utiliser (ex: "C", "D", "F#", etc.)
 */
export const setMIDITonality = (tonality: string) => {
  // Vérifier que la tonalité est valide
  const validTonalities = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const normalizedTonality = tonality.toUpperCase().replace("b", "#");
  
  if (!validTonalities.includes(normalizedTonality)) {
    console.warn(`[MIDI] Tonalité invalide: ${tonality}. Utilisation de la tonalité par défaut (C).`);
    midiTonality = "C";
    midiTranspose = 0;
    return;
  }
  
  // Stocker la nouvelle tonalité
  midiTonality = normalizedTonality;
  
  // Calculer la transposition nécessaire pour passer de C à la tonalité demandée
  // C est la référence (0), puis chaque demi-ton ajoute 1
  const tonalityIndex = validTonalities.indexOf(normalizedTonality);
  midiTranspose = tonalityIndex; // 0 pour C, 1 pour C#, etc.
  
  console.log(`[MIDI] Tonalité définie sur ${midiTonality} (transposition: ${midiTranspose} demi-tons)`);
};

/**
 * Convertit un numéro MIDI en nom de note (format Tone.js) avec une meilleure précision
 * et applique la transposition selon la tonalité définie
 */
const midiToNoteName = (midi: number): string => {
  // Appliquer la transposition
  const transposedMidi = midi + midiTranspose;
  
  // Table des noms de notes
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Calcul de l'octave (MIDI note 60 = C4)
  const octave = Math.floor((transposedMidi - 12) / 12);
  
  // Calcul de la note dans l'octave (0-11)
  const noteIndex = (transposedMidi - 12) % 12;
  
  // Générer le nom de note au format Tone.js
  return `${noteNames[noteIndex]}${octave}`;
};

/**
 * Définit le volume pour les notes MIDI
 */
export const setMIDIVolume = (volume: number) => {
  midiVolume = Math.max(0, Math.min(1, volume));
  console.log(`[MIDI] Volume défini à ${midiVolume.toFixed(2)}`);
};

/**
 * Charge un fichier MIDI et extrait les notes
 */
export const loadMIDIFile = async (file: File): Promise<boolean> => {
  console.log(`[MIDI LOAD] Démarrage du chargement du fichier MIDI: ${file.name}, taille: ${file.size} octets`);
  midiNotes = []; // Réinitialiser les notes MIDI
  midiCurrentIndex = 0;
  midiFileLoaded = false;
  
  try {
    // Lire le fichier comme ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log(`[MIDI LOAD] Fichier lu, taille: ${arrayBuffer.byteLength} octets`);
    
    // Convertir en Uint8Array pour l'analyse
    const midiData = new Uint8Array(arrayBuffer);
    
    // Extraction des notes du fichier MIDI
    console.log(`[MIDI LOAD] Analyse des données MIDI: ${midiData.length} octets`);
    
    // Étape 1: Vérifier l'en-tête MIDI
    if (midiData.length < 14 || 
        String.fromCharCode.apply(null, Array.from(midiData.slice(0, 4))) !== 'MThd' ||
        midiData[4] !== 0 || midiData[5] !== 0 || midiData[6] !== 0 || midiData[7] !== 6) {
      console.error("[MIDI LOAD] Format MIDI invalide", midiData.slice(0, 14));
      return false;
    }
    
    // Récupérer des informations importantes de l'en-tête
    const format = (midiData[8] << 8) | midiData[9];
    const numTracks = (midiData[10] << 8) | midiData[11];
    const timeDivision = (midiData[12] << 8) | midiData[13];
    
    console.log(`[MIDI LOAD] Format: ${format}, Pistes: ${numTracks}, Division: ${timeDivision}`);
    
    // Étape 2: Parcourir les chunks pour trouver les événements de note
    let position = 14; // Après l'en-tête MThd
    const allExtractedNotes: { note: number, track: number, timing: number, velocity: number }[] = [];
    const channels = new Set<number>();
    
    // Statistiques par piste pour identifier les pistes importantes
    const trackStats: { [key: number]: { noteCount: number, velocitySum: number, highestNote: number, lowestNote: number } } = {};
    
    for (let trackIndex = 0; trackIndex < numTracks && position < midiData.length - 4; trackIndex++) {
      // Initialiser les statistiques pour cette piste
      trackStats[trackIndex] = {
        noteCount: 0,
        velocitySum: 0,
        highestNote: 0,
        lowestNote: 127
      };
      
      // Chercher les en-têtes de piste MTrk
      if (String.fromCharCode.apply(null, Array.from(midiData.slice(position, position + 4))) === 'MTrk') {
        // Lire la longueur de la piste
        const trackLength = (midiData[position + 4] << 24) | 
                           (midiData[position + 5] << 16) | 
                           (midiData[position + 6] << 8) | 
                           midiData[position + 7];
        position += 8; // Avancer après l'en-tête et la longueur
        
        console.log(`[MIDI LOAD] Piste ${trackIndex}, longueur: ${trackLength} octets`);
        
        // Analyser les événements de la piste
        let trackPosition = position;
        let runningStatus = 0;
        let absoluteTime = 0; // Temps absolu pour cette piste
        
        while (trackPosition < position + trackLength) {
          // Lire le delta time (variable length)
          let deltaTime = 0;
          let deltaValue;
          
          do {
            deltaValue = midiData[trackPosition++];
            deltaTime = (deltaTime << 7) | (deltaValue & 0x7F);
          } while (deltaValue & 0x80 && trackPosition < position + trackLength);
          
          // Ajouter le delta time au temps absolu
          absoluteTime += deltaTime;
          
          // Lire le status byte ou utiliser le running status
          let statusByte = midiData[trackPosition];
          
          if (statusByte < 0x80) {
            // Running status, utiliser le précédent
            statusByte = runningStatus;
          } else {
            // Nouveau status, avancer
            trackPosition++;
            runningStatus = statusByte;
          }
          
          // Traiter les événements de note on (0x9n)
          if ((statusByte & 0xF0) === 0x90) {
            const channel = statusByte & 0x0F;
            const noteNumber = midiData[trackPosition++];
            const velocity = midiData[trackPosition++];
            
            // Enregistrer uniquement les notes avec vélocité > 0 (note on réelle)
            if (velocity > 0 && noteNumber >= 21 && noteNumber <= 108) {
              // Mettre à jour les statistiques de la piste
              trackStats[trackIndex].noteCount++;
              trackStats[trackIndex].velocitySum += velocity;
              trackStats[trackIndex].highestNote = Math.max(trackStats[trackIndex].highestNote, noteNumber);
              trackStats[trackIndex].lowestNote = Math.min(trackStats[trackIndex].lowestNote, noteNumber);
              
              allExtractedNotes.push({
                note: noteNumber,
                track: trackIndex,
                timing: absoluteTime,
                velocity: velocity
              });
              channels.add(channel);
            }
          }
          // Meta événement (0xFF)
          else if (statusByte === 0xFF) {
            const metaType = midiData[trackPosition++];
            
            // Lire la longueur des métadonnées (variable length)
            let metaLength = 0;
            let metaValue;
            
            do {
              metaValue = midiData[trackPosition++];
              metaLength = (metaLength << 7) | (metaValue & 0x7F);
            } while (metaValue & 0x80 && trackPosition < position + trackLength);
            
            // Avancer après les métadonnées
            trackPosition += metaLength;
          }
          // Autres événements à 2 octets de données
          else if ((statusByte & 0xF0) === 0xC0 || (statusByte & 0xF0) === 0xD0) {
            trackPosition += 1;
          }
          // Autres événements à 3 octets
          else if ((statusByte & 0xF0) <= 0xE0) {
            trackPosition += 2;
          }
          // System Exclusive
          else if (statusByte === 0xF0 || statusByte === 0xF7) {
            let sysexLength = 0;
            let sysexValue;
            
            do {
              sysexValue = midiData[trackPosition++];
              sysexLength = (sysexLength << 7) | (sysexValue & 0x7F);
            } while (sysexValue & 0x80 && trackPosition < position + trackLength);
            
            trackPosition += sysexLength;
          }
          else {
            // Type d'événement inconnu, avancer d'un octet
            trackPosition++;
          }
        }
        
        // Passer à la piste suivante
        position += trackLength;
      } else {
        // Pas un en-tête valide, avancer
        position++;
      }
    }
    
    // Analyser les statistiques pour identifier les pistes importantes
    console.log("[MIDI LOAD] Statistiques des pistes:", trackStats);
    
    // Identifier les pistes mélodiques principales (celles avec une bonne amplitude de notes et un nombre raisonnable de notes)
    const mainTracks: number[] = [];
    for (const trackIndex in trackStats) {
      const stats = trackStats[trackIndex];
      const noteRange = stats.highestNote - stats.lowestNote;
      
      // Une piste principale a généralement beaucoup de notes et couvre une bonne plage de notes
      if (stats.noteCount > 10 && noteRange > 7) {
        mainTracks.push(parseInt(trackIndex));
      }
    }
    
    console.log("[MIDI LOAD] Pistes principales identifiées:", mainTracks);
    
    // Extraire les notes de ces pistes principales uniquement
    let extractedNotes: { note: number, track: number, timing: number }[] = [];
    
    if (mainTracks.length > 0) {
      // Cas où nous avons identifié des pistes principales
      for (const note of allExtractedNotes) {
        if (mainTracks.includes(note.track)) {
          extractedNotes.push({
            note: note.note,
            track: note.track,
            timing: note.timing
          });
        }
      }
    } else {
      // Si aucune piste principale n'a été identifiée, prendre toutes les notes
      extractedNotes = allExtractedNotes.map(note => ({
        note: note.note,
        track: note.track,
        timing: note.timing
      }));
    }
    
    // Vérifier si des notes ont été extraites
    if (extractedNotes.length > 0) {
      console.log(`[MIDI LOAD] Extraction réussie: ${extractedNotes.length} notes MIDI trouvées sur les pistes principales`);
      
      // Trier les notes par temps (timing) pour garder l'ordre chronologique
      extractedNotes.sort((a, b) => a.timing - b.timing);
      
      // Garder un nombre raisonnable de notes pour éviter les fichiers trop longs
      if (extractedNotes.length > 300) {
        midiNotes = extractedNotes.slice(0, 300);
        console.log(`[MIDI LOAD] Limité à 300 notes sur ${extractedNotes.length}`);
      } else {
        midiNotes = extractedNotes;
      }
      
      console.log(`[MIDI LOAD] Notes extraites (premiers 20):`, midiNotes.slice(0, 20));
      console.log(`[MIDI LOAD] Canaux utilisés:`, Array.from(channels));
      
      midiFileLoaded = true;
      return true;
    } else {
      console.warn("[MIDI LOAD] Aucune note n'a été extraite du fichier MIDI");
      return false;
    }
  } catch (error) {
    console.error("[MIDI LOAD] Erreur lors de l'analyse du fichier MIDI:", error);
    return false;
  }
};

// MODIFICATION: Nouvelles fonctions pour définir l'instrument et la piste MIDI
/**
 * Définit le preset d'instrument MIDI à utiliser.
 * @param preset La clé du preset d'instrument. Si null, revient au cycle par défaut.
 */
export const setMIDIInstrumentPreset = (preset: MIDIInstrumentPresetKey | null) => {
  if (preset === null || Object.values(MIDI_INSTRUMENT_PRESETS).includes(preset)) {
    midiSelectedInstrumentPreset = preset || MIDI_INSTRUMENT_PRESETS.DEFAULT_CYCLING;
    console.log(`[MIDI] Preset d'instrument défini sur: ${midiSelectedInstrumentPreset}`);
  } else {
    console.warn(`[MIDI] Preset d'instrument invalide: ${preset}. Utilisation du cycle par défaut.`);
    midiSelectedInstrumentPreset = MIDI_INSTRUMENT_PRESETS.DEFAULT_CYCLING;
  }
};

/**
 * Définit l'index de la piste MIDI à jouer.
 * @param trackIndex L'index de la piste. Si null, joue les notes des pistes principales (comportement par défaut).
 */
export const setMIDITrackIndex = (trackIndex: number | null) => {
  if (trackIndex === null || (typeof trackIndex === 'number' && trackIndex >= 0)) {
    midiSelectedTrackIndex = trackIndex;
    console.log(`[MIDI] Index de piste sélectionné: ${midiSelectedTrackIndex === null ? 'Toutes les pistes principales' : trackIndex}`);
  } else {
    console.warn(`[MIDI] Index de piste invalide: ${trackIndex}. Sélection annulée (toutes les pistes principales).`);
    midiSelectedTrackIndex = null;
  }
};

// Vérifie si un son personnalisé est disponible
export const hasCustomSound = (soundType: CustomSoundType): boolean => {
  // Check if customSounds contains a non-null value for this sound type
  const result = customSounds[soundType] !== null && customSounds[soundType] !== undefined;
  console.log(`[DEBUG CUSTOM SOUND] hasCustomSound(${soundType}): soundExists=${result}, value=`, customSounds[soundType]);
  
  // Log more details if there's a problem
  if (!result) {
    console.log(`[DEBUG CUSTOM SOUND] customSounds object:`, 
      Object.entries(customSounds).map(([type, buffer]) => `${type}: ${buffer ? 'loaded' : 'null'}`));
  }
  
  return result;
};

// Sound for wall collision
export const playWallSound = (
  volume: number = 0.3, 
  useCustom: boolean = false
): void => {
  console.log(`[DEBUG playWallSound] Called with volume=${volume}, useCustom=${useCustom}`);
  
  // Ne rien jouer si les sons standards sont désactivés (à moins qu'on utilise un son custom)
  if (!standardSoundsEnabled && !useCustom) {
    console.log('[DEBUG playWallSound] Skipping playback: standardSoundsEnabled=false and useCustom=false');
    return;
  }
  
  if (!audioContext) {
    console.warn('[DEBUG playWallSound] Cannot play sound: audio context not initialized');
    return;
  }
  
  // Resume audio context if it's suspended (browser policy)
  if (audioContext.state === 'suspended') {
    console.log('[DEBUG playWallSound] Resuming audio context for sound playback');
    audioContext.resume().catch(err => {
      console.error('[DEBUG playWallSound] Failed to resume audio context:', err);
    });
  }
  
  try {
    // Check if custom sound is available and requested
    const hasCustomWall = useCustom && customSounds.wall !== null;
    console.log(`[DEBUG playWallSound] HasCustomWall: ${hasCustomWall}, customSounds.wall: ${customSounds.wall ? 'exists' : 'null'}`);
    
    // Use custom or bounce sound buffer
    const soundBuffer = hasCustomWall ? customSounds.wall : soundCache['bounce'];
    
    if (!soundBuffer) {
      console.warn('[DEBUG playWallSound] No sound buffer available');
      return;
    }
    
    console.log(`[DEBUG playWallSound] Creating buffer source with ${hasCustomWall ? 'custom' : 'default'} sound`);
    const source = audioContext.createBufferSource();
    source.buffer = soundBuffer;
    
    const gainNode = audioContext.createGain();
    // Limit volume and apply gentle reduction
    gainNode.gain.value = Math.min(0.7, Math.max(0.05, volume));
    
    source.connect(gainNode);
    
    // Connect to master gain for consistent mixing
    if (masterGainNode) {
      gainNode.connect(masterGainNode);
    } else {
      gainNode.connect(audioContext.destination);
    }
    
    // Always connect to recorder for reliable capture
    if (recorderDestination) {
      gainNode.connect(recorderDestination);
      console.log('[DEBUG playWallSound] Connected to recorder destination');
    } else {
      console.log('[DEBUG playWallSound] No recorder destination available');
    }
    
    source.start();
    console.log('[DEBUG playWallSound] Sound playback started');
  } catch (e) {
    console.error('[DEBUG playWallSound] Error playing wall sound:', e);
  }
};

// Function to play background music using WebAudio oscillator
export const playBackgroundOscillator = (volume: number = 0.4): void => {
  if (!audioContext) {
    console.warn('[BACKGROUND] Cannot play background music: audio context not initialized');
    return;
  }
  
  // Resume audio context if suspended (required by browsers)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(err => {
      console.error('[BACKGROUND] Failed to resume audio context:', err);
    });
  }

  if (backgroundMusicPlaying) {
    stopBackgroundOscillator();
  }

  try {
    // Créer un oscillateur pour le son de fond
    const oscillator = audioContext.createOscillator();
    backgroundMusicOscillator = oscillator;
    oscillator.type = 'sine'; // Utiliser une onde sinusoïdale pour un son doux
    
    // Calculer la fréquence de base pour la note
    let baseFrequency;
    
    // Trouver une fréquence qui correspond à la tonalité sélectionnée
    if (midiTonality === 'major') {
      // Utiliser une note majeure (do majeur)
      baseFrequency = 261.63; // Do (C4)
    } else if (midiTonality === 'minor') {
      // Utiliser une note mineure (la mineur)
      baseFrequency = 220.00; // La (A3)
    } else {
      // Tonalité par défaut
      baseFrequency = 261.63; // Do (C4)
    }
    
    // Appliquer la transposition
    oscillator.frequency.value = baseFrequency * Math.pow(2, midiTranspose / 12);
    
    // Créer un nœud de gain pour contrôler le volume
    const gainNode = audioContext.createGain();
    backgroundMusicGainNode = gainNode;
    
    // Définir le volume initial à 0 pour un fondu entrant
    gainNode.gain.value = 0;
    
    // Connecter l'oscillateur au nœud de gain
    oscillator.connect(gainNode);
    
    // Connecter le nœud de gain à la destination audio principale
    if (masterGainNode) {
      gainNode.connect(masterGainNode);
    } else {
      gainNode.connect(audioContext.destination);
    }
    
    // Always connect to recorder destination if available
    if (recorderDestination) {
      gainNode.connect(recorderDestination);
      console.log('[BACKGROUND] Connected background music to recorder destination');
    }
    
    // Démarrer l'oscillateur
    oscillator.start();
    backgroundMusicPlaying = true;
    
    // Définir un fondu entrant progressif pour le volume
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume * 0.1, now + 2.0); // 2 secondes de fondu entrant
    
    console.log('[BACKGROUND] Background music started');
    
  } catch (e) {
    console.error('[BACKGROUND] Error playing background music:', e);
    backgroundMusicPlaying = false;
    backgroundMusicOscillator = null;
    backgroundMusicGainNode = null;
  }
};

// Add the function to stop background music oscillator
export const stopBackgroundOscillator = (): void => {
  // Stop the WebAudio oscillator if it's playing
  if (backgroundMusicOscillator && backgroundMusicGainNode) {
    try {
      // Apply fade out
      if (audioContext) {
        const now = audioContext.currentTime;
        backgroundMusicGainNode.gain.setValueAtTime(backgroundMusicGainNode.gain.value, now);
        backgroundMusicGainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        
        // Stop after fade
        setTimeout(() => {
          if (backgroundMusicOscillator) {
            backgroundMusicOscillator.stop();
            backgroundMusicOscillator = null;
          }
          if (backgroundMusicGainNode) {
            backgroundMusicGainNode.disconnect();
            backgroundMusicGainNode = null;
          }
        }, 600);
      } else {
        // No context, stop immediately
        backgroundMusicOscillator.stop();
        backgroundMusicOscillator = null;
        backgroundMusicGainNode.disconnect();
        backgroundMusicGainNode = null;
      }
      
      backgroundMusicPlaying = false;
      console.log('[BACKGROUND] Background music oscillator stopped');
    } catch (e) {
      console.error('[BACKGROUND] Error stopping background music oscillator:', e);
    }
  }
};

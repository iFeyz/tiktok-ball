/**
 * Système d'enregistrement simplifié pour les jeux canvas avec capture audio
 */

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let recordingStream: MediaStream | null = null;
let recordingCanvas: HTMLCanvasElement | null = null;
let audioContext: AudioContext | null = null;
let audioDestination: MediaStreamAudioDestinationNode | null = null;
let recordingActive = false;

/**
 * Initialiser le système d'enregistrement avec un canvas
 * @param canvas Élément canvas à enregistrer
 */
export function initializeRecorder(canvas: HTMLCanvasElement): void {
  recordingCanvas = canvas;
  
  try {
    // Créer un contexte audio si nécessaire
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioDestination = audioContext.createMediaStreamDestination();
      console.log('Système d\'enregistrement audio initialisé');
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de l\'audio:', error);
  }
}

/**
 * Vérifier si l'enregistrement est actif
 */
export function isRecording(): boolean {
  return recordingActive;
}

/**
 * Démarrer l'enregistrement du canvas avec capture audio
 * @param options Options d'enregistrement (codecs, qualité, etc.)
 * @returns Promise résolue quand l'enregistrement démarre
 */
export async function startRecording(options: MediaRecorderOptions = {}): Promise<void> {
  if (!recordingCanvas) {
    throw new Error('Canvas non initialisé. Appeler initializeRecorder d\'abord.');
  }
  
  if (recordingActive) {
    console.warn('Enregistrement déjà en cours');
    return;
  }
  
  try {
    // Réinitialiser les données
    recordedChunks = [];
    
    // Obtenir le flux vidéo du canvas (60fps)
    const videoStream = recordingCanvas.captureStream(60);
    
    // Créer un flux composite avec l'audio si disponible
    let compositeStream: MediaStream;
    
    if (audioDestination && audioDestination.stream) {
      // S'assurer que le contexte audio est actif
      if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Fusionner les pistes audio et vidéo
      const videoTracks = videoStream.getVideoTracks();
      const audioTracks = audioDestination.stream.getAudioTracks();
      
      if (audioTracks.length > 0) {
        compositeStream = new MediaStream([...videoTracks, ...audioTracks]);
        console.log(`Stream composite créé avec ${videoTracks.length} pistes vidéo et ${audioTracks.length} pistes audio`);
      } else {
        console.warn('Pas de pistes audio disponibles, enregistrement sans audio');
        compositeStream = videoStream;
      }
    } else {
      console.warn('Destination audio non disponible, enregistrement sans audio');
      compositeStream = videoStream;
    }
    
    recordingStream = compositeStream;
    
    // Déterminer le type MIME optimal
    const mimeType = getSupportedMimeType();
    const recorderOptions: MediaRecorderOptions = {
      ...options,
      mimeType: mimeType || undefined
    };
    
    // Créer l'enregistreur
    mediaRecorder = new MediaRecorder(compositeStream, recorderOptions);
    
    // Gérer la disponibilité des données
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    // Démarrer l'enregistrement
    mediaRecorder.start(1000); // Demander des données toutes les secondes
    recordingActive = true;
    
    console.log('Enregistrement démarré avec succès');
    
    return Promise.resolve();
  } catch (error) {
    console.error('Erreur lors du démarrage de l\'enregistrement:', error);
    return Promise.reject(error);
  }
}

/**
 * Arrêter l'enregistrement en cours
 * @returns Promise résolue avec une confirmation
 */
export async function stopRecording(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || !recordingActive) {
      return reject(new Error('Pas d\'enregistrement actif'));
    }
    
    // Gérer la fin de l'enregistrement
    mediaRecorder.onstop = () => {
      if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
      }
      
      recordingActive = false;
      console.log('Enregistrement arrêté avec succès');
      resolve();
    };
    
    // Gérer les erreurs
    mediaRecorder.onerror = (event) => {
      console.error('Erreur MediaRecorder:', event);
      recordingActive = false;
      reject(new Error('Erreur lors de l\'arrêt de l\'enregistrement'));
    };
    
    // Demander la dernière partie des données avant d'arrêter
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.requestData();
      mediaRecorder.stop();
    } else {
      recordingActive = false;
      resolve();
    }
  });
}

/**
 * Télécharger l'enregistrement sous forme de fichier vidéo
 * @param filename Nom du fichier à télécharger
 */
export function downloadRecording(filename = 'game-recording.webm'): void {
  if (recordedChunks.length === 0) {
    console.warn('Pas de données enregistrées à télécharger');
    return;
  }
  
  try {
    // Créer un blob à partir des chunks enregistrés
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    
    // Créer un lien de téléchargement
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    
    // Ajouter à la page, cliquer et nettoyer
    document.body.appendChild(a);
    a.click();
    
    // Nettoyer après un court délai
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log(`Enregistrement téléchargé: ${filename} (${(blob.size / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
  }
}

/**
 * Permettre à l'audio du jeu de se connecter à l'enregistreur
 * @param audioNode Nœud audio à connecter
 */
export function connectAudioSource(audioNode: AudioNode): void {
  if (!audioDestination || !audioContext) {
    console.warn('Système audio non initialisé');
    return;
  }
  
  try {
    // S'assurer que les nœuds appartiennent au même contexte
    if (audioNode.context !== audioContext) {
      console.warn('Impossible de connecter des nœuds audio de contextes différents');
      return;
    }
    
    // Tenter de déconnecter d'abord (pour éviter les connexions multiples)
    try {
      audioNode.disconnect(audioDestination);
    } catch (e) {
      // Ignorer les erreurs de déconnexion - le nœud pourrait ne pas être connecté
    }
    
    // Connecter la source audio à la destination d'enregistrement
    audioNode.connect(audioDestination);
    console.log('Source audio connectée à l\'enregistreur');
  } catch (error) {
    console.error('Erreur lors de la connexion de la source audio:', error);
  }
}

/**
 * Obtenir le nœud de destination audio pour y connecter les sources
 */
export function getAudioDestination(): MediaStreamAudioDestinationNode | null {
  return audioDestination;
}

/**
 * Déterminer le type MIME optimal pour l'enregistrement
 * @returns Type MIME supporté ou chaîne vide
 */
function getSupportedMimeType(): string {
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  
  return '';
} 
import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Media recorder for capturing canvas gameplay for TikTok
 */
class GameRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isRecording = false;
  private recordingStartTime = 0;
  private maxDuration = 60000; // 60 seconds default max duration
  private audioContext: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;

  /**
   * Get supported MIME type for recording
   * @returns The best supported MIME type or empty string if none supported
   */
  private getSupportedMimeType(): string {
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`Using MIME type: ${mimeType}`);
        return mimeType;
      }
    }
    
    console.warn('No supported MIME types found, will try default');
    return '';
  }

  /**
   * Set up audio capture from the system audio context
   * @param existingContext Optional existing AudioContext to use
   * @returns Audio stream destination for connecting audio sources
   */
  public setupAudioCapture(existingContext?: AudioContext): MediaStreamAudioDestinationNode | null {
    try {
      // Use existing context if provided, otherwise create a new one
      if (existingContext) {
        this.audioContext = existingContext;
        console.log('Using existing audio context for recorder');
      } else if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('Created new audio context for recorder');
      }

      // Create audio destination for capturing audio
      this.audioDestination = this.audioContext.createMediaStreamDestination();
      console.log('Audio capture setup successful');
      return this.audioDestination;
    } catch (err) {
      console.warn('Failed to set up audio capture:', err);
      return null;
    }
  }

  /**
   * Get the current audio context
   * @returns The current AudioContext or null
   */
  public getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Connect an audio node to the recording
   * @param sourceNode The audio node to connect
   */
  public connectAudioSource(sourceNode: AudioNode): void {
    if (this.audioDestination) {
      try {
        // Check if source node belongs to the same context
        if (sourceNode.context !== this.audioContext) {
          console.warn('Cannot connect audio nodes from different contexts');
          return;
        }
        
        sourceNode.connect(this.audioDestination);
        console.log('Audio source connected to recorder');
      } catch (err) {
        console.warn('Failed to connect audio source:', err);
      }
    }
  }

  /**
   * Start recording a canvas element
   * @param canvas The canvas element to record
   * @param maxDurationMs Maximum recording duration in milliseconds (default: 60000ms)
   * @param options Additional recording options
   * @returns Promise that resolves when recording starts
   */
  async startRecording(
    canvas: HTMLCanvasElement, 
    maxDurationMs = 60000,
    options = {
      frameRate: 60,
      videoBitsPerSecond: 5000000, // 5 Mbps
      captureAudio: true
    }
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        this.canvas = canvas;
        this.maxDuration = maxDurationMs;
        this.recordedChunks = [];

        if (!canvas) {
          reject(new Error('Canvas element is required'));
          return;
        }

        // Get the stream from the canvas with higher framerate
        const frameRate = options.frameRate || 60;
        const videoStream = canvas.captureStream(frameRate);
        
        // Create a composite stream with system audio if requested
        let compositeStream: MediaStream;
        
        if (options.captureAudio && this.audioDestination) {
          try {
            // Use the audio destination stream (system audio)
            const audioStream = this.audioDestination.stream;
            
            // Combine video and audio tracks
            const videoTracks = videoStream.getVideoTracks();
            const audioTracks = audioStream.getAudioTracks();
            
            if (audioTracks.length > 0) {
              compositeStream = new MediaStream([
                ...videoTracks,
                ...audioTracks
              ]);
              console.log('Created composite stream with system audio');
            } else {
              console.warn('No audio tracks available, recording without audio');
              compositeStream = videoStream;
            }
          } catch (err) {
            console.warn('Failed to add system audio:', err);
            compositeStream = videoStream;
          }
        } else {
          compositeStream = videoStream;
        }
        
        this.stream = compositeStream;

        // Get supported MIME type
        const mimeType = this.getSupportedMimeType();
        
        // Create media recorder options
        const recorderOptions: MediaRecorderOptions = {};
        
        if (mimeType) {
          recorderOptions.mimeType = mimeType;
        }
        
        if (options.videoBitsPerSecond) {
          recorderOptions.videoBitsPerSecond = options.videoBitsPerSecond;
        }

        // Create the media recorder
        this.mediaRecorder = new MediaRecorder(compositeStream, recorderOptions);

        // Handle data available event
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            console.log(`Received chunk of size: ${event.data.size} bytes`);
            this.recordedChunks.push(event.data);
          } else {
            console.warn('Received empty data chunk');
          }
        };

        // Handle errors
        this.mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event);
          reject(new Error('MediaRecorder error'));
        };

        // Start recording - request data more frequently for reliability
        this.mediaRecorder.start(500); // Request data every 500ms
        this.isRecording = true;
        this.recordingStartTime = Date.now();

        console.log('Recording started successfully');

        // Set up automatic stop after max duration
        setTimeout(() => {
          if (this.isRecording) {
            this.stopRecording();
          }
        }, this.maxDuration);

        resolve();
      } catch (error) {
        console.error('Failed to start recording:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the recording process
   * @returns Promise that resolves with the recorded blob
   */
  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No active recording'));
        return;
      }

      // Request final data chunk before stopping
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.requestData();
      }

      // Create handler for when recording stops
      this.mediaRecorder.onstop = () => {
        if (this.recordedChunks.length === 0) {
          console.error('No data was recorded');
          reject(new Error('No data was recorded'));
          return;
        }

        console.log(`Creating blob from ${this.recordedChunks.length} chunks`);
        
        // Create a blob from all recorded chunks with proper MIME type
        const mimeType = this.mediaRecorder ? this.mediaRecorder.mimeType : 'video/webm';
        const blob = new Blob(this.recordedChunks, {
          type: mimeType || 'video/webm'
        });
        
        console.log(`Created blob of size: ${blob.size} bytes`);

        // Clean up
        this.isRecording = false;
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        this.mediaRecorder = null;

        resolve(blob);
      };

      // Stop the media recorder
      this.mediaRecorder.stop();
    });
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Stop any ongoing recording
    if (this.isRecording) {
      try {
        this.mediaRecorder?.stop();
      } catch (e) {
        console.warn('Error stopping recorder during cleanup:', e);
      }
    }

    // Close audio context
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      this.audioContext = null;
    }

    this.audioDestination = null;
    this.stream = null;
    this.mediaRecorder = null;
    this.isRecording = false;
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get the current recording duration in milliseconds
   */
  getRecordingDuration(): number {
    if (!this.isRecording) return 0;
    return Date.now() - this.recordingStartTime;
  }

  /**
   * Get the maximum recording duration
   */
  getMaxDuration(): number {
    return this.maxDuration;
  }
}

// Singleton instance
const recorderInstance = new GameRecorder();

/**
 * Download the recorded gameplay as a video file
 * @param blob The video blob to download
 * @param filename Optional custom filename
 */
export const downloadVideo = (blob: Blob, filename = 'tiktok-gameplay.webm'): void => {
  if (!blob || blob.size === 0) {
    console.error('Cannot download empty video blob');
    alert('La vidéo n\'a pas pu être enregistrée correctement');
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

/**
 * React hook for using the game recorder
 */
export const useGameRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const intervalRef = useRef<number | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Expose the audio context for sharing with sound system
  const getAudioContext = useCallback(() => {
    return recorderInstance.getAudioContext();
  }, []);

  // Set up audio recording destination on mount with optional existing context
  const setupAudioRecording = useCallback((existingContext?: AudioContext) => {
    audioDestinationRef.current = recorderInstance.setupAudioCapture(existingContext);
    return audioDestinationRef.current;
  }, []);

  // Expose the audio destination for connecting game sounds
  const getAudioDestination = useCallback(() => {
    return audioDestinationRef.current;
  }, []);

  // Connect an audio node to the recording
  const connectAudioNode = useCallback((audioNode: AudioNode) => {
    recorderInstance.connectAudioSource(audioNode);
  }, []);

  // Update recording time during recording
  useEffect(() => {
    if (isRecording) {
      intervalRef.current = window.setInterval(() => {
        setRecordingTime(recorderInstance.getRecordingDuration());
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  // Start recording function
  const startRecording = async (
    canvas: HTMLCanvasElement, 
    maxDurationMs = 60000,
    options = {
      frameRate: 60,
      videoBitsPerSecond: 5000000, // 5 Mbps
      captureAudio: true
    }
  ) => {
    try {
      await recorderInstance.startRecording(canvas, maxDurationMs, options);
      setIsRecording(true);
      setVideoBlob(null);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Impossible de démarrer l\'enregistrement. Vérifiez les permissions du navigateur.');
    }
  };

  // Stop recording function
  const stopRecording = async () => {
    try {
      if (recorderInstance.isCurrentlyRecording()) {
        const blob = await recorderInstance.stopRecording();
        
        if (blob.size === 0) {
          console.error('Recorded blob has zero size');
          alert('L\'enregistrement a échoué (fichier vide)');
          return null;
        }
        
        setVideoBlob(blob);
        setIsRecording(false);
        return blob;
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Erreur lors de l\'arrêt de l\'enregistrement');
    }
    return null;
  };

  // Download the recorded video
  const downloadGameplayVideo = (customFilename?: string) => {
    if (videoBlob) {
      if (videoBlob.size === 0) {
        alert('La vidéo est vide et ne peut pas être téléchargée');
        return;
      }
      downloadVideo(videoBlob, customFilename);
    } else {
      alert('Aucune vidéo disponible pour le téléchargement');
    }
  };

  return {
    isRecording,
    recordingTime,
    videoBlob,
    startRecording,
    stopRecording,
    downloadGameplayVideo,
    maxDuration: recorderInstance.getMaxDuration(),
    getAudioDestination,
    connectAudioNode,
    getAudioContext,
    setupAudioRecording
  };
};

export default recorderInstance; 
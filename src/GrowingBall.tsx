// Add isRecording to the GrowingBallProps interface
import React, { useState, useRef, useEffect } from 'react';
import { GameProps } from './types';
import { 
  MUSIC_SCALES, 
  CustomMusicKey 
} from './utils/sounds';

// Définition des tonalités MIDI valides
const MIDI_TONALITIES = {
  C: "C",
  "C#": "C#",
  D: "D",
  "D#": "D#",
  E: "E",
  F: "F",
  "F#": "F#",
  G: "G",
  "G#": "G#",
  A: "A",
  "A#": "A#",
  B: "B"
} as const;

// Définition du type SoundType
type SoundType = 'bounce' | 'grow' | 'gameOver' | 'wall';

interface GrowingBallProps extends GameProps {
  gravity?: number;
  growthRate?: number;
  bounciness?: number;
  ballSpeed?: number;
  initialBallCount?: number;
  effectsEnabled?: boolean;
  ballCollisionsEnabled?: boolean;
  scoreTrackingEnabled?: boolean; 
  bgEffectsEnabled?: boolean;
  useCustomImages?: boolean;
  customImages?: string[]; 
  ballImageAssignments?: number[];
  useCustomSounds?: boolean;
  customBallSounds?: Record<SoundType, File | null>;
  musicEnabled?: boolean;
  ballMusicAssignments?: Record<number, keyof typeof MUSIC_SCALES | CustomMusicKey>;
  backgroundMusicEnabled?: boolean;
  progressiveSoundEnabled?: boolean;
  maxBallSpeed?: number;
  onBallCollision?: (volume: number) => void;
  standardSoundsEnabled?: boolean;
  extractedMusicEnabled?: boolean;
  bounceVolume?: number;
  progressiveSoundVolume?: number;
  onVolumeChange?: (volume: number) => void;
  midiEnabled?: boolean;
  midiVolume?: number;
  midiTonality?: keyof typeof MIDI_TONALITIES;
  midiInstrumentPreset?: number;
  ballCount?: number;
  // Add recording property
  isRecording?: boolean;
}

// Add recording state and functions to the GrowingBall component
const GrowingBall: React.FC<GrowingBallProps> = ({ 
  // other props
  isRecording,
  // remaining props
}) => {
  // Add new refs and state for recording
  const [isRecordingState, setIsRecordingState] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Add useEffect to handle recording state
  useEffect(() => {
    if (isRecording !== undefined) {
      if (isRecording && !isRecordingState) {
        startRecording();
      } else if (!isRecording && isRecordingState) {
        stopRecording();
      }
    }
  }, [isRecording, isRecordingState]);

  // Add recording functions
  const startRecording = () => {
    if (!canvasRef.current) return;
    
    recordedChunksRef.current = [];
    const stream = canvasRef.current.captureStream(30); // 30 FPS
    
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, {
        type: 'video/webm'
      });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style.display = 'none';
      a.href = url;
      a.download = 'growing-ball-recording.webm';
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecordingState(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingState) {
      mediaRecorderRef.current.stop();
      setIsRecordingState(false);
    }
  };

  // Update return statement to include recording UI
  return (
    <div className="tiktok-game-wrapper" style={{ position: 'relative', width: '450px', height: '800px', margin: '0 auto' }}>
      <canvas
        ref={canvasRef}
        width={450}
        height={800}
        style={{ backgroundColor: '#111' }}
      />
      {/* Message for recording status */}
      {isRecordingState && (
        <div 
          style={{ 
            position: 'absolute', 
            top: '10px', 
            right: '10px', 
            backgroundColor: 'rgba(255, 0, 0, 0.7)', 
            color: 'white', 
            padding: '5px 10px', 
            borderRadius: '20px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'red', animation: 'pulse 1s infinite' }}></div>
          REC
        </div>
      )}
    </div>
  );
};

export default GrowingBall; 
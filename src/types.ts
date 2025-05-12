export interface GameProps {
  isPlaying: boolean;
  onGameEnd?: () => void;
}

export enum GameType {
  GROWING_BALL = 'growing-ball',
  ROTATING_CIRCLE = 'rotating-circle',
  ESCAPING_BALL = 'escaping-ball',
  MULTIPLYING_BALLS = 'multiplying-balls',
  TRAIL_BALL = 'trail-ball',
  PAINTING_BALL = 'painting-ball',
  DOMINO_SOUND = 'domino-sound',
  ROTATING_MAZE = 'rotating-maze',
  MAGNETIC_BALL = 'magnetic-ball',
  COLLAPSING_CIRCLES = 'collapsing-circles',
  COLLAPSING_ROTATING_CIRCLES = 'collapsing-rotating-circles'
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Ball {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  radius: number;
  color: string;
}

export interface GameState {
  balls: Ball[];
  score: number;
  gameOver: boolean;
} 
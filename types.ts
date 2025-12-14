import { Vector3, Color } from 'three';

export enum AppState {
  TREE = 'TREE',
  SCATTER = 'SCATTER',
  INSPECT = 'INSPECT'
}

export type ItemType = 'sphere' | 'box' | 'photo' | 'star';

export interface SceneItem {
  id: string;
  type: ItemType;
  treePos: Vector3;
  scatterPos: Vector3;
  rotation: Vector3;
  color?: Color;
  textureUrl?: string; // For photos
  scale: number;
}

export interface HandGestureData {
  isFist: boolean;
  isOpen: boolean;
  isPinching: boolean;
  isPointing: boolean; // New gesture
  handPosition: { x: number; y: number }; // Normalized 0-1
}
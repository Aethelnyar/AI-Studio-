import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { Environment, Float, Stars, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppState, SceneItem, HandGestureData } from '../types';

// Constants
const TREE_HEIGHT = 16;
const TREE_RADIUS_BASE = 6.0;
const ORNAMENT_COUNT = 300; 
const FOIL_COUNT = 200; 
const RIBBON_PARTICLE_COUNT = 400; 
const LIGHT_COUNT = 100; 
const SCATTER_RADIUS_X = 45; 
const SCATTER_RADIUS_Y = 25;
const SCATTER_RADIUS_Z = 20;

// Color Palette Definition (Nostalgic Winter)
const PALETTE = {
    TWILIGHT: '#2d2436', // Background
    RED: '#C41E3A',       // Cardinal Red
    GOLD: '#FFD700',      // Glowing Gold (Used for lights/sparks)
    METALLIC_GOLD: '#CFB53B', // Real Metallic Gold (Darker base for reflection)
    SILVER: '#E0E0E0',    // Shimmering Silver
    GREEN: '#1B4D3E',     // Evergreen
    CREAM: '#F2E8C9',     // Vintage Cream/Paper
    LIGHT_WARM: '#ffddaa', // Warm Light
    DEEP_BLUE: '#0033FF'   // Deep Royal Blue
};

// --- Sub-components ---

// Real 3D Star Geometry
const StarTopper = ({ position }: { position: THREE.Vector3 }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 1.4;
    const innerRadius = 0.6;
    
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2; // Rotate to point up
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }, []);

  const extrudeSettings = { depth: 0.4, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 };

  useFrame((state, delta) => {
    if (meshRef.current) {
        meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.2}>
      <mesh ref={meshRef} position={position} rotation={[0, 0, 0]}>
        <extrudeGeometry args={[starShape, extrudeSettings]} />
        <meshStandardMaterial 
            color={PALETTE.GOLD} 
            emissive={PALETTE.GOLD}
            emissiveIntensity={2}
            roughness={0.1}
            metalness={1}
        />
        <pointLight color="#ffaa00" intensity={15} distance={30} decay={2} />
      </mesh>
    </Float>
  );
};

// --- Photo Component ---
const PhotoPanel = ({ url, isFocused }: { url: string, isFocused: boolean }) => {
    const texture = useLoader(THREE.TextureLoader, url);
    
    return (
        <group>
            {/* Frame Box */}
            <mesh position={[0, 0, -0.02]}>
                <boxGeometry args={[2.5, 3.5, 0.1]} />
                <meshStandardMaterial color="#fdfdfd" roughness={0.6} metalness={0.1} />
            </mesh>

            {/* Photo Plane */}
            <mesh position={[0, 0, 0.06]}>
                <planeGeometry args={[2.3, 3.3]} />
                <meshBasicMaterial 
                    map={texture} 
                    side={THREE.DoubleSide} 
                    toneMapped={false} 
                />
            </mesh>
            
            {/* Highlight Halo */}
            {isFocused && (
                 <mesh position={[0, 0, -0.08]}>
                    <planeGeometry args={[2.9, 3.9]} />
                    <meshBasicMaterial color={PALETTE.GOLD} transparent opacity={0.5} />
                 </mesh>
            )}
        </group>
    );
};

interface ItemProps {
  item: SceneItem;
  targetMode: AppState;
  gesture: HandGestureData;
  focusId: string | null;
  onSelect: (id: string) => void;
}

const MagicItem: React.FC<ItemProps> = ({ item, targetMode, gesture, focusId, onSelect }) => {
  const meshRef = useRef<any>(null);
  const { camera } = useThree(); 
  
  const randomOffset = useMemo(() => Math.random() * 100, []);
  const twinkleSpeed = useMemo(() => Math.random() * 3 + 2, []);

  // Material helpers
  const isMetallicGold = useMemo(() => item.color && item.color.getHexString() === new THREE.Color(PALETTE.METALLIC_GOLD).getHexString(), [item.color]);
  const isSilver = useMemo(() => item.color && item.color.getHexString() === new THREE.Color(PALETTE.SILVER).getHexString(), [item.color]);
  const isFoil = item.id.includes('foil');
  const isLight = item.id.includes('light');
  const isRibbon = item.id.includes('ribbon');
  const isPhoto = item.type === 'photo';
  
  // Matte texture for Cream/Green
  const isMatte = useMemo(() => {
      if (!item.color) return false;
      const c = item.color.getHexString();
      return c === new THREE.Color(PALETTE.CREAM).getHexString() || 
             c === new THREE.Color(PALETTE.GREEN).getHexString();
  }, [item.color]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // 1. Position Interpolation
    let targetPos = item.treePos;
    
    if (targetMode === AppState.SCATTER) {
        targetPos = item.scatterPos;
    } else if (targetMode === AppState.INSPECT) {
        if (item.type === 'photo') {
             if (focusId === item.id) {
                targetPos = new THREE.Vector3(0, 0, 15); 
             } else {
                targetPos = item.scatterPos.clone().multiplyScalar(1.2);
                targetPos.z -= 10;
             }
        } else {
            targetPos = item.scatterPos.clone();
        }
    }

    meshRef.current.position.lerp(targetPos, delta * 3.0);

    // 2. Rotation & Scale
    if (item.type === 'photo') {
        meshRef.current.lookAt(camera.position);

        if (targetMode === AppState.INSPECT && item.id === focusId) {
             meshRef.current.scale.lerp(new THREE.Vector3(2.0, 2.0, 2.0), delta * 3);
        } else {
             meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), delta * 3);
        }
    } else {
        meshRef.current.rotation.x += 0.005;
        meshRef.current.rotation.y += 0.01;
        meshRef.current.scale.lerp(new THREE.Vector3(item.scale, item.scale, item.scale), delta * 4.0);
    }
    
    // Add subtle noise movement in SCATTER mode
    if (targetMode === AppState.SCATTER) {
        const time = state.clock.elapsedTime;
        meshRef.current.position.y += Math.sin(time + randomOffset) * 0.02;
        meshRef.current.position.x += Math.cos(time * 0.5 + randomOffset) * 0.02;

        if (item.type !== 'photo') {
             const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
             if (mat) {
                // Lights twinkle heavily, Metallic items glimmer slightly
                const sineWave = Math.sin(time * twinkleSpeed + randomOffset);
                const flash = sineWave > 0.8 ? 2.0 : 0.0;
                
                const foilBonus = isFoil ? 2.0 : 0;
                
                // Base Emissive Calculation
                let baseEmissive = 0;
                if (isLight) baseEmissive = 4.0;
                else if (isRibbon) baseEmissive = 3.0;
                else if (isMetallicGold || isSilver) baseEmissive = 0.2; // LOW emissive for metal to allow reflection
                else if (isMatte) baseEmissive = 0.1;
                else baseEmissive = 0.6;

                // Add flash only to lights or foils, not solid metal balls
                const dynamicFlash = (isLight || isFoil) ? flash : 0;

                mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, baseEmissive + dynamicFlash + foilBonus, 0.1);
             }
        }
    } else {
        // Steady state emissive
        if (item.type !== 'photo') {
            const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
            if (mat) {
                let targetEmissive = 0.5;
                if (isLight) targetEmissive = 4.0;
                else if (isRibbon) targetEmissive = 3.0;
                else if (isFoil) targetEmissive = 1.5;
                else if (isMetallicGold || isSilver) targetEmissive = 0.2; // Metal stays dark to reflect
                else if (isMatte) targetEmissive = 0.1;

                mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetEmissive, 0.1);
            }
        }
    }
  });

  const handlePointerDown = (e: any) => {
      if (isPhoto) {
          e.stopPropagation();
          onSelect(item.id);
      }
  };

  const handlePointerOver = (e: any) => {
      if (isPhoto) {
          document.body.style.cursor = 'pointer';
      }
  };
  
  const handlePointerOut = (e: any) => {
      if (isPhoto) {
          document.body.style.cursor = 'default';
      }
  };

  if (isPhoto && item.textureUrl) {
    return (
        <group 
            ref={meshRef} 
            onClick={handlePointerDown} 
            onPointerOver={handlePointerOver} 
            onPointerOut={handlePointerOut}
        >
            <PhotoPanel url={item.textureUrl} isFocused={focusId === item.id} />
        </group>
    );
  }

  const materialColor = item.color || new THREE.Color('#ffffff');

  // Material Logic
  // Metallic items: Gold, Silver, Foil, Ribbon
  const isMetallic = isMetallicGold || isSilver || isFoil || isRibbon;
  
  const roughness = isMetallic ? 0.15 : (isMatte ? 0.8 : 0.2);
  const metalness = isMetallic ? 1.0 : (isMatte ? 0.0 : (isLight ? 0.0 : 0.8));
  const clearcoat = (isMatte || isLight) ? 0.0 : 1.0;

  // Initial Emissive
  const initialEmissive = isLight ? 4.0 : (isRibbon ? 3.0 : (isFoil ? 1.0 : (isMetallic ? 0.2 : 0.4)));

  // Geometry Selection
  let GeometryComponent = <boxGeometry args={[item.scale, item.scale, item.scale]} />;
  if (item.type === 'sphere') GeometryComponent = <sphereGeometry args={[item.scale, 32, 32]} />;
  if (isFoil) GeometryComponent = <boxGeometry args={[item.scale, item.scale, 0.05]} />; 

  return (
    <mesh ref={meshRef}>
      {GeometryComponent}
      <meshPhysicalMaterial 
        color={materialColor} 
        roughness={roughness} 
        metalness={metalness}
        emissive={materialColor}
        emissiveIntensity={initialEmissive}
        clearcoat={clearcoat}
        clearcoatRoughness={0.1}
      />
    </mesh>
  );
};

// --- Main Camera Controller ---
const CameraController = ({ mode, gesture, focusTarget }: { mode: AppState, gesture: HandGestureData, focusTarget: THREE.Vector3 | null }) => {
    const { camera } = useThree();
    
    useFrame((state, delta) => {
        let targetPos = new THREE.Vector3(0, 0, 32); 
        let lookAtPos = new THREE.Vector3(0, 0, 0);

        if (mode === AppState.TREE) {
             const time = state.clock.elapsedTime;
             targetPos.set(Math.sin(time * 0.1) * 5, 0, 32);
        } else if (mode === AppState.SCATTER) {
            const azimuth = (gesture.handPosition.x - 0.5) * Math.PI * 1.5; 
            const height = (gesture.handPosition.y - 0.5) * 20;
            const radius = 35; 

            targetPos.set(
                Math.sin(azimuth) * radius,
                height,
                Math.cos(azimuth) * radius
            );
        } else if (mode === AppState.INSPECT) {
            targetPos.set(0, 0, 25);
        }

        camera.position.lerp(targetPos, delta * 2.0);
        camera.lookAt(lookAtPos);
    });

    return null;
}

// --- Scene Setup ---

interface SceneProps {
  appState: AppState;
  gesture: HandGestureData;
  photos: string[];
  focusId: string | null;
  onPhotoSelect: (id: string) => void;
}

export const MagicScene: React.FC<SceneProps> = ({ appState, gesture, photos, focusId, onPhotoSelect }) => {
  
  const items = useMemo(() => {
    const tempItems: SceneItem[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const layers = 5; 

    // 1. Standard Ornaments (Balls/Boxes)
    for (let i = 0; i < ORNAMENT_COUNT; i++) {
        const h_norm = i / ORNAMENT_COUNT; 
        const h = h_norm * TREE_HEIGHT - (TREE_HEIGHT / 2); 
        const layerPhase = (h_norm * layers) % 1; 
        const baseRadius = (1 - h_norm) * TREE_RADIUS_BASE;
        const layerKick = (1 - layerPhase) * 1.5; 
        const r = baseRadius + layerKick;
        const theta = i * goldenAngle;
        const treePos = new THREE.Vector3(r * Math.cos(theta), h, r * Math.sin(theta));
        const scatterPos = new THREE.Vector3(
            (Math.random() - 0.5) * SCATTER_RADIUS_X * 2,
            (Math.random() - 0.5) * SCATTER_RADIUS_Y * 2,
            (Math.random() - 0.5) * SCATTER_RADIUS_Z * 2
        );

        const colors = [
            new THREE.Color(PALETTE.RED),
            new THREE.Color(PALETTE.GREEN),
            new THREE.Color(PALETTE.METALLIC_GOLD), // Use the Metallic Gold here
            new THREE.Color(PALETTE.SILVER), 
        ];
        
        tempItems.push({
            id: `ornament-${i}`,
            type: Math.random() > 0.6 ? 'box' : 'sphere',
            treePos,
            scatterPos,
            rotation: new THREE.Vector3(Math.random(), Math.random(), Math.random()),
            color: colors[Math.floor(Math.random() * colors.length)],
            scale: Math.random() * 0.6 + 0.3 
        });
    }

    // 2. Gold & Silver Foil Flakes
    for (let i = 0; i < FOIL_COUNT; i++) {
        const h_norm = i / FOIL_COUNT; 
        const h = h_norm * TREE_HEIGHT - (TREE_HEIGHT / 2) + (Math.random() * 2 - 1); 
        const layerPhase = (h_norm * layers) % 1; 
        const baseRadius = (1 - h_norm) * TREE_RADIUS_BASE;
        const r = baseRadius + (Math.random() * 1.5) + 0.5; 
        const theta = i * goldenAngle * 2; 
        
        const treePos = new THREE.Vector3(r * Math.cos(theta), h, r * Math.sin(theta));
        const scatterPos = new THREE.Vector3(
            (Math.random() - 0.5) * SCATTER_RADIUS_X * 2.2,
            (Math.random() - 0.5) * SCATTER_RADIUS_Y * 2.2,
            (Math.random() - 0.5) * SCATTER_RADIUS_Z * 1.5
        );

        tempItems.push({
            id: `foil-${i}`,
            type: 'box', 
            treePos,
            scatterPos,
            rotation: new THREE.Vector3(Math.random(), Math.random(), Math.random()),
            color: Math.random() > 0.4 ? new THREE.Color(PALETTE.METALLIC_GOLD) : new THREE.Color(PALETTE.SILVER),
            scale: Math.random() * 0.4 + 0.2
        });
    }

    // 3. Ribbon 1: White (Braided)
    const ribbonSpirals = 5;
    const braidFreq = 30; // Frequency of the braid weave
    const braidAmp =0.4; // Amplitude of the braid (width of separation)

    for (let i = 0; i < RIBBON_PARTICLE_COUNT; i++) {
        const t = i / RIBBON_PARTICLE_COUNT;
        const h = (t * TREE_HEIGHT) - (TREE_HEIGHT / 2);
        const layerPhase = (t * layers) % 1;
        const baseRadius = (1 - t) * TREE_RADIUS_BASE;
        const layerKick = (1 - layerPhase) * 1.8; 
        const r = baseRadius + layerKick + 1.3; 

        // Base spiral path
        const baseTheta = t * Math.PI * 2 * ribbonSpirals;
        
        // Add Sine Wave offset for Braiding effect
        const theta = baseTheta + Math.sin(t * braidFreq) * braidAmp;

        const treePos = new THREE.Vector3(r * Math.cos(theta), h, r * Math.sin(theta));
        const scatterPos = new THREE.Vector3(
            (Math.random() - 0.5) * SCATTER_RADIUS_X * 2.5,
            (Math.random() - 0.5) * SCATTER_RADIUS_Y * 2,
            (Math.random() - 0.5) * SCATTER_RADIUS_Z
        );

        tempItems.push({
            id: `ribbon-white-${i}`,
            type: 'box', 
            treePos,
            scatterPos,
            rotation: new THREE.Vector3(t, t, 0),
            color: new THREE.Color('#FFFFFF'), 
            scale: 0.28 
        });
    }

    // 4. Ribbon 2: Deep Blue (Interlaced with White)
    for (let i = 0; i < RIBBON_PARTICLE_COUNT; i++) {
        const t = i / RIBBON_PARTICLE_COUNT;
        const h = (t * TREE_HEIGHT) - (TREE_HEIGHT / 2);
        const layerPhase = (t * layers) % 1;
        const baseRadius = (1 - t) * TREE_RADIUS_BASE;
        const layerKick = (1 - layerPhase) * 1.8; 
        const r = baseRadius + layerKick + 0.5; 

        // Base spiral path
        const baseTheta = t * Math.PI * 2 * ribbonSpirals;

        // Opposite Phase Sine Wave for Interlacing
        const theta = baseTheta - Math.sin(t * braidFreq) * braidAmp;
        
        const treePos = new THREE.Vector3(r * Math.cos(theta), h, r * Math.sin(theta));
        const scatterPos = new THREE.Vector3(
            (Math.random() - 0.5) * SCATTER_RADIUS_X * 2.5,
            (Math.random() - 0.5) * SCATTER_RADIUS_Y * 2,
            (Math.random() - 0.5) * SCATTER_RADIUS_Z
        );

        tempItems.push({
            id: `ribbon-blue-${i}`,
            type: 'box', 
            treePos,
            scatterPos,
            rotation: new THREE.Vector3(t, t, 10),
            color: new THREE.Color(PALETTE.DEEP_BLUE), 
            scale: 0.3
        });
    }

    // 5. Light Strip
    const lightSpirals = 4;
    for (let i = 0; i < LIGHT_COUNT; i++) {
        const t = i / LIGHT_COUNT;
        const h = (t * TREE_HEIGHT) - (TREE_HEIGHT / 2);
        const layerPhase = (t * layers) % 1;
        const baseRadius = (1 - t) * TREE_RADIUS_BASE;
        const layerKick = (1 - layerPhase) * 1.6;
        const r = baseRadius + layerKick + 0.2; 
        const theta = (t * Math.PI * 2 * lightSpirals) + Math.PI;
        const treePos = new THREE.Vector3(r * Math.cos(theta), h, r * Math.sin(theta));
        const scatterPos = new THREE.Vector3(
             (Math.random() - 0.5) * SCATTER_RADIUS_X * 2,
             (Math.random() - 0.5) * SCATTER_RADIUS_Y * 2,
             (Math.random() - 0.5) * SCATTER_RADIUS_Z
        );

        tempItems.push({
            id: `light-${i}`,
            type: 'sphere',
            treePos,
            scatterPos,
            rotation: new THREE.Vector3(0, 0, 0),
            color: new THREE.Color(PALETTE.LIGHT_WARM),
            scale: 0.2 
        });
    }

    return tempItems;
  }, []);

  const allItems = useMemo(() => {
    const photoItems: SceneItem[] = photos.map((url, i) => {
        // Tree Mode Calculations (Unchanged)
        const h = (i / (photos.length || 1)) * (TREE_HEIGHT * 0.8) - (TREE_HEIGHT / 3);
        const r = (1 - ((h + TREE_HEIGHT/2) / TREE_HEIGHT)) * (TREE_RADIUS_BASE + 2); 
        const theta = i * (Math.PI * 2 / (photos.length || 1)) + 1;
        
        // Scatter Mode Calculations (Updated: Smaller Cylindrical Ring)
        const scatterRadius = 12; // Reduced from 24 to 12 for better visibility
        const scatterAngle = (i / (photos.length || 1)) * Math.PI * 2;
        
        return {
            id: `photo-${i}`,
            type: 'photo',
            treePos: new THREE.Vector3(r * Math.cos(theta), h, r * Math.sin(theta)),
            // New Ring Arrangement
            scatterPos: new THREE.Vector3(
                Math.cos(scatterAngle) * scatterRadius,
                (Math.random() - 0.5) * 16, // Random vertical spread (-8 to 8)
                Math.sin(scatterAngle) * scatterRadius
            ),
            rotation: new THREE.Vector3(0,0,0),
            textureUrl: url,
            scale: 1,
            color: new THREE.Color(PALETTE.CREAM)
        };
    });
    return [...items, ...photoItems];
  }, [items, photos]);

  return (
    <Canvas shadows camera={{ position: [0, 0, 32], fov: 45 }}>
      {/* Background Color & Fog for Atmosphere */}
      <color attach="background" args={[PALETTE.TWILIGHT]} />
      <fog attach="fog" args={[PALETTE.TWILIGHT, 10, 60]} />

      <Suspense fallback={null}>
          <Environment preset="city" />
      </Suspense>
      
      {/* Warm, Nostalgic Lighting - Brightened Up */}
      <ambientLight intensity={0.8} color={PALETTE.TWILIGHT} />
      <pointLight position={[10, 10, 15]} intensity={5} color={PALETTE.LIGHT_WARM} />
      <pointLight position={[-15, -5, 10]} intensity={3} color={PALETTE.RED} />
      <spotLight position={[0, 20, 0]} angle={0.5} penumbra={1} intensity={5} color={PALETTE.GOLD} castShadow />
      
      {/* Background Elements */}
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
      <Sparkles count={400} scale={45} size={6} speed={0.3} opacity={0.5} color={PALETTE.GOLD} />
      <Sparkles count={200} scale={45} size={8} speed={0.2} opacity={0.3} color="#ffffff" />

      <CameraController mode={appState} gesture={gesture} focusTarget={null} />

      <StarTopper position={appState === AppState.TREE ? new THREE.Vector3(0, TREE_HEIGHT/2 + 0.8, 0) : new THREE.Vector3(0, 12, 0)} />

      <Suspense fallback={null}>
        <group>
            {allItems.map(item => (
                <MagicItem 
                    key={item.id} 
                    item={item} 
                    targetMode={appState} 
                    gesture={gesture} 
                    focusId={focusId}
                    onSelect={onPhotoSelect}
                />
            ))}
        </group>
      </Suspense>

      <Suspense fallback={null}>
        <EffectComposer enableNormalPass multisampling={0}>
            <Bloom luminanceThreshold={0.7} mipmapBlur intensity={1.8} radius={0.5} />
            <Vignette eskil={false} offset={0.1} darkness={0.4} />
            <Noise opacity={0.05} /> 
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
};
import React, { useEffect, useRef, useState } from 'react';
import { HandGestureData } from '../types';

// Declare globals loaded via script tags
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

interface Props {
  onGesture: (data: HandGestureData) => void;
}

const EyeIcon = ({ visible }: { visible: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {visible ? (
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        ) : (
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        )}
        {visible && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
    </svg>
);

export const HandController: React.FC<Props> = ({ onGesture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const videoElement = videoRef.current;
    
    // Safety check for MediaPipe global loading
    const checkLibs = setInterval(() => {
      if (window.Hands && window.Camera) {
        clearInterval(checkLibs);
        initMediaPipe();
      }
    }, 100);

    const initMediaPipe = () => {
      const hands = new window.Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults(onResults);

      const camera = new window.Camera(videoElement, {
        onFrame: async () => {
          if (videoElement.videoWidth) {
             await hands.send({ image: videoElement });
          }
        },
        width: 320,
        height: 240,
      });

      camera.start()
        .then(() => setLoaded(true))
        .catch((err: any) => console.error("Camera error:", err));
    };

    return () => clearInterval(checkLibs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onResults = (results: any) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Heuristics for gestures
      const isFist = detectFist(landmarks);
      const isOpen = detectOpenPalm(landmarks);
      const isPinching = detectPinch(landmarks);
      const isPointing = detectPointing(landmarks);
      
      // Normalize hand center (using wrist and middle finger base)
      const wrist = landmarks[0];
      const middle = landmarks[9];
      const centerX = (wrist.x + middle.x) / 2;
      const centerY = (wrist.y + middle.y) / 2;

      onGesture({
        isFist,
        isOpen,
        isPinching,
        isPointing,
        handPosition: { x: 1 - centerX, y: centerY }, // Mirror X
      });
    } else {
        // No hand detected
        onGesture({ isFist: false, isOpen: false, isPinching: false, isPointing: false, handPosition: { x: 0.5, y: 0.5 }});
    }
  };

  // --- Geometry Helpers ---
  
  const detectFist = (lm: any[]) => {
    // Check if fingertips are below finger pip joints (basic check)
    // 8: Index Tip, 6: Index PIP. Y increases downwards in screen space
    const fingersFolded = [8, 12, 16, 20].every(tipIdx => {
       return lm[tipIdx].y > lm[tipIdx - 2].y;
    });
    // Thumb is tricky, ignore for basic fist or check x distance
    return fingersFolded;
  };

  const detectOpenPalm = (lm: any[]) => {
    // Check if fingertips are above PIP joints
    const fingersOpen = [8, 12, 16, 20].every(tipIdx => {
        return lm[tipIdx].y < lm[tipIdx - 2].y;
    });
    return fingersOpen;
  };

  const detectPinch = (lm: any[]) => {
    // Distance between Index Tip (8) and Thumb Tip (4)
    const dx = lm[8].x - lm[4].x;
    const dy = lm[8].y - lm[4].y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    return dist < 0.05; // Threshold
  };

  const detectPointing = (lm: any[]) => {
    // Index finger (8) is extended (Tip above PIP)
    const indexExtended = lm[8].y < lm[6].y;
    
    // Other fingers are folded (Tip below PIP)
    const middleFolded = lm[12].y > lm[10].y;
    const ringFolded = lm[16].y > lm[14].y;
    const pinkyFolded = lm[20].y > lm[18].y;

    return indexExtended && middleFolded && ringFolded && pinkyFolded;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${isVisible ? 'w-32 h-24 bg-black/50 border-gold-500' : 'w-8 h-8 bg-transparent border-transparent'} rounded-lg overflow-hidden border-2 shadow-lg backdrop-blur`}>
      
      {!loaded && isVisible && <div className="absolute inset-0 flex items-center justify-center text-xs text-gold-300">Loading AI...</div>}
      
      {/* Video Element - Only visual opacity changes, element remains for processing */}
      <video 
        ref={videoRef} 
        className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${isVisible ? 'opacity-50' : 'opacity-0'}`} 
        playsInline 
      />
      
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Toggle Button */}
      <button 
        onClick={() => setIsVisible(!isVisible)}
        className="absolute top-1 right-1 z-50 text-white/70 hover:text-[#FFD700] transition-colors p-1 rounded-full bg-black/20 hover:bg-black/50"
        title={isVisible ? "Hide Camera View" : "Show Camera View"}
      >
        <EyeIcon visible={isVisible} />
      </button>

      {/* Red Dot Indicator (Active) */}
      {loaded && isVisible && <div className="absolute top-1 left-1 w-2 h-2 bg-red-500 rounded-full animate-pulse pointer-events-none" />}
    </div>
  );
};
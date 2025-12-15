import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HandController } from './components/HandController';
import { MagicScene } from './components/MagicScene';
import { AppState, HandGestureData } from './types';

// Constants
// ---------------------------------------------------------------------------
// 部署说明 (DEPLOYMENT INSTRUCTIONS):
// 1. 在您的项目文件夹中放入一个名为 "music.mp3" 的文件 (与 index.html 同级)。
// 2. 代码会自动优先加载 "./music.mp3"。
// 3. 如果找不到本地文件 (例如在现在的预览环境中)，它会自动回退使用下面的 ONLINE_FALLBACK_URL。
// ---------------------------------------------------------------------------
const LOCAL_MUSIC_URL = "./music.mp3"; 
const ONLINE_FALLBACK_URL = "https://upload.wikimedia.org/wikipedia/commons/9/9b/We_Wish_You_A_Merry_Christmas.ogg";
const MAX_PHOTOS = 20;

// Icons
const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const MusicNoteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

const StatusItem = ({ active, label }: { active: boolean, label: string }) => (
  <div className={`flex items-center gap-3 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-40'}`}>
    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,215,0,0.8)] ${active ? 'bg-[#FFD700]' : 'bg-transparent border border-[#F2E8C9]'}`} />
    <span className="text-xs text-[#F2E8C9] tracking-widest font-light">{label}</span>
  </div>
);

const Instruction = ({ label, icon, desc, active }: { label: string, icon: string, desc: string, active: boolean }) => (
  <div className={`flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'opacity-100 scale-110' : 'opacity-50'}`}>
    <span className="text-2xl filter drop-shadow-md">{icon}</span>
    <span className={`text-[10px] uppercase tracking-widest font-bold ${active ? 'text-[#FFD700]' : 'text-[#F2E8C9]'}`}>{label}</span>
    <span className="text-[9px] text-[#F2E8C9]/70 font-light">{desc}</span>
  </div>
);

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.TREE);
  const [gestureData, setGestureData] = useState<HandGestureData>({
    isFist: false,
    isOpen: false,
    isPinching: false,
    isPointing: false,
    handPosition: { x: 0.5, y: 0.5 }
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  
  // Refs for gesture handler to avoid stale closures
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = photos; }, [photos]);

  const focusIdRef = useRef(focusId);
  useEffect(() => { focusIdRef.current = focusId; }, [focusId]);
  
  const wasPointingRef = useRef(false);

  // Audio State
  const [isMuted, setIsMuted] = useState(false); // Default to false (try to play)
  const [audioSrc, setAudioSrc] = useState(LOCAL_MUSIC_URL); // Start by trying local
  const audioRef = useRef<HTMLAudioElement>(null);

  // Text Message State
  const [inputText, setInputText] = useState("");
  const [userMessage, setUserMessage] = useState("");

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  // Cooldown to prevent gesture interference after UI clicks
  const gestureCooldownRef = useRef(0);

  const [showInstructions, setShowInstructions] = useState(true);

  // Auto-play on mount
  useEffect(() => {
      if (audioRef.current) {
          audioRef.current.volume = 0.5;
          // Attempt auto-play
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.log("Browser prevented auto-play. User interaction required.");
              setIsMuted(true); // Switch to muted state visually if auto-play fails
            });
          }
      }
  }, [audioSrc]); // Re-try autoplay if source changes (fallback)

  // Handle Mute Toggle
  useEffect(() => {
      if (audioRef.current) {
          audioRef.current.muted = isMuted;
          if (!isMuted) {
              const playPromise = audioRef.current.play();
               if (playPromise !== undefined) {
                playPromise.catch(e => console.error("Play failed", e));
              }
          }
      }
  }, [isMuted]);

  // Handle Audio Error (Fallback Logic)
  const handleAudioError = () => {
      if (audioSrc === LOCAL_MUSIC_URL) {
          console.log("Local music.mp3 not found, falling back to online music.");
          setAudioSrc(ONLINE_FALLBACK_URL);
      }
  };

  // Gesture State Logic Machine
  const handleGesture = useCallback((data: HandGestureData) => {
    // If cooldown is active, ignore gestures
    if (Date.now() < gestureCooldownRef.current) return;

    setGestureData(data);
    
    // Check if this is a "Fresh" point (started this frame)
    const isFreshPoint = data.isPointing && !wasPointingRef.current;
    wasPointingRef.current = data.isPointing;

    setAppState(prev => {
        // 1. Reset to Tree on Fist
        if (data.isFist) {
             setFocusId(null);
             setDeleteConfirm(false);
             return AppState.TREE;
        }

        // 2. Pointing -> Select a Random Photo & Inspect
        if (data.isPointing && photosRef.current.length > 0) {
            if (prev !== AppState.INSPECT || isFreshPoint) {
                const randomIdx = Math.floor(Math.random() * photosRef.current.length);
                setFocusId(`photo-${randomIdx}`);
                setDeleteConfirm(false);
                return AppState.INSPECT;
            }
            return AppState.INSPECT;
        }

        // 3. Open Hand -> Scatter / Expand
        if (data.isOpen) {
            if (prev === AppState.INSPECT) {
                setFocusId(null);
                setDeleteConfirm(false);
            }
            return AppState.SCATTER;
        }

        // 4. Pinch -> Fallback inspect
        if (prev === AppState.SCATTER && data.isPinching && photosRef.current.length > 0) {
             if (!focusIdRef.current) {
                 setFocusId(`photo-0`); 
                 setDeleteConfirm(false);
             }
             return AppState.INSPECT;
        }

        return prev;
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const remainingSlots = MAX_PHOTOS - photos.length;
      if (remainingSlots <= 0) {
          alert(`Photo gallery is full! Maximum ${MAX_PHOTOS} photos allowed.`);
          return;
      }
      
      let newFiles = Array.from(e.target.files);
      if (newFiles.length > remainingSlots) {
          alert(`Adding only ${remainingSlots} photos to stay within the limit of ${MAX_PHOTOS}.`);
          newFiles = newFiles.slice(0, remainingSlots);
      }

      const newPhotos = newFiles.map((file: File) => URL.createObjectURL(file));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };
  
  const handleMessageSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (inputText.trim()) {
          setUserMessage(inputText);
          setInputText("");
      } else {
          setUserMessage("");
      }
  };

  const toggleMute = () => {
      setIsMuted(!isMuted);
  };

  // Direct Click Selection
  const handlePhotoSelect = (id: string) => {
      setFocusId(id);
      setDeleteConfirm(false);
      setAppState(AppState.INSPECT);
  };

  const handleDeleteClick = () => {
    if (!deleteConfirm) {
        setDeleteConfirm(true);
        // Reset confirmation after 3 seconds if not confirmed
        setTimeout(() => setDeleteConfirm(false), 3000);
    } else {
        // Perform actual delete
        if (focusId && focusId.startsWith('photo-')) {
            const indexStr = focusId.split('-')[1];
            const index = parseInt(indexStr);
            if (!isNaN(index)) {
                const newPhotos = [...photos];
                newPhotos.splice(index, 1);
                setPhotos(newPhotos);
                setFocusId(null);
                setDeleteConfirm(false);
                setAppState(AppState.SCATTER);
                // Prevent gesture system from immediately triggering logic
                gestureCooldownRef.current = Date.now() + 2000;
            }
        }
    }
  };

  const handleCloseInspect = () => {
      setFocusId(null);
      setAppState(AppState.SCATTER);
      setDeleteConfirm(false);
      gestureCooldownRef.current = Date.now() + 1000;
  };

  const isInspectMode = appState === AppState.INSPECT;

  return (
    <div className="relative w-full h-screen bg-[#2d2436] overflow-hidden">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <MagicScene 
            appState={appState} 
            gesture={gestureData} 
            photos={photos} 
            focusId={focusId} 
            onPhotoSelect={handlePhotoSelect}
        />
      </div>

      {/* Embedded Background Audio with Fallback Error Handling */}
      <audio 
          ref={audioRef} 
          src={audioSrc} 
          loop 
          onError={handleAudioError}
      />

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none w-full h-full">
        
        {/* Title */}
        <div className="absolute top-8 left-8 pointer-events-auto">
            <h1 className="text-7xl cursive text-[#FFD700] drop-shadow-[0_3px_10px_rgba(0,0,0.5,0.5)]">
              Merry Christmas
            </h1>
            <p className="text-sm text-[#F2E8C9] font-light tracking-widest mt-2 ml-1 uppercase cinzel opacity-80">Interactive 3D Experience</p>
        </div>

        {/* Message Display */}
        {userMessage && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none z-20 px-8">
                <p className="text-[#F2E8C9]/80 text-lg md:text-xl font-light cinzel tracking-[0.5em] mb-4 uppercase drop-shadow-md animate-pulse">
                    A Wish For You
                </p>
                <h2 className="text-5xl md:text-7xl cursive text-[#FFD700] drop-shadow-[0_0_25px_rgba(255,215,0,0.8)] leading-tight animate-[fadeIn_1s_ease-out]">
                    {userMessage}
                </h2>
            </div>
        )}
          
        {/* Top Right Controls (Music & Photo) */}
        <div className="absolute top-8 right-8 flex flex-col items-end gap-5 pointer-events-auto">
            
            {/* 1. Music Toggle Button */}
            <button 
                onClick={toggleMute}
                className={`flex items-center justify-center w-14 h-14 rounded-full border transition-all duration-500 shadow-xl backdrop-blur-md z-50
                    ${!isMuted 
                        ? 'bg-[#FFD700]/20 border-[#FFD700] text-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.5)] animate-[spin_4s_linear_infinite]' 
                        : 'bg-[#2d2436]/60 border-[#F2E8C9]/30 text-[#F2E8C9]/30'
                    }`}
                title={isMuted ? "Click to Play Music" : "Click to Mute"}
            >
                <MusicNoteIcon />
                {!isMuted && (
                    <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD700] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FFD700]"></span>
                    </span>
                )}
            </button>

             {/* 2. Photo Upload Button (Camera Icon) */}
            <label 
                className="relative flex items-center justify-center w-14 h-14 rounded-full border border-[#F2E8C9]/30 bg-[#2d2436]/40 hover:bg-[#F2E8C9]/10 hover:border-[#FFD700] hover:text-[#FFD700] text-[#F2E8C9] transition-all duration-300 shadow-lg backdrop-blur-md cursor-pointer group z-50"
                title={`Upload Photos (${photos.length}/${MAX_PHOTOS})`}
            >
                <CameraIcon />
                <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                
                {/* Count Badge */}
                {photos.length >= 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FFD700] text-[#2d2436] text-[10px] font-bold shadow-sm ring-2 ring-[#2d2436]">
                        {photos.length}
                    </span>
                )}
            </label>
        </div>

        {/* BOTTOM RIGHT AREA: Input + Hand Controller */}
        {/* Moved Input UP to bottom-36 to sit ABOVE the camera feed (which is bottom-4 + h-28 = ~8-9rem high) */}
        <div className="absolute bottom-36 right-4 pointer-events-auto z-40">
             {/* 3. Message Input (Moved to Bottom Right) */}
            <form onSubmit={handleMessageSubmit} className="relative flex items-center group h-12">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="写下你想说..."
                    className="bg-[#2d2436]/40 backdrop-blur-md border border-[#F2E8C9]/20 rounded-xl pl-5 pr-12 py-3 text-sm text-[#F2E8C9] placeholder-[#F2E8C9]/30 focus:outline-none focus:border-[#F2E8C9]/50 focus:bg-[#2d2436]/60 w-64 h-full shadow-lg transition-all duration-300"
                />
                <button type="submit" className="absolute right-3 text-[#F2E8C9]/60 hover:text-[#FFD700] transition-colors p-1" title="Send Wish">
                    <SendIcon />
                </button>
            </form>
        </div>

        {/* Photo Management Control (Visible only when Inspecting) */}
        {isInspectMode && focusId && focusId.startsWith('photo') && (
            <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 pointer-events-auto flex items-center gap-4 animate-[fadeIn_0.5s_ease-out] z-50">
                 <button 
                    onClick={handleDeleteClick}
                    className={`flex items-center gap-2 px-6 py-2 backdrop-blur-md border rounded-full transition-all shadow-lg group duration-300 ${
                        deleteConfirm 
                        ? 'bg-red-600/80 border-red-400 text-white scale-110' 
                        : 'bg-red-900/60 border-red-500/30 text-red-200 hover:bg-red-800/80 hover:text-white'
                    }`}
                 >
                     {deleteConfirm ? <CheckIcon /> : <TrashIcon />}
                     <span className="text-sm font-cinzel tracking-wider">
                        {deleteConfirm ? 'CONFIRM' : 'DELETE'}
                     </span>
                 </button>
                 <button 
                    onClick={handleCloseInspect}
                    className="flex items-center gap-2 px-6 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-[#F2E8C9]/30 rounded-full text-[#F2E8C9] hover:text-white transition-all shadow-lg"
                 >
                     <CloseIcon />
                     <span className="text-sm font-cinzel tracking-wider">CLOSE</span>
                 </button>
            </div>
        )}

        {/* Status Indicator */}
        <div className="absolute top-1/2 left-8 transform -translate-y-1/2 pointer-events-auto">
            <div className="flex flex-col gap-4">
                <StatusItem active={appState === AppState.TREE} label="ASSEMBLED" />
                <StatusItem active={appState === AppState.SCATTER} label="SCATTERED" />
                <StatusItem active={appState === AppState.INSPECT} label="FOCUSED" />
            </div>
        </div>

        {/* Footer Instructions - Completely HIDDEN in Inspect Mode */}
        <footer className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 transition-all duration-500 
            ${isInspectMode 
                ? 'opacity-0 translate-y-10 pointer-events-none' 
                : (showInstructions ? 'opacity-100 pointer-events-auto' : 'opacity-0 hover:opacity-100 pointer-events-auto')
            } 
            text-center z-20`}>
            <div className="inline-block bg-[#2d2436]/60 backdrop-blur-lg border border-[#F2E8C9]/10 rounded-xl p-6 shadow-xl">
                <div className="grid grid-cols-5 gap-8 text-center">
                    <Instruction label="Assemble" icon="✊" desc="Close Fist" active={gestureData.isFist} />
                    <Instruction label="Scatter" icon="🖐️" desc="Open Hand" active={gestureData.isOpen} />
                    <Instruction label="Random" icon="☝️" desc="Point Finger" active={gestureData.isPointing} />
                    <Instruction label="Select" icon="👆" desc="Click Photo" active={false} />
                    <Instruction label="Inspect" icon="🤏" desc="Pinch" active={gestureData.isPinching} />
                </div>
                <button 
                    onClick={() => setShowInstructions(false)} 
                    className="mt-4 text-xs text-[#F2E8C9]/60 hover:text-white underline"
                >
                    Hide Overlay
                </button>
            </div>
        </footer>

      </div>

      <HandController onGesture={handleGesture} />

    </div>
  );
};

export default App;
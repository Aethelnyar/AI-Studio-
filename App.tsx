import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HandController } from './components/HandController';
import { MagicScene } from './components/MagicScene';
import { AppState, HandGestureData } from './types';

// Built-in Christmas Playlist
const PLAYLIST = [
    { title: "Jingle Bells", src: "./bgm.mp3" },
    { title: "We Wish You a Merry Christmas", src: "https://upload.wikimedia.org/wikipedia/commons/9/9b/We_Wish_You_A_Merry_Christmas.ogg" },
    { title: "Silent Night", src: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Silent_Night_by_Kevin_MacLeod.ogg" }
];

// Icons
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const MusicIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
);

const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
);

const PauseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

const NextIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        <path d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" />
    </svg>
);

const PrevIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        <path d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10 3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" />
    </svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
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
  
  // Audio State
  const [trackIndex, setTrackIndex] = useState<number>(0); 
  const [audioSrc, setAudioSrc] = useState<string>(PLAYLIST[0].src);
  const [trackTitle, setTrackTitle] = useState<string>(PLAYLIST[0].title);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Text Message State
  const [inputText, setInputText] = useState("");
  const [userMessage, setUserMessage] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  // Auto-play when source changes
  useEffect(() => {
      if (isPlaying && audioRef.current) {
          audioRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
      }
  }, [audioSrc]);

  // Gesture State Logic Machine
  const handleGesture = useCallback((data: HandGestureData) => {
    setGestureData(data);

    setAppState(prev => {
        // 1. Reset to Tree on Fist
        if (data.isFist) {
             setFocusId(null);
             return AppState.TREE;
        }

        // 2. Pointing -> Select a Random Photo & Inspect
        if (data.isPointing && photos.length > 0) {
            // Only trigger if we aren't already focused or if we want to switch
            // To prevent flickering, we can check if we are already in INSPECT
            // But user said "When hand turns into pointing... picture is taken".
            // Let's assume if we are already INSPECTing, pointing keeps it or selects new if we were SCATTERED
            if (prev !== AppState.INSPECT) {
                const randomIdx = Math.floor(Math.random() * photos.length);
                setFocusId(`photo-${randomIdx}`);
                return AppState.INSPECT;
            }
            return AppState.INSPECT; // Stay in inspect if already there
        }

        // 3. Open Hand -> Scatter / Expand
        if (data.isOpen) {
            if (prev === AppState.INSPECT) {
                // If we were inspecting, go back to scatter (deselect)
                setFocusId(null);
            }
            return AppState.SCATTER;
        }

        // 4. Pinch -> Legacy inspect (keep for compatibility or remove if desired, let's keep as fallback)
        if (prev === AppState.SCATTER && data.isPinching && photos.length > 0) {
             if (!focusId) {
                 setFocusId(`photo-0`); // Default to first
             }
             return AppState.INSPECT;
        }

        return prev;
    });
  }, [photos, focusId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files).map((file: File) => URL.createObjectURL(file));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const audioUrl = URL.createObjectURL(e.target.files[0]);
        setAudioSrc(audioUrl);
        setTrackTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
        setTrackIndex(-1);
        setIsPlaying(true);
    }
  };

  const handleMessageSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (inputText.trim()) {
          // If there is text, show it
          setUserMessage(inputText);
          setInputText("");
      } else {
          // If input is empty and user submits, clear the message
          setUserMessage("");
      }
  };

  const togglePlay = () => {
      if (audioRef.current) {
          if (isPlaying) audioRef.current.pause();
          else audioRef.current.play();
          setIsPlaying(!isPlaying);
      }
  };

  const changeTrack = (direction: 'next' | 'prev') => {
      let newIndex = trackIndex;
      if (trackIndex === -1) {
          newIndex = 0;
      } else {
          if (direction === 'next') {
              newIndex = (trackIndex + 1) % PLAYLIST.length;
          } else {
              newIndex = (trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
          }
      }
      setTrackIndex(newIndex);
      setAudioSrc(PLAYLIST[newIndex].src);
      setTrackTitle(PLAYLIST[newIndex].title);
      if (!isPlaying) setIsPlaying(true);
  };

  return (
    <div className="relative w-full h-screen bg-[#2d2436] overflow-hidden">
      
      {/* 3D Scene Layer - Passing focusId down now */}
      <div className="absolute inset-0 z-0">
        <MagicScene appState={appState} gesture={gestureData} photos={photos} focusId={focusId} />
      </div>

      {/* Audio Element */}
      <audio ref={audioRef} src={audioSrc} loop />

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none w-full h-full">
        
        {/* Title (Top Left) */}
        <div className="absolute top-8 left-8 pointer-events-auto">
            <h1 className="text-7xl cursive text-[#FFD700] drop-shadow-[0_3px_10px_rgba(0,0,0.5,0.5)]">
              Merry Christmas
            </h1>
            <p className="text-sm text-[#F2E8C9] font-light tracking-widest mt-2 ml-1 uppercase cinzel opacity-80">Interactive 3D Experience</p>
        </div>

        {/* CENTERED USER MESSAGE DISPLAY (Seamless Floating) */}
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
          
        {/* Right Sidebar Controls */}
        <div className="absolute top-8 right-8 flex flex-col items-end gap-5 pointer-events-auto">
            
            {/* 1. Message Input */}
            <form onSubmit={handleMessageSubmit} className="relative flex items-center group h-12">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="写下你想说..."
                    className="bg-[#2d2436]/40 backdrop-blur-md border border-[#F2E8C9]/30 rounded-full pl-5 pr-10 py-3 text-sm text-[#F2E8C9] placeholder-[#F2E8C9]/50 focus:outline-none focus:border-[#FFD700] w-36 h-full shadow-lg transition-all duration-300 hover:bg-[#2d2436]/60"
                />
                <button type="submit" className="absolute right-3 text-[#FFD700] hover:text-white transition-colors p-1" title="Send or Clear">
                    <SendIcon />
                </button>
            </form>

            {/* 2. Photo Upload Button */}
            <label className="cursor-pointer group flex items-center justify-between bg-[#F2E8C9]/10 hover:bg-[#F2E8C9]/20 backdrop-blur-md px-5 rounded-full border border-[#F2E8C9]/20 transition-all shadow-lg w-26 h-12" title="Add Photo Memory">
                <span className="text-xs font-bold text-[#F2E8C9] group-hover:text-white uppercase tracking-wider">上传记忆</span>
                <span className="text-[#F2E8C9] group-hover:text-white"><UploadIcon /></span>
                <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>

            {/* 3. Compact Music Capsule */}
            <div className="flex items-center justify-between w-64 h-12 bg-[#2d2436]/70 backdrop-blur-md border border-[#FFD700]/30 px-4 rounded-full shadow-lg transition-all hover:bg-[#2d2436]/90">
                    {/* Visualizer & Controls */}
                    <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full bg-[#1B4D3E] ${isPlaying ? 'animate-pulse' : ''}`}></div>
                    <button onClick={() => changeTrack('prev')} className="text-[#FFD700] hover:text-white p-1"><PrevIcon /></button>
                    <button onClick={togglePlay} className="text-[#FFD700] hover:text-white p-1">{isPlaying ? <PauseIcon /> : <PlayIcon />}</button>
                    <button onClick={() => changeTrack('next')} className="text-[#FFD700] hover:text-white p-1"><NextIcon /></button>
                    </div>
                    
                    {/* Track Title */}
                    <span className="text-[10px] text-[#F2E8C9] uppercase tracking-widest font-bold truncate max-w-[80px] text-center select-none">
                    {trackTitle}
                    </span>

                    {/* Upload / Folder Trigger */}
                    <button 
                    onClick={() => audioInputRef.current?.click()} 
                    className="text-[#F2E8C9]/50 hover:text-[#FFD700] transition-colors p-1 border-l border-[#F2E8C9]/20 pl-3" 
                    title="Open Music from F:\mymusic..."
                    >
                    <MusicIcon className="w-4 h-4" />
                    </button>
                    <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
            </div>
        </div>

        {/* Status Indicator */}
        <div className="absolute top-1/2 left-8 transform -translate-y-1/2 pointer-events-auto">
            <div className="flex flex-col gap-4">
                <StatusItem active={appState === AppState.TREE} label="ASSEMBLED" />
                <StatusItem active={appState === AppState.SCATTER} label="SCATTERED" />
                <StatusItem active={appState === AppState.INSPECT} label="FOCUSED" />
            </div>
        </div>

        {/* Footer Instructions */}
        <footer className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 transition-opacity duration-500 ${showInstructions ? 'opacity-100' : 'opacity-0 hover:opacity-100'} pointer-events-auto text-center`}>
            <div className="inline-block bg-[#2d2436]/60 backdrop-blur-lg border border-[#F2E8C9]/10 rounded-xl p-6 shadow-xl">
                <div className="grid grid-cols-4 gap-8 text-center">
                    <Instruction label="Assemble" icon="✊" desc="Close Fist" active={gestureData.isFist} />
                    <Instruction label="Scatter" icon="🖐️" desc="Open Hand" active={gestureData.isOpen} />
                    <Instruction label="Select One" icon="☝️" desc="Point Finger" active={gestureData.isPointing} />
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

const StatusItem = ({ active, label }: { active: boolean, label: string }) => (
    <div className={`flex items-center gap-3 transition-all duration-500 ${active ? 'opacity-100 translate-x-2' : 'opacity-30'}`}>
        <div className={`w-2 h-2 rounded-full ${active ? 'bg-[#FFD700] shadow-[0_0_8px_#FFD700]' : 'bg-[#F2E8C9]/30'}`} />
        <span className={`cinzel text-sm tracking-widest ${active ? 'text-[#F2E8C9]' : 'text-[#F2E8C9]/50'}`}>{label}</span>
    </div>
);

const Instruction = ({ label, icon, desc, active }: { label: string, icon: string, desc: string, active: boolean }) => (
    <div className={`flex flex-col items-center gap-1 transition-transform duration-300 ${active ? 'scale-110 text-[#FFD700]' : 'text-[#F2E8C9]/60'}`}>
        <span className="text-3xl filter drop-shadow-lg">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        <span className="text-[10px] opacity-80 font-light">{desc}</span>
    </div>
);

export default App;

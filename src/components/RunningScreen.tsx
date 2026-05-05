/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  MapPin, 
  Navigation, 
  Search, 
  Radio, 
  AlertCircle,
  Map as MapIcon,
  ChevronRight,
  Sun,
  LayoutList,
  Minimize2,
  Monitor,
  Maximize2
} from 'lucide-react';
import { Trip, TripPoint, WeatherData } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface RunningScreenProps {
  trip: Trip;
  onEndTrip: () => void;
  onBack: () => void;
  onMinimize: () => void;
  onProgressUpdate: (progress: number) => void;
  initialProgress: number;
  onActivatePip: () => void;
  isVideoPipActive: boolean;
  userCoords: {lat: number, lng: number} | null;
}

export default function RunningScreen({ 
  trip, 
  onEndTrip, 
  onBack,
  onMinimize, 
  onProgressUpdate, 
  initialProgress,
  onActivatePip,
  isVideoPipActive,
  userCoords
}: RunningScreenProps) {
  const [currentProgress, setCurrentProgress] = useState(initialProgress); 
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  // Removed local notifications and geo states (Now in App.tsx)

  // Wake Lock Ref
  const wakeLockRef = React.useRef<any>(null);

  useEffect(() => {
    setCurrentProgress(initialProgress);
  }, [initialProgress]);

  const weatherToStatus = (weather?: WeatherData) => {
    if (!weather) return "Dados indisponíveis";
    const cond = weather.current.condition.toLowerCase();
    if (cond.includes('chuva') || cond.includes('tempestade') || cond.includes('chuvisco')) return "Chuva 🌧️";
    if (cond.includes('limpo') || cond.includes('sol') || cond.includes('ensolarado')) return "Sol ☀️";
    if (cond.includes('nuvem') || cond.includes('nublado') || cond.includes('encoberto')) return "Nublado ☁️";
    return cond.charAt(0).toUpperCase() + cond.slice(1);
  };

  // PERSISTENT STATUS BAR NOTIFICATION & MEDIA SESSION REMOVED (LIFTED TO APP)

  // Video PiP (Mobile Workaround) Rendering Removed (LIFTED TO APP)

  // Real Geolocation Tracking & Point Proximity REMOVED (LIFTED TO APP)

  // Sync progress to parent
  useEffect(() => {
    onProgressUpdate(currentProgress);
  }, [currentProgress, onProgressUpdate]);

  useEffect(() => {
    const currentDist = (currentProgress / 100) * trip.totalDistance;
    const nextPointIdx = trip.points.findIndex(p => p.distance > currentDist);
    if (nextPointIdx !== -1) {
       setCurrentPointIndex(Math.max(0, nextPointIdx - 1));
    }
  }, [currentProgress, trip.points, trip.totalDistance]);

  const currentDist = (currentProgress / 100) * trip.totalDistance;

  const handleFullRouteMaps = () => {
    const waypoints = trip.points
      .filter(p => p.distance > 0 && p.distance < trip.totalDistance)
      .map(p => `${p.location.lat},${p.location.lng}`)
      .join('|');
    
    // Using current location (if available) or current point as origin
    const origin = userCoords ? `${userCoords.lat},${userCoords.lng}` : `${trip.origin.lat},${trip.origin.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${trip.destination.lat},${trip.destination.lng}${waypoints ? `&waypoints=${waypoints}` : ''}`;
    window.open(url, '_blank');
  };

  const handleFuelSearch = () => {
    const query = encodeURIComponent("Posto Shell ou Petrobras");
    const lat = userCoords?.lat || trip.points[currentPointIndex].location.lat;
    const lng = userCoords?.lng || trip.points[currentPointIndex].location.lng;
    window.open(`https://www.google.com/maps/search/${query}/@${lat},${lng},14z`, '_blank');
  };

  const currentPoint = trip.points[currentPointIndex];
  const nextPoint = trip.points[currentPointIndex + 1];
  const progressPercent = currentProgress;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-neutral-950 flex flex-col p-4 space-y-6 relative overflow-hidden">
      {/* Notifications Overlay removed (LIFTED TO APP) */}
      <div className="hidden"></div>

      <header className="flex items-center justify-between pt-4 px-2">
         <div className="flex items-center gap-4">
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
             <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Viagem em Curso</span>
           </div>
           <button 
             onClick={onMinimize}
             className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-500 hover:text-white transition-colors"
             title="Minimizar para balão"
           >
             <Minimize2 size={16} />
           </button>
         </div>
         <button 
           onClick={onBack} 
           className="flex items-center gap-1 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
         >
           <ChevronLeft size={16} />
           Voltar
         </button>
      </header>

      {/* Top Section: Highlights */}
      <section className="space-y-4">
        <motion.div 
          layout
          className="bg-orange-600 rounded-3xl p-6 shadow-2xl shadow-orange-950/40 border border-orange-500 relative overflow-hidden"
        >
          {/* Subtle background bike icon */}
          <Radio className="absolute -right-4 -bottom-6 text-orange-400 opacity-20" size={140} />
          
          <div className="relative z-10 space-y-4">
             <div className="flex justify-between items-start">
                <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Passando por</span>
                <Navigation size={20} className="text-white/80" />
             </div>
             <div>
                <h2 className="text-2xl font-black tracking-tighter text-white line-clamp-2">{currentPoint?.location.name}</h2>
                <div className="flex items-center gap-4 mt-2">
                   <div className="flex items-center gap-1">
                      <MapPin size={14} className="text-white/60" />
                      <span className="text-sm font-medium text-white/80">Km {(currentProgress/100 * trip.totalDistance).toFixed(1)} / {trip.totalDistance.toFixed(0)}</span>
                   </div>
                </div>
             </div>
          </div>
        </motion.div>

        <motion.div 
          layout
          className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6"
        >
          <div className="flex justify-between items-center mb-4">
             <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Próxima Parada</span>
             <ChevronRight size={16} className="text-neutral-700" />
          </div>
          <div className="flex items-center justify-between">
             <div className="max-w-[70%]">
                <h3 className="text-lg font-bold text-white truncate">{nextPoint?.location.name || "Destino Final"}</h3>
                <p className="text-xs text-neutral-500">{(nextPoint?.distance ? (nextPoint.distance - currentDist) : (trip.totalDistance - currentDist)).toFixed(1)} km restantes</p>
             </div>
             <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                   <Sun size={20} className="text-orange-500" />
                   <span className="text-xl font-bold">{nextPoint?.weather?.current.temp.toFixed(0) || trip.points[trip.points.length-1].weather?.current.temp.toFixed(0)}°</span>
                </div>
             </div>
          </div>
        </motion.div>
      </section>

      {/* Middle Section: Progress */}
      <section className="flex-grow flex flex-col justify-center px-4">
         <div className="space-y-4">
            <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
               <span className="truncate max-w-[40%] text-left">{trip.origin.name.split('-')[0]}</span>
               <span className="truncate max-w-[40%] text-right">{trip.destination.name.split('-')[0]}</span>
            </div>
            <div className="h-4 bg-neutral-900 rounded-full border border-neutral-800 p-1 flex items-center">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${progressPercent}%` }}
                 className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.4)]"
               />
            </div>
            <div className="text-center font-bold text-sm text-neutral-400">
               {currentProgress.toFixed(1)}% Completo
            </div>
         </div>
      </section>

      {/* Bottom Section: Actions */}
      <section className="space-y-4 pb-8">
         <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={handleFullRouteMaps}
              className="flex flex-col items-center justify-center p-6 bg-neutral-900 border border-neutral-800 rounded-3xl gap-2 hover:bg-neutral-800 transition-colors"
            >
               <MapIcon size={24} className="text-orange-500" />
               <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">Rota Completa</span>
            </button>
            
            <button 
              onClick={handleFuelSearch}
              className="flex flex-col items-center justify-center p-6 bg-neutral-900 border border-neutral-800 rounded-3xl gap-2 hover:bg-neutral-800 transition-colors overflow-hidden relative"
            >
               <div className="absolute top-0 right-0 bg-green-500/10 text-green-500 px-2 py-1 text-[8px] font-bold rounded-bl-xl">POSTO</div>
               <Search size={24} className="text-blue-500" />
               <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">Buscar Shell/Petro</span>
            </button>
         </div>

         <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-3xl p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Controles Externos (Pinagem)</h4>
            <div className="grid grid-cols-1 gap-3">
               <button 
                 onClick={onActivatePip}
                 disabled={isVideoPipActive}
                 className={cn(
                   "flex items-center justify-center gap-2 py-4 rounded-2xl transition-all font-bold text-[11px] shadow-lg",
                   isVideoPipActive 
                     ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" 
                     : "bg-orange-600 hover:bg-orange-500 text-white animate-pulse"
                 )}
               >
                 <Monitor size={18} />
                 {isVideoPipActive ? "JANELA FLUTUANTE ATIVA" : "ATIVAR JANELA POP-UP"}
               </button>
            </div>
            {window.self !== window.top && (
               <p className="text-[8px] text-neutral-500 text-center italic">
                 Nota: O Modo Pop-up funciona melhor se abrir esta página em uma <b>Nova Aba</b>.
               </p>
            )}
         </div>
      </section>

      {/* Hidden elements removed (LIFTED TO APP) */}
    </div>
  );
}

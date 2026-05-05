/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ChevronLeft, 
  Map as MapIcon, 
  Route as RouteIcon, 
  Clock, 
  Fuel, 
  CreditCard,
  RefreshCcw,
  Play,
  Sun,
  Cloud,
  CloudRain,
  Zap,
  Snowflake,
  Wind,
  PlusCircle,
  Loader2,
  MapPin,
  X
} from 'lucide-react';
import { Trip, TripPoint, WeatherData } from '../types';
import { storageService } from '../services/storageService';
import { fetchWeather } from '../services/weatherService';
import { generateTripData, findNearestGasStation, findKmOnPath, findCoordinateAtKm, recalculateTimeline } from '../services/tripService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface TripOverviewProps {
  trip: Trip;
  onTripUpdate: (trip: Trip) => void;
  onStartTrip: () => void;
  onBack: () => void;
  isTripRunning: boolean;
  onOpenDashboard: () => void;
  isVideoPipActive: boolean;
  onActivatePip: () => void;
}

export default function TripOverviewScreen({ 
  trip, 
  onTripUpdate, 
  onStartTrip, 
  onBack,
  isTripRunning,
  onOpenDashboard,
  isVideoPipActive,
  onActivatePip
}: TripOverviewProps) {
  const [customKm, setCustomKm] = useState('');
  const [isAddingStop, setIsAddingStop] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const freshTrip = await generateTripData(trip.origin, trip.destination, trip.consumption);
      // Recalculate timeline with existing manual stops
      const currentManualStops = trip.points.filter(p => p.id.startsWith('custom-'));
      if (currentManualStops.length > 0) {
        freshTrip.points = await recalculateTimeline(freshTrip, currentManualStops);
      }
      onTripUpdate(freshTrip);
    } catch (error) {
      console.error('Refresh error:', error);
      alert('Erro ao atualizar a rota.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const openFullRoute = () => {
    // waypoint param for Google Maps: &waypoints=lat1,lng1|lat2,lng2
    const waypoints = trip.points
      .filter(p => p.id !== 'p-start' && p.id !== 'p-end')
      .map(p => `${p.location.lat},${p.location.lng}`)
      .join('|');
    
    // Using origin=My+Location ensures Google Maps offers the "Start" button for navigation
    // travelmode=two_wheeler selects motorcycle mode
    const url = `https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${trip.destination.lat},${trip.destination.lng}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=two_wheeler&dir_action=navigate`;
    window.open(url, '_blank');
  };

  const handleAddStop = async () => {
    const kmVal = customKm.replace(',', '.');
    const km = parseFloat(kmVal);
    if (isNaN(km) || km <= 0 || km >= trip.totalDistance) {
      alert(`KM inválido. Insira um valor numérico entre 1 e ${trip.totalDistance.toFixed(0)}`);
      return;
    }

    setIsAddingStop(true);
    try {
      // Find coordinates precisely at the requested KM
      const [lng, lat] = findCoordinateAtKm(km, trip.fullPath);

      const gasStation = await findNearestGasStation(lat, lng);

      if (!gasStation) {
        alert('Nenhum posto Shell ou Petrobras encontrado em um raio de 50km deste KM.');
        return;
      }

      // Calculate the ACTUAL cumulative KM along the path for the found gas station
      const actualKm = findKmOnPath(gasStation.lat, gasStation.lng, trip.fullPath, trip.totalDistance);

      const weather = await fetchWeather(gasStation.lat, gasStation.lng);

      // Ensure start date is valid
      const startEta = new Date(trip.points[0].eta);
      // Using 70km/h as average speed for ETA calculation
      const travelTimeMs = (actualKm / 70) * 3600000;
      const newEta = new Date(startEta.getTime() + travelTimeMs);

      const newPoint: TripPoint = {
        id: `custom-${Date.now()}`,
        distance: actualKm,
        location: {
          name: `${gasStation.name} (Km ${actualKm.toFixed(0)})`,
          lat: gasStation.lat,
          lng: gasStation.lng
        },
        eta: newEta,
        weather
      };

      const manualStops = [...trip.points.filter(p => p.id.startsWith('custom-')), newPoint];
      const recalculatedPoints = await recalculateTimeline(trip, manualStops);
      
      onTripUpdate({ ...trip, points: recalculatedPoints });
      setCustomKm('');
    } catch (error) {
      console.error('Error adding stop:', error);
      alert('Erro ao buscar posto ou calcular rota.');
    } finally {
      setIsAddingStop(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-neutral-950 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-xl border-bottom border-neutral-800 px-4 py-4 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-grow">
          <h1 className="font-bold text-lg truncate leading-tight">{trip.destination.name}</h1>
          <p className="text-xs text-neutral-500 font-medium">Partindo de {trip.origin.name}</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">
        {/* SECTION 1: RESUMO */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Resumo da Viagem</h2>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 text-[10px] font-bold text-orange-500 uppercase tracking-tighter hover:text-orange-400 disabled:text-neutral-600 transition-colors"
            >
              <RefreshCcw size={12} className={cn(isRefreshing && "animate-spin")} />
              {isRefreshing ? "Atualizando..." : "Recalcular"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard icon={<RouteIcon size={18} className="text-orange-500" />} label="Distância" value={`${trip.totalDistance.toFixed(0)} km`} />
            <SummaryCard icon={<Clock size={18} className="text-blue-500" />} label="Tempo Est." value={formatDuration(trip.totalDuration)} />
            <SummaryCard icon={<Fuel size={18} className="text-green-500" />} label="Combustível" value={`R$ ${trip.totalFuelCost.toFixed(2)}`} />
            <SummaryCard icon={<CreditCard size={18} className="text-purple-500" />} label="Pedágios" value={`R$ ${trip.totalTolls.toFixed(2)}`} />
          </div>
        </section>

        {/* SECTION 2: ADICIONAR PARADA */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4 shadow-xl">
           <div className="flex items-center gap-2 mb-2">
             <PlusCircle size={18} className="text-orange-500" />
             <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest">Incluir Parada Manual</h3>
           </div>
           <div className="flex gap-2">
             <input 
               type="number"
               value={customKm}
               onChange={(e) => setCustomKm(e.target.value)}
               placeholder="Ex: 350 (KM)"
               className="flex-grow bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
             />
             <button 
               onClick={handleAddStop}
               disabled={isAddingStop || !customKm}
               className="px-6 bg-orange-600 rounded-xl font-bold text-xs uppercase tracking-widest disabled:bg-neutral-800 disabled:text-neutral-600 transition-all active:scale-95 flex items-center justify-center min-w-[100px]"
             >
               {isAddingStop ? <Loader2 className="animate-spin" size={16} /> : "Buscar Posto"}
             </button>
           </div>
           <p className="text-[10px] text-neutral-500 leading-relaxed">Irá buscar o posto Shell/Petrobras mais próximo ao KM indicado e adicionar à sua rota.</p>
        </section>

        {/* ROTAS BUTTON */}
        <section>
          <ActionButton 
            onClick={openFullRoute}
            icon={<MapIcon size={20} />}
            label="Abrir Rota com Paradas no Google Maps"
            fullWidth
          />
        </section>

        {/* MONITORING CONTROLS (PiP Activation) */}
        <section className="flex flex-col gap-4 pt-4">
          {!isTripRunning ? (
            <button 
              onClick={() => {
                storageService.saveTrip(trip);
                onStartTrip();
              }}
              className="flex flex-col items-center justify-center gap-1 py-5 bg-orange-600 rounded-3xl font-bold text-lg shadow-xl shadow-orange-900/30 hover:bg-orange-500 transition-all active:scale-[0.98] group"
            >
              <div className="flex items-center gap-3">
                <Play size={24} fill="white" className="group-hover:translate-x-1 transition-transform" />
                INICIAR MONITORAMENTO
              </div>
              <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest leading-none">Ativar Janela Pop-up</span>
            </button>
          ) : (
            <div className="flex flex-col gap-4">
              {!isVideoPipActive && (
                <button 
                  onClick={onActivatePip}
                  className="flex flex-col items-center justify-center gap-1 py-5 bg-orange-600/10 border border-orange-500/30 rounded-3xl font-bold text-lg text-orange-500 hover:bg-orange-600/20 transition-all active:scale-[0.98] group"
                >
                  <div className="flex items-center gap-3">
                    <Play size={24} fill="currentColor" className="group-hover:translate-x-1 transition-transform" />
                    REATIVAR JANELA POP-UP
                  </div>
                </button>
              )}
              
              <div className="bg-orange-600/10 border border-orange-500/20 rounded-3xl p-4 flex items-center justify-center gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Monitoramento Ativo</span>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 3: LISTA DE PONTOS */}
        <section className="space-y-6">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Timeline do Trajeto</h2>
          <div className="space-y-8 relative">
            {/* Vertical timeline line */}
            <div className="absolute left-6 top-4 bottom-4 w-px bg-neutral-800" />
            
            {trip.points.map((point, idx) => (
              <PointCard key={point.id} point={point} isLast={idx === trip.points.length - 1} />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

// Remove LayoutList import as it's no longer used

function SummaryCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-1">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-bold text-white tracking-tight leading-none">{value}</div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, fullWidth }: { icon: React.ReactNode, label: string, onClick: () => void, fullWidth?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-3 p-5 bg-neutral-900 border border-neutral-800 rounded-2xl hover:bg-neutral-800 transition-colors text-center",
        fullWidth ? "w-full" : "flex-1"
      )}
    >
      <div className="text-orange-500">{icon}</div>
      <span className="text-xs font-bold text-neutral-300 uppercase tracking-widest">{label}</span>
    </button>
  );
}

function PointCard({ point, isLast }: { point: TripPoint, isLast: boolean, key?: string }) {
  const weather = point.weather;
  const arrivalDate = point.eta;

  return (
    <div className="relative pl-14">
      {/* Connector Node */}
      <div className={cn(
        "absolute left-4 top-1 w-4 h-4 rounded-full border-2 z-10 transition-colors",
        point.distance === 0 ? "bg-orange-600 border-orange-400 shadow-lg shadow-orange-500/50" : "bg-neutral-950 border-neutral-700"
      )} />

      <div className="space-y-4">
        {/* Header Information */}
        <div className="flex justify-between items-start">
          <div className="flex-grow">
            <h3 className="font-bold text-lg text-white leading-tight">{point.location.name}</h3>
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
              <span>{point.distance.toFixed(0)} km acumulados</span>
              <span className="w-1 h-1 bg-neutral-700 rounded-full" />
              <span>Chegada às {format(arrivalDate, 'HH:mm')}</span>
            </div>
            
            <button 
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${point.location.lat},${point.location.lng}&travelmode=two_wheeler&dir_action=navigate`;
                window.open(url, '_blank');
              }}
              className="mt-2 flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase tracking-widest hover:text-orange-400 transition-colors"
            >
              <MapPin size={12} />
              Iniciar Rota até aqui
            </button>
          </div>
          <div className="text-right ml-4">
             <div className="text-xl font-bold text-orange-500">{weather?.current.temp.toFixed(1)}°</div>
             <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-tighter">{weather?.current.condition}</p>
          </div>
        </div>

        {/* Weather Highlights */}
        {weather && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-6">
            {/* Clima Atual + Chegada */}
            <div className="grid grid-cols-2 gap-4 border-b border-neutral-800 pb-4">
               <div className="space-y-1">
                 <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Clima Agora</p>
                 <div className="flex items-center gap-2">
                    <WeatherIcon code={weather.current.iconCode} size={20} className="text-orange-400" />
                    <span className="text-sm font-semibold">{weather.current.temp}°</span>
                 </div>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Previsão Chegada</p>
                 <div className="flex items-center gap-2">
                    {/* For simplicity we pick the closest hourly */}
                    <WeatherIcon code={weather.hourly[0].iconCode} size={20} className="text-blue-400" />
                    <span className="text-sm font-semibold">{weather.hourly[0].temp}°</span>
                 </div>
               </div>
            </div>

            {/* Previsão Hora a Hora (Horizontal Scroll) */}
            <div className="space-y-3">
               <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Previsão Hoje (hora a hora)</p>
               <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                  {weather.hourly.slice(0, 12).map((h, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 min-w-[40px]">
                      <span className="text-[10px] text-neutral-500 font-medium">{format(new Date(h.time!), 'HH:mm')}</span>
                      <WeatherIcon code={h.iconCode} size={18} className="text-neutral-400" />
                      <span className="text-xs font-bold">{h.temp.toFixed(0)}°</span>
                    </div>
                  ))}
               </div>
            </div>

            {/* Previsão 5 Dias */}
            <div className="space-y-3">
               <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Previsão Próximos 5 Dias</p>
               <div className="grid grid-cols-5 gap-2">
                  {weather.daily.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-neutral-500 font-medium">{format(new Date(d.date), 'EEE', { locale: ptBR })}</span>
                      <WeatherIcon code={d.iconCode} size={16} className="text-neutral-500" />
                      <span className="text-[10px] font-bold">{d.tempMax.toFixed(0)}°</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WeatherIcon({ code, size, className }: { code: number, size: number, className?: string }) {
  if (code === 0) return <Sun size={size} className={className} />;
  if (code >= 1 && code <= 3) return <Cloud size={size} className={className} />;
  if (code >= 51 && code <= 67) return <CloudRain size={size} className={className} />;
  if (code >= 80 && code <= 82) return <CloudRain size={size} className={className} />;
  if (code >= 95) return <Zap size={size} className={className} />;
  if (code >= 71 && code <= 77) return <Snowflake size={size} className={className} />;
  return <Wind size={size} className={className} />;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

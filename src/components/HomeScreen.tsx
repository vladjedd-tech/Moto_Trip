/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MapPin, Bike, ArrowRight, Gauge, Search, Loader2, Settings, Plus, Minus } from 'lucide-react';
import { Location, Trip, TripPoint, TripSegment, AppScreen } from '../types';
import { generateTripData } from '../services/tripService';
import { cn } from '../lib/utils';

interface HomeScreenProps {
  onTripGenerated: (trip: Trip) => void;
  onOpenSettings: () => void;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
}

const stateAbbreviationMap: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM',
  'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES',
  'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR',
  'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC',
  'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO'
};

import { storageService } from '../services/storageService';

export default function HomeScreen({ onTripGenerated, onOpenSettings }: HomeScreenProps) {
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [consumption, setConsumption] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  
  // Intermediate Stops
  const [intermediateStops, setIntermediateStops] = useState<{ query: string, location: Location | null, results: NominatimResult[] }[]>([]);

  const [originResults, setOriginResults] = useState<NominatimResult[]>([]);
  const [destResults, setDestResults] = useState<NominatimResult[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);

  // Search logic for intermediate stops
  const searchStop = async (query: string, index: number) => {
    if (query.length < 3) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`);
      const data = await response.json();
      setIntermediateStops(prev => {
        const newStops = [...prev];
        newStops[index].results = data;
        return newStops;
      });
    } catch (error) {
      console.error('Stop search error:', error);
    }
  };

  const addStop = () => {
    if (intermediateStops.length < 3) {
      setIntermediateStops([...intermediateStops, { query: '', location: null, results: [] }]);
    }
  };

  const removeStop = (index: number) => {
    setIntermediateStops(intermediateStops.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const timers = intermediateStops.map((stop, index) => {
      if (stop.query.length >= 3 && !stop.location && stop.results.length === 0) {
        return setTimeout(() => searchStop(stop.query, index), 500);
      }
      return null;
    });
    return () => timers.forEach(t => t && clearTimeout(t));
  }, [intermediateStops]);

  // nominatim search
  const searchCity = async (query: string, type: 'origin' | 'dest') => {
    if (query.length < 3) return;
    const setter = type === 'origin' ? setOriginResults : setDestResults;
    const loadingSetter = type === 'origin' ? setIsSearchingOrigin : setIsSearchingDest;
    
    loadingSetter(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`);
      const data = await response.json();
      setter(data);
    } catch (error) {
      console.error('Nominatim search error:', error);
    } finally {
      loadingSetter(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (originQuery && !origin) searchCity(originQuery, 'origin');
    }, 500);
    return () => clearTimeout(timer);
  }, [originQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (destQuery && !destination) searchCity(destQuery, 'dest');
    }, 500);
    return () => clearTimeout(timer);
  }, [destQuery]);

  const handleGenerateTrip = async () => {
    if (!origin || !destination || !consumption) return;
    setIsGenerating(true);

    try {
      const waypoints = intermediateStops
        .filter(s => s.location)
        .map(s => s.location as Location);

      const trip = await generateTripData(origin, destination, Number(consumption), waypoints);
      onTripGenerated(trip);
    } catch (error) {
      console.error('Generation error:', error);
      alert('Erro ao gerar viagem. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [savedSearch, setSavedSearch] = useState('');
  useEffect(() => {
    setSavedTrips(storageService.getSavedTrips());
  }, []);

  return (
    <div className="max-w-md mx-auto p-6 flex flex-col min-h-screen">
      <header className="flex items-center justify-between py-12">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-950/20">
            <Bike className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tighter text-white">RUMO</h1>
            <p className="text-xs uppercase tracking-widest text-neutral-500 font-bold">Estrada Livre</p>
          </div>
        </div>
        <button 
          onClick={onOpenSettings}
          className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-neutral-500 hover:text-white transition-colors active:scale-95"
        >
          <Settings size={20} />
        </button>
      </header>

      <main className="flex-grow flex flex-col gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 space-y-6">
            <h2 className="text-xl font-semibold mb-2">Planeje sua Rota</h2>
            
            <div className="space-y-4">
              <div className="space-y-2 relative">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Cidade de Origem</label>
                  {intermediateStops.length < 3 && (
                    <button 
                      onClick={addStop}
                      className="p-1.5 bg-orange-600/10 text-orange-500 rounded-lg hover:bg-orange-600/20 transition-all flex items-center gap-1"
                      title="Adicionar Parada"
                    >
                      <Plus size={12} />
                      <span className="text-[10px] font-bold uppercase">Parada</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500" size={18} />
                  <input
                    type="text"
                    value={originQuery}
                    onChange={(e) => {
                      setOriginQuery(e.target.value);
                      if (origin) setOrigin(null);
                    }}
                    placeholder="De onde você sai?"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-neutral-600"
                  />
                  {isSearchingOrigin && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-neutral-600" size={18} />}
                </div>
                {originResults.length > 0 && !origin && (
                  <ul className="absolute z-50 w-full mt-2 bg-neutral-800 border border-neutral-700 rounded-2xl p-2 shadow-2xl space-y-1">
                    {originResults.map((r) => {
                      const cityName = r.address?.city || r.address?.town || r.address?.village || r.display_name.split(',')[0];
                      const state = r.address?.state || '';
                      const stateAbbr = stateAbbreviationMap[state] || '';
                      const formattedName = stateAbbr ? `${cityName} - ${stateAbbr}` : cityName;
                      
                      return (
                        <li 
                          key={r.place_id} 
                          onClick={() => {
                            setOrigin({ name: formattedName, lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
                            setOriginQuery(formattedName);
                            setOriginResults([]);
                          }}
                          className="p-3 hover:bg-neutral-700 rounded-xl cursor-pointer text-sm line-clamp-1 transition-colors"
                        >
                          {r.display_name}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Intermediate Stops UI */}
              <AnimatePresence>
                {intermediateStops.map((stop, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, height: 0, margin: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, margin: 0 }}
                    className="space-y-2 relative"
                  >
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Parada {index + 1}</label>
                      <button 
                        onClick={() => removeStop(index)}
                        className="text-red-500/50 hover:text-red-500 p-1"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                      <input
                        type="text"
                        value={stop.query}
                        onChange={(e) => {
                          const newStops = [...intermediateStops];
                          newStops[index].query = e.target.value;
                          newStops[index].location = null;
                          newStops[index].results = []; // Clear results to trigger the useEffect search
                          setIntermediateStops(newStops);
                        }}
                        placeholder="Cidade de parada"
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-neutral-600"
                      />
                    </div>
                    {stop.results.length > 0 && !stop.location && (
                      <ul className="absolute z-50 w-full mt-2 bg-neutral-800 border border-neutral-700 rounded-2xl p-2 shadow-2xl space-y-1">
                        {stop.results.map((r) => {
                          const cityName = r.address?.city || r.address?.town || r.address?.village || r.display_name.split(',')[0];
                          const state = r.address?.state || '';
                          const stateAbbr = stateAbbreviationMap[state] || '';
                          const formattedName = stateAbbr ? `${cityName} - ${stateAbbr}` : cityName;
                          
                          return (
                            <li 
                              key={r.place_id} 
                              onClick={() => {
                                const newStops = [...intermediateStops];
                                newStops[index].location = { name: formattedName, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
                                newStops[index].query = formattedName;
                                newStops[index].results = [];
                                setIntermediateStops(newStops);
                              }}
                              className="p-3 hover:bg-neutral-700 rounded-xl cursor-pointer text-sm line-clamp-1 transition-colors"
                            >
                              {r.display_name}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              <div className="space-y-2 relative">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Cidade de Destino</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 opacity-50" size={18} />
                  <input
                    type="text"
                    value={destQuery}
                    onChange={(e) => {
                      setDestQuery(e.target.value);
                      if (destination) setDestination(null);
                    }}
                    placeholder="Para onde você vai?"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-neutral-600"
                  />
                  {isSearchingDest && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-neutral-600" size={18} />}
                </div>
                {destResults.length > 0 && !destination && (
                  <ul className="absolute z-50 w-full mt-2 bg-neutral-800 border border-neutral-700 rounded-2xl p-2 shadow-2xl space-y-1">
                    {destResults.map((r) => {
                      const cityName = r.address?.city || r.address?.town || r.address?.village || r.display_name.split(',')[0];
                      const state = r.address?.state || '';
                      const stateAbbr = stateAbbreviationMap[state] || '';
                      const formattedName = stateAbbr ? `${cityName} - ${stateAbbr}` : cityName;

                      return (
                        <li 
                          key={r.place_id} 
                          onClick={() => {
                            setDestination({ name: formattedName, lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
                            setDestQuery(formattedName);
                            setDestResults([]);
                          }}
                          className="p-3 hover:bg-neutral-700 rounded-xl cursor-pointer text-sm line-clamp-1 transition-colors"
                        >
                          {r.display_name}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Consumo da Moto (km/L)</label>
                <div className="relative">
                  <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                  <input
                    type="number"
                    value={consumption}
                    onChange={(e) => setConsumption(e.target.value)}
                    placeholder="Ex: 18"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-neutral-600"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerateTrip}
          disabled={!origin || !destination || !consumption || isGenerating}
          className={cn(
            "w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98]",
            isGenerating || !origin || !destination || !consumption
              ? "bg-neutral-800 text-neutral-600 cursor-not-allowed"
              : "bg-orange-600 text-white shadow-lg shadow-orange-900/20 hover:bg-orange-500"
          )}
        >
          {isGenerating ? <Loader2 className="animate-spin" size={24} /> : <>Gerar Viagem <ArrowRight size={20} /></>}
        </button>

        {/* Saved Trips Section */}
        {savedTrips.length > 0 && (
          <section className="space-y-4 pt-4">
             <div className="flex justify-between items-center px-1">
               <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Minhas Rotas</h3>
               <button onClick={() => {
                 localStorage.removeItem('rumo_saved_trips');
                 setSavedTrips([]);
               }} className="text-[10px] text-red-500 uppercase font-bold tracking-tighter">Limpar</button>
             </div>

             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
               <input 
                 type="text"
                 placeholder="Buscar rota salva..."
                 value={savedSearch}
                 onChange={(e) => setSavedSearch(e.target.value)}
                 className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-orange-500 outline-none"
               />
             </div>

             <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
               {savedTrips
                 .filter(t => 
                   t.destination.name.toLowerCase().includes(savedSearch.toLowerCase()) || 
                   t.origin.name.toLowerCase().includes(savedSearch.toLowerCase())
                 )
                 .map(trip => (
                 <div 
                   key={trip.id} 
                   onClick={() => onTripGenerated(trip)}
                   className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-neutral-800 transition-colors"
                 >
                   <div>
                     <p className="font-bold text-white text-sm">{trip.destination.name.split(',')[0]}</p>
                     <p className="text-[10px] text-neutral-500">{trip.totalDistance.toFixed(0)} km • {trip.origin.name.split(',')[0]}</p>
                   </div>
                   <MapPin size={16} className="text-orange-500" />
                 </div>
               ))}
             </div>
          </section>
        )}
      </main>

      <footer className="py-8 text-center">
        <p className="text-xs text-neutral-600 font-medium uppercase tracking-[0.2em]">Rumo &copy; 2026 • Premium Experience</p>
      </footer>
    </div>
  );
}

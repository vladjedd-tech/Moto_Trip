/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import { AppScreen, Trip, WeatherData } from './types';
import HomeScreen from './components/HomeScreen';
import TripOverviewScreen from './components/TripOverviewScreen';
import RunningScreen from './components/RunningScreen';
import NotificationSettings from './components/NotificationSettings';
import { fetchWeather } from './services/weatherService';
import { storageService } from './services/storageService';

// Distance helper
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function App() {
  const persisted = storageService.getPersistedAppState();
  
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(
    (persisted?.screen as AppScreen) || AppScreen.HOME
  );
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(persisted?.trip || null);
  const [tripProgress, setTripProgress] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTripRunning, setIsTripRunning] = useState(false);

  // TRACKING STATES
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [notifiedPoints, setNotifiedPoints] = useState<Set<string>>(new Set());
  const [showNotifications, setShowNotifications] = useState<string[]>([]);
  const wakeLockRef = useRef<any>(null);

  // EXTERNAL DISPLAY STATES (Lifted)
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isVideoPipActive, setIsVideoPipActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    storageService.persistAppState(currentScreen, currentTrip);
  }, [currentScreen, currentTrip]);

  const triggerNotification = async (msg: string) => {
    setShowNotifications(prev => [...prev, msg]);
    setTimeout(() => {
      setShowNotifications(prev => prev.filter(m => m !== msg));
    }, 5000);

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification("MotoTrip Alerta", {
            body: msg,
            icon: "/vite.svg",
            tag: 'moto-trip-alert',
            requireInteraction: true,
            vibrate: [200, 100, 200]
          } as any);
        }
      } catch (e) {
        console.error("SW notification error:", e);
      }
    }
  };

  // TRIP ENGINE: Geolocation Tracking
  useEffect(() => {
    if (isTripRunning && currentTrip && "geolocation" in navigator) {
      const updateSystemStatus = async (progress: number) => {
        const currentDist = (progress / 100) * currentTrip.totalDistance;
        const nextPoint = currentTrip.points.find(p => p.distance > currentDist) || currentTrip.points[currentTrip.points.length - 1];
        const distToNext = (nextPoint.distance - currentDist).toFixed(1);
        const currentStatus = weatherToStatus(currentTrip.points[0].weather); // Simplified for persistent notice
        const nextStatus = weatherToStatus(nextPoint.weather);

        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: `MotoTrip: ${progress.toFixed(1)}%`,
            artist: `Próximo: ${nextPoint.location.name.split('-')[0]} em ${distToNext}km`,
            album: `Clima: ${currentStatus} -> ${nextStatus}`,
            artwork: [{ src: '/vite.svg', sizes: '512x512', type: 'image/png' }]
          });
        }

        if ("Notification" in window && Notification.permission === "granted" && 'serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(`Monitorando: ${progress.toFixed(1)}%`, {
              body: `Próximo: ${nextPoint.location.name.split('-')[0]} (${distToNext}km)`,
              icon: "/vite.svg",
              tag: 'moto-trip-bg',
              silent: true,
              requireInteraction: true
            });
          } catch {}
        }
      };

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          setUserCoords({ lat, lng });
          
          let minDistance = Infinity;
          let closestIndex = 0;
          
          currentTrip.fullPath.forEach((coord, idx) => {
            const d = getDistance(lat, lng, coord[1], coord[0]);
            if (d < minDistance) {
              minDistance = d;
              closestIndex = idx;
            }
          });
          
          if (minDistance < 5) {
            const newProgress = (closestIndex / currentTrip.fullPath.length) * 100;
            setTripProgress(prev => {
              const updated = Math.max(prev, newProgress);
              updateSystemStatus(updated);
              return updated;
            });
            
            currentTrip.points.forEach(p => {
              const distToPoint = getDistance(lat, lng, p.location.lat, p.location.lng);
              if (distToPoint < 2 && !notifiedPoints.has(p.id)) {
                setNotifiedPoints(prev => new Set([...prev, p.id]));
                if (p.id === 'p-start') return;
                
                const pName = p.location.name.split('-')[0].trim();
                if (p.id === 'p-end') {
                  triggerNotification(`Chegando ao destino: ${pName}!`);
                } else {
                  triggerNotification(`Próxima parada 2km: ${pName}`);
                }
              }
            });
          }
        },
        (error) => console.error('Geo error:', error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      // Wake Lock
      const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
          try {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          } catch (err) {}
        }
      };
      requestWakeLock();

      return () => {
        navigator.geolocation.clearWatch(watchId);
        if (wakeLockRef.current) {
          wakeLockRef.current.release().then(() => {
            wakeLockRef.current = null;
          });
        }
      };
    }
  }, [isTripRunning, currentTrip, notifiedPoints]);

  const weatherToStatus = (weather?: WeatherData) => {
    if (!weather) return "Dados indisponíveis";
    const cond = weather.current.condition.toLowerCase();
    if (cond.includes('chuva') || cond.includes('tempestade') || cond.includes('chuvisco')) return "Chuva 🌧️";
    if (cond.includes('limpo') || cond.includes('sol') || cond.includes('ensolarado')) return "Sol ☀️";
    if (cond.includes('nuvem') || cond.includes('nublado') || cond.includes('encoberto')) return "Nublado ☁️";
    return cond.charAt(0).toUpperCase() + cond.slice(1);
  };

  const [currentCity, setCurrentCity] = useState<string>('Localizando...');

  // Reverse geocode to get current city name
  useEffect(() => {
    if (!userCoords) return;
    
    let isMounted = true;
    const getCityName = async () => {
      if (!userCoords) return;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${userCoords.lat}&lon=${userCoords.lng}&format=json&accept-language=pt-BR&zoom=10`, {
          headers: {
            'User-Agent': 'MotoTripApp/1.0 (contact: andersonfferreira1995@gmail.com)'
          }
        });
        const data = await response.json();
        if (isMounted && data.address) {
          const city = data.address.city || data.address.town || data.address.village || data.address.municipality || data.address.suburb || data.address.state_district || 'Em Trânsito';
          setCurrentCity(city);
        }
      } catch (e) {
        console.error("Reverse geocode failed:", e);
        if (isMounted) setCurrentCity('Em Trânsito');
      }
    };
    
    // Initial fetch
    getCityName();
    
    // Update city name every 2 minutes
    const timer = setInterval(getCityName, 120000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [userCoords?.lat, userCoords?.lng]);

  const renderToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentTrip) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const progress = tripProgress;
    const currentDist = (progress / 100) * currentTrip.totalDistance;
    const nextPoint = currentTrip.points.find(p => p.distance > currentDist) || currentTrip.points[currentTrip.points.length - 1];
    const prevPoint = [...currentTrip.points].reverse().find(p => p.distance <= currentDist) || currentTrip.points[0];
    const distToNext = (nextPoint.distance - currentDist).toFixed(1);

    // Clear and draw black background (matches PiP window default bg)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Orange Border/Outline
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 14; 
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Inner Card
    ctx.fillStyle = '#171717';
    ctx.fillRect(7, 7, canvas.width - 14, canvas.height - 14);

    // Side Accent
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(15, 30, 8, canvas.height - 60);

    // Destination Chain: Current City > Next Stop
    const cityName = currentCity.toUpperCase();
    const nextStopName = nextPoint.location.name.split('-')[0].toUpperCase();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 27px sans-serif'; // Reduced by 1/4 (36px -> 27px)
    ctx.fillText(`${cityName} > ${nextStopName}`, 52, 70);

    ctx.fillStyle = '#a3a3a3';
    ctx.font = '24px sans-serif';
    ctx.fillText(`${progress.toFixed(1)}% • ${distToNext} km para a parada`, 52, 110);

    // Progress bar
    ctx.fillStyle = '#404040';
    const barWidth = 540;
    ctx.fillRect(52, 145, barWidth, 12);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(52, 145, (progress / 100) * barWidth, 12);

    // Weather - Side by side
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#a3a3a3';
    ctx.fillText('AQUI', 52, 195);
    ctx.fillText('PARADA', 320, 195);

    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#fb923c';
    ctx.fillText(weatherToStatus(prevPoint.weather), 52, 230);
    ctx.fillText(weatherToStatus(nextPoint.weather), 320, 230);

    // Watermark
    ctx.fillStyle = '#404040';
    ctx.font = 'italic 18px sans-serif';
    ctx.fillText('MotoTrip', 540, 230);
  }, [currentTrip, tripProgress, currentCity]);

  // PERIODIC WEATHER UPDATE (Every 5 minutes when PiP is active)
  useEffect(() => {
    let interval: any;
    if (isVideoPipActive && currentTrip) {
      interval = setInterval(async () => {
        try {
          const progress = tripProgress;
          const currentDist = (progress / 100) * currentTrip.totalDistance;
          const nextTarget = currentTrip.points.find(p => p.distance > currentDist) || currentTrip.points[currentTrip.points.length - 1];
          const prevTarget = [...currentTrip.points].reverse().find(p => p.distance <= currentDist) || currentTrip.points[0];

          // Just update the relevant weather points
          const [freshPrev, freshNext] = await Promise.all([
            fetchWeather(prevTarget.location.lat, prevTarget.location.lng),
            fetchWeather(nextTarget.location.lat, nextTarget.location.lng)
          ]);
          
          setCurrentTrip(prev => {
            if (!prev) return null;
            const updatedPoints = prev.points.map(p => {
              if (p.id === prevTarget.id) return { ...p, weather: freshPrev };
              if (p.id === nextTarget.id) return { ...p, weather: freshNext };
              return p;
            });
            return { ...prev, points: updatedPoints };
          });
          
          renderToCanvas();
        } catch (e) {
          console.error("Failed to refresh weather periodically:", e);
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVideoPipActive, currentTrip?.id, tripProgress, renderToCanvas]);

  useEffect(() => {
    let interval: any;
    if (isVideoPipActive) {
      renderToCanvas();
      // Heartbeat: Redraw every 2 seconds to ensure background visibility/updates
      interval = setInterval(renderToCanvas, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVideoPipActive, tripProgress, renderToCanvas, userCoords, currentCity]);

  const requestVideoPip = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    try {
      renderToCanvas();
      const stream = (canvas as any).captureStream(10);
      video.srcObject = stream;
      await video.play();
      await (video as any).requestPictureInPicture();
      setIsVideoPipActive(true);
      video.onleavepictureinpicture = () => {
        setIsVideoPipActive(false);
        // Quando fecha o pop-up, encerra o monitoramento mas fica no resumo
        setIsTripRunning(false);
        setTripProgress(0);
        setNotifiedPoints(new Set());
        setCurrentScreen(AppScreen.OVERVIEW);
      };
    } catch (err) {
      console.error("Video PiP failed:", err);
    }
  };

  const handleStartTrip = () => {
    // Não muda a view, apenas inicia o monitoramento e o pop-up
    setIsTripRunning(true);
    setIsMinimized(false);
    
    // Attempt auto-activation of PiP mode on start (requires user gesture - which this is)
    requestVideoPip();
  };

  const handleEndTrip = () => {
    storageService.clearAppState();
    setCurrentTrip(null);
    setCurrentScreen(AppScreen.HOME);
    setIsMinimized(false);
    setIsTripRunning(false);
    setTripProgress(0);
    setNotifiedPoints(new Set());
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-orange-500/30 font-sans selection:bg-orange-500/30">
      {/* Global Notifications Overlay */}
      <div className="fixed top-4 left-4 right-4 z-[1000] pointer-events-none space-y-2 max-w-md mx-auto">
        <AnimatePresence>
          {showNotifications.map((msg, i) => (
            <motion.div
              key={i + msg}
              initial={{ y: -50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.9 }}
              className="bg-orange-600/95 backdrop-blur-lg border border-orange-400 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto"
            >
              <AlertCircle size={20} />
              <p className="font-bold text-sm">{msg}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {currentScreen === AppScreen.HOME && (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <HomeScreen 
              onTripGenerated={(trip) => {
                setCurrentTrip(trip);
                setCurrentScreen(AppScreen.OVERVIEW);
              }} 
              onOpenSettings={() => setCurrentScreen(AppScreen.SETTINGS)}
            />
          </motion.div>
        )}

        {currentScreen === AppScreen.SETTINGS && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
          >
            <NotificationSettings onBack={() => setCurrentScreen(AppScreen.HOME)} />
          </motion.div>
        )}

        {currentScreen === AppScreen.OVERVIEW && currentTrip && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <TripOverviewScreen 
              trip={currentTrip} 
              onTripUpdate={setCurrentTrip}
              onStartTrip={handleStartTrip}
              onBack={() => setCurrentScreen(AppScreen.HOME)}
              isTripRunning={isTripRunning}
              onOpenDashboard={() => setCurrentScreen(AppScreen.RUNNING)}
              isVideoPipActive={isVideoPipActive}
              onActivatePip={requestVideoPip}
            />
          </motion.div>
        )}

        {currentScreen === AppScreen.RUNNING && !isMinimized && currentTrip && (
          <motion.div
            key="running"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4 }}
          >
            <RunningScreen 
              trip={currentTrip} 
              initialProgress={tripProgress}
              userCoords={userCoords}
              onProgressUpdate={setTripProgress}
              onBack={() => setCurrentScreen(AppScreen.OVERVIEW)}
              onEndTrip={handleEndTrip}
              onMinimize={() => {
                setIsMinimized(true);
                setCurrentScreen(AppScreen.HOME);
              }}
              onActivatePip={requestVideoPip}
              isVideoPipActive={isVideoPipActive}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add a button to open the dashboard if trip is active but screen is OVERVIEW or HOME */}
      {isTripRunning && currentScreen !== AppScreen.RUNNING && (
        <motion.button
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-6 right-6 p-4 bg-orange-600 rounded-full shadow-2xl z-50 text-white flex items-center justify-center border-4 border-neutral-950"
          onClick={() => setCurrentScreen(AppScreen.RUNNING)}
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <AlertCircle size={24} />
          </motion.div>
        </motion.button>
      )}

      <canvas ref={canvasRef} width={640} height={260} className="hidden" />
      <video ref={videoRef} className="hidden" muted playsInline />
    </div>
  );
}

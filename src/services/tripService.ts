/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Location, Trip, TripPoint, WeatherData } from '../types';
import { fetchWeather } from './weatherService';

const stateAbbreviationMap: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM',
  'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES',
  'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR',
  'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC',
  'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO'
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface LocationInfo {
  city: string;
  state: string;
  stateAbbr: string;
}

export const getLocationInfo = async (lat: number, lng: number): Promise<LocationInfo> => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`);
    if (!response.ok) throw new Error('Nominatim error');
    const data = await response.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || 'Estrada';
    const state = addr.state || '';
    const stateAbbr = stateAbbreviationMap[state] || state.substring(0, 2).toUpperCase() || '';
    
    return { city, state, stateAbbr };
  } catch (e) {
    console.error('Reverse geocode error:', e);
    return { city: 'Desconhecido', state: '', stateAbbr: '' };
  }
};

export const hasTollNearby = async (lat: number, lng: number): Promise<boolean> => {
  try {
    // Search for toll booths in a 5km radius (common on highways)
    const query = `[out:json][timeout:10];node["barrier"="toll_booth"](around:5000,${lat},${lng});out count;`;
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data && data.elements && data.elements.length > 0 && data.elements[0].tags ? parseInt(data.elements[0].tags.total || "0") > 0 : (data?.elements?.length > 0);
  } catch {
    return false;
  }
};

export const findNearestGasStation = async (lat: number, lng: number, radiusMeters: number = 20000): Promise<{lat: number, lng: number, name: string, brand: string} | null> => {
  const brandedQuery = `[out:json][timeout:15];
    (
      node["amenity"="fuel"]["brand"~"Shell|Petrobras|BR",i](around:${radiusMeters},${lat},${lng});
      node["amenity"="fuel"]["name"~"Shell|Petrobras|BR",i](around:${radiusMeters},${lat},${lng});
      way["amenity"="fuel"]["brand"~"Shell|Petrobras|BR",i](around:${radiusMeters},${lat},${lng});
      way["amenity"="fuel"]["name"~"Shell|Petrobras|BR",i](around:${radiusMeters},${lat},${lng});
    );
    out center 1;`;

  try {
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(brandedQuery)}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.elements && data.elements.length > 0) {
        const fuel = data.elements[0];
        const fuelLat = fuel.type === 'node' ? fuel.lat : fuel.center.lat;
        const fuelLng = fuel.type === 'node' ? fuel.lon : fuel.center.lon;
        const brandRaw = (fuel.tags.brand || fuel.tags.name || '').toLowerCase();
        let brand = 'Posto';
        if (brandRaw.includes('shell')) brand = 'Shell';
        else if (brandRaw.includes('petrobras') || brandRaw.includes('br ')) brand = 'Petrobras';
        
        return { lat: fuelLat, lng: fuelLng, name: fuel.tags.name || fuel.tags.brand || 'Posto', brand };
      }
    }
  } catch (e) {
    console.error('Overpass branded failed', e);
  }

  // Generic fallback if no Shell/Petrobras
  const fallbackQuery = `[out:json][timeout:15];(node["amenity"="fuel"](around:${radiusMeters},${lat},${lng});way["amenity"="fuel"](around:${radiusMeters},${lat},${lng}););out center 1;`;
  try {
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(fallbackQuery)}`);
    const data = await response.json();
    if (data?.elements?.length > 0) {
      const fuel = data.elements[0];
      return {
        lat: fuel.type === 'node' ? fuel.lat : fuel.center.lat,
        lng: fuel.type === 'node' ? fuel.lon : fuel.center.lon,
        name: fuel.tags.name || 'Posto de Combustível',
        brand: 'Posto'
      };
    }
  } catch {}

  return null;
};

export const formatPointName = async (lat: number, lng: number, brandOverride?: string): Promise<string> => {
  const info = await getLocationInfo(lat, lng);
  const brand = brandOverride || 'Posto';
  const hasToll = await hasTollNearby(lat, lng);
  const tollSuffix = hasToll ? 'P' : 'S/P';
  
  return `${info.city} - ${info.stateAbbr} - ${brand} - ${tollSuffix}`;
};

export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const findCoordinateAtKm = (km: number, fullPath: [number, number][]): [number, number] => {
  if (km <= 0) return fullPath[0];
  
  let currentDist = 0;
  for (let i = 1; i < fullPath.length; i++) {
    const [prevLng, prevLat] = fullPath[i - 1];
    const [currLng, currLat] = fullPath[i];
    const segmentDist = getDistance(prevLat, prevLng, currLat, currLng);
    
    if (currentDist + segmentDist >= km) {
      return fullPath[i];
    }
    currentDist += segmentDist;
  }
  
  return fullPath[fullPath.length - 1];
};

export const findKmOnPath = (lat: number, lng: number, fullPath: [number, number][], totalDistance: number): number => {
  let minD = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < fullPath.length; i++) {
    const d = Math.sqrt(Math.pow(fullPath[i][1] - lat, 2) + Math.pow(fullPath[i][0] - lng, 2));
    if (d < minD) {
      minD = d;
      closestIdx = i;
    }
  }
  let cumulativeDist = 0;
  for (let i = 1; i <= closestIdx; i++) {
    const [prevLng, prevLat] = fullPath[i - 1];
    const [currLng, currLat] = fullPath[i];
    cumulativeDist += getDistance(prevLat, prevLng, currLat, currLng);
  }
  return Math.min(cumulativeDist, totalDistance);
};

export const recalculateTimeline = async (trip: Trip, manualPoints: TripPoint[]): Promise<TripPoint[]> => {
  const { totalDistance, fullPath } = trip;
  const newPoints: TripPoint[] = [];
  
  const startPoint = trip.points.find(p => p.id === 'p-start')!;
  newPoints.push(startPoint);

  // Pre-fetch all tolls and gas stations along the route area
  let tollList: { km: number, name: string }[] = [];
  let gasStations: {lat: number, lng: number, brand: string}[] = [];

  try {
    const minLat = Math.min(...fullPath.map(c => c[1]));
    const maxLat = Math.max(...fullPath.map(c => c[1]));
    const minLng = Math.min(...fullPath.map(c => c[0]));
    const maxLng = Math.max(...fullPath.map(c => c[0]));
    
    // Sampling points along the path for better gas station coverage
    const samplePoints = [];
    const stepKm = 30; 
    for (let d = 0; d < totalDistance; d += stepKm) {
      const [lng, lat] = findCoordinateAtKm(d, fullPath);
      samplePoints.push(`${lat},${lng}`);
    }

    const query = `[out:json][timeout:30];
      (
        node["barrier"="toll_booth"](${minLat - 0.05},${minLng - 0.05},${maxLat + 0.05},${maxLng + 0.05});
        node["amenity"="fuel"](around:15000,${samplePoints.join(',')});
        way["amenity"="fuel"](around:15000,${samplePoints.join(',')});
      );
      out center;`;

    const resp = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if (resp.ok) {
      const data = await resp.json();
      const elements = data.elements || [];
      
      elements.forEach((el: any) => {
        const lat = el.type === 'node' ? el.lat : el.center.lat;
        const lng = el.type === 'node' ? el.lon : el.center.lon;
        const tags = el.tags || {};
        
        if (tags.barrier === 'toll_booth') {
          const km = findKmOnPath(lat, lng, fullPath, totalDistance);
          // Avoid duplicate tolls (same location/name within 2km)
          if (!tollList.some(t => Math.abs(t.km - km) < 2)) {
            tollList.push({ km, name: tags.name || tags.operator || 'Pedágio' });
          }
        } else if (tags.amenity === 'fuel') {
          const brandRaw = (tags.brand || tags.name || '').toLowerCase();
          let brand = 'Posto';
          if (brandRaw.includes('shell')) brand = 'Shell';
          else if (brandRaw.includes('petrobras') || brandRaw.includes('br ')) brand = 'Petrobras';
          
          gasStations.push({ lat, lng, brand });
        }
      });
    }
  } catch (e) {
    console.error('Failed to pre-fetch route data', e);
  }

  const getTollsCountForPoint = (km: number) => {
    // Return names of tolls within 15km of this point (segment check)
    return tollList.filter(t => Math.abs(t.km - km) < 15).length;
  };

  const getTollsInRange = (startKm: number, endKm: number) => {
    return tollList.filter(t => t.km > startKm && t.km <= endKm);
  };

  const getNearestLocalGasStation = (targetKm: number, minAfterKm: number) => {
    let best = null;
    let minDiff = 25; // Max 25km difference from target

    for (const gs of gasStations) {
      const km = findKmOnPath(gs.lat, gs.lng, fullPath, totalDistance);
      if (km <= minAfterKm + 1) continue; // Must be after current location

      const diff = Math.abs(km - targetKm);
      const adjustedDiff = (gs.brand === 'Shell' || gs.brand === 'Petrobras') ? diff * 0.4 : diff;
      
      if (adjustedDiff < minDiff) {
        minDiff = adjustedDiff;
        best = { ...gs, km };
      }
    }
    return best;
  };

  let currentDist = 0;
  let totalTollsFound = tollList.length;
  const sortedManual = [...manualPoints].sort((a, b) => a.distance - b.distance);
  let manualIdx = 0;
  let autoIdx = 1;

  // 1. Identify all points to stop at (automatic + manual)
  const stopsToEnrich: { lat: number, lng: number, km: number, id: string, brand?: string, type: 'manual' | 'gas' | 'estrada' }[] = [];

  while (currentDist + 80 < totalDistance) {
    const nextTargetDist = currentDist + 100;
    const upcomingManual = sortedManual[manualIdx];
    
    if (upcomingManual && upcomingManual.distance <= nextTargetDist + 15) {
      stopsToEnrich.push({ 
        lat: upcomingManual.location.lat, 
        lng: upcomingManual.location.lng, 
        km: upcomingManual.distance, 
        id: upcomingManual.id,
        type: 'manual' 
      });
      currentDist = upcomingManual.distance;
      manualIdx++;
    } else {
      const gasStation = getNearestLocalGasStation(nextTargetDist, currentDist);
      
      if (gasStation) {
        stopsToEnrich.push({
          lat: gasStation.lat,
          lng: gasStation.lng,
          km: gasStation.km,
          id: `p-auto-${stopsToEnrich.length + 1}`,
          brand: gasStation.brand,
          type: 'gas'
        });
        currentDist = gasStation.km;
      } else {
        const [lng, lat] = findCoordinateAtKm(nextTargetDist, fullPath);
        stopsToEnrich.push({
          lat,
          lng,
          km: nextTargetDist,
          id: `p-auto-${stopsToEnrich.length + 1}`,
          type: 'estrada'
        });
        currentDist = nextTargetDist;
      }
    }
    if (stopsToEnrich.length > 50) break;
  }

  // 2. Enrich all points in parallel (Fixes the loading delay)
  const enrichedResults = await Promise.allSettled(
    stopsToEnrich.map(async (p) => {
      const [lRes, wRes] = await Promise.allSettled([
        getLocationInfo(p.lat, p.lng),
        fetchWeather(p.lat, p.lng)
      ]);
      return { 
        p, 
        locInfo: lRes.status === 'fulfilled' ? lRes.value : { city: 'Ponto', stateAbbr: 'BR' },
        weather: wRes.status === 'fulfilled' ? wRes.value : undefined
      };
    })
  );

  // 3. Construct TripPoints
  let segmentStartKm = 0;
  enrichedResults.forEach((res) => {
    if (res.status === 'fulfilled') {
      const { p, locInfo, weather } = res.value;
      const segmentTolls = getTollsInRange(segmentStartKm, p.km);
      const hasToll = segmentTolls.length > 0;
      
      let finalName = '';
      if (p.type === 'manual') {
        const manual = manualPoints.find(mp => mp.id === p.id);
        finalName = manual?.location.name || `${locInfo.city} - ${locInfo.stateAbbr} - Parada - ${hasToll ? 'P' : 'S/P'}`;
      } else {
        const label = p.brand || (p.type === 'gas' ? 'Posto' : 'Estrada');
        finalName = `${locInfo.city} - ${locInfo.stateAbbr} - ${label} - ${hasToll ? 'P' : 'S/P'}`;
      }

      const eta = new Date(new Date(startPoint.eta).getTime() + (p.km / 70) * 3600000);

      newPoints.push({
        id: p.id,
        distance: p.km,
        location: { name: finalName, lat: p.lat, lng: p.lng },
        eta,
        weather
      });
      segmentStartKm = p.km;
    }
  });

  const endPoint = trip.points.find(p => p.id === 'p-end')!;
  const endInfo = await getLocationInfo(endPoint.location.lat, endPoint.location.lng);
  const endTolls = getTollsInRange(segmentStartKm, totalDistance);
  endPoint.location.name = `${endInfo.city} - ${endInfo.stateAbbr} - Destino - ${endTolls.length > 0 ? 'P' : 'S/P'}`;
  newPoints.push(endPoint);

  trip.totalTolls = tollList.length * 6.50;

  return newPoints.sort((a, b) => a.distance - b.distance);
};

export const generateTripData = async (origin: Location, destination: Location, consumption: number, waypoints: Location[] = []): Promise<Trip> => {
  // Construct all points for the route
  const allCoords = [origin, ...waypoints, destination];
  const coordString = allCoords.map(c => `${c.lng},${c.lat}`).join(';');
  
  // Use OSRM Route service. If waypoints are provided, OSRM visits them in the provided order.
  // To "organize in a way that makes sense", we could use the 'trip' service for optimization,
  // but for road trips, the 'route' service with set order is often more predictable.
  // However, the user asked to organize them logically.
  
  let finalCoords = allCoords;
  
  if (waypoints.length > 0) {
    // Attempt optimization using OSRM Trip service if more than 2 points total (always true here)
    try {
      const tripUrl = `https://router.project-osrm.org/trip/v1/driving/${coordString}?source=first&destination=last&roundtrip=false`;
      const tripResp = await fetch(tripUrl);
      const tripData = await tripResp.json();
      
      if (tripData.code === 'Ok' && tripData.waypoints) {
        // Sort our original locations based on the optimized indices returned by OSRM
        // tripData.waypoints[i].waypoint_index tells us which input point ended up at position i in the optimized trip
        const optimizedIndices = tripData.waypoints
          .sort((a: any, b: any) => a.waypoint_index - b.waypoint_index) // This is wrong, waypoint_index is input index
          // We need to sort inputs based on their order in data.trips[0].legs or similar?
          // Actually, 'trip' returns the waypoints in the order they should be visited.
          // The order in tripData.waypoints is the order of the optimized trip.
          
        // Let's re-read OSRM Trip API: "The waypoints are returned in the order they were supplied". 
        // Wait, no: "The order of the waypoints in the result is the same as the order of the input coordinates."
        // "trips[0].legs" contains the sequence.
        
        // Actually, a simpler way to "make sense" for 3 stops is to sort them by distance from origin.
        // This usually works for a point A to point B trip.
        const sortedWaypoints = [...waypoints].sort((a, b) => {
          const distA = getDistance(origin.lat, origin.lng, a.lat, a.lng);
          const distB = getDistance(origin.lat, origin.lng, b.lat, b.lng);
          return distA - distB;
        });
        finalCoords = [origin, ...sortedWaypoints, destination];
      }
    } catch (e) {
      console.warn('Trip optimization failed, using default order', e);
    }
  }

  const finalCoordString = finalCoords.map(c => `${c.lng},${c.lat}`).join(';');
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${finalCoordString}?overview=full&geometries=geojson&steps=true`;
  const response = await fetch(osrmUrl);
  const data = await response.json();
  if (!data.routes || data.routes.length === 0) throw new Error('Rota não encontrada');

  const route = data.routes[0];
  const totalDistanceKm = route.distance / 1000;
  const totalDurationSec = route.duration;
  const fullPath = route.geometry.coordinates;

  const startInfo = await getLocationInfo(origin.lat, origin.lng);
  const startPoint: TripPoint = {
    id: 'p-start',
    distance: 0,
    location: { ...origin, name: `${startInfo.city} - ${startInfo.stateAbbr} - Partida - S/P` },
    eta: new Date(),
    weather: await fetchWeather(origin.lat, origin.lng)
  };

  const endPoint: TripPoint = {
    id: 'p-end',
    distance: totalDistanceKm,
    location: { ...destination, name: 'Destino' },
    eta: new Date(Date.now() + totalDurationSec * 1000),
    weather: await fetchWeather(destination.lat, destination.lng)
  };

  const initialTrip: Trip = {
    id: Math.random().toString(36).substr(2, 9),
    origin,
    destination,
    consumption,
    totalDistance: totalDistanceKm,
    totalDuration: totalDurationSec,
    totalFuelCost: (totalDistanceKm / consumption) * 5.89,
    totalTolls: 0,
    segments: [],
    points: [startPoint, endPoint],
    fullPath,
    createdAt: Date.now(),
  };

  // Identify manual stops locations and distances on the new path
  const manualPoints: TripPoint[] = await Promise.all(waypoints.map(async (wp, idx) => {
    const km = findKmOnPath(wp.lat, wp.lng, fullPath, totalDistanceKm);
    const info = await getLocationInfo(wp.lat, wp.lng);
    return {
      id: `p-manual-stop-${idx}`,
      distance: km,
      location: { ...wp, name: `${info.city} - ${info.stateAbbr} - Parada Manual` },
      eta: new Date(Date.now() + (km / 70) * 3600000),
      weather: await fetchWeather(wp.lat, wp.lng)
    };
  }));

  // Use recalculate to fill the 100km gas stations, passing manual stops
  initialTrip.points = await recalculateTimeline(initialTrip, manualPoints);
  
  return initialTrip;
};


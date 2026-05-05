/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Location {
  name: string;
  lat: number;
  lng: number;
}

export interface WeatherCondition {
  temp: number;
  condition: string;
  iconCode: number;
  time?: string;
}

export interface DayForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  condition: string;
  iconCode: number;
}

export interface WeatherData {
  current: WeatherCondition;
  hourly: WeatherCondition[];
  daily: DayForecast[];
}

export interface TripPoint {
  id: string;
  distance: number; // accumulated distance from start
  location: Location;
  eta: Date;
  weather?: WeatherData;
}

export interface TripSegment {
  id: string;
  startDistance: number;
  endDistance: number;
  points: TripPoint[];
}

export interface Trip {
  id: string;
  origin: Location;
  destination: Location;
  consumption: number; // km/L
  totalDistance: number; // km
  totalDuration: number; // seconds
  totalFuelCost: number;
  totalTolls: number;
  segments: TripSegment[];
  points: TripPoint[]; // all points every 100km
  fullPath: [number, number][]; // [lng, lat]
  createdAt: number;
}

export enum AppScreen {
  HOME = 'HOME',
  OVERVIEW = 'OVERVIEW',
  RUNNING = 'RUNNING',
  SETTINGS = 'SETTINGS'
}

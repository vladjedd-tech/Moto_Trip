/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WeatherData } from '../types';

const WMO_CODE_MAP: Record<number, string> = {
  0: 'Céu limpo',
  1: 'Principalmente limpo',
  2: 'Parcialmente nublado',
  3: 'Encoberto',
  45: 'Nevoeiro',
  48: 'Nevoeiro com geada',
  51: 'Drizzle leve',
  53: 'Drizzle moderada',
  55: 'Drizzle densa',
  61: 'Chuva leve',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  71: 'Neve leve',
  73: 'Neve moderada',
  75: 'Neve forte',
  80: 'Pancadas de chuva leve',
  81: 'Pancadas de chuva moderadas',
  82: 'Pancadas de chuva violentas',
  95: 'Trovoada',
};

export async function fetchWeather(lat: number, lng: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();

    const current: WeatherData['current'] = {
      temp: data.current.temperature_2m,
      condition: WMO_CODE_MAP[data.current.weather_code] || 'Desconhecido',
      iconCode: data.current.weather_code,
    };

    const hourly: WeatherData['hourly'] = data.hourly.time.slice(0, 24).map((time: string, index: number) => ({
      time,
      temp: data.hourly.temperature_2m[index],
      condition: WMO_CODE_MAP[data.hourly.weather_code[index]] || 'Desconhecido',
      iconCode: data.hourly.weather_code[index],
    }));

    const daily: WeatherData['daily'] = data.daily.time.map((date: string, index: number) => ({
      date,
      tempMax: data.daily.temperature_2m_max[index],
      tempMin: data.daily.temperature_2m_min[index],
      condition: WMO_CODE_MAP[data.daily.weather_code[index]] || 'Desconhecido',
      iconCode: data.daily.weather_code[index],
    }));

    return { current, hourly, daily };
  } catch (error) {
    console.error('Weather fetch error:', error);
    throw error;
  }
}

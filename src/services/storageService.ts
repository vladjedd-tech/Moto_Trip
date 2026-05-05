/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Trip } from '../types';

const STORAGE_KEY = 'rumo_saved_trips';

const APP_STATE_KEY = 'rumo_app_state';

export const storageService = {
  saveTrip: (trip: Trip) => {
    const saved = storageService.getSavedTrips();
    const exists = saved.find(t => t.id === trip.id);
    if (!exists) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...saved, trip]));
    }
  },

  getSavedTrips: (): Trip[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    const trips: Trip[] = data ? JSON.parse(data) : [];
    return trips.map(t => ({
      ...t,
      points: t.points.map(p => ({
        ...p,
        eta: new Date(p.eta)
      }))
    }));
  },

  deleteTrip: (id: string) => {
    const saved = storageService.getSavedTrips();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.filter(t => t.id !== id)));
  },

  persistAppState: (screen: string, trip: Trip | null) => {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify({ screen, trip }));
  },

  getPersistedAppState: (): { screen: string, trip: Trip | null } | null => {
    const data = localStorage.getItem(APP_STATE_KEY);
    if (!data) return null;
    const state = JSON.parse(data);
    if (state.trip) {
      state.trip.points = state.trip.points.map((p: any) => ({
        ...p,
        eta: new Date(p.eta)
      }));
    }
    return state;
  },

  clearAppState: () => {
    localStorage.removeItem(APP_STATE_KEY);
  }
};

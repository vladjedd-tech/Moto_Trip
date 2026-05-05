import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mototrip.app',
  appName: 'MotoTrip',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

export const apiBase = 'https://maps.googleapis.com/maps/api';

export const getMapsKey = () => process.env.PLACES_API_KEY?.trim() || undefined;

export const hasMapsKey = () => !!getMapsKey();

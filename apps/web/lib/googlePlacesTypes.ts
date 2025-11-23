export type PlacePrediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
};

export type PlaceDetails = {
  formattedAddress?: string;
  name?: string;
  lat?: number;
  lng?: number;
};

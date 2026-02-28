import { notify } from 'services/notify.service';

export const locationFeedbackMessages = {
  invalidSuggestion: 'Invalid location selected.',
  invalidMapPoint: 'Invalid map location selected.',
  detectedCurrentLocation: 'Location detected successfully!',
  mapAddressUpdated: 'Address updated from map location',
} as const;

export const notifyInvalidLocationSuggestion = () => {
  notify.error(locationFeedbackMessages.invalidSuggestion);
};

export const notifyInvalidMapLocation = () => {
  notify.error(locationFeedbackMessages.invalidMapPoint);
};

export const notifyLocationDetected = () => {
  notify.success(locationFeedbackMessages.detectedCurrentLocation);
};

export const notifyMapAddressUpdated = () => {
  notify.success(locationFeedbackMessages.mapAddressUpdated);
};


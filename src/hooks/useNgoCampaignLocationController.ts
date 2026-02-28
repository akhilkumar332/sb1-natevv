import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AddressSuggestion } from './useAddressAutocomplete';
import { useSyncedRef } from './useSyncedRef';
import { buildGeocodeLocationPatch, buildSuggestionLocationUpdate } from '../utils/locationController';
import { notifyInvalidLocationSuggestion, notifyInvalidMapLocation } from '../utils/locationFeedback';
import { isValidCoordinatePair } from '../utils/locationSelection';

type CampaignLocationFormFields = {
  address: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
};

type GeocodeAddress = {
  state?: string;
  city?: string;
  town?: string;
  village?: string;
  postcode?: string;
};

type SuggestionLike = Pick<AddressSuggestion, 'lat' | 'lon' | 'display_name'> & {
  address?: GeocodeAddress;
};

type UseNgoCampaignLocationControllerOptions<TForm extends CampaignLocationFormFields> = {
  form: TForm;
  setForm: Dispatch<SetStateAction<TForm>>;
  setMapPosition: Dispatch<SetStateAction<[number, number]>>;
  clearSuggestions: () => void;
  resolveFromCoordinates: (
    coords: [number, number],
    options?: { errorMessage?: string }
  ) => Promise<{ geocode?: { display_name?: string; address?: GeocodeAddress } | null }>;
  resolveCurrentLocation: (options?: {
    positionErrorMessage?: string;
    unsupportedErrorMessage?: string;
  }) => Promise<{ coords: [number, number] } | null>;
  notifyScopedError: (
    error: unknown,
    fallbackMessage: string,
    options?: { id?: string },
    kind?: string
  ) => void;
  kindPrefix: string;
  toastIds: {
    mapSync: string;
    currentLocation: string;
  };
};

export const useNgoCampaignLocationController = <TForm extends CampaignLocationFormFields>({
  form,
  setForm,
  setMapPosition,
  clearSuggestions,
  resolveFromCoordinates,
  resolveCurrentLocation,
  notifyScopedError,
  kindPrefix,
  toastIds,
}: UseNgoCampaignLocationControllerOptions<TForm>) => {
  const [locating, setLocating] = useState(false);
  const mountedRef = useRef(true);
  const reverseGeocodeRequestIdRef = useRef(0);
  const formRef = useSyncedRef(form);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const syncAddressFromCoordinates = useCallback(
    async (pos: [number, number]) => {
      const requestId = ++reverseGeocodeRequestIdRef.current;
      try {
        const result = await resolveFromCoordinates(pos, {
          errorMessage: 'Could not fetch address for this location',
        });
        const patch = buildGeocodeLocationPatch({
          geocode: result.geocode,
          availableStates: [],
          countryCode: 'IN',
          current: {
            address: formRef.current.address,
            city: formRef.current.city,
            state: formRef.current.state,
          },
          includePostalCode: false,
        });
        if (patch) {
          if (!mountedRef.current || requestId !== reverseGeocodeRequestIdRef.current) return;
          setForm((prev) => ({ ...prev, ...patch }));
        }
      } catch (error) {
        if (requestId !== reverseGeocodeRequestIdRef.current) return;
        notifyScopedError(
          error,
          'Could not fetch address for this location.',
          { id: toastIds.mapSync },
          `${kindPrefix}.map_sync`
        );
      }
    },
    [formRef, kindPrefix, notifyScopedError, resolveFromCoordinates, setForm, toastIds.mapSync]
  );

  const handleMapChange = useCallback(
    (pos: [number, number]) => {
      if (!isValidCoordinatePair(pos)) {
        notifyInvalidMapLocation();
        return;
      }
      setMapPosition(pos);
      if (!mountedRef.current) return;
      setForm((prev) => ({
        ...prev,
        latitude: pos[0].toFixed(6),
        longitude: pos[1].toFixed(6),
      }));
      void syncAddressFromCoordinates(pos);
    },
    [setMapPosition, setForm, syncAddressFromCoordinates]
  );

  const handleUseCurrentLocation = useCallback(async () => {
    try {
      setLocating(true);
      const result = await resolveCurrentLocation({
        positionErrorMessage: 'Unable to fetch your location.',
        unsupportedErrorMessage: 'Geolocation not supported in this browser.',
      });
      if (!result) return;
      if (!mountedRef.current) return;
      handleMapChange(result.coords);
    } catch (error) {
      notifyScopedError(
        error,
        'Unable to fetch your location.',
        { id: toastIds.currentLocation },
        `${kindPrefix}.current`
      );
    } finally {
      if (mountedRef.current) {
        setLocating(false);
      }
    }
  }, [handleMapChange, kindPrefix, notifyScopedError, resolveCurrentLocation, toastIds.currentLocation]);

  const handleAddressSelect = useCallback((suggestion: SuggestionLike) => {
    const update = buildSuggestionLocationUpdate({
      suggestion,
      availableStates: [],
      countryCode: 'IN',
      current: {
        address: formRef.current.address,
        city: formRef.current.city,
        state: formRef.current.state,
      },
      coordinateMode: 'string6',
      includePostalCode: false,
    });
    if (!update) {
      notifyInvalidLocationSuggestion();
      return;
    }
    if (!mountedRef.current) return;
    setForm((prev) => ({ ...prev, ...(update.patch as Partial<TForm>) }));
    setMapPosition(update.coords);
    clearSuggestions();
  }, [clearSuggestions, formRef, setForm, setMapPosition]);

  return {
    locating,
    handleMapChange,
    handleUseCurrentLocation,
    handleAddressSelect,
  };
};

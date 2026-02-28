import { getCitiesByState } from '../data/locations';

type AddressState = { name: string };

type NominatimAddress = {
  state?: string;
  city?: string;
  town?: string;
  village?: string;
  postcode?: string;
};

export const mapNominatimAddress = ({
  address,
  availableStates,
  countryCode,
}: {
  address: NominatimAddress | null | undefined;
  availableStates: AddressState[];
  countryCode: string;
}) => {
  if (!address) {
    return { state: '', city: '', postalCode: '' };
  }

  const mappedState =
    address.state
      ? availableStates.find((state) => state.name.toLowerCase() === String(address.state).toLowerCase())?.name || ''
      : '';

  const sourceCity = String(address.city || address.town || address.village || '').toLowerCase();
  const mappedCity =
    mappedState && sourceCity
      ? getCitiesByState(countryCode, mappedState).find((city) => city.toLowerCase() === sourceCity) || ''
      : '';

  return {
    state: mappedState,
    city: mappedCity,
    postalCode: address.postcode || '',
  };
};

// Location data for countries, states, and cities
export interface City {
  name: string;
}

export interface State {
  name: string;
  cities: string[];
}

export interface Country {
  name: string;
  code: string;
  phoneCode: string;
  states: State[];
}

export const countries: Country[] = [
  {
    name: 'India',
    code: 'IN',
    phoneCode: '+91',
    states: [
      {
        name: 'Andhra Pradesh',
        cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati']
      },
      {
        name: 'Arunachal Pradesh',
        cities: ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang']
      },
      {
        name: 'Assam',
        cities: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia']
      },
      {
        name: 'Bihar',
        cities: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga']
      },
      {
        name: 'Chhattisgarh',
        cities: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon']
      },
      {
        name: 'Delhi',
        cities: ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Central Delhi']
      },
      {
        name: 'Goa',
        cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda']
      },
      {
        name: 'Gujarat',
        cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar']
      },
      {
        name: 'Haryana',
        cities: ['Faridabad', 'Gurgaon', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar']
      },
      {
        name: 'Himachal Pradesh',
        cities: ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Manali']
      },
      {
        name: 'Jharkhand',
        cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh']
      },
      {
        name: 'Karnataka',
        cities: ['Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum', 'Gulbarga', 'Davangere']
      },
      {
        name: 'Kerala',
        cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad']
      },
      {
        name: 'Madhya Pradesh',
        cities: ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Ratlam']
      },
      {
        name: 'Maharashtra',
        cities: ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur']
      },
      {
        name: 'Manipur',
        cities: ['Imphal', 'Thoubal', 'Churachandpur', 'Bishnupur']
      },
      {
        name: 'Meghalaya',
        cities: ['Shillong', 'Tura', 'Jowai', 'Nongstoin']
      },
      {
        name: 'Mizoram',
        cities: ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip']
      },
      {
        name: 'Nagaland',
        cities: ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang']
      },
      {
        name: 'Odisha',
        cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Sambalpur', 'Berhampur']
      },
      {
        name: 'Punjab',
        cities: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali']
      },
      {
        name: 'Rajasthan',
        cities: ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Udaipur', 'Ajmer', 'Bhilwara']
      },
      {
        name: 'Sikkim',
        cities: ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan']
      },
      {
        name: 'Tamil Nadu',
        cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Vellore']
      },
      {
        name: 'Telangana',
        cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar']
      },
      {
        name: 'Tripura',
        cities: ['Agartala', 'Dharmanagar', 'Udaipur', 'Kailashahar']
      },
      {
        name: 'Uttar Pradesh',
        cities: ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Meerut', 'Varanasi', 'Allahabad', 'Noida']
      },
      {
        name: 'Uttarakhand',
        cities: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur']
      },
      {
        name: 'West Bengal',
        cities: ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman']
      },
      {
        name: 'Andaman and Nicobar Islands',
        cities: ['Port Blair', 'Diglipur', 'Rangat']
      },
      {
        name: 'Chandigarh',
        cities: ['Chandigarh']
      },
      {
        name: 'Dadra and Nagar Haveli and Daman and Diu',
        cities: ['Daman', 'Diu', 'Silvassa']
      },
      {
        name: 'Lakshadweep',
        cities: ['Kavaratti', 'Agatti', 'Amini']
      },
      {
        name: 'Puducherry',
        cities: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam']
      },
      {
        name: 'Jammu and Kashmir',
        cities: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla']
      },
      {
        name: 'Ladakh',
        cities: ['Leh', 'Kargil']
      }
    ]
  },
  {
    name: 'United States',
    code: 'US',
    phoneCode: '+1',
    states: [
      {
        name: 'California',
        cities: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento']
      },
      {
        name: 'New York',
        cities: ['New York City', 'Buffalo', 'Rochester', 'Albany', 'Syracuse']
      },
      {
        name: 'Texas',
        cities: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth']
      },
      {
        name: 'Florida',
        cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale']
      }
    ]
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    phoneCode: '+44',
    states: [
      {
        name: 'England',
        cities: ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Bristol']
      },
      {
        name: 'Scotland',
        cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee']
      },
      {
        name: 'Wales',
        cities: ['Cardiff', 'Swansea', 'Newport', 'Bangor']
      },
      {
        name: 'Northern Ireland',
        cities: ['Belfast', 'Derry', 'Lisburn', 'Newry']
      }
    ]
  },
  {
    name: 'Canada',
    code: 'CA',
    phoneCode: '+1',
    states: [
      {
        name: 'Ontario',
        cities: ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton', 'London']
      },
      {
        name: 'Quebec',
        cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau']
      },
      {
        name: 'British Columbia',
        cities: ['Vancouver', 'Victoria', 'Surrey', 'Burnaby']
      },
      {
        name: 'Alberta',
        cities: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge']
      }
    ]
  },
  {
    name: 'Australia',
    code: 'AU',
    phoneCode: '+61',
    states: [
      {
        name: 'New South Wales',
        cities: ['Sydney', 'Newcastle', 'Wollongong', 'Central Coast']
      },
      {
        name: 'Victoria',
        cities: ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo']
      },
      {
        name: 'Queensland',
        cities: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville']
      },
      {
        name: 'Western Australia',
        cities: ['Perth', 'Fremantle', 'Mandurah', 'Bunbury']
      }
    ]
  }
];

// Helper function to get states by country code
export const getStatesByCountry = (countryCode: string): State[] => {
  const country = countries.find(c => c.code === countryCode);
  return country?.states || [];
};

// Helper function to get cities by country code and state name
export const getCitiesByState = (countryCode: string, stateName: string): string[] => {
  const country = countries.find(c => c.code === countryCode);
  const state = country?.states.find(s => s.name === stateName);
  return state?.cities || [];
};

// Helper function to get country by code
export const getCountryByCode = (code: string): Country | undefined => {
  return countries.find(c => c.code === code);
};

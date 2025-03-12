import cities from "../assets/cities.json";

interface CityData {
  name: string;
  coords: number[];
}

const typedCities = cities as Record<string, CityData>;

export interface ExtendedCityObject extends CityData {
  key: string;
}

export function getCity(city: string): ExtendedCityObject {
  const normalizedCity = city.toLowerCase();
  const cityData = typedCities[normalizedCity];

  if (cityData) {
    return {
      ...cityData,
      key: normalizedCity,
    };
  }
  return {
    name: "",
    coords: [],
    key: "",
  };
}


export async function getStatics() {
    return Object.keys(cities).map((city) => ({
        params: { city: city.toLowerCase() },
    }));
}
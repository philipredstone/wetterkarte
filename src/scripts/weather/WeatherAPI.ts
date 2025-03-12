const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_BASE_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

export interface WeatherApiRequestConfig {
  latitude: number;
  longitude: number;
  forecastDays?: number;
  pastDays?: number;
  current?: readonly string[];
  minutely_15?: readonly string[];
  hourly?: readonly string[];
  daily?: readonly string[];
  timezone?: string;
}

export interface WeatherUnits {
  [key: string]: string;
}

export interface CurrentWeatherBase {
  time: string;
  interval: number;
}

export interface WeatherArrayBase {
  time: string[];
}

type ArrayElement<T extends readonly any[]> = T extends readonly (infer U)[] ? U : never;

type PickRequestedKeys<T extends readonly string[]> = {
  [K in ArrayElement<T>]: number;
} & CurrentWeatherBase;

type PickRequestedArrayKeys<T extends readonly string[]> = {
  [K in ArrayElement<T>]: number[];
} & WeatherArrayBase;

export interface WeatherApiResponse<
  C extends readonly string[] | undefined = undefined,
  M extends readonly string[] | undefined = undefined,
  H extends readonly string[] | undefined = undefined,
  D extends readonly string[] | undefined = undefined
> {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;

  current_units: C extends readonly string[] ? WeatherUnits : undefined;
  minutely_15_units: M extends readonly string[] ? WeatherUnits : undefined;
  hourly_units: H extends readonly string[] ? WeatherUnits : undefined;
  daily_units: D extends readonly string[] ? WeatherUnits : undefined;

  current: C extends readonly string[] ? PickRequestedKeys<C> : undefined;
  minutely_15: M extends readonly string[] ? PickRequestedArrayKeys<M> : undefined;
  hourly: H extends readonly string[] ? PickRequestedArrayKeys<H> : undefined;
  daily: D extends readonly string[] ? PickRequestedArrayKeys<D> : undefined;
}

export class WeatherApiError extends Error {
  public statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'WeatherApiError';
    this.statusCode = statusCode;
  }
}

export class WeatherApi {
  private buildUrl(config: WeatherApiRequestConfig): string {
    const params = new URLSearchParams();

    params.append('latitude', config.latitude.toString());
    params.append('longitude', config.longitude.toString());

    if (config.forecastDays) {
      params.append('forecast_days', config.forecastDays.toString());
    }

    if (config.pastDays) {
      params.append('past_days', config.pastDays.toString());
    }

    params.append('timezone', 'auto');

    if (config.current && config.current.length > 0) {
      params.append('current', config.current.join(','));
    }

    if (config.minutely_15 && config.minutely_15.length > 0) {
      params.append('minutely_15', config.minutely_15.join(','));
    }

    if (config.hourly && config.hourly.length > 0) {
      params.append('hourly', config.hourly.join(','));
    }

    if (config.daily && config.daily.length > 0) {
      params.append('daily', config.daily.join(','));
    }

    return `${BASE_URL}?${params.toString()}`;
  }

  public async getWeather<
    C extends readonly string[] | undefined = undefined,
    M extends readonly string[] | undefined = undefined,
    H extends readonly string[] | undefined = undefined,
    D extends readonly string[] | undefined = undefined
  >(config: WeatherApiRequestConfig & {
    current?: C;
    minutely_15?: M;
    hourly?: H;
    daily?: D;
  }): Promise<WeatherApiResponse<C, M, H, D>> {
    const url = this.buildUrl(config);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        let errorMessage = `API request failed with status: ${response.status}`;

        try {
          const errorData = await response.json();
          if (errorData.reason) {
            errorMessage = `API Error: ${errorData.reason}`;
          }
        } catch (e) {
        }

        throw new WeatherApiError(errorMessage, response.status);
      }

      const data = await response.json();

      return data as WeatherApiResponse<C, M, H, D>;
    } catch (error) {
      if (error instanceof WeatherApiError) {
        throw error;
      }

      throw new WeatherApiError(
        `Failed to fetch weather data: ${(error as Error).message}`
      );
    }
  }
}

export interface AirQualityApiRequestConfig {
  latitude: number;
  longitude: number;
  current?: readonly string[];
  hourly?: readonly string[];
  domains?: string;
  timezone?: string;
}

export interface AirQualityUnits {
  [key: string]: string;
}

export interface CurrentAirQualityBase {
  time: string;
  interval: number;
}

export interface AirQualityArrayBase {
  time: string[];
}

type AirQualityArrayElement<T extends readonly any[]> = T extends readonly (infer U)[] ? U : never;

type PickRequestedAirQualityKeys<T extends readonly string[]> = {
  [K in AirQualityArrayElement<T>]: number;
} & CurrentAirQualityBase;

type PickRequestedAirQualityArrayKeys<T extends readonly string[]> = {
  [K in AirQualityArrayElement<T>]: number[];
} & AirQualityArrayBase;

export interface AirQualityApiResponse<
  C extends readonly string[] | undefined = undefined,
  H extends readonly string[] | undefined = undefined
> {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;

  current_units: C extends readonly string[] ? AirQualityUnits : undefined;
  hourly_units: H extends readonly string[] ? AirQualityUnits : undefined;

  current: C extends readonly string[] ? PickRequestedAirQualityKeys<C> : undefined;
  hourly: H extends readonly string[] ? PickRequestedAirQualityArrayKeys<H> : undefined;
}

export class AirQualityApi {
  private buildUrl(config: AirQualityApiRequestConfig): string {
    const params = new URLSearchParams();

    params.append('latitude', config.latitude.toString());
    params.append('longitude', config.longitude.toString());

    if (config.domains) {
      params.append('domains', config.domains);
    }

    params.append('timezone', config.timezone || 'auto');

    if (config.current && config.current.length > 0) {
      params.append('current', config.current.join(','));
    }

    if (config.hourly && config.hourly.length > 0) {
      params.append('hourly', config.hourly.join(','));
    }

    return `${AIR_QUALITY_BASE_URL}?${params.toString()}`;
  }

  public async getAirQuality<
    C extends readonly string[] | undefined = undefined,
    H extends readonly string[] | undefined = undefined
  >(config: AirQualityApiRequestConfig & {
    current?: C;
    hourly?: H;
  }): Promise<AirQualityApiResponse<C, H>> {
    const url = this.buildUrl(config);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        let errorMessage = `API request failed with status: ${response.status}`;

        try {
          const errorData = await response.json();
          if (errorData.reason) {
            errorMessage = `API Error: ${errorData.reason}`;
          }
        } catch (e) {
        }

        throw new WeatherApiError(errorMessage, response.status);
      }

      const data = await response.json();

      return data as AirQualityApiResponse<C, H>;
    } catch (error) {
      if (error instanceof WeatherApiError) {
        throw error;
      }

      throw new WeatherApiError(
        `Failed to fetch air quality data: ${(error as Error).message}`
      );
    }
  }
}

export const weatherApi = new WeatherApi();
export const airQualityApi = new AirQualityApi();
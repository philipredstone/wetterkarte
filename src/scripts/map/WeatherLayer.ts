import L from 'leaflet';

interface WeatherData {
  ts: string;
  cities: {
    coordinates: [number, number];
    forecast: [string, number, number][];
  }[];
}

interface WeatherLayerOptions extends L.LayerOptions {
  url: string;
  safetyMargin?: number;
  weatherIcons?: Record<number, string>;
  prioritizeExtremes?: boolean;
  priorityCities?: string[];
  onDataLoaded?: (data: WeatherData) => void;
  onLoadError?: (error: Error) => void;
}

const DEFAULT_WEATHER_ICONS: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
  51: "🌧️", 53: "🌧️", 55: "🌧️", 56: "🌧️❄️", 57: "🌧️❄️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️❄️", 67: "🌧️❄️",
  71: "🌨️", 73: "🌨️", 75: "🌨️", 77: "🌨️", 80: "🌦️",
  81: "🌦️", 82: "🌦️", 85: "🌨️", 86: "🌨️", 95: "⛈️",
  96: "⛈️", 99: "⛈️"
};

/**
 * Binary parser for weather data
 */
class BinaryParser {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  parse(): WeatherData {
    const magic = String.fromCharCode(
      this.view.getUint8(this.offset++),
      this.view.getUint8(this.offset++),
      this.view.getUint8(this.offset++),
      this.view.getUint8(this.offset++)
    );
    
    if (magic !== "WBIN") {
      throw new Error("Invalid format");
    }

    const version = this.view.getUint8(this.offset++);
    if (version !== 2) {
      throw new Error(`Unsupported version: ${version}`);
    }

    const seconds = this.view.getUint32(this.offset, false);
    this.offset += 4;
    const timestamp = new Date((seconds + 946684800) * 1000).toISOString();

    const cityCount = this.view.getUint8(this.offset++);
    const cities = [];

    for (let i = 0; i < cityCount; i++) {
      const encodedLat = this.view.getUint16(this.offset, false);
      this.offset += 2;
      const lat = (encodedLat / 100.0) - 90.0;

      const encodedLng = this.view.getUint16(this.offset, false);
      this.offset += 2;
      const lng = (encodedLng / 100.0) - 180.0;

      const forecastCount = this.view.getUint8(this.offset++);
      const forecasts = [];

      for (let j = 0; j < forecastCount; j++) {
        const hour = this.view.getUint8(this.offset++);
        const temp = this.view.getInt8(this.offset++) / 2.0;
        const code = this.view.getUint8(this.offset++);

        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00`;

        forecasts.push([timeStr, temp, code] as [string, number, number]);
      }

      cities.push({
        coordinates: [lat, lng] as [number, number],
        forecast: forecasts as [string, number, number][]
      });
    }

    return { ts: timestamp, cities: cities };
  }
}

/**
 * Weather Layer for Leaflet maps
 */
export class WeatherLayer extends L.LayerGroup {
  options: WeatherLayerOptions;
  
  private _weatherData: WeatherData | null = null;
  private _map: L.Map | null = null;
  private _isLoading = false;
  private _loadError: Error | null = null;
  private _priorityCitySet: Set<string> = new Set();
  
  private _markers: Map<string, {
    marker: L.Marker;
    temperature: number;
    weatherCode: number;
    visible: boolean;
  }> = new Map();
  private _markerBounds: Map<string, L.Bounds> = new Map();
  private _visibleMarkers: Set<string> = new Set();
  private _updateTimeoutId: number | null = null;
  private _zoomInProgress: boolean = false;

  constructor(options: WeatherLayerOptions) {
    super();
    
    this.options = {
      safetyMargin: 10,
      weatherIcons: DEFAULT_WEATHER_ICONS,
      prioritizeExtremes: true,
      priorityCities: [],
      ...options
    };

    if (this.options.priorityCities && this.options.priorityCities.length > 0) {
      this._priorityCitySet = new Set(this.options.priorityCities);
    }

    if (this.options.url) {
      this.loadData();
    }
  }

  onAdd(map: L.Map): this {
    this._map = map;
    super.onAdd(map);
    map.on('moveend', () => this.scheduleUpdate());
    map.on('zoomstart', () => { this._zoomInProgress = true; });
    map.on('zoomend', () => { 
      this._zoomInProgress = false;
      this.scheduleUpdate(50);
    });
    window.addEventListener('resize', () => this.scheduleUpdate());

    if (this._weatherData) {
      this.updateDisplay();
    }

    return this;
  }

  onRemove(map: L.Map): this {
    map.off('moveend');
    map.off('zoomstart');
    map.off('zoomend');

    if (this._updateTimeoutId !== null) {
      window.clearTimeout(this._updateTimeoutId);
      this._updateTimeoutId = null;
    }

    this._markers.forEach(markerData => {
      this.removeLayer(markerData.marker);
    });
    this._markers.clear();
    this._markerBounds.clear();
    this._visibleMarkers.clear();
    
    this._map = null;
    return super.onRemove(map);
  }

  loadData(): void {
    this._isLoading = true;

    const url = new URL(this.options.url, window.location.href);
    url.searchParams.append('_t', Date.now().toString());
    url.searchParams.append('_r', Math.random().toString(36).substring(2, 15));

    fetch(url.toString(), {
      cache: 'no-store',
      mode: 'cors',
      credentials: 'same-origin'
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(buffer => {
        try {
          const parser = new BinaryParser(buffer);
          this._weatherData = parser.parse();
          this._isLoading = false;

          if (this.options.onDataLoaded) {
            this.options.onDataLoaded(this._weatherData);
          }

          if (this._map) {
            this.updateDisplay();
          }
        } catch (error) {
          this.handleError(error instanceof Error ? error : new Error(String(error)));
        }
      })
      .catch(error => {
        this.handleError(error instanceof Error ? error : new Error(String(error)));
      });
  }

  // Set data directly
  setData(data: WeatherData): this {
    this._weatherData = data;
    this._isLoading = false;
    this._loadError = null;

    if (this._map) {
      this.updateDisplay();
    }
    return this;
  }

  // Set priority cities
  setPriorityCities(cities: string[]): this {
    this.options.priorityCities = cities;
    this._priorityCitySet = new Set(cities);

    if (this._map && this._weatherData) {
      this.updateDisplay();
    }
    return this;
  }

  // Reload data
  reload(): void {
    if (this.options.url) {
      this.loadData();
    }
  }

  // Get current data
  getData(): WeatherData | null {
    return this._weatherData;
  }

  // Check if data is loading
  isLoading(): boolean {
    return this._isLoading;
  }

  // Get any load error
  getLoadError(): Error | null {
    return this._loadError;
  }

  // Private helper methods
  private handleError(error: Error): void {
    this._isLoading = false;
    this._loadError = error;
    console.error("Error loading weather data:", error);

    if (this.options.onLoadError) {
      this.options.onLoadError(error);
    }
  }

  private scheduleUpdate(delay: number = 0): void {
    if (this._updateTimeoutId !== null) {
      window.clearTimeout(this._updateTimeoutId);
    }

    this._updateTimeoutId = window.setTimeout(() => {
      this._updateTimeoutId = null;
      this.updateDisplay();
    }, delay);
  }

  private updateDisplay(): void {
    if (!this._map || !this._weatherData) return;

    if (this._zoomInProgress) {
      this.scheduleUpdate(100);
      return;
    }

    const bounds = this._map.getBounds();
    const previouslyVisible = new Set(this._visibleMarkers);
    this._visibleMarkers.clear();
    this._markerBounds.clear();

    // Get first city ID for priority rendering
    let firstCityId: string | null = null;
    if (this._weatherData.cities.length > 0) {
      const [firstLat, firstLng] = this._weatherData.cities[0].coordinates;
      firstCityId = `${firstLat.toFixed(8)},${firstLng.toFixed(8)}`;
    }

    // Process visible cities
    const visibleCities = this._weatherData.cities
      .filter(city => {
        const [lat, lng] = city.coordinates;
        return bounds.contains(L.latLng(lat, lng)) && city.forecast.length > 0;
      })
      .map(city => {
        const [lat, lng] = city.coordinates;
        const cityId = `${lat.toFixed(8)},${lng.toFixed(8)}`;
        const [timeStr, temp, code] = city.forecast[0];
        
        return {
          id: cityId,
          coordinates: [lat, lng] as [number, number],
          temperature: temp,
          weatherCode: code,
          size: this.getMarkerSize(temp),
          isPriority: this._priorityCitySet.has(cityId) || (cityId === firstCityId)
        };
      });

    // Sort cities by priority then temperature extremeness
    visibleCities.sort((a, b) => {
      // First by priority
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;

      // Then by temperature extremeness if enabled
      if (this.options.prioritizeExtremes) {
        return Math.abs(b.temperature - 20) - Math.abs(a.temperature - 20);
      }

      return 0;
    });

    // Hide all previously visible markers
    previouslyVisible.forEach(cityId => {
      const markerData = this._markers.get(cityId);
      if (markerData) {
        const element = markerData.marker.getElement();
        if (element) element.style.display = 'none';
        markerData.visible = false;
      }
    });

    // Process and display cities without overlap
    visibleCities.forEach(city => {
      const latLng = L.latLng(city.coordinates[0], city.coordinates[1]);
      const point = this._map!.latLngToContainerPoint(latLng);
      const [width, height] = city.size;
      
      // Skip if would overlap with existing markers
      if (this.wouldOverlap(city.id, point, width, height)) {
        return;
      }

      // Create or update marker
      let markerData = this._markers.get(city.id);

      if (!markerData) {
        // Create new marker
        const icon = this.createMarkerIcon(city.temperature, city.weatherCode, city.size);
        const marker = L.marker(latLng, {
          icon: icon,
          interactive: false,
          keyboard: false,
          zIndexOffset: city.isPriority ? 2000 : 1000
        });

        markerData = {
          marker: marker,
          temperature: city.temperature,
          weatherCode: city.weatherCode,
          visible: false
        };

        this.addLayer(marker);
        this._markers.set(city.id, markerData);
      } else if (
        markerData.temperature !== city.temperature ||
        markerData.weatherCode !== city.weatherCode
      ) {
        // Update marker data
        markerData.temperature = city.temperature;
        markerData.weatherCode = city.weatherCode;
        
        // Update icon
        const icon = this.createMarkerIcon(city.temperature, city.weatherCode, city.size);
        markerData.marker.setIcon(icon);
      }

      // Show marker
      const element = markerData.marker.getElement();
      if (element) element.style.display = '';
      markerData.visible = true;
      this._visibleMarkers.add(city.id);

      // Update bounds for overlap detection
      this._markerBounds.set(city.id, L.bounds(
        [point.x - width / 2, point.y - height / 2],
        [point.x + width / 2, point.y + height / 2]
      ));
    });
  }

  private wouldOverlap(cityId: string, point: L.Point, width: number, height: number): boolean {
    if (!this._map) return true;

    const safetyMargin = this.options.safetyMargin || 10;
    const newBounds = L.bounds(
      [point.x - width / 2 - safetyMargin, point.y - height / 2 - safetyMargin],
      [point.x + width / 2 + safetyMargin, point.y + height / 2 + safetyMargin]
    );

    for (const id of this._visibleMarkers) {
      if (id === cityId) continue;
      
      const existingBounds = this._markerBounds.get(id);
      if (existingBounds && newBounds.intersects(existingBounds)) {
        return true;
      }
    }

    return false;
  }

  private getMarkerSize(temperature: number): [number, number] {
    const tempStr = temperature.toFixed(1);
    const digits = tempStr.length;
    const width = 70 + ((digits > 3) ? (digits - 3) * 8 : 0);
    return [width, 35];
  }

  private createMarkerIcon(temperature: number, weatherCode: number, size: [number, number]): L.DivIcon {
    const [width, height] = size;
    const icons = this.options.weatherIcons || DEFAULT_WEATHER_ICONS;
    const icon = icons[weatherCode] || "❓";

    const html = `
      <div class="weather-marker-container">
        <div class="weather-marker">
          <span class="weather-icon">${icon}</span>
          <span class="temperature">${temperature.toFixed(1)}°</span>
        </div>
      </div>
    `;

    return L.divIcon({
      html: html,
      className: '',
      iconSize: [width, height],
      iconAnchor: [width / 2, height / 2]
    });
  }
}

export default WeatherLayer;
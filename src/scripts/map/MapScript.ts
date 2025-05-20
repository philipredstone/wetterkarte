import L from "leaflet";
import 'leaflet/dist/leaflet.css';
import 'leaflet.fullscreen';

import { WindOverlay } from "./WindOverlay";
import { LegendControl } from "./LegendControl";
import { LayerControl } from "./LayerControl";
// import { WeatherLayer } from "./WeatherLayer";

type LayerType = 'temp' | 'wind' | 'radar' | 'satellit' | 'lightpollution';

interface BaseLayerConfig {
  type: LayerType;
  maxNativeZoom: number;
  opacity: number;
  gradient: string[];
  labels: string[];
  borderColor: string;
  isTimeDependent: boolean;
}

interface TileLayerConfig extends BaseLayerConfig {
  layerType: 'tile';
  urlTemplate: (dateString: string) => string;
}

interface WMSLayerConfig extends BaseLayerConfig {
  layerType: 'wms';
  wmsUrl: string;
  wmsParams: L.WMSOptions;
}

type LayerConfig = TileLayerConfig | WMSLayerConfig;

class DateUtils {
  static getTimestampDate(offset: number): Date {
    const date = new Date();
    date.setHours(date.getHours() + offset);
    return date;
  }

  static formatGermanDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = [
      "Januar", "Februar", "März", "April", "Mai", "Juni",
      "Juli", "August", "September", "Oktober", "November", "Dezember"
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:00 Uhr`;
  }

  static formatDate(offset: number): string {
    return this.formatGermanDate(this.getTimestampDate(offset));
  }

  static getDateString(offset: number): string {
    const date = this.getTimestampDate(offset);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}00`;
  }
}

// Layer configuration data
const LAYERS: Record<LayerType, LayerConfig> = {
  temp: {
    type: 'temp',
    layerType: 'tile',
    maxNativeZoom: 7,
    opacity: 0.7,
    gradient: ['#26587e', '#26587e', '#26597f', '#26597f', '#265b81', '#265b81', '#265c82', '#265c82', '#265e83', '#265e83', '#265f84', '#265f84', '#266185', '#266185', '#266286', '#266286', '#266487', '#266487', '#266588', '#266588', '#27678a', '#27678a', '#367089', '#367089', '#457a89', '#457a89', '#548389', '#548389', '#648d89', '#648d89', '#839980', '#839980', '#a3a678', '#a3a678', '#c3b36f', '#c3b36f', '#e3c067', '#e3c067', '#e0b15b', '#e0b15b', '#dea250', '#dea250', '#db9344', '#db9344', '#d98539', '#d98539', '#ca7034', '#ca7034', '#ca7034', '#bc5c30', '#bc5c30', '#ae472b', '#ae472b', '#a03327', '#a03327', '#9f3226', '#9f3226', '#9e3125', '#9e3125', '#9d3025', '#9d3025'],
    labels: ['-20°C', '-19°C', '-18°C', '-17°C', '-16°C', '-15°C', '-14°C', '-13°C', '-12°C', '-11°C', '-10°C', '-9°C', '-8°C', '-7°C', '-6°C', '-5°C', '-4°C', '-3°C', '-2°C', '-1°C', '-0°C', '1°C', '2°C', '3°C', '4°C', '5°C', '6°C', '7°C', '8°C', '9°C', '10°C', '11°C', '12°C', '13°C', '14°C', '15°C', '16°C', '17°C', '18°C', '19°C', '20°C', '21°C', '22°C', '23°C', '24°C', '25°C', '26°C', '27°C', '28°C', '29°C', '30°C', '31°C', '32°C', '33°C', '34°C', '35°C', '36°C', '37°C', '38°C', '39°C', '40°C'],
    borderColor: '#ffffff',
    urlTemplate: (dateString: string) => `https://tiles.wetterkarte.org/T_2M/${dateString}/{z}/{x}/{y}.webp`,
    isTimeDependent: true
  },
  wind: {
    type: 'wind',
    layerType: 'tile',
    maxNativeZoom: 7,
    opacity: 0.7,
    gradient: ['#e4f0ff', '#dce9fa', '#d5e3f5', '#cdddf1', '#c6d6ec', '#b7cae3', '#b0c3de', '#a8bdd9', '#a1b7d5', '#92aacb', '#8ba4c7', '#839dc2', '#7c97bd', '#7591b9', '#6d89b1', '#6985ae', '#6582aa', '#627ea7', '#5a77a0', '#56739c', '#536f99', '#4f6b95', '#4b6892', '#44608b', '#405d87', '#3c5984', '#385580', '#314e79', '#2d4a76', '#294672', '#26436f', '#264470', '#264772', '#264973', '#264a74', '#264c75', '#264f78', '#265079', '#26527a', '#26537b', '#26567d', '#26587e', '#26597f', '#265b81', '#265c82', '#265f84', '#266185', '#266286', '#266487', '#27678a', '#367089', '#457a89', '#548389', '#648d89', '#a3a678', '#c3b36f', '#e3c067', '#e0b15b', '#db9344', '#d98539', '#ca7034', '#bc5c30', '#ae472b', '#9f3226', '#9e3125', '#9d3025', '#9d3024', '#9b2e23', '#9a2d22', '#982a22', '#972723', '#962424', '#941e26', '#921b27', '#911828', '#901628', '#8e102a', '#8c0d2b', '#8b0a2c', '#8a072d', '#88022f'],
    labels: ['0m/s', '1m/s', '2m/s', '3m/s', '4m/s', '5m/s', '6m/s', '7m/s', '8m/s', '9m/s', '10m/s', '11m/s', '12m/s', '13m/s', '14m/s', '15m/s', '16m/s', '17m/s', '18m/s', '19m/s', '20m/s', '21m/s', '22m/s', '23m/s', '24m/s', '25m/s', '26m/s', '27m/s', '28m/s', '29m/s', '30m/s', '31m/s', '32m/s', '33m/s', '34m/s', '35m/s', '36m/s', '37m/s', '38m/s', '39m/s', '40m/s', '41m/s', '42m/s', '43m/s', '44m/s', '45m/s', '46m/s', '47m/s', '48m/s', '49m/s', '50m/s', '51m/s', '52m/s', '53m/s', '54m/s', '55m/s', '56m/s', '57m/s', '58m/s', '59m/s', '60m/s', '61m/s', '62m/s', '63m/s', '64m/s', '65m/s', '66m/s', '67m/s', '68m/s', '69m/s', '70m/s', '71m/s', '72m/s', '73m/s', '74m/s', '75m/s', '76m/s', '77m/s', '78m/s', '79m/s', '80m/s'],
    borderColor: '#000000',
    urlTemplate: (dateString: string) => `https://tiles.wetterkarte.org/WIND/${dateString}/{z}/{x}/{y}.webp`,
    isTimeDependent: true
  },
  radar: {
    type: 'radar',
    layerType: 'tile',
    maxNativeZoom: 10,
    opacity: 0.7,
    gradient: ['#075cb4', '#0e5bb3', '#155ab1', '#1c59b0', '#2458af', '#fc5370', '#fc755a', '#fdb92f', '#fedb1a', '#fffd05'],
    labels: ['5dBZ', '10dBZ', '15dBZ', '20dBZ', '25dBZ', '30dBZ', '35dBZ', '40dBZ', '45dBZ', '50dBZ'],
    borderColor: '#000000',
    urlTemplate: (dateString: string) => 'https://radar.rainmap.app/latest/{z}/{x}/{y}.webp',
    isTimeDependent: false
  },
  lightpollution: {
    type: 'lightpollution',
    layerType: 'tile',
    maxNativeZoom: 11,
    opacity: 0.7,
    gradient: ["#0D1A2B", "#203A60", "#346D95", "#349181", "#60AE3F", "#A6BA28", "#F0B800", "#F07605", "#E72900", "#FFFFFF"],
    labels: [
      "0 nW/cm²/sr",
      "0.1 nW/cm²/sr",
      "0.3 nW/cm²/sr",
      "1 nW/cm²/sr",
      "3 nW/cm²/sr",
      "10 nW/cm²/sr",
      "30 nW/cm²/sr",
      "100 nW/cm²/sr",
      "300 nW/cm²/sr",
      "1000 nW/cm²/sr"
    ],
    borderColor: '#ffffff',
    urlTemplate: (dateString: string) => 'https://tiles.wetterkarte.org/viirs/{z}/{x}/{y}.webp',
    isTimeDependent: false
  },
  satellit: {
    type: 'satellit',
    layerType: 'wms',
    maxNativeZoom: 10,
    opacity: 0.8,
    gradient: [],
    labels: [],
    borderColor: '#ffffff',
    wmsUrl: 'https://maps.dwd.de/geoserver/ows',
    wmsParams: {
      layers: 'dwd:Satellite_meteosat_1km_euat_rgb_day_hrv_and_night_ir108_3h',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.8,
    },
    isTimeDependent: false
  }
};

class LayerService {
  static createLayer(layerConfig: LayerConfig, forecastOffset: number): L.Layer {
    switch (layerConfig.layerType) {
      case 'tile': {
        const dateString = DateUtils.getDateString(forecastOffset);
        const url = layerConfig.urlTemplate(dateString);
        return L.tileLayer(url, {
          maxNativeZoom: layerConfig.maxNativeZoom,
          opacity: layerConfig.opacity
        });
      }
      case 'wms': {
        return L.tileLayer.wms(layerConfig.wmsUrl, layerConfig.wmsParams);
      }
    }
  }

  static createWindOverlay(forecastOffset: number): WindOverlay {
    return new WindOverlay({
      baseURL: `https://cdn.wetterkarte.org/UV_COMP/${DateUtils.getDateString(forecastOffset)}.wind`,
    });
  }

  static getBorderStyle(layerConfig: LayerConfig): L.PathOptions {
    return {
      color: layerConfig.borderColor,
      weight: 1,
      opacity: 0.5,
      fillOpacity: 0.05,
      interactive: false
    };
  }
}

class WeatherMap {
  private map!: L.Map;
  private currentLayer: L.Layer | null = null;
  private currentLayerType: LayerType = 'temp';
  private forecastOffset: number = 0;
  private borderLayer: L.GeoJSON | null = null;
  private windOverlay: WindOverlay | null = null;
  private legendControl!: LegendControl;
  private layerControl!: LayerControl;

  constructor() {
    this.initMap = this.initMap.bind(this);
    this.setMapLayer = this.setMapLayer.bind(this);
    this.updateForecast = this.updateForecast.bind(this);
    this.handleLayerChange = this.handleLayerChange.bind(this);
    this.handleForecastChange = this.handleForecastChange.bind(this);
    this.handleForecastSlide = this.handleForecastSlide.bind(this);
  }

  setMapLayer(layerType: LayerType, offset: number = this.forecastOffset): void {
    if (!this.map) return;

    const layerConfig = LAYERS[layerType];

    if (this.currentLayer) {
      this.map.removeLayer(this.currentLayer);
    }

    if (this.windOverlay) {
      this.map.removeLayer(this.windOverlay);
      this.windOverlay = null;
    }

    this.currentLayer = LayerService.createLayer(layerConfig, offset);
    this.map.addLayer(this.currentLayer);

    if (layerType === 'wind') {
      this.windOverlay = LayerService.createWindOverlay(offset);
      this.map.addLayer(this.windOverlay);
    }

    if (this.borderLayer) {
      this.borderLayer.setStyle(LayerService.getBorderStyle(layerConfig));
    }

    this.legendControl.update(layerType);

    this.currentLayerType = layerType;
  }

  updateForecast(offset: number): void {
    this.forecastOffset = offset;
    this.setMapLayer(this.currentLayerType, offset);
  }

  handleLayerChange(layerType: string): void {
    if (!layerType || !LAYERS[layerType as LayerType]) return;
    this.setMapLayer(layerType as LayerType);
  }

  handleForecastChange(value: number): void {
    this.updateForecast(value);
  }

  handleForecastSlide(value: number): void {
    this.forecastOffset = value;

    if (LAYERS[this.currentLayerType].isTimeDependent) {
      this.setMapLayer(this.currentLayerType, value);
    }
  }

  initMap(): void {
    const mapContainer = document.getElementById('map-container') as HTMLDivElement;
    if (!mapContainer) return;

    const lat = parseFloat(mapContainer.getAttribute('data-lat') || '0');
    const lng = parseFloat(mapContainer.getAttribute('data-lng') || '0');
    let zoom = parseInt(mapContainer.getAttribute('data-zoom') || '5');
    const showMarker = mapContainer.getAttribute('data-marker') === 'true';
    const showLayerControl = mapContainer.getAttribute('data-layerselect') === 'true';
    const initialLayerType = (mapContainer.getAttribute('data-layer') || 'temp') as LayerType;

    if (window.matchMedia('(max-width: 767px)').matches) {
      zoom -= 1;
    }

    this.map = L.map('map', {
      center: [lat, lng],
      zoom,
      preferCanvas: true,
      zoomControl: true,
      attributionControl: false,
      zoomSnap: 0.01,
      zoomDelta: 0.01,
      // @ts-ignore
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: 'topleft'
      }
    });

    L.tileLayer('https://tiles.wetterkarte.org/base/{z}/{x}/{y}.webp', {
      attribution: '© OpenStreetMap contributors',
      maxNativeZoom: 10,
    }).addTo(this.map);

    // new WeatherLayer({
    //   url: 'https://cdn.wetterkarte.org/map.weather',
    //   prioritizeExtremes: true,
    //   onDataLoaded: (data) => console.log('Data loaded:', data.cities.length, 'cities'),
    //   onLoadError: (error) => console.error('Failed to load data:', error.message)
    // }).addTo(this.map);

    if (showMarker) {
      const divIcon = L.divIcon({
        html: '<div class="location-dot"></div>',
      });

      L.marker(this.map.getCenter(), { icon: divIcon }).addTo(this.map);
    }

    this.legendControl = new LegendControl(LAYERS, { position: 'topright' });
    this.map.addControl(this.legendControl);

    if (showLayerControl) {
      this.layerControl = new LayerControl(
        LAYERS,
        { position: 'bottomleft' },
        {
          onLayerChange: this.handleLayerChange,
          onForecastChange: this.handleForecastChange,
          onForecastSlide: this.handleForecastSlide,
          formatDateFn: DateUtils.formatDate.bind(DateUtils)
        }
      );
      this.map.addControl(this.layerControl);
    }

    fetch('/germany.geojson')
      .then(response => response.json())
      .then(data => {
        this.borderLayer = L.geoJSON(data, {
          style: () => ({
            color: '#ffffff',
            weight: 1,
            opacity: 0.5,
            fillOpacity: 0.05,
            interactive: false
          })
        }).addTo(this.map);

        if (this.currentLayerType) {
          this.borderLayer.setStyle(LayerService.getBorderStyle(LAYERS[this.currentLayerType]));
        }
      });

    this.setMapLayer(initialLayerType);
  }
}

const weatherMap = new WeatherMap();
document.addEventListener('DOMContentLoaded', weatherMap.initMap);
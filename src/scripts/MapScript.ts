import L from "leaflet";
import 'leaflet/dist/leaflet.css';

import { WindOverlay } from "./WindOverlay";

let map: L.Map;
let currentLayer: L.TileLayer | null = null;
let currentLayerType: keyof typeof LAYERS = 'temp';
let forecastOffset: number = 0;
let borderLayer: L.GeoJSON | null = null;
let windOverlay: WindOverlay


const getTimestampDate = (offset: number): Date => {
  const date = new Date();
  date.setHours(date.getHours() + offset);
  return date;
};

const formatGermanDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:00 Uhr`;
};

const getDateString = (offset: number): string => {
  const date = getTimestampDate(offset);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}00`;
};

const LAYERS = {
  temp: {
    urlTemplate: (dateString: string) => `https://tiles.wetterkarte.org/T_2M/${dateString}/{z}/{x}/{y}.webp`,
    attribution: '© hstin',
    maxNativeZoom: 7,
    opacity: 0.7,
    gradient: ['#26587e', '#26587e', '#26597f', '#26597f', '#265b81', '#265b81', '#265c82', '#265c82', '#265e83', '#265e83', '#265f84', '#265f84', '#266185', '#266185', '#266286', '#266286', '#266487', '#266487', '#266588', '#266588', '#27678a', '#27678a', '#367089', '#367089', '#457a89', '#457a89', '#548389', '#548389', '#648d89', '#648d89', '#839980', '#839980', '#a3a678', '#a3a678', '#c3b36f', '#c3b36f', '#e3c067', '#e3c067', '#e0b15b', '#e0b15b', '#dea250', '#dea250', '#db9344', '#db9344', '#d98539', '#d98539', '#ca7034', '#ca7034', '#ca7034', '#bc5c30', '#bc5c30', '#ae472b', '#ae472b', '#a03327', '#a03327', '#9f3226', '#9f3226', '#9e3125', '#9e3125', '#9d3025', '#9d3025'],
    labels: ['-20°C', '-19°C', '-18°C', '-17°C', '-16°C', '-15°C', '-14°C', '-13°C', '-12°C', '-11°C', '-10°C', '-9°C', '-8°C', '-7°C', '-6°C', '-5°C', '-4°C', '-3°C', '-2°C', '-1°C', '-0°C', '1°C', '2°C', '3°C', '4°C', '5°C', '6°C', '7°C', '8°C', '9°C', '10°C', '11°C', '12°C', '13°C', '14°C', '15°C', '16°C', '17°C', '18°C', '19°C', '20°C', '21°C', '22°C', '23°C', '24°C', '25°C', '26°C', '27°C', '28°C', '29°C', '30°C', '31°C', '32°C', '33°C', '34°C', '35°C', '36°C', '37°C', '38°C', '39°C', '40°C'],
    borderColor: '#ffffff',
  },
  wind: {
    urlTemplate: (dateString: string) => `https://tiles.wetterkarte.org/WIND/${dateString}/{z}/{x}/{y}.webp`,
    attribution: '© hstin',
    maxNativeZoom: 7,
    opacity: 0.7,
    gradient: ['#e4f0ff', '#dce9fa', '#d5e3f5', '#cdddf1', '#c6d6ec', '#b7cae3', '#b0c3de', '#a8bdd9', '#a1b7d5', '#92aacb', '#8ba4c7', '#839dc2', '#7c97bd', '#7591b9', '#6d89b1', '#6985ae', '#6582aa', '#627ea7', '#5a77a0', '#56739c', '#536f99', '#4f6b95', '#4b6892', '#44608b', '#405d87', '#3c5984', '#385580', '#314e79', '#2d4a76', '#294672', '#26436f', '#264470', '#264772', '#264973', '#264a74', '#264c75', '#264f78', '#265079', '#26527a', '#26537b', '#26567d', '#26587e', '#26597f', '#265b81', '#265c82', '#265f84', '#266185', '#266286', '#266487', '#27678a', '#367089', '#457a89', '#548389', '#648d89', '#a3a678', '#c3b36f', '#e3c067', '#e0b15b', '#db9344', '#d98539', '#ca7034', '#bc5c30', '#ae472b', '#9f3226', '#9e3125', '#9d3025', '#9d3024', '#9b2e23', '#9a2d22', '#982a22', '#972723', '#962424', '#941e26', '#921b27', '#911828', '#901628', '#8e102a', '#8c0d2b', '#8b0a2c', '#8a072d', '#88022f'],
    labels: ['0m/s', '1m/s', '2m/s', '3m/s', '4m/s', '5m/s', '6m/s', '7m/s', '8m/s', '9m/s', '10m/s', '11m/s', '12m/s', '13m/s', '14m/s', '15m/s', '16m/s', '17m/s', '18m/s', '19m/s', '20m/s', '21m/s', '22m/s', '23m/s', '24m/s', '25m/s', '26m/s', '27m/s', '28m/s', '29m/s', '30m/s', '31m/s', '32m/s', '33m/s', '34m/s', '35m/s', '36m/s', '37m/s', '38m/s', '39m/s', '40m/s', '41m/s', '42m/s', '43m/s', '44m/s', '45m/s', '46m/s', '47m/s', '48m/s', '49m/s', '50m/s', '51m/s', '52m/s', '53m/s', '54m/s', '55m/s', '56m/s', '57m/s', '58m/s', '59m/s', '60m/s', '61m/s', '62m/s', '63m/s', '64m/s', '65m/s', '66m/s', '67m/s', '68m/s', '69m/s', '70m/s', '71m/s', '72m/s', '73m/s', '74m/s', '75m/s', '76m/s', '77m/s', '78m/s', '79m/s', '80m/s'],
    borderColor: '#000000',
  },
  radar: {
    url: 'https://radar.rainmap.app/latest/{z}/{x}/{y}.webp',
    attribution: '© hstin',
    maxNativeZoom: 10,
    gradient: ['#075cb4', '#0e5bb3', '#155ab1', '#1c59b0', '#2458af', '#fc5370', '#fc755a', '#fdb92f', '#fedb1a', '#fffd05'],
    labels: ['5dBZ', '10dBZ', '15dBZ', '20dBZ', '25dBZ', '30dBZ', '35dBZ', '40dBZ', '45dBZ', '50dBZ'],
    borderColor: '#000000',
  }
};

export const initMap = () => {
  const mapContainer = document.getElementById('map-container') as HTMLDivElement;

  let latS = mapContainer.getAttribute('data-lat')!;
  let lngS = mapContainer.getAttribute('data-lng')!;

  const lat = parseFloat(latS);
  const lng = parseFloat(lngS);
  const center = [lat, lng];

  const zoomS = mapContainer.getAttribute('data-zoom')!;
  let zoom = parseInt(zoomS);

  //check if mobile
  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  if (isMobile) {
    zoom -= 1;
  }


  // Initialize map with the same configuration
  map = L.map('map', {
    center: center,
    zoom: zoom,
    preferCanvas: true,
    zoomControl: true,
    dragging: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    boxZoom: true,
    keyboard: true,
    attributionControl: false,
    zoomSnap: 0.01,
    zoomDelta: 0.01,
  });

  L.tileLayer('https://tiles.wetterkarte.org/base/{z}/{x}/{y}.webp', {
    attribution: '© OpenStreetMap contributors',
    maxNativeZoom: 10,
  }).addTo(map);

  // Get initial layer type
  currentLayerType = mapContainer.getAttribute('data-layer') as keyof typeof LAYERS;

  // Add border layer
  fetch('/germany.geojson')
    .then(response => response.json())
    .then(data => {
      borderLayer = L.geoJSON(data, {
        style: function (feature) {
          return {
            color: LAYERS[currentLayerType].borderColor,
            weight: 1,
            opacity: 0.5,
            fillOpacity: 0.05,
            interactive: false
          };
        }
      }).addTo(map);
    });

  // Initialize the first layer
  switch (currentLayerType) {
    case 'temp':
      currentLayer = L.tileLayer(LAYERS.temp.urlTemplate(getDateString(forecastOffset)), LAYERS.temp).addTo(map);
      updateLegend('temp');
      break;
    case 'wind':
      currentLayer = L.tileLayer(LAYERS.wind.urlTemplate(getDateString(forecastOffset)), LAYERS.wind).addTo(map);

      windOverlay = new WindOverlay({
        baseURL: `https://cdn.wetterkarte.org/UV_COMP/${getDateString(forecastOffset)}.wind`,
      });
      map.addLayer(windOverlay);

      updateLegend('wind');
      break;
    case 'radar':
      currentLayer = L.tileLayer(LAYERS.radar.url, LAYERS.radar).addTo(map);
      updateLegend('radar');
      break;
  }




  // Update button event listeners for new class names
  const buttons = document.querySelectorAll('.control-button');
  buttons.forEach((button) => {
    button.addEventListener('click', (e: Event) => {
      const target = e.currentTarget as HTMLButtonElement;
      switchLayer(target);
    });
  });

  // Initialize forecast slider
  const forecastSlider = document.getElementById('forecast-slider') as HTMLInputElement;

  if (forecastSlider) {
    const timeLabel = document.getElementById('forecast-hour') as HTMLSpanElement;

    forecastSlider.value = forecastOffset.toString();
    timeLabel.innerText = formatGermanDate(getTimestampDate(forecastOffset));

    forecastSlider.addEventListener('input', () => {
      forecastOffset = parseInt(forecastSlider.value, 10);
      timeLabel.innerText = formatGermanDate(getTimestampDate(forecastOffset));

      if (currentLayerType === 'temp' || currentLayerType === 'wind') {
        if (currentLayer) {
          map.removeLayer(currentLayer);
        }
        const newUrl = LAYERS[currentLayerType].urlTemplate(getDateString(forecastOffset));
        currentLayer = L.tileLayer(newUrl, LAYERS[currentLayerType]).addTo(map);
        updateLegend(currentLayerType);
      }
    });

    forecastSlider.addEventListener('change', () => {
      if (currentLayerType === 'wind') {
        if (windOverlay) map.removeLayer(windOverlay);
        windOverlay = new WindOverlay({
          baseURL: `https://cdn.wetterkarte.org/UV_COMP/${getDateString(forecastOffset)}.wind`,
        });
        map.addLayer(windOverlay);
      }

    });





  }
};

const switchLayer = (button: HTMLButtonElement) => {
  if (!map) return;

  const layerType = button.dataset.layer as keyof typeof LAYERS;
  if (!layerType || !LAYERS[layerType]) return;

  // Update active state for new class names
  document.querySelectorAll('.control-button').forEach(btn =>
    btn.classList.remove('active')
  );
  button.classList.add('active');

  currentLayerType = layerType;

  const forecastSlider = document.querySelector('.forecast-slider') as HTMLElement;

  if (currentLayer) {
    map.removeLayer(currentLayer);
  }

  if (windOverlay) map.removeLayer(windOverlay)


  if (layerType === 'temp' || layerType === 'wind') {
    forecastSlider.style.display = 'flex';
    const newUrl = LAYERS[layerType].urlTemplate(getDateString(forecastOffset));
    currentLayer = L.tileLayer(newUrl, LAYERS[layerType]).addTo(map);
    const timeLabel = document.getElementById('forecast-hour') as HTMLSpanElement;
    timeLabel.innerText = formatGermanDate(getTimestampDate(forecastOffset));

    if (layerType === 'wind') {
      windOverlay = new WindOverlay({
        baseURL: `https://cdn.wetterkarte.org/UV_COMP/${getDateString(forecastOffset)}.wind`,
      });
      map.addLayer(windOverlay);
    }

  } else {
    forecastSlider.style.display = 'none';
    currentLayer = L.tileLayer(LAYERS[layerType].url, LAYERS[layerType]).addTo(map);
  }

  if (borderLayer) {
    borderLayer.setStyle(function (feature) {
      return {
        color: LAYERS[layerType].borderColor,
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.05
      };
    });
  }

  updateLegend(layerType);
};

const updateLegend = (layerType: keyof typeof LAYERS) => {
  const layer = LAYERS[layerType];
  const gradientColors = layer.gradient;
  const values = layer.labels;

  const minLabel = values[0];
  const maxLabel = values[values.length - 1];
  const midLabel = values[Math.floor(values.length / 2)];

  const rectWidth = 20;
  const tickLength = 0;
  const labelOffset = 2;
  const borderRadius = 3;

  const offscreen = document.createElement("canvas");
  const offCtx = offscreen.getContext("2d")!;
  offCtx.font = "12px sans-serif";
  const maxLabelWidth = Math.max(
    offCtx.measureText(maxLabel).width,
    offCtx.measureText(midLabel).width,
    offCtx.measureText(minLabel).width
  );

  const neededWidth = maxLabelWidth + tickLength + labelOffset + rectWidth;
  const canvas = document.getElementById("legend-canvas") as HTMLCanvasElement;
  const desiredCSSHeight = canvas.clientHeight || 150;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = neededWidth * dpr;
  canvas.height = desiredCSSHeight * dpr;
  canvas.style.width = `${neededWidth}px`;
  canvas.style.height = `${desiredCSSHeight}px`;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, neededWidth, desiredCSSHeight);

  function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  let gradient: CanvasGradient = ctx.createLinearGradient(0, desiredCSSHeight, 0, 0);
  gradientColors.forEach((color, index) => {
    gradient.addColorStop(index / (gradientColors.length - 1), color);
  });
  ctx.fillStyle = gradient;
  drawRoundedRect(ctx, 0, 0, rectWidth, desiredCSSHeight, borderRadius);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 0, 0, rectWidth, desiredCSSHeight, borderRadius);
  ctx.stroke();


  const labels = [
    { text: maxLabel, y: 0, baseline: "top" as CanvasTextBaseline },
    { text: midLabel, y: desiredCSSHeight / 2, baseline: "middle" as CanvasTextBaseline },
    { text: minLabel, y: desiredCSSHeight, baseline: "bottom" as CanvasTextBaseline }
  ];

  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#333";

  ctx.textAlign = "left";
  labels.forEach(label => {
    ctx.textBaseline = label.baseline;
    ctx.beginPath();
    ctx.moveTo(rectWidth, label.y);
    ctx.lineTo(rectWidth + tickLength, label.y);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillText(label.text, rectWidth + tickLength + labelOffset, label.y);
  });

};

document.addEventListener('DOMContentLoaded', function () {
  initMap();
});

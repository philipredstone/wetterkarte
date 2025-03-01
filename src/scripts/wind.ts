
import { TimeBarChart } from "./BarChart";
import { TimeLineChart } from "./LineChart";

interface WindData {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units: {
    time: string;
    wind_speed_10m: string;
    wind_direction_10m: string;
    wind_gusts_10m: string;
  };
  hourly: {
    time: string[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
  };
  current_units: {
    time: string;
    wind_speed_10m: string;
    wind_direction_10m: string;
    wind_gusts_10m: string;
  };
  current: {
    time: string;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
}

function getAttributeOrThrow(element: HTMLElement, attr: string): string {
  const value = element.getAttribute(attr);
  if (!value) {
    throw new Error(`Attribut "${attr}" nicht gefunden.`);
  }
  return value;
}

const widget = document.getElementById("weather-widget") as HTMLElement;
if (!widget) {
  throw new Error("Weather widget Element nicht gefunden!");
}
const lat = getAttributeOrThrow(widget, "data-lat");
const lng = getAttributeOrThrow(widget, "data-lng");
const cityName = getAttributeOrThrow(widget, "data-city");

const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=auto&forecast_days=7&past_days=1`;

async function fetchWindData(): Promise<void> {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP-Fehler! Status: ${response.status}`);
    }
    const windData = (await response.json()) as WindData;

    const currentWindSpeed = windData.current.wind_speed_10m;
    const currentWindDirection = windData.current.wind_direction_10m;
    const currentWindGusts = windData.current.wind_gusts_10m;
    const currentTime = new Date(windData.current.time);


    const windSpeedElement = document.getElementById("wind-speed") as HTMLElement;
    windSpeedElement.innerHTML = `
        Windgeschwindigkeit in ${cityName}: <strong>${currentWindSpeed} m/s</strong> aus ${formatWindDirection(currentWindDirection)}
      `;

    const windGustsElement = document.getElementById("wind-gusts") as HTMLElement;
    windGustsElement.innerHTML = `
        Böen in ${cityName}: <strong>${currentWindGusts} m/s</strong> aus ${formatWindDirection(currentWindDirection)}
        `;

    const graphData = [];


    for (let i = 20; i < windData.hourly.time.length; i++) {
      graphData.push({ date: new Date(windData.hourly.time[i]), value: windData.hourly.wind_speed_10m[i] });
    }

    const container = document.getElementById("chart");
    if (container) {
      const chart = new TimeLineChart(container, graphData, {
        width: 800,
        height: 350,
        valueLabel: "Windgeschwindigkeit",
        valueUnit: "m/s",
        showPoints: false,
        smoothing: 'cardinal',
        smoothingTension: 0.7,
      });
      chart.render();
    }



    const updateInfoElement = document.getElementById("update-info") as HTMLElement;
    const formattedTime = currentTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    updateInfoElement.innerHTML = `Datenstand: <time datetime="${currentTime.toISOString()}">${formattedTime}</time>`;
  } catch (error) {
    console.error("Fehler beim Laden der UV-Daten:", error);
    widget.innerHTML = `<p>Wind-Daten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>`;
  }
}

fetchWindData();

function formatWindDirection(degrees: number): string {
  const directions = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}
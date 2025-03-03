interface WeatherResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_units: {
    time: string;
    interval: string;
    weather_code: string;
  };
  current: {
    time: string;
    interval: number;
    weather_code: number;
  };
  hourly_units: {
    time: string;
    weather_code: string;
  };
  hourly: {
    time: string[];
    weather_code: number[];
  };
  daily_units?: {
    time: string;
    weather_code: string;
  };
  daily?: {
    time: string[];
    weather_code: number[];
  };
}

function getAttributeOrThrow(element: HTMLElement, attr: string): string {
  const value = element.getAttribute(attr);
  if (!value) {
    throw new Error(`Attribut "${attr}" nicht gefunden.`);
  }
  return value;
}

const weatherWidget = document.getElementById("weather-widget") as HTMLElement;
if (!weatherWidget) {
  throw new Error("Weather widget Element nicht gefunden!");
}
const lat = getAttributeOrThrow(weatherWidget, "data-lat");
const lng = getAttributeOrThrow(weatherWidget, "data-lng");
const cityName = getAttributeOrThrow(weatherWidget, "data-city");

const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code&forecast_days=7&models=icon_seamless&hourly=weather_code&daily=weather_code&timezone=auto`;

async function fetchWeather(): Promise<void> {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP-Fehler! Status: ${response.status}`);
    }
    const data = (await response.json()) as WeatherResponse;
    const { current, hourly, daily } = data;

    const thunderCodes = [95, 96, 99];
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const thunderEventIndex = hourly.time.findIndex((timeStr, i) => {
      const hourTime = new Date(timeStr);
      return hourTime >= now && hourTime < midnight && thunderCodes.includes(hourly.weather_code[i]);
    });

    let todayMessage = "";
    if (thunderEventIndex !== -1) {
      const thunderTime = new Date(hourly.time[thunderEventIndex]);
      const formattedThunderTime = thunderTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      todayMessage = `Heute wird es um ${formattedThunderTime} gewittern.`;
    } else {
      todayMessage = "Heute bleibt es gewitterfrei.";
    }

    const thunder7Days = daily?.weather_code?.some(code => thunderCodes.includes(code)) ?? false;
    const sevenDayMessage = thunder7Days
      ? "In den nächsten 7 Tagen wird es an mindestens einem Tag gewittern."
      : "In den nächsten 7 Tagen bleibt es gewitterfrei.";

    const currentTime = new Date(current.time);
    const formattedTime = currentTime.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const todayMessageElement = document.getElementById("today-message") as HTMLElement;
    todayMessageElement.innerHTML = todayMessage;
    const sevenDayMessageElement = document.getElementById("seven-day-message") as HTMLElement;
    sevenDayMessageElement.innerHTML = sevenDayMessage;

    const updateInfoElement = document.getElementById("update-info") as HTMLElement;
    updateInfoElement.innerHTML = `Letzte Aktualisierung: <time datetime="${currentTime.toISOString()}">${formattedTime}</time> Uhr`;

  } catch (error) {
    console.error("Fehler beim Laden der Wetterdaten:", error);
    weatherWidget.innerHTML = `<p>Wetterdaten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>`;
  }
}

fetchWeather();

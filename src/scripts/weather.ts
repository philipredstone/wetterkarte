interface WeatherData {
    latitude: number;
    longitude: number;
    timezone: string;
    current_units: {
      time: string;
      interval: string;
      temperature_2m: string;
      relative_humidity_2m: string;
      precipitation: string;
      wind_speed_10m: string;
      weather_code: string;
    };
    current: {
      time: string;
      interval: number;
      temperature_2m: number;
      relative_humidity_2m: number;
      precipitation: number;
      wind_speed_10m: number;
      weather_code: number;
    };
    hourly: {
      time: string[];
      temperature_2m: number[];
      wind_speed_10m: number[];
      wind_direction_10m: number[];
      weather_code: number[];
    };
    hourly_units: {
      temperature_2m: string;
      wind_speed_10m: string;
      wind_direction_10m: string;
      weather_code?: string;
    };
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      weather_code: number[];
    };
    daily_units: {
      temperature_2m_max: string;
      temperature_2m_min: string;
      weather_code?: string;
    };
  }
  
  function getAttributeOrThrow(element: HTMLElement, attr: string): string {
    const value = element.getAttribute(attr);
    if (!value) {
      throw new Error(`Attribut "${attr}" nicht gefunden.`);
    }
    return value;
  }
  
  function getWindDirection(degrees: number): string {
    const directions = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }
  
  function formatHour(date: Date): string {
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  
  function isDayTime(date: Date): boolean {
    const hour = date.getHours();
    return hour >= 6 && hour < 18;
  }
  
  /**
   * Returns a weather icon (img element) based on the WMO weather code.
   */
  function getWeatherIcon(weatherCode: number, date: Date): string {
    let imageName = "";
    let weatherTitle = "";
  
    if (weatherCode === 0 || weatherCode === 1) {
      imageName = isDayTime(date) ? "clear-day.svg" : "clear-night.svg";
      weatherTitle = "Klar";
    } else if (weatherCode === 2) {
      imageName = isDayTime(date) ? "cloudy.svg" : "partly-cloudy-night.svg";
      weatherTitle = "Wolkig";
    } else if (weatherCode === 3) {
      imageName = "overcast.svg";
      weatherTitle = "Überwiegend bewölkt";
    } else if ([45, 48].includes(weatherCode)) {
      imageName = isDayTime(date) ? "fog-day.svg" : "fog-night.svg";
      weatherTitle = "Nebel";
    } else if ([51, 53, 55].includes(weatherCode)) {
      imageName = "drizzle.svg";
      weatherTitle = "Nieselregen";
    } else if ([56, 57].includes(weatherCode)) {
      imageName = "drizzle.svg";
      weatherTitle = "Nieselregen";
    } else if ([61, 63, 65].includes(weatherCode)) {
      imageName = "rain.svg";
      weatherTitle = "Regen";
    } else if ([66, 67].includes(weatherCode)) {
      imageName = "sleet.svg";
      weatherTitle = "Schneeregen";
    } else if ([71, 73, 75, 77].includes(weatherCode)) {
      imageName = "snowflake.svg";
      weatherTitle = "Schneesturm";
    } else if ([80, 81, 82].includes(weatherCode)) {
      imageName = isDayTime(date) ? "partly-cloudy-day-rain.svg" : "partly-cloudy-night-rain.svg";
      weatherTitle = "Regen";
    } else if ([85, 86].includes(weatherCode)) {
      imageName = isDayTime(date) ? "partly-cloudy-day-snow.svg" : "partly-cloudy-night-snow.svg";
      weatherTitle = "Schnee";
    } else if ([95, 96, 99].includes(weatherCode)) {
      imageName = "thunderstorms.svg";
      weatherTitle = "Gewitter";
    } else {
      imageName = "not-available.svg";
      weatherTitle = "Keine Wetterdaten";
    }
  
    return `<img src="/images/${imageName}" alt="${weatherTitle}" title="${weatherTitle}" style="width: 20rem; height: auto; filter: drop-shadow(5px 5px 10px #00000066);"/>`;
  }
  
  const widget = document.getElementById("weather-widget") as HTMLElement;
  if (!widget) {
    throw new Error("Weather widget Element nicht gefunden!");
  }
  
  const lat = getAttributeOrThrow(widget, "data-lat");
  const lng = getAttributeOrThrow(widget, "data-lng");
  const cityName = getAttributeOrThrow(widget, "data-city");
  
  // Updated API URL including daily parameters for a 7-day forecast
  const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
  
  async function fetchWeatherData(): Promise<void> {
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP-Fehler! Status: ${response.status}`);
      }
      const weatherData = await response.json() as WeatherData;
  
      const now = new Date();
      let currentIndex = weatherData.hourly.time.findIndex((t) => new Date(t) >= now);
      if (currentIndex === -1) {
        currentIndex = weatherData.hourly.time.length - 1;
      }
  
      // Current Temperature
      const currentTemp = weatherData.current.temperature_2m;
      const tempElement = document.getElementById("temperature") as HTMLElement;
      tempElement.innerHTML = `${currentTemp.toFixed(1)}°C`;
  
      // Current Icon
      const currentIcon = getWeatherIcon(weatherData.current.weather_code, new Date(weatherData.current.time));
      const iconElement = document.getElementById("icon") as HTMLElement;
      iconElement.innerHTML = currentIcon;
  
      // Current Humidity
      const currentHumidity = weatherData.current.relative_humidity_2m;
      const humidityElement = document.getElementById("humidity") as HTMLElement;
      humidityElement.innerHTML = `${currentHumidity.toFixed(1)}%`;
  
      // Current Rainfall
      const currentRainfall = weatherData.current.precipitation;
      const rainfallElement = document.getElementById("rainfall") as HTMLElement;
      rainfallElement.innerHTML = `${currentRainfall.toFixed(1)} mm`;
  
      // Current Wind
      const currentWind = weatherData.hourly.wind_speed_10m[currentIndex];
      const windElement = document.getElementById("wind") as HTMLElement;
      windElement.innerHTML = `${currentWind.toFixed(1)} km/h`;
  
      // Hourly Forecast
      const hourlyElement = document.getElementById("hourly-forecast") as HTMLElement;
      let hourlyHTML = '';
  
      for (let i = currentIndex; i < currentIndex + 24 && i < weatherData.hourly.time.length; i++) {
        const time = new Date(weatherData.hourly.time[i]);
        const temp = weatherData.hourly.temperature_2m[i];
        const windSpeed = weatherData.hourly.wind_speed_10m[i];
        const weatherCode = weatherData.hourly.weather_code[i];
        const icon = getWeatherIcon(weatherCode, time);
        const isCurrentHour = i === currentIndex;
  
        hourlyHTML += `
          <div class=${isCurrentHour ? "current-hour" : ""}>
            <div>${formatHour(time)}</div>
            <div>${icon}</div>
            <div>${temp.toFixed(1)}°C</div>
            <div>
              <div>${windSpeed.toFixed(1)} km/h</div>
            </div>
          </div>
        `;
      }
      hourlyElement.innerHTML = hourlyHTML;
  
      // 7-Day Forecast as Vertical List with Card Styling
      const dailyElement = document.getElementById("daily-forecast") as HTMLElement;
      let dailyHTML = '';
      for (let i = 0; i < weatherData.daily.time.length; i++) {
        const date = new Date(weatherData.daily.time[i]);
        const maxTemp = weatherData.daily.temperature_2m_max[i];
        const minTemp = weatherData.daily.temperature_2m_min[i];
        const weatherCode = weatherData.daily.weather_code[i];
        const icon = getWeatherIcon(weatherCode, date);
        // Format date to show weekday and date (e.g., "Mo, 20.02.")
        const formattedDate = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
        dailyHTML += `
          <div class="daily-forecast-item forecast-card">
            <div class="daily-date">${formattedDate}</div>
            <div class="daily-icon">${icon}</div>
            <div class="daily-temp">${maxTemp.toFixed(1)}°C / ${minTemp.toFixed(1)}°C</div>
          </div>
        `;
      }
      dailyElement.innerHTML = dailyHTML;
  
      const updateInfoElement = document.getElementById("update-info") as HTMLElement;
      const currentTime = new Date(weatherData.current.time);
      const formattedTime = formatHour(currentTime);
      updateInfoElement.innerHTML = `Letzte Aktualisierung: ${formattedTime} Uhr`;
  
    } catch (error) {
      console.error("Fehler beim Laden der Wetterdaten:", error);
      widget.innerHTML = `<p>Wetterdaten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>`;
    }
  }
  
  fetchWeatherData();
  
  class ForecastScroll {
    private container: HTMLElement;
    private scrollContainer: HTMLElement;
    private leftButton: HTMLButtonElement;
    private rightButton: HTMLButtonElement;
    private scrollAmount: number = 240;
  
    constructor() {
      this.container = document.querySelector('.forecast-container')!;
      this.scrollContainer = this.container.querySelector('.forecast-grid')!;
      this.leftButton = this.container.querySelector('.scroll-left')!;
      this.rightButton = this.container.querySelector('.scroll-right')!;
  
      this.init();
    }
  
    private init(): void {
      this.leftButton.addEventListener('click', () => this.scroll('left'));
      this.rightButton.addEventListener('click', () => this.scroll('right'));
  
      this.scrollContainer.addEventListener('scroll', () => this.updateButtonStates());
  
      const observer = new MutationObserver(() => {
        this.updateButtonStates();
      });
  
      observer.observe(this.scrollContainer, {
        childList: true,
        subtree: true,
        attributes: true
      });
  
      this.checkForOverflow();
      window.addEventListener('resize', () => this.updateButtonStates());
    }
  
    private checkForOverflow(): void {
      this.updateButtonStates();
      setTimeout(() => {
        this.updateButtonStates();
      }, 100);
    }
  
    private scroll(direction: 'left' | 'right'): void {
      const newScrollPosition = this.scrollContainer.scrollLeft +
        (direction === 'left' ? -this.scrollAmount : this.scrollAmount);
      this.scrollContainer.scrollTo({
        left: newScrollPosition,
        behavior: 'smooth'
      });
    }
  
    private updateButtonStates(): void {
      const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer;
      const canScroll = scrollWidth > clientWidth;
      this.leftButton.style.display = canScroll ? 'flex' : 'none';
      this.rightButton.style.display = canScroll ? 'flex' : 'none';
  
      if (canScroll) {
        this.leftButton.disabled = scrollLeft <= 0;
        this.rightButton.disabled = scrollLeft >= scrollWidth - clientWidth;
      }
    }
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    new ForecastScroll();
  });
  
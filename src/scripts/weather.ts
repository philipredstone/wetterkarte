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

/**
 * Helper class to manage element operations and handle potential null values
 */
class ElementManager {
  // Cache elements to avoid multiple DOM lookups
  private static elementCache: Map<string, HTMLElement> = new Map();

  /**
   * Safely gets an element by ID, with type assertion
   */
  static getElementById<T extends HTMLElement>(id: string, required = true): T | null {
    if (this.elementCache.has(id)) {
      return this.elementCache.get(id) as T;
    }

    const element = document.getElementById(id) as T | null;
    
    if (required && !element) {
      console.error(`Required element with ID "${id}" not found`);
    }
    
    if (element) {
      this.elementCache.set(id, element);
    }
    
    return element;
  }

  /**
   * Gets an attribute from an element or throws an error if missing
   */
  static getAttributeOrThrow(element: HTMLElement, attr: string): string {
    const value = element.getAttribute(attr);
    if (!value) {
      throw new Error(`Attribut "${attr}" nicht gefunden.`);
    }
    return value;
  }

  /**
   * Safely updates innerHTML and handles potential errors
   */
  static updateContent(id: string, content: string): void {
    const element = this.getElementById(id, false);
    if (element) {
      element.innerHTML = content;
    }
  }

  /**
   * Safely updates aria-live regions with text content for accessibility
   */
  static updateAriaLiveRegion(id: string, content: string): void {
    const element = this.getElementById(id, false);
    if (element) {
      // For screen readers, we want to set textContent rather than innerHTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      element.textContent = tempDiv.textContent || '';
      // Then update the visual content with innerHTML
      element.innerHTML = content;
    }
  }
}

/**
 * Weather utilities for formatting and conversions
 */
class WeatherUtils {
  /**
   * Converts wind degrees to direction text
   */
  static getWindDirection(degrees: number): string {
    const directions = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }

  /**
   * Formats time to show hours and minutes
   */
  static formatHour(date: Date): string {
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Determines if the current time is during daylight hours
   */
  static isDayTime(date: Date): boolean {
    const hour = date.getHours();
    return hour >= 6 && hour < 18;
  }

  /**
   * Returns a weather icon HTML based on the WMO weather code
   */
  static getWeatherIcon(weatherCode: number, date: Date, large = false): string {
    let imageName = "";
    let weatherTitle = "";

    // Map weather codes to appropriate icons and titles
    if (weatherCode === 0 || weatherCode === 1) {
      imageName = this.isDayTime(date) ? "clear-day.svg" : "clear-night.svg";
      weatherTitle = "Klar";
    } else if (weatherCode === 2) {
      imageName = this.isDayTime(date) ? "cloudy.svg" : "partly-cloudy-night.svg";
      weatherTitle = "Wolkig";
    } else if (weatherCode === 3) {
      imageName = "overcast.svg";
      weatherTitle = "Überwiegend bewölkt";
    } else if ([45, 48].includes(weatherCode)) {
      imageName = this.isDayTime(date) ? "fog-day.svg" : "fog-night.svg";
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
      imageName = this.isDayTime(date) ? "partly-cloudy-day-rain.svg" : "partly-cloudy-night-rain.svg";
      weatherTitle = "Regen";
    } else if ([85, 86].includes(weatherCode)) {
      imageName = this.isDayTime(date) ? "partly-cloudy-day-snow.svg" : "partly-cloudy-night-snow.svg";
      weatherTitle = "Schnee";
    } else if ([95, 96, 99].includes(weatherCode)) {
      imageName = "thunderstorms.svg";
      weatherTitle = "Gewitter";
    } else {
      imageName = "not-available.svg";
      weatherTitle = "Keine Wetterdaten";
    }

    // Use classes instead of inline styles for better consistency and maintainability
    const sizeClass = large ? 'weather-icon-large' : 'weather-icon';
    
    return `<img src="/images/${imageName}" alt="${weatherTitle}" title="${weatherTitle}" class="${sizeClass}" />`;
  }
}

/**
 * Weather API service for fetching and processing weather data
 */
class WeatherService {
  private lat: string;
  private lng: string;
  private cityName: string;
  private apiUrl: string;

  constructor(lat: string, lng: string, cityName: string) {
    this.lat = lat;
    this.lng = lng;
    this.cityName = cityName;
    
    // Updated API URL with all necessary parameters
    this.apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
  }

  /**
   * Fetches weather data from API
   */
  async fetchWeatherData(): Promise<WeatherData> {
    try {
      const response = await fetch(this.apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP-Fehler! Status: ${response.status}`);
      }
      return await response.json() as WeatherData;
    } catch (error) {
      console.error("Fehler beim Laden der Wetterdaten:", error);
      this.handleError(error instanceof Error ? error.message : "Unbekannter Fehler");
      throw error;
    }
  }

  /**
   * Formats weather data and updates the UI
   */
  async updateWeatherDisplay(): Promise<void> {
    try {
      // Show loading state
      this.showLoadingState();
      
      const weatherData = await this.fetchWeatherData();
      
      const now = new Date();
      let currentIndex = weatherData.hourly.time.findIndex((t) => new Date(t) >= now);
      if (currentIndex === -1) {
        currentIndex = weatherData.hourly.time.length - 1;
      }

      // Update current conditions
      this.updateCurrentConditions(weatherData, currentIndex);
      
      // Update hourly forecast
      this.updateHourlyForecast(weatherData, currentIndex);
      
      // Update daily forecast
      this.updateDailyForecast(weatherData);
      
      // Update timestamp
      this.updateTimestamp(weatherData);
      
      // Initialize scroll functionality after content is loaded
      this.initializeScrolling();
      
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Wetterdaten:", error);
    }
  }

  /**
   * Shows loading state in UI
   */
  private showLoadingState(): void {
    ElementManager.updateAriaLiveRegion("temperature", "Temperatur wird geladen...");
    ElementManager.updateAriaLiveRegion("humidity", "Wird geladen...");
    ElementManager.updateAriaLiveRegion("rainfall", "Wird geladen...");
    ElementManager.updateAriaLiveRegion("wind", "Wird geladen...");
  }

  /**
   * Updates current weather conditions
   */
  private updateCurrentConditions(weatherData: WeatherData, currentIndex: number): void {
    // Current Temperature
    const currentTemp = weatherData.current.temperature_2m;
    ElementManager.updateAriaLiveRegion("temperature", `${currentTemp.toFixed(1)}°C`);

    // Current Icon - use large icon for main display
    const currentIcon = WeatherUtils.getWeatherIcon(weatherData.current.weather_code, new Date(weatherData.current.time), true);
    ElementManager.updateContent("icon", currentIcon);

    // Current Humidity
    const currentHumidity = weatherData.current.relative_humidity_2m;
    ElementManager.updateAriaLiveRegion("humidity", `${currentHumidity.toFixed(1)}%`);

    // Current Rainfall
    const currentRainfall = weatherData.current.precipitation;
    ElementManager.updateAriaLiveRegion("rainfall", `${currentRainfall.toFixed(1)} mm`);

    // Current Wind
    const currentWind = weatherData.current.wind_speed_10m;
    ElementManager.updateAriaLiveRegion("wind", `${currentWind.toFixed(1)} km/h`);
  }

  /**
   * Updates hourly forecast section
   */
  private updateHourlyForecast(weatherData: WeatherData, currentIndex: number): void {
    const hourlyElement = ElementManager.getElementById("hourly-forecast");
    if (!hourlyElement) return;
    
    let hourlyHTML = '';

    // Show the next 24 hours
    for (let i = currentIndex; i < currentIndex + 24 && i < weatherData.hourly.time.length; i++) {
      const time = new Date(weatherData.hourly.time[i]);
      const temp = weatherData.hourly.temperature_2m[i];
      const windSpeed = weatherData.hourly.wind_speed_10m[i];
      const windDirection = WeatherUtils.getWindDirection(weatherData.hourly.wind_direction_10m[i]);
      const weatherCode = weatherData.hourly.weather_code[i];
      const icon = WeatherUtils.getWeatherIcon(weatherCode, time);
      const isCurrentHour = i === currentIndex;

      hourlyHTML += `
        <div class="${isCurrentHour ? "current-hour" : ""}" role="listitem">
          <div>${WeatherUtils.formatHour(time)}</div>
          <div>${icon}</div>
          <div>${temp.toFixed(1)}°C</div>
          <div>
            <div>${windSpeed.toFixed(1)} km/h ${windDirection}</div>
          </div>
        </div>
      `;
    }
    
    hourlyElement.innerHTML = hourlyHTML;
    hourlyElement.setAttribute("role", "list");
    hourlyElement.setAttribute("aria-label", "Stündliche Wettervorhersage");
  }

  /**
   * Updates daily forecast section
   */
  private updateDailyForecast(weatherData: WeatherData): void {
    const dailyElement = ElementManager.getElementById("daily-forecast");
    if (!dailyElement) return;
    
    let dailyHTML = '';
    
    for (let i = 0; i < weatherData.daily.time.length; i++) {
      const date = new Date(weatherData.daily.time[i]);
      const maxTemp = weatherData.daily.temperature_2m_max[i];
      const minTemp = weatherData.daily.temperature_2m_min[i];
      const weatherCode = weatherData.daily.weather_code[i];
      const icon = WeatherUtils.getWeatherIcon(weatherCode, date);
      
      // Format date to show weekday and date (e.g., "Mo, 20.02.")
      const formattedDate = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      const isToday = new Date().toDateString() === date.toDateString();
      
      dailyHTML += `
        <div class="daily-forecast-item forecast-card${isToday ? ' current-day' : ''}" role="listitem">
          <div class="daily-date">${isToday ? 'Heute' : formattedDate}</div>
          <div class="daily-icon">${icon}</div>
          <div class="daily-temp">${maxTemp.toFixed(1)}°C / ${minTemp.toFixed(1)}°C</div>
        </div>
      `;
    }
    
    dailyElement.innerHTML = dailyHTML;
    dailyElement.setAttribute("role", "list");
    dailyElement.setAttribute("aria-label", "7-Tage Wettervorhersage");
  }

  /**
   * Updates the timestamp for last update
   */
  private updateTimestamp(weatherData: WeatherData): void {
    const updateInfoElement = ElementManager.getElementById("update-info");
    if (!updateInfoElement) return;
    
    const currentTime = new Date(weatherData.current.time);
    const formattedTime = WeatherUtils.formatHour(currentTime);
    const formattedDate = currentTime.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    updateInfoElement.innerHTML = `
      <time datetime="${currentTime.toISOString()}">
        Letzte Aktualisierung: ${formattedDate}, ${formattedTime} Uhr
      </time>
    `;
  }

  /**
   * Handles API errors
   */
  private handleError(errorMessage: string): void {
    // Get elements
    const temperatureEl = ElementManager.getElementById("temperature", false);
    const iconEl = ElementManager.getElementById("icon", false);
    const humidityEl = ElementManager.getElementById("humidity", false);
    const rainfallEl = ElementManager.getElementById("rainfall", false);
    const windEl = ElementManager.getElementById("wind", false);
    const hourlyForecastEl = ElementManager.getElementById("hourly-forecast", false);
    const dailyForecastEl = ElementManager.getElementById("daily-forecast", false);
    
    // Update error messages in a user-friendly way
    if (temperatureEl) temperatureEl.innerHTML = "Nicht verfügbar";
    if (iconEl) iconEl.innerHTML = `<img src="/images/not-available.svg" alt="Fehler beim Laden" class="weather-icon-large" />`;
    if (humidityEl) humidityEl.innerHTML = "Nicht verfügbar";
    if (rainfallEl) rainfallEl.innerHTML = "Nicht verfügbar";
    if (windEl) windEl.innerHTML = "Nicht verfügbar";
    
    if (hourlyForecastEl) {
      hourlyForecastEl.innerHTML = `<div class="error-message">Stündliche Vorhersagen konnten nicht geladen werden.</div>`;
    }
    
    if (dailyForecastEl) {
      dailyForecastEl.innerHTML = `<div class="error-message">7-Tage Vorhersage konnte nicht geladen werden.</div>`;
    }
    
    // Update timestamp with error
    const updateInfoElement = ElementManager.getElementById("update-info", false);
    if (updateInfoElement) {
      updateInfoElement.innerHTML = `<span class="error-message">Fehler: ${errorMessage}</span>`;
    }
  }

  /**
   * Initialize scrolling after content is loaded
   */
  private initializeScrolling(): void {
    // Use setTimeout to ensure DOM is fully updated
    setTimeout(() => {
      new ForecastScroll();
    }, 100);
  }
}

/**
 * Class to manage horizontal scrolling for the forecast
 */
class ForecastScroll {
  private container: HTMLElement | null;
  private scrollContainer: HTMLElement | null;
  private leftButton: HTMLButtonElement | null;
  private rightButton: HTMLButtonElement | null;
  private scrollAmount: number = 240;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.container = document.querySelector('.forecast-container');
    
    if (!this.container) {
      console.error('Forecast container not found');
      return;
    }
    
    this.scrollContainer = this.container.querySelector('.forecast-grid');
    this.leftButton = this.container.querySelector('.scroll-left');
    this.rightButton = this.container.querySelector('.scroll-right');
    
    if (!this.scrollContainer || !this.leftButton || !this.rightButton) {
      console.error('Required scroll elements not found');
      return;
    }
    
    this.init();
  }

  /**
   * Initialize scrolling functionality
   */
  private init(): void {
    if (!this.scrollContainer || !this.leftButton || !this.rightButton) return;
    
    // Add event listeners
    this.leftButton.addEventListener('click', () => this.scroll('left'));
    this.rightButton.addEventListener('click', () => this.scroll('right'));
    this.scrollContainer.addEventListener('scroll', () => this.updateButtonStates());
    
    // Use ResizeObserver for more reliable size change detection
    this.resizeObserver = new ResizeObserver(() => {
      this.updateButtonStates();
    });
    
    this.resizeObserver.observe(this.scrollContainer);
    
    // Monitor DOM changes
    const observer = new MutationObserver(() => {
      this.updateButtonStates();
    });
    
    observer.observe(this.scrollContainer, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Initial check
    this.updateButtonStates();
    
    // Add keyboard navigation for accessibility
    this.setupKeyboardNavigation();
  }

  /**
   * Set up keyboard navigation for accessibility
   */
  private setupKeyboardNavigation(): void {
    if (!this.container) return;
    
    this.container.setAttribute('tabindex', '0');
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', 'Stündliche Wettervorhersage, scrollbar');
    
    this.container.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          this.scroll('left');
          e.preventDefault();
          break;
        case 'ArrowRight':
          this.scroll('right');
          e.preventDefault();
          break;
      }
    });
  }

  /**
   * Scroll in specified direction
   */
  private scroll(direction: 'left' | 'right'): void {
    if (!this.scrollContainer) return;
    
    const newScrollPosition = this.scrollContainer.scrollLeft +
      (direction === 'left' ? -this.scrollAmount : this.scrollAmount);
    
    this.scrollContainer.scrollTo({
      left: newScrollPosition,
      behavior: 'smooth'
    });
    
    // Update button states after scrolling
    setTimeout(() => this.updateButtonStates(), 300);
  }

  /**
   * Update button enable/disable states
   */
  private updateButtonStates(): void {
    if (!this.scrollContainer || !this.leftButton || !this.rightButton) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer;
    const canScroll = scrollWidth > clientWidth;
    
    // Only show buttons if scrollable
    this.leftButton.style.display = canScroll ? 'flex' : 'none';
    this.rightButton.style.display = canScroll ? 'flex' : 'none';
    
    if (canScroll) {
      const atLeftEdge = scrollLeft <= 0;
      const atRightEdge = Math.abs(scrollLeft + clientWidth - scrollWidth) < 2;
      
      this.leftButton.disabled = atLeftEdge;
      this.rightButton.disabled = atRightEdge;
      
      // Update ARIA attributes for accessibility
      this.leftButton.setAttribute('aria-disabled', atLeftEdge.toString());
      this.rightButton.setAttribute('aria-disabled', atRightEdge.toString());
    }
  }
}

/**
 * Initialize weather application
 */
function initWeatherApp(): void {
  try {
    const widget = ElementManager.getElementById("weather-widget");
    if (!widget) {
      throw new Error("Weather widget Element nicht gefunden!");
    }
    
    const lat = ElementManager.getAttributeOrThrow(widget, "data-lat");
    const lng = ElementManager.getAttributeOrThrow(widget, "data-lng");
    const cityName = ElementManager.getAttributeOrThrow(widget, "data-city");
    
    const weatherService = new WeatherService(lat, lng, cityName);
    weatherService.updateWeatherDisplay();
    
    // Add CSS for the icons (since we removed inline styles)
    addIconStyles();
    
    // Setup periodic refresh (every 30 minutes)
    setInterval(() => {
      weatherService.updateWeatherDisplay();
    }, 30 * 60 * 1000);
    
  } catch (error) {
    console.error("Fehler beim Initialisieren der Wetter-App:", error);
  }
}

/**
 * Add CSS styles for weather icons
 */
function addIconStyles(): void {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .weather-icon {
      width: 32px;
      height: 32px;
      filter: drop-shadow(2px 2px 3px rgba(0, 0, 0, 0.2));
    }
    
    .weather-icon-large {
      width: 10rem;
      max-width: 10vw;
      height: auto;
      filter: drop-shadow(3px 3px 5px rgba(0, 0, 0, 0.3));
    }
    
    @media (max-width: 768px) {
      .weather-icon-large {
        width: 8rem;
        max-width: 15vw;
      }
    }
    
    .error-message {
      color: #d32f2f;
      font-size: 0.9rem;
      text-align: center;
      padding: 1rem;
    }
    
    .current-day {
      background: #d2e1ee !important;
      border-color: #b8d9e4 !important;
    }
  `;
  document.head.appendChild(styleElement);
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initWeatherApp);
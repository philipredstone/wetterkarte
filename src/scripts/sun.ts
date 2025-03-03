import { getSunrise, getSunset } from 'sunrise-sunset-js';
import { TimeBarChart } from "./BarChart";

interface SolarDay {
  date: Date;
  sunrise: Date | null;
  sunset: Date | null;
  dayLength: number | null;
  dayLengthChange: number;
  civilDawn: Date | null;
  civilDusk: Date | null;
  solarNoon: Date | null;
}

interface YearData {
  days: SolarDay[];
  summerSolstice: Date | null;
  winterSolstice: Date | null;
  springEquinox: Date | null;
  fallEquinox: Date | null;
  longestDay: number;
  shortestDay: number;
}

// Format time as HH:MM
function formatTime(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format hours as HH:MM
function formatHours(hours: number | null): string {
  if (hours === null) return 'N/A';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h} Std ${m} Min`;
}

// Calculate day length in hours from sunrise and sunset
function calculateDayLength(sunrise: Date | null, sunset: Date | null): number | null {
  if (!sunrise || !sunset) return null;
  const diff = sunset.getTime() - sunrise.getTime();
  return diff / (1000 * 60 * 60); // convert ms to hours
}

// Calculate civil twilight (simplified approximation - sun 6 degrees below horizon)
function getCivilTwilight(lat: number, lng: number, date: Date, isMorning: boolean): Date | null {
  const baseDate = new Date(date);
  const sunrise = getSunrise(lat, lng, baseDate);
  const sunset = getSunset(lat, lng, baseDate);

  if (!sunrise || !sunset) return null;

  // Civil twilight is roughly 30 minutes before sunrise or after sunset
  // This is an approximation - a real calculation would use solar position formulas
  if (isMorning) {
    const civilTwilight = new Date(sunrise);
    civilTwilight.setMinutes(civilTwilight.getMinutes() - 30);
    return civilTwilight;
  } else {
    const civilTwilight = new Date(sunset);
    civilTwilight.setMinutes(civilTwilight.getMinutes() + 30);
    return civilTwilight;
  }
}

// Calculate solar noon (midpoint between sunrise and sunset)
function getSolarNoon(lat: number, lng: number, date: Date): Date | null {
  const sunrise = getSunrise(lat, lng, date);
  const sunset = getSunset(lat, lng, date);

  if (!sunrise || !sunset) return null;

  const noonTime = new Date(sunrise.getTime() + (sunset.getTime() - sunrise.getTime()) / 2);
  return noonTime;
}

// Get all solar events for a year
function getSolarEventsForYear(latitude: number, longitude: number, year: number): SolarDay[] {
  const results: SolarDay[] = [];
  const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;

  for (let dayOfYear = 0; dayOfYear < daysInYear; dayOfYear++) {
    const date = new Date(year, 0, 1);
    date.setDate(date.getDate() + dayOfYear);

    const sunrise = getSunrise(latitude, longitude, date);
    const sunset = getSunset(latitude, longitude, date);
    const dayLength = calculateDayLength(sunrise, sunset);
    const civilDawn = getCivilTwilight(latitude, longitude, date, true);
    const civilDusk = getCivilTwilight(latitude, longitude, date, false);
    const solarNoon = getSolarNoon(latitude, longitude, date);

    results.push({
      date: new Date(date),
      sunrise,
      sunset,
      dayLength,
      dayLengthChange: 0, // Will be calculated in a second pass
      civilDawn,
      civilDusk,
      solarNoon
    });
  }

  // Calculate day length change
  for (let i = 1; i < results.length; i++) {
    const prevDayLength = results[i - 1].dayLength;
    const currentDayLength = results[i].dayLength;

    if (prevDayLength !== null && currentDayLength !== null) {
      results[i].dayLengthChange = (currentDayLength - prevDayLength) * 60; // Convert to minutes
    }
  }

  return results;
}

// Find equinoxes and solstices (approximate)
function findSignificantDates(data: SolarDay[]): {
  summerSolstice: Date | null;
  winterSolstice: Date | null;
  springEquinox: Date | null;
  fallEquinox: Date | null;
  longestDay: number;
  shortestDay: number;
} {
  // Find max and min day lengths for solstices
  let maxDayLength = -Infinity;
  let minDayLength = Infinity;
  let maxIndex = 0;
  let minIndex = 0;

  data.forEach((day, index) => {
    if (day.dayLength !== null) {
      if (day.dayLength > maxDayLength) {
        maxDayLength = day.dayLength;
        maxIndex = index;
      }
      if (day.dayLength < minDayLength) {
        minDayLength = day.dayLength;
        minIndex = index;
      }
    }
  });

  // Approximation for equinoxes (days when day length is closest to 12 hours)
  const springEquinoxIndex = data.findIndex((day, index) =>
    index > 31 && index < 180 && day.dayLength !== null && Math.abs(day.dayLength - 12) < 0.2);

  const fallEquinoxIndex = data.findIndex((day, index) =>
    index > 180 && index < 300 && day.dayLength !== null && Math.abs(day.dayLength - 12) < 0.2);

  return {
    summerSolstice: maxIndex > 0 ? data[maxIndex].date : null,
    winterSolstice: minIndex > 0 ? data[minIndex].date : null,
    springEquinox: springEquinoxIndex !== -1 ? data[springEquinoxIndex].date : null,
    fallEquinox: fallEquinoxIndex !== -1 ? data[fallEquinoxIndex].date : null,
    longestDay: maxDayLength,
    shortestDay: minDayLength
  };
}

function formatGermanDate(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const sunWidget = document.getElementById('sun-widget');

  if (!sunWidget) return;

  const lat = parseFloat(sunWidget.getAttribute('data-lat') || '0');
  const lng = parseFloat(sunWidget.getAttribute('data-lng') || '0');
  const cityName = sunWidget.getAttribute('data-city') || '';

  // Get DOM elements
  const sunriseTimeEl = document.getElementById('sunrise-time');
  const sunsetTimeEl = document.getElementById('sunset-time');
  const dayLengthEl = document.getElementById('day-length');
  const dayChangeEl = document.getElementById('day-change');
  const civilDawnEl = document.getElementById('civil-dawn');
  const civilDuskEl = document.getElementById('civil-dusk');
  const solarNoonEl = document.getElementById('solar-noon');
  const nextSolsticeEl = document.getElementById('next-solstice');
  const springEquinoxEl = document.getElementById('spring-equinox');
  const summerSolsticeEl = document.getElementById('summer-solstice');
  const fallEquinoxEl = document.getElementById('fall-equinox');
  const winterSolsticeEl = document.getElementById('winter-solstice');
  const updateInfoEl = document.getElementById('update-info');

  // Get current date and time
  const now = new Date();
  const currentYear = now.getFullYear();

  // Get today's solar data
  const today = new Date();
  const sunrise = getSunrise(lat, lng, today);
  const sunset = getSunset(lat, lng, today);
  const dayLength = calculateDayLength(sunrise, sunset);
  const civilDawn = getCivilTwilight(lat, lng, today, true);
  const civilDusk = getCivilTwilight(lat, lng, today, false);
  const solarNoon = getSolarNoon(lat, lng, today);

  // Yesterday's data for day length change
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySunrise = getSunrise(lat, lng, yesterday);
  const yesterdaySunset = getSunset(lat, lng, yesterday);
  const yesterdayDayLength = calculateDayLength(yesterdaySunrise, yesterdaySunset);

  // Calculate day length change
  let dayLengthChange = 0;
  if (dayLength !== null && yesterdayDayLength !== null) {
    dayLengthChange = (dayLength - yesterdayDayLength) * 60; // in minutes
  }

  // Calculate year data for seasonal events
  const yearData = getSolarEventsForYear(lat, lng, currentYear);
  const significantDates = findSignificantDates(yearData);

  // Determine next solstice or equinox
  let nextEvent = { name: '', date: null };
  const events = [
    { name: 'Frühlings-Tagundnachtgleiche', date: significantDates.springEquinox },
    { name: 'Sommersonnenwende', date: significantDates.summerSolstice },
    { name: 'Herbst-Tagundnachtgleiche', date: significantDates.fallEquinox },
    { name: 'Wintersonnenwende', date: significantDates.winterSolstice }
  ];

  for (const event of events) {
    if (event.date && event.date > today) {
      nextEvent = event;
      break;
    }
  }

  // If we're past all events for this year, the next one is spring equinox of next year
  if (!nextEvent.date) {
    nextEvent = { name: 'Frühlings-Tagundnachtgleiche', date: new Date(currentYear + 1, 2, 20) };
  }

  // Update DOM elements with solar data
  if (sunriseTimeEl) sunriseTimeEl.textContent = formatTime(sunrise);
  if (sunsetTimeEl) sunsetTimeEl.textContent = formatTime(sunset);
  if (dayLengthEl) dayLengthEl.textContent = formatHours(dayLength);

  const dayChangePrefix = dayLengthChange > 0 ? '+' : '';
  if (dayChangeEl) dayChangeEl.textContent = `${dayChangePrefix}${dayLengthChange.toFixed(1)} Min`;

  if (civilDawnEl) civilDawnEl.textContent = formatTime(civilDawn);
  if (civilDuskEl) civilDuskEl.textContent = formatTime(civilDusk);
  if (solarNoonEl) solarNoonEl.textContent = formatTime(solarNoon);

  if (nextSolsticeEl && nextEvent.date) {
    nextSolsticeEl.textContent = `${nextEvent.name} am ${formatGermanDate(nextEvent.date)}`;
  }

  if (springEquinoxEl) springEquinoxEl.textContent = formatGermanDate(significantDates.springEquinox);
  if (summerSolsticeEl) summerSolsticeEl.textContent = formatGermanDate(significantDates.summerSolstice);
  if (fallEquinoxEl) fallEquinoxEl.textContent = formatGermanDate(significantDates.fallEquinox);
  if (winterSolsticeEl) winterSolsticeEl.textContent = formatGermanDate(significantDates.winterSolstice);

  if (updateInfoEl) {
    updateInfoEl.textContent = `Letzte Aktualisierung: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`;
  }

  // Add styles based on time of day
  const currentTime = now.getTime();
  if (sunrise && sunset) {
    const isDaytime = currentTime > sunrise.getTime() && currentTime < sunset.getTime();

    const sunriseBox = document.getElementById('sunrise-box');
    const sunsetBox = document.getElementById('sunset-box');

    if (sunriseBox && sunsetBox) {
      if (isDaytime) {
        // It's daytime
        sunriseBox.classList.add('past-event');
        if (currentTime > solarNoon?.getTime()!) {
          // It's afternoon
          sunsetBox.classList.add('upcoming-event');
        }
      } else {
        // It's nighttime
        if (currentTime < sunrise.getTime()) {
          // It's before sunrise
          sunriseBox.classList.add('upcoming-event');
        } else {
          // It's after sunset
          sunsetBox.classList.add('past-event');
        }
      }
    }
  }

  // Initialize the chart (if available)
  initializeChart(yearData);
});

// Initialize chart to show day length throughout the year
function initializeChart(yearData: SolarDay[]): void {
  const chartContainer = document.getElementById('chart');
  if (!chartContainer) return;

  // Format data for the chart
  const graphData = [];
  for (let i = 0; i < yearData.length; i += 15) {
    if (yearData[i].dayLength !== null) {

      let value = yearData[i].dayLength ?? 0;
      let decimalPart = 0;

      graphData.push({
        date: yearData[i].date,
        value:  ((decimalPart = value - Math.floor(value)) <= 0.1) ? Math.floor(value) : (decimalPart >= 0.9) ? Math.ceil(value) : Math.round(value * 100) / 100
      });
    }
  }

  // Create and render the chart
  if (graphData.length > 0) {
    const chart = new TimeBarChart(chartContainer, graphData, {
      width: 800,
      height: 400,
      valueLabel: "Tageslänge",
      valueUnit: "h",
      showCurrentTimeLine: false,
      showTimeInTooltip: false
    });
    chart.render();
  } else {
    chartContainer.innerHTML = '<div style="padding: 2rem; text-align: center;">Keine Daten für die Grafik verfügbar.</div>';
  }
}
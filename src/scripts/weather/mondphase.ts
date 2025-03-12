/**
 * Calculate the moon phase for a given date using astronomical algorithm
 * Based on the calculations from "Astronomical Algorithms" by Jean Meeus
 */

/**
 * Calculate the Julian Date from a JavaScript Date object
 */
function getJulianDate(date: Date): number {
  const time = date.getTime();
  return (time / 86400000) + 2440587.5;
}

/**
 * Calculate the moon phase using a more accurate astronomical algorithm
 * @param date - The date to calculate the moon phase for
 * @returns A number between 0 and 1 representing the moon phase (0 = new moon, 0.5 = full moon)
 */
function getMoonPhase(date: Date): number {
  // Get Julian date
  const julianDate = getJulianDate(date);

  // Calculate the moon phase more accurately
  // Corrected formula based on astronomical algorithms

  // Time in Julian centuries since January 1, 2000
  const t = (julianDate - 2451545.0) / 36525;

  // Mean longitude of the sun
  const sunMeanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;

  // Mean anomaly of the sun
  const sunMeanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);

  // Mean longitude of the moon
  const moonMeanLongitude = 218.3165 + t * (481267.8813 - t * 0.001133);

  // Mean anomaly of the moon
  const moonMeanAnomaly = 134.9634 + t * (477198.8675 + t * 0.0089970);

  // Moon's argument of latitude
  const moonArgumentOfLatitude = 93.2720 + t * (483202.0175 + t * 0.0034029);

  // Correction factors
  const c1 = (moonMeanLongitude - sunMeanLongitude) % 360;
  const c2 = (moonMeanLongitude - moonArgumentOfLatitude) % 360;

  // Corrected longitude difference between moon and sun
  let phase = (c1 - 0.1084 * Math.sin(moonMeanAnomaly * Math.PI / 180) -
    0.0004 * Math.sin(2 * moonMeanAnomaly * Math.PI / 180) +
    0.0074 * Math.sin(sunMeanAnomaly * Math.PI / 180) +
    0.0022 * Math.sin(2 * sunMeanAnomaly * Math.PI / 180)) % 360;

  if (phase < 0) phase += 360;

  // Normalize to 0-1
  phase = phase / 360;

  return phase;
}

/**
 * Get the name of the moon phase in the specified language and style
 * @param phase - Moon phase value between 0 and 1
 * @param language - Language for the moon phase name ('en' for English, 'de' for German)
 * @param style - Style of naming ('detailed' for all phases, 'simple' for basic waxing/waning)
 * @returns The name of the moon phase in the specified language
 */
function getMoonPhaseName(phase: number): string {

  const boundaries = {
    newMoon: { min: 0.97, max: 0.03 },
    firstQuarter: { min: 0.24, max: 0.26 }, // Narrowed to be more precise
    fullMoon: { min: 0.47, max: 0.53 },
    lastQuarter: { min: 0.74, max: 0.76 }  // Narrowed to be more precise
  };

  // German moon phase names
  const names = {
    newMoon: "Neumond",
    waxingCrescent: "Zunehmender Sichelmond",
    firstQuarter: "Erstes Viertel",
    waxingGibbous: "Zunehmender Mond",
    fullMoon: "Vollmond",
    waningGibbous: "Abnehmender Mond",
    lastQuarter: "Letztes Viertel",
    waningCrescent: "Abnehmender Sichelmond"
  };

  // Determine phase name
  if (phase < boundaries.newMoon.max || phase >= boundaries.newMoon.min) {
    return names.newMoon;
  } else if (phase < boundaries.firstQuarter.min) {
    return names.waxingCrescent;
  } else if (phase < boundaries.firstQuarter.max) {
    return names.firstQuarter;
  } else if (phase < boundaries.fullMoon.min) {
    return names.waxingGibbous;
  } else if (phase < boundaries.fullMoon.max) {
    return names.fullMoon;
  } else if (phase < boundaries.lastQuarter.min) {
    return names.waningGibbous;
  } else if (phase < boundaries.lastQuarter.max) {
    return names.lastQuarter;
  } else {
    return names.waningCrescent;
  }
}

/**
 * Calculate and return information about the moon phase for a given date
 * @param date - The date to get the moon phase for (defaults to current date if not provided)
 * @param language - Language for the moon phase name ('en' for English, 'de' for German)
 * @param namingStyle - Style of naming ('detailed' for all phases, 'simple' for basic waxing/waning)
 * @returns An object containing moon phase information
 */
function calculateMoonPhase(
  date: Date = new Date()
): {
  phase: number;
  phaseName: string;
  illumination: number;
  ageOfMoon: number;
  isWaxing: boolean;
  icon: string;
} {
  const phase = getMoonPhase(date);

  const phaseName = getMoonPhaseName(phase);

  let icon = "";
  switch (phaseName) {
    case "Neumond":
      icon = "moon-new.svg";
      break;
    case "Erstes Viertel":
      icon = "moon-first-quarter.svg";
      break;
    case "Vollmond":
      icon = "moon-full.svg";
      break;
    case "Letztes Viertel":
      icon = "moon-last-quarter.svg";
      break;
    case "Abnehmender Mond":
      icon = "moon-waning-gibbous.svg";
      break;
    case "Zunehmender Mond":
      icon = "moon-waxing-gibbous.svg";
      break;
    case "Abnehmender Sichelmond":
      icon = "moon-waning-crescent.svg";
      break;
    case "Zunehmender Sichelmond":
      icon = "moon-waxing-crescent.svg";
      break;
    default:
      icon = "moon-new.svg";
  }

  // Age of moon in days (0-29.53)
  const synodicMonth = 29.53058867;
  const ageOfMoon = phase * synodicMonth;

  // Determine if the moon is waxing (growing) or waning (shrinking)
  const isWaxing = phase > 0 && phase < 0.5;

  // Calculate illumination percentage
  let illumination = 0;
  if (phase <= 0.5) {
    // Waxing phase (0 to 0.5)
    illumination = phase * 2;
  } else {
    // Waning phase (0.5 to 1)
    illumination = (1 - phase) * 2;
  }

  return {
    phase,
    phaseName,
    illumination,
    ageOfMoon,
    isWaxing,
    icon
  };
}

/**
 * Generate a moon phase calendar for a given month
 * @param year - The year to generate the calendar for
 * @param month - The month to generate the calendar for (0-11)
 * @returns An array of objects with date and moon phase information
 */
function generateMoonCalendar(
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth()
): Array<{
  date: Date;
  day: number;
  moonInfo: {
    phase: number;
    phaseName: string;
    illumination: number;
    ageOfMoon: number;
    isWaxing: boolean;
    icon: string;
  };
  isImportantPhase: boolean;
}> {
  // Get the number of days in the month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Generate calendar data
  const calendarData = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const moonInfo = calculateMoonPhase(date);

    // Check if this is an important phase (new moon, first quarter, full moon, last quarter)
    const isImportantPhase = ["Neumond", "Erstes Viertel", "Vollmond", "Letztes Viertel"].includes(moonInfo.phaseName);

    calendarData.push({
      date,
      day,
      moonInfo,
      isImportantPhase
    });
  }

  return calendarData;
}

/**
 * Generate calendar for three consecutive months
 * @returns An object with calendar data for the current, next, and following month
 */
function generateThreeMonthCalendar(): {
  currentMonth: {
    name: string;
    year: number;
    month: number;
    data: Array<any>;
  };
  nextMonth: {
    name: string;
    year: number;
    month: number;
    data: Array<any>;
  };
  followingMonth: {
    name: string;
    year: number;
    month: number;
    data: Array<any>;
  };
} {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Calculate next and following month, handling year change
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
  const followingMonthDate = new Date(currentYear, currentMonth + 2, 1);

  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth();

  const followingYear = followingMonthDate.getFullYear();
  const followingMonth = followingMonthDate.getMonth();

  // German month names
  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  return {
    currentMonth: {
      name: monthNames[currentMonth],
      year: currentYear,
      month: currentMonth,
      data: generateMoonCalendar(currentYear, currentMonth)
    },
    nextMonth: {
      name: monthNames[nextMonth],
      year: nextYear,
      month: nextMonth,
      data: generateMoonCalendar(nextYear, nextMonth)
    },
    followingMonth: {
      name: monthNames[followingMonth],
      year: followingYear,
      month: followingMonth,
      data: generateMoonCalendar(followingYear, followingMonth)
    }
  };
}

/**
 * Find dates of important moon phases in a given month
 * @param year - The year
 * @param month - The month (0-11)
 * @returns Array of objects with important moon phase dates
 */
function findImportantPhases(
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth()
): Array<{
  date: Date;
  phaseName: string;
  icon: string;
}> {
  const calendarData = generateMoonCalendar(year, month);

  // Filter out only the important phases
  const importantPhases = calendarData
    .filter(day => day.isImportantPhase)
    .map(day => ({
      date: day.date,
      phaseName: day.moonInfo.phaseName,
      icon: day.moonInfo.icon
    }));

  return importantPhases;
}

document.addEventListener('DOMContentLoaded', () => {
  // Display current moon phase
  const today = new Date();
  const moonInfo = calculateMoonPhase(today);

  const moonPhaseElement = document.getElementById('moon-phase') as HTMLParagraphElement;
  const moonIconElement = document.getElementById('moon-icon') as HTMLImageElement;
  const moonIlluminationElement = document.getElementById('moon-illumination') as HTMLParagraphElement;
  const daysSinceNewMoonElement = document.getElementById('days-since-new-moon') as HTMLParagraphElement;

  if (moonPhaseElement) {
    moonPhaseElement.textContent = moonInfo.phaseName;
  }

  if (moonIconElement) {
    moonIconElement.src = `/images/${moonInfo.icon}`;
  }

  if (moonIlluminationElement) {
    moonIlluminationElement.textContent = (moonInfo.illumination * 100).toFixed(0) + "%";
  }

  if (daysSinceNewMoonElement) {
    daysSinceNewMoonElement.textContent = moonInfo.ageOfMoon.toFixed(0) + " Tage";
  }

  // Generate and display moon phase calendar
  const calendarContainer = document.getElementById('moon-calendar') as HTMLDivElement;

  if (calendarContainer) {
    const threeMonthCalendar = generateThreeMonthCalendar();

    // Create HTML for the calendar
    let calendarHTML = '';

    // Function to create a month section
    const createMonthSection = (monthData: any) => {
      // Month header
      let monthSection = `
                <div class="calendar-month">
                    <h3>${monthData.name} ${monthData.year}</h3>
                    <div class="calendar-grid">
                        <div class="calendar-header">Mo</div>
                        <div class="calendar-header">Di</div>
                        <div class="calendar-header">Mi</div>
                        <div class="calendar-header">Do</div>
                        <div class="calendar-header">Fr</div>
                        <div class="calendar-header">Sa</div>
                        <div class="calendar-header">So</div>
            `;

      // Get the first day of the month (0 = Sunday, 1 = Monday, etc.)
      const firstDayOfMonth = new Date(monthData.year, monthData.month, 1).getDay();
      // Adjust for Monday as first day of week (if Sunday, it becomes position 7)
      const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

      // Add empty cells for days before the start of the month
      for (let i = 0; i < startOffset; i++) {
        monthSection += '<div class="calendar-day empty"></div>';
      }

      // Add days of the month
      monthData.data.forEach((day: any) => {
        const isToday = today.getDate() === day.day &&
          today.getMonth() === monthData.month &&
          today.getFullYear() === monthData.year;

        const dayClass = isToday ? 'calendar-day today' : 'calendar-day';
        const importantClass = day.isImportantPhase ? 'important-phase' : '';

        monthSection += `
                    <div class="${dayClass} ${importantClass}">
                        <span class="day-number">${day.day}</span>
                        <img 
                            src="/images/${day.moonInfo.icon}" 
                            alt="${day.moonInfo.phaseName}" 
                            class="moon-icon-small"
                            title="${day.moonInfo.phaseName} - ${(day.moonInfo.illumination * 100).toFixed(0)}% beleuchtet"
                        />
                    </div>
                `;
      });

      monthSection += `
                    </div>
                </div>
            `;

      return monthSection;
    };

    // Create sections for each month
    calendarHTML += createMonthSection(threeMonthCalendar.currentMonth);
    calendarHTML += createMonthSection(threeMonthCalendar.nextMonth);
    calendarHTML += createMonthSection(threeMonthCalendar.followingMonth);

    // Create the important phases section
    calendarHTML += `
            <div class="important-phases">
                <h3>Wichtige Mondphasen</h3>
                <div class="phases-list">
        `;

    // Get important phases for the next 3 months
    const currentImportantPhases = findImportantPhases(threeMonthCalendar.currentMonth.year, threeMonthCalendar.currentMonth.month);
    const nextImportantPhases = findImportantPhases(threeMonthCalendar.nextMonth.year, threeMonthCalendar.nextMonth.month);
    const followingImportantPhases = findImportantPhases(threeMonthCalendar.followingMonth.year, threeMonthCalendar.followingMonth.month);

    // Combine and sort all important phases
    const allImportantPhases = [...currentImportantPhases, ...nextImportantPhases, ...followingImportantPhases]
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Add each important phase to the list
    allImportantPhases.forEach(phase => {
      const formattedDate = phase.date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      calendarHTML += `
                <div class="phase-item">
                    <img src="/images/${phase.icon}" alt="${phase.phaseName}" class="phase-icon" />
                    <div class="phase-info">
                        <span class="phase-name">${phase.phaseName}</span>
                        <span class="phase-date">${formattedDate}</span>
                    </div>
                </div>
            `;
    });

    calendarHTML += `
                </div>
            </div>
        `;

    // Add to the container
    calendarContainer.innerHTML = calendarHTML;
  }
});
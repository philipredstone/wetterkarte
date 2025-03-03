import { TimeBarChart } from "./BarChart";

interface PollenDay {
    date: Date;
    alderLevel: number;
    birchLevel: number;
    grassLevel: number;
    mugwortLevel: number;
    oliveLevel: number;
    ragweedLevel: number;
}

interface ApiResponse {
    latitude: number;
    longitude: number;
    elevation: number;
    current_units: {
        time: string;
        interval: string;
        european_aqi: string;
    };
    current: {
        time: string;
        interval: number;
        european_aqi: number;
    };
    hourly_units: {
        time: string;
        alder_pollen: string;
        birch_pollen: string;
        grass_pollen: string;
        mugwort_pollen: string;
        olive_pollen: string;
        ragweed_pollen: string;
    };
    hourly: {
        time: string[];
        alder_pollen: number[];
        birch_pollen: number[];
        grass_pollen: number[];
        mugwort_pollen: number[];
        olive_pollen: number[];
        ragweed_pollen: number[];
    };
}

// Function to fetch pollen data from the API
async function fetchPollenData(latitude: number, longitude: number, forecastDays: number = 3): Promise<ApiResponse> {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi&hourly=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&forecast_days=${forecastDays}&domains=cams_europe`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data as ApiResponse;
    } catch (error) {
        console.error("Error fetching pollen data:", error);
        throw error;
    }
}

// Function to calculate daily averages from hourly data
function calculateDailyAverages(data: ApiResponse): PollenDay[] {
    const days: PollenDay[] = [];
    const hourlyTimes = data.hourly.time;
    const hourCount = hourlyTimes.length;

    // Group hourly data by day
    const dayMap = new Map<string, number[][]>();

    for (let i = 0; i < hourCount; i++) {
        const time = new Date(hourlyTimes[i]);
        const dateString = time.toISOString().split('T')[0];

        if (!dayMap.has(dateString)) {
            // Initialize arrays for each pollen type [alder, birch, grass, mugwort, olive, ragweed]
            dayMap.set(dateString, [[], [], [], [], [], []]);
        }

        const dayData = dayMap.get(dateString)!;
        dayData[0].push(data.hourly.alder_pollen[i]);
        dayData[1].push(data.hourly.birch_pollen[i]);
        dayData[2].push(data.hourly.grass_pollen[i]);
        dayData[3].push(data.hourly.mugwort_pollen[i]);
        dayData[4].push(data.hourly.olive_pollen[i]);
        dayData[5].push(data.hourly.ragweed_pollen[i]);
    }

    // Calculate daily averages
    for (const [dateString, values] of dayMap.entries()) {
        const day: PollenDay = {
            date: new Date(dateString),
            alderLevel: calculateAverage(values[0]),
            birchLevel: calculateAverage(values[1]),
            grassLevel: calculateAverage(values[2]),
            mugwortLevel: calculateAverage(values[3]),
            oliveLevel: calculateAverage(values[4]),
            ragweedLevel: calculateAverage(values[5])
        };
        days.push(day);
    }

    return days.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Helper function to calculate average of an array
function calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
}

// Convert concentration to level category (0-5)
function concentrationToLevel(concentration: number): number {
    if (concentration <= 0.5) return 0; // None
    if (concentration <= 10) return 1; // Very Low
    if (concentration <= 30) return 2; // Low
    if (concentration <= 50) return 3; // Medium
    if (concentration <= 100) return 4; // High
    return 5; // Very High
}

// Format pollen level as text
function formatPollenLevel(concentration: number): string {
    const level = concentrationToLevel(concentration);
    if (level === 0) return 'Keine';
    if (level === 1) return 'Sehr gering';
    if (level === 2) return 'Gering';
    if (level === 3) return 'Mittel';
    if (level === 4) return 'Hoch';
    return 'Sehr hoch';
}

// Format concentration value for display
function formatConcentration(concentration: number): string {
    return `${concentration.toFixed(1)} Pollen/m³`;
}

// Format pollen trend as text
function formatPollenTrend(yesterday: number, today: number, tomorrow: number): string {
    // Compare the categories rather than raw values
    const yesterdayLevel = concentrationToLevel(yesterday);
    const todayLevel = concentrationToLevel(today);
    const tomorrowLevel = concentrationToLevel(tomorrow);

    if (yesterdayLevel < todayLevel && todayLevel < tomorrowLevel) {
        return 'Steigend';
    } else if (yesterdayLevel > todayLevel && todayLevel > tomorrowLevel) {
        return 'Fallend';
    } else if (yesterdayLevel === todayLevel && todayLevel < tomorrowLevel) {
        return 'Morgen steigend';
    } else if (yesterdayLevel === todayLevel && todayLevel > tomorrowLevel) {
        return 'Morgen fallend';
    } else if (yesterdayLevel < todayLevel && todayLevel === tomorrowLevel) {
        return 'Stabil nach Anstieg';
    } else if (yesterdayLevel > todayLevel && todayLevel === tomorrowLevel) {
        return 'Stabil nach Rückgang';
    } else {
        return 'Gleichbleibend';
    }
}

// Find next peak pollen season
function findNextPeakSeason(currentMonth: number): string {
    // Simplified seasonal peaks
    const peaks = [
        { month: 2, name: "Erlenpollen im März" },        // March
        { month: 3, name: "Birkenpollen im April" },      // April
        { month: 4, name: "Gräserpollen im Mai" },        // May
        { month: 6, name: "Beifußpollen im Juli" },       // July
        { month: 7, name: "Ambrosiapollen im August" }    // August
    ];

    // Find the next peak after the current month
    for (const peak of peaks) {
        if (peak.month >= currentMonth) {
            return peak.name;
        }
    }

    // If we're past all peaks, return the first one for next year
    return "Erlenpollen im März";
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const pollenWidget = document.getElementById('pollen-widget');

    if (!pollenWidget) return;

    const lat = parseFloat(pollenWidget.getAttribute('data-lat') || '0');
    const lng = parseFloat(pollenWidget.getAttribute('data-lng') || '0');
    const cityName = pollenWidget.getAttribute('data-city') || '';

    // Get DOM elements for each pollen type
    const alderLevelEl = document.getElementById('alder-pollen-level');
    const birchLevelEl = document.getElementById('birch-pollen-level');
    const grassLevelEl = document.getElementById('grass-pollen-level');
    const mugwortLevelEl = document.getElementById('mugwort-pollen-level');
    const oliveLevelEl = document.getElementById('olive-pollen-level');
    const ragweedLevelEl = document.getElementById('ragweed-pollen-level');
    const pollenTrendEl = document.getElementById('pollen-trend');
    const nextPeakEl = document.getElementById('next-peak');
    const updateInfoEl = document.getElementById('update-info');

    try {
        // Show loading status
        if (updateInfoEl) {
            updateInfoEl.textContent = `Daten werden geladen...`;
        }

        // Fetch pollen data from API
        const apiData = await fetchPollenData(lat, lng);

        
        const currentTime = new Date(apiData.current.time);

        const pollenDays = calculateDailyAverages(apiData);

        // Get current date and information
        const now = new Date();
        const currentMonth = now.getMonth();

        // Make sure we have at least one day of data
        if (pollenDays.length === 0) {
            throw new Error("Keine Daten verfügbar");
        }

        // Get today's, yesterday's and tomorrow's data
        const today = pollenDays[0];
        const tomorrow = pollenDays.length > 1 ? pollenDays[1] : today;
        const dayAfterTomorrow = pollenDays.length > 2 ? pollenDays[2] : tomorrow;

        // Update pollen levels
        if (alderLevelEl) {
            alderLevelEl.textContent = `${formatPollenLevel(today.alderLevel)} (${formatConcentration(today.alderLevel)})`;
        }

        if (birchLevelEl) {
            birchLevelEl.textContent = `${formatPollenLevel(today.birchLevel)} (${formatConcentration(today.birchLevel)})`;
        }

        if (grassLevelEl) {
            grassLevelEl.textContent = `${formatPollenLevel(today.grassLevel)} (${formatConcentration(today.grassLevel)})`;
        }

        if (mugwortLevelEl) {
            mugwortLevelEl.textContent = `${formatPollenLevel(today.mugwortLevel)} (${formatConcentration(today.mugwortLevel)})`;
        }

        if (oliveLevelEl) {
            oliveLevelEl.textContent = `${formatPollenLevel(today.oliveLevel)} (${formatConcentration(today.oliveLevel)})`;
        }

        if (ragweedLevelEl) {
            ragweedLevelEl.textContent = `${formatPollenLevel(today.ragweedLevel)} (${formatConcentration(today.ragweedLevel)})`;
        }

        // Calculate and display trend (using the most significant pollen type that's active)
        if (pollenTrendEl) {
            const activePollens = [
                { type: 'alder', today: today.alderLevel, tomorrow: tomorrow.alderLevel, dayAfter: dayAfterTomorrow.alderLevel },
                { type: 'birch', today: today.birchLevel, tomorrow: tomorrow.birchLevel, dayAfter: dayAfterTomorrow.birchLevel },
                { type: 'grass', today: today.grassLevel, tomorrow: tomorrow.grassLevel, dayAfter: dayAfterTomorrow.grassLevel },
                { type: 'mugwort', today: today.mugwortLevel, tomorrow: tomorrow.mugwortLevel, dayAfter: dayAfterTomorrow.mugwortLevel },
                { type: 'ragweed', today: today.ragweedLevel, tomorrow: tomorrow.ragweedLevel, dayAfter: dayAfterTomorrow.ragweedLevel }
            ];

            // Sort by highest concentration
            activePollens.sort((a, b) => b.today - a.today);

            // Use the most significant pollen type for the trend
            const mainPollen = activePollens[0];

            // Only show trend if there's a meaningful pollen level
            if (mainPollen.today > 1 || mainPollen.tomorrow > 1 || mainPollen.dayAfter > 1) {
                const trend = formatPollenTrend(mainPollen.today, mainPollen.tomorrow, mainPollen.dayAfter);
                pollenTrendEl.textContent = `${mapPollenTypeToGerman(mainPollen.type)}: ${trend}`;
            } else {
                pollenTrendEl.textContent = "Allgemein niedrige Belastung";
            }
        }

        // Display next peak season
        if (nextPeakEl) {
            nextPeakEl.textContent = findNextPeakSeason(currentMonth);
        }

        // Update last updated time
        if (updateInfoEl) {
            // updateInfoEl.textContent = `Letzte Aktualisierung: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`;
            const formattedTime = currentTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
            updateInfoEl.innerHTML = `Letzte Aktualisierung: <time datetime="${currentTime.toISOString()}">${formattedTime} Uhr</time>`;
        
        }
    } catch (error) {
        console.error("Error initializing pollen data:", error);

        // Show error message
        if (updateInfoEl) {
            updateInfoEl.textContent = `Fehler beim Laden der Daten. Bitte versuchen Sie es später erneut. Statische Informationen zeigen typische Werte für diese Jahreszeit.`;
        }
    }
});

// Helper function to map API pollen types to German names
function mapPollenTypeToGerman(type: string): string {
    switch (type) {
        case 'alder': return 'Erle';
        case 'birch': return 'Birke';
        case 'grass': return 'Gräser';
        case 'mugwort': return 'Beifuß';
        case 'olive': return 'Olive';
        case 'ragweed': return 'Ambrosia';
        default: return type;
    }
}
interface AqiData {
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
        european_aqi: string;
    };
    current: {
        time: string;
        interval: number;
        european_aqi: number;
    };
    hourly_units: {
        time: string;
        european_aqi: string;
    };
    hourly: {
        time: string[];
        european_aqi: number[];
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

const apiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi&domains=cams_europe&timezone=auto`;

async function fetchAqiData(): Promise<void> {
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        }
        const aqiData = (await response.json()) as AqiData;

        // Get current AQI value from the current property
        const currentAqi = aqiData.current.european_aqi;
        const currentTime = new Date(aqiData.current.time);

        let recommendation = "";
        let aqiBoxColor = "";
        let aqiBoxBorderColor = "";

        // European AQI scale
        if (currentAqi <= 20) {
            recommendation = "<strong>Sehr gut</strong><br />Die Luftqualität ist sehr gut. Perfekt für Outdoor-Aktivitäten.";
            aqiBoxColor = "#c3eaa3";
            aqiBoxBorderColor = "#b0d890";
        } else if (currentAqi <= 40) {
            recommendation = "<strong>Gut</strong><br />Die Luftqualität ist gut. Ein guter Tag für Outdoor-Aktivitäten.";
            aqiBoxColor = "#ffe5a3";
            aqiBoxBorderColor = "#ead48f";
        } else if (currentAqi <= 60) {
            recommendation = "<strong>Mäßig</strong><br />Die Luftqualität ist mäßig. Empfindliche Personen sollten längere Aktivitäten im Freien einschränken.";
            aqiBoxColor = "#ffd2a8";
            aqiBoxBorderColor = "#eac197";
        } else if (currentAqi <= 80) {
            recommendation = "<strong>Schlecht</strong><br />Die Luftqualität ist schlecht. Reduzieren Sie Aktivitäten im Freien.";
            aqiBoxColor = "#ffb3b3";
            aqiBoxBorderColor = "#eaa2a2";
        } else if (currentAqi <= 100) {
            recommendation = "<strong>Sehr schlecht</strong><br />Die Luftqualität ist sehr schlecht. Vermeiden Sie Aktivitäten im Freien.";
            aqiBoxColor = "#d4c1e0";
            aqiBoxBorderColor = "#c3b0cf";
        } else {
            recommendation = "<strong>Extrem schlecht</strong><br />Die Luftqualität ist extrem schlecht. Bleiben Sie drinnen und schließen Sie Fenster.";
            aqiBoxColor = "#eaa6c7";
            aqiBoxBorderColor = "#d995b6";
        }

        const aqiMessageElement = document.getElementById("aqi-message") as HTMLElement;
        aqiMessageElement.innerHTML = `${recommendation}`;
        
        const aqiIndexElement = document.getElementById("aqi-index") as HTMLElement;
        aqiIndexElement.innerHTML = `Luftqualitätsindex in ${cityName}: <strong>${currentAqi}</strong>`;

        const aqiBoxElement = document.getElementById("aqi-box") as HTMLElement;
        aqiBoxElement.style.backgroundColor = aqiBoxColor;
        aqiBoxElement.style.border = `1px solid ${aqiBoxBorderColor}`;

        const updateInfoElement = document.getElementById("update-info") as HTMLElement;
        const formattedTime = currentTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        updateInfoElement.innerHTML = `Letzte Aktualisierung: <time datetime="${currentTime.toISOString()}">${formattedTime} Uhr</time>`;
    } catch (error) {
        console.error("Fehler beim Laden der Luftqualitätsdaten:", error);
        widget.innerHTML = `<p>Luftqualitätsdaten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>`;
    }
}

fetchAqiData();
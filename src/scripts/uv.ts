interface UvData {
    latitude: number;
    longitude: number;
    generationtime_ms: number;
    utc_offset_seconds: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    hourly_units: {
        time: string;
        uv_index: string;
    };
    hourly: {
        time: string[];
        uv_index: number[];
    };
    daily_units: {
        time: string;
        uv_index_max: string;
    };
    daily: {
        time: string[];
        uv_index_max: number[];
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

const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=uv_index&daily=uv_index_max&timezone=auto&forecast_days=1`;

async function fetchUvData(): Promise<void> {
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        }
        const uvData = (await response.json()) as UvData;

        const now = new Date();
        let currentIndex = uvData.hourly.time.findIndex((t) => new Date(t) >= now);
        if (currentIndex === -1) {
            currentIndex = uvData.hourly.time.length - 1;
        }
        const currentUv = uvData.hourly.uv_index[currentIndex];
        const currentTime = new Date(uvData.hourly.time[currentIndex]);

        let recommendation = "";
        let uvBoxColor = "";
        let uvBoxBorderColor = "";

        if (currentUv <= 2) {
            recommendation = "<strong>Geringes Risiko</strong><br />In der Regel ist kein besonderer Sonnenschutz nötig.";
            uvBoxColor = "#daf5da";
            uvBoxBorderColor = "#bbf0bb";
        } else if (currentUv < 6) {
            recommendation = "<strong>Mäßiges Risiko</strong><br />Bei längerer Sonnenexposition sollte ein leichter Sonnenschutz verwendet werden.";
            uvBoxColor = "#fff8cd";
            uvBoxBorderColor = "#e6e0c7";
        } else if (currentUv < 8) {
            recommendation = "<strong>Hohes Risiko</strong><br />schützen Sie sich mit geeigneter Kleidung und Sonnencreme.";
            uvBoxColor = "#ffe4c4";
            uvBoxBorderColor = "#e9d6c0";
        } else if (currentUv < 11) {
            recommendation = "<strong>Sehr hohes Risiko</strong><br />meiden Sie, wenn möglich, die direkte Sonne.";
            uvBoxColor = "#ffc9c9";
            uvBoxBorderColor = "#f2c9c9";
        } else {
            recommendation = "<strong>Extrem hohes Risiko</strong><br />bleiben Sie im Schatten und vermeiden Sie direkte Sonneneinstrahlung.";
            uvBoxColor = "#f2c9ff";
            uvBoxBorderColor = "#c9b9ff";
        }

        const uvMessageElement = document.getElementById("uv-message") as HTMLElement;
        uvMessageElement.innerHTML = `${recommendation}`;
        const uvIndexElement = document.getElementById("uv-index") as HTMLElement;
        uvIndexElement.innerHTML = `UV-Index in ${cityName}: <strong>${currentUv}</strong>`;


        
        const uvBoxElement = document.getElementById("uv-box") as HTMLElement;
        uvBoxElement.style.backgroundColor = uvBoxColor;
        uvBoxElement.style.border = `1px solid ${uvBoxBorderColor}`;

        const updateInfoElement = document.getElementById("update-info") as HTMLElement;
        const formattedTime = currentTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        updateInfoElement.innerHTML = `Letzte Aktualisierung: <time datetime="${currentTime.toISOString()}">${formattedTime}</time> Uhr`;
    } catch (error) {
        console.error("Fehler beim Laden der UV-Daten:", error);
        widget.innerHTML = `<p>UV-Daten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>`;
    }
}

fetchUvData();

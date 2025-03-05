// import ApexCharts from 'apexcharts';
import { TimeBarChart } from "./BarChart";

interface WeatherData {
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
        precipitation: string;
    };
    current: {
        time: string;
        interval: number;
        precipitation: number;
    };
    hourly_units: {
        time: string;
        precipitation: string;
    };
    hourly: {
        time: string[];
        precipitation: number[];
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

const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation&hourly=precipitation&timezone=auto&models=icon_seamless&past_days=1`;

async function fetchWeather(): Promise<void> {
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        }
        const wData = (await response.json()) as WeatherData;
        const { current, hourly } = wData;
        const graphData = [];


        for (let i = 20; i < hourly.time.length; i++) {
            graphData.push({ date: new Date(hourly.time[i]), value: hourly.precipitation[i] });
        }

        const container = document.getElementById("chart");
        if (container) {
            const chart = new TimeBarChart(container, graphData, {
                width: 800,
                height: 450,
                valueLabel: "Niederschlag",
                valueUnit: "mm"
            });
            chart.render();
        }


        const currentTime = new Date(current.time);

        let rainMessage = "Es wird aktuell kein Regen in den nächsten 7 Tagen erwartet.";

        if (current.precipitation > 0) {
            rainMessage = "Es regnet aktuell!";
        } else {
            for (let i = 0; i < hourly.time.length; i++) {
                const forecastTime = new Date(hourly.time[i]);
                if (forecastTime >= currentTime && hourly.precipitation[i] > 0) {

                    let date = forecastTime.toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
                    let time = forecastTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
                    rainMessage = `<strong>Nächster Regen:</strong> ${date} ${time} Uhr`;
                    break;
                }
            }
        }

        let rainMessageElement = document.getElementById("rain-message") as HTMLElement;
        rainMessageElement.innerHTML = rainMessage;

        const formattedTime = currentTime.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit"
        });


        const updateInfoElement = document.getElementById("update-info") as HTMLElement;
        updateInfoElement.innerHTML = `Letzte Aktualisierung: <time datetime="${currentTime.toISOString()}">${formattedTime}</time> Uhr`;

    } catch (error) {
        console.error("Fehler beim Laden der Wetterdaten:", error);
        weatherWidget.innerHTML = `<p>Wetterdaten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>`;
    }
}

fetchWeather();

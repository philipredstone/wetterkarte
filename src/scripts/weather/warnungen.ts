import L from "leaflet";
import 'leaflet/dist/leaflet.css';

// Fully type-safe interfaces
interface Region {
    polygonGeometry: GeoJSON.GeoJSON;
}

interface WarningData {
    time: string;
    warnings: RawWarning[];
}

interface RawWarning {
    warnId: string;
    type: number;
    level: number;
    start: number;
    end: number;
    urls: string[];
    isVorabinfo: boolean;
    bn: boolean;
    description: string;
    headLine: string;
    instruction: string;
    instructionHtml: string;
    event: string;
    descriptionText: string;
    regions: Region[];
}

interface WeatherWarning {
    warnId: string;
    type: number;
    level: number;
    start: number;
    end: number;
    urls: string[];
    isVorabinfo: boolean;
    bn: boolean;
    description: string;
    headLine: string;
    instruction: string;
    instructionHtml: string;
    event: string;
    descriptionText: string;
    geojsons: GeoJSON.GeoJSON[];
}

interface WarningStyle {
    color: string;
    icon: string;
    bg: string;
}

type WarningStyles = {
    [key: number]: WarningStyle;
};

document.addEventListener("DOMContentLoaded", (): void => {
    const isMobile: boolean = window.matchMedia('(max-width: 767px)').matches;
    const zoom: number = isMobile ? 5.5 : 6.5;
    
    const map: L.Map = L.map('map', {
        center: [51.163375, 10.447683] as L.LatLngExpression,
        zoom,
        attributionControl: false,
        zoomSnap: 0.01,
    });

    L.tileLayer('https://tiles.wetterkarte.org/base/{z}/{x}/{y}.webp', {
        attribution: '© OpenStreetMap contributors',
        maxNativeZoom: 10,
    }).addTo(map);

    // Define warning level styles
    const warningStyles: WarningStyles = {
        1: { color: "#00ff00", icon: "code-green.svg", bg: "#fafafa" },
        2: { color: "#f0b400", icon: "code-yellow.svg", bg: "#fff9f0" },
        3: { color: "#ff8c00", icon: "code-orange.svg", bg: "#fff5e6" },
        4: { color: "#ff0000", icon: "code-red.svg", bg: "#fff0f0" }
    };

    fetch("https://s3.eu-central-1.amazonaws.com/app-prod-static.warnwetter.de/v16/gemeinde_warnings_v2.json")
        .then((response: Response): Promise<WarningData> => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json() as Promise<WarningData>;
        })
        .then((data: WarningData): void => {
            const updateTime: Date = new Date(data.time);
            const formattedTime: string = updateTime.toLocaleTimeString("de-DE", { 
                hour: "2-digit", 
                minute: "2-digit" 
            });
            
            const updateInfoElement: HTMLElement | null = document.getElementById("update-info");
            if (updateInfoElement) {
                updateInfoElement.innerHTML = `Letzte Aktualisierung: <time datetime="${updateTime.toISOString()}">${formattedTime}</time> Uhr | Quelle: <a href="https://www.wettergefahren.de/" target="_blank">Deutscher Wetterdienst</a>`;
            }

            const warnings: WeatherWarning[] = data.warnings.map((warning: RawWarning): WeatherWarning => {
                return {
                    ...warning,
                    geojsons: warning.regions.map((region: Region): GeoJSON.GeoJSON => region.polygonGeometry)
                };
            });

            warnings.sort((a: WeatherWarning, b: WeatherWarning): number => b.level - a.level);
            
            warnings.forEach((warning: WeatherWarning, idx: number): void => {
                const style: WarningStyle = warningStyles[warning.level] || warningStyles[1];
                
                warning.geojsons.forEach((geojson: GeoJSON.GeoJSON): void => {
                    L.geoJSON(geojson, {
                        style: {
                            color: style.color,
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.1
                        }
                    })
                    .addTo(map)
                    .on('click', (): void => {
                        document.querySelectorAll<HTMLInputElement>(".warning-checkbox").forEach((checkbox: HTMLInputElement): void => {
                            checkbox.checked = true;
                        });
                        
                        const warningElement: HTMLElement | null = document.getElementById(warning.warnId);
                        if (warningElement) {
                            warningElement.scrollIntoView({ behavior: 'smooth' });
                            const checkbox: HTMLInputElement | null = warningElement.querySelector<HTMLInputElement>(".warning-checkbox");
                            if (checkbox) {
                                checkbox.checked = false;
                            }
                        }
                    });
                });
                
                const warningsContainer: HTMLElement | null = document.getElementById("warnings");
                if (!warningsContainer) return;
                
                const warningDiv: HTMLDivElement = document.createElement("div");
                warningDiv.classList.add("warning");
                warningDiv.id = warning.warnId;
                warningDiv.style.borderLeftColor = style.color;
                warningDiv.style.backgroundColor = style.bg;
                
                warningDiv.innerHTML = `
                    <input type="checkbox" id="warning-${idx}" class="warning-checkbox" checked>
                    <label for="warning-${idx}" class="warning-header">
                        <div class="warning-icon"><img src="/images/${style.icon}" height="48" width="48" alt="Warning icon"></div>
                        <h3 class="warning-title">${warning.headLine}</h3>
                        <span class="warning-toggle">▼</span>
                    </label>
                    <div class="warning-content">
                        <p>${warning.descriptionText}</p>
                        <br>
                        <p><strong>Anweisungen:</strong><br>${warning.instruction}</p>
                        <br>
                        <p><strong>Warnstufe:</strong> ${warning.level}</p>
                    </div>
                `;
                
                warningsContainer.appendChild(warningDiv);
            });
        })
        .catch((error: Error): void => {
            console.error('Error fetching weather warning data:', error.message);
        });
});
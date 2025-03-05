import L from "leaflet";
import 'leaflet/dist/leaflet.css';


type WeatherWarning = {
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
    geojsons: any[];
}

document.addEventListener("DOMContentLoaded", () => {

    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    let zoom = 6.5;

    if (isMobile) {
        zoom = 5.5;
    }

    let map = L.map('map', {
        center: [51.163375, 10.447683],
        zoom,
        attributionControl: false,
        zoomSnap: 0.01,
    });

    L.tileLayer('https://tiles.wetterkarte.org/base/{z}/{x}/{y}.webp', {
        attribution: '© OpenStreetMap contributors',
        maxNativeZoom: 10,
    }).addTo(map);

    fetch("https://s3.eu-central-1.amazonaws.com/app-prod-static.warnwetter.de/v16/gemeinde_warnings_v2.json")
        .then(response => response.json())
        .then(data => {

            let updateTime = new Date(data.time)

            const updateInfoElement = document.getElementById("update-info") as HTMLElement;
            const formattedTime = updateTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
            updateInfoElement.innerHTML = `Letzte Aktualisierung: <time datetime="${updateTime.toISOString()}">${formattedTime}</time> Uhr | Quelle: <a href="https://www.wettergefahren.de/" target="_blank">Deutscher Wetterdienst</a>`;

            for (const warning of data.warnings) {
                warning.geojsons = [];
                for (const region of warning.regions) {
                    warning.geojsons.push(region.polygonGeometry);
                }
                delete warning.regions;
            }

            let warnings: WeatherWarning[] = data.warnings;
            let idx = 0
            warnings.sort((a, b) => b.level - a.level);

            for (const warning of warnings) {

                let color = ""
                let icon = ""

                switch (warning.level) {
                    case 1:
                        color = "#00ff00"
                        icon = "code-green.svg"
                        break;
                    case 2:
                        color = "#f0b400"
                        icon = "code-yellow.svg"
                        break;
                    case 3:
                        color = "#ff8c00"
                        icon = "code-orange.svg"
                        break;
                    case 4:
                        color = "#ff0000"
                        icon = "code-red.svg"
                        break;
                }



                for (const geojson of warning.geojsons) {
                    let geojsonLayer = L.geoJSON(geojson, {
                        style: {
                            color,
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.1
                        }
                    })
                    geojsonLayer.addTo(map);
                    geojsonLayer.on('click', function (e) {
                        const warningElement = document.getElementById(warning.warnId);

                        for (const checkbox of document.getElementsByClassName("warning-checkbox")) {
                            checkbox.checked = true
                        }

                        if (warningElement) {
                            warningElement.scrollIntoView({ behavior: 'smooth' });
                            warningElement.getElementsByClassName("warning-checkbox")[0].checked = false
                        }
                    });
                }

                let warningDiv = document.createElement("div");
                warningDiv.classList.add("warning");
                warningDiv.id = warning.warnId;

                warningDiv.style.borderLeftColor = "#00ff00";
                warningDiv.style.backgroundColor = "#fafafa";

                //set border color
                if (warning.level === 2) {
                    warningDiv.style.borderLeftColor = "#f0b400";
                    warningDiv.style.backgroundColor = "#fff9f0";
                } else if (warning.level === 3) {
                    warningDiv.style.borderLeftColor = "#ff8c00";
                    warningDiv.style.backgroundColor = "#fff5e6";
                } else if (warning.level === 4) {
                    warningDiv.style.borderLeftColor = "#ff0000";
                    warningDiv.style.backgroundColor = "#fff0f0";
                }


                warningDiv.innerHTML = `

                <input type="checkbox" id="${idx}" class="warning-checkbox" checked>
                <label for="${idx}" class="warning-header">
                        <div class="warning-icon"><img src="/images/${icon}" height="48" width="48"> </img></div>
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

                `
                document.getElementById("warnings").appendChild(warningDiv);

                idx++


            }


        })


})

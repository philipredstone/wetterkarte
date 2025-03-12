type PollenLevel = "0" | "0-1" | "1" | "1-2" | "2" | "2-3" | "3";

type APIPollenData = {
    last_update: string;
    pollen: {
        alder: PollenLevel[];
        ash: PollenLevel[];
        birch: PollenLevel[];
        grasses: PollenLevel[];
        hazel: PollenLevel[];
        mugwort: PollenLevel[];
        ragweed: PollenLevel[];
        rye: PollenLevel[];
        [key: string]: PollenLevel[];
    }
}


const pollenColors: Record<PollenLevel, string> = {
    "0": "#e8f5e9",    // no pollen - light green
    "0-1": "#c8e6c9",  // very low - slightly deeper green
    "1": "#fff9c4",    // low - light yellow
    "1-2": "#ffecb3",  // low-moderate - amber/gold
    "2": "#ffcc80",    // moderate - light orange
    "2-3": "#ffab91",  // high - orange-red
    "3": "#ef9a9a"     // very high - red
};


document.addEventListener('DOMContentLoaded', async () => {
    const pollenWidget = document.getElementById('pollen-widget');

    if (!pollenWidget) return;
    const pollenRegion = pollenWidget.getAttribute('data-pollen-region') || '';
    const updateInfoEl = document.getElementById('update-info') as HTMLElement;

    if (pollenRegion == "") {
        updateInfoEl.textContent = `Letzte Aktualisierung: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`;
        return;
    }

    let fetched = await fetch(`https://cdn.wetterkarte.org/pollen/${pollenRegion}.json`)
    let pollenJson = (await fetched.json()) as APIPollenData


    for (const pollenType in pollenJson.pollen) {
        const pollenLevel = pollenJson.pollen[pollenType][0]
        const pollenLevelEl = document.getElementById(`${pollenType}-pollen-level`) as HTMLElement

        if (pollenLevelEl) {
            pollenLevelEl.style.display = "inline-block";
            pollenLevelEl.style.padding = "0.2rem 0.5rem";
            pollenLevelEl.style.borderRadius = "4px";
            pollenLevelEl.style.marginRight = "0.5rem";
            pollenLevelEl.style.color = "#333";
            pollenLevelEl.style.fontWeight = "bold";
            pollenLevelEl.style.fontSize = "0.9rem";
            pollenLevelEl.style.backgroundColor = pollenColors[pollenLevel];
            pollenLevelEl.textContent = `${pollenLevel}`
        }
    }

    if (updateInfoEl) {
        updateInfoEl.textContent = `Letzte Aktualisierung: ${new Date(pollenJson.last_update).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`;
    }
})
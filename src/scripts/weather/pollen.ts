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

const dayLabels = ["Heute", "Morgen", "Übermorgen"];
const pollenNamesGerman: Record<string, string> = {
    "alder": "Erle",
    "ash": "Esche",
    "birch": "Birke",
    "grasses": "Gräser",
    "hazel": "Hasel",
    "mugwort": "Beifuß",
    "ragweed": "Ambrosia",
    "rye": "Roggen"
};

function getPollenIcon(pollenType: string): string {
    if (pollenType === 'grasses' || pollenType === 'rye') {
        return '/images/pollen-grass.svg';
    } else if (pollenType === 'mugwort' || pollenType === 'ragweed') {
        return '/images/pollen-flower.svg';
    } else if (pollenType === 'birch') {
        return '/images/pollen-birch.svg';
    }
    return '/images/pollen-tree.svg';
}

document.addEventListener('DOMContentLoaded', async () => {
    const pollenWidget = document.getElementById('pollen-widget');
    if (!pollenWidget) return;
    
    const pollenRegion = pollenWidget.getAttribute('data-pollen-region') || '';
    const updateInfoEl = document.getElementById('update-info') as HTMLElement;
    
    if (pollenRegion === "") {
        updateInfoEl.textContent = `Letzte Aktualisierung: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`;
        return;
    }
    
    try {
        const fetched = await fetch(`https://cdn.wetterkarte.org/pollen/${pollenRegion}.json`);
        const pollenJson = (await fetched.json()) as APIPollenData;
        
        const tableBody = document.getElementById('pollen-data-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        const pollenTypes = Object.keys(pollenJson.pollen).sort((a, b) => {
            return (pollenNamesGerman[a] || a).localeCompare(pollenNamesGerman[b] || b);
        });
        
        pollenTypes.forEach(pollenType => {
            if (!pollenJson.pollen[pollenType] || pollenJson.pollen[pollenType].length === 0) return;
            
            const row = document.createElement('tr');
            
            const typeCell = document.createElement('td');
            typeCell.className = 'pollen-type-cell';
            
            const wrapper = document.createElement('div');
            wrapper.className = 'pollen-type-wrapper';
            
            const icon = document.createElement('img');
            icon.src = getPollenIcon(pollenType);
            icon.alt = pollenNamesGerman[pollenType] || pollenType;
            icon.width = 20;
            icon.height = 20;
            wrapper.appendChild(icon);
            
            const text = document.createElement('span');
            text.textContent = `${pollenNamesGerman[pollenType] || pollenType}`;
            wrapper.appendChild(text);
            
            typeCell.appendChild(wrapper);
            row.appendChild(typeCell);
            
            for (let i = 0; i < 3; i++) {
                const dayCell = document.createElement('td');
                dayCell.className = 'day-cell';
                
                if (i < pollenJson.pollen[pollenType].length) {
                    const level = pollenJson.pollen[pollenType][i];
                    
                    const badge = document.createElement('span');
                    badge.className = 'pollen-badge-table';
                    badge.textContent = level;
                    badge.style.backgroundColor = pollenColors[level];
                    
                    dayCell.appendChild(badge);
                } else {
                    dayCell.textContent = '-';
                }
                
                row.appendChild(dayCell);
            }
            
            tableBody.appendChild(row);
        });
        
        if (updateInfoEl) {
            updateInfoEl.textContent = `Letzte Aktualisierung: ${new Date(pollenJson.last_update).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`;
        }
    } catch (error) {
        console.error('Error fetching pollen data:', error);
        
        const tableBody = document.getElementById('pollen-data-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 20px; color: #d32f2f;">
                        <p>Fehler beim Laden der Daten. Bitte versuchen Sie es später erneut.</p>
                    </td>
                </tr>
            `;
        }
        
        if (updateInfoEl) {
            updateInfoEl.textContent = 'Fehler beim Laden der Daten. Bitte versuchen Sie es später erneut.';
        }
    }
});
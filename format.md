## Grid-Dateiformat (`.grid`)

### URL-Schema

```
https://cdn.wetterkarte.org/T_2M_GRID/{timestamp}.grid
```

Timestamp-Format: `YYYYMMDDHHmm` (z.B. `202603261200`)

Die Datei ist **gzip-komprimiert** — im Browser reicht `fetch()` mit dem richtigen `Accept-Encoding` Header, oder die Datei wird mit `Content-Encoding: gzip` ausgeliefert (R2/CDN macht das automatisch bei `.grid`-Dateien wenn der Client gzip akzeptiert).

### Header (66 Bytes, Little-Endian)

| Offset | Typ       | Feld       | Beschreibung                              |
|--------|-----------|------------|-------------------------------------------|
| 0      | int64     | `nx`       | Anzahl Spalten (Longitude) — aktuell 500  |
| 8      | int64     | `ny`       | Anzahl Zeilen (Latitude) — aktuell 400    |
| 16     | float64   | `dx`       | Gitterabstand Longitude (Grad)            |
| 24     | float64   | `dy`       | Gitterabstand Latitude (Grad)             |
| 32     | float64   | `lo1`      | Longitude des ersten Gitterpunkts (links) |
| 40     | float64   | `la1`      | Latitude des ersten Gitterpunkts (oben)   |
| 48     | float64   | `minValue` | Minimalwert des Wertebereichs (Kelvin)    |
| 56     | float64   | `maxValue` | Maximalwert des Wertebereichs (Kelvin)    |
| 64     | uint16    | `numColors`| Anzahl Farbeintraege in der Farbtabelle   |

Aktuell fuer Temperatur: `minValue = 220K` (-53°C), `maxValue = 320K` (+47°C).

### Farbtabelle (ab Offset 66)

`numColors * 3` Bytes. Jeder Eintrag ist 3 Bytes: `R, G, B` (je uint8).

Die Farben sind von **maxValue nach minValue** sortiert (Index 0 = waermste Farbe, letzter Index = kaelteste Farbe) — genau wie in der Go-ColorMap.

Um einen uint8-Datenwert (0-255) auf eine Farbe zu mappen:

```typescript
// uint8Value: 0 = minValue, 255 = maxValue
const normalized = uint8Value / 255;                       // 0..1
const colorIndex = Math.round((1 - normalized) * (numColors - 1));  // invertiert weil Tabelle max→min
const r = colorTable[colorIndex * 3];
const g = colorTable[colorIndex * 3 + 1];
const b = colorTable[colorIndex * 3 + 2];
```

### Daten (ab Offset 66 + numColors * 3)

`nx * ny` Bytes, jedes ein `uint8` (0-255). Zeilenweise gespeichert (row-major), erste Zeile = noerdlichster Breitengrad.

### Wert dekodieren

```
realValue = minValue + (uint8Value / 255) * (maxValue - minValue)
```

Fuer Temperatur in °C:
```
tempKelvin = 220 + (uint8Value / 255) * 100
tempCelsius = tempKelvin - 273.15
```

### Geokoordinate eines Pixels

```
longitude = lo1 + x * dx    // x = 0..nx-1
latitude  = la1 - y * dy    // y = 0..ny-1 (la1 ist oben/Nord, dy nach unten)
```

Hinweis: `dy` ist im Header als **negativer Wert** gespeichert (weil la1 > la2). Im Frontend also `la1 - y * Math.abs(dy)` verwenden.

### Bilineare Interpolation (fuer Rendering)

Fuer einen Pixel bei `(lat, lng)`:

```typescript
const i = (lng - lo1) / dx;              // Spalten-Index (float)
const j = (la1 - lat) / Math.abs(dy);    // Zeilen-Index (float)

const fi = Math.floor(i);
const fj = Math.floor(j);
const fx = i - fi;
const fy = j - fj;

// 4 Nachbarn
const v00 = data[fj * nx + fi];
const v10 = data[fj * nx + fi + 1];
const v01 = data[(fj + 1) * nx + fi];
const v11 = data[(fj + 1) * nx + fi + 1];

// Interpolierter uint8-Wert
const val = (1 - fx) * ((1 - fy) * v00 + fy * v01)
          +      fx  * ((1 - fy) * v10 + fy * v11);
```

### Parsing-Beispiel (TypeScript)

```typescript
const response = await fetch(url);
const buffer = await response.arrayBuffer();
const dv = new DataView(buffer);

let offset = 0;
const nx       = Number(dv.getBigInt64(offset, true)); offset += 8;
const ny       = Number(dv.getBigInt64(offset, true)); offset += 8;
const dx       = dv.getFloat64(offset, true);          offset += 8;
const dy       = dv.getFloat64(offset, true);          offset += 8;
const lo1      = dv.getFloat64(offset, true);          offset += 8;
const la1      = dv.getFloat64(offset, true);          offset += 8;
const minValue = dv.getFloat64(offset, true);          offset += 8;
const maxValue = dv.getFloat64(offset, true);          offset += 8;

const numColors = dv.getUint16(offset, true);           offset += 2;

// Farbtabelle: numColors * 3 Bytes (RGB)
const colorTable = new Uint8Array(buffer, offset, numColors * 3);
offset += numColors * 3;

// Gitterdaten: nx * ny Bytes (uint8, quantisiert 0-255)
const data = new Uint8Array(buffer, offset, nx * ny);
```

### Dateigroesse

Beispiel Temperatur (90 Farben, 500x400 Grid):
- Header: 66 Bytes
- Farbtabelle: 90 * 3 = 270 Bytes
- Daten: 200.000 Bytes
- **Total raw: ~200 KB**, gzip-komprimiert typischerweise **50-80 KB**

### Unterschied zu `.wind`

- `.wind` hat **2 Komponenten** (U + V, je `nx*ny` Bytes hintereinander), **keine** Farbtabelle, **kein** min/maxValue
- `.grid` hat **1 Komponente**, Farbtabelle eingebettet, und min/maxValue im Header

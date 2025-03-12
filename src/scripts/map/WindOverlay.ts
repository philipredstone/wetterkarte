import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { inflate } from "pako";

declare global {
  interface Window {
    move?: boolean;
  }
}

export interface DataHeader {
  nx: number;
  ny: number;
  dx: number;
  dy: number;
  lo1: number;
  la1: number;
}

export interface Data {
  header: DataHeader;
  data: number[];
}

export interface WindOverlayOptions extends L.LayerOptions {
  baseURL?: string;
  unit?: string;
  VELOCITY_SCALE?: number;
  PARTICLE_MULTIPLIER?: number;
  FRAME_RATE?: number;
}

interface Particle {
  x: number;
  y: number;
  value: [number, number];
  age: number;
}

function isInvalidValue(val: number): boolean {
  return val === 9999 || val === -9999;
}

function magnitude(u: number, v: number): number {
  return Math.sqrt(u * u + v * v);
}

function colorForSpeed(speed: number): string {
  const minSpeed = 0;
  const midSpeed = 10;
  const maxSpeed = 20;

  if (speed < minSpeed) speed = minSpeed;
  if (speed > maxSpeed) speed = maxSpeed;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  if (speed <= midSpeed) {
    const t = (speed - minSpeed) / (midSpeed - minSpeed);
    const r = lerp(255, 255, t); // (255 -> 255)
    const g = lerp(255, 255, t); // (255 -> 255)
    const b = lerp(255, 0, t);   // (255 -> 0)
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  } else {
    const t = (speed - midSpeed) / (maxSpeed - midSpeed);
    const r = lerp(255, 255, t); // (255 -> 255)
    const g = lerp(255, 0, t);   // (255 -> 0)
    const b = lerp(0, 0, t);     // (0 -> 0)
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }
}

/** Bilinear interpolator for wind data. */
class Interpolator {
  private header: DataHeader;
  private uComp: number[];
  private vComp: number[];

  constructor(header: DataHeader) {
    this.header = header;
    this.uComp = [];
    this.vComp = [];
  }

  public setData(uComp: number[], vComp: number[]): void {
    this.uComp = uComp;
    this.vComp = vComp;
  }

  /**
   * Interpolate (u, v) at lat/lng, ignoring out-of-bounds and ±9999 corners.
   */
  public interpolate(lat: number, lng: number): [number, number] | null {
    const { nx, ny, dx, dy, lo1, la1 } = this.header;

    const i = ((lng - lo1) - 360 * Math.floor((lng - lo1) / 360)) / dx;
    const j = (la1 - lat) / -dy;

    const fi = Math.floor(i);
    const fj = Math.floor(j);

    // out of range => no data
    if (fi < 0 || fi >= nx - 1 || fj < 0 || fj >= ny - 1) {
      return null;
    }

    const ix = i - fi;
    const iy = j - fj;
    const lx = 1 - ix;
    const ly = 1 - iy;

    const idx11 = fi + fj * nx;
    const idx12 = fi + (fj + 1) * nx;
    const idx21 = fi + 1 + fj * nx;
    const idx22 = fi + 1 + (fj + 1) * nx;

    // if any corner is ±9999 => skip
    for (const idx of [idx11, idx12, idx21, idx22]) {
      if (
        isInvalidValue(this.uComp[idx]) ||
        isInvalidValue(this.vComp[idx])
      ) {
        return null;
      }
    }

    const uVal =
      this.uComp[idx11] * (lx * ly) +
      this.uComp[idx21] * (ix * ly) +
      this.uComp[idx12] * (lx * iy) +
      this.uComp[idx22] * (ix * iy);

    const vVal =
      this.vComp[idx11] * (lx * ly) +
      this.vComp[idx21] * (ix * ly) +
      this.vComp[idx12] * (lx * iy) +
      this.vComp[idx22] * (ix * iy);

    if (Number.isNaN(uVal) || Number.isNaN(vVal)) {
      return null;
    }
    return [uVal, vVal];
  }
}

export class WindOverlay extends L.Layer {
  options: WindOverlayOptions = {
    baseURL: "https://example.com/data.bw",
    unit: "m/s",
    VELOCITY_SCALE: 0.3,
    PARTICLE_MULTIPLIER: 1 / 1500,
    FRAME_RATE: 60,
  };

  private map!: L.Map;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private compLength: number = 0;
  private interpolator!: Interpolator;
  private move: boolean = false;
  private particles: Particle[] = [];
  private animationRequestId: number | null = null;

  constructor(options?: WindOverlayOptions) {
    super(options);
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  public onAdd(map: L.Map): this {
    this.map = map;
    this.canvas = this.createCanvas();
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D context not supported");
    this.ctx = ctx;

    this.update();
    this.map.on("move", this.onMove, this);
    this.map.on("moveend", this.onMoveEnd, this);
    this.map.on("zoomstart", this.onZoomStart, this);
    this.map.on("zoomend", this.onZoomEnd, this);
    this.map.on("resize", this.resize, this);

    // When movement or zooming starts, clear the canvas and set the move flag.
    this.map.on("movestart", () => {
      this.move = true;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }, this);
    this.map.on("zoomstart", () => {
      this.move = true;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }, this);

    // When movement or zooming ends, unset the move flag.
    this.map.on("moveend", () => {
      this.move = false;
    }, this);
    this.map.on("zoomend", () => {
      this.move = false;
    }, this);

    this.downloadData()
      .then(() => {
        this.generateField();
      })
      .catch(console.error);

    return this;
  }

  public onRemove(): this {
    if (this.animationRequestId) {
      cancelAnimationFrame(this.animationRequestId);
      this.animationRequestId = null;
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.map.off("move", this.onMove, this);
    this.map.off("moveend", this.onMoveEnd, this);
    this.map.off("zoomstart", this.onZoomStart, this);
    this.map.off("zoomend", this.onZoomEnd, this);
    this.map.off("resize", this.resize, this);
    return this;
  }

  private async downloadData(): Promise<void> {
    const url = this.options.baseURL!;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const compressedBuffer = await response.arrayBuffer();
    const decompressedBuffer = inflate(new Uint8Array(compressedBuffer)).buffer;
    const data = this.parseBinary(decompressedBuffer);

    this.compLength = data.header.nx * data.header.ny;
    this.interpolator = new Interpolator(data.header);

    if (data.data.length === 2 * this.compLength) {
      const uComp = data.data
        .slice(0, this.compLength)
        .map(v => this.dequantize(v));
      const vComp = data.data
        .slice(this.compLength)
        .map(v => this.dequantize(v));
      this.interpolator.setData(uComp, vComp);
    } else {
      const uComp = data.data.map(v => this.dequantize(v));
      this.interpolator.setData(uComp, new Array(this.compLength).fill(0));
    }
  }

  private onMove = (): void => {
    this.update();
  };

  private onMoveEnd = (): void => {
    // Restart animation if needed
    if (!this.animationRequestId) {
      this.generateField();
    }
  };

  private onZoomStart = (): void => {
    this.update();
  };

  private onZoomEnd = (): void => {
    // Restart animation after zoom
    if (!this.animationRequestId) {
      this.generateField();
    }
  };

  private parseBinary(buffer: ArrayBuffer): Data {
    const dv = new DataView(buffer);
    let offset = 0;
    // Read header values (nx, ny, dx, dy, lo1, la1).
    const nx = Number(dv.getBigInt64(offset, true));
    offset += 8;
    const ny = Number(dv.getBigInt64(offset, true));
    offset += 8;
    const dx = dv.getFloat64(offset, true);
    offset += 8;
    const dy = dv.getFloat64(offset, true);
    offset += 8;
    const lo1 = dv.getFloat64(offset, true);
    offset += 8;
    const la1 = dv.getFloat64(offset, true);
    offset += 8;

    const header: DataHeader = { nx, ny, dx, dy, lo1, la1 };
    // Remaining bytes are quantized wind data stored as uint8.
    const numValues = buffer.byteLength - offset;
    const data: number[] = [];
    for (let i = 0; i < numValues; i++) {
      data.push(dv.getUint8(offset));
      offset += 1;
    }
    return { header, data };
  }

  private dequantize(q: number): number {
    // Maps a quantized value (0-255) to a wind speed between -63 m/s and +63 m/s.
    const min = -65;
    const max = 65;
    return (q / 255) * (max - min) + min;
  }

  private generateField(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const particleMultiplier = this.options.PARTICLE_MULTIPLIER || 1 / 1500;

    const particleCount = Math.min(
      Math.round(width * height * particleMultiplier),
      3000
    );

    this.particles = [];
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(this.randomParticle());
    }

    // Start the animation loop using requestAnimationFrame
    this.animationRequestId = requestAnimationFrame(this.animateField);
  }

  private animateField = (): void => {
    // If the map is moving, skip updating particles (but keep the animation loop alive)
    if (this.move) {
      this.animationRequestId = requestAnimationFrame(this.animateField);
      return;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const baseVelocityScale = this.options.VELOCITY_SCALE || 1;
    const fadeAlpha = 0.96;

    // Fade the canvas slightly to create a trailing effect
    this.ctx.globalCompositeOperation = "destination-in";
    this.ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.globalCompositeOperation = "source-over";

    // Update and draw each particle
    for (let i = 0; i < this.particles.length; i++) {
      let p = this.particles[i];
      p.age++;

      // If the particle is too old, reset it
      if (!p.value || p.age >= 90) {
        this.particles[i] = this.randomParticle();
        continue;
      }

      const [u, v] = p.value;
      const spdPx = Math.sqrt(u * u + v * v);
      const spdMs = spdPx / baseVelocityScale;
      const strokeColor = colorForSpeed(spdMs);

      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);

      // Update particle position
      p.x += u;
      p.y += v;

      // If particle goes out of bounds, reset it
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
        this.particles[i] = this.randomParticle();
        continue;
      }

      this.ctx.lineTo(p.x, p.y);
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();

      const next = this.calculateVector(p.x, p.y);
      if (!next) {
        this.particles[i] = this.randomParticle();
      } else {
        p.value = next;
      }
    }

    this.animationRequestId = requestAnimationFrame(this.animateField);
  };

  private update(): void {
    const mapPane = document.querySelector(".leaflet-map-pane") as HTMLElement;
    if (!mapPane) return;

    const transform = mapPane.style.transform || "";
    const values = transform.split(/\w+\(|\);?/).filter(Boolean);
    if (values.length > 0) {
      const parts = values[0]
        .split(",")
        .map((e) => parseInt(e.replace("px", "")) * -1);
      this.canvas.style.transform = `translate3d(${parts[0]}px, ${parts[1]}px, 0px)`;
    }
  }

  private resize = (): void => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    // Restart animation on resize
    if (this.animationRequestId) {
      cancelAnimationFrame(this.animationRequestId);
      this.animationRequestId = null;
    }
    this.generateField();
  };

  private createCanvas(): HTMLCanvasElement {
    const id = `wind-overlay-${Math.random().toString(36).slice(2)}`;
    let canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.zIndex = "1000";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.pointerEvents = "none";
      canvas.id = id;

      const pane = document.querySelector(".leaflet-map-pane");
      if (pane) {
        pane.insertBefore(canvas, pane.firstChild);
      }
    }
    return canvas;
  }

  private calculateVector(x: number, y: number): [number, number] | null {
    const latLng = this.map.containerPointToLatLng([x, y]);
    const wind = this.interpolator.interpolate(latLng.lat, latLng.lng);
    if (!wind) return null;
    let [u, v] = wind;
    u *= this.options.VELOCITY_SCALE || 1;
    v *= this.options.VELOCITY_SCALE || 1;
    return [u, -v];
  }

  private randomParticle(): Particle {
    const width = this.canvas.width;
    const height = this.canvas.height;
    let x: number;
    let y: number;
    let vec: [number, number] | null;
    let attempts = 0;
    do {
      x = Math.random() * width;
      y = Math.random() * height;
      vec = this.calculateVector(x, y);
      attempts++;
      if (attempts > 10) break;
    } while (!vec);
    return {
      x,
      y,
      value: vec || [0, 0],
      age: Math.floor(Math.random() * 90),
    };
  }
}

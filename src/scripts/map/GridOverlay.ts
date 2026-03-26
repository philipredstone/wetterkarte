import L from "leaflet";
import { inflate } from "pako";

interface GridHeader {
  nx: number;
  ny: number;
  dx: number;
  dy: number;
  lo1: number;
  la1: number;
  minValue: number;
  maxValue: number;
  numColors: number;
}

interface GridData {
  header: GridHeader;
  colorTable: Uint8Array;
  data: Uint8Array;
}

export interface GridOverlayOptions extends L.GridLayerOptions {
  baseURL: string;
}

// ── Shaders ─────────────────────────────────────────────────────────

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 v_uv;

uniform sampler2D u_data;
uniform sampler2D u_colors;
uniform float u_west, u_east;
uniform float u_mercSouth, u_mercNorth;
uniform float u_lo1, u_la1, u_dx, u_invDy;
uniform float u_nx, u_ny;

const float PI = 3.14159265358979;

void main() {
  float lng = mix(u_west, u_east, v_uv.x);

  float mercY = mix(u_mercSouth, u_mercNorth, v_uv.y);
  float lat = degrees(2.0 * atan(exp(mercY)) - PI * 0.5);

  float gi = (lng - u_lo1) / u_dx;
  float gj = (lat - u_la1) * u_invDy;

  if (gi < 0.0 || gi > u_nx - 1.0 || gj < 0.0 || gj > u_ny - 1.0) {
    discard;
  }

  vec2 uv = vec2((gi + 0.5) / u_nx, (gj + 0.5) / u_ny);
  float val = texture2D(u_data, uv).r;

  float colorU = clamp(1.0 - val, 0.0, 1.0);
  vec3 color = texture2D(u_colors, vec2(colorU, 0.5)).rgb;

  gl_FragColor = vec4(color, 1.0);
}`;

// ── Tile renderer interface ─────────────────────────────────────────

interface TileRenderer {
  init(tileSize: number): void;
  uploadData(grid: GridData): void;
  renderTile(
    img: HTMLImageElement,
    bounds: { west: number; east: number; north: number; south: number },
    tileSize: number,
    done: L.DoneCallback,
  ): void;
  destroy(): void;
}

// ── WebGL renderer ──────────────────────────────────────────────────

class WebGLRenderer implements TileRenderer {
  private canvas!: HTMLCanvasElement;
  private gl!: WebGLRenderingContext;
  private program!: WebGLProgram;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  init(tileSize: number): void {
    this.canvas = document.createElement("canvas");
    this.canvas.width = tileSize;
    this.canvas.height = tileSize;

    const gl = this.canvas.getContext("webgl", {
      premultipliedAlpha: false,
      alpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!gl) throw new Error("WebGL not available");
    this.gl = gl;

    const vs = this.compile(gl.VERTEX_SHADER, VERT);
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAG);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error("Shader link: " + gl.getProgramInfoLog(this.program));
    }
    gl.useProgram(this.program);

    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, 1, 1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    for (const n of [
      "u_data", "u_colors",
      "u_west", "u_east", "u_mercSouth", "u_mercNorth",
      "u_lo1", "u_la1", "u_dx", "u_invDy",
      "u_nx", "u_ny",
    ]) {
      this.uniforms[n] = gl.getUniformLocation(this.program, n);
    }

    gl.clearColor(0, 0, 0, 0);
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error("Shader: " + gl.getShaderInfoLog(s));
    }
    return s;
  }

  uploadData(grid: GridData): void {
    const gl = this.gl;
    const { header, colorTable, data } = grid;

    const dataTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dataTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, header.nx, header.ny, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.uniforms.u_data, 0);

    const colTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, colTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, header.numColors, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, colorTable);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.uniforms.u_colors, 1);

    gl.uniform1f(this.uniforms.u_lo1, header.lo1);
    gl.uniform1f(this.uniforms.u_la1, header.la1);
    gl.uniform1f(this.uniforms.u_dx, header.dx);
    gl.uniform1f(this.uniforms.u_invDy, 1.0 / header.dy);
    gl.uniform1f(this.uniforms.u_nx, header.nx);
    gl.uniform1f(this.uniforms.u_ny, header.ny);
  }

  renderTile(
    img: HTMLImageElement,
    bounds: { west: number; east: number; north: number; south: number },
    tileSize: number,
    done: L.DoneCallback,
  ): void {
    const gl = this.gl;
    const toMerc = (d: number) =>
      Math.log(Math.tan(Math.PI / 4 + (d * Math.PI) / 360));

    gl.viewport(0, 0, tileSize, tileSize);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1f(this.uniforms.u_west, bounds.west);
    gl.uniform1f(this.uniforms.u_east, bounds.east);
    gl.uniform1f(this.uniforms.u_mercSouth, toMerc(bounds.south));
    gl.uniform1f(this.uniforms.u_mercNorth, toMerc(bounds.north));

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.canvas.toBlob((blob) => {
      if (!blob) { done(null as any, img); return; }
      const url = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(url); done(null as any, img); };
      img.onerror = () => { URL.revokeObjectURL(url); done(null as any, img); };
      img.src = url;
    }, "image/png");
  }

  destroy(): void {
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

// ── Canvas 2D fallback renderer ─────────────────────────────────────

class Canvas2DRenderer implements TileRenderer {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private grid!: GridData;
  private colorLUT!: Uint8Array;

  init(tileSize: number): void {
    this.canvas = document.createElement("canvas");
    this.canvas.width = tileSize;
    this.canvas.height = tileSize;
    this.ctx = this.canvas.getContext("2d")!;
  }

  uploadData(grid: GridData): void {
    this.grid = grid;

    // Pre-build RGBA LUT
    const n = grid.header.numColors;
    this.colorLUT = new Uint8Array(n * 4);
    for (let c = 0; c < n; c++) {
      this.colorLUT[c * 4] = grid.colorTable[c * 3];
      this.colorLUT[c * 4 + 1] = grid.colorTable[c * 3 + 1];
      this.colorLUT[c * 4 + 2] = grid.colorTable[c * 3 + 2];
      this.colorLUT[c * 4 + 3] = 255;
    }
  }

  renderTile(
    img: HTMLImageElement,
    bounds: { west: number; east: number; north: number; south: number },
    tileSize: number,
    done: L.DoneCallback,
  ): void {
    const { header, data } = this.grid;
    const { nx, ny, dx, dy, lo1, la1, numColors } = header;

    const imageData = this.ctx.createImageData(tileSize, tileSize);
    const pixels = imageData.data;
    const colorScale = numColors - 1;
    const invDy = 1 / dy;

    // Precompute Mercator bounds
    const toMerc = (d: number) =>
      Math.log(Math.tan(Math.PI / 4 + (d * Math.PI) / 360));
    const mercSouth = toMerc(bounds.south);
    const mercNorth = toMerc(bounds.north);
    const PI = Math.PI;

    for (let py = 0; py < tileSize; py++) {
      // Screen y → lat via inverse Mercator (y=0 is top/north)
      const t = 1 - py / (tileSize - 1);
      const mercY = mercSouth + t * (mercNorth - mercSouth);
      const lat = (2 * Math.atan(Math.exp(mercY)) - PI / 2) * (180 / PI);

      const gj = (lat - la1) * invDy;
      const fj = Math.floor(gj);
      if (fj < 0 || fj >= ny - 1) continue;
      const fy = gj - fj;
      const fy1 = 1 - fy;
      const row0 = fj * nx;
      const row1 = (fj + 1) * nx;

      for (let px = 0; px < tileSize; px++) {
        const lng = bounds.west + (px / (tileSize - 1)) * (bounds.east - bounds.west);

        const gi = (lng - lo1) / dx;
        const fi = Math.floor(gi);
        if (fi < 0 || fi >= nx - 1) continue;
        const fx = gi - fi;

        // Bilinear interpolation
        const val =
          (1 - fx) * (fy1 * data[row0 + fi] + fy * data[row1 + fi]) +
          fx * (fy1 * data[row0 + fi + 1] + fy * data[row1 + fi + 1]);

        const ci = Math.round((1 - val / 255) * colorScale);
        const ci4 = (ci < 0 ? 0 : ci > colorScale ? colorScale : ci) * 4;

        const off = (py * tileSize + px) * 4;
        pixels[off] = this.colorLUT[ci4];
        pixels[off + 1] = this.colorLUT[ci4 + 1];
        pixels[off + 2] = this.colorLUT[ci4 + 2];
        pixels[off + 3] = this.colorLUT[ci4 + 3];
      }
    }

    this.ctx.putImageData(imageData, 0, 0);

    this.canvas.toBlob((blob) => {
      if (!blob) { done(null as any, img); return; }
      const url = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(url); done(null as any, img); };
      img.onerror = () => { URL.revokeObjectURL(url); done(null as any, img); };
      img.src = url;
    }, "image/png");
  }

  destroy(): void {}
}

// ── GridLayer implementation ────────────────────────────────────────

export class GridOverlay extends L.GridLayer {
  private _baseURL: string;
  private gridData: GridData | null = null;
  private renderer!: TileRenderer;
  private dataReady = false;
  private map!: L.Map;

  constructor(options: GridOverlayOptions) {
    super({
      tileSize: 256,
      opacity: options.opacity ?? 0.7,
      ...options,
    });
    this._baseURL = options.baseURL;
  }

  onAdd(map: L.Map): this {
    this.map = map;
    this.initRenderer();
    this.loadData();
    return super.onAdd(map);
  }

  onRemove(map: L.Map): this {
    this.renderer?.destroy();
    return super.onRemove(map);
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement("img") as HTMLImageElement;

    if (this.dataReady) {
      const bounds = this.tileBounds(coords);
      const size = this.getTileSize();
      this.renderer.renderTile(img, bounds, size.x, done);
    } else {
      setTimeout(() => done(null as any, img), 0);
    }

    return img;
  }

  // ── Renderer init (WebGL with Canvas 2D fallback) ─────────────────

  private initRenderer(): void {
    const size = (this.getTileSize() as any).x ?? 256;

    // Try WebGL first, fall back to Canvas 2D
    try {
      const r = new WebGLRenderer();
      r.init(size);
      this.renderer = r;
      console.log("GridOverlay: using WebGL renderer");
    } catch {
      const r = new Canvas2DRenderer();
      r.init(size);
      this.renderer = r;
      console.log("GridOverlay: WebGL unavailable, using Canvas 2D fallback");
    }
  }

  // ── Tile bounds ───────────────────────────────────────────────────

  private tileBounds(coords: L.Coords): {
    west: number; east: number; north: number; south: number;
  } {
    const size = this.getTileSize();
    const nw = L.point(coords.x * size.x, coords.y * size.y);
    const se = L.point((coords.x + 1) * size.x, (coords.y + 1) * size.y);

    const crs = this.map.options.crs || L.CRS.EPSG3857;
    const nwLL = crs.pointToLatLng(nw, coords.z);
    const seLL = crs.pointToLatLng(se, coords.z);

    let west = nwLL.lng;
    let east = seLL.lng;
    if (this.gridData!.header.lo1 > 180) {
      west += 360;
      east += 360;
    }

    return { west, east, north: nwLL.lat, south: seLL.lat };
  }

  // ── Data loading ──────────────────────────────────────────────────

  private async loadData(): Promise<void> {
    try {
      const res = await fetch(this._baseURL);
      if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);

      const raw = await res.arrayBuffer();
      let buf: ArrayBuffer;
      try {
        const d = inflate(new Uint8Array(raw));
        buf = d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
      } catch {
        buf = raw;
      }

      this.gridData = this.parseGrid(buf);
      this.renderer.uploadData(this.gridData);
      this.dataReady = true;
      this.redraw();
    } catch (err) {
      console.error("GridOverlay: failed to load data", err);
    }
  }

  private parseGrid(buffer: ArrayBuffer): GridData {
    const dv = new DataView(buffer);
    let o = 0;

    const nx = Number(dv.getBigInt64(o, true)); o += 8;
    const ny = Number(dv.getBigInt64(o, true)); o += 8;
    const dx = dv.getFloat64(o, true); o += 8;
    const dy = dv.getFloat64(o, true); o += 8;
    const lo1 = dv.getFloat64(o, true); o += 8;
    const la1 = dv.getFloat64(o, true); o += 8;
    const minValue = dv.getFloat64(o, true); o += 8;
    const maxValue = dv.getFloat64(o, true); o += 8;
    const numColors = dv.getUint16(o, true); o += 2;

    const colorTable = new Uint8Array(buffer.slice(o, o + numColors * 3));
    o += numColors * 3;
    const data = new Uint8Array(buffer.slice(o, o + nx * ny));

    return {
      header: { nx, ny, dx, dy, lo1, la1, minValue, maxValue, numColors },
      colorTable,
      data,
    };
  }
}

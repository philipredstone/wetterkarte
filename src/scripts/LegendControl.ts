import L from "leaflet";

export class LegendControl extends L.Control {
  private _container: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _currentType: string;
  private _layers: any;

  constructor(layers: any, options?: L.ControlOptions) {
    super(options);
    this._layers = layers;
  }

  onAdd(map: L.Map): HTMLElement {
    // Create container element
    this._container = L.DomUtil.create('div', 'leaflet-legend-control');
    
    // Create canvas element
    this._canvas = L.DomUtil.create('canvas', 'legend-canvas', this._container) as HTMLCanvasElement;
    
    // Style the container
    this._container.style.backgroundColor = 'white';
    this._container.style.padding = '5px';
    this._container.style.borderRadius = '4px';
    this._container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
    
    return this._container;
  }

  update(layerType: string): void {
    if (!this._layers[layerType]) return;
    
    this._currentType = layerType;
    const layer = this._layers[layerType];
    const gradientColors = layer.gradient;
    const values = layer.labels;

    // Check if gradient colors or labels are empty arrays
    if (!gradientColors || gradientColors.length === 0 || !values || values.length === 0) {
      // Hide the entire container element
      this._container.style.display = 'none';
      return; // Don't render anything
    }
    
    // Show the container if it was previously hidden
    this._container.style.display = 'block';

    const minLabel = values[0];
    const maxLabel = values[values.length - 1];
    const midLabel = values[Math.floor(values.length / 2)];

    const rectWidth = 20;
    const tickLength = 0;
    const labelOffset = 2;
    const borderRadius = 3;

    const offscreen = document.createElement("canvas");
    const offCtx = offscreen.getContext("2d")!;
    offCtx.font = "12px sans-serif";
    const maxLabelWidth = Math.max(
      offCtx.measureText(maxLabel).width,
      offCtx.measureText(midLabel).width,
      offCtx.measureText(minLabel).width
    );

    const neededWidth = maxLabelWidth + tickLength + labelOffset + rectWidth;
    const canvas = this._canvas;
    const desiredCSSHeight = 150;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = neededWidth * dpr;
    canvas.height = desiredCSSHeight * dpr;
    canvas.style.width = `${neededWidth}px`;
    canvas.style.height = `${desiredCSSHeight}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, neededWidth, desiredCSSHeight);

    // Draw rounded rectangle function
    function drawRoundedRect(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number
    ) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    // Create gradient
    let gradient: CanvasGradient = ctx.createLinearGradient(0, desiredCSSHeight, 0, 0);
    gradientColors.forEach((color, index) => {
      gradient.addColorStop(index / (gradientColors.length - 1), color);
    });
    
    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, 0, 0, rectWidth, desiredCSSHeight, borderRadius);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 0, 0, rectWidth, desiredCSSHeight, borderRadius);
    ctx.stroke();

    // Draw labels
    const labels = [
      { text: maxLabel, y: 0, baseline: "top" as CanvasTextBaseline },
      { text: midLabel, y: desiredCSSHeight / 2, baseline: "middle" as CanvasTextBaseline },
      { text: minLabel, y: desiredCSSHeight, baseline: "bottom" as CanvasTextBaseline }
    ];

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#333";
    ctx.textAlign = "left";
    
    labels.forEach(label => {
      ctx.textBaseline = label.baseline;
      ctx.beginPath();
      ctx.moveTo(rectWidth, label.y);
      ctx.lineTo(rectWidth + tickLength, label.y);
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillText(label.text, rectWidth + tickLength + labelOffset, label.y);
    });
  }
}
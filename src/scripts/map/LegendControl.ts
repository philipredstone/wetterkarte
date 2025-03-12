import L from "leaflet";

interface LegendLayerConfig {
  gradient: string[];
  labels: string[];
}

interface LegendControlOptions extends L.ControlOptions {
  rectWidth?: number;
  tickLength?: number;
  labelOffset?: number;
  borderRadius?: number;
  height?: number;
  font?: string;
  fontWeight?: string;
  fontSize?: number;
  fontFamily?: string;
  backgroundColor?: string;
  boxShadow?: string;
  padding?: string;
  textColor?: string;
  strokeColor?: string;
  textShadow?: string;
  enableTextStroke?: boolean;
  textStrokeWidth?: number;
  textStrokeColor?: string;
  highQualityText?: boolean;
}

export class LegendControl extends L.Control {
  private _container: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _currentType: string | null = null;
  private _layers: Record<string, LegendLayerConfig>;
  private _options: Required<LegendControlOptions>;
  private _textMeasureCanvas: HTMLCanvasElement;

  private static readonly DEFAULT_OPTIONS: Required<LegendControlOptions> = {
    position: 'bottomright',
    rectWidth: 20,
    tickLength: 0,
    labelOffset: 2,
    borderRadius: 3,
    height: 150,
    font: '12px sans-serif',
    fontWeight: '500',
    fontSize: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    backgroundColor: 'white',
    boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
    padding: '5px',
    textColor: '#333',
    strokeColor: '#ffffff',
    textShadow: 'none',
    enableTextStroke: false,
    textStrokeWidth: 1,
    textStrokeColor: '#ffffff',
    highQualityText: true
  };

  constructor(layers: Record<string, LegendLayerConfig>, options?: LegendControlOptions) {
    super(options);
    this._layers = layers;
    this._options = { ...LegendControl.DEFAULT_OPTIONS, ...options };
    
    this._textMeasureCanvas = document.createElement('canvas');
  }

  onAdd(map: L.Map): HTMLElement {
    this._container = L.DomUtil.create('div', 'leaflet-legend-control');
    
    this._canvas = L.DomUtil.create('canvas', 'legend-canvas', this._container) as HTMLCanvasElement;
    
    Object.assign(this._container.style, {
      backgroundColor: this._options.backgroundColor,
      padding: this._options.padding,
      borderRadius: '4px',
      boxShadow: this._options.boxShadow
    });
    
    if (this._options.highQualityText) {
      const style = document.createElement('style');
      style.textContent = `
        .leaflet-legend-control {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
      `;
      document.head.appendChild(style);
    }
    
    this._container.style.display = 'none';
    
    return this._container;
  }

  update(layerType: string): boolean {
    if (this._currentType === layerType) return true;
    
    if (!this._layers[layerType]) return false;
    
    this._currentType = layerType;
    const layer = this._layers[layerType];
    const { gradient: gradientColors, labels: values } = layer;

    if (!gradientColors?.length || !values?.length) {
      this._container.style.display = 'none';
      return false;
    }
    
    this._container.style.display = 'block';

    this._drawLegend(gradientColors, values);
    return true;
  }

  private _drawLegend(gradientColors: string[], values: string[]): void {
    const { rectWidth, tickLength, labelOffset, borderRadius, height } = this._options;
    const minLabel = values[0];
    const maxLabel = values[values.length - 1];
    const midLabel = values[Math.floor(values.length / 2)];

    const maxLabelWidth = this._getMaxLabelWidth([minLabel, midLabel, maxLabel]);
    const neededWidth = maxLabelWidth + tickLength + labelOffset + rectWidth;
    
    const canvas = this._canvas;
    const dpr = window.devicePixelRatio || 1;
    
    const scaleFactor = this._options.highQualityText ? Math.max(dpr, 2) : dpr;
    
    canvas.width = neededWidth * scaleFactor;
    canvas.height = height * scaleFactor;
    canvas.style.width = `${neededWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d", { 
      alpha: true,
      desynchronized: false,
      willReadFrequently: false
    });
    
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.scale(scaleFactor, scaleFactor);
    ctx.clearRect(0, 0, neededWidth, height);
    
    ctx.globalCompositeOperation = 'source-over';
    
    ctx.translate(0.5, 0.5);

    this._drawGradient(ctx, gradientColors);
    
    this._drawLabels(ctx, [
      { text: maxLabel, y: Math.round(3), baseline: "top" },
      { text: midLabel, y: Math.round(height / 2), baseline: "middle" },
      { text: minLabel, y: Math.round(height - 3), baseline: "bottom" }
    ]);
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private _getMaxLabelWidth(labels: string[]): number {
    const ctx = this._textMeasureCanvas.getContext("2d", { alpha: true });
    if (!ctx) return 50;
    
    const { fontFamily, fontSize, fontWeight } = this._options;
    const fontString = this._options.font;
    
    if (fontString && fontString !== '12px sans-serif') {
      ctx.font = fontString;
    } else {
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    }
    
    if (this._options.highQualityText) {
      ctx.textRendering = 'optimizeLegibility' as any;
      (ctx as any).fontKerning = 'normal';
      (ctx as any).fontStretch = 'normal';
    }
    
    const padding = Math.ceil(fontSize * 0.2);
    return Math.max(...labels.map(label => ctx.measureText(label).width)) + padding;
  }

  private _drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    if (radius === 0) {
      ctx.rect(x, y, width, height);
      return;
    }

    const r = Math.min(radius, Math.min(width, height) / 2);
    
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private _drawGradient(
    ctx: CanvasRenderingContext2D,
    gradientColors: string[]
  ): void {
    const { rectWidth, height, borderRadius, strokeColor } = this._options;
    
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradientColors.forEach((color, index) => {
      gradient.addColorStop(index / (gradientColors.length - 1), color);
    });
    
    ctx.fillStyle = gradient;
    this._drawRoundedRect(ctx, 0, 0, rectWidth, height, borderRadius);
    ctx.fill();
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    this._drawRoundedRect(ctx, 0, 0, rectWidth, height, borderRadius);
    ctx.stroke();
  }

  private _drawLabels(
    ctx: CanvasRenderingContext2D,
    labels: Array<{ text: string; y: number; baseline: CanvasTextBaseline }>
  ): void {
    const { 
      rectWidth, 
      tickLength, 
      labelOffset, 
      font, 
      fontFamily,
      fontSize,
      fontWeight,
      textColor,
      textShadow,
      enableTextStroke,
      textStrokeWidth,
      textStrokeColor,
      highQualityText
    } = this._options;
    
    if (highQualityText) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      (ctx as any).textRendering = 'optimizeLegibility';
      (ctx as any).fontKerning = 'normal';
      (ctx as any).fontVariantLigatures = 'normal';
    }
    
    if (font && font !== '12px sans-serif') {
      ctx.font = font;
    } else {
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    }
    
    ctx.textAlign = "left";
    ctx.miterLimit = 2;
    
    labels.forEach(label => {
      ctx.textBaseline = label.baseline;
      
      if (tickLength > 0) {
        ctx.beginPath();
        ctx.moveTo(rectWidth, label.y);
        ctx.lineTo(rectWidth + tickLength, label.y);
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      const x = rectWidth + tickLength + labelOffset;
      const y = label.y;
      
      if (textShadow && textShadow !== 'none') {
        ctx.save();
        ctx.shadowColor = textShadow.split(' ')[0] || 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = parseInt(textShadow.split(' ')[1] || '1', 10);
        ctx.shadowOffsetX = parseInt(textShadow.split(' ')[2] || '1', 10);
        ctx.shadowOffsetY = parseInt(textShadow.split(' ')[3] || '1', 10);
      }
      
      if (enableTextStroke) {
        ctx.strokeStyle = textStrokeColor;
        ctx.lineWidth = textStrokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(label.text, x, y);
      }
      
      ctx.fillStyle = textColor;
      ctx.fillText(label.text, x, y);
      
      if (textShadow && textShadow !== 'none') {
        ctx.restore();
      }
    });
  }

  onRemove(map: L.Map): void {
    this._currentType = null;
    super.onRemove(map);
  }
}
import L from "leaflet";
import '../styles/LayerControl.css';

export class LayerControl extends L.Control {
  private _container: HTMLElement;
  private _layers: any;
  private _currentLayer: string;
  private _onLayerChange: (layerType: string) => void;
  private _onForecastChange: (value: number) => void;
  private _onForecastSlide: (value: number) => void;
  private _formatDateFn: (offset: number) => string;

  constructor(
    layers: any,
    options?: L.ControlOptions,
    callbacks?: {
      onLayerChange: (layerType: string) => void,
      onForecastChange: (value: number) => void,
      onForecastSlide: (value: number) => void,
      formatDateFn: (offset: number) => string
    }
  ) {
    // Force the position to be bottom center by using a custom position
    super({ position: 'bottomright' });
    this._layers = layers;
    this._currentLayer = 'temp';
    this._onLayerChange = callbacks?.onLayerChange || (() => { });
    this._onForecastChange = callbacks?.onForecastChange || (() => { });
    this._onForecastSlide = callbacks?.onForecastSlide || (() => { });
    this._formatDateFn = callbacks?.formatDateFn || (() => '');
  }

  onAdd(map: L.Map): HTMLElement {
    // Create main container
    this._container = L.DomUtil.create('div', 'unified-control-panel');

    // Prevent clicks/scrolls on the control from propagating to the map
    L.DomEvent.disableClickPropagation(this._container);
    L.DomEvent.disableScrollPropagation(this._container);

    // Create the control section
    const controlSection = L.DomUtil.create('div', 'control-section', this._container);

    // Add layer buttons
    const layerButtons = L.DomUtil.create('div', 'layer-buttons', controlSection);

    // Temp button
    const tempButton = L.DomUtil.create('button', 'control-button active', layerButtons);
    tempButton.setAttribute('data-layer', 'temp');
    tempButton.innerHTML = '<span class="button-label">Temperatur</span>';
    L.DomEvent.on(tempButton, 'click', this._handleLayerButtonClick, this);

    // Wind button
    const windButton = L.DomUtil.create('button', 'control-button', layerButtons);
    windButton.setAttribute('data-layer', 'wind');
    windButton.innerHTML = '<span class="button-label">Wind</span>';
    L.DomEvent.on(windButton, 'click', this._handleLayerButtonClick, this);

    // Radar button
    const radarButton = L.DomUtil.create('button', 'control-button radar-button', layerButtons);
    radarButton.setAttribute('data-layer', 'radar');
    radarButton.innerHTML = '<span class="live-indicator"></span><span class="button-label">Radar</span>';
    L.DomEvent.on(radarButton, 'click', this._handleLayerButtonClick, this);

    // Add forecast slider
    const forecastSlider = L.DomUtil.create('div', 'forecast-slider', controlSection);

    const timeDisplay = L.DomUtil.create('div', 'time-display', forecastSlider);
    const timeLabel = L.DomUtil.create('span', 'time-label', timeDisplay);
    timeLabel.id = 'forecast-hour';
    timeLabel.innerText = this._formatDateFn(0);

    const sliderInput = L.DomUtil.create('input', '', forecastSlider) as HTMLInputElement;
    sliderInput.type = 'range';
    sliderInput.id = 'forecast-slider';
    sliderInput.min = '0';
    sliderInput.max = '48';
    sliderInput.value = '0';
    sliderInput.step = '1';

    L.DomEvent.on(sliderInput, 'input', (e: Event) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      timeLabel.innerText = this._formatDateFn(value);
      this._onForecastSlide(value);
    });

    L.DomEvent.on(sliderInput, 'change', (e: Event) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      this._onForecastChange(value);
    });

    return this._container;
  }

  private _handleLayerButtonClick(e: Event): void {
    const target = e.currentTarget as HTMLButtonElement;
    const layerType = target.dataset.layer as string;

    // Update active state
    this._container.querySelectorAll('.control-button').forEach(btn =>
      btn.classList.remove('active')
    );
    target.classList.add('active');

    this._currentLayer = layerType;

    // Show/hide forecast slider based on layer type
    const forecastSlider = this._container.querySelector('.forecast-slider') as HTMLElement;
    if (layerType === 'temp' || layerType === 'wind') {
      forecastSlider.style.display = 'flex';
    } else {
      forecastSlider.style.display = 'none';
    }

    // Callback to parent
    this._onLayerChange(layerType);
  }

  updateForecastTime(offset: number): void {
    const timeLabel = this._container.querySelector('#forecast-hour') as HTMLElement;
    if (timeLabel) {
      timeLabel.innerText = this._formatDateFn(offset);
    }

    const sliderInput = this._container.querySelector('#forecast-slider') as HTMLInputElement;
    if (sliderInput) {
      sliderInput.value = offset.toString();
    }
  }

  /* Override the default position of the control to force center positioning */
  getPosition(): string {
    return 'bottomleft';
  }

  /* Override the default ControlPosition to force center styling */
  setPosition(position: L.ControlPosition): this {
    if (this._container) {
      this._container.style.position = 'absolute';
      this._container.style.bottom = '16px';
      this._container.style.left = '50%';
      this._container.style.transform = 'translateX(-50%)';
      this._container.style.zIndex = '1000';
      this._container.classList.remove('leaflet-right', 'leaflet-left', 'leaflet-top', 'leaflet-bottom');
    }
    return this;
  }
}
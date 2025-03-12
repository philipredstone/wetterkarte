import L from "leaflet";
import '../../styles/LayerControl.css';

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
    super(options || { position: 'bottomleft' });
    this._layers = layers;
    this._currentLayer = 'temp';
    this._onLayerChange = callbacks?.onLayerChange || (() => { });
    this._onForecastChange = callbacks?.onForecastChange || (() => { });
    this._onForecastSlide = callbacks?.onForecastSlide || (() => { });
    this._formatDateFn = callbacks?.formatDateFn || (() => '');
  }


  onAdd(map: L.Map): HTMLElement {
    
    // Create main container
    this._container = L.DomUtil.create('div', 'leaflet-control unified-control-panel');
    
    // Apply base panel styles with proper margins
    Object.assign(this._container.style, {
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      padding: '12px',
      width: '350px',
      margin: '0 0 20px 20px', // Add margin: bottom left
      zIndex: '800'
    });
    
    // Prevent clicks/scrolls on the control from propagating to the map
    L.DomEvent.disableClickPropagation(this._container);
    L.DomEvent.disableScrollPropagation(this._container);

    // Create the control section
    const controlSection = L.DomUtil.create('div', 'control-section', this._container);
    Object.assign(controlSection.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    });

    // Add layer buttons
    const layerButtons = L.DomUtil.create('div', 'layer-buttons', controlSection);
    Object.assign(layerButtons.style, {
      display: 'flex',
      gap: '8px',
      justifyContent: 'space-between'
    });

    // Temp button
    const tempButton = L.DomUtil.create('button', 'control-button', layerButtons);
    tempButton.setAttribute('data-layer', 'temp');
    tempButton.innerHTML = '<span class="button-label">Temperatur</span>';
    this._applyButtonStyles(tempButton);
    // Apply active styles to temp button initially
    this._applyActiveButtonStyles(tempButton);
    L.DomEvent.on(tempButton, 'click', this._handleLayerButtonClick, this);

    // Wind button
    const windButton = L.DomUtil.create('button', 'control-button', layerButtons);
    windButton.setAttribute('data-layer', 'wind');
    windButton.innerHTML = '<span class="button-label">Wind</span>';
    this._applyButtonStyles(windButton);
    L.DomEvent.on(windButton, 'click', this._handleLayerButtonClick, this);

    // Radar button
    const radarButton = L.DomUtil.create('button', 'control-button radar-button', layerButtons);
    radarButton.setAttribute('data-layer', 'radar');
    
    // Apply radar button styles
    this._applyButtonStyles(radarButton);
    Object.assign(radarButton.style, {
      position: 'relative'
    });
    
    const liveIndicator = document.createElement('span');
    liveIndicator.className = 'live-indicator';
    liveIndicator.id = 'live-indicator';
    Object.assign(liveIndicator.style, {
      position: 'absolute',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: 'red',
      top: '6px',
      left: '6px'
    });
    
    radarButton.appendChild(liveIndicator);
    radarButton.innerHTML += '<span class="button-label">Radar</span>';
    L.DomEvent.on(radarButton, 'click', this._handleLayerButtonClick, this);

    // Add forecast slider
    const forecastSlider = L.DomUtil.create('div', 'forecast-slider', controlSection);
    Object.assign(forecastSlider.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });

    const timeDisplay = L.DomUtil.create('div', 'time-display', forecastSlider);
    Object.assign(timeDisplay.style, {
      background: '#f5f5f5',
      padding: '6px 12px',
      borderRadius: '6px',
      textAlign: 'center'
    });
    
    const timeLabel = L.DomUtil.create('span', 'time-label', timeDisplay);
    timeLabel.id = 'forecast-hour';
    Object.assign(timeLabel.style, {
      fontSize: '14px',
      fontWeight: '500',
      color: '#333'
    });
    timeLabel.innerText = this._formatDateFn(0);

    const sliderInput = L.DomUtil.create('input', '', forecastSlider) as HTMLInputElement;
    sliderInput.type = 'range';
    sliderInput.id = 'forecast-slider';
    sliderInput.min = '0';
    sliderInput.max = '48';
    sliderInput.value = '0';
    sliderInput.step = '1';
    
    // Apply slider styles
    Object.assign(sliderInput.style, {
      width: '100%',
      margin: '15px 0',
      height: '6px',
      WebkitAppearance: 'none',
      appearance: 'none',
      background: '#f5f5f5',
      borderRadius: '3px',
      cursor: 'pointer'
    });

    L.DomEvent.on(sliderInput, 'input', (e: Event) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      timeLabel.innerText = this._formatDateFn(value);
      this._onForecastSlide(value);
    });

    L.DomEvent.on(sliderInput, 'change', (e: Event) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      this._onForecastChange(value);
    });

    // Apply responsive styles
    this._applyMediaQueryStyles();

    return this._container;
  }
  
  private _applyButtonStyles(button: HTMLElement): void {
    Object.assign(button.style, {
      flex: '1',
      border: 'none',
      background: '#f5f5f5',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: '500',
      color: '#333',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      minHeight: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });
    
    // Add hover effect
    button.addEventListener('mouseenter', () => {
      if (!button.classList.contains('active')) {
        button.style.background = '#eaeaea';
      }
    });
    
    button.addEventListener('mouseleave', () => {
      if (!button.classList.contains('active')) {
        button.style.background = '#f5f5f5';
      }
    });
  }
  
  private _applyActiveButtonStyles(button: HTMLElement): void {
    button.classList.add('active');
    Object.assign(button.style, {
      background: '#115597',
      color: 'white'
    });
  }
  
  private _removeActiveButtonStyles(button: HTMLElement): void {
    button.classList.remove('active');
    Object.assign(button.style, {
      background: '#f5f5f5',
      color: '#333'
    });
  }
  
  private _applyMediaQueryStyles(): void {
    // Apply mobile styles if needed
    const applyMobileStyles = () => {
      if (window.innerWidth <= 480) {
        Object.assign(this._container.style, {
          padding: '8px',
          width: '95vw',
          margin: '0 0 10px 10px' // Smaller margins on mobile
        });
        
        // Apply mobile styles to buttons
        this._container.querySelectorAll('.control-button').forEach(btn => {
          Object.assign((btn as HTMLElement).style, {
            padding: '6px 8px',
            fontSize: '12px',
            minHeight: '32px'
          });
        });
        
        // Apply mobile styles to live indicator
        const liveIndicator = this._container.querySelector('.live-indicator');
        if (liveIndicator) {
          Object.assign((liveIndicator as HTMLElement).style, {
            width: '6px',
            height: '6px',
            top: '4px',
            left: '4px'
          });
        }
      } else {
        // Reset to desktop styles
        Object.assign(this._container.style, {
          padding: '12px',
          width: '350px',
          margin: '0 0 20px 20px' // Restore desktop margins
        });
      }
    };
    
    // Apply styles immediately
    applyMobileStyles();
    
    // Listen for window resize events
    window.addEventListener('resize', applyMobileStyles);
  }

  private _handleLayerButtonClick(e: Event): void {
    const target = e.currentTarget as HTMLButtonElement;
    const layerType = target.dataset.layer as string;

    // Update active state
    this._container.querySelectorAll('.control-button').forEach(btn => {
      this._removeActiveButtonStyles(btn as HTMLElement);
    });
    
    this._applyActiveButtonStyles(target);

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
  
  onRemove() {
    // Clean up any event listeners or resources when the control is removed
    window.removeEventListener('resize', () => {});
  }
}
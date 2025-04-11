interface TimeBarData {
  date: Date;
  value: number;
}

interface TimeBarChartOptions {
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  barColor?: string;
  labelColor?: string;
  xTickCount?: number;
  yTickCount?: number;
  valueLabel?: string;
  valueUnit?: string;
  showCurrentTimeLine?: boolean;
  showCurrentTimeDot?: boolean; // Option to show current time dot instead of line
  currentTimeColor?: string; // Color for current time indicator
  currentTimeDotSize?: number; // Size of the current time dot
  showTimeInTooltip?: boolean;
  highlightTime?: Date;
  highlightLabel?: string;
  highlightSubLabel?: string;
  highlightIcon?: string; // 'sun' | 'cloud' | 'wind' etc.
}

export default class TimeBarChart {
  private container: HTMLElement;
  private data: TimeBarData[];
  private options: Required<TimeBarChartOptions>;
  private svg: SVGSVGElement;
  private tooltip: HTMLDivElement;
  private highlightTooltip: HTMLDivElement;
  private touchActive: boolean;
  private lastTouchX: number | null;
  private isMobile: boolean;

  constructor(container: HTMLElement, data: TimeBarData[], options?: TimeBarChartOptions) {
    this.container = container;
    if (getComputedStyle(this.container).position === "static") {
      this.container.style.position = "relative";
    }

    // Sort data by date.
    this.data = data.slice().sort((a, b) => a.date.getTime() - b.date.getTime());

    // Initialize touch tracking variables
    this.touchActive = false;
    this.lastTouchX = null;
    
    // Check if we're on a mobile device
    this.isMobile = window.matchMedia("(max-width: 768px)").matches;

    // Increase top margin to make room for tooltips
    // Increase left margin to ensure y-axis labels aren't cut off
    const defaultMargin = { top: 60, right: 20, bottom: 40, left: 60 };
    const userMargin = options?.margin ?? {};
    
    this.options = {
      width: options?.width ?? 600, // default width (will be updated to container width)
      height: options?.height ?? 400,
      margin: {
        top: userMargin.top ?? defaultMargin.top,
        right: userMargin.right ?? defaultMargin.right,
        bottom: userMargin.bottom ?? defaultMargin.bottom,
        left: userMargin.left ?? defaultMargin.left,
      },
      barColor: options?.barColor ?? "#FFD700", // Default to yellow like the line chart
      labelColor: options?.labelColor ?? "#888888", // Light gray for labels
      xTickCount: options?.xTickCount ?? 3,
      yTickCount: options?.yTickCount ?? 5,
      valueLabel: options?.valueLabel ?? "",
      valueUnit: options?.valueUnit ?? "",
      showCurrentTimeLine: options?.showCurrentTimeLine ?? true,
      showCurrentTimeDot: options?.showCurrentTimeDot ?? false, // Dot is disabled by default
      currentTimeColor: options?.currentTimeColor ?? "red", // Default to red
      currentTimeDotSize: options?.currentTimeDotSize ?? 6, // Default dot size
      showTimeInTooltip: options?.showTimeInTooltip ?? true,
      highlightTime: options?.highlightTime ?? null,
      highlightLabel: options?.highlightLabel ?? "",
      highlightSubLabel: options?.highlightSubLabel ?? "",
      highlightIcon: options?.highlightIcon ?? "",
    };

    this.svg = this.createSVG();
    this.tooltip = this.createTooltip();
    this.highlightTooltip = this.createHighlightTooltip();

    // Re-render the chart on window resize for responsiveness.
    window.addEventListener("resize", this.debounce(this.handleResize.bind(this), 250));
    
    // Update mobile status on resize
    window.matchMedia("(max-width: 768px)").addEventListener("change", (e) => {
      this.isMobile = e.matches;
      this.render();
    });
    
    // Initial render
    this.render();
  }

  // Add debounce utility method for resize handling
  private debounce(func: Function, wait: number): Function {
    let timeout: number | null = null;
    return (...args: any[]) => {
      const later = () => {
        timeout = null;
        func(...args);
      };
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = window.setTimeout(later, wait);
    };
  }

  private handleResize(): void {
    // Update mobile status
    this.isMobile = window.matchMedia("(max-width: 768px)").matches;
    this.render();
  }

  private createSVG(): SVGSVGElement {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");

    // Set width to 100% so it fills the container and use viewBox for scaling.
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", this.options.height.toString());
    svg.setAttribute("viewBox", `0 0 ${this.options.width} ${this.options.height}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    this.container.appendChild(svg);
    return svg;
  }

  private createTooltip(): HTMLDivElement {
    const tooltip = document.createElement("div");
    tooltip.style.position = "absolute";
    tooltip.style.pointerEvents = "none";
    tooltip.style.background = "#222222";
    tooltip.style.color = "#fff";
    tooltip.style.padding = "8px 12px";
    tooltip.style.borderRadius = "16px";
    tooltip.style.fontSize = "14px";
    tooltip.style.display = "none";
    tooltip.style.zIndex = "11";
    tooltip.style.transform = "translate(-50%, 0)";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.textAlign = "center";
    tooltip.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.2)";
    tooltip.style.transition = "opacity 0.2s ease-in-out"; // Add smooth transition
    this.container.appendChild(tooltip);
    return tooltip;
  }

  private createHighlightTooltip(): HTMLDivElement {
    const tooltip = document.createElement("div");
    tooltip.style.position = "absolute";
    tooltip.style.pointerEvents = "none";
    tooltip.style.background = "#222222";
    tooltip.style.color = "#fff";
    tooltip.style.padding = "8px 12px";
    tooltip.style.borderRadius = "16px";
    tooltip.style.fontSize = "14px";
    tooltip.style.display = "none";
    tooltip.style.zIndex = "10";
    tooltip.style.transform = "translate(-50%, 0)";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.textAlign = "center";
    tooltip.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.2)";
    this.container.appendChild(tooltip);
    return tooltip;
  }

  private updateTooltipPosition(x: number, pointY: number): void {
    // Position tooltip above the chart area
    const fixedTooltipY = -20; // Negative value puts it above the chart margin
    
    // Get container width to check boundaries
    const containerWidth = this.container.clientWidth;
    
    // Get tooltip width to calculate potential overflow
    const tooltipWidth = this.tooltip.offsetWidth;
    
    // Calculate left position, ensuring tooltip stays within container
    let leftPos = x;
    
    // Check left boundary
    if (leftPos - (tooltipWidth / 2) < 0) {
      // If would clip left side, adjust to keep it visible with some padding
      leftPos = tooltipWidth / 2 + 10;
    }
    
    // Check right boundary
    if (leftPos + (tooltipWidth / 2) > containerWidth) {
      // If would clip right side, adjust to keep it visible with some padding
      leftPos = containerWidth - tooltipWidth / 2 - 10;
    }
    
    this.tooltip.style.left = `${leftPos}px`;
    this.tooltip.style.top = `${fixedTooltipY}px`;
  }

  private updateHighlightTooltipPosition(x: number, pointY: number): void {
    // Position tooltip above the chart area
    const fixedTooltipY = -20; // Negative value puts it above the chart margin
    
    // Get container width to check boundaries
    const containerWidth = this.container.clientWidth;
    
    // Get tooltip width to calculate potential overflow
    const tooltipWidth = this.highlightTooltip.offsetWidth;
    
    // Calculate left position, ensuring tooltip stays within container
    let leftPos = x;
    
    // Check left boundary
    if (leftPos - (tooltipWidth / 2) < 0) {
      // If would clip left side, adjust to keep it visible with some padding
      leftPos = tooltipWidth / 2 + 10;
    }
    
    // Check right boundary
    if (leftPos + (tooltipWidth / 2) > containerWidth) {
      // If would clip right side, adjust to keep it visible with some padding
      leftPos = containerWidth - tooltipWidth / 2 - 10;
    }
    
    this.highlightTooltip.style.left = `${leftPos}px`;
    this.highlightTooltip.style.top = `${fixedTooltipY}px`;
  }

  private hideTooltip(tooltipConnector?: SVGLineElement, hoverPoint?: SVGCircleElement): void {
    // Fade out tooltip
    this.tooltip.style.opacity = "0";
    setTimeout(() => {
      if (this.tooltip.style.opacity === "0") {
        this.tooltip.style.display = "none";
      }
    }, 200);
    
    if (tooltipConnector) {
      tooltipConnector.setAttribute("display", "none");
    }
    if (hoverPoint) {
      hoverPoint.setAttribute("display", "none");
    }
  }

  public render(): void {
    // Update chart width based on the container's current width.
    const containerWidth = this.container.clientWidth || this.options.width;
    this.options.width = containerWidth;
    
    // Adjust height for mobile if needed (shorter on mobile)
    if (this.isMobile && this.options.height > 250) {
      this.options.height = 250;
    }
    
    this.svg.setAttribute("viewBox", `0 0 ${this.options.width} ${this.options.height}`);

    // Clear previous contents.
    while (this.svg.firstChild) {
      this.svg.removeChild(this.svg.firstChild);
    }

    const { width, height, margin, barColor } = this.options;
    
    // Adjust margins for mobile - increased left margin to prevent clipping
    if (this.isMobile) {
      margin.left = Math.max(45, margin.left); // Ensure sufficient space for y-axis labels
      margin.right = Math.max(10, margin.right * 0.7);
    }
    
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    if (this.data.length === 0) return;

    const minDate = this.data[0].date;
    const maxDate = this.data[this.data.length - 1].date;
    const minTime = minDate.getTime();
    const maxTime = maxDate.getTime();
    const timeRange = Math.max(1, maxTime - minTime);

    // Add padding to time range to prevent bars from touching edges
    const timePaddingRatio = 0.05;
    const paddedMinTime = minTime - (timeRange * timePaddingRatio);
    const paddedMaxTime = maxTime + (timeRange * timePaddingRatio);
    const paddedTimeRange = paddedMaxTime - paddedMinTime;

    // Find the max value from the data
    const dataMaxValue = Math.max(...this.data.map((d) => d.value), 0);
    
    // Choose appropriate step size based on data range
    let stepSize: number;
    if (dataMaxValue <= 10) {
      stepSize = 2;
    } else if (dataMaxValue <= 50) {
      stepSize = 5;
    } else {
      stepSize = 10;
    }
    
    // Round max value up to a multiple of the step size
    // This ensures we get nice even intervals
    const maxValue = Math.ceil(dataMaxValue / stepSize) * stepSize;

    const svgNS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("transform", `translate(${margin.left}, ${margin.top})`);
    this.svg.appendChild(g);
    
    // Draw horizontal grid lines first (behind everything)
    this.drawHorizontalGridLines(g, chartWidth, chartHeight, maxValue);

    // Group data points by timestamp to handle duplicates
    const timeGroups = new Map<number, TimeBarData[]>();
    this.data.forEach(d => {
      const time = d.date.getTime();
      if (!timeGroups.has(time)) {
        timeGroups.set(time, []);
      }
      timeGroups.get(time)!.push(d);
    });

    // Calculate base bar width - reduce bar width on mobile
    const distinctTimePoints = timeGroups.size;
    const baseBarWidth = (chartWidth / Math.max(distinctTimePoints * 2, 1)) * (this.isMobile ? 0.7 : 0.8);
    
    // Create group for hover elements (tooltip connector) - placed LAST to be on top
    const hoverGroup = document.createElementNS(svgNS, "g");
    hoverGroup.setAttribute("class", "hover-elements");
    
    // Create elements for hover tooltip connector
    const tooltipConnector = document.createElementNS(svgNS, "line");
    tooltipConnector.setAttribute("stroke", "#555555");
    tooltipConnector.setAttribute("stroke-width", "3");
    tooltipConnector.setAttribute("display", "none");
    hoverGroup.appendChild(tooltipConnector);

    const hoverPoint = document.createElementNS(svgNS, "circle");
    hoverPoint.setAttribute("r", this.isMobile ? "4" : "5"); // Smaller point on mobile
    hoverPoint.setAttribute("fill", "white");
    hoverPoint.setAttribute("stroke", "#555555");
    hoverPoint.setAttribute("stroke-width", "3");
    hoverPoint.setAttribute("display", "none");
    hoverGroup.appendChild(hoverPoint);

    // Draw bars with adjusted positions for same-timestamp bars
    timeGroups.forEach((group, timestamp) => {
      // Use padded time range for positioning
      const xRatio = (timestamp - paddedMinTime) / paddedTimeRange;
      const baseX = xRatio * chartWidth;

      // Calculate offset for bars in the same timestamp group
      const totalGroupWidth = baseBarWidth * group.length;
      const startX = baseX - totalGroupWidth / 2;

      group.forEach((d, groupIndex) => {
        const x = startX + (groupIndex * baseBarWidth);
        const barHeight = maxValue > 0 ? (d.value / maxValue) * chartHeight : 0;
        const y = chartHeight - barHeight;
        
        // Define corner radius - 5px or half the bar width (whichever is smaller)
        const cornerRadius = Math.min(5, baseBarWidth / 2);

        // Create path for rounded rectangle instead of using a rect element
        const path = document.createElementNS(svgNS, "path");
        // Path for rounded rectangle with top corners rounded
        const pathData = `
          M ${x},${chartHeight}
          L ${x},${y + cornerRadius}
          Q ${x},${y} ${x + cornerRadius},${y}
          L ${x + baseBarWidth - cornerRadius},${y}
          Q ${x + baseBarWidth},${y} ${x + baseBarWidth},${y + cornerRadius}
          L ${x + baseBarWidth},${chartHeight}
          Z
        `;
        
        path.setAttribute("d", pathData);
        path.setAttribute("fill", barColor);
        path.style.cursor = "pointer";

        // Create invisible wider hover area
        const hoverArea = document.createElementNS(svgNS, "rect");
        // Make hover area wider on mobile for easier tapping
        const hoverPadding = this.isMobile ? 
          Math.max(8, baseBarWidth * 0.5) : 
          Math.max(4, baseBarWidth * 0.4);
          
        hoverArea.setAttribute("x", (x - hoverPadding).toString());
        hoverArea.setAttribute("y", "0");
        hoverArea.setAttribute("width", (baseBarWidth + 2 * hoverPadding).toString());
        hoverArea.setAttribute("height", chartHeight.toString());
        hoverArea.setAttribute("fill", "transparent");
        hoverArea.style.cursor = "pointer";
        
        const barCenterX = x + (baseBarWidth / 2);
        const barTopY = y;

        // Add hover events to the hover area for desktop
        const handlePointerOver = () => {
          // Show tooltip
          this.tooltip.innerHTML = `<strong>${this.formatDateTime(d.date)}</strong><br/>` +
            `${this.options.valueLabel} ${d.value} ${this.options.valueUnit}`;
          this.tooltip.style.display = "block";
          this.tooltip.style.opacity = "1";
          
          // Position tooltip
          const containerRect = this.container.getBoundingClientRect();
          const tooltipX = containerRect.left + margin.left + barCenterX;
          this.updateTooltipPosition(tooltipX - containerRect.left, barTopY);
          
          // Update tooltip connector
          tooltipConnector.setAttribute("x1", barCenterX.toString());
          tooltipConnector.setAttribute("y1", "-20"); // Extend above chart area to reach tooltip
          tooltipConnector.setAttribute("x2", barCenterX.toString());
          tooltipConnector.setAttribute("y2", barTopY.toString());
          tooltipConnector.setAttribute("display", "block");
          
          // Update hover point
          hoverPoint.setAttribute("cx", barCenterX.toString());
          hoverPoint.setAttribute("cy", barTopY.toString());
          hoverPoint.setAttribute("display", "block");
        };

        hoverArea.addEventListener("mouseover", handlePointerOver);
        
        hoverArea.addEventListener("mouseout", () => {
          this.hideTooltip(tooltipConnector, hoverPoint);
        });

        // Add touch events for mobile
        hoverArea.addEventListener("touchstart", (event) => {
          this.touchActive = true;
          this.lastTouchX = event.touches[0].clientX;
          handlePointerOver();
          event.preventDefault(); // Prevent scrolling while touching the chart
        });
        
        hoverArea.addEventListener("touchend", () => {
          // Keep tooltip visible for a moment after touch ends
          setTimeout(() => {
            if (!this.touchActive) {
              this.hideTooltip(tooltipConnector, hoverPoint);
            }
          }, 1500);
          this.touchActive = false;
        });

        g.appendChild(path);
        g.appendChild(hoverArea);
      });
    });

    // Draw the highlight bar if specified
    if (this.options.highlightTime) {
      this.drawHighlight(g, chartWidth, chartHeight, paddedMinTime, paddedMaxTime, paddedTimeRange, maxValue, baseBarWidth);
    }
    
    // Add hover group after drawing bars
    g.appendChild(hoverGroup);

    // Draw time labels
    this.drawTimeAxis(g, chartWidth, chartHeight, paddedMinTime, paddedMaxTime);
    
    // Draw Y axis labels
    this.drawYAxis(g, chartWidth, chartHeight, maxValue);

    // Draw current time indicator (line or dot based on options)
    this.drawCurrentTimeIndicator(g, chartWidth, chartHeight, paddedMinTime, paddedMaxTime);
  }

  private drawHighlight(
    g: SVGGElement,
    chartWidth: number,
    chartHeight: number,
    minTime: number,
    maxTime: number,
    timeRange: number,
    maxValue: number,
    baseBarWidth: number
  ): void {
    const svgNS = "http://www.w3.org/2000/svg";
    
    // Calculate position of highlight
    const highlightTime = this.options.highlightTime.getTime();
    
    // Skip if outside chart range
    if (highlightTime < minTime || highlightTime > maxTime) return;
    
    const xRatio = (highlightTime - minTime) / timeRange;
    const x = xRatio * chartWidth;
    
    // Find the y-value from data points
    let highlightValue = 0;
    let closestTimeDiff = Infinity;
    
    for (const dataPoint of this.data) {
      const timeDiff = Math.abs(dataPoint.date.getTime() - highlightTime);
      if (timeDiff < closestTimeDiff) {
        closestTimeDiff = timeDiff;
        highlightValue = dataPoint.value;
      }
    }
    
    const barHeight = maxValue > 0 ? (highlightValue / maxValue) * chartHeight : 0;
    const y = chartHeight - barHeight;
    
    // Draw connector line from above chart area to the bar top
    const connectorLine = document.createElementNS(svgNS, "line");
    connectorLine.setAttribute("x1", x.toString());
    connectorLine.setAttribute("y1", "-20"); // Extend above chart area to reach tooltip
    connectorLine.setAttribute("x2", x.toString());
    connectorLine.setAttribute("y2", y.toString());
    connectorLine.setAttribute("stroke", "#555555");
    connectorLine.setAttribute("stroke-width", "1");
    g.appendChild(connectorLine);
    
    // Draw highlight point at top of bar
    const point = document.createElementNS(svgNS, "circle");
    point.setAttribute("cx", x.toString());
    point.setAttribute("cy", y.toString());
    point.setAttribute("r", this.isMobile ? "4" : "5"); // Smaller on mobile
    point.setAttribute("fill", "white");
    point.setAttribute("stroke", "#555555");
    point.setAttribute("stroke-width", "1");
    g.appendChild(point);
    
    // Display highlight tooltip
    if (this.options.highlightLabel) {
      // Create tooltip with icon if specified
      let tooltipContent = '';
      
      if (this.options.highlightIcon === 'sun') {
        tooltipContent += '<span style="color: #FFD700; margin-right: 5px;">☀</span>';
      } else if (this.options.highlightIcon === 'cloud') {
        tooltipContent += '<span style="color: #CCCCCC; margin-right: 5px;">☁</span>';
      } else if (this.options.highlightIcon === 'wind') {
        tooltipContent += '<span style="margin-right: 5px;">↗</span>';
      }
      
      tooltipContent += `<strong>${this.options.highlightLabel}</strong>` + 
        (this.options.highlightSubLabel ? `<br/>${this.options.highlightSubLabel}` : '');
      
      this.highlightTooltip.innerHTML = tooltipContent;
      this.highlightTooltip.style.display = "block";
      
      const containerRect = this.container.getBoundingClientRect();
      const tooltipX = containerRect.left + this.options.margin.left + x;
      this.updateHighlightTooltipPosition(tooltipX - containerRect.left, y);
    }
  }

  private formatDateTime(date: Date): string {
    if (this.options.showTimeInTooltip) {
      const day = date.getDate();
      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${day}. ${monthNames[date.getMonth()]}, ${hours}:${minutes}`;
    } else {
      // Show only the date without time
      const day = date.getDate();
      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      return `${day}. ${monthNames[date.getMonth()]}`;
    }
  }
  
  private formatHour(date: Date): string {
    return `${date.getHours()} Uhr`;
  }

  private drawHorizontalGridLines(
    g: SVGGElement,
    chartWidth: number,
    chartHeight: number,
    maxValue: number
  ): void {
    const svgNS = "http://www.w3.org/2000/svg";
    
    // Calculate appropriate step size for the y-axis
    const minValue = 0; // Bar charts typically start at 0
    const range = maxValue - minValue;
    
    // Choose appropriate step size based on data range
    let stepSize: number;
    if (maxValue <= 10) {
      stepSize = 2;
    } else if (maxValue <= 50) {
      stepSize = 5;
    } else {
      stepSize = 10;
    }
    
    // Generate ticks array with consistently spaced values
    const ticks: number[] = [];
    
    // Start at 0 (or minValue if it's not 0)
    for (let tick = minValue; tick <= maxValue + (stepSize * 0.001); tick += stepSize) {
      ticks.push(tick);
    }
    
    // Draw grid lines and labels for each tick
    ticks.forEach(value => {
      const ratio = value / maxValue;
      const y = chartHeight - (ratio * chartHeight);
      
      // Draw the grid line
      const gridLine = document.createElementNS(svgNS, "line");
      gridLine.setAttribute("x1", "0");
      gridLine.setAttribute("y1", y.toString());
      gridLine.setAttribute("x2", chartWidth.toString());
      gridLine.setAttribute("y2", y.toString());
      gridLine.setAttribute("stroke", "#EEEEEE");
      gridLine.setAttribute("stroke-width", "1");
      g.appendChild(gridLine);
      
      // Add y-axis label
      const label = document.createElementNS(svgNS, "text");
      
      // Position text farther to the left on mobile to prevent clipping
      const textOffset = this.isMobile ? "-25" : "-15";
      label.setAttribute("x", textOffset);
      
      label.setAttribute("y", y.toString());
      label.setAttribute("text-anchor", "end");
      label.setAttribute("alignment-baseline", "middle");
      label.setAttribute("fill", this.options.labelColor);
      label.setAttribute("font-size", this.isMobile ? "11px" : "12px");
      
      // Format the value nicely - remove decimal points entirely
      let formattedValue = Math.round(value).toString();
      
      // Add the unit if specified
      let labelText = formattedValue;
      if (this.options.valueUnit) {
        labelText += ` ${this.options.valueUnit}`;
      }
      
      label.textContent = labelText;
      g.appendChild(label);
    });
  }

  private drawTimeAxis(
    g: SVGGElement,
    chartWidth: number,
    chartHeight: number,
    minTime: number,
    maxTime: number
  ): void {
    const svgNS = "http://www.w3.org/2000/svg";
    const fontSize = this.isMobile ? "11px" : "12px";
    
    // Calculate time span
    const timeSpanMs = maxTime - minTime;
    const timeSpanHours = timeSpanMs / (1000 * 60 * 60);
    const isMultiDay = timeSpanHours > 24;
    
    // Calculate number of labels based on chart width
    const maxLabels = Math.floor(chartWidth / 100); // At least 100px between labels
    const numLabels = Math.max(Math.min(maxLabels, 6), 2); // Between 2 and 6 labels
    
    // Generate evenly spaced labels
    const labels = [];
    for (let i = 0; i < numLabels; i++) {
      const position = i / (numLabels - 1); // 0 to 1
      const timestamp = minTime + position * timeSpanMs;
      labels.push(timestamp);
    }
    
    // Format labels based on timespan
    labels.forEach(timestamp => {
      const date = new Date(timestamp);
      const xPos = ((timestamp - minTime) / timeSpanMs) * chartWidth;
      
      let formattedTime;
      if (isMultiDay) {
        // For multi-day spans: just show date (D.M.)
        formattedTime = `${date.getDate()}.${date.getMonth() + 1}.`;
      } else {
        // For 24h or less: just show time (HH:MM)
        const hours = date.getHours();
        const minutes = date.getMinutes();
        
        // Only show minutes if not zero or if we have a very short timespan (< 6 hours)
        if (minutes === 0 && timeSpanHours >= 6) {
          formattedTime = `${hours}:00`;
        } else {
          formattedTime = `${hours}:${minutes.toString().padStart(2, '0')}`;
        }
      }
      
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", xPos.toString());
      text.setAttribute("y", (chartHeight + 20).toString());
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", this.options.labelColor);
      text.setAttribute("font-size", fontSize);
      text.textContent = formattedTime;
      g.appendChild(text);
    });
  }

  private formatShortDate(date: Date): string {
    const day = date.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day}. ${monthNames[date.getMonth()]}`;
  }

  private drawYAxis(
    g: SVGGElement,
    chartWidth: number,
    chartHeight: number,
    maxValue: number
  ): void {
    // No Y-axis implementation needed - moved to horizontal grid lines
    // The labels are drawn directly with the grid lines in drawHorizontalGridLines
  }

  private drawAxisLabels(g: SVGGElement, chartWidth: number, chartHeight: number): void {
    // No additional axis labels needed for this design
  }

  // New unified method to handle both time line and time dot
  private drawCurrentTimeIndicator(
    g: SVGGElement,
    chartWidth: number,
    chartHeight: number,
    minTime: number,
    maxTime: number
  ): void {
    const now = Date.now();
    
    // Only draw if the current time falls within the chart's time range
    if (now < minTime || now > maxTime) {
      return;
    }
    
    const nowRatio = (now - minTime) / (maxTime - minTime);
    const nowX = nowRatio * chartWidth;
    const svgNS = "http://www.w3.org/2000/svg";

    // If showCurrentTimeDot is enabled, draw a dot instead of a line
    if (this.options.showCurrentTimeDot) {
      const currentTimeDot = document.createElementNS(svgNS, "circle");
      currentTimeDot.setAttribute("cx", nowX.toString());
      
      // For bar chart, position the dot at the top of the chart
      currentTimeDot.setAttribute("cy", "0");
      
      // Use the configurable dot size, with a smaller size on mobile
      const dotSize = this.isMobile 
        ? Math.max(4, this.options.currentTimeDotSize * 0.8) // Scale down a bit on mobile
        : this.options.currentTimeDotSize;
      
      currentTimeDot.setAttribute("r", dotSize.toString());
      currentTimeDot.setAttribute("fill", this.options.currentTimeColor);
      
      // Add a white outline to make the dot stand out
      currentTimeDot.setAttribute("stroke", "white");
      currentTimeDot.setAttribute("stroke-width", "1");
      
      g.appendChild(currentTimeDot);
    } 
    // Otherwise, draw the line if showCurrentTimeLine is enabled
    else if (this.options.showCurrentTimeLine) {
      const nowLine = document.createElementNS(svgNS, "line");
      nowLine.setAttribute("x1", nowX.toString());
      nowLine.setAttribute("y1", "0");
      nowLine.setAttribute("x2", nowX.toString());
      nowLine.setAttribute("y2", chartHeight.toString());
      nowLine.setAttribute("stroke", this.options.currentTimeColor);
      nowLine.setAttribute("stroke-width", this.isMobile ? "1" : "2");
      nowLine.setAttribute("stroke-dasharray", "4,2");
      g.appendChild(nowLine);
    }
  }
}
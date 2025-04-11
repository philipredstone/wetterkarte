interface TimeLineData {
  date: Date;
  value: number;
}

interface TimeLineChartOptions {
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  lineColor?: string;
  pointColor?: string;
  areaFill?: string;
  labelColor?: string;
  xTickCount?: number;
  valueLabel?: string;
  valueUnit?: string;
  highlightTime?: Date;
  highlightLabel?: string;
  highlightSubLabel?: string;
  highlightIcon?: string; // 'sun' | 'cloud' | 'wind' etc.
  yAxisLabels?: { value: number; label: string }[];
  showCurrentTimeLine?: boolean; // Option to show current time line
  showCurrentTimeDot?: boolean; // Option to show current time dot instead of line
  currentTimeColor?: string; // Color for current time indicator
  currentTimeDotSize?: number; // Size of the current time dot
}

export default class TimeLineChart {
  private container: HTMLElement;
  private data: TimeLineData[];
  private options: Required<TimeLineChartOptions>;
  private svg: SVGSVGElement;
  private tooltip: HTMLDivElement;
  private highlightTooltip: HTMLDivElement;
  private touchActive: boolean;
  private lastTouchX: number | null;
  private isMobile: boolean;

  constructor(container: HTMLElement, data: TimeLineData[], options?: TimeLineChartOptions) {
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
      width: options?.width ?? 600,
      height: options?.height ?? 300,
      margin: {
        top: userMargin.top ?? defaultMargin.top,
        right: userMargin.right ?? defaultMargin.right,
        bottom: userMargin.bottom ?? defaultMargin.bottom,
        left: userMargin.left ?? defaultMargin.left,
      },
      lineColor: options?.lineColor ?? "#FFD700", // Default to yellow
      pointColor: options?.pointColor ?? "#FFD700",
      areaFill: options?.areaFill ?? "transparent", // No area fill by default
      labelColor: options?.labelColor ?? "#888888", // Light gray for labels
      xTickCount: options?.xTickCount ?? 3, // Default to 3 ticks (6, 12, 18)
      valueLabel: options?.valueLabel ?? "",
      valueUnit: options?.valueUnit ?? "",
      highlightTime: options?.highlightTime ?? null,
      highlightLabel: options?.highlightLabel ?? "",
      highlightSubLabel: options?.highlightSubLabel ?? "",
      highlightIcon: options?.highlightIcon ?? "",
      yAxisLabels: options?.yAxisLabels ?? [],
      showCurrentTimeLine: options?.showCurrentTimeLine ?? true, // Enable by default
      showCurrentTimeDot: options?.showCurrentTimeDot ?? false, // Dot is disabled by default
      currentTimeColor: options?.currentTimeColor ?? "red", // Default to red
      currentTimeDotSize: options?.currentTimeDotSize ?? 6, // Default dot size
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
    tooltip.style.background = "#222222"; // Darker background to match bar chart
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
    tooltip.style.background = "#222222"; // Darker background to match bar chart
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

  // Method to hide the tooltip
  private hideTooltip(tooltipConnector: SVGLineElement, hoverPoint: SVGCircleElement): void {
    // Fade out tooltip
    this.tooltip.style.opacity = "0";
    setTimeout(() => {
      if (this.tooltip.style.opacity === "0") {
        this.tooltip.style.display = "none";
      }
    }, 200);
    
    tooltipConnector.setAttribute("display", "none");
    hoverPoint.setAttribute("display", "none");
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

    const { width, height, margin, lineColor } = this.options;
    
    // Adjust margins for mobile
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

    // First determine if we need to use yAxisLabels values for scaling
    let useCustomScale = this.options.yAxisLabels.length > 0;
    
    // Find min and max values from the data
    const dataValues = this.data.map(d => d.value);
    const dataMinValue = Math.min(...dataValues);
    const dataMaxValue = Math.max(...dataValues);
    
    // Always use the actual min and max from the data
    // If min is positive, we can start from 0
    const minValue = Math.min(0, dataMinValue);
    
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
    this.drawHorizontalGridLines(g, chartWidth, chartHeight, minValue, maxValue, useCustomScale);

    // Draw the area under the line if enabled
    if (this.options.areaFill !== "transparent") {
      const areaPath = document.createElementNS(svgNS, "path");
      
      // Create array of coordinates for easier processing
      const points = this.data.map(d => ({
        x: this.getXCoordinate(d.date, minTime, timeRange, chartWidth),
        y: this.getYCoordinate(d.value, minValue, maxValue, chartHeight)
      }));
      
      let areaD = `M${points[0].x},${chartHeight}`;
      
      // Generate top path as a cardinal spline (smooth curve)
      areaD += ' ' + this.getCardinalPath(points, 0.5).substring(1); // Remove initial M command
      
      // Close the path
      areaD += ` L${points[points.length-1].x},${chartHeight} Z`;
      
      areaPath.setAttribute("d", areaD);
      areaPath.setAttribute("fill", this.options.areaFill);
      areaPath.setAttribute("stroke", "none");
      g.appendChild(areaPath);
    }

    // Draw the line
    if (this.data.length > 1) {
      const linePath = document.createElementNS(svgNS, "path");
      
      // Create array of coordinates for easier processing
      const points = this.data.map(d => ({
        x: this.getXCoordinate(d.date, minTime, timeRange, chartWidth),
        y: this.getYCoordinate(d.value, minValue, maxValue, chartHeight)
      }));
      
      // Generate path based on cardinal spline (smooth curve)
      const lineD = this.getCardinalPath(points, 0.5);
      
      linePath.setAttribute("d", lineD);
      linePath.setAttribute("fill", "none");
      linePath.setAttribute("stroke", lineColor);
      linePath.setAttribute("stroke-width", this.isMobile ? "1.5" : "2"); // Slightly thinner on mobile
      linePath.setAttribute("stroke-linecap", "round");
      linePath.setAttribute("stroke-linejoin", "round");
      g.appendChild(linePath);
    }

    // Draw time labels based on actual time range
    this.drawTimeAxis(g, chartWidth, chartHeight, minTime, maxTime);

    // Draw Y axis labels if provided
    if (useCustomScale) {
      this.drawCustomYAxisLabels(g, chartWidth, chartHeight, minValue, maxValue);
    }
    
    // Draw the highlight point and line if specified
    if (this.options.highlightTime) {
      this.drawHighlight(g, chartWidth, chartHeight, minTime, maxTime, timeRange, minValue, maxValue);
    }
    
    // Draw current time indicator (line or dot based on options)
    this.drawCurrentTimeIndicator(g, chartWidth, chartHeight, minTime, maxTime, minValue, maxValue);

    // Create a transparent overlay for hover effects
    const overlay = document.createElementNS(svgNS, "rect");
    overlay.setAttribute("x", "0");
    overlay.setAttribute("y", "0");
    overlay.setAttribute("width", chartWidth.toString());
    overlay.setAttribute("height", chartHeight.toString());
    overlay.setAttribute("fill", "transparent");
    overlay.style.cursor = "crosshair";
    
    // Create group for hover elements (tooltip connector line) - placed LAST to be on top
    const hoverGroup = document.createElementNS(svgNS, "g");
    hoverGroup.setAttribute("class", "hover-elements");
    g.appendChild(hoverGroup);
    
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
    
    // Add mouse events for desktop
    overlay.addEventListener("mousemove", (event) => {
      this.handlePointerMove(event, margin, chartWidth, chartHeight, minTime, maxTime, timeRange, minValue, maxValue, tooltipConnector, hoverPoint);
    });
    
    overlay.addEventListener("mouseout", () => {
      this.hideTooltip(tooltipConnector, hoverPoint);
    });
    
    // Add touch events for mobile
    overlay.addEventListener("touchstart", (event) => {
      this.touchActive = true;
      const touch = event.touches[0];
      this.lastTouchX = touch.clientX;
      this.handlePointerMove(touch, margin, chartWidth, chartHeight, minTime, maxTime, timeRange, minValue, maxValue, tooltipConnector, hoverPoint);
      event.preventDefault(); // Prevent scrolling while touching the chart
    });
    
    overlay.addEventListener("touchmove", (event) => {
      if (this.touchActive) {
        const touch = event.touches[0];
        this.lastTouchX = touch.clientX;
        this.handlePointerMove(touch, margin, chartWidth, chartHeight, minTime, maxTime, timeRange, minValue, maxValue, tooltipConnector, hoverPoint);
        event.preventDefault(); // Prevent scrolling while touching the chart
      }
    });
    
    overlay.addEventListener("touchend", () => {
      // Keep tooltip visible for a moment after touch ends for better UX
      setTimeout(() => {
        if (!this.touchActive) {
          this.hideTooltip(tooltipConnector, hoverPoint);
        }
      }, 1500);
      this.touchActive = false;
    });
    
    g.appendChild(overlay);
  }
  
  private handlePointerMove(
    event: MouseEvent | Touch,
    margin: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number, 
    minTime: number,
    maxTime: number,
    timeRange: number,
    minValue: number,
    maxValue: number,
    tooltipConnector: SVGLineElement,
    hoverPoint: SVGCircleElement
  ): void {
    const containerRect = this.container.getBoundingClientRect();
    const mouseX = event.clientX - containerRect.left - margin.left;
    const mouseY = event.clientY - containerRect.top - margin.top;
    
    // Find the nearest data point
    const nearestPoint = this.findNearestDataPoint(mouseX, mouseY, minTime, maxTime, timeRange, minValue, maxValue, chartWidth, chartHeight);
    
    if (nearestPoint) {
      // Format value with unit
      const formattedValue = this.options.valueUnit ? 
        `${nearestPoint.value} ${this.options.valueUnit}` : 
        `${nearestPoint.value}`;
        
      // Show tooltip with the same format as bar chart
      this.tooltip.innerHTML = `<strong>${this.formatHour(nearestPoint.date)}</strong><br/>` +
        `${this.options.valueLabel} ${formattedValue}`;
      this.tooltip.style.display = "block";
      this.tooltip.style.opacity = "1";
      
      // Position tooltip
      const tooltipX = containerRect.left + margin.left + nearestPoint.x;
      this.updateTooltipPosition(tooltipX - containerRect.left, nearestPoint.y);
      
      // Update tooltip connector line - extend it above the chart area to reach the tooltip
      tooltipConnector.setAttribute("x1", nearestPoint.x.toString());
      tooltipConnector.setAttribute("y1", "-20"); // Extend above chart area to reach tooltip
      tooltipConnector.setAttribute("x2", nearestPoint.x.toString());
      tooltipConnector.setAttribute("y2", nearestPoint.y.toString());
      tooltipConnector.setAttribute("display", "block");
      
      // Update hover point
      hoverPoint.setAttribute("cx", nearestPoint.x.toString());
      hoverPoint.setAttribute("cy", nearestPoint.y.toString());
      hoverPoint.setAttribute("display", "block");
    }
  }

  private getXCoordinate(date: Date, minTime: number, timeRange: number, chartWidth: number): number {
    const time = date.getTime();
    const xRatio = (time - minTime) / timeRange;
    return xRatio * chartWidth;
  }

  private getYCoordinate(value: number, minValue: number, maxValue: number, chartHeight: number): number {
    // Calculate the range from data min to data max
    const range = maxValue - minValue;
    
    // Calculate position as percentage of range and invert for SVG coordinates
    return chartHeight - ((value - minValue) / (range || 1)) * chartHeight;
  }
  
  private getCardinalPath(points: { x: number; y: number }[], tension: number = 0.5): string {
    if (points.length < 2) return "";
    
    let path = `M${points[0].x},${points[0].y}`;
    
    // Cardinal spline uses a tension parameter (0-1)
    // A value of 0 creates a straight line
    // A value of 1 creates a tight curve
    const cardinalTension = 1 - tension;
    
    for (let i = 0; i < points.length - 1; i++) {
      // Get current point and next point
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;
      
      // Calculate control points
      const d1 = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
      const d2 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const d3 = Math.sqrt(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2));
      
      const cp1x = p1.x + (cardinalTension * d2 * (p2.x - p0.x)) / (d1 + d2);
      const cp1y = p1.y + (cardinalTension * d2 * (p2.y - p0.y)) / (d1 + d2);
      const cp2x = p2.x - (cardinalTension * d2 * (p3.x - p1.x)) / (d2 + d3);
      const cp2y = p2.y - (cardinalTension * d2 * (p3.y - p1.y)) / (d2 + d3);
      
      path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    
    return path;
  }

  private formatHour(date: Date): string {
    return `${date.getHours()} Uhr`;
  }

  private findNearestDataPoint(
    mouseX: number, 
    mouseY: number, 
    minTime: number,
    maxTime: number,
    timeRange: number,
    minValue: number,
    maxValue: number,
    chartWidth: number,
    chartHeight: number
  ): { x: number; y: number; date: Date; value: number } | null {
    if (this.data.length === 0) return null;
    
    // First try to find the nearest point by x-coordinate (time)
    const mouseTimeRatio = mouseX / chartWidth;
    const mouseTime = minTime + mouseTimeRatio * timeRange;
    
    // Find closest point in time
    let closestIndex = 0;
    let minTimeDiff = Infinity;
    
    for (let i = 0; i < this.data.length; i++) {
      const timeDiff = Math.abs(this.data[i].date.getTime() - mouseTime);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestIndex = i;
      }
    }
    
    // Get the nearest point
    const nearestPoint = this.data[closestIndex];
    const x = this.getXCoordinate(nearestPoint.date, minTime, timeRange, chartWidth);
    const y = this.getYCoordinate(nearestPoint.value, minValue, maxValue, chartHeight);
    
    return {
      x,
      y,
      date: nearestPoint.date,
      value: nearestPoint.value
    };
  }

  private drawHorizontalGridLines(
    g: SVGGElement,
    chartWidth: number,
    chartHeight: number,
    minValue: number,
    maxValue: number,
    useCustomScale: boolean
  ): void {
    const svgNS = "http://www.w3.org/2000/svg";
    
    if (useCustomScale) {
      // When using custom scale, only draw grid lines without labels
      // Labels will be added by drawCustomYAxisLabels
      this.options.yAxisLabels.forEach(label => {
        const y = this.getYCoordinate(label.value, minValue, maxValue, chartHeight);
        
        // Draw grid line
        const gridLine = document.createElementNS(svgNS, "line");
        gridLine.setAttribute("x1", "0");
        gridLine.setAttribute("y1", y.toString());
        gridLine.setAttribute("x2", chartWidth.toString());
        gridLine.setAttribute("y2", y.toString());
        gridLine.setAttribute("stroke", "#EEEEEE");
        gridLine.setAttribute("stroke-width", "1");
        g.appendChild(gridLine);
      });
    } else {
      // Calculate appropriate step size for the y-axis with consistent intervals
      const range = maxValue - minValue;
      
      // Choose a step size that creates 4-6 nice, evenly spaced ticks
      let stepSize: number;
      if (range <= 10) {
        stepSize = 2; // For small ranges, use steps of 2
      } else if (range <= 25) {
        stepSize = 5; // For medium ranges, use steps of 5
      } else if (range <= 100) {
        stepSize = 10; // For larger ranges, use steps of 10
      } else {
        // For very large ranges, find an appropriate power of 10
        const magnitude = Math.pow(10, Math.floor(Math.log10(range / 5)));
        stepSize = magnitude;
      }
      
      // Generate ticks array with consistently spaced values
      const ticks: number[] = [];
      
      // Start at 0 (or minValue if it's not 0)
      for (let tick = minValue; tick <= maxValue + (stepSize * 0.001); tick += stepSize) {
        ticks.push(tick);
      }
      
      // Ensure max value is included if it's not already
      if (!ticks.includes(maxValue) && Math.abs(ticks[ticks.length - 1] - maxValue) > 0.01) {
        ticks.push(maxValue);
      }
      
      // Draw grid lines and labels for each tick
      ticks.forEach(value => {
        const y = this.getYCoordinate(value, minValue, maxValue, chartHeight);
        
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

  private drawCustomYAxisLabels(
    g: SVGGElement,
    chartWidth: number,
    chartHeight: number,
    minValue: number,
    maxValue: number
  ): void {
    const svgNS = "http://www.w3.org/2000/svg";
    const fontSize = this.isMobile ? "11px" : "12px";
    
    // For mobile, possibly reduce the number of labels if too many
    let labelsToShow = this.options.yAxisLabels;
    if (this.isMobile && this.options.yAxisLabels.length > 3) {
      // Take first, middle and last label
      const middleIndex = Math.floor(this.options.yAxisLabels.length / 2);
      labelsToShow = [
        this.options.yAxisLabels[0],
        this.options.yAxisLabels[middleIndex],
        this.options.yAxisLabels[this.options.yAxisLabels.length - 1]
      ];
    }
    
    // Draw custom y-axis labels
    labelsToShow.forEach(label => {
      const y = this.getYCoordinate(label.value, minValue, maxValue, chartHeight);
      
      const text = document.createElementNS(svgNS, "text");
      
      // Position text farther to the left on mobile to prevent clipping
      const textOffset = this.isMobile ? "-25" : "-15";
      text.setAttribute("x", textOffset);
      
      text.setAttribute("y", y.toString());
      text.setAttribute("text-anchor", "end");
      text.setAttribute("alignment-baseline", "middle");
      text.setAttribute("fill", this.options.labelColor);
      text.setAttribute("font-size", fontSize);
      text.textContent = label.label;
      g.appendChild(text);
    });
  }

  private drawHighlight(
    g: SVGGElement,
    chartWidth: number,
    chartHeight: number,
    minTime: number,
    maxTime: number,
    timeRange: number,
    minValue: number,
    maxValue: number
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
    
    const y = this.getYCoordinate(highlightValue, minValue, maxValue, chartHeight);
    
    // Draw connector line from above chart area to the data point
    const connectorLine = document.createElementNS(svgNS, "line");
    connectorLine.setAttribute("x1", x.toString());
    connectorLine.setAttribute("y1", "-20"); // Extend above chart area to reach tooltip
    connectorLine.setAttribute("x2", x.toString());
    connectorLine.setAttribute("y2", y.toString());
    connectorLine.setAttribute("stroke", "#333333"); // Darker to match bar chart
    connectorLine.setAttribute("stroke-width", "1");
    g.appendChild(connectorLine);
    
    // Draw highlight point
    const point = document.createElementNS(svgNS, "circle");
    point.setAttribute("cx", x.toString());
    point.setAttribute("cy", y.toString());
    point.setAttribute("r", this.isMobile ? "4" : "5"); // Smaller on mobile
    point.setAttribute("fill", "white");
    point.setAttribute("stroke", "#333333"); // Darker to match bar chart
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

  // New method to handle both current time line and dot
  private drawCurrentTimeIndicator(
    g: SVGGElement,
    chartWidth: number,
    chartHeight: number,
    minTime: number,
    maxTime: number,
    minValue: number,
    maxValue: number
  ): void {
    const now = Date.now();
    
    // Only draw if the current time falls within the chart's time range
    if (now < minTime || now > maxTime) {
      return;
    }
    
    const nowRatio = (now - minTime) / (maxTime - minTime);
    const nowX = nowRatio * chartWidth;
    const svgNS = "http://www.w3.org/2000/svg";

    // Find the closest data point to current time to determine Y position for the dot
    let closestTimeDiff = Infinity;
    let currentValue = 0;
    
    for (const dataPoint of this.data) {
      const timeDiff = Math.abs(dataPoint.date.getTime() - now);
      if (timeDiff < closestTimeDiff) {
        closestTimeDiff = timeDiff;
        currentValue = dataPoint.value;
      }
    }
    
    const nowY = this.getYCoordinate(currentValue, minValue, maxValue, chartHeight);
    
    // If showCurrentTimeDot is enabled, draw a dot instead of a line
    if (this.options.showCurrentTimeDot) {
      const currentTimeDot = document.createElementNS(svgNS, "circle");
      currentTimeDot.setAttribute("cx", nowX.toString());
      currentTimeDot.setAttribute("cy", nowY.toString());
      
      // Use the configurable dot size, with a smaller size on mobile
      const dotSize = this.isMobile 
        ? Math.max(4, this.options.currentTimeDotSize * 0.8) // Scale down a bit on mobile
        : this.options.currentTimeDotSize;
      
      currentTimeDot.setAttribute("r", dotSize.toString());
      currentTimeDot.setAttribute("fill", this.options.currentTimeColor);
      
      // Add a white outline to make the dot stand out
      currentTimeDot.setAttribute("stroke", "white");
      currentTimeDot.setAttribute("stroke-width", "1");
      
      // No animation - just a static dot
      
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
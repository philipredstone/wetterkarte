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
    yTickCount?: number;
    valueLabel?: string;
    valueUnit?: string;
    showPoints?: boolean;
    showArea?: boolean;
    lineWidth?: number;
    pointSize?: number;
    smoothing?: 'none' | 'bezier' | 'cardinal';
    smoothingTension?: number; // Controls curve tightness (0-1)
  }
  
  export class TimeLineChart {
    private container: HTMLElement;
    private data: TimeLineData[];
    private options: Required<TimeLineChartOptions>;
    private svg: SVGSVGElement;
    private tooltip: HTMLDivElement;
  
    constructor(container: HTMLElement, data: TimeLineData[], options?: TimeLineChartOptions) {
      this.container = container;
      if (getComputedStyle(this.container).position === "static") {
        this.container.style.position = "relative";
      }
  
      // Sort data by date.
      this.data = data.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
  
      // Ensure we have enough space on the left for a vertical label.
      const defaultMargin = { top: 20, right: 60, bottom: 100, left: 50 };
      const userMargin = options?.margin ?? {};
      const safeLeft = Math.max(userMargin.left ?? defaultMargin.left, 70);
  
      this.options = {
        width: options?.width ?? 600, // default width (will be updated to container width)
        height: options?.height ?? 400,
        margin: {
          top: userMargin.top ?? defaultMargin.top,
          right: userMargin.right ?? defaultMargin.right,
          bottom: userMargin.bottom ?? defaultMargin.bottom,
          left: safeLeft,
        },
        lineColor: options?.lineColor ?? "steelblue",
        pointColor: options?.pointColor ?? "steelblue",
        areaFill: options?.areaFill ?? "rgba(70, 130, 180, 0.2)", // light steelblue
        labelColor: options?.labelColor ?? "black",
        xTickCount: options?.xTickCount ?? 5,
        yTickCount: options?.yTickCount ?? 5,
        valueLabel: options?.valueLabel ?? "",
        valueUnit: options?.valueUnit ?? "",
        showPoints: options?.showPoints ?? true,
        showArea: options?.showArea ?? false,
        lineWidth: options?.lineWidth ?? 2,
        pointSize: options?.pointSize ?? 4,
        smoothing: options?.smoothing ?? 'none',
        smoothingTension: options?.smoothingTension ?? 0.5, // default tension
      };
  
      this.svg = this.createSVG();
      this.tooltip = this.createTooltip();
  
      // Re-render the chart on window resize for responsiveness.
      window.addEventListener("resize", this.handleResize.bind(this));
    }
  
    private handleResize(): void {
      // Optional: debounce here if needed for performance.
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
      tooltip.style.background = "rgba(0, 0, 0, 0.7)";
      tooltip.style.color = "#fff";
      tooltip.style.padding = "4px 8px";
      tooltip.style.borderRadius = "4px";
      tooltip.style.fontSize = "12px";
      tooltip.style.display = "none";
      tooltip.style.zIndex = "10";
      this.container.appendChild(tooltip);
      return tooltip;
    }
    
    /**
     * Updates the tooltip position based on mouse event
     */
    private updateTooltipPosition(event: MouseEvent): void {
      const containerRect = this.container.getBoundingClientRect();
      const tooltipWidth = this.tooltip.offsetWidth;
      const tooltipHeight = this.tooltip.offsetHeight;
      let left = event.clientX - containerRect.left + 10;
      let top = event.clientY - containerRect.top + 10;
      if (left + tooltipWidth > containerRect.width) {
        left = containerRect.width - tooltipWidth - 10;
      }
      if (top + tooltipHeight > containerRect.height) {
        top = containerRect.height - tooltipHeight - 10;
      }
      this.tooltip.style.left = `${left}px`;
      this.tooltip.style.top = `${top}px`;
    }
    
    /**
     * Finds the nearest data point to the mouse position
     */
    private findNearestDataPoint(
      mouseX: number, 
      mouseY: number, 
      minTime: number,
      maxTime: number,
      timeRange: number,
      maxValue: number,
      chartWidth: number,
      chartHeight: number
    ): { x: number; y: number; date: Date; value: number } | null {
      if (this.data.length === 0) return null;
      
      // First try to find the nearest point by x-coordinate (time)
      const mouseTimeRatio = mouseX / chartWidth;
      const mouseTime = minTime + mouseTimeRatio * timeRange;
      
      // Find two closest points in time
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
      const y = this.getYCoordinate(nearestPoint.value, maxValue, chartHeight);
      
      return {
        x,
        y,
        date: nearestPoint.date,
        value: nearestPoint.value
      };
    }
  
    public render(): void {
      // Update chart width based on the container's current width.
      const containerWidth = this.container.clientWidth || this.options.width;
      this.options.width = containerWidth;
      this.svg.setAttribute("viewBox", `0 0 ${this.options.width} ${this.options.height}`);
  
      // Clear previous contents.
      while (this.svg.firstChild) {
        this.svg.removeChild(this.svg.firstChild);
      }
  
      const { width, height, margin, lineColor, pointColor, areaFill } = this.options;
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
  
      if (this.data.length === 0) return;
  
      const minDate = this.data[0].date;
      const maxDate = this.data[this.data.length - 1].date;
      const minTime = minDate.getTime();
      const maxTime = maxDate.getTime();
      const timeRange = Math.max(1, maxTime - minTime);
  
      const maxValue = Math.max(...this.data.map((d) => d.value), 0);
  
      const svgNS = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("transform", `translate(${margin.left}, ${margin.top})`);
      this.svg.appendChild(g);
  
      // Create active point indicator (initially hidden)
      const activePoint = document.createElementNS(svgNS, "circle");
      activePoint.setAttribute("r", (this.options.pointSize * 1.5).toString());
      activePoint.setAttribute("fill", pointColor);
      activePoint.setAttribute("stroke", "white");
      activePoint.setAttribute("stroke-width", "2");
      activePoint.setAttribute("display", "none");
      g.appendChild(activePoint);
  
      // Draw the area under the line if enabled
      if (this.options.showArea && this.data.length > 1) {
        const areaPath = document.createElementNS(svgNS, "path");
        
        // Create array of coordinates for easier processing
        const points = this.data.map(d => ({
          x: this.getXCoordinate(d.date, minTime, timeRange, chartWidth),
          y: this.getYCoordinate(d.value, maxValue, chartHeight)
        }));
        
        let areaD = `M${points[0].x},${chartHeight}`;
        
        // Generate top path based on smoothing option
        if (this.options.smoothing === 'none') {
          // Regular straight line segments
          points.forEach(point => {
            areaD += ` L${point.x},${point.y}`;
          });
        } else if (this.options.smoothing === 'bezier') {
          // Bezier curve smoothing
          areaD += ' ' + this.getBezierPath(points).substring(1); // Remove initial M command
        } else if (this.options.smoothing === 'cardinal') {
          // Cardinal spline smoothing
          areaD += ' ' + this.getCardinalPath(points, this.options.smoothingTension).substring(1); // Remove initial M command
        }
        
        // Close the path
        areaD += ` L${points[points.length-1].x},${chartHeight} Z`;
        
        areaPath.setAttribute("d", areaD);
        areaPath.setAttribute("fill", areaFill);
        areaPath.setAttribute("stroke", "none");
        g.appendChild(areaPath);
      }
  
      // Draw the line
      if (this.data.length > 1) {
        const linePath = document.createElementNS(svgNS, "path");
        let lineD = "";
        
        // Create array of coordinates for easier processing
        const points = this.data.map(d => ({
          x: this.getXCoordinate(d.date, minTime, timeRange, chartWidth),
          y: this.getYCoordinate(d.value, maxValue, chartHeight)
        }));
        
        // Generate path based on smoothing option
        if (this.options.smoothing === 'none') {
          // Regular straight line segments
          points.forEach((point, i) => {
            if (i === 0) {
              lineD += `M${point.x},${point.y}`;
            } else {
              lineD += ` L${point.x},${point.y}`;
            }
          });
        } else if (this.options.smoothing === 'bezier') {
          // Bezier curve smoothing
          lineD = this.getBezierPath(points);
        } else if (this.options.smoothing === 'cardinal') {
          // Cardinal spline smoothing
          lineD = this.getCardinalPath(points, this.options.smoothingTension);
        }
        
        linePath.setAttribute("d", lineD);
        linePath.setAttribute("fill", "none");
        linePath.setAttribute("stroke", lineColor);
        linePath.setAttribute("stroke-width", this.options.lineWidth.toString());
        g.appendChild(linePath);
      }
  
      // Draw data points
      if (this.options.showPoints) {
        this.data.forEach(d => {
          const x = this.getXCoordinate(d.date, minTime, timeRange, chartWidth);
          const y = this.getYCoordinate(d.value, maxValue, chartHeight);
          
          const point = document.createElementNS(svgNS, "circle");
          point.setAttribute("cx", x.toString());
          point.setAttribute("cy", y.toString());
          point.setAttribute("r", this.options.pointSize.toString());
          point.setAttribute("fill", pointColor);
          point.setAttribute("stroke", "white");
          point.setAttribute("stroke-width", "1");
          
          // Create invisible larger hit area for hover
          const hitArea = document.createElementNS(svgNS, "circle");
          const hitAreaSize = Math.max(10, this.options.pointSize * 2);
          hitArea.setAttribute("cx", x.toString());
          hitArea.setAttribute("cy", y.toString());
          hitArea.setAttribute("r", hitAreaSize.toString());
          hitArea.setAttribute("fill", "transparent");
          hitArea.style.cursor = "pointer";
          
          // Add tooltip events
          hitArea.addEventListener("mouseover", () => {
            this.tooltip.innerHTML = `<strong>${this.formatDateTime(d.date)}</strong><br/>` +
              `${this.options.valueLabel}: ${d.value} ${this.options.valueUnit}`;
            this.tooltip.style.display = "block";
            point.setAttribute("r", (this.options.pointSize * 1.5).toString());
          });
          
          hitArea.addEventListener("mousemove", (event) => {
            this.updateTooltipPosition(event);
          });
          
          hitArea.addEventListener("mouseout", () => {
            this.tooltip.style.display = "none";
            point.setAttribute("r", this.options.pointSize.toString());
          });
          
          g.appendChild(hitArea);
          g.appendChild(point);
        });
      }
  
      // Create a transparent overlay for hover effects when points are disabled
      const overlay = document.createElementNS(svgNS, "rect");
      overlay.setAttribute("x", "0");
      overlay.setAttribute("y", "0");
      overlay.setAttribute("width", chartWidth.toString());
      overlay.setAttribute("height", chartHeight.toString());
      overlay.setAttribute("fill", "transparent");
      overlay.style.cursor = "crosshair";
      
      // Add mouse events to the overlay
      overlay.addEventListener("mousemove", (event) => {
        // Only handle hover if we're not showing individual points
        if (!this.options.showPoints) {
          const containerRect = this.container.getBoundingClientRect();
          const mouseX = event.clientX - containerRect.left - margin.left;
          const mouseY = event.clientY - containerRect.top - margin.top;
          
          // Find the nearest data point
          const nearestPoint = this.findNearestDataPoint(mouseX, mouseY, minTime, maxTime, timeRange, maxValue, chartWidth, chartHeight);
          
          if (nearestPoint) {
            // Position the active point indicator
            activePoint.setAttribute("cx", nearestPoint.x.toString());
            activePoint.setAttribute("cy", nearestPoint.y.toString());
            activePoint.setAttribute("display", "block");
            
            // Show tooltip
            this.tooltip.innerHTML = `<strong>${this.formatDateTime(nearestPoint.date)}</strong><br/>` +
              `${this.options.valueLabel}: ${nearestPoint.value} ${this.options.valueUnit}`;
            this.tooltip.style.display = "block";
            
            this.updateTooltipPosition(event);
          }
        }
      });
      
      overlay.addEventListener("mouseout", () => {
        if (!this.options.showPoints) {
          this.tooltip.style.display = "none";
          activePoint.setAttribute("display", "none");
        }
      });
      
      g.appendChild(overlay);
  
      // Draw axes
      this.drawTimeAxis(g, chartWidth, chartHeight, minTime, maxTime);
      this.drawYAxis(g, chartWidth, chartHeight, maxValue);
      this.drawAxisLabels(g, chartWidth, chartHeight);
  
      // Draw vertical line for current time
      this.drawCurrentTimeLine(g, chartWidth, chartHeight, minTime, maxTime);
    }
  
    private getXCoordinate(date: Date, minTime: number, timeRange: number, chartWidth: number): number {
      const time = date.getTime();
      const xRatio = (time - minTime) / timeRange;
      return xRatio * chartWidth;
    }
  
    private getYCoordinate(value: number, maxValue: number, chartHeight: number): number {
      return chartHeight - (value / maxValue) * chartHeight;
    }
    
    /**
     * Generates a smooth Bezier curve path through the given points
     * Uses cubic Bezier curves between each point
     */
    private getBezierPath(points: { x: number; y: number }[]): string {
      if (points.length < 2) return "";
      
      let path = `M${points[0].x},${points[0].y}`;
      
      // For each point (except first and last), calculate control points
      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        
        // Calculate control points
        // For a simple curve, we can use 1/3 distance between points
        const controlPoint1 = {
          x: current.x + (next.x - current.x) / 3,
          y: current.y + (next.y - current.y) / 3
        };
        
        const controlPoint2 = {
          x: current.x + 2 * (next.x - current.x) / 3,
          y: current.y + 2 * (next.y - current.y) / 3
        };
        
        path += ` C${controlPoint1.x},${controlPoint1.y} ${controlPoint2.x},${controlPoint2.y} ${next.x},${next.y}`;
      }
      
      return path;
    }
    
    /**
     * Generates a Cardinal spline path through the given points
     * Cardinal splines pass through all points and have a tension parameter
     * @param tension Controls how "tight" the curve is (0-1, higher is tighter)
     */
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
  
    private formatDateTime(date: Date): string {
      const day = date.getDate();
      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${day}. ${monthNames[date.getMonth()]}, ${hours}:${minutes}`;
    }
  
    private drawTimeAxis(
      g: SVGGElement,
      chartWidth: number,
      chartHeight: number,
      minTime: number,
      maxTime: number
    ): void {
      const svgNS = "http://www.w3.org/2000/svg";
    
      const xAxisLine = document.createElementNS(svgNS, "line");
      xAxisLine.setAttribute("x1", "0");
      xAxisLine.setAttribute("y1", chartHeight.toString());
      xAxisLine.setAttribute("x2", chartWidth.toString());
      xAxisLine.setAttribute("y2", chartHeight.toString());
      xAxisLine.setAttribute("stroke", "black");
      g.appendChild(xAxisLine);
    
      // Calculate a dynamic tick count based on chart width.
      const minTickSpacing = 60; // Minimum spacing in pixels per tick label.
      const dynamicTickCount = Math.max(2, Math.floor(chartWidth / minTickSpacing));
      // Use the smaller value between the original tick count and the dynamic one.
      const tickCount = Math.min(this.options.xTickCount, dynamicTickCount);
    
      const tickLength = 6;
      for (let i = 0; i <= tickCount; i++) {
        const t = minTime + (i / tickCount) * (maxTime - minTime);
        const tickDate = new Date(t);
        const xRatio = (t - minTime) / (maxTime - minTime || 1);
        const x = xRatio * chartWidth;
    
        const tickLine = document.createElementNS(svgNS, "line");
        tickLine.setAttribute("x1", x.toString());
        tickLine.setAttribute("y1", chartHeight.toString());
        tickLine.setAttribute("x2", x.toString());
        tickLine.setAttribute("y2", (chartHeight + tickLength).toString());
        tickLine.setAttribute("stroke", "black");
        g.appendChild(tickLine);
    
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", x.toString());
        text.setAttribute("y", (chartHeight + 12).toString());
        text.setAttribute("dy", "0.5em");
        text.setAttribute("fill", this.options.labelColor);
        text.setAttribute("text-anchor", "middle");
        text.textContent = this.formatShortDate(tickDate);
        g.appendChild(text);
      }
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
      const svgNS = "http://www.w3.org/2000/svg";
  
      const yAxisLine = document.createElementNS(svgNS, "line");
      yAxisLine.setAttribute("x1", "0");
      yAxisLine.setAttribute("y1", "0");
      yAxisLine.setAttribute("x2", "0");
      yAxisLine.setAttribute("y2", chartHeight.toString());
      yAxisLine.setAttribute("stroke", "black");
      g.appendChild(yAxisLine);
  
      const tickCount = this.options.yTickCount;
      for (let i = 0; i <= tickCount; i++) {
        const value = maxValue * (i / tickCount);
        const y = chartHeight - (value / maxValue) * chartHeight;
        const tick = document.createElementNS(svgNS, "line");
        tick.setAttribute("x1", "-6");
        tick.setAttribute("y1", y.toString());
        tick.setAttribute("x2", "0");
        tick.setAttribute("y2", y.toString());
        tick.setAttribute("stroke", "black");
        g.appendChild(tick);
  
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", "-8");
        text.setAttribute("y", (y + 4).toString());
        text.setAttribute("text-anchor", "end");
        text.setAttribute("fill", this.options.labelColor);
        text.textContent = maxValue < 1 ? value.toFixed(2) : value.toFixed(0);
        g.appendChild(text);
      }
    }
  
    private drawAxisLabels(g: SVGGElement, chartWidth: number, chartHeight: number): void {
      const svgNS = "http://www.w3.org/2000/svg";
  
      const xAxisLabel = document.createElementNS(svgNS, "text");
      xAxisLabel.setAttribute("x", (chartWidth / 2).toString());
      xAxisLabel.setAttribute("y", (chartHeight + 40).toString());
      xAxisLabel.setAttribute("text-anchor", "middle");
      xAxisLabel.setAttribute("fill", this.options.labelColor);
      xAxisLabel.textContent = "Zeit";
      g.appendChild(xAxisLabel);
  
      if (this.options.valueLabel) {
        const yAxisLabel = document.createElementNS(svgNS, "text");
        const xOffset = -(this.options.margin.left - 10);
        const yOffset = chartHeight / 2;
  
        yAxisLabel.setAttribute("transform", `translate(${xOffset}, ${yOffset}) rotate(-90)`);
        yAxisLabel.setAttribute("text-anchor", "middle");
        yAxisLabel.setAttribute("fill", this.options.labelColor);
  
        if (this.options.valueUnit) {
          yAxisLabel.textContent = `${this.options.valueLabel} (${this.options.valueUnit})`;
        } else {
          yAxisLabel.textContent = this.options.valueLabel;
        }
        g.appendChild(yAxisLabel);
      }
    }
  
    // Draws a vertical line for the current time.
    private drawCurrentTimeLine(
      g: SVGGElement,
      chartWidth: number,
      chartHeight: number,
      minTime: number,
      maxTime: number
    ): void {
      const now = Date.now();
      // Only draw the line if the current time falls within the chart's time range.
      if (now < minTime || now > maxTime) {
        return;
      }
      const nowRatio = (now - minTime) / (maxTime - minTime);
      const nowX = nowRatio * chartWidth;
  
      const svgNS = "http://www.w3.org/2000/svg";
      const nowLine = document.createElementNS(svgNS, "line");
      nowLine.setAttribute("x1", nowX.toString());
      nowLine.setAttribute("y1", "0");
      nowLine.setAttribute("x2", nowX.toString());
      nowLine.setAttribute("y2", chartHeight.toString());
      nowLine.setAttribute("stroke", "red");
      nowLine.setAttribute("stroke-width", "2");
      nowLine.setAttribute("stroke-dasharray", "4,2");
      g.appendChild(nowLine);
    }
  }
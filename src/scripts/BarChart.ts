// The key change is in the render method - adding time range padding to prevent bars from being too close to the edges

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
  showTimeInTooltip?: boolean;
}

export class TimeBarChart {
  private container: HTMLElement;
  private data: TimeBarData[];
  private options: Required<TimeBarChartOptions>;
  private svg: SVGSVGElement;
  private tooltip: HTMLDivElement;

  constructor(container: HTMLElement, data: TimeBarData[], options?: TimeBarChartOptions) {
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
      barColor: options?.barColor ?? "steelblue",
      labelColor: options?.labelColor ?? "black",
      xTickCount: options?.xTickCount ?? 5,
      yTickCount: options?.yTickCount ?? 5,
      valueLabel: options?.valueLabel ?? "",
      valueUnit: options?.valueUnit ?? "",
      showCurrentTimeLine: options?.showCurrentTimeLine ?? true,
      showTimeInTooltip: options?.showTimeInTooltip ?? true,
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

  public render(): void {
    // Update chart width based on the container's current width.
    const containerWidth = this.container.clientWidth || this.options.width;
    this.options.width = containerWidth;
    this.svg.setAttribute("viewBox", `0 0 ${this.options.width} ${this.options.height}`);

    // Clear previous contents.
    while (this.svg.firstChild) {
      this.svg.removeChild(this.svg.firstChild);
    }

    const { width, height, margin, barColor } = this.options;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    if (this.data.length === 0) return;

    const minDate = this.data[0].date;
    const maxDate = this.data[this.data.length - 1].date;
    const minTime = minDate.getTime();
    const maxTime = maxDate.getTime();
    const timeRange = Math.max(1, maxTime - minTime);

    const timePaddingRatio = 0.05;
    const paddedMinTime = minTime - (timeRange * timePaddingRatio);
    const paddedMaxTime = maxTime + (timeRange * timePaddingRatio);
    const paddedTimeRange = paddedMaxTime - paddedMinTime;

    const maxValue = Math.max(...this.data.map((d) => d.value), 0);

    const svgNS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("transform", `translate(${margin.left}, ${margin.top})`);
    this.svg.appendChild(g);

    // Group data points by timestamp to handle duplicates
    const timeGroups = new Map<number, TimeBarData[]>();
    this.data.forEach(d => {
      const time = d.date.getTime();
      if (!timeGroups.has(time)) {
        timeGroups.set(time, []);
      }
      timeGroups.get(time)!.push(d);
    });

    // Calculate base bar width
    const distinctTimePoints = timeGroups.size;
    const baseBarWidth = (chartWidth / Math.max(distinctTimePoints * 2, 1)) * 0.8;

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

        // Create invisible wider hover area
        const hoverArea = document.createElementNS(svgNS, "rect");
        const hoverPadding = Math.max(4, baseBarWidth * 0.4); // At least 4px or 40% of bar width
        hoverArea.setAttribute("x", (x - hoverPadding).toString());
        hoverArea.setAttribute("y", "0");
        hoverArea.setAttribute("width", (baseBarWidth + 2 * hoverPadding).toString());
        hoverArea.setAttribute("height", chartHeight.toString());
        hoverArea.setAttribute("fill", "transparent");
        hoverArea.style.cursor = "pointer";

        // Visible bar
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", x.toString());
        rect.setAttribute("y", y.toString());
        rect.setAttribute("width", baseBarWidth.toString());
        rect.setAttribute("height", barHeight.toString());
        rect.setAttribute("fill", barColor);
        rect.style.cursor = "pointer";

        // Add hover events to the hover area
        hoverArea.addEventListener("mouseover", () => {
          this.tooltip.innerHTML = `<strong>${this.formatDateTime(d.date)}</strong><br/>` +
            `${this.options.valueLabel}: ${d.value} ${this.options.valueUnit}`;
          this.tooltip.style.display = "block";
        });
        hoverArea.addEventListener("mousemove", (event) => {
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
        });
        hoverArea.addEventListener("mouseout", () => {
          this.tooltip.style.display = "none";
        });

        g.appendChild(rect);
        g.appendChild(hoverArea);
      });
    });

    // Draw axes - also update time axis to use padded time range
    this.drawTimeAxis(g, chartWidth, chartHeight, paddedMinTime, paddedMaxTime);
    this.drawYAxis(g, chartWidth, chartHeight, maxValue);
    this.drawAxisLabels(g, chartWidth, chartHeight);

    // Draw vertical line for current time
    this.drawCurrentTimeLine(g, chartWidth, chartHeight, minTime, maxTime);
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
    // Skip if the current time line is disabled
    if (!this.options.showCurrentTimeLine) {
      return;
    }
    
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
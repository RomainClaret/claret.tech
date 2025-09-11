/**
 * Optimized Renderer for Hybrid 2: Cascading Burst Networks
 * Enhanced colors, sharpness, and theme support for maximum visibility
 */

// Prevent duplicate declarations
if (typeof OptimizedHybrid2Renderer !== "undefined") {
  console.log("OptimizedHybrid2Renderer already exists, skipping declaration");
} else {
  class OptimizedHybrid2Renderer {
    constructor(canvas, pattern, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", {
        alpha: true,
        imageSmoothingEnabled: false, // Pixel-perfect rendering
      });
      this.size = canvas.width;
      this.pattern = pattern;
      this.currentFrame = 0;

      // Options
      this.theme = options.theme || "auto"; // 'light', 'dark', 'auto'
      this.highContrast = options.highContrast || false;
      this.pixelPerfect = options.pixelPerfect !== false; // Default true for small sizes
      this.forceDarkMode = options.forceDarkMode !== false; // Default true - always use dark colors

      // Detect actual theme
      this.isDarkMode = this.detectDarkMode();

      // Color schemes
      this.colors = this.getColorScheme();

      // Rendering settings based on size
      this.renderSettings = this.getRenderSettings();

      // Setup
      this.setupCanvas();
    }

    detectDarkMode() {
      // Check if dark mode is forced (default behavior)
      if (this.forceDarkMode) {
        return true;
      }

      // Original theme-aware detection
      if (this.theme === "light") return false;
      if (this.theme === "dark") return true;

      // Auto-detect
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      return false;
    }

    getColorScheme() {
      if (this.isDarkMode) {
        return {
          // Dark mode - high contrast with near-white borders
          primary: "#A855F7", // Bright purple
          secondary: "#C084FC", // Light purple
          accent: "#E9D5FF", // Very light purple for spikes
          activeFill: "rgba(168, 85, 247, 0.35)", // More opaque
          inactiveFill: "rgba(168, 85, 247, 0.08)",
          activeBorder: "#F3E8FF", // Near-white purple tint for sharp visibility
          inactiveBorder: "rgba(243, 232, 255, 0.4)", // 40% near-white for grid visibility
          spikePrimary: "#FFFFFF", // Pure white for maximum pop
          spikeSecondary: "#E9D5FF",
          cascadeGlow: "rgba(233, 213, 255, 0.6)",
          connectionColor: "rgba(192, 132, 252, 0.5)",
        };
      } else {
        return {
          // Light mode - high contrast with very dark borders
          primary: "#6B21A8", // Deep purple
          secondary: "#9333EA", // Vibrant purple
          accent: "#7C3AED", // Medium purple for spikes
          activeFill: "rgba(107, 33, 168, 0.25)",
          inactiveFill: "rgba(107, 33, 168, 0.06)",
          activeBorder: "#2E1065", // Very dark purple, almost black for sharp contrast
          inactiveBorder: "rgba(46, 16, 101, 0.35)", // 35% very dark purple for grid visibility
          spikePrimary: "#581C87", // Darker purple for better visibility
          spikeSecondary: "#6B21A8",
          cascadeGlow: "rgba(147, 51, 234, 0.4)",
          connectionColor: "rgba(124, 58, 237, 0.4)",
        };
      }
    }

    getRenderSettings() {
      const settings = {
        cellPadding: 0.1,
        borderWidth: 1,
        cornerRadius: 0,
        spikeScale: 1,
        minOpacity: 0.2,
        maxOpacity: 1,
        connectionWidth: 1,
        glowEnabled: true,
      };

      // Adjust based on canvas size
      if (this.size <= 16) {
        // Tiny size - maximum sharpness
        settings.cellPadding = 0;
        settings.borderWidth = 1; // Keep 1px for pixel-perfect rendering
        settings.cornerRadius = 0;
        settings.spikeScale = 0.8;
        settings.minOpacity = 0.3;
        settings.glowEnabled = false;
        settings.connectionWidth = 1;
      } else if (this.size <= 32) {
        // Small size - balanced with sharper borders
        settings.cellPadding = 0.05;
        settings.borderWidth = 1.5; // Slightly thicker for better visibility
        settings.cornerRadius = 0; // Remove corner radius for sharper look
        settings.spikeScale = 0.9;
        settings.minOpacity = 0.25;
        settings.glowEnabled = false;
        settings.connectionWidth = 1.5;
      } else if (this.size <= 64) {
        // Medium size - enhanced borders
        settings.cellPadding = 0.08;
        settings.borderWidth = 2.5; // Thicker borders for clarity
        settings.cornerRadius = 1; // Minimal corner radius
        settings.spikeScale = 1;
        settings.minOpacity = 0.2;
        settings.glowEnabled = true;
        settings.connectionWidth = 2;
      } else {
        // Large size - full detail with prominent borders
        settings.cellPadding = 0.1;
        settings.borderWidth = 3; // Thick borders for large sizes
        settings.cornerRadius = 2; // Reduced corner radius for sharper look
        settings.spikeScale = 1.2;
        settings.minOpacity = 0.15;
        settings.glowEnabled = true;
        settings.connectionWidth = 2.5;
      }

      // High contrast overrides
      if (this.highContrast) {
        settings.minOpacity = 0.4;
        settings.maxOpacity = 1;
        settings.borderWidth = Math.max(2, settings.borderWidth);
      }

      return settings;
    }

    setupCanvas() {
      // Disable smoothing for pixel-perfect rendering
      if (this.pixelPerfect && this.size <= 32) {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
      }

      // Set pixel density for retina displays
      if (typeof window !== "undefined" && window.devicePixelRatio > 1) {
        const ratio = window.devicePixelRatio;
        this.canvas.width = this.size * ratio;
        this.canvas.height = this.size * ratio;
        this.canvas.style.width = this.size + "px";
        this.canvas.style.height = this.size + "px";
        this.ctx.scale(ratio, ratio);
      }
    }

    drawFrame(frameIndex) {
      const frame = this.pattern[frameIndex % this.pattern.length];
      const cellSize = this.size / 4;

      // Clear with background (transparent or solid based on theme)
      this.ctx.clearRect(0, 0, this.size, this.size);

      // Optional: Add subtle background for better visibility
      if (this.highContrast) {
        this.ctx.fillStyle = this.isDarkMode
          ? "rgba(0,0,0,0.1)"
          : "rgba(255,255,255,0.1)";
        this.ctx.fillRect(0, 0, this.size, this.size);
      }

      // Draw connections first (behind cells)
      if (frame.connections && frame.connections.length > 0) {
        this.drawConnections(frame.connections, cellSize);
      }

      // Draw cells
      this.drawCells(frame.cells, cellSize);

      // Draw spikes and cascades (on top)
      if (frame.spikes && frame.spikes.length > 0) {
        this.drawSpikes(frame.spikes, cellSize);
      }
    }

    drawCells(cells, cellSize) {
      const settings = this.renderSettings;
      const padding = cellSize * settings.cellPadding;
      const actualCellSize = cellSize - padding * 2;

      for (let i = 0; i < cells.length; i++) {
        for (let j = 0; j < cells[i].length; j++) {
          const x = j * cellSize + padding;
          const y = i * cellSize + padding;
          const value = cells[i][j];

          // Calculate opacity with enhanced contrast (unused since borders are full opacity)
          // const opacity = value > 0 ? settings.minOpacity + value * (settings.maxOpacity - settings.minOpacity) : 0;

          if (value > 0 || this.size > 16) {
            // Always show grid at larger sizes
            // Draw cell background
            this.ctx.fillStyle =
              value > 0.5 ? this.colors.activeFill : this.colors.inactiveFill;

            if (settings.cornerRadius > 0 && this.size > 32) {
              this.roundRect(
                x,
                y,
                actualCellSize,
                actualCellSize,
                settings.cornerRadius,
              );
              this.ctx.fill();
            } else {
              // Sharp rectangles for small sizes
              this.ctx.fillRect(x, y, actualCellSize, actualCellSize);
            }

            // Draw cell border for clarity - ALWAYS at full opacity to prevent fading
            this.ctx.strokeStyle =
              value > 0.5
                ? this.colors.activeBorder
                : this.colors.inactiveBorder;
            this.ctx.lineWidth = settings.borderWidth;
            // Keep borders at full opacity regardless of cell activity
            this.ctx.globalAlpha = 1.0;

            if (settings.cornerRadius > 0 && this.size > 32) {
              this.roundRect(
                x,
                y,
                actualCellSize,
                actualCellSize,
                settings.cornerRadius,
              );
              this.ctx.stroke();
            } else {
              this.ctx.strokeRect(x, y, actualCellSize, actualCellSize);
            }

            this.ctx.globalAlpha = 1;
          }
        }
      }
    }

    drawSpikes(spikes, cellSize) {
      const settings = this.renderSettings;

      spikes.forEach((spike) => {
        const centerX = spike.x * cellSize + cellSize / 2;
        const centerY = spike.y * cellSize + cellSize / 2;
        const maxRadius = cellSize * 0.3 * settings.spikeScale;
        const radius = maxRadius * spike.intensity;

        // Enhanced spike rendering based on type
        if (spike.type === "cascade") {
          this.drawCascadeSpike(centerX, centerY, radius, spike);
        } else if (spike.type === "star") {
          this.drawBurstSpike(centerX, centerY, radius, spike);
        } else {
          this.drawDefaultSpike(centerX, centerY, radius, spike);
        }
      });
    }

    drawCascadeSpike(x, y, radius, spike) {
      const settings = this.renderSettings;

      // Cascade effect - expanding rings
      if (settings.glowEnabled && this.size > 32) {
        // Glow effect for larger sizes
        const gradient = this.ctx.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          radius * 2,
        );
        gradient.addColorStop(0, this.colors.cascadeGlow);
        gradient.addColorStop(1, "rgba(0,0,0,0)");

        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = spike.intensity * 0.5;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Main cascade rings
      const numRings = this.size <= 32 ? 2 : 3;
      for (let i = 0; i < numRings; i++) {
        const ringRadius =
          radius *
          (1 + i * 0.4) *
          (spike.age !== undefined ? 1 - spike.age / 4 : 1);
        this.ctx.strokeStyle = this.colors.spikePrimary;
        this.ctx.globalAlpha = spike.intensity * (1 - i / numRings) * 0.7;
        this.ctx.lineWidth = Math.max(1, settings.borderWidth);

        this.ctx.beginPath();
        this.ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Central bright dot
      this.ctx.fillStyle = this.colors.spikePrimary;
      this.ctx.globalAlpha = spike.intensity;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.globalAlpha = 1;
    }

    drawBurstSpike(x, y, radius, spike) {
      const settings = this.renderSettings;

      // Star burst for neural activity
      this.ctx.fillStyle = this.colors.spikePrimary;
      this.ctx.strokeStyle = this.colors.spikeSecondary;
      this.ctx.globalAlpha = spike.intensity;

      const points = this.size <= 16 ? 4 : 6;
      const outerRadius = radius;
      const innerRadius = radius * 0.4;

      this.ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;

        if (i === 0) {
          this.ctx.moveTo(px, py);
        } else {
          this.ctx.lineTo(px, py);
        }
      }
      this.ctx.closePath();
      this.ctx.fill();

      if (this.size > 16) {
        this.ctx.lineWidth = settings.borderWidth;
        this.ctx.stroke();
      }

      this.ctx.globalAlpha = 1;
    }

    drawDefaultSpike(x, y, radius, spike) {
      // Simple circle spike for other types
      this.ctx.fillStyle = this.colors.spikePrimary;
      this.ctx.globalAlpha = spike.intensity;

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.globalAlpha = 1;
    }

    drawConnections(connections, cellSize) {
      const settings = this.renderSettings;

      this.ctx.strokeStyle = this.colors.connectionColor;
      this.ctx.lineWidth = settings.connectionWidth;

      connections.forEach((conn) => {
        const x1 = conn.from.x * cellSize + cellSize / 2;
        const y1 = conn.from.y * cellSize + cellSize / 2;
        const x2 = conn.to.x * cellSize + cellSize / 2;
        const y2 = conn.to.y * cellSize + cellSize / 2;

        this.ctx.globalAlpha = conn.strength * 0.6;

        if (this.size > 32) {
          // Curved connections for larger sizes
          const cp1x = (x1 + x2) / 2 + (y2 - y1) * 0.2;
          const cp1y = (y1 + y2) / 2 - (x2 - x1) * 0.2;

          this.ctx.beginPath();
          this.ctx.moveTo(x1, y1);
          this.ctx.quadraticCurveTo(cp1x, cp1y, x2, y2);
          this.ctx.stroke();
        } else {
          // Straight lines for small sizes
          this.ctx.beginPath();
          this.ctx.moveTo(x1, y1);
          this.ctx.lineTo(x2, y2);
          this.ctx.stroke();
        }
      });

      this.ctx.globalAlpha = 1;
    }

    roundRect(x, y, width, height, radius) {
      this.ctx.beginPath();
      this.ctx.moveTo(x + radius, y);
      this.ctx.lineTo(x + width - radius, y);
      this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      this.ctx.lineTo(x + width, y + height - radius);
      this.ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height,
      );
      this.ctx.lineTo(x + radius, y + height);
      this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      this.ctx.lineTo(x, y + radius);
      this.ctx.quadraticCurveTo(x, y, x + radius, y);
      this.ctx.closePath();
    }

    // Generate a static frame that best represents the pattern
    getBestStaticFrame() {
      // For Hybrid 2, frames 6-7 typically show good cascade activity
      const bestFrameIndex = Math.min(6, this.pattern.length - 1);
      return bestFrameIndex;
    }

    // Export canvas as data URL
    toDataURL(type = "image/png", quality = 1.0) {
      return this.canvas.toDataURL(type, quality);
    }

    // Export canvas as blob
    toBlob(callback, type = "image/png", quality = 1.0) {
      this.canvas.toBlob(callback, type, quality);
    }

    // Update pattern without recreating renderer (memory optimization)
    updatePattern(newPattern) {
      this.pattern = newPattern;
      this.currentFrame = 0;
      // No need to recreate colors, settings, or canvas - just update pattern data
    }
  }

  // Export for use
  if (typeof window !== "undefined") {
    window.OptimizedHybrid2Renderer = OptimizedHybrid2Renderer;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = OptimizedHybrid2Renderer;
  }
} // End of declaration guard

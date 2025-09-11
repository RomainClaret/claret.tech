/**
 * Optimized Renderer for 32x32 Favicons
 * Simplified rendering for better performance
 */

// Prevent duplicate declarations
if (typeof OptimizedFaviconRenderer !== "undefined") {
  console.log("OptimizedFaviconRenderer already exists, skipping declaration");
} else {
  class OptimizedFaviconRenderer {
    constructor(canvas, pattern, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", {
        alpha: true,
        imageSmoothingEnabled: false,
        willReadFrequently: true, // Optimize for frequent toDataURL calls
      });
      this.size = 32; // Fixed size for favicons
      this.pattern = pattern;

      // Simplified options
      this.isDarkMode =
        options.theme === "dark" ||
        (options.theme === "auto" &&
          window.matchMedia?.("(prefers-color-scheme: dark)").matches);

      // Pre-calculate colors once
      this.colors = this.isDarkMode
        ? {
            cellActive: "#A855F7",
            cellInactive: "rgba(168, 85, 247, 0.15)",
            spike: "#FFFFFF",
            connection: "rgba(192, 132, 252, 0.4)",
          }
        : {
            cellActive: "#6B21A8",
            cellInactive: "rgba(107, 33, 168, 0.1)",
            spike: "#2E1065",
            connection: "rgba(124, 58, 237, 0.3)",
          };

      // Pre-calculate cell positions
      this.cellSize = 8; // 32px / 4 cells
      this.cells = [];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          this.cells.push({
            x: j * this.cellSize,
            y: i * this.cellSize,
            centerX: j * this.cellSize + 4,
            centerY: i * this.cellSize + 4,
          });
        }
      }
    }

    drawFrame(frameIndex) {
      const frame = this.pattern[frameIndex % this.pattern.length];

      // Clear canvas
      this.ctx.clearRect(0, 0, 32, 32);

      // Draw cells (simplified - no gradients or rounded corners)
      const cells = frame.cells;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const value = cells[i][j];
          if (value > 0.1) {
            const idx = i * 4 + j;
            const cell = this.cells[idx];

            // Simple filled rectangles
            this.ctx.fillStyle =
              value > 0.5 ? this.colors.cellActive : this.colors.cellInactive;
            this.ctx.fillRect(cell.x + 1, cell.y + 1, 6, 6);
          }
        }
      }

      // Draw connections (simplified - straight lines only)
      if (frame.connections) {
        this.ctx.strokeStyle = this.colors.connection;
        this.ctx.lineWidth = 1;

        for (const conn of frame.connections) {
          if (conn.strength > 0.3) {
            const from = this.cells[conn.from.y * 4 + conn.from.x];
            const to = this.cells[conn.to.y * 4 + conn.to.x];

            this.ctx.globalAlpha = conn.strength * 0.6;
            this.ctx.beginPath();
            this.ctx.moveTo(from.centerX, from.centerY);
            this.ctx.lineTo(to.centerX, to.centerY);
            this.ctx.stroke();
          }
        }
        this.ctx.globalAlpha = 1;
      }

      // Draw spikes (simplified - just circles)
      if (frame.spikes) {
        this.ctx.fillStyle = this.colors.spike;

        for (const spike of frame.spikes) {
          if (spike.intensity > 0.3) {
            const cell = this.cells[spike.y * 4 + spike.x];
            const radius = 2 * spike.intensity;

            this.ctx.globalAlpha = spike.intensity;
            this.ctx.beginPath();
            this.ctx.arc(cell.centerX, cell.centerY, radius, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
        this.ctx.globalAlpha = 1;
      }
    }

    // Quick render for static frame
    renderStaticFrame() {
      // Render frame 6 which typically shows good activity
      const frameIndex = Math.min(6, this.pattern.length - 1);
      this.drawFrame(frameIndex);
    }
  }

  // Export for use
  if (typeof window !== "undefined") {
    window.OptimizedFaviconRenderer = OptimizedFaviconRenderer;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = OptimizedFaviconRenderer;
  }
}

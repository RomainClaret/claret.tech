"use client";

import { logWarning } from "@/lib/utils/dev-logger";

interface GpuInfo {
  vendor: string | null;
  renderer: string | null;
  version: string | null;
  shadingLanguageVersion: string | null;
  maxTextureSize: number | null;
  maxViewportDims: number[] | null;
  maxVertexAttribs: number | null;
  maxVaryingVectors: number | null;
  maxFragmentUniforms: number | null;
  maxVertexUniforms: number | null;
}

interface GpuPerformance {
  score: number;
  frameTime: number;
  trianglesPerSecond: number;
  usage: number;
}

export class GpuEstimator {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private animationId: number | null = null;
  private isMonitoring = false;
  private baselineScore: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private totalFrameTime = 0;

  constructor() {
    this.initializeWebGL();
  }

  private initializeWebGL(): boolean {
    try {
      // Create off-screen canvas for GPU testing
      this.canvas = document.createElement("canvas");
      this.canvas.width = 256;
      this.canvas.height = 256;
      this.canvas.style.display = "none";

      // Try to get WebGL context
      this.gl =
        this.canvas.getContext("webgl") ||
        (this.canvas.getContext("experimental-webgl") as WebGLRenderingContext);

      if (!this.gl) {
        logWarning("WebGL not supported for GPU monitoring", "GPU Estimator");
        return false;
      }

      return true;
    } catch {
      logWarning(
        "Failed to initialize WebGL for GPU monitoring",
        "GPU Estimator",
      );
      return false;
    }
  }

  public getGpuInfo(): GpuInfo {
    if (!this.gl) {
      return {
        vendor: null,
        renderer: null,
        version: null,
        shadingLanguageVersion: null,
        maxTextureSize: null,
        maxViewportDims: null,
        maxVertexAttribs: null,
        maxVaryingVectors: null,
        maxFragmentUniforms: null,
        maxVertexUniforms: null,
      };
    }

    try {
      // Try to get debug renderer info extension
      const debugInfo = this.gl.getExtension("WEBGL_debug_renderer_info");

      return {
        vendor: debugInfo
          ? this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
          : this.gl.getParameter(this.gl.VENDOR),
        renderer: debugInfo
          ? this.gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : this.gl.getParameter(this.gl.RENDERER),
        version: this.gl.getParameter(this.gl.VERSION),
        shadingLanguageVersion: this.gl.getParameter(
          this.gl.SHADING_LANGUAGE_VERSION,
        ),
        maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
        maxViewportDims: this.gl.getParameter(this.gl.MAX_VIEWPORT_DIMS),
        maxVertexAttribs: this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS),
        maxVaryingVectors: this.gl.getParameter(this.gl.MAX_VARYING_VECTORS),
        maxFragmentUniforms: this.gl.getParameter(
          this.gl.MAX_FRAGMENT_UNIFORM_VECTORS,
        ),
        maxVertexUniforms: this.gl.getParameter(
          this.gl.MAX_VERTEX_UNIFORM_VECTORS,
        ),
      };
    } catch {
      logWarning("Failed to get GPU info", "GPU Estimator");
      return {
        vendor: null,
        renderer: null,
        version: null,
        shadingLanguageVersion: null,
        maxTextureSize: null,
        maxViewportDims: null,
        maxVertexAttribs: null,
        maxVaryingVectors: null,
        maxFragmentUniforms: null,
        maxVertexUniforms: null,
      };
    }
  }

  private createShaderProgram(): WebGLProgram | null {
    if (!this.gl) return null;

    // Simple vertex shader
    const vertexShaderSource = `
      attribute vec2 position;
      attribute vec3 color;
      varying vec3 vColor;
      
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        vColor = color;
      }
    `;

    // Simple fragment shader with some computation
    const fragmentShaderSource = `
      precision mediump float;
      varying vec3 vColor;
      uniform float time;
      
      void main() {
        vec2 pos = gl_FragCoord.xy / 256.0;
        float wave = sin(pos.x * 10.0 + time) * cos(pos.y * 10.0 + time);
        vec3 finalColor = vColor * (0.8 + 0.2 * wave);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const vertexShader = this.createShader(
      this.gl.VERTEX_SHADER,
      vertexShaderSource,
    );
    const fragmentShader = this.createShader(
      this.gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    if (!vertexShader || !fragmentShader) return null;

    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      logWarning("Failed to link shader program", "GPU Estimator");
      return null;
    }

    return program;
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      logWarning("Failed to compile shader", "GPU Estimator");
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  public async establishBaseline(): Promise<number> {
    if (!this.gl) return 0;

    const iterations = 5;
    let totalScore = 0;

    for (let i = 0; i < iterations; i++) {
      const score = await this.runGpuBenchmark(500); // 500ms benchmark
      totalScore += score;

      // Small delay between iterations
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.baselineScore = totalScore / iterations;
    return this.baselineScore;
  }

  public async runGpuBenchmark(duration = 1000): Promise<number> {
    if (!this.gl) return 0;

    const program = this.createShaderProgram();
    if (!program) return 0;

    this.gl.useProgram(program);

    // Create geometry (triangles)
    const triangleCount = 1000;
    const vertices = [];
    const colors = [];

    for (let i = 0; i < triangleCount; i++) {
      // Random triangle
      for (let j = 0; j < 3; j++) {
        vertices.push(
          (Math.random() - 0.5) * 2, // x
          (Math.random() - 0.5) * 2, // y
        );
        colors.push(
          Math.random(), // r
          Math.random(), // g
          Math.random(), // b
        );
      }
    }

    // Create buffers
    const positionBuffer = this.gl.createBuffer();
    const colorBuffer = this.gl.createBuffer();

    // Position buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(vertices),
      this.gl.STATIC_DRAW,
    );

    const positionLocation = this.gl.getAttribLocation(program, "position");
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(
      positionLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0,
    );

    // Color buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(colors),
      this.gl.STATIC_DRAW,
    );

    const colorLocation = this.gl.getAttribLocation(program, "color");
    this.gl.enableVertexAttribArray(colorLocation);
    this.gl.vertexAttribPointer(colorLocation, 3, this.gl.FLOAT, false, 0, 0);

    // Get uniform location
    const timeLocation = this.gl.getUniformLocation(program, "time");

    // Benchmark rendering
    const startTime = performance.now();
    const endTime = startTime + duration;
    let frameCount = 0;

    while (performance.now() < endTime) {
      const currentTime = (performance.now() - startTime) / 1000;

      // Update uniform
      this.gl.uniform1f(timeLocation, currentTime);

      // Clear and render
      this.gl.clearColor(0, 0, 0, 1);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, triangleCount * 3);

      // Force GPU synchronization
      this.gl.getError();

      frameCount++;
    }

    const actualDuration = performance.now() - startTime;
    const score = Math.round((frameCount / actualDuration) * 1000); // frames per second

    // Cleanup
    this.gl.deleteProgram(program);
    this.gl.deleteBuffer(positionBuffer);
    this.gl.deleteBuffer(colorBuffer);

    return score;
  }

  public async getCurrentPerformance(): Promise<GpuPerformance> {
    if (!this.gl) {
      return {
        score: 0,
        frameTime: 0,
        trianglesPerSecond: 0,
        usage: 0,
      };
    }

    const score = await this.runGpuBenchmark(500);

    let usage = 0;
    if (this.baselineScore && score > 0) {
      // Calculate usage based on performance degradation
      const efficiency = score / this.baselineScore;
      usage = Math.max(0, Math.min(100, (1 - efficiency) * 100 + 5));
    }

    return {
      score,
      frameTime: score > 0 ? 1000 / score : 0,
      trianglesPerSecond: score * 1000, // Approximate triangles per second
      usage: Math.round(usage),
    };
  }

  public startMonitoring(
    callback: (performance: GpuPerformance) => void,
  ): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    const monitor = async () => {
      if (!this.isMonitoring) return;

      try {
        const performance = await this.getCurrentPerformance();
        callback(performance);
      } catch {
        logWarning("GPU monitoring error", "GPU Estimator");
      }

      // Schedule next monitoring cycle
      setTimeout(monitor, 2000); // Every 2 seconds
    };

    monitor();
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public isWebGLSupported(): boolean {
    return this.gl !== null;
  }

  public destroy(): void {
    this.stopMonitoring();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.gl = null;
  }
}

/**
 * CPU Benchmark Web Worker
 * Performs mathematical operations to estimate CPU performance and load
 */

let isRunning = false;
let benchmarkId = null;
let baselineScore = null;
let currentScore = null;

// Mathematical operations for CPU benchmarking
function runCpuBenchmark(duration = 100) {
  const start = performance.now();
  const end = start + duration;
  let operations = 0;

  // Perform CPU-intensive mathematical operations
  while (performance.now() < end) {
    // Mix of operations to stress different CPU units
    let checksum = 0;

    // Arithmetic operations
    for (let i = 0; i < 1000; i++) {
      checksum += Math.sin(i) * Math.cos(i) * Math.sqrt(i);
      checksum += Math.pow(i % 10, 2) * Math.log(i + 1);
      checksum += Math.tan(i / 100) * Math.atan(i / 50);
    }

    // Array operations
    const arr = new Array(100).fill(0).map((_, i) => i);
    arr.sort(() => Math.random() - 0.5);
    checksum += arr.reduce((sum, val) => sum + val, 0);

    // String operations
    let str = "benchmark";
    for (let i = 0; i < 10; i++) {
      str = str.split("").reverse().join("") + i;
    }
    checksum += str.length;

    // Prevent optimization by using checksum
    if (checksum === Infinity) {
      console.log("Infinity detected");
    }

    operations++;
  }

  return operations;
}

// Establish baseline performance
function establishBaseline() {
  const iterations = 3;
  let totalScore = 0;

  for (let i = 0; i < iterations; i++) {
    totalScore += runCpuBenchmark(50); // Shorter duration for baseline
  }

  baselineScore = Math.round(totalScore / iterations);
  return baselineScore;
}

// Continuous monitoring function
function monitorCpuUsage() {
  if (!isRunning) return;

  const startTime = performance.now();
  currentScore = runCpuBenchmark(100);
  const endTime = performance.now();

  // Calculate usage based on score relative to baseline
  let cpuUsage = 0;
  if (baselineScore && currentScore) {
    // Lower score compared to baseline indicates higher system load
    const efficiency = currentScore / baselineScore;
    cpuUsage = Math.max(0, Math.min(100, (1 - efficiency) * 100 + 10));
  }

  // Post results back to main thread
  self.postMessage({
    type: "cpu-usage",
    data: {
      cpuUsage: Math.round(cpuUsage),
      score: currentScore,
      baseline: baselineScore,
      benchmarkTime: endTime - startTime,
      timestamp: Date.now(),
    },
  });

  // Schedule next measurement
  setTimeout(monitorCpuUsage, 1000); // Update every second
}

// Handle messages from main thread
self.onmessage = function (event) {
  const { type } = event.data;

  switch (type) {
    case "start":
      if (!isRunning) {
        isRunning = true;

        // Establish baseline if not already done
        if (!baselineScore) {
          self.postMessage({
            type: "status",
            data: { message: "Establishing CPU baseline..." },
          });

          establishBaseline();

          self.postMessage({
            type: "baseline-established",
            data: { baseline: baselineScore },
          });
        }

        // Start monitoring
        monitorCpuUsage();

        self.postMessage({
          type: "status",
          data: { message: "CPU monitoring started" },
        });
      }
      break;

    case "stop":
      isRunning = false;
      if (benchmarkId) {
        clearTimeout(benchmarkId);
        benchmarkId = null;
      }

      self.postMessage({
        type: "status",
        data: { message: "CPU monitoring stopped" },
      });
      break;

    case "get-hardware-info":
      // Provide hardware concurrency info
      self.postMessage({
        type: "hardware-info",
        data: {
          cores: navigator.hardwareConcurrency || 4,
          userAgent: navigator.userAgent,
          platform: navigator.platform || "unknown",
        },
      });
      break;

    case "quick-benchmark":
      // Run a quick benchmark for initial assessment
      const quickScore = runCpuBenchmark(200);
      self.postMessage({
        type: "quick-benchmark-result",
        data: { score: quickScore },
      });
      break;

    default:
      self.postMessage({
        type: "error",
        data: { message: `Unknown command: ${type}` },
      });
  }
};

// Handle worker termination
self.onclose = function () {
  isRunning = false;
  if (benchmarkId) {
    clearTimeout(benchmarkId);
  }
};

// Initialize worker
self.postMessage({
  type: "worker-ready",
  data: { message: "CPU benchmark worker initialized" },
});

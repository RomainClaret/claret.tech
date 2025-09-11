#!/usr/bin/env node

/**
 * Performance Report Generator
 * Generates comprehensive performance reports from collected data
 */

const fs = require("fs");
const path = require("path");

class PerformanceReportGenerator {
  constructor() {
    this.resultsDir = path.join(process.cwd(), "test-results");
    this.reportsDir = path.join(this.resultsDir, "performance-reports");
    this.lighthouseDir = path.join(this.resultsDir, "lighthouse");
    this.loadTestDir = path.join(this.resultsDir, "load-testing");

    // Ensure directories exist
    [this.reportsDir, this.lighthouseDir, this.loadTestDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Load performance history
  loadPerformanceHistory() {
    const historyFile = path.join(
      this.lighthouseDir,
      "performance-history.json",
    );
    if (!fs.existsSync(historyFile)) {
      return [];
    }

    try {
      const data = fs.readFileSync(historyFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.warn("Failed to load performance history:", error);
      return [];
    }
  }

  // Load cross-browser comparison
  loadCrossBrowserComparison() {
    const comparisonFile = path.join(
      this.lighthouseDir,
      "cross-browser-comparison.json",
    );
    if (!fs.existsSync(comparisonFile)) {
      return null;
    }

    try {
      const data = fs.readFileSync(comparisonFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.warn("Failed to load cross-browser comparison:", error);
      return null;
    }
  }

  // Load load testing results
  loadLoadTestResults() {
    if (!fs.existsSync(this.loadTestDir)) {
      return [];
    }

    const files = fs
      .readdirSync(this.loadTestDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        try {
          const data = fs.readFileSync(
            path.join(this.loadTestDir, file),
            "utf8",
          );
          return {
            filename: file,
            data: JSON.parse(data),
          };
        } catch (error) {
          console.warn(`Failed to load ${file}:`, error);
          return null;
        }
      })
      .filter(Boolean);

    return files;
  }

  // Generate trends analysis
  generateTrends(history, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentHistory = history
      .filter((entry) => new Date(entry.timestamp) >= cutoffDate)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    if (recentHistory.length < 2) {
      return {
        hasData: false,
        message: "Insufficient data for trend analysis",
      };
    }

    const browsers = ["chromium", "webkit", "firefox"];
    const trends = {};

    browsers.forEach((browser) => {
      const browserData = recentHistory.filter(
        (entry) => entry.browserName === browser,
      );
      if (browserData.length < 2) return;

      const first = browserData[0];
      const last = browserData[browserData.length - 1];

      trends[browser] = {
        performance: {
          change: last.scores.performance - first.scores.performance,
          trend:
            last.scores.performance > first.scores.performance
              ? "improving"
              : last.scores.performance < first.scores.performance
                ? "degrading"
                : "stable",
        },
        lcp: {
          change: last.vitals.lcp - first.vitals.lcp,
          trend:
            last.vitals.lcp < first.vitals.lcp
              ? "improving"
              : last.vitals.lcp > first.vitals.lcp
                ? "degrading"
                : "stable",
        },
        fcp: {
          change: last.vitals.fcp - first.vitals.fcp,
          trend:
            last.vitals.fcp < first.vitals.fcp
              ? "improving"
              : last.vitals.fcp > first.vitals.fcp
                ? "degrading"
                : "stable",
        },
        cls: {
          change: last.vitals.cls - first.vitals.cls,
          trend:
            last.vitals.cls < first.vitals.cls
              ? "improving"
              : last.vitals.cls > first.vitals.cls
                ? "degrading"
                : "stable",
        },
      };
    });

    return { hasData: true, trends, dataPoints: recentHistory.length };
  }

  // Generate HTML report
  generateHTMLReport(data) {
    const { crossBrowser, trends, loadTests, history, summary } = data;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report - ${new Date().toLocaleDateString()}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f8fafc; 
            color: #1e293b;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 2rem; }
        .card { 
            background: white; 
            border-radius: 8px; 
            padding: 1.5rem; 
            margin-bottom: 1.5rem; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
        .metric { text-align: center; padding: 1rem; }
        .metric-value { font-size: 2rem; font-weight: bold; margin: 0.5rem 0; }
        .metric-label { color: #64748b; font-size: 0.875rem; }
        .status-excellent { color: #10b981; }
        .status-good { color: #3b82f6; }
        .status-fair { color: #f59e0b; }
        .status-poor { color: #ef4444; }
        .trend-up { color: #10b981; }
        .trend-down { color: #ef4444; }
        .trend-stable { color: #64748b; }
        .browser-card { border-left: 4px solid #e2e8f0; }
        .browser-chromium { border-left-color: #3b82f6; }
        .browser-webkit { border-left-color: #06b6d4; }
        .browser-firefox { border-left-color: #f97316; }
        .chart-container { position: relative; height: 300px; margin: 1rem 0; }
        .recommendations { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 1rem; }
        .success { background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; }
        .warning { background: #fee2e2; border: 1px solid #ef4444; border-radius: 6px; padding: 1rem; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 600; }
        .timestamp { color: #64748b; font-size: 0.875rem; text-align: center; margin-top: 2rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Performance Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>

        <!-- Executive Summary -->
        <div class="card">
            <h2>📊 Executive Summary</h2>
            <div class="grid">
                <div class="metric">
                    <div class="metric-label">Overall Performance Score</div>
                    <div class="metric-value status-${summary.overallGrade.toLowerCase()}">${summary.avgScore.toFixed(1)}</div>
                    <div class="metric-label">${summary.overallGrade}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Best Performer</div>
                    <div class="metric-value">${crossBrowser ? crossBrowser.summary.bestPerformance : "N/A"}</div>
                    <div class="metric-label">Browser</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Critical Issues</div>
                    <div class="metric-value status-${summary.criticalIssues > 0 ? "poor" : "excellent"}">${summary.criticalIssues}</div>
                    <div class="metric-label">Issues Found</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Test Coverage</div>
                    <div class="metric-value status-good">${summary.testCount}</div>
                    <div class="metric-label">Tests Run</div>
                </div>
            </div>
        </div>

        ${
          crossBrowser
            ? `
        <!-- Cross-Browser Performance -->
        <div class="card">
            <h2>🌐 Cross-Browser Performance</h2>
            <div class="grid">
                ${Object.entries(crossBrowser.browsers)
                  .map(([browser, data]) => {
                    if (!data) return "";
                    return `
                    <div class="card browser-card browser-${browser}">
                        <h3>${browser.charAt(0).toUpperCase() + browser.slice(1)}</h3>
                        <div class="metric">
                            <div class="metric-value status-${data.scores.performance >= 90 ? "excellent" : data.scores.performance >= 80 ? "good" : data.scores.performance >= 70 ? "fair" : "poor"}">${data.scores.performance}</div>
                            <div class="metric-label">Performance Score</div>
                        </div>
                        <table>
                            <tr><th>Metric</th><th>Value</th><th>Status</th></tr>
                            <tr><td>FCP</td><td>${data.vitals.fcp.toFixed(0)}ms</td><td class="status-${data.vitals.fcp < 1800 ? "excellent" : data.vitals.fcp < 3000 ? "good" : "poor"}">${data.vitals.fcp < 1800 ? "Excellent" : data.vitals.fcp < 3000 ? "Good" : "Poor"}</td></tr>
                            <tr><td>LCP</td><td>${data.vitals.lcp.toFixed(0)}ms</td><td class="status-${data.vitals.lcp < 2500 ? "excellent" : data.vitals.lcp < 4000 ? "good" : "poor"}">${data.vitals.lcp < 2500 ? "Excellent" : data.vitals.lcp < 4000 ? "Good" : "Poor"}</td></tr>
                            <tr><td>CLS</td><td>${data.vitals.cls.toFixed(3)}</td><td class="status-${data.vitals.cls < 0.1 ? "excellent" : data.vitals.cls < 0.25 ? "good" : "poor"}">${data.vitals.cls < 0.1 ? "Excellent" : data.vitals.cls < 0.25 ? "Good" : "Poor"}</td></tr>
                        </table>
                    </div>
                  `;
                  })
                  .join("")}
            </div>
        </div>
        `
            : ""
        }

        ${
          trends.hasData
            ? `
        <!-- Performance Trends -->
        <div class="card">
            <h2>📈 Performance Trends (Last 30 Days)</h2>
            <p>${trends.dataPoints} data points analyzed</p>
            <div class="grid">
                ${Object.entries(trends.trends)
                  .map(
                    ([browser, browserTrends]) => `
                    <div class="card browser-card browser-${browser}">
                        <h3>${browser.charAt(0).toUpperCase() + browser.slice(1)} Trends</h3>
                        <table>
                            <tr><th>Metric</th><th>Change</th><th>Trend</th></tr>
                            <tr>
                                <td>Performance</td>
                                <td>${browserTrends.performance.change > 0 ? "+" : ""}${browserTrends.performance.change.toFixed(1)}</td>
                                <td class="trend-${browserTrends.performance.trend === "improving" ? "up" : browserTrends.performance.trend === "degrading" ? "down" : "stable"}">${browserTrends.performance.trend}</td>
                            </tr>
                            <tr>
                                <td>LCP</td>
                                <td>${browserTrends.lcp.change > 0 ? "+" : ""}${browserTrends.lcp.change.toFixed(0)}ms</td>
                                <td class="trend-${browserTrends.lcp.trend === "improving" ? "up" : browserTrends.lcp.trend === "degrading" ? "down" : "stable"}">${browserTrends.lcp.trend}</td>
                            </tr>
                            <tr>
                                <td>FCP</td>
                                <td>${browserTrends.fcp.change > 0 ? "+" : ""}${browserTrends.fcp.change.toFixed(0)}ms</td>
                                <td class="trend-${browserTrends.fcp.trend === "improving" ? "up" : browserTrends.fcp.trend === "degrading" ? "down" : "stable"}">${browserTrends.fcp.trend}</td>
                            </tr>
                            <tr>
                                <td>CLS</td>
                                <td>${browserTrends.cls.change > 0 ? "+" : ""}${browserTrends.cls.change.toFixed(3)}</td>
                                <td class="trend-${browserTrends.cls.trend === "improving" ? "up" : browserTrends.cls.trend === "degrading" ? "down" : "stable"}">${browserTrends.cls.trend}</td>
                            </tr>
                        </table>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        </div>
        `
            : `
        <div class="card">
            <h2>📈 Performance Trends</h2>
            <div class="recommendations">
                <p><strong>Note:</strong> ${trends.message}. Run more tests to enable trend analysis.</p>
            </div>
        </div>
        `
        }

        ${
          loadTests.length > 0
            ? `
        <!-- Load Testing Results -->
        <div class="card">
            <h2>⚡ Load Testing Results</h2>
            <p>${loadTests.length} load test(s) completed</p>
            ${loadTests
              .map(
                (test) => `
                <div class="card">
                    <h4>${test.filename}</h4>
                    <p>Test completed: ${new Date(test.data.timestamp || Date.now()).toLocaleString()}</p>
                    ${
                      test.data.analysis
                        ? `
                        <div class="${test.data.analysis.hasSignificantDegradation ? "warning" : "success"}">
                            <strong>Performance Analysis:</strong>
                            <ul>
                                <li>Load time change: ${test.data.analysis.loadTimeDegradation}%</li>
                                <li>Memory change: ${test.data.analysis.memoryDegradation}%</li>
                                ${
                                  test.data.analysis.hasSignificantDegradation
                                    ? "<li><strong>⚠️ Significant performance degradation detected</strong></li>"
                                    : "<li>✅ No significant performance degradation</li>"
                                }
                            </ul>
                        </div>
                    `
                        : ""
                    }
                </div>
            `,
              )
              .join("")}
        </div>
        `
            : ""
        }

        <!-- Recommendations -->
        <div class="card">
            <h2>💡 Recommendations</h2>
            ${
              summary.recommendations.length > 0
                ? `
                <div class="recommendations">
                    <ul>
                        ${summary.recommendations.map((rec) => `<li>${rec}</li>`).join("")}
                    </ul>
                </div>
            `
                : `
                <div class="success">
                    <p>✅ No critical performance issues detected. All metrics are within acceptable ranges.</p>
                </div>
            `
            }
        </div>

        <div class="timestamp">
            Report generated by Performance Testing Suite<br>
            Last updated: ${new Date().toISOString()}
        </div>
    </div>
</body>
</html>
    `;

    return html;
  }

  // Generate complete report
  async generateReport() {
    console.log("🚀 Generating performance report...");

    // Load all data
    const history = this.loadPerformanceHistory();
    const crossBrowser = this.loadCrossBrowserComparison();
    const loadTests = this.loadLoadTestResults();
    const trends = this.generateTrends(history);

    // Calculate summary metrics
    const summary = {
      avgScore: crossBrowser ? crossBrowser.summary.avgPerformanceScore : 0,
      overallGrade: crossBrowser
        ? crossBrowser.summary.avgPerformanceScore >= 90
          ? "Excellent"
          : crossBrowser.summary.avgPerformanceScore >= 80
            ? "Good"
            : crossBrowser.summary.avgPerformanceScore >= 70
              ? "Fair"
              : "Poor"
        : "Unknown",
      criticalIssues: crossBrowser
        ? crossBrowser.summary.criticalIssues.length
        : 0,
      testCount: history.length + loadTests.length,
      recommendations: [],
    };

    // Generate recommendations
    if (crossBrowser) {
      if (crossBrowser.summary.avgPerformanceScore < 80) {
        summary.recommendations.push(
          "Overall performance score is below 80. Focus on Core Web Vitals optimization.",
        );
      }

      if (crossBrowser.summary.criticalIssues.length > 0) {
        summary.recommendations.push(
          `${crossBrowser.summary.criticalIssues.length} critical issue(s) detected. Review browser-specific optimizations.`,
        );
      }

      // Browser-specific recommendations
      Object.entries(crossBrowser.browsers).forEach(([browser, data]) => {
        if (!data) return;

        if (data.scores.performance < 85 && browser === "webkit") {
          summary.recommendations.push(
            "Safari performance below target. Consider enabling reduced animations and optimizing backdrop-filter usage.",
          );
        }

        if (data.vitals.lcp > 3000) {
          summary.recommendations.push(
            `${browser}: LCP above 3s. Optimize image loading and reduce render-blocking resources.`,
          );
        }

        if (data.vitals.cls > 0.1) {
          summary.recommendations.push(
            `${browser}: CLS above 0.1. Fix layout shifts by specifying image dimensions and avoiding dynamic content insertion.`,
          );
        }
      });
    }

    if (trends.hasData) {
      Object.entries(trends.trends).forEach(([browser, browserTrends]) => {
        if (browserTrends.performance.trend === "degrading") {
          summary.recommendations.push(
            `${browser}: Performance trending downward. Monitor recent changes for potential regressions.`,
          );
        }
      });
    }

    if (
      loadTests.some((test) => test.data.analysis?.hasSignificantDegradation)
    ) {
      summary.recommendations.push(
        "Load testing detected performance degradation. Check for memory leaks and optimize resource usage.",
      );
    }

    const reportData = {
      crossBrowser,
      trends,
      loadTests,
      history,
      summary,
    };

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(reportData);
    const htmlPath = path.join(
      this.reportsDir,
      `performance-report-${Date.now()}.html`,
    );
    fs.writeFileSync(htmlPath, htmlReport);

    // Generate JSON report
    const jsonPath = path.join(
      this.reportsDir,
      `performance-data-${Date.now()}.json`,
    );
    fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));

    // Generate summary report (latest)
    const summaryPath = path.join(this.reportsDir, "latest-summary.json");
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          summary,
          dataAvailable: {
            crossBrowser: !!crossBrowser,
            trends: trends.hasData,
            loadTests: loadTests.length > 0,
            historyCount: history.length,
          },
        },
        null,
        2,
      ),
    );

    console.log("✅ Performance report generated successfully!");
    console.log(`📊 HTML Report: ${htmlPath}`);
    console.log(`📋 JSON Data: ${jsonPath}`);
    console.log(`📝 Summary: ${summaryPath}`);
    console.log("");
    console.log("📈 Summary:");
    console.log(
      `   Overall Score: ${summary.avgScore.toFixed(1)} (${summary.overallGrade})`,
    );
    console.log(`   Critical Issues: ${summary.criticalIssues}`);
    console.log(`   Tests Analyzed: ${summary.testCount}`);
    console.log(`   Recommendations: ${summary.recommendations.length}`);

    if (summary.recommendations.length > 0) {
      console.log("");
      console.log("🎯 Key Recommendations:");
      summary.recommendations.slice(0, 3).forEach((rec) => {
        console.log(`   • ${rec}`);
      });
    }

    return {
      htmlPath,
      jsonPath,
      summaryPath,
      summary,
    };
  }
}

// Run if called directly
if (require.main === module) {
  const generator = new PerformanceReportGenerator();
  generator
    .generateReport()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Failed to generate performance report:", error);
      process.exit(1);
    });
}

module.exports = { PerformanceReportGenerator };

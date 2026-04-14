const fs = require("fs/promises");
const path = require("path");

async function main() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const reportPath = path.join(repoRoot, "logs", "apply_flow_selftest_report.json");

  let reportRaw;
  try {
    reportRaw = await fs.readFile(reportPath, "utf8");
  } catch {
    console.error("Kein Selftest-Report gefunden.");
    console.error("Fuehre zuerst im Dev Host den Command aus: Code KI V4: Apply-Flow Selftest (S2)");
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(reportRaw);
  } catch (error) {
    console.error("Selftest-Report ist kein gueltiges JSON.");
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  }

  const scenarios = Array.isArray(report.scenarios) ? report.scenarios : [];
  const allPassed = report.success === true && scenarios.length >= 3 && scenarios.every((item) => item.passed === true);

  if (!allPassed) {
    console.error("Selftest-Report zeigt fehlgeschlagene Szenarien.");
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log("Apply-Flow-Selftest-Report gueltig und erfolgreich.");
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

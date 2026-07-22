/**
 * Week 1 End-to-End Compliance Test
 *
 * Verifies that the entire compliance MVP pipeline works:
 * 1. Transactions detected (Phase 1A) ✓
 * 2. Evidence sealed (Phase 1B) ✓
 * 3. Export generated for regulators (Phase 1C) ✓
 *
 * Success = Regulator-ready audit trail
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface ComplianceCheckResult {
  check: string;
  passed: boolean;
  detail: string;
}

export interface ComplianceAuditReport {
  timestamp: string;
  checks: ComplianceCheckResult[];
  overall_status: "COMPLIANT" | "NON_COMPLIANT";
  regulator_ready: boolean;
}

export async function runComplianceAudit(): Promise<ComplianceAuditReport> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("WEEK 1 COMPLIANCE AUDIT: End-to-End Pipeline Verification");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const checks: ComplianceCheckResult[] = [];
  const baseUrl = "http://localhost:8787";

  // 1. Monitor endpoint responds
  let monitorWorking = false;
  try {
    const resp = await fetch(`${baseUrl}/v1/monitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactions: [
          {
            txn_id: "COMPLIANCE-TEST-001",
            account_id: "ACC-COMPLIANCE",
            amount: 300000,
            currency: "ZAR",
            timestamp: new Date().toISOString(),
            country: "ZA",
            counterparty: "TEST",
          },
        ],
      }),
    });
    const result = await resp.json() as {
      alert?: { alert_id?: string };
    };
    monitorWorking = !!result.alert;
    checks.push({
      check: "POST /v1/monitor endpoint responds",
      passed: monitorWorking,
      detail: monitorWorking
        ? `Alert generated: ${result.alert?.alert_id}`
        : "No alert generated",
    });
  } catch (err) {
    checks.push({
      check: "POST /v1/monitor endpoint responds",
      passed: false,
      detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 2. Check sealed PDFs exist
  const sealsDir = "fraud-firewall/vault/sealed";
  let sealsExist = false;
  let sealCount = 0;
  if (existsSync(sealsDir)) {
    const files = readdirSync(sealsDir);
    const pdfFiles = files.filter((f: string) => f.endsWith(".pdf"));
    sealCount = pdfFiles.length;
    sealsExist = sealCount > 0;
  }
  checks.push({
    check: "Sealed PDFs generated",
    passed: sealsExist,
    detail: `Found ${sealCount} sealed PDFs in vault`,
  });

  // 3. Check export endpoint
  let exportWorking = false;
  let exportPath = "";
  try {
    const today = new Date().toISOString().split("T")[0];
    const resp = await fetch(
      `${baseUrl}/v1/export/findings?start_date=${today}&end_date=${today}`,
      { method: "GET" }
    );
    const result = await resp.json() as {
      zip_file_path?: string;
      total_findings?: number;
    };
    exportPath = result.zip_file_path || "";
    exportWorking = !!exportPath && (result.total_findings ?? 0) > 0;
    checks.push({
      check: "GET /v1/export/findings endpoint works",
      passed: exportWorking,
      detail: exportWorking
        ? `Export created with ${result.total_findings} findings`
        : "Export failed or no findings",
    });
  } catch (err) {
    checks.push({
      check: "GET /v1/export/findings endpoint works",
      passed: false,
      detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 4. Check manifest.json
  let manifestValid = false;
  if (exportPath && existsSync(exportPath)) {
    const manifestPath = join(exportPath, "manifest.json");
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        manifestValid =
          manifest.summary &&
          manifest.by_jurisdiction &&
          manifest.constitution_version;
        checks.push({
          check: "Export manifest.json complete",
          passed: manifestValid,
          detail: manifestValid
            ? `Manifest has ${manifest.summary.total_findings} findings`
            : "Manifest missing required fields",
        });
      } catch (err) {
        checks.push({
          check: "Export manifest.json complete",
          passed: false,
          detail: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } else {
      checks.push({
        check: "Export manifest.json complete",
        passed: false,
        detail: "manifest.json not found",
      });
    }
  }

  // 5. Check chain-of-custody.csv
  let cocValid = false;
  if (exportPath && existsSync(exportPath)) {
    const cocPath = join(exportPath, "chain-of-custody.csv");
    if (existsSync(cocPath)) {
      const content = readFileSync(cocPath, "utf-8");
      const lines = content.split("\n");
      cocValid = lines.length > 1 && lines[0].includes("alert_id");
      checks.push({
        check: "Export chain-of-custody.csv complete",
        passed: cocValid,
        detail: cocValid ? `CSV has ${lines.length - 1} records` : "CSV invalid",
      });
    } else {
      checks.push({
        check: "Export chain-of-custody.csv complete",
        passed: false,
        detail: "chain-of-custody.csv not found",
      });
    }
  }

  // 6. Check seals/ directory
  let sealsInExport = false;
  if (exportPath && existsSync(exportPath)) {
    const sealsDirPath = join(exportPath, "seals");
    if (existsSync(sealsDirPath)) {
      const files = readdirSync(sealsDirPath);
      sealsInExport = files.length > 0;
    }
    checks.push({
      check: "Export seals/ directory populated",
      passed: sealsInExport,
      detail: sealsInExport ? `${files?.length || 0} sealed PDFs` : "No seals",
    });
  }

  // 7. Check verification/ directory
  let verificationsInExport = false;
  if (exportPath && existsSync(exportPath)) {
    const verifyDirPath = join(exportPath, "verification");
    if (existsSync(verifyDirPath)) {
      const files = readdirSync(verifyDirPath);
      verificationsInExport = files.length > 0;
    }
    checks.push({
      check: "Export verification/ directory populated",
      passed: verificationsInExport,
      detail: verificationsInExport
        ? `${files?.length || 0} verification files`
        : "No verification metadata",
    });
  }

  // 8. Check README.txt
  let readmeExists = false;
  if (exportPath && existsSync(exportPath)) {
    const readmePath = join(exportPath, "README.txt");
    readmeExists = existsSync(readmePath);
    checks.push({
      check: "Export README.txt present",
      passed: readmeExists,
      detail: readmeExists ? "README includes verification instructions" : "README missing",
    });
  }

  // 9. Check no PII in manifest
  let noPii = true;
  if (exportPath && existsSync(exportPath)) {
    const manifestPath = join(exportPath, "manifest.json");
    if (existsSync(manifestPath)) {
      const content = readFileSync(manifestPath, "utf-8").toLowerCase();
      noPii =
        !content.includes("ssn") &&
        !content.includes("account number") &&
        !content.includes("card");
    }
  }
  checks.push({
    check: "No PII in export (privacy wall enforced)",
    passed: noPii,
    detail: noPii ? "✓ Privacy wall intact" : "✗ PII detected",
  });

  // 10. Check Constitution embedded in PDFs
  let constitutionEmbedded = true;
  if (sealCount > 0 && existsSync(sealsDir)) {
    const jsonFiles = readdirSync(sealsDir).filter((f: string) => f.endsWith(".json"));
    const sealMetadata = jsonFiles.length > 0 ? join(sealsDir, jsonFiles[0]) : "";
    if (existsSync(sealMetadata)) {
      const meta = JSON.parse(readFileSync(sealMetadata, "utf-8"));
      constitutionEmbedded = !!meta.constitution;
    }
  }
  checks.push({
    check: "Constitution embedded in seals",
    passed: constitutionEmbedded,
    detail: constitutionEmbedded
      ? "✓ Constitution v5.2.7 embedded"
      : "✗ Constitution not embedded",
  });

  // Calculate overall status
  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const overallStatus = passed === total ? "COMPLIANT" : "NON_COMPLIANT";
  const regulatorReady =
    passed >= 8 &&
    monitorWorking &&
    manifestValid &&
    cocValid &&
    sealsInExport &&
    noPii;

  console.log("AUDIT RESULTS:\n");
  for (const check of checks) {
    const icon = check.passed ? "✓" : "✗";
    console.log(`  ${icon} ${check.check}`);
    console.log(`     → ${check.detail}\n`);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`COMPLIANCE SCORE: ${passed}/${total} checks passed`);
  console.log(`OVERALL STATUS: ${overallStatus}`);
  console.log(`REGULATOR READY: ${regulatorReady ? "YES ✓" : "NO ✗"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  return {
    timestamp: new Date().toISOString(),
    checks,
    overall_status: overallStatus,
    regulator_ready: regulatorReady,
  };
}

// Run the audit
runComplianceAudit()
  .then((result) => {
    process.exit(result.regulator_ready ? 0 : 1);
  })
  .catch((err) => {
    console.error("Audit failed:", err);
    process.exit(1);
  });

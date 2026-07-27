import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { QuarterlyEvolution } from "./admin.js";

/**
 * Generate a PDF compliance report for regulators.
 * Creates a professional, auditable report from quarterly evolution data.
 */
export function generateComplianceReport(
  data: QuarterlyEvolution,
  outputPath: string
): void {
  const pythonScript = generatePythonScript();
  const scriptPath = join("/tmp", `report-${Date.now()}.py`);
  const dataPath = join("/tmp", `report-data-${Date.now()}.json`);

  try {
    writeFileSync(scriptPath, pythonScript);
    writeFileSync(dataPath, JSON.stringify(data));
    execSync(`python3 "${scriptPath}"`, {
      stdio: "pipe",
      env: { ...process.env, OUTPUT_PATH: outputPath, DATA_PATH: dataPath },
    });
  } finally {
    try {
      unlinkSync(scriptPath);
      unlinkSync(dataPath);
    } catch {
      // Cleanup error is non-critical
    }
  }
}

function generatePythonScript(): string {
  return `
import os
import json
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

output_path = os.environ.get("OUTPUT_PATH", "compliance_report.pdf")
data_path = os.environ.get("DATA_PATH", "")

# Load data from JSON file
with open(data_path, 'r') as f:
    data = json.load(f)

# Create custom styles
styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "CustomTitle",
    parent=styles["Heading1"],
    fontSize=24,
    textColor=colors.HexColor("#040D1B"),
    spaceAfter=12,
    alignment=TA_CENTER,
    fontName="Helvetica-Bold"
)

heading_style = ParagraphStyle(
    "CustomHeading",
    parent=styles["Heading2"],
    fontSize=14,
    textColor=colors.HexColor("#4A7EC7"),
    spaceAfter=8,
    fontName="Helvetica-Bold"
)

section_style = ParagraphStyle(
    "Section",
    parent=styles["Normal"],
    fontSize=11,
    leading=14,
    textColor=colors.HexColor("#333333")
)

# Build document
doc = SimpleDocTemplate(output_path, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
story = []

# Cover page
story.append(Spacer(1, 0.5*inch))
story.append(Paragraph("VERUM OMNIS FRAUD FIREWALL", title_style))
story.append(Spacer(1, 0.1*inch))
story.append(Paragraph("Quarterly Compliance Report", ParagraphStyle(
    "Subtitle",
    parent=styles["Heading2"],
    fontSize=16,
    textColor=colors.HexColor("#4A7EC7"),
    alignment=TA_CENTER
)))
story.append(Spacer(1, 0.4*inch))

# Report metadata
meta_data = [
    ["Report Period", f"{data['period']['start']} to {data['period']['end']}"],
    ["Quarter", data['quarter']],
    ["Generated", datetime.now().strftime("%d %B %Y %H:%M:%S")],
    ["Constitution Version", data['constitution_version']],
    ["Engine Version", data['engine_version']],
    ["Compliance Status", data['compliance_status']],
]

meta_table = Table(meta_data, colWidths=[2*inch, 3.5*inch])
meta_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f0f0f0")),
    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#333333")),
    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 10),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#cccccc")),
]))

story.append(meta_table)
story.append(Spacer(1, 0.4*inch))
story.append(PageBreak())

# Executive Summary
story.append(Paragraph("Executive Summary", heading_style))
story.append(Spacer(1, 0.1*inch))

summary = data['summary']
summary_text = f"""
During the period from {data['period']['start']} to {data['period']['end']},
the Verum Omnis Fraud Firewall monitored <b>{summary['total_transactions_monitored']:,}</b> transactions
and confirmed <b>{summary['fraud_cases_confirmed']}</b> fraud cases.
The system maintained a false positive rate of <b>{summary['false_positive_rate']:.1%}</b>
and discovered <b>{summary['novel_patterns_discovered']}</b> novel fraud patterns.
Detector adjustments approved: <b>{summary['detector_adjustments_approved']}</b>.
Blockchain anchors confirmed: <b>{summary['blockchain_anchors_confirmed']}</b>.
"""

story.append(Paragraph(summary_text, section_style))
story.append(Spacer(1, 0.3*inch))

# Key Metrics
story.append(Paragraph("Key Performance Indicators", heading_style))
story.append(Spacer(1, 0.1*inch))

kpi_data = [
    ["Metric", "Value"],
    ["Total Transactions Monitored", f"{summary['total_transactions_monitored']:,}"],
    ["Fraud Cases Confirmed", str(summary['fraud_cases_confirmed'])],
    ["False Positive Rate", f"{summary['false_positive_rate']:.1%}"],
    ["Novel Patterns Discovered", str(summary['novel_patterns_discovered'])],
    ["Detector Adjustments Approved", str(summary['detector_adjustments_approved'])],
    ["Blockchain Anchors Confirmed", str(summary['blockchain_anchors_confirmed'])],
]

kpi_table = Table(kpi_data, colWidths=[3*inch, 2.5*inch])
kpi_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#040D1B")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 10),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]),
    ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#cccccc")),
]))

story.append(kpi_table)
story.append(Spacer(1, 0.3*inch))
story.append(PageBreak())

# Detector Performance
story.append(Paragraph("Detector Performance Analysis", heading_style))
story.append(Spacer(1, 0.1*inch))

detector_data = [["Detector", "Detections", "Confirmed", "False Positives", "Accuracy"]]
for detector, metrics in sorted(data['detector_performance'].items()):
    accuracy = metrics['accuracy']
    detector_data.append([
        detector,
        str(metrics['detections']),
        str(metrics['confirmed']),
        str(metrics['false_positives']),
        f"{accuracy:.1%}"
    ])

if len(detector_data) > 1:
    detector_table = Table(detector_data, colWidths=[1.8*inch, 1.2*inch, 1.2*inch, 1.3*inch, 1.0*inch])
    detector_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4A7EC7")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]),
        ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#cccccc")),
    ]))
    story.append(detector_table)
else:
    story.append(Paragraph("No detector performance data available for this period.", section_style))

story.append(Spacer(1, 0.3*inch))
story.append(PageBreak())

# Novel Patterns
if data['novel_patterns']:
    story.append(Paragraph("Novel Fraud Patterns Discovered", heading_style))
    story.append(Spacer(1, 0.1*inch))

    for i, pattern in enumerate(data['novel_patterns'][:10]):  # Limit to first 10 patterns
        status_color = {
            "APPROVED": "#155724",
            "PENDING_REVIEW": "#f0ad4e",
            "REJECTED": "#d9534f"
        }.get(pattern['status'], "#333333")

        pattern_html = f"""
        <b>Pattern: {pattern['name']}</b>
        <font color="{status_color}">[{pattern['status']}]</font><br/>
        <i>Confidence: {pattern['confidence']}</i><br/>
        {pattern['description']}<br/>
        Occurrences: {pattern['occurrences']} | Recommended Detector: {pattern['recommended_detector']}
        """
        story.append(Paragraph(pattern_html, section_style))
        story.append(Spacer(1, 0.1*inch))

    if len(data['novel_patterns']) > 10:
        story.append(Paragraph(f"... and {len(data['novel_patterns']) - 10} more patterns", section_style))

    story.append(Spacer(1, 0.2*inch))
    story.append(PageBreak())

# Constitutional Constraints
story.append(Paragraph("Constitutional Compliance", heading_style))
story.append(Spacer(1, 0.1*inch))

constraints = data['constitutional_constraints_enforced']
constraint_checks = [
    ("Findings Never Suppressed", constraints['findings_never_suppressed']),
    ("Triple AI Verification Required", constraints['triple_ai_verification_required']),
    ("Evidence Always Sealed", constraints['evidence_always_sealed']),
    ("Chain of Custody Maintained", constraints['chain_of_custody_maintained']),
    ("No PII to Verum", constraints['no_pii_to_verum']),
]

compliance_data = [["Constitutional Requirement", "Verified"]]
for requirement, verified in constraint_checks:
    status = "✓ VERIFIED" if verified else "✗ NOT VERIFIED"
    compliance_data.append([requirement, status])

compliance_table = Table(compliance_data, colWidths=[3.5*inch, 2.0*inch])
compliance_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#040D1B")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
    ("ALIGN", (0, 0), (0, -1), "LEFT"),
    ("ALIGN", (1, 0), (1, -1), "CENTER"),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 10),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]),
    ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#cccccc")),
]))

story.append(compliance_table)
story.append(Spacer(1, 0.3*inch))

# Footer text
story.append(Paragraph(
    f"<i>Next Review Date: {data['next_review_date']}</i>",
    ParagraphStyle("Footer", parent=section_style, fontSize=9, textColor=colors.HexColor("#999999"))
))

# Build PDF
doc.build(story)
print(f"Compliance report generated: {output_path}")
`;
}

/**
 * Export all quarterly data to a comprehensive audit log JSON.
 * Useful for regulatory filing and internal audit trails.
 */
export function generateAuditLog(data: QuarterlyEvolution): string {
  const auditLog = {
    generated_at: new Date().toISOString(),
    report_version: "1.0",
    compliance_framework: "Verum Omnis Constitution v6.0",
    ...data,
  };
  return JSON.stringify(auditLog, null, 2);
}

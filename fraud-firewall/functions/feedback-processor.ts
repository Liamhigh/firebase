/**
 * Firebase Cloud Functions - Feedback Processor
 *
 * Processes contradiction feedback from Android devices and webdocsol,
 * coordinates rule evolution, and distributes updates across all installations.
 *
 * This is the backend orchestrator for the hybrid forensic engine learning loop.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface FeedbackPacket {
  packetId: string;
  caseReference: string;
  contradictions: Contradiction[];
  jurisdiction: string;
  timestamp: string;
  deviceHash: string;
  constitutionVersion: string;
}

interface Contradiction {
  contradictionId: string;
  description: string;
  respondent: string;
  evidenceAnchor: string;
  legalSignificance: string;
  confidence: string;
  foundAt: string;
}

interface RuleUpdate {
  ruleId: string;
  type: string;
  pattern: string;
  confidence: string;
  jurisdiction: string;
  applicableFrom: string;
  sourceCase: string;
  reason: string;
}

interface EngineEvolution {
  evolutionId: string;
  newRulesAdded: RuleUpdate[];
  rulesUpdated: RuleUpdate[];
  timestamp: string;
  criminalThreatLevel: string;
  jurisdiction: string;
}

export const processFeedbackPacket = functions.https.onRequest(
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method not allowed");
      return;
    }

    try {
      const packet: FeedbackPacket = request.body;

      // Validate packet
      if (!validatePacket(packet)) {
        response.status(400).json({
          status: "INVALID_PACKET",
          message: "Feedback packet validation failed",
        });
        return;
      }

      // Store feedback packet
      const db = admin.firestore();
      const packetRef = db
        .collection("feedback")
        .collection(packet.jurisdiction)
        .doc(packet.packetId);

      await packetRef.set({
        ...packet,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "PENDING_REVIEW",
        processed: false,
      });

      // Process contradictions and extract rule candidates
      const rulesCandidates = extractRuleCandidates(packet);

      // Store rule candidates
      for (const rule of rulesCandidates) {
        await db
          .collection("rule_candidates")
          .doc(`${packet.jurisdiction}_${rule.ruleId}`)
          .set(rule);
      }

      // Notify verification hub on webdocsol
      await notifyVerificationHub(packet);

      response.json({
        status: "PACKET_ACCEPTED",
        packetId: packet.packetId,
        contradictionsReceived: packet.contradictions.length,
        ruleCandidatesExtracted: rulesCandidates.length,
      });
    } catch (error) {
      console.error("Error processing feedback packet:", error);
      response.status(500).json({
        status: "ERROR",
        message: "Failed to process feedback packet",
      });
    }
  }
);

export const getRuleUpdates = functions.https.onRequest(
  async (request, response) => {
    const jurisdiction = request.query.jurisdiction as string;
    const since = request.query.since as string;

    if (!jurisdiction) {
      response.status(400).json({
        status: "MISSING_JURISDICTION",
        message: "jurisdiction query parameter required",
      });
      return;
    }

    try {
      const db = admin.firestore();
      const sinceDate = since ? new Date(since) : new Date(Date.now() - 86400000); // 24h ago

      // Fetch approved rules for jurisdiction
      const approvedRules = await db
        .collection("rules")
        .where("jurisdiction", "==", jurisdiction)
        .where("approvedAt", ">", sinceDate)
        .where("status", "==", "ACTIVE")
        .get();

      const rules: RuleUpdate[] = [];
      approvedRules.forEach((doc) => {
        rules.push(doc.data() as RuleUpdate);
      });

      // Fetch deprecated rules
      const deprecatedRules = await db
        .collection("rules")
        .where("jurisdiction", "==", jurisdiction)
        .where("deprecatedAt", ">", sinceDate)
        .where("status", "==", "DEPRECATED")
        .get();

      const deprecated: string[] = [];
      deprecatedRules.forEach((doc) => {
        deprecated.push(doc.id);
      });

      response.json({
        status: "OK",
        jurisdiction: jurisdiction,
        timestamp: new Date().toISOString(),
        rules: rules,
        deprecatedRules: deprecated,
        count: rules.length,
      });
    } catch (error) {
      console.error("Error fetching rule updates:", error);
      response.status(500).json({
        status: "ERROR",
        message: "Failed to fetch rule updates",
      });
    }
  }
);

export const evolveEngineRules = functions.firestore
  .document("rule_candidates/{ruleId}")
  .onWrite(async (change, context) => {
    const ruleCandidate = change.after.data();

    if (!ruleCandidate || !ruleCandidate.verified) {
      return; // Not yet verified
    }

    const db = admin.firestore();
    const jurisdiction = ruleCandidate.jurisdiction;

    // Check if similar rule already exists
    const existingRules = await db
      .collection("rules")
      .where("pattern", "==", ruleCandidate.pattern)
      .where("jurisdiction", "==", jurisdiction)
      .limit(1)
      .get();

    if (!existingRules.empty) {
      // Update existing rule
      const existingRule = existingRules.docs[0];
      await existingRule.ref.update({
        confidence: upgradeConfidence(
          existingRule.data().confidence,
          ruleCandidate.confidence
        ),
        occurrences: admin.firestore.FieldValue.increment(1),
        lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Updated existing rule: ${existingRule.id}`);
    } else {
      // Create new rule
      const newRule: RuleUpdate = {
        ruleId: `R-${Date.now()}`,
        type: ruleCandidate.type,
        pattern: ruleCandidate.pattern,
        confidence: ruleCandidate.confidence,
        jurisdiction: jurisdiction,
        applicableFrom: new Date().toISOString(),
        sourceCase: ruleCandidate.sourceCase,
        reason: `Extracted from verified contradiction: ${ruleCandidate.description}`,
      };

      const ruleRef = db
        .collection("rules")
        .doc(`${jurisdiction}_${newRule.ruleId}`);
      await ruleRef.set({
        ...newRule,
        status: "ACTIVE",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        occurrences: 1,
      });

      console.log(`Created new rule: ${newRule.ruleId}`);

      // Broadcast rule update to all devices
      await broadcastRuleUpdate(jurisdiction, [newRule]);
    }
  });

export const trackContradictionEvolution = functions.firestore
  .document("verified_contradictions/{contradictionId}")
  .onCreate(async (snap, context) => {
    const contradiction = snap.data();
    const db = admin.firestore();

    // Look for similar contradictions in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const similarContradictions = await db
      .collection("verified_contradictions")
      .where(
        "legalSignificance",
        "==",
        contradiction.legalSignificance
      )
      .where("jurisdiction", "==", contradiction.jurisdiction)
      .where("verifiedAt", ">", thirtyDaysAgo)
      .get();

    if (similarContradictions.size > 3) {
      // Threat escalation detected
      const evolution: EngineEvolution = {
        evolutionId: `EVO-${Date.now()}`,
        newRulesAdded: [],
        rulesUpdated: [],
        timestamp: new Date().toISOString(),
        criminalThreatLevel: "ESCALATING",
        jurisdiction: contradiction.jurisdiction,
      };

      await db
        .collection("engine_evolutions")
        .doc(evolution.evolutionId)
        .set(evolution);

      console.log(
        `Threat escalation detected in ${contradiction.jurisdiction}: ${similarContradictions.size} similar contradictions`
      );

      // Notify stakeholders
      await sendThreatNotification(
        contradiction.jurisdiction,
        similarContradictions.size
      );
    }
  });

function validatePacket(packet: FeedbackPacket): boolean {
  return !!(
    packet.packetId &&
    packet.caseReference &&
    packet.jurisdiction &&
    packet.deviceHash &&
    packet.contradictions &&
    packet.contradictions.length > 0
  );
}

function extractRuleCandidates(packet: FeedbackPacket): RuleUpdate[] {
  return packet.contradictions.map((contradiction, index) => ({
    ruleId: `RC-${packet.packetId}-${index}`,
    type: contradiction.legalSignificance,
    pattern: contradiction.description,
    confidence: contradiction.confidence,
    jurisdiction: packet.jurisdiction,
    applicableFrom: new Date().toISOString(),
    sourceCase: packet.caseReference,
    reason: `Extracted from device feedback: ${contradiction.description}`,
  }));
}

function upgradeConfidence(
  existing: string,
  verified: string
): string {
  const levels: Record<string, number> = {
    LOW: 1,
    MODERATE: 2,
    HIGH: 3,
    VERY_HIGH: 4,
  };
  const names = ["LOW", "MODERATE", "HIGH", "VERY_HIGH"];
  const existingLevel = levels[existing] || 1;
  const verifiedLevel = levels[verified] || 1;
  const newLevel = Math.max(existingLevel, verifiedLevel);
  return names[Math.min(newLevel, names.length - 1)];
}

async function notifyVerificationHub(packet: FeedbackPacket) {
  // In production: Call webdocsol API to notify verification hub
  console.log(
    `Notifying verification hub of packet ${packet.packetId} with ${packet.contradictions.length} contradictions`
  );
  // POST to https://verumglobal.foundation/api/feedback
}

async function broadcastRuleUpdate(jurisdiction: string, rules: RuleUpdate[]) {
  const db = admin.firestore();

  // Store rule broadcast event
  await db
    .collection("rule_broadcasts")
    .doc(`${jurisdiction}_${Date.now()}`)
    .set({
      jurisdiction: jurisdiction,
      rulesUpdated: rules.length,
      timestamp: new Date().toISOString(),
      status: "PENDING",
    });

  console.log(
    `Broadcasting ${rules.length} rule updates for jurisdiction ${jurisdiction}`
  );
}

async function sendThreatNotification(
  jurisdiction: string,
  contradictionCount: number
) {
  // In production: Send email to admins
  console.log(
    `Threat notification: ${contradictionCount} similar contradictions in ${jurisdiction}`
  );
}

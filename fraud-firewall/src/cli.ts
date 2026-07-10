#!/usr/bin/env node
import { loadConfig } from "./core/config.js";
import { FraudFirewall, demoTransactions } from "./pipeline/firewall.js";
import { startServer } from "./api/server.js";
import { ensureVault } from "./storage/vault.js";

async function main(): Promise<void> {
  const [cmd = "help", ...rest] = process.argv.slice(2);
  const config = loadConfig();
  ensureVault(config);
  const firewall = new FraudFirewall(config);

  switch (cmd) {
    case "serve": {
      startServer(firewall);
      break;
    }
    case "demo": {
      const txns = demoTransactions();
      console.log(`Running demo with ${txns.length} transactions...`);
      const result = await firewall.monitor(txns);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "credits": {
      if (rest[0] === "add") {
        const amount = Number(rest[1]);
        const paymentRef = rest[2] ?? "MANUAL";
        const ledger = firewall.addSealCredits(amount, paymentRef);
        console.log(JSON.stringify(ledger, null, 2));
      } else {
        console.log(JSON.stringify(firewall.getCredits(), null, 2));
      }
      break;
    }
    case "seal": {
      const [documentReference, title, ...bodyParts] = rest;
      if (!documentReference || !title || bodyParts.length === 0) {
        console.error("Usage: vo-firewall seal <docRef> <title> <body...>");
        process.exit(1);
      }
      const sealed = await firewall.sealDocument({
        documentReference,
        title,
        bodyText: bodyParts.join(" "),
      });
      console.log(JSON.stringify(sealed.seal, null, 2));
      break;
    }
    case "help":
    default:
      console.log(`Verum Omnis Guardian Fraud Firewall v${config.constitution_version}

Commands:
  serve                 Start HTTP API (default port ${config.server.port})
  demo                  Run end-to-end fraud detection demo
  credits               Show seal credit ledger
  credits add <n> <ref> Add seal credits with payment proof
  seal <ref> <title> <body...>
                        Seal an arbitrary document

Env:
  VO_FIREWALL_CONFIG    Path to firewall.json
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";

export interface ModelConfig {
  name: string;
  type: "gemma" | "mistral" | "phi";
  format: "onnx" | "safetensors" | "gguf";
  size_mb: number;
  version: string;
  loaded: boolean;
  initialized_at?: string;
}

export interface DeploymentConfig {
  models_dir: string;
  vault_dir: string;
  port: number;
  institution_name: string;
  jurisdiction: string;
  constitution_version: string;
  models: ModelConfig[];
}

/**
 * Model loader for bank server deployments.
 * Verifies all required models are present and loaded.
 */
export class ModelLoader {
  private modelStates = new Map<string, ModelConfig>();

  constructor(private readonly deployment: DeploymentConfig) {}

  loadModels(): { success: boolean; missing: string[]; loaded: ModelConfig[] } {
    const required = ["gemma3", "gemma4", "mistral-instruct"];
    const missing: string[] = [];
    const loaded: ModelConfig[] = [];

    for (const modelName of required) {
      const modelPath = join(this.deployment.models_dir, modelName);

      if (!existsSync(modelPath)) {
        missing.push(modelName);
        continue;
      }

      const config = this.detectModel(modelName, modelPath);
      if (config) {
        this.modelStates.set(modelName, {
          ...config,
          loaded: true,
          initialized_at: new Date().toISOString(),
        });
        loaded.push(this.modelStates.get(modelName)!);
      } else {
        missing.push(modelName);
      }
    }

    const allLoaded = missing.length === 0 && loaded.length === 3;
    return { success: allLoaded, missing, loaded };
  }

  private detectModel(name: string, path: string): ModelConfig | null {
    const files = readdirSync(path);

    // Check for ONNX model
    const onnxFile = files.find((f) => f.endsWith(".onnx"));
    if (onnxFile) {
      return {
        name,
        type: this.getModelType(name),
        format: "onnx",
        size_mb: this.estimateSizeMb(path),
        version: this.detectVersion(name, path),
        loaded: false,
      };
    }

    // Check for SafeTensors
    const stFile = files.find((f) => f.endsWith(".safetensors"));
    if (stFile) {
      return {
        name,
        type: this.getModelType(name),
        format: "safetensors",
        size_mb: this.estimateSizeMb(path),
        version: this.detectVersion(name, path),
        loaded: false,
      };
    }

    // Check for GGUF
    const ggufFile = files.find((f) => f.endsWith(".gguf"));
    if (ggufFile) {
      return {
        name,
        type: this.getModelType(name),
        format: "gguf",
        size_mb: this.estimateSizeMb(path),
        version: this.detectVersion(name, path),
        loaded: false,
      };
    }

    return null;
  }

  private getModelType(name: string): "gemma" | "mistral" | "phi" {
    if (name.includes("gemma")) return "gemma";
    if (name.includes("mistral")) return "mistral";
    return "phi";
  }

  private estimateSizeMb(path: string): number {
    // In production, actually calculate from model file size
    // For now return approximate sizes
    return 2048; // Placeholder
  }

  private detectVersion(name: string, path: string): string {
    const metadataPath = join(path, "VERSION");
    if (existsSync(metadataPath)) {
      // Would read actual version
    }
    return "1.0"; // Default
  }

  getLoadedModels(): ModelConfig[] {
    return Array.from(this.modelStates.values());
  }

  isReady(): boolean {
    return (
      this.modelStates.size === 3 &&
      Array.from(this.modelStates.values()).every((m) => m.loaded)
    );
  }
}

export function initializeDeploymentConfig(
  overrides?: Partial<DeploymentConfig>,
): DeploymentConfig {
  // Jurisdiction is REQUIRED - do not default to "ZA"
  const jurisdiction = process.env.JURISDICTION;
  if (!jurisdiction) {
    throw new Error(
      "JURISDICTION environment variable is required. " +
        "Set JURISDICTION in .env (e.g., ZA, US, EU, UK, AE)"
    );
  }

  const baseConfig: DeploymentConfig = {
    models_dir:
      process.env.FIREWALL_MODELS_DIR || "/opt/verum-firewall/models",
    vault_dir:
      process.env.FIREWALL_VAULT_DIR ||
      "/opt/verum-firewall/vault",
    port: parseInt(process.env.FIREWALL_PORT || "8787"),
    institution_name: process.env.INSTITUTION_NAME || "Bank",
    jurisdiction,
    constitution_version: "6.0.0",
    models: [],
  };

  return { ...baseConfig, ...overrides };
}

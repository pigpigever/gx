import chalk from "chalk";
import { select, input, password, confirm } from "@inquirer/prompts";
import { loadConfig, saveConfig } from "@/lib/config-store.js";
import { AI_PROVIDERS, testAiConnection } from "@/lib/ai.js";
import { startSpinner, succeed, fail } from "@/lib/spinner.js";
import * as out from "@/lib/output.js";
import { t } from "@/lib/i18n.js";

export async function runAiConfig(): Promise<void> {
  const config = loadConfig();
  const existing = config.ai;

  // Step 1: Select provider
  console.log(chalk.bold(t("aiConfig.selectProvider")));
  out.blank();

  const provider = await select({
    message: t("aiConfig.providerPrompt"),
    choices: AI_PROVIDERS.map((p) => ({
      name: p.name,
      value: p.value,
    })),
  });

  const preset = AI_PROVIDERS.find((p) => p.value === provider)!;

  // Step 2: Endpoint (only for custom)
  let endpoint = preset.endpoint;
  if (provider === "custom") {
    endpoint = await input({
      message: t("aiConfig.endpointPrompt"),
      default: existing?.endpoint || "",
      validate: (v) => v.length > 0 || t("aiConfig.endpointRequired"),
    });
  }

  // Step 3: API Key (skip for free models like opencode)
  let apiKey = "";
  if (!preset.free) {
    console.log("");
    apiKey = await password({
      message: t("aiConfig.apiKeyPrompt"),
      mask: "*",
      validate: (v) => v.length > 0 || t("aiConfig.apiKeyRequired"),
    });
  }

  // Step 4: Model
  const model = await input({
    message: t("aiConfig.modelPrompt"),
    default: existing?.model || preset.model,
  });

  // Step 5: Test connection
  console.log("");
  const testConnection = await confirm({
    message: t("aiConfig.testPrompt"),
    default: true,
  });

  if (testConnection) {
    const spinner = startSpinner(t("aiConfig.testing"));
    const result = await testAiConnection(endpoint, apiKey, model);

    if (result.success) {
      succeed(spinner, t("aiConfig.testSuccess", { response: result.message }));
    } else {
      fail(spinner, t("aiConfig.testFailed", { error: result.message }));
      const proceed = await confirm({
        message: t("aiConfig.saveAnyway"),
        default: false,
      });
      if (!proceed) {
        out.info(t("aiConfig.aborted"));
        return;
      }
    }
  }

  // Step 6: Save
  console.log("");
  const save = await confirm({
    message: t("aiConfig.savePrompt"),
    default: true,
  });

  if (!save) {
    out.info(t("aiConfig.aborted"));
    return;
  }

  config.ai = { provider, model, endpoint, apiKey };
  saveConfig(config);

  out.blank();
  out.success(t("aiConfig.saved"));
  console.log(chalk.dim(t("aiConfig.configPath", { path: "~/.config/gx/config.yaml" })));
  out.blank();
}

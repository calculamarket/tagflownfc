#!/usr/bin/env node
/**
 * Servidor MCP local do 3D QR — roda na SUA máquina (não na nuvem).
 *
 * Fluxo: gera o modelo 3D do QR Code -> fatia com o Orca Slicer CLI
 * (ou Anycubic Slicer Next, que é um fork do Orca e aceita as mesmas flags)
 * -> entrega o G-code numa pasta (cartão SD / pendrive) ou envia para uma
 * impressora Moonraker/Klipper na rede local.
 *
 * Transporte: stdio. Configure no cliente MCP (Claude Desktop, Cursor, etc.)
 * ou exponha via `mcp-remote` para adicionar em Connectors → New MCP server.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readdir, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildQr3mf, buildQrStl } from "./qr3d.js";

const run = promisify(execFile);

// ---------------------------------------------------------------- config ---

const CONFIG_PATH = process.env.TAGFLOW_MCP_CONFIG
  ? path.resolve(process.env.TAGFLOW_MCP_CONFIG)
  : path.join(os.homedir(), ".3dqr-mcp.json");

const DEFAULTS = {
  // Caminho do executável do fatiador.
  //   Windows: C:\\Program Files\\OrcaSlicer\\orca-slicer.exe
  //   macOS:   /Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer
  //   Linux:   /usr/bin/orca-slicer  (ou o AppImage)
  slicerPath: "",
  // Pasta com os perfis exportados do fatiador (.json de máquina/processo/filamento).
  profilesDir: "",
  // Onde os modelos e G-codes são gravados.
  outputDir: path.join(os.homedir(), "3dqr-output"),
  // Pasta do cartão SD / pendrive da impressora (opcional).
  printerDropDir: "",
  // Moonraker/Klipper na rede local (opcional), ex.: http://192.168.0.50
  moonrakerUrl: "",
  moonrakerApiKey: "",
  // Base pública das etiquetas.
  tagBaseUrl: "https://www.3dqr.com.br/t/",
  // Perfis nomeados: { "kobra-x": { machine, process, filaments: [] } }
  printers: {},
};

async function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
    return { ...DEFAULTS, ...raw };
  } catch (e) {
    throw new Error(`Config inválida em ${CONFIG_PATH}: ${e.message}`);
  }
}

const text = (t) => ({ content: [{ type: "text", text: t }] });
const fail = (t) => ({ content: [{ type: "text", text: t }], isError: true });

function safeName(s) {
  return (s || "qr").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60) || "qr";
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
  return dir;
}

// ----------------------------------------------------------------- tools ---

const server = new McpServer({ name: "3d-qr-slicer", version: "0.1.0" });

server.registerTool(
  "get_config",
  {
    title: "Ver configuração",
    description:
      "Mostra a configuração atual do servidor (caminho do fatiador, perfis, pastas de saída e impressoras).",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    const cfg = await loadConfig();
    const redacted = { ...cfg, moonrakerApiKey: cfg.moonrakerApiKey ? "***" : "" };
    return text(
      `Config (${CONFIG_PATH}):\n${JSON.stringify(redacted, null, 2)}\n\n` +
        `Fatiador encontrado: ${cfg.slicerPath && existsSync(cfg.slicerPath) ? "sim" : "NÃO"}`,
    );
  },
);

server.registerTool(
  "list_profiles",
  {
    title: "Listar perfis do fatiador",
    description:
      "Lista os perfis (.json/.ini) disponíveis na pasta de perfis e as impressoras nomeadas na config.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    const cfg = await loadConfig();
    let files = [];
    if (cfg.profilesDir && existsSync(cfg.profilesDir)) {
      files = (await readdir(cfg.profilesDir)).filter((f) => /\.(json|ini)$/i.test(f));
    }
    return text(
      `Impressoras nomeadas: ${Object.keys(cfg.printers).join(", ") || "(nenhuma)"}\n\n` +
        `Perfis em ${cfg.profilesDir || "(pasta não configurada)"}:\n` +
        (files.length ? files.map((f) => `- ${f}`).join("\n") : "(nenhum)"),
    );
  },
);

server.registerTool(
  "generate_qr_model",
  {
    title: "Gerar modelo 3D do QR",
    description:
      "Gera o arquivo 3MF (duas cores) ou STL do QR Code de uma etiqueta ou de qualquer texto/URL, pronto para fatiar.",
    inputSchema: {
      tagId: z.string().optional().describe("ID da etiqueta 3D QR; vira <tagBaseUrl><tagId>."),
      url: z.string().optional().describe("URL ou texto do QR, se não usar tagId."),
      format: z.enum(["3mf", "stl"]).default("3mf"),
      sizeMm: z.number().positive().default(60),
      baseHeightMm: z.number().positive().default(2),
      moduleHeightMm: z.number().positive().default(1.6),
      recessed: z.boolean().default(false).describe("Baixo-relevo em vez de relevo."),
      baseColor: z.string().default("#FFFFFF"),
      codeColor: z.string().default("#111111"),
      name: z.string().optional().describe("Nome do arquivo, sem extensão."),
    },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async (input) => {
    const cfg = await loadConfig();
    const payload = input.url || (input.tagId ? `${cfg.tagBaseUrl}${input.tagId}` : "");
    if (!payload) return fail("Informe `tagId` ou `url`.");

    const opts = {
      sizeMm: input.sizeMm,
      baseHeightMm: input.baseHeightMm,
      moduleHeightMm: input.moduleHeightMm,
      recessed: input.recessed,
      baseColor: input.baseColor,
      codeColor: input.codeColor,
    };
    const bytes = input.format === "stl" ? buildQrStl(payload, opts) : buildQr3mf(payload, opts);

    const dir = await ensureDir(cfg.outputDir);
    const file = path.join(dir, `${safeName(input.name || input.tagId || "qr")}.${input.format}`);
    await writeFile(file, bytes);

    return {
      content: [{ type: "text", text: `Modelo gerado: ${file}\nConteúdo do QR: ${payload}` }],
      structuredContent: { path: file, payload, format: input.format },
    };
  },
);

server.registerTool(
  "slice_model",
  {
    title: "Fatiar modelo",
    description:
      "Fatia um 3MF/STL com o Orca Slicer CLI (ou Anycubic Slicer Next) usando um perfil de impressora e devolve o caminho do G-code.",
    inputSchema: {
      modelPath: z.string().describe("Caminho do arquivo 3MF/STL a fatiar."),
      printer: z.string().optional().describe("Nome da impressora na config (ex.: kobra-x)."),
      machineProfile: z.string().optional().describe("Perfil de máquina, se não usar `printer`."),
      processProfile: z.string().optional().describe("Perfil de processo/qualidade."),
      filamentProfiles: z.array(z.string()).optional().describe("Perfis de filamento, na ordem."),
      outputDir: z.string().optional(),
      extraArgs: z.array(z.string()).optional().describe("Flags adicionais do CLI."),
    },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async (input) => {
    const cfg = await loadConfig();
    if (!cfg.slicerPath || !existsSync(cfg.slicerPath)) {
      return fail(
        `Fatiador não encontrado. Defina "slicerPath" em ${CONFIG_PATH} apontando para o executável do Orca Slicer ou Anycubic Slicer Next.`,
      );
    }
    if (!existsSync(input.modelPath)) return fail(`Modelo não encontrado: ${input.modelPath}`);

    const preset = input.printer ? cfg.printers[input.printer] : undefined;
    if (input.printer && !preset) {
      return fail(`Impressora "${input.printer}" não está na config. Use list_profiles.`);
    }

    const resolveProfile = (p) =>
      !p ? p : path.isAbsolute(p) ? p : path.join(cfg.profilesDir || "", p);

    const settings = [
      resolveProfile(input.machineProfile || preset?.machine),
      resolveProfile(input.processProfile || preset?.process),
    ].filter(Boolean);
    const filaments = (input.filamentProfiles || preset?.filaments || [])
      .map(resolveProfile)
      .filter(Boolean);

    const outDir = await ensureDir(input.outputDir || path.join(cfg.outputDir, "gcode"));

    const args = [];
    if (settings.length) args.push("--load-settings", settings.join(";"));
    if (filaments.length) args.push("--load-filaments", filaments.join(";"));
    args.push("--slice", "0", "--outputdir", outDir, ...(input.extraArgs || []), input.modelPath);

    const before = new Set(await readdir(outDir).catch(() => []));
    let stdout = "";
    let stderr = "";
    try {
      const res = await run(cfg.slicerPath, args, { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
      stdout = res.stdout;
      stderr = res.stderr;
    } catch (e) {
      return fail(
        `Falha ao fatiar.\nComando: ${cfg.slicerPath} ${args.join(" ")}\n${e.stderr || e.message}`,
      );
    }

    const after = await readdir(outDir).catch(() => []);
    const produced = after.filter((f) => !before.has(f) && /\.(gcode|gcode\.3mf|3mf)$/i.test(f));
    if (!produced.length) {
      return fail(`O fatiador rodou mas nenhum G-code apareceu em ${outDir}.\n${stdout}\n${stderr}`);
    }

    const gcodePath = path.join(outDir, produced[0]);
    const info = await stat(gcodePath);
    return {
      content: [
        { type: "text", text: `G-code gerado: ${gcodePath} (${Math.round(info.size / 1024)} KB)` },
      ],
      structuredContent: { gcodePath, outputDir: outDir, files: produced },
    };
  },
);

server.registerTool(
  "send_to_printer",
  {
    title: "Enviar para a impressora",
    description:
      "Copia o G-code para a pasta do cartão SD/pendrive ou faz upload para uma impressora Moonraker/Klipper na rede local, opcionalmente iniciando a impressão.",
    inputSchema: {
      gcodePath: z.string(),
      target: z.enum(["drop", "moonraker"]).default("drop"),
      startPrint: z.boolean().default(false).describe("Só vale para Moonraker."),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async ({ gcodePath, target, startPrint }) => {
    const cfg = await loadConfig();
    if (!existsSync(gcodePath)) return fail(`Arquivo não encontrado: ${gcodePath}`);
    const data = await readFile(gcodePath);
    const filename = path.basename(gcodePath);

    if (target === "drop") {
      if (!cfg.printerDropDir) {
        return fail(`Defina "printerDropDir" em ${CONFIG_PATH} (pasta do cartão SD/pendrive).`);
      }
      await ensureDir(cfg.printerDropDir);
      const dest = path.join(cfg.printerDropDir, filename);
      await writeFile(dest, data);
      return text(
        `Copiado para ${dest}. Nas Anycubic Kobra X / Kobra 4, retire a mídia e imprima pelo painel.`,
      );
    }

    if (!cfg.moonrakerUrl) return fail(`Defina "moonrakerUrl" em ${CONFIG_PATH}.`);
    const form = new FormData();
    form.append("file", new Blob([data]), filename);
    if (startPrint) form.append("print", "true");

    const res = await fetch(`${cfg.moonrakerUrl.replace(/\/$/, "")}/server/files/upload`, {
      method: "POST",
      headers: cfg.moonrakerApiKey ? { "X-Api-Key": cfg.moonrakerApiKey } : {},
      body: form,
    });
    const body = await res.text();
    if (!res.ok) return fail(`Moonraker respondeu ${res.status}: ${body.slice(0, 500)}`);
    return text(`Enviado para a impressora${startPrint ? " e impressão iniciada" : ""}: ${filename}`);
  },
);

server.registerTool(
  "print_qr_tag",
  {
    title: "Imprimir etiqueta QR (fluxo completo)",
    description:
      "Atalho: gera o modelo do QR, fatia com o perfil escolhido e entrega o G-code na impressora, em uma única chamada.",
    inputSchema: {
      tagId: z.string().optional(),
      url: z.string().optional(),
      printer: z.string().optional(),
      sizeMm: z.number().positive().default(60),
      send: z.enum(["none", "drop", "moonraker"]).default("none"),
      startPrint: z.boolean().default(false),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async (input) => {
    const gen = await server._registeredTools["generate_qr_model"].callback({
      tagId: input.tagId,
      url: input.url,
      format: "3mf",
      sizeMm: input.sizeMm,
      baseHeightMm: 2,
      moduleHeightMm: 1.6,
      recessed: false,
      baseColor: "#FFFFFF",
      codeColor: "#111111",
      name: input.tagId,
    });
    if (gen.isError) return gen;

    const sliced = await server._registeredTools["slice_model"].callback({
      modelPath: gen.structuredContent.path,
      printer: input.printer,
    });
    if (sliced.isError) return sliced;

    if (input.send === "none") return sliced;

    const sent = await server._registeredTools["send_to_printer"].callback({
      gcodePath: sliced.structuredContent.gcodePath,
      target: input.send,
      startPrint: input.startPrint,
    });
    return {
      content: [...sliced.content, ...sent.content],
      isError: sent.isError ?? false,
    };
  },
);

await server.connect(new StdioServerTransport());

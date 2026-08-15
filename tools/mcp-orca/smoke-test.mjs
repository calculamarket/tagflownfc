/**
 * Teste de fumaça: sobe o servidor MCP por stdio, faz o handshake, lista as
 * ferramentas e roda uma fatia de teste ponta a ponta.
 *
 *   node smoke-test.mjs            -> usa um fatiador simulado (não precisa do Orca)
 *   node smoke-test.mjs --real     -> usa a SUA config (~/.3dqr-mcp.json) e o Orca de verdade
 *
 * Com --real, informe a impressora:  node smoke-test.mjs --real --printer kobra-x
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const real = argv.includes("--real");
const printer = argv[argv.indexOf("--printer") + 1] || (real ? undefined : "kobra-x");

/** Monta um sandbox com fatiador simulado, para testar sem o Orca instalado. */
function fakeEnvironment() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "3dqr-smoke-"));
  const isWin = process.platform === "win32";
  const slicer = path.join(dir, isWin ? "fake-slicer.cmd" : "fake-slicer.sh");

  writeFileSync(
    slicer,
    isWin
      ? `@echo off\r\n:loop\r\nif "%~1"=="--outputdir" set OUT=%~2\r\nshift\r\nif not "%~1"=="" goto loop\r\nif not exist "%OUT%" mkdir "%OUT%"\r\n> "%OUT%\\qr-teste.gcode" echo ;FATIA DE TESTE\r\n`
      : `#!/usr/bin/env bash\nout="."; prev=""\nfor a in "$@"; do [ "$prev" = "--outputdir" ] && out="$a"; prev="$a"; done\nmkdir -p "$out"\nprintf ';FATIA DE TESTE\\nG28\\n' > "$out/qr-teste.gcode"\n`,
  );
  if (!isWin) chmodSync(slicer, 0o755);

  const profiles = path.join(dir, "perfis");
  mkdirSync(profiles);
  for (const f of ["kobra-x-machine.json", "kobra-x-0.20mm.json", "pla-branco.json"]) {
    writeFileSync(path.join(profiles, f), "{}");
  }

  const config = path.join(dir, "config.json");
  writeFileSync(
    config,
    JSON.stringify({
      slicerPath: slicer,
      profilesDir: profiles,
      outputDir: path.join(dir, "out"),
      printerDropDir: path.join(dir, "pendrive"),
      printers: {
        "kobra-x": {
          machine: "kobra-x-machine.json",
          process: "kobra-x-0.20mm.json",
          filaments: ["pla-branco.json"],
        },
      },
    }),
  );
  return config;
}

const env = { ...process.env };
if (!real) env.TAGFLOW_MCP_CONFIG = fakeEnvironment();

const client = new Client({ name: "3dqr-smoke-test", version: "1.0.0" });
await client.connect(
  new StdioClientTransport({ command: process.execPath, args: [path.join(here, "server.js")], env }),
);

console.log("1. Handshake:", JSON.stringify(client.getServerVersion()));
const { tools } = await client.listTools();
console.log("2. Ferramentas:", tools.map((t) => t.name).join(", "));

let failures = 0;
async function step(label, name, args) {
  const r = await client.callTool({ name, arguments: args });
  const body = r.content.map((c) => c.text).join("\n");
  if (r.isError) failures++;
  console.log(`${label} ${name}: ${r.isError ? "FALHOU" : "ok"}\n   ${body.replace(/\n/g, "\n   ")}`);
  return r;
}

await step("3.", "get_config", {});
await step("4.", "list_profiles", {});
await step("5.", "print_qr_tag", {
  tagId: "teste123",
  sizeMm: 60,
  send: "drop",
  ...(printer ? { printer } : {}),
});

await client.close();

console.log(
  failures
    ? `\n${failures} etapa(s) falharam — veja as mensagens acima.`
    : "\nTudo certo: o cliente MCP conversa com o servidor e a fatia de teste chegou até a mídia da impressora.",
);
process.exit(failures ? 1 : 0);

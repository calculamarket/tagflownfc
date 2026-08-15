# 3D QR · Servidor MCP local (Orca Slicer / Anycubic Slicer Next)

Servidor MCP que roda **na sua máquina** e conecta o 3D QR ao seu fluxo de impressão:
gera o modelo 3D do QR Code, fatia com o CLI do fatiador e entrega o G-code na
Anycubic Kobra X / Kobra 4.

> Por que local: nem o Orca Slicer nem o Anycubic Slicer Next publicam um servidor
> MCP remoto. Eles são apps desktop — a única forma de automatizar o fatiamento é
> chamar o CLI na máquina onde estão instalados. O Anycubic Slicer Next é um fork
> do Orca e aceita as mesmas flags de linha de comando.

## Instalação

```bash
cd tools/mcp-orca
npm install
```

Requer Node.js 20+.

## Configuração

Copie `config.example.json` para `~/.3dqr-mcp.json` (ou aponte `TAGFLOW_MCP_CONFIG`
para outro caminho) e ajuste:

| Campo | O que é |
| --- | --- |
| `slicerPath` | Executável do Orca Slicer ou Anycubic Slicer Next |
| `profilesDir` | Pasta com os perfis `.json` exportados do fatiador |
| `outputDir` | Onde ficam os modelos e G-codes gerados |
| `printerDropDir` | Pasta do cartão SD / pendrive (Kobra X e Kobra 4) |
| `moonrakerUrl` | Opcional — só se a impressora rodar Klipper/Moonraker |
| `printers` | Perfis nomeados (máquina + processo + filamentos) |

**Como exportar os perfis:** no Orca/Anycubic Slicer, selecione a Kobra X (ou
Kobra 4), o preset de qualidade e o filamento, e use *File → Export → Export
preset* para cada um. Salve os `.json` em `profilesDir`.

Caminhos típicos do executável:

- Windows: `C:\Program Files\OrcaSlicer\orca-slicer.exe`
- macOS: `/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer`
- Linux: `/usr/bin/orca-slicer` ou o AppImage

## Conectar ao cliente MCP

Claude Desktop / Cursor / Codex — adicione ao arquivo de configuração MCP:

```json
{
  "mcpServers": {
    "3dqr-slicer": {
      "command": "node",
      "args": ["C:\\caminho\\para\\tools\\mcp-orca\\server.js"]
    }
  }
}
```

Para usá-lo na Lovable (**Connectors → New MCP server**, que só aceita HTTP),
exponha o stdio como HTTP com o `mcp-remote`:

```bash
npx -y mcp-remote --stdio "node /caminho/tools/mcp-orca/server.js" --port 8765
```

e cadastre `http://localhost:8765/mcp`. Como a Lovable roda na nuvem, use um túnel
(`cloudflared tunnel --url http://localhost:8765`) para que o endereço seja alcançável.

## Ferramentas expostas

| Ferramenta | Função |
| --- | --- |
| `get_config` | Mostra a configuração e se o fatiador foi encontrado |
| `list_profiles` | Lista perfis disponíveis e impressoras nomeadas |
| `generate_qr_model` | Gera 3MF (duas cores) ou STL do QR de uma etiqueta ou URL |
| `slice_model` | Fatia um modelo com o perfil escolhido e devolve o G-code |
| `send_to_printer` | Copia pro cartão SD/pendrive ou envia via Moonraker |
| `print_qr_tag` | Atalho: gera + fatia + envia numa chamada só |

Exemplo de uso no chat do cliente MCP:

> "Gere o QR da etiqueta `abc123` com 80 mm, fatie no perfil `kobra-x` e copie pro pendrive."

## Anycubic Kobra X e Kobra 4

Essas impressoras usam firmware proprietário Anycubic, sem API local aberta de
upload. O caminho suportado é `send_to_printer` com `target: "drop"`: o G-code é
gravado no cartão SD / pendrive montado em `printerDropDir`, e você inicia a
impressão pelo painel. Se em algum momento você migrar para Klipper, basta
preencher `moonrakerUrl` e usar `target: "moonraker"` com `startPrint: true`.

import { writeFileSync } from 'node:fs';
export default function(pi) {
  pi.registerCommand('pia-inventory', { description: 'Write local evaluation tool inventory', handler: async () => {
    const active = new Set(pi.getActiveTools());
    writeFileSync(process.env.PIA_INVENTORY_FILE, JSON.stringify(pi.getAllTools().map(tool => ({ name: tool.name, active: active.has(tool.name), schemaCharacters: JSON.stringify(tool.parameters || {}).length })), null, 2));
  } });
}

import { appendFileSync } from 'node:fs';
export default function(pi) {
  const log = (event, data = {}) => appendFileSync(process.env.PIA_HOOK_LOG, JSON.stringify({ event, ...data }) + '\n');
  for (const event of ['session_start','agent_start','turn_start','turn_end','agent_end','agent_settled','session_shutdown']) pi.on(event, () => log(event));
  pi.events.on('lab:custom', data => log('custom_bus', data));
  pi.on('session_start', () => pi.events.emit('lab:custom', { verified: true }));
  pi.on('before_agent_start', event => ({ systemPrompt: event.systemPrompt + '\nHOOK_CONTEXT_SENTINEL' }));
  pi.on('tool_call', event => {
    log('tool_call', { tool: event.toolName });
    if (event.input.path === 'blocked.txt') return { block: true, reason: 'HOOK_BLOCK_SENTINEL' };
    if (event.input.path === 'throws.txt') throw new Error('HOOK_FAILURE_SENTINEL');
  });
  pi.on('tool_result', event => {
    log('tool_result', { tool: event.toolName });
    if (event.input.path === 'note.txt') return { content: [...event.content, { type: 'text', text: 'HOOK_RESULT_SENTINEL' }] };
  });
}

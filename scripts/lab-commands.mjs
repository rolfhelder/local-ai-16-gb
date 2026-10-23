import {consoleUI} from './console-ui.mjs';
export const labCommands=['progress','config'];
export const commandHelp={progress:'local-ai progress [--follow] [--log PATH] [--json]',config:'local-ai config [--demo] [--file PATH] [--apply] [--json]'};
export function help(args=[]){const ui=consoleUI(args);ui.title('COMMANDS','One local model / human-readable reports by default');ui.table(['Command','Purpose'],[['local-ai','Start Pi and llama.cpp'],['local-ai install','Installation and first-run menu'],['local-ai doctor','Hardware, model and runtime health'],['local-ai test --run','Answer and coding acceptance'],['local-ai progress','Latest log; --follow to watch'],['local-ai config','Missing settings; --demo for safe trial']]);ui.line('  Optional launch settings: --model NAME and --context TOKENS');ui.finish('Use a subcommand with --help for options. Reports support --json, --no-color and --ascii.');}
export async function main(command,args=[]){
 if(args.includes('--help')){const ui=consoleUI(args);ui.title(command.toUpperCase());ui.line('  '+commandHelp[command]);ui.finish('No operation performed. Add --json for structured reports.');return;}
 if(command==='progress')return (await import('./progress.mjs')).main(args);
 if(command==='config')return (await import('./config-plan.mjs')).main(args);
}

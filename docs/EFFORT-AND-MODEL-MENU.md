# Model and effort controls

Implemented 2026-10-21 as a native Pi extension, not a skill or prompt. Start a fresh `pia` session to load it. Commands execute in the harness and do not consume an LLM turn or ask the model to edit configuration.

```text
/model                 local models and Change effort menu
/model gemma           reload one model and resume the conversation
/effort                effort picker with the current budget
/effort low
/effort medium
/effort high
/effort off            Qwen, Gemma and OmniCoder only
```

`/local-model` is the underlying extension command and works in RPC/SDK clients too. In the CLI, a supported custom-editor callback routes `/model` to that command because Pi's built-in TUI intercepts `/model` before extension commands. Normal input and other slash commands retain their normal behavior. The editor extends Pi's `CustomEditor`, preserving its keybinding hooks. The footer shows the level and whether it represents native effort or a budget preset.

## What the levels mean for these exact downloads

| Downloaded model | Native low/medium/high effort input in its GGUF template | Available controls here |
|---|---|---|
| Qwen3.5 9B | No; `enable_thinking` on/off input | off; low/medium/high local thinking-budget presets |
| Gemma 4 12B IT | No; `enable_thinking` on/off input | off; low/medium/high local thinking-budget presets |
| OmniCoder 9B | No; `enable_thinking` on/off input | off; low/medium/high local thinking-budget presets |
| GPT-OSS 20B | Yes; `reasoning_effort` input | native low/medium/high plus the corresponding local budget; off is rejected |

We inspected `tokenizer.chat_template` in all four GGUFs; [capability evidence and template hashes](../evaluation/EFFORT-CAPABILITIES-2026-10-21.json). This describes the exposed interfaces in our downloaded files, not every possible model variant. OpenAI also documents GPT-OSS's [three native reasoning levels](https://huggingface.co/openai/gpt-oss-20b#reasoning-levels). We do not claim that a larger local budget guarantees better code or mimics another model's training.

| Preset | Thinking-token allowance |
|---|---:|
| off | 0, plus template thinking disabled |
| low | 512 |
| medium | 2,048 |
| high | 4,096 |

The ordinary total response cap remains 8,192, shared by reasoning and the visible answer. At smaller response caps, the hook reduces the thinking allowance to leave at least 1,024 tokens for the answer when that much room exists. It never enlarges the model's context. The presets are in [config/effort.json](../config/effort.json). These are ceilings, not a requirement to spend every token.

The hook changes actual outgoing `reasoning_budget_tokens` and template parameters on the next request. This field is verified in the pinned [llama.cpp b11669 server-common.cpp](https://github.com/ggml-org/llama.cpp/blob/b11669/tools/server/server-common.cpp), where per-request budgets override the startup default. GPT-OSS's exact-context budget hook executes first, so a restored response allowance is used when calculating thinking space. The legacy `pia --reasoning-budget N` remains an initial custom budget unless a saved effort preference or subsequent effort change selects a preset.

## Persistence and model switching

Effort selections persist per model in ignored `.state/effort-preferences.json`; no model weights or user prompt is modified. Initial model selection remains `pia --model NAME`, with OmniCoder as default. `/model NAME` requests a controlled restart from the parent launcher: stop the current Pi process, unload the owned server, load the selected GGUF, then resume the latest session in the same project with the selected model. The shared inference lock is held throughout. Model switching leaves the launcher default unchanged.

Changing effort while streaming is declined; stop the response first. A model switch is also allowed only while idle. A client not launched by `pia` receives the relevant `pia --model NAME` command instead of trying to take ownership of an unrelated server. pi-app's own model selector and bundled SDK are separate from the CLI editor; that GUI has been downloaded, but has not been configured or validated against the lab profile yet.

The user-created `prompts/effort.md` was preserved, but is excluded from generated profiles to prevent a misleading prompt-template command from colliding with the implemented extension. Coding evals get isolated preference paths so personal effort choices do not silently change the benchmark condition. Native comparison profiles retain their minimal extension configuration.

## Validation

- Unit checks cover budget changes, supported levels, GPT-OSS off rejection, answer space and `/model` routing.
- A real Pi RPC process registered the commands, changed/persisted effort without a provider call, and sent a 4,096-token budget on the next request to a scripted local endpoint. [Result](../evaluation/EFFORT-RUNTIME-2026-10-21.json).
- A real terminal UI accepted normal input through the custom editor and displayed the effort footer. [Result](../evaluation/EFFORT-TUI-2026-10-21.json).
- A live llama.cpp/Pi test loaded OmniCoder, generated a short conversation, switched to Gemma, verified the server alias and preserved message history, then exited cleanly. [Result](../evaluation/MODEL-SWITCH-2026-10-21.json). This was a lifecycle test at 32k, not another coding-quality benchmark.

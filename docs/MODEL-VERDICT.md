# Four-model comparison and verdict

2026-10-21. My provisional choice for Rolf's context-heavy coding and learning workflow is **OmniCoder as the primary model, with Gemma as the general-coding and low-memory alternative**. Gemma wins the simple count of completed coding tasks across both conditions. GPT-OSS is the speed specialist; Qwen is the comparison baseline. This is an interpretation of our local trials, not a general benchmark ranking. The launcher still defaults to Qwen; this documentation update does not change runtime settings.

## Coding, throughput and GPU memory

Three repair projects, each clean and with exactly 100,000 unrelated background tokens. A full pass requires preserved tests/specification, all public and hidden checks, and normal agent completion within six minutes. All models use f16 KV, one inference slot, reasoning enabled, 2,048 thinking-token budget and an 8,192 total output cap. The GPU has 16,376 MiB. GPT-OSS below is the repaired rerun, not its invalid initial loaded run.

| Measurement | Qwen3.5 9B Q4_K_M | Gemma 4 12B IT Q4_K_M | OmniCoder 9B Q4_K_M | GPT-OSS 20B MXFP4 |
|---|---:|---:|---:|---:|
| Configured coding window | 204,800 | 204,800 | 204,800 | 131,072 |
| Clean full passes | 2/3 | **3/3** | 2/3 | **3/3** |
| 100k-background full passes | 0/3 | **2/3** | **2/3** | 1/3 |
| Full passes across both conditions | 2/6 | **5/6** | 4/6 | 4/6 |
| Functionally correct repairs, regardless of settlement | 3/6 | **5/6** | 4/6 | **5/6** |
| Normal agent completions | 4/6 | 5/6 | **6/6** | 5/6 |
| Clean hidden groups | **18/18** | **18/18** | 17/18 | **18/18** |
| 100k hidden groups | 11/18 | 14/18 | **17/18** | **17/18** |
| Hidden groups across both conditions | 29/36 | 32/36 | 34/36 | **35/36** |
| Clean generation, mean tokens/sec | 71.1 | 53.2 | 71.6 | **114.4** |
| 100k generation, mean tokens/sec | 49.1 | 44.6 | 49.0 | **71.5** |
| Clean mean attempt time, seconds | 156.2 | 136.0 | 143.5 | **54.0** |
| 100k mean attempt time, seconds | 196.3 | 252.4 | **105.4** | 133.2 |
| Sampled peak GPU use, MiB | 14,453 | **13,468** | 14,393 | 15,809 |
| Headroom below GPU total at that peak, MiB | 1,923 | **2,908** | 1,983 | 567 |

Bold marks the best observed number, including ties. Hidden groups within a task are correlated, not independent benchmark problems. Mean attempt time includes failed attempts and timeouts, so it is not time per successful repair. GPU measurements include the desktop and are sampled; headroom is a subtraction from the observed peak, not guaranteed spare memory. Generation TPS includes reasoning and excludes prompt ingestion/tool execution; it is not end-to-end agent speed. The smaller GPT-OSS window is an actual native limit, not an arbitrary disadvantage.

## What each task revealed

| Task / condition | Qwen | Gemma | OmniCoder | GPT-OSS, repaired |
|---|---|---|---|---|
| CSV, clean | Correct 6/6, timed out | Pass 6/6 | Pass 6/6 | Pass 6/6 |
| CSV, 100k | 1/6, timed out | 2/6, timed out | **Pass 6/6** | Correct 6/6, then protocol error |
| Pagination, clean | Pass 6/6 | Pass 6/6 | Wrong edge case, 5/6 | Pass 6/6 |
| Pagination, 100k | Wrong edge case, 5/6 | Pass 6/6 | Wrong edge case, 5/6 | Pass 6/6 |
| Async retry, clean | Pass 6/6 | Pass 6/6 | Pass 6/6 | Pass 6/6 |
| Async retry, 100k | Wrong edge case, 5/6 | Pass 6/6 | Pass 6/6 | Wrong edge case, 5/6 |

Gemma handled the two non-CSV projects reliably in this sample. OmniCoder handled loaded CSV where the other runs failed the full contract, but missed the same pagination edge case in both conditions. GPT-OSS produced mostly correct repairs quickly; one malformed Harmony tool exchange caused the agent contract to fail after the CSV repair was already correct. Qwen's clean CSV repair was correct but exceeded the six-minute limit; calling that a wrong-code failure would be inaccurate.

## Context capacity and exact recall

| Model | Capacity evidence | Retrieval / instruction-following evidence |
|---|---|---|
| Qwen | Loaded 262,144; processed about 235k prompt tokens. Operating default 204,800. | Exact word-code recall passed at 192k with a 4,096 output cap, failed at 256k. Different historical controls must not be pooled. |
| Gemma | Loaded 262,144; processed about 235k prompt tokens. Operating default 204,800. | Exact word-code recall passed at 64k/128k in an earlier control. At 192k it retained numeric portions but omitted word prefixes; strict failure. Failed exact recall at 256k. |
| OmniCoder | Loaded and tested through 204,800; GGUF declares 262,144, but its 256k behavior is untested here. | **5/5 exact at each tested 64k, 128k and 200k window**, about 90% fill, 8,192 output cap. Strongest high-window evidence in this set, from single trials. |
| GPT-OSS | Loaded native 131,072. It cannot provide a native 200k window in this setup. | Repaired default-budget run passed 64k, failed 128k. One unrestricted 128k run retrieved all five values but added prose and used a tool, violating the contract. Sampling changes did not consistently fix 128k. |

These are not matched recall sweeps across all four models: window sizes, historical generation allowances and some identifier patterns differ. No statistical reliability threshold or GPU allocation-failure boundary was established. Ability to allocate 200k does not establish useful reasoning or reliable retrieval throughout 200k. Images, audio and real research/teaching quality have not been compared between these models.

## Token efficiency

Completed-response output tokens over the three loaded coding attempts were Qwen **19,658**, Gemma **21,304**, OmniCoder **8,191**, and GPT-OSS **15,936**. OmniCoder therefore has the best observed combination of loaded full passes, output volume and elapsed time here. Some Qwen/Gemma attempts timed out; unfinished final responses are not fully represented, so their token totals are lower bounds. Tokens use each model's tokenizer, and outputs include reasoning; these totals are operational observations, not standardized cognitive-efficiency scores. The 100k input prefix is excluded from these output totals.

## My choice for this PC

1. **OmniCoder for your usual long-context workflow.** It ties the best loaded full-pass count, ties the best loaded hidden-group count, settled normally in all six trials and has the strongest exact-recall evidence at 200k. Its loaded attempts were fastest end to end and used the fewest observed output tokens. It leaves about 1.94 GiB of sampled GPU headroom. Its pagination mistake remains a real coding limitation.
2. **Gemma for general coding and memory headroom.** It has the most full passes overall, passed all clean tasks and leaves about 2.84 GiB of sampled headroom. If your priority becomes ordinary coding with a modest active context rather than large accumulated context, Gemma is my first choice from these results. It is slower at generation, and the loaded CSV timeout matters for unattended work.
3. **GPT-OSS for fast, focused coding experiments.** It passed all clean tasks, has the highest generation rate and the most hidden groups overall. After the setup repair it is a credible coder, not the poor performer suggested by its invalid initial run. On this PC its 128k f16 configuration leaves only about 0.55 GiB of sampled headroom, has a native 128k ceiling and still showed a Harmony failure. Those constraints prevent me from choosing it as your main long-context agent. Smaller-window coding/recall has some positive evidence, but a complete tuned smaller-window suite is still outstanding.
4. **Qwen stays as a baseline rather than my first choice today.** It has useful speed and some good historical recall, but the loaded coding run was the weakest here. The sample is too small to conclude that OmniCoder is universally better than its base model or that a different Qwen configuration could not reverse the result.

Use `pia --local-model omnicoder` for the primary recommendation, `pia --local-model gemma` for the alternative, or `pia --local-model gpt-oss` for the tested GPT-OSS window. Plain `pia` still launches Qwen. The GPT-OSS token-budget hook and portable fd/ripgrep are already installed. Reasoning stays enabled. No launcher-default change is implied by this verdict.

Before declaring a stable winner, rerun all four under the repaired tool environment with several seeds/repetitions, then add real repository tasks and a research-to-lesson evaluation. GPT-OSS alone benefited from the later search-dependency repair; the 100k coding workload is otherwise the same, but its smaller total window leaves less room for subsequent turns. These limits justify a provisional workflow choice, not a universal quality ranking.

## Evidence

[Computed comparison JSON](../evaluation/MODEL-VERDICT-2026-10-21.json), [Qwen/Gemma cases](../evaluation/CODING-CONTEXT-2026-10-21.md), [OmniCoder cases](../evaluation/CODING-CONTEXT-OMNICODER-2026-10-21.md), [repaired GPT-OSS cases](../evaluation/CODING-CONTEXT-GPT-OSS-2026-10-21.md), [GPT-OSS recall controls](../evaluation/GPT-OSS-INVESTIGATION-2026-10-21.md), [setup investigation](CODING-FOUR-MODELS.md), [historical context evidence](CONTEXT-COMPARISON.md). All are local measurements; external benchmark claims are not folded into this verdict.

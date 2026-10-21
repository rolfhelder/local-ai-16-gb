# Coding results — 2026-10-21

Run status: **complete**. Finished 6/6 planned trials. See [protocol](../../docs/CODING-SUITE.md).

| Model | Case | Background | Hidden groups | Code correct | Agent settled | Full pass | Time | Generation TPS¹ | Peak GPU MiB² |
|---|---|---:|---:|---|---|---|---:|---:|---:|
| gpt-oss | csv-records | 0 | 6/6 | yes | yes | PASS | 30.3 s | 135.1 | 15676 |
| gpt-oss | csv-records | 100,000 | 0/6 | no | no | FAIL | 66.9 s | 0.0 | 15682 |
| gpt-oss | pagination-contract | 100,000 | 3/6 | no | no | FAIL | 42.6 s | 0.0 | 15819 |
| gpt-oss | pagination-contract | 0 | 6/6 | yes | yes | PASS | 23.3 s | 128.4 | 15777 |
| gpt-oss | async-retry | 0 | 6/6 | yes | yes | PASS | 33.9 s | 133.6 | 15777 |
| gpt-oss | async-retry | 100,000 | 0/6 | no | no | FAIL | 38.9 s | 0.0 | 15783 |

¹ Arithmetic mean across completed responses; per-response and weighted timing data are in the JSON. Timeout attempts may have an unfinished final response.
² Sampled during the agent trial; includes the desktop. Model downloads were running concurrently.

A correct repair can still fail the complete agent contract if the agent does not finish within six minutes. Hidden group counts are not independent benchmark tasks. This is a single small exploratory run, not a general coding leaderboard.

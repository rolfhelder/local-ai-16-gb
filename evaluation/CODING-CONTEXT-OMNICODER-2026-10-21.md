# Coding results — 2026-10-21

Run status: **complete**. Finished 6/6 planned trials. See [protocol](../docs/CODING-SUITE.md).

| Model | Case | Background | Hidden groups | Code correct | Agent settled | Full pass | Time | Generation TPS¹ | Peak GPU MiB² |
|---|---|---:|---:|---|---|---|---:|---:|---:|
| omnicoder | csv-records | 0 | 6/6 | yes | yes | PASS | 314.8 s | 69.9 | 14393 |
| omnicoder | csv-records | 100,000 | 6/6 | yes | yes | PASS | 120.8 s | 49.0 | 14370 |
| omnicoder | pagination-contract | 100,000 | 5/6 | no | yes | FAIL | 128.9 s | 49.0 | 14351 |
| omnicoder | pagination-contract | 0 | 5/6 | no | yes | FAIL | 67.2 s | 72.9 | 14353 |
| omnicoder | async-retry | 0 | 6/6 | yes | yes | PASS | 48.4 s | 73.7 | 14353 |
| omnicoder | async-retry | 100,000 | 6/6 | yes | yes | PASS | 66.4 s | 49.2 | 14359 |

¹ Arithmetic mean across completed responses; per-response and weighted timing data are in the JSON. Timeout attempts may have an unfinished final response.
² Sampled during the agent trial; includes the desktop. Model downloads were running concurrently.

A correct repair can still fail the complete agent contract if the agent does not finish within six minutes. Hidden group counts are not independent benchmark tasks. This is a single small exploratory run, not a general coding leaderboard.

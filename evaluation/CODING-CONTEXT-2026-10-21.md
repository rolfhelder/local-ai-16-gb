# Coding results — 2026-10-21

Run status: **complete**. Finished 12/12 planned trials (one repetition). See [protocol](../docs/CODING-SUITE.md).

| Model | Case | Background | Hidden groups | Code correct | Agent settled | Full pass | Time | Generation TPS¹ | Peak GPU MiB² |
|---|---|---:|---:|---|---|---|---:|---:|---:|
| qwen | csv-records | 0 | 6/6 | yes | no | FAIL | 362.3 s | 70.2 | 14453 |
| qwen | csv-records | 100,000 | 1/6 | no | no | FAIL | 361.9 s | 48.7 | 14381 |
| qwen | pagination-contract | 100,000 | 5/6 | no | yes | FAIL | 125.9 s | 49.4 | 14370 |
| qwen | pagination-contract | 0 | 6/6 | yes | yes | PASS | 68.9 s | 74.2 | 14300 |
| qwen | async-retry | 0 | 6/6 | yes | yes | PASS | 37.5 s | 75.0 | 14300 |
| qwen | async-retry | 100,000 | 5/6 | no | yes | FAIL | 101.3 s | 49.6 | 14306 |
| gemma | csv-records | 0 | 6/6 | yes | yes | PASS | 164.8 s | 53.3 | 13468 |
| gemma | csv-records | 100,000 | 2/6 | no | no | FAIL | 366.9 s | 44.5 | 13468 |
| gemma | pagination-contract | 100,000 | 6/6 | yes | yes | PASS | 231.2 s | 44.6 | 13458 |
| gemma | pagination-contract | 0 | 6/6 | yes | yes | PASS | 167.3 s | 53.4 | 13452 |
| gemma | async-retry | 0 | 6/6 | yes | yes | PASS | 75.9 s | 52.9 | 13458 |
| gemma | async-retry | 100,000 | 6/6 | yes | yes | PASS | 159.0 s | 44.7 | 13459 |

¹ Arithmetic mean across completed responses; per-response and weighted timing data are in the JSON. Timeout attempts may have an unfinished final response.
² Sampled during the agent trial; includes the desktop. Model downloads were running concurrently.

A correct repair can still fail the complete agent contract if the agent does not finish within six minutes. Hidden group counts are not independent benchmark tasks. This is a single small exploratory run, not a general coding leaderboard.

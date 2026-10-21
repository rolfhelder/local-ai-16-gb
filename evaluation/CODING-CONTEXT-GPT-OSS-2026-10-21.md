# Coding results — 2026-10-21

Run status: **complete**. Finished 6/6 planned trials. See [protocol](../docs/CODING-SUITE.md).

| Model | Case | Background | Hidden groups | Code correct | Agent settled | Full pass | Time | Generation TPS¹ | Peak GPU MiB² |
|---|---|---:|---:|---|---|---|---:|---:|---:|
| gpt-oss | csv-records | 0 | 6/6 | yes | yes | PASS | 95.9 s | 111.1 | 15806 |
| gpt-oss | csv-records | 100,000 | 6/6 | yes | no | FAIL | 178.9 s | 71.8 | 15809 |
| gpt-oss | pagination-contract | 100,000 | 6/6 | yes | yes | PASS | 132.0 s | 71.3 | 15793 |
| gpt-oss | pagination-contract | 0 | 6/6 | yes | yes | PASS | 40.7 s | 117.0 | 15791 |
| gpt-oss | async-retry | 0 | 6/6 | yes | yes | PASS | 25.4 s | 116.5 | 15790 |
| gpt-oss | async-retry | 100,000 | 5/6 | no | yes | FAIL | 88.7 s | 70.8 | 15799 |

¹ Arithmetic mean across completed responses; per-response and weighted timing data are in the JSON. Timeout attempts may have an unfinished final response.
² Sampled during the agent trial; includes the desktop. See JSON notes for concurrent-download conditions.

A correct repair can still fail the complete agent contract if the agent does not finish within six minutes. Hidden group counts are not independent benchmark tasks. This is a single small exploratory run, not a general coding leaderboard.

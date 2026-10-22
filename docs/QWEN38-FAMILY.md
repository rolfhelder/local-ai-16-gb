# Qwen3.8 candidates for the next Windows PC

Recorded 2026-10-22. Retain this family for reevaluation on the other PC; it was rejected for long-context throughput on this 16 GB GPU, not for measured coding quality. The other PC's reported 24 GB VRAM budget is a planning assumption until its actual hardware is checked. More VRAM may help, but no result on that PC is established.

## Model and retained download recipes

[Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B) is a 27B dense model with hybrid linear/full attention, a documented native context of 262144 tokens, thinking controls, and vision-language support. Our trials used text only; no vision projector was downloaded or tested. Its native context specification does not guarantee acceptable local throughput.

The tested [Unsloth GGUF repository](https://huggingface.co/unsloth/Qwen3.8-27B-GGUF) revision is `4ca720788d1e01f1bff70c033e0d0028fd02e502`. Both downloads passed SHA-256 verification before testing. Keep quantization recipes distinct: these are Unsloth dynamic variants, not a comparison of every provider's similarly named quantizations.

| Candidate | Weight file bytes | Decimal GB | Preserved recipe | Launcher model name |
|---|---:|---:|---|---|
| UD-IQ4_XS | 14252845984 | 14.25 | [IQ4_XS manifest](../manifests/qwen38-download.json) | `qwen38` |
| UD-Q3_K_XL | 13146393504 | 13.15 | [Q3_K_XL manifest](../manifests/qwen38-next-candidate.json) | `qwen38-q3` |

Weight-file size is not total VRAM consumption. Budget separately for KV/recurrent state, compute buffers, and Windows/display usage. In these trials, peak total adapter usage approached 15.5 GiB. Windows shared GPU memory spill was not confirmed, so it should not be treated as the proven cause of the slowdown.

## Measured outcome and next-PC procedure

Both variants loaded, but neither finished the approximately 90%-full 131072-context recall prompt within the tested timeout. Q3's last logged progress was 24% with f16 cache and 21% with q8 cache after nearly ten minutes. Coding, research and effort quality for these candidates remain unassessed because the user required a capacity pass first. [All measured context results](QWEN38-RESULTS.md).

On the other PC, first reconstruct the lab using [Windows migration](WINDOWS-MIGRATION.md), verify GPU/VRAM and available RAM, and check the runtime's architecture support. Re-download a pinned candidate, verify its hash, and rerun a single 131072-context trial before the rest of the suite. Record memory, prompt ingestion rate and generation rate separately. Do not treat a successful model load alone as a pass. Only after a useful run at 131072 should the capacity be increased toward 204800.

These commands use the existing Windows download scripts without throttling:

```powershell
powershell -NoProfile -File scripts/Download-CodingModels.ps1 -RateLimit 8054619 -Manifest qwen38-download.json -StatusName qwen38-iq4-download -Unlimited
# Or download Q3 instead:
powershell -NoProfile -File scripts/Download-CodingModels.ps1 -RateLimit 8054619 -Manifest qwen38-next-candidate.json -StatusName qwen38-q3-download -Unlimited
```

After downloading, the existing launcher accepts `pia --model qwen38 --context 131072 --kv q8_0` or `pia --model qwen38-q3 --context 131072 --kv q8_0`. These are experimental options, not a recommended final configuration. OmniCoder remains the default. Keep reasoning enabled and test the local budget controls independently from the model card's native thinking controls.

## Cleanup

At the user's request, both local Qwen3.8 weight files and their scratch files were deleted after the trials; pinned manifests, launcher registrations, private logs and sanitized results were retained for reproduction. The overnight scheduler was deleted, not merely paused. None of the original four models was removed.

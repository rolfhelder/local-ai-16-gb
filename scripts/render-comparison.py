"""Optional maintenance tool: python -m pip install matplotlib, then run this file."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'results/models.json').read_text(encoding='utf-8'))
models = data['models']
labels = ['Qwen3.5 9B', 'Gemma 4 12B', 'OmniCoder 9B', 'GPT-OSS 20B']
colors = ['#7394ac', '#267a69', '#7394ac', '#7394ac']
fig, axes = plt.subplots(1, 2, figsize=(11, 3.7), facecolor='#fafbf9')
for ax in axes:
    ax.set_facecolor('#fafbf9')
    ax.spines[['top', 'right', 'left']].set_visible(False)
    ax.tick_params(axis='y', length=0)
    ax.grid(axis='x', alpha=.18)
    ax.set_axisbelow(True)
for ax, key, scale, title, unit, limit in [
    (axes[0], 'largestCompletedContext', 1024, 'Completed context window', 'Ki tokens (capacity, not quality)', 310),
    (axes[1], 'codingPeakVramMiB', 1024, 'Peak total GPU memory during coding', 'GiB (includes Windows/display)', 18.7),
]:
    vals = [m[key] / scale for m in models]
    ax.barh(labels, vals, color=colors, height=.58)
    ax.invert_yaxis()
    ax.set_title(title, loc='left', fontsize=11, fontweight='bold', pad=14)
    ax.set_xlabel(unit, fontsize=9)
    ax.set_xlim(0, limit)
    for i, value in enumerate(vals):
        ax.text(value + limit * .015, i, f'{value:.2f}' if key.endswith('MiB') else f'{value:.0f}k', va='center', fontsize=9)
axes[1].axvline(data['hardware']['vramMiB'] / 1024, color='#ba5353', linestyle='--', linewidth=1)
fig.suptitle('Local observations on a 16 GB RTX 4090 Laptop GPU', x=.02, ha='left', fontsize=13, fontweight='bold')
fig.text(.02, .025, 'Single local trials; different coding windows. Qwen3.8 27B failed its 131k throughput gate and has no success bar.', fontsize=8, color='#555555')
fig.tight_layout(rect=(0, .08, 1, .90), w_pad=2)
(root / 'assets').mkdir(exist_ok=True)
fig.savefig(root / 'assets/model-comparison.png', dpi=160)

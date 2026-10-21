# From broad research to lessons you retain

## Research in bounded batches

Make a topic folder from `knowledge.example/topic/` under ignored `knowledge/`. Start with a question, your present understanding, the decision or skill you want, and a stopping rule. A useful first pass is 8–12 candidate sources, 3–5 close reads, and one short synthesis. Those numbers are workflow suggestions, not quotas that justify inventing evidence.

For a large topic, build a queue of subquestions. Research one batch at a time on the 16 GB baseline. Fetching independent pages can overlap later, but model inference should remain serialized until concurrency is measured. Repeatedly asking the same local model in different roles provides organizational separation; it does not establish independent factual verification.

For each source save URL, title, author/channel, publication date when known, retrieval date, relevant section or timestamp, claim, and limitation. Distinguish **discovered**, **retrieved**, **read**, and **used in synthesis**. Prefer primary documentation, papers, source code and original demonstrations. Include disagreement and missing evidence; exclude inaccessible sources from factual support.

After each batch write a checkpoint: what was answered, what changed, strongest evidence, contradictions, and next queries. Resume from the checkpoint and source index rather than putting every full document into the context window.

## YouTube discovery and transcripts

Use web search for `site:youtube.com <topic>` or yt-dlp's search support. Example commands below require separately installed yt-dlp; they were checked against documentation, not executed against YouTube here:

```powershell
yt-dlp --ignore-config --flat-playlist --dump-single-json 'ytsearch5:your topic'
yt-dlp --ignore-config --skip-download --write-subs --write-auto-subs --sub-langs 'en.*,pt.*' --sub-format vtt -o 'knowledge/topic/sources/%(id)s.%(ext)s' 'VIDEO_URL'
```

The first command discovers entries, whose metadata may be incomplete. The second requests captions without downloading the video. Keep timestamps, language, manual/automatic status, channel and URL. Deduplicate rolling caption lines for summaries while preserving the raw VTT. Do not label a video “watched” when only its transcript was read. Source: [yt-dlp options](https://github.com/yt-dlp/yt-dlp#usage-and-options).

The [Pi youtube-transcript skill](https://github.com/badlogic/pi-skills/tree/main/youtube-transcript) is another small option. On Windows invoke its JavaScript helper with `node` rather than assuming a Unix executable shebang. Test language selection and timestamp output before relying on it.

If no captions exist, use local audio transcription as a separate job and mark it machine-generated. If speech refers to an unseen diagram, record the gap and inspect that visual separately. Transcripts may contain errors and speaker claims still need checking against other sources.

## Synthesize, then teach

1. Build a claim-to-source table. Each significant factual claim must point to a read source or be labeled an inference.
2. Write a topic map: prerequisites → core concepts → applications → open questions.
3. Produce a lesson at the learner's current level, with one worked example and a practical exercise.
4. Ask the learner to explain the mechanism back or solve a novel problem. Diagnose the answer rather than simply repeating the lesson.
5. Save misconceptions, corrected explanations and follow-up questions. Suggest review after roughly 1, 3 and 7 days; these are manual study suggestions, not created reminders.

Use `/research-topic <topic>` then `/teach-topic <folder>` in the lab profile. The included prompts cannot search without an installed search tool. If none is available, they should report that limitation and work only from supplied sources.

## Optional orchestration

Later roles can be source scout, close reader, skeptic, synthesizer and tutor. Give each a bounded input and required output file. Keep the same model endpoint explicit and avoid cloud model defaults in borrowed agent definitions. A sequential queue is a valid “team” workflow on one GPU.

Use the [subagents candidate](https://github.com/nicobailon/pi-subagents) only after checking cancellation, artifact locations, model selection and Windows spawning. Test [pi-research](https://github.com/Lincoln504/pi-research) separately if its context requirements become practical. A saved report is reusable evidence; an embedding database is optional and should remain rebuildable from source notes.

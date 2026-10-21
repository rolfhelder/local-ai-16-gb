# Pi CLI and desktop interfaces

Checked 2026-10-21. The [official Pi repository](https://github.com/earendil-works/pi) distributes the interactive coding-agent CLI/TUI plus runtime/API libraries. Our `pia` command launches that terminal interface. It starts OmniCoder by default, manages llama.cpp and prepares the lab's isolated profile.

Community desktop applications also exist:

| Application | Published Windows support and features | Lab status |
|---|---|---|
| [pi-app](https://github.com/justhil/pi-app) | Windows x64 installer/portable builds; project/session interface, Git review, terminal and native extension UI adapters. Its README describes a bundled Pi SDK and a runtime switch. | Researched, not installed or tested with our profile. |
| [Eco Coding](https://github.com/plus1998/eco-coding) | Windows 10/11 x64 desktop app; Pi is one supported agent core; integrated browser, Git/worktrees and local compatible model endpoints. Single-model operation is supported. | Researched, not installed or tested with our profile. |

These are community projects, not an official first-party Pi desktop release. Features above are published capabilities, not acceptance results. A GUI trial should verify our localhost llama.cpp endpoint, one-session inference lock, model/server lifecycle, isolated extensions and destructive-action prompts. Desktop clients may use their own bundled Pi runtime or configuration paths, so launching one does not automatically reproduce `pia` behavior. Keep the existing CLI as the baseline while testing a GUI.

For Rolf's requested browser beside an agent session, Eco Coding is a candidate to evaluate; pi-app is a candidate for a conventional project/chat/review interface. No additional agents, app processes or model sessions were enabled by this research.

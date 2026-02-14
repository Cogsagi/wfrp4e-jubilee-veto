# Jubilee Veto — Player Veto System for WFRP4e

A Foundry VTT module for **Warhammer Fantasy Roleplay 4th Edition** that gives players the collective power to veto an idea or plan through a thematic voting system.

When enough companions stand together against a course of action, the **Jubilee** is declared and the motion is struck down.

## How It Works

1. **Any player calls a Jubilee** — they name the idea or plan they want to veto
2. **Other players cast their votes** — each player can vote once per Jubilee
3. **When the threshold is reached** (default: 3 votes), the **veto is declared** and the system resets
4. The GM or the original caller can **cancel** a vote at any time

## Features

- **Floating tracker widget** — visible to all players with vote pips, topic display, and action buttons
- **Dramatic themed chat messages** — randomized Old World flavor text for calls, votes, and verdicts
- **Chat commands** — `/jubilee` or `/jv` with subcommands (call, vote, cancel, help)
- **Socket-synced** — real-time updates across all connected clients
- **Configurable threshold** — set from 2–10 votes needed (default 3)
- **Anonymous voting** — optional setting to hide voter names
- **GM participation toggle** — choose whether the GM can vote
- **Screen flash effect** — dramatic visual when a veto is reached
- **Sound effects** — optional audio cues on call and veto
- **Public API** — accessible via `game.modules.get("wfrp4e-jubilee-veto").api`

## Chat Commands

| Command | Description |
|---------|-------------|
| `/jubilee` or `/jv` | Check current vote status |
| `/jv call` | Start a new Jubilee vote |
| `/jv vote` | Cast your vote |
| `/jv cancel` | Cancel the active vote (GM or caller only) |
| `/jv help` | Show command help |

## Module Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Veto Threshold | 3 | Votes needed to confirm the veto (2–10) |
| Show Voter Names | On | Display who voted in chat and tracker |
| Sound Effects | On | Play audio on call and veto |
| GM Can Vote | Off | Allow the GM to participate in votes |

## Installation

### Manual (Forge VTT or self-hosted)

1. Download or clone this repository
2. Place the `wfrp4e-jubilee-veto` folder in your `{userData}/Data/modules/` directory
3. Restart Foundry VTT
4. Enable the module in your world's Module Management settings

### Manifest URL

Use this URL in Foundry's "Install Module" dialog:
```
[Your manifest URL here]
```

## Compatibility

- **Foundry VTT:** V13+
- **WFRP4e System:** v9.0.0+

## File Structure

```
wfrp4e-jubilee-veto/
├── module.json              — Foundry manifest
├── scripts/jubilee-veto.mjs — Core logic (voting, sockets, UI, chat commands, API)
├── styles/jubilee-veto.css  — Grimdark themed styles with animations
└── README.md                — This file
```

## API

Other modules or macros can interact with the Jubilee system:

```javascript
const api = game.modules.get("wfrp4e-jubilee-veto").api;

api.callJubilee("Entering the Drakwald at night");
api.castVote();
api.cancelJubilee();
api.getActiveVote();   // Returns current vote state
api.getThreshold();    // Returns required vote count
```

## Credits

Built for the grim and perilous Old World. Inspired by the WFRP4e Fortune point system and the ancient democratic traditions of the Empire's guild halls.

## License

MIT

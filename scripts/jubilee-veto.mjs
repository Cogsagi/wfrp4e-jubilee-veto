// ============================================================================
// JUBILEE VETO — Player Veto System for WFRP4e
// A thematic voting mechanic where players can collectively veto an idea
// ============================================================================

const MODULE_ID = "wfrp4e-jubilee-veto";

// Settings keys
const SETTING_THRESHOLD = "vetoThreshold";
const SETTING_ACTIVE_VOTE = "activeVote";
const SETTING_SHOW_VOTERS = "showVoterNames";
const SETTING_SOUND_ENABLED = "soundEnabled";
const SETTING_GM_CAN_VETO = "gmCanVeto";

// Dramatic chat messages
const VETO_CALL_MESSAGES = [
  "A voice rises above the din — someone demands a Jubilee!",
  "The assembled company stirs. A Jubilee has been called!",
  "\"Halt! I invoke the right of Jubilee!\" The room falls silent...",
  "A fist slams the table. The ancient rite of Jubilee is invoked!",
  "Steel in their voice, a companion calls for Jubilee. Who will stand with them?",
  "The word echoes through the chamber — Jubilee! A vote is demanded!"
];

const VOTE_CAST_MESSAGES = [
  "{voter} raises their hand in opposition.",
  "{voter} stands firm — their vote is cast.",
  "{voter} steps forward. \"I too oppose this course.\"",
  "{voter} adds their voice to the dissent.",
  "{voter} nods gravely and casts their vote.",
  "{voter} joins the opposition without hesitation."
];

const VETO_REACHED_MESSAGES = [
  "The Jubilee is decided! The motion is struck down by the will of the company!",
  "Three voices united — the veto holds! The course is rejected!",
  "The ancient rite is fulfilled. The Jubilee has spoken — this shall not pass!",
  "By right of Jubilee, the matter is settled. The company has spoken!",
  "The vote is decisive. The Jubilee stands — the idea is vetoed!",
  "So it is decided! The Jubilee's judgement is final!"
];

const VETO_CANCELLED_MESSAGES = [
  "The Jubilee is withdrawn. The matter remains open.",
  "The call for Jubilee fades — the challenge is rescinded.",
  "Order is restored. The Jubilee has been cancelled."
];

// ============================================================================
// UTILITY
// ============================================================================

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getActiveVote() {
  return game.settings.get(MODULE_ID, SETTING_ACTIVE_VOTE);
}

function getThreshold() {
  return game.settings.get(MODULE_ID, SETTING_THRESHOLD);
}

async function setActiveVote(voteData) {
  await game.settings.set(MODULE_ID, SETTING_ACTIVE_VOTE, voteData);
}

// ============================================================================
// SETTINGS REGISTRATION
// ============================================================================

function registerSettings() {
  // Vote threshold (how many votes needed for veto)
  game.settings.register(MODULE_ID, SETTING_THRESHOLD, {
    name: "Veto Threshold",
    hint: "Number of votes required to confirm a Jubilee veto.",
    scope: "world",
    config: true,
    type: Number,
    default: 3,
    range: {
      min: 2,
      max: 10,
      step: 1
    }
  });

  // Show voter names publicly
  game.settings.register(MODULE_ID, SETTING_SHOW_VOTERS, {
    name: "Show Voter Names",
    hint: "If enabled, voter names are shown in the chat and tracker. If disabled, votes are anonymous.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // Sound effects
  game.settings.register(MODULE_ID, SETTING_SOUND_ENABLED, {
    name: "Sound Effects",
    hint: "Play a sound when a Jubilee is called and when the veto is reached.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // GM can participate in votes
  game.settings.register(MODULE_ID, SETTING_GM_CAN_VETO, {
    name: "GM Can Vote",
    hint: "If enabled, the GM can also cast a veto vote.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // Active vote state (hidden, used internally)
  game.settings.register(MODULE_ID, SETTING_ACTIVE_VOTE, {
    name: "Active Vote",
    scope: "world",
    config: false,
    type: Object,
    default: {
      active: false,
      topic: "",
      calledBy: "",
      calledById: "",
      voters: [],
      voterIds: [],
      timestamp: null
    }
  });
}

// ============================================================================
// SOCKET HANDLING
// ============================================================================

function registerSocketListeners() {
  game.socket.on(`module.${MODULE_ID}`, (data) => {
    switch (data.action) {
      case "refreshTracker":
        renderTracker();
        break;
      case "vetoReached":
        onVetoReached(data.topic);
        break;
      case "voteCalled":
        onVoteCalled();
        break;
    }
  });
}

function emitSocket(action, payload = {}) {
  game.socket.emit(`module.${MODULE_ID}`, { action, ...payload });
}

// ============================================================================
// CORE LOGIC — CALL A JUBILEE
// ============================================================================

async function callJubilee(topic) {
  const vote = getActiveVote();

  if (vote.active) {
    ui.notifications.warn("A Jubilee vote is already in progress! Vote or cancel it first.");
    return;
  }

  if (!game.user.isGM && game.user.isGM) {
    // This shouldn't happen, but guard anyway
    return;
  }

  const callerName = game.user.character?.name || game.user.name;

  const newVote = {
    active: true,
    topic: topic || "an unnamed proposal",
    calledBy: callerName,
    calledById: game.user.id,
    voters: [callerName],
    voterIds: [game.user.id],
    timestamp: Date.now()
  };

  // Only GM writes to settings to prevent race conditions
  if (game.user.isGM) {
    await setActiveVote(newVote);
  } else {
    // Players send request to GM via socket
    game.socket.emit(`module.${MODULE_ID}`, {
      action: "requestCallJubilee",
      vote: newVote
    });
  }

  // Post dramatic chat message
  const chatMsg = randomFrom(VETO_CALL_MESSAGES);
  await ChatMessage.create({
    content: `
      <div class="jubilee-chat jubilee-chat--called">
        <div class="jubilee-chat__icon">⚖</div>
        <div class="jubilee-chat__body">
          <h4 class="jubilee-chat__title">Jubilee Called!</h4>
          <p class="jubilee-chat__flavor">${chatMsg}</p>
          <p class="jubilee-chat__detail"><strong>${callerName}</strong> calls a Jubilee against: <em>"${foundry.utils.encodeHTML(newVote.topic)}"</em></p>
          <p class="jubilee-chat__status">Votes: 1 / ${getThreshold()}</p>
        </div>
      </div>`,
    speaker: { alias: "Jubilee" }
  });

  if (game.settings.get(MODULE_ID, SETTING_SOUND_ENABLED)) {
    AudioHelper.play({ src: "sounds/drums.wav", volume: 0.5, loop: false }, true);
  }

  emitSocket("voteCalled");
  emitSocket("refreshTracker");
  renderTracker();
}

// ============================================================================
// CORE LOGIC — CAST A VOTE
// ============================================================================

async function castVote() {
  const vote = getActiveVote();

  if (!vote.active) {
    ui.notifications.warn("No Jubilee vote is active.");
    return;
  }

  if (!game.settings.get(MODULE_ID, SETTING_GM_CAN_VETO) && game.user.isGM) {
    ui.notifications.warn("The GM cannot participate in Jubilee votes (configurable in settings).");
    return;
  }

  if (vote.voterIds.includes(game.user.id)) {
    ui.notifications.info("You have already cast your vote in this Jubilee.");
    return;
  }

  const voterName = game.user.character?.name || game.user.name;
  const showNames = game.settings.get(MODULE_ID, SETTING_SHOW_VOTERS);
  const threshold = getThreshold();

  // Send vote to GM for processing
  if (game.user.isGM) {
    await processVote(game.user.id, voterName);
  } else {
    game.socket.emit(`module.${MODULE_ID}`, {
      action: "requestVote",
      oderId: game.user.id,
      voterName: voterName
    });
  }

  // Chat notification
  const flavorMsg = randomFrom(VOTE_CAST_MESSAGES).replace("{voter}", showNames ? voterName : "A companion");
  const newCount = vote.voters.length + 1;

  await ChatMessage.create({
    content: `
      <div class="jubilee-chat jubilee-chat--vote">
        <div class="jubilee-chat__icon">✋</div>
        <div class="jubilee-chat__body">
          <p class="jubilee-chat__flavor">${flavorMsg}</p>
          <p class="jubilee-chat__status">Votes: ${newCount} / ${threshold}</p>
        </div>
      </div>`,
    speaker: { alias: "Jubilee" }
  });
}

async function processVote(oderId, voterName) {
  if (!game.user.isGM) return; // Only GM processes votes

  const vote = getActiveVote();
  if (!vote.active) return;
  if (vote.voterIds.includes(oderId)) return;

  vote.voters.push(voterName);
  vote.voterIds.push(oderId);

  const threshold = getThreshold();

  if (vote.voters.length >= threshold) {
    // Veto reached!
    const topic = vote.topic;

    // Reset the vote
    await setActiveVote({
      active: false,
      topic: "",
      calledBy: "",
      calledById: "",
      voters: [],
      voterIds: [],
      timestamp: null
    });

    // Announce veto reached
    const vetoMsg = randomFrom(VETO_REACHED_MESSAGES);
    const showNames = game.settings.get(MODULE_ID, SETTING_SHOW_VOTERS);

    await ChatMessage.create({
      content: `
        <div class="jubilee-chat jubilee-chat--veto-reached">
          <div class="jubilee-chat__icon">🛡</div>
          <div class="jubilee-chat__body">
            <h4 class="jubilee-chat__title">⚖ JUBILEE VETO! ⚖</h4>
            <p class="jubilee-chat__flavor">${vetoMsg}</p>
            <p class="jubilee-chat__detail">The proposal <em>"${foundry.utils.encodeHTML(topic)}"</em> has been <strong>VETOED</strong>.</p>
            ${showNames ? `<p class="jubilee-chat__voters">Dissenters: ${vote.voters.join(", ")}</p>` : ""}
          </div>
        </div>`,
      speaker: { alias: "Jubilee" }
    });

    if (game.settings.get(MODULE_ID, SETTING_SOUND_ENABLED)) {
      AudioHelper.play({ src: "sounds/lock.wav", volume: 0.6, loop: false }, true);
    }

    emitSocket("vetoReached", { topic });
    emitSocket("refreshTracker");
    renderTracker();
  } else {
    // Update vote state
    await setActiveVote(vote);
    emitSocket("refreshTracker");
    renderTracker();
  }
}

// ============================================================================
// CORE LOGIC — CANCEL A JUBILEE (GM or caller only)
// ============================================================================

async function cancelJubilee() {
  const vote = getActiveVote();

  if (!vote.active) {
    ui.notifications.warn("No Jubilee vote is active to cancel.");
    return;
  }

  if (!game.user.isGM && game.user.id !== vote.calledById) {
    ui.notifications.warn("Only the GM or the person who called the Jubilee can cancel it.");
    return;
  }

  if (game.user.isGM) {
    await setActiveVote({
      active: false,
      topic: "",
      calledBy: "",
      calledById: "",
      voters: [],
      voterIds: [],
      timestamp: null
    });
  } else {
    game.socket.emit(`module.${MODULE_ID}`, { action: "requestCancel" });
  }

  const cancelMsg = randomFrom(VETO_CANCELLED_MESSAGES);
  await ChatMessage.create({
    content: `
      <div class="jubilee-chat jubilee-chat--cancelled">
        <div class="jubilee-chat__icon">✕</div>
        <div class="jubilee-chat__body">
          <p class="jubilee-chat__flavor">${cancelMsg}</p>
        </div>
      </div>`,
    speaker: { alias: "Jubilee" }
  });

  emitSocket("refreshTracker");
  renderTracker();
}

// ============================================================================
// VISUAL/AUDIO EFFECTS
// ============================================================================

function onVetoReached(topic) {
  // Screen flash effect for all clients
  const flash = document.createElement("div");
  flash.classList.add("jubilee-flash");
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1500);
}

function onVoteCalled() {
  // Subtle pulse on the tracker
  const tracker = document.getElementById("jubilee-tracker");
  if (tracker) {
    tracker.classList.add("jubilee-tracker--pulse");
    setTimeout(() => tracker.classList.remove("jubilee-tracker--pulse"), 1000);
  }
}

// ============================================================================
// GM SOCKET PROCESSOR — Handles player requests
// ============================================================================

function registerGMSocketProcessor() {
  if (!game.user.isGM) return;

  game.socket.on(`module.${MODULE_ID}`, async (data) => {
    switch (data.action) {
      case "requestCallJubilee":
        if (data.vote) {
          await setActiveVote(data.vote);
          emitSocket("refreshTracker");
          renderTracker();
        }
        break;

      case "requestVote":
        if (data.voterName && data.oderId) {
          await processVote(data.oderId, data.voterName);
        }
        break;

      case "requestCancel":
        // Verify the requester is the caller
        const vote = getActiveVote();
        if (vote.active) {
          await setActiveVote({
            active: false,
            topic: "",
            calledBy: "",
            calledById: "",
            voters: [],
            voterIds: [],
            timestamp: null
          });
          emitSocket("refreshTracker");
          renderTracker();
        }
        break;
    }
  });
}

// ============================================================================
// UI TRACKER — Floating widget
// ============================================================================

function renderTracker() {
  // Remove existing tracker
  const existing = document.getElementById("jubilee-tracker");
  if (existing) existing.remove();

  const vote = getActiveVote();
  const threshold = getThreshold();
  const showNames = game.settings.get(MODULE_ID, SETTING_SHOW_VOTERS);
  const canVote = vote.active && !vote.voterIds.includes(game.user.id) &&
                  (game.settings.get(MODULE_ID, SETTING_GM_CAN_VETO) || !game.user.isGM);
  const canCancel = vote.active && (game.user.isGM || game.user.id === vote.calledById);

  // Build vote pips
  let pipsHtml = "";
  for (let i = 0; i < threshold; i++) {
    const filled = i < (vote.active ? vote.voters.length : 0);
    const voterLabel = filled && showNames && vote.voters[i] ? ` title="${foundry.utils.encodeHTML(vote.voters[i])}"` : "";
    pipsHtml += `<div class="jubilee-tracker__pip ${filled ? "jubilee-tracker__pip--filled" : ""}"${voterLabel}></div>`;
  }

  const tracker = document.createElement("div");
  tracker.id = "jubilee-tracker";
  tracker.classList.add("jubilee-tracker");
  if (!vote.active) tracker.classList.add("jubilee-tracker--idle");

  tracker.innerHTML = `
    <div class="jubilee-tracker__header">
      <span class="jubilee-tracker__title">⚖ Jubilee</span>
      <span class="jubilee-tracker__status">${vote.active ? "VOTE ACTIVE" : "No Vote"}</span>
    </div>
    ${vote.active ? `
      <div class="jubilee-tracker__topic" title="${foundry.utils.encodeHTML(vote.topic)}">
        "${vote.topic.length > 40 ? vote.topic.substring(0, 40) + "…" : vote.topic}"
      </div>
      <div class="jubilee-tracker__pips">${pipsHtml}</div>
      <div class="jubilee-tracker__count">${vote.voters.length} / ${threshold} votes</div>
      <div class="jubilee-tracker__actions">
        ${canVote ? `<button class="jubilee-tracker__btn jubilee-tracker__btn--vote" data-action="vote">Vote ✋</button>` : ""}
        ${canCancel ? `<button class="jubilee-tracker__btn jubilee-tracker__btn--cancel" data-action="cancel">Cancel ✕</button>` : ""}
      </div>
    ` : `
      <div class="jubilee-tracker__actions">
        <button class="jubilee-tracker__btn jubilee-tracker__btn--call" data-action="call">Call Jubilee ⚖</button>
      </div>
    `}
  `;

  document.body.appendChild(tracker);

  // Bind button events
  tracker.querySelectorAll(".jubilee-tracker__btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const action = e.currentTarget.dataset.action;
      if (action === "call") promptCallJubilee();
      if (action === "vote") castVote();
      if (action === "cancel") cancelJubilee();
    });
  });
}

// ============================================================================
// DIALOG — Call Jubilee prompt
// ============================================================================

function promptCallJubilee() {
  new Dialog({
    title: "Call a Jubilee",
    content: `
      <form>
        <div class="form-group">
          <label>What are you vetoing?</label>
          <input type="text" name="topic" placeholder="e.g. Entering the cursed forest" autofocus />
        </div>
        <p class="notes">Describe the idea or plan you want the party to vote against.</p>
      </form>`,
    buttons: {
      call: {
        icon: '<i class="fas fa-gavel"></i>',
        label: "Call Jubilee!",
        callback: (html) => {
          const topic = html.find('[name="topic"]').val()?.trim();
          if (!topic) {
            ui.notifications.warn("You must describe what you're calling the Jubilee against.");
            return;
          }
          callJubilee(topic);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Nevermind"
      }
    },
    default: "call"
  }).render(true);
}

// ============================================================================
// CHAT COMMANDS
// ============================================================================

function registerChatCommands() {
  Hooks.on("chatMessage", (chatLog, message, chatData) => {
    const command = message.trim().toLowerCase();

    if (command === "/jubilee" || command === "/jv") {
      const vote = getActiveVote();
      const threshold = getThreshold();
      if (vote.active) {
        const showNames = game.settings.get(MODULE_ID, SETTING_SHOW_VOTERS);
        ChatMessage.create({
          content: `
            <div class="jubilee-chat jubilee-chat--status">
              <div class="jubilee-chat__body">
                <h4 class="jubilee-chat__title">⚖ Jubilee Status</h4>
                <p><strong>Topic:</strong> ${foundry.utils.encodeHTML(vote.topic)}</p>
                <p><strong>Called by:</strong> ${vote.calledBy}</p>
                <p><strong>Votes:</strong> ${vote.voters.length} / ${threshold}</p>
                ${showNames ? `<p><strong>Voters:</strong> ${vote.voters.join(", ")}</p>` : ""}
              </div>
            </div>`,
          speaker: { alias: "Jubilee" },
          whisper: [game.user.id]
        });
      } else {
        ChatMessage.create({
          content: `
            <div class="jubilee-chat jubilee-chat--status">
              <div class="jubilee-chat__body">
                <p>No Jubilee vote is currently active.</p>
              </div>
            </div>`,
          speaker: { alias: "Jubilee" },
          whisper: [game.user.id]
        });
      }
      return false;
    }

    if (command === "/jubilee call" || command === "/jv call") {
      promptCallJubilee();
      return false;
    }

    if (command === "/jubilee vote" || command === "/jv vote") {
      castVote();
      return false;
    }

    if (command === "/jubilee cancel" || command === "/jv cancel") {
      cancelJubilee();
      return false;
    }

    if (command === "/jubilee help" || command === "/jv help") {
      ChatMessage.create({
        content: `
          <div class="jubilee-chat jubilee-chat--help">
            <div class="jubilee-chat__body">
              <h4 class="jubilee-chat__title">⚖ Jubilee Commands</h4>
              <p><strong>/jubilee</strong> or <strong>/jv</strong> — Check vote status</p>
              <p><strong>/jv call</strong> — Start a new Jubilee vote</p>
              <p><strong>/jv vote</strong> — Cast your vote</p>
              <p><strong>/jv cancel</strong> — Cancel the active vote (GM or caller)</p>
              <p><strong>/jv help</strong> — Show this help</p>
            </div>
          </div>`,
        speaker: { alias: "Jubilee" },
        whisper: [game.user.id]
      });
      return false;
    }
  });
}

// ============================================================================
// PUBLIC API
// ============================================================================

function registerAPI() {
  game.modules.get(MODULE_ID).api = {
    callJubilee,
    castVote,
    cancelJubilee,
    getActiveVote,
    getThreshold
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Jubilee Veto module`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Module ready — The right of Jubilee awaits...`);

  registerSocketListeners();
  registerGMSocketProcessor();
  registerChatCommands();
  registerAPI();
  renderTracker();
});

// Re-render tracker when settings change
Hooks.on("updateSetting", (setting) => {
  if (setting.key.startsWith(MODULE_ID)) {
    renderTracker();
  }
});

// Re-render on canvas ready (handles Forge cold starts, scene changes)
Hooks.on("canvasReady", () => {
  renderTracker();
});

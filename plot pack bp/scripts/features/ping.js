import { system, world } from "@minecraft/server";
import { failure, translatedSuccess, translatedFailure, getCommandPlayer } from "../utils/commands.js";

const PING_WHITELIST_PROPERTY = "rsp:ping_whitelist";
const PING_BLACKLIST_PROPERTY = "rsp:ping_blacklist";
const PING_ENABLED_PROPERTY = "rsp:ping_enabled";
export function normalisePingPhrase(phrase) {
    return phrase.trim().toLowerCase();
}
export function loadPingList(player, propertyId) {
    const stored = player.getDynamicProperty(propertyId);
    if (typeof stored !== "string") {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter((value) => typeof value === "string")
            .map(normalisePingPhrase)
            .filter((value) => value.length > 0);
    }
    catch {
        return [];
    }
}
export function savePingList(player, propertyId, values) {
    const uniqueValues = [...new Set(values
            .map(normalisePingPhrase)
            .filter((value) => value.length > 0))];
    if (uniqueValues.length === 0) {
        player.setDynamicProperty(propertyId, undefined);
        return;
    }
    player.setDynamicProperty(propertyId, JSON.stringify(uniqueValues));
}
function getPingRules(player) {
    return {
        whitelist: loadPingList(player, PING_WHITELIST_PROPERTY),
        blacklist: loadPingList(player, PING_BLACKLIST_PROPERTY),
    };
}

const PING_SOUND = "random.orb";

function playPingSound(player) {
    try {
        player.playSound(PING_SOUND, { volume: 1, pitch: 1 });
    } catch (error) {
        console.warn(`[Ping] Failed to play sound for ${player.name}: ${error}`);
    }
}

world.beforeEvents.chatSend.subscribe((event) => {
    const sender = event.sender;
    const originalMessage = event.message;
    event.cancel = true;
    system.run(() => {
        let formattedMessage = originalMessage;
        for (const target of world.getAllPlayers()) {
            if (!arePingsEnabled(target)) continue;
            const rules = getPingRules(target);
            const matchedTerms = getMatchedPingTerms(originalMessage, target, rules);
            if (matchedTerms.length === 0) continue;
            for (const term of matchedTerms) {
                formattedMessage = highlightPingTerm(formattedMessage, term);
            }
            if (target.id !== sender.id) playPingSound(target);
        }
        world.sendMessage(`<${sender.name}> ${formattedMessage}`);
    });
});
function getMatchedPingTerms(message, target, rules) {
    const matchedTerms = [];
    const containsBlacklistedTerm = rules.blacklist.some((term) => containsPingTerm(message, term));
    if (containsBlacklistedTerm) {
        return matchedTerms;
    }
    const playerMention = `@${target.name}`;
    if (containsPingTerm(message, playerMention)) {
        matchedTerms.push(playerMention);
    }
    for (const term of rules.whitelist) {
        if (containsPingTerm(message, term)) {
            matchedTerms.push(term);
        }
    }
    return matchedTerms;
}
function highlightPingTerm(message, term) {
    const cleanedTerm = term.trim();
    if (cleanedTerm.length === 0) {
        return message;
    }
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])` +
        `(${escapePingRegex(cleanedTerm)})` +
        `(?=$|[^\\p{L}\\p{N}_])`, "giu");
    return message.replace(pattern, `$1§e$2§r`);
}
function arePingsEnabled(player) {
    const stored = player.getDynamicProperty(PING_ENABLED_PROPERTY);
    return typeof stored === "boolean"
        ? stored
        : true;
}
function containsPingTerm(message, term) {
    const cleanedTerm = term.trim();
    if (cleanedTerm.length === 0) {
        return false;
    }
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])` +
        `${escapePingRegex(cleanedTerm)}` +
        `(?=$|[^\\p{L}\\p{N}_])`, "iu");
    return pattern.test(message);
}
function escapePingRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function handlePingCommand(origin, modeArgument, actionArgument, phraseArgument) {
    const player = getCommandPlayer(origin);
    if (player === undefined) {
        return failure("This command can only be used by a player.");
    }
    const mode = modeArgument.toLowerCase();
    if (mode === "toggle") {
        const stored = player.getDynamicProperty(PING_ENABLED_PROPERTY);
        const currentlyEnabled = typeof stored === "boolean"
            ? stored
            : true;
        const newValue = !currentlyEnabled;
        system.run(() => {
            player.setDynamicProperty(PING_ENABLED_PROPERTY, newValue);
        });
        return translatedSuccess(player, newValue
            ? "rsp.ping.enabled"
            : "rsp.ping.disabled");
    }
    if (mode !== "whitelist" &&
        mode !== "blacklist") {
        return translatedFailure(player, "rsp.ping.unknown_list", [modeArgument]);
    }
    if (actionArgument === undefined) {
        return translatedFailure(player, "rsp.ping.action_required");
    }
    const action = actionArgument.toLowerCase();
    const propertyId = mode === "whitelist"
        ? PING_WHITELIST_PROPERTY
        : PING_BLACKLIST_PROPERTY;
    const values = loadPingList(player, propertyId);
    switch (action) {
        case "add": {
            if (phraseArgument === undefined) {
                return translatedFailure(player, "rsp.ping.phrase_required");
            }
            const phrase = normalisePingPhrase(phraseArgument);
            if (phrase.length === 0) {
                return translatedFailure(player, "rsp.ping.phrase_required");
            }
            if (values.includes(phrase)) {
                return translatedFailure(player, "rsp.ping.already_exists", [phrase, mode]);
            }
            system.run(() => {
                savePingList(player, propertyId, [
                    ...values,
                    phrase,
                ]);
            });
            return translatedSuccess(player, "rsp.ping.added", [phrase, mode]);
        }
        case "remove": {
            if (phraseArgument === undefined) {
                return translatedFailure(player, "rsp.ping.phrase_required");
            }
            const phrase = normalisePingPhrase(phraseArgument);
            if (!values.includes(phrase)) {
                return translatedFailure(player, "rsp.ping.not_found", [phrase, mode]);
            }
            system.run(() => {
                savePingList(player, propertyId, values.filter((value) => value !== phrase));
            });
            return translatedSuccess(player, "rsp.ping.removed", [phrase, mode]);
        }
        case "list": {
            if (values.length === 0) {
                return translatedSuccess(player, "rsp.ping.list_empty", [mode]);
            }
            return translatedSuccess(player, "rsp.ping.list", [
                mode,
                values.join(", "),
            ]);
        }
        case "clear": {
            system.run(() => {
                player.setDynamicProperty(propertyId, undefined);
            });
            return translatedSuccess(player, "rsp.ping.cleared", [mode]);
        }
        default:
            return translatedFailure(player, "rsp.ping.unknown_action", [actionArgument]);
    }
}

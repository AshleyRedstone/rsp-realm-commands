import { system, world } from "@minecraft/server";

const PING_WHITELIST_PROPERTY = "rsp:ping_whitelist";
const PING_ENABLED_PROPERTY = "rsp:ping_enabled";
const PING_SOUND = "random.orb";

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
    } catch {
        return [];
    }
}

function getPingRules(player) {
    return {
        terms: loadPingList(player, PING_WHITELIST_PROPERTY)
    };
}

function getMatchedPingTerms(message, target, rules) {
    const matchedTerms = [];
    const playerMention = `@${target.name}`;

    if (containsPingTerm(message, playerMention)) {
        matchedTerms.push(playerMention);
    }

    for (const term of rules.terms) {
        if (containsPingTerm(message, term)) {
            matchedTerms.push(term);
        }
    }

    return [...new Set(matchedTerms)];
}

function arePingsEnabled(player) {
    const stored = player.getDynamicProperty(PING_ENABLED_PROPERTY);

    return typeof stored === "boolean"
        ? stored
        : true;
}

function playPingSound(player) {
    try {
        player.playSound(PING_SOUND, {
            volume: 1,
            pitch: 1
        });
    } catch (error) {
        console.warn(
            `[Ping] Failed to play sound for ${player.name}: ${error}`
        );
    }
}

world.beforeEvents.chatSend.subscribe((event) => {
    const sender = event.sender;
    const originalMessage = event.message;

    event.cancel = true;

    system.run(() => {
        try {
            const payload = encodeURIComponent(JSON.stringify({
                username: sender.name,
                message: originalMessage
            }));

            world.getDimension("overworld").runCommand(
                `scriptevent rsp:original_chat ${payload}`
            );
        } catch (error) {
            console.warn(
                `[RSP Chat] Failed to relay message to DiscordCC: ${error}`
            );
        }

        let formattedMessage = originalMessage;

        for (const target of world.getAllPlayers()) {
            if (!arePingsEnabled(target)) {
                continue;
            }

            const rules = getPingRules(target);

            const matchedTerms = getMatchedPingTerms(
                originalMessage,
                target,
                rules
            );

            if (matchedTerms.length === 0) {
                continue;
            }

            for (const term of matchedTerms) {
                formattedMessage = highlightPingTerm(
                    formattedMessage,
                    term
                );
            }

            if (target.id !== sender.id) {
                playPingSound(target);
            }
        }

        world.sendMessage(
            `<${sender.name}> ${formattedMessage}`
        );
    });
});

function containsPingTerm(message, term) {
    const cleanedTerm = term.trim();

    if (cleanedTerm.length === 0) {
        return false;
    }

    const pattern = new RegExp(
        `(^|[^\\p{L}\\p{N}_])` +
        `${escapePingRegex(cleanedTerm)}` +
        `(?=$|[^\\p{L}\\p{N}_])`,
        "iu"
    );

    return pattern.test(message);
}

function escapePingRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


const PREFIX_TAG = "prefix:";
const VALID_COLOUR = /^[0-9a-v]$/i;

export function getPlayerPrefixes(player) {
    const prefixes = [];

    for (const tag of player.getTags()) {
        if (!tag.startsWith(PREFIX_TAG)) continue;

        const data = tag.slice(PREFIX_TAG.length);
        const separator = data.lastIndexOf(":");

        if (separator === -1) continue;

        const name = data.slice(0, separator).trim();
        const colour = data.slice(separator + 1).toLowerCase();

        if (!name || !VALID_COLOUR.test(colour)) continue;

        prefixes.push({
            name,
            colour
        });
    }

    return prefixes;
}

export function getFormattedPrefix(player) {
    return getPlayerPrefixes(player)
        .map(({ name, colour }) => `§r[§${colour}${name}§r]`)
        .join(" ");
}

export function getFormattedName(player) {
    const prefix = getFormattedPrefix(player);

    return prefix
        ? `${prefix} <${player.name}>`
        : `<${player.name}>`;
}
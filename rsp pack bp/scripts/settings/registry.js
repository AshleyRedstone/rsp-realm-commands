import { ActionFormData } from "@minecraft/server-ui";

const categories = new Map();

// A category has an id, a translation-key title and an async open(player) handler.
export function registerSettingsCategory({ id, title, open }) {
    if (typeof id !== "string" || !id || typeof open !== "function") {
        throw new TypeError("Invalid settings category");
    }
    if (categories.has(id)) throw new Error(`Duplicate settings category: ${id}`);
    categories.set(id, { id, title, open });
}

export async function showSettings(player) {
    const entries = [...categories.values()];
    const form = new ActionFormData()
        .title({ translate: "rsp.settings.title" })
        .body({ translate: "rsp.settings.description" });
    for (const entry of entries) form.button({ translate: entry.title });
    try {
        const result = await form.show(player);
        if (result.canceled || result.selection === undefined) return;
        await entries[result.selection]?.open(player);
    } catch (error) {
        console.warn(`[Settings] ${error?.stack ?? error}`);
    }
}


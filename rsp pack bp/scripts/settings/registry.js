import { ActionFormData } from "@minecraft/server-ui";
import { openCategory } from "./renderer.js";

const categories = new Map();
const TYPES = new Set(["toggle", "stringList", "dropdown", "slider", "text"]);
export const tr = (key, ...args) => ({ translate: key, ...(args.length ? { with: args.map(String) } : {}) });

export function registerSettingsCategory(category) {
    if (!category || typeof category.id !== "string" || !category.id || !category.title || !Array.isArray(category.settings))
        throw new TypeError("Invalid settings category");
    if (categories.has(category.id)) throw new Error(`Duplicate settings category: ${category.id}`);
    const ids = new Set();
    for (const setting of category.settings) {
        if (!setting.id || ids.has(setting.id) || !TYPES.has(setting.type) || !setting.title)
            throw new TypeError(`Invalid or duplicate setting in ${category.id}`);
        const storage = setting.storage ?? "dynamicProperty";
        if (storage !== "dynamicProperty" && storage !== "tag")
            throw new TypeError(`Unsupported storage method for ${setting.id}: ${storage}`);
        if (storage === "tag") {
            if (setting.type !== "toggle")
                throw new TypeError(`Tag storage requires a toggle: ${setting.id}`);
            if (typeof setting.tag !== "string" || !setting.tag.trim() || setting.tag.length > 256)
                throw new TypeError(`Invalid tag for ${setting.id}`);
            if (setting.property !== undefined)
                throw new TypeError(`Tag setting ${setting.id} must use tag, not property`);
            if (setting.default === true)
                throw new TypeError(`Tag setting ${setting.id} cannot default to true without a tag migration`);
        } else if (typeof setting.property !== "string" || !setting.property.trim()) {
            throw new TypeError(`Dynamic-property setting ${setting.id} requires property`);
        }
        if (setting.type === "dropdown" && (!Array.isArray(setting.options) || !setting.options.length))
            throw new TypeError(`Dropdown ${setting.id} requires options`);
        if (setting.type === "slider" && (!(setting.max > setting.min) || !(setting.step > 0)))
            throw new TypeError(`Slider ${setting.id} requires min/max/step`);
        if (setting.type === "toggle" &&
            ((setting.enabledTitle !== undefined && typeof setting.enabledTitle !== "string") ||
             (setting.disabledTitle !== undefined && typeof setting.disabledTitle !== "string")))
            throw new TypeError(`Invalid toggle translation keys for ${setting.id}`);
        ids.add(setting.id);
    }
    categories.set(category.id, category);
}

export async function showSettings(player) {
    const entries = [...categories.values()];
    try {
        const form = new ActionFormData().title(tr("rsp.settings.title"))
            .body(tr("rsp.settings.description"));
        for (const entry of entries) form.button(tr(entry.title));
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined) return;
        const selected = entries[response.selection];
        if (selected) await openCategory(player, selected);
    } catch (error) {
        console.warn(`[Settings] Main menu failed: ${error?.stack ?? error}`);
    }
}

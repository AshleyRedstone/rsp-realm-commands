import { ActionFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import { readSetting, writeSetting } from "./storage.js";
import { tr, showSettings } from "./registry.js";
import { openStringList } from "./controls/string_list.js";
import { openDropdown } from "./controls/dropdown.js";
import { openSlider } from "./controls/slider.js";
import { openText } from "./controls/text.js";

export function reopen(callback) { system.run(callback); }
export function reportError(context, error) {
    console.warn(`[Settings] ${context}: ${error?.stack ?? error}`);
}

export async function openCategory(player, category) {
    try {
        const settings = category.settings.filter(s => !s.visible || s.visible(player));
        const form = new ActionFormData().title(tr(category.title));
        for (const setting of settings) {
            const title = setting.type === "toggle"
                ? (readSetting(player, setting)
                    ? (setting.enabledTitle ?? setting.title)
                    : (setting.disabledTitle ?? setting.title))
                : setting.title;
            form.button(tr(title));
        }
        form.button(tr("rsp.settings.back"));
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined) return;
        if (response.selection === settings.length) return reopen(() => showSettings(player));
        const setting = settings[response.selection];
        if (!setting) return;
        const back = () => openCategory(player, category);
        if (setting.type === "toggle") {
            writeSetting(player, setting, !readSetting(player, setting));
            return reopen(back);
        }
        if (setting.type === "stringList") return reopen(() => openStringList(player, setting, back));
        if (setting.type === "dropdown") return reopen(() => openDropdown(player, setting, back));
        if (setting.type === "slider") return reopen(() => openSlider(player, setting, back));
        if (setting.type === "text") return reopen(() => openText(player, setting, back));
    } catch (error) { reportError(`Category ${category.id}`, error); }
}

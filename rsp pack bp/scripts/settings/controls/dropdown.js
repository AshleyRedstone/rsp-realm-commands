import { ActionFormData } from "@minecraft/server-ui";
import { readSetting, writeSetting } from "../storage.js";
import { tr } from "../registry.js";
import { reopen, reportError } from "../renderer.js";
export async function openDropdown(player, setting, back) {
    try {
        const current = readSetting(player, setting);
        const form = new ActionFormData().title(tr(setting.title));
        for (const option of setting.options) form.button(tr(option.title));
        form.button(tr("rsp.settings.back"));
        const response = await form.show(player);
        if (response.canceled) return;
        if (response.selection === setting.options.length) return reopen(back);
        const option = setting.options[response.selection];
        if (option && option.value !== current) writeSetting(player, setting, option.value);
        reopen(back);
    } catch (error) { reportError("Dropdown", error); }
}

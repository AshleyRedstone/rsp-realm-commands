import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { readSetting, writeSetting, normaliseString } from "../storage.js";
import { tr } from "../registry.js";
import { reopen, reportError } from "../renderer.js";

export async function openStringList(player, setting, back) {
    try {
        const values = readSetting(player, setting);
        const form = new ActionFormData().title(tr(setting.title))
            .body(tr("rsp.settings.list.count", values.length))
            .button(tr("rsp.settings.list.add"))
            .button(tr("rsp.settings.list.remove"))
            .button(tr("rsp.settings.back"));
        const result = await form.show(player);
        if (result.canceled) return;
        if (result.selection === 0) return reopen(() => addEntry(player, setting, back));
        if (result.selection === 1) return reopen(() => removeEntry(player, setting, back));
        if (result.selection === 2) return reopen(back);
    } catch (error) { reportError("String list", error); }
}

async function addEntry(player, setting, back) {
    try {
        const form = new ModalFormData().title(tr("rsp.settings.list.add"))
            .textField(tr("rsp.settings.list.value"), tr("rsp.settings.list.placeholder"));
        const result = await form.show(player);
        if (result.canceled) return reopen(() => openStringList(player, setting, back));
        const value = normaliseString(result.formValues?.[0], setting.options);
        if (!value && !setting.options?.allowEmpty) {
            player.sendMessage(tr("rsp.settings.list.empty"));
        } else {
            const values = readSetting(player, setting);
            if (!values.includes(value)) writeSetting(player, setting, [...values, value]);
        }
        reopen(() => openStringList(player, setting, back));
    } catch (error) { reportError("Add list entry", error); }
}

async function removeEntry(player, setting, back) {
    try {
        const values = readSetting(player, setting);
        if (!values.length) return reopen(() => openStringList(player, setting, back));
        const form = new ActionFormData().title(tr("rsp.settings.list.remove"));
        for (const value of values) form.button(value);
        form.button(tr("rsp.settings.back"));
        const result = await form.show(player);
        if (result.canceled) return reopen(() => openStringList(player, setting, back));
        if (result.selection !== undefined && result.selection < values.length) {
            const selected = values[result.selection];
            // Re-read before writing, so a changed list isn't overwritten by a stale form.
            writeSetting(player, setting, readSetting(player, setting).filter(v => v !== selected));
        }
        reopen(() => openStringList(player, setting, back));
    } catch (error) { reportError("Remove list entry", error); }
}

import { ModalFormData } from "@minecraft/server-ui";
import { readSetting, writeSetting } from "../storage.js";
import { tr } from "../registry.js";
import { reopen, reportError } from "../renderer.js";
export async function openText(player, setting, back) {
    try {
        const form = new ModalFormData().title(tr(setting.title))
            .textField(tr(setting.title), tr("rsp.settings.list.placeholder"), {
                defaultValue: readSetting(player, setting)
            });
        const response = await form.show(player);
        if (!response.canceled) {
            try { writeSetting(player, setting, response.formValues?.[0] ?? ""); }
            catch (error) { player.sendMessage(tr("rsp.settings.invalid")); }
        }
        reopen(back);
    } catch (error) { reportError("Text", error); }
}

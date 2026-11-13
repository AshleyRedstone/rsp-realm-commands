import { ModalFormData } from "@minecraft/server-ui";
import { readSetting, writeSetting } from "../storage.js";
import { tr } from "../registry.js";
import { reopen, reportError } from "../renderer.js";
export async function openSlider(player, setting, back) {
    try {
        const form = new ModalFormData().title(tr(setting.title))
            .slider(tr(setting.title), setting.min, setting.max, {
                valueStep: setting.step, defaultValue: readSetting(player, setting)
            });
        const response = await form.show(player);
        if (!response.canceled && typeof response.formValues?.[0] === "number")
            writeSetting(player, setting, response.formValues[0]);
        reopen(back);
    } catch (error) { reportError("Slider", error); }
}

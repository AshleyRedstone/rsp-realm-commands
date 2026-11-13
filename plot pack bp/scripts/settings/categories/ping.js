import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { registerSettingsCategory, showSettings } from "../registry.js";
import { loadPingList, savePingList, normalisePingPhrase } from "../../features/ping.js";

const ENABLED = "rsp:ping_enabled";
const LISTS = {
    whitelist: "rsp:ping_whitelist",
    blacklist: "rsp:ping_blacklist"
};
const tr = (key, withArgs = []) => ({ translate: key, with: withArgs });
const enabled = player => player.getDynamicProperty(ENABLED) !== false;

async function pingMenu(player) {
    const form = new ActionFormData()
        .title(tr("rsp.settings.ping.title"))
        .button(tr(enabled(player) ? "rsp.settings.ping.disable" : "rsp.settings.ping.enable"))
        .button(tr("rsp.settings.ping.whitelist"))
        .button(tr("rsp.settings.ping.blacklist"))
        .button(tr("rsp.settings.back"));
    const result = await form.show(player);
    if (result.canceled) return;
    if (result.selection === 0) {
        player.setDynamicProperty(ENABLED, !enabled(player));
        return pingMenu(player);
    }
    if (result.selection === 1) return listMenu(player, "whitelist");
    if (result.selection === 2) return listMenu(player, "blacklist");
    if (result.selection === 3) return showSettings(player);
}

async function listMenu(player, kind) {
    const property = LISTS[kind];
    const values = loadPingList(player, property);
    const form = new ActionFormData()
        .title(tr(kind === "whitelist" ? "rsp.settings.ping.whitelist" : "rsp.settings.ping.blacklist"))
        .body(tr("rsp.settings.ping.entries", [values.length ? values.join(", ") : "—"]))
        .button(tr("rsp.settings.ping.add"))
        .button(tr("rsp.settings.ping.remove"))
        .button(tr("rsp.settings.ping.clear"))
        .button(tr("rsp.settings.back"));
    const result = await form.show(player);
    if (result.canceled) return;
    switch (result.selection) {
        case 0: return editList(player, kind, "add");
        case 1: return editList(player, kind, "remove");
        case 2: return confirmClear(player, kind);
        case 3: return pingMenu(player);
    }
}

async function editList(player, kind, action) {
    const property = LISTS[kind];
    const form = new ModalFormData()
        .title(tr(action === "add" ? "rsp.settings.ping.add" : "rsp.settings.ping.remove"))
        .textField(tr("rsp.settings.ping.phrase"), tr("rsp.settings.ping.placeholder"));
    const result = await form.show(player);
    if (result.canceled) return listMenu(player, kind);
    const phrase = normalisePingPhrase(String(result.formValues?.[0] ?? ""));
    if (!phrase) {
        player.sendMessage(tr("rsp.settings.ping.empty"));
        return listMenu(player, kind);
    }
    const values = loadPingList(player, property);
    if (action === "add") {
        if (!values.includes(phrase)) savePingList(player, property, [...values, phrase]);
    } else {
        savePingList(player, property, values.filter(value => value !== phrase));
    }
    return listMenu(player, kind);
}

async function confirmClear(player, kind) {
    const form = new ActionFormData()
        .title(tr("rsp.settings.ping.clear"))
        .body(tr("rsp.settings.ping.clear_confirm"))
        .button(tr("rsp.settings.confirm"))
        .button(tr("rsp.settings.cancel"));
    const result = await form.show(player);
    if (!result.canceled && result.selection === 0) {
        player.setDynamicProperty(LISTS[kind], undefined);
    }
    return listMenu(player, kind);
}

registerSettingsCategory({
    id: "ping",
    title: "rsp.settings.ping.title",
    open: pingMenu
});

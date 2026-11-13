import { registerSettingsCategory } from "../registry";

registerSettingsCategory({
    id: "gameplay",
    name: "rsp.settings.gameplay.title",
    settings: [
        {
            id: "nodrops",
            type: "toggle",
            title: "rsp.settings.nodrops.enabled",
            enabledTitle: "rsp.settings.gameplay.nodrops.disable",
            disabledTitle: "rsp.settings.gameplay.nodrops.enable",
            storage: "tag",
            tag: "nodrops",
            default: false
        }
    ]
});
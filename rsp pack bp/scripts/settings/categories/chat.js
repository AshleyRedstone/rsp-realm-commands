import {registerSettingsCategory} from "../registry";

registerSettingsCategory({
    id: "chat",
    title: "rsp.settings.chat.title",
    settings: [
        {
            id: "deathMessages",
            type: "toggle",
            title: "rsp.settings.death_messages.enabled",
            enabledTitle: "rsp.settings.chat.death_messages.enable",
            disabledTitle: "rsp.settings.chat.death_messages.disable",
            storage: "tag",
            tag: "hideDeathMessages",
            default: false
        },
        {
            id: "afkMessages",
            type: "toggle",
            title: "rsp.settings.afk_messages.enabled",
            enabledTitle: "rsp.settings.chat.afk_messages.enable",
            disabledTitle: "rsp.settings.chat.afk_messages.disable",
            storage: "tag",
            tag: "hideAfkMessages",
            default: false
        }
    ]
});
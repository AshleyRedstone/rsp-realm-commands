import { registerSettingsCategory } from "../registry.js";

registerSettingsCategory({
    id: "ping",
    title: "rsp.settings.ping.title",
    settings: [
        {
            id: "enabled",
            type: "toggle",
            title: "rsp.settings.ping.enabled",
            enabledTitle: "rsp.settings.ping.disable",
            disabledTitle: "rsp.settings.ping.enable",
            property: "rsp:ping_enabled",
            default: true
        },
        {
            id: "terms",
            type: "stringList",
            title: "rsp.settings.ping.terms",
            property: "rsp:ping_whitelist",
            options: { normalise: "lowercase", unique: true, allowEmpty: false }
        }
    ]
});

import { registerSettingsCategory } from "../registry";

registerSettingsCategory({
    id: "gameplay",
    title: "rsp.settings.gameplay.title",
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
        },
        {
            id: "burnout_torch",
            type: "toggle",
            title: "rsp.settings.burnout_torch.enabled",
            enabledTitle: "rsp.settings.gameplay.burnout_torch.disable",
            disabledTitle: "rsp.settings.gameplay.burnout_torch.enable",
            storage: "tag",
            tag: "burnout_torch",
            default: false
        },
        {
            id: "auto_cauldron",
            type: "toggle",
            title: "rsp.settings.auto_cauldron.enabled",
            enabledTitle: "rsp.settings.gameplay.auto_cauldron.disable",
            disabledTitle: "rsp.settings.gameplay.auto_cauldron.enable",
            storage: "tag",
            tag: "auto_cauldron",
            default: false
        },
        {
            id: "auto_slab",
            type: "toggle",
            title: "rsp.settings.auto_slab.enabled",
            enabledTitle: "rsp.settings.gameplay.auto_slab.disable",
            disabledTitle: "rsp.settings.gameplay.auto_slab.enable",
            storage: "tag",
            tag: "auto_slab",
            default: false
        },
        {
            id: "no_item_pickup",
            type: "toggle",
            title: "rsp.settings.no_item_pickup.enabled",
            enabledTitle: "rsp.settings.gameplay.no_item_pickup.disable",
            disabledTitle: "rsp.settings.gameplay.no_item_pickup.enable",
            storage: "tag",
            tag: "no_item_pickup",
            default: false
        }
    ]
});
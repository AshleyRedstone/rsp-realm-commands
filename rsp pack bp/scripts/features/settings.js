import "../settings/categories/ping.js";
import { showSettings } from "../settings/registry.js";
import { system, Player, CustomCommandStatus } from "@minecraft/server";

export function handleSettingsCommand(origin) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can open settings." };
    }
    system.run(() => showSettings(player));
    return { status: CustomCommandStatus.Success };
}

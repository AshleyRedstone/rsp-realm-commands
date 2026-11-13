import { Player, system, CustomCommandStatus } from "@minecraft/server";
import "../settings/categories/ping.js";
import { showSettings } from "../settings/registry.js";

export function handleSettingsCommand(origin) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "This command must be run by a player." };
    }
    system.run(() => showSettings(player));
    return { status: CustomCommandStatus.Success };
}

import { system } from "@minecraft/server";
import { failure, success, sendLater, getCommandPlayer } from "../utils/commands.js";

export function handleGamemodeCommand(origin, mode) {
    const player = getCommandPlayer(origin);
    if (player === undefined) {
        return failure();
    }
    const modes = {
        survival: "survival",
        s: "survival",
        0: "survival",
        creative: "creative",
        c: "creative",
        1: "creative",
        adventure: "adventure",
        a: "adventure",
        2: "adventure",
        spectator: "spectator",
        sp: "spectator",
        3: "spectator",
    };
    const gamemode = modes[mode.toLowerCase()];
    if (gamemode === undefined) {
        sendLater(player, { translate: "rsp.gamemode.unknown", with: [String(mode)] });
        return failure();
    }
    system.run(() => {
        player.runCommand(`gamemode ${gamemode} @s`);
    });
    return success();
}

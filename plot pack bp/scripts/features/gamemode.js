import { system } from "@minecraft/server";
import { failure, success, getCommandPlayer } from "../utils/commands.js";

export function handleGamemodeCommand(origin, mode) {
    const player = getCommandPlayer(origin);
    if (player === undefined) {
        return failure("This command can only be used by a player.");
    }
    const modes = {
        survival: "survival",
        s: "survival",
        "0": "survival",
        creative: "creative",
        c: "creative",
        "1": "creative",
        adventure: "adventure",
        a: "adventure",
        "2": "adventure",
        spectator: "spectator",
        sp: "spectator",
        "3": "spectator",
    };
    const gamemode = modes[mode.toLowerCase()];
    if (gamemode === undefined) {
        return failure(`Unknown gamemode "${mode}".`);
    }
    system.run(() => {
        player.runCommand(`gamemode ${gamemode} @s`);
    });
    return success();
}

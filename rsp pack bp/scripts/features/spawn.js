import { system, world } from "@minecraft/server";
import {getCommandPlayer} from "../utils/commands";

export function handleSpawnCommand(origin) {
    const player = getCommandPlayer(origin);
    system.run(() => {
        world.getDimension("overworld").runCommand(`teleport ${player.nameTag} 0 64 0`);
    });
}
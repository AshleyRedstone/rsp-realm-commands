import { system, world } from "@minecraft/server";
import {getCommandPlayer} from "../utils/helper_functions";

export function handleWrCommand(origin) {
    const player = getCommandPlayer(origin);
    system.run(() => {
        world.getDimension("overworld").runCommand(`teleport ${player.nameTag} 314 30.00 -4`);
    });
}
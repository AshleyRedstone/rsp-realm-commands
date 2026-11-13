import { system, world } from "@minecraft/server";

export function handleSpawnCommand(origin) {
    const player = origin.player;
    system.run(() => {
        world.getDimension("overworld").runCommand(`teleport ${player} 0 64 0`);
    });
}
import {world, system, CustomCommandStatus} from "@minecraft/server";

const CLEANUP_INTERVAL = 30 * 60 * 20; // 30 minutes
const STRUCTURE_PREFIX = "buffer_";

export function handleStructureCleanupCommand(origin) {
    system.run(() => {
        const { deleted, failed } = cleanupStructures();

        const message =
            `§a[Structure Cleanup] §fDeleted §e${deleted}§f buffer structures.` +
            (failed > 0 ? ` §cFailed: ${failed}.` : "");

        const player = origin.sourceEntity;

        if (player instanceof Player) {
            player.sendMessage(message);
        } else {
            console.warn(message);
        }
    });

    return {
        status: CustomCommandStatus.Success
    };
}

export function cleanupStructures() {
    let deleted = 0;
    let failed = 0;

    for (const structure of world.structureManager.getWorldStructureIds()) {
        const name = structure.includes(":")
            ? structure.split(":").slice(1).join(":")
            : structure;

        if (!name.startsWith(STRUCTURE_PREFIX)) {
            continue;
        }

        try {
            world.structureManager.delete(structure);
            deleted++;
        } catch (error) {
            failed++;

            console.warn(
                `[Structure Cleanup] Failed to delete ${structure}: ${error}`
            );
        }
    }

    if (deleted > 0 || failed > 0) {
        console.warn(
            `[Structure Cleanup] Deleted ${deleted} buffer structures.` +
            (failed > 0 ? ` Failed: ${failed}.` : "")
        );
    }

    return { deleted, failed };
}
system.runInterval(cleanupStructures, CLEANUP_INTERVAL);
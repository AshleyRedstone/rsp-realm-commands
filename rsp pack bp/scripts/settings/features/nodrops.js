import {
    Player,
    system,
    world
} from "@minecraft/server";

world.afterEvents.entityItemDrop.subscribe((event) => {
    const player = event.entity;

    if (!(player instanceof Player)) return;
    if (!player.hasTag("nodrops")) return;

    const items = Array.from(event.items);

    system.run(() => {
        for (const item of items) {
            try {
                if (item.isValid) item.remove();
            } catch (error) {
                console.error(`Failed to remove item: ${error}`);
            }
        }
    });
});

const pendingContainers = new Map();

function getKey(dimension, location) {
    return `${dimension.id}:${location.x},${location.y},${location.z}`;
}

world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const { player, block } = event;

    if (!player.hasTag("nodrops")) return;

    try {
        const inventory = block.getComponent("minecraft:inventory");

        if (!inventory?.container) return;

        const location = { ...block.location };
        const dimension = block.dimension;
        const key = getKey(dimension, location);

        pendingContainers.set(key, { location, dimension });

        system.runTimeout(() => {
            pendingContainers.delete(key);
        }, 20);
    } catch (error) {
        console.error(`Container detection failed: ${error}`);
    }
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, block } = event;

    if (!player.hasTag("nodrops")) return;

    const key = getKey(block.dimension, block.location);
    const pending = pendingContainers.get(key);

    if (!pending) return;

    pendingContainers.delete(key);

    const { location, dimension } = pending;

    system.runTimeout(() => {
        try {
            const items = dimension.getEntities({
                type: "minecraft:item",
                location: {
                    x: location.x + 0.5,
                    y: location.y + 0.5,
                    z: location.z + 0.5
                },
                maxDistance: 1.5
            });

            for (const item of items) {
                if (item.isValid) item.remove();
            }
        } catch (error) {
            console.error(`Container cleanup failed: ${error}`);
        }
    }, 1);
});
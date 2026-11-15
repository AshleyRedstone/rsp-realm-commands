import {Player, system, world} from "@minecraft/server";

world.afterEvents.entityItemDrop.subscribe((event) => {
    const player = event.entity;
    const data = event.items;
    console.log(`${player} + ${data}`);

    if (!(player instanceof Player)) return;
    if (!player.hasTag("nodrops")) return;

    system.run(() => {
        for (const item of event.items) {
            if (!item?.isValid) continue;

            item.remove();
        }
    });
});
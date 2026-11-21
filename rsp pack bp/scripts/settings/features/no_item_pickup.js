import {Player, system, world} from "@minecraft/server";

world.beforeEvents.entityItemPickup.subscribe(event => {
    const player = event.entity;
    if (!(player instanceof Player)) { return; }
    if (player.hasTag("no_item_pickup")) {
        event.cancel = true;
    }
})
import { Player, world } from "@minecraft/server";

world.afterEvents.entityItemDrop.subscribe(event => {
    const item = getItemDisplayName(event.items[0]);
    const player = event.entity;
    if (!(player instanceof Player)) { return; }
    if (player.hasTag("nodrops") === false) { return; }
    world.getDimension("overworld").runCommand(`execute at ${player.nameTag} run kill @e[type=item,r=2,name=`+`${item}`+`]`);
});

function getItemDisplayName(itemOrId) {
    if (typeof itemOrId === "object" && itemOrId.nameTag) {
        return itemOrId.nameTag;
    }
    const typeId = typeof itemOrId === "string" ? itemOrId : itemOrId.typeId;
    const rawName = typeId.includes(":") ? typeId.split(":")[1] : typeId;
    return rawName
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
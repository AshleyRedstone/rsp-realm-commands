import {BlockPermutation, system, world} from "@minecraft/server";

world.afterEvents.playerPlaceBlock.subscribe(event => {
    const player = event.player;
    const block = event.block;

    if (
        block.typeId === "minecraft:redstone_torch" &&
        player.hasTag("burnout_torch")
    ) {
        const facing = block.permutation.getState("torch_facing_direction");

        const attachedBlock = {
            top: block.below(),
            north: block.north(),
            south: block.south(),
            east: block.east(),
            west: block.west()
        }[facing];

        if (attachedBlock?.typeId === "minecraft:redstone_block") {
            system.runTimeout(() => {
                block.setType("minecraft:air");
            }, 4)
        }
    }
    if (block.typeId === "minecraft:cauldron" && player.hasTag("auto_cauldron")) {
        block.setPermutation(
            BlockPermutation.resolve("minecraft:cauldron", {
                fill_level: 6,
                cauldron_liquid: "water"
            })
        );
    }
    if (
        block.typeId.startsWith("minecraft:") &&
        block.typeId.endsWith("_slab") &&
        player.hasTag("auto_slab")
    ) {
        const permutation = block.permutation;

        if (permutation.getState("minecraft:vertical_half") !== undefined) {
            block.setPermutation(permutation.withState("minecraft:vertical_half", "top"));
        } else if (permutation.getState("top_slot_bit") !== undefined) {
            block.setPermutation(permutation.withState("top_slot_bit", true));
        }
    }
})
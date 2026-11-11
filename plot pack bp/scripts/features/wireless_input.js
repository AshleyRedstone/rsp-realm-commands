import {
    world,
    system,
    Player,
    EntityComponentTypes,
    CommandPermissionLevel,
    CustomCommandStatus
} from "@minecraft/server";

const WIRELESS_INPUT = "rsp:wireless_input";

// Register command
system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;

    const wirelessInputCommand = {
        name: "rsp:input",
        description: "Link a wireless input to a lever or button",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: true
    };

    registry.registerCommand(wirelessInputCommand, handleInputs);
});

// Get the block the player is looking at
function getLookedAtBlock(player) {
    const hit = player.getBlockFromViewDirection({
        maxDistance: 10
    });

    return hit?.block;
}

// Link held item to block
function handleInputs(origin) {
    const player = origin.sourceEntity;

    if (!(player instanceof Player)) {
        return {
            status: CustomCommandStatus.Failure,
            message: "This command must be executed by a player."
        };
    }

    const block = getLookedAtBlock(player);

    if (
        !block ||
        (
            block.typeId !== "minecraft:lever" &&
            !block.typeId.endsWith("_button")
        )
    ) {
        return {
            status: CustomCommandStatus.Failure,
            message: "You must look at a lever or button!"
        };
    }

    const location = block.location;
    const dimensionId = block.dimension.id;
    const playerSlot = player.selectedSlotIndex;

    system.run(() => {
        const inventory = player.getComponent(
            EntityComponentTypes.Inventory
        );

        const container = inventory?.container;
        if (!container) return;

        const item = container.getItem(playerSlot);
        if (!item) return;

        // Store the block coordinates directly as Vector3
        item.setDynamicProperty(WIRELESS_INPUT, location);

        // Store the dimension separately
        item.setDynamicProperty(
            "rsp:wireless_dimension",
            dimensionId
        );

        // Save modified item
        container.setItem(playerSlot, item);

        player.sendMessage({
            translate: "rsp.handleInputsSuccess"
        });
    });

    return {
        status: CustomCommandStatus.Success
    };
}

// Detect wireless input use
world.beforeEvents.itemUse.subscribe(event => {
    const location = event.itemStack.getDynamicProperty(WIRELESS_INPUT);
    const dimensionId = event.itemStack.getDynamicProperty("rsp:wireless_dimension");

    if (
        typeof location !== "object" ||
        location === null ||
        !("x" in location) ||
        !("y" in location) ||
        !("z" in location)
    ) return;

    if (typeof dimensionId !== "string") return;

    system.run(() => {
        try {
            const dimension = world.getDimension(dimensionId);
            const block = dimension.getBlock(location);

            if (!block) return;

            activateWirelessInput(block);
        } catch (error) {
            console.warn(error.stack ?? String(error));
        }
    });
});

function activateWirelessInput(block) {
    const typeId = block.typeId;

    if (
        typeId !== "minecraft:lever" &&
        !typeId.endsWith("_button")
    ) return;

    const stateName = typeId === "minecraft:lever"
        ? "open_bit"
        : "button_pressed_bit";

    const states = block.permutation.getAllStates();
    states[stateName] = !states[stateName];

    const stateString = Object.entries(states)
        .map(([key, value]) =>
            `"${key}"=${JSON.stringify(value)}`
        )
        .join(",");

    const { x, y, z } = block.location;

    if (typeId.endsWith("_button")) {
        const pressed = block.permutation.getState("button_pressed_bit");

        if (pressed) return;

        const { x, y, z } = block.location;
        const dimension = block.dimension;

        const states = block.permutation.getAllStates();

        function setButtonState(powered) {
            const updatedStates = {
                ...states,
                button_pressed_bit: powered
            };

            const stateString = Object.entries(updatedStates)
                .map(([key, value]) =>
                    `"${key}"=${JSON.stringify(value)}`
                )
                .join(",");

            dimension.runCommand(
                `setblock ${x} ${y} ${z} ${typeId} [${stateString}] destroy`
            );

            system.runTimeout(() => {
                dimension.runCommand(
                    `kill @e[type=item,x=${x},y=${y},z=${z},r=2]`
                );
            }, 1);
        }

        // Press button
        setButtonState(true);

        // Stone buttons: 20 ticks
        // Wooden buttons: 30 ticks
        const duration = (
            typeId === "minecraft:stone_button" ||
            typeId === "minecraft:polished_blackstone_button"
        ) ? 20 : 30;

        system.runTimeout(() => {
            const currentBlock = dimension.getBlock({ x, y, z });

            if (!currentBlock || currentBlock.typeId !== typeId) return;

            setButtonState(false);
        }, duration);

        return;
    }

    block.dimension.runCommand(
        `setblock ${x} ${y} ${z} ${typeId} [${stateString}] destroy`
    );

    system.runTimeout(() => {
        block.dimension.runCommand(
            `kill @e[type=item,x=${x},y=${y},z=${z},r=2]`
        );
    }, 1);
}
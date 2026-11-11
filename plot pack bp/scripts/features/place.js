import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { failure, success, sendTranslationNow, getCommandPlayer } from "../utils/commands.js";

// ============================================================
// /place
// ============================================================

export function handlePlaceCommand(origin) {
    const player = getCommandPlayer(origin);

    if (player === undefined) {
        return failure("This command can only be used by a player.");
    }

    system.run(() => {
        showPlaceMenu(player);
    });

    return success();
}


// ============================================================
// Place menu
// ============================================================

function showPlaceMenu(player) {
    const form = new ActionFormData()
        .title("Place")
        .body("Select what you want to place.")
        .button("Lectern")
        .button("Strider")
        .button("Powered Lightning Rod");

    form.show(player).then((response) => {
        if (
            response.canceled ||
            response.selection === undefined
        ) {
            return;
        }

        system.run(() => {
            switch (response.selection) {
                case 0:
                    placeLectern(player);
                    break;

                case 1:
                    placeStrider(player);
                    break;

                case 2:
                    showRodDirectionMenu(player);
                    break;
            }
        });
    }).catch((error) => {
        console.warn(
            `[Place Menu] Failed to show form: ${error}`
        );
    });
}


// ============================================================
// Lectern
// ============================================================

function placeLectern(player) {
    try {
        player.runCommand(
            "structure load lecturn ~ ~-1 ~"
        );

        sendTranslationNow(
            player,
            "plots.lectern.success"
        );
    }
    catch (error) {
        sendTranslationNow(
            player,
            "plots.lectern.failure",
            [String(error)]
        );
    }
}

function placeStrider(player) {
    try {
        player.runCommand(
            "structure load strider ~ ~-1 ~"
        );

        sendTranslationNow(
            player,
            "plots.strider.success"
        );
    }
    catch (error) {
        sendTranslationNow(
            player,
            "plots.strider.failure",
            [String(error)]
        );
    }
}

function placeRodFromPlayerDirection(player) {
    const yaw = player.getRotation().y;

    let direction;

    if (yaw >= -45 && yaw < 45) {
        direction = "south";
    }
    else if (yaw >= 45 && yaw < 135) {
        direction = "west";
    }
    else if (yaw >= -135 && yaw < -45) {
        direction = "east";
    }
    else {
        direction = "north";
    }

    placeRod(player, direction);
}

function showRodDirectionMenu(player) {
    const form = new ActionFormData()
        .title("Lightning Rod")
        .body("Select the direction the rod should face.")
        .button("Player Direction")
        .button("Up")
        .button("Down")
        .button("North")
        .button("South")
        .button("West")
        .button("East")
        .button("Back");

    form.show(player).then((response) => {
        if (
            response.canceled ||
            response.selection === undefined
        ) {
            return;
        }

        system.run(() => {
            switch (response.selection) {
                case 0:
                    placeRodFromPlayerDirection(player);
                    break;

                case 1:
                    placeRod(player, "up");
                    break;

                case 2:
                    placeRod(player, "down");
                    break;

                case 3:
                    placeRod(player, "north");
                    break;

                case 4:
                    placeRod(player, "south");
                    break;

                case 5:
                    placeRod(player, "west");
                    break;

                case 6:
                    placeRod(player, "east");
                    break;

                case 7:
                    showPlaceMenu(player);
                    break;
            }
        });
    }).catch((error) => {
        console.warn(
            `[Place Menu] Failed to show rod direction form: ${error}`
        );
    });
}

function placeRod(player, direction) {
    const directionNumbers = {
        down: 0,
        up: 1,
        north: 2,
        south: 3,
        west: 4,
        east: 5,
    };

    const directionNumber =
        directionNumbers[direction];

    try {
        player.runCommand(
            `setblock ~ ~-1 ~ minecraft:lightning_rod` +
            `["powered_bit"=true,"facing_direction"=${directionNumber}]`
        );

        player.sendMessage({
            translate: "plots.rod.success",
            with: [direction],
        });
    }
    catch (error) {
        player.sendMessage({
            translate: "plots.rod.failure",
            with: [String(error)],
        });
    }
}

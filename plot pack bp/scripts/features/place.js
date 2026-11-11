import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { failure, success, getCommandPlayer } from "../utils/commands.js";

// ============================================================
// /place
// ============================================================

export function handlePlaceCommand(origin) {
    const player = getCommandPlayer(origin);

    if (player === undefined) {
        return failure();
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
        .title({ translate: "rsp.place.title" })
        .body({ translate: "rsp.place.body" })
        .button({ translate: "rsp.place.lectern" })
        .button({ translate: "rsp.place.strider" })
        .button({ translate: "rsp.place.powered_rod" });

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

        player.sendMessage({ translate: "rsp.lectern.success", with: [] });
    }
    catch (error) {
        player.sendMessage({ translate: "rsp.lectern.failure", with: [String(error)] });
    }
}

function placeStrider(player) {
    try {
        player.runCommand(
            "structure load strider ~ ~-1 ~"
        );

        player.sendMessage({ translate: "rsp.strider.success", with: [] });
    }
    catch (error) {
        player.sendMessage({ translate: "rsp.strider.failure", with: [String(error)] });
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
        .title({ translate: "rsp.place.rod.title" })
        .body({ translate: "rsp.place.rod.body" })
        .button({ translate: "rsp.place.rod.player_direction" })
        .button({ translate: "rsp.direction.up" })
        .button({ translate: "rsp.direction.down" })
        .button({ translate: "rsp.direction.north" })
        .button({ translate: "rsp.direction.south" })
        .button({ translate: "rsp.direction.west" })
        .button({ translate: "rsp.direction.east" })
        .button({ translate: "rsp.place.back" });

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
            translate: "rsp.rod.success",
            with: [direction],
        });
    }
    catch (error) {
        player.sendMessage({
            translate: "rsp.rod.failure",
            with: [String(error)],
        });
    }
}

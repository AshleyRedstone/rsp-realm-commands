import {
    world,
    system,
    CommandPermissionLevel,
    CustomCommandStatus
} from "@minecraft/server";

import {
    ActionFormData,
    ModalFormData,
    MessageFormData
} from "@minecraft/server-ui";


// ============================================================
// COMMAND
// ============================================================

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerCommand(
        {
            name: "rsp:structures",
            description: "Browse and manage world structures",
            permissionLevel: CommandPermissionLevel.Any
        },
        (origin) => {
            const player = origin.sourceEntity;

            if (!player || player.typeId !== "minecraft:player") {
                return {
                    status: CustomCommandStatus.Failure,
                    message: "This command can only be used by a player."
                };
            }

            system.run(() => {
                showStructureBrowser(player);
            });

            return {
                status: CustomCommandStatus.Success
            };
        }
    );

    console.info("[Structure Browser] Command registered");
});


// ============================================================
// HELPERS
// ============================================================

function getStructures() {
    return world.structureManager
        .getWorldStructureIds()
        .sort((a, b) => a.localeCompare(b));
}


function getDisplayName(structureId) {
    const colon = structureId.indexOf(":");

    return colon === -1
        ? structureId
        : structureId.substring(colon + 1);
}


// ============================================================
// MAIN BROWSER
// ============================================================

function showStructureBrowser(player) {
    try {
        const structures = getStructures();

        if (structures.length === 0) {
            player.sendMessage("§eNo world structures found.");
            return;
        }

        const form = new ActionFormData()
            .title("World Structures")
            .body(`§7${structures.length} structure(s)`)
            .button("§lSearch\n§r§7Find a structure");

        for (const structureId of structures) {
            form.button(
                getDisplayName(structureId)
            );
        }

        form.show(player).then((response) => {
            system.run(() => {
                if (
                    response.canceled ||
                    response.selection === undefined
                ) {
                    return;
                }

                if (response.selection === 0) {
                    showSearch(player);
                    return;
                }

                const structureId =
                    structures[response.selection - 1];

                if (structureId) {
                    showStructureOptions(
                        player,
                        structureId
                    );
                }
            });
        }).catch((error) => {
            console.error(
                `[Structure Browser] Main form: ${error}`
            );
        });
    }
    catch (error) {
        console.error(
            `[Structure Browser] ${error}\n${error?.stack ?? ""}`
        );
    }
}


// ============================================================
// SEARCH
// ============================================================

function showSearch(player) {
    const form = new ModalFormData()
        .title("Search Structures")
        .textField(
            "Structure name",
            "e.g. piston_door"
        );

    form.show(player).then((response) => {
        system.run(() => {
            if (response.canceled) {
                showStructureBrowser(player);
                return;
            }

            const query = String(
                response.formValues?.[0] ?? ""
            )
                .trim()
                .toLowerCase();

            if (!query) {
                showStructureBrowser(player);
                return;
            }

            const structures = getStructures();

            const results = structures.filter(
                (structureId) =>
                    getDisplayName(structureId)
                        .toLowerCase()
                        .includes(query)
            );

            showSearchResults(
                player,
                query,
                results
            );
        });
    }).catch((error) => {
        console.error(
            `[Structure Browser] Search form: ${error}`
        );
    });
}


// ============================================================
// SEARCH RESULTS
// ============================================================

function showSearchResults(
    player,
    query,
    structures
) {
    const form = new ActionFormData()
        .title("Search Results")
        .body(
            `§7Search: §f${query}\n` +
            `§7${structures.length} result(s)`
        )
        .button("§lNew Search");

    for (const structureId of structures) {
        form.button(
            getDisplayName(structureId)
        );
    }

    form.show(player).then((response) => {
        system.run(() => {
            if (
                response.canceled ||
                response.selection === undefined
            ) {
                showStructureBrowser(player);
                return;
            }

            if (response.selection === 0) {
                showSearch(player);
                return;
            }

            const structureId =
                structures[response.selection - 1];

            if (structureId) {
                showStructureOptions(
                    player,
                    structureId
                );
            }
        });
    }).catch((error) => {
        console.error(
            `[Structure Browser] Results form: ${error}`
        );
    });
}


// ============================================================
// STRUCTURE OPTIONS
// ============================================================

function showStructureOptions(
    player,
    structureId
) {
    const form = new ActionFormData()
        .title(getDisplayName(structureId))
        .body(`§7${structureId}`)
        .button("§aLoad Structure")
        .button("§cDelete Structure")
        .button("Back");

    form.show(player).then((response) => {
        system.run(() => {
            if (
                response.canceled ||
                response.selection === undefined
            ) {
                return;
            }

            switch (response.selection) {
                case 0:
                    loadStructure(
                        player,
                        structureId
                    );
                    break;

                case 1:
                    confirmDelete(
                        player,
                        structureId
                    );
                    break;

                case 2:
                    showStructureBrowser(player);
                    break;
            }
        });
    }).catch((error) => {
        console.error(
            `[Structure Browser] Options form: ${error}`
        );
    });
}


// ============================================================
// DELETE CONFIRMATION
// ============================================================

function confirmDelete(
    player,
    structureId
) {
    const name =
        getDisplayName(structureId);

    const form = new MessageFormData()
        .title("Delete Structure?")
        .body(
            `Are you sure you want to delete:\n\n` +
            `§f${name}\n\n` +
            `§cThis cannot be undone.`
        )
        .button1("§cDelete")
        .button2("Cancel");

    form.show(player).then((response) => {
        system.run(() => {
            if (response.canceled) {
                return;
            }

            if (response.selection === 0) {
                deleteStructure(
                    player,
                    structureId
                );
            }
        });
    }).catch((error) => {
        console.error(
            `[Structure Browser] Delete confirmation: ${error}`
        );
    });
}


// ============================================================
// LOAD
// ============================================================

function loadStructure(
    player,
    structureId
) {
    try {
        const location = {
            x: Math.floor(player.location.x),
            y: Math.floor(player.location.y),
            z: Math.floor(player.location.z)
        };

        world.structureManager.place(
            structureId,
            player.dimension,
            location
        );

        player.sendMessage(
            `§aLoaded §f${getDisplayName(structureId)}§a at §f` +
            `${location.x} ${location.y} ${location.z}`
        );
    }
    catch (error) {
        console.error(
            `[Structure Browser] Failed to load ` +
            `${structureId}: ${error}`
        );

        player.sendMessage(
            `§cFailed to load §f${getDisplayName(structureId)}`
        );
    }
}


// ============================================================
// DELETE
// ============================================================

function deleteStructure(
    player,
    structureId
) {
    try {
        world.structureManager.delete(
            structureId
        );

        player.sendMessage(
            `§aDeleted structure §f${getDisplayName(structureId)}`
        );

        console.warn(
            `[Structure Browser] ${player.name} deleted ${structureId}`
        );

        // Re-open the browser with the deleted
        // structure removed.
        system.run(() => {
            showStructureBrowser(player);
        });
    }
    catch (error) {
        console.error(
            `[Structure Browser] Failed to delete ` +
            `${structureId}: ${error}`
        );

        player.sendMessage(
            `§cFailed to delete §f${getDisplayName(structureId)}`
        );
    }
}

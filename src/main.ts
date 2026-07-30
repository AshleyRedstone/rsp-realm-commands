import {
    CommandPermissionLevel,
    CustomCommand,
    CustomCommandOrigin,
    CustomCommandParamType,
    CustomCommandResult,
    CustomCommandStatus,
    Player,
    system,
    world,
} from "@minecraft/server";

interface PlotDestination {
    x: number;
    y: number;
    z: number;
}

type PlotDestinations = Record<string, PlotDestination>;

const STORAGE_KEY = "plots:destinations";
const HOME_PROPERTY = "plots:home";

const defaultDestinations: PlotDestinations = {
    spawn: { x: 0, y: 64, z: 0 },
};

function normaliseName(name: string): string {
    return name.trim().toLowerCase();
}

function loadDestinations(): PlotDestinations {
    const stored = world.getDynamicProperty(STORAGE_KEY);

    if (typeof stored !== "string") {
        return { ...defaultDestinations };
    }

    try {
        return JSON.parse(stored) as PlotDestinations;
    } catch {
        return { ...defaultDestinations };
    }
}

function saveDestinations(destinations: PlotDestinations): void {
    world.setDynamicProperty(
        STORAGE_KEY,
        JSON.stringify(destinations),
    );
}

function success(message?: string): CustomCommandResult {
    return {
        status: CustomCommandStatus.Success,
        message,
    };
}

function failure(message: string): CustomCommandResult {
    return {
        status: CustomCommandStatus.Failure,
        message,
    };
}

function sendTranslation(
    player: Player,
    key: string,
    parameters: string[] = [],
): void {
    system.run(() => {
        player.sendMessage({
            translate: key,
            with: parameters,
        });
    });
}

function translatedSuccess(
    player: Player,
    key: string,
    parameters: string[] = [],
): CustomCommandResult {
    sendTranslation(player, key, parameters);

    return success();
}

function translatedFailure(
    player: Player,
    key: string,
    parameters: string[] = [],
): CustomCommandResult {
    sendTranslation(player, key, parameters);

    return success();
}

function translatedOriginFailure(
    origin: CustomCommandOrigin,
    key: string,
    parameters: string[] = [],
): CustomCommandResult {
    const player = origin.sourceEntity;

    if (player instanceof Player) {
        return translatedFailure(
            player,
            key,
            parameters,
        );
    }

    return failure(key);
}

system.beforeEvents.startup.subscribe((event) => {
    const registry = event.customCommandRegistry;

    registry.registerEnum(
        "plots:plot_mode",
        ["visit", "home", "list", "admin"],
    );

    registry.registerEnum(
        "plots:short_mode",
        ["v", "h", "l", "a"],
    );

    registry.registerEnum(
    "plots:admin_action",
    ["set", "remove", "debug"],
);

registry.registerEnum(
    "plots:rod_direction",
    [
        "down",
        "up",
        "north",
        "south",
        "west",
        "east",
    ],
);

const lecternCommand: CustomCommand = {
    name: "plots:lectern",
    description: "Load the lectern structure",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
};

const shortLecternCommand: CustomCommand = {
    name: "plots:l",
    description: "Short alias for /lectern",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
};

const striderCommand: CustomCommand = {
    name: "plots:strider",
    description: "Load the strider structure",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
};

const shortStriderCommand: CustomCommand = {
    name: "plots:s",
    description: "Short alias for /strider",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
};

const rodCommand: CustomCommand = {
    name: "plots:rod",
    description: "Place a powered lightning rod",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,

    mandatoryParameters: [
        {
            name: "plots:rod_direction",
            type: CustomCommandParamType.Enum,
        },
    ],
};

const shortRodCommand: CustomCommand = {
    name: "plots:r",
    description: "Short alias for /rod",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,

    mandatoryParameters: [
        {
            name: "plots:rod_direction",
            type: CustomCommandParamType.Enum,
        },
    ],
};

    const plotCommand: CustomCommand = {
        name: "plots:plot",
        description: "Visit or manage plot destinations",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,

        mandatoryParameters: [
            {
                name: "plots:plot_mode",
                type: CustomCommandParamType.Enum,
            },
        ],

        optionalParameters: [
            {
                name: "argument",
                type: CustomCommandParamType.String,
            },
            {
                name: "destination",
                type: CustomCommandParamType.String,
            },
            {
                name: "x",
                type: CustomCommandParamType.Float,
            },
            {
                name: "y",
                type: CustomCommandParamType.Float,
            },
            {
                name: "z",
                type: CustomCommandParamType.Float,
            },
        ],
    };

    const shortPlotCommand: CustomCommand = {
        name: "plots:p",
        description: "Short alias for /plot",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,

        mandatoryParameters: [
            {
                name: "plots:short_mode",
                type: CustomCommandParamType.Enum,
            },
        ],

        optionalParameters: [
            {
                name: "argument",
                type: CustomCommandParamType.String,
            },
            {
                name: "destination",
                type: CustomCommandParamType.String,
            },
            {
                name: "x",
                type: CustomCommandParamType.Float,
            },
            {
                name: "y",
                type: CustomCommandParamType.Float,
            },
            {
                name: "z",
                type: CustomCommandParamType.Float,
            },
        ],
    };

    registry.registerCommand(
        plotCommand,
        handlePlotCommand,
    );

    registry.registerCommand(
        shortPlotCommand,
        handleShortPlotCommand,
    );
    
    registry.registerCommand(
    lecternCommand,
    handleLecternCommand,
);

registry.registerCommand(
    shortLecternCommand,
    handleLecternCommand,
);

registry.registerCommand(
    striderCommand,
    handleStriderCommand,
);

registry.registerCommand(
    shortStriderCommand,
    handleStriderCommand,
);

registry.registerCommand(
    rodCommand,
    handleRodCommand,
);

registry.registerCommand(
    shortRodCommand,
    handleRodCommand,
);

});


function handlePlotCommand(
    origin: CustomCommandOrigin,
    mode: string,
    argument?: string,
    destinationName?: string,
    x?: number,
    y?: number,
    z?: number,
): CustomCommandResult {
    switch (mode.toLowerCase()) {
        case "visit":
            return visitDestination(origin, argument);

        case "home":
            return handleHomeCommand(
                origin,
                argument,
                destinationName,
            );

        case "list":
            return listDestinations(origin);

        case "admin":
            return handleAdminCommand(
                origin,
                argument,
                destinationName,
                x,
                y,
                z,
            );

        default:
            return translatedOriginFailure(
                origin,
                "plots.command.unknown",
                [mode],
            );
    }
}

function handleShortPlotCommand(
    origin: CustomCommandOrigin,
    mode: string,
    argument?: string,
    destinationName?: string,
    x?: number,
    y?: number,
    z?: number,
): CustomCommandResult {
    switch (mode.toLowerCase()) {
        case "v":
            return visitDestination(origin, argument);

        case "h":
            return handleHomeCommand(
                origin,
                argument,
                destinationName,
            );

        case "l":
            return listDestinations(origin);

        case "a":
            return handleAdminCommand(
                origin,
                argument,
                destinationName,
                x,
                y,
                z,
            );

        default:
            return translatedOriginFailure(
                origin,
                "plots.command.unknown_alias",
                [mode],
            );
    }
}

function visitDestination(
    origin: CustomCommandOrigin,
    destinationName?: string,
): CustomCommandResult {
    const player = origin.sourceEntity;

    if (!(player instanceof Player)) {
        return failure(
            "This command can only be used by a player.",
        );
    }

    if (destinationName === undefined) {
        return translatedFailure(
            player,
            "plots.visit.usage",
        );
    }

    const key = normaliseName(destinationName);
    const destinations = loadDestinations();
    const destination = destinations[key];

    if (!destination) {
        return translatedFailure(
            player,
            "plots.visit.unknown",
            [key],
        );
    }

    system.run(() => {
        player.teleport(destination);

        player.sendMessage({
            translate: "plots.visit.success",
            with: [key],
        });
    });

    return {
        status: CustomCommandStatus.Success,
    };
}

function listDestinations(
    origin: CustomCommandOrigin,
): CustomCommandResult {
    const player = origin.sourceEntity;

    if (!(player instanceof Player)) {
        return failure(
            "This command can only be used by a player.",
        );
    }

    const destinations = loadDestinations();
    const names = Object.keys(destinations).sort();

    if (names.length === 0) {
        return translatedSuccess(
            player,
            "plots.list.empty",
        );
    }

    const list = names
        .map((name) => {
            const location = destinations[name];

            return (
                `${name} ` +
                `(${location.x.toFixed(2)}, ` +
                `${location.y.toFixed(2)}, ` +
                `${location.z.toFixed(2)})`
            );
        })
        .join(", ");

    return translatedSuccess(
        player,
        "plots.list.header",
        [list],
    );
}

function handleHomeCommand(
    origin: CustomCommandOrigin,
    action?: string,
    destinationName?: string,
): CustomCommandResult {
    const player = origin.sourceEntity;

    if (!(player instanceof Player)) {
        return failure(
            "This command can only be used by a player.",
        );
    }

    if (action === undefined) {
        return teleportHome(player);
    }

    if (action.toLowerCase() === "set") {
        if (destinationName === undefined) {
            return translatedFailure(
                player,
                "plots.home.usage",
            );
        }

        return setHome(player, destinationName);
    }

    return translatedFailure(
        player,
        "plots.home.unknown_action",
        [action],
    );
}

function setHome(
    player: Player,
    destinationName: string,
): CustomCommandResult {
    const key = normaliseName(destinationName);
    const destinations = loadDestinations();

    if (!destinations[key]) {
        return translatedFailure(
            player,
            "plots.visit.unknown",
            [key],
        );
    }

    system.run(() => {
        player.setDynamicProperty(
            HOME_PROPERTY,
            key,
        );

        player.sendMessage({
            translate: "plots.home.set",
            with: [key],
        });
    });

    return {
        status: CustomCommandStatus.Success,
    };
}

function teleportHome(
    player: Player,
): CustomCommandResult {
    const storedHome =
        player.getDynamicProperty(HOME_PROPERTY);

    if (typeof storedHome !== "string") {
        return translatedFailure(
            player,
            "plots.home.not_set",
        );
    }

    const key = normaliseName(storedHome);
    const destinations = loadDestinations();
    const destination = destinations[key];

    if (!destination) {
        return translatedFailure(
            player,
            "plots.home.deleted",
            [key],
        );
    }

    system.run(() => {
        player.teleport(destination);

        player.sendMessage({
            translate: "plots.home.teleported",
            with: [key],
        });
    });

    return {
        status: CustomCommandStatus.Success,
    };
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KiB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function formatDynamicPropertyValue(
    value: boolean | number | string | object | undefined,
): string {
    if (value === undefined) {
        return "undefined";
    }

    if (typeof value === "string") {
        const preview =
            value.length > 100
                ? `${value.slice(0, 100)}…`
                : value;

        return `"${preview}"`;
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value);
}

function dumpDynamicPropertyUsage(
    player: Player,
): CustomCommandResult {
    const propertyIds = world
        .getDynamicPropertyIds()
        .sort();

    const totalBytes =
        world.getDynamicPropertyTotalByteCount();

    system.run(() => {
        player.sendMessage("§6World dynamic-property debug");
        player.sendMessage(
            `§7Properties: §f${propertyIds.length}`,
        );
        player.sendMessage(
            `§7Total storage: §f${formatBytes(totalBytes)} ` +
            `§8(${totalBytes} bytes)`,
        );

        if (propertyIds.length === 0) {
            player.sendMessage(
                "§7No world dynamic properties are stored.",
            );

            return;
        }

        player.sendMessage("§7Stored properties:");

        for (const id of propertyIds) {
            const value = world.getDynamicProperty(id);

            player.sendMessage(
                `§8- §f${id}§7: ` +
                formatDynamicPropertyValue(value),
            );
        }

        const playerBytes =
            player.getDynamicPropertyTotalByteCount();

        const playerPropertyIds =
            player.getDynamicPropertyIds().sort();

        player.sendMessage("");
        player.sendMessage("§6Your player properties");
        player.sendMessage(
            `§7Properties: §f${playerPropertyIds.length}`,
        );
        player.sendMessage(
            `§7Total storage: §f${formatBytes(playerBytes)} ` +
            `§8(${playerBytes} bytes)`,
        );

        for (const id of playerPropertyIds) {
            const value = player.getDynamicProperty(id);

            player.sendMessage(
                `§8- §f${id}§7: ` +
                formatDynamicPropertyValue(value),
            );
        }
    });

    return success();
}

function getCommandPlayer(
    origin: CustomCommandOrigin,
): Player | undefined {
    const source = origin.sourceEntity;

    if (!(source instanceof Player)) {
        return undefined;
    }

    return source;
}

function handleLecternCommand(
    origin: CustomCommandOrigin,
): CustomCommandResult {
    const player = getCommandPlayer(origin);

    if (player === undefined) {
        return failure(
            "This command can only be used by a player.",
        );
    }

    system.run(() => {
        player.runCommand(
            "structure load lecturn ~ ~-1 ~",
        );
    });

    return success();
}

function handleStriderCommand(
    origin: CustomCommandOrigin,
): CustomCommandResult {
    const player = getCommandPlayer(origin);

    if (player === undefined) {
        return failure(
            "This command can only be used by a player.",
        );
    }

    system.run(() => {
        player.runCommand(
            "structure load strider ~ ~-1 ~",
        );
    });

    return success();
}

const ROD_DIRECTIONS: Record<string, number> = {
    down: 0,
    up: 1,
    north: 2,
    south: 3,
    west: 4,
    east: 5,
};

function handleRodCommand(
    origin: CustomCommandOrigin,
    direction: string,
): CustomCommandResult {
    const player = getCommandPlayer(origin);

    if (player === undefined) {
        return failure(
            "This command can only be used by a player.",
        );
    }

    const directionNumber =
        ROD_DIRECTIONS[direction.toLowerCase()];

    if (directionNumber === undefined) {
        return failure(
            `Unknown rod direction "${direction}".`,
        );
    }

    system.run(() => {
        player.runCommand(
            "setblock ~ ~-1 ~ " +
            "minecraft:lightning_rod" +
            `["powered_bit"=true,` +
            `"facing_direction"=${directionNumber}]`,
        );
    });

    return success();
}

function handleAdminCommand(
    origin: CustomCommandOrigin,
    action?: string,
    destinationName?: string,
    x?: number,
    y?: number,
    z?: number,
): CustomCommandResult {
    const player = origin.sourceEntity;

    if (!(player instanceof Player)) {
        return failure(
            "This command can only be used by a player.",
        );
    }

    if (!player.hasTag("plot_admin")) {
        return translatedFailure(
            player,
            "plots.error.no_permission",
        );
    }

    if (action === undefined) {
        return translatedFailure(
            player,
            "plots.admin.usage",
        );
    }

    const destinations = loadDestinations();

    switch (action.toLowerCase()) {
        case "set": {
            if (destinationName === undefined) {
                return translatedFailure(
                    player,
                    "plots.admin.set_usage",
                );
            }

            const location = player.location;

            const finalX = x ?? location.x;
            const finalY = y ?? location.y;
            const finalZ = z ?? location.z;

            const key = normaliseName(destinationName);
            const alreadyExists =
                destinations[key] !== undefined;

            destinations[key] = {
                x: finalX,
                y: finalY,
                z: finalZ,
            };

            system.run(() => {
                saveDestinations(destinations);
            });

            return translatedSuccess(
                player,
                alreadyExists
                    ? "plots.admin.updated"
                    : "plots.admin.added",
                [
                    key,
                    finalX.toFixed(2),
                    finalY.toFixed(2),
                    finalZ.toFixed(2),
                ],
            );
        }

        case "remove": {
            if (destinationName === undefined) {
                return translatedFailure(
                    player,
                    "plots.admin.remove_usage",
                );
            }

            const key = normaliseName(destinationName);

            if (!destinations[key]) {
                return translatedFailure(
                    player,
                    "plots.admin.missing",
                    [key],
                );
            }

            delete destinations[key];

            system.run(() => {
                saveDestinations(destinations);
            });

            return translatedSuccess(
                player,
                "plots.admin.removed",
                [key],
            );
        }
        
        case "debug":
    return dumpDynamicPropertyUsage(player);

        default:
            return translatedFailure(
                player,
                "plots.admin.unknown_action",
                [action],
            );
    }
}
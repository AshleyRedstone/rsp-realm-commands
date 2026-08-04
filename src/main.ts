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
    rx: number;
    ry: number;
}

type PlotDestinations = Record<string, PlotDestination>;

interface BackLocation {
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    dimension: string;
}

interface PlayerSnapshot extends BackLocation {}

const playerSnapshots = new Map<string, PlayerSnapshot>();

// A movement of at least this many blocks in one tick is treated as a teleport.
// Increase this if very fast travel causes false positives.
const TELEPORT_DETECTION_DISTANCE = 8;
const TELEPORT_DETECTION_DISTANCE_SQUARED =
    TELEPORT_DETECTION_DISTANCE * TELEPORT_DETECTION_DISTANCE;


const STORAGE_KEY = "plots:destinations";
const HOME_PROPERTY = "plots:home";
const BACK_PROPERTY = "plots:back";
const PING_WHITELIST_PROPERTY = "plots:ping_whitelist";
const PING_BLACKLIST_PROPERTY = "plots:ping_blacklist";

const defaultDestinations: PlotDestinations = {
    spawn: {
        x: 0,
        y: 64,
        z: 0,
        rx: 0,
        ry: 0,
    },
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

function sendTranslationNow(
    player: Player,
    key: string,
    parameters: string[] = [],
): void {
    player.sendMessage({
        translate: key,
        with: parameters,
    });
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

registry.registerEnum(
    "plots:ping_list",
    ["whitelist", "blacklist"],
);

registry.registerEnum(
    "plots:ping_action",
    ["add", "remove", "list", "clear"],
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

const backCommand: CustomCommand = {
    name: "plots:back",
    description: "Return to your previous location",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
};

const shortBackCommand: CustomCommand = {
    name: "plots:b",
    description: "Short alias for /back",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
};

registry.registerCommand(
    backCommand,
    handleBackCommand,
);

registry.registerCommand(
    shortBackCommand,
    handleBackCommand,
);

const pingCommand: CustomCommand = {
    name: "plots:ping",
    description: "Manage your personal ping words",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,

    mandatoryParameters: [
        {
            name: "plots:ping_list",
            type: CustomCommandParamType.Enum,
        },
        {
            name: "plots:ping_action",
            type: CustomCommandParamType.Enum,
        },
    ],

    optionalParameters: [
        {
            name: "phrase",
            type: CustomCommandParamType.String,
        },
    ],
};

registry.registerCommand(
    pingCommand,
    handlePingCommand,
);

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
    
});

function createPlayerSnapshot(player: Player): PlayerSnapshot {
    const rotation = player.getRotation();

    return {
        x: player.location.x,
        y: player.location.y,
        z: player.location.z,
        rx: rotation.x,
        ry: rotation.y,
        dimension: player.dimension.id,
    };
}

function saveBackSnapshot(
    player: Player,
    snapshot: PlayerSnapshot,
): void {
    const backLocation: BackLocation = {
        x: Math.round(snapshot.x),
        y: Math.round(snapshot.y),
        z: Math.round(snapshot.z),
        rx: Math.round(snapshot.rx),
        ry: Math.round(snapshot.ry),
        dimension: snapshot.dimension,
    };

    player.setDynamicProperty(
        BACK_PROPERTY,
        JSON.stringify(backLocation),
    );
}

function saveCurrentLocationAsBack(player: Player): void {
    saveBackSnapshot(
        player,
        createPlayerSnapshot(player),
    );
}

system.runInterval(() => {
    const activePlayerIds = new Set<string>();

    for (const player of world.getAllPlayers()) {
        activePlayerIds.add(player.id);

        const current = createPlayerSnapshot(player);
        const previous = playerSnapshots.get(player.id);

        if (previous !== undefined) {
            const dimensionChanged =
                previous.dimension !== current.dimension;

            const dx = current.x - previous.x;
            const dy = current.y - previous.y;
            const dz = current.z - previous.z;
            const distanceSquared =
                dx * dx + dy * dy + dz * dz;

            if (
                dimensionChanged ||
                distanceSquared >=
                    TELEPORT_DETECTION_DISTANCE_SQUARED
            ) {
                saveBackSnapshot(player, previous);
            }
        }

        playerSnapshots.set(player.id, current);
    }

    for (const playerId of playerSnapshots.keys()) {
        if (!activePlayerIds.has(playerId)) {
            playerSnapshots.delete(playerId);
        }
    }
}, 1);

function getCommandPlayer(
    origin: CustomCommandOrigin,
): Player | undefined {
    const source = origin.sourceEntity;

    if (source instanceof Player) {
        return source;
    }

    return undefined;
}

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
        saveCurrentLocationAsBack(player);

        player.teleport(
    {
        x: destination.x,
        y: destination.y,
        z: destination.z,
    },
    {
        rotation: {
            x: destination.rx ?? 0,
            y: destination.ry ?? 0,
        },
    },
);

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
            const destination = destinations[name];

            return (
                `${name} ` +
                `(${destination.x}, ` +
                `${destination.y}, ` +
                `${destination.z}) ` +
                `[${destination.rx ?? 0}, ` +
                `${destination.ry ?? 0}]`
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
        saveCurrentLocationAsBack(player);

        player.teleport(
    {
        x: destination.x,
        y: destination.y,
        z: destination.z,
    },
    {
        rotation: {
            x: destination.rx ?? 0,
            y: destination.ry ?? 0,
        },
    },
);

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
        sendTranslationNow(
            player,
            "plots.debug.header",
        );

        sendTranslationNow(
            player,
            "plots.debug.property_count",
            [String(propertyIds.length)],
        );

        sendTranslationNow(
            player,
            "plots.debug.total_storage",
            [
                formatBytes(totalBytes),
                String(totalBytes),
            ],
        );

        if (propertyIds.length === 0) {
            sendTranslationNow(
                player,
                "plots.debug.empty",
            );
        } else {
            sendTranslationNow(
                player,
                "plots.debug.properties_header",
            );

            for (const id of propertyIds) {
                const value =
                    world.getDynamicProperty(id);

                sendTranslationNow(
                    player,
                    "plots.debug.property",
                    [
                        id,
                        formatDynamicPropertyValue(value),
                    ],
                );
            }
        }

        const playerPropertyIds = player
            .getDynamicPropertyIds()
            .sort();

        const playerBytes =
            player.getDynamicPropertyTotalByteCount();

        sendTranslationNow(
            player,
            "plots.debug.player_header",
        );

        sendTranslationNow(
            player,
            "plots.debug.player_property_count",
            [String(playerPropertyIds.length)],
        );

        sendTranslationNow(
            player,
            "plots.debug.player_total_storage",
            [
                formatBytes(playerBytes),
                String(playerBytes),
            ],
        );

        if (playerPropertyIds.length === 0) {
            sendTranslationNow(
                player,
                "plots.debug.player_empty",
            );
        } else {
            for (const id of playerPropertyIds) {
                const value =
                    player.getDynamicProperty(id);

                sendTranslationNow(
                    player,
                    "plots.debug.player_property",
                    [
                        id,
                        formatDynamicPropertyValue(value),
                    ],
                );
            }
        }
    });

    return success();
}

function handleBackCommand(
    origin: CustomCommandOrigin,
): CustomCommandResult {
    const player = getCommandPlayer(origin);

    if (player === undefined) {
        return failure(
            "This command can only be used by a player.",
        );
    }

    const storedBack =
        player.getDynamicProperty(BACK_PROPERTY);

    if (typeof storedBack !== "string") {
        return translatedFailure(
            player,
            "plots.back.none",
        );
    }

    let back: BackLocation;

    try {
        back = JSON.parse(storedBack) as BackLocation;
    } catch {
        return translatedFailure(
            player,
            "plots.back.invalid",
        );
    }

    system.run(() => {
        try {
            player.teleport(
                {
                    x: back.x,
                    y: back.y,
                    z: back.z,
                },
                {
                    dimension: world.getDimension(
                        back.dimension,
                    ),
                    rotation: {
                        x: back.rx,
                        y: back.ry,
                    },
                },
            );

            sendTranslationNow(
                player,
                "plots.back.success",
            );
        } catch (error) {
            sendTranslationNow(
                player,
                "plots.back.failure",
                [String(error)],
            );
        }
    });

    return success();
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
        try {
            player.runCommand(
                "structure load lecturn ~ ~-1 ~",
            );

            sendTranslationNow(
                player,
                "plots.lectern.success",
            );
        } catch (error) {
            sendTranslationNow(
                player,
                "plots.lectern.failure",
                [String(error)],
            );
        }
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
        try {
            player.runCommand(
                "structure load strider ~ ~-1 ~",
            );

            sendTranslationNow(
                player,
                "plots.strider.success",
            );
        } catch (error) {
            sendTranslationNow(
                player,
                "plots.strider.failure",
                [String(error)],
            );
        }
    });

    return success();
}

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

    const directionNumbers: Record<string, number> = {
        down: 0,
        up: 1,
        north: 2,
        south: 3,
        west: 4,
        east: 5,
    };

    const normalisedDirection =
        direction.toLowerCase();

    const directionNumber =
        directionNumbers[normalisedDirection];

    if (directionNumber === undefined) {
        return translatedFailure(
            player,
            "plots.rod.unknown_direction",
            [direction],
        );
    }

    system.run(() => {
        try {
            player.runCommand(
                `setblock ~ ~-1 ~ minecraft:lightning_rod` +
                `["powered_bit"=true,"facing_direction"=${directionNumber}]`,
            );

            player.sendMessage({
                translate: "plots.rod.success",
                with: [normalisedDirection],
            });
        } catch (error) {
            player.sendMessage({
                translate: "plots.rod.failure",
                with: [String(error)],
            });
        }
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
    const rotation = player.getRotation();

    const finalX = Math.round(x ?? location.x);
    const finalY = Math.round(y ?? location.y);
    const finalZ = Math.round(z ?? location.z);

    const finalRotationX = Math.round(rotation.x);
    const finalRotationY = Math.round(rotation.y);

    const key = normaliseName(destinationName);
    const alreadyExists =
        destinations[key] !== undefined;

    destinations[key] = {
        x: finalX,
        y: finalY,
        z: finalZ,
        rx: finalRotationX,
        ry: finalRotationY,
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
            String(finalX),
            String(finalY),
            String(finalZ),
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

interface PingRules {
    whitelist: string[];
    blacklist: string[];
}

type PingListType = "whitelist" | "blacklist";
type PingAction = "add" | "remove" | "list" | "clear";

const PING_SOUND = "random.orb";

function normalisePingPhrase(phrase: string): string {
    return phrase.trim().toLowerCase();
}

function loadPingList(
    player: Player,
    propertyId: string,
): string[] {
    const stored = player.getDynamicProperty(propertyId);

    if (typeof stored !== "string") {
        return [];
    }

    try {
        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((value): value is string =>
                typeof value === "string",
            )
            .map(normalisePingPhrase)
            .filter((value) => value.length > 0);
    } catch {
        return [];
    }
}

function savePingList(
    player: Player,
    propertyId: string,
    values: string[],
): void {
    const uniqueValues = [...new Set(
        values
            .map(normalisePingPhrase)
            .filter((value) => value.length > 0),
    )];

    if (uniqueValues.length === 0) {
        player.setDynamicProperty(propertyId, undefined);
        return;
    }

    player.setDynamicProperty(
        propertyId,
        JSON.stringify(uniqueValues),
    );
}

function getPingListProperty(
    listType: PingListType,
): string {
    return listType === "whitelist"
        ? PING_WHITELIST_PROPERTY
        : PING_BLACKLIST_PROPERTY;
}

function getPingRules(player: Player): PingRules {
    return {
        whitelist: loadPingList(
            player,
            PING_WHITELIST_PROPERTY,
        ),
        blacklist: loadPingList(
            player,
            PING_BLACKLIST_PROPERTY,
        ),
    };
}

function handlePingCommand(
    origin: CustomCommandOrigin,
    listTypeArgument: string,
    actionArgument: string,
    phraseArgument?: string,
): CustomCommandResult {
    const player = getCommandPlayer(origin);

    if (player === undefined) {
        return failure(
            "This command can only be used by a player.",
        );
    }

    const listType =
        listTypeArgument.toLowerCase() as PingListType;

    const action =
        actionArgument.toLowerCase() as PingAction;

    if (
        listType !== "whitelist" &&
        listType !== "blacklist"
    ) {
        return translatedFailure(
            player,
            "plots.ping.unknown_list",
            [listTypeArgument],
        );
    }

    const propertyId = getPingListProperty(listType);
    const values = loadPingList(player, propertyId);

    switch (action) {
        case "add": {
            if (phraseArgument === undefined) {
                return translatedFailure(
                    player,
                    "plots.ping.phrase_required",
                );
            }

            const phrase =
                normalisePingPhrase(phraseArgument);

            if (phrase.length === 0) {
                return translatedFailure(
                    player,
                    "plots.ping.phrase_required",
                );
            }

            if (values.includes(phrase)) {
                return translatedFailure(
                    player,
                    "plots.ping.already_exists",
                    [phrase, listType],
                );
            }

            system.run(() => {
                savePingList(
                    player,
                    propertyId,
                    [...values, phrase],
                );
            });

            return translatedSuccess(
                player,
                "plots.ping.added",
                [phrase, listType],
            );
        }

        case "remove": {
            if (phraseArgument === undefined) {
                return translatedFailure(
                    player,
                    "plots.ping.phrase_required",
                );
            }

            const phrase =
                normalisePingPhrase(phraseArgument);

            if (!values.includes(phrase)) {
                return translatedFailure(
                    player,
                    "plots.ping.not_found",
                    [phrase, listType],
                );
            }

            system.run(() => {
                savePingList(
                    player,
                    propertyId,
                    values.filter(
                        (value) => value !== phrase,
                    ),
                );
            });

            return translatedSuccess(
                player,
                "plots.ping.removed",
                [phrase, listType],
            );
        }

        case "list": {
            if (values.length === 0) {
                return translatedSuccess(
                    player,
                    "plots.ping.list_empty",
                    [listType],
                );
            }

            return translatedSuccess(
                player,
                "plots.ping.list",
                [
                    listType,
                    values.join(", "),
                ],
            );
        }

        case "clear": {
            system.run(() => {
                player.setDynamicProperty(
                    propertyId,
                    undefined,
                );
            });

            return translatedSuccess(
                player,
                "plots.ping.cleared",
                [listType],
            );
        }

        default:
            return translatedFailure(
                player,
                "plots.ping.unknown_action",
                [actionArgument],
            );
    }
}

world.beforeEvents.chatSend.subscribe((event) => {
    const sender = event.sender;
    const originalMessage = event.message;

    event.cancel = true;

    system.run(() => {
        let formattedMessage = originalMessage;

        for (const target of world.getAllPlayers()) {
            const rules = getPingRules(target);

            const matchedTerms = getMatchedPingTerms(
                originalMessage,
                target,
                rules,
            );

            if (matchedTerms.length === 0) {
                continue;
            }

            for (const term of matchedTerms) {
                formattedMessage = highlightPingTerm(
                    formattedMessage,
                    term,
                );
            }

            if (target.id !== sender.id) {
                target.runCommand(
                    "playsound random.orb @s ~ ~ ~ 1 1",
                );
            }
        }

        world.sendMessage(
            `<${sender.name}> ${formattedMessage}`,
        );
    });
});

function getMatchedPingTerms(
    message: string,
    target: Player,
    rules: PingRules,
): string[] {
    const matchedTerms: string[] = [];

    const containsBlacklistedTerm =
        rules.blacklist.some(
            (term) => containsPingTerm(message, term),
        );

    if (containsBlacklistedTerm) {
        return matchedTerms;
    }

    const playerMention = `@${target.name}`;

    if (containsPingTerm(message, playerMention)) {
        matchedTerms.push(playerMention);
    }

    for (const term of rules.whitelist) {
        if (containsPingTerm(message, term)) {
            matchedTerms.push(term);
        }
    }

    return matchedTerms;
}

function highlightPingTerm(
    message: string,
    term: string,
): string {
    const cleanedTerm = term.trim();

    if (cleanedTerm.length === 0) {
        return message;
    }

    const pattern = new RegExp(
        `(^|[^\\p{L}\\p{N}_])` +
        `(${escapePingRegex(cleanedTerm)})` +
        `(?=$|[^\\p{L}\\p{N}_])`,
        "giu",
    );

    return message.replace(
        pattern,
        `$1§e$2§r`,
    );
}

function processPings(
    sender: Player,
    message: string,
): void {
    for (const target of world.getAllPlayers()) {
        // Do not allow players to ping themselves.
        if (target.id === sender.id) {
            continue;
        }

        const rules = getPingRules(target);

        if (!shouldPingPlayer(message, target, rules)) {
            continue;
        }

        target.playSound(PING_SOUND, {
            volume: 1,
            pitch: 1,
        });
    }
}

function shouldPingPlayer(
    message: string,
    target: Player,
    rules: PingRules,
): boolean {
    /*
     * A blacklisted phrase suppresses the ping for this player,
     * even when another valid trigger is also present.
     */
    const containsBlacklistedTerm = rules.blacklist.some(
        (term) => containsPingTerm(message, term),
    );

    if (containsBlacklistedTerm) {
        return false;
    }

    // Every player's normal @name mention works automatically.
    if (containsPingTerm(message, `@${target.name}`)) {
        return true;
    }

    // Personal whitelist entries also trigger a ping.
    return rules.whitelist.some(
        (term) => containsPingTerm(message, term),
    );
}

function containsPingTerm(
    message: string,
    term: string,
): boolean {
    const cleanedTerm = term.trim();

    if (cleanedTerm.length === 0) {
        return false;
    }

    const pattern = new RegExp(
        `(^|[^\\p{L}\\p{N}_])` +
        `${escapePingRegex(cleanedTerm)}` +
        `(?=$|[^\\p{L}\\p{N}_])`,
        "iu",
    );

    return pattern.test(message);
}

function escapePingRegex(text: string): string {
    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
    );
}

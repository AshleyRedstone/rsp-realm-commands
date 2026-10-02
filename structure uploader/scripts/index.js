import {
    world,
    system,
    BlockPermutation,
    ItemStack,
    StructureSaveMode,
    SignSide,
    DyeColor
} from "@minecraft/server";

import {
    http,
    HttpRequest,
    HttpRequestMethod,
    HttpHeader
} from "@minecraft/server-net";

import "./command.js";

const API = "http://127.0.0.1:3000";
const POLL_TICKS = 40;
const STRUCTURE_NAMESPACE = "mystructure";

const STAGING = {
    dimension: "minecraft:overworld",
    location: { x: 0, y: -60, z: 0 }
};

const MAX_MUTATION_LOGS = 100;

let polling = false;

function nextTick() {
    return new Promise(resolve => system.run(resolve));
}

function requestJson(
    url,
    method = HttpRequestMethod.Get
) {
    const request = new HttpRequest(url);

    request.method = method;

    request.headers = [
        new HttpHeader(
            "Accept",
            "application/json"
        )
    ];

    return http.request(request).then(response => {
        if (
            response.status < 200 ||
            response.status >= 300
        ) {
            throw new Error(
                `HTTP ${response.status}: ${response.body}`
            );
        }

        return response.body
            ? JSON.parse(response.body)
            : null;
    });
}

function flatIndexToLocation(index, size) {
    const yz = size.y * size.z;

    const x = Math.floor(index / yz);

    const remainder = index % yz;

    return {
        x,
        y: Math.floor(remainder / size.z),
        z: remainder % size.z
    };
}

function add(a, b) {
    return {
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z
    };
}

function resolvePermutation(entry) {
    try {
        return BlockPermutation.resolve(
            entry.name,
            entry.states ?? {}
        );
    } catch {
        try {
            const fallback =
                BlockPermutation.resolve(
                    entry.name
                );

            console.warn(
                `[Structure Import] ${entry.name}: ` +
                `rejected states ` +
                `${JSON.stringify(entry.states ?? {})}; ` +
                `using default permutation.`
            );

            return fallback;
        } catch (fallbackError) {
            console.error(
                `[Structure Import] Cannot resolve ` +
                `${entry.name} ` +
                `${JSON.stringify(entry.states ?? {})}: ` +
                `${fallbackError}`
            );

            return null;
        }
    }
}

function getBlockEntityEntries(data) {
    const entries = [];

    for (
        const [flatIndexText, value]
        of Object.entries(
            data.blockPositionData ?? {}
        )
    ) {
        const blockEntity =
            value?.block_entity_data;

        const flatIndex =
            Number(flatIndexText);

        if (
            !blockEntity ||
            !Number.isInteger(flatIndex) ||
            flatIndex < 0
        ) {
            continue;
        }

        entries.push({
            flatIndex,
            blockEntity
        });
    }

    return entries;
}

function describePermutation(permutation) {
    return (
        `${permutation.type.id} ` +
        `${JSON.stringify(
            permutation.getAllStates()
        )}`
    );
}

function compareStagingToExpected(
    data,
    dimension,
    permutations
) {
    const primary =
        data.blockIndices?.[0];

    const differences = [];

    if (!Array.isArray(primary)) {
        return differences;
    }

    for (
        let i = 0;
        i < primary.length;
        i++
    ) {
        const paletteIndex =
            primary[i];

        if (paletteIndex === -1) {
            continue;
        }

        const expected =
            permutations[paletteIndex];

        if (!expected) {
            continue;
        }

        const relative =
            flatIndexToLocation(
                i,
                data.size
            );

        const block =
            dimension.getBlock(
                add(
                    STAGING.location,
                    relative
                )
            );

        if (!block) {
            differences.push({
                relative,
                expected:
                    describePermutation(
                        expected
                    ),
                actual: "<unloaded>"
            });

            continue;
        }

        const actual =
            block.permutation;

        const expectedStates =
            expected.getAllStates();

        const actualStates =
            actual.getAllStates();

        const keys = new Set([
            ...Object.keys(expectedStates),
            ...Object.keys(actualStates)
        ]);

        const same =
            actual.type.id ===
                expected.type.id &&
            [...keys].every(
                key =>
                    expectedStates[key] ===
                    actualStates[key]
            );

        if (!same) {
            differences.push({
                relative,
                expected:
                    describePermutation(
                        expected
                    ),
                actual:
                    describePermutation(
                        actual
                    )
            });
        }
    }

    return differences;
}

function logMutationTest(differences) {
    console.warn(
        `[Structure Test] ` +
        `${differences.length} block(s) ` +
        `changed during staging.`
    );

    for (
        const difference
        of differences.slice(
            0,
            MAX_MUTATION_LOGS
        )
    ) {
        const p =
            difference.relative;

        console.warn(
            `[Structure Test] ` +
            `${p.x},${p.y},${p.z}\n` +
            `EXPECTED: ` +
            `${difference.expected}\n` +
            `ACTUAL:   ` +
            `${difference.actual}`
        );
    }

    if (
        differences.length >
        MAX_MUTATION_LOGS
    ) {
        console.warn(
            `[Structure Test] ` +
            `${differences.length -
                MAX_MUTATION_LOGS} ` +
            `additional change(s) omitted.`
        );
    }
}

function normaliseStringList(value) {
    if (!Array.isArray(value)) {
        return null;
    }

    return value
        .map(value => {
            if (
                typeof value ===
                "string"
            ) {
                return value;
            }

            return (
                value?.Name ??
                value?.name ??
                String(value)
            );
        })
        .filter(Boolean);
}

function tryRestore(
    label,
    fn,
    restored,
    unsupported
) {
    try {
        fn();

        restored.push(label);

        return true;
    } catch (error) {
        unsupported.push(
            `${label} (${error})`
        );

        return false;
    }
}

function itemTag(savedItem) {
    return (
        savedItem?.tag &&
        typeof savedItem.tag ===
            "object"
    )
        ? savedItem.tag
        : {};
}

function restoreItemData(
    stack,
    savedItem
) {
    const tag =
        itemTag(savedItem);

    const restored = [];
    const unsupported = [];

    const handledTop =
        new Set([
            "Name",
            "Count",
            "Slot"
        ]);

    const handledTag =
        new Set();

    /*
     * Durability / Damage
     */

    const damage =
        Number(
            tag.Damage ??
            savedItem.Damage
        );

    if (
        Number.isFinite(damage) &&
        damage !== 0
    ) {
        const durability =
            stack.getComponent(
                "minecraft:durability"
            );

        if (durability) {
            tryRestore(
                "Damage",
                () => {
                    durability.damage =
                        Math.max(
                            0,
                            Math.min(
                                Math.trunc(
                                    damage
                                ),
                                durability
                                    .maxDurability
                            )
                        );
                },
                restored,
                unsupported
            );

            handledTag.add(
                "Damage"
            );

            handledTop.add(
                "Damage"
            );
        }
    } else {
        handledTag.add(
            "Damage"
        );

        handledTop.add(
            "Damage"
        );
    }

    /*
     * Display data
     */

    const display =
        tag.display;

    if (
        display &&
        typeof display ===
            "object"
    ) {
        if (
            typeof display.Name ===
            "string"
        ) {
            tryRestore(
                "display.Name",
                () => {
                    stack.nameTag =
                        display.Name;
                },
                restored,
                unsupported
            );
        }

        if (
            Array.isArray(
                display.Lore
            )
        ) {
            tryRestore(
                "display.Lore",
                () => {
                    stack.setLore(
                        display.Lore.map(
                            String
                        )
                    );
                },
                restored,
                unsupported
            );
        }

        const extra =
            Object.keys(display)
                .filter(
                    key =>
                        ![
                            "Name",
                            "Lore"
                        ].includes(key)
                );

        if (extra.length) {
            unsupported.push(
                ...extra.map(
                    key =>
                        `display.${key}`
                )
            );
        }

        handledTag.add(
            "display"
        );
    }

    /*
     * CanDestroy
     */

    const canDestroy =
        normaliseStringList(
            tag.CanDestroy ??
            savedItem.CanDestroy
        );

    if (canDestroy) {
        tryRestore(
            "CanDestroy",
            () => {
                stack.setCanDestroy(
                    canDestroy
                );
            },
            restored,
            unsupported
        );

        handledTag.add(
            "CanDestroy"
        );

        handledTop.add(
            "CanDestroy"
        );
    }

    /*
     * CanPlaceOn
     */

    const canPlaceOn =
        normaliseStringList(
            tag.CanPlaceOn ??
            savedItem.CanPlaceOn
        );

    if (canPlaceOn) {
        tryRestore(
            "CanPlaceOn",
            () => {
                stack.setCanPlaceOn(
                    canPlaceOn
                );
            },
            restored,
            unsupported
        );

        handledTag.add(
            "CanPlaceOn"
        );

        handledTop.add(
            "CanPlaceOn"
        );
    }

    /*
     * Enchantments
     */

    const enchantments =
        tag.ench ??
        tag.Enchantments ??
        savedItem.ench ??
        savedItem.Enchantments;

    if (
        Array.isArray(
            enchantments
        ) &&
        enchantments.length
    ) {
        const enchantable =
            stack.getComponent(
                "minecraft:enchantable"
            );

        if (enchantable) {
            for (
                const enchantment
                of enchantments
            ) {
                const id =
                    enchantment?.id ??
                    enchantment?.Id ??
                    enchantment?.Name;

                const level =
                    Number(
                        enchantment?.lvl ??
                        enchantment?.Level ??
                        1
                    );

                if (
                    typeof id !==
                    "string"
                ) {
                    unsupported.push(
                        `enchantment ` +
                        `${JSON.stringify(
                            enchantment
                        )} ` +
                        `(numeric/unknown id)`
                    );

                    continue;
                }

                const namespaced =
                    id.includes(":")
                        ? id
                        : `minecraft:${id}`;

                tryRestore(
                    `enchantment ` +
                    `${namespaced} ` +
                    `${level}`,
                    () => {
                        enchantable
                            .addEnchantment({
                                type:
                                    namespaced,
                                level:
                                    Math.trunc(
                                        level
                                    )
                            });
                    },
                    restored,
                    unsupported
                );
            }
        } else {
            unsupported.push(
                "enchantments " +
                "(item has no " +
                "enchantable component)"
            );
        }

        handledTag.add(
            "ench"
        );

        handledTag.add(
            "Enchantments"
        );

        handledTop.add(
            "ench"
        );

        handledTop.add(
            "Enchantments"
        );
    }

    /*
     * Keep on death
     */

    const keep =
        tag.keep_on_death ??
        tag.KeepOnDeath ??
        savedItem.keepOnDeath;

    if (keep !== undefined) {
        tryRestore(
            "keepOnDeath",
            () => {
                stack.keepOnDeath =
                    Boolean(keep);
            },
            restored,
            unsupported
        );

        handledTag.add(
            "keep_on_death"
        );

        handledTag.add(
            "KeepOnDeath"
        );

        handledTop.add(
            "keepOnDeath"
        );
    }

    /*
     * Report everything we did
     * not reconstruct.
     */

    for (
        const key
        of Object.keys(tag)
    ) {
        if (
            !handledTag.has(key)
        ) {
            unsupported.push(
                `tag.${key}`
            );
        }
    }

    for (
        const key
        of Object.keys(savedItem)
    ) {
        if (
            !handledTop.has(key) &&
            key !== "tag"
        ) {
            unsupported.push(key);
        }
    }

    return {
        restored,
        unsupported:
            [...new Set(
                unsupported
            )]
    };
}

function makeItemStack(savedItem) {
    const count =
        Number(
            savedItem.Count ?? 1
        );

    if (
        !savedItem.Name ||
        !Number.isFinite(count) ||
        count <= 0
    ) {
        throw new Error(
            `Invalid saved item: ` +
            `${JSON.stringify(
                savedItem
            )}`
        );
    }

    const stack =
        new ItemStack(
            savedItem.Name,
            Math.trunc(count)
        );

    const report =
        restoreItemData(
            stack,
            savedItem
        );

    return {
        stack,
        report
    };
}

function decodeSignText(value) {
    if (
        typeof value !==
        "string"
    ) {
        return null;
    }

    return value;
}

function dyeFromNbt(value) {
    if (
        typeof value ===
        "string"
    ) {
        const compact =
            value
                .replace(
                    /[_\s-]/g,
                    ""
                )
                .toLowerCase();

        for (
            const [
                key,
                enumValue
            ]
            of Object.entries(
                DyeColor
            )
        ) {
            if (
                key
                    .toLowerCase() ===
                    compact ||
                String(enumValue)
                    .toLowerCase() ===
                    compact
            ) {
                return enumValue;
            }
        }
    }

    return undefined;
}

function restoreSign(
    block,
    nbt,
    restored,
    unsupported
) {
    const sign =
        block.getComponent(
            "minecraft:sign"
        );

    if (!sign) {
        return false;
    }

    const handled =
        new Set([
            "id",
            "x",
            "y",
            "z",
            "isMovable"
        ]);

    /*
     * Support both older and
     * newer sign NBT layouts.
     */

    const frontText =
        decodeSignText(
            nbt.Text ??
            nbt.FrontText?.Text ??
            nbt.front_text?.Text ??
            nbt.front_text?.text
        );

    const backText =
        decodeSignText(
            nbt.BackText?.Text ??
            nbt.back_text?.Text ??
            nbt.back_text?.text
        );

    if (
        frontText !== null
    ) {
        tryRestore(
            "sign front text",
            () => {
                sign.setText(
                    frontText,
                    SignSide.Front
                );
            },
            restored,
            unsupported
        );

        handled.add("Text");
        handled.add("FrontText");
        handled.add("front_text");
    }

    if (
        backText !== null
    ) {
        tryRestore(
            "sign back text",
            () => {
                sign.setText(
                    backText,
                    SignSide.Back
                );
            },
            restored,
            unsupported
        );

        handled.add("BackText");
        handled.add("back_text");
    }

    /*
     * Sign dye colours
     */

    const frontColor =
        dyeFromNbt(
            nbt.SignTextColor ??
            nbt.FrontText?.Color ??
            nbt.front_text?.Color ??
            nbt.front_text?.color
        );

    const backColor =
        dyeFromNbt(
            nbt.BackText?.Color ??
            nbt.back_text?.Color ??
            nbt.back_text?.color
        );

    if (
        frontColor !== undefined
    ) {
        tryRestore(
            "sign front dye",
            () => {
                sign.setTextDyeColor(
                    frontColor,
                    SignSide.Front
                );
            },
            restored,
            unsupported
        );

        handled.add(
            "SignTextColor"
        );
    }

    if (
        backColor !== undefined
    ) {
        tryRestore(
            "sign back dye",
            () => {
                sign.setTextDyeColor(
                    backColor,
                    SignSide.Back
                );
            },
            restored,
            unsupported
        );
    }

    /*
     * Wax state
     */

    const waxed =
        nbt.IsWaxed ??
        nbt.isWaxed ??
        nbt.Waxed;

    if (waxed !== undefined) {
        tryRestore(
            "sign waxed",
            () => {
                sign.setWaxed(
                    Boolean(waxed)
                );
            },
            restored,
            unsupported
        );

        handled.add(
            "IsWaxed"
        );

        handled.add(
            "isWaxed"
        );

        handled.add(
            "Waxed"
        );
    }

    /*
     * Report unknown sign NBT.
     */

    for (
        const key
        of Object.keys(nbt)
    ) {
        if (
            !handled.has(key)
        ) {
            unsupported.push(
                `block.${key}`
            );
        }
    }

    return true;
}

async function applyBlockEntities(
    data,
    dimension
) {
    const entries =
        getBlockEntityEntries(data);

    const stats = {
        blockEntities: 0,
        containers: 0,
        items: 0,
        signs: 0,
        restoredFields: 0,
        unsupportedFields: 0
    };

    for (
        const entry
        of entries
    ) {
        const relative =
            flatIndexToLocation(
                entry.flatIndex,
                data.size
            );

        const worldLocation =
            add(
                STAGING.location,
                relative
            );

        const block =
            dimension.getBlock(
                worldLocation
            );

        if (!block) {
            throw new Error(
                `Staging block ` +
                `${worldLocation.x} ` +
                `${worldLocation.y} ` +
                `${worldLocation.z} ` +
                `is not loaded. ` +
                `Keep the staging chunk ` +
                `loaded and retry.`
            );
        }

        const nbt =
            entry.blockEntity;

        const restored = [];
        const unsupported = [];

        let supportedBlockEntity =
            false;

        /*
         * Containers
         */

        if (
            Array.isArray(
                nbt.Items
            )
        ) {
            const container =
                block.getComponent(
                    "minecraft:inventory"
                )?.container;

            if (container) {
                supportedBlockEntity =
                    true;

                container.clearAll();

                for (
                    const savedItem
                    of nbt.Items
                ) {
                    const slot =
                        Number(
                            savedItem.Slot
                        );

                    if (
                        !Number.isInteger(
                            slot
                        ) ||
                        slot < 0 ||
                        slot >=
                            container.size
                    ) {
                        unsupported.push(
                            `Items[slot=` +
                            `${savedItem.Slot}] ` +
                            `invalid slot`
                        );

                        continue;
                    }

                    try {
                        const {
                            stack,
                            report
                        } =
                            makeItemStack(
                                savedItem
                            );

                        container.setItem(
                            slot,
                            stack
                        );

                        stats.items++;

                        restored.push(
                            ...report
                                .restored
                                .map(
                                    value =>
                                        `Items[` +
                                        `${slot}].` +
                                        `${value}`
                                )
                        );

                        unsupported.push(
                            ...report
                                .unsupported
                                .map(
                                    value =>
                                        `Items[` +
                                        `${slot}].` +
                                        `${value}`
                                )
                        );
                    } catch (error) {
                        unsupported.push(
                            `Items[` +
                            `${slot}] ` +
                            `(${error})`
                        );
                    }
                }

                restored.push(
                    "Items"
                );

                stats.containers++;
            } else {
                unsupported.push(
                    "Items " +
                    "(block has no " +
                    "inventory component)"
                );
            }
        }

        /*
         * Signs
         */

        if (
            block.getComponent(
                "minecraft:sign"
            )
        ) {
            supportedBlockEntity =
                restoreSign(
                    block,
                    nbt,
                    restored,
                    unsupported
                ) ||
                supportedBlockEntity;

            if (
                supportedBlockEntity
            ) {
                stats.signs++;
            }
        }

        /*
         * For block entities without
         * a specialised handler,
         * report every non-bookkeeping
         * NBT field.
         */

        const bookkeeping =
            new Set([
                "id",
                "x",
                "y",
                "z",
                "isMovable",
                "Items"
            ]);

        if (
            !block.getComponent(
                "minecraft:sign"
            )
        ) {
            for (
                const key
                of Object.keys(nbt)
            ) {
                if (
                    !bookkeeping.has(
                        key
                    )
                ) {
                    unsupported.push(
                        `block.${key}`
                    );
                }
            }
        }

        stats.blockEntities++;

        stats.restoredFields +=
            restored.length;

        stats.unsupportedFields +=
            new Set(
                unsupported
            ).size;

        /*
         * Detailed report
         */

        if (
            unsupported.length
        ) {
            console.warn(
                `[Structure NBT] ` +
                `${nbt.id ?? "unknown"} ` +
                `@ ` +
                `${relative.x},` +
                `${relative.y},` +
                `${relative.z}: ` +
                `unsupported/unrestored: ` +
                `${[
                    ...new Set(
                        unsupported
                    )
                ].join(", ")}`
            );
        }

        if (
            restored.length
        ) {
            console.warn(
                `[Structure NBT] ` +
                `${nbt.id ?? "unknown"} ` +
                `@ ` +
                `${relative.x},` +
                `${relative.y},` +
                `${relative.z}: ` +
                `restored: ` +
                `${[
                    ...new Set(
                        restored
                    )
                ].join(", ")}`
            );
        } else if (
            !supportedBlockEntity
        ) {
            console.warn(
                `[Structure NBT] ` +
                `${nbt.id ?? "unknown"} ` +
                `@ ` +
                `${relative.x},` +
                `${relative.y},` +
                `${relative.z}: ` +
                `no writable Script API ` +
                `reconstruction available.`
            );
        }
    }

    return stats;
}

function clearStaging(
    data,
    dimension
) {
    const air =
        BlockPermutation.resolve(
            "minecraft:air"
        );

    for (
        let x = 0;
        x < data.size.x;
        x++
    ) {
        for (
            let y = 0;
            y < data.size.y;
            y++
        ) {
            for (
                let z = 0;
                z < data.size.z;
                z++
            ) {
                const block =
                    dimension.getBlock({
                        x:
                            STAGING.location.x +
                            x,
                        y:
                            STAGING.location.y +
                            y,
                        z:
                            STAGING.location.z +
                            z
                    });

                if (block) {
                    block.setPermutation(
                        air
                    );
                }
            }
        }
    }
}

async function acknowledge(name) {
    try {
        await requestJson(
            `${API}/structures/` +
            `${encodeURIComponent(
                name
            )}`,
            HttpRequestMethod.Delete
        );

        console.warn(
            `[Structure Import] ` +
            `Acknowledged ${name}.`
        );
    } catch (error) {
        console.error(
            `[Structure Import] ` +
            `${name} was saved, ` +
            `but acknowledgement failed: ` +
            `${error}`
        );
    }
}

async function importStructure(name) {
    const data =
        await requestJson(
            `${API}/structures/` +
            `${encodeURIComponent(
                name
            )}`
        );

    const identifier =
        `${STRUCTURE_NAMESPACE}:` +
        `${name}`;

    const manager =
        world.structureManager;

    const dimension =
        world.getDimension(
            STAGING.dimension
        );

    const existing =
        manager.get(identifier);

    if (existing) {
        manager.delete(existing);
    }

    const structure =
        manager.createEmpty(
            identifier,
            data.size,
            StructureSaveMode.World
        );

    const permutations =
        data.palette.map(
            resolvePermutation
        );

    const primary =
        data.blockIndices?.[0];

    if (
        !Array.isArray(primary)
    ) {
        manager.delete(
            structure
        );

        throw new Error(
            "Parsed structure has no " +
            "primary block-index layer."
        );
    }

    let placed = 0;
    let unset = 0;
    let unresolved = 0;

    try {
        /*
         * Build the initial
         * block-only structure.
         */

        for (
            let i = 0;
            i < primary.length;
            i++
        ) {
            const paletteIndex =
                primary[i];

            if (
                paletteIndex === -1
            ) {
                unset++;

                continue;
            }

            const permutation =
                permutations[
                    paletteIndex
                ];

            if (!permutation) {
                unresolved++;

                continue;
            }

            structure
                .setBlockPermutation(
                    flatIndexToLocation(
                        i,
                        data.size
                    ),
                    permutation
                );

            placed++;
        }

        structure.saveToWorld();

        const blockEntityEntries =
            getBlockEntityEntries(
                data
            );

        /*
         * If block entities exist,
         * perform the staging
         * round-trip.
         */

        if (
            blockEntityEntries.length >
            0
        ) {
            manager.place(
                structure,
                dimension,
                STAGING.location,
                {
                    includeBlocks: true,
                    includeEntities: false
                }
            );

            await nextTick();

            /*
             * Redstone mutation test
             * BEFORE NBT writes.
             */

            const before =
                compareStagingToExpected(
                    data,
                    dimension,
                    permutations
                );

            logMutationTest(before);

            if (
                before.length > 0
            ) {
                throw new Error(
                    `Staging changed ` +
                    `${before.length} ` +
                    `block(s) before NBT ` +
                    `reconstruction; ` +
                    `aborting recapture.`
                );
            }

            /*
             * Restore supported
             * block entity / item NBT.
             */

            const restored =
                await applyBlockEntities(
                    data,
                    dimension
                );

            await nextTick();

            /*
             * Redstone mutation test
             * AFTER NBT writes.
             */

            const after =
                compareStagingToExpected(
                    data,
                    dimension,
                    permutations
                );

            if (
                after.length > 0
            ) {
                logMutationTest(after);

                throw new Error(
                    `Staging changed ` +
                    `${after.length} ` +
                    `block(s) after NBT ` +
                    `reconstruction; ` +
                    `aborting recapture.`
                );
            }

            /*
             * Remove the original
             * block-only structure so
             * createFromWorld can reuse
             * the identifier.
             */

            manager.delete(
                structure
            );

            const end = {
                x:
                    STAGING.location.x +
                    data.size.x -
                    1,

                y:
                    STAGING.location.y +
                    data.size.y -
                    1,

                z:
                    STAGING.location.z +
                    data.size.z -
                    1
            };

            /*
             * Capture the staged world
             * back into Minecraft's
             * native structure storage.
             */

            manager.createFromWorld(
                identifier,
                dimension,
                STAGING.location,
                end,
                {
                    includeBlocks: true,
                    includeEntities: false,
                    saveMode:
                        StructureSaveMode
                            .World
                }
            );

            console.warn(
                `[Structure Import] ` +
                `Re-captured ` +
                `${identifier}: ` +
                `${restored.blockEntities} ` +
                `block entit` +
                `${
                    restored.blockEntities ===
                    1
                        ? "y"
                        : "ies"
                }, ` +
                `${restored.containers} ` +
                `container(s), ` +
                `${restored.items} ` +
                `item stack(s), ` +
                `${restored.signs} ` +
                `sign(s), ` +
                `${restored.unsupportedFields} ` +
                `unsupported NBT field(s).`
            );

            clearStaging(
                data,
                dimension
            );
        } else {
            structure.saveToWorld();
        }
    } catch (error) {
        try {
            clearStaging(
                data,
                dimension
            );
        } catch {
            // Ignore cleanup failure.
        }

        throw error;
    }

    console.warn(
        `[Structure Import] ` +
        `Imported ${identifier}: ` +
        `${data.size.x}x` +
        `${data.size.y}x` +
        `${data.size.z}, ` +
        `${placed} blocks, ` +
        `${unset} unset, ` +
        `${unresolved} unresolved.`
    );

    await acknowledge(name);
}

async function poll() {
    if (polling) {
        return;
    }

    polling = true;

    try {
        const pending =
            await requestJson(
                `${API}/structures`
            );

        if (
            !Array.isArray(pending)
        ) {
            throw new Error(
                "Watcher returned an " +
                "invalid pending list."
            );
        }

        for (
            const item
            of pending
        ) {
            if (!item?.name) {
                continue;
            }

            try {
                await importStructure(
                    item.name
                );
            } catch (error) {
                console.error(
                    `[Structure Import] ` +
                    `${item.name} failed: ` +
                    `${error}`
                );
            }
        }
    } catch (error) {
        console.error(
            `[Structure Import] ` +
            `Poll failed: ${error}`
        );
    } finally {
        polling = false;
    }
}

system.runInterval(
    () => {
        void poll();
    },
    POLL_TICKS
);

system.run(
    () => {
        void poll();
    }
);

import {
    world,
    system,
    Player,
    EntityDamageCause,
    EquipmentSlot
} from "@minecraft/server";

const TRANSLATION_PREFIX = "rsp.death.";
const COMBAT_TIMEOUT = 200;

const lastAttacks = new Map();

const damageCauses = new Set(
    Object.values(EntityDamageCause)
);

const weaponCauses = new Set([
    "entityAttack",
    "maceSmash"
]);

const combatCauses = new Set([
    "fall",
    "void",
    "lava",
    "fire",
    "fireTick",
    "drowning",
    "magma",
    "contact",
    "stalagmite",
    "flyIntoWall",
    "freezing"
]);

const projectileTypes = {
    "minecraft:arrow": "arrow",
    "minecraft:thrown_trident": "trident",
    "minecraft:fireball": "fireball",
    "minecraft:small_fireball": "fireball",
    "minecraft:wither_skull": "witherSkull",
    "minecraft:wither_skull_dangerous": "witherSkull",
    "minecraft:shulker_bullet": "shulkerBullet",
    "minecraft:llama_spit": "llamaSpit",
    "minecraft:snowball": "snowball"
};

system.run(() => {
    world.gameRules.showDeathMessages = false;
});

function getEntityName(entity) {
    if (!entity) return undefined;

    try {
        if (entity instanceof Player) {
            return { text: entity.name };
        }

        if (entity.nameTag) {
            return { text: entity.nameTag };
        }

        const typeId = entity.typeId.replace(
            /^minecraft:/,
            ""
        );

        return {
            translate: `entity.${typeId}.name`
        };
    } catch {
        return undefined;
    }
}

function getWeaponName(entity) {
    if (!entity) return undefined;

    try {
        const equipment = entity.getComponent(
            "minecraft:equippable"
        );

        const item = equipment?.getEquipment(
            EquipmentSlot.Mainhand
        );

        // Only show weapons with custom names.
        if (!item?.nameTag) return undefined;

        return { text: item.nameTag };
    } catch {
        return undefined;
    }
}

function getAttacker(source) {
    try {
        const projectile = source.damagingProjectile;

        const owner = projectile?.getComponent(
            "minecraft:projectile"
        )?.owner;

        return owner ?? source.damagingEntity;
    } catch {
        return source.damagingEntity;
    }
}

function getProjectileType(source) {
    try {
        return projectileTypes[
            source.damagingProjectile?.typeId
            ];
    } catch {
        return undefined;
    }
}

function sendDeathMessage(key, ...args) {
    for (const player of world.getAllPlayers()) {
        if (player.hasTag("hideDeathMessages")) { continue; }
        player.sendMessage({
            translate: TRANSLATION_PREFIX + key,
            with: {
                rawtext: args
            }
        });
    }
}

world.afterEvents.entityHurt.subscribe(event => {
    const victim = event.hurtEntity;

    if (!(victim instanceof Player)) return;

    const attacker = getAttacker(event.damageSource);

    if (!attacker || attacker.id === victim.id) return;

    const attackerName = getEntityName(attacker);

    if (!attackerName) return;

    lastAttacks.set(victim.id, {
        attacker: attackerName,
        tick: system.currentTick
    });
});

world.afterEvents.entityDie.subscribe(event => {
    const victim = event.deadEntity;

    if (!(victim instanceof Player)) return;

    const source = event.damageSource;
    const cause = source.cause;

    const victimName = { text: victim.name };
    const attacker = getAttacker(source);

    const previousAttack = lastAttacks.get(victim.id);
    lastAttacks.delete(victim.id);

    const attackerName =
        attacker && attacker.id !== victim.id
            ? getEntityName(attacker)
            : undefined;

    const weaponName = weaponCauses.has(cause)
        ? getWeaponName(attacker)
        : undefined;

    // Player or mob killed with a named weapon.
    if (attackerName && weaponName) {
        sendDeathMessage(
            `${cause}.item`,
            victimName,
            attackerName,
            weaponName
        );
        return;
    }

    // Special projectile messages.
    if (cause === "projectile") {
        const projectile = getProjectileType(source);

        if (projectile) {
            if (attackerName) {
                sendDeathMessage(
                    `projectile.${projectile}.entity`,
                    victimName,
                    attackerName
                );
            } else {
                sendDeathMessage(
                    `projectile.${projectile}`,
                    victimName
                );
            }

            return;
        }
    }

    // Direct deaths involving another entity.
    if (attackerName) {
        switch (cause) {
            case "entityAttack":
            case "entityExplosion":
            case "projectile":
            case "maceSmash":
            case "magic":
            case "thorns":
            case "sonicBoom":
            case "ramAttack":
            case "fireworks":
            case "lightning":
                sendDeathMessage(
                    `${cause}.entity`,
                    victimName,
                    attackerName
                );
                return;
        }
    }

    // Environmental deaths during combat.
    if (combatCauses.has(cause)) {
        const recentAttacker = previousAttack &&
        system.currentTick - previousAttack.tick
        <= COMBAT_TIMEOUT
            ? previousAttack.attacker
            : undefined;

        const combatAttacker =
            attackerName ?? recentAttacker;

        if (combatAttacker) {
            sendDeathMessage(
                `${cause}.combat`,
                victimName,
                combatAttacker
            );
            return;
        }
    }

    // Standard environmental deaths.
    const key = damageCauses.has(cause) &&
    !["none", "charging", "override"].includes(cause)
        ? cause
        : "generic";

    sendDeathMessage(key, victimName);
});

world.afterEvents.playerLeave.subscribe(event => {
    lastAttacks.delete(event.playerId);
});

// Remove expired combat records.
system.runInterval(() => {
    for (const [id, attack] of lastAttacks) {
        if (
            system.currentTick - attack.tick >
            COMBAT_TIMEOUT
        ) {
            lastAttacks.delete(id);
        }
    }
}, 100);
import { CustomCommandStatus, Player, system } from "@minecraft/server";

export function success(message) {
    return {
        status: CustomCommandStatus.Success,
        message,
    };
}
export function failure(message) {
    return {
        status: CustomCommandStatus.Failure,
        message,
    };
}
export function sendTranslation(player, key, parameters = []) {
    system.run(() => {
        player.sendMessage({
            translate: key,
            with: parameters,
        });
    });
}
export function translatedSuccess(player, key, parameters = []) {
    sendTranslation(player, key, parameters);
    return success();
}
export function translatedFailure(player, key, parameters = []) {
    sendTranslation(player, key, parameters);
    return success();
}
export function translatedOriginFailure(origin, key, parameters = []) {
    const player = origin.sourceEntity;
    if (player instanceof Player) {
        return translatedFailure(player, key, parameters);
    }
    return failure(key);
}
export function sendTranslationNow(player, key, parameters = []) {
    player.sendMessage({
        translate: key,
        with: parameters,
    });
}

export function getCommandPlayer(origin) {
    const source = origin.sourceEntity;
    if (source instanceof Player) {
        return source;
    }
    return undefined;
}

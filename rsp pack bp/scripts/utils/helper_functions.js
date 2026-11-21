import { CustomCommandStatus, Player, system } from "@minecraft/server";
export const success = () => ({ status: CustomCommandStatus.Success });
export const failure = () => ({ status: CustomCommandStatus.Failure });
export const getCommandPlayer = origin => origin.sourceEntity instanceof Player ? origin.sourceEntity : undefined;
export function sendLater(player, message) {
    system.run(() => {
        if (player.isValid) player.sendMessage(message);
    });
}
export function reply(player, key, parameters = [], failed = false) {
    sendLater(player, { translate: key, with: parameters });
    return failed ? failure() : success();
}
export function replyOrigin(origin, key, parameters = []) {
    const player = getCommandPlayer(origin);
    if (player) sendLater(player, { translate: key, with: parameters });
    return failure();
}

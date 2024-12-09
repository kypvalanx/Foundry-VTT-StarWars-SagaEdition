export function suppressibleDialog(entity, message, title, suppress) {
    if (suppress) {
        console.error(message, entity)
        throw Error(message);
    } else {
        new Dialog({
            title: title,
            content: message,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Ok'
                }
            }
        }).render(true);
    }
}
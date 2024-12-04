export function suppressibleDialog(entity, message, title, suppress) {
    if (suppress) {
        console.warn(message, entity)
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
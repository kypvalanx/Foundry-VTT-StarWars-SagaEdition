import {SUBTYPES} from "./constants.mjs";

export const registerHandlebarsHelpers = function () {


    // If you need to add Handlebars helpers, here are a few useful examples:
    Handlebars.registerHelper('concat', function() {
        let outStr = '';
        for (const arg of Object.keys(arguments)) {
            if (typeof arguments[arg] != 'object') {
                outStr += arguments[arg];
            }
        }
        return outStr;
    });

    Handlebars.registerHelper('typeOf', function() {
        const funcNameRegex = /class (\w+)/;
        const string = arguments[0].constructor.toString();
        const results = (funcNameRegex).exec(string);
        return (results && results.length > 1) ? results[1] : "";
    });

    Handlebars.registerHelper('arr', function() {
        // Covnert arguments to array, ommiting the last item, which is the options obect
        return Array.prototype.slice.call(arguments,0,-1);
    })

    Handlebars.registerHelper('toUpperCase', function(str) {
        return !!str ? str.toUpperCase() : str;
    });

    Handlebars.registerHelper('or', function(arg1, arg2) {
        return arg1 || arg2;
    });

    Handlebars.registerHelper('stringify', function(str) {
        return !!str ? JSON.stringify(str) : str;
    });

    //TODO Remove
    Handlebars.registerHelper('toLowerCase', function(str) {
        return !!str ? str.toLowerCase() : str;
    });

    Handlebars.registerHelper('toLowercase', function(str) {
        return !!str ? str.toLowerCase() : str;
    });
    Handlebars.registerHelper('toTitleCase', function(str) {
        return str.titleCase();
    });
    Handlebars.registerHelper('toHtmlClass', function(str) {
        return str.toLowerCase().replace(/ /g, "-");
    });

    Handlebars.registerHelper('notEmpty', function (array, options) {
        console.log(array, options)
        return (array && array.length > 0)? options.fn():"";
    })

    Handlebars.registerHelper('sumActiveResults', function (array, options) {
        return array.filter(result => result.active).reduce((accumulator, currentValue) => accumulator + currentValue.result, 0);
    })

    Handlebars.registerHelper('unlessEquals', function(...args) {
        const arg1 = args[0];
        const options = args[args.length - 1];

        for (let i = 1; i < args.length - 1; i++) {
            if(arg1 === args[i]) {
                return options.inverse(this);
            }
        }
        return options.fn(this);
    });

    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
        if(Array.isArray(arg1)){
            return arg1.includes(arg2) ? options.fn(this) : options.inverse(this);
        }
        if(Array.isArray(arg2)){
            return arg2.includes(arg1) ? options.fn(this) : options.inverse(this);
        }

        return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('ifContains', function(arg1, arg2, options) {
        if(Array.isArray(arg1)){
            return arg1.includes(arg2) ? options.fn(this) : options.inverse(this);
        }
        if(Array.isArray(arg2)){
            return arg2.includes(arg1) ? options.fn(this) : options.inverse(this);
        }

        return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });


    Handlebars.registerHelper('ifGT', function(arg1, arg2, options) {
        return (arg1 > arg2) ? options.fn(this) : options.inverse(this);
    });
    Handlebars.registerHelper('ifLT', function(arg1, arg2, options) {
        return (arg1 < arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('ifLast', function(arg1, arg2, options) {
        return (arg1 + 1 === arg2.length) ? options.fn(this) : options.inverse(this);
    });


    Handlebars.registerHelper('unlessBoth', function(arg1, arg2, options) {
        return !(arg1 && arg2) ? options.fn(this) : options.inverse(this);
    });
    Handlebars.registerHelper('ifEither', function(arg1, arg2, options) {
        return (arg1 || arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('sum', function(arg1, arg2, options) {
        let number = parseInt(arg1|| 0) + parseInt(arg2||0);
        return number
    });

    Handlebars.registerHelper('times', function(n, block) {
        let accum = '';
        for(let i = 0; i < n; ++i)
            accum += block.fn(i);
        return accum;
    });

    Handlebars.registerHelper('select', function( value, options ){
        let $el = $('<select />').html( options.fn(this) );
        $el.find('[value="' + value + '"]').attr({'selected':'selected'});
        return $el.html();
    });

    Handlebars.registerHelper('options', function(arg1, arg2){
        let values = undefined
        let selected;

        if(arg2.hash){
            selected = arg2.hash.selected;
        }

        if(Array.isArray(arg1)){
            values = arg1;
        } else if('type' === arg1){
            values = Object.keys(game.system.documentTypes.Item).filter(type => type !== "base")
        } else if('subtype' === arg1){
            values = SUBTYPES[arg2] || [];
        } else if(Object.entries(arg1).length > 0){
            values = []
            let hash = arg2.hash;
            if(hash){
                selected = hash['selected']
            }
            values = Object.entries(arg1);
        }

        let response = '';

        for(let value of values || []){
            if(Array.isArray(value)){
                response += `<option value="${value[0]}" ${value[0] === selected ? 'selected' : ""}>${value[1].titleCase()}</option>`;
            } if(!!value.value) {
                const display = value.display || value.value;
                const tooltip = value.tooltip ? ` title="${value.tooltip}"` : null;
                response += `<option value="${value.value}" ${value.value === selected ? 'selected' : ""}${tooltip}>${display.titleCase()}</option>`;
            } else {
                response += `<option value="${value}" ${value === selected ? 'selected' : ""}>${value.titleCase()}</option>`;
            }
        }
        return response;
    });


    Handlebars.registerHelper('radio', function( value, options ){
        let $el = $('<div />').html( options.fn(this) );
        let find = $el.find('[value="' + value + '"]');
        find.attr({'checked':'checked'});
        return $el.html();
    });


    Handlebars.registerHelper('tons', function(str) {
        if (str === 0){
            return str;
        }
        if(Math.abs(str) < 1){
            str = str * 1000;
            if(Math.abs(str) === 1){
                return `${str} kg`;
            }
            return `${str} kgs`;
        }

        if(Math.abs(str) === 1){
            return `${str} Ton`;
        }
        return `${str} Tons`;
    });

    //Handlebars.registerHelper('getLabel', function(value, options) {})
    //.registerHelper('getNotes', function(value, options) {})
}

export function depthMerge(toBeAdded, changed) {
    for (const entry of Object.entries(toBeAdded)) {
        let cursor = changed;
        let lastCursor = cursor;
        const paths = entry[0].split("\. ")
        for (const path of paths) {
            if (!cursor[path]) {
                cursor[path] = {};
            }
            lastCursor = cursor;
            cursor = cursor[path];
        }
        lastCursor = entry[1];
    }
}

export function titleCase(s) {
    const words = s.split(" ");

    for (let i = 0; i < words.length; i++) {
        if (words[i][0] === "(") {
            words[i] = words[i][0] + words[i][1].toUpperCase() + words[i].substr(2);
        } else {
            words[i] = words[i][0].toUpperCase() + words[i].substr(1);
        }
    }
    return words.join(" ");
}
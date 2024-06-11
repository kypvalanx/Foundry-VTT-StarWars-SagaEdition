import {SUBTYPES} from "../common/constants.mjs";

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

    Handlebars.registerHelper("unlessContains", function(arg1, arg2, options) {
        if(Array.isArray(arg1)) {
            return arg1.includes(arg2) ? options.inverse(this) : options.fn(this);
        }
        if(Array.isArray(arg2)) {
            return arg2.includes(arg1) ? options.inverse(this) : options.fn(this);
        }

        return arg1 !== arg2 ? options.fn(this) : options.inverse(this);
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

    Handlebars.registerHelper('unlessEquals', function(arg1, arg2, options) {
        return (arg1 !== arg2) ? options.fn(this) : options.inverse(this);
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
        for(let i = 0; i < n;++i) {
            block.data.index = i;
            accum += block.fn(i);
        };
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
        if(Array.isArray(arg1)){
            values = arg1;
        } else if('type' === arg1){
            values = Object.keys(game.system.documentTypes).filter(type => type !== "base")
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
                response += `<option value="${value[0]}" ${value[0] === selected ? 'selected' : ""}>${value[1]}</option>`;
            } else {
                response += `<option value="${value}" ${value === selected ? 'selected' : ""}>${value}</option>`;
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

    Handlebars.registerHelper("math", function(lvalue, operator, rvalue, options) {
        lvalue = parseFloat(lvalue);
        rvalue = parseFloat(rvalue);

        return {
            "+": lvalue + rvalue,
            "-": lvalue - rvalue,
            "*": lvalue * rvalue,
            "/": lvalue / rvalue,
            "%": lvalue % rvalue,
        }[operator];
    }
    );

    Handlebars.registerHelper("objectField", function(object, key, fieldname) {
        return object[key][fieldname];
    });

    Handlebars.registerHelper("parseRollsFrom", function (content) {
        const htmlRollWrapper = `<span class="rollable" data-roll="${{}}"></span>`
    });

    /**
     * Register a debug helper for Handlebars to be able to log data or inspect data in the browser console
     *
     * Usage:
     *   {{debug someObj.data}} => logs someObj.data to the console
     *   {{debug someObj.data true}} => logs someObj.data to the console and stops at a debugger point
     *
     * Source: https://gist.github.com/elgervb/5c38c8d70870f92ef6338a291edf88e9
     *
     * @param {any} data to log to console
     * @param {boolean} breakpoint whether or not to set a breakpoint to inspect current state in debugger
     */
    Handlebars.registerHelper("debug", function(data, breakpoint) {
        console.log(data);
        if(breakpoint === true) {
            debugger;
        }
        return "";
    });
};

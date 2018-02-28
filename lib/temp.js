"use strict";

// https://stackoverflow.com/questions/2051678/getting-all-variables-in-scope
// https://stackoverflow.com/questions/30758961/how-to-check-if-a-variable-is-an-es6-class-declaration
// https://github.com/nodejs/node-v0.x-archive/issues/9211

const Module = require("module");
const path = require("path");
const vm = require("vm");
const fs = require("fs-extra");
const jsdoc = require("jsdoc-api");

const originalLoad = Module._load;
let loaded = false;

Module._load = function(request, parent) {
    const m = originalLoad(request, parent);

    if (parent.filename === __filename) {
        loaded = parent;
    }

    return m;
};

const getType = (value) => {
    if (typeof value === "function" && /^\s*class\s+/.test(value.toString())) {
        return "class";
    } else if (value instanceof Array) {
        return "array";
    }

    return typeof value;
};

// Credits: http://stackoverflow.com/questions/30030161/javascript-function-arguments-positional-map-transition
const getParamNames = (fn) => {
    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    const ARGUMENT_NAMES = /([^\s,]+)/g;

    const fnStr = fn.toString().replace(STRIP_COMMENTS, "");
    const result = fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")")).match(ARGUMENT_NAMES);

    return result === null ? [] : result;
};

const parseFunction = (object, name, doc = {}) => {
    const value = object[name];
    const params = [];
    const raw = getParamNames(value);

    // TODO: Parse async
    // TODO: Parse static

    for (let n = 0; n < raw.length; n++) {
        const param = {
            name: raw[n]
        };

        if (raw[n + 1] === "=") {
            try {
                param.default = JSON.parse(raw[n + 2]);
            } catch (error) {}

            n += 2;
        }

        const d = (doc.params || []).find((doc) => doc.name === param.name);

        param.description = d ? (d.description || false) : false;
        param.types = d ? (d.type.names || []) : [];

        params.push(param);
    }

    return {
        name,
        params,
        description: doc.description || false
    };
};

const getDetails = (name, value, docs = []) => {
    const details = {
        type: getType(value)
    };

    if (details.type === "class") {
        const match = value.toString().match(/\s*extends\s+(.*?)\s+/);


        const doc = docs.find((doc) => doc.name === name);

        details.extends = match ? match[1] : false;
        details.description = (doc ? doc.classdesc : false) || false;
        details.methods = [];

        for (const n of Object.getOwnPropertyNames(value.prototype)) {
            if (typeof value.prototype[n] === "function") {
                const doc = docs.find((doc) => doc.longname === `${name}#${n}`);

                details.methods.push(parseFunction(value.prototype, n, doc));
            }
        }
    } else if (details.type === "object") {
        details.methods = [];

        for (const n of Object.getOwnPropertyNames(value)) {
            if (typeof value[n] === "function") {
                const doc = docs.find((doc) => doc.longname === `${name}#${n}`);

                details.methods.push(parseFunction(value, n, doc));
            }
        }
    }

    return details;
};

const run = async (filename) => {
    const content = await fs.readFile(filename);
    const script = content.toString().replace(/const |let /g, "var ");

    const docs = await jsdoc.explain({ source: content.toString() });

    const src = `
        function ____store(target) {
            return new Proxy(target, {
                has(target, prop) { return true; },
                get(target, prop) {
                    if (prop === "exports") {
                        return exports;
                    } else if (prop === "require") {
                        return require;
                    } else if (prop === "module") {
                        return module;
                    } else if (prop === "__filename") {
                        return __filename;
                    } else if (prop === "__dirname") {
                        return __dirname;
                    }

                    return target[prop];
                }
            });
        }

        const ___globals = {};

        with(____store(___globals)) {
            ${script}
        }

        module.exports.___globals = ___globals;
    `;
    const context = Module.wrap(src);

    vm.runInThisContext(context)(exports, require, module, filename, path.dirname(filename));


    const info = {
        filename,
        imports: [],
        exports: []
    };

    for (const name of Object.keys(loaded.exports.___globals)) {
        const exported = loaded.exports.___globals[name];

        const child = loaded.children.find((child) => {
            if (child.exports === exported) {
                return true;
            }

            if (typeof child.exports === "object") {
                for (const n of Object.keys(child.exports)) {
                    if (child.exports[n] === exported) {
                        return true;
                    }
                }
            }
        });

        info.imports.push({
            name,
            details: getDetails(name, exported),
            filename: child ? child.filename : false
        });
    }

    delete module.exports.___globals;

    if (typeof loaded.exports === "function") {
        info.exports.push({
            name: loaded.exports.name,
            details: getDetails(loaded.exports.name, loaded.exports, docs),
            filename
        });
    }

    for (const name of Object.keys(loaded.exports)) {
        info.exports.push({
            name,
            details: getDetails(name, loaded.exports[name], docs),
            filename
        });
    }

    // TODO: How to parse jsdoc-tags for descriptions, params and return values


    console.log(JSON.stringify(info, null, 2));

    // console.log(util.inspect(module.exports));
    // console.log(loaded);
};

run(path.resolve(process.argv[2]));

// [{ globalVar: "set" }, { globalVar: "set" }, { globalVar: "set" }]

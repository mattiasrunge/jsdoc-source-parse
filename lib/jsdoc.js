"use strict";

const jsdoc = require("jsdoc-api");

const cleanParam = (param) => ({
    ...param,
    type: param.type.names
});

const jsdocParse = async (source) => {
    const docs = await jsdoc.explain({ source });

    const classes = docs
    .filter((doc) => doc.kind === "class" && doc.meta.code.type === "ClassDeclaration")
    .map((doc) => ({
        kind: "class",
        name: doc.name,
        extends: doc.augments,
        description: doc.classdesc,
        scope: doc.scope,
        members: docs
        .filter((doc) => doc.memberof === d.name && doc.kind === "member")
        .map((doc) => ({
            kind: "member",
            name: doc.name,
            description: doc.description,
            scope: doc.scope
        })),
        methods: docs
        .filter((doc) => doc.memberof === d.name && doc.meta.code.type === "MethodDefinition")
        .map((doc) => ({ // TODO: Static?
            kind: "method",
            name: doc.name === d.name ? "constructor" : doc.name,
            description: doc.description,
            scope: doc.scope,
            async: doc.async,
            optional: doc.optional,
            params: doc.params.map(cleanParam),
            returns: doc.params.map(cleanParam)
        }))
    }));
};

module.exports = jsdocParse;

"use strict";

const path = require("path");
const fs = require("fs-extra");

class Parser {
    async parse(filename) {
        const absFilename = path.resolve(filename);
        const content = await fs.readFile(absFilename);


    }
}

module.exports = new Parser();

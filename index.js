"use strict";

const parser = require("./lib/parser");

parser
.parse(process.argv[2])
.then((info) => JSON.stringify(info, null, 2))
.catch((error) => {
    console.error(error);
    process.exit(255);
});

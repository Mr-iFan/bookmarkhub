const fs = require("fs");
const Module = require("module");

const original = Module._extensions[".yaml"];

Module._extensions[".yaml"] = (mod, filename) => {
  const content = fs.readFileSync(filename, "utf8");
  mod._compile(`module.exports = ${JSON.stringify(content)};`, filename);
};

module.exports = {
  restore() {
    if (original) {
      Module._extensions[".yaml"] = original;
    }
  },
};

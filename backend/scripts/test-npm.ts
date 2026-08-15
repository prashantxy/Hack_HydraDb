import { fetchNpmPackage } from "../src/npm/registry";

const data = await fetchNpmPackage("axios");

const version = data.versions["1.7.2"];

if (!version) {
  throw new Error("axios@1.7.2 not found");
}

console.log("Package:", version.name);
console.log("Version:", version.version);
console.log("Dependencies:", version.dependencies);
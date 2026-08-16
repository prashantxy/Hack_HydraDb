import {
  resolveVersion,
} from "../src/npm/resolver";

const dependencies = {
  "form-data": "^4.0.0",
  "proxy-from-env": "^1.1.0",
  "follow-redirects": "^1.15.6",
};

for (
  const [name, range]
  of Object.entries(dependencies)
) {
  const version =
    await resolveVersion(
      name,
      range,
    );

  console.log(
    `${name} ${range} → ${version}`,
  );
}
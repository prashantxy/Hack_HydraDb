import {
  HydraValue,
} from "../hydra/client";

import {
  getPackageVersions,
  getDependencies,
} from "./query";

export async function packageInfo(packageName: string) {
  const result = await getPackageVersions(packageName);

  const versions = result.rows.map((row) => ({
    name: hydraValue<string>(row[0]),
    key: hydraValue<string>(row[1]),
    version: hydraValue<string>(row[2]),
  }));

  return {
    name: packageName,
    versions,
  };
}

export async function packageDependencies(versionKey: string) {
  const result = await getDependencies(versionKey);

  return result.rows.map((row) => ({
    source: hydraValue<string>(row[0]),
    packageName: hydraValue<string>(row[1]),
    versionRange: hydraValue<string>(row[2]),
    dependencyType: hydraValue<string>(row[3]),
    target: hydraValue<string>(row[4]),
  }));
}

function hydraValue<T>(arg0: any) {
    throw new Error("Function not implemented.");
}

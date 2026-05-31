const path = require("path");
const Module = require("module");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const mobileNodeModules = path.resolve(projectRoot, "node_modules");

process.env.EXPO_ROUTER_APP_ROOT = path.resolve(projectRoot, "app");
process.env.NODE_PATH = [mobileNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
Module._initPaths();

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(projectRoot);

config.maxWorkers = Number(process.env.EXPO_METRO_MAX_WORKERS || 1);
config.transformer.unstable_allowRequireContext = true;
config.watchFolders = [workspaceRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native")
};

module.exports = config;

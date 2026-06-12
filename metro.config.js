const path = require("path");

const projectRoot = __dirname;

process.env.EXPO_ROUTER_APP_ROOT = path.resolve(projectRoot, "app");

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(projectRoot);

config.maxWorkers = Number(process.env.EXPO_METRO_MAX_WORKERS || 6);
config.transformer.unstable_allowRequireContext = true;
config.resolver.blockList = [
  /\/server\/.*/,
  /\/\.git\/.*/,
];

module.exports = config;

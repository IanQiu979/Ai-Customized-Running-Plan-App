// Metro config, added when the Cloudflare Workers backend landed under `workers/`.
//
// `workers/` is a separate npm project with its own `node_modules`, sitting inside the Expo
// project root. Metro crawls everything under the root by default, so without this it would walk a
// second dependency tree that has nothing to do with the app bundle — slowing every start and
// risking duplicate-package resolution between the two trees. Nothing under `workers/` is ever
// imported by app code; the traffic goes the other way (the Worker imports the shared pure modules
// in `src/lib/`), so excluding it costs the app nothing.
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = exclusionList([
  /workers\/node_modules\/.*/,
  /workers\/\.wrangler\/.*/,
]);

module.exports = config;

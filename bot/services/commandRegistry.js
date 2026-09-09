/**
 * Central command registry.
 */
const registry = new Map();
const ACCESS_LEVELS = new Set(["public", "registered", "admin", "owner"]);
function key(command, subcommand) { return `${command}:${subcommand || ""}`; }
function register(command, subcommand, handler, options = {}) {
  if (!command || subcommand == null) throw new Error("Command registry entries require a command and optional subcommand");
  if (typeof handler !== "function") throw new TypeError(`Handler for /${command}${subcommand ? ` ${subcommand}` : ""} must be a function`);
  const entryKey=key(command,subcommand);
  if(registry.has(entryKey)) throw new Error(`Duplicate command registration: /${command}${subcommand ? ` ${subcommand}` : ""}`);
  const access=options.access || (options.requiresOwner===true?"owner":options.requiresAdmin===true?"admin":options.requiresRegistration!==false?"registered":"public");
  if(!ACCESS_LEVELS.has(access)) throw new Error(`Invalid command access level: ${access}`);
  registry.set(entryKey,Object.freeze({command,subcommand:subcommand||null,handler,access,requiresRegistration:access!=="public",requiresAdmin:access==="admin"||options.requiresAdmin===true,requiresOwner:access==="owner"||options.requiresOwner===true,description:options.description||""}));
  return registry.get(entryKey);
}
function get(command,subcommand){return registry.get(key(command,subcommand));}
function has(command,subcommand){return registry.has(key(command,subcommand));}
function list(){return [...registry.values()];}
function clear(){registry.clear();}
module.exports={register,get,has,list,clear};
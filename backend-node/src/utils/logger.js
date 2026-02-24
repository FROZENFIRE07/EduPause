// Shared logger — extracted to break circular dependency
// (server.js → ingestion.js → youtube.js → server.js)

const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
};

function ts() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export function log(icon, category, msg, ...args) {
    const formatted = args.length > 0
        ? msg.replace(/%[sd]/g, () => args.shift())
        : msg;
    console.log(`${C.gray}${ts()}${C.reset} │ ${icon} ${C.cyan}[${category}]${C.reset} ${formatted}`);
}

export { C };

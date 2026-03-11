"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAMPLE_EVENT_KEYS = exports.RETRY_BACKOFF_SECONDS = exports.MESSAGE_JOB_NAME = exports.QUEUE_NAMES = void 0;
exports.extractRequiredVariables = extractRequiredVariables;
exports.renderTemplate = renderTemplate;
exports.jitterSeconds = jitterSeconds;
exports.missingRequiredVariables = missingRequiredVariables;
exports.QUEUE_NAMES = {
    SEND: 'send-message',
    TEMPLATE_SYNC: 'template-sync',
    SENDER_SYNC: 'sender-sync'
};
exports.MESSAGE_JOB_NAME = 'message:dispatch';
exports.RETRY_BACKOFF_SECONDS = [2, 5, 15, 45, 120, 300, 900, 1800];
exports.SAMPLE_EVENT_KEYS = [
    'PUBL_USER_SIGNUP',
    'PUBL_TICKET_PURCHASED',
    'PUBL_PAYMENT_COMPLETED'
];
const REQUIRED_VAR_REGEX = /\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g;
function extractRequiredVariables(body) {
    const set = new Set();
    let match = REQUIRED_VAR_REGEX.exec(body);
    while (match) {
        set.add(match[1]);
        match = REQUIRED_VAR_REGEX.exec(body);
    }
    return [...set].sort();
}
function renderTemplate(body, variables) {
    return body.replace(REQUIRED_VAR_REGEX, (_, key) => {
        if (!(key in variables)) {
            throw new Error(`Missing template variable: ${key}`);
        }
        return String(variables[key]);
    });
}
function jitterSeconds(base) {
    const random = Math.random() * 0.3 + 0.85;
    return Math.max(1, Math.round(base * random));
}
function missingRequiredVariables(required, payload) {
    return required.filter((key) => {
        const value = payload[key];
        return value === undefined || value === null || value === '';
    });
}
//# sourceMappingURL=index.js.map
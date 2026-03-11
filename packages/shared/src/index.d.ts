export declare const QUEUE_NAMES: {
    readonly SEND: "send-message";
    readonly TEMPLATE_SYNC: "template-sync";
    readonly SENDER_SYNC: "sender-sync";
};
export declare const MESSAGE_JOB_NAME = "message:dispatch";
export declare const RESULT_CHECK_JOB_NAME = "message:result-check";
export declare const RETRY_BACKOFF_SECONDS: number[];
export declare const SAMPLE_EVENT_KEYS: readonly ["PUBL_USER_SIGNUP", "PUBL_TICKET_PURCHASED", "PUBL_PAYMENT_COMPLETED"];
export declare function extractRequiredVariables(body: string): string[];
export declare function renderTemplate(body: string, variables: Record<string, string | number>): string;
export declare function jitterSeconds(base: number): number;
export declare function missingRequiredVariables(required: string[], payload: Record<string, string | number | null | undefined>): string[];

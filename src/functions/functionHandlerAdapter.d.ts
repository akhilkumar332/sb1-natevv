export type FunctionHandlerResponse = {
  statusCode?: number;
  headers?: Record<string, string | string[]>;
  body?: string;
};

export type FunctionHandler = (event: {
  httpMethod: string;
  headers: Record<string, unknown>;
  body: string;
  rawUrl: string;
  path: string;
  queryStringParameters: Record<string, unknown>;
  isBase64Encoded: boolean;
}) => Promise<FunctionHandlerResponse>;

export declare const wrapFunctionHandler: (
  handler: FunctionHandler,
) => (req: unknown, res: unknown) => Promise<void>;

export declare const runScheduledFunctionHandler: (
  handler: () => Promise<FunctionHandlerResponse>,
) => Promise<null>;

export declare const functionHandlers: Record<string, FunctionHandler | (() => Promise<FunctionHandlerResponse>)>;

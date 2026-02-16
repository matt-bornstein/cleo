/* eslint-disable @typescript-eslint/no-explicit-any */

type AnyCtx = {
  db: {
    insert: (...args: unknown[]) => Promise<unknown>;
    patch: (...args: unknown[]) => Promise<unknown>;
    delete: (...args: unknown[]) => Promise<unknown>;
    get: (...args: unknown[]) => Promise<unknown>;
    query: (...args: unknown[]) => {
      withIndex: (...indexArgs: unknown[]) => {
        collect: () => Promise<unknown[]>;
        unique: () => Promise<unknown>;
        first: () => Promise<unknown>;
        order: (...orderArgs: unknown[]) => {
          collect: () => Promise<unknown[]>;
          first: () => Promise<unknown>;
        };
      };
    };
  };
  auth: {
    getUserIdentity: () => Promise<{
      tokenIdentifier: string;
      email?: string;
      name?: string;
    } | null>;
  };
  scheduler: {
    runAfter: (...args: unknown[]) => Promise<unknown>;
  };
};

type Handler = (ctx: AnyCtx, args: any) => unknown;

export function query(config: { args?: unknown; handler: Handler }) {
  return config.handler;
}

export function mutation(config: { args?: unknown; handler: Handler }) {
  return config.handler;
}

export function action(config: { args?: unknown; handler: Handler }) {
  return config.handler;
}

export function internalQuery(config: { args?: unknown; handler: Handler }) {
  return config.handler;
}

export function internalMutation(config: { args?: unknown; handler: Handler }) {
  return config.handler;
}

export function internalAction(config: { args?: unknown; handler: Handler }) {
  return config.handler;
}

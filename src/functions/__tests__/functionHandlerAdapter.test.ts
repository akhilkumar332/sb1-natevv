import { describe, expect, it, vi } from 'vitest';
import { wrapFunctionHandler, runScheduledFunctionHandler } from '../functionHandlerAdapter.js';

const createResponseDouble = () => {
  const response = {
    headers: {} as Record<string, unknown>,
    statusCode: 200,
    body: '',
    setHeader: vi.fn((key: string, value: unknown) => {
      response.headers[key] = value;
    }),
    status: vi.fn((statusCode: number) => {
      response.statusCode = statusCode;
      return response;
    }),
    send: vi.fn((body: string) => {
      response.body = body;
      return response;
    }),
  };

  return response;
};

describe('functionHandlerAdapter', () => {
  it('translates Firebase-style requests into function handler invocations', async () => {
    const handler = vi.fn(async (event) => ({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'session=test; Path=/',
      },
      body: JSON.stringify({
        method: event.httpMethod,
        body: event.body,
        query: event.queryStringParameters,
      }),
    }));
    const wrapped = wrapFunctionHandler(handler);

    const request = {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-1',
      },
      rawBody: Buffer.from(JSON.stringify({ hello: 'world' })),
      originalUrl: '/functions/contact-submit?mode=test',
      path: '/functions/contact-submit',
      query: {
        mode: 'test',
      },
    };
    const response = createResponseDouble();

    await wrapped(request as never, response as never);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      httpMethod: 'POST',
      body: JSON.stringify({ hello: 'world' }),
      queryStringParameters: { mode: 'test' },
    }));
    expect(response.setHeader).toHaveBeenCalledWith('Set-Cookie', 'session=test; Path=/');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      method: 'POST',
      query: { mode: 'test' },
    });
  });

  it('throws when a scheduled function handler returns an error status', async () => {
    await expect(runScheduledFunctionHandler(async () => ({
      statusCode: 500,
      body: 'scheduled failure',
    }))).rejects.toMatchObject({
      message: 'scheduled failure',
      statusCode: 500,
    });
  });
});

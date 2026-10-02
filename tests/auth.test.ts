import { describe, it, expect, beforeEach } from "vitest";
import { authenticateGatewayRequest, authenticateAdminRequest } from "../src/middleware/auth.js";
import { resetConfigCache } from "../src/config/config.js";
import { Request, Response } from "express";

function createMockReqRes(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request;
  let status = 200;
  let body: unknown = null;

  const res = {
    status(code: number) {
      status = code;
      return res;
    },
    json(data: unknown) {
      body = data;
      return res;
    },
  } as unknown as Response;

  return { req, res, getStatus: () => status, getBody: () => body };
}

describe("Auth Middleware", () => {
  beforeEach(() => {
    delete process.env.GATEWAY_API_KEY;
    delete process.env.ADMIN_API_KEY;
    resetConfigCache();
  });

  it("should pass through when no API keys configured", () => {
    const { req, res } = createMockReqRes();
    let calledNext = false;
    authenticateGatewayRequest(req, res, () => {
      calledNext = true;
    });
    expect(calledNext).toBe(true);
  });

  it("should reject unauthenticated requests when GATEWAY_API_KEY is set", () => {
    process.env.GATEWAY_API_KEY = "secret-key-123";
    resetConfigCache();

    const { req, res, getStatus } = createMockReqRes({});
    let calledNext = false;
    authenticateGatewayRequest(req, res, () => {
      calledNext = true;
    });

    expect(calledNext).toBe(false);
    expect(getStatus()).toBe(401);
  });

  it("should accept valid Bearer tokens when GATEWAY_API_KEY is set", () => {
    process.env.GATEWAY_API_KEY = "secret-key-123";
    resetConfigCache();

    const { req, res } = createMockReqRes({ authorization: "Bearer secret-key-123" });
    let calledNext = false;
    authenticateGatewayRequest(req, res, () => {
      calledNext = true;
    });

    expect(calledNext).toBe(true);
  });

  it("should enforce admin key for admin routes", () => {
    process.env.ADMIN_API_KEY = "admin-secret-999";
    resetConfigCache();

    const { req, res, getStatus } = createMockReqRes({ authorization: "Bearer wrong-key" });
    let calledNext = false;
    authenticateAdminRequest(req, res, () => {
      calledNext = true;
    });

    expect(calledNext).toBe(false);
    expect(getStatus()).toBe(403);
  });
});

import { Request, Response, NextFunction } from "express";
import { loadGatewayConfig } from "../config/config.js";

export function authenticateGatewayRequest(req: Request, res: Response, next: NextFunction) {
  const config = loadGatewayConfig();
  const configuredKey = config.server.apiKey;

  // If no API key configured, pass through (dev mode)
  if (!configuredKey) {
    return next();
  }

  const authHeader = req.headers.authorization || req.headers["x-api-key"];
  if (!authHeader) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing 'Authorization' or 'x-api-key' header",
    });
  }

  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : String(authHeader);

  if (token !== configuredKey) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid API key provided",
    });
  }

  return next();
}

export function authenticateAdminRequest(req: Request, res: Response, next: NextFunction) {
  const config = loadGatewayConfig();
  const configuredAdminKey = config.server.adminApiKey || config.server.apiKey;

  if (!configuredAdminKey) {
    return next();
  }

  const authHeader = req.headers.authorization || req.headers["x-admin-key"] || req.headers["x-api-key"];
  if (!authHeader) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing 'Authorization' or 'x-admin-key' header for admin action",
    });
  }

  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : String(authHeader);

  if (token !== configuredAdminKey) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid admin API key provided",
    });
  }

  return next();
}

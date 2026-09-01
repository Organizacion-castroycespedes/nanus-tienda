"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createId = void 0;
const node_crypto_1 = require("node:crypto");
const createId = (prefix) => `${prefix}-${Date.now()}-${(0, node_crypto_1.randomUUID)().slice(0, 8)}`;
exports.createId = createId;
//# sourceMappingURL=id.util.js.map
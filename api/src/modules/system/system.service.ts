import { Injectable } from "@nestjs/common";

@Injectable()
export class SystemService {
  getVersion() {
    return {
      version: process.env.APP_VERSION ?? "",
    };
  }
}

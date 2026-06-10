import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import type { PeripheralDevice } from "../../shared/types/peripheral.types";
import { DevicesService } from "./devices.service";
import type {
  CreateMockDeviceRequest,
  DiscoverDevicesResponse,
  UpdateMockDeviceRequest,
} from "./devices.types";

@Controller("devices")
export class DevicesController {
  constructor(
    @Inject(DevicesService) private readonly devicesService: DevicesService
  ) {}

  @Get()
  getDevices(): PeripheralDevice[] {
    return this.devicesService.list();
  }

  @Post("discover")
  discover(): DiscoverDevicesResponse {
    return this.devicesService.discover();
  }

  @Post()
  create(@Body() body: CreateMockDeviceRequest): PeripheralDevice {
    return this.devicesService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateMockDeviceRequest
  ): PeripheralDevice {
    return this.devicesService.update(id, body);
  }
}

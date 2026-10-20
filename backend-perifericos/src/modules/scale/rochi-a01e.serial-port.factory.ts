import { SerialPort } from "serialport";
import type {
  RochiSerialPort,
  RochiSerialPortFactory,
  RochiSerialPortOptions,
} from "./rochi-a01e.serial";

export const createRochiSerialPort: RochiSerialPortFactory = (
  options: RochiSerialPortOptions
): RochiSerialPort =>
  new SerialPort({
    path: options.path,
    baudRate: options.baudRate,
    dataBits: options.dataBits,
    stopBits: options.stopBits,
    parity: options.parity,
    rtscts: options.rtscts,
    autoOpen: options.autoOpen,
  });

export const listRochiSerialPorts = () => SerialPort.list();

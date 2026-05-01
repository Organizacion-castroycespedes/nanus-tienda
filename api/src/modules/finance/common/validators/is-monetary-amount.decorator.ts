import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

type MonetaryAmountOptions = {
  allowZero?: boolean;
};

export function IsMonetaryAmount(
  options?: MonetaryAmountOptions,
  validationOptions?: ValidationOptions
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isMonetaryAmount",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== "number" || !Number.isFinite(value)) {
            return false;
          }

          if (!options?.allowZero && value <= 0) {
            return false;
          }

          if (options?.allowZero && value < 0) {
            return false;
          }

          return Number.isInteger(value * 100);
        },
        defaultMessage(args?: ValidationArguments) {
          return options?.allowZero
            ? `${args?.property ?? "value"} debe ser un monto valido mayor o igual a cero con maximo 2 decimales`
            : `${args?.property ?? "value"} debe ser un monto valido mayor a cero con maximo 2 decimales`;
        },
      },
    });
  };
}

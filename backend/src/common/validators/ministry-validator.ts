import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { isValidMinistryForApostolate, isValidApostolate } from '../constants/organization.constants';

/**
 * Validates that a ministry belongs to the specified apostolate
 * Usage: @IsValidMinistryForApostolate('apostolate')
 */
export function IsValidMinistryForApostolate(
  apostolateProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidMinistryForApostolate',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [apostolateProperty],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          const isEmpty = value == null || (typeof value === 'string' && value.trim() === '');
          const isRelatedEmpty = relatedValue == null || (typeof relatedValue === 'string' && relatedValue.trim() === '');

          // If ministry is not provided or empty, skip validation (it's optional)
          if (isEmpty) {
            return true;
          }

          // If apostolate is not provided or empty, we can't validate ministry
          if (isRelatedEmpty) {
            return true;
          }

          // Validate apostolate first
          if (!isValidApostolate(relatedValue)) {
            return false;
          }

          // Validate ministry belongs to apostolate
          return isValidMinistryForApostolate(value, relatedValue);
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          const ministry = args.value;
          
          if (!isValidApostolate(relatedValue)) {
            return `${relatedPropertyName} must be a valid apostolate`;
          }
          
          return `Ministry "${ministry}" does not belong to apostolate "${relatedValue}". Please select a valid ministry for this apostolate.`;
        },
      },
    });
  };
}

/**
 * Validates that an apostolate is from the official list
 */
export function IsValidApostolate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidApostolate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          // If apostolate is not provided or empty/whitespace, skip validation (it's optional)
          if (value == null || (typeof value === 'string' && value.trim() === '')) {
            return true;
          }
          return isValidApostolate(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be one of the valid BLD Cebu apostolates`;
        },
      },
    });
  };
}

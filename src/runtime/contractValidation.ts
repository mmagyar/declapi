import { validate, ValidationResult } from 'yaschva'
import { map } from 'microtil'
import { ContractType, HttpMethods } from '../globalTypes'

export type ContractResultError = {
  errorType: string; data: any; code: number; errors: ValidationResult|string[];
};

export type ContractResultSuccess = {result: object}
export type ContractResult = ContractResultError | ContractResultSuccess;

export const isContractInError = (tbd: any): tbd is ContractResultError =>
  Boolean(tbd.errors)

export type ContractWithValidatedHandler = {
  [key: string]: {
    name: string;
    handle: (input: any) => Promise<ContractResult>;
    method: HttpMethods;
    authentication: boolean | string[];
  };
};

export const addValidationToContract = (
  contracts: { [key:string]: ContractType<any, any>},
  validateOutput:boolean = true
): ContractWithValidatedHandler => {
  return map(contracts, (value: ContractType<any, any>) => {
    return {
      name: value.name,
      method: value.type,
      authentication: value.authentication,
      handle: async (input: any): Promise<ContractResult> => {
        const validationResult = validate(value.arguments, input)
        if (validationResult.result === 'fail') {
          return {
            errorType: 'Input validation failed',
            data: input,
            code: 400,
            errors: validationResult
          }
        }

        if (value.handle) {
          const result = await value.handle(input)
          if (validateOutput) {
            const outputValidation = validate(value.returns, result)
            if (outputValidation.result === 'fail') {
              return {
                errorType: 'Unexpected result from function',
                data: result,
                code: 500,
                errors: outputValidation
              }
            }
          }
          return { result }
        }
        return {
          errorType: 'Not implemented',
          data: value.name,
          code: 501,
          errors: [`Handler for ${value.name} was not defined`]
        }
      }
    }
  })
}

export default addValidationToContract

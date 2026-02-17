/**
 * Type generation module.
 *
 * Re-exports the public API for generating TypeScript types and Zod
 * schemas from the intermediate representation.
 */
export {
  emitTypeScriptTypes,
  emitTypeString,
  emitParamsInterface,
  emitRequestBodyType,
  emitResponseType,
} from './typescript-emitter'

export { emitZodSchemas, emitZodType } from './zod-emitter'

import engineJson from './data/engine.json'

export const ENGINE_SETTINGS_DATA = engineJson.engine_settings
export const ENGINE_QUESTIONS_DATA = engineJson.questions

export type EngineData = typeof engineJson

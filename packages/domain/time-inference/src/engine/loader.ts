import engineJson from '@workspace/engine-data/data/engine.json'
import type { EngineQuestion, EngineSettings } from './types'
import type { ZishiName } from '../survey/types'

export const ENGINE_SETTINGS = engineJson.engine_settings as unknown as EngineSettings
export const ZISHI_LIST = engineJson.engine_settings.zishi_list as ZishiName[]
export const ENGINE_QUESTIONS = engineJson.questions as unknown as EngineQuestion[]

export const QUESTION_MAP = new Map(ENGINE_QUESTIONS.map(q => [q.id, q]))

export const CORE_QUESTIONS = ENGINE_QUESTIONS.filter(q => q.structure_role === 'core')

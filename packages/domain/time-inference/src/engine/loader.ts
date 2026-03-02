import engineJson from '@workspace/engine-data/data/engine.json'
import type { EngineQuestion, EngineSettings } from './types'
import type { ZishiName } from '../survey/types'

interface EngineSettingsData extends EngineSettings {}
interface EngineQuestionsData extends Array<EngineQuestion> {}
interface EngineDataPayload {
  engine_settings: EngineSettingsData
  questions: EngineQuestionsData
}

const ENGINE_DATA = engineJson as unknown as EngineDataPayload

export const ENGINE_SETTINGS = ENGINE_DATA.engine_settings
export const ZISHI_LIST = ENGINE_SETTINGS.zishi_list as ZishiName[]
export const ENGINE_QUESTIONS = ENGINE_DATA.questions

export const QUESTION_MAP = new Map(ENGINE_QUESTIONS.map(q => [q.id, q]))

export const CORE_QUESTIONS = ENGINE_QUESTIONS.filter(q => q.structure_role === 'core')

import engineJson from '../../docs/data/engine.json'
import type { EngineQuestion, EngineSettings } from './types'
import type { ZishiName } from '../survey/types'

export const ENGINE_SETTINGS = engineJson.engine_settings as unknown as EngineSettings
export const ZISHI_LIST = engineJson.engine_settings.zishi_list as ZishiName[]
export const ENGINE_QUESTIONS = engineJson.questions as unknown as EngineQuestion[]

// O(1) 조회용 Map
export const QUESTION_MAP = new Map(ENGINE_QUESTIONS.map(q => [q.id, q]))

// role별 필터 (미러링 추출에 사용)
export const CORE_QUESTIONS = ENGINE_QUESTIONS.filter(q => q.structure_role === 'core')

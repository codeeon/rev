import type { ZishiName, StructureRole } from '../survey/types'

export interface EngineSettings {
  version: string
  default_temperature: number
  cusp_logic: {
    gap_threshold: number
    min_score_std: number
    std_scope: string
  }
  score_monitoring: {
    compute_theoretical_bounds: boolean
    alert_if_zishi_max_diff_over: number
    alert_if_role_influence_over: number
  }
  distribution_monitoring: {
    track_top1_mean: boolean
    track_top2_gap_mean: boolean
    target_top1_band: [number, number]
  }
  zishi_list: ZishiName[]
}

export interface EngineOption {
  text: string
  score_map: Partial<Record<ZishiName, number>>
}

export interface EngineQuestion {
  id: string
  structure_role: StructureRole
  category: string
  question_weight: number
  text: string
  options: EngineOption[]
}
